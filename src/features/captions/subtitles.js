// Altyazı dosyaları: SRT / VTT / ASS içe aktarma (→ altyazı klipleri) ve dışa aktarma (projedeki yazı kliplerinden),
// düz metin (TXT) döküm. Saf JS; dosya okuma/yazma yardımcıları platform üzerinden.

import { capEnv } from './env.js'
import { distributeWords } from './parse.js'
import { buildCaptionClips, upperTr } from './build.js'

export const SUBTITLE_EXTS = ['srt', 'vtt', 'ass', 'ssa']
export const SUBTITLE_FILTERS = [
  { name: 'Altyazı dosyası', extensions: SUBTITLE_EXTS },
  { name: 'SubRip (SRT)', extensions: ['srt'] },
  { name: 'WebVTT', extensions: ['vtt'] },
  { name: 'Advanced SubStation (ASS)', extensions: ['ass', 'ssa'] },
]
export const EXPORT_FORMATS = [
  { id: 'srt', name: 'SRT (SubRip)', ext: 'srt', hint: 'YouTube, Premiere, çoğu oynatıcı' },
  { id: 'vtt', name: 'WebVTT', ext: 'vtt', hint: 'Web oynatıcılar, kelime zamanlı' },
  { id: 'ass', name: 'ASS (Aegisub)', ext: 'ass', hint: 'Stil ve karaoke vurgusu' },
  { id: 'txt', name: 'Düz metin döküm', ext: 'txt', hint: 'Açıklama, blog, not' },
]

const r3 = x => Math.round(x * 1000) / 1000

// ---------------------------------------------------------------- zaman

// "01:02:03,456" | "02:03.456" | "0:02:03.45" | "12.5" → saniye
export function parseTime(str) {
  const s = String(str || '').trim()
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d+))?$/.exec(s)
  if (m) return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? parseFloat('0.' + m[4]) : 0)
  const n = parseFloat(s.replace(',', '.'))
  return isFinite(n) ? n : NaN
}

