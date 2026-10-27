// Bileşimci — bir projenin t anındaki karesini WebGL2 ile çizer.
// Önizleme ve dışa aktarma AYNI kodu kullanır (WYSIWYG). Kaynak kareleri "sources" sağlar:
//   sources.videoFrame(clip, media, srcTime) → { src, w, h } | null   (src: video/canvas/ImageBitmap/{data,width,height})
//   sources.image(media) → { src, w, h } | null
// Yazı ve çıkartma katmanları 2D tuvalde çizilip doku olarak yüklenir.

import { GL, VS_LAYER, hexToRgb } from './gl.js'
import { FS_COPY, FS_SOLID, FS_GRADIENT, FS_BLUR, FS_RGBSPLIT, FS_COMPOSE, FS_BLEND, BLEND_MODES, ADJ_KEYS, colorShader, effectShader, transitionShader } from './shaders.js'
import { REG, get as regGet } from './registry.js'
import { prop, evalKeys } from '../core/keyframes.js'
import { sourceTime } from '../core/time.js'
import { transitionWindow } from '../core/timeline.js'
import { renderTextLayer } from './text-render.js'
import { renderStickerLayer } from './sticker-render.js'

const MASK_TYPES = { none: 0, linear: 1, mirror: 2, circle: 3, rect: 4, heart: 5, star: 6, diamond: 7, hexagon: 8 }
const BLEND_INDEX = Object.fromEntries(BLEND_MODES.map((b, i) => [b[0], i]))
const EPS = 1e-4

export class Compositor {
  constructor(canvas, opts = {}) {
    this.glw = new GL(canvas, opts)
    this.gl = this.glw.gl
    this.texCache = new Map()   // anahtar → { tex, ver }
    this.curveTex = new Map()
    this.pending = false
    this.stats = { layers: 0, ms: 0 }
    this.fallbackTex = null
    this.geom = new Map()       // klip id → son çizimdeki ekran geometrisi (önizleme tutamaçları için)
  }

  get canvas() { return this.glw.canvas }

  // -------------------------------------------------------------- yardımcı doku
  _tex(key) {
    let e = this.texCache.get(key)
    if (!e) { e = { tex: this.glw.texture(), ver: null, used: 0 }; this.texCache.set(key, e) }
    e.used = this.frameNo
    return e
  }

  _gcTextures() {
    if (this.texCache.size < 48) return
    for (const [k, e] of this.texCache) {
      if (this.frameNo - e.used > 240) { this.gl.deleteTexture(e.tex); this.texCache.delete(k) }
    }
  }

  _prog(key, fs, vs) { return this.glw.program(key, fs, vs) }

  _blit(src, dst, opts = {}) {
    const p = this._prog('copy', FS_COPY)
    this.glw.bindTarget(dst)
    this.gl.disable(this.gl.BLEND)
    this.glw.use(p, { uTex: { tex: src.tex || src }, uFlip: opts.flip ? 1 : 0, uDim: opts.dim || 0 })
    this.glw.draw()
  }

  _blur(src, radius, scale = 1) {
    // src: {tex,w,h} → yeni hedef (çağıran release etmeli)
    const w = Math.max(2, Math.round(src.w * scale)), h = Math.max(2, Math.round(src.h * scale))
    const p = this._prog('blur', FS_BLUR)
    const a = this.glw.target(w, h)
    const b = this.glw.target(w, h)
    const gl = this.gl
    gl.disable(gl.BLEND)
    const r = Math.max(0.5, radius * scale)
    this.glw.bindTarget(a)
    this.glw.use(p, { uTex: { tex: src.tex }, uDir: [1, 0], uRes: [w, h], uRadius: r })
    this.glw.draw()
    this.glw.bindTarget(b)
    this.glw.use(p, { uTex: { tex: a.tex }, uDir: [0, 1], uRes: [w, h], uRadius: r })
    this.glw.draw()
    this.glw.release(a)
    return b
  }

