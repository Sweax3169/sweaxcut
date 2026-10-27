'use strict'

// SWEAXCUT ffmpeg motoru — Sweax Studios
// Yatay videoyu dikey (1080x1920) formata çevirir: blur dolgu / akıllı zoom / üst-alt düzen

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

function fixAsar(p) {
  if (!p) return p
  return p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
}

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'
try { ffmpegPath = fixAsar(require('ffmpeg-static')) } catch (e) { /* geliştirme dışı ortam */ }
try { ffprobePath = fixAsar(require('ffprobe-static').path) } catch (e) { /* geliştirme dışı ortam */ }

const OUT_W = 1080
const OUT_H = 1920

const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.mts', '.m2ts', '.wmv', '.flv', '.3gp', '.mpg', '.mpeg']

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, Number(v) || 0)) }
function evenFloor(n) { return Math.max(2, Math.floor(n / 2) * 2) }
function evenRound(n) { return Math.max(2, Math.round(n / 2) * 2) }

function run(bin, args, { onStdout, onStderr, signalStore } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(bin, args, { windowsHide: true })
    } catch (e) {
      resolve({ code: -1, out: '', err: String(e) })
      return
    }
    if (signalStore) signalStore.child = child
    let out = ''
    let err = ''
    child.stdout.on('data', d => { const s = d.toString(); out += s; if (onStdout) onStdout(s) })
    child.stderr.on('data', d => { const s = d.toString(); err = (err + s).slice(-12000); if (onStderr) onStderr(s) })
    child.on('error', e => resolve({ code: -1, out, err: err + '\n' + String(e) }))
    child.on('close', code => {
      if (signalStore && signalStore.child === child) signalStore.child = null
      resolve({ code, out, err })
    })
  })
}

function killTree(child) {
  if (!child || child.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true })
    } else {
      child.kill('SIGKILL')
    }
  } catch (e) { /* süreç zaten kapanmış olabilir */ }
}

// Nazik iptal: önce 'q' ile ffmpeg'in dosyayı düzgün kapatmasına izin ver,
// cevap gelmezse süreç ağacını zorla öldür
function cancelChild(child) {
  if (!child || child.killed || child.exitCode !== null) return
  try { child.stdin.write('q') } catch (e) { /* stdin kapalı olabilir */ }
  const timer = setTimeout(() => killTree(child), 2500)
  child.once('exit', () => clearTimeout(timer))
}

// ---------------------------------------------------------------- metadata

async function probe(input) {
  if (!fs.existsSync(input)) throw new Error('enoent: dosya yok')
  const { code, out, err } = await run(ffprobePath, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input,
  ])
  if (code !== 0) throw new Error('probe_failed: ' + err)
  let data
  try { data = JSON.parse(out || '{}') } catch (e) { throw new Error('probe_failed: json') }
  const streams = data.streams || []
  const v = streams.find(s => s.codec_type === 'video' && (!s.disposition || s.disposition.attached_pic !== 1))
  if (!v || !v.width || !v.height) throw new Error('no_video_stream')
  const a = streams.find(s => s.codec_type === 'audio')

  let w = v.width
  let h = v.height

  // Telefon videolarındaki dönüş metadatası — ffmpeg decode'da otomatik düzeltir,
  // hesaplarımız görünen (döndürülmüş) boyutlarla yapılmalı
  let rotation = 0
  if (Array.isArray(v.side_data_list)) {
    const dm = v.side_data_list.find(s => typeof s.rotation === 'number')
    if (dm) rotation = Math.abs(Math.round(dm.rotation))
  }
  if (v.tags && v.tags.rotate) rotation = Math.abs(parseInt(v.tags.rotate, 10) || 0)
  if (rotation % 180 === 90) { const t = w; w = h; h = t }

  // SAR (pixel en-boy oranı) 1 değilse görünen genişliği düzelt
  let sarN = 1, sarD = 1
  if (v.sample_aspect_ratio && v.sample_aspect_ratio !== '0:1' && v.sample_aspect_ratio !== 'N/A') {
    const parts = v.sample_aspect_ratio.split(':').map(Number)
    if (parts[0] > 0 && parts[1] > 0) { sarN = parts[0]; sarD = parts[1] }
  }
  const sar = sarN / sarD
  const displayWidth = evenRound(w * sar)

  const duration = parseFloat((data.format && data.format.duration) || v.duration || 0) || 0

  let fps = 30
  let fpsRaw = '30'
  const rateStr = (v.avg_frame_rate && v.avg_frame_rate !== '0/0') ? v.avg_frame_rate : v.r_frame_rate
  if (rateStr) {
    const parts = rateStr.split('/').map(Number)
    const val = parts.length === 2 && parts[1] ? parts[0] / parts[1] : parts[0]
    if (val > 0 && val < 1000) { fps = val; fpsRaw = rateStr }
  }

  return {
    input,
    width: w,
    height: h,
    displayWidth,
    sar,
    rotation,
    duration,
    fps,
    fpsRaw,
    videoCodec: v.codec_name || '?',
    audioCodec: a ? (a.codec_name || '?') : null,
    hasAudio: !!a,
    sizeBytes: parseInt((data.format && data.format.size) || 0, 10) || 0,
    isVertical: h > w,
  }
}

