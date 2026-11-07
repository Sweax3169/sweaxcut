import React, { useEffect, useRef, useState, useCallback } from 'react'
import { store, useStore } from '../../core/store.js'
import * as TL from '../../core/timeline.js'
import { playback } from '../../engine/playback.js'
import { get as regGet } from '../../engine/registry.js'
import { RULER_H, HEADER_W, CLIP_COLORS, TRACK_LABELS, computeRows, rowAt } from './layout.js'
import { drawBase, drawOverlay, setImageListener } from './draw.js'
import Icon from '../Icon.jsx'
import { openMenu } from '../controls.jsx'
import * as A from '../actions.js'
import { importFiles } from '../../core/media.js'
import { cacheDir, path, droppedPaths } from '../../platform/node.js'
import { createTrack } from '../../core/model.js'

const sfxMods = import.meta.glob('../../packs/sfx/render.js', { eager: true })
const sfxRender = sfxMods['../../packs/sfx/render.js']
const libMods = import.meta.glob('../library/insert.js', { eager: true })
const libInsert = libMods['../library/insert.js']
const capMods = import.meta.glob('../library/captions-run.js')
const captionClip = (id) => { const l = capMods['../library/captions-run.js']; if (l) l().then(m => m.captionClip(id)) }

const EDGE_PX = 7

export default function Timeline() {
  return (
    <div className="panel timeline">
      <Toolbar />
      <TimelineBody />
    </div>
  )
}

// ---------------------------------------------------------------- araç çubuğu
function Toolbar() {
  const snap = useStore(s => s.ui.snap)
  const magnet = useStore(s => s.ui.magnet)
  const link = useStore(s => s.ui.linkAudio)
  const zoom = useStore(s => s.ui.zoom)
  const hasSel = useStore(s => s.selection.clips.length > 0)
  const B = ({ icon, tip, kb, onClick, on, dis }) => (
    <button className={'ibtn' + (on ? ' on' : '')} disabled={dis} onClick={onClick} data-tip={tip} data-kb={kb}><Icon name={icon} size={16} /></button>
  )
  return (
    <div className="tl-toolbar">
      <div className="row" style={{ gap: 6 }}>
        <button className="tl-auto" onClick={() => { const c = selectedVideo(); captionClip(c ? c.id : null) }} data-tip="Konuşmayı kelime kelime altyazıya çevir"><Icon name="caption" size={15} />Altyazı</button>
        <button className="tl-auto" onClick={() => store.openModal('autoedit', {})} data-tip="Videolarından tek tıkla kurgu"><Icon name="wand" size={15} />Otomatik kurgu</button>
      </div>
      <span className="tl-sep" />
      <div className="row" style={{ gap: 2 }}>
        <B icon="split" tip="Böl" kb="Ctrl+B" onClick={A.split} />
        <B icon="trash" tip="Sil" kb="Del" onClick={() => A.deleteSelected()} dis={!hasSel} />
        <span className="tl-sep" />
        <B icon="freeze" tip="Kare dondur" onClick={A.freezeFrame} />
        <B icon="reverse" tip="Ters çevir" onClick={A.toggleReverse} dis={!hasSel} />
        <B icon="mirror" tip="Ayna" onClick={() => A.mirror('h')} dis={!hasSel} />
        <B icon="rotate" tip="90° döndür" onClick={A.rotate90} dis={!hasSel} />
        <B icon="wave" tip="Sesi ayır" onClick={A.detachAudio} dis={!hasSel} />
        <B icon="dup" tip="Çoğalt" kb="Ctrl+D" onClick={A.duplicate} dis={!hasSel} />
        <span className="tl-sep" />
        <B icon="marker" tip="İşaret ekle" kb="M" onClick={() => A.addMarker()} />
        <B icon="text" tip="Yazı ekle" kb="T" onClick={() => A.addText()} />
      </div>
      <span className="grow" />
      <div className="row" style={{ gap: 2 }}>
        <B icon="magnet" tip={magnet ? 'Ana iz mıknatısı: açık' : 'Ana iz mıknatısı: kapalı'} on={magnet} onClick={() => store.setUI(u => ({ magnet: !u.magnet }))} />
        <B icon="snap" tip={snap ? 'Yakalama: açık' : 'Yakalama: kapalı'} kb="N" on={snap} onClick={() => store.setUI(u => ({ snap: !u.snap }))} />
        <B icon="link" tip={link ? 'Ses bağlantısı: açık' : 'Ses bağlantısı: kapalı'} on={link} onClick={() => store.setUI(u => ({ linkAudio: !u.linkAudio }))} />
        <span className="tl-sep" />
        <button className="ibtn" onClick={() => store.setUI(u => ({ zoom: Math.max(2, u.zoom / 1.5) }))} data-tip="Uzaklaştır" data-kb="Ctrl+−"><Icon name="zoomOut" size={15} /></button>
        <input type="range" className="tl-zoom" min={0} max={1000} value={Math.round(zoomToSlider(zoom))}
          onChange={e => store.setUI({ zoom: sliderToZoom(+e.target.value) })} data-tip="Yakınlaştırma" />
        <button className="ibtn" onClick={() => store.setUI(u => ({ zoom: Math.min(800, u.zoom * 1.5) }))} data-tip="Yakınlaştır" data-kb="Ctrl++"><Icon name="zoomIn" size={15} /></button>
        <button className="ibtn" onClick={() => window.dispatchEvent(new CustomEvent('sweax:fit-timeline'))} data-tip="Sığdır" data-kb="Shift+Z"><Icon name="fit" size={15} /></button>
      </div>
    </div>
  )
}
function selectedVideo() {
  const s = store.get()
  const id = s.selection.clips[s.selection.clips.length - 1]
  if (!id) return null
  for (const t of s.project.tracks) for (const c of t.clips) if (c.id === id && (c.type === 'video' || c.type === 'audio')) return c
  return null
}
const zoomToSlider = z => (Math.log(z / 2) / Math.log(400)) * 1000
const sliderToZoom = v => 2 * Math.pow(400, v / 1000)

