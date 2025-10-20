"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Loader2 } from "lucide-react"

interface QuestionResult {
  id: number
  question: string
  standardAnswer: string
  modelAnswer: string
  maxScore: number
  score: number
  workTokenUsage: number
  workDurationUsage: number
  scoreTokenUsage: number
  scoreDurationUsage: number
}

interface LoopResult {
  loopId: string
  results: QuestionResult[]
  averageScore: number
  totalScore: number
  totalTokenUsage: number
  averageDuration: number
}

export function DataAnalysis() {
  const [directories, setDirectories] = useState<string[]>([])
  const [selectedDirectory, setSelectedDirectory] = useState<string>("")
  const [loops, setLoops] = useState<string[]>([])
  const [selectedLoop, setSelectedLoop] = useState<string>("1")
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [loopResults, setLoopResults] = useState<LoopResult | null>(null)
  const [summaryStats, setSummaryStats] = useState<{
    averageScore: number
    totalTokenUsage: number
    averageDuration: number
    totalQuestions: number
  } | null>(null)

  // 加载结果目录
  useEffect(() => {
    loadDirectories()
  }, [])

  const loadDirectories = async () => {
    try {
      const response = await fetch("/api/analyze-results")
      const data = await response.json()
      if (data.success) {
        setDirectories(data.directories)
        if (data.directories.length > 0) {
          // 按时间排序，最新的在前面
          const sortedDirs = [...data.directories].sort().reverse()
          setSelectedDirectory(sortedDirs[0])
        }
      }
    } catch (error) {
      console.error("Failed to load directories:", error)
    }
  }

  // 当选择目录变化时，加载循环次数并重置为第1轮
  useEffect(() => {
    if (selectedDirectory) {
      loadLoops()
    }
  }, [selectedDirectory])

  // 当目录或循环变化时，自动分析数据
  useEffect(() => {
    if (selectedDirectory && selectedLoop) {
      analyzeResults()
    }
  }, [selectedDirectory, selectedLoop])

  const loadLoops = async () => {
    try {
      const response = await fetch("/api/analyze-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          directory: selectedDirectory,
          getLoops: true
        })
      })

      const data = await response.json()
      if (data.success && data.loops) {
        setLoops(data.loops.sort((a: string, b: string) => parseInt(a) - parseInt(b)))
        if (data.loops.length > 0) {
          setSelectedLoop(data.loops[0])
        }
      }
    } catch (error) {
      console.error("Failed to load loops:", error)
    }
  }

  const analyzeResults = async () => {
    if (isAnalyzing || !selectedDirectory || !selectedLoop) return

    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          directory: selectedDirectory,
          loop: selectedLoop
        })
      })

      const data = await response.json()
      if (data.success && data.results) {
        // 处理结果数据
        const results: QuestionResult[] = data.results
        const totalScore = results.reduce((sum: number, r: QuestionResult) => sum + r.score, 0)
        const averageScore = totalScore / results.length
        const totalTokenUsage = results.reduce((sum: number, r: QuestionResult) => sum + r.workTokenUsage + r.scoreTokenUsage, 0)
        const averageDuration = results.reduce((sum: number, r: QuestionResult) => sum + r.workDurationUsage + r.scoreDurationUsage, 0) / results.length

        setLoopResults({
          loopId: selectedLoop,
          results,
          averageScore,
          totalScore,
          totalTokenUsage,
          averageDuration
        })

        setSummaryStats({
          averageScore,
          totalTokenUsage,
          averageDuration,
          totalQuestions: results.length
        })
      }
    } catch (error) {
      console.error("Failed to analyze results:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 border-green-300"
    if (score >= 6) return "bg-yellow-100 border-yellow-300"
    return "bg-red-100 border-red-300"
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 8) return "text-green-800 bg-green-200"
    if (score >= 6) return "text-yellow-800 bg-yellow-200"
    return "text-red-800 bg-red-200"
  }

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatToken = (token: number) => {
    return token.toLocaleString()
  }

  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">测试报告</h1>
      </div>

      <div className="space-y-6">
        {/* 分析控制 */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2 flex-1">
              <div>
                <Label className="text-sm font-medium text-foreground">选择测试结果</Label>
                <Select value={selectedDirectory} onValueChange={setSelectedDirectory} disabled={isAnalyzing}>
                  <SelectTrigger className="w-full md:w-64 disabled:opacity-50">
                    <SelectValue placeholder="选择测试结果" />
                  </SelectTrigger>
                  <SelectContent>
                    {directories.map((dir) => (
                      <SelectItem key={dir} value={dir}>
                        {dir}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loops.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-foreground">测试轮次</Label>
                  <Select value={selectedLoop} onValueChange={setSelectedLoop} disabled={isAnalyzing}>
                    <SelectTrigger className="w-full md:w-40 disabled:opacity-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {loops.map((loop) => (
                        <SelectItem key={loop} value={loop}>
                          第 {loop} 轮
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <Button
              onClick={analyzeResults}
              disabled={isAnalyzing || !selectedDirectory || !selectedLoop}
              className="bg-foreground text-background hover:bg-foreground/90 flex-shrink-0 min-w-[120px]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中
                </>
              ) : (
                "生成测试报告"
              )}
            </Button>
          </div>
        </div>

        {/* 分析结果 */}
        {summaryStats && (
        <>
          <div className="space-y-6">
            {/* 最后一行：总体统计 */}
            {loopResults && (
              <div className="border-b pb-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总分</p>
                    <p className="text-lg font-bold text-blue-600">{loopResults.totalScore}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">平均得分</p>
                    <p className="text-lg font-bold text-primary">{loopResults.averageScore.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总token消耗</p>
                    <p className="text-lg font-bold text-green-600">{formatToken(loopResults.totalTokenUsage)}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">总共耗时</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatDuration(loopResults.results.reduce((sum, r) => sum + r.workDurationUsage + r.scoreDurationUsage, 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loopResults?.results.map((result) => (
              <div key={result.id} className={`border rounded-lg p-4 ${getScoreColor(result.score)}`}>
                {/* 第一行：问题编号和得分 */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">问题 #{result.id}</h3>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreTextColor(result.score)}`}>
                    得分: {result.score}/{result.maxScore}
                  </span>
                </div>

                {/* 第二行：问题内容 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">问题：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.question}</span>
                </div>

                {/* 第三行：标准答案 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">标准答案：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.standardAnswer}</span>
                </div>

                {/* 第四行：模型回答 */}
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground mr-2">模型回答：</span>
                  <span className="text-sm bg-white/50 px-2 py-1 rounded">{result.modelAnswer}</span>
                </div>

                {/* 第五行：性能指标 */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="bg-blue-50 px-3 py-1 rounded">
                    <span className="text-xs text-blue-600 font-medium">问答消耗token：</span>
                    <span className="text-sm ml-1">{formatToken(result.workTokenUsage)}</span>
                  </div>
                  <div className="bg-purple-50 px-3 py-1 rounded">
                    <span className="text-xs text-purple-600 font-medium">问答耗时：</span>
                    <span className="text-sm ml-1">{formatDuration(result.workDurationUsage)}</span>
                  </div>
                  <div className="bg-green-50 px-3 py-1 rounded">
                    <span className="text-xs text-green-600 font-medium">评分消耗token：</span>
                    <span className="text-sm ml-1">{formatToken(result.scoreTokenUsage)}</span>
                  </div>
                  <div className="bg-orange-50 px-3 py-1 rounded">
                    <span className="text-xs text-orange-600 font-medium">评分耗时：</span>
                    <span className="text-sm ml-1">{formatDuration(result.scoreDurationUsage)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
        )}

        {/* 加载状态 */}
        {isAnalyzing && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-lg">正在分析结果数据...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!summaryStats && !isAnalyzing && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">暂无分析数据</p>
              <p className="text-sm text-muted-foreground">请选择测试结果和轮次并点击"开始分析"按钮</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}