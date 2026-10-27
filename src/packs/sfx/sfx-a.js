// Ses efektleri (1/2): Geçiş, Arayüz, Oyun — hepsi özgün sentez
import { tone, noise, partials, rng, nf, G, osc, filt, chain, send, curve, noiseBuf } from './dsp.js'
import { kick, snare, cymbal, chip, bell, brass, string, tom } from './voices.js'
import { S } from './def.js'

// ------------------------------------------------------------ yardımcılar
export function whoosh(ctx, m, t, o = {}) {
  const L = o.len ?? 0.8, pk = o.peak ?? 0.5
  const pts = [[0, 0], [L * pk * 0.5, 0.22], [L * pk, 1], [L * (pk + (1 - pk) * 0.35), 0.4], [L, 0]]
  noise(ctx, m, {
    t, color: o.color || 'pink', pts, gain: o.gain ?? 0.9, pan: o.pan ?? [-0.6, 0.6], rev: o.rev ?? 0.2, seed: o.seed || 3,
    filter: { type: 'bandpass', q: o.q ?? 1.3, pts: [[0, o.f0 ?? 300], [L * pk, o.f1 ?? 2400], [L, o.f2 ?? 500]] },
  })
  if (o.body !== 0) noise(ctx, m, { t, color: 'brown', pts, gain: (o.body ?? 0.5) * (o.gain ?? 0.9), filter: { type: 'lowpass', f: o.bodyF ?? 500 }, pan: o.pan ?? [-0.6, 0.6], seed: (o.seed || 3) + 1 })
}
export function riser(ctx, m, t, L, o = {}) {
  const up = [[0, 0], [L * 0.55, 0.3], [L * 0.92, 0.9], [L, 1], [L + 0.012, 0]]
  noise(ctx, m, { t, color: 'white', pts: up, gain: 0.45, filter: { type: 'bandpass', q: 1.1, pts: [[0, 350], [L, 9500]] }, filter2: { type: 'highpass', f: 250 }, rev: 0.35, pan: [-0.3, 0.3] })
  tone(ctx, m, { t, type: 'sawtooth', f: o.f ?? 110, f1: (o.f ?? 110) * 4, glideT: L, pts: up, gain: 0.2, unison: { n: 4, spread: 22 }, filter: { type: 'lowpass', f: 300, f1: 8000, t: L, q: 1.6 }, trem: { rate: 3, rate1: 18, depth: 0.5 }, rev: 0.35 })
  tone(ctx, m, { t, type: 'sine', f: (o.f ?? 110) / 2, f1: (o.f ?? 110) * 2, glideT: L, pts: up, gain: 0.25 })
}
function hit(ctx, m, t, o = {}) {
  tone(ctx, m, { t, f: o.f0 ?? 110, f1: o.f1 ?? 38, glideT: 0.12, a: 0.001, d: o.d ?? 0.9, gain: o.gain ?? 0.95, drive: o.drive ?? 1.8 })
  noise(ctx, m, { t, a: 0.001, d: o.nd ?? 0.25, gain: (o.gain ?? 0.95) * 0.6, filter: { type: 'lowpass', f: 4000, f1: 400, t: 0.3 }, rev: o.rev ?? 0.5 })
  noise(ctx, m, { t, a: 0.0005, d: 0.012, gain: 0.4, filter: { type: 'bandpass', f: 3000, q: 1 } })
}
const click = (ctx, m, t, f = 3000, g = 0.6, d = 0.01, q = 2, pan = 0) => noise(ctx, m, { t, a: 0.0005, d, gain: g, filter: { type: 'bandpass', f, q }, pan, seed: Math.round(f + t * 100) })

