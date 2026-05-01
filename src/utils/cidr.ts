// CIDR 匹配工具 - 主进程和渲染进程共用

export function extractIP(line: string): string {
  const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
  return match ? match[1] : ''
}

export function ipToNum(ip: string): number {
  const parts = ip.split('.')
  if (parts.length !== 4) return 0
  return parts.reduce((acc, octet) => {
    const n = parseInt(octet, 10)
    if (isNaN(n) || n < 0 || n > 255) return 0
    return (acc << 8) + n
  }, 0) >>> 0
}

export function matchCIDR(ip: string, cidr: string): boolean {
  if (!ip || !cidr) return false
  const [range, bits] = cidr.split('/')
  if (!bits) return ip === range
  const mask = ~(2 ** (32 - parseInt(bits)) - 1)
  const ipNum = ipToNum(ip)
  const rangeNum = ipToNum(range)
  return (ipNum & mask) === (rangeNum & mask)
}

export function isIPWhitelisted(line: string, ipAddresses: string[]): boolean {
  for (const ip of ipAddresses) {
    if (ip.includes('/')) {
      const extracted = extractIP(line)
      if (extracted && matchCIDR(extracted, ip)) return true
    } else {
      // 精确匹配：用词边界避免子串误匹配（如 1.2.3.4 匹配 11.2.3.45）
      const ipRegex = new RegExp('(?:^|[^\\d])' + ip.replace(/\./g, '\\.') + '(?:[^\\d]|$)')
      if (ipRegex.test(line)) return true
    }
  }
  return false
}

export function isUserAgentWhitelisted(line: string, userAgents: string[]): boolean {
  const lowerLine = line.toLowerCase()
  for (const ua of userAgents) {
    if (lowerLine.includes(ua.toLowerCase())) return true
  }
  return false
}
