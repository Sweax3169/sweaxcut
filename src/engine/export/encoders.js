// Kodlayıcı tespiti ve ffmpeg argümanları (kalite eşlemesi, kap/kodek uyumu, renk etiketleri)

import { run } from '../../platform/node.js'
import { ffmpegPath } from './proc.js'

export const QUALITIES = ['dusuk', 'orta', 'yuksek', 'maksimum']
const qi = q => Math.max(0, QUALITIES.indexOf(q) < 0 ? 1 : QUALITIES.indexOf(q))

export const HW_KINDS = ['nvenc', 'amf', 'qsv']
const HW_NAMES = {
  nvenc: { h264: 'h264_nvenc', hevc: 'hevc_nvenc', av1: 'av1_nvenc' },
  amf: { h264: 'h264_amf', hevc: 'hevc_amf', av1: 'av1_amf' },
  qsv: { h264: 'h264_qsv', hevc: 'hevc_qsv', av1: 'av1_qsv', vp9: 'vp9_qsv' },
}
const CPU_NAMES = { h264: ['libx264'], hevc: ['libx265'], av1: ['libsvtav1', 'libaom-av1'], vp9: ['libvpx-vp9'], prores: ['prores_ks'] }
const HW_LABEL = { nvenc: 'NVIDIA NVENC', amf: 'AMD AMF', qsv: 'Intel Quick Sync', cpu: 'İşlemci' }
const CODEC_LABEL = { h264: 'H.264', hevc: 'HEVC (H.265)', av1: 'AV1', vp9: 'VP9', prores: 'ProRes' }
// donanım kodlayıcı en büyük kenar sınırı
const HW_MAX = { h264_nvenc: 4096, hevc_nvenc: 8192, av1_nvenc: 8192, h264_amf: 4096, hevc_amf: 8192, av1_amf: 8192, h264_qsv: 4096, hevc_qsv: 8192, av1_qsv: 8192, vp9_qsv: 8192 }

// Kap biçimleri
export const FORMATS = {
  mp4: { muxer: 'mp4', ext: '.mp4', video: ['h264', 'hevc', 'av1'], audio: 'aac', faststart: true, label: 'MP4' },
  mov: { muxer: 'mov', ext: '.mov', video: ['h264', 'hevc', 'prores'], audio: 'aac', faststart: true, label: 'MOV' },
  webm: { muxer: 'webm', ext: '.webm', video: ['vp9', 'av1'], audio: 'opus', label: 'WebM' },
  gif: { muxer: 'gif', ext: '.gif', video: ['gif'], audio: null, label: 'GIF' },
  mp3: { muxer: 'mp3', ext: '.mp3', video: null, audio: 'mp3', label: 'MP3' },
  wav: { muxer: 'wav', ext: '.wav', video: null, audio: 'wav', label: 'WAV' },
  m4a: { muxer: 'ipod', ext: '.m4a', video: null, audio: 'aac', label: 'M4A' },
}

export function isAudioOnly(format) { return !!FORMATS[format] && !FORMATS[format].video }

// Kap ile uyumsuz kodeği düzelt
export function coerceCodec(format, codec) {
  const f = FORMATS[format]
  if (!f || !f.video) return null
  if (format === 'gif') return 'gif'
  if (f.video.includes(codec)) return codec
  return f.video[0]
}

let caps = null
let capsPromise = null

async function encoderList() {
  const r = await run(ffmpegPath(), ['-hide_banner', '-encoders'])
  const set = new Set()
  for (const line of String(r.out || '').split('\n')) {
    const m = /^\s*[VAS][A-Z.]{5}\s+(\S+)/.exec(line)
    if (m) set.add(m[1])
  }
  return set
}

async function testEncode(name) {
  const r = await run(ffmpegPath(), ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30:d=0.2',
    '-frames:v', '4', '-pix_fmt', name.endsWith('_qsv') ? 'nv12' : 'yuv420p', '-c:v', name, '-f', 'null', '-'])
  return r.code === 0
}

// Donanım kodlayıcılarını bir kez test et. { hw:{nvenc:{h264:true..}}, cpu:{h264:'libx264'..}, best, list }
const CACHE_KEY = 'sweaxcut.encoders.v1'
const CACHE_TTL = 3 * 24 * 3600e3

function readCache() {
  try {
    const j = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (j && j.ffmpeg === ffmpegPath() && Date.now() - j.at < CACHE_TTL && j.caps) return j.caps
  } catch (e) { /* */ }
  return null
}