// ------------------------------------------------------------ GEÇİŞ
const gecis = [
  S('vuus-yumusak', 'Yumuşak Vuuş', 'gecis', 1.6, { revTime: 1.4 }, (ctx, m, t) => whoosh(ctx, m, t, { len: 0.9, rev: 0.25 }), { tags: ['whoosh', 'geçiş'] }),
  S('vuus-hizli', 'Hızlı Vuuş', 'gecis', 0.9, { revTime: 1 }, (ctx, m, t) => whoosh(ctx, m, t, { len: 0.36, f0: 700, f1: 4200, f2: 1200, q: 1.1, body: 0.3, pan: [-0.5, 0.5] }), { tags: ['whoosh', 'hızlı'] }),
  S('vuus-derin', 'Derin Vuuş', 'gecis', 2, { revTime: 2 }, (ctx, m, t) => {
    whoosh(ctx, m, t, { len: 1.3, f0: 150, f1: 1300, f2: 160, q: 0.9, body: 0.9, bodyF: 260, color: 'brown', gain: 1 })
    tone(ctx, m, { t, f: 95, f1: 38, glideT: 1.3, pts: [[0, 0], [0.6, 1], [1.3, 0]], gain: 0.5 })
  }, { tags: ['whoosh', 'derin', 'bas'] }),
  S('swoosh-cift', 'Çift Swoosh', 'gecis', 1.1, { revTime: 1 }, (ctx, m, t) => {
    whoosh(ctx, m, t, { len: 0.3, f0: 600, f1: 3800, f2: 900, body: 0.2, pan: [-0.7, 0], seed: 4 })
    whoosh(ctx, m, t + 0.22, { len: 0.34, f0: 500, f1: 3200, f2: 700, body: 0.25, pan: [0, 0.7], seed: 8 })
  }, { tags: ['swoosh', 'geçiş'] }),
  S('kaydirma', 'Kaydırma (Swipe)', 'gecis', 0.4, { revTime: 0.6 }, (ctx, m, t) => {
    noise(ctx, m, { t, pts: [[0, 0], [0.05, 1], [0.2, 0]], gain: 0.8, filter: { type: 'bandpass', q: 1.5, pts: [[0, 2500], [0.2, 7500]] }, filter2: { type: 'highpass', f: 1500 }, pan: [-0.4, 0.4], rev: 0.1 })
  }, { tags: ['swipe', 'kaydır'] }),
  S('fermuar', 'Fermuar Geçişi', 'gecis', 0.7, {}, (ctx, m, t) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, 'white'); src.loop = true
    const bp = filt(ctx, 'bandpass', 1400, 2); curve(bp.frequency, t, [[0, 1400], [0.5, 5200]], 'exp')
    const am = G(ctx, 0.5), l = osc(ctx, 'square', 55), lg = G(ctx, 0.5)
    l.frequency.setValueAtTime(55, t); l.frequency.linearRampToValueAtTime(140, t + 0.5)
    chain(l, lg, am.gain)
    const vca = G(ctx, 0); curve(vca.gain, t, [[0, 0], [0.04, 1], [0.42, 0.8], [0.5, 0]])
    chain(src, bp, am, vca); send(ctx, vca, m, { gain: 0.9, pan: [-0.3, 0.3], t, dur: 0.5 })
    src.start(t); src.stop(t + 0.55); l.start(t); l.stop(t + 0.55)
  }, { tags: ['zip', 'fermuar'] }),
  S('stinger', 'Geçiş Vuruşu (Stinger)', 'gecis', 2.4, { revTime: 2.2, revGain: 0.7 }, (ctx, m, t) => {
    whoosh(ctx, m, t, { len: 0.42, f0: 400, f1: 5000, f2: 5000, peak: 0.95, body: 0.4 })
    hit(ctx, m, t + 0.4, { d: 1.1 })
    noise(ctx, m, { t: t + 0.4, a: 0.002, d: 0.9, gain: 0.25, filter: { type: 'highpass', f: 6000 }, rev: 0.5 })
  }, { tags: ['stinger', 'vuruş', 'geçiş'] }),
  S('ters-zil', 'Ters Zil (Reverse)', 'gecis', 1.8, { revTime: 1.2 }, (ctx, m, t) => {
    const up = [[0, 0], [0.9, 0.08], [1.3, 0.35], [1.52, 1], [1.53, 0]]
    noise(ctx, m, { t, pts: up, gain: 0.7, filter: { type: 'highpass', f: 3500 }, filter2: { type: 'peaking', f: 8000, q: 0.8, gain: 6 }, pan: [0.2, -0.2] })
    for (const [f, g] of [[3150, 0.07], [4410, 0.06], [5730, 0.05], [7020, 0.04]]) tone(ctx, m, { t, type: 'square', f, pts: up, gain: g, filter: { type: 'highpass', f: 3000 } })
  }, { tags: ['reverse', 'ters', 'zil', 'cymbal'] }),
  S('yukselen-kisa', 'Yükselen (2 sn)', 'gecis', 2.5, { revTime: 1.5 }, (ctx, m, t) => riser(ctx, m, t, 2), { tags: ['riser', 'yükselen', 'gerilim'] }),
  S('yukselen-orta', 'Yükselen (4 sn)', 'gecis', 4.6, { revTime: 2 }, (ctx, m, t) => riser(ctx, m, t, 4, { f: 98 }), { tags: ['riser', 'yükselen', 'build up'] }),
  S('yukselen-uzun', 'Yükselen (8 sn)', 'gecis', 8.6, { revTime: 2.5 }, (ctx, m, t) => {
    riser(ctx, m, t, 8, { f: 82 })
    for (let i = 0; i < 16; i++) { const tt = t + 8 * (1 - Math.pow(0.82, i + 1)) / (1 - Math.pow(0.82, 16)) * 0.98; snare(ctx, m, tt, { gain: 0.12 + i * 0.025, rev: 0.2 }) }
  }, { tags: ['riser', 'yükselen', 'build up', 'drop'] }),
  S('alcalan', 'Alçalan (Downlifter)', 'gecis', 3.6, { revTime: 2 }, (ctx, m, t) => {
    const dn = [[0, 0], [0.02, 1], [1.2, 0.45], [3, 0]]
    noise(ctx, m, { t, pts: dn, gain: 0.5, filter: { type: 'bandpass', q: 1, pts: [[0, 7000], [3, 250]] }, rev: 0.35, pan: [0.3, -0.3] })
    tone(ctx, m, { t, type: 'sawtooth', f: 440, f1: 60, glideT: 3, pts: dn, gain: 0.18, unison: { n: 3, spread: 20 }, filter: { type: 'lowpass', f: 6000, f1: 200, t: 3 }, rev: 0.3 })
    tone(ctx, m, { t, f: 90, f1: 32, glideT: 1.2, a: 0.002, d: 1.4, gain: 0.7, drive: 1.5 })
  }, { tags: ['downlifter', 'alçalan', 'düşüş'] }),
  S('glitch-gecis', 'Glitch Geçiş', 'gecis', 0.9, {}, (ctx, m, t) => {
    const r = rng(42)
    let tt = t
    for (let i = 0; i < 14; i++) {
      const d = 0.02 + r() * 0.045
      if (r() < 0.5) tone(ctx, m, { t: tt, dur: d, type: r() < 0.5 ? 'square' : 'sawtooth', f: 150 + r() * 1800, a: 0.0008, s: 1, r: 0.004, gain: 0.25, drive: 4, driveKind: 'hard', pan: (r() - 0.5) * 1.4 })
      else noise(ctx, m, { t: tt, dur: d, a: 0.0008, s: 1, r: 0.004, gain: 0.5, filter: { type: 'bandpass', f: 500 + r() * 6000, q: 2 }, rate: 0.2 + r(), pan: (r() - 0.5) * 1.4, seed: i })
      tt += d + (r() < 0.3 ? 0.02 : 0)
    }
  }, { tags: ['glitch', 'bozulma', 'dijital'] }),
  S('ruzgar-gecisi', 'Rüzgâr Geçişi', 'gecis', 2.2, { revTime: 1.6 }, (ctx, m, t) => {
    whoosh(ctx, m, t, { len: 1.6, f0: 250, f1: 1800, f2: 300, q: 2.4, color: 'pink', body: 0.6, peak: 0.55, pan: [-0.8, 0.8], gain: 0.8 })
    noise(ctx, m, { t, pts: [[0, 0], [0.9, 0.5], [1.6, 0]], gain: 0.25, filter: { type: 'bandpass', q: 8, pts: [[0, 600], [0.9, 1500], [1.6, 700]] } })
  }, { tags: ['rüzgar', 'geçiş', 'hava'] }),
]

