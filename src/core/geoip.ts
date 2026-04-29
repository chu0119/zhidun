// GeoIP 地理位置查询模块
// 使用 geoip-lite 离线数据库（通过 IPC 在主进程中查询）

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

// 内存缓存
const cache = new Map<string, GeoIPResult>()

// 私有 IP 范围检测
function isPrivateIP(ip: string): boolean {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|100\.6[4-9]\.|100\.[7-9]\d\.|100\.1[0-2]\d\.|localhost|::1|fc00:|fe80:)/i.test(ip)
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
      if (!isPrivateIP(ip) && !ip.startsWith('0.') && !ip.startsWith('255.')) {
        ipSet.add(ip)
      }
    }
  }

  return [...ipSet]
}

// ISO 国家代码 → 中文名称映射
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  CN: '中国', US: '美国', JP: '日本', KR: '韩国', TW: '中国台湾',
  HK: '中国香港', MO: '中国澳门', SG: '新加坡', MY: '马来西亚', TH: '泰国',
  VN: '越南', PH: '菲律宾', ID: '印度尼西亚', IN: '印度', PK: '巴基斯坦',
  BD: '孟加拉国', LK: '斯里兰卡', NP: '尼泊尔', MM: '缅甸', KH: '柬埔寨',
  LA: '老挝', MN: '蒙古', KZ: '哈萨克斯坦', UZ: '乌兹别克斯坦',
  RU: '俄罗斯', UA: '乌克兰', BY: '白俄罗斯', PL: '波兰', CZ: '捷克',
  SK: '斯洛伐克', HU: '匈牙利', RO: '罗马尼亚', BG: '保加利亚',
  RS: '塞尔维亚', HR: '克罗地亚', SI: '斯洛文尼亚', BA: '波黑',
  MK: '北马其顿', AL: '阿尔巴尼亚', ME: '黑山', XK: '科索沃',
  DE: '德国', FR: '法国', GB: '英国', IT: '意大利', ES: '西班牙',
  PT: '葡萄牙', NL: '荷兰', BE: '比利时', LU: '卢森堡', AT: '奥地利',
  CH: '瑞士', LI: '列支敦士登', IE: '爱尔兰', IS: '冰岛', NO: '挪威',
  SE: '瑞典', FI: '芬兰', DK: '丹麦', EE: '爱沙尼亚', LV: '拉脱维亚',
  LT: '立陶宛', MT: '马耳他', CY: '塞浦路斯', GR: '希腊',
  TR: '土耳其', IL: '以色列', SA: '沙特阿拉伯', AE: '阿联酋',
  QA: '卡塔尔', KW: '科威特', BH: '巴林', OM: '阿曼', JO: '约旦',
  LB: '黎巴嫩', IQ: '伊拉克', IR: '伊朗', SY: '叙利亚', YE: '也门',
  AF: '阿富汗', GE: '格鲁吉亚', AM: '亚美尼亚', AZ: '阿塞拜疆',
  EG: '埃及', ZA: '南非', NG: '尼日利亚', KE: '肯尼亚', ET: '埃塞俄比亚',
  GH: '加纳', TZ: '坦桑尼亚', UG: '乌干达', MZ: '莫桑比克',
  ZW: '津巴布韦', ZM: '赞比亚', MW: '马拉维', BW: '博茨瓦纳',
  NA: '纳米比亚', MG: '马达加斯加', MU: '毛里求斯', SC: '塞舌尔',
  DZ: '阿尔及利亚', MA: '摩洛哥', TN: '突尼斯', LY: '利比亚',
  SD: '苏丹', SS: '南苏丹', TD: '乍得', NE: '尼日尔', ML: '马里',
  BF: '布基纳法索', SN: '塞内加尔', GM: '冈比亚', GN: '几内亚',
  SL: '塞拉利昂', LR: '利比里亚', CI: '科特迪瓦', CM: '喀麦隆',
  CF: '中非', CG: '刚果(布)', CD: '刚果(金)', AO: '安哥拉',
  GA: '加蓬', GQ: '赤道几内亚', SO: '索马里', DJ: '吉布提',
  ER: '厄立特里亚', RW: '卢旺达', BI: '布隆迪',
  CA: '加拿大', MX: '墨西哥', GT: '危地马拉', BZ: '伯利兹',
  HN: '洪都拉斯', SV: '萨尔瓦多', NI: '尼加拉瓜', CR: '哥斯达黎加',
  PA: '巴拿马', CU: '古巴', JM: '牙买加', HT: '海地', DO: '多米尼加',
  PR: '波多黎各', TT: '特立尼达和多巴哥', BB: '巴巴多斯',
  CO: '哥伦比亚', VE: '委内瑞拉', GY: '圭亚那', SR: '苏里南',
  EC: '厄瓜多尔', PE: '秘鲁', BR: '巴西', BO: '玻利维亚',
  PY: '巴拉圭', UY: '乌拉圭', AR: '阿根廷', CL: '智利',
  AU: '澳大利亚', NZ: '新西兰', PG: '巴布亚新几内亚', FJ: '斐济',
  SB: '所罗门群岛', VU: '瓦努阿图', WS: '萨摩亚', TO: '汤加',
  KI: '基里巴斯', MH: '马绍尔群岛', FM: '密克罗尼西亚', PW: '帕劳',
  NR: '瑙鲁', TV: '图瓦卢',
}

export function countryCodeToName(code: string): string {
  return COUNTRY_CODE_TO_NAME[code.toUpperCase()] || code
}

// 离线 GeoIP 查询（通过 IPC 调用主进程的 geoip-lite）
export async function lookupIPs(ips: string[]): Promise<Map<string, GeoIPResult>> {
  const result = new Map<string, GeoIPResult>()

  // 分离已缓存和需要查询的 IP
  const toQuery: string[] = []
  for (const ip of ips) {
    if (cache.has(ip)) {
      result.set(ip, cache.get(ip)!)
    } else if (!isPrivateIP(ip)) {
      toQuery.push(ip)
    }
  }

  if (toQuery.length === 0) return result

  // 通过 IPC 调用主进程进行离线查询
  try {
    const response = await window.electronAPI.geoipLookup(toQuery)
    if (response.success) {
      for (const ip of toQuery) {
        const data = response.results[ip]
        if (data) {
          const geo: GeoIPResult = {
            ip,
            country: countryCodeToName(data.country),
            countryCode: data.country,
            region: data.region,
            city: data.city,
            lat: data.lat,
            lon: data.lon,
            isp: '',
            org: '',
            as: '',
          }
          cache.set(ip, geo)
          result.set(ip, geo)
        }
      }
    }
  } catch (error) {
    console.warn('GeoIP lookup failed:', error)
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
