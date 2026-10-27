// Müzik parçaları (2/2) — komik, EDM, house, boom bap, ambiyans, vlog, montaj, hüzünlü piyano, zafer, aksiyon, bossa
import * as D0 from '../sfx/dsp.js'
import * as V0 from '../sfx/voices.js'
import { riser as riser0 } from '../sfx/sfx-a.js'
import { lazy, lazyAll } from './lazy.js'
import { M, chordNotes, rootNote } from './seq.js'

const { kick, snare, clap, hat, rim, tom, cymbal, cowbell, shaker, snap, chipNoise, bass808, subBass, synthBass, pluck, string, piano, pad, lead, bell, epiano, brass, strings, chip } = lazyAll(V0)
const tone = lazy(D0.tone, (a) => a[2].t), noise = lazy(D0.noise, (a) => a[2].t), noiseBed = lazy(D0.noiseBed), riser = lazy(riser0)
const { nf, pulseWave } = D0

const dur = (S) => S.bars * S.bar
const mf = (n) => 440 * Math.pow(2, (n - 69) / 12)
// süper testere akor (EDM) — notes: midi
function sawChord(ctx, m, t, notes, d, o = {}) {
  for (const n of notes) tone(ctx, m, {
    t, dur: d, f: mf(n), type: 'sawtooth', a: o.a ?? 0.01, d: 0.3, s: 0.85, r: o.r ?? 0.15, gain: o.gain ?? 0.05,
    unison: { n: 5, spread: o.spread ?? 22 }, filter: { type: 'lowpass', f: o.lp ?? 6000, q: 0.6, ...(o.lp1 ? { f1: o.lp1 } : {}) }, rev: o.rev ?? 0.25,
  })
}

