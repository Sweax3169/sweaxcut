// Akıllı araçlar: sessizlik kesme, vuruş bulma, öne çıkan anlar, sahne algılama, sabitleme, Shorts bölme, ses eşitleme.
// Özellik modülleri (features/audio/*) varsa onlar kullanılır; yoksa ffmpeg / tepe değerleriyle yerel yedek çalışır.

import { store, primarySelection, selectedClips } from '../../core/store.js'
import * as TL from '../../core/timeline.js'
import { uid } from '../../core/model.js'
import { upsertKey } from '../../core/keyframes.js'
import { sourceTime } from '../../core/time.js'
import { ffmpegBin, loadPeaks, hasNvenc } from '../../core/media.js'
import { playback } from '../../engine/playback.js'
import { fs, path, run, cacheDir } from '../../platform/node.js'
import { feature } from './features.js'

const ui = () => store.get().ui
const P = () => store.get().project

// ---------------------------------------------------------------- hedef klip seçimi
// types: kabul edilen klip türleri. Önce seçim, sonra oynatma kafasındaki ana iz klibi, sonra ilk uygun klip.
export function targetClip(types = ['video', 'audio']) {
  const s = store.get()
  const pr = primarySelection(s)
  if (pr && types.includes(pr.clip.type)) return pr.clip
  const at = TL.clipsAt(s.project, playback.time).map(x => x.clip).filter(c => types.includes(c.type))
  const main = TL.mainTrack(s.project)
  const onMain = at.find(c => main && main.clips.some(x => x.id === c.id))
  if (onMain) return onMain
  if (at[0]) return at[0]
  for (const t of s.project.tracks) for (const c of t.clips) if (types.includes(c.type)) return c
  return null
}

export function clipMedia(c) { return c && P().media[c.mediaId] }
function audioInput(m) { return m.audioPath || m.path }
function srcRange(c) { const a = c.in ?? 0, b = c.out ?? c.duration; return [Math.min(a, b), Math.max(a, b)] }

// Kaynak zamanı → zaman çizelgesi (sabit hız; ters klipte ters)
export function srcToTimeline(c, src) {
  const [lo, hi] = srcRange(c)
  const span = Math.max(1e-6, hi - lo)
  let k = (src - lo) / span
  if (c.reverse) k = 1 - k
  if (c.speedCurve) {
    // eğrili hızda sayısal ters çevirme
    let a = 0, b = c.duration
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; const s = sourceTime(c, m); if (c.reverse ? s > src : s < src) a = m; else b = m }
    return c.start + (a + b) / 2
  }
  return c.start + k * c.duration
}

function linkedIds(c) {
  const ids = [c.id]
  if (c.audio && c.audio.detached && TL.getClip(P(), c.audio.detached)) ids.push(c.audio.detached)
  return ids
}

// ---------------------------------------------------------------- 1) sessizlikleri kes
async function ffSilences(input, [lo, hi], threshold, minDur, onProgress) {
  const dur = hi - lo
  const out = []
  let open = null
  const r = await run(ffmpegBin(), ['-hide_banner', '-nostats', '-ss', String(lo), '-t', String(dur), '-i', input, '-vn', '-af', `silencedetect=noise=${threshold}dB:d=${minDur}`, '-f', 'null', '-'], {
    onStderr: s => {
      for (const m of s.matchAll(/silence_start: (-?[\d.]+)/g)) open = Math.max(0, +m[1])
      for (const m of s.matchAll(/silence_end: ([\d.]+)/g)) { if (open != null) out.push({ start: lo + open, end: lo + +m[1] }); open = null; onProgress && onProgress(Math.min(1, +m[1] / dur)) }
    },
  })
  if (open != null) out.push({ start: lo + open, end: hi })
  if (r.code !== 0 && !out.length) throw new Error('ffmpeg sessizlik analizi başarısız')
  return out
}