function pad(n, w = 2) { return String(n).padStart(w, '0') }
function split(t) {
  const ms = Math.max(0, Math.round(t * 1000))
  return { h: Math.floor(ms / 3600000), m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60, ms: ms % 1000 }
}
export function srtTime(t) { const x = split(t); return `${pad(x.h)}:${pad(x.m)}:${pad(x.s)},${pad(x.ms, 3)}` }
export function vttTime(t) { const x = split(t); return `${pad(x.h)}:${pad(x.m)}:${pad(x.s)}.${pad(x.ms, 3)}` }
export function assTime(t) {
  const cs = Math.max(0, Math.round(t * 100))
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`
}

// ---------------------------------------------------------------- okuma

function normalizeText(text) {
  return String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}

function stripTags(s) {
  return s
    .replace(/\{\\[^}]*\}/g, '')            // SRT içine gömülü ASS etiketleri {\an8}
    .replace(/<\d{1,2}:\d{2}(:\d{2})?\.\d+>/g, '') // VTT satır içi zaman
    .replace(/<\/?(i|b|u|s|font|span|c|v|lang|ruby|rt)(\s[^>]*)?>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function cleanLines(lines) {
  return lines.map(l => stripTags(l).replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
}

// SRT → [{ start, end, text }]
export function parseSRT(text) {
  const out = []
  for (const block of normalizeText(text).split(/\n[ \t]*\n/)) {
    const lines = block.split('\n')
    const ti = lines.findIndex(l => l.includes('-->'))
    if (ti < 0) continue
    const [a, b] = lines[ti].split('-->')
    const start = parseTime(a)
    const end = parseTime((b || '').trim().split(/\s+/)[0])
    if (!isFinite(start) || !isFinite(end)) continue
    const tl = cleanLines(lines.slice(ti + 1))
    if (!tl.length) continue
    out.push({ start, end: Math.max(end, start + 0.01), text: tl.join('\n') })
  }
  return out
}

// VTT → [{ start, end, text, words? }] — satır içi <00:00:01.500> zamanları kelime zamanı olur
export function parseVTT(text) {
  const out = []
  const blocks = normalizeText(text).split(/\n[ \t]*\n/)
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim() !== '')
    if (!lines.length) continue
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(lines[0].trim())) continue
    const ti = lines.findIndex(l => l.includes('-->'))
    if (ti < 0) continue
    const [a, b] = lines[ti].split('-->')
    const start = parseTime(a)
    const end = parseTime((b || '').trim().split(/\s+/)[0])
    if (!isFinite(start) || !isFinite(end) || end - start < 0.02) continue
    const raw = lines.slice(ti + 1)
    const cue = { start, end, text: cleanLines(raw).join('\n') }
    if (!cue.text) continue
    const joined = raw.join(' ')
    if (/<\d{1,2}:\d{2}(:\d{2})?\.\d+>/.test(joined)) cue.words = vttWords(joined, start, end)
    out.push(cue)
  }
  // YouTube tarzı kayan satırlar: önceki cue'nun son satırı tekrar ediyorsa at
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1].text.split('\n')
    const cur = out[i].text.split('\n')
    if (cur.length > 1 && cur[0] === prev[prev.length - 1]) {
      out[i].text = cur.slice(1).join('\n')
      if (out[i].words) {
        const drop = cur[0].split(/\s+/).length
        out[i].words = out[i].words.slice(drop)
      }
    }
  }
  return out.filter(c => c.text)
}

function vttWords(raw, start, end) {
  const parts = []
  let t = start
  const re = /<(\d{1,2}:\d{2}(?::\d{2})?\.\d+)>/g
  let last = 0
  let m
  while ((m = re.exec(raw))) {
    parts.push({ t, text: raw.slice(last, m.index) })
    t = parseTime(m[1])
    last = re.lastIndex
  }
  parts.push({ t, text: raw.slice(last) })
  const words = []
  for (let i = 0; i < parts.length; i++) {
    const txt = stripTags(parts[i].text).replace(/\s+/g, ' ').trim()
    if (!txt) continue
    const s = parts[i].t
    const e = i + 1 < parts.length ? parts[i + 1].t : end
    words.push(...distributeWords(txt, s, Math.max(s + 0.01, e)))
  }
  return words
}

// ASS/SSA → [{ start, end, text, words?, style }] — {\k} karaoke etiketleri kelime zamanı olur
export function parseASS(text) {
  const out = []
  let section = ''
  let format = null
  for (const line0 of normalizeText(text).split('\n')) {
    const line = line0.trim()
    if (!line || line.startsWith(';')) continue
    const sec = /^\[(.+)\]$/.exec(line)
    if (sec) { section = sec[1].toLowerCase(); continue }
    if (section !== 'events') continue
    if (/^Format:/i.test(line)) { format = line.slice(7).split(',').map(s => s.trim().toLowerCase()); continue }
    if (!/^Dialogue:/i.test(line)) continue
    const f = format || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text']
    const body = line.slice(line.indexOf(':') + 1).replace(/^\s/, '')
    const vals = []
    let rest = body
    for (let i = 0; i < f.length - 1; i++) {
      const k = rest.indexOf(',')
      if (k < 0) { vals.push(rest); rest = ''; break }
      vals.push(rest.slice(0, k)); rest = rest.slice(k + 1)
    }
    vals.push(rest)
    const get = k => vals[f.indexOf(k)]
    const start = parseTime(get('start'))
    const end = parseTime(get('end'))
    const raw = get('text') || ''
    if (!isFinite(start) || !isFinite(end) || /\{[^}]*\\p[1-9]/.test(raw)) continue
    const plain = assPlain(raw)
    if (!plain) continue
    const cue = { start, end: Math.max(end, start + 0.01), text: plain, style: (get('style') || '').trim() || null }
    if (/\\[kK][fo]?\d/.test(raw)) cue.words = assKaraoke(raw, start, end)
    out.push(cue)
  }
  return out.sort((a, b) => a.start - b.start)
}

function assPlain(raw) {
  return raw.replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

function assKaraoke(raw, start, end) {
  // heceler: { s, e, text } → kelimelere birleştir
  const syl = []
  let t = start
  let dur = 0
  const re = /\{([^}]*)\}|([^{]+)/g
  let m
  while ((m = re.exec(raw))) {
    if (m[1] != null) {
      const k = /\\[kK][fo]?(\d+)/.exec(m[1])
      if (k) { t += dur; dur = +k[1] / 100 }
    } else {
      const txt = m[2].replace(/\\N|\\n/g, ' ').replace(/\\h/g, ' ')
      syl.push({ s: t, e: t + dur, text: txt })
    }
  }
  const words = []
  let cur = null
  for (const sy of syl) {
    const pieces = sy.text.split(/(\s+)/)
    for (const pc of pieces) {
      if (!pc) continue
      if (/^\s+$/.test(pc)) { if (cur) { words.push(cur); cur = null } continue }
      if (!cur) cur = { w: pc, s: sy.s, e: sy.e }
      else { cur.w += pc; cur.e = sy.e }
    }
  }
  if (cur) words.push(cur)
  return words.filter(w => w.w.trim()).map(w => ({ w: w.w, s: r3(w.s), e: r3(Math.min(end, Math.max(w.e, w.s + 0.01))) }))
}

export function detectFormat(text, filename = '') {
  const ext = String(filename).toLowerCase().split('.').pop()
  if (SUBTITLE_EXTS.includes(ext)) return ext === 'ssa' ? 'ass' : ext
  const t = normalizeText(text).trimStart()
  if (/^WEBVTT/.test(t)) return 'vtt'
  if (/^\[Script Info\]/i.test(t) || /^Dialogue:/m.test(t)) return 'ass'
  return 'srt'
}

export function parseSubtitles(text, format) {
  const f = format || detectFormat(text)
  if (f === 'vtt') return parseVTT(text)
  if (f === 'ass' || f === 'ssa') return parseASS(text)
  return parseSRT(text)
}

// Cue listesi → döküm biçimi (kelime zamanı yoksa harf sayısına göre eşit dağıtılır)
export function cuesToResult(cues, language = null) {
  return {
    language,
    segments: cues.map(c => {
      const words = c.words && c.words.length ? c.words.map(w => ({ ...w })) : distributeWords(c.text.replace(/\n/g, ' '), c.start, c.end)
      return { start: r3(c.start), end: r3(c.end), text: words.map(w => w.w).join(' '), words }
    }).filter(s => s.words.length),
  }
}

/**
 * importSubtitles(text, opts) → [textClip]
 * opts: format ('srt'|'vtt'|'ass'), filename (biçim tahmini için), regroup (true: kısa ifadelere yeniden böl),
 *       offset (sn), styleId, lang, + buildCaptionClips seçenekleri
 */
export function importSubtitles(text, opts = {}) {
  const fmt = opts.format || detectFormat(text, opts.filename)
  const cues = parseSubtitles(text, fmt)
  const result = cuesToResult(cues, opts.lang || null)
  if (opts.regroup) return buildCaptionClips(result, { ...opts, mediaClip: null })
  return buildCaptionClips(result, { ...opts, mediaClip: null, bySegment: true, fillGap: 0, minDuration: 0, highlightKeywords: opts.highlightKeywords ?? false })
}

// ---------------------------------------------------------------- dışa aktarma

function clipText(c) {
  const t = c.text || {}
  let s = (c.caption && c.caption.words && c.caption.words.length) ? c.caption.words.map(w => w.w).join(' ') : String(t.content || '')
  if (t.uppercase) s = upperTr(s, (c.caption && c.caption.lang) || 'tr')
  return s.trim()
}

/**
 * Projedeki yazı kliplerinden cue listesi (zaman çizelgesi zamanı).
 * opts: captionsOnly (yalnız altyazı klipleri), groupId, trackIds, includeHidden, range:{start,end}
 */
export function collectCues(project, opts = {}) {
  const cues = []
  for (const t of project.tracks || []) {
    if (t.kind !== 'text') continue
    if (t.hidden && !opts.includeHidden) continue
    if (opts.trackIds && !opts.trackIds.includes(t.id)) continue
    for (const c of t.clips) {
      if (c.type !== 'text') continue
      if (opts.captionsOnly && !c.caption) continue
      if (opts.groupId && !(c.caption && c.caption.groupId === opts.groupId)) continue
      const text = clipText(c)
      if (!text) continue
      let start = c.start, end = c.start + c.duration
      if (opts.range) {
        if (end <= opts.range.start || start >= opts.range.end) continue
        start = Math.max(start, opts.range.start) - opts.range.start
        end = Math.min(end, opts.range.end) - opts.range.start
      }
      const shift = c.start - (opts.range ? opts.range.start : 0)
      const up = !!(c.text && c.text.uppercase)
      const words = c.caption && c.caption.words ? c.caption.words.map(w => ({ w: up ? upperTr(w.w, c.caption.lang || 'tr') : w.w, s: r3(shift + w.s), e: r3(shift + w.e) })) : null
      cues.push({ start: r3(start), end: r3(end), text, words })
    }
  }
  return cues.sort((a, b) => a.start - b.start || a.end - b.end)
}

// Dökümden doğrudan cue listesi
export function resultToCues(result) {
  return ((result && result.segments) || []).map(s => ({ start: s.start, end: s.end, text: s.text, words: s.words }))
}

// Uzun satırı en fazla iki dengeli satıra böl
export function wrapLines(text, max = 42) {
  if (!max || text.includes('\n') || text.length <= max) return text
  const words = text.split(' ')
  let best = null
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ')
    const score = Math.max(a.length, b.length)
    if (!best || score < best.score) best = { score, text: a + '\n' + b }
  }
  return best ? best.text : text
}

export function toSRT(cues, { wrap = 42 } = {}) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${wrapLines(c.text, wrap)}\n`).join('\n')
}

