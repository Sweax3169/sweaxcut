// Otomatik kadraj (auto reframe): 16:9 → 9:16 vb. Klibin karelerini düşük çözünürlükte tarar, öznenin yerini bulur,
// kamera yolunu yumuşatır ve klibe transform.x (ya da y) anahtar kareleri yazar; klip tuvali "cover" ile doldurur.
// Özne: yüz (MediaPipe FaceDetector) varsa yüz; yoksa hareket + sabit olmayan kenar enerjisi (HUD bastırılır) + merkez eğilimi.
// Yol: konum ızgarasında Viterbi (taşıma cezası, sahne kesmesinde ceza yok) → sıfır fazlı yumuşatma → RDP ile seyreltme.

import { store, findClip } from '../../core/store.js'
import { RATIOS } from '../../core/model.js'
import { sourceTime } from '../../core/time.js'
import { createFaceDetector } from './mp.js'
import { FrameStream, probeVideo, getMedia, fitSize, checkAbort, abortError, progressFn, tick, sourceToLocal } from './util.js'

export const REFRAME_MODES = {
  yuz: { label: 'Yüz takibi', hint: 'Yüz varsa yüzü, yoksa hareketi izler' },
  hareket: { label: 'Hareket / aksiyon', hint: 'Oyun kaydı: aksiyonu ve nişangâh bölgesini izler' },
  merkez: { label: 'Sabit merkez', hint: 'Analiz yok, ortadan kırpar' },
}

const GW = 64 // analiz ızgarası (uzun kenar hücre sayısı)

function parseRatio(r) {
  if (r == null || r === '') return null
  if (typeof r === 'number') return r > 0 ? r : null
  const s = String(r).trim()
  const m = /^([\d.]+)\s*[:/x]\s*([\d.]+)$/.exec(s)
  if (m) return +m[1] / +m[2]
  return +s > 0 ? +s : null
}

// ------------------------------------------------------------ kare özellikleri
function analyzeFrame(rgba, w, h, gray, prev, gw, gh, motion, edge) {
  const n = w * h
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8
  motion.fill(0); edge.fill(0)
  const cx = gw / w, cy = gh / h
  let diffSum = 0
  for (let y = 1; y < h - 1; y++) {
    const gy = Math.min(gh - 1, (y * cy) | 0)
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const i = row + x
      const gx = Math.min(gw - 1, (x * cx) | 0)
      const cell = gy * gw + gx
      // Sobel
      const a = gray[i - w - 1], b = gray[i - w], c = gray[i - w + 1]
      const d = gray[i - 1], f = gray[i + 1]
      const g = gray[i + w - 1], hh = gray[i + w], k = gray[i + w + 1]
      const sx = (c + 2 * f + k) - (a + 2 * d + g)
      const sy = (g + 2 * hh + k) - (a + 2 * b + c)
      edge[cell] += Math.abs(sx) + Math.abs(sy)
      if (prev) {
        const df = Math.abs(gray[i] - prev[i])
        diffSum += df
        if (df > 10) motion[cell] += df
      }
    }
  }
  return prev ? diffSum / ((w - 2) * (h - 2) * 255) : 0
}

// pencere (merkez c, genişlik v) içindeki kütle — önek toplamı + doğrusal ara değer
function windowMass(prefix, G, c, v) {
  const at = (u) => {
    const x = Math.max(0, Math.min(G, u * G))
    const i = Math.min(G - 1, Math.floor(x))
    return prefix[i] + (prefix[i + 1] - prefix[i]) * (x - i)
  }
  return at(c + v / 2) - at(c - v / 2)
}

// sıfır fazlı üstel yumuşatma (ileri + geri, iki tur). Uçlar tek yansımayla uzatılır (filtfilt gibi):
// sahne başında/sonunda süren hareket merkeze çekilmez.
function smoothSegment(arr, a, pad) {
  const n = arr.length
  if (n < 3) return
  const m = Math.max(1, Math.min(n - 1, pad))
  const x = new Float64Array(n + 2 * m)
  for (let i = 0; i < m; i++) { x[m - 1 - i] = 2 * arr[0] - arr[i + 1]; x[m + n + i] = 2 * arr[n - 1] - arr[n - 2 - i] }
  for (let i = 0; i < n; i++) x[m + i] = arr[i]
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < x.length; i++) x[i] = x[i - 1] + a * (x[i] - x[i - 1])
    for (let i = x.length - 2; i >= 0; i--) x[i] = x[i + 1] + a * (x[i] - x[i + 1])
  }
  for (let i = 0; i < n; i++) arr[i] = x[m + i]
}

