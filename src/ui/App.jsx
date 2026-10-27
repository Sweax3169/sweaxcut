import React, { useEffect, useState } from 'react'
import { store, useStore } from '../core/store.js'
import { initPacks } from '../packs/index.js'
import { TipLayer, MenuLayer } from './controls.jsx'
import TitleBar from './TitleBar.jsx'
import Home from './Home.jsx'
import Editor from './editor/Editor.jsx'
import Modals from './Modals.jsx'
import { installShortcuts } from './shortcuts.js'
import * as A from './actions.js'
import { ipc } from '../platform/node.js'
import { ALL_EXTS } from '../core/media.js'

export default function App() {
  const screen = useStore(s => s.ui.screen)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initPacks().finally(() => setReady(true))
    const off = installShortcuts()
    A.startAutosave()
    if (ipc) {
      ipc.on('files:open', (_e, files) => openFiles(files))
      ipc.on('app:before-close', async () => {
        const s = store.get()
        if (s.ui.screen === 'editor' && s.ui.dirty) {
          const r = await ipc.invoke('dialog:message', {
            type: 'question', buttons: ['Kaydet ve çık', 'Kaydetmeden çık', 'Vazgeç'], defaultId: 0, cancelId: 2,
            title: 'SWEAXCUT', message: 'Projede kaydedilmemiş değişiklikler var.',
          })
          if (r === 2) return
          if (r === 0) { const ok = await A.saveProject(); if (!ok) return }
        }
        ipc.send('win:force-close')
      })
    }
    // pencereye dosya bırakma
    const over = e => { e.preventDefault() }
    const drop = e => {
      e.preventDefault()
      if (e.defaultPrevented && e.__handled) return
      const files = [...(e.dataTransfer?.files || [])].map(f => f.path).filter(Boolean)
      if (files.length && !e.__handled) openFiles(files)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => { off(); window.removeEventListener('dragover', over); window.removeEventListener('drop', drop) }
  }, [])

  return (
    <div className="app" data-screen={screen}>
      <TitleBar />
      <div className="app-body">
        {screen === 'home' ? <Home ready={ready} /> : <Editor />}
      </div>
      <Toasts />
      <Busy />
      <Modals />
      <TipLayer />
      <MenuLayer />
    </div>
  )
}

function openFiles(files) {
  const proj = files.find(f => f.toLowerCase().endsWith('.sweax'))
  if (proj) { A.openProject(proj); return }
  const media = files.filter(f => ALL_EXTS.some(e => f.toLowerCase().endsWith(e)))
  if (!media.length) return
  if (store.get().ui.screen !== 'editor') A.newProject('9:16')
  A.importAndPlace(media)
}

function Toasts() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toasts">
      {toasts.map(t => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}
    </div>
  )
}

function Busy() {
  const busy = useStore(s => s.ui.busy)
  if (!busy) return null
  return (
    <div className="busy">
      <div className="row"><span className="grow">{busy.label}</span>{busy.progress != null && <span className="mono dim">{Math.round(busy.progress * 100)}%</span>}</div>
      <div className={'bar' + (busy.progress == null ? ' indet' : '')}><i style={{ width: (busy.progress || 0) * 100 + '%' }} /></div>
    </div>
  )
}
