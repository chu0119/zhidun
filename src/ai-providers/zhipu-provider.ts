// 智谱 AI (GLM) 提供商

import axios from 'axios'
import { BaseAIProvider, AIProviderError } from './base'
import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class ZhipuProvider extends BaseAIProvider {
  providerName = 'zhipu'

  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
    })
  }

  async chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const allMessages: { role: string; content: string }[] = []
      if (systemPrompt) {
        allMessages.push({ role: 'system', content: systemPrompt })
      }
      for (const msg of messages) {
        allMessages.push({ role: msg.role, content: msg.content })
      }

      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model: this.config.modelName || 'glm-4-flash',
          messages: allMessages,
          temperature: this.config.temperature || 0.6,
          max_tokens: this.config.maxTokens || 4096,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: (this.config.timeout || 600) * 1000,
          signal,
        }
      )

      const choice = response.data?.choices?.[0]
      if (!choice?.message?.content) {
        throw new AIProviderError('智谱 AI 返回空响应')
      }

      return {
        content: choice.message.content,
        model: response.data?.model || this.config.modelName,
        usage: response.data?.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        } : undefined,
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) throw error
      throw new AIProviderError(`智谱 AI API 错误: ${error.message}`)
    }
  }
}
