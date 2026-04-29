// 世界地图注册工具
// 将 TopoJSON 转换为 GeoJSON，裁剪反子午线跨越，注册到 ECharts

import * as echarts from 'echarts'
import * as topojson from 'topojson-client'
import worldMapTopoData from '@/data/world-110m.json'

let registered = false

// ===== 反子午线裁剪 =====
// 当多边形跨越 ±180° 经度线时，ECharts 会画一条横贯地图的线
// 此函数将跨越反子午线的多边形裁剪为两半

function wrapLon(lon: number): number {
  while (lon > 180) lon -= 360
  while (lon < -180) lon += 360
  return lon
}

function clipRing(ring: [number, number][]): [number, number][][] {
  if (ring.length < 3) return [ring]

  const result: [number, number][][] = []
  let current: [number, number][] = [ring[0]]

  for (let i = 1; i < ring.length; i++) {
    const prev = ring[i - 1]
    const curr = ring[i]
    const dLon = curr[0] - prev[0]

    if (Math.abs(dLon) > 180) {
      // 跨越反子午线，计算交点
      const direction = dLon > 0 ? -1 : 1 // 从东到西 or 西到东
      const boundary = direction * 180
      const ratio = (boundary - prev[0]) / (curr[0] - prev[0] + (dLon > 0 ? -360 : 360))
      const latAtBoundary = prev[1] + ratio * (curr[1] - prev[1])

      const clampedPrevLon = boundary
      const clampedCurrLon = -boundary

      current.push([clampedPrevLon, latAtBoundary])
      if (current.length >= 3) result.push(current)

      current = [[clampedCurrLon, latAtBoundary]]
    }

    current.push([wrapLon(curr[0]), curr[1]])
  }

  if (current.length >= 3) result.push(current)
  return result
}

function clipPolygon(coords: [number, number][][]): [number, number][][][] {
  const rings: [number, number][][][] = []
  for (const ring of coords) {
    const clipped = clipRing(ring)
    rings.push(clipped)
  }
  // 取外环和裁剪后的内环组合
  if (rings.length === 0) return []
  return rings[0].map(outer => [outer])
}

function clipMultiPolygon(coords: [number, number][][][]): [number, number][][][] {
  const result: [number, number][][][] = []
  for (const polygon of coords) {
    const clipped = clipPolygon(polygon)
    result.push(...clipped)
  }
  return result
}

function clipGeoJSON(geojson: any): any {
  const clippedFeatures = geojson.features.map((feature: any) => {
    const geom = feature.geometry
    if (!geom) return feature

    let newCoords: any
    if (geom.type === 'Polygon') {
      newCoords = clipPolygon(geom.coordinates)
      return { ...feature, geometry: { ...geom, type: 'MultiPolygon', coordinates: newCoords } }
    } else if (geom.type === 'MultiPolygon') {
      newCoords = clipMultiPolygon(geom.coordinates)
      return { ...feature, geometry: { ...geom, coordinates: newCoords } }
    }
    return feature
  })

  return { ...geojson, features: clippedFeatures }
}

// ===== 地图注册 =====

export function ensureWorldMap(): boolean {
  if (registered) return true
  try {
    let geoData = topojson.feature(
      worldMapTopoData as any,
      (worldMapTopoData as any).objects.countries
    )
    // 裁剪反子午线跨越
    geoData = clipGeoJSON(geoData)
    echarts.registerMap('world', geoData as any)
    registered = true
    return true
  } catch (e) {
    console.warn('Failed to register world map:', e)
    registered = true
    return false
  }
}

// ===== 国家名称映射 =====

