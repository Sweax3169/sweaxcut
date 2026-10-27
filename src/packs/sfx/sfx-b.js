// Ses efektleri (2/2): Komik, Darbe & Patlama, Sinematik, Ortam, Müzikal — hepsi özgün sentez
import { tone, noise, partials, rng, nf, G, osc, filt, chain, send, curve, lfo, noiseBed, pluckBuf, pianoBuf, playBuf } from './dsp.js'
import { kick, snare, cymbal, tom, brass, strings, piano, string, pad } from './voices.js'
import { whoosh } from './sfx-a.js'
import { S } from './def.js'

const click = (ctx, m, t, f = 3000, g = 0.6, d = 0.01, q = 2, pan = 0) => noise(ctx, m, { t, a: 0.0005, d, gain: g, filter: { type: 'bandpass', f, q }, pan, seed: Math.round(f + t * 100) })
function boom(ctx, m, t, o = {}) {
  tone(ctx, m, { t, f: o.f0 ?? 70, f1: o.f1 ?? 28, glideT: o.pt ?? 0.5, a: 0.002, d: o.d ?? 1.6, gain: o.gain ?? 1, drive: o.drive ?? 1.8, filter: { type: 'lowpass', f: 500 } })
}

// ------------------------------------------------------------ KOMİK
const komik = [
  S('boing', 'Boing', 'komik', 1.0, {}, (ctx, m, t) => {
    tone(ctx, m, { t, f: 150, f1: 290, glideT: 0.5, a: 0.002, d: 0.75, gain: 0.55, vib: { rate: 14, depth: 55, depth1: 0 } })
    tone(ctx, m, { t, type: 'triangle', f: 300, f1: 580, glideT: 0.5, a: 0.002, d: 0.4, gain: 0.12, vib: { rate: 14, depth: 110, depth1: 0 } })
  }, { tags: ['boing', 'yay', 'zıpla', 'çizgi film'] }),
  S('kayan-duduk', 'Kayan Düdük', 'komik', 1.6, { revTime: 0.8 }, (ctx, m, t) => {
    const fp = [[0, 620], [0.55, 1900], [1.3, 480]]
    tone(ctx, m, { t, freqPts: fp, glide: 'lin', pts: [[0, 0], [0.06, 1], [1.2, 0.9], [1.35, 0]], gain: 0.45, vib: { rate: 6, depth: 14 }, rev: 0.15 })
    noise(ctx, m, { t, pts: [[0, 0], [0.06, 1], [1.2, 0.8], [1.35, 0]], gain: 0.05, filter: { type: 'bandpass', q: 6, pts: fp.map(([a, b]) => [a, b * 2]) } })
  }, { tags: ['düdük', 'kayan', 'çizgi film', 'slide whistle'] }),
  S('uzgun-trombon', 'Üzgün Trombon', 'komik', 3.0, { revTime: 1.2 }, (ctx, m, t) => {
    const notes = [['G3', 0, 0.42], ['F#3', 0.48, 0.42], ['F3', 0.96, 0.42], ['E3', 1.44, 1.2]]
    for (const [n, st, l] of notes) {
      const last = n === 'E3'
      tone(ctx, m, {
        t: t + st, dur: l, f: nf(n), type: 'sawtooth', a: 0.03, d: 0.2, s: 0.85, r: 0.12, gain: 0.3, unison: { n: 2, spread: 6 },
        filter: { type: 'lowpass', q: 2.5, pts: [[0, 350], [0.12, 1300], [l, 600]] }, vib: last ? { rate: 5.5, depth: 9, delay: 0.25 } : undefined, rev: 0.15,
      })
    }
  }, { tags: ['üzgün', 'trombon', 'başarısız', 'wah wah'] }),
  S('ba-dum-tss', 'Ba-Dum-Tss', 'komik', 2.0, { revTime: 1 }, (ctx, m, t) => {
    tom(ctx, m, t, 140, { gain: 0.7 })
    kick(ctx, m, t + 0.21, { gain: 0.8, f0: 130, f1: 50 })
    tom(ctx, m, t + 0.21, 95, { gain: 0.5 })
    cymbal(ctx, m, t + 0.46, { gain: 0.35, d: 1.2, hp: 7000 })
  }, { tags: ['espri', 'şaka', 'rimshot', 'davul'] }),
  S('plak-scratch', 'Plak Cızırtısı (Scratch)', 'komik', 0.9, {}, (ctx, m, t) => {
    const rp = [[0, 0.2], [0.12, 2.6], [0.22, 0.3], [0.36, 2.2], [0.5, 0.25], [0.62, 1.8], [0.72, 0.2]]
    noise(ctx, m, { t, pts: [[0, 0], [0.02, 1], [0.7, 1], [0.74, 0]], ratePts: rp, gain: 0.7, filter: { type: 'bandpass', f: 1400, q: 1.2 }, drive: 1.5 })
    tone(ctx, m, { t, type: 'sawtooth', freqPts: rp.map(([a, b]) => [a, 180 * b + 30]), glide: 'lin', pts: [[0, 0], [0.02, 1], [0.7, 1], [0.74, 0]], gain: 0.18, filter: { type: 'lowpass', f: 2000 } })
  }, { tags: ['scratch', 'plak', 'dj', 'dur'] }),
  S('korna', 'Synth Korna', 'komik', 2.0, { revTime: 1.4 }, (ctx, m, t) => {
    for (const [st, l] of [[0, 0.17], [0.24, 0.17], [0.48, 0.95]]) {
      for (const n of ['Bb4', 'D5', 'F5']) tone(ctx, m, {
        t: t + st, dur: l, f: nf(n) * 0.97, f1: nf(n), glideT: 0.06, type: 'sawtooth', a: 0.008, d: 0.2, s: 0.9, r: 0.08, gain: 0.16, unison: { n: 3, spread: 16 },
        drive: 3, filter: { type: 'peaking', f: 1600, q: 1, gain: 8 }, filter2: { type: 'lowpass', f: 5000 }, rev: 0.25,
      })
    }
  }, { tags: ['korna', 'airhorn', 'parti', 'mlg'] }),
  S('mantar', 'Şişe Mantarı', 'komik', 0.5, { revTime: 0.6 }, (ctx, m, t) => {
    noise(ctx, m, { t, a: 0.0005, d: 0.03, gain: 0.7, filter: { type: 'bandpass', f: 900, q: 4 } })
    tone(ctx, m, { t, f: 380, f1: 920, glideT: 0.025, a: 0.001, d: 0.07, gain: 0.5, rev: 0.12 })
  }, { tags: ['mantar', 'pop', 'şişe'] }),
  S('circir-bocegi', 'Cırcır Böceği (Sessizlik)', 'komik', 4.0, { revTime: 1.6 }, (ctx, m, t) => {
    const chirp = (tt, f, pan) => { for (let k = 0; k < 3; k++) tone(ctx, m, { t: tt + k * 0.033, dur: 0.018, f, a: 0.003, s: 1, r: 0.006, gain: 0.12, pan, rev: 0.3 }) }
    const r = rng(11)
    for (let tt = 0.1; tt < 3.8; tt += 0.48 + r() * 0.12) chirp(t + tt, 4450, -0.4)
    for (let tt = 0.35; tt < 3.8; tt += 0.62 + r() * 0.15) chirp(t + tt, 4980, 0.45)
    noiseBed(ctx, m, t, 4, { color: 'brown', gain: 0.05, filters: [{ type: 'lowpass', f: 300 }], fadeIn: 0.3, fadeOut: 0.4 })
  }, { tags: ['cırcır', 'sessizlik', 'garip', 'kriket'] }),
  S('dusus-isligi', 'Düşüş Islığı', 'komik', 2.2, { revTime: 1.4 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 2300, f1: 420, glideT: 1.7, pts: [[0, 0], [0.1, 0.5], [1.6, 1], [1.72, 0]], gain: 0.35, vib: { rate: 5, depth: 8 }, rev: 0.15 })
    tone(ctx, m, { t: t + 1.75, f: 110, f1: 45, glideT: 0.1, a: 0.002, d: 0.3, gain: 0.8, drive: 1.5 })
    noise(ctx, m, { t: t + 1.75, a: 0.002, d: 0.25, gain: 0.4, filter: { type: 'lowpass', f: 1200 }, rev: 0.3 })
  }, { tags: ['düşüş', 'ıslık', 'bomba', 'çizgi film'] }),
  S('tokat', 'Tokat', 'komik', 0.5, { revTime: 0.5, revGain: 0.4 }, (ctx, m, t) => {
    noise(ctx, m, { t, a: 0.0005, d: 0.03, gain: 1, filter: { type: 'highpass', f: 900 }, rev: 0.15 })
    noise(ctx, m, { t, a: 0.001, d: 0.06, gain: 0.5, filter: { type: 'bandpass', f: 2400, q: 1.2 } })
    tone(ctx, m, { t, f: 260, f1: 150, a: 0.001, d: 0.04, gain: 0.3 })
  }, { tags: ['tokat', 'şaplak', 'vurmak'] }),
  S('kacis-zip', 'Hızlı Kaçış (Zııp)', 'komik', 0.5, {}, (ctx, m, t) => {
    tone(ctx, m, { t, f: 300, f1: 2600, glideT: 0.16, a: 0.002, d: 0.2, gain: 0.35, type: 'triangle', pan: [-0.6, 0.6] })
    whoosh(ctx, m, t, { len: 0.22, f0: 1500, f1: 6000, f2: 6000, body: 0, gain: 0.4, rev: 0 })
  }, { tags: ['kaç', 'hızlı', 'zip', 'çizgi film'] }),
  S('yanlis-cevap', 'Yanlış Cevap (Buzzer)', 'komik', 0.9, {}, (ctx, m, t) => {
    tone(ctx, m, { t, dur: 0.7, type: 'sawtooth', f: 148, a: 0.005, s: 1, r: 0.05, gain: 0.3, drive: 2.5, filter: { type: 'lowpass', f: 1700 } })
    tone(ctx, m, { t, dur: 0.7, type: 'square', f: 155, a: 0.005, s: 1, r: 0.05, gain: 0.2, filter: { type: 'lowpass', f: 1700 } })
  }, { tags: ['yanlış', 'buzzer', 'yarışma', 'hata'] }),
  S('dogru-cevap', 'Doğru Cevap', 'komik', 1.6, { revTime: 1.4 }, (ctx, m, t) => {
    for (const [dt, n] of [[0, 'E6'], [0.15, 'E6']]) partials(ctx, m, { t: t + dt, f: nf(n), ratios: [1, 2, 3.01, 4.2], decays: [1, 0.6, 0.4, 0.25], gain: 0.25, rev: 0.25 })
    partials(ctx, m, { t: t + 0.15, f: nf('C6'), ratios: [1, 2, 3.01], decays: [1, 0.6, 0.4], gain: 0.18, rev: 0.25 })
  }, { tags: ['doğru', 'yarışma', 'bildin'] }),
]

