// RENK: filtre (ad + yoğunluk + hızlı seçim), ayarlar (Işık / Renk / Detay), HSL, otomatik ayar
import React, { useState } from 'react'
import { store } from '../../core/store.js'
import { HSL_CHANNELS, defaultHSL } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import { Sec, Row, Note, Card } from './common.jsx'
import { useReg, useRegCats } from './hooks.js'
import Icon from '../Icon.jsx'

export const ADJ_LABELS = {
  exposure: 'Pozlama', brightness: 'Parlaklık', contrast: 'Kontrast', highlights: 'Vurgular', shadows: 'Gölgeler', whites: 'Beyazlar', blacks: 'Siyahlar',
  temperature: 'Sıcaklık', tint: 'Renk tonu', saturation: 'Doygunluk', vibrance: 'Canlılık', hue: 'Ton',
  sharpen: 'Keskinlik', clarity: 'Netlik', grain: 'Gren', fade: 'Soldurma', vignette: 'Vinyet',
}
export const ADJ_GROUPS = [
  { id: 'light', code: 'IŞK', title: 'Işık', keys: ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'] },
  { id: 'color', code: 'RNK', title: 'Renk', keys: ['temperature', 'tint', 'saturation', 'vibrance', 'hue'] },
  { id: 'detail', code: 'DTY', title: 'Detay', keys: ['sharpen', 'clarity', 'grain', 'fade', 'vignette'] },
]
const TONE = { temperature: 'tn-temp', tint: 'tn-tint', hue: 'tn-hue', saturation: 'tn-sat', vibrance: 'tn-sat', exposure: 'tn-lum', brightness: 'tn-lum' }
const AUTO = { contrast: 10, vibrance: 14, highlights: -14, shadows: 12, clarity: 6, sharpen: 8, whites: 4, blacks: 3 }

const HSL_COL = { red: '#ff3b3b', orange: '#ff8a1f', yellow: '#ffe03a', green: '#3fdc5a', cyan: '#30e0e6', blue: '#3a6bff', purple: '#9b5cff', magenta: '#ff4fd0' }
const HSL_TR = { red: 'Kırmızı', orange: 'Turuncu', yellow: 'Sarı', green: 'Yeşil', cyan: 'Camgöbeği', blue: 'Mavi', purple: 'Mor', magenta: 'Eflatun' }

export function filterSwatch(def) {
  if (!def) return 'var(--bg-3)'
  if (def.swatch && def.swatch.length) return def.swatch.length > 1 ? `linear-gradient(135deg, ${def.swatch.join(', ')})` : def.swatch[0]
  const a = def.adjust || {}
  const t = (a.temperature || 0) / 100, s = (a.saturation || 0) / 100
  const r = Math.round(120 + t * 90), g = Math.round(118 + (a.tint ? -a.tint / 3 : 0)), bl = Math.round(124 - t * 90)
  if (def.mono) return 'linear-gradient(135deg, #e8e8e8, #202020)'
  return `linear-gradient(135deg, rgb(${r},${g},${bl}) , rgb(${Math.round(r * 0.35)},${Math.round(g * 0.35)},${Math.round(bl * 0.35 + s * 30)}))`
}

// ---------------------------------------------------------------- filtre
export function FilterSection({ ctx, full, code = '01' }) {
  const { clip, b } = ctx
  const list = useReg('filters')
  const cats = useRegCats('filters')
  const [cat, setCat] = useState(null)
  const [q, setQ] = useState('')
  const f = clip.filter
  const def = f && f.id ? regGet('filters', f.id) : null
  const apply = (d) => b.edit(c => { c.filter = { id: d.id, intensity: c.filter ? (c.filter.intensity ?? 1) : 1 } }, 'Filtre')
  const ql = q.trim().toLocaleLowerCase('tr-TR')
  const shown = list.filter(x => (!cat || x.category === cat) && (!ql || (x.name || '').toLocaleLowerCase('tr-TR').includes(ql) || (x.tags || []).some(t => t.includes(ql))))
  const strip = full ? shown : shown.slice(0, 15)
  return (
    <Sec id={full ? 'filt-full' : 'filt'} code={code} title="Filtre" sub={def ? def.name : null}>
      {f && f.id ? (
        <div className="curfilter">
          <i className="fsw" style={{ background: filterSwatch(def) }} />
          <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="fname">{def ? def.name : f.id}</span>
            <span className="faint mono" style={{ fontSize: 9.5 }}>{def ? (cats.find(c => c.id === def.category) || {}).name || def.category : 'kayıtlı değil'}</span>
          </div>
          <button className="btn sm danger" onClick={() => b.edit(c => { c.filter = null }, 'Filtreyi kaldır')}><Icon name="x" size={11} />Kaldır</button>
        </div>
      ) : <Note>Filtre yok. Aşağıdan seç ya da kütüphaneden sürükle.</Note>}
      {f && f.id && (
        <Row label="Yoğunluk" value={f.intensity ?? 1} min={0} max={1} step={1} scale={100} suffix="%" def={1}
          onChange={(v, o) => { b.edit(c => { if (c.filter) c.filter.intensity = v }, 'Filtre yoğunluğu', 'fint:' + clip.id); if (o && o.final) store.endCoalesce() }} />
      )}
      {list.length ? (
        <>
          {full && (
            <>
              <div className="search"><Icon name="search" size={13} /><input placeholder="Filtre ara" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.stopPropagation()} /></div>
              {cats.length > 1 && (
                <div className="chips sq">
                  <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>Tümü</button>
                  {cats.map(c => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>)}
                </div>
              )}
            </>
          )}
          <div className={'cgrid ' + (full ? 'c4' : 'c5')}>
            {strip.map(d => (
              <Card key={d.id} on={f && f.id === d.id} name={d.name} onClick={() => apply(d)} tip={d.name}>
                <i className="fsw big" style={{ background: filterSwatch(d) }} />
              </Card>
            ))}
          </div>
          {!full && list.length > strip.length && (
            <button className="btn sm ghost" onClick={() => store.setUI({ leftTab: 'filters' })}>Tüm filtreler ({list.length}) <Icon name="chevR" size={11} /></button>
          )}
        </>
      ) : <Note>Filtre paketi henüz yüklenmedi.</Note>}
    </Sec>
  )
}

