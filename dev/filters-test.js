// Filtre temas föyü: her filtreyi gerçek bir klibe uygular (comp.render), ızgaraya çizer, hataları raporlar.
// Fotoğraf benzeri prosedürel sahne: gökyüzü, güneş, dağ, çimen, göl, ten tonu, gri basamak, renk yamaları.
// URL: ?cat=sinema  ?scale=0.15  ?cols=5  ?pattern=1 (test deseni)
import * as model from '../src/core/model.js'
import { Compositor } from '../src/engine/compositor.js'
import { FILTERS, FILTER_CATEGORIES } from '../src/packs/filters/index.js'
import { testPattern, fakeSources } from './testkit.js'

const q = new URLSearchParams(location.search)
const SCALE = +(q.get('scale') || 0.15)
const COLS = +(q.get('cols') || 5)
const onlyCat = q.get('cat')
const fs = typeof window.require === 'function' ? window.require('fs') : null
const Buf = window.Buffer || (window.require && window.require('buffer').Buffer)

function paintScene(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  // gökyüzü
  let g = x.createLinearGradient(0, 0, 0, h * 0.62)
  g.addColorStop(0, '#3f78bf'); g.addColorStop(0.7, '#a9cbe6'); g.addColorStop(1, '#f1dcc0')
  x.fillStyle = g; x.fillRect(0, 0, w, h)
  // güneş
  g = x.createRadialGradient(w * 0.8, h * 0.28, 0, w * 0.8, h * 0.28, h * 0.4)
  g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.08, 'rgba(255,236,190,0.95)'); g.addColorStop(0.35, 'rgba(255,210,150,0.25)'); g.addColorStop(1, 'rgba(255,210,150,0)')
  x.fillStyle = g; x.fillRect(0, 0, w, h)
  // bulutlar
  x.fillStyle = 'rgba(255,255,255,0.7)'
  for (const [cx, cy, r] of [[0.2, 0.15, 0.05], [0.25, 0.13, 0.06], [0.31, 0.16, 0.045], [0.55, 0.1, 0.035], [0.59, 0.09, 0.045]]) { x.beginPath(); x.arc(w * cx, h * cy, h * r, 0, 7); x.fill() }
  // uzak dağlar
  x.fillStyle = '#7d8fa8'; x.beginPath(); x.moveTo(0, h * 0.6)
  for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo(w * t, h * (0.42 + 0.08 * Math.sin(t * 9) + 0.04 * Math.sin(t * 23 + 1))) }
  x.lineTo(w, h * 0.6); x.fill()
  // yakın tepeler
  g = x.createLinearGradient(0, h * 0.5, 0, h * 0.8); g.addColorStop(0, '#5e9c3f'); g.addColorStop(1, '#2f5e22')
  x.fillStyle = g; x.beginPath(); x.moveTo(0, h * 0.8)
  for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo(w * t, h * (0.55 + 0.05 * Math.sin(t * 5 + 2) + 0.02 * Math.sin(t * 17))) }
  x.lineTo(w, h * 0.8); x.fill()
  // göl
  g = x.createLinearGradient(0, h * 0.6, 0, h * 0.8); g.addColorStop(0, '#9cc4e0'); g.addColorStop(1, '#3a6f99')
  x.fillStyle = g; x.beginPath(); x.ellipse(w * 0.72, h * 0.7, w * 0.22, h * 0.07, 0, 0, 7); x.fill()
  // ağaçlar
  for (let i = 0; i < 7; i++) {
    const tx = w * (0.38 + i * 0.035), ty = h * (0.6 + (i % 2) * 0.02)
    x.fillStyle = '#4a3220'; x.fillRect(tx - 2, ty, 4, h * 0.05)
    x.fillStyle = i % 2 ? '#2d6b2a' : '#3f8a32'; x.beginPath(); x.moveTo(tx, ty - h * 0.12); x.lineTo(tx - h * 0.04, ty + 4); x.lineTo(tx + h * 0.04, ty + 4); x.fill()
  }
  // portre: omuz, yüz, saç
  x.fillStyle = '#c0392b'; x.beginPath(); x.ellipse(w * 0.17, h * 0.84, h * 0.17, h * 0.12, 0, Math.PI, 0); x.fill()
  x.fillStyle = '#d9a07a'; x.fillRect(w * 0.17 - h * 0.035, h * 0.6, h * 0.07, h * 0.12)
  g = x.createRadialGradient(w * 0.16, h * 0.5, h * 0.02, w * 0.17, h * 0.53, h * 0.13)
  g.addColorStop(0, '#f2c4a2'); g.addColorStop(0.7, '#dda27c'); g.addColorStop(1, '#b97a56')
  x.fillStyle = g; x.beginPath(); x.ellipse(w * 0.17, h * 0.53, h * 0.085, h * 0.11, 0, 0, 7); x.fill()
  x.fillStyle = '#2a1a12'; x.beginPath(); x.ellipse(w * 0.17, h * 0.45, h * 0.092, h * 0.06, 0, Math.PI, 0); x.fill()
  x.fillStyle = '#3a2418'; x.beginPath(); x.arc(w * 0.17 - h * 0.03, h * 0.52, h * 0.008, 0, 7); x.arc(w * 0.17 + h * 0.03, h * 0.52, h * 0.008, 0, 7); x.fill()
  x.strokeStyle = '#a0524a'; x.lineWidth = h * 0.008; x.beginPath(); x.arc(w * 0.17, h * 0.565, h * 0.025, 0.2, Math.PI - 0.2); x.stroke()
  // alt şerit: gri basamak + renk yamaları
  const sy = h * 0.86, sh = h * 0.14
  for (let i = 0; i < 10; i++) { const v = Math.round(i / 9 * 255); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i * w * 0.05, sy, w * 0.05 + 1, sh) }
  const pal = ['#d62828', '#f77f00', '#fcbf49', '#2a9d3f', '#2ec4b6', '#1d4ed8', '#7b2cbf', '#e0459b', '#f1c27d', '#8d5524']
  pal.forEach((col, i) => { x.fillStyle = col; x.fillRect(w * 0.5 + i * w * 0.05, sy, w * 0.05 + 1, sh) })
  return c
}

