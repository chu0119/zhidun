// OpenAI / LM Studio 提供商

import OpenAI from 'openai'
import { BaseAIProvider, AIProviderError } from './base'
import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class OpenAIProvider extends BaseAIProvider {
  providerName = 'openai'
  private client: OpenAI | null = null

  constructor(config: AIModelConfig) {
    super(config)
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey || '',
        baseURL: this.config.baseUrl || 'https://api.openai.com/v1',
        timeout: (this.config.timeout || 600) * 1000,
        dangerouslyAllowBrowser: true,
      })
    }
    return this.client
  }

  async chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const client = this.getClient()

      const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
      if (systemPrompt) {
        allMessages.push({ role: 'system', content: systemPrompt })
      }
      for (const msg of messages) {
        allMessages.push({ role: msg.role, content: msg.content })
      }

      const response = await client.chat.completions.create({
        model: this.config.modelName,
        messages: allMessages,
        temperature: this.config.temperature || 0.6,
        max_tokens: this.config.maxTokens || 4096,
      }, { signal })

      const choice = response.choices[0]
      if (!choice?.message?.content) {
        throw new AIProviderError('AI 返回空响应')
      }

      return {
        content: choice.message.content,
        model: response.model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) throw error
      throw new AIProviderError(`OpenAI API 错误: ${error.message}`)
    }
  }
}

// LM Studio (使用 OpenAI 兼容接口)
export class LMStudioProvider extends OpenAIProvider {
  providerName = 'lm_studio'

  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:1234/v1',
      apiKey: config.apiKey || 'lm-studio',
    })
  }
}