// ---------------------------------------------------------------- ayarlar
export function AdjustSections({ ctx, startCode = 2 }) {
  const { clip, b } = ctx
  const adj = clip.adjust || {}
  const anyAdj = Object.keys(ADJ_LABELS).some(k => adj[k] || b.has('adjust.' + k))
  const resetKeys = (keys, label) => b.edit(c => {
    for (const k of keys) c.adjust[k] = 0
    if (c.keyframes) for (const k of keys) delete c.keyframes['adjust.' + k]
  }, label)
  return (
    <>
      <div className="adjbar">
        <button className="btn sm" onClick={() => b.multi(Object.fromEntries(Object.entries(AUTO).map(([k, v]) => ['adjust.' + k, v])), 'Otomatik ayar', true)}
          data-tip="Hafif kontrast, canlılık ve detay; vurguları kurtarır">
          <Icon name="wand" size={13} />Otomatik ayar
        </button>
        <span className="grow" />
        {anyAdj && <button className="btn sm ghost" onClick={() => resetKeys(Object.keys(ADJ_LABELS), 'Ayarları sıfırla')}><Icon name="undo" size={12} />Hepsini sıfırla</button>}
      </div>
      {ADJ_GROUPS.map((g, i) => {
        const changed = g.keys.filter(k => adj[k]).length
        return (
          <Sec key={g.id} id={'adj-' + g.id} code={String(startCode + i).padStart(2, '0')} title={g.title} sub={changed ? changed + ' değişik' : null}
            keys={{ clip, paths: g.keys.map(k => 'adjust.' + k) }}
            onReset={changed ? () => resetKeys(g.keys, g.title + ' sıfırla') : null}>
            {g.keys.map(k => (
              <Row key={k} {...b.row('adjust.' + k, ADJ_LABELS[k], { def: 0 })} min={k === 'grain' ? 0 : -100} max={100} step={1} cls={TONE[k]} />
            ))}
          </Sec>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------- HSL
export function HslSection({ ctx, code = '05' }) {
  const { clip, b } = ctx
  const [ch, setCh] = useState('red')
  const hsl = clip.hsl || defaultHSL()
  const cur = hsl[ch] || { h: 0, s: 0, l: 0 }
  const changed = HSL_CHANNELS.filter(n => hsl[n] && (hsl[n].h || hsl[n].s || hsl[n].l))
  const set = (k, label) => (v, o) => {
    b.edit(c => { if (!c.hsl) c.hsl = defaultHSL(); c.hsl[ch] = { ...(c.hsl[ch] || { h: 0, s: 0, l: 0 }), [k]: v } }, label, 'hsl:' + clip.id + ch + k)
    if (o && o.final) store.endCoalesce()
  }
  return (
    <Sec id="hsl" code={code} title="HSL" sub={changed.length ? changed.length + ' kanal' : null} defaultOpen={false}
      onReset={changed.length ? () => b.edit(c => { c.hsl = defaultHSL() }, 'HSL sıfırla') : null}>
      <div className="hsldots">
        {HSL_CHANNELS.map(n => {
          const v = hsl[n]
          const mod = v && (v.h || v.s || v.l)
          return (
            <button key={n} className={'hd' + (n === ch ? ' on' : '') + (mod ? ' mod' : '')} onClick={() => setCh(n)} data-tip={HSL_TR[n]}>
              <i style={{ background: HSL_COL[n] }} />
            </button>
          )
        })}
      </div>
      <div className="hslname"><span style={{ color: HSL_COL[ch] }}>■</span> {HSL_TR[ch]}</div>
      <Row label="Ton" value={cur.h} min={-100} max={100} step={1} def={0} onChange={set('h', 'HSL ton')} cls="tn-hue" />
      <Row label="Doygunluk" value={cur.s} min={-100} max={100} step={1} def={0} onChange={set('s', 'HSL doygunluk')} />
      <Row label="Açıklık" value={cur.l} min={-100} max={100} step={1} def={0} onChange={set('l', 'HSL açıklık')} cls="tn-lum" />
    </Sec>
  )
}

export default function ColorTab({ ctx }) {
  return (
    <>
      <FilterSection ctx={ctx} code="01" />
      <AdjustSections ctx={ctx} startCode={2} />
      <HslSection ctx={ctx} code="05" />
    </>
  )
}
