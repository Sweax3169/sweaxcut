// Vuruş algılama: spektral akı başlangıç zarfı → otokorelasyonla tempo → dinamik programlamayla vuruş takibi (Ellis 2007)
// detectBeats(dosya | AudioBuffer, { sensitivity 0..1, minBpm, maxBpm }) → { bpm, beats:[sn], onsets:[sn], confidence }

import { monoPcm, fft, hann, movingAverage } from './pcm.js'

const SR = 22050, WIN = 1024, HOP = 256

// Başlangıç gücü zarfı: log aralıklı ~40 bantta (mel benzeri) log enerji akısı, yarım dalga doğrultma.
// Bant başına eşit ağırlık → tizdeki çok sayıda FFT kutusu (hi-hat) bas davulu bastırmaz.
const NB = 40
function bandEdges(sr) {
  const lo = 30, hi = Math.min(11000, sr / 2 - 100)
  const edges = []
  for (let k = 0; k <= NB; k++) edges.push(Math.max(1, Math.round(lo * Math.pow(hi / lo, k / NB) * WIN / sr)))
  for (let k = 1; k <= NB; k++) if (edges[k] <= edges[k - 1]) edges[k] = edges[k - 1] + 1
  return edges
}
export function onsetEnvelope(pcm, sr = SR, { lowBias = 1.6 } = {}) {
  const nF = Math.max(0, Math.floor((pcm.length - WIN) / HOP) + 1)
  const env = new Float32Array(nF)
  const w = hann(WIN), re = new Float32Array(WIN), im = new Float32Array(WIN)
  const edges = bandEdges(sr)
  // bas bantlara hafif öncelik (vuruşu genelde bas davul / trampet taşır)
  const bw = new Float32Array(NB)
  for (let k = 0; k < NB; k++) bw[k] = 1 + (lowBias - 1) * Math.max(0, 1 - k / (NB * 0.35))
  let prev = new Float32Array(NB), cur = new Float32Array(NB)
  for (let f = 0; f < nF; f++) {
    const o = f * HOP
    for (let i = 0; i < WIN; i++) { re[i] = pcm[o + i] * w[i]; im[i] = 0 }
    fft(re, im)
    let s = 0
    for (let k = 0; k < NB; k++) {
      let e = 0
      for (let b = edges[k]; b < edges[k + 1] && b < WIN / 2; b++) e += re[b] * re[b] + im[b] * im[b]
      const m = Math.log1p(1000 * Math.sqrt(e / Math.max(1, edges[k + 1] - edges[k])))
      cur[k] = m
      const d = m - prev[k]
      if (d > 0 && f > 0) s += d * bw[k]
    }
    env[f] = s
    const t = prev; prev = cur; cur = t
  }
  // yerel ortalamayı çıkar, normalize et
  const mean = movingAverage(env, Math.round(0.4 * sr / HOP))
  let mx = 1e-9
  for (let i = 0; i < nF; i++) { env[i] = Math.max(0, env[i] - mean[i]); if (env[i] > mx) mx = env[i] }
  for (let i = 0; i < nF; i++) env[i] /= mx
  return env
}

// Tempo (BPM): otokorelasyon + 120 BPM merkezli log-normal öncül + harmonik pekiştirme
export function estimateTempo(env, sr = SR, { minBpm = 60, maxBpm = 200 } = {}) {
  const fps = sr / HOP
  const lagMin = Math.max(1, Math.floor(60 * fps / maxBpm)), lagMax = Math.ceil(60 * fps / minBpm)
  const n = env.length
  const ac = new Float32Array(lagMax * 2 + 2)
  for (let L = 1; L < ac.length && L < n; L++) {
    let s = 0
    for (let i = 0; i + L < n; i++) s += env[i] * env[i + L]
    ac[L] = s / (n - L)
  }
  let best = -1, bestL = 0
  const score = new Float32Array(lagMax + 1)
  for (let L = lagMin; L <= lagMax; L++) {
    const bpm = 60 * fps / L
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2))
    const s = (ac[L] + 0.5 * (ac[2 * L] || 0) + 0.25 * (ac[Math.round(L / 2)] || 0)) * prior
    score[L] = s
    if (s > best) { best = s; bestL = L }
  }
  if (!bestL) return { bpm: 0, period: 0, confidence: 0 }
  // parabolik incelik
  let L = bestL
  const y0 = score[bestL - 1], y2 = score[bestL + 1]
  if (y0 && y2) { const d = y0 - 2 * best + y2; if (d < 0) L = bestL + 0.5 * (y0 - y2) / d }
  // güven: tepe / ortalama
  let avg = 0, c = 0
  for (let k = lagMin; k <= lagMax; k++) { avg += score[k]; c++ }
  avg /= Math.max(1, c)
  return { bpm: 60 * fps / L, period: L, confidence: Math.min(1, Math.max(0, (best / (avg + 1e-9) - 1) / 3)) }
}

