// EFEKTLER: klip efekt yığını (aç/kapa, sırala, kaldır, parametreler) + efekt seçici; efekt katmanı paneli
import React, { useMemo, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import { uid } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import Icon from '../Icon.jsx'
import { Sec, Row, ParamControls, Empty, Note, useOutside } from './common.jsx'
import { useReg, useRegCats, countKeys, clearKeysFor } from './hooks.js'

// taslak klipten önekli anahtar kareleri sil (efekt kaldırılınca / değişince yetim kalmasın)
function dropKeys(c, px) {
  if (!c.keyframes) return
  for (const k of Object.keys(c.keyframes)) if (k.startsWith(px)) delete c.keyframes[k]
}

function defaultsOf(def) {
  const o = {}
  for (const p of (def && def.params) || []) o[p.key] = p.default
  return o
}

// Satır içi efekt seçici: arama + kategori + liste
export function EffectPicker({ onPick, onClose, current, kind = 'effects', libTab = 'effects', icon = 'fx', noun = 'Efekt' }) {
  const list = useReg(kind)
  const cats = useRegCats(kind)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const ref = useRef(null)
  useOutside(ref, true, onClose)
  const ql = q.trim().toLocaleLowerCase('tr-TR')
  const shown = useMemo(() => list.filter(x => (!cat || x.category === cat) &&
    (!ql || (x.name || '').toLocaleLowerCase('tr-TR').includes(ql) || (x.tags || []).some(t => String(t).toLocaleLowerCase('tr-TR').includes(ql)))), [list, cat, ql])
  const groups = useMemo(() => {
    const m = new Map()
    for (const x of shown) { if (!m.has(x.category)) m.set(x.category, []); m.get(x.category).push(x) }
    return [...m.entries()]
  }, [shown])
  return (
    <div className="picker" ref={ref}>
      <div className="search"><Icon name="search" size={13} /><input autoFocus placeholder={noun + ' ara (' + list.length + ')'} value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && shown[0]) onPick(shown[0]); if (e.key === 'Escape') onClose() }} /></div>
      {cats.length > 1 && (
        <div className="chips sq">
          <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>Tümü</button>
          {cats.map(c => <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{c.name}</button>)}
        </div>
      )}
      <div className="plist">
        {groups.map(([cid, items]) => (
          <div key={cid || '_'}>
            <div className="ph">{(cats.find(c => c.id === cid) || {}).name || cid || 'Diğer'}</div>
            {items.map(x => (
              <button key={x.id} className={'pi' + (x.id === current ? ' on' : '')} onClick={() => onPick(x)}>
                <Icon name={icon} size={12} /><span className="grow">{x.name}</span>{x.isNew && <span className="new">YENİ</span>}
              </button>
            ))}
          </div>
        ))}
        {!shown.length && <div className="faint" style={{ padding: 10 }}>{list.length ? 'Sonuç yok' : noun + ' paketi yüklenmedi'}</div>}
      </div>
      <div className="pfoot">
        <button className="btn sm ghost" onClick={() => { store.setUI({ leftTab: libTab }); onClose() }}>Kütüphanede aç <Icon name="chevR" size={11} /></button>
      </div>
    </div>
  )
}

