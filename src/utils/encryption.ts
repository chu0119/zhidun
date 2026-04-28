// 加密工具 - 从 Python config.py 移植
// 使用 AES-256-GCM + PBKDF2 (Node.js crypto 等效)

// 注意: 在浏览器环境中，我们使用 Web Crypto API
// 但由于 Electron 的 preload 有 contextIsolation, 我们通过 IPC 调用主进程的加密
// 这里提供一个简化的浏览器端实现

const PBKDF2_ITERATIONS = 200000
const SALT = 'zhidun-electron-salt-v1'

async function getKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptApiKey(apiKey: string, machineId: string): Promise<string> {
  if (!apiKey) return ''

  try {
    const key = await getKey(`${machineId}_zhidun_secure`, SALT)
    const enc = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(apiKey)
    )

    // 组合 iv + encrypted 并 base64 编码
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)

    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('加密 API Key 失败:', error)
    // 降级: 简单 base64 编码
    return btoa(unescape(encodeURIComponent(apiKey)))
  }
}

export async function decryptApiKey(encryptedKey: string, machineId: string): Promise<string | null> {
  if (!encryptedKey) return null

  try {
    const key = await getKey(`${machineId}_zhidun_secure`, SALT)

    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    // 尝试 base64 降级解码
    try {
      const decoded = decodeURIComponent(escape(atob(encryptedKey)))
      if (decoded && decoded.length > 10) return decoded
    } catch {}
    return null
  }
}
