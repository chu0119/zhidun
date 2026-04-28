// 分析状态管理

import { create } from 'zustand'
import type { AnalysisStatus } from '@/types/analysis'
import type { LogMetadata } from '@/types/log'

interface AnalysisState {
  // AI 分析状态
  status: AnalysisStatus
  progressMessages: string[]
  reportText: string
  thinkingContent: string
  elapsedTime: number

  // 本地分析状态（独立）
  localStatus: AnalysisStatus
  localProgressMessages: string[]
  localReportText: string
  localElapsedTime: number

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

  // Local Actions
  setLocalStatus: (status: AnalysisStatus) => void
  addLocalProgress: (message: string) => void
  setLocalReportText: (text: string) => void
  setLocalElapsedTime: (t: number) => void

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
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  // AI state
  status: 'idle',
  progressMessages: [],
  reportText: '',
  thinkingContent: '',
  elapsedTime: 0,

  // Local state
  localStatus: 'idle',
  localProgressMessages: [],
  localReportText: '',
  localElapsedTime: 0,

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

  addProgress: (message) => set(state => ({
    progressMessages: [...state.progressMessages, `[${new Date().toLocaleTimeString()}] ${message}`],
  })),

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

  // ---- Local Actions ----
  setLocalStatus: (status) => set({ localStatus: status }),

  addLocalProgress: (message) => set(state => ({
    localProgressMessages: [...state.localProgressMessages, `[${new Date().toLocaleTimeString()}] ${message}`],
  })),

  setLocalReportText: (text) => set({ localReportText: text }),
  setLocalElapsedTime: (t) => set({ localElapsedTime: t }),

  // ---- Shared Actions ----
  setCurrentFile: (file) => set({ currentFile: file }),
  setMetadata: (meta) => set({ metadata: meta }),
  setError: (error) => set({ error }),
  setLogLines: (lines) => set({ logLines: lines }),
  setAbortController: (controller) => set({ abortController: controller }),

  // ---- Timer Actions ----
  startTimer: () => {
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
      localStatus: 'idle',
      localProgressMessages: [],
      localReportText: '',
      localElapsedTime: 0,
      currentFile: null,
      metadata: null,
      error: null,
      logLines: [],
      timerInterval: null,
      localTimerInterval: null,
      abortController: null,
    })
  },
}))
