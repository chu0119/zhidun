// AI 提供商类型定义

export interface AIModelConfig {
  provider: string
  modelName: string
  apiKey?: string
  baseUrl?: string
  temperature: number
  maxTokens: number
  timeout: number
}

export interface AIResponse {
  content: string
  model: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ProviderName =
  | 'lm_studio'
  | 'ollama'
  | 'deepseek'
  | 'qwen'
  | 'wenxin'
  | 'zhipu'
  | 'kimi'
  | 'openai'
  | 'custom'

export interface ProviderInfo {
  name: ProviderName
  label: string
  description: string
  defaultBaseUrl: string
  defaultModel: string
  requiresApiKey: boolean
}
