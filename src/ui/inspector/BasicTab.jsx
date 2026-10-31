// TEMEL: konum, ölçek, döndürme, ayna, opaklık, karışım, sığdırma, hizalama, kırpma, tuval, krom anahtar, sabitleme
import React, { useEffect, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import { defaultTransform, defaultChroma } from '../../core/model.js'
import { BLEND_MODES } from '../../engine/shaders.js'
import { playback } from '../../engine/playback.js'
import * as A from '../actions.js'
import { Select, Segmented, Toggle } from '../controls.jsx'
import { Sec, Row, Vec2, Color, IconBtns, Note } from './common.jsx'
import { clamp } from './hooks.js'
import BgEditor from './BgEditor.jsx'

const BLEND_OPTS = BLEND_MODES.map(([value, label]) => ({ value, label }))

// mini hizalama ikonları (14px)
const al = (d) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square"><path d={d} /></svg>
const AL = {
  l: al('M1.5 1v12M4 4h7v6H4z'),
  ch: al('M7 1v12M3 4h8v6H3z'),
  r: al('M12.5 1v12M3 4h7v6H3z'),
  t: al('M1 1.5h12M4 4h6v7H4z'),
  cv: al('M1 7h12M4 3h6v8H4z'),
  b: al('M1 12.5h12M4 3h6v7H4z'),
  c: al('M7 1v3M7 10v3M1 7h3M10 7h3M4.5 4.5h5v5h-5z'),
}

// Katmanın tuvale göre (oran) boyutu — hizalama için
function layerFrac(clip, media, settings, b) {
  const W = settings.width, H = settings.height
  const s = b.val('transform.scale', 1)
  const sx = b.val('transform.scaleX', 1), sy = b.val('transform.scaleY', 1)
  if ((clip.type === 'video' || clip.type === 'image') && media && media.width) {
    const cr = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
    const cw = media.width * (1 - cr.l - cr.r), ch = media.height * (1 - cr.t - cr.b)
    const mAR = cw / Math.max(1, ch), cAR = W / H
    let bw, bh
    const fit = clip.fit || 'contain'
    if (fit === 'fill') { bw = W; bh = H } else if ((fit === 'contain') === (mAR > cAR)) { bw = W; bh = W / mAR } else { bh = H; bw = H * mAR }
    return { w: Math.abs(bw * s * sx) / W, h: Math.abs(bh * s * sy) / H }
  }
  const g = playback.comp && playback.comp.geom && playback.comp.geom.get(clip.id)
  if (g && g.W) return { w: g.w / g.W, h: g.h / g.H }
  return null
}

export function TransformSection({ ctx, code = '01' }) {
  const { clip, b, settings, media } = ctx
  const W = settings.width, H = settings.height
  const tr = clip.transform || defaultTransform()
  const nonUniDerived = (tr.scaleX !== 1 || tr.scaleY !== 1 || b.has('transform.scaleX') || b.has('transform.scaleY'))
  const [nonUni, setNonUni] = useState(nonUniDerived)
  useEffect(() => { setNonUni(nonUniDerived) }, [clip.id])
  const showNU = nonUni || nonUniDerived
  const align = (ax, where) => {
    const f = layerFrac(clip, media, settings, b)
    if (!f && where !== 'c') { store.toast('Bu katmanın boyutu henüz ölçülemedi — önizlemede görünür olmalı', 'info', 2200); return }
    const v = {}
    if (ax === 'x' || ax === 'xy') v['transform.x'] = where === 'c' ? 0 : where === 'min' ? -0.5 + f.w / 2 : 0.5 - f.w / 2
    if (ax === 'y' || ax === 'xy') v['transform.y'] = where === 'c' ? 0 : where === 'min' ? -0.5 + f.h / 2 : 0.5 - f.h / 2
    b.multi(v, 'Hizala', true)
  }
  return (
    <Sec id="tr" code={code} title="Konum ve boyut" keys={{ clip, paths: ['transform'] }}
      onReset={() => b.edit(c => {
        const t = defaultTransform()
        c.transform = { ...t, flipH: c.transform.flipH, flipV: c.transform.flipV, scale: c.type === 'sticker' ? 0.5 : 1 }
        if (c.keyframes) for (const k of Object.keys(c.keyframes)) if (k.startsWith('transform.')) delete c.keyframes[k]
      }, 'Dönüşümü sıfırla')}>
      <Vec2 label="Konum" hint="Tuval pikseli (merkez 0). Etiketi sürükle, Shift = ince."
        cells={[
          { axis: 'X', value: b.val('transform.x', 0), onChange: b.set('transform.x', 'Konum X'), scale: W, step: 1, min: -5, max: 5, kf: b.kf('transform.x'), def: 0 },
          { axis: 'Y', value: b.val('transform.y', 0), onChange: b.set('transform.y', 'Konum Y'), scale: H, step: 1, min: -5, max: 5, kf: b.kf('transform.y'), def: 0 },
        ]} />
      <Row {...b.row('transform.scale', clip.type === 'text' ? 'Boyut' : 'Ölçek', { def: clip.type === 'sticker' ? 0.5 : 1 })}
        min={0.01} max={20} sliderMin={0.05} sliderMax={4} step={1} scale={100} suffix="%" />
      {showNU && (
        <Vec2 label="Orantısız"
          cells={[
            { axis: 'G', value: b.val('transform.scaleX', 1), onChange: b.set('transform.scaleX', 'Ölçek X'), scale: 100, step: 1, min: 0.01, max: 20, suffix: '%', kf: b.kf('transform.scaleX'), def: 1 },
            { axis: 'Y', value: b.val('transform.scaleY', 1), onChange: b.set('transform.scaleY', 'Ölçek Y'), scale: 100, step: 1, min: 0.01, max: 20, suffix: '%', kf: b.kf('transform.scaleY'), def: 1 },
          ]} />
      )}
      <Row {...b.row('transform.rotation', 'Döndürme', { def: 0 })} min={-36000} max={36000} sliderMin={-180} sliderMax={180} step={1} suffix="°" />
      <div className="tools2">
        <IconBtns items={[
          { icon: 'rotate', tip: '90° döndür', onClick: () => A.rotate90() },
          { icon: 'flipH', tip: 'Yatay ayna', on: !!tr.flipH, onClick: () => A.mirror('h') },
          { icon: 'flipV', tip: 'Dikey ayna', on: !!tr.flipV, onClick: () => A.mirror('v') },
          '|',
          { label: 'G/Y', tip: 'Orantısız ölçek (genişlik / yükseklik ayrı)', on: showNU, onClick: () => {
            if (showNU) { setNonUni(false); b.edit(c => { c.transform.scaleX = 1; c.transform.scaleY = 1; if (c.keyframes) { delete c.keyframes['transform.scaleX']; delete c.keyframes['transform.scaleY'] } }, 'Orantılı ölçek') } else setNonUni(true)
          } },
        ]} />
        <IconBtns items={[
          { svg: AL.l, tip: 'Sola yasla', onClick: () => align('x', 'min') },
          { svg: AL.ch, tip: 'Yatay ortala', onClick: () => align('x', 'c') },
          { svg: AL.r, tip: 'Sağa yasla', onClick: () => align('x', 'max') },
          { svg: AL.t, tip: 'Üste yasla', onClick: () => align('y', 'min') },
          { svg: AL.cv, tip: 'Dikey ortala', onClick: () => align('y', 'c') },
          { svg: AL.b, tip: 'Alta yasla', onClick: () => align('y', 'max') },
          { svg: AL.c, tip: 'Tam ortala', onClick: () => align('xy', 'c') },
        ]} />
      </div>
    </Sec>
  )
}

export function LookSection({ ctx, code = '02', fit }) {
  const { clip, b } = ctx
  return (
    <Sec id="look" code={code} title="Görünüm" keys={{ clip, paths: ['opacity'] }}
      onReset={() => b.edit(c => { c.opacity = 1; c.blend = 'normal'; if (fit) c.fit = 'contain'; if (c.keyframes) delete c.keyframes.opacity }, 'Görünümü sıfırla')}>
      <Row {...b.row('opacity', 'Opaklık', { def: 1 })} min={0} max={1} step={1} scale={100} suffix="%" />
      <Select label="Karışım" value={clip.blend || 'normal'} options={BLEND_OPTS} onChange={v => b.setS('blend', 'Karışım modu')(v, { final: true })} />
      {fit && (
        <Segmented label="Sığdırma" value={clip.fit || 'contain'} onChange={v => b.setS('fit', 'Sığdırma')(v, { final: true })}
          options={[{ value: 'contain', label: 'Sığdır', hint: 'Tamamı görünür' }, { value: 'cover', label: 'Doldur', hint: 'Tuvali kaplar, taşan kırpılır' }, { value: 'fill', label: 'Uzat', hint: 'Oranı bozarak tam doldurur' }]} />
      )}
    </Sec>
  )
}

// ---------------------------------------------------------------- kırpma
const CROP_PRESETS = [
  { id: 'free', label: 'Orijinal' },
  { id: '1:1', r: 1 }, { id: '9:16', r: 9 / 16 }, { id: '16:9', r: 16 / 9 }, { id: '4:5', r: 4 / 5 }, { id: '4:3', r: 4 / 3 }, { id: 'canvas', label: 'Tuval' },
]

function CropBox({ crop, ar, onChange }) {
  const ref = useRef(null)
  const maxW = 286, maxH = 112
  let bw = maxW, bh = maxW / ar
  if (bh > maxH) { bh = maxH; bw = maxH * ar }
  const down = (e, what) => {
    e.preventDefault(); e.stopPropagation()
    const x0 = e.clientX, y0 = e.clientY, c0 = { ...crop }
    let cur = c0
    const move = (ev) => {
      const dx = (ev.clientX - x0) / bw, dy = (ev.clientY - y0) / bh
      const c = { ...c0 }
      if (what === 'l') c.l = clamp(c0.l + dx, 0, 0.95 - c0.r)
      if (what === 'r') c.r = clamp(c0.r - dx, 0, 0.95 - c0.l)
      if (what === 't') c.t = clamp(c0.t + dy, 0, 0.95 - c0.b)
      if (what === 'b') c.b = clamp(c0.b - dy, 0, 0.95 - c0.t)
      if (what === 'm') {
        const ddx = clamp(dx, -c0.l, c0.r), ddy = clamp(dy, -c0.t, c0.b)
        c.l = c0.l + ddx; c.r = c0.r - ddx; c.t = c0.t + ddy; c.b = c0.b - ddy
      }
      for (const k of 'ltrb') c[k] = Math.round(c[k] * 1000) / 1000
      cur = c
      onChange(c, false)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onChange(cur, true) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const x = crop.l * bw, y = crop.t * bh, w = (1 - crop.l - crop.r) * bw, h = (1 - crop.t - crop.b) * bh
  return (
    <div className="cropbox" ref={ref}>
      <svg width={bw} height={bh} style={{ display: 'block' }}>
        <defs>
          <pattern id="cbhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-2)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={bw} height={bh} fill="url(#cbhatch)" />
        <rect x={x} y={y} width={w} height={h} fill="var(--bg-3)" stroke="var(--sig)" strokeWidth="1" style={{ cursor: 'move' }} onPointerDown={e => down(e, 'm')} />
        <line x1={x + w / 3} y1={y} x2={x + w / 3} y2={y + h} stroke="var(--line-3)" strokeDasharray="2 3" pointerEvents="none" />
        <line x1={x + 2 * w / 3} y1={y} x2={x + 2 * w / 3} y2={y + h} stroke="var(--line-3)" strokeDasharray="2 3" pointerEvents="none" />
        <line x1={x} y1={y + h / 3} x2={x + w} y2={y + h / 3} stroke="var(--line-3)" strokeDasharray="2 3" pointerEvents="none" />
        <line x1={x} y1={y + 2 * h / 3} x2={x + w} y2={y + 2 * h / 3} stroke="var(--line-3)" strokeDasharray="2 3" pointerEvents="none" />
        <rect x={x - 3} y={y + h / 2 - 7} width="6" height="14" fill="var(--sig)" style={{ cursor: 'ew-resize' }} onPointerDown={e => down(e, 'l')} />
        <rect x={x + w - 3} y={y + h / 2 - 7} width="6" height="14" fill="var(--sig)" style={{ cursor: 'ew-resize' }} onPointerDown={e => down(e, 'r')} />
        <rect x={x + w / 2 - 7} y={y - 3} width="14" height="6" fill="var(--sig)" style={{ cursor: 'ns-resize' }} onPointerDown={e => down(e, 't')} />
        <rect x={x + w / 2 - 7} y={y + h - 3} width="14" height="6" fill="var(--sig)" style={{ cursor: 'ns-resize' }} onPointerDown={e => down(e, 'b')} />
      </svg>
      <span className="cbdim mono">{Math.round((1 - crop.l - crop.r) * 100)}×{Math.round((1 - crop.t - crop.b) * 100)}%</span>
    </div>
  )
}

export function CropSection({ ctx, code }) {
  const { clip, b, media, settings } = ctx
  const crop = clip.crop || { l: 0, t: 0, r: 0, b: 0 }
  const ar = media && media.width ? media.width / media.height : 16 / 9
  const setCrop = (c, final) => { b.edit(x => { x.crop = c }, 'Kırp', 'crop:' + clip.id); if (final) store.endCoalesce() }
  const preset = (p) => {
    if (p.id === 'free') return setCrop({ l: 0, t: 0, r: 0, b: 0 }, true)
    const tr = p.id === 'canvas' ? settings.width / settings.height : p.r
    if (ar > tr) { const k = (1 - tr / ar) / 2; setCrop({ l: k, r: k, t: 0, b: 0 }, true) } else { const k = (1 - ar / tr) / 2; setCrop({ l: 0, r: 0, t: k, b: k }, true) }
  }
  const one = (k, label) => (
    <Row label={label} value={crop[k]} min={0} max={0.95} step={1} scale={100} suffix="%" def={0}
      onChange={(v, o) => {
        const opp = { l: 'r', r: 'l', t: 'b', b: 't' }[k]
        setCrop({ ...crop, [k]: clamp(v, 0, 0.95 - crop[opp]) }, o && o.final)
      }} />
  )
  const active = crop.l || crop.t || crop.r || crop.b
  return (
    <Sec id="crop" code={code} title="Kırp" sub={active ? 'açık' : null} defaultOpen={false} onReset={active ? () => setCrop({ l: 0, t: 0, r: 0, b: 0 }, true) : null}>
      <CropBox crop={crop} ar={ar} onChange={setCrop} />
      <div className="chips sq">
        {CROP_PRESETS.map(p => <button key={p.id} className="chip" onClick={() => preset(p)}>{p.label || p.id}</button>)}
      </div>
      {one('l', 'Sol')}{one('r', 'Sağ')}{one('t', 'Üst')}{one('b', 'Alt')}
    </Sec>
  )
}

export function CanvasSection({ ctx, code }) {
  const { clip, b, settings } = ctx
  const on = !!clip.canvasBg
  return (
    <Sec id="cbg" code={code} title="Arka plan tuvali" sub={on ? 'klibe özel' : 'proje'} defaultOpen={false}>
      <Toggle label="Klibe özel" on={on} hint="Kapalıyken proje arka planı kullanılır"
        onChange={v => b.edit(c => { c.canvasBg = v ? JSON.parse(JSON.stringify(settings.bg)) : null }, v ? 'Klibe özel arka plan' : 'Proje arka planı')} />
      {on ? (
        <BgEditor bg={clip.canvasBg} onPatch={(patch, final) => { b.edit(c => { c.canvasBg = { ...c.canvasBg, ...patch } }, 'Arka plan', 'cbg:' + clip.id); if (final) store.endCoalesce() }} />
      ) : <Note>Arka plan, klip tuvali tam kaplamadığında görünür. Proje ayarı: <b>{({ blur: 'Bulanık', color: 'Renk', gradient: 'Degrade', image: 'Görsel' })[settings.bg.type] || '—'}</b></Note>}
    </Sec>
  )
}

export function ChromaSection({ ctx, code }) {
  const { clip, b } = ctx
  const ch = clip.chroma || defaultChroma()
  const set = (k, label) => (v, o) => { b.edit(c => { c.chroma = { ...(c.chroma || defaultChroma()), [k]: v } }, label, 'chroma:' + clip.id + k); if (o && o.final) store.endCoalesce() }
  return (
    <Sec id="chroma" code={code} title="Krom anahtar" sub={ch.enabled ? 'açık' : null} defaultOpen={!!ch.enabled}
      right={<span className={'toggle' + (ch.enabled ? ' on' : '')} onClick={e => { e.stopPropagation(); set('enabled', 'Krom anahtar')(!ch.enabled, { final: true }) }} />}
      onReset={ch.enabled ? () => b.edit(c => { c.chroma = defaultChroma() }, 'Krom anahtarı sıfırla') : null}>
      <Color label="Anahtar renk" value={ch.color} onChange={set('color', 'Anahtar renk')} presets={false} />
      <div className="keyswatches">
        {[['#00ff00', 'Yeşil perde'], ['#00b140', 'Stüdyo yeşili'], ['#0047bb', 'Mavi perde'], ['#ffffff', 'Beyaz'], ['#000000', 'Siyah']].map(([c, n]) => (
          <button key={c} className={'ks' + (c === ch.color ? ' on' : '')} style={{ background: c }} data-tip={n} onClick={() => set('color', 'Anahtar renk')(c, { final: true })} />
        ))}
        <span className="faint" style={{ fontSize: 11, marginLeft: 4 }}>Hazır perdeler</span>
      </div>
      <Row label="Güç" value={ch.strength} min={0} max={1} step={1} scale={100} suffix="%" def={0.4} onChange={set('strength', 'Anahtar gücü')} disabled={!ch.enabled} />
      <Row label="Yumuşaklık" value={ch.smooth} min={0} max={1} step={1} scale={100} suffix="%" def={0.1} onChange={set('smooth', 'Anahtar yumuşaklığı')} disabled={!ch.enabled} />
      <Row label="Taşma" value={ch.spill} min={0} max={1} step={1} scale={100} suffix="%" def={0.5} onChange={set('spill', 'Renk taşması')} disabled={!ch.enabled} hint="Kenarlara yansıyan perde rengini bastırır" />
    </Sec>
  )
}

export function StabilizeSection({ ctx, code }) {
  const { clip, b } = ctx
  const lv = clip.stabilize || 0
  return (
    <Sec id="stab" code={code} title="Sabitleme" sub={lv ? ['', 'hafif', 'orta', 'güçlü'][lv] : null} defaultOpen={false}>
      <Segmented label="Seviye" value={lv} onChange={v => b.setS('stabilize', 'Sabitleme')(v, { final: true })}
        options={[{ value: 0, label: 'Kapalı' }, { value: 1, label: 'Hafif' }, { value: 2, label: 'Orta' }, { value: 3, label: 'Güçlü' }]} />
      <Note>{lv ? 'Titreşim arka planda analiz edilir; işlenen vekil hazır olunca önizlemede görünür. Güçlü seviye kenarları biraz daha kırpar.' : 'El kamerası titremesini yumuşatır.'}</Note>
    </Sec>
  )
}

export default function BasicTab({ ctx }) {
  const t = ctx.clip.type
  const media = t === 'video' || t === 'image'
  return (
    <>
      <TransformSection ctx={ctx} code="01" />
      <LookSection ctx={ctx} code="02" fit={media} />
      {media && <CropSection ctx={ctx} code="03" />}
      {media && <CanvasSection ctx={ctx} code="04" />}
      {media && <ChromaSection ctx={ctx} code="05" />}
      {t === 'video' && <StabilizeSection ctx={ctx} code="06" />}
      {!media && <div className="ipad"><Note>Önizlemede sürükleyerek taşıyabilir, köşe tutamaçlarından ölçekleyip döndürebilirsin.</Note></div>}
    </>
  )
}
