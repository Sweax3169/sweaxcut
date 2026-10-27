// Ortak: dosyadan / AudioBuffer'dan mono PCM (Float32) + küçük DSP yardımcıları

import { run, appPaths } from '../../platform/node.js'

// kaynak: dosya yolu | AudioBuffer | { pcm: Float32Array, sampleRate }
export async function monoPcm(src, sampleRate = 22050, { start = 0, duration = 0 } = {}) {
  if (!src) throw new Error('ses kaynağı yok')
  if (typeof src === 'string') {
    const args = ['-v', 'error']
    if (start > 0) args.push('-ss', String(start))
    if (duration > 0) args.push('-t', String(duration))
    args.push('-i', src, '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-')
    const r = await run(appPaths().ffmpeg, args)
    if (r.code !== 0 || !r.buf) throw new Error('ses çözülemedi: ' + (r.err || '').slice(-200))
    const n = Math.floor(r.buf.length / 4)
    return { pcm: new Float32Array(r.buf.buffer.slice(r.buf.byteOffset, r.buf.byteOffset + n * 4)), sampleRate }
  }
  if (src.pcm) return { pcm: src.pcm, sampleRate: src.sampleRate || sampleRate }
  if (typeof src.getChannelData === 'function') {
    const n = src.length, nc = src.numberOfChannels
    const pcm = new Float32Array(n)
    for (let c = 0; c < nc; c++) { const d = src.getChannelData(c); for (let i = 0; i < n; i++) pcm[i] += d[i] / nc }
    return { pcm, sampleRate: src.sampleRate }
  }
  throw new Error('desteklenmeyen ses kaynağı')
}

// Yerinde radix-2 FFT (re, im uzunluğu 2^k)
export function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr; im[b] = im[a] - xi
        re[a] += xr; im[a] += xi
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}

export function hann(n) {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)
  return w
}

export function movingAverage(x, half) {
  const n = x.length, out = new Float32Array(n)
  let s = 0, c = 0, lo = 0, hi = -1
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half), b = Math.min(n - 1, i + half)
    while (hi < b) { hi++; s += x[hi]; c++ }
    while (lo < a) { s -= x[lo]; lo++; c-- }
    out[i] = s / c
  }
  return out
}
