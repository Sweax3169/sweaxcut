// Ses paketi Node testleri (Electron gerektirmeyenler): TTS, ses değiştiriciler, işleme hattı hizası,
// vuruş, sessizlik, öne çıkan anlar, yükseklik.  Çalıştır: node dev/audio-node-test.mjs [bölüm…]
// Bölümler: tts fx proc beats silence highlights loud  (boş = hepsi)

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import nodePath from 'path'
import nodeFs from 'fs'

const require = createRequire(import.meta.url)
const ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = nodePath.join(ROOT, 'test-videos', 'out', 'audio')
nodeFs.mkdirSync(OUT, { recursive: true })
const PATHS = {
  userData: nodePath.join(OUT, 'userdata'), documents: OUT, temp: OUT,
  ffmpeg: require('ffmpeg-static'), ffprobe: nodePath.join(ROOT, 'vendor', 'ffprobe', 'ffprobe.exe'),
  appRoot: ROOT, resources: ROOT, vendor: nodePath.join(ROOT, 'vendor'), isPackaged: false,
}
globalThis.window = { require: m => m === 'electron' ? { ipcRenderer: { sendSync: () => PATHS } } : require(m) }

const { run } = await import('../src/platform/node.js')
const { REG } = await import('../src/engine/registry.js')
await import('../src/packs/voiceFx/index.js')
const AP = await import('../src/engine/audio-process.js')
const { synthesize, listVoices } = await import('../src/features/tts/index.js')
const { detectBeats } = await import('../src/features/audio/beats.js')
const { detectSilences, planSilenceCuts } = await import('../src/features/audio/silence.js')
const { detectHighlights } = await import('../src/features/audio/highlights.js')
const { loudness, levelStats } = await import('../src/features/audio/analyze.js')

const want = new Set(process.argv.slice(2))
const on = k => !want.size || want.has(k)
const results = {}
const SR = 48000
const ff = PATHS.ffmpeg, fp = PATHS.ffprobe
const log = (...a) => console.log(...a)
let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; log('  ✗ ' + msg) } else log('  ✓ ' + msg) }