// ------------------------------------------------------------ DARBE & PATLAMA
const darbe = [
  S('patlama', 'Patlama', 'darbe', 4.0, { revTime: 2.8, revGain: 0.7 }, (ctx, m, t) => {
    noise(ctx, m, { t, color: 'brown', a: 0.002, d: 1.8, gain: 1, filter: { type: 'lowpass', f: 5000, f1: 160, t: 1.6 }, drive: 2.5, rev: 0.35 })
    noise(ctx, m, { t, a: 0.001, d: 0.35, gain: 0.7, filter: { type: 'lowpass', f: 8000, f1: 800, t: 0.35 }, rev: 0.3 })
    boom(ctx, m, t, { f0: 85, f1: 30, d: 1.8 })
    noise(ctx, m, { t: t + 0.08, color: 'crackle', pts: [[0, 0], [0.1, 1], [1.2, 0.5], [2.4, 0]], gain: 0.8, filter: { type: 'bandpass', f: 2600, q: 0.7 }, rev: 0.3 })
  }, { tags: ['patlama', 'bomba', 'explosion'] }),
  S('buyuk-darbe', 'Büyük Darbe (Boom)', 'darbe', 2.8, { revTime: 2.4 }, (ctx, m, t) => {
    boom(ctx, m, t, { f0: 75, f1: 28, d: 1.5, pt: 0.4, drive: 2.2 })
    noise(ctx, m, { t, a: 0.001, d: 0.45, gain: 0.6, filter: { type: 'lowpass', f: 1100 }, rev: 0.4 })
    click(ctx, m, t, 3000, 0.45, 0.012, 1)
  }, { tags: ['darbe', 'boom', 'impact', 'vuruş'] }),
  S('sinematik-vurus', 'Sinematik Vuruş', 'darbe', 4.5, { revTime: 3.6, revGain: 0.8 }, (ctx, m, t) => {
    boom(ctx, m, t, { f0: 58, f1: 34, d: 2.4, pt: 0.6, drive: 1.6 })
    noise(ctx, m, { t, a: 0.002, d: 0.9, gain: 0.6, filter: { type: 'lowpass', f: 3000, f1: 300, t: 0.8 }, rev: 0.55 })
    partials(ctx, m, { t, f: 110, ratios: [1, 2.31, 3.89, 5.21, 7.13, 9.4], decays: [2.6, 2, 1.5, 1.1, 0.8, 0.5], gain: 0.22, rev: 0.55, type: 'triangle' })
    noise(ctx, m, { t, a: 0.001, d: 0.3, gain: 0.25, filter: { type: 'highpass', f: 5000 }, rev: 0.5 })
  }, { tags: ['sinematik', 'trailer', 'vuruş', 'epik'] }),
  S('bas-dusus', 'Bas Düşüşü (Drop)', 'darbe', 2.4, { revTime: 1.5 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 170, f1: 31, glideT: 1.7, a: 0.01, d: 0.5, s: 0.9, r: 0.3, dur: 1.8, gain: 0.85, drive: 3, filter: { type: 'lowpass', f: 900 } })
    tone(ctx, m, { t, f: 340, f1: 62, glideT: 1.7, a: 0.01, d: 0.5, s: 0.9, r: 0.3, dur: 1.6, gain: 0.15, type: 'triangle' })
    noise(ctx, m, { t, a: 0.001, d: 0.2, gain: 0.4, filter: { type: 'lowpass', f: 2500 } })
  }, { tags: ['bas', 'drop', '808', 'düşüş'] }),
  S('derin-boom', 'Derin Boom', 'darbe', 3.2, { revTime: 2.8, revGain: 0.7 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 64, f1: 47, glideT: 0.5, a: 0.003, d: 2.6, gain: 1, drive: 1.8, filter: { type: 'lowpass', f: 380 }, rev: 0.25 })
    tone(ctx, m, { t, f: 128, f1: 94, glideT: 0.5, a: 0.003, d: 0.9, gain: 0.25, drive: 1.5 })
    noise(ctx, m, { t, a: 0.001, d: 0.03, gain: 0.35, filter: { type: 'bandpass', f: 1100, q: 1 } })
  }, { tags: ['boom', 'derin', 'meme', 'vine'] }),
  S('metal-carpma', 'Metal Çarpma', 'darbe', 2.4, { revTime: 1.8 }, (ctx, m, t) => {
    partials(ctx, m, { t, f: 230, ratios: [1, 1.71, 2.53, 3.29, 4.17, 5.43, 6.8], decays: [1.9, 1.4, 1.1, 0.8, 0.6, 0.4, 0.3], gain: 0.25, rev: 0.3 })
    noise(ctx, m, { t, a: 0.0005, d: 0.06, gain: 0.6, filter: { type: 'bandpass', f: 3200, q: 1 } })
  }, { tags: ['metal', 'çarpma', 'clang', 'demir'] }),
  S('cam-kirilmasi', 'Cam Kırılması', 'darbe', 2.4, { revTime: 1.4 }, (ctx, m, t) => {
    noise(ctx, m, { t, a: 0.001, d: 0.3, gain: 0.8, filter: { type: 'highpass', f: 2800 }, rev: 0.25 })
    noise(ctx, m, { t, a: 0.001, d: 0.08, gain: 0.5, filter: { type: 'bandpass', f: 1500, q: 1 } })
    const r = rng(17)
    for (let i = 0; i < 34; i++) {
      const tt = t + Math.pow(r(), 1.8) * 1.2
      tone(ctx, m, { t: tt, f: 2800 + r() * 6500, a: 0.0008, d: 0.05 + r() * 0.25, gain: 0.05 + r() * 0.06, rev: 0.3, pan: (r() - 0.5) * 1.6 })
    }
  }, { tags: ['cam', 'kırılma', 'glass'] }),
  S('yere-dusme', 'Yere Düşme (Güm)', 'darbe', 0.9, { revTime: 0.7, revGain: 0.4 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 95, f1: 40, glideT: 0.1, a: 0.001, d: 0.28, gain: 0.95, drive: 1.6 })
    noise(ctx, m, { t, color: 'brown', a: 0.001, d: 0.18, gain: 0.8, filter: { type: 'lowpass', f: 420 } })
    noise(ctx, m, { t, a: 0.0008, d: 0.035, gain: 0.3, filter: { type: 'bandpass', f: 1500, q: 1 }, rev: 0.15 })
  }, { tags: ['düşme', 'güm', 'thud', 'yere'] }),
  S('elektrik', 'Elektrik Çarpması', 'darbe', 1.8, { revTime: 1 }, (ctx, m, t) => {
    const r = rng(23)
    const pts = [[0, 0]]
    for (let tt = 0.01; tt < 1.4; tt += 0.02 + r() * 0.05) { pts.push([tt, r() < 0.7 ? 0.5 + r() * 0.5 : 0.05]); pts.push([tt + 0.008, pts[pts.length - 1][1]]) }
    pts.push([1.5, 0])
    tone(ctx, m, { t, type: 'sawtooth', f: 100, pts, gain: 0.3, drive: 4, filter: { type: 'bandpass', f: 1800, q: 0.7 } })
    tone(ctx, m, { t, type: 'square', f: 150, pts, gain: 0.15, filter: { type: 'bandpass', f: 2600, q: 0.7 } })
    noise(ctx, m, { t, color: 'crackle', pts: [[0, 0], [0.02, 1], [1.4, 1], [1.5, 0]], gain: 1, filter: { type: 'highpass', f: 1800 }, rev: 0.15 })
  }, { tags: ['elektrik', 'şok', 'zap', 'kıvılcım'] }),
  S('havai-fisek', 'Havai Fişek', 'darbe', 3.4, { revTime: 2.6, revGain: 0.7 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 700, f1: 2700, glideT: 0.8, pts: [[0, 0], [0.1, 0.6], [0.8, 0.4], [0.85, 0]], gain: 0.25, vib: { rate: 22, depth: 30 }, rev: 0.2 })
    noise(ctx, m, { t, pts: [[0, 0], [0.1, 0.4], [0.85, 0]], gain: 0.2, filter: { type: 'bandpass', f: 3000, q: 1 } })
    boom(ctx, m, t + 0.9, { f0: 90, f1: 40, d: 0.9, pt: 0.2 })
    noise(ctx, m, { t: t + 0.9, a: 0.001, d: 0.5, gain: 0.6, filter: { type: 'lowpass', f: 2500 }, rev: 0.45 })
    noise(ctx, m, { t: t + 1.0, color: 'crackle', pts: [[0, 0], [0.15, 1], [1.6, 0]], gain: 1, filter: { type: 'bandpass', f: 4000, q: 0.8 }, rev: 0.35, pan: [-0.3, 0.3] })
  }, { tags: ['havai fişek', 'kutlama', 'patlama'] }),
]

