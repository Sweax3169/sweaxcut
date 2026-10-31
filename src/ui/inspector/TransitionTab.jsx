// GEÇİŞ: bu klipten sonrakine geçiş — ad, süre, parametreler, kaldır, tümüne uygula
import React, { useState } from 'react'
import { store } from '../../core/store.js'
import { mainTrack } from '../../core/timeline.js'
import { get as regGet } from '../../engine/registry.js'
import Icon from '../Icon.jsx'
import { Sec, Row, ParamControls, Note, Empty } from './common.jsx'
import { EffectPicker } from './EffectsTab.jsx'
import { useRegCats } from './hooks.js'

export default function TransitionTab({ ctx }) {
  const { clip, b } = ctx
  const tr = clip.transition
  const cats = useRegCats('transitions')
  const [pick, setPick] = useState(false)
  if (!tr) {
    return (
      <Empty title="Geçiş yok" text="Zaman çizelgesinde iki klibin arasındaki kesime bir geçiş bırak.">
        <button className="btn sm" onClick={() => store.setUI({ leftTab: 'transitions' })}><Icon name="transition" size={13} />Geçişler</button>
      </Empty>
    )
  }
  const def = regGet('transitions', tr.id)
  const cat = def ? (cats.find(c => c.id === def.category) || {}).name || def.category : null
  const setDur = (v, o) => { b.edit(c => { if (c.transition) c.transition.duration = v }, 'Geçiş süresi', 'trd:' + clip.id); if (o && o.final) store.endCoalesce() }
  const applyAll = () => {
    const src = JSON.parse(JSON.stringify(tr))
    let n = 0
    store.edit('Geçişi tümüne uygula', d => {
      const m = mainTrack(d)
      if (!m) return
      for (let i = 0; i < m.clips.length - 1; i++) {
        const c = m.clips[i]
        if (c.type !== 'video' && c.type !== 'image') continue
        c.transition = JSON.parse(JSON.stringify(src)); n++
      }
    })
    store.toast(n + ' kesime uygulandı', 'ok', 1600)
  }
  return (
    <>
      <Sec id="trn" code="01" title="Geçiş" sub={def ? def.name : tr.id}>
        <div className="curfilter">
          <i className="fsw trsw"><Icon name="transition" size={15} /></i>
          <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="fname">{def ? def.name : tr.id}</span>
            <span className="faint" style={{ fontSize: 11 }}>{def ? (cat || '') : 'Kayıtlı değil'} · sonraki klibe</span>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn sm" onClick={() => setPick(!pick)}>Değiştir</button>
            {pick && <div className="picker-anchor"><EffectPicker kind="transitions" libTab="transitions" icon="transition" noun="Geçiş" current={tr.id}
              onClose={() => setPick(false)}
              onPick={(d) => { b.edit(c => { c.transition = { id: d.id, duration: c.transition ? c.transition.duration : (d.duration || 0.6), params: {} } }, 'Geçişi değiştir'); setPick(false) }} /></div>}
          </div>
        </div>
        <Row label="Süre" value={tr.duration || 0.6} min={0.1} max={3} step={0.05} digits={2} suffix=" sn" def={def ? def.duration || 0.6 : 0.6} onChange={setDur} />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm" onClick={applyAll}><Icon name="copy" size={12} />Tümüne uygula</button>
          <span className="grow" />
          <button className="btn sm danger" onClick={() => b.edit(c => { c.transition = null }, 'Geçişi kaldır')}><Icon name="trash" size={12} />Kaldır</button>
        </div>
      </Sec>
      {def && def.params && def.params.length > 0 && (
        <Sec id="trp" code="02" title="Parametreler" onReset={() => b.edit(c => { c.transition.params = {} }, 'Geçiş ayarlarını sıfırla')}>
          <ParamControls schema={def.params} values={tr.params}
            onChange={(k, v, o) => { b.edit(c => { c.transition.params = { ...(c.transition.params || {}), [k]: v } }, 'Geçiş ayarı', 'trp:' + clip.id + k); if (o && o.final) store.endCoalesce() }} />
        </Sec>
      )}
      {!def && <Note>Bu geçiş kayıt defterinde yok (paket yüklenmemiş olabilir).</Note>}
    </>
  )
}
