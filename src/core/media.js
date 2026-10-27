// Medya içe aktarma hattı: ffprobe → medya öğesi; arka planda küçük resimler, dalga formu, ses çıkarma, vekil video.
// Bütün ağır işler bir iş kuyruğunda sırayla (aynı anda 2) yürür; durum store'daki media öğesine yazılır.

import { store } from './store.js'
import { uid } from './model.js'
import { appPaths, fs, path, run, cacheDir, hashString, fileUrl, isElectron } from '../platform/node.js'

export const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.mts', '.m2ts', '.wmv', '.flv', '.3gp', '.mpg', '.mpeg', '.gif']
export const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wma', '.aiff', '.aif']
export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.svg', '.avif']
export const ALL_EXTS = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS]

// Chromium'un doğrudan oynatabildiği video kodekleri (kap da önemli).
// Ölçüm (Electron 33): MKV yükleniyor ama aramada kare göstermiyor, AVI açılmıyor, HEVC yalnızca GPU'da çözülüyor
// (başka makinede çalışmayabilir) → bunlar her zaman vekile çevrilir.
const PLAYABLE_VCODEC = ['h264', 'vp8', 'vp9', 'av1']
const PLAYABLE_CONTAINER = ['.mp4', '.mov', '.m4v', '.webm']

export function ffmpegBin() { return appPaths().ffmpeg }
export function ffprobeBin() { return appPaths().ffprobe }

export function mediaKey(p) {
  try {
    const st = fs.statSync(p)
    return hashString(p + '|' + st.size + '|' + st.mtimeMs)
  } catch (e) { return hashString(p) }
}

export async function probe(p) {
  const r = await run(ffprobeBin(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', p])
  if (r.code !== 0) throw new Error('ffprobe: ' + (r.err || '').slice(-300))
  const j = JSON.parse(r.out || '{}')
  const streams = j.streams || []
  const v = streams.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic))
  const a = streams.find(s => s.codec_type === 'audio')
  const ext = path.extname(p).toLowerCase()
  let type = v ? 'video' : a ? 'audio' : null
  if (IMAGE_EXTS.includes(ext)) type = 'image'
  if (ext === '.gif') type = 'video'
  if (!type) throw new Error('desteklenmeyen dosya')
  const fr = v && (v.avg_frame_rate && v.avg_frame_rate !== '0/0' ? v.avg_frame_rate : v.r_frame_rate)
  let fps = 30
  if (fr) { const [n, d] = fr.split('/').map(Number); if (n && d) fps = n / d }
  let rotation = 0
  if (v) {
    if (v.tags && v.tags.rotate) rotation = +v.tags.rotate
    const sd = (v.side_data_list || []).find(x => x.rotation != null)
    if (sd) rotation = -(+sd.rotation)
    rotation = ((rotation % 360) + 360) % 360
  }
  let width = v ? v.width : 0, height = v ? v.height : 0
  if (rotation === 90 || rotation === 270) [width, height] = [height, width]
  const duration = type === 'image' ? 0 : (+j.format.duration || +(v && v.duration) || +(a && a.duration) || 0)
  return {
    type, width, height, fps: Math.round(fps * 1000) / 1000, duration, rotation,
    hasAudio: !!a, vcodec: v ? v.codec_name : null, acodec: a ? a.codec_name : null,
    sampleRate: a ? +a.sample_rate : 0, channels: a ? a.channels : 0,
    bitrate: +j.format.bit_rate || 0, size: +j.format.size || 0,
    pixFmt: v ? v.pix_fmt : null,
  }
}

function imageSize(p) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 })
    img.onerror = () => resolve({ width: 1000, height: 1000 })
    img.src = fileUrl(p)
  })
}

