// Şekiller (çizilerek görünür), çerçeveler/kamera, alt bantlar, ilerleme çubukları
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, tri, shadow, noShadow, lighten, darken, rgba, lin, rad, rr, poly,
  starPts, heartPts, circlePts, rrPts, polyPartial, arrowHead, text, glossy, glowDot, sparkle, burstPts, rng, hash,
  INK, F_HEAVY, F_DISPLAY, F_UI, F_MONO,
} from './kit.js'
import { V, C, T, N } from './vdef.js'

// ------------------------------------------------------------ şekiller
const shapeParams = (fillOp, stroke, fill = '#E4FF3A', col = '#0D0D12') => [
  C('fill', 'Dolgu', fill), N('fillOpacity', 'Dolgu opaklığı', fillOp, 0, 100, 1),
  C('color', 'Kontur', col), N('stroke', 'Kontur kalınlığı', stroke, 0, 24, 0.5),
  N('draw', 'Çizim süresi (sn)', 0.6, 0, 3, 0.1),
]
function shapeDraw(ptsFn, { closed = true, head = false } = {}) {
  return (ctx, t, p, W, H) => {
    const sw = +p.stroke, d = +p.draw
    const inset = sw / 2 + (head ? sw * 1.6 : 0) + 1
    const pts = ptsFn(W, H, inset)
    const pr = d > 0 ? ease.inOut(seg(t, 0, d)) : 1
    const fa = (+p.fillOpacity / 100) * (d > 0 ? (sw > 0 ? seg(t, d * 0.6, d) : 1) : 1)
    const grow = d > 0 && sw <= 0 ? ease.outBack(seg(t, 0, Math.max(0.2, d))) : 1
    ctx.save()
    if (grow !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(grow, grow); ctx.translate(-W / 2, -H / 2) }
    if (closed && fa > 0) { ctx.beginPath(); poly(ctx, pts); ctx.globalAlpha = fa; ctx.fillStyle = p.fill; ctx.fill(); ctx.globalAlpha = 1 }
    if (sw > 0) {
      ctx.beginPath()
      const e = polyPartial(ctx, pts, pr)
      if (head && e) arrowHead(ctx, e[0], e[1], e[2], sw * 2.6)
      ctx.lineWidth = sw; ctx.strokeStyle = p.color; ctx.stroke()
    }
    ctx.restore()
  }
}
const S = (id, name, aspect, params, fn, opts, tags) => V(id, name, 'sekil', { kind: 'shape', aspect, loop: 3, params, tags: ['şekil', ...tags] }, shapeDraw(fn, opts))

const shapes = [
  S('sekil-daire', 'Daire', 1, shapeParams(100, 0), (W, H, i) => circlePts(W / 2, H / 2, W / 2 - i), {}, ['daire', 'yuvarlak']),
  S('sekil-halka', 'Halka', 1, shapeParams(0, 8, '#E4FF3A', '#E4FF3A'), (W, H, i) => circlePts(W / 2, H / 2, W / 2 - i), {}, ['halka', 'çember']),
  S('sekil-elips', 'Elips', 1.6, shapeParams(0, 6, '#ffffff', '#FF3B30'), (W, H, i) => circlePts(W / 2, H / 2, W / 2 - i, H / 2 - i), {}, ['elips', 'oval']),
  S('sekil-dikdortgen', 'Dikdörtgen', 1.6, shapeParams(100, 0, '#3FA9F5'), (W, H, i) => rrPts(i, i, W - 2 * i, H - 2 * i, 0.001, 1), {}, ['dikdörtgen', 'kutu']),
  S('sekil-yuvarlak-kutu', 'Yuvarlak Köşeli Kutu', 1.6, shapeParams(0, 6, '#ffffff', '#E4FF3A'), (W, H, i) => rrPts(i, i, W - 2 * i, H - 2 * i, 16), {}, ['kutu', 'çerçeve']),
  S('sekil-yildiz', 'Yıldız', 1, shapeParams(100, 0, '#FFD23F'), (W, H, i) => { const pts = starPts(W / 2, H / 2 + 3, 5, H / 2 - i, (H / 2 - i) * 0.45); return [...pts, pts[0]] }, {}, ['yıldız']),
  S('sekil-kalp', 'Kalp', 1, shapeParams(100, 0, '#FF2D55'), (W, H, i) => heartPts(W / 2, H / 2 + 2, H / 2 - i - 2), {}, ['kalp', 'aşk']),
  S('sekil-ucgen', 'Üçgen', 1.1, shapeParams(100, 0, '#2EE6A6'), (W, H, i) => [[W / 2, i], [W - i, H - i], [i, H - i], [W / 2, i]], {}, ['üçgen']),
  S('sekil-altigen', 'Altıgen', 1, shapeParams(0, 6, '#ffffff', '#B98CFF'), (W, H, i) => { const pts = starPts(W / 2, H / 2, 3, H / 2 - i, H / 2 - i, 0); return [...pts, pts[0]] }, {}, ['altıgen', 'peteğe']),
  S('sekil-cizgi', 'Çizgi', 5, [C('color', 'Renk', '#FFFFFF'), N('stroke', 'Kalınlık', 8, 1, 30, 0.5), N('draw', 'Çizim süresi (sn)', 0.5, 0, 3, 0.1), N('fillOpacity', 'Dolgu', 0, 0, 0, 1), C('fill', 'Dolgu', '#ffffff')],
    (W, H, i) => [[i, H / 2], [W - i, H / 2]], { closed: false }, ['çizgi', 'ayraç']),
  S('sekil-ok', 'Düz Ok', 3, [C('color', 'Renk', '#FF3B30'), N('stroke', 'Kalınlık', 7, 1, 20, 0.5), N('draw', 'Çizim süresi (sn)', 0.5, 0, 3, 0.1), N('fillOpacity', 'Dolgu', 0, 0, 0, 1), C('fill', 'Dolgu', '#ffffff')],
    (W, H, i) => [[8, H / 2], [W - i, H / 2]], { closed: false, head: true }, ['ok', 'işaret']),
]

