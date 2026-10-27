import React, { useRef, useState, useEffect, useCallback } from 'react'
import { fitInside, formatTime, OUT_W, OUT_H, CSS_COLOR_FILTERS } from '../util.js'

// Canlı önizleme: ffmpeg çıktısının CSS ile birebir simülasyonu.
// Render beklemeden sonucun nasıl görüneceğini gösterir.

export default function PreviewStage({ file, opts, setOpts, onChooseFiles, dragOver, onSetTrim }) {
  const frameRef = useRef(null)
  const fgRef = useRef(null)
  const bgRef = useRef(null)
  const [frameH, setFrameH] = useState(600)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [curTime, setCurTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoBroken, setVideoBroken] = useState(false)
  const [safeZone, setSafeZone] = useState(false)
  const dragState = useRef(null)

  const trim = (file && file.trim) || null

  useEffect(() => {
    setPlaying(false)
    setCurTime(0)
    setVideoBroken(false)
  }, [file && file.id])

  useEffect(() => {
    if (!frameRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setFrameH(e.contentRect.height)
    })
    ro.observe(frameRef.current)
    return () => ro.disconnect()
  })

  // Hız ve ses seviyesi önizlemesi
  useEffect(() => {
    const rate = Math.min(2, Math.max(0.5, opts.speed || 1))
    const vol = Math.min(1, Math.max(0, (opts.origVolume != null ? opts.origVolume : 100) / 100))
    if (fgRef.current) {
      fgRef.current.playbackRate = rate
      fgRef.current.volume = vol
    }
    if (bgRef.current) bgRef.current.playbackRate = rate
  }, [opts.speed, opts.origVolume, file && file.id, videoBroken, opts.mode])

  const syncBg = useCallback(() => {
    const fg = fgRef.current
    const bg = bgRef.current
    if (fg && bg && Math.abs((bg.currentTime || 0) - (fg.currentTime || 0)) > 0.25) {
      try { bg.currentTime = fg.currentTime } catch (e) { /* henüz yüklenmedi */ }
    }
  }, [])

  const togglePlay = useCallback(() => {
    const fg = fgRef.current
    if (!fg) return
    if (fg.paused) {
      fg.play().catch(() => {})
      if (bgRef.current) { syncBg(); bgRef.current.play().catch(() => {}) }
    } else {
      fg.pause()
      if (bgRef.current) bgRef.current.pause()
    }
  }, [syncBg])

  const onSeek = useCallback((v) => {
    const fg = fgRef.current
    if (!fg) return
    fg.currentTime = v
    setCurTime(v)
    syncBg()
  }, [syncBg])

  const onTimeUpdate = useCallback((e) => {
    const t = e.target.currentTime
    setCurTime(t)
    syncBg()
    // Kesme aralığı içinde döngü önizlemesi
    if (trim && trim.end != null && t >= trim.end && !e.target.paused) {
      e.target.currentTime = trim.start || 0
    }
  }, [syncBg, trim])

  // Akıllı Zoom: kadrajı sürükleyerek kaydır
  const onPointerDown = useCallback((e) => {
    if (opts.mode !== 'zoom') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { x: e.clientX, y: e.clientY, fx: opts.focusX, fy: opts.focusY }
  }, [opts.mode, opts.focusX, opts.focusY])

  const onPointerMove = useCallback((e) => {
    if (!dragState.current || !frameRef.current) return
    const rect = frameRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragState.current.x) / rect.width
    const dy = (e.clientY - dragState.current.y) / rect.height
    setOpts(o => ({
      ...o,
      focusX: Math.min(1, Math.max(0, dragState.current.fx - dx * 1.4)),
      focusY: Math.min(1, Math.max(0, dragState.current.fy - dy * 1.4)),
    }))
  }, [setOpts])

  const onPointerUp = useCallback(() => { dragState.current = null }, [])

  if (!file) {
    return (
      <div className="stage">
        <div className={`stage-empty ${dragOver ? 'drag' : ''}`} onClick={onChooseFiles}>
          <div className="big-icon">🍬</div>
          <div className="se-title">Videonu buraya bırak</div>
          <div className="se-sub">
            Yatay oyun kaydın hiç kesilmeden<br />
            Shorts • TikTok • Reels formatına dönsün
          </div>
        </div>
      </div>
    )
  }

  const meta = file.meta
  const url = file.url
  const mode = opts.mode
  const colorCss = CSS_COLOR_FILTERS[opts.colorFilter] || ''

  // blur önizleme parametreleri (ffmpeg eşdeğeri: çeyrek çözünürlükte sigma → tam çözünürlük karşılığı)
  const fullSigma = (2 + (opts.blurStrength ?? 55) * 0.13) * 4
  const blurPx = Math.max(1, fullSigma * (frameH / OUT_H) * 2)
  const brightness = 1 - ((opts.bgDarken ?? 35) / 100) * 0.5

  // panel önizleme yerleşimi
  let panelCalc = null
  if (meta && mode === 'panel') {
    const dw = meta.displayWidth || meta.width
    const fg = fitInside(dw, meta.height, OUT_W, Math.floor(OUT_H * 0.72))
    const topPct = ((OUT_H - fg.h) * (opts.videoPos ?? 0.3)) / OUT_H * 100
    panelCalc = {
      topPct,
      vidPct: (fg.h / OUT_H) * 100,
      vidWPct: (fg.w / OUT_W) * 100,
      fontPx: ((opts.fontSize ?? 76) / OUT_H) * frameH,
    }
  }

  const showVideo = !videoBroken

  return (
    <>
      <div className="stage">
        <div
          className="phone-frame"
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: mode === 'zoom' ? 'grab' : 'default' }}
        >
          {showVideo && mode === 'blur' && (
            <>
              <video
                key={'bg' + file.id}
                ref={bgRef}
                className="pf-bg"
                src={url}
                muted
                loop
                playsInline
                style={{ filter: `blur(${blurPx.toFixed(1)}px) brightness(${brightness}) saturate(1.06) ${colorCss}`, transform: 'scale(1.12)' }}
              />
              <video
                key={'fg' + file.id}
                ref={fgRef}
                className="pf-fg"
                src={url}
                muted={muted}
                loop
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={e => setDuration(e.target.duration || (meta && meta.duration) || 0)}
                onSeeked={syncBg}
                onError={() => setVideoBroken(true)}
                style={colorCss ? { filter: colorCss } : undefined}
              />
            </>
          )}

          {showVideo && mode === 'zoom' && (
            <video
              key={'z' + file.id}
              ref={fgRef}
              className="pf-single"
              src={url}
              muted={muted}
              loop
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={e => setDuration(e.target.duration || (meta && meta.duration) || 0)}
              onError={() => setVideoBroken(true)}
              style={{
                objectPosition: `${(opts.focusX ?? 0.5) * 100}% ${(opts.focusY ?? 0.5) * 100}%`,
                transform: `scale(${opts.zoom ?? 1})`,
                transformOrigin: `${(opts.focusX ?? 0.5) * 100}% ${(opts.focusY ?? 0.5) * 100}%`,
                filter: colorCss || undefined,
              }}
            />
          )}

          {showVideo && mode === 'panel' && panelCalc && (
            <div className="pf-panel-layout" style={{ background: opts.panelColor, filter: colorCss || undefined }}>
              <div
                className="pf-panel-text"
                style={{ height: `${panelCalc.topPct}%`, color: opts.textColor, fontSize: panelCalc.fontPx }}
              >{opts.topText}</div>
              <video
                key={'p' + file.id}
                ref={fgRef}
                className="pf-panel-video"
                src={url}
                muted={muted}
                loop
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={e => setDuration(e.target.duration || (meta && meta.duration) || 0)}
                onError={() => setVideoBroken(true)}
                style={{ height: `${panelCalc.vidPct}%`, width: `${panelCalc.vidWPct}%`, margin: '0 auto', objectFit: 'fill', display: 'block' }}
              />
              <div
                className="pf-panel-text"
                style={{ flex: 1, color: opts.textColor, fontSize: panelCalc.fontPx }}
              >{opts.bottomText}</div>
            </div>
          )}

          {!showVideo && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center' }}>
              {file.thumb
                ? <img src={file.thumb} alt="" style={{ maxWidth: '100%', borderRadius: 12 }} />
                : <div style={{ fontSize: 40 }}>🎞️</div>}
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Bu format canlı önizlemeyi desteklemiyor.<br />Dönüştürme yine de sorunsuz çalışır. ✔
              </div>
            </div>
          )}

          {safeZone && (
            <div className="safe-zone">
              <div className="sz-bottom"><span>platform arayüzü kapatır</span></div>
              <div className="sz-right" />
            </div>
          )}

          {mode === 'zoom' && showVideo && (
            <div className="preview-note">🖐️ Kadrajı sürükleyerek kaydır</div>
          )}
        </div>
      </div>

      <div className="player-bar">
        <button className="play-btn" onClick={togglePlay} disabled={!showVideo} title={playing ? 'Duraklat' : 'Oynat'}>
          {playing ? (
            <svg width="13" height="14" viewBox="0 0 13 14"><rect x="1" y="1" width="4" height="12" rx="1.2" fill="currentColor" /><rect x="8" y="1" width="4" height="12" rx="1.2" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor" /></svg>
          )}
        </button>
        <span className="time-label">{formatTime(curTime)}</span>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || (meta && meta.duration) || 0}
          step={0.05}
          value={Math.min(curTime, duration || 999999)}
          onChange={e => onSeek(parseFloat(e.target.value))}
          disabled={!showVideo}
        />
        <span className="time-label">{formatTime(duration || (meta && meta.duration) || 0)}</span>
        <button className="mute-btn" onClick={() => setMuted(m => !m)} title={muted ? 'Sesi aç' : 'Sesi kapat'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="edit-bar">
        <button
          className="edit-chip"
          disabled={!showVideo}
          title="Videonun başlangıç noktasını şu ana ayarla"
          onClick={() => onSetTrim({ start: Math.round(curTime * 100) / 100, end: trim ? trim.end : null })}
        >⟦ Başlangıç</button>
        <button
          className="edit-chip"
          disabled={!showVideo || curTime <= ((trim && trim.start) || 0)}
          title="Videonun bitiş noktasını şu ana ayarla"
          onClick={() => onSetTrim({ start: (trim && trim.start) || 0, end: Math.round(curTime * 100) / 100 })}
        >Bitiş ⟧</button>
        {trim && (trim.start > 0 || trim.end != null) && (
          <span className="trim-badge">
            ✂ {formatTime(trim.start || 0)} – {trim.end != null ? formatTime(trim.end) : 'son'}
            <button onClick={() => onSetTrim(null)} title="Kesmeyi kaldır">✕</button>
          </span>
        )}
        {opts.speed !== 1 && <span className="trim-badge">⚡ ×{Number(opts.speed).toFixed(2)}</span>}
        {opts.musicPath && <span className="trim-badge">🎵 müzik ekli</span>}
        <div style={{ flex: 1 }} />
        <button
          className={`edit-chip ${safeZone ? 'active' : ''}`}
          title="TikTok/Reels arayüzünün kapattığı alanları göster"
          onClick={() => setSafeZone(s => !s)}
        >📱 Güvenli alan</button>
      </div>
    </>
  )
}
