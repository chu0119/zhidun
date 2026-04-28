// AI 提供商工厂

import { OpenAIProvider, LMStudioProvider } from './openai-provider'
import { DeepSeekProvider } from './deepseek-provider'
import { OllamaProvider } from './ollama-provider'
import { QwenProvider } from './qwen-provider'
import { WenxinProvider } from './wenxin-provider'
import { ZhipuProvider } from './zhipu-provider'
import { KimiProvider } from './kimi-provider'
import { CustomProvider } from './custom-provider'
import { BaseAIProvider } from './base'
import type { AIModelConfig } from '@/types/ai-provider'

export function createAIProvider(config: AIModelConfig): BaseAIProvider {
  switch (config.provider) {
    case 'lm_studio':
      return new LMStudioProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    case 'deepseek':
      return new DeepSeekProvider(config)
    case 'qwen':
      return new QwenProvider(config)
    case 'wenxin':
      return new WenxinProvider(config)
    case 'zhipu':
      return new ZhipuProvider(config)
    case 'kimi':
      return new KimiProvider(config)
    case 'custom':
      return new CustomProvider(config)
    default:
      return new OpenAIProvider(config)
  }
}

export {
  OpenAIProvider,
  LMStudioProvider,
  DeepSeekProvider,
  OllamaProvider,
  QwenProvider,
  WenxinProvider,
  ZhipuProvider,
  KimiProvider,
  CustomProvider,
  BaseAIProvider,
}
