// AI 助手面板 - 简化版聊天界面，折叠式模型选择

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useConfigStore } from '@/stores/config-store'
import { useAnalysisStore } from '@/stores/analysis-store'
import { createAIProvider } from '@/ai-providers'
import { PROVIDER_INFO } from '@/core/constants'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export function AIAssistantPanel() {
  const { config, updateModel } = useConfigStore()
  const store = useAnalysisStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showModelConfig, setShowModelConfig] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const provider = createAIProvider({
        provider: config.currentModel.provider,
        modelName: config.currentModel.modelName,
        apiKey: config.currentModel.apiKey,
        baseUrl: config.currentModel.baseUrl,
        temperature: config.currentModel.temperature,
        maxTokens: config.currentModel.maxTokens,
        timeout: 120,
      })

      // 构建上下文
      let context = ''
      if (store.localReportText) {
        context = `\n\n当前分析报告摘要:\n${store.localReportText.slice(0, 2000)}`
      }

      const prompt = `你是一个网络安全日志分析专家。请简洁地回答以下问题。${context}\n\n用户问题: ${userMessage.content}`

      const response = await provider.chatCompletion([
        { role: 'user', content: prompt },
      ], '你是星川智盾 AI 助手，专注于网络安全日志分析。回答要简洁、专业。')

      const assistantMessage: Message = {
        role: 'assistant',
        content: response?.content || '抱歉，未能获取到有效回答。',
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `错误: ${error.message}`,
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, config, store])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentProvider = PROVIDER_INFO.find(p => p.name === config.currentModel.provider)

  return (
    <div className="h-full flex flex-col">
      {/* 模型配置（折叠式） */}
      <div className="shrink-0 border-b border-[var(--border-color)]">
        <button onClick={() => setShowModelConfig(!showModelConfig)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/5">
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            模型: {currentProvider?.label || config.currentModel.provider} / {config.currentModel.modelName}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform ${showModelConfig ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showModelConfig && (
          <div className="px-4 pb-3 space-y-2">
            <select value={config.currentModel.provider}
              onChange={(e) => {
                const provider = PROVIDER_INFO.find(p => p.name === e.target.value)
                if (provider) updateModel({ provider: provider.name, modelName: provider.defaultModel, baseUrl: provider.defaultBaseUrl })
              }}
              className="neon-select w-full text-xs">
              {PROVIDER_INFO.map(p => (
                <option key={p.name} value={p.name}>{p.label}</option>
              ))}
            </select>
            <input type="text" value={config.currentModel.modelName}
              onChange={(e) => updateModel({ modelName: e.target.value })}
              placeholder="模型名称" className="neon-input w-full text-xs" />
            {currentProvider?.requiresApiKey && (
              <input type="password" value={config.currentModel.apiKey || ''}
                onChange={(e) => updateModel({ apiKey: e.target.value })}
                placeholder="API Key" className="neon-input w-full text-xs" />
            )}
            <input type="text" value={config.currentModel.baseUrl || ''}
              onChange={(e) => updateModel({ baseUrl: e.target.value })}
              placeholder="API 地址" className="neon-input w-full text-xs" />
          </div>
        )}
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-dim)]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mb-3 opacity-50">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="text-sm">AI 安全分析助手</div>
            <div className="text-xs mt-1">输入问题开始对话</div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {['分析当前日志的安全风险', '解释最近的攻击模式', '推荐防护措施'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-[var(--accent-primary)]/20 text-[var(--text-primary)]'
                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="text-[10px] text-[var(--text-dim)] mt-1">{msg.timestamp}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-dim)]">
              <span className="animate-pulse">思考中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 p-3 border-t border-[var(--border-color)]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题... (Enter 发送)"
            rows={2}
            className="neon-input flex-1 text-sm resize-none"
          />
          <button onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="neon-btn primary self-end px-4 disabled:opacity-30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