  // -------------------------------------------------------------- ana giriş
  // opts: { project, time, sources, scale (render ölçeği), target (null = ekran), flip, quality }
  render(opts) {
    const t0 = performance.now()
    const { project, time, sources } = opts
    const gl = this.gl
    const glw = this.glw
    this.frameNo = (this.frameNo || 0) + 1
    this.pending = false
    const R = opts.scale || 1
    const W = Math.max(2, Math.round(project.settings.width * R))
    const H = Math.max(2, Math.round(project.settings.height * R))
    this.ctx = { project, time, sources, R, W, H, layers: 0, recordGeom: !opts.target }

    let accum = glw.target(W, H)
    glw.bindTarget(accum)
    gl.disable(gl.BLEND)
    glw.clear(0, 0, 0, 1)

    const tracks = project.tracks
    const mainIdx = tracks.findIndex(t => t.main)
    // çizim sırası: ana iz (en altta) → üstündeki görsel izler (listede yukarı doğru)
    const order = []
    for (let i = (mainIdx < 0 ? tracks.length - 1 : mainIdx); i >= 0; i--) if (tracks[i].kind !== 'audio') order.push(tracks[i])

    for (const track of order) {
      if (track.hidden) continue
      if (track.kind === 'effect') {
        for (const c of track.clips) {
          if (time < c.start - EPS || time >= c.start + c.duration - EPS) continue
          accum = this._applyEffectClip(accum, c, time - c.start)
        }
        continue
      }
      // geçiş penceresi var mı?
      let handled = false
      for (const c of track.clips) {
        if (!c.transition) continue
        const win = transitionWindow(track, c)
        if (win && time >= win.start && time < win.end) {
          accum = this._drawTransition(accum, track, win, time)
          handled = true
          break
        }
      }
      if (handled) continue
      for (const c of track.clips) {
        if (time < c.start - EPS || time >= c.start + c.duration - EPS) continue
        accum = this._drawClip(accum, c, time - c.start, track.main)
      }
    }

    // çıkış
    glw.bindTarget(opts.target || null)
    if (!opts.target) { gl.viewport(0, 0, this.canvas.width, this.canvas.height) }
    this._blit(accum, opts.target || null, { flip: !!opts.flip })
    glw.release(accum)
    glw.releaseAll()
    this._gcTextures()
    this.stats = { layers: this.ctx.layers, ms: performance.now() - t0 }
    return this.stats
  }

  // -------------------------------------------------------------- klip çizimi
  _drawClip(accum, clip, lt, isMain) {
    const { W, H } = this.ctx
    const st = this._layerState(clip, lt)
    if (st.opacity <= 0.001 && !isMain) return accum
    const L = this._layerTexture(clip, lt, st)
    if (!L) {
      if (isMain) this._drawBackground(accum, clip, null)
      return accum
    }
    if (isMain) this._drawBackground(accum, clip, L)
    const blend = clip.blend || 'normal'
    if (blend === 'normal') {
      this._compose(L, accum, clip, lt, st)
    } else {
      const layer = this.glw.target(W, H)
      this.glw.bindTarget(layer)
      this.glw.clear(0, 0, 0, 0)
      this._compose(L, layer, clip, lt, st)
      accum = this._blend(accum, layer, blend)
      this.glw.release(layer)
    }
    if (L.own) this.glw.release(L.t)
    this.ctx.layers++
    return accum
  }

  // Ana iz klibi tam kare (arka plan dahil) — geçişlerde kullanılır
  _fullFrame(clip, lt, isMain) {
    const { W, H } = this.ctx
    const out = this.glw.target(W, H)
    this.glw.bindTarget(out)
    this.glw.clear(0, 0, 0, isMain ? 1 : 0)
    if (!clip) return out
    const st = this._layerState(clip, lt)
    const L = this._layerTexture(clip, lt, st)
    if (isMain) this._drawBackground(out, clip, L)
    if (L) {
      this._compose(L, out, clip, lt, st)
      if (L.own) this.glw.release(L.t)
    }
    return out
  }

