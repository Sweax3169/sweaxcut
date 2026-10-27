// Dışa aktarma kaynakları: görünen her video klibi için tembel başlatılan bir ClipDecoder, resimler için tek seferlik çözüm.
// Bileşimcinin eşzamanlı sources arayüzünü (videoFrame / image) karşılar; kareler render'dan ÖNCE load(t) ile hazırlanır.

import { fs, fileUrl } from '../../platform/node.js'
import { sourceTime } from '../../core/time.js'
import { transitionWindow } from '../../core/timeline.js'
import { clipSourcePath } from '../../core/media.js'
import { probeJson } from './proc.js'
import { ClipDecoder } from './decoder.js'

const EPS = 1e-4
const STD_RATES = [[23.976, '24000/1001'], [29.97, '30000/1001'], [47.952, '48000/1001'], [59.94, '60000/1001'], [119.88, '120000/1001']]
const HDR_TRC = ['smpte2084', 'arib-std-b67']

function parseRate(s) {
  if (!s || s === '0/0') return 0
  const [n, d] = String(s).split('/').map(Number)
  return d ? n / d : n || 0
}

function exists(p) { try { return !!p && fs.statSync(p).size > 0 } catch (e) { return false } }

const infoCache = new Map()   // dosya|boyut|mtime → bilgi

// Video dosyası için çözüm bilgisi: kare hızı (rasyonel), renk, kare sayısı, alfa
export async function videoInfo(file, media = {}) {
  let key = file
  try { const st = fs.statSync(file); key = file + '|' + st.size + '|' + st.mtimeMs } catch (e) { /* */ }
  if (infoCache.has(key)) return infoCache.get(key)
  const j = await probeJson(file)
  const streams = (j && j.streams) || []
  const v = streams.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic)) || {}
  const r = parseRate(v.r_frame_rate), avg = parseRate(v.avg_frame_rate)
  let F = (r > 0 && r <= 240 && (!avg || Math.abs(r - avg) / r < 0.05)) ? r : (avg > 0 && avg <= 240 ? avg : (media.fps || 30))
  F = Math.max(1, Math.min(240, F))
  let Fstr = String(Math.round(F * 1000) / 1000)
  const src = (r > 0 && Math.abs(r - F) < 1e-3) ? v.r_frame_rate : (avg > 0 && Math.abs(avg - F) < 1e-3) ? v.avg_frame_rate : null
  if (src && /^\d+\/\d+$/.test(src)) Fstr = src
  else for (const [f, s] of STD_RATES) if (Math.abs(F - f) < 0.01) { F = parseRate(s); Fstr = s }
  if (/^\d+\/\d+$/.test(Fstr)) F = parseRate(Fstr)
  let rotation = 0
  if (v.tags && v.tags.rotate) rotation = +v.tags.rotate
  const sd = (v.side_data_list || []).find(x => x.rotation != null)
  if (sd) rotation = -(+sd.rotation)
  rotation = ((rotation % 360) + 360) % 360
  let width = v.width || media.width || 1280, height = v.height || media.height || 720
  if (rotation === 90 || rotation === 270) [width, height] = [height, width]
  const duration = +(v.duration) || +(j && j.format && j.format.duration) || media.duration || 0
  const nb = +v.nb_frames || 0
  const pix = v.pix_fmt || ''
  const cs = v.color_space || ''
  let matrix = /bt2020/.test(cs) ? 'bt2020' : /bt709/.test(cs) ? 'bt709' : /(bt470|smpte170|bt601|fcc)/.test(cs) ? 'bt601' : (height >= 720 || width >= 1280 ? 'bt709' : 'bt601')
  const range = (v.color_range === 'pc' || /^yuvj/.test(pix)) ? 'pc' : 'tv'
  const alpha = /^(yuva|rgba|bgra|argb|abgr|gbrap|ya|pal8)/.test(pix) || (v.tags && (v.tags.alpha_mode === '1' || v.tags.ALPHA_MODE === '1'))
  const hdr = HDR_TRC.includes(v.color_transfer)
  const info = {
    F, Fstr, width, height, duration, rotation, codec: v.codec_name || '', pix, matrix, range, alpha, hdr,
    frames: nb > 0 ? nb : Math.max(1, Math.round(duration * F)),
    webm: /\.webm$/i.test(file),
  }
  infoCache.set(key, info)
  return info
}

