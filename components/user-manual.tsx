"use client"

import { Label } from "@/components/ui/label"

export function UserManual() {
  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">使用手册</h1>
      </div>

      <div className="space-y-8">
        {/* Introduction */}
        <section className="space-y-4">
          <div>
            <Label className="text-base font-medium text-foreground">简介</Label>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              欢迎使用 PromptEngineeringAgent！这是一个专业的提示词工程工具，帮助您构建、管理和优化 AI 提示词。
            </p>
          </div>
        </section>

        {/* Quick Start */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">快速开始</Label>
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">1. 创建项目</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"项目概览"页面中，输入项目名称和背景信息，开始您的提示词工程项目。
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">2. 选择框架</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"提示词框架"页面中，选择适合您项目的提示词框架，如 APE、CARE 或 RISE。
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">3. 配置模型</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"模型设置"页面中，选择 AI 模型并调整参数，如温度、最大令牌数等。
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">4. 运行测试</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"运行/结果"页面中，执行您的提示词并查看结果，不断优化直到满意。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">主要功能</Label>
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">项目管理：</strong>创建和管理多个提示词工程项目
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">框架支持：</strong>内置多种经典提示词框架，支持自定义框架
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">模型配置：</strong>灵活配置 AI 模型参数，优化输出质量
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">结果分析：</strong>查看运行结果和历史记录，持续改进
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">使用技巧</Label>
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-foreground leading-relaxed">
                💡 <strong>提示：</strong>选择合适的提示词框架是成功的关键。APE 适合简单任务，CARE
                适合需要上下文的复杂任务，RISE 适合需要角色扮演的场景。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
