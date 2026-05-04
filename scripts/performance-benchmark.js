#!/usr/bin/env node
/*
 * 大文件处理性能基准
 *
 * 用法:
 *   node scripts/performance-benchmark.js [--lines 100000] [--sample-size 1000] [--attack-ratio 0.05]
 *
 * 目标:
 *   - 评估大规模日志的逐行扫描吞吐
 *   - 评估蓄水池采样开销
 *   - 输出可读的性能摘要与 JSON 结果
 */

const { performance } = require('perf_hooks')

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const TOTAL_LINES = parseInt(getArg('lines', '100000'), 10)
const SAMPLE_SIZE = parseInt(getArg('sample-size', '1000'), 10)
const ATTACK_RATIO = Math.min(0.5, Math.max(0.01, parseFloat(getArg('attack-ratio', '0.05'))))

const normalPaths = ['/','/index.html','/products','/api/health','/search?q=test','/login','/docs/api']
const attackPayloads = [
  "' OR '1'='1",
  '<script>alert(1)</script>',
  '../../etc/passwd',
  'sqlmap/1.7.10',
  'curl/8.4.0',
]
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
  'sqlmap/1.7.10',
  'curl/8.4.0',
]
const methods = ['GET', 'POST', 'PUT', 'DELETE']
const statuses = [200, 200, 200, 404, 403, 500]
const regexes = [
  /\bunion\b.{0,30}\bselect\b/i,
  /<script[^>]*>.*?<\/script>/i,
  /\.\./,
  /sqlmap|nikto|nmap|curl\/|python-urllib/i,
  /\b(or|and)\b\s+\d+\s*=\s*\d+/i,
]

const pad = (n) => String(n).padStart(2, '0')
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[randInt(0, arr.length - 1)]

function createLine(index, isAttack) {
  const ip = `${randInt(1, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`
  const ts = `[03/May/2026:${pad(randInt(0, 23))}:${pad(randInt(0, 59))}:${pad(randInt(0, 59))} +0800]`
  const method = pick(methods)
  const status = pick(statuses)
  const bytes = randInt(120, 20480)

  if (isAttack) {
    const payload = pick(attackPayloads)
    const path = `/search?q=${encodeURIComponent(payload)}&id=${index}`
    const ua = pick(userAgents)
    return `${ip} - - ${ts} "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "${ua}"`
  }

  const path = pick(normalPaths)
  const ua = pick(userAgents.slice(0, 2))
  return `${ip} - - ${ts} "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "${ua}"`
}

function matchLine(line) {
  for (const regex of regexes) {
    regex.lastIndex = 0
    if (regex.test(line)) return true
  }
  return false
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2)
}

async function main() {
  console.log('大文件处理性能基准启动')
  console.log(`  行数: ${TOTAL_LINES.toLocaleString()}`)
  console.log(`  采样上限: ${SAMPLE_SIZE.toLocaleString()}`)
  console.log(`  攻击比例: ${(ATTACK_RATIO * 100).toFixed(1)}%`)
  console.log('')

  const memoryStart = process.memoryUsage().heapUsed
  const start = performance.now()

  let totalLines = 0
  let matchedLines = 0
  const reservoir = []
  const threatLines = []

  for (let i = 0; i < TOTAL_LINES; i++) {
    const isAttack = Math.random() < ATTACK_RATIO
    const line = createLine(i, isAttack)
    totalLines++

    if (matchLine(line)) {
      matchedLines++
      if (threatLines.length < Math.max(1, Math.floor(SAMPLE_SIZE * 0.3))) {
        threatLines.push(line)
      }
    }

    if (reservoir.length < SAMPLE_SIZE) {
      reservoir.push(line)
    } else {
      const j = Math.floor(Math.random() * totalLines)
      if (j < SAMPLE_SIZE) {
        reservoir[j] = line
      }
    }
  }

  const elapsed = performance.now() - start
  const memoryEnd = process.memoryUsage().heapUsed
  const result = {
    totalLines,
    matchedLines,
    sampleSize: reservoir.length,
    threatSampleSize: threatLines.length,
    durationMs: Math.round(elapsed),
    linesPerSecond: Math.round((totalLines / elapsed) * 1000),
    memoryStartMB: Number(formatMB(memoryStart)),
    memoryEndMB: Number(formatMB(memoryEnd)),
    memoryDeltaMB: Number(formatMB(memoryEnd - memoryStart)),
  }

  console.log('基准结果')
  console.log(`  总行数: ${result.totalLines.toLocaleString()}`)
  console.log(`  命中行数: ${result.matchedLines.toLocaleString()}`)
  console.log(`  采样行数: ${result.sampleSize.toLocaleString()}`)
  console.log(`  威胁样本: ${result.threatSampleSize.toLocaleString()}`)
  console.log(`  耗时: ${result.durationMs} ms`)
  console.log(`  吞吐: ${result.linesPerSecond.toLocaleString()} 行/秒`)
  console.log(`  内存变化: ${result.memoryStartMB.toFixed(2)} MB -> ${result.memoryEndMB.toFixed(2)} MB (${result.memoryDeltaMB.toFixed(2)} MB)`)
  console.log('')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('性能基准执行失败:', error)
  process.exitCode = 1
})
