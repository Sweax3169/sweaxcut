// STİL: şablon hızlı seçimi (yalnız stil), kontur, ikinci kontur, gölge, parlama, arka plan kutusu
import React from 'react'
import { store } from '../../core/store.js'
import { defaultTextStyle } from '../../core/model.js'
import { Segmented } from '../controls.jsx'
import { Sec, Row, Vec2, Color, Note } from './common.jsx'
import { useReg } from './hooks.js'
import { gradCss } from './TextTab.jsx'

const NESTED = ['stroke', 'stroke2', 'shadow', 'glow', 'bg']
// yazı paketinin resmî uygulayıcısı (varsa) — şablon stilini kanonik biçimde yazar
const textPack = Object.values(import.meta.glob('../../packs/text/index.js', { eager: true }))[0] || {}

// Yazı stilinin CSS yaklaşığı (şablon kartları, altyazı stilleri)
export function textCss(s, px = 18) {
  if (!s) return {}
  const k = px / 96
  const st = { fontFamily: `"${s.font || 'Archivo Black'}", var(--font-ui)`, fontWeight: s.weight || 900, fontStyle: s.italic ? 'italic' : 'normal', fontSize: px, lineHeight: 1, color: s.color || '#fff' }
  const shadows = []
  if (s.glow && s.glow.enabled) shadows.push(`0 0 ${Math.max(2, s.glow.size * k * 1.2)}px ${s.glow.color}`, `0 0 ${Math.max(1, s.glow.size * k * 0.5)}px ${s.glow.color}`)
  if (s.shadow && s.shadow.enabled) shadows.push(`${s.shadow.x * k}px ${s.shadow.y * k}px ${s.shadow.blur * k}px ${hexA(s.shadow.color, s.shadow.opacity ?? 0.6)}`)
  if (s.stroke2 && s.stroke2.enabled) shadows.push(`0 0 0 ${s.stroke2.color}`, `0 0 ${Math.max(1, s.stroke2.width * k)}px ${s.stroke2.color}`)
  if (shadows.length) st.textShadow = shadows.join(', ')
  if (s.stroke && s.stroke.enabled) { st.WebkitTextStroke = `${Math.max(0.8, s.stroke.width * k * 2)}px ${s.stroke.color}`; st.paintOrder = 'stroke fill' }
  if (s.fill && s.fill.stops) { st.backgroundImage = gradCss(s.fill); st.WebkitBackgroundClip = 'text'; st.backgroundClip = 'text'; st.color = 'transparent' }
  if (s.bg && s.bg.enabled) { st.boxShadow = `inset 0 0 0 999px ${hexA(s.bg.color, s.bg.opacity ?? 0.7)}`; st.padding = `${Math.max(1, s.bg.padY * k)}px ${Math.max(2, s.bg.padX * k)}px`; st.borderRadius = Math.min(6, s.bg.radius * k) }
  if (s.uppercase) st.textTransform = 'uppercase'
  return st
}
export function hexA(hex, a) {
  const h = (hex || '#000000').replace('#', '')
  const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h.slice(0, 6)
  const n = parseInt(f, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// örnek metni kart genişliğine sığdıracak yazı boyutu
const fitPx = (t) => Math.max(8, Math.min(18, 58 / (Math.min(10, String(t).length) * 0.62)))

function Templates({ ctx }) {
  const { clip, b } = ctx
  const list = useReg('textTemplates')
  if (!list.length) return <Note>Yazı şablonu paketi yüklenmedi.</Note>
  const apply = (tpl) => b.edit(c => {
    if (textPack.applyTextTemplate) { textPack.applyTextTemplate(c, tpl.id, { useSample: false, position: false }); return }
    const d = defaultTextStyle()
    const tt = tpl.text || {}
    for (const k of Object.keys(tt)) {
      if (k === 'content') continue
      if (NESTED.includes(k)) c.text[k] = { ...d[k], ...tt[k] }
      else c.text[k] = JSON.parse(JSON.stringify(tt[k]))
    }
    // şablonda olmayan süslemeleri kapat ki stil gerçekten şablona benzesin
    for (const k of NESTED) if (!tt[k] && k !== 'stroke') c.text[k] = { ...c.text[k], enabled: false }
    if (!('fill' in tt)) c.text.fill = null
    c.templateId = tpl.id
  }, 'Şablon stili: ' + tpl.name)
  return (
    <div className="tplstrip">
      {list.map(tpl => {
        const s = { ...defaultTextStyle(), ...(tpl.text || {}) }
        for (const k of NESTED) s[k] = { ...defaultTextStyle()[k], ...((tpl.text || {})[k] || {}) }
        return (
          <button key={tpl.id} className={'tpl' + (clip.templateId === tpl.id ? ' on' : '')} onClick={() => apply(tpl)} data-tip={tpl.name}>
            <span className="tplprev"><span style={{ ...textCss(s, fitPx(tpl.sampleText || 'Aa')), whiteSpace: 'nowrap' }}>{(tpl.sampleText || 'Aa').slice(0, 10)}</span></span>
            <span className="inm">{tpl.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function Toggler({ on, onChange }) {
  return <span className={'toggle' + (on ? ' on' : '')} onClick={e => { e.stopPropagation(); onChange(!on) }} />
}

export default function TextStyleTab({ ctx }) {
  const { clip, b } = ctx
  const t = { ...defaultTextStyle(), ...(clip.text || {}) }
  const sub = (k) => ({ ...defaultTextStyle()[k], ...(t[k] || {}) })
  const set = (k, f, label) => (v, o) => { b.edit(c => { c.text[k] = { ...defaultTextStyle()[k], ...(c.text[k] || {}), [f]: v } }, label, 'ts:' + clip.id + k + f); if (o && o.final) store.endCoalesce() }
  const en = (k, label) => (v) => set(k, 'enabled', label)(v, { final: true })
  const st = sub('stroke'), st2 = sub('stroke2'), sh = sub('shadow'), gl = sub('glow'), bg = sub('bg')
  return (
    <>
      <Sec id="tpl" code="01" title="Şablonlar" sub="metin korunur">
        <Templates ctx={ctx} />
      </Sec>
      <Sec id="stroke" code="02" title="Kontur" sub={st.enabled ? st.width + ' px' : null} defaultOpen={st.enabled} right={<Toggler on={st.enabled} onChange={en('stroke', 'Kontur')} />}>
        <Color label="Renk" value={st.color} onChange={set('stroke', 'color', 'Kontur rengi')} disabled={!st.enabled} />
        <Row label="Kalınlık" value={st.width} min={0} max={60} sliderMax={40} step={0.5} digits={1} suffix=" px" def={8} onChange={set('stroke', 'width', 'Kontur kalınlığı')} disabled={!st.enabled} />
      </Sec>
      <Sec id="stroke2" code="03" title="İkinci kontur" sub={st2.enabled ? st2.width + ' px' : null} defaultOpen={st2.enabled} right={<Toggler on={st2.enabled} onChange={en('stroke2', 'İkinci kontur')} />}>
        <Color label="Renk" value={st2.color} onChange={set('stroke2', 'color', 'İkinci kontur rengi')} disabled={!st2.enabled} />
        <Row label="Kalınlık" value={st2.width} min={0} max={100} sliderMax={60} step={0.5} digits={1} suffix=" px" def={16} onChange={set('stroke2', 'width', 'İkinci kontur kalınlığı')} disabled={!st2.enabled} />
      </Sec>
      <Sec id="shadow" code="04" title="Gölge" defaultOpen={sh.enabled} right={<Toggler on={sh.enabled} onChange={en('shadow', 'Gölge')} />}>
        <Color label="Renk" value={sh.color} onChange={set('shadow', 'color', 'Gölge rengi')} disabled={!sh.enabled} />
        <Row label="Bulanıklık" value={sh.blur} min={0} max={100} sliderMax={60} step={1} suffix=" px" def={12} onChange={set('shadow', 'blur', 'Gölge bulanıklığı')} disabled={!sh.enabled} />
        <Vec2 label="Kayma" cells={[
          { axis: 'X', value: sh.x, onChange: set('shadow', 'x', 'Gölge X'), min: -100, max: 100, step: 1, def: 0 },
          { axis: 'Y', value: sh.y, onChange: set('shadow', 'y', 'Gölge Y'), min: -100, max: 100, step: 1, def: 6 },
        ]} />
        <Row label="Opaklık" value={sh.opacity ?? 0.6} min={0} max={1} step={1} scale={100} suffix="%" def={0.6} onChange={set('shadow', 'opacity', 'Gölge opaklığı')} disabled={!sh.enabled} />
      </Sec>
      <Sec id="glow" code="05" title="Parlama" defaultOpen={gl.enabled} right={<Toggler on={gl.enabled} onChange={en('glow', 'Parlama')} />}>
        <Color label="Renk" value={gl.color} onChange={set('glow', 'color', 'Parlama rengi')} disabled={!gl.enabled} />
        <Row label="Boyut" value={gl.size} min={0} max={160} sliderMax={100} step={1} suffix=" px" def={24} onChange={set('glow', 'size', 'Parlama boyutu')} disabled={!gl.enabled} />
        <Row label="Güç" value={gl.strength} min={0} max={4} sliderMax={3} step={0.05} digits={2} def={1} onChange={set('glow', 'strength', 'Parlama gücü')} disabled={!gl.enabled} />
      </Sec>
      <Sec id="tbg" code="06" title="Arka plan kutusu" defaultOpen={bg.enabled} right={<Toggler on={bg.enabled} onChange={en('bg', 'Yazı arka planı')} />}>
        <Color label="Renk" value={bg.color} onChange={set('bg', 'color', 'Kutu rengi')} disabled={!bg.enabled} />
        <Row label="Opaklık" value={bg.opacity ?? 0.7} min={0} max={1} step={1} scale={100} suffix="%" def={0.7} onChange={set('bg', 'opacity', 'Kutu opaklığı')} disabled={!bg.enabled} />
        <Row label="Köşe" value={bg.radius} min={0} max={100} sliderMax={60} step={1} suffix=" px" def={12} onChange={set('bg', 'radius', 'Kutu köşesi')} disabled={!bg.enabled} />
        <Vec2 label="İç boşluk" cells={[
          { axis: '↔', value: bg.padX, onChange: set('bg', 'padX', 'Kutu yatay boşluk'), min: 0, max: 200, step: 1, def: 24 },
          { axis: '↕', value: bg.padY, onChange: set('bg', 'padY', 'Kutu dikey boşluk'), min: 0, max: 200, step: 1, def: 12 },
        ]} />
        <Segmented label="Kapsam" value={bg.mode || 'block'} onChange={v => set('bg', 'mode', 'Kutu kapsamı')(v, { final: true })}
          options={[{ value: 'block', label: 'Blok', hint: 'Tüm metni tek kutu sarar' }, { value: 'line', label: 'Satır', hint: 'Her satıra ayrı kutu' }]} />
      </Sec>
    </>
  )
}