// ------------------------------------------------------------ SİNEMATİK
const sinematik = [
  S('kalp-atisi', 'Kalp Atışı', 'sinematik', 4.0, { revTime: 0.8, revGain: 0.3 }, (ctx, m, t) => {
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.95
      tone(ctx, m, { t: tt, f: 72, f1: 44, glideT: 0.08, a: 0.004, d: 0.2, gain: 1, drive: 1.6, filter: { type: 'lowpass', f: 220 } })
      tone(ctx, m, { t: tt + 0.23, f: 82, f1: 50, glideT: 0.08, a: 0.004, d: 0.16, gain: 0.7, drive: 1.6, filter: { type: 'lowpass', f: 220 } })
    }
  }, { tags: ['kalp', 'nabız', 'gerilim', 'heyecan'] }),
  S('braam', 'Braam', 'sinematik', 5.0, { revTime: 4, revGain: 0.7 }, (ctx, m, t) => {
    for (const n of ['A1', 'A2', 'E2', 'C3']) tone(ctx, m, {
      t, dur: 2.6, f: nf(n), type: 'sawtooth', a: 0.12, d: 0.8, s: 0.7, r: 1.4, gain: n === 'C3' ? 0.08 : 0.14, unison: { n: 4, spread: 22 }, drive: 3,
      filter: { type: 'lowpass', q: 1.2, pts: [[0, 150], [0.35, 2600], [2.6, 450], [4, 200]] }, rev: 0.45,
    })
    tone(ctx, m, { t, dur: 2.6, f: nf('A0'), a: 0.05, d: 1, s: 0.8, r: 1.2, gain: 0.5 })
  }, { tags: ['braam', 'trailer', 'sinematik', 'epik'] }),
  S('gerilim-yukselisi', 'Gerilim Yükselişi', 'sinematik', 6.5, { revTime: 3 }, (ctx, m, t) => {
    const L = 6
    for (const [f, fade] of [[110, [[0, 0], [2, 0.8], [L, 1], [L + 0.05, 0]]], [220, [[0, 0.4], [L * 0.7, 0.8], [L, 0.9], [L + 0.05, 0]]], [440, [[0, 0.8], [L * 0.6, 0.5], [L, 0.3], [L + 0.05, 0]]]]) {
      tone(ctx, m, { t, type: 'sawtooth', f, f1: f * 2, glideT: L, pts: fade, gain: 0.12, unison: { n: 3, spread: 18 }, filter: { type: 'lowpass', f: 900, f1: 4000, t: L }, rev: 0.4, trem: { rate: 2, rate1: 14, depth: 0.6 } })
    }
    tone(ctx, m, { t, f: nf('E6'), f1: nf('F6'), glideT: L, pts: [[0, 0], [L, 0.6], [L + 0.05, 0]], gain: 0.06, type: 'sawtooth', unison: { n: 3, spread: 30 }, vib: { rate: 6, depth: 10 }, filter: { type: 'lowpass', f: 5000 }, rev: 0.5 })
    noise(ctx, m, { t, pts: [[0, 0], [L, 0.5], [L + 0.05, 0]], gain: 0.25, filter: { type: 'bandpass', q: 1.5, pts: [[0, 400], [L, 7000]] }, rev: 0.4 })
  }, { tags: ['gerilim', 'yükselen', 'korku', 'suspense'] }),
  S('teyp-durmasi', 'Teyp Durması', 'sinematik', 1.6, {}, (ctx, m, t) => {
    for (const n of ['C3', 'E3', 'G3', 'C4']) tone(ctx, m, { t, f: nf(n), f1: nf(n) * 0.06, glideT: 1.2, glide: 'exp', pts: [[0, 1], [0.9, 0.8], [1.25, 0]], type: 'sawtooth', gain: 0.14, filter: { type: 'lowpass', f: 3000, f1: 150, t: 1.2 } })
    noise(ctx, m, { t, pts: [[0, 0.5], [1.2, 0]], gain: 0.1, rate: 1, rate1: 0.1, filter: { type: 'lowpass', f: 2000 } })
  }, { tags: ['teyp', 'durma', 'yavaşlama', 'tape stop'] }),
  S('sinematik-gecis', 'Sinematik Geçiş Vuruşu', 'sinematik', 3.2, { revTime: 3, revGain: 0.75 }, (ctx, m, t) => {
    whoosh(ctx, m, t, { len: 0.62, f0: 250, f1: 3500, f2: 3500, peak: 0.97, body: 0.6, gain: 0.9 })
    boom(ctx, m, t + 0.6, { f0: 62, f1: 32, d: 1.8 })
    partials(ctx, m, { t: t + 0.6, f: 98, ratios: [1, 2.4, 3.9, 5.6], decays: [2, 1.4, 1, 0.6], gain: 0.18, rev: 0.55, type: 'triangle' })
    noise(ctx, m, { t: t + 0.6, a: 0.002, d: 0.6, gain: 0.5, filter: { type: 'lowpass', f: 2500, f1: 300, t: 0.6 }, rev: 0.5 })
  }, { tags: ['sinematik', 'geçiş', 'vuruş', 'trailer'] }),
  S('saat-tik-tak', 'Saat Tik Tak', 'sinematik', 4.0, { revTime: 0.6, revGain: 0.35 }, (ctx, m, t) => {
    for (let i = 0; i < 8; i++) {
      const tt = t + i * 0.5, tick = i % 2 === 0
      click(ctx, m, tt, tick ? 3600 : 2400, 0.7, 0.012, 6)
      tone(ctx, m, { t: tt, f: tick ? 2900 : 2100, a: 0.0005, d: 0.018, gain: 0.15, rev: 0.1 })
    }
  }, { tags: ['saat', 'tik tak', 'zaman', 'bekleme'] }),
  S('karanlik-dron', 'Karanlık Dron', 'sinematik', 8.0, { revTime: 3.5, revGain: 0.6 }, (ctx, m, t) => {
    for (const [n, det] of [['D1', 0], ['D2', 7], ['A2', -6], ['D3', 4]]) {
      const v = tone(ctx, m, { t, dur: 7.0, f: nf(n), type: 'sawtooth', a: 1.5, d: 1, s: 1, r: 0.9, gain: n === 'D3' ? 0.05 : 0.11, detune: det, unison: { n: 2, spread: 9 }, filter: { type: 'lowpass', f: 260, q: 1.5 }, rev: 0.4 })
      void v
    }
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.18, filters: [{ type: 'lowpass', f: 240, lfo: [0.125, 80] }], amp: [0.25, 0.3], fadeIn: 1.5, fadeOut: 1 })
    tone(ctx, m, { t: t + 2, dur: 4, f: nf('G#4'), type: 'sine', a: 2, d: 1, s: 1, r: 1.5, gain: 0.03, vib: { rate: 0.3, depth: 6 }, rev: 0.6 })
  }, { tags: ['dron', 'karanlık', 'korku', 'gerilim'] }),
]

