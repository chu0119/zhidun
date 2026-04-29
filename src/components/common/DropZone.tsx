// 通用拖放区域组件

import React, { useState, useRef, useCallback } from 'react'
import { SUPPORTED_LOG_FORMATS } from '@/core/constants'

interface DropZoneProps {
  onFileDrop: (filePath: string) => void
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

export function DropZone({ onFileDrop, className = '', children, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragCounter = useRef(0)

  const isValidFile = useCallback((filePath: string): boolean => {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase()
    return SUPPORTED_LOG_FORMATS.includes(ext)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current++
    setIsDragging(true)
    setError(null)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current = 0
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    // Electron 中 file.path 包含完整路径
    const filePath = (file as any).path as string
    if (!filePath) {
      setError('无法获取文件路径')
      return
    }

    if (!isValidFile(filePath)) {
      const ext = filePath.split('.').pop()?.toLowerCase() || '未知'
      setError(`不支持的文件格式: .${ext}`)
      return
    }

    setError(null)
    onFileDrop(filePath)
  }, [disabled, isValidFile, onFileDrop])

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      {children}
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg
          bg-[var(--accent-primary)]/10 border-2 border-dashed border-[var(--accent-primary)]
          backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-primary)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="text-sm font-orbitron text-[var(--accent-primary)]">
              释放以加载文件
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute bottom-0 left-0 right-0 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-b-lg truncate">
          {error}
        </div>
      )}
    </div>
  )
}
