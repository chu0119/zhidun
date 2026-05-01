// 实时监控面板

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRealtimeStore } from '@/stores/realtime-store'
import { useConfigStore } from '@/stores/config-store'
import { BUILT_IN_RULES } from '@/core/rule-engine'
import { useRealtimeNotifier } from '@/hooks/useRealtimeNotifier'

type MonitorMode = 'local' | 'ssh'

interface SSHConfig {
  host: string
  port: number
  username: string
  password: string
  privateKey: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff2d55',
  high: '#ff9500',
  medium: '#ffcc00',
  low: '#34c759',
  info: '#5ac8fa',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '危急',
  high: '高危',
  medium: '中危',
  low: '低危',
  info: '信息',
}

export function RealtimePanel() {
  // 桥接实时监控→通知引擎
  useRealtimeNotifier()

  const {
    status, monitorId, error, lines, matches, stats,
    sessions, activeSessionId,
    setStatus, setMonitorId, setError,
    addLines, addMatches, updateStats, clear,
    addSession, removeSession, setActiveSession, updateSession,
  } = useRealtimeStore()

  const [mode, setMode] = useState<MonitorMode>('local')
  const [filePath, setFilePath] = useState('')
  const [sshConfig, setSSHConfig] = useState<SSHConfig>({ host: '', port: 22, username: 'root', password: '', privateKey: '' })
  const [testingSSH, setTestingSSH] = useState(false)
  const [sshTestResult, setSSHTestResult] = useState<string | null>(null)
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [duration, setDuration] = useState(0)

  const logContainerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const lineCounterRef = useRef(0)
  const matchSetRef = useRef(new Set<string>())

  const isConnected = status === 'connected'
  const isRunning = status === 'connecting' || status === 'connected'

  // 聚合统计（多文件时合并所有会话）
  const aggregateStats = useMemo(() => {
    if (sessions.length <= 1) return stats
    const agg = {
      totalLines: 0,
      matchedLines: 0,
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      categoryStats: {} as Record<string, number>,
      startTime: stats.startTime,
    }
    for (const s of sessions) {
      agg.totalLines += s.stats.totalLines
      agg.matchedLines += s.stats.matchedLines
      for (const [k, v] of Object.entries(s.stats.summary)) {
        agg.summary[k as keyof typeof agg.summary] += v
      }
      for (const [k, v] of Object.entries(s.stats.categoryStats)) {
        agg.categoryStats[k] = (agg.categoryStats[k] || 0) + v
      }
    }
    return agg
  }, [sessions, stats])

  const displayStats = sessions.length > 1 ? aggregateStats : stats

  // 运行时间定时刷新
  useEffect(() => {
    if (!isConnected || !stats.startTime) return
    const timer = setInterval(() => {
      setDuration(Date.now() - stats.startTime)
    }, 1000)
    return () => clearInterval(timer)
  }, [isConnected, stats.startTime])

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  // 监听实时数据
  const handleData = useCallback((data: { type: string; payload: any }) => {
    switch (data.type) {
      case 'connected':
        setStatus('connected')
        break

      case 'line': {
        const newLines = data.payload.lines.map((text: string) => {
          lineCounterRef.current++
          return {
            text,
            lineNumber: lineCounterRef.current,
            isThreat: false,
          }
        })
        addLines(newLines)
        break
      }

      case 'match': {
        const newMatches = data.payload.matches.filter((m: any) => {
          const key = `${m.ruleId}:${m.lineNumber}`
          if (matchSetRef.current.has(key)) return false
          matchSetRef.current.add(key)
          if (matchSetRef.current.size > 10000) {
            const arr = Array.from(matchSetRef.current)
            matchSetRef.current = new Set(arr.slice(-5000))
          }
          return true
        })
        if (newMatches.length > 0) {
          addMatches(newMatches)
        }
        break
      }

      case 'stats': {
        const { totalLines, matchedLines, summary, categoryStats } = data.payload
        updateStats({ totalLines, matchedLines, summary, categoryStats })
        break
      }

      case 'error':
        setError(data.payload.message)
        break
    }
  }, [])

  useEffect(() => {
    cleanupRef.current = window.electronAPI.onRealtimeData(handleData)
    return () => {
      cleanupRef.current?.()
    }
  }, [handleData])

  // 浏览文件
  const handleBrowseFile = async () => {
    const result = await window.electronAPI.openFile()
    if (result) {
      setFilePath(result)
    }
  }

  // 测试 SSH 连接
  const handleTestSSH = async () => {
    if (!sshConfig.host.trim()) return
    setTestingSSH(true)
    setSSHTestResult(null)
    try {
      const result = await window.electronAPI.realtimeTestSSH({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password || undefined,
        privateKey: sshConfig.privateKey || undefined,
      })
      setSSHTestResult(result.success ? '连接成功' : `连接失败: ${result.error}`)
    } catch (e: any) {
      setSSHTestResult(`错误: ${e.message}`)
    } finally {
      setTestingSSH(false)
    }
  }

  // 开始监控
  const handleStart = async () => {
    if (!filePath.trim() || isRunning) return

    clear()
    lineCounterRef.current = 0
    matchSetRef.current.clear()
    setDuration(0)
    setStatus('connecting')

    const rules = BUILT_IN_RULES.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      severity: r.severity,
      patterns: r.patterns.map(p => p instanceof RegExp ? p.toString() : String(p)),
      description: r.description,
      remediation: r.remediation,
    }))

    const rtConfig = useConfigStore.getState().config.realtimeNotificationConfig
    const config: any = {
      mode,
      filePath: filePath.trim(),
      rules,
      whitelist: rtConfig?.whitelist || undefined,
    }
    if (mode === 'ssh') {
      if (!sshConfig.host.trim()) {
        setStatus('error')
        setError('请填写 SSH 主机地址')
        return
      }
      config.ssh = {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        password: sshConfig.password || undefined,
        privateKey: sshConfig.privateKey || undefined,
      }
    }

    updateStats({ startTime: Date.now() })

    const result = await window.electronAPI.realtimeStart(config)
    if (result.success) {
      setMonitorId(result.monitorId!)
      addSession({
        monitorId: result.monitorId!,
        filePath: filePath.trim(),
        mode,
        status: 'connecting',
        lines: [],
        matches: [],
        stats: { ...stats, startTime: Date.now() },
        error: null,
      })
    } else {
      setStatus('error')
      setError(result.error || '启动监控失败')
    }
  }

  // 停止监控
  const handleStop = async () => {
    if (monitorId) {
      await window.electronAPI.realtimeStop(monitorId)
      removeSession(monitorId)
    }
    setStatus('stopped')
    setMonitorId(null)
  }

  // 停止指定会话
  const handleStopSession = async (id: string) => {
    await window.electronAPI.realtimeStop(id)
    removeSession(id)
    if (id === monitorId) {
      setStatus('stopped')
      setMonitorId(null)
    }
  }

  // 切换会话
  const handleSwitchSession = (id: string) => {
    setActiveSession(id)
    lineCounterRef.current = 0
    matchSetRef.current.clear()
  }

  // 格式化运行时间
  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}时${m % 60}分`
    if (m > 0) return `${m}分${s % 60}秒`
    return `${s}秒`
  }

  // 获取文件名
  const getFileName = (p: string) => {
    return p.split('/').pop() || p.split('\\').pop() || p
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* 活跃监控实例列表 */}
      {sessions.length > 0 && (
        <div className="glass-card p-3">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-2">
            监控实例 ({sessions.length})
          </div>
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s => (
              <button key={s.monitorId}
                onClick={() => handleSwitchSession(s.monitorId)}
                className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                  activeSessionId === s.monitorId
                    ? 'bg-[var(--accent-primary)] text-black'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}>
                <span className={`w-2 h-2 rounded-full ${
                  s.status === 'connected' ? 'bg-green-400' : s.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                }`} />
                {getFileName(s.filePath)}
                <span className="text-white/30 ml-1">{s.stats.matchedLines}</span>
                <span onClick={(e) => { e.stopPropagation(); handleStopSession(s.monitorId) }}
                  className="ml-1 text-red-400 hover:text-red-300 cursor-pointer">x</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 连接配置区 */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider uppercase">
            实时监控配置
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('local')}
              className={`px-3 py-1 text-xs rounded ${mode === 'local' ? 'bg-[var(--accent-primary)] text-black' : 'bg-white/5 text-white/50'}`}
              disabled={isRunning}
            >
              本地文件
            </button>
            <button
              onClick={() => setMode('ssh')}
              className={`px-3 py-1 text-xs rounded ${mode === 'ssh' ? 'bg-[var(--accent-primary)] text-black' : 'bg-white/5 text-white/50'}`}
              disabled={isRunning}
            >
              SSH 远程
            </button>
          </div>
          {isRunning && (
            <span className={`text-xs ml-auto ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
              {status === 'connecting' ? '连接中...' : '监控中'}
            </span>
          )}
        </div>

        {/* 本地模式 */}
        {mode === 'local' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="日志文件路径，如 C:\logs\access.log 或 /var/log/nginx/access.log"
              className="neon-input flex-1 text-sm"
              disabled={isRunning}
            />
            <button onClick={handleBrowseFile} className="neon-btn text-xs px-3" disabled={isRunning}>
              浏览
            </button>
          </div>
        )}

        {/* SSH 模式 */}
        {mode === 'ssh' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={sshConfig.host}
                onChange={(e) => setSSHConfig({ ...sshConfig, host: e.target.value })}
                placeholder="主机地址，如 192.168.1.100"
                className="neon-input flex-1 text-sm"
                disabled={isRunning}
              />
              <input
                type="number"
                value={sshConfig.port}
                onChange={(e) => setSSHConfig({ ...sshConfig, port: parseInt(e.target.value) || 22 })}
                placeholder="端口"
                className="neon-input w-20 text-sm"
                disabled={isRunning}
              />
              <input
                type="text"
                value={sshConfig.username}
                onChange={(e) => setSSHConfig({ ...sshConfig, username: e.target.value })}
                placeholder="用户名"
                className="neon-input w-28 text-sm"
                disabled={isRunning}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={sshConfig.password}
                onChange={(e) => setSSHConfig({ ...sshConfig, password: e.target.value })}
                placeholder="密码（与私钥二选一）"
                className="neon-input flex-1 text-sm"
                disabled={isRunning}
              />
              <input
                type="text"
                value={sshConfig.privateKey}
                onChange={(e) => setSSHConfig({ ...sshConfig, privateKey: e.target.value })}
                placeholder="私钥文件路径（可选）"
                className="neon-input flex-1 text-sm"
                disabled={isRunning}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="远程日志路径，如 /var/log/nginx/access.log"
                className="neon-input flex-1 text-sm"
                disabled={isRunning}
              />
              <button onClick={handleTestSSH} className="neon-btn text-xs px-3" disabled={isRunning || testingSSH || !sshConfig.host.trim()}>
                {testingSSH ? '测试中...' : '测试连接'}
              </button>
            </div>
            {sshTestResult && (
              <div className={`text-xs ${sshTestResult.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
                {sshTestResult}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-3">
          {!isRunning ? (
            <button onClick={handleStart} className="neon-btn text-xs px-4 py-1.5" disabled={!filePath.trim()}>
              ▶ 开始监控
            </button>
          ) : (
            <button onClick={handleStop} className="neon-btn text-xs px-4 py-1.5 bg-red-500/20 border-red-500/50 text-red-400">
              ⏹ 停止监控
            </button>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-400 mt-2">{error}</div>
        )}
      </div>

      {/* 统计摘要栏 */}
      {isConnected && (
        <div className="glass-card p-3">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="text-white/50">扫描行数</span>
            <span className="text-[var(--accent-primary)] font-mono">{displayStats.totalLines.toLocaleString()}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50">告警</span>
            <span className="text-[var(--accent-primary)] font-mono">{displayStats.matchedLines.toLocaleString()}</span>
            <span className="text-white/30">|</span>
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
              <span key={sev} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
                <span className="text-white/50">{SEVERITY_LABELS[sev]}</span>
                <span className="font-mono" style={{ color: SEVERITY_COLORS[sev] }}>
                  {displayStats.summary[sev]}
                </span>
              </span>
            ))}
            <span className="text-white/30">|</span>
            <span className="text-white/50">运行</span>
            <span className="text-white/70 font-mono">{formatDuration(duration)}</span>
          </div>
        </div>
      )}

      {/* 主内容区：日志流 + 威胁告警 */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* 实时日志流 */}
        <div className="glass-card flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs text-white/50 font-orbitron">实时日志流</span>
            <label className="flex items-center gap-1 text-xs text-white/40 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3"
              />
              自动滚动
            </label>
          </div>
          <div ref={logContainerRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs leading-5">
            {lines.length === 0 && !isConnected && (
              <div className="text-white/20 text-center mt-8">配置连接参数后点击「开始监控」</div>
            )}
            {lines.length === 0 && isConnected && (
              <div className="text-white/20 text-center mt-8">等待日志数据...</div>
            )}
            {lines.map((line, i) => (
              <div
                key={`${line.lineNumber}-${i}`}
                className={`px-2 py-0.5 rounded-sm ${
                  line.isThreat
                    ? 'bg-red-500/10 border-l-2 border-red-500'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="text-white/20 mr-2 select-none w-10 inline-block text-right">
                  {line.lineNumber}
                </span>
                <span className={line.isThreat ? 'text-red-300' : 'text-white/70'}>
                  {line.text.length > 300 ? line.text.substring(0, 300) + '...' : line.text}
                </span>
                {line.isThreat && line.severity && (
                  <span
                    className="ml-2 text-xs px-1 rounded"
                    style={{ color: SEVERITY_COLORS[line.severity], backgroundColor: SEVERITY_COLORS[line.severity] + '20' }}
                  >
                    {SEVERITY_LABELS[line.severity] || line.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 威胁告警列表 */}
        <div className="glass-card w-[320px] flex flex-col">
          <div className="px-3 py-2 border-b border-white/10">
            <span className="text-xs text-white/50 font-orbitron">威胁告警</span>
            <span className="text-xs text-[var(--accent-primary)] ml-2">{matches.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {matches.length === 0 && (
              <div className="text-white/20 text-xs text-center mt-8">暂无告警</div>
            )}
            {matches.slice().reverse().map((match, i) => {
              const idx = matches.length - 1 - i
              return (
                <div
                  key={`${match.ruleId}-${match.lineNumber}-${idx}`}
                  className="border-b border-white/5 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedMatch(expandedMatch === idx ? null : idx)}
                >
                  <div className="px-3 py-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[match.severity] }} />
                    <span className="text-xs font-medium truncate" style={{ color: SEVERITY_COLORS[match.severity] }}>
                      {match.ruleName}
                    </span>
                    <span className="text-white/30 text-xs ml-auto">L:{match.lineNumber}</span>
                  </div>
                  {expandedMatch === idx && (
                    <div className="px-3 pb-2">
                      <div className="text-xs text-white/40 mb-1">
                        {match.category} · {SEVERITY_LABELS[match.severity] || match.severity}
                      </div>
                      <div className="text-xs text-white/60 font-mono bg-black/30 p-2 rounded break-all">
                        {match.line}
                      </div>
                      <div className="text-xs text-[var(--accent-primary)] mt-1">
                        匹配: {match.matchedText}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
