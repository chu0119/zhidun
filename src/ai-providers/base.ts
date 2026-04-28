// AI 提供商基类 - 从 Python ai_providers/base.py 移植

import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class AIProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIProviderError'
  }
}

export abstract class BaseAIProvider {
  config: AIModelConfig
  providerName: string = 'base'
  description: string = '基础 AI 提供商'

  constructor(config: AIModelConfig) {
    this.config = config
  }

  abstract chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse>

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.chatCompletion(
        [{ role: 'user', content: 'Hello, please respond with OK.' }],
        'You are a test assistant. Respond briefly.'
      )
      return { success: true, message: `连接成功: ${response.model}` }
    } catch (error: any) {
      return { success: false, message: `连接失败: ${error.message}` }
    }
  }

  validateConfig(): { valid: boolean; message: string } {
    if (!this.config.modelName) {
      return { valid: false, message: '模型名称不能为空' }
    }
    return { valid: true, message: '' }
  }
}
