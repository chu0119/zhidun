// 实时监控状态管理

import { create } from 'zustand'

interface RealtimeLine {
  text: string
  lineNumber: number
  isThreat: boolean
  severity?: string
}

interface RealtimeMatch {
  ruleId: string
  ruleName: string
  category: string
  severity: string
  lineNumber: number
  line: string
  matchedText: string
  description?: string
  remediation?: string
}

interface RealtimeStats {
  totalLines: number
  matchedLines: number
  summary: { critical: number; high: number; medium: number; low: number; info: number }
  categoryStats: Record<string, number>
  startTime: number
}

interface MonitorSession {
  monitorId: string
  filePath: string
  mode: 'local' | 'ssh'
  status: 'connecting' | 'connected' | 'error' | 'stopped'
  lines: RealtimeLine[]
  matches: RealtimeMatch[]
  stats: RealtimeStats
  error: string | null
}

interface RealtimeState {
  // 多会话支持
  sessions: MonitorSession[]
  activeSessionId: string | null

  // 兼容旧接口（映射到活跃会话）
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'stopped'
  monitorId: string | null
  error: string | null
  lines: RealtimeLine[]
  matches: RealtimeMatch[]
  stats: RealtimeStats

  // 会话管理
  addSession: (session: MonitorSession) => void
  removeSession: (monitorId: string) => void
  setActiveSession: (monitorId: string | null) => void
  updateSession: (monitorId: string, updates: Partial<MonitorSession>) => void

  // 兼容旧接口操作
  setStatus: (status: RealtimeState['status']) => void
  setMonitorId: (id: string | null) => void
  setError: (error: string | null) => void
  addLines: (lines: RealtimeLine[]) => void
  addMatches: (matches: RealtimeMatch[]) => void
  updateStats: (stats: Partial<RealtimeStats>) => void
  clear: () => void
}

const MAX_LINES = 500
const MAX_MATCHES = 1000

const EMPTY_STATS: RealtimeStats = {
  totalLines: 0,
  matchedLines: 0,
  summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  categoryStats: {},
  startTime: 0,
}

function getActiveSession(state: RealtimeState): MonitorSession | null {
  if (!state.activeSessionId) return null
  return state.sessions.find(s => s.monitorId === state.activeSessionId) || null
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  // 兼容旧接口 - 从活跃会话派生
  status: 'idle',
  monitorId: null,
  error: null,
  lines: [],
  matches: [],
  stats: { ...EMPTY_STATS },

  addSession: (session) => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.monitorId,
    }))
    // 同步到顶层字段
    const s = get()
    const active = getActiveSession(s)
    if (active) {
      set({
        status: active.status,
        monitorId: active.monitorId,
        error: active.error,
        lines: active.lines,
        matches: active.matches,
        stats: active.stats,
      })
    }
  },

  removeSession: (monitorId) => {
    set(state => {
      const remaining = state.sessions.filter(s => s.monitorId !== monitorId)
      const newActiveId = state.activeSessionId === monitorId
        ? (remaining.length > 0 ? remaining[remaining.length - 1].monitorId : null)
        : state.activeSessionId
      return { sessions: remaining, activeSessionId: newActiveId }
    })
    // 同步
    const s = get()
    const active = getActiveSession(s)
    if (active) {
      set({
        status: active.status,
        monitorId: active.monitorId,
        error: active.error,
        lines: active.lines,
        matches: active.matches,
        stats: active.stats,
      })
    } else {
      set({
        status: 'idle',
        monitorId: null,
        error: null,
        lines: [],
        matches: [],
        stats: { ...EMPTY_STATS },
      })
    }
  },

  setActiveSession: (monitorId) => {
    set({ activeSessionId: monitorId })
    const s = get()
    const active = getActiveSession(s)
    if (active) {
      set({
        status: active.status,
        monitorId: active.monitorId,
        error: active.error,
        lines: active.lines,
        matches: active.matches,
        stats: active.stats,
      })
    }
  },

  updateSession: (monitorId, updates) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.monitorId === monitorId ? { ...s, ...updates } : s
      ),
    }))
    // 如果更新的是活跃会话，同步到顶层
    if (get().activeSessionId === monitorId) {
      const s = get()
      const active = getActiveSession(s)
      if (active) {
        set({
          status: active.status,
          monitorId: active.monitorId,
          error: active.error,
          lines: active.lines,
          matches: active.matches,
          stats: active.stats,
        })
      }
    }
  },

  setStatus: (status) => {
    set({ status })
    const { activeSessionId, sessions } = get()
    if (activeSessionId) {
      set({
        sessions: sessions.map(s =>
          s.monitorId === activeSessionId ? { ...s, status: status as MonitorSession['status'] } : s
        ),
      })
    }
  },

  setMonitorId: (monitorId) => set({ monitorId }),

  setError: (error) => {
    set({ error })
    const { activeSessionId, sessions } = get()
    if (activeSessionId) {
      set({
        sessions: sessions.map(s =>
          s.monitorId === activeSessionId ? { ...s, error } : s
        ),
      })
    }
  },

  addLines: (newLines) => {
    const state = get()
    const activeSession = state.activeSessionId ? state.sessions.find(s => s.monitorId === state.activeSessionId) : null
    const baseLines = activeSession ? activeSession.lines : state.lines
    const merged = [...baseLines, ...newLines]
    const trimmed = merged.length > MAX_LINES ? merged.slice(-MAX_LINES) : merged
    set({
      lines: trimmed,
      sessions: state.activeSessionId
        ? state.sessions.map(s => s.monitorId === state.activeSessionId ? { ...s, lines: trimmed } : s)
        : state.sessions,
    })
  },

  addMatches: (newMatches) => {
    const state = get()
    const activeSession = state.activeSessionId ? state.sessions.find(s => s.monitorId === state.activeSessionId) : null
    const baseMatches = activeSession ? activeSession.matches : state.matches
    const merged = [...baseMatches, ...newMatches]
    const trimmed = merged.length > MAX_MATCHES ? merged.slice(-MAX_MATCHES) : merged
    set({
      matches: trimmed,
      sessions: state.activeSessionId
        ? state.sessions.map(s => s.monitorId === state.activeSessionId ? { ...s, matches: trimmed } : s)
        : state.sessions,
    })
  },

  updateStats: (partial) => {
    const state = get()
    const activeSession = state.activeSessionId ? state.sessions.find(s => s.monitorId === state.activeSessionId) : null
    const baseStats = activeSession ? activeSession.stats : state.stats
    const updated = { ...baseStats, ...partial }
    set({
      stats: updated,
      sessions: state.activeSessionId
        ? state.sessions.map(s => s.monitorId === state.activeSessionId ? { ...s, stats: updated } : s)
        : state.sessions,
    })
  },

  clear: () => {
    set({
      status: 'idle',
      monitorId: null,
      error: null,
      lines: [],
      matches: [],
      stats: { ...EMPTY_STATS },
      sessions: [],
      activeSessionId: null,
    })
  },
}))