async function dur(p) {
  const r = await run(fp, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration_ts,sample_rate,duration,channels', '-of', 'json', p])
  const s = JSON.parse(r.out).streams[0]
  return { dur: s.duration_ts && s.sample_rate ? +s.duration_ts / +s.sample_rate : +s.duration, sr: +s.sample_rate, ch: +s.channels }
}
async function pcmOf(p, sr = SR) {
  const r = await run(ff, ['-v', 'error', '-i', p, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'])
  return new Float32Array(r.buf.buffer.slice(r.buf.byteOffset, r.buf.byteOffset + (r.buf.length & ~3)))
}
function writeWav(p, chans, sr = SR) { nodeFs.writeFileSync(p, AP.encodeWav(chans, sr, 32)) }
function onsetsOf(f, sr = SR, rel = 0.3, skip = 0.25) {
  let mx = 0; for (const v of f) mx = Math.max(mx, Math.abs(v))
  const o = []
  for (let i = 0; i < f.length; i++) if (Math.abs(f[i]) > rel * mx) { o.push(i / sr); i += Math.round(skip * sr) }
  return o
}
// beklenen anın ±60 ms çevresinde atak (yerel tepenin %30'u) — yankı/modülasyon efektlerinde sağlam
function attackErr(f, e, half = 0.06, sr = SR) {
  const a = Math.max(0, Math.round((e - half) * sr)), z = Math.min(f.length - 1, Math.round((e + half + 0.04) * sr))
  let pk = 0
  for (let i = a; i <= z; i++) pk = Math.max(pk, Math.abs(f[i]))
  if (pk < 1e-4) return Infinity
  for (let i = a; i <= z; i++) if (Math.abs(f[i]) >= 0.3 * pk) return i / sr - e
  return Infinity
}
// medya.js ile aynı: 48k stereo FLAC
async function toFlac(src, name) {
  const out = nodePath.join(OUT, name)
  if (!nodeFs.existsSync(out)) {
    const r = await run(ff, ['-y', '-v', 'error', '-i', src, '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'flac', '-compression_level', '0', out])
    if (r.code !== 0) throw new Error(r.err)
  }
  return out
}
// keskin ataklı harmonik vuruşlar (hiza ölçümü için)
function burstTrack(times, total, f0 = 160) {
  const n = Math.round(total * SR), x = new Float32Array(n)
  for (const h of times) {
    const i0 = Math.round(h * SR)
    for (let i = 0; i < 0.12 * SR && i0 + i < n; i++) {
      const t = i / SR, env = Math.exp(-t / 0.03)
      let s = 0; for (let k = 1; k <= 10; k++) s += Math.sin(2 * Math.PI * f0 * k * t) / k
      x[i0 + i] += 0.5 * env * s
    }
  }
  return x
}

// ================================================================ (e) TTS
let speech = nodePath.join(ROOT, 'test-videos', 'out', 'tts.wav')
if (on('tts')) {
  log('\n== TTS (Piper, çevrimdışı)')
  const voices = await listVoices()
  const inst = voices.filter(v => v.installed)
  log('  kurulu sesler:', inst.map(v => v.id).join(', '))
  log('  indirilebilir Piper sesleri:', voices.filter(v => v.downloadable).length)
  const text = 'Merhaba arkadaşlar, bugün çok çılgın bir oyun oynayacağız. Hazır mısınız? Haydi başlayalım; ilk bölümde şölen var!'
  let t0 = Date.now()
  const r = await synthesize(text, { voice: 'piper:tr_TR-fahrettin-medium' })
  const ms = Date.now() - t0
  nodeFs.copyFileSync(r.path, speech)
  const d = await dur(speech)
  log(`  piper: ${ms} ms, süre ${r.duration.toFixed(3)} sn, ffprobe ${d.dur.toFixed(3)} sn ${d.sr} Hz ${d.ch} kanal, ${r.words.length} kelime`)
  log('  kelimeler:', r.words.map(w => `${w.w}[${w.s.toFixed(2)}-${w.e.toFixed(2)}]`).join(' '))
  check(Math.abs(d.dur - r.duration) < 0.002 && d.sr === 48000, 'tts.wav 48 kHz ve süre tutarlı')
  check(r.words.length === 16, 'kelime sayısı 16')
  check(r.words.every((w, i) => w.e > w.s && (i === 0 || w.s >= r.words[i - 1].e - 1e-3)), 'kelime zamanları sıralı')
  const st = await levelStats(speech)
  log('  seviye:', JSON.stringify(st))
  check(st.rmsDb > -40, 'ses sessiz değil')
  t0 = Date.now()
  const r2 = await synthesize(text, { voice: 'piper:tr_TR-fahrettin-medium', pitch: 3, rate: 1.25, volume: 0.8 })
  log(`  perde +3 / hız 1.25: ${Date.now() - t0} ms, süre ${r2.duration.toFixed(3)} sn (hızlanma ${(r.duration / r2.duration).toFixed(2)}×)`)
  check(r2.duration < r.duration * 0.92, 'hız ayarı süreyi kısalttı')
  const r3 = await synthesize(text, { voice: 'piper:tr_TR-fahrettin-medium' })
  check(r3.cached, 'önbellekten döndü')
  results.tts = { ms, duration: r.duration, words: r.words, pitched: r2.duration }
  // Windows OneCore / SAPI yedeği
  const one = inst.find(v => v.engine === 'onecore' && v.lang === 'tr-TR')
  if (one) {
    t0 = Date.now()
    const w = await synthesize('Merhaba, bu Windows sesiyle bir deneme.', { voice: one.id })
    log(`  OneCore ${one.name}: ${Date.now() - t0} ms, ${w.duration.toFixed(2)} sn, kelimeler: ${w.words.map(x => `${x.w}@${x.s.toFixed(2)}`).join(' ')}`)
    check(w.words.length >= 5 && w.duration > 1, 'OneCore sentez + kelime zamanları')
    nodeFs.copyFileSync(w.path, nodePath.join(ROOT, 'test-videos', 'out', 'tts_onecore.wav'))
  }
  const sapi = inst.find(v => v.engine === 'sapi')
  if (sapi) {
    const w = await synthesize('Hello, this is a fallback voice test.', { voice: sapi.id })
    log(`  SAPI ${sapi.name}: ${w.duration.toFixed(2)} sn, ${w.words.length} kelime`)
    check(w.duration > 1, 'SAPI sentez')
  }
}

// ================================================================ (b) ses değiştiriciler
if (on('fx')) {
  log('\n== Ses değiştiriciler (' + REG.voiceFx.list.length + ')')
  const srcs = [await toFlac(speech, 'speech.flac'), await toFlac(nodePath.join(ROOT, 'test-videos', 'oyun kaydı çılgın şölen.mp4'), 'oyun.flac')]
  const clickHits = [0.6, 2.1, 3.7, 5.2]
  const clickDur = 6.5
  const cp = nodePath.join(OUT, 'click_fx.wav')
  writeWav(cp, [burstTrack(clickHits, clickDur), burstTrack(clickHits, clickDur)])
  const speechMedia = { id: 'msp', key: 'speech-v1', audioPath: srcs[0], duration: (await dur(srcs[0])).dur, hasAudio: true, name: 'speech' }
  const clickMedia = { id: 'mfx', key: 'clickfx-v1', audioPath: await toFlac(cp, 'click_fx.flac'), duration: clickDur, hasAudio: true, name: 'click' }
  const rows = []
  for (const fx of REG.voiceFx.list) {
    const chain = fx.ffmpeg(Object.fromEntries((fx.params || []).map(p => [p.key, p.default])))
    const row = { id: fx.id, name: fx.name }
    for (const [k, src] of srcs.entries()) {
      const out = nodePath.join(OUT, `fx_${fx.id}_${k}.wav`)
      const r = await run(ff, ['-y', '-v', 'error', '-i', src, '-af', chain + ',aresample=48000', '-ac', '2', '-ar', '48000', out], { cwd: AP.procDir() })
      if (r.code !== 0) { row['err' + k] = r.err.slice(-300); continue }
      const a = await dur(src), b = await dur(out)
      const st = await levelStats(out)
      row['ratio' + k] = +(b.dur / a.dur).toFixed(4)
      row['rms' + k] = st.rmsDb
    }
    row.lag = await AP.measureLag(chain, 1)
    // gerçek işleme hattından (önbellek dosyası) geçir: kesin süre, NaN yok, vuruş hizası
    const clip = { id: 'v', type: 'audio', start: 0, in: 0, out: clickDur, duration: clickDur, speed: 1, reverse: false, freeze: false, speedCurve: null, keyframes: {}, audio: { volume: 1, pitch: 0, preservePitch: true, voiceFx: { id: fx.id }, denoise: 0, normalize: false } }
    const meta = await AP.ensureProcessed(AP.processSpec(clip, clickMedia))
    const f = await pcmOf(meta.path)
    let nan = 0, pk = 0
    for (const v of f) { if (!isFinite(v)) nan++; else if (Math.abs(v) > pk) pk = Math.abs(v) }
    const pd = await dur(meta.path)
    const errs = clickHits.map(h => attackErr(f, AP.procTime(meta, h, h)))
    row.alignMaxMs = +(Math.max(...errs.map(Math.abs)) * 1000).toFixed(1)
    row.nan = nan; row.peak = +pk.toFixed(3); row.procDur = pd.dur; row.expDur = meta.B - meta.A
    const sClip = { ...clip, out: speechMedia.duration, duration: speechMedia.duration }
    const sMeta = await AP.ensureProcessed(AP.processSpec(sClip, speechMedia))
    const sst = await levelStats(sMeta.path)
    row.speechRms = sst.rmsDb; row.speechPeak = sst.peakDb
    rows.push(row)
    const ok = !row.err0 && !row.err1 && row.ratio0 > 0.985 && row.ratio0 < 1.25 && row.rms0 > -45 && nan === 0 && Math.abs(pd.dur - row.expDur) < 1e-3 && row.alignMaxMs < 25 && row.speechRms > -40 && row.speechRms < -6 && row.speechPeak <= 0.01
    if (!ok) failures++
    log(`  ${ok ? '✓' : '✗'} ${fx.name.padEnd(16)} süre×${row.ratio0}  rms ${row.rms0} dB  gecikme ${(row.lag * 1000).toFixed(1)} ms  hat: ${pd.dur.toFixed(3)}/${row.expDur.toFixed(3)} sn, tepe ${row.peak}, NaN ${nan}, hiza ±${row.alignMaxMs} ms, konuşma ${row.speechRms.toFixed(1)}/${row.speechPeak.toFixed(1)} dB ${row.err0 ? 'HATA ' + row.err0 : ''}`)
  }
  results.fx = rows
}

// ================================================================ işleme hattı (hız/perde/fx/gürültü/normalize/ters) + hiza
if (on('proc')) {
  log('\n== İşleme hattı ve hiza')
  const hits = [1, 1.83, 2.6, 3.4, 4.25, 5.1, 6.0, 6.9]
  const clickPath = nodePath.join(OUT, 'click.wav')
  writeWav(clickPath, [burstTrack(hits, 8), burstTrack(hits, 8)])
  const click = await toFlac(clickPath, 'click.flac')
  const media = { id: 'mc', key: 'click-v1', audioPath: click, duration: 8, hasAudio: true, name: 'click' }
  const base = { id: 'c1', type: 'audio', start: 0, in: 0.5, out: 7.5, duration: 7, speed: 1, reverse: false, freeze: false, speedCurve: null, keyframes: {}, audio: { volume: 1, pitch: 0, preservePitch: true, voiceFx: null, denoise: 0, normalize: false } }
  const cases = [
    ['hız 2× (perde korumalı)', { speed: 2, duration: 3.5 }],
    ['hız 0.5×', { speed: 0.5, duration: 14 }],
    ['hız 1.5× + perde +4', { speed: 1.5, duration: 7 / 1.5, audio: { ...base.audio, pitch: 4 } }],
    ['perde −5', { audio: { ...base.audio, pitch: -5 } }],
    ['gürültü azaltma 70', { audio: { ...base.audio, denoise: 70 } }],
    ['normalize', { audio: { ...base.audio, normalize: true } }],
    ['ses değiştirici: Robot', { audio: { ...base.audio, voiceFx: { id: 'vfx-robot' } } }],
    ['ses değiştirici: İnce ses', { audio: { ...base.audio, voiceFx: { id: 'vfx-ince' } } }],
    ['ters', { reverse: true }],
    ['ters + hız 2×', { reverse: true, speed: 2, duration: 3.5 }],
    ['hız eğrisi (0.5→2)', { speedCurve: { id: 'x', points: [{ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.55, y: 2 }, { x: 1, y: 2 }] } }],
    ['hız eğrisi + perde +3', { speedCurve: { id: 'y', points: [{ x: 0, y: 3 }, { x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 1, y: 2.5 }] }, audio: { ...base.audio, pitch: 3 } }],
  ]
  const { sourceTime } = await import('../src/core/time.js')
  const { durationFromSource } = await import('../src/core/time.js')
  results.proc = []
  for (const [name, patch] of cases) {
    const clip = { ...base, ...patch }
    if (clip.speedCurve) clip.duration = durationFromSource(clip)
    const spec = AP.processSpec(clip, media)
    const t0 = Date.now()
    const meta = await AP.ensureProcessed(spec)
    const ms = Date.now() - t0
    const f = await pcmOf(meta.path)
    // beklenen: her vuruşun klip yerel zamanı → dosya zamanı
    const exp = []
    for (const h of hits) {
      // yerel zamanı bul (ikiye bölme)
      let a = -1, b = clip.duration + 1
      const inc = sourceTime(clip, 1) > sourceTime(clip, 0)
      for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if ((sourceTime(clip, m) < h) === inc) a = m; else b = m }
      const lt = (a + b) / 2
      if (lt < 0 || lt > clip.duration) continue
      exp.push(AP.procTime(meta, h, lt))
    }
    let errs = exp.map(e => attackErr(f, e))
    if (clip.reverse) {
      // ters: atak sona döner → zarf çapraz ilişkisiyle beklenen (kaynağın ters + hızlandırılmış hali) ile karşılaştır
      const src = await pcmOf(click)
      const k = meta.tempo, hop = 48, env = x => { const n = Math.floor(x.length / hop), e = new Float32Array(n); for (let i = 0; i < n; i++) { let q = 0; for (let j = 0; j < hop; j++) q += x[i * hop + j] ** 2; e[i] = Math.sqrt(q / hop) } return e }
      const es = env(src), ep = env(f)
      const n = Math.floor((meta.B - meta.A) / k * 1000)
      const ex = new Float32Array(n)
      for (let i = 0; i < n; i++) { const st = meta.B - (i / 1000) * k; ex[i] = es[Math.max(0, Math.min(es.length - 1, Math.round(st * 1000)))] }
      let best = -1, bl = 0
      for (let L = -60; L <= 60; L++) { let q = 0; for (let i = 60; i < n - 60; i++) q += ex[i] * (ep[i + L] || 0); if (q > best) { best = q; bl = L } }
      errs = [bl / 1000]
    }
    if (name === 'hız 0.5×') log('     vuruş hataları (ms):', errs.map(e => (e * 1000).toFixed(1)).join(' '))
    const fx = !!(clip.audio.voiceFx || clip.audio.denoise)
    const mean = errs.reduce((x, y) => x + Math.abs(y), 0) / Math.max(1, errs.length)
    const maxe = Math.max(...errs.map(Math.abs))
    const med = errs.map(Math.abs).sort((x, y) => x - y)[errs.length >> 1]
    const limit = fx ? 0.015 : 0.01
    // ortanca hata sınır içinde, tek tük vuruşta rubberband atak yayması (yavaşlatmada) ≤ 2.5×
    const ok = errs.length > 0 && med < limit && maxe < limit * 2.5
    if (!ok) failures++
    log(`  ${ok ? '✓' : '✗'} ${name.padEnd(26)} ${ms} ms  gecikme telafisi ${(meta.lag * 1000).toFixed(1)} ms  ölçek ${meta.scale.toFixed(5)}  hiza hatası ort ${(mean * 1000).toFixed(1)} ms / en çok ${(maxe * 1000).toFixed(1)} ms (${errs.length} vuruş)`)
    results.proc.push({ name, ms, lag: meta.lag, scale: meta.scale, meanErrMs: mean * 1000, maxErrMs: maxe * 1000 })
    if (name === 'normalize') {
      const L = await loudness(meta.path)
      log(`     normalize sonrası: ${L.integrated} LUFS, gerçek tepe ${L.truePeak} dBTP`)
    }
  }
}

// ================================================================ (c) vuruşlar
if (on('beats')) {
  log('\n== Vuruş algılama')
  const m = await detectBeats(nodePath.join(ROOT, 'test-videos', 'muzik.mp3'))
  log(`  muzik.mp3: ${m.bpm} BPM, ${m.beats.length} vuruş, güven ${m.confidence}, ilk vuruşlar ${m.beats.slice(0, 6).join(', ')}`)
  results.beats = { muzik: m, synth: [] }
  for (const bpm of [90, 120, 128, 145, 174]) {
    // davul döngüsü: vuruşta kick, ara 8'liklerde hi-hat, 2 ve 4'te snare; başta 0.37 sn boşluk
    const total = 24, off = 0.37, n = Math.round(total * SR), x = new Float32Array(n)
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1 }
    const per = 60 / bpm
    const truth = []
    for (let k = 0; off + k * per < total - 0.5; k++) {
      const t0 = off + k * per
      truth.push(t0)
      const i0 = Math.round(t0 * SR)
      for (let i = 0; i < 0.25 * SR && i0 + i < n; i++) { const t = i / SR; x[i0 + i] += 0.8 * Math.exp(-t / 0.07) * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t / 0.02)) * t) }
      if (k % 2 === 1) for (let i = 0; i < 0.15 * SR && i0 + i < n; i++) x[i0 + i] += 0.35 * Math.exp(-i / SR / 0.05) * rnd()
      const ih = Math.round((t0 + per / 2) * SR)
      for (let i = 0; i < 0.04 * SR && ih + i < n; i++) x[ih + i] += 0.12 * Math.exp(-i / SR / 0.01) * rnd()
    }
    const p = nodePath.join(OUT, `loop_${bpm}.wav`)
    writeWav(p, [x])
    const r = await detectBeats(p)
    const se = r.beats.map(b => { let best = Infinity; for (const t of truth) if (Math.abs(b - t) < Math.abs(best)) best = b - t; return best })
    const errs = se.map(Math.abs)
    const mean = errs.reduce((a, b) => a + b, 0) / Math.max(1, errs.length)
    const signed = se.reduce((a, b) => a + b, 0) / Math.max(1, se.length)
    const octave = Math.abs(r.bpm * 2 - bpm) < 2 // yarım tempo (DnB 174 → 87 gibi) kabul
    const ok = (Math.abs(r.bpm - bpm) < 1 || octave) && mean < 0.02
    log(`     işaretli ort. ${(signed * 1000).toFixed(1)} ms${octave ? ' (yarım tempo)' : ''}`)
    if (!ok) failures++
    log(`  ${ok ? '✓' : '✗'} ${bpm} BPM döngü → ${r.bpm} BPM, ${r.beats.length}/${truth.length} vuruş, ort. hata ${(mean * 1000).toFixed(1)} ms, güven ${r.confidence}`)
    results.beats.synth.push({ bpm, got: r.bpm, beats: r.beats.length, truth: truth.length, meanErrMs: mean * 1000 })
  }
}

