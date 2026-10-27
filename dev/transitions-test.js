// Geçiş temas föyü: her geçiş ilerleme=p (varsayılan 0.5) anında + derleme hataları + uç nokta denetimi
// ?page=0&per=56&p=0.5&cat=kaydir&ids=a,b
import * as model from '../src/core/model.js'
import { Compositor } from '../src/engine/compositor.js'
import { list, REG } from '../src/engine/registry.js'
import { GL_DROPPED } from '../src/packs/transitions/index.js'
import { testPattern, testPatternB, twoSources, twoClipProject } from './packtest-kit.js'

const qs = new URLSearchParams(location.search)
const page = +(qs.get('page') || 0)
const per = +(qs.get('per') || 56)
const prog = +(qs.get('p') || 0.5)
const cat = qs.get('cat')
const ids = qs.get('ids') ? qs.get('ids').split(',') : null
const checkEnds = qs.get('ends') !== '0'
const ratio = qs.get('ratio') || '16:9'

const imgA = testPattern(), imgB = testPatternB()
const { p, a } = twoClipProject(model, imgA, imgB, ratio)
const PW = p.settings.width, PH = p.settings.height
const sources = twoSources(imgA, imgB)
const glc = document.getElementById('gl')
const comp = new Compositor(glc, { preserve: true })
const gl = comp.gl

let all = list('transitions')
if (cat) all = all.filter(t => t.category === cat)
if (ids) all = ids.map(id => REG.transitions.byId.get(id)).filter(Boolean)
const items = all.slice(page * per, page * per + per)

const W = window.innerWidth, H = window.innerHeight
const sheet = document.getElementById('sheet')
sheet.width = W; sheet.height = H
const x = sheet.getContext('2d')
x.fillStyle = '#0d0d0d'; x.fillRect(0, 0, W, H)
const cols = PW >= PH ? 8 : 14
const cw = Math.floor(W / cols)
const th = Math.round(cw * PH / PW)
const rh = th + 22

function renderAt(time, scale) {
  const w = Math.round(PW * scale), h = Math.round(PH * scale)
  if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h }
  comp.render({ project: p, time, sources, scale })
  return { w, h }
}
function grab(w, h) {
  const px = new Uint8Array(w * h * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
  return px
}
function diff(A, B) {
  let s = 0
  for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])
  return s / (A.length / 4) / 3
}
function meanLuma(A) {
  let s = 0
  for (let i = 0; i < A.length; i += 4) s += A[i] * 0.3 + A[i + 1] * 0.59 + A[i + 2] * 0.11
  return s / (A.length / 4)
}

const SMALL = 110 / PW
// referans kareler (geçişsiz)
a.transition = null
let r = renderAt(1, SMALL); const refA = grab(r.w, r.h)
r = renderAt(5, SMALL); const refB = grab(r.w, r.h)

const errors = {}
const endIssues = []
const darkIssues = []
const t0 = performance.now()
items.forEach((tr, i) => {
  a.transition = { id: tr.id, duration: 1 }
  const before = comp.glw.errors.size
  // uç noktalar
  if (checkEnds) {
    r = renderAt(2.5, SMALL); const e0 = diff(grab(r.w, r.h), refA)
    r = renderAt(3.5 - 1e-4, SMALL); const e1 = diff(grab(r.w, r.h), refB)
    if (e0 > 4 || e1 > 4) endIssues.push({ id: tr.id, start: +e0.toFixed(1), end: +e1.toFixed(1) })
  }
  // föy hücresi
  r = renderAt(2.5 + prog, cw / PW)
  const mid = grab(r.w, r.h)
  const lum = meanLuma(mid)
  if (lum < 6) darkIssues.push({ id: tr.id, luma: +lum.toFixed(1) })
  const err = comp.glw.errors.size > before ? comp.glw.errors.get('tr:' + tr.id) : null
  if (err) errors[tr.id] = err
  const cx = (i % cols) * cw, cy = Math.floor(i / cols) * rh
  x.drawImage(glc, cx + 1, cy + 1, cw - 2, th - 2)
  if (err) { x.strokeStyle = '#ff2040'; x.lineWidth = 3; x.strokeRect(cx + 2, cy + 2, cw - 4, th - 4) }
  x.fillStyle = err ? '#ff5060' : (endIssues.find(e => e.id === tr.id) ? '#ffb020' : '#e4ff3a')
  x.font = '600 12px Archivo, sans-serif'
  x.fillText((page * per + i + 1) + '. ' + tr.name, cx + 4, cy + th + 13)
  x.fillStyle = '#777'; x.font = '10px monospace'
  x.fillText(tr.category + ' · ' + tr.id, cx + 4, cy + th + 21 + 0)
})

const counts = {}
const customCounts = {}, glCounts = {}
for (const t of list('transitions')) { counts[t.category] = (counts[t.category] || 0) + 1; const m = t.id.startsWith('gl-') ? glCounts : customCounts; m[t.category] = (m[t.category] || 0) + 1 }
window.__result = {
  total: list('transitions').length, page, shown: items.length, pages: Math.ceil(all.length / per), progress: prog,
  counts, customCounts, glCounts, glDropped: GL_DROPPED, errors, endIssues, darkIssues, ms: Math.round(performance.now() - t0),
  allErrors: [...comp.glw.errors.entries()].filter(([k]) => !k.startsWith('tr:') || !errors[k.slice(3)]),
}
window.__done = true
