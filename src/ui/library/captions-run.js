// Otomatik altyazı işi + altyazı dosyası içe/dışa aktarma (features/captions modülleri üzerinden).
import { store, selectedClips } from '../../core/store.js'
import * as TL from '../../core/timeline.js'
import { createTextClip, createTrack, uid } from '../../core/model.js'
import { ipc, fs } from '../../platform/node.js'
import { feature } from './features.js'
import { captionJob } from './jobs.js'

// Yazı paketi: üretilen her altyazı klibine stil uygulanmalı (çizici clip.text'i okur)
const textMods = import.meta.glob('../../packs/text/index.js', { eager: true })
const textPack = textMods['../../packs/text/index.js'] || null
function styleClips(clips, styleId) {
  if (!styleId || !textPack || !textPack.applyCaptionStyle) return clips
  for (const c of clips) {
    textPack.applyCaptionStyle(c, styleId)
    // büyük harf seçeneği kelimelere zaten uygulandı; stilin kendi uppercase'i kullanıcı seçimini ezmesin
    if (c.text) c.text.uppercase = false
  }
  return clips
}

// ---------------------------------------------------------------- kaynak klipler
export function captionSources(source) {
  const p = store.get().project
  const hasAudio = c => {
    const m = p.media[c.mediaId]
    if (!m) return false
    if (c.type === 'audio') return true
    return c.type === 'video' && m.hasAudio && !(c.audio && c.audio.muted && !c.audio.detached)
  }
  if (source === 'selected') return selectedClips().filter(c => (c.type === 'video' || c.type === 'audio') && hasAudio(c))
  if (source === 'voice') {
    const out = []
    for (const t of p.tracks) if (t.kind === 'audio') for (const c of t.clips) if (c.role === 'voice' && hasAudio(c)) out.push(c)
    return out
  }
  const main = TL.mainTrack(p)
  const list = main ? main.clips.filter(c => c.type === 'video' && hasAudio(c)) : []
  // sesi ayrılmış ana iz klipleri: ayrılan ses klibini kullan
  return list.map(c => {
    if (c.audio && c.audio.detached) { const a = TL.getClip(p, c.audio.detached); if (a) return a }
    return c
  })
}

// ---------------------------------------------------------------- modeller
export async function modelList() {
  const M = await feature('models')
  if (!M || !M.listModels) return []
  try {
    const l = await M.listModels()
    return (l || []).map(m => ({ ...m, id: m.id || m.name, name: m.name || m.label || m.id, default: m.recommended || m.default }))
  } catch (e) { return [] }
}
export async function modelInstalled(id) {
  const M = await feature('models')
  if (!M || !M.isInstalled) return false
  try { return !!(await M.isInstalled(id)) } catch (e) { return false }
}
// onProgress(0..1) — modül { ratio } nesnesi gönderir
export async function downloadModel(id, onProgress, signal) {
  const M = await feature('models')
  if (!M || !M.downloadModel) throw new Error('model indirici yok')
  return M.downloadModel(id, p => onProgress && onProgress(typeof p === 'number' ? p : (p && (p.ratio ?? (p.total ? p.received / p.total : 0))) || 0), signal)
}

// ---------------------------------------------------------------- otomatik altyazı
// Döküm → biçimlenmiş altyazı klipleri (zaman çizelgesi zamanı)
export function captionClipsFromResult(B, res, mediaClip, o) {
  const lang = o.language === 'auto' || !o.language ? (res.language || 'tr') : o.language
  const opts = { styleId: o.styleId, maxWords: o.maxWords, uppercase: o.uppercase, emoji: o.emoji, highlightKeywords: o.highlightKeywords, mediaClip, lang }
  const out = B.buildCaptionClips(res, opts) || []
  return styleClips(Array.isArray(out) ? out : out.clips || [], o.styleId)
}

