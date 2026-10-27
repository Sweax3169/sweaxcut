// Oynatma motoru: saat, oynat/duraklat/ara, önizleme çizim döngüsü.
// Zaman değişimi React durumuna YAZILMAZ (60 fps'te bütün arayüzü yeniden çizmemek için);
// zaman isteyen bileşenler playback.onTime() ile abone olur.

import { store } from '../core/store.js'
import { projectDuration } from '../core/timeline.js'
import { snapFrame } from '../core/time.js'
import { Compositor } from './compositor.js'
import { PreviewSources } from './preview-sources.js'

// Ses motoru varsa ana saat odur (import.meta.glob dosya yoksa boş döner)
const audioMods = import.meta.glob('./audio.js', { eager: true })
const audioMod = audioMods['./audio.js'] || null
function audioEngine() { return audioMod && (audioMod.audioEngine || null) }

class Playback {
  constructor() {
    this.time = 0
    this.playing = false
    this.timeSubs = new Set()
    this.stateSubs = new Set()
    this.comp = null
    this.sources = new PreviewSources(() => this.requestRender())
    this.needRender = true
    this.raf = 0
    this.clockStart = 0
    this.clockT0 = 0
    this.lastRev = -1
    this.renderMs = 0
    this.fpsMeasured = 0
    this._frames = 0
    this._fpsT = performance.now()
    this.overlayDraw = null
    this.quality = 'auto'
    this.lastProject = null
    window.__sweaxRedraw = () => this.requestRender()
    window.__sweaxPlayback = this
    store.subscribe(() => {
      const s = store.get()
      if (s.rev !== this.lastRev) {
        this.lastRev = s.rev
        this.requestRender()
        const ae = audioEngine()
        if (this.playing && ae && ae.update) {
          clearTimeout(this._audioUpd)
          this._audioUpd = setTimeout(() => ae.update(store.get().project), 60)
        }
      }
    })
  }

  attach(canvas) {
    if (this.comp && this.comp.canvas === canvas) return
    if (this.comp) this.comp.dispose()
    this.comp = new Compositor(canvas, { desynchronized: false })
    this.requestRender()
    if (!this.raf) this._loop()
    // ses aygıtını önceden aç (ilk oynatmada ~450 ms bekleme olmasın)
    const ae = audioEngine(); if (ae && ae.warmup) ae.warmup()
  }

