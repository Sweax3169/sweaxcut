// Görüntü sabitleme: ffmpeg vidstab iki geçiş (analiz → dönüşüm) → H.264 türev (ses kopyalanır).
// Windows'ta filtre argümanındaki "C:" iki nokta ayırıcıyla çakışır → ffmpeg önbellek klasöründe (cwd) çalışır,
// .trf dosyası göreli adla verilir. Sonuç media.variants['stab'+level]; önizleme ve dışa aktarma aynı dosyayı okur.

import { hasNvenc } from '../../core/media.js'
import { store, findClip } from '../../core/store.js'
import { probeVideo, runFF, getMedia, mediaCache, setVariant, exists, rm, checkAbort, abortError, progressFn, path, fs } from './util.js'

export const STAB_LEVELS = {
  1: { label: 'Hafif', shakiness: 4, accuracy: 9, stepsize: 6, smoothing: 10, unsharp: '5:5:0.4:3:3:0.2' },
  2: { label: 'Orta', shakiness: 6, accuracy: 12, stepsize: 6, smoothing: 30, unsharp: '5:5:0.6:3:3:0.3' },
  3: { label: 'Güçlü', shakiness: 9, accuracy: 15, stepsize: 4, smoothing: 60, unsharp: '5:5:0.8:3:3:0.4' },
}

const running = new Map()

// stabilize(mediaId, level 1..3, { onProgress, signal, busy, force }) → { path, ms, ... }
export function stabilize(mediaId, level = 2, opts = {}) {
  const key = mediaId + ':' + level
  if (running.has(key)) return running.get(key)
  const p = doStab(mediaId, level, opts).finally(() => running.delete(key))
  running.set(key, p)
  return p
}

