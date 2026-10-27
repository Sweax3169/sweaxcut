// Video araçları uçtan uca test: arka plan kaldırma, sabitleme, sahne, otomatik kadraj, zoom vuruşu, iptal, araç tanımları.
// URL: ?only=bg,stab,scene,reframe,zoom,abort,tools  ?fresh=1 (önbelleği sil)
import { store } from '../src/core/store.js'
import { createProject, createMediaClip } from '../src/core/model.js'
import { probe, mediaKey } from '../src/core/media.js'
import { prop } from '../src/core/keyframes.js'
import { fileUrl } from '../src/platform/node.js'
import * as VT from '../src/features/video/index.js'
import { Compositor } from '../src/engine/compositor.js'
import { clipSourcePath } from '../src/core/media.js'

const q = new URLSearchParams(location.search)
const ONLY = q.get('only') ? new Set(q.get('only').split(',')) : null
const want = k => !ONLY || ONLY.has(k)
const nodeReq = window.require
const fs = nodeReq('fs'), path = nodeReq('path'), cp = nodeReq('child_process')
const ROOT = window.__ROOT
const TV = path.join(ROOT, 'test-videos')
const OUT = path.join(TV, 'out', 'videotools')
const FF = path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
const FP = path.join(ROOT, 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe')
if (q.get('fresh') === '1') { try { fs.rmSync(path.join(OUT, 'userdata', 'cache'), { recursive: true, force: true }) } catch (e) { /* */ } }

const logEl = document.getElementById('log')
const R = { ok: 0, fail: 0, checks: [], timings: {} }
function log(s, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = s; logEl.appendChild(d); console.log(s) }
function check(name, cond, info = '') {
  R.checks.push({ name, ok: !!cond, info: String(info).slice(0, 300) })
  cond ? R.ok++ : R.fail++
  log((cond ? 'TAMAM ' : 'HATA  ') + name + (info !== '' ? '  · ' + info : ''), cond ? 'ok' : 'bad')
}
const ms = t => Math.round(performance.now() - t)

function sh(bin, args) {
  return new Promise((res) => {
    const c = cp.spawn(bin, args, { windowsHide: true })
    const out = [], err = []
    c.stdout.on('data', d => out.push(d)); c.stderr.on('data', d => err.push(d))
    c.on('close', code => res({ code, buf: Buffer.concat(out), out: Buffer.concat(out).toString(), err: Buffer.concat(err).toString() }))
  })
}
async function ffprobeJson(file, extra = []) {
  const r = await sh(FP, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', ...extra, file])
  return JSON.parse(r.out || '{}')
}
async function grabFrame(file, t, w = 320, vp9alpha = false) {
  const args = ['-v', 'error', ...(vp9alpha ? ['-c:v', 'libvpx-vp9'] : []), '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=${w}:-2`, '-f', 'image2pipe', '-vcodec', 'png', '-']
  const r = await sh(FF, args)
  const blob = new Blob([r.buf], { type: 'image/png' })
  return createImageBitmap(blob)
}

// ------------------------------------------------------------ proje
store.loadProject(createProject({ ratio: '9:16', name: 'video araçları testi' }))
async function addMedia(file) {
  const info = await probe(file)
  const id = 'm' + Math.random().toString(36).slice(2, 8)
  const media = { id, key: mediaKey(file), path: file, name: path.basename(file), ext: path.extname(file), ...info, status: 'ready' }
  store.edit('medya', d => { d.media[id] = media }, { noHistory: true })
  return id
}
function addClip(mediaId, onMain = false) {
  const m = store.get().project.media[mediaId]
  const c = createMediaClip(m)
  store.edit('klip', d => {
    const main = d.tracks.find(t => t.main)
    c.start = main.clips.reduce((e, x) => Math.max(e, x.start + x.duration), 0)
    main.clips.push(c)
  })
  void onMain
  return c.id
}
const clipOf = id => { for (const t of store.get().project.tracks) { const c = t.clips.find(x => x.id === id); if (c) return c } return null }

// ------------------------------------------------------------ temas föyü
const sheet = document.getElementById('sheet')
const SW = 1080, SHH = 1000
sheet.width = SW; sheet.height = SHH
const g = sheet.getContext('2d')
g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, SW, SHH)
let cx = 8, cy = 8, rowH = 0
function place(w, h) { if (cx + w > SW - 8) { cx = 8; cy += rowH + 22; rowH = 0 } const p = { x: cx, y: cy }; cx += w + 8; rowH = Math.max(rowH, h); return p }
function checker(x, y, w, h, s = 10) { for (let j = 0; j < h; j += s) for (let i = 0; i < w; i += s) { g.fillStyle = ((i + j) / s) % 2 ? '#3a3a3a' : '#5a5a5a'; g.fillRect(x + i, y + j, Math.min(s, w - i), Math.min(s, h - j)) } }
function label(p, h, text) { g.fillStyle = '#e4ff3a'; g.font = '11px JetBrains Mono, monospace'; g.fillText(text, p.x, p.y + h + 13) }
function drawImg(img, w, text, { alphaBg = false, rect = null } = {}) {
  const h = Math.round(img.height * w / img.width)
  const p = place(w, h)
  if (alphaBg) checker(p.x, p.y, w, h)
  g.drawImage(img, p.x, p.y, w, h)
  if (rect) { g.strokeStyle = '#e4ff3a'; g.lineWidth = 2; g.strokeRect(p.x + rect.x * w, p.y + rect.y * h, rect.w * w, rect.h * h) }
  label(p, h, text)
}

// Chromium <video> ile oynat, karede alfa ölç
function videoAlpha(file, t, pts) {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.muted = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'
    let done = false
    const fin = (r) => { if (!done) { done = true; resolve(r) } }
    setTimeout(() => fin({ error: 'zaman aşımı' }), 15000)
    v.onerror = () => fin({ error: 'video hatası ' + (v.error && v.error.code) })
    v.onloadeddata = () => { v.currentTime = t }
    v.onseeked = () => {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
      const x = c.getContext('2d', { willReadFrequently: true })
      x.clearRect(0, 0, c.width, c.height)
      x.drawImage(v, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let lo = 0, n = 0
      for (let i = 3; i < d.length; i += 16) { n++; if (d[i] < 128) lo++ }
      const at = pts.map(([u, w]) => d[(Math.floor(w * c.height) * c.width + Math.floor(u * c.width)) * 4 + 3])
      fin({ w: v.videoWidth, h: v.videoHeight, duration: v.duration, transparentFrac: lo / n, at, canvas: c })
    }
    v.src = fileUrl(file)
  })
}

// ------------------------------------------------------------ testler
async function testBg() {
  log('— ARKA PLAN KALDIRMA —', 'hd')
  const kisi = await addMedia(path.join(OUT, 'kisi_test.mp4'))
  const oyun = await addMedia(path.join(TV, 'oyun kaydı çılgın şölen.mp4'))
  const res = {}
  for (const [id, quality, nm] of [[kisi, 'hizli', 'kisi'], [kisi, 'kaliteli', 'kisi'], [oyun, 'hizli', 'oyun'], [oyun, 'kaliteli', 'oyun']]) {
    const t = performance.now()
    let last = 0
    const r = await VT.removeBackground(id, { quality, onProgress: p => { last = p } })
    const m = store.get().project.media[id]
    const key = `${nm}-${quality}`
    res[key] = r
    log(`${key}: ${ms(t)} ms · ${r.frames} kare · ${r.width}x${r.height} · ${r.speed ? r.speed.toFixed(1) : '-'} kare/sn · ${r.delegate} · maske ${r.maskW}x${r.maskH} · roi ${r.roiFrames} · ${(r.size / 1e6).toFixed(2)} MB · seg ${r.stats ? r.stats.segMs.toFixed(1) : '-'} ms gl ${r.stats ? r.stats.glMs.toFixed(1) : '-'} ms bekle ${r.stats ? r.stats.waitMs.toFixed(1) : '-'} ms`)
    check(`bgremove ${key}: variants.bgremove yazıldı`, m.variants && m.variants.bgremove === r.path, r.path)
    check(`bgremove ${key}: ilerleme 1'e ulaştı`, last === 1, last)
    const j = await ffprobeJson(r.path)
    const vs = (j.streams || []).find(s => s.codec_type === 'video') || {}
    const alphaTag = vs.tags && (vs.tags.alpha_mode || vs.tags.ALPHA_MODE)
    check(`bgremove ${key}: VP9 + alpha_mode=1`, vs.codec_name === 'vp9' && alphaTag === '1', `${vs.codec_name} ${vs.pix_fmt} alpha_mode=${alphaTag} renk=${vs.color_space}`)
    const srcDur = m.duration
    const dur = +(j.format && j.format.duration)
    check(`bgremove ${key}: süre aynı (±1 kare)`, Math.abs(dur - srcDur) <= 1.5 / m.fps, `${dur} / ${srcDur}`)
    // kare sayısı (paket sayımı)
    const cnt = await sh(FP, ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', r.path])
    const exp = Math.round(srcDur * m.fps)
    check(`bgremove ${key}: kare sayısı ${exp}`, Math.abs(+cnt.out.trim() - exp) <= 1, cnt.out.trim())
    R.timings['bg_' + key] = { ms: Math.round(r.ms), fps: r.speed, frames: r.frames, size: r.size, w: r.width, h: r.height, delegate: r.delegate, perFrame: r.stats }
  }
  // önbellek
  const t2 = performance.now()
  const rc = await VT.removeBackground(kisi, { quality: 'hizli' })
  check('bgremove önbellekten anında döner', rc.cached && ms(t2) < 200, ms(t2) + ' ms')

  // ffmpeg ile alfa çıkar (Chromium'dan bağımsız doğrulama)
  const kp = res['kisi-kaliteli'].path
  const ae = await sh(FF, ['-v', 'error', '-c:v', 'libvpx-vp9', '-ss', '1', '-i', kp, '-frames:v', '1', '-vf', 'alphaextract,scale=64:36', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
  let low = 0, high = 0
  for (const b of ae.buf) { if (b < 32) low++; if (b > 224) high++ }
  check('ffmpeg alphaextract: saydam ve opak bölge var', low > 100 && high > 100, `düşük=${low} yüksek=${high} / ${ae.buf.length}`)

  // Chromium <video> alfa: arka plan (sağ üst testsrc) saydam, yüz/göğüs opak. t=1 sn: portre x=225..737 (1280 ölçek)
  for (const key of ['kisi-hizli', 'kisi-kaliteli']) {
    const va = await videoAlpha(res[key].path, 1.0, [[0.92, 0.12], [0.85, 0.85], [0.418, 0.32], [0.414, 0.667]])
    if (va.error) { check(`Chromium <video> ${key}`, false, va.error); continue }
    check(`Chromium <video> ${key}: alfa okundu (arka plan saydam)`, va.at[0] < 40 && va.at[1] < 40, `sağ üst=${va.at[0]} sağ alt=${va.at[1]} saydam oranı=${va.transparentFrac.toFixed(2)}`)
    check(`Chromium <video> ${key}: kişi opak`, va.at[2] > 200 && va.at[3] > 200, `yüz=${va.at[2]} göğüs=${va.at[3]}`)
    check(`Chromium <video> ${key}: süre`, Math.abs(va.duration - 4) < 0.05, va.duration)
    drawImg(va.canvas, 250, `${key} · Chromium`, { alphaBg: true })
  }
  const vo = await videoAlpha(res['oyun-hizli'].path, 4.0, [[0.5, 0.5]])
  if (!vo.error) drawImg(vo.canvas, 250, 'oyun-hizli · insan yok', { alphaBg: true })
  const src = await grabFrame(path.join(OUT, 'kisi_test.mp4'), 1.0, 250)
  drawImg(src, 250, 'kaynak t=1')
}

// Gerçek bileşimci: bgRemove klibi kırmızı arka planın üstünde — alfa saydam yerde kırmızı görünmeli
async function testComp() {
  log('— BİLEŞİMCİ (önizleme/dışa aktarma motoru) —', 'hd')
  const kisi = await addMedia(path.join(OUT, 'kisi_test.mp4'))
  await VT.removeBackground(kisi, { quality: 'kaliteli' })
  const p0 = createProject({ ratio: '16:9' })
  p0.settings.bg = { ...p0.settings.bg, type: 'color', color: '#ff0000' }
  p0.media[kisi] = store.get().project.media[kisi]
  const c = createMediaClip(p0.media[kisi])
  c.bgRemove = true
  p0.tracks[0].clips.push(c)
  const sp = clipSourcePath(c, p0.media[kisi], { preview: true })
  check('clipSourcePath → alfa türevi', sp.alpha && sp.path === p0.media[kisi].variants.bgremove, sp.path)
  const v = document.createElement('video')
  v.muted = true; v.src = fileUrl(sp.path)
  await new Promise(r => { v.onloadeddata = r; v.onerror = r })
  v.currentTime = 1.0
  await new Promise(r => { v.onseeked = r; setTimeout(r, 4000) })
  const cv = document.createElement('canvas')
  const comp = new Compositor(cv, { preserve: true })
  const sources = { image: () => null, videoFrame: () => ({ src: v, w: v.videoWidth, h: v.videoHeight }) }
  comp.render({ project: p0, time: 1.0, sources, scale: 0.5 })
  const W = cv.width, H = cv.height
  const g2 = document.createElement('canvas'); g2.width = W; g2.height = H
  const x2 = g2.getContext('2d', { willReadFrequently: true }); x2.drawImage(cv, 0, 0)
  const px = (u, w) => Array.from(x2.getImageData(Math.floor(u * W), Math.floor(w * H), 1, 1).data)
  const bgPx = px(0.92, 0.12), facePx = px(0.418, 0.32)
  check('bileşimci: arka plan bölgesi kırmızı (alfa uygulandı)', bgPx[0] > 200 && bgPx[1] < 40 && bgPx[2] < 40, bgPx.join(','))
  check('bileşimci: kişi görünüyor (kırmızı değil)', !(facePx[0] > 200 && facePx[1] < 60), facePx.join(','))
  check('bileşimci: GL derleme hatası yok', !comp.glw.errors || comp.glw.errors.size === 0, comp.glw.errors ? [...comp.glw.errors.keys()].join(',') : '')
  drawImg(g2, 250, 'bileşimci · kırmızı zemin')
}

async function testStab() {
  log('— SABİTLEME —', 'hd')
  const tit = await addMedia(path.join(OUT, 'titrek.mp4'))
  const oyun = await addMedia(path.join(TV, 'oyun kaydı çılgın şölen.mp4'))
  // titreşim ölçüsü: ardışık küçük gri kareler arasındaki ortalama fark
  async function jitter(file) {
    const r = await sh(FF, ['-v', 'error', '-i', file, '-vf', 'scale=160:90,format=gray', '-f', 'rawvideo', '-'])
    const N = 160 * 90, n = Math.floor(r.buf.length / N)
    let acc = 0
    for (let k = 1; k < n; k++) { let s = 0; for (let i = 0; i < N; i += 3) s += Math.abs(r.buf[k * N + i] - r.buf[(k - 1) * N + i]); acc += s / (N / 3) }
    return acc / Math.max(1, n - 1)
  }
  const j0 = await jitter(path.join(OUT, 'titrek.mp4'))
  for (const level of [1, 2, 3]) {
    const t = performance.now()
    let last = 0
    const r = await VT.stabilize(tit, level, { onProgress: p => { last = p } })
    const m = store.get().project.media[tit]
    log(`stab${level}: ${ms(t)} ms (analiz ${Math.round(r.analyzeMs)} ms, kodlama ${Math.round(r.encodeMs)} ms, ${r.encoder}) · ${(r.size / 1e6).toFixed(2)} MB · ${r.speed.toFixed(2)}× gerçek zaman`)
    check(`stab${level}: variants.stab${level}`, m.variants && m.variants['stab' + level] === r.path)
    check(`stab${level}: ilerleme 1`, last === 1, last)
    const j = await ffprobeJson(r.path)
    const v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio')
    check(`stab${level}: H.264 + ses kopyalandı + süre`, v.codec_name === 'h264' && a && a.codec_name === 'aac' && Math.abs(+j.format.duration - m.duration) < 0.06, `${v.codec_name} ${a && a.codec_name} ${j.format.duration}/${m.duration}`)
    const jj = await jitter(r.path)
    check(`stab${level}: titreşim azaldı`, jj < j0 * 0.92, `önce ${j0.toFixed(2)} → sonra ${jj.toFixed(2)}`)
    R.timings['stab' + level] = { ms: Math.round(r.ms), analyzeMs: Math.round(r.analyzeMs), encodeMs: Math.round(r.encodeMs), encoder: r.encoder, size: r.size, jitterBefore: j0, jitterAfter: jj, xRealtime: r.speed }
    if (level === 2) {
      drawImg(await grabFrame(path.join(OUT, 'titrek.mp4'), 2, 200), 200, 'titrek kaynak')
      drawImg(await grabFrame(r.path, 2, 200), 200, 'stab2')
    }
  }
  // Türkçe karakter + boşluklu yol (cwd önbellek, göreli trf)
  const t = performance.now()
  const r = await VT.stabilize(oyun, 1, {})
  check('stab: Türkçe/boşluklu yol çalıştı (1080p60 8 sn)', !!r.path, `${ms(t)} ms · ${r.encoder} · ${(r.size / 1e6).toFixed(1)} MB`)
  R.timings.stab1_1080p60 = { ms: Math.round(r.ms), analyzeMs: Math.round(r.analyzeMs || 0), size: r.size }
}

async function testScene() {
  log('— SAHNE —', 'hd')
  const dm = await addMedia(path.join(OUT, 'daire_sahne.mp4'))
  const t = performance.now()
  const times = await VT.detectScenes(dm, { threshold: 0.3 })
  check('detectScenes daire_sahne: tek kesme ≈ 3.0 sn', times.length === 1 && Math.abs(times[0] - 3) < 0.05, JSON.stringify(times) + ` · ${ms(t)} ms`)
  const om = await addMedia(path.join(TV, 'oyun kaydı çılgın şölen.mp4'))
  const t2 = performance.now()
  const ot = await VT.detectScenes(om, { threshold: 0.3 })
  log(`oyun kaydı sahneleri: ${JSON.stringify(ot)} · ${ms(t2)} ms`)
  R.timings.scenes = { daireMs: ms(t), oyunMs: ms(t2), oyun: ot }
  // klibi böl (tek geri alma adımı); klip 1 sn'den başlasın diye öne bir klip koy
  const filler = addClip(om)
  const cid = addClip(dm)
  void filler
  const before = store.get().history.past.length
  const created = await VT.splitClipAtScenes(cid, { threshold: 0.3 })
  const main = store.get().project.tracks.find(x => x.main)
  const parts = main.clips.filter(c => c.mediaId === dm)
  check('splitClipAtScenes: 2 parça', created.length === 1 && parts.length === 2, parts.map(p => `${p.start.toFixed(3)}+${p.duration.toFixed(3)} in=${p.in.toFixed(3)}`).join(' | '))
  check('splitClipAtScenes: kesme kaynakta 3.0 sn', parts.length === 2 && Math.abs(parts[1].in - 3) < 0.04, parts[1] && parts[1].in)
  check('splitClipAtScenes: tek geri alma adımı', store.get().history.past.length === before + 1)
  store.undo()
  check('geri al → tek klip', store.get().project.tracks.find(x => x.main).clips.filter(c => c.mediaId === dm).length === 1)
}

// kırpma penceresi (kaynakta 0..1) → anahtar karelerden
function windowAt(clip, lt, W, H, media) {
  const ar = media.width / media.height
  const axis = ar > W / H ? 'x' : 'y'
  const base = axis === 'x' ? H * ar : W / ar
  const disp = base * (clip.transform.scale || 1)
  const span = axis === 'x' ? W : H
  const v = prop(clip, 'transform.' + axis, lt) || 0
  const u = 0.5 - v * span / disp
  const vis = span / disp
  return axis === 'x' ? { x: u - vis / 2, y: 0, w: vis, h: 1, u } : { x: 0, y: u - vis / 2, w: 1, h: vis, u }
}

async function testReframe() {
  log('— OTOMATİK KADRAJ —', 'hd')
  const P = () => store.get().project.settings
  // 1) sentetik daire: gerçek merkez bilinir
  const dm = await addMedia(path.join(OUT, 'daire_sahne.mp4'))
  const cid = addClip(dm)
  let t = performance.now()
  const r = await VT.autoReframe(cid, { mode: 'hareket', smoothing: 0.5 })
  let c = clipOf(cid)
  const media = store.get().project.media[dm]
  log(`daire: ${ms(t)} ms · ${r.frames} analiz karesi @${r.afps} fps · ${r.keys} anahtar kare · kesmeler ${JSON.stringify(r.cuts)}`)
  check('reframe daire: fit=cover + transform.x anahtar kareleri', c.fit === 'cover' && c.keyframes['transform.x'] && c.keyframes['transform.x'].length >= 3, r.keys)
  // gerçek daire merkezi (1920 genişlikte), pencere sınırına kırpılmış
  const truth = tt => (tt < 3 ? 150 + 1500 * tt / 3 : 1650 - 1500 * (tt - 3) / 3) + 90
  let err = 0, nE = 0, inside = 0; const dbg = []
  const vis = r.visible
  for (let tt = 0.4; tt < 5.8; tt += 0.2) {
    if (Math.abs(tt - 3) < 0.5) continue
    const w = windowAt(c, tt, P().width, P().height, media)
    const u = truth(tt) / 1920
    const uc = Math.max(vis / 2, Math.min(1 - vis / 2, u))
    err += Math.abs(w.u - uc); nE++; dbg.push(`${tt.toFixed(1)}:${w.u.toFixed(3)}/${uc.toFixed(3)}`)
    if (u >= w.x && u <= w.x + w.w) inside++
  }
  log('daire u/gerçek: ' + dbg.join(' '))
  check('reframe daire: daire penceredeyken ≥ %90', inside / nE >= 0.9, `${inside}/${nE} · ort. merkez hatası ${(err / nE * 100).toFixed(1)}% genişlik`)
  R.timings.reframe_daire = { ms: Math.round(r.ms), keys: r.keys, frames: r.frames, meanErr: err / nE, inside: inside / nE }
  for (const tt of [0.5, 1.5, 2.5, 3.5, 5]) drawImg(await grabFrame(media.path, tt, 200), 200, `daire t=${tt}`, { rect: windowAt(c, tt, P().width, P().height, media) })

  // 2) oyun kaydı (aksiyon)
  const om = await addMedia(path.join(TV, 'oyun kaydı çılgın şölen.mp4'))
  const oc = addClip(om)
  t = performance.now()
  const r2 = await VT.autoReframe(oc, { mode: 'hareket', smoothing: 0.6 })
  c = clipOf(oc)
  const om2 = store.get().project.media[om]
  log(`oyun: ${ms(t)} ms · ${r2.frames} kare · ${r2.keys} anahtar · kesmeler ${JSON.stringify(r2.cuts)}`)
  check('reframe oyun: anahtar kare üretildi', r2.keys >= 2, r2.keys)
  const xs = c.keyframes['transform.x'].map(k => k.v)
  const maxOff = (P().height * 16 / 9 - P().width) / (2 * P().width)
  check('reframe oyun: kenar boşluğu yok (|x| ≤ sınır)', xs.every(v => Math.abs(v) <= maxOff + 1e-6), `aralık ${Math.min(...xs).toFixed(3)}..${Math.max(...xs).toFixed(3)} sınır ±${maxOff.toFixed(3)}`)
  R.timings.reframe_oyun = { ms: Math.round(r2.ms), keys: r2.keys, frames: r2.frames, xRange: [Math.min(...xs), Math.max(...xs)] }
  for (const tt of [1, 3, 5, 7]) drawImg(await grabFrame(om2.path, tt, 200), 200, `oyun t=${tt}`, { rect: windowAt(c, tt, P().width, P().height, om2) })

  // 3) kişi: yüz takibi (yüz merkezi ≈ (412 + 125 t) / 1280)
  const km = await addMedia(path.join(OUT, 'kisi_test.mp4'))
  const kc = addClip(km)
  t = performance.now()
  const r3 = await VT.autoReframe(kc, { mode: 'yuz', smoothing: 0.4 })
  c = clipOf(kc)
  const kmm = store.get().project.media[km]
  log(`kişi: ${ms(t)} ms · yüz karesi ${r3.faceFrames}/${r3.frames} · ${r3.delegate} · mod ${r3.mode} · ${r3.keys} anahtar`)
  check('reframe kişi: yüz algılandı ve kullanıldı', r3.usedFaces && r3.faceFrames >= r3.frames * 0.6, `${r3.faceFrames}/${r3.frames}`)
  let fe = 0, fn = 0
  for (let tt = 0.5; tt < 3.6; tt += 0.25) {
    const w = windowAt(c, tt, P().width, P().height, kmm)
    const u = Math.max(r3.visible / 2, Math.min(1 - r3.visible / 2, (412 + 125 * tt) / 1280))
    fe += Math.abs(w.u - u); fn++
  }
  check('reframe kişi: pencere yüzü izliyor (ort. hata < %6)', fe / fn < 0.06, (fe / fn * 100).toFixed(1) + '%')
  R.timings.reframe_kisi = { ms: Math.round(r3.ms), faceFrames: r3.faceFrames, frames: r3.frames, meanErr: fe / fn }
  for (const tt of [0.5, 2, 3.5]) drawImg(await grabFrame(kmm.path, tt, 200), 200, `yüz t=${tt}`, { rect: windowAt(c, tt, P().width, P().height, kmm) })

  // 4) ultrawide → 9:16 sabit merkez + hareket
  const um = await addMedia(path.join(TV, 'ultrawide.mov'))
  const uc = addClip(um)
  const r4 = await VT.autoReframe(uc, { mode: 'merkez' })
  c = clipOf(uc)
  check('reframe merkez: analiz yok, x=0, cover', r4.frames === 0 && c.transform.x === 0 && c.fit === 'cover' && !c.keyframes['transform.x'])
  t = performance.now()
  const r5 = await VT.autoReframe(uc, { mode: 'hareket' })
  check('reframe ultrawide hareket', r5.keys >= 2, `${ms(t)} ms · ${r5.keys} anahtar`)

  // 5) dikey kaynak → 16:9 hedef: proje oranı değişir, eksen y
  const vm = await addMedia(path.join(TV, 'dikey_sessiz.mp4'))
  const vc = addClip(vm)
  const r6 = await VT.autoReframe(vc, { targetRatio: '16:9', mode: 'hareket' })
  c = clipOf(vc)
  check('reframe hedef oran 16:9: proje ayarı + y ekseni', P().ratio === '16:9' && P().width === 1920 && r6.axis === 'y' && !!c.keyframes['transform.y'], `${P().ratio} ${r6.axis} ${r6.keys} anahtar`)
  // geri al tek adım (oran + anahtar kareler birlikte)
  store.undo()
  check('reframe geri al: oran geri döndü', P().ratio === '9:16')
}

async function testZoom() {
  log('— ZOOM VURUŞU —', 'hd')
  const om = await addMedia(path.join(TV, 'oyun kaydı çılgın şölen.mp4'))
  const cid = addClip(om)
  const c0 = clipOf(cid)
  const n = VT.autoZoomPunch(cid, [c0.start + 1, c0.start + 1.1, c0.start + 4], { amount: 1.3, duration: 0.4 })
  const c = clipOf(cid)
  check('autoZoomPunch: çakışan vuruş elendi (2 vuruş)', n === 2, n)
  const k = c.keyframes['transform.scale']
  check('autoZoomPunch: 6 anahtar kare', k && k.length === 6, k && k.map(x => `${x.t.toFixed(2)}:${x.v.toFixed(2)}`).join(' '))
  const peak = prop(c, 'transform.scale', 1 + 0.1)
  check('autoZoomPunch: tepe ≈ 1.3, öncesi/sonrası 1', Math.abs(peak - 1.3) < 0.01 && Math.abs(prop(c, 'transform.scale', 0.5) - 1) < 1e-6 && Math.abs(prop(c, 'transform.scale', 2) - 1) < 1e-6, `tepe ${peak.toFixed(3)}`)
  // mevcut anahtar karelerle (ör. 1→1.5 doğrusal) çarpımsal çalışır
  store.edit('kf', d => { for (const t of d.tracks) for (const x of t.clips) if (x.id === cid) x.keyframes['transform.scale'] = [{ t: 0, v: 1, ease: 'linear' }, { t: 8, v: 1.5, ease: 'linear' }] })
  VT.autoZoomPunch(cid, [c0.start + 4], { amount: 1.2, duration: 0.4 })
  const c2 = clipOf(cid)
  const base = 1 + 0.5 * (4.1 / 8)
  check('autoZoomPunch: mevcut eğriye göre çarpımsal', Math.abs(prop(c2, 'transform.scale', 4.1) - base * 1.2) < 0.02 && Math.abs(prop(c2, 'transform.scale', 7) - (1 + 0.5 * 7 / 8)) < 0.01, prop(c2, 'transform.scale', 4.1).toFixed(3) + ' ~ ' + (base * 1.2).toFixed(3))
  try {
    const nn = await VT.autoZoomFromHighlights(cid, { count: 4 })
    check('autoZoomFromHighlights (ses modülü var): vurgu bulundu', nn >= 1, nn + ' vuruş · ' + clipOf(cid).keyframes['transform.scale'].map(k => k.t.toFixed(2)).join(' '))
  } catch (e) {
    check('autoZoomFromHighlights: modül/ses yoksa Türkçe hata', /ses|modül|Vurgu/i.test(e.message), e.message)
  }
}

async function testAbort() {
  log('— İPTAL —', 'hd')
  const om = await addMedia(path.join(TV, 'ultrawide.mov'))
  let err = null
  for (const delay of [700, 3000]) {
    const ac = new AbortController()
    let tAbort = 0
    setTimeout(() => { tAbort = performance.now(); ac.abort() }, delay)
    let pr = 0
    err = null
    try { await VT.removeBackground(om, { quality: 'kaliteli', signal: ac.signal, force: true, onProgress: p => { pr = p } }) } catch (e) { err = e }
    const lat = Math.round(performance.now() - tAbort)
    check(`removeBackground iptal (${delay} ms) → AbortError`, err && VT.isAbort(err) && lat < 2500, `${err && err.message} · iptalden sonra ${lat} ms · ilerleme ${(pr * 100).toFixed(0)}%`)
  }
  const m = store.get().project.media[om]
  const dir = path.join(OUT, 'userdata', 'cache', 'media', m.key)
  const left = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.includes('.tmp')) : []
  check('iptal sonrası geçici dosya kalmadı', left.length === 0, left.join(','))
  const ac2 = new AbortController()
  setTimeout(() => ac2.abort(), 400)
  let e2 = null
  try { await VT.stabilize(om, 3, { signal: ac2.signal, force: true }) } catch (e) { e2 = e }
  check('stabilize iptal → AbortError', e2 && VT.isAbort(e2), e2 && e2.message)
  const left2 = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.includes('.tmp') || f.endsWith('.trf')) : []
  check('stabilize iptal: trf/tmp kalmadı', left2.length === 0, left2.join(','))
}

async function testTools() {
  log('— ARAÇ TANIMLARI —', 'hd')
  const iconSrc = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'Icon.jsx'), 'utf8')
  for (const tl of VT.TOOLS) {
    const okIcon = new RegExp('\\b' + tl.icon + '\\s*:').test(iconSrc)
    check(`araç ${tl.id}: alanlar + simge "${tl.icon}"`, tl.name && tl.description && typeof tl.run === 'function' && ['video-clip', 'audio-clip', 'any'].includes(tl.needs) && okIcon, tl.name)
  }
  const om = await addMedia(path.join(TV, 'dikey_sessiz.mp4'))
  const cid = addClip(om)
  const c = clipOf(cid)
  store.select([cid])
  const r = await VT.runTool('zoom-punch', { time: c.start + 1, options: { amount: 1.4 } })
  check('runTool zoom-punch', r && /Zoom/.test(r.message) && clipOf(cid).keyframes['transform.scale'].length === 3, r && r.message)
  let err = null
  store.select([])
  try { await VT.TOOLS[0].run({ store, selection: [], onProgress: () => {} }) } catch (e) { err = e }
  check('seçim yokken Türkçe hata', err && /video klibi/.test(err.message), err && err.message)
  // başka makinede açılan proje: türev yolu yok → ensureVariants yeniden üretir (önbellekte varsa anında)
  const km = await addMedia(path.join(OUT, 'kisi_test.mp4'))
  const kc = addClip(km)
  store.edit('x', d => { d.media[km].variants = { bgremove: 'C:\yok\bgremove-hizli.webm' }; for (const t of d.tracks) for (const c of t.clips) if (c.id === kc) c.bgRemove = true }, { noHistory: true })
  const t0 = performance.now()
  const n = await VT.ensureVariants({})
  const vp = store.get().project.media[km].variants.bgremove
  check('ensureVariants: eksik türev yeniden bağlandı/üretildi', n >= 1 && fs.existsSync(vp), `${n} iş · ${ms(t0)} ms · ${vp}`)
}

;(async () => {
  const T = performance.now()
  try {
    if (want('tools')) await testTools()
    if (want('scene')) await testScene()
    if (want('zoom')) await testZoom()
    if (want('reframe')) await testReframe()
    if (want('bg')) await testBg()
    if (want('comp')) await testComp()
    if (want('stab')) await testStab()
    if (want('abort')) await testAbort()
  } catch (e) {
    check('beklenmeyen hata', false, e.stack || e.message)
    console.error(e)
  }
  R.totalMs = ms(T)
  log(`BİTTİ: ${R.ok} tamam, ${R.fail} hata · ${(R.totalMs / 1000).toFixed(1)} sn`, R.fail ? 'bad' : 'ok')
  try { fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from((await new Promise(r => sheet.toBlob(r))).arrayBuffer ? new Uint8Array(await (await new Promise(r => sheet.toBlob(r))).arrayBuffer()) : [])) } catch (e) { /* */ }
  window.__result = { ok: R.ok, fail: R.fail, timings: R.timings, failed: R.checks.filter(c => !c.ok), totalMs: R.totalMs }
  window.__done = true
})()
