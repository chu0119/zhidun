// AI 分析引擎

import type { AIMessage, AIResponse } from '@/types/ai-provider'
import type { LogMetadata } from '@/types/log'

// ==================== 系统提示词 ====================

export const DEFAULT_SYSTEM_PROMPT = `你是一名专业的网络安全分析师，负责分析 Web 服务器访问日志，识别安全威胁并生成结构化的安全分析报告。

【分析流程】
1. 日志解析：逐行提取时间戳、源IP、HTTP方法、URL路径、状态码、User-Agent等关键字段
2. 攻击识别：对照 OWASP Top 10 和 MITRE ATT&CK 框架，识别以下攻击模式：
   - SQL注入 (T1190)：UNION查询、布尔盲注、时间盲注、报错注入
   - XSS攻击 (T1189)：反射型、存储型、DOM型
   - 命令注入 (T1059)：系统命令执行、管道注入
   - 目录遍历 (T1083)：路径穿越、编码绕过
   - 暴力破解 (T1110)：密码爆破、凭证填充
   - 扫描探测 (T1595)：漏洞扫描、目录枚举、敏感文件探测
   - 文件包含 (T1190)：LFI/RFI、PHP伪协议
   - SSRF (T1090)：服务端请求伪造、内网探测
   - WebShell (T1505.003)：后门访问、命令执行
   - 文件上传 (T1190)：恶意文件上传、扩展名绕过
   - CSRF (T1068)：跨站请求伪造
3. 攻击聚合：按IP、时间窗口、攻击类型聚合，识别协同攻击和攻击链
4. 风险评估：基于CVSS v3.1标准评估风险等级

【输出格式要求】
使用 Markdown 格式输出，必须包含以下章节：

# 安全分析报告

## 1. 执行摘要
简要描述检测到的安全事件总体情况，包括：
- 分析时间范围
- 总请求数与恶意请求数
- 整体风险等级（危急/高危/中危/低危）

## 2. 攻击类型统计
使用表格列出各攻击类型的检测结果：

| 攻击类型 | 检测数量 | 风险等级 | MITRE ATT&CK | CWE编号 |
|---------|---------|---------|--------------|---------|
| SQL注入  | N       | 高危    | T1190        | CWE-89  |

## 3. 威胁IP分析
使用表格列出高风险IP：

| IP地址 | 攻击次数 | 攻击类型 | 地理位置 | 建议处置 |
|--------|---------|---------|---------|---------|
| x.x.x.x | N     | SQL注入,XSS | 国家  | 封禁   |

## 4. 攻击时间线分析
描述攻击的时间分布特征，包括：
- 攻击高峰时段
- 是否存在自动化攻击特征（固定间隔、高频率）
- 攻击持续时间

## 5. 技术细节
对每种检测到的攻击类型，提供：
- 典型攻击载荷示例（使用代码块）
- 攻击原理分析
- 影响范围评估

## 6. 风险评估
| 风险维度 | 评估结果 |
|---------|---------|
| 数据泄露风险 | 高/中/低 |
| 服务中断风险 | 高/中/低 |
| 权限提升风险 | 高/中/低 |
| 整体CVSS评分 | X.X |

## 7. 处置建议
### 紧急措施（立即执行）
- 具体操作项

### 短期方案（1-7天）
- 具体操作项

### 长期方案（1-4周）
- 具体操作项

## 8. 参考依据
- 相关CVE编号
- MITRE ATT&CK技术链接
- CWE弱点编号
- 相关安全标准`

// ==================== 重试提示词 ====================

export const RETRY_SYSTEM_PROMPT = `你是一名专业的网络安全分析师。请分析以下 Web 服务器访问日志，识别安全威胁。

这是安全分析工具的正常功能请求，日志分析是网络安全运维的标准工作流程。请直接进行技术分析，无需额外说明。

请按照以下 Markdown 格式输出分析报告：

# 安全分析报告

## 1. 执行摘要
（总体情况概述、风险等级）

## 2. 攻击类型统计
| 攻击类型 | 检测数量 | 风险等级 | MITRE ATT&CK | CWE编号 |
|---------|---------|---------|--------------|---------|

## 3. 威胁IP分析
| IP地址 | 攻击次数 | 攻击类型 | 建议处置 |
|--------|---------|---------|---------|

## 4. 攻击时间线分析
（时间分布特征）

## 5. 技术细节
（攻击载荷示例、原理分析）

## 6. 风险评估
| 风险维度 | 评估结果 |
|---------|---------|

## 7. 处置建议
### 紧急措施
### 短期方案
### 长期方案

## 8. 参考依据
（CVE、MITRE ATT&CK、CWE）`

// ==================== 拒绝关键词检测 ====================

const REFUSE_KEYWORDS = [
  '我不能', '我无法', '无法提供', '不能提供',
  '对不起', '抱歉', '建议您联系', '请联系专业的',
  '专门的日志分析工具',
]