function maxKey(clip, p, base) {
  let v = base
  const ks = clip.keyframes && clip.keyframes[p]
  if (ks) for (const k of ks) v = Math.max(v, Math.abs(+k.v || 0))
  return v
}

export class ExportSources {
  // opts: { width, height (dışa aktarma px), fps, warn, still }
  constructor(project, opts) {
    this.project = project
    this.width = opts.width
    this.height = opts.height
    this.fps = opts.fps
    this.warn = opts.warn || (() => {})
    this.still = !!opts.still
    this.decs = new Map()       // clipId → ClipDecoder
    this.images = new Map()     // mediaId → {src,w,h}
    this.infos = new Map()      // mediaId|dosya → videoInfo
    this.cur = new Map()        // clipId → görünüm (bu kare)
    this.warned = new Set()
    const tracks = project.tracks
    const mi = tracks.findIndex(t => t.main)
    this.visTracks = []
    for (let i = (mi < 0 ? tracks.length - 1 : mi); i >= 0; i--) {
      const t = tracks[i]
      if (t.kind !== 'audio' && t.kind !== 'effect' && !t.hidden) this.visTracks.push(t)
    }
    this.api = {
      videoFrame: (clip) => this._videoFrame(clip),
      image: (media) => (media && this.images.get(media.id)) || null,
    }
  }

  _warnOnce(key, msg) { if (!this.warned.has(key)) { this.warned.add(key); this.warn(msg) } }

  // t anında bileşimcinin isteyeceği video klipleri (compositor.render ile aynı mantık)
  visible(t) {
    const out = []
    const push = (c) => {
      if (c.type !== 'video') return
      const m = this.project.media[c.mediaId]
      if (!m || m.type !== 'video') return
      out.push({ clip: c, media: m, lt: t - c.start })
    }
    for (const track of this.visTracks) {
      let handled = false
      for (const c of track.clips) {
        if (!c.transition) continue
        const win = transitionWindow(track, c)
        if (win && t >= win.start && t < win.end) { push(win.from); push(win.to); handled = true; break }
      }
      if (handled) continue
      for (const c of track.clips) if (t >= c.start - EPS && t < c.start + c.duration - EPS) push(c)
    }
    return out
  }

  // Aralıkta kullanılan medyayı hazırla: video bilgisi (ffprobe), resimler
  async prepare(t0, t1) {
    const p = this.project
    const imgIds = new Set()
    const vids = new Map()
    if (p.settings.bg && p.settings.bg.type === 'image' && p.settings.bg.mediaId) imgIds.add(p.settings.bg.mediaId)
    for (const track of p.tracks) {
      if (track.kind === 'audio') continue
      for (const c of track.clips) {
        if (c.start > t1 + 1 || c.start + c.duration < t0 - 1) continue
        const m = c.mediaId && p.media[c.mediaId]
        if (m && (m.type === 'image' || c.type === 'image')) imgIds.add(m.id)
        else if (m && m.type === 'video' && c.type === 'video') {
          const sp = clipSourcePath(c, m, { preview: false })
          if (sp.path && !vids.has(sp.path)) vids.set(sp.path, m)
        }
        if (c.sticker && c.sticker.mediaId) imgIds.add(c.sticker.mediaId)
        if (c.canvasBg && c.canvasBg.type === 'image' && c.canvasBg.mediaId) imgIds.add(c.canvasBg.mediaId)
      }
    }
    const jobs = []
    for (const id of imgIds) {
      const m = p.media[id]
      if (m && m.path) jobs.push(this._loadImage(m).catch(e => this._warnOnce('img' + id, `Resim yüklenemedi: ${m.name || m.path} (${e.message || e})`)))
    }
    for (const [file, m] of vids) {
      if (!exists(file)) { this._warnOnce('nf' + file, `Kaynak dosya bulunamadı: ${file}`); continue }
      jobs.push(videoInfo(file, m).then(i => this.infos.set(file, i)))
    }
    await Promise.all(jobs)
  }

