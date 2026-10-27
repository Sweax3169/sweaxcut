// Ses motoru — önizlemenin ANA SAATİ ve dışa aktarma miksajı (aynı grafik kodu).
//
// Klip grafiği: kaynak(lar) → [3 bant EQ] → [netleştirme: alçak kesim + varlık + kompresör] → zarf (ses ×
// anahtar kare × giriş/çıkış × geçiş × ducking) → stereo pan → iz yolu → ana çıkış → yumuşak sınırlayıcı → hoparlör.
// Hız (perde korumalı), perde, ses değiştirici, gürültü azaltma, normalize ve ters çevirme işlenmiş dosyaya
// yazılır (audio-process.js); hazır olana kadar ham ses çalar, hazır olunca kesintisiz yeniden planlanır.
//
// Kullanım (önizleme): audioEngine.start(project, t) / stop() / now() / update(project) / scrub(project, t)
// Dışa aktarma: await renderProjectAudio(project, { start, end }) → AudioBuffer, writeWav(buffer, yol)

import { fs, run, appPaths } from '../platform/node.js'
import { sourceTime, instantSpeed } from '../core/time.js'
import { prop, hasKeys } from '../core/keyframes.js'
import { transitionWindow, projectDuration } from '../core/timeline.js'
import { processSpec, findProcessed, ensureProcessed, procTime, setProcessListener, processingJobs, pruneQueue, encodeWav, fileDuration, SR } from './audio-process.js'

export { SR }

// ---------------------------------------------------------------- ayarlar
export const AUDIO_DEFAULTS = {
  duck: { amount: 0.25, thresholdDb: -32, attack: 0.08, release: 0.45, hold: 0.25, lookahead: 0.06 }, // −12 dB
  envRate: 100,         // zarf örnekleme (Hz)
  declick: 0.004,       // klip kenarı tık önleme rampası (sn)
  horizon: 12,          // bu kadar saniye ilerisi planlanır
  lookahead: 0.04,      // başlatma gecikmesi (sn)
  xfade: 0.02,          // yeniden planlamada çapraz geçiş
  memCap: 1.2e9,        // çözülmüş ses belleği (bayt)
  wholeMaxSec: 600,     // bundan uzun dosyalar parça parça çözülür
  chunkSec: 60,
  enhanceLatency: 0.006, // Chromium DynamicsCompressor ön gecikmesi
}
const D = AUDIO_DEFAULTS
const REV = '::rev'

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x
const fadeCurve = x => { const s = Math.sin(clamp01(x) * Math.PI / 2); return s * s } // yükseltilmiş kosinüs
export const dbfs = x => x > 1e-9 ? 20 * Math.log10(x) : -180
const exists = p => { try { return !!fs && fs.statSync(p).size > 0 } catch (e) { return false } }

// Yumuşak sınırlayıcı: |x| ≤ 0.9 dokunmaz, üstü 1.0'a yumuşakça yaklaşır (önizleme WaveShaper ile birebir aynı)
export function softClip(y) {
  const a = Math.abs(y)
  if (a <= 0.9) return y
  return Math.sign(y) * (0.9 + 0.1 * Math.tanh((a - 0.9) / 0.1))
}

// ---------------------------------------------------------------- olay yayıcı
class Emitter {
  constructor() { this._ev = new Map() }
  on(evt, fn) { if (!this._ev.has(evt)) this._ev.set(evt, new Set()); this._ev.get(evt).add(fn); return () => this.off(evt, fn) }
  off(evt, fn) { const s = this._ev.get(evt); if (s) s.delete(fn) }
  emit(evt, data) { const s = this._ev.get(evt); if (s) for (const f of [...s]) { try { f(data) } catch (e) { console.warn('ses olayı', evt, e) } } }
}

