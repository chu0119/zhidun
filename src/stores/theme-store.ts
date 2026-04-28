// 主题状态管理

import { create } from 'zustand'
import { useConfigStore } from './config-store'

export type ThemeName = 'cyber' | 'green' | 'purple' | 'red' | 'ocean' | 'dark' | 'light'

interface ThemeState {
  currentTheme: ThemeName
  setTheme: (theme: ThemeName) => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  currentTheme: 'cyber',

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ currentTheme: theme })
    // 同步到配置存储以实现持久化
    useConfigStore.getState().updateConfig({ cyberTheme: theme, theme })
  },

  initTheme: () => {
    const savedTheme = useConfigStore.getState().config.cyberTheme as ThemeName
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme)
      set({ currentTheme: savedTheme })
    }
  },
}))
