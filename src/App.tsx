// 根组件

import React, { useState, useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { SplashOverlay } from './components/dialogs/SplashOverlay'
import { useConfigStore } from './stores/config-store'
import { useHistoryStore } from './stores/history-store'
import { useThemeStore } from './stores/theme-store'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [ready, setReady] = useState(false)
  const loadConfig = useConfigStore(s => s.loadConfig)
  const loadHistory = useHistoryStore(s => s.loadHistory)
  const config = useConfigStore(s => s.config)

  useEffect(() => {
    const init = async () => {
      await loadConfig()
      await loadHistory()
      setReady(true)
    }
    init()
  }, [loadConfig, loadHistory])

  // 应用主题和字体大小
  useEffect(() => {
    if (ready) {
      // 从配置恢复主题（不经过 theme-store 避免循环）
      const theme = config.cyberTheme || 'cyber'
      document.documentElement.setAttribute('data-theme', theme)
      useThemeStore.setState({ currentTheme: theme as any })
      // 应用字体大小 CSS 变量 + 缩放比例
      const fs = config.fontSizes
      document.documentElement.style.setProperty('--font-menu', `${fs.menu}px`)
      document.documentElement.style.setProperty('--font-analysis', `${fs.analysis}px`)
      document.documentElement.style.setProperty('--font-report', `${fs.report}px`)
      document.documentElement.style.setProperty('--font-charts', `${fs.charts}px`)
      // 缩放比例（基准: menu=13, analysis=13, report=14, charts=12）
      document.documentElement.style.setProperty('--font-menu-scale', `${fs.menu / 13}`)
      document.documentElement.style.setProperty('--font-analysis-scale', `${fs.analysis / 13}`)
      document.documentElement.style.setProperty('--font-report-scale', `${fs.report / 14}`)
      document.documentElement.style.setProperty('--font-charts-scale', `${fs.charts / 12}`)
    }
  }, [ready]) // Only run once on startup

  const handleSplashComplete = () => {
    setShowSplash(false)
  }

  if (!ready) return null

  return (
    <>
      {showSplash && config.showWelcome && (
        <SplashOverlay onComplete={handleSplashComplete} />
      )}
      <AppLayout />
    </>
  )
}
