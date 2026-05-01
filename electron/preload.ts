import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // File dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  listLogFiles: (folderPath: string) => ipcRenderer.invoke('folder:listLogFiles', folderPath),
  saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),

  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  readTextFile: (filePath: string) => ipcRenderer.invoke('file:readText', filePath),
  readLargeTextFile: (filePath: string, options?: { maxLines?: number; encoding?: string }) =>
    ipcRenderer.invoke('file:readLargeText', filePath, options),
  countLines: (filePath: string) => ipcRenderer.invoke('file:countLines', filePath),
  streamAnalyze: (filePath: string, rules: any[]) => ipcRenderer.invoke('file:streamAnalyze', filePath, rules),
  onStreamProgress: (callback: (data: { linesScanned: number; matchesFound: number }) => void) => {
    const handler = (_event: any, data: { linesScanned: number; matchesFound: number }) => callback(data)
    ipcRenderer.on('stream:progress', handler)
    return () => ipcRenderer.removeListener('stream:progress', handler)
  },
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('file:getInfo', filePath),

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),

  // App info
  getAppPath: () => ipcRenderer.invoke('app:getPath'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Platform
  platform: process.platform,

  // HTTP request (bypasses CORS)
  httpRequest: (url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) =>
    ipcRenderer.invoke('http:request', url, options),

  // GeoIP offline lookup
  geoipLookup: (ips: string[]) => ipcRenderer.invoke('geoip:lookup', ips),

  // Menu events listener
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  // Update
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateVersion: () => ipcRenderer.invoke('update:getVersion'),
  onUpdateEvent: (callback: (event: string, data?: any) => void) => {
    const channels = ['update:available', 'update:not-available', 'update:error', 'update:download-progress', 'update:downloaded']
    const handlers = channels.map(channel => {
      const handler = (_event: any, data?: any) => callback(channel, data)
      ipcRenderer.on(channel, handler)
      return { channel, handler }
    })
    return () => {
      handlers.forEach(({ channel, handler }) => ipcRenderer.removeListener(channel, handler))
    }
  },

})