  _drawTransition(accum, track, win, time) {
    const tr = regGet('transitions', win.from.transition.id)
    const A = this._fullFrame(win.from, time - win.from.start, track.main)
    const B = this._fullFrame(win.to, time - win.to.start, track.main)
    const progress = Math.min(1, Math.max(0, (time - win.start) / win.duration))
    const { W, H } = this.ctx
    const out = this.glw.target(W, H)
    const gl = this.gl
    let p = tr ? this._prog('tr:' + tr.id, transitionShader(tr.glsl)) : null
    if (!p) p = this._prog('tr:fade', transitionShader('vec4 transition(vec2 uv){ return mix(getFromColor(uv), getToColor(uv), progress); }'))
    this.glw.bindTarget(out)
    gl.disable(gl.BLEND)
    const vals = { uFrom: { tex: A.tex }, uTo: { tex: B.tex }, progress, ratio: W / H, uTime: time }
    if (tr && tr.params) {
      const user = (win.from.transition.params) || {}
      for (const prm of tr.params) {
        let v = user[prm.key] ?? prm.default
        if (prm.type === 'color' && typeof v === 'string') v = hexToRgb(v)
        vals[prm.key] = v
      }
    }
    this.glw.use(p, vals)
    this.glw.draw()
    this.glw.release(A); this.glw.release(B)
    // sonucu birikime normal karışımla koy
    if (track.main) {
      this.glw.release(accum)
      return out
    }
    this.glw.bindTarget(accum)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.glw.use(this._prog('copy', FS_COPY), { uTex: { tex: out.tex }, uFlip: 0, uDim: 0 })
    this.glw.draw()
    gl.disable(gl.BLEND)
    this.glw.release(out)
    return accum
  }

  // -------------------------------------------------------------- arka plan (tuval)
  _drawBackground(target, clip, L) {
    const { project, W, H } = this.ctx
    let bg = clip.canvasBg || project.settings.bg || { type: 'color', color: '#000' }
    // arka planı silinmiş klibin kendisini bulanıklaştırmak anlamsız: düz renge düş
    if (bg.type === 'blur' && clip.bgRemove) bg = { ...bg, type: 'color' }
    const gl = this.gl
    this.glw.bindTarget(target)
    gl.disable(gl.BLEND)
    if (bg.type === 'blur' && L && L.src) {
      // klibin kendi karesini kapla + bulanıklaştır
      const sw = Math.max(16, Math.round(W / 6)), sh = Math.max(16, Math.round(H / 6))
      const small = this.glw.target(sw, sh)
      this.glw.bindTarget(small)
      this.glw.clear(0, 0, 0, 1)
      const srcAR = L.src.w / L.src.h, dstAR = W / H
      let qw = 1, qh = 1
      if (srcAR > dstAR) qw = srcAR / dstAR; else qh = dstAR / srcAR
      const m = [qw * 2 * 1.08, 0, 0, 0, qh * 2 * 1.08, 0, 0, 0, 1]
      const p = this._prog('compose', FS_COMPOSE, VS_LAYER)
      this.glw.use(p, { uMat: m, uTex: { tex: L.src.tex }, uOpacity: 1, uBright: 0, uCrop: [0, 0, 0, 0], uLayerPx: [sw, sh], uMaskType: 0 })
      this.glw.draw()
      const blurred = this._blur(small, (bg.blur ?? 28) * 0.25 + 2, 1)
      const blurred2 = this._blur(blurred, (bg.blur ?? 28) * 0.18 + 1, 1)
      this.glw.release(blurred)
      this.glw.release(small)
      this.glw.bindTarget(target)
      this.glw.use(this._prog('copy', FS_COPY), { uTex: { tex: blurred2.tex }, uFlip: 0, uDim: bg.dim ?? 0.15 })
      this.glw.draw()
      this.glw.release(blurred2)
    } else if (bg.type === 'gradient') {
      const g = bg.gradient || ['#141414', '#000']
      this.glw.use(this._prog('grad', FS_GRADIENT), { uA: hexToRgb(g[0]), uB: hexToRgb(g[1]), uAngle: (bg.angle || 0) * Math.PI / 180 })
      this.glw.draw()
    } else if (bg.type === 'image' && bg.mediaId && project.media[bg.mediaId]) {
      const media = project.media[bg.mediaId]
      const im = this.ctx.sources.image(media)
      if (im) {
        const e = this._tex('bgimg:' + media.id)
        if (e.ver !== im.src) { this.glw.upload(e.tex, im.src); e.ver = im.src }
        const srcAR = im.w / im.h, dstAR = W / H
        let qw = 1, qh = 1
        if (srcAR > dstAR) qw = srcAR / dstAR; else qh = dstAR / srcAR
        const p = this._prog('compose', FS_COMPOSE, VS_LAYER)
        this.glw.use(p, { uMat: [qw * 2, 0, 0, 0, qh * 2, 0, 0, 0, 1], uTex: { tex: e.tex }, uOpacity: 1, uBright: 0, uCrop: [0, 0, 0, 0], uLayerPx: [W, H], uMaskType: 0 })
        this.glw.draw()
      }
    } else {
      const c = hexToRgb(bg.color || '#000')
      this.glw.use(this._prog('solid', FS_SOLID), { uColor: [c[0], c[1], c[2], 1] })
      this.glw.draw()
    }
  }

