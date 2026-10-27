// Klip animasyonu föyü (?cat=in|out|loop&p=0.35) + hız eğrileri (?view=curves)
// Her durumda tüm animasyonlar programlı denetlenir: nötr uç kuralı, NaN, döngü periyodikliği, hız eğrisi sınırları.
import * as model from '../src/core/model.js'
import { Compositor } from '../src/engine/compositor.js'
import { list } from '../src/engine/registry.js'
import { curveMean, curveSpeedAt } from '../src/core/time.js'
import '../src/packs/clipAnims/index.js'
import '../src/packs/speedCurves/index.js'
import { testPattern } from './packtest-kit.js'

const qs = new URLSearchParams(location.search)
const cat = qs.get('cat') || 'in'
const prog = +(qs.get('p') || 0.35)
const view = qs.get('view') || 'anims'

const NEUTRAL = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, blur: 0, brightness: 0, rgbSplit: 0, skewX: 0, skewY: 0 }
const KEYS = Object.keys(NEUTRAL)
const ctx0 = { w: 1920, h: 1080, seed: 123456789 }

// ---------------------------------------------------------------- programlı denetim
const violations = [], nanIssues = [], loopIssues = [], loopStats = {}
const anims = list('clipAnims')
for (const a of anims) {
  const check = (p) => {
    let r
    try { r = a.fn(p, ctx0) || {} } catch (e) { nanIssues.push({ id: a.id, p, err: String(e) }); return null }
    for (const k of Object.keys(r)) if (KEYS.includes(k) && !Number.isFinite(r[k])) nanIssues.push({ id: a.id, p, key: k, v: r[k] })
    return r
  }
  for (let i = 0; i <= 100; i++) check(i / 100)
  const neutralAt = a.category === 'in' ? 1 : a.category === 'out' ? 0 : null
  if (neutralAt != null) {
    const r = check(neutralAt) || {}
    for (const k of KEYS) {
      const v = r[k] ?? NEUTRAL[k]
      if (Math.abs(v - NEUTRAL[k]) > 1e-6) violations.push({ id: a.id, key: k, v })
    }
    // gizli uçta bir şey değişmeli (yoksa animasyon görünmez)
    const h = check(a.category === 'in' ? 0 : 1) || {}
    if (!KEYS.some(k => Math.abs((h[k] ?? NEUTRAL[k]) - NEUTRAL[k]) > 1e-3)) violations.push({ id: a.id, key: '(etkisiz)', v: 0 })
  } else {
    let maxDiff = 0, mx = { scale: 0, pos: 0, rot: 0 }
    for (let i = 0; i < 40; i++) {
      const p = i / 40 + 0.0123
      const r1 = check(p) || {}, r2 = check(p + 1) || {}, r3 = check(p + 3) || {}
      for (const k of KEYS) maxDiff = Math.max(maxDiff, Math.abs((r1[k] ?? NEUTRAL[k]) - (r2[k] ?? NEUTRAL[k])), Math.abs((r1[k] ?? NEUTRAL[k]) - (r3[k] ?? NEUTRAL[k])))
      mx.scale = Math.max(mx.scale, Math.abs((r1.scale ?? 1) * (r1.scaleX ?? 1) - 1), Math.abs((r1.scale ?? 1) * (r1.scaleY ?? 1) - 1))
      mx.pos = Math.max(mx.pos, Math.abs(r1.x || 0), Math.abs(r1.y || 0))
      mx.rot = Math.max(mx.rot, Math.abs(r1.rotation || 0))
    }
    if (maxDiff > 1e-6) loopIssues.push({ id: a.id, periodDiff: maxDiff })
    loopStats[a.id] = { scale: +mx.scale.toFixed(3), pos: +mx.pos.toFixed(3), rot: +mx.rot.toFixed(1) }
  }
}
const curves = list('speedCurves')
const curveIssues = []
const curveInfo = {}
for (const c of curves) {
  const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y)
  if (xs[0] !== 0 || xs[xs.length - 1] !== 1) curveIssues.push({ id: c.id, err: 'x 0..1 değil' })
  for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) curveIssues.push({ id: c.id, err: 'x sırasız', i })
  if (ys.some(y => !(y >= 0.1 && y <= 8))) curveIssues.push({ id: c.id, err: 'y aralık dışı' })
  curveInfo[c.id] = { mean: +curveMean(c).toFixed(2), min: Math.min(...ys), max: Math.max(...ys), n: xs.length }
}
const counts = {}
for (const a of anims) counts[a.category] = (counts[a.category] || 0) + 1