// ---------------------------------------------------------------- tampon deposu (LRU)
// Kısa dosyalar bütün halinde decodeAudioData ile; uzunlar ffmpeg ile 60 sn'lik parçalar halinde çözülür.
class BufferStore {
  constructor() {
    this.files = new Map()   // yol → { dur, whole, chunks: Map(idx → { buf, bytes, last, promise }) }
    this.bytes = 0
    this.clock = 0
    this.pinned = new Set()  // "yol#idx" — çalınanlar atılmaz
    this._dctx = null
    this.onLoad = null
  }
  decodeCtx() {
    if (!this._dctx) this._dctx = new OfflineAudioContext(2, 1, SR)
    return this._dctx
  }
  entry(p, durHint) {
    let e = this.files.get(p)
    if (!e) { e = { dur: 0, whole: null, chunks: new Map() }; this.files.set(p, e) }
    if (durHint > 0 && !e.dur) e.dur = durHint
    if (e.whole == null) {
      if (p.endsWith(REV)) e.whole = true
      else if (e.dur > 0) e.whole = e.dur <= D.wholeMaxSec
      else { let size = 0; try { size = fs.statSync(p).size } catch (er) { /* */ } e.whole = size < 120e6 }
    }
    return e
  }
  // kaynak dosya zamanı t için parça
  seg(p, t, durHint) {
    const e = this.entry(p, durHint)
    if (e.whole) return { idx: 0, t0: 0, t1: Infinity }
    const idx = Math.max(0, Math.floor(t / D.chunkSec))
    return { idx, t0: idx * D.chunkSec, t1: (idx + 1) * D.chunkSec }
  }
  peek(p, idx) {
    const e = this.files.get(p)
    const c = e && e.chunks.get(idx)
    if (c && c.buf) { c.last = ++this.clock; return c.buf }
    return null
  }
  load(p, idx, durHint) {
    const e = this.entry(p, durHint)
    let c = e.chunks.get(idx)
    if (c && (c.buf || c.promise)) { c.last = ++this.clock; return c.buf ? Promise.resolve(c.buf) : c.promise }
    c = { buf: null, bytes: 0, last: ++this.clock, promise: null }
    e.chunks.set(idx, c)
    const job = p.endsWith(REV) ? this._reversed(p.slice(0, -REV.length), durHint)
      : e.whole ? this._decodeWhole(p) : this._decodeChunk(p, idx * D.chunkSec, D.chunkSec)
    c.promise = job.then(buf => {
      c.promise = null
      if (!buf) { e.chunks.delete(idx); return null }
      c.buf = buf
      c.bytes = buf.length * buf.numberOfChannels * 4
      this.bytes += c.bytes
      if (e.whole && !e.dur) e.dur = buf.duration
      this._evict()
      if (this.onLoad) this.onLoad(p, idx)
      return buf
    }, err => { c.promise = null; e.chunks.delete(idx); console.warn('ses çözülemedi', p, err); return null })
    return c.promise
  }
  // ters çalma için bellekte ters çevrilmiş kopya (yalnız bütün çözülen kısa dosyalar)
  async _reversed(base, durHint) {
    const fwd = await this.load(base, 0, durHint)
    if (!fwd) return null
    const b = new AudioBuffer({ length: fwd.length, numberOfChannels: fwd.numberOfChannels, sampleRate: fwd.sampleRate })
    for (let c = 0; c < fwd.numberOfChannels; c++) { const d = fwd.getChannelData(c).slice(); d.reverse(); b.copyToChannel(d, c) }
    return b
  }
  async _decodeWhole(p) {
    if (!fs) return null
    try {
      const data = await (fs.promises ? fs.promises.readFile(p) : Promise.resolve(fs.readFileSync(p)))
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      return await this.decodeCtx().decodeAudioData(ab)
    } catch (e) {
      // tarayıcının çözemediği biçim → ffmpeg
      return this._decodeChunk(p, 0, 0)
    }
  }
  async _decodeChunk(p, t0, dur) {
    const args = ['-v', 'error']
    if (t0 > 0) args.push('-ss', String(t0))
    if (dur > 0) args.push('-t', String(dur))
    args.push('-i', p, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-')
    const r = await run(appPaths().ffmpeg, args)
    if (r.code !== 0 || !r.buf || r.buf.length < 8) return null
    const frames = Math.floor(r.buf.length / 8)
    const inter = new Float32Array(r.buf.buffer.slice(r.buf.byteOffset, r.buf.byteOffset + frames * 8))
    const buf = new AudioBuffer({ length: frames, numberOfChannels: 2, sampleRate: SR })
    const L = new Float32Array(frames), R = new Float32Array(frames)
    for (let i = 0, j = 0; i < frames; i++, j += 2) { L[i] = inter[j]; R[i] = inter[j + 1] }
    buf.copyToChannel(L, 0); buf.copyToChannel(R, 1)
    return buf
  }
  _evict() {
    if (this.bytes <= D.memCap) return
    const all = []
    for (const [p, e] of this.files) for (const [idx, c] of e.chunks) if (c.buf) all.push({ p, idx, c, e })
    all.sort((a, b) => a.c.last - b.c.last)
    for (const x of all) {
      if (this.bytes <= D.memCap * 0.85) break
      if (this.pinned.has(x.p + '#' + x.idx)) continue
      this.bytes -= x.c.bytes
      x.e.chunks.delete(x.idx)
    }
  }
  wholeBuffer(p) { const e = this.files.get(p); return e && e.whole ? this.peek(p, 0) : null }
  clear() { this.files.clear(); this.bytes = 0 }
}

// ---------------------------------------------------------------- zarf (ducking için seviye)
// 100 Hz tepe genliği, kaynak zamanında. Medya tepe dosyası (media.js) varsa o, yoksa çözülmüş tampon.
const envCache = new Map()
function envelopeOf(media, store) {
  const key = media.audioPath
  if (envCache.has(key)) return envCache.get(key)
  let env = null
  if (media.peaksPath && exists(media.peaksPath)) {
    try {
      const b = fs.readFileSync(media.peaksPath)
      env = new Float32Array(b.length)
      for (let i = 0; i < b.length; i++) { const v = b[i] / 255; env[i] = v * v }
    } catch (e) { env = null }
  }
  if (!env && store) {
    const buf = store.wholeBuffer(media.audioPath)
    if (buf) {
      const hop = Math.round(buf.sampleRate / 100)
      const n = Math.ceil(buf.length / hop)
      env = new Float32Array(n)
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c)
        for (let k = 0; k < n; k++) {
          let mx = env[k]
          const e = Math.min(d.length, (k + 1) * hop)
          for (let i = k * hop; i < e; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > mx) mx = v }
          env[k] = mx
        }
      }
    }
  }
  if (env) envCache.set(key, env)
  return env
}

// ---------------------------------------------------------------- plan
// Duyulabilir her klip için giriş: zaman aralığı (geçiş taşmaları dahil) + kazanç fonksiyonu
export function planEntries(project) {
  const out = []
  if (!project || !project.tracks) return out
  for (const track of project.tracks) {
    if (track.muted) continue
    const clips = track.clips || []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      const a = clip.audio
      if (!a || a.muted || clip.freeze) continue
      const media = project.media && project.media[clip.mediaId]
      if (!media || !media.audioPath || media.hasAudio === false) continue
      // geçişler: bu klipten çıkış / önceki klipten giriş
      const xout = transitionWindow(track, clip)
      const prev = clips[i - 1]
      const xin = prev ? transitionWindow(track, prev) : null
      const t0 = xin && xin.to === clip ? xin.start : clip.start
      const t1 = xout ? xout.end : clip.start + clip.duration
      out.push({ clip, track, media, t0, t1, xin: xin && xin.to === clip ? xin : null, xout, duck: !!a.duck, spec: processSpec(clip, media) })
    }
  }
  return out
}