// ================================================================ (d) sessizlik
if (on('silence')) {
  log('\n== Sessizlik algılama')
  // konuşma + 1.2 sn sessizlik + konuşma + 0.8 sn sessizlik
  const sp = await pcmOf(speech)
  const gapA = 1.2, gapB = 0.8
  const n = sp.length * 2 + Math.round((gapA + gapB) * SR)
  const x = new Float32Array(n)
  x.set(sp, 0); x.set(sp, sp.length + Math.round(gapA * SR))
  const p = nodePath.join(OUT, 'speech_gaps.wav')
  writeWav(p, [x])
  const spDur = sp.length / SR
  const sil = await detectSilences(p, { thresholdDb: -35, minDuration: 0.45, padding: 0.12 })
  log('  sessizlikler:', JSON.stringify(sil))
  const big = sil.find(s => s.start > spDur - 0.5 && s.end < spDur + gapA + 0.5)
  check(!!big && big.end - big.start > 0.7, `cümle arası boşluk bulundu (~${spDur.toFixed(2)}–${(spDur + gapA).toFixed(2)})`)
  const tail = sil[sil.length - 1]
  check(tail && Math.abs(tail.end - n / SR) < 0.02, 'sondaki sessizlik dosya sonuna kadar')
  const silA = await detectSilences(p, { thresholdDb: 'auto' })
  log('  otomatik eşik:', silA.length, 'aralık')
  // klip eşlemesi: in=0.5, hız 2, zaman çizelgesinde 10. sn'de
  const clip = { start: 10, in: 0.5, out: n / SR, duration: (n / SR - 0.5) / 2, speed: 2, speedCurve: null, reverse: false }
  const cuts = planSilenceCuts(clip, null, sil)
  log('  klip (başlangıç 10, giriş 0.5, hız 2×) kesimleri:', JSON.stringify(cuts))
  check(big && cuts.some(c => Math.abs(c.start - (10 + (big.start - 0.5) / 2)) < 0.01), 'kesim zaman çizelgesine doğru eşlendi')
  results.silence = { silences: sil, cuts }
}

