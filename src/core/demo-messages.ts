// 演示级进度消息 - 用于分析过程展示

import type { AnalysisStatus } from '@/types/analysis'

interface DemoStore {
  addProgress: (message: string) => void
}

// 随机延迟 200-600ms
function randomDelay(): Promise<void> {
  const ms = 200 + Math.random() * 400
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 延迟指定时间
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 检查是否应该继续（用户可能已停止）
function shouldContinue(getStatus: () => AnalysisStatus): boolean {
  const s = getStatus()
  return s === 'preparing' || s === 'analyzing'
}

// ==================== 阶段一: 系统初始化 ====================

export async function showPhase1(store: DemoStore, modelName: string, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('>>> [阶段一：系统初始化与环境构建]')
  await randomDelay()

  const messages = [
    '[初始化] 正在启动日志分析核心引擎 v1.0.0...',
    '[配置] 正在加载安全策略配置文件...',
    '[规则库] 正在初始化威胁检测规则集...',
    '  ├─ Web应用攻击规则：1,247 条',
    '  ├─ 网络层攻击规则：856 条',
    '  └─ 恶意行为特征库：743 条',
    '[情报源] 正在同步外部威胁情报数据库...',
    '  ├─ CVE漏洞数据库：已同步',
    '  ├─ IOC威胁指标库：已同步（128,456 条记录）',
    '  └─ 攻击模式特征库：已同步（3,824 种模式）',
    '[AI引擎] 正在初始化自然语言处理模块...',
    '  ├─ 词向量模型：加载完成',
    '  ├─ 语义分析器：就绪',
    '  └─ 上下文理解引擎：已启动',
    `[连接] 正在与 ${modelName} 建立安全通信通道...`,
    '[认证] TLS 1.3 握手成功，身份验证完成',
    '[状态] AI 分析引擎已就绪，等待数据注入...',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

// ==================== 阶段二: 数据注入与预处理 ====================

interface Phase2Params {
  format: string
  encoding: string
  sizeMB: string
  totalLines: number
  sampledLines: number
  tokens: number
}

export async function showPhase2(store: DemoStore, params: Phase2Params, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段二：数据注入与取证预处理]')
  await randomDelay()

  const messages = [
    '[读取] 正在打开日志文件流...',
    `[识别] 日志格式: ${params.format}`,
    `[编码] 文件编码: ${params.encoding}`,
    `[统计] 文件大小: ${params.sizeMB} MB`,
    `[采样] 原始日志: ${params.totalLines} 行 → 采样后: ${params.sampledLines} 行`,
    `[压缩] 压缩比: ${(params.totalLines / Math.max(params.sampledLines, 1)).toFixed(1)}x`,
    `[估算] 预计Token数: ${params.tokens}`,
    `[注入] 成功加载 ${params.sampledLines} 条日志记录到内存缓冲区`,
    '[预处理] 正在执行数据范式化与清洗...',
    '  ├─ 智能采样：威胁特征优先级排序完成',
    '  ├─ 上下文保留：高分行前后2行已关联',
    '  ├─ 空行过滤：已清除空白记录',
    '  ├─ 字符编码标准化：UTF-8',
    '  ├─ 数据压缩：已启用智能压缩',
    `  └─ Token优化：已控制在 ${params.tokens} 以内`,
    '[特征提取] 正在提取 IOC（攻击指标）特征向量...',
    '  ├─ IP地址提取：完成',
    '  ├─ URL路径解析：完成',
    '  ├─ User-Agent指纹识别：完成',
    '  ├─ HTTP方法与状态码分析：完成',
    '  ├─ 请求参数提取：完成',
    '  └─ 基础编码检测：完成',
    '[模式匹配] 正在应用启发式分析算法...',
    '  ├─ SQL注入特征匹配：扫描中...',
    '  ├─ XSS攻击载荷检测：扫描中...',
    '  ├─ 命令注入模式识别：扫描中...',
    '  ├─ 路径遍历检测：扫描中...',
    '  └─ 暴力破解行为分析：扫描中...',
    '[行为分析] 正在构建访问行为基线...',
    '  ├─ 频率统计：完成',
    '  ├─ 时间序列分析：完成',
    '  ├─ 异常检测：发现可疑模式',
    '  └─ 关联分析：完成',
    '[封装] 正在准备AI推理请求负载...',
    '  ├─ 数据序列化：完成',
    '  ├─ 压缩算法：LZMA',
    '  ├─ 加密封装：AES-256-GCM',
    `  └─ 请求构建完成，大小：${Math.round(params.tokens * 0.004)} KB`,
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

// ==================== 阶段三: AI 深度认知分析 ====================

export async function showPhase3Pre(store: DemoStore, modelName: string, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段三：AI 深度认知分析]')
  await randomDelay()

  const messages = [
    `[传输] 正在向 ${modelName} 发送分析请求...`,
    '[推理] AI 模型正在执行深度语义分析...',
    '  ├─ 威胁识别：进行中...',
    '  ├─ 攻击链重构：进行中...',
    '  ├─ 意图分析：进行中...',
    '  ├─ 风险评估：进行中...',
    '  └─ 处置建议生成：进行中...',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await delay(150) // 这个阶段稍快，因为后面要等真实 AI 响应
  }
}

export async function showPhase3Post(store: DemoStore, responseSizeKB: number, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  const messages = [
    `[响应] 已接收 AI 分析结果，响应大小：${responseSizeKB} KB`,
    '[验证] 正在验证响应完整性与签名...',
    '  ├─ SHA256 校验：通过',
    '  ├─ 数字签名验证：通过',
    '  └─ 格式解析：成功',
    '[关联] 正在与威胁情报库进行交叉验证...',
    '  ├─ CVE 匹配：已关联已知漏洞',
    '  ├─ IOC 关联：匹配已知威胁指标',
    '  └─ ATT&CK 框架映射：完成',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

// ==================== 阶段四: 报告生成 ====================

export async function showPhase4(store: DemoStore, elapsed: string, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段四：生成最终报告与可视化图表]')
  await randomDelay()

  const messages = [
    '[报告] 正在生成结构化安全分析报告...',
    '  ├─ Markdown 格式化：完成',
    '  ├─ 章节索引生成：完成',
    '  ├─ 关键发现高亮：完成',
    '  └─ 可操作建议提取：完成',
    '[可视化] 正在渲染数据图表...',
    '  ├─ 攻击类型分布图：饼图渲染完成',
    '  ├─ 风险等级统计图：柱状图渲染完成',
    '  ├─ 时间线分析图：折线图渲染完成',
    '  └─ 攻击源IP统计图：横向柱图渲染完成',
    '[质量检查] 正在执行输出质量验证...',
    '  ├─ 报告完整性检查：通过',
    '  ├─ 图表清晰度检查：通过',
    '  ├─ 数据一致性检查：通过',
    '  └─ 格式标准检查：通过',
    '[完成] 分析报告生成完毕，已缓存到内存',
    '[系统] 正在显示分析结果...',
    '',
    `--- 分析完成 (用时: ${elapsed}) ---`,
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

// ==================== 本地规则分析演示消息 ====================

export async function showLocalAnalysisPhase1(store: DemoStore, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('>>> [阶段一：本地规则引擎初始化]')
  await randomDelay()

  const messages = [
    '[初始化] 正在启动本地规则分析引擎 v1.0.0...',
    '[规则库] 正在加载 OWASP Top 10 检测规则...',
    '  ├─ SQL注入检测规则：10 条',
    '  ├─ XSS攻击检测规则：8 条',
    '  ├─ 命令注入检测规则：6 条',
    '  ├─ 目录遍历检测规则：5 条',
    '  ├─ 暴力破解检测规则：5 条',
    '  ├─ 扫描探测检测规则：6 条',
    '  ├─ SSRF攻击检测规则：4 条',
    '  ├─ 文件包含检测规则：4 条',
    '  ├─ 文件上传检测规则：4 条',
    '  ├─ WebShell检测规则：5 条',
    '  └─ 信息泄露检测规则：5 条',
    '[规则库] 正在加载 ModSecurity CRS 规则集...',
    '  ├─ CRS 核心规则：已加载',
    '  ├─ OWASP CRS 补充规则：已加载',
    '  └─ 自定义规则集：已加载',
    '[引擎] 规则编译完成，共 58 条正则模式',
    '[状态] 本地规则引擎已就绪，等待数据扫描...',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

export async function showLocalAnalysisPhase2(store: DemoStore, params: { format: string; encoding: string; sizeMB: string; totalLines: number }, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段二：日志数据预处理]')
  await randomDelay()

  const messages = [
    '[读取] 正在打开日志文件流...',
    `[识别] 日志格式: ${params.format}`,
    `[编码] 文件编码: ${params.encoding}`,
    `[统计] 文件大小: ${params.sizeMB} MB`,
    `[统计] 总行数: ${params.totalLines} 行`,
    '[预处理] 正在执行数据清洗...',
    '  ├─ 空行过滤：完成',
    '  ├─ 编码标准化：UTF-8',
    '  └─ 行分割：完成',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

export async function showLocalAnalysisPhase3(store: DemoStore, totalLines: number, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段三：规则匹配扫描]')
  await randomDelay()

  const messages = [
    `[扫描] 正在逐行匹配 ${totalLines} 条日志记录...`,
    '  ├─ SQL注入模式匹配：扫描中...',
    '  ├─ XSS攻击载荷检测：扫描中...',
    '  ├─ 命令注入模式识别：扫描中...',
    '  ├─ 路径遍历检测：扫描中...',
    '  ├─ 暴力破解行为分析：扫描中...',
    '  ├─ 扫描探测特征识别：扫描中...',
    '  ├─ SSRF攻击检测：扫描中...',
    '  ├─ 文件包含检测：扫描中...',
    '  ├─ 文件上传检测：扫描中...',
    '  ├─ WebShell特征匹配：扫描中...',
    '  └─ 信息泄露检测：扫描中...',
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}

export async function showLocalAnalysisPhase4(store: DemoStore, matchCount: number, elapsed: string, getStatus: () => AnalysisStatus) {
  if (!shouldContinue(getStatus)) return

  store.addProgress('')
  store.addProgress('>>> [阶段四：生成分析报告]')
  await randomDelay()

  const messages = [
    `[统计] 规则匹配完成，共发现 ${matchCount} 条告警`,
    '[报告] 正在生成结构化安全分析报告...',
    '  ├─ 告警分类统计：完成',
    '  ├─ 风险等级评估：完成',
    '  ├─ 处置建议生成：完成',
    '  └─ 参考依据整理：完成',
    '[完成] 本地规则分析报告生成完毕',
    '',
    `--- 分析完成 (用时: ${elapsed}) ---`,
  ]

  for (const msg of messages) {
    if (!shouldContinue(getStatus)) return
    store.addProgress(msg)
    await randomDelay()
  }
}