// ---------------------------------------------------------------- gövde
function TimelineBody() {
  const tracks = useStore(s => s.project.tracks)
  const wrapRef = useRef(null)
  const baseRef = useRef(null)
  const ovRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 240 })
  const [scrollY, setScrollY] = useState(0)
  const st = useRef({ hover: null, drag: null, dropHint: null, snapLine: null, marquee: null, scrollY: 0 }).current
  const redrawBase = useRef(() => {})
  const redrawOv = useRef(() => {})

  // boyut
  useEffect(() => {
    const el = wrapRef.current
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.max(100, Math.floor(r.width - HEADER_W)), h: Math.max(60, Math.floor(r.height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // çizim fonksiyonları
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    for (const c of [baseRef.current, ovRef.current]) {
      c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr)
      c.style.width = size.w + 'px'; c.style.height = size.h + 'px'
    }
    let pendingBase = false
    redrawBase.current = () => {
      if (pendingBase) return
      pendingBase = true
      requestAnimationFrame(() => {
        pendingBase = false
        const s = store.get()
        drawBase(baseRef.current.getContext('2d'), {
          w: size.w, h: size.h, dpr, project: s.project, zoom: s.ui.zoom, scrollX: s.ui.scrollX, scrollY: st.scrollY,
          selection: s.selection.clips, hover: st.hover, ui: s.ui, drag: st.drag,
        })
      })
    }
    redrawOv.current = () => {
      const s = store.get()
      drawOverlay(ovRef.current.getContext('2d'), {
        w: size.w, h: size.h, dpr, zoom: s.ui.zoom, scrollX: s.ui.scrollX, scrollY: st.scrollY, time: playback.time,
        drag: st.drag, dropHint: st.dropHint, snapLine: st.snapLine, marquee: st.marquee,
      })
    }
    redrawBase.current()
    redrawOv.current()
  }, [size]) // eslint-disable-line

  // depo değişince yeniden çiz
  useEffect(() => {
    let last = null
    const unsub = store.subscribe(() => {
      const s = store.get()
      const key = s.rev + '|' + s.ui.zoom + '|' + s.ui.scrollX + '|' + s.selection.clips.join(',') + '|' + s.ui.showWaveforms + '|' + s.ui.rangeIn + '|' + s.ui.rangeOut
      if (key !== last) { last = key; redrawBase.current(); redrawOv.current() }
    })
    setImageListener(() => redrawBase.current())
    return unsub
  }, [])

  // oynatma kafası + otomatik kaydırma. Kullanıcı oynatırken başka yere kaydırdıysa (followHold) görünümü geri
  // çekmez; oynatma kafası yeniden ekrana girince ya da oynatma baştan başlayınca takip sürer.
  useEffect(() => {
    let wasPlaying = playback.playing
    return playback.onTime((t) => {
      const s = store.get()
      const x = t * s.ui.zoom - s.ui.scrollX
      const inView = x >= 0 && x <= size.w - 40
      if (playback.playing && !wasPlaying) st.followHold = false
      wasPlaying = playback.playing
      if (inView) st.followHold = false
      if (playback.playing && !inView && !st.followHold) store.setUI({ scrollX: Math.max(0, t * s.ui.zoom - 60) })
      redrawOv.current()
    })
  }, [size]) // eslint-disable-line

  // sığdır
  useEffect(() => {
    const fit = () => {
      const d = Math.max(5, TL.projectDuration(store.get().project))
      store.setUI({ zoom: Math.max(2, Math.min(800, (size.w - 60) / d)), scrollX: 0 })
    }
    window.addEventListener('sweax:fit-timeline', fit)
    return () => window.removeEventListener('sweax:fit-timeline', fit)
  }, [size])

  // ---------------------------------------------------------------- isabet testi
  const hit = useCallback((x, y) => {
    const s = store.get()
    const { rows } = computeRows(s.project.tracks)
    const yy = y + st.scrollY
    const t = (x + s.ui.scrollX) / s.ui.zoom
    if (y < RULER_H) return { zone: 'ruler', t }
    const row = rowAt(rows, yy)
    if (!row) return { zone: 'empty', t }
    const z = s.ui.zoom
    // geçiş düğmesi
    if (row.track.kind === 'video') {
      const cl = row.track.clips
      for (let i = 0; i < cl.length - 1; i++) {
        const a = cl[i], b = cl[i + 1]
        if (Math.abs(a.start + a.duration - b.start) > 0.05) continue
        const cx = (a.start + a.duration) * z - s.ui.scrollX
        if (Math.abs(x - cx) <= 8 && Math.abs(yy - (row.y + row.h / 2)) <= 9) return { zone: 'cut', row, clip: a, t }
      }
    }
    for (const c of row.track.clips) {
      const x0 = c.start * z - s.ui.scrollX, x1 = (c.start + c.duration) * z - s.ui.scrollX
      if (x >= x0 - 2 && x <= x1 + 2) {
        const yIn = yy - row.y
        // ses yumuşatma tutamacı (seçili klipte, üst kenar)
        const media = c.mediaId ? s.project.media[c.mediaId] : null
        const au = c.audio
        if (s.selection.clips.includes(c.id) && au && yIn <= 11 && (c.type === 'audio' || (c.type === 'video' && media && media.hasAudio && !au.muted))) {
          const fx0 = x0 + 6 + (au.fadeIn || 0) * z, fx1 = x1 - 6 - (au.fadeOut || 0) * z
          if (Math.abs(x - fx0) <= 6) return { zone: 'fade', row, clip: c, side: 'in', t }
          if (Math.abs(x - fx1) <= 6) return { zone: 'fade', row, clip: c, side: 'out', t }
        }
        // anahtar kare elması (alt kenar) → oraya git
        if (yIn >= row.h - 12 && c.keyframes) {
          for (const k of Object.keys(c.keyframes)) for (const kf of c.keyframes[k]) {
            if (Math.abs(x - (x0 + kf.t * z)) <= 5) return { zone: 'key', row, clip: c, time: c.start + kf.t, t }
          }
        }
        let edge = null
        const ew = Math.min(EDGE_PX, (x1 - x0) / 3)
        if (x - x0 <= ew) edge = 'start'
        else if (x1 - x <= ew) edge = 'end'
        return { zone: 'clip', row, clip: c, edge, t }
      }
    }
    return { zone: 'track', row, t }
  }, []) // eslint-disable-line

  const local = (e) => {
    const r = baseRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const snapT = (t, excludeIds, extra = []) => {
    const s = store.get()
    if (!s.ui.snap) return { time: t, snapped: false }
    const pts = TL.snapPoints(s.project, excludeIds, [playback.time, ...extra])
    return TL.snapTime(t, pts, 8 / s.ui.zoom)
  }

  // ---------------------------------------------------------------- işaretçi
  const onPointerDown = (e) => {
    if (e.button === 2) return
    const { x, y } = local(e)
    const h = hit(x, y)
    const s = store.get()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (h.zone === 'ruler') {
      playback.pause()
      const scrub = (ev) => {
        const p = local(ev)
        let t = Math.max(0, (p.x + store.get().ui.scrollX) / store.get().ui.zoom)
        if (store.get().ui.snap && !ev.shiftKey) { const sn = snapT(t, []); t = sn.time }
        playback.seek(t, { scrub: true })
      }
      scrub(e)
      st.drag = { mode: 'scrub', move: scrub }
      return
    }
    if (h.zone === 'key') {
      store.select([h.clip.id])
      playback.pause()
      playback.seek(h.time)
      return
    }
    if (h.zone === 'fade') {
      st.drag = { mode: 'fade', id: h.clip.id, side: h.side }
      return
    }
    if (h.zone === 'cut') {
      store.select([h.clip.id])
      store.setUI({ inspectorTab: 'transition' })
      if (!h.clip.transition) store.setUI({ leftTab: 'transitions' })
      return
    }
    if (h.zone === 'clip') {
      const c = h.clip
      if (h.row.track.locked) { store.select([c.id]); return }
      let sel = s.selection.clips
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        store.select([c.id], { toggle: true })
        sel = store.get().selection.clips
        if (!sel.includes(c.id)) return
      } else if (!sel.includes(c.id)) {
        store.select([c.id])
        sel = [c.id]
      }
      if (h.edge) {
        const media = c.mediaId ? s.project.media[c.mediaId] : null
        st.drag = { mode: 'trim', id: c.id, edge: h.edge, media, x0: x, started: false }
      } else {
        st.drag = { mode: 'pending-move', ids: sel.slice(), x0: x, y0: y, primary: c.id, t0: h.t, rowY: h.row.y }
      }
      return
    }
    // boş alan: seçim kutusu
    if (!e.shiftKey && !e.ctrlKey) store.select([])
    st.drag = { mode: 'marquee', x0: x, y0: y, add: e.shiftKey || e.ctrlKey }
    st.marquee = { x0: x, y0: y, x1: x, y1: y }
  }

  const onPointerMove = (e) => {
    const { x, y } = local(e)
    const s = store.get()
    const d = st.drag
    if (!d) {
      const h = hit(x, y)
      const hv = h.zone === 'clip' ? { id: h.clip.id, edge: h.edge } : h.zone === 'cut' ? { cut: h.clip.id } : null
      const cur = h.zone === 'clip' && h.edge ? 'ew-resize' : h.zone === 'fade' ? 'col-resize' : h.zone === 'key' ? 'pointer' : h.zone === 'clip' ? 'grab' : h.zone === 'ruler' ? 'text' : h.zone === 'cut' ? 'pointer' : 'default'
      baseRef.current.parentElement.style.cursor = cur
      const k = JSON.stringify(hv)
      if (k !== JSON.stringify(st.hover)) { st.hover = hv; redrawBase.current() }
      return
    }
    if (d.mode === 'scrub') { d.move(e); return }
    if (d.mode === 'fade') {
      const c = TL.getClip(s.project, d.id)
      if (!c) return
      const t = (x + s.ui.scrollX) / s.ui.zoom
      const v = d.side === 'in' ? t - c.start - 6 / s.ui.zoom : c.start + c.duration - t - 6 / s.ui.zoom
      const val = Math.max(0, Math.min(c.duration / 2, +v.toFixed(2)))
      store.edit('Ses yumuşatma', dd => { const cc = TL.getClip(dd, d.id); cc.audio[d.side === 'in' ? 'fadeIn' : 'fadeOut'] = val }, { coalesce: 'fade:' + d.id + d.side })
      return
    }
    if (d.mode === 'trim') {
      if (!d.started && Math.abs(x - d.x0) < 2) return
      d.started = true
      let t = Math.max(0, (x + s.ui.scrollX) / s.ui.zoom)
      const sn = e.shiftKey ? { time: t, snapped: false } : snapT(t, [d.id])
      t = sn.time
      st.snapLine = sn.snapped ? t : null
      store.edit('Kırp', dd => TL.trimClip(dd, d.id, d.edge, t, s.ui, d.media), { coalesce: 'trim:' + d.id })
      redrawOv.current()
      return
    }
    if (d.mode === 'pending-move') {
      if (Math.hypot(x - d.x0, y - d.y0) < 4) return
      d.mode = 'move'
      redrawBase.current()
    }
    if (d.mode === 'move') {
      const { rows } = computeRows(s.project.tracks)
      const prim = TL.getClip(s.project, d.primary)
      let dt = (x - d.x0) / s.ui.zoom
      // birincil klibin başlangıcını veya sonunu yakala
      let ns = Math.max(0, prim.start + dt)
      if (!e.shiftKey && s.ui.snap) {
        const a = snapT(ns, d.ids)
        const b = snapT(ns + prim.duration, d.ids)
        if (a.snapped && (!b.snapped || Math.abs(a.time - ns) <= Math.abs(b.time - ns - prim.duration))) { ns = a.time; st.snapLine = ns }
        else if (b.snapped) { ns = b.time - prim.duration; st.snapLine = b.time }
        else st.snapLine = null
      } else st.snapLine = null
      dt = ns - prim.start
      const minStart = Math.min(...d.ids.map(id => TL.getClip(s.project, id).start))
      if (minStart + dt < 0) dt = -minStart
      const row = rowAt(rows, y + st.scrollY)
      d.targetTrack = row ? row.track.id : null
      d.newTrack = !row
      d.dt = dt
      d.insertY = null
      const primRow = rows.find(r => r.track.clips.some(c => c.id === d.primary))
      d.ghosts = d.ids.map(id => {
        const c = TL.getClip(s.project, id)
        const r0 = rows.find(r => r.track.clips.some(cc => cc.id === id))
        let gr = r0
        if (id === d.primary && row && acceptsClip(row.track, c)) gr = row
        else if (row && primRow && r0 && acceptsClip(row.track, c)) {
          // diğer seçililer aynı kaydırmayı korur
          const off = rows.indexOf(r0) - rows.indexOf(primRow)
          const tgt = rows[rows.indexOf(row) + off]
          if (tgt && acceptsClip(tgt.track, c)) gr = tgt
        }
        return { start: c.start + dt, duration: c.duration, y: gr ? gr.y : r0.y, h: gr ? gr.h : r0.h, color: CLIP_COLORS[c.type] || '#888' }
      })
      if (!row) d.insertY = y + st.scrollY < RULER_H + 20 ? RULER_H + 4 : null
      redrawOv.current()
      return
    }
    if (d.mode === 'marquee') {
      st.marquee = { x0: d.x0, y0: d.y0, x1: x, y1: y }
      // kutunun içindeki klipler
      const { rows } = computeRows(s.project.tracks)
      const ta = (Math.min(d.x0, x) + s.ui.scrollX) / s.ui.zoom, tb = (Math.max(d.x0, x) + s.ui.scrollX) / s.ui.zoom
      const ya = Math.min(d.y0, y) + st.scrollY, yb = Math.max(d.y0, y) + st.scrollY
      const ids = []
      for (const r of rows) {
        if (r.y + r.h < ya || r.y > yb) continue
        for (const c of r.track.clips) if (c.start < tb && c.start + c.duration > ta) ids.push(c.id)
      }
      store.select(ids, { add: d.add })
      redrawOv.current()
    }
  }

  const onPointerUp = (e) => {
    const d = st.drag
    st.drag = null
    st.snapLine = null
    st.marquee = null
    if (!d) return
    const s = store.get()
    if (d.mode === 'trim' || d.mode === 'fade') store.endCoalesce()
    if (d.mode === 'pending-move') {
      // tıklama: oynatma kafasını oraya taşıma yok (CapCut gibi), sadece seçim
    }
    if (d.mode === 'move' && d.dt != null) {
      const prim = TL.getClip(s.project, d.primary)
      const srcTrack = TL.trackOf(s.project, d.primary)
      const targetTrack = d.targetTrack ? s.project.tracks.find(t => t.id === d.targetTrack) : null
      const moves = d.ids.map(id => {
        const c = TL.getClip(s.project, id)
        const tr = TL.trackOf(s.project, id)
        let trackId = tr.id
        if (id === d.primary && targetTrack && acceptsClip(targetTrack, c)) trackId = targetTrack.id
        return { id, start: c.start + d.dt, trackId }
      })
      if (d.newTrack && prim) {
        // izlerin dışına bırakıldı: yeni iz aç
        store.edit('Taşı', dd => {
          const c = TL.getClip(dd, d.primary)
          const kind = srcTrack.kind === 'video' ? 'video' : srcTrack.kind
          const nt = createTrack(kind)
          if (kind === 'audio') dd.tracks.push(nt)
          else dd.tracks.unshift(nt)
          const tr = TL.trackOf(dd, d.primary)
          tr.clips = tr.clips.filter(x => x.id !== d.primary)
          c.start = Math.max(0, c.start + d.dt)
          nt.clips.push(c)
          const others = moves.filter(m => m.id !== d.primary)
          if (others.length) TL.moveClips(dd, others, s.ui)
          if (tr.main) TL.compactMain(dd)
          TL.cleanupTracks(dd)
        })
      } else if (Math.abs(d.dt) > 1e-4 || moves.some(m => m.trackId !== TL.trackOf(s.project, m.id).id)) {
        store.edit('Taşı', dd => TL.moveClips(dd, moves, s.ui))
      }
    }
    redrawBase.current()
    redrawOv.current()
  }

  const onWheel = (e) => {
    const s = store.get()
    if (e.ctrlKey || e.altKey) {
      e.preventDefault()
      const { x } = local(e)
      const tAt = (x + s.ui.scrollX) / s.ui.zoom
      const nz = Math.max(2, Math.min(800, s.ui.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)))
      if (playback.playing) st.followHold = true
      store.setUI({ zoom: nz, scrollX: Math.max(0, tAt * nz - x) })
      return
    }
    const { height } = computeRows(s.project.tracks)
    if (e.shiftKey && height > size.h) {
      // Shift+tekerlek: izler arasında dikey kaydır
      const ny = Math.max(0, Math.min(height - size.h, st.scrollY + e.deltaY))
      st.scrollY = ny; setScrollY(ny); redrawBase.current(); redrawOv.current()
    } else {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (playback.playing) st.followHold = true
      store.setUI({ scrollX: Math.max(0, s.ui.scrollX + dx) })
    }
  }

  // dikey kaydırma çubuğu
  const { height: contentH } = computeRows(tracks)
  const maxY = Math.max(0, contentH - size.h)
  useEffect(() => { if (st.scrollY > maxY) { st.scrollY = maxY; setScrollY(maxY); redrawBase.current(); redrawOv.current() } }, [maxY]) // eslint-disable-line

  // ---------------------------------------------------------------- bağlam menüsü
  const onContext = (e) => {
    const { x, y } = local(e)
    const h = hit(x, y)
    const s = store.get()
    if (h.zone === 'clip') {
      if (!s.selection.clips.includes(h.clip.id)) store.select([h.clip.id])
      const c = h.clip
      const isMedia = c.type === 'video' || c.type === 'image'
      openMenu(e, [
        { label: 'Böl', icon: 'split', kb: 'Ctrl+B', onClick: A.split },
        { label: 'Kopyala', icon: 'copy', kb: 'Ctrl+C', onClick: A.copy },
        { label: 'Kes', icon: 'scissors', kb: 'Ctrl+X', onClick: A.cut },
        { label: 'Yapıştır', icon: 'copy', kb: 'Ctrl+V', onClick: A.paste },
        { label: 'Çoğalt', icon: 'dup', kb: 'Ctrl+D', onClick: A.duplicate },
        '-',
        (c.type === 'video' || c.type === 'audio') && { label: 'Bu klipten altyazı oluştur', icon: 'caption', onClick: () => captionClip(c.id) },
        c.type === 'text' && c.caption && { label: 'Altyazı düzenleyicisini aç', icon: 'caption', onClick: () => store.setUI({ leftTab: 'captions' }) },
        '-',
        c.type === 'video' && { label: 'Kare dondur', icon: 'freeze', onClick: A.freezeFrame },
        (c.type === 'video' || c.type === 'audio') && { label: c.reverse ? 'Ters çevirmeyi kaldır' : 'Ters çevir', icon: 'reverse', onClick: A.toggleReverse },
        c.type === 'video' && { label: 'Sesi ayır', icon: 'wave', onClick: A.detachAudio },
        isMedia && { label: 'Ayna', icon: 'mirror', onClick: () => A.mirror('h') },
        c.type === 'video' && { label: 'Hız ×2', icon: 'speed', onClick: () => A.setSpeed(c.id, 2) },
        c.type === 'video' && { label: 'Hız ×0.5 (yavaş çekim)', icon: 'speed', onClick: () => A.setSpeed(c.id, 0.5) },
        isMedia && c.transform && { label: 'Tuvali doldur', icon: 'fit', onClick: () => A.setProps(c.id, cl => { cl.fit = 'cover'; cl.transform.scale = 1 }, 'Doldur') },
        '-',
        { label: 'Dalgalı sil', icon: 'trash', kb: 'Shift+Del', onClick: () => A.deleteSelected(true) },
        { label: 'Sil', icon: 'trash', kb: 'Del', onClick: () => A.deleteSelected() },
      ])
      return
    }
    if (h.zone === 'cut') {
      openMenu(e, [
        { label: 'Geçiş seç…', icon: 'transition', onClick: () => { store.select([h.clip.id]); store.setUI({ leftTab: 'transitions' }) } },
        h.clip.transition && { label: 'Geçişi kaldır', icon: 'x', onClick: () => A.setProps(h.clip.id, c => { c.transition = null }, 'Geçişi kaldır') },
      ])
      return
    }
    openMenu(e, [
      { label: 'Yapıştır', icon: 'copy', kb: 'Ctrl+V', onClick: A.paste },
      { label: 'Medya içe aktar…', icon: 'import', onClick: () => A.pickAndImport({ addToTimeline: true }) },
      { label: 'Yazı ekle', icon: 'text', onClick: () => A.addText(null, h.t) },
      { label: 'Ayar katmanı ekle', icon: 'adjust', onClick: A.addAdjustLayer },
      { label: 'İşaret ekle', icon: 'marker', onClick: () => A.addMarker() },
      '-',
      { label: 'Tümünü seç', icon: 'check', kb: 'Ctrl+A', onClick: A.selectAll },
      { label: 'Sığdır', icon: 'fit', kb: 'Shift+Z', onClick: () => window.dispatchEvent(new CustomEvent('sweax:fit-timeline')) },
    ])
  }

  // ---------------------------------------------------------------- sürükle-bırak (kütüphane + dosyalar)
  const dragInfo = (e) => {
    const types = e.dataTransfer.types || []
    if (types.includes('application/x-sweax')) {
      try { return JSON.parse(e.dataTransfer.getData('application/x-sweax') || window.__sweaxDrag || 'null') } catch (er) { return window.__sweaxDragObj || null }
    }
    if (types.includes('Files')) return { kind: 'files' }
    return null
  }
  const onDragOver = (e) => {
    const info = window.__sweaxDragObj || dragInfo(e)
    if (!info) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const { x, y } = local(e)
    const s = store.get()
    const { rows } = computeRows(s.project.tracks)
    let t = Math.max(0, (x + s.ui.scrollX) / s.ui.zoom)
    const sn = snapT(t, [])
    t = sn.time
    const row = rowAt(rows, y + st.scrollY)
    let hint = { time: t, duration: 3, y: row ? row.y : y + st.scrollY, h: row ? row.h : 30, label: '' }
    if (info.kind === 'transition') {
      const h = hit(x, y)
      if (h.zone === 'cut' || h.zone === 'clip') {
        const c = h.zone === 'cut' ? h.clip : h.clip
        hint = { time: c.start + c.duration - 0.3, duration: 0.6, y: h.row.y, h: h.row.h, label: 'Geçiş' }
      }
    } else if (info.kind === 'media') {
      const m = s.project.media[info.id]
      if (m) hint.duration = m.type === 'image' ? 3 : m.duration
      hint.label = row && row.track.main ? 'Ana ize ekle' : 'Bindirme'
    } else if (info.kind === 'filter' || info.kind === 'effect') {
      const h = hit(x, y)
      if (h.zone === 'clip' && (h.clip.type === 'video' || h.clip.type === 'image' || (info.kind === 'effect' && (h.clip.type === 'text' || h.clip.type === 'sticker')))) {
        hint = { time: h.clip.start, duration: h.clip.duration, y: h.row.y, h: h.row.h, label: info.kind === 'filter' ? 'Klibe filtre uygula' : 'Klibe efekt uygula' }
      } else hint.label = info.kind === 'filter' ? 'Filtre katmanı' : 'Efekt katmanı'
    }
    st.dropHint = hint
    st.snapLine = sn.snapped ? t : null
    redrawOv.current()
  }
  const onDragLeave = () => { st.dropHint = null; st.snapLine = null; redrawOv.current() }
  const onDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.__handled = true
    const info = window.__sweaxDragObj || dragInfo(e)
    window.__sweaxDragObj = null
    const hint = st.dropHint
    st.dropHint = null; st.snapLine = null
    redrawOv.current()
    if (!info) return
    const { x, y } = local(e)
    const s = store.get()
    const { rows } = computeRows(s.project.tracks)
    const row = rowAt(rows, y + st.scrollY)
    const t = hint ? hint.time : Math.max(0, (x + s.ui.scrollX) / s.ui.zoom)
    const h = hit(x, y)
    if (info.kind === 'files') {
      const files = droppedPaths(e.dataTransfer)
      if (files.length) A.importAndPlace(files, t)
      return
    }
    if (info.kind === 'media') {
      // hazır arka planlar: içe aktarma bırakmadan önce bitmemiş olabilir
      let mid = info.id
      if (!s.project.media[mid] && info.path) mid = (await importFiles([info.path]))[0]
      info.id = mid
      const m = store.get().project.media[mid]
      if (!m) return
      if (m.type === 'audio') { A.addMediaToTimeline(info.id, t); return }
      const onMain = !row || row.track.main || !s.project.tracks.find(tr => tr.main).clips.length
      if (onMain) A.addMediaToTimeline(info.id, t, { toMain: true })
      else {
        let id = null
        store.edit('Bindirme ekle', d => {
          const c = TL.addMedia(d, d.media[info.id], t, s.ui, { overlay: true })
          id = c.id
          if (row && row.track.kind === 'video' && !row.track.main && TL.isFree(row.track, t, c.duration, [c.id])) {
            const cur = TL.trackOf(d, c.id)
            const target = d.tracks.find(tt => tt.id === row.track.id)
            if (cur && target && cur !== target) { cur.clips = cur.clips.filter(x => x.id !== c.id); target.clips.push(c); target.clips.sort((a, b) => a.start - b.start); TL.cleanupTracks(d) }
          }
        })
        if (id) store.select([id])
      }
      return
    }
    if (info.kind === 'transition') {
      const def = regGet('transitions', info.id)
      if (def && (h.zone === 'cut' || h.zone === 'clip')) A.applyTransition(def, h.clip.id)
      else if (def) A.applyTransition(def)
      return
    }
    if (info.kind === 'filter') {
      const def = regGet('filters', info.id)
      if (!def) return
      if (h.zone === 'clip' && (h.clip.type === 'video' || h.clip.type === 'image')) {
        store.edit('Filtre uygula', d => { const c = TL.getClip(d, h.clip.id); c.filter = { id: def.id, intensity: 1 } })
        store.select([h.clip.id])
      } else A.addFilter(def, { toClip: false, time: t })
      return
    }
    if (info.kind === 'effect') {
      const def = regGet('effects', info.id)
      if (!def) return
      if (h.zone === 'clip' && ['video', 'image', 'text', 'sticker'].includes(h.clip.type)) {
        store.select([h.clip.id])
        A.addEffect(def, { toClip: true })
      } else A.addEffect(def, { time: t })
      return
    }
    if (info.kind === 'text') { A.addText(regGet('textTemplates', info.id) || null, t); return }
    if (info.kind === 'sticker') { const def = regGet('stickers', info.id); if (def) A.addSticker(def, t); return }
    if (info.kind === 'sfx' || info.kind === 'music') {
      // kütüphane ile aynı önbellek yolunu kullan (aynı ses iki kez medya olmasın)
      const def = regGet(info.kind, info.id)
      if (!def) return
      if (libInsert && libInsert.insertAudioDef) { await libInsert.insertAudioDef(info.kind, def, t); return }
      if (!sfxRender || !sfxRender.renderToFile) return
      store.busy('Ses hazırlanıyor…')
      try {
        const out = path.join(cacheDir('generated'), info.kind + '-' + def.id + '.wav')
        await sfxRender.renderToFile(def, out)
        const ids = await importFiles([out], { role: info.kind })
        if (ids[0]) {
          let cid = null
          store.edit('Ses ekle', d => { const c = TL.addMedia(d, d.media[ids[0]], t, s.ui, { role: info.kind }); c.role = info.kind; c.name = def.name; cid = c.id })
          store.select([cid])
        }
      } finally { store.busy(null) }
      return
    }
    if (info.kind === 'layout') {
      const def = regGet('layouts', info.id)
      if (def) store.edit('Düzen uygula', d => def.apply(d, { selectedClipIds: s.selection.clips, selection: s.selection.clips, time: t, ui: s.ui, width: s.project.settings.width, height: s.project.settings.height }))
    }
  }

  return (
    <div ref={wrapRef} className="tl-body">
      <TrackHeaders scrollY={scrollY} />
      <div className="tl-canvas-wrap" onWheel={onWheel} onContextMenu={onContext}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={(e) => { const { x, y } = local(e); const h = hit(x, y); if (h.zone === 'clip' && h.clip.type === 'text') window.dispatchEvent(new CustomEvent('sweax:edit-text', { detail: h.clip.id })) }}>
        <canvas ref={baseRef} className="tl-cv" />
        <canvas ref={ovRef} className="tl-cv ov" />
        {maxY > 0 && (
          <VScroll value={scrollY} max={maxY} view={size.h} total={contentH}
            onChange={v => { st.scrollY = v; setScrollY(v); redrawBase.current(); redrawOv.current() }} />
        )}
        {!tracks.some(t => t.clips.length) && (
          <div className="tl-empty">
            <span className="edge">Videoları buraya sürükle ya da <button className="link" onClick={() => A.pickAndImport({ addToTimeline: true })}>dosya seç</button></span>
            <div className="tl-steps">
              <button className="tl-step first" onClick={() => A.pickAndImport({ addToTimeline: true })}><span className="n">1</span><b>Ekle</b><span>Video, fotoğraf, müzik</span></button>
              <button className="tl-step" onClick={() => store.openModal('autoedit', {})}><span className="n">2</span><b>Otomatik kurgu</b><span>Vuruşa göre kesim, zoom, renk</span></button>
              <button className="tl-step" onClick={() => store.setUI({ leftTab: 'captions' })}><span className="n">3</span><b>Altyazı</b><span>Konuşma kelime kelime yazıya</span></button>
              <button className="tl-step" onClick={() => store.openModal('export')}><span className="n">4</span><b>Dışa aktar</b><span>TikTok, Reels, YouTube</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function acceptsClip(track, c) {
  const acc = { video: ['video', 'image'], text: ['text'], sticker: ['sticker', 'image', 'video'], effect: ['effect', 'filter', 'adjust'], audio: ['audio'] }[track.kind] || []
  return acc.includes(c.type) && !track.locked
}

function VScroll({ value, max, view, total, onChange }) {
  const h = Math.max(24, (view / total) * (view - RULER_H))
  const top = RULER_H + (value / max) * (view - RULER_H - h)
  const down = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const y0 = e.clientY, v0 = value
    const move = ev => onChange(Math.max(0, Math.min(max, v0 + (ev.clientY - y0) * (max / (view - RULER_H - h)))))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return <div className="tl-vs" style={{ top, height: h }} onPointerDown={down} />
}

// ---------------------------------------------------------------- iz başlıkları
function TrackHeaders({ scrollY }) {
  const tracks = useStore(s => s.project.tracks)
  const { rows } = computeRows(tracks)
  const toggle = (id, key, label) => store.edit(label, d => { const t = d.tracks.find(x => x.id === id); if (t) t[key] = !t[key] })
  return (
    <div className="tl-heads" style={{ width: HEADER_W }}>
      <div className="tl-heads-ruler"><span className="edge">İzler</span></div>
      <div className="tl-heads-inner" style={{ transform: `translateY(${-scrollY}px)` }}>
        {rows.map(r => {
          const t = r.track
          const idx = tracks.filter(x => x.kind === t.kind).indexOf(t) + 1
          return (
            <div key={t.id} className={'tl-head k-' + t.kind + (t.main ? ' main' : '')} style={{ top: r.y - RULER_H, height: r.h }}>
              <span className="tl-head-bar" />
              <div className="tl-head-name">
                <span>{t.main ? 'Ana iz' : (t.name || (TRACK_LABELS[t.kind] || '') + ' ' + idx)}</span>
              </div>
              <div className="tl-head-btns">
                {t.kind === 'audio' || t.kind === 'video'
                  ? <button className={'ibtn sm' + (t.muted ? ' on' : '')} onClick={() => toggle(t.id, 'muted', t.muted ? 'Sesi aç' : 'Sessize al')} data-tip={t.muted ? 'Sesi aç' : 'Sessize al'}><Icon name={t.muted ? 'mute' : 'volume'} size={13} /></button>
                  : null}
                {t.kind !== 'audio' && <button className={'ibtn sm' + (t.hidden ? ' on' : '')} onClick={() => toggle(t.id, 'hidden', t.hidden ? 'Göster' : 'Gizle')} data-tip={t.hidden ? 'Göster' : 'Gizle'}><Icon name={t.hidden ? 'eyeOff' : 'eye'} size={13} /></button>}
                <button className={'ibtn sm' + (t.locked ? ' on' : '')} onClick={() => toggle(t.id, 'locked', t.locked ? 'Kilidi aç' : 'Kilitle')} data-tip={t.locked ? 'Kilidi aç' : 'Kilitle'}><Icon name={t.locked ? 'lock' : 'unlock'} size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
