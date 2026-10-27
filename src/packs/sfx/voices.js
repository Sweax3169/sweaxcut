// Ortak ses kaynakları: davullar (kick, trampet, el çırpma, zil…) ve melodik sesler (808, bas, pluck, pad, lead…)
// Hepsi (ctx, m, t, ...) imzalı; m = mixer(). Nota: midi sayısı ya da 'C4' gibi ad.
import { tone, noise, partials, G, osc, filt, chain, send, env, sweep, shaper, mtof, nm, pluckBuf, pianoBuf, playBuf, rng } from './dsp.js'

const F = (n) => (typeof n === 'number' && n > 127 ? n : mtof(nm(n)))

// ------------------------------------------------------------ davullar
export function kick(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.9
  tone(ctx, m, { t, f: o.f0 ?? 160, f1: o.f1 ?? 46, glideT: o.pt ?? 0.06, a: 0.001, d: o.d ?? 0.42, gain: g, drive: o.drive, pan: o.pan })
  tone(ctx, m, { t, f: (o.f1 ?? 46) * 2, f1: o.f1 ?? 46, glideT: 0.03, a: 0.0005, d: 0.05, gain: g * 0.25 })
  noise(ctx, m, { t, a: 0.0005, d: 0.014, gain: g * (o.click ?? 0.35), filter: { type: 'bandpass', f: o.clickF ?? 3200, q: 0.9 } })
}
export function snare(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.6
  tone(ctx, m, { t, type: 'triangle', f: o.f ?? 200, f1: (o.f ?? 200) * 0.82, glideT: 0.05, a: 0.001, d: 0.09, gain: g * 0.55, pan: o.pan })
  noise(ctx, m, { t, a: 0.001, d: o.d ?? 0.18, gain: g, filter: { type: 'highpass', f: 1100 }, filter2: { type: 'peaking', f: 4200, q: 0.8, gain: 4 }, rev: o.rev ?? 0.12, pan: o.pan })
}
export function clap(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.55
  for (let i = 0; i < 3; i++) noise(ctx, m, { t: t + i * 0.011, a: 0.0005, d: 0.012, gain: g * 0.8, filter: { type: 'bandpass', f: 1250, q: 1.3 }, seed: 3 + i, pan: o.pan })
  noise(ctx, m, { t: t + 0.03, a: 0.001, d: o.d ?? 0.16, gain: g, filter: { type: 'bandpass', f: 1150, q: 1 }, rev: o.rev ?? 0.2, seed: 9, pan: o.pan })
}
export function hat(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.22
  noise(ctx, m, { t, a: 0.0008, d: o.open ? (o.d ?? 0.32) : (o.d ?? 0.045), gain: g, filter: { type: 'highpass', f: o.hp ?? 7200 }, filter2: { type: 'peaking', f: 10500, q: 1, gain: 5 }, pan: o.pan ?? 0.15, seed: o.seed || 5, rev: o.rev || 0 })
}
export function rim(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.4
  tone(ctx, m, { t, type: 'triangle', f: 1700, a: 0.0005, d: 0.025, gain: g * 0.6, pan: o.pan })
  noise(ctx, m, { t, a: 0.0005, d: 0.012, gain: g, filter: { type: 'bandpass', f: 2600, q: 3 }, pan: o.pan })
}
export function tom(ctx, m, t, f = 110, o = {}) {
  const g = o.gain ?? 0.7
  tone(ctx, m, { t, f: f * 1.7, f1: f, glideT: 0.08, a: 0.001, d: o.d ?? 0.35, gain: g, pan: o.pan, rev: o.rev ?? 0.15 })
  noise(ctx, m, { t, a: 0.001, d: 0.05, gain: g * 0.25, filter: { type: 'lowpass', f: 2500 }, pan: o.pan })
}
// metalik zil (808 tarzı kare osilatör kümesi)
export function cymbal(ctx, m, t, o = {}) {
  const g = o.gain ?? 0.25, d = o.d ?? 1.6
  const base = o.base ?? 40
  const mix = G(ctx, 1)
  const hp = filt(ctx, 'highpass', o.hp ?? 6500, 0.7), bp = filt(ctx, 'bandpass', 9000, 0.6)
  const vca = G(ctx, 0)
  env(vca.gain, t, { a: 0.001, d, s: 0 })
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const os = osc(ctx, 'square', base * r * 1.0); os.connect(mix); os.start(t); os.stop(t + d * 1.8) }
  chain(mix, bp, hp, vca)
  send(ctx, vca, m, { gain: g * 0.5, rev: o.rev ?? 0.25, pan: o.pan || 0 })
  noise(ctx, m, { t, a: 0.001, d: d * 0.9, gain: g, filter: { type: 'highpass', f: 5500 }, rev: o.rev ?? 0.25, pan: o.pan || 0 })
}
export function cowbell(ctx, m, t, n = 'A5', dur = 0.2, o = {}) {
  const f = F(n), g = o.gain ?? 0.3
  for (const [r, a] of [[1, 1], [1.48, 0.7]]) tone(ctx, m, { t, type: 'square', f: f * r, a: 0.001, d: o.d ?? Math.max(0.12, dur), gain: g * a, filter: { type: 'bandpass', f: f * 2.2, q: 1.2 }, filter2: { type: 'lowpass', f: 5000 }, rev: o.rev ?? 0.1, dly: o.dly || 0, pan: o.pan })
}
export function shaker(ctx, m, t, o = {}) {
  noise(ctx, m, { t, a: 0.012, d: 0.06, gain: o.gain ?? 0.12, filter: { type: 'bandpass', f: 7000, q: 1.2 }, pan: o.pan ?? -0.2 })
}
export function snap(ctx, m, t, o = {}) {
  noise(ctx, m, { t, a: 0.0005, d: 0.03, gain: o.gain ?? 0.45, filter: { type: 'bandpass', f: 2200, q: 2.5 }, rev: o.rev ?? 0.25 })
}
// 8-bit gürültü davulu
export function chipNoise(ctx, m, t, o = {}) {
  noise(ctx, m, { t, a: 0.0005, d: o.d ?? 0.08, gain: o.gain ?? 0.3, filter: { type: o.hp ? 'highpass' : 'lowpass', f: o.f ?? 3000 }, rate: 0.25, seedBuf: 13 })
}

