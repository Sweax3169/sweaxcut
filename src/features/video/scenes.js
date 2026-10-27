// Sahne algılama: ffmpeg select='gt(scene,T)',showinfo → kesme anları (kaynak saniyesi).
// Hız için kareler küçültülerek puanlanır; çok yakın kesmeler (flaş, patlama) birleştirilir.

import { store, findClip } from '../../core/store.js'
import { splitAt } from '../../core/timeline.js'
import { runFF, getMedia, probeVideo, progressFn, checkAbort, sourceToTimeline } from './util.js'

const cache = new Map() // media.key|eşik → [sn]

// detectScenes(mediaId, { threshold=0.3, minGap=0.6, onProgress, signal }) → [saniye] (kaynak zamanı, artan)
export async function detectScenes(mediaId, { threshold = 0.3, minGap = 0.6, onProgress, signal, busy = false } = {}) {
  const media = getMedia(mediaId)
  if (!media) throw new Error('Medya bulunamadı')
  if (media.type !== 'video') throw new Error('Sahne algılama yalnızca videoda çalışır')
  threshold = Math.max(0.02, Math.min(0.95, +threshold || 0.3))
  const ck = (media.key || media.path) + '|' + threshold.toFixed(3) + '|' + minGap
  if (cache.has(ck)) { if (onProgress) onProgress(1); return cache.get(ck).slice() }
  const prog = progressFn(onProgress, busy ? 'Sahneler algılanıyor…' : null)
  try {
    checkAbort(signal)
    const info = await probeVideo(media.path)
    const dur = info.duration || media.duration || 1
    const times = []
    let buf = ''
    const big = info.width * info.height > 1920 * 1088 * 1.05
    // -v info: showinfo satırları stderr'e düşer
    const r = await runFF(['-hide_banner', '-nostdin', ...(big ? ['-hwaccel', 'auto'] : []), '-i', media.path, '-an', '-sn', '-dn',
      '-vf', `scale=320:-2:flags=fast_bilinear,select='gt(scene,${threshold})',showinfo`, '-fps_mode', 'passthrough', '-f', 'null', '-'], {
      signal, duration: dur, onProgress: prog,
      onStderr: (s) => {
        buf += s
        let i
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1)
          if (line.includes('Parsed_showinfo')) {
            const m = /pts_time:\s*([0-9.]+)/.exec(line)
            if (m) times.push(+m[1])
          }
        }
      },
    })
    if (r.code !== 0) throw new Error('Sahne algılama başarısız: ' + (r.err || '').slice(-300))
    // yakın kesmeleri birleştir, uçlardaki anlamsız kesmeleri at
    const out = []
    for (const t of times.sort((a, b) => a - b)) {
      if (t < 0.15 || t > dur - 0.15) continue
      if (out.length && t - out[out.length - 1] < minGap) continue
      out.push(Math.round(t * 1000) / 1000)
    }
    cache.set(ck, out)
    prog(1)
    return out.slice()
  } finally {
    if (busy) store.busy(null)
  }
}

// Klibi sahne kesmelerinden böl (tek geri alma adımı). Dönen: oluşturulan parça id'leri.
export async function splitClipAtScenes(clipId, opts = {}) {
  const f = findClip(store.get().project, clipId)
  if (!f || f.clip.type !== 'video') throw new Error('Video klibi seçin')
  const times = await detectScenes(f.clip.mediaId, opts)
  // algılama sürerken klip değişmiş olabilir: güncel hâli
  const cur = findClip(store.get().project, clipId)
  if (!cur) return []
  const c = cur.clip
  const fps = store.get().project.settings.fps || 30
  const cuts = []
  for (const st of times) {
    const tl = sourceToTimeline(c, st)
    if (tl == null) continue
    const snapped = Math.round(tl * fps) / fps // kare sınırına
    if (snapped > c.start + 0.05 && snapped < c.start + c.duration - 0.05) cuts.push(snapped)
  }
  cuts.sort((a, b) => a - b)
  if (!cuts.length) { store.toast('Bu klipte sahne değişimi bulunamadı'); return [] }
  const created = []
  const ui = store.get().ui
  store.edit('Sahnelere böl', d => {
    let target = clipId
    for (const t of cuts) {
      const ids = splitAt(d, t, [target], ui)
      if (ids[0]) { created.push(ids[0]); target = ids[0] }
    }
  })
  store.toast(`${created.length} kesme yapıldı · ${created.length + 1} sahne`, 'info')
  return created
}
