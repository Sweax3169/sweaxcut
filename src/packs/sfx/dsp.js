// Ses sentez takımı (OfflineAudioContext) — ses efektleri ve müzik paketleri ortak kullanır.
// Hepsi özgün sentez: osilatör, gürültü, süzgeç, zarf, dalga biçimlendirici, üretilmiş yankı (convolver).

export const TAU = Math.PI * 2
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const NOTE_IX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// 'C4', 'F#3', 'Bb2' → midi
export function nm(s) {
  if (typeof s === 'number') return s
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s)
  if (!m) return 60
  return 12 * (+m[3] + 1) + NOTE_IX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
export const nf = (s) => mtof(nm(s))

export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// bağlam başına önbellek
const caches = new WeakMap()
function cacheOf(ctx) { let c = caches.get(ctx); if (!c) { c = new Map(); caches.set(ctx, c) } return c }
export function cached(ctx, key, make) { const c = cacheOf(ctx); if (!c.has(key)) c.set(key, make()); return c.get(key) }

// ------------------------------------------------------------ temel düğümler
export function G(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g }
export function osc(ctx, type = 'sine', f = 440) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o }
// süzgeç parametreleri k-rate: Chrome a-rate otomasyonda katsayıyı HER ÖRNEKTE yeniden hesaplıyor (çok yavaş)
export function filt(ctx, type = 'lowpass', f = 1000, q = 0.707, gain = 0) {
  const b = ctx.createBiquadFilter(); b.type = type
  try { b.frequency.automationRate = 'k-rate'; b.Q.automationRate = 'k-rate'; b.gain.automationRate = 'k-rate'; b.detune.automationRate = 'k-rate' } catch (e) { /* eski */ }
  b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b
}
export function panner(ctx, v = 0) { const p = ctx.createStereoPanner(); p.pan.value = v; return p }
export function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1] }
export function shaper(ctx, amt = 2, kind = 'tanh') {
  const c = cached(ctx, 'sh:' + kind + amt, () => {
    const n = 2048, c = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      c[i] = kind === 'hard' ? Math.max(-1, Math.min(1, x * amt)) : kind === 'fold' ? Math.sin(x * amt) : Math.tanh(x * amt) / Math.tanh(amt)
    }
    return c
  })
  const ws = ctx.createWaveShaper(); ws.curve = c; ws.oversample = '2x'
  return ws
}

// ------------------------------------------------------------ zarflar
// a: atak, h: tutma, d: düşüş zaman sabiti (≈ -30 dB süresi), s: sürdürme (0..1), r: bırakma, end: nota bitişi (mutlak)
export function env(param, t, { a = 0.003, h = 0, d = 0.25, s = 0, r = 0.08, peak = 1, end = null, from = 0 } = {}) {
  param.cancelScheduledValues(t)
  param.setValueAtTime(from, t)
  param.linearRampToValueAtTime(peak, t + Math.max(0.0008, a))
  if (h > 0) param.setValueAtTime(peak, t + a + h)
  param.setTargetAtTime(s * peak, t + a + h, Math.max(0.001, d / 3.5))
  if (end != null) {
    const te = Math.max(end, t + a + h + 0.001)
    param.setTargetAtTime(0, te, Math.max(0.001, r / 4))
  }
  return param
}
export function sweep(param, t0, v0, t1, v1, kind = 'exp') {
  param.setValueAtTime(v0, t0)
  if (kind === 'exp' && v0 > 0 && v1 > 0) param.exponentialRampToValueAtTime(v1, Math.max(t0 + 0.0005, t1))
  else param.linearRampToValueAtTime(v1, Math.max(t0 + 0.0005, t1))
}
// eğri: [[t, v], ...] (göreli zaman)
export function curve(param, t0, pts, kind = 'lin') {
  param.setValueAtTime(pts[0][1], t0 + pts[0][0])
  for (let i = 1; i < pts.length; i++) {
    const [tt, v] = pts[i]
    if (kind === 'exp' && v > 0 && pts[i - 1][1] > 0) param.exponentialRampToValueAtTime(v, t0 + tt)
    else param.linearRampToValueAtTime(v, t0 + tt)
  }
}

