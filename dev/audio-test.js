// Ses motoru Electron testi: çevrimdışı miks (örnek hassasiyeti, kazanç, giriş/çıkış, anahtar kare, pan, EQ, netleştirme,
// ducking, geçiş, parça parça çözme, blok WAV), gerçek önizleme saati (now/getLevels/update/scrub).
// Çalıştır (Git Bash): DEVSHOT_URL=http://localhost:5199/dev/audio.html DEVSHOT_OUT=test-videos/out/audio.png DEVSHOT_TIMEOUT=240000 node_modules/electron/dist/electron.exe scripts/devshot.cjs

import * as model from '../src/core/model.js'
import { fs, path, run, ipc } from '../src/platform/node.js'
import '../src/packs/voiceFx/index.js'
import { renderProjectAudio, renderProjectAudioToWav, writeWav, audioEngine, AUDIO_DEFAULTS, processSpec, planEntries } from '../src/engine/audio.js'

const ROOT = path.resolve(window.require('process').cwd())
const OUT = path.join(ROOT, 'test-videos', 'out', 'audio', 'electron')
fs.mkdirSync(OUT, { recursive: true })
const PATHS = {
  userData: path.join(ROOT, 'test-videos', 'out', 'audio', 'userdata'), documents: OUT, temp: OUT,
  ffmpeg: path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
  ffprobe: path.join(ROOT, 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe'),
  appRoot: ROOT, resources: ROOT, vendor: path.join(ROOT, 'vendor'), isPackaged: false,
}
// devshot ana süreci app:paths yanıtlamaz → test için yamala (platform/node.js tembel çağırır)
const origSend = ipc.sendSync.bind(ipc)
ipc.sendSync = (ch, ...a) => ch === 'app:paths' ? PATHS : origSend(ch, ...a)

const SR = 48000
const rows = []
const results = {}
let failures = 0
function row(name, ok, detail) { rows.push({ name, ok, detail }); if (!ok) failures++; console.log((ok ? 'OK   ' : 'HATA ') + name + '  ' + detail) }

// ---------------------------------------------------------------- yardımcılar
function encodeWav(chans, sr = SR) {
  const n = chans[0].length, nc = chans.length
  const buf = Buffer.alloc(44 + n * nc * 4)
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + n * nc * 4, 4); buf.write('WAVEfmt ', 8, 'ascii'); buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(3, 20); buf.writeUInt16LE(nc, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * nc * 4, 28); buf.writeUInt16LE(nc * 4, 32); buf.writeUInt16LE(32, 34)
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(n * nc * 4, 40)
  const f = new Float32Array(n * nc)
  for (let c = 0; c < nc; c++) for (let i = 0; i < n; i++) f[i * nc + c] = chans[c][i]
  Buffer.from(f.buffer).copy(buf, 44)
  return buf
}
// media.js ile aynı: 48k stereo FLAC + 100 Hz tepe dosyası
async function prepMedia(id, src, { name } = {}) {
  const key = id + '-' + Math.round(fs.statSync(src).mtimeMs)
  const dir = path.join(OUT, 'media', key)
  fs.mkdirSync(dir, { recursive: true })
  const audioPath = path.join(dir, 'audio.flac'), peaksPath = path.join(dir, 'peaks.bin')
  if (!fs.existsSync(audioPath)) {
    const r = await run(PATHS.ffmpeg, ['-y', '-v', 'error', '-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'flac', '-compression_level', '0', audioPath])
    if (r.code !== 0) throw new Error(r.err)
  }
  if (!fs.existsSync(peaksPath)) {
    const r = await run(PATHS.ffmpeg, ['-v', 'error', '-i', audioPath, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'])
    const b = r.buf, n = Math.floor(b.length / 2), per = 80, peaks = new Uint8Array(Math.ceil(n / per))
    for (let i = 0, k = 0; i < n; i += per, k++) { let mx = 0; for (let j = i; j < Math.min(n, i + per); j++) mx = Math.max(mx, Math.abs(b.readInt16LE(j * 2))); peaks[k] = Math.min(255, Math.round(Math.sqrt(mx / 32768) * 255)) }
    fs.writeFileSync(peaksPath, Buffer.from(peaks.buffer))
  }
  const pr = await run(PATHS.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath])
  return { id, key, type: 'audio', path: src, name: name || path.basename(src), duration: +pr.out.trim(), hasAudio: true, audioPath, peaksPath, status: 'ready' }
}
function synthWav(file, seconds, fn, chans = 2) {
  const p = path.join(OUT, file)
  if (!fs.existsSync(p)) {
    const n = Math.round(seconds * SR), L = new Float32Array(n)
    for (let i = 0; i < n; i++) L[i] = fn(i / SR)
    fs.writeFileSync(p, encodeWav(chans === 2 ? [L, L] : [L]))
  }
  return p
}
function bursts(times) {
  return t => {
    let v = 0
    for (const h of times) { const d = t - h; if (d >= 0 && d < 0.12) { const e = Math.exp(-d / 0.03); let s = 0; for (let k = 1; k <= 10; k++) s += Math.sin(2 * Math.PI * 160 * k * d) / k; v += 0.5 * e * s } }
    return v
  }
}
function project(ratio = '16:9') { const p = model.createProject({ ratio }); p.tracks = p.tracks.filter(t => t.main); return p }
function audioTrack(p, clips, opts) { const t = model.createTrack('audio', { clips, ...opts }); p.tracks.push(t); return t }
function aclip(media, opts) { return model.createAudioClip(media, opts) }
const rms = (d, a, b) => { let s = 0; const i0 = Math.max(0, Math.round(a * SR)), i1 = Math.min(d.length, Math.round(b * SR)); for (let i = i0; i < i1; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, i1 - i0)) }
const db = x => 20 * Math.log10(Math.max(1e-9, x))
function goertzel(d, a, b, f) {
  const i0 = Math.round(a * SR), i1 = Math.round(b * SR), n = i1 - i0, w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w)
  let s1 = 0, s2 = 0
  for (let i = i0; i < i1; i++) { const s0 = d[i] + c * s1 - s2; s2 = s1; s1 = s0 }
  return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) * 2 / n // tepe genliği
}
// beklenen anın çevresinde atak (yerel tepenin %30'u) — örnek cinsinden hata
function attackErr(d, e, half = 0.03) {
  const a = Math.max(0, Math.round((e - half) * SR)), z = Math.min(d.length - 1, Math.round((e + half + 0.03) * SR))
  let pk = 0
  for (let i = a; i <= z; i++) pk = Math.max(pk, Math.abs(d[i]))
  if (pk < 1e-4) return Infinity
  for (let i = a; i <= z; i++) if (Math.abs(d[i]) >= 0.3 * pk) return i - e * SR
  return Infinity
}

