// Ses işleme hattı: hız (perde korumalı), perde, ses değiştirici, gürültü azaltma, yükseklik eşitleme ve ters çevirme
// ffmpeg ile önbelleğe yazılır; önizleme ve dışa aktarma AYNI dosyayı çalar.
// Her filtre zincirinin gecikmesi (rubberband, afftdn, arnndn…) bir deneme sinyaliyle ölçülüp telafi edilir →
// işlenmiş dosya kaynakla örnek hassasiyetinde hizalı kalır.

import { fs, path, run, cacheDir, hashString, appPaths } from '../platform/node.js'
import { get as regGet } from './registry.js'
import { sourceTime } from '../core/time.js'

export const SR = 48000
const VERSION = 8 // zincir biçimi değişince artır → eski önbellek kullanılmaz

const ffmpeg = () => appPaths().ffmpeg
const exists = p => { try { return fs.statSync(p).size > 0 } catch (e) { return false } }
const r6 = x => Math.round(x * 1e6) / 1e6

function hasCurve(clip) { return !!(clip.speedCurve && clip.speedCurve.points && clip.speedCurve.points.length) }

// ---------------------------------------------------------------- zincir
// Klibin sabit-zaman filtreleri (perde / ses değiştirici / gürültü) — aralık, ters çevirme ve loudnorm hariç
export function fxChainOf(clip, { tempo = 1, skipPitch = false } = {}) {
  const a = clip.audio || {}
  const parts = []
  const pitch = skipPitch ? 0 : (+a.pitch || 0)
  if (Math.abs(tempo - 1) > 1e-4 || Math.abs(pitch) > 1e-3) {
    // perde korumalı hız + yarım ton perde (formant korunur: doğal ses)
    parts.push(`rubberband=tempo=${r6(tempo)}:pitch=${r6(Math.pow(2, pitch / 12))}:formant=preserved:pitchq=quality:channels=together`)
  }
  if (a.voiceFx && a.voiceFx.id) {
    const fx = regGet('voiceFx', a.voiceFx.id)
    if (fx && typeof fx.ffmpeg === 'function') {
      const s = fx.ffmpeg(a.voiceFx.params || {})
      if (s) parts.push(s)
    }
  }
  const dn = Math.max(0, Math.min(100, +a.denoise || 0))
  if (dn > 0) parts.push(denoiseChain(dn))
  return parts.join(',')
}

// 0..100 → RNNoise (konuşma için en iyisi) + yüksek değerlerde FFT gürültü azaltma
export function denoiseChain(dn) {
  const model = rnnoiseModel()
  const out = ['highpass=f=60']
  if (model) {
    out.push(`arnndn=m=${model}:mix=${r6(Math.min(1, 0.25 + dn / 80))}`)
    if (dn > 55) out.push(`afftdn=nr=${r6(6 + (dn - 55) * 0.5)}:nf=-42:tn=1`)
  } else {
    out.push(`afftdn=nr=${r6(6 + dn * 0.3)}:nf=${r6(-50 + dn * 0.15)}:tn=1`)
  }
  return out.join(',')
}

// RNNoise modeli işleme klasörüne kopyalanır: ffmpeg filtre dizesinde "C:" yolu ayrıştırmayı bozar → göreli ad
let _rn
function rnnoiseModel() {
  if (_rn !== undefined) return _rn
  _rn = null
  try {
    const src = path.join(appPaths().vendor || path.join(appPaths().appRoot, 'vendor'), 'rnnoise', 'bd.rnnn')
    const dst = path.join(procDir(), 'rn_bd.rnnn')
    if (!exists(dst) && exists(src)) fs.copyFileSync(src, dst)
    if (exists(dst)) _rn = 'rn_bd.rnnn'
  } catch (e) { /* model yok → afftdn */ }
  return _rn
}

export function procDir() { return cacheDir('audio', 'proc') }

