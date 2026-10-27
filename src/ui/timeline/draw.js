// Zaman çizelgesi çizimi (tuval). Taban katman: cetvel + klipler. Üst katman: oynatma kafası, yakalama çizgisi, hayalet.

import { RULER_H, CLIP_COLORS, computeRows } from './layout.js'
import { loadPeaks, thumbPath } from '../../core/media.js'
import { sourceTime } from '../../core/time.js'
import { transitionWindow } from '../../core/timeline.js'
import { allKeyTimes } from '../../core/keyframes.js'
import { get as regGet } from '../../engine/registry.js'
import { fileUrl } from '../../platform/node.js'

const imgCache = new Map()
let onImg = null
export function setImageListener(fn) { onImg = fn }

function img(p) {
  if (!p) return null
  let e = imgCache.get(p)
  if (!e) {
    const im = new Image()
    e = { im, ok: false }
    im.onload = () => { e.ok = true; onImg && onImg() }
    im.src = fileUrl(p)
    imgCache.set(p, e)
    if (imgCache.size > 1500) { const k = imgCache.keys().next().value; imgCache.delete(k) }
  }
  return e.ok ? e.im : null
}

// cetvel adımı: zum seviyesine göre okunur aralık
function rulerStep(zoom) {
  const steps = [1 / 30, 2 / 30, 5 / 30, 10 / 30, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const s of steps) if (s * zoom >= 64) return s
  return 1200
}

function fmtRuler(t, step, fps) {
  const fr = Math.round(t * fps)
  const whole = Math.floor(fr / fps)
  const m = Math.floor(whole / 60), s = whole % 60
  const base = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  if (step < 1) return base + ':' + String(fr % fps).padStart(2, '0')
  return base
}

