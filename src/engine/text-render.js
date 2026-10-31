// Yazı katmanı çizici — SWEAXCUT yazı sistemi
// Sözleşme: renderTextLayer(clip, localT, scale, project) → { canvas, width, height, key, offsetX?, offsetY? }
//   scale = render ölçeği × transform.scale; font boyutu = text.size × (tuvalin kısa kenarı / 1080) × scale
//   Dönen tuval, yazının ekrandaki son piksel boyutundadır (bileşimci yeniden ölçeklemez).
//   Tuval yazı bloğunun merkezine göre SİMETRİK büyütülür → animasyon taşmaları sığar, çapa (merkez) kaymaz.
// Stil birimleri (kontur, gölge, dolgu, aralık…) 1080 genişlikli tuval pikselidir; hepsi font ölçeğiyle (k) çarpılır.
// Yazı animasyonları (REG.textAnims) burada uygulanır; bileşimci yalnız clipAnims'i uygular.
// Altyazı: clip.caption.words varsa ve styleId REG.captionStyles'ta bulunursa kelime kelime karaoke çizilir.
// Genişletilmiş stil alanları (isteğe bağlı): extrude {enabled,color,color2,depth,angle}, bar {enabled,color,width,side,gap},
//   bg.mode 'marker', bg.outline (px), fill {type:'linear'|'radial'|'stripes', angle, stops, scope:'line'|'block'}, stroke.join

import { get as regGet, registryVersion } from './registry.js'

const cache = new Map()      // clip.id → durum
const MAX_SIDE = 4096
const OFF = 16384            // gölgeyi gövdesiz çizmek için uzak ofset
const PI = Math.PI
const TR_CHARS = 'ÇçĞğİıÖöŞşÜüHgy'

// ------------------------------------------------------------------ dışa açık yardımcılar (eski imzalar)
// Boyut referansı tuvalin KISA kenarıdır (9:16'da genişlik = 1080 → eskisiyle aynı; 16:9'da yükseklik):
// yatay projelerde yazı 1,78 kat şişmesin.
export function textRefPx(project) {
  const st = project.settings
  return Math.min(st.width, st.height) || st.width
}
export function textFontPx(clip, scale, project) {
  return Math.max(4, (clip.text.size || 96) * (textRefPx(project) / 1080) * scale)
}

