// HIZ: Normal (log ölçekli 0.1×–100×) / Eğri (hazır eğriler + sürüklenebilir eğri düzenleyici), ters çevir, kare dondur, perde koruma
import React, { useEffect, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import { shortTime } from '../../core/time.js'
import * as A from '../actions.js'
import Icon from '../Icon.jsx'
import { Toggle } from '../controls.jsx'
import { Sec, Row, SubTabs, Card, Note, IconBtns } from './common.jsx'
import { useReg, clamp } from './hooks.js'

const LOG = { to: v => Math.log10(Math.max(1e-3, v)), from: s => Math.pow(10, s) }
const QUICK = [0.25, 0.5, 1, 1.5, 2, 4, 8]

// time.js ile aynı ara değerleme (yumuşak adım)
export function curveAt(points, x) {
  if (!points || !points.length) return 1
  if (x <= points[0].x) return points[0].y
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (x <= b.x) {
      const k = (x - a.x) / Math.max(1e-6, b.x - a.x)
      const s = k * k * (3 - 2 * k)
      return a.y + (b.y - a.y) * s
    }
  }
  return points[points.length - 1].y
}
function curveMean(points) {
  let acc = 0
  const N = 128
  for (let i = 0; i < N; i++) acc += curveAt(points, (i + 0.5) / N)
  return acc / N
}

