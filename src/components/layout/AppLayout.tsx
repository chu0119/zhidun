// 主布局框架

import React, { useState, useCallback, useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { AnalysisPanel } from '../panels/AnalysisPanel'
import { ReportPanel } from '../panels/ReportPanel'
import { ChartsPanel } from '../panels/ChartsPanel'
import { SettingsDialog } from '../dialogs/SettingsDialog'
import { HistoryDialog } from '../dialogs/HistoryDialog'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useConfigStore } from '@/stores/config-store'
import { useHistoryStore } from '@/stores/history-store'
import { createAIProvider } from '@/ai-providers'
import { LogAnalyzer } from '@/core/analyzer'
import { LogParser } from '@/core/log-parser'
import { processLog, compressLogForAI } from '@/core/log-processor'
import { exportToDocx, exportToPdf } from '@/core/report-generator'
import { analyzeWithRules } from '@/core/rule-engine'
import { extractIPsFromLines, lookupIPs } from '@/core/geoip'
import { detectBots } from '@/core/bot-detector'
import {
  showPhase1, showPhase2, showPhase3Pre, showPhase3Post, showPhase4,
  showLocalAnalysisPhase1, showLocalAnalysisPhase2, showLocalAnalysisPhase3, showLocalAnalysisPhase4,
} from '@/core/demo-messages'

type TabKey = 'ai-analysis' | 'ai-report' | 'local-analysis' | 'local-report' | 'charts'

