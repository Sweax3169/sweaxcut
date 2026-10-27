// Efekt / Filtre / Geçiş sekmeleri — önizlemeler paylaşılan tek WebGL bileşimciyle (preview-engine) çizilir.
import React, { useEffect, useMemo, useState } from 'react'
import { REG } from '../../engine/registry.js'
import { useStore } from '../../core/store.js'
import { openMenu } from '../controls.jsx'
import {
  PanelHead, SearchBox, Chips, useTabState, useRegVersion, useFiltered, catCounts, useFavs, toggleFav,
  Grid, Card, GLThumb, useRecent, RecentRow, lsGet, lsSet,
} from './common.jsx'
import { insertLibraryItem, now } from './insert.js'
import { getSampleMode, setSampleMode, onSampleMode } from './preview-engine.js'

function useSampleMode() {
  const [m, setM] = useState(getSampleMode())
  useEffect(() => onSampleMode(setM), [])
  return m
}

function SampleSwitch() {
  const mode = useSampleMode()
  const hasClips = useStore(s => s.project.tracks.some(t => t.kind !== 'audio' && t.clips.length))
  return (
    <div className="seg" title="Önizleme görüntüsü">
      <button className={mode === 'sample' ? 'on' : ''} onClick={() => setSampleMode('sample')}>ÖRNEK</button>
      <button className={mode === 'frame' ? 'on' : ''} onClick={() => setSampleMode('frame')} disabled={!hasClips} style={{ opacity: hasClips ? 1 : 0.4 }} title="Önizlemedeki o anki kareyi kullan">KARE</button>
    </div>
  )
}