// ------------------------------------------------------------ tamponlar
export function noiseBuf(ctx, color = 'white', dur = 4, seed = 7) {
  return cached(ctx, 'nz:' + color + dur + ':' + seed, () => {
    const sr = ctx.sampleRate, n = Math.ceil(dur * sr)
    const b = ctx.createBuffer(2, n, sr)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(seed + ch * 31)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1
        if (color === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926
        } else if (color === 'brown') {
          last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5
        } else if (color === 'crackle') {
          d[i] = r() < 0.0009 ? (r() * 2 - 1) * (0.4 + r() * 0.6) : 0
        } else d[i] = w
      }
    }
    return b
  })
}
// üretilmiş yankı dürtüsü: üstel sönen, zamanla kararan stereo gürültü
export function impulse(ctx, dur = 1.8, decay = 3, lp = 7000, seed = 3) {
  return cached(ctx, 'ir:' + dur + ':' + decay + ':' + lp, () => {
    const sr = ctx.sampleRate, n = Math.ceil(dur * sr)
    const b = ctx.createBuffer(2, n, sr)
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = rng(seed + ch * 97)
      let y = 0
      const pre = Math.floor(0.012 * sr)
      for (let i = 0; i < n; i++) {
        const x = i / n
        const fc = lp * (1 - x * 0.85) + 300
        const a = Math.exp(-TAU * fc / sr)
        y = (1 - a) * (r() * 2 - 1) + a * y
        const e = Math.pow(1 - x, decay) * (i < pre ? i / pre : 1)
        d[i] = y * e * 2.2
      }
      // erken yansımalar
      for (let k = 0; k < 6; k++) { const at = Math.floor((0.008 + r() * 0.05) * sr); if (at < n) d[at] += (r() - 0.5) * 0.9 }
    }
    return b
  })
}

// ------------------------------------------------------------ karıştırıcı
// { in, rev, dly, out } — her ses kendi düğümünü m.in'e bağlar; yankı/yankı gecikmesi gönderimleri isteğe bağlı
export function mixer(ctx, o = {}) {
  const input = G(ctx, 1)
  const outG = G(ctx, o.gain ?? 0.9)
  let tail = input
  if (o.lowcut) tail = chain(tail, filt(ctx, 'highpass', o.lowcut, 0.7))
  if (o.highcut) tail = chain(tail, filt(ctx, 'lowpass', o.highcut, 0.5))
  if (o.drive) tail = chain(tail, shaper(ctx, o.drive))
  if (o.comp !== false) {
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = o.threshold ?? -12; comp.knee.value = 8; comp.ratio.value = o.ratio ?? 6
    comp.attack.value = o.attack ?? 0.004; comp.release.value = o.release ?? 0.18
    tail = chain(tail, comp)
  }
  chain(tail, outG, ctx.destination)
  const rev = G(ctx, 1)
  const conv = ctx.createConvolver()
  conv.buffer = impulse(ctx, o.revTime ?? 1.8, o.revDecay ?? 3, o.revLp ?? 7000)
  chain(rev, filt(ctx, 'highpass', 180, 0.7), conv, G(ctx, o.revGain ?? 0.6), input)
  const dly = G(ctx, 1)
  if (o.delay) {
    const dl = ctx.createDelay(2); dl.delayTime.value = o.delay
    const fb = G(ctx, o.delayFb ?? 0.35), lp = filt(ctx, 'lowpass', o.delayLp ?? 4000)
    chain(dly, dl, lp, fb, dl)
    chain(lp, G(ctx, 0.8), input)
  }
  return { in: input, rev, dly, out: outG }
}
// bir düğümün çıkışını karıştırıcıya gönder (kazanç, yankı, gecikme, kaydırma)
export function send(ctx, node, m, { gain = 1, rev = 0, dly = 0, pan = 0, t = 0, dur = 1 } = {}) {
  const g = G(ctx, gain)
  let p = null
  if (Array.isArray(pan)) { p = panner(ctx, pan[0]); sweep(p.pan, t, pan[0], t + dur, pan[1], 'lin') } else if (pan) p = panner(ctx, pan)
  if (p) chain(node, p, g); else node.connect(g)
  g.connect(m.in)
  if (rev) { const r = G(ctx, rev); g.connect(r); r.connect(m.rev) }
  if (dly) { const d = G(ctx, dly); g.connect(d); d.connect(m.dly) }
  return g
}