// Sonuç 3 gün önbellekte (kodlayıcı başarısız olursa dışa aktarma zaten işlemciye düşer)
export function getEncoders({ refresh = false } = {}) {
  if (caps && !refresh) return Promise.resolve(caps)
  if (capsPromise && !refresh) return capsPromise
  if (!refresh) { const c = readCache(); if (c) { caps = c; return Promise.resolve(caps) } }
  capsPromise = (async () => {
    const avail = await encoderList().catch(() => new Set())
    const hw = {}
    const jobs = []
    for (const kind of HW_KINDS) {
      hw[kind] = {}
      for (const [codec, name] of Object.entries(HW_NAMES[kind])) {
        hw[kind][codec] = false
        if (!avail.has(name)) continue
        jobs.push(testEncode(name).then(ok => { hw[kind][codec] = ok }).catch(() => {}))
      }
    }
    await Promise.all(jobs)
    const cpu = {}
    for (const [codec, names] of Object.entries(CPU_NAMES)) cpu[codec] = names.find(n => avail.has(n)) || null
    const best = HW_KINDS.find(k => hw[k].h264) || 'cpu'
    const list = []
    for (const kind of HW_KINDS) for (const codec of Object.keys(hw[kind])) {
      if (hw[kind][codec]) list.push({ id: HW_NAMES[kind][codec], codec, hw: kind, label: `${HW_LABEL[kind]} ${CODEC_LABEL[codec]}` })
    }
    for (const codec of Object.keys(cpu)) if (cpu[codec]) list.push({ id: cpu[codec], codec, hw: 'cpu', label: `${HW_LABEL.cpu} ${CODEC_LABEL[codec]} (${cpu[codec]})` })
    caps = { hw, cpu, best, list, available: [...avail].filter(n => /nvenc|amf|qsv|^lib|prores/.test(n)) }
    if (avail.size) try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ffmpeg: ffmpegPath(), at: Date.now(), caps })) } catch (e) { /* */ }
    return caps
  })()
  return capsPromise
}

// Kodlayıcı seç → { name, hw }
export function pickEncoder(codec, hw, c, { width = 1920, height = 1080 } = {}) {
  if (codec === 'prores') return { name: c.cpu.prores || 'prores_ks', hw: 'cpu' }
  const order = hw === 'cpu' ? [] : (!hw || hw === 'auto') ? HW_KINDS : [hw]
  const big = Math.max(width, height)
  for (const kind of order) {
    const name = HW_NAMES[kind] && HW_NAMES[kind][codec]
    if (!name || !c.hw[kind] || !c.hw[kind][codec]) continue
    if (HW_MAX[name] && big > HW_MAX[name]) continue
    return { name, hw: kind }
  }
  const name = c.cpu[codec]
  if (!name) throw new Error(`${CODEC_LABEL[codec] || codec} kodlayıcısı bulunamadı`)
  return { name, hw: 'cpu' }
}

export function cpuEncoder(codec, c) {
  return { name: (c && c.cpu[codec]) || CPU_NAMES[codec][CPU_NAMES[codec].length - 1], hw: 'cpu' }
}

const COLOR_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']

