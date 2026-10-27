// Oklar ve işaretler — kavisli ok, zıplayan ok, işaret eden el, karalama daire, alt çizgi…
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, shadow, noShadow, lighten, darken, rgba, lin, rr, poly,
  text, bez, marker, wobble, circlePts, rng, INK, F_HEAVY,
} from './kit.js'
import { V, C, T, N } from './vdef.js'

const drawP = (t, loop, d = 0.6) => ease.inOut(seg(phase(t, loop) * loop, 0.05, 0.05 + d))

export default [
  V('ok-kavisli', 'Kavisli Ok', 'ok', {
    aspect: 2, loop: 2.5, tags: ['ok', 'arrow', 'kavis', 'işaret'],
    params: [C('color', 'Renk', '#FF3B30'), N('width', 'Kalınlık', 7, 2, 16, 0.5)],
  }, (ctx, t, p) => {
    const pts = wobble(bez([18, 82], [40, 10], [120, 96], [178, 26], 70), 0.6, 4)
    marker(ctx, pts, drawP(t, 2.5), p.color, +p.width, { head: 16 })
  }),

  V('ok-dalgali', 'Dalgalı Ok', 'ok', {
    aspect: 2.4, loop: 2.5, tags: ['ok', 'dalga', 'arrow'],
    params: [C('color', 'Renk', '#E4FF3A'), N('width', 'Kalınlık', 7, 2, 16, 0.5)],
  }, (ctx, t, p) => {
    const pts = []
    for (let i = 0; i <= 90; i++) { const x = 16 + i * 2.2; pts.push([x, 50 + Math.sin(i / 90 * TAU * 1.75) * 20 * (1 - i / 140)]) }
    marker(ctx, pts, drawP(t, 2.5, 0.7), p.color, +p.width, { head: 15 })
  }),

  V('ok-donus', 'Kıvrık Ok', 'ok', {
    aspect: 2, loop: 2.8, tags: ['ok', 'döngü', 'kıvrım', 'arrow'],
    params: [C('color', 'Renk', '#3FA9F5'), N('width', 'Kalınlık', 7, 2, 16, 0.5)],
  }, (ctx, t, p) => {
    const pts = [
      ...bez([14, 76], [50, 80], [96, 70], [104, 44], 30),
      ...bez([104, 44], [110, 18], [72, 14], [76, 42], 24).slice(1),
      ...bez([76, 42], [80, 72], [140, 82], [184, 50], 34).slice(1),
    ]
    marker(ctx, pts, drawP(t, 2.8, 0.8), p.color, +p.width, { head: 15 })
  }),

  V('ok-ziplayan', 'Zıplayan Ok', 'ok', {
    aspect: 0.8, loop: 0.9, tags: ['ok', 'aşağı', 'zıpla', 'arrow'],
    params: [C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 0.9)
    const b = Math.abs(Math.sin(q * Math.PI))
    const squash = 1 - (1 - b) * 0.08
    const cx = W / 2, y0 = 8 + (1 - b) * 0 + b * -0 + (1 - b) * 12
    ctx.save(); ctx.translate(cx, 92); ctx.scale(1 / squash, squash); ctx.translate(-cx, -92)
    ctx.translate(0, -b * 10 + 4)
    const pts = [[cx - 13, y0], [cx + 13, y0], [cx + 13, y0 + 42], [cx + 32, y0 + 42], [cx, y0 + 78], [cx - 32, y0 + 42], [cx - 13, y0 + 42]]
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); poly(ctx, pts.map(([x, y]) => [x + 3, y + 3])); ctx.fillStyle = darken(p.color, 0.55); ctx.fill()
    noShadow(ctx)
    ctx.beginPath(); poly(ctx, pts)
    ctx.fillStyle = lin(ctx, cx - 30, 0, cx + 30, 0, [lighten(p.color, 0.35), p.color, darken(p.color, 0.2)]); ctx.fill()
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.restore()
  }),

  V('isaret-eden-el', 'İşaret Eden El', 'ok', {
    aspect: 1.5, loop: 1, tags: ['el', 'parmak', 'işaret', 'tıkla'],
    params: [C('color', 'Eldiven', '#FFFFFF')],
  }, (ctx, t, p) => {
    const q = phase(t, 1)
    const push = Math.sin(q * TAU) * 0.5 + 0.5
    ctx.translate(-8 + push * 12, 0)
    const fill = lin(ctx, 0, 30, 0, 82, [p.color, darken(p.color, 0.13)])
    const part = (fn) => { ctx.beginPath(); fn(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke() }
    shadow(ctx, 6, 2, 3)
    ctx.beginPath(); rr(ctx, 26, 36, 46, 44, 13); ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fill()
    noShadow(ctx)
    // manşet
    part(() => rr(ctx, 12, 34, 18, 50, 4))
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 1.4
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(16 + i * 5, 39); ctx.lineTo(16 + i * 5, 79); ctx.stroke() }
    // avuç + kıvrık parmaklar
    part(() => rr(ctx, 26, 38, 44, 42, 12))
    part(() => rr(ctx, 56, 52, 24, 11, 5.5))
    part(() => rr(ctx, 56, 61, 22, 11, 5.5))
    part(() => rr(ctx, 54, 70, 18, 10, 5))
    // başparmak
    ctx.save(); ctx.translate(44, 40); ctx.rotate(-0.55)
    part(() => rr(ctx, -6, -18, 13, 24, 6.5))
    ctx.restore()
    // işaret parmağı
    part(() => rr(ctx, 50, 38, 80, 15, 7.5))
    ctx.beginPath(); ctx.moveTo(118, 42); ctx.quadraticCurveTo(124, 45.5, 118, 49); ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 1.4; ctx.stroke()
    // hareket çizgileri
    if (push > 0.75) {
      ctx.strokeStyle = rgba('#ffffff', (push - 0.75) * 4); ctx.lineWidth = 3
      for (const [a, b, c, d] of [[136, 34, 144, 28], [138, 45.5, 148, 45.5], [136, 57, 144, 63]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke() }
    }
  }),

  V('daire-karalama', 'Daire Karalama', 'ok', {
    aspect: 2, loop: 2.5, tags: ['daire', 'vurgula', 'karalama', 'işaretle'],
    params: [C('color', 'Renk', '#FF3B30'), N('width', 'Kalınlık', 6, 2, 16, 0.5)],
  }, (ctx, t, p, W) => {
    const pts = []
    const R = rng(9)
    for (let i = 0; i <= 120; i++) {
      const a = -2.2 + (i / 120) * (TAU * 1.12)
      const k = 1 + Math.sin(i * 0.11) * 0.03 + (R() - 0.5) * 0.008
      pts.push([W / 2 + Math.cos(a) * 84 * k + i * 0.04, 50 + Math.sin(a) * 36 * k - i * 0.03])
    }
    marker(ctx, pts, drawP(t, 2.5, 0.65), p.color, +p.width, { ow: 3 })
  }),

  V('alt-cizgi', 'Alt Çizgi Karalama', 'ok', {
    aspect: 3.2, loop: 2.5, tags: ['alt çizgi', 'vurgula', 'karalama', 'underline'],
    params: [C('color', 'Renk', '#E4FF3A'), N('width', 'Kalınlık', 7, 2, 16, 0.5)],
  }, (ctx, t, p) => {
    const pts = [...bez([12, 46], [100, 36], [200, 40], [300, 34], 40), ...bez([300, 34], [240, 48], [120, 58], [40, 64], 40).slice(1)]
    marker(ctx, wobble(pts, 0.8, 3), drawP(t, 2.5, 0.55), p.color, +p.width, { ow: 3 })
  }),

  V('carpi-isareti', 'Çarpı (Yanlış)', 'ok', {
    loop: 2.5, tags: ['yanlış', 'çarpı', 'hayır', 'x'], params: [C('color', 'Renk', '#FF3B30'), N('width', 'Kalınlık', 10, 3, 20, 0.5)],
  }, (ctx, t, p) => {
    const q = phase(t, 2.5) * 2.5
    const a = wobble(bez([20, 18], [40, 40], [62, 64], [82, 84], 20), 0.6, 2), b = wobble(bez([80, 16], [60, 40], [38, 62], [18, 86], 20), 0.6, 5)
    marker(ctx, a, ease.inOut(seg(q, 0.05, 0.3)), p.color, +p.width)
    marker(ctx, b, ease.inOut(seg(q, 0.32, 0.57)), p.color, +p.width)
  }),

  V('tik-isareti', 'Tik (Doğru)', 'ok', {
    loop: 2.5, tags: ['doğru', 'tik', 'onay', 'evet'], params: [C('color', 'Renk', '#2EE66B'), N('width', 'Kalınlık', 10, 3, 20, 0.5)],
  }, (ctx, t, p) => {
    const pts = wobble([...bez([14, 52], [22, 58], [30, 66], [38, 78], 12), ...bez([38, 78], [52, 56], [68, 34], [88, 16], 24).slice(1)], 0.5, 3)
    marker(ctx, pts, drawP(t, 2.5, 0.45), p.color, +p.width)
  }),

  V('ok-kayan', 'Kayan Oklar', 'ok', {
    aspect: 2.2, loop: 1, tags: ['ok', 'ileri', 'kaydır', 'chevron'], params: [C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 1)
    for (let i = 0; i < 3; i++) {
      const a = clamp(1 - Math.abs(((q * 3 - i) % 3 + 3) % 3 - 0.5) * 0.9, 0.18, 1)
      const x = 40 + i * 58 + Math.sin(q * TAU) * 3
      ctx.beginPath(); ctx.moveTo(x - 16, 18); ctx.lineTo(x + 18, 50); ctx.lineTo(x - 16, 82)
      ctx.strokeStyle = INK; ctx.lineWidth = 19; ctx.globalAlpha = Math.max(0.35, a); ctx.stroke()
      ctx.strokeStyle = p.color; ctx.lineWidth = 13; ctx.globalAlpha = a; ctx.stroke()
    }
    ctx.globalAlpha = 1
  }),

  V('hedef-halka', 'Buraya Bak', 'ok', {
    loop: 1.4, tags: ['hedef', 'buraya bak', 'vurgu', 'odak'],
    params: [T('text', 'Yazı', 'BURAYA BAK'), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.4)
    for (let i = 0; i < 3; i++) {
      const k = (q + i / 3) % 1
      ctx.beginPath(); ctx.arc(50, 42, 8 + k * 32, 0, TAU)
      ctx.strokeStyle = rgba(p.color, 1 - k); ctx.lineWidth = 3.5 * (1 - k) + 0.5; ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(50, 42, 7, 0, TAU); ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke()
    text(ctx, p.text, 50, 88, { size: 13, maxW: 92, fill: p.color, sw: 4 })
  }),
]
