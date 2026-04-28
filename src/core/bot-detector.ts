// Bot/爬虫识别模块
// 从 User-Agent 识别流量来源类型

export interface BotInfo {
  category: 'search_engine' | 'benign_bot' | 'malicious_scanner' | 'normal' | 'unknown'
  name: string
  confidence: number
}

export interface BotStat {
  category: BotInfo['category']
  name: string
  count: number
  sampleUA: string
}

// User-Agent 签名规则库
interface UARule {
  pattern: RegExp
  category: BotInfo['category']
  name: string
  confidence: number
}

const UA_RULES: UARule[] = [
  // ---- 搜索引擎 ----
  { pattern: /Googlebot/i, category: 'search_engine', name: 'Googlebot', confidence: 0.95 },
  { pattern: /bingbot/i, category: 'search_engine', name: 'Bingbot', confidence: 0.95 },
  { pattern: /Baiduspider/i, category: 'search_engine', name: 'Baiduspider', confidence: 0.95 },
  { pattern: /YandexBot/i, category: 'search_engine', name: 'YandexBot', confidence: 0.95 },
  { pattern: /DuckDuckBot/i, category: 'search_engine', name: 'DuckDuckBot', confidence: 0.95 },
  { pattern: /Sogou.*Spider/i, category: 'search_engine', name: 'Sogou Spider', confidence: 0.9 },
  { pattern: /bytespider/i, category: 'search_engine', name: 'ByteSpider', confidence: 0.9 },
  { pattern: /Applebot/i, category: 'search_engine', name: 'Applebot', confidence: 0.9 },
  { pattern: /Slurp/i, category: 'search_engine', name: 'Yahoo Slurp', confidence: 0.9 },

  // ---- 良性爬虫 ----
  { pattern: /archive\.org_bot/i, category: 'benign_bot', name: 'Archive.org', confidence: 0.9 },
  { pattern: /Slackbot/i, category: 'benign_bot', name: 'Slackbot', confidence: 0.9 },
  { pattern: /Discordbot/i, category: 'benign_bot', name: 'Discordbot', confidence: 0.9 },
  { pattern: /Twitterbot/i, category: 'benign_bot', name: 'Twitterbot', confidence: 0.9 },
  { pattern: /facebookexternalhit/i, category: 'benign_bot', name: 'Facebook Bot', confidence: 0.9 },
  { pattern: /LinkedInBot/i, category: 'benign_bot', name: 'LinkedInBot', confidence: 0.9 },
  { pattern: /WhatsApp/i, category: 'benign_bot', name: 'WhatsApp', confidence: 0.9 },
  { pattern: /TelegramBot/i, category: 'benign_bot', name: 'TelegramBot', confidence: 0.9 },
  { pattern: /Google-InspectionTool/i, category: 'benign_bot', name: 'Google Inspection', confidence: 0.9 },
  { pattern: /AhrefsBot/i, category: 'benign_bot', name: 'AhrefsBot', confidence: 0.85 },
  { pattern: /SemrushBot/i, category: 'benign_bot', name: 'SemrushBot', confidence: 0.85 },
  { pattern: /MJ12bot/i, category: 'benign_bot', name: 'MJ12bot', confidence: 0.85 },
  { pattern: /DotBot/i, category: 'benign_bot', name: 'DotBot', confidence: 0.85 },
  { pattern: /PetalBot/i, category: 'benign_bot', name: 'PetalBot', confidence: 0.85 },

  // ---- 恶意扫描器 ----
  { pattern: /sqlmap/i, category: 'malicious_scanner', name: 'sqlmap', confidence: 0.99 },
  { pattern: /nikto/i, category: 'malicious_scanner', name: 'Nikto', confidence: 0.99 },
  { pattern: /nmap/i, category: 'malicious_scanner', name: 'Nmap', confidence: 0.95 },
  { pattern: /masscan/i, category: 'malicious_scanner', name: 'masscan', confidence: 0.99 },
  { pattern: /nuclei/i, category: 'malicious_scanner', name: 'Nuclei', confidence: 0.99 },
  { pattern: /dirsearch/i, category: 'malicious_scanner', name: 'dirsearch', confidence: 0.99 },
  { pattern: /gobuster/i, category: 'malicious_scanner', name: 'Gobuster', confidence: 0.99 },
  { pattern: /ffuf/i, category: 'malicious_scanner', name: 'ffuf', confidence: 0.95 },
  { pattern: /feroxbuster/i, category: 'malicious_scanner', name: 'feroxbuster', confidence: 0.99 },
  { pattern: /wfuzz/i, category: 'malicious_scanner', name: 'wfuzz', confidence: 0.99 },
  { pattern: /dirbuster/i, category: 'malicious_scanner', name: 'DirBuster', confidence: 0.99 },
  { pattern: /hydra/i, category: 'malicious_scanner', name: 'Hydra', confidence: 0.95 },
  { pattern: /medusa/i, category: 'malicious_scanner', name: 'Medusa', confidence: 0.9 },
  { pattern: /burpsuite/i, category: 'malicious_scanner', name: 'Burp Suite', confidence: 0.99 },
  { pattern: /acunetix/i, category: 'malicious_scanner', name: 'Acunetix', confidence: 0.99 },
  { pattern: /appscan/i, category: 'malicious_scanner', name: 'AppScan', confidence: 0.9 },
  { pattern: /w3af/i, category: 'malicious_scanner', name: 'w3af', confidence: 0.99 },
  { pattern: /owasp\s*zap/i, category: 'malicious_scanner', name: 'OWASP ZAP', confidence: 0.99 },
  { pattern: /ZmEu/i, category: 'malicious_scanner', name: 'ZmEu', confidence: 0.99 },
  { pattern: /Havij/i, category: 'malicious_scanner', name: 'Havij', confidence: 0.99 },
  { pattern: /metasploit/i, category: 'malicious_scanner', name: 'Metasploit', confidence: 0.99 },
  { pattern: /cobalt\s*strike/i, category: 'malicious_scanner', name: 'Cobalt Strike', confidence: 0.95 },
  { pattern: /xsser/i, category: 'malicious_scanner', name: 'XSSer', confidence: 0.95 },
  { pattern: /commix/i, category: 'malicious_scanner', name: 'commix', confidence: 0.99 },
  { pattern: /subfinder/i, category: 'malicious_scanner', name: 'Subfinder', confidence: 0.9 },
  { pattern: /amass/i, category: 'malicious_scanner', name: 'Amass', confidence: 0.9 },
  { pattern: /zmap/i, category: 'malicious_scanner', name: 'ZMap', confidence: 0.99 },
  { pattern: /censys/i, category: 'malicious_scanner', name: 'Censys', confidence: 0.85 },
  { pattern: /shodan/i, category: 'malicious_scanner', name: 'Shodan', confidence: 0.85 },

  // ---- 正常浏览器 ----
  { pattern: /Chrome\/[\d.]+/i, category: 'normal', name: 'Chrome', confidence: 0.7 },
  { pattern: /Firefox\/[\d.]+/i, category: 'normal', name: 'Firefox', confidence: 0.7 },
  { pattern: /Safari\/[\d.]+/i, category: 'normal', name: 'Safari', confidence: 0.6 },
  { pattern: /Edg\/[\d.]+/i, category: 'normal', name: 'Edge', confidence: 0.7 },
  { pattern: /OPR\/[\d.]+/i, category: 'normal', name: 'Opera', confidence: 0.7 },
  { pattern: /Trident\/[\d.]+/i, category: 'normal', name: 'IE', confidence: 0.7 },

  // ---- 脚本/工具 ----
  { pattern: /python-requests/i, category: 'malicious_scanner', name: 'python-requests', confidence: 0.7 },
  { pattern: /Go-http-client/i, category: 'malicious_scanner', name: 'Go-http-client', confidence: 0.6 },
  { pattern: /libwww-perl/i, category: 'malicious_scanner', name: 'libwww-perl', confidence: 0.7 },
  { pattern: /Wget/i, category: 'malicious_scanner', name: 'Wget', confidence: 0.6 },
  { pattern: /curl\//i, category: 'malicious_scanner', name: 'curl', confidence: 0.5 },
  { pattern: /HttpClient/i, category: 'malicious_scanner', name: 'HttpClient', confidence: 0.5 },
  { pattern: /Java\/[\d.]+/i, category: 'malicious_scanner', name: 'Java Client', confidence: 0.5 },
]

// 检测单个 User-Agent
export function detectBot(userAgent: string): BotInfo {
  if (!userAgent || userAgent.trim() === '') {
    return { category: 'unknown', name: 'Empty UA', confidence: 1.0 }
  }

  for (const rule of UA_RULES) {
    if (rule.pattern.test(userAgent)) {
      return { category: rule.category, name: rule.name, confidence: rule.confidence }
    }
  }

  // 未知 UA
  return { category: 'unknown', name: 'Unknown', confidence: 0.5 }
}

// 从日志行中提取 User-Agent
function extractUserAgent(line: string): string {
  // 常见日志格式中的 UA 提取
  const uaMatch = line.match(/User-Agent:\s*([^"]+?)(?:\s*"|\s*$)/i)
    || line.match(/"([^"]*(?:Mozilla|Chrome|Firefox|Safari|bot|spider|crawl|scan)[^"]*)"/i)
    || line.match(/"[^"]*"\s+"[^"]*"\s+"([^"]+)"/i)  // Combined Log Format UA field
  return uaMatch ? uaMatch[1].trim() : ''
}

// 从日志行中提取 IP
function extractIP(line: string): string {
  const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
  return ipMatch ? ipMatch[1] : 'unknown'
}

// 分析所有日志行，返回 Bot 统计
export function detectBots(lines: string[]): BotStat[] {
  const statsMap = new Map<string, BotStat>()

  for (const line of lines) {
    const ua = extractUserAgent(line)
    if (!ua) continue

    const botInfo = detectBot(ua)
    const key = `${botInfo.category}::${botInfo.name}`

    if (statsMap.has(key)) {
      statsMap.get(key)!.count++
    } else {
      statsMap.set(key, {
        category: botInfo.category,
        name: botInfo.name,
        count: 1,
        sampleUA: ua.substring(0, 200),
      })
    }
  }

  return [...statsMap.values()].sort((a, b) => b.count - a.count)
}
