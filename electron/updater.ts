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
    // 通知渲染进程正在检查
    try {
      mainWindow.webContents.send('update:checking')
    } catch {}
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

  // 启动时自动检查更新（仅在已打包时）并设置周期性检查
  try {
    if (app.isPackaged) {
      // 延迟少量时间，避免阻塞主进程启动
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {})
      }, 5000)

      // 每 6 小时检查一次
      const CHECK_INTERVAL = 6 * 60 * 60 * 1000
      setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {})
      }, CHECK_INTERVAL)
    }
  } catch (e) {
    // 忽略任何异常
  }
}
