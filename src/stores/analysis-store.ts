// 分析状态管理

import { create } from 'zustand'
import type { AnalysisStatus } from '@/types/analysis'
import type { LogMetadata } from '@/types/log'
import type { RuleAnalysisResult } from '@/core/rule-engine'
import type { GeoIPResult } from '@/core/geoip'
import type { BotStat } from '@/core/bot-detector'
import type { AnalysisSnapshot } from '@/types/analysis'

interface PreprocessResult {
  totalLines: number
  suspiciousLines: number
  suspiciousContent: string[]
  matchedCategories: string[]
}

interface AnalysisState {
  // AI 分析状态
  status: AnalysisStatus
  progressMessages: string[]
  reportText: string
  thinkingContent: string
  elapsedTime: number

  // 预处理状态（本地规则分析 + 数据清洗）
  preprocessStatus: AnalysisStatus
  preprocessResult: PreprocessResult | null
  localProgressMessages: string[]
  localReportText: string
  localElapsedTime: number
  localRuleResult: RuleAnalysisResult | null
  geoIPResults: Map<string, GeoIPResult> | null
  botStats: BotStat[] | null

  // 共享数据
  currentFile: string | null
  metadata: LogMetadata | null
  error: string | null
  logLines: string[]

  // 计时器
  timerInterval: ReturnType<typeof setInterval> | null
  localTimerInterval: ReturnType<typeof setInterval> | null

  // 停止控制
  abortController: AbortController | null

  // AI Actions
  setStatus: (status: AnalysisStatus) => void
  addProgress: (message: string) => void
  setReportText: (text: string) => void
  setThinkingContent: (content: string) => void
  setElapsedTime: (t: number) => void

  // Preprocess Actions
  setPreprocessStatus: (status: AnalysisStatus) => void
  setPreprocessResult: (result: PreprocessResult | null) => void
  addLocalProgress: (message: string) => void
  setLocalReportText: (text: string) => void
  setLocalElapsedTime: (t: number) => void
  setLocalRuleResult: (result: RuleAnalysisResult | null) => void
  setGeoIPResults: (results: Map<string, GeoIPResult> | null) => void
  setBotStats: (stats: BotStat[] | null) => void

  // Shared Actions
  setCurrentFile: (file: string | null) => void
  setMetadata: (meta: LogMetadata | null) => void
  setError: (error: string | null) => void
  setLogLines: (lines: string[]) => void
  setAbortController: (controller: AbortController | null) => void

  // Timer Actions
  startTimer: () => void
  stopTimer: () => void
  startLocalTimer: () => void
  stopLocalTimer: () => void
  clearAll: () => void
  restoreFromSnapshot: (snapshot: AnalysisSnapshot) => void
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  // AI state
  status: 'idle',
  progressMessages: [],
  reportText: '',
  thinkingContent: '',
  elapsedTime: 0,

  // Preprocess state
  preprocessStatus: 'idle',
  preprocessResult: null,
  localProgressMessages: [],
  localReportText: '',
  localElapsedTime: 0,
  localRuleResult: null,
  geoIPResults: null,
  botStats: null,

  // Shared
  currentFile: null,
  metadata: null,
  error: null,
  logLines: [],
  timerInterval: null,
  localTimerInterval: null,
  abortController: null,

  // ---- AI Actions ----
  setStatus: (status) => set({ status }),

  addProgress: (message) => set(state => {
    const newMessages = [...state.progressMessages, `[${new Date().toLocaleTimeString()}] ${message}`]
    return { progressMessages: newMessages.length > 500 ? newMessages.slice(-500) : newMessages }
  }),

