import React, { useEffect, useState } from 'react'
import { store, useStore } from '../core/store.js'
import Icon from './Icon.jsx'
import { openMenu } from './controls.jsx'
import * as A from './actions.js'
import { ipc } from '../platform/node.js'

// Logo: çapraz kesilmiş kare çerçeve — sağ parça kesik boyunca kaymış (kurgunun "kesim"i)
export function LogoMark({ size = 22 }) {
  return (
    <svg className="lm" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h7.7L8.7 21H6a3 3 0 01-3-3V6a3 3 0 013-3z" fill="#f4f6fa" />
      <path className="lr" d="M15.3 3H18a3 3 0 013 3v12a3 3 0 01-3 3h-7.7z" fill="var(--rec)" transform="translate(0.5 -1.3)" />
    </svg>
  )
}

export function Logo({ size = 15, mark = true }) {
  return (
    <div className="logo" style={{ fontSize: size }}>
      {mark && <LogoMark size={Math.round(size * 1.55)} />}
      <span className="lw"><b>SWEAX</b><span>CUT</span></span>
    </div>
  )
}

export default function TitleBar() {
  const screen = useStore(s => s.ui.screen)
  const name = useStore(s => s.project.name)
  const dirty = useStore(s => s.ui.dirty)
  const canUndo = useStore(s => s.history.canUndo)
  const canRedo = useStore(s => s.history.canRedo)
  const [max, setMax] = useState(true)
  const [editName, setEditName] = useState(null)
  useEffect(() => {
    if (!ipc) return
    const h = (_e, st) => setMax(st.maximized)
    ipc.on('window:state', h)
    return () => ipc.removeListener('window:state', h)
  }, [])
  const ed = screen === 'editor'

  const fileMenu = (e) => openMenu(e, [
    { label: 'Yeni proje', icon: 'plus', onClick: () => store.setUI({ screen: 'home' }) },
    { label: 'Proje aç…', icon: 'folder', kb: 'Ctrl+O', onClick: () => A.openProject() },
    ed && { label: 'Kaydet', icon: 'save', kb: 'Ctrl+S', onClick: () => A.saveProject() },
    ed && { label: 'Farklı kaydet…', icon: 'save', kb: 'Ctrl+Shift+S', onClick: () => A.saveProject(true) },
    '-',
    ed && { label: 'Medya içe aktar…', icon: 'import', kb: 'Ctrl+I', onClick: () => A.pickAndImport() },
    ed && { label: 'Altyazı dosyası içe aktar…', icon: 'caption', onClick: () => store.setUI({ leftTab: 'captions' }) },
    ed && { label: 'Dışa aktar…', icon: 'export', kb: 'Ctrl+E', onClick: () => store.openModal('export') },
    ed && { label: 'Bu kareyi resim olarak kaydet…', icon: 'image', onClick: () => store.openModal('export', { mode: 'frame' }) },
    '-',
    { label: 'Ana ekran', icon: 'home', onClick: () => store.setUI({ screen: 'home' }) },
    { label: 'Çıkış', icon: 'close', onClick: () => ipc && ipc.send('win:close') },
  ])
  const editMenu = (e) => openMenu(e, [
    { label: 'Geri al', icon: 'undo', kb: 'Ctrl+Z', disabled: !canUndo, onClick: () => store.undo() },
    { label: 'Yinele', icon: 'redo', kb: 'Ctrl+Y', disabled: !canRedo, onClick: () => store.redo() },
    '-',
    { label: 'Kes', icon: 'scissors', kb: 'Ctrl+X', onClick: A.cut },
    { label: 'Kopyala', icon: 'copy', kb: 'Ctrl+C', onClick: A.copy },
    { label: 'Yapıştır', icon: 'copy', kb: 'Ctrl+V', onClick: A.paste },
    { label: 'Çoğalt', icon: 'dup', kb: 'Ctrl+D', onClick: A.duplicate },
    { label: 'Sil', icon: 'trash', kb: 'Del', onClick: () => A.deleteSelected() },
    '-',
    { label: 'Böl', icon: 'split', kb: 'Ctrl+B', onClick: A.split },
    { label: 'Kare dondur', icon: 'freeze', onClick: A.freezeFrame },
    { label: 'Sesi ayır', icon: 'wave', onClick: A.detachAudio },
    { label: 'Tümünü seç', icon: 'check', kb: 'Ctrl+A', onClick: A.selectAll },
  ])
  const viewMenu = (e) => openMenu(e, [
    { header: 'Önizleme kalitesi' },
    ...[['auto', 'Otomatik'], ['full', 'Tam'], ['half', 'Yarım'], ['quarter', 'Çeyrek']].map(([v, l]) => ({
      label: l, icon: store.get().ui.previewQuality === v ? 'check' : null, onClick: () => store.setUI({ previewQuality: v }),
    })),
    '-',
    { label: 'Dalga formlarını göster', icon: store.get().ui.showWaveforms ? 'check' : null, onClick: () => store.setUI(u => ({ showWaveforms: !u.showWaveforms })) },
    { label: 'Ortam ışığı (önizleme çevresi)', icon: store.get().ui.ambient !== false ? 'check' : null, onClick: () => store.setUI(u => ({ ambient: u.ambient === false })) },
    { label: 'Renk kapsamları', icon: store.get().ui.scopes ? 'check' : null, onClick: () => store.setUI(u => ({ scopes: !u.scopes })) },
    { label: 'Zaman çizelgesini sığdır', kb: 'Shift+Z', icon: 'fit', onClick: () => window.dispatchEvent(new CustomEvent('sweax:fit-timeline')) },
    { label: 'Tam ekran önizleme', kb: 'F', icon: 'full', onClick: () => window.dispatchEvent(new CustomEvent('sweax:fullscreen')) },
  ])
  const helpMenu = (e) => openMenu(e, [
    { label: 'Klavye kısayolları', icon: 'key', onClick: () => store.openModal('shortcuts') },
    { label: 'SWEAXCUT hakkında', icon: 'info', onClick: () => store.openModal('about') },
  ])

  return (
    <div className="titlebar">
      <div className="tb-left">
        <button className="tb-logo" onClick={() => store.setUI({ screen: 'home' })} data-tip="Ana ekran"><Logo /></button>
        <div className="tb-menus">
          <button onClick={fileMenu}>Dosya</button>
          {ed && <button onClick={editMenu}>Düzen</button>}
          {ed && <button onClick={viewMenu}>Görünüm</button>}
          <button onClick={helpMenu}>Yardım</button>
        </div>
      </div>
      <div className="tb-center">
        {ed && (editName != null
          ? <input className="tb-name-in" autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={() => { const v = editName.trim(); if (v) store.edit('Proje adı', d => { d.name = v }); setEditName(null) }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditName(null); e.stopPropagation() }} />
          : <button className="tb-name" onClick={() => setEditName(name)} data-tip="Adı değiştir">
              <span className={'tb-dot' + (dirty ? ' dirty' : '')} />{name}<span className="st">{dirty ? 'kaydedilmedi' : 'kaydedildi'}</span>
            </button>)}
      </div>
      <div className="tb-right">
        <button className="tb-cmd" onClick={() => store.openModal('command')} data-tip="Her araca, efekte ve komuta buradan ulaş"><Icon name="search" size={14} /><span>Ne yapmak istiyorsun?</span><kbd>Ctrl K</kbd></button>
        {ed && <>
          <button className="ibtn" disabled={!canUndo} onClick={() => store.undo()} data-tip="Geri al" data-kb="Ctrl+Z"><Icon name="undo" /></button>
          <button className="ibtn" disabled={!canRedo} onClick={() => store.redo()} data-tip="Yinele" data-kb="Ctrl+Y"><Icon name="redo" /></button>
          <button className="btn sig tb-export" onClick={() => store.openModal('export')} data-tip="Videoyu kaydet" data-kb="Ctrl+E"><Icon name="export" size={15} sw={2} />Dışa aktar</button>
        </>}
        <div className="tb-win">
          <button onClick={() => ipc && ipc.send('win:minimize')}><Icon name="winMin" size={15} /></button>
          <button onClick={() => ipc && ipc.send('win:maximize')}><Icon name={max ? 'winRestore' : 'winMax'} size={13} /></button>
          <button className="x" onClick={() => ipc && ipc.send('win:close')}><Icon name="close" size={14} /></button>
        </div>
      </div>
    </div>
  )
}
