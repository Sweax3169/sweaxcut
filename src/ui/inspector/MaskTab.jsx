// MASKE: tür ızgarası + canlı şema (merkezi sürükle) + konum/boyut/döndürme/yumuşatma/köşe/ters
import React from 'react'
import { defaultMask } from '../../core/model.js'
import { playback } from '../../engine/playback.js'
import { Toggle } from '../controls.jsx'
import { Sec, Row, Vec2, Card } from './common.jsx'
import { clamp } from './hooks.js'

export const MASK_TYPES = [
  { id: 'none', name: 'Yok' },
  { id: 'linear', name: 'Doğrusal' },
  { id: 'mirror', name: 'Ayna' },
  { id: 'circle', name: 'Daire' },
  { id: 'rect', name: 'Dikdörtgen' },
  { id: 'heart', name: 'Kalp' },
  { id: 'star', name: 'Yıldız' },
  { id: 'diamond', name: 'Elmas' },
  { id: 'hexagon', name: 'Altıgen' },
]

function starPts(R, r) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 ? R * r : R
    pts.push((Math.cos(a) * rr).toFixed(2) + ',' + (Math.sin(a) * rr).toFixed(2))
  }
  return pts.join(' ')
}
function hexPts(r) {
  const R = r / Math.cos(Math.PI / 6)
  return [[R, 0], [R / 2, r], [-R / 2, r], [-R, 0], [-R / 2, -r], [R / 2, -r]].map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')
}
const HEART = 'M0,0.72 C-1.45,-0.15 -0.62,-1.25 0,-0.48 C0.62,-1.25 1.45,-0.15 0,0.72 Z'

// Şekil — merkez orijinli, (hw, hh) yarı boyut
function Shape({ type, hw, hh, round = 0, ...rest }) {
  const mn = Math.min(hw, hh)
  if (type === 'circle') return <ellipse cx="0" cy="0" rx={hw} ry={hh} {...rest} />
  if (type === 'rect') return <rect x={-hw} y={-hh} width={hw * 2} height={hh * 2} rx={round * mn} {...rest} />
  if (type === 'diamond') return <polygon points={`0,${-hh} ${hw},0 0,${hh} ${-hw},0`} {...rest} />
  if (type === 'heart') return <path d={HEART} transform={`scale(${hw / 1.1},${hh / 1.05})`} vectorEffect="non-scaling-stroke" {...rest} />
  if (type === 'star') return <polygon points={starPts(mn, 0.45)} {...rest} />
  if (type === 'hexagon') return <polygon points={hexPts(mn * 0.9)} {...rest} />
  return null
}

