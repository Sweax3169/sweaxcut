// Kütüphane önizleme motoru — bütün efekt / filtre / geçiş / yazı önizlemeleri TEK paylaşılan
// WebGL bileşimci ile çizilir (WebGL bağlam sayısı sınırlı; kart başına bağlam AÇILMAZ).
//  • Durağan küçük resim: istek kuyruğa girer, boşta sırayla çizilir, dataURL olarak önbelleğe alınır.
//  • Üzerine gelince: yalnız o kart için ~20 fps canlı çizim (kartın 2D tuvaline kopyalanır).

import { Compositor } from '../../engine/compositor.js'
import { createProject, createMediaClip, createTextClip, createTrack, uid } from '../../core/model.js'
import { get as regGet, onRegistry } from '../../engine/registry.js'
import { store } from '../../core/store.js'
import { playback } from '../../engine/playback.js'
import { renderTextLayer } from '../../engine/text-render.js'
import { sampleA, sampleB, matBackdrop, coverSquare, isBlank } from './samples.js'

export const THUMB = 176
const TEXT_W = 400

let comp = null
let canvas = null
let failed = false
function engine() {
  if (failed) return null
  if (comp && !comp.glw.lost) return comp
  try {
    canvas = document.createElement('canvas')
    canvas.width = THUMB; canvas.height = THUMB
    comp = new Compositor(canvas, { preserve: true })
  } catch (e) {
    console.warn('kütüphane önizleme bileşimcisi açılamadı', e)
    failed = true
    comp = null
  }
  return comp
}

// ---------------------------------------------------------------- örnek kare kaynağı
let sampleMode = 'sample'   // sample | frame
let frameImg = null
let sampleVer = 1
export function getSampleMode() { return sampleMode }
export function sampleVersion() { return sampleVer }

function srcA() { return (sampleMode === 'frame' && frameImg) || sampleA(THUMB, THUMB) }
function srcB() { return sampleB(THUMB, THUMB) }

// Önizlemedeki o anki kareyi yakala: oynatma döngüsü kareyi çizdikten HEMEN sonra (aynı görevde) kopyala.
// playback.overlayDraw kancası çizimden hemen sonra çağrılır; kaynak kare hazır değilse (pending) birkaç kare bekler.
export function grabCurrentFrame() {
  return new Promise(resolve => {
    const pb = playback
    if (!pb || !pb.comp) { resolve(null); return }
    const prev = pb.overlayDraw
    let tries = 0, finished = false
    const done = (v) => {
      if (finished) return
      finished = true
      if (pb.overlayDraw === hook) pb.overlayDraw = prev
      resolve(v)
    }
    const hook = () => {
      if (prev) { try { prev() } catch (e) { /* */ } }
      tries++
      if (pb.comp.pending && tries < 25) { pb.requestRender(); return }
      let c = null
      try { c = coverSquare(pb.comp.canvas, THUMB) } catch (e) { c = null }
      done(c && !isBlank(c) ? c : null)
    }
    pb.overlayDraw = hook
    pb.requestRender()
    setTimeout(() => done(null), 3000)
  })
}

export async function setSampleMode(mode) {
  if (mode === 'frame') {
    const f = await grabCurrentFrame()
    if (!f) { store.toast('Önizlemede kullanılacak bir kare yok — örnek sahne kullanılıyor', 'info', 2200); mode = 'sample' }
    else frameImg = f
  }
  sampleMode = mode
  sampleVer++
  // örnek kareye bağlı önizlemeleri (yazı hariç) yeniden çiz
  for (const k of [...thumbs.keys()]) if (!k.startsWith('text:')) thumbs.delete(k)
  for (const [k, fns] of subs) {
    if (k.startsWith('text:') || !fns.size) continue
    const i = k.indexOf(':')
    if (!queue.some(q => q.key === k)) queue.push({ key: k, kind: k.slice(0, i), id: k.slice(i + 1) })
    for (const f of fns) f(undefined)
  }
  pump()
  for (const f of modeSubs) f(mode)
}
const modeSubs = new Set()
export function onSampleMode(fn) { modeSubs.add(fn); return () => modeSubs.delete(fn) }

