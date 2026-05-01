// AI 提供商工厂

import { OpenAIProvider, LMStudioProvider } from './openai-provider'
import { AnthropicProvider } from './anthropic-provider'
import { GeminiProvider } from './gemini-provider'
import { DeepSeekProvider } from './deepseek-provider'
import { OllamaProvider } from './ollama-provider'
import { QwenProvider } from './qwen-provider'
import { WenxinProvider } from './wenxin-provider'
import { ZhipuProvider } from './zhipu-provider'
import { KimiProvider } from './kimi-provider'
import { SiliconFlowProvider } from './siliconflow-provider'
import { MistralProvider } from './mistral-provider'
import { XAIProvider } from './xai-provider'
import { CustomProvider } from './custom-provider'
import { BaseAIProvider } from './base'
import type { AIModelConfig } from '@/types/ai-provider'

export function createAIProvider(config: AIModelConfig): BaseAIProvider {
  switch (config.provider) {
    case 'lm_studio':
      return new LMStudioProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    case 'openai':
      return new OpenAIProvider(config)
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'gemini':
      return new GeminiProvider(config)
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
    case 'siliconflow':
      return new SiliconFlowProvider(config)
    case 'mistral':
      return new MistralProvider(config)
    case 'xai':
      return new XAIProvider(config)
    case 'custom':
      return new CustomProvider(config)
    default:
      return new OpenAIProvider(config)
  }
}

export {
  OpenAIProvider,
  LMStudioProvider,
  AnthropicProvider,
  GeminiProvider,
  DeepSeekProvider,
  OllamaProvider,
  QwenProvider,
  WenxinProvider,
  ZhipuProvider,
  KimiProvider,
  SiliconFlowProvider,
  MistralProvider,
  XAIProvider,
  CustomProvider,
  BaseAIProvider,
}
