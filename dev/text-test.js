// Yazı sistemi test sayfası — ?s=tpl&p=0 | anim&p=0 | cap | font&p=0 | comp | jitter
import * as model from '../src/core/model.js'
import { list, get } from '../src/engine/registry.js'
import { loadFonts } from '../src/packs/fonts/index.js'
import { applyTextTemplate, applyCaptionStyle } from '../src/packs/text/index.js'
import { renderTextLayer } from '../src/engine/text-render.js'
import { Compositor } from '../src/engine/compositor.js'
import { fakeSources } from './testkit.js'

const q = new URLSearchParams(location.search)
const S = q.get('s') || 'tpl'
const PAGE = +(q.get('p') || 0)
const TOP = 22
const W = innerWidth, H = innerHeight - TOP
const cv = document.getElementById('c')
cv.width = W; cv.height = H + TOP
const g = cv.getContext('2d')
g.translate(0, TOP)
// başlık şeridi tuvale çizilir (tuval doğrudan PNG'ye yazılıyor)
const hdr = { set textContent(v) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#181818'; g.fillRect(0, 0, W, TOP); g.fillStyle = '#E4FF3A'; g.font = '600 11px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(v, 8, TOP / 2); g.restore() } }
document.getElementById('hdr').remove()
const errors = []
const result = { section: S, page: PAGE, errors }
window.addEventListener('error', e => errors.push(String(e.message)))

const project = model.createProject({ ratio: '9:16' })
let idn = 0
function textClip(text, extra = {}) {
  const c = model.createTextClip({ text, duration: 6, ...extra })
  c.id = 'tc' + (idn++)
  return c
}
function cellBg(x, y, w, h, i) {
  const gr = g.createLinearGradient(x, y, x + w, y + h)
  const hues = [[34, 48, 62], [58, 38, 52], [30, 52, 44], [52, 46, 30]]
  const c = hues[i % hues.length]
  gr.addColorStop(0, `rgb(${c[0]},${c[1]},${c[2]})`); gr.addColorStop(1, `rgb(${c[0] * 0.45 | 0},${c[1] * 0.45 | 0},${c[2] * 0.45 | 0})`)
  g.fillStyle = gr; g.fillRect(x, y, w, h)
  g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}
function label(x, y, w, h, txt, bad) {
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + 1, y + h - 15, w - 2, 14)
  g.fillStyle = bad ? '#ff5050' : '#E4FF3A'; g.font = '600 10px "JetBrains Mono", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle'
  g.fillText(txt, x + 4, y + h - 8, w - 8)
}
function blit(r, x, y, w, h, outline) {
  if (!r || !r.canvas) return
  const sc = Math.min(1, (w - 6) / r.width, (h - 20) / r.height)
  const dw = r.width * sc, dh = r.height * sc
  const dx = x + (w - dw) / 2, dy = y + (h - 16 - dh) / 2
  g.drawImage(r.canvas, dx, dy, dw, dh)
  if (outline) { g.strokeStyle = 'rgba(228,255,58,0.35)'; g.setLineDash([3, 3]); g.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1); g.setLineDash([]) }
  return sc
}
function grid(n, cols, rows) {
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows)
  const out = []
  for (let i = 0; i < n; i++) out.push([(i % cols) * cw, Math.floor(i / cols) * ch, cw, ch])
  return out
}
function safe(fn, tag) { try { return fn() } catch (e) { errors.push(tag + ': ' + (e.stack || e.message).split('\n').slice(0, 2).join(' | ')); return null } }