export function wrapLines(ctx, text, maxW) {
  const out = []
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/)
    let line = ''
    for (const w of words) {
      const test = line + w
      if (line && ctx.measureText(test).width > maxW && w.trim()) { out.push(line.trimEnd()); line = w.trimStart() }
      else line = test
    }
    out.push(line)
  }
  return out
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function hexA(hex, a) {
  const s = String(hex || '#000')
  if (!s.startsWith('#')) {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return `rgba(${p[0] | 0},${p[1] | 0},${p[2] | 0},${a * (p[3] ?? 1)})` }
    return s
  }
  let h = s.slice(1)
  if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  const a2 = h.length === 8 ? (parseInt(h.slice(6, 8), 16) / 255) : 1
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a * a2})`
}

// renk karıştırma (#hex)
export function mixColor(a, b, t) {
  const pa = rgb(a), pb = rgb(b)
  const c = i => Math.round(pa[i] + (pb[i] - pa[i]) * t)
  return '#' + [c(0), c(1), c(2)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}
function rgb(hex) {
  let h = String(hex || '#000').replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Anahtar kelime → emoji (altyazı emoji: true)
export const CAPTION_EMOJI = {
  ateş: '🔥', yangın: '🔥', alev: '🔥', fire: '🔥', sıcak: '🔥', efsane: '🔥',
  para: '💰', zengin: '💰', altın: '🪙', money: '💰', dolar: '💵', lira: '💸',
  öldü: '💀', öldüm: '💀', ölüm: '💀', kill: '💀', leş: '💀', öldürdüm: '💀', dead: '💀',
  kazandık: '🏆', kazandım: '🏆', zafer: '🏆', şampiyon: '🏆', birinci: '🥇', win: '🏆', kazan: '🏆',
  gol: '⚽', maç: '⚽', top: '⚽',
  aşk: '❤️', sevgi: '❤️', kalp: '❤️', seviyorum: '😍', güzel: '😍',
  komik: '😂', güldüm: '😂', haha: '😂', kahkaha: '🤣', şaka: '😜',
  şok: '😱', korku: '😱', korktum: '😱', inanılmaz: '🤯', vay: '😮', delirdim: '🤯',
  hızlı: '⚡', hız: '⚡', şimşek: '⚡', güç: '💪', güçlü: '💪', kas: '💪',
  oyun: '🎮', oyna: '🎮', gamer: '🎮', konsol: '🎮', bilgisayar: '💻',
  silah: '🔫', mermi: '🔫', bomba: '💣', patlama: '💥', boom: '💥', vur: '💥', vurdum: '🎯', hedef: '🎯', headshot: '🎯',
  kral: '👑', kraliçe: '👑', boss: '👑', patron: '😎', havalı: '😎', cool: '😎',
  üzgün: '😢', ağladım: '😭', ağla: '😭', acı: '😣', kızgın: '😡', sinir: '😡',
  düşün: '🤔', neden: '🤔', soru: '❓', dikkat: '⚠️', yasak: '🚫', hayır: '❌', evet: '✅', tamam: '👌',
  müzik: '🎵', şarkı: '🎶', dans: '💃', parti: '🎉', kutlama: '🎉', doğum: '🎂',
  yemek: '🍔', pizza: '🍕', kahve: '☕', uyku: '😴', yorgun: '🥱',
  roket: '🚀', uzay: '🚀', yıldız: '⭐', parlak: '✨', sihir: '✨', elmas: '💎', değerli: '💎',
  abone: '🔔', bildirim: '🔔', beğen: '👍', like: '👍', yorum: '💬', paylaş: '📤', takip: '➕',
  su: '💧', buz: '🧊', soğuk: '🥶', dünya: '🌍', saat: '⏰', zaman: '⏳', beyin: '🧠', zeki: '🧠', göz: '👀', bak: '👀',
}
export function emojiFor(word) {
  const w = String(word || '').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '')
  if (!w) return null
  if (CAPTION_EMOJI[w]) return CAPTION_EMOJI[w]
  for (const k in CAPTION_EMOJI) if (k.length >= 4 && w.startsWith(k)) return CAPTION_EMOJI[k]
  return null
}

// ------------------------------------------------------------------ yazı tipi
const weightCache = new Map()
let weightVer = -1
function pickWeight(fam, w, italic) {
  const rv = registryVersion()
  if (rv !== weightVer) { weightCache.clear(); weightVer = rv }
  const ck = fam + '|' + w + '|' + (italic ? 1 : 0)
  if (weightCache.has(ck)) return weightCache.get(ck)
  const def = regGet('fonts', fam)
  let best = w
  if (def && def.files && def.files.length) {
    const ws = [...new Set(def.files.map(f => +f.weight))]
    best = ws[0]
    for (const x of ws) {
      const d = Math.abs(x - w), bd = Math.abs(best - w)
      if (d < bd || (d === bd && x > best)) best = x
    }
  }
  weightCache.set(ck, best)
  return best
}

function fontString(s, px) {
  const fam = s.font || 'Archivo'
  const w = pickWeight(fam, s.weight || 400, s.italic)
  return `${s.italic ? 'italic ' : ''}${w} ${px.toFixed(2)}px "${fam}", "Archivo", sans-serif`
}

const requested = new Set()
let fontHook = false
function redraw() { if (typeof window !== 'undefined' && window.__sweaxRedraw) window.__sweaxRedraw() }
function fontReady(font, text) {
  if (typeof document === 'undefined' || !document.fonts) return true
  if (!fontHook) {
    fontHook = true
    try { document.fonts.addEventListener('loadingdone', () => redraw()) } catch (e) { /* */ }
  }
  const sample = (text || '').slice(0, 200) + TR_CHARS
  let ok = true
  try { ok = document.fonts.check(font, sample) } catch (e) { ok = true }
  if (!ok) {
    const fk = font.replace(/[\d.]+px/, 'Xpx')
    if (!requested.has(fk)) {
      requested.add(fk)
      document.fonts.load(font, sample).then(() => redraw(), () => {})
    }
  }
  return ok
}

// ------------------------------------------------------------------ ölçüm tuvali
let _mctx = null
function mctx() {
  if (!_mctx) _mctx = makeCanvas(4, 4).getContext('2d')
  return _mctx
}
function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  return new OffscreenCanvas(w, h)
}
function setFont(ctx, R) {
  ctx.font = R.font
  ctx.letterSpacing = R.ls ? R.ls.toFixed(2) + 'px' : '0px'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

let _seg = null
function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    if (!_seg) _seg = new Intl.Segmenter('tr', { granularity: 'grapheme' })
    return [..._seg.segment(str)].map(x => ({ t: x.segment, i: x.index }))
  }
  const out = []; let i = 0
  for (const ch of str) { out.push({ t: ch, i }); i += ch.length }
  return out
}

function upperTR(s) { return String(s).toLocaleUpperCase('tr-TR') }
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function rnd(a, b, c) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeOut = x => 1 - (1 - x) * (1 - x)
const backOut = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
const bounceOut = x => {
  const n1 = 7.5625, d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}

// ------------------------------------------------------------------ afin matris [a,b,c,d,e,f]
const I = [1, 0, 0, 1, 0, 0]
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
}
const tr = (x, y) => [1, 0, 0, 1, x, y]
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
function animMatrix(a, px, py) {
  const sc = a.scale ?? 1
  const sx = sc * (a.scaleX ?? 1), sy = sc * (a.scaleY ?? 1)
  const r = (a.rotation || 0) * PI / 180
  const kx = Math.tan((a.skewX || 0) * PI / 180), ky = Math.tan((a.skewY || 0) * PI / 180)
  const x = a.x || 0, y = a.y || 0
  if (sx === 1 && sy === 1 && !r && !kx && !ky && !x && !y) return null
  const cs = Math.cos(r), sn = Math.sin(r)
  const A = cs * sx - sn * ky * sx, B = sn * sx + cs * ky * sx, C = cs * kx * sy - sn * sy, D = sn * kx * sy + cs * sy
  return [A, B, C, D, x + px - (A * px + C * py), y + py - (B * px + D * py)]
}

// ------------------------------------------------------------------ stil çözümleme
function resolveStyle(s, fontPx, k) {
  const font = fontString(s, fontPx)
  const st = s.stroke && s.stroke.enabled && s.stroke.width > 0 ? { w: s.stroke.width * k, color: s.stroke.color || '#000', join: s.stroke.join || 'round' } : null
  const st2 = s.stroke2 && s.stroke2.enabled && s.stroke2.width > 0 ? { w: s.stroke2.width * k, color: s.stroke2.color || '#fff' } : null
  const outer = (st ? st.w : 0) + (st2 ? st2.w : 0)
  const shd = s.shadow && s.shadow.enabled ? { color: s.shadow.color || '#000', opacity: s.shadow.opacity ?? 0.6, blur: Math.max(0, s.shadow.blur || 0) * k, x: (s.shadow.x || 0) * k, y: (s.shadow.y || 0) * k } : null
  const gl = s.glow && s.glow.enabled && s.glow.size > 0 ? { color: s.glow.color || '#4dd2ff', size: s.glow.size * k, strength: s.glow.strength ?? 1 } : null
  const ex = s.extrude && s.extrude.enabled && s.extrude.depth > 0 ? { color: s.extrude.color || '#000', color2: s.extrude.color2 || null, depth: s.extrude.depth * k, angle: s.extrude.angle ?? 60 } : null
  const E = Math.ceil(outer + Math.max(gl ? gl.size * 1.6 : 0, shd ? shd.blur * 1.5 + Math.max(Math.abs(shd.x), Math.abs(shd.y)) : 0, ex ? ex.depth + outer : 0) + fontPx * 0.04 + 2)
  return {
    font, fontPx, k, color: s.color || '#ffffff', fill: s.fill && (s.fill.stops || s.fill.type === 'stripes') ? s.fill : null,
    opacityFill: s.opacityFill ?? 1, stroke: st, stroke2: st2, outer, shadow: shd, glow: gl, extrude: ex,
    underline: !!s.underline, ls: (s.letterSpacing || 0) * k, E,
  }
}

function fillStyle(ctx, R, box, override) {
  if (override) return override
  const f = R.fill
  if (!f) return R.color
  const x0 = box[0], y0 = box[1], w = Math.max(1, box[2] - box[0]), h = Math.max(1, box[3] - box[1])
  const cx = x0 + w / 2, cy = y0 + h / 2
  if (f.type === 'stripes') {
    const cols = f.colors || [f.stops ? f.stops[0].color : R.color, f.stops ? f.stops[f.stops.length - 1].color : '#000']
    const sz = Math.max(2, (f.size || 10) * R.k)
    const pc = makeCanvas(Math.ceil(sz * 2), Math.ceil(sz * 2))
    const p = pc.getContext('2d')
    p.fillStyle = cols[0]; p.fillRect(0, 0, pc.width, pc.height)
    p.fillStyle = cols[1]
    p.beginPath(); p.moveTo(0, 0); p.lineTo(sz, 0); p.lineTo(0, sz); p.closePath(); p.fill()
    p.beginPath(); p.moveTo(sz * 2, 0); p.lineTo(sz * 2, sz); p.lineTo(sz, sz * 2); p.lineTo(0, sz * 2); p.closePath(); p.fill()
    const pat = ctx.createPattern(pc, 'repeat')
    return pat || cols[0]
  }
  let g
  if (f.type === 'radial') {
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6)
  } else {
    const a = ((f.angle ?? 180) * PI) / 180
    const dx = Math.sin(a), dy = -Math.cos(a)
    const L = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
    g = ctx.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L)
  }
  for (const st of f.stops) { try { g.addColorStop(clamp01(st.at), st.color) } catch (e) { /* bozuk renk */ } }
  return g
}

// Tek yazı parçasını (yerel orijin: taban çizgisi-sol) bir katman olarak çiz. Bağlam yalnız öteleme içermeli.
// layer 0: parıltı + gölge, 1: derinlik + kontur, 2: dolgu + alt çizgi
function drawRun(ctx, layer, text, R, box, color, adv) {
  setFont(ctx, R)
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2.5
  const ul = R.underline ? [0, R.fontPx * 0.09, adv, R.fontPx * 0.07] : null
  const shape = (x, y, lw) => {
    if (lw > 0) { ctx.lineWidth = lw; ctx.strokeText(text, x, y); if (ul) ctx.strokeRect(ul[0] + x, ul[1] + y, ul[2], ul[3]) }
    ctx.fillText(text, x, y)
    if (ul) ctx.fillRect(ul[0] + x, ul[1] + y, ul[2], ul[3])
  }
  if (layer === 0) {
    if (R.glow) {
      const g = R.glow
      const passes = Math.max(1, Math.min(6, Math.round(1 + g.strength * 2)))
      ctx.save()
      ctx.fillStyle = ctx.strokeStyle = '#000'
      ctx.shadowColor = g.color
      ctx.shadowOffsetX = OFF; ctx.shadowOffsetY = 0
      for (let i = 0; i < passes; i++) {
        ctx.shadowBlur = g.size * (passes === 1 ? 1 : 1 - (i / passes) * 0.8)
        shape(-OFF, 0, R.outer * 2)
      }
      ctx.restore()
    }
    if (R.shadow) {
      const s = R.shadow
      ctx.save()
      ctx.fillStyle = ctx.strokeStyle = '#000'
      ctx.shadowColor = hexA(s.color, s.opacity)
      ctx.shadowBlur = s.blur
      ctx.shadowOffsetX = OFF + s.x; ctx.shadowOffsetY = s.y
      shape(-OFF, 0, R.outer * 2 + (R.extrude ? 0 : 0))
      if (R.extrude) {
        const e = R.extrude, a = e.angle * PI / 180
        shape(-OFF + Math.cos(a) * e.depth, Math.sin(a) * e.depth, R.outer * 2)
      }
      ctx.restore()
    }
  } else if (layer === 1) {
    if (R.extrude) {
      const e = R.extrude, a = e.angle * PI / 180
      const steps = Math.max(1, Math.min(48, Math.ceil(e.depth)))
      for (let i = steps; i >= 1; i--) {
        const t = i / steps
        ctx.fillStyle = ctx.strokeStyle = e.color2 ? mixColor(e.color, e.color2, t) : e.color
        shape(Math.cos(a) * e.depth * t, Math.sin(a) * e.depth * t, R.outer * 2)
      }
    }
    if (R.stroke2) {
      ctx.strokeStyle = R.stroke2.color
      ctx.lineWidth = R.outer * 2
      ctx.strokeText(text, 0, 0)
      if (ul) ctx.strokeRect(ul[0], ul[1], ul[2], ul[3])
    }
    if (R.stroke) {
      ctx.strokeStyle = R.stroke.color
      ctx.lineJoin = R.stroke.join
      ctx.lineWidth = R.stroke.w * 2
      ctx.strokeText(text, 0, 0)
      if (ul) ctx.strokeRect(ul[0], ul[1], ul[2], ul[3])
    }
  } else {
    ctx.save()
    ctx.globalAlpha *= R.opacityFill
    ctx.fillStyle = fillStyle(ctx, R, box, color)
    ctx.fillText(text, 0, 0)
    if (ul) ctx.fillRect(ul[0], ul[1], ul[2], ul[3])
    ctx.restore()
  }
}
function layerUsed(R, layer) {
  if (layer === 0) return !!(R.glow || R.shadow)
  if (layer === 1) return !!(R.extrude || R.stroke || R.stroke2)
  return R.opacityFill > 0.001
}

// ------------------------------------------------------------------ yerleşim
function layoutText(content, R, maxW, s) {
  const ctx = mctx()
  setFont(ctx, R)
  const lines = wrapLines(ctx, content, maxW)
  const lh = R.fontPx * (s.lineHeight || 1.12)
  const mH = ctx.measureText('H')
  const capH = mH.actualBoundingBoxAscent || R.fontPx * 0.7
  const L = lines.map(t => {
    const m = ctx.measureText(t)
    const w = t ? m.width - R.ls : 0
    return { text: t, w, adv: m.width, l: m.actualBoundingBoxLeft || 0, r: m.actualBoundingBoxRight || 0, a: m.actualBoundingBoxAscent || 0, d: m.actualBoundingBoxDescent || 0 }
  })
  const blockW = Math.max(1, ...L.map(x => x.w))
  const blockH = lh * L.length
  const align = s.align || 'center'
  L.forEach((ln, i) => {
    ln.cy = -blockH / 2 + lh * (i + 0.5)
    ln.y = ln.cy + capH / 2
    ln.x = align === 'left' ? -blockW / 2 : align === 'right' ? blockW / 2 - ln.w : -ln.w / 2
    ln.box = [ln.x, ln.y - capH * 1.12, ln.x + ln.w, ln.y + capH * 0.16]   // dolgu kutusu (blok koordinatı)
  })
  const blockBox = [-blockW / 2, L.length ? L[0].box[1] : 0, blockW / 2, L.length ? L[L.length - 1].box[3] : 0]
  return { lines: L, lh, capH, blockW, blockH, blockBox, align }
}

// arka plan kutuları (blok koordinatında)
function bgRects(Lay, s, k) {
  const bg = s.bg
  if (!bg || !bg.enabled) return []
  const px = (bg.padX ?? 24) * k, py = (bg.padY ?? 12) * k
  const lines = Lay.lines.filter(l => l.text.trim())
  if (!lines.length) return []
  if (bg.mode === 'marker') {
    return lines.map(l => ({ x: l.x - px * 0.5, y: l.y - Lay.capH * 0.86 - py * 0.5, w: l.w + px, h: Lay.capH * 1.08 + py, rot: -1.2 }))
  }
  if (bg.mode === 'line') {
    return lines.map(l => ({ x: l.x - px, y: l.cy - Lay.lh / 2 - py, w: l.w + px * 2, h: Lay.lh + py * 2 }))
  }
  let x0 = Infinity, x1 = -Infinity
  for (const l of lines) { x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x + l.w) }
  const y0 = Lay.lines[0].cy - Lay.lh / 2, y1 = Lay.lines[Lay.lines.length - 1].cy + Lay.lh / 2
  return [{ x: x0 - px, y: y0 - py, w: x1 - x0 + px * 2, h: y1 - y0 + py * 2 }]
}
function barRects(Lay, s, k, bgs) {
  const b = s.bar
  if (!b || !b.enabled) return []
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const src = bgs.length ? bgs : Lay.lines.filter(l => l.text.trim()).map(l => ({ x: l.x, y: l.cy - Lay.lh / 2, w: l.w, h: Lay.lh }))
  for (const r of src) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h) }
  if (!isFinite(x0)) return []
  const w = (b.width ?? 8) * k, gap = (b.gap ?? (bgs.length ? 0 : 14)) * k
  const side = b.side || 'left'
  if (side === 'left') return [{ x: x0 - gap - w, y: y0, w, h: y1 - y0 }]
  if (side === 'right') return [{ x: x1 + gap, y: y0, w, h: y1 - y0 }]
  if (side === 'top') return [{ x: x0, y: y0 - gap - w, w: x1 - x0, h: w }]
  return [{ x: x0, y: y1 + gap, w: x1 - x0, h: w }]
}
function drawBoxes(ctx, s, k, bgs, bars, alpha) {
  if (alpha <= 0.001) return
  const bg = s.bg
  if (bgs.length) {
    ctx.save()
    ctx.globalAlpha *= (bg.opacity ?? 0.7) * alpha
    const r = (bg.radius || 0) * k
    for (const b of bgs) {
      ctx.save()
      if (b.rot) { ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(b.rot * PI / 180); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2)) }
      roundRect(ctx, b.x, b.y, b.w, b.h, bg.mode === 'marker' ? Math.min(r, b.h * 0.3) : r)
      if (bg.outline) { ctx.strokeStyle = bg.color; ctx.lineWidth = bg.outline * k; ctx.stroke() } else { ctx.fillStyle = bg.color; ctx.fill() }
      ctx.restore()
    }
    ctx.restore()
  }
  if (bars.length) {
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.fillStyle = s.bar.color || '#E4FF3A'
    for (const b of bars) ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.restore()
  }
}

// ------------------------------------------------------------------ birimler (harf / kelime / satır)
// Her birim: { text, xF, yF (düz yerleşim taban-sol), adv, m:{l,r,a,d}, li, wi, ci, P (yerleşim matrisi), box, fillBox }
const GRAN = { whole: 0, line: 1, word: 2, char: 3 }
function buildUnits(Lay, R, gran, curve) {
  const ctx = mctx()
  setFont(ctx, R)
  const units = []
  let wi = 0, ci = 0, li = 0
  const lineRefs = []
  for (const ln of Lay.lines) {
    const t = ln.text
    if (!t.trim()) continue
    const words = []
    const re = /\S+/g
    let m
    while ((m = re.exec(t))) words.push({ t: m[0], i: m.index, wi: wi++ })
    let segs
    if (gran === 'char' || curve) segs = graphemes(t).filter(g => g.t.trim()).map(g => ({ ...g, wi: (words.find(w => g.i >= w.i && g.i < w.i + w.t.length) || words[0]).wi }))
    else if (gran === 'word') segs = words
    else segs = [{ t: t.trimEnd(), i: 0, wi: words[0].wi }]
    for (const sg of segs) {
      const pre = sg.i ? ctx.measureText(t.slice(0, sg.i)).width : 0
      const mm = ctx.measureText(sg.t)
      const adv = Math.max(0, mm.width - (sg.t.length ? R.ls : 0))
      const u = {
        text: sg.t, xF: ln.x + pre, yF: ln.y, adv,
        m: { l: mm.actualBoundingBoxLeft || 0, r: Math.max(mm.actualBoundingBoxRight || 0, R.underline ? adv : 0), a: mm.actualBoundingBoxAscent || 0, d: Math.max(mm.actualBoundingBoxDescent || 0, R.underline ? R.fontPx * 0.18 : 0) },
        li, wi: sg.wi, ci: ci++,
      }
      u.fillBox = (s => [s[0] - u.xF, s[1] - u.yF, s[2] - u.xF, s[3] - u.yF])(ln.box)
      units.push(u)
    }
    lineRefs.push(ln)
    li++
  }
  // yerleşim matrisleri
  const c = curve ? Math.max(-1, Math.min(1, curve / 100)) : 0
  if (Math.abs(c) > 0.005 && units.length) {
    const sg = c > 0 ? 1 : -1
    const Rad = Math.max(R.fontPx * 0.8, Lay.blockW / (Math.abs(c) * PI * 1.5))
    const y0 = lineRefs[0].y
    const cyc = y0 + sg * Rad
    for (const u of units) {
      const Rl = Math.max(R.fontPx * 0.6, Math.abs(cyc - u.yF))
      const dx = u.xF + u.adv / 2
      const th = dx / Rl
      const x = Rl * Math.sin(th)
      const y = sg > 0 ? cyc - Rl * Math.cos(th) : cyc + Rl * Math.cos(th)
      const rot = sg > 0 ? th : -th
      const cs = Math.cos(rot), sn = Math.sin(rot)
      u.P = mul([cs, sn, -sn, cs, x, y], tr(-u.adv / 2, 0))
    }
    // eğri bloğu görsel merkeze al
    let y0b = Infinity, y1b = -Infinity, x0b = Infinity, x1b = -Infinity
    for (const u of units) for (const [px, py] of corners(u.P, [-u.m.l, -u.m.a, u.m.r, u.m.d])) { x0b = Math.min(x0b, px); x1b = Math.max(x1b, px); y0b = Math.min(y0b, py); y1b = Math.max(y1b, py) }
    const sh = tr(-(x0b + x1b) / 2, -(y0b + y1b) / 2)
    for (const u of units) u.P = mul(sh, u.P)
  } else {
    for (const u of units) u.P = tr(u.xF, u.yF)
  }
  // pivot kutuları
  const boxes = { char: [], word: [], line: [], whole: null }
  const grow = (arr, i, b) => { const o = arr[i]; arr[i] = o ? [Math.min(o[0], b[0]), Math.min(o[1], b[1]), Math.max(o[2], b[2]), Math.max(o[3], b[3])] : b.slice() }
  for (const u of units) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [px, py] of corners(u.P, [0, -Lay.capH, u.adv, 0])) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py) }
    u.box = [x0, y0, x1, y1]
    grow(boxes.char, u.ci, u.box); grow(boxes.word, u.wi, u.box); grow(boxes.line, u.li, u.box)
    boxes.whole = boxes.whole ? [Math.min(boxes.whole[0], x0), Math.min(boxes.whole[1], y0), Math.max(boxes.whole[2], x1), Math.max(boxes.whole[3], y1)] : u.box.slice()
  }
  // kelime indekslerini sıkıştır (boş satır yok)
  return { units, boxes, counts: { char: ci, word: wi, line: li, whole: 1 } }
}
function corners(M, r) {
  return [ap(M, r[0], r[1]), ap(M, r[2], r[1]), ap(M, r[2], r[3]), ap(M, r[0], r[3])]
}

// ------------------------------------------------------------------ sprite (birim başına 3 katman)
function getSprite(S, R, u, text, color) {
  const key = text + (R.fill ? '@' + u.xF.toFixed(1) + ',' + u.yF.toFixed(1) : '')
  let sp = S.map.get(key)
  if (!sp) {
    if (S.map.size > 1500) S.map.clear()
    const ctx = mctx()
    setFont(ctx, R)
    const mm = text === u.text ? null : ctx.measureText(text)
    const m = mm ? { l: mm.actualBoundingBoxLeft || 0, r: mm.actualBoundingBoxRight || 0, a: mm.actualBoundingBoxAscent || 0, d: mm.actualBoundingBoxDescent || 0 } : u.m
    const adv = mm ? mm.width - R.ls : u.adv
    const E = R.E
    const ox = Math.ceil(m.l + E), oy = Math.ceil(m.a + E)
    const w = Math.max(1, ox + Math.ceil(m.r + E)), h = Math.max(1, oy + Math.ceil(m.d + E))
    sp = { ox, oy, w, h, adv, layers: [null, null, null], fills: new Map() }
    for (let L = 0; L < 2; L++) {
      if (!layerUsed(R, L)) continue
      const c = makeCanvas(w, h)
      const x = c.getContext('2d')
      x.translate(ox, oy)
      drawRun(x, L, text, R, u.fillBox, null, adv)
      sp.layers[L] = c
    }
    sp.text = text
    S.map.set(key, sp)
  }
  if (!layerUsed(R, 2)) return sp
  const fk = color || ''
  if (!sp.fills.has(fk)) {
    if (sp.fills.size > 48) sp.fills.clear()
    const c = makeCanvas(sp.w, sp.h)
    const x = c.getContext('2d')
    x.translate(sp.ox, sp.oy)
    drawRun(x, 2, text, R, u.fillBox, color || null, sp.adv)
    sp.fills.set(fk, c)
  }
  sp.layers[2] = sp.fills.get(fk)
  return sp
}

// ------------------------------------------------------------------ yazı animasyonları
const probeCache = new WeakMap()
function probe(def) {
  let f = probeCache.get(def)
  if (f) return f
  f = { chars: def.unit === 'char' || !!def.needsChars, vis: false, cursor: false, scramble: false }
  try {
    for (const p of [0.3, 0.7]) {
      const r = def.fn(p, 0, 1, { fontSize: 100, lineH: 112, seed: 1, t: 0.5, n: 1, unitW: 100, unitH: 70, color: '#ffffff' }) || {}
      if ('visibleChars' in r) f.vis = true
      if ('cursor' in r) f.cursor = true
      if ('scramble' in r) f.scramble = true
    }
  } catch (e) { /* */ }
  if (f.vis || f.scramble) f.chars = true
  probeCache.set(def, f)
  return f
}

function resolveAnims(clip) {
  const anim = clip.anim || {}
  const out = []
  for (const slot of ['in', 'loop', 'out']) {
    const a = anim[slot]
    if (!a || !a.id) continue
    if (regGet('clipAnims', a.id)) continue          // bileşimci uygular
    const def = regGet('textAnims', a.id)
    if (!def || typeof def.fn !== 'function') continue
    const dur = slot === 'loop' ? Math.max(0.1, a.duration || def.duration || 1) : Math.max(0.05, Math.min(a.duration || def.duration || 0.6, clip.duration || 3))
    out.push({ slot, def, dur, unit: def.unit || 'whole', flags: probe(def), id: a.id })
  }
  return out
}

// birim sırası (stagger için)
function orderIndex(def, i, n, seed) {
  const o = def.order
  if (!o || n <= 1) return i
  if (o === 'reverse') return n - 1 - i
  if (o === 'center') { const c = (n - 1) / 2; return Math.abs(i - c) * 2 * (n - 1) / Math.max(1, n - 1) / 2 }
  if (o === 'edges') { const c = (n - 1) / 2; return (c - Math.abs(i - c)) }
  if (o === 'random') {
    // tohumlu permütasyon
    const idx = Array.from({ length: n }, (_, k) => k)
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(rnd(seed, k, 77) * (k + 1)); const t = idx[k]; idx[k] = idx[j]; idx[j] = t }
    return idx.indexOf(i)
  }
  return i
}
function unitProgress(A, P, i, n, seed) {
  const stg = A.def.stagger || 0
  if (A.slot === 'loop') return P - i * stg
  if (n <= 1 || !stg) return clamp01(P)
  let maxI = n - 1
  if (A.def.order === 'center' || A.def.order === 'edges') maxI = (n - 1) / 2
  const s = Math.min(stg, 0.72 / Math.max(1, maxI))
  const span = 1 - s * maxI
  return clamp01((P - orderIndex(A.def, i, n, seed) * s) / span)
}

function slotProgress(A, lt, dur) {
  if (A.slot === 'in') return lt < A.dur ? lt / A.dur : null
  if (A.slot === 'out') { const st = dur - A.dur; return lt > st ? clamp01((lt - st) / A.dur) : null }
  return lt / A.dur
}

function unitIndex(kind, u) { return kind === 'char' ? u.ci : kind === 'word' ? u.wi : kind === 'line' ? u.li : 0 }
function pivotOf(U, kind, u) {
  const b = kind === 'char' ? U.boxes.char[u.ci] : kind === 'word' ? U.boxes.word[u.wi] : kind === 'line' ? U.boxes.line[u.li] : U.boxes.whole
  return b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1]] : [0, 0, 1, 1]
}

// bir birimin bu karedeki durumu
function evalUnit(U, acts, u, R, Lay, seed, lt, memo) {
  let M = u.P, alpha = 1, blur = 0, color = null, clip = 1, clipDir = 'left', mask = false, scramble = 0, wipe = 0, wipeColor = null, clipBox = null
  for (let ai = 0; ai < acts.length; ai++) {
    const A = acts[ai]
    const kind = A.unit
    const idx = unitIndex(kind, u)
    const mk = ai * 100000 + idx
    let res = memo.get(mk)
    if (!res) {
      const n = U.counts[kind] || 1
      const pv = pivotOf(U, kind, u)
      const p = unitProgress(A, A.P, idx, n, seed)
      let a = null
      try { a = A.def.fn(p, idx, n, { fontSize: R.fontPx, lineH: Lay.lh, seed, t: lt, n, unitW: pv[2], unitH: pv[3], color: R.color, slot: A.slot }) } catch (e) { a = null }
      a = a || {}
      res = { a, M: animMatrix(a, pv[0], pv[1]) }
      memo.set(mk, res)
    }
    const a = res.a
    if (res.M) M = mul(res.M, M)
    if (a.opacity != null) alpha *= Math.max(0, a.opacity)
    if (a.blur) blur += a.blur
    if (a.color) color = a.color
    if (a.clip != null) {
      const cv = clamp01(a.clip)
      if (cv < clip || !clipBox) { const pv = pivotOf(U, kind, u); clipBox = [pv[0] - pv[2] / 2, pv[1] - pv[3] / 2, pv[0] + pv[2] / 2, pv[1] + pv[3] / 2] }
      clip = Math.min(clip, cv); if (a.clipDir) clipDir = a.clipDir; if (a.mask) mask = true
    }
    if (a.scramble) scramble = Math.max(scramble, a.scramble)
    if (a.wipe != null) { wipe = clamp01(a.wipe); wipeColor = a.wipeColor || '#E4FF3A' }
  }
  return { M, alpha, blur, color, clip, clipDir, mask, scramble, wipe, wipeColor, clipBox }
}

const SCRAMBLE_UP = 'ABCDEFGHIJKLMNOPRSTUVYZÇĞİÖŞÜ0123456789#$%&@*?!'
const SCRAMBLE_LO = 'abcdefghijklmnoprstuvyzçğıöşü0123456789#$%&@*?!'

// ------------------------------------------------------------------ ana giriş
export function renderTextLayer(clip, lt, scale, project) {
  const s = clip.text
  if (!s) return null
  if (clip.caption && Array.isArray(clip.caption.words) && clip.caption.words.length) {
    let cs = (clip.caption.styleId && regGet('captionStyles', clip.caption.styleId)) || DEFAULT_CAPTION
    if (clip.caption.look) cs = withLook(cs, clip.caption.look)
    try { return renderCaption(clip, lt, scale, project, cs) } catch (e) { console.warn('altyazı çizilemedi', e) }
  }
  let st = cache.get(clip.id)
  if (!st) {
    st = { canvas: makeCanvas(2, 2), sprites: { key: '', map: new Map() } }
    cache.set(clip.id, st)
    if (cache.size > 400) { const first = cache.keys().next().value; if (first !== clip.id) cache.delete(first) }
  }
  const fontPx = textFontPx(clip, scale, project)
  const k = fontPx / (s.size || 96)
  let content = String(s.content ?? '').replace(/\r/g, '')
  if (s.uppercase) content = upperTR(content)
  const R = resolveStyle(s, fontPx, k)
  const ready = fontReady(R.font, content)
  const maxW = Math.max(fontPx, (s.maxWidth || 0.86) * project.settings.width * scale)
  const lkey = JSON.stringify([content, s, Math.round(fontPx * 100), Math.round(maxW), ready, registryVersion()])
  if (st.lkey !== lkey) {
    st.lkey = lkey
    st.lhash = hashStr(lkey).toString(36)
    st.Lay = layoutText(content, R, maxW, s)
    st.bgs = bgRects(st.Lay, s, k)
    st.bars = barRects(st.Lay, s, k, st.bgs)
    st.U = null; st.ukey = ''
    st.bounds = null; st.bmap = null
    st.sprites = { key: lkey, map: new Map() }
  }
  const Lay = st.Lay
  const acts = resolveAnims(clip)
  const curved = Math.abs(s.curve || 0) > 0.5
  const seed = hashStr(clip.id)
  // bu karede etkin animasyonlar
  const live = []
  for (const A of acts) {
    const P = slotProgress(A, lt, clip.duration || 3)
    if (P == null) continue
    if (A.slot === 'in' && P >= 1) continue
    if (A.slot === 'out' && P <= 0) continue
    live.push({ ...A, P })
  }
  if (!content.trim()) return emptyResult(st)
  if (!live.length && !curved) {
    const key = 'S|' + st.lhash
    if (st.key === key && st.res) return st.res
    return drawStatic(st, R, Lay, s, k, key)
  }
  // ince taneli birimler: bütün tanımlı animasyonların en incesi (taneler arası atlama olmasın)
  let g = curved ? 'char' : 'whole'
  for (const A of acts) {
    const u = A.flags.chars ? 'char' : A.unit
    if (GRAN[u] > GRAN[g]) g = u
  }
  const ukey = g + '|' + (s.curve || 0)
  if (st.ukey !== ukey) { st.U = buildUnits(Lay, R, g, curved ? s.curve : 0); st.ukey = ukey; st.bmap = null }
  const U = st.U
  // tuval boyutu: bu evrede etkin animasyonların örnekleriyle bulunur (evre içinde sabit → titreme yok;
  // evre değişince boyut değişebilir ama çapa merkezde kaldığı için görüntü kaymaz)
  const sig = acts.map(a => a.id + ':' + a.dur.toFixed(3)).join(',')
  const phase = live.map(a => a.slot).join('+') || 'static'
  const bk = sig + '|' + phase + '|' + ukey
  if (!st.bmap || st.bmapKey !== st.lhash) { st.bmap = new Map(); st.bmapKey = st.lhash }
  let bounds = st.bmap.get(bk)
  if (!bounds) { bounds = animBounds(U, live.length ? live : acts.filter(a => a.slot === 'loop'), R, Lay, s, k, st, seed); st.bmap.set(bk, bounds) }
  st.bounds = bounds
  const key = 'A|' + st.lhash + '|' + ukey + '|' + sig + '|' + phase + '|' + (live.length ? Math.round(lt * 1000) : 'x')
  if (st.key === key && st.res) return st.res
  return drawAnimated(st, R, Lay, U, s, k, live, lt, seed, key, clip)
}

function emptyResult(st) {
  const c = st.canvas
  if (c.width !== 2 || c.height !== 2) { c.width = 2; c.height = 2 } else c.getContext('2d').clearRect(0, 0, 2, 2)
  st.key = 'E'
  st.res = { canvas: c, width: 2, height: 2, key: 'E|' + (st.lhash || ''), offsetX: 0, offsetY: 0 }
  return st.res
}

function sizeCanvas(st, hw, hh) {
  const w = Math.min(MAX_SIDE, Math.max(2, 2 * Math.ceil(hw)))
  const h = Math.min(MAX_SIDE, Math.max(2, 2 * Math.ceil(hh)))
  const c = st.canvas
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { c, ctx, w, h }
}

function staticExtents(Lay, R, bgs, bars) {
  let hw = 0, hh = 0
  const E = R.E
  for (const l of Lay.lines) {
    if (!l.text) continue
    hw = Math.max(hw, Math.abs(l.x - l.l - E), Math.abs(l.x + Math.max(l.r, l.w) + E))
    hh = Math.max(hh, Math.abs(l.y - l.a - E), Math.abs(l.y + Math.max(l.d, R.underline ? R.fontPx * 0.18 : 0) + E))
  }
  for (const b of [...bgs, ...bars]) {
    const ex = b.rot ? b.h * 0.1 + 2 : 2
    hw = Math.max(hw, Math.abs(b.x) + ex, Math.abs(b.x + b.w) + ex)
    hh = Math.max(hh, Math.abs(b.y) + ex + b.w * Math.abs(Math.sin((b.rot || 0) * PI / 180)) / 2, Math.abs(b.y + b.h) + ex + b.w * Math.abs(Math.sin((b.rot || 0) * PI / 180)) / 2)
  }
  return [hw + 2, hh + 2]
}

function drawStatic(st, R, Lay, s, k, key) {
  const [hw, hh] = staticExtents(Lay, R, st.bgs, st.bars)
  const { c, ctx, w, h } = sizeCanvas(st, hw, hh)
  ctx.translate(w / 2, h / 2)
  drawBoxes(ctx, s, k, st.bgs, st.bars, 1)
  const blockFill = R.fill && R.fill.scope === 'block'
  for (let L = 0; L < 3; L++) {
    if (!layerUsed(R, L)) continue
    for (const ln of Lay.lines) {
      if (!ln.text) continue
      ctx.save()
      ctx.translate(ln.x, ln.y)
      const fb = blockFill ? Lay.blockBox : ln.box
      drawRun(ctx, L, ln.text, R, [fb[0] - ln.x, fb[1] - ln.y, fb[2] - ln.x, fb[3] - ln.y], null, ln.w)
      ctx.restore()
    }
  }
  st.key = key
  st.res = { canvas: c, width: w, height: h, key: key + '|' + w + 'x' + h, offsetX: 0, offsetY: 0 }
  return st.res
}

// animasyon boyunca taşmaları kapsayan simetrik yarı boyutlar
function animBounds(U, acts, R, Lay, s, k, st, seed) {
  let [hw, hh] = staticExtents(Lay, R, st.bgs, st.bars)
  const E = R.E
  const add = (M, r, extra) => {
    for (const [x, y] of corners(M, [r[0] - extra, r[1] - extra, r[2] + extra, r[3] + extra])) { hw = Math.max(hw, Math.abs(x)); hh = Math.max(hh, Math.abs(y)) }
  }
  for (const u of U.units) add(u.P, [-u.m.l - E, -u.m.a - E, u.m.r + E, u.m.d + E], 0)
  for (const A of acts) {
    const samples = A.slot === 'loop' ? 32 : 24
    for (let si = 0; si <= samples; si++) {
      const P = si / samples
      const memo = new Map()
      const one = [{ ...A, P }]
      const tS = 0.05 + si * 0.0731      // zamana bağlı rastgele titreşimler de örneklensin
      for (const u of U.units) {
        const ev = evalUnit(U, one, u, R, Lay, seed, tS, memo)
        if (ev.alpha <= 0.002) continue
        add(ev.M, [-u.m.l - E, -u.m.a - E, u.m.r + E, u.m.d + E], ev.blur * 2)
      }
      // tamamı birimli animasyonda kutular da hareket eder
      if (A.unit === 'whole' && (st.bgs.length || st.bars.length)) {
        const pv = pivotOf(U, 'whole', U.units[0])
        let a = {}
        try { a = A.def.fn(clamp01(P), 0, 1, { fontSize: R.fontPx, lineH: Lay.lh, seed, t: 0.5, n: 1, unitW: pv[2], unitH: pv[3], color: R.color }) || {} } catch (e) { a = {} }
        const M = animMatrix(a, pv[0], pv[1]) || I
        for (const b of [...st.bgs, ...st.bars]) add(M, [b.x, b.y, b.x + b.w, b.y + b.h], 2)
      }
    }
  }
  const cap = MAX_SIDE / 2 - 2, m = R.fontPx * 0.06 + 4
  hw = Math.min(cap, hw * 1.03 + m)
  hh = Math.min(cap, hh * 1.03 + m)
  return [hw, hh]
}

function drawAnimated(st, R, Lay, U, s, k, live, lt, seed, key, clip) {
  const [hw, hh] = st.bounds
  const { c, ctx, w, h } = sizeCanvas(st, hw, hh)
  const base = tr(w / 2, h / 2)
  const memo = new Map()
  const evs = U.units.map(u => evalUnit(U, live, u, R, Lay, seed, lt, memo))
  // daktilo / imleç (bütün birimli sonuçlardan)
  let vis = 1, cursor = 0, hasVis = false
  for (const A of live) {
    if (!A.flags.vis && !A.flags.cursor) continue
    try {
      const a = A.def.fn(clamp01(A.slot === 'loop' ? A.P : A.P), 0, 1, { fontSize: R.fontPx, lineH: Lay.lh, seed, t: lt, n: 1, color: R.color, slot: A.slot }) || {}
      if (a.visibleChars != null) { vis = Math.min(vis, clamp01(a.visibleChars)); hasVis = true }
      if (a.cursor != null) cursor = Math.max(cursor, clamp01(a.cursor))
    } catch (e) { /* */ }
  }
  const nChars = U.counts.char || U.units.length
  const visCount = hasVis ? Math.floor(vis * nChars + 1e-6) : nChars
  // arka plan: 'whole' animasyonlarla birlikte hareket, ince animasyonlarda ortalama saydamlık
  if (st.bgs.length || st.bars.length) {
    let M = I, alpha = 1, bclip = 1, bdir = 'left'
    const pv = pivotOf(U, 'whole', U.units[0])
    for (const A of live) {
      if (A.unit !== 'whole' || A.flags.chars) continue
      let a = {}
      try { a = A.def.fn(clamp01(A.slot === 'loop' ? A.P : A.P), 0, 1, { fontSize: R.fontPx, lineH: Lay.lh, seed, t: lt, n: 1, unitW: pv[2], unitH: pv[3], color: R.color, slot: A.slot }) || {} } catch (e) { a = {} }
      const am = animMatrix(a, pv[0], pv[1])
      if (am) M = mul(am, M)
      if (a.opacity != null) alpha *= a.opacity
      if (a.clip != null && a.clip < bclip) { bclip = clamp01(a.clip); bdir = a.clipDir || 'left' }
    }
    const fine = live.some(A => A.unit !== 'whole' || A.flags.chars)
    if (fine && evs.length) {
      let sum = 0, n = 0
      evs.forEach((e, i) => { const vis2 = U.units[i].ci < visCount ? 1 : 0; sum += Math.min(1, e.alpha) * vis2; n++ })
      alpha *= Math.min(1, (sum / Math.max(1, n)) * 1.4)
    }
    ctx.save()
    const m = mul(base, M)
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    if (bclip < 1) {
      const wb = U.boxes.whole.slice()
      for (const b of [...st.bgs, ...st.bars]) { wb[0] = Math.min(wb[0], b.x); wb[1] = Math.min(wb[1], b.y); wb[2] = Math.max(wb[2], b.x + b.w); wb[3] = Math.max(wb[3], b.y + b.h) }
      clipRect(ctx, U.boxes.whole, R.E + R.fontPx * 0.1, R.fontPx * 0.45 + R.E, bclip, bdir, wb)
    }
    drawBoxes(ctx, s, k, st.bgs, st.bars, alpha)
    ctx.restore()
  }
  const S = st.sprites
  const bucket = Math.floor(lt * 18)
  for (let L = 0; L < 3; L++) {
    if (!layerUsed(R, L)) continue
    for (let i = 0; i < U.units.length; i++) {
      const u = U.units[i], ev = evs[i]
      if (ev.alpha <= 0.003 || u.ci >= visCount || ev.clip <= 0.001) continue
      let text = u.text
      if (ev.scramble > 0 && rnd(seed, u.ci, bucket) < ev.scramble) {
        const set = u.text === u.text.toLocaleLowerCase('tr-TR') ? SCRAMBLE_LO : SCRAMBLE_UP
        text = set[Math.floor(rnd(seed + 7, u.ci, bucket) * set.length)]
      }
      const sp = getSprite(S, R, u, text, L === 2 ? ev.color : null)
      const img = sp.layers[L]
      if (!img) continue
      ctx.save()
      ctx.globalAlpha = Math.min(1, ev.alpha)
      if (ev.clip < 1 && ev.clipBox) {
        const A = ev.mask ? I : mul(ev.M, invert(u.P))
        const cm = mul(base, A)
        ctx.setTransform(cm[0], cm[1], cm[2], cm[3], cm[4], cm[5])
        clipRect(ctx, ev.clipBox, R.E + R.fontPx * 0.1, R.fontPx * 0.45 + R.E, ev.clip, ev.clipDir)
      } else if (ev.mask) {
        const cm = mul(base, u.P)
        ctx.setTransform(cm[0], cm[1], cm[2], cm[3], cm[4], cm[5])
        ctx.beginPath(); ctx.rect(-sp.ox, -sp.oy, sp.w, sp.h); ctx.clip()
      }
      const m = mul(base, ev.M)
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
      if (ev.blur > 0.3) ctx.filter = `blur(${ev.blur.toFixed(1)}px)`
      ctx.drawImage(img, -sp.ox, -sp.oy)
      // karaoke silme: dolgu katmanını vurgu rengiyle soldan örter
      if (L === 2 && ev.wipe > 0) {
        const sp2 = getSprite(S, R, u, text, ev.wipeColor)
        ctx.beginPath()
        // birim 'whole' ise blok genişliğine göre
        const bx = U.boxes.whole
        const W0 = bx[0], W1 = bx[2]
        const lim = W0 + (W1 - W0) * ev.wipe
        const inv = invert(u.P)
        const p0 = ap(inv, lim, 0)
        const localLim = p0[0]
        ctx.rect(-sp.ox, -sp.oy, Math.max(0, Math.min(sp.w, localLim + sp.ox)), sp.h)
        ctx.clip()
        ctx.drawImage(sp2.layers[2], -sp.ox, -sp.oy)
      }
      ctx.restore()
    }
  }
  // imleç
  if (cursor > 0.01) {
    let x = 0, y = 0, M = I
    const idx = Math.min(visCount, U.units.length) - 1
    if (idx >= 0) { const u = U.units[idx]; M = evs[idx].M; x = u.adv + R.fontPx * 0.06; y = 0 } else if (U.units.length) { M = U.units[0].P; x = -R.fontPx * 0.08 }
    const m = mul(base, M)
    ctx.save()
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
    ctx.globalAlpha = cursor
    const bw = Math.max(2, R.fontPx * 0.07), bh = Lay.capH * 1.2
    if (R.stroke) { ctx.fillStyle = R.stroke.color; ctx.fillRect(x - R.stroke.w, y - bh - R.stroke.w, bw + R.stroke.w * 2, bh + Lay.capH * 0.15 + R.stroke.w * 2) }
    ctx.fillStyle = R.color
    ctx.fillRect(x, y - bh, bw, bh + Lay.capH * 0.15)
    ctx.restore()
  }
  st.key = key
  st.res = { canvas: c, width: w, height: h, key: key + '|' + w + 'x' + h, offsetX: 0, offsetY: 0 }
  void clip
  return st.res
}
// kırpma dikdörtgeni: b = [x0,y0,x1,y1] (blok koordinatı), ilerleme f, yön; outer verilirse kutu onu da kapsar
function clipRect(ctx, b, padX, padY, f, dir, outer) {
  let x0 = b[0] - padX, x1 = b[2] + padX, y0 = b[1] - padY, y1 = b[3] + padY
  if (outer) { x0 = Math.min(x0, outer[0] - 2); x1 = Math.max(x1, outer[2] + 2); y0 = Math.min(y0, outer[1] - 2); y1 = Math.max(y1, outer[3] + 2) }
  const w = x1 - x0, h = y1 - y0
  ctx.beginPath()
  if (dir === 'right') ctx.rect(x0 + w * (1 - f), y0, w * f, h)
  else if (dir === 'up') ctx.rect(x0, y0 + h * (1 - f), w, h * f)
  else if (dir === 'down') ctx.rect(x0, y0, w, h * f)
  else if (dir === 'center') ctx.rect(x0 + w * (1 - f) / 2, y0, w * f, h)
  else ctx.rect(x0, y0, w * f, h)
  ctx.clip()
}
function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

// ================================================================== ALTYAZI (kelime kelime)
const DEFAULT_CAPTION = { id: '_varsayilan', active: { color: '#FFE600', scale: 1.1 }, wordIn: 'pop' }
const WORD_IN_DUR = 0.2

// Klibin kendi görünüm değişiklikleri (altyazı düzenleyicisi) kayıtlı stilin üstüne; önbellek anahtarı için id'ye eklenir
const lookCache = new WeakMap()
function withLook(cs, look) {
  let m = lookCache.get(look)
  if (m && m.base === cs) return m.res
  const res = mergeStyle(cs, look)
  res.id = cs.id + '|' + hashStr(JSON.stringify(look)).toString(36)
  lookCache.set(look, { base: cs, res })
  return res
}

function mergeStyle(s, o) {
  if (!o) return s
  const r = { ...s }
  for (const k of Object.keys(o)) {
    const v = o[k]
    r[k] = v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object' ? { ...s[k], ...v } : v
  }
  return r
}

function renderCaption(clip, lt, scale, project, cs) {
  const s = clip.text
  let st = cache.get(clip.id)
  if (!st) { st = { canvas: makeCanvas(2, 2), sprites: { key: '', map: new Map() } }; cache.set(clip.id, st) }
  const fontPx = textFontPx(clip, scale, project)
  const k = fontPx / (s.size || 96)
  const words = clip.caption.words
  const upper = cs.uppercase ?? s.uppercase
  const toks = words.map(w => (upper ? upperTR(w.w) : String(w.w ?? '')).trim())
  const act = cs.active || {}
  const R = resolveStyle(s, fontPx, k)
  // aktif kelime için ayrı stil (kontur/parıltı/dolgu farklıysa)
  const actStyle = {}
  if (act.stroke) actStyle.stroke = { enabled: true, ...act.stroke }
  if (act.glow) actStyle.glow = { enabled: true, ...act.glow }
  if (act.shadow) actStyle.shadow = { enabled: true, ...act.shadow }
  if (act.fill) actStyle.fill = act.fill
  if (act.color) actStyle.color = act.color
  const RA = Object.keys(actStyle).length > (act.color ? 1 : 0) ? resolveStyle(mergeStyle(s, actStyle), fontPx, k) : R
  const Emax = Math.max(R.E, RA.E)
  const ready = fontReady(R.font, toks.join(' '))
  const maxW = Math.max(fontPx, (s.maxWidth || 0.86) * project.settings.width * scale)
  const lkey = JSON.stringify([toks, words.map(w => [w.s, w.e]), s, cs.id, Math.round(fontPx * 100), Math.round(maxW), ready, registryVersion()])
  if (st.lkey !== lkey) {
    st.lkey = lkey
    st.lhash = hashStr(lkey).toString(36)
    st.C = layoutCaption(toks, R, maxW, s, cs, k)
    st.sprites = { key: lkey, map: new Map() }
    st.spritesA = { key: lkey, map: new Map() }
    const C = st.C
    // sabit simetrik sınırlar
    const bgp = act.bg ? Math.max((act.bg.padX ?? 12), (act.bg.padY ?? 6)) * k : 0
    const wbp = cs.wordBg ? Math.max(cs.wordBg.padX ?? 10, cs.wordBg.padY ?? 6) * k : 0
    const sbp = s.bg && s.bg.enabled ? Math.max(s.bg.padX ?? 24, s.bg.padY ?? 12) * k : 0
    const grow = Math.max(0, (act.scale || 1) - 1, 0.25)
    const maxAdv = Math.max(1, ...C.items.map(t => t.adv))
    const padX = Emax + Math.max(bgp, wbp) + maxAdv * grow * 0.6 + fontPx * 0.25
    const padY = Emax + Math.max(bgp, wbp) + fontPx * (0.55 + grow * 0.6) + Math.abs(act.y || 0) * k
    let hw = 0, hh = 0
    for (const t of C.items) {
      hw = Math.max(hw, Math.abs(t.x - t.m.l) + padX, Math.abs(t.x + Math.max(t.adv, t.m.r)) + padX)
      hh = Math.max(hh, Math.abs(t.y - t.m.a) + padY, Math.abs(t.y + t.m.d) + padY)
    }
    if (sbp) for (const r of C.bgs) { hw = Math.max(hw, Math.abs(r.x) + 2, Math.abs(r.x + r.w) + 2); hh = Math.max(hh, Math.abs(r.y) + 2, Math.abs(r.y + r.h) + 2) }
    st.cb = [Math.min(MAX_SIDE / 2 - 2, hw + 4), Math.min(MAX_SIDE / 2 - 2, hh + 4)]
  }
  const C = st.C
  // aktif kelime
  let ai = -1
  for (let i = 0; i < words.length; i++) if ((words[i].s ?? 0) <= lt + 1e-4) ai = i
  let animating = false
  for (let i = 0; i < words.length; i++) { const d = lt - (words[i].s ?? 0); if (d >= -1e-4 && d < 0.3) { animating = true; break } }
  if (act.wipe && ai >= 0 && lt < (words[ai].e ?? words[ai].s + 0.3)) animating = true
  if (cs.loop && cs.loop !== 'none') animating = true
  const key = 'C|' + st.lhash + '|' + ai + '|' + (animating ? Math.round(lt * 1000) : '')
  if (st.key === key && st.res) return st.res
  const [hw, hh] = st.cb
  const { c, ctx, w, h } = sizeCanvas(st, hw, hh)
  const base = tr(w / 2, h / 2)
  ctx.setTransform(base[0], base[1], base[2], base[3], base[4], base[5])
  // ifade arka planı
  if (C.bgs.length) drawBoxes(ctx, s, k, C.bgs, [], 1)
  const pastC = cs.past || {}, futC = cs.future || {}
  const n = words.length
  const states = C.items.map(t => {
    const i = t.wi
    const ws = words[i].s ?? 0
    const started = lt >= ws - 1e-4
    const isAct = i === ai
    const nextS = i + 1 < n ? (words[i + 1].s ?? Infinity) : Infinity
    const rise = clamp01((lt - ws) / 0.14)
    const fall = isAct ? 0 : clamp01((lt - nextS) / 0.1)
    let amt = started ? backOut(rise) * (1 - easeOut(fall)) : 0
    if (!isAct && i > ai) amt = 0
    let alpha = started ? (isAct ? 1 : (pastC.opacity ?? 1)) : (futC.opacity ?? 1)
    let color = null
    const pal = cs.palette && cs.palette.length ? cs.palette[i % cs.palette.length] : null
    if (pal) color = pal
    if (started && !isAct && pastC.color) color = pastC.color
    if (!started && futC.color) color = futC.color
    if (isAct || amt > 0.5) { if (act.color) color = act.color }
    let sc = 1 + ((act.scale || 1) - 1) * amt
    let dy = (act.y || 0) * k * amt, dx = 0, blur = 0, clip = 1, rot = 0
    // kelime girişi
    if (started && !t.emoji) {
      const p = clamp01((lt - ws) / WORD_IN_DUR)
      const wi = cs.wordIn || 'none'
      if (p < 1) {
        if (wi === 'pop') { sc *= 0.5 + 0.5 * backOut(p); alpha *= Math.min(1, p * 3) }
        else if (wi === 'fade') alpha *= p
        else if (wi === 'slide') { dy += (1 - easeOut(p)) * fontPx * 0.35; alpha *= p }
        else if (wi === 'drop') { dy -= (1 - bounceOut(p)) * fontPx * 0.5; alpha *= Math.min(1, p * 4) }
        else if (wi === 'bump') sc *= 1 + 0.22 * Math.sin(p * PI)
        else if (wi === 'blur') { blur = (1 - p) * fontPx * 0.12; alpha *= p }
        else if (wi === 'type') clip = easeOut(p)
        else if (wi === 'spin') { rot = (1 - backOut(p)) * -25; sc *= 0.6 + 0.4 * backOut(p); alpha *= Math.min(1, p * 3) }
        else if (wi === 'stretch') { sc *= 1; dx = 0; t._sy = 1 + (1 - easeOut(p)) * 0.8; alpha *= Math.min(1, p * 3) }
        else {
          const def = regGet('textAnims', wi)
          if (def) {
            try {
              const a = def.fn(p, i, n, { fontSize: fontPx, lineH: C.lh, seed: 1, t: lt, n, color: R.color }) || {}
              dx += a.x || 0; dy += a.y || 0; sc *= (a.scale ?? 1); rot += a.rotation || 0
              if (a.opacity != null) alpha *= a.opacity
              if (a.blur) blur += a.blur
              if (a.clip != null) clip = clamp01(a.clip)
            } catch (e) { /* */ }
          }
        }
      }
    }
    if (t.emoji) {
      const p = clamp01((lt - ws) / 0.3)
      alpha = started ? 1 : 0
      sc = started ? 0.3 + 0.7 * backOut(p) : 0
      rot = started ? Math.sin(lt * 5 + i) * 8 * (1 - p * 0.4) : 0
    }
    // döngü efekti (aktif kelimede)
    if (cs.loop === 'wiggle' && isAct) rot += Math.sin(lt * 18) * 4
    if (cs.loop === 'pulse' && isAct) sc *= 1 + 0.05 * Math.sin(lt * 12)
    if (cs.loop === 'float') dy += Math.sin(lt * 3 + i * 0.7) * fontPx * 0.04
    const grow = t.emoji ? 0 : Math.max(0, ((act.scale || 1) - 1) * amt) * t.adv / 2
    return { t, i, isAct, started, amt, alpha, color, sc, dx, dy, blur, clip, rot, sy: t._sy || 1, grow }
  })
  for (const st2 of states) delete st2.t._sy
  // büyüyen aktif kelime aynı satırdaki komşularını iter
  for (const A of states) {
    if (A.grow <= 0.01) continue
    for (const B of states) {
      if (B === A || B.t.line !== A.t.line) continue
      if (B.t.x < A.t.x) B.dx -= A.grow; else B.dx += A.grow
    }
  }
  // kelime kutuları (her kelime)
  if (cs.wordBg) {
    const b = cs.wordBg
    ctx.save()
    for (const S of states) {
      if (S.t.emoji || S.alpha <= 0.01) continue
      const r = wordRect(S.t, C, b, k)
      ctx.globalAlpha = (b.opacity ?? 0.75) * Math.min(1, S.alpha)
      ctx.fillStyle = b.color || '#000'
      withWordXf(ctx, base, S, () => { roundRect(ctx, r.x, r.y, r.w, r.h, (b.radius ?? 6) * k); ctx.fill() })
    }
    ctx.restore()
  }
  // aktif kelime kutusu / alt çizgisi (önceki kelimeden kayarak)
  if (ai >= 0 && (act.bg || act.underline)) {
    const cur = C.items.find(t => t.wi === ai && !t.emoji)
    if (cur) {
      const S = states.find(x => x.t === cur)
      const tb = clamp01((lt - (words[ai].s ?? 0)) / 0.12)
      const prev = ai > 0 ? C.items.find(t => t.wi === ai - 1 && !t.emoji) : null
      const sameLine = prev && prev.line === cur.line && (lt - (words[ai - 1].e ?? words[ai].s) < 0.25)
      const draw = (spec, rectFn, radius) => {
        let r = rectFn(cur)
        let popS = 1
        if (sameLine && tb < 1) {
          const pr = rectFn(prev), e = easeOut(tb)
          r = { x: pr.x + (r.x - pr.x) * e, y: pr.y + (r.y - pr.y) * e, w: pr.w + (r.w - pr.w) * e, h: pr.h + (r.h - pr.h) * e }
        } else popS = 0.6 + 0.4 * backOut(tb)
        ctx.save()
        ctx.globalAlpha = (spec.opacity ?? 1) * Math.min(1, tb * 3)
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2
        const sc = popS * (sameLine && tb < 1 ? 1 : S.sc)
        ctx.translate(cx, cy + S.dy); ctx.rotate((spec.rotate || 0) * PI / 180); ctx.scale(sc, sc); ctx.translate(-cx, -cy)
        roundRect(ctx, r.x, r.y, r.w, r.h, radius)
        if (spec.outline) { ctx.strokeStyle = spec.color || '#fff'; ctx.lineWidth = spec.outline * k; ctx.stroke() } else { ctx.fillStyle = spec.color || '#22C55E'; ctx.fill() }
        ctx.restore()
      }
      if (act.bg) draw(act.bg, t => wordRect(t, C, act.bg, k), (act.bg.radius ?? 10) * k)
      if (act.underline) {
        const u = act.underline
        draw(u, t => ({ x: t.x - 2 * k, y: t.y + (u.offset ?? 10) * k, w: t.adv + 4 * k, h: (u.height ?? 8) * k }), (u.radius ?? 3) * k)
      }
    }
  }
  // kelimeler: katman sırasıyla, aktif kelime en üstte
  const order = states.slice().sort((a, b) => (a.isAct ? 1 : 0) - (b.isAct ? 1 : 0))
  for (let L = 0; L < 3; L++) {
    for (const S of order) {
      if (S.alpha <= 0.003 || S.sc <= 0.001 || S.clip <= 0.001) continue
      const t = S.t
      const useA = S.amt > 0.5 && RA !== R
      const RR = useA ? RA : R
      if (t.emoji) {
        if (L !== 2) continue
        drawEmoji(ctx, base, S, t, fontPx)
        continue
      }
      if (!layerUsed(RR, L)) continue
      const sp = getSprite(useA ? st.spritesA : st.sprites, RR, t, t.text, L === 2 && !(useA && RR.fill) ? S.color : null)
      const img = sp.layers[L]
      if (!img) continue
      ctx.save()
      ctx.globalAlpha = Math.min(1, S.alpha)
      withWordXf(ctx, base, S, null)
      if (S.clip < 1) { ctx.beginPath(); ctx.rect(t.x - sp.ox, t.y - sp.oy, sp.w * S.clip, sp.h); ctx.clip() }
      if (S.blur > 0.3) ctx.filter = `blur(${S.blur.toFixed(1)}px)`
      ctx.drawImage(img, t.x - sp.ox, t.y - sp.oy)
      // karaoke dolgu
      if (L === 2 && act.wipe && S.isAct) {
        const ws = words[S.i].s ?? 0, we = Math.max(ws + 0.05, words[S.i].e ?? ws + 0.4)
        const p = clamp01((lt - ws) / (we - ws))
        const sp2 = getSprite(st.sprites, R, t, t.text, act.wipeColor || act.color || '#00E5FF')
        ctx.beginPath(); ctx.rect(t.x - sp.ox, t.y - sp.oy, sp.ox + t.adv * p, sp.h); ctx.clip()
        ctx.drawImage(sp2.layers[2], t.x - sp.ox, t.y - sp.oy)
      }
      ctx.restore()
    }
  }
  st.key = key
  st.res = { canvas: c, width: w, height: h, key: key + '|' + w + 'x' + h, offsetX: 0, offsetY: 0 }
  return st.res
}

function withWordXf(ctx, base, S, fn) {
  const t = S.t
  const cx = t.x + t.adv / 2, cy = t.y - t.capH / 2
  let m = mul(base, tr(cx + S.dx, cy + S.dy))
  if (S.rot) { const r = S.rot * PI / 180; m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]) }
  m = mul(m, [S.sc, 0, 0, S.sc * (S.sy || 1), 0, 0])
  m = mul(m, tr(-cx, -cy))
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
  if (fn) fn()
}

function wordRect(t, C, b, k) {
  const px = (b.padX ?? 12) * k, py = (b.padY ?? 6) * k
  return { x: t.x - px, y: t.y - C.capH * 1.08 - py, w: t.adv + px * 2, h: C.capH * 1.08 + C.capH * 0.2 + py * 2 }
}

function drawEmoji(ctx, base, S, t, fontPx) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, S.alpha)
  withWordXf(ctx, base, S, null)
  ctx.font = `${(fontPx * 0.95).toFixed(1)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = fontPx * 0.08; ctx.shadowOffsetY = fontPx * 0.04
  ctx.fillText(t.text, t.x + t.adv / 2, t.y + fontPx * 0.04)
  ctx.restore()
}

