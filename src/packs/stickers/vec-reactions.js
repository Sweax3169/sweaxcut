// Tepki çıkartmaları — ateş, patlama, parıltı, soru işaretleri, ter damlası, sinir damarı, konfeti…
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, tri, shadow, noShadow, lighten, darken, mix, rgba, lin, rad, rr, poly,
  starPts, text, sparkle, glowDot, cloud, burstPts, rng, hash, INK, F_HEAVY, F_COMIC,
} from './kit.js'
import { V, C, T, N } from './vdef.js'
import { skull } from './vec-gaming.js'

// gözyaşı biçimli alev dili (altta yarım daire, yukarı sivri)
function flame(ctx, cx, by, H, r, t, seed, fill) {
  const N = 26, L = [], R = []
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * H
    let w
    if (y < r) w = Math.sqrt(Math.max(0, r * r - (r - y) * (r - y)))
    else w = r * Math.pow(1 - (y - r) / (H - r), 1.25)
    const k = y / H
    const sway = Math.sin(k * 4.5 - t * 8 + seed) * k * r * 0.55 + Math.sin(k * 9 - t * 13 + seed * 2.3) * k * r * 0.18
    L.push([cx - w + sway, by - y]); R.push([cx + w + sway, by - y])
  }
  ctx.beginPath(); poly(ctx, [...L, ...R.reverse()]); ctx.fillStyle = fill; ctx.fill()
}

function face(ctx, cx, cy, r) {
  shadow(ctx, 6, 0, 3)
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU)
  ctx.fillStyle = rad(ctx, cx - r * 0.3, cy - r * 0.4, r * 0.1, r * 1.2, ['#FFE98A', '#FFC93C', '#F29A1E']); ctx.fill(); noShadow(ctx)
  ctx.lineWidth = 2.4; ctx.strokeStyle = darken('#F29A1E', 0.5); ctx.stroke()
}