// ------------------------------------------------------------ ARAYÜZ
const arayuz = [
  S('pop', 'Pop', 'arayuz', 0.3, { revTime: 0.5 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 950, f1: 160, glideT: 0.05, a: 0.001, d: 0.08, gain: 0.75 })
    click(ctx, m, t, 2400, 0.25, 0.006)
  }, { tags: ['pop', 'patla', 'balon'] }),
  S('baloncuk', 'Baloncuk Patlaması', 'arayuz', 0.45, { revTime: 0.6 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 380, f1: 1500, glideT: 0.035, a: 0.001, d: 0.06, gain: 0.6, rev: 0.12 })
    tone(ctx, m, { t: t + 0.11, f: 620, f1: 2100, glideT: 0.03, a: 0.001, d: 0.045, gain: 0.35, rev: 0.12 })
  }, { tags: ['baloncuk', 'bubble', 'pop'] }),
  S('tik', 'Tık', 'arayuz', 0.12, {}, (ctx, m, t) => {
    click(ctx, m, t, 2600, 0.9, 0.012, 3)
    tone(ctx, m, { t, f: 1900, a: 0.0005, d: 0.018, gain: 0.2 })
  }, { tags: ['tık', 'click', 'buton'] }),
  S('fare-tik', 'Fare Tıklaması', 'arayuz', 0.3, {}, (ctx, m, t) => {
    click(ctx, m, t, 4200, 0.8, 0.008, 2); tone(ctx, m, { t, f: 950, f1: 700, a: 0.0005, d: 0.016, gain: 0.25 })
    click(ctx, m, t + 0.085, 4800, 0.5, 0.007, 2); tone(ctx, m, { t: t + 0.085, f: 1100, a: 0.0005, d: 0.012, gain: 0.15 })
  }, { tags: ['fare', 'mouse', 'tık'] }),
  S('klavye', 'Klavye Yazma', 'arayuz', 2.6, { revTime: 0.4, revGain: 0.3 }, (ctx, m, t) => {
    const r = rng(7)
    let tt = t
    for (let i = 0; i < 18 && tt < t + 2.3; i++) {
      const space = i % 6 === 5
      const f = space ? 900 : 1700 + r() * 1600
      click(ctx, m, tt, f, space ? 0.6 : 0.5 + r() * 0.3, space ? 0.05 : 0.02 + r() * 0.015, 1.4, (r() - 0.5) * 0.5)
      tone(ctx, m, { t: tt, f: space ? 180 : 300 + r() * 140, a: 0.001, d: space ? 0.06 : 0.03, gain: 0.25, rev: 0.05 })
      click(ctx, m, tt + 0.045 + r() * 0.02, f * 1.2, 0.18, 0.01, 2)
      tt += 0.07 + r() * 0.13
    }
  }, { tags: ['klavye', 'yazma', 'typing'] }),
  S('deklansor', 'Fotoğraf Deklanşörü', 'arayuz', 0.5, { revTime: 0.5, revGain: 0.3 }, (ctx, m, t) => {
    click(ctx, m, t, 3500, 0.9, 0.012, 1.5)
    noise(ctx, m, { t, a: 0.001, d: 0.05, gain: 0.5, filter: { type: 'bandpass', f: 1300, q: 1.2 } })
    tone(ctx, m, { t, f: 160, a: 0.001, d: 0.035, gain: 0.4 })
    click(ctx, m, t + 0.075, 2800, 0.8, 0.014, 1.5)
    noise(ctx, m, { t: t + 0.075, a: 0.002, d: 0.06, gain: 0.35, filter: { type: 'bandpass', f: 2000, q: 1 }, rev: 0.1 })
  }, { tags: ['kamera', 'deklanşör', 'fotoğraf', 'shutter'] }),
  S('ding', 'Ding', 'arayuz', 2.2, { revTime: 1.6 }, (ctx, m, t) => {
    partials(ctx, m, { t, f: 1568, ratios: [1, 2.0, 3.01, 4.17, 5.43], decays: [1.7, 0.9, 0.6, 0.35, 0.22], gain: 0.32, rev: 0.25 })
    click(ctx, m, t, 5000, 0.15, 0.004)
  }, { tags: ['ding', 'zil', 'bildirim'] }),
  S('bildirim-yumusak', 'Bildirim (Yumuşak)', 'arayuz', 1.4, { revTime: 1.2 }, (ctx, m, t) => {
    for (const [dt, n] of [[0, 'E6'], [0.12, 'A6']]) {
      tone(ctx, m, { t: t + dt, f: nf(n), a: 0.001, d: 0.55, gain: 0.3, fm: { ratio: 4, index: 1.4, index1: 0, t: 0.15 }, rev: 0.2 })
      tone(ctx, m, { t: t + dt, f: nf(n) / 2, a: 0.002, d: 0.3, gain: 0.12 })
    }
  }, { tags: ['bildirim', 'notification', 'mesaj'] }),
  S('bildirim-parlak', 'Bildirim (Parlak)', 'arayuz', 1.6, { revTime: 1.4, delay: 0.14, delayFb: 0.3 }, (ctx, m, t) => {
    ;['C6', 'E6', 'G6', 'C7'].forEach((n, i) => {
      tone(ctx, m, { t: t + i * 0.065, f: nf(n), type: 'triangle', a: 0.001, d: 0.5, gain: 0.22, rev: 0.25, dly: 0.2 })
      tone(ctx, m, { t: t + i * 0.065, f: nf(n) * 2, a: 0.001, d: 0.25, gain: 0.06 })
    })
  }, { tags: ['bildirim', 'parlak', 'arpej'] }),
  S('mesaj-geldi', 'Mesaj Geldi', 'arayuz', 0.6, { revTime: 0.6 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 880, f1: 1480, glideT: 0.05, a: 0.002, d: 0.09, gain: 0.4, rev: 0.1 })
    tone(ctx, m, { t: t + 0.11, f: 1100, f1: 1860, glideT: 0.05, a: 0.002, d: 0.11, gain: 0.4, rev: 0.1 })
  }, { tags: ['mesaj', 'sohbet', 'blip'] }),
  S('basari', 'Başarı', 'arayuz', 2.2, { revTime: 1.8, delay: 0.12, delayFb: 0.25 }, (ctx, m, t) => {
    ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(ctx, m, { t: t + i * 0.08, f: nf(n), type: 'square', a: 0.002, d: 0.35, gain: 0.1, filter: { type: 'lowpass', f: 3000 }, rev: 0.2, dly: 0.15 }))
    for (const n of ['E6', 'G6', 'C7']) tone(ctx, m, { t: t + 0.34, f: nf(n), type: 'triangle', a: 0.005, d: 1.2, gain: 0.12, rev: 0.4 })
    noise(ctx, m, { t: t + 0.32, a: 0.05, d: 0.9, gain: 0.06, filter: { type: 'highpass', f: 8000 }, rev: 0.4 })
  }, { tags: ['başarı', 'tamam', 'kazandın'] }),
  S('hata', 'Hata Vızıltısı', 'arayuz', 0.6, {}, (ctx, m, t) => {
    for (const dt of [0, 0.19]) {
      tone(ctx, m, { t: t + dt, dur: 0.13, type: 'square', f: 130, a: 0.003, s: 1, r: 0.02, gain: 0.3, filter: { type: 'lowpass', f: 1400 }, drive: 1.5 })
      tone(ctx, m, { t: t + dt, dur: 0.13, type: 'sawtooth', f: 136, a: 0.003, s: 1, r: 0.02, gain: 0.2, filter: { type: 'lowpass', f: 1400 } })
    }
  }, { tags: ['hata', 'yanlış', 'error'] }),
  S('onay', 'Onay', 'arayuz', 0.6, { revTime: 0.7 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: nf('G5'), type: 'triangle', a: 0.002, d: 0.14, gain: 0.35, rev: 0.12 })
    tone(ctx, m, { t: t + 0.09, f: nf('D6'), type: 'triangle', a: 0.002, d: 0.3, gain: 0.35, rev: 0.12 })
  }, { tags: ['onay', 'tamam', 'evet'] }),
  S('bip', 'Bip', 'arayuz', 0.25, {}, (ctx, m, t) => tone(ctx, m, { t, dur: 0.15, f: 1000, a: 0.003, s: 1, r: 0.02, gain: 0.4 }), { tags: ['bip', 'sansür', 'beep'] }),
  S('sansur-bip', 'Sansür Bipi (Uzun)', 'arayuz', 0.9, {}, (ctx, m, t) => tone(ctx, m, { t, dur: 0.8, f: 1000, a: 0.004, s: 1, r: 0.02, gain: 0.4 }), { tags: ['sansür', 'bip', 'küfür'] }),
  S('ui-acilis', 'Arayüz Açılış', 'arayuz', 0.5, { revTime: 0.6 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 420, f1: 980, glideT: 0.18, a: 0.01, d: 0.22, gain: 0.35, filter: { type: 'lowpass', f: 1500, f1: 5000, t: 0.2 }, type: 'triangle', rev: 0.15 })
  }, { tags: ['açılış', 'menü', 'ui'] }),
  S('ui-kapanis', 'Arayüz Kapanış', 'arayuz', 0.5, { revTime: 0.6 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 980, f1: 380, glideT: 0.18, a: 0.01, d: 0.22, gain: 0.35, type: 'triangle', rev: 0.15 })
  }, { tags: ['kapanış', 'menü', 'ui'] }),
]

