// Öne çıkan anlar (otomatik highlight / otomatik zoom): kısa süreli yükseklik tepeleri — oyunda vuruş,
// patlama, bağırış. Kısa pencere enerjisi uzun süreli tabanın ne kadar ÜSTÜNDE + ani başlangıç (akı) bonusu.
// detectHighlights(dosya | AudioBuffer, { count, minGap }) → [{ time, score 0..1, start, end, db }] (zamana göre sıralı)

import { monoPcm, movingAverage } from './pcm.js'

const SR = 16000

export async function detectHighlights(src, { count = 8, minGap = 6, window = 0.4, baseline = 12, minScore = 0.15 } = {}) {
  const { pcm, sampleRate } = await monoPcm(src, SR)
  const hop = Math.round(sampleRate * 0.05) // 50 ms
  const n = Math.floor(pcm.length / hop)
  if (n < 4) return []
  // K-ağırlığa yakın ön filtre: 1. dereceden yüksek geçiren (~100 Hz) + hafif tiz vurgusu
  const a = Math.exp(-2 * Math.PI * 100 / sampleRate)
  let px = 0, py = 0
  const e = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < hop; j++) {
      const x = pcm[i * hop + j]
      const y = a * (py + x - px); px = x; py = y
      s += y * y
    }
    e[i] = s / hop
  }
  // kısa süreli yükseklik (dB) ve uzun süreli taban
  const shortW = Math.max(1, Math.round(window / 0.05 / 2))
  const st = movingAverage(e, shortW)
  const lt = movingAverage(e, Math.round(baseline / 0.05 / 2))
  const db = new Float32Array(n), rise = new Float32Array(n), flux = new Float32Array(n)
  let gmax = -200
  for (let i = 0; i < n; i++) {
    db[i] = 10 * Math.log10(st[i] + 1e-10)
    rise[i] = db[i] - 10 * Math.log10(lt[i] + 1e-10)
    if (db[i] > gmax) gmax = db[i]
    flux[i] = i ? Math.max(0, 10 * Math.log10((e[i] + 1e-10) / (e[i - 1] + 1e-10))) : 0
  }
  const fluxS = movingAverage(flux, 2)
  // skor: tabandan yükseliş (0..18 dB) + mutlak yükseklik + ani başlangıç
  const score = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = Math.max(0, Math.min(1, rise[i] / 18))
    const abs = Math.max(0, Math.min(1, (db[i] - (gmax - 30)) / 30))
    const f = Math.max(0, Math.min(1, fluxS[i] / 12))
    score[i] = 0.55 * r + 0.3 * abs + 0.15 * f
  }
  // yerel tepeler + en az aralık (en güçlüden başlayarak)
  const peaks = []
  for (let i = 1; i < n - 1; i++) if (score[i] >= score[i - 1] && score[i] > score[i + 1] && score[i] >= minScore) peaks.push(i)
  peaks.sort((x, y) => score[y] - score[x])
  const gap = minGap / 0.05
  const chosen = []
  for (const p of peaks) {
    if (chosen.length >= count) break
    if (chosen.some(c => Math.abs(c - p) < gap)) continue
    chosen.push(p)
  }
  return chosen.sort((x, y) => x - y).map(i => {
    // olay sınırları: skor tepe değerinin yarısının üstünde kalan bölge
    const half = score[i] * 0.5
    let s = i, t = i
    while (s > 0 && score[s - 1] > half && i - s < 60) s--
    while (t < n - 1 && score[t + 1] > half && t - i < 60) t++
    return { time: r3((i + 0.5) * 0.05), score: r3(score[i]), start: r3(s * 0.05), end: r3((t + 1) * 0.05), db: Math.round(db[i] * 10) / 10 }
  })
}

const r3 = x => Math.round(x * 1000) / 1000
