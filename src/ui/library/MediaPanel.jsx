// Medya sekmesi: içe aktarma, proje medyası ızgarası, hazır arka planlar.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import { importFiles, thumbPath, loadPeaks, ALL_EXTS } from '../../core/media.js'
import { fileUrl, ipc, isElectron, droppedPaths } from '../../platform/node.js'
import { openMenu } from '../controls.jsx'
import * as A from '../actions.js'
import { PanelHead, SearchBox, useTabState, dragStart, dragEnd, useInView, norm } from './common.jsx'
import { BUILTINS, cssOf, builtinFile } from './builtins.js'
import { now } from './insert.js'

const SUBS = [
  { id: 'all', label: 'Tümü' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Ses' },
  { id: 'image', label: 'Görsel' },
]

function fmt(t) {
  if (!Number.isFinite(t) || t <= 0) return '0:00'
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60)
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0')
}

function usedIds(tracks, settings) {
  const s = new Set()
  for (const t of tracks) for (const c of t.clips) { if (c.mediaId) s.add(c.mediaId); if (c.sticker && c.sticker.mediaId) s.add(c.sticker.mediaId) }
  if (settings && settings.bg && settings.bg.mediaId) s.add(settings.bg.mediaId)
  return s
}

export default function MediaPanel({ code }) {
  const media = useStore(s => s.project.media)
  const tracks = useStore(s => s.project.tracks)
  const settings = useStore(s => s.project.settings)
  const [st, set] = useTabState('media', { q: '', sub: 'all' })
  const [sel, setSel] = useState(null)
  const [over, setOver] = useState(false)
  const used = useMemo(() => usedIds(tracks, settings), [tracks, settings])
  const all = useMemo(() => Object.values(media).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [media])
  const counts = useMemo(() => {
    const c = { all: all.length, video: 0, audio: 0, image: 0 }
    for (const m of all) c[m.type] = (c[m.type] || 0) + 1
    return c
  }, [all])
  const list = useMemo(() => all.filter(m => (st.sub === 'all' || m.type === st.sub) && (!st.q || norm(m.name).includes(norm(st.q)))), [all, st.sub, st.q])

  // panele dosya bırakma (pencere düzeyindeki "aç ve yerleştir" davranışını burada durdur)
  const dragDepth = useRef(0)
  const isFiles = e => [...(e.dataTransfer?.types || [])].includes('Files')
  const onDragEnter = e => { if (!isFiles(e)) return; dragDepth.current++; setOver(true) }
  const onDragLeave = e => { if (!isFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setOver(false) }
  const onDragOver = e => { if (isFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }
  const onDrop = async e => {
    if (!isFiles(e)) return
    e.preventDefault(); e.stopPropagation()
    e.nativeEvent.__handled = true
    dragDepth.current = 0; setOver(false)
    const files = droppedPaths(e.dataTransfer).filter(p => ALL_EXTS.some(x => p.toLowerCase().endsWith(x)))
    if (!files.length) { store.toast('Desteklenen medya dosyası yok', 'info'); return }
    const ids = await A.importAndPlace(files)
    if (ids.length) store.toast(ids.length + ' dosya zaman çizelgesine eklendi', 'ok', 1800)
  }

  const doImport = async () => {
    if (!isElectron) { store.toast('İçe aktarma yalnızca masaüstü uygulamasında', 'info'); return }
    const ids = await A.pickAndImport()
    if (ids.length) store.toast(ids.length + ' dosya zaman çizelgesine eklendi', 'ok', 1800)
  }

  return (
    <div className="lib-main" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      <PanelHead code={code} title="Medya" count={all.length} unit="dosya" />
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder="Medyada ara…" />
      </div>
      <div className="tabs lib-sub-tabs">
        {SUBS.map(s => (
          <button key={s.id} className={'tab' + (st.sub === s.id ? ' on' : '')} onClick={() => set({ sub: s.id })}>
            {s.label}<i>{counts[s.id] || 0}</i>
          </button>
        ))}
      </div>
      <div className="lib-body" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
        <div className="lib-drop">
          <button className="btn sig" onClick={doImport}><Icon name="import" size={16} sw={2} />İçe aktar</button>
          <div className="hint"><b>Video, ses, görsel</b><br />Dosyaları bu alana sürükleyip bırak · <span className="mono">Ctrl+I</span></div>
        </div>
        {!all.length ? (
          <div className="lib-empty">
            <div className="big">Makara boş</div>
            <div>Henüz medya yok. Kayıtlarını içe aktar ya da aşağıdaki hazır arka planlardan başla.</div>
          </div>
        ) : !list.length ? (
          <div className="lib-empty"><div className="mono">Eşleşen dosya yok</div></div>
        ) : (
          <div className="grid lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
            {list.map(m => <MediaCard key={m.id} m={m} used={used.has(m.id)} sel={sel === m.id} onSelect={() => setSel(m.id)} />)}
          </div>
        )}
        <Builtins settings={settings} />
      </div>
      {over && (
        <div className="lib-dropover">
          <div className="big">BIRAK</div>
          <div className="mono">Zaman çizelgesine eklenecek</div>
        </div>
      )}
    </div>
  )
}

function MediaCard({ m, used, sel, onSelect }) {
  const ref = useRef(null)
  const vis = useInView(ref, '300px')
  const [scrub, setScrub] = useState(null)
  const proc = m.status === 'processing'
  const add = (opts) => { A.addMediaToTimeline(m.id, undefined, opts || {}) }
  const menu = (e) => {
    onSelect()
    openMenu(e, [
      { header: m.name },
      { label: 'Zaman çizelgesine ekle', icon: 'plus', onClick: () => add() },
      m.type !== 'audio' && { label: 'Bindirme olarak ekle', icon: 'layers', onClick: () => add({ overlay: true }) },
      m.type === 'image' && { label: 'Çıkartma olarak ekle', icon: 'sticker', onClick: () => A.addImageSticker(m.id, now()) },
      m.type !== 'audio' && { label: 'Tuval arka planı yap', icon: 'bg', onClick: () => store.edit('Arka plan görseli', d => { d.settings.bg = { ...d.settings.bg, type: 'image', mediaId: m.id } }), disabled: m.type !== 'image' },
      '-',
      { label: 'Klasörde göster', icon: 'folder', onClick: () => ipc && ipc.invoke('shell:show', m.path), disabled: !ipc },
      { label: used ? 'Projeden kaldır (kullanımda)' : 'Projeden kaldır', icon: 'trash', disabled: used, onClick: () => store.edit('Medyayı kaldır', d => { delete d.media[m.id] }) },
    ])
  }
  let thumb = null
  if (vis) {
    if (m.type === 'image') thumb = <img src={fileUrl(m.path)} alt="" loading="lazy" decoding="async" draggable={false} />
    else if (m.type === 'video' && m.thumbsDir) {
      const n = Math.max(1, m.thumbCount || 1)
      const idx = scrub != null ? Math.min(n - 1, Math.floor(scrub * n)) : Math.min(n - 1, Math.floor(n * 0.1))
      thumb = <img src={fileUrl(thumbPath(m, idx))} alt="" decoding="async" draggable={false} />
    } else if (m.type === 'audio') thumb = <Wave m={m} />
  }
  return (
    <div ref={ref} className={'card lib-card media-card ' + m.type + (sel ? ' sel' : '')} title={m.name + (m.width ? `\n${m.width}×${m.height}` : '') + (m.duration ? ` · ${fmt(m.duration)}` : '')}
      draggable
      onDragStart={e => dragStart(e, 'media', m.id, m.name)}
      onDragEnd={dragEnd}
      onClick={() => { onSelect(); add() }}
      onContextMenu={menu}>
      <div className="thumb"
        onMouseMove={m.type === 'video' ? (e => { const r = e.currentTarget.getBoundingClientRect(); setScrub(Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width))) }) : undefined}
        onMouseLeave={() => setScrub(null)}>
        {thumb || <Icon name={m.type === 'audio' ? 'wave' : m.type === 'image' ? 'image' : 'film'} size={22} style={{ color: 'var(--tx-3)' }} />}
        <span className="type"><Icon name={m.type === 'audio' ? 'music' : m.type === 'image' ? 'image' : 'film'} size={11} /></span>
        {used && <span className="used" title="Zaman çizelgesinde kullanılıyor">Kurguda</span>}
        {m.type !== 'image' && <span className="lib-badge mono">{fmt(m.duration)}</span>}
        {m.type === 'image' && m.width ? <span className="lib-badge mono">{m.width}×{m.height}</span> : null}
        {scrub != null && <span className="scrub" style={{ left: scrub * 100 + '%' }} />}
        {proc && <span className="prog"><i style={{ width: Math.round((m.progress || 0) * 100) + '%' }} /></span>}
        {proc && !m.thumbsDir && m.type === 'video' && <span className="proc">İşleniyor %{Math.round((m.progress || 0) * 100)}</span>}
        {m.error && <span className="err" title={m.error}><Icon name="warn" size={18} /></span>}
        <button className="add" title="Zaman çizelgesine ekle" onClick={e => { e.stopPropagation(); add() }}><Icon name="plus" size={13} sw={2.2} /></button>
      </div>
      <div className="name">{m.name}</div>
    </div>
  )
}

