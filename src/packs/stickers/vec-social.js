// Sosyal medya çıkartmaları — abone ol, beğen, zil, paylaş, takip et, canlı…
import {
  TAU, clamp, lerp, seg, phase, ease, popIn, shadow, noShadow, lighten, darken, rgba, lin, rad, rr, heart,
  text, glossy, cursor, particles, sparkle, bubble, F_HEAVY, F_DISPLAY, F_UI, INK,
} from './kit.js'
import { V, C, T, N, drawIcon } from './vdef.js'

const check = (ctx, x, y, s, color, w = 3) => {
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.3, y + s * 0.7); ctx.lineTo(x + s, y - s * 0.75)
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke()
}
const trFmt = (n) => Math.round(n).toLocaleString('tr-TR')

// zil (abone ol ve zil çıkartması ortak)
function bell(ctx, x, y, s, ang, color = '#fff') {
  ctx.save(); ctx.translate(x, y - s * 0.42); ctx.rotate(ang); ctx.translate(-x, -(y - s * 0.42))
  drawIcon(ctx, 'bell', x, y, s, { fill: color })
  ctx.restore()
}
const ringAng = (q, start, amp = 0.5) => (q < start ? 0 : Math.sin((q - start) * 26) * amp * Math.exp(-(q - start) * 2.4))

