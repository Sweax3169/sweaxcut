// Zaman yardımcıları: zaman kodu, kare yakalama, kaynak zamanı eşleme (hız eğrileri dahil)

export function snapFrame(t, fps) {
  return Math.round(t * fps) / fps
}

export function frameOf(t, fps) {
  return Math.round(t * fps)
}

// 00:00:12:15 (kare) — film kesim masası kodu
export function timecode(t, fps = 30, withFrames = true) {
  if (!isFinite(t) || t < 0) t = 0
  const total = Math.round(t * fps)
  const f = total % fps
  const s = Math.floor(total / fps)
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = n => String(n).padStart(2, '0')
  const base = (hh ? p(hh) + ':' : '') + p(mm) + ':' + p(ss)
  return withFrames ? base + ':' + p(f) : base
}

export function shortTime(t) {
  if (!isFinite(t) || t < 0) t = 0
  if (t < 60) return t.toFixed(t < 10 ? 1 : 0) + ' sn'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return m + ':' + String(s).padStart(2, '0')
}

export function parseTimecode(str, fps = 30) {
  const parts = String(str).trim().split(':').map(Number)
  if (parts.some(n => !isFinite(n))) return null
  if (parts.length === 1) return parts[0]
  let f = 0, s = 0, m = 0, h = 0
  if (parts.length === 4) [h, m, s, f] = parts
  else if (parts.length === 3) [m, s, f] = parts
  else [m, s] = parts
  return h * 3600 + m * 60 + s + f / fps
}

// ---------------------------------------------------------------- hız eğrisi
// speedCurve.points: [{x: 0..1 (klip içi normalize zaman), y: hız çarpanı (0.1..10)}]
// Kaynak ilerlemesi: s(τ) = ∫ base*curve(u/D) du. Tablo önbelleği.

const curveCache = new WeakMap()

function curveAt(points, x) {
  if (!points || !points.length) return 1
  if (x <= points[0].x) return points[0].y
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (x <= b.x) {
      const k = (x - a.x) / Math.max(1e-6, b.x - a.x)
      const s = k * k * (3 - 2 * k) // yumuşak geçiş
      return a.y + (b.y - a.y) * s
    }
  }
  return points[points.length - 1].y
}

const N = 256
function curveTable(curve) {
  let t = curveCache.get(curve)
  if (t) return t
  const cum = new Float64Array(N + 1)
  let acc = 0
  cum[0] = 0
  for (let i = 1; i <= N; i++) {
    const x0 = (i - 1) / N, x1 = i / N
    acc += (curveAt(curve.points, x0) + curveAt(curve.points, x1)) * 0.5 / N
    cum[i] = acc
  }
  t = { cum, mean: acc }
  curveCache.set(curve, t)
  return t
}

export function curveMean(curve) {
  if (!curve || !curve.points) return 1
  return curveTable(curve).mean
}

export function curveSpeedAt(curve, x) {
  return curveAt(curve && curve.points, x)
}

// Kaynak aralığı (out-in) ve hız ayarından zaman çizelgesi süresi
export function durationFromSource(clip) {
  const span = Math.max(0.01, (clip.out ?? 0) - (clip.in ?? 0))
  const base = Math.max(0.05, clip.speed || 1)
  const mean = clip.speedCurve ? curveMean(clip.speedCurve) : 1
  return span / (base * mean)
}

// Klip yerel zamanı (0..duration) → kaynak medya zamanı
export function sourceTime(clip, localT) {
  if (clip.freeze) return clip.in || 0
  const dur = Math.max(1e-6, clip.duration)
  const span = (clip.out ?? dur) - (clip.in ?? 0)
  let progress
  if (clip.speedCurve && clip.speedCurve.points && clip.speedCurve.points.length) {
    const tab = curveTable(clip.speedCurve)
    const x = Math.min(1, Math.max(0, localT / dur))
    const fi = x * N
    const i = Math.min(N - 1, Math.floor(fi))
    const c = tab.cum[i] + (tab.cum[i + 1] - tab.cum[i]) * (fi - i)
    progress = c / tab.mean // 0..1
    // süre dışı (geçiş taşmaları) doğrusal devam
    if (localT < 0) progress = localT / dur
    else if (localT > dur) progress = 1 + (localT - dur) / dur
  } else {
    progress = localT / dur
  }
  const st = clip.reverse ? (clip.out - progress * span) : ((clip.in || 0) + progress * span)
  return st
}

// O andaki anlık oynatma hızı (önizlemede video.playbackRate için)
export function instantSpeed(clip, localT) {
  if (clip.freeze) return 0
  const base = clip.speed || 1
  if (clip.speedCurve && clip.speedCurve.points) {
    const x = Math.min(1, Math.max(0, localT / Math.max(1e-6, clip.duration)))
    const span = (clip.out ?? 0) - (clip.in ?? 0)
    const mean = curveMean(clip.speedCurve)
    // gerçek kaynak hızı = span/duration * curve(x)/mean
    return (span / Math.max(1e-6, clip.duration)) * curveAt(clip.speedCurve.points, x) / mean
  }
  return base
}
