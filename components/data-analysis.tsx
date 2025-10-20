"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Play, BarChart3, TrendingUp, Award, Loader2, Square } from "lucide-react"

interface FrameworkStat {
  totalScore: number
  averageScore: number
  questionCount: number
  maxScore: number
  minScore: number
  averageTotalScore: number
  loopCount: number
  allLoopTotalScores: number[]
}

interface AnalysisData {
  frameworkScores?: Record<string, number[]>
  frameworkStats?: Record<string, FrameworkStat>
  isMultiDirectory?: boolean
  directoryResults?: Array<{
    directory: string
    frameworkStats: Record<string, FrameworkStat>
    loopCount: number
  }>
  directories?: string[]
}

export function DataAnalysis() {
  const [directories, setDirectories] = useState<string[]>([])
  const [selectedDirectory, setSelectedDirectory] = useState<string>("全部分析")
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [loopChartData, setLoopChartData] = useState<any[]>([])

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
      }
    } catch (error) {
      console.error("Failed to load directories:", error)
    }
  }

  const analyzeResults = async () => {
    if (isAnalyzing) return

    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          directory: selectedDirectory
        })
      })

      const data = await response.json()
      if (data.success) {
        setAnalysisData(data)
        
        if (data.isMultiDirectory) {
          // 全部分析模式，不需要生成图表数据
          setChartData([])
          setLoopChartData([])
        } else {
          // 单目录分析模式，生成图表数据
          const chartArray = Object.entries(data.frameworkStats || {}).map(([framework, stats]) => {
            const frameworkStats = stats as FrameworkStat
            return {
              framework,
              totalScore: frameworkStats.totalScore,
              averageScore: frameworkStats.averageScore,
              questionCount: frameworkStats.questionCount
            }
          })
          
          setChartData(chartArray)
          
          // 生成循环测试数据
          const loopChartArray = generateLoopChartData(data.frameworkStats || {})
          setLoopChartData(loopChartArray)
        }
      }
    } catch (error) {
      console.error("Failed to analyze results:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const stopAnalysis = () => {
    setIsAnalyzing(false)
  }

  const getTopFrameworks = () => {
    if (!analysisData?.frameworkStats) return []
    
    return Object.entries(analysisData.frameworkStats)
      .sort(([,a], [,b]) => {
        const statA = a as FrameworkStat
        const statB = b as FrameworkStat
        return statB.totalScore - statA.totalScore
      })
      .slice(0, 3)
  }

  // 生成循环测试数据
  const generateLoopChartData = (frameworkStats: Record<string, FrameworkStat>) => {
    const data: any[] = []
    const frameworks = Object.keys(frameworkStats)
    
    if (frameworks.length === 0) return data
    
    // 获取循环次数
    const loopCount = frameworkStats[frameworks[0]].loopCount
    
    for (let i = 0; i < loopCount; i++) {
      const loopData: any = { name: `第${i + 1}轮` }
      
      frameworks.forEach(framework => {
        const stats = frameworkStats[framework]
        if (stats.allLoopTotalScores[i] !== undefined) {
          loopData[framework] = stats.allLoopTotalScores[i]
        }
      })
      
      data.push(loopData)
    }
    
    return data
  }

  // 获取框架颜色
  const getFrameworkColor = (index: number) => {
    const colors = [
      'hsl(var(--primary))',
      'hsl(220, 70%, 50%)',
      'hsl(120, 70%, 50%)',
      'hsl(30, 70%, 50%)',
      'hsl(300, 70%, 50%)',
      'hsl(180, 70%, 50%)',
      'hsl(60, 70%, 50%)',
      'hsl(270, 70%, 50%)',
      'hsl(150, 70%, 50%)',
      'hsl(0, 70%, 50%)'
    ]
    return colors[index % colors.length]
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
            <div className="flex-1">
              <Label className="text-sm font-medium text-foreground">选择运行结果</Label>
              <Select value={selectedDirectory} onValueChange={setSelectedDirectory} disabled={isAnalyzing}>
                <SelectTrigger className="w-full md:w-80 disabled:opacity-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部分析">全部分析</SelectItem>
                  {directories.map((dir) => (
                    <SelectItem key={dir} value={dir}>
                      {dir}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={isAnalyzing ? stopAnalysis : analyzeResults}
              disabled={directories.length === 0}
              className={isAnalyzing 
                ? "bg-red-500 hover:bg-red-600 text-white flex-shrink-0 min-w-[100px]" 
                : "bg-foreground text-background hover:bg-foreground/90 flex-shrink-0 min-w-[100px]"}
            >
              {isAnalyzing ? "停止分析" : "开始分析"}
            </Button>
          </div>
        </div>

        {/* 分析结果 */}
        {analysisData && (
          <>
            {analysisData.isMultiDirectory ? (
              // 全部分析模式 - 显示多个目录的图表
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">全部分析结果</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    共 {analysisData.directoryResults?.length || 0} 次运行结果，按时间倒序排列
                  </p>
                </div>
                
                {analysisData.directoryResults?.map((dirResult, dirIndex) => (
                  <Card key={dirResult.directory}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>运行结果: {dirResult.directory}</span>
                        <span className="text-sm text-muted-foreground">
                          ({dirResult.loopCount}次循环)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={Object.entries(dirResult.frameworkStats).map(([framework, stats]) => ({
                              framework,
                              totalScore: stats.totalScore,
                              averageScore: stats.averageScore
                            }))} 
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="framework" 
                              angle={-45}
                              textAnchor="end"
                              height={100}
                              interval={0}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: number, name: string) => [
                                `${value} 分`,
                                name === 'totalScore' ? '平均总分（每轮循环）' : '平均分（每个问题）'
                              ]}
                              labelFormatter={(label) => `框架: ${label}`}
                            />
                            <Bar dataKey="totalScore" fill={getFrameworkColor(dirIndex)} name="totalScore" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* 该目录的排行榜 */}
                      <div className="mt-6 space-y-3">
                        <h4 className="font-medium text-sm">框架表现排名</h4>
                        {Object.entries(dirResult.frameworkStats)
                          .sort(([,a], [,b]) => b.totalScore - a.totalScore)
                          .slice(0, 3)
                          .map(([framework, stats], index) => (
                            <div key={framework} className="flex items-center justify-between p-2 bg-muted/10 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0 ? 'bg-yellow-500 text-yellow-900' :
                                  index === 1 ? 'bg-gray-400 text-gray-900' :
                                  index === 2 ? 'bg-amber-600 text-amber-900' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {index + 1}
                                </div>
                                <span>{framework}</span>
                              </div>
                              <span>{stats.totalScore}分</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              // 单目录分析模式 - 显示原有的图表
              <>
                {/* 排行榜 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      框架排行榜
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getTopFrameworks().map(([framework, stats], index) => (
                        <div key={framework} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-500 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              index === 2 ? 'bg-amber-600 text-amber-900' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{framework}</p>
                              <p className="text-sm text-muted-foreground">
                                问题总数: {stats.questionCount} · 循环次数: {stats.loopCount} · 总得分: {stats.allLoopTotalScores.reduce((sum, score) => sum + score, 0).toFixed(0)} · 平均分: {stats.averageScore.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{stats.totalScore}</p>
                            <p className="text-xs text-muted-foreground">平均每轮得分</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 柱状图 */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      框架平均得分对比({Object.values(analysisData.frameworkStats || {})[0]?.loopCount || 0}次循环)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="framework" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            interval={0}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              `${value} 分`,
                              name === 'totalScore' ? '平均总分（每轮循环）' : '平均分（每个问题）'
                            ]}
                            labelFormatter={(label) => `框架: ${label}`}
                          />
                          <Bar dataKey="totalScore" fill="hsl(var(--primary))" name="totalScore" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* 每次测试得分对比 */}
                <Card>
                  <CardHeader>
                    <CardTitle>每次测试各框架得分情况</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={loopChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            interval={0}
                          />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {Object.keys(analysisData?.frameworkStats || {}).map((framework, index) => (
                            <Bar 
                              key={framework} 
                              dataKey={framework} 
                              fill={getFrameworkColor(index)}
                              name={framework}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
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
        {!analysisData && !isAnalyzing && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">暂无分析数据</p>
              <p className="text-sm text-muted-foreground">请选择运行结果并点击"开始分析"按钮</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