// ------------------------------------------------------------ ORTAM (döngüye uygun)
const ortam = [
  S('ruzgar', 'Rüzgâr', 'ortam', 8, { revTime: 1.5, comp: false, gain: 1 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.9, filters: [{ type: 'bandpass', f: 480, q: 0.8, lfo: [0.125, 220] }], amp: [0.25, 0.35] })
    noiseBed(ctx, m, t, 8, { color: 'pink', gain: 0.18, filters: [{ type: 'bandpass', f: 1500, q: 3, lfo: [0.375, 600] }], amp: [0.125, 0.5], pan: 0.3, offset: 1.3 })
    noiseBed(ctx, m, t, 8, { color: 'pink', gain: 0.1, filters: [{ type: 'bandpass', f: 2400, q: 6, lfo: [0.25, 900] }], amp: [0.375, 0.6], pan: -0.3, offset: 2.1 })
  }, { tags: ['rüzgar', 'hava', 'fırtına', 'ortam'], seamless: true, tail: 1.5 }),
  S('yagmur', 'Yağmur', 'ortam', 8, { revTime: 1.2, comp: false, gain: 1 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 8, { color: 'pink', gain: 0.55, filters: [{ type: 'highpass', f: 500 }, { type: 'lowpass', f: 9000 }] })
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 1.4, filters: [{ type: 'bandpass', f: 3200, q: 0.6 }], pan: 0.2, rev: 0.2, seedBuf: 7 })
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 1.0, filters: [{ type: 'bandpass', f: 1800, q: 0.6 }], pan: -0.25, rev: 0.2, seedBuf: 9, offset: 1.7 })
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.25, filters: [{ type: 'lowpass', f: 350 }] })
  }, { tags: ['yağmur', 'hava', 'ortam', 'rain'], seamless: true, tail: 1.2 }),
  S('kalabalik', 'Kalabalık Uğultusu', 'ortam', 8, { revTime: 1.8, comp: false, gain: 1 }, (ctx, m, t) => {
    const formants = [[520, 0.125], [880, 0.25], [1250, 0.375], [1900, 0.5], [2600, 0.625], [700, 0.875]]
    formants.forEach(([f, rate], i) => noiseBed(ctx, m, t, 8, {
      color: 'pink', gain: 0.32, filters: [{ type: 'bandpass', f, q: 4, lfo: [rate, f * 0.25] }, { type: 'bandpass', f: f * 1.6, q: 1 }], amp: [rate * 2, 0.4], pan: (i % 3 - 1) * 0.4, rev: 0.35, offset: i * 0.53,
    }))
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.25, filters: [{ type: 'lowpass', f: 400 }], rev: 0.2 })
  }, { tags: ['kalabalık', 'insanlar', 'uğultu', 'ortam'], seamless: true, tail: 1.8 }),
  S('tezahurat', 'Kalabalık Tezahüratı', 'ortam', 6, { revTime: 2.2 }, (ctx, m, t) => {
    const env = (g) => [[0, 0], [1.2, g * 0.3], [2.6, g], [4.2, g * 0.8], [5.8, 0]]
    ;[[600, 0.7], [1000, 0.6], [1500, 0.5], [2300, 0.4], [3200, 0.25]].forEach(([f, g], i) => noise(ctx, m, {
      t, color: 'pink', pts: env(g), gain: 0.55, filter: { type: 'bandpass', q: 3, pts: [[0, f * 0.8], [2.6, f * 1.25], [5.8, f]] }, rev: 0.4, pan: (i % 2 ? 0.35 : -0.35), seed: i * 3,
    }))
    const r = rng(31)
    for (let i = 0; i < 26; i++) { // ıslıklar / bağırışlar
      const tt = t + 1.8 + r() * 3, f = 1200 + r() * 1400
      tone(ctx, m, { t: tt, f, f1: f * (0.8 + r() * 0.5), glideT: 0.3, a: 0.05, d: 0.35, gain: 0.03, type: r() < 0.5 ? 'sine' : 'triangle', vib: { rate: 5 + r() * 3, depth: 18 }, rev: 0.4, pan: (r() - 0.5) * 1.6 })
    }
  }, { tags: ['tezahürat', 'kalabalık', 'gol', 'coşku'] }),
  S('alkis', 'Alkış', 'ortam', 5.5, { revTime: 1.6 }, (ctx, m, t) => {
    const r = rng(9)
    for (let i = 0; i < 360; i++) {
      const u = r()
      const tt = t + (u < 0.1 ? u * 4 : 0.4 + r() * 4.2)
      const fade = tt - t > 3.4 ? Math.max(0, 1 - (tt - t - 3.4) / 1.3) : 1
      if (fade <= 0) continue
      noise(ctx, m, { t: tt, a: 0.0008, d: 0.012 + r() * 0.016, gain: (0.18 + r() * 0.2) * fade, filter: { type: 'bandpass', f: 900 + r() * 1700, q: 1.4 }, pan: (r() - 0.5) * 1.6, rev: 0.25, seed: i })
    }
    noise(ctx, m, { t, color: 'pink', pts: [[0, 0], [0.5, 0.25], [3.4, 0.25], [4.7, 0]], gain: 0.4, filter: { type: 'bandpass', f: 1600, q: 0.6 }, rev: 0.2 })
  }, { tags: ['alkış', 'tebrik', 'seyirci', 'applause'] }),
  S('radyo-paraziti', 'Radyo Paraziti', 'ortam', 4, { revTime: 0.6, revGain: 0.2 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 4, { color: 'white', gain: 0.6, filters: [{ type: 'bandpass', f: 1900, q: 0.6, lfo: [0.5, 500] }], amp: [7, 0.3] })
    noiseBed(ctx, m, t, 4, { color: 'crackle', gain: 0.45, filters: [{ type: 'highpass', f: 1500 }] })
    tone(ctx, m, { t, dur: 3.9, freqPts: [[0, 900], [0.8, 2300], [1.6, 1200], [2.5, 2800], [3.3, 1500], [3.9, 1800]], glide: 'lin', a: 0.2, s: 1, r: 0.1, gain: 0.025, type: 'sine', vib: { rate: 9, depth: 40 } })
  }, { tags: ['radyo', 'parazit', 'statik', 'telsiz'], seamless: true, tail: 0.6 }),
  S('plak-hisirtisi', 'Plak Hışırtısı', 'ortam', 8, { comp: false, gain: 1 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 0.5, filters: [{ type: 'highpass', f: 1200 }, { type: 'lowpass', f: 9000 }] })
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 0.9, filters: [{ type: 'bandpass', f: 600, q: 1 }], seedBuf: 21 })
    noiseBed(ctx, m, t, 8, { color: 'pink', gain: 0.1, filters: [{ type: 'bandpass', f: 4000, q: 0.5 }] })
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.08, filters: [{ type: 'lowpass', f: 120 }], amp: [0.5625, 0.5] })
  }, { tags: ['plak', 'vinyl', 'cızırtı', 'retro', 'lofi'], seamless: true, tail: 0.1 }),
  S('alarm', 'Alarm', 'ortam', 3, { revTime: 0.8 }, (ctx, m, t) => {
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) tone(ctx, m, { t: t + k * 1 + i * 0.12, dur: 0.07, type: 'square', f: 2050, a: 0.002, s: 1, r: 0.01, gain: 0.12, filter: { type: 'lowpass', f: 5000 }, rev: 0.12 })
  }, { tags: ['alarm', 'saat', 'uyan', 'bip'] }),
  S('siren', 'Siren', 'ortam', 4.4, { revTime: 2, revGain: 0.7 }, (ctx, m, t) => {
    const fp = [[0, 650], [1, 1300], [2, 650], [3, 1300], [4, 650]]
    tone(ctx, m, { t, freqPts: fp, glide: 'lin', type: 'triangle', pts: [[0, 0], [0.1, 1], [3.9, 1], [4.1, 0]], gain: 0.28, rev: 0.4, pan: [-0.4, 0.4] })
    tone(ctx, m, { t, freqPts: fp.map(([a, b]) => [a, b * 2]), glide: 'lin', type: 'square', pts: [[0, 0], [0.1, 1], [3.9, 1], [4.1, 0]], gain: 0.04, filter: { type: 'lowpass', f: 3500 }, rev: 0.4, pan: [-0.4, 0.4] })
  }, { tags: ['siren', 'polis', 'ambulans', 'acil'] }),
  S('kapi-calma', 'Kapı Çalma', 'ortam', 1.4, { revTime: 0.8, revGain: 0.45 }, (ctx, m, t) => {
    for (const dt of [0, 0.2, 0.4]) {
      tone(ctx, m, { t: t + dt, f: 190, f1: 125, glideT: 0.03, a: 0.001, d: 0.06, gain: 0.8, rev: 0.15 })
      noise(ctx, m, { t: t + dt, a: 0.0008, d: 0.035, gain: 0.6, filter: { type: 'bandpass', f: 950, q: 2 }, rev: 0.15 })
      noise(ctx, m, { t: t + dt, color: 'brown', a: 0.001, d: 0.07, gain: 0.5, filter: { type: 'lowpass', f: 320 } })
    }
  }, { tags: ['kapı', 'çalma', 'tak tak', 'misafir'] }),
  S('ates-citirtisi', 'Ateş Çıtırtısı', 'ortam', 8, { revTime: 0.8, comp: false, gain: 1 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 1.4, filters: [{ type: 'bandpass', f: 2600, q: 0.8 }], rev: 0.1 })
    noiseBed(ctx, m, t, 8, { color: 'crackle', gain: 1.6, filters: [{ type: 'bandpass', f: 900, q: 1 }], seedBuf: 17, offset: 0.9 })
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.9, filters: [{ type: 'lowpass', f: 260, lfo: [0.25, 60] }], amp: [0.5, 0.3] })
    noiseBed(ctx, m, t, 8, { color: 'pink', gain: 0.08, filters: [{ type: 'bandpass', f: 1200, q: 0.5 }] })
  }, { tags: ['ateş', 'kamp', 'çıtırtı', 'şömine'], seamless: true, tail: 0.8 }),
  S('gece-ortami', 'Gece Ortamı', 'ortam', 8, { revTime: 2, comp: false, gain: 1 }, (ctx, m, t) => {
    noiseBed(ctx, m, t, 8, { color: 'brown', gain: 0.4, filters: [{ type: 'bandpass', f: 380, q: 0.7, lfo: [0.125, 120] }], amp: [0.25, 0.3] })
    const chirp = (tt, f, pan) => { for (let k = 0; k < 3; k++) tone(ctx, m, { t: tt + k * 0.034, dur: 0.018, f, a: 0.003, s: 1, r: 0.006, gain: 0.07, pan, rev: 0.4 }) }
    for (let tt = 0.1; tt < 7.9; tt += 0.5) chirp(t + tt, 4450, -0.5)
    for (let tt = 0.3; tt < 7.9; tt += 0.8) chirp(t + tt, 5100, 0.55)
    for (let tt = 0.62; tt < 7.9; tt += 2) chirp(t + tt, 3900, 0.1)
  }, { tags: ['gece', 'cırcır', 'doğa', 'ortam'], seamless: true, tail: 2 }),
]

