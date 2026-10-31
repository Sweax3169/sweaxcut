// Ölçüm kapsamları: histogram, dalga formu (luma), RGB geçit, vektörskop. Önizleme karesi çizildiği an
// küçültülmüş kopyasından hesaplanır (playback.afterRender) — renkçinin aradığı "gerçek sayı".
import React, { useEffect, useRef, useState } from 'react'
import { playback } from '../../engine/playback.js'
import Icon from '../Icon.jsx'

const SW = 160, SH = 90         // örnekleme çözünürlüğü
const CW = 280, CH = 158        // kapsam tuvali
const MODES = [['hist', 'Histogram'], ['wave', 'Dalga'], ['parade', 'RGB'], ['vector', 'Vektör']]

export default function Scopes({ onClose }) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('sweax.scope') || 'wave' } catch (e) { return 'wave' } })
  const cv = useRef(null)
  useEffect(() => { try { localStorage.setItem('sweax.scope', mode) } catch (e) { /* */ } }, [mode])
  useEffect(() => {
    const small = document.createElement('canvas'); small.width = SW; small.height = SH
    const sx = small.getContext('2d', { willReadFrequently: true })
    let last = 0, trail = 0
    const f = (src, now) => {
      if (!cv.current) return
      if (now - last < 110) { clearTimeout(trail); trail = setTimeout(() => playback.requestRender(), 120 - (now - last)); return }
      last = now
      sx.drawImage(src, 0, 0, SW, SH)
      const d = sx.getImageData(0, 0, SW, SH).data
      draw(cv.current, d, mode)
    }
    playback.afterRender.add(f)
    playback.requestRender()
    return () => { playback.afterRender.delete(f); clearTimeout(trail) }
  }, [mode])
  return (
    <div className="scopes">
      <div className="sc-h">
        {MODES.map(([v, l]) => <button key={v} className={v === mode ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>)}
        <span className="grow" />
        <button className="sc-x" onClick={onClose} data-tip="Kapat"><Icon name="x" size={12} /></button>
      </div>
      <canvas ref={cv} width={CW * 2} height={CH * 2} style={{ width: CW, height: CH }} />
    </div>
  )
}

function draw(c, d, mode) {
  const x = c.getContext('2d')
  const W = c.width, H = c.height
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.fillStyle = '#07080b'
  x.fillRect(0, 0, W, H)
  // ızgara
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1
  if (mode !== 'vector') for (let i = 1; i < 4; i++) { const y = Math.round(H * i / 4) + 0.5; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke() }
  x.globalCompositeOperation = 'lighter'
  const n = d.length / 4
  if (mode === 'hist') {
    const hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256), hl = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      hr[r]++; hg[g]++; hb[b]++; hl[(r * 54 + g * 183 + b * 19) >> 8]++
    }
    let mx = 1
    for (let i = 2; i < 254; i++) mx = Math.max(mx, hr[i], hg[i], hb[i])
    const area = (h, col) => {
      x.fillStyle = col
      x.beginPath(); x.moveTo(0, H)
      for (let i = 0; i < 256; i++) x.lineTo(i / 255 * W, H - Math.min(1, h[i] / mx) * H * 0.95)
      x.lineTo(W, H); x.closePath(); x.fill()
    }
    area(hr, 'rgba(255,70,70,0.55)'); area(hg, 'rgba(60,220,110,0.5)'); area(hb, 'rgba(80,130,255,0.6)')
    x.globalCompositeOperation = 'source-over'
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2
    x.beginPath()
    for (let i = 0; i < 256; i++) { const y = H - Math.min(1, hl[i] / mx) * H * 0.95; if (i) x.lineTo(i / 255 * W, y); else x.moveTo(0, y) }
    x.stroke()
  } else if (mode === 'wave' || mode === 'parade') {
    const parts = mode === 'wave' ? [['l', 'rgba(150,255,190,0.16)']] : [['r', 'rgba(255,70,70,0.22)'], ['g', 'rgba(70,255,120,0.2)'], ['b', 'rgba(90,140,255,0.26)']]
    const pw = W / parts.length
    parts.forEach(([ch, col], pi) => {
      x.fillStyle = col
      for (let i = 0; i < n; i++) {
        const o = i * 4, px = i % SW
        const v = ch === 'l' ? (d[o] * 0.2126 + d[o + 1] * 0.7152 + d[o + 2] * 0.0722) : ch === 'r' ? d[o] : ch === 'g' ? d[o + 1] : d[o + 2]
        x.fillRect(pi * pw + (px / SW) * pw, H - 4 - (v / 255) * (H - 8), Math.max(2, pw / SW), 2)
      }
    })
    if (mode === 'parade') { x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(pw, 0, 1, H); x.fillRect(pw * 2, 0, 1, H) }
  } else {
    // vektörskop: Cb/Cr düzlemi, ten çizgisi
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46
    x.globalCompositeOperation = 'source-over'
    x.strokeStyle = 'rgba(255,255,255,0.12)'
    x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke()
    x.beginPath(); x.arc(cx, cy, R * 0.5, 0, Math.PI * 2); x.stroke()
    x.strokeStyle = 'rgba(255,190,140,0.45)'
    const sk = -123 * Math.PI / 180
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(sk) * R, cy + Math.sin(sk) * R); x.stroke()
    x.globalCompositeOperation = 'lighter'
    for (let i = 0; i < n; i++) {
      const o = i * 4, r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255
      const cb = -0.1146 * r - 0.3854 * g + 0.5 * b
      const cr = 0.5 * r - 0.4542 * g - 0.0458 * b
      x.fillStyle = `rgba(${d[o]},${d[o + 1]},${d[o + 2]},0.35)`
      x.fillRect(cx + cb * R * 1.9, cy - cr * R * 1.9, 2, 2)
    }
  }
  x.globalCompositeOperation = 'source-over'
}
