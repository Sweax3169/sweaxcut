// Çıkartma sekmesi: animasyonlu vektör çıkartmalar, emoji ızgarası, görselden çıkartma.
import React, { useEffect, useMemo, useRef } from 'react'
import Icon from '../Icon.jsx'
import { store } from '../../core/store.js'
import { REG } from '../../engine/registry.js'
import { importFiles } from '../../core/media.js'
import { ipc, isElectron } from '../../platform/node.js'
import { openMenu } from '../controls.jsx'
import * as A from '../actions.js'
import {
  PanelHead, SearchBox, Chips, useTabState, useRegVersion, useFiltered, catCounts, useFavs, toggleFav,
  Grid, Card, useInView, dragStart, dragEnd, useIncremental, useRecent,
} from './common.jsx'
import { insertLibraryItem, now } from './insert.js'

export default function StickersPanel({ code }) {
  useRegVersion()
  const reg = REG.stickers
  const [st, set] = useTabState('stickers', { q: '', cat: null })
  const favs = useFavs()
  const list = useFiltered(reg.list, reg.categories, { q: st.q, cat: st.cat, kind: 'sticker' })
  const counts = useMemo(() => catCounts(reg.list), [reg.list.length]) // eslint-disable-line
  const favCount = reg.list.filter(it => favs.has('sticker:' + it.id)).length
  const vectors = useMemo(() => list.filter(d => d.kind !== 'emoji'), [list])
  const emojis = useMemo(() => list.filter(d => d.kind === 'emoji'), [list])
  const recent = useRecent('sticker').map(id => reg.byId.get(id)).filter(Boolean)
  const ins = def => insertLibraryItem({ kind: 'sticker', id: def.id }, { time: now() })

  const fromImage = async () => {
    if (!isElectron || !ipc) { store.toast('Yalnızca masaüstü uygulamasında', 'info'); return }
    const files = await ipc.invoke('dialog:open', { title: 'Görselden çıkartma', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Görsel', extensions: ['png', 'gif', 'webp', 'svg', 'jpg', 'jpeg'] }] })
    if (!files.length) return
    const ids = await importFiles(files)
    let t = now()
    for (const id of ids) {
      const m = store.get().project.media[id]
      if (!m) continue
      if (m.type === 'image') A.addImageSticker(id, t)
      else A.addMediaToTimeline(id, t, { overlay: true }) // GIF: hareketli bindirme
    }
  }

  return (
    <div className="lib-main">
      <PanelHead code={code} title="Çıkartma" count={reg.list.length} unit="çıkartma" />
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder="Çıkartma ara… (ör. ateş, kalp, abone)" />
        <Chips cats={reg.categories} value={st.cat} onChange={cat => set({ cat })} counts={counts} favCount={favCount} allCount={reg.list.length} />
      </div>
      <div className="lib-body">
        <div className="lib-drop" style={{ padding: 10 }}>
          <button className="btn" onClick={fromImage}><Icon name="image" size={15} />Görselden çıkartma</button>
          <div className="hint">PNG · GIF · WEBP · SVG<br /><b>Şeffaf</b> görseller en iyi sonucu verir</div>
        </div>
        {!st.q && !st.cat && recent.length > 0 && (
          <>
            <div className="lib-sect"><div className="edge">SON KULLANILANLAR</div></div>
            <div className="emoji-grid">{recent.slice(0, 10).map(def => <StkCell key={'r' + def.id} def={def} onApply={() => ins(def)} />)}</div>
          </>
        )}
        {!reg.list.length && <div className="lib-empty"><div className="big">Çıkartma yok</div><div>Çıkartma paketi yükleniyor ya da kurulu değil.</div></div>}
        {reg.list.length > 0 && !list.length && <div className="lib-empty"><div className="mono">EŞLEŞEN ÇIKARTMA YOK</div></div>}
        {vectors.length > 0 && (
          <>
            <div className="lib-sect"><div className="edge"><b>ANİMASYONLU</b> {vectors.length}</div></div>
            <Grid items={vectors} min={80} page={36} resetKey={st.q + st.cat} render={def => (
              <Card key={def.id} kind="sticker" id={def.id} name={def.name} className="stk-card" onApply={() => ins(def)} title={def.name}
                thumb={hover => <StickerThumb def={def} hover={hover} />} badge={def.isNew ? <span className="lib-new">YENİ</span> : null} />
            )} />
          </>
        )}
        {emojis.length > 0 && (
          <>
            <div className="lib-sect"><div className="edge"><b>EMOJİ</b> {emojis.length}</div></div>
            <EmojiGrid items={emojis} resetKey={st.q + st.cat} favs={favs} onApply={ins} />
          </>
        )}
      </div>
    </div>
  )
}

function EmojiGrid({ items, resetKey, favs, onApply }) {
  const [n, sent] = useIncremental(items.length, 120, resetKey)
  return (
    <>
      <div className="emoji-grid">
        {items.slice(0, n).map(def => <StkCell key={def.id} def={def} fav={favs.has('sticker:' + def.id)} onApply={() => onApply(def)} />)}
      </div>
      {n < items.length && <div ref={sent} className="lib-more mono">+{items.length - n}</div>}
    </>
  )
}

function StkCell({ def, fav, onApply }) {
  return (
    <div className="emoji-cell" title={def.name} draggable
      onDragStart={e => dragStart(e, 'sticker', def.id, def.name)} onDragEnd={dragEnd}
      onClick={onApply}
      onContextMenu={e => openMenu(e, [{ header: def.name }, { label: 'Oynatma kafasına ekle', icon: 'plus', onClick: onApply }, { label: fav ? 'Favorilerden çıkar' : 'Favorilere ekle', icon: 'star', onClick: () => toggleFav('sticker', def.id) }])}>
      {def.src ? <img src={def.src} alt={def.name} loading="lazy" decoding="async" draggable={false} /> : <StickerThumb def={def} hover={false} />}
      {fav && <span className="fv" />}
    </div>
  )
}

// Vektör çıkartma: görünürken bir kez çiz, üzerine gelince canlandır
function StickerThumb({ def, hover }) {
  const ref = useRef(null)
  const vis = useInView(ref, '200px')
  useEffect(() => {
    const c = ref.current
    if (!c || !vis) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const box = c.parentElement.getBoundingClientRect()
    const S = Math.max(48, Math.round(Math.min(box.width || 88, box.height || 88) * dpr))
    const asp = def.aspect || 1
    c.width = S; c.height = S
    const x = c.getContext('2d')
    const params = {}
    for (const p of def.params || []) params[p.key] = p.default
    const w = asp >= 1 ? S * 0.86 : S * 0.86 * asp, h = asp >= 1 ? S * 0.86 / asp : S * 0.86
    const drawAt = (t) => {
      x.setTransform(1, 0, 0, 1, 0, 0)
      x.clearRect(0, 0, S, S)
      x.translate((S - w) / 2, (S - h) / 2)
      try {
        if (def.draw) def.draw(x, t, w, h, params)
        else if (def.src) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, w, h); im.src = def.src }
      } catch (e) { /* çizim hatası */ }
    }
    const loop = def.loop || 2
    if (!hover) { drawAt(loop * 0.62); return }
    const t0 = performance.now()
    let raf = 0, last = 0
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 33) return
      last = now
      drawAt(((now - t0) / 1000) % Math.max(0.5, loop * 1.5))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [vis, hover, def])
  return <canvas ref={ref} className="stk-canvas" />
}