// Ramer–Douglas–Peucker: [{t,v}] → seyrek anahtar kareler
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice()
  const keep = new Uint8Array(pts.length)
  keep[0] = 1; keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const pa = pts[a], pb = pts[b]
    let best = -1, bi = -1
    for (let i = a + 1; i < b; i++) {
      const k = (pts[i].t - pa.t) / Math.max(1e-9, pb.t - pa.t)
      const d = Math.abs(pts[i].v - (pa.v + (pb.v - pa.v) * k))
      if (d > best) { best = d; bi = i }
    }
    if (best > eps && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

// autoReframe(clipId, { targetRatio, smoothing 0..1, mode 'yuz'|'hareket'|'merkez', onProgress, signal })
export async function autoReframe(clipId, { targetRatio = null, smoothing = 0.6, mode = 'yuz', onProgress, signal, busy = false, centerBias = 0.35 } = {}) {
  const t0 = performance.now()
  const prog = progressFn(onProgress, busy ? 'Otomatik kadraj…' : null)
  try {
    const f = findClip(store.get().project, clipId)
    if (!f || (f.clip.type !== 'video' && f.clip.type !== 'image')) throw new Error('Bir video klibi seçin')
    const clip = f.clip
    const media = getMedia(clip.mediaId)
    if (!media) throw new Error('Medya bulunamadı')
    smoothing = Math.max(0, Math.min(1, +smoothing))

    // hedef tuval
    const st0 = store.get().project.settings
    let W = st0.width, H = st0.height
    let newSettings = null
    const want = parseRatio(targetRatio)
    if (want && Math.abs(want - W / H) / (W / H) > 0.01) {
      const r = RATIOS.find(x => Math.abs(x.w / x.h - want) < 0.005)
      if (r) newSettings = { ratio: r.id, width: r.w, height: r.h }
      else { const hh = 1080; const ww = Math.round(hh * want / 2) * 2; newSettings = { ratio: 'custom', width: want >= 1 ? ww : 1080, height: want >= 1 ? hh : Math.round(1080 / want / 2) * 2 } }
      W = newSettings.width; H = newSettings.height
    }

    // geometri (bileşimciyle aynı): cover → taban boyut; görünür oran = pencere genişliği
    let sw = media.width || 1920, sh = media.height || 1080
    let info = null
    if (media.type === 'video') { info = await probeVideo(media.path); sw = info.width; sh = info.height }
    const crop = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
    const cw = sw * (1 - crop.l - crop.r), ch = sh * (1 - crop.t - crop.b)
    const mediaAR = cw / Math.max(1, ch), canvasAR = W / H
    const hasScaleKeys = !!(clip.keyframes && clip.keyframes['transform.scale'] && clip.keyframes['transform.scale'].length)
    const s = Math.max(1, Math.abs(clip.transform.scale || 1))
    let axis, baseW, baseH
    if (mediaAR > canvasAR) { axis = 'x'; baseH = H; baseW = H * mediaAR } else { axis = 'y'; baseW = W; baseH = W / mediaAR }
    const disp = axis === 'x' ? baseW * s : baseH * s
    const span = axis === 'x' ? W : H
    const vis = Math.min(1, span / disp) // pencerenin (kırpılmış) kaynağa oranı
    const flip = axis === 'x' ? !!clip.transform.flipH : !!clip.transform.flipV
    const cropLo = axis === 'x' ? crop.l : crop.t, cropHi = axis === 'x' ? crop.r : crop.b
    const maxOff = Math.max(0, (disp - span) / (2 * span))
    // u (tam kaynakta 0..1 merkez) → transform değeri
    const toVal = (u) => {
      let uc = (u - cropLo) / Math.max(1e-6, 1 - cropLo - cropHi)
      if (flip) uc = 1 - uc
      const v = -(uc - 0.5) * disp / span
      return Math.max(-maxOff, Math.min(maxOff, v))
    }
    const prop = 'transform.' + axis
    const other = axis === 'x' ? 'transform.y' : 'transform.x'

    const apply = (keys, staticVal, label) => {
      store.edit(label, d => {
        if (newSettings) Object.assign(d.settings, newSettings)
        let dc = null
        for (const t of d.tracks) { const x = t.clips.find(y => y.id === clipId); if (x) { dc = x; break } }
        if (!dc) return
        dc.fit = 'cover'
        if (!hasScaleKeys) dc.transform.scale = s
        dc.transform[axis] = staticVal
        dc.transform[other.split('.')[1]] = 0
        if (!dc.keyframes) dc.keyframes = {}
        delete dc.keyframes[other]
        if (keys && keys.length > 1) dc.keyframes[prop] = keys
        else delete dc.keyframes[prop]
      })
    }

    // oranlar zaten aynı ya da sabit merkez → analiz yok
    if (vis > 0.985 || mode === 'merkez' || media.type !== 'video' || clip.freeze) {
      apply(null, 0, 'Otomatik kadraj')
      prog(1)
      return { axis, keys: 0, frames: 0, usedFaces: false, cuts: [], ms: performance.now() - t0, mode: 'merkez' }
    }

    // ---------------------------------------------------- analiz kareleri
    const lo = Math.max(0, Math.min(clip.in, clip.out)), hi = Math.min(info.duration || media.duration || 1e9, Math.max(clip.in, clip.out))
    const srcSpan = Math.max(0.05, hi - lo)
    const avgSpeed = srcSpan / Math.max(0.05, clip.duration)
    let afps = Math.max(2, Math.min(15, 5 * avgSpeed))
    afps = Math.min(afps, 2400 / srcSpan) // uzun kliplerde bellek sınırı
    afps = Math.max(0.5, Math.round(afps * 100) / 100)
    const { w: aw, h: ah } = fitSize(sw, sh, 320, 320)
    const gw = sw >= sh ? GW : Math.max(8, Math.round(GW * sw / sh))
    const gh = sw >= sh ? Math.max(8, Math.round(GW * sh / sw)) : GW
    const expected = Math.max(1, Math.round(srcSpan * afps))
    const stream = new FrameStream(['-v', 'error', '-nostdin', '-ss', lo.toFixed(3), '-t', srcSpan.toFixed(3), '-i', media.path, '-an', '-sn', '-dn',
      '-vf', `fps=${afps},scale=${aw}:${ah}:flags=area:in_color_matrix=${info.matrix}:in_range=${info.range}:out_range=pc,format=rgba`,
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], aw * ah * 4, { signal, highWater: 8 })

    let face = null, delegate = null
    if (mode === 'yuz') {
      try { const r = await createFaceDetector(); face = r.task; delegate = r.delegate } catch (e) { console.warn('yüz algılayıcı açılamadı', e) }
    }
    const gray = new Uint8Array(aw * ah), prevGray = new Uint8Array(aw * ah)
    const motions = [], edges = [], diffs = [], faces = []
    let n = 0
    try {
      for (;;) {
        checkAbort(signal)
        const fr = await stream.next()
        if (!fr) break
        const mo = new Float32Array(gw * gh), ed = new Float32Array(gw * gh)
        const df = analyzeFrame(fr, aw, ah, gray, n ? prevGray : null, gw, gh, mo, ed)
        prevGray.set(gray)
        motions.push(mo); edges.push(ed); diffs.push(df)
        if (face) {
          const img = new ImageData(new Uint8ClampedArray(fr.buffer, fr.byteOffset, aw * ah * 4), aw, ah)
          let list = []
          try {
            const res = face.detectForVideo(img, (n + 1) * (1000 / afps))
            list = (res.detections || []).map(dd => {
              const b = dd.boundingBox
              return { cx: (b.originX + b.width / 2) / aw, cy: (b.originY + b.height / 2) / ah, w: b.width / aw, h: b.height / ah, score: (dd.categories && dd.categories[0] && dd.categories[0].score) || 0.5 }
            }).filter(x => x.w > 0.015)
          } catch (e) { /* tek kare */ }
          faces.push(list)
        } else faces.push([])
        stream.recycle(fr)
        n++
        if (n % 6 === 0) { prog(Math.min(0.85, (n / expected) * 0.85)); await tick() }
      }
      await stream.done
    } finally {
      stream.close()
      if (face) { try { face.close() } catch (e) { /* */ } }
    }
    checkAbort(signal)
    if (n < 2) throw new Error('Analiz için kare okunamadı: ' + stream.err.slice(-200))
    if (motions.length > 1) motions[0].set(motions[1])

    // ---------------------------------------------------- sahne kesmeleri (ani tam kare değişimi)
    const cutAt = new Uint8Array(n) // cutAt[k]=1 → k-1 ile k arasında kesme
    for (let k = 1; k < n; k++) {
      const loc = []
      for (let j = Math.max(1, k - 4); j <= Math.min(n - 1, k + 4); j++) if (j !== k) loc.push(diffs[j])
      loc.sort((a, b) => a - b)
      const med = loc.length ? loc[loc.length >> 1] : 0
      if (diffs[k] > 0.1 && diffs[k] > med * 3 + 0.03) cutAt[k] = 1
    }
    // kesme karesinin hareket haritası anlamsız: komşudan al
    for (let k = 1; k < n; k++) if (cutAt[k]) motions[k].set(k + 1 < n ? motions[k + 1] : motions[k - 1])
    // üç kare farkı: (k-1,k) ve (k,k+1) farklarının ikisinde de değişen hücre = öznenin k anındaki yeri
    // (tek fark eski ve yeni konumu birlikte işaretler → yarım adım gecikme)
    for (let k = 0; k < n - 1; k++) {
      if (cutAt[k + 1]) continue
      const a = motions[k], b = motions[k + 1]
      for (let c = 0; c < a.length; c++) if (b[c] < a[c]) a[c] = b[c]
    }

    // ---------------------------------------------------- belirginlik profili
    const G = axis === 'x' ? gw : gh
    const cells = gw * gh
    // sahne başına ortalama kenar haritası (HUD ve sabit desenler bastırılır)
    const segStart = [0]
    for (let k = 1; k < n; k++) if (cutAt[k]) segStart.push(k)
    const segOf = new Int32Array(n)
    const segMeans = segStart.map((a, si) => {
      const b = si + 1 < segStart.length ? segStart[si + 1] : n
      const m = new Float32Array(cells)
      for (let k = a; k < b; k++) { segOf[k] = si; const e = edges[k]; for (let c = 0; c < cells; c++) m[c] += e[c] }
      for (let c = 0; c < cells; c++) m[c] /= Math.max(1, b - a)
      return { m, len: b - a }
    })
    let moTot = 0, edTot = 0
    for (let k = 0; k < n; k++) { let a = 0; const mo = motions[k]; for (let c = 0; c < cells; c++) a += mo[c]; moTot += a }
    const moMean = moTot / n
    const faceFrames = faces.filter(l => l.length).length
    const useFaces = mode === 'yuz' && faceFrames >= Math.max(2, n * 0.12)
    const prior = new Float32Array(G)
    for (let i = 0; i < G; i++) { const u = (i + 0.5) / G - 0.5; prior[i] = 1 - centerBias + centerBias * Math.exp(-(u * u) / (2 * 0.22 * 0.22)) }
    const profiles = [], raws = []
    const edArr = new Float32Array(cells)
    for (let k = 0; k < n; k++) {
      const mo = motions[k], ed = edges[k], em = segMeans[segOf[k]]
      // sabit sahne (tek kareli) → kenar bastırma yapılamaz
      const sup = em.len > 3 ? 1 : 0
      let eSum = 0, mSum = 0
      for (let c = 0; c < cells; c++) { const v = Math.max(0, ed[c] - sup * em.m[c] * 1.05); edArr[c] = v; eSum += v; mSum += mo[c] }
      edTot += eSum
      const mDen = Math.max(mSum, moMean * 0.35, 1e-6)
      const eDen = Math.max(eSum, 1e-6)
      const prof = new Float32Array(G)
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const c = gy * gw + gx
          const v = 0.65 * mo[c] / mDen + 0.35 * edArr[c] / eDen
          prof[axis === 'x' ? gx : gy] += v
        }
      }
      if (useFaces) {
        const fl = faces[k]
        const fw = 3 / Math.max(1, fl.length)
        for (const fc of fl) {
          const c = axis === 'x' ? fc.cx : fc.cy
          const sg = Math.max(0.02, (axis === 'x' ? fc.w : fc.h) * 0.6)
          for (let i = 0; i < G; i++) { const u = (i + 0.5) / G - c; prof[i] += fw * fc.score * Math.exp(-(u * u) / (2 * sg * sg)) / (sg * G * 2.5066) }
        }
      }
      raws.push(Float32Array.from(prof))
      for (let i = 0; i < G; i++) prof[i] = prof[i] * prior[i] + 1e-4
      profiles.push(prof)
    }
    void edTot
    prog(0.88)

    // ---------------------------------------------------- Viterbi: pencere merkezi
    const P = 49
    const cLo = vis / 2, cHi = 1 - vis / 2
    const cand = new Float32Array(P)
    for (let j = 0; j < P; j++) cand[j] = cLo + (cHi - cLo) * (j / (P - 1))
    const lambda = (0.6 + 5 * smoothing) // tüm aralığı geçmenin bedeli (kare puanı 0..1)
    const range = Math.max(1e-6, cHi - cLo)
    const prefix = new Float32Array(G + 1)
    let score = new Float32Array(P), next = new Float32Array(P)
    const back = new Uint16Array(n * P)
    const frameScore = (k, out) => {
      const prof = profiles[k]
      prefix[0] = 0
      for (let i = 0; i < G; i++) prefix[i + 1] = prefix[i] + prof[i]
      let mx = 0
      for (let j = 0; j < P; j++) { out[j] = windowMass(prefix, G, cand[j], vis); if (out[j] > mx) mx = out[j] }
      let mn = Infinity
      for (let j = 0; j < P; j++) if (out[j] < mn) mn = out[j]
      const den = Math.max(1e-9, mx - mn)
      for (let j = 0; j < P; j++) out[j] = (out[j] - mn) / den
    }
    const fs = new Float32Array(P)
    frameScore(0, score)
    for (let k = 1; k < n; k++) {
      frameScore(k, fs)
      const pen = cutAt[k] ? 0 : lambda / range
      for (let j = 0; j < P; j++) {
        let best = -Infinity, bi = 0
        for (let i = 0; i < P; i++) {
          const v = score[i] - pen * Math.abs(cand[j] - cand[i])
          if (v > best) { best = v; bi = i }
        }
        next[j] = best + fs[j]
        back[k * P + j] = bi
      }
      const t = score; score = next; next = t
    }
    let bj = 0
    for (let j = 1; j < P; j++) if (score[j] > score[bj]) bj = j
    const path = new Float32Array(n)
    for (let k = n - 1; k >= 0; k--) { path[k] = cand[bj]; if (k > 0) bj = back[k * P + bj] }

    // ---------------------------------------------------- inceltme: Viterbi hangi özneyi seçtiyse pencere içinde onun ağırlık merkezine otur
    // (L1 cezalı yol "tembel" izler — özne pencerenin kenarına yapışır; merkez kayması bunu giderir)
    for (let k = 0; k < n; k++) {
      const raw = raws[k]
      const a0 = Math.max(0, Math.floor((path[k] - vis / 2) * G)), a1 = Math.min(G - 1, Math.ceil((path[k] + vis / 2) * G) - 1)
      if (a1 <= a0) continue
      const vals = []
      let tot = 0
      for (let i = 0; i < G; i++) tot += raw[i]
      for (let i = a0; i <= a1; i++) vals.push(raw[i])
      vals.sort((x, y) => x - y)
      const floor = vals[Math.floor(vals.length * 0.3)] || 0
      let ws = 0, acc = 0
      for (let i = a0; i <= a1; i++) { const w = Math.max(0, raw[i] - floor); ws += w; acc += w * (i + 0.5) / G }
      if (ws > tot * 0.04 && ws > 1e-6) path[k] = Math.max(cLo, Math.min(cHi, acc / ws))
    }

    // ---------------------------------------------------- yumuşatma (sahne içinde)
    const tau = 0.12 + 1.1 * smoothing
    const a = 1 - Math.exp(-(1 / afps) / tau)
    for (let si = 0; si < segStart.length; si++) {
      const s0 = segStart[si], s1 = si + 1 < segStart.length ? segStart[si + 1] : n
      const seg = Array.from(path.subarray(s0, s1))
      smoothSegment(seg, a, Math.ceil(3 * tau * afps))
      for (let k = s0; k < s1; k++) path[k] = Math.max(cLo, Math.min(cHi, seg[k - s0]))
    }
    prog(0.94)

    // ---------------------------------------------------- yerel zamana anahtar kareler
    const srcT = k => lo + k / afps
    const uAt = (st) => {
      const x = (st - lo) * afps
      if (x <= 0) return path[0]
      if (x >= n - 1) return path[n - 1]
      const i = Math.floor(x)
      // kesme arasını ara değerleme
      if (cutAt[i + 1]) return x - i < 0.5 ? path[i] : path[i + 1]
      return path[i] + (path[i + 1] - path[i]) * (x - i)
    }
    const D = clip.duration
    const fpsP = store.get().project.settings.fps || 30
    const step = 1 / Math.max(2, Math.min(10, afps / avgSpeed))
    const pts = []
    const cutLocals = []
    for (let k = 1; k < n; k++) {
      if (!cutAt[k]) continue
      const lt = sourceToLocal(clip, (srcT(k - 1) + srcT(k)) / 2)
      if (lt != null && lt > 0.02 && lt < D - 0.02) cutLocals.push(lt)
    }
    cutLocals.sort((x, y) => x - y)
    for (let lt = 0; lt <= D + 1e-6; lt += step) pts.push({ t: Math.min(D, lt), v: toVal(uAt(sourceTime(clip, Math.min(D, lt)))) })
    if (pts[pts.length - 1].t < D - 1e-3) pts.push({ t: D, v: toVal(uAt(sourceTime(clip, D))) })
    // kesmeleri ayrı tut: her parça kendi içinde seyreltilir, kesmede 'hold' ile sıçrar
    const bounds = [0, ...cutLocals, D + 1]
    let keys = []
    for (let i = 0; i < bounds.length - 1; i++) {
      const a0 = bounds[i], a1 = bounds[i + 1]
      const part = pts.filter(p => p.t >= a0 - 1e-6 && p.t < a1 - 1e-6)
      if (i > 0) part.unshift({ t: a0, v: toVal(uAt(sourceTime(clip, Math.min(D, a0 + 1 / fpsP)))) })
      if (i < bounds.length - 2) part.push({ t: Math.max(a0, a1 - 1 / fpsP), v: toVal(uAt(sourceTime(clip, Math.max(0, a1 - 1.5 / fpsP)))) })
      const simp = rdp(part, 0.003)
      simp.forEach((p, j) => keys.push({ t: Math.round(p.t * 1000) / 1000, v: Math.round(p.v * 10000) / 10000, ease: i > 0 && j === 0 ? 'hold' : 'linear' }))
    }
    keys.sort((x, y) => x.t - y.t)
    // aynı zamanlı kopyaları at
    keys = keys.filter((k, i) => i === 0 || k.t - keys[i - 1].t > 1 / 240)

    const label = 'Otomatik kadraj'
    apply(keys, keys.length ? keys[0].v : 0, label)
    prog(1)
    return {
      axis, keys: keys.length, frames: n, afps, usedFaces: useFaces, faceFrames, delegate,
      cuts: cutLocals.map(t => Math.round((clip.start + t) * 1000) / 1000), ms: performance.now() - t0, mode: useFaces ? 'yuz' : 'hareket',
      path: Array.from(path), visible: vis, srcStart: lo,
    }
  } catch (e) {
    if (signal && signal.aborted) throw abortError()
    throw e
  } finally {
    if (busy) store.busy(null)
  }
}