  // -------------------------------------------------------------- katman durumu
  _layerState(clip, lt) {
    const tr = clip.transform || {}
    const st = {
      x: prop(clip, 'transform.x', lt) || 0,
      y: prop(clip, 'transform.y', lt) || 0,
      scale: prop(clip, 'transform.scale', lt) ?? 1,
      scaleX: prop(clip, 'transform.scaleX', lt) ?? 1,
      scaleY: prop(clip, 'transform.scaleY', lt) ?? 1,
      rotation: prop(clip, 'transform.rotation', lt) || 0,
      opacity: prop(clip, 'opacity', lt) ?? 1,
      flipH: !!tr.flipH, flipV: !!tr.flipV,
      blur: 0, bright: 0, rgbSplit: 0, skewX: 0, skewY: 0,
    }
    const anim = clip.anim || {}
    const isText = clip.type === 'text'
    const W = this.ctx.W, H = this.ctx.H
    const apply = (a) => {
      if (!a) return
      if (a.x) st.x += a.x
      if (a.y) st.y += a.y
      if (a.scale != null) st.scale *= a.scale
      if (a.scaleX != null) st.scaleX *= a.scaleX
      if (a.scaleY != null) st.scaleY *= a.scaleY
      if (a.rotation) st.rotation += a.rotation
      if (a.opacity != null) st.opacity *= a.opacity
      if (a.blur) st.blur = Math.max(st.blur, a.blur)
      if (a.brightness) st.bright += a.brightness
      if (a.rgbSplit) st.rgbSplit = Math.max(st.rgbSplit, a.rgbSplit)
      if (a.skewX) st.skewX += a.skewX
      if (a.skewY) st.skewY += a.skewY
    }
    const ctx = { w: W, h: H, seed: hashSeed(clip.id) }
    const run = (slot, p) => {
      const a = anim[slot]
      if (!a || !a.id) return
      const def = regGet('clipAnims', a.id)
      if (!def) return // yazı animasyonları text-render'da işlenir
      try { apply(def.fn(p, ctx)) } catch (e) { /* hatalı animasyon */ }
    }
    if (anim.in && anim.in.id && (!isText || regGet('clipAnims', anim.in.id))) {
      const d = Math.max(0.05, Math.min(anim.in.duration || 0.5, clip.duration))
      if (lt < d) run('in', lt / d)
    }
    if (anim.out && anim.out.id && (!isText || regGet('clipAnims', anim.out.id))) {
      const d = Math.max(0.05, Math.min(anim.out.duration || 0.5, clip.duration))
      if (lt > clip.duration - d) run('out', (lt - (clip.duration - d)) / d)
    }
    if (anim.loop && anim.loop.id && (!isText || regGet('clipAnims', anim.loop.id))) {
      const d = Math.max(0.1, anim.loop.duration || 1)
      run('loop', lt / d)
    }
    return st
  }