const sources = {
  image: (m) => {
    const s = m.id === 'B' ? srcB() : m.id === 'MAT' ? matBackdrop(TEXT_W, TEXT_W) : srcA()
    return { src: s, w: s.width, h: s.height }
  },
  videoFrame: () => null,
}

// ---------------------------------------------------------------- sahte projeler (bir kez kurulur, yerinde değiştirilir)
let fp = null
function filterProject() {
  if (fp) return fp
  const p = createProject({ ratio: '1:1' })
  p.settings.width = THUMB; p.settings.height = THUMB
  p.settings.bg = { type: 'color', color: '#000000' }
  p.media.A = { id: 'A', type: 'image', name: 'A', width: THUMB, height: THUMB, duration: 0 }
  const c = createMediaClip(p.media.A, { duration: 5 })
  c.fit = 'cover'
  p.tracks[0].clips.push(c)
  fp = { p, c }
  return fp
}

let tp = null
function transitionProject() {
  if (tp) return tp
  const p = createProject({ ratio: '1:1' })
  p.settings.width = THUMB; p.settings.height = THUMB
  p.settings.bg = { type: 'color', color: '#000000' }
  p.media.A = { id: 'A', type: 'image', name: 'A', width: THUMB, height: THUMB, duration: 0 }
  p.media.B = { id: 'B', type: 'image', name: 'B', width: THUMB, height: THUMB, duration: 0 }
  const a = createMediaClip(p.media.A, { duration: 1 })
  const b = createMediaClip(p.media.B, { duration: 1 })
  a.start = 0; b.start = 1; a.fit = b.fit = 'cover'
  p.tracks[0].clips.push(a, b)
  tp = { p, a, b }
  return tp
}

let xp = null
function textProject() {
  if (xp) return xp
  const p = createProject({ ratio: '1:1' })
  p.settings.width = TEXT_W; p.settings.height = TEXT_W
  p.settings.bg = { type: 'color', color: '#23262c' }
  p.media.MAT = { id: 'MAT', type: 'image', name: 'mat', width: TEXT_W, height: TEXT_W, duration: 0 }
  const bg = createMediaClip(p.media.MAT, { duration: 10 })
  bg.fit = 'cover'
  p.tracks[0].clips.push(bg)
  const tt = createTrack('text')
  p.tracks.unshift(tt)
  xp = { p, tt }
  return xp
}

// Yazı paketi (varsa) — şablon uygulama onun applyTextTemplate'i ile (actions.addText ile birebir aynı sonuç)
const textMods = import.meta.glob('../../packs/text/index.js', { eager: true })
const textPack = textMods['../../packs/text/index.js'] || null

// Şablondan yazı klibi
export function textClipFromTemplate(tpl, opts = {}) {
  const clip = createTextClip({ start: 0, duration: opts.duration || 3 })
  if (!tpl) return clip
  if (textPack && textPack.applyTextTemplate) textPack.applyTextTemplate(clip, tpl.id, { useSample: true, position: true })
  else {
    const base = createTextClip().text
    clip.text = { ...clip.text, ...(tpl.text || {}) }
    for (const k of ['stroke', 'stroke2', 'shadow', 'glow', 'bg']) if (tpl.text && tpl.text[k]) clip.text[k] = { ...base[k], ...tpl.text[k] }
    if (tpl.sampleText) clip.text.content = tpl.sampleText
    if (tpl.anim) clip.anim = { in: null, out: null, loop: null, ...JSON.parse(JSON.stringify(tpl.anim)) }
    if (tpl.transform) clip.transform = { ...clip.transform, ...tpl.transform }
  }
  if (tpl.effects) clip.effects = tpl.effects.map(e => ({ uid: uid('e'), enabled: true, ...e }))
  return clip
}

