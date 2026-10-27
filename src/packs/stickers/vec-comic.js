// Çizgi roman patlamaları ve konuşma balonları — yazılar düzenlenebilir
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, shadow, noShadow, lighten, darken, rgba, lin, rad, rr, poly,
  text, textBlock, burstPts, starPts, cloud, bubble, rng, hash, INK, F_COMIC, F_HEAVY, F_UI,
} from './kit.js'
import { V, C, T, N } from './vdef.js'

// yarım ton noktaları (kırpılmış alanın içine)
function halftone(ctx, cx, cy, r, color, a = 0.22, step = 5) {
  ctx.fillStyle = rgba(color, a)
  for (let y = cy - r; y < cy + r; y += step) for (let x = cx - r * 1.6; x < cx + r * 1.6; x += step) {
    const d = Math.hypot((x - cx) / 1.6, y - cy) / r
    const s = (1 - d) * step * 0.42
    if (s > 0.2) { ctx.beginPath(); ctx.arc(x + ((y / step) % 2) * step * 0.5, y, s, 0, TAU); ctx.fill() }
  }
}

// tek parça çizgi roman patlaması
function comic(style) {
  return (ctx, t, p, W) => {
    const cx = W / 2, cy = 50
    const s = popIn(t, 0.32) * (1 + Math.sin(t * 9) * 0.02)
    const rot = Math.sin(t * 5) * 0.025 + (style.tilt || -0.06)
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(rot); ctx.translate(-cx, -cy)
    const c1 = p.color, c2 = p.color2
    const flick = Math.floor(t * 10)
    if (style.kind === 'cloud') {
      shadow(ctx, 8, 0, 4)
      ctx.beginPath(); cloud(ctx, cx, cy, W * 0.4, 38, 11, 4 + (flick % 2), 0.32)
      ctx.fillStyle = INK; ctx.fill(); noShadow(ctx)
      ctx.beginPath(); cloud(ctx, cx, cy, W * 0.4 - 4, 34, 11, 4 + (flick % 2), 0.3)
      ctx.fillStyle = rad(ctx, cx, cy, 4, W * 0.42, [lighten(c1, 0.5), c1, c2]); ctx.fill()
      ctx.save(); ctx.clip(); halftone(ctx, cx, cy, 44, '#000', 0.14, 5); ctx.restore()
    } else {
      const n = style.n || 14
      const outer = burstPts(cx, cy, n, W * 0.47, W * 0.3, 7 + (flick % 3), t * 0.2, style.jit ?? 0.24)
      const inner = burstPts(cx, cy, n, W * 0.38, W * 0.24, 7 + (flick % 3), t * 0.2 + 0.05, style.jit ?? 0.24)
      shadow(ctx, 8, 0, 4)
      ctx.beginPath(); poly(ctx, outer.map(([x, y]) => [cx + (x - cx) * 1, cy + (y - cy) * (90 / W)]))
      ctx.fillStyle = c2; ctx.fill(); noShadow(ctx)
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke()
      ctx.beginPath(); poly(ctx, inner.map(([x, y]) => [x, cy + (y - cy) * (90 / W)]))
      ctx.fillStyle = rad(ctx, cx, cy, 2, W * 0.4, [lighten(c1, 0.55), c1, darken(c1, 0.1)]); ctx.fill()
      ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke()
      ctx.save(); ctx.clip(); halftone(ctx, cx, cy, 40, darken(c1, 0.6), 0.25, 4.5); ctx.restore()
      if (style.bolts) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4
        const R = rng(flick)
        for (let i = 0; i < 4; i++) {
          const a = R() * TAU, r0 = 30, r1 = 46
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.9)
          ctx.lineTo(cx + Math.cos(a + 0.12) * (r0 + 8), cy + Math.sin(a + 0.12) * (r0 + 8) * 0.9)
          ctx.lineTo(cx + Math.cos(a - 0.05) * (r0 + 10), cy + Math.sin(a - 0.05) * (r0 + 10) * 0.9)
          ctx.lineTo(cx + Math.cos(a + 0.06) * r1, cy + Math.sin(a + 0.06) * r1 * 0.9)
          ctx.stroke()
        }
      }
    }
    // yazı
    const jx = (hash(flick) - 0.5) * 1.2, jy = (hash(flick + 9) - 0.5) * 1.2
    text(ctx, p.text, cx + jx, cy + 2 + jy, {
      size: 40, maxW: W * 0.62, fam: F_COMIC, fill: lin(ctx, 0, 30, 0, 70, [p.textColor, darken(p.textColor, 0.25)]),
      sw: 7, stroke: INK, extrude: 4, extrudeColor: INK,
    })
  }
}

