// 全局应用状态管理

import { create } from 'zustand'

export type ViewMode = 'dashboard' | 'analysis'

export type ModuleType =
  | 'overview'
  | 'loglist'
  | 'path'
  | 'geo'
  | 'threat'
  | 'attack'
  | 'session'
  | 'charts'
  | 'search'
  | 'rules'
  | 'compliance'
  | 'batch'
  | 'ai'

interface AppState {
  viewMode: ViewMode
  activeModule: ModuleType
  sidebarCollapsed: boolean
  localAnalysisTrigger: (() => void) | null

  // Actions
  setViewMode: (mode: ViewMode) => void
  setActiveModule: (module: ModuleType) => void
  toggleSidebar: () => void
  goToAnalysis: (module?: ModuleType) => void
  goToDashboard: () => void
  setLocalAnalysisTrigger: (fn: (() => void) | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: 'dashboard',
  activeModule: 'overview',
  sidebarCollapsed: false,
  localAnalysisTrigger: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setLocalAnalysisTrigger: (fn) => set({ localAnalysisTrigger: fn }),

  goToAnalysis: (module) =>
    set({
      viewMode: 'analysis',
      activeModule: module || 'overview',
    }),

  goToDashboard: () =>
    set({
      viewMode: 'dashboard',
    }),
}))
