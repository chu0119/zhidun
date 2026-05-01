// 配置状态管理

import { create } from 'zustand'
import type { AppConfig, ModelConfig } from '@/types/config'
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_API_ENDPOINTS, DEFAULT_MODEL_NAMES } from '@/core/constants'
import { encryptApiKey, decryptApiKey } from '@/utils/encryption'

let saveTimer: ReturnType<typeof setTimeout> | null = null

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
  cyberTheme: 'cyber',
  fontSize: 13,
  fontSizes: {
    menu: 13,
    analysis: 13,
    report: 14,
    charts: 12,
    panels: 13,
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
          // Decrypt API key if present
          if (loaded.currentModel?.apiKey) {
            try {
              const machineId = await window.electronAPI.getMachineId()
              const decrypted = await decryptApiKey(loaded.currentModel.apiKey, machineId)
              if (decrypted) {
                loaded.currentModel.apiKey = decrypted
              }
            } catch {
              // Keep the key as-is if decryption fails (may be plaintext)
            }
          }
          set({
            config: {
              ...DEFAULT_CONFIG,
              ...loaded,
              currentModel: { ...DEFAULT_CONFIG.currentModel, ...(loaded.currentModel || {}) },
              fontSizes: { ...DEFAULT_CONFIG.fontSizes, ...(loaded.fontSizes || {}) },
            },
            loaded: true,
          })
          return
        }
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }

    // 使用默认配置
    set({ config: DEFAULT_CONFIG, loaded: true })
    get().saveConfig()
  },

  saveConfig: async () => {
    try {
      const appPath = await window.electronAPI.getAppPath()
      const configPath = `${appPath}/config/app_config.json`
      const configToSave = { ...get().config }
      // Encrypt API key before saving
      if (configToSave.currentModel.apiKey) {
        const machineId = await window.electronAPI.getMachineId()
        configToSave.currentModel = {
          ...configToSave.currentModel,
          apiKey: await encryptApiKey(configToSave.currentModel.apiKey, machineId),
        }
      }
      const data = JSON.stringify({ version: '1.0', config: configToSave }, null, 2)
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
    if (get().config.autoSave) {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => get().saveConfig(), 300)
    }
  },

  updateConfig: (partial) => {
    set(state => ({ config: { ...state.config, ...partial } }))
    if (get().config.autoSave) {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => get().saveConfig(), 300)
    }
  },

  exportConfig: async (filePath) => {
    try {
      const config = { ...get().config }
      // 导出时脱敏 API Key
      if (config.currentModel?.apiKey) {
        config.currentModel = { ...config.currentModel, apiKey: '••••••••' }
      }
      const data = JSON.stringify({ version: '1.0', config }, null, 2)
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
        const imported = { ...DEFAULT_CONFIG, ...data.config }
        if (data.config.fontSizes) {
          imported.fontSizes = { ...DEFAULT_CONFIG.fontSizes, ...data.config.fontSizes }
        }
        set({ config: imported })
        get().saveConfig()
        return true
      }
      return false
    } catch {
      return false
    }
  },
}))
