// Çıkartma katmanı çizici
// Sözleşme: renderStickerLayer(clip, localT, scale, project, imageFrame) → { canvas, width, height, key }
//   Tuvalin piksel boyutu ekranda görünecek son boyuttur. Temel boyut: tuval genişliğinin %40'ı × scale.
//   Animasyon hazırı (clip.sticker.params.anim ya da def.anim) varsa tuval taşma payıyla büyür; içerik aynı boyutta kalır.
//   Anahtar (key) çıktı değiştiğinde değişir: boyut, id, parametreler, (animasyonluysa) kare, yazı tipi yüklemeleri.

import { get as regGet } from './registry.js'

const cache = new Map()
const imgCache = new Map()
const rasterCache = new Map() // svg/png → istenen boyutta bitmap (her karede yeniden rasterleştirmemek için)
const MAX_PX = 4096

// emoji ve görsel çıkartmalar için animasyon hazırları
export const STICKER_ANIMS = [
  { value: 'none', label: 'Yok' },
  { value: 'bounce', label: 'Zıpla' },
  { value: 'pulse', label: 'Nabız' },
  { value: 'spin', label: 'Dön' },
  { value: 'shake', label: 'Titre' },
  { value: 'float', label: 'Süzül' },
  { value: 'pop', label: 'Patlayarak gir' },
  { value: 'swing', label: 'Sallan' },
  { value: 'jelly', label: 'Jöle' },
  { value: 'heartbeat', label: 'Kalp atışı' },
  { value: 'wiggle', label: 'Kıpırda' },
  { value: 'blink', label: 'Yanıp sön' },
]

let fontVer = 0
let fontHooked = false
function hookFonts() {
  if (fontHooked || typeof document === 'undefined' || !document.fonts) return
  fontHooked = true
  const bump = () => { fontVer++; if (typeof window !== 'undefined' && window.__sweaxRedraw) window.__sweaxRedraw() }
  try { document.fonts.addEventListener('loadingdone', bump) } catch (e) { /* eski */ }
}

function loadImage(src) {
  let e = imgCache.get(src)
  if (e) return e
  const img = new Image()
  img.decoding = 'async'
  e = { img, ready: false, error: false }
  e.promise = new Promise((res) => {
    img.onload = () => { e.ready = true; res(true); if (typeof window !== 'undefined' && window.__sweaxRedraw) window.__sweaxRedraw() }
    img.onerror = () => { e.error = true; res(false) }
  })
  img.src = src
  imgCache.set(src, e)
  return e
}

// Dışa aktarmadan önce: projedeki bütün çıkartma görsellerini (ve yazı tiplerini) yükle
export function preloadStickerImages(project) {
  const jobs = []
  for (const t of (project && project.tracks) || []) for (const c of t.clips) {
    if (c.type !== 'sticker' || !c.sticker || !c.sticker.id) continue
    const def = regGet('stickers', c.sticker.id)
    if (def && def.src) jobs.push(loadImage(def.src).promise)
  }
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) jobs.push(document.fonts.ready)
  return Promise.all(jobs)
}

function raster(src, img, w, h) {
  const k = src + '@' + w + 'x' + h
  let c = rasterCache.get(k)
  if (c) { rasterCache.delete(k); rasterCache.set(k, c); return c }
  c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  rasterCache.set(k, c)
  if (rasterCache.size > 48) rasterCache.delete(rasterCache.keys().next().value)
  return c
}

