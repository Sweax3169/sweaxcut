// Otomatik vuruş yakınlaştırması (zoom punch): verilen anlarda transform.scale'e hızlı yakınlaş-geri dön anahtar kareleri.
// Vurgu anları ses ekibinin detectHighlights(audioPath) çıktısından (kaynak zamanı) gelebilir → sourceToTimeline ile çevrilir.

import { store, findClip } from '../../core/store.js'
import { upsertKey, evalKeys } from '../../core/keyframes.js'
import { getPath } from '../../core/model.js'
import { sourceToTimeline } from './util.js'

// times: zaman çizelgesi saniyeleri (proje zamanı). opts.timeBase: 'timeline' | 'source' | 'local'
// amount: yakınlaşma çarpanı, duration: toplam vuruş süresi (giriş ~%25, çıkış ~%75)
export function autoZoomPunch(clipId, times, { amount = 1.25, duration = 0.35, timeBase = 'timeline', attack = null, label = 'Otomatik zoom' } = {}) {
  const f = findClip(store.get().project, clipId)
  if (!f) throw new Error('Klip bulunamadı')
  const c = f.clip
  if (c.type === 'audio') throw new Error('Görsel bir klip seçin')
  amount = Math.max(1.01, Math.min(3, +amount || 1.25))
  duration = Math.max(0.12, Math.min(3, +duration || 0.35))
  const att = attack != null ? attack : Math.max(0.05, Math.min(0.12, duration * 0.25))
  // yerel zamana çevir, klip içinde kalanları sırala, çakışanları ele
  const locals = []
  for (const t of times || []) {
    let lt = t
    if (timeBase === 'timeline') lt = t - c.start
    else if (timeBase === 'source') { const tl = sourceToTimeline(c, t); if (tl == null) continue; lt = tl - c.start }
    if (!(lt >= 0 && lt < c.duration - 0.05)) continue
    locals.push(lt)
  }
  locals.sort((a, b) => a - b)
  const picked = []
  for (const lt of locals) if (!picked.length || lt - picked[picked.length - 1] >= duration + 0.05) picked.push(lt)
  if (!picked.length) return 0
  // mevcut ölçek eğrisini değişiklikten ÖNCE değerlendir (var olan anahtar kareler korunur)
  const keys0 = c.keyframes && c.keyframes['transform.scale'] ? c.keyframes['transform.scale'].map(k => ({ ...k })) : null
  const stat = getPath(c, 'transform.scale') ?? 1
  const base = t => (keys0 && keys0.length ? evalKeys(keys0, t, stat) : stat)
  const pre = 1 / 60
  store.edit(label, d => {
    let dc = null
    for (const t of d.tracks) { const x = t.clips.find(y => y.id === clipId); if (x) { dc = x; break } }
    if (!dc) return
    for (const lt of picked) {
      const t0 = Math.max(0, lt - pre)
      const t1 = Math.min(c.duration, lt + att)
      const t2 = Math.min(c.duration, lt + duration)
      // üstteki kareleri temizle (aynı aralıkta eski vuruşlar)
      const arr = dc.keyframes && dc.keyframes['transform.scale']
      if (arr) dc.keyframes['transform.scale'] = arr.filter(k => k.t < t0 - 1e-3 || k.t > t2 + 1e-3)
      upsertKey(dc, 'transform.scale', t0, base(t0), 'easeInOut')
      upsertKey(dc, 'transform.scale', t1, base(t1) * amount, 'cubicOut')
      upsertKey(dc, 'transform.scale', t2, base(t2), 'sineInOut')
    }
  })
  return picked.length
}

// Ses vurgularından otomatik zoom: ses ekibinin highlights modülü varsa onu kullanır
export async function autoZoomFromHighlights(clipId, { count = 8, minGap = 1.5, amount = 1.25, duration = 0.35, onProgress, signal } = {}) {
  const f = findClip(store.get().project, clipId)
  if (!f) throw new Error('Klip bulunamadı')
  const media = store.get().project.media[f.clip.mediaId]
  // çıkarılmış ses (flac) yoksa ffmpeg doğrudan kaynak dosyadan okur
  const src = media && (media.audioPath || (media.hasAudio ? media.path : null))
  if (!src) throw new Error('Bu klipte ses yok — vurgu bulunamıyor')
  const mods = import.meta.glob('../audio/highlights.js')
  const loader = mods['../audio/highlights.js']
  if (!loader) throw new Error('Vurgu algılama modülü henüz yok')
  const mod = await loader()
  if (signal && signal.aborted) throw Object.assign(new Error('İşlem iptal edildi'), { name: 'AbortError' })
  const res = await mod.detectHighlights(src, { count, minGap, onProgress, signal })
  if (onProgress) onProgress(1)
  // { time } nesneleri ya da düz saniyeler kabul edilir
  const times = (res || []).map(x => (typeof x === 'number' ? x : (x.time ?? x.t ?? x.start))).filter(x => isFinite(x))
  return autoZoomPunch(clipId, times, { amount, duration, timeBase: 'source' })
}
