import { NextRequest, NextResponse } from 'next/server'
import { readFile, mkdir, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import { handleChat } from '@/lib/llm/model-service';
import { ChatMessage, LlmGenerationOptions, NonStreamingResult } from '@/lib/llm/types';

// 安全调用大模型包装器，可以重试
interface SafeCallResult {
  success: boolean;
  content?: string;
  tokenUsage?: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  durationUsage?: {
    total_duration: number; // 整个请求处理的总耗时（单位通常是纳秒）。包含了模型加载、提示词处理和内容生成的所有时间
    load_duration: number;  // 如果模型不在内存中，加载模型到内存所花费的时间。如果模型已经加载，这个值可能为0。
    prompt_eval_duration: number; // 处理（评估）输入提示词（prompt）所花费的时间。
    eval_duration: number;  // 生成回复内容所花费的时间。
  };
  error?: string;
}

async function safeModelCall(
  selectedModel: string,
  messages: ChatMessage[],
  options: LlmGenerationOptions,
  retries = 2 // 默认重试2次
): Promise<SafeCallResult> {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        console.log(`[safeModelCall] Retrying... (Attempt ${i + 1})`);
        // 在重试前可以增加一个短暂的延迟
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const result = await handleChat(selectedModel, messages, options) as NonStreamingResult;

      if (result && typeof result.content === 'string') {
        return {
          success: true,
          content: result.content,
          tokenUsage: result.usage,
          durationUsage: result.duration
        };
      } else {
        // 记录非致命错误，但继续循环以重试
        const errorMessage = "Model call succeeded but returned unexpected format.";
        console.error(`[safeModelCall] Attempt ${i + 1} failed:`, errorMessage, result);
        if (i === retries) { // 如果这是最后一次重试
          return { success: false, error: errorMessage };
        }
      }
    } catch (error: any) {
      console.error(`[safeModelCall] Attempt ${i + 1} for ${selectedModel} caught a critical error:`, error);
      if (i === retries) { // 如果这是最后一次重试
        return { success: false, error: error.message || "A critical error occurred during model call" };
      }
    }
  }
  // 理论上不会执行到这里，但在 TS 中为了类型安全返回一个默认失败结果
  return { success: false, error: "Exited retry loop unexpectedly" };
}

