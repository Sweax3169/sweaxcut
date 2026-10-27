// Çıkartma temas föyü: ?page=vec (vektörler t=0.6), ?page=emoji (emoji + animasyon hazırları), ?strip=id1,id2 (zaman şeridi)
import '../src/packs/stickers/index.js'
import { list, get } from '../src/engine/registry.js'
import { renderStickerLayer, STICKER_ANIMS } from '../src/engine/sticker-render.js'
import { VECTOR_STICKERS, EMOJI_STICKERS } from '../src/packs/stickers/index.js'

const q = new URLSearchParams(location.search)
const page = q.get('page') || 'vec'
const T0 = +(q.get('t') || 0.6)
const g = document.getElementById('g')
const errors = []
const project = { settings: { width: 1080, height: 1920 } }

function cell(label, canvas, err) {
  const d = document.createElement('div'); d.className = 'c' + (err ? ' err' : '')
  d.appendChild(canvas)
  const b = document.createElement('b'); b.textContent = label; d.appendChild(b)
  g.appendChild(d)
}
function drawDirect(def, t, box = 116) {
  const a = def.aspect || 1
  const w = Math.round(a >= 1 ? box : box * a), h = Math.round(a >= 1 ? box / a : box)
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2
  c.style.width = w + 'px'; c.style.height = h + 'px'
  let err = null
  try { def.draw(c.getContext('2d'), t, w * 2, h * 2, {}) } catch (e) { err = String(e && e.stack || e); errors.push({ id: def.id, err }) }
  return { c, err }
}
function heading(s) { const h = document.createElement('h3'); h.textContent = s; h.style.gridColumn = '1/-1'; g.appendChild(h) }

async function run() {
  if (document.fonts) await document.fonts.ready
  if (q.get('big')) {
    g.style.gridTemplateColumns = 'repeat(auto-fill,390px)'
    document.head.insertAdjacentHTML('beforeend', '<style>.c{height:300px}.c canvas{max-width:386px;max-height:280px}</style>')
    for (const id of q.get('big').split(',')) {
      const def = get('stickers', id)
      if (!def) continue
      const { c, err } = drawDirect(def, T0, 380); cell(id, c, err)
    }
  } else if (q.get('strip')) {
    g.style.gridTemplateColumns = 'repeat(8,124px)'
    for (const id of q.get('strip').split(',')) {
      const def = get('stickers', id)
      if (!def) continue
      const loop = def.loop || 2
      for (let i = 0; i < 8; i++) { const t = (i / 8) * loop * 1.0 + 0.001; const { c, err } = drawDirect(def, t); cell(id + ' t=' + t.toFixed(2), c, err) }
    }
  } else if (page === 'vec') {
    const cats = {}
    for (const d of VECTOR_STICKERS) (cats[d.category] = cats[d.category] || []).push(d)
    for (const d of VECTOR_STICKERS) { const { c, err } = drawDirect(d, T0); cell(d.name, c, err) }
  } else {
    // emoji örnekleri — her kategoriden
    const byCat = {}
    for (const e of EMOJI_STICKERS) (byCat[e.category] = byCat[e.category] || []).push(e)
    const sample = []
    for (const k in byCat) sample.push(...byCat[k].filter((_, i) => i % Math.ceil(byCat[k].length / 9) === 0).slice(0, 9))
    let n = 0
    for (const e of sample) {
      const clip = { id: 'e' + (n++), sticker: { kind: 'emoji', id: e.id, params: {} } }
      renderStickerLayer(clip, 0, 0.25, project, null)
    }
    renderStickerLayer({ id: 'warm', sticker: { kind: 'emoji', id: 'emoji-1f525', params: {} } }, 0, 0.25, project, null)
    // yüklenmeyi bekle
    await new Promise(r => setTimeout(r, 1200))
    n = 0
    for (const e of sample) {
      const clip = { id: 'e' + (n++), sticker: { kind: 'emoji', id: e.id, params: {} } }
      const r = renderStickerLayer(clip, 0, 0.25, project, null)
      if (!r) { errors.push({ id: e.id, err: 'yüklenmedi' }); continue }
      const c = document.createElement('canvas'); c.width = r.width; c.height = r.height; c.getContext('2d').drawImage(r.canvas, 0, 0)
      cell(e.name, c)
    }
    heading('Animasyon hazırları (🔥 t = 0.15 / 0.45)')
    for (const a of STICKER_ANIMS) for (const t of [0.15, 0.45]) {
      const clip = { id: 'a' + a.value + t, sticker: { kind: 'emoji', id: 'emoji-1f525', params: { anim: a.value } } }
      const r = renderStickerLayer(clip, t, 0.25, project, null)
      if (!r) { errors.push({ id: a.value, err: 'anim yok' }); continue }
      const c = document.createElement('canvas'); c.width = r.width; c.height = r.height
      const x = c.getContext('2d'); x.strokeStyle = '#555'; x.strokeRect(0.5, 0.5, r.width - 1, r.height - 1); x.drawImage(r.canvas, 0, 0)
      cell(a.label + ' ' + t, c)
    }
    heading('Vektör + renderStickerLayer (parametreli)')
    const tests = [['pow', { text: 'GOL!' }], ['can-bari', { value: 20 }], ['klavye-tusu', { key: 'SPACE' }], ['konusma-balonu', { text: 'Bu çok uzun bir cümle, sığacak mı?' }], ['zafer-bandi', { text: 'ŞAMPİYON' }], ['oldurme-sayaci', { value: 12 }]]
    tests.forEach(([id, params], i) => {
      const clip = { id: 'v' + i, sticker: { kind: 'vector', id, params } }
      const r = renderStickerLayer(clip, 0.9, 0.27, project, null)
      if (!r) { errors.push({ id, err: 'null' }); return }
      const c = document.createElement('canvas'); c.width = r.width; c.height = r.height; c.getContext('2d').drawImage(r.canvas, 0, 0)
      cell(id + ' ' + JSON.stringify(params).slice(0, 18), c)
    })
  }
  const cats = {}
  for (const d of list('stickers')) cats[d.category] = (cats[d.category] || 0) + 1
  window.__result = { vectors: VECTOR_STICKERS.length, emoji: EMOJI_STICKERS.length, cats, errors }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise(r => setTimeout(r, 300))
  window.__done = true
}
run()
