// Önizleme kaynakları: her görünen video klibi için bir <video> öğesi (havuzdan), resimler için <img>.
// Oynatırken video öğeleri kendi hızlarında oynar ve saatten sapınca düzeltilir; dururken hedef kareye aranır.

import { fileUrl } from '../platform/node.js'
import { clipSourcePath } from '../core/media.js'
import { sourceTime, instantSpeed } from '../core/time.js'

const LOOKAHEAD = 1.6      // sn — yaklaşan klipleri önceden hazırla
const IDLE_RELEASE = 4000  // ms — kullanılmayan öğeyi serbest bırak
const MAX_ELEMENTS = 14

export class PreviewSources {
  constructor(onNeedRender) {
    this.onNeedRender = onNeedRender || (() => {})
    this.byClip = new Map()     // clipId → entry
    this.pool = []              // tüm entry'ler
    this.images = new Map()     // mediaId → { img, ready }
    this.playing = false
    this.fps = 30
  }

  _url(media, clip) {
    return fileUrl(clipSourcePath(clip, media, { preview: true }).path)
  }

  _mapTime(media, clip, srcTime) {
    // ters kopyada zaman ters akar
    if (clipSourcePath(clip, media, { preview: true }).reversed) return Math.max(0, (media.duration || 0) - srcTime)
    return srcTime
  }

  _create(url, mediaId) {
    const el = document.createElement('video')
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.disablePictureInPicture = true
    const entry = { el, url, mediaId, clipId: null, lastUsed: performance.now(), seeking: false, ready: false, wantTime: null }
    el.addEventListener('loadeddata', () => { entry.ready = true; this.onNeedRender() })
    el.addEventListener('seeked', () => {
      entry.seeking = false
      if (entry.wantTime != null && Math.abs(el.currentTime - entry.wantTime) > 0.5 / this.fps && !this.playing) {
        const t = entry.wantTime
        entry.wantTime = null
        this._seek(entry, t)
      } else {
        entry.wantTime = null
      }
      this.onNeedRender()
    })
    el.addEventListener('error', () => { entry.error = true })
    if (el.requestVideoFrameCallback) {
      const cb = () => { if (!this.playing) this.onNeedRender(); el.requestVideoFrameCallback(cb) }
      el.requestVideoFrameCallback(cb)
    }
    el.src = url
    this.pool.push(entry)
    return entry
  }

  _seek(entry, t) {
    const el = entry.el
    if (entry.seeking) { entry.wantTime = t; return }
    if (Math.abs(el.currentTime - t) < 0.25 / this.fps) return
    entry.seeking = true
    try {
      if (el.fastSeek && this.scrubbing) el.fastSeek(t)
      else el.currentTime = t
    } catch (e) { entry.seeking = false }
  }

  // Klibe öğe ata: aynı medyanın boştaki ve zamanı yakın öğesini tercih et (bölünmüş kliplerde kesintisiz geçiş)
  _entryFor(clip, media, wantT) {
    let e = this.byClip.get(clip.id)
    const url = this._url(media, clip)
    if (e && e.url === url) return e
    if (e) { e.clipId = null; this.byClip.delete(clip.id) }
    const now = performance.now()
    let best = null, bestD = Infinity
    for (const x of this.pool) {
      if (x.url !== url) continue
      if (x.clipId && x.clipId !== clip.id && now - x.lastUsed < 120) continue
      const d = Math.abs(x.el.currentTime - wantT)
      if (d < bestD) { best = x; bestD = d }
    }
    if (!best) {
      if (this.pool.length >= MAX_ELEMENTS) this._evict(true)
      best = this._create(url, media.id)
    }
    if (best.clipId && best.clipId !== clip.id) this.byClip.delete(best.clipId)
    best.clipId = clip.id
    this.byClip.set(clip.id, best)
    return best
  }

  _evict(force) {
    const now = performance.now()
    const sorted = this.pool.slice().sort((a, b) => a.lastUsed - b.lastUsed)
    for (const e of sorted) {
      if (now - e.lastUsed > IDLE_RELEASE || force) {
        this._destroy(e)
        if (force) return
      }
    }
  }