// Döner: { clipId, cuts: [{t0,t1}] (zaman çizelgesi), total }
export async function analyzeSilences(c, { threshold = -38, minDur = 0.5, pad = 0.12 } = {}, onProgress) {
  const m = clipMedia(c)
  if (!m || (!m.hasAudio && m.type !== 'audio')) throw new Error('Bu klipte ses yok')
  const range = srcRange(c)
  const S = await feature('silence')
  let cuts
  if (S && S.detectSilences && S.planSilenceCuts) {
    // ekip modülü: dosyanın tamamında sessizlik (kaynak zamanı) → bu klip için zaman çizelgesi aralıkları
    const sil = await S.detectSilences(audioInput(m), { thresholdDb: threshold, minDuration: minDur, padding: pad })
    cuts = (S.planSilenceCuts(c, m, sil, { minCut: 0.1 }) || []).map(x => ({ t0: x.start, t1: x.end }))
  } else {
    const sil = await ffSilences(audioInput(m), range, threshold, minDur, onProgress)
    const plan = sil.map(s => ({ start: Math.max(range[0], s.start + pad), end: Math.min(range[1], s.end - pad) })).filter(s => s.end - s.start >= 0.12)
    cuts = plan.map(s => {
      const a = srcToTimeline(c, s.start), b = srcToTimeline(c, s.end)
      return { t0: Math.max(c.start, Math.min(a, b)), t1: Math.min(c.start + c.duration, Math.max(a, b)) }
    })
  }
  cuts = cuts.filter(x => x.t1 - x.t0 >= 0.1).sort((a, b) => a.t0 - b.t0)
  return { clipId: c.id, cuts, total: cuts.reduce((s, x) => s + x.t1 - x.t0, 0) }
}

// Aralıkları sondan başa kes (önceki zamanlar geçerli kalsın)
export function applyCuts(clipId, cuts, label = 'Sessizlikleri kes') {
  const c0 = TL.getClip(P(), clipId)
  if (!c0 || !cuts.length) return 0
  const ids = linkedIds(c0)
  let n = 0
  store.edit(label, d => {
    const desc = cuts.slice().sort((a, b) => b.t0 - a.t0)
    for (const { t0, t1 } of desc) {
      const c = TL.getClip(d, clipId)
      if (!c) break
      const live = ids.filter(id => TL.getClip(d, id))
      TL.splitAt(d, t1, live, ui())
      const mid = TL.splitAt(d, t0, live, ui())
      if (mid.length) { TL.deleteClips(d, mid, ui(), { ripple: true }); n++ }
      else if (t0 <= c.start + 0.03) { TL.deleteClips(d, live, ui(), { ripple: true }); n++; break }
    }
  })
  return n
}

// ---------------------------------------------------------------- 2) vuruşlar
function peaksBeats(m, [lo, hi]) {
  const pk = loadPeaks(m)
  if (!pk) return []
  const rate = 100
  const a = Math.floor(lo * rate), b = Math.min(pk.length, Math.ceil(hi * rate))
  const flux = []
  for (let i = a + 1; i < b; i++) flux.push(Math.max(0, pk[i] - pk[i - 1]))
  const out = []
  const win = 40
  let last = -1e9
  for (let i = 0; i < flux.length; i++) {
    let s = 0, n = 0
    for (let j = Math.max(0, i - win); j < Math.min(flux.length, i + win); j++) { s += flux[j]; n++ }
    const mean = s / Math.max(1, n)
    if (flux[i] > mean * 2.2 + 3 && flux[i] >= (flux[i - 1] || 0) && flux[i] >= (flux[i + 1] || 0) && i - last > 22) { out.push(lo + (i + 1) / rate); last = i }
  }
  return out
}

export async function findBeats(c, onProgress) {
  const m = clipMedia(c)
  if (!m) throw new Error('Ses klibi yok')
  const range = srcRange(c)
  const B = await feature('beats')
  let beats = null, bpm = null
  if (B && B.detectBeats) {
    const r = await B.detectBeats(audioInput(m), { sensitivity: 0.5 })
    beats = Array.isArray(r) ? r : (r && r.beats) || []
    bpm = r && r.bpm
    beats = beats.map(b => typeof b === 'number' ? b : (b.time ?? b.t)).filter(t => Number.isFinite(t) && t >= range[0] - 1e-3 && t <= range[1] + 1e-3)
  } else beats = peaksBeats(m, range)
  store.edit('Vuruşları bul', d => { const x = TL.getClip(d, c.id); if (x) x.beats = beats })
  return { count: beats.length, bpm }
}