export function toVTT(cues, { wrap = 42, karaoke = false } = {}) {
  const body = cues.map(c => {
    let txt
    if (karaoke && c.words && c.words.length > 1) {
      txt = c.words.map((w, i) => (i === 0 ? '' : `<${vttTime(Math.max(c.start, Math.min(c.end, w.s)))}>`) + `<c>${escVtt(w.w)}</c>`).join(' ')
    } else txt = escVtt(wrapLines(c.text, wrap))
    return `${vttTime(c.start)} --> ${vttTime(c.end)}\n${txt}\n`
  })
  return 'WEBVTT\n\n' + body.join('\n')
}
function escVtt(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function assColor(hex, alpha = 0) {
  const h = String(hex || '#ffffff').replace('#', '')
  const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h.padEnd(6, '0')
  const r = f.slice(0, 2), g = f.slice(2, 4), b = f.slice(4, 6)
  return `&H${pad(Math.round(alpha * 255).toString(16).toUpperCase(), 2)}${b}${g}${r}`.toUpperCase()
}

/**
 * toASS(cues, opts) — opts: width, height, font, size, color, highlight (karaoke rengi), outline, outlineWidth,
 *                     marginV, bold, karaoke (kelime vurgusu {\kf})
 */
export function toASS(cues, opts = {}) {
  const W = opts.width || 1080, H = opts.height || 1920
  const size = opts.size || Math.round(W * 0.075)
  const font = opts.font || 'Archivo Black'
  const style = [
    'Default', font, size, assColor(opts.color || '#ffffff'), assColor(opts.highlight || '#E4FF3A'),
    assColor(opts.outline || '#000000'), assColor('#000000', 0.6), opts.bold === false ? 0 : -1, 0, 0, 0, 100, 100, 0, 0, 1,
    opts.outlineWidth ?? Math.max(2, Math.round(size / 14)), 0, 2, 60, 60, opts.marginV ?? Math.round(H * 0.22), 1,
  ].join(',')
  const lines = cues.map(c => {
    let txt
    if (opts.karaoke && c.words && c.words.length) {
      let t = c.start
      txt = c.words.map((w, i) => {
        const s = Math.max(c.start, Math.min(c.end, w.s))
        const lead = Math.max(0, Math.round((s - t) * 100))
        const e = i + 1 < c.words.length ? Math.max(s, Math.min(c.end, c.words[i + 1].s)) : c.end
        const d = Math.max(1, Math.round((e - s) * 100))
        t = s + d / 100
        return (lead ? `{\\k${lead}}` : '') + `{\\kf${d}}` + escAss(w.w) + (i + 1 < c.words.length ? ' ' : '')
      }).join('')
    } else txt = escAss(c.text).replace(/\n/g, '\\N')
    return `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${txt}`
  })
  return [
    '[Script Info]',
    '; SWEAXCUT ile oluşturuldu',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${style}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...lines,
    '',
  ].join('\n')
}
function escAss(s) { return String(s).replace(/\{/g, '(').replace(/\}/g, ')') }

// Düz metin döküm. timestamps: her paragrafın başına [dk:sn]; paragraphGap: bu kadar sessizlikte yeni paragraf
export function toTXT(cuesOrResult, { timestamps = false, paragraphGap = 1.5 } = {}) {
  const cues = Array.isArray(cuesOrResult) ? cuesOrResult : resultToCues(cuesOrResult)
  const paras = []
  let cur = null
  let lastEnd = -Infinity
  for (const c of cues) {
    const txt = c.text.replace(/\s*\n\s*/g, ' ').trim()
    if (!txt) continue
    if (!cur || c.start - lastEnd >= paragraphGap) { cur = { start: c.start, parts: [] }; paras.push(cur) }
    cur.parts.push(txt)
    lastEnd = Math.max(lastEnd, c.end)
  }
  return paras.map(p => {
    const body = p.parts.join(' ').replace(/\s+([.,!?;:…])/g, '$1')
    if (!timestamps) return body
    const x = split(p.start)
    return `[${x.h ? x.h + ':' + pad(x.m) : pad(x.m)}:${pad(x.s)}] ${body}`
  }).join('\n\n') + '\n'
}

export function formatCues(cues, format, opts = {}) {
  if (format === 'vtt') return toVTT(cues, opts)
  if (format === 'ass' || format === 'ssa') return toASS(cues, opts)
  if (format === 'txt') return toTXT(cues, opts)
  return toSRT(cues, opts)
}

// Projeden altyazı metni (dosyaya yazmaz). opts: collectCues + biçim seçenekleri
export function exportSubtitles(project, format = 'srt', opts = {}) {
  const cues = collectCues(project, opts)
  const extra = format === 'ass' ? { width: project.settings && project.settings.width, height: project.settings && project.settings.height, ...opts } : opts
  return formatCues(cues, format, extra)
}

// ---------------------------------------------------------------- dosya

// Kodlama tahmini: UTF-8 (BOM'lu/BOM'suz), UTF-16, yoksa Windows-1254 (eski Türkçe altyazılar)
export function decodeSubtitleBytes(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u.subarray(2))
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder('utf-16be').decode(u.subarray(2))
  if (u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return new TextDecoder('utf-8').decode(u.subarray(3))
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u) } catch (e) { /* UTF-8 değil */ }
  try { return new TextDecoder('windows-1254').decode(u) } catch (e) { return new TextDecoder('latin1').decode(u) }
}

export async function readSubtitleFile(file) {
  const { fs } = capEnv()
  const buf = await fs.promises.readFile(file)
  return decodeSubtitleBytes(buf)
}

// SRT/TXT'ye UTF-8 BOM eklenir (Windows oynatıcıları Türkçe karakterleri doğru tanısın)
export async function writeSubtitleFile(file, text, { bom } = {}) {
  const { fs } = capEnv()
  const ext = String(file).toLowerCase().split('.').pop()
  const useBom = bom ?? (ext === 'srt' || ext === 'txt')
  const data = (useBom ? '﻿' : '') + text.replace(/\r?\n/g, ext === 'vtt' ? '\n' : '\r\n')
  await fs.promises.writeFile(file, data, 'utf8')
  return file
}

export async function importSubtitleFile(file, opts = {}) {
  const text = await readSubtitleFile(file)
  return importSubtitles(text, { filename: file, ...opts })
}