// Küçük eğri resmi (kartlar)
function MiniCurve({ points, w = 46, h = 26 }) {
  const ly = (y) => h - 3 - ((Math.log10(clamp(y, 0.1, 10)) + 1) / 2) * (h - 6)
  let d = ''
  for (let i = 0; i <= 30; i++) { const x = i / 30; d += (i ? 'L' : 'M') + (x * (w - 4) + 2).toFixed(1) + ' ' + ly(curveAt(points, x)).toFixed(1) }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1="2" x2={w - 2} y1={ly(1)} y2={ly(1)} stroke="var(--line-3)" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------- eğri düzenleyici
function CurveEditor({ points, onChange }) {
  const W = 290, H = 138, L = 30, R = 8, T = 10, B = 16
  const iw = W - L - R, ih = H - T - B
  const [pts, setPts] = useState(points)
  const [hot, setHot] = useState(-1)
  const dragging = useRef(false)
  const svg = useRef(null)
  useEffect(() => { if (!dragging.current) setPts(points) }, [points])
  const px = (x) => L + x * iw
  const py = (y) => T + (1 - (Math.log10(clamp(y, 0.1, 10)) + 1) / 2) * ih
  const inv = (cx, cy) => {
    const r = svg.current.getBoundingClientRect()
    const x = clamp((cx - r.left - L) / iw, 0, 1)
    const yl = clamp(1 - (cy - r.top - T) / ih, 0, 1) * 2 - 1
    return { x, y: Math.pow(10, yl) }
  }
  const snapY = (y) => {
    for (const s of [0.25, 0.5, 1, 2, 4]) if (Math.abs(Math.log10(y) - Math.log10(s)) < 0.035) return s
    return Math.round(y * 100) / 100
  }
  const down = (e, i) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = true
    setHot(i)
    let cur = pts
    const move = (ev) => {
      const p = inv(ev.clientX, ev.clientY)
      const n = cur.map(q => ({ ...q }))
      const lo = i === 0 ? 0 : n[i - 1].x + 0.02, hi = i === n.length - 1 ? 1 : n[i + 1].x - 0.02
      n[i].x = i === 0 ? 0 : i === n.length - 1 ? 1 : clamp(p.x, lo, hi)
      n[i].y = ev.shiftKey ? p.y : snapY(p.y)
      n[i].x = Math.round(n[i].x * 1000) / 1000
      cur = n
      setPts(n)
      onChange(n, false)
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onChange(cur, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const addAt = (e) => {
    const p = inv(e.clientX, e.clientY)
    if (p.x <= 0.01 || p.x >= 0.99) return
    const n = [...pts, { x: Math.round(p.x * 1000) / 1000, y: snapY(p.y) }].sort((a, b) => a.x - b.x)
    setPts(n); onChange(n, true)
  }
  const remove = (i) => {
    if (i === 0 || i === pts.length - 1 || pts.length <= 2) return
    const n = pts.filter((_, j) => j !== i)
    setPts(n); onChange(n, true); setHot(-1)
  }
  let d = ''
  for (let i = 0; i <= 120; i++) { const x = i / 120; d += (i ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(curveAt(pts, x)).toFixed(1) }
  const fillD = d + `L${px(1)} ${py(1)} L${px(0)} ${py(1)} Z`
  const hp = hot >= 0 && pts[hot]
  return (
    <div className="curveed">
      <svg ref={svg} width={W} height={H} onDoubleClick={addAt}>
        {[10, 4, 2, 1, 0.5, 0.25, 0.1].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke={v === 1 ? 'var(--line-3)' : 'var(--line)'} strokeDasharray={v === 1 ? '3 3' : null} />
            {[10, 1, 0.1, 4, 0.25].includes(v) && <text x={L - 5} y={py(v) + 3} textAnchor="end" className="cax">{v}×</text>}
          </g>
        ))}
        {[0.25, 0.5, 0.75].map(x => <line key={x} x1={px(x)} x2={px(x)} y1={T} y2={T + ih} stroke="var(--line)" />)}
        <path d={fillD} fill="var(--sig-glow)" />
        <path d={d} fill="none" stroke="var(--sig)" strokeWidth="1.6" />
        {pts.map((p, i) => (
          <g key={i} transform={`translate(${px(p.x)},${py(p.y)})`} onPointerDown={e => down(e, i)}
            onDoubleClick={e => { e.stopPropagation(); remove(i) }} onPointerEnter={() => !dragging.current && setHot(i)} onPointerLeave={() => !dragging.current && setHot(-1)}
            style={{ cursor: i === 0 || i === pts.length - 1 ? 'ns-resize' : 'move' }}>
            <rect x="-9" y="-9" width="18" height="18" fill="transparent" />
            <rect x="-4" y="-4" width="8" height="8" fill={hot === i ? 'var(--sig)' : 'var(--bg-1)'} stroke="var(--sig)" strokeWidth="1.4" transform="rotate(45)" />
          </g>
        ))}
        <text x={L} y={H - 3} className="cax" textAnchor="start">başlangıç</text>
        <text x={W - R} y={H - 3} className="cax" textAnchor="end">bitiş</text>
      </svg>
      <div className="cvinfo mono">
        {hp ? <span><b>{(hp.y).toFixed(2)}×</b> · %{Math.round(hp.x * 100)}</span> : <span className="faint">çift tık: nokta ekle · noktaya çift tık: sil · Shift: serbest</span>}
      </div>
    </div>
  )
}

export default function SpeedTab({ ctx }) {
  const { clip, b, media } = ctx
  const curves = useReg('speedCurves')
  const [mode, setMode] = useState(clip.speedCurve ? 'curve' : 'normal')
  const speed = clip.speed || 1
  const sc = clip.speedCurve
  const span = Math.max(0, (clip.out ?? 0) - (clip.in ?? 0))
  const setSpeed = (v, curve, final) => { A.setSpeed(clip.id, v, curve === undefined ? sc : curve); if (final) store.endCoalesce() }
  const isVideo = clip.type === 'video'
  const audioOk = clip.type === 'audio' || (media && media.hasAudio)
  return (
    <>
      <div className="stickytop">
        <SubTabs value={mode} onChange={setMode} options={[{ value: 'normal', label: 'Normal' }, { value: 'curve', label: 'Eğri', dot: !!sc }]} />
      </div>
      {mode === 'normal' ? (
        <Sec id="spd" code="01" title={sc ? 'Temel hız' : 'Hız'} sub={speed !== 1 ? speed.toFixed(2) + '×' : null}
          onReset={speed !== 1 ? () => setSpeed(1, undefined, true) : null}>
          <Row label="Hız" value={speed} min={0.1} max={100} step={0.01} digits={2} suffix="×" map={LOG} def={1}
            onChange={(v, o) => setSpeed(v, undefined, o && o.final)} />
          <div className="chips sq quick">
            {QUICK.map(q => <button key={q} className={'chip' + (Math.abs(speed - q) < 0.005 ? ' on' : '')} onClick={() => setSpeed(q, undefined, true)}>{q}×</button>)}
          </div>
          <div className="readout">
            <div><span className="k">Süre</span><span className="v mono">{shortTime(clip.duration)}</span></div>
            <div><span className="k">Kaynak</span><span className="v mono">{shortTime(span)}</span></div>
            <div><span className="k">Oran</span><span className="v mono">{(span / Math.max(1e-6, clip.duration)).toFixed(2)}×</span></div>
          </div>
          {sc && <Note>Hız eğrisi açık — temel hız eğrinin bütününü çarpar.</Note>}
        </Sec>
      ) : (
        <>
          <Sec id="spdc" code="01" title="Hazır eğriler" sub={sc ? ((curves.find(c => c.id === sc.id) || {}).name || (sc.id === 'custom' ? 'Özel' : sc.id)) : null}>
            <div className="cgrid c4">
              <Card on={!sc} name="Yok" onClick={() => setSpeed(speed, null, true)}><span className="curvethumb"><Icon name="minus" size={16} /></span></Card>
              {sc && sc.id === 'custom' && <Card on name="Özel"><span className="curvethumb"><MiniCurve points={sc.points} /></span></Card>}
              {curves.map(c => (
                <Card key={c.id} on={sc && sc.id === c.id} name={c.name} onClick={() => setSpeed(speed, { id: c.id, points: c.points.map(p => ({ ...p })) }, true)}>
                  <span className="curvethumb"><MiniCurve points={c.points} /></span>
                </Card>
              ))}
            </div>
            {!curves.length && <Note>Hız eğrisi paketi yüklenmedi — aşağıdan kendin çiz.</Note>}
          </Sec>
          <Sec id="spde" code="02" title="Eğri düzenleyici" sub={sc ? 'ort. ' + curveMean(sc.points).toFixed(2) + '×' : null}
            onReset={sc ? () => setSpeed(speed, { id: 'custom', points: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }, true) : null}>
            <CurveEditor points={sc ? sc.points : [{ x: 0, y: 1 }, { x: 0.5, y: 1 }, { x: 1, y: 1 }]}
              onChange={(pts, final) => setSpeed(speed, { id: 'custom', points: pts }, final)} />
            <div className="readout">
              <div><span className="k">Süre</span><span className="v mono">{shortTime(clip.duration)}</span></div>
              <div><span className="k">Kaynak</span><span className="v mono">{shortTime(span)}</span></div>
            </div>
          </Sec>
        </>
      )}
      <Sec id="spdx" code={mode === 'normal' ? '02' : '03'} title="Zaman araçları">
        <IconBtns items={[
          { icon: 'reverse', label: clip.reverse ? 'Ters (açık)' : 'Ters çevir', on: !!clip.reverse, tip: 'Klibi tersten oynat', onClick: () => A.toggleReverse() },
          ...(isVideo ? [{ icon: 'freeze', label: 'Kare dondur', tip: 'Oynatma kafasındaki kareyi 3 sn dondur', onClick: () => A.freezeFrame() }] : []),
        ]} />
        {audioOk && (
          <Toggle label="Perdeyi koru" on={!(clip.audio && clip.audio.preservePitch === false)} hint="Hız değişince sesin incelip kalınlaşmasını önler"
            onChange={v => b.setS('audio.preservePitch', 'Perdeyi koru')(v, { final: true })} />
        )}
      </Sec>
    </>
  )
}