export function MaskGlyph({ type }) {
  const st = { fill: 'currentColor', fillOpacity: 0.22, stroke: 'currentColor', strokeWidth: 1.4 }
  return (
    <svg width="30" height="30" viewBox="-15 -15 30 30">
      {type === 'none' && <><rect x="-10" y="-10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" /><line x1="-10" y1="10" x2="10" y2="-10" stroke="currentColor" strokeWidth="1.2" /></>}
      {type === 'linear' && <><rect x="-10" y="-10" width="20" height="10" {...st} strokeWidth="0" /><line x1="-12" y1="0" x2="12" y2="0" stroke="currentColor" strokeWidth="1.6" /><rect x="-10" y="-10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" /></>}
      {type === 'mirror' && <><rect x="-10" y="-4" width="20" height="8" {...st} strokeWidth="0" /><line x1="-12" y1="-4" x2="12" y2="-4" stroke="currentColor" strokeWidth="1.4" /><line x1="-12" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.4" /><rect x="-10" y="-10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" /></>}
      {!['none', 'linear', 'mirror'].includes(type) && <Shape type={type} hw={10} hh={10} round={0.3} {...st} />}
    </svg>
  )
}

function layerAR(clip, media) {
  if (media && media.width) {
    const cr = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
    return (media.width * (1 - cr.l - cr.r)) / Math.max(1, media.height * (1 - cr.t - cr.b))
  }
  const g = playback.comp && playback.comp.geom && playback.comp.geom.get(clip.id)
  if (g && g.h) return g.w / g.h
  return 1
}

function MaskView({ ctx, m }) {
  const { clip, b, media } = ctx
  const ar = layerAR(clip, media)
  const maxW = 286, maxH = 126
  let fw = maxW, fh = maxW / ar
  if (fh > maxH) { fh = maxH; fw = maxH * ar }
  const x = b.val('mask.x', 0), y = b.val('mask.y', 0)
  const w = b.val('mask.w', 0.5), h = b.val('mask.h', 0.5)
  const rot = b.val('mask.rotation', 0)
  const cx = (0.5 + x) * fw, cy = (0.5 + y) * fh
  const hw = Math.max(1, w * fw / 2), hh = Math.max(1, h * fh / 2)
  const drag = (e) => {
    e.preventDefault()
    const x0 = e.clientX, y0 = e.clientY, mx = x, my = y
    let cur = [mx, my]
    const move = (ev) => {
      cur = [clamp(mx + (ev.clientX - x0) / fw, -1, 1), clamp(my + (ev.clientY - y0) / fh, -1, 1)]
      b.multi({ 'mask.x': +cur[0].toFixed(4), 'mask.y': +cur[1].toFixed(4) }, 'Maske konumu', false)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); b.multi({ 'mask.x': +cur[0].toFixed(4), 'mask.y': +cur[1].toFixed(4) }, 'Maske konumu', true) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const big = Math.hypot(fw, fh) * 2
  const vis = { fill: 'var(--sig)', fillOpacity: m.invert ? 0 : 0.16 }
  return (
    <div className="maskview">
      <svg width={fw} height={fh} style={{ display: 'block', overflow: 'hidden' }}>
        <defs>
          <pattern id="mvhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--line-2)" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width={fw} height={fh} fill={m.invert ? 'rgba(255,75,62,0.18)' : 'url(#mvhatch)'} />
        <g transform={`translate(${cx},${cy}) rotate(${-rot})`}>
          {m.type === 'linear' && <><rect x={-big} y={-big} width={big * 2} height={big} {...vis} fill={m.invert ? 'var(--bg-2)' : 'var(--sig)'} fillOpacity={m.invert ? 1 : 0.16} /><line x1={-big} y1="0" x2={big} y2="0" stroke="var(--sig)" strokeWidth="1.2" /></>}
          {m.type === 'mirror' && <><rect x={-big} y={-hh} width={big * 2} height={hh * 2} fill={m.invert ? 'var(--bg-2)' : 'var(--sig)'} fillOpacity={m.invert ? 1 : 0.16} /><line x1={-big} y1={-hh} x2={big} y2={-hh} stroke="var(--sig)" /><line x1={-big} y1={hh} x2={big} y2={hh} stroke="var(--sig)" /></>}
          {!['linear', 'mirror'].includes(m.type) && <Shape type={m.type} hw={hw} hh={hh} round={(m.round || 0) / 100} fill={m.invert ? 'var(--bg-2)' : 'var(--sig)'} fillOpacity={m.invert ? 1 : 0.16} stroke="var(--sig)" strokeWidth="1.2" />}
        </g>
        <g transform={`translate(${cx},${cy})`} style={{ cursor: 'move' }} onPointerDown={drag}>
          <circle r="9" fill="transparent" />
          <path d="M-5 0H5M0 -5V5" stroke="var(--tx-0)" strokeWidth="1.4" />
        </g>
      </svg>
      <span className="cbdim mono">{Math.round(x * 100)}, {Math.round(y * 100)}</span>
    </div>
  )
}

export default function MaskTab({ ctx }) {
  const { clip, b } = ctx
  const m = clip.mask || defaultMask()
  const type = m.type || 'none'
  const setType = (t) => b.edit(c => {
    c.mask = { ...defaultMask(), ...(c.mask || {}), type: t }
    if (t === 'mirror' && c.mask.h > 0.4) c.mask.h = 0.25
  }, 'Maske türü')
  const isShape = !['none', 'linear', 'mirror'].includes(type)
  return (
    <>
      <Sec id="mtype" code="01" title="Maske şekli" onReset={type !== 'none' ? () => b.edit(c => {
        c.mask = defaultMask()
        if (c.keyframes) for (const k of Object.keys(c.keyframes)) if (k.startsWith('mask.')) delete c.keyframes[k]
      }, 'Maskeyi kaldır') : null}>
        <div className="cgrid c5">
          {MASK_TYPES.map(t => (
            <Card key={t.id} on={t.id === type} name={t.name} onClick={() => setType(t.id)}><MaskGlyph type={t.id} /></Card>
          ))}
        </div>
      </Sec>
      {type !== 'none' && (
        <Sec id="mprm" code="02" title="Maske ayarı" keys={{ clip, paths: ['mask'] }}>
          <MaskView ctx={ctx} m={m} />
          <Vec2 label="Konum" hint="Katman genişliği/yüksekliği yüzdesi, merkezden"
            cells={[
              { axis: 'X', value: b.val('mask.x', 0), onChange: b.set('mask.x', 'Maske X'), scale: 100, step: 1, min: -1, max: 1, suffix: '%', kf: b.kf('mask.x'), def: 0 },
              { axis: 'Y', value: b.val('mask.y', 0), onChange: b.set('mask.y', 'Maske Y'), scale: 100, step: 1, min: -1, max: 1, suffix: '%', kf: b.kf('mask.y'), def: 0 },
            ]} />
          {isShape && (
            <Vec2 label="Boyut"
              cells={[
                { axis: 'G', value: b.val('mask.w', 0.5), onChange: b.set('mask.w', 'Maske genişliği'), scale: 100, step: 1, min: 0.01, max: 3, suffix: '%', kf: b.kf('mask.w'), def: 0.5 },
                { axis: 'Y', value: b.val('mask.h', 0.5), onChange: b.set('mask.h', 'Maske yüksekliği'), scale: 100, step: 1, min: 0.01, max: 3, suffix: '%', kf: b.kf('mask.h'), def: 0.5 },
              ]} />
          )}
          {type === 'mirror' && <Row {...b.row('mask.h', 'Bant', { def: 0.25 })} min={0.005} max={2} sliderMax={1} step={1} scale={100} suffix="%" />}
          <Row {...b.row('mask.rotation', 'Döndürme', { def: 0 })} min={-3600} max={3600} sliderMin={-180} sliderMax={180} step={1} suffix="°" />
          <Row {...b.row('mask.feather', 'Yumuşatma', { def: 0 })} min={0} max={100} step={1} />
          {type === 'rect' && <Row {...b.srow('mask.round', 'Köşe', { def: 0 })} min={0} max={100} step={1} />}
          <Toggle label="Ters çevir" on={!!m.invert} onChange={v => b.setS('mask.invert', 'Maskeyi ters çevir')(v, { final: true })} />
        </Sec>
      )}
    </>
  )
}