// Ses dosyası: tepe değerlerinden dalga formu
function Wave({ m }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const x = c.getContext('2d')
    const W = c.width = 240, H = c.height = 160
    x.fillStyle = '#0b1512'; x.fillRect(0, 0, W, H)
    const peaks = loadPeaks(m)
    x.fillStyle = '#2ee6a6'
    if (!peaks || !peaks.length) {
      for (let i = 0; i < 60; i++) { const h = (0.15 + 0.5 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))) * H * 0.7; x.globalAlpha = 0.35; x.fillRect(i * 4, (H - h) / 2, 2, h) }
      return
    }
    const bars = 60, per = peaks.length / bars
    for (let i = 0; i < bars; i++) {
      let mx = 0
      for (let j = Math.floor(i * per); j < Math.floor((i + 1) * per); j++) mx = Math.max(mx, peaks[j] || 0)
      const h = Math.max(2, (mx / 255) * H * 0.8)
      x.fillRect(i * 4, (H - h) / 2, 2, h)
    }
  }, [m.peaksPath])
  return <canvas ref={ref} className="wave" />
}

function Builtins({ settings }) {
  const W = settings.width, H = settings.height
  const use = async (def, overlay) => {
    if (!isElectron) { store.toast('Hazır arka planlar masaüstü uygulamasında üretilir', 'info'); return }
    const p = builtinFile(def, W, H)
    const ids = await importFiles([p])
    if (!ids[0]) return
    store.edit('medya', d => { if (d.media[ids[0]]) { d.media[ids[0]].name = def.name; d.media[ids[0]].generated = true } }, { noHistory: true })
    A.addMediaToTimeline(ids[0], undefined, overlay ? { overlay: true } : {})
  }
  return (
    <>
      <div className="lib-sect"><div className="edge"><b>Hazır arka planlar</b><span className="faint">· düz renk, degrade · {settings.ratio}</span></div></div>
      <div className="grid lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: '8px 6px' }}>
        {BUILTINS.map(def => (
          <div key={def.id} className="card lib-card builtin-card" title={def.name + ' — tıkla: ekle'}
            draggable
            onDragStart={e => {
              const obj = dragStart(e, 'media', null, def.name, { builtin: def.id })
              // dosyayı hemen üret, içe aktarmayı başlat; bırakılana kadar id dolar
              try {
                const p = builtinFile(def, W, H)
                obj.path = p
                if (p) importFiles([p]).then(ids => { obj.id = ids[0] || null })
              } catch (err) { /* */ }
            }}
            onDragEnd={dragEnd}
            onClick={() => use(def)}
            onContextMenu={e => openMenu(e, [{ header: def.name }, { label: 'Ana ize ekle', icon: 'plus', onClick: () => use(def) }, { label: 'Bindirme olarak ekle', icon: 'layers', onClick: () => use(def, true) }])}>
            <div className="thumb"><span className="sw" style={{ background: cssOf(def) }} /><span className="add"><Icon name="plus" size={12} sw={2.2} /></span></div>
            <div className="name">{def.name}</div>
          </div>
        ))}
      </div>
    </>
  )
}