  async _loadImage(m) {
    const img = new Image()
    img.decoding = 'async'
    img.src = fileUrl(m.path)
    await img.decode()
    let w = img.naturalWidth || m.width || 1000, h = img.naturalHeight || m.height || 1000
    let src = img
    const maxSide = Math.max(this.width, this.height) * 2
    if (Math.max(w, h) > maxSide) {
      // tuvalle küçült: ImageBitmap'te WebGL FLIP_Y/PREMULTIPLY ayarlarını yok sayar (ters/koyu alfa olur)
      const k = maxSide / Math.max(w, h)
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, c.width, c.height)
      src = c
      w = c.width; h = c.height
    }
    this.images.set(m.id, { src, w, h })
  }

  // Kod çözücü çıkış boyutu: ekranda kaplayacağı boyut (anahtar kare / animasyon payı), kaynaktan büyük değil
  _decodeSize(clip, info) {
    const W = this.width, H = this.height
    const crop = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
    const fx = Math.max(0.05, 1 - (crop.l || 0) - (crop.r || 0)), fy = Math.max(0.05, 1 - (crop.t || 0) - (crop.b || 0))
    const mw = info.width, mh = info.height
    const mediaAR = (mw * fx) / Math.max(1, mh * fy), canvasAR = W / H
    const fit = clip.fit || 'contain'
    let baseW, baseH
    if (fit === 'fill') { baseW = W; baseH = H }
    else if ((fit === 'contain') === (mediaAR > canvasAR)) { baseW = W; baseH = W / mediaAR }
    else { baseH = H; baseW = H * mediaAR }
    const tr = clip.transform || {}
    const sc = maxKey(clip, 'transform.scale', Math.abs(tr.scale ?? 1)) * Math.max(maxKey(clip, 'transform.scaleX', Math.abs(tr.scaleX ?? 1)), maxKey(clip, 'transform.scaleY', Math.abs(tr.scaleY ?? 1)))
    const anim = clip.anim || {}
    const boost = (anim.in && anim.in.id) || (anim.out && anim.out.id) || (anim.loop && anim.loop.id) || (clip.effects && clip.effects.length) ? 1.25 : 1.08
    const needW = Math.max((baseW * sc * boost) / fx, ((baseH * sc * boost) / fy) * (mw / mh))
    let dw = Math.min(needW, mw)
    let dh = dw * (mh / mw)
    const cap = W * H * 2.25
    if (dw * dh > cap) { const k = Math.sqrt(cap / (dw * dh)); dw *= k; dh *= k }
    dw = Math.max(16, Math.round(dw / 2) * 2)
    dh = Math.max(16, Math.round(dh / 2) * 2)
    return { w: dw, h: dh }
  }

  _decoder(clip, media) {
    let d = this.decs.get(clip.id)
    if (d) return d
    // kaynak dosya seçimi önizlemeyle aynı yardımcıdan (ters kopya, arka plansız, sabitlenmiş türevler)
    const sp = clipSourcePath(clip, media, { preview: false })
    const file = sp.path || media.path
    const revFile = !!sp.reversed
    let info = this.infos.get(file)
    if (info && sp.alpha) info = { ...info, alpha: true }
    if (!info) info = { F: media.fps || 30, Fstr: String(media.fps || 30), width: media.width || 1280, height: media.height || 720, duration: media.duration || 0, matrix: 'bt709', range: 'tv', frames: Math.round((media.duration || 0) * (media.fps || 30)) }
    const { w, h } = this._decodeSize(clip, info)
    // sabit hızda tamsayı seyreltme: kaynak adımı/kare = m kare
    let m = 1
    if (!clip.freeze && !clip.speedCurve && !this.still) {
      const span = (clip.out ?? 0) - (clip.in ?? 0)
      const r = (span / Math.max(1e-6, clip.duration)) * info.F / this.fps
      const rr = Math.round(r)
      if (rr >= 2 && Math.abs(r - rr) < 1e-4) m = rr
    }
    const pre = []
    const big = info.width * info.height > 1920 * 1088 * 1.05
    if (big || info.codec === 'hevc') pre.push('-hwaccel', 'auto')
    // alfa korunsun: libvpx kod çözücü -i'DEN ÖNCE
    if ((info.webm || sp.alpha) && /^vp[89]$/.test(info.codec || (sp.alpha ? 'vp9' : ''))) pre.push('-c:v', info.codec === 'vp8' ? 'libvpx' : 'libvpx-vp9')
    const rgba = info.alpha || info.webm || info.hdr || !!sp.alpha
    let colorFilter = `scale=in_color_matrix=${info.matrix}:in_range=${info.range}:out_range=pc,format=rgba`
    if (info.hdr) colorFilter = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=pc,format=rgba'
    const frameBytes = w * h * 1.5
    const chunk = this.still ? 1 : Math.max(8, Math.min(Math.round(info.F * 1.5), Math.floor(160e6 / frameBytes)))
    d = new ClipDecoder({
      file, F: info.F, Fstr: info.Fstr, w, h, mode: rgba ? 'rgba' : 'yuv', matrix: info.matrix, range: info.range, colorFilter,
      preInput: pre, m, reverse: !!clip.reverse && !revFile && !clip.freeze, chunk, still: this.still || !!clip.freeze,
      maxIdx: Math.max(0, (info.frames || 1) - 1), label: clip.name || media.name || 'video', warn: this.warn,
    })
    d.revFile = revFile
    d.info = info
    this.decs.set(clip.id, d)
    return d
  }

  _index(d, clip, media, lt) {
    let st = sourceTime(clip, lt)
    const dur = d.info.duration || media.duration || 0
    if (dur > 0) st = Math.min(Math.max(0, st), dur)
    let k = d.index(st)
    if (d.revFile) k = d.maxIdx - k
    return k
  }

  // t anı için gereken kareleri hazırla
  async load(t) {
    if (this.closed) return this.cur
    const items = this.visible(t)
    const res = await Promise.all(items.map(async (it) => {
      const d = this._decoder(it.clip, it.media)
      const view = await d.frameAt(this._index(d, it.clip, it.media, it.lt))
      if (!view) {
        if (this.closed) return [it.clip.id, null]
        this._warnOnce('blk' + it.clip.id, `"${it.clip.name || it.media.name}" için kare alınamadı, siyah kare kullanıldı`)
        return [it.clip.id, this._black(it.media, d)]
      }
      return [it.clip.id, view]
    }))
    this.cur = new Map(res)
    this.active = new Set(res.map(r => r[0]))
    return this.cur
  }

  // ileriyi hazırla: yakında görünecek klipler için kod çözücüyü önceden başlat
  // i: şimdiki kare, timeOf(j): j. karenin zamanı, L: kaç kare ileri. Yeni klibin kod çözücüsü
  // ilk GÖRÜNECEĞİ karenin konumundan başlatılır (geri sıçrayıp yeniden başlamasın).
  warm(i, timeOf, L) {
    if (this.closed) return
    const tA = timeOf(i + L)
    for (const it of this.visible(tA)) {
      if (this.decs.has(it.clip.id)) continue
      let lt = it.lt
      for (let j = i + 1; j < i + L; j++) {
        const v = this.visible(timeOf(j)).find(x => x.clip.id === it.clip.id)
        if (v) { lt = v.lt; break }
      }
      const d = this._decoder(it.clip, it.media)
      d.start(this._index(d, it.clip, it.media, lt))
    }
  }

  // artık gerekmeyen kod çözücüleri kapat
  sweep(tAhead) {
    const keep = new Set(this.active || [])
    for (const it of this.visible(tAhead)) keep.add(it.clip.id)
    for (const [id, d] of this.decs) {
      if (keep.has(id)) continue
      d.close()
      this.decs.delete(id)
    }
  }

  _black(media, d) {
    if (!this._blk) this._blk = { data: new Uint8Array(16 * 16 * 4).fill(0).map((v, i) => (i % 4 === 3 ? 255 : 0)), width: 16, height: 16 }
    const info = d && d.info
    return { src: this._blk, w: (info && info.width) || media.width || 16, h: (info && info.height) || media.height || 9 }
  }

  _videoFrame(clip) {
    const v = this.cur.get(clip.id)
    if (v) return v
    const d = this.decs.get(clip.id)
    if (d && d.cur) return d.cur.view
    if (this.closed) return null
    this._warnOnce('miss' + clip.id, `"${clip.name || 'video'}" karesi hazır değildi`)
    return null
  }

  stats() {
    const o = {}
    for (const [id, d] of this.decs) o[id] = { restarts: d.restarts, produced: d.produced, w: d.w, h: d.h, m: d.m, mode: d.mode, reverse: d.reverse, revFile: d.revFile }
    return o
  }

  close() {
    this.closed = true
    for (const d of this.decs.values()) d.close()
    this.decs.clear()
    this.images.clear()
  }
}
