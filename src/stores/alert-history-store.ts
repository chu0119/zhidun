// 告警历史状态管理

import { create } from 'zustand'
import type { AlertHistoryEntry } from '@/core/notification-engine'

const MAX_ALERT_HISTORY = 500

interface AlertHistoryState {
  alerts: AlertHistoryEntry[]
  loaded: boolean

  loadAlerts: () => Promise<void>
  saveAlerts: () => void
  addAlert: (entry: Omit<AlertHistoryEntry, 'id' | 'timestamp' | 'state'>) => Promise<void>
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  deleteAlert: (id: string) => void
  clearAll: () => void
  clearResolved: () => void
  getUnacknowledgedCount: () => number
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useAlertHistoryStore = create<AlertHistoryState>((set, get) => ({
  alerts: [],
  loaded: false,

  loadAlerts: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const filePath = `${appPath}/config/alert_history.json`
      const result = await window.electronAPI.readFile(filePath)
      if (result.success && result.data) {
        const json = atob(result.data)
        const data = JSON.parse(json)
        if (Array.isArray(data)) {
          set({ alerts: data, loaded: true })
          return
        }
      }
    } catch {
      console.error('加载告警历史失败')
    }
    set({ alerts: [], loaded: true })
  },

  saveAlerts: () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      try {
        const appPath = await window.electronAPI.getAppPath()
        const filePath = `${appPath}/config/alert_history.json`
        const data = JSON.stringify(get().alerts, null, 2)
        await window.electronAPI.writeFile(filePath, data)
      } catch (error) {
        console.error('保存告警历史失败:', error)
      }
    }, 300)
  },

  addAlert: async (entry) => {
    const newAlert: AlertHistoryEntry = {
      ...entry,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      state: 'new',
    }
    set(state => ({
      alerts: [newAlert, ...state.alerts].slice(0, MAX_ALERT_HISTORY),
    }))
    get().saveAlerts()
  },

  acknowledgeAlert: (id) => {
    set(state => ({
      alerts: state.alerts.map(a =>
        a.id === id ? { ...a, state: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : a
      ),
    }))
    get().saveAlerts()
  },

  resolveAlert: (id) => {
    set(state => ({
      alerts: state.alerts.map(a =>
        a.id === id ? { ...a, state: 'resolved' as const, resolvedAt: new Date().toISOString() } : a
      ),
    }))
    get().saveAlerts()
  },

  deleteAlert: (id) => {
    set(state => ({ alerts: state.alerts.filter(a => a.id !== id) }))
    get().saveAlerts()
  },

  clearAll: () => {
    set({ alerts: [] })
    get().saveAlerts()
  },

  clearResolved: () => {
    set(state => ({ alerts: state.alerts.filter(a => a.state !== 'resolved') }))
    get().saveAlerts()
  },

  getUnacknowledgedCount: () => {
    return get().alerts.filter(a => a.state === 'new').length
  },
}))
