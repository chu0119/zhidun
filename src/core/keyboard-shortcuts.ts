// 快捷键和命令面板管理

export interface KeyboardShortcut {
  id: string
  description: string
  keys: string[] // 例如 ['ctrl', 'k'] 或 ['cmd', 'k']
  action: () => void | Promise<void>
  category: 'file' | 'navigation' | 'analysis' | 'search' | 'export' | 'view'
  enabled: boolean
}

export interface Command {
  id: string
  title: string
  description?: string
  category: 'file' | 'navigation' | 'analysis' | 'search' | 'export' | 'view'
  keybinding?: string[]
  action: () => void | Promise<void>
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private commands: Map<string, Command> = new Map()
  private enabled = true

  // 注册快捷键
  registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut)

    // 绑定全局事件监听
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.handleKeyDown(e))
    }
  }

  // 注册命令
  registerCommand(command: Command): void {
    this.commands.set(command.id, command)
  }

  // 批量注册快捷键
  registerDefaults(): void {
    // 文件操作
    this.registerShortcut({
      id: 'file.open',
      description: '打开文件',
      keys: ['ctrl', 'o'],
      category: 'file',
      enabled: true,
      action: () => this.executeCommand('file.open'),
    })

    this.registerShortcut({
      id: 'file.save',
      description: '保存分析结果',
      keys: ['ctrl', 's'],
      category: 'file',
      enabled: true,
      action: () => this.executeCommand('file.save'),
    })

    this.registerShortcut({
      id: 'file.export',
      description: '导出报告',
      keys: ['ctrl', 'shift', 'e'],
      category: 'file',
      enabled: true,
      action: () => this.executeCommand('file.export'),
    })

    // 导航
    this.registerShortcut({
      id: 'nav.search',
      description: '打开快速搜索',
      keys: ['ctrl', 'f'],
      category: 'search',
      enabled: true,
      action: () => this.executeCommand('nav.search'),
    })

    this.registerShortcut({
      id: 'nav.commandPalette',
      description: '打开命令面板',
      keys: ['ctrl', 'shift', 'p'],
      category: 'navigation',
      enabled: true,
      action: () => this.executeCommand('nav.commandPalette'),
    })

    this.registerShortcut({
      id: 'nav.focus',
      description: '聚焦搜索框',
      keys: ['ctrl', 'k'],
      category: 'search',
      enabled: true,
      action: () => this.executeCommand('nav.focus'),
    })

    // 分析操作
    this.registerShortcut({
      id: 'analysis.start',
      description: '开始分析',
      keys: ['ctrl', 'enter'],
      category: 'analysis',
      enabled: true,
      action: () => this.executeCommand('analysis.start'),
    })

    this.registerShortcut({
      id: 'analysis.stop',
      description: '停止分析',
      keys: ['escape'],
      category: 'analysis',
      enabled: true,
      action: () => this.executeCommand('analysis.stop'),
    })

    // 视图切换
    this.registerShortcut({
      id: 'view.toggle',
      description: '切换深色/浅色模式',
      keys: ['ctrl', 'shift', 'd'],
      category: 'view',
      enabled: true,
      action: () => this.executeCommand('view.toggle'),
    })

    this.registerShortcut({
      id: 'view.zoomIn',
      description: '放大视图',
      keys: ['ctrl', 'plus'],
      category: 'view',
      enabled: true,
      action: () => this.executeCommand('view.zoomIn'),
    })

    this.registerShortcut({
      id: 'view.zoomOut',
      description: '缩小视图',
      keys: ['ctrl', 'minus'],
      category: 'view',
      enabled: true,
      action: () => this.executeCommand('view.zoomOut'),
    })
  }

  // 处理键盘事件
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return

    const keys: string[] = []
    if (event.ctrlKey || event.metaKey) keys.push('ctrl')
    if (event.shiftKey) keys.push('shift')
    if (event.altKey) keys.push('alt')
    keys.push(event.key.toLowerCase())

    // 查找匹配的快捷键
    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue

      if (this.keysMatch(shortcut.keys, keys)) {
        event.preventDefault()
        Promise.resolve(shortcut.action()).catch((error: unknown) => {
          console.error('快捷键执行失败:', error)
        })
        break
      }
    }
  }

  // 检查按键是否匹配
  private keysMatch(expected: string[], actual: string[]): boolean {
    if (expected.length !== actual.length) return false
    return expected.every(k => actual.includes(k))
  }

  // 执行命令
  executeCommand(commandId: string): void | Promise<void> {
    const command = this.commands.get(commandId)
    if (!command) {
      console.warn(`命令不存在: ${commandId}`)
      return
    }
    return command.action()
  }

  // 获取所有快捷键
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(s => s.enabled)
  }

  // 按分类获取快捷键
  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return this.getAllShortcuts().filter(s => s.category === category)
  }

  // 获取所有命令
  getAllCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  // 搜索命令
  searchCommands(query: string): Command[] {
    const q = query.toLowerCase()
    return this.getAllCommands().filter(
      c =>
        c.id.includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    )
  }

  // 启用/禁用所有快捷键
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }
}

// 全局快捷键管理器
export const globalShortcutManager = new KeyboardShortcutManager()

// 初始化默认快捷键
export function initializeDefaultShortcuts(): void {
  globalShortcutManager.registerDefaults()
}

// 命令面板配置
export interface CommandPaletteConfig {
  isOpen: boolean
  query: string
  selectedIndex: number
  maxResults: number
}

// 命令面板状态
let commandPaletteState: CommandPaletteConfig = {
  isOpen: false,
  query: '',
  selectedIndex: 0,
  maxResults: 10,
}

export function getCommandPaletteState(): CommandPaletteConfig {
  return { ...commandPaletteState }
}

export function setCommandPaletteState(state: Partial<CommandPaletteConfig>): void {
  commandPaletteState = { ...commandPaletteState, ...state }
}

export function openCommandPalette(): void {
  setCommandPaletteState({ isOpen: true, query: '', selectedIndex: 0 })
}

export function closeCommandPalette(): void {
  setCommandPaletteState({ isOpen: false })
}

export function getFilteredCommands(): Command[] {
  const state = getCommandPaletteState()
  if (!state.query) {
    return globalShortcutManager.getAllCommands().slice(0, state.maxResults)
  }
  return globalShortcutManager.searchCommands(state.query).slice(0, state.maxResults)
}

export function executeSelectedCommand(): void {
  const commands = getFilteredCommands()
  const state = getCommandPaletteState()
  if (state.selectedIndex < commands.length) {
    const command = commands[state.selectedIndex]
    globalShortcutManager.executeCommand(command.id)
    closeCommandPalette()
  }
}