export async function runCaptions(o) {
  if (captionJob.get().running) return
  const clips = captionSources(o.source)
  if (!clips.length) { store.toast('Altyazı için sesli klip bulunamadı', 'info'); return }
  const [W, B] = await Promise.all([feature('whisper'), feature('build')])
  if (!W || !W.transcribe || !B || !B.buildCaptionClips) { store.toast('Konuşma tanıma motoru kurulu değil', 'error'); return }
  const ctrl = new AbortController()
  captionJob.set({ running: true, progress: 0, label: 'Hazırlanıyor…', error: null, ctrl, done: null })
  try {
    // model kurulu değilse önce indir
    if (o.model && !(await modelInstalled(o.model))) {
      captionJob.set({ label: 'Model indiriliyor…' })
      await downloadModel(o.model, p => captionJob.set({ progress: p * 0.3 }), ctrl.signal)
    }
    const p = store.get().project
    const built = []
    const fillers = []
    const base = captionJob.get().progress
    for (let i = 0; i < clips.length; i++) {
      if (ctrl.signal.aborted) throw new DOMException('iptal', 'AbortError')
      const c = clips[i]
      const m = p.media[c.mediaId]
      const lo = Math.min(c.in ?? 0, c.out ?? 0), hi = Math.max(c.in ?? 0, c.out ?? c.duration)
      captionJob.set({ label: clips.length > 1 ? `Konuşma çözümleniyor · ${i + 1}/${clips.length}` : 'Konuşma çözümleniyor…' })
      const res = await W.transcribe(m, {
        language: o.language || 'tr',
        model: o.model, signal: ctrl.signal, range: { start: lo, end: hi },
        onProgress: (x) => {
          const v = typeof x === 'number' ? x : (x && x.progress) || 0
          captionJob.set({ progress: base + (1 - base) * ((i + Math.max(0, Math.min(1, v))) / clips.length) * 0.97, ...(x && x.label ? { label: (clips.length > 1 ? `${i + 1}/${clips.length} · ` : '') + x.label } : {}) })
        },
      })
      if (ctrl.signal.aborted) throw new DOMException('iptal', 'AbortError')
      const lang = o.language === 'auto' ? (res.language || 'tr') : o.language
      built.push(...captionClipsFromResult(B, res, c, o))
      if (o.markFillers && B.findFillers) {
        try {
          for (const f of B.findFillers(res, lang) || []) {
            const t = B.sourceToTimeline ? B.sourceToTimeline(c, f.s) : null
            if (t != null) fillers.push({ time: t, word: f.w })
          }
        } catch (e) { /* */ }
      }
    }
    if (!built.length) { captionJob.set({ running: false, ctrl: null, progress: 1, error: 'Konuşma bulunamadı', done: null }); return }
    store.edit('Otomatik altyazı', d => {
      if (B.insertCaptions) B.insertCaptions(d, built)
      else placeCaptionClips(d, built)
      for (const f of fillers) {
        if (Number.isFinite(f.time)) d.markers.push({ id: uid('k'), time: f.time, color: '#ff4d5e', label: 'Dolgu: ' + f.word })
      }
    })
    const msg = `${built.length} altyazı eklendi${fillers.length ? ` · ${fillers.length} dolgu işaretlendi` : ''}`
    captionJob.set({ running: false, ctrl: null, progress: 1, label: '', done: msg.toLocaleUpperCase('tr-TR') })
    store.toast(msg, 'ok', 2200)
  } catch (e) {
    const aborted = ctrl.signal.aborted || (e && e.name === 'AbortError')
    captionJob.set({ running: false, ctrl: null, error: aborted ? null : 'Altyazı oluşturulamadı: ' + (e.message || e), label: aborted ? 'İptal edildi' : '' })
    if (!aborted) console.warn('altyazı hatası', e)
  }
}

// insertCaptions yoksa: yeni yazı izine diz
function placeCaptionClips(d, clips) {
  const t = createTrack('text', { name: 'Altyazı' })
  d.tracks.unshift(t)
  for (const c of clips) {
    if (t.clips.some(x => x.start < c.start + c.duration - 1e-4 && x.start + x.duration > c.start + 1e-4)) { TL.placeClip(d, c, {}, store.get().ui); continue }
    t.clips.push(c)
  }
  t.clips.sort((a, b) => a.start - b.start)
}

