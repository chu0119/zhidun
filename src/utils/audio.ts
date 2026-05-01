// 声音播放工具

const audioCache = new Map<string, HTMLAudioElement>()

export function playAlertSound(severity: string) {
  const soundMap: Record<string, string> = {
    critical: '/assets/sounds/critical-alert.mp3',
    high: '/assets/sounds/high-alert.mp3',
  }
  const src = soundMap[severity]
  if (!src) return

  let audio = audioCache.get(src)
  if (!audio) {
    audio = new Audio(src)
    audioCache.set(src, audio)
  }
  audio.currentTime = 0
  audio.play().catch(() => {})
}

export function initSoundListener() {
  if (typeof window === 'undefined' || !window.electronAPI?.onPlaySound) return
  window.electronAPI.onPlaySound((severity: string) => {
    playAlertSound(severity)
  })
}