// ---------------------------------------------------------------- filtreler

function fitInside(iw, ih, bw, bh) {
  const s = Math.min(bw / iw, bh / ih)
  return { w: evenRound(iw * s), h: evenRound(ih * s) }
}

// SAR != 1 ise kaynağı önce kare piksele çevir
function srcBase(meta) {
  if (Math.abs(meta.sar - 1) < 0.001) return { pre: '', label: '[0:v]' }
  return {
    pre: `[0:v]scale=${meta.displayWidth}:${meta.height}:flags=bicubic,setsar=1[srcv];`,
    label: '[srcv]',
  }
}

// Mod 1: Blur Dolgu — orijinal ortada TAM, üst/alt bulanık büyütülmüş kopya
function blurFilter(meta, o) {
  const iw = meta.displayWidth
  const ih = meta.height
  const fg = fitInside(iw, ih, OUT_W, OUT_H)
  const strength = clamp(o.blurStrength != null ? o.blurStrength : 55, 0, 100)
  // Arka plan çeyrek çözünürlükte bulanıklaştırılır (4x hız + daha yumuşak görünüm)
  const sigma = (2 + strength * 0.13).toFixed(1)
  const darken = clamp(o.bgDarken != null ? o.bgDarken : 35, 0, 80)
  const bright = (-(darken / 100) * 0.5).toFixed(2)
  const qw = OUT_W / 4
  const qh = OUT_H / 4
  const { pre, label } = srcBase(meta)
  return pre +
    `${label}split=2[bgs][fgs];` +
    `[bgs]scale=${qw}:${qh}:force_original_aspect_ratio=increase:flags=bilinear,` +
    `crop=${qw}:${qh},gblur=sigma=${sigma},` +
    `scale=${OUT_W}:${OUT_H}:flags=bicubic,eq=brightness=${bright}:saturation=1.06[bg];` +
    `[fgs]scale=${fg.w}:${fg.h}:flags=lanczos[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]`
}

// Mod 2: Akıllı Zoom — odak noktası kaydırılabilir dikey kırpma
function zoomFilter(meta, o) {
  const iw = meta.displayWidth
  const ih = meta.height
  const zoom = clamp(o.zoom != null ? o.zoom : 1, 1, 3)
  let cropH = evenFloor(ih / zoom)
  let cropW = evenFloor(cropH * OUT_W / OUT_H)
  if (cropW > iw) {
    cropW = evenFloor(iw)
    cropH = Math.min(evenFloor(ih), evenFloor(cropW * OUT_H / OUT_W))
  }
  const fx = clamp(o.focusX != null ? o.focusX : 0.5, 0, 1)
  const fy = clamp(o.focusY != null ? o.focusY : 0.5, 0, 1)
  const x = Math.max(0, Math.min(iw - cropW, Math.round((iw - cropW) * fx)))
  const y = Math.max(0, Math.min(ih - cropH, Math.round((ih - cropH) * fy)))
  const { pre, label } = srcBase(meta)
  return pre +
    `${label}crop=${cropW}:${cropH}:${x}:${y},` +
    `scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1,format=yuv420p[v]`
}