  // -------------------------------------------------------------- katman dokusu (renk + efektler)
  // döner: { t: {tex,w,h}, baseW, baseH (tuval px), own, src: {tex,w,h} }
  _layerTexture(clip, lt, st) {
    const { project, sources, R, W, H } = this.ctx
    const glw = this.glw
    let srcTex = null, sw = 0, sh = 0, baseW = 0, baseH = 0, prerendered = false
    if (clip.type === 'video' || clip.type === 'image') {
      const media = project.media[clip.mediaId]
      if (!media) return null
      let fr = null
      if (clip.type === 'image' || media.type === 'image') fr = sources.image(media)
      else fr = sources.videoFrame(clip, media, sourceTime(clip, lt))
      if (!fr) { this.pending = true; return null }
      const e = this._tex(clip.type === 'image' ? 'img:' + media.id : 'vid:' + clip.id)
      if (clip.type !== 'image' || e.ver !== fr.src) { glw.upload(e.tex, fr.src); e.ver = fr.src }
      srcTex = e.tex; sw = fr.w; sh = fr.h
      // sığdırma
      const crop = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
      const cw = sw * (1 - crop.l - crop.r), ch = sh * (1 - crop.t - crop.b)
      const mediaAR = cw / Math.max(1, ch), canvasAR = W / H
      const fit = clip.fit || 'contain'
      if (fit === 'fill') { baseW = W; baseH = H }
      else if ((fit === 'contain') === (mediaAR > canvasAR)) { baseW = W; baseH = W / mediaAR }
      else { baseH = H; baseW = H * mediaAR }
    } else if (clip.type === 'text') {
      const r = renderTextLayer(clip, lt, R * (st.scale || 1), project)
      if (!r || !r.canvas) return null
      const e = this._tex('txt:' + clip.id)
      if (e.ver !== r.key) { glw.upload(e.tex, r.canvas); e.ver = r.key }
      srcTex = e.tex; sw = r.width; sh = r.height
      baseW = r.width / Math.max(0.0001, st.scale || 1); baseH = r.height / Math.max(0.0001, st.scale || 1)
      if (r.offsetX || r.offsetY) { st.x += (r.offsetX || 0) / W; st.y += (r.offsetY || 0) / H }
      prerendered = true
    } else if (clip.type === 'sticker') {
      const media = clip.sticker && clip.sticker.mediaId ? project.media[clip.sticker.mediaId] : null
      const r = renderStickerLayer(clip, lt, R * (st.scale || 1), project, media ? sources.image(media) : null)
      if (!r || !r.canvas) return null
      const e = this._tex('stk:' + clip.id)
      if (e.ver !== r.key) { glw.upload(e.tex, r.canvas); e.ver = r.key }
      srcTex = e.tex; sw = r.width; sh = r.height
      baseW = r.width / Math.max(0.0001, st.scale || 1); baseH = r.height / Math.max(0.0001, st.scale || 1)
      prerendered = true
    } else return null

    const src = { tex: srcTex, w: sw, h: sh }
    // işleme çözünürlüğü: ekranda görüneceği boyuttan büyük olmasın
    const dispW = Math.abs(baseW * st.scale * st.scaleX), dispH = Math.abs(baseH * st.scale * st.scaleY)
    let pw = sw, ph = sh
    if (!prerendered && dispW > 0 && dispW < sw) { const k = Math.max(0.1, Math.min(1, (dispW * 1.15) / sw)); pw = Math.max(2, Math.round(sw * k)); ph = Math.max(2, Math.round(sh * k)) }

    let cur = { tex: srcTex, w: sw, h: sh }
    let own = false
    const swap = (next) => { if (own) glw.release(cur); cur = next; own = true }

    // renk
    if (needsColor(clip, lt)) {
      const out = glw.target(pw, ph)
      this._colorPass(cur, out, clip, lt)
      swap(out)
    }
    // efektler
    if (clip.effects && clip.effects.length) {
      const orig = cur
      let keepOrig = false
      for (const fx of clip.effects) {
        if (fx.enabled === false) continue
        const def = regGet('effects', fx.id)
        if (!def) continue
        // uOrig = bu efektin girişi (önceki efektler korunur)
        const res = this._effectPasses(cur, def, fxParams(clip, fx, def, lt), lt, clip, cur)
        if (res && res !== cur) {
          if (own && cur !== orig) glw.release(cur)
          else if (own && cur === orig) keepOrig = true
          cur = res; own = true
        }
      }
      if (keepOrig && orig !== cur) glw.release(orig)
    }
    // animasyon kaynaklı bulanıklık / rgb kayması
    if (st.blur > 0.001) {
      const b = this._blur(cur, st.blur * 40 * R, cur.w > 600 ? 0.5 : 1)
      swap(b)
    }
    if (st.rgbSplit > 0.001) {
      const out = glw.target(cur.w, cur.h)
      glw.bindTarget(out)
      this.gl.disable(this.gl.BLEND)
      glw.use(this._prog('rgbsplit', FS_RGBSPLIT), { uTex: { tex: cur.tex }, uAmt: st.rgbSplit, uRes: [cur.w, cur.h] })
      glw.draw()
      swap(out)
    }
    return { t: cur, own, baseW, baseH, src, prerendered }
  }

