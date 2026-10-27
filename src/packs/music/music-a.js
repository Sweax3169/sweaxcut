// Müzik parçaları (1/2) — lo-fi, trap, phonk, drill, chiptune, synthwave, sinematik, ukulele, gerilim, korku
import * as D0 from '../sfx/dsp.js'
import * as V0 from '../sfx/voices.js'
import { riser as riser0 } from '../sfx/sfx-a.js'
import { lazy, lazyAll } from './lazy.js'
import { M, chordNotes, rootNote } from './seq.js'

const { kick, snare, clap, hat, rim, tom, cymbal, cowbell, shaker, snap, chipNoise, bass808, subBass, synthBass, pluck, string, piano, pad, lead, bell, epiano, brass, strings, chip } = lazyAll(V0)
const tone = lazy(D0.tone, (a) => a[2].t), noise = lazy(D0.noise, (a) => a[2].t), noiseBed = lazy(D0.noiseBed), riser = lazy(riser0)
const { nf, pulseWave } = D0

const dur = (S) => S.bars * S.bar

export default [
  // ---------------------------------------------------------------- LO-FI
  M('lofi-gece-yarisi', 'Gece Yarısı Lo-fi', 'lofi', { bpm: 80, bars: 16, key: 'C maj', swing8: 0.2, mix: { highcut: 7800, revTime: 1.8 }, tags: ['lofi', 'sakin', 'ders', 'gece'] }, (S, ctx) => {
    const prog = ['Dm9', 'G9', 'Cmaj9', 'Am9']
    const keys = S.bus(1), drums = S.bus(1, { lp: 8500 }), bass = S.bus(1)
    noiseBed(ctx, S.m, 0, dur(S), { color: 'crackle', gain: 0.22, filters: [{ type: 'bandpass', f: 2500, q: 0.6 }] })
    noiseBed(ctx, S.m, 0, dur(S), { color: 'pink', gain: 0.018, filters: [{ type: 'lowpass', f: 5000 }] })
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], notes = chordNotes(ch, 57, 76), r = rootNote(ch, 2)
      notes.forEach((n, i) => epiano(ctx, keys, S.at(b, 0) + i * 0.014, n, S.len(9), { gain: 0.1 }))
      notes.slice(1).forEach((n, i) => epiano(ctx, keys, S.at(b, 11) + i * 0.01, n, S.len(3), { gain: 0.05 }))
      subBass(ctx, bass, S.at(b, 0), r, S.len(6), { gain: 0.5 })
      subBass(ctx, bass, S.at(b, 10), r, S.len(2), { gain: 0.4 })
      subBass(ctx, bass, S.at(b, 12), r + 7, S.len(3), { gain: 0.42 })
      S.hits(b, b % 4 === 3 ? 'x......x..x...x.' : 'x......x..x.....', (t) => kick(ctx, drums, t, { gain: 0.75, f0: 120, f1: 46, d: 0.32, click: 0.12 }))
      S.hits(b, '....x.......x...', (t) => { snare(ctx, drums, t, { gain: 0.32, d: 0.14, rev: 0.12 }); rim(ctx, drums, t, { gain: 0.12 }) })
      S.hits(b, 'x.x.x.x.x.x.x.x.', (t, c, i) => hat(ctx, drums, t, { gain: i % 4 === 0 ? 0.1 : 0.065, d: 0.04 }))
    })
    const mel = 'E5:4 D5:2 C5:2 A4:6 -:2 G4:2 A4:2 C5:4 D5:6 -:2 E5:3 G5:3 E5:2 D5:4 C5:4 A4:12 -:4'
    for (const off of [8, 12]) S.melody(off, mel, (t, n, d) => bell(ctx, keys, t, n, { d: Math.max(0.7, d * 1.6), gain: 0.085, ratio: 2, index: 1.1, rev: 0.35, dly: 0.18 }))
  }),

  // ---------------------------------------------------------------- TRAP
  M('trap-sokak-krali', 'Sokak Kralı (Trap)', 'hiphop', { bpm: 140, bars: 20, key: 'C# min', mix: { revTime: 2 }, tags: ['trap', '808', 'rap', 'karanlık'] }, (S, ctx) => {
    const prog = ['C#m', 'C#m', 'A', 'A', 'F#m', 'F#m', 'G#', 'G#']
    const mel = {
      'C#m': 'G#5:2 C#6:2 E6:2 C#6:2 G#5:2 B5:2 G#5:2 F#5:2 E5:4 F#5:2 G#5:6 -:4',
      A: 'E6:2 C#6:2 A5:2 C#6:2 E6:2 F#6:2 E6:2 C#6:2 B5:4 C#6:2 A5:6 -:4',
      'F#m': 'F#5:2 A5:2 C#6:2 A5:2 F#5:2 G#5:2 A5:2 C#6:2 B5:4 A5:2 F#5:6 -:4',
      'G#': 'G#5:2 C6:2 D#6:2 C6:2 G#5:2 D#5:2 G#5:2 C6:2 D#6:4 C6:2 G#5:6 -:4',
    }
    const music = S.bus(1), drums = S.bus(1), b8 = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 1)
      if (b % 2 === 0) {
        S.melody(b, mel[ch], (t, n, d) => bell(ctx, music, t, n, { d: Math.max(0.5, d * 1.4), gain: 0.1, ratio: 3.5, index: 1.8, rev: 0.3, dly: 0.12 }))
        pad(ctx, music, S.at(b, 0), chordNotes(ch, 52, 67), S.bar * 2 - 0.1, { gain: 0.045, lp: 900, a: 0.4 })
      }
      if (b < 2) return
      // 808
      const next = rootNote(prog[(b + 1) % 8], 1)
      bass808(ctx, b8, S.at(b, 0), r, S.len(6), { gain: 0.8 })
      bass808(ctx, b8, S.at(b, 7), r + 12, S.len(2), { gain: 0.6, glideFrom: r })
      bass808(ctx, b8, S.at(b, 10), r, S.len(b % 2 ? 4 : 6), { gain: 0.75, glideFrom: r + 12 })
      if (b % 2 === 1) bass808(ctx, b8, S.at(b, 14), next, S.len(2), { gain: 0.7, glideFrom: r })
      S.hits(b, b % 2 ? 'x.........x..x..' : 'x......x..x.....', (t) => kick(ctx, drums, t, { gain: 0.8, f0: 140, f1: 50, d: 0.25 }))
      S.hits(b, '........x.......', (t) => { clap(ctx, drums, t, { gain: 0.45 }); snare(ctx, drums, t, { gain: 0.25 }) })
      // hi-hat + rulolar
      for (let i = 0; i < 16; i += 2) hat(ctx, drums, S.at(b, i), { gain: i % 4 === 0 ? 0.13 : 0.09 })
      if (b % 2 === 1) { for (let k = 0; k < 6; k++) hat(ctx, drums, S.at(b, 12) + k * S.s16 * 2 / 3, { gain: 0.06 + k * 0.012 }) }
      else { for (let k = 0; k < 4; k++) hat(ctx, drums, S.at(b, 6) + k * S.s16 / 2, { gain: 0.07 }) }
      if (b % 4 === 3) hat(ctx, drums, S.at(b, 14), { open: true, gain: 0.1 })
    })
    S.duck(music, Array.from({ length: S.bars }, (_, b) => S.at(b, 8)), 0.25, 0.2)
  }),

  // ---------------------------------------------------------------- PHONK
  M('drift-phonk', 'Drift Phonk', 'hiphop', { bpm: 128, bars: 16, key: 'F# min', mix: { drive: 1.4, revTime: 1.4 }, tags: ['phonk', 'drift', 'cowbell', 'araba'] }, (S, ctx) => {
    const prog = ['F#m', 'F#m', 'D', 'E']
    const A = 'F#5:3 F#5:3 A5:2 G#5:2 F#5:2 C#6:2 B5:2', B = 'A5:3 G#5:3 F#5:2 E5:2 F#5:4 C#5:2'
    const bells = S.bus(1), drums = S.bus(1), b8 = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 1)
      S.melody(b, b % 2 ? B : A, (t, n) => cowbell(ctx, bells, t, n, 0.16, { gain: 0.22, rev: 0.12, dly: 0.12, pan: 0.1 }))
      if (b < 1) return
      S.hits(b, 'x.....x...x.x...', (t, c, i) => bass808(ctx, b8, t, r, S.len(i === 0 ? 5 : 2), { gain: 0.8, drive: 4, lp: 2200 }))
      S.hits(b, 'x.....x.x.......', (t) => kick(ctx, drums, t, { gain: 0.85, f0: 170, f1: 52, d: 0.22, drive: 2 }))
      S.hits(b, '....x.......x...', (t) => { snare(ctx, drums, t, { gain: 0.4, d: 0.12 }); clap(ctx, drums, t, { gain: 0.35, d: 0.1 }) })
      S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => hat(ctx, drums, t, { gain: i % 2 === 0 ? 0.1 : 0.05, d: 0.03 }))
      if (b % 4 === 3) S.hits(b, '............xxxx', (t) => snare(ctx, drums, t, { gain: 0.2, d: 0.06 }))
      if (b % 2 === 1) hat(ctx, drums, S.at(b, 14), { open: true, gain: 0.08 })
    })
  }),

  // ---------------------------------------------------------------- DRILL
  M('drill-gece-devriyesi', 'Gece Devriyesi (Drill)', 'hiphop', { bpm: 142, bars: 20, key: 'G min', mix: { revTime: 2.2 }, tags: ['drill', 'uk drill', 'karanlık', 'rap'] }, (S, ctx) => {
    const prog = ['Gm', 'Gm', 'Eb', 'Eb', 'Cm', 'Cm', 'D', 'D']
    const keys = S.bus(1), drums = S.bus(1), b8 = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], notes = chordNotes(ch, 55, 70), r = rootNote(ch, 1)
      const order = [0, 1, 2, 1, 0, 2, 1, 2]
      for (let i = 0; i < 8; i++) piano(ctx, keys, S.at(b, i * 2), notes[order[i] % notes.length], { gain: i % 4 === 0 ? 0.16 : 0.11, len: 1.4, dur: S.len(3), filter: { type: 'lowpass', f: 2600 } })
      if (b % 2 === 0) for (const n of chordNotes(ch, 62, 79)) strings(ctx, keys, S.at(b, 0), n, S.bar * 2 - 0.1, { gain: 0.035, a: 0.6 })
      if (b < 2) return
      bass808(ctx, b8, S.at(b, 0), r, S.len(3), { gain: 0.8 })
      bass808(ctx, b8, S.at(b, 3), r + 7, S.len(5), { gain: 0.7, glideFrom: r, glideT: 0.12 })
      bass808(ctx, b8, S.at(b, 8), r + 12, S.len(4), { gain: 0.65, glideFrom: r + 7, glideT: 0.1 })
      bass808(ctx, b8, S.at(b, 13), r, S.len(3), { gain: 0.75, glideFrom: r + 12, glideT: 0.15 })
      S.hits(b, b % 2 ? 'x..........x....' : 'x.........x.....', (t) => kick(ctx, drums, t, { gain: 0.7, f0: 150, f1: 50, d: 0.2 }))
      S.hits(b, '........x.....x.', (t, c, i) => { snare(ctx, drums, t, { gain: i === 8 ? 0.5 : 0.2, d: 0.13 }); if (i === 8) clap(ctx, drums, t, { gain: 0.3 }) })
      S.hits(b, 'x..x..x...x..x..', (t, c, i) => hat(ctx, drums, t, { gain: 0.11 }))
      if (b % 4 === 1) for (let k = 0; k < 3; k++) hat(ctx, drums, S.at(b, 14) + k * S.s16 * 2 / 3, { gain: 0.07 })
    })
  }),

  // ---------------------------------------------------------------- CHIPTUNE
  M('piksel-macerasi', 'Piksel Macerası (Chiptune)', 'oyun', { bpm: 150, bars: 24, key: 'C maj', mix: { revTime: 0.9, revGain: 0.25 }, tags: ['8-bit', 'chiptune', 'retro', 'macera'] }, (S, ctx) => {
    const progA = ['C', 'Am', 'F', 'G'], progB = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C']
    const melA = [
      'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'A5:2 C6:2 E6:4 D6:4 C6:4', 'A5:2 F5:2 A5:2 C6:2 B5:4 A5:4', 'G5:4 B5:2 D6:2 G6:6 -:2',
      'E6:2 D6:2 C6:2 G5:2 E5:4 G5:4', 'A5:2 B5:2 C6:2 E6:2 D6:4 C6:4', 'F5:2 A5:2 C6:2 F6:2 E6:4 D6:4', 'D6:2 B5:2 G5:4 D5:2 G5:2 B5:4',
    ]
    const melB = ['C6:6 A5:2 F5:8', 'D6:6 B5:2 G5:8', 'E6:4 D6:4 B5:4 G5:4', 'A5:4 C6:4 E6:8', 'F6:4 E6:4 C6:4 A5:4', 'G6:4 F6:4 D6:4 B5:4', 'C6:2 E6:2 G6:2 C7:2 G6:4 E6:4', 'C6:12 -:4']
    const p25 = pulseWave(ctx, 0.25), p12 = pulseWave(ctx, 0.125)
    const mus = S.bus(1), drums = S.bus(1)
    S.range(0, S.bars, (b) => {
      const inB = b >= 16
      const ch = inB ? progB[b - 16] : progA[b % 4]
      const melS = inB ? melB[b - 16] : melA[b % 8]
      S.melody(b, melS, (t, n, d) => chip(ctx, mus, t, n, d * 0.92, { wave: b >= 8 && b < 16 ? p12 : p25, gain: 0.11, vib: d > S.len(3), dly: 0.1 }))
      if (b >= 8 && b < 16) S.melody(b, melS, (t, n, d) => chip(ctx, mus, t, n - 12, d * 0.9, { wave: p25, gain: 0.05 }))
      const r = rootNote(ch, 2)
      for (let i = 0; i < 8; i++) chip(ctx, mus, S.at(b, i * 2), i % 2 ? r + 12 : r, S.len(1.6), { type: 'triangle', gain: 0.24, s: 1, d: 0.1 })
      const arp = chordNotes(ch, 67, 82)
      for (let i = 0; i < 16; i++) chip(ctx, mus, S.at(b, i), arp[i % arp.length], S.len(0.8), { wave: p12, gain: 0.035, pan: 0.3 })
      S.hits(b, 'x.....x.x.......', (t) => chipNoise(ctx, drums, t, { d: 0.07, gain: 0.35, f: 500 }))
      S.hits(b, '....x.......x...', (t) => chipNoise(ctx, drums, t, { d: 0.11, gain: 0.28, f: 1600, hp: true }))
      S.hits(b, 'x.x.x.x.x.x.x.x.', (t, c, i) => chipNoise(ctx, drums, t, { d: 0.025, gain: i % 4 ? 0.07 : 0.1, f: 7000, hp: true }))
    })
  }),

  M('boss-savasi', 'Boss Savaşı (8-bit)', 'oyun', { bpm: 168, bars: 32, key: 'D min', mix: { revTime: 0.8, revGain: 0.25 }, tags: ['8-bit', 'boss', 'savaş', 'aksiyon'] }, (S, ctx) => {
    const prog = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm', 'A']
    const lead8 = [
      'D5:2 F5:2 A5:2 D6:2 C#6:4 A5:4', 'D6:2 E6:2 F6:2 E6:2 D6:2 C#6:2 A5:4', 'Bb5:4 A5:2 G5:2 F5:4 D5:4', 'E5:2 F5:2 G5:2 A5:2 C#6:8',
      'D6:4 A5:4 F5:4 D5:4', 'F5:2 G5:2 A5:2 Bb5:2 A5:4 F5:4', 'G5:2 Bb5:2 D6:2 G6:2 F6:4 D6:4', 'E6:2 D6:2 C#6:2 Bb5:2 A5:8',
    ]
    const p25 = pulseWave(ctx, 0.25), p12 = pulseWave(ctx, 0.125)
    const mus = S.bus(1), drums = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 8], r = rootNote(ch, 2), sec = Math.floor(b / 8)
      const pat = [0, 0, 12, 0, 0, 12, 10, 12]
      for (let i = 0; i < 8; i++) chip(ctx, mus, S.at(b, i * 2), r + pat[i], S.len(1.7), { type: 'triangle', gain: 0.26, s: 1, d: 0.1 })
      if (sec !== 1) {
        const sh = sec === 3 ? 12 : 0
        S.melody(b, lead8[b % 8], (t, n, d) => chip(ctx, mus, t, n + sh, d * 0.93, { wave: p25, gain: 0.11, vib: d > S.len(3), dly: 0.08 }))
        if (sec === 2) S.melody(b, lead8[b % 8], (t, n, d) => chip(ctx, mus, t, n - 3 + (ch === 'A' ? -1 : 0), d * 0.9, { wave: p12, gain: 0.045 }))
      } else {
        const arp = chordNotes(ch === 'A' ? 'A7' : ch, 62, 81)
        for (let i = 0; i < 16; i++) chip(ctx, mus, S.at(b, i), arp[(i * (i % 2 ? 1 : 2)) % arp.length], S.len(0.9), { wave: p25, gain: 0.07, pan: -0.2 })
      }
      S.hits(b, 'x...x...x...x...', (t) => chipNoise(ctx, drums, t, { d: 0.06, gain: 0.35, f: 450 }))
      S.hits(b, '....x.......x..x', (t) => chipNoise(ctx, drums, t, { d: 0.1, gain: 0.26, f: 1500, hp: true }))
      S.hits(b, 'x.x.x.x.x.x.x.x.', (t) => chipNoise(ctx, drums, t, { d: 0.02, gain: 0.08, f: 7500, hp: true }))
      if (b % 8 === 0) chipNoise(ctx, drums, S.at(b, 0), { d: 0.5, gain: 0.2, f: 3000, hp: true })
    })
  }),

  // ---------------------------------------------------------------- SYNTHWAVE
  M('neon-otoyol', 'Neon Otoyol (Synthwave)', 'elektronik', { bpm: 100, bars: 16, key: 'A min', mix: { revTime: 2.6, revGain: 0.55 }, tags: ['synthwave', 'retro', '80ler', 'gece'] }, (S, ctx) => {
    const prog = ['Am', 'F', 'C', 'G']
    const mus = S.bus(1), bass = S.bus(1), drums = S.bus(1)
    const kicks = []
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 2), notes = chordNotes(ch, 57, 72)
      pad(ctx, mus, S.at(b, 0), notes, S.bar - 0.05, { gain: 0.055, lp: 1800, a: 0.3, r: 0.6 })
      for (let i = 0; i < 8; i++) synthBass(ctx, bass, S.at(b, i * 2), i % 2 ? r + 12 : r, S.len(1.6), { gain: 0.24, lp: 500, env: 1800, envD: 0.12, q: 4 })
      const arp = [...chordNotes(ch, 64, 79), ...chordNotes(ch, 76, 88)]
      for (let i = 0; i < 16; i++) pluck(ctx, mus, S.at(b, i), arp[i % arp.length], { gain: 0.045, d: 0.18, lp: 1200, env: 3000, dly: 0.25, pan: i % 2 ? 0.35 : -0.35, rev: 0.2 })
      S.hits(b, b % 4 === 3 ? 'x.......x.....x.' : 'x.......x.......', (t) => { kick(ctx, drums, t, { gain: 0.85, f0: 130, f1: 48, d: 0.35 }); kicks.push(t) })
      S.hits(b, '....x.......x...', (t) => snare(ctx, drums, t, { gain: 0.45, d: 0.22, rev: 0.5 }))
      S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => hat(ctx, drums, t, { gain: i % 4 === 2 ? 0.08 : 0.045, d: 0.035 }))
    })
    const mel = 'E5:6 D5:2 C5:4 B4:4 A4:6 C5:2 F5:8 G5:6 F5:2 E5:4 C5:4 D5:8 B4:8'
    for (const off of [8, 12]) S.melody(off, mel, (t, n, d) => lead(ctx, mus, t, n, d * 0.95, { type: 'sawtooth', gain: 0.075, unison: { n: 3, spread: 12 }, lp: 3200, dly: 0.25, rev: 0.3 }))
    S.duck(bass, kicks, 0.5, 0.25); S.duck(mus, kicks, 0.3, 0.3)
  }),

  // ---------------------------------------------------------------- SİNEMATİK
  M('destansi-yukselis', 'Destansı Yükseliş', 'sinematik', { bpm: 92, bars: 16, key: 'D min', mix: { revTime: 3.2, revGain: 0.6 }, tags: ['epik', 'sinematik', 'orkestra', 'trailer'] }, (S, ctx) => {
    const prog = ['Dm', 'Bb', 'F', 'C']
    const orch = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], r = rootNote(ch, 2), lvl = 0.5 + b / 30
      const pat = [0, 0, 12, 0, 7, 0, 12, 7]
      for (let i = 0; i < 8; i++) strings(ctx, orch, S.at(b, i * 2), r + pat[i], S.len(1.5), { a: 0.012, r: 0.12, gain: 0.07 * lvl, lp: 1600 })
      if (b >= 4) for (const n of chordNotes(ch, 62, 81)) strings(ctx, orch, S.at(b, 0), n, S.bar - 0.05, { gain: 0.03 * lvl, a: 0.4 })
      if (b >= 4) pad(ctx, orch, S.at(b, 0), chordNotes(ch, 55, 72), S.bar - 0.05, { type: 'triangle', gain: 0.035, lp: 2400, a: 0.5 })
      if (b >= 8) for (const n of chordNotes(ch, 50, 65)) brass(ctx, orch, S.at(b, 0), n, S.bar * 0.95, { gain: 0.05 + (b - 8) * 0.006, a: 0.3, lp: 700 })
      S.hits(b, b < 8 ? 'x.......x.......' : b < 12 ? 'x.....x.x...x...' : 'x..x..x.x.x.xxxx', (t, c, i) => tom(ctx, perc, t, i % 8 === 0 ? 62 : 85, { gain: 0.55 + b * 0.02, d: 0.5, rev: 0.3 }))
      if (b >= 12) for (let i = 0; i < 16; i++) snare(ctx, perc, S.at(b, i), { gain: 0.06 + (b - 12) * 0.03 + i * 0.004, d: 0.08, rev: 0.25 })
    })
    S.melody(8, 'D5:8 F5:4 E5:4 D5:6 C5:2 Bb4:8 A4:8 C5:4 F5:4 E5:8 G5:8', (t, n, d) => brass(ctx, orch, t, n, d * 0.95, { gain: 0.1, a: 0.06 }))
    S.melody(12, 'D6:8 F6:4 E6:4 D6:6 C6:2 Bb5:8 A5:8 C6:4 F6:4 E6:8 G6:8', (t, n, d) => strings(ctx, orch, t, n, d * 0.95, { gain: 0.07, a: 0.1 }))
    S.melody(12, 'D5:8 F5:4 E5:4 D5:6 C5:2 Bb4:8 A4:8 C5:4 F5:4 E5:8 G5:8', (t, n, d) => brass(ctx, orch, t, n, d * 0.95, { gain: 0.11, a: 0.05 }))
    cymbal(ctx, perc, S.at(0, 0), { gain: 0.3, d: 2.4 })
    noise(ctx, S.m, { t: S.at(15, 0), pts: [[0, 0], [S.bar * 0.9, 0.5], [S.bar, 0]], gain: 0.3, filter: { type: 'highpass', f: 4000 }, rev: 0.3 })
  }),

  // ---------------------------------------------------------------- UKULELE
  M('gunesli-sabah', 'Güneşli Sabah (Ukulele)', 'eglenceli', { bpm: 112, bars: 16, key: 'C maj', mix: { revTime: 1.4, revGain: 0.4 }, tags: ['ukulele', 'mutlu', 'neşeli', 'vlog'] }, (S, ctx) => {
    const prog = ['C', 'G', 'Am', 'F']
    const uke = { C: ['G4', 'C4', 'E4', 'C5'], G: ['G4', 'D4', 'G4', 'B4'], Am: ['A4', 'C4', 'E4', 'A4'], F: ['A4', 'C4', 'F4', 'A4'] }
    const gtr = S.bus(1), perc = S.bus(1), mel = S.bus(1)
    S.range(0, S.bars, (b) => {
      const ch = prog[b % 4], v = uke[ch]
      const strum = [[0, 'D', 0.32], [4, 'D', 0.26], [6, 'U', 0.18], [10, 'U', 0.2], [12, 'D', 0.26], [14, 'U', 0.17]]
      for (const [st, dir, g] of strum) {
        const ord = dir === 'D' ? v : [...v].reverse()
        ord.forEach((n, i) => string(ctx, gtr, S.at(b, st) + i * 0.011, n, { gain: g, bright: 0.5, damp: 0.993, len: 1.2, rev: 0.15, seed: st }))
      }
      subBass(ctx, perc, S.at(b, 0), rootNote(ch, 2), S.len(6), { gain: 0.35 })
      subBass(ctx, perc, S.at(b, 8), rootNote(ch, 2) + 7, S.len(6), { gain: 0.3 })
      S.hits(b, 'x.......x.......', (t) => kick(ctx, perc, t, { gain: 0.55, f0: 110, f1: 50, d: 0.25, click: 0.1 }))
      if (b >= 4) S.hits(b, '....x.......x...', (t) => clap(ctx, perc, t, { gain: 0.32 }))
      S.hits(b, 'xxxxxxxxxxxxxxxx', (t, c, i) => shaker(ctx, perc, t, { gain: i % 2 ? 0.07 : 0.1 }))
      if (b >= 4 && b < 8) chordNotes(ch, 72, 86).forEach((n, i) => bell(ctx, mel, S.at(b, i * 4), n, { d: 0.6, gain: 0.06, ratio: 3.5, index: 1.5, rev: 0.3 }))
    })
    const whistle = 'E5:4 G5:4 E5:2 D5:2 C5:4 D5:4 B4:4 G4:8 C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 A5:4 G5:4 F5:4 E5:4'
    for (const off of [8, 12]) S.melody(off, whistle, (t, n, d) => lead(ctx, mel, t, n + 12, d * 0.9, { type: 'sine', gain: 0.1, vibDepth: 7, vibDelay: 0.1, a: 0.03, rev: 0.25, dly: 0.1, lp: 6000 }))
  }),

  // ---------------------------------------------------------------- GERİLİM
  M('karanlik-koridor', 'Karanlık Koridor (Gerilim)', 'gerilim', { bpm: 90, bars: 16, key: 'E phrygian', mix: { revTime: 3, revGain: 0.6 }, tags: ['gerilim', 'suspense', 'karanlık', 'gizem'] }, (S, ctx) => {
    const roots = ['E', 'E', 'F', 'E', 'E', 'E', 'F', 'F']
    const orch = S.bus(1), perc = S.bus(1)
    S.range(0, S.bars, (b) => {
      const r = rootNote(roots[b % 8], 2)
      for (let i = 0; i < 8; i++) strings(ctx, orch, S.at(b, i * 2), r + (i % 4 === 3 ? 12 : 0), S.len(1.4), { a: 0.01, r: 0.1, gain: 0.08 + (i % 4 === 0 ? 0.03 : 0), lp: 1100 })
      for (let i = 0; i < 8; i++) rim(ctx, perc, S.at(b, i * 2), { gain: i % 2 ? 0.05 : 0.08 })
      if (b >= 4) S.hits(b, 'x..x............', (t, c, i) => kick(ctx, perc, t, { gain: i ? 0.45 : 0.65, f0: 80, f1: 40, d: 0.25, click: 0.05 }))
    })
    tone(ctx, orch, { t: 0, dur: dur(S) - 1, f: nf('E5'), type: 'sawtooth', a: 3, s: 1, r: 1, gain: 0.025, filter: { type: 'lowpass', f: 2500 }, trem: { rate: 7, depth: 0.7 }, rev: 0.4 })
    tone(ctx, orch, { t: S.at(4, 0), dur: dur(S) - S.at(4, 0) - 1, f: nf('F5'), type: 'sawtooth', a: 4, s: 1, r: 1, gain: 0.02, filter: { type: 'lowpass', f: 2500 }, trem: { rate: 6.3, depth: 0.7 }, rev: 0.4 })
    for (const b of [0, 8]) ['E2', 'F2', 'Bb2'].forEach((n) => piano(ctx, orch, S.at(b, 0), n, { gain: 0.25, len: 4, rev: 0.5 }))
    for (const b of [8, 12]) ['E2', 'B2', 'E3', 'F3'].forEach((n) => brass(ctx, orch, S.at(b, 0), n, S.bar * 0.8, { gain: 0.08, a: 0.15, lp: 500, env: 1800 }))
    riser(ctx, orch, S.at(6, 0), S.bar * 2 - 0.05, { f: 82 })
    riser(ctx, orch, S.at(14, 0), S.bar * 2 - 0.05, { f: 82 })
  }),

  // ---------------------------------------------------------------- KORKU
  M('terk-edilmis', 'Terk Edilmiş (Korku Dronu)', 'gerilim', { bpm: 60, bars: 10, key: 'C atonal', mix: { revTime: 4.5, revGain: 0.7 }, tail: 4, tags: ['korku', 'dron', 'horror', 'ürpertici'] }, (S, ctx) => {
    const D = dur(S)
    for (const [n, g] of [['C1', 0.14], ['C#2', 0.07], ['G2', 0.06]]) tone(ctx, S.m, { t: 0, dur: D - 2, f: nf(n), type: 'sawtooth', a: 4, s: 1, r: 2, gain: g, unison: { n: 2, spread: 11 }, filter: { type: 'lowpass', f: 220, q: 2 }, trem: { rate: 0.125, depth: 0.5 }, rev: 0.3 })
    noiseBed(ctx, S.m, 0, D, { color: 'brown', gain: 0.25, filters: [{ type: 'lowpass', f: 280, lfo: [0.1, 90] }], amp: [0.15, 0.4] })
    for (const [t0, f0, f1] of [[5, 900, 2600], [14, 3000, 1200], [27, 1500, 4200], [35, 2600, 900]]) {
      noise(ctx, S.m, { t: t0, pts: [[0, 0], [1.2, 0.6], [2.6, 0.4], [3.2, 0]], gain: 0.22, filter: { type: 'bandpass', q: 14, pts: [[0, f0], [3.2, f1]] }, rev: 0.6, pan: [-0.6, 0.6] })
    }
    // uzaktan kurgulu müzik kutusu
    const box = [['C#6', 10], ['E6', 11], ['G6', 12], ['A#5', 13.5], ['C#6', 15], ['E6', 16], ['D6', 17.5], ['C#6', 19]]
    for (const [n, t] of box) bell(ctx, S.m, t, n, { d: 2, gain: 0.05, ratio: 4.2, index: 1, rev: 0.7, dly: 0.2, pan: 0.4 })
    noise(ctx, S.m, { t: 20, pts: [[0, 0], [1.6, 0.15], [2, 0.7], [2.02, 0]], gain: 0.4, filter: { type: 'highpass', f: 2500 }, rev: 0.4 })
    for (const t of [8, 22, 34]) ['C#4', 'D4', 'G#4', 'A4'].forEach((n, i) => piano(ctx, S.m, t + i * 0.02, n, { gain: 0.2, len: 4, rev: 0.6 }))
    const fs = [1400, 2300, 1800, 3000, 2600]
    fs.forEach((f, i) => noise(ctx, S.m, { t: 3 + i * 7.3, color: 'pink', pts: [[0, 0], [0.3, 0.5], [0.9, 0.2], [1.4, 0]], gain: 0.12, filter: { type: 'bandpass', f, q: 6 }, filter2: { type: 'bandpass', f: f * 1.7, q: 3 }, rev: 0.6, pan: i % 2 ? 0.7 : -0.7 }))
  }),
]
