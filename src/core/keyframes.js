// Anahtar kare değerlendirme
// clip.keyframes[path] = [{ t, v, ease }] — t klip başından saniye, sıralı tutulur.
// ease: bir önceki kareden BU kareye geçişte kullanılan eğri (bkz. easing.js), veya
// { bezier:[x1,y1,x2,y2] } özel eğri.

import { ease, cubicBezier, lerp } from './easing.js'
import { getPath } from './model.js'

const bezCache = new Map()
function easeOf(e, x) {
  if (!e) return x
  if (typeof e === 'string') return ease(e, x)
  if (e.bezier) {
    const k = e.bezier.join(',')
    let f = bezCache.get(k)
    if (!f) { f = cubicBezier(...e.bezier); bezCache.set(k, f) }
    return f(x)
  }
  return x
}

export function evalKeys(keys, t, fallback) {
  if (!keys || !keys.length) return fallback
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  // ikili arama
  let lo = 0, hi = keys.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keys[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = keys[lo], b = keys[hi]
  const span = b.t - a.t
  if (span <= 1e-9) return b.v
  const x = (t - a.t) / span
  return lerp(a.v, b.v, easeOf(b.ease, x))
}

// Klibin bir özelliğinin yerel zamandaki değeri (anahtar kare varsa onu, yoksa statik değer)
export function prop(clip, p, localT) {
  const keys = clip.keyframes && clip.keyframes[p]
  const base = getPath(clip, p)
  if (keys && keys.length) return evalKeys(keys, localT, base)
  return base
}

export function hasKeys(clip, p) {
  const k = clip.keyframes && clip.keyframes[p]
  return !!(k && k.length)
}

export function keyAt(clip, p, localT, eps = 1 / 120) {
  const k = clip.keyframes && clip.keyframes[p]
  if (!k) return -1
  return k.findIndex(x => Math.abs(x.t - localT) <= eps)
}

// draft (immer) üzerinde anahtar kare ekle/güncelle
export function upsertKey(draftClip, p, localT, v, easeName = 'easeInOut') {
  if (!draftClip.keyframes) draftClip.keyframes = {}
  const arr = draftClip.keyframes[p] || (draftClip.keyframes[p] = [])
  const i = arr.findIndex(x => Math.abs(x.t - localT) <= 1 / 120)
  if (i >= 0) arr[i].v = v
  else {
    arr.push({ t: localT, v, ease: easeName })
    arr.sort((a, b) => a.t - b.t)
  }
}

export function removeKey(draftClip, p, localT) {
  const arr = draftClip.keyframes && draftClip.keyframes[p]
  if (!arr) return
  const i = arr.findIndex(x => Math.abs(x.t - localT) <= 1 / 120)
  if (i >= 0) arr.splice(i, 1)
  if (!arr.length) delete draftClip.keyframes[p]
}

// Klip kesildiğinde / kırpıldığında anahtar kareleri kaydır
export function shiftKeys(draftClip, dt) {
  if (!draftClip.keyframes) return
  for (const p of Object.keys(draftClip.keyframes)) {
    draftClip.keyframes[p] = draftClip.keyframes[p].map(k => ({ ...k, t: k.t + dt }))
  }
}

// Tüm anahtar kare zamanlarının birleşimi (zaman çizelgesinde elmas göstermek için)
export function allKeyTimes(clip) {
  const s = new Set()
  if (clip.keyframes) for (const p of Object.keys(clip.keyframes)) for (const k of clip.keyframes[p]) s.add(Math.round(k.t * 1000) / 1000)
  return [...s].sort((a, b) => a - b)
}
