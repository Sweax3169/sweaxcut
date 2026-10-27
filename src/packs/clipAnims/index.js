// Klip animasyonları: giriş / çıkış / döngü (CapCut "Kombo" karşılığı)
// in: p 0→1, p=1'de nötr. out: p=0'da nötr. loop: p her döngüde 1 artar (periyodik).
import { register } from '../../engine/registry.js'
import { EASINGS as E, clamp01 } from '../../core/easing.js'

const PI = Math.PI, TAU = Math.PI * 2
// k=1'de tam olarak nötr değeri veren karışım
const fr = (start, neutral, k) => neutral + (start - neutral) * (1 - k)
const fract = v => v - Math.floor(v)
const hash = (n, seed = 0) => fract(Math.sin(n * 12.9898 + (seed % 997) * 78.233) * 43758.5453)
const sn = (seed) => (seed || 0) % 997

// ---------------------------------------------------------------- GİRİŞLER
// her biri (p, ctx) → durum; p=1'de nötr olmalı
const IN = [
  ['belir', 'Belir', 'Kaybol', 0.5, p => ({ opacity: E.sineOut(p) })],
  ['zum-ici', 'Yakınlaşarak Gir', 'Uzaklaşarak Çık', 0.5, p => { const k = E.cubicOut(p); return { scale: fr(0.55, 1, k), opacity: clamp01(p * 2.5) } }],
  ['zum-disi', 'Büyükten Küçül', 'Büyüyerek Çık', 0.5, p => { const k = E.cubicOut(p); return { scale: fr(1.7, 1, k), opacity: clamp01(p * 2.5) } }],
  ['kay-sol', 'Soldan Kay', 'Sola Kay', 0.5, p => ({ x: fr(-1, 0, E.cubicOut(p)) })],
  ['kay-sag', 'Sağdan Kay', 'Sağa Kay', 0.5, p => ({ x: fr(1, 0, E.cubicOut(p)) })],
  ['kay-yukari', 'Yukarıdan Kay', 'Yukarı Kay', 0.5, p => ({ y: fr(-1, 0, E.cubicOut(p)) })],
  ['kay-asagi', 'Aşağıdan Kay', 'Aşağı Kay', 0.5, p => ({ y: fr(1, 0, E.cubicOut(p)) })],
  ['sek-sol', 'Soldan Sekerek', 'Sola Sekerek', 0.6, p => ({ x: fr(-1, 0, E.backOut(p)) })],
  ['sek-sag', 'Sağdan Sekerek', 'Sağa Sekerek', 0.6, p => ({ x: fr(1, 0, E.backOut(p)) })],
  ['dus-zipla', 'Düşüp Zıpla', 'Zıplayıp Uç', 0.8, p => {
    const k = E.bounceOut(p)
    const hit = p > 0.36 ? Math.max(0, 1 - Math.abs(k - 1) * 12) * (1 - p) : 0
    return { y: fr(-1.1, 0, k), scaleY: 1 - 0.12 * hit, scaleX: 1 + 0.08 * hit }
  }],
  ['asagidan-firla', 'Aşağıdan Fırla', 'Aşağı Fırla', 0.6, p => ({ y: fr(1.1, 0, E.overshoot(p)), scaleY: fr(1.15, 1, E.cubicOut(p)) })],
  ['yuksel', 'Yüksel', 'Alçal', 0.6, p => ({ y: fr(0.12, 0, E.cubicOut(p)), opacity: E.sineOut(p) })],
  ['cok', 'Süzülerek İn', 'Süzülerek Kalk', 0.6, p => ({ y: fr(-0.12, 0, E.cubicOut(p)), opacity: E.sineOut(p) })],
  ['don', 'Dönerek Gir', 'Dönerek Çık', 0.6, p => { const k = E.cubicOut(p); return { rotation: fr(-90, 0, k), scale: fr(0.5, 1, k), opacity: clamp01(p * 2) } }],
  ['don-360', '360 Dönüş', '360 Dönerek Çık', 0.7, p => { const k = E.quartOut(p); return { rotation: fr(-360, 0, k), scale: fr(0.2, 1, k), opacity: clamp01(p * 3) } }],
  ['sallan', 'Sallanarak Gir', 'Sallanarak Çık', 0.8, p => ({ rotation: 28 * Math.pow(1 - p, 2) * Math.cos(p * PI * 4.5), opacity: clamp01(p * 3) })],
  ['pop', 'Pat Diye', 'Pat Diye Çık', 0.45, p => ({ scale: fr(0, 1, E.overshoot(p)) })],
  ['elastik', 'Elastik', 'Elastik Çık', 0.8, p => ({ scale: fr(0, 1, E.elasticOut(p)) })],
  ['zipla-belir', 'Zıplayarak Belir', 'Zıplayarak Kaybol', 0.7, p => ({ scale: fr(0.3, 1, E.bounceOut(p)), opacity: clamp01(p * 3) })],
  ['cevir-x', 'Yatay Çevirerek', 'Yatay Çevirerek Çık', 0.5, p => { const k = E.cubicOut(p); return { scaleX: Math.sin(k * PI / 2), brightness: fr(0.35, 0, k) } }],
  ['cevir-y', 'Dikey Çevirerek', 'Dikey Çevirerek Çık', 0.5, p => { const k = E.cubicOut(p); return { scaleY: Math.sin(k * PI / 2), brightness: fr(0.35, 0, k) } }],
  ['bulaniktan', 'Bulanıktan Net', 'Netten Bulanığa', 0.6, p => { const k = E.cubicOut(p); return { blur: fr(1, 0, k), opacity: clamp01(p * 2) } }],
  ['flas', 'Flaşla Gir', 'Flaşla Çık', 0.4, p => ({ brightness: fr(1, 0, E.cubicOut(p)), opacity: clamp01(p * 4) })],
  ['sarsinti', 'Sarsılarak Gir', 'Sarsılarak Çık', 0.6, (p, c) => {
    const a = Math.pow(1 - p, 1.5), f = Math.floor(p * 24), s = sn(c && c.seed)
    return { x: (hash(f, s) - 0.5) * 0.12 * a, y: (hash(f + 50, s) - 0.5) * 0.08 * a, opacity: clamp01(p * 4) }
  }],
  ['glitch', 'Glitch Gir', 'Glitch Çık', 0.5, (p, c) => {
    if (p >= 1) return {}
    const f = Math.floor(p * 20), s = sn(c && c.seed), a = 1 - p
    return { x: (hash(f, s) - 0.5) * 0.15 * a * (hash(f + 9, s) > 0.4 ? 1 : 0), rgbSplit: a * (0.5 + 0.5 * hash(f + 3, s)), opacity: hash(f + 7, s) < p * 1.3 + 0.2 ? 1 : 0.2, skewX: (hash(f + 1, s) - 0.5) * 30 * a }
  }],
  ['kirbac', 'Kırbaç Gir', 'Kırbaç Çık', 0.4, p => { const k = E.expoOut(p); return { x: fr(1.2, 0, k), blur: fr(0.6, 0, k), skewX: fr(-25, 0, k) } }],
  ['egik', 'Eğilerek Gir', 'Eğilerek Çık', 0.5, p => { const k = E.cubicOut(p); return { skewX: fr(40, 0, k), x: fr(-0.35, 0, k), opacity: clamp01(p * 2) } }],
  ['dalga', 'Dalgalanarak', 'Dalgalanarak Çık', 0.8, p => { const a = Math.pow(1 - p, 2); return { y: 0.08 * a * Math.sin(p * PI * 5), rotation: 6 * a * Math.sin(p * PI * 5 + 1), opacity: clamp01(p * 3) } }],
  ['zum-bulanik', 'Zum Bulanık Gir', 'Zum Bulanık Çık', 0.5, p => { const k = E.cubicOut(p); return { scale: fr(2, 1, k), blur: fr(0.8, 0, k), opacity: clamp01(p * 3) } }],
  ['sikis', 'Sıkışarak Gir', 'Sıkışarak Çık', 0.7, p => { const k = E.elasticOut(p); return { scaleX: fr(1.8, 1, k), scaleY: fr(0.25, 1, k), opacity: clamp01(p * 4) } }],
  ['esne', 'Esneyerek Gir', 'Esneyerek Çık', 0.6, p => { const k = E.backOut(p); return { scaleX: fr(0.4, 1, k), scaleY: fr(1.8, 1, k), opacity: clamp01(p * 4) } }],
  ['sarkac', 'Sarkaç', 'Sarkaçla Çık', 1.0, p => ({ rotation: 50 * Math.pow(1 - p, 1.5) * Math.cos(p * PI * 3), y: -0.04 * Math.pow(1 - p, 2), opacity: clamp01(p * 4) })],
  ['deprem', 'Deprem', 'Deprem Çıkışı', 0.8, (p, c) => {
    const a = Math.pow(1 - p, 1.2), f = Math.floor(p * 30), s = sn(c && c.seed)
    return { x: (hash(f, s) - 0.5) * 0.2 * a, y: (hash(f + 31, s) - 0.5) * 0.16 * a, rotation: (hash(f + 77, s) - 0.5) * 14 * a, scale: fr(1.15, 1, p) }
  }],
  ['kivril', 'Kıvrılarak Gir', 'Kıvrılarak Çık', 0.7, p => {
    const k = E.cubicOut(p), r = 0.45 * (1 - k), a = (1 - k) * PI * 2.5
    return { x: r * Math.cos(a), y: r * Math.sin(a), rotation: fr(180, 0, k), scale: fr(0.1, 1, k) }
  }],
  ['kose-sol-ust', 'Sol Üst Köşeden', 'Sol Üst Köşeye', 0.6, p => { const k = E.cubicOut(p); return { x: fr(-0.7, 0, k), y: fr(-0.7, 0, k), rotation: fr(-20, 0, k) } }],
  ['kose-sag-ust', 'Sağ Üst Köşeden', 'Sağ Üst Köşeye', 0.6, p => { const k = E.cubicOut(p); return { x: fr(0.7, 0, k), y: fr(-0.7, 0, k), rotation: fr(20, 0, k) } }],
  ['kose-sol-alt', 'Sol Alt Köşeden', 'Sol Alt Köşeye', 0.6, p => { const k = E.cubicOut(p); return { x: fr(-0.7, 0, k), y: fr(0.7, 0, k), rotation: fr(20, 0, k) } }],
  ['kose-sag-alt', 'Sağ Alt Köşeden', 'Sağ Alt Köşeye', 0.6, p => { const k = E.cubicOut(p); return { x: fr(0.7, 0, k), y: fr(0.7, 0, k), rotation: fr(-20, 0, k) } }],
  ['yuvarlan', 'Yuvarlanarak Gir', 'Yuvarlanarak Çık', 0.8, p => { const k = E.cubicOut(p); return { x: fr(-1.1, 0, k), rotation: fr(-360, 0, k) } }],
  ['zum-don', 'Zum Dönüş', 'Zum Dönüşle Çık', 0.6, p => { const k = E.quartOut(p); return { scale: fr(3, 1, k), rotation: fr(90, 0, k), blur: fr(0.5, 0, k), opacity: clamp01(p * 3) } }],
  ['titrek', 'Titreyerek Belir', 'Titreyerek Kaybol', 0.6, (p, c) => {
    if (p >= 1) return {}
    const f = Math.floor(p * 16), s = sn(c && c.seed)
    return { opacity: hash(f, s) < p * 1.2 ? 1 : 0.1 }
  }],
  ['neon', 'Neon Yanışı', 'Neon Sönüşü', 0.7, (p, c) => {
    if (p >= 1) return {}
    const f = Math.floor(p * 18), s = sn(c && c.seed), on = hash(f, s) < p * 1.4
    return { opacity: on ? 1 : 0.15, brightness: on ? 0.45 * (1 - p) : 0 }
  }],
  ['savrul', 'Savrularak', 'Savrularak Çık', 0.6, p => { const k = E.cubicOut(p); return { x: fr(0.3, 0, k), y: fr(0.05, 0, k), rotation: fr(15, 0, k), blur: fr(0.3, 0, k), opacity: clamp01(p * 2) } }],
  ['tv', 'Tüplü TV Açılışı', 'Tüplü TV Kapanışı', 0.5, p => {
    const a = clamp01(p / 0.45), b = clamp01((p - 0.35) / 0.65)
    return { scaleX: fr(0.02, 1, E.cubicOut(a)), scaleY: fr(0.01, 1, E.cubicOut(b)), brightness: fr(1, 0, E.cubicOut(p)) }
  }],
  ['agir-zum', 'Ağır Zum', 'Ağır Uzaklaş', 1.2, p => ({ scale: fr(1.25, 1, E.sineOut(p)), opacity: clamp01(p * 3.3) })],
  ['perde-kay', 'Perde Kayması', 'Perde Çekilişi', 0.6, p => { const k = E.quintOut(p); return { x: fr(-0.25, 0, k), scaleX: fr(1.5, 1, k), opacity: clamp01(p * 2.5) } }],
]

