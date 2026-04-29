// 右键上下文菜单

import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron'

export function setupContextMenu(mainWindow: BrowserWindow) {
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const template: MenuItemConstructorOptions[] = []

    // 有选中文本时
    if (params.selectionText) {
      template.push(
        { role: 'copy' },
        { type: 'separator' },
        {
          label: `搜索 "${params.selectionText.substring(0, 20)}${params.selectionText.length > 20 ? '...' : ''}"`,
          click: () => mainWindow.webContents.send('menu:action', 'search-selection'),
        },
      )
    }

    // 有可编辑区域时
    if (params.isEditable) {
      template.push(
        { role: 'cut' },
        { role: 'paste' },
        { role: 'selectAll' },
      )
    }

    // 有链接时
    if (params.linkURL) {
      template.push(
        { type: 'separator' },
        {
          label: '复制链接',
          click: () => {
            const { clipboard } = require('electron')
            clipboard.writeText(params.linkURL)
          },
        },
        {
          label: '在浏览器中打开',
          click: () => require('electron').shell.openExternal(params.linkURL),
        },
      )
    }

    // 通用菜单项
    if (template.length > 0) {
      template.push({ type: 'separator' })
    }
    template.push(
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: '刷新页面',
        accelerator: 'CmdOrCtrl+R',
        click: () => mainWindow.webContents.reload(),
      },
    )

    const menu = Menu.buildFromTemplate(template)
    menu.popup()
  })
}