// Altyazı stilinden örnek klip: üç kelime, ortadaki vurgulu anda çizilir
const CAP_WORDS = [{ w: 'Bu', s: 0, e: 0.42 }, { w: 'çok', s: 0.48, e: 0.9 }, { w: 'iyi', s: 0.96, e: 1.5 }]
export function captionClipFromStyle(def, look) {
  const clip = createTextClip({ start: 0, duration: 1.8 })
  const base = createTextClip().text
  clip.text = { ...clip.text, ...(def.text || {}), content: 'Bu çok iyi', uppercase: false }
  for (const k of ['stroke', 'stroke2', 'shadow', 'glow', 'bg']) clip.text[k] = { ...base[k], ...((def.text || {})[k] || {}) }
  clip.caption = { words: CAP_WORDS.map(w => ({ ...w })), styleId: def.id, groupId: 'onizleme', lang: 'tr', look: look || null }
  return clip
}

// ---------------------------------------------------------------- çizim
function paramDefaults(def) {
  const o = {}
  for (const p of def.params || []) o[p.key] = p.default
  return o
}

// Bir kare çiz (paylaşılan tuvale). Başarılıysa tuvali döndürür.
function draw(kind, def, t, extra) {
  const c = engine()
  if (!c) return null
  try {
    if (kind === 'effect') {
      c.previewEffect(srcA(), THUMB, THUMB, def, paramDefaults(def), t)
    } else if (kind === 'filter') {
      const { p, c: clip } = filterProject()
      clip.filter = { id: def.id, intensity: extra && extra.intensity != null ? extra.intensity : 1 }
      canvas.width = THUMB; canvas.height = THUMB
      c.render({ project: p, time: 0.5, sources, scale: 1 })
    } else if (kind === 'transition') {
      const { p, a } = transitionProject()
      a.transition = { id: def.id, duration: 1, params: {} }
      canvas.width = THUMB; canvas.height = THUMB
      const prog = Math.min(0.999, Math.max(0, t))
      c.render({ project: p, time: 0.5 + prog, sources, scale: 1 })
    } else if (kind === 'text') {
      const { p, tt } = textProject()
      const clip = textClipFromTemplate(def.id === '__default' ? null : def)
      clip.id = 'lib-text-preview'
      clip.transform = { ...clip.transform, x: 0, y: 0, scale: textFit(def, clip, p) }
      tt.clips = [clip]
      canvas.width = THUMB; canvas.height = THUMB
      c.render({ project: p, time: Math.min(t, clip.duration - 0.001), sources, scale: THUMB / TEXT_W })
    } else if (kind === 'caption') {
      const { p, tt } = textProject()
      const clip = captionClipFromStyle(def)
      clip.id = 'lib-cap-preview-' + def.id
      clip.transform = { ...clip.transform, x: 0, y: 0, scale: capFit(def, clip, p) }
      tt.clips = [clip]
      canvas.width = THUMB; canvas.height = THUMB
      c.render({ project: p, time: Math.min(t, clip.duration - 0.001), sources, scale: THUMB / TEXT_W })
    } else return null
    return canvas
  } catch (e) {
    console.warn('önizleme çizilemedi', kind, def && def.id, e)
    return null
  }
}

// Yazıyı karoya sığdır: şablonun kendi boyutu ne olursa olsun önizlemede ~%80 genişlik
const fitCache = new Map()
function textFit(def, clip, p) {
  if (fitCache.has(def.id)) return fitCache.get(def.id)
  let k = 1
  try {
    const r = renderTextLayer({ ...clip, id: 'lib-text-measure' }, staticTime('text', def), 1, p)
    if (r && r.width) k = Math.max(0.35, Math.min(2.6, 1 / Math.max(r.width / (TEXT_W * 0.8), r.height / (TEXT_W * 0.62))))
  } catch (e) { k = 1 }
  fitCache.set(def.id, k)
  return k
}

const capFitCache = new Map()
function capFit(def, clip, p) {
  if (capFitCache.has(def.id)) return capFitCache.get(def.id)
  let k = 1
  try {
    const r = renderTextLayer({ ...clip, id: 'lib-cap-measure' }, 1.7, 1, p)
    if (r && r.width) k = Math.max(0.3, Math.min(2.4, 1 / Math.max(r.width / (TEXT_W * 0.86), r.height / (TEXT_W * 0.6))))
  } catch (e) { k = 1 }
  capFitCache.set(def.id, k)
  return k
}

