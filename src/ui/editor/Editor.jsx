import React, { useCallback } from 'react'
import { store, useStore } from '../../core/store.js'
import Preview from '../preview/Preview.jsx'
import Timeline from '../timeline/Timeline.jsx'

// Kütüphane ve denetçi ayrı modüller; yoksa (geliştirme sırasında) yer tutucu göster
const libMods = import.meta.glob('../library/Library.jsx', { eager: true })
const insMods = import.meta.glob('../inspector/Inspector.jsx', { eager: true })
const Placeholder = ({ title }) => <div className="panel"><div className="phead"><span className="ttl">{title}</span></div></div>
const Library = (libMods['../library/Library.jsx'] && libMods['../library/Library.jsx'].default) || (() => <Placeholder title="Kütüphane" />)
const Inspector = (insMods['../inspector/Inspector.jsx'] && insMods['../inspector/Inspector.jsx'].default) || (() => <Placeholder title="Özellikler" />)

// Yeniden boyutlandırma tutamacı
function Splitter({ dir, onDrag }) {
  const down = useCallback((e) => {
    e.preventDefault()
    let last = dir === 'v' ? e.clientX : e.clientY
    const move = (ev) => {
      const cur = dir === 'v' ? ev.clientX : ev.clientY
      onDrag(cur - last)
      last = cur
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = dir === 'v' ? 'col-resize' : 'row-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [dir, onDrag])
  return <div className={'splitter ' + dir} onPointerDown={down} />
}

export default function Editor() {
  const leftW = useStore(s => s.ui.leftWidth)
  const rightW = useStore(s => s.ui.rightWidth)
  const tlH = useStore(s => s.ui.timelineHeight)
  return (
    <div className="editor" style={{ gridTemplateColumns: `${leftW}px 1px 1fr 1px ${rightW}px`, gridTemplateRows: `1fr 1px ${tlH}px` }}>
      <Library />
      <Splitter dir="v" onDrag={d => store.setUI(u => ({ leftWidth: Math.max(270, Math.min(620, u.leftWidth + d)) }))} />
      <Preview />
      <Splitter dir="v" onDrag={d => store.setUI(u => ({ rightWidth: Math.max(280, Math.min(560, u.rightWidth - d)) }))} />
      <Inspector />
      <Splitter dir="h" onDrag={d => store.setUI(u => ({ timelineHeight: Math.max(170, Math.min(window.innerHeight - 300, u.timelineHeight - d)) }))} />
      <Timeline />
    </div>
  )
}