// Mod 3: Üst-Alt Düzen — video üstte, tema renkli alan + yazılar.
// Yazılar renderer'da canvas ile PNG'ye çizilir (önizlemeyle birebir + renkli
// emoji); PNG yoksa drawtext'e düşülür.
function panelFilter(meta, o, ctx) {
  const iw = meta.displayWidth
  const ih = meta.height
  const fg = fitInside(iw, ih, OUT_W, Math.floor(OUT_H * 0.72))
  const pos = clamp(o.videoPos != null ? o.videoPos : 0.3, 0, 1)
  const vy = Math.round((OUT_H - fg.h) * pos)
  const vx = Math.round((OUT_W - fg.w) / 2)
  const color = String(o.panelColor || '#1b1128').replace('#', '0x')
  const fpsR = meta.fpsRaw || '30'
  const { pre, label } = srcBase(meta)

  let chain =
    `color=c=${color}:s=${OUT_W}x${OUT_H}:r=${fpsR}[cbg];` + pre +
    `${label}scale=${fg.w}:${fg.h}:flags=lanczos[fg];` +
    `[cbg][fg]overlay=${vx}:${vy}:shortest=1`

  if (ctx.hasOverlayInput) {
    chain += `[base];[base][1:v]overlay=0:0`
  } else {
    // Yedek yol: canvas PNG'si yoksa yazıları drawtext ile bas
    const fontSize = clamp(o.fontSize != null ? o.fontSize : 76, 32, 160)
    const textColor = String(o.textColor || '#ffffff').replace('#', '0x')
    const texts = []
    if (o.topText && String(o.topText).trim()) {
      texts.push({ text: String(o.topText).trim(), yExpr: `(${Math.max(vy, fontSize + 40)}-th)/2` })
    }
    if (o.bottomText && String(o.bottomText).trim()) {
      const areaTop = vy + fg.h
      texts.push({ text: String(o.bottomText).trim(), yExpr: `${areaTop}+(${OUT_H - areaTop}-th)/2` })
    }
    if (texts.length) {
      const fontFile = findFontFile()
      if (!fontFile) throw new Error('font_missing')
      // ffmpeg filtre argümanları İKİ seviyede parse edilir: tırnak graf seviyesini,
      // \: ise opsiyon seviyesini korur — Windows yollarında ikisi birden şart
      const fesc = (p) => "'" + p.replace(/\\/g, '/').replace(/:/g, '\\:') + "'"
      for (const t of texts) {
        const txtFile = path.join(ctx.tmpDir, `text-${ctx.textCounter++}.txt`)
        fs.writeFileSync(txtFile, t.text, 'utf8')
        ctx.tmpFiles.push(txtFile)
        chain += `,drawtext=fontfile=${fesc(fontFile)}` +
          `:textfile=${fesc(txtFile)}` +
          `:fontcolor=${textColor}:fontsize=${fontSize}` +
          `:x=(w-text_w)/2:y=${t.yExpr}` +
          `:shadowcolor=black@0.45:shadowx=0:shadowy=4`
      }
    }
  }

  chain += `,setsar=1,format=yuv420p[v]`
  return chain
}

function findFontFile() {
  const cands = []
  if (process.resourcesPath) cands.push(path.join(process.resourcesPath, 'fonts', 'SweaxDisplay.ttf'))
  cands.push(path.join(__dirname, '..', 'build', 'fonts', 'SweaxDisplay.ttf'))
  const winFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
  cands.push(
    path.join(winFonts, 'seguibl.ttf'),   // Segoe UI Black
    path.join(winFonts, 'segoeuib.ttf'),  // Segoe UI Bold
    path.join(winFonts, 'arialbd.ttf'),
    path.join(winFonts, 'arial.ttf'),
  )
  for (const c of cands) {
    try { if (fs.existsSync(c)) return c } catch (e) { /* devam */ }
  }
  return null
}

// Renk filtresi ön-ayarları (önizlemedeki CSS karşılıklarıyla uyumlu)
const COLOR_FILTERS = {
  canli: 'eq=saturation=1.35:contrast=1.06',
  sinematik: 'eq=contrast=1.16:saturation=0.85:brightness=-0.02',
  sicak: 'eq=saturation=1.1,colortemperature=4600',
  soguk: 'eq=saturation=0.95,colortemperature=8500',
  siyahbeyaz: 'hue=s=0,eq=contrast=1.08',
}