// ------------------------------------------------------------ çerçeve & kamera
function corners(ctx, x, y, w, h, len, color, lw) {
  ctx.beginPath()
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y)
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len)
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h)
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len)
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter'
  ctx.lineWidth = lw + 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke()
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
}
const tc = (t, fps = 30) => {
  const s = Math.floor(t), f = Math.floor((t - s) * fps)
  const p2 = (n) => String(n).padStart(2, '0')
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(f)}`
}
function osd(ctx, t, p, W, H) {
  const m = Math.min(W, H) * 0.07
  const col = p.color
  corners(ctx, m, m, W - 2 * m, H - 2 * m, Math.min(W, H) * 0.12, col, 2.2)
  const fs = Math.min(W, H) * 0.065
  const blink = phase(t, 1) < 0.6
  if (blink) { ctx.beginPath(); ctx.arc(m * 2 + fs * 0.4, m * 2 + fs * 0.45, fs * 0.38, 0, TAU); ctx.fillStyle = '#FF2E3A'; ctx.fill() }
  text(ctx, p.text, m * 2 + fs * 1.1, m * 2 + fs * 0.5, { size: fs, fill: col, align: 'left', fam: F_MONO, weight: 700, sw: 2, stroke: 'rgba(0,0,0,0.5)' })
  text(ctx, tc(t), m * 2, H - m * 2 - fs * 0.4, { size: fs * 0.85, fill: col, align: 'left', fam: F_MONO, weight: 700, sw: 2, stroke: 'rgba(0,0,0,0.5)' })
  text(ctx, '4K  60', W - m * 2, H - m * 2 - fs * 0.4, { size: fs * 0.85, fill: col, align: 'right', fam: F_MONO, weight: 700, sw: 2, stroke: 'rgba(0,0,0,0.5)' })
  // pil
  const bw = fs * 1.6, bh = fs * 0.8, bx = W - m * 2 - bw - fs * 0.25, by = m * 2 + fs * 0.1
  ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.strokeRect(bx, by, bw, bh); ctx.fillStyle = col; ctx.fillRect(bx + bw, by + bh * 0.3, fs * 0.18, bh * 0.4)
  for (let i = 0; i < 3; i++) ctx.fillRect(bx + 2 + i * (bw - 4) / 3, by + 2, (bw - 4) / 3 - 1.5, bh - 4)
  // merkez
  const cs = Math.min(W, H) * 0.05
  ctx.strokeStyle = col; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.moveTo(W / 2 - cs, H / 2); ctx.lineTo(W / 2 + cs, H / 2); ctx.moveTo(W / 2, H / 2 - cs); ctx.lineTo(W / 2, H / 2 + cs); ctx.stroke()
}

const frames = [
  V('kamera-koseleri', 'Kamera Köşeleri', 'cerceve', {
    aspect: 16 / 9, loop: 2, tags: ['köşe', 'kamera', 'çerçeve', 'vizör'],
    params: [C('color', 'Renk', '#FFFFFF'), N('thick', 'Kalınlık', 3, 1, 10, 0.5)],
  }, (ctx, t, p, W, H) => {
    const b = 1 + Math.sin(t * Math.PI) * 0.012
    ctx.translate(W / 2, H / 2); ctx.scale(b, b); ctx.translate(-W / 2, -H / 2)
    corners(ctx, 6, 6, W - 12, H - 12, 22, p.color, +p.thick)
  }),

  V('rec', 'REC Kayıt', 'cerceve', {
    aspect: 3, loop: 1, tags: ['rec', 'kayıt', 'kamera', 'vhs'],
    params: [T('text', 'Yazı', 'REC'), C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    if (phase(t, 1) < 0.6) { glowDot(ctx, 30, 50, 22, '#FF2E3A', 0.5); ctx.beginPath(); ctx.arc(30, 50, 12, 0, TAU); ctx.fillStyle = '#FF2E3A'; ctx.fill() }
    text(ctx, p.text, 52, 51, { size: 30, fill: p.color, align: 'left', fam: F_MONO, weight: 800, sw: 3, stroke: 'rgba(0,0,0,0.5)' })
    text(ctx, tc(t), W - 10, 51, { size: 22, fill: p.color, align: 'right', fam: F_MONO, weight: 700, sw: 3, stroke: 'rgba(0,0,0,0.5)', maxW: W - 130 })
  }),

  V('odak-kutusu', 'Odak Kutusu', 'cerceve', {
    loop: 2.4, tags: ['odak', 'focus', 'kamera', 'hedef'],
    params: [C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 2.4) * 2.4
    const k = ease.out3(seg(q, 0, 0.35))
    const sz = lerp(96, 62, k)
    const on = q < 0.35 || q > 0.9 || Math.floor(q * 12) % 2 === 0
    ctx.globalAlpha = on ? 1 : 0.35
    corners(ctx, 50 - sz / 2, 50 - sz / 2, sz, sz, sz * 0.22, q > 0.9 ? '#3CFF6B' : p.color, 2.6)
    ctx.globalAlpha = 1
    ctx.strokeStyle = q > 0.9 ? '#3CFF6B' : p.color; ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(45, 50); ctx.lineTo(55, 50); ctx.moveTo(50, 45); ctx.lineTo(50, 55); ctx.stroke()
  }),

  V('vizor', 'Kamera Vizörü (Yatay)', 'cerceve', {
    aspect: 16 / 9, loop: 1, tags: ['vizör', 'kamera', 'rec', 'osd', 'vhs'],
    params: [T('text', 'Yazı', 'REC'), C('color', 'Renk', '#FFFFFF')],
  }, osd),

  V('vizor-dikey', 'Kamera Vizörü (Dikey)', 'cerceve', {
    aspect: 9 / 16, loop: 1, tags: ['vizör', 'kamera', 'rec', 'dikey', 'shorts'],
    params: [T('text', 'Yazı', 'REC'), C('color', 'Renk', '#FFFFFF')],
  }, osd),

  V('koseli-parantez', 'Köşeli Parantez', 'cerceve', {
    aspect: 2.2, loop: 2, tags: ['parantez', 'vurgu', 'çerçeve'],
    params: [C('color', 'Renk', '#E4FF3A'), N('thick', 'Kalınlık', 6, 1, 14, 0.5)],
  }, (ctx, t, p, W) => {
    const k = ease.outBack(seg(t, 0, 0.4))
    const off = (1 - k) * 30 + Math.sin(t * 3) * 1.5
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter'
    for (const pass of [0, 1]) {
      ctx.lineWidth = +p.thick + (pass ? 0 : 3); ctx.strokeStyle = pass ? p.color : 'rgba(0,0,0,0.4)'
      ctx.beginPath(); ctx.moveTo(28 - off, 10); ctx.lineTo(10 - off, 10); ctx.lineTo(10 - off, 90); ctx.lineTo(28 - off, 90); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W - 28 + off, 10); ctx.lineTo(W - 10 + off, 10); ctx.lineTo(W - 10 + off, 90); ctx.lineTo(W - 28 + off, 90); ctx.stroke()
    }
  }),

  V('hedef-kilidi', 'Hedef Kilitlendi', 'cerceve', {
    loop: 2.6, tags: ['kilit', 'hedef', 'lock', 'nişan'],
    params: [T('text', 'Yazı', 'KİLİTLENDİ'), C('color', 'Renk', '#E4FF3A'), C('lockColor', 'Kilit rengi', '#FF2E3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 2.6) * 2.6
    const k = ease.inOut(seg(q, 0, 0.9))
    const locked = q > 0.9
    const col = locked ? p.lockColor : p.color
    const r = lerp(46, 26, k)
    ctx.save(); ctx.translate(50, 43); ctx.rotate(locked ? 0 : t * 3)
    ctx.setLineDash([10, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([])
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2)
      ctx.beginPath(); ctx.moveTo(0, -r - 2); ctx.lineTo(-5, -r - 11); ctx.lineTo(5, -r - 11); ctx.closePath(); ctx.fillStyle = col; ctx.fill()
    }
    ctx.restore()
    if (locked) {
      const fl = Math.floor(q * 8) % 2
      ctx.globalAlpha = fl ? 1 : 0.6
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(50 - 16, 43 - 16, 32, 32)
      ctx.globalAlpha = 1
      text(ctx, p.text, 50, 91, { size: 11, maxW: 84, fill: col, fam: F_MONO, weight: 800, sw: 3 })
    }
  }),

  V('tarama-kutusu', 'Tarama Kutusu', 'cerceve', {
    aspect: 1.3, loop: 1.6, tags: ['tarama', 'scan', 'analiz', 'teknoloji'],
    params: [C('color', 'Renk', '#00E5FF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 1.6)
    corners(ctx, 8, 8, W - 16, 84, 16, p.color, 2.6)
    ctx.strokeStyle = rgba(p.color, 0.15); ctx.lineWidth = 1
    for (let x = 16; x < W - 8; x += 10) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 88); ctx.stroke() }
    for (let y = 16; y < 90; y += 10) { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(W - 12, y); ctx.stroke() }
    const y = 12 + tri(q * 2) * 76
    ctx.fillStyle = lin(ctx, 0, y - 14, 0, y, [rgba(p.color, 0), rgba(p.color, 0.35)]); ctx.fillRect(12, y - 14, W - 24, 14)
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(W - 10, y); ctx.stroke()
    text(ctx, 'TARANIYOR %' + Math.floor(q * 100), W - 12, 94.5, { size: 6.5, fill: p.color, align: 'right', fam: F_MONO, weight: 700, sw: 2, stroke: 'rgba(0,0,0,0.5)' })
  }),

  V('film-seridi', 'Film Şeridi', 'cerceve', {
    aspect: 16 / 9, loop: 1, tags: ['film', 'şerit', 'sinema', 'retro'],
    params: [C('color', 'Şerit', '#141416')],
  }, (ctx, t, p, W, H) => {
    const bh = 12
    ctx.fillStyle = p.color; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh)
    const off = (t * 40) % 12
    ctx.fillStyle = 'rgba(240,236,224,0.85)'
    for (let x = -12; x < W + 12; x += 12) {
      ctx.beginPath(); rr(ctx, x - off, 3.5, 6, 5, 1); ctx.fill()
      ctx.beginPath(); rr(ctx, x - off, H - 8.5, 6, 5, 1); ctx.fill()
    }
    ctx.fillStyle = rgba('#E4FF3A', 0.8); ctx.font = `700 3.5px ${F_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillText('SWX 400  ' + (12 + Math.floor(t * 2)) + 'A', 8 - off * 0, H - 0.8)
  }),
]