// Türkçe glif denetimi: yedek yazı tipi monospace ve serif iken çizim aynıysa glif ailenin kendisinden gelir
function glyphCheck(fam, weight, style) {
  const chars = 'ĞÜŞİÖÇğüşıöç'
  const a = document.createElement('canvas'); a.width = a.height = 64
  const b = document.createElement('canvas'); b.width = b.height = 64
  const xa = a.getContext('2d', { willReadFrequently: true }), xb = b.getContext('2d', { willReadFrequently: true })
  const miss = []
  for (const ch of chars) {
    for (const [x, fb] of [[xa, 'monospace'], [xb, 'serif']]) {
      x.clearRect(0, 0, 64, 64); x.font = `${style === 'italic' ? 'italic ' : ''}${weight} 40px "${fam}", ${fb}`; x.fillStyle = '#000'; x.textBaseline = 'middle'; x.fillText(ch, 8, 32)
    }
    const da = xa.getImageData(0, 0, 64, 64).data, db = xb.getImageData(0, 0, 64, 64).data
    let diff = 0
    for (let i = 3; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > 40) diff++
    if (diff > 6) miss.push(ch)
  }
  return miss.join('')
}

async function run() {
  const t0 = performance.now()
  if (S === 'fallback') {
    // yazı tipi yüklenmeden çiz → yedekle çizer, yüklenince __sweaxRedraw çağrılır ve anahtar değişir
    let redraws = 0
    window.__sweaxRedraw = () => { redraws++ }
    const c = textClip({ content: 'Bungee Shade ĞŞİ', font: 'Bungee Shade', weight: 400, size: 96 })
    const r1 = renderTextLayer(c, 1, 0.5, project)
    const k1 = r1.key, w1 = r1.width
    const tw = performance.now()
    while (!redraws && performance.now() - tw < 5000) await new Promise(r => setTimeout(r, 50))
    const r2 = renderTextLayer(c, 1, 0.5, project)
    result.fallback = { redraws, waitMs: Math.round(performance.now() - tw), keyChanged: r2.key !== k1, w1, w2: r2.width, loaded: document.fonts.check('400 48px "Bungee Shade"', 'ĞŞİ') }
    const ef = await (await import('../src/packs/fonts/index.js')).ensureFont('Cinzel')
    result.ensureFont = ef
    g.drawImage(r2.canvas, 20, 20)
    hdr.textContent = 'YEDEK YAZI TİPİ TESTİ'
    window.__result = result
    window.__done = true
    return
  }
  const fl = await loadFonts()
  result.fontLoad = { ...fl, ms: Math.round(performance.now() - t0) }
  const anims = list('textAnims'), tpls = list('textTemplates'), caps = list('captionStyles'), fonts = list('fonts')
  result.counts = { fonts: fonts.length, fontFiles: fonts.reduce((a, f) => a + f.files.length, 0), animIn: anims.filter(a => a.category === 'in').length, animOut: anims.filter(a => a.category === 'out').length, animLoop: anims.filter(a => a.category === 'loop').length, templates: tpls.length, captions: caps.length }
  const fam = new Set(fonts.map(f => f.id))
  result.missingFonts = [...new Set([...tpls.map(t => t.text.font), ...caps.map(c => c.text.font)].filter(f => f && !fam.has(f)))]
  result.badAnimRefs = tpls.flatMap(t => Object.values(t.anim || {}).map(a => a.id).filter(id => !get('textAnims', id)).map(id => t.id + ':' + id))

  if (S === 'tpl') {
    const per = 42, items = tpls.slice(PAGE * per, PAGE * per + per)
    const cells = grid(items.length, 6, 7)
    items.forEach((t, i) => {
      const [x, y, w, h] = cells[i]
      cellBg(x, y, w, h, i)
      const c = textClip({ content: 'x' })
      applyTextTemplate(c, t.id, { useSample: true })
      const r = safe(() => renderTextLayer(c, 3, 0.3, project), t.id)
      blit(r, x, y, w, h)
      label(x, y, w, h, `${PAGE * per + i + 1}. ${t.name} · ${t.category}`)
    })
    hdr.textContent = `ŞABLONLAR ${PAGE * per + 1}-${PAGE * per + items.length} / ${tpls.length}`
  } else if (S === 'one') {
    // seçili şablonları büyük çiz: ?s=one&ids=a,b,c&t=3&sc=0.8
    const ids = (q.get('ids') || '').split(',').filter(Boolean)
    const cols = +(q.get('cols') || 2), rows = Math.ceil(ids.length / cols)
    const cells = grid(ids.length, cols, rows)
    ids.forEach((id, i) => {
      const [x, y, w, h] = cells[i]
      cellBg(x, y, w, h, i)
      const c = textClip({ content: 'x' })
      if (get('captionStyles', id)) {
        const cs = get('captionStyles', id)
        const src = cs.emoji ? ['para', 'ateş', 'kazandık', 'efsane', 'gol', 'şok'] : ['BU', 'OYUN', 'GERÇEKTEN', 'ÇOK', 'İYİ', 'ŞAMPİYON']
        c.caption = { words: src.slice(0, Math.max(2, Math.min(6, cs.words || 3))).map((w, k) => ({ w, s: k * 0.4, e: k * 0.4 + 0.38 })), styleId: id }
        applyCaptionStyle(c, id)
      } else if (get('textTemplates', id)) applyTextTemplate(c, id, { useSample: true })
      else if (get('textAnims', id)) { Object.assign(c.text, { content: 'Yazı ĞÜŞ\nçok iyi', font: 'Archivo Black', weight: 400, size: 110 }); const a = get('textAnims', id); c.anim = { [a.category]: { id, duration: a.duration } } }
      const r = safe(() => renderTextLayer(c, +(q.get('t') || (get('captionStyles', id) ? 0.7 : 3)), +(q.get('sc') || 0.8), project), id)
      blit(r, x, y, w, h, true)
      label(x, y, w, h, id + (r ? ` ${r.width}x${r.height}` : ''))
    })
    hdr.textContent = 'YAKIN İNCELEME'
  } else if (S === 'anim') {
    const per = 48, items = anims.slice(PAGE * per, PAGE * per + per)
    const cells = grid(items.length, 8, 6)
    const phase = +(q.get('ph') || 0.5)
    items.forEach((a, i) => {
      const [x, y, w, h] = cells[i]
      cellBg(x, y, w, h, i)
      const c = textClip({ content: 'Yazı ĞÜŞ\nçok iyi', font: 'Archivo Black', weight: 400, size: 110, color: '#FFFFFF', stroke: { enabled: true, color: '#000', width: 7 }, shadow: { enabled: true, color: '#000', blur: 10, x: 0, y: 5, opacity: 0.5 } })
      const dur = a.duration || 0.6
      c.anim = { in: null, out: null, loop: null, [a.category]: { id: a.id, duration: dur } }
      const lt = a.category === 'in' ? dur * phase : a.category === 'out' ? 6 - dur * (1 - phase) : dur * phase
      const r = safe(() => renderTextLayer(c, lt, 0.3, project), a.id)
      blit(r, x, y, w, h, true)
      label(x, y, w, h, `${a.category.toUpperCase()} ${a.name}`)
    })
    hdr.textContent = `ANİMASYONLAR (ilerleme ${phase}) ${PAGE * per + 1}-${PAGE * per + items.length} / ${anims.length} — kesikli çerçeve = tuval sınırı`
  } else if (S === 'cap') {
    const cells = grid(caps.length, 5, 9)
    const WORDS = ['BU', 'OYUN', 'GERÇEKTEN', 'ÇOK', 'İYİ', 'ŞAMPİYON']
    const EW = ['para', 'ateş', 'kazandık', 'efsane', 'gol', 'şok']
    caps.forEach((cs, i) => {
      const [x, y, w, h] = cells[i]
      cellBg(x, y, w, h, i)
      const n = Math.max(2, Math.min(6, cs.words || 3))
      const src = cs.emoji ? EW : WORDS
      const words = src.slice(0, n).map((wd, k) => ({ w: cs.uppercase === false ? wd.toLocaleLowerCase('tr-TR') : wd, s: k * 0.4, e: k * 0.4 + 0.38 }))
      const c = textClip({ content: '' })
      c.caption = { words, styleId: cs.id }
      applyCaptionStyle(c, cs.id)
      const lt = +(q.get('t') || 0.4 + 0.3)
      const r = safe(() => renderTextLayer(c, lt, 0.3, project), cs.id)
      blit(r, x, y, w, h)
      label(x, y, w, h, `${i + 1}. ${cs.name}`)
    })
    hdr.textContent = `ALTYAZI STİLLERİ ${caps.length} — 2. kelime aktif`
  } else if (S === 'font') {
    const per = 52, items = fonts.slice(PAGE * per, PAGE * per + per)
    const cells = grid(items.length, 4, 13)
    const bad = []
    items.forEach((f, i) => {
      const [x, y, w, h] = cells[i]
      g.fillStyle = i % 2 ? '#161616' : '#1b1b1b'; g.fillRect(x, y, w, h)
      const wts = f.weights.length ? f.weights : [400]
      const wt = wts.includes(400) ? 400 : wts[0]
      let miss = ''
      for (const ww of wts) { const m = glyphCheck(f.id, ww, 'normal'); if (m) miss += `${ww}:${m} ` }
      if (f.italic) for (const ff of f.files.filter(z => z.style === 'italic')) { const m = glyphCheck(f.id, ff.weight, 'italic'); if (m) miss += `${ff.weight}i:${m} ` }
      if (miss) bad.push(f.id + ' ' + miss)
      g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'
      g.font = `${wt} 30px "${f.id}", monospace`
      g.fillText('ĞÜŞİÖÇ ğüşıöç', x + 6, y + h * 0.42, w - 12)
      g.fillStyle = miss ? '#ff5050' : '#8f8f8f'; g.font = '500 10px "JetBrains Mono", monospace'
      g.fillText(`${f.id} · ${f.category} · ${wts.join('/')}${f.italic ? ' +i' : ''}${miss ? ' EKSİK ' + miss : ''}`, x + 6, y + h - 9, w - 12)
    })
    result.glyphFail = bad
    hdr.textContent = `YAZI TİPLERİ ${PAGE * per + 1}-${PAGE * per + items.length} / ${fonts.length} — glif hatası: ${bad.length}`
  } else if (S === 'comp') {
    // gerçek bileşimciyle: 16:9 proje, arka plan görüntüsü + birkaç yazı klibi
    const p = model.createProject({ ratio: '16:9' })
    const img = document.createElement('canvas'); img.width = 1280; img.height = 720
    const ix = img.getContext('2d')
    const gr = ix.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, '#1d4ed8'); gr.addColorStop(0.55, '#7c3aed'); gr.addColorStop(1, '#0f766e')
    ix.fillStyle = gr; ix.fillRect(0, 0, 1280, 720)
    for (let i = 0; i < 40; i++) { ix.fillStyle = `rgba(255,255,255,${0.03 + (i % 5) * 0.02})`; ix.fillRect((i * 97) % 1280, (i * 53) % 720, 120, 8) }
    p.media.m1 = { id: 'm1', type: 'image', name: 'bg', width: 1280, height: 720, duration: 10 }
    p.tracks[0].clips.push(model.createMediaClip(p.media.m1, { duration: 10 }))
    const mk = (tid, y, x = 0, extra = {}) => { const c = textClip({ content: '' }); applyTextTemplate(c, tid, { useSample: true, position: true }); c.start = 0; c.duration = 10; c.transform.y = y; c.transform.x = x; Object.assign(c, extra); return c }
    const a = mk('oyun-gg', -0.28, -0.3)
    const b = mk('oyun-zafer', -0.3, 0.22)
    const c2 = mk('etiket-klasik', 0.3, -0.25)
    const d = mk('neon-pembe', 0.02, 0.25)
    const e = mk('baslik-kavisli', 0.0, -0.25)
    e.transform.rotation = -6
    const cap = textClip({ content: '' })
    cap.start = 0; cap.duration = 10
    cap.caption = { words: ['Bunu', 'izlemeden', 'geçme', 'şampiyon!'].map((w, k) => ({ w, s: k * 0.5, e: k * 0.5 + 0.45 })), styleId: 'alt-hormozi' }
    applyCaptionStyle(cap, 'alt-hormozi')
    cap.transform.y = 0.36; cap.transform.x = 0.22
    const anim = mk('oyun-kritik', 0.12, -0.02)
    anim.anim = { in: { id: 'yazi-harf-patla', duration: 1.0 }, out: null, loop: null }
    p.tracks.unshift(model.createTrack('text', { clips: [a, b, c2, d, e, cap, anim] }))
    const glc = document.createElement('canvas')
    glc.width = W; glc.height = Math.round(W * 9 / 16)
    const comp = new Compositor(glc, { preserve: true })
    const T = 0.62
    const st = safe(() => comp.render({ project: p, time: T, sources: fakeSources(img), scale: W / 1920 }), 'comp')
    g.drawImage(glc, 0, 0)
    result.comp = { stats: st, glErrors: [...comp.glw.errors.entries()].map(x => x[0] + ': ' + String(x[1]).slice(0, 200)) }
    hdr.textContent = `BİLEŞİMCİ — 16:9, t=${T}s, ${p.tracks[0].clips.length} yazı klibi, ${st ? st.ms.toFixed(1) : '?'} ms`
  } else if (S === 'jitter') {
    // animasyon penceresi boyunca tuval boyutu sabit mi + kare süresi
    const bad = [], times = []
    for (const a of anims) {
      const c = textClip({ content: 'Merhaba ĞÜŞ dünya\nikinci satır', font: 'Archivo Black', weight: 400, size: 96, stroke: { enabled: true, color: '#000', width: 8 }, glow: { enabled: true, color: '#4dd2ff', size: 20, strength: 1 } })
      const dur = a.duration || 0.6
      c.anim = { in: null, out: null, loop: null, [a.category]: { id: a.id, duration: dur } }
      const sizes = new Set()
      const t1 = performance.now()
      for (let k = 1; k < 30; k++) {
        const f = k / 30
        const lt = a.category === 'in' ? dur * f : a.category === 'out' ? 6 - dur * (1 - f) : dur * f * 2
        const r = safe(() => renderTextLayer(c, lt, 0.5, project), a.id)
        if (r) sizes.add(r.width + 'x' + r.height)
      }
      times.push([(performance.now() - t1) / 29, a.id])
      if (sizes.size > 1) bad.push(a.id + ' ' + [...sizes].join(','))
    }
    times.sort((x, y) => y[0] - x[0])
    result.jitter = bad
    result.slowest = times.slice(0, 6).map(x => x[1] + ' ' + x[0].toFixed(2) + 'ms')
    result.avgFrameMs = +(times.reduce((s, x) => s + x[0], 0) / times.length).toFixed(2)
    // statik önbellek isabeti
    const c = textClip({ content: 'Önbellek', size: 96 })
    const r1 = renderTextLayer(c, 1, 0.5, project), k1 = r1.key
    const r2 = renderTextLayer(c, 2, 0.5, project)
    result.staticCacheHit = r2.key === k1
    hdr.textContent = `TİTREME TESTİ: ${bad.length} sorun, ort. ${result.avgFrameMs} ms/kare`
    g.fillStyle = '#ddd'; g.font = '14px "JetBrains Mono"'
    ;[...bad, '', ...result.slowest].forEach((l, i) => g.fillText(l, 20, 30 + i * 18))
  }
  result.ms = Math.round(performance.now() - t0)
  window.__result = result
  // tuvali doğrudan PNG'ye yaz (gizli pencerede ekran yakalama güvenilmez)
  try {
    const fs = window.require && window.require('fs')
    const out = q.get('out')
    if (fs && out) {
      const target = cv
      // proje klasörü dışına yaz (vite izleyicisi sayfayı yeniden yüklemesin)
      const dir = window.require('path').join(window.require('os').tmpdir(), 'sweaxcut-text')
      fs.mkdirSync(dir, { recursive: true })
      const file = window.require('path').join(dir, out + '.png')
      fs.writeFileSync(file, Buffer.from(target.toDataURL('image/png').split(',')[1], 'base64'))
      result.png = file
    }
  } catch (e) { errors.push('png: ' + e.message) }
  window.__result = result
  // boyamanın ekrana düşmesini bekle
  await new Promise(r => { let n = 0; const f = () => (++n > 2 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(r, 600) })
  await new Promise(r => setTimeout(r, 250))
  window.__done = true
}
run().catch(e => { errors.push('run: ' + e.stack); window.__result = result; window.__done = true })
