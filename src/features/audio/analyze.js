// Yükseklik ölçümü (EBU R128): entegre LUFS, yükseklik aralığı, gerçek tepe; ayrıca basit seviye istatistikleri

import { run, appPaths } from '../../platform/node.js'

// → { integrated (LUFS), lra (LU), truePeak (dBTP), threshold (LUFS) }
export async function loudness(audioPath) {
  const r = await run(appPaths().ffmpeg, ['-hide_banner', '-nostats', '-i', audioPath, '-vn', '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'])
  const err = r.err || ''
  const i = err.lastIndexOf('Summary:')
  const s = i >= 0 ? err.slice(i) : err
  const num = re => { const m = re.exec(s); return m ? +m[1] : null }
  const res = {
    integrated: num(/I:\s*(-?[\d.]+|-inf) LUFS/),
    threshold: num(/Threshold:\s*(-?[\d.]+) LUFS/),
    lra: num(/LRA:\s*(-?[\d.]+) LU/),
    truePeak: num(/Peak:\s*(-?[\d.]+|-inf) dBFS/),
  }
  if (res.integrated == null && /I:\s*-inf/.test(s)) res.integrated = -Infinity
  if (r.code !== 0 && res.integrated == null) throw new Error('yükseklik ölçülemedi: ' + err.slice(-200))
  return res
}

// Hedef yüksekliğe (ör. −14 LUFS) ulaşmak için gereken kazanç (dB), gerçek tepe sınırıyla
export function gainToTarget(meas, target = -14, ceiling = -1) {
  if (!meas || !isFinite(meas.integrated)) return 0
  let g = target - meas.integrated
  if (meas.truePeak != null && isFinite(meas.truePeak)) g = Math.min(g, ceiling - meas.truePeak)
  return Math.round(g * 10) / 10
}

// RMS / tepe / DC (astats) — test ve teşhis için
export async function levelStats(audioPath) {
  const r = await run(appPaths().ffmpeg, ['-hide_banner', '-nostats', '-i', audioPath, '-vn', '-af', 'astats=measure_overall=Peak_level+RMS_level+DC_offset:measure_perchannel=none', '-f', 'null', '-'])
  const err = r.err || ''
  const g = re => { const m = re.exec(err); return m ? (m[1] === '-inf' ? -Infinity : +m[1]) : null }
  return { peakDb: g(/Peak level dB:\s*(-?[\d.]+|-inf)/), rmsDb: g(/RMS level dB:\s*(-?[\d.]+|-inf)/), dc: g(/DC offset:\s*(-?[\d.]+)/) }
}