// Zaman çizelgesi zamanında klip kazancı (ducking hariç)
export function entryGain(e, t) {
  const c = e.clip, a = c.audio
  const lt = t - c.start
  let g = Math.max(0, +prop(c, 'audio.volume', lt) || 0)
  if (!e.xin && a.fadeIn > 0 && lt < a.fadeIn) g *= fadeCurve(lt / a.fadeIn)
  if (!e.xout && a.fadeOut > 0 && lt > c.duration - a.fadeOut) g *= fadeCurve((c.duration - lt) / a.fadeOut)
  if (e.xin) g *= Math.sin(clamp01((t - e.xin.start) / Math.max(1e-6, e.xin.duration)) * Math.PI / 2)
  if (e.xout) g *= Math.cos(clamp01((t - e.xout.start) / Math.max(1e-6, e.xout.duration)) * Math.PI / 2)
  return g
}

// Ducking eğrisi (bütün proje için, 100 Hz) — önizleme ve dışa aktarma aynı eğriyi kullanır
const duckCache = new WeakMap()
export function computeDuck(project, entries, store, opts = D.duck) {
  if (duckCache.has(project)) return duckCache.get(project)
  const duckers = entries.filter(e => e.duck)
  if (!duckers.length) { duckCache.set(project, null); return null }
  const rate = D.envRate
  const end = projectDuration(project) + 1
  const n = Math.ceil(end * rate) + 1
  const level = new Float32Array(n)
  let complete = true
  for (const e of duckers) {
    const env = envelopeOf(e.media, store)
    if (!env) { complete = false; continue }
    const i0 = Math.max(0, Math.floor(e.t0 * rate)), i1 = Math.min(n - 1, Math.ceil(e.t1 * rate))
    for (let i = i0; i <= i1; i++) {
      const t = i / rate
      if (t < e.t0 || t > e.t1) continue
      const s = sourceTime(e.clip, t - e.clip.start)
      const k = Math.floor(s * 100)
      const amp = (env[k] || 0) * entryGain(e, t)
      if (amp > level[i]) level[i] = amp
    }
  }
  const thr = Math.pow(10, opts.thresholdDb / 20)
  const look = Math.round(opts.lookahead * rate), hold = Math.round(opts.hold * rate)
  const target = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (level[i] > thr) {
    const a = Math.max(0, i - look), b = Math.min(n - 1, i + hold)
    for (let j = a; j <= b; j++) target[j] = 1
  }
  const aA = 1 - Math.exp(-1 / (opts.attack * rate)), aR = 1 - Math.exp(-1 / (opts.release * rate))
  const g = new Float32Array(n)
  let d = 0
  for (let i = 0; i < n; i++) {
    const tg = target[i]
    d += (tg - d) * (tg > d ? aA : aR)
    g[i] = 1 - (1 - opts.amount) * d
  }
  const res = { rate, g }
  if (complete) duckCache.set(project, res)
  return res
}
function duckAt(duck, t) {
  if (!duck) return 1
  const x = t * duck.rate
  const i = Math.floor(x)
  if (i < 0) return duck.g[0]
  if (i >= duck.g.length - 1) return duck.g[duck.g.length - 1]
  const f = x - i
  return duck.g[i] * (1 - f) + duck.g[i + 1] * f
}

// ---------------------------------------------------------------- kaynak çözümü
// Hangi dosya, hangi kip: 'proc' (işlenmiş), 'raw' (ham), 'rev' (bellekte ters çevrilmiş ham)
function resolveSource(e, store, { requireProcessed = false } = {}) {
  const { clip, media, spec } = e
  if (spec) {
    const meta = findProcessed(spec)
    if (meta) return { mode: 'proc', path: meta.path, meta, dur: meta.actual || 0, stretched: spec.stretch }
    if (requireProcessed) return null
  }
  if (clip.reverse) {
    // işlenmiş ters dosya hazır değil: kısa dosyada bellekte ters çevir, yoksa medya.reversedAudioPath
    const ent = store.entry(media.audioPath, media.duration)
    if (ent.whole) return { mode: 'rev', path: media.audioPath + REV, dur: media.duration, stretched: false }
    if (media.reversedAudioPath && exists(media.reversedAudioPath)) return { mode: 'revfile', path: media.reversedAudioPath, dur: media.duration, stretched: false }
    return null
  }
  return { mode: 'raw', path: media.audioPath, dur: media.duration, stretched: false }
}

// Klip yerel zamanında dosya zamanı ve oynatma hızı
function fileTimeAt(e, src, t, bufDur) {
  const c = e.clip
  const lt = t - c.start
  const s = sourceTime(c, lt)
  switch (src.mode) {
    case 'proc': return procTime(src.meta, s, lt)
    case 'rev': return (bufDur || src.dur) - s
    case 'revfile': return (src.dur || bufDur) - s
    default: return s
  }
}
function rateAt(e, src, t) {
  const c = e.clip
  const scale = src.mode === 'proc' ? (src.meta.scale || 1) : 1
  if (src.stretched) return scale
  return Math.max(0.01, instantSpeed(c, t - c.start)) * scale
}
function hasRateCurve(e, src) { return !src.stretched && !!(e.clip.speedCurve && e.clip.speedCurve.points && e.clip.speedCurve.points.length) }

