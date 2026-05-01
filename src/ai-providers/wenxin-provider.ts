// 文心一言提供商

import axios from 'axios'
import { BaseAIProvider, AIProviderError } from './base'
import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class WenxinProvider extends BaseAIProvider {
  providerName = 'wenxin'
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://qianfan.baidubce.com/v2',
    })
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    // API Key 格式: CLIENT_ID|CLIENT_SECRET
    const parts = (this.config.apiKey || '').split('|')
    if (parts.length !== 2) {
      throw new AIProviderError('文心一言 API Key 格式应为 CLIENT_ID|CLIENT_SECRET')
    }

    const [clientId, clientSecret] = parts
    const response = await axios.get(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
    )

    this.accessToken = response.data.access_token
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000
    return this.accessToken!
  }

  async chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const token = await this.getAccessToken()

      const allMessages: { role: string; content: string }[] = []
      if (systemPrompt) {
        allMessages.push({ role: 'user', content: systemPrompt })
        allMessages.push({ role: 'assistant', content: '好的，我理解了。请提供日志数据。' })
      }
      for (const msg of messages) {
        allMessages.push({ role: msg.role === 'system' ? 'user' : msg.role, content: msg.content })
      }

      const model = this.config.modelName || 'ernie-5.0'
      const response = await axios.post(
        `${this.config.baseUrl}/chat/completions`,
        {
          model,
          messages: allMessages,
          temperature: this.config.temperature || 0.6,
          max_tokens: this.config.maxTokens || 4096,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: (this.config.timeout || 600) * 1000,
          signal,
        }
      )

      const choice = response.data?.choices?.[0]
      if (!choice?.message?.content) {
        throw new AIProviderError('文心一言返回空响应')
      }

      return {
        content: choice.message.content,
        model: response.data?.model || model,
        usage: response.data?.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        } : undefined,
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) throw error
      throw new AIProviderError(`文心一言 API 错误: ${error.message}`)
    }
  }
}
