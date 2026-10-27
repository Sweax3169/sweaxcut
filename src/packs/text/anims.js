// Yazı animasyonları — giriş / çıkış / döngü (REG.textAnims sözleşmesi)
// fn(p, i, n, ctx): p birimin kendi ilerlemesi (giriş 0→1 = yerine oturur, çıkış 0→1 = kaybolur, döngü sürekli artar)
// ctx: { fontSize, lineH, seed, t (sn), n, unitW, unitH, color (temel renk) }
// Döner: { x, y, scale, scaleX, scaleY, rotation, opacity, blur, color, skewX, clip, clipDir, mask,
//          visibleChars, cursor, scramble, wipe, wipeColor }  (hepsi isteğe bağlı)

import { EASINGS as E } from '../../core/easing.js'

const PI = Math.PI, TAU = Math.PI * 2
const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const frac = v => v - Math.floor(v)
function rnd(a, b, c) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
function hex2rgb(h) {
  h = String(h || '#fff').replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * c01(t)).toString(16).padStart(2, '0')).join('')
}
export function hsl(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
const GLITCH = ['#00F0FF', '#FF2BD6', '#E4FF3A']
const DISCO = ['#FF5DA2', '#3FA9F5', '#E4FF3A', '#2EE6A6', '#B98CFF']

// kimlik: giriş 'yazi-<ad>', çıkış 'yazi-cik-<ad>', döngü 'yazi-dongu-<ad>'
const PFX = { in: 'yazi-', out: 'yazi-cik-', loop: 'yazi-dongu-' }
const A = (category) => (id, name, unit, duration, stagger, fn, extra) => ({ id: PFX[category] + id, name, category, unit, duration, stagger, fn, ...extra })
const IN = A('in'), OUT = A('out'), LOOP = A('loop')
// giriş fonksiyonunu çıkışa çevir
const rev = f => (p, i, n, c) => f(1 - p, i, n, c)

// ------------------------------------------------------------------ GİRİŞ
const fGlitchIn = (p, i, n, c) => {
  const k = Math.floor(c.t * 30)
  const r = rnd(c.seed, i, k), r2 = rnd(c.seed, i, k + 3)
  if (p < 0.08) return { opacity: 0 }
  const j = 1 - E.cubicOut(p)
  return {
    x: (r - 0.5) * c.fontSize * 0.35 * j,
    skewX: (r2 - 0.5) * 40 * j,
    opacity: r2 < 0.25 + p ? 1 : 0.25,
    color: p < 0.75 && r > 0.55 ? GLITCH[Math.floor(r2 * 3)] : null,
  }
}
const fNeonOn = (p, i, n, c) => {
  if (p < 0.12) return { opacity: 0.04 }
  if (p < 0.7) return { opacity: rnd(c.seed, i, Math.floor(p * 22)) > 0.45 ? 1 : 0.12 }
  return { opacity: 1 }
}

export const IN_ANIMS = [
  IN('daktilo', 'Daktilo', 'whole', 1.2, 0, p => ({ visibleChars: p })),
  IN('daktilo-imlec', 'Daktilo + imleç', 'whole', 1.4, 0, p => ({ visibleChars: c01(p * 1.1), cursor: 1 })),
  IN('harf-belir', 'Harf harf belir', 'char', 0.8, 0.05, p => ({ opacity: E.easeOut(p) })),
  IN('harf-patla', 'Harf harf patla', 'char', 0.7, 0.05, p => ({ scale: Math.max(0.001, E.backOut(p)), opacity: c01(p * 3) })),
  IN('ziplayarak-dus', 'Zıplayarak düş', 'char', 0.9, 0.05, (p, i, n, c) => ({ y: -(1 - E.bounceOut(p)) * c.fontSize * 1.3, opacity: c01(p * 5) })),
  IN('dalga-yuksel', 'Dalgayla yüksel', 'char', 0.8, 0.06, (p, i, n, c) => ({ y: (1 - E.cubicOut(p)) * c.fontSize * 0.7, rotation: (1 - E.cubicOut(p)) * 14, opacity: E.easeOut(p) })),
  IN('kelime-kay', 'Kelime kelime kay', 'word', 0.7, 0.12, (p, i, n, c) => ({ x: -(1 - E.expoOut(p)) * c.fontSize * 1.2, opacity: E.easeOut(p), blur: (1 - p) * c.fontSize * 0.06 })),
  IN('bulanik-buyu', 'Bulanıktan netleş', 'whole', 0.7, 0, (p, i, n, c) => ({ scale: 1 + (1 - E.cubicOut(p)) * 0.45, blur: (1 - E.cubicOut(p)) * c.fontSize * 0.22, opacity: E.easeOut(p) })),
  IN('harf-don', 'Harf harf dön', 'char', 0.8, 0.05, p => ({ rotation: (1 - E.backOut(p)) * -180, scale: 0.3 + 0.7 * E.cubicOut(p), opacity: c01(p * 2.5) })),
  IN('takla', 'Takla at', 'char', 0.7, 0.06, p => ({ scaleY: Math.max(0.001, E.backOut(p)), skewX: (1 - p) * 12, opacity: c01(p * 3) })),
  IN('glitch', 'Glitch girişi', 'char', 0.8, 0.03, fGlitchIn, { order: 'random' }),
  IN('esnek', 'Esnek', 'whole', 1.0, 0, p => ({ scale: Math.max(0.001, E.elasticOut(p)), opacity: c01(p * 4) })),
  IN('uzaktan-yaklas', 'Uzaktan yaklaş', 'whole', 0.8, 0, (p, i, n, c) => ({ scale: 1 + (1 - E.expoOut(p)) * 2.2, opacity: E.easeOut(p), blur: (1 - E.expoOut(p)) * c.fontSize * 0.2 })),
  IN('maske-ac', 'Maskeyle aç', 'whole', 0.7, 0, p => ({ clip: E.cubicInOut(p) })),
  IN('perde-yuksel', 'Perdeden yüksel', 'line', 0.8, 0.18, (p, i, n, c) => ({ y: (1 - E.expoOut(p)) * c.lineH, clip: 1, mask: true })),
  IN('esneyerek', 'Esneyerek gir', 'char', 0.6, 0.05, p => ({ scaleY: 1 + (1 - E.cubicOut(p)) * 1.4, scaleX: 0.4 + 0.6 * E.cubicOut(p), opacity: c01(p * 3) })),
  IN('yay', 'Yay', 'word', 0.9, 0.1, p => ({ scale: Math.max(0.001, 1 - Math.exp(-6 * p) * Math.cos(p * 14)), opacity: c01(p * 4) })),
  IN('sarsilarak', 'Sarsılarak gir', 'whole', 0.7, 0, (p, i, n, c) => ({ x: Math.sin(p * 50) * c.fontSize * 0.15 * (1 - p), rotation: Math.sin(p * 40) * 6 * (1 - p), opacity: c01(p * 4) })),
  IN('neon-yan', 'Neon yanışı', 'char', 1.0, 0.04, fNeonOn, { order: 'random' }),
  IN('karistir', 'Harf karıştır', 'char', 1.0, 0.035, p => ({ scramble: p < 0.85 ? 1 : 0, opacity: c01(p * 6) })),
  IN('renk-supur', 'Renk süpürme', 'char', 0.8, 0.06, (p, i, n, c) => ({ color: p < 1 ? mix('#E4FF3A', c.color, E.easeIn(p)) : null, y: (1 - E.cubicOut(p)) * c.fontSize * 0.15, opacity: c01(p * 4) })),
  IN('karaoke-sil', 'Karaoke silme', 'whole', 1.2, 0, (p, i, n, c) => ({ color: '#6b6b6b', wipe: p, wipeColor: c.color })),
  IN('yukaridan-in', 'Yukarıdan in', 'line', 0.6, 0.15, (p, i, n, c) => ({ y: -(1 - E.cubicOut(p)) * c.lineH * 0.8, opacity: E.easeOut(p) })),
  IN('asagidan-cik', 'Aşağıdan fırla', 'word', 0.6, 0.1, (p, i, n, c) => ({ y: (1 - E.backOut(p)) * c.fontSize * 0.8, opacity: c01(p * 2.5) })),
  IN('sagdan-kay', 'Sağdan kay', 'whole', 0.6, 0, (p, i, n, c) => ({ x: (1 - E.expoOut(p)) * c.fontSize * 3, opacity: E.easeOut(p), blur: (1 - E.expoOut(p)) * c.fontSize * 0.15 })),
  IN('soldan-kay', 'Soldan kay', 'whole', 0.6, 0, (p, i, n, c) => ({ x: -(1 - E.expoOut(p)) * c.fontSize * 3, opacity: E.easeOut(p), blur: (1 - E.expoOut(p)) * c.fontSize * 0.15 })),
  IN('buyuyerek', 'Büyüyerek', 'whole', 0.6, 0, p => ({ scale: Math.max(0.001, E.backOut(p)), opacity: c01(p * 3) })),
  IN('kuculerek-otur', 'Küçülerek otur', 'whole', 0.6, 0, p => ({ scale: 1 + (1 - E.cubicOut(p)) * 0.6, opacity: E.easeOut(p) })),
  IN('damga', 'Damga', 'whole', 0.45, 0, p => {
    const q = c01(p / 0.7)
    return { scale: 2.6 - 1.6 * E.quartIn(q) - (p > 0.7 ? Math.sin(((p - 0.7) / 0.3) * PI) * 0.06 : 0), rotation: (1 - E.quartIn(q)) * -10, opacity: c01(p * 4) }
  }),
  IN('egik-gir', 'Eğik gir', 'word', 0.6, 0.1, (p, i, n, c) => ({ skewX: (1 - E.cubicOut(p)) * -35, x: -(1 - E.expoOut(p)) * c.fontSize * 0.8, opacity: E.easeOut(p) })),
  IN('donerek-dus', 'Dönerek düş', 'char', 0.9, 0.05, (p, i, n, c) => ({ y: -(1 - E.cubicOut(p)) * c.fontSize * 1.2, rotation: (1 - E.backOut(p)) * 90, opacity: c01(p * 3) })),
  IN('rastgele-belir', 'Rastgele belir', 'char', 0.9, 0.05, (p, i, n, c) => ({ opacity: E.easeOut(p), scale: 0.6 + 0.4 * E.backOut(p), blur: (1 - p) * c.fontSize * 0.06 }), { order: 'random' }),
  IN('ortadan-acil', 'Ortadan açıl', 'char', 0.7, 0.08, p => ({ scaleX: Math.max(0.001, E.cubicOut(p)), opacity: c01(p * 2) }), { order: 'center' }),
  IN('hizli-iz', 'Hızlı iz', 'whole', 0.5, 0, (p, i, n, c) => ({ x: -(1 - E.expoOut(p)) * c.fontSize * 4, blur: (1 - E.expoOut(p)) * c.fontSize * 0.35, scaleX: 1 + (1 - E.expoOut(p)) * 0.6, opacity: c01(p * 3) })),
  IN('sarkac-gir', 'Sarkaç gibi gir', 'word', 0.9, 0.12, p => ({ rotation: (1 - E.elasticOut(p)) * 40, opacity: c01(p * 3) })),
  IN('kelime-patla', 'Kelime kelime patla', 'word', 0.6, 0.14, p => ({ scale: Math.max(0.001, E.overshoot(p)), opacity: c01(p * 3) })),
]

// ------------------------------------------------------------------ ÇIKIŞ
export const OUT_ANIMS = [
  OUT('daktilo-sil', 'Daktiloyla sil', 'whole', 0.9, 0, p => ({ visibleChars: 1 - p })),
  OUT('harf-son', 'Harf harf sön', 'char', 0.6, 0.05, p => ({ opacity: 1 - E.easeIn(p) })),
  OUT('harf-kucul', 'Harf harf küçül', 'char', 0.6, 0.05, p => ({ scale: Math.max(0.001, 1 - E.backIn(p)), opacity: p > 0.8 ? (1 - p) * 5 : 1 })),
  OUT('dus', 'Düşüp git', 'char', 0.9, 0.04, (p, i, n, c) => ({ y: E.cubicIn(p) * c.fontSize * 2.2 - Math.sin(p * PI) * c.fontSize * 0.2, rotation: (rnd(c.seed, i, 1) - 0.5) * 120 * E.cubicIn(p), opacity: 1 - E.quartIn(p) }), { order: 'random' }),
  OUT('dalga-in', 'Dalgayla in', 'char', 0.7, 0.06, (p, i, n, c) => ({ y: E.cubicIn(p) * c.fontSize * 0.7, opacity: 1 - E.easeIn(p) })),
  OUT('kelime-kay', 'Kelime kelime kay', 'word', 0.6, 0.12, (p, i, n, c) => ({ x: E.expoIn(p) * c.fontSize * 1.2, opacity: 1 - E.easeIn(p), blur: p * c.fontSize * 0.06 })),
  OUT('bulanik-son', 'Bulanıklaşarak sön', 'whole', 0.6, 0, (p, i, n, c) => ({ scale: 1 + E.cubicIn(p) * 0.35, blur: E.cubicIn(p) * c.fontSize * 0.22, opacity: 1 - E.easeIn(p) })),
  OUT('donerek-cik', 'Dönerek çık', 'char', 0.7, 0.05, p => ({ rotation: E.backIn(p) * 180, scale: 1 - 0.7 * E.cubicIn(p), opacity: 1 - E.quartIn(p) })),
  OUT('takla', 'Takla atarak çık', 'char', 0.6, 0.05, p => ({ scaleY: Math.max(0.001, 1 - E.backIn(p)), opacity: 1 - E.quartIn(p) })),
  OUT('glitch', 'Glitch çıkışı', 'char', 0.6, 0.03, rev(fGlitchIn), { order: 'random' }),
  OUT('esnek', 'Esnek çık', 'whole', 0.5, 0, p => ({ scale: Math.max(0.001, 1 - E.backIn(p)) })),
  OUT('uzaklas', 'Uzaklaş', 'whole', 0.6, 0, p => ({ scale: 1 - 0.8 * E.cubicIn(p), opacity: 1 - E.easeIn(p) })),
  OUT('ekrana-yaklas', 'Ekrana yaklaş', 'whole', 0.6, 0, (p, i, n, c) => ({ scale: 1 + E.expoIn(p) * 2.2, opacity: 1 - E.easeIn(p), blur: E.expoIn(p) * c.fontSize * 0.2 })),
  OUT('maske-kapa', 'Maskeyle kapa', 'whole', 0.6, 0, p => ({ clip: 1 - E.cubicInOut(p), clipDir: 'right' })),
  OUT('perdeye-in', 'Perdeye in', 'line', 0.7, 0.15, (p, i, n, c) => ({ y: E.expoIn(p) * c.lineH, clip: 1, mask: true })),
  OUT('esneyerek', 'Esneyerek çık', 'char', 0.5, 0.05, p => ({ scaleY: 1 + E.cubicIn(p) * 1.5, scaleX: Math.max(0.001, 1 - 0.7 * E.cubicIn(p)), opacity: 1 - E.quartIn(p) })),
  OUT('sarsilarak', 'Sarsılarak çık', 'whole', 0.6, 0, (p, i, n, c) => ({ x: Math.sin(p * 50) * c.fontSize * 0.15 * p, rotation: Math.sin(p * 40) * 6 * p, opacity: 1 - E.quartIn(p) })),
  OUT('neon-son', 'Neon sönüşü', 'char', 0.8, 0.04, rev(fNeonOn), { order: 'random' }),
  OUT('karisarak', 'Karışarak çık', 'char', 0.8, 0.03, p => ({ scramble: p > 0.1 ? 1 : 0, opacity: 1 - E.quartIn(p) })),
  OUT('yukari-uc', 'Yukarı uç', 'line', 0.6, 0.12, (p, i, n, c) => ({ y: -E.cubicIn(p) * c.lineH * 0.9, opacity: 1 - E.easeIn(p) })),
  OUT('saga-kay', 'Sağa kay', 'whole', 0.5, 0, (p, i, n, c) => ({ x: E.expoIn(p) * c.fontSize * 3, opacity: 1 - E.easeIn(p), blur: E.expoIn(p) * c.fontSize * 0.15 })),
  OUT('sola-kay', 'Sola kay', 'whole', 0.5, 0, (p, i, n, c) => ({ x: -E.expoIn(p) * c.fontSize * 3, opacity: 1 - E.easeIn(p), blur: E.expoIn(p) * c.fontSize * 0.15 })),
  OUT('rastgele-son', 'Rastgele sön', 'char', 0.8, 0.05, (p, i, n, c) => ({ opacity: 1 - E.easeIn(p), scale: 1 - 0.4 * E.backIn(p), blur: p * c.fontSize * 0.06 }), { order: 'random' }),
  OUT('ortaya-kapan', 'Ortaya kapan', 'char', 0.6, 0.08, p => ({ scaleX: Math.max(0.001, 1 - E.cubicIn(p)), opacity: 1 - E.quartIn(p) }), { order: 'edges' }),
  OUT('hizli-iz', 'Hızlı iz çık', 'whole', 0.45, 0, (p, i, n, c) => ({ x: E.expoIn(p) * c.fontSize * 4, blur: E.expoIn(p) * c.fontSize * 0.35, scaleX: 1 + E.expoIn(p) * 0.6, opacity: 1 - E.quartIn(p) })),
  OUT('patla', 'Patla', 'char', 0.7, 0, (p, i, n, c) => {
    const side = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0
    const a = Math.atan2(-0.6 - rnd(c.seed, i, 4), side + (rnd(c.seed, i, 5) - 0.5) * 0.8)
    const d = E.cubicOut(p) * c.fontSize * (1.4 + rnd(c.seed, i, 6) * 1.6)
    return { x: Math.cos(a) * d, y: Math.sin(a) * d + E.cubicIn(p) * c.fontSize * 1.2, rotation: (rnd(c.seed, i, 7) - 0.5) * 300 * p, scale: 1 + p * 0.3, opacity: 1 - E.quartIn(p) }
  }),
  OUT('egik-cik', 'Eğik çık', 'word', 0.5, 0.1, (p, i, n, c) => ({ skewX: E.cubicIn(p) * 35, x: E.expoIn(p) * c.fontSize * 0.8, opacity: 1 - E.easeIn(p) })),
  OUT('buhar', 'Buharlaş', 'char', 0.8, 0.04, (p, i, n, c) => ({ y: -E.cubicOut(p) * c.fontSize * 0.8, blur: p * c.fontSize * 0.15, opacity: 1 - E.easeOut(p), scale: 1 + p * 0.3 }), { order: 'random' }),
]

// ------------------------------------------------------------------ DÖNGÜ
export const LOOP_ANIMS = [
  LOOP('gokkusagi', 'Gökkuşağı', 'char', 2.0, 0.06, p => ({ color: hsl(frac(p) * 360, 95, 62) })),
  LOOP('dalga', 'Dalga', 'char', 1.2, 0.08, (p, i, n, c) => ({ y: Math.sin(p * TAU) * c.fontSize * 0.12 })),
  LOOP('suzul', 'Süzül', 'whole', 2.4, 0, (p, i, n, c) => ({ y: Math.sin(p * TAU) * c.fontSize * 0.08, rotation: Math.sin(p * TAU + 1) * 1.2 })),
  LOOP('kalp-atisi', 'Kalp atışı', 'whole', 1.0, 0, p => {
    const q = frac(p)
    const b = q < 0.15 ? Math.sin((q / 0.15) * PI) : q > 0.25 && q < 0.4 ? Math.sin(((q - 0.25) / 0.15) * PI) * 0.6 : 0
    return { scale: 1 + b * 0.12 }
  }),
  LOOP('titre', 'Titreme', 'char', 0.5, 0, (p, i, n, c) => {
    const k = Math.floor(c.t * 24)
    return { x: (rnd(c.seed, i, k) - 0.5) * c.fontSize * 0.05, y: (rnd(c.seed, i, k + 9) - 0.5) * c.fontSize * 0.05, rotation: (rnd(c.seed, i, k + 3) - 0.5) * 6 }
  }),
  LOOP('parilti', 'Parıltı süpür', 'char', 1.6, 0.05, (p, i, n, c) => {
    const q = frac(p)
    const b = q < 0.25 ? Math.sin((q / 0.25) * PI) : 0
    return b > 0.02 ? { color: mix(c.color, '#ffffff', b * 0.85), scale: 1 + b * 0.06 } : {}
  }),
  LOOP('imlec', 'Yanıp sönen imleç', 'whole', 1.0, 0, p => ({ cursor: frac(p) < 0.5 ? 1 : 0 })),
  LOOP('nabiz', 'Nabız', 'whole', 1.2, 0, p => ({ scale: 1 + 0.05 * (0.5 - 0.5 * Math.cos(p * TAU)) })),
  LOOP('sallan', 'Sallanma', 'whole', 1.6, 0, p => ({ rotation: Math.sin(p * TAU) * 4 })),
  LOOP('zipla', 'Zıpla', 'char', 0.9, 0.07, (p, i, n, c) => ({ y: -Math.abs(Math.sin(p * PI)) * c.fontSize * 0.18 })),
  LOOP('neon-titresim', 'Neon titreşimi', 'whole', 2.0, 0, p => {
    const q = frac(p)
    const o = (q > 0.1 && q < 0.13) ? 0.25 : (q > 0.16 && q < 0.18) ? 0.5 : (q > 0.62 && q < 0.64) ? 0.3 : 1
    return { opacity: o }
  }),
  LOOP('glitch', 'Glitch döngüsü', 'char', 1.5, 0, (p, i, n, c) => {
    if (frac(p) > 0.18) return {}
    const k = Math.floor(c.t * 20)
    const r = rnd(c.seed, i, k)
    return { x: (r - 0.5) * c.fontSize * 0.25, skewX: (rnd(c.seed, i, k + 2) - 0.5) * 20, color: rnd(c.seed, i, k + 5) > 0.7 ? GLITCH[Math.floor(r * 2)] : null }
  }),
  LOOP('salinim', 'Salınım', 'char', 1.4, 0.1, p => ({ rotation: Math.sin(p * TAU) * 10 })),
  LOOP('lastik', 'Lastik', 'whole', 0.9, 0, p => { const s = Math.sin(p * TAU); return { scaleX: 1 + s * 0.06, scaleY: 1 - s * 0.06 } }),
  LOOP('sarkac', 'Sarkaç', 'whole', 2.0, 0, (p, i, n, c) => ({ rotation: Math.sin(p * TAU) * 8, x: Math.sin(p * TAU) * c.fontSize * 0.1 })),
  LOOP('sirayla-buyut', 'Sırayla büyüt', 'char', 1.4, 0.06, (p, i, n, c) => {
    const q = frac(p)
    const b = q < 0.2 ? Math.sin((q / 0.2) * PI) : 0
    return { scale: 1 + b * 0.3, y: -b * c.fontSize * 0.08 }
  }),
  LOOP('renk-dalgasi', 'Renk dalgası', 'char', 2.0, 0.05, (p, i, n, c) => ({ color: mix(c.color, '#FF5DA2', 0.5 - 0.5 * Math.cos(p * TAU)) })),
  LOOP('sarsinti', 'Deprem', 'whole', 0.6, 0, (p, i, n, c) => {
    const k = Math.floor(c.t * 30)
    return { x: (rnd(c.seed, 1, k) - 0.5) * c.fontSize * 0.12, y: (rnd(c.seed, 2, k) - 0.5) * c.fontSize * 0.12, rotation: (rnd(c.seed, 3, k) - 0.5) * 3 }
  }),
  LOOP('yuzen-harfler', 'Yüzen harfler', 'char', 2.2, 0.13, (p, i, n, c) => ({ y: Math.sin(p * TAU) * c.fontSize * 0.07, x: Math.cos(p * TAU) * c.fontSize * 0.02, rotation: Math.sin(p * TAU + 1.3) * 5 })),
  LOOP('bulanik-nefes', 'Bulanık nefes', 'whole', 2.0, 0, (p, i, n, c) => { const b = 0.5 - 0.5 * Math.cos(p * TAU); return { blur: b * c.fontSize * 0.03, opacity: 1 - b * 0.2 } }),
  LOOP('yan-son', 'Yanıp sön', 'whole', 1.0, 0, p => ({ opacity: frac(p) < 0.5 ? 1 : 0.15 })),
  LOOP('egik-sallan', 'Eğik sallan', 'whole', 1.4, 0, p => ({ skewX: Math.sin(p * TAU) * 10 })),
  LOOP('kelime-nabiz', 'Kelime nabzı', 'word', 1.2, 0.15, p => ({ scale: 1 + Math.max(0, Math.sin(p * TAU)) * 0.08 })),
  LOOP('disko', 'Disko', 'word', 1.0, 0, (p, i) => ({ color: DISCO[(Math.floor(frac(p) * 4) + i) % DISCO.length] })),
]

export const TEXT_ANIMS = [...IN_ANIMS, ...OUT_ANIMS, ...LOOP_ANIMS]
export const TEXT_ANIM_CATEGORIES = [
  { id: 'in', name: 'Giriş' },
  { id: 'out', name: 'Çıkış' },
  { id: 'loop', name: 'Döngü' },
]
