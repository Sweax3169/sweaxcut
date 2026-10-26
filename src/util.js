export const OUT_W = 1080
export const OUT_H = 1920

export const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.mts', '.m2ts', '.wmv', '.flv', '.3gp', '.mpg', '.mpeg']

export function isVideoPath(p) {
  const dot = String(p).lastIndexOf('.')
  if (dot < 0) return false
  return VIDEO_EXTS.includes(String(p).slice(dot).toLowerCase())
}

export function fitInside(iw, ih, bw, bh) {
  const s = Math.min(bw / iw, bh / ih)
  return { w: Math.max(2, Math.round((iw * s) / 2) * 2), h: Math.max(2, Math.round((ih * s) / 2) * 2) }
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(b) {
  if (!b) return ''
  if (b > 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  if (b > 1024 * 1024) return Math.round(b / (1024 * 1024)) + ' MB'
  return Math.round(b / 1024) + ' KB'
}

export function baseName(p) {
  const s = String(p)
  const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'))
  return i >= 0 ? s.slice(i + 1) : s
}

let idCounter = 1
export function nextId() {
  return 'f' + (idCounter++) + '-' + Date.now().toString(36)
}

// ffmpeg renk filtrelerinin CSS önizleme karşılıkları (electron/ffmpeg.cjs ile uyumlu)
export const CSS_COLOR_FILTERS = {
  none: '',
  canli: 'saturate(1.35) contrast(1.06)',
  sinematik: 'contrast(1.16) saturate(0.85) brightness(0.98)',
  sicak: 'saturate(1.1) sepia(0.18)',
  soguk: 'saturate(0.95) hue-rotate(8deg) brightness(1.02)',
  siyahbeyaz: 'grayscale(1) contrast(1.08)',
}