  setReportText: (text) => {
    const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/)
    const chineseThinkingMatch = text.match(/(?:让我分析|我来分析|首先|思考过程)[\s\S]{50,}?(?=\n\n【|\n\n\d)/)
    let thinking = ''
    let cleanText = text
    if (thinkingMatch) {
      thinking = thinkingMatch[1].trim()
      cleanText = text.replace(thinkingMatch[0], '').trim()
    } else if (chineseThinkingMatch) {
      thinking = chineseThinkingMatch[0].trim()
      cleanText = text.replace(chineseThinkingMatch[0], '').trim()
    }
    set({ reportText: cleanText, thinkingContent: thinking })
  },

  setThinkingContent: (content) => set({ thinkingContent: content }),
  setElapsedTime: (t) => set({ elapsedTime: t }),

  // ---- Preprocess Actions ----
  setPreprocessStatus: (status) => set({ preprocessStatus: status }),
  setPreprocessResult: (result) => set({ preprocessResult: result }),

  addLocalProgress: (message) => set(state => {
    const newMessages = [...state.localProgressMessages, `[${new Date().toLocaleTimeString()}] ${message}`]
    return { localProgressMessages: newMessages.length > 500 ? newMessages.slice(-500) : newMessages }
  }),

  setLocalReportText: (text) => set({ localReportText: text }),
  setLocalElapsedTime: (t) => set({ localElapsedTime: t }),
  setLocalRuleResult: (result) => set({ localRuleResult: result }),
  setGeoIPResults: (results) => set({ geoIPResults: results }),
  setBotStats: (stats) => set({ botStats: stats }),

  // ---- Shared Actions ----
  setCurrentFile: (file) => set({ currentFile: file }),
  setMetadata: (meta) => set({ metadata: meta }),
  setError: (error) => set({ error }),
  setLogLines: (lines) => set({ logLines: lines }),
  setAbortController: (controller) => set({ abortController: controller }),

  // ---- Timer Actions ----
  startTimer: () => {
    const { timerInterval } = get()
    if (timerInterval) clearInterval(timerInterval)
    const interval = setInterval(() => {
      set(state => ({ elapsedTime: state.elapsedTime + 1 }))
    }, 1000)
    set({ timerInterval: interval, elapsedTime: 0 })
  },

  stopTimer: () => {
    const { timerInterval } = get()
    if (timerInterval) clearInterval(timerInterval)
    set({ timerInterval: null })
  },

  startLocalTimer: () => {
    const { localTimerInterval } = get()
    if (localTimerInterval) clearInterval(localTimerInterval)
    const interval = setInterval(() => {
      set(state => ({ localElapsedTime: state.localElapsedTime + 1 }))
    }, 1000)
    set({ localTimerInterval: interval, localElapsedTime: 0 })
  },

  stopLocalTimer: () => {
    const { localTimerInterval } = get()
    if (localTimerInterval) clearInterval(localTimerInterval)
    set({ localTimerInterval: null })
  },

  clearAll: () => {
    const { timerInterval, localTimerInterval, abortController } = get()
    if (timerInterval) clearInterval(timerInterval)
    if (localTimerInterval) clearInterval(localTimerInterval)
    if (abortController) abortController.abort()
    set({
      status: 'idle',
      progressMessages: [],
      reportText: '',
      thinkingContent: '',
      elapsedTime: 0,
      preprocessStatus: 'idle',
      preprocessResult: null,
      localProgressMessages: [],
      localReportText: '',
      localElapsedTime: 0,
      localRuleResult: null,
      geoIPResults: null,
      botStats: null,
      currentFile: null,
      metadata: null,
      error: null,
      logLines: [],
      timerInterval: null,
      localTimerInterval: null,
      abortController: null,
    })
  },

  restoreFromSnapshot: (snapshot: AnalysisSnapshot) => {
    // 将快照中的 RuleAnalysisResult 的 pattern 字符串重建为 RegExp
    let localRuleResult = snapshot.localRuleResult as RuleAnalysisResult | null
    if (localRuleResult) {
      // matches 中的 rule.patterns 已被序列化为字符串数组或丢失，这里不做重建
      // 规则引擎的 pattern 仅用于运行时匹配，展示时不需要
      localRuleResult = {
        ...localRuleResult,
        matches: localRuleResult.matches.map(m => ({ ...m, rule: { ...m.rule, patterns: [] as any } })),
        aggregatedAlerts: localRuleResult.aggregatedAlerts.map(a => ({ ...a, rule: { ...a.rule, patterns: [] as any } })),
      }
    }

    // 将 geoIPResults Record 转回 Map
    let geoMap: Map<string, GeoIPResult> | null = null
    if (snapshot.geoIPResults && Object.keys(snapshot.geoIPResults).length > 0) {
      geoMap = new Map(Object.entries(snapshot.geoIPResults))
    }

    set({
      localRuleResult,
      localReportText: snapshot.localReportText,
      reportText: snapshot.aiReportText,
      botStats: snapshot.botStats as BotStat[],
      geoIPResults: geoMap,
      preprocessResult: snapshot.preprocessResult,
      logLines: snapshot.logLines,
      preprocessStatus: 'done',
      status: snapshot.aiReportText ? 'done' : 'idle',
      error: null,
    })
  },
}))
