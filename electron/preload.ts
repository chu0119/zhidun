import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // File dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),

  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  readTextFile: (filePath: string) => ipcRenderer.invoke('file:readText', filePath),
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
})