export default [
  // ---------------------------------------------------------------- KOMİK
  M('sakar-kahraman', 'Sakar Kahraman (Komik)', 'eglenceli', { bpm: 132, bars: 16, key: 'F maj', mix: { revTime: 1.2, revGain: 0.35 }, tags: ['komik', 'çizgi film', 'eğlenceli', 'sakar'] }, (S, ctx) => {
    const prog = ['F', 'C7', 'F', 'Bb', 'F', 'C7', 'F', 'F']
    const mel = [
      'C5:2 -:1 C5:1 F5:2 A5:2 G5:2 F5:2 E5:2 F5:2', 'E5:2 G5:2 Bb5:2 G5:2 E5:2 C5:2 D5:2 E5:2', 'F5:2 A5:2 C6:4 A5:2 F5:2 C5:4', 'D5:2 F5:2 Bb5:4 A5:2 G5:2 F5:2 D5:2',
      'C5:1 D5:1 E5:1 F5:1 G5:2 A5:2 C6:2 A5:2 F5:4', 'G5:2 E5:2 C5:2 E5:2 G5:2 Bb5:2 A5:2 G5:2', 'A5:2 C6:2 A5:2 F5:2 G5:2 E5:2 C5:4', 'F5:4 -:2 C5:1 C5:1 F5:4 -:4',
    ]
    const band = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 2)
      lead(ctx, band, S.at(b, 0), r, S.len(2.5), { type: 'square', gain: 0.14, lp: 700, vib: false, rev: 0.1, dly: 0 })
      lead(ctx, band, S.at(b, 8), r + 7 - (ch === 'Bb' ? 12 : 0), S.len(2.5), { type: 'square', gain: 0.14, lp: 700, vib: false, rev: 0.1, dly: 0 })
      for (const st of [4, 12]) chordNotes(ch, 60, 72).forEach((n) => pluck(ctx, band, S.at(b, st), n, { type: 'triangle', d: 0.12, gain: 0.07, lp: 1500, env: 2500, rev: 0.15 }))
      S.melody(b, mel[b % 8], (t, n, d) => bell(ctx, band, t, n, { d: Math.min(0.5, d * 2), gain: 0.12, ratio: 3.93, index: 1.6, rev: 0.15 }))
      if (b >= 8) S.melody(b, mel[b % 8], (t, n, d) => pluck(ctx, band, t, n - 12, { type: 'square', d: Math.min(0.25, d), gain: 0.04, lp: 1200, env: 1500 }))
      S.hits(b, '..x...x...x...x.', (t) => rim(ctx, perc, t, { gain: 0.16, pan: 0.3 }))
      S.hits(b, 'x.......x.......', (t) => kick(ctx, perc, t, { gain: 0.5, f0: 110, f1: 55, d: 0.2, click: 0.1 }))
      S.hits(b, '....x.......x...', (t) => snare(ctx, perc, t, { gain: 0.2, d: 0.08 }))
    })
    tone(ctx, band, { t: S.at(7, 12), f: 500, f1: 1600, glideT: S.len(4), pts: [[0, 0], [0.05, 1], [S.len(4) - 0.03, 0.8], [S.len(4), 0]], gain: 0.12, vib: { rate: 6, depth: 10 } })
    tone(ctx, band, { t: S.at(15, 12), f: 140, f1: 280, glideT: 0.4, a: 0.002, d: 0.5, gain: 0.25, vib: { rate: 14, depth: 40, depth1: 0 } })
  }),

  // ---------------------------------------------------------------- EDM
  M('festival-edm', 'Festival (EDM Yükseliş + Drop)', 'elektronik', { bpm: 128, bars: 24, key: 'F min', mix: { revTime: 2.4, revGain: 0.5, threshold: -18, ratio: 4 }, tags: ['edm', 'drop', 'festival', 'dans'] }, (S, ctx) => {
    const prog = ['Fm', 'Db', 'Ab', 'Eb']
    const syn = S.bus(1), bass = S.bus(1), drums = S.bus(1)
    const kicks = []
    const lead4 = ['C6:3 Ab5:3 F5:2 G5:3 Ab5:3 C6:2', 'Db6:3 C6:3 Ab5:2 F5:4 Ab5:4', 'Eb6:3 C6:3 Ab5:2 C6:3 Eb6:3 Ab6:2', 'G6:4 F6:2 Eb6:2 Bb5:4 G5:4']
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 1), notes = chordNotes(ch, 60, 76)
      if (b < 16) {
        // giriş + yükseliş: süzgeçli akor vuruşları
        const open = b < 8 ? 600 + b * 120 : 1500 + (b - 8) * 700
        S.hits(b, b < 8 ? 'x.....x.....x...' : 'x.x.x.x.x.x.x.x.', (t) => notes.forEach((n) => pluck(ctx, syn, t, n, { gain: 0.05, d: 0.22, lp: open, env: open * 1.5, unison: { n: 3, spread: 15 }, rev: 0.3, dly: 0.15 })))
        if (b >= 4 && b < 14) S.hits(b, 'x...x...x...x...', (t) => { kick(ctx, drums, t, { gain: 0.8 }); kicks.push(t) })
        if (b >= 4 && b < 14) S.hits(b, '..x...x...x...x.', (t) => hat(ctx, drums, t, { open: true, d: 0.15, gain: 0.08 }))
        if (b < 14) subBass(ctx, bass, S.at(b, 0), r + 12, S.bar * 0.9, { gain: 0.3 })
        if (b >= 12) { const k = b - 12, div = [4, 8, 16, 16][k]; for (let i = 0; i < div; i++) snare(ctx, drums, S.at(b, i * 16 / div), { gain: 0.12 + k * 0.08 + i * 0.006, d: 0.08, rev: 0.25 }) }
      } else {
        // drop
        sawChord(ctx, syn, S.at(b, 0), notes, S.bar - 0.03, { gain: 0.045, lp: 7000 })
        S.hits(b, 'x...x...x...x...', (t) => { kick(ctx, drums, t, { gain: 0.95, f0: 170, f1: 48, d: 0.38, drive: 1.6 }); kicks.push(t) })
        S.hits(b, '....x.......x...', (t) => clap(ctx, drums, t, { gain: 0.5 }))
        S.hits(b, '..x...x...x...x.', (t) => hat(ctx, drums, t, { open: true, d: 0.18, gain: 0.1 }))
        S.hits(b, 'x.x.x.x.x.x.x.x.', (t) => hat(ctx, drums, t, { gain: 0.05 }))
        S.hits(b, '..x...x...x...x.', (t) => synthBass(ctx, bass, t, r + 12, S.len(1.8), { gain: 0.3, lp: 700, env: 2500, q: 2, unison: { n: 3, spread: 12 } }))
        S.melody(b, lead4[b % 4], (t, n, d) => pluck(ctx, syn, t, n, { gain: 0.09, d: Math.min(0.35, d * 1.2), lp: 2500, env: 5000, unison: { n: 3, spread: 10 }, rev: 0.25, dly: 0.2 }))
      }
    })
    riser(ctx, S.m, S.at(12, 0), S.bar * 4 - 0.02, { f: 110 })
    cymbal(ctx, drums, S.at(16, 0), { gain: 0.4, d: 2.2 })
    cymbal(ctx, drums, S.at(0, 0), { gain: 0.2, d: 1.5 })
    S.duck(syn, kicks, 0.55, 0.28); S.duck(bass, kicks, 0.8, 0.22)
  }),

  // ---------------------------------------------------------------- HOUSE
  M('gece-kulubu-house', 'Gece Kulübü (House)', 'elektronik', { bpm: 124, bars: 24, key: 'A min', mix: { revTime: 1.8, revGain: 0.4 }, tags: ['house', 'dans', 'kulüp', 'groove'] }, (S, ctx) => {
    const prog = ['Am7', 'Fmaj7', 'Dm7', 'Em7']
    const keys = S.bus(1), bass = S.bus(1), drums = S.bus(1)
    const kicks = []
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 2), notes = chordNotes(ch, 60, 76)
      S.hits(b, 'x...x...x...x...', (t) => { kick(ctx, drums, t, { gain: 0.9, f0: 150, f1: 48, d: 0.33 }); kicks.push(t) })
      if (b >= 2) S.hits(b, '....x.......x...', (t) => clap(ctx, drums, t, { gain: 0.42 }))
      if (b >= 2) S.hits(b, '..x...x...x...x.', (t) => hat(ctx, drums, t, { open: true, d: 0.14, gain: 0.1 }))
      S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => shaker(ctx, drums, t, { gain: i % 4 === 2 ? 0.08 : 0.045 }))
      if (b >= 4) S.hits(b, '...x..x...x.....', (t) => notes.forEach((n, i) => piano(ctx, keys, t + i * 0.004, n, { gain: 0.11, len: 1.2, dur: S.len(1.5), bright: 0.7, rev: 0.2 })))
      S.hits(b, 'x..x..x...x..x..', (t, c, i) => synthBass(ctx, bass, t, i === 3 || i === 13 ? r + 12 : r, S.len(1.6), { type: 'square', gain: 0.22, lp: 380, env: 900, envD: 0.1, q: 3 }))
      if (b >= 8 && b < 16) pad(ctx, keys, S.at(b, 0), notes, S.bar - 0.05, { gain: 0.04, lp: 1600, a: 0.2 })
      if (b >= 16) S.melody(b, ['E6:3 C6:3 A5:2 -:2 E6:2 D6:2 C6:2', 'C6:3 A5:3 F5:2 -:2 E5:2 F5:2 A5:2', 'D6:3 A5:3 F5:2 -:2 C6:2 A5:2 F5:2', 'B5:3 G5:3 E5:2 -:2 D6:2 B5:2 G5:2'][b % 4], (t, n) => pluck(ctx, keys, t, n, { type: 'square', gain: 0.06, d: 0.2, lp: 1500, env: 3500, dly: 0.25, rev: 0.2 }))
    })
    S.duck(keys, kicks, 0.35, 0.25); S.duck(bass, kicks, 0.5, 0.2)
  }),

  // ---------------------------------------------------------------- BOOM BAP
  M('eski-okul-boombap', 'Eski Okul (Boom Bap)', 'hiphop', { bpm: 90, bars: 16, key: 'C min', swing16: 0.14, mix: { highcut: 9000, revTime: 1.4, revGain: 0.35, drive: 1.3 }, tags: ['boom bap', 'rap', '90lar', 'eski okul'] }, (S, ctx) => {
    const prog = ['Cm9', 'Abmaj7', 'Fm9', 'G7b9']
    const keys = S.bus(1, { lp: 3200 }), drums = S.bus(1), bass = S.bus(1)
    noiseBed(ctx, S.m, 0, dur(S), { color: 'crackle', gain: 0.2, filters: [{ type: 'bandpass', f: 2200, q: 0.6 }] })
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], notes = chordNotes(ch, 55, 74), r = rootNote(ch, 2)
      for (const [st, l, g] of [[0, 6, 0.15], [7, 2, 0.1], [10, 4, 0.12]]) notes.forEach((n, i) => piano(ctx, keys, S.at(b, st) + i * 0.006, n, { gain: g, dur: S.len(l), len: 1.6, bright: 0.45, rev: 0.15 }))
      for (const [st, iv, l] of [[0, 0, 3], [6, 7, 2], [8, 0, 3], [14, -2, 2]]) synthBass(ctx, bass, S.at(b, st), r + iv, S.len(l), { type: 'triangle', gain: 0.4, lp: 700, env: 300, q: 1, sub: false })
      S.hits(b, b % 2 ? 'x......x.x......' : 'x.........x.....', (t) => kick(ctx, drums, t, { gain: 0.85, f0: 130, f1: 48, d: 0.3, click: 0.2 }))
      S.hits(b, '....x.......x...', (t) => { snare(ctx, drums, t, { gain: 0.5, d: 0.16, rev: 0.1 }); clap(ctx, drums, t, { gain: 0.15 }) })
      S.hits(b, 'x.x.x.x.x.x.x.x.', (t, c, i) => hat(ctx, drums, t, { gain: i % 4 === 0 ? 0.11 : 0.07, d: 0.05 }))
      if (b % 4 === 3) hat(ctx, drums, S.at(b, 15), { gain: 0.06 })
    })
  }),

  // ---------------------------------------------------------------- AMBİYANS
  M('bulutlarin-ustu', 'Bulutların Üstü (Ambiyans)', 'ambiyans', { bpm: 60, bars: 12, key: 'D maj', mix: { revTime: 4, revGain: 0.7, delayFb: 0.45 }, tail: 4, tags: ['ambiyans', 'sakin', 'rahatlatıcı', 'uzay'] }, (S, ctx) => {
    const prog = ['Dmaj9', 'Gmaj7', 'Bm9', 'Aadd9']
    const pads = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4]
      pad(ctx, pads, S.at(b, 0), chordNotes(ch, 57, 76), S.bar + 0.6, { type: 'triangle', gain: 0.06, a: 1.6, r: 2.2, lp: 2400, spread: 9, rev: 0.5 })
      pad(ctx, pads, S.at(b, 0), chordNotes(ch, 69, 88).slice(0, 3), S.bar + 0.6, { type: 'sine', gain: 0.035, a: 2, r: 2.4, rev: 0.6 })
      subBass(ctx, pads, S.at(b, 0), rootNote(ch, 2), S.bar, { gain: 0.25, r: 0.8 })
    })
    const pent = ['D', 'E', 'F#', 'A', 'B']
    let k = 0
    for (let t = 0.6; t < dur(S) - 1; t += 1.1 + ((k * 7) % 5) * 0.25) {
      const n = pent[(k * 3) % 5] + (5 + ((k * 5) % 3 === 0 ? 1 : 0))
      bell(ctx, S.m, t, n, { d: 2.4, gain: 0.05, ratio: 2, index: 0.8, rev: 0.6, dly: 0.35, pan: ((k * 37) % 100) / 60 - 0.8 })
      k++
    }
    noiseBed(ctx, S.m, 0, dur(S), { color: 'pink', gain: 0.03, filters: [{ type: 'bandpass', f: 4000, q: 0.7, lfo: [1 / 12, 1500] }], amp: [1 / 6, 0.5] })
  }),

  // ---------------------------------------------------------------- VLOG
  M('gune-basla', 'Güne Başla (Vlog)', 'vlog', { bpm: 118, bars: 16, key: 'C maj', mix: { revTime: 1.6, revGain: 0.4 }, tags: ['vlog', 'neşeli', 'pozitif', 'günlük'] }, (S, ctx) => {
    const prog = ['C', 'G', 'Am', 'F']
    const syn = S.bus(1), bass = S.bus(1), drums = S.bus(1)
    const kicks = []
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], notes = chordNotes(ch, 60, 76), r = rootNote(ch, 2)
      notes.forEach((n, i) => piano(ctx, syn, S.at(b, 0) + i * 0.008, n, { gain: 0.09, len: 2.2, dur: S.bar * 0.95, rev: 0.25 }))
      S.hits(b, '..x...x...x...x.', (t) => notes.forEach((n) => pluck(ctx, syn, t, n + 12, { type: 'square', gain: 0.035, d: 0.16, lp: 1800, env: 3000, rev: 0.2, dly: 0.1 })))
      S.hits(b, 'x.....x.x.....x.', (t, c, i) => synthBass(ctx, bass, t, r, S.len(i === 0 ? 4 : 1.8), { gain: 0.26, lp: 500, env: 1000, q: 2 }))
      S.hits(b, 'x...x...x...x...', (t) => { kick(ctx, drums, t, { gain: 0.65, f0: 130, f1: 50, d: 0.26 }); kicks.push(t) })
      if (b >= 2) S.hits(b, '....x.......x...', (t) => { clap(ctx, drums, t, { gain: 0.38 }); snap(ctx, drums, t + 0.01, { gain: 0.2 }) })
      S.hits(b, '..x...x...x...x.', (t) => hat(ctx, drums, t, { gain: 0.08 }))
    })
    const mel = 'G5:2 E5:2 G5:2 C6:4 G5:2 E5:2 C5:2 D5:2 G5:2 B5:4 D6:4 B5:2 G5:2 A5:2 C6:2 E6:4 D6:2 C6:2 A5:4 F5:2 A5:2 C6:4 A5:2 F5:2 G5:4'
    for (const off of [8, 12]) S.melody(off, mel, (t, n, d) => bell(ctx, syn, t, n, { d: Math.max(0.5, d * 1.5), gain: 0.08, ratio: 3.5, index: 1.4, rev: 0.25, dly: 0.12 }))
    S.duck(bass, kicks, 0.45, 0.2); S.duck(syn, kicks, 0.2, 0.2)
  }),

  // ---------------------------------------------------------------- MONTAJ
  M('montaj-atesi', 'Montaj Ateşi (Hype)', 'oyun', { bpm: 150, bars: 24, key: 'E min', mix: { revTime: 1.8, revGain: 0.4, threshold: -18, ratio: 4, drive: 1.2 }, tags: ['montaj', 'hype', 'oyun', 'agresif'] }, (S, ctx) => {
    const prog = ['Em', 'C', 'G', 'D']
    const syn = S.bus(1), b8 = S.bus(1), drums = S.bus(1)
    const kicks = []
    const lead4 = ['B5:3 G5:3 E5:2 F#5:3 G5:3 B5:2', 'C6:3 B5:3 G5:2 E5:4 G5:4', 'D6:3 B5:3 G5:2 B5:3 D6:3 G6:2', 'F#6:4 E6:2 D6:2 A5:4 F#5:4']
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], notes = chordNotes(ch, 59, 76), r = rootNote(ch, 1)
      const drop = (b >= 4 && b < 12) || b >= 16
      if (b < 4 || (b >= 12 && b < 16)) {
        sawChord(ctx, syn, S.at(b, 0), notes, S.bar - 0.03, { gain: 0.04, lp: 900 + (b % 4) * 500 })
        if (b >= 12) S.melody(b, lead4[b % 4], (t, n, d) => pluck(ctx, syn, t, n, { gain: 0.06, d: 0.25, lp: 1500, env: 2500, dly: 0.25, rev: 0.3 }))
        const k = b % 4; for (let i = 0; i < [4, 8, 8, 16][k]; i++) snare(ctx, drums, S.at(b, i * 16 / [4, 8, 8, 16][k]), { gain: 0.12 + k * 0.07, d: 0.08 })
      }
      if (drop) {
        sawChord(ctx, syn, S.at(b, 0), notes, S.bar - 0.03, { gain: 0.04, lp: 6500 })
        const sh = b >= 16 ? 12 : 0
        S.melody(b, lead4[b % 4], (t, n, d) => lead(ctx, syn, t, n + sh, d * 0.9, { type: 'sawtooth', gain: 0.07, unison: { n: 3, spread: 16 }, lp: 4000, vibDepth: 3, dly: 0.12, rev: 0.2 }))
        S.hits(b, 'x.........x..x..', (t, c, i) => { kick(ctx, drums, t, { gain: 0.95, f0: 170, f1: 50, d: 0.3, drive: 1.8 }); kicks.push(t) })
        bass808(ctx, b8, S.at(b, 0), r, S.len(8), { gain: 0.8, drive: 3 })
        bass808(ctx, b8, S.at(b, 10), r + 12, S.len(3), { gain: 0.6, glideFrom: r, drive: 3 })
        bass808(ctx, b8, S.at(b, 13), r, S.len(3), { gain: 0.7, glideFrom: r + 12, drive: 3 })
        S.hits(b, '........x.......', (t) => { snare(ctx, drums, t, { gain: 0.55, d: 0.2 }); clap(ctx, drums, t, { gain: 0.4 }) })
        S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => hat(ctx, drums, t, { gain: i % 2 ? 0.05 : 0.09 }))
        if (b % 2) for (let k = 0; k < 6; k++) hat(ctx, drums, S.at(b, 12) + k * S.s16 * 2 / 3, { gain: 0.06 })
      }
    })
    riser(ctx, S.m, S.at(2, 0), S.bar * 2 - 0.02, { f: 110 })
    riser(ctx, S.m, S.at(14, 0), S.bar * 2 - 0.02, { f: 110 })
    for (const b of [4, 16]) cymbal(ctx, drums, S.at(b, 0), { gain: 0.35, d: 2 })
    S.duck(syn, kicks, 0.45, 0.25)
  }),

  // ---------------------------------------------------------------- HÜZÜNLÜ PİYANO
  M('yagmurlu-pencere', 'Yağmurlu Pencere (Hüzünlü Piyano)', 'duygusal', { bpm: 70, bars: 12, key: 'A min', mix: { revTime: 3, revGain: 0.6 }, tags: ['hüzünlü', 'piyano', 'duygusal', 'yağmur'] }, (S, ctx) => {
    const prog = ['Am', 'F', 'C', 'G']
    const pno = S.bus(1), str = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 2), up = chordNotes(ch, 60, 76)
      piano(ctx, pno, S.at(b, 0), r, { gain: 0.24, len: 3.5, rev: 0.3 })
      piano(ctx, pno, S.at(b, 8), r + 7, { gain: 0.16, len: 3, rev: 0.3 })
      const ord = [0, 1, 2, 1, 2, 3 % up.length, 2, 1]
      for (let i = 0; i < 8; i++) piano(ctx, pno, S.at(b, i * 2), up[ord[i] % up.length] + (i === 5 ? 12 : 0) - (up[ord[i] % up.length] > 74 ? 12 : 0), { gain: 0.1, len: 2.5, rev: 0.35 })
      if (b >= 4) chordNotes(ch, 52, 69).forEach((n) => strings(ctx, str, S.at(b, 0), n, S.bar - 0.05, { gain: 0.03, a: 0.8, r: 1, lp: 1800 }))
    })
    S.melody(4, 'E5:4 D5:4 C5:6 B4:2 A4:8 C5:8 G4:4 C5:4 E5:4 G5:4 F5:6 E5:2 D5:8', (t, n) => piano(ctx, pno, t, n + 12, { gain: 0.2, len: 3, rev: 0.4 }))
    S.melody(8, 'E5:4 A5:4 G5:4 E5:4 F5:6 E5:2 C5:8 E5:4 G5:4 C6:6 B5:2 B5:8 D5:8', (t, n) => piano(ctx, pno, t, n + 12, { gain: 0.2, len: 3, rev: 0.4 }))
    noiseBed(ctx, S.m, 0, dur(S), { color: 'pink', gain: 0.03, filters: [{ type: 'highpass', f: 800 }, { type: 'lowpass', f: 7000 }] })
  }),

  // ---------------------------------------------------------------- ZAFER
  M('sampiyonluk', 'Şampiyonluk (Zafer Teması)', 'sinematik', { bpm: 120, bars: 16, key: 'C maj', mix: { revTime: 2.6, revGain: 0.55 }, tags: ['zafer', 'şampiyon', 'kutlama', 'orkestra'] }, (S, ctx) => {
    const prog = ['C', 'F', 'G', 'C', 'Am', 'F', 'G7', 'C']
    const mel = ['G4:3 G4:1 C5:4 E5:4 G5:4', 'A5:6 G5:2 F5:4 C5:4', 'D5:3 D5:1 G5:4 B5:4 D6:4', 'C6:12 -:4', 'E5:3 E5:1 A5:4 C6:4 E6:4', 'F6:6 E6:2 C6:4 A5:4', 'G5:4 B5:4 D6:4 F6:4', 'E6:8 C6:8']
    const orch = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 2)
      S.melody(b, mel[b % 8], (t, n, d) => brass(ctx, orch, t, n, d * 0.92, { gain: 0.12, a: 0.025 }))
      if (b >= 8) S.melody(b, mel[b % 8], (t, n, d) => strings(ctx, orch, t, n + 12, d * 0.95, { gain: 0.06, a: 0.05 }))
      chordNotes(ch, 55, 72).forEach((n) => strings(ctx, orch, S.at(b, 0), n, S.bar - 0.05, { gain: 0.035, a: 0.15 }))
      brass(ctx, orch, S.at(b, 0), r, S.len(7), { gain: 0.09, lp: 500 }); brass(ctx, orch, S.at(b, 8), r + 7 - 12, S.len(7), { gain: 0.08, lp: 500 })
      S.hits(b, 'x.......x.......', (t) => tone(ctx, perc, { t, f: nf(ch[0] + '2') * 1.0, f1: nf(ch[0] + '2') * 0.92, glideT: 0.2, a: 0.002, d: 1, gain: 0.5, rev: 0.25 }))
      S.hits(b, 'x..x..x.x.xxx.x.', (t, c, i) => snare(ctx, perc, t, { gain: [0, 8].includes(i) ? 0.3 : 0.16, d: 0.09, rev: 0.2 }))
      if (b % 8 === 0) cymbal(ctx, perc, S.at(b, 0), { gain: 0.35, d: 2 })
      if (b % 8 === 7) cymbal(ctx, perc, S.at(b, 8), { gain: 0.15, d: 1 })
    })
  }),

  // ---------------------------------------------------------------- AKSİYON
  M('kovalamaca', 'Kovalamaca (Aksiyon)', 'sinematik', { bpm: 160, bars: 24, key: 'D min', mix: { revTime: 2, revGain: 0.45 }, tags: ['aksiyon', 'kovalamaca', 'hızlı', 'heyecan'] }, (S, ctx) => {
    const prog = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A']
    const orch = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 2)
      const pat = [0, 0, 12, 0, 7, 0, 12, 10]
      for (let i = 0; i < 8; i++) strings(ctx, orch, S.at(b, i * 2), r + pat[i], S.len(1.4), { a: 0.008, r: 0.08, gain: 0.085, lp: 1800 })
      for (let i = 0; i < 16; i++) pluck(ctx, orch, S.at(b, i), r + 24 + [0, 7, 12, 7][i % 4] + (ch === 'A' && i % 4 === 1 ? 0 : 0), { type: 'sawtooth', gain: 0.03, d: 0.1, lp: 1500, env: 2000, pan: 0.3 })
      if (b % 2 === 0) S.hits(b, 'x..x..x.........', (t) => chordNotes(ch === 'A' ? 'A' : ch, 50, 67).forEach((n) => brass(ctx, orch, t, n, S.len(1.6), { gain: 0.07, a: 0.01, lp: 900, env: 3000 })))
      if (b >= 8) chordNotes(ch, 62, 79).forEach((n) => strings(ctx, orch, S.at(b, 0), n, S.bar - 0.05, { gain: 0.025, a: 0.2 }))
      S.hits(b, 'x..x..x.x..x..x.', (t) => kick(ctx, perc, t, { gain: 0.75, f0: 120, f1: 45, d: 0.3 }))
      S.hits(b, '....x.......x...', (t) => snare(ctx, perc, t, { gain: 0.42, d: 0.16, rev: 0.25 }))
      S.hits(b, 'x.x.x.x.x.x.x.x.', (t) => hat(ctx, perc, t, { gain: 0.06 }))
      if (b % 4 === 3) S.hits(b, '........x.x.xxxx', (t, c, i) => tom(ctx, perc, t, 180 - i * 6, { gain: 0.5, d: 0.25 }))
      if (b % 8 === 0) cymbal(ctx, perc, S.at(b, 0), { gain: 0.3, d: 1.8 })
    })
  }),

  // ---------------------------------------------------------------- BOSSA
  M('kafe-kosesi', 'Kafe Köşesi (Bossa Nova)', 'lofi', { bpm: 130, bars: 16, key: 'G maj', mix: { revTime: 1.4, revGain: 0.35 }, tags: ['bossa nova', 'kafe', 'caz', 'sakin'] }, (S, ctx) => {
    const prog = ['Gmaj7', 'Gmaj7', 'Am7', 'D7', 'Bm7', 'E7', 'Am7', 'D7']
    const gtr = S.bus(1), bass = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 2), v = chordNotes(ch, 57, 72)
      const hitsA = b % 2 ? [0, 4, 7, 10, 14] : [2, 6, 9, 12]
      for (const st of hitsA) v.forEach((n, i) => string(ctx, gtr, S.at(b, st) + i * 0.007, n, { gain: 0.13, bright: 0.35, damp: 0.994, len: 1, dur: S.len(2.2), rev: 0.15, seed: st }))
      string(ctx, bass, S.at(b, 0), r, { gain: 0.35, bright: 0.25, damp: 0.997, len: 1.6, dur: S.len(6) })
      string(ctx, bass, S.at(b, 8), r + 7 - 12 < 36 ? r + 7 : r + 7 - 12, { gain: 0.3, bright: 0.25, damp: 0.997, len: 1.6, dur: S.len(6) })
      subBass(ctx, bass, S.at(b, 0), r, S.len(6), { gain: 0.25 }); subBass(ctx, bass, S.at(b, 8), r + 7 - 12 < 36 ? r + 7 : r + 7 - 12, S.len(6), { gain: 0.22 })
      S.hits(b, b % 2 ? '..x..x...x..x...' : 'x..x..x...x..x..', (t) => rim(ctx, perc, t, { gain: 0.14, pan: -0.25 }))
      S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => shaker(ctx, perc, t, { gain: i % 4 === 0 ? 0.09 : 0.05, pan: 0.3 }))
