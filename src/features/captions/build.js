// Döküm → altyazı klipleri. Kelimeleri kısa ifadelere böler (noktalama, duraklama, kelime/karakter sınırı),
// her klibi kendi kelimelerine göre zamanlar ve "Altyazı" yazı izine yerleştirir.
// Klip biçimi: createTextClip + caption: { words:[{ w, s, e, emphasis?, emoji? }] (klip başına göre sn), styleId, groupId, lang, emoji }

import { createTextClip, createTrack, defaultTransform, uid } from '../../core/model.js'
import { isFree, cleanupTracks } from '../../core/timeline.js'
import { sourceTime } from '../../core/time.js'
import { get as regGet } from '../../engine/registry.js'
import { isKeyword, phraseEmoji, normWord } from './emoji.js'

export { autoEmoji, isKeyword, phraseEmoji, EMOJI_COUNT } from './emoji.js'

export const CAPTION_TRACK_NAME = 'Altyazı'
const STRONG_END = /[.!?…]["'”’)»\]]*$/u
const SOFT_END = /[,;:–—]["'”’)»\]]*$/u
const r3 = x => Math.round(x * 1000) / 1000

export function upperTr(s, lang = 'tr') {
  return lang === 'en' ? String(s).toUpperCase() : String(s).toLocaleUpperCase('tr-TR')
}

// ---------------------------------------------------------------- kaynak → zaman çizelgesi

// Kaynak medya zamanı → zaman çizelgesi zamanı (klip in/out, hız, hız eğrisi). Klip dışındaysa null.
export function sourceToTimeline(clip, srcT) {
  if (!clip) return srcT
  if (clip.freeze || clip.reverse) return null
  const inT = clip.in || 0
  const outT = clip.out != null ? clip.out : inT + clip.duration * (clip.speed || 1)
  if (srcT < inT - 1e-3 || srcT > outT + 1e-3) return null
  if (!clip.speedCurve) return clip.start + (srcT - inT) * clip.duration / Math.max(1e-6, outT - inT)
  // hız eğrisi: sourceTime monoton artan → ikili arama
  let lo = 0, hi = clip.duration
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (sourceTime(clip, mid) < srcT) lo = mid
    else hi = mid
  }
  return clip.start + (lo + hi) / 2
}

// Dökümdeki kelimeleri zaman çizelgesine taşı; klip dışında kalanlar atılır, kenardakiler kırpılır
export function mapWords(result, { mediaClip = null, offset = 0 } = {}) {
  const out = []
  const segs = (result && result.segments) || []
  const inT = mediaClip ? (mediaClip.in || 0) : -Infinity
  const outT = mediaClip ? (mediaClip.out != null ? mediaClip.out : inT + mediaClip.duration * (mediaClip.speed || 1)) : Infinity
  segs.forEach((seg, si) => {
    for (const w of seg.words || []) {
      if (!w || !String(w.w || '').trim()) continue
      if (w.e <= inT || w.s >= outT) continue
      const s0 = Math.max(inT, w.s)
      const e0 = Math.min(outT, w.e)
      const s = sourceToTimeline(mediaClip, s0)
      const e = sourceToTimeline(mediaClip, e0)
      if (s == null || e == null) continue
      out.push({ w: String(w.w).trim(), s: s + offset, e: Math.max(s, e) + offset, p: w.p, seg: si, src: w.s })
    }
  })
  out.sort((a, b) => a.s - b.s)
  return out
}

// ---------------------------------------------------------------- gruplama

// Kelimeleri ifadelere böl. Dönüş: [[word…], …]
export function groupWords(words, opts = {}) {
  const maxWords = Math.max(1, Math.min(12, opts.maxWords || 4))
  const maxChars = Math.max(6, opts.maxChars || 24)
  const pauseBreak = opts.pauseBreak ?? 0.5
  const maxDur = opts.maxDuration ?? 3.5
  const groups = []
  let cur = []
  if (opts.bySegment) {
    // içe aktarılan altyazı: her satır bloğu (cue) tek klip
    for (const w of words) {
      if (cur.length && cur[cur.length - 1].seg !== w.seg) { groups.push(cur); cur = [] }
      cur.push(w)
    }
    if (cur.length) groups.push(cur)
    return groups
  }
  const len = arr => arr.reduce((a, w) => a + w.w.length, 0) + Math.max(0, arr.length - 1)
  for (const w of words) {
    if (cur.length) {
      const prev = cur[cur.length - 1]
      const gap = w.s - prev.e
      let brk = false
      if (STRONG_END.test(prev.w)) brk = true
      else if (gap >= pauseBreak) brk = true
      else if (prev.seg !== w.seg && gap > 0.2) brk = true
      else if (cur.length >= maxWords) brk = true
      else if (len(cur) + 1 + w.w.length > maxChars) brk = true
      else if (w.e - cur[0].s > maxDur) brk = true
      else if (SOFT_END.test(prev.w) && cur.length >= Math.ceil(maxWords / 2)) brk = true
      if (brk) { groups.push(cur); cur = [] }
    }
    cur.push(w)
  }
  if (cur.length) groups.push(cur)
  // tek kelimelik yetim ifadeyi (cümle ortasında) öncekine kat
  for (let i = groups.length - 1; i > 0; i--) {
    const g = groups[i], p = groups[i - 1]
    if (g.length !== 1) continue
    const last = p[p.length - 1]
    if (STRONG_END.test(last.w) || SOFT_END.test(last.w)) continue
    if (g[0].s - last.e >= pauseBreak * 0.6) continue
    if (p.length + 1 > maxWords + 1) continue
    if (len(p) + 1 + g[0].w.length > Math.round(maxChars * 1.25)) continue
    p.push(g[0])
    groups.splice(i, 1)
  }
  return groups
}

// ---------------------------------------------------------------- klipler

/**
 * buildCaptionClips(result, opts) → [textClip]
 * opts: mediaClip, styleId, maxWords (3..6, vars. 4), maxChars (24), minGap (0), pauseBreak (0.5),
 *       uppercase, emoji, highlightKeywords (true), offset (sn), minDuration (0.4), fillGap (0.35),
 *       maxDuration (3.5), lang, y (dikey konum, tuval yüksekliği oranı), text (ek yazı stili), groupId
 */
export function buildCaptionClips(result, opts = {}) {
  const lang = opts.lang || (result && result.language) || 'tr'
  const style = opts.styleId ? regGet('captionStyles', opts.styleId) : null
  const maxWords = opts.maxWords || (style && style.words) || 4
  const uppercase = opts.uppercase ?? !!(style && style.uppercase)
  const emoji = opts.emoji ?? !!(style && style.emoji)
  const highlight = opts.highlightKeywords !== false
  const minGap = Math.max(0, opts.minGap || 0)
  const minDur = opts.minDuration ?? 0.4
  const fillGap = opts.fillGap ?? 0.35
  const groupId = opts.groupId || uid('cap')
  const words = mapWords(result, { mediaClip: opts.mediaClip, offset: opts.offset || 0 })
  const groups = groupWords(words, { ...opts, maxWords })
  // zamanlar: kelimelere göre, kısa boşluklar doldurulur (titreme olmasın), çakışma asla
  const times = groups.map(g => ({ start: Math.max(0, g[0].s), end: g[g.length - 1].e }))
  for (let i = 0; i < times.length; i++) {
    const t = times[i]
    if (i && t.start < times[i - 1].end) t.start = times[i - 1].end
    t.end = Math.max(t.end, t.start + minDur)
    const next = times[i + 1] ? Math.max(0, times[i + 1].start) : null
    if (next != null) {
      if (next - t.end < fillGap) t.end = next - minGap
      t.end = Math.min(t.end, next - minGap)
    }
    if (t.end - t.start < 0.05) t.end = t.start + 0.05
  }
  // kaynak klibin zaman çizelgesi sonunu aşma (sonraki klibin altyazısıyla çakışmasın)
  const limit = opts.mediaClip ? opts.mediaClip.start + opts.mediaClip.duration + (opts.offset || 0) : Infinity
  for (const t of times) {
    if (t.end > limit) t.end = Math.max(t.start + 0.05, limit)
    t.start = r3(t.start); t.end = r3(t.end)
  }
  const clips = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const { start, end } = times[i]
    const cw = g.map(w => {
      const o = { w: uppercase ? upperTr(w.w, lang) : w.w, s: r3(Math.max(0, w.s - start)), e: r3(Math.max(start, Math.min(end, w.e)) - start) }
      if (o.e <= o.s) o.e = r3(o.s + 0.05)
      if (highlight && isKeyword(w.w, lang)) o.emphasis = true
      return o
    })
    let em = null
    if (emoji) {
      em = phraseEmoji(g.map(w => w.w), lang)
      if (em) {
        const idx = g.findIndex(w => phraseEmoji([w.w], lang) === em)
        if (idx >= 0) cw[idx].emoji = em
      }
    }
    const content = cw.map(w => w.w).join(' ')
    const clip = createTextClip({
      name: CAPTION_TRACK_NAME,
      start: r3(start),
      duration: r3(end - start),
      text: { ...((style && style.text) || {}), ...(opts.text || {}), content, uppercase: false },
      caption: { words: cw, styleId: opts.styleId || null, groupId, lang, emoji: em },
      transform: { ...defaultTransform(), y: opts.y ?? 0.22 },
    })
    clips.push(clip)
  }
  return clips
}