// ---------------------------------------------------------------- 3) öne çıkan anlar
function peaksHighlights(m, [lo, hi], count) {
  const pk = loadPeaks(m)
  if (!pk) return []
  const rate = 100, win = 100
  const scores = []
  for (let s = Math.floor(lo * rate); s + win <= Math.min(pk.length, hi * rate); s += 25) {
    let e = 0
    for (let j = s; j < s + win; j++) e += pk[j] * pk[j]
    scores.push({ time: (s + win / 2) / rate, score: Math.sqrt(e / win) })
  }
  scores.sort((a, b) => b.score - a.score)
  const pick = []
  for (const x of scores) { if (pick.every(p => Math.abs(p.time - x.time) > 4)) pick.push(x); if (pick.length >= count) break }
  return pick.sort((a, b) => a.time - b.time)
}

export async function findHighlights(clips, { count = 6, zoom = true, strength = 0.18 } = {}, onProgress) {
  const H = await feature('highlights')
  const found = []
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]
    const m = clipMedia(c)
    if (!m) continue
    const range = srcRange(c)
    let hs
    if (H && H.detectHighlights) {
      const r = await H.detectHighlights(audioInput(m), { count: count * 3, minGap: 4 })
      onProgress && onProgress((i + 1) / clips.length)
      hs = Array.isArray(r) ? r : (r && (r.highlights || r.moments)) || []
    } else hs = peaksHighlights(m, range, count)
    for (const h of hs) {
      const st = h.time ?? h.peak ?? (h.start != null && h.end != null ? (h.start + h.end) / 2 : h.start)
      if (!Number.isFinite(st) || st < range[0] || st > range[1]) continue
      found.push({ clipId: c.id, t: srcToTimeline(c, st), score: h.score ?? 1, label: h.label })
    }
  }
  found.sort((a, b) => b.score - a.score)
  const top = found.slice(0, count * Math.max(1, clips.length)).sort((a, b) => a.t - b.t)
  if (!top.length) return 0
  store.edit('Öne çıkanları bul', d => {
    for (const h of top) {
      d.markers.push({ id: uid('k'), time: h.t, color: '#e4ff3a', label: h.label || 'Öne çıkan' })
      if (!zoom) continue
      const c = TL.getClip(d, h.clipId)
      if (!c || !c.transform) continue
      const lt = h.t - c.start
      const base = c.transform.scale || 1
      const a = Math.max(0, lt - 0.12), b = Math.min(c.duration, lt + 0.08), e = Math.min(c.duration, lt + 0.85)
      if (b - a < 0.05) continue
      const keys = c.keyframes['transform.scale']
      if (!keys || !keys.length) upsertKey(c, 'transform.scale', 0, base, 'linear')
      upsertKey(c, 'transform.scale', a, base, 'linear')
      upsertKey(c, 'transform.scale', b, base * (1 + strength), 'snap')
      upsertKey(c, 'transform.scale', e, base, 'easeInOut')
    }
  })
  return top.length
}

