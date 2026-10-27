// PROJE (seçim yokken): ad, istatistik, en-boy oranı, kare hızı, tuval arka planı (+ bütün kliplere uygula)
import React from 'react'
import { store, useStore } from '../../core/store.js'
import { RATIOS, FPS_OPTIONS } from '../../core/model.js'
import { projectDuration } from '../../core/timeline.js'
import { timecode } from '../../core/time.js'
import * as A from '../actions.js'
import Icon from '../Icon.jsx'
import { Segmented } from '../controls.jsx'
import { Sec, Note } from './common.jsx'
import BgEditor from './BgEditor.jsx'

const selTracks = s => s.project.tracks
const selMediaN = s => Object.keys(s.project.media).length

function Frame({ r, on }) {
  const k = Math.min(34 / r.w, 34 / r.h)
  return <i className={'rframe' + (on ? ' on' : '')} style={{ width: Math.round(r.w * k), height: Math.round(r.h * k) }} />
}

export default function ProjectTab({ settings }) {
  const tracks = useStore(selTracks)
  const mediaN = useStore(selMediaN)
  let clips = 0, overrides = 0
  for (const t of tracks) for (const c of t.clips) { clips++; if (c.canvasBg) overrides++ }
  const dur = projectDuration({ tracks })
  const bg = settings.bg || { type: 'blur' }
  return (
    <>
      <Sec id="pinfo" code="01" title="Proje">
        <div className="readout four">
          <div><span className="k">Süre</span><span className="v mono">{timecode(dur, settings.fps, false)}</span></div>
          <div><span className="k">Klip</span><span className="v mono">{clips}</span></div>
          <div><span className="k">İz</span><span className="v mono">{tracks.length}</span></div>
          <div><span className="k">Medya</span><span className="v mono">{mediaN}</span></div>
        </div>
        <div className="slate mono">
          <span>{settings.width}×{settings.height}</span><span>{settings.fps} FPS</span><span>{(settings.sampleRate || 48000) / 1000} KHZ</span><span>{settings.ratio}</span>
        </div>
      </Sec>
      <Sec id="pratio" code="02" title="En-boy oranı" sub={settings.ratio}>
        <div className="ratiogrid">
          {RATIOS.map(r => (
            <button key={r.id} className={'ratio' + (r.id === settings.ratio ? ' on' : '')} onClick={() => A.setRatio(r.id)} data-tip={r.w + '×' + r.h}>
              <span className="rbox"><Frame r={r} on={r.id === settings.ratio} /></span>
              <span className="rl mono">{r.label}</span>
              <span className="rh">{r.hint}</span>
            </button>
          ))}
        </div>
      </Sec>
      <Sec id="pfps" code="03" title="Kare hızı" sub={settings.fps + ' fps'}>
        <Segmented value={settings.fps} onChange={v => store.edit('Kare hızı', d => { d.settings.fps = v })}
          options={FPS_OPTIONS.map(f => ({ value: f, label: String(f) }))} />
        <Note>Oyun kayıtları için 60, sinematik his için 24. Dışa aktarma bu hızı kullanır.</Note>
      </Sec>
      <Sec id="pbg" code="04" title="Tuval arka planı" sub={({ blur: 'bulanık', color: 'renk', gradient: 'degrade', image: 'görsel' })[bg.type]}>
        <BgEditor bg={bg} onPatch={(patch, final) => { store.edit('Arka plan', d => { d.settings.bg = { ...d.settings.bg, ...patch } }, { coalesce: 'pbg' }); if (final) store.endCoalesce() }} />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm" disabled={!overrides} onClick={() => {
            store.edit('Arka planı bütün kliplere uygula', d => { for (const t of d.tracks) for (const c of t.clips) if (c.canvasBg) c.canvasBg = null })
            store.toast(overrides + ' klip proje arka planına döndü', 'ok', 1600)
          }}><Icon name="copy" size={12} />Bütün kliplere uygula</button>
          <span className="faint" style={{ fontSize: 10.5 }}>{overrides ? overrides + ' klipte özel arka plan var' : 'Bütün klipler bunu kullanıyor'}</span>
        </div>
      </Sec>
    </>
  )
}
