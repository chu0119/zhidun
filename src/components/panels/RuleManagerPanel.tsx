// 规则管理面板

import React, { useState } from 'react'
import { useRulesStore, CustomRule } from '@/stores/rules-store'
import { RuleEditorDialog } from '@/components/dialogs/RuleEditorDialog'

export function RuleManagerPanel() {
  const { rules, addRule, updateRule, deleteRule, toggleRule, importRules, exportRules } = useRulesStore()
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null)
  const [filterText, setFilterText] = useState('')
  const [filterSeverity, setFilterSeverity] = useState<string>('')

  const filteredRules = rules.filter(r => {
    if (filterText && !r.name.toLowerCase().includes(filterText.toLowerCase()) &&
        !r.category.toLowerCase().includes(filterText.toLowerCase())) return false
    if (filterSeverity && r.severity !== filterSeverity) return false
    return true
  })

  const handleEdit = (rule: CustomRule) => {
    setEditingRule(rule)
    setShowEditor(true)
  }

  const handleNew = () => {
    setEditingRule(null)
    setShowEditor(true)
  }

  const handleSave = (ruleData: Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingRule) {
      updateRule(editingRule.id, ruleData)
    } else {
      addRule(ruleData)
    }
  }

  const handleImport = async () => {
    const path = await window.electronAPI.openFile()
    if (!path) return
    const result = await window.electronAPI.readTextFile(path)
    if (result.success && result.text) {
      const importResult = importRules(result.text)
      alert(`导入完成: 成功 ${importResult.success} 条${importResult.errors.length > 0 ? `，失败 ${importResult.errors.length} 条` : ''}`)
    }
  }

  const handleExport = async () => {
    const json = exportRules()
    const path = await window.electronAPI.saveFile({
      title: '导出自定义规则',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: 'custom_rules.json',
    })
    if (path) {
      await window.electronAPI.writeFile(path, json)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff4444'
      case 'high': return '#ff8800'
      case 'medium': return '#ffcc00'
      case 'low': return '#00cc88'
      default: return '#888'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '严重'
      case 'high': return '高危'
      case 'medium': return '中危'
      case 'low': return '低危'
      default: return severity
    }
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="text-sm font-orbitron text-[var(--accent-primary)] tracking-wider">
          自定义规则管理
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-dim)]">
            {rules.length} 条规则 ({rules.filter(r => r.enabled).length} 启用)
          </span>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 shrink-0">
        <input type="text" value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="搜索规则名称或分类..."
          className="neon-input flex-1 text-sm" />
        <select value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="neon-select text-xs py-1">
          <option value="">全部级别</option>
          <option value="critical">严重</option>
          <option value="high">高危</option>
          <option value="medium">中危</option>
          <option value="low">低危</option>
        </select>
        <button onClick={handleNew} className="neon-btn primary text-xs px-3">+ 新建</button>
        <button onClick={handleImport} className="neon-btn text-xs px-3">导入</button>
        <button onClick={handleExport} className="neon-btn text-xs px-3">导出</button>
      </div>

      {/* 规则列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
        {filteredRules.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            {rules.length === 0 ? '暂无自定义规则，点击"新建"创建' : '无匹配规则'}
          </div>
        ) : (
          filteredRules.map(rule => (
            <div key={rule.id}
              className={`glass-card p-3 flex items-center gap-3 ${!rule.enabled ? 'opacity-50' : ''}`}>
              {/* 启用开关 */}
              <button onClick={() => toggleRule(rule.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  rule.enabled
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/20'
                    : 'border-[var(--text-dim)]'
                }`}>
                {rule.enabled && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-primary)] font-medium truncate">{rule.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: `${getSeverityColor(rule.severity)}20`,
                      color: getSeverityColor(rule.severity),
                    }}>
                    {getSeverityLabel(rule.severity)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-dim)] shrink-0">
                    {rule.category}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-dim)] mt-0.5 font-mono truncate">
                  {rule.patterns.join(' | ')}
                </div>
              </div>

              {/* 操作 */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleEdit(rule)}
                  className="text-xs px-2 py-1 rounded hover:bg-white/10 text-[var(--accent-primary)]">
                  编辑
                </button>
                <button onClick={() => deleteRule(rule.id)}
                  className="text-xs px-2 py-1 rounded hover:bg-white/10 text-red-400">
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 编辑器对话框 */}
      <RuleEditorDialog
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
        editingRule={editingRule}
      />
    </div>
  )
}