// ------------------------------------------------------------ MÜZİKAL
const muzikal = [
  S('trampet-rulosu', 'Trampet Rulosu', 'muzikal', 3.6, { revTime: 1.8 }, (ctx, m, t) => {
    let tt = 0, i = 0
    while (tt < 2.2) { const k = tt / 2.2; snare(ctx, m, t + tt, { gain: 0.15 + k * 0.45, d: 0.1, rev: 0.15 }); tt += 0.075 - k * 0.04; i++ }
    kick(ctx, m, t + 2.25, { gain: 0.8 }); cymbal(ctx, m, t + 2.25, { gain: 0.35, d: 1.6 })
  }, { tags: ['trampet', 'davul', 'rulo', 'gerilim'] }),
  S('zil-crash', 'Zil (Crash)', 'muzikal', 3, { revTime: 1.6 }, (ctx, m, t) => cymbal(ctx, m, t, { gain: 0.5, d: 2.2, hp: 5500 }), { tags: ['zil', 'crash', 'davul', 'cymbal'] }),
  S('gong', 'Gong', 'muzikal', 6.5, { revTime: 3.5, revGain: 0.7 }, (ctx, m, t) => {
    partials(ctx, m, { t, f: 88, ratios: [1, 1.004, 1.48, 1.94, 1.95, 2.43, 2.9, 3.62, 4.41], decays: [5, 5, 4.2, 3.4, 3.4, 2.6, 2, 1.5, 1], gain: 0.22, rev: 0.45, a: 0.015 })
    noise(ctx, m, { t, a: 0.01, d: 1.4, gain: 0.12, filter: { type: 'bandpass', f: 800, q: 0.8 }, rev: 0.4 })
  }, { tags: ['gong', 'doğu', 'açılış', 'tören'] }),
  S('arp-glissando', 'Arp Glissandosu', 'muzikal', 3, { revTime: 2.4 }, (ctx, m, t) => {
    const sc = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6']
    sc.forEach((n, i) => string(ctx, m, t + i * 0.045, n, { gain: 0.25, bright: 0.45, damp: 0.997, rev: 0.4, pan: (i / sc.length - 0.5) * 0.8 }))
  }, { tags: ['arp', 'harp', 'rüya', 'sihir'] }),
  S('piyano-akoru', 'Piyano Akoru', 'muzikal', 3.2, { revTime: 2 }, (ctx, m, t) => {
    ;['C3', 'G3', 'C4', 'E4', 'G4', 'C5'].forEach((n, i) => piano(ctx, m, t + i * 0.012, n, { gain: 0.22, rev: 0.3 }))
  }, { tags: ['piyano', 'akor', 'müzik'] }),
  S('dramatik-akor', 'Dramatik Akor (Dan Dan Daaan)', 'muzikal', 4, { revTime: 2.6 }, (ctx, m, t) => {
    const hitc = (tt, notes, l) => {
      for (const n of notes) brass(ctx, m, tt, n, l, { gain: 0.12, a: 0.015, lp: 700, env: 2600 })
      for (const n of notes) strings(ctx, m, tt, n, l, { a: 0.02, gain: 0.06 })
      tone(ctx, m, { t: tt, f: nf(notes[0]) / 2, f1: nf(notes[0]) / 2.2, glideT: 0.3, a: 0.002, d: 0.9, gain: 0.7, drive: 1.4 })
      noise(ctx, m, { t: tt, a: 0.001, d: 0.15, gain: 0.25, filter: { type: 'lowpass', f: 600 } })
    }
    hitc(t, ['D3', 'F3', 'A3'], 0.24)
    hitc(t + 0.38, ['D3', 'F3', 'A3'], 0.24)
    hitc(t + 0.8, ['C#3', 'E3', 'G3', 'Bb3'], 1.6)
  }, { tags: ['dramatik', 'şok', 'akor', 'dun dun'] }),
  S('ta-da', 'Ta-da!', 'muzikal', 2.4, { revTime: 1.8 }, (ctx, m, t) => {
    for (const n of ['G4', 'B4', 'D5', 'G5']) brass(ctx, m, t, n, 0.13, { gain: 0.1, a: 0.01 })
    for (const n of ['C4', 'E4', 'G4', 'C5', 'E5']) brass(ctx, m, t + 0.18, n, 1.1, { gain: 0.1, a: 0.015 })
    cymbal(ctx, m, t + 0.18, { gain: 0.18, d: 1.4 })
    for (let i = 0; i < 6; i++) tone(ctx, m, { t: t + 0.2 + i * 0.06, f: nf(['C7', 'E7', 'G7', 'C8', 'G7', 'E7'][i]), a: 0.001, d: 0.3, gain: 0.04, rev: 0.4 })
  }, { tags: ['tada', 'sihir', 'sürpriz', 'gösteri'] }),
  S('timpani', 'Timpani Vuruşu', 'muzikal', 2.6, { revTime: 2 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 112, f1: 96, glideT: 0.25, a: 0.002, d: 1.6, gain: 0.85, rev: 0.3 })
    tone(ctx, m, { t, f: 168, f1: 146, glideT: 0.25, a: 0.002, d: 0.9, gain: 0.3, rev: 0.3 })
    noise(ctx, m, { t, a: 0.001, d: 0.12, gain: 0.35, filter: { type: 'bandpass', f: 220, q: 1 } })
  }, { tags: ['timpani', 'davul', 'orkestra'] }),
  S('synth-stab', 'Synth Vuruşu (Stab)', 'muzikal', 2, { revTime: 1.6, delay: 0.19, delayFb: 0.35 }, (ctx, m, t) => {
    for (const n of ['C4', 'Eb4', 'G4', 'Bb4']) tone(ctx, m, { t, f: nf(n), type: 'sawtooth', a: 0.002, d: 0.32, gain: 0.12, unison: { n: 3, spread: 14 }, filter: { type: 'lowpass', f: 500, env: 6000, envD: 0.22, q: 2 }, rev: 0.3, dly: 0.3 })
  }, { tags: ['synth', 'stab', 'edm', 'vuruş'] }),
  S('davul-gecisi', 'Davul Geçişi (Fill)', 'muzikal', 2.4, { revTime: 1.6 }, (ctx, m, t) => {
    const s = 0.11
    ;[260, 230, 200, 165, 140, 120, 100, 85].forEach((f, i) => tom(ctx, m, t + i * s, f, { gain: 0.55 + i * 0.03, pan: 0.5 - i * 0.14 }))
    kick(ctx, m, t + 8 * s, { gain: 0.9 }); cymbal(ctx, m, t + 8 * s, { gain: 0.35, d: 1.5 })
  }, { tags: ['davul', 'fill', 'geçiş', 'tom'] }),
]

export default [...komik, ...darbe, ...sinematik, ...ortam, ...muzikal]
