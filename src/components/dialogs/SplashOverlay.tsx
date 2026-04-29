// 启动动画覆盖层 - 增强版

import React, { useEffect, useState } from 'react'
import { APP_VERSION } from '@/core/constants'

interface SplashOverlayProps {
  onComplete: () => void
}

const PHASES = [
  '正在初始化系统...',
  '正在初始化核心系统组件...',
  '正在加载 AI 分析引擎...',
  '正在同步威胁情报数据库...',
  '正在启动实时监控模块...',
  '正在准备安全防护屏障...',
  '系统就绪，欢迎回来！',
]

const FEATURES = [
  {
    title: '智能分析',
    desc: 'AI 驱动的威胁检测引擎',
    color: '#00f0ff',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
      </svg>
    ),
  },
  {
    title: '实时防护',
    desc: '即时安全响应机制',
    color: '#00ff88',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: '数据可视化',
    desc: '多维度分析报告',
    color: '#ff6b6b',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.5">
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="6" width="4" height="15" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
        <path d="M3 3l6 4 4-2 8-2" strokeDasharray="3 2" />
      </svg>
    ),
  },
  {
    title: '隐私安全',
    desc: '本地化数据处理',
    color: '#a855f7',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        <circle cx="12" cy="16" r="1.5" fill="#a855f7" />
        <line x1="12" y1="17.5" x2="12" y2="19" strokeWidth="2" />
      </svg>
    ),
  },
]

export function SplashOverlay({ onComplete }: SplashOverlayProps) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 1
        if (next >= 100) {
          clearInterval(interval)
          setFadeOut(true)
          setTimeout(onComplete, 600)
          return 100
        }
        const newPhase = Math.min(Math.floor(next / 14.3), 6)
        setPhase(newPhase)
        return next
      })
    }, 80)
    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col bg-[var(--bg-primary)] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      {/* 顶部装饰条 */}
      <div className="h-1 w-full" style={{
        background: 'linear-gradient(90deg, #00d4ff, #0099cc, #b400ff, #00d4ff)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 3s linear infinite',
      }} />

      {/* 背景粒子 */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-[var(--accent-primary)]"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.1 + Math.random() * 0.3,
              animation: `particleFloat ${3 + Math.random() * 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }} />
        ))}
      </div>

      {/* 主内容区 - 垂直居中 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        {/* 动画 Logo */}
        <div className="relative w-48 h-48 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] opacity-30"
            style={{ animation: 'rotateGlow 3s linear infinite' }} />
          <div className="absolute inset-3 rounded-full border border-[var(--accent-secondary)] opacity-20"
            style={{ animation: 'rotateGlow 5s linear infinite reverse' }} />
          <div className="absolute inset-6 rounded-full border border-[var(--accent-primary)] opacity-10"
            style={{ animation: 'rotateGlow 7s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.2"
              style={{ filter: 'drop-shadow(0 0 25px var(--glow-color))' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" stroke="var(--accent-green)" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="font-orbitron text-4xl font-bold mb-3 tracking-[8px]"
          style={{ color: 'var(--accent-primary)', textShadow: '0 0 40px var(--glow-color)' }}>
          星川智盾
        </h1>
        <p className="text-base text-[var(--text-dim)] mb-10 font-mono tracking-wider">
          AI 驱动的网站日志安全分析系统
        </p>

        {/* 进度条 */}
        <div className="w-96 mx-auto mb-3">
          <div className="hud-progress" style={{ height: '8px' }}>
            <div className="bar" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* 百分比 + 状态文字 */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className="text-xs font-mono text-[var(--accent-primary)] w-10 text-right">{progress}%</span>
          <span className="text-xs text-[var(--text-secondary)] font-mono min-w-[200px]">
            {PHASES[phase]}
          </span>
        </div>

        {/* 功能卡片 - 放大版 */}
        <div className="flex justify-center gap-6">
          {FEATURES.map((feat, i) => (
            <div key={feat.title}
              className="glass-card px-8 py-6 text-center animate-fade-in"
              style={{
                animationDelay: `${i * 0.15 + 0.5}s`,
                animationFillMode: 'both',
                borderTop: `4px solid ${feat.color}`,
                minWidth: '200px',
              }}>
              <div className="mb-3 flex justify-center">
                {feat.icon}
              </div>
              <div className="text-base font-bold mb-2" style={{ color: feat.color }}>
                {feat.title}
              </div>
              <div className="text-sm text-[var(--text-dim)]">
                {feat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部版本信息 */}
      <div className="pb-6 text-center">
        <div className="text-xs text-[var(--text-dim)] font-mono tracking-wider">
          v{APP_VERSION} &nbsp;|&nbsp; 星川智盾安全团队 &nbsp;|&nbsp; &copy; 2025
        </div>
      </div>

      {/* 底部装饰条 */}
      <div className="h-1 w-full" style={{
        background: 'linear-gradient(90deg, #00d4ff, #0099cc, #b400ff, #00d4ff)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 3s linear infinite',
      }} />
    </div>
  )
}
