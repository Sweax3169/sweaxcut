// Sessizlik algılama ("sessizlikleri kes"): ffmpeg silencedetect → kaynak zamanında sessiz aralıklar,
// planSilenceCuts → bir klip için zaman çizelgesinden SİLİNECEK aralıklar (giriş/çıkış/hız/ters dahil).

import { run, appPaths } from '../../platform/node.js'
import { sourceTime } from '../../core/time.js'

// thresholdDb: sayı (dBFS) ya da 'auto' (ortalama seviyenin ~18 dB altı)
export async function detectSilences(audioPath, { thresholdDb = -35, minDuration = 0.45, padding = 0.12 } = {}) {
  let thr = thresholdDb
  if (thr === 'auto') {
    const r0 = await run(appPaths().ffmpeg, ['-hide_banner', '-nostats', '-i', audioPath, '-vn', '-af', 'volumedetect', '-f', 'null', '-'])
    const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(r0.err || '')
    thr = m ? Math.max(-60, Math.min(-20, +m[1] - 18)) : -35
  }
  const r = await run(appPaths().ffmpeg, ['-hide_banner', '-nostats', '-i', audioPath, '-vn', '-af', `silencedetect=noise=${thr}dB:d=${Math.max(0.05, minDuration)}`, '-f', 'null', '-'])
  const err = r.err || ''
  if (r.code !== 0 && !/silence_/.test(err)) throw new Error('sessizlik algılanamadı: ' + err.slice(-200))
  const dm = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(err)
  const total = dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + (+dm[3]) : Infinity
  const out = []
  let start = null
  for (const line of err.split(/\r?\n/)) {
    let m = /silence_start:\s*(-?[\d.]+)/.exec(line)
    if (m) { start = Math.max(0, +m[1]); continue }
    m = /silence_end:\s*([\d.]+)/.exec(line)
    if (m && start != null) { out.push({ start, end: +m[1] }); start = null }
  }
  if (start != null && isFinite(total)) out.push({ start, end: total }) // dosya sessizlikle bitiyor
  // konuşmanın nefesini koru: her iki yandan dolgu (dosya başı/sonu hariç)
  const res = []
  for (const s of out) {
    const a = s.start <= 0.01 ? 0 : s.start + padding
    const b = isFinite(total) && s.end >= total - 0.01 ? s.end : s.end - padding
    if (b - a >= 0.05) res.push({ start: round3(a), end: round3(b) })
  }
  return res
}

const round3 = x => Math.round(x * 1000) / 1000

// Kaynak zamanı s → klip yerel zamanı (monoton; ikiye bölme — hız eğrisi ve ters için de doğru)
function localAt(clip, s) {
  const inc = sourceTime(clip, clip.duration) >= sourceTime(clip, 0)
  let a = 0, b = clip.duration
  for (let k = 0; k < 50; k++) {
    const m = (a + b) / 2
    const v = sourceTime(clip, m)
    if ((v < s) === inc) a = m
    else b = m
  }
  return (a + b) / 2
}

// silences: kaynak (medya) zamanında [{start,end}] → bu klip için zaman çizelgesi aralıkları [{start,end}]
export function planSilenceCuts(clip, media, silences, { minCut = 0.1 } = {}) {
  if (!clip || !silences || !silences.length || clip.freeze) return []
  const lo = Math.min(clip.in || 0, clip.out), hi = Math.max(clip.in || 0, clip.out)
  const out = []
  for (const s of silences) {
    const a = Math.max(lo, s.start), b = Math.min(hi, s.end)
    if (b - a <= 1e-3) continue
    let la = localAt(clip, a), lb = localAt(clip, b)
    if (la > lb) [la, lb] = [lb, la]
    la = Math.max(0, la); lb = Math.min(clip.duration, lb)
    if (lb - la >= minCut) out.push({ start: round3(clip.start + la), end: round3(clip.start + lb) })
  }
  out.sort((x, y) => x.start - y.start)
  // birleştir
  const merged = []
  for (const r of out) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end + 1e-3) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  void media
  return merged
}

// Kalan (konuşma) aralıkları — UI'da "tutulacak" parçaları göstermek için
export function keepRanges(clip, cuts) {
  const out = []
  let t = clip.start
  for (const c of cuts) { if (c.start > t + 1e-3) out.push({ start: t, end: c.start }); t = Math.max(t, c.end) }
  if (clip.start + clip.duration > t + 1e-3) out.push({ start: t, end: clip.start + clip.duration })
  return out
}
