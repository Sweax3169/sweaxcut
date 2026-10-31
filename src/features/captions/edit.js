// Altyazı düzenleme: grupları bul, satır metnini değiştir (kelime zamanları korunur ya da orantılı dağıtılır),
// böl, birleştir, kenar kaydır, satır başına kelimeyle yeniden grupla, stili gruba uygula.
// Hepsi immer taslağı (d) üzerinde çalışır; zamanlar saniye, kelime zamanları klip başına göre.

import { uid } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import { captionsToResult, buildCaptionClips, upperTr } from './build.js'

const r3 = x => Math.round(x * 1000) / 1000
const clone = o => JSON.parse(JSON.stringify(o))

// Renderer ile aynı varsayılan (stil yoksa)
export const DEFAULT_LOOK = { active: { color: '#FFE600', scale: 1.1 }, wordIn: 'pop' }
// Görünüm (look) alanları: altyazıya özgü, kelime düzeyinde
export const LOOK_KEYS = ['active', 'past', 'future', 'wordIn', 'palette', 'wordBg', 'loop', 'uppercase', 'emoji', 'lineGap', 'wordGap']

export function isCaption(c) { return !!(c && c.type === 'text' && c.caption && Array.isArray(c.caption.words)) }

// Projedeki altyazı grupları: [{ groupId, trackId, clips:[…sıralı], start, end, styleId, lang }]
export function captionGroups(project) {
  const m = new Map()
  for (const t of project.tracks) for (const c of t.clips) {
    if (!isCaption(c)) continue
    const g = c.caption.groupId || 'tek'
    if (!m.has(g)) m.set(g, { groupId: g, trackId: t.id, clips: [], styleId: c.caption.styleId, lang: c.caption.lang })
    m.get(g).clips.push(c)
  }
  const out = [...m.values()]
  for (const g of out) {
    g.clips.sort((a, b) => a.start - b.start)
    g.start = g.clips[0].start
    g.end = g.clips[g.clips.length - 1].start + g.clips[g.clips.length - 1].duration
  }
  return out.sort((a, b) => a.start - b.start)
}

export function allCaptionClips(project) {
  const out = []
  for (const t of project.tracks) for (const c of t.clips) if (isCaption(c)) out.push(c)
  return out.sort((a, b) => a.start - b.start)
}

function findIn(d, id) {
  for (const t of d.tracks) { const i = t.clips.findIndex(c => c.id === id); if (i >= 0) return { t, i, c: t.clips[i] } }
  return null
}

// Etkin görünüm: kayıtlı stil + klibin kendi değişiklikleri
export function effectiveLook(c) {
  const base = (c && c.caption && c.caption.styleId && regGet('captionStyles', c.caption.styleId)) || DEFAULT_LOOK
  const o = {}
  for (const k of LOOK_KEYS) if (base[k] !== undefined) o[k] = clone(base[k])
  const look = c && c.caption && c.caption.look
  if (look) for (const k of Object.keys(look)) {
    const v = look[k]
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? { ...o[k], ...v } : clone(v)
  }
  return o
}

// ---------------------------------------------------------------- satır metni
const tokenize = s => String(s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)

// Metni değiştir: kelime sayısı aynıysa zamanlar korunur; değilse satırın konuşma aralığına harf sayısıyla dağıtılır
export function setLineText(c, text) {
  const toks = tokenize(text)
  const old = c.caption.words || []
  if (!toks.length) { c.caption.words = []; c.text.content = ''; return }
  if (toks.length === old.length) {
    toks.forEach((w, i) => { old[i].w = w })
  } else {
    const s0 = old.length ? old[0].s : 0
    const e0 = old.length ? old[old.length - 1].e : c.duration
    const span = Math.max(0.1, e0 - s0)
    const weight = toks.map(w => w.length + 1.5)
    const tot = weight.reduce((a, b) => a + b, 0)
    let acc = s0
    c.caption.words = toks.map((w, i) => {
      const d = span * weight[i] / tot
      const o = { w, s: r3(acc), e: r3(acc + d * 0.92) }
      acc += d
      return o
    })
  }
  c.text.content = c.caption.words.map(w => w.w).join(' ')
}

