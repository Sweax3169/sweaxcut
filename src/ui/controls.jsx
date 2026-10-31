// Ortak kontroller: kaydırıcı, sayı alanı, anahtar, renk, seçim, bölüm, ipucu, bağlam menüsü, modal
import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

// ---------------------------------------------------------------- Kaydırıcı
// value, onChange(v, {final}), min, max, step; çift tık = varsayılana dön
export function Slider({ value, onChange, min = 0, max = 100, step = 1, def, zero, disabled, style }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(false)
  const v = Number.isFinite(value) ? value : 0
  const k = (Math.min(max, Math.max(min, v)) - min) / (max - min || 1)
  const z = zero != null ? (zero - min) / (max - min) : (min < 0 && max > 0 ? -min / (max - min) : 0)
  const fromX = (clientX) => {
    const r = ref.current.getBoundingClientRect()
    let t = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    let nv = min + t * (max - min)
    nv = Math.round(nv / step) * step
    nv = Math.min(max, Math.max(min, +nv.toFixed(6)))
    return nv
  }
  const down = (e) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    setDrag(true)
    const fine = e.shiftKey
    let lastX = e.clientX
    let cur = v
    if (!fine) { cur = fromX(e.clientX); onChange(cur, { final: false }) }
    const move = (ev) => {
      if (ev.shiftKey) {
        const r = ref.current.getBoundingClientRect()
        cur = Math.min(max, Math.max(min, cur + ((ev.clientX - lastX) / r.width) * (max - min) * 0.1))
        cur = Math.round(cur / step) * step
        lastX = ev.clientX
      } else cur = fromX(ev.clientX)
      onChange(cur, { final: false })
    }
    const up = () => {
      setDrag(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onChange(cur, { final: true })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const lo = Math.min(k, z), hi = Math.max(k, z)
  return (
    <div ref={ref} className={'slider' + (drag ? ' drag' : '')} style={{ opacity: disabled ? 0.4 : 1, ...style }}
      onPointerDown={down}
      onDoubleClick={() => def != null && onChange(def, { final: true })}>
      <div className="trk" />
      {z > 0 && z < 1 && <div className="zero" style={{ left: z * 100 + '%' }} />}
      <div className="fil" style={{ left: lo * 100 + '%', width: (hi - lo) * 100 + '%' }} />
      <div className="thm" style={{ left: k * 100 + '%' }} />
    </div>
  )
}

// ---------------------------------------------------------------- Sayı alanı (yazılabilir + sürüklenebilir)
export function NumField({ value, onChange, min = -Infinity, max = Infinity, step = 1, digits = 0, suffix = '', width, scale = 1 }) {
  const [edit, setEdit] = useState(null)
  const shown = Number.isFinite(value) ? (value * scale).toFixed(digits) : '—'
  const commit = (s) => {
    const n = parseFloat(String(s).replace(',', '.'))
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n / scale)), { final: true })
    setEdit(null)
  }
  return (
    <input className="num" style={width ? { width } : null}
      value={edit != null ? edit : shown + suffix}
      onFocus={e => { setEdit(shown); setTimeout(() => e.target.select(), 0) }}
      onChange={e => setEdit(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') e.target.blur()
        else if (e.key === 'Escape') { setEdit(null); e.target.blur() }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
          const nv = Math.min(max, Math.max(min, (value || 0) + d / scale))
          onChange(nv, { final: true })
          setEdit((nv * scale).toFixed(digits))
        }
        e.stopPropagation()
      }} />
  )
}

// Etiketi sürükleyerek değer değiştirme
export function useScrub(value, onChange, { step = 1, min = -Infinity, max = Infinity, speed = 1 } = {}) {
  return useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX
    const v0 = value || 0
    let cur = v0
    const move = (ev) => {
      const dx = ev.clientX - x0
      cur = v0 + dx * step * speed * (ev.shiftKey ? 0.1 : 1) * (ev.ctrlKey ? 10 : 1)
      cur = Math.min(max, Math.max(min, Math.round(cur / step) * step))
      onChange(cur, { final: false })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
      onChange(cur, { final: true })
    }
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [value, onChange, step, min, max, speed])
}

