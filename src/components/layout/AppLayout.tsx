// 主布局框架 - Sidebar + Tab 导航

import React, { useState, useCallback, useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { AnalysisPanel } from '../panels/AnalysisPanel'
import { ReportPanel } from '../panels/ReportPanel'
import { ChartsPanel } from '../panels/ChartsPanel'
import { PathAnalysisPanel } from '../panels/PathAnalysisPanel'
import { GeoPanel } from '../panels/GeoPanel'
import { ThreatPanel } from '../panels/ThreatPanel'
import { AttackPanel } from '../panels/AttackPanel'
import { AttackSessionPanel } from '../panels/AttackSessionPanel'
import { RealtimePanel } from '../panels/RealtimePanel'
import { SettingsDialog } from '../dialogs/SettingsDialog'
import { HistoryDialog } from '../dialogs/HistoryDialog'
import { UpdateDialog } from '../dialogs/UpdateDialog'
import { PreprocessDialog } from '../dialogs/PreprocessDialog'
import { preprocessLines, DEFAULT_PREPROCESS_CONFIG } from '@/core/preprocessor'
import { NotificationSettings } from '../dialogs/NotificationSettings'
import { processAlerts, getDefaultNotificationConfig } from '@/core/notification-engine'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useConfigStore } from '@/stores/config-store'
import { useHistoryStore } from '@/stores/history-store'
import { useAppStore } from '@/stores/app-store'
import { createAIProvider } from '@/ai-providers'
import { LogAnalyzer, estimateTokens } from '@/core/analyzer'
import { LogParser } from '@/core/log-parser'
import { compressLogForAI, smartSample } from '@/core/log-processor'
import { exportToDocx, exportToPdf } from '@/core/report-generator'
import { deduplicateMatches } from '@/core/rule-engine'
import type { RuleMatch, RuleAnalysisResult } from '@/core/rule-engine'
import { extractIPsFromLines, lookupIPs } from '@/core/geoip'
import { detectBots } from '@/core/bot-detector'

// Worker 引用（用于取消）
let analysisWorker: Worker | null = null
import { useQueueStore, QueueItem } from '@/stores/queue-store'
import { useRulesStore } from '@/stores/rules-store'
import type { Rule } from '@/core/rule-engine'
import {
  showPhase1, showPhase2, showPhase3Pre, showPhase3Post, showPhase4,
  showLocalAnalysisPhase1, showLocalAnalysisPhase2, showLocalAnalysisPhase3, showLocalAnalysisPhase4,
} from '@/core/demo-messages'
import { useAlertHistoryStore } from '@/stores/alert-history-store'
import { AlertHistoryDialog } from '@/components/dialogs/AlertHistoryDialog'
import { initSoundListener } from '@/utils/audio'
import type { AnalysisSnapshot } from '@/types/analysis'
import type { GeoIPResult } from '@/core/geoip'

type TabKey = 'ai-analysis' | 'ai-report' | 'local-analysis' | 'local-report' | 'threat' | 'attack' | 'session' | 'charts' | 'path' | 'geo' | 'realtime'

// 构建分析快照（用于保存到历史记录）
function buildSnapshot(store: ReturnType<typeof useAnalysisStore.getState>, geoResults: Map<string, GeoIPResult> | null): AnalysisSnapshot {
  const ruleResult = store.localRuleResult
  return {
    localRuleResult: ruleResult ? {
      totalLines: ruleResult.totalLines,
      matchedLines: ruleResult.matchedLines,
      matches: ruleResult.matches.map(m => ({
        rule: { id: m.rule.id, name: m.rule.name, category: m.rule.category, severity: m.rule.severity, description: m.rule.description, remediation: m.rule.remediation, mitre: m.rule.mitre, cwe: m.rule.cwe },
        line: m.line,
        lineNumber: m.lineNumber,
        matchedText: m.matchedText,
      })),
      aggregatedAlerts: ruleResult.aggregatedAlerts.map(a => ({
        rule: { id: a.rule.id, name: a.rule.name, category: a.rule.category, severity: a.rule.severity, description: a.rule.description, remediation: a.rule.remediation, mitre: a.rule.mitre, cwe: a.rule.cwe },
        sourceIP: a.sourceIP,
        count: a.count,
        lineNumbers: a.lineNumbers,
        firstSeen: a.firstSeen,
        lastSeen: a.lastSeen,
        sampleLine: a.sampleLine,
      })),
      summary: ruleResult.summary,
      categoryStats: ruleResult.categoryStats,
      report: ruleResult.report,
    } : null,
    localReportText: store.localReportText,
    aiReportText: store.reportText,
    botStats: (store.botStats || []).map(b => ({ category: b.category, name: b.name, count: b.count, sampleUA: b.sampleUA })),
    geoIPResults: geoResults ? Object.fromEntries(geoResults) : {},
    preprocessResult: store.preprocessResult,
    logLines: store.logLines,
    savedAt: new Date().toISOString(),
  }
}

