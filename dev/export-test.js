// Dışa aktarma testleri (Electron + WebGL + ffmpeg). Seçim: ?t=dec,a,b,b2,c,d,e,cancel,enc
import * as model from '../src/core/model.js'
import { durationFromSource } from '../src/core/time.js'
import { probe, mediaKey } from '../src/core/media.js'
import { fs, path, run, appPaths, fileUrl } from '../src/platform/node.js'
import { exportProject, exportFrame, estimateSize, defaultExportName, getEncoders } from '../src/engine/export.js'
import { ClipDecoder } from '../src/engine/export/decoder.js'
import { videoInfo } from '../src/engine/export/sources.js'

const ROOT = process.cwd()
const TV = path.join(ROOT, 'test-videos')
const OUT = path.join(TV, 'out', 'export')
fs.mkdirSync(OUT, { recursive: true })
const FF = appPaths().ffmpeg
const FP = appPaths().ffprobe
const sel = (new URLSearchParams(location.search).get('t') || 'enc,dec,a,b,c,d,e').split(',')
const logEl = document.getElementById('log')
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); logEl.textContent += s + '\n' }
const R = { errors: [] }

function shot(file, cap) {
  const f = document.createElement('figure')
  f.innerHTML = `<img src="${fileUrl(file)}?${Date.now()}"><figcaption>${cap}</figcaption>`
  document.getElementById('shots').appendChild(f)
}

// medya öğesi (media.js işleme hattını taklit: sesi 48k stereo flac'a çıkar → media.audioPath)
async function media(file, id, { prepAudio = true } = {}) {
  const p = path.join(TV, file)
  const info = await probe(p)
  let audioPath = null
  if (info.hasAudio && prepAudio) {
    audioPath = path.join(OUT, 'ses_' + id + '_' + mediaKey(p) + '.flac')
    if (!fs.existsSync(audioPath)) await run(FF, ['-y', '-v', 'error', '-i', p, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'flac', '-compression_level', '0', audioPath])
  }
  return { id, path: p, name: file, key: mediaKey(p), ...info, status: 'ready', audioPath, proxyPath: null }
}

