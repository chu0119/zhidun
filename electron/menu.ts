// 原生系统菜单栏

import { Menu, BrowserWindow, shell, app } from 'electron'

export function createAppMenu(mainWindow: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // 文件菜单
    {
      label: '文件(&F)',
      submenu: [
        {
          label: '打开文件...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:action', 'open-file'),
        },
        {
          label: '打开文件夹...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu:action', 'open-folder'),
        },
        { type: 'separator' },
        { type: 'separator' },
        {
          label: '导出报告',
          submenu: [
            {
              label: '导出为 PDF...',
              click: () => mainWindow.webContents.send('menu:action', 'export-pdf'),
            },
            {
              label: '导出为 DOCX...',
              click: () => mainWindow.webContents.send('menu:action', 'export-docx'),
            },
          ],
        },
        { type: 'separator' },
        ...(isMac ? [] : [
          { type: 'separator' as const },
          { role: 'quit' as const },
        ]),
      ],
    },

    // 编辑菜单
    {
      label: '编辑(&E)',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: '搜索...',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu:action', 'search'),
        },
        { type: 'separator' },
        {
          label: '设置...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu:action', 'open-settings'),
        },
      ],
    },

    // 视图菜单
    {
      label: '视图(&V)',
      submenu: [
        {
          label: 'AI 分析',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('menu:action', 'tab-ai-analysis'),
        },
        {
          label: 'AI 报告',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('menu:action', 'tab-ai-report'),
        },
        {
          label: '本地分析',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow.webContents.send('menu:action', 'tab-local-analysis'),
        },
        {
          label: '本地报告',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow.webContents.send('menu:action', 'tab-local-report'),
        },
        {
          label: '威胁检测',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow.webContents.send('menu:action', 'tab-threat'),
        },
        {
          label: '攻击分析',
          accelerator: 'CmdOrCtrl+6',
          click: () => mainWindow.webContents.send('menu:action', 'tab-attack'),
        },
        {
          label: '攻击会话',
          accelerator: 'CmdOrCtrl+7',
          click: () => mainWindow.webContents.send('menu:action', 'tab-session'),
        },
        {
          label: '可视化图表',
          accelerator: 'CmdOrCtrl+8',
          click: () => mainWindow.webContents.send('menu:action', 'tab-charts'),
        },
        {
          label: '路径分析',
          accelerator: 'CmdOrCtrl+9',
          click: () => mainWindow.webContents.send('menu:action', 'tab-path'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },

    // 分析菜单
    {
      label: '分析(&A)',
      submenu: [
        {
          label: '开始本地规则分析',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => mainWindow.webContents.send('menu:action', 'start-local-analysis'),
        },
        {
          label: '开始 AI 分析',
          accelerator: 'CmdOrCtrl+Shift+Enter',
          click: () => mainWindow.webContents.send('menu:action', 'start-ai-analysis'),
        },
        { type: 'separator' },
        {
          label: '停止分析',
          accelerator: 'Escape',
          click: () => mainWindow.webContents.send('menu:action', 'stop-analysis'),
        },
        { type: 'separator' },
        {
          label: '预处理设置...',
          click: () => mainWindow.webContents.send('menu:action', 'preprocess'),
        },
        {
          label: '通知设置...',
          click: () => mainWindow.webContents.send('menu:action', 'notification'),
        },
        { type: 'separator' },
        {
          label: '清空输出',
          accelerator: 'CmdOrCtrl+Shift+Delete',
          click: () => mainWindow.webContents.send('menu:action', 'clear-output'),
        },
      ],
    },

    // 帮助菜单
    {
      label: '帮助(&H)',
      submenu: [
        {
          label: '历史记录...',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow.webContents.send('menu:action', 'open-history'),
        },
        { type: 'separator' },
        {
          label: '检查更新...',
          click: () => mainWindow.webContents.send('menu:action', 'check-update'),
        },
        { type: 'separator' },
        {
          label: 'GitHub 仓库',
          click: () => shell.openExternal('https://github.com/chu0119/zhidun'),
        },
        {
          label: '提交反馈',
          click: () => shell.openExternal('https://github.com/chu0119/zhidun/issues'),
        },
        { type: 'separator' },
        {
          label: '关于 星川智盾',
          click: () => mainWindow.webContents.send('menu:action', 'about'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  return menu
}