// 流式扫描报告生成（大文件专用）
function generateStreamingReport(
  totalLines: number,
  matchedLines: number,
  totalMatches: number,
  summary: { critical: number; high: number; medium: number; low: number; info: number },
  categoryStats: Record<string, number>,
  aggregatedAlerts: any[]
): string {
  const now = new Date().toLocaleString('zh-CN')
  const totalThreats = summary.critical + summary.high + summary.medium + summary.low + summary.info

  let report = `【安全分析报告 - 本地规则引擎】\n\n`
  report += `1. 事件概述\n`
  report += `   • 检测时间：${now}\n`
  report += `   • 分析方式：本地规则引擎（流式全量扫描）\n`
  report += `   • 扫描行数：${totalLines.toLocaleString()}\n`
  report += `   • 告警总数：${totalMatches.toLocaleString()}\n`
  report += `   • 命中行数：${matchedLines.toLocaleString()}\n`
  report += `   • 置信度：${totalThreats > 0 ? '95%' : 'N/A'}\n\n`

  report += `2. 技术分析\n`
  if (aggregatedAlerts.length > 0) {
    report += `   • 检测到 ${Object.keys(categoryStats).length} 个攻击类别\n`
    report += `   • 共 ${aggregatedAlerts.length} 种独立攻击模式\n`
    const sorted = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])
    for (const [cat, count] of sorted) {
      report += `   • ${cat}：${count} 次告警\n`
    }
  } else {
    report += `   • 未检测到明显攻击特征\n`
  }

  report += `\n3. 风险评估\n`
  report += `   • 严重：${summary.critical}\n`
  report += `   • 高危：${summary.high}\n`
  report += `   • 中危：${summary.medium}\n`
  report += `   • 低危：${summary.low}\n\n`

  report += `4. 处置建议\n`
  if (totalThreats > 0) {
    report += `   • 立即封禁攻击源 IP\n`
    report += `   • 检查被攻击路径是否存在漏洞\n`
    report += `   • 加强 WAF 规则配置\n`
    report += `   • 审查服务器日志和文件完整性\n`
  } else {
    report += `   • 当前日志未发现明显安全威胁\n`
    report += `   • 建议定期进行安全扫描\n`
  }

  return report
}