// ---------------------------------------------------------------- işlem tanımı
// null → işlem gerekmez (ham ses çalınır)
export function processSpec(clip, media) {
  if (!clip || !media || !media.audioPath || clip.freeze) return null
  const a = clip.audio || {}
  const curve = hasCurve(clip)
  const speed = clip.speed || 1
  const stretch = (curve || Math.abs(speed - 1) > 1e-4) && a.preservePitch !== false
  const reverse = !!clip.reverse
  const normalize = !!a.normalize
  const tempo = stretch && !curve ? speed : 1
  const isCurve = stretch && curve
  // eğride perde, parça başına rubberband'e katılır
  const fx = fxChainOf(clip, { tempo, skipPitch: isCurve })
  if (!stretch && !fx && !normalize && !reverse) return null
  const mediaDur = media.duration || 0
  let A, B, kind
  if (isCurve) {
    kind = 'curve'
    A = Math.min(clip.in || 0, clip.out); B = Math.max(clip.in || 0, clip.out)
  } else {
    kind = 'lin'
    // geçiş taşmaları için pay; 1 sn ızgaraya yuvarla → küçük kırpmalar aynı dosyayı kullanır
    const pad = 1.0 * Math.max(1, speed)
    A = Math.max(0, Math.floor((clip.in || 0) - pad))
    B = Math.ceil((clip.out || 0) + pad)
    if (mediaDur > 0) B = Math.min(B, mediaDur)
  }
  const curveSig = kind === 'curve' ? JSON.stringify([clip.speedCurve.points, r6(clip.duration), r6(clip.in), r6(clip.out), speed, +a.pitch || 0]) : ''
  const pkey = hashString([VERSION, media.audioPath, media.key || '', kind, kind === 'curve' ? 1 : r6(tempo), reverse, normalize, fx, curveSig].join('|'))
  return {
    pkey, kind, A, B, tempo, reverse, normalize, fx, stretch: stretch && !curve ? true : kind === 'curve',
    src: media.audioPath, label: clip.name || media.name || 'ses',
    // curve için zaman çizelgesi bilgisi
    clipDur: clip.duration, pitch: +a.pitch || 0, mediaDur,
    curveClip: kind === 'curve' ? { in: clip.in, out: clip.out, duration: clip.duration, speed, speedCurve: clip.speedCurve, reverse } : null,
  }
}

// İşlenmiş dosyada (meta) kaynak zamanı → dosya zamanı. Klip yerel zamanı curve için gerekir.
export function procTime(meta, srcT, localT) {
  if (meta.kind === 'curve') return localT * (meta.scale || 1)
  const p = meta.reverse ? (meta.B - srcT) : (srcT - meta.A)
  return (p / meta.tempo) * (meta.scale || 1)
}

// ---------------------------------------------------------------- dizin
const index = new Map() // pkey → [{A,B,path,meta}]
let scanned = false
function scan() {
  if (scanned || !fs) return
  scanned = true
  try {
    for (const f of fs.readdirSync(procDir())) {
      if (!f.endsWith('.json') || f === 'lag.json') continue
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(procDir(), f), 'utf8'))
        if (meta.v !== VERSION || !exists(meta.path)) continue
        addIndex(meta)
      } catch (e) { /* bozuk */ }
    }
  } catch (e) { /* klasör yok */ }
}
function addIndex(meta) {
  const arr = index.get(meta.pkey) || []
  if (!arr.some(x => x.path === meta.path)) arr.push(meta)
  index.set(meta.pkey, arr)
}

// Hazır işlenmiş dosya (aralığı kapsayan) — yoksa null
export function findProcessed(spec) {
  if (!spec || !fs) return null
  scan()
  const arr = index.get(spec.pkey)
  if (!arr) return null
  for (const m of arr) if (m.A <= spec.A + 1e-6 && m.B >= spec.B - 1e-6 && exists(m.path)) return m
  return null
}

// ---------------------------------------------------------------- gecikme ölçümü
const lagMem = new Map()
let lagDisk = null
function lagFile() { return path.join(procDir(), 'lag.json') }
function loadLagDisk() {
  if (lagDisk) return lagDisk
  try { lagDisk = JSON.parse(fs.readFileSync(lagFile(), 'utf8')) } catch (e) { lagDisk = {} }
  return lagDisk
}