// Dosya zamanı f → zaman çizelgesi t (monoton; ikiye bölme)
function timeAtFile(e, src, f, lo, hi, bufDur) {
  let a = lo, b = hi
  for (let k = 0; k < 48; k++) {
    const m = (a + b) / 2
    if (fileTimeAt(e, src, m, bufDur) < f) a = m
    else b = m
  }
  return (a + b) / 2
}

// Girişin [tA,tB] aralığını dosya parçalarına böl
function piecesOf(e, src, store, tA, tB) {
  const ent = store.entry(src.path, src.dur)
  if (ent.whole) return [{ idx: 0, a: tA, b: tB, t0: 0 }]
  const out = []
  const fA = fileTimeAt(e, src, tA), fB = fileTimeAt(e, src, tB)
  let idx = Math.max(0, Math.floor(Math.min(fA, fB) / D.chunkSec))
  const last = Math.floor(Math.max(fA, fB) / D.chunkSec)
  let a = tA
  for (; idx <= last; idx++) {
    const edge = (idx + 1) * D.chunkSec
    const b = idx === last ? tB : timeAtFile(e, src, edge, a, tB)
    if (b > a + 1e-6) out.push({ idx, a, b, t0: idx * D.chunkSec })
    a = b
  }
  return out
}

// ---------------------------------------------------------------- grafik
function makeEqEnhance(ctx, a) {
  const nodes = []
  const eq = a.eq || {}
  if (eq.low) { const f = ctx.createBiquadFilter(); f.type = 'lowshelf'; f.frequency.value = 200; f.gain.value = eq.low; nodes.push(f) }
  if (eq.mid) { const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 1000; f.Q.value = 0.9; f.gain.value = eq.mid; nodes.push(f) }
  if (eq.high) { const f = ctx.createBiquadFilter(); f.type = 'highshelf'; f.frequency.value = 5000; f.gain.value = eq.high; nodes.push(f) }
  let lat = 0
  if (a.enhance) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80; hp.Q.value = 0.707
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 1; mud.gain.value = -2
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3500; pres.Q.value = 1; pres.gain.value = 4
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -24; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.15
    nodes.push(hp, mud, pres, air, comp)
    lat = D.enhanceLatency
  }
  return { nodes, lat }
}

// Örneklenmiş eğri ile AudioParam otomasyonu (sabitse tek değer)
function automate(param, fn, ctxAt, tA, tB, rate = D.envRate, ctxNow = 0) {
  const dur = tB - tA
  if (dur <= 0) return
  let n = Math.ceil(dur * rate) + 1
  if (n > 400000) n = 400000
  const curve = new Float32Array(n)
  let mn = Infinity, mx = -Infinity
  for (let i = 0; i < n; i++) { const v = fn(tA + dur * i / (n - 1)); curve[i] = v; if (v < mn) mn = v; if (v > mx) mx = v }
  if (mx - mn < 1e-5) { param.setValueAtTime(curve[0], Math.max(ctxNow, ctxAt)); return }
  if (ctxAt < ctxNow) {
    // geçmişte başlayan eğri: şimdiden kes
    const skip = ctxNow - ctxAt
    const k = Math.min(n - 2, Math.floor(skip / dur * (n - 1)))
    if (k > 0) return automate(param, fn, ctxAt + dur * k / (n - 1), tA + dur * k / (n - 1), tB, rate, ctxNow)
  }
  param.setValueAtTime(curve[0], ctxAt)
  param.setValueCurveAtTime(curve, ctxAt, dur)
}

// Ses çıkışı kuran ortak planlayıcı (önizleme + çevrimdışı)
// env: { ctx, dest(track) → AudioNode, ctxTime(t), nowT() (zaman çizelgesi; çevrimdışında -Inf), store, duck }
class ClipChain {
  constructor(env, e, src, tFrom) {
    const { ctx } = env
    this.e = e; this.src = src
    const a = e.clip.audio
    this.input = ctx.createGain()
    const { nodes, lat } = makeEqEnhance(ctx, a)
    this.lat = lat
    this.gain = ctx.createGain()
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    let n = this.input
    for (const x of nodes) { n.connect(x); n = x }
    n.connect(this.gain)
    n = this.gain
    if (this.pan) { n.connect(this.pan); n = this.pan }
    n.connect(env.dest(e.track))
    this.nodes = [this.input, ...nodes, this.gain, this.pan].filter(Boolean)
    // zarf: ses × anahtar kare × giriş/çıkış × geçiş × ducking
    const tA = Math.max(e.t0, tFrom), tB = e.t1
    const duck = e.duck ? null : env.duck
    automate(this.gain.gain, t => entryGain(e, t) * duckAt(duck, t), env.ctxTime(tA), tA, tB, D.envRate, env.ctxNow())
    if (this.pan) {
      if (hasKeys(e.clip, 'audio.pan')) automate(this.pan.pan, t => Math.max(-1, Math.min(1, +prop(e.clip, 'audio.pan', t - e.clip.start) || 0)), env.ctxTime(tA), tA, tB, D.envRate, env.ctxNow())
      else this.pan.pan.value = Math.max(-1, Math.min(1, +a.pan || 0))
    }
    this.sources = []
  }
  // tek parça: tampon + zaman aralığı
  addPiece(env, piece, buf, { first, last }) {
    const { ctx } = env
    const e = this.e, src = this.src
    let tA = piece.a
    const tB = piece.b
    const nowT = env.nowT() // bağlamın şu anki zamanına karşılık gelen zaman çizelgesi zamanı
    if (tB <= nowT + 0.015) return null
    let lateStart = false
    if (tA < nowT + 0.01 + this.lat) { tA = nowT + 0.03 + this.lat; lateStart = true }
    if (tA >= tB) return null
    const node = ctx.createBufferSource()
    node.buffer = buf
    const bufDur = buf.duration + piece.t0
    let offset = fileTimeAt(e, src, tA, bufDur) - piece.t0
    let when = env.ctxTime(tA) - this.lat
    const r0 = rateAt(e, src, tA)
    if (offset < 0) { when += -offset / r0; offset = 0 }
    if (hasRateCurve(e, src)) automate(node.playbackRate, t => rateAt(e, src, t), env.ctxTime(tA) - this.lat, tA, tB, D.envRate, env.ctxNow())
    else node.playbackRate.value = r0
    // kenar tık önleme
    const pg = ctx.createGain()
    const stopAt = env.ctxTime(tB) - this.lat
    const dc = D.declick
    if (first || lateStart) { pg.gain.setValueAtTime(0, when); pg.gain.linearRampToValueAtTime(1, when + dc) }
    if (last && stopAt - dc > when + dc) { pg.gain.setValueAtTime(1, stopAt - dc); pg.gain.linearRampToValueAtTime(0, stopAt) }
    node.connect(pg); pg.connect(this.input)
    node.start(Math.max(0, when), offset)
    node.stop(Math.max(when + 0.001, stopAt))
    this.sources.push(node)
    node.onended = () => { try { pg.disconnect() } catch (er) { /* */ } }
    return node
  }
  stop(at) {
    for (const s of this.sources) { try { s.stop(at) } catch (e) { /* başlamamış */ } }
  }
  disconnect() {
    for (const s of this.sources) { try { s.disconnect() } catch (e) { /* */ } }
    for (const n of this.nodes) { try { n.disconnect() } catch (e) { /* */ } }
  }
}

