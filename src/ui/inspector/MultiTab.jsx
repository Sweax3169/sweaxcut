// ÇOKLU SEÇİM: ortak temel özellikler hepsine birden (birincil klibin değeri gösterilir, farklıysa "karışık")
import React from 'react'
import { getPath } from '../../core/model.js'
import { prop } from '../../core/keyframes.js'
import { playback } from '../../engine/playback.js'
import { BLEND_MODES } from '../../engine/shaders.js'
import * as A from '../actions.js'
import { Select } from '../controls.jsx'
import { Sec, Row, Vec2, IconBtns, Note } from './common.jsx'
import { setMany, clamp } from './hooks.js'
import { dB } from './AudioTab.jsx'

const TYPE_TR = { video: 'video', image: 'görsel', audio: 'ses', text: 'yazı', sticker: 'çıkartma', effect: 'efekt', filter: 'filtre', adjust: 'ayar' }

export default function MultiTab({ clips, settings }) {
  const ids = clips.map(c => c.id)
  const prim = clips[clips.length - 1]
  const vis = clips.filter(c => c.transform)
  const aud = clips.filter(c => c.audio)
  const visIds = vis.map(c => c.id), audIds = aud.map(c => c.id)
  const t = playback.time
  const valOf = (c, p, fb) => { const v = prop(c, p, clamp(t - c.start, 0, c.duration)); return v == null ? fb : v }
  const mixed = (list, p) => list.length > 1 && list.some(c => getPath(c, p) !== getPath(list[0], p))
  const pv = (list, p, fb) => { const c = list.includes(prim) ? prim : list[list.length - 1]; return c ? valOf(c, p, fb) : fb }
  const on = (list, p, label) => (v, o) => setMany(list, p, v, label, o && o.final)
  const counts = {}
  for (const c of clips) counts[c.type] = (counts[c.type] || 0) + 1
  return (
    <>
      <div className="multihead">
        <span className="big">{clips.length}</span>
        <div className="col" style={{ gap: 3 }}>
          <span className="edge" style={{ gap: 4 }}>KLİP SEÇİLİ</span>
          <span className="mtypes">{Object.entries(counts).map(([k, n]) => <span key={k} style={{ color: `var(--c-${k})` }}>■ <b>{n}</b> {TYPE_TR[k] || k}</span>)}</span>
        </div>
      </div>
      {vis.length > 0 && (
        <Sec id="mtr" code="01" title="Dönüşüm" sub={vis.length + ' görsel'}>
          <Vec2 label="Konum" cells={[
            { axis: 'X', value: pv(vis, 'transform.x', 0), onChange: on(visIds, 'transform.x', 'Konum X'), scale: settings.width, step: 1, min: -5, max: 5 },
            { axis: 'Y', value: pv(vis, 'transform.y', 0), onChange: on(visIds, 'transform.y', 'Konum Y'), scale: settings.height, step: 1, min: -5, max: 5 },
          ]} />
          <Row label="Ölçek" value={pv(vis, 'transform.scale', 1)} onChange={on(visIds, 'transform.scale', 'Ölçek')} min={0.01} max={20} sliderMin={0.05} sliderMax={4} step={1} scale={100} suffix="%" def={1}
            badge={mixed(vis, 'transform.scale') ? 'karışık' : null} />
          <Row label="Döndürme" value={pv(vis, 'transform.rotation', 0)} onChange={on(visIds, 'transform.rotation', 'Döndürme')} min={-36000} max={36000} sliderMin={-180} sliderMax={180} step={1} suffix="°" def={0}
            badge={mixed(vis, 'transform.rotation') ? 'karışık' : null} />
          <Row label="Opaklık" value={pv(vis, 'opacity', 1)} onChange={on(visIds, 'opacity', 'Opaklık')} min={0} max={1} step={1} scale={100} suffix="%" def={1}
            badge={mixed(vis, 'opacity') ? 'karışık' : null} />
          <Select label="Karışım" value={mixed(vis, 'blend') ? '' : (prim.blend || 'normal')}
            options={[...(mixed(vis, 'blend') ? [{ value: '', label: '— karışık —' }] : []), ...BLEND_MODES.map(([value, label]) => ({ value, label }))]}
            onChange={v => v && A.setProps(visIds, c => { c.blend = v }, 'Karışım modu')} />
          <IconBtns items={[
            { icon: 'rotate', label: '90°', tip: 'Hepsini 90° döndür', onClick: () => A.rotate90() },
            { icon: 'flipH', label: 'Yatay', tip: 'Hepsini yatay aynala', onClick: () => A.mirror('h') },
            { icon: 'flipV', label: 'Dikey', tip: 'Hepsini dikey aynala', onClick: () => A.mirror('v') },
          ]} />
        </Sec>
      )}
      {aud.length > 0 && (
        <Sec id="mau" code="02" title="Ses" sub={aud.length + ' klip'}>
          <Row label="Seviye" value={pv(aud, 'audio.volume', 1)} onChange={on(audIds, 'audio.volume', 'Ses seviyesi')} min={0} max={4} step={1} scale={100} suffix="%" def={1}
            badge={mixed(aud, 'audio.volume') ? 'karışık' : dB(pv(aud, 'audio.volume', 1)) + ' dB'} />
          <IconBtns items={[
            { icon: 'mute', label: 'Sessize al', onClick: () => A.setProps(audIds, c => { c.audio.muted = true }, 'Sessize al') },
            { icon: 'volume', label: 'Sesi aç', onClick: () => A.setProps(audIds, c => { c.audio.muted = false }, 'Sesi aç') },
          ]} />
        </Sec>
      )}
      <Sec id="mx" code={aud.length ? '03' : '02'} title="Toplu işlemler">
        <IconBtns items={[
          { icon: 'anim', label: 'Animasyonları kaldır', onClick: () => A.setProps(visIds, c => { c.anim = { in: null, out: null, loop: null } }, 'Animasyonları kaldır') },
          { icon: 'fx', label: 'Efektleri kaldır', onClick: () => A.setProps(visIds, c => { c.effects = [] }, 'Efektleri kaldır') },
        ]} />
        <IconBtns items={[
          { icon: 'keyframe', label: 'Anahtar kareleri temizle', onClick: () => A.setProps(ids, c => { c.keyframes = {} }, 'Anahtar kareleri temizle') },
        ]} />
        <Note>Değerler son seçilen klibe göre gösterilir; değiştirdiğin değer hepsine aynen yazılır.</Note>
      </Sec>
    </>
  )
}
