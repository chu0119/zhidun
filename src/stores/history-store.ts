// 历史记录状态管理

import { create } from 'zustand'
import type { AnalysisHistory } from '@/types/analysis'
import { MAX_HISTORY_RECORDS } from '@/core/constants'

interface HistoryState {
  history: AnalysisHistory[]
  loaded: boolean
  loadHistory: () => Promise<void>
  saveHistory: () => Promise<void>
  addRecord: (record: Omit<AnalysisHistory, 'id' | 'timestamp'>) => Promise<AnalysisHistory>
  deleteRecord: (id: string) => void
  clearAll: () => void
  searchHistory: (keyword?: string, provider?: string) => AnalysisHistory[]
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const historyPath = `${appPath}/config/analysis_history.json`
      const result = await window.electronAPI.readFile(historyPath)

      if (result.success && result.data) {
        const json = atob(result.data)
        const data = JSON.parse(json)
        if (Array.isArray(data)) {
          set({ history: data, loaded: true })
          return
        }
      }
    } catch {}
    set({ history: [], loaded: true })
  },

  saveHistory: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const historyPath = `${appPath}/config/analysis_history.json`
      const data = JSON.stringify(get().history, null, 2)
      await window.electronAPI.writeFile(historyPath, data)
    } catch (error) {
      console.error('保存历史记录失败:', error)
    }
  },

  addRecord: async (record) => {
    const newRecord: AnalysisHistory = {
      ...record,
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
    }

    set(state => {
      const history = [newRecord, ...state.history].slice(0, MAX_HISTORY_RECORDS)
      return { history }
    })

    get().saveHistory()
    return newRecord
  },

  deleteRecord: (id) => {
    set(state => ({
      history: state.history.filter(r => r.id !== id),
    }))
    get().saveHistory()
  },

  clearAll: () => {
    set({ history: [] })
    get().saveHistory()
  },

  searchHistory: (keyword, provider) => {
    let results = get().history

    if (keyword) {
      const lower = keyword.toLowerCase()
      results = results.filter(r => r.fileName.toLowerCase().includes(lower))
    }

    if (provider) {
      results = results.filter(r => r.modelProvider === provider)
    }

    return results
  },
}))
