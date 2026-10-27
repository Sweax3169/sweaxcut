// Küçük ardışıklayıcı: tempo, ölçü/adım zamanı, salınım (swing), desen dizgileri, akor ve melodi çözümleyici,
// alt karıştırıcılar (bus) ve yan zincir pompalama (sidechain duck).
import { mixer, G, filt, chain, mtof, nm } from '../sfx/dsp.js'
import { scheduleLazy } from './lazy.js'

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const Q = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], '7b9': [0, 4, 7, 10, 13], 13: [0, 4, 10, 14, 21], m11: [0, 3, 7, 10, 14, 17],
}
// 'F#m7' → { root: 6, ivs: [...] }
export function parseChord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym)
  if (!m) return { root: 0, ivs: Q[''] }
  const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12
  return { root, ivs: Q[m[3]] || Q[''] }
}
// akor notaları [lo, hi] aralığına katlanmış yakın dizilim (midi)
export function chordNotes(sym, lo = 55, hi = 74) {
  const { root, ivs } = parseChord(sym)
  const out = new Set()
  for (const iv of ivs) {
    let n = root + iv + 12 * Math.floor(lo / 12)
    while (n < lo) n += 12
    while (n > hi) n -= 12
    out.add(n)
  }
  return [...out].sort((a, b) => a - b)
}
export function rootNote(sym, oct = 2) { return parseChord(sym).root + 12 * (oct + 1) }

// melodi dizgisi: "E5:2 G5:2 -:4 C6:8" (uzunluk = 1/16 adım; '-' sus) → [{ n, s (adım), l }]
export function parseMelody(str) {
  const out = []
  let s = 0
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue
    const [nt, ln] = tok.split(':')
    const l = +(ln || 2)
    if (nt !== '-' && nt !== 'r') out.push({ n: nm(nt), s, l })
    s += l
  }
  return out
}

export function makeSong(ctx, o) {
  const beat = 60 / o.bpm
  const S = {
    ctx, bpm: o.bpm, beat, bar: beat * (o.beats || 4), bars: o.bars, s16: beat / 4,
    swing16: o.swing16 || 0, swing8: o.swing8 || 0,
  }
  S.m = mixer(ctx, {
    revTime: 2.2, revDecay: 3, revGain: 0.5, delay: o.delayTime ?? beat * 0.75, delayFb: 0.3, delayLp: 3500,
    gain: 0.85, threshold: -16, ratio: 3, attack: 0.01, release: 0.2, lowcut: 25, ...(o.mix || {}),
  })
  // alt karıştırıcı: kazanç (pompalama için) + isteğe bağlı süzgeç
  S.bus = (gain = 1, bo = {}) => {
    const g = G(ctx, gain)
    let tail = g
    if (bo.lp) tail = chain(tail, filt(ctx, 'lowpass', bo.lp, bo.q ?? 0.7))
    if (bo.hp) tail = chain(tail, filt(ctx, 'highpass', bo.hp, 0.7))
    tail.connect(S.m.in)
    const b = { in: g, rev: S.m.rev, dly: S.m.dly, gain: g.gain, filter: bo.lp || bo.hp ? tail : null }
    return b
  }
  // ölçü + adım (varsayılan 16'lık) → saniye, salınım uygulanmış
  S.at = (bar, step = 0, div = 16) => {
    const p16 = step * (16 / div)
    let t = bar * S.bar + p16 * S.s16
    const i16 = Math.round(p16)
    if (Math.abs(p16 - i16) < 1e-6) {
      if (S.swing16 && i16 % 2 === 1) t += S.swing16 * S.s16
      if (S.swing8 && i16 % 4 === 2) t += S.swing8 * S.s16 * 2
    }
    return t
  }
  S.len = (steps) => steps * S.s16
  // desen: 'x...X...x.x.' — her karakter bir adım; '.' sus, 'X' vurgulu, diğerleri fn'e iletilir
  S.hits = (bar, str, fn, div) => {
    const d = div || str.length
    for (let i = 0; i < str.length; i++) { const c = str[i]; if (c !== '.' && c !== ' ') fn(S.at(bar, i, d), c, i) }
  }
  S.range = (a, b, fn) => { for (let i = a; i < b; i++) fn(i) }
  // melodiyi çal: fn(time, midi, durSec, item)
  S.melody = (bar, str, fn) => { for (const it of parseMelody(str)) fn(S.at(bar, it.s), it.n, S.len(it.l), it) }
  // yan zincir: verilen zamanlarda bus kazancını düşür
  S.duck = (bus, times, depth = 0.6, rel = 0.22) => {
    const g = bus.gain
    g.setValueAtTime(1, 0)
    for (const t of times.sort((a, b) => a - b)) {
      g.setValueAtTime(1, Math.max(0, t - 0.004))
      g.linearRampToValueAtTime(1 - depth, t + 0.006)
      g.linearRampToValueAtTime(1, t + rel)
    }
  }
  S.mtof = mtof
  return S
}

// müzik tanımı yardımcısı: süre = ölçü × ölçü süresi
export function M(id, name, category, o, fn) {
  const bar = (60 / o.bpm) * (o.beats || 4)
  const duration = +(o.duration || bar * o.bars).toFixed(4)
  return {
    id, name, category, duration, bpm: o.bpm, bars: o.bars, key: o.key, tags: o.tags || [], seamless: o.seamless !== false, tail: o.tail ?? 3,
    synth: (ctx, t0 = 0) => { const S = makeSong(ctx, o); scheduleLazy(ctx, () => fn(S, ctx)) },
  }
}