function buildFilter(meta, options, ctx) {
  const mode = options.mode || 'blur'
  let chain
  if (mode === 'zoom') chain = zoomFilter(meta, options)
  else if (mode === 'panel') chain = panelFilter(meta, options, ctx)
  else chain = blurFilter(meta, options)

  // [v] etiketinden önce ek işlemler: renk filtresi + hız
  const extras = []
  if (options.colorFilter && COLOR_FILTERS[options.colorFilter]) {
    extras.push(COLOR_FILTERS[options.colorFilter])
  }
  const speed = clamp(options.speed != null ? options.speed : 1, 0.5, 2)
  if (Math.abs(speed - 1) > 0.001) {
    extras.push(`setpts=PTS/${speed}`)
  }
  if (extras.length) {
    chain = chain.replace(/\[v\]$/, ',' + extras.join(',') + '[v]')
  }
  return chain
}

// Ses zinciri: seviye ayarı + müzik miksi + hız. Hiçbiri gerekmiyorsa null döner
// (o durumda ses birebir kopyalanabilir).
function buildAudioGraph(meta, options, musicInputIndex) {
  const speed = clamp(options.speed != null ? options.speed : 1, 0.5, 2)
  const origVol = clamp(options.origVolume != null ? options.origVolume : 100, 0, 300) / 100
  const musicVol = clamp(options.musicVolume != null ? options.musicVolume : 60, 0, 300) / 100
  const hasMusic = musicInputIndex != null
  const speedChanged = Math.abs(speed - 1) > 0.001
  const volChanged = Math.abs(origVol - 1) > 0.001

  if (!hasMusic && !speedChanged && !volChanged) return null
  if (!meta.hasAudio && !hasMusic) return null

  const parts = []
  let mixed
  if (meta.hasAudio && hasMusic) {
    parts.push(`[0:a]volume=${origVol.toFixed(2)}[sw_a0]`)
    parts.push(`[${musicInputIndex}:a]volume=${musicVol.toFixed(2)}[sw_a1]`)
    parts.push(`[sw_a0][sw_a1]amix=inputs=2:duration=first:dropout_transition=3[sw_mix]`)
    mixed = '[sw_mix]'
  } else if (meta.hasAudio) {
    parts.push(`[0:a]volume=${origVol.toFixed(2)}[sw_mix]`)
    mixed = '[sw_mix]'
  } else {
    parts.push(`[${musicInputIndex}:a]volume=${musicVol.toFixed(2)}[sw_mix]`)
    mixed = '[sw_mix]'
  }
  if (speedChanged) {
    parts.push(`${mixed}atempo=${speed.toFixed(4)}[aout]`)
  } else {
    parts.push(`${mixed}anull[aout]`)
  }
  return parts.join(';')
}

// ---------------------------------------------------------------- kodlayıcı

// Araştırma bulgusu: -cq verip -b:v 0 yazılmazsa NVENC ~2 Mbps varsayılan
// tavanına kilitlenir ve çıktı bulanık olur. p7+multipass fullres = CRF 18 eşdeğeri.
function nvencArgs(q) {
  return [
    '-c:v', 'h264_nvenc',
    '-preset', 'p7',
    '-tune', 'hq',
    '-rc', 'vbr',
    '-cq', String(q + 1),
    '-b:v', '0',
    '-multipass', 'fullres',
    '-rc-lookahead', '32',
    '-spatial-aq', '1',
    '-temporal-aq', '1',
    '-profile:v', 'high',
  ]
}

function encoderArgs(useGpu, quality) {
  const q = clamp(quality || 18, 14, 30)
  if (useGpu) return nvencArgs(q)
  return [
    '-c:v', 'libx264',
    '-preset', q <= 18 ? 'slow' : 'medium',
    '-crf', String(q),
    '-profile:v', 'high',
  ]
}

function audioArgs(meta) {
  if (!meta.hasAudio) return []
  // mp4 konteyneriyle birebir uyumlu codec'lerde sesi hiç dokunmadan kopyala
  if (['aac', 'mp3'].includes(meta.audioCodec)) return ['-c:a', 'copy']
  return ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
}

