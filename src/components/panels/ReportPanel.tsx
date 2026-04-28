// 详细报告面板

import React, { useState, useRef } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'

interface ReportPanelProps {
  mode: 'ai' | 'local'
}

export function ReportPanel({ mode }: ReportPanelProps) {
  const reportText = useAnalysisStore(
    s => mode === 'ai' ? s.reportText : s.localReportText
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleSearch = (direction: 'next' | 'prev') => {
    if (!searchQuery || !contentRef.current) return

    const container = contentRef.current
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let node: Text | null

    container.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    while ((node = walker.nextNode() as Text | null)) {
      const idx = (node.textContent || '').indexOf(searchQuery)
      if (idx >= 0) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + searchQuery.length)
        const span = document.createElement('span')
        span.className = 'search-highlight'
        span.style.cssText = 'background: rgba(0,240,255,0.3); color: #fff; border-radius: 2px; padding: 0 2px;'
        range.surroundContents(span)
        span.scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
      }
    }
  }

  // Ctrl+F 搜索快捷键
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchVisible(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const renderReport = (text: string) => {
    if (!text) return null

    const lines = text.split('\n')
    return lines.map((line, i) => {
      const stripped = line.trim()
      if (!stripped) return <div key={i} className="h-2" />

      // 主标题
      if (stripped.startsWith('【') && stripped.endsWith('】')) {
        const title = stripped.slice(1, -1)
        return (
          <div key={i} className="my-6 animate-slide-up-fade">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />
              <h2 className="font-orbitron font-bold text-[var(--accent-primary)] tracking-wider"
                style={{ textShadow: '0 0 15px var(--glow-color)', fontSize: '1.3em' }}>
                {title}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />
            </div>
          </div>
        )
      }

      // 数字标题
      const titleMatch = stripped.match(/^(\d+)\.\s+(.+)/)
      if (titleMatch) {
        const title = titleMatch[2].replace(/\*\*/g, '')
        return (
          <h3 key={i} className="mt-5 mb-2 flex items-center gap-2 animate-slide-up-fade">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
              bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30
              font-orbitron font-bold text-[var(--accent-primary)]"
              style={{ fontSize: '0.75em' }}>
              {titleMatch[1]}
            </span>
            <span className="font-bold text-[var(--text-primary)]" style={{ fontSize: '1.1em' }}>{title}</span>
          </h3>
        )
      }

      // 风险等级标签
      const riskMatch = stripped.match(/(危急|高危|中危|低危)/)
      if (riskMatch) {
        const levelMap: Record<string, string> = {
          '危急': 'critical', '高危': 'high', '中危': 'medium', '低危': 'low'
        }
        const parts = stripped.split(/(危急|高危|中危|低危)/)
        return (
          <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
            {parts.map((part, j) => {
              if (['危急', '高危', '中危', '低危'].includes(part)) {
                return <span key={j} className={`risk-tag ${levelMap[part]}`}>{part}</span>
              }
              return <span key={j}>{part.replace(/\*\*/g, '')}</span>
            })}
          </div>
        )
      }

      // 子项
      if (stripped.startsWith('•') || stripped.startsWith('-')) {
        const content = stripped.slice(1).trim().replace(/\*\*/g, '')
        return (
          <div key={i} className="text-[var(--text-secondary)] pl-6 leading-7 animate-fade-in">
            <span className="text-[var(--accent-cyan)] mr-2">▸</span>
            {content}
          </div>
        )
      }

      // 缩进项
      if (stripped.startsWith('  -') || stripped.includes('└─') || stripped.startsWith('  ├')) {
        const content = stripped.replace(/^\s*[-└├│]\s*/, '').replace(/\*\*/g, '')
        return (
          <div key={i} className="text-[var(--text-dim)] pl-10 leading-6 animate-fade-in">
            <span className="text-[var(--accent-purple)] mr-2">└</span>
            {content}
          </div>
        )
      }

      // 普通文本
      return (
        <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
          {stripped.replace(/\*\*/g, '')}
        </div>
      )
    })
  }

  const emptyIcon = mode === 'ai' ? '📋' : '◆'
  const emptyText = mode === 'ai' ? 'AI 分析完成后将在此显示详细报告' : '本地规则分析完成后将在此显示报告'

  return (
    <div className="h-full flex flex-col" style={{ zoom: 'var(--font-report-scale, 1)' }}>
      {/* 搜索工具栏 */}
      {searchVisible && (
        <div className="flex items-center gap-2 mb-3 p-2 glass-card animate-slide-up-fade">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch('next')
              if (e.key === 'Escape') setSearchVisible(false)
            }}
            placeholder="搜索报告内容..."
            className="neon-input flex-1 text-sm py-1.5"
            autoFocus
          />
          <button onClick={() => handleSearch('prev')} className="neon-btn text-xs px-3 py-1.5">▲</button>
          <button onClick={() => handleSearch('next')} className="neon-btn text-xs px-3 py-1.5">▼</button>
          <button onClick={() => setSearchVisible(false)} className="neon-btn text-xs px-3 py-1.5">✕</button>
        </div>
      )}

      {/* 报告内容 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pr-2">
        {!reportText ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            <div className="text-center animate-slide-up-fade">
              <div className="text-4xl mb-4 opacity-20">{emptyIcon}</div>
              <div>{emptyText}</div>
              <div className="text-xs mt-2">Ctrl+F 搜索报告内容</div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up-fade">
            {renderReport(reportText)}
          </div>
        )}
      </div>
    </div>
  )
}