// ---------------------------------------------------------------- YALNIZ ÇIKIŞ
const OUT_ONLY = [
  ['kara-delik', 'Kara Delik', 0.7, p => { const k = E.cubicIn(p); return { scale: 1 - k, rotation: 540 * k, brightness: -0.5 * k } }],
  ['patla', 'Patla', 0.4, p => { const k = E.cubicOut(p); return { scale: 1 + 0.6 * k, opacity: 1 - k, blur: 0.5 * k, brightness: 0.4 * k } }],
  ['yercekimi', 'Yer Çekimiyle Düş', 0.7, p => { const k = E.cubicIn(p); return { y: 1.4 * k, rotation: 25 * k } }],
  ['ucup-git', 'Uçup Git', 0.7, p => { const k = E.cubicIn(p); return { y: -1.3 * k, scale: 1 - 0.4 * k, rotation: -10 * k } }],
  ['erime', 'Erime', 0.8, p => { const k = E.cubicIn(p); const sy = 1 - 0.95 * k; return { scaleY: sy, scaleX: 1 + 0.1 * k, y: 0.5 * (1 - sy), blur: 0.4 * k, opacity: 1 - E.quartIn(p) } }],
  ['bugulan', 'Buğulan', 0.7, p => ({ blur: E.sineIn(p), opacity: 1 - E.cubicIn(p), brightness: 0.3 * p })],
  ['glitch-kop', 'Glitch Kopması', 0.5, (p, c) => {
    if (p <= 0) return {}
    const f = Math.floor(p * 20), s = sn(c && c.seed)
    return { x: (hash(f, s) - 0.5) * 0.25 * p, rgbSplit: p, skewX: (hash(f + 2, s) - 0.5) * 40 * p, opacity: hash(f + 5, s) > p ? 1 : 0 }
  }],
  ['ezil', 'Ezil', 0.5, p => { const k = E.backIn(p); return { scaleY: 1 - k, scaleX: 1 + 0.4 * k, y: 0.5 * k } }],
  ['firlat-sag', 'Sağa Fırlat', 0.45, p => { const k = E.expoIn(p); return { x: 1.3 * k, rotation: 30 * k, blur: 0.5 * k } }],
  ['firlat-sol', 'Sola Fırlat', 0.45, p => { const k = E.expoIn(p); return { x: -1.3 * k, rotation: -30 * k, blur: 0.5 * k } }],
]