// ISO 3166-1 alpha-2 → GeoJSON 地图名称
const ALPHA2_TO_GEO_NAME: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola', AR: 'Argentina',
  AM: 'Armenia', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas',
  BD: 'Bangladesh', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin',
  BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herz.', BW: 'Botswana', BR: 'Brazil',
  BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia',
  CM: 'Cameroon', CA: 'Canada', CF: 'Central African Rep.', TD: 'Chad', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CG: 'Congo', CD: 'Dem. Rep. Congo', CR: 'Costa Rica',
  CI: "Côte d'Ivoire", HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czechia',
  DK: 'Denmark', DJ: 'Djibouti', DO: 'Dominican Rep.', EC: 'Ecuador', EG: 'Egypt',
  SV: 'El Salvador', GQ: 'Eq. Guinea', ER: 'Eritrea', EE: 'Estonia', ET: 'Ethiopia',
  FK: 'Falkland Is.', FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon',
  GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece', GL: 'Greenland',
  GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti',
  HN: 'Honduras', HK: 'China', HU: 'Hungary', IS: 'Iceland', IN: 'India',
  ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland', IL: 'Israel',
  IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan',
  KE: 'Kenya', KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KG: 'Kyrgyzstan',
  LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho', LR: 'Liberia',
  LY: 'Libya', LT: 'Lithuania', LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi',
  MY: 'Malaysia', ML: 'Mali', MR: 'Mauritania', MX: 'Mexico', MD: 'Moldova',
  MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar',
  NP: 'Nepal', NL: 'Netherlands', NC: 'New Caledonia', NZ: 'New Zealand', NI: 'Nicaragua',
  NE: 'Niger', NG: 'Nigeria', MK: 'Macedonia', NO: 'Norway', OM: 'Oman',
  PK: 'Pakistan', PS: 'Palestine', PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay',
  PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', PR: 'Puerto Rico',
  QA: 'Qatar', RO: 'Romania', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia',
  SN: 'Senegal', RS: 'Serbia', SL: 'Sierra Leone', SK: 'Slovakia', SI: 'Slovenia',
  SB: 'Solomon Is.', SO: 'Somalia', ZA: 'South Africa', SS: 'S. Sudan', ES: 'Spain',
  LK: 'Sri Lanka', SD: 'Sudan', SR: 'Suriname', SZ: 'eSwatini', SE: 'Sweden',
  CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan', TZ: 'Tanzania',
  TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo', TT: 'Trinidad and Tobago', TN: 'Tunisia',
  TR: 'Turkey', TM: 'Turkmenistan', UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates',
  GB: 'United Kingdom', US: 'United States of America', UY: 'Uruguay', UZ: 'Uzbekistan',
  VE: 'Venezuela', VN: 'Vietnam', EH: 'W. Sahara', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
  XK: 'Kosovo',
}

export function alpha2ToGeoName(code: string): string {
  return ALPHA2_TO_GEO_NAME[code.toUpperCase()] || ''
}

