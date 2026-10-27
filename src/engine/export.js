// Dışa aktarma — projeyi son videoya / sese / GIF'e / tek kareye işler.
// Hat: klip başına ffmpeg kod çözücü (YUV420p boru) → WebGL bileşimci (önizlemeyle AYNI kod) →
//      GPU'da BT.709 YUV420p paketleme → readPixels → kodlayıcı ffmpeg stdin. Ses paralelde WAV'a işlenir, sonra birleştirilir.
//
// exportProject(project, opts, { onProgress, signal }) → Promise<{ path, frames, seconds, encoder, warnings, fps }>
// exportFrame(project, time, outPath, { scale }) → Promise<{ path, width, height }>
// estimateSize(opts, duration) → bayt
// defaultExportName(project, format?) → dosya adı
// getEncoders({ refresh }) → kodlayıcı yetenek raporu

import { Compositor } from './compositor.js'
import { projectDuration } from '../core/timeline.js'
import { fs, path, isElectron } from '../platform/node.js'
import { FORMATS, getEncoders, pickEncoder, cpuEncoder, videoArgs, audioArgs, coerceCodec, isAudioOnly, estimateVideoKbps } from './export/encoders.js'
import { spawnFF, runFF, killChild, AbortErr, makeTempDir, rmrf, unlinkQuiet, fileSize, tailErr, yieldTask } from './export/proc.js'
import { ExportSources } from './export/sources.js'
import { YuvPacker, ownTarget, freeTarget, installFrameUpload } from './export/gpu.js'
import { renderAudioWav } from './export/audio-mix.js'
import * as stickerRender from './sticker-render.js'

// yazı tipi paketi yoksa derleme kırılmasın
const fontMods = import.meta.glob('../packs/fonts/index.js')

// İlk kareden önce varlıkları hazırla: proje yazı tipleri + çıkartma resimleri (yoksa yedek yazı tipiyle çizilir / atlanır)
async function ensureAssets(project, warn) {
  const jobs = []
  const f = fontMods['../packs/fonts/index.js']
  if (f) jobs.push(f().then(m => m && typeof m.ensureProjectFonts === 'function' ? m.ensureProjectFonts(project) : null))
  if (typeof stickerRender.preloadStickerImages === 'function') jobs.push(Promise.resolve().then(() => stickerRender.preloadStickerImages(project)))
  const all = Promise.all(jobs.map(j => j.catch(e => warn && warn('Varlık hazırlanamadı: ' + String(e && e.message || e).slice(0, 120)))))
  await Promise.race([all, sleep(15000).then(() => warn && warn('Yazı tipi / çıkartma yüklemesi zaman aşımına uğradı'))])
}

export { getEncoders, FORMATS }

const RES_SHORT = { '480p': 480, '720p': 720, '1080p': 1080, '1440p': 1440, '2k': 1440, '4k': 2160, '2160p': 2160 }
const LOOKAHEAD = 0.6      // sn — yaklaşan kliplerin kod çözücüsünü önceden başlat
const RING = 4             // kodlayıcıya yazılan kare tamponu sayısı

const even = x => Math.max(2, Math.round(x / 2) * 2)
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Çıkış boyutu: kısa kenar = çözünürlük, en-boy projeden
export function exportSize(project, resolution = 'auto', { maxShort = 0 } = {}) {
  const pw = project.settings.width, ph = project.settings.height
  let short = RES_SHORT[String(resolution).toLowerCase()] || 0
  const pShort = Math.min(pw, ph)
  if (!short) short = pShort
  if (maxShort) short = Math.min(short, maxShort)
  let w, h
  if (pw <= ph) { w = short; h = short * ph / pw } else { h = short; w = short * pw / ph }
  return { width: even(w), height: even(h) }
}

