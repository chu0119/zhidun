// 配置状态管理

import { create } from 'zustand'
import type { AppConfig, ModelConfig } from '@/types/config'
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_API_ENDPOINTS, DEFAULT_MODEL_NAMES } from '@/core/constants'

interface ConfigState {
  config: AppConfig
  loaded: boolean
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<void>
  updateModel: (model: Partial<ModelConfig>) => void
  updateConfig: (partial: Partial<AppConfig>) => void
  exportConfig: (filePath: string) => Promise<boolean>
  importConfig: (filePath: string) => Promise<boolean>
}

const DEFAULT_CONFIG: AppConfig = {
  currentModel: {
    provider: 'lm_studio',
    modelName: 'local-model',
    baseUrl: 'http://localhost:1234/v1',
    apiKey: '',
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  defaultLines: 1000,
  autoSave: true,
  theme: 'cyber',
  cyberTheme: 'cyber',
  fontSize: 13,
  fontSizes: {
    menu: 13,
    analysis: 13,
    report: 14,
    charts: 12,
  },
  windowWidth: 1400,
  windowHeight: 900,
  showWelcome: true,
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  loaded: false,

  loadConfig: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const configPath = `${appPath}/config/app_config.json`
      const result = await window.electronAPI.readFile(configPath)

      if (result.success && result.data) {
        const json = atob(result.data)
        const data = JSON.parse(json)
        if (data.version === '1.0' && data.config) {
          const loaded = data.config
          // Deep merge fontSizes
          if (loaded.fontSizes) {
            loaded.fontSizes = { ...DEFAULT_CONFIG.fontSizes, ...loaded.fontSizes }
          }
          set({ config: { ...DEFAULT_CONFIG, ...loaded }, loaded: true })
          return
        }
      }
    } catch {}

    // 使用默认配置
    set({ config: DEFAULT_CONFIG, loaded: true })
    get().saveConfig()
  },

  saveConfig: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const configPath = `${appPath}/config/app_config.json`
      const data = JSON.stringify({ version: '1.0', config: get().config }, null, 2)
      await window.electronAPI.writeFile(configPath, data)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  },

  updateModel: (partial) => {
    set(state => ({
      config: {
        ...state.config,
        currentModel: { ...state.config.currentModel, ...partial },
      },
    }))
    if (get().config.autoSave) get().saveConfig()
  },

  updateConfig: (partial) => {
    set(state => ({ config: { ...state.config, ...partial } }))
    if (get().config.autoSave) get().saveConfig()
  },

  exportConfig: async (filePath) => {
    try {
      const data = JSON.stringify({ version: '1.0', config: get().config }, null, 2)
      const result = await window.electronAPI.writeFile(filePath, data)
      return result.success
    } catch {
      return false
    }
  },

  importConfig: async (filePath) => {
    try {
      const result = await window.electronAPI.readFile(filePath)
      if (!result.success || !result.data) return false
      const json = atob(result.data)
      const data = JSON.parse(json)
      if (data.config) {
        set({ config: { ...DEFAULT_CONFIG, ...data.config } })
        get().saveConfig()
        return true
      }
      return false
    } catch {
      return false
    }
  },
}))
