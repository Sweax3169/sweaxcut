// Çıkartma katmanı çizici (TEMEL SÜRÜM — çıkartma paketi genişletir)
// Sözleşme: renderStickerLayer(clip, localT, scale, project, imageFrame) → { canvas, width, height, key }
//   Tuvalin piksel boyutu ekranda görünecek son boyuttur. Temel boyut: tuval genişliğinin %40'ı × scale.

import { get as regGet } from './registry.js'

const cache = new Map()
const imgCache = new Map()

function loadImage(src) {
  let e = imgCache.get(src)
  if (e) return e
  const img = new Image()
  img.decoding = 'async'
  e = { img, ready: false }
  img.onload = () => { e.ready = true; if (typeof window !== 'undefined' && window.__sweaxRedraw) window.__sweaxRedraw() }
  img.src = src
  imgCache.set(src, e)
  return e
}

export function renderStickerLayer(clip, lt, scale, project, imageFrame) {
  const st = clip.sticker || {}
  const def = st.id ? regGet('stickers', st.id) : null
  const base = project.settings.width * 0.4 * scale
  const aspect = (def && def.aspect) || (imageFrame ? imageFrame.w / imageFrame.h : 1)
  const w = Math.max(2, Math.round(aspect >= 1 ? base : base * aspect))
  const h = Math.max(2, Math.round(aspect >= 1 ? base / aspect : base))
  let hit = cache.get(clip.id)
  if (!hit) { hit = { canvas: document.createElement('canvas'), key: '' }; cache.set(clip.id, hit) }
  const c = hit.canvas
  const animated = def && def.kind === 'vector'
  const key = animated ? `${w}x${h}@${Math.round(lt * 60)}:${JSON.stringify(st.params)}` : `${w}x${h}:${st.id}:${st.mediaId}`
  if (hit.key === key) return hit
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  if (def && def.kind === 'vector' && def.draw) {
    try { def.draw(ctx, lt, w, h, { ...(defaultsOf(def)), ...(st.params || {}) }) } catch (e) { /* çizim hatası */ }
  } else if (def && def.src) {
    const e = loadImage(def.src)
    if (!e.ready) return null
    ctx.drawImage(e.img, 0, 0, w, h)
  } else if (imageFrame && imageFrame.src) {
    ctx.drawImage(imageFrame.src, 0, 0, w, h)
  } else return null
  hit.key = key
  hit.width = w; hit.height = h
  return hit
}

function defaultsOf(def) {
  const o = {}
  for (const p of def.params || []) o[p.key] = p.default
  return o
}
