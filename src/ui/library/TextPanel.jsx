// Yazı sekmesi: varsayılan yazı + hazır yazı şablonları (canlı animasyonlu önizleme).
import React, { useMemo } from 'react'
import Icon from '../Icon.jsx'
import { REG } from '../../engine/registry.js'
import { PanelHead, SearchBox, Chips, useTabState, useRegVersion, useFiltered, catCounts, useFavs, Grid, Card, GLThumb, dragStart, dragEnd, useRecent, RecentRow } from './common.jsx'
import { insertLibraryItem, now } from './insert.js'

export default function TextPanel({ code }) {
  useRegVersion()
  const reg = REG.textTemplates
  const [st, set] = useTabState('text', { q: '', cat: null })
  const favs = useFavs()
  const list = useFiltered(reg.list, reg.categories, { q: st.q, cat: st.cat, kind: 'text' })
  const counts = useMemo(() => catCounts(reg.list), [reg.list.length]) // eslint-disable-line
  const favCount = reg.list.filter(it => favs.has('text:' + it.id)).length
  const recent = useRecent('text').filter(id => id === '__default' || reg.byId.has(id))
  const ins = id => insertLibraryItem({ kind: 'text', id }, { time: now() })
  const card = (tpl, small) => (
    <Card key={(small ? 'r' : '') + tpl.id} kind="text" id={tpl.id} name={tpl.name} className="text-card" onApply={() => ins(tpl.id)}
      title={tpl.name + ' — tıkla: oynatma kafasına ekle'}
      thumb={hover => <GLThumb kind="text" id={tpl.id} hover={hover} />}
      badge={tpl.isNew ? <span className="lib-new">YENİ</span> : null} noFav={small} />
  )
  return (
    <div className="lib-main">
      <PanelHead code={code} title="Yazı" count={reg.list.length} unit="şablon" />
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder="Yazı şablonu ara… (ör. neon, oyun)" />
        <Chips cats={reg.categories} value={st.cat} onChange={cat => set({ cat })} counts={counts} favCount={favCount} allCount={reg.list.length} />
      </div>
      <div className="lib-body">
        <div className="text-default" draggable
          onDragStart={e => dragStart(e, 'text', '__default', 'Varsayılan yazı')} onDragEnd={dragEnd}
          onClick={() => ins('__default')} title="Oynatma kafasına düz yazı ekle (T)">
          <span className="tt">Aa</span>
          <span className="td"><b>Varsayılan yazı</b><span>Düz metin · kısayol T</span></span>
          <span className="plus"><Icon name="plus" size={16} sw={2.2} /></span>
        </div>
        {!st.q && !st.cat && <RecentRow kind="text" ids={recent.filter(id => id !== '__default').slice(0, 8)} render={id => card(reg.byId.get(id), true)} />}
        {!reg.list.length ? (
          <div className="lib-empty"><div className="big">Şablon yok</div><div>Yazı paketi yükleniyor ya da kurulu değil.</div></div>
        ) : !list.length ? (
          <div className="lib-empty"><div className="mono">Eşleşen şablon yok</div></div>
        ) : (
          <Grid items={list} min={84} page={48} resetKey={st.q + st.cat} render={tpl => card(tpl)} />
        )}
      </div>
    </div>
  )
}
