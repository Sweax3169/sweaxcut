// Yumuşatma eğrileri — anahtar kareler, animasyonlar ve geçişler ortak kullanır.
// Her biri [0,1] → yaklaşık [0,1] (back/elastic taşabilir).

const PI = Math.PI
const c1 = 1.70158
const c2 = c1 * 1.525
const c3 = c1 + 1
const c4 = (2 * PI) / 3
const c5 = (2 * PI) / 4.5

function bounceOut(x) {
  const n1 = 7.5625, d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}

export const EASINGS = {
  linear: x => x,
  hold: x => (x < 1 ? 0 : 1),
  easeIn: x => x * x,
  easeOut: x => 1 - (1 - x) * (1 - x),
  easeInOut: x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  sineIn: x => 1 - Math.cos((x * PI) / 2),
  sineOut: x => Math.sin((x * PI) / 2),
  sineInOut: x => -(Math.cos(PI * x) - 1) / 2,
  cubicIn: x => x * x * x,
  cubicOut: x => 1 - Math.pow(1 - x, 3),
  cubicInOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  quartIn: x => x * x * x * x,
  quartOut: x => 1 - Math.pow(1 - x, 4),
  quartInOut: x => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  quintIn: x => x ** 5,
  quintOut: x => 1 - Math.pow(1 - x, 5),
  quintInOut: x => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  expoIn: x => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  expoOut: x => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  expoInOut: x => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  circIn: x => 1 - Math.sqrt(1 - x * x),
  circOut: x => Math.sqrt(1 - Math.pow(x - 1, 2)),
  circInOut: x => (x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2),
  backIn: x => c3 * x * x * x - c1 * x * x,
  backOut: x => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
  backInOut: x => (x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2),
  elasticIn: x => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)),
  elasticOut: x => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1),
  elasticInOut: x => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1),
  bounceIn: x => 1 - bounceOut(1 - x),
  bounceOut,
  bounceInOut: x => (x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2),
  // Sosyal medya favorileri
  snap: x => 1 - Math.pow(1 - x, 6),
  overshoot: x => { const s = 2.2; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2) },
  smoothstep: x => x * x * (3 - 2 * x),
  smootherstep: x => x * x * x * (x * (x * 6 - 15) + 10),
  steps4: x => Math.min(1, Math.floor(x * 4) / 3),
  steps8: x => Math.min(1, Math.floor(x * 8) / 7),
}

export const EASING_LABELS = {
  linear: 'Doğrusal', hold: 'Tut (sıçra)', easeIn: 'Yavaş başla', easeOut: 'Yavaş bitir', easeInOut: 'Yavaş başla-bitir',
  sineIn: 'Sinüs giriş', sineOut: 'Sinüs çıkış', sineInOut: 'Sinüs giriş-çıkış', cubicIn: 'Kübik giriş', cubicOut: 'Kübik çıkış',
  cubicInOut: 'Kübik giriş-çıkış', quartIn: 'Güçlü giriş', quartOut: 'Güçlü çıkış', quartInOut: 'Güçlü giriş-çıkış',
  quintIn: 'Sert giriş', quintOut: 'Sert çıkış', quintInOut: 'Sert giriş-çıkış', expoIn: 'Üstel giriş', expoOut: 'Üstel çıkış',
  expoInOut: 'Üstel giriş-çıkış', circIn: 'Dairesel giriş', circOut: 'Dairesel çıkış', circInOut: 'Dairesel giriş-çıkış',
  backIn: 'Geri çekil', backOut: 'Taşıp dön', backInOut: 'Geri-taş', elasticIn: 'Yay giriş', elasticOut: 'Yay çıkış',
  elasticInOut: 'Yay giriş-çıkış', bounceIn: 'Zıpla giriş', bounceOut: 'Zıpla çıkış', bounceInOut: 'Zıpla giriş-çıkış',
  snap: 'Şak', overshoot: 'Fırla', smoothstep: 'Pürüzsüz', smootherstep: 'Daha pürüzsüz', steps4: '4 adım', steps8: '8 adım',
}

export function ease(name, x) {
  const f = EASINGS[name] || EASINGS.linear
  return f(x < 0 ? 0 : x > 1 ? 1 : x)
}

// CSS benzeri kübik bezier (anahtar kare eğri düzenleyicisi için)
export function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by
  const sx = t => ((ax * t + bx) * t + cx) * t
  const sy = t => ((ay * t + by) * t + cy) * t
  const dsx = t => (3 * ax * t + 2 * bx) * t + cx
  return x => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      if (Math.abs(e) < 1e-5) break
      const d = dsx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
