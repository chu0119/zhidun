// 配置类型

import type { PreprocessConfig } from '@/core/preprocessor'
import type { NotificationConfig } from '@/core/notification-engine'

export interface ModelConfig {
  provider: string
  modelName: string
  apiKey?: string
  baseUrl?: string
  temperature: number
  maxTokens: number
}

export interface FontSizes {
  menu: number
  analysis: number
  report: number
  charts: number
  panels: number
}

export interface AppConfig {
  currentModel: ModelConfig
  defaultLines: number
  autoSave: boolean
  theme: string
  cyberTheme: string
  fontSize: number
  fontSizes: FontSizes
  windowWidth: number
  windowHeight: number
  showWelcome: boolean
  preprocessConfig?: PreprocessConfig
  notificationConfig?: NotificationConfig
}

export interface ConfigFile {
  version: string
  config: AppConfig
}
