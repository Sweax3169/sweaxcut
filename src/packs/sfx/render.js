// Prosedürel sesleri (sfx + müzik) çizdirme: OfflineAudioContext → AudioBuffer → 16-bit WAV → önbellek dosyası
import { fs, path, ensureDir, cacheDir } from '../../platform/node.js'

// def: { duration, synth(ctx, t0), sampleRate?, channels?, seamless?, tail?, level? (dBFS tepe, varsayılan -1), normalize? }
// seamless: kuyruk (yankı) payıyla çizilir, kuyruk başa katlanır → döngü dikişsiz olur
export async function renderSynth(def, sampleRate = 48000) {
  const sr = def.sampleRate || sampleRate
  const ch = def.channels || 2
  const tail = def.seamless ? (def.tail ?? 3) : 0
  const n = Math.max(1, Math.ceil(def.duration * sr))
  const len = n + Math.ceil(tail * sr)
  const ctx = new OfflineAudioContext(ch, len, sr)
  await def.synth(ctx, 0)
  const raw = await ctx.startRendering()
  const out = new AudioBuffer({ length: n, numberOfChannels: ch, sampleRate: sr })
  const fadeOut = def.seamless ? 0 : Math.min(n, Math.floor(0.006 * sr))
  let peak = 0
  for (let c = 0; c < ch; c++) {
    const src = raw.getChannelData(Math.min(c, raw.numberOfChannels - 1))
    const dst = out.getChannelData(c)
    dst.set(src.subarray(0, n))
    if (tail) for (let i = 0; i < len - n; i++) dst[i % n] += src[n + i]
    for (let i = 0; i < fadeOut; i++) dst[n - 1 - i] *= i / fadeOut
    for (let i = 0; i < n; i++) { const v = dst[i]; if (v !== v) dst[i] = 0; else if (Math.abs(v) > peak) peak = Math.abs(v) }
  }
  if (def.normalize !== false && peak > 1e-6) {
    const target = Math.pow(10, (def.level ?? -1) / 20)
    const k = target / peak
    for (let c = 0; c < ch; c++) { const d = out.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= k }
  }
  return out
}

// 16-bit PCM WAV (iç içe kanallar, küçük-endian)
export function audioBufferToWav(buffer) {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length
  const dataSize = n * ch * 2
  const ab = new ArrayBuffer(44 + dataSize)
  const v = new DataView(ab)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, dataSize, true)
  const chans = []
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c))
  let o = 44
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let s = chans[c][i]
      s = s > 1 ? 1 : s < -1 ? -1 : s
      v.setInt16(o, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true)
      o += 2
    }
  }
  return new Uint8Array(ab)
}

// WAV dosyası yaz (varsa atla). Node yoksa null döner.
export async function renderToFile(def, outPath) {
  if (!fs || !path) return null
  try { if (fs.existsSync(outPath) && fs.statSync(outPath).size > 44) return outPath } catch (e) { /* yok */ }
  const buf = await renderSynth(def)
  ensureDir(path.dirname(outPath))
  const tmp = outPath + '.part'
  fs.writeFileSync(tmp, Buffer.from(audioBufferToWav(buf)))
  fs.renameSync(tmp, outPath)
  return outPath
}

// Uygulama önbelleğinde kalıcı yol: <userData>/cache/<tür>/<id>-v<sürüm>.wav
export function synthCachePath(def, kind = 'sfx') {
  if (!path) return null
  return path.join(cacheDir(kind), `${def.id}-v${def.version || 1}.wav`)
}
export function renderCached(def, kind = 'sfx') {
  const p = synthCachePath(def, kind)
  return p ? renderToFile(def, p) : Promise.resolve(null)
}