export function drawBase(ctx, st) {
  const { w, h, project, zoom, scrollX, scrollY, selection, hover, ui, dpr, drag } = st
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#070809'
  ctx.fillRect(0, 0, w, h)
  const fps = project.settings.fps
  const { rows } = computeRows(project.tracks)
  const t0 = scrollX / zoom, t1 = (scrollX + w) / zoom
  const X = t => Math.round(t * zoom - scrollX) + 0.5

  // iz arka planları
  ctx.save()
  ctx.translate(0, -scrollY)
  for (const r of rows) {
    ctx.fillStyle = r.track.main ? '#0e1012' : '#0b0c0e'
    ctx.fillRect(0, r.y, w, r.h)
    if (r.track.main) {
      // ana iz: film perforasyonu motifi
      ctx.fillStyle = '#16181b'
      for (let x = -(scrollX % 14); x < w; x += 14) { ctx.fillRect(x + 3, r.y - 3, 7, 2); ctx.fillRect(x + 3, r.y + r.h + 1, 7, 2) }
    }
    if (r.track.locked) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let x = -(scrollX % 12) - r.h; x < w; x += 12) { ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.lineTo(x + r.h + 4, r.y); ctx.lineTo(x + 4, r.y + r.h); ctx.fill() }
    }
  }
  // klipler
  const selSet = new Set(selection)
  const movingIds = drag && drag.mode === 'move' ? new Set(drag.ids) : null
  for (const r of rows) {
    const tr = r.track
    for (let i = 0; i < tr.clips.length; i++) {
      const c = tr.clips[i]
      if (c.start + c.duration < t0 - 1 || c.start > t1 + 1) continue
      const ghost = movingIds && movingIds.has(c.id)
      drawClip(ctx, c, tr, r, X, zoom, project, selSet.has(c.id), hover && hover.id === c.id ? hover : null, ghost, ui)
    }
    // geçiş noktaları (ana iz + video izleri)
    if (tr.kind === 'video') {
      for (let i = 0; i < tr.clips.length - 1; i++) {
        const a = tr.clips[i], b = tr.clips[i + 1]
        if (Math.abs(a.start + a.duration - b.start) > 0.05) continue
        const cut = a.start + a.duration
        if (cut < t0 - 1 || cut > t1 + 1) continue
        const win = transitionWindow(tr, a)
        const cx = X(cut), cy = r.y + r.h / 2
        if (win) {
          const x0 = X(win.start), x1 = X(win.end)
          ctx.fillStyle = 'rgba(228,255,58,0.18)'
          ctx.fillRect(x0, r.y + 2, x1 - x0, r.h - 4)
          ctx.strokeStyle = '#e4ff3a'
          ctx.lineWidth = 1
          ctx.strokeRect(x0 + 0.5, r.y + 2.5, x1 - x0 - 1, r.h - 5)
          ctx.save(); ctx.beginPath(); ctx.rect(x0, r.y + 2, x1 - x0, r.h - 4); ctx.clip()
          ctx.strokeStyle = 'rgba(228,255,58,0.35)'
          for (let x = x0 - r.h; x < x1; x += 6) { ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke() }
          ctx.restore()
        }
        const hv = hover && hover.cut === a.id
        ctx.fillStyle = hv ? '#e4ff3a' : (win ? '#e4ff3a' : '#1d1f23')
        ctx.strokeStyle = win || hv ? '#e4ff3a' : '#3b3f46'
        ctx.lineWidth = 1
        ctx.fillRect(cx - 7, cy - 7, 14, 14)
        ctx.strokeRect(cx - 6.5, cy - 6.5, 13, 13)
        ctx.strokeStyle = win || hv ? '#0a0b00' : '#a9acb2'
        ctx.beginPath()
        ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3); ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3)
        ctx.stroke()
      }
    }
  }
  ctx.restore()

  // cetvel
  ctx.fillStyle = '#0d0e10'
  ctx.fillRect(0, 0, w, RULER_H)
  ctx.fillStyle = '#202227'
  ctx.fillRect(0, RULER_H - 1, w, 1)
  // aralık (giriş/çıkış)
  if (ui.rangeIn != null || ui.rangeOut != null) {
    const a = ui.rangeIn ?? 0, b = ui.rangeOut ?? (t1 + 10)
    ctx.fillStyle = 'rgba(228,255,58,0.12)'
    ctx.fillRect(X(a), 0, X(b) - X(a), RULER_H - 1)
    ctx.fillStyle = '#e4ff3a'
    if (ui.rangeIn != null) ctx.fillRect(X(a) - 1, 0, 2, RULER_H)
    if (ui.rangeOut != null) ctx.fillRect(X(b) - 1, 0, 2, RULER_H)
  }
  const step = rulerStep(zoom)
  const sub = step / 5
  ctx.font = '500 9.5px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'
  const i0 = Math.floor(t0 / sub), i1 = Math.ceil(t1 / sub)
  for (let i = i0; i <= i1; i++) {
    const t = Math.round(i * sub * 1e6) / 1e6
    const x = X(t)
    const major = i % 5 === 0
    ctx.fillStyle = major ? '#4a4e55' : '#2a2d32'
    ctx.fillRect(x, major ? RULER_H - 12 : RULER_H - 6, 1, major ? 11 : 5)
    if (major) {
      ctx.fillStyle = '#6c7078'
      ctx.fillText(fmtRuler(Math.max(0, t), step, fps), x + 4, 6)
    }
  }
  // işaretler
  for (const m of project.markers || []) {
    const x = X(m.time)
    if (x < -10 || x > w + 10) continue
    ctx.fillStyle = m.color || '#e4ff3a'
    ctx.beginPath(); ctx.moveTo(x - 5, RULER_H - 13); ctx.lineTo(x + 5, RULER_H - 13); ctx.lineTo(x + 5, RULER_H - 6); ctx.lineTo(x, RULER_H - 2); ctx.lineTo(x - 5, RULER_H - 6); ctx.fill()
    if (m.label) { ctx.fillStyle = '#a9acb2'; ctx.fillText(m.label, x + 7, RULER_H - 13) }
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function drawClip(ctx, c, tr, r, X, zoom, project, selected, hover, ghost, ui) {
  const x0 = X(c.start), x1 = X(c.start + c.duration)
  const w = Math.max(2, x1 - x0)
  const y = r.y + 1, h = r.h - 2
  const col = c.color || CLIP_COLORS[c.type] || '#888'
  const media = c.mediaId ? project.media[c.mediaId] : null
  ctx.save()
  if (ghost) ctx.globalAlpha = 0.35
  if (tr.hidden || (c.type === 'audio' && tr.muted)) ctx.globalAlpha *= 0.45
  roundRectPath(ctx, x0 + 0.5, y + 0.5, w - 1, h - 1, 2)
  ctx.fillStyle = hexA(col, 0.16)
  ctx.fill()
  ctx.save()
  ctx.clip()

  // içerik
  if ((c.type === 'video' || c.type === 'image') && media) {
    const thumbH = c.type === 'video' && media.hasAudio && !(c.audio && c.audio.muted) && h > 40 ? h - 16 : h
    const ar = (media.width || 16) / (media.height || 9)
    const tw = Math.max(16, thumbH * ar)
    const vx0 = Math.max(x0, -tw), vx1 = Math.min(x1, ctx.canvas.width)
    for (let tx = x0 + Math.floor((vx0 - x0) / tw) * tw; tx < vx1; tx += tw) {
      let im = null
      if (c.type === 'image') im = img(media.path)
      else if (media.thumbsDir) {
        const lt = Math.max(0, Math.min(c.duration, (tx + tw / 2 - x0) / zoom))
        const stime = sourceTime(c, lt)
        const idx = Math.floor(stime / (media.thumbInterval || 1))
        im = img(thumbPath(media, idx))
      }
      if (im) ctx.drawImage(im, tx, y, tw, thumbH)
      else { ctx.fillStyle = hexA(col, 0.08); ctx.fillRect(tx, y, tw - 1, thumbH) }
    }
    // alt şerit: ses dalgası
    if (thumbH < h) {
      ctx.fillStyle = 'rgba(7,8,9,0.85)'
      ctx.fillRect(x0, y + thumbH, w, h - thumbH)
      drawWave(ctx, c, media, x0, x1, y + thumbH + 1, h - thumbH - 2, zoom, '#2ee6a6', ui)
    }
    if (media.status === 'processing') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(x0, y + h - 3, w, 3)
      ctx.fillStyle = '#e4ff3a'
      ctx.fillRect(x0, y + h - 3, w * (media.progress || 0), 3)
    }
  } else if (c.type === 'audio' && media) {
    ctx.fillStyle = hexA(col, 0.1)
    ctx.fillRect(x0, y, w, h)
    drawWave(ctx, c, media, x0, x1, y + 14, h - 15, zoom, col, ui)
    // vuruş işaretleri
    if (c.beats && c.beats.length) {
      ctx.fillStyle = '#e4ff3a'
      const rate = (c.out - c.in) / c.duration
      for (const b of c.beats) {
        const lt = (b - c.in) / rate
        if (lt < 0 || lt > c.duration) continue
        const bx = x0 + lt * zoom
        ctx.fillRect(bx - 1, y + h - 5, 2, 4)
      }
    }
  } else {
    // yazı/çıkartma/efekt blok
    ctx.fillStyle = hexA(col, 0.22)
    ctx.fillRect(x0, y, w, h)
    ctx.fillStyle = hexA(col, 0.5)
    ctx.fillRect(x0, y, 3, h)
  }

  // ses geçişleri (fade) üçgenleri
  const au = c.audio
  if (au && (c.type === 'audio' || (c.type === 'video' && media && media.hasAudio && !au.muted))) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    if (au.fadeIn > 0) { const fw = au.fadeIn * zoom; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + fw, y); ctx.lineTo(x0, y + h); ctx.fill() }
    if (au.fadeOut > 0) { const fw = au.fadeOut * zoom; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - fw, y); ctx.lineTo(x1, y + h); ctx.fill() }
  }

  // etiket
  const label = clipLabel(c, media)
  const badges = clipBadges(c)
  ctx.font = '600 10.5px Archivo, sans-serif'
  ctx.textBaseline = 'middle'
  const ly = c.type === 'text' || c.type === 'sticker' || c.type === 'effect' || c.type === 'filter' || c.type === 'adjust' ? y + h / 2 : y + 8
  let lx = x0 + 6
  if (w > 24) {
    const bw = badges ? ctx.measureText(badges).width + 10 : 0
    const tw = Math.min(ctx.measureText(label).width, w - 14 - bw)
    if (ly < y + h / 2) {
      ctx.fillStyle = 'rgba(7,8,9,0.72)'
      ctx.fillRect(x0 + 2, y + 2, Math.max(0, Math.min(w - 4, tw + 8 + bw)), 13)
    }
    ctx.fillStyle = '#f1f1ec'
    if (tw > 8) ctx.fillText(fitText(ctx, label, tw), lx, ly)
    if (badges && w > bw + 30) {
      ctx.font = '600 9.5px "JetBrains Mono", monospace'
      ctx.fillStyle = '#e4ff3a'
      ctx.fillText(badges, lx + tw + 6, ly)
    }
  }
  // anahtar kare elmasları
  const kts = allKeyTimes(c)
  if (kts.length) {
    ctx.fillStyle = selected ? '#e4ff3a' : '#f1f1ec'
    for (const kt of kts) {
      const kx = x0 + kt * zoom
      const ky = y + h - 6
      ctx.beginPath(); ctx.moveTo(kx, ky - 4); ctx.lineTo(kx + 4, ky); ctx.lineTo(kx, ky + 4); ctx.lineTo(kx - 4, ky); ctx.fill()
    }
  }
  ctx.restore() // klip kırpması

  // çerçeve
  roundRectPath(ctx, x0 + 0.5, y + 0.5, w - 1, h - 1, 2)
  ctx.lineWidth = selected ? 2 : 1
  ctx.strokeStyle = selected ? '#e4ff3a' : hexA(col, hover ? 0.9 : 0.55)
  ctx.stroke()
  if (selected && w > 30 && au && (c.type === 'audio' || (c.type === 'video' && media && media.hasAudio && !au.muted))) {
    // ses yumuşatma tutamaçları
    const fx0 = x0 + 6 + (au.fadeIn || 0) * zoom, fx1 = x1 - 6 - (au.fadeOut || 0) * zoom
    ctx.fillStyle = '#f1f1ec'
    ctx.strokeStyle = '#070809'
    ctx.lineWidth = 1
    for (const fx of [fx0, fx1]) { ctx.fillRect(fx - 4, y + 1, 8, 8); ctx.strokeRect(fx - 3.5, y + 1.5, 7, 7) }
  }
  if (selected && w > 14) {
    // kırpma tutamaçları (köşeli parantez)
    ctx.fillStyle = '#e4ff3a'
    ctx.fillRect(x0, y, 5, h)
    ctx.fillRect(x1 - 5, y, 5, h)
    ctx.fillStyle = '#0a0b00'
    ctx.fillRect(x0 + 2, y + h / 2 - 6, 1, 12)
    ctx.fillRect(x1 - 3, y + h / 2 - 6, 1, 12)
  } else if (hover && hover.edge) {
    ctx.fillStyle = '#f1f1ec'
    if (hover.edge === 'start') ctx.fillRect(x0, y, 3, h)
    else ctx.fillRect(x1 - 3, y, 3, h)
  }
  ctx.restore()
}

