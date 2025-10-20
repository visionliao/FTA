import { NextRequest } from 'next/server'
import { readdir, readFile, mkdir } from 'fs/promises'
import { join } from 'path'

// 扫描结果目录
export async function GET() {
  try {
    const resultDir = join(process.cwd(), 'output', 'result')
    
    // Try to create the directory if it doesn't exist
    try {
      await mkdir(resultDir, { recursive: true })
    } catch (error) {
      // If directory already exists, that's fine
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }

    // 读取目录列表
    const directories = await readdir(resultDir, { withFileTypes: true })

    // 过滤出目录并按名称排序（最新的在前面）
    const timestampDirs = directories
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort()
      .reverse()

    return Response.json({
      success: true,
      directories: timestampDirs
    })
  } catch (error) {
    console.error('Error scanning result directories:', error)
    return Response.json({
      success: false,
      error: 'Failed to scan result directories'
    }, { status: 500 })
  }
}

// 分析结果数据
export async function POST(request: NextRequest) {
  try {
    const { directory } = await request.json()
    
    if (!directory || directory === '全部分析') {
      // 分析所有目录
      return await analyzeAllDirectories()
    } else {
      // 分析指定目录
      return await analyzeDirectory(directory)
    }
  } catch (error) {
    console.error('Error analyzing results:', error)
    return Response.json({
      success: false,
      error: 'Failed to analyze results'
    }, { status: 500 })
  }
}

async function analyzeAllDirectories() {
  const resultDir = join(process.cwd(), 'output', 'result')

  // Try to create the directory if it doesn't exist
  try {
    await mkdir(resultDir, { recursive: true })
  } catch (error) {
    // If directory already exists, that's fine
    if ((error as any).code !== 'EEXIST') {
      throw error
    }
  }

  const directories = await readdir(resultDir, { withFileTypes: true })
  const timestampDirs = directories
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort() // 按时间排序，最新的在后面
    .reverse() // 反转，最新的在前面

  const directoryResults: any[] = []

  for (const dir of timestampDirs) {
    const dirResult = await analyzeDirectory(dir, false)
    if (dirResult && typeof dirResult === 'object' && 'success' in dirResult && dirResult.success) {
      const frameworkStatsValues = Object.values(dirResult.frameworkStats) as any[]
      const firstStat = frameworkStatsValues[0]
      
      directoryResults.push({
        directory: dir,
        frameworkStats: dirResult.frameworkStats,
        loopCount: firstStat?.loopCount || 0
      })
    }
  }

  return Response.json({
    success: true,
    directory: '全部分析',
    isMultiDirectory: true,
    directoryResults,
    directories: timestampDirs
  })
}

async function analyzeDirectory(directory: string, returnFullResult = true): Promise<any> {
  try {
    const dirPath = join(process.cwd(), 'output', 'result', directory)
    const frameworkScores: Record<string, number[]> = {}

    // 读取循环目录
    const loopDirs = await readdir(dirPath, { withFileTypes: true })

    for (const loopDir of loopDirs) {
      if (!loopDir.isDirectory()) continue

      const loopPath = join(dirPath, loopDir.name)
      const frameworkDirs = await readdir(loopPath, { withFileTypes: true })

      for (const frameworkDir of frameworkDirs) {
        if (!frameworkDir.isDirectory()) continue

        const frameworkPath = join(loopPath, frameworkDir.name)
        const resultsFile = join(frameworkPath, 'results.json')

        try {
          const resultsContent = await readFile(resultsFile, 'utf-8')
          const results = JSON.parse(resultsContent)

          // 提取分数
          const scores = results
            .filter((item: any) => item.score !== undefined)
            .map((item: any) => item.score)

          if (scores.length > 0) {
            if (!frameworkScores[frameworkDir.name]) {
              frameworkScores[frameworkDir.name] = []
            }
            frameworkScores[frameworkDir.name].push(...scores)
          }
        } catch (error) {
          console.warn(`Failed to read results for ${frameworkDir.name}:`, error)
        }
      }
    }

    const result = {
      success: true,
      directory,
      frameworkScores,
      frameworkStats: calculateFrameworkStats(frameworkScores)
    }

    return returnFullResult ? Response.json(result) : result
  } catch (error) {
    const result = {
      success: false,
      directory,
      error: 'Failed to analyze directory'
    }
    return returnFullResult ? Response.json(result, { status: 500 }) : result
  }
}

function calculateFrameworkStats(frameworkScores: Record<string, number[]>) {
  const stats: Record<string, {
    totalScore: number
    averageScore: number
    questionCount: number
    maxScore: number
    minScore: number
    averageTotalScore: number // 每轮循环的平均总分
    loopCount: number // 循环次数
    allLoopTotalScores: number[] // 所有循环的总分列表
  }> = {}

  Object.entries(frameworkScores).forEach(([framework, scores]) => {
    if (scores.length > 0) {
      // 计算平均分（每个问题的平均分）
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length

      // 找出最高分和最低分
      const maxScore = Math.max(...scores)
      const minScore = Math.min(...scores)

      // 假设有10个问题，每轮循环10个问题的总分
      // 我们需要根据数据长度推算出循环次数
      // 如果有180个分数，说明跑了18次循环，每轮10个问题
      const loopCount = scores.length / 10

      // 计算每轮循环的平均总分
      let averageTotalScore = 0
      const allLoopTotalScores: number[] = []
      if (loopCount > 0) {
        // 将分数按每10个一组进行分组（每轮循环）
        for (let i = 0; i < loopCount; i++) {
          const startIndex = i * 10
          const loopScore = scores.slice(startIndex, startIndex + 10).reduce((sum, score) => sum + score, 0)
          allLoopTotalScores.push(loopScore)
        }
        averageTotalScore = allLoopTotalScores.reduce((sum, score) => sum + score, 0) / allLoopTotalScores.length
      }

      stats[framework] = {
        totalScore: Number(averageTotalScore.toFixed(2)), // 使用平均总分而不是总分累加
        averageScore: Number(averageScore.toFixed(2)),
        questionCount: 10, // 固定10个问题
        maxScore,
        minScore,
        averageTotalScore: Number(averageTotalScore.toFixed(2)),
        loopCount,
        allLoopTotalScores
      }
    }
  })

  return stats
}