// ------------------------------------------------------------ alt bantlar & çağrılar
const lower = [
  V('alt-bant-klasik', 'Alt Bant Klasik', 'alt-bant', {
    aspect: 4.5, loop: 5, tags: ['alt bant', 'isim', 'lower third', 'başlık'],
    params: [T('name', 'İsim', 'SWEAX'), T('sub', 'Alt yazı', 'Oyun içerik üreticisi'), C('color', 'Vurgu', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const a = ease.out3(seg(t, 0, 0.3)), b = ease.out3(seg(t, 0.12, 0.55)), c = ease.out3(seg(t, 0.3, 0.7))
    ctx.fillStyle = p.color; ctx.fillRect(10, 22, 10 * a, 56)
    ctx.save(); ctx.beginPath(); ctx.rect(22, 0, (W - 30) * b, 100); ctx.clip()
    shadow(ctx, 8, 0, 3)
    ctx.fillStyle = '#F4F4F0'; ctx.fillRect(22, 22, W * 0.7, 36); noShadow(ctx)
    text(ctx, p.name, 36, 41, { size: 26, maxW: W * 0.7 - 28, fill: '#0d0d12', align: 'left', fam: F_HEAVY })
    ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.rect(22, 0, (W - 30) * c, 100); ctx.clip()
    ctx.fillStyle = 'rgba(14,14,18,0.92)'; ctx.fillRect(22, 58, W * 0.55, 22)
    text(ctx, p.sub, 36, 69.5, { size: 13, maxW: W * 0.55 - 28, fill: '#f0f0f0', align: 'left', fam: F_UI, weight: 700 })
    ctx.restore()
  }),

  V('alt-bant-oyuncu', 'Oyuncu Etiketi', 'alt-bant', {
    aspect: 4.2, loop: 5, tags: ['oyuncu', 'gamer tag', 'kullanıcı', 'alt bant'],
    params: [T('name', 'Kullanıcı adı', '@sweax'), T('sub', 'Alt yazı', 'CANLI YAYINDA'), C('color', 'Vurgu', '#B98CFF')],
  }, (ctx, t, p, W) => {
    const k = ease.out3(seg(t, 0, 0.45))
    ctx.translate(lerp(-W * 0.6, 0, k), 0)
    ctx.globalAlpha = seg(t, 0, 0.2)
    shadow(ctx, 8, 0, 3)
    ctx.beginPath(); poly(ctx, [[14, 20], [W * 0.82, 20], [W * 0.78, 80], [10, 80]]); ctx.fillStyle = lin(ctx, 0, 20, 0, 80, ['#1f2129', '#0c0d11']); ctx.fill(); noShadow(ctx)
    ctx.beginPath(); poly(ctx, [[W * 0.82, 20], [W * 0.82 + 12, 20], [W * 0.78 + 12, 80], [W * 0.78, 80]]); ctx.fillStyle = p.color; ctx.fill()
    ctx.beginPath(); poly(ctx, [[14, 20], [W * 0.82, 20], [W * 0.82 - 1, 23], [13.8, 23]]); ctx.fillStyle = p.color; ctx.fill()
    ctx.beginPath(); rr(ctx, 22, 30, 40, 40, 6); ctx.fillStyle = lin(ctx, 0, 30, 0, 70, [lighten(p.color, 0.2), darken(p.color, 0.3)]); ctx.fill()
    // küçük oyun kolu simgesi
    ctx.fillStyle = '#fff'
    ctx.beginPath(); rr(ctx, 29, 43, 26, 14, 7); ctx.fill()
    ctx.fillStyle = darken(p.color, 0.3); ctx.fillRect(33.5, 48.5, 7, 2.4); ctx.fillRect(35.8, 46.2, 2.4, 7)
    ctx.beginPath(); ctx.arc(48, 48, 1.7, 0, TAU); ctx.arc(51.5, 51.5, 1.7, 0, TAU); ctx.fill()
    text(ctx, p.name, 74, 44, { size: 24, maxW: W * 0.62, fill: '#fff', align: 'left', fam: F_HEAVY })
    const live = phase(t, 1) < 0.6
    ctx.beginPath(); ctx.arc(78, 64, 3.2, 0, TAU); ctx.fillStyle = live ? '#FF2E3A' : '#5a1218'; ctx.fill()
    text(ctx, p.sub, 86, 64.5, { size: 11, maxW: W * 0.6, fill: p.color, align: 'left', fam: F_HEAVY, spacing: 1 })
    ctx.globalAlpha = 1
  }),

  V('alt-bant-neon', 'Neon Alt Bant', 'alt-bant', {
    aspect: 4, loop: 3, tags: ['neon', 'alt bant', 'parlak', 'isim'],
    params: [T('name', 'Yazı', 'SWEAX STUDIOS'), C('color', 'Neon rengi', '#00F0FF')],
  }, (ctx, t, p, W) => {
    const flick = t < 0.6 ? (hash(Math.floor(t * 25)) > 0.45 ? 1 : 0.15) : 0.9 + Math.sin(t * 7) * 0.1
    const glowLine = (lw, a, blur) => {
      shadow(ctx, blur, 0, 0, rgba(p.color, a * flick))
      ctx.lineWidth = lw; ctx.strokeStyle = rgba(lighten(p.color, 0.5), flick)
      ctx.beginPath(); rr(ctx, 14, 22, W - 28, 56, 10); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(5,6,10,0.65)'; ctx.beginPath(); rr(ctx, 14, 22, W - 28, 56, 10); ctx.fill()
    glowLine(3, 1, 14); glowLine(2, 1, 4); noShadow(ctx)
    shadow(ctx, 12, 0, 0, rgba(p.color, flick))
    text(ctx, p.name, W / 2, 51, { size: 30, maxW: W - 70, fill: rgba(lighten(p.color, 0.6), flick), fam: F_HEAVY, spacing: 2 })
    noShadow(ctx)
  }),

  V('alt-bant-sade', 'Sade Alt Bant', 'alt-bant', {
    aspect: 4.5, loop: 4, tags: ['sade', 'minimal', 'alt bant', 'isim'],
    params: [T('name', 'İsim', 'Bölüm 3'), T('sub', 'Alt yazı', 'Son boss savaşı'), C('color', 'Çizgi', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    const k = ease.inOut(seg(t, 0, 0.5))
    ctx.fillStyle = p.color; ctx.fillRect(16, 54, (W * 0.6) * k, 2.5)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 53.5); ctx.clip()
    text(ctx, p.name, 16, 54 - 18 + (1 - ease.out3(seg(t, 0.2, 0.6))) * 30, { size: 30, maxW: W - 40, fill: '#fff', align: 'left', fam: F_HEAVY, sw: 0, sh: 4 })
    ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.rect(0, 57, W, 43); ctx.clip()
    text(ctx, p.sub, 16, 70 - (1 - ease.out3(seg(t, 0.35, 0.75))) * 20, { size: 15, maxW: W - 40, fill: rgba('#ffffff', 0.85), align: 'left', fam: F_UI, weight: 600, sh: 3 })
    ctx.restore()
  }),

  V('bilgi-kutusu', 'Bilgi Çağrısı', 'alt-bant', {
    aspect: 2.2, loop: 3, tags: ['çağrı', 'bilgi', 'callout', 'açıklama'],
    params: [T('text', 'Yazı', 'Gizli geçit burada'), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 3)
    const a = ease.inOut(seg(t, 0.1, 0.4)), b = ease.out3(seg(t, 0.4, 0.75))
    const pr = (q * 3) % 1
    ctx.beginPath(); ctx.arc(18, 84, 5 + pr * 10, 0, TAU); ctx.strokeStyle = rgba(p.color, 1 - pr); ctx.lineWidth = 2; ctx.stroke()
    ctx.beginPath(); ctx.arc(18, 84, 5, 0, TAU); ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke()
    const pts = [[18, 84], [60, 40], [W - 12, 40]]
    ctx.beginPath(); polyPartial(ctx, pts, a); ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke()
    ctx.beginPath(); polyPartial(ctx, pts, a); ctx.lineWidth = 2.5; ctx.strokeStyle = p.color; ctx.stroke()
    ctx.save(); ctx.beginPath(); ctx.rect(60, 0, (W - 72) * b, 40); ctx.clip()
    ctx.fillStyle = 'rgba(12,12,16,0.9)'; ctx.fillRect(60, 10, W - 72, 28)
    ctx.fillStyle = p.color; ctx.fillRect(60, 10, 4, 28)
    text(ctx, p.text, 72, 24.5, { size: 15, maxW: W - 92, fill: '#fff', align: 'left', fam: F_HEAVY })
    ctx.restore()
  }),

  V('etiket-isaret', 'İşaret Etiketi', 'alt-bant', {
    aspect: 1.4, loop: 1.4, tags: ['etiket', 'işaret', 'ben', 'burada'],
    params: [T('text', 'Yazı', 'BEN'), C('color', 'Renk', '#FF2D87')],
  }, (ctx, t, p, W) => {
    const s = popIn(t, 0.35)
    const b = Math.abs(Math.sin(t * Math.PI / 0.7)) * 5
    ctx.translate(W / 2, 90); ctx.scale(s, s); ctx.translate(-W / 2, -90 - b)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); rr(ctx, 14, 14, W - 28, 50, 8); ctx.moveTo(W / 2 - 12, 63); ctx.lineTo(W / 2, 82); ctx.lineTo(W / 2 + 12, 63)
    ctx.fillStyle = lin(ctx, 0, 14, 0, 82, [lighten(p.color, 0.2), darken(p.color, 0.15)]); ctx.fill(); noShadow(ctx)
    text(ctx, p.text, W / 2, 40, { size: 30, maxW: W - 50, fill: '#fff', fam: F_HEAVY, sw: 0 })
  }),

  V('yeni-rozet', 'YENİ Rozeti', 'alt-bant', {
    loop: 6, tags: ['yeni', 'rozet', 'indirim', 'etiket'],
    params: [T('text', 'Yazı', 'YENİ'), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p) => {
    const s = popIn(t, 0.4) * (1 + Math.sin(t * 5) * 0.03)
    ctx.translate(50, 50); ctx.scale(s, s); ctx.rotate(t * 0.4)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); poly(ctx, starPts(0, 0, 16, 44, 37)); ctx.fillStyle = lin(ctx, 0, -44, 0, 44, [lighten(p.color, 0.25), darken(p.color, 0.2)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(p.color, 0.5); ctx.stroke()
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([])
    ctx.rotate(-t * 0.4 - 0.2)
    text(ctx, p.text, 0, 1, { size: 24, maxW: 54, fill: '#fff', fam: F_HEAVY })
  }),

  V('kullanici-adi', 'Kullanıcı Adı', 'alt-bant', {
    aspect: 3.4, loop: 4, tags: ['kullanıcı', 'isim', 'sosyal', '@'],
    params: [T('text', 'Kullanıcı adı', '@sweaxstudios'), C('color', 'Renk', '#FFFFFF'), C('accent', 'Vurgu', '#FF2D87')],
  }, (ctx, t, p, W) => {
    const k = ease.outBack(seg(t, 0, 0.45))
    ctx.translate(W / 2, 50); ctx.scale(k, k); ctx.translate(-W / 2, -50)
    shadow(ctx, 8, 0, 3)
    ctx.beginPath(); rr(ctx, 10, 24, W - 20, 52, 10); ctx.fillStyle = rgba(p.color, 0.96); ctx.fill(); noShadow(ctx)
    ctx.beginPath(); ctx.arc(38, 50, 17, 0, TAU); ctx.fillStyle = lin(ctx, 20, 33, 56, 67, [p.accent, lighten(p.accent, 0.35)]); ctx.fill()
    text(ctx, '@', 38, 49, { size: 22, fill: '#fff', fam: F_HEAVY })
    text(ctx, p.text, 64, 51, { size: 24, maxW: W - 86, fill: '#121318', align: 'left', fam: F_HEAVY })
  }),

  V('baslik-bandi', 'Başlık Bandı', 'alt-bant', {
    aspect: 5, loop: 4, tags: ['başlık', 'bölüm', 'şerit', 'title'],
    params: [T('name', 'Başlık', 'BÖLÜM 1'), T('sub', 'Alt yazı', 'Başlangıç'), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const steps = (x, n) => Math.floor(x * n) / n
    const a = steps(ease.out3(seg(t, 0, 0.35)), 8)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * a, 100); ctx.clip()
    ctx.fillStyle = p.color; ctx.fillRect(0, 26, W, 34)
    for (let x = 6; x < W; x += 14) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x, 28, 6, 3); ctx.fillRect(x, 55, 6, 3) }
    text(ctx, p.name, W / 2, 44, { size: 22, maxW: W - 60, fill: INK, fam: F_HEAVY, spacing: 3 })
    ctx.restore()
    ctx.globalAlpha = seg(t, 0.35, 0.6)
    text(ctx, p.sub, W / 2, 74, { size: 15, maxW: W - 60, fill: '#fff', fam: F_UI, weight: 700, sw: 3, stroke: 'rgba(0,0,0,0.6)' })
    ctx.globalAlpha = 1
  }),
]

// ------------------------------------------------------------ ilerleme
const progress = [
  V('ilerleme-cizgi', 'İlerleme Çubuğu', 'ilerleme', {
    aspect: 5, loop: 3, tags: ['ilerleme', 'yükleme', 'progress', 'bar'],
    params: [T('label', 'Etiket', 'İLERLEME'), N('value', 'Değer %', 100, 0, 100, 1), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const v = clamp(+p.value / 100) * ease.inOut(seg(phase(t, 3) * 3, 0.1, 2))
    text(ctx, p.label, 14, 30, { size: 14, fill: '#fff', align: 'left', fam: F_HEAVY, sw: 3, stroke: 'rgba(0,0,0,0.6)', spacing: 1 })
    text(ctx, '%' + Math.round(v * 100), W - 14, 30, { size: 14, fill: p.color, align: 'right', fam: F_MONO, weight: 800, sw: 3, stroke: 'rgba(0,0,0,0.6)' })
    ctx.fillStyle = 'rgba(10,10,14,0.75)'; ctx.fillRect(14, 46, W - 28, 20)
    ctx.fillStyle = lin(ctx, 14, 0, W - 14, 0, [darken(p.color, 0.3), p.color]); ctx.fillRect(17, 49, (W - 34) * v, 14)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(17, 49, (W - 34) * v, 4)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(14, 46, W - 28, 20)
  }),

  V('ilerleme-daire', 'Dairesel İlerleme', 'ilerleme', {
    loop: 3, tags: ['ilerleme', 'yüzde', 'daire', 'progress'],
    params: [N('value', 'Değer %', 100, 0, 100, 1), C('color', 'Renk', '#2EE6A6')],
  }, (ctx, t, p) => {
    const v = clamp(+p.value / 100) * ease.inOut(seg(phase(t, 3) * 3, 0.1, 2))
    ctx.beginPath(); ctx.arc(50, 50, 40, 0, TAU); ctx.fillStyle = 'rgba(10,10,14,0.8)'; ctx.fill()
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(50, 50, 32, 0, TAU); ctx.stroke()
    ctx.lineCap = 'butt'; ctx.strokeStyle = p.color; ctx.beginPath(); ctx.arc(50, 50, 32, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.stroke(); ctx.lineCap = 'round'
    text(ctx, '%' + Math.round(v * 100), 50, 51, { size: 22, maxW: 50, fill: '#fff', fam: F_HEAVY })
  }),

  V('ilerleme-bolumlu', 'Bölümlü İlerleme', 'ilerleme', {
    aspect: 4, loop: 4, tags: ['adım', 'bölüm', 'ilerleme', 'aşama'],
    params: [N('steps', 'Adım sayısı', 5, 2, 12, 1), N('value', 'Tamamlanan', 3, 0, 12, 1), C('color', 'Renk', '#3FA9F5')],
  }, (ctx, t, p, W) => {
    const n = Math.round(+p.steps), v = Math.min(n, Math.round(+p.value))
    const shown = Math.min(v, Math.floor(seg(phase(t, 4) * 4, 0.1, 0.1 + v * 0.3) * v + 1e-6))
    const gap = 6, sw = (W - 28 - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const x = 14 + i * (sw + gap)
      const on = i < shown
      ctx.beginPath(); rr(ctx, x, 38, sw, 18, 3)
      ctx.fillStyle = on ? lin(ctx, 0, 38, 0, 56, [lighten(p.color, 0.3), p.color]) : 'rgba(10,10,14,0.7)'; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = on ? darken(p.color, 0.4) : 'rgba(255,255,255,0.2)'; ctx.stroke()
    }
    text(ctx, shown + ' / ' + n, W / 2, 76, { size: 15, fill: '#fff', fam: F_MONO, weight: 800, sw: 3, stroke: 'rgba(0,0,0,0.6)' })
  }),

  V('ses-dalgasi', 'Ses Dalgası', 'ilerleme', {
    aspect: 2.4, loop: 2, tags: ['ses', 'ekolayzer', 'müzik', 'dalga', 'podcast'],
    params: [C('color', 'Renk', '#2EE6A6'), C('color2', 'İkinci renk', '#3FA9F5'), N('bars', 'Çubuk sayısı', 18, 6, 40, 1)],
  }, (ctx, t, p, W) => {
    const n = Math.round(+p.bars), gap = 3, bw = (W - 20 - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const v = 0.15 + 0.85 * Math.abs(Math.sin(t * (3 + hash(i) * 5) + i * 0.7) * Math.sin(t * 1.7 + i * 0.3))
      const h = v * 76
      const x = 10 + i * (bw + gap)
      ctx.beginPath(); rr(ctx, x, 50 - h / 2, bw, h, Math.min(bw / 2, 3))
      ctx.fillStyle = lin(ctx, 0, 50 - h / 2, 0, 50 + h / 2, [p.color2, p.color, p.color2]); ctx.fill()
    }
  }),

  V('yukleme-noktalari', 'Yükleme Noktaları', 'ilerleme', {
    aspect: 2, loop: 1.2, tags: ['nokta', 'yükleniyor', 'bekleme', 'yazıyor'],
    params: [C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.sin((phase(t, 1.2) - i * 0.12) * TAU))
      ctx.beginPath(); ctx.arc(W / 2 - 40 + i * 40, 56 - k * 18, 13, 0, TAU)
      ctx.fillStyle = rgba(p.color, 0.45 + k * 0.55); ctx.fill()
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke()
    }
  }),

  V('video-ilerleme', 'Video Oynatma Çubuğu', 'ilerleme', {
    aspect: 6, loop: 8, tags: ['video', 'oynatıcı', 'zaman', 'çubuk'],
    params: [N('length', 'Video süresi (sn)', 296, 5, 7200, 1), C('color', 'Renk', '#FF2E3A')],
  }, (ctx, t, p, W) => {
    const L = Math.max(1, +p.length)
    const cur = Math.min(L, (L * 0.28) + t)
    const v = cur / L
    const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0')
    // oynat simgesi
    ctx.beginPath(); poly(ctx, [[14, 30], [30, 40], [14, 50]]); ctx.fillStyle = '#fff'; ctx.fill()
    text(ctx, fmt(cur) + ' / ' + fmt(L), 40, 40.5, { size: 13, fill: '#fff', align: 'left', fam: F_UI, weight: 700, sw: 3, stroke: 'rgba(0,0,0,0.5)' })
    const x0 = 14, x1 = W - 14, y = 70
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0, y - 3, x1 - x0, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0, y - 3, (x1 - x0) * Math.min(1, v + 0.12), 6)
    ctx.fillStyle = p.color; ctx.fillRect(x0, y - 3, (x1 - x0) * v, 6)
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * v, y, 8, 0, TAU); ctx.fillStyle = p.color; ctx.fill()
  }),
]

export default [...shapes, ...frames, ...lower, ...progress]