  _destroy(e) {
    try { e.el.pause(); e.el.removeAttribute('src'); e.el.load() } catch (er) { /* */ }
    if (e.clipId) this.byClip.delete(e.clipId)
    this.pool = this.pool.filter(x => x !== e)
  }

  // ---------------------------------------------------------------- bileşimci arayüzü
  videoFrame(clip, media, srcTime) {
    const t = this._mapTime(media, clip, srcTime)
    const e = this._entryFor(clip, media, t)
    e.lastUsed = performance.now()
    if (!this.playing || clip.freeze) this._seek(e, Math.max(0, Math.min(t, (media.duration || 1e9) - 0.001)))
    if (!e.ready || e.el.readyState < 2 || !e.el.videoWidth) return null
    return { src: e.el, w: e.el.videoWidth, h: e.el.videoHeight }
  }

  image(media) {
    let e = this.images.get(media.id)
    if (!e) {
      const img = new Image()
      img.decoding = 'async'
      e = { img, ready: false }
      img.onload = () => { e.ready = true; this.onNeedRender() }
      img.onerror = () => { e.error = true }
      img.src = fileUrl(media.path)
      this.images.set(media.id, e)
    }
    if (!e.ready) return null
    return { src: e.img, w: e.img.naturalWidth || media.width || 1, h: e.img.naturalHeight || media.height || 1 }
  }

  // ---------------------------------------------------------------- oynatma senkronu
  // Her karede çağrılır: aktif klipleri oynat, yaklaşanları hazırla, ötekileri durdur
  sync(project, time, playing) {
    this.fps = project.settings.fps || 30
    const wasPlaying = this.playing
    this.playing = playing
    const active = new Set()
    for (const track of project.tracks) {
      if (track.kind === 'audio' || track.hidden) continue
      for (const clip of track.clips) {
        if (clip.type !== 'video') continue
        const media = project.media[clip.mediaId]
        if (!media) continue
        const pad = clip.transition ? (clip.transition.duration || 0.5) : 0.6
        const inRange = time >= clip.start - 0.6 && time < clip.start + clip.duration + pad
        const soon = playing && clip.start > time && clip.start - time < LOOKAHEAD
        if (!inRange && !soon) continue
        const lt = Math.max(0, Math.min(clip.duration, time - clip.start))
        const st = this._mapTime(media, clip, sourceTime(clip, lt))
        const e = this._entryFor(clip, media, st)
        e.lastUsed = performance.now()
        active.add(e)
        const el = e.el
        if (!playing || clip.freeze) {
          if (!el.paused) el.pause()
          continue
        }
        if (soon && time < clip.start) {
          // hazırlık: başlangıç karesine aran, beklet
          if (!el.paused) el.pause()
          if (Math.abs(el.currentTime - st) > 0.08) this._seek(e, st)
          continue
        }
        const rate = Math.max(0.0625, Math.min(16, Math.abs(instantSpeed(clip, lt)) || 1))
        if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate
        const drift = el.currentTime - st
        if (Math.abs(drift) > 0.25 + rate * 0.05) {
          this._seek(e, st)
        } else if (Math.abs(drift) > 0.04) {
          // yumuşak düzeltme: hızı hafifçe ayarla
          el.playbackRate = Math.max(0.0625, rate * (1 - Math.max(-0.08, Math.min(0.08, drift * 0.8))))
        }
        if (el.paused && !e.seeking) { const p = el.play(); if (p && p.catch) p.catch(() => {}) }
      }
    }
    for (const e of this.pool) {
      if (!active.has(e) && !e.el.paused) e.el.pause()
    }
    if (wasPlaying !== playing && !playing) for (const e of this.pool) if (!e.el.paused) e.el.pause()
    if (Math.random() < 0.02) this._evict(false)
  }

  // Bütün video öğeleri hedef karelerine oturdu mu (durduğunda yüksek kaliteli çizim için)
  settled() {
    return this.pool.every(e => !e.seeking)
  }

  dispose() {
    for (const e of this.pool.slice()) this._destroy(e)
    this.images.clear()
  }
}