// ------------------------------------------------------------ üst düzey sesler
// Zarf kuralı: d verilip s verilmezse (ya da s = 0) VURMALI ses — dur yok sayılır, d boyunca söner.
// Aksi halde SÜREN ses — dur sonunda r ile bırakılır. pts: [[t, kazanç]...] verilirse zarf yerine eğri kullanılır.
function vcaEnv(ctx, o, t, dur) {
  const vca = G(ctx, 0)
  const a = o.a ?? 0.004, h = o.h ?? 0, r = o.r ?? 0.06
  const perc = !o.pts && (o.s === 0 || (o.s == null && o.d != null))
  let stopAt
  if (o.pts) {
    curve(vca.gain, t, o.pts, o.ptsKind || 'lin')
    stopAt = t + o.pts[o.pts.length - 1][0] + 0.05
  } else if (perc) {
    const d = o.d
    env(vca.gain, t, { a, h, d, s: 0 })
    stopAt = t + a + h + d * 1.7 + 0.05
  } else {
    env(vca.gain, t, { a, h, d: o.d ?? 0.3, s: o.s ?? 1, r, end: t + dur })
    stopAt = t + dur + r * 1.7 + 0.05
  }
  const span = o.pts ? o.pts[o.pts.length - 1][0] : perc ? (o.d + a + h) : dur
  return { vca, stopAt, span }
}

