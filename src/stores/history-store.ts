// 历史记录状态管理

import { create } from 'zustand'
import type { AnalysisHistory, AnalysisSnapshot } from '@/types/analysis'
import { MAX_HISTORY_RECORDS } from '@/core/constants'

interface HistoryState {
  history: AnalysisHistory[]
  loaded: boolean
  loadHistory: () => Promise<void>
  saveHistory: () => Promise<void>
  addRecord: (record: Omit<AnalysisHistory, 'id' | 'timestamp'>, snapshot?: AnalysisSnapshot) => Promise<AnalysisHistory>
  deleteRecord: (id: string) => void
  clearAll: () => void
  searchHistory: (keyword?: string, provider?: string) => AnalysisHistory[]
  saveSnapshot: (id: string, snapshot: AnalysisSnapshot) => Promise<void>
  loadSnapshot: (id: string) => Promise<AnalysisSnapshot | null>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const historyPath = `${appPath}/config/analysis_history.json`
      const result = await window.electronAPI.readTextFile(historyPath)

      if (result.success && result.text) {
        const data = JSON.parse(result.text)
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

  saveSnapshot: async (id: string, snapshot: AnalysisSnapshot) => {
    const appPath = await window.electronAPI.getAppPath()
    const snapshotPath = `${appPath}/snapshots/${id}.json`
    const data = JSON.stringify(snapshot)
    const result = await window.electronAPI.writeFile(snapshotPath, data)
    if (!result.success) {
      throw new Error(result.error || '快照保存失败')
    }
  },

  loadSnapshot: async (id: string) => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const snapshotPath = `${appPath}/snapshots/${id}.json`
      const result = await window.electronAPI.readTextFile(snapshotPath)
      if (result.success && result.text) {
        return JSON.parse(result.text) as AnalysisSnapshot
      }
    } catch (error) {
      console.error('加载快照失败:', error)
    }
    return null
  },

  addRecord: async (record, snapshot) => {
    let hasSnapshot = false
    if (snapshot) {
      try {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await get().saveSnapshot(id, snapshot)
        hasSnapshot = true
        // 保存成功后才创建记录
        const newRecord: AnalysisHistory = {
          ...record,
          id,
          timestamp: new Date().toISOString(),
          hasSnapshot: true,
        }
        set(state => {
          const history = [newRecord, ...state.history].slice(0, MAX_HISTORY_RECORDS)
          return { history }
        })
        get().saveHistory()
        return newRecord
      } catch (error) {
        console.error('保存快照失败，仅保存历史索引:', error)
      }
    }

    // 无快照或快照保存失败
    const newRecord: AnalysisHistory = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      hasSnapshot: false,
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
    // 异步删除快照文件（不阻塞 UI）
    window.electronAPI.getAppPath().then(appPath => {
      window.electronAPI.deleteFile?.(`${appPath}/snapshots/${id}.json`).catch(() => {})
    }).catch(() => {})
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