// t saniye → dönüşüm { dx, dy (boyut oranı), sx, sy, rot (radyan), alpha, py (dönme/ölçek ekseni, boyut oranı) }
const fr = (x) => x - Math.floor(x)
const outBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
export function animTransform(name, t) {
  const o = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, py: 0 }
  const TAU = Math.PI * 2
  switch (name) {
    case 'bounce': {
      const u = fr(t / 0.8), hgt = Math.abs(Math.sin(Math.PI * u))
      o.dy = -hgt * 0.16
      const sq = Math.max(0, 0.18 - hgt) * 0.9
      o.sx = 1 + sq; o.sy = 1 - sq; o.py = 0.5
      break
    }
    case 'pulse': { const s = 1 + 0.08 * Math.sin(TAU * t / 0.9); o.sx = o.sy = s; break }
    case 'spin': o.rot = TAU * t / 1.6; break
    case 'shake': o.rot = Math.sin(t * 41) * 0.07; o.dx = Math.sin(t * 57) * 0.025; o.dy = Math.cos(t * 49) * 0.012; break
    case 'float': o.dy = Math.sin(TAU * t / 2.4) * 0.06; o.rot = Math.sin(TAU * t / 2.4 + 1) * 0.05; break
    case 'pop': {
      const k = Math.min(1, Math.max(0, t / 0.4))
      const s = k < 1 ? Math.max(0, outBack(k)) : 1 + 0.03 * Math.sin(TAU * (t - 0.4) / 1.6)
      o.sx = o.sy = s; o.alpha = Math.min(1, k * 4)
      break
    }
    case 'swing': o.rot = Math.sin(TAU * t / 1.4) * 0.26; o.py = -0.48; break
    case 'jelly': { const k = Math.sin(TAU * t / 0.8) * 0.1; o.sx = 1 + k; o.sy = 1 - k; o.py = 0.5; break }
    case 'heartbeat': {
      const u = fr(t / 1.0)
      const s = 1 + 0.15 * Math.exp(-Math.pow((u - 0.08) / 0.05, 2)) + 0.1 * Math.exp(-Math.pow((u - 0.28) / 0.05, 2))
      o.sx = o.sy = s
      break
    }
    case 'wiggle': o.rot = Math.sin(t * 13) * 0.12; o.dy = Math.abs(Math.sin(t * 13)) * -0.03; break
    case 'blink': o.alpha = fr(t / 0.8) < 0.55 ? 1 : 0.12; break
    default: return null
  }
  return o
}

export function renderStickerLayer(clip, lt, scale, project, imageFrame) {
  hookFonts()
  const st = clip.sticker || {}
  const def = st.id ? regGet('stickers', st.id) : null
  const params = { ...defaultsOf(def), ...(st.params || {}) }
  const base = project.settings.width * 0.4 * scale
  const aspect = (def && def.aspect) || (imageFrame ? imageFrame.w / imageFrame.h : 1)
  let w = Math.max(2, Math.round(aspect >= 1 ? base : base * aspect))
  let h = Math.max(2, Math.round(aspect >= 1 ? base / aspect : base))
  const big = Math.max(w, h)
  if (big > MAX_PX) { const k = MAX_PX / big; w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k)) }
  const animName = params.anim === 'none' ? null : (params.anim || (def && def.anim) || null)
  const speed = +params.animSpeed > 0 ? +params.animSpeed : 1
  const xf = animName ? animTransform(animName, lt * speed) : null
  // animasyonlu çıkartmada taşma payı
  let cw = w, ch = h
  if (xf) {
    if (animName === 'spin') { const d = Math.ceil(Math.hypot(w, h) * 1.02); cw = d; ch = d }
    else { cw = Math.round(w * 1.4); ch = Math.round(h * 1.4) }
  }
  let hit = cache.get(clip.id)
  if (!hit) { hit = { canvas: document.createElement('canvas'), key: '' }; cache.set(clip.id, hit) }
  const c = hit.canvas
  const drawn = !!(def && typeof def.draw === 'function')
  const frameKey = drawn || xf ? '@' + Math.round(lt * 60) : ''
  const key = `${cw}x${ch}/${w}x${h}:${st.id}:${st.mediaId}:${JSON.stringify(st.params || {})}${frameKey}:f${fontVer}`
  if (hit.key === key) return hit
  // kaynak hazır mı?
  let srcImg = null, srcKey = ''
  if (!drawn) {
    if (def && def.src) {
      const e = loadImage(def.src)
      if (!e.ready) return null
      srcImg = e.img; srcKey = def.src
    } else if (imageFrame && imageFrame.src) {
      srcImg = imageFrame.src
    } else return null
  }
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch }
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  ctx.save()
  if (xf) {
    ctx.globalAlpha = Math.max(0, Math.min(1, xf.alpha))
    const px = cw / 2, py = ch / 2 + xf.py * h
    ctx.translate(px + xf.dx * w, py + xf.dy * h)
    ctx.rotate(xf.rot)
    ctx.scale(xf.sx, xf.sy)
    ctx.translate(-px, -py)
  }
  ctx.translate((cw - w) / 2, (ch - h) / 2)
  if (drawn) {
    try { def.draw(ctx, lt, w, h, params) } catch (e) { if (!hit.warned) { hit.warned = true; console.warn('çıkartma çizim hatası', st.id, e) } }
  } else if (srcKey && xf) {
    ctx.drawImage(raster(srcKey, srcImg, w, h), 0, 0, w, h)
  } else {
    ctx.drawImage(srcImg, 0, 0, w, h)
  }
  ctx.restore()
  hit.key = key
  hit.width = cw; hit.height = ch
  return hit
}

function defaultsOf(def) {
  const o = {}
  if (def) for (const p of def.params || []) o[p.key] = p.default
  return o
}