// ================================================================ testler
async function main() {
  const t0 = performance.now()
  const HITS = [1, 1.83, 2.6, 3.4, 4.25, 5.1, 6.0, 6.9]
  const click = await prepMedia('click', synthWav('click.wav', 8, bursts(HITS)))
  const ref = synthWav('click_ref.wav', 8, bursts(HITS))
  void ref

  // ---- T1 örnek hassasiyeti (ham yol: hız 1)
  {
    const p = project()
    p.media.click = click
    audioTrack(p, [aclip(click, { start: 2.0, in: 0.5, out: 7.5, duration: 7 })])
    const buf = await renderProjectAudio(p, { start: 0, end: 10 })
    const d = buf.getChannelData(0)
    const errs = HITS.filter(h => h >= 0.5).map(h => attackErr(d, 2.0 + (h - 0.5)))
    // referans: aynı sentezin kendi atak noktası (sentez başlangıcına göre)
    const refErr = attackErr(new Float32Array(Array.from({ length: SR }, (_, i) => bursts([0.5])(i / SR))), 0.5)
    const rel = errs.map(e => e - refErr)
    row('Örnek hassasiyeti (ham, giriş 0.5, başlangıç 2.0)', rel.every(e => Math.abs(e) <= 1), `hata (örnek): ${rel.join(' ')}  süre ${buf.duration.toFixed(4)} sn`)
    results.sample = rel
    await writeWav(buf, path.join(OUT, 't1_click.wav'))
    // aynı proje, render aralığı ortadan başlıyor
    const b2 = await renderProjectAudio(p, { start: 3.3, end: 6 })
    const e2 = attackErr(b2.getChannelData(0), 2.0 + (4.25 - 0.5) - 3.3) - refErr
    row('Aralık ortadan başlayan dışa aktarma', Math.abs(e2) <= 1, `hata ${e2} örnek`)

    // netleştirme (kompresör ön gecikmesi telafisi)
    const p3 = JSON.parse(JSON.stringify(p)); p3.tracks[1].clips[0].audio.enhance = true
    const b3 = await renderProjectAudio(p3, { start: 0, end: 10 })
    const e3 = HITS.filter(h => h >= 0.5).map(h => attackErr(b3.getChannelData(0), 2.0 + (h - 0.5)) - refErr)
    row('Netleştirme (kompresör) gecikme telafisi', e3.every(e => Math.abs(e) <= 48), `hata (örnek): ${e3.map(x => x.toFixed(0)).join(' ')}`)
    results.enhance = e3

    // perde korumasız hız 1.5 (playbackRate)
    const p4 = JSON.parse(JSON.stringify(p)); Object.assign(p4.tracks[1].clips[0], { speed: 1.5, duration: 7 / 1.5 }); p4.tracks[1].clips[0].audio.preservePitch = false
    const b4 = await renderProjectAudio(p4, { start: 0, end: 10 })
    const e4 = HITS.filter(h => h >= 0.5).map(h => attackErr(b4.getChannelData(0), 2.0 + (h - 0.5) / 1.5) - refErr / 1.5)
    row('Hız 1.5× perde korumasız (playbackRate)', e4.every(e => Math.abs(e) <= 2), `hata (örnek): ${e4.map(x => x.toFixed(1)).join(' ')}`)

    // perde korumalı hız 2 (işlenmiş dosya)
    const p5 = JSON.parse(JSON.stringify(p)); Object.assign(p5.tracks[1].clips[0], { speed: 2, duration: 3.5 })
    const b5 = await renderProjectAudio(p5, { start: 0, end: 10 })
    const e5 = HITS.filter(h => h >= 0.5).map(h => attackErr(b5.getChannelData(0), 2.0 + (h - 0.5) / 2) - refErr / 2)
    const m5 = e5.map(Math.abs).sort((a, b) => a - b)[e5.length >> 1]
    row('Hız 2× perde korumalı (rubberband dosyası)', m5 <= 480 && e5.every(e => Math.abs(e) <= 1200), `hata (ms): ${e5.map(x => (x / 48).toFixed(1)).join(' ')}`)

    // parça parça çözme (uzun dosya kipi): eşikleri küçült → 2 sn'lik parçalar
    const save = { w: AUDIO_DEFAULTS.wholeMaxSec, c: AUDIO_DEFAULTS.chunkSec }
    AUDIO_DEFAULTS.wholeMaxSec = 3; AUDIO_DEFAULTS.chunkSec = 2
    audioEngine.clearCache()
    const b6 = await renderProjectAudio(p, { start: 0, end: 10 })
    const diff = maxDiff(b6, buf)
    AUDIO_DEFAULTS.wholeMaxSec = save.w; AUDIO_DEFAULTS.chunkSec = save.c
    audioEngine.clearCache()
    row('Parça parça çözme = bütün çözme', diff < 1e-4, `en büyük fark ${diff.toExponential(2)}`)
  }

  // ---- T2 kazanç, giriş/çıkış, anahtar kare, pan, EQ
  const tone1k = await prepMedia('tone1k', synthWav('tone1k.wav', 6, t => 0.5 * Math.sin(2 * Math.PI * 1000 * t)))
  {
    const p = project(); p.media[tone1k.id] = tone1k
    const c = aclip(tone1k, { start: 0 }); c.audio.volume = 0.5; c.audio.fadeIn = 1; c.audio.fadeOut = 1
    audioTrack(p, [c])
    const b = await renderProjectAudio(p, { start: 0, end: 6 })
    const d = b.getChannelData(0)
    const mid = db(rms(d, 2, 4)), exp = db(0.25 / Math.SQRT2)
    row('Ses 0.5 → −6 dB', Math.abs(mid - exp) < 0.05, `${mid.toFixed(2)} dBFS (beklenen ${exp.toFixed(2)})`)
    const f0 = rms(d, 0, 0.05) / rms(d, 2, 4), f1 = rms(d, 0.45, 0.55) / rms(d, 2, 4), f2 = rms(d, 5.95, 6) / rms(d, 2, 4)
    row('Giriş/çıkış geçişi (1 sn)', f0 < 0.05 && Math.abs(f1 - 0.5) < 0.05 && f2 < 0.05, `başta ${f0.toFixed(3)}, ortada ${f1.toFixed(3)} (≈0.5), sonda ${f2.toFixed(3)}`)
    // anahtar kare: 0 → 1 (doğrusal) 0..4 sn
    const p2 = project(); p2.media[tone1k.id] = tone1k
    const c2 = aclip(tone1k, { start: 0 }); c2.keyframes['audio.volume'] = [{ t: 0, v: 0, ease: 'linear' }, { t: 4, v: 1, ease: 'linear' }]
    audioTrack(p2, [c2])
    const b2 = await renderProjectAudio(p2, { start: 0, end: 6 })
    const g1 = goertzel(b2.getChannelData(0), 0.95, 1.05, 1000), g2 = goertzel(b2.getChannelData(0), 1.95, 2.05, 1000)
    row('Anahtar kare ses seviyesi (doğrusal)', Math.abs(g1 - 0.125) < 0.01 && Math.abs(g2 - 0.25) < 0.01, `1 sn: ${g1.toFixed(3)} (0.125), 2 sn: ${g2.toFixed(3)} (0.250)`)
    // pan −1
    const p3 = project(); p3.media[tone1k.id] = tone1k
    const c3 = aclip(tone1k, { start: 0 }); c3.audio.pan = -1
    audioTrack(p3, [c3])
    const b3 = await renderProjectAudio(p3, { start: 0, end: 3 })
    const l = rms(b3.getChannelData(0), 1, 2), r = rms(b3.getChannelData(1), 1, 2)
    row('Pan −1 (sol)', r < 1e-4 && l > 0.3, `sol ${db(l).toFixed(1)} dB, sağ ${db(r).toFixed(1)} dB`)
    // EQ: 100 Hz tonda alçak raf +12
    const t100 = await prepMedia('tone100', synthWav('tone100.wav', 3, t => 0.2 * Math.sin(2 * Math.PI * 100 * t)))
    const p4 = project(); p4.media[t100.id] = t100
    const c4 = aclip(t100, { start: 0 }); c4.audio.eq = { low: 12, mid: 0, high: 0 }
    audioTrack(p4, [c4])
    const b4 = await renderProjectAudio(p4, { start: 0, end: 3 })
    const gain = db(rms(b4.getChannelData(0), 1, 2) / (0.2 / Math.SQRT2))
    row('EQ alçak +12 dB (100 Hz)', gain > 10 && gain < 12.5, `kazanç ${gain.toFixed(2)} dB`)
    // sessiz iz
    const p5 = project(); p5.media[tone1k.id] = tone1k
    audioTrack(p5, [aclip(tone1k, { start: 0 })], { muted: true })
    const b5 = await renderProjectAudio(p5, { start: 0, end: 2 })
    row('Sessize alınmış iz duyulmaz', rms(b5.getChannelData(0), 0, 2) < 1e-6, 'rms ' + rms(b5.getChannelData(0), 0, 2).toExponential(1))
  }

  // ---- T3 ducking: müzik (7 kHz ton) + konuşma (duck)
  const speechSrc = path.join(ROOT, 'test-videos', 'out', 'tts.wav')
  if (fs.existsSync(speechSrc)) {
    const speech = await prepMedia('speech', speechSrc)
    const tone7k = await prepMedia('tone7k', synthWav('tone7k.wav', 14, t => 0.3 * Math.sin(2 * Math.PI * 7000 * t)))
    const p = project(); p.media[tone7k.id] = tone7k; p.media[speech.id] = speech
    audioTrack(p, [aclip(tone7k, { start: 0 })])
    const v = aclip(speech, { start: 3, role: 'voice' }); v.audio.duck = true
    audioTrack(p, [v])
    const b = await renderProjectAudio(p, { start: 0, end: 14 })
    const d = b.getChannelData(0)
    const before = goertzel(d, 1, 2.5, 7000), during = goertzel(d, 4.5, 5.5, 7000), after = goertzel(d, 12, 13.5, 7000)
    const red = db(during / before)
    row('Ducking (konuşma varken müzik −12 dB)', red < -10 && red > -13.5 && db(after / before) > -0.5, `önce ${db(before).toFixed(1)} dB, konuşmada ${db(during).toFixed(1)} dB (${red.toFixed(1)} dB), sonra ${db(after).toFixed(1)} dB`)
    results.duck = red
  }

  // ---- T4 geçiş: A (440) → B (880), 1 sn geçiş
  {
    const a440 = await prepMedia('a440', synthWav('a440.wav', 6, t => 0.4 * Math.sin(2 * Math.PI * 440 * t)))
    const b880 = await prepMedia('b880', synthWav('b880.wav', 6, t => 0.4 * Math.sin(2 * Math.PI * 880 * t)))
    const p = project(); p.media.a = { ...a440, type: 'video' }; p.media.b = { ...b880, type: 'video' }
    const A = model.createMediaClip(p.media.a, { start: 0, duration: 3, in: 1, out: 4, mediaId: 'a' })
    const B = model.createMediaClip(p.media.b, { start: 3, duration: 3, in: 1, out: 4, mediaId: 'b' })
    A.transition = { id: 'fade', duration: 1 }
    p.tracks[0].clips = [A, B]
    const b = await renderProjectAudio(p, { start: 0, end: 6 })
    const d = b.getChannelData(0)
    const ga = goertzel(d, 2.98, 3.02, 440), gb = goertzel(d, 2.98, 3.02, 880)
    const g0 = goertzel(d, 1, 2, 440)
    row('Geçişte eşit güçlü çapraz geçiş', Math.abs(db(ga / g0) + 3) < 0.6 && Math.abs(db(gb / g0) + 3) < 0.6, `kesimde A ${db(ga / g0).toFixed(2)} dB, B ${db(gb / g0).toFixed(2)} dB (−3 dB)`)
  }

  // ---- T5 gerçek miks: oyun videosu + opus klip (hız 1.5) + müzik (EQ) + TTS (Robot, duck)
  {
    const game = await prepMedia('game', path.join(ROOT, 'test-videos', 'oyun kaydı çılgın şölen.mp4'))
    const opus = await prepMedia('opus', path.join(ROOT, 'test-videos', 'klip_opus.mkv'))
    const music = await prepMedia('music', path.join(ROOT, 'test-videos', 'muzik.mp3'))
    const p = project('9:16')
    for (const m of [game, opus, music]) p.media[m.id] = m
    const v1 = model.createMediaClip({ ...game, type: 'video' }, { start: 0, duration: 4, in: 0, out: 4, mediaId: 'game' }); v1.audio.volume = 0.6; v1.audio.fadeIn = 0.3
    const v2 = model.createMediaClip({ ...opus, type: 'video' }, { start: 4, duration: 4 / 1.5, in: 0, out: 4, speed: 1.5, mediaId: 'opus' }); v2.audio.volume = 0.7
    p.tracks[0].clips = [v1, v2]
    const mu = aclip(music, { start: 0.5, mediaId: 'music' }); mu.audio.eq = { low: 4, mid: 0, high: -2 }; mu.audio.fadeOut = 1
    audioTrack(p, [mu, aclip(music, { start: 3.6, mediaId: 'music' })])
    if (fs.existsSync(speechSrc)) {
      const speech = await prepMedia('speech', speechSrc)
      p.media.speech = speech
      const tts = aclip(speech, { start: 1, mediaId: 'speech', role: 'voice' }); tts.audio.duck = true; tts.audio.voiceFx = { id: 'vfx-robot' }; tts.audio.denoise = 30
      audioTrack(p, [tts])
    }
    const specs = planEntries(p).filter(e => e.spec).length
    const st = performance.now()
    const buf = await renderProjectAudio(p, { onProgress: () => {} })
    const ms = performance.now() - st
    const wav = path.join(ROOT, 'test-videos', 'out', 'audio_mix.wav')
    await writeWav(buf, wav)
    const pr = await run(PATHS.ffprobe, ['-v', 'error', '-show_entries', 'stream=duration,sample_rate,channels', '-of', 'json', wav])
    const s = JSON.parse(pr.out).streams[0]
    const as = await run(PATHS.ffmpeg, ['-hide_banner', '-nostats', '-i', wav, '-af', 'astats=measure_overall=RMS_level+Peak_level:measure_perchannel=none', '-f', 'null', '-'])
    const rmsDb = +(/RMS level dB:\s*(-?[\d.]+)/.exec(as.err) || [])[1], peakDb = +(/Peak level dB:\s*(-?[\d.]+)/.exec(as.err) || [])[1]
    const expDur = Math.max(...p.tracks.flatMap(t => t.clips.map(c => c.start + c.duration)))
    row('Gerçek proje miksi → WAV', Math.abs(+s.duration - expDur) < 1e-3 && rmsDb > -40 && peakDb <= 0.01, `${(+s.duration).toFixed(4)} sn (beklenen ${expDur.toFixed(4)}), ${s.sample_rate} Hz ${s.channels} kanal, RMS ${rmsDb} dB, tepe ${peakDb} dB, ${specs} işlenmiş klip, ${ms.toFixed(0)} ms`)
    results.mix = { duration: +s.duration, rmsDb, peakDb, ms }
    drawWave(buf, 'Gerçek miks (oyun + opus 1.5× + müzik + TTS Robot, ducking)')
    // blok blok WAV (bellek sınırlı yol) = tek seferde
    const wav2 = path.join(OUT, 'mix_blocks.wav')
    await renderProjectAudioToWav(p, wav2, { block: 2.5 })
    const r2 = await run(PATHS.ffmpeg, ['-v', 'error', '-i', wav2, '-f', 'f32le', '-ac', '2', '-'])
    const f2 = new Float32Array(r2.buf.buffer.slice(r2.buf.byteOffset, r2.buf.byteOffset + r2.buf.length))
    let md = 0
    const L = buf.getChannelData(0), R = buf.getChannelData(1)
    for (let i = 0; i < Math.min(L.length, f2.length / 2); i++) md = Math.max(md, Math.abs(L[i] - f2[2 * i]), Math.abs(R[i] - f2[2 * i + 1]))
    row('Blok blok WAV (2.5 sn bloklar) = tek parça', md < 2e-3 && Math.abs(f2.length / 2 - L.length) <= 1, `en büyük fark ${md.toExponential(2)}, ${f2.length / 2} / ${L.length} örnek`)
    // 44.1 kHz dışa aktarma
    const b44 = await renderProjectAudio(p, { sampleRate: 44100 })
    row('44.1 kHz dışa aktarma', Math.abs(b44.length / 44100 - expDur) < 1 / 44100 * 2, `${b44.length} örnek = ${(b44.length / 44100).toFixed(4)} sn`)

    // ---- T6 önizleme (gerçek AudioContext): saat, seviye, güncelleme, sarma
    audioEngine.warmup() // uygulamada düzenleyici açılınca çağrılır (ses aygıtı önceden açık)
    await audioEngine.preload(p, 0.5)
    await new Promise(r => setTimeout(r, 800))
    const perf0 = performance.now()
    audioEngine.start(p, 0.5)
    const samples = []
    let lv = { l: 0 }
    for (let k = 0; k < 16; k++) {
      await new Promise(r => setTimeout(r, 100))
      samples.push({ wall: (performance.now() - perf0) / 1000, t: audioEngine.now() })
      if (k === 8) { const l = audioEngine.getLevels(); if (l.l > lv.l) lv = l }
      if (k === 6) { const p2 = JSON.parse(JSON.stringify(p)); p2.tracks[1].clips[0].audio.volume = 0.3; audioEngine.update(p2) }
    }
    const playing = audioEngine.isPlaying
    audioEngine.stop()
    const stopT = audioEngine.now()
    const moving = samples.filter(x => x.t > 0.5 + 1e-6)
    const last = samples[samples.length - 1], first = moving[0]
    const rate = (last.t - first.t) / (last.wall - first.wall)
    const startLat = first.wall - (first.t - 0.5) // saatin kıpırdamaya başladığı an (sn)
    const ctx = audioEngine.ctx
    row('Önizleme ana saati (now)', playing && Math.abs(rate - 1) < 0.01 && startLat < 0.25, `hız ${rate.toFixed(4)}×, başlama gecikmesi ${(startLat * 1000).toFixed(0)} ms, son ${last.t.toFixed(3)} sn, çıkış gecikmesi ${((ctx.baseLatency || 0) * 1000).toFixed(1)}+${((ctx.outputLatency || 0) * 1000).toFixed(1)} ms, durunca ${stopT.toFixed(3)}`)
    row('VU ölçer seviyesi', lv.l > 0.005 && lv.peakL >= lv.l, `rms L ${db(lv.l).toFixed(1)} dB, tepe L ${db(lv.peakL).toFixed(1)} dB`)
    audioEngine.scrub(p, 2.2)
    row('Sarma (scrub) hatasız', true, 'kısa parça çalındı')
    results.preview = { rate, samples }
  }
  // ---- işlenmiş dosya tanımı (ses değiştirici) — yolu ve dizin
  {
    const sp = processSpec({ type: 'audio', in: 0, out: 3, duration: 3, speed: 1, audio: { ...model.defaultAudio(), voiceFx: { id: 'vfx-sincap' } } }, { audioPath: 'x.flac', key: 'k', duration: 3 })
    row('processSpec (ses değiştirici)', !!sp && sp.fx.includes('rubberband'), sp ? sp.fx.slice(0, 60) : 'yok')
  }

  // ---- TTS renderer içinde (Piper + Windows yedeği listesi)
  {
    const { synthesize, listVoices } = await import('../src/features/tts/index.js')
    const vs = await listVoices()
    const st = performance.now()
    const r = await synthesize('Sesli anlatım denemesi: bir, iki, üç. Şimdi başlıyoruz!', { voice: 'piper:tr_TR-fahrettin-medium', rate: 1.1 })
    row('TTS (renderer, Piper Türkçe)', r.duration > 1.5 && r.words.length === 8, `${(performance.now() - st).toFixed(0)} ms, ${r.duration.toFixed(2)} sn, ${r.words.length} kelime, ${vs.filter(v => v.installed).length} kurulu / ${vs.length} ses`)
  }
  // ---- seslendirme kaydı: yalnız sahte aygıtla (--use-fake-device-for-media-stream); gerçek mikrofona dokunma
  if (location.search.includes('rec=1')) {
    const devs = await navigator.mediaDevices.enumerateDevices()
    const fake = devs.find(d => d.kind === 'audioinput' && /fake/i.test(d.label))
    if (!fake) row('Seslendirme kaydı', false, 'sahte aygıt görünmüyor — atlandı (' + devs.filter(d => d.kind === 'audioinput').map(d => d.label || '?').join(', ') + ')')
    else {
      const rec = await import('../src/features/audio/recorder.js')
      const ins = await rec.listInputs()
      let maxLv = 0, n = 0
      await rec.startRecording({ deviceId: fake.deviceId, onLevel: l => { n++; maxLv = Math.max(maxLv, l.peak) } })
      await new Promise(r => setTimeout(r, 1600))
      const p = await rec.stopRecording()
      const pr = await run(PATHS.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,duration', '-of', 'json', p])
      const s = JSON.parse(pr.out).streams[0]
      row('Seslendirme kaydı (sahte mikrofon)', s.codec_name === 'flac' && +s.duration > 1.35 && n > 20 && maxLv > 0.01, `${ins.length} giriş, ${s.codec_name} ${s.sample_rate} Hz ${(+s.duration).toFixed(2)} sn, ${n} seviye ölçümü, tepe ${maxLv.toFixed(2)}`)
    }
  }

  results.ms = performance.now() - t0
  render()
}

function maxDiff(a, b) {
  let m = 0
  for (let c = 0; c < 2; c++) { const x = a.getChannelData(c), y = b.getChannelData(c); for (let i = 0; i < Math.min(x.length, y.length); i++) m = Math.max(m, Math.abs(x[i] - y[i])) }
  return m
}

function drawWave(buf, label) {
  const lb = document.createElement('div'); lb.className = 'lbl'; lb.textContent = label
  const c = document.createElement('canvas'); c.width = 1500; c.height = 150
  document.getElementById('out').append(lb, c)
  const g = c.getContext('2d'), d = buf.getChannelData(0), per = Math.ceil(d.length / c.width)
  g.fillStyle = '#2EE6A6'
  for (let x = 0; x < c.width; x++) { let mn = 0, mx = 0; for (let i = x * per; i < Math.min(d.length, (x + 1) * per); i++) { if (d[i] < mn) mn = d[i]; if (d[i] > mx) mx = d[i] } g.fillRect(x, 75 - mx * 70, 1, Math.max(1, (mx - mn) * 70)) }
  g.fillStyle = '#E4FF3A'
  for (let s = 0; s <= buf.duration; s++) { const x = s / buf.duration * c.width; g.fillRect(x, 0, 1, 6); g.font = '10px monospace'; g.fillText(s + 's', x + 2, 146) }
}

function render() {
  const t = document.createElement('table')
  const add = (cells, cls, tag = 'td') => { const tr = t.insertRow(); cells.forEach((c, i) => { const td = document.createElement(tag); td.textContent = c; if (i === 0 && cls) td.className = cls; tr.appendChild(td) }) }
  add(['', 'Test', 'Ayrıntı'], '', 'th')
  for (const r of rows) add([r.ok ? '✓' : '✗', r.name, String(r.detail).slice(0, 150)], r.ok ? 'ok' : 'no')
  const out = document.getElementById('out')
  out.insertBefore(t, out.firstChild)
  window.__result = { failures, passed: rows.length - failures, total: rows.length, ...results, rows: rows.map(r => ({ n: r.name, ok: r.ok, d: r.detail })) }
  // gizli pencerede ekran görüntüsü son boyamayı alır → bir kare bekle
  requestAnimationFrame(() => setTimeout(() => { window.__done = true }, 400))
}

main().catch(e => { console.error('TEST ÇÖKTÜ', e && e.stack || e); row('TEST ÇÖKTÜ', false, String(e && e.message || e)); render() })
