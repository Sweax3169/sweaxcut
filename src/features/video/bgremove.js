// Arka plan kaldırma: kaynak → kişi maskesi (MediaPipe selfie segmenter) → alfa kanallı VP9 WebM türevi.
// Hat: ffmpeg (büyük RGBA kareler) + ffmpeg (küçük kareler, bölütleyici girişi) → zamansal yumuşatma →
// WebGL2'de maske büyütme + kenar yumuşatma (kaliteli: renk rehberli iki yönlü büyütme) → ffmpeg libvpx-vp9 yuva420p.
// Çıktı önizlemede de dışa aktarımda da orijinal yerine okunur (media.variants.bgremove); süre/kare zamanları aynıdır.

import { createSegmenter } from './mp.js'
import {
  probeVideo, FrameStream, FrameSink, getMedia, mediaCache, setVariant, exists, rm, fitSize,
  checkAbort, abortError, progressFn, tick, path, fs,
} from './util.js'
import { os } from '../../platform/node.js'
import { store, findClip } from '../../core/store.js'

export const BG_QUALITY = {
  hizli: { label: 'Hızlı', maxLong: 1280, maxShort: 720, segLong: 256, radius: 1, guided: false, roi: false, edge: [0.35, 0.65], crf: 34, cpu: 8 },
  // kaliteli: ikinci geçiş kişinin çevresindeki kare kırpıntıyı bölütler (küçük görünen kişide 2-3 kat çözünürlük)
  kaliteli: { label: 'Kaliteli', maxLong: 1920, maxShort: 1080, segLong: 640, radius: 2, guided: true, roi: true, edge: [0.3, 0.7], crf: 28, cpu: 6 },
}

const VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// Kare ve maske aynı satır sırasında (üst satır önce) yüklenir; readPixels de aynı sırayla okur → çevirme yok
const FS = `#version 300 es
precision highp float;
uniform sampler2D uFrame;
uniform sampler2D uMask;
uniform vec2 uMaskSize;
uniform vec2 uSize;
uniform float uLod;
uniform vec2 uEdge;
uniform float uSigmaC;
uniform int uGuided;
out vec4 o;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uFrame, px, 0);
  vec2 uv = gl_FragCoord.xy / uSize;
  float m;
  float mx = 0.0;
  if (uGuided == 1) {
    // renk rehberli iki yönlü büyütme (joint bilateral upsampling): kenar, karedeki renk sınırına oturur
    vec2 mp = uv * uMaskSize - 0.5;
    vec2 b = floor(mp);
    vec2 f = mp - b;
    float acc = 0.0, ws = 0.0;
    float inv2c = 1.0 / (2.0 * uSigmaC * uSigmaC);
    for (int j = -1; j <= 2; j++) {
      for (int i = -1; i <= 2; i++) {
        vec2 o2 = vec2(float(i), float(j));
        vec2 q = (b + o2 + 0.5) / uMaskSize;
        float mv = texture(uMask, q).r;
        vec3 g = textureLod(uFrame, q, uLod).rgb;
        vec2 d = f - o2;
        float wsp = exp(-dot(d, d) * 0.5);
        vec3 dc = c.rgb - g;
        float w = wsp * (exp(-dot(dc, dc) * inv2c) + 0.002);
        acc += w * mv;
        ws += w;
        mx = max(mx, mv);
      }
    }
    m = acc / max(ws, 1e-6);
  } else {
    m = texture(uMask, uv).r;
    vec2 t = 1.5 / uMaskSize;
    mx = max(max(m, texture(uMask, uv + vec2(t.x, 0.0)).r), texture(uMask, uv - vec2(t.x, 0.0)).r);
    mx = max(max(mx, texture(uMask, uv + vec2(0.0, t.y)).r), texture(uMask, uv - vec2(0.0, t.y)).r);
  }
  float a = smoothstep(uEdge.x, uEdge.y, m);
  // maskeden uzak tamamen saydam bölge: rengi sil (VP9 renk katmanı küçülür; kenara taşma olmaz)
  vec3 rgb = mx < 0.03 ? vec3(0.0) : c.rgb;
  o = vec4(rgb, a);
}`

