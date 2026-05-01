// Anthropic (Claude) 提供商

import axios from 'axios'
import { BaseAIProvider, AIProviderError } from './base'
import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class AnthropicProvider extends BaseAIProvider {
  providerName = 'anthropic'

  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
    })
  }

  async chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const anthropicMessages: { role: string; content: string }[] = []
      for (const msg of messages) {
        if (msg.role !== 'system') {
          anthropicMessages.push({ role: msg.role, content: msg.content })
        }
      }

      const body: Record<string, any> = {
        model: this.config.modelName || 'claude-sonnet-4-6',
        messages: anthropicMessages,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.6,
      }
      if (systemPrompt) {
        body.system = systemPrompt
      }

      const response = await axios.post(
        `${this.config.baseUrl}/v1/messages`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: (this.config.timeout || 600) * 1000,
          signal,
        }
      )

      const content = response.data?.content?.[0]?.text
      if (!content) {
        throw new AIProviderError('Anthropic 返回空响应')
      }

      return {
        content,
        model: response.data?.model || this.config.modelName,
        usage: response.data?.usage ? {
          promptTokens: response.data.usage.input_tokens,
          completionTokens: response.data.usage.output_tokens,
          totalTokens: (response.data.usage.input_tokens || 0) + (response.data.usage.output_tokens || 0),
        } : undefined,
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) throw error
      throw new AIProviderError(`Anthropic API 错误: ${error.message}`)
    }
  }
}
