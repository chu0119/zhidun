// 配置类型

import type { PreprocessConfig } from '@/core/preprocessor'
import type { NotificationConfig, RealtimeNotificationConfig } from '@/core/notification-engine'
import type { RiskLevel } from '@/types/analysis'

export interface RuleEngineConfig {
  enabledRuleIds: string[]
  disabledRuleIds: string[]
  categoryWhitelist: string[]
  categoryBlacklist: string[]
  severityThreshold: RiskLevel
  attackChainWindow: number
  useAnalysisCache: boolean
}

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
  cyberTheme: string
  fontSize: number
  fontSizes: FontSizes
  windowWidth: number
  windowHeight: number
  showWelcome: boolean
  diagnosticsEnabled?: boolean
  preprocessConfig?: PreprocessConfig
  notificationConfig?: NotificationConfig
  realtimeNotificationConfig?: RealtimeNotificationConfig
  ruleEngineConfig?: RuleEngineConfig
}

export interface ConfigFile {
  version: string
  config: AppConfig
}
