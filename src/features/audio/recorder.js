// Seslendirme kaydı: mikrofon → MediaRecorder (opus/webm) + canlı seviye; durunca FLAC'a çevrilir
// (decodeAudioData ve ffmpeg için güvenilir, örnek hassasiyetinde süre).

import { fs, path, run, appPaths, cacheDir } from '../../platform/node.js'

let rec = null // { stream, recorder, chunks, ctx, timer, started, onLevel }

export async function listInputs() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return []
  let devs = await navigator.mediaDevices.enumerateDevices()
  // etiketler izin verilmeden boş gelir → kısa izin al
  if (devs.some(d => d.kind === 'audioinput' && !d.label)) {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); devs = await navigator.mediaDevices.enumerateDevices() } catch (e) { /* izin yok */ }
  }
  return devs.filter(d => d.kind === 'audioinput').map((d, i) => ({
    deviceId: d.deviceId, groupId: d.groupId,
    label: d.label || ('Mikrofon ' + (i + 1)), isDefault: d.deviceId === 'default',
  }))
}

export function isRecording() { return !!rec }
export function recordingTime() { return rec ? (performance.now() - rec.started) / 1000 : 0 }

// onLevel({ rms, peak, db }) ~30 kez/sn
export async function startRecording({ deviceId, noiseSuppression = true, echoCancellation = true, autoGainControl = false, onLevel } = {}) {
  if (rec) throw new Error('kayıt zaten sürüyor')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      noiseSuppression, echoCancellation, autoGainControl,
      channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 },
    },
  })
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined)
  const chunks = []
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
  // canlı seviye
  const ctx = new AudioContext()
  const srcNode = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  srcNode.connect(an)
  const td = new Float32Array(an.fftSize)
  let peakHold = 0
  const timer = setInterval(() => {
    an.getFloatTimeDomainData(td)
    let s = 0, p = 0
    for (let i = 0; i < td.length; i++) { const v = td[i]; s += v * v; const a = v < 0 ? -v : v; if (a > p) p = a }
    const rms = Math.sqrt(s / td.length)
    peakHold = Math.max(p, peakHold * 0.9)
    if (onLevel) onLevel({ rms, peak: peakHold, db: rms > 1e-9 ? 20 * Math.log10(rms) : -120, time: recordingTime() })
  }, 33)
  rec = { stream, recorder, chunks, ctx, timer, started: performance.now(), mime }
  // kodlayıcı gerçekten başlayınca dön (süre sayacı ve kullanıcı konuşmaya başlaması buna göre)
  await new Promise(res => { recorder.onstart = res; recorder.start(250); setTimeout(res, 1500) })
  rec.started = performance.now()
  return { mimeType: mime, settings: stream.getAudioTracks()[0] && stream.getAudioTracks()[0].getSettings() }
}

function cleanup(r) {
  clearInterval(r.timer)
  r.stream.getTracks().forEach(t => t.stop())
  try { r.ctx.close() } catch (e) { /* */ }
}

export async function cancelRecording() {
  const r = rec
  if (!r) return
  rec = null
  try { r.recorder.stop() } catch (e) { /* */ }
  cleanup(r)
}

// Kaydı bitir → FLAC yolu (cacheDir('voiceover')). opts.keepWebm: ham kaydı da sakla
export async function stopRecording({ keepWebm = false } = {}) {
  const r = rec
  if (!r) throw new Error('kayıt yok')
  rec = null
  const done = new Promise(res => { r.recorder.onstop = res })
  try { r.recorder.stop() } catch (e) { /* */ }
  await done
  cleanup(r)
  const blob = new Blob(r.chunks, { type: r.mime || 'audio/webm' })
  const buf = Buffer.from(await blob.arrayBuffer())
  const dir = cacheDir('voiceover')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const webm = path.join(dir, `seslendirme-${stamp}.webm`)
  const flac = path.join(dir, `seslendirme-${stamp}.flac`)
  fs.writeFileSync(webm, buf)
  const res = await run(appPaths().ffmpeg, ['-y', '-v', 'error', '-i', webm, '-vn', '-ar', '48000', '-c:a', 'flac', flac])
  if (res.code !== 0) throw new Error('kayıt dönüştürülemedi: ' + (res.err || '').slice(-200))
  if (!keepWebm) { try { fs.unlinkSync(webm) } catch (e) { /* */ } }
  return flac
}
