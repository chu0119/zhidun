// 常量定义 - 从 Python core/constants.py 移植

// 编码检测配置
export const ENCODING_SAMPLE_SIZE = 20000

// 加密配置
export const PBKDF2_ITERATIONS = 200000
export const ENCRYPTION_KEY_LENGTH = 32

// API 超时配置
export const DEFAULT_API_TIMEOUT = 60.0
export const MAX_API_TIMEOUT = 600.0

// 文件处理配置
export const MAX_LOG_FILE_SIZE = 100 * 1024 * 1024 * 1024 // 100GB（流式读取，无实际限制）
export const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB，超过此大小使用流式读取
export const DEFAULT_LINES_TO_ANALYZE = 1000
export const CHUNK_SIZE = 8192

// 默认 API 端点
export const DEFAULT_API_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  kimi: 'https://api.moonshot.ai/v1',
  wenxin: 'https://qianfan.baidubce.com/v2',
  siliconflow: 'https://api.siliconflow.cn/v1',
  mistral: 'https://api.mistral.ai/v1',
  xai: 'https://api.x.ai/v1',
  ollama: 'http://localhost:11434',
  lm_studio: 'http://localhost:1234/v1',
}

// 默认模型名称
export const DEFAULT_MODEL_NAMES: Record<string, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-v4-flash',
  qwen: 'qwen3-max',
  zhipu: 'glm-4.7',
  kimi: 'kimi-k2.6',
  wenxin: 'ernie-5.0',
  siliconflow: 'deepseek-ai/DeepSeek-V4-Flash',
  mistral: 'mistral-large-2512',
  xai: 'grok-4',
  ollama: 'llama3.3',
  lm_studio: 'local-model',
}

// 提供商信息
export const PROVIDER_INFO = [
  { name: 'lm_studio', label: 'LM Studio', description: '本地模型服务', defaultBaseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model', requiresApiKey: false },
  { name: 'ollama', label: 'Ollama', description: '本地大模型框架', defaultBaseUrl: 'http://localhost:11434', defaultModel: 'llama3.3', requiresApiKey: false },
  { name: 'openai', label: 'OpenAI', description: 'GPT-4.1 / o3 旗舰', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1', requiresApiKey: true },
  { name: 'anthropic', label: 'Anthropic', description: 'Claude 4 推理旗舰', defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', requiresApiKey: true },
  { name: 'gemini', label: 'Google Gemini', description: '多模态思考模型', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash', requiresApiKey: true },
  { name: 'deepseek', label: 'DeepSeek', description: '深度推理 V4', defaultBaseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-v4-flash', requiresApiKey: true },
  { name: 'qwen', label: '通义千问', description: '阿里 Qwen3 系列', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen3-max', requiresApiKey: true },
  { name: 'wenxin', label: '文心一言', description: '百度 ERNIE 5.0', defaultBaseUrl: 'https://qianfan.baidubce.com/v2', defaultModel: 'ernie-5.0', requiresApiKey: true },
  { name: 'zhipu', label: '智谱 AI', description: 'GLM-5 系列', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4.7', requiresApiKey: true },
  { name: 'kimi', label: 'Kimi', description: '月之暗面 K2', defaultBaseUrl: 'https://api.moonshot.ai/v1', defaultModel: 'kimi-k2.6', requiresApiKey: true },
  { name: 'siliconflow', label: '硅基流动', description: '模型聚合平台', defaultBaseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V4-Flash', requiresApiKey: true },
  { name: 'mistral', label: 'Mistral', description: '欧洲旗舰模型', defaultBaseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large-2512', requiresApiKey: true },
  { name: 'xai', label: 'xAI Grok', description: 'Grok-4 推理模型', defaultBaseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-4', requiresApiKey: true },
  { name: 'custom', label: '自定义', description: 'OpenAI 兼容接口', defaultBaseUrl: '', defaultModel: '', requiresApiKey: true },
] as const

// 历史记录配置
export const MAX_HISTORY_RECORDS = 50

// 分析配置
export const MAX_RETRY_ATTEMPTS = 2
export const DEFAULT_TEMPERATURE = 0.6
export const DEFAULT_MAX_TOKENS = 4096

// 支持的日志格式
export const SUPPORTED_LOG_FORMATS = ['.log', '.txt', '.csv', '.json', '.ndjson', '.jsonl']

// 攻击类型
export const ATTACK_TYPES = [
  'SQL 注入', 'XSS 跨站脚本', '命令注入', '路径遍历',
  '暴力破解', 'DDoS 攻击', '恶意文件上传', '其他',
]

// 风险等级
export const RISK_LEVELS = ['严重', '高危', '中危', '低危', '信息']

// 版本
declare const __APP_VERSION__: string
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.9.0'

// MITRE ATT&CK 战术颜色映射
export const MITRE_TACTIC_COLORS: Record<string, string> = {
  'TA0043': '#ff6b6b',  // Reconnaissance - 红
  'TA0001': '#ff8800',  // Initial Access - 橙
  'TA0002': '#ffcc00',  // Execution - 黄
  'TA0003': '#00ff88',  // Persistence - 绿
  'TA0004': '#00f0ff',  // Privilege Escalation - 青
  'TA0005': '#0088ff',  // Defense Evasion - 蓝
  'TA0006': '#b400ff',  // Credential Access - 紫
  'TA0007': '#ff00ff',  // Discovery - 品红
  'TA0009': '#ff0088',  // Collection - 玫红
  'TA0011': '#88ff00',  // Command and Control - 黄绿
  'TA0010': '#00ffcc',  // Exfiltration - 薄荷
  'TA0040': '#ff4444',  // Impact - 深红
}

// MITRE ATT&CK 战术名称映射
export const MITRE_TACTIC_NAMES: Record<string, string> = {
  'TA0043': '侦察',
  'TA0001': '初始访问',
  'TA0002': '执行',
  'TA0003': '持久化',
  'TA0004': '权限提升',
  'TA0005': '防御逃逸',
  'TA0006': '凭据访问',
  'TA0007': '发现',
  'TA0009': '收集',
  'TA0011': '命令与控制',
  'TA0010': '数据外传',
  'TA0040': '影响',
}
