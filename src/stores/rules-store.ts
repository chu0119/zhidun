// 自定义规则状态管理

import { create } from 'zustand'

export interface CustomRule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  patterns: string[]  // 正则表达式字符串
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface RulesState {
  rules: CustomRule[]
  loaded: boolean
  nextId: number

  // 操作
  loadRules: () => Promise<void>
  saveRules: () => Promise<void>
  addRule: (rule: Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateRule: (id: string, updates: Partial<CustomRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void
  importRules: (json: string) => { success: number; errors: string[] }
  exportRules: () => string
}

export const useRulesStore = create<RulesState>((set, get) => ({
  rules: [],
  loaded: false,
  nextId: 1,

  loadRules: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const rulesPath = `${appPath}/config/custom_rules.json`
      const result = await window.electronAPI.readFile(rulesPath)

      if (result.success && result.data) {
        const json = atob(result.data)
        const data = JSON.parse(json)
        if (Array.isArray(data.rules)) {
          const maxId = Math.max(...data.rules.map((r: CustomRule) => parseInt(r.id.replace('cr-', '')) || 0), 0)
          set({ rules: data.rules, loaded: true, nextId: maxId + 1 })
          return
        }
      }
    } catch (e) {
      console.error('加载自定义规则失败:', e)
    }

    set({ rules: [], loaded: true })
    get().saveRules()
  },

  saveRules: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const rulesPath = `${appPath}/config/custom_rules.json`
      const data = JSON.stringify({ version: '1.0', rules: get().rules }, null, 2)
      await window.electronAPI.writeFile(rulesPath, data)
    } catch (error) {
      console.error('保存自定义规则失败:', error)
    }
  },

  addRule: (rule) => {
    const now = new Date().toISOString()
    const { nextId } = get()
    const newRule: CustomRule = {
      ...rule,
      id: `cr-${nextId}`,
      createdAt: now,
      updatedAt: now,
    }
    set(state => ({ rules: [...state.rules, newRule], nextId: state.nextId + 1 }))
    get().saveRules()
  },

  updateRule: (id, updates) => {
    set(state => ({
      rules: state.rules.map(r =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      ),
    }))
    get().saveRules()
  },

  deleteRule: (id) => {
    set(state => ({ rules: state.rules.filter(r => r.id !== id) }))
    get().saveRules()
  },

  toggleRule: (id) => {
    set(state => ({
      rules: state.rules.map(r =>
        r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
      ),
    }))
    get().saveRules()
  },

  importRules: (json) => {
    const errors: string[] = []
    let success = 0

    try {
      const data = JSON.parse(json)
      const rules = Array.isArray(data) ? data : data.rules || []
      const newRules: CustomRule[] = []

      for (const rule of rules) {
        if (!rule.name || !rule.patterns) {
          errors.push(`跳过无效规则: ${JSON.stringify(rule).substring(0, 50)}`)
          continue
        }
        const patterns = Array.isArray(rule.patterns) ? rule.patterns : [rule.patterns]
        // 验证正则合法性
        const invalidPatterns: string[] = []
        for (const p of patterns) {
          try { new RegExp(p) } catch { invalidPatterns.push(p) }
        }
        if (invalidPatterns.length > 0) {
          errors.push(`规则 "${rule.name}" 含无效正则: ${invalidPatterns.join(', ')}`)
          continue
        }
        const now = new Date().toISOString()
        const { nextId } = get()
        newRules.push({
          id: `cr-${nextId + newRules.length}`,
          name: rule.name,
          category: rule.category || '自定义',
          severity: rule.severity || 'medium',
          description: rule.description || '',
          patterns,
          enabled: rule.enabled !== false,
          createdAt: now,
          updatedAt: now,
        })
        success++
      }

      if (newRules.length > 0) {
        set(state => ({ rules: [...state.rules, ...newRules], nextId: state.nextId + newRules.length }))
        get().saveRules()
      }
    } catch (e: any) {
      errors.push(`JSON 解析失败: ${e.message}`)
    }

    return { success, errors }
  },

  exportRules: () => {
    return JSON.stringify({ version: '1.0', rules: get().rules }, null, 2)
  },
}))