function layoutCaption(toks, R, maxW, s, cs, k) {
  const ctx = mctx()
  setFont(ctx, R)
  const capH = ctx.measureText('H').actualBoundingBoxAscent || R.fontPx * 0.7
  const lh = R.fontPx * (s.lineHeight || 1.12) * (cs.lineGap || 1.08)
  // kelime aralığı: boşluk + kontur payı + aktif kelime büyümesi + kutu dolguları
  const act = cs.active || {}
  const space = ctx.measureText(' ').width + R.outer * 1.1 + R.fontPx * 0.06 + (cs.wordGap || 0) * k +
    Math.max(0, (act.scale || 1) - 1) * R.fontPx * 0.25 +
    Math.max(cs.wordBg ? (cs.wordBg.padX ?? 10) * k * 2 : 0, act.bg ? (act.bg.padX ?? 12) * k * 1.6 : 0)
  const items = []
  toks.forEach((tk, wi) => {
    if (!tk) return
    const m = ctx.measureText(tk)
    items.push({ text: tk, wi, adv: m.width - R.ls, m: { l: m.actualBoundingBoxLeft || 0, r: m.actualBoundingBoxRight || 0, a: m.actualBoundingBoxAscent || 0, d: m.actualBoundingBoxDescent || 0 } })
    if (cs.emoji) {
      const e = emojiFor(tk)
      if (e) items.push({ text: e, wi, emoji: true, adv: R.fontPx * 0.95, m: { l: 0, r: R.fontPx * 0.95, a: R.fontPx * 0.9, d: R.fontPx * 0.15 } })
    }
  })
  // satırlara böl
  const lines = [[]]
  let lw = 0
  for (const it of items) {
    const gap = it.emoji ? space * 0.45 : space
    const add = (lines[lines.length - 1].length ? gap : 0) + it.adv
    if (lines[lines.length - 1].length && lw + add > maxW && !it.emoji) { lines.push([]); lw = 0 }
    lw += (lines[lines.length - 1].length ? gap : 0) + it.adv
    it.gap = gap
    lines[lines.length - 1].push(it)
  }
  const blockH = lh * lines.length
  const align = s.align || 'center'
  const widths = lines.map(L => L.reduce((a, it, i) => a + it.adv + (i ? it.gap : 0), 0))
  const blockW = Math.max(1, ...widths)
  lines.forEach((L, li) => {
    const wdt = widths[li]
    let x = align === 'left' ? -blockW / 2 : align === 'right' ? blockW / 2 - wdt : -wdt / 2
    const cy = -blockH / 2 + lh * (li + 0.5)
    const y = cy + capH / 2
    L.forEach((it, j) => { if (j) x += it.gap; it.x = x; it.y = y; it.cy = cy; it.line = li; it.capH = capH; x += it.adv; it.xF = it.x; it.yF = it.y })
  })
  for (const it of items) {
    const ln = lines[it.line]
    const x0 = ln[0].x, x1 = ln[ln.length - 1].x + ln[ln.length - 1].adv
    it.fillBox = [x0 - it.x, -capH * 1.12, x1 - it.x, capH * 0.16]
  }
  // ifade arka planı (yazı bg ayarı)
  const bgs = []
  if (s.bg && s.bg.enabled) {
    const px = (s.bg.padX ?? 24) * k, py = (s.bg.padY ?? 12) * k
    const rows = lines.map((L, li) => ({ x: L[0].x, w: widths[li], cy: L[0].cy }))
    if (s.bg.mode === 'line' || s.bg.mode === 'marker') for (const r of rows) bgs.push({ x: r.x - px, y: r.cy - lh / 2 - py, w: r.w + px * 2, h: lh + py * 2 })
    else {
      const x0 = Math.min(...rows.map(r => r.x)), x1 = Math.max(...rows.map(r => r.x + r.w))
      bgs.push({ x: x0 - px, y: -blockH / 2 - py, w: x1 - x0 + px * 2, h: blockH + py * 2 })
    }
  }
  return { items, lines, lh, capH, space, blockW, blockH, bgs }
}

// Önbelleği boşalt (yazı tipi değişimi vb.)
export function clearTextCache(id) { if (id) cache.delete(id); else cache.clear() }