// 在 Worker 中运行规则引擎分析（避免阻塞渲染线程）
function runAnalysisInWorker(
  lines: string[],
  rules: Rule[],
  onProgress: (msg: string) => void,
): { promise: Promise<{ result: RuleAnalysisResult; botStats: import('@/core/bot-detector').BotStat[]; ips: string[] }>; cancel: () => void } {
  // 终止之前的 Worker
  if (analysisWorker) {
    analysisWorker.terminate()
    analysisWorker = null
  }

  const worker = new Worker(new URL('../../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
  analysisWorker = worker

  // 序列化规则（RegExp → {source, flags}）
  const serializableRules = rules.map(r => ({
    ...r,
    patterns: r.patterns.map(p => ({ source: p.source, flags: p.flags })),
  }))

  const promise = new Promise<{ result: RuleAnalysisResult; botStats: import('@/core/bot-detector').BotStat[]; ips: string[] }>((resolve, reject) => {
    worker.onmessage = (e) => {
      const data = e.data
      if (data.type === 'progress') {
        onProgress(data.message)
      } else if (data.type === 'result') {
        worker.terminate()
        analysisWorker = null
        resolve({ result: data.result, botStats: data.botStats, ips: data.ips })
      } else if (data.type === 'error') {
        worker.terminate()
        analysisWorker = null
        reject(new Error(data.error))
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      analysisWorker = null
      reject(new Error(err.message || 'Worker 错误'))
    }

    worker.postMessage({ type: 'analyze', lines, rules: serializableRules })
  })

  return {
    promise,
    cancel: () => {
      worker.postMessage({ type: 'cancel' })
      setTimeout(() => {
        worker.terminate()
        analysisWorker = null
      }, 100)
    },
  }
}

export function AppLayout() {
  const [activeTab, setActiveTab] = useState<TabKey>('local-analysis')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [showPreprocess, setShowPreprocess] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [showAlertHistory, setShowAlertHistory] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const dragCounterRef = React.useRef(0)

  const { config, updateConfig } = useConfigStore()
  const { addRecord } = useHistoryStore()
  const status = useAnalysisStore(s => s.status)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const unacknowledgedCount = useAlertHistoryStore(s => s.alerts.filter(a => a.state === 'new').length)

  // 稳定的 store 访问（避免在 useCallback 依赖中使用 store 对象）
  const getStore = useAnalysisStore.getState

  // 加载自定义规则
  useEffect(() => {
    const { loadRules } = useRulesStore.getState()
    loadRules()
  }, [])

  // 加载历史记录
  useEffect(() => {
    const { loadHistory } = useHistoryStore.getState()
    loadHistory()
  }, [])

  // 加载告警历史 & 初始化音效监听
  useEffect(() => {
    useAlertHistoryStore.getState().loadAlerts()
    initSoundListener()
  }, [])

  // 转换自定义规则为规则引擎格式
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const getCustomRules = useCallback((): Rule[] => {
    const { rules } = useRulesStore.getState()
    return rules.filter(r => r.enabled).map(cr => ({
      id: cr.id,
      name: cr.name,
      category: cr.category,
      severity: cr.severity,
      description: cr.description,
      patterns: cr.patterns.map(p => { try { return new RegExp(p, 'gi') } catch { return new RegExp(escapeRegex(p), 'gi') } }),
      remediation: '',
    }))
  }, [])

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ===== 本地预处理（规则匹配 + 数据清洗） =====
  const handlePreprocess = useCallback(async () => {
    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const [fullPath, displayName] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('local-analysis')
    getStore().setPreprocessStatus('preparing')
    getStore().startLocalTimer()
    // 清除上次分析的 GeoIP 结果，避免切换文件后显示旧数据
    getStore().setGeoIPResults(null)

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addLocalProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().preprocessStatus

    try {
      await showLocalAnalysisPhase1(progressStore, getStatus)

      // 根据文件大小选择读取策略
      const LARGE_THRESHOLD = 100 * 1024 * 1024 // 100MB
      const fileInfo = await window.electronAPI.getFileInfo(fullPath)
      const fileSize = fileInfo.success && fileInfo.info ? fileInfo.info.size : 0

      let allLines: string[]
      let fileEncoding = 'utf-8'
      let fileTotalLines = 0

      if (fileSize > LARGE_THRESHOLD) {
        // ═══ 大文件：流式全量扫描 ═══
        getStore().addLocalProgress(`[读取] 大文件模式 (${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB)，启动流式全量扫描...`)

        // 注册进度监听
        const removeProgress = window.electronAPI.onStreamProgress((data) => {
          getStore().addLocalProgress(`[扫描] 已扫描 ${(data.linesScanned / 1000000).toFixed(1)}M 行，发现 ${data.matchesFound} 条告警...`)
        })

        // 获取内置规则 + 自定义规则
        const { BUILT_IN_RULES: builtInRules } = await import('@/core/rule-engine')
        const customRules = getCustomRules()
        const allRules = [...builtInRules, ...customRules]
        const ruleDefs = allRules.map(r => ({
          id: r.id,
          name: r.name,
          category: r.category,
          severity: r.severity,
          patterns: r.patterns.map(p => p.toString()),
          description: r.description,
          remediation: r.remediation,
        }))

        getStore().setPreprocessStatus('analyzing')
        let streamResult: any
        try {
          streamResult = await window.electronAPI.streamAnalyze(fullPath, ruleDefs)
        } finally {
          removeProgress()
        }

        if (!streamResult.success) throw new Error(`流式扫描失败: ${streamResult.error}`)

        fileTotalLines = streamResult.totalLines
        fileEncoding = 'utf-8'

        // 转换为 RuleAnalysisResult 格式
        const ruleMap = new Map(builtInRules.map(r => [r.id, r]))

        const ruleMatches: RuleMatch[] = streamResult.matches.map((m: any) => ({
          rule: ruleMap.get(m.ruleId) || allRules.find(r => r.id === m.ruleId) || {
            id: m.ruleId, name: m.ruleName, category: m.category,
            severity: m.severity as any, patterns: [], description: m.description, remediation: m.remediation,
          },
          line: m.line,
          lineNumber: m.lineNumber,
          matchedText: m.matchedText,
        }))

        const aggregatedAlerts = deduplicateMatches(ruleMatches)

        const result: RuleAnalysisResult = {
          totalLines: fileTotalLines,
          matchedLines: streamResult.matchedLines,
          matches: ruleMatches,
          aggregatedAlerts,
          summary: streamResult.summary,
          categoryStats: streamResult.categoryStats,
          report: generateStreamingReport(fileTotalLines, streamResult.matchedLines, streamResult.matches.length, streamResult.summary, streamResult.categoryStats, aggregatedAlerts),
        }

        const elapsed = useAnalysisStore.getState().localElapsedTime
        await showLocalAnalysisPhase4(progressStore, result.matches.length, formatElapsed(elapsed), getStatus)

        const suspiciousLines = result.matches.map(m => m.line)
        const matchedCategories = [...new Set(result.matches.map(m => m.rule.category))]

        getStore().setLocalReportText(result.report)
        getStore().setLocalRuleResult(result)
        getStore().setPreprocessResult({
          totalLines: fileTotalLines,
          suspiciousLines: suspiciousLines.length,
          suspiciousContent: suspiciousLines,
          matchedCategories,
        })
        getStore().setPreprocessStatus('done')

        setActiveTab('local-report')

        const botStats = detectBots(suspiciousLines)
        getStore().setBotStats(botStats)

        // GeoIP 查询完成后保存快照
        const ips = extractIPsFromLines(suspiciousLines)
        const geoPromise = ips.length > 0 ? lookupIPs(ips).catch(() => null) : Promise.resolve(null)
        geoPromise.then(geoResults => {
          if (geoResults) getStore().setGeoIPResults(geoResults)
          const snapshot = buildSnapshot(getStore(), geoResults)
          addRecord({
            filePath: fullPath,
            fileName: displayName || 'unknown',
            fileSize: fileSize,
            linesAnalyzed: fileTotalLines,
            modelProvider: 'local',
            modelName: '本地规则引擎（流式全量）',
            analysisTime: elapsed,
            hasReport: true,
            reportText: result.report,
            notes: '',
          }, snapshot)
        })

        return // 大文件分支到此结束

      } else {
        // ═══ 小文件：一次性读取 ═══
        const fileResult = await window.electronAPI.readTextFile(fullPath)
        if (!fileResult.success) throw new Error(`读取文件失败: ${fileResult.error}`)
        const fileText = fileResult.text || ''
        allLines = fileText.split('\n').filter((l: string) => l.trim())
        fileEncoding = fileResult.encoding || 'utf-8'
        fileTotalLines = allLines.length
      }

      const preprocessCfg = useConfigStore.getState().config.preprocessConfig
      if (preprocessCfg?.enabled) {
        const { filtered, stats } = preprocessLines(allLines, preprocessCfg)
        getStore().addLocalProgress(`[预处理] 过滤 ${stats.filtered} 行，保留 ${stats.passed} 行`)
        allLines = filtered
      }

      getStore().setLogLines(allLines)

      const parser = new LogParser(fullPath)
      const formatType = parser.detectFormat(allLines)

      await showLocalAnalysisPhase2(progressStore, {
        format: formatType,
        encoding: fileEncoding,
        sizeMB: (fileSize / (1024 * 1024)).toFixed(2),
        totalLines: fileTotalLines,
      }, getStatus)

      getStore().setPreprocessStatus('analyzing')
      await showLocalAnalysisPhase3(progressStore, allLines.length, getStatus)

      // 尝试在 Worker 中运行规则引擎（不阻塞 UI）
      let result: RuleAnalysisResult
      let botStats: import('@/core/bot-detector').BotStat[]
      let ips: string[]

      try {
        const { promise: workerPromise } = runAnalysisInWorker(
          allLines,
          getCustomRules(),
          (msg) => getStore().addLocalProgress(msg),
        )
        const workerResult = await workerPromise
        result = workerResult.result
        botStats = workerResult.botStats
        ips = workerResult.ips
      } catch {
        // Worker 失败时回退到主线程同步分析
        getStore().addLocalProgress('[回退] Worker 不可用，使用主线程分析...')
        const { analyzeWithRules } = await import('@/core/rule-engine')
        result = analyzeWithRules(allLines, (msg) => getStore().addLocalProgress(msg), getCustomRules())
        const suspiciousLines = result.matches.map(m => m.line)
        const { detectBots } = await import('@/core/bot-detector')
        botStats = detectBots(suspiciousLines)
        const { extractIPsFromLines } = await import('@/core/geoip')
        ips = extractIPsFromLines(suspiciousLines)
      }

      // 检查是否已被停止
      if (useAnalysisStore.getState().preprocessStatus === 'stopped') return

      const elapsed = useAnalysisStore.getState().localElapsedTime
      await showLocalAnalysisPhase4(progressStore, result.matches.length, formatElapsed(elapsed), getStatus)

      // 提取可疑行（匹配到规则的日志行）
      const suspiciousLines = result.matches.map(m => m.line)
      const matchedCategories = [...new Set(result.matches.map(m => m.rule.category))]

      getStore().setLocalReportText(result.report)
      getStore().setLocalRuleResult(result)
      getStore().setPreprocessResult({
        totalLines: fileTotalLines,
        suspiciousLines: suspiciousLines.length,
        suspiciousContent: suspiciousLines,
        matchedCategories,
      })
      getStore().setPreprocessStatus('done')

      setActiveTab('local-report')

      getStore().setBotStats(botStats)

      // GeoIP 查询完成后保存快照
      const geoPromise = ips.length > 0 ? lookupIPs(ips).catch(() => null) : Promise.resolve(null)
      geoPromise.then(geoResults => {
        if (geoResults) getStore().setGeoIPResults(geoResults)
        const snapshot = buildSnapshot(getStore(), geoResults)
        addRecord({
          filePath: fullPath,
          fileName: displayName || 'unknown',
          fileSize: fileSize,
          linesAnalyzed: allLines.length,
          modelProvider: 'local',
          modelName: '本地预处理',
          analysisTime: elapsed,
          hasReport: true,
          reportText: result.report,
          notes: '',
        }, snapshot)
      })

      // 异步告警通知
      const notifConfig = useConfigStore.getState().config.notificationConfig
      if (notifConfig?.enabled) {
        processAlerts(notifConfig, result.categoryStats, result.summary, displayName).catch(() => {})
      }
    } catch (error: any) {
      getStore().setPreprocessStatus('error')
      getStore().setError(error.message)
      getStore().addLocalProgress(`错误: ${error.message}`)
    } finally {
      getStore().stopLocalTimer()
    }
  }, [])

  // 注册本地分析触发器（供空状态按钮使用）
  useEffect(() => {
    useAppStore.getState().setLocalAnalysisTrigger(handlePreprocess)
    return () => useAppStore.getState().setLocalAnalysisTrigger(null)
  }, [handlePreprocess])

  // ===== AI 深度分析（基于预处理结果） =====
  const handleAIAnalysis = useCallback(async () => {
    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const preprocessResult = useAnalysisStore.getState().preprocessResult
    const logLines = useAnalysisStore.getState().logLines

    const [fullPath, displayName] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('ai-analysis')
    getStore().setStatus('preparing')
    getStore().setError(null)
    getStore().startTimer()

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().status

    try {
      await showPhase1(progressStore, config.currentModel.modelName, getStatus)

      progressStore.addProgress('')
      progressStore.addProgress('[准备] 基于本地预处理结果构建 AI 分析输入...')

      const parser = new LogParser(fullPath)
      const formatType = parser.detectFormat(logLines)

      // 策略：发送本地分析报告 + 少量可疑日志样本，不发全量日志
      const MAX_TOTAL_TOKENS = 20000
      const MAX_LOG_TOKENS = 10000

      // 构建本地分析摘要
      const localRuleResult = useAnalysisStore.getState().localRuleResult
      const localReport = useAnalysisStore.getState().localReportText
      let analysisSummary = ''

      if (localRuleResult) {
        const { summary, categoryStats, aggregatedAlerts, totalLines, matchedLines } = localRuleResult
        analysisSummary = [
          `[本地规则分析结果]`,
          `- 扫描总行数: ${totalLines}`,
          `- 命中规则行数: ${matchedLines}`,
          `- 命中率: ${totalLines > 0 ? ((matchedLines / totalLines) * 100).toFixed(2) : '0.00'}%`,
          `- 风险分布: 严重 ${summary.critical}, 高危 ${summary.high}, 中危 ${summary.medium}, 低危 ${summary.low}, 信息 ${summary.info}`,
          `- 攻击类别统计: ${Object.entries(categoryStats).map(([k, v]) => `${k}(${v})`).join(', ')}`,
          ``,
          `[Top 威胁 IP 聚合]`,
          ...aggregatedAlerts
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
            .map(a => `- ${a.sourceIP}: ${a.rule.name} x${a.count}次, ${a.rule.category}, ${a.rule.severity}`),
        ].join('\n')
        progressStore.addProgress(`[摘要] 本地分析: ${matchedLines} 条命中, ${Object.keys(categoryStats).length} 个攻击类别, ${aggregatedAlerts.length} 个 IP 聚合`)
      }

      // 挑选最有价值的可疑日志样本（每个攻击类别取 top 3）
      let sampleLines: string[] = []
      if (localRuleResult && localRuleResult.matches.length > 0) {
        const seen = new Set<string>()
        const byCategory: Record<string, typeof localRuleResult.matches> = {}
        for (const m of localRuleResult.matches) {
          const cat = m.rule.category
          if (!byCategory[cat]) byCategory[cat] = []
          byCategory[cat].push(m)
        }
        // 每个类别取最多 3 条不同的样本
        for (const [cat, matches] of Object.entries(byCategory)) {
          let count = 0
          for (const m of matches) {
            if (count >= 3) break
            if (!seen.has(m.line)) {
              seen.add(m.line)
              sampleLines.push(m.line)
              count++
            }
          }
        }
        progressStore.addProgress(`[样本] 从 ${localRuleResult.matches.length} 条命中中挑选 ${sampleLines.length} 条代表性样本`)
      } else if (preprocessResult && preprocessResult.suspiciousContent.length > 0) {
        // 没有 ruleResult 但有可疑行，取前 30 条
        sampleLines = preprocessResult.suspiciousContent.slice(0, 30)
        progressStore.addProgress(`[样本] 使用前 ${sampleLines.length} 条可疑行`)
      } else {
        // 没有预处理结果，用 smartSample 从全部日志中采样
        sampleLines = smartSample(logLines, 50, MAX_LOG_TOKENS)
        progressStore.addProgress(`[样本] 从 ${logLines.length} 行中智能采样 ${sampleLines.length} 行`)
      }

      // 压缩样本日志并检查 token
      const logContent = compressLogForAI(sampleLines, formatType)
      const logTokens = estimateTokens(logContent)
      const summaryTokens = estimateTokens(analysisSummary)
      const totalTokens = summaryTokens + logTokens
      progressStore.addProgress(`[Token] 摘要: ~${summaryTokens.toLocaleString()}, 日志样本: ~${logTokens.toLocaleString()}, 总计: ~${totalTokens.toLocaleString()}`)

      // 如果日志样本仍然太长，进一步截断
      if (logTokens > MAX_LOG_TOKENS) {
        sampleLines = smartSample(sampleLines, 20, MAX_LOG_TOKENS)
        progressStore.addProgress(`[压缩] 日志样本压缩至 ${sampleLines.length} 行`)
      }

      const totalLines = logLines.length
      const sampledLines = sampleLines.length

      getStore().setMetadata({
        formatType,
        encoding: 'utf-8',
        totalLines,
        sampledLines,
      })

      await showPhase2(progressStore, {
        format: formatType,
        encoding: 'utf-8',
        sizeMB: '0',
        totalLines,
        sampledLines,
        tokens: 0,
      }, getStatus)

      await showPhase3Pre(progressStore, config.currentModel.modelName, getStatus)

      getStore().setStatus('analyzing')

      const provider = createAIProvider({
        provider: config.currentModel.provider,
        modelName: config.currentModel.modelName,
        apiKey: config.currentModel.apiKey,
        baseUrl: config.currentModel.baseUrl,
        temperature: config.currentModel.temperature,
        maxTokens: config.currentModel.maxTokens,
        timeout: 600,
      })

      const analyzer = new LogAnalyzer(provider, undefined, (msg) => progressStore.addProgress(msg))
      getStore().setAbortController(analyzer['abortController'] || null)

      const origStop = analyzer.stop.bind(analyzer)
      analyzer.stop = () => {
        origStop()
        getStore().setAbortController(null)
      }

      // 构建最终日志内容（压缩后的样本）
      const finalLogContent = compressLogForAI(sampleLines, formatType)

      // 将本地分析摘要 + 日志样本合并为 AI 输入
      const fullContent = analysisSummary
        ? `${analysisSummary}\n\n[可疑日志样本 (${sampleLines.length} 条)]\n${finalLogContent}`
        : finalLogContent

      const preprocessSummary = preprocessResult ? {
        totalLines: preprocessResult.totalLines,
        suspiciousLines: preprocessResult.suspiciousLines,
        matchedCategories: preprocessResult.matchedCategories,
      } : undefined

      const report = await analyzer.analyze(fullContent, {
        formatType,
        encoding: 'utf-8',
        totalLines,
        sampledLines,
      }, preprocessSummary)

      if (report) {
        await showPhase3Post(progressStore, Math.round(report.length / 1024), getStatus)

        const elapsed = useAnalysisStore.getState().elapsedTime
        await showPhase4(progressStore, formatElapsed(elapsed), getStatus)

        getStore().setReportText(report)
        getStore().setStatus('done')
        getStore().setAbortController(null)

        setActiveTab('ai-report')

        // AI 分析快照（保存当前所有本地分析数据 + AI 报告）
        const aiSnapshot: AnalysisSnapshot = {
          ...buildSnapshot(getStore(), getStore().geoIPResults),
          aiReportText: report,
        }
        addRecord({
          filePath: fullPath,
          fileName: displayName || 'unknown',
          fileSize: 0,
          linesAnalyzed: sampledLines,
          modelProvider: config.currentModel.provider,
          modelName: config.currentModel.modelName,
          analysisTime: elapsed,
          hasReport: true,
          reportText: report,
          notes: '',
        }, aiSnapshot)
      } else {
        progressStore.addProgress('')
        progressStore.addProgress('[错误] AI 未返回有效分析结果')
        progressStore.addProgress('[提示] 可能原因：模型不支持当前日志内容、API 连接超时、或模型返回了空响应')
        progressStore.addProgress(`[提示] 当前模型: ${config.currentModel.provider} / ${config.currentModel.modelName}`)
        progressStore.addProgress(`[提示] API 地址: ${config.currentModel.baseUrl || '(默认)'}`)
        getStore().setStatus('error')
        getStore().setError('AI 未返回有效分析结果，请检查模型配置和连接状态')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        progressStore.addProgress('分析已被用户停止')
        getStore().setStatus('stopped')
      } else {
        progressStore.addProgress('')
        progressStore.addProgress(`[错误] AI 分析失败: ${error.message || error}`)
        progressStore.addProgress(`[提示] 当前模型: ${config.currentModel.provider} / ${config.currentModel.modelName}`)
        progressStore.addProgress(`[提示] API 地址: ${config.currentModel.baseUrl || '(默认)'}`)
        progressStore.addProgress('[提示] 请检查：1) 模型服务是否运行中 2) API 地址是否正确 3) 模型名称是否正确')
        getStore().setStatus('error')
        getStore().setError(error.message)
      }
    } finally {
      getStore().stopTimer()
      getStore().setAbortController(null)
    }
  }, [config])

  // ===== 统一停止分析 =====
  const handleStop = useCallback(() => {
    const { abortController, status, preprocessStatus } = useAnalysisStore.getState()
    // 停止 AI 分析
    if (status === 'preparing' || status === 'analyzing') {
      getStore().setStatus('stopped')
      getStore().stopTimer()
      if (abortController) {
        abortController.abort()
        getStore().setAbortController(null)
      }
    }
    // 停止预处理
    if (preprocessStatus === 'preparing' || preprocessStatus === 'analyzing') {
      getStore().setPreprocessStatus('stopped')
      getStore().stopLocalTimer()
      // 终止 Worker
      if (analysisWorker) {
        analysisWorker.terminate()
        analysisWorker = null
      }
    }
  }, [])

  const handleExportReport = useCallback(async (format: 'docx' | 'pdf') => {
    const { reportText, localReportText, currentFile } = useAnalysisStore.getState()
    const text = reportText || localReportText
    if (!text) return

    try {
      if (format === 'pdf') {
        await exportToPdf(text, currentFile || 'report')
      } else {
        await exportToDocx(text, currentFile || 'report')
      }
      getStore().addProgress(`报告已导出为 ${format.toUpperCase()} 格式`)
    } catch (error: any) {
      getStore().addProgress(`导出失败: ${error.message}`)
    }
  }, [])

  // ===== 批量分析 =====
  const handleStartBatch = useCallback(async () => {
    const queueStore = useQueueStore.getState()
    queueStore.startAnalysis()

    const processItem = async (item: QueueItem) => {
      useQueueStore.getState().updateItem(item.id, {
        status: 'analyzing',
        progress: '正在读取文件...',
        startTime: Date.now(),
      })

      try {
        const fileResult = await window.electronAPI.readTextFile(item.filePath)
        if (!fileResult.success) throw new Error(fileResult.error)

        const fileText = fileResult.text || ''
        const allLines = fileText.split('\n').filter((l: string) => l.trim())

        useQueueStore.getState().updateItem(item.id, { progress: `正在分析 ${allLines.length} 行...` })

        const { promise } = runAnalysisInWorker(allLines, getCustomRules(), () => {})
        const { result } = await promise
        useQueueStore.getState().markDone(item.id, result, result.report)
      } catch (error: any) {
        useQueueStore.getState().markError(item.id, error.message)
      }
    }

    const mode = queueStore.mode
    if (mode === 'serial') {
      let next = useQueueStore.getState().getNextPending()
      while (next && useQueueStore.getState().isRunning) {
        await processItem(next)
        next = useQueueStore.getState().getNextPending()
      }
    } else {
      const pending = useQueueStore.getState().items.filter(i => i.status === 'pending')
      const chunks: QueueItem[][] = [[], [], []]
      pending.forEach((item, i) => chunks[i % 3].push(item))
      await Promise.all(
        chunks.map(async (chunk) => {
          for (const item of chunk) {
            if (!useQueueStore.getState().isRunning) break
            await processItem(item)
          }
        })
      )
    }

    useQueueStore.getState().stopAnalysis()
  }, [])

  const handleStopBatch = useCallback(() => {
    useQueueStore.getState().stopAnalysis()
  }, [])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[data-file-select]')?.click()
      }
      if (e.key === 'Escape') {
        handleStop()
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        setShowHistory(true)
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleStop])

  // 全局拖放事件处理
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true)
      }
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) setIsDraggingFile(false)
    }
    const handleDragOver = (e: DragEvent) => e.preventDefault()
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDraggingFile(false)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  // 菜单动作处理
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuAction((action: string) => {
      // Tab 切换
      if (action.startsWith('tab-')) {
        const tabKey = action.replace('tab-', '') as TabKey
        setActiveTab(tabKey)
        return
      }
      switch (action) {
        case 'open-file':
          document.querySelector<HTMLButtonElement>('[data-file-select]')?.click()
          break
        case 'export-pdf':
          handleExportReport('pdf')
          break
        case 'export-docx':
          handleExportReport('docx')
          break
        case 'open-settings':
          setShowSettings(true)
          break
        case 'open-history':
          setShowHistory(true)
          break
        case 'start-local-analysis': {
          const s = useAnalysisStore.getState()
          if (s.preprocessStatus === 'idle' && s.currentFile) handlePreprocess()
          break
        }
        case 'start-ai-analysis': {
          const s = useAnalysisStore.getState()
          if (s.preprocessStatus === 'done' && s.status === 'idle' && s.currentFile) handleAIAnalysis()
          break
        }
        case 'stop-analysis':
          handleStop()
          break
        case 'clear-output':
          useAnalysisStore.getState().clearAll()
          break
        case 'check-update':
          setShowUpdate(true)
          break
        case 'about':
          setShowUpdate(true)
          break
        case 'preprocess':
          setShowPreprocess(true)
          break
        case 'notification':
          setShowNotification(true)
          break
      }
    })
    return cleanup
  }, [handlePreprocess, handleAIAnalysis, handleStop, handleExportReport])

  // 根据当前 tab 决定显示的分析状态
  const isAiTab = activeTab === 'ai-analysis' || activeTab === 'ai-report'
  const isLocalTab = activeTab === 'local-analysis' || activeTab === 'local-report' || activeTab === 'threat' || activeTab === 'attack' || activeTab === 'session'
  const currentStatus = isAiTab ? status : isLocalTab ? preprocessStatus : 'idle'
  const isAnalyzing = currentStatus === 'analyzing' || currentStatus === 'preparing'

  // Tab 定义（本地预处理在前，AI 分析在后）
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'local-analysis', label: '本地分析' },
    { key: 'local-report', label: '本地报告' },
    { key: 'ai-analysis', label: 'AI 分析' },
    { key: 'ai-report', label: 'AI 报告' },
    { key: 'threat', label: '威胁检测' },
    { key: 'attack', label: '攻击分析' },
    { key: 'session', label: '攻击会话' },
    { key: 'charts', label: '可视化图表' },
    { key: 'path', label: '路径分析' },
    { key: 'geo', label: '地理分析' },
    { key: 'realtime', label: '实时监控' },
  ]

  const titleBarButtons = (
    <>
      <button onClick={() => setShowHistory(true)}
        className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-white/5">
        历史
      </button>
      <button onClick={() => setShowAlertHistory(true)}
        className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-white/5 relative">
        告警
        {unacknowledgedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
          </span>
        )}
      </button>
      <button onClick={() => setShowNotification(true)}
        className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-white/5">
        通知
      </button>
      <button onClick={() => setShowSettings(true)}
        className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-white/5">
        设置
      </button>
    </>
  )

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      <div className="hex-bg" />
      <div className="noise-overlay" />

      <TitleBar extraButtons={titleBarButtons} />
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />

      <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
        {/* 左侧面板 */}
        <div className="shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm overflow-y-auto">
          <Sidebar
            onPreprocess={handlePreprocess}
            onAIAnalysis={handleAIAnalysis}
            onStop={handleStop}
            onExportReport={handleExportReport}
          />
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 标签页头 */}
          <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/30 shrink-0 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-item whitespace-nowrap ${activeTab === tab.key ? 'active' : ''}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 标签页内容 */}
          <div className="flex-1 overflow-hidden p-4 min-h-0 animate-slide-up-fade">
            <div style={{ display: activeTab === 'ai-analysis' ? 'contents' : 'none' }}><AnalysisPanel mode="ai" /></div>
            <div style={{ display: activeTab === 'ai-report' ? 'contents' : 'none' }}><ReportPanel mode="ai" /></div>
            <div style={{ display: activeTab === 'local-analysis' ? 'contents' : 'none' }}><AnalysisPanel mode="local" /></div>
            <div style={{ display: activeTab === 'local-report' ? 'contents' : 'none' }}><ReportPanel mode="local" /></div>
            <div style={{ display: activeTab === 'threat' ? 'contents' : 'none' }}><ThreatPanel /></div>
            <div style={{ display: activeTab === 'attack' ? 'contents' : 'none' }}><AttackPanel /></div>
            <div style={{ display: activeTab === 'session' ? 'contents' : 'none' }}><AttackSessionPanel /></div>
            <div style={{ display: activeTab === 'charts' ? 'contents' : 'none' }}><ChartsPanel /></div>
            <div style={{ display: activeTab === 'path' ? 'contents' : 'none' }}><PathAnalysisPanel /></div>
            <div style={{ display: activeTab === 'geo' ? 'contents' : 'none' }}><GeoPanel /></div>
            <div style={{ display: activeTab === 'realtime' ? 'contents' : 'none' }}><RealtimePanel /></div>
          </div>
        </div>
      </div>

      <StatusBar />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <HistoryDialog open={showHistory} onClose={() => setShowHistory(false)}
        onViewReport={() => setActiveTab('ai-report')} />
      <UpdateDialog open={showUpdate} onClose={() => setShowUpdate(false)} />
      <PreprocessDialog
        open={showPreprocess}
        onClose={() => setShowPreprocess(false)}
        config={config.preprocessConfig || DEFAULT_PREPROCESS_CONFIG}
        onSave={(cfg) => updateConfig({ preprocessConfig: cfg })}
      />
      <NotificationSettings
        open={showNotification}
        onClose={() => setShowNotification(false)}
        config={config.notificationConfig || getDefaultNotificationConfig()}
        onSave={(cfg) => updateConfig({ notificationConfig: cfg })}
      />
      <AlertHistoryDialog open={showAlertHistory} onClose={() => setShowAlertHistory(false)} />

      {/* 全局拖放覆盖层 */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-md pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed border-[var(--accent-primary)] bg-[var(--accent-primary)]/5">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 0 20px var(--glow-color))' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="text-xl font-orbitron text-[var(--accent-primary)] tracking-wider"
              style={{ textShadow: '0 0 20px var(--glow-color)' }}>
              拖放日志文件到此处
            </span>
            <span className="text-sm text-[var(--text-dim)]">
              支持 .log .txt .csv .json .ndjson .jsonl 格式
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