function fitText(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s
  let lo = 0, hi = s.length
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1 }
  return s.slice(0, lo) + '…'
}

function clipLabel(c, media) {
  if (c.type === 'text') return (c.caption ? '❝ ' : '') + (c.text && c.text.content ? c.text.content.replace(/\n/g, ' ') : 'Yazı')
  if (c.type === 'sticker') { const d = c.sticker && regGet('stickers', c.sticker.id); return d ? d.name : (c.name || 'Çıkartma') }
  if (c.type === 'effect') { const d = c.effect && regGet('effects', c.effect.id); return '✦ ' + (d ? d.name : c.name || 'Efekt') }
  if (c.type === 'filter') { const d = c.filter && regGet('filters', c.filter.id); return '◐ ' + (d ? d.name : c.name || 'Filtre') }
  if (c.type === 'adjust') return '☰ ' + (c.name || 'Ayar')
  return c.name || (media ? media.name : '')
}

function clipBadges(c) {
  const b = []
  if (c.freeze) b.push('❄')
  if (c.reverse) b.push('◀◀')
  if (c.speedCurve) b.push('∿')
  else if (c.speed && Math.abs(c.speed - 1) > 0.001) b.push(c.speed.toFixed(c.speed < 1 ? 2 : 1) + '×')
  if (c.effects && c.effects.length) b.push('✦' + c.effects.length)
  if (c.filter && c.filter.id && c.type !== 'filter') b.push('◐')
  if (c.anim && (c.anim.in || c.anim.out || c.anim.loop)) b.push('↯')
  if (c.mask && c.mask.type && c.mask.type !== 'none') b.push('◑')
  if (c.audio && c.audio.voiceFx) b.push('♪fx')
  return b.join(' ')
}