  detach() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.comp) { this.comp.dispose(); this.comp = null }
    this.sources.dispose()
  }

  onTime(fn) { this.timeSubs.add(fn); fn(this.time); return () => this.timeSubs.delete(fn) }
  onState(fn) { this.stateSubs.add(fn); return () => this.stateSubs.delete(fn) }
  _emitTime() { for (const f of this.timeSubs) f(this.time) }
  _emitState() { for (const f of this.stateSubs) f({ playing: this.playing }) }

  duration() { return projectDuration(store.get().project) }

  play() {
    if (this.playing) return
    const s = store.get()
    let dur = this.duration()
    const ui = s.ui
    const end = ui.rangeOut != null ? ui.rangeOut : dur
    if (this.time >= end - 0.01) this.time = ui.rangeIn != null ? ui.rangeIn : 0
    if (dur <= 0) return
    this.playing = true
    this.clockStart = performance.now()
    this.clockT0 = this.time
    const ae = audioEngine()
    if (ae && ae.start) { try { ae.start(s.project, this.time) } catch (e) { console.warn('ses başlatılamadı', e) } }
    this._emitState()
    this.requestRender()
  }

  pause() {
    if (!this.playing) return
    this.playing = false
    const ae = audioEngine()
    if (ae && ae.stop) { try { ae.stop() } catch (e) { /* */ } }
    this.time = snapFrame(this.time, store.get().project.settings.fps)
    this.sources.sync(store.get().project, this.time, false)
    this._emitState()
    this._emitTime()
    this.requestRender()
  }

  toggle() { this.playing ? this.pause() : this.play() }

  seek(t, opts = {}) {
    const dur = this.duration()
    t = Math.max(0, Math.min(t, Math.max(dur, 0)))
    if (!opts.noSnap) t = snapFrame(t, store.get().project.settings.fps)
    this.time = t
    if (this.playing) {
      this.clockStart = performance.now()
      this.clockT0 = t
      const ae = audioEngine()
      if (ae && ae.start) { try { ae.stop(); ae.start(store.get().project, t) } catch (e) { /* */ } }
    } else if (opts.scrub) {
      const ae = audioEngine()
      if (ae && ae.scrub) { try { ae.scrub(store.get().project, t) } catch (e) { /* */ } }
    }
    this.sources.scrubbing = !!opts.scrub
    this._emitTime()
    this.requestRender()
  }

  step(frames) {
    const fps = store.get().project.settings.fps
    this.pause()
    this.seek(this.time + frames / fps)
  }

  requestRender() { this.needRender = true }

  _clock() {
    const ae = audioEngine()
    if (ae && ae.isPlaying && ae.now) {
      const t = ae.now()
      if (isFinite(t)) return t
    }
    return this.clockT0 + (performance.now() - this.clockStart) / 1000
  }

  _scale(project) {
    const c = this.comp.canvas
    const disp = c.__displayW || c.clientWidth || 540
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let k = (disp * dpr) / project.settings.width
    const q = store.get().ui.previewQuality
    if (q === 'full') k = Math.max(k, 1)
    else if (q === 'half') k = Math.min(k, 0.5)
    else if (q === 'quarter') k = Math.min(k, 0.25)
    else if (this.playing) k = Math.min(k, 0.75)
    return Math.max(0.1, Math.min(k, 1))
  }

  _loop() {
    this.raf = requestAnimationFrame(() => this._loop())
    if (!this.comp) return
    const s = store.get()
    const project = s.project
    if (this.playing) {
      let t = this._clock()
      const dur = this.duration()
      const end = s.ui.rangeOut != null ? s.ui.rangeOut : dur
      if (t >= end) {
        if (s.ui.loop) {
          t = s.ui.rangeIn != null ? s.ui.rangeIn : 0
          this.time = t
          this.clockStart = performance.now(); this.clockT0 = t
          const ae = audioEngine()
          if (ae && ae.start) { try { ae.stop(); ae.start(project, t) } catch (e) { /* */ } }
        } else {
          this.time = end
          this.pause()
          return
        }
      }
      this.time = t
      this.needRender = true
      this._emitTime()
    }
    if (!this.needRender) return
    this.needRender = false
    this.sources.sync(project, this.time, this.playing)
    const k = this._scale(project)
    const W = Math.max(2, Math.round(project.settings.width * k))
    const H = Math.max(2, Math.round(project.settings.height * k))
    const c = this.comp.canvas
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    try {
      const st = this.comp.render({ project, time: this.time, sources: this.sources, scale: k })
      this.renderMs = st.ms
    } catch (e) {
      console.error('çizim hatası', e)
    }
    if (this.comp.pending && !this.playing) {
      // kaynak kare henüz hazır değil: kısa süre sonra yeniden dene
      clearTimeout(this._retry)
      this._retry = setTimeout(() => this.requestRender(), 50)
    }
    this._frames++
    const now = performance.now()
    if (now - this._fpsT > 1000) { this.fpsMeasured = this._frames * 1000 / (now - this._fpsT); this._frames = 0; this._fpsT = now }
    if (this.overlayDraw) this.overlayDraw()
  }

  // Şu anki kareyi PNG olarak al (önizleme çözünürlüğünde değil, tam boy için dışa aktarmayı kullan)
  snapshotDataURL() {
    if (!this.comp) return null
    // çizim tamponu korunmadığı için aynı görevde çizip hemen oku
    try {
      const project = store.get().project
      this.comp.render({ project, time: this.time, sources: this.sources, scale: this._scale(project) })
      return this.comp.canvas.toDataURL('image/png')
    } catch (e) { return null }
  }
}

export const playback = new Playback()
// test ve hata ayıklama kancası
if (typeof window !== 'undefined' && window.__sweax) window.__sweax.playback = playback