async function loudness(file) {
  const r = await run(FF, ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'])
  const m = /mean_volume: ([-\d.]+)/.exec(r.err || ''), x = /max_volume: ([-\d.]+)/.exec(r.err || '')
  return { mean: m && +m[1], max: x && +x[1] }
}

async function ffprobeOut(file) {
  const r = await run(FP, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  const j = JSON.parse(r.out || '{}')
  const v = (j.streams || []).find(s => s.codec_type === 'video')
  const a = (j.streams || []).find(s => s.codec_type === 'audio')
  return {
    duration: +(j.format && j.format.duration), size: +(j.format && j.format.size),
    video: v ? { codec: v.codec_name, w: v.width, h: v.height, fps: v.r_frame_rate, avg: v.avg_frame_rate, frames: +v.nb_frames || null, pix: v.pix_fmt, cs: v.color_space, prim: v.color_primaries, trc: v.color_transfer, range: v.color_range } : null,
    audio: a ? { codec: a.codec_name, sr: +a.sample_rate, ch: a.channels, dur: +a.duration, br: +a.bit_rate } : null,
  }
}

// çıktıdan i. kareyi çıkar ve exportFrame ile karşılaştır (PSNR)
async function compareFrame(project, outFile, i, fps, tag, scale) {
  const t = i / fps
  const ext = path.join(OUT, `${tag}_cikti_${i}.png`)
  const ref = path.join(OUT, `${tag}_kare_${i}.png`)
  await run(FF, ['-v', 'error', '-y', '-ss', ((i - 0.25) / fps).toFixed(6), '-i', outFile, '-frames:v', '1', ext])
  const fr = await exportFrame(project, t, ref, { scale })
  const r = await run(FF, ['-hide_banner', '-i', ext, '-i', ref, '-lavfi', '[0:v]scale=' + fr.width + ':' + fr.height + ':flags=area,format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr', '-f', 'null', '-'])
  const m = /average:([\d.inf]+)/.exec(r.err || '')
  shot(ext, `${tag} çıktı kare ${i}`); shot(ref, `${tag} exportFrame ${i}`)
  return { i, t: +t.toFixed(3), psnr: m ? m[1] : null, ext, ref, warn: fr.warnings }
}

function progressLog(tag) {
  let last = ''
  return (p) => {
    const s = `${p.stage}`
    if (s !== last || p.frame % 60 === 0) { last = s; log(`  [${tag}] ${p.stage} ${p.frame}/${p.total} ${p.fps} fps eta ${p.eta}`) }
  }
}

async function doExport(tag, project, opts) {
  const t0 = performance.now()
  const res = await exportProject(project, opts, { onProgress: progressLog(tag) })
  const dt = (performance.now() - t0) / 1000
  const pr = await ffprobeOut(res.path)
  if (pr.audio) pr.audio.loudness = await loudness(res.path)
  const o = { file: path.basename(res.path), encoder: res.encoder, frames: res.frames, seconds: res.seconds, elapsed: +dt.toFixed(2), exportFps: +(res.frames / dt).toFixed(1), size: res.size, warnings: res.warnings, probe: pr, timing: res.timing && Object.fromEntries(Object.entries(res.timing).map(([k, v]) => [k, +(v / res.frames).toFixed(2)])), decoders: res.decoders }
  log(`${tag}:`, o)
  return { res, o }
}

// ------------------------------------------------------------ projeler
async function projectA(prepAudio = true) {
  const p = model.createProject({ ratio: '9:16', fps: 30, name: 'Test A — çılgın şölen' })
  p.media.v1 = await media('oyun kaydı çılgın şölen.mp4', 'v1', { prepAudio })
  p.media.v2 = await media('ultrawide.mov', 'v2', { prepAudio })
  p.media.mu = await media('muzik.mp3', 'mu', { prepAudio })
  const c1 = model.createMediaClip(p.media.v1, { start: 0 })
  c1.transition = { id: 'fade', duration: 1 }
  const c2 = model.createMediaClip(p.media.v2, { start: c1.duration })
  p.tracks[0].clips = [c1, c2]
  const t = model.createTextClip({ start: 1, duration: 10, text: { content: 'ÇILGIN ŞÖLEN', size: 130, color: '#E4FF3A' } })
  t.transform.y = -0.3
  p.tracks.unshift(model.createTrack('text', { clips: [t] }))
  const a = model.createAudioClip(p.media.mu, { start: 2 })
  a.audio = { ...a.audio, volume: 0.7, fadeIn: 0.4, fadeOut: 0.6 }
  p.tracks.push(model.createTrack('audio', { clips: [a] }))
  return p
}

async function projectB(withRev) {
  const p = model.createProject({ ratio: '16:9', fps: 60, name: 'Test B hız+ters' })
  p.media.v1 = await media('oyun kaydı çılgın şölen.mp4', 'v1')
  p.media.v3 = await media('klip_opus.mkv', 'v3')
  if (withRev) p.media.v3.reversedPath = withRev
  const c1 = model.createMediaClip(p.media.v1, { start: 0, speed: 2 })
  c1.duration = durationFromSource(c1)
  const c2 = model.createMediaClip(p.media.v3, { start: c1.duration, reverse: true })
  p.tracks[0].clips = [c1, c2]
  return p
}

// kare dizini kodlanmış test videosu (10 bit, 32 px bloklar)
async function numbered() {
  const f = path.join(OUT, 'numarali_60.mp4')
  if (!fs.existsSync(f)) {
    const r = await run(FF, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x64:r=60:d=10', '-vf',
      "format=yuv420p,geq=lum='if(gte(mod(floor(N/pow(2,floor(X/32))),2),1),235,16)':cb=128:cr=128", '-c:v', 'libx264', '-crf', '8', '-g', '120', '-bf', '3', '-pix_fmt', 'yuv420p', f])
    if (r.code) throw new Error('numaralı video: ' + r.err)
  }
  return f
}

function readIdx(view) {
  const { data, width } = view.src
  const y = 32
  let v = 0
  for (let b = 0; b < 10; b++) {
    const x = 16 + b * 32
    if (view.src.planes) { if (data[y * width + x] > 125) v |= 1 << b }
    else if (data[(y * width + x) * 4] > 125) v |= 1 << b
  }
  return v
}

async function decoderTest() {
  const f = await numbered()
  const info = await videoInfo(f)
  const mk = (o) => new ClipDecoder({ file: f, F: info.F, Fstr: info.Fstr, w: 320, h: 64, mode: 'yuv', matrix: 'bt709', range: 'tv', maxIdx: info.frames - 1, label: 'num', warn: m => log('  uyarı', m), chunk: 60, ...o })
  const out = {}
  const check = async (d, ks, name) => {
    const bad = []
    for (const k of ks) {
      const v = await d.frameAt(k)
      const got = v ? readIdx(v) : -1
      const want = d.m > 1 ? (d.reverse ? k : k) : Math.min(k, info.frames - 1)
      if (got !== want) bad.push([k, got])
    }
    out[name] = { n: ks.length, bad: bad.slice(0, 8), badCount: bad.length, restarts: d.restarts }
    d.close()
  }
  const rng = (a, b, s = 1) => { const r = []; for (let k = a; s > 0 ? k <= b : k >= b; k += s) r.push(k); return r }
  await check(mk({}), [...rng(0, 40), ...rng(200, 230), ...rng(50, 60), 500, 501, 502, 599, 600, 650], 'ileri+sıçrama+geri')
  await check(mk({ m: 2 }), rng(100, 300, 2), 'seyreltme m=2')
  await check(mk({ m: 3 }), rng(7, 400, 3), 'seyreltme m=3')
  await check(mk({ reverse: true }), rng(300, 150, -1), 'ters parça')
  await check(mk({ reverse: true, m: 2 }), rng(598, 400, -2), 'ters parça m=2')
  await check(mk({ still: true }), [333], 'tek kare')
  const dRgba = mk({ mode: 'rgba', colorFilter: 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgba' })
  await check(dRgba, rng(10, 30), 'rgba')
  log('kod çözücü:', out)
  R.decoder = out
  R.numberedInfo = info
}

// ------------------------------------------------------------ çalıştır
try {
  if (sel.includes('enc')) {
    const t0 = performance.now()
    const caps = await getEncoders()
    R.encoders = { ms: Math.round(performance.now() - t0), best: caps.best, hw: caps.hw, cpu: caps.cpu, list: caps.list.map(x => x.id) }
    log('kodlayıcılar:', R.encoders)
  }
  if (sel.includes('dec')) await decoderTest()

  if (sel.includes('a')) {
    const p = await projectA()
    R.estimateA = estimateSize({ format: 'mp4', resolution: '1080p', fps: 30, quality: 'orta', project: p }, 13)
    R.nameA = defaultExportName(p, 'mp4')
    const { res, o } = await doExport('a', p, { path: path.join(OUT, 'a dikey çılgın şölen.mp4'), format: 'mp4', resolution: '1080p', fps: 30, quality: 'orta', codec: 'h264', hw: 'auto' })
    o.compare = []
    for (const i of [45, 120, 236, 240, 255, 300, 389]) o.compare.push(await compareFrame(p, res.path, i, 30, 'a', 1))
    R.a = o
  }
  if (sel.includes('b')) {
    const p = await projectB(null)
    const { res, o } = await doExport('b', p, { path: path.join(OUT, 'b_hiz_ters.mp4'), format: 'mp4', resolution: '1080p', fps: 60, quality: 'orta', codec: 'h264' })
    o.compare = []
    for (const i of [30, 200, 239, 240, 300, 500, 599]) o.compare.push(await compareFrame(p, res.path, i, 60, 'b', 0.5))
    R.b = o
  }
  if (sel.includes('b2')) {
    // ters kopya ile (media.js ensureReversed ile aynı komut)
    const src = path.join(TV, 'klip_opus.mkv')
    const rev = path.join(OUT, 'klip_opus_reversed.mp4')
    if (!fs.existsSync(rev)) await run(FF, ['-y', '-v', 'error', '-i', src, '-vf', 'reverse,format=yuv420p', '-af', 'areverse', '-c:a', 'aac', '-b:a', '192k', '-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '19', '-b:v', '0', '-g', '15', rev])
    const p = await projectB(rev)
    const { res, o } = await doExport('b2', p, { path: path.join(OUT, 'b2_ters_kopya.mp4'), format: 'mp4', resolution: '1080p', fps: 60, quality: 'orta', codec: 'h264' })
    o.compare = []
    for (const i of [300, 500]) o.compare.push(await compareFrame(p, res.path, i, 60, 'b2', 0.5))
    // ters kopya ile parça-ters aynı kareyi mi veriyor?
    const bfile = path.join(OUT, 'b_hiz_ters.mp4')
    if (fs.existsSync(bfile)) {
      o.vsChunked = []
      for (const i of [260, 400, 590]) {
        const x1 = path.join(OUT, `b2v_${i}.png`), x2 = path.join(OUT, `bv_${i}.png`)
        await run(FF, ['-v', 'error', '-y', '-ss', ((i - 0.25) / 60).toFixed(5), '-i', res.path, '-frames:v', '1', x1])
        await run(FF, ['-v', 'error', '-y', '-ss', ((i - 0.25) / 60).toFixed(5), '-i', bfile, '-frames:v', '1', x2])
        const r = await run(FF, ['-hide_banner', '-i', x1, '-i', x2, '-lavfi', 'psnr', '-f', 'null', '-'])
        const m = /average:([\d.inf]+)/.exec(r.err || '')
        o.vsChunked.push([i, m && m[1]])
      }
    }
    R.b2 = o
  }
  if (sel.includes('c')) {
    const p = await projectA()
    const { o } = await doExport('c', p, { path: path.join(OUT, 'c_gif.gif'), format: 'gif', resolution: '480p', fps: 15, quality: 'orta', range: { start: 6, end: 10 } })
    R.c = o
  }
  if (sel.includes('d')) {
    const p = await projectA(false)   // ses hazırlanmamış → yedek ffmpeg karıştırıcı
    const { o } = await doExport('d', p, { path: path.join(OUT, 'd_ses.mp3'), format: 'mp3', quality: 'yuksek' })
    R.d = o
  }
  if (sel.includes('e')) {
    // hız ölçümü: 16:9 1080p60, tek 1080p60 klip (basit zaman çizelgesi)
    const p = model.createProject({ ratio: '16:9', fps: 60, name: 'bench' })
    p.media.v1 = await media('oyun kaydı çılgın şölen.mp4', 'v1')
    p.tracks[0].clips = [model.createMediaClip(p.media.v1, { start: 0 })]
    R.e = { pbo: (await doExport('e-pbo', p, { path: path.join(OUT, 'e_bench.mp4'), format: 'mp4', resolution: '1080p', fps: 60, includeAudio: false })).o }
    R.e.sync = (await doExport('e-sync', p, { path: path.join(OUT, 'e_bench_sync.mp4'), format: 'mp4', resolution: '1080p', fps: 60, includeAudio: false, pbo: false })).o
    R.e.cpu = (await doExport('e-cpu', p, { path: path.join(OUT, 'e_bench_cpu.mp4'), format: 'mp4', resolution: '1080p', fps: 60, includeAudio: false, hw: 'cpu' })).o
    const p2 = model.createProject({ ratio: '9:16', fps: 30, name: 'bench dikey' })
    p2.media.v1 = p.media.v1
    p2.tracks[0].clips = [model.createMediaClip(p.media.v1, { start: 0 })]
    R.e.dikey30 = (await doExport('e-dikey', p2, { path: path.join(OUT, 'e_bench_dikey.mp4'), format: 'mp4', resolution: '1080p', fps: 30, includeAudio: false })).o
    R.e.dikey60 = (await doExport('e-dikey60', p2, { path: path.join(OUT, 'e_bench_dikey60.mp4'), format: 'mp4', resolution: '1080p', fps: 60, includeAudio: false })).o
  }
  if (sel.includes('fmt')) {
    const p = await projectA()
    R.fmt = {}
    for (const [k, o] of Object.entries({
      hevc: { format: 'mp4', codec: 'hevc' }, av1: { format: 'mp4', codec: 'av1' }, webm: { format: 'webm', codec: 'vp9', resolution: '480p' },
      prores: { format: 'mov', codec: 'prores', resolution: '480p', quality: 'dusuk' }, wav: { format: 'wav' }, m4a: { format: 'm4a' },
      x265: { format: 'mp4', codec: 'hevc', hw: 'cpu', resolution: '480p', quality: 'dusuk' }, br: { format: 'mp4', codec: 'h264', bitrateKbps: 3000 },
    })) {
      R.fmt[k] = (await doExport('fmt-' + k, p, { path: path.join(OUT, 'fmt_' + k + (o.format === 'mp4' ? '.mp4' : '.' + o.format)), resolution: '720p', fps: 30, range: { start: 6, end: 9 }, ...o })).o
    }
  }
  if (sel.includes('f')) {
    // hız eğrisi + dondurma + resim katmanı + bozuk dosya, 4:3 proje
    const p = model.createProject({ ratio: '4:3', fps: 30, name: 'Test F' })
    p.media.v1 = await media('oyun kaydı çılgın şölen.mp4', 'v1')
    p.media.v3 = await media('klip_opus.mkv', 'v3')
    p.media.im = { id: 'im', type: 'image', path: path.join(TV, 'overlay_test.png'), name: 'overlay_test.png', width: 1080, height: 1920, duration: 0 }
    p.media.bz = { id: 'bz', type: 'video', path: path.join(TV, 'bozuk.mp4'), name: 'bozuk.mp4', width: 1280, height: 720, duration: 3, fps: 30, hasAudio: false }
    const c1 = model.createMediaClip(p.media.v1, { start: 0, speedCurve: { id: 'custom', points: [{ x: 0, y: 0.5 }, { x: 0.5, y: 3 }, { x: 1, y: 0.5 }] } })
    c1.duration = durationFromSource(c1)
    const c2 = model.createMediaClip(p.media.v3, { start: c1.duration, freeze: true, in: 2, out: 2.001, duration: 1.5 })
    p.tracks[0].clips = [c1, c2]
    const im = model.createMediaClip(p.media.im, { start: 0.5, duration: 3 })
    im.transform = { ...im.transform, scale: 0.4, x: 0.3 }
    const bz = model.createMediaClip(p.media.bz, { start: 1, duration: 2 })
    bz.transform = { ...bz.transform, scale: 0.3, x: -0.3, y: 0.3 }
    p.tracks.unshift(model.createTrack('video', { clips: [im] }), model.createTrack('video', { clips: [bz] }))
    const { res, o } = await doExport('f', p, { path: path.join(OUT, 'f_egri_dondur.mp4'), format: 'mp4', resolution: '720p', fps: 30, quality: 'yuksek' })
    o.compare = []
    for (const i of [10, 40, 70, 100, 130, 150, 170]) if (i < res.frames) o.compare.push(await compareFrame(p, res.path, i, 30, 'f', 0.5))
    o.c1dur = c1.duration
    R.f = o
  }
  if (sel.includes('cancel')) {
    const p = await projectA()
    const ac = new AbortController()
    const target = path.join(OUT, 'iptal.mp4')
    setTimeout(() => ac.abort(), 1200)
    let err = null
    try { await exportProject(p, { path: target, format: 'mp4', resolution: '1080p', fps: 30 }, { signal: ac.signal }) } catch (e) { err = e }
    await new Promise(r => setTimeout(r, 1500))
    R.cancel = { name: err && err.name, msg: err && err.message, tmpExists: fs.existsSync(target + '.sweaxtmp'), outExists: fs.existsSync(target) }
    log('iptal:', R.cancel)
  }
} catch (e) {
  console.error(e)
  R.errors.push(String(e && e.stack || e))
}
window.__result = R
window.__done = true
