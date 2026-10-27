// Metin okuma (TTS) — tamamen ÇEVRİMDIŞI, açık kaynak.
// 1) Piper (rhasspy/piper, MIT) + ONNX sesler (gömülü Türkçe "Fahrettin", diğerleri isteğe bağlı indirilir)
// 2) Windows OneCore sesleri (Türkçe "Tolga"), 3) System.Speech (son çare)
//
// synthesize(text, { voice, rate, noise, pitch, volume }) → { path (48 kHz mono WAV), duration, words:[{w,s,e}] }
// Piper kelime zamanı vermez: cümle başına ayrı sentezlenir, kelimeler enerji tabanlı hizalamayla yerleştirilir.

import { fs, path, run, appPaths, cacheDir, hashString, crypto } from '../../platform/node.js'
import { measureLag } from '../../engine/audio-process.js'
import { PIPER_VOICES, LANG_NAMES } from './voices.js'
import { splitSentences, alignSentence, estimateWords } from './align.js'
import { listWindowsVoices, synthWindows } from './windows.js'

const OUT_SR = 48000
const VERSION = 2
const exists = p => { try { return fs.statSync(p).size > 0 } catch (e) { return false } }

export function vendorDir() { const p = appPaths(); return p.vendor || path.join(p.appRoot, 'vendor') }
const isWin = typeof process !== 'undefined' && process.platform === 'win32'
export function piperExe() { return path.join(vendorDir(), 'piper', isWin ? 'piper.exe' : 'piper') }
export function bundledVoiceDir() { return path.join(vendorDir(), 'piper', 'voices') }
export function userVoiceDir() { const d = path.join(appPaths().userData, 'models', 'piper'); try { fs.mkdirSync(d, { recursive: true }) } catch (e) { /* */ } return d }

function piperModelPath(id) {
  for (const dir of [bundledVoiceDir(), userVoiceDir()]) {
    const p = path.join(dir, id + '.onnx')
    if (exists(p) && exists(p + '.json')) return p
  }
  return null
}

export function piperAvailable() { return !!fs && exists(piperExe()) }

// ---------------------------------------------------------------- sesler
export async function listVoices({ refresh = false } = {}) {
  if (!fs) return []
  const out = []
  const piperOk = piperAvailable()
  for (const v of PIPER_VOICES) {
    const model = piperModelPath(v.id)
    out.push({
      id: 'piper:' + v.id, engine: 'piper', name: v.name, lang: v.lang.replace('_', '-'), langName: LANG_NAMES[v.lang] || v.lang,
      gender: v.gender, quality: v.quality, size: v.size, license: v.license, commercial: v.commercial !== false,
      bundled: !!v.bundled, installed: !!model && piperOk, downloadable: piperOk && !model, speakers: v.speakers || 1,
    })
  }
  try {
    for (const v of await listWindowsVoices({ refresh })) out.push({ ...v, langName: LANG_NAMES[v.lang.replace('-', '_')] || v.lang, downloadable: false })
  } catch (e) { /* Windows dışı */ }
  return out
}

// Varsayılan: kurulu Türkçe Piper sesi → Türkçe Windows sesi → ilk kurulu ses
export async function defaultVoice(lang = 'tr-TR') {
  const all = await listVoices()
  const inst = all.filter(v => v.installed)
  return inst.find(v => v.engine === 'piper' && v.lang === lang) || inst.find(v => v.lang === lang) || inst[0] || null
}

// İsteğe bağlı ses indirme: <userData>/models/piper/<id>.onnx (+ .json), boyut ve özet (md5/sha256) doğrulamalı
export async function downloadVoice(id, onProgress, { signal } = {}) {
  const key = String(id).replace(/^piper:/, '')
  const v = PIPER_VOICES.find(x => x.id === key)
  if (!v) throw new Error('bilinmeyen ses: ' + id)
  const dir = userVoiceDir()
  const onnx = path.join(dir, key + '.onnx')
  if (piperModelPath(key)) return onnx
  await fetchTo(v.jsonUrl, onnx + '.json', null, signal)
  await fetchTo(v.url, onnx, (got, total) => onProgress && onProgress(got / (total || v.size), got, total || v.size), signal, v)
  return onnx
}

export function deleteVoice(id) {
  const key = String(id).replace(/^piper:/, '')
  const p = path.join(userVoiceDir(), key + '.onnx')
  for (const f of [p, p + '.json']) { try { fs.unlinkSync(f) } catch (e) { /* */ } }
}

