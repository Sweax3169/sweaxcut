// Panel değişse de süren işler: seslendirme kaydı ve otomatik altyazı.
// Durum modül düzeyinde tutulur; paneller yalnız gözlemler.

import { store } from '../../core/store.js'
import { playback } from '../../engine/playback.js'
import { importFiles, ffmpegBin } from '../../core/media.js'
import { fs, path, cacheDir, run } from '../../platform/node.js'
import { feature } from './features.js'
import { placeAudioOnNewTrack } from './insert.js'

export function observable(init) {
  let v = init
  const subs = new Set()
  return {
    get: () => v,
    set: (patch) => { v = typeof patch === 'function' ? patch(v) : { ...v, ...patch }; for (const f of subs) f(v) },
    sub: (f) => { subs.add(f); return () => subs.delete(f) },
  }
}

// ---------------------------------------------------------------- seslendirme kaydı
export const recorderState = observable({ recording: false, starting: false, startedAt: 0, timelineStart: 0, error: null, countdown: 0 })
export const levelObs = observable({ level: 0, peak: 0 })

let fb = null // yerel yedek kaydedici

export async function listInputs() {
  const m = await feature('recorder')
  if (m && m.listInputs) { try { return await m.listInputs() } catch (e) { /* yedeğe düş */ } }
  if (!navigator.mediaDevices) return []
  try {
    let devs = await navigator.mediaDevices.enumerateDevices()
    if (devs.some(d => d.kind === 'audioinput' && !d.label)) {
      // etiketler için bir kez izin iste
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); devs = await navigator.mediaDevices.enumerateDevices() } catch (e) { /* */ }
    }
    return devs.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Mikrofon' }))
  } catch (e) { return [] }
}

function onLevel(v) {
  let lin = typeof v === 'number' ? v : (v && (v.peak ?? v.level ?? v.rms)) || 0
  if (lin < 0) lin = Math.pow(10, lin / 20) // dB geldiyse
  lin = Math.max(0, Math.min(1, lin))
  const cur = levelObs.get()
  levelObs.set({ level: lin, peak: Math.max(lin, cur.peak * 0.96) })
}

async function fbStart({ deviceId, noiseSuppression, echoCancellation }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, noiseSuppression, echoCancellation, autoGainControl: false, channelCount: 1 },
  })
  const ac = new AudioContext()
  const an = ac.createAnalyser()
  an.fftSize = 1024
  ac.createMediaStreamSource(stream).connect(an)
  const buf = new Float32Array(an.fftSize)
  const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 })
  const chunks = []
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
  rec.start(250)
  fb = { stream, ac, an, rec, chunks, raf: 0 }
  const loop = () => {
    an.getFloatTimeDomainData(buf)
    let pk = 0
    for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a }
    onLevel(pk)
    fb.raf = requestAnimationFrame(loop)
  }
  loop()
}

async function fbStop() {
  const f = fb
  fb = null
  if (!f) return null
  cancelAnimationFrame(f.raf)
  await new Promise(r => { f.rec.onstop = r; f.rec.stop() })
  f.stream.getTracks().forEach(t => t.stop())
  try { f.ac.close() } catch (e) { /* */ }
  if (!fs) return null
  const blob = new Blob(f.chunks, { type: 'audio/webm' })
  const dir = cacheDir('recordings')
  const base = path.join(dir, 'seslendirme-' + new Date().toISOString().replace(/[:.]/g, '-'))
  fs.writeFileSync(base + '.webm', Buffer.from(await blob.arrayBuffer()))
  // MediaRecorder webm'inde süre bilgisi yok → WAV'a çevir (ffprobe süreyi doğru okusun)
  const r = await run(ffmpegBin(), ['-y', '-v', 'error', '-i', base + '.webm', '-ac', '1', '-ar', '48000', base + '.wav'])
  return r.code === 0 ? base + '.wav' : base + '.webm'
}

let usingModule = false
export async function startRecording(opts) {
  const st = recorderState.get()
  if (st.recording || st.starting) return
  recorderState.set({ starting: true, error: null })
  try {
    if (opts.countdown) {
      for (let i = 3; i > 0; i--) { recorderState.set({ countdown: i }); await new Promise(r => setTimeout(r, 700)) }
      recorderState.set({ countdown: 0 })
    }
    const m = await feature('recorder')
    usingModule = !!(m && m.startRecording)
    const o = { deviceId: opts.deviceId || undefined, noiseSuppression: !!opts.noiseSuppression, echoCancellation: !!opts.echoCancellation, onLevel }
    if (usingModule) await m.startRecording(o)
    else await fbStart(o)
    const t = playback.time
    recorderState.set({ recording: true, starting: false, startedAt: performance.now(), timelineStart: t })
    if (opts.playAlong) playback.play()
  } catch (e) {
    recorderState.set({ recording: false, starting: false, countdown: 0, error: 'Mikrofon açılamadı: ' + (e.message || e) })
  }
}

export async function stopRecording() {
  const st = recorderState.get()
  if (!st.recording) return null
  playback.pause()
  recorderState.set({ recording: false })
  levelObs.set({ level: 0, peak: 0 })
  store.busy('Kayıt kaydediliyor…', null)
  try {
    let p = null
    if (usingModule) { const m = await feature('recorder'); const r = await m.stopRecording(); p = typeof r === 'string' ? r : r && r.path }
    else p = await fbStop()
    if (!p) throw new Error('kayıt dosyası oluşmadı')
    const ids = await importFiles([p], { role: 'voice', generated: true, name: 'Ses kaydı · ' + new Date().toLocaleTimeString('tr-TR') })
    if (!ids[0]) throw new Error('içe aktarılamadı')
    const n = (store.get().project.media[ids[0]] || {}).name
    store.edit('medya', d => { if (d.media[ids[0]]) { d.media[ids[0]].name = 'Seslendirme ' + new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); d.media[ids[0]].generated = true } }, { noHistory: true })
    placeAudioOnNewTrack(ids[0], st.timelineStart, 'voice', 'Seslendirme ekle')
    store.toast('Seslendirme zaman çizelgesine eklendi', 'ok', 1800)
    void n
    return ids[0]
  } catch (e) {
    store.toast('Kayıt eklenemedi: ' + (e.message || e), 'error', 4000)
    return null
  } finally { store.busy(null) }
}

// ---------------------------------------------------------------- otomatik altyazı işi
export const captionJob = observable({ running: false, progress: 0, label: '', error: null, ctrl: null, done: null })

export function cancelCaptions() {
  const j = captionJob.get()
  if (j.ctrl) j.ctrl.abort()
  captionJob.set({ running: false, label: 'İptal edildi', ctrl: null })
}