let nvencCache = null
async function detectNvenc(force) {
  if (nvencCache !== null && !force) return nvencCache
  // Gerçek kullanacağımız argüman setiyle 1 karelik deneme kodlaması —
  // -encoders listesi sadece derleme desteğini gösterir, donanımı kanıtlamaz
  const { code } = await run(ffmpegPath, [
    '-hide_banner', '-v', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1:r=30',
    '-frames:v', '1', ...nvencArgs(18), '-f', 'null', '-',
  ])
  nvencCache = code === 0
  return nvencCache
}

// ---------------------------------------------------------------- ilerleme

function makeProgressParser(durationSec, cb) {
  let buf = ''
  let cur = {}
  return (chunk) => {
    buf += chunk
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const k = line.slice(0, eq)
      const val = line.slice(eq + 1).trim()
      cur[k] = val
      if (k === 'progress') {
        let t = 0
        // ffmpeg tuhaflığı: out_time_ms de mikrosaniye döner
        if (cur.out_time_us && cur.out_time_us !== 'N/A') t = parseInt(cur.out_time_us, 10) / 1e6
        else if (cur.out_time_ms && cur.out_time_ms !== 'N/A') t = parseInt(cur.out_time_ms, 10) / 1e6
        if (!(t >= 0)) t = 0
        const speed = parseFloat(String(cur.speed || '0').replace('x', '')) || 0
        const fps = parseFloat(cur.fps || '0') || 0
        const percent = durationSec > 0 ? Math.min(99.9, (t / durationSec) * 100) : 0
        const eta = (speed > 0 && durationSec > 0) ? Math.max(0, (durationSec - t) / speed) : null
        cb({ percent, fps, speed, eta, done: val === 'end' })
        cur = {}
      }
    }
  }
}

// ---------------------------------------------------------------- dönüştürme

async function convertOne(meta, options, output, onProgress, signalStore, useGpu) {
  const ctx = {
    tmpDir: os.tmpdir(),
    tmpFiles: [],
    textCounter: Date.now() % 100000,
  }
  // Önce geçici ada yaz, başarılıysa asıl ada taşı — yarım dosya asla "bitti" görünmez
  const tmpOut = path.join(path.dirname(output), `~sweaxtmp-${path.basename(output)}`)
  try {
    // Kesme (trim) hesapları
    const trim = options.trim || {}
    const tStart = Math.max(0, Number(trim.start) || 0)
    let tEnd = trim.end != null && Number(trim.end) > tStart ? Number(trim.end) : null
    if (tEnd != null && meta.duration > 0) tEnd = Math.min(tEnd, meta.duration)
    const effDur = Math.max(0.05, (tEnd != null ? tEnd : (meta.duration || 0)) - tStart)
    const speed = clamp(options.speed != null ? options.speed : 1, 0.5, 2)
    const outDur = effDur / speed

    // Girdiler: [0] video, [1] panel yazı PNG'si (varsa), [son] müzik (varsa)
    const inputArgs = []
    if (tStart > 0) inputArgs.push('-ss', String(tStart))
    inputArgs.push('-i', meta.input)
    let nextInput = 1
    if (options.mode === 'panel' && options.overlayPngPath && fs.existsSync(options.overlayPngPath)) {
      ctx.hasOverlayInput = true
      inputArgs.push('-i', options.overlayPngPath)
      nextInput = 2
    }
    let musicIndex = null
    if (options.musicPath && fs.existsSync(options.musicPath)) {
      // Müzik videodan kısaysa başa sarsın; çıktı süresi -t ile sınırlanır
      inputArgs.push('-stream_loop', '-1', '-i', options.musicPath)
      musicIndex = nextInput
    }

    const vFilter = buildFilter(meta, options, ctx)
    const aGraph = buildAudioGraph(meta, options, musicIndex)
    const filterAll = aGraph ? vFilter + ';' + aGraph : vFilter

    const maps = ['-map', '[v]']
    let audioOut = []
    if (aGraph) {
      maps.push('-map', '[aout]')
      audioOut = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
    } else if (meta.hasAudio) {
      maps.push('-map', '0:a?')
      audioOut = audioArgs(meta)
    }

    // Süre sınırı: kesme bitişi veya sonsuz müzik döngüsü varsa şart
    const durLimit = []
    if (tEnd != null || musicIndex != null) {
      if (meta.duration > 0) durLimit.push('-t', outDur.toFixed(3))
      else durLimit.push('-shortest')
    }

    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...inputArgs,
      '-filter_complex', filterAll,
      ...maps,
      ...durLimit,
      ...encoderArgs(useGpu, options.quality),
      ...audioOut,
      '-movflags', '+faststart',
      '-f', 'mp4',
      '-progress', 'pipe:1', '-nostats',
      tmpOut,
    ]
    const parser = makeProgressParser(meta.duration > 0 ? outDur : 0, onProgress || (() => {}))
    const { code, err } = await run(ffmpegPath, args, { onStdout: parser, signalStore })
    if (code !== 0) throw new Error('ffmpeg_failed(' + code + '): ' + err)
    if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size < 1024) throw new Error('output_empty')
    fs.renameSync(tmpOut, output)
    return output
  } finally {
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut) } catch (e) { /* kilitli olabilir */ }
    for (const f of ctx.tmpFiles) {
      try { fs.unlinkSync(f) } catch (e) { /* önemsiz */ }
    }
  }
}