// Helper to format date for directory name (YYMMDD_HHMMSS)
function getTimestamp() {
  const now = new Date()
  const pad = (num: number) => num.toString().padStart(2, '0')
  const year = now.getFullYear().toString().slice(-2)
  const month = pad(now.getMonth() + 1)
  const day = pad(now.getDate())
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

// Helper to send SSE messages in the correct format
function sendEvent(controller: ReadableStreamDefaultController, data: object) {
  try {
    controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
  } catch (e) {
    console.error("Failed to enqueue data, stream might be closed:", e);
  }
}

// 确保此路由在每次请求时都动态执行，而不是在构建时静态生成
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log("--- New Request Received ---");

  let config;
  try {
    config = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let isAborted = false

      try {
        const runTimestamp = getTimestamp()
        const baseResultDir = join(process.cwd(), "output", "result", runTimestamp)
        await mkdir(baseResultDir, { recursive: true })

        sendEvent(controller, { type: 'log', message: `结果目录已创建: ${runTimestamp}` })

        // 监听请求取消事件
        const abortListener = () => {
          isAborted = true
          console.log("Request aborted by client.")
        }
        // 添加前端传递过来的abort监听
        request.signal.addEventListener('abort', abortListener)

        // 调用主任务执行器，传递取消检查函数
        await runTask(config, baseResultDir, (data) => {
          // 每次发送进度前检查是否已取消
          if (isAborted || request.signal.aborted) {
            throw new Error('任务已被用户取消');
          }
          sendEvent(controller, data)
        }, () => isAborted || request.signal.aborted)

        // 移除监听器
        request.signal.removeEventListener('abort', abortListener)

        if (!isAborted && !request.signal.aborted) {
          sendEvent(controller, { type: 'done', message: '所有任务已成功完成。' })
        }
      } catch (error: any) {
        if (error.message === '任务已被用户取消') {
          console.log("Task execution cancelled by user.");
          sendEvent(controller, { type: 'error', message: '任务已被用户取消。' })
        } else {
          console.error("Task execution error:", error)
          sendEvent(controller, { type: 'error', message: error.message || "发生未知错误" })
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      console.log("Stream cancelled by client.");
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// 主任务执行器
async function runTask(config: any, baseResultDir: string, onProgress: (data: object) => void, isCancelled: () => boolean = () => false) {
  // 总任务数计算公式
  const totalTasks = (config.testCases.length * 2) * config.testConfig.loopCount;
  let currentTask = 0;
  let totalTokenUsage = 0; // 累计token消耗

  // 步骤 1: 整合项目背景信息
  onProgress({ type: 'log', message: `正在加载项目 '${config.project.projectName}' 的背景资料...` })

  // 创建基础项目上下文（不包含MCP工具）
  let baseProjectContext = `# 系统提示词\n${config.project.systemPrompt}\n\n`
  const knowledgeDir = join(process.cwd(), "output", "project", config.project.projectName, "knowledge")
  try {
    const knowledgeFiles = await readdir(knowledgeDir)
    for (const fileName of knowledgeFiles) {
      const content = await readFile(join(knowledgeDir, fileName), 'utf-8')
      baseProjectContext += `## 知识库文件: ${fileName}\n${content}\n\n`
      console.error(`读取知识库文件 ${fileName} 成功， 上下文长度: ${baseProjectContext.length}`);
    }
  } catch (e) {
      onProgress({ type: 'log', message: `警告: 未找到或无法读取知识库目录: ${knowledgeDir}` })
  }

  // 创建用于工作模型的上下文（不包含MCP工具JSON）
  const workContext = baseProjectContext
  console.error(`工作模型上下文创建完成，不包含MCP工具，长度: ${workContext.length}`);

  // 步骤 7: 外层循环
  for (let loop = 1; loop <= config.testConfig.loopCount; loop++) {
    // 检查是否已取消
    if (isCancelled()) {
      throw new Error('任务已被用户取消');
    }

    const loopDir = join(baseResultDir, loop.toString())
    await mkdir(loopDir, { recursive: true })

    // 为工作模型创建一个包含所有背景知识的系统提示词（不包含MCP工具JSON）
    const finalSystemPrompt = `
      ${workContext}
    `;
    let qaResults: any[] = [];
    for (const testCase of config.testCases) {
      // 步骤 3: 工作模型回答问题
      let score = 0;
      let modelAnswer = "N/A (调用失败)";
      let workTokenUsage = 0; // 工作模型token消耗
      let workDurationUsage = 0; // 工作模型耗时
      let scoreTokenUsage = 0; // 评分模型token消耗
      let scoreDurationUsage = 0; // 评分模型耗时
      currentTask++;
      onProgress({ type: 'update', payload: { activeTaskMessage: `正在回答问题 ${testCase.id}...`, progress: (currentTask / totalTasks) * 100, currentTask: currentTask } })

      const workModelConfig = config.models.workParams || {};
      // 从项目配置中获取MCP服务器地址
      const mcpServerUrl = config.project.mcpToolsCode && config.project.mcpToolsCode.trim()
        ? config.project.mcpToolsCode.trim() : '';

      const workOptions: LlmGenerationOptions = {
        stream: false,
        timeoutMs: 90000,
        maxOutputTokens: workModelConfig.maxTokens?.[0] || 8192,
        temperature: workModelConfig.temperature?.[0] || 1.0,
        topP: workModelConfig.topP?.[0] || 1.0,
        presencePenalty: workModelConfig.presencePenalty?.[0] || 0.0,
        frequencyPenalty: workModelConfig.frequencyPenalty?.[0] || 0.0, // 词汇丰富度,默认0，范围-2.0-2.0,值越大，用词越丰富多样；值越低，用词更朴实简单
        mcpServerUrl: mcpServerUrl, // 从项目配置获取mcp服务器地址
        systemPrompt: finalSystemPrompt, // 系统提示词
        maxToolCalls: 10 // 最大工具调用次数
      };
      const workMessages: ChatMessage[] = [
        {
          role: 'user',
          content: testCase.question,
        }
      ];
      // console.log(`工作模型: ${config.models.work}`);

      // 检查是否已取消
      if (isCancelled()) {
        throw new Error('任务已被用户取消');
      }

      const workResult = await safeModelCall(config.models.work, workMessages, workOptions);

      // 累加token使用量
      if (workResult.tokenUsage) {
        totalTokenUsage += workResult.tokenUsage.total_tokens;
        onProgress({ type: 'token_usage', tokenUsage: totalTokenUsage });
        workTokenUsage = workResult.tokenUsage.total_tokens; // 本次问答工作模型消耗token
      }
      if (workResult.durationUsage) { // 本次问答工作模型耗时
        workDurationUsage = Math.round(workResult.durationUsage.total_duration / 1e6);
      }

      if (workResult.success) {
        modelAnswer = workResult.content!;
      } else {
        onProgress({ type: 'log', message: `警告: 回答问题 #${testCase.id} 失败，已跳过评分。` });
      }

      onProgress({ type: 'state_update', payload: { questionId: testCase.id, questionText: testCase.question, modelAnswer, score: undefined, maxScore: undefined } });

      // 步骤 4: 评分模型进行评分（如果回答成功，才进行评分）
      currentTask++;
      if (workResult.success) {
        onProgress({ type: 'update', payload: { activeTaskMessage: `正在评估问题 ${testCase.id}...`, progress: (currentTask / totalTasks) * 100, currentTask: currentTask } });
        const scoreSystemPrompt = `你是一位极其严谨、注重事实的评估专家。你的任务是基于“标准答案”，评估“模型的回答”是否准确、完整地解决了用户的“问题”。

          请严格遵循以下【思考与评估步骤】：

          **第一步：核心事实核对**
          1.  仔细阅读“标准答案”，提取出其中所有关键的事实信息点（Key Facts），特别是数字、价格、地点、专有名词等。
          2.  逐一核对“模型的回答”中是否包含了这些关键事实点。
          3.  判断“模型的回答”中出现的数字、价格等信息，是否与“标准答案”中的信息完全一致。如果不一致，这是一个严重的错误。

          **第二步：语义与意图评估**
          1.  评估“模型的回答”的整体含义是否与“标准答案”的核心意图一致。它是否正确回答了用户的原始“问题”？
          2.  “标准答案”只是一个参考，可能并不完整。“模型的回答”可以包含比“标准答案”更多、更详细的正确信息。只要这些额外信息是与问题相关的、有帮助的，就不应该扣分，甚至可以认为是加分项。
          3.  忽略无关紧要的措辞差异。例如，“我们提供接送服务”和“是的，公寓有接送服务”是等价的。

          **第三步：最终评分**
          1.  综合以上分析，给出一个最终分数。满分为 ${testCase.score} 分。
          2.  评分标准：
              *   **满分 (${testCase.score}分)**: “模型的回答”包含了“标准答案”中所有的关键事实点，所有数字都准确无误，并且可能还提供了一些有用的补充信息。
              *   **高分 (7-${testCase.score - 1}分)**: 基本覆盖了所有关键事实，但可能遗漏了某个次要信息点，或者措辞上有些许不完美。
              *   **中等分数 (4-6分)**: 遗漏了重要的事实信息，或者出现了不影响核心意图的数字错误。
              *   **低分 (1-3分)**: 出现了严重的事实错误（例如价格、地址完全错误），或者回答基本没有解决用户的问题。
              *   **0分**: 完全错误的回答，或者产生了有害的幻觉。

          **输出要求：**
          在完成上述所有思考步骤后，最终只输出一个阿拉伯数字作为你的最终分数。不要包含任何解释、理由、标题或任何其他文字。`;

        const scoreMessage = `
        ---
        **问题:**
        ${testCase.question}

        ---
        **标准答案 (参考事实来源):**
        ${testCase.answer}

        ---
        **模型的回答 (待评估对象):**
        ${modelAnswer}
        `;
        const scoreModelConfig = config.models.scoreParams || {};
        const scoreOptions: LlmGenerationOptions = {
          stream: false,
          timeoutMs: 90000,
          maxOutputTokens: scoreModelConfig.maxTokens?.[0] || 8192,
          temperature: scoreModelConfig.temperature?.[0] || 1.0,
          topP: scoreModelConfig.topP?.[0] || 1.0,
          presencePenalty: scoreModelConfig.presencePenalty?.[0] || 0.0,
          frequencyPenalty: scoreModelConfig.frequencyPenalty?.[0] || 0.0, // 词汇丰富度,默认0，范围-2.0-2.0,值越大，用词越丰富多样；值越低，用词更朴实简单
          systemPrompt: scoreSystemPrompt, // 系统提示词
          maxToolCalls: 10 // 最大工具调用次数
        };
        const scoreGenMessages: ChatMessage[] = [
          {
            role: 'user',
            content: scoreMessage,
          }
        ];
        // console.log(`评分模型: ${config.models.score}`);

        // 检查是否已取消
        if (isCancelled()) {
          throw new Error('任务已被用户取消');
        }

        const scoreResult = await safeModelCall(config.models.score, scoreGenMessages, scoreOptions);

        // 累加token使用量
        if (scoreResult.tokenUsage) {
          totalTokenUsage += scoreResult.tokenUsage.total_tokens;
          onProgress({ type: 'token_usage', tokenUsage: totalTokenUsage });
          scoreTokenUsage = scoreResult.tokenUsage.total_tokens; // 本次评分消耗token
        }
        if (scoreResult.durationUsage) { // 本次评分耗时
          scoreDurationUsage = Math.round(scoreResult.durationUsage.total_duration / 1e6);
        }

        if (scoreResult.success) {
          score = parseInt(scoreResult.content!.trim().match(/\d+/)?.[0] || '0', 10);
        } else {
            onProgress({ type: 'log', message: `警告: 评估问题 #${testCase.id} 失败。` });
        }
      }
      onProgress({ type: 'state_update', payload: { score: score, maxScore: testCase.score } });

      const resultEntry = {
        id: testCase.id,
        question: testCase.question,
        standardAnswer: testCase.answer,
        modelAnswer,
        maxScore: testCase.score,
        score: score,
        workTokenUsage: workTokenUsage,
        workDurationUsage: workDurationUsage,
        scoreTokenUsage: scoreTokenUsage,
        scoreDurationUsage: scoreDurationUsage,
        error: workResult.error
      };
      qaResults.push(resultEntry);
      await writeFile(join(loopDir, 'results.json'), JSON.stringify(qaResults, null, 2), 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}