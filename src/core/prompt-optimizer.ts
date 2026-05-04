// AI 提示词优化和上下文管理

import type { LogMetadata } from '@/types/log'
import type { RuleAnalysisResult } from './rule-engine'

// 提示词模板库
export const PROMPT_TEMPLATES = {
  // 基础分析提示词
  BASIC: `你是一名专业的网络安全分析师，负责分析 Web 服务器访问日志，识别安全威胁。
  
【分析框架】
使用 OWASP Top 10 和 MITRE ATT&CK 框架进行分析。

【输出格式】
使用 Markdown 格式，必须包含以下章节：
- 执行摘要
- 攻击类型统计
- 威胁IP分析
- 攻击时间线分析
- 技术细节
- 风险评估
- 处置建议`,

  // 误报减少提示词
  REDUCE_FALSE_POSITIVES: `你是一名有 10 年安全经验的分析师。
  
【重点任务】
识别真正的攻击，避免误报。对以下情况需要特别谨慎：
- 正常的扫描器活动（如 Googlebot、curl 请求）
- 常见的白名单工具（如 Nmap、Nikto）
- CDN 和代理服务器的流量
- 自动化的健康检查请求

【输出要求】
- 只标记确实有威胁的活动
- 标注可能是误报的情况
- 提供置信度评分（高/中/低）`,

  // 高级威胁检测提示词
  ADVANCED_THREATS: `你是一名 APT 分析专家。
  
【高级威胁特征】
关注以下高级持续威胁指标：
- 多阶段攻击链（侦察 → 漏洞利用 → 后渗透）
- 时间关联性（同一攻击者多个时间窗口内的活动）
- IP相关性（代理链、僵尸网络）
- 工具指纹识别（特定工具的特征模式）
- 数据外泄迹象

【输出要求】
- 识别可能的攻击链
- 评估对手的复杂程度
- 关联可能的威胁行为体`,

  // 合规性分析提示词
  COMPLIANCE: `你是一名合规安全顾问。
  
【合规框架】
分析日志中与以下框架相关的安全事件：
- GDPR：个人数据访问、泄露风险
- HIPAA：医疗信息保护、审计日志
- PCI-DSS：支付卡数据保护
- ISO 27001：信息安全管理

【输出要求】
- 关联到具体的合规要求
- 提供补救措施
- 生成可用于审计的报告`,
}

// 用户自定义提示词
let customPrompt: string | null = null

// 设置自定义提示词
export function setCustomPrompt(prompt: string): void {
  customPrompt = prompt
}

// 获取当前提示词
export function getCurrentPrompt(): string {
  return customPrompt || PROMPT_TEMPLATES.BASIC
}

// 构建增强的系统提示词（基于分析上下文）
export function buildEnhancedSystemPrompt(
  basePrompt: string = PROMPT_TEMPLATES.BASIC,
  context?: {
    ruleResult?: RuleAnalysisResult
    metadata?: LogMetadata
    focusAreas?: string[] // 'false-positives', 'advanced-threats', 'compliance' 等
  }
): string {
  let enhancedPrompt = basePrompt

  // 添加规则引擎的初步结果
  if (context?.ruleResult) {
    const { summary, categoryStats } = context.ruleResult
    enhancedPrompt += `\n\n【本地规则引擎初步扫描结果】
- 关键威胁: ${summary.critical} 个
- 高危威胁: ${summary.high} 个
- 中危威胁: ${summary.medium} 个
- 低危威胁: ${summary.low} 个
- 主要攻击类型: ${Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat)
      .join(', ')}`
  }

  // 添加文件元数据信息
  if (context?.metadata) {
    enhancedPrompt += `\n\n【日志文件信息】
- 格式: ${context.metadata.formatType}
- 编码: ${context.metadata.encoding}
- 总行数: ${context.metadata.totalLines.toLocaleString()}
- 分析行数: ${context.metadata.sampledLines.toLocaleString()}
- 采样率: ${((context.metadata.sampledLines / context.metadata.totalLines) * 100).toFixed(1)}%`
  }

  // 添加特定关注领域的提示
  if (context?.focusAreas) {
    if (context.focusAreas.includes('false-positives')) {
      enhancedPrompt += `\n\n【重点关注】
请特别关注误报减少，只标记真正的攻击。`
    }
    if (context.focusAreas.includes('advanced-threats')) {
      enhancedPrompt += `\n\n【重点关注】
请关注高级持续威胁指标，识别多步骤攻击链。`
    }
    if (context.focusAreas.includes('compliance')) {
      enhancedPrompt += `\n\n【重点关注】
请关联到合规框架，提供审计报告所需的信息。`
    }
  }

  return enhancedPrompt
}

// 基于用户反馈优化提示词
export interface UserFeedback {
  analysisId: string
  isAccurate: boolean
  feedback: string
  falsePositives?: string[] // 误报的规则或类型
  missingDetections?: string[] // 漏检的威胁类型
}

export class PromptOptimizer {
  private feedbackHistory: UserFeedback[] = []
  private optimizationFactor = 1.0

  recordFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback)

    // 根据反馈调整优化因子
    if (!feedback.isAccurate) {
      this.optimizationFactor *= 0.95 // 降低因子，更谨慎
    } else {
      this.optimizationFactor = Math.min(1.0, this.optimizationFactor * 1.02) // 提高因子，但不超过1.0
    }
  }

  // 生成优化后的提示词
  getOptimizedPrompt(): string {
    const basePrompt = getCurrentPrompt()

    // 收集常见的误报和漏检
    const commonFalsePositives: Set<string> = new Set()
    const commonMissingDetections: Set<string> = new Set()

    for (const feedback of this.feedbackHistory) {
      if (feedback.falsePositives) {
        feedback.falsePositives.forEach(f => commonFalsePositives.add(f))
      }
      if (feedback.missingDetections) {
        feedback.missingDetections.forEach(m => commonMissingDetections.add(m))
      }
    }

    let optimized = basePrompt

    // 添加基于历史反馈的指导
    if (commonFalsePositives.size > 0) {
      optimized += `\n\n【历史误报警告】
基于之前的反馈，以下类型容易产生误报，请特别关注：
${Array.from(commonFalsePositives)
  .map(x => `- ${x}`)
  .join('\n')}`
    }

    if (commonMissingDetections.size > 0) {
      optimized += `\n\n【历史漏检警告】
基于之前的反馈，以下类型容易被漏检，请特别关注：
${Array.from(commonMissingDetections)
  .map(x => `- ${x}`)
  .join('\n')}`
    }

    // 根据优化因子调整指导
    if (this.optimizationFactor < 0.95) {
      optimized += `\n\n【特别说明】
基于历史反馈，建议降低置信度阈值，避免漏检。优先报告可能的威胁，而不是过度过滤。`
    }

    return optimized
  }

  getStatistics() {
    const total = this.feedbackHistory.length
    const accurate = this.feedbackHistory.filter(f => f.isAccurate).length
    return {
      totalFeedback: total,
      accurateRate: total > 0 ? (accurate / total) * 100 : 0,
      optimizationFactor: this.optimizationFactor,
    }
  }
}

// 全局优化器实例
export const globalPromptOptimizer = new PromptOptimizer()