// Klipleri "Altyazı" izine koy (boş/uygun iz yoksa en üstte yeni iz açar). İz id'sini döndürür.
// Birden çok kaynaktan gelen klipler birbiriyle çakışıyorsa öncekini kısaltır.
export function insertCaptions(d, clips, opts = {}) {
  if (!clips || !clips.length) return null
  resolveOverlaps(clips)
  const fits = t => clips.every(c => isFree(t, c.start, c.duration))
  let t = opts.trackId ? d.tracks.find(x => x.id === opts.trackId && x.kind === 'text' && !x.locked && fits(x)) : null
  if (!t) t = d.tracks.find(x => x.kind === 'text' && !x.locked && x.name === CAPTION_TRACK_NAME && fits(x))
  if (!t) t = d.tracks.find(x => x.kind === 'text' && !x.locked && x.clips.length === 0)
  if (!t) { t = createTrack('text', { name: CAPTION_TRACK_NAME }); d.tracks.unshift(t) }
  t.name = CAPTION_TRACK_NAME
  t.clips.push(...clips)
  t.clips.sort((a, b) => a.start - b.start)
  return t.id
}

// Sıralar; çakışan klipte öncekinin süresini kırpar (kelimeleri de), yer kalmazsa sonrakini kaydırır
export function resolveOverlaps(clips) {
  clips.sort((a, b) => a.start - b.start)
  for (let i = 1; i < clips.length; i++) {
    const p = clips[i - 1], c = clips[i]
    if (p.start + p.duration <= c.start + 1e-6) continue
    const nd = Math.max(0.05, r3(c.start - p.start))
    p.duration = nd
    if (p.caption && p.caption.words) for (const w of p.caption.words) { w.s = Math.min(w.s, r3(nd - 0.01)); w.e = Math.min(w.e, nd); if (w.e <= w.s) w.e = r3(w.s + 0.01) }
    const shift = r3(p.start + nd - c.start)
    if (shift > 0) {
      c.start = r3(c.start + shift)
      c.duration = Math.max(0.05, r3(c.duration - shift))
      if (c.caption && c.caption.words) for (const w of c.caption.words) { w.s = Math.max(0, r3(w.s - shift)); w.e = Math.max(r3(w.s + 0.01), r3(w.e - shift)) }
    }
  }
  return clips
}

