// Denetçi yapı taşları: bölüm, sayısal satır, eksen hücresi, renk, alt sekme, kart, parametre kontrolleri
import React, { useRef, useState, useEffect } from 'react'
import Icon from '../Icon.jsx'
import { Slider, NumField, KeyBtn, Toggle, Select, useScrub } from '../controls.jsx'
import { clamp, countKeys, clearKeysFor } from './hooks.js'

// ---------------------------------------------------------------- bölüm
const secMem = new Map()
export function Sec({ id, code, title, children, defaultOpen = true, onReset, keys, right, sub }) {
  const [open, setOpen] = useState(secMem.has(id) ? secMem.get(id) : defaultOpen)
  const n = keys && keys.clip ? countKeys(keys.clip, keys.paths) : 0
  const toggle = () => { secMem.set(id, !open); setOpen(!open) }
  return (
    <div className={'section isec' + (open ? '' : ' closed')}>
      <div className="shead" onClick={toggle}>
        <Icon name="chevD" size={11} className="car" />
        {code && <span className={'ecode' + (n ? ' k' : '')}>{code}</span>}
        <span className="sttl">{title}</span>
        {sub && <span className="ssub">{sub}</span>}
        <span className="grow" />
        {n > 0 && (
          <button className="kfclr" data-tip="Bu bölümün anahtar karelerini temizle" onClick={e => { e.stopPropagation(); clearKeysFor(keys.clip.id, keys.paths) }}>
            <i className="dia" />{n}<Icon name="x" size={9} sw={2} />
          </button>
        )}
        {right}
        {onReset && (
          <button className="ibtn sm" data-tip="Sıfırla" onClick={e => { e.stopPropagation(); onReset() }}><Icon name="undo" size={12} /></button>
        )}
      </div>
      {open && <div className="sbody">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- sayısal satır
// PropRow'un denetçi sürümü: eşlemeli (log) kaydırıcı, rozet, devre dışı. Etiket sürükleme kaydırıcı aralığında çalışır.
export function Row({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, digits, suffix = '', def, kf, scale = 1,
  sliderMin, sliderMax, map, badge, hint, disabled, noSlider, cls }) {
  const v = Number.isFinite(value) ? value : 0
  const smin = sliderMin ?? (Number.isFinite(min) ? min : -1)
  const smax = sliderMax ?? (Number.isFinite(max) ? max : 1)
  const to = map ? map.to : (x => x * scale)
  const from = map ? map.from : (s => s / scale)
  const st = step / scale
  const q = (x) => clamp(+(Math.round(x / st) * st).toFixed(6), min, max)
  const dg = digits != null ? digits : (step < 1 ? (step < 0.1 ? 2 : 1) : 0)
  const scrub = (e) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX, s0 = to(v), span = to(smax) - to(smin)
    let cur = v
    const move = (ev) => {
      const d = ((ev.clientX - x0) / 220) * span * (ev.shiftKey ? 0.1 : 1)
      cur = q(from(s0 + d))
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
  }
  return (
    <div className={'prop irow' + (disabled ? ' dis' : '') + (cls ? ' ' + cls : '')} title={hint}>
      <span className="lbl" onPointerDown={scrub} onDoubleClick={() => def != null && onChange(def, { final: true })}>
        <span className="lt">{label}</span>{badge != null && <i className="bdg">{badge}</i>}
      </span>
      {noSlider ? <span className="grow" /> : (
        <Slider value={to(v)} min={to(smin)} max={to(smax)} step={map ? (to(smax) - to(smin)) / 1000 : step}
          def={def != null ? to(def) : undefined} disabled={disabled}
          onChange={(s, o) => onChange(q(from(s)), o)} />
      )}
      <NumField value={v} onChange={onChange} min={min} max={max} step={step} digits={dg} suffix={suffix} scale={scale} />
      {kf ? <KeyBtn {...kf} /> : <span className="kfph" />}
    </div>
  )
}

// İki eksenli satır (konum, ölçek X/Y, maske boyutu…)
export function Vec2({ label, cells, hint }) {
  return (
    <div className="prop irow v2" title={hint}>
      <span className="lbl static"><span className="lt">{label}</span></span>
      {cells.map((c, i) => <Cell key={i} {...c} />)}
    </div>
  )
}
export function Cell({ axis, value, onChange, step = 1, scale = 1, digits = 0, suffix = '', kf, min = -Infinity, max = Infinity, def }) {
  const scrub = useScrub(value, onChange, { step: step / scale, min, max })
  return (
    <div className="cell">
      <span className="ax" onPointerDown={scrub} onDoubleClick={() => def != null && onChange(def, { final: true })}>{axis}</span>
      <NumField value={value} onChange={onChange} min={min} max={max} step={step} digits={digits} suffix={suffix} scale={scale} />
      {kf ? <KeyBtn {...kf} /> : null}
    </div>
  )
}

// ---------------------------------------------------------------- renk
const PRESETS = ['#ffffff', '#000000', '#e4ff3a', '#ff3b5c', '#00c2ff', '#ff5da2']
export function toHex6(c) {
  if (Array.isArray(c)) return '#' + c.slice(0, 3).map(x => Math.round(clamp(+x || 0, 0, 1) * 255).toString(16).padStart(2, '0')).join('')
  if (!c || typeof c !== 'string' || c[0] !== '#') return '#ffffff'
  if (c.length === 4) return '#' + c.slice(1).split('').map(x => x + x).join('')
  return c.slice(0, 7).toLowerCase()
}
export function hexToArr(h) {
  const x = toHex6(h)
  return [parseInt(x.slice(1, 3), 16) / 255, parseInt(x.slice(3, 5), 16) / 255, parseInt(x.slice(5, 7), 16) / 255]
}
export function Color({ label, value, onChange, presets = true, disabled }) {
  const ref = useRef(null)
  const [txt, setTxt] = useState(null)
  const hex = toHex6(value)
  const commit = (s) => {
    let h = String(s).trim()
    if (h[0] !== '#') h = '#' + h
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) onChange(toHex6(h), { final: true })
    setTxt(null)
  }
  return (
    <div className={'prop irow' + (disabled ? ' dis' : '')}>
      {label != null && <span className="lbl static"><span className="lt">{label}</span></span>}
      <div className="icolor grow">
        <button className="sw" style={{ background: hex }} onClick={() => ref.current && ref.current.click()} data-tip="Renk seç">
          <input ref={ref} type="color" value={hex} tabIndex={-1}
            onChange={e => onChange(e.target.value, { final: false })} onBlur={e => onChange(e.target.value, { final: true })} />
        </button>
        <input className="hex" value={txt != null ? txt : hex.slice(1).toUpperCase()} spellCheck={false}
          onFocus={e => { setTxt(hex.slice(1).toUpperCase()); setTimeout(() => e.target.select(), 0) }}
          onChange={e => setTxt(e.target.value)} onBlur={e => commit(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTxt(null); e.target.blur() } }} />
        {presets && <span className="pres">{PRESETS.map(c => (
          <button key={c} className={'pr' + (c === hex ? ' on' : '')} style={{ background: c }} onClick={() => onChange(c, { final: true })} />
        ))}</span>}
        {typeof window !== 'undefined' && window.EyeDropper && (
          <button className="ibtn sm" data-tip="Ekrandan renk al" onClick={async () => {
            try { const r = await new window.EyeDropper().open(); onChange(r.sRGBHex, { final: true }) } catch (e) { /* iptal */ }
          }}><Icon name="drop" size={13} /></button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- alt sekme / kart / boş durum
export function SubTabs({ value, onChange, options }) {
  return (
    <div className="isub">
      {options.map(o => (
        <button key={o.value} className={'st' + (o.value === value ? ' on' : '')} onClick={() => onChange(o.value)}>
          {o.label}{o.dot && <i className="dot" />}
        </button>
      ))}
    </div>
  )
}

export function Card({ on, onClick, name, children, tip, onEnter, onLeave, badge, className }) {
  return (
    <button className={'icard' + (on ? ' on' : '') + (className ? ' ' + className : '')} onClick={onClick} data-tip={tip}
      onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <span className="ith">{children}{badge && <span className="ibadge">{badge}</span>}</span>
      <span className="inm">{name}</span>
    </button>
  )
}

export function Empty({ title, text, children }) {
  return (
    <div className="iempty">
      <div className="big">{title}</div>
      {text && <div className="txt">{text}</div>}
      {children}
    </div>
  )
}

export function Note({ children, kind }) {
  return <div className={'inote' + (kind ? ' ' + kind : '')}>{children}</div>
}

// Etiketli serbest içerik satırı
export function Line({ label, children, hint }) {
  return (
    <div className="prop irow" title={hint}>
      {label != null && <span className="lbl static"><span className="lt">{label}</span></span>}
      <div className="row grow" style={{ gap: 4, minWidth: 0 }}>{children}</div>
    </div>
  )
}

// Kare ikon düğmesi grubu (hizalama, ayna…)
export function IconBtns({ items }) {
  return (
    <div className="ibtns">
      {items.map((it, i) => it === '|' ? <span key={i} className="vsep" /> : (
        <button key={i} className={'ib' + (it.on ? ' on' : '')} onClick={it.onClick} data-tip={it.tip} data-kb={it.kb} disabled={it.disabled}>
          {it.svg || (it.icon ? <Icon name={it.icon} size={14} /> : null)}
          {it.label && <span>{it.label}</span>}
        </button>
      ))}
    </div>
  )
}

// Kısa metin alanı
export function TextIn({ label, value, onChange, placeholder, mono }) {
  const [txt, setTxt] = useState(null)
  return (
    <div className="prop irow">
      {label != null && <span className="lbl static"><span className="lt">{label}</span></span>}
      <input className={'field grow' + (mono ? ' mono' : '')} value={txt != null ? txt : (value ?? '')} placeholder={placeholder}
        onFocus={() => setTxt(value ?? '')} onChange={e => { setTxt(e.target.value); onChange(e.target.value, { final: false }) }}
        onBlur={e => { onChange(e.target.value, { final: true }); setTxt(null) }}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur() }} />
    </div>
  )
}

// ---------------------------------------------------------------- şema → kontroller
// schema: [{ key, label, type, min, max, step, default, options }] — efekt, geçiş, çıkartma, ses değiştirici
// anim(key) → { value, onChange, kf } verilirse sayısal (range) satırlar anahtar karelenebilir olur
export function ParamControls({ schema, values, onChange, anim }) {
  if (!schema || !schema.length) return <Note>Bu öğenin ayarlanabilir parametresi yok.</Note>
  return schema.map(p => <Param key={p.key} p={p} value={values ? values[p.key] : undefined} onChange={(v, o) => onChange(p.key, v, o)}
    anim={anim && (p.type === 'range' || p.type === 'float' || p.type === 'int' || p.type === 'number' || !p.type) ? anim(p.key, p) : null} />)
}

function rangeOf(p) {
  let min = p.min, max = p.max
  const d = Array.isArray(p.default) ? Math.max(...p.default.map(x => Math.abs(+x || 0))) : Math.abs(+p.default || 0)
  if (min == null) min = 0
  if (max == null) max = Math.max(1, d * 2)
  return [min, max]
}

function Param({ p, value, onChange, anim }) {
  const v = value ?? p.default
  const label = p.label || p.key
  const t = p.type
  if (t === 'bool') return <Toggle label={label} on={!!v} onChange={x => onChange(x, { final: true })} />
  if (t === 'color') return <Color label={label} value={toHex6(v)} onChange={onChange} presets={false} />
  if (t === 'select') {
    const opts = (p.options || []).map(o => typeof o === 'object' ? { value: String(o.value), label: o.label } : { value: String(o), label: String(o) })
    return <Select label={label} value={String(v)} options={opts} onChange={x => {
      const o = (p.options || []).find(o => String(typeof o === 'object' ? o.value : o) === x)
      onChange(o != null ? (typeof o === 'object' ? o.value : o) : x, { final: true })
    }} />
  }
  if (t === 'text') return <TextIn label={label} value={v} onChange={onChange} />
  const [min, max] = rangeOf(p)
  const step = p.step || ((t === 'int' || t === 'ivec2') ? 1 : (max - min > 20 ? 1 : max - min > 4 ? 0.1 : 0.01))
  if (t === 'vec2' || t === 'ivec2') {
    const arr = Array.isArray(v) ? v : [0, 0]
    const dg = step < 1 ? (step < 0.1 ? 2 : 1) : 0
    return <Vec2 label={label} cells={['X', 'Y'].map((ax, i) => ({
      axis: ax, value: +arr[i] || 0, step, digits: dg, min, max,
      onChange: (x, o) => { const n = arr.slice(); n[i] = x; onChange(n, o) },
    }))} />
  }
  if (t === 'vec3' || t === 'vec4') {
    const arr = Array.isArray(v) ? v : [1, 1, 1, 1]
    if (t === 'vec3' || p.color) {
      return (
        <>
          <Color label={label} value={toHex6(arr)} presets={false} onChange={(h, o) => { const n = hexToArr(h); if (t === 'vec4') n.push(arr[3] ?? 1); onChange(n, o) }} />
          {t === 'vec4' && <Row label="  Opaklık" value={arr[3] ?? 1} min={0} max={1} step={1} scale={100} suffix="%" onChange={(x, o) => { const n = arr.slice(); n[3] = x; onChange(n, o) }} />}
        </>
      )
    }
    return arr.map((x, i) => <Row key={i} label={label + ' ' + 'xyzw'[i]} value={+x || 0} min={min} max={max} step={step}
      onChange={(nv, o) => { const n = arr.slice(); n[i] = nv; onChange(n, o) }} />)
  }
  // range / float / int / number
  if (anim) return <Row label={label} value={+anim.value || 0} min={min} max={max} step={step} def={typeof p.default === 'number' ? p.default : undefined} onChange={anim.onChange} kf={anim.kf} />
  return <Row label={label} value={+v || 0} min={min} max={max} step={step} def={typeof p.default === 'number' ? p.default : undefined} onChange={onChange} />
}

export function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    const k = (e) => { if (e.key === 'Escape') close() }
    setTimeout(() => window.addEventListener('pointerdown', h), 0)
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', k) }
  }, [open])
}