function staticTime(kind, def) {
  if (kind === 'caption') return 0.72
  if (kind === 'effect') return (def.previewDuration || 2) * 0.4
  if (kind === 'transition') return 0.5
  if (kind === 'text') {
    const a = def.anim && def.anim.in
    return Math.min(2.2, (a && a.duration ? a.duration : 0.5) + 0.6)
  }
  return 0
}

function defOf(kind, id) {
  if (kind === 'text' && id === '__default') return { id: '__default' }
  const reg = kind === 'effect' ? 'effects' : kind === 'filter' ? 'filters' : kind === 'transition' ? 'transitions' : kind === 'text' ? 'textTemplates' : kind === 'caption' ? 'captionStyles' : null
  return reg ? regGet(reg, id) : null
}

// ---------------------------------------------------------------- yazı tipi hazırlığı
const fontWait = new Map()
function ensureFont(def) {
  const f = def && def.text && def.text.font
  if (!f || !document.fonts) return null
  const w = (def.text.weight || 700) + (def.text.italic ? ' italic' : '')
  const key = f + '|' + w
  if (!fontWait.has(key)) {
    const p = Promise.race([
      document.fonts.load(`${def.text.italic ? 'italic ' : ''}${def.text.weight || 700} 40px "${f}"`).catch(() => null),
      new Promise(r => setTimeout(r, 2500)),
    ])
    fontWait.set(key, p)
  }
  return fontWait.get(key)
}

// ---------------------------------------------------------------- küçük resim önbelleği + kuyruk
const thumbs = new Map()       // anahtar → dataURL | 'x' (başarısız)
const subs = new Map()         // anahtar → Set(fn)
const queue = []               // [{ key, kind, id }]
let pumping = false

function keyOf(kind, id) { return kind + ':' + id }

export function getThumb(kind, id) { return thumbs.get(keyOf(kind, id)) }

// İstek: önbellekte varsa hemen döner; yoksa kuyruğa alır, hazır olunca fn çağrılır. Dönen fonksiyon aboneliği iptal eder.
export function requestThumb(kind, id, fn) {
  const key = keyOf(kind, id)
  let s = subs.get(key)
  if (!s) { s = new Set(); subs.set(key, s) }
  s.add(fn)
  if (!thumbs.has(key) && !queue.some(q => q.key === key)) {
    queue.push({ key, kind, id })
    pump()
  }
  return () => {
    s.delete(fn)
    if (!s.size) {
      subs.delete(key)
      const i = queue.findIndex(q => q.key === key)
      if (i >= 0) queue.splice(i, 1) // görünmeyen kartın işini bırak
    }
  }
}

function pump() {
  if (pumping) return
  pumping = true
  setTimeout(step, 16)
}

async function step() {
  const t0 = performance.now()
  while (queue.length && performance.now() - t0 < 10) {
    // en son istenen önce (hızlı kaydırmada görünen kartlar beklemesin)
    const job = queue.pop()
    if (thumbs.has(job.key)) continue
    const def = defOf(job.kind, job.id)
    if (!def) { thumbs.set(job.key, 'x'); notify(job.key); continue }
    if (job.kind === 'text' || job.kind === 'caption') { const w = ensureFont(def); if (w) await w }
    const ver = sampleVer
    const out = draw(job.kind, def, staticTime(job.kind, def))
    if (ver !== sampleVer) continue
    let url = 'x'
    if (out) { try { url = out.toDataURL('image/jpeg', 0.84) } catch (e) { url = 'x' } }
    thumbs.set(job.key, url)
    notify(job.key)
  }
  if (queue.length) setTimeout(step, 8)
  else pumping = false
}

function notify(key) {
  const s = subs.get(key)
  if (s) for (const f of s) f(thumbs.get(key))
}

// Kayıt defteri değişince (paket yeniden yüklendi) yalnız başarısızları yeniden dene
onRegistry(() => {
  for (const [k, v] of thumbs) if (v === 'x') thumbs.delete(k)
})