// tone: { t, dur, type, f, f1, glideT, glide, freqPts, a, h, d, s, r, pts, gain, pan, rev, dly, detune,
//         filter:{type,f,f1,q,t,env,envD}, vib:{rate,depth,depth1,delay}, fm:{ratio,index,index1,t,type}, drive, unison:{n,spread} }
export function tone(ctx, m, o) {
  const t = o.t || 0, dur = o.dur ?? 0.3
  const { vca, stopAt, span } = vcaEnv(ctx, o, t, dur)
  const gT = o.glideT ?? span
  const n = o.unison ? o.unison.n : 1
  const mix = G(ctx, 1 / Math.sqrt(n))
  const oscs = []
  let vibG = null
  if (o.vib) { // tek titreşim LFO'su bütün unison seslerine
    const l = osc(ctx, 'sine', o.vib.rate || 5.5); vibG = G(ctx, 0)
    vibG.gain.setValueAtTime(0, t + (o.vib.delay || 0)); vibG.gain.linearRampToValueAtTime(o.vib.depth ?? 6, t + (o.vib.delay || 0) + 0.06)
    if (o.vib.depth1 != null) vibG.gain.linearRampToValueAtTime(o.vib.depth1, t + span)
    l.connect(vibG); l.start(t); l.stop(stopAt)
  }
  for (let k = 0; k < n; k++) {
    const os = osc(ctx, o.type || 'sine', o.f)
    if (o.wave) os.setPeriodicWave(o.wave)
    os.detune.value = (o.detune || 0) + (n > 1 ? ((k / (n - 1)) - 0.5) * 2 * (o.unison.spread || 12) : 0)
    if (o.freqPts) curve(os.frequency, t, o.freqPts, o.glide || 'exp')
    else if (o.f1 != null && o.f1 !== o.f) sweep(os.frequency, t + (o.glideDelay || 0), o.f, t + (o.glideDelay || 0) + gT, o.f1, o.glide || 'exp')
    else os.frequency.setValueAtTime(o.f, t)
    if (vibG) vibG.connect(os.frequency)
    if (o.fm) {
      const ratio = o.fm.ratio || 2
      const mo = osc(ctx, o.fm.type || 'sine', o.f * ratio), mg = G(ctx, 0)
      if (o.f1 != null && o.f1 !== o.f && !o.freqPts) sweep(mo.frequency, t, o.f * ratio, t + gT, o.f1 * ratio, o.glide || 'exp')
      const i0 = (o.fm.index ?? 2) * o.f, i1 = (o.fm.index1 ?? o.fm.index ?? 2) * o.f
      mg.gain.setValueAtTime(i0, t); mg.gain.linearRampToValueAtTime(i1, t + (o.fm.t || span))
      chain(mo, mg, os.frequency); mo.start(t); mo.stop(stopAt)
    }
    os.connect(mix); os.start(t); os.stop(stopAt)
    oscs.push(os)
  }
  let src = mix
  if (o.drive) src = chain(src, shaper(ctx, o.drive, o.driveKind))
  for (const f of [o.filter, o.filter2]) {
    if (!f) continue
    const bq = filt(ctx, f.type || 'lowpass', f.f, f.q ?? 0.7, f.gain || 0)
    if (f.pts) curve(bq.frequency, t, f.pts, f.kind || 'exp')
    else if (f.f1 != null) sweep(bq.frequency, t + (f.delay || 0), f.f, t + (f.delay || 0) + (f.t ?? span), f.f1, f.kind || 'exp')
    if (f.env) { bq.frequency.setValueAtTime(f.f + f.env, t); bq.frequency.setTargetAtTime(f.f, t + 0.002, (f.envD || 0.15) / 3.5) }
    src = chain(src, bq)
  }
  if (o.trem) { // genlik titreşimi: { rate, rate1, depth }
    const tg = G(ctx, 1 - (o.trem.depth ?? 0.5) / 2), l = osc(ctx, 'sine', o.trem.rate || 6), lg = G(ctx, (o.trem.depth ?? 0.5) / 2)
    if (o.trem.rate1) sweep(l.frequency, t, o.trem.rate, t + span, o.trem.rate1, 'exp')
    chain(l, lg, tg.gain); l.start(t); l.stop(stopAt)
    src = chain(src, tg)
  }
  src.connect(vca)
  send(ctx, vca, m, { gain: o.gain ?? 0.5, rev: o.rev || 0, dly: o.dly || 0, pan: o.pan || 0, t, dur: span })
  return { vca, oscs, stopAt }
}

// noise: { t, dur, color, a, h, d, s, r, pts, gain, pan, rev, filter/filter2/filter3:{type,f,f1,q,t,pts}, rate, rate1, ratePts, drive, seed }
export function noise(ctx, m, o) {
  const t = o.t || 0, dur = o.dur ?? 0.3
  const { vca, stopAt, span } = vcaEnv(ctx, o, t, dur)
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx, o.color || 'white', o.bufDur || 4, o.seedBuf || 7)
  src.loop = true
  if (o.ratePts) curve(src.playbackRate, t, o.ratePts, 'lin')
  else if (o.rate) { src.playbackRate.setValueAtTime(o.rate, t); if (o.rate1) src.playbackRate.linearRampToValueAtTime(o.rate1, t + span) }
  let head = src
  for (const f of [o.filter, o.filter2, o.filter3]) {
    if (!f) continue
    const bq = filt(ctx, f.type || 'lowpass', f.f, f.q ?? 0.7, f.gain || 0)
    if (f.pts) curve(bq.frequency, t, f.pts, f.kind || 'exp')
    else if (f.f1 != null) sweep(bq.frequency, t + (f.delay || 0), f.f, t + (f.delay || 0) + (f.t ?? span), f.f1, f.kind || 'exp')
    head = chain(head, bq)
  }
  if (o.drive) head = chain(head, shaper(ctx, o.drive))
  head.connect(vca)
  src.start(t, ((o.seed || 1) * 0.6173) % 3.5); src.stop(stopAt)
  send(ctx, vca, m, { gain: o.gain ?? 0.5, rev: o.rev || 0, dly: o.dly || 0, pan: o.pan || 0, t, dur: span })
  return { vca, src, stopAt }
}

