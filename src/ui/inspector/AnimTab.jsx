// ANİMASYON: Giriş / Çıkış / Döngü — kart ızgarası (üzerine gelince canlı önizleme) + süre
import React, { useEffect, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import { get as regGet } from '../../engine/registry.js'
import { playback } from '../../engine/playback.js'
import Icon from '../Icon.jsx'
import { Sec, Row, SubTabs, Card, Note } from './common.jsx'
import { useReg, clamp } from './hooks.js'

const SLOTS = [{ value: 'in', label: 'Giriş' }, { value: 'out', label: 'Çıkış' }, { value: 'loop', label: 'Döngü' }]

// Animasyon önizleme küçük resmi. Dururken: hareket izi (soluk hayalet kareler) ya da yazıda ara poz;
// üzerine gelince rAF ile oynar (React yeniden çizimi yok).
const GHOST = { in: [0, 0.3, 0.6], out: [0.4, 0.7, 1], loop: [0.25, 0.5, 0.75] }
function frameStyle(el, a) {
  const s = a.scale ?? 1
  el.style.transform = `translate(${(a.x || 0) * 44}px, ${(a.y || 0) * 44}px) rotate(${a.rotation || 0}deg) scale(${s * (a.scaleX ?? 1)}, ${s * (a.scaleY ?? 1)}) skew(${a.skewX || 0}deg, ${a.skewY || 0}deg)`
  el.style.filter = `blur(${(a.blur || 0) * 6}px) brightness(${1 + (a.brightness || 0)})`
  return clamp(a.opacity ?? 1, 0, 1)
}
function clipPose(def, p) {
  try { return def.fn(p, { w: 44, h: 44, clipW: 18, clipH: 26, seed: 7 }) || {} } catch (e) { return {} }
}
function AnimThumb({ def, kind, slot, active, color }) {
  const ref = useRef(null)
  const gref = useRef([])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const units = [...el.querySelectorAll('.u')]
    const apply = (p) => {
      if (kind === 'clip') { el.style.opacity = frameStyle(el, clipPose(def, p)); return }
      const n = units.length, st = def.stagger ?? (def.unit === 'whole' ? 0 : 0.08)
      const spread = Math.min(0.85, st * (n - 1)), span = Math.max(0.1, 1 - spread)
      units.forEach((u, i) => {
        const pi = def.unit === 'whole' ? p : clamp((p - i * st) / span, 0, 1)
        let a = {}
        try { a = def.fn(slot === 'loop' ? p : pi, def.unit === 'whole' ? 0 : i, def.unit === 'whole' ? 1 : n, { fontSize: 16, lineH: 18, seed: 7 }) || {} } catch (e) { a = {} }
        const s = a.scale ?? 1
        u.style.transform = `translate(${a.x || 0}px, ${a.y || 0}px) rotate(${a.rotation || 0}deg) scale(${s * (a.scaleX ?? 1)}, ${s * (a.scaleY ?? 1)}) skew(${a.skewX || 0}deg)`
        let op = a.opacity ?? 1
        if (a.visibleChars != null) op *= (i / n) < a.visibleChars ? 1 : 0
        u.style.clipPath = a.clip != null ? `inset(0 ${(1 - clamp(a.clip, 0, 1)) * 100}% 0 0)` : ''
        u.style.opacity = clamp(op, 0, 1)
        u.style.filter = a.blur ? `blur(${a.blur * 0.4}px)` : ''
        u.style.color = a.color || ''
      })
    }
    const ghosts = gref.current.filter(Boolean)
    if (!active) {
      if (kind === 'clip') {
        // son poz + hareket izi
        apply(slot === 'out' ? 0 : slot === 'in' ? 1 : 0)
        GHOST[slot].forEach((gp, i) => { const g = ghosts[i]; if (!g) return; const o = frameStyle(g, clipPose(def, gp)); g.style.opacity = o * (0.16 + i * 0.12) })
      } else apply(slot === 'out' ? 0.45 : slot === 'in' ? 0.55 : 0.3)
      return
    }
    for (const g of ghosts) g.style.opacity = 0
    let raf = 0
    const t0 = performance.now()
    const dur = Math.max(0.25, def.duration || 0.6) * 1000
    const tick = () => {
      const t = performance.now() - t0
      const p = slot === 'loop' ? t / dur : Math.min(1, (t % (dur + 450)) / dur)
      apply(p)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, def, slot, kind])
  if (kind === 'clip') {
    return (
      <span className="athumb" style={{ '--ac': color }}>
        {[0, 1, 2].map(i => <i key={i} ref={el => { gref.current[i] = el }} className="aframe ghost" />)}
        <i ref={ref} className="aframe" />
      </span>
    )
  }
  return (
    <span className="athumb">
      <span ref={ref} className="atext">{'Abc'.split('').map((c, i) => <span key={i} className="u">{c}</span>)}</span>
    </span>
  )
}

