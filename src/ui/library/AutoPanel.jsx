// Otomatik sekmesi: yeni başlayanın tek durağı — tek tıkla kurgu tarifleri, mevcut kurguyu "Güzelleştir",
// ve renk + geçiş + altyazıyı birlikte değiştiren görünüm paketleri.
import React, { useState } from 'react'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import { Toggle } from '../controls.jsx'
import { PanelHead, GLThumb, lsGet, lsSet, Bar } from './common.jsx'
import { RECIPES, POLISH_STEPS, LOOKS, polish, applyLook } from '../../features/autoedit/index.js'

export default function AutoPanel() {
  const clipCount = useStore(s => s.project.tracks.reduce((a, t) => a + t.clips.length, 0))
  const mediaCount = useStore(s => Object.values(s.project.media).filter(m => m.type !== 'audio').length)
  const [steps, setSteps] = useState(() => lsGet('polish', POLISH_STEPS.filter(p => p.def).map(p => p.id)))
  const [run, setRun] = useState(null)
  const [hover, setHover] = useState(null)
  const toggle = id => setSteps(s => { const n = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; lsSet('polish', n); return n })

  const doPolish = async () => {
    const ctrl = new AbortController()
    setRun({ p: 0, label: 'Başlıyor…', ctrl })
    try {
      const r = await polish(steps, { signal: ctrl.signal, onProgress: (p, label) => setRun(x => x && { ...x, p, label }) })
      store.toast(r && r.captions && /hata|bulunamadı|yok/i.test(r.captions) ? 'Güzelleştirildi · altyazı: ' + r.captions : 'Kurgu güzelleştirildi', 'ok', 2600)
    } catch (e) {
      if (e && e.name !== 'AbortError') store.toast(String(e.message || e), 'error', 4000)
    } finally { setRun(null) }
  }

  return (
    <div className="lib-main">
      <PanelHead title="Otomatik" />
      <div className="lib-body">
        <div className="lib-sect"><div className="edge"><b>Tek tıkla kurgu</b></div></div>
        <div className="auto-recipes">
          {RECIPES.map(r => (
            <button key={r.id} className="auto-rc" disabled={!mediaCount}
              onClick={() => store.openModal('autoedit', { recipe: r.id })}>
              <span className="ic"><Icon name={r.icon} size={17} /></span>
              <span className="tt"><b>{r.name}</b><span>{r.desc}</span></span>
              <Icon name="chevR" size={14} />
            </button>
          ))}
          {!mediaCount && <div className="lib-hint" style={{ padding: '2px 4px' }}>Önce <b>Medya</b> sekmesinden video ya da fotoğraf ekle.</div>}
        </div>

        <div className="lib-sect"><div className="edge"><b>Güzelleştir</b><span className="faint">· mevcut kurguya uygulanır</span></div></div>
        <div className="polish">
          {POLISH_STEPS.map(p => (
            <label key={p.id} className={'pl-row' + (steps.includes(p.id) ? ' on' : '')}>
              <span className="ic"><Icon name={p.icon} size={15} /></span>
              <span className="tt"><b>{p.name}</b><span>{p.desc}</span></span>
              <Toggle on={steps.includes(p.id)} onChange={() => toggle(p.id)} />
            </label>
          ))}
          {run ? (
            <div className="lib-progress">
              <div className="row"><span className="grow" style={{ fontWeight: 600 }}>{run.label}</span><span className="mono">{Math.round(run.p * 100)}%</span>
                <button className="ibtn sm" onClick={() => run.ctrl.abort()} data-tip="Durdur"><Icon name="x" size={12} /></button></div>
              <Bar value={run.p} indet={run.p < 0.02} />
            </div>
          ) : (
            <button className="btn sig lg" style={{ width: '100%' }} disabled={!clipCount || !steps.length} onClick={doPolish}>
              <Icon name="sparkle" size={16} />Güzelleştir
            </button>
          )}
        </div>

        <div className="lib-sect"><div className="edge"><b>Görünüm</b><span className="faint">· renk, geçiş ve altyazı birlikte</span></div></div>
        <div className="grid lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
          {LOOKS.map(L => (
            <div key={L.id} className="card lib-card look-card" onClick={async () => {
              if (!clipCount) { store.toast('Önce zaman çizelgesine klip ekle', 'info'); return }
              const n = await applyLook(L.id)
              store.toast(`"${L.name}" görünümü uygulandı${n ? ` · ${n} altyazı` : ''}`, 'ok', 1800)
            }} onMouseEnter={() => setHover(L.id)} onMouseLeave={() => setHover(null)}>
              <div className="thumb"><GLThumb kind="filter" id={L.filter} hover={hover === L.id} /></div>
              <div className="name">{L.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
