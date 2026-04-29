// 左侧控制面板

import React, { useState, useEffect } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useConfigStore } from '@/stores/config-store'
import { PROVIDER_INFO } from '@/core/constants'
import { formatTime } from '@/utils/helpers'

interface SidebarProps {
  onPreprocess: () => void
  onAIAnalysis: () => void
  onStop: () => void
  onExportReport: (format: 'docx' | 'pdf') => void
}

export function Sidebar({ onPreprocess, onAIAnalysis, onStop, onExportReport }: SidebarProps) {
  const { config, updateModel } = useConfigStore()
  const status = useAnalysisStore(s => s.status)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const elapsedTime = useAnalysisStore(s => s.elapsedTime)
  const localElapsedTime = useAnalysisStore(s => s.localElapsedTime)
  const reportText = useAnalysisStore(s => s.reportText)
  const localReportText = useAnalysisStore(s => s.localReportText)
  const setCurrentFile = useAnalysisStore(s => s.setCurrentFile)
  const addProgress = useAnalysisStore(s => s.addProgress)

  const [fileName, setFileName] = useState<string>('')
  const [filePath, setFilePath] = useState<string>('')

  // 当 store 中 currentFile 被清空时（如点击清空输出），同步清空本地状态
  useEffect(() => {
    if (!currentFile) {
      setFileName('')
      setFilePath('')
    }
  }, [currentFile])

  const isAiAnalyzing = status === 'analyzing' || status === 'preparing'
  const isPreprocessing = preprocessStatus === 'analyzing' || preprocessStatus === 'preparing'
  const isRunning = isAiAnalyzing || isPreprocessing
  const displayTime = isPreprocessing ? localElapsedTime : elapsedTime
  const preprocessDone = preprocessStatus === 'done'

  const handleSelectFile = async () => {
    const path = await window.electronAPI.openFile()
    if (path) {
      const info = await window.electronAPI.getFileInfo(path)
      if (info.success) {
        setFileName(info.info.name)
        setFilePath(path)
        // 保存完整路径到 store (用 | 分隔路径和文件名)
        setCurrentFile(`${path}|${info.info.name}`)
        addProgress(`已选择文件: ${info.info.name} (${info.info.sizeMB} MB)`)
      }
    }
  }

  const currentProvider = PROVIDER_INFO.find(p => p.name === config.currentModel.provider)

  return (
    <div className="w-72 min-w-[260px] flex flex-col gap-3 p-3 overflow-y-auto" style={{ fontSize: 'var(--font-menu, 13px)' }}>
      {/* 文件选择 */}
      <div className="glass-card p-4 corner-decor">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3 uppercase">
          文件选择
        </div>
        <button
          onClick={handleSelectFile}
          className="w-full p-4 border-2 border-dashed border-[var(--border-color)] rounded-lg
            hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5
            transition-all duration-300 group cursor-pointer"
        >
          <div className="flex flex-col items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            {fileName ? (
              <span className="text-sm text-[var(--text-primary)] truncate max-w-full">{fileName}</span>
            ) : (
              <span className="text-sm text-[var(--text-dim)]">点击选择日志文件</span>
            )}
          </div>
        </button>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">
            支持: .log .txt .csv .json
          </span>
          <button
            onClick={async () => {
              const folderPath = await window.electronAPI.openFolder()
              if (folderPath) {
                const result = await window.electronAPI.listLogFiles(folderPath)
                if (result.success && result.files && result.files.length > 0) {
                  const firstFile = result.files[0]
                  const info = await window.electronAPI.getFileInfo(firstFile)
                  if (info.success) {
                    setFileName(info.info.name)
                    setFilePath(firstFile)
                    setCurrentFile(`${firstFile}|${info.info.name}`)
                    addProgress(`已选择文件夹: ${folderPath} (${result.files.length} 个日志文件)`)
                  }
                }
              }
            }}
            className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
            title="选择文件夹"
          >
            文件夹
          </button>
        </div>
      </div>

      {/* AI 模型选择 */}
      <div className="glass-card p-4 corner-decor">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3 uppercase">
          AI 模型
        </div>

        <select
          value={config.currentModel.provider}
          onChange={(e) => {
            const provider = PROVIDER_INFO.find(p => p.name === e.target.value)
            if (provider) {
              updateModel({
                provider: provider.name,
                modelName: provider.defaultModel,
                baseUrl: provider.defaultBaseUrl,
              })
            }
          }}
          className="neon-select w-full mb-2"
        >
          {PROVIDER_INFO.map(p => (
            <option key={p.name} value={p.name}>{p.label} - {p.description}</option>
          ))}
        </select>

        <input
          type="text"
          value={config.currentModel.modelName}
          onChange={(e) => updateModel({ modelName: e.target.value })}
          placeholder="模型名称"
          className="neon-input w-full mb-2 text-sm"
        />

        {currentProvider?.requiresApiKey && (
          <input
            type="password"
            value={config.currentModel.apiKey || ''}
            onChange={(e) => updateModel({ apiKey: e.target.value })}
            placeholder="API Key"
            className="neon-input w-full mb-2 text-sm"
          />
        )}

        <input
          type="text"
          value={config.currentModel.baseUrl || ''}
          onChange={(e) => updateModel({ baseUrl: e.target.value })}
          placeholder="API 地址"
          className="neon-input w-full text-sm"
        />
      </div>

      {/* 计时器 */}
      <div className="glass-card p-4 flex items-center justify-center">
        <div className="led-display">{formatTime(displayTime)}</div>
      </div>

      {/* 控制按钮 */}
      <div className="flex flex-col gap-2">
        {!isRunning ? (
          preprocessDone ? (
            // 本地预处理完成 → 显示 AI 深度分析按钮
            <button
              onClick={onAIAnalysis}
              disabled={!filePath}
              className="neon-btn primary w-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ▶ AI 深度分析
            </button>
          ) : (
            // idle / error / stopped → 显示预处理按钮
            <button
              onClick={onPreprocess}
              disabled={!filePath}
              className="neon-btn w-full disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
            >
              ◆ 本地预处理
            </button>
          )
        ) : (
          <button
            onClick={onStop}
            className="neon-btn danger w-full"
          >
            ■ 停止分析
          </button>
        )}

        <button
          onClick={() => useAnalysisStore.getState().clearAll()}
          className="neon-btn w-full text-xs"
        >
          清空输出
        </button>
      </div>

      {/* 导出按钮 */}
      <div className="glass-card p-4 corner-decor">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3 uppercase">
          导出报告
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onExportReport('pdf')}
            disabled={!reportText && !localReportText}
            className="neon-btn flex-1 text-xs disabled:opacity-30"
          >
            PDF
          </button>
          <button
            onClick={() => onExportReport('docx')}
            disabled={!reportText && !localReportText}
            className="neon-btn flex-1 text-xs disabled:opacity-30"
          >
            DOCX
          </button>
        </div>
      </div>
    </div>
  )
}
