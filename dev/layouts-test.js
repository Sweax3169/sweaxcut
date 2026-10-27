// Düzen testi: her düzen 2 klip (oyun + kamera) ve tek klip (otomatik facecam kırpma) ile bileşimciden çizilir
import * as model from '../src/core/model.js'
import { Compositor } from '../src/engine/compositor.js'
import { testPattern } from './testkit.js'
import { list } from '../src/engine/registry.js'
import '../src/packs/layouts/index.js'
import { DEFAULT_CAM_SRC } from '../src/packs/layouts/index.js'

const g = document.getElementById('g')
const game = testPattern(1920, 1080)
{ // oyun görüntüsünün sol-alt köşesine sahte facecam
  const x = game.getContext('2d'), r = DEFAULT_CAM_SRC
  const X = r.x * 1920, Y = r.y * 1080, Wc = r.w * 1920, Hc = r.h * 1080
  x.fillStyle = '#2b5d3a'; x.fillRect(X, Y, Wc, Hc)
  x.fillStyle = '#ffd7a8'; x.beginPath(); x.arc(X + Wc / 2, Y + Hc * 0.45, Hc * 0.28, 0, 7); x.fill()
  x.fillStyle = '#111'; x.fillRect(X + Wc * 0.4, Y + Hc * 0.38, 12, 12); x.fillRect(X + Wc * 0.58, Y + Hc * 0.38, 12, 12)
  x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(X, Y, Wc, Hc)
}
const cam = document.createElement('canvas'); cam.width = 1280; cam.height = 720
{ const x = cam.getContext('2d'); x.fillStyle = '#6b2b8a'; x.fillRect(0, 0, 1280, 720); x.fillStyle = '#ffd7a8'; x.beginPath(); x.arc(640, 330, 210, 0, 7); x.fill(); x.fillStyle = '#111'; x.fillRect(560, 280, 30, 30); x.fillRect(690, 280, 30, 30); x.fillRect(570, 420, 140, 20); x.fillStyle = '#fff'; x.font = '900 70px sans-serif'; x.fillText('KAMERA', 470, 680) }
const imgs = { g: game, c: cam }
const sources = { image: (m) => ({ src: imgs[m.id], w: imgs[m.id].width, h: imgs[m.id].height }), videoFrame: (c, m) => ({ src: imgs[m.id], w: imgs[m.id].width, h: imgs[m.id].height }) }

function makeProject(two) {
  const p = model.createProject({ ratio: '16:9' })
  p.media.g = { id: 'g', type: 'image', name: 'oyun', width: 1920, height: 1080, duration: 5 }
  p.media.c = { id: 'c', type: 'image', name: 'kamera', width: 1280, height: 720, duration: 5 }
  const a = model.createMediaClip(p.media.g, { duration: 5 })
  p.tracks[0].clips.push(a)
  const sel = [a.id]
  if (two) { const b = model.createMediaClip(p.media.c, { duration: 5 }); p.tracks.unshift(model.createTrack('video', { clips: [b] })); sel.push(b.id) }
  return { p, sel }
}
const glc = document.createElement('canvas')
const comp = new Compositor(glc, { preserve: true })
const errors = []
function render(p, box = 230) {
  const W = p.settings.width, H = p.settings.height, k = box / Math.max(W, H)
  glc.width = Math.round(W * k); glc.height = Math.round(H * k)
  comp.render({ project: p, time: 1, sources, scale: k })
  const c = document.createElement('canvas'); c.width = glc.width; c.height = glc.height
  c.getContext('2d').drawImage(glc, 0, 0)
  return c
}
const out = []
for (const L of list('layouts')) {
  const cell = document.createElement('div'); cell.className = 'c'
  const b = document.createElement('b'); b.textContent = L.name; cell.appendChild(b)
  const row = document.createElement('div'); row.className = 'row'
  for (const two of [true, false]) {
    const { p, sel } = makeProject(two)
    try { L.apply(p, { selectedClipIds: sel, time: 1, ui: {} }) } catch (e) { errors.push({ id: L.id, two, err: String(e.stack || e) }) }
    row.appendChild(render(p))
    out.push({ id: L.id, two, ratio: p.settings.ratio, tracks: p.tracks.map(t => t.kind + ':' + t.clips.length).join(','), regions: (L.regions || []).length })
  }
  cell.appendChild(row); g.appendChild(cell)
}
window.__result = { count: list('layouts').length, errors, glErrors: [...comp.glw.errors.entries()], out }
setTimeout(() => { window.__done = true }, 300)
