// Yazı katmanı çizici (TEMEL SÜRÜM — yazı paketi bunu genişletir)
// Sözleşme: renderTextLayer(clip, localT, scale, project) → { canvas, width, height, key, offsetX?, offsetY? }
//   scale = render ölçeği × transform.scale; font boyutu = text.size × (tuval genişliği / 1080) × scale
//   Dönen tuval, yazının ekrandaki son piksel boyutundadır (bileşimci yeniden ölçeklemez).

const cache = new Map()

export function textFontPx(clip, scale, project) {
  return Math.max(4, (clip.text.size || 96) * (project.settings.width / 1080) * scale)
}

export function wrapLines(ctx, text, maxW) {
  const out = []
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/)
    let line = ''
    for (const w of words) {
      const test = line + w
      if (line && ctx.measureText(test).width > maxW && w.trim()) { out.push(line.trimEnd()); line = w.trimStart() }
      else line = test
    }
    out.push(line)
  }
  return out
}

export function renderTextLayer(clip, lt, scale, project) {
  const s = clip.text
  if (!s) return null
  const fontPx = textFontPx(clip, scale, project)
  const content = s.uppercase ? String(s.content || '').toLocaleUpperCase('tr-TR') : String(s.content || '')
  const key = JSON.stringify([content, s, Math.round(fontPx * 10)])
  const hit = cache.get(clip.id)
  if (hit && hit.key === key) return hit
  const c = hit ? hit.canvas : document.createElement('canvas')
  const ctx = c.getContext('2d')
  const font = `${s.italic ? 'italic ' : ''}${s.weight || 700} ${fontPx}px "${s.font}", "Archivo", sans-serif`
  ctx.font = font
  const maxW = (s.maxWidth || 0.86) * project.settings.width * scale
  const lines = wrapLines(ctx, content, maxW)
  const lh = fontPx * (s.lineHeight || 1.15)
  let tw = 1
  for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width + (s.letterSpacing || 0) * scale * l.length)
  const strokeW = s.stroke && s.stroke.enabled ? s.stroke.width * scale * (project.settings.width / 1080) : 0
  const pad = Math.ceil(strokeW + fontPx * 0.25 + (s.shadow && s.shadow.enabled ? s.shadow.blur * scale + 10 : 0) + (s.bg && s.bg.enabled ? s.bg.padX * scale : 0))
  const w = Math.ceil(tw + pad * 2), h = Math.ceil(lh * lines.length + pad * 2)
  c.width = Math.max(2, w); c.height = Math.max(2, h)
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = s.align || 'center'
  ctx.lineJoin = 'round'
  if (s.letterSpacing) ctx.letterSpacing = (s.letterSpacing * scale) + 'px'
  const ax = s.align === 'left' ? pad : s.align === 'right' ? w - pad : w / 2
  if (s.bg && s.bg.enabled) {
    ctx.save()
    ctx.globalAlpha = s.bg.opacity ?? 0.7
    ctx.fillStyle = s.bg.color
    const r = (s.bg.radius || 0) * scale
    roundRect(ctx, pad - s.bg.padX * scale + strokeW, pad - s.bg.padY * scale + strokeW * 0.5, tw + s.bg.padX * 2 * scale - strokeW * 2, lh * lines.length + s.bg.padY * 2 * scale - strokeW, r)
    ctx.fill()
    ctx.restore()
  }
  lines.forEach((l, i) => {
    const y = pad + lh * (i + 0.5)
    if (s.shadow && s.shadow.enabled) {
      ctx.save()
      ctx.shadowColor = hexA(s.shadow.color, s.shadow.opacity ?? 0.6)
      ctx.shadowBlur = s.shadow.blur * scale
      ctx.shadowOffsetX = s.shadow.x * scale
      ctx.shadowOffsetY = s.shadow.y * scale
      ctx.fillStyle = s.color
      ctx.fillText(l, ax, y)
      ctx.restore()
    }
    if (strokeW > 0) {
      ctx.strokeStyle = s.stroke.color
      ctx.lineWidth = strokeW * 2
      ctx.strokeText(l, ax, y)
    }
    ctx.fillStyle = s.color
    ctx.fillText(l, ax, y)
  })
  const res = { canvas: c, width: c.width, height: c.height, key }
  cache.set(clip.id, res)
  return res
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function hexA(hex, a) {
  let h = String(hex || '#000').replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