export default [
  V('abone-ol', 'Abone Ol', 'sosyal', {
    aspect: 2.6, loop: 4, tags: ['abone', 'subscribe', 'youtube', 'zil'],
    params: [T('text', 'Yazı', 'ABONE OL'), T('done', 'Tıklanınca', 'ABONE OLUNDU'), C('color', 'Renk', '#E8202A')],
  }, (ctx, t, p) => {
    const q = phase(t, 4) * 4
    ctx.globalAlpha = 1 - seg(q, 3.65, 4)
    const clicked = q >= 1.22
    const press = q > 1.12 && q < 1.42 ? 1 - Math.sin(seg(q, 1.12, 1.42) * Math.PI) * 0.08 : 1
    const s = popIn(q, 0.45) * press
    const bx = 14, by = 27, bw = 176, bh = 46
    ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(s, s); ctx.translate(-(bx + bw / 2), -(by + bh / 2))
    glossy(ctx, bx, by, bw, bh, 8, clicked ? '#3a3c44' : p.color)
    if (clicked) {
      check(ctx, bx + 24, by + bh / 2, 6.5, '#d8dbe3', 3.4)
      text(ctx, p.done, bx + bw / 2 + 12, by + bh / 2 + 1, { size: 21, maxW: bw - 52, fill: '#d8dbe3' })
    } else text(ctx, p.text, bx + bw / 2, by + bh / 2 + 1, { size: 24, maxW: bw - 26, fill: '#fff', sw: 0 })
    ctx.restore()
    if (q > 1.2 && q < 1.9) {
      const r = seg(q, 1.2, 1.9)
      ctx.strokeStyle = rgba('#ffffff', 0.7 * (1 - r)); ctx.lineWidth = 3 * (1 - r) + 0.5
      ctx.beginPath(); ctx.arc(150, 50, 6 + r * 46, 0, TAU); ctx.stroke()
    }
    // zil
    const bs = popIn(q, 0.4, 1.35)
    if (bs > 0.01) {
      ctx.save(); ctx.translate(224, 50); ctx.scale(bs, bs); ctx.translate(-224, -50)
      shadow(ctx, 5, 0, 2); ctx.beginPath(); ctx.arc(224, 50, 23, 0, TAU)
      ctx.fillStyle = lin(ctx, 0, 27, 0, 73, ['#4a4d57', '#2a2c33']); ctx.fill(); noShadow(ctx)
      ctx.lineWidth = 2; ctx.strokeStyle = '#15161a'; ctx.stroke()
      const a = ringAng(q, 1.55, 0.55)
      bell(ctx, 224, 51, 30, a)
      if (q > 1.6 && q < 2.8) {
        const k = seg(q, 1.6, 2.8)
        ctx.strokeStyle = rgba('#ffffff', 0.85 * (1 - k)); ctx.lineWidth = 2.4
        for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(224, 48, 15 + k * 4, sg > 0 ? -0.6 : Math.PI - 0.6, sg > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke() }
      }
      ctx.restore()
    }
    // imleç
    const inP = ease.inOut(seg(q, 0.35, 1.08)), outP = ease.inOut(seg(q, 2.0, 2.8))
    const cx = lerp(lerp(262, 150, inP), 270, outP), cy = lerp(lerp(118, 52, inP), 120, outP)
    cursor(ctx, cx, cy, q > 1.12 && q < 1.3 ? 1.35 : 1.5)
  }),

  V('zil', 'Bildirim Zili', 'sosyal', {
    loop: 1.8, tags: ['bildirim', 'zil', 'bell'],
    params: [T('count', 'Sayı', '1'), C('color', 'Zil rengi', '#FFC93C')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.8) * 1.8
    const s = popIn(t, 0.4)
    ctx.translate(50, 52); ctx.scale(s, s); ctx.translate(-50, -52)
    const a = Math.sin(q * 14) * 0.38 * Math.exp(-q * 1.6)
    ctx.save(); ctx.translate(50, 22); ctx.rotate(a); ctx.translate(-50, -22)
    shadow(ctx, 6, 0, 3)
    drawIcon(ctx, 'bell', 50, 54, 74, { fill: darken(p.color, 0.5), stroke: darken(p.color, 0.6), sw: 2.2 })
    noShadow(ctx)
    drawIcon(ctx, 'bell', 50, 54, 74, { fill: lin(ctx, 0, 20, 0, 85, [lighten(p.color, 0.45), p.color, darken(p.color, 0.3)]) })
    ctx.restore()
    // titreşim çizgileri
    const k = (q * 2) % 1
    ctx.strokeStyle = rgba(p.color, 1 - k); ctx.lineWidth = 3.2
    for (const sg of [-1, 1]) for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.arc(50, 50, 34 + i * 8 + k * 4, sg > 0 ? -0.5 : Math.PI - 0.5, sg > 0 ? 0.5 : Math.PI + 0.5); ctx.stroke()
    }
    // rozet
    const bp = popIn(q, 0.3, 0.1)
    ctx.save(); ctx.translate(72, 26); ctx.scale(bp, bp)
    shadow(ctx, 3, 0, 1.5); ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fillStyle = '#E8202A'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke()
    text(ctx, p.count, 0, 1, { size: 15, maxW: 20, fill: '#fff' })
    ctx.restore()
  }),

  V('begen', 'Beğen', 'sosyal', {
    loop: 2, tags: ['like', 'beğeni', 'başparmak'], params: [C('color', 'Renk', '#1E88FF')],
  }, (ctx, t, p) => {
    const q = phase(t, 2) * 2
    const beat = q < 0.5 ? ease.outBack(seg(q, 0, 0.45)) : 1 + Math.sin(seg(q, 0.5, 0.8) * Math.PI) * 0.06
    const s = clamp(beat, 0, 1.3)
    const tilt = q < 0.5 ? -0.5 * (1 - ease.outElastic(seg(q, 0.05, 0.6))) : 0
    particles(ctx, 50, 50, 16, seg(q, 0.2, 1.1), 46, 7, [p.color, '#ffffff', lighten(p.color, 0.5), '#FFD23F'], 4)
    ctx.save(); ctx.translate(50, 50); ctx.scale(s, s); ctx.rotate(tilt)
    shadow(ctx, 6, 0, 3); ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU)
    ctx.fillStyle = lin(ctx, 0, -34, 0, 34, [lighten(p.color, 0.3), p.color, darken(p.color, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(p.color, 0.55); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(0, -16, 24, 12, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill()
    drawIcon(ctx, 'thumb', 1, -1, 38, { fill: '#fff' })
    ctx.restore()
    if (q > 0.4 && q < 1.5) {
      const k = seg(q, 0.4, 1.5)
      ctx.globalAlpha = 1 - k
      text(ctx, '+1', 80, 26 - k * 18, { size: 16, fill: '#fff', sw: 4, stroke: darken(p.color, 0.5) })
      ctx.globalAlpha = 1
    }
  }),

  V('begenme', 'Beğenmedim', 'sosyal', {
    loop: 2, tags: ['dislike', 'beğenme'], params: [C('color', 'Renk', '#5B6170')],
  }, (ctx, t, p) => {
    const q = phase(t, 2) * 2
    const s = popIn(q, 0.4)
    const shake = q > 0.4 && q < 1 ? Math.sin(q * 60) * 0.12 * (1 - seg(q, 0.4, 1)) : 0
    ctx.save(); ctx.translate(50, 50); ctx.scale(s, s); ctx.rotate(shake)
    shadow(ctx, 6, 0, 3); ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU)
    ctx.fillStyle = lin(ctx, 0, -34, 0, 34, [lighten(p.color, 0.3), p.color, darken(p.color, 0.35)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(p.color, 0.6); ctx.stroke()
    drawIcon(ctx, 'thumb', -1, 2, 38, { fill: '#fff', flipY: true, flipX: true })
    ctx.restore()
  }),

  V('kalp-patlamasi', 'Kalp Patlaması', 'sosyal', {
    loop: 1.6, tags: ['kalp', 'aşk', 'beğeni', 'heart'], params: [C('color', 'Renk', '#FF2D55')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.6) * 1.6
    // uçuşan kalpler
    for (let i = 0; i < 7; i++) {
      const k = phase(q / 1.6 + i / 7, 1)
      const x = 50 + Math.sin(k * 7 + i * 2) * (10 + i * 3) + (i - 3) * 6
      const y = 70 - k * 70
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9
      ctx.beginPath(); heart(ctx, x, y, 4 + (i % 3) * 1.5)
      ctx.fillStyle = i % 2 ? lighten(p.color, 0.35) : p.color; ctx.fill()
    }
    ctx.globalAlpha = 1
    const b = q % 0.8
    const s = popIn(t, 0.4) * (1 + Math.exp(-b * 9) * 0.18)
    if (b < 0.45) {
      const r = seg(b, 0, 0.45)
      ctx.strokeStyle = rgba(p.color, 0.8 * (1 - r)); ctx.lineWidth = 4 * (1 - r)
      ctx.beginPath(); ctx.arc(50, 52, 26 + r * 22, 0, TAU); ctx.stroke()
    }
    ctx.save(); ctx.translate(50, 52); ctx.scale(s, s); ctx.translate(-50, -52)
    shadow(ctx, 7, 0, 3)
    ctx.beginPath(); heart(ctx, 50, 50, 30)
    ctx.fillStyle = lin(ctx, 0, 20, 0, 82, [lighten(p.color, 0.3), p.color, darken(p.color, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(p.color, 0.55); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(37, 36, 7, 4.5, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
    ctx.restore()
  }),

  V('yorum', 'Yorum Yap', 'sosyal', {
    aspect: 1.5, loop: 3, tags: ['yorum', 'comment', 'mesaj'],
    params: [T('text', 'Yazı', 'YORUMLARA YAZ'), C('color', 'Renk', '#FFFFFF')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 3) * 3
    const s = popIn(q, 0.4)
    ctx.save(); ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    shadow(ctx, 6, 0, 3)
    ctx.beginPath(); bubble(ctx, 14, 16, W - 28, 56, 16, 36, 22, 32, 90)
    ctx.fillStyle = lin(ctx, 0, 16, 0, 88, [p.color, darken(p.color, 0.12)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.restore()
    if (q < 1.3) {
      for (let i = 0; i < 3; i++) {
        const y = 44 - Math.max(0, Math.sin((q * 2.2 - i * 0.18) * TAU)) * 6
        ctx.beginPath(); ctx.arc(W / 2 - 14 + i * 14, y, 5, 0, TAU); ctx.fillStyle = '#6b7080'; ctx.fill()
      }
    } else {
      const k = popIn(q, 0.3, 1.3)
      ctx.save(); ctx.translate(W / 2, 44); ctx.scale(k, k)
      text(ctx, p.text, 0, 1, { size: 20, maxW: W - 52, fill: INK })
      ctx.restore()
    }
  }),

  V('paylas', 'Paylaş', 'sosyal', {
    loop: 1.6, tags: ['paylaş', 'share', 'gönder'], params: [C('color', 'Renk', '#18C37E')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.6) * 1.6
    const s = popIn(t, 0.4)
    const nudge = Math.sin(seg(q, 0.2, 0.7) * Math.PI) * 6
    ctx.save(); ctx.translate(50, 50); ctx.scale(s, s)
    shadow(ctx, 6, 0, 3); ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU)
    ctx.fillStyle = lin(ctx, 0, -34, 0, 34, [lighten(p.color, 0.3), p.color, darken(p.color, 0.3)]); ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 2.5; ctx.strokeStyle = darken(p.color, 0.55); ctx.stroke()
    ctx.globalAlpha = 0.35 * Math.sin(seg(q, 0.2, 0.7) * Math.PI)
    drawIcon(ctx, 'reply', -4 + nudge * 0.3, 0, 40, { fill: '#fff', flipX: true })
    ctx.globalAlpha = 1
    drawIcon(ctx, 'reply', 1 + nudge, 0, 40, { fill: '#fff', flipX: true })
    ctx.restore()
  }),

  V('takip-et', 'Takip Et', 'sosyal', {
    aspect: 2.8, loop: 3.6, tags: ['takip', 'follow', 'tiktok', 'instagram'],
    params: [T('text', 'Yazı', 'TAKİP ET'), T('done', 'Tıklanınca', 'TAKİPTESİN'), C('color', 'Renk', '#FE2C55')],
  }, (ctx, t, p) => {
    const q = phase(t, 3.6) * 3.6
    ctx.globalAlpha = 1 - seg(q, 3.3, 3.6)
    const clicked = q > 1.2
    const s = popIn(q, 0.45)
    ctx.save(); ctx.translate(140, 50); ctx.scale(s, s); ctx.translate(-140, -50)
    // profil
    shadow(ctx, 5, 0, 2); ctx.beginPath(); ctx.arc(46, 50, 32, 0, TAU)
    ctx.fillStyle = lin(ctx, 0, 18, 0, 82, ['#9AA3B8', '#5E6679']); ctx.fill(); noShadow(ctx)
    ctx.save(); ctx.beginPath(); ctx.arc(46, 50, 32, 0, TAU); ctx.clip()
    drawIcon(ctx, 'person', 46, 56, 58, { fill: '#E9ECF3' }); ctx.restore()
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(46, 50, 32, 0, TAU); ctx.stroke()
    const bp = clicked ? 1 + Math.exp(-(q - 1.2) * 8) * 0.3 : 1
    ctx.save(); ctx.translate(46, 82); ctx.scale(bp, bp); ctx.rotate(clicked ? (1 - ease.outBack(seg(q, 1.2, 1.5))) * -Math.PI : 0)
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fillStyle = clicked ? '#fff' : p.color; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke()
    if (clicked) check(ctx, 0, 0.5, 5, p.color, 3)
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke() }
    ctx.restore()
    // buton
    const press = q > 1.1 && q < 1.35 ? 1 - Math.sin(seg(q, 1.1, 1.35) * Math.PI) * 0.08 : 1
    ctx.save(); ctx.translate(180, 50); ctx.scale(press, press); ctx.translate(-180, -50)
    glossy(ctx, 96, 28, 170, 44, 6, clicked ? '#3a3c44' : p.color)
    text(ctx, clicked ? p.done : p.text, 181, 51, { size: 22, maxW: 150, fill: clicked ? '#d8dbe3' : '#fff' })
    ctx.restore()
    ctx.restore()
    const inP = ease.inOut(seg(q, 0.4, 1.05)), outP = ease.inOut(seg(q, 1.9, 2.6))
    cursor(ctx, lerp(lerp(290, 200, inP), 300, outP), lerp(lerp(120, 54, inP), 124, outP), q > 1.1 && q < 1.3 ? 1.3 : 1.45)
  }),

  V('canli', 'Canlı Yayın', 'sosyal', {
    aspect: 2.4, loop: 1.2, tags: ['canlı', 'live', 'yayın', 'stream'],
    params: [T('text', 'Yazı', 'CANLI'), T('viewers', 'İzleyici', '1.2B'), C('color', 'Renk', '#E8202A')],
  }, (ctx, t, p) => {
    const q = phase(t, 1.2)
    const s = popIn(t, 0.4)
    ctx.translate(120, 50); ctx.scale(s, s); ctx.translate(-120, -50)
    glossy(ctx, 12, 26, 118, 48, 6, p.color)
    const a = 0.5 + 0.5 * Math.cos(q * TAU)
    ctx.beginPath(); ctx.arc(34, 50, 8 + a * 4, 0, TAU); ctx.fillStyle = rgba('#ffffff', 0.25 * a); ctx.fill()
    ctx.beginPath(); ctx.arc(34, 50, 6.5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill()
    text(ctx, p.text, 82, 51, { size: 24, maxW: 78, fill: '#fff' })
    glossy(ctx, 136, 26, 94, 48, 6, '#22242b')
    drawIcon(ctx, 'eye', 158, 50, 22, { fill: '#fff' })
    text(ctx, p.viewers, 196, 51, { size: 21, maxW: 50, fill: '#fff', fam: F_HEAVY })
  }),

  V('izlenme', 'İzlenme Sayacı', 'sosyal', {
    aspect: 2.6, loop: 3.5, tags: ['izlenme', 'görüntülenme', 'views', 'sayaç'],
    params: [N('value', 'Hedef sayı', 1000000, 0, 100000000, 1), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p) => {
    const q = phase(t, 3.5) * 3.5
    const s = popIn(q, 0.4)
    ctx.translate(130, 50); ctx.scale(s, s); ctx.translate(-130, -50)
    glossy(ctx, 10, 22, 240, 56, 8, '#1b1d23', { stroke: '#000' })
    ctx.beginPath(); ctx.arc(44, 50, 19, 0, TAU); ctx.fillStyle = p.color; ctx.fill()
    drawIcon(ctx, 'eye', 44, 50, 26, { fill: '#111' })
    const v = (+p.value || 0) * ease.out3(seg(q, 0.3, 2.3))
    text(ctx, trFmt(v), 152, 51, { size: 30, maxW: 160, fill: '#fff', fam: F_HEAVY })
    if (q > 2.3 && q < 3) { ctx.globalAlpha = 1 - seg(q, 2.3, 3); sparkle(ctx, 236, 30, 8, p.color, q * 3); ctx.globalAlpha = 1 }
  }),

  V('begeni-sayaci', 'Beğeni Sayacı', 'sosyal', {
    aspect: 2.4, loop: 3, tags: ['beğeni', 'like', 'kalp', 'sayaç'],
    params: [N('value', 'Hedef sayı', 25000, 0, 10000000, 1), C('color', 'Renk', '#FF2D55')],
  }, (ctx, t, p) => {
    const q = phase(t, 3) * 3
    const s = popIn(q, 0.4)
    ctx.translate(120, 50); ctx.scale(s, s); ctx.translate(-120, -50)
    glossy(ctx, 10, 24, 220, 52, 26, '#ffffff', { stroke: '#cfd3dc' })
    const b = 1 + Math.exp(-((q * 3) % 1) * 6) * 0.2
    ctx.save(); ctx.translate(40, 52); ctx.scale(b, b)
    ctx.beginPath(); heart(ctx, 0, 0, 15); ctx.fillStyle = lin(ctx, 0, -15, 0, 15, [lighten(p.color, 0.25), p.color]); ctx.fill()
    ctx.restore()
    const v = (+p.value || 0) * ease.out3(seg(q, 0.3, 2.2))
    text(ctx, trFmt(v), 140, 51, { size: 28, maxW: 150, fill: '#16171c' })
  }),

  V('bildirim-karti', 'Bildirim Kartı', 'sosyal', {
    aspect: 3.4, loop: 4, tags: ['bildirim', 'notification', 'yeni video'],
    params: [T('title', 'Başlık', 'Yeni video yüklendi!'), T('body', 'Metin', 'Şimdi izle, kaçırma'), C('color', 'Simge rengi', '#E8202A')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 4) * 4
    const y = lerp(-90, 0, ease.outBack(seg(q, 0, 0.5))) + lerp(0, -100, ease.in(seg(q, 3.5, 4)))
    ctx.translate(0, y)
    shadow(ctx, 10, 0, 4, 'rgba(0,0,0,0.4)')
    ctx.beginPath(); rr(ctx, 8, 14, W - 16, 72, 16)
    ctx.fillStyle = 'rgba(246,247,250,0.97)'; ctx.fill(); noShadow(ctx)
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke()
    ctx.beginPath(); rr(ctx, 22, 28, 44, 44, 11); ctx.fillStyle = lin(ctx, 0, 28, 0, 72, [lighten(p.color, 0.2), darken(p.color, 0.15)]); ctx.fill()
    drawIcon(ctx, 'bell', 44, 50, 28, { fill: '#fff' })
    text(ctx, p.title, 80, 41, { size: 19, maxW: W - 150, fill: '#121318', align: 'left', fam: F_HEAVY })
    text(ctx, p.body, 80, 63, { size: 15, maxW: W - 150, fill: '#5b606c', align: 'left', weight: 600, fam: F_UI })
    text(ctx, 'şimdi', W - 22, 40, { size: 12, fill: '#8a8f9b', align: 'right', weight: 600, fam: F_UI })
  }),

  V('baglanti-aciklamada', 'Bağlantı Açıklamada', 'sosyal', {
    aspect: 2.6, loop: 1.2, tags: ['link', 'bağlantı', 'açıklama', 'bio'],
    params: [T('text', 'Yazı', 'BAĞLANTI AÇIKLAMADA'), C('color', 'Renk', '#E4FF3A')],
  }, (ctx, t, p, W) => {
    const q = phase(t, 1.2)
    const s = popIn(t, 0.4)
    ctx.translate(W / 2, 50); ctx.scale(s, s); ctx.translate(-W / 2, -50)
    glossy(ctx, 12, 14, W - 24, 42, 4, '#15161b', { stroke: '#000' })
    ctx.fillStyle = p.color; ctx.fillRect(12, 14, 8, 42)
    text(ctx, p.text, W / 2 + 4, 36, { size: 21, maxW: W - 60, fill: '#fff' })
    const b = Math.abs(Math.sin(q * Math.PI)) * 8
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); const y = 66 + b + i * 10
      ctx.moveTo(W / 2 - 12, y); ctx.lineTo(W / 2, y + 10); ctx.lineTo(W / 2 + 12, y)
      ctx.strokeStyle = i ? rgba(p.color, 0.55) : p.color; ctx.lineWidth = 5; ctx.stroke()
    }
  }),
]