// Dosyaları içe aktar; oluşturulan medya id'lerini döndürür
export async function importFiles(paths, opts = {}) {
  const ids = []
  for (const p of paths) {
    const ext = path.extname(p).toLowerCase()
    if (!ALL_EXTS.includes(ext)) continue
    // aynı dosya zaten projede mi?
    const existing = Object.values(store.get().project.media).find(m => m.path === p)
    if (existing) { ids.push(existing.id); continue }
    try {
      const info = await probe(p).catch(async (e) => {
        if (IMAGE_EXTS.includes(ext)) return { type: 'image', duration: 0, hasAudio: false }
        throw e
      })
      if (info.type === 'image' && (!info.width || ext === '.svg')) Object.assign(info, await imageSize(p))
      const id = uid('m')
      const key = mediaKey(p)
      const media = {
        id, key, path: p, name: path.basename(p), ext, ...info,
        status: info.type === 'image' ? 'ready' : 'processing', progress: 0,
        proxyPath: null, audioPath: null, peaksPath: null, thumbsDir: null, thumbInterval: 0, thumbCount: 0,
        addedAt: Date.now(), role: opts.role || null,
      }
      store.edit('Medya içe aktar', d => { d.media[id] = media }, { noHistory: true })
      ids.push(id)
      if (info.type !== 'image') enqueueProcessing(id)
    } catch (e) {
      store.toast(`"${path.basename(p)}" açılamadı: ${String(e.message || e).slice(0, 120)}`, 'error', 5000)
    }
  }
  return ids
}

// ---------------------------------------------------------------- iş kuyruğu
const queue = []
let active = 0
const MAX_ACTIVE = 2

export function enqueue(job) {
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject })
    pump()
  })
}
function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const { job, resolve, reject } = queue.shift()
    active++
    Promise.resolve().then(job).then(resolve, reject).finally(() => { active--; pump() })
  }
}

function patchMedia(id, patch) {
  const m = store.get().project.media[id]
  if (!m) return
  store.edit('medya', d => { if (d.media[id]) Object.assign(d.media[id], patch) }, { noHistory: true })
}

export function getMedia(id) { return store.get().project.media[id] }

function enqueueProcessing(id) {
  enqueue(() => processMedia(id)).catch(e => {
    console.warn('medya işleme hatası', e)
    patchMedia(id, { status: 'ready', error: String(e.message || e) })
  })
}

// Önbellekte varsa yeniden üretme
async function processMedia(id) {
  const m = getMedia(id)
  if (!m) return
  const dir = cacheDir('media', m.key)
  const audioPath = path.join(dir, 'audio.flac')
  const peaksPath = path.join(dir, 'peaks.bin')
  const thumbsDir = path.join(dir, 'thumbs')
  const proxyPath = path.join(dir, 'proxy.mp4')

  // 1) ses çıkar + dalga formu
  if (m.hasAudio) {
    if (!exists(audioPath)) {
      const r = await run(ffmpegBin(), ['-y', '-v', 'error', '-i', m.path, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'flac', '-compression_level', '0', audioPath + '.tmp.flac'])
      if (r.code === 0) fs.renameSync(audioPath + '.tmp.flac', audioPath)
    }
    if (exists(audioPath)) patchMedia(id, { audioPath })
    if (!exists(peaksPath) && exists(audioPath)) await computePeaks(audioPath, peaksPath)
    if (exists(peaksPath)) patchMedia(id, { peaksPath })
  }
  patchMedia(id, { progress: 0.3 })

  if (m.type === 'video') {
    // 2) küçük resimler (zaman çizelgesi şeridi)
    const interval = Math.max(0.5, Math.min(10, m.duration / 160))
    const count = Math.max(1, Math.ceil(m.duration / interval))
    if (!exists(path.join(thumbsDir, 'done'))) {
      fs.mkdirSync(thumbsDir, { recursive: true })
      const jpgCount = () => fs.readdirSync(thumbsDir).filter(f => f.endsWith('.jpg')).length
      // uzun kayıtlarda yalnız anahtar kareleri çöz (çok hızlı); kısa videolarda ya da sonuç boşsa tam çözüm
      let r = { code: 1 }
      if (m.duration > 60) r = await run(ffmpegBin(), ['-y', '-v', 'error', '-skip_frame', 'nokey', '-i', m.path, '-vf', `fps=1/${interval},scale=-2:96`, '-fps_mode', 'vfr', '-q:v', '6', path.join(thumbsDir, '%04d.jpg')])
      if (r.code !== 0 || jpgCount() === 0) {
        await run(ffmpegBin(), ['-y', '-v', 'error', '-hwaccel', 'auto', '-i', m.path, '-vf', `fps=1/${interval},scale=-2:96`, '-q:v', '6', path.join(thumbsDir, '%04d.jpg')])
      }
      fs.writeFileSync(path.join(thumbsDir, 'done'), String(interval))
    }
    const real = fs.readdirSync(thumbsDir).filter(f => f.endsWith('.jpg')).length
    patchMedia(id, { thumbsDir, thumbInterval: interval, thumbCount: real || count, progress: 0.5 })

    // 3) vekil video: oynatılamayan kodek/kap, 1440p üstü ya da uzun GOP'lu kayıtlar için hızlı arama sağlar
    const needProxy = !PLAYABLE_VCODEC.includes(m.vcodec) || !PLAYABLE_CONTAINER.includes(m.ext) || Math.max(m.width, m.height) > 1920 ||
      m.ext === '.gif' || (m.pixFmt && /10|12|422|444/.test(m.pixFmt)) || m.duration > 20
    if (needProxy) {
      if (!exists(proxyPath)) {
        const ok = await makeProxy(m, proxyPath, p => patchMedia(id, { progress: 0.5 + p * 0.5 }))
        if (!ok) console.warn('vekil üretilemedi', m.path)
      }
      if (exists(proxyPath)) patchMedia(id, { proxyPath })
    }
  }
  patchMedia(id, { status: 'ready', progress: 1 })
}

