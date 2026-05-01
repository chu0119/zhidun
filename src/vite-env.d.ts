/// <reference types="vite/client" />

interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  openFile: () => Promise<string | null>
  openFolder: () => Promise<string | null>
  listLogFiles: (folderPath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>
  saveFile: (options: any) => Promise<string | null>
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; size?: number; error?: string }>
  readTextFile: (filePath: string) => Promise<{ success: boolean; text?: string; encoding?: string; size?: number; error?: string }>
  readLargeTextFile: (filePath: string, options?: { maxLines?: number; encoding?: string }) => Promise<{ success: boolean; lines?: string[]; totalLines?: number; encoding?: string; size?: number; sampledLines?: number; error?: string }>
  countLines: (filePath: string) => Promise<{ success: boolean; totalLines?: number; error?: string }>
  streamAnalyze: (filePath: string, rules: any[]) => Promise<{
    success: boolean
    totalLines: number
    matchedLines: number
    matches: Array<{
      ruleId: string
      ruleName: string
      category: string
      severity: string
      lineNumber: number
      line: string
      matchedText: string
      description: string
      remediation: string
    }>
    summary: { critical: number; high: number; medium: number; low: number; info: number }
    categoryStats: Record<string, number>
    error?: string
  }>
  onStreamProgress: (callback: (data: { linesScanned: number; matchesFound: number }) => void) => () => void
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  getFileInfo: (filePath: string) => Promise<{ success: boolean; info?: any; error?: string }>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => void
  getAppPath: () => Promise<string>
  getVersion: () => Promise<string>
  getMachineId: () => Promise<string>
  emailSend: (options: { host: string; port: number; user: string; pass: string; from: string; to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string }>
  showDesktopNotification: (options: { title: string; body: string; severity: string }) => Promise<void>
  playAlertSound: (severity: string) => Promise<void>
  onPlaySound: (callback: (severity: string) => void) => () => void
  platform: string
  httpRequest: (url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<{ success: boolean; status?: number; data?: string; error?: string }>
  geoipLookup: (ips: string[]) => Promise<{ success: boolean; results: Record<string, { country: string; region: string; city: string; lat: number; lon: number; timezone: string }>; error?: string }>
  realtimeStart: (config: {
    mode: 'local' | 'ssh'
    filePath: string
    rules: any[]
    ssh?: { host: string; port: number; username: string; password?: string; privateKey?: string }
  }) => Promise<{ success: boolean; monitorId?: string; error?: string }>
  realtimeStop: (monitorId: string) => Promise<{ success: boolean; error?: string }>
  realtimeTestSSH: (sshConfig: { host: string; port: number; username: string; password?: string; privateKey?: string }) => Promise<{ success: boolean; error?: string }>
  onRealtimeData: (callback: (data: {
    type: 'line' | 'match' | 'stats' | 'error' | 'connected'
    payload: any
  }) => void) => () => void
  onMenuAction: (callback: (action: string) => void) => () => void
  checkUpdate: () => Promise<{ hasUpdate?: boolean; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  getUpdateVersion: () => Promise<string>
  onUpdateEvent: (callback: (event: string, data?: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