// Bir altyazı grubunu sil (yeniden oluşturmadan önce)
export function removeCaptions(d, groupId) {
  for (const t of d.tracks) {
    if (t.locked) continue
    t.clips = t.clips.filter(c => !(c.caption && c.caption.groupId === groupId))
  }
  cleanupTracks(d)
}

// Grubun şablonunu değiştir (yazı stilini de şablondan al)
export function restyleCaptions(d, groupId, styleId) {
  const style = regGet('captionStyles', styleId)
  for (const t of d.tracks) for (const c of t.clips) {
    if (!c.caption || c.caption.groupId !== groupId) continue
    c.caption.styleId = styleId
    if (style && style.text) c.text = { ...c.text, ...style.text, content: c.text.content, uppercase: false }
  }
}

// Altyazı kliplerinden döküm benzeri sonuç (yeniden gruplamak için: kelime sayısı değişince)
export function captionsToResult(clips, lang = null) {
  const segments = []
  for (const c of [...clips].sort((a, b) => a.start - b.start)) {
    const ws = c.caption && c.caption.words && c.caption.words.length
      ? c.caption.words.map(w => ({ w: w.w, s: r3(c.start + w.s), e: r3(c.start + w.e) }))
      : null
    if (!ws) continue
    segments.push({ start: ws[0].s, end: ws[ws.length - 1].e, text: ws.map(w => w.w).join(' '), words: ws })
    if (!lang && c.caption.lang) lang = c.caption.lang
  }
  return { language: lang, segments }
}