function exists(p) { try { return fs.statSync(p).size > 0 } catch (e) { return false } }

let nvencOk = null
export async function hasNvenc() {
  if (nvencOk != null) return nvencOk
  const r = await run(ffmpegBin(), ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-c:v', 'h264_nvenc', '-f', 'null', '-'])
  nvencOk = r.code === 0
  return nvencOk
}

async function makeProxy(m, out, onProgress) {
  const short = Math.min(m.width, m.height)
  const scale = short > 720 ? (m.width >= m.height ? 'scale=-2:720' : 'scale=720:-2') : 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
  const tmp = out + '.tmp.mp4'
  const vf = `${scale},format=yuv420p`
  // donanım çözme (varsa) vekil üretimini 2-4 kat hızlandırır; yoksa ffmpeg yazılıma düşer
  const common = ['-y', '-v', 'error', '-progress', 'pipe:2', '-hwaccel', 'auto', '-i', m.path, '-vf', vf, '-map', '0:v:0', '-an', '-movflags', '+faststart']
  const parse = s => {
    const mm = /out_time_us=(\d+)/.exec(s) || /out_time_ms=(\d+)/.exec(s)
    if (mm && m.duration) onProgress(Math.min(1, (+mm[1] / 1e6) / m.duration))
  }
  let r
  if (await hasNvenc()) {
    r = await run(ffmpegBin(), [...common, '-c:v', 'h264_nvenc', '-preset', 'p1', '-rc', 'vbr', '-cq', '26', '-b:v', '0', '-g', '15', '-bf', '0', tmp], { onStderr: parse })
  }
  if (!r || r.code !== 0) {
    r = await run(ffmpegBin(), [...common, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-g', '15', '-bf', '0', '-tune', 'fastdecode', tmp], { onStderr: parse })
  }
  if (r.code === 0) { fs.renameSync(tmp, out); return true }
  try { fs.unlinkSync(tmp) } catch (e) { /* */ }
  return false
}

// 100 tepe/sn, her tepe 0..255 (Uint8)
async function computePeaks(audioPath, out) {
  const r = await run(ffmpegBin(), ['-v', 'error', '-i', audioPath, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'])
  if (r.code !== 0 || !r.buf) return
  const buf = r.buf
  const n = Math.floor(buf.length / 2)
  const per = 80
  const peaks = new Uint8Array(Math.ceil(n / per))
  for (let i = 0, k = 0; i < n; i += per, k++) {
    let mx = 0
    const end = Math.min(n, i + per)
    for (let j = i; j < end; j++) { const v = Math.abs(buf.readInt16LE(j * 2)); if (v > mx) mx = v }
    peaks[k] = Math.min(255, Math.round(Math.sqrt(mx / 32768) * 255))
  }
  fs.writeFileSync(out, Buffer.from(peaks.buffer))
}

const peaksMem = new Map()
export function loadPeaks(media) {
  if (!media || !media.peaksPath) return null
  let p = peaksMem.get(media.peaksPath)
  if (p) return p
  try {
    const b = fs.readFileSync(media.peaksPath)
    p = new Uint8Array(b.buffer, b.byteOffset, b.length)
    peaksMem.set(media.peaksPath, p)
    return p
  } catch (e) { return null }
}

// Önizlemede oynatılacak dosya
export function previewPath(media) {
  return media.proxyPath || media.path
}

// Bir klibin gerçekte okunacağı kaynak dosya (işlenmiş türevler dahil).
// media.variants: { bgremove: yol (VP9 alfa webm), stab1|stab2|stab3: yol (sabitlenmiş) } — süre/zaman orijinalle aynı.
// reversed: true dönerse zaman ters eşlenir (t' = media.duration - t).
export function clipSourcePath(clip, media, { preview = false } = {}) {
  if (!media) return { path: null, reversed: false }
  const v = media.variants || {}
  if (clip.reverse && media.reversedPath) return { path: media.reversedPath, reversed: true }
  if (clip.bgRemove && v.bgremove) return { path: v.bgremove, reversed: false, alpha: true }
  if (clip.stabilize && v['stab' + clip.stabilize]) return { path: v['stab' + clip.stabilize], reversed: false }
  return { path: preview ? (media.proxyPath || media.path) : media.path, reversed: false }
}

export function thumbPath(media, index) {
  if (!media.thumbsDir) return null
  const i = Math.max(1, Math.min(media.thumbCount || 1, index + 1))
  return path.join(media.thumbsDir, String(i).padStart(4, '0') + '.jpg')
}

// Ters oynatma için ters çevrilmiş kopya (önizleme + dışa aktarma)
export async function ensureReversed(mediaId) {
  const m = getMedia(mediaId)
  if (!m || m.type !== 'video') return null
  if (m.reversedPath && exists(m.reversedPath)) return m.reversedPath
  const out = path.join(cacheDir('media', m.key), 'reversed.mp4')
  if (!exists(out)) {
    store.busy('Ters çevriliyor…', 0)
    const tmp = out + '.tmp.mp4'
    const enc = (await hasNvenc()) ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '19', '-b:v', '0', '-g', '15'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', '15']
    const r = await run(ffmpegBin(), ['-y', '-v', 'error', '-progress', 'pipe:2', '-i', m.path, '-vf', 'reverse,format=yuv420p', ...(m.hasAudio ? ['-af', 'areverse', '-c:a', 'aac', '-b:a', '192k'] : ['-an']), ...enc, tmp], {
      onStderr: s => { const mm = /out_time_us=(\d+)/.exec(s); if (mm && m.duration) store.busy('Ters çevriliyor…', Math.min(1, +mm[1] / 1e6 / m.duration)) },
    })
    store.busy(null)
    if (r.code !== 0) { store.toast('Ters çevirme başarısız', 'error'); return null }
    fs.renameSync(tmp, out)
  }
  const audioRev = path.join(cacheDir('media', m.key), 'audio-rev.flac')
  if (m.hasAudio && !exists(audioRev)) {
    await run(ffmpegBin(), ['-y', '-v', 'error', '-i', out, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'flac', audioRev])
  }
  patchMedia(mediaId, { reversedPath: out, reversedAudioPath: exists(audioRev) ? audioRev : null })
  return out
}

// Projedeki medya dosyaları kayıp mı?
export function missingMedia(project) {
  if (!isElectron) return []
  return Object.values(project.media).filter(m => m.path && !m.generated && !exists(m.path))
}

// Yeniden işleme (proje açılınca önbellek yolları başka makinede yoksa)
export function revalidateMedia() {
  const media = store.get().project.media
  for (const m of Object.values(media)) {
    if (m.type === 'image') continue
    const stale = (m.audioPath && !exists(m.audioPath)) || (m.proxyPath && !exists(m.proxyPath)) || (m.thumbsDir && !exists(path.join(m.thumbsDir, 'done'))) || m.status !== 'ready'
    if (stale && exists(m.path)) {
      patchMedia(m.id, { status: 'processing', audioPath: null, proxyPath: null, peaksPath: null })
      enqueueProcessing(m.id)
    }
  }
}

// Bir dosyayı (örn. üretilmiş ses, TTS, kayıt) doğrudan medya olarak ekle
export async function addGeneratedFile(p, opts = {}) {
  const ids = await importFiles([p], opts)
  if (ids[0] && opts.name) patchMedia(ids[0], { name: opts.name, generated: !!opts.generated })
  return ids[0]
}

export { appPaths }
