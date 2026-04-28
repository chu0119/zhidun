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
export const MAX_LOG_FILE_SIZE = 100 * 1024 * 1024 // 100MB
export const DEFAULT_LINES_TO_ANALYZE = 1000
export const CHUNK_SIZE = 8192

// 默认 API 端点
export const DEFAULT_API_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  kimi: 'https://api.moonshot.cn/v1',
  wenxin: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
  ollama: 'http://localhost:11434',
  lm_studio: 'http://localhost:1234/v1',
  openai: 'https://api.openai.com/v1',
}

// 默认模型名称
export const DEFAULT_MODEL_NAMES: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  zhipu: 'glm-4-flash',
  kimi: 'moonshot-v1-8k',
  wenxin: 'ernie-bot-turbo',
  ollama: 'llama2',
  lm_studio: 'local-model',
  openai: 'gpt-3.5-turbo',
}

// 提供商信息
export const PROVIDER_INFO = [
  { name: 'lm_studio', label: 'LM Studio', description: '本地模型服务', defaultBaseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model', requiresApiKey: false },
  { name: 'ollama', label: 'Ollama', description: '本地大模型运行框架', defaultBaseUrl: 'http://localhost:11434', defaultModel: 'llama2', requiresApiKey: false },
  { name: 'deepseek', label: 'DeepSeek', description: '深度求索 AI', defaultBaseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', requiresApiKey: true },
  { name: 'qwen', label: '通义千问', description: '阿里云大模型', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo', requiresApiKey: true },
  { name: 'wenxin', label: '文心一言', description: '百度大语言模型', defaultBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat', defaultModel: 'ernie-bot-turbo', requiresApiKey: true },
  { name: 'zhipu', label: '智谱 AI', description: '清华智谱 GLM', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash', requiresApiKey: true },
  { name: 'kimi', label: 'Kimi', description: '月之暗面大模型', defaultBaseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k', requiresApiKey: true },
  { name: 'custom', label: '自定义', description: 'OpenAI 兼容接口', defaultBaseUrl: '', defaultModel: '', requiresApiKey: true },
] as const

// 历史记录配置
export const MAX_HISTORY_RECORDS = 100

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
export const APP_VERSION = '1.0.0'