// Yazı tipleri sonradan yüklenirse YALNIZ o aileyi kullanan yazı önizlemelerini tazele
// (hepsini silmek döngüye girer: çizim yeni alt küme yüklemesini tetikler → loadingdone → yeniden çizim…)
if (typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener) {
  let tm = 0
  const fams = new Set()
  document.fonts.addEventListener('loadingdone', (e) => {
    for (const f of (e.fontfaces || [])) fams.add(String(f.family).replace(/^["']|["']$/g, ''))
    clearTimeout(tm)
    tm = setTimeout(() => {
      const hit = new Set(fams)
      fams.clear()
      for (const k of [...thumbs.keys()]) {
        if (!k.startsWith('text:')) continue
        const id = k.slice(5)
        const def = regGet('textTemplates', id)
        if (!def || !def.text || !hit.has(def.text.font)) continue
        if (subs.get(k) && subs.get(k).size && !queue.some(q => q.key === k)) { thumbs.delete(k); queue.push({ key: k, kind: 'text', id }); pump() }
        else thumbs.delete(k)
      }
    }, 300)
  })
}

// ---------------------------------------------------------------- canlı (hover) önizleme
let live = null
// target: 2D tuval. Döner: durdurma fonksiyonu.
export function startLive(kind, id, target) {
  stopLive()
  const def = defOf(kind, id)
  if (!def || !target) return () => {}
  const ctx2 = target.getContext('2d')
  const me = { stop: false, timer: 0 }
  live = me
  const fps = 20
  const t0 = performance.now()
  let fontReady = kind !== 'text' && kind !== 'caption'
  if (kind === 'text' || kind === 'caption') { const w = ensureFont(def); if (w) w.then(() => { fontReady = true }); else fontReady = true }
  const tick = () => {
    if (me.stop) return
    const el = (performance.now() - t0) / 1000
    let t = el
    if (kind === 'effect') t = el % Math.max(0.5, def.previewDuration || 2)
    else if (kind === 'transition') {
      // 0.25 sn bekle → 1 sn geçiş → 0.35 sn bekle (döngü)
      const L = 1.6, u = el % L
      t = u < 0.25 ? 0 : u > 1.25 ? 1 : (u - 0.25)
    } else if (kind === 'text') t = el % 3.2
    else if (kind === 'caption') t = el % 2.1
    if (kind === 'filter') {
      // önce / sonra süpürmesi: filtreli kare + sol tarafta orijinal
      const filtered = me.filtered || (me.filtered = snapshot(draw('filter', def, 0)))
      const L = 2.4, u = (el % L) / L
      const x = THUMB * (0.5 + 0.42 * Math.sin(u * Math.PI * 2))
      if (filtered) {
        ctx2.drawImage(filtered, 0, 0, target.width, target.height)
        const k = target.width / THUMB
        ctx2.save(); ctx2.beginPath(); ctx2.rect(0, 0, x * k, target.height); ctx2.clip()
        ctx2.drawImage(srcA(), 0, 0, target.width, target.height)
        ctx2.restore()
        ctx2.fillStyle = '#ff4b3e'; ctx2.fillRect(x * k - 1, 0, 2, target.height)
      }
    } else if (fontReady) {
      const out = draw(kind, def, t)
      if (out) ctx2.drawImage(out, 0, 0, target.width, target.height)
    }
    me.timer = setTimeout(tick, 1000 / fps)
  }
  tick()
  return () => { me.stop = true; clearTimeout(me.timer); if (live === me) live = null }
}

export function stopLive() {
  if (live) { live.stop = true; clearTimeout(live.timer); live = null }
}

function snapshot(c) {
  if (!c) return null
  const s = document.createElement('canvas')
  s.width = c.width; s.height = c.height
  s.getContext('2d').drawImage(c, 0, 0)
  return s
}

// Test / tanılama
export function previewStats() {
  return { cached: thumbs.size, queued: queue.length + (pumping ? 1 : 0), failed: [...thumbs.values()].filter(v => v === 'x').length, errors: comp ? [...comp.glw.errors.entries()].map(([k, v]) => k + ': ' + String(v).slice(0, 200)) : [] }
}