// metalik/çan kısmi tonları: { t, f, ratios, amps, decays (sn), gain, rev, pan, type }
export function partials(ctx, m, o) {
  const t = o.t || 0
  const ratios = o.ratios || [1, 2.76, 5.4, 8.93]
  ratios.forEach((rt, i) => {
    const d = (o.decays && o.decays[i]) ?? (o.decay || 1.2) / (1 + i * 0.6)
    tone(ctx, m, { t, f: o.f * rt, a: o.a ?? 0.001, d, s: 0, type: o.type || 'sine', gain: (o.gain ?? 0.3) * ((o.amps && o.amps[i]) ?? 1 / (1 + i * 0.7)), rev: o.rev, pan: o.pan, detune: o.detune })
  })
}

// Karplus-Strong telli çalgı tamponu (JS'de hesaplanır, önbelleğe alınır)
export function pluckBuf(ctx, f, dur = 1.5, damp = 0.996, bright = 0.5, seed = 1) {
  const key = 'ks:' + Math.round(f * 10) + ':' + dur + ':' + damp + ':' + bright
  return cached(ctx, key, () => {
    const sr = ctx.sampleRate, n = Math.ceil(dur * sr)
    const b = ctx.createBuffer(1, n, sr)
    const d = b.getChannelData(0)
    const P = Math.max(2, Math.round(sr / f))
    const line = new Float32Array(P), r = rng(seed)
    let lp = 0
    for (let i = 0; i < P; i++) { const w = r() * 2 - 1; lp = lp + (w - lp) * (0.25 + bright * 0.75); line[i] = lp }
    let idx = 0, prev = 0
    for (let i = 0; i < n; i++) {
      const cur = line[idx]
      const nx = damp * (cur * (0.5 + bright * 0.25) + prev * (0.5 - bright * 0.25))
      prev = cur
      line[idx] = nx
      d[i] = cur
      idx = (idx + 1) % P
    }
    // DC ve başlangıç yumuşatma
    let m = 0; for (let i = 0; i < n; i++) m += d[i]; m /= n
    for (let i = 0; i < n; i++) d[i] = (d[i] - m) * (i < 64 ? i / 64 : 1) * (i > n - 512 ? (n - i) / 512 : 1)
    return b
  })
}
export function playBuf(ctx, m, buf, o = {}) {
  const src = ctx.createBufferSource(); src.buffer = buf
  if (o.rate) src.playbackRate.value = o.rate
  const vca = G(ctx, 1)
  if (o.dur != null) { vca.gain.setValueAtTime(1, (o.t || 0) + o.dur); vca.gain.setTargetAtTime(0, (o.t || 0) + o.dur, (o.r || 0.08) / 4) }
  let head = src
  if (o.filter) head = chain(head, filt(ctx, o.filter.type || 'lowpass', o.filter.f, o.filter.q ?? 0.7))
  head.connect(vca)
  src.start(o.t || 0)
  send(ctx, vca, m, { gain: o.gain ?? 0.5, rev: o.rev || 0, dly: o.dly || 0, pan: o.pan || 0 })
  return src
}