// ------------------------------------------------------------ melodik
// 808 bas: sürekli sinüs + doyum, isteğe bağlı kayma (glideFrom)
export function bass808(ctx, m, t, n, dur, o = {}) {
  const f = F(n)
  const from = o.glideFrom != null ? F(o.glideFrom) : null
  tone(ctx, m, {
    t, dur, f: from || f, f1: from ? f : undefined, glideT: o.glideT ?? 0.08, a: 0.004, d: 0.4, s: o.s ?? 0.85, r: o.r ?? 0.12,
    gain: o.gain ?? 0.75, drive: o.drive ?? 2.2, filter: { type: 'lowpass', f: o.lp ?? 1400 },
  })
}
export function subBass(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, { t, dur, f: F(n), a: 0.008, d: 0.3, s: 0.9, r: o.r ?? 0.08, gain: o.gain ?? 0.55, type: 'sine' })
}
// süzgeçli testere bas
export function synthBass(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, {
    t, dur, f: F(n), type: o.type || 'sawtooth', a: 0.004, d: 0.25, s: o.s ?? 0.7, r: o.r ?? 0.06, gain: o.gain ?? 0.32,
    filter: { type: 'lowpass', f: o.lp ?? 420, q: o.q ?? 3, env: o.env ?? 1400, envD: o.envD ?? 0.18 }, unison: o.unison, pan: o.pan,
  })
  if (o.sub !== false) tone(ctx, m, { t, dur, f: F(n) / 2, a: 0.005, s: 1, r: 0.05, gain: (o.gain ?? 0.32) * 0.6 })
}
// pluck: kısa testere/kare + süzgeç zarfı
export function pluck(ctx, m, t, n, o = {}) {
  tone(ctx, m, {
    t, f: F(n), type: o.type || 'sawtooth', a: 0.002, d: o.d ?? 0.35, gain: o.gain ?? 0.18,
    filter: { type: 'lowpass', f: o.lp ?? 900, q: o.q ?? 2, env: o.env ?? 4500, envD: o.envD ?? 0.12 },
    rev: o.rev ?? 0.25, dly: o.dly ?? 0, pan: o.pan || 0, unison: o.unison, detune: o.detune,
  })
}
// Karplus-Strong tel (ukulele / gitar / arp)
export function string(ctx, m, t, n, o = {}) {
  const f = F(n)
  playBuf(ctx, m, pluckBuf(ctx, f, o.len ?? 1.6, o.damp ?? 0.995, o.bright ?? 0.55, nm(n) + (o.seed || 0)), { t, gain: o.gain ?? 0.35, rev: o.rev ?? 0.2, dly: o.dly || 0, pan: o.pan || 0, dur: o.dur, filter: o.filter })
}
export function piano(ctx, m, t, n, o = {}) {
  playBuf(ctx, m, pianoBuf(ctx, F(n), o.len ?? 2.5, o.bright ?? 0.55), { t, gain: o.gain ?? 0.3, rev: o.rev ?? 0.25, dur: o.dur, r: 0.25, pan: o.pan || 0, filter: o.filter })
}
// pad: yavaş atak, birlikte çalan testere/üçgen, süzgeç
export function pad(ctx, m, t, notes, dur, o = {}) {
  for (const n of [].concat(notes)) {
    tone(ctx, m, {
      t, dur, f: F(n), type: o.type || 'sawtooth', a: o.a ?? 0.6, d: 0.5, s: 1, r: o.r ?? 0.8, gain: (o.gain ?? 0.1),
      unison: { n: 3, spread: o.spread ?? 14 }, filter: { type: 'lowpass', f: o.lp ?? 1400, q: 0.5, ...(o.lp1 ? { f1: o.lp1 } : {}) }, rev: o.rev ?? 0.45, pan: o.pan || 0,
    })
  }
}
// lead: kare/testere + vibrato
export function lead(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, {
    t, dur, f: o.from != null ? F(o.from) : F(n), f1: o.from != null ? F(n) : undefined, glideT: o.glideT ?? 0.06, type: o.type || 'square', a: o.a ?? 0.01, d: 0.2, s: o.s ?? 0.8, r: o.r ?? 0.1,
    gain: o.gain ?? 0.14, vib: o.vib === false ? undefined : { rate: o.vibRate ?? 5.5, depth: o.vibDepth ?? 5, delay: o.vibDelay ?? 0.18 },
    filter: { type: 'lowpass', f: o.lp ?? 3500, q: 0.8 }, rev: o.rev ?? 0.25, dly: o.dly ?? 0.15, pan: o.pan || 0, unison: o.unison, detune: o.detune,
  })
}
// FM çan / elektrik piyano
export function bell(ctx, m, t, n, o = {}) {
  tone(ctx, m, { t, f: F(n), a: 0.002, d: o.d ?? 1.2, gain: o.gain ?? 0.18, fm: { ratio: o.ratio ?? 3.5, index: o.index ?? 2.5, index1: 0, t: o.d ?? 1.2 }, rev: o.rev ?? 0.35, dly: o.dly ?? 0, pan: o.pan || 0 })
}
export function epiano(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, { t, dur, f: F(n), a: 0.003, d: 1.4, s: 0.25, r: o.r ?? 0.3, gain: o.gain ?? 0.16, fm: { ratio: 1, index: 1.4, index1: 0.2, t: 0.6 }, rev: o.rev ?? 0.25, pan: o.pan || 0, vib: { rate: 4.5, depth: 1.5 } })
}
// pirinç nefesli (testere + süzgeç açılması)
export function brass(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, {
    t, dur, f: F(n), type: 'sawtooth', a: o.a ?? 0.04, d: 0.3, s: 0.85, r: o.r ?? 0.15, gain: o.gain ?? 0.12, unison: { n: 3, spread: 9 },
    filter: { type: 'lowpass', f: o.lp ?? 900, q: 1, env: o.env ?? 2200, envD: 0.25 }, vib: { rate: 5, depth: 3, delay: 0.25 }, rev: o.rev ?? 0.3, pan: o.pan || 0,
  })
}
// yaylı (yavaş, vibratolu)
export function strings(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, {
    t, dur, f: F(n), type: 'sawtooth', a: o.a ?? 0.25, d: 0.5, s: 0.9, r: o.r ?? 0.5, gain: o.gain ?? 0.08, unison: { n: 3, spread: 10 },
    filter: { type: 'lowpass', f: o.lp ?? 2200, q: 0.4 }, vib: { rate: 5.2, depth: 4, delay: 0.3 }, rev: o.rev ?? 0.5, pan: o.pan || 0,
  })
}
// 8-bit kare / üçgen
export function chip(ctx, m, t, n, dur, o = {}) {
  tone(ctx, m, {
    t, dur, f: F(n), type: o.type || 'square', a: 0.002, d: o.d ?? 0.15, s: o.s ?? 0.6, r: o.r ?? 0.03, gain: o.gain ?? 0.12,
    vib: o.vib ? { rate: 6, depth: 6, delay: 0.15 } : undefined, filter: { type: 'lowpass', f: o.lp ?? 7000 }, pan: o.pan || 0, dly: o.dly || 0, rev: o.rev || 0, f1: o.slideTo != null ? F(o.slideTo) : undefined, glideT: o.glideT, wave: o.wave,
  })
}
