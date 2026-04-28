// 自定义标题栏

import React from 'react'

interface TitleBarProps {
  extraButtons?: React.ReactNode
}

export function TitleBar({ extraButtons }: TitleBarProps) {
  const handleMinimize = () => window.electronAPI.minimizeWindow()
  const handleMaximize = () => window.electronAPI.maximizeWindow()
  const handleClose = () => window.electronAPI.closeWindow()

  return (
    <div className="h-10 w-full flex items-center justify-between bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* 左侧: Logo + 标题 + 额外按钮 */}
      <div className="flex items-center gap-3 pl-4">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span className="font-orbitron text-sm font-bold tracking-wider"
          style={{ color: 'var(--accent-primary)', textShadow: '0 0 10px var(--glow-color)' }}>
          星川智盾
        </span>
        <span className="text-xs text-[var(--text-dim)] font-mono">v1.0.0</span>

        {/* 额外按钮（历史、设置等） */}
        {extraButtons && (
          <div className="flex items-center gap-1 ml-4"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {extraButtons}
          </div>
        )}
      </div>

      {/* 右侧: 窗口控制 - 始终在最右侧 */}
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={handleMinimize}
          className="w-12 h-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="var(--text-secondary)" strokeWidth="1.5">
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
        </button>
        <button onClick={handleMaximize}
          className="w-12 h-full flex items-center justify-center hover:bg-white/5 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="var(--text-secondary)" strokeWidth="1.5" fill="none">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
          </svg>
        </button>
        <button onClick={handleClose}
          className="w-12 h-full flex items-center justify-center hover:bg-red-500/80 transition-colors group">
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="var(--text-secondary)" strokeWidth="1.5"
            className="group-hover:stroke-white">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  )
}