function normalizeOpts(project, opts) {
  const format = FORMATS[opts.format] ? opts.format : 'mp4'
  const F = FORMATS[format]
  const warnings = []
  let codec = coerceCodec(format, opts.codec || (format === 'webm' ? 'vp9' : 'h264'))
  if (F.video && opts.codec && codec !== opts.codec && format !== 'gif') warnings.push(`${F.label} kabı ${opts.codec} desteklemiyor, ${codec} kullanıldı`)
  let fps = +opts.fps || project.settings.fps || 30
  fps = Math.max(1, Math.min(120, fps))
  if (format === 'gif') fps = Math.min(30, opts.fps ? fps : 15)
  const size = exportSize(project, opts.resolution || 'auto', { maxShort: format === 'gif' ? 720 : 0 })
  const dur = projectDuration(project)
  let start = Math.max(0, Math.min(dur, +(opts.range && opts.range.start) || 0))
  let end = opts.range && opts.range.end != null ? Math.min(dur, +opts.range.end) : dur
  if (!(end > start)) end = dur
  if (end - start < 1 / fps / 2) throw new Error('Dışa aktarılacak bir şey yok (zaman çizelgesi boş)')
  const total = Math.max(1, Math.ceil((end - start) * fps - 1e-3))
  let out = opts.path
  if (!out) throw new Error('Kayıt yolu belirtilmedi')
  if (!path.extname(out)) out += F.ext
  return {
    format, F, codec, fps, ...size, start, end, total, seconds: total / fps,
    quality: opts.quality || 'orta', bitrateKbps: +opts.bitrateKbps || 0, hw: opts.hw || 'auto',
    audioBitrate: +opts.audioBitrate || 0, includeAudio: opts.includeAudio !== false && !!F.audio,
    path: out, warnings, pbo: opts.pbo !== false,
  }
}

function fpsArg(fps) {
  const std = { 23.976: '24000/1001', 29.97: '30000/1001', 59.94: '60000/1001' }
  return std[fps] || String(fps)
}

// İlerleme bildirimi: kare hızı (kayan pencere), kalan süre
function progressor(onProgress, total) {
  const marks = []
  let last = 0
  return (stage, frame = 0, force = false) => {
    if (!onProgress) return
    const now = performance.now()
    marks.push([now, frame])
    while (marks.length > 2 && now - marks[0][0] > 1500) marks.shift()
    if (!force && now - last < 100 && frame < total) return
    last = now
    const [t0, f0] = marks[0]
    const fps = now > t0 ? ((frame - f0) * 1000) / (now - t0) : 0
    const eta = fps > 0 ? (total - frame) / fps : null
    try { onProgress({ stage, frame, total, fps: Math.round(fps * 10) / 10, eta: eta == null ? null : Math.round(eta * 10) / 10 }) } catch (e) { /* */ }
  }
}

