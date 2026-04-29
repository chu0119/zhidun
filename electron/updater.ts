// 自动更新模块

import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain, app } from 'electron'

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // 配置
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // 检查到可用更新
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    })
  })

  // 没有可用更新
  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available')
  })

  // 更新出错
  autoUpdater.on('error', (error) => {
    mainWindow.webContents.send('update:error', error.message)
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  // 下载完成
  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded')
  })

  // IPC: 手动检查更新
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { hasUpdate: !!result?.updateInfo }
    } catch (error: any) {
      return { error: error.message }
    }
  })

  // IPC: 开始下载
  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // IPC: 安装更新并重启
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // IPC: 获取当前版本
  ipcMain.handle('update:getVersion', () => {
    return app.getVersion()
  })
}
