// Ollama 提供商

import axios from 'axios'
import { BaseAIProvider, AIProviderError } from './base'
import type { AIModelConfig, AIResponse, AIMessage } from '@/types/ai-provider'

export class OllamaProvider extends BaseAIProvider {
  providerName = 'ollama'

  constructor(config: AIModelConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434',
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
        `${this.config.baseUrl}/api/chat`,
        {
          model: this.config.modelName || 'llama2',
          messages: allMessages,
          stream: false,
          options: {
            temperature: this.config.temperature || 0.6,
            num_predict: this.config.maxTokens || 4096,
          },
        },
        {
          timeout: (this.config.timeout || 600) * 1000,
          signal,
        }
      )

      const content = response.data?.message?.content
      if (!content) {
        throw new AIProviderError('Ollama 返回空响应')
      }

      return {
        content,
        model: response.data?.model || this.config.modelName,
        usage: response.data?.eval_count ? {
          promptTokens: response.data.prompt_eval_count,
          completionTokens: response.data.eval_count,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        } : undefined,
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) throw error
      throw new AIProviderError(`Ollama API 错误: ${error.message}`)
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/api/tags`)
      return (response.data?.models || []).map((m: any) => m.name)
    } catch {
      return []
    }
  }
}