  _colorPass(src, dst, clip, lt) {
    const glw = this.glw
    const fdef = clip.filter && clip.filter.id ? regGet('filters', clip.filter.id) : null
    const key = 'color:' + (fdef && fdef.glsl ? fdef.id : '_')
    const p = this._prog(key, colorShader(fdef && fdef.glsl))
    if (!p) return this._blit(src, dst)
    const A = new Float32Array(17), F = new Float32Array(17)
    const adj = clip.adjust || {}
    for (let i = 0; i < ADJ_KEYS.length; i++) {
      const k = ADJ_KEYS[i]
      const v = prop(clip, 'adjust.' + k, lt)
      A[i] = (Number.isFinite(v) ? v : (adj[k] || 0)) / 100
    }
    let hasF = 0, famt = 0, tone = null, curveTex = null, mono = 0
    if (fdef) {
      hasF = 1
      famt = clip.filter.intensity ?? 1
      const fa = fdef.adjust || {}
      for (let i = 0; i < ADJ_KEYS.length; i++) F[i] = (fa[ADJ_KEYS[i]] || 0) / 100
      tone = fdef.tone
      if (fdef.curve) curveTex = this._curveTexture(fdef)
      mono = fdef.mono ? 1 : 0
    }
    const hsl = clip.hsl
    let hasHSL = 0
    const hslArr = new Float32Array(24)
    if (hsl) {
      const names = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta']
      names.forEach((n, i) => {
        const v = hsl[n]
        if (v && (v.h || v.s || v.l)) hasHSL = 1
        hslArr[i * 3] = (v ? v.h : 0) / 100; hslArr[i * 3 + 1] = (v ? v.s : 0) / 100; hslArr[i * 3 + 2] = (v ? v.l : 0) / 100
      })
    }
    const ch = clip.chroma || {}
    glw.bindTarget(dst)
    this.gl.disable(this.gl.BLEND)
    const vals = {
      uTex: { tex: src.tex }, uRes: [src.w, src.h], uTime: this.ctx.time,
      uA: A, uF: F, uFAmt: famt, uHasF: hasF,
      uToneS: tone ? hexToRgb(tone.shadows || '#000') : [0, 0, 0], uToneH: tone ? hexToRgb(tone.highlights || '#fff') : [1, 1, 1],
      uToneAmt: tone ? (tone.amount ?? 0.5) : 0, uToneBal: tone ? (tone.balance || 0) : 0,
      uHasCurve: curveTex ? 1 : 0, uMono: mono,
      uHasHSL: hasHSL,
      uKeyOn: ch.enabled ? 1 : 0, uKeyColor: hexToRgb(ch.color || '#00ff00'), uKeyStrength: ch.strength ?? 0.4, uKeySmooth: ch.smooth ?? 0.1, uKeySpill: ch.spill ?? 0.5,
    }
    if (curveTex) vals.uCurve = { tex: curveTex }
    glw.use(p, vals)
    if (p.uniforms.uHSL) this.gl.uniform3fv(p.uniforms.uHSL.loc, hslArr)
    glw.draw()
  }