// ================================================================ öne çıkan anlar
if (on('highlights')) {
  log('\n== Öne çıkan anlar')
  const total = 45, n = total * SR, x = new Float32Array(n)
  let seed = 3
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1 }
  for (let i = 0; i < n; i++) x[i] = 0.01 * rnd() + 0.02 * Math.sin(2 * Math.PI * 120 * i / SR) // oyun ortam sesi
  const events = [{ t: 6.2, a: 0.7 }, { t: 18.5, a: 0.9 }, { t: 19.1, a: 0.6 }, { t: 31.0, a: 0.5 }, { t: 40.3, a: 0.8 }]
  for (const ev of events) { const i0 = Math.round(ev.t * SR); for (let i = 0; i < 0.6 * SR; i++) x[i0 + i] += ev.a * Math.exp(-i / SR / 0.2) * rnd() }
  const p = nodePath.join(OUT, 'highlights.wav')
  writeWav(p, [x])
  const h = await detectHighlights(p, { count: 4, minGap: 5 })
  log('  ', JSON.stringify(h))
  check(h.length === 4 && [6.2, 18.5, 31.0, 40.3].every(t => h.some(e => Math.abs(e.time - t) < 0.6)), 'dört olay doğru zamanlarda')
  results.highlights = h
}

// ================================================================ yükseklik
if (on('loud')) {
  log('\n== Yükseklik (EBU R128)')
  const L = await loudness(speech)
  log('  tts.wav:', JSON.stringify(L))
  check(L.integrated < -5 && L.integrated > -40, 'entegre LUFS makul')
  results.loudness = L
}

nodeFs.writeFileSync(nodePath.join(OUT, 'node-results.json'), JSON.stringify(results, null, 1))
log(`\n${failures ? failures + ' HATA' : 'HEPSİ GEÇTİ'}  → ${nodePath.join(OUT, 'node-results.json')}`)
process.exit(failures ? 1 : 0)