// Deneme sinyali: düzensiz aralıklı, keskin atak + sönümlü harmonik vuruşlar (konuşma/müzik benzeri)
// aralar 1.3 sn+ → yankı efektlerinde önceki vuruşun yankısı ölçüm penceresine düşmez
const PROBE_HITS = [0.3, 1.65, 3.0, 4.4, 5.75, 7.1, 8.45]
const PROBE_DUR = 9.2
function probeSignal() {
  const n = Math.round(PROBE_DUR * SR)
  const x = new Float32Array(n)
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1 }
  for (const [k, h] of PROBE_HITS.entries()) {
    const f0 = 140 + k * 23
    const i0 = Math.round(h * SR)
    for (let i = 0; i < 0.16 * SR && i0 + i < n; i++) {
      const t = i / SR
      const env = Math.exp(-t / 0.035)
      let s = 0
      for (let hm = 1; hm <= 12; hm++) s += Math.sin(2 * Math.PI * f0 * hm * t) / hm
      x[i0 + i] += env * (0.45 * s + 0.25 * rnd())
    }
  }
  return x
}
let _probePath = null
function probePath() {
  if (_probePath && exists(_probePath)) return _probePath
  const p = path.join(procDir(), 'probe_v2.wav')
  if (!exists(p)) fs.writeFileSync(p, encodeWav([probeSignal()], SR, 32))
  _probePath = p
  return p
}

function envelope(f, hop) {
  const n = Math.floor(f.length / hop)
  const e = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < hop; j++) { const v = f[i * hop + j]; s += v * v }
    e[i] = Math.sqrt(s / hop)
  }
  return e
}