  _curveTexture(fdef) {
    let t = this.curveTex.get(fdef.id)
    if (t) return t
    const gl = this.gl
    const data = new Uint8Array(256 * 4)
    const ev = (pts, x) => {
      if (!pts || pts.length < 2) return x
      if (x <= pts[0][0]) return pts[0][1]
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i]
        const k = (x - a[0]) / Math.max(1e-6, b[0] - a[0])
        const s = k * k * (3 - 2 * k)
        return a[1] + (b[1] - a[1]) * (0.5 * k + 0.5 * s)
      }
      return pts[pts.length - 1][1]
    }
    const c = fdef.curve
    for (let i = 0; i < 256; i++) {
      const x = i / 255
      const m = ev(c.rgb, x)
      data[i * 4] = Math.round(255 * Math.min(1, Math.max(0, ev(c.r, m))))
      data[i * 4 + 1] = Math.round(255 * Math.min(1, Math.max(0, ev(c.g, m))))
      data[i * 4 + 2] = Math.round(255 * Math.min(1, Math.max(0, ev(c.b, m))))
      data[i * 4 + 3] = 255
    }
    t = this.glw.texture()
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    this.curveTex.set(fdef.id, t)
    return t
  }

  // Efekt geçişleri; yeni hedef döndürür (ya da derleme hatasında girişin kendisi)
  _effectPasses(input, def, params, lt, clip, orig) {
    const glw = this.glw
    const passes = def.passes || [{ glsl: def.glsl }]
    let cur = input
    let ownCur = false
    const vals0 = {
      uTime: lt, uProgress: clip ? Math.min(1, Math.max(0, lt / Math.max(0.001, clip.duration))) : 0,
      uIntensity: params.intensity != null && !(def.params || []).some(p => p.key === 'intensity') ? params.intensity : 1,
      uSeed: (hashSeed(clip ? clip.id : 'x') % 1000) / 1000,
    }
    for (const prm of def.params || []) {
      let v = params[prm.key] ?? prm.default
      if (prm.type === 'color') v = hexToRgb(v || '#fff')
      else if (prm.type === 'bool') v = v ? 1 : 0
      else if (prm.type === 'select') v = typeof v === 'number' ? v : Math.max(0, (prm.options || []).findIndex(o => (o.value ?? o) === v))
      vals0['u_' + prm.key] = v
    }
    for (let i = 0; i < passes.length; i++) {
      const ps = passes[i]
      const p = this._prog('fx:' + def.id + ':' + i, effectShader(def, ps.glsl))
      if (!p) { if (ownCur) glw.release(cur); return input }
      const sc = ps.scale || 1
      const out = glw.target(Math.max(2, Math.round(input.w * sc)), Math.max(2, Math.round(input.h * sc)))
      glw.bindTarget(out)
      this.gl.disable(this.gl.BLEND)
      glw.use(p, { ...vals0, uTex: { tex: cur.tex }, uOrig: { tex: orig.tex }, uRes: [out.w, out.h] })
      glw.draw()
      if (ownCur) glw.release(cur)
      cur = out; ownCur = true
    }
    return cur
  }

  // Efekt katmanı / filtre katmanı / ayar katmanı: birikime uygula
  _applyEffectClip(accum, clip, lt) {
    const glw = this.glw
    if (clip.type === 'effect' && clip.effect) {
      const def = regGet('effects', clip.effect.id)
      if (!def) return accum
      const res = this._effectPasses(accum, def, fxParams(clip, { uid: 'layer', params: clip.effect.params }, def, lt), lt, clip, accum)
      if (res !== accum) {
        // boyut farklıysa (ölçekli geçiş) tuvale geri büyüt
        if (res.w !== accum.w) {
          const full = glw.target(accum.w, accum.h)
          this._blit(res, full)
          glw.release(res)
          glw.release(accum)
          return full
        }
        glw.release(accum)
        return res
      }
      return accum
    }
    if (clip.type === 'filter' || clip.type === 'adjust') {
      const out = glw.target(accum.w, accum.h)
      this._colorPass(accum, out, clip, lt)
      glw.release(accum)
      return out
    }
    return accum
  }

  // -------------------------------------------------------------- bileşim
  _compose(L, target, clip, lt, st) {
    const { W, H, R } = this.ctx
    const gl = this.gl
    const crop = (clip.type === 'video' || clip.type === 'image') ? (clip.crop || { l: 0, t: 0, r: 0, b: 0 }) : { l: 0, t: 0, r: 0, b: 0 }
    const sx = L.baseW * st.scale * st.scaleX * (st.flipH ? -1 : 1)
    const sy = L.baseH * st.scale * st.scaleY * (st.flipV ? -1 : 1)
    const cx = W / 2 + st.x * W
    const cy = H / 2 + st.y * H
    const th = st.rotation * Math.PI / 180
    const cs = Math.cos(th), sn = Math.sin(th)
    const kx = Math.tan((st.skewX || 0) * Math.PI / 180)
    // nx = a*u + b*v + c ; ny = d*u + e*v + f
    const a = 2 * sx * cs / W, b = 2 * sy * (sn - kx * cs) / W, c = 2 * cx / W - 1
    const d = -2 * sx * sn / H, e = 2 * sy * (cs + kx * sn) / H, f = 1 - 2 * cy / H
    const m = [a, d, 0, b, e, 0, c, f, 1]
    if (target && this.ctx.recordGeom) this.geom.set(clip.id, { cx, cy, w: Math.abs(sx), h: Math.abs(sy), rot: st.rotation, W, H, frame: this.frameNo })
    const mask = clip.mask || { type: 'none' }
    const mt = MASK_TYPES[mask.type] || 0
    const p = this._prog('compose', FS_COMPOSE, VS_LAYER)
    this.glw.bindTarget(target)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.glw.use(p, {
      uMat: m, uTex: { tex: L.t.tex }, uOpacity: Math.max(0, Math.min(1, st.opacity)), uBright: st.bright,
      uCrop: [crop.l, crop.t, crop.r, crop.b], uLayerPx: [Math.abs(sx) || 1, Math.abs(sy) || 1],
      uMaskType: mt,
      uMaskPos: [prop(clip, 'mask.x', lt) || 0, prop(clip, 'mask.y', lt) || 0],
      uMaskSize: [prop(clip, 'mask.w', lt) ?? 0.5, prop(clip, 'mask.h', lt) ?? 0.5],
      uMaskRot: prop(clip, 'mask.rotation', lt) || 0,
      uMaskFeather: (prop(clip, 'mask.feather', lt) || 0) / 100,
      uMaskRound: (mask.round || 0) / 100,
      uMaskInvert: mask.invert ? 1 : 0,
    })
    this.glw.draw()
    gl.disable(gl.BLEND)
    void R
  }

  _blend(accum, layer, mode) {
    const out = this.glw.target(accum.w, accum.h)
    this.glw.bindTarget(out)
    this.gl.disable(this.gl.BLEND)
    this.glw.use(this._prog('blend', FS_BLEND), { uBase: { tex: accum.tex }, uLayer: { tex: layer.tex }, uMode: BLEND_INDEX[mode] || 0 })
    this.glw.draw()
    this.glw.release(accum)
    return out
  }

  // Tek bir efekti örnek görüntüye uygula (kütüphane önizlemeleri için)
  previewEffect(imageSrc, w, h, def, params, t) {
    const glw = this.glw
    const e = this._tex('preview-src')
    if (e.ver !== imageSrc) { glw.upload(e.tex, imageSrc); e.ver = imageSrc }
    const src = { tex: e.tex, w, h }
    this.frameNo = (this.frameNo || 0) + 1
    this.ctx = { time: t, W: w, H: h, R: 1 }
    const fake = { id: 'preview', duration: def.previewDuration || 2 }
    const res = this._effectPasses(src, def, params || {}, t, fake, src)
    this.canvas.width = w; this.canvas.height = h
    this._blit(res, null)
    glw.releaseAll()
  }

  readPixels(target, out) {
    const gl = this.gl
    this.glw.bindTarget(target)
    gl.readPixels(0, 0, target.w, target.h, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  dispose() {
    const gl = this.gl
    for (const e of this.texCache.values()) gl.deleteTexture(e.tex)
    this.texCache.clear()
    this.glw.gc()
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) ext.loseContext()
  }
}

// Efekt parametreleri anahtar karelenebilir: yol 'fx:<uid>:<param>' (efekt katmanında uid = 'layer')
function fxParams(clip, fx, def, lt) {
  const base = fx.params || {}
  const kf = clip.keyframes
  if (!kf) return base
  let out = null
  for (const p of def.params || []) {
    const keys = kf['fx:' + fx.uid + ':' + p.key]
    if (keys && keys.length) {
      if (!out) out = { ...base }
      out[p.key] = evalKeys(keys, lt, base[p.key] ?? p.default)
    }
  }
  return out || base
}

function needsColor(clip, lt) {
  if (clip.filter && clip.filter.id) return true
  if (clip.chroma && clip.chroma.enabled) return true
  const a = clip.adjust
  if (a) for (const k of ADJ_KEYS) if (a[k]) return true
  if (clip.keyframes) for (const k of Object.keys(clip.keyframes)) if (k.startsWith('adjust.')) return true
  if (clip.hsl) for (const n in clip.hsl) { const v = clip.hsl[n]; if (v && (v.h || v.s || v.l)) return true }
  void lt
  return false
}

export function hashSeed(s) {
  let h = 2166136261
  s = String(s)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export { REG }
