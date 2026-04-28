// 自定义 OpenAI 兼容提供商

import { OpenAIProvider } from './openai-provider'
import type { AIModelConfig } from '@/types/ai-provider'

export class CustomProvider extends OpenAIProvider {
  providerName = 'custom'

  constructor(config: AIModelConfig) {
    super(config)
  }
}