// Bütün grupta büyük/küçük harf (Türkçe kurallarıyla)
export function setCase(c, upper) {
  const lang = c.caption.lang || 'tr'
  for (const w of c.caption.words) w.w = upper ? upperTr(w.w, lang) : (lang === 'en' ? w.w.toLowerCase() : w.w.toLocaleLowerCase('tr-TR'))
  c.text.content = c.caption.words.map(w => w.w).join(' ')
}

// ---------------------------------------------------------------- böl / birleştir / kaydır
// k. kelimeden ikiye böl (k: ikinci parçanın ilk kelimesi). Yeni klibin id'sini döndürür.
export function splitLine(d, id, k) {
  const f = findIn(d, id)
  if (!f) return null
  const c = f.c
  const ws = c.caption.words
  if (k <= 0 || k >= ws.length) return null
  const cut = Math.max(ws[k - 1].e, Math.min(ws[k].s, c.duration - 0.05))
  const b = clone(c)
  b.id = uid('c')
  b.start = r3(c.start + cut)
  b.duration = r3(c.duration - cut)
  b.caption.words = ws.slice(k).map(w => ({ ...w, s: r3(Math.max(0, w.s - cut)), e: r3(Math.max(0.01, w.e - cut)) }))
  b.text.content = b.caption.words.map(w => w.w).join(' ')
  b.keyframes = {}
  c.caption.words = ws.slice(0, k)
  c.duration = r3(Math.max(0.1, cut))
  for (const w of c.caption.words) { w.e = Math.min(w.e, c.duration); if (w.s >= w.e) w.s = r3(Math.max(0, w.e - 0.05)) }
  c.text.content = c.caption.words.map(w => w.w).join(' ')
  f.t.clips.splice(f.i + 1, 0, b)
  return b.id
}

// Sonraki altyazıyla birleştir (aynı iz). Silinen klibin id'sini döndürür.
export function mergeNext(d, id) {
  const f = findIn(d, id)
  if (!f) return null
  const c = f.c
  const sorted = f.t.clips.slice().sort((a, b) => a.start - b.start)
  const n = sorted[sorted.indexOf(c) + 1]
  if (!n || !isCaption(n)) return null
  const off = n.start - c.start
  c.caption.words = [...c.caption.words, ...n.caption.words.map(w => ({ ...w, s: r3(w.s + off), e: r3(w.e + off) }))]
  c.duration = r3(n.start + n.duration - c.start)
  c.text.content = c.caption.words.map(w => w.w).join(' ')
  f.t.clips = f.t.clips.filter(x => x.id !== n.id)
  return n.id
}

// Kenar kaydır: edge 'start' | 'end', dt saniye. Komşu altyazıyla çakışmaz, kelimeler yerinde kalır.
export function nudgeEdge(d, id, edge, dt) {
  const f = findIn(d, id)
  if (!f) return
  const c = f.c
  const sorted = f.t.clips.slice().sort((a, b) => a.start - b.start)
  const i = sorted.indexOf(c)
  const prev = sorted[i - 1], next = sorted[i + 1]
  if (edge === 'start') {
    const lo = prev ? prev.start + prev.duration : 0
    const hi = c.start + c.duration - 0.1
    const ns = Math.max(lo, Math.min(hi, c.start + dt))
    const shift = ns - c.start
    c.start = r3(ns); c.duration = r3(c.duration - shift)
    for (const w of c.caption.words) { w.s = r3(Math.max(0, w.s - shift)); w.e = r3(Math.max(w.s + 0.01, w.e - shift)) }
  } else {
    const hi = next ? next.start : Infinity
    const ne = Math.max(c.start + 0.1, Math.min(hi, c.start + c.duration + dt))
    c.duration = r3(ne - c.start)
    for (const w of c.caption.words) { w.e = Math.min(w.e, c.duration); if (w.s >= w.e) w.s = r3(Math.max(0, w.e - 0.02)) }
  }
}