// ---------------------------------------------------------------- yardımcılar

async function thumbnail(input, time) {
  const t = Math.max(0, Number(time) || 0)
  const out = path.join(os.tmpdir(), `sweaxcut-thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
  const attempt = async (seekTo) => run(ffmpegPath, [
    '-hide_banner', '-v', 'error',
    '-ss', String(seekTo), '-i', input,
    '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', '-y', out,
  ])
  let res = await attempt(t)
  if ((res.code !== 0 || !fs.existsSync(out)) && t > 0) res = await attempt(0)
  if (res.code !== 0 || !fs.existsSync(out)) throw new Error('thumb_failed: ' + res.err)
  const b64 = fs.readFileSync(out).toString('base64')
  try { fs.unlinkSync(out) } catch (e) { /* önemsiz */ }
  return 'data:image/jpeg;base64,' + b64
}

function defaultOutput(input, outDir) {
  const base = path.basename(input, path.extname(input))
  const dir = outDir && fs.existsSync(outDir) ? outDir : path.dirname(input)
  let name = `${base}_dikey.mp4`
  let i = 2
  while (fs.existsSync(path.join(dir, name))) {
    name = `${base}_dikey (${i}).mp4`
    i++
  }
  return path.join(dir, name)
}

function turkceHata(raw) {
  const s = String(raw || '').toLowerCase()
  if (s.includes('no_video_stream')) return 'Bu dosyada video akışı bulunamadı — ses dosyası ya da bozuk bir video olabilir.'
  if (s.includes('font_missing')) return 'Yazı eklemek için sistem yazı tipi bulunamadı.'
  if (s.includes('output_empty')) return 'Çıktı dosyası oluşturulamadı — hedef klasöre yazma izni olmayabilir.'
  if (s.includes('no space left') || s.includes('not enough space') || s.includes('disk full')) return 'Diskte yeterli boş alan yok.'
  if (s.includes('permission denied') || s.includes('eperm') || s.includes('eacces')) return 'Dosyaya erişilemiyor — başka bir programda açık olabilir.'
  if (s.includes('enoent') || s.includes('no such file')) return 'Dosya bulunamadı — taşınmış ya da silinmiş olabilir.'
  if (s.includes('invalid data') || s.includes('moov atom not found') || s.includes('probe_failed')) return 'Dosya okunamadı — bozuk ya da desteklenmeyen bir format olabilir.'
  if (s.includes('nvenc') || s.includes('cuda') || s.includes('cuvid')) return 'GPU kodlayıcıda sorun oluştu.'
  if (s.includes('cancelled')) return 'İşlem iptal edildi.'
  return 'Dönüştürme sırasında beklenmeyen bir hata oluştu.'
}

module.exports = {
  ffmpegPath,
  ffprobePath,
  OUT_W,
  OUT_H,
  VIDEO_EXTS,
  probe,
  detectNvenc,
  convertOne,
  thumbnail,
  defaultOutput,
  turkceHata,
  killTree,
  cancelChild,
  run,
}