async function doStab(mediaId, level, { onProgress, signal, busy = false, force = false } = {}) {
  level = Math.max(1, Math.min(3, Math.round(level) || 2))
  const media = getMedia(mediaId)
  if (!media) throw new Error('Medya bulunamadı')
  if (media.type !== 'video') throw new Error('Sabitleme yalnızca videoda çalışır')
  const L = STAB_LEVELS[level]
  const prog = progressFn(onProgress, busy ? `Görüntü sabitleniyor (${L.label})…` : null)
  const dir = mediaCache(media)
  const name = `stab${level}`
  const out = path.join(dir, name + '.mp4')
  const t0 = performance.now()
  try {
    if (!force && exists(out)) {
      setVariant(mediaId, name, out)
      prog(1)
      return { path: out, cached: true, ms: 0 }
    }
    checkAbort(signal)
    prog(0)
    const info = await probeVideo(media.path)
    const trf = name + '.trf' // göreli: cwd = önbellek klasörü
    const tmp = name + '.tmp.mp4'
    rm(path.join(dir, trf)); rm(path.join(dir, tmp))
    const dur = info.duration || media.duration || 1
    const big = info.width * info.height > 1920 * 1088 * 1.05
    const hw = big ? ['-hwaccel', 'auto'] : []
    const tAnalyze = performance.now()

    // 1) analiz
    const r1 = await runFF(['-y', '-v', 'error', '-nostdin', ...hw, '-i', media.path, '-an', '-sn', '-dn',
      '-vf', `vidstabdetect=shakiness=${L.shakiness}:accuracy=${L.accuracy}:stepsize=${L.stepsize}:mincontrast=0.25:fileformat=ascii:result=${trf}`,
      '-f', 'null', '-'], { cwd: dir, signal, duration: dur, onProgress: p => prog(p * 0.45) })
    if (r1.code !== 0 || !exists(path.join(dir, trf))) throw new Error('Sabitleme analizi başarısız: ' + (r1.err || '').slice(-300))
    const analyzeMs = performance.now() - tAnalyze

    // 2) dönüşüm + kodlama (kare zamanları korunur: -fps_mode passthrough)
    const vf = `vidstabtransform=input=${trf}:smoothing=${L.smoothing}:optzoom=1:zoomspeed=0.25:interpol=bilinear:crop=black,unsharp=${L.unsharp},format=yuv420p`
    const g = String(Math.max(1, Math.round(info.F)))
    const color = info.matrix === 'bt709' ? ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'] : []
    const audio = info.hasAudio ? ['-map', '0:a:0', '-c:a', 'copy'] : []
    const common = ['-y', '-v', 'error', '-nostdin', ...hw, '-i', media.path, '-map', '0:v:0', ...audio, '-vf', vf, '-fps_mode', 'passthrough',
      '-color_range', info.range === 'pc' ? 'pc' : 'tv', ...color, '-movflags', '+faststart', '-sn', '-dn']
    const tEnc = performance.now()
    let r2 = null, encoder = 'libx264'
    if (await hasNvenc()) {
      encoder = 'h264_nvenc'
      r2 = await runFF([...common, '-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '17', '-b:v', '0', '-profile:v', 'high', '-g', g, tmp],
        { cwd: dir, signal, duration: dur, onProgress: p => prog(0.45 + p * 0.55) })
    }
    // filtre hatasında (bozuk .trf vb.) kodlayıcı değiştirmek işe yaramaz
    const filterErr = r => r && /vidstab|reinitializing filters/i.test(r.err || '')
    if (filterErr(r2)) throw new Error('Sabitleme dönüşümü başarısız: ' + (r2.err || '').slice(0, 300))
    if (!r2 || r2.code !== 0) {
      encoder = 'libx264'
      rm(path.join(dir, tmp))
      r2 = await runFF([...common, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-profile:v', 'high', '-g', g, tmp],
        { cwd: dir, signal, duration: dur, onProgress: p => prog(0.45 + p * 0.55) })
    }
    // ses akışı kapsayıcıya kopyalanamıyorsa (ör. pcm → mp4) AAC'ye çevir
    if (r2.code !== 0 && info.hasAudio && /codec|tag|not supported|Could not find/i.test(r2.err || '')) {
      rm(path.join(dir, tmp))
      const ci = common.indexOf('copy')
      const c2 = common.slice(); c2.splice(ci, 1, 'aac', '-b:a', '192k')
      r2 = await runFF([...c2, '-c:v', encoder, ...(encoder === 'h264_nvenc' ? ['-preset', 'p5', '-rc', 'vbr', '-cq', '17', '-b:v', '0'] : ['-preset', 'medium', '-crf', '17']), '-g', g, tmp],
        { cwd: dir, signal, duration: dur, onProgress: p => prog(0.45 + p * 0.55) })
    }
    if (r2.code !== 0 || !exists(path.join(dir, tmp))) throw new Error('Sabitlenmiş video yazılamadı: ' + (r2.err || '').slice(-300))
    rm(out)
    fs.renameSync(path.join(dir, tmp), out)
    rm(path.join(dir, trf))
    setVariant(mediaId, name, out)
    prog(1)
    const ms = performance.now() - t0
    let size = 0
    try { size = fs.statSync(out).size } catch (e) { /* */ }
    return { path: out, cached: false, ms, analyzeMs, encodeMs: performance.now() - tEnc, encoder, size, duration: dur, speed: dur / (ms / 1000) }
  } catch (e) {
    rm(path.join(dir, name + '.tmp.mp4')); rm(path.join(dir, name + '.trf'))
    if (signal && signal.aborted) throw abortError()
    throw e
  } finally {
    if (busy) store.busy(null)
  }
}

// Klibe sabitleme gücü ata (0 = kapalı); gerekirse türevi üretir
export async function setClipStabilize(clipId, level, opts = {}) {
  const f = findClip(store.get().project, clipId)
  if (!f || f.clip.type !== 'video') throw new Error('Video klibi seçin')
  level = Math.max(0, Math.min(3, Math.round(level) || 0))
  if (level) await stabilize(f.clip.mediaId, level, opts)
  store.edit(level ? 'Görüntü sabitleme' : 'Sabitlemeyi kapat', d => {
    for (const t of d.tracks) for (const c of t.clips) if (c.id === clipId) c.stabilize = level
  })
}
