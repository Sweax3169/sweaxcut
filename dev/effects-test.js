// Efekt temas föyü: her efekti test desenine uygular, ızgaraya çizer, derleme hatalarını ve
// "hiçbir şey yapmıyor / boş / hareketsiz" şüphelerini raporlar.
// URL: ?cat=glitch  ?only=a,b  ?t=1.3  ?t2=2.7  ?alpha=1 (saydam katman testi)  ?cols=6  ?w=256&h=144  ?save=0
import '../src/packs/effects/index.js'
import { EFFECTS, EFFECT_CATEGORIES } from '../src/packs/effects/index.js'
import { Compositor } from '../src/engine/compositor.js'
import { testPattern } from './testkit.js'

const q = new URLSearchParams(location.search)
const T1 = +(q.get('t') || 1.3), T2 = +(q.get('t2') || 2.7)
const W = +(q.get('w') || 256), H = +(q.get('h') || 144)
const COLS = +(q.get('cols') || 6)
const ALPHA = q.get('alpha') === '1'
const SAVE = q.get('save') !== '0'
const SUFFIX = q.get('suffix') || ''
const onlyCat = q.get('cat')
const only = q.get('only') ? q.get('only').split(',') : null
const fs = typeof window.require === 'function' ? window.require('fs') : null

const glc = document.getElementById('c')
const comp = new Compositor(glc, { preserve: true })