// piyano benzeri ton tamponu (eklemeli sentez + çekiç gürültüsü)
export function pianoBuf(ctx, f, dur = 2.5, bright = 0.6) {
  return cached(ctx, 'pn:' + Math.round(f * 10) + ':' + dur + ':' + bright, () => {
    const sr = ctx.sampleRate, n = Math.ceil(dur * sr)
    const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0)
    const H = 10, B = 0.0004
    const r = rng(Math.round(f))
    for (let h = 1; h <= H; h++) {
      const fh = f * h * Math.sqrt(1 + B * h * h)
      if (fh > sr / 2.2) break
      const amp = Math.pow(bright, h - 1) / h * (h === 1 ? 1 : 1.3)
      const dec = (1.2 + 2.5 * (220 / f)) / (1 + (h - 1) * 0.55)
      const ph = r() * TAU, w = TAU * fh / sr, det = 1 + (r() - 0.5) * 0.0012
      for (let i = 0; i < n; i++) {
        const tt = i / sr
        d[i] += amp * Math.exp(-tt / dec) * (Math.sin(w * i + ph) + 0.5 * Math.sin(w * det * i)) * 0.66
      }
    }
    const atk = Math.floor(0.004 * sr)
    for (let i = 0; i < n; i++) {
      if (i < atk) d[i] *= i / atk
      if (i < sr * 0.03) d[i] += (r() * 2 - 1) * 0.06 * Math.exp(-i / (sr * 0.006))
      if (i > n - 2048) d[i] *= (n - i) / 2048
    }
    return b
  })
}

// düşük frekanslı salınım: param += sin(rate) × depth
export function lfo(ctx, param, rate, depth, t = 0, stop = 10, type = 'sine') {
  const l = osc(ctx, type, rate), g = G(ctx, depth)
  chain(l, g, param); l.start(t); l.stop(stop)
  return l
}
// sürekli (döngü) gürültü katmanı: süzgeç merkezleri LFO ile gezinir. o: { color, gain, filters:[{type,f,q,lfo:[rate,depth]}], amp:[rate,depth], pan }
export function noiseBed(ctx, m, t, dur, o = {}) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx, o.color || 'pink', o.bufDur || 4, o.seedBuf || 7)
  src.loop = true
  let head = src
  for (const f of o.filters || []) {
    const bq = filt(ctx, f.type || 'bandpass', f.f, f.q ?? 0.8, f.gain || 0)
    if (f.lfo) lfo(ctx, bq.frequency, f.lfo[0], f.lfo[1], t, t + dur + 0.1)
    head = chain(head, bq)
  }
  const vca = G(ctx, o.amp ? 1 - o.amp[1] : 1)
  if (o.amp) lfo(ctx, vca.gain, o.amp[0], o.amp[1], t, t + dur + 0.1)
  const fade = G(ctx, 1)
  if (o.fadeIn || o.fadeOut) {
    fade.gain.setValueAtTime(o.fadeIn ? 0 : 1, t)
    if (o.fadeIn) fade.gain.linearRampToValueAtTime(1, t + o.fadeIn)
    if (o.fadeOut) { fade.gain.setValueAtTime(1, t + dur - o.fadeOut); fade.gain.linearRampToValueAtTime(0, t + dur) }
  }
  chain(head, vca, fade)
  src.start(t, o.offset || 0); src.stop(t + dur + 0.1)
  send(ctx, fade, m, { gain: o.gain ?? 0.5, rev: o.rev || 0, pan: o.pan || 0, t, dur })
  return fade
}

// darbe genişlikli kare dalga (8-bit sesler için %12.5 / %25 / %50)
export function pulseWave(ctx, duty = 0.25) {
  return cached(ctx, 'pw:' + duty, () => {
    const N = 48, re = new Float32Array(N), im = new Float32Array(N)
    for (let n = 1; n < N; n++) { re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty) ; im[n] = 0 }
    return ctx.createPeriodicWave(re, im)
  })
}