function EffectItem({ fx, i, n, ctx, open, setOpen }) {
  const { clip, b } = ctx
  const def = regGet('effects', fx.id)
  const hasInt = def && (def.params || []).some(p => p.key === 'intensity')
  const nk = fx.uid ? countKeys(clip, ['fx:' + fx.uid + ':']) : 0
  const upd = (fn, label, key) => b.edit(c => { const e = (c.effects || []).find(x => x.uid === fx.uid); if (e) fn(e, c) }, label, key)
  const move = (d) => b.edit(c => {
    const a = c.effects, j = a.findIndex(x => x.uid === fx.uid), k = j + d
    if (j < 0 || k < 0 || k >= a.length) return
    const t = a[j]; a[j] = a[k]; a[k] = t
  }, 'Efekt sırası')
  return (
    <div className={'fxitem' + (open ? ' open' : '') + (fx.enabled === false ? ' off' : '')}>
      <div className="fxh" onClick={() => setOpen(open ? null : fx.uid)}>
        <span className="fxn mono">{String(i + 1).padStart(2, '0')}</span>
        <span className={'toggle' + (fx.enabled !== false ? ' on' : '')} data-tip={fx.enabled !== false ? 'Kapat' : 'Aç'}
          onClick={e => { e.stopPropagation(); upd(x => { x.enabled = x.enabled === false }, 'Efekt aç/kapa') }} />
        <span className="grow fxname">{def ? def.name : fx.id}{!def && <i className="faint"> · kayıtlı değil</i>}</span>
        {nk > 0 && <span className="fxk mono" data-tip="Anahtar kare"><i className="dia on" />{nk}</span>}
        <button className="ibtn sm" disabled={i === 0} data-tip="Yukarı" onClick={e => { e.stopPropagation(); move(-1) }}><Icon name="chevU" size={12} /></button>
        <button className="ibtn sm" disabled={i === n - 1} data-tip="Aşağı" onClick={e => { e.stopPropagation(); move(1) }}><Icon name="chevD" size={12} /></button>
        <button className="ibtn sm" data-tip="Kaldır" onClick={e => { e.stopPropagation(); b.edit(c => { c.effects = c.effects.filter(x => x.uid !== fx.uid); if (fx.uid) dropKeys(c, 'fx:' + fx.uid + ':') }, 'Efekti kaldır') }}><Icon name="x" size={12} /></button>
      </div>
      {open && def && (
        <div className="fxb">
          {!hasInt && (
            <Row label="Yoğunluk" value={fx.params && fx.params.intensity != null ? fx.params.intensity : 1} min={0} max={1} step={1} scale={100} suffix="%" def={1}
              onChange={(v, o) => { upd(x => { x.params = { ...(x.params || {}), intensity: v } }, 'Efekt yoğunluğu', 'fxi:' + fx.uid); if (o && o.final) store.endCoalesce() }} />
          )}
          <ParamControls schema={def.params} values={fx.params}
            anim={fx.uid ? (k, p) => { const path = 'fx:' + fx.uid + ':' + k; return { value: b.fxv(path), kf: b.kf(path), onChange: b.set(path, (p.label || k)) } } : null}
            onChange={(k, v, o) => { upd(x => { x.params = { ...(x.params || {}), [k]: v } }, 'Efekt ayarı', 'fx:' + fx.uid + k); if (o && o.final) store.endCoalesce() }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {nk > 0 && <button className="btn sm ghost" onClick={() => clearKeysFor(clip.id, ['fx:' + fx.uid + ':'])}><i className="dia on" />{nk} kareyi temizle</button>}
            <span className="grow" />
            <button className="btn sm ghost" onClick={() => upd((x, c) => { x.params = defaultsOf(def); dropKeys(c, 'fx:' + fx.uid + ':') }, 'Efekti sıfırla')}><Icon name="undo" size={12} />Varsayılan</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EffectsTab({ ctx }) {
  const { clip, b } = ctx
  const fxs = clip.effects || []
  const [open, setOpen] = useState(fxs.length === 1 ? fxs[0].uid : null)
  const [pick, setPick] = useState(false)
  const add = (def) => {
    const u = uid('e')
    b.edit(c => { c.effects = [...(c.effects || []), { uid: u, id: def.id, params: defaultsOf(def), enabled: true }] }, 'Efekt ekle')
    setOpen(u)
    setPick(false)
  }
  return (
    <>
      <Sec id="fxlist" code="01" title="Efekt yığını" sub={fxs.length ? fxs.length + ' efekt' : null} keys={{ clip, paths: ['fx:'] }}
        right={fxs.length > 1 ? <button className="ibtn sm" data-tip="Hepsini kaldır" onClick={e => { e.stopPropagation(); b.edit(c => { c.effects = []; dropKeys(c, 'fx:') }, 'Efektleri kaldır') }}><Icon name="trash" size={12} /></button> : null}>
        {fxs.length ? (
          <div className="fxlist">
            {fxs.map((fx, i) => <EffectItem key={fx.uid || i} fx={fx} i={i} n={fxs.length} ctx={ctx} open={open === fx.uid} setOpen={setOpen} />)}
          </div>
        ) : (
          <Empty title="Efekt yok" text="Efektler yukarıdan aşağı sırayla uygulanır." />
        )}
        <div style={{ position: 'relative' }}>
          <button className={'btn addfx' + (pick ? ' on' : '')} onClick={() => setPick(!pick)}><Icon name="plus" size={13} />Efekt ekle</button>
          {pick && <EffectPicker onPick={add} onClose={() => setPick(false)} />}
        </div>
        {fxs.length > 1 && <Note>Sıra önemlidir: üstteki efekt önce uygulanır.</Note>}
      </Sec>
    </>
  )
}

// ---------------------------------------------------------------- efekt katmanı (ayrı şerit)
export function EffectLayerTab({ ctx }) {
  const { clip, b } = ctx
  const e = clip.effect || {}
  const def = e.id ? regGet('effects', e.id) : null
  const [pick, setPick] = useState(false)
  const hasInt = def && (def.params || []).some(p => p.key === 'intensity')
  return (
    <>
      <Sec id="efl" code="01" title="Efekt" sub={def ? def.name : null}>
        <div className="curfilter">
          <i className="fsw" style={{ background: 'var(--c-effect)' }}><Icon name="fx" size={14} style={{ color: '#000' }} /></i>
          <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="fname">{def ? def.name : (e.id || 'Efekt seçilmedi')}</span>
            <span className="faint mono" style={{ fontSize: 9.5 }}>altındaki her katmana uygulanır</span>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn sm" onClick={() => setPick(!pick)}>Değiştir</button>
            {pick && <div className="picker-anchor"><EffectPicker current={e.id} onClose={() => setPick(false)} onPick={(d) => {
              b.edit(c => { c.effect = { id: d.id, params: defaultsOf(d) }; c.name = d.name; dropKeys(c, 'fx:layer:') }, 'Efekti değiştir'); setPick(false)
            }} /></div>}
          </div>
        </div>
      </Sec>
      {def && (
        <Sec id="eflp" code="02" title="Parametreler" keys={{ clip, paths: ['fx:layer:'] }}
          onReset={() => b.edit(c => { c.effect.params = defaultsOf(def); dropKeys(c, 'fx:layer:') }, 'Efekti sıfırla')}>
          {!hasInt && (
            <Row label="Yoğunluk" value={e.params && e.params.intensity != null ? e.params.intensity : 1} min={0} max={1} step={1} scale={100} suffix="%" def={1}
              onChange={(v, o) => { b.edit(c => { c.effect.params = { ...(c.effect.params || {}), intensity: v } }, 'Efekt yoğunluğu', 'efli:' + clip.id); if (o && o.final) store.endCoalesce() }} />
          )}
          <ParamControls schema={def.params} values={e.params}
            anim={(k, p) => { const path = 'fx:layer:' + k; return { value: b.fxv(path), kf: b.kf(path), onChange: b.set(path, (p.label || k)) } }}
            onChange={(k, v, o) => { b.edit(c => { c.effect.params = { ...(c.effect.params || {}), [k]: v } }, 'Efekt ayarı', 'efl:' + clip.id + k); if (o && o.final) store.endCoalesce() }} />
        </Sec>
      )}
    </>
  )
}