export default [
  V('ates', 'Ateş', 'tepki', {
    aspect: 0.9, loop: 2, tags: ['ateş', 'alev', 'fire', 'yanıyor'],
    params: [C('color', 'Dış alev', '#FF3D00'), C('color2', 'İç alev', '#FFD23F')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    const cx = W / 2, by = 92
    ctx.translate(cx, by); ctx.scale(s, s); ctx.translate(-cx, -by)
    glowDot(ctx, cx, 62, 46, p.color, 0.35)
    ctx.globalCompositeOperation = 'source-over'
    flame(ctx, cx - 14, by, 54, 13, t * 1.1, 4, lin(ctx, 0, by - 54, 0, by, [rgba(p.color, 0.0), p.color]))
    flame(ctx, cx + 15, by, 50, 12, t * 1.2, 7, lin(ctx, 0, by - 50, 0, by, [rgba(p.color, 0.0), p.color]))
    flame(ctx, cx, by, 84, 26, t, 1, lin(ctx, 0, by - 84, 0, by, [darken(p.color, 0.1), p.color, mix(p.color, p.color2, 0.4)]))
    flame(ctx, cx, by - 2, 60, 18, t * 1.15, 2, lin(ctx, 0, by - 62, 0, by, [mix(p.color, p.color2, 0.5), p.color2]))
    flame(ctx, cx, by - 4, 36, 10, t * 1.3, 3, lin(ctx, 0, by - 40, 0, by, [p.color2, '#FFFBE6']))
    // kıvılcımlar
    for (let i = 0; i < 7; i++) {
      const k = phase(t * 0.9 + i / 7, 1)
      const x = cx + Math.sin(i * 2.7 + k * 5) * 18 + (hash(i) - 0.5) * 20
      const y = by - 30 - k * 64
      ctx.globalAlpha = (1 - k) * 0.95
      ctx.beginPath(); ctx.arc(x, y, 1.6 * (1 - k) + 0.6, 0, TAU); ctx.fillStyle = k < 0.5 ? p.color2 : p.color; ctx.fill()
    }
    ctx.globalAlpha = 1
  }),

  V('patlama', 'Patlama', 'tepki', {
    loop: 1.6, tags: ['patlama', 'explosion', 'bomba', 'bum'],
    params: [C('color', 'Renk', '#FF8A00')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.6)
    const flash = 1 - seg(q, 0, 0.12)
    if (flash > 0) { glowDot(ctx, 50, 52, 30 + q * 300, '#FFF7C2', flash); }
    // kıvılcım çizgileri
    const k = seg(q, 0, 0.35)
    if (k < 1) {
      ctx.strokeStyle = rgba('#FFE14D', 1 - k); ctx.lineWidth = 3
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.2, r0 = 18 + k * 30, r1 = r0 + 14 * (1 - k)
        ctx.beginPath(); ctx.moveTo(50 + Math.cos(a) * r0, 52 + Math.sin(a) * r0); ctx.lineTo(50 + Math.cos(a) * r1, 52 + Math.sin(a) * r1); ctx.stroke()
      }
    }
    const g = ease.out3(seg(q, 0.02, 0.5))
    const fade = 1 - seg(q, 0.7, 1)
    const col = mix(mix('#FFE680', p.color, seg(q, 0.05, 0.35)), '#4a2a1a', seg(q, 0.4, 0.85))
    ctx.globalAlpha = fade
    // duman
    ctx.beginPath(); cloud(ctx, 50, 52 - q * 10, 20 + g * 22, 16 + g * 18, 9, 3, 0.35)
    ctx.fillStyle = rgba('#3a3540', 0.6 * seg(q, 0.25, 0.6)); ctx.fill()
    ctx.beginPath(); cloud(ctx, 50, 54 - q * 6, 14 + g * 20, 12 + g * 16, 10, 5, 0.32)
    ctx.fillStyle = rad(ctx, 50, 56, 2, 40, [lighten(col, 0.6), col, darken(col, 0.35)]); ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(INK, 0.6); ctx.stroke()
    ctx.beginPath(); cloud(ctx, 50, 56 - q * 4, 6 + g * 10, 5 + g * 8, 8, 8, 0.3)
    ctx.fillStyle = rgba('#FFF4B0', 1 - seg(q, 0.2, 0.6)); ctx.fill()
    // parçalar
    const R = rng(5)
    for (let i = 0; i < 10; i++) {
      const a = R() * TAU, sp = 30 + R() * 30, e = seg(q, 0.03, 0.8)
      const x = 50 + Math.cos(a) * sp * e, y = 52 + Math.sin(a) * sp * e + e * e * 22
      ctx.fillStyle = i % 2 ? '#2a2420' : p.color
      ctx.save(); ctx.translate(x, y); ctx.rotate(e * 8 + i); ctx.fillRect(-2, -1.5, 4, 3); ctx.restore()
    }
    ctx.globalAlpha = 1
  }),

  V('parilti', 'Parıltı', 'tepki', {
    loop: 1.8, tags: ['parıltı', 'ışıltı', 'sparkle', 'yeni'],
    params: [C('color', 'Renk', '#FFFFFF'), C('color2', 'İkinci renk', '#FFE14D')],
  }, (ctx, t, p) => {
    const pos = [[30, 30, 14], [68, 22, 9], [72, 62, 16], [34, 72, 10], [50, 48, 7], [86, 40, 6], [16, 52, 6]]
    pos.forEach(([x, y, r], i) => {
      const k = tri(t / 0.9 + i * 0.37)
      const s = popIn(t, 0.3, i * 0.05) * (0.3 + k * 0.9)
      glowDot(ctx, x, y, r * 1.4 * s, i % 2 ? p.color2 : p.color, 0.5)
      sparkle(ctx, x, y, r * s, i % 2 ? p.color2 : p.color, t * 0.6 * (i % 2 ? 1 : -1))
    })
  }),

  V('yildizlar', 'Baş Dönmesi Yıldızları', 'tepki', {
    aspect: 1.6, loop: 1.4, tags: ['yıldız', 'baş dönmesi', 'sersem', 'dizzy'],
    params: [C('color', 'Renk', '#FFD23F')],
  }, (ctx, t, p, W) => {
    const n = 5, items = []
    for (let i = 0; i < n; i++) {
      const a = phase(t, 1.4) * TAU + (i / n) * TAU
      items.push({ x: W / 2 + Math.cos(a) * 54, y: 54 + Math.sin(a) * 16, z: Math.sin(a), a })
    }
    ctx.beginPath(); ctx.ellipse(W / 2, 54, 54, 16, 0, 0, TAU); ctx.strokeStyle = rgba(p.color, 0.25); ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([])
    items.sort((a, b) => a.z - b.z).forEach(({ x, y, z, a }) => {
      const r = 9 + z * 3.5
      ctx.globalAlpha = 0.65 + (z + 1) * 0.175
      ctx.beginPath(); poly(ctx, starPts(x, y, 5, r, r * 0.45, a * 2 - Math.PI / 2))
      ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, [lighten(p.color, 0.45), p.color]); ctx.fill()
      ctx.lineWidth = 1.8; ctx.strokeStyle = darken(p.color, 0.55); ctx.stroke()
    })
    ctx.globalAlpha = 1
  }),

  V('soru-isaretleri', 'Soru İşaretleri', 'tepki', {
    loop: 2, tags: ['soru', 'kafası karışık', 'ne', '?'],
    params: [C('color', 'Renk', '#FFD23F')],
  }, (ctx, t, p) => {
    const marks = [[30, 58, 46, -0.25, 0], [64, 40, 62, 0.15, 0.7], [84, 70, 30, 0.35, 1.3]]
    for (const [x, y, sz, r, ph] of marks) {
      const s = popIn(t, 0.35, ph * 0.15)
      ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + ph * 2) * 3); ctx.rotate(r + Math.sin(t * 2.4 + ph) * 0.12); ctx.scale(s, s)
      text(ctx, '?', 0, 0, { size: sz, fam: F_HEAVY, fill: lin(ctx, 0, -sz / 2, 0, sz / 2, [lighten(p.color, 0.4), p.color, darken(p.color, 0.2)]), sw: 6, stroke: INK, extrude: 2.5 })
      ctx.restore()
    }
  }),

  V('unlem', 'Ünlem', 'tepki', {
    loop: 1.5, tags: ['ünlem', 'dikkat', 'şaşırma', '!'],
    params: [C('color', 'Renk', '#FF3B30')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.5)
    const s = popIn(t, 0.35) * (1 + Math.exp(-q * 1.5 * 8) * 0.15)
    ctx.translate(50, 55); ctx.scale(s, s); ctx.rotate(Math.sin(t * 30) * 0.05 * Math.exp(-q * 4))
    ctx.strokeStyle = p.color; ctx.lineWidth = 5
    for (const [a, b] of [[-0.9, 1], [-0.5, 1], [0.5, 1], [0.9, 1]]) {
      const ang = -Math.PI / 2 + a, r0 = 44, r1 = 54
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0 * b, Math.sin(ang) * r0 * b - 4); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1 - 4); ctx.stroke()
    }
    text(ctx, '!', 0, 0, { size: 80, fam: F_HEAVY, fill: lin(ctx, 0, -40, 0, 40, [lighten(p.color, 0.3), p.color, darken(p.color, 0.3)]), sw: 8, stroke: INK, extrude: 3 })
  }),

  V('ter-damlasi', 'Ter Damlası', 'tepki', {
    loop: 1.6, tags: ['ter', 'gergin', 'utanç', 'anime'],
    params: [C('color', 'Renk', '#5CC8FF')],
  }, (ctx, t, p) => {
    const drops = [[44, 30, 22, 0], [72, 56, 13, 0.5], [28, 66, 10, 0.9]]
    for (const [x, y, r, ph] of drops) {
      const k = phase(t / 1.6 + ph, 1)
      const dy = ease.in(k) * 10, a = 1 - seg(k, 0.75, 1)
      const s = popIn(t, 0.3, ph * 0.2)
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + dy); ctx.scale(s, s)
      ctx.beginPath(); ctx.moveTo(0, -r * 1.5)
      ctx.bezierCurveTo(r * 0.3, -r * 0.9, r, -r * 0.2, r, r * 0.25)
      ctx.arc(0, r * 0.25, r, 0, Math.PI)
      ctx.bezierCurveTo(-r, -r * 0.2, -r * 0.3, -r * 0.9, 0, -r * 1.5)
      ctx.fillStyle = lin(ctx, -r, -r, r, r, [lighten(p.color, 0.5), p.color, darken(p.color, 0.25)]); ctx.fill()
      ctx.lineWidth = Math.max(1.4, r * 0.12); ctx.strokeStyle = darken(p.color, 0.55); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(-r * 0.38, r * 0.05, r * 0.18, r * 0.36, 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill()
      ctx.restore()
    }
  }),

  V('sinir-damari', 'Sinir Damarı', 'tepki', {
    loop: 0.8, tags: ['sinir', 'kızgın', 'öfke', 'anime'],
    params: [C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 0.8)
    const s = popIn(t, 0.3) * (1 + Math.exp(-q * 7) * 0.18)
    ctx.translate(50, 50); ctx.scale(s, s); ctx.rotate(0.12)
    const piece = () => {
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        ctx.moveTo(sx * 8, sy * 34); ctx.quadraticCurveTo(sx * 9, sy * 9, sx * 34, sy * 8)
      }
    }
    ctx.beginPath(); piece(); ctx.lineWidth = 17; ctx.strokeStyle = INK; ctx.stroke()
    ctx.beginPath(); piece(); ctx.lineWidth = 11; ctx.strokeStyle = p.color; ctx.stroke()
    ctx.beginPath(); piece(); ctx.lineWidth = 3; ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.stroke()
  }),

  V('gulmekten-aglayan', 'Gülmekten Ağlayan', 'tepki', {
    loop: 0.7, tags: ['gülme', 'kahkaha', 'komik', 'lol'],
    params: [C('tear', 'Gözyaşı', '#5CC8FF')],
  }, (ctx, t, p) => {
    const q = phase(t, 0.7)
    const rock = Math.sin(q * TAU) * 0.12
    ctx.translate(50, 54); ctx.rotate(rock); ctx.translate(-50, -54)
    face(ctx, 50, 54, 36)
    ctx.strokeStyle = '#5A3A10'; ctx.lineWidth = 4
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(50 + sx * 22, 46); ctx.quadraticCurveTo(50 + sx * 14, 36, 50 + sx * 6, 46); ctx.stroke() }
    // ağız
    ctx.beginPath(); ctx.moveTo(30, 58); ctx.quadraticCurveTo(50, 60, 70, 58); ctx.quadraticCurveTo(68, 84, 50, 84); ctx.quadraticCurveTo(32, 84, 30, 58)
    ctx.fillStyle = '#5A1A10'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke()
    ctx.save(); ctx.clip()
    ctx.fillStyle = '#fff'; ctx.fillRect(28, 56, 44, 7)
    ctx.beginPath(); ctx.ellipse(50, 84, 12, 8, 0, 0, TAU); ctx.fillStyle = '#FF6B7A'; ctx.fill()
    ctx.restore()
    // gözyaşı akıntısı
    for (const sx of [-1, 1]) {
      const pts = []
      for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push([50 + sx * (24 + k * 26), 44 + Math.sin(k * Math.PI) * -10 + k * k * 30]) }
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.lineWidth = 7; ctx.strokeStyle = rgba(p.tear, 0.9); ctx.stroke()
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke()
      const k = phase(t * 2 + (sx > 0 ? 0.5 : 0), 1)
      const dx = 50 + sx * (50 + k * 6), dy = 74 + k * 20
      ctx.globalAlpha = 1 - k
      ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, TAU); ctx.fillStyle = p.tear; ctx.fill()
      ctx.globalAlpha = 1
    }
  }),

  V('sok-cizgileri', 'Şok Çizgileri', 'tepki', {
    aspect: 1.6, loop: 0.6, tags: ['şok', 'şaşkın', 'sürpriz', 'çizgi'],
    params: [C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 0.6)
    const k = ease.out(q < 0.5 ? q * 2 : 1)
    const a = q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2
    ctx.globalAlpha = a
    for (const sx of [-1, 1]) {
      for (const [ang, len] of [[-0.55, 22], [0, 26], [0.55, 22]]) {
        const cx = W / 2 + sx * 34, cy = 50
        const dirx = sx * Math.cos(ang), diry = Math.sin(ang)
        const r0 = 6 + k * 6, r1 = r0 + len * (0.6 + k * 0.4)
        for (const pass of [0, 1]) {
          ctx.beginPath(); ctx.moveTo(cx + dirx * r0, cy + diry * r0); ctx.lineTo(cx + dirx * r1, cy + diry * r1)
          ctx.strokeStyle = pass ? p.color : INK; ctx.lineWidth = pass ? 5 : 8.5; ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1
  }),

  V('cift-unlem', 'Çift Ünlem', 'tepki', {
    loop: 1, tags: ['!!', 'ünlem', 'şok', 'dikkat'],
    params: [C('color', 'Renk', '#FF3B30')],
  }, (ctx, t, p) => {
    const q = phase(t, 1)
    const s = popIn(t, 0.3) * (1 + Math.exp(-q * 8) * 0.12)
    ctx.translate(50 + Math.sin(t * 45) * 1.2, 52); ctx.scale(s, s); ctx.rotate(0.12)
    text(ctx, '!!', 0, 0, { size: 82, fam: F_HEAVY, fill: lin(ctx, 0, -40, 0, 40, [lighten(p.color, 0.35), p.color, darken(p.color, 0.3)]), sw: 8, stroke: INK, extrude: 3, spacing: -4 })
  }),

  V('yuz-puan', '100 Puan', 'tepki', {
    aspect: 1.5, loop: 1.2, tags: ['100', 'mükemmel', 'tam puan'],
    params: [T('text', 'Yazı', '100'), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 1.2)
    const s = popIn(t, 0.35)
    ctx.translate(W / 2 + Math.sin(t * 40) * 0.8 * Math.exp(-q * 3), 46); ctx.scale(s, s); ctx.rotate(-0.12)
    ctx.save(); ctx.transform(1, 0, -0.18, 1, 0, 0)
    text(ctx, p.text, 0, 0, { size: 62, fam: F_HEAVY, maxW: W - 24, fill: p.color, sw: 0 })
    ctx.restore()
    ctx.strokeStyle = p.color; ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(-W * 0.38, 30); ctx.quadraticCurveTo(0, 26, W * 0.38, 30); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-W * 0.34, 40); ctx.quadraticCurveTo(0, 36, W * 0.34, 40); ctx.stroke()
  }),

  V('kalp-atisi', 'Kalp Atışı (EKG)', 'tepki', {
    aspect: 3, loop: 1.2, tags: ['kalp', 'nabız', 'ekg', 'heyecan'],
    params: [C('color', 'Renk', '#3CFF6B')],
  }, (ctx, t, p, W) => {
    const beat = (x) => {
      const u = ((x % 1) + 1) % 1
      if (u < 0.3) return 0
      if (u < 0.36) return Math.sin((u - 0.3) / 0.06 * Math.PI) * 6
      if (u < 0.42) return 0
      if (u < 0.45) return -(u - 0.42) / 0.03 * 8
      if (u < 0.5) return -8 + (u - 0.45) / 0.05 * 48
      if (u < 0.56) return 40 - (u - 0.5) / 0.06 * 52
      if (u < 0.6) return -12 + (u - 0.56) / 0.04 * 12
      if (u < 0.75) return Math.sin((u - 0.6) / 0.15 * Math.PI) * 8
      return 0
    }
    const head = phase(t, 1.2)
    const x0 = 64, x1 = W - 10
    const pts = []
    for (let i = 0; i <= 200; i++) { const x = x0 + (x1 - x0) * i / 200; pts.push([x, 54 - beat(i / 200 * 2 - 0.08)]) }
    const hx = x0 + (x1 - x0) * head
    for (const pass of [0, 1]) {
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.strokeStyle = pass ? p.color : rgba(p.color, 0.25); ctx.lineWidth = pass ? 3 : 9
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 5, 0, hx - x0 + 5, 100); ctx.clip()
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
      ctx.restore()
    }
    glowDot(ctx, hx, pts[Math.min(200, Math.round(head * 200))][1], 9, p.color, 1)
    const b = 1 + Math.exp(-((head * 2 + 0.2) % 1) * 7) * 0.22
    ctx.save(); ctx.translate(32, 52); ctx.scale(b, b)
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.bezierCurveTo(-21, 1, -17, -16, 0, -7); ctx.bezierCurveTo(17, -16, 21, 1, 0, 15)
    ctx.fillStyle = lin(ctx, 0, -15, 0, 15, ['#FF6B7A', '#E8202A']); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke()
    ctx.restore()
  }),

  V('zzz', 'Uyku (Zzz)', 'tepki', {
    loop: 2.4, tags: ['uyku', 'zzz', 'sıkıcı', 'uykulu'],
    params: [C('color', 'Renk', '#B98CFF')],
  }, (ctx, t, p) => {
    for (let i = 0; i < 3; i++) {
      const k = phase(t / 2.4 + i / 3, 1)
      const x = 26 + k * 46 + Math.sin(k * 6) * 4, y = 84 - k * 70
      ctx.globalAlpha = Math.sin(k * Math.PI)
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25 + Math.sin(k * 5) * 0.15)
      text(ctx, 'Z', 0, 0, { size: 14 + k * 26, fam: F_HEAVY, fill: lin(ctx, 0, -12, 0, 12, [lighten(p.color, 0.4), p.color]), sw: 5, stroke: INK })
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }),

  V('ampul', 'Fikir Ampulü', 'tepki', {
    aspect: 0.9, loop: 2, tags: ['fikir', 'ampul', 'aklıma geldi', 'idea'],
    params: [C('color', 'Işık', '#FFE14D')],
  }, (ctx, t, p, W) => {
    const on = t < 0.25 ? 0 : t < 0.32 ? 1 : t < 0.38 ? 0.2 : 1
    const pulse = 0.85 + Math.sin(t * 4) * 0.15
    const cx = W / 2
    if (on > 0.5) {
      glowDot(ctx, cx, 40, 46 * pulse, p.color, 0.7)
      ctx.strokeStyle = p.color; ctx.lineWidth = 4
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI + (i / 6) * Math.PI, r0 = 33, r1 = 33 + 9 * pulse
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, 40 + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, 40 + Math.sin(a) * r1); ctx.stroke()
      }
    }
    ctx.beginPath(); ctx.arc(cx, 40, 24, Math.PI * 0.8, Math.PI * 0.2); ctx.lineTo(cx + 11, 70); ctx.lineTo(cx - 11, 70); ctx.closePath()
    ctx.fillStyle = on > 0.5 ? rad(ctx, cx - 6, 34, 2, 30, ['#ffffff', lighten(p.color, 0.3), p.color]) : rad(ctx, cx - 6, 34, 2, 30, ['#f5f5f5', '#c9ccd4', '#9ea3ae'])
    ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - 7, 66); ctx.lineTo(cx - 4, 50); ctx.lineTo(cx, 56); ctx.lineTo(cx + 4, 50); ctx.lineTo(cx + 7, 66)
    ctx.strokeStyle = on > 0.5 ? '#B8860B' : '#777'; ctx.lineWidth = 1.8; ctx.stroke()
    ctx.beginPath(); rr(ctx, cx - 12, 70, 24, 14, 3); ctx.fillStyle = lin(ctx, 0, 70, 0, 84, ['#c9ccd4', '#6c717c']); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke()
    ctx.lineWidth = 1.4; for (const y of [75, 79]) { ctx.beginPath(); ctx.moveTo(cx - 12, y); ctx.lineTo(cx + 12, y); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(cx - 6, 84); ctx.quadraticCurveTo(cx, 92, cx + 6, 84); ctx.fillStyle = '#3a3d46'; ctx.fill(); ctx.stroke()
  }),

  V('oldum', 'Öldüm', 'tepki', {
    loop: 1.6, tags: ['öldüm', 'kafatası', 'çok komik', 'dead'],
    params: [T('text', 'Yazı', 'ÖLDÜM'), C('color', 'Renk', '#F4F2EC')],
  }, (ctx, t, p) => {
    const s = popIn(t, 0.35)
    const b = Math.abs(Math.sin(t * Math.PI / 0.8))
    ctx.save()
    ctx.translate(50, 44 - b * 4); ctx.scale(s, s); ctx.rotate(Math.sin(t * 4) * 0.12); ctx.translate(-50, -44)
    shadow(ctx, 6, 0, 3); skull(ctx, 50, 40, 26, { fill: p.color, xEyes: true }); noShadow(ctx)
    ctx.restore()
    if (p.text) {
      ctx.globalAlpha = s > 0.5 ? 1 : 0
      text(ctx, p.text, 50, 89, { size: 18, maxW: 90, fill: '#fff', sw: 5, fam: F_HEAVY })
      ctx.globalAlpha = 1
    }
  }),

  V('yan-bakis', 'Yan Bakış', 'tepki', {
    aspect: 1.6, loop: 2.4, tags: ['göz', 'yan bakış', 'şüpheli', 'side eye'],
    params: [C('color', 'Göz bebeği', '#2B1A0E')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 2.4)
    const look = q < 0.2 ? 0 : q < 0.3 ? -seg(q, 0.2, 0.3) : q < 0.6 ? -1 : q < 0.7 ? -1 + 2 * seg(q, 0.6, 0.7) : q < 0.9 ? 1 : 1 - seg(q, 0.9, 1)
    const blink = q > 0.45 && q < 0.5 ? 1 - Math.sin(seg(q, 0.45, 0.5) * Math.PI) : 1
    for (const sx of [-1, 1]) {
      const cx = W / 2 + sx * 30, cy = 54
      ctx.save()
      shadow(ctx, 5, 0, 2)
      ctx.beginPath(); ctx.ellipse(cx, cy, 24, 30 * blink, 0, 0, TAU); ctx.fillStyle = '#fbfbf8'; ctx.fill(); noShadow(ctx)
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke()
      ctx.clip()
      const px = cx + look * 11, py = cy + 4
      ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.fillStyle = p.color; ctx.fill()
      ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fillStyle = '#000'; ctx.fill()
      ctx.beginPath(); ctx.arc(px - 4, py - 4, 3, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill()
      ctx.restore()
      ctx.beginPath(); ctx.moveTo(cx - 22, 18 + (sx > 0 ? 4 : 0) - look * sx * 2); ctx.quadraticCurveTo(cx, 10, cx + 22, 18 + (sx < 0 ? 4 : 0) + look * sx * 2)
      ctx.lineWidth = 5.5; ctx.strokeStyle = INK; ctx.stroke()
    }
  }),

  V('konfeti', 'Konfeti', 'tepki', {
    loop: 2.2, tags: ['konfeti', 'kutlama', 'parti', 'tebrikler'],
    params: [C('color', 'Renk 1', '#FF2D87'), C('color2', 'Renk 2', '#E4FF3A'), C('color3', 'Renk 3', '#3FA9F5')],
  }, (ctx, t, p) => {
    const q = phase(t, 2.2) * 2.2
    const R = rng(11)
    const cols = [p.color, p.color2, p.color3, '#FFFFFF', '#FFC93C', '#2EE6A6']
    for (let i = 0; i < 70; i++) {
      const side = i % 2 ? 1 : -1
      const vx = -side * (15 + R() * 90), vy = -(110 + R() * 110)
      const tt = q - R() * 0.15
      if (tt < 0) continue
      const drag = Math.exp(-tt * 2)
      const x = 50 + side * 48 + vx * (1 - drag) / 2 + Math.sin(tt * 6 + i) * 3 * tt
      const y = 100 + vy * (1 - drag) / 2 + 22 * tt * tt
      const s = 2.2 + R() * 2.4, spin = tt * (6 + R() * 8) + i
      ctx.globalAlpha = 1 - seg(tt, 1.6, 2.1)
      ctx.fillStyle = cols[i % cols.length]
      ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.scale(1, Math.cos(spin * 1.7))
      if (i % 4 === 0) { ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill() } else ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }),

  V('havai-fisek', 'Havai Fişek', 'tepki', {
    loop: 2.4, tags: ['havai fişek', 'kutlama', 'yeni yıl', 'fireworks'],
    params: [C('color', 'Renk 1', '#FF2D87'), C('color2', 'Renk 2', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 2.4) * 2.4
    const shots = [[34, 34, 0, p.color], [68, 28, 0.7, p.color2], [52, 50, 1.3, '#3FA9F5']]
    for (const [x, y, d, col] of shots) {
      const u = q - d
      if (u < 0) continue
      if (u < 0.4) {
        const k = ease.out(u / 0.4)
        const yy = lerp(100, y, k)
        ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(x, yy + 14); ctx.lineTo(x, yy); ctx.stroke()
        glowDot(ctx, x, yy, 4, '#fff', 1)
      } else {
        const k = seg(u, 0.4, 1.4)
        if (k >= 1) continue
        const r = ease.out3(k) * 26
        ctx.globalAlpha = 1 - ease.in(k)
        if (k < 0.15) glowDot(ctx, x, y, 16, '#fff', 1 - k / 0.15)
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU, gy = k * k * 8
          const x1 = x + Math.cos(a) * r, y1 = y + Math.sin(a) * r + gy
          const x0 = x + Math.cos(a) * r * 0.55, y0 = y + Math.sin(a) * r * 0.55 + gy * 0.5
          ctx.strokeStyle = col; ctx.lineWidth = 2
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
          ctx.beginPath(); ctx.arc(x1, y1, 1.6, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    }
  }),

  V('kizarma', 'Utanma (Kızarma)', 'tepki', {
    aspect: 2, loop: 1.6, tags: ['utanma', 'kızarma', 'anime', 'sevimli'],
    params: [C('color', 'Renk', '#FF7A9C')],
  }, (ctx, t, p, W) => {
    const a = 0.75 + Math.sin(t * 4) * 0.25
    for (const sx of [-1, 1]) {
      const cx = W / 2 + sx * 55, cy = 50
      ctx.fillStyle = rad(ctx, cx, cy, 2, 30, [rgba(p.color, 0.85 * a), rgba(p.color, 0)])
      ctx.beginPath(); ctx.ellipse(cx, cy, 32, 20, 0, 0, TAU); ctx.fill()
      ctx.strokeStyle = rgba(darken(p.color, 0.35), a); ctx.lineWidth = 3.5
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 11 - 5, cy + 8); ctx.lineTo(cx + i * 11 + 5, cy - 8); ctx.stroke() }
    }
  }),
]
