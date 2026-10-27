// Vektör çıkartma çizim takımı — tasarım alanı, yollar, renk, yazı, yumuşatma yardımcıları.
// Her çizim stage() ile 100 birim yükseklikte bir tasarım alanına geçer; çizgi ve yazılar her boyutta keskin kalır.

export const TAU = Math.PI * 2
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const seg = (p, a, b) => clamp((p - a) / (b - a))
export const phase = (t, loop) => (((t % loop) + loop) % loop) / loop
export const tri = (x) => 1 - Math.abs(((x % 2) + 2) % 2 - 1) // 0..1..0 üçgen dalga

export const ease = {
  out: (x) => 1 - (1 - x) * (1 - x),
  out3: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x,
  inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) },
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (x) => {
    const n = 7.5625, d = 2.75
    if (x < 1 / d) return n * x * x
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
    return n * (x -= 2.625 / d) * x + 0.984375
  },
}

// Giriş "pop" ölçeği: 0→1 (geri yaylanmalı)
export const popIn = (t, d = 0.35, delay = 0) => ease.outBack(seg(t, delay, delay + d))

// deterministik rastgele
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

// ------------------------------------------------------------ tasarım alanı
// vw×vh kutusunu w×h tuvale ortalayarak sığdırır (mevcut dönüşümün ÜSTÜNE)
export function stage(ctx, w, h, vw, vh) {
  const k = Math.min(w / vw, h / vh)
  ctx.translate((w - vw * k) / 2, (h - vh * k) / 2)
  ctx.scale(k, k)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  return k
}
export function devScale(ctx) { const m = ctx.getTransform(); return Math.hypot(m.a, m.b) || 1 }
export function shadow(ctx, blur = 4, ox = 0, oy = 2, color = 'rgba(0,0,0,0.45)') {
  const s = devScale(ctx)
  ctx.shadowBlur = blur * s; ctx.shadowOffsetX = ox * s; ctx.shadowOffsetY = oy * s; ctx.shadowColor = color
}
export function noShadow(ctx) { ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent' }

// ------------------------------------------------------------ renk
export function hex2rgb(h) {
  h = String(h || '#000').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const to2 = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b)
  return '#' + to2(lerp(A[0], B[0], t)) + to2(lerp(A[1], B[1], t)) + to2(lerp(A[2], B[2], t))
}
export const lighten = (c, t) => mix(c, '#ffffff', t)
export const darken = (c, t) => mix(c, '#000000', t)
export function rgba(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})` }
export function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  stops.forEach((s, i) => Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / Math.max(1, stops.length - 1), s))
  return g
}
export function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1)
  stops.forEach((s, i) => Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / Math.max(1, stops.length - 1), s))
  return g
}
// tek renkten dikey parlak dolgu
export const vgrad = (ctx, y0, y1, c, amt = 0.28) => lin(ctx, 0, y0, 0, y1, [lighten(c, amt), c, darken(c, amt)])

export const INK = '#0d0d12'

// ------------------------------------------------------------ yollar
export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
export function starPts(cx, cy, n, r1, r2, rot = -Math.PI / 2) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}
export function poly(ctx, pts, close = true) {
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  if (close) ctx.closePath()
}
// çizgi roman patlaması: düzensiz uçlu yıldız
export function burstPts(cx, cy, n, r1, r2, seed = 3, rot = 0, jit = 0.22) {
  const R = rng(seed), pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n + (R() - 0.5) * (Math.PI / n) * 0.6
    const r = (i % 2 ? r2 : r1) * (1 + (R() - 0.5) * jit * 2)
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}
export function heart(ctx, cx, cy, s) {
  // s = genişlik/2 civarı
  ctx.moveTo(cx, cy + s * 0.95)
  ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.1, cx - s * 1.05, cy - s * 0.95, cx, cy - s * 0.42)
  ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.95, cx + s * 1.25, cy + s * 0.1, cx, cy + s * 0.95)
  ctx.closePath()
}
export function heartPts(cx, cy, s, n = 90) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU
    const x = 16 * Math.pow(Math.sin(a), 3)
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)
    pts.push([cx + (x / 16) * s, cy - (y / 16) * s - s * 0.1])
  }
  return pts
}
export function circlePts(cx, cy, rx, ry = rx, n = 96, a0 = -Math.PI / 2) {
  const pts = []
  for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * TAU; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]) }
  return pts
}
export function rrPts(x, y, w, h, r, n = 10) {
  const pts = []
  const corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) } }
  pts.push([x + r, y])
  corner(x + w - r, y + r, -Math.PI / 2)
  corner(x + w - r, y + h - r, 0)
  corner(x + r, y + h - r, Math.PI / 2)
  corner(x + r, y + r, Math.PI)
  pts.push([x + r, y])
  return pts
}
// bulut / düşünce balonu yolu (elips üstüne kabarcıklar)
export function cloud(ctx, cx, cy, rx, ry, n = 9, seed = 2, puff = 0.28) {
  const R = rng(seed)
  const pts = []
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R() * 0.2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]) }
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2
    const dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1
    const bulge = (rx + ry) * 0.5 * (puff + R() * 0.1)
    ctx.quadraticCurveTo(mx + (dx / L) * bulge, my + (dy / L) * bulge, q[0], q[1])
  }
  ctx.closePath()
}
// çoklu çizginin uzunluğu ve kısmi çizimi (çizilerek görünme animasyonu)
export function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L }
export function polyPartial(ctx, pts, p, from = 0) {
  const L = polyLen(pts), a = L * clamp(from), b = L * clamp(p)
  if (b <= a) return null
  let acc = 0, started = false, last = null
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i]
    const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    if (acc + d >= a && acc <= b) {
      const s = clamp((a - acc) / (d || 1)), e = clamp((b - acc) / (d || 1))
      const x0 = lerp(p0[0], p1[0], s), y0 = lerp(p0[1], p1[1], s)
      const x1 = lerp(p0[0], p1[0], e), y1 = lerp(p0[1], p1[1], e)
      if (!started) { ctx.moveTo(x0, y0); started = true }
      ctx.lineTo(x1, y1)
      last = [x1, y1, Math.atan2(p1[1] - p0[1], p1[0] - p0[0])]
    }
    acc += d
    if (acc > b) break
  }
  return last // uç noktası + yön (ok başı için)
}
// el çizimi titreşimi
export function wobble(pts, amt, seed = 1) {
  const R = rng(seed)
  return pts.map(([x, y]) => [x + (R() - 0.5) * amt, y + (R() - 0.5) * amt])
}
export function arrowHead(ctx, x, y, ang, s) {
  ctx.moveTo(x + Math.cos(ang + 2.55) * s, y + Math.sin(ang + 2.55) * s)
  ctx.lineTo(x, y)
  ctx.lineTo(x + Math.cos(ang - 2.55) * s, y + Math.sin(ang - 2.55) * s)
}
// fare imleci (uç noktası x,y)
export function cursor(ctx, x, y, s = 1) {
  const P = [[0, 0], [0, 17], [4.2, 13.2], [7.2, 20], [10, 18.8], [7.1, 12.2], [12.5, 12.2]]
  ctx.beginPath(); poly(ctx, P.map(([a, b]) => [x + a * s, y + b * s]))
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * s
  ctx.fill(); ctx.stroke()
}

// ------------------------------------------------------------ yazı
export const F_DISPLAY = '"Anton", "Bebas Neue", Impact, "Arial Black", sans-serif'
export const F_HEAVY = '"Archivo Black", "Arial Black", "Segoe UI Black", Impact, sans-serif'
export const F_UI = '"Archivo", "Segoe UI", Arial, sans-serif'
export const F_MONO = '"JetBrains Mono", Consolas, "Courier New", monospace'
export const font = (px, weight = 900, fam = F_HEAVY) => `${weight} ${px}px ${fam}`

// metni maxW'ya sığdıracak boyut
export function fitSize(ctx, text, maxW, size, weight = 900, fam = F_HEAVY, spacing = 0) {
  ctx.font = font(size, weight, fam)
  const w = ctx.measureText(String(text)).width + spacing * Math.max(0, String(text).length - 1)
  return w > maxW ? Math.max(4, size * (maxW / w)) : size
}
// konturlu yazı: { size, fam, weight, fill, stroke, sw, align, base, maxW, extrude, extrudeColor, sh, spacing }
export function text(ctx, str, x, y, o = {}) {
  str = String(str ?? '')
  const fam = o.fam || F_HEAVY, weight = o.weight ?? 900
  const size = o.maxW ? fitSize(ctx, str, o.maxW, o.size || 20, weight, fam, o.spacing || 0) : (o.size || 20)
  ctx.font = font(size, weight, fam)
  ctx.textAlign = o.align || 'center'
  ctx.textBaseline = o.base || 'middle'
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px'
  if (o.extrude) {
    const n = Math.max(1, Math.round(o.extrude * 2))
    ctx.fillStyle = o.extrudeColor || INK
    for (let i = n; i >= 1; i--) {
      const d = (i / n) * o.extrude
      if (o.sw) { ctx.lineWidth = o.sw; ctx.strokeStyle = o.extrudeColor || INK; ctx.strokeText(str, x + d, y + d) }
      ctx.fillText(str, x + d, y + d)
    }
  }
  if (o.sh) shadow(ctx, o.sh, 0, o.sh * 0.4, o.shColor || 'rgba(0,0,0,0.5)')
  if (o.sw) { ctx.lineWidth = o.sw; ctx.strokeStyle = o.stroke || INK; ctx.strokeText(str, x, y) }
  noShadow(ctx)
  if (o.fill !== null) { ctx.fillStyle = o.fill || '#fff'; ctx.fillText(str, x, y) }
  if (o.spacing) ctx.letterSpacing = '0px'
  return size
}

// ------------------------------------------------------------ hazır parçalar
// parlak buton / rozet
export function glossy(ctx, x, y, w, h, r, color, o = {}) {
  ctx.save()
  if (o.sh !== 0) shadow(ctx, o.sh ?? 5, 0, (o.sh ?? 5) * 0.5, 'rgba(0,0,0,0.45)')
  ctx.beginPath(); rr(ctx, x, y, w, h, r)
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [lighten(color, 0.22), color, darken(color, 0.25)])
  ctx.fill()
  noShadow(ctx)
  if (o.stroke !== false) { ctx.lineWidth = o.sw ?? 2; ctx.strokeStyle = o.stroke || darken(color, 0.55); ctx.stroke() }
  // üst parlama
  ctx.beginPath(); rr(ctx, x + h * 0.08, y + h * 0.07, w - h * 0.16, h * 0.42, Math.max(0, r - h * 0.08))
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h * 0.5, ['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.04)'])
  ctx.fill()
  ctx.restore()
}
// yumuşak ışık halesi
export function glowDot(ctx, x, y, r, color, a = 1) {
  ctx.fillStyle = rad(ctx, x, y, 0, r, [rgba(color, 0.9 * a), rgba(color, 0.35 * a), rgba(color, 0)])
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
}
// dört köşeli parıltı
export function sparkle(ctx, x, y, r, color = '#fff', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.beginPath()
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0); ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r)
  ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0); ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r)
  ctx.fillStyle = color; ctx.fill()
  ctx.restore()
}
// güneş ışınları (ganimet, kupa arkası)
export function rays(ctx, cx, cy, r, n, rot, color, a = 0.5) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  ctx.fillStyle = rad(ctx, 0, 0, 0, r, [rgba(color, a), rgba(color, 0)])
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = a0 + (TAU / n) * 0.5
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}
// konfeti/parçacık patlaması: p 0..1
export function particles(ctx, cx, cy, n, p, dist, seed, colors, size = 2.4) {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = dist * (0.5 + R() * 0.6), s = size * (0.6 + R() * 0.8)
    const e = ease.out3(p)
    const x = cx + Math.cos(a) * d * e, y = cy + Math.sin(a) * d * e + p * p * dist * 0.25
    ctx.globalAlpha = clamp(1 - p) * clamp(p * 8)
    ctx.fillStyle = colors[i % colors.length]
    ctx.save(); ctx.translate(x, y); ctx.rotate(R() * TAU + p * 6)
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill() } else ctx.fillRect(-s / 2, -s / 4, s, s / 2)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

// konuşma balonu: yuvarlak dikdörtgen + alt kenarda kuyruk (tx..tx+tw tabanı, ucu px,py)
export function bubble(ctx, x, y, w, h, r, tx, tw, px, py) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.lineTo(tx + tw, y + h)
  ctx.lineTo(px, py)
  ctx.lineTo(tx, y + h)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// kübik bezier örnekleme → nokta dizisi
export function bez(p0, p1, p2, p3, n = 60) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return pts
}
// keçeli kalem çizgisi (koyu kontur + renk), çizilerek görünür; ok başı isteğe bağlı
export function marker(ctx, pts, p, color, w, o = {}) {
  const pass = (col, lw) => {
    ctx.beginPath()
    const e = polyPartial(ctx, pts, p, o.from || 0)
    if (e && o.head && p > 0.02) arrowHead(ctx, e[0], e[1], e[2], o.head * clamp(p * 4))
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
  }
  if (o.outline !== false) pass(o.outlineColor || INK, w + (o.ow || 4))
  pass(color, w)
}

// çok satırlı yazı: kutuya sığana kadar küçültür ('\n' ve otomatik kaydırma)
export function wrapLines(ctx, str, maxW) {
  const out = []
  for (const para of String(str ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w } else line = test
    }
    out.push(line)
  }
  return out
}
export function textBlock(ctx, str, cx, cy, maxW, maxH, o = {}) {
  let size = o.size || 20
  const fam = o.fam || F_HEAVY, weight = o.weight ?? 900, lh = o.lh || 1.12
  let lines = ['']
  for (let i = 0; i < 40; i++) {
    ctx.font = font(size, weight, fam)
    lines = wrapLines(ctx, str, maxW)
    const wMax = Math.max(0, ...lines.map(l => ctx.measureText(l).width))
    if (lines.length * size * lh <= maxH && wMax <= maxW) break
    size *= 0.92
  }
  const y0 = cy - ((lines.length - 1) * size * lh) / 2
  lines.forEach((l, i) => text(ctx, l, cx, y0 + i * size * lh, { ...o, size, maxW: 0 }))
  return size
}
export const F_COMIC = '"Bangers", "Luckiest Guy", "Archivo Black", "Arial Black", Impact, sans-serif'