// Zincirin çıkış gecikmesi (sn, + = geç). tempo: zincirin hız çarpanı (çıkış zamanı = giriş / tempo)
export async function measureLag(chain, tempo = 1) {
  if (!chain) return 0
  const key = chain + '|' + r6(tempo)
  if (lagMem.has(key)) return lagMem.get(key)
  const disk = loadLagDisk()
  if (disk[key] != null) { lagMem.set(key, disk[key]); return disk[key] }
  const p = (async () => {
    const r = await run(ffmpeg(), ['-v', 'error', '-i', probePath(), '-af', chain + ',aformat=sample_fmts=fltp,aresample=' + SR, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { cwd: procDir() })
    if (r.code !== 0 || !r.buf) return 0
    const out = new Float32Array(r.buf.buffer.slice(r.buf.byteOffset, r.buf.byteOffset + (r.buf.length & ~3)))
    // her vuruşun atak anı (yerel tepenin %30'unu ilk geçtiği an) → girişle fark → medyan
    const hop = 24 // 0.5 ms
    const ein = envelope(probeSignal(), hop), eout = envelope(out, hop)
    const fps = SR / hop
    const attack = (e, center, half) => {
      const a = Math.max(0, Math.round((center - half) * fps)), z = Math.min(e.length - 1, Math.round((center + half) * fps))
      let pk = 0
      for (let i = a; i <= z; i++) if (e[i] > pk) pk = e[i]
      if (pk < 1e-4) return null
      for (let i = a; i <= z; i++) if (e[i] >= 0.3 * pk) return i / fps
      return null
    }
    const lags = []
    for (const h of PROBE_HITS) {
      const ti = attack(ein, h + 0.05, 0.1)
      const to = ti == null ? null : attack(eout, ti / tempo, 0.07)
      if (to != null) lags.push(to - ti / tempo)
    }
    if (lags.length < 3) return 0
    lags.sort((x, y) => x - y)
    let lag = lags[lags.length >> 1]
    if (Math.abs(lag) < 0.002) lag = 0
    return Math.round(lag * 1e5) / 1e5
  })()
  lagMem.set(key, p)
  const v = await p
  lagMem.set(key, v)
  const d = loadLagDisk(); d[key] = v
  try { fs.writeFileSync(lagFile(), JSON.stringify(d)) } catch (e) { /* */ }
  return v
}

// ---------------------------------------------------------------- iş kuyruğu
const jobs = new Map() // jobKey → { promise, progress, label }
const waiting = []
let active = 0
const MAX_ACTIVE = 2
let onEvent = () => {}
export function setProcessListener(fn) { onEvent = fn || (() => {}) }

export function processingJobs() {
  return [...jobs.entries()].map(([key, j]) => ({ key, label: j.label, progress: j.progress, pkey: j.pkey }))
}

function jobKey(spec) { return spec.pkey + '_' + Math.round(spec.A * 1000) + '_' + Math.round(spec.B * 1000) }

// İşlenmiş dosyayı hazırla (varsa hemen döner). Dönen: meta { path, kind, A, B, tempo, reverse, scale, ... }
// keep: dışa aktarma gibi iptal edilmemesi gereken istekler (pruneQueue dokunmaz)
export function ensureProcessed(spec, { keep = false } = {}) {
  const ready = findProcessed(spec)
  if (ready) return Promise.resolve(ready)
  const k = jobKey(spec)
  const ex = jobs.get(k)
  if (ex) { if (keep) ex.keep = true; return ex.promise }
  const job = { label: spec.label, progress: 0, pkey: spec.pkey, keep }
  job.promise = new Promise((resolve, reject) => {
    waiting.push({ pkey: spec.pkey, job, run: () => runJob(spec, job), resolve, reject })
    pump()
  }).finally(() => { jobs.delete(k) })
  jobs.set(k, job)
  onEvent('queued', { key: k, pkey: spec.pkey, label: spec.label })
  return job.promise
}

// Projede artık kullanılmayan (henüz başlamamış) işleri iptal et
export function pruneQueue(validPkeys) {
  for (let i = waiting.length - 1; i >= 0; i--) {
    if (validPkeys.has(waiting[i].pkey) || waiting[i].job.keep) continue
    const w = waiting.splice(i, 1)[0]
    w.reject(Object.assign(new Error('ses işleme iptal edildi'), { cancelled: true }))
  }
}

function pump() {
  while (active < MAX_ACTIVE && waiting.length) {
    const w = waiting.shift()
    active++
    Promise.resolve().then(w.run).then(w.resolve, w.reject).finally(() => { active--; pump() })
  }
}

async function runJob(spec, job) {
  const dir = procDir()
  const base = `${spec.pkey}_${Math.round(spec.A * 1000)}_${Math.round(spec.B * 1000)}`
  const out = path.join(dir, base + '.flac')
  const tmp = path.join(dir, base + '.tmp.flac')
  const span = Math.max(0.01, spec.B - spec.A)
  const pre = []
  if (spec.reverse) pre.push('areverse')
  if (spec.kind === 'curve') return runCurveJob(spec, job, { dir, base, out, tmp })
  const expected = span / spec.tempo
  const N = Math.round(expected * SR)
  const chain = spec.fx
  const lag = chain ? await measureLag(chain, spec.tempo) : 0

  // loudnorm 1. geçiş (ölçüm)
  let norm = ''
  if (spec.normalize) {
    const f1 = [...pre, chain].filter(Boolean).join(',')
    const r1 = await run(ffmpeg(), ['-hide_banner', '-nostats', '-v', 'info', '-ss', String(spec.A), '-to', String(spec.B), '-i', spec.src,
      '-af', (f1 ? f1 + ',' : '') + 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { cwd: dir })
    const j = parseLoudnormJson(r1.err)
    if (j && isFinite(+j.input_i) && +j.input_i > -70) {
      norm = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`
    }
  }

  const filters = [...pre]
  filters.push('apad=pad_dur=0.6')
  if (chain) filters.push(chain, 'aformat=sample_fmts=fltp')
  if (norm) filters.push(norm)
  filters.push('aresample=' + SR)
  if (lag > 0) filters.push(`atrim=start=${r6(lag)}`, 'asetpts=PTS-STARTPTS')
  else if (lag < 0) filters.push(`adelay=delays=${r6(-lag * 1000)}:all=1`)
  filters.push('apad', `atrim=end_sample=${N}`)
  // FX taşmalarına karşı şeffaf sınırlayıcı (gecikme telafili)
  filters.push('alimiter=limit=0.995:attack=2:release=40:level=false:latency=true', 'asetpts=PTS-STARTPTS')

  const args = ['-y', '-v', 'error', '-progress', 'pipe:2', '-ss', String(spec.A), '-to', String(spec.B), '-i', spec.src,
    '-af', filters.join(','), '-ac', '2', '-ar', String(SR), '-c:a', 'flac', '-sample_fmt', 's32', '-compression_level', '1', tmp]
  return finishJob(spec, job, { dir, base, out, tmp, args, expected, lag })
}

async function finishJob(spec, job, { dir, base, out, tmp, args, expected, lag }) {
  const r = await run(ffmpeg(), args, {
    cwd: dir,
    onStderr: s => {
      const m = /out_time_us=(\d+)/.exec(s)
      if (m) { job.progress = Math.min(1, (+m[1] / 1e6) / expected); onEvent('progress', { key: jobKey(spec), pkey: spec.pkey, progress: job.progress, label: spec.label }) }
    },
  })
  if (r.code !== 0) {
    try { fs.unlinkSync(tmp) } catch (e) { /* */ }
    const err = new Error('ses işleme başarısız: ' + (r.err || '').slice(-400))
    onEvent('error', { key: jobKey(spec), pkey: spec.pkey, error: err.message })
    throw err
  }
  fs.renameSync(tmp, out)
  // gerçek süre → küçük ölçek düzeltmesi (curve için asıl hizalama budur)
  const actual = await fileDuration(out)
  let scale = 1
  if (actual > 0 && expected > 0) {
    scale = actual / expected
    if (Math.abs(scale - 1) < 2e-4) scale = 1
  }
  const meta = { v: VERSION, pkey: spec.pkey, path: out, kind: spec.kind, A: spec.A, B: spec.B, tempo: spec.tempo, reverse: spec.reverse, scale, lag, expected, actual, created: Date.now() }
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(meta))
  addIndex(meta)
  job.progress = 1
  onEvent('processed', { key: jobKey(spec), pkey: spec.pkey, path: out, meta })
  return meta
}

// Hız eğrisi: klip ~0.2 sn'lik parçalara bölünür, her parça SABİT hızla (rubberband, gecikme telafili, kesin uzunluk)
// işlenir, 10 ms çapraz geçişle birleştirilir → zaman haritası parça sınırlarında örnek hassasiyetinde doğru.
const XF = 480 // çapraz geçiş (örnek)
async function runCurveJob(spec, job, { dir, base, out, tmp }) {
  const c = spec.curveClip
  const D = c.duration
  const nSeg = Math.max(1, Math.min(120, Math.round(D / 0.2)))
  const pf = r6(Math.pow(2, (spec.pitch || 0) / 12))
  const rb = k => `rubberband=tempo=${r6(k)}:pitch=${pf}:formant=preserved:pitchq=quality:channels=together`
  const mo = 0.06 // çıkış payı (sn): rubberband ısınması
  const segs = []
  for (let j = 0; j < nSeg; j++) {
    const l0 = (j / nSeg) * D, l1 = ((j + 1) / nSeg) * D
    const sa = sourceTime(c, l0), sb = sourceTime(c, l1)
    const k = Math.max(0.02, Math.min(50, Math.abs(sb - sa) / Math.max(1e-6, l1 - l0)))
    const n = Math.round(l1 * SR) - Math.round(l0 * SR)
    segs.push({ sa, sb, k, n, lag: await lagForTempo(k, pf, rb) })
  }
  const lines = [`[0:a]asplit=${nSeg}${segs.map((_, j) => `[i${j}]`).join('')}`]
  segs.forEach((g, j) => {
    const lo = Math.min(g.sa, g.sb) - spec.A, hi = Math.max(g.sa, g.sb) - spec.A
    const mi = mo * g.k
    const a = Math.max(0, lo - mi), b = hi + mi
    // çıkış başındaki pay: ileri klipte lo'dan, ters klipte (girdi ters çevrilir) hi'dan önceki kısım
    const preOut = (c.reverse ? (b - hi) : (lo - a)) / g.k
    const left = j > 0 ? XF / 2 : 0, right = j < nSeg - 1 ? XF / 2 : 0
    const startS = Math.max(0, Math.round(preOut * SR) - left)
    const f = [`atrim=start=${r6(a)}:end=${r6(b)}`, 'asetpts=PTS-STARTPTS']
    if (c.reverse) f.push('areverse')
    f.push('apad=pad_dur=0.3', rb(g.k), 'aformat=sample_fmts=fltp', 'aresample=' + SR)
    if (g.lag > 0) f.push(`atrim=start=${r6(g.lag)}`, 'asetpts=PTS-STARTPTS')
    else if (g.lag < 0) f.push(`adelay=delays=${r6(-g.lag * 1000)}:all=1`)
    f.push('apad', `atrim=start_sample=${startS}:end_sample=${startS + left + g.n + right}`, 'asetpts=PTS-STARTPTS')
    lines.push(`[i${j}]${f.join(',')}[o${j}]`)
  })
  let last = 'o0'
  for (let j = 1; j < nSeg; j++) { lines.push(`[${last}][o${j}]acrossfade=ns=${XF}:c1=tri:c2=tri[x${j}]`); last = 'x' + j }
  const N = Math.round(D * SR)
  const fxLag = spec.fx ? await measureLag(spec.fx, 1) : 0
  const tail = []
  if (spec.fx) tail.push('apad=pad_dur=0.6', spec.fx, 'aformat=sample_fmts=fltp', 'aresample=' + SR)
  if (fxLag > 0) tail.push(`atrim=start=${r6(fxLag)}`, 'asetpts=PTS-STARTPTS')
  else if (fxLag < 0) tail.push(`adelay=delays=${r6(-fxLag * 1000)}:all=1`)
  const head = lines.join(';\n') + `;\n[${last}]`
  let norm = ''
  if (spec.normalize) {
    fs.writeFileSync(path.join(dir, base + '.n.fg'), head + [...tail, 'anull', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json'].join(',') + '[out]')
    const r1 = await run(ffmpeg(), ['-hide_banner', '-nostats', '-v', 'info', '-ss', String(spec.A), '-to', String(spec.B), '-i', spec.src, '-filter_complex_script', base + '.n.fg', '-map', '[out]', '-f', 'null', '-'], { cwd: dir })
    const jn = parseLoudnormJson(r1.err)
    if (jn && isFinite(+jn.input_i) && +jn.input_i > -70) norm = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${jn.input_i}:measured_TP=${jn.input_tp}:measured_LRA=${jn.input_lra}:measured_thresh=${jn.input_thresh}:offset=${jn.target_offset}:linear=true,aresample=${SR}`
  }
  const fin = ['anull', ...tail, ...(norm ? [norm] : []), 'apad', `atrim=end_sample=${N}`, 'alimiter=limit=0.995:attack=2:release=40:level=false:latency=true', 'asetpts=PTS-STARTPTS']
  const fg = base + '.fg'
  fs.writeFileSync(path.join(dir, fg), head + fin.join(',') + '[out]')
  const args = ['-y', '-v', 'error', '-progress', 'pipe:2', '-ss', String(spec.A), '-to', String(spec.B), '-i', spec.src,
    '-filter_complex_script', fg, '-map', '[out]', '-ac', '2', '-ar', String(SR), '-c:a', 'flac', '-sample_fmt', 's32', '-compression_level', '1', tmp]
  return finishJob(spec, job, { dir, base, out, tmp, args, expected: D, lag: fxLag })
}

// rubberband gecikmesi hıza bağlı: log-ızgarada ölçülüp (diskte önbellekli) ara değerlenir
const TEMPO_GRID = [0.05, 0.08, 0.125, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4, 5.6, 8, 12, 18, 27, 40, 50]
async function lagForTempo(k, pf, rb) {
  let i = TEMPO_GRID.findIndex(g => g >= k)
  if (i < 0) i = TEMPO_GRID.length - 1
  if (i === 0 || Math.abs(TEMPO_GRID[i] - k) < 1e-6) return measureLag(rb(TEMPO_GRID[i]), TEMPO_GRID[i])
  const g0 = TEMPO_GRID[i - 1], g1 = TEMPO_GRID[i]
  const l0 = await measureLag(rb(g0), g0)
  const l1 = await measureLag(rb(g1), g1)
  const x = Math.log(k / g0) / Math.log(g1 / g0)
  return l0 + (l1 - l0) * x
}

export function parseLoudnormJson(err) {
  if (!err) return null
  const i = err.lastIndexOf('{'), j = err.lastIndexOf('}')
  if (i < 0 || j < i) return null
  try { return JSON.parse(err.slice(i, j + 1)) } catch (e) { return null }
}

// ffprobe ile süre (örnek sayısından, kesin)
export async function fileDuration(p) {
  const r = await run(appPaths().ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration_ts,sample_rate,duration', '-of', 'json', p])
  try {
    const s = JSON.parse(r.out).streams[0]
    if (s.duration_ts && s.sample_rate) return +s.duration_ts / +s.sample_rate
    return +s.duration || 0
  } catch (e) { return 0 }
}

// ---------------------------------------------------------------- WAV
// channels: Float32Array[]; bits 16 (TPDF titreşimli) | 24 | 32 (float)
export function encodeWav(channels, sampleRate = SR, bits = 32) {
  const nc = channels.length
  const n = channels[0] ? channels[0].length : 0
  const bps = bits / 8
  const dataBytes = n * nc * bps
  const fmtTag = bits === 32 ? 3 : 1
  const head = bits === 32 ? 58 : 44
  const buf = Buffer.alloc(head + dataBytes)
  let o = 0
  const w4 = s => { buf.write(s, o, 'ascii'); o += 4 }
  w4('RIFF'); buf.writeUInt32LE(head - 8 + dataBytes, o); o += 4; w4('WAVE')
  w4('fmt '); buf.writeUInt32LE(bits === 32 ? 18 : 16, o); o += 4
  buf.writeUInt16LE(fmtTag, o); o += 2
  buf.writeUInt16LE(nc, o); o += 2
  buf.writeUInt32LE(sampleRate, o); o += 4
  buf.writeUInt32LE(sampleRate * nc * bps, o); o += 4
  buf.writeUInt16LE(nc * bps, o); o += 2
  buf.writeUInt16LE(bits, o); o += 2
  if (bits === 32) { buf.writeUInt16LE(0, o); o += 2; w4('fact'); buf.writeUInt32LE(4, o); o += 4; buf.writeUInt32LE(n, o); o += 4 }
  w4('data'); buf.writeUInt32LE(dataBytes, o); o += 4
  if (bits === 32) {
    // başlık 58 bayt → hizasız; ayrı dizide karıştırıp kopyala
    const f = new Float32Array(n * nc)
    for (let c = 0; c < nc; c++) { const ch = channels[c]; for (let i = 0; i < n; i++) f[i * nc + c] = ch[i] }
    Buffer.from(f.buffer, f.byteOffset, f.byteLength).copy(buf, o)
  } else if (bits === 24) {
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
      const v = Math.max(-8388608, Math.min(8388607, Math.round(channels[c][i] * 8388607)))
      buf.writeIntLE(v, o, 3); o += 3
    }
  } else {
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
      const d = (Math.random() - Math.random()) // TPDF titreşim (1 LSB)
      const v = Math.max(-32768, Math.min(32767, Math.round(channels[c][i] * 32767 + d)))
      buf.writeInt16LE(v, o); o += 2
    }
  }
  return buf
}