// ---------------------------------------------------------------- Özellik satırı: etiket + kaydırıcı + sayı + anahtar kare
export function PropRow({ label, value, onChange, min, max, step = 1, digits, suffix, def, kf, scale = 1, sliderMin, sliderMax, hint }) {
  const scrub = useScrub(value, onChange, { step: step / scale, min, max, speed: 1 })
  const dg = digits != null ? digits : (step < 1 ? (step < 0.1 ? 2 : 1) : 0)
  return (
    <div className="prop" title={hint}>
      <span className="lbl" onPointerDown={scrub} onDoubleClick={() => def != null && onChange(def, { final: true })}>{label}</span>
      <Slider value={value * scale} min={(sliderMin ?? min) * scale} max={(sliderMax ?? max) * scale} step={step} def={def != null ? def * scale : undefined}
        onChange={(v, o) => onChange(v / scale, o)} />
      <NumField value={value} onChange={onChange} min={min} max={max} step={step} digits={dg} suffix={suffix || ''} scale={scale} />
      {kf ? <KeyBtn {...kf} /> : <span style={{ width: 18 }} />}
    </div>
  )
}

export function KeyBtn({ has, on, onClick, onPrev, onNext }) {
  return (
    <span className="row" style={{ gap: 0 }}>
      <button className={'kf' + (has ? ' has' : '') + (on ? ' on' : '')} onClick={onClick} title={on ? 'Anahtar kareyi kaldır' : 'Anahtar kare ekle'} />
      {has && onPrev ? null : null}
    </span>
  )
}

// ---------------------------------------------------------------- Anahtar
export function Toggle({ on, onChange, label, hint }) {
  return (
    <label className="prop" style={{ cursor: 'pointer' }} title={hint}>
      {label != null && <span className="lbl static">{label}</span>}
      <span className={'toggle' + (on ? ' on' : '')} onClick={(e) => { e.preventDefault(); onChange(!on) }} />
    </label>
  )
}

// ---------------------------------------------------------------- Renk
const SWATCHES = ['#ffffff', '#000000', '#ffe600', '#ff3b5c', '#ff8a00', '#ffd400', '#2ee6a6', '#00c2ff', '#3f6bff', '#a855f7', '#ff5da2', '#8b5a2b']
export function ColorField({ value, onChange, label, swatches = true, alpha }) {
  const ref = useRef(null)
  return (
    <div className="prop">
      {label != null && <span className="lbl static">{label}</span>}
      <div className="row grow" style={{ gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => ref.current && ref.current.click()} title="Renk seç"
          style={{ width: 34, height: 20, background: value, border: '1px solid var(--line-3)', borderRadius: 1, position: 'relative' }}>
          <input ref={ref} type="color" value={toHex6(value)} onChange={e => onChange(e.target.value, { final: false })}
            onBlur={e => onChange(e.target.value, { final: true })}
            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} />
        </button>
        {swatches && SWATCHES.map(c => (
          <button key={c} onClick={() => onChange(c, { final: true })}
            style={{ width: 13, height: 13, background: c, border: c === value ? '1px solid var(--sig)' : '1px solid var(--line-2)' }} />
        ))}
        {window.EyeDropper && (
          <button className="ibtn sm" title="Ekrandan renk al" onClick={async () => {
            try { const r = await new window.EyeDropper().open(); onChange(r.sRGBHex, { final: true }) } catch (e) { /* iptal */ }
          }}><Icon name="drop" size={13} /></button>
        )}
      </div>
      {alpha}
    </div>
  )
}
function toHex6(c) {
  if (!c || c[0] !== '#') return '#ffffff'
  if (c.length === 4) return '#' + c.slice(1).split('').map(x => x + x).join('')
  return c.slice(0, 7)
}

