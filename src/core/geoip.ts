// GeoIP 地理位置查询模块
// 使用 ip-api.com 免费 API（支持批量查询，无需 API Key）

export interface GeoIPResult {
  ip: string
  country: string
  countryCode: string
  region: string
  city: string
  lat: number
  lon: number
  isp: string
  org: string
  as: string
}

interface GeoIPApiResponse {
  query: string
  status: string
  country: string
  countryCode: string
  region: string
  regionName: string
  city: string
  zip: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
  as: string
}

// 内存缓存
const cache = new Map<string, GeoIPResult>()

// ip-api.com 批量查询端点（免费，每次最多 100 个 IP）
const BATCH_API = 'http://ip-api.com/batch'
const SINGLE_API = 'http://ip-api.com/json'

// 私有 IP 范围检测
function isPrivateIP(ip: string): boolean {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|localhost|::1|fc00:|fe80:)/i.test(ip)
    || ip === 'unknown'
}

// 从日志行列表中提取所有唯一 IP
export function extractIPsFromLines(lines: string[]): string[] {
  const ipSet = new Set<string>()
  const ipRegex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g

  for (const line of lines) {
    let match
    while ((match = ipRegex.exec(line)) !== null) {
      const ip = match[1]
      // 排除私有 IP 和明显不是 IP 的地址
      if (!isPrivateIP(ip) && !ip.startsWith('0.') && !ip.startsWith('255.')) {
        ipSet.add(ip)
      }
    }
  }

  return [...ipSet]
}

// 批量查询 IP 地理位置
export async function lookupIPs(ips: string[]): Promise<Map<string, GeoIPResult>> {
  const result = new Map<string, GeoIPResult>()

  // 过滤已缓存的和私有 IP
  const toQuery: string[] = []
  for (const ip of ips) {
    if (cache.has(ip)) {
      result.set(ip, cache.get(ip)!)
    } else if (!isPrivateIP(ip)) {
      toQuery.push(ip)
    }
  }

  if (toQuery.length === 0) return result

  // 分批查询（每批最多 100 个）
  for (let i = 0; i < toQuery.length; i += 100) {
    const batch = toQuery.slice(i, i + 100)
    try {
      const response = await window.electronAPI.httpRequest(BATCH_API, {
        method: 'POST',
        body: JSON.stringify(batch.map(ip => ({ query: ip }))),
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.success && response.data) {
        const data: GeoIPApiResponse[] = JSON.parse(response.data)
        for (const item of data) {
          if (item.status === 'success') {
            const geo: GeoIPResult = {
              ip: item.query,
              country: item.country,
              countryCode: item.countryCode,
              region: item.regionName,
              city: item.city,
              lat: item.lat,
              lon: item.lon,
              isp: item.isp,
              org: item.org,
              as: item.as,
            }
            cache.set(geo.ip, geo)
            result.set(geo.ip, geo)
          }
        }
      }
    } catch (error) {
      console.warn('GeoIP batch lookup failed:', error)
    }

    // 批次间延迟（ip-api.com 限制每分钟 15 次请求）
    if (i + 100 < toQuery.length) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  return result
}

// 按国家聚合攻击统计
export function aggregateByCountry(geoResults: Map<string, GeoIPResult>, ipCounts: Map<string, number>): {
  country: string
  countryCode: string
  totalAttacks: number
  ipCount: number
  lat: number
  lon: number
}[] {
  const countryMap = new Map<string, {
    country: string
    countryCode: string
    totalAttacks: number
    ipCount: number
    lat: number
    lon: number
  }>()

  for (const [ip, geo] of geoResults) {
    const key = geo.countryCode
    const attackCount = ipCounts.get(ip) || 1

    if (countryMap.has(key)) {
      const existing = countryMap.get(key)!
      existing.totalAttacks += attackCount
      existing.ipCount++
    } else {
      countryMap.set(key, {
        country: geo.country,
        countryCode: geo.countryCode,
        totalAttacks: attackCount,
        ipCount: 1,
        lat: geo.lat,
        lon: geo.lon,
      })
    }
  }

  return [...countryMap.values()].sort((a, b) => b.totalAttacks - a.totalAttacks)
}

// 生成世界地图散点数据（用于 ECharts）
export function generateMapScatterData(
  geoResults: Map<string, GeoIPResult>,
  ipCounts: Map<string, number>
): { name: string; value: [number, number, number]; ip: string; country: string; city: string; isp: string }[] {
  const data: { name: string; value: [number, number, number]; ip: string; country: string; city: string; isp: string }[] = []

  for (const [ip, geo] of geoResults) {
    const count = ipCounts.get(ip) || 1
    data.push({
      name: ip,
      value: [geo.lon, geo.lat, count],
      ip,
      country: geo.country,
      city: geo.city,
      isp: geo.isp,
    })
  }

  return data.sort((a, b) => b.value[2] - a.value[2])
}
