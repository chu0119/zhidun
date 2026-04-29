// 分析日志面板

import React, { useEffect, useRef } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'

interface AnalysisPanelProps {
  mode: 'ai' | 'local'
}

export function AnalysisPanel({ mode }: AnalysisPanelProps) {
  const progressMessages = useAnalysisStore(
    s => mode === 'ai' ? s.progressMessages : s.localProgressMessages
  )
  const status = useAnalysisStore(
    s => mode === 'ai' ? s.status : s.preprocessStatus
  )
  const error = useAnalysisStore(s => mode === 'ai' ? s.error : null)
  const thinkingContent = useAnalysisStore(s => mode === 'ai' ? s.thinkingContent : '')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showThinking, setShowThinking] = React.useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progressMessages])

  const isPhaseTitle = (msg: string) =>
    msg.includes('>>>') || msg.startsWith('[阶段') || msg.startsWith('---')

  return (
    <div className="h-full flex flex-col" style={{ zoom: `var(--font-${mode === 'ai' ? 'analysis' : 'analysis'}-scale, 1)` }}>
      {/* AI 思考过程 (仅 AI 模式) */}
      {mode === 'ai' && thinkingContent && (
        <div className="mb-3">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-2 text-xs text-[var(--accent-purple)] hover:text-[var(--accent-primary)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.5"
              style={{ transform: showThinking ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              <polyline points="4 2 8 6 4 10" />
            </svg>
            AI 思考过程
          </button>
          {showThinking && (
            <div className="mt-2 p-3 bg-[var(--accent-purple)]/5 border border-[var(--accent-purple)]/20 rounded-lg
              text-xs text-[var(--text-secondary)] font-mono max-h-40 overflow-y-auto animate-slide-up-fade">
              {thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* 终端输出 */}
      <div className="terminal-output flex-1 overflow-y-auto">
        {progressMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            <div className="text-center animate-slide-up-fade">
              <div className="text-4xl mb-4 opacity-20">{mode === 'ai' ? '⚡' : '◆'}</div>
              <div>{mode === 'ai' ? '选择日志文件并开始 AI 分析' : '选择日志文件并开始本地规则分析'}</div>
              <div className="text-xs mt-2">Ctrl+O 打开文件</div>
            </div>
          </div>
        ) : (
          <>
            {progressMessages.map((msg, i) => {
              let className = ''
              let extraStyle = ''

              if (isPhaseTitle(msg)) {
                className = 'phase-title'
                extraStyle = 'animate-type-expand'
              } else if (msg.includes('错误') || msg.includes('失败')) {
                className = 'error-msg'
              } else if (msg.includes('完成') || msg.includes('通过')) {
                className = 'success-msg'
              } else if (msg.includes('正在') || msg.includes('准备') || msg.includes('扫描中')) {
                className = 'phase-title'
              } else if (msg.startsWith('  ├') || msg.startsWith('  └')) {
                className = 'info-msg'
                extraStyle = 'pl-4'
              } else {
                className = 'info-msg'
              }

              return (
                <div key={i}
                  className={`${className} ${extraStyle} animate-fade-in`}
                  style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s`, animationFillMode: 'both' }}>
                  {msg}
                </div>
              )
            })}
            {status === 'error' && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  分析失败
                </div>
                {error && <div className="text-xs text-red-300/80">{error}</div>}
              </div>
            )}
            {(status === 'analyzing' || status === 'preparing') && (
              <div className="flex items-center gap-3 mt-2">
                <div className="relative w-4 h-4">
                  <div className="absolute inset-0 rounded-full bg-[var(--accent-primary)] animate-pulse-ring" />
                  <div className="absolute inset-1 rounded-full bg-[var(--accent-primary)]" />
                </div>
                <span className="text-[var(--text-dim)]">
                  {status === 'preparing' ? '正在准备...' : '等待 AI 响应...'}
                </span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