// ------------------------------------------------------------------ video işleme
// out: video dosyası; inputPix: 'yuv420p' (GPU paketleme) | 'rgba'
async function renderVideo(project, o, enc, outFile, { muxer, extraOut = [], inputPix, signal, warn, report, codecArgs }) {
  const canvas = document.createElement('canvas')
  canvas.width = 16; canvas.height = 16
  const comp = new Compositor(canvas, { preserve: false })
  const glw = comp.glw
  installFrameUpload(glw)
  const scale = o.width / project.settings.width
  const target = ownTarget(glw, o.width, o.height)
  const packer = inputPix === 'yuv420p' ? new YuvPacker(glw, o.width, o.height, { pbo: o.pbo }) : null
  const frameBytes = packer ? packer.bytes : o.width * o.height * 4
  const readBytes = packer ? packer.readBytes : frameBytes
  const sources = new ExportSources(project, { width: o.width, height: o.height, fps: o.fps, warn })
  let encProc = null
  const ring = Array.from({ length: RING }, () => ({ buf: Buffer.allocUnsafeSlow(readBytes), busy: null }))
  const timing = { load: 0, render: 0, read: 0, write: 0 }
  let encErr = null
  let onAbort = null
  try {
    await Promise.all([sources.prepare(o.start, o.end), ensureAssets(project, warn)])
    const args = ['-hide_banner', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', inputPix, '-s', `${o.width}x${o.height}`,
      '-framerate', fpsArg(o.fps), '-i', 'pipe:0', ...(codecArgs || videoArgs(enc, o.codec, { quality: o.quality, bitrateKbps: o.bitrateKbps, fps: o.fps, inputPix })),
      '-an', ...extraOut, '-f', muxer, outFile]
    encProc = spawnFF(args, { stdin: true })
    // iptal: bekleyen kod çözücüleri ve kodlayıcıyı hemen kapat (döngü bir sonraki adımda AbortError atar)
    onAbort = () => { sources.close(); killChild(encProc) }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    encProc.done.then(code => { if (code !== 0) encErr = new Error(tailErr(encProc.errTail) || ('kod ' + code)) })
    const write = (data) => {
      const p = new Promise((resolve, reject) => {
        try { encProc.stdin.write(data, err => err ? reject(err) : resolve()) } catch (e) { reject(e) }
      })
      p.catch(() => {})   // iptalde sahipsiz red kalmasın (sonra yine beklenir)
      return p
    }
    // PBO hattı: kare i okunurken kare i+1 işlenir
    const pending = []   // { slot, i }
    const flushOne = async () => {
      const p = pending.shift()
      const slot = ring[p.i % RING]
      const t0 = performance.now()
      await packer.finish(p.pbo, slot.buf, yieldTask)
      timing.read += performance.now() - t0
      slot.busy = write(slot.buf.subarray(0, frameBytes))
    }
    const timeOf = j => o.start + j / o.fps
    const lookN = Math.max(2, Math.round(LOOKAHEAD * o.fps))
    for (let i = 0; i < o.total; i++) {
      if (signal && signal.aborted) throw new AbortErr()
      if (encErr) throw encErr
      const t = o.start + i / o.fps
      let t0 = performance.now()
      await sources.load(t)
      sources.warm(i, timeOf, lookN)
      let t1 = performance.now(); timing.load += t1 - t0
      comp.render({ project, time: t, sources: sources.api, scale, target, flip: !packer })
      const slot = ring[i % RING]
      if (slot.busy) { const tw = performance.now(); await slot.busy; timing.write += performance.now() - tw }
      t0 = performance.now(); timing.render += t0 - t1
      if (packer) {
        packer.pack(target)
        if (packer.pbos) {
          packer.kick(i % 3)
          pending.push({ i, pbo: i % 3 })
          if (pending.length >= 2) await flushOne()
        } else {
          packer.read(slot.buf)
          slot.busy = write(slot.buf.subarray(0, frameBytes))
        }
      } else {
        comp.readPixels(target, slot.buf)
        slot.busy = write(slot.buf)
      }
      timing.read += performance.now() - t0
      sources.sweep(timeOf(i + lookN))
      report(i + 1)
    }
    while (pending.length) await flushOne()
    for (const s of ring) if (s.busy) await s.busy
    encProc.stdin.end()
    const code = await encProc.done
    if (code !== 0) throw (encErr || new Error('kodlayıcı kod ' + code))
    return { timing, decoders: sources.stats() }
  } catch (e) {
    // Windows'ta açık dosya silinemez: süreç kapanana kadar bekle (en çok 2 sn)
    if (encProc) { killChild(encProc); await Promise.race([encProc.done, sleep(2000)]) }
    if ((e && e.name === 'AbortError') || (signal && signal.aborted)) throw new AbortErr()
    // yalnız kodlayıcı süreci düştüyse (ya da boru kırıldıysa) işlemciyle yeniden denenir
    const isEnc = !!encErr || (encProc && encProc.exitCode != null && encProc.exitCode !== 0) || /EPIPE|EOF|destroyed|write after/i.test(String((e && (e.code || e.message)) || ''))
    const err = new Error((isEnc ? 'Kodlayıcı hatası (' + enc.name + '): ' : 'Görüntü işlenemedi: ') + String((encErr && encErr.message) || (e && e.message) || e).slice(0, 400))
    err.encoderFailed = isEnc
    err.cause = e
    throw err
  } finally {
    if (signal && onAbort) signal.removeEventListener('abort', onAbort)
    sources.close()
    if (packer) packer.dispose()
    freeTarget(glw, target)
    try { glw.__exportUpload && glw.__exportUpload.restore() } catch (e) { /* */ }
    comp.dispose()
  }
}