// WebGL2 maske birleştirici: RGBA kare + R8 maske → düz (straight) alfalı RGBA
class MaskCompositor {
  constructor(W, H, mw, mh, q) {
    this.W = W; this.H = H; this.mw = mw; this.mh = mh; this.q = q
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H })
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('WebGL2 kullanılamıyor')
    this.gl = gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Gölgelendirici: ' + gl.getShaderInfoLog(s))
      return s
    }
    const p = gl.createProgram()
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p))
    this.prog = p
    gl.useProgram(p)
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1)

    this.frameTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.frameTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, q.guided ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.maskTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, mw, mh, 0, gl.RED, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.outTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.outTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    this.fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outTex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO eksik')

    const u = n => gl.getUniformLocation(p, n)
    gl.uniform1i(u('uFrame'), 0)
    gl.uniform1i(u('uMask'), 1)
    gl.uniform2f(u('uMaskSize'), mw, mh)
    gl.uniform2f(u('uSize'), W, H)
    gl.uniform1f(u('uLod'), Math.max(0, Math.log2(Math.max(W / mw, H / mh))))
    gl.uniform2f(u('uEdge'), q.edge[0], q.edge[1])
    gl.uniform1f(u('uSigmaC'), 0.12)
    gl.uniform1i(u('uGuided'), q.guided ? 1 : 0)
    gl.disable(gl.BLEND)
    gl.viewport(0, 0, W, H)
  }

  // frame: RGBA Buffer (W*H*4), mask8: Uint8Array (mw*mh), out: Buffer (W*H*4)
  process(frame, mask8, out) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.frameTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, frame)
    if (this.q.guided) gl.generateMipmap(gl.TEXTURE_2D)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.mw, this.mh, gl.RED, gl.UNSIGNED_BYTE, mask8)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, out)
  }

  dispose() {
    const gl = this.gl
    try {
      gl.deleteTexture(this.frameTex); gl.deleteTexture(this.maskTex); gl.deleteTexture(this.outTex)
      gl.deleteFramebuffer(this.fbo); gl.deleteProgram(this.prog)
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext()
    } catch (e) { /* */ }
  }
}

// Zamansal iki yönlü süzgeç: komşu karelerin maskeleri, merkez kareye benzedikleri ölçüde ortalamaya girer
// (titreşim gider, hızlı harekette hayalet iz kalmaz). Çıktı 0..255.
function temporalFilter(masks, center, radius, out8) {
  const m0 = masks[center]
  const n = m0.length
  const inv = 1 / (2 * 0.22 * 0.22)
  const ks = []
  for (let k = -radius; k <= radius; k++) {
    if (k === 0) continue
    const idx = Math.min(masks.length - 1, Math.max(0, center + k))
    if (idx === center) continue
    ks.push({ m: masks[idx], g: Math.exp(-(k * k) / (2 * Math.max(1, radius * 0.75) ** 2)) })
  }
  for (let p = 0; p < n; p++) {
    const v0 = m0[p]
    let acc = v0, ws = 1
    for (let j = 0; j < ks.length; j++) {
      const v = ks[j].m[p]
      const d = v - v0
      const w = ks[j].g * Math.exp(-d * d * inv)
      acc += w * v; ws += w
    }
    const r = acc / ws
    out8[p] = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0
  }
}

// Bölütleyiciyi çalıştır, maskeyi kopyala ({ m, w, h } ya da null)
function runSeg(task, img, ts) {
  let out = null
  task.segmentForVideo(img, ts, (res) => {
    const mk = pickMask(res.confidenceMasks)
    if (mk) out = { m: new Float32Array(mk.getAsFloat32Array()), w: mk.width, h: mk.height }
  })
  return out
}