function AnimGrid({ items, kind, slot, cur, apply, color, hover, setHover, lead }) {
  return (
    <div className="cgrid c4">
      {lead}
      {items.map(d => (
        <Card key={d.id} on={cur === d.id} name={d.name} onClick={() => apply(d)} tip={d.name}
          onEnter={() => setHover(d.id)} onLeave={() => setHover(h => (h === d.id ? null : h))}>
          <AnimThumb def={d} kind={kind} slot={slot} active={hover === d.id} color={color} />
        </Card>
      ))}
    </div>
  )
}

export default function AnimTab({ ctx, text }) {
  const { clip, b } = ctx
  const [slot, setSlot] = useState(() => {
    const a = clip.anim || {}
    return a.in ? 'in' : a.out ? 'out' : a.loop ? 'loop' : 'in'
  })
  const [hover, setHover] = useState(null)
  const clipAnims = useReg('clipAnims')
  const textAnims = useReg('textAnims')
  const anim = clip.anim || {}
  const cur = anim[slot]
  const color = `var(--c-${clip.type})`
  const curDef = cur && cur.id ? (regGet('textAnims', cur.id) || regGet('clipAnims', cur.id)) : null
  const apply = (d) => b.edit(c => {
    const prev = (c.anim || {})[slot]
    c.anim = { in: null, out: null, loop: null, ...(c.anim || {}), [slot]: d ? { id: d.id, duration: prev && prev.duration ? prev.duration : (d.duration || (slot === 'loop' ? 1 : 0.5)) } : null }
  }, d ? 'Animasyon: ' + d.name : 'Animasyonu kaldır')
  const maxD = slot === 'loop' ? 5 : Math.max(0.2, Math.min(10, clip.duration))
  const preview = () => {
    if (!cur) return
    const d = Math.min(cur.duration || 0.5, clip.duration)
    const t0 = slot === 'out' ? clip.start + clip.duration - d - 0.15 : clip.start
    playback.seek(Math.max(clip.start, t0))
    playback.play()
    clearTimeout(window.__sweaxAnimPrev)
    window.__sweaxAnimPrev = setTimeout(() => playback.pause(), (slot === 'loop' ? Math.min(clip.duration, d * 2.2) : d + 0.35) * 1000)
  }
  const ca = clipAnims.filter(x => x.category === slot)
  const ta = textAnims.filter(x => x.category === slot)
  const none = (
    <Card on={!cur} name="Yok" onClick={() => apply(null)}><span className="athumb"><Icon name="x" size={16} style={{ color: 'var(--tx-3)' }} /></span></Card>
  )
  return (
    <>
      <div className="stickytop">
        <SubTabs value={slot} onChange={setSlot} options={SLOTS.map(s => ({ ...s, dot: !!anim[s.value] }))} />
        <div className="animcur">
          <span className="faint mono" style={{ fontSize: 9.5 }}>{SLOTS.find(s => s.value === slot).label.toLocaleUpperCase('tr-TR')}</span>
          <span className="grow nm">{curDef ? curDef.name : cur ? cur.id : '—'}</span>
          {cur && <button className="btn sm" onClick={preview}><Icon name="play" size={10} />Önizle</button>}
        </div>
        {cur && (
          <Row label={slot === 'loop' ? 'Döngü süresi' : 'Süre'} value={cur.duration || 0.5} min={0.05} max={maxD} sliderMin={0.1} step={0.05} digits={2} suffix=" sn"
            def={curDef ? curDef.duration : 0.5}
            onChange={(v, o) => { b.edit(c => { if (c.anim && c.anim[slot]) c.anim[slot].duration = v }, 'Animasyon süresi', 'animd:' + clip.id + slot); if (o && o.final) store.endCoalesce() }} />
        )}
      </div>
      {text ? (
        <>
          <Sec id={'ta-' + slot} code="01" title="Yazı animasyonları" sub={ta.length ? String(ta.length) : null}>
            <AnimGrid items={ta} kind="text" slot={slot} cur={cur && cur.id} apply={apply} color={color} hover={hover} setHover={setHover} lead={none} />
            {!ta.length && <Note>Yazı animasyon paketi yüklenmedi.</Note>}
          </Sec>
          <Sec id={'tca-' + slot} code="02" title="Klip animasyonları" sub={ca.length ? String(ca.length) : null} defaultOpen={false}>
            {ca.length ? <AnimGrid items={ca} kind="clip" slot={slot} cur={cur && cur.id} apply={apply} color={color} hover={hover} setHover={setHover} /> : <Note>Klip animasyon paketi yüklenmedi.</Note>}
          </Sec>
        </>
      ) : (
        <Sec id={'ca-' + slot} code="01" title={SLOTS.find(s => s.value === slot).label + ' animasyonları'} sub={ca.length ? String(ca.length) : null}>
          <AnimGrid items={ca} kind="clip" slot={slot} cur={cur && cur.id} apply={apply} color={color} hover={hover} setHover={setHover} lead={none} />
          {!ca.length && <Note>Animasyon paketi yüklenmedi.</Note>}
        </Sec>
      )}
    </>
  )
}
