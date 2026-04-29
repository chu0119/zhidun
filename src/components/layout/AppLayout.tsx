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
import { LogAnalyzer } from '@/core/analyzer'
import { LogParser } from '@/core/log-parser'
import { processLog, compressLogForAI } from '@/core/log-processor'
import { exportToDocx, exportToPdf } from '@/core/report-generator'
import { analyzeWithRules } from '@/core/rule-engine'
import { extractIPsFromLines, lookupIPs } from '@/core/geoip'
import { detectBots } from '@/core/bot-detector'
import { useQueueStore, QueueItem } from '@/stores/queue-store'
import { useRulesStore } from '@/stores/rules-store'
import type { Rule } from '@/core/rule-engine'
import {
  showPhase1, showPhase2, showPhase3Pre, showPhase3Post, showPhase4,
  showLocalAnalysisPhase1, showLocalAnalysisPhase2, showLocalAnalysisPhase3, showLocalAnalysisPhase4,
} from '@/core/demo-messages'

type TabKey = 'ai-analysis' | 'ai-report' | 'local-analysis' | 'local-report' | 'threat' | 'attack' | 'session' | 'charts' | 'path' | 'geo'

export function AppLayout() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai-analysis')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [showPreprocess, setShowPreprocess] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const dragCounterRef = React.useRef(0)

  const { config, updateConfig } = useConfigStore()
  const { addRecord } = useHistoryStore()
  const status = useAnalysisStore(s => s.status)
  const localStatus = useAnalysisStore(s => s.localStatus)

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

  // ===== 本地规则分析 =====
  const handleLocalAnalysis = useCallback(async () => {
    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const [fullPath, displayName] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('local-analysis')
    getStore().setLocalStatus('preparing')
    getStore().startLocalTimer()

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addLocalProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().localStatus

    try {
      await showLocalAnalysisPhase1(progressStore, getStatus)

      const fileResult = await window.electronAPI.readTextFile(fullPath)
      if (!fileResult.success) throw new Error(`读取文件失败: ${fileResult.error}`)

      const fileText = fileResult.text || ''
      let allLines = fileText.split('\n').filter((l: string) => l.trim())

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
        encoding: fileResult.encoding || 'utf-8',
        sizeMB: ((fileResult.size || 0) / (1024 * 1024)).toFixed(2),
        totalLines: allLines.length,
      }, getStatus)

      getStore().setLocalStatus('analyzing')
      await showLocalAnalysisPhase3(progressStore, allLines.length, getStatus)

      const result = analyzeWithRules(allLines, (msg) => getStore().addLocalProgress(msg), getCustomRules())

      const elapsed = useAnalysisStore.getState().localElapsedTime
      await showLocalAnalysisPhase4(progressStore, result.matches.length, formatElapsed(elapsed), getStatus)

      getStore().setLocalReportText(result.report)
      getStore().setLocalRuleResult(result)
      getStore().setLocalStatus('done')

      setActiveTab('local-report')

      // 保存历史记录
      addRecord({
        filePath: fullPath,
        fileName: displayName || 'unknown',
        fileSize: (fileResult.size || 0),
        linesAnalyzed: allLines.length,
        modelProvider: 'local',
        modelName: '本地规则引擎',
        analysisTime: elapsed,
        hasReport: true,
        reportText: result.report,
        notes: '',
      })

      // 异步 GeoIP 查询
      const ips = extractIPsFromLines(allLines)
      if (ips.length > 0) {
        lookupIPs(ips).then(geoResults => {
          getStore().setGeoIPResults(geoResults)
        }).catch(() => {})
      }

      const botStats = detectBots(allLines)
      getStore().setBotStats(botStats)

      // 异步告警通知
      const notifConfig = useConfigStore.getState().config.notificationConfig
      if (notifConfig?.enabled) {
        processAlerts(notifConfig, result.categoryStats, result.summary, displayName).catch(() => {})
      }
    } catch (error: any) {
      getStore().setLocalStatus('error')
      getStore().setError(error.message)
      getStore().addLocalProgress(`错误: ${error.message}`)
    } finally {
      getStore().stopLocalTimer()
    }
  }, [])

  // 注册本地分析触发器（供空状态按钮使用）
  useEffect(() => {
    useAppStore.getState().setLocalAnalysisTrigger(handleLocalAnalysis)
    return () => useAppStore.getState().setLocalAnalysisTrigger(null)
  }, [handleLocalAnalysis])

  // ===== AI 分析 =====
  const handleStartAnalysis = useCallback(async () => {
    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const [fullPath, displayName] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('ai-analysis')
    getStore().setStatus('preparing')
    getStore().startTimer()

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().status

    try {
      await showPhase1(progressStore, config.currentModel.modelName, getStatus)

      progressStore.addProgress('')
      progressStore.addProgress('[读取] 正在读取日志文件...')

      const fileResult = await window.electronAPI.readTextFile(fullPath)
      if (!fileResult.success) throw new Error(`读取文件失败: ${fileResult.error}`)

      const fileText = fileResult.text || ''
      const allLines = fileText.split('\n').filter((l: string) => l.trim())
      const totalLines = allLines.length
      getStore().setLogLines(allLines)

      const parser = new LogParser(fullPath)
      const formatType = parser.detectFormat(allLines)

      const result = processLog(
        allLines, totalLines, formatType,
        fileResult.encoding || 'utf-8',
        (fileResult.size || 0) / (1024 * 1024),
        config.defaultLines,
        config.currentModel.maxTokens
      )

      getStore().setMetadata({
        formatType: result.formatType,
        encoding: result.encoding,
        totalLines: result.totalLines,
        sampledLines: result.sampledLines,
      })

      await showPhase2(progressStore, {
        format: formatType,
        encoding: fileResult.encoding || 'utf-8',
        sizeMB: ((fileResult.size || 0) / (1024 * 1024)).toFixed(2),
        totalLines,
        sampledLines: result.sampledLines,
        tokens: result.estimatedTokens,
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

      const analyzer = new LogAnalyzer(provider)
      getStore().setAbortController(analyzer['abortController'] || null)

      const origStop = analyzer.stop.bind(analyzer)
      analyzer.stop = () => {
        origStop()
        getStore().setAbortController(null)
      }

      const logContent = compressLogForAI(result.lines, result.formatType)
      const report = await analyzer.analyze(logContent, {
        formatType: result.formatType,
        encoding: result.encoding,
        totalLines: result.totalLines,
        sampledLines: result.sampledLines,
      })

      if (report) {
        await showPhase3Post(progressStore, Math.round(report.length / 1024), getStatus)

        const elapsed = useAnalysisStore.getState().elapsedTime
        await showPhase4(progressStore, formatElapsed(elapsed), getStatus)

        getStore().setReportText(report)
        getStore().setStatus('done')
        getStore().setAbortController(null)

        setActiveTab('ai-report')

        addRecord({
          filePath: fullPath,
          fileName: displayName || 'unknown',
          fileSize: (fileResult.size || 0),
          linesAnalyzed: result.sampledLines,
          modelProvider: config.currentModel.provider,
          modelName: config.currentModel.modelName,
          analysisTime: elapsed,
          hasReport: true,
          reportText: report,
          notes: '',
        })
      } else {
        getStore().setStatus('error')
        getStore().setError('AI 未返回有效分析结果')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        getStore().addProgress('分析已被用户停止')
      } else {
        getStore().setStatus('error')
        getStore().setError(error.message)
      }
    } finally {
      getStore().stopTimer()
      getStore().setAbortController(null)
    }
  }, [config])

  // ===== 停止分析 =====
  const handleStopAnalysis = useCallback(() => {
    const { abortController, status } = useAnalysisStore.getState()
    if (status === 'preparing' || status === 'analyzing') {
      getStore().setStatus('stopped')
      getStore().stopTimer()
      if (abortController) {
        abortController.abort()
        getStore().setAbortController(null)
      }
    }
  }, [])

  const handleStopLocalAnalysis = useCallback(() => {
    const { localStatus } = useAnalysisStore.getState()
    if (localStatus === 'preparing' || localStatus === 'analyzing') {
      getStore().setLocalStatus('stopped')
      getStore().stopLocalTimer()
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

        const result = analyzeWithRules(allLines, undefined, getCustomRules())
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
        handleStopAnalysis()
        handleStopLocalAnalysis()
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
  }, [handleStopAnalysis, handleStopLocalAnalysis])

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
          if (s.localStatus === 'idle' && s.currentFile) handleLocalAnalysis()
          break
        }
        case 'start-ai-analysis': {
          const s = useAnalysisStore.getState()
          if (s.status === 'idle' && s.currentFile) handleStartAnalysis()
          break
        }
        case 'stop-analysis':
          handleStopAnalysis()
          handleStopLocalAnalysis()
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
  }, [handleStartAnalysis, handleLocalAnalysis, handleStopAnalysis, handleStopLocalAnalysis, handleExportReport])

  // 根据当前 tab 决定显示的分析状态
  const isAiTab = activeTab === 'ai-analysis' || activeTab === 'ai-report'
  const isLocalTab = activeTab === 'local-analysis' || activeTab === 'local-report' || activeTab === 'threat' || activeTab === 'attack' || activeTab === 'session'
  const currentStatus = isAiTab ? status : isLocalTab ? localStatus : 'idle'
  const isAnalyzing = currentStatus === 'analyzing' || currentStatus === 'preparing'

  // Tab 定义
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'ai-analysis', label: 'AI 分析' },
    { key: 'ai-report', label: 'AI 报告' },
    { key: 'local-analysis', label: '本地分析' },
    { key: 'local-report', label: '本地报告' },
    { key: 'threat', label: '威胁检测' },
    { key: 'attack', label: '攻击分析' },
    { key: 'session', label: '攻击会话' },
    { key: 'charts', label: '可视化图表' },
    { key: 'path', label: '路径分析' },
    { key: 'geo', label: '地理分析' },
  ]

  const titleBarButtons = (
    <>
      <button onClick={() => setShowHistory(true)}
        className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-white/5">
        历史
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
            onStartAnalysis={handleStartAnalysis}
            onStopAnalysis={isAiTab ? handleStopAnalysis : handleStopLocalAnalysis}
            onLocalAnalysis={handleLocalAnalysis}
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
          <div className="flex-1 overflow-hidden p-4 min-h-0 animate-slide-up-fade" key={activeTab}>
            {activeTab === 'ai-analysis' && <AnalysisPanel mode="ai" />}
            {activeTab === 'ai-report' && <ReportPanel mode="ai" />}
            {activeTab === 'local-analysis' && <AnalysisPanel mode="local" />}
            {activeTab === 'local-report' && <ReportPanel mode="local" />}
            {activeTab === 'threat' && <ThreatPanel />}
            {activeTab === 'attack' && <AttackPanel />}
            {activeTab === 'session' && <AttackSessionPanel />}
            {activeTab === 'charts' && <ChartsPanel />}
            {activeTab === 'path' && <PathAnalysisPanel />}
            {activeTab === 'geo' && <GeoPanel />}
          </div>
        </div>
      </div>

      <StatusBar />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <HistoryDialog open={showHistory} onClose={() => setShowHistory(false)} />
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