// Bütün satırı kaydır (dt): komşulara çarpmadan
export function shiftLine(d, id, dt) {
  const f = findIn(d, id)
  if (!f) return
  const c = f.c
  const sorted = f.t.clips.slice().sort((a, b) => a.start - b.start)
  const i = sorted.indexOf(c)
  const prev = sorted[i - 1], next = sorted[i + 1]
  const lo = prev ? prev.start + prev.duration : 0
  const hi = next ? next.start - c.duration : Infinity
  c.start = r3(Math.max(lo, Math.min(hi, c.start + dt)))
}

// ---------------------------------------------------------------- grup işlemleri
export function groupClipsIn(d, groupId) {
  const out = []
  for (const t of d.tracks) for (const c of t.clips) if (isCaption(c) && (c.caption.groupId || 'tek') === groupId) out.push({ t, c })
  return out.sort((a, b) => a.c.start - b.c.start)
}

// Satır başına kelimeyi değiştir: kelime zamanlarıyla baştan grupla, stil/görünüm/konum ilk klipten korunur
export function regroup(d, groupId, maxWords) {
  const items = groupClipsIn(d, groupId)
  if (!items.length) return 0
  const first = items[0].c
  const track = items[0].t
  const res = captionsToResult(items.map(x => x.c), first.caption.lang)
  const text = clone(first.text)
  delete text.content
  const built = buildCaptionClips(res, { styleId: first.caption.styleId, maxWords, uppercase: false, emoji: !!first.caption.emoji, highlightKeywords: true, lang: first.caption.lang || 'tr', groupId, text })
  const ids = new Set(items.map(x => x.c.id))
  for (const t of d.tracks) t.clips = t.clips.filter(c => !ids.has(c.id))
  for (const c of built) {
    c.text = { ...clone(text), content: c.text.content }
    c.transform = clone(first.transform)
    if (first.caption.look) c.caption.look = clone(first.caption.look)
    // vurgu (emphasis) bilgisi korunur: buildCaptionClips yeniden hesaplar
  }
  track.clips.push(...built)
  track.clips.sort((a, b) => a.start - b.start)
  for (const c of built) c.caption.maxWords = maxWords
  return built.length
}

// Stil yaması uygula: { text: {...}, look: {...}, transform: {...}, styleId }
export function patchGroup(d, groupId, patch) {
  for (const { c } of groupClipsIn(d, groupId)) patchClip(c, patch)
}
export function patchClip(c, patch) {
  if (patch.styleId !== undefined) { c.caption.styleId = patch.styleId; c.caption.look = null }
  if (patch.text) {
    for (const k of Object.keys(patch.text)) {
      const v = patch.text[k]
      c.text[k] = v && typeof v === 'object' && !Array.isArray(v) && c.text[k] && typeof c.text[k] === 'object' ? { ...c.text[k], ...v } : clone(v)
    }
  }
  if (patch.look) {
    const look = c.caption.look ? clone(c.caption.look) : {}
    for (const k of Object.keys(patch.look)) {
      const v = patch.look[k]
      if (v === null) { look[k] = null; continue }
      const base = look[k] !== undefined && look[k] !== null ? look[k] : effectiveLook(c)[k]
      look[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base === 'object' ? { ...base, ...v } : clone(v)
    }
    c.caption.look = look
  }
  if (patch.transform) Object.assign(c.transform, patch.transform)
  if (patch.upper != null) setCase(c, patch.upper)
}

// Kayıtlı stil biçimine dönüştür (kaydet / kopyala)
export function styleFromClip(c, name) {
  const text = clone(c.text)
  delete text.content
  const look = effectiveLook(c)
  return {
    id: 'kayit-' + Date.now().toString(36),
    name: name || 'Stilim',
    category: 'kayitli',
    words: c.caption.maxWords || Math.max(1, Math.min(6, c.caption.words.length || 3)),
    text,
    ...look,
    y: c.transform ? c.transform.y : 0.22,
    user: true,
  }
}
