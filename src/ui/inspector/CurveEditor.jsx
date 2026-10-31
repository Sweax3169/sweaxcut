// Anahtar kare eğri düzenleyicisi: önceki kareden bu kareye geçişin hızını iki tutamaçlı bezier ile çiz.
// Değer { bezier:[x1,y1,x2,y2] } olarak saklanır (core/keyframes.js değerlendirir). y aralığı -0.5..1.5: geri çekilme / taşma.
import React, { useEffect, useRef, useState } from 'react'
import { cubicBezier } from '../../core/easing.js'

const W = 232, H = 196, PAD = 30
const toX = x => PAD + x * (W - PAD * 2)
const toY = y => H - PAD - y * (H - PAD * 2) * 0.66 - (H - PAD * 2) * 0.17
const fromX = px => Math.max(0, Math.min(1, (px - PAD) / (W - PAD * 2)))
const fromY = py => Math.max(-0.5, Math.min(1.5, (H - PAD - (H - PAD * 2) * 0.17 - py) / ((H - PAD * 2) * 0.66)))

export const CURVE_PRESETS = [
  ['Yumuşak', [0.42, 0, 0.58, 1]], ['Hızlan', [0.55, 0, 1, 0.45]], ['Yavaşla', [0, 0.55, 0.45, 1]],
  ['Çarpıcı', [0.7, 0, 0.2, 1]], ['Taşma', [0.34, 1.56, 0.64, 1]], ['Hazırlan', [0.36, -0.4, 0.6, 1]],
]

export default function CurveEditor({ value, onChange }) {
  const [b, setB] = useState(value || [0.42, 0, 0.58, 1])
  const svg = useRef(null)
  const dot = useRef(null)
  useEffect(() => { if (value) setB(value) }, [value && value.join(',')]) // eslint-disable-line
  // önizleme noktası: eğriyle sağa giden top
  useEffect(() => {
    let raf = 0
    const f = cubicBezier(...b)
    const t0 = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const u = ((performance.now() - t0) / 1100) % 1.4
      const x = Math.min(1, u)
      if (dot.current) dot.current.style.transform = `translateX(${f(x) * (W - 48)}px)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [b.join(',')]) // eslint-disable-line
  const drag = (i) => (e) => {
    e.preventDefault()
    const r = svg.current.getBoundingClientRect()
    const move = (ev) => {
      const nb = b.slice()
      nb[i * 2] = +fromX(ev.clientX - r.left).toFixed(3)
      nb[i * 2 + 1] = +fromY(ev.clientY - r.top).toFixed(3)
      setB(nb)
      onChange(nb, { final: false })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      const nb = b.slice()
      nb[i * 2] = +fromX(ev.clientX - r.left).toFixed(3)
      nb[i * 2 + 1] = +fromY(ev.clientY - r.top).toFixed(3)
      setB(nb); onChange(nb, { final: true })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const p0 = [toX(0), toY(0)], p3 = [toX(1), toY(1)]
  const h1 = [toX(b[0]), toY(b[1])], h2 = [toX(b[2]), toY(b[3])]
  return (
    <div className="curve">
      <svg ref={svg} width={W} height={H} className="curve-svg">
        <rect x={PAD} y={toY(1)} width={W - PAD * 2} height={toY(0) - toY(1)} className="cv-box" />
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={toX(g)} x2={toX(g)} y1={toY(1)} y2={toY(0)} className="cv-grid" />)}
        <line x1={p0[0]} y1={p0[1]} x2={h1[0]} y2={h1[1]} className="cv-arm" />
        <line x1={p3[0]} y1={p3[1]} x2={h2[0]} y2={h2[1]} className="cv-arm" />
        <path d={`M${p0[0]},${p0[1]} C${h1[0]},${h1[1]} ${h2[0]},${h2[1]} ${p3[0]},${p3[1]}`} className="cv-path" />
        <circle cx={p0[0]} cy={p0[1]} r="3.5" className="cv-end" />
        <circle cx={p3[0]} cy={p3[1]} r="3.5" className="cv-end" />
        <circle cx={h1[0]} cy={h1[1]} r="7" className="cv-h" onPointerDown={drag(0)} />
        <circle cx={h2[0]} cy={h2[1]} r="7" className="cv-h" onPointerDown={drag(1)} />
        <text x={PAD} y={H - 8} className="cv-lab">önceki kare</text>
        <text x={W - PAD} y={H - 8} textAnchor="end" className="cv-lab">bu kare</text>
      </svg>
      <div className="curve-run"><i ref={dot} /></div>
      <div className="curve-pre">
        {CURVE_PRESETS.map(([n, v]) => (
          <button key={n} className={'chip' + (v.join(',') === b.join(',') ? ' on' : '')} onClick={() => { setB(v); onChange(v, { final: true }) }}>{n}</button>
        ))}
      </div>
      <div className="curve-num mono">{b.map(x => x.toFixed(2)).join(', ')}</div>
    </div>
  )
}