const burstDef = (id, name, txt, c1, c2, txtc, style, tags) => V(id, name, 'cizgi-roman', {
  aspect: 1.3, loop: 2, tags: ['çizgi roman', 'patlama', ...tags],
  params: [T('text', 'Yazı', txt), C('color', 'İç renk', c1), C('color2', 'Dış renk', c2), C('textColor', 'Yazı rengi', txtc)],
}, comic(style))

// konuşma balonları
function speech(ctx, t, p, W, kind) {
  const s = popIn(t, 0.35)
  const bob = Math.sin(t * 2.4) * 1.2
  ctx.translate(W / 2, 50 + bob); ctx.scale(s, s); ctx.translate(-W / 2, -50)
  const cx = W / 2, cy = 44, rx = W * 0.44, ry = 34
  const shape = () => {
    if (kind === 'oval') { ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.moveTo(cx - rx * 0.42, cy + ry * 0.7); ctx.lineTo(cx - rx * 0.62, 96); ctx.lineTo(cx - rx * 0.12, cy + ry * 0.9) }
    else if (kind === 'shout') { poly(ctx, burstPts(cx, cy, 13, rx, rx * 0.78, 3, 0, 0.12).map(([x, y]) => [x, cy + (y - cy) * (ry / rx) * 1.08])); ctx.moveTo(cx - 18, cy + 24); ctx.lineTo(cx - 34, 98); ctx.lineTo(cx + 2, cy + 26) }
    else if (kind === 'think') {
      cloud(ctx, cx, cy - 2, rx * 0.92, ry * 0.86, 10, 5, 0.24)
      ctx.moveTo(cx - rx * 0.5 + 7, 84); ctx.arc(cx - rx * 0.5, 84, 7, 0, TAU)
      ctx.moveTo(cx - rx * 0.66 + 4, 95); ctx.arc(cx - rx * 0.66, 95, 4, 0, TAU)
    }
  }
  shadow(ctx, 6, 0, 3)
  ctx.beginPath(); shape(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke()
  noShadow(ctx)
  ctx.beginPath(); shape(); ctx.fillStyle = p.color; ctx.fill()
  textBlock(ctx, p.text, cx, cy, rx * 1.35, ry * 1.25, { size: 24, fam: kind === 'shout' ? F_COMIC : F_HEAVY, fill: p.textColor })
}

export default [
  burstDef('pow', 'POW!', 'POW!', '#FFE14D', '#FF3B30', '#FFFFFF', { n: 13 }, ['pow', 'vuruş']),
  burstDef('bum', 'BUM!', 'BUM!', '#FFB020', '#E2261C', '#FFF4C2', { kind: 'cloud', tilt: 0.04 }, ['boom', 'patlama', 'bomba']),
  burstDef('wow', 'WOW!', 'WOW!', '#FF7AD9', '#7B2FF7', '#FFFFFF', { n: 16, jit: 0.15 }, ['wow', 'vay']),
  burstDef('bam', 'BAM!', 'BAM!', '#5CE1FF', '#1749FF', '#FFFFFF', { n: 12 }, ['bam', 'vuruş']),
  burstDef('zap', 'ZAP!', 'ZAP!', '#E4FF3A', '#00B3FF', '#FFFFFF', { n: 18, jit: 0.3, bolts: true }, ['zap', 'elektrik', 'şimşek']),
  burstDef('omg', 'OMG!', 'OMG!', '#FFE14D', '#FF2D87', '#FFFFFF', { n: 15 }, ['omg', 'şok']),
  burstDef('gum', 'GÜM!', 'GÜM!', '#FFD23F', '#1B1D24', '#FFFFFF', { n: 11, jit: 0.3 }, ['güm', 'darbe']),
  burstDef('yok-artik', 'YOK ARTIK!', 'YOK ARTIK!', '#FFFFFF', '#FF3B30', '#FF3B30', { n: 17, jit: 0.12 }, ['şok', 'inanılmaz']),
  burstDef('eyvah', 'EYVAH!', 'EYVAH!', '#B8FF5C', '#0E9F4F', '#FFFFFF', { kind: 'cloud', tilt: -0.03 }, ['eyvah', 'eyvah eyvah']),
  burstDef('kaboom', 'KABOOM!', 'KABOOM!', '#FFC23D', '#8B1A1A', '#FFE9A8', { kind: 'cloud', tilt: 0.05 }, ['kaboom', 'patlama']),

  V('hiz-cizgileri', 'Hız Çizgileri', 'cizgi-roman', {
    aspect: 16 / 9, loop: 1, tags: ['anime', 'hız', 'odak', 'çizgi'],
    params: [C('color', 'Renk', '#FFFFFF'), N('center', 'Boş merkez', 55, 20, 90, 1), N('density', 'Yoğunluk', 70, 20, 140, 1)],
  }, (ctx, t, p, W, H) => {
    const R = rng(Math.floor(t * 12) + 1)
    const cx = W / 2, cy = H / 2, n = Math.round(+p.density)
    const r0 = (+p.center / 100) * Math.min(W, H) * 0.75
    ctx.fillStyle = p.color
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (R() - 0.5) * 0.08
      const ri = r0 * (0.9 + R() * 0.5), ro = Math.hypot(W, H)
      const wd = 0.012 + R() * 0.02
      ctx.globalAlpha = 0.55 + R() * 0.45
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri)
      ctx.lineTo(cx + Math.cos(a - wd) * ro, cy + Math.sin(a - wd) * ro)
      ctx.lineTo(cx + Math.cos(a + wd) * ro, cy + Math.sin(a + wd) * ro)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1
  }),

  V('konusma-balonu', 'Konuşma Balonu', 'balon', {
    aspect: 1.5, loop: 3, tags: ['balon', 'konuşma', 'diyalog'],
    params: [T('text', 'Yazı', 'Merhaba!'), C('color', 'Balon', '#FFFFFF'), C('textColor', 'Yazı rengi', '#0D0D12')],
  }, (ctx, t, p, W) => speech(ctx, t, p, W, 'oval')),

  V('dusunce-balonu', 'Düşünce Balonu', 'balon', {
    aspect: 1.5, loop: 3, tags: ['balon', 'düşünce', 'hmm'],
    params: [T('text', 'Yazı', 'Hmm...'), C('color', 'Balon', '#FFFFFF'), C('textColor', 'Yazı rengi', '#0D0D12')],
  }, (ctx, t, p, W) => speech(ctx, t, p, W, 'think')),

  V('bagirma-balonu', 'Bağırma Balonu', 'balon', {
    aspect: 1.5, loop: 3, tags: ['balon', 'bağır', 'kızgın'],
    params: [T('text', 'Yazı', 'NE?!'), C('color', 'Balon', '#FFFFFF'), C('textColor', 'Yazı rengi', '#E2261C')],
  }, (ctx, t, p, W) => { ctx.translate(Math.sin(t * 50) * 0.6, 0); speech(ctx, t, p, W, 'shout') }),

  V('mesaj-balonu', 'Sohbet Mesajı', 'balon', {
    aspect: 2.2, loop: 4, tags: ['mesaj', 'sohbet', 'chat', 'dm'],
    params: [T('text', 'Yazı', 'gg kolaydı'), C('color', 'Balon', '#2F7BFF'), C('textColor', 'Yazı rengi', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 4) * 4
    ctx.globalAlpha = 1 - seg(q, 3.7, 4)
    if (q < 1.1) {
      const s = popIn(q, 0.3)
      ctx.save(); ctx.translate(W - 60, 50); ctx.scale(s, s); ctx.translate(-(W - 60), -50)
      ctx.beginPath(); rr(ctx, W - 104, 30, 82, 40, 20); ctx.fillStyle = '#E6E8EE'; ctx.fill()
      for (let i = 0; i < 3; i++) {
        const k = Math.max(0, Math.sin((q * 2.5 - i * 0.2) * TAU))
        ctx.beginPath(); ctx.arc(W - 82 + i * 19, 50 - k * 4, 5.5, 0, TAU); ctx.fillStyle = k > 0.2 ? '#7c8190' : '#a3a8b4'; ctx.fill()
      }
      ctx.restore()
    } else {
      const s = popIn(q, 0.3, 1.1)
      ctx.font = `800 22px ${F_UI}`
      const tw = Math.min(W - 40, ctx.measureText(p.text).width + 40)
      ctx.save(); ctx.translate(W - 14, 72); ctx.scale(s, s); ctx.translate(-(W - 14), -72)
      shadow(ctx, 6, 0, 2, 'rgba(0,0,0,0.3)')
      ctx.beginPath(); rr(ctx, W - 14 - tw, 26, tw, 46, 22)
      ctx.moveTo(W - 30, 60); ctx.quadraticCurveTo(W - 14, 72, W - 6, 74); ctx.quadraticCurveTo(W - 26, 76, W - 42, 68)
      ctx.fillStyle = lin(ctx, 0, 26, 0, 74, [lighten(p.color, 0.12), p.color]); ctx.fill(); noShadow(ctx)
      text(ctx, p.text, W - 14 - tw / 2, 50, { size: 22, maxW: tw - 28, fill: p.textColor, weight: 800, fam: F_UI })
      ctx.restore()
      ctx.globalAlpha *= seg(q, 1.4, 1.7)
      text(ctx, 'İletildi', W - 18, 88, { size: 11, fill: '#9aa0ad', align: 'right', weight: 600, fam: F_UI, sw: 3, stroke: 'rgba(0,0,0,0.5)' })
    }
    ctx.globalAlpha = 1
  }),

  V('kutu-balon', 'Anlatıcı Kutusu', 'balon', {
    aspect: 2.4, loop: 3, tags: ['anlatıcı', 'kutu', 'çizgi roman', 'bu arada'],
    params: [T('text', 'Yazı', 'BU ARADA...'), C('color', 'Kutu', '#FFE14D'), C('textColor', 'Yazı rengi', '#0D0D12')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.rotate(-0.03); ctx.translate(-W / 2, -50)
    shadow(ctx, 0, 5, 5, INK)
    ctx.beginPath(); ctx.rect(14, 18, W - 28, 64); ctx.fillStyle = p.color; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke()
    textBlock(ctx, p.text, W / 2, 50, W - 60, 50, { size: 30, fam: F_COMIC, fill: p.textColor })
  }),

  V('fisilti-balonu', 'Fısıltı Balonu', 'balon', {
    aspect: 1.5, loop: 3, tags: ['fısıltı', 'gizli', 'balon', 'psst'],
    params: [T('text', 'Yazı', 'psst...'), C('color', 'Balon', '#FFFFFF'), C('textColor', 'Yazı rengi', '#3A3D48')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    const cx = W / 2
    ctx.beginPath(); ctx.ellipse(cx, 44, W * 0.43, 33, 0, 0, TAU); ctx.fillStyle = rgba(p.color, 0.94); ctx.fill()
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 8; ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + 22, 74); ctx.lineTo(cx + 40, 96); ctx.lineTo(cx + 40, 72); ctx.stroke()
    ctx.setLineDash([])
    textBlock(ctx, p.text, cx, 44, W * 0.6, 40, { size: 22, fill: p.textColor, weight: 700, fam: F_UI })
  }),
]