// ------------------------------------------------------------------ ana giriş
export async function exportProject(project, opts = {}, { onProgress, signal } = {}) {
  if (!isElectron) throw new Error('Dışa aktarma yalnız masaüstü uygulamasında çalışır')
  const T0 = performance.now()
  const o = normalizeOpts(project, opts)
  const warnings = [...o.warnings]
  const warn = (m) => { if (!warnings.includes(m)) { warnings.push(m); console.warn('[dışa aktar]', m) } }
  const report = progressor(onProgress, o.total)
  const tmpDir = makeTempDir('disa')
  const finalTmp = o.path + '.sweaxtmp'
  const fmt = o.F
  let encoderName = null
  let timing = null, decoders = null
  let audioP = null
  try {
    fs.mkdirSync(path.dirname(o.path), { recursive: true })
    unlinkQuiet(finalTmp)
    report('hazirlik', 0, true)
    // ---- yalnız ses
    if (isAudioOnly(o.format)) {
      report('ses', 0, true)
      const wav = path.join(tmpDir, 'mix.wav')
      await renderAudioWav(project, { start: o.start, duration: o.seconds }, wav, { signal, warn })
      report('birlestirme', o.total, true)
      const r = await runFF(['-hide_banner', '-v', 'error', '-y', '-i', wav, ...audioArgs(fmt.audio, { audioBitrate: o.audioBitrate, quality: o.quality }),
        ...(o.format === 'm4a' ? ['-movflags', '+faststart'] : []), '-f', fmt.muxer, finalTmp], { signal })
      if (r.code !== 0) throw new Error('Ses kodlanamadı: ' + tailErr(r.err))
      encoderName = audioArgs(fmt.audio)[1]
    } else {
      const caps = await getEncoders()
      // ses paralelde
      const wav = path.join(tmpDir, 'mix.wav')
      if (o.includeAudio) {
        audioP = renderAudioWav(project, { start: o.start, duration: o.seconds }, wav, { signal, warn })
        audioP.catch(() => {})
      }
      const isGif = o.format === 'gif'
      const vidExt = isGif ? '.avi' : fmt.ext
      const vidFile = (audioP || isGif) ? path.join(tmpDir, 'video' + vidExt) : finalTmp
      const directFinal = vidFile === finalTmp
      let enc = isGif ? { name: 'utvideo', hw: 'cpu' } : pickEncoder(o.codec, o.hw, caps, o)
      const inputPix = (isGif || o.codec === 'prores') ? 'rgba' : 'yuv420p'
      const extraOut = (directFinal && fmt.faststart) ? ['-movflags', '+faststart'] : []
      const codecArgs = isGif ? ['-c:v', 'utvideo', '-pix_fmt', 'gbrp'] : null
      const muxer = isGif ? 'avi' : fmt.muxer
      const runOnce = (e) => renderVideo(project, o, e, vidFile, { muxer, extraOut, inputPix, signal, warn, report: (f) => report('goruntu', f), codecArgs })
      try {
        ({ timing, decoders } = await runOnce(enc))
      } catch (e) {
        if (!e.encoderFailed || enc.hw === 'cpu' || (signal && signal.aborted)) throw e
        warn(`${enc.name} başarısız oldu, işlemci kodlayıcısıyla yeniden deneniyor`)
        console.warn(e.cause || e)
        enc = cpuEncoder(o.codec, caps)
        unlinkQuiet(vidFile)
        ;({ timing, decoders } = await runOnce(enc))
      }
      encoderName = enc.name
      if (isGif) {
        report('birlestirme', o.total, true)
        const pal = path.join(tmpDir, 'palet.png')
        const qi = ['dusuk', 'orta', 'yuksek', 'maksimum'].indexOf(o.quality)
        const colors = qi === 0 ? 128 : 256
        const dither = qi === 0 ? 'bayer:bayer_scale=3' : qi >= 2 ? 'floyd_steinberg' : 'sierra2_4a'
        let r = await runFF(['-hide_banner', '-v', 'error', '-y', '-i', vidFile, '-vf', `palettegen=max_colors=${colors}:stats_mode=diff`, pal], { signal })
        if (r.code !== 0) throw new Error('GIF paleti üretilemedi: ' + tailErr(r.err))
        r = await runFF(['-hide_banner', '-v', 'error', '-y', '-i', vidFile, '-i', pal, '-lavfi', `[0:v][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`,
          '-loop', '0', '-f', 'gif', finalTmp], { signal })
        if (r.code !== 0) throw new Error('GIF kodlanamadı: ' + tailErr(r.err))
        encoderName = 'gif (palettegen/paletteuse)'
      } else if (audioP) {
        report('ses', o.total, true)
        let audioOk = true
        try { await audioP } catch (e) {
          if (e && e.name === 'AbortError') throw e
          audioOk = false
          warn('Ses üretilemedi, video sessiz kaydedildi: ' + String(e && e.message || e).slice(0, 160))
        }
        report('birlestirme', o.total, true)
        const tag = (o.codec === 'hevc' && (o.format === 'mp4' || o.format === 'mov')) ? ['-tag:v', 'hvc1'] : []
        const aIn = audioOk ? ['-i', wav, '-map', '0:v:0', '-map', '1:a:0', ...audioArgs(fmt.audio, { audioBitrate: o.audioBitrate, quality: o.quality === 'dusuk' ? 'orta' : o.quality })] : ['-map', '0:v:0']
        const r = await runFF(['-hide_banner', '-v', 'error', '-y', '-i', vidFile, ...aIn, '-c:v', 'copy', ...tag,
          '-t', o.seconds.toFixed(6), ...(fmt.faststart ? ['-movflags', '+faststart'] : []), '-f', fmt.muxer, finalTmp], { signal })
        if (r.code !== 0) throw new Error('Ses ve görüntü birleştirilemedi: ' + tailErr(r.err))
      }
    }
    if (signal && signal.aborted) throw new AbortErr()
    if (fileSize(finalTmp) <= 0) throw new Error('Çıktı dosyası oluşmadı')
    try {
      fs.renameSync(finalTmp, o.path)
    } catch (e) {
      throw new Error(`Dosya yazılamadı (hedef başka bir programda açık olabilir): ${o.path}`)
    }
    report('birlestirme', o.total, true)
    const elapsed = (performance.now() - T0) / 1000
    return {
      path: o.path, frames: o.total, seconds: o.seconds, encoder: encoderName, warnings,
      width: o.width, height: o.height, fps: o.fps, elapsed: Math.round(elapsed * 100) / 100,
      renderFps: Math.round((o.total / elapsed) * 10) / 10, size: fileSize(o.path), timing, decoders,
    }
  } catch (e) {
    unlinkQuiet(finalTmp)
    if (signal && signal.aborted) throw new AbortErr()
    throw e
  } finally {
    // paralel ses işi bitmeden klasör silinemez
    if (audioP) await Promise.race([audioP.catch(() => {}), sleep(4000)])
    rmrf(tmpDir)
    if (fs.existsSync(tmpDir)) { await sleep(500); rmrf(tmpDir) }
  }
}

