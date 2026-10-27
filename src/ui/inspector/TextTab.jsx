// METİN: içerik, yazı tipi seçici, boyut, B/I/U/AA, hizalama, renk, degrade dolgu, aralıklar, genişlik, kavis
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import Icon from '../Icon.jsx'
import { Toggle, Segmented } from '../controls.jsx'
import { Sec, Row, Color, IconBtns, useOutside } from './common.jsx'
import { useReg, useRegCats, clamp } from './hooks.js'

export const FONT_CATS = { display: 'Gösterişli', sans: 'Yalın', serif: 'Tırnaklı', hand: 'El yazısı', mono: 'Eş aralıklı', gaming: 'Oyun', fun: 'Eğlenceli' }

// ---------------------------------------------------------------- yazı tipi seçici
function FontPicker({ value, onChange }) {
  const fonts = useReg('fonts')
  const cats = useRegCats('fonts')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const ref = useRef(null)
  const listRef = useRef(null)
  const [hi, setHi] = useState(0)
  useOutside(ref, open, () => setOpen(false))
  const catName = (id) => (cats.find(c => c.id === id) || {}).name || FONT_CATS[id] || id
  const ql = q.trim().toLocaleLowerCase('tr-TR')
  const shown = useMemo(() => fonts.filter(f => (!cat || f.category === cat) && (!ql || (f.name || f.id).toLocaleLowerCase('tr-TR').includes(ql))), [fonts, cat, ql])
  const groups = useMemo(() => {
    const m = new Map()
    for (const f of shown) { if (!m.has(f.category)) m.set(f.category, []); m.get(f.category).push(f) }
    return [...m.entries()]
  }, [shown])
  const flat = groups.flatMap(g => g[1])
  const catIds = [...new Set(fonts.map(f => f.category))]
  const cur = fonts.find(f => f.id === value)
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector('.fi.on')
    if (el) el.scrollIntoView({ block: 'center' })
  }, [open])
  useEffect(() => { setHi(0) }, [q, cat])
  const key = (e) => {
    e.stopPropagation()
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(flat.length - 1, h + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    if (e.key === 'Enter' && flat[hi]) { onChange(flat[hi].id); setOpen(false) }
    if (e.key === 'Escape') setOpen(false)
  }
  return (
    <div className="fontpick" ref={ref}>
      <button className={'fpbtn' + (open ? ' on' : '')} onClick={() => setOpen(!open)}>
        <span className="fpn" style={{ fontFamily: `"${value}", var(--font-ui)` }}>{cur ? cur.name : value}</span>
        <span className="fpc mono">{cur ? catName(cur.category) : ''}</span>
        <Icon name="chevD" size={12} />
      </button>
      {open && (
        <div className="fpanel">
          <div className="search"><Icon name="search" size={13} /><input autoFocus placeholder={'Yazı tipi ara (' + fonts.length + ')'} value={q} onChange={e => setQ(e.target.value)} onKeyDown={key} /></div>
          <div className="chips sq">
            <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>Tümü</button>
            {catIds.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{catName(c)}</button>)}
          </div>
          <div className="flist" ref={listRef}>
            {groups.map(([cid, items]) => (
              <div key={cid}>
                <div className="ph">{catName(cid)} <span>{items.length}</span></div>
                {items.map(f => {
                  const i = flat.indexOf(f)
                  return (
                    <button key={f.id} className={'fi' + (f.id === value ? ' on' : '') + (i === hi ? ' hi' : '')} onMouseEnter={() => setHi(i)}
                      onClick={() => { onChange(f.id); setOpen(false) }} style={{ fontFamily: `"${f.id}", var(--font-ui)` }}>
                      {f.name || f.id}
                      <span className="fw mono">{(f.files || []).length > 2 ? new Set((f.files || []).map(x => x.weight)).size + 'k' : ''}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {!flat.length && <div className="faint" style={{ padding: 12 }}>{fonts.length ? 'Sonuç yok' : 'Yazı tipi paketi yüklenmedi'}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- degrade düzenleyici
const GRAD_PRESETS = [
  ['#ffffff', '#e4ff3a'], ['#ff3b5c', '#ffd400'], ['#00c2ff', '#a855f7'], ['#2ee6a6', '#00c2ff'], ['#ff5da2', '#ff8a00'], ['#ffffff', '#7a7a7a'],
]
export function gradCss(fill, dir) {
  if (!fill || !fill.stops) return 'none'
  const st = fill.stops.slice().sort((a, b) => a.at - b.at).map(s => `${s.color} ${Math.round(s.at * 100)}%`).join(', ')
  return fill.type === 'radial' && !dir ? `radial-gradient(circle, ${st})` : `linear-gradient(${dir ? 90 : (fill.angle ?? 90)}deg, ${st})`
}
function GradientEditor({ fill, onChange }) {
  const [sel, setSel] = useState(0)
  const bar = useRef(null)
  const stops = fill.stops || []
  const s = stops[Math.min(sel, stops.length - 1)] || stops[0]
  const set = (patch, final) => onChange({ ...fill, ...patch }, final)
  const setStop = (i, patch, final) => set({ stops: stops.map((x, j) => (j === i ? { ...x, ...patch } : x)) }, final)
  const down = (e, i) => {
    e.preventDefault(); e.stopPropagation()
    setSel(i)
    const r = bar.current.getBoundingClientRect()
    let last = stops[i].at
    const move = (ev) => { last = Math.round(clamp((ev.clientX - r.left) / r.width, 0, 1) * 100) / 100; setStop(i, { at: last }, false) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setStop(i, { at: last }, true) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const addAt = (e) => {
    if (stops.length >= 4) return
    const r = bar.current.getBoundingClientRect()
    const at = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100) / 100
    set({ stops: [...stops, { at, color: s ? s.color : '#ffffff' }] }, true)
    setSel(stops.length)
  }
  return (
    <div className="gradedit">
      <div className="gbar" ref={bar} style={{ background: gradCss(fill, true) }} onDoubleClick={addAt} title="Çift tık: durak ekle (en çok 4)" />
      <div className="gstops">
        {stops.map((x, i) => (
          <button key={i} className={'gs' + (i === sel ? ' on' : '')} style={{ left: x.at * 100 + '%', '--c': x.color }} onPointerDown={e => down(e, i)} />
        ))}
      </div>
      <div className="row" style={{ gap: 4 }}>
        <span className="faint mono" style={{ fontSize: 9.5 }}>DURAK {sel + 1}/{stops.length}</span>
        <span className="grow" />
        <button className="btn sm ghost" disabled={stops.length >= 4} onClick={() => { set({ stops: [...stops, { at: 0.5, color: s ? s.color : '#fff' }] }, true); setSel(stops.length) }}><Icon name="plus" size={11} />Durak</button>
        <button className="btn sm ghost" disabled={stops.length <= 2} onClick={() => { set({ stops: stops.filter((_, j) => j !== sel) }, true); setSel(0) }}><Icon name="minus" size={11} />Sil</button>
      </div>
      {s && <Color label="Durak rengi" value={s.color} onChange={(v, o) => setStop(Math.min(sel, stops.length - 1), { color: v }, o && o.final)} />}
      <Segmented label="Tür" value={fill.type || 'linear'} onChange={v => set({ type: v }, true)} options={[{ value: 'linear', label: 'Doğrusal' }, { value: 'radial', label: 'Dairesel' }]} />
      {(fill.type || 'linear') === 'linear' && <Row label="Açı" value={fill.angle ?? 90} min={0} max={360} step={1} suffix="°" def={90} onChange={(v, o) => set({ angle: v }, o && o.final)} />}
      <div className="gpresets">
        {GRAD_PRESETS.map((p, i) => (
          <button key={i} style={{ background: `linear-gradient(90deg, ${p[0]}, ${p[1]})` }} onClick={() => set({ stops: [{ at: 0, color: p[0] }, { at: 1, color: p[1] }] }, true)} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- sekme
export default function TextTab({ ctx, focusTick }) {
  const { clip, b } = ctx
  const t = clip.text || {}
  const ta = useRef(null)
  const setT = (k, label) => (v, o) => { b.setS('text.' + k, label)(v, o) }
  const grow = () => { const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(260, Math.max(64, el.scrollHeight + 2)) + 'px' }
  useLayoutEffect(grow, [t.content])
  useEffect(() => {
    if (!focusTick || !ta.current) return
    ta.current.focus()
    ta.current.select()
  }, [focusTick])
  const bold = (t.weight || 400) >= 700
  return (
    <>
      <Sec id="txt" code="01" title="Metin" sub={(t.content || '').length + ' kr'}>
        <textarea ref={ta} className="field itext" value={t.content || ''} spellCheck={false} placeholder="Yazını gir"
          style={{ fontFamily: `"${t.font}", var(--font-ui)` }}
          onChange={e => { setT('content', 'Yazı')(e.target.value, { final: false }); grow() }}
          onBlur={() => store.endCoalesce()}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') e.target.blur() }} />
      </Sec>
      <Sec id="font" code="02" title="Yazı tipi">
        <FontPicker value={t.font} onChange={v => setT('font', 'Yazı tipi')(v, { final: true })} />
        <Row label="Boyut" value={t.size || 96} min={4} max={600} sliderMin={12} sliderMax={300} step={1} suffix=" px" def={96} onChange={setT('size', 'Yazı boyutu')} />
        <div className="tstyle">
          <IconBtns items={[
            { icon: 'bold', tip: 'Kalın', on: bold, onClick: () => setT('weight', 'Kalın')(bold ? 400 : 900, { final: true }) },
            { icon: 'italic', tip: 'İtalik', on: !!t.italic, onClick: () => setT('italic', 'İtalik')(!t.italic, { final: true }) },
            { icon: 'underline', tip: 'Altı çizili', on: !!t.underline, onClick: () => setT('underline', 'Altı çizili')(!t.underline, { final: true }) },
            { icon: 'upper', tip: 'BÜYÜK HARF', on: !!t.uppercase, onClick: () => setT('uppercase', 'Büyük harf')(!t.uppercase, { final: true }) },
          ]} />
          <IconBtns items={[
            { icon: 'alignL', tip: 'Sola hizala', on: t.align === 'left', onClick: () => setT('align', 'Hizalama')('left', { final: true }) },
            { icon: 'alignC', tip: 'Ortala', on: (t.align || 'center') === 'center', onClick: () => setT('align', 'Hizalama')('center', { final: true }) },
            { icon: 'alignR', tip: 'Sağa hizala', on: t.align === 'right', onClick: () => setT('align', 'Hizalama')('right', { final: true }) },
          ]} />
        </div>
      </Sec>
      <Sec id="fill" code="03" title="Dolgu" sub={t.fill ? 'degrade' : null}>
        <Color label="Renk" value={t.color || '#ffffff'} onChange={setT('color', 'Yazı rengi')} disabled={!!t.fill} />
        <Toggle label="Degrade" on={!!t.fill} onChange={v => setT('fill', 'Degrade dolgu')(v ? { type: 'linear', angle: 90, stops: [{ at: 0, color: t.color || '#ffffff' }, { at: 1, color: '#e4ff3a' }] } : null, { final: true })} />
        {t.fill && <GradientEditor fill={t.fill} onChange={(f, final) => setT('fill', 'Degrade')(f, { final })} />}
      </Sec>
      <Sec id="spc" code="04" title="Yerleşim" defaultOpen={false}>
        <Row label="Harf aralığı" value={t.letterSpacing || 0} min={-40} max={200} sliderMin={-20} sliderMax={80} step={1} suffix=" px" def={0} onChange={setT('letterSpacing', 'Harf aralığı')} />
        <Row label="Satır aralığı" value={t.lineHeight || 1.12} min={0.5} max={4} sliderMax={2.5} step={0.01} digits={2} def={1.12} onChange={setT('lineHeight', 'Satır aralığı')} />
        <Row label="Genişlik" value={t.maxWidth || 0.86} min={0.1} max={1.5} sliderMax={1} step={1} scale={100} suffix="%" def={0.86} onChange={setT('maxWidth', 'Satır genişliği')} hint="Satır kaydırma genişliği (tuval yüzdesi)" />
        <Row label="Kavis" value={t.curve || 0} min={-100} max={100} step={1} def={0} onChange={setT('curve', 'Kavis')} />
      </Sec>
    </>
  )
}
