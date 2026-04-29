// 高级搜索面板

import React, { useState, useCallback, useMemo } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { searchLines, SearchQuery, FieldFilter, SearchResult, PRESET_SEARCHES } from '@/core/search-engine'

export function SearchPanel() {
  const logLines = useAnalysisStore(s => s.logLines)

  const [query, setQuery] = useState<SearchQuery>({
    text: '',
    isRegex: false,
    caseSensitive: false,
    fields: [],
    ipWhitelist: [],
    ipBlacklist: [],
  })
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [whitelistText, setWhitelistText] = useState('')
  const [blacklistText, setBlacklistText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100

  const handleSearch = useCallback(() => {
    if (logLines.length === 0) return

    const finalQuery: SearchQuery = {
      ...query,
      ipWhitelist: whitelistText.split('\n').map(s => s.trim()).filter(Boolean),
      ipBlacklist: blacklistText.split('\n').map(s => s.trim()).filter(Boolean),
    }

    const searchResults = searchLines(logLines, finalQuery)
    setResults(searchResults)
    setHasSearched(true)
    setCurrentPage(1)
  }, [logLines, query, whitelistText, blacklistText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  const handlePreset = useCallback((preset: typeof PRESET_SEARCHES[0]) => {
    setQuery(preset.query)
    setWhitelistText(preset.query.ipWhitelist.join('\n'))
    setBlacklistText(preset.query.ipBlacklist.join('\n'))
  }, [])

  const addFieldFilter = useCallback(() => {
    setQuery(q => ({
      ...q,
      fields: [...q.fields, { field: 'ip', value: '', operator: 'contains' }],
    }))
  }, [])

  const updateFieldFilter = useCallback((index: number, updates: Partial<FieldFilter>) => {
    setQuery(q => ({
      ...q,
      fields: q.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
    }))
  }, [])

  const removeFieldFilter = useCallback((index: number) => {
    setQuery(q => ({
      ...q,
      fields: q.fields.filter((_, i) => i !== index),
    }))
  }, [])

  // 分页
  const totalPages = Math.ceil(results.length / pageSize)
  const pagedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return results.slice(start, start + pageSize)
  }, [results, currentPage])

  const highlightLine = (line: string, highlights: { start: number; end: number }[]) => {
    if (highlights.length === 0) return <span>{line}</span>

    const parts: React.ReactNode[] = []
    let lastEnd = 0
    for (const h of highlights) {
      if (h.start > lastEnd) {
        parts.push(<span key={`t-${lastEnd}`}>{line.substring(lastEnd, h.start)}</span>)
      }
      parts.push(
        <span key={`h-${h.start}`} className="bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] px-0.5 rounded">
          {line.substring(h.start, h.end)}
        </span>
      )
      lastEnd = h.end
    }
    if (lastEnd < line.length) {
      parts.push(<span key={`e-${lastEnd}`}>{line.substring(lastEnd)}</span>)
    }
    return <>{parts}</>
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="text-sm font-orbitron text-[var(--accent-primary)] tracking-wider shrink-0">
        高级搜索
      </div>

      {/* 搜索输入 */}
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          value={query.text}
          onChange={e => setQuery(q => ({ ...q, text: e.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder="搜索关键词或正则表达式..."
          className="neon-input flex-1 text-sm"
        />
        <button onClick={handleSearch} className="neon-btn primary px-4">
          搜索
        </button>
      </div>

      {/* 选项 */}
      <div className="flex items-center gap-4 shrink-0">
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
          <input type="checkbox" checked={query.isRegex}
            onChange={e => setQuery(q => ({ ...q, isRegex: e.target.checked }))}
            className="accent-[var(--accent-primary)]" />
          正则表达式
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
          <input type="checkbox" checked={query.caseSensitive}
            onChange={e => setQuery(q => ({ ...q, caseSensitive: e.target.checked }))}
            className="accent-[var(--accent-primary)]" />
          区分大小写
        </label>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-[var(--accent-primary)] hover:underline">
          {showAdvanced ? '收起高级选项' : '展开高级选项'}
        </button>
      </div>

      {/* 预置搜索 */}
      <div className="flex gap-2 flex-wrap shrink-0">
        {PRESET_SEARCHES.map(preset => (
          <button key={preset.id}
            onClick={() => handlePreset(preset)}
            className="text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-colors">
            {preset.name}
          </button>
        ))}
      </div>

      {/* 高级选项 */}
      {showAdvanced && (
        <div className="glass-card p-4 space-y-3 shrink-0">
          {/* 字段过滤 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-orbitron text-[var(--accent-primary)]">字段过滤</span>
              <button onClick={addFieldFilter} className="text-xs text-[var(--accent-primary)] hover:underline">
                + 添加条件
              </button>
            </div>
            {query.fields.map((field, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={field.field}
                  onChange={e => updateFieldFilter(i, { field: e.target.value as FieldFilter['field'] })}
                  className="neon-select text-xs py-1 w-24">
                  <option value="ip">IP</option>
                  <option value="url">URL</option>
                  <option value="method">方法</option>
                  <option value="status">状态码</option>
                  <option value="ua">UA</option>
                </select>
                <select value={field.operator}
                  onChange={e => updateFieldFilter(i, { operator: e.target.value as FieldFilter['operator'] })}
                  className="neon-select text-xs py-1 w-28">
                  <option value="contains">包含</option>
                  <option value="equals">等于</option>
                  <option value="notContains">不包含</option>
                  <option value="startsWith">开头是</option>
                  <option value="regex">正则</option>
                </select>
                <input type="text" value={field.value}
                  onChange={e => updateFieldFilter(i, { value: e.target.value })}
                  placeholder="值"
                  className="neon-input flex-1 text-xs py-1" />
                <button onClick={() => removeFieldFilter(i)}
                  className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded">删除</button>
              </div>
            ))}
          </div>

          {/* IP 黑白名单 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-[var(--text-secondary)] mb-1 block">IP 白名单（每行一个）</span>
              <textarea
                value={whitelistText}
                onChange={e => setWhitelistText(e.target.value)}
                placeholder="192.168.1.0/24&#10;10.0.0.1"
                className="neon-input w-full text-xs h-20 resize-none"
              />
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)] mb-1 block">IP 黑名单（每行一个）</span>
              <textarea
                value={blacklistText}
                onChange={e => setBlacklistText(e.target.value)}
                placeholder="1.2.3.4&#10;5.6.7.0/24"
                className="neon-input w-full text-xs h-20 resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 结果统计 */}
      {hasSearched && (
        <div className="flex items-center justify-between shrink-0">
          <span className="text-xs text-[var(--text-dim)]">
            找到 <span className="text-[var(--accent-primary)] font-mono">{results.length}</span> 条匹配
            {logLines.length > 0 && <span>（共 {logLines.length.toLocaleString()} 行）</span>}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-0.5 rounded hover:bg-white/10 disabled:opacity-30">上一页</button>
              <span className="font-mono">{currentPage}/{totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-0.5 rounded hover:bg-white/10 disabled:opacity-30">下一页</button>
            </div>
          )}
        </div>
      )}

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] p-2">
        {!hasSearched ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            {logLines.length === 0 ? '请先加载日志文件' : '输入关键词开始搜索'}
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            未找到匹配结果
          </div>
        ) : (
          <div className="font-mono text-xs">
            {pagedResults.map((r, i) => (
              <div key={`${r.lineNumber}-${i}`}
                className="py-0.5 px-2 rounded hover:bg-white/3 flex">
                <span className="text-[var(--text-dim)] select-none w-16 text-right mr-3 shrink-0">
                  {r.lineNumber}
                </span>
                <span className="text-[var(--text-secondary)] break-all">
                  {highlightLine(r.line, r.highlights)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