// ---------------------------------------------------------------- Seçim
export function Select({ value, onChange, options, label, width }) {
  return (
    <div className="prop">
      {label != null && <span className="lbl static">{label}</span>}
      <select className="field grow" style={width ? { width, flex: 'none' } : null} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// Düğme grubu (segment)
export function Segmented({ value, onChange, options, label, small }) {
  return (
    <div className="prop">
      {label != null && <span className="lbl static">{label}</span>}
      <div className="ibtns grow seg">
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o
          const lab = typeof o === 'object' ? o.label : o
          return (
            <button key={String(v)} className={'ib' + (v === value ? ' on' : '')} onClick={() => onChange(v)} title={typeof o === 'object' ? o.hint : undefined}
              style={small ? { height: 22 } : null}>
              {typeof o === 'object' && o.icon ? <Icon name={o.icon} size={13} /> : null}{lab}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Bölüm (açılır-kapanır)
const sectionMemory = new Map()
export function Section({ id, title, children, defaultOpen = true, right, onReset }) {
  const key = id || title
  const [open, setOpen] = useState(sectionMemory.has(key) ? sectionMemory.get(key) : defaultOpen)
  return (
    <div className={'section' + (open ? '' : ' closed')}>
      <div className="shead" onClick={() => { sectionMemory.set(key, !open); setOpen(!open) }}>
        <Icon name="chevD" size={12} className="car" />
        <span className="grow">{title}</span>
        {onReset && open && (
          <button className="ibtn sm" title="Sıfırla" onClick={(e) => { e.stopPropagation(); onReset() }}><Icon name="undo" size={12} /></button>
        )}
        {right}
      </div>
      <div className="sbody">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------- İpucu
let tipSet = null
export function TipLayer() {
  const [tip, setTip] = useState(null)
  tipSet = setTip
  useEffect(() => {
    let timer = 0
    let cur = null
    const over = (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]')
      if (el === cur) return
      cur = el
      clearTimeout(timer)
      setTip(null)
      if (!el) return
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect()
        setTip({ text: el.dataset.tip, kb: el.dataset.kb, x: r.left + r.width / 2, y: r.bottom + 6, top: r.top })
      }, 420)
    }
    const out = () => { clearTimeout(timer); setTip(null); cur = null }
    window.addEventListener('pointerover', over)
    window.addEventListener('pointerdown', out)
    window.addEventListener('wheel', out, { passive: true })
    return () => { window.removeEventListener('pointerover', over); window.removeEventListener('pointerdown', out); window.removeEventListener('wheel', out) }
  }, [])
  if (!tip) return null
  return <TipBox tip={tip} />
}
function TipBox({ tip }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: tip.x, top: tip.y })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight
    let left = tip.x - w / 2
    left = Math.max(6, Math.min(window.innerWidth - w - 6, left))
    let top = tip.y
    if (top + h > window.innerHeight - 6) top = tip.top - h - 6
    setPos({ left, top })
  }, [tip])
  return <div ref={ref} className="tip" style={pos}>{tip.text}{tip.kb && <span className="kb">{tip.kb}</span>}</div>
}

// ---------------------------------------------------------------- Bağlam menüsü
let menuSet = null
export function openMenu(e, items) {
  e.preventDefault()
  e.stopPropagation()
  if (menuSet) menuSet({ x: e.clientX, y: e.clientY, items })
}
export function MenuLayer() {
  const [m, setM] = useState(null)
  menuSet = setM
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!m || !ref.current) { setPos(null); return }
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight
    setPos({ left: Math.min(m.x, window.innerWidth - w - 6), top: Math.min(m.y, window.innerHeight - h - 6) })
  }, [m])
  useEffect(() => {
    if (!m) return
    const close = (e) => { if (ref.current && ref.current.contains(e.target)) return; setM(null) }
    const key = (e) => { if (e.key === 'Escape') setM(null) }
    setTimeout(() => window.addEventListener('pointerdown', close), 0)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', () => setM(null), { once: true })
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key) }
  }, [m])
  if (!m) return null
  return createPortal(
    <div ref={ref} className="menu" style={pos || { left: m.x, top: m.y, visibility: 'hidden' }}>
      {m.items.filter(Boolean).map((it, i) => it === '-' ? <div key={i} className="sep" />
        : it.header ? <div key={i} className="mh">{it.header}</div>
          : (
            <div key={i} className={'mi' + (it.disabled ? ' dis' : '')} onClick={() => { setM(null); it.onClick && it.onClick() }}>
              {it.icon ? <Icon name={it.icon} size={14} /> : <span style={{ width: 14 }} />}
              <span>{it.label}</span>
              {it.kb && <span className="kb">{it.kb}</span>}
            </div>
          ))}
    </div>, document.body)
}

// ---------------------------------------------------------------- Modal
export function Modal({ title, children, onClose, footer, width, edge }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  return createPortal(
    <div className="scrim" onPointerDown={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}>
      <div className="modal" style={{ width }}>
        <div className="mhead">
          <div className="col grow" style={{ gap: 4 }}>
            <h2>{title}</h2>
            {edge && <div className="edge">{edge}</div>}
          </div>
          {onClose && <button className="ibtn" onClick={onClose}><Icon name="close" /></button>}
        </div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>, document.body)
}

// Süre biçimi
export function fmtDur(t) {
  if (!Number.isFinite(t)) return '—'
  const m = Math.floor(t / 60), s = Math.floor(t % 60)
  return m + ':' + String(s).padStart(2, '0')
}

export function useForceUpdate() {
  const [, set] = useState(0)
  return useCallback(() => set(x => x + 1), [])
}