function drawWave(ctx, c, media, x0, x1, y, h, zoom, col, ui) {
  if (!ui.showWaveforms || h < 4) return
  const peaks = loadPeaks(media)
  if (!peaks) return
  const vol = c.audio ? (c.audio.muted ? 0 : Math.min(2, c.audio.volume ?? 1)) : 1
  ctx.fillStyle = hexA(col, 0.85)
  const mid = y + h / 2
  const vx0 = Math.max(x0, 0), vx1 = Math.min(x1, ctx.canvas.width)
  const step = 2
  for (let x = vx0; x < vx1; x += step) {
    const lt = (x - x0) / zoom
    const lt2 = (x + step - x0) / zoom
    let a = sourceTime(c, lt), b = sourceTime(c, lt2)
    if (a > b) { const tmp = a; a = b; b = tmp }
    let i0 = Math.floor(a * 100), i1 = Math.max(i0 + 1, Math.ceil(b * 100))
    let mx = 0
    for (let i = i0; i < i1 && i < peaks.length; i++) if (i >= 0 && peaks[i] > mx) mx = peaks[i]
    const ph = Math.max(0.5, (mx / 255) * h * 0.5 * Math.min(1.6, vol))
    ctx.fillRect(x, mid - ph, step - 0.6, ph * 2)
  }
}

