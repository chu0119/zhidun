// GeoIP 缓存和性能优化模块

import type { GeoIPResult } from './geoip'

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number // milliseconds
}

class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultTTL: number

  constructor(defaultTTL: number = 24 * 60 * 60 * 1000) { // 默认24小时
    this.defaultTTL = defaultTTL
    // 定期清理过期条目（每小时）
    setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  size(): number {
    return this.cache.size
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.hits / Math.max(1, this.hits + this.misses),
    }
  }

  private hits = 0
  private misses = 0

  recordHit(): void {
    this.hits++
  }

  recordMiss(): void {
    this.misses++
  }
}

// 全局 GeoIP 缓存（24小时过期）
export const geoipCache = new CacheManager<GeoIPResult>(24 * 60 * 60 * 1000)

// 全局规则编译缓存（7天过期）
export const ruleCache = new CacheManager<RegExp>(7 * 24 * 60 * 60 * 1000)

// 分析结果缓存（基于文件hash）
interface AnalysisCacheEntry {
  fileHash: string
  analysisResult: any
  timestamp: number
}

export const analysisCache = new CacheManager<AnalysisCacheEntry>(24 * 60 * 60 * 1000)

// 批量获取GeoIP结果，使用缓存加速
export async function getGeoIPWithCache(
  ips: string[],
  lookupFn: (uncachedIPs: string[]) => Promise<Record<string, GeoIPResult>>
): Promise<Record<string, GeoIPResult>> {
  const results: Record<string, GeoIPResult> = {}
  const uncachedIPs: string[] = []

  // 先从缓存获取
  for (const ip of ips) {
    const cached = geoipCache.get(ip)
    if (cached) {
      results[ip] = cached
      geoipCache.recordHit()
    } else {
      uncachedIPs.push(ip)
      geoipCache.recordMiss()
    }
  }

  // 查询未缓存的IP
  if (uncachedIPs.length > 0) {
    const newResults = await lookupFn(uncachedIPs)
    
    // 存入缓存
    for (const [ip, data] of Object.entries(newResults)) {
      geoipCache.set(ip, data)
      results[ip] = data
    }
  }

  return results
}

// 编译正则表达式，使用缓存加速
export function getCompiledRegex(
  source: string,
  flags: string = 'i'
): RegExp {
  const key = `${source}/${flags}`
  const cached = ruleCache.get(key)
  if (cached) {
    ruleCache.recordHit()
    return cached
  }

  ruleCache.recordMiss()
  const regex = new RegExp(source, flags)
  ruleCache.set(key, regex)
  return regex
}

// 导出缓存统计信息
export function getCacheStats() {
  return {
    geoip: geoipCache.getStats(),
    rules: ruleCache.getStats(),
    analysis: analysisCache.getStats(),
  }
}