async function fetchTo(url, out, onProgress, signal, verify) {
  const res = await fetch(url, { signal, redirect: 'follow' })
  if (!res.ok) throw new Error('indirme başarısız (' + res.status + '): ' + url)
  const total = +res.headers.get('content-length') || 0
  const tmp = out + '.part'
  const fd = fs.openSync(tmp, 'w')
  const md5 = verify && verify.md5 ? crypto.createHash('md5') : null
  const sha = verify && verify.sha256 ? crypto.createHash('sha256') : null
  let got = 0, last = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const b = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      fs.writeSync(fd, b)
      if (md5) md5.update(b)
      if (sha) sha.update(b)
      got += b.length
      const now = Date.now()
      if (onProgress && now - last > 120) { last = now; onProgress(got, total) }
    }
  } finally { fs.closeSync(fd) }
  if (verify) {
    if (verify.size && got !== verify.size) { fs.unlinkSync(tmp); throw new Error('indirilen dosya boyutu tutmuyor') }
    if (md5 && md5.digest('hex') !== verify.md5) { fs.unlinkSync(tmp); throw new Error('md5 doğrulaması başarısız') }
    if (sha && sha.digest('hex') !== verify.sha256) { fs.unlinkSync(tmp); throw new Error('sha256 doğrulaması başarısız') }
  }
  try { fs.unlinkSync(out) } catch (e) { /* */ }
  fs.renameSync(tmp, out)
  if (onProgress) onProgress(got, total || got)
}

// ---------------------------------------------------------------- WAV okuma (16-bit PCM / 32-bit float)
export function readWavMono(buf) {
  let o = 12, fmt = null, data = null
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4), size = buf.readUInt32LE(o + 4)
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(o + 8), ch: buf.readUInt16LE(o + 10), sr: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22) }
    else if (id === 'data') { data = { off: o + 8, size: Math.min(size, buf.length - o - 8) }; break }
    o += 8 + size + (size & 1)
  }
  if (!fmt || !data) throw new Error('WAV okunamadı')
  const bps = fmt.bits / 8, n = Math.floor(data.size / (bps * fmt.ch))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < fmt.ch; c++) {
      const p = data.off + (i * fmt.ch + c) * bps
      s += fmt.tag === 3 ? buf.readFloatLE(p) : fmt.bits === 16 ? buf.readInt16LE(p) / 32768 : fmt.bits === 24 ? buf.readIntLE(p, 3) / 8388608 : (buf[p] - 128) / 128
    }
    out[i] = s / fmt.ch
  }
  return { pcm: out, sr: fmt.sr }
}