// Ortak ızgara gövdesi
function FxBody({ kind, regKey, code, title, unit, cls, placeholder, apply, menuExtra, opt, badgeOf }) {
  useRegVersion()
  const reg = REG[regKey]
  const [st, set] = useTabState(kind, { q: '', cat: null })
  const favs = useFavs()
  const list = useFiltered(reg.list, reg.categories, { q: st.q, cat: st.cat, kind })
  const counts = useMemo(() => catCounts(reg.list), [reg.list.length]) // eslint-disable-line
  const favCount = reg.list.filter(it => favs.has(kind + ':' + it.id)).length
  const recent = useRecent(kind).filter(id => reg.byId.has(id))
  const card = (def, small) => (
    <Card key={(small ? 'r' : '') + def.id} kind={kind} id={def.id} name={def.name} className={cls} onApply={() => apply(def)} noFav={small}
      title={def.name}
      onContext={e => openMenu(e, [
        { header: def.name },
        { label: 'Uygula', icon: 'plus', onClick: () => apply(def) },
        ...(menuExtra ? menuExtra(def) : []),
        '-',
        { label: favs.has(kind + ':' + def.id) ? 'Favorilerden çıkar' : 'Favorilere ekle', icon: 'star', onClick: () => toggleFav(kind, def.id) },
      ])}
      thumb={hover => <GLThumb kind={kind} id={def.id} hover={hover} />}
      badge={<>{def.isNew && <span className="lib-new">YENİ</span>}{badgeOf && badgeOf(def)}</>} />
  )
  return (
    <div className="lib-main">
      <PanelHead code={code} title={title} count={reg.list.length} unit={unit} />
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder={placeholder} />
        <Chips cats={reg.categories} value={st.cat} onChange={cat => set({ cat })} counts={counts} favCount={favCount} allCount={reg.list.length} />
      </div>
      <div className="lib-opt">
        {opt}
        <span className="grow" />
        <SampleSwitch />
      </div>
      <div className="lib-body">
        {!st.q && !st.cat && <RecentRow kind={kind} ids={recent.slice(0, 8)} render={id => card(reg.byId.get(id), true)} />}
        {!reg.list.length ? (
          <div className="lib-empty"><div className="big">Boş makara</div><div>{title} paketi yükleniyor ya da kurulu değil.</div></div>
        ) : !list.length ? (
          <div className="lib-empty"><div className="mono">EŞLEŞEN ÖĞE YOK</div></div>
        ) : (
          <Grid items={list} min={84} page={42} resetKey={st.q + st.cat} render={def => card(def)} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- efektler
export function EffectsPanel({ code }) {
  const [toClip, setToClip] = useState(() => lsGet('fxToClip', false))
  const selCount = useStore(s => s.selection.clips.length)
  const flip = () => { const v = !toClip; setToClip(v); lsSet('fxToClip', v) }
  return (
    <FxBody kind="effect" regKey="effects" code={code} title="Efekt" unit="efekt" cls="fx-card"
      placeholder="Efekt ara… (ör. sarsıntı, glitch, parıltı)"
      apply={def => insertLibraryItem({ kind: 'effect', id: def.id }, { time: now(), toClip })}
      menuExtra={def => [
        { label: 'Efekt katmanı olarak ekle', icon: 'layers', onClick: () => insertLibraryItem({ kind: 'effect', id: def.id }, { time: now(), toClip: false }) },
        { label: 'Seçili klibe uygula', icon: 'fx', disabled: !selCount, onClick: () => insertLibraryItem({ kind: 'effect', id: def.id }, { time: now(), toClip: true }) },
      ]}
      opt={<label className="row" style={{ gap: 7, cursor: 'pointer' }} onClick={flip} title="Kapalıyken efekt, oynatma kafasında ayrı bir efekt katmanı olarak eklenir">
        <span className={'toggle' + (toClip ? ' on' : '')} />
        <span>Seçili klibe uygula</span>
        {toClip && <span className="mono faint" style={{ fontSize: 9.5 }}>{selCount ? selCount + ' SEÇİLİ' : 'SEÇİM YOK'}</span>}
      </label>} />
  )
}

// ---------------------------------------------------------------- filtreler
export function FiltersPanel({ code }) {
  const sel = useStore(s => s.selection.clips.length)
  return (
    <FxBody kind="filter" regKey="filters" code={code} title="Filtre" unit="filtre" cls="flt-card"
      placeholder="Filtre ara… (ör. sinema, sıcak, siyah beyaz)"
      apply={def => insertLibraryItem({ kind: 'filter', id: def.id }, { time: now() })}
      menuExtra={def => [
        { label: 'Filtre katmanı olarak ekle', icon: 'layers', onClick: () => insertLibraryItem({ kind: 'filter', id: def.id }, { time: now(), toClip: false }) },
      ]}
      badgeOf={def => def.swatch && def.swatch.length ? <span className="lib-swatch">{def.swatch.slice(0, 5).map((c, i) => <i key={i} style={{ background: c }} />)}</span> : null}
      opt={<span className="mono faint" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>{sel ? 'HEDEF: SEÇİLİ KLİP' : 'HEDEF: FİLTRE KATMANI'}</span>} />
  )
}

// ---------------------------------------------------------------- geçişler
export function TransitionsPanel({ code }) {
  const sel = useStore(s => s.selection.clips.length)
  return (
    <FxBody kind="transition" regKey="transitions" code={code} title="Geçiş" unit="geçiş" cls="tr-card"
      placeholder="Geçiş ara… (ör. kaydır, yakınlaş, parlama)"
      apply={def => insertLibraryItem({ kind: 'transition', id: def.id })}
      menuExtra={def => [
        { label: 'Bütün kesimlere uygula', icon: 'transition', onClick: () => insertLibraryItem({ kind: 'transition', id: def.id }, { all: true }) },
      ]}
      badgeOf={def => def.duration ? <span className="lib-badge mono">{def.duration.toFixed(1)}s</span> : null}
      opt={<span className="mono faint" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>{sel ? 'HEDEF: SEÇİLİ KLİBİN SONU' : 'HEDEF: EN YAKIN KESİM'} · SAĞ TIK: TÜMÜ</span>} />
  )
}
