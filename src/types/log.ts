// 日志相关类型

export type LogFormat =
  | 'csv'
  | 'json'
  | 'json_lines'
  | 'text_apache'
  | 'text_nginx'
  | 'text_iis'
  | 'text_generic'

export interface LogProcessConfig {
  filePath: string
  maxLines: number
  maxTokens: number
  sampleMode: 'smart' | 'head' | 'random'
  includeContext: boolean
  compressOutput: boolean
  filterEmpty: boolean
}

export interface LogSampleResult {
  lines: string[]
  totalLines: number
  sampledLines: number
  skippedLines: number
  formatType: LogFormat
  encoding: string
  fileSizeMB: number
  estimatedTokens: number
}

export interface LogFileInfo {
  name: string
  path: string
  size: number
  sizeMB: number
  extension: string
  modifiedTime: string
}

export interface LogMetadata {
  formatType: string
  encoding: string
  totalLines: number
  sampledLines: number
}