// ---------------------------------------------------------------- 4) sahne algıla
export async function detectScenes(c, threshold = 0.35, onProgress) {
  const m = clipMedia(c)
  if (!m || m.type !== 'video') throw new Error('Video klip seç')
  const [lo, hi] = srcRange(c)
  const times = []
  const r = await run(ffmpegBin(), ['-hide_banner', '-ss', String(lo), '-t', String(hi - lo), '-i', m.proxyPath || m.path, '-an', '-vf', `scale=320:-2,select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-'], {
    onStderr: s => {
      for (const x of s.matchAll(/pts_time:([\d.]+)/g)) times.push(lo + +x[1])
      const t = /time=(\d+):(\d+):([\d.]+)/.exec(s)
      if (t && onProgress) onProgress(Math.min(1, (+t[1] * 3600 + +t[2] * 60 + +t[3]) / (hi - lo)))
    },
  })
  if (r.code !== 0 && !times.length) throw new Error('ffmpeg sahne analizi başarısız')
  const tl = times.map(s => srcToTimeline(c, s)).filter(t => t > c.start + 0.25 && t < c.start + c.duration - 0.25).sort((a, b) => b - a)
  const pts = []
  for (const t of tl) if (!pts.length || pts[pts.length - 1] - t > 0.4) pts.push(t)
  if (!pts.length) return 0
  const ids = linkedIds(c)
  store.edit('Sahne algıla', d => { for (const t of pts) TL.splitAt(d, t, ids.filter(id => TL.getClip(d, id)), ui()) })
  return pts.length
}

// ---------------------------------------------------------------- 5) sabitleme (vidstab iki geçiş)
export async function stabilize(c, level = 2, onProgress) {
  const m = clipMedia(c)
  if (!m || m.type !== 'video') throw new Error('Video klip seç')
  const dir = cacheDir('media', m.key || uid('s'))
  const smooth = [10, 30, 60][Math.max(0, Math.min(2, level - 1))]
  const out = path.join(dir, `stab-${level}.mp4`)
  if (!(fs.existsSync(out) && fs.statSync(out).size > 0)) {
    const dur = m.duration || 1
    const prog = (k0, k1) => s => { const x = /out_time_us=(\d+)/.exec(s); if (x && onProgress) onProgress(k0 + (k1 - k0) * Math.min(1, +x[1] / 1e6 / dur)) }
    // dosya yolunu filtre içinde kaçırmamak için çalışma klasörü = önbellek klasörü
    let r = await run(ffmpegBin(), ['-y', '-v', 'error', '-progress', 'pipe:2', '-i', m.path, '-vf', 'vidstabdetect=shakiness=6:accuracy=12:result=stab.trf', '-an', '-f', 'null', '-'], { cwd: dir, onStderr: prog(0, 0.4) })
    if (r.code !== 0) throw new Error('vidstab analizi başarısız: ' + (r.err || '').slice(-160))
    const enc = (await hasNvenc()) ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '19', '-b:v', '0', '-g', '15'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-g', '15']
    r = await run(ffmpegBin(), ['-y', '-v', 'error', '-progress', 'pipe:2', '-i', m.path, '-vf', `vidstabtransform=input=stab.trf:smoothing=${smooth}:optzoom=1:zoomspeed=0.2,unsharp=5:5:0.6:3:3:0.3,format=yuv420p`, '-an', ...enc, 'stab.tmp.mp4'], { cwd: dir, onStderr: prog(0.4, 1) })
    if (r.code !== 0) throw new Error('sabitleme kodlaması başarısız: ' + (r.err || '').slice(-160))
    fs.renameSync(path.join(dir, 'stab.tmp.mp4'), out)
  }
  store.edit('Sabitle', d => {
    if (d.media[m.id]) d.media[m.id].stabPath = out
    const x = TL.getClip(d, c.id)
    if (x) x.stabilize = level
  })
  return out
}

// ---------------------------------------------------------------- 6) krom anahtar
export function chromaKey() {
  const s = store.get()
  const main = TL.mainTrack(s.project)
  const sel = selectedClips(s).find(c => c.type === 'video' || c.type === 'image')
  const at = TL.clipsAt(s.project, playback.time).map(x => x.clip).filter(c => c.type === 'video' || c.type === 'image')
  const c = sel || at.find(c => !main.clips.some(x => x.id === c.id)) || at[0]
  if (!c) return null
  store.select([c.id])
  if (!(c.chroma && c.chroma.enabled)) store.edit('Krom anahtar', d => { const x = TL.getClip(d, c.id); if (x) x.chroma = { ...(x.chroma || {}), enabled: true } })
  store.setUI({ inspectorTab: 'basic' }) // krom anahtar Temel sekmesinde
  return c
}

// ---------------------------------------------------------------- 7) uzun videoyu Shorts'a böl
export function splitForShorts(seconds = 60, times = null) {
  const p = P()
  const main = TL.mainTrack(p)
  if (!main || !main.clips.length) return 0
  const end = main.clips.reduce((e, c) => Math.max(e, c.start + c.duration), 0)
  let cuts = times && times.length ? times.slice() : []
  if (!cuts.length) for (let t = seconds; t < end - 3; t += seconds) cuts.push(t)
  cuts = cuts.filter(t => t > 1 && t < end - 1).sort((a, b) => a - b)
  if (!cuts.length) return 0
  store.edit('Shorts için böl', d => {
    const m = TL.mainTrack(d)
    for (const t of cuts.slice().reverse()) TL.splitAt(d, t, m.clips.map(c => c.id), ui())
    const starts = [0, ...cuts]
    starts.forEach((t, i) => d.markers.push({ id: uid('k'), time: t, color: '#b98cff', label: `Shorts ${i + 1}` }))
  })
  return cuts.length + 1
}

// ---------------------------------------------------------------- 8) ses
export function setAudioFlag(key, value, filter = () => true, label = 'Ses') {
  let n = 0
  store.edit(label, d => {
    for (const t of d.tracks) for (const c of t.clips) {
      if (!c.audio || !filter(c, d)) continue
      if (c.type === 'video' && !(d.media[c.mediaId] || {}).hasAudio) continue
      c.audio[key] = value
      n++
    }
  })
  return n
}