// Dinamik programlama ile vuruş dizisi
export function trackBeats(env, period, tightness = 100) {
  const n = env.length
  if (!period || n < 2) return []
  const score = new Float32Array(n), back = new Int32Array(n).fill(-1)
  const lo = Math.round(period / 2), hi = Math.round(period * 2)
  for (let t = 0; t < n; t++) {
    let best = -Infinity, bi = -1
    for (let p = t - hi; p <= t - lo; p++) {
      if (p < 0) continue
      const d = Math.log((t - p) / period)
      const s = score[p] - tightness * d * d
      if (s > best) { best = s; bi = p }
    }
    score[t] = env[t] + (bi >= 0 ? best : 0)
    back[t] = bi
  }
  // son periyot içindeki en iyi nokta
  let end = n - 1, bs = -Infinity
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > bs) { bs = score[t]; end = t }
  const beats = []
  for (let t = end; t >= 0; t = back[t]) { beats.push(t); if (back[t] < 0) break }
  beats.reverse()
  // başlangıçtaki zayıf vuruşları at (zarf eşik altı)
  return beats
}

// DP vuruşlarını yakındaki güçlü başlangıç tepesine oturt; baştaki/sondaki sessiz bölgedeki vuruşları at
export function refineBeats(env, frames, period) {
  const w = Math.max(2, Math.round(period * 0.22))
  const out = frames.map(b => {
    let best = b, bs = -1
    for (let m = Math.max(0, b - w); m <= Math.min(env.length - 1, b + w); m++) {
      const d = (m - b) / w
      const sc = env[m] * (1 - 0.5 * d * d)
      if (sc > bs && env[m] >= env[m - 1 || 0] && env[m] >= (env[m + 1] || 0)) { bs = sc; best = m }
    }
    return bs > 0.12 ? best : b
  })
  const strong = b => { let m = 0; for (let i = Math.max(0, b - 2); i <= Math.min(env.length - 1, b + 2); i++) m = Math.max(m, env[i]); return m > 0.08 }
  let a = 0, z = out.length - 1
  while (a <= z && !strong(out[a])) a++
  while (z >= a && !strong(out[z])) z--
  const res = []
  for (let i = a; i <= z; i++) if (!res.length || out[i] - res[res.length - 1] > period * 0.4) res.push(out[i])
  return res
}

// Tepe seçimiyle başlangıçlar (kesim noktaları için)
export function pickOnsets(env, sr = SR, { k = 1.4, minGap = 0.1, floor = 0.08 } = {}) {
  const out = [], W = 8, gap = Math.round(minGap * sr / HOP)
  let last = -1e9
  const mean = movingAverage(env, W)
  for (let f = 1; f < env.length - 1; f++) {
    const v = env[f]
    if (v < floor || v < mean[f] * k) continue
    if (v < env[f - 1] || v < env[f + 1]) continue
    if (f - last < gap) continue
    out.push(f * HOP / sr); last = f
  }
  return out
}

export async function detectBeats(src, { sensitivity = 0.5, minBpm = 60, maxBpm = 200 } = {}) {
  const { pcm, sampleRate } = await monoPcm(src, SR)
  const env = onsetEnvelope(pcm, sampleRate)
  if (env.length < 16) return { bpm: 0, beats: [], onsets: [], confidence: 0 }
  const tempo = estimateTempo(env, sampleRate, { minBpm, maxBpm })
  const s = Math.max(0, Math.min(1, sensitivity))
  const tight = 30 + (1 - s) * 370      // yüksek hassasiyet → başlangıçları daha yakından izle
  let frames = trackBeats(env, tempo.period, tight)
  frames = refineBeats(env, frames, tempo.period)
  // kare zamanı: akı tepesi atak anından ~WIN/4 önce oluşuyor (sentetik vuruşlarla ölçüldü)
  const frameT = f => (f * HOP + WIN * 0.75) / sampleRate
  const beats = frames.map(f => Math.round(frameT(f) * 1000) / 1000)
  // tempo: düzenli bölgede ilk–son vuruş aralığından (kare nicemlemesinden bağımsız)
  let bpm = tempo.bpm
  if (beats.length >= 8) {
    const iv = []
    for (let i = 1; i < beats.length; i++) iv.push(beats[i] - beats[i - 1])
    const med = iv.slice().sort((x, y) => x - y)[iv.length >> 1]
    // aykırı aralıkları atlayan en uzun düzenli dizi
    let bestA = 0, bestB = 0, a0 = 0
    for (let i = 0; i <= iv.length; i++) {
      if (i === iv.length || Math.abs(iv[i] - med) > med * 0.12) { if (i - a0 > bestB - bestA) { bestA = a0; bestB = i } a0 = i + 1 }
    }
    if (bestB - bestA >= 4) bpm = 60 * (bestB - bestA) / (beats[bestB] - beats[bestA])
  }
  const onsets = pickOnsets(env, sampleRate, { k: 1.2 + (1 - s) * 0.8, floor: 0.04 + (1 - s) * 0.12 }).map(t => Math.round((t + WIN * 0.75 / sampleRate) * 1000) / 1000)
  return { bpm: Math.round(bpm * 10) / 10, beats, onsets, confidence: Math.round(tempo.confidence * 100) / 100 }
}