// ------------------------------------------------------------ OYUN
const oyun = [
  S('altin-toplama', 'Altın Toplama', 'oyun', 0.8, { revTime: 0.7 }, (ctx, m, t) => {
    chip(ctx, m, t, 'C6', 0.06, { gain: 0.14 })
    chip(ctx, m, t + 0.06, 'G6', 0.4, { gain: 0.14, d: 0.3, s: 0 })
    tone(ctx, m, { t: t + 0.06, f: nf('C7'), type: 'triangle', a: 0.002, d: 0.3, gain: 0.08 })
  }, { tags: ['altın', 'coin', 'para', '8-bit'] }),
  S('guc-artisi', 'Güç Artışı', 'oyun', 1.2, { delay: 0.09, delayFb: 0.35 }, (ctx, m, t) => {
    ;['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => chip(ctx, m, t + i * 0.055, n, 0.06, { gain: 0.12, dly: 0.25 }))
    tone(ctx, m, { t, f: nf('C4'), f1: nf('C6'), glideT: 0.4, type: 'triangle', a: 0.005, d: 0.5, gain: 0.15, vib: { rate: 12, depth: 20 } })
  }, { tags: ['güç', 'power up', '8-bit'] }),
  S('seviye-atlama', 'Seviye Atlama', 'oyun', 1.8, { delay: 0.12, delayFb: 0.25, revTime: 1 }, (ctx, m, t) => {
    const s = 0.085
    ;['G5', 'C6', 'E6', 'G6'].forEach((n, i) => chip(ctx, m, t + i * s, n, s * 0.9, { gain: 0.12, dly: 0.2 }))
    chip(ctx, m, t + 4 * s, 'C7', 0.7, { gain: 0.12, vib: true, s: 0.7, dly: 0.2 })
    ;['C4', 'G4', 'C5'].forEach((n, i) => chip(ctx, m, t + i * s * 1.4, n, s * 1.2, { type: 'triangle', gain: 0.2 }))
    chip(ctx, m, t + 4 * s, 'C4', 0.7, { type: 'triangle', gain: 0.2 })
  }, { tags: ['seviye', 'level up', 'atladın'] }),
  S('ziplama', 'Zıplama (8-bit)', 'oyun', 0.4, {}, (ctx, m, t) => {
    tone(ctx, m, { t, type: 'square', f: 210, f1: 880, glideT: 0.16, a: 0.002, d: 0.24, gain: 0.18, filter: { type: 'lowpass', f: 5000 } })
  }, { tags: ['zıpla', 'jump', '8-bit'] }),
  S('lazer', 'Lazer', 'oyun', 0.9, { delay: 0.07, delayFb: 0.4 }, (ctx, m, t) => {
    tone(ctx, m, { t, type: 'sawtooth', f: 2400, f1: 170, glideT: 0.22, a: 0.001, d: 0.28, gain: 0.25, filter: { type: 'bandpass', f: 1800, q: 0.8 }, dly: 0.3 })
    tone(ctx, m, { t, type: 'square', f: 2350, f1: 160, glideT: 0.22, a: 0.001, d: 0.24, gain: 0.12, dly: 0.3 })
  }, { tags: ['lazer', 'bilim kurgu', 'ateş'] }),
  S('pew', 'Lazer Tabanca (Piv)', 'oyun', 0.45, {}, (ctx, m, t) => {
    tone(ctx, m, { t, f: 1700, f1: 280, glideT: 0.12, a: 0.001, d: 0.16, gain: 0.45, fm: { ratio: 1.5, index: 3, index1: 0.3, t: 0.12 } })
  }, { tags: ['pew', 'lazer', 'atış'] }),
  S('isinlanma', 'Işınlanma', 'oyun', 2.2, { revTime: 1.8, delay: 0.11, delayFb: 0.4 }, (ctx, m, t) => {
    tone(ctx, m, { t, f: 180, f1: 2200, glideT: 1.0, pts: [[0, 0], [0.15, 1], [0.9, 0.8], [1.1, 0]], gain: 0.3, fm: { ratio: 1.41, index: 5, index1: 0.4, t: 1 }, vib: { rate: 13, depth: 30 }, rev: 0.45, dly: 0.25 })
    noise(ctx, m, { t, pts: [[0, 0], [0.8, 0.6], [1.1, 0]], gain: 0.25, filter: { type: 'bandpass', q: 3, pts: [[0, 500], [1.1, 9000]] }, rev: 0.4 })
    for (let i = 0; i < 4; i++) tone(ctx, m, { t: t + 1.05 + i * 0.05, f: nf(['E7', 'B6', 'G#7', 'E8'][i]), a: 0.001, d: 0.35, gain: 0.07, rev: 0.5, pan: (i % 2 ? 0.4 : -0.4) })
  }, { tags: ['ışınlan', 'teleport', 'büyü'] }),
  S('sihir', 'Sihirli Parıltı', 'oyun', 2.4, { revTime: 2, delay: 0.17, delayFb: 0.35 }, (ctx, m, t) => {
    const r = rng(5)
    for (let i = 0; i < 16; i++) tone(ctx, m, { t: t + r() * 1.1, f: 2000 + r() * 4500, a: 0.001, d: 0.2 + r() * 0.25, gain: 0.07, rev: 0.5, dly: 0.2, pan: (r() - 0.5) * 1.6 })
    tone(ctx, m, { t, f: nf('C6'), f1: nf('C7'), glideT: 1.2, pts: [[0, 0], [0.3, 1], [1.3, 0]], gain: 0.08, type: 'triangle', vib: { rate: 7, depth: 12 }, rev: 0.5 })
  }, { tags: ['sihir', 'büyü', 'parıltı', 'magic'] }),
  S('kilic', 'Kılıç Savurma', 'oyun', 1.2, { revTime: 1 }, (ctx, m, t) => {
    noise(ctx, m, { t, pts: [[0, 0], [0.09, 1], [0.24, 0]], gain: 0.8, filter: { type: 'bandpass', q: 1.6, pts: [[0, 1200], [0.12, 6500], [0.24, 2500]] }, pan: [-0.5, 0.5] })
    partials(ctx, m, { t: t + 0.06, f: 2900, ratios: [1, 1.48, 2.13, 2.79], decays: [0.7, 0.5, 0.35, 0.25], gain: 0.12, rev: 0.25, pan: 0.3 })
  }, { tags: ['kılıç', 'sword', 'savur', 'şing'] }),
  S('yumruk', 'Yumruk', 'oyun', 0.6, { revTime: 0.5 }, (ctx, m, t) => {
    noise(ctx, m, { t, pts: [[0, 0], [0.05, 0.3], [0.065, 0]], gain: 0.5, filter: { type: 'bandpass', f: 2500, q: 1 } })
    t += 0.06
    tone(ctx, m, { t, f: 150, f1: 45, glideT: 0.08, a: 0.001, d: 0.2, gain: 0.95, drive: 2 })
    noise(ctx, m, { t, a: 0.001, d: 0.05, gain: 0.6, filter: { type: 'lowpass', f: 2600 } })
    click(ctx, m, t, 4000, 0.4, 0.007, 1)
  }, { tags: ['yumruk', 'punch', 'vuruş', 'dövüş'] }),
  S('silah-saklama', 'Tabanca Şaklaması', 'oyun', 1.4, { revTime: 1.3, revGain: 0.7 }, (ctx, m, t) => {
    noise(ctx, m, { t, a: 0.0005, d: 0.05, gain: 1, filter: { type: 'highpass', f: 700 }, drive: 3 })
    noise(ctx, m, { t, a: 0.001, d: 0.14, gain: 0.7, filter: { type: 'lowpass', f: 1600 }, rev: 0.35 })
    tone(ctx, m, { t, f: 130, f1: 48, glideT: 0.06, a: 0.0008, d: 0.13, gain: 0.8, drive: 2 })
  }, { tags: ['silah', 'ateş', 'atış', 'tabanca'] }),
  S('sarjor', 'Şarjör Takma', 'oyun', 0.8, { revTime: 0.5, revGain: 0.3 }, (ctx, m, t) => {
    click(ctx, m, t, 2500, 0.7, 0.015, 2); tone(ctx, m, { t, f: 1250, a: 0.0005, d: 0.03, gain: 0.2 })
    noise(ctx, m, { t: t + 0.08, pts: [[0, 0], [0.05, 0.4], [0.16, 0]], gain: 0.4, filter: { type: 'bandpass', f: 1800, q: 1.5 } })
    click(ctx, m, t + 0.3, 1500, 0.9, 0.03, 1.5); tone(ctx, m, { t: t + 0.3, f: 600, f1: 450, a: 0.0005, d: 0.06, gain: 0.35 })
    partials(ctx, m, { t: t + 0.31, f: 3300, ratios: [1, 1.6, 2.3], decays: [0.25, 0.15, 0.1], gain: 0.07 })
  }, { tags: ['şarjör', 'reload', 'silah'] }),
  S('ayak-sesleri', 'Ayak Sesleri', 'oyun', 3, { revTime: 0.6, revGain: 0.3 }, (ctx, m, t) => {
    const r = rng(3)
    for (let i = 0; i < 6; i++) {
      const tt = t + i * 0.45 + r() * 0.03, lp = i % 2 ? 520 : 700
      noise(ctx, m, { t: tt, a: 0.002, d: 0.08, gain: 0.85, filter: { type: 'lowpass', f: lp }, color: 'brown', seed: i, pan: i % 2 ? 0.15 : -0.15 })
      noise(ctx, m, { t: tt + 0.012, a: 0.002, d: 0.05, gain: 0.22, filter: { type: 'bandpass', f: 2400, q: 1 }, seed: i + 9 })
      tone(ctx, m, { t: tt, f: 95 + r() * 15, a: 0.002, d: 0.06, gain: 0.3 })
    }
  }, { tags: ['ayak', 'yürüme', 'adım'] }),
  S('hasar', 'Hasar Alma', 'oyun', 0.5, {}, (ctx, m, t) => {
    tone(ctx, m, { t, type: 'square', f: 620, f1: 140, glideT: 0.22, a: 0.002, d: 0.28, gain: 0.18, drive: 2, filter: { type: 'lowpass', f: 3000 } })
    noise(ctx, m, { t, a: 0.001, d: 0.08, gain: 0.35, filter: { type: 'bandpass', f: 1000, q: 1 } })
  }, { tags: ['hasar', 'can', 'acı', '8-bit'] }),
  S('can-toplama', 'Can Toplama', 'oyun', 1.2, { revTime: 1.2 }, (ctx, m, t) => {
    ;['E5', 'G#5', 'B5', 'E6'].forEach((n, i) => tone(ctx, m, { t: t + i * 0.05, f: nf(n), a: 0.002, d: 0.6, gain: 0.18, rev: 0.3 }))
    noise(ctx, m, { t, a: 0.1, d: 0.5, gain: 0.06, filter: { type: 'highpass', f: 7000 }, rev: 0.3 })
  }, { tags: ['can', 'iyileş', 'heal'] }),
  S('geri-sayim-bip', 'Geri Sayım Bipleri', 'oyun', 4.4, { revTime: 0.8 }, (ctx, m, t) => {
    for (let i = 0; i < 3; i++) tone(ctx, m, { t: t + i, dur: 0.16, f: 880, type: 'square', a: 0.002, s: 1, r: 0.03, gain: 0.16, filter: { type: 'lowpass', f: 4000 }, rev: 0.1 })
    tone(ctx, m, { t: t + 3, dur: 0.75, f: 1760, type: 'square', a: 0.002, s: 1, r: 0.06, gain: 0.16, filter: { type: 'lowpass', f: 5000 }, rev: 0.1 })
  }, { tags: ['geri sayım', 'yarış', 'başla'] }),
  S('kilit-acma', 'Kilit Açma', 'oyun', 1.4, { revTime: 1.2 }, (ctx, m, t) => {
    click(ctx, m, t, 2200, 0.7, 0.02, 2)
    click(ctx, m, t + 0.12, 1600, 0.6, 0.03, 2)
    for (const [n, dt] of [['E6', 0.2], ['B6', 0.28]]) tone(ctx, m, { t: t + dt, f: nf(n), a: 0.002, d: 0.8, gain: 0.18, fm: { ratio: 3, index: 1, index1: 0, t: 0.3 }, rev: 0.3 })
  }, { tags: ['kilit', 'açıldı', 'unlock'] }),
  S('oyun-bitti-melodi', 'Oyun Bitti Melodisi', 'oyun', 2.6, { revTime: 1.2 }, (ctx, m, t) => {
    const s = 0.22
    ;['A4', 'E4', 'C4', 'A3'].forEach((n, i) => chip(ctx, m, t + i * s, n, s * 0.85, { gain: 0.13 }))
    chip(ctx, m, t + 4 * s, 'G#3', 1.0, { gain: 0.13, vib: true, s: 0.7 })
    ;['A2', 'F2', 'E2'].forEach((n, i) => chip(ctx, m, t + i * s * 1.5, n, s * 1.4, { type: 'triangle', gain: 0.2 }))
  }, { tags: ['oyun bitti', 'game over', 'kaybettin'] }),
  S('zafer-fanfari', 'Zafer Fanfarı', 'oyun', 3.2, { revTime: 2 }, (ctx, m, t) => {
    const s = 0.13
    const mel = [['G4', 0, 1], ['C5', 1, 1], ['E5', 2, 1], ['G5', 3, 3], ['F5', 6, 1], ['G5', 7, 1], ['C6', 8, 8]]
    for (const [n, st, l] of mel) brass(ctx, m, t + st * s, n, l * s * 0.92, { gain: 0.13, a: 0.02 })
    for (const [n, st, l] of [['C4', 0, 3], ['E4', 3, 3], ['F4', 6, 2], ['E4', 8, 8]]) brass(ctx, m, t + st * s, n, l * s * 0.95, { gain: 0.09, lp: 600 })
    kick(ctx, m, t + 8 * s, { gain: 0.5 }); cymbal(ctx, m, t + 8 * s, { gain: 0.15, d: 1.4 })
  }, { tags: ['zafer', 'kazandın', 'fanfar', 'victory'] }),
]

export default [...gecis, ...arayuz, ...oyun]