// GeoJSON 英文名称 → 中文名称（用于 Tooltip 显示）
const GEO_NAME_TO_CHINESE: Record<string, string> = {
  'Afghanistan': '阿富汗', 'Albania': '阿尔巴尼亚', 'Algeria': '阿尔及利亚', 'Angola': '安哥拉',
  'Argentina': '阿根廷', 'Armenia': '亚美尼亚', 'Australia': '澳大利亚', 'Austria': '奥地利',
  'Azerbaijan': '阿塞拜疆', 'Bahamas': '巴哈马', 'Bangladesh': '孟加拉国', 'Belarus': '白俄罗斯',
  'Belgium': '比利时', 'Belize': '伯利兹', 'Benin': '贝宁', 'Bhutan': '不丹',
  'Bolivia': '玻利维亚', 'Bosnia and Herz.': '波黑', 'Botswana': '博茨瓦纳', 'Brazil': '巴西',
  'Brunei': '文莱', 'Bulgaria': '保加利亚', 'Burkina Faso': '布基纳法索', 'Burundi': '布隆迪',
  'Cambodia': '柬埔寨', 'Cameroon': '喀麦隆', 'Canada': '加拿大', 'Central African Rep.': '中非',
  'Chad': '乍得', 'Chile': '智利', 'China': '中国', 'Colombia': '哥伦比亚',
  'Congo': '刚果(布)', 'Dem. Rep. Congo': '刚果(金)', 'Costa Rica': '哥斯达黎加',
  "Côte d'Ivoire": '科特迪瓦', 'Croatia': '克罗地亚', 'Cuba': '古巴', 'Cyprus': '塞浦路斯',
  'Czechia': '捷克', 'Denmark': '丹麦', 'Djibouti': '吉布提', 'Dominican Rep.': '多米尼加',
  'Ecuador': '厄瓜多尔', 'Egypt': '埃及', 'El Salvador': '萨尔瓦多', 'Eq. Guinea': '赤道几内亚',
  'Eritrea': '厄立特里亚', 'Estonia': '爱沙尼亚', 'Ethiopia': '埃塞俄比亚',
  'Falkland Is.': '马尔维纳斯群岛', 'Fiji': '斐济', 'Finland': '芬兰', 'France': '法国',
  'Gabon': '加蓬', 'Gambia': '冈比亚', 'Georgia': '格鲁吉亚', 'Germany': '德国',
  'Ghana': '加纳', 'Greece': '希腊', 'Greenland': '格陵兰', 'Guatemala': '危地马拉',
  'Guinea': '几内亚', 'Guinea-Bissau': '几内亚比绍', 'Guyana': '圭亚那', 'Haiti': '海地',
  'Honduras': '洪都拉斯', 'Hungary': '匈牙利', 'Iceland': '冰岛', 'India': '印度',
  'Indonesia': '印度尼西亚', 'Iran': '伊朗', 'Iraq': '伊拉克', 'Ireland': '爱尔兰',
  'Israel': '以色列', 'Italy': '意大利', 'Jamaica': '牙买加', 'Japan': '日本',
  'Jordan': '约旦', 'Kazakhstan': '哈萨克斯坦', 'Kenya': '肯尼亚', 'North Korea': '朝鲜',
  'South Korea': '韩国', 'Kuwait': '科威特', 'Kyrgyzstan': '吉尔吉斯斯坦', 'Laos': '老挝',
  'Latvia': '拉脱维亚', 'Lebanon': '黎巴嫩', 'Lesotho': '莱索托', 'Liberia': '利比里亚',
  'Libya': '利比亚', 'Lithuania': '立陶宛', 'Luxembourg': '卢森堡', 'Madagascar': '马达加斯加',
  'Malawi': '马拉维', 'Malaysia': '马来西亚', 'Mali': '马里', 'Mauritania': '毛里塔尼亚',
  'Mexico': '墨西哥', 'Moldova': '摩尔多瓦', 'Mongolia': '蒙古', 'Montenegro': '黑山',
  'Morocco': '摩洛哥', 'Mozambique': '莫桑比克', 'Myanmar': '缅甸', 'Nepal': '尼泊尔',
  'Netherlands': '荷兰', 'New Caledonia': '新喀里多尼亚', 'New Zealand': '新西兰',
  'Nicaragua': '尼加拉瓜', 'Niger': '尼日尔', 'Nigeria': '尼日利亚', 'Macedonia': '北马其顿',
  'Norway': '挪威', 'Oman': '阿曼', 'Pakistan': '巴基斯坦', 'Palestine': '巴勒斯坦',
  'Panama': '巴拿马', 'Papua New Guinea': '巴布亚新几内亚', 'Paraguay': '巴拉圭',
  'Peru': '秘鲁', 'Philippines': '菲律宾', 'Poland': '波兰', 'Portugal': '葡萄牙',
  'Puerto Rico': '波多黎各', 'Qatar': '卡塔尔', 'Romania': '罗马尼亚', 'Russia': '俄罗斯',
  'Rwanda': '卢旺达', 'Saudi Arabia': '沙特阿拉伯', 'Senegal': '塞内加尔', 'Serbia': '塞尔维亚',
  'Sierra Leone': '塞拉利昂', 'Slovakia': '斯洛伐克', 'Slovenia': '斯洛文尼亚',
  'Solomon Is.': '所罗门群岛', 'Somalia': '索马里', 'South Africa': '南非',
  'S. Sudan': '南苏丹', 'Spain': '西班牙', 'Sri Lanka': '斯里兰卡', 'Sudan': '苏丹',
  'Suriname': '苏里南', 'eSwatini': '斯威士兰', 'Sweden': '瑞典', 'Switzerland': '瑞士',
  'Syria': '叙利亚', 'Taiwan': '中国台湾', 'Tajikistan': '塔吉克斯坦', 'Tanzania': '坦桑尼亚',
  'Thailand': '泰国', 'Timor-Leste': '东帝汶', 'Togo': '多哥',
  'Trinidad and Tobago': '特立尼达和多巴哥', 'Tunisia': '突尼斯', 'Turkey': '土耳其',
  'Turkmenistan': '土库曼斯坦', 'Uganda': '乌干达', 'Ukraine': '乌克兰',
  'United Arab Emirates': '阿联酋', 'United Kingdom': '英国',
  'United States of America': '美国', 'Uruguay': '乌拉圭', 'Uzbekistan': '乌兹别克斯坦',
  'Venezuela': '委内瑞拉', 'Vietnam': '越南', 'W. Sahara': '西撒哈拉', 'Yemen': '也门',
  'Zambia': '赞比亚', 'Zimbabwe': '津巴布韦', 'Kosovo': '科索沃',
  'N. Cyprus': '北塞浦路斯', 'Somaliland': '索马里兰',
}

export function geoNameToChinese(name: string): string {
  return GEO_NAME_TO_CHINESE[name] || name
}