// ---------------------------------------------------------------- altyazı dosyaları
function parseSimple(text) {
  // SRT / VTT yedek ayrıştırıcı
  const cues = []
  const tc = s => { const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / Math.pow(10, m[4].length) : null }
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter(l => l.trim() && !/^WEBVTT/.test(l))
    const i = lines.findIndex(l => l.includes('-->'))
    if (i < 0) continue
    const [a, b] = lines[i].split('-->')
    const s = tc(a), e = tc(b)
    if (s == null || e == null) continue
    cues.push({ start: s, end: e, text: lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '') })
  }
  return cues
}

export async function importSubtitleFile() {
  if (!ipc) return
  const files = await ipc.invoke('dialog:open', { title: 'Altyazı dosyası içe aktar', properties: ['openFile'], filters: [{ name: 'Altyazı', extensions: ['srt', 'vtt', 'ass', 'ssa'] }] })
  if (files[0]) return importSubtitlePath(files[0])
}

// Dosya yolundan altyazı klipleri oluştur ve "Altyazı" izine koy. Eklenen klip sayısını döndürür.
export async function importSubtitlePath(file) {
  try {
    const S = await feature('subtitles')
    const B = await feature('build')
    let clips = null
    if (S && S.importSubtitleFile) clips = await S.importSubtitleFile(file, { lang: 'tr' })
    if (!clips) clips = cuesToClips(parseSimple(fs.readFileSync(file, 'utf8')))
    if (!clips.length) { store.toast('Dosyada altyazı bulunamadı', 'info'); return 0 }
    store.edit('Altyazı içe aktar', d => { if (B && B.insertCaptions) B.insertCaptions(d, clips); else placeCaptionClips(d, clips) })
    store.toast(clips.length + ' altyazı içe aktarıldı', 'ok', 1800)
    return clips.length
  } catch (e) {
    store.toast('Altyazı içe aktarılamadı: ' + (e.message || e), 'error', 4000)
    return 0
  }
}

function cuesToClips(cues) {
  return cues.filter(c => c.text && c.end > c.start).map(c => {
    const clip = createTextClip({ start: c.start, duration: Math.max(0.2, c.end - c.start) })
    clip.name = 'Altyazı'
    clip.text = { ...clip.text, content: c.text, size: 64, maxWidth: 0.82 }
    clip.transform = { ...clip.transform, y: 0.3 }
    clip.caption = { words: c.words || [], styleId: null, groupId: 'imp' }
    return clip
  })
}

function fmtSrt(t) {
  const ms = Math.round(t * 1000)
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000
  const p = (n, k = 2) => String(n).padStart(k, '0')
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`
}

// Projenin altyazı metni (altyazı klibi varsa yalnız onlar, yoksa bütün yazılar)
export async function subtitleText(format = 'srt') {
  const p = store.get().project
  const S = await feature('subtitles')
  let out = null
  if (S && S.exportSubtitles) {
    try { out = S.exportSubtitles(p, format, { captionsOnly: (S.collectCues ? S.collectCues(p, { captionsOnly: true }).length > 0 : false) }) } catch (e) { out = null }
  }
  if (!out && format === 'srt') {
    let clips = []
    for (const t of p.tracks) if (t.kind === 'text' && !t.hidden) for (const c of t.clips) clips.push(c)
    const caps = clips.filter(c => c.caption)
    if (caps.length) clips = caps
    clips.sort((a, b) => a.start - b.start)
    out = clips.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.start + c.duration)}\n${(c.text && c.text.content) || ''}\n`).join('\n')
  }
  return out || ''
}

export async function exportSubtitleFile(format = 'srt') {
  if (!ipc) return
  const p = store.get().project
  const out = await subtitleText(format)
  if (!out.trim()) { store.toast('Dışa aktarılacak altyazı yok', 'info'); return }
  const safe = (p.name || 'altyazi').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'altyazi'
  const file = await ipc.invoke('dialog:save', { title: 'Altyazıyı dışa aktar', defaultPath: safe + '.' + format, filters: [{ name: format.toUpperCase(), extensions: [format] }] })
  if (!file) return
  const S = await feature('subtitles')
  if (S && S.writeSubtitleFile) await S.writeSubtitleFile(file, out)
  else fs.writeFileSync(file, out, 'utf8')
  store.toast('Altyazı kaydedildi', 'ok', 1500)
}