// İlgi bölgesi (ROI) incelte: tam karedeki kaba maskeden kişinin kutusunu bul, kare kırpıntıyı yeniden bölütle,
// sonucu kenarları yumuşatarak kaba maskenin üstüne yerleştir. roiState kareler arası kutuyu yumuşatır.
function refineRoi(task, rgba, sw, sh, m, ts, st) {
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1, cnt = 0
  for (let y = 0; y < sh; y++) {
    const r = y * sw
    for (let x = 0; x < sw; x++) if (m[r + x] > 0.5) { cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (cnt < sw * sh * 0.002) { st.roi = null; return false }
  const lim = Math.min(sw, sh)
  const tgt = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(lim, Math.max(x1 - x0 + 1, y1 - y0 + 1) * 1.35 + 12) }
  const r = st.roi
  // büyürken hemen, küçülürken yavaş; merkez yumuşak (kırpıntı titremesin)
  st.roi = r ? { cx: r.cx + 0.5 * (tgt.cx - r.cx), cy: r.cy + 0.5 * (tgt.cy - r.cy), s: tgt.s > r.s ? tgt.s : r.s + 0.15 * (tgt.s - r.s) } : tgt
  const side = Math.max(32, Math.min(lim, Math.ceil(st.roi.s / 16) * 16))
  if (side * side > sw * sh * 0.85) return false
  const cx0 = Math.max(0, Math.min(sw - side, Math.round(st.roi.cx - side / 2)))
  const cy0 = Math.max(0, Math.min(sh - side, Math.round(st.roi.cy - side / 2)))
  if (!st.buf || st.buf.length !== side * side * 4) st.buf = new Uint8ClampedArray(side * side * 4)
  for (let y = 0; y < side; y++) {
    const so = ((cy0 + y) * sw + cx0) * 4
    st.buf.set(rgba.subarray(so, so + side * 4), y * side * 4)
  }
  const B = runSeg(task, new ImageData(st.buf, side, side), ts)
  if (!B || B.w !== side || B.h !== side) return false
  // kenarda kaba maskeye yumuşak geçiş (kırpıntı sınırı izi kalmasın) — çerçeve kenarına denk gelen taraf hariç
  const f = Math.max(4, side * 0.05)
  for (let y = 0; y < side; y++) {
    const gy = cy0 + y
    const dy = Math.min(cy0 === 0 ? 1e9 : y, cy0 + side === sh ? 1e9 : side - 1 - y)
    for (let x = 0; x < side; x++) {
      const gx = cx0 + x
      const dx = Math.min(cx0 === 0 ? 1e9 : x, cx0 + side === sw ? 1e9 : side - 1 - x)
      const w = Math.min(1, Math.min(dx, dy) / f)
      const i = gy * sw + gx
      m[i] = m[i] + (B.m[y * side + x] - m[i]) * w
    }
  }
  return true
}

function pickMask(masks) {
  if (!masks || !masks.length) return null
  // selfie_segmenter tek kanal (kişi olasılığı); çok kanallı modelde 1. sınıf kişi/ön plan
  return masks.length > 1 ? masks[1] : masks[0]
}

const running = new Map() // mediaId → Promise (aynı medya için ikinci çağrı aynı işi bekler)

// removeBackground(mediaId, { quality: 'hizli'|'kaliteli', onProgress, signal, busy }) → { path, ... }
export function removeBackground(mediaId, opts = {}) {
  const key = mediaId + ':' + (opts.quality || 'hizli')
  if (running.has(key)) return running.get(key)
  const p = doRemove(mediaId, opts).finally(() => running.delete(key))
  running.set(key, p)
  return p
}

async function doRemove(mediaId, { quality = 'hizli', onProgress, signal, busy = false, force = false } = {}) {
  const media = getMedia(mediaId)
  if (!media) throw new Error('Medya bulunamadı')
  if (media.type !== 'video') throw new Error('Arka plan kaldırma yalnızca videoda çalışır')
  const q = BG_QUALITY[quality] || BG_QUALITY.hizli
  const prog = progressFn(onProgress, busy ? 'Arka plan kaldırılıyor…' : null)
  const out = path.join(mediaCache(media), `bgremove-${quality}.webm`)
  const t0 = performance.now()
  try {
    if (!force && exists(out)) {
      setVariant(mediaId, 'bgremove', out)
      prog(1)
      return { path: out, cached: true, ms: 0 }
    }
    checkAbort(signal)
    prog(0)
    const info = await probeVideo(media.path)
    const { w: W, h: H } = fitSize(info.width, info.height, q.maxLong, q.maxShort)
    const ar = info.width / info.height
    const landscape = ar >= 1.4
    const seg = fitSize(info.width, info.height, q.segLong, q.segLong)
    const sw = seg.w, sh = seg.h
    const total = Math.max(1, Math.round(info.duration * info.F))

    const dec = (w, h, flags) => ['-v', 'error', '-nostdin', '-i', media.path, '-an', '-sn', '-dn',
      '-vf', `fps=${info.Fstr},scale=${w}:${h}:flags=${flags}:in_color_matrix=${info.matrix}:in_range=${info.range}:out_range=pc,format=rgba`,
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']
    const { task: segmenter, delegate } = await createSegmenter({ landscape })
    // kare kırpıntı için kare girişli model (ayrı örnek: zaman damgaları birbirinden bağımsız artar)
    let segRoi = null
    try {
      if (q.roi) segRoi = (await createSegmenter({ landscape: false })).task
      checkAbort(signal)
    } catch (e) {
      try { segmenter.close() } catch (e2) { /* */ }
      if (segRoi) { try { segRoi.close() } catch (e2) { /* */ } }
      throw e
    }
    const roiState = { roi: null, buf: null, used: 0 }

    const big = new FrameStream(dec(W, H, 'bicubic'), W * H * 4, { signal, highWater: 4 })
    const small = new FrameStream(dec(sw, sh, 'area'), sw * sh * 4, { signal, highWater: 8 })
    const tmp = out + '.tmp.webm'
    rm(tmp)
    const threads = Math.max(2, Math.min(16, (os && os.cpus().length) || 8))
    const sink = new FrameSink(['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', info.Fstr, '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuva420p',
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', String(q.crf),
      '-deadline', 'realtime', '-cpu-used', String(q.cpu), '-row-mt', '1', '-tile-columns', '2', '-threads', String(threads),
      '-g', String(Math.max(1, Math.round(info.F))),
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-an', '-f', 'webm', tmp], { signal })

    let comp = null
    const frames = [], masks = [] // kayan pencere; frames[0] mutlak indeksi = head
    let head = 0
    const outBufs = [Buffer.allocUnsafe(W * H * 4), Buffer.allocUnsafe(W * H * 4), Buffer.allocUnsafe(W * H * 4)]
    const writes = [null, null, null]
    let mw = 0, mh = 0, mask8 = null
    let inCount = 0, outCount = 0
    const stats = { seg: 0, gl: 0, wait: 0 }
    const msPerFrame = 1000 / info.F

    // mutlak indeksli kareyi süz + birleştir + kodlayıcıya yaz
    const emit = async (abs) => {
      const center = abs - head
      temporalFilter(masks, center, q.radius, mask8)
      const slot = outCount % 3
      if (writes[slot]) { const tw = performance.now(); await writes[slot]; stats.wait += performance.now() - tw }
      const tg = performance.now()
      comp.process(frames[center], mask8, outBufs[slot])
      stats.gl += performance.now() - tg
      writes[slot] = sink.write(outBufs[slot])
      outCount++
      if (outCount % 4 === 0) prog(Math.min(0.99, outCount / total))
    }

    try {
      for (;;) {
        checkAbort(signal)
        const tw = performance.now()
        const [fb, sb] = await Promise.all([big.next(), small.next()])
        stats.wait += performance.now() - tw
        if (!fb || !sb) {
          if (fb) big.recycle(fb)
          if (sb) small.recycle(sb)
          if (fb || sb) console.warn('arka plan: kare sayıları farklı', big.count, small.count)
          big.close(); small.close()
          break
        }
        // bölütle (küçük kare)
        const ts = performance.now()
        const img = new ImageData(new Uint8ClampedArray(sb.buffer, sb.byteOffset, sw * sh * 4), sw, sh)
        const fts = (inCount + 1) * msPerFrame
        const A = runSeg(segmenter, img, fts)
        let m = null
        if (A) {
          if (!mw) { mw = A.w; mh = A.h }
          m = A.m
          if (segRoi && A.w === sw && A.h === sh && refineRoi(segRoi, sb, sw, sh, m, fts, roiState)) roiState.used++
        }
        stats.seg += performance.now() - ts
        small.recycle(sb)
        if (!comp) {
          if (!mw) { mw = sw; mh = sh }
          comp = new MaskCompositor(W, H, mw, mh, q)
          mask8 = new Uint8Array(mw * mh)
        }
        if (!m || m.length !== mw * mh) m = new Float32Array(mw * mh).fill(1)
        frames.push(fb); masks.push(m)
        inCount++
        // yarıçap kadar ileri kare geldi: merkez kareyi yaz, artık gerekmeyenleri bırak
        const abs = inCount - 1 - q.radius
        if (abs >= 0) {
          await emit(abs)
          while (head < abs + 1 - q.radius) { big.recycle(frames.shift()); masks.shift(); head++ }
        }
        if (inCount % 8 === 0) await tick()
      }
      // kalan son kareler
      for (let abs = Math.max(0, inCount - q.radius); abs < inCount; abs++) await emit(abs)
      for (const w of writes) if (w) await w
      const code = await sink.end()
      await Promise.all([big.done, small.done])
      checkAbort(signal)
      if (code !== 0 || !exists(tmp)) throw new Error('VP9 kodlama başarısız: ' + sink.err.slice(-300))
      if (big.code !== 0 && !outCount) throw new Error('Kod çözme başarısız: ' + big.err.slice(-300))
      rm(out)
      fs.renameSync(tmp, out)
    } catch (e) {
      big.close(); small.close(); sink.kill()
      await Promise.allSettled([big.done, small.done, sink.done])
      rm(tmp)
      if (signal && signal.aborted) throw abortError()
      throw e
    } finally {
      if (comp) comp.dispose()
      try { segmenter.close() } catch (e) { /* */ }
      if (segRoi) { try { segRoi.close() } catch (e) { /* */ } }
    }
    setVariant(mediaId, 'bgremove', out)
    prog(1)
    const ms = performance.now() - t0
    let size = 0
    try { size = fs.statSync(out).size } catch (e) { /* */ }
    return {
      path: out, cached: false, ms, frames: outCount, fps: info.F, width: W, height: H, maskW: mw, maskH: mh, delegate, size, roiFrames: roiState.used,
      speed: outCount / (ms / 1000), stats: { segMs: stats.seg / Math.max(1, outCount), glMs: stats.gl / Math.max(1, outCount), waitMs: stats.wait / Math.max(1, outCount) },
    }
  } finally {
    if (busy) store.busy(null)
  }
}

// Klibin arka plan kaldırmasını aç/kapat (gerekirse türevi üretir)
export async function setClipBgRemove(clipId, on, opts = {}) {
  const f = findClip(store.get().project, clipId)
  if (!f || f.clip.type !== 'video') throw new Error('Video klibi seçin')
  if (on) await removeBackground(f.clip.mediaId, opts)
  store.edit(on ? 'Arka planı kaldır' : 'Arka planı geri getir', d => {
    for (const t of d.tracks) for (const c of t.clips) if (c.id === clipId) c.bgRemove = !!on
  })
}