// ---------------------------------------------------------------- motor
export class AudioEngine extends Emitter {
  constructor() {
    super()
    this.ctx = null
    this.store = new BufferStore()
    this.project = null
    this.playing = false
    this.t0 = 0
    this.startT = 0
    this.ctxStart = 0
    this.perfStart = 0
    this.gen = null
    this._genId = 0
    this._timer = 0
    this.masterVolume = 1
    this._levels = { l: 0, r: 0, peakL: 0, peakR: 0, t: 0 }
    this._scrubAt = 0
    this._scrubPending = null
    this.store.onLoad = () => { if (this.playing) this._tick() ; this.emit('buffer', {}) }
    setProcessListener((evt, data) => {
      this.emit(evt, data)
      if (evt === 'processed' && this.playing && this.gen && this.gen.entries.some(e => e.spec && e.spec.pkey === data.pkey)) {
        clearTimeout(this._procUpd)
        this._procUpd = setTimeout(() => this.update(this.project), 30)
      }
    })
  }

  get isPlaying() { return this.playing }
  get sampleRate() { return SR }

  _ensureCtx() {
    if (this.ctx) return this.ctx
    if (typeof AudioContext === 'undefined') return null
    const ctx = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' })
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.masterVolume
    // yumuşak sınırlayıcı (dışa aktarmadaki softClip ile aynı eğri; giriş ±2 aralığına ölçeklenir)
    this.pre = ctx.createGain(); this.pre.gain.value = 0.5
    this.shaper = ctx.createWaveShaper()
    const N = 8193, curve = new Float32Array(N)
    for (let i = 0; i < N; i++) curve[i] = softClip((i / (N - 1) * 2 - 1) * 2)
    this.shaper.curve = curve
    this.shaper.oversample = 'none'
    this.master.connect(this.pre); this.pre.connect(this.shaper)
    this.shaper.connect(ctx.destination)
    const split = ctx.createChannelSplitter(2)
    this.shaper.connect(split)
    this.anL = ctx.createAnalyser(); this.anR = ctx.createAnalyser()
    this.anL.fftSize = this.anR.fftSize = 2048
    split.connect(this.anL, 0); split.connect(this.anR, 1)
    this._tdL = new Float32Array(2048); this._tdR = new Float32Array(2048)
    return ctx
  }

