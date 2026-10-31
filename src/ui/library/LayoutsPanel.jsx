// Düzen sekmesi: tek tık düzenler (facecam + oyun, bölünmüş ekran…) — şematik önizleme.
import React, { useMemo } from 'react'
import { REG } from '../../engine/registry.js'
import { useStore } from '../../core/store.js'
import { PanelHead, SearchBox, Chips, useTabState, useRegVersion, useFiltered, catCounts, useFavs, Grid, Card } from './common.jsx'
import { insertLibraryItem } from './insert.js'

const COLORS = { game: 'var(--c-video)', oyun: 'var(--c-video)', video: 'var(--c-video)', cam: 'var(--c-sticker)', facecam: 'var(--c-sticker)', kamera: 'var(--c-sticker)', text: 'var(--c-text)', yazi: 'var(--c-text)', bg: 'var(--bg-3)', chat: 'var(--c-audio)' }

// Düzen tanımından bölgeleri çıkar (0..1 tuval oranı). Paket alanları: preview | regions | boxes | slots
function regionsOf(def) {
  const r = def.regions || def.boxes || def.slots || (Array.isArray(def.preview) ? def.preview : null)
  if (Array.isArray(r) && r.length) return r
  const id = (def.id + ' ' + (def.tags || []).join(' ')).toLowerCase()
  // anahtar kelimeye göre şematik tahmin
  if (/ust|top|facecam-ust|cam-top/.test(id)) return [{ x: 0, y: 0, w: 1, h: 0.36, kind: 'cam' }, { x: 0, y: 0.36, w: 1, h: 0.64, kind: 'game' }]
  if (/alt|bottom/.test(id)) return [{ x: 0, y: 0, w: 1, h: 0.64, kind: 'game' }, { x: 0, y: 0.64, w: 1, h: 0.36, kind: 'cam' }]
  if (/split|bol|yarim|ikiye/.test(id)) return [{ x: 0, y: 0, w: 1, h: 0.5, kind: 'game' }, { x: 0, y: 0.5, w: 1, h: 0.5, kind: 'cam' }]
  if (/pip|kose|corner/.test(id)) return [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }, { x: 0.6, y: 0.04, w: 0.36, h: 0.2, kind: 'cam' }]
  if (/blur|bulanik|dolgu|fill/.test(id)) return [{ x: 0, y: 0, w: 1, h: 1, kind: 'bg' }, { x: 0, y: 0.32, w: 1, h: 0.36, kind: 'game' }]
  return [{ x: 0, y: 0.32, w: 1, h: 0.36, kind: 'game' }]
}

function Schema({ def, ratio }) {
  if (typeof def.preview === 'string' && def.preview.trim().startsWith('<svg')) {
    return <span className="schema" dangerouslySetInnerHTML={{ __html: def.preview }} />
  }
  const [rw, rh] = String(def.ratio || ratio || '9:16').split(':').map(Number)
  const S = 100, k = 82 / Math.max(rw, rh)
  const fw = rw * k, fh = rh * k, fx = (S - fw) / 2, fy = (S - fh) / 2
  const regs = regionsOf(def)
  return (
    <svg className="schema" viewBox="0 0 100 100">
      <rect x={fx} y={fy} width={fw} height={fh} fill="var(--bg-2)" stroke="var(--line-3)" strokeWidth="0.6" />
      {regs.map((r, i) => {
        const kind = String(r.kind || r.type || r.role || 'game').toLowerCase()
        const col = COLORS[kind] || 'var(--c-video)'
        const x = fx + (r.x || 0) * fw, y = fy + (r.y || 0) * fh, w = (r.w ?? 1) * fw, h = (r.h ?? 1) * fh
        const lab = r.label || (kind === 'cam' || kind === 'facecam' || kind === 'kamera' ? 'Kamera' : kind === 'text' || kind === 'yazi' ? 'Yazı' : kind === 'bg' ? '' : 'Oyun')
        return (
          <g key={i}>
            <rect x={x + 0.8} y={y + 0.8} width={Math.max(0, w - 1.6)} height={Math.max(0, h - 1.6)} fill={col} fillOpacity={kind === 'bg' ? 1 : 0.22} stroke={col} strokeWidth="0.8" className="reg" />
            {lab && h > 9 && <text x={x + w / 2} y={y + h / 2 + 2.2} textAnchor="middle" fontSize="6" fontFamily="Mona Sans Variable, sans-serif" fontWeight="650" fill={col} letterSpacing="0.5">{lab}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export default function LayoutsPanel({ code }) {
  useRegVersion()
  const reg = REG.layouts
  const ratio = useStore(s => s.project.settings.ratio)
  const [st, set] = useTabState('layouts', { q: '', cat: null })
  const favs = useFavs()
  const list = useFiltered(reg.list, reg.categories, { q: st.q, cat: st.cat, kind: 'layout' })
  const counts = useMemo(() => catCounts(reg.list), [reg.list.length]) // eslint-disable-line
  const favCount = reg.list.filter(it => favs.has('layout:' + it.id)).length
  return (
    <div className="lib-main">
      <PanelHead code={code} title="Düzen" count={reg.list.length} unit="düzen" />
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder="Düzen ara… (ör. facecam, bölünmüş)" />
        <Chips cats={reg.categories} value={st.cat} onChange={cat => set({ cat })} counts={counts} favCount={favCount} allCount={reg.list.length} />
      </div>
      <div className="lib-body">
        <div className="lib-note"><span>Düzen, <b>seçili kliplere</b> (yoksa oynatma kafasındaki kliplere) uygulanır. Geri almak için <span className="mono">Ctrl+Z</span>.</span></div>
        {!reg.list.length ? (
          <div className="lib-empty"><div className="big">Düzen yok</div><div>Düzen paketi yükleniyor ya da kurulu değil.</div></div>
        ) : !list.length ? (
          <div className="lib-empty"><div className="mono">Eşleşen düzen yok</div></div>
        ) : (
          <Grid items={list} min={84} page={48} resetKey={st.q + st.cat} render={def => (
            <Card key={def.id} kind="layout" id={def.id} name={def.name} className="lay-card" title={def.name + (def.description ? '\n' + def.description : '')}
              onApply={() => insertLibraryItem({ kind: 'layout', id: def.id })}
              thumb={() => <Schema def={def} ratio={ratio} />} />
          )} />
        )}
      </div>
    </div>
  )
}