// ------------------------------------------------------------------ tek kare (PNG)
export async function exportFrame(project, time, outPath, { scale = 1 } = {}) {
  const W = even(project.settings.width * scale), H = even(project.settings.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = 16; canvas.height = 16
  const comp = new Compositor(canvas, { preserve: false })
  const glw = comp.glw
  installFrameUpload(glw)
  const target = ownTarget(glw, W, H)
  const warnings = []
  const sources = new ExportSources(project, { width: W, height: H, fps: project.settings.fps || 30, still: true, warn: m => warnings.push(m) })
  try {
    await Promise.all([sources.prepare(time, time + 0.001), ensureAssets(project, m => warnings.push(m))])
    await sources.load(time)
    comp.render({ project, time, sources: sources.api, scale: W / project.settings.width, target, flip: true })
    const px = new Uint8Array(W * H * 4)
    comp.readPixels(target, px)
    const c2 = document.createElement('canvas')
    c2.width = W; c2.height = H
    const ctx = c2.getContext('2d')
    ctx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer), W, H), 0, 0)
    const blob = await new Promise(r => c2.toBlob(r, 'image/png'))
    const buf = Buffer.from(await blob.arrayBuffer())
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
    }
    return { path: outPath, width: W, height: H, warnings, png: outPath ? null : buf }
  } finally {
    sources.close()
    freeTarget(glw, target)
    try { glw.__exportUpload && glw.__exportUpload.restore() } catch (e) { /* */ }
    comp.dispose()
  }
}

// ------------------------------------------------------------------ yardımcılar
// Tahmini dosya boyutu (bayt). opts.project ya da opts.width/height verilirse çözünürlük ondan.
export function estimateSize(opts = {}, duration = 0) {
  const format = FORMATS[opts.format] ? opts.format : 'mp4'
  const F = FORMATS[format]
  let w = opts.width, h = opts.height
  if (!w && opts.project) ({ width: w, height: h } = exportSize(opts.project, opts.resolution || 'auto', { maxShort: format === 'gif' ? 720 : 0 }))
  if (!w) {
    const short = RES_SHORT[opts.resolution] || 1080
    w = short; h = Math.round(short * 16 / 9)
  }
  const fps = format === 'gif' ? Math.min(30, +opts.fps || 15) : (+opts.fps || 30)
  let kbps = 0
  if (format === 'gif') {
    // GIF: kare başına ~0.25 bayt/piksel (oyun görüntüsü), fark kipinde
    return Math.round(w * h * fps * duration * 0.12)
  }
  if (F.video) kbps += estimateVideoKbps({ codec: coerceCodec(format, opts.codec || 'h264'), quality: opts.quality, bitrateKbps: opts.bitrateKbps, width: w, height: h, fps })
  if (F.audio && opts.includeAudio !== false) {
    const q = Math.max(0, ['dusuk', 'orta', 'yuksek', 'maksimum'].indexOf(opts.quality || 'orta'))
    if (F.audio === 'wav') kbps += 48 * 2 * (q >= 2 ? 24 : 16)
    else kbps += +opts.audioBitrate || (F.audio === 'opus' ? [96, 128, 160, 256] : [128, 192, 256, 320])[q]
  }
  return Math.round((kbps * 1000 / 8) * duration * 1.02)
}

export function defaultExportName(project, format = 'mp4') {
  const F = FORMATS[format] || FORMATS.mp4
  const base = String((project && project.name) || 'SWEAXCUT').replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'SWEAXCUT'
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${base} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}${F.ext}`
}