// saydam katman deseni (yazı + şekil, arka plan saydam)
function alphaPattern(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  x.fillStyle = '#ff5da2'; x.beginPath(); x.arc(w * 0.22, h * 0.5, h * 0.3, 0, 7); x.fill()
  x.fillStyle = '#fff'; x.font = `900 ${h * 0.42}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.strokeStyle = '#111'; x.lineWidth = h * 0.03; x.strokeText('GG!', w * 0.62, h * 0.52); x.fillText('GG!', w * 0.62, h * 0.52)
  return c
}
const src = ALPHA ? alphaPattern(W, H) : testPattern(W, H)
const srcData = src.getContext('2d').getImageData(0, 0, W, H).data

// efekti çalıştır → RGBA (üstten alta satırlar)
function renderFx(def, t) {
  const glw = comp.glw
  const e = comp._tex('fxtest-src')
  if (e.ver !== src) { glw.upload(e.tex, src); e.ver = src }
  const s = { tex: e.tex, w: W, h: H }
  comp.frameNo = (comp.frameNo || 0) + 1
  comp.ctx = { time: t, W, H, R: 1 }
  const fake = { id: 'preview', duration: def.previewDuration || 2 }
  let res = comp._effectPasses(s, def, {}, t, fake, s)
  if (res.w !== W || res.h !== H) { const full = glw.target(W, H); comp._blit(res, full); res = full }
  const buf = new Uint8Array(W * H * 4)
  comp.readPixels(res, buf)
  glw.releaseAll()
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) out.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
  return out
}

// resmi API yolu (previewEffect) da çalışsın diye ilk efektte doğrula
function previewApiCheck(def) {
  try { comp.previewEffect(src, W, H, def, {}, T1); return true } catch (e) { return String(e) }
}

function stats(px) {
  let dOrig = 0, sum = 0, sum2 = 0, aSum = 0
  const n = W * H
  for (let i = 0; i < n; i++) {
    const k = i * 4
    dOrig += Math.abs(px[k] - srcData[k]) + Math.abs(px[k + 1] - srcData[k + 1]) + Math.abs(px[k + 2] - srcData[k + 2]) + Math.abs(px[k + 3] - srcData[k + 3])
    const l = px[k] * 0.2126 + px[k + 1] * 0.7152 + px[k + 2] * 0.0722
    sum += l; sum2 += l * l; aSum += px[k + 3]
  }
  const mean = sum / n
  return { dOrig: dOrig / n / 4, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), alpha: aSum / n }
}
function diff(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length }

function checker(x, ox, oy) {
  for (let y = 0; y < H; y += 12) for (let xx = 0; xx < W; xx += 12) {
    x.fillStyle = ((xx + y) / 12) % 2 ? '#3a3a3a' : '#5a5a5a'
    x.fillRect(ox + xx, oy + y, 12, 12)
  }
}

// ?pairs=a,b,c → her efekti iki farklı zamanda yan yana çiz (animasyon doğrulaması)
const pairs = q.get('pairs') ? q.get('pairs').split(',') : null
if (pairs) {
  const sheet = document.createElement('canvas')
  sheet.width = 2 * (W + 6) + 6 + 200; sheet.height = 34 + pairs.length * (H + 22)
  const x = sheet.getContext('2d')
  x.fillStyle = '#141414'; x.fillRect(0, 0, sheet.width, sheet.height)
  x.fillStyle = '#E4FF3A'; x.font = '700 18px sans-serif'; x.fillText(`Animasyon: t=${T1}s  |  t=${T2}s`, 6, 22)
  const out = {}
  pairs.forEach((id, i) => {
    const def = EFFECTS.find(e => e.id === id); if (!def) return
    const a = renderFx(def, T1), b = renderFx(def, T2)
    out[id] = +diff(a, b).toFixed(2)
    const y = 34 + i * (H + 22)
    ;[a, b].forEach((px, k) => { const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').putImageData(new ImageData(px, W, H), 0, 0); x.drawImage(tmp, 6 + k * (W + 6), y) })
    x.fillStyle = '#ddd'; x.font = '600 13px sans-serif'; x.fillText(def.name, 2 * (W + 6) + 10, y + 20)
    x.fillStyle = '#888'; x.font = '11px monospace'; x.fillText('fark ' + out[id], 2 * (W + 6) + 10, y + 38)
  })
  document.getElementById('out').appendChild(sheet)
  if (fs) fs.writeFileSync('test-videos/out/effects-animasyon.png', (window.Buffer || window.require('buffer').Buffer).from(sheet.toDataURL('image/png').split(',')[1], 'base64'))
  window.__result = { pairs: out, errors: [...comp.glw.errors.keys()] }
  window.__done = true
  throw new Error('pairs bitti')
}

const result = { total: 0, errors: [], same: [], blank: [], static: [], api: null, cats: {} }
const cats = EFFECT_CATEGORIES.filter(c => !onlyCat || c.id === onlyCat)
const outDiv = document.getElementById('out')
const LABEL = 30, GAP = 6

for (const cat of cats) {
  const items = EFFECTS.filter(e => e.category === cat.id && (!only || only.includes(e.id)))
  if (!items.length) continue
  result.cats[cat.id] = items.length
  const rows = Math.ceil(items.length / COLS)
  const sheet = document.createElement('canvas')
  sheet.width = COLS * (W + GAP) + GAP
  sheet.height = 34 + rows * (H + LABEL + GAP)
  const x = sheet.getContext('2d')
  x.fillStyle = '#141414'; x.fillRect(0, 0, sheet.width, sheet.height)
  x.fillStyle = '#E4FF3A'; x.font = '700 20px sans-serif'; x.fillText(`${cat.name} (${items.length})${ALPHA ? ' — saydam' : ''}  t=${T1}`, GAP, 24)
  items.forEach((def, i) => {
    result.total++
    if (result.api === null) result.api = previewApiCheck(def)
    const cx = GAP + (i % COLS) * (W + GAP), cy = 34 + Math.floor(i / COLS) * (H + LABEL + GAP)
    const errBefore = comp.glw.errors.size
    let px1, px2
    try { px1 = renderFx(def, T1); px2 = renderFx(def, T2) } catch (e) { result.errors.push([def.id, String(e)]); return }
    const errs = [...comp.glw.errors.entries()].filter(([k]) => k.startsWith('fx:' + def.id + ':'))
    if (comp.glw.errors.size > errBefore || errs.length) for (const [k, m] of errs) if (!result.errors.find(r => r[0] === k)) result.errors.push([k, m.slice(0, 400)])
    const st = stats(px1)
    const anim = diff(px1, px2)
    let flag = ''
    if (errs.length) flag = 'HATA'
    else if (st.dOrig < 0.8) { flag = 'AYNI'; result.same.push(def.id) }
    else if (st.std < 2 && !ALPHA) { flag = 'BOŞ'; result.blank.push(def.id) }
    if (anim < 0.3) result.static.push(def.id)
    // çiz
    if (ALPHA) checker(x, cx, cy)
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
    tmp.getContext('2d').putImageData(new ImageData(px1, W, H), 0, 0)
    x.drawImage(tmp, cx, cy)
    x.fillStyle = flag ? '#ff3b3b' : '#ddd'
    x.font = '600 12px sans-serif'
    x.fillText((flag ? '[' + flag + '] ' : '') + def.name, cx, cy + H + 13)
    x.fillStyle = '#888'; x.font = '10px monospace'
    x.fillText(`${def.id}  Δ${st.dOrig.toFixed(1)} σ${st.std.toFixed(0)} ~${anim.toFixed(1)}`, cx, cy + H + 25)
  })
  outDiv.appendChild(sheet)
  if (SAVE && fs) {
    const name = `test-videos/out/effects-${cat.id}${ALPHA ? '-alpha' : ''}${SUFFIX}.png`
    fs.writeFileSync(name, (window.Buffer || window.require('buffer').Buffer).from(sheet.toDataURL('image/png').split(',')[1], 'base64'))
  }
}
result.errorCount = result.errors.length
window.__result = result
window.__done = true