const img = q.get('pattern') === '1' ? testPattern(960, 540) : paintScene(960, 540)
const p = model.createProject({ ratio: '16:9' })
p.settings.bg = { type: 'color', color: '#000000' }
p.media.m1 = { id: 'm1', type: 'image', name: 'sahne', width: img.width, height: img.height, duration: 5 }
const clip = model.createMediaClip(p.media.m1, { duration: 5 })
clip.fit = 'cover'
p.tracks[0].clips.push(clip)

const glc = document.getElementById('c')
const W = Math.round(p.settings.width * SCALE), H = Math.round(p.settings.height * SCALE)
glc.width = W; glc.height = H
const comp = new Compositor(glc, { preserve: true })
const sources = fakeSources(img)
// ÇEKİRDEK HATASI geçici yaması (yalnız bu test sayfasında): gl.js setUniform, float dizilerini (uA[17], uF[17])
// uniform1f(+dizi) → NaN → 0 olarak yüklüyor; renk ayarları hiç uygulanmıyor. ?nofix=1 ile yamasız görülebilir.
const PATCH = q.get('nofix') !== '1'
if (PATCH) {
  const origUse = comp.glw.use.bind(comp.glw)
  comp.glw.use = (prog, vals) => {
    const r = origUse(prog, vals)
    for (const k in vals) {
      const u = prog.uniforms[k], v = vals[k]
      if (u && u.size > 1 && u.type === comp.gl.FLOAT && (v instanceof Float32Array || Array.isArray(v))) comp.gl.uniform1fv(u.loc, v)
    }
    return r
  }
}

function renderWith(filter) {
  clip.filter = filter
  comp.render({ project: p, time: 1, sources, scale: SCALE })
  const t = document.createElement('canvas'); t.width = W; t.height = H
  const x = t.getContext('2d'); x.drawImage(glc, 0, 0)
  return { canvas: t, data: x.getImageData(0, 0, W, H).data }
}
const orig = renderWith(null)
function diff(a, b) { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (a.length / 4) / 3 }

const result = { total: 0, errors: [], weak: [], similar: [], cats: {} }
const LABEL = 30, GAP = 6
const all = []
for (const cat of FILTER_CATEGORIES.filter(c => !onlyCat || c.id === onlyCat)) {
  const items = FILTERS.filter(f => f.category === cat.id)
  result.cats[cat.id] = items.length
  const n = items.length + 1
  const rows = Math.ceil(n / COLS)
  const sheet = document.createElement('canvas')
  sheet.width = COLS * (W + GAP) + GAP; sheet.height = 34 + rows * (H + LABEL + GAP)
  const x = sheet.getContext('2d')
  x.fillStyle = '#141414'; x.fillRect(0, 0, sheet.width, sheet.height)
  x.fillStyle = '#E4FF3A'; x.font = '700 20px sans-serif'; x.fillText(`Filtreler — ${cat.name} (${items.length})${PATCH ? '' : '  [YAMASIZ]'}`, GAP, 24)
  const cells = [{ name: 'Orijinal', id: '—', r: orig }]
  for (const f of items) {
    result.total++
    const r = renderWith({ id: f.id, intensity: 1 })
    const err = comp.glw.errors.get('color:' + f.id)
    if (err && !result.errors.find(e => e[0] === f.id)) result.errors.push([f.id, err.slice(0, 300)])
    const d = diff(r.data, orig.data)
    if (d < 6) result.weak.push([f.id, +d.toFixed(1)])
    all.push({ id: f.id, data: r.data })
    cells.push({ name: f.name, id: f.id, r, d, swatch: f.swatch, err })
  }
  cells.forEach((cell, i) => {
    const cx = GAP + (i % COLS) * (W + GAP), cy = 34 + Math.floor(i / COLS) * (H + LABEL + GAP)
    x.drawImage(cell.r.canvas, cx, cy)
    if (cell.swatch) cell.swatch.forEach((s, k) => { x.fillStyle = s; x.fillRect(cx + W - 28 + k * 14, cy + H + 4, 12, 12) })
    x.fillStyle = cell.err ? '#ff3b3b' : '#ddd'; x.font = '600 12px sans-serif'
    x.fillText((cell.err ? '[HATA] ' : '') + cell.name, cx, cy + H + 14)
    x.fillStyle = '#888'; x.font = '10px monospace'
    x.fillText(`${cell.id}${cell.d != null ? '  Δ' + cell.d.toFixed(1) : ''}`, cx, cy + H + 26)
  })
  document.getElementById('out').appendChild(sheet)
  if (fs) fs.writeFileSync(`test-videos/out/filters-${cat.id}.png`, Buf.from(sheet.toDataURL('image/png').split(',')[1], 'base64'))
}
// birbirine çok benzeyen filtre çiftleri
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const d = diff(all[i].data, all[j].data)
  if (d < 4) result.similar.push([all[i].id, all[j].id, +d.toFixed(1)])
}
result.errorCount = result.errors.length
window.__result = result
window.__done = true