// Video kodlama argümanları. inputPix: 'yuv420p' (GPU'da BT.709 dönüştürülmüş) | 'rgba'
export function videoArgs(enc, codec, { quality = 'orta', bitrateKbps = 0, fps = 30, inputPix = 'yuv420p' } = {}) {
  const q = qi(quality)
  const name = enc.name
  const a = []
  const kb = Math.max(0, Math.round(+bitrateKbps || 0))
  const rate = kb ? ['-b:v', kb + 'k', '-maxrate', Math.round(kb * 1.5) + 'k', '-bufsize', Math.round(kb * 2) + 'k'] : null
  let pix = 'yuv420p'
  if (codec === 'prores') pix = q >= 3 ? 'yuv444p10le' : 'yuv422p10le'
  // RGB → YUV dönüşümü yalnız RGBA girişte (BT.709 sınırlı aralık)
  if (inputPix === 'rgba') a.push('-vf', `scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd,format=${pix}`)
  else if (pix !== 'yuv420p') a.push('-vf', `format=${pix}`)
  a.push('-c:v', name)
  const gop = Math.max(1, Math.round(fps * 2))
  if (name === 'libx264') {
    a.push('-preset', ['veryfast', 'faster', 'medium', 'slow'][q], '-profile:v', 'high')
    if (rate) a.push(...rate); else a.push('-crf', String([28, 23, 19, 16][q]))
  } else if (name === 'libx265') {
    a.push('-preset', ['veryfast', 'fast', 'medium', 'slow'][q], '-tag:v', 'hvc1', '-x265-params', 'log-level=error')
    if (rate) a.push(...rate); else a.push('-crf', String([31, 27, 23, 20][q]))
  } else if (name === 'libsvtav1') {
    a.push('-preset', String([10, 8, 6, 5][q]))
    if (rate) a.push('-b:v', kb + 'k'); else a.push('-crf', String([40, 34, 28, 22][q]))
  } else if (name === 'libaom-av1') {
    a.push('-cpu-used', String([8, 7, 6, 5][q]), '-usage', q <= 1 ? 'realtime' : 'good', '-row-mt', '1', '-tiles', '2x2')
    if (rate) a.push('-b:v', kb + 'k'); else a.push('-crf', String([40, 34, 28, 22][q]), '-b:v', '0')
  } else if (name === 'libvpx-vp9') {
    a.push('-deadline', q >= 3 ? 'good' : 'realtime', '-cpu-used', String([8, 6, 4, 2][q]), '-row-mt', '1', '-tile-columns', '2')
    if (rate) a.push('-b:v', kb + 'k'); else a.push('-crf', String([40, 34, 28, 22][q]), '-b:v', '0')
  } else if (name === 'prores_ks') {
    a.push('-profile:v', String([0, 2, 3, 4][q]), '-vendor', 'apl0')
  } else if (name.endsWith('_nvenc')) {
    a.push('-preset', ['p4', 'p5', 'p6', 'p7'][q], '-tune', 'hq', '-g', String(gop), '-spatial-aq', '1')
    if (codec === 'h264') a.push('-profile:v', 'high')
    if (codec === 'hevc') a.push('-profile:v', 'main', '-tag:v', 'hvc1')
    // ÖNEMLİ: -cq ile -b:v 0 şart, yoksa ~2 Mbps'e kilitlenir
    if (rate) a.push('-rc', 'vbr', ...rate)
    else {
      const cq = codec === 'av1' ? [36, 30, 26, 22][q] : codec === 'hevc' ? [31, 27, 23, 20][q] : [29, 24, 20, 17][q]
      a.push('-rc', 'vbr', '-cq', String(cq), '-b:v', '0')
    }
  } else if (name.endsWith('_amf')) {
    a.push('-quality', ['speed', 'balanced', 'quality', 'quality'][q], '-g', String(gop))
    if (codec === 'hevc') a.push('-tag:v', 'hvc1')
    if (rate) a.push('-rc', 'vbr_peak', ...rate)
    else {
      const qp = codec === 'av1' ? [160, 128, 100, 80][q] : [29, 24, 20, 17][q]
      a.push('-rc', 'cqp', '-qp_i', String(qp), '-qp_p', String(qp))
      if (codec === 'h264') a.push('-qp_b', String(qp))
    }
  } else if (name.endsWith('_qsv')) {
    a.push('-preset', ['veryfast', 'faster', 'medium', 'slower'][q], '-g', String(gop))
    if (codec === 'hevc') a.push('-tag:v', 'hvc1')
    if (rate) a.push(...rate); else a.push('-global_quality', String([29, 24, 20, 17][q]))
  }
  if (name !== 'prores_ks') a.push('-pix_fmt', name.endsWith('_qsv') ? 'nv12' : pix)
  else a.push('-pix_fmt', pix)
  a.push(...COLOR_TAGS)
  return a
}

// Ses kodlama argümanları
export function audioArgs(kind, { audioBitrate, quality = 'orta' } = {}) {
  const q = qi(quality)
  if (kind === 'aac') return ['-c:a', 'aac', '-b:a', (audioBitrate || [128, 192, 256, 320][q]) + 'k', '-ar', '48000']
  if (kind === 'opus') return ['-c:a', 'libopus', '-b:a', (audioBitrate || [96, 128, 160, 256][q]) + 'k', '-ar', '48000']
  if (kind === 'mp3') return ['-c:a', 'libmp3lame', '-b:a', (audioBitrate || [128, 192, 256, 320][q]) + 'k', '-ar', '48000']
  if (kind === 'wav') return ['-c:a', q >= 2 ? 'pcm_s24le' : 'pcm_s16le', '-ar', '48000']
  return ['-c:a', 'aac', '-b:a', '192k']
}

// Tahmini video bit hızı (kbps)
export function estimateVideoKbps({ codec = 'h264', quality = 'orta', bitrateKbps, width = 1080, height = 1920, fps = 30 }) {
  if (bitrateKbps) return +bitrateKbps
  const q = qi(quality)
  const px = (width * height) / (1920 * 1080)
  if (codec === 'prores') return [45000, 147000, 220000, 330000][q] * px * (fps / 30)
  const base = [3500, 7000, 12000, 20000][q]
  const k = { h264: 1, hevc: 0.65, av1: 0.55, vp9: 0.7 }[codec] || 1
  return base * Math.pow(px, 0.85) * Math.pow(fps / 30, 0.6) * k
}