// Üst katman: oynatma kafası, yakalama çizgisi, sürükleme hayaleti, seçim kutusu, bırakma hedefi
export function drawOverlay(ctx, st) {
  const { w, h, zoom, scrollX, scrollY, time, drag, dpr, dropHint, snapLine, marquee } = st
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const X = t => Math.round(t * zoom - scrollX) + 0.5
  if (drag && drag.mode === 'move' && drag.ghosts) {
    for (const g of drag.ghosts) {
      const x0 = X(g.start), x1 = X(g.start + g.duration)
      const y = g.y - scrollY
      ctx.fillStyle = hexA(g.color, 0.28)
      ctx.fillRect(x0, y + 1, x1 - x0, g.h - 2)
      ctx.strokeStyle = g.invalid ? '#ff4d5e' : '#e4ff3a'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(x0 + 0.5, y + 1.5, x1 - x0 - 1, g.h - 3)
      ctx.setLineDash([])
    }
    if (drag.insertY != null) {
      ctx.fillStyle = '#e4ff3a'
      ctx.fillRect(0, drag.insertY - scrollY - 1, w, 2)
    }
  }
  if (dropHint) {
    const x0 = X(dropHint.time), x1 = X(dropHint.time + (dropHint.duration || 3))
    const y = dropHint.y - scrollY
    ctx.fillStyle = 'rgba(228,255,58,0.16)'
    ctx.fillRect(x0, y, Math.max(6, x1 - x0), dropHint.h)
    ctx.strokeStyle = '#e4ff3a'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x0 + 0.5, y + 0.5, Math.max(6, x1 - x0) - 1, dropHint.h - 1)
    ctx.font = '700 10px Archivo, sans-serif'
    ctx.fillStyle = '#e4ff3a'
    ctx.textBaseline = 'bottom'
    if (dropHint.label) ctx.fillText(dropHint.label, x0 + 4, y - 3)
  }
  if (marquee) {
    ctx.fillStyle = 'rgba(228,255,58,0.07)'
    ctx.strokeStyle = 'rgba(228,255,58,0.7)'
    ctx.lineWidth = 1
    const x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1)
    const mw = Math.abs(marquee.x1 - marquee.x0), mh = Math.abs(marquee.y1 - marquee.y0)
    ctx.fillRect(x, y, mw, mh)
    ctx.strokeRect(x + 0.5, y + 0.5, mw, mh)
  }
  if (snapLine != null) {
    const x = X(snapLine)
    ctx.strokeStyle = '#7af0ff'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, h); ctx.stroke()
    ctx.setLineDash([])
  }
  // oynatma kafası
  const px = X(time)
  if (px >= -2 && px <= w + 2) {
    ctx.fillStyle = '#e4ff3a'
    ctx.fillRect(px - 0.5, RULER_H - 2, 1.5, h)
    ctx.beginPath()
    ctx.moveTo(px - 6, 2); ctx.lineTo(px + 7, 2); ctx.lineTo(px + 7, RULER_H - 12); ctx.lineTo(px + 0.5, RULER_H - 4); ctx.lineTo(px - 6, RULER_H - 12)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#0a0b00'
    ctx.fillRect(px - 2, 7, 1.5, 9); ctx.fillRect(px + 1.5, 7, 1.5, 9)
  }
}