export function AppLayout() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai-analysis')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { config } = useConfigStore()
  const store = useAnalysisStore()
  const { addRecord } = useHistoryStore()

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // ===== AI 分析 =====
  const handleStartAnalysis = useCallback(async () => {
    if (!store.currentFile) return

    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const [fullPath, displayName] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('ai-analysis')
    store.setStatus('preparing')
    store.startTimer()

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().status

    try {
      // 阶段一: 系统初始化
      await showPhase1(progressStore, config.currentModel.modelName, getStatus)

      // 真实操作: 读取文件
      progressStore.addProgress('')
      progressStore.addProgress('[读取] 正在读取日志文件...')

      const fileResult = await window.electronAPI.readTextFile(fullPath)
      if (!fileResult.success) throw new Error(`读取文件失败: ${fileResult.error}`)

      const fileText = fileResult.text || ''
      const allLines = fileText.split('\n').filter((l: string) => l.trim())
      const totalLines = allLines.length
      store.setLogLines(allLines)

      const parser = new LogParser(fullPath)
      const formatType = parser.detectFormat(allLines)

      const result = processLog(
        allLines, totalLines, formatType,
        fileResult.encoding || 'utf-8',
        (fileResult.size || 0) / (1024 * 1024),
        config.defaultLines,
        config.currentModel.maxTokens
      )

      store.setMetadata({
        formatType: result.formatType,
        encoding: result.encoding,
        totalLines: result.totalLines,
        sampledLines: result.sampledLines,
      })

      // 阶段二: 数据注入
      await showPhase2(progressStore, {
        format: formatType,
        encoding: fileResult.encoding || 'utf-8',
        sizeMB: ((fileResult.size || 0) / (1024 * 1024)).toFixed(2),
        totalLines,
        sampledLines: result.sampledLines,
        tokens: result.estimatedTokens,
      }, getStatus)

      // 阶段三前半
      await showPhase3Pre(progressStore, config.currentModel.modelName, getStatus)

      // 真实 AI 分析
      store.setStatus('analyzing')

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
      store.setAbortController(analyzer['abortController'] || null)

      // 将 analyzer 的 abortController 存入 store
      const origStop = analyzer.stop.bind(analyzer)
      analyzer.stop = () => {
        origStop()
        store.setAbortController(null)
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

        store.setReportText(report)
        store.setStatus('done')
        store.setAbortController(null)

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

        setActiveTab('ai-report')
      } else {
        store.setStatus('error')
        store.setError('AI 未返回有效分析结果')
        store.addProgress('分析失败: AI 未返回有效结果')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        store.addProgress('分析已被用户停止')
      } else {
        store.setStatus('error')
        store.setError(error.message)
        store.addProgress(`错误: ${error.message}`)
      }
    } finally {
      store.stopTimer()
      store.setAbortController(null)
    }
  }, [config, store])

  // ===== 本地规则分析 =====
  const handleLocalAnalysis = useCallback(async () => {
    const currentFileValue = useAnalysisStore.getState().currentFile
    if (!currentFileValue) return

    const [fullPath] = currentFileValue.includes('|')
      ? currentFileValue.split('|')
      : [currentFileValue, currentFileValue]

    setActiveTab('local-analysis')
    store.setLocalStatus('preparing')
    store.startLocalTimer()

    const s = useAnalysisStore.getState()
    const progressStore = { addProgress: (msg: string) => s.addLocalProgress(msg) }
    const getStatus = () => useAnalysisStore.getState().localStatus

    try {
      // 阶段一: 规则引擎初始化
      await showLocalAnalysisPhase1(progressStore, getStatus)

      // 读取文件
      const fileResult = await window.electronAPI.readTextFile(fullPath)
      if (!fileResult.success) throw new Error(`读取文件失败: ${fileResult.error}`)

      const fileText = fileResult.text || ''
      const allLines = fileText.split('\n').filter((l: string) => l.trim())
      store.setLogLines(allLines)

      const parser = new LogParser(fullPath)
      const formatType = parser.detectFormat(allLines)

      // 阶段二: 数据预处理
      await showLocalAnalysisPhase2(progressStore, {
        format: formatType,
        encoding: fileResult.encoding || 'utf-8',
        sizeMB: ((fileResult.size || 0) / (1024 * 1024)).toFixed(2),
        totalLines: allLines.length,
      }, getStatus)

      // 阶段三: 规则匹配
      store.setLocalStatus('analyzing')
      await showLocalAnalysisPhase3(progressStore, allLines.length, getStatus)

      const result = analyzeWithRules(allLines, (msg) => store.addLocalProgress(msg))

      // 阶段四: 报告生成
      const elapsed = useAnalysisStore.getState().localElapsedTime
      await showLocalAnalysisPhase4(progressStore, result.matches.length, formatElapsed(elapsed), getStatus)

      store.setLocalReportText(result.report)
      store.setLocalRuleResult(result)
      store.setLocalStatus('done')

      setActiveTab('local-report')

      // 异步执行 GeoIP 查询和 Bot 检测（不阻塞报告展示）
      const ips = extractIPsFromLines(allLines)
      if (ips.length > 0) {
        lookupIPs(ips).then(geoResults => {
          store.setGeoIPResults(geoResults)
        }).catch(() => {})
      }

      const botStats = detectBots(allLines)
      store.setBotStats(botStats)
    } catch (error: any) {
      store.setLocalStatus('error')
      store.setError(error.message)
      store.addLocalProgress(`错误: ${error.message}`)
    } finally {
      store.stopLocalTimer()
    }
  }, [store])

  // ===== 停止分析 =====
  const handleStopAnalysis = useCallback(() => {
    // 停止 AI 分析
    const { abortController, status } = useAnalysisStore.getState()
    if (status === 'preparing' || status === 'analyzing') {
      store.setStatus('stopped')
      store.stopTimer()
      if (abortController) {
        abortController.abort()
        store.setAbortController(null)
      }
      store.addProgress('用户停止了分析')
    }
  }, [store])

  const handleStopLocalAnalysis = useCallback(() => {
    const { localStatus } = useAnalysisStore.getState()
    if (localStatus === 'preparing' || localStatus === 'analyzing') {
      store.setLocalStatus('stopped')
      store.stopLocalTimer()
      store.addLocalProgress('用户停止了分析')
    }
  }, [store])

  const handleExportReport = useCallback(async (format: 'docx' | 'pdf') => {
    const { reportText, localReportText, currentFile } = useAnalysisStore.getState()
    const text = reportText || localReportText
    if (!text) return

    const fileName = currentFile || 'report'

    try {
      if (format === 'pdf') {
        await exportToPdf(text, fileName)
      } else {
        await exportToDocx(text, fileName)
      }
      store.addProgress(`报告已导出为 ${format.toUpperCase()} 格式`)
    } catch (error: any) {
      store.addProgress(`导出失败: ${error.message}`)
    }
  }, [store])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[data-file-select]')?.click()
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        const s = useAnalysisStore.getState()
        if (s.status === 'idle') handleStartAnalysis()
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
  }, [handleStartAnalysis, handleStopAnalysis, handleStopLocalAnalysis])

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'ai-analysis', label: 'AI 分析', icon: '⚡' },
    { key: 'ai-report', label: 'AI 报告', icon: '📋' },
    { key: 'local-analysis', label: '本地分析', icon: '◆' },
    { key: 'local-report', label: '本地报告', icon: '📑' },
    { key: 'charts', label: '可视化图表', icon: '📊' },
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

  // 根据当前 tab 决定显示的分析状态
  const isAiTab = activeTab === 'ai-analysis' || activeTab === 'ai-report'
  const isLocalTab = activeTab === 'local-analysis' || activeTab === 'local-report'
  const currentStatus = isAiTab ? store.status : isLocalTab ? store.localStatus : 'idle'
  const isAnalyzing = currentStatus === 'analyzing' || currentStatus === 'preparing'

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
                className={`tab-item flex items-center gap-2 whitespace-nowrap ${activeTab === tab.key ? 'active' : ''}`}>
                <span className="text-sm">{tab.icon}</span>
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
            {activeTab === 'charts' && <ChartsPanel />}
          </div>
        </div>
      </div>

      <StatusBar />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <HistoryDialog open={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  )
}
