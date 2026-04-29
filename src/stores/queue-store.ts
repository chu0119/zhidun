// 批处理队列状态管理

import { create } from 'zustand'
import { RuleAnalysisResult } from '@/core/rule-engine'

export interface QueueItem {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  status: 'pending' | 'analyzing' | 'done' | 'error'
  progress: string
  result?: RuleAnalysisResult
  reportText?: string
  error?: string
  startTime?: number
  endTime?: number
}

interface QueueState {
  items: QueueItem[]
  isRunning: boolean
  mode: 'serial' | 'parallel'
  currentIndex: number

  // 操作
  addItems: (items: Omit<QueueItem, 'id' | 'status' | 'progress'>[]) => void
  removeItem: (id: string) => void
  clearAll: () => void
  setMode: (mode: 'serial' | 'parallel') => void
  startAnalysis: () => void
  stopAnalysis: () => void
  updateItem: (id: string, updates: Partial<QueueItem>) => void
  markDone: (id: string, result: RuleAnalysisResult, reportText: string) => void
  markError: (id: string, error: string) => void
  getNextPending: () => QueueItem | null
  getStats: () => { total: number; done: number; error: number; pending: number; analyzing: number }
}

let nextId = 1

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  isRunning: false,
  mode: 'serial',
  currentIndex: 0,

  addItems: (newItems) => {
    const items = newItems.map(item => ({
      ...item,
      id: `q-${nextId++}`,
      status: 'pending' as const,
      progress: '等待中',
    }))
    set(state => ({ items: [...state.items, ...items] }))
  },

  removeItem: (id) => {
    set(state => ({ items: state.items.filter(i => i.id !== id) }))
  },

  clearAll: () => {
    set({ items: [], isRunning: false, currentIndex: 0 })
  },

  setMode: (mode) => set({ mode }),

  startAnalysis: () => {
    set(state => ({
      isRunning: true,
      currentIndex: 0,
      items: state.items.map(i =>
        i.status === 'error' ? { ...i, status: 'pending' as const, progress: '等待中', error: undefined } : i
      ),
    }))
  },

  stopAnalysis: () => {
    set(state => ({
      isRunning: false,
      items: state.items.map(i =>
        i.status === 'analyzing' ? { ...i, status: 'pending' as const, progress: '已暂停' } : i
      ),
    }))
  },

  updateItem: (id, updates) => {
    set(state => ({
      items: state.items.map(i => i.id === id ? { ...i, ...updates } : i),
    }))
  },

  markDone: (id, result, reportText) => {
    set(state => ({
      items: state.items.map(i =>
        i.id === id ? { ...i, status: 'done', result, reportText, endTime: Date.now(), progress: '完成' } : i
      ),
    }))
  },

  markError: (id, error) => {
    set(state => ({
      items: state.items.map(i =>
        i.id === id ? { ...i, status: 'error', error, endTime: Date.now(), progress: `错误: ${error}` } : i
      ),
    }))
  },

  getNextPending: () => {
    return get().items.find(i => i.status === 'pending') || null
  },

  getStats: () => {
    const items = get().items
    return {
      total: items.length,
      done: items.filter(i => i.status === 'done').length,
      error: items.filter(i => i.status === 'error').length,
      pending: items.filter(i => i.status === 'pending').length,
      analyzing: items.filter(i => i.status === 'analyzing').length,
    }
  },
}))