function writeWavFloat(p, pcm, sr) {
  const n = pcm.length, head = Buffer.alloc(44)
  head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(36 + n * 4, 4); head.write('WAVEfmt ', 8, 'ascii')
  head.writeUInt32LE(16, 16); head.writeUInt16LE(3, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(sr, 24)
  head.writeUInt32LE(sr * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(32, 34); head.write('data', 36, 'ascii'); head.writeUInt32LE(n * 4, 40)
  fs.writeFileSync(p, Buffer.concat([head, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]))
}

// ---------------------------------------------------------------- sentez
const inflight = new Map()

export async function synthesize(text, opts = {}) {
  if (!fs) throw new Error('metin okuma yalnız masaüstü uygulamada çalışır')
  text = String(text || '').trim()
  if (!text) throw new Error('metin boş')
  const all = await listVoices()
  let voice = opts.voice ? all.find(v => v.id === opts.voice || v.id === 'piper:' + opts.voice || v.rawId === opts.voice || v.name === opts.voice) : null
  if (voice && !voice.installed) {
    if (voice.engine === 'piper' && voice.downloadable && opts.autoDownload) await downloadVoice(voice.id, opts.onProgress)
    else voice = null
  }
  if (!voice) voice = await defaultVoice(opts.lang || 'tr-TR')
  if (!voice) throw new Error('kullanılabilir ses yok')
  const o = {
    rate: clamp(+opts.rate || 1, 0.3, 3), noise: opts.noise == null ? 0.667 : clamp(+opts.noise, 0, 1.5),
    noiseW: opts.noiseW == null ? 0.8 : clamp(+opts.noiseW, 0, 1.5), pitch: clamp(+opts.pitch || 0, -12, 12),
    volume: opts.volume == null ? 1 : clamp(+opts.volume, 0, 4), pause: opts.pause == null ? 0.32 : clamp(+opts.pause, 0, 3),
    speaker: opts.speaker | 0,
  }
  const key = hashString(JSON.stringify([VERSION, text, voice.id, o]))
  const outDir = cacheDir('tts')
  const out = path.join(outDir, key + '.wav'), metaP = path.join(outDir, key + '.json')
  if (exists(out) && exists(metaP)) {
    try { return { ...JSON.parse(fs.readFileSync(metaP, 'utf8')), path: out, cached: true } } catch (e) { /* yeniden üret */ }
  }
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    const work = cacheDir('tts', 'work', key)
    try {
      let pcm, sr, words
      if (voice.engine === 'piper') ({ pcm, sr, words } = await synthPiper(text, voice, o, work))
      else ({ pcm, sr, words } = await synthWin(text, voice, o, work))
      const raw = path.join(work, 'mix.wav')
      writeWavFloat(raw, pcm, sr)
      const duration = await finalize(raw, out, pcm.length / sr, o)
      const meta = { duration, words, voice: voice.id, engine: voice.engine, text, sampleRate: OUT_SR }
      fs.writeFileSync(metaP, JSON.stringify(meta))
      return { ...meta, path: out }
    } finally {
      try { fs.rmSync(work, { recursive: true, force: true }) } catch (e) { /* */ }
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, isFinite(x) ? x : a)) }

async function synthPiper(text, voice, o, work) {
  const model = piperModelPath(voice.id.replace(/^piper:/, ''))
  if (!model) throw new Error('ses modeli bulunamadı: ' + voice.id)
  const sents = splitSentences(text)
  // çıkış dosyaları göreli: Piper JSON girdisindeki mutlak yolları bozuk birleştiriyor
  const lines = sents.map((s, i) => JSON.stringify({ text: s.text, output_file: `s${i}.wav`, ...(voice.speakers > 1 ? { speaker_id: o.speaker } : {}) })).join('\n') + '\n'
  const args = ['--model', model, '--config', model + '.json', '--json-input', '--sentence_silence', '0',
    '--length_scale', (1 / o.rate).toFixed(4), '--noise_scale', o.noise.toFixed(3), '--noise_w', o.noiseW.toFixed(3), '-q']
  const r = await run(piperExe(), args, { cwd: work, input: Buffer.from(lines, 'utf8') })
  if (r.code !== 0) throw new Error('Piper hatası (' + r.code + '): ' + (r.err || '').slice(-300))
  const parts = []
  let sr = 22050
  for (let i = 0; i < sents.length; i++) {
    const f = path.join(work, `s${i}.wav`)
    if (!exists(f)) continue
    const w = readWavMono(fs.readFileSync(f))
    sr = w.sr
    parts.push({ pcm: w.pcm, sent: sents[i] })
  }
  if (!parts.length) throw new Error('Piper ses üretmedi')
  return joinSentences(parts, sr, o.pause)
}

// Cümleleri duraklamalarla birleştir; baştaki/sondaki fazla sessizliği kırp, kelimeleri yerleştir
function joinSentences(parts, sr, pause) {
  const chunks = [], words = []
  let t = 0
  parts.forEach((p, i) => {
    const al = alignSentence(p.pcm, sr, p.sent.text)
    const a = Math.max(0, Math.floor((al.speechStart - 0.06) * sr))
    const b = Math.min(p.pcm.length, Math.ceil((al.speechEnd + 0.08) * sr))
    const seg = p.pcm.subarray(a, b)
    const off = t - a / sr
    for (const w of al.words) words.push({ w: w.w, s: round3(w.s + off), e: round3(w.e + off) })
    chunks.push(seg)
    t += seg.length / sr
    if (i < parts.length - 1) {
      const gap = Math.round((p.sent.paragraphEnd ? pause * 1.7 : pause) * sr)
      chunks.push(new Float32Array(gap))
      t += gap / sr
    }
  })
  const n = chunks.reduce((x, c) => x + c.length, 0)
  const pcm = new Float32Array(n)
  let o = 0
  for (const c of chunks) { pcm.set(c, o); o += c.length }
  return { pcm, sr, words }
}

async function synthWin(text, voice, o, work) {
  const { wav, cues } = await synthWindows(voice, text, { rate: o.rate, workDir: work })
  const w = readWavMono(fs.readFileSync(wav))
  let words
  if (cues && cues.length) words = cues.filter(c => /[\p{L}\d]/u.test(c.text)).map(c => ({ w: c.text, s: round3(c.s), e: round3(c.e) }))
  else {
    const al = alignSentence(w.pcm, w.sr, text)
    words = al.words.length ? al.words.map(x => ({ w: x.w, s: round3(x.s), e: round3(x.e) })) : estimateWords(text, w.pcm.length / w.sr)
  }
  return { pcm: w.pcm, sr: w.sr, words }
}

const round3 = x => Math.round(x * 1000) / 1000

// 48 kHz'e çevir, perde (rubberband, gecikme telafili — kelime zamanları kaymaz) ve ses seviyesi uygula
async function finalize(raw, out, dur, o) {
  const N = Math.round(dur * OUT_SR)
  const f = ['aresample=' + OUT_SR]
  if (Math.abs(o.pitch) > 0.01) {
    const pc = `rubberband=pitch=${Math.pow(2, o.pitch / 12).toFixed(5)}:formant=preserved:pitchq=quality`
    const lag = await measureLag(pc, 1)
    f.push('apad=pad_dur=0.5', pc)
    if (lag > 0) f.push(`atrim=start=${lag}`, 'asetpts=PTS-STARTPTS')
    else if (lag < 0) f.push(`adelay=delays=${-lag * 1000}:all=1`)
  }
  if (Math.abs(o.volume - 1) > 1e-3) f.push(`volume=${o.volume.toFixed(3)}`)
  f.push('apad', `atrim=end_sample=${N}`, 'alimiter=limit=0.98:level=false:latency=true')
  const tmp = out + '.tmp.wav'
  const r = await run(appPaths().ffmpeg, ['-y', '-v', 'error', '-i', raw, '-af', f.join(','), '-ac', '1', '-ar', String(OUT_SR), '-c:a', 'pcm_s16le', tmp])
  if (r.code !== 0) throw new Error('TTS son işlem hatası: ' + (r.err || '').slice(-300))
  try { fs.unlinkSync(out) } catch (e) { /* */ }
  fs.renameSync(tmp, out)
  return N / OUT_SR
}
