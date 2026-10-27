// Kütüphaneden ekleme komutları — kart tıklaması ve (istenirse) zaman çizelgesine bırakma aynı yoldan geçer.
// insertLibraryItem({ kind, id }, { time, trackId }) zaman çizelgesi tarafından da çağrılabilir.

import { store, selectedClips } from '../../core/store.js'
import * as TL from '../../core/timeline.js'
import { createAudioClip } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import { importFiles } from '../../core/media.js'
import { playback } from '../../engine/playback.js'
import { fs, path, cacheDir } from '../../platform/node.js'
import * as A from '../actions.js'
import { pushRecent, lsGet } from './common.jsx'
import { feature } from './features.js'

export const now = () => playback.time

// ---------------------------------------------------------------- ses sentezi (sfx paketi yoksa yerel yedek)
const sfxRender = () => feature('sfx')

// def.synth(ctx, t0) → AudioBuffer
export async function synthBuffer(def) {
  const m = await sfxRender()
  if (m && m.renderSynth) {
    const r = await m.renderSynth(def)
    if (r && r.getChannelData) return r
    if (r && r.buffer && r.buffer.getChannelData) return r.buffer
  }
  const sr = def.sampleRate || 48000
  const ch = def.channels || 2
  const len = Math.max(1, Math.ceil((def.duration || 2) * sr))
  const ctx = new OfflineAudioContext(ch, len, sr)
  await def.synth(ctx, 0)
  return await ctx.startRendering()
}

export function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true)
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * ch * 2, true)
  const data = []
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2 }
  return new Uint8Array(out.buffer)
}

// Ses öğesini WAV dosyasına yaz (önbellekte varsa yeniden üretme). sfx paketinin önbellek yolu tercih edilir
// (zaman çizelgesine bırakma da aynı dosyayı üretir → içe aktarma aynı medyayı yeniden kullanır)
export async function audioDefToFile(def, kind = 'sfx') {
  if (!fs) throw new Error('Dosya sistemi yok (yalnız masaüstü uygulamasında)')
  const m = await sfxRender()
  if (m && m.renderCached) {
    const p = await m.renderCached(def, kind)
    if (p && fs.existsSync(p)) return p
  }
  const out = path.join(cacheDir(kind), `${def.id}-v${def.version || 1}.wav`)
  if (fs.existsSync(out) && fs.statSync(out).size > 44) return out
  if (m && m.renderToFile) {
    const r = await m.renderToFile(def, out)
    if (r && fs.existsSync(r)) return r
  }
  const buf = await synthBuffer(def)
  fs.writeFileSync(out, encodeWav(buf))
  return out
}

// Ses öğesini (müzik / sfx) zaman çizelgesine ekle
export async function insertAudioDef(kind, def, time) {
  const t = time ?? now()
  store.busy((kind === 'music' ? 'Müzik' : 'Ses efekti') + ' hazırlanıyor…', null)
  try {
    const file = await audioDefToFile(def, kind === 'music' ? 'music' : 'sfx')
    const ids = await importFiles([file], { role: kind === 'music' ? 'music' : 'sfx' })
    const id = ids[0]
    if (!id) return null
    store.edit('medya', d => { if (d.media[id]) { d.media[id].name = def.name; d.media[id].generated = true } }, { noHistory: true })
    const cid = A.addMediaToTimeline(id, t, { role: kind === 'music' ? 'music' : 'sfx' })
    pushRecent(kind, def.id)
    return cid
  } catch (e) {
    store.toast('Ses eklenemedi: ' + (e.message || e), 'error', 4000)
    return null
  } finally { store.busy(null) }
}

// Ses dosyasını yeni bir ses izine yerleştir (seslendirme / TTS)
export function placeAudioOnNewTrack(mediaId, time, role = 'voice', label = 'Seslendirme ekle') {
  const m = store.get().project.media[mediaId]
  if (!m) return null
  let id = null
  store.edit(label, d => {
    const tr = TL.newTrack(d, 'audio')
    tr.name = role === 'voice' ? 'Seslendirme' : ''
    const c = createAudioClip(d.media[mediaId], { start: Math.max(0, time), role })
    tr.clips.push(c)
    id = c.id
  })
  if (id) store.select([id])
  return id
}

// ---------------------------------------------------------------- tek giriş noktası
export async function insertLibraryItem(obj, opts = {}) {
  const { kind, id } = obj || {}
  const time = opts.time
  switch (kind) {
    case 'media': {
      let mid = id
      if (!mid && obj.path) mid = (await importFiles([obj.path]))[0]
      if (!mid) return null
      return A.addMediaToTimeline(mid, time, obj.overlay ? { overlay: true } : {})
    }
    case 'text': {
      const tpl = id && id !== '__default' ? regGet('textTemplates', id) : null
      pushRecent('text', id || '__default')
      return A.addText(tpl, time)
    }
    case 'sticker': {
      const def = regGet('stickers', id)
      if (!def) return null
      pushRecent('sticker', id)
      return A.addSticker(def, time)
    }
    case 'effect': {
      const def = regGet('effects', id)
      if (!def) return null
      pushRecent('effect', id)
      const toClip = opts.toClip ?? (obj.toClip ?? lsGet('fxToClip', false))
      const before = store.get().rev
      const r = A.addEffect(def, { toClip, time })
      if (toClip && store.get().rev !== before) store.toast(`"${def.name}" seçili klibe uygulandı`, 'ok', 1400)
      return r
    }
    case 'filter': {
      const def = regGet('filters', id)
      if (!def) return null
      pushRecent('filter', id)
      const sel = selectedClips().filter(c => c.type === 'video' || c.type === 'image')
      const r = A.addFilter(def, { time, toClip: opts.toClip ?? true })
      if (sel.length && (opts.toClip ?? true)) store.toast(`"${def.name}" filtresi ${sel.length > 1 ? sel.length + ' klibe' : 'klibe'} uygulandı`, 'ok', 1400)
      return r
    }
    case 'transition': {
      const def = regGet('transitions', id)
      if (!def) return null
      pushRecent('transition', id)
      if (opts.all) { A.applyTransitionAll(def); store.toast(`"${def.name}" bütün kesimlere uygulandı`, 'ok', 1600); return null }
      return A.applyTransition(def, opts.clipId)
    }
    case 'sfx':
    case 'music': {
      const def = regGet(kind, id)
      if (!def) return null
      return insertAudioDef(kind, def, time)
    }
    case 'layout': {
      const def = regGet('layouts', id)
      if (!def) return null
      return applyLayout(def)
    }
    default: return null
  }
}

export function layoutCtx() {
  const s = store.get()
  return {
    ui: s.ui, time: now(), selection: s.selection.clips.slice(), selectedClipIds: s.selection.clips.slice(),
    width: s.project.settings.width, height: s.project.settings.height,
  }
}

export function applyLayout(def) {
  try {
    store.edit('Düzen: ' + def.name, d => def.apply(d, layoutCtx()))
    pushRecent('layout', def.id)
    store.toast(`"${def.name}" düzeni uygulandı`, 'ok', 1400)
  } catch (e) {
    store.toast('Düzen uygulanamadı: ' + (e.message || e), 'error', 4000)
  }
  return null
}
