// Vektör çıkartma tanım yardımcısı + simge yolları
import { stage } from './kit.js'

export const C = (key, label, def) => ({ key, label, type: 'color', default: def })
export const T = (key, label, def) => ({ key, label, type: 'text', default: def })
export const N = (key, label, def, min = 0, max = 100, step = 1) => ({ key, label, type: 'range', default: def, min, max, step })

// fn(ctx, t, p, W, H): tasarım alanı H = 100 birim, W = 100 × en-boy oranı
export function V(id, name, category, o, fn) {
  const aspect = o.aspect || 1
  const vw = 100 * aspect, vh = 100
  const params = o.params || []
  const defs = {}
  for (const q of params) defs[q.key] = q.default
  return {
    id, name, category, kind: o.kind || 'vector', aspect, loop: o.loop || 2,
    params, tags: o.tags || [],
    draw(ctx, t, w, h, p) {
      ctx.save()
      stage(ctx, w, h, vw, vh)
      fn(ctx, t, { ...defs, ...(p || {}) }, vw, vh)
      ctx.restore()
    },
  }
}

// Material Icons yolları (Apache-2.0) — 24×24 görünüm kutusu
const PATHS = {
  thumb: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
}
const cache = {}
export function icon(name) {
  if (typeof Path2D === 'undefined') return null
  return cache[name] || (cache[name] = new Path2D(PATHS[name]))
}
// simgeyi (cx,cy) merkezli, s boyutunda çiz. o: { fill, stroke, sw (simge biriminde), rot, flipX, flipY }
export function drawIcon(ctx, name, cx, cy, s, o = {}) {
  const pth = icon(name)
  if (!pth) return
  ctx.save()
  ctx.translate(cx, cy)
  if (o.rot) ctx.rotate(o.rot)
  ctx.scale((s / 24) * (o.flipX ? -1 : 1), (s / 24) * (o.flipY ? -1 : 1))
  ctx.translate(-12, -12)
  if (o.stroke) { ctx.lineWidth = o.sw || 1.6; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.stroke(pth) }
  ctx.fillStyle = o.fill || '#fff'
  ctx.fill(pth)
  ctx.restore()
}
