// 增量分析引擎 - 基于文件hash追踪变化

import type { RuleAnalysisResult, RuleMatch } from './rule-engine'

interface FileSnapshot {
  filePath: string
  hash: string
  lineCount: number
  lastModified: number
  analysisResult?: RuleAnalysisResult
}

// 文件快照存储（内存）
const fileSnapshots = new Map<string, FileSnapshot>()

// 计算文件内容hash（纯前端实现，避免依赖Node内置模块）
export function computeFileHash(content: string): string {
  let hash = 2166136261
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// 检查文件是否有变化
export function hasFileChanged(filePath: string, currentHash: string, currentModified: number): boolean {
  const snapshot = fileSnapshots.get(filePath)
  if (!snapshot) return true

  // 如果修改时间或hash不同，则认为文件有变化
  return snapshot.hash !== currentHash || snapshot.lastModified !== currentModified
}

// 保存文件快照
export function saveFileSnapshot(
  filePath: string,
  hash: string,
  lineCount: number,
  lastModified: number,
  analysisResult?: RuleAnalysisResult
): void {
  fileSnapshots.set(filePath, {
    filePath,
    hash,
    lineCount,
    lastModified,
    analysisResult,
  })
}

// 获取上一次的分析结果
export function getLastAnalysisResult(filePath: string): RuleAnalysisResult | undefined {
  return fileSnapshots.get(filePath)?.analysisResult
}

export function getFileSnapshot(filePath: string): FileSnapshot | undefined {
  return fileSnapshots.get(filePath)
}

// 清理快照（防止内存泄漏）
export function clearFileSnapshot(filePath: string): void {
  fileSnapshots.delete(filePath)
}

// 清理所有快照
export function clearAllSnapshots(): void {
  fileSnapshots.clear()
}

// 增量分析：仅分析新增的行
export function computeIncrementalMatches(
  newLines: string[],
  oldLines: string[],
  analyzeLines: (lines: string[]) => RuleAnalysisResult
): {
  newMatches: RuleMatch[]
  changedLineIndices: Set<number>
  incrementalResult: RuleAnalysisResult
} {
  const changedLineIndices = new Set<number>()
  const linesToAnalyze: string[] = []

  // 找出新增或变化的行
  const maxOldLength = oldLines.length
  for (let i = 0; i < newLines.length; i++) {
    if (i >= maxOldLength || newLines[i] !== oldLines[i]) {
      changedLineIndices.add(i)
      linesToAnalyze.push(newLines[i])
    }
  }

  // 如果没有变化，返回空结果
  if (linesToAnalyze.length === 0) {
    return {
      newMatches: [],
      changedLineIndices,
      incrementalResult: {
        totalLines: newLines.length,
        matchedLines: 0,
        matches: [],
        aggregatedAlerts: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        categoryStats: {},
        report: '',
      },
    }
  }

  // 仅分析变化的行
  const result = analyzeLines(linesToAnalyze)

  // 调整match的行号为新文件中的实际位置
  const adjustedMatches = result.matches.map((match, idx) => ({
    ...match,
    lineNumber: Array.from(changedLineIndices)[idx] + 1, // 转换回真实行号
  }))

  // 合并新旧分析结果
  const incrementalResult: RuleAnalysisResult = {
    ...result,
    matches: adjustedMatches,
    totalLines: newLines.length,
  }

  return {
    newMatches: adjustedMatches,
    changedLineIndices,
    incrementalResult,
  }
}

// 获取快照统计
export function getSnapshotStats(): {
  snapshotCount: number
  totalSize: number
  averageAnalysisSize: number
} {
  let totalSize = 0
  let totalAnalysisLines = 0

  for (const snapshot of fileSnapshots.values()) {
    totalSize += snapshot.lineCount
    if (snapshot.analysisResult) {
      totalAnalysisLines += snapshot.analysisResult.totalLines
    }
  }

  return {
    snapshotCount: fileSnapshots.size,
    totalSize,
    averageAnalysisSize: fileSnapshots.size > 0 ? Math.round(totalAnalysisLines / fileSnapshots.size) : 0,
  }
}