// ---------------------------------------------------------------- DÖNGÜLER (periyot = 1)
const S = p => Math.sin(TAU * p), Co = p => Math.cos(TAU * p)
const LOOP = [
  ['nefes', 'Nefes', 2, p => ({ scale: 1 + 0.035 * (0.5 - 0.5 * Co(p)) })],
  ['derin-nefes', 'Derin Nefes', 3, p => { const v = 0.5 - 0.5 * Co(p); return { scale: 1 + 0.07 * v, brightness: 0.04 * v } }],
  ['nabiz', 'Nabız', 1, p => ({ scale: 1 + 0.06 * Math.pow(Math.sin(PI * fract(p)), 6) })],
  ['kalp-atisi', 'Kalp Atışı', 1, p => { const f = fract(p); const b = Math.exp(-Math.pow((f - 0.1) / 0.05, 2)) + 0.7 * Math.exp(-Math.pow((f - 0.3) / 0.05, 2)); return { scale: 1 + 0.07 * b } }],
  ['yalpala', 'Yalpala', 1.2, p => ({ rotation: 3 * S(p), scaleX: 1 + 0.015 * S(p * 2), scaleY: 1 - 0.015 * S(p * 2) })],
  ['suzul', 'Süzül', 3, p => ({ y: 0.015 * S(p), rotation: 0.8 * Math.sin(TAU * p + 1) })],
  ['sallan', 'Sallan', 1.6, p => ({ rotation: 6 * S(p) })],
  ['sarkac', 'Sarkaç', 2, p => ({ rotation: 11 * S(p), y: -0.01 * Math.abs(S(p)) })],
  ['titres', 'Titreşim', 1, (p, c) => { const f = Math.floor(fract(p) * 24), s = sn(c && c.seed); return { x: (hash(f, s) - 0.5) * 0.012, y: (hash(f + 40, s) - 0.5) * 0.012 } }],
  ['panik', 'Panik', 1, (p, c) => { const f = Math.floor(fract(p) * 20), s = sn(c && c.seed); return { x: (hash(f, s) - 0.5) * 0.03, y: (hash(f + 40, s) - 0.5) * 0.025, rotation: (hash(f + 80, s) - 0.5) * 3, scale: 1.03 } }],
  ['gerilim', 'Gerilim', 1, p => ({ x: 0.0025 * Math.sin(TAU * 12 * p), y: 0.0015 * Math.sin(TAU * 17 * p + 1), scale: 1.01 })],
  ['yavas-don', 'Yavaş Dön', 8, p => ({ rotation: 360 * fract(p) })],
  ['sars', 'Beşik', 2, p => ({ rotation: 4 * S(p), x: 0.01 * S(p) })],
  ['zipla', 'Zıpla', 0.8, p => { const f = fract(p); const h = Math.sin(PI * f); const sq = Math.max(0, 1 - h * 6); return { y: -0.045 * h, scaleY: 1 - 0.05 * sq + 0.03 * h, scaleX: 1 + 0.04 * sq } }],
  ['pogo', 'Pogo', 0.7, p => { const f = fract(p); const h = 4 * f * (1 - f); return { y: -0.08 * h, scaleY: 1 + 0.06 * h - 0.06 * Math.max(0, 1 - h * 5), scaleX: 1 - 0.03 * h + 0.05 * Math.max(0, 1 - h * 5) } }],
  ['kirpis', 'Kırpış', 2, (p, c) => { const f = Math.floor(fract(p) * 30), s = sn(c && c.seed); return { opacity: hash(f, s) > 0.88 ? 0.55 : 1 } }],
  ['yanip-son', 'Yanıp Sön', 1.2, p => ({ opacity: 0.55 + 0.45 * (0.5 + 0.5 * Co(p)) })],
  ['neon', 'Neon Titremesi', 2, (p, c) => { const f = Math.floor(fract(p) * 32), s = sn(c && c.seed); const h = hash(f, s); return { brightness: h > 0.9 ? -0.35 : 0.12 * h, opacity: h > 0.96 ? 0.6 : 1 } }],
  ['glitch', 'Glitch Döngüsü', 1.5, (p, c) => {
    const f = fract(p), s = sn(c && c.seed)
    if (f < 0.8) return {}
    const g = Math.floor(f * 60)
    return { x: (hash(g, s) - 0.5) * 0.05, rgbSplit: 0.4 + 0.4 * hash(g + 3, s), skewX: (hash(g + 5, s) - 0.5) * 12 }
  }],
  ['rgb', 'RGB Titreşimi', 1, p => ({ rgbSplit: 0.25 * (0.5 + 0.5 * S(p)) })],
  ['ritim-zum', 'Ritim Zumu (120 BPM)', 0.5, p => ({ scale: 1 + 0.08 * Math.exp(-fract(p) * 7) })],
  ['bas-vurusu', 'Bas Vuruşu (120 BPM)', 0.5, p => { const f = fract(p); const e = Math.exp(-f * 8); return { scale: 1 + 0.05 * e, y: 0.006 * e, brightness: 0.12 * Math.exp(-f * 14) } }],
  ['egil', 'Eğil', 1.6, p => ({ skewX: 4 * S(p) })],
  ['sekiz', 'Sekiz Çiz', 4, p => ({ x: 0.02 * S(p), y: 0.012 * S(p * 2) })],
  ['yorunge', 'Yörünge', 3, p => ({ x: 0.015 * Co(p), y: 0.015 * S(p) })],
  ['lastik', 'Lastik', 0.8, p => ({ scaleX: 1 + 0.06 * S(p), scaleY: 1 - 0.06 * S(p) })],
  ['jole', 'Jöle', 1, p => { const f = fract(p); const d = Math.exp(-f * 4) * Math.sin(f * PI * 6); return { scaleX: 1 + 0.08 * d, scaleY: 1 - 0.08 * d } }],
  ['dalga-yuz', 'Dalgada Yüz', 2.4, p => ({ y: 0.012 * S(p), rotation: 2 * Math.sin(TAU * p + PI / 2), x: 0.006 * S(p * 2) })],
  ['el-kamerasi', 'El Kamerası', 4, p => ({
    x: 0.006 * (S(p) + 0.5 * Math.sin(TAU * 3 * p + 1) + 0.25 * Math.sin(TAU * 7 * p + 2)),
    y: 0.005 * (Math.sin(TAU * 2 * p + 0.5) + 0.5 * Math.sin(TAU * 5 * p + 1.7)),
    rotation: 0.5 * (Math.sin(TAU * 2 * p + 2.2) + 0.4 * Math.sin(TAU * 5 * p)), scale: 1.03,
  })],
  ['kayma', 'Yatay Salınım', 2, p => ({ x: 0.02 * S(p) })],
  ['odak-nabzi', 'Odak Nabzı', 2, p => ({ blur: 0.08 * (0.5 - 0.5 * Co(p)) })],
  ['isik-nabzi', 'Işık Nabzı', 1.5, p => ({ brightness: 0.12 * (0.5 - 0.5 * Co(p)) })],
  ['yalpali-zum', 'Yalpalı Zum', 3, p => ({ scale: 1.06 + 0.04 * S(p), rotation: 2.5 * Math.sin(TAU * p + 1) })],
  ['takla', 'Takla', 2, p => ({ scaleX: Co(p) })],
  ['dalga-egim', 'Dalga Eğimi', 2, p => ({ skewX: 3 * S(p), y: 0.008 * Math.sin(TAU * p + PI / 2) })],
]

const items = []
for (const [id, name, outName, dur, fn] of IN) {
  items.push({ id: 'giris-' + id, name, category: 'in', duration: dur, fn, tags: ['giriş'] })
  items.push({ id: 'cikis-' + id, name: outName, category: 'out', duration: dur, fn: (p, ctx) => fn(1 - p, ctx), tags: ['çıkış'] })
}
for (const [id, name, dur, fn] of OUT_ONLY) items.push({ id: 'cikis-' + id, name, category: 'out', duration: dur, fn, tags: ['çıkış'] })
for (const [id, name, dur, fn] of LOOP) items.push({ id: 'dongu-' + id, name, category: 'loop', duration: dur, fn, tags: ['döngü', 'kombo'] })

export const CLIP_ANIMS = items
export const CLIP_ANIM_CATEGORIES = [
  { id: 'in', name: 'Giriş' },
  { id: 'out', name: 'Çıkış' },
  { id: 'loop', name: 'Döngü' },
]

register('clipAnims', items, CLIP_ANIM_CATEGORIES)
