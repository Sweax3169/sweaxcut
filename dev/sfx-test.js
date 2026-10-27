// Bütün sfx + müzik parçalarını renderSynth ile çizdirir; tepe, RMS, NaN, sessizlik, kırpılma raporu + dalga biçimleri
// ?only=sfx | music   &id=a,b (yalnız bunlar)   &wav=1 (birkaçını test-videos/out/sfx/ altına yaz)
import { renderSynth, renderToFile, audioBufferToWav } from '../src/packs/sfx/render.js'
import { SFX } from '../src/packs/sfx/index.js'

const q = new URLSearchParams(location.search)
const only = q.get('only')
const ids = q.get('id') ? q.get('id').split(',') : null
const g = document.getElementById('g'), st = document.getElementById('s')

function stats(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate
  let peak = 0, sum = 0, nan = 0, quiet = 0, dc = 0, clip = 0, onset = -1
  const thr = Math.pow(10, -40 / 20)
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const v = d[i]
      if (v !== v) { nan++; continue }
      const a = Math.abs(v)
      if (a > peak) peak = a
      if (a > 0.999) clip++
      sum += v * v; dc += v
      if (a < 1e-4) quiet++
      if (onset < 0 && a > thr) onset = i / sr
    }
  }
  const N = n * ch
  return { dur: +(n / sr).toFixed(2), peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / N + 1e-12)).toFixed(1), nan, silent: +(quiet / N).toFixed(2), dc: +(dc / N).toFixed(4), clip, onset: +onset.toFixed(3) }
}
function wave(buf, bad) {
  const c = document.createElement('canvas'); c.width = 300; c.height = 60
  const x = c.getContext('2d'), d = buf.getChannelData(0), n = d.length
  x.fillStyle = '#0e0f12'; x.fillRect(0, 0, 300, 60)
  x.strokeStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.moveTo(0, 30); x.lineTo(300, 30); x.stroke()
  x.fillStyle = bad ? '#ff6b5e' : '#2EE6A6'
  for (let px = 0; px < 300; px++) {
    let mn = 0, mx = 0
    const a = Math.floor(px / 300 * n), b = Math.floor((px + 1) / 300 * n)
    for (let i = a; i < b; i++) { if (d[i] < mn) mn = d[i]; if (d[i] > mx) mx = d[i] }
    x.fillRect(px, 30 - mx * 29, 1, Math.max(1, (mx - mn) * 29))
  }
  return c
}
async function run() {
  let MUSIC = []
  if (only !== 'sfx') { try { MUSIC = (await import('../src/packs/music/index.js')).MUSIC || [] } catch (e) { console.warn('müzik yok', e) } }
  const list = [...(only === 'music' ? [] : SFX.map(d => ({ d, kind: 'sfx' }))), ...MUSIC.map(d => ({ d, kind: 'music' }))].filter(x => !ids || ids.includes(x.d.id))
  const report = [], problems = []
  const t0 = performance.now()
  for (let k = 0; k < list.length; k++) {
    const { d, kind } = list[k]
    st.textContent = `${k + 1}/${list.length} ${d.id}`
    const ts = performance.now()
    let s, buf, raw
    try {
      raw = await renderSynth({ ...d, normalize: false })
      const ms = Math.round(performance.now() - ts)
      const rs = stats(raw)
      // normalize edilmiş kopya (renderSynth ile aynı kural)
      buf = new AudioBuffer({ length: raw.length, numberOfChannels: raw.numberOfChannels, sampleRate: raw.sampleRate })
      const k = rs.peak > 1e-6 ? Math.pow(10, (d.level ?? -1) / 20) / rs.peak : 1
      for (let c = 0; c < raw.numberOfChannels; c++) { const a = raw.getChannelData(c), o = buf.getChannelData(c); for (let i = 0; i < a.length; i++) o[i] = a[i] * k }
      s = { ...stats(buf), rawPeak: rs.peak, ms, xRealtime: +(d.duration / (ms / 1000)).toFixed(1) }
    } catch (e) { s = { error: String(e && e.message || e) } }
    const issues = []
    if (s.error) issues.push('HATA ' + s.error)
    else {
      if (s.nan) issues.push('NaN')
      if (s.rawPeak < 0.003) issues.push('sessiz')
      if (s.silent > 0.75 && kind === 'sfx') issues.push('çok boşluk ' + s.silent)
      if (s.onset > 0.3 && kind === 'sfx') issues.push('geç başlıyor ' + s.onset)
      if (Math.abs(s.dc) > 0.02) issues.push('DC ' + s.dc)
      if (Math.abs(s.dur - d.duration) > 0.02) issues.push('süre ' + s.dur)
      if (kind === 'music' && (d.duration < 20 || d.duration > 60)) issues.push('müzik süresi ' + d.duration)
    }
    if (issues.length) problems.push({ id: d.id, issues })
    report.push({ id: d.id, kind, cat: d.category, ...s })
    const cell = document.createElement('div'); cell.className = 'c' + (kind === 'music' ? ' m' : '') + (issues.length ? ' bad' : '')
    cell.innerHTML = `<b>${d.name}</b>`
    if (buf) cell.appendChild(wave(buf, issues.length))
    const info = document.createElement('div'); info.textContent = s.error ? s.error.slice(0, 40) : `${s.dur}s pk${s.rawPeak} ${s.rmsDb}dB ${s.ms}ms`
    cell.appendChild(info)
    g.appendChild(cell)
    await new Promise(r => setTimeout(r, 0))
  }
  // birkaç WAV yaz
  const wrote = []
  if (q.get('wav') && window.require) {
    const path = window.require('path'), fs = window.require('fs')
    const dir = path.resolve('test-videos/out/sfx')
    const pick = (q.get('wav') === 'all' ? list : list.filter((x, i) => i % 9 === 0 || x.kind === 'music' && i % 4 === 0))
    for (const { d } of pick) {
      const p = path.join(dir, d.id + '.wav')
      try { fs.unlinkSync(p) } catch (e) { /* yok */ }
      await renderToFile(d, p)
      wrote.push(p)
    }
  }
  const cats = {}
  for (const r of report) { const k = r.kind + ':' + r.cat; cats[k] = (cats[k] || 0) + 1 }
  st.textContent = `${list.length} ses · ${problems.length} sorun · ${((performance.now() - t0) / 1000).toFixed(1)} sn`
  window.__result = { count: list.length, cats, problems, wrote: wrote.length, totalSec: +((performance.now() - t0) / 1000).toFixed(1), report }
  await new Promise(r => setTimeout(r, 200))
  window.__done = true
}
run()