  // ---------------------------------------------------------------- saat
  _ctxAudible() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return null
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp()
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() - ts.performanceTime) / 1000
    }
    return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0)
  }
  // Şu an DUYULAN zaman çizelgesi zamanı (video bu zamana kilitlenir)
  now() {
    if (!this.playing) return this.t0
    const ca = this._ctxAudible()
    if (ca == null || this._ctxPending) return Math.max(this.startT, this.t0 + (performance.now() - this.perfStart) / 1000)
    // başlangıçta ses hoparlöre ulaşana kadar (ön planlama + çıkış gecikmesi) görüntü başlangıç karesinde bekler
    return Math.max(this.startT, this.t0 + (ca - this.ctxStart))
  }
  // planlama için: zaman çizelgesi ↔ bağlam zamanı
  _ctxOf(t) { return this.ctxStart + (t - this.t0) }
  _timelineNow() { return this.t0 + ((this.ctx ? this.ctx.currentTime : 0) - this.ctxStart) }

  // ---------------------------------------------------------------- oynatma
  start(project, t0 = 0) {
    this.stop()
    this.project = project
    this.t0 = Math.max(0, t0)
    this.startT = this.t0
    this.playing = true
    this.perfStart = performance.now() + D.lookahead * 1000
    const ctx = this._ensureCtx()
    if (!ctx) return
    if (ctx.state !== 'running') {
      // bağlam askıda: saat performans sayacıyla akar; açılınca kaldığı yerden planla
      this._ctxPending = true
      ctx.resume().then(() => {
        if (!this.playing) return
        // saat sürekliliği: performans saatinden ses saatine atlamadan geç
        const t = this.now()
        const outLat = (ctx.baseLatency || 0) + (ctx.outputLatency || 0)
        this._ctxPending = false
        this.t0 = t + D.lookahead + outLat
        this.ctxStart = ctx.currentTime + D.lookahead
        this._newGen(this.t0, false)
        clearInterval(this._timer)
        this._timer = setInterval(() => this._tick(), 120)
      }).catch(() => { /* */ })
      this._kickProcessing(project)
      this.emit('state', { playing: true })
      return
    }
    this._ctxPending = false
    this.ctxStart = ctx.currentTime + D.lookahead
    this._newGen(this.t0, false)
    this._kickProcessing(project)
    clearInterval(this._timer)
    this._timer = setInterval(() => this._tick(), 120)
    this.emit('state', { playing: true })
  }

  // Bağlamı önceden aç (ilk oynatmada askıdan çıkma gecikmesi olmasın)
  warmup() {
    const ctx = this._ensureCtx()
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
    return ctx
  }

  stop() {
    clearInterval(this._timer); this._timer = 0
    const wasPlaying = this.playing
    if (this.playing) this.t0 = this.now()
    this.playing = false
    this._ctxPending = false
    if (this.gen) this._dropGen(this.gen, this.ctx ? this.ctx.currentTime : 0, 0.008)
    this.gen = null
    for (const k of [...this.store.pinned]) this.store.pinned.delete(k)
    if (wasPlaying) this.emit('state', { playing: false })
  }

  // Proje oynarken değişti → şu andan kesintisiz yeniden planla (kısa çapraz geçiş)
  update(project) {
    this.project = project
    if (!this.playing || !this.ctx || this._ctxPending) { if (project) this._kickProcessing(project); return }
    const ctx = this.ctx
    const at = ctx.currentTime + D.lookahead
    const tFrom = this.t0 + (at - this.ctxStart)
    const old = this.gen
    this._newGen(tFrom, true, at)
    if (old) this._dropGen(old, at, D.xfade)
    this._kickProcessing(project)
  }

  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(4, +v || 0))
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02)
  }

  _newGen(tFrom, xfade, ctxAt) {
    const ctx = this.ctx
    const at = ctxAt != null ? ctxAt : this._ctxOf(tFrom)
    const gen = { id: ++this._genId, tFrom, xfade: !!xfade, out: ctx.createGain(), buses: new Map(), chains: new Map(), done: new Set(), loading: new Set() }
    gen.out.connect(this.master)
    if (xfade) { gen.out.gain.setValueAtTime(0, at); gen.out.gain.linearRampToValueAtTime(1, at + D.xfade) }
    gen.entries = planEntries(this.project).filter(e => e.t1 > tFrom)
    gen.duck = computeDuck(this.project, planEntries(this.project), this.store)
    gen.env = {
      ctx,
      ctxTime: t => this._ctxOf(t),
      ctxNow: () => ctx.currentTime,
      nowT: () => this._timelineNow(),
      dest: track => {
        let b = gen.buses.get(track.id)
        if (!b) { b = ctx.createGain(); b.connect(gen.out); gen.buses.set(track.id, b) }
        return b
      },
      duck: gen.duck,
    }
    this.gen = gen
    this._schedule(gen)
    return gen
  }

  _dropGen(gen, at, fade) {
    try {
      gen.out.gain.cancelScheduledValues(at)
      gen.out.gain.setValueAtTime(gen.out.gain.value, at)
      gen.out.gain.linearRampToValueAtTime(0, at + fade)
    } catch (e) { /* */ }
    for (const ch of gen.chains.values()) ch.stop(at + fade + 0.005)
    gen.dead = true
    setTimeout(() => {
      for (const ch of gen.chains.values()) ch.disconnect()
      for (const b of gen.buses.values()) { try { b.disconnect() } catch (e) { /* */ } }
      try { gen.out.disconnect() } catch (e) { /* */ }
    }, (fade + 0.25) * 1000 + Math.max(0, (at - (this.ctx ? this.ctx.currentTime : 0))) * 1000)
  }

  _tick() {
    const gen = this.gen
    if (!gen || gen.dead || !this.playing) return
    this._schedule(gen)
  }

  // Ufuk içindeki parçaları planla; tamponu hazır olmayanları yükle
  _schedule(gen) {
    const nowT = Math.max(gen.tFrom, this._timelineNow())
    const horizon = nowT + D.horizon
    const pins = new Set()
    for (const e of gen.entries) {
      if (e.t1 <= nowT || e.t0 > horizon) continue
      const src = resolveSource(e, this.store)
      if (!src) continue
      const pcs = piecesOf(e, src, this.store, Math.max(e.t0, gen.tFrom), e.t1)
      for (let i = 0; i < pcs.length; i++) {
        const pc = pcs[i]
        if (pc.b <= nowT || pc.a > horizon) continue
        const key = e.clip.id + '#' + pc.idx
        pins.add(src.path + '#' + pc.idx)
        if (gen.done.has(key)) continue
        const buf = this.store.peek(src.path, pc.idx)
        if (!buf) {
          if (!gen.loading.has(key)) { gen.loading.add(key); this.store.load(src.path, pc.idx, src.dur).finally(() => gen.loading.delete(key)) }
          continue
        }
        let ch = gen.chains.get(e.clip.id)
        if (!ch) { ch = new ClipChain(gen.env, e, src, gen.tFrom); gen.chains.set(e.clip.id, ch) }
        // tampon geç geldiyse ve klip başladıysa: kalan kısmı şimdiden çal
        const atStart = Math.abs(pc.a - e.t0) < 1e-6 || (!gen.xfade && Math.abs(pc.a - gen.tFrom) < 1e-6)
        ch.addPiece(gen.env, pc, buf, { first: i === 0 && atStart, last: i === pcs.length - 1 })
        gen.done.add(key)
      }
    }
    this.store.pinned = pins
  }

  // İşlenmiş dosya gerektiren klipleri kuyruğa koy
  // Kaydırıcı sürüklerken her ara değer için iş açılmasın: 250 ms bekle, artık kullanılmayan bekleyen işleri at
  _kickProcessing(project, now = false) {
    if (!project || !fs) return
    clearTimeout(this._kickT)
    const go = () => {
      const p = this.project || project
      const entries = planEntries(p)
      pruneQueue(new Set(entries.filter(e => e.spec).map(e => e.spec.pkey)))
      for (const e of entries) {
        if (e.spec && !findProcessed(e.spec)) ensureProcessed(e.spec).catch(err => { if (!err.cancelled) console.warn(err.message) })
      }
    }
    if (now) go()
    else this._kickT = setTimeout(go, 250)
  }

  // Önceden çöz: t civarındaki klipler (+ işlenmiş dosyaları başlat)
  preload(project, t = 0, ahead = 30) {
    if (!project || !fs) return Promise.resolve()
    this.project = project
    this.warmup()
    this._kickProcessing(project, true)
    const ps = []
    for (const e of planEntries(project)) {
      if (e.t1 < t - 2 || e.t0 > t + ahead) continue
      const src = resolveSource(e, this.store)
      if (!src) continue
      for (const pc of piecesOf(e, src, this.store, Math.max(e.t0, t), Math.min(e.t1, t + ahead))) ps.push(this.store.load(src.path, pc.idx, src.dur))
    }
    return Promise.all(ps)
  }

  // Sürüklerken kısa ses parçası (~80 ms)
  scrub(project, t) {
    const nowMs = performance.now()
    if (nowMs - this._scrubAt < 70) {
      clearTimeout(this._scrubT)
      this._scrubT = setTimeout(() => this.scrub(project, t), 75 - (nowMs - this._scrubAt))
      return
    }
    this._scrubAt = nowMs
    if (this.playing) return
    const ctx = this._ensureCtx()
    if (!ctx || !project) return
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
    const LEN = 0.08
    const at = ctx.currentTime + 0.01
    for (const e of planEntries(project)) {
      if (t < e.t0 || t >= e.t1) continue
      const src = resolveSource(e, this.store)
      if (!src) continue
      const f = fileTimeAt(e, src, t)
      const sg = this.store.seg(src.path, f, src.dur)
      const buf = this.store.peek(src.path, sg.idx)
      if (!buf) { this.store.load(src.path, sg.idx, src.dur); continue }
      const node = ctx.createBufferSource()
      node.buffer = buf
      node.playbackRate.value = Math.min(4, rateAt(e, src, t))
      const g = ctx.createGain()
      const v = entryGain(e, t)
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.008)
      g.gain.setValueAtTime(v, at + LEN - 0.012); g.gain.linearRampToValueAtTime(0, at + LEN)
      node.connect(g); g.connect(this.master)
      node.start(at, Math.max(0, f - sg.t0)); node.stop(at + LEN + 0.005)
      node.onended = () => { try { g.disconnect() } catch (er) { /* */ } }
    }
  }

  // VU ölçer: doğrusal RMS ve tepe (0..1+); tepe yavaş düşer
  getLevels() {
    const L = this._levels
    const nowMs = performance.now()
    const dt = Math.min(0.5, (nowMs - (L.t || nowMs)) / 1000)
    L.t = nowMs
    let l = 0, r = 0, pl = 0, pr = 0
    if (this.anL && this.playing) {
      this.anL.getFloatTimeDomainData(this._tdL); this.anR.getFloatTimeDomainData(this._tdR)
      let sl = 0, sr = 0
      for (let i = 0; i < 2048; i++) {
        const a = this._tdL[i], b = this._tdR[i]
        sl += a * a; sr += b * b
        const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b
        if (aa > pl) pl = aa
        if (bb > pr) pr = bb
      }
      l = Math.sqrt(sl / 2048); r = Math.sqrt(sr / 2048)
    }
    const fall = Math.pow(0.05, dt) // ~1 sn'de %95 düşüş
    L.peakL = Math.max(pl, L.peakL * fall)
    L.peakR = Math.max(pr, L.peakR * fall)
    L.l = Math.max(l, L.l * Math.pow(0.001, dt))
    L.r = Math.max(r, L.r * Math.pow(0.001, dt))
    return { l: L.l, r: L.r, peakL: L.peakL, peakR: L.peakR }
  }

  // İşlenmiş dosya yolu (hazırsa) — değilse kuyruğa koyar ve null döner
  processedPath(clip, media) { return processedPath(clip, media) }
  processing() { return processingJobs() }
  clearCache() { this.store.clear(); envCache.clear() }
}

