import React, { useEffect, useRef, useState, useCallback } from 'react'
import { store, useStore, findClip } from '../../core/store.js'
import { RATIOS } from '../../core/model.js'
import { timecode } from '../../core/time.js'
import { projectDuration, clipsAt } from '../../core/timeline.js'
import { playback } from '../../engine/playback.js'
import Icon from '../Icon.jsx'
import { openMenu } from '../controls.jsx'
import * as A from '../actions.js'
import { prop } from '../../core/keyframes.js'
import Scopes from './Scopes.jsx'

const audioMods = import.meta.glob('../../engine/audio.js', { eager: true })
const audioMod = audioMods['../../engine/audio.js']

export default function Preview() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [box, setBox] = useState({ w: 300, h: 500 })
  const ratio = useStore(s => s.project.settings.ratio)
  const pw = useStore(s => s.project.settings.width)
  const ph = useStore(s => s.project.settings.height)
  const safe = useStore(s => s.ui.safeArea)
  const [full, setFull] = useState(false)
  const [playing, setPlaying] = useState(false)
  const ambient = useStore(s => s.ui.ambient !== false)
  const scopes = useStore(s => !!s.ui.scopes)
  useEffect(() => playback.onState(st => setPlaying(st.playing)), [])
  // ortam ışığı: kareden örneklenen renkler monitörün çevresine yayılır
  useEffect(() => {
    if (!ambient) return
    const small = document.createElement('canvas'); small.width = 8; small.height = 4
    const x = small.getContext('2d', { willReadFrequently: true })
    let last = 0, trail = 0
    const tone = (d, x0, x1) => {
      let r = 0, g = 0, b = 0, n = 0
      for (let y = 0; y < 4; y++) for (let i = x0; i < x1; i++) { const o = (y * 8 + i) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++ }
      r /= n; g /= n; b /= n
      const m = (r + g + b) / 3, k = 1.35
      const c = v => Math.max(0, Math.min(255, Math.round(m + (v - m) * k)))
      return `rgb(${c(r)},${c(g)},${c(b)})`
    }
    const f = (c, now) => {
      if (now - last < 200) { clearTimeout(trail); trail = setTimeout(() => playback.requestRender(), 210 - (now - last)); return }
      last = now
      const el = wrapRef.current
      if (!el) return
      x.drawImage(c, 0, 0, 8, 4)
      const d = x.getImageData(0, 0, 8, 4).data
      el.style.setProperty('--amb-l', tone(d, 0, 3))
      el.style.setProperty('--amb-c', tone(d, 2, 6))
      el.style.setProperty('--amb-r', tone(d, 5, 8))
    }
    playback.afterRender.add(f)
    playback.requestRender()
    return () => { playback.afterRender.delete(f); clearTimeout(trail) }
  }, [ambient])

  useEffect(() => {
    playback.attach(canvasRef.current)
    return () => { /* bileşim bağlı kalır; editörden çıkınca ayrılır */ }
  }, [])

  // sahneyi alana sığdır
  useEffect(() => {
    const el = wrapRef.current
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const pad = 18
      const aw = Math.max(40, r.width - pad * 2), ah = Math.max(40, r.height - pad * 2)
      const k = Math.min(aw / pw, ah / ph)
      setBox({ w: Math.floor(pw * k), h: Math.floor(ph * k) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [pw, ph])

  useEffect(() => {
    if (canvasRef.current) { canvasRef.current.__displayW = box.w; playback.requestRender() }
  }, [box])

  useEffect(() => {
    const fs = () => {
      const el = stageRef.current && stageRef.current.parentElement
      if (!document.fullscreenElement) el && el.requestFullscreen && el.requestFullscreen().catch(() => {})
      else document.exitFullscreen()
    }
    const ch = () => setFull(!!document.fullscreenElement)
    window.addEventListener('sweax:fullscreen', fs)
    document.addEventListener('fullscreenchange', ch)
    return () => { window.removeEventListener('sweax:fullscreen', fs); document.removeEventListener('fullscreenchange', ch) }
  }, [])

  const ratioMenu = (e) => openMenu(e, [
    { header: 'En-boy oranı' },
    ...RATIOS.map(r => ({ label: `${r.label}  ·  ${r.hint}`, icon: r.id === ratio ? 'check' : 'ratio', onClick: () => A.setRatio(r.id) })),
  ])
  const safeMenu = (e) => openMenu(e, [
    { header: 'Güvenli alan kılavuzu' },
    ...[['none', 'Kapalı'], ['tiktok', 'TikTok'], ['shorts', 'YouTube Shorts'], ['reels', 'Instagram Reels'], ['grid', 'Üçler kuralı'], ['center', 'Merkez çizgileri']]
      .map(([v, l]) => ({ label: l, icon: safe === v ? 'check' : null, onClick: () => store.setUI({ safeArea: v }) })),
  ])

  return (
    <div className="panel preview">
      <div className="phead">
        <span className="ph-title"><i className={'live' + (playing ? ' on' : '')} />Önizleme</span>
        <span className="grow" />
        <button className="btn sm ghost" onClick={ratioMenu} data-tip="En-boy oranı"><Icon name="ratio" size={14} />{ratio}</button>
        <button className={'ibtn sm' + (safe !== 'none' ? ' on' : '')} onClick={safeMenu} data-tip="Güvenli alan"><Icon name="safe" size={14} /></button>
        <button className={'ibtn sm' + (scopes ? ' on' : '')} onClick={() => store.setUI(u => ({ scopes: !u.scopes }))} data-tip="Renk kapsamları (histogram, dalga, vektör)"><Icon name="scope" size={14} /></button>
        <QualityBtn />
        <button className="ibtn sm" onClick={() => window.dispatchEvent(new CustomEvent('sweax:fullscreen'))} data-tip="Tam ekran" data-kb="F"><Icon name="full" size={14} /></button>
      </div>
      <div ref={wrapRef} className={'stage-wrap' + (full ? ' full' : '')}>
        {ambient && <div className="amb" />}
        {scopes && !full && <Scopes onClose={() => store.setUI({ scopes: false })} />}
        <div ref={stageRef} className="stage" style={{ width: box.w, height: box.h }}>
          <canvas ref={canvasRef} className="stage-canvas" style={{ width: box.w, height: box.h }} />
          <SafeOverlay mode={safe} />
          <TransformOverlay box={box} />
        </div>
      </div>
      <Coach />
      <Transport />
    </div>
  )
}

// Rehber şeridi: dosyalar bırakılınca "sıradaki adım" önerileri (kapatılınca bir daha çıkmaz)
const capMods = import.meta.glob('../library/captions-run.js')
function Coach() {
  const coach = useStore(s => s.ui.coach)
  const has = useStore(s => s.project.tracks.some(t => t.main && t.clips.length))
  const hasCaps = useStore(s => s.project.tracks.some(t => t.clips.some(c => c.caption)))
  if (!coach || !has) return null
  let off = false
  try { off = localStorage.getItem('sweax.coach.off') === '1' } catch (e) { /* */ }
  if (off) return null
  const close = (forever) => { if (forever) { try { localStorage.setItem('sweax.coach.off', '1') } catch (e) { /* */ } } store.setUI({ coach: false }) }
  return (
    <div className="coach">
      <span className="ct">Sıradaki adım</span>
      <button className="cb" onClick={() => { store.openModal('autoedit', {}); close() }}><Icon name="wand" size={13} />Otomatik kurgu</button>
      {!hasCaps && <button className="cb" onClick={() => { const l = capMods['../library/captions-run.js']; if (l) l().then(m => m.captionClip(null)); close() }}><Icon name="caption" size={13} />Altyazı ekle</button>}
      <button className="cb" onClick={() => { store.setUI({ leftTab: 'auto' }); close() }}><Icon name="sparkle" size={13} />Güzelleştir</button>
      <button className="cb" onClick={() => { store.openModal('export'); close() }}><Icon name="export" size={13} />Dışa aktar</button>
      <span className="grow" />
      <button className="cx" onClick={() => close(true)} data-tip="Bir daha gösterme"><Icon name="x" size={12} /></button>
    </div>
  )
}

function QualityBtn() {
  const q = useStore(s => s.ui.previewQuality)
  const lab = { auto: 'Otomatik', full: 'Tam', half: '1/2', quarter: '1/4' }[q]
  return (
    <button className="btn sm ghost" data-tip="Önizleme kalitesi" onClick={e => openMenu(e, [
      { header: 'Önizleme kalitesi' },
      ...[['auto', 'Otomatik (akıcı)'], ['full', 'Tam çözünürlük'], ['half', 'Yarım'], ['quarter', 'Çeyrek (en hızlı)']]
        .map(([v, l]) => ({ label: l, icon: q === v ? 'check' : null, onClick: () => store.setUI({ previewQuality: v }) })),
    ])}>{lab}</button>
  )
}

// ---------------------------------------------------------------- oynatma denetimleri
function Transport() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const fps = useStore(s => s.project.settings.fps)
  const dur = useStore(s => projectDuration(s.project))
  const loop = useStore(s => s.ui.loop)
  const [vol, setVol] = useState(1)
  const meterRef = useRef(null)
  useEffect(() => playback.onTime(setT), [])
  useEffect(() => playback.onState(s => setPlaying(s.playing)), [])
  // VU ölçer
  useEffect(() => {
    let raf
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = meterRef.current
      if (!c) return
      const ae = audioMod && audioMod.audioEngine
      const lv = ae && ae.getLevels && playback.playing ? ae.getLevels() : { l: 0, r: 0 }
      const ctx = c.getContext('2d')
      const w = c.width, h = c.height
      ctx.clearRect(0, 0, w, h)
      const seg = 14
      for (let ch = 0; ch < 2; ch++) {
        const v = Math.min(1, Math.max(0, (ch ? lv.r : lv.l) || 0))
        const on = Math.round(v * seg)
        for (let i = 0; i < seg; i++) {
          ctx.fillStyle = i < on ? (i > seg * 0.85 ? '#ff4b3e' : i > seg * 0.65 ? '#ffb547' : '#3ddc97') : '#2c323e'
          ctx.fillRect(i * (w / seg), ch * (h / 2 + 1), w / seg - 1.5, h / 2 - 1)
        }
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="transport">
      <div className="tc mono"><span className="tc-cur">{timecode(t, fps)}</span><span className="tc-sep">/</span><span className="tc-dur">{timecode(dur, fps)}</span></div>
      <div className="tp-mid">
        <button className="ibtn" onClick={() => playback.seek(0)} data-tip="Başa git" data-kb="Home"><Icon name="prev" size={13} /></button>
        <button className="ibtn" onClick={() => playback.step(-1)} data-tip="Bir kare geri" data-kb="←"><Icon name="stepBack" size={16} sw={2} /></button>
        <button className={'tp-play' + (playing ? ' on' : '')} onClick={() => playback.toggle()} data-tip={playing ? 'Duraklat' : 'Oynat'} data-kb="Boşluk">
          <Icon name={playing ? 'pause' : 'play'} size={17} />
        </button>
        <button className="ibtn" onClick={() => playback.step(1)} data-tip="Bir kare ileri" data-kb="→"><Icon name="stepFwd" size={16} sw={2} /></button>
        <button className="ibtn" onClick={() => playback.seek(dur)} data-tip="Sona git" data-kb="End"><Icon name="next" size={13} /></button>
        <button className={'ibtn' + (loop ? ' on' : '')} onClick={() => store.setUI(u => ({ loop: !u.loop }))} data-tip="Döngü"><Icon name="loop" size={15} /></button>
      </div>
      <div className="tp-right">
        <canvas ref={meterRef} width={84} height={10} className="vu" data-tip="Ses seviyesi" />
        <button className="ibtn sm" onClick={() => { const v = vol > 0 ? 0 : 1; setVol(v); audioMod && audioMod.audioEngine && audioMod.audioEngine.setMasterVolume && audioMod.audioEngine.setMasterVolume(v) }} data-tip="Önizleme sesi">
          <Icon name={vol > 0 ? 'volume' : 'mute'} size={15} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- güvenli alan
function SafeOverlay({ mode }) {
  if (mode === 'none') return null
  if (mode === 'grid') return (
    <svg className="safe-ov" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[33.33, 66.66].map(v => <g key={v}><line x1={v} y1="0" x2={v} y2="100" /><line x1="0" y1={v} x2="100" y2={v} /></g>)}
    </svg>
  )
  if (mode === 'center') return (
    <svg className="safe-ov" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="50" y1="0" x2="50" y2="100" /><line x1="0" y1="50" x2="100" y2="50" />
    </svg>
  )
  // platform arayüzlerinin kapattığı bölgeler (yaklaşık, % olarak)
  const z = {
    tiktok: { top: 10, bottom: 22, right: 15, left: 3 },
    shorts: { top: 9, bottom: 19, right: 14, left: 3 },
    reels: { top: 11, bottom: 24, right: 13, left: 3 },
  }[mode]
  return (
    <svg className="safe-ov zones" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height={z.top} />
      <rect x="0" y={100 - z.bottom} width="100" height={z.bottom} />
      <rect x={100 - z.right} y={z.top} width={z.right} height={100 - z.top - z.bottom} />
      <rect className="ok" x={z.left} y={z.top} width={100 - z.left - z.right} height={100 - z.top - z.bottom} />
    </svg>
  )
}

// ---------------------------------------------------------------- dönüşüm tutamaçları
function TransformOverlay({ box }) {
  const sel = useStore(s => s.selection.clips)
  const rev = useStore(s => s.rev)
  const [, force] = useState(0)
  const [guides, setGuides] = useState(null)
  const ovRef = useRef(null)
  useEffect(() => {
    playback.overlayDraw = () => force(x => (x + 1) % 1e6)
    return () => { playback.overlayDraw = null }
  }, [])
  const comp = playback.comp
  const s = store.get()
  const t = playback.time
  const id = sel[sel.length - 1]
  const found = id ? findClip(s.project, id) : null
  const clip = found && found.clip
  const visual = clip && clip.type !== 'audio' && clip.type !== 'effect' && clip.type !== 'filter' && clip.type !== 'adjust'
  const active = visual && t >= clip.start - 1e-4 && t < clip.start + clip.duration
  const g = active && comp ? comp.geom.get(clip.id) : null
  void rev

  const toScreen = (gg) => {
    const k = box.w / gg.W
    return { cx: gg.cx * k, cy: gg.cy * k, w: gg.w * k, h: gg.h * k, rot: gg.rot }
  }

  // tıklayarak seçme (en üstteki klip)
  const pick = useCallback((e) => {
    if (e.target !== ovRef.current) return
    const r = ovRef.current.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const st = store.get()
    const hits = clipsAt(st.project, playback.time)
      .filter(h => h.clip.type !== 'audio' && h.clip.type !== 'effect' && h.clip.type !== 'filter' && h.clip.type !== 'adjust' && !h.track.hidden)
    const order = st.project.tracks
    hits.sort((a, b) => order.indexOf(a.track) - order.indexOf(b.track)) // üstteki iz önce
    for (const h of hits) {
      const gg = playback.comp && playback.comp.geom.get(h.clip.id)
      if (!gg) continue
      const q = toScreen(gg)
      const a = -q.rot * Math.PI / 180
      const dx = x - q.cx, dy = y - q.cy
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a)
      if (Math.abs(lx) <= q.w / 2 && Math.abs(ly) <= q.h / 2) {
        store.select([h.clip.id])
        startDrag(e, h.clip, 'move')
        return
      }
    }
    store.select([])
  }, [box]) // eslint-disable-line

  const startDrag = (e, c, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const st0 = store.get()
    const lt = Math.max(0, Math.min(c.duration, playback.time - c.start))
    const x0 = prop(c, 'transform.x', lt) || 0, y0 = prop(c, 'transform.y', lt) || 0
    const s0 = prop(c, 'transform.scale', lt) ?? 1, r0 = prop(c, 'transform.rotation', lt) || 0
    const gg = playback.comp && playback.comp.geom.get(c.id)
    const q = gg ? toScreen(gg) : { cx: box.w / 2, cy: box.h / 2, w: 100, h: 100, rot: 0 }
    const rect = ovRef.current.getBoundingClientRect()
    const px0 = e.clientX, py0 = e.clientY
    const d0 = Math.hypot(px0 - rect.left - q.cx, py0 - rect.top - q.cy) || 1
    const a0 = Math.atan2(py0 - rect.top - q.cy, px0 - rect.left - q.cx)
    void st0
    const move = (ev) => {
      if (mode === 'move') {
        let nx = x0 + (ev.clientX - px0) / box.w
        let ny = y0 + (ev.clientY - py0) / box.h
        const gx = [], gy = []
        if (!ev.altKey) {
          // merkeze ve kenarlara yapış
          const th = 6 / box.w, thy = 6 / box.h
          if (Math.abs(nx) < th) { nx = 0; gx.push(0.5) }
          if (Math.abs(ny) < thy) { ny = 0; gy.push(0.5) }
          const hw = q.w / 2 / box.w, hh = q.h / 2 / box.h
          if (Math.abs(nx - hw + 0.5) < th) { nx = hw - 0.5; gx.push(0) }
          if (Math.abs(nx + hw - 0.5) < th) { nx = 0.5 - hw; gx.push(1) }
          if (Math.abs(ny - hh + 0.5) < thy) { ny = hh - 0.5; gy.push(0) }
          if (Math.abs(ny + hh - 0.5) < thy) { ny = 0.5 - hh; gy.push(1) }
        }
        setGuides({ gx, gy })
        A.setProps(c.id, cl => { setKeyAware(cl, 'transform.x', nx); setKeyAware(cl, 'transform.y', ny) }, 'Taşı', 'drag:' + c.id)
      } else if (mode === 'scale') {
        const d = Math.hypot(ev.clientX - rect.left - q.cx, ev.clientY - rect.top - q.cy)
        let ns = Math.max(0.02, s0 * d / d0)
        if (ev.shiftKey) ns = Math.round(ns * 20) / 20
        A.setProps(c.id, cl => setKeyAware(cl, 'transform.scale', +ns.toFixed(4)), 'Ölçekle', 'drag:' + c.id)
      } else if (mode === 'rotate') {
        const a = Math.atan2(ev.clientY - rect.top - q.cy, ev.clientX - rect.left - q.cx)
        let nr = r0 + (a - a0) * 180 / Math.PI
        if (ev.shiftKey) nr = Math.round(nr / 15) * 15
        else { const sn = Math.round(nr / 90) * 90; if (Math.abs(nr - sn) < 3) nr = sn }
        A.setProps(c.id, cl => setKeyAware(cl, 'transform.rotation', +nr.toFixed(2)), 'Döndür', 'drag:' + c.id)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      store.endCoalesce()
      setGuides(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onWheel = (e) => {
    if (!clip || !visual || !e.altKey) return
    e.preventDefault()
    const lt = Math.max(0, Math.min(clip.duration, playback.time - clip.start))
    const s0 = prop(clip, 'transform.scale', lt) ?? 1
    const ns = Math.max(0.02, s0 * (e.deltaY < 0 ? 1.06 : 1 / 1.06))
    A.setProps(clip.id, cl => setKeyAware(cl, 'transform.scale', ns), 'Ölçekle', 'wheel:' + clip.id)
  }

  const q = g ? toScreen(g) : null
  return (
    <div ref={ovRef} className="xf-ov" onPointerDown={pick} onWheel={onWheel}
      onDoubleClick={() => { if (clip && clip.type === 'text') window.dispatchEvent(new CustomEvent('sweax:edit-text', { detail: clip.id })) }}>
      {q && (
        <div className={'xf-box t-' + clip.type} style={{ left: q.cx, top: q.cy, width: q.w, height: q.h, transform: `translate(-50%,-50%) rotate(${q.rot}deg)` }}
          onPointerDown={e => startDrag(e, clip, 'move')}>
          {['nw', 'ne', 'sw', 'se'].map(h => <span key={h} className={'xf-h ' + h} onPointerDown={e => startDrag(e, clip, 'scale')} />)}
          <span className="xf-rot" onPointerDown={e => startDrag(e, clip, 'rotate')}><Icon name="rotate" size={11} sw={2} /></span>
          <span className="xf-tag">{clip.type === 'text' ? 'Yazı' : clip.type === 'sticker' ? 'Çıkartma' : clip.type === 'image' ? 'Görsel' : 'Video'}</span>
        </div>
      )}
      {guides && guides.gx.map((v, i) => <div key={'x' + i} className="xf-guide v" style={{ left: v * box.w }} />)}
      {guides && guides.gy.map((v, i) => <div key={'y' + i} className="xf-guide h" style={{ top: v * box.h }} />)}
    </div>
  )
}

// anahtar kare varsa oynatma kafasında güncelle, yoksa statik değer
import { upsertKey } from '../../core/keyframes.js'
import { setPath } from '../../core/model.js'
function setKeyAware(cl, p, v) {
  const keys = cl.keyframes && cl.keyframes[p]
  if (keys && keys.length) upsertKey(cl, p, Math.max(0, Math.min(cl.duration, playback.time - cl.start)), v)
  else setPath(cl, p, v)
}
