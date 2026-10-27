import React, { useEffect, useMemo, useState } from 'react'
import { store } from '../core/store.js'
import { RATIOS } from '../core/model.js'
import Icon from './Icon.jsx'
import { Logo } from './TitleBar.jsx'
import * as A from './actions.js'
import { fs, fileUrl } from '../platform/node.js'
import { openMenu, fmtDur } from './controls.jsx'
import { loadedPacks } from '../packs/index.js'
import { REG } from '../engine/registry.js'

const RATIO_TILES = ['9:16', '16:9', '1:1', '4:5', '21:9', '4:3']

export default function Home({ ready }) {
  const [recent, setRecent] = useState([])
  const [auto, setAuto] = useState(null)
  useEffect(() => {
    setRecent(A.loadRecent())
    try {
      const p = A.autosavePath()
      if (p && fs && fs.existsSync(p)) {
        const st = fs.statSync(p)
        if (Date.now() - st.mtimeMs < 7 * 864e5) setAuto({ path: p, when: st.mtime })
      }
    } catch (e) { /* */ }
  }, [])

  const counts = useMemo(() => ({
    fx: REG.effects.list.length, tr: REG.transitions.list.length, fl: REG.filters.list.length,
    tx: REG.textTemplates.list.length + REG.textAnims.list.length, st: REG.stickers.list.length, sfx: REG.sfx.list.length + REG.music.list.length,
  }), [ready]) // eslint-disable-line

  return (
    <div className="home">
      <div className="home-hero">
        <div className="edge"><b>SWX</b> 2.0 · KESİM MASASI · {new Date().toLocaleDateString('tr-TR')}</div>
        <h1 className="home-title">Kurguya<br />başla.</h1>
        <p className="home-sub">Videoyu bırak, kes, süsle, dışa aktar. Ücretsiz, filigransız, sınırsız.</p>
        <div className="home-new">
          {RATIO_TILES.map(id => {
            const r = RATIOS.find(x => x.id === id)
            const k = 64 / Math.max(r.w, r.h)
            return (
              <button key={id} className="ratio-tile" onClick={() => A.newProject(id)}>
                <span className="rt-frame" style={{ width: r.w * k, height: r.h * k }} />
                <span className="rt-id mono">{r.label}</span>
                <span className="rt-hint">{r.hint}</span>
              </button>
            )
          })}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn lg" onClick={() => A.openProject()}><Icon name="folder" />Proje aç</button>
          <button className="btn lg ghost" onClick={async () => { A.newProject('9:16'); await A.pickAndImport({ addToTimeline: true }) }}><Icon name="import" />Video seç ve başla</button>
        </div>
        {auto && (
          <div className="home-recover">
            <Icon name="warn" size={15} />
            <span className="grow">Son oturumdan kurtarılmış bir proje var ({auto.when.toLocaleString('tr-TR')}).</span>
            <button className="btn sm" onClick={() => {
              try {
                const p = JSON.parse(fs.readFileSync(auto.path, 'utf8'))
                const orig = p.__path || null
                delete p.__path
                store.loadProject(p, orig)
                store.setUI({ dirty: true })
              } catch (e) { store.toast('Kurtarılamadı', 'error') }
            }}>Geri yükle</button>
            <button className="btn sm ghost" onClick={() => setAuto(null)}>Yoksay</button>
          </div>
        )}
        <div className="home-stats mono">
          <span><b>{counts.fx}</b> efekt</span><span><b>{counts.tr}</b> geçiş</span><span><b>{counts.fl}</b> filtre</span>
          <span><b>{counts.tx}</b> yazı stili</span><span><b>{counts.st}</b> çıkartma</span><span><b>{counts.sfx}</b> ses</span>
        </div>
      </div>
      <div className="home-recent">
        <div className="phead"><span className="ttl">Son projeler</span><span className="faint mono">{recent.length}</span></div>
        <div className="pbody">
          {!recent.length && (
            <div className="empty" style={{ paddingTop: 60 }}>
              <div className="big">Henüz proje yok</div>
              <div>Soldan bir en-boy oranı seç ya da bir videoyu pencereye sürükle.</div>
            </div>
          )}
          <div className="recent-grid">
            {recent.map(r => (
              <button key={r.path} className="recent" onClick={() => A.openProject(r.path)}
                onContextMenu={e => openMenu(e, [
                  { label: 'Aç', icon: 'folder', onClick: () => A.openProject(r.path) },
                  { label: 'Klasörde göster', icon: 'search', onClick: () => window.require && window.require('electron').ipcRenderer.invoke('shell:show', r.path) },
                ])}>
                <div className="rc-thumb">
                  {r.thumb && fs && fs.existsSync(r.thumb) ? <img src={fileUrl(r.thumb) + '?' + r.modified} alt="" /> : <Icon name="film" size={26} />}
                  <span className="rc-ratio mono">{r.ratio || ''}</span>
                </div>
                <div className="rc-name">{r.name}</div>
                <div className="rc-meta mono">{new Date(r.modified).toLocaleDateString('tr-TR')} · {fmtDur(r.duration || 0)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="home-foot mono faint">
        <Logo size={11} /> <span>paketler: {loadedPacks.join(' · ') || '—'}</span>
      </div>
    </div>
  )
}
