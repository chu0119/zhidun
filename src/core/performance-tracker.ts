// 性能指标收集和展示

interface PerformanceMetrics {
  // 分析耗时
  analysisStartTime: number
  analysisEndTime?: number
  analysisDuration?: number

  // Token用量
  promptTokens: number
  completionTokens: number
  totalTokens: number

  // 缓存命中情况
  cacheHits: number
  cacheMisses: number
  cacheHitRate: number

  // 规则匹配
  totalLines: number
  matchedLines: number
  matchedPercentage: number

  // 文件处理
  fileSizeMB: number
  sampledLines: number
  samplingRate: number

  // 内存使用
  peakMemoryMB?: number
  finalMemoryMB?: number
}

export class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    analysisStartTime: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    totalLines: 0,
    matchedLines: 0,
    matchedPercentage: 0,
    fileSizeMB: 0,
    sampledLines: 0,
    samplingRate: 0,
  }

  start(): void {
    this.metrics.analysisStartTime = Date.now()
    // 记录起始内存
    if (global.gc) {
      global.gc()
      const memUsage = process.memoryUsage()
      this.metrics.finalMemoryMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    }
  }

  end(): void {
    this.metrics.analysisEndTime = Date.now()
    this.metrics.analysisDuration = this.metrics.analysisEndTime - this.metrics.analysisStartTime

    // 记录结束内存
    if (global.gc) {
      global.gc()
      const memUsage = process.memoryUsage()
      const finalMem = Math.round(memUsage.heapUsed / 1024 / 1024)
      this.metrics.finalMemoryMB = finalMem
      if (!this.metrics.peakMemoryMB || finalMem > this.metrics.peakMemoryMB) {
        this.metrics.peakMemoryMB = finalMem
      }
    }
  }

  recordTokens(promptTokens: number, completionTokens: number): void {
    this.metrics.promptTokens = promptTokens
    this.metrics.completionTokens = completionTokens
    this.metrics.totalTokens = promptTokens + completionTokens
  }

  recordCacheStats(hits: number, misses: number): void {
    this.metrics.cacheHits = hits
    this.metrics.cacheMisses = misses
    const total = hits + misses
    this.metrics.cacheHitRate = total > 0 ? Math.round((hits / total) * 10000) / 100 : 0
  }

  recordAnalysisStats(totalLines: number, matchedLines: number): void {
    this.metrics.totalLines = totalLines
    this.metrics.matchedLines = matchedLines
    this.metrics.matchedPercentage =
      totalLines > 0 ? Math.round((matchedLines / totalLines) * 10000) / 100 : 0
  }

  recordFileStats(fileSizeMB: number, sampledLines: number, totalLines: number): void {
    this.metrics.fileSizeMB = fileSizeMB
    this.metrics.sampledLines = sampledLines
    this.metrics.samplingRate =
      totalLines > 0 ? Math.round((sampledLines / totalLines) * 10000) / 100 : 0
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // 格式化为易读的字符串
  formatReport(): string {
    const m = this.metrics
    const lines = [
      '═══ 📊 性能指标 ═══',
      `分析耗时: ${m.analysisDuration ? (m.analysisDuration / 1000).toFixed(2) : '-'} 秒`,
      `Token用量: ${m.totalTokens.toLocaleString()} (输入: ${m.promptTokens}, 输出: ${m.completionTokens})`,
      `缓存命中率: ${m.cacheHitRate}% (命中: ${m.cacheHits}, 未命中: ${m.cacheMisses})`,
      `日志行数: ${m.totalLines.toLocaleString()} (匹配: ${m.matchedLines}, 占比: ${m.matchedPercentage}%)`,
      `文件大小: ${m.fileSizeMB.toFixed(2)} MB (采样: ${m.sampledLines} 行, 采样率: ${m.samplingRate}%)`,
    ]

    if (m.peakMemoryMB) {
      lines.push(`内存使用: 峰值 ${m.peakMemoryMB} MB, 最终 ${m.finalMemoryMB} MB`)
    }

    return lines.join('\n')
  }
}

// 全局性能追踪器
export const globalPerformanceTracker = new PerformanceTracker()

// 推荐的性能阈值
export const PERFORMANCE_THRESHOLDS = {
  slowAnalysisDuration: 30000, // 30秒以上为慢分析
  highTokenUsage: 8000, // 8000+ tokens为高用量
  lowCacheHitRate: 20, // 缓存命中率低于20%为低
  slowMemoryGrowth: 500, // 内存增长超过500MB为高
}

// 检查性能指标是否超过阈值
export function checkPerformanceIssues(metrics: PerformanceMetrics): string[] {
  const issues: string[] = []

  if (metrics.analysisDuration && metrics.analysisDuration > PERFORMANCE_THRESHOLDS.slowAnalysisDuration) {
    issues.push(`⚠️ 分析耗时过长: ${(metrics.analysisDuration / 1000).toFixed(2)}s (建议 < 30s)`)
  }

  if (metrics.totalTokens > PERFORMANCE_THRESHOLDS.highTokenUsage) {
    issues.push(`⚠️ Token用量过高: ${metrics.totalTokens} (建议 < 8000)`)
  }

  if (metrics.cacheHitRate < PERFORMANCE_THRESHOLDS.lowCacheHitRate) {
    issues.push(`⚠️ 缓存命中率低: ${metrics.cacheHitRate}% (建议 > 20%)`)
  }

  if (
    metrics.peakMemoryMB &&
    metrics.finalMemoryMB &&
    metrics.peakMemoryMB - metrics.finalMemoryMB > PERFORMANCE_THRESHOLDS.slowMemoryGrowth
  ) {
    issues.push(`⚠️ 内存增长过大: +${metrics.peakMemoryMB - metrics.finalMemoryMB} MB`)
  }

  return issues
}