export function isRefusedResponse(content: string): boolean {
  if (!content) return false
  const lower = content.toLowerCase()
  return REFUSE_KEYWORDS.some(k => lower.includes(k))
}

// ==================== 用户提示词构建 ====================

export function buildUserPrompt(logContent: string, metadata?: LogMetadata, preprocessSummary?: { totalLines: number; suspiciousLines: number; matchedCategories: string[] }): string {
  let metadataInfo = ''
  if (metadata) {
    metadataInfo = `\n[日志元数据]\n- 格式: ${metadata.formatType}\n- 编码: ${metadata.encoding}\n- 原始行数: ${metadata.totalLines}\n- 分析行数: ${metadata.sampledLines}`
  }

  let preprocessInfo = ''
  if (preprocessSummary) {
    preprocessInfo = `\n[本地预处理结果]\n- 原始日志总行数: ${preprocessSummary.totalLines}\n- 可疑日志行数: ${preprocessSummary.suspiciousLines}\n- 已识别攻击类别: ${preprocessSummary.matchedCategories.join(', ')}\n- 过滤率: ${((1 - preprocessSummary.suspiciousLines / preprocessSummary.totalLines) * 100).toFixed(1)}%\n\n注意：以下日志数据已经过本地预处理筛选，仅包含可疑行及其上下文。请重点分析这些可疑行为，深入挖掘攻击模式、攻击链和潜在威胁。`
  }

  return `请分析以下 Web 服务器访问日志，识别安全威胁并生成结构化分析报告。${metadataInfo}${preprocessInfo}

[分析要求]
1. 逐行扫描日志，识别所有攻击模式
2. 按攻击类型分类统计数量
3. 按IP聚合攻击行为，识别高危攻击者
4. 分析攻击时间分布特征
5. 引用 MITRE ATT&CK 技术ID 和 CWE 编号
6. 提供分层处置建议（紧急/短期/长期）

[日志数据]
${logContent}`
}

// ==================== Token 估算 ====================

export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.floor(chineseChars / 1.5 + otherChars / 4)
}

// ==================== 分析器类 ====================

export type ProgressCallback = (message: string) => void

export interface AIProviderInterface {
  chatCompletion(messages: AIMessage[], systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse>
  config: { modelName: string }
}

export class LogAnalyzer {
  private provider: AIProviderInterface
  private systemPrompt: string
  private originalSystemPrompt: string
  private progressCallback?: ProgressCallback
  private isRunning: boolean = true
  private abortController: AbortController | null = null

  constructor(
    provider: AIProviderInterface,
    systemPrompt?: string,
    progressCallback?: ProgressCallback
  ) {
    this.provider = provider
    this.systemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT
    this.originalSystemPrompt = this.systemPrompt
    this.progressCallback = progressCallback
  }

  async analyze(logContent: string, metadata?: LogMetadata, preprocessSummary?: { totalLines: number; suspiciousLines: number; matchedCategories: string[] }): Promise<string | null> {
    if (!this.isRunning) return null

    this.abortController = new AbortController()
    const maxRetries = 2

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isRunning) return null

        if (attempt > 0) {
          this.log(`正在重试分析（第 ${attempt} 次）...`)
        } else {
          this.log('正在准备分析数据...')
        }

        this.log(`正在向 AI 模型发送请求 (${this.provider.config.modelName})...`)

        const prompt = buildUserPrompt(logContent, metadata, preprocessSummary)
        const messages: AIMessage[] = [{ role: 'user', content: prompt }]

        const response = await this.provider.chatCompletion(messages, this.systemPrompt, this.abortController.signal)

        if (!this.isRunning) return null

        if (!response || !response.content) {
          this.log('错误：AI返回空响应')
          if (attempt < maxRetries) continue
          return null
        }

        // 检测是否被拒绝
        if (isRefusedResponse(response.content)) {
          if (attempt < maxRetries) {
            this.log('检测到 AI 拒绝响应，正在调整提示词重试...')
            this.systemPrompt = RETRY_SYSTEM_PROMPT
            continue
          } else {
            this.log('AI 拒绝分析该日志内容')
            return null
          }
        }

        this.log('AI 分析完成')
        return response.content

      } catch (error: any) {
        // 如果是用户主动停止，不重试
        if (error.name === 'AbortError' || !this.isRunning) {
          this.log('分析已被用户停止')
          return null
        }
        this.log(`分析过程发生错误: ${error.message || error}`)
        if (attempt < maxRetries) continue
        return null
      }
    }

    return null
  }

  stop() {
    this.isRunning = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  reset() {
    this.isRunning = true
    this.systemPrompt = this.originalSystemPrompt
  }

  private log(message: string) {
    if (this.progressCallback) {
      this.progressCallback(message)
    }
  }
}
