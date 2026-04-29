// 更新对话框

import React, { useState, useEffect, useCallback } from 'react'

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

interface UpdateDialogProps {
  open: boolean
  onClose: () => void
}

export function UpdateDialog({ open, onClose }: UpdateDialogProps) {
  const [state, setState] = useState<UpdateState>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }

  // 监听更新事件
  useEffect(() => {
    if (!open) return

    const cleanup = window.electronAPI.onUpdateEvent((event: string, data?: any) => {
      switch (event) {
        case 'update:available':
          setState('available')
          setUpdateInfo(data as UpdateInfo)
          break
        case 'update:not-available':
          setState('not-available')
          break
        case 'update:error':
          setState('error')
          setErrorMsg(data as string)
          break
        case 'update:download-progress':
          setState('downloading')
          setProgress(data as DownloadProgress)
          break
        case 'update:downloaded':
          setState('downloaded')
          break
      }
    })

    return cleanup
  }, [open])

  // 打开时自动检查
  useEffect(() => {
    if (open && state === 'idle') {
      handleCheck()
    }
  }, [open])

  const handleCheck = useCallback(async () => {
    setState('checking')
    setUpdateInfo(null)
    setErrorMsg('')
    setProgress(null)
    try {
      const result = await (window.electronAPI as any).checkUpdate()
      if (result?.error) {
        setState('error')
        setErrorMsg(result.error)
      } else if (!result?.hasUpdate) {
        setState('not-available')
      }
      // 如果有更新，update:available 事件会触发
    } catch (e: any) {
      setState('error')
      setErrorMsg(e.message)
    }
  }, [])

  const handleDownload = useCallback(async () => {
    setState('downloading')
    try {
      await (window.electronAPI as any).downloadUpdate()
    } catch (e: any) {
      setState('error')
      setErrorMsg(e.message)
    }
  }, [])

  const handleInstall = useCallback(() => {
    (window.electronAPI as any).installUpdate()
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="glass-card w-[480px] max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-orbitron text-[var(--accent-primary)] tracking-wider">
            检查更新
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="space-y-4">
          {/* 检查中 */}
          {state === 'checking' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--text-secondary)]">正在检查更新...</span>
            </div>
          )}

          {/* 有更新 */}
          {state === 'available' && updateInfo && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <div>
                  <div className="text-sm font-bold text-[var(--accent-green)]">
                    新版本 v{updateInfo.version} 可用
                  </div>
                  {updateInfo.releaseDate && (
                    <div className="text-xs text-[var(--text-dim)]">
                      发布日期: {new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                  <div className="text-xs font-orbitron text-[var(--accent-primary)] mb-2">更新日志</div>
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}

              <button onClick={handleDownload}
                className="neon-btn primary w-full">
                下载更新
              </button>
            </>
          )}

          {/* 下载中 */}
          {state === 'downloading' && progress && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">
                正在下载更新...
              </div>
              <div className="hud-progress" style={{ height: '8px' }}>
                <div className="bar" style={{ width: `${progress.percent.toFixed(1)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-dim)] font-mono">
                <span>{progress.percent.toFixed(1)}%</span>
                <span>{formatSpeed(progress.bytesPerSecond)}</span>
              </div>
              <div className="text-xs text-[var(--text-dim)] text-center">
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </div>
            </div>
          )}

          {/* 下载完成 */}
          {state === 'downloaded' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-sm text-[var(--accent-green)]">
                  更新下载完成
                </span>
              </div>
              <button onClick={handleInstall}
                className="neon-btn primary w-full">
                立即重启安装
              </button>
            </div>
          )}

          {/* 没有更新 */}
          {state === 'not-available' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div className="text-center">
                <div className="text-sm font-bold text-[var(--accent-green)]">已是最新版本</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">当前无需更新</div>
              </div>
              <button onClick={handleCheck}
                className="neon-btn text-xs">
                重新检查
              </button>
            </div>
          )}

          {/* 错误 */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div className="text-center">
                <div className="text-sm font-bold text-[#ff6b6b]">检查更新失败</div>
                <div className="text-xs text-[var(--text-dim)] mt-1 max-w-[300px] break-all">{errorMsg}</div>
              </div>
              <button onClick={handleCheck}
                className="neon-btn text-xs">
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