export function processedPath(clip, media) {
  const spec = processSpec(clip, media)
  if (!spec) return null
  const m = findProcessed(spec)
  if (m) return m.path
  ensureProcessed(spec).catch(err => console.warn(err.message))
  return null
}

export const audioEngine = new AudioEngine()

// ---------------------------------------------------------------- dışa aktarma
// Önizlemeyle AYNI grafik, OfflineAudioContext içinde (stereo). İşlenmiş dosyalar beklenir.
export async function renderProjectAudio(project, { start = 0, end, sampleRate = SR, onProgress, limit = true, preroll = 0 } = {}) {
  if (end == null) end = projectDuration(project)
  const dur = Math.max(1 / sampleRate, end - start)
  const store = audioEngine.store
  const all = planEntries(project)
  const entries = all.filter(e => e.t1 > start - preroll && e.t0 < end)
  // 1) işlenmiş dosyalar
  const specs = entries.filter(e => e.spec)
  let doneSpecs = 0
  const report = (p, label) => onProgress && onProgress(p, label)
  await Promise.all(specs.map(e => ensureProcessed(e.spec, { keep: true }).then(() => { doneSpecs++; report(0.4 * doneSpecs / specs.length, 'Ses işleniyor') }, err => { console.warn(err.message) })))
  // 2) tamponlar
  const t0 = start - preroll
  const jobs = []
  const srcs = new Map()
  for (const e of entries) {
    const src = resolveSource(e, store)
    if (!src) continue
    srcs.set(e, src)
    for (const pc of piecesOf(e, src, store, Math.max(e.t0, t0), Math.min(e.t1, end))) jobs.push(store.load(src.path, pc.idx, src.dur))
  }
  await Promise.all(jobs)
  report(0.5, 'Ses miksleniyor')
  // 3) çevrimdışı grafik
  const total = Math.max(1, Math.round((dur + preroll) * sampleRate))
  const ctx = new OfflineAudioContext(2, total, sampleRate)
  const out = ctx.createGain()
  out.connect(ctx.destination)
  const buses = new Map()
  const duck = computeDuck(project, all, store)
  const env = {
    ctx,
    ctxTime: t => t - t0,
    ctxNow: () => 0,
    nowT: () => -Infinity,
    dest: track => { let b = buses.get(track.id); if (!b) { b = ctx.createGain(); b.connect(out); buses.set(track.id, b) } return b },
    duck,
  }
  for (const e of entries) {
    const src = srcs.get(e)
    if (!src) continue
    const tA = Math.max(e.t0, t0), tB = Math.min(e.t1, end)
    if (tB <= tA) continue
    const pcs = piecesOf(e, src, store, tA, tB)
    const ch = new ClipChain(env, e, src, tA)
    pcs.forEach((pc, i) => {
      const buf = store.peek(src.path, pc.idx)
      if (!buf) return
      ch.addPiece(env, pc, buf, { first: i === 0, last: i === pcs.length - 1 && tB >= e.t1 - 1e-6 })
    })
  }
  let rendered = await ctx.startRendering()
  report(0.95, 'Ses miksleniyor')
  // ön sarma kısmını at
  if (preroll > 0) {
    const skip = Math.round(preroll * sampleRate)
    const n = rendered.length - skip
    const b = new AudioBuffer({ length: Math.max(1, n), numberOfChannels: 2, sampleRate })
    for (let c = 0; c < 2; c++) b.copyToChannel(rendered.getChannelData(c).subarray(skip, skip + n), c)
    rendered = b
  }
  if (limit) for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c)
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (v > 0.9 || v < -0.9) d[i] = softClip(v) }
  }
  report(1, 'Ses hazır')
  return rendered
}

