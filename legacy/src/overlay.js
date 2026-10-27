import { fitInside, OUT_W, OUT_H } from './util.js'

// Üst-Alt Düzen yazılarını canvas'ta 1080x1920 şeffaf PNG'ye çizer.
// drawtext yerine bunu overlay etmek = önizlemeyle birebir aynı sonuç + renkli emoji.

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function drawBlock(ctx, text, centerY, fontSize, color) {
  if (!text || !String(text).trim()) return
  ctx.font = `800 ${fontSize}px "Segoe UI", "Segoe UI Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowOffsetY = 4
  ctx.shadowBlur = 10
  const lines = wrapText(ctx, String(text).trim(), OUT_W - 100)
  const lineH = fontSize * 1.22
  const startY = centerY - ((lines.length - 1) * lineH) / 2
  lines.forEach((ln, i) => ctx.fillText(ln, OUT_W / 2, startY + i * lineH))
}

export function renderPanelOverlay(meta, opts) {
  const top = (opts.topText || '').trim()
  const bottom = (opts.bottomText || '').trim()
  if (!top && !bottom) return null

  const dw = meta.displayWidth || meta.width
  const fg = fitInside(dw, meta.height, OUT_W, Math.floor(OUT_H * 0.72))
  const pos = Math.min(1, Math.max(0, opts.videoPos != null ? opts.videoPos : 0.3))
  const vy = Math.round((OUT_H - fg.h) * pos)
  const fontSize = Math.min(160, Math.max(32, opts.fontSize || 76))
  const color = opts.textColor || '#ffffff'

  const canvas = document.createElement('canvas')
  canvas.width = OUT_W
  canvas.height = OUT_H
  const ctx = canvas.getContext('2d')

  if (top) drawBlock(ctx, top, Math.max(vy / 2, fontSize), fontSize, color)
  if (bottom) {
    const areaTop = vy + fg.h
    drawBlock(ctx, bottom, areaTop + (OUT_H - areaTop) / 2, fontSize, color)
  }
  return canvas.toDataURL('image/png')
}