// ---------------------------------------------------------------- dolgu kelimeleri

export const FILLERS = {
  tr: {
    // kesin dolgu: uzatmalı sesler
    patterns: [/^[ıi]{2,}h?m*$/u, /^[ıi]h?m+$/u, /^e{2,}h?m*$/u, /^e+h+m*$/u, /^h?m{2,}$/u, /^h[ıi]+m*$/u, /^a{2,}h?$/u, /^ö{2,}$/u, /^ı+h+$/u],
    words: ['şey'],
    soft: ['yani', 'hani', 'işte', 'falan', 'filan', 'açıkçası', 'aslında', 'böyle', 'yani şey'],
  },
  en: {
    patterns: [/^u+h+$/, /^u+m+$/, /^u+h+m+$/, /^e+r+m*$/, /^a+h+$/, /^h?m{2,}$/],
    words: [],
    soft: ['like', 'basically', 'actually', 'literally', 'you know', 'i mean', 'kind of', 'sort of'],
  },
}

// "bir şey", "her şey" gibi anlamlı kullanımlar dolgu değil
const SEY_KEEP = new Set(['bir', 'her', 'hiç', 'hiçbir', 'o', 'bu', 'şu', 'başka', 'ne', 'öyle', 'böyle', 'bi', 'birçok', 'bazı', 'tek', 'çok', 'az', 'aynı'])

/**
 * findFillers(result, lang, opts) → [{ s, e, w, soft }]  (kaynak zamanı)
 * opts: soft (true ise "yani/hani/like" gibi bağlama göre dolgu olanlar da), words (ek kelime listesi),
 *       exclude (listeden çıkarılacaklar)
 */
export function findFillers(result, lang = 'tr', opts = {}) {
  const L = lang === 'auto' ? ((result && result.language) || 'tr') : lang
  const conf = FILLERS[L] || FILLERS.en
  const extra = (opts.words || []).map(w => normWord(w, L))
  const exclude = new Set((opts.exclude || []).map(w => normWord(w, L)))
  const softList = (opts.soft ? conf.soft : []).map(p => p.split(/\s+/).map(x => normWord(x, L)))
  const hard = new Set([...conf.words, ...extra].map(w => normWord(w, L)))
  const words = []
  for (const s of (result && result.segments) || []) for (const w of s.words || []) words.push(w)
  const out = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const n = normWord(w.w, L).replace(/(.)\1{2,}/gu, '$1$1')
    if (!n || exclude.has(n)) continue
    // çok kelimeli yumuşak dolgular (you know, i mean)
    let matched = false
    for (const ph of softList) {
      if (ph.length < 2) continue
      if (ph.every((p, k) => words[i + k] && normWord(words[i + k].w, L) === p)) {
        const last = words[i + ph.length - 1]
        out.push({ s: w.s, e: last.e, w: words.slice(i, i + ph.length).map(x => x.w).join(' '), soft: true })
        i += ph.length - 1
        matched = true
        break
      }
    }
    if (matched) continue
    let hit = conf.patterns.some(re => re.test(n)) || hard.has(n)
    if (hit && n === 'şey' && i > 0 && SEY_KEEP.has(normWord(words[i - 1].w, L)) && !STRONG_END.test(words[i - 1].w)) hit = false
    if (hit) { out.push({ s: w.s, e: w.e, w: w.w, soft: false }); continue }
    if (softList.some(ph => ph.length === 1 && ph[0] === n)) out.push({ s: w.s, e: w.e, w: w.w, soft: true })
  }
  return out
}

// Dolgu kelimelerinden kesilecek aralıklar (birleştirilmiş). pad: kenar payı, merge: birleştirme boşluğu
export function fillerCutRanges(fillers, { pad = 0.02, merge = 0.12 } = {}) {
  const rs = fillers.map(f => ({ start: Math.max(0, f.s - pad), end: f.e + pad })).sort((a, b) => a.start - b.start)
  const out = []
  for (const r of rs) {
    const last = out[out.length - 1]
    if (last && r.start - last.end <= merge) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out.map(r => ({ start: r3(r.start), end: r3(r.end) }))
}
