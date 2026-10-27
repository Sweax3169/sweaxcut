// Oyun çıkartmaları — nişangah, vuruş işareti, can/zırh/XP barları, ganimet, kupa, sayaçlar…
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, tri, shadow, noShadow, lighten, darken, mix, rgba, lin, rad, rr, poly,
  starPts, text, glossy, glowDot, sparkle, rays, particles, rng, hash, INK, F_HEAVY, F_DISPLAY, F_UI, F_MONO,
} from './kit.js'
import { V, C, T, N } from './vdef.js'

// ------------------------------------------------------------ ortak parçalar
export function skull(ctx, cx, cy, s, o = {}) {
  const fill = o.fill || '#F2F2EE', ink = o.ink || INK
  ctx.beginPath()
  ctx.moveTo(cx - s, cy - 0.05 * s)
  ctx.bezierCurveTo(cx - s, cy - 1.18 * s, cx + s, cy - 1.18 * s, cx + s, cy - 0.05 * s)
  ctx.bezierCurveTo(cx + s, cy + 0.36 * s, cx + 0.64 * s, cy + 0.42 * s, cx + 0.6 * s, cy + 0.6 * s)
  ctx.lineTo(cx + 0.56 * s, cy + 0.96 * s)
  ctx.quadraticCurveTo(cx, cy + 1.12 * s, cx - 0.56 * s, cy + 0.96 * s)
  ctx.lineTo(cx - 0.6 * s, cy + 0.6 * s)
  ctx.bezierCurveTo(cx - 0.64 * s, cy + 0.42 * s, cx - s, cy + 0.36 * s, cx - s, cy - 0.05 * s)
  ctx.closePath()
  ctx.fillStyle = typeof fill === 'string' ? lin(ctx, 0, cy - s, 0, cy + s, [fill, darken(fill, 0.15)]) : fill
  ctx.fill()
  if (o.sw !== 0) { ctx.lineWidth = o.sw || s * 0.12; ctx.strokeStyle = ink; ctx.stroke() }
  ctx.fillStyle = ink
  if (o.xEyes) {
    ctx.strokeStyle = ink; ctx.lineWidth = s * 0.14
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 0.42 * s, ey = cy + 0.02 * s, r = 0.2 * s
      ctx.beginPath(); ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r); ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r); ctx.stroke()
    }
  } else {
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * 0.4 * s, cy + 0.04 * s, 0.26 * s, 0.3 * s, sx * 0.2, 0, TAU); ctx.fill() }
  }
  ctx.beginPath(); ctx.moveTo(cx, cy + 0.36 * s); ctx.lineTo(cx - 0.11 * s, cy + 0.55 * s); ctx.lineTo(cx + 0.11 * s, cy + 0.55 * s); ctx.closePath(); ctx.fill()
  ctx.lineWidth = s * 0.07; ctx.strokeStyle = ink
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 0.2 * s, cy + 0.74 * s); ctx.lineTo(cx + i * 0.2 * s, cy + 0.98 * s); ctx.stroke() }
}
export function shieldPath(ctx, cx, cy, s) {
  ctx.moveTo(cx, cy - s)
  ctx.lineTo(cx + s * 0.86, cy - s * 0.66)
  ctx.lineTo(cx + s * 0.8, cy + s * 0.08)
  ctx.quadraticCurveTo(cx + s * 0.62, cy + s * 0.74, cx, cy + s)
  ctx.quadraticCurveTo(cx - s * 0.62, cy + s * 0.74, cx - s * 0.8, cy + s * 0.08)
  ctx.lineTo(cx - s * 0.86, cy - s * 0.66)
  ctx.closePath()
}
function heartIcon(ctx, cx, cy, s, color) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + s * 0.9)
  ctx.bezierCurveTo(cx - s * 1.2, cy + s * 0.05, cx - s, cy - s * 0.9, cx, cy - s * 0.38)
  ctx.bezierCurveTo(cx + s, cy - s * 0.9, cx + s * 1.2, cy + s * 0.05, cx, cy + s * 0.9)
  ctx.fillStyle = color; ctx.fill()
}
function bolt(ctx, cx, cy, s) {
  poly(ctx, [[0.1, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.2, 1], [0.55, -0.18], [0.05, -0.18], [0.25, -1]].map(([x, y]) => [cx + x * s, cy + y * s]))
}
// parlama süpürmesi (kırpılmış bölgeye çapraz ışık bandı)
function shine(ctx, x, y, w, h, p, a = 0.45) {
  if (p <= 0 || p >= 1) return
  const sx = lerp(x - w * 0.3, x + w * 1.3, p)
  ctx.fillStyle = lin(ctx, sx - 14, 0, sx + 14, 0, ['rgba(255,255,255,0)', `rgba(255,255,255,${a})`, 'rgba(255,255,255,0)'])
  ctx.save(); ctx.transform(1, 0, -0.4, 1, 0, 0); ctx.fillRect(sx - 14 + y * 0.4, y, 28, h); ctx.restore()
}
const fmt = (n) => Math.round(n).toLocaleString('tr-TR')

// segmentli bar (can/zırh)
function statBar(ctx, t, p, W, o) {
  const val = clamp(+p.value || 0, 0, 100)
  const q = t
  const fillP = ease.out3(seg(q, 0.1, 0.9))
  const v = val * fillP
  const x0 = 56, x1 = W - 66, y0 = 34, h = 32
  const s = popIn(t, 0.35)
  ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
  // çerçeve
  shadow(ctx, 6, 0, 3)
  ctx.beginPath(); poly(ctx, [[x0 - 4, y0 - 5], [x1 + 8, y0 - 5], [x1 + 2, y0 + h + 5], [x0 - 10, y0 + h + 5]])
  ctx.fillStyle = 'rgba(10,11,15,0.88)'; ctx.fill(); noShadow(ctx)
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke()
  const col = o.color || (v > 60 ? '#3BE36B' : v > 30 ? '#FFC93C' : '#FF3B30')
  const segs = o.segs || 10, gap = 3, sw = (x1 - x0 - gap * (segs - 1)) / segs
  const low = !o.color && v <= 30 && fillP >= 1 ? 0.5 + 0.5 * Math.sin(t * 9) : 0
  for (let i = 0; i < segs; i++) {
    const sx = x0 + i * (sw + gap)
    const f = clamp(v / 100 * segs - i)
    ctx.beginPath(); poly(ctx, [[sx, y0], [sx + sw + 2, y0], [sx + sw - 2, y0 + h], [sx - 4, y0 + h]])
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()
    if (f > 0) {
      ctx.save(); ctx.clip()
      ctx.fillStyle = lin(ctx, 0, y0, 0, y0 + h, [lighten(col, 0.35), col, darken(col, 0.3)])
      ctx.fillRect(sx - 6, y0, (sw + 8) * f, h)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(sx - 6, y0, (sw + 8) * f, h * 0.3)
      ctx.restore()
    }
  }
  if (low > 0) { ctx.fillStyle = rgba('#FF3B30', 0.25 * low); ctx.fillRect(x0 - 4, y0 - 5, x1 - x0 + 12, h + 10) }
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, y0, x1 - x0 + 10, h); ctx.clip(); shine(ctx, x0, y0, x1 - x0, h, phase(t, 2.5) * 2.5 / 1.2, 0.35); ctx.restore()
  // simge
  ctx.beginPath(); ctx.arc(30, 50, 22, 0, TAU); ctx.fillStyle = lin(ctx, 0, 28, 0, 72, ['#2a2d36', '#111217']); ctx.fill()
  ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke()
  o.icon(ctx, 30, 50, col)
  text(ctx, Math.round(v), W - 32, 51, { size: 26, maxW: 52, fill: '#fff', fam: F_HEAVY, sw: 4 })
}