// ---------------------------------------------------------------- föy
const W = window.innerWidth, H = window.innerHeight
const sheet = document.getElementById('sheet')
sheet.width = W; sheet.height = H
const x = sheet.getContext('2d')
x.fillStyle = '#0d0d0d'; x.fillRect(0, 0, W, H)

if (view === 'curves') {
  const cols = 6, cw = Math.floor(W / cols), chh = 150
  curves.forEach((c, i) => {
    const cx = (i % cols) * cw + 10, cy = Math.floor(i / cols) * (chh + 24) + 8
    const w = cw - 20, h = chh
    x.strokeStyle = '#333'; x.lineWidth = 1; x.strokeRect(cx, cy, w, h)
    const Y = v => cy + h - (Math.log(v) - Math.log(0.1)) / (Math.log(8) - Math.log(0.1)) * h
    x.strokeStyle = '#444'; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(cx, Y(1)); x.lineTo(cx + w, Y(1)); x.stroke(); x.setLineDash([])
    x.strokeStyle = '#e4ff3a'; x.lineWidth = 2; x.beginPath()
    for (let k = 0; k <= 200; k++) { const t = k / 200; const yy = Y(curveSpeedAt(c, t)); k ? x.lineTo(cx + t * w, yy) : x.moveTo(cx + t * w, yy) }
    x.stroke()
    x.fillStyle = '#3FA9F5'; for (const p of c.points) { x.fillRect(cx + p.x * w - 2, Y(p.y) - 2, 4, 4) }
    x.fillStyle = '#e4ff3a'; x.font = '600 13px Archivo, sans-serif'; x.fillText(c.name, cx, cy + h + 15)
    x.fillStyle = '#888'; x.font = '10px monospace'; x.fillText('ort ' + curveInfo[c.id].mean + 'x  ' + curveInfo[c.id].min + '–' + curveInfo[c.id].max, cx + w - 120, cy + h + 15)
  })
} else {
  const img = testPattern()
  const p = model.createProject({ ratio: '16:9' })
  p.settings.bg = { ...p.settings.bg, type: 'color', color: '#1a1a1a' }
  p.media.m1 = { id: 'm1', type: 'image', name: 't', width: img.width, height: img.height, duration: 5 }
  const clip = model.createMediaClip(p.media.m1, { duration: 4 })
  clip.transform.scale = 0.62
  p.tracks[0].clips.push(clip)
  const sources = { image: () => ({ src: img, w: img.width, h: img.height }), videoFrame: () => ({ src: img, w: img.width, h: img.height }) }
  const glc = document.getElementById('gl')
  const comp = new Compositor(glc, { preserve: true })
  const items = anims.filter(a => a.category === cat)
  const cols = 9, cw = Math.floor(W / cols), th = Math.round(cw * 9 / 16), rh = th + 22
  const scale = cw / 1920
  glc.width = Math.round(1920 * scale); glc.height = Math.round(1080 * scale)
  items.forEach((a, i) => {
    clip.anim = { in: null, out: null, loop: null }
    let lt
    if (cat === 'in') { clip.anim.in = { id: a.id, duration: a.duration }; lt = prog * a.duration }
    else if (cat === 'out') { clip.anim.out = { id: a.id, duration: a.duration }; lt = clip.duration - a.duration + prog * a.duration }
    else { clip.anim.loop = { id: a.id, duration: a.duration }; lt = prog * a.duration }
    comp.render({ project: p, time: lt, sources, scale })
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * rh
    x.drawImage(glc, cx + 1, cy + 1, cw - 2, th - 2)
    // nötr konum çerçevesi
    x.strokeStyle = 'rgba(228,255,58,0.35)'; x.setLineDash([2, 3]); x.lineWidth = 1
    x.strokeRect(cx + cw / 2 - cw * 0.31, cy + th / 2 - th * 0.31, cw * 0.62, th * 0.62); x.setLineDash([])
    const bad = violations.some(v => v.id === a.id) || nanIssues.some(v => v.id === a.id) || loopIssues.some(v => v.id === a.id)
    x.fillStyle = bad ? '#ff5060' : '#e4ff3a'; x.font = '600 12px Archivo, sans-serif'
    x.fillText((i + 1) + '. ' + a.name, cx + 4, cy + th + 13)
    x.fillStyle = '#777'; x.font = '10px monospace'; x.fillText(a.id + ' · ' + a.duration + 's', cx + 4, cy + th + 21)
  })
}

window.__result = { counts, curves: curves.length, violations, nanIssues, loopIssues, curveIssues, loopStats: qs.get('stats') ? loopStats : undefined, curveInfo: view === 'curves' ? curveInfo : undefined }
window.__done = true