// Uzun projeler için: bloklar halinde (bellek sınırlı) doğrudan WAV'a yaz. Bloklar 1 sn ön sarmalı → kompresör/EQ sürekli.
export async function renderProjectAudioToWav(project, outPath, { start = 0, end, block = 30, sampleRate = SR, onProgress, bits = 32 } = {}) {
  if (end == null) end = projectDuration(project)
  const totalFrames = Math.max(1, Math.round((end - start) * sampleRate))
  const fd = fs.openSync(outPath + '.tmp', 'w')
  try {
    const head = encodeWav([new Float32Array(0), new Float32Array(0)], sampleRate, bits)
    // başlığı gerçek boyutla yeniden yaz
    patchWavHeader(head, totalFrames, 2, bits)
    fs.writeSync(fd, head)
    let written = 0
    for (let b = start; written < totalFrames; b += block) {
      const e = Math.min(end, b + block)
      const want = Math.min(totalFrames - written, Math.round((e - start) * sampleRate) - written)
      if (want <= 0) break
      const pre = b > start ? 1 : 0
      const buf = await renderProjectAudio(project, { start: b, end: e, sampleRate, preroll: pre, onProgress: p => onProgress && onProgress(((b - start) + p * (e - b)) / (end - start)) })
      const L = buf.getChannelData(0).subarray(0, want), R = buf.getChannelData(1).subarray(0, want)
      const pcm = encodeWav([padTo(L, want), padTo(R, want)], sampleRate, bits)
      const hl = bits === 32 ? 58 : 44
      fs.writeSync(fd, pcm, hl, pcm.length - hl)
      written += want
    }
  } finally { fs.closeSync(fd) }
  try { fs.unlinkSync(outPath) } catch (e) { /* */ }
  fs.renameSync(outPath + '.tmp', outPath)
  return outPath
}
function padTo(a, n) { if (a.length >= n) return a; const b = new Float32Array(n); b.set(a); return b }
function patchWavHeader(buf, frames, nc, bits) {
  const bps = bits / 8, data = frames * nc * bps
  const hl = bits === 32 ? 58 : 44
  buf.writeUInt32LE(hl - 8 + data, 4)
  if (bits === 32) buf.writeUInt32LE(frames, 46)
  buf.writeUInt32LE(data, hl - 4)
}

// AudioBuffer → WAV (Buffer). bits: 32 (float, varsayılan) | 24 | 16
export function audioBufferToWav(buffer, { bits = 32 } = {}) {
  const ch = []
  for (let c = 0; c < buffer.numberOfChannels; c++) ch.push(buffer.getChannelData(c))
  return encodeWav(ch, buffer.sampleRate, bits)
}

export async function writeWav(buffer, outPath, opts) {
  const data = audioBufferToWav(buffer, opts)
  await (fs.promises ? fs.promises.writeFile(outPath, data) : Promise.resolve(fs.writeFileSync(outPath, data)))
  return outPath
}

// Dosya süresi (işlenmiş / üretilmiş sesler için yardımcı)
export { fileDuration, processSpec, findProcessed, ensureProcessed, processingJobs }
   