// ------------------------------------------------------------ tanımlar
export default [
  V('nisangah', 'Nişangah', 'oyun', {
    loop: 1.2, tags: ['crosshair', 'nişangah', 'fps', 'hedef'],
    params: [C('color', 'Renk', '#3CFF6B'), N('gap', 'Boşluk', 8, 0, 30, 1), N('length', 'Uzunluk', 16, 4, 40, 1), N('thick', 'Kalınlık', 4, 1, 10, 0.5)],
  }, (ctx, t, p) => {
    const q = phase(t, 0.4)
    const kick = Math.exp(-q * 12) * 9
    const g = +p.gap + kick, L = +p.length, th = +p.thick
    const lines = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? p.color : 'rgba(0,0,0,0.85)'; ctx.lineWidth = pass ? th : th + 2.6; ctx.lineCap = 'butt'
      ctx.beginPath()
      for (const [dx, dy] of lines) { ctx.moveTo(50 + dx * g, 50 + dy * g); ctx.lineTo(50 + dx * (g + L), 50 + dy * (g + L)) }
      ctx.stroke()
      ctx.beginPath(); ctx.arc(50, 50, pass ? th * 0.55 : th * 0.55 + 1.3, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill()
    }
    ctx.lineCap = 'round'
  }),

  V('vurus-isareti', 'Vuruş İşareti', 'oyun', {
    loop: 1.5, tags: ['hitmarker', 'vuruş', 'isabet', 'hasar'],
    params: [C('color', 'Renk', '#FFFFFF'), C('killColor', 'Öldürme rengi', '#FF3B30'), T('dmg', 'Hasar', '87')],
  }, (ctx, t, p) => {
    const q = phase(t, 0.5) * 0.5
    const n = Math.floor(phase(t, 1.5) * 3)
    const kill = n === 2
    const k = seg(q, 0, 0.32)
    const s = lerp(1.35, 1, ease.out3(seg(q, 0, 0.1)))
    const col = kill ? p.killColor : p.color
    ctx.globalAlpha = 1 - ease.in(k)
    ctx.save(); ctx.translate(50, 50); ctx.scale(s, s)
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? col : 'rgba(0,0,0,0.7)'; ctx.lineWidth = pass ? 4 : 6.5; ctx.lineCap = 'butt'
      ctx.beginPath()
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(dx * 8, dy * 8); ctx.lineTo(dx * (kill ? 22 : 18), dy * (kill ? 22 : 18)) }
      ctx.stroke()
    }
    ctx.restore(); ctx.lineCap = 'round'
    ctx.globalAlpha = 1 - k
    text(ctx, p.dmg, 74 + q * 20, 30 - q * 40, { size: kill ? 18 : 14, fill: kill ? p.killColor : '#FFE14D', sw: 4, fam: F_HEAVY })
    ctx.globalAlpha = 1
  }),

  V('kafadan-vurus', 'Kafadan Vuruş', 'oyun', {
    aspect: 1.3, loop: 2, tags: ['headshot', 'kafadan', 'kafatası', 'hs'],
    params: [T('text', 'Yazı', 'KAFADAN!'), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    const q = phase(t, 2) * 2
    const shake = q < 0.3 ? (hash(Math.floor(t * 40)) - 0.5) * 3 * (1 - q / 0.3) : 0
    ctx.translate(W / 2 + shake, 46); ctx.scale(s, s); ctx.translate(-W / 2, -46)
    rays(ctx, W / 2, 40, 48, 14, t * 0.6, p.color, 0.35)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); ctx.arc(W / 2, 40, 30, 0, TAU); ctx.fillStyle = lin(ctx, 0, 10, 0, 70, [lighten(p.color, 0.2), darken(p.color, 0.35)]); ctx.fill()
    noShadow(ctx); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    skull(ctx, W / 2, 40, 17, { fill: '#F4F2EC' })
    // nişan halkası
    const ra = 36 + Math.sin(t * 6) * 1.5
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2
    ctx.beginPath(); ctx.arc(W / 2, 40, ra, 0, TAU); ctx.stroke()
    ctx.beginPath()
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { ctx.moveTo(W / 2 + dx * (ra - 6), 40 + dy * (ra - 6)); ctx.lineTo(W / 2 + dx * (ra + 7), 40 + dy * (ra + 7)) }
    ctx.stroke()
    const bs = popIn(t, 0.3, 0.2)
    ctx.save(); ctx.translate(W / 2, 86); ctx.scale(bs, bs); ctx.rotate(-0.04)
    ctx.beginPath(); poly(ctx, [[-56, -11], [58, -11], [52, 11], [-62, 11]]); ctx.fillStyle = INK; ctx.fill()
    text(ctx, p.text, 0, 0.5, { size: 18, maxW: 104, fill: '#fff', fam: F_HEAVY })
    ctx.restore()
  }),

  V('can-bari', 'Can Barı', 'oyun', {
    aspect: 4, loop: 2.5, tags: ['can', 'health', 'hp', 'bar'],
    params: [N('value', 'Can', 75, 0, 100, 1)],
  }, (ctx, t, p, W) => statBar(ctx, t, p, W, { icon: (c, x, y, col) => heartIcon(c, x, y, 12, col) })),

  V('zirh-bari', 'Zırh Barı', 'oyun', {
    aspect: 4, loop: 2.5, tags: ['zırh', 'kalkan', 'shield', 'armor'],
    params: [N('value', 'Zırh', 100, 0, 100, 1), C('color', 'Renk', '#38A8FF')],
  }, (ctx, t, p, W) => statBar(ctx, t, p, W, {
    color: p.color, segs: 4,
    icon: (c, x, y, col) => { c.beginPath(); shieldPath(c, x, y, 12); c.fillStyle = col; c.fill() },
  })),

  V('xp-bari', 'XP Barı', 'oyun', {
    aspect: 4.4, loop: 3, tags: ['xp', 'deneyim', 'seviye', 'level'],
    params: [N('level', 'Seviye', 12, 1, 999, 1), N('value', 'Doluluk', 85, 0, 100, 1), T('gain', 'Kazanç', '+250 XP'), C('color', 'Renk', '#B45CFF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 3) * 3
    const s = popIn(t, 0.35)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    const x0 = 74, x1 = W - 16, y0 = 42, h = 18
    const v = clamp(+p.value / 100) * ease.out3(seg(q, 0.2, 1.6))
    shadow(ctx, 5, 0, 2)
    ctx.beginPath(); rr(ctx, x0, y0, x1 - x0, h, 4); ctx.fillStyle = 'rgba(12,12,18,0.85)'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke()
    ctx.save(); ctx.beginPath(); rr(ctx, x0 + 3, y0 + 3, (x1 - x0 - 6) * v, h - 6, 2); ctx.clip()
    ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [darken(p.color, 0.2), p.color, lighten(p.color, 0.45)]); ctx.fillRect(x0, y0, x1 - x0, h)
    for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + ((i * 14 + q * 40) % (x1 - x0)), y0, 6, h) }
    ctx.restore()
    glowDot(ctx, x0 + 3 + (x1 - x0 - 6) * v, y0 + h / 2, 10, lighten(p.color, 0.5), seg(q, 0.2, 0.4) * (1 - seg(q, 1.6, 2)))
    // seviye rozeti
    ctx.save(); ctx.translate(40, 50)
    shadow(ctx, 5, 0, 2)
    ctx.beginPath(); poly(ctx, starPts(0, 0, 6, 30, 30, -Math.PI / 2).filter((_, i) => i % 2 === 0))
    ctx.fillStyle = lin(ctx, 0, -30, 0, 30, [lighten(p.color, 0.3), darken(p.color, 0.35)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke()
    text(ctx, 'SV', 0, -11, { size: 9, fill: rgba('#ffffff', 0.85), fam: F_HEAVY })
    text(ctx, p.level, 0, 6, { size: 20, maxW: 40, fill: '#fff', fam: F_HEAVY })
    ctx.restore()
    if (q > 1.4) {
      const k = seg(q, 1.4, 2.8)
      ctx.globalAlpha = Math.sin(k * Math.PI)
      text(ctx, p.gain, x1 - 10, 26 - k * 10, { size: 17, fill: '#FFE14D', sw: 4, align: 'right', fam: F_HEAVY })
      ctx.globalAlpha = 1
    }
  }),

  V('seviye-atladi', 'Seviye Atladın', 'oyun', {
    aspect: 1.25, loop: 3, tags: ['level up', 'seviye', 'atladın'],
    params: [N('level', 'Seviye', 25, 1, 999, 1), T('text', 'Yazı', 'SEVİYE ATLADIN!'), C('color', 'Renk', '#FFC23D')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.45)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    const cx = W / 2
    rays(ctx, cx, 40, 60, 16, t * 0.5, p.color, 0.5)
    for (let i = 0; i < 6; i++) { const a = t * 1.5 + i; sparkle(ctx, cx + Math.cos(i * 1.1 + t) * 46, 40 + Math.sin(i * 1.7 + t) * 32, 3 + tri(a) * 3, '#fff', a) }
    const hex = starPts(cx, 40, 6, 32, 32, 0).filter((_, i) => i % 2 === 0)
    shadow(ctx, 8, 0, 4)
    ctx.beginPath(); poly(ctx, hex); ctx.fillStyle = lin(ctx, 0, 8, 0, 72, [lighten(p.color, 0.5), p.color, darken(p.color, 0.4)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 3; ctx.strokeStyle = darken(p.color, 0.6); ctx.stroke()
    ctx.beginPath(); poly(ctx, starPts(cx, 40, 6, 25, 25, 0).filter((_, i) => i % 2 === 0)); ctx.fillStyle = lin(ctx, 0, 15, 0, 65, [darken(p.color, 0.55), darken(p.color, 0.25)]); ctx.fill()
    const lv = Math.round(+p.level)
    const shown = t < 0.7 ? Math.max(0, lv - 1) : lv
    const bump = 1 + Math.exp(-Math.max(0, t - 0.7) * 8) * (t > 0.7 ? 0.35 : 0)
    ctx.save(); ctx.translate(cx, 41); ctx.scale(bump, bump)
    text(ctx, shown, 0, 0, { size: 30, maxW: 40, fill: lin(ctx, 0, -15, 0, 15, ['#ffffff', lighten(p.color, 0.6)]), fam: F_HEAVY, sw: 3 })
    ctx.restore()
    // kurdele
    const rw = W * 0.86
    ctx.save(); ctx.translate(cx, 84)
    ctx.fillStyle = darken(p.color, 0.55)
    ctx.beginPath(); poly(ctx, [[-rw / 2 - 10, -6], [-rw / 2 + 8, -6], [-rw / 2 + 8, 12], [-rw / 2 - 10, 12], [-rw / 2 - 2, 3]]); ctx.fill()
    ctx.beginPath(); poly(ctx, [[rw / 2 + 10, -6], [rw / 2 - 8, -6], [rw / 2 - 8, 12], [rw / 2 + 10, 12], [rw / 2 + 2, 3]]); ctx.fill()
    shadow(ctx, 4, 0, 2)
    ctx.beginPath(); rr(ctx, -rw / 2 + 2, -11, rw - 4, 22, 3); ctx.fillStyle = lin(ctx, 0, -11, 0, 11, [lighten(p.color, 0.2), darken(p.color, 0.15)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2; ctx.strokeStyle = darken(p.color, 0.6); ctx.stroke()
    text(ctx, p.text, 0, 0.5, { size: 15, maxW: rw - 18, fill: '#fff', fam: F_HEAVY, sw: 3, stroke: darken(p.color, 0.65) })
    ctx.restore()
  }),

  V('ganimet-kutusu', 'Ganimet Sandığı', 'oyun', {
    aspect: 1.1, loop: 3, tags: ['loot', 'sandık', 'ganimet', 'kasa'],
    params: [C('color', 'Nadirlik ışığı', '#FFB020'), C('wood', 'Sandık', '#7A4A23')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 3) * 3
    const cx = W / 2
    const opened = q > 1, op = ease.outBack(seg(q, 1, 1.35))
    const shake = q < 1 ? Math.sin(q * 50) * seg(q, 0.2, 1) * 2.5 : 0
    const fade = 1 - seg(q, 2.75, 3)
    if (opened) {
      ctx.globalAlpha = fade
      rays(ctx, cx, 52, 60 * op, 14, t * 0.8, p.color, 0.7)
      glowDot(ctx, cx, 52, 40 * op, p.color, 0.9)
      particles(ctx, cx, 50, 18, seg(q, 1, 2.3), 44, 3, ['#fff', p.color, lighten(p.color, 0.5)], 3)
      ctx.globalAlpha = 1
    }
    ctx.translate(cx + shake, 0)
    const wd = p.wood, metal = '#E8C15A'
    // gövde
    shadow(ctx, 7, 0, 4)
    ctx.beginPath(); rr(ctx, -34, 50, 68, 36, 4); ctx.fillStyle = lin(ctx, 0, 50, 0, 86, [lighten(wd, 0.15), darken(wd, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 1.2
    for (const y of [62, 74]) { ctx.beginPath(); ctx.moveTo(-32, y); ctx.lineTo(32, y); ctx.stroke() }
    ctx.fillStyle = lin(ctx, 0, 50, 0, 86, [lighten(metal, 0.3), darken(metal, 0.25)])
    for (const x of [-30, 22]) { ctx.fillRect(x, 50, 8, 36); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x, 50, 8, 36) }
    if (opened) { ctx.fillStyle = rgba(lighten(p.color, 0.4), 0.9 * fade); ctx.fillRect(-32, 48, 64, 5) }
    // kapak
    ctx.save()
    if (opened) { ctx.translate(0, 46); ctx.rotate(-0.5 * op); ctx.translate(-14 * op, -22 * op); ctx.translate(0, -46) }
    ctx.beginPath(); ctx.moveTo(-36, 50); ctx.lineTo(-36, 38); ctx.quadraticCurveTo(-36, 22, 0, 22); ctx.quadraticCurveTo(36, 22, 36, 38); ctx.lineTo(36, 50); ctx.closePath()
    ctx.fillStyle = lin(ctx, 0, 22, 0, 50, [lighten(wd, 0.25), darken(wd, 0.15)]); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.fillStyle = lin(ctx, 0, 22, 0, 50, [lighten(metal, 0.35), darken(metal, 0.2)])
    for (const x of [-30, 22]) { ctx.beginPath(); ctx.rect(x, 26 + (x < 0 ? 2 : 2), 8, 24); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke() }
    ctx.beginPath(); rr(ctx, -7, 42, 14, 14, 3); ctx.fillStyle = metal; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 48, 2.2, 0, TAU); ctx.fillStyle = INK; ctx.fill()
    ctx.restore()
  }),

  V('para-donen', 'Dönen Para', 'oyun', {
    loop: 1.6, tags: ['para', 'coin', 'altın', 'jeton'],
    params: [T('symbol', 'Simge', '₺'), C('color', 'Renk', '#FFC93C')],
  }, (ctx, t, p) => {
    const a = phase(t, 1.6) * TAU
    const sx = Math.cos(a), edge = Math.sin(a)
    const y = 50 + Math.sin(a * 2) * 2
    const c = p.color
    shadow(ctx, 6, 0, 4)
    ctx.beginPath(); ctx.ellipse(50 + edge * 3.5, y, Math.abs(sx) * 34 + 3.5 * Math.abs(edge), 34, 0, 0, TAU); ctx.fillStyle = darken(c, 0.45); ctx.fill()
    noShadow(ctx)
    ctx.save(); ctx.translate(50 - edge * 1.5, y); ctx.scale(Math.max(0.04, Math.abs(sx)), 1)
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fillStyle = rad(ctx, -10, -12, 2, 44, [lighten(c, 0.55), c, darken(c, 0.25)]); ctx.fill()
    ctx.lineWidth = 2.2; ctx.strokeStyle = darken(c, 0.55); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = darken(c, 0.3); ctx.stroke()
    text(ctx, p.symbol, 0, 1, { size: 34, maxW: 40, fill: lin(ctx, 0, -16, 0, 16, [darken(c, 0.15), darken(c, 0.45)]), fam: F_HEAVY })
    ctx.restore()
    if (sx > 0.9) sparkle(ctx, 66, 30, 6 * (sx - 0.9) * 10, '#fff', t * 4)
  }),

  V('kupa', 'Kupa', 'oyun', {
    loop: 2.4, tags: ['kupa', 'ödül', 'trophy', 'şampiyon'],
    params: [C('color', 'Renk', '#FFC23D'), T('text', 'Yazı', '1')],
  }, (ctx, t, p) => {
    const s = popIn(t, 0.4)
    const q = phase(t, 2.4)
    ctx.translate(50, 54); ctx.scale(s, s); ctx.translate(-50, -54)
    rays(ctx, 50, 40, 52, 12, t * 0.4, p.color, 0.3)
    const c = p.color
    const gold = lin(ctx, 26, 0, 74, 0, [darken(c, 0.25), lighten(c, 0.45), c, darken(c, 0.35)])
    const path = () => {
      ctx.moveTo(28, 16); ctx.lineTo(72, 16); ctx.lineTo(71, 30)
      ctx.bezierCurveTo(70, 50, 60, 58, 54, 60); ctx.lineTo(54, 68); ctx.lineTo(46, 68); ctx.lineTo(46, 60)
      ctx.bezierCurveTo(40, 58, 30, 50, 29, 30); ctx.closePath()
    }
    ctx.lineWidth = 5; ctx.strokeStyle = darken(c, 0.5)
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(50 + sx * 23, 30, 11, sx > 0 ? -1.4 : Math.PI - 1.8, sx > 0 ? 1.8 : Math.PI + 1.4); ctx.stroke() }
    ctx.lineWidth = 3; ctx.strokeStyle = lighten(c, 0.2)
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(50 + sx * 23, 30, 11, sx > 0 ? -1.4 : Math.PI - 1.8, sx > 0 ? 1.8 : Math.PI + 1.4); ctx.stroke() }
    shadow(ctx, 7, 0, 3)
    ctx.beginPath(); path(); ctx.fillStyle = gold; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.4; ctx.strokeStyle = darken(c, 0.55); ctx.stroke()
    ctx.save(); ctx.beginPath(); path(); ctx.clip(); shine(ctx, 26, 14, 48, 56, seg(q, 0.1, 0.5), 0.7); ctx.restore()
    ctx.beginPath(); rr(ctx, 36, 68, 28, 8, 2); ctx.fillStyle = gold; ctx.fill(); ctx.stroke()
    ctx.beginPath(); rr(ctx, 30, 76, 40, 11, 2.5); ctx.fillStyle = lin(ctx, 0, 76, 0, 87, ['#3a2a1a', '#1c140c']); ctx.fill(); ctx.stroke()
    ctx.beginPath(); rr(ctx, 40, 79, 20, 5, 1); ctx.fillStyle = lighten(c, 0.2); ctx.fill()
    text(ctx, p.text, 50, 35, { size: 20, maxW: 28, fill: darken(c, 0.5), fam: F_HEAVY })
    const k = tri(t * 1.3)
    sparkle(ctx, 76, 16, 3 + k * 4, '#fff', t * 2)
    sparkle(ctx, 24, 48, 2 + (1 - k) * 3, '#fff', -t * 2)
  }),

  V('tac', 'Taç', 'oyun', {
    aspect: 1.3, loop: 2.4, tags: ['taç', 'kral', 'crown', 'birinci'],
    params: [C('color', 'Renk', '#FFC23D')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.4)
    ctx.translate(W / 2, 55 + Math.sin(t * 2.6) * 2); ctx.scale(s, s); ctx.rotate(Math.sin(t * 2.6 + 1) * 0.04); ctx.translate(-W / 2, -55)
    const c = p.color, cx = W / 2
    const pts = [[cx - 44, 74], [cx - 48, 28], [cx - 26, 48], [cx - 12, 18], [cx, 42], [cx + 12, 18], [cx + 26, 48], [cx + 48, 28], [cx + 44, 74]]
    shadow(ctx, 7, 0, 4)
    ctx.beginPath(); poly(ctx, pts); ctx.fillStyle = lin(ctx, cx - 45, 0, cx + 45, 0, [darken(c, 0.2), lighten(c, 0.45), c, darken(c, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.6; ctx.strokeStyle = darken(c, 0.55); ctx.stroke()
    ctx.beginPath(); rr(ctx, cx - 46, 70, 92, 14, 3); ctx.fillStyle = lin(ctx, 0, 70, 0, 84, [lighten(c, 0.2), darken(c, 0.3)]); ctx.fill(); ctx.stroke()
    const gems = [['#FF3B5C', cx, 77, 5], ['#38A8FF', cx - 26, 77, 4], ['#3BE36B', cx + 26, 77, 4]]
    for (const [col, x, y, r] of gems) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rad(ctx, x - 1.5, y - 1.5, 0.5, r, [lighten(col, 0.6), col, darken(col, 0.3)]); ctx.fill()
      ctx.lineWidth = 1.2; ctx.strokeStyle = darken(c, 0.55); ctx.stroke()
    }
    for (const [x, y] of [[cx - 48, 28], [cx - 12, 18], [cx + 12, 18], [cx + 48, 28]]) {
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fillStyle = lighten(c, 0.3); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke()
    }
    sparkle(ctx, cx + 30, 40, 3 + tri(t * 1.2) * 5, '#fff', t * 2)
  }),

  V('oldurme-sayaci', 'Öldürme Sayacı', 'oyun', {
    aspect: 2.2, loop: 2, tags: ['kill', 'leş', 'öldürme', 'sayaç'],
    params: [N('value', 'Sayı', 5, 0, 999, 1), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    const q = phase(t, 2) * 2
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); poly(ctx, [[24, 22], [W - 8, 22], [W - 22, 78], [10, 78]]); ctx.fillStyle = lin(ctx, 0, 22, 0, 78, ['#22242c', '#0e0f13']); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke()
    ctx.beginPath(); poly(ctx, [[24, 22], [38, 22], [24, 78], [10, 78]]); ctx.fillStyle = p.color; ctx.fill()
    skull(ctx, 70, 48, 17, { fill: '#F4F2EC' })
    const bump = 1 + Math.exp(-q * 7) * 0.4
    ctx.save(); ctx.translate(150, 51); ctx.scale(bump, bump)
    text(ctx, '×' + Math.round(+p.value), 0, 0, { size: 44, maxW: 110, fill: lin(ctx, 0, -20, 0, 20, ['#ffffff', '#d0d3dc']), fam: F_HEAVY, sw: 0 })
    ctx.restore()
    if (q < 0.4) { ctx.fillStyle = rgba(p.color, 0.35 * (1 - q / 0.4)); ctx.beginPath(); poly(ctx, [[24, 22], [W - 8, 22], [W - 22, 78], [10, 78]]); ctx.fill() }
  }),

  V('kd-karti', 'K/D Kartı', 'oyun', {
    aspect: 1.7, loop: 4, tags: ['kd', 'skor', 'istatistik', 'maç sonu'],
    params: [T('title', 'Başlık', 'MAÇ SONU'), N('kills', 'Öldürme', 18, 0, 999, 1), N('deaths', 'Ölüm', 6, 0, 999, 1), N('assists', 'Asist', 4, 0, 999, 1), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.4)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    shadow(ctx, 8, 0, 4)
    ctx.beginPath(); rr(ctx, 8, 8, W - 16, 84, 4); ctx.fillStyle = lin(ctx, 0, 8, 0, 92, ['#1e2027', '#0c0d11']); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke()
    ctx.fillStyle = p.color; ctx.fillRect(8, 8, W - 16, 18)
    text(ctx, p.title, W / 2, 17.5, { size: 12, maxW: W - 40, fill: INK, fam: F_HEAVY })
    const cols = [['ÖLDÜRME', p.kills], ['ÖLÜM', p.deaths], ['ASİST', p.assists]]
    cols.forEach(([lab, v], i) => {
      const x = 8 + (W - 16) * (i + 0.5) / 3
      const k = ease.out3(seg(t, 0.3 + i * 0.15, 1.1 + i * 0.15))
      text(ctx, Math.round((+v || 0) * k), x, 45, { size: 24, maxW: 44, fill: '#fff', fam: F_HEAVY })
      text(ctx, lab, x, 61, { size: 8, maxW: 46, fill: '#8d93a3', fam: F_HEAVY })
    })
    const kd = (+p.kills || 0) / Math.max(1, +p.deaths || 0)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(16, 70, W - 32, 15)
    ctx.globalAlpha = seg(t, 1.2, 1.5)
    text(ctx, 'K/D  ' + kd.toFixed(2).replace('.', ','), W / 2, 78, { size: 12, fill: p.color, fam: F_HEAVY })
    ctx.globalAlpha = 1
  }),

  V('zafer-bandi', 'Zafer Bandı', 'oyun', {
    aspect: 3, loop: 3, tags: ['zafer', 'victory', 'kazandın', 'birinci'],
    params: [T('text', 'Yazı', 'ZAFER!'), C('color', 'Renk', '#FFC23D')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.45)
    const q = phase(t, 3)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    const c = p.color, cx = W / 2
    rays(ctx, cx, 50, 140, 22, t * 0.3, c, 0.35)
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 26, y = 13 - (i === 1 ? 4 : 0), r = i === 1 ? 9 : 6.5
      ctx.beginPath(); poly(ctx, starPts(x, y, 5, r, r * 0.45)); ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, [lighten(c, 0.5), c]); ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = darken(c, 0.55); ctx.stroke()
    }
    // kurdele uçları
    ctx.fillStyle = darken(c, 0.5)
    ctx.beginPath(); poly(ctx, [[20, 42], [58, 42], [58, 84], [20, 84], [32, 63]]); ctx.fill()
    ctx.beginPath(); poly(ctx, [[W - 20, 42], [W - 58, 42], [W - 58, 84], [W - 20, 84], [W - 32, 63]]); ctx.fill()
    ctx.fillStyle = darken(c, 0.7)
    ctx.beginPath(); poly(ctx, [[48, 76], [58, 84], [58, 76]]); ctx.fill()
    ctx.beginPath(); poly(ctx, [[W - 48, 76], [W - 58, 84], [W - 58, 76]]); ctx.fill()
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); rr(ctx, 46, 28, W - 92, 48, 3)
    ctx.fillStyle = lin(ctx, 0, 28, 0, 76, [lighten(c, 0.35), c, darken(c, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(c, 0.6); ctx.stroke()
    ctx.save(); ctx.beginPath(); rr(ctx, 46, 28, W - 92, 48, 3); ctx.clip(); shine(ctx, 46, 28, W - 92, 48, seg(q, 0.15, 0.55), 0.6); ctx.restore()
    text(ctx, p.text, cx, 53, { size: 38, maxW: W - 120, fill: '#fff', fam: F_HEAVY, sw: 5, stroke: darken(c, 0.65), extrude: 2.5, extrudeColor: darken(c, 0.7) })
  }),

  V('oyun-bitti', 'Oyun Bitti', 'oyun', {
    aspect: 3, loop: 1.6, tags: ['game over', 'oyun bitti', 'kaybettin', 'yenilgi'],
    params: [T('text', 'Yazı', 'OYUN BİTTİ'), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const s = lerp(1.4, 1, ease.out3(seg(t, 0, 0.3)))
    ctx.globalAlpha = seg(t, 0, 0.2)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    const g = phase(t, 1.6) > 0.85
    const R = rng(Math.floor(t * 30))
    ctx.fillStyle = 'rgba(8,8,10,0.86)'; ctx.fillRect(0, 24, W, 52)
    ctx.fillStyle = p.color; ctx.fillRect(0, 24, W, 2.5); ctx.fillRect(0, 73.5, W, 2.5)
    const off = g ? (R() - 0.5) * 8 : 0
    ctx.globalCompositeOperation = 'lighter'
    text(ctx, p.text, W / 2 - 2 - off, 51, { size: 40, maxW: W - 40, fill: '#00E5FF', fam: F_HEAVY })
    text(ctx, p.text, W / 2 + 2 + off, 51, { size: 40, maxW: W - 40, fill: p.color, fam: F_HEAVY })
    ctx.globalCompositeOperation = 'source-over'
    text(ctx, p.text, W / 2, 51, { size: 40, maxW: W - 40, fill: '#fff', fam: F_HEAVY })
    if (g) for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(i % 2 ? '#00E5FF' : p.color, 0.6); ctx.fillRect(R() * W, 26 + R() * 46, 20 + R() * 60, 2 + R() * 3) }
    ctx.globalAlpha = 1
  }),

  V('oyun-kolu', 'Oyun Kolu', 'oyun', {
    aspect: 1.5, loop: 2, tags: ['kontrolcü', 'gamepad', 'oyun kolu', 'joystick'],
    params: [C('color', 'Gövde', '#2B2E37'), C('accent', 'Vurgu', '#E4FF3A')],
  }, (ctx, t, p) => {
    const s = popIn(t, 0.4)
    ctx.translate(75, 55 + Math.sin(t * 3) * 1.5); ctx.scale(s, s); ctx.rotate(Math.sin(t * 3) * 0.03); ctx.translate(-75, -55)
    const body = () => {
      ctx.moveTo(48, 26); ctx.lineTo(102, 26)
      ctx.bezierCurveTo(126, 26, 138, 44, 142, 68); ctx.bezierCurveTo(145, 88, 128, 96, 116, 84)
      ctx.lineTo(102, 70); ctx.lineTo(48, 70); ctx.lineTo(34, 84)
      ctx.bezierCurveTo(22, 96, 5, 88, 8, 68); ctx.bezierCurveTo(12, 44, 24, 26, 48, 26); ctx.closePath()
    }
    shadow(ctx, 8, 0, 4)
    ctx.beginPath(); body(); ctx.fillStyle = lin(ctx, 0, 26, 0, 92, [lighten(p.color, 0.25), p.color, darken(p.color, 0.4)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(50, 30); ctx.lineTo(100, 30); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke()
    // yön tuşu
    const dp = Math.floor(t * 4) % 4
    ctx.fillStyle = '#15161b'
    ctx.beginPath(); rr(ctx, 30, 41, 8, 22, 2); ctx.fill(); ctx.beginPath(); rr(ctx, 23, 48, 22, 8, 2); ctx.fill()
    ctx.fillStyle = rgba(p.accent, 0.9)
    const dpos = [[30, 41, 8, 7], [38, 48, 7, 8], [30, 56, 8, 7], [23, 48, 7, 8]][dp]
    ctx.fillRect(...dpos)
    // ABXY
    const btn = [[118, 38, '#3BE36B'], [128, 48, '#FF3B5C'], [108, 48, '#38A8FF'], [118, 58, '#FFC93C']]
    const act = Math.floor(t * 3) % 4
    btn.forEach(([x, y, col], i) => {
      const on = i === act
      if (on) glowDot(ctx, x, y, 11, col, 0.8)
      ctx.beginPath(); ctx.arc(x, y + (on ? 1 : 0), 5.5, 0, TAU); ctx.fillStyle = on ? lighten(col, 0.3) : darken(col, 0.35); ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke()
    })
    // çubuklar
    for (const [x, ph] of [[58, 0], [92, 1.7]]) {
      ctx.beginPath(); ctx.arc(x, 62, 10, 0, TAU); ctx.fillStyle = '#121317'; ctx.fill()
      const a = t * 3 + ph
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, 62 + Math.sin(a) * 3, 7.5, 0, TAU)
      ctx.fillStyle = rad(ctx, x - 2, 60, 1, 9, ['#4a4e5a', '#24262d']); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(75, 40, 3.5, 0, TAU); ctx.fillStyle = p.accent; ctx.fill()
  }),

  V('klavye-tusu', 'Klavye Tuşu', 'oyun', {
    loop: 1, tags: ['klavye', 'tuş', 'bas', 'key'],
    params: [T('key', 'Tuş', 'E'), C('color', 'Tuş rengi', '#2A2D35'), C('glow', 'Işık', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 1)
    const press = q > 0.1 && q < 0.35 ? Math.sin(seg(q, 0.1, 0.35) * Math.PI) : 0
    const d = press * 5
    const label = String(p.key || '')
    const wide = label.length > 2
    const x0 = wide ? 10 : 18, w = wide ? 80 : 64
    if (press > 0) glowDot(ctx, 50, 56, 50, p.glow, press * 0.7)
    shadow(ctx, 8 - press * 5, 0, 5 - press * 3)
    ctx.beginPath(); rr(ctx, x0, 24, w, 64, 10); ctx.fillStyle = darken(p.color, 0.45); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke()
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(p.glow, 0.25 + press * 0.75); ctx.beginPath(); rr(ctx, x0 + 1, 25, w - 2, 62, 9.5); ctx.stroke()
    ctx.beginPath(); rr(ctx, x0 + 6, 20 + d, w - 12, 54, 8)
    ctx.fillStyle = lin(ctx, 0, 20 + d, 0, 74 + d, [lighten(p.color, 0.22), p.color]); ctx.fill()
    ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke()
    text(ctx, label, 50, 47 + d, { size: wide ? 18 : 30, maxW: w - 22, fill: press > 0.3 ? p.glow : '#f2f3f6', fam: F_HEAVY })
  }),

  V('fare-tiklama', 'Fare Tıklaması', 'oyun', {
    loop: 0.9, tags: ['fare', 'tıkla', 'mouse', 'click'],
    params: [C('color', 'Gövde', '#2A2D35'), C('accent', 'Tık rengi', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 0.9)
    const click = q < 0.25 ? 1 - q / 0.25 : 0
    ctx.translate(4, 4)
    // dalgalar
    for (let i = 0; i < 3; i++) {
      const k = seg(q, i * 0.05, 0.5 + i * 0.05)
      if (k > 0 && k < 1) {
        ctx.strokeStyle = rgba(p.accent, 1 - k); ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(36, 30, 14 + k * 18 + i * 4, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke()
      }
    }
    shadow(ctx, 7, 0, 4)
    ctx.beginPath(); rr(ctx, 34, 22, 40, 64, 20); ctx.fillStyle = lin(ctx, 0, 22, 0, 86, [lighten(p.color, 0.25), darken(p.color, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke()
    ctx.save(); ctx.beginPath(); rr(ctx, 34, 22, 40, 64, 20); ctx.clip()
    ctx.fillStyle = click > 0 ? rgba(p.accent, 0.5 + click * 0.5) : 'rgba(255,255,255,0.06)'; ctx.fillRect(34, 22 + click * 1.5, 20, 26)
    ctx.restore()
    ctx.strokeStyle = INK; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(54, 22); ctx.lineTo(54, 48); ctx.moveTo(34, 48); ctx.lineTo(74, 48); ctx.stroke()
    ctx.beginPath(); rr(ctx, 51, 29, 6, 11, 3); ctx.fillStyle = '#16171c'; ctx.fill()
  }),

  V('yukleniyor', 'Yükleniyor', 'oyun', {
    loop: 1, tags: ['yükleniyor', 'loading', 'bekle', 'spinner'],
    params: [T('text', 'Yazı', 'YÜKLENİYOR'), C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p) => {
    const n = 12, step = Math.floor(phase(t, 1) * n)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2
      const k = ((step - i + n) % n) / n
      ctx.strokeStyle = rgba(p.color, 1 - k * 0.85); ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(50 + Math.cos(a) * 16, 40 + Math.sin(a) * 16); ctx.lineTo(50 + Math.cos(a) * 28, 40 + Math.sin(a) * 28); ctx.stroke()
    }
    const dots = '.'.repeat(Math.floor(t * 3) % 4)
    const sz = text(ctx, p.text, 47, 86, { size: 13, maxW: 80, fill: p.color, sw: 3.5, stroke: 'rgba(0,0,0,0.6)' })
    ctx.font = `900 ${sz}px ${F_HEAVY}`
    const w = ctx.measureText(p.text).width
    text(ctx, dots, 47 + w / 2 + 1, 86, { size: sz, fill: p.color, align: 'left', sw: 3.5, stroke: 'rgba(0,0,0,0.6)' })
  }),

  V('dusuk-pil', 'Düşük Pil', 'oyun', {
    aspect: 1.6, loop: 1.2, tags: ['pil', 'şarj', 'batarya', 'düşük'],
    params: [N('value', 'Doluluk %', 5, 0, 100, 1)],
  }, (ctx, t, p, W) => {
    const v = clamp(+p.value / 100)
    const col = v > 0.5 ? '#3BE36B' : v > 0.2 ? '#FFC93C' : '#FF3B30'
    const blink = v <= 0.2 ? (phase(t, 1.2) < 0.5 ? 1 : 0.25) : 1
    const x = 18, y = 26, w = 110, h = 48
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); rr(ctx, x, y, w, h, 9); ctx.fillStyle = 'rgba(12,12,16,0.85)'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#f1f2f5'; ctx.stroke()
    ctx.beginPath(); rr(ctx, x + w + 3, y + 14, 9, 20, 3); ctx.fillStyle = '#f1f2f5'; ctx.fill()
    ctx.globalAlpha = blink
    ctx.beginPath(); rr(ctx, x + 7, y + 7, Math.max(6, (w - 14) * v), h - 14, 4); ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [lighten(col, 0.3), col]); ctx.fill()
    ctx.globalAlpha = 1
    text(ctx, '%' + Math.round(v * 100), x + w / 2 + 8, y + h / 2 + 1, { size: 20, fill: '#fff', sw: 4, fam: F_HEAVY })
  }),

  V('ping-olcer', 'Ping / Lag', 'oyun', {
    aspect: 2.4, loop: 1, tags: ['ping', 'lag', 'gecikme', 'internet', 'ms'],
    params: [N('value', 'Ping (ms)', 240, 1, 999, 1)],
  }, (ctx, t, p, W) => {
    const ms = Math.round(+p.value)
    const lag = ms >= 150
    const jitter = lag ? Math.round((hash(Math.floor(t * 6)) - 0.5) * ms * 0.25) : Math.round((hash(Math.floor(t * 3)) - 0.5) * 4)
    const shown = Math.max(1, ms + jitter)
    const col = ms < 60 ? '#3BE36B' : ms < 120 ? '#FFC93C' : '#FF3B30'
    const bars = ms < 60 ? 4 : ms < 120 ? 3 : ms < 200 ? 2 : 1
    const flick = lag && hash(Math.floor(t * 8)) > 0.6
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); rr(ctx, 8, 20, W - 16, 60, 6); ctx.fillStyle = 'rgba(12,12,16,0.85)'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(col, 0.6); ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const bh = 10 + i * 9, on = i < bars - (flick ? 1 : 0)
      ctx.beginPath(); rr(ctx, 24 + i * 13, 68 - bh, 9, bh, 2)
      ctx.fillStyle = on ? col : 'rgba(255,255,255,0.15)'; ctx.fill()
    }
    text(ctx, shown, 150, 47, { size: 30, maxW: 70, fill: col, fam: F_HEAVY, align: 'right' })
    text(ctx, 'ms', 154, 52, { size: 15, fill: rgba('#ffffff', 0.7), fam: F_HEAVY, align: 'left' })
    text(ctx, lag ? 'LAG!' : 'PING', 176, 70, { size: 10, fill: lag ? col : '#8d93a3', fam: F_HEAVY, align: 'center' })
  }),

  V('geri-sayim', 'Geri Sayım', 'oyun', {
    loop: 10, tags: ['geri sayım', 'zamanlayıcı', 'timer', 'süre'],
    params: [N('value', 'Saniye', 10, 1, 99, 1), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p) => {
    const total = Math.max(1, Math.round(+p.value))
    const left = Math.max(0, total - t)
    const n = Math.ceil(left - 1e-6)
    const fr = left - Math.floor(left)
    const end = left <= 0
    const col = n <= 3 ? '#FF3B30' : p.color
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); ctx.arc(50, 50, 40, 0, TAU); ctx.fillStyle = 'rgba(12,12,16,0.88)'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(50, 50, 33, 0, TAU); ctx.stroke()
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(50, 50, 33, -Math.PI / 2, -Math.PI / 2 + TAU * (left / total)); ctx.stroke()
    const bump = end ? (phase(t, 0.5) < 0.5 ? 1 : 0.85) : 1 + ease.in(fr) * 0.25
    ctx.save(); ctx.translate(50, 51); ctx.scale(bump, bump)
    text(ctx, n, 0, 0, { size: 34, maxW: 50, fill: col, fam: F_HEAVY })
    ctx.restore()
  }),

  V('mermi-sayaci', 'Mermi Sayacı', 'oyun', {
    aspect: 2.4, loop: 3, tags: ['mermi', 'ammo', 'şarjör', 'silah'],
    params: [N('mag', 'Şarjör', 30, 1, 200, 1), N('reserve', 'Yedek', 90, 0, 999, 1), C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 3) * 3
    const mag = Math.round(+p.mag)
    const shots = Math.min(mag, Math.floor(seg(q, 0.2, 2.2) * mag))
    const reloading = q > 2.3
    const cur = reloading ? mag : mag - shots
    const low = cur <= mag * 0.25
    const col = low ? '#FF3B30' : p.color
    ctx.fillStyle = lin(ctx, 0, 0, W, 0, ['rgba(10,10,14,0)', 'rgba(10,10,14,0.8)']); ctx.fillRect(0, 22, W, 56)
    const kick = q < 2.2 && q > 0.2 ? Math.exp(-((q * mag / 2) % 1) * 8) * 2 : 0
    text(ctx, cur, 150, 50 + kick, { size: 42, maxW: 80, fill: col, fam: F_HEAVY, align: 'right', sw: 4, stroke: 'rgba(0,0,0,0.6)' })
    text(ctx, '/ ' + Math.round(+p.reserve), 156, 56, { size: 20, fill: rgba('#ffffff', 0.7), fam: F_HEAVY, align: 'left', sw: 3, stroke: 'rgba(0,0,0,0.6)' })
    const nb = Math.min(10, mag), filled = Math.ceil(cur / mag * nb)
    for (let i = 0; i < nb; i++) {
      const x = 150 - i * 9 - 8
      ctx.globalAlpha = i < filled ? 1 : 0.2
      ctx.beginPath(); rr(ctx, x, 70, 5, 14, 2.5); ctx.fillStyle = '#E8C15A'; ctx.fill()
      ctx.fillStyle = '#B8862F'; ctx.fillRect(x, 80, 5, 4)
    }
    ctx.globalAlpha = 1
    if (reloading) text(ctx, 'ŞARJÖR DEĞİŞİYOR', 120, 20, { size: 11, fill: '#FFC93C', fam: F_HEAVY, sw: 3 })
  }),

  V('radar', 'Radar', 'oyun', {
    loop: 2.4, tags: ['radar', 'harita', 'tarama', 'minimap'],
    params: [C('color', 'Renk', '#3CFF6B')],
  }, (ctx, t, p) => {
    const a = phase(t, 2.4) * TAU - Math.PI / 2
    ctx.beginPath(); ctx.arc(50, 50, 42, 0, TAU); ctx.fillStyle = 'rgba(4,14,8,0.88)'; ctx.fill()
    ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(p.color, 0.9); ctx.stroke()
    ctx.strokeStyle = rgba(p.color, 0.3); ctx.lineWidth = 1
    for (const r of [14, 28]) { ctx.beginPath(); ctx.arc(50, 50, r, 0, TAU); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(8, 50); ctx.lineTo(92, 50); ctx.moveTo(50, 8); ctx.lineTo(50, 92); ctx.stroke()
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(a - 1.2, 50, 50)
      g.addColorStop(0, rgba(p.color, 0)); g.addColorStop(1.2 / TAU, rgba(p.color, 0.55)); g.addColorStop(1.2 / TAU + 0.001, rgba(p.color, 0)); g.addColorStop(1, rgba(p.color, 0))
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(50, 50, 42, 0, TAU); ctx.fill()
    }
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(50, 50); ctx.lineTo(50 + Math.cos(a) * 42, 50 + Math.sin(a) * 42); ctx.stroke()
    for (const [ba, br, col] of [[0.7, 30, '#FF3B30'], [2.6, 18, '#FF3B30'], [4.4, 34, '#FFC93C']]) {
      let d = (a + Math.PI / 2) - ba; d = ((d % TAU) + TAU) % TAU
      const k = clamp(1 - d / 3)
      if (k > 0) { glowDot(ctx, 50 + Math.cos(ba - Math.PI / 2) * br, 50 + Math.sin(ba - Math.PI / 2) * br, 7, col, k); ctx.beginPath(); ctx.arc(50 + Math.cos(ba - Math.PI / 2) * br, 50 + Math.sin(ba - Math.PI / 2) * br, 2.5, 0, TAU); ctx.fillStyle = rgba(col, k); ctx.fill() }
    }
  }),

  V('ulti-hazir', 'Ulti Hazır', 'oyun', {
    loop: 3, tags: ['ulti', 'yetenek', 'hazır', 'ultimate'],
    params: [T('text', 'Yazı', 'ULTİ HAZIR'), C('color', 'Renk', '#00E5FF')],
  }, (ctx, t, p) => {
    const q = phase(t, 3) * 3
    const v = ease.inOut(seg(q, 0, 1.4))
    const ready = v >= 1
    const pulse = ready ? 0.5 + 0.5 * Math.sin((q - 1.4) * 9) : 0
    if (ready) glowDot(ctx, 50, 42, 44, p.color, 0.5 + pulse * 0.4)
    ctx.beginPath(); ctx.arc(50, 42, 30, 0, TAU); ctx.fillStyle = 'rgba(10,12,18,0.9)'; ctx.fill()
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(50, 42, 30, 0, TAU); ctx.stroke()
    ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(50, 42, 30, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.stroke()
    ctx.save(); ctx.translate(50, 42); ctx.rotate(t * 1.5)
    ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(p.color, 0.6); ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke(); ctx.setLineDash([])
    ctx.restore()
    ctx.beginPath(); bolt(ctx, 50, 42, 18); ctx.fillStyle = ready ? '#fff' : rgba(p.color, 0.35 + v * 0.4); ctx.fill()
    if (ready) { ctx.globalAlpha = seg(q, 1.4, 1.6); text(ctx, p.text, 50, 88, { size: 15, maxW: 94, fill: p.color, fam: F_HEAVY, sw: 4 }); ctx.globalAlpha = 1 }
    else text(ctx, '%' + Math.round(v * 100), 50, 88, { size: 14, fill: '#cfd3dc', fam: F_HEAVY, sw: 4 })
  }),

  V('tehlike', 'Tehlike', 'oyun', {
    loop: 0.8, tags: ['tehlike', 'uyarı', 'dikkat', 'warning'],
    params: [T('text', 'Yazı', 'TEHLİKE'), C('color', 'Renk', '#FFC93C')],
  }, (ctx, t, p) => {
    const on = phase(t, 0.8) < 0.55
    const s = popIn(t, 0.35)
    ctx.translate(50, 50); ctx.scale(s, s); ctx.translate(-50, -50)
    if (on) glowDot(ctx, 50, 42, 46, '#FF3B30', 0.5)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); ctx.moveTo(50, 8); ctx.lineTo(88, 72); ctx.lineTo(12, 72); ctx.closePath()
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); noShadow(ctx)
    ctx.fillStyle = lin(ctx, 0, 8, 0, 72, [lighten(p.color, 0.3), on ? p.color : darken(p.color, 0.25)]); ctx.fill()
    ctx.beginPath(); rr(ctx, 46, 28, 8, 26, 4); ctx.fillStyle = INK; ctx.fill()
    ctx.beginPath(); ctx.arc(50, 62, 4.5, 0, TAU); ctx.fill()
    ctx.save(); ctx.beginPath(); ctx.rect(8, 78, 84, 16); ctx.clip()
    ctx.fillStyle = p.color; ctx.fillRect(8, 78, 84, 16)
    ctx.fillStyle = INK
    for (let i = -2; i < 12; i++) { const x = 8 + i * 12 + phase(t, 0.8) * 12; ctx.beginPath(); poly(ctx, [[x, 78], [x + 6, 78], [x - 2, 94], [x - 8, 94]]); ctx.fill() }
    ctx.restore()
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(8, 78, 84, 16)
    text(ctx, p.text, 50, 86.5, { size: 11, maxW: 60, fill: '#fff', sw: 3.5, fam: F_HEAVY })
  }),

  V('gg', 'GG', 'oyun', {
    aspect: 1.4, loop: 2.2, tags: ['gg', 'good game', 'iyi oyundu'],
    params: [T('text', 'Yazı', 'GG'), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.4)
    const q = phase(t, 2.2)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.rotate(-0.06); ctx.translate(-W / 2, -50)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 100); ctx.clip()
    text(ctx, p.text, W / 2, 52, { size: 70, maxW: W - 20, fam: F_HEAVY, fill: lin(ctx, 0, 22, 0, 82, [lighten(p.color, 0.5), p.color, darken(p.color, 0.3)]), sw: 8, stroke: INK, extrude: 5, extrudeColor: INK })
    ctx.globalCompositeOperation = 'source-atop'
    shine(ctx, 10, 10, W - 20, 80, seg(q, 0.1, 0.5), 0.8)
    ctx.restore()
  }),

  V('mvp', 'MVP', 'oyun', {
    loop: 3, tags: ['mvp', 'en iyi', 'yıldız', 'oyuncu'],
    params: [T('text', 'Yazı', 'MVP'), C('color', 'Renk', '#FFC23D')],
  }, (ctx, t, p) => {
    const s = popIn(t, 0.45)
    ctx.translate(50, 50); ctx.scale(s, s); ctx.translate(-50, -50)
    rays(ctx, 50, 46, 56, 12, -t * 0.5, p.color, 0.4)
    shadow(ctx, 7, 0, 4)
    ctx.beginPath(); poly(ctx, starPts(50, 46, 5, 42, 20)); ctx.fillStyle = lin(ctx, 0, 4, 0, 88, [lighten(p.color, 0.5), p.color, darken(p.color, 0.35)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 3; ctx.strokeStyle = darken(p.color, 0.6); ctx.stroke()
    ctx.beginPath(); poly(ctx, [[18, 58], [82, 58], [86, 76], [14, 76]]); ctx.fillStyle = INK; ctx.fill()
    text(ctx, p.text, 50, 67.5, { size: 16, maxW: 64, fill: p.color, fam: F_HEAVY })
    sparkle(ctx, 80, 18, 2 + tri(t * 1.4) * 5, '#fff', t)
  }),

  V('kombo', 'Kombo Sayacı', 'oyun', {
    aspect: 1.6, loop: 1, tags: ['kombo', 'combo', 'seri', 'çarpan'],
    params: [N('value', 'Kombo', 10, 1, 999, 1), T('text', 'Yazı', 'KOMBO!'), C('color', 'Renk', '#FF2D87')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 1)
    const bump = 1 + Math.exp(-q * 8) * 0.3
    const hue = ['#FF2D87', '#FFC93C', '#00E5FF'][Math.floor(t * 6) % 3]
    ctx.translate(W / 2 + (hash(Math.floor(t * 30)) - 0.5) * 2 * Math.exp(-q * 6), 0)
    ctx.save(); ctx.translate(0, 42); ctx.scale(bump, bump); ctx.rotate(-0.08)
    text(ctx, '×' + Math.round(+p.value), 0, 0, { size: 52, maxW: W - 20, fam: F_HEAVY, fill: lin(ctx, 0, -24, 0, 24, ['#ffffff', p.color]), sw: 6, stroke: INK, extrude: 3, extrudeColor: INK })
    ctx.restore()
    ctx.save(); ctx.translate(0, 80); ctx.rotate(-0.08)
    text(ctx, p.text, 0, 0, { size: 20, maxW: W - 30, fam: F_HEAVY, fill: hue, sw: 5, stroke: INK })
    ctx.restore()
  }),

  V('elmas', 'Elmas', 'oyun', {
    loop: 2.4, tags: ['elmas', 'mücevher', 'gem', 'değerli'],
    params: [C('color', 'Renk', '#4FE3FF')],
  }, (ctx, t, p) => {
    const y = Math.sin(t * 2.6) * 3
    const c = p.color
    ctx.translate(0, y)
    ctx.beginPath(); ctx.ellipse(50, 92 - y, 22, 4, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill()
    const top = [[26, 30], [38, 18], [62, 18], [74, 30]], tip = [50, 84]
    shadow(ctx, 8, 0, 3, rgba(c, 0.6))
    ctx.beginPath(); poly(ctx, [...top, tip]); ctx.fillStyle = c; ctx.fill(); noShadow(ctx)
    const facet = (pts, col) => { ctx.beginPath(); poly(ctx, pts); ctx.fillStyle = col; ctx.fill() }
    facet([[26, 30], [38, 18], [44, 30]], lighten(c, 0.5)); facet([[38, 18], [62, 18], [56, 30], [44, 30]], lighten(c, 0.7))
    facet([[62, 18], [74, 30], [56, 30]], lighten(c, 0.35)); facet([[26, 30], [44, 30], tip], lighten(c, 0.2))
    facet([[44, 30], [56, 30], tip], lighten(c, 0.45)); facet([[56, 30], [74, 30], tip], darken(c, 0.25))
    ctx.beginPath(); poly(ctx, [...top, tip]); ctx.lineWidth = 2.4; ctx.strokeStyle = darken(c, 0.6); ctx.stroke()
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(darken(c, 0.6), 0.5)
    ctx.beginPath(); ctx.moveTo(26, 30); ctx.lineTo(74, 30); ctx.moveTo(44, 30); ctx.lineTo(50, 84); ctx.lineTo(56, 30); ctx.stroke()
    const k = phase(t, 2.4)
    sparkle(ctx, 40, 24, k < 0.3 ? Math.sin(k / 0.3 * Math.PI) * 8 : 0, '#fff', 0)
    sparkle(ctx, 66, 46, k > 0.5 && k < 0.8 ? Math.sin((k - 0.5) / 0.3 * Math.PI) * 6 : 0, '#fff', 0.3)
  }),

  V('can-kalpleri', 'Can Kalpleri (Piksel)', 'oyun', {
    aspect: 3, loop: 1, tags: ['can', 'kalp', 'piksel', 'retro', 'hayat'],
    params: [N('value', 'Can', 3, 0, 5, 1), N('max', 'En fazla', 5, 1, 5, 1), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const M = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
    const max = Math.max(1, Math.round(+p.max)), val = Math.round(+p.value)
    const px = 5.2, hw = 7 * px, gap = 10
    const total = max * hw + (max - 1) * gap
    const x0 = (W - total) / 2, y0 = 50 - 3 * px
    for (let k = 0; k < max; k++) {
      const full = k < val
      const last = k === val - 1 && val <= 2
      const vis = !last || phase(t, 1) < 0.6
      const bob = Math.sin(t * 6 + k) * (full ? 1 : 0)
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        if (M[r][c] !== 'X') continue
        const x = x0 + k * (hw + gap) + c * px, y = y0 + r * px + bob
        ctx.fillStyle = INK; ctx.fillRect(x - 1.2, y - 1.2, px + 2.4, px + 2.4)
      }
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        if (M[r][c] !== 'X') continue
        const x = x0 + k * (hw + gap) + c * px, y = y0 + r * px + bob
        ctx.fillStyle = full && vis ? ((r === 1 && c === 1) || (r === 1 && c === 2 && false) ? '#fff' : (r >= 3 ? darken(p.color, 0.2) : p.color)) : '#3a3c45'
        ctx.fillRect(x, y, px + 0.3, px + 0.3)
      }
    }
  }),

  V('basarim', 'Başarım Açıldı', 'oyun', {
    aspect: 3.6, loop: 4, tags: ['başarım', 'achievement', 'kupa', 'açıldı'],
    params: [T('header', 'Üst yazı', 'BAŞARIM AÇILDI'), T('title', 'Başlık', 'İlk Kan'), C('color', 'Renk', '#FFC23D')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 4) * 4
    const y = lerp(80, 0, ease.out3(seg(q, 0, 0.4))) + lerp(0, 80, ease.in(seg(q, 3.6, 4)))
    ctx.globalAlpha = 1 - seg(q, 3.7, 4)
    ctx.translate(0, y)
    shadow(ctx, 10, 0, 4)
    ctx.beginPath(); rr(ctx, 10, 18, W - 20, 64, 6); ctx.fillStyle = lin(ctx, 0, 18, 0, 82, ['#22242c', '#0d0e12']); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(p.color, 0.5); ctx.stroke()
    ctx.save(); ctx.beginPath(); rr(ctx, 10, 18, W - 20, 64, 6); ctx.clip(); shine(ctx, 10, 18, W - 20, 64, seg(q, 0.5, 1.3), 0.25); ctx.restore()
    ctx.beginPath(); ctx.arc(50, 50, 22, 0, TAU); ctx.fillStyle = lin(ctx, 0, 28, 0, 72, [lighten(p.color, 0.3), darken(p.color, 0.35)]); ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke()
    // küçük kupa
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.moveTo(41, 38); ctx.lineTo(59, 38); ctx.quadraticCurveTo(59, 54, 50, 55); ctx.quadraticCurveTo(41, 54, 41, 38); ctx.fill()
    ctx.fillRect(48, 54, 4, 5); ctx.fillRect(43, 59, 14, 3.5)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(41, 43, 4, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(59, 43, 4, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke()
    text(ctx, p.header, 84, 38, { size: 11, fill: p.color, align: 'left', fam: F_HEAVY, maxW: W - 110, spacing: 1 })
    text(ctx, p.title, 84, 60, { size: 24, fill: '#fff', align: 'left', fam: F_HEAVY, maxW: W - 110 })
    ctx.globalAlpha = 1
  }),
]
