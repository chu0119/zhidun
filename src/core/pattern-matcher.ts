// 攻击模式匹配器 - 从 Python utils/pattern_matcher.py 移植

// 攻击类型模式定义 (使用 i 标志代替 Python 的 (?i))
const ATTACK_PATTERNS: Record<string, RegExp[]> = {
  SQL注入: [
    /(union\s+select|'\s*or\s*'1'\s*='\s*1|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)/i,
    /(\|\|.*\|\||1'\s*=\s*'1|admin'--|';\s*drop|exec\s*\(|xp_cmdshell)/i,
    /(\bor\s+1\s*=\s*1\b|\bwaitfor\s+delay\b|\bsleep\s*\(\s*\d)/i,
  ],
  XSS攻击: [
    /(<script[^>]*>.*?<\/script>|javascript:|onerror\s*=|onload\s*=|onclick\s*=)/i,
    /(<img[^>]*onerror|<iframe[^>]*src=|<svg[^>]*onload|eval\s*\(|alert\s*\()/i,
    /(fromCharCode|String\.fromCharCode|document\.cookie|document\.location)/i,
  ],
  命令注入: [
    /(;\s*cat\s+\/|;\s*ls\s+-la|;\s*whoami|;\s*pwd|;\s*id\s*;)/i,
    /(pipeline\s*get|powershell\s*-|cmd\.exe|\/bin\/sh|\/bin\/bash)/i,
    /(\|s*cat\s*\|&&\s*rm\s*-rf|`.*\$\(.*\)`)/i,
  ],
  目录遍历: [
    /(\.\.\/\.\.\/|\.\.\\ \.\.\\|%2e%2e%2f|%252e%252e%252f)/i,
    /(\.\.[\\\/]|\.\.%2f|\.\.%5c|\/etc\/passwd|\/windows\/system32)/i,
  ],
  暴力破解: [
    /(password\s*[:=]\s*['"][^'"]+['"]|pass\s*[:=]\s*\w+|pwd\s*[:=]\s*\w+)/i,
    /(admin.*login|root.*login|test.*login|user.*login)/i,
    /(POST\s+\/login|POST\s+\/signin|POST\s+\/auth)/i,
  ],
  扫描探测: [
    /(nmap|nikto|sqlmap|nessus|burp|owasp|zap|w3af|acunetix)/i,
    /(\/admin|\/administrator|\/wp-admin|\/phpmyadmin|\/manager|\/console)/i,
    /(robot\.txt|\.git\/|\.env|\.bak|config\.php|web\.xml)/i,
  ],
  CSRF攻击: [
    /(csrf_token|csrf|_token|authenticity_token)/i,
    /(<input[^>]*name=['"]?token|<form[^>]*action=['"][^'"]*logout)/i,
  ],
  文件包含: [
    /(include\s*\(|require\s*\(|file_get_contents\s*\(|fopen\s*\()/i,
    /(php:\/\/input|php:\/\/filter|data:\/\/|expect:\/\/|zip:\/\/)/i,
  ],
  SSRF攻击: [
    /(url\s*=\s*http|dest\s*=\s*http|target\s*=\s*http|endpoint\s*=\s*http)/i,
    /(file:\/\/|http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/169\.254\.169)/i,
  ],
  文件上传: [
    /(multipart\/form-data|filename\s*=|\.exe|\.php|\.jsp|\.asp|\.sh)/i,
    /(upload\.php|upload\.jsp|doUpload|file_upload)/i,
  ],
}

// 风险等级映射
const RISK_RULES: Record<string, [string, boolean][]> = {
  危急: [['SQL注入', true], ['命令注入', true], ['XSS攻击', true], ['目录遍历', true]],
  高危: [['暴力破解', true], ['文件包含', true], ['SSRF攻击', true]],
  中危: [['扫描探测', true], ['CSRF攻击', true]],
  低危: [['文件上传', false]],
}

function detectAttackType(line: string): string | null {
  for (const [attackType, patterns] of Object.entries(ATTACK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) return attackType
    }
  }
  return null
}

export function analyzeFromLog(lines: string[], maxLines: number = 1000): {
  attackTypes: Record<string, number>
  riskLevels: Record<string, number>
} {
  const attackCounts: Record<string, number> = {}
  const sampleLines = lines.slice(0, maxLines)

  for (const line of sampleLines) {
    const detected = detectAttackType(line)
    if (detected) {
      attackCounts[detected] = (attackCounts[detected] || 0) + 1
    }
  }

  // 计算风险等级
  const riskCounts: Record<string, number> = { 危急: 0, 高危: 0, 中危: 0, 低危: 0 }

  for (const [attackType, count] of Object.entries(attackCounts)) {
    let assigned = false
    for (const [riskLevel, rules] of Object.entries(RISK_RULES)) {
      for (const [ruleAttack] of rules) {
        if (attackType.includes(ruleAttack)) {
          riskCounts[riskLevel] += count
          assigned = true
          break
        }
      }
      if (assigned) break
    }
    if (!assigned) riskCounts['中危'] += count
  }

  return { attackTypes: attackCounts, riskLevels: riskCounts }
}

export function extractFromReport(reportText: string): {
  attackTypes: Record<string, number>
  riskLevels: Record<string, number>
} {
  const attackTypes: string[] = []
  const riskLevels: string[] = []

  // 攻击类型模式
  const attackPatterns = [
    /事件类型[:：]\s*([^\n]+)/g,
    /攻击类型[:：]\s*([^\n]+)/g,
    /检测到[:：]\s*([^\n]+?)(?:攻击|活动)/g,
    /发现[:：]\s*([^\n]+?)(?:攻击|尝试|威胁)/g,
  ]

  for (const pattern of attackPatterns) {
    let match
    while ((match = pattern.exec(reportText)) !== null) {
      const attack = match[1].trim().replace(/[、，,。]/g, '')
      if (attack) attackTypes.push(attack)
    }
  }

  // 关键词匹配
  if (attackTypes.length === 0) {
    const keywords: Record<string, string[]> = {
      SQL注入: ['SQL注入', 'SQL Injection', 'union select', 'sql注入'],
      XSS攻击: ['XSS', '跨站脚本', '跨站攻击', 'Cross-site scripting'],
      命令注入: ['命令注入', 'Command Injection', '命令执行', 'RCE'],
      目录遍历: ['目录遍历', '路径穿越', 'Directory Traversal', 'Path Traversal'],
      暴力破解: ['暴力破解', 'Brute Force', '密码爆破', '凭证爆破'],
      扫描探测: ['扫描', '探测', 'Scanning', 'Probing', '漏洞扫描'],
      CSRF攻击: ['CSRF', '跨站请求伪造'],
      文件包含: ['文件包含', 'File Inclusion', 'LFI', 'RFI'],
      SSRF攻击: ['SSRF', '服务端请求伪造'],
      文件上传: ['文件上传', 'File Upload', '恶意文件'],
    }

    for (const [type, kws] of Object.entries(keywords)) {
      for (const kw of kws) {
        if (reportText.includes(kw)) {
          attackTypes.push(type)
          break
        }
      }
    }
  }

  // 风险等级
  const riskPatterns = [
    /风险等级[:：]\s*(危急|高危|中危|低危)/g,
    /风险级别[:：]\s*(危急|高危|中危|低危)/g,
    /等级[:：]\s*(危急|高危|中危|低危)/g,
    /(危急|高危|中危|低危)\s*风险/g,
  ]

  for (const pattern of riskPatterns) {
    let match
    while ((match = pattern.exec(reportText)) !== null) {
      riskLevels.push(match[1])
    }
  }

  // 统计
  const attackCounter: Record<string, number> = {}
  for (const a of attackTypes) {
    attackCounter[a] = (attackCounter[a] || 0) + 1
  }

  const riskCounter: Record<string, number> = { 危急: 0, 高危: 0, 中危: 0, 低危: 0 }
  for (const r of riskLevels) {
    riskCounter[r] = (riskCounter[r] || 0) + 1
  }

  return { attackTypes: attackCounter, riskLevels: riskCounter }
}

// 从日志中提取 IP 统计
export function extractIpStats(lines: string[], maxLines: number = 50000): Record<string, number> {
  const ipPattern = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/
  const ipCounts: Record<string, number> = {}
  const sampleLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines

  for (const line of sampleLines) {
    const match = line.match(ipPattern)
    if (match) {
      const ip = match[1]
      ipCounts[ip] = (ipCounts[ip] || 0) + 1
    }
  }

  // 排序取前 10
  const sorted = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return Object.fromEntries(sorted)
}

// 从日志中提取时间线
export function extractTimeline(lines: string[], maxLines: number = 50000): { time: string; count: number }[] {
  // 严格匹配 Apache 日志时间格式 [29/Apr/2026:14:30:45 +0800]
  const timePattern = /\[(\d{2})\/\w{3}\/\d{4}:([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\s/
  const timeCounts: Record<string, number> = {}
  const sampleLines = lines.length > maxLines ? lines.slice(0, maxLines) : lines

  for (const line of sampleLines) {
    const match = line.match(timePattern)
    if (match) {
      const hour = match[2] + ':00'
      timeCounts[hour] = (timeCounts[hour] || 0) + 1
    }
  }

  // 补全 0-23 小时（确保时间线连续）
  const result: { time: string; count: number }[] = []
  for (let h = 0; h < 24; h++) {
    const key = String(h).padStart(2, '0') + ':00'
    result.push({ time: key, count: timeCounts[key] || 0 })
  }
  return result
}
