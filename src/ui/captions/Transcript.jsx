// Altyazı metin düzenleyicisi: bütün satırlar bir metin belgesi gibi. Tıkla → o ana git; yaz → kelime zamanları korunur;
// Enter → imleçten böl; satır başında Geri sil → öncekiyle birleştir; kenar düğmeleri → zamanlama; bul-değiştir; dışa aktar.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { store, useStore } from '../../core/store.js'
import { playback } from '../../engine/playback.js'
import { openMenu } from '../controls.jsx'
import Icon from '../Icon.jsx'
import { usePlayhead } from '../inspector/hooks.js'
import { setLineText, splitLine, mergeNext, nudgeEdge, groupClipsIn } from '../../features/captions/edit.js'
import { removeCaptions } from '../../features/captions/build.js'
import { exportSubtitleFile } from '../library/captions-run.js'

const fmt = t => {
  const m = Math.floor(t / 60), s = t - m * 60
  return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0')
}

function findClip(project, id) {
  for (const t of project.tracks) for (const c of t.clips) if (c.id === id) return c
  return null
}

// listenin kaydırma konumu gruba göre hatırlanır (Stil'e ya da başka sekmeye geçip dönünce kalınan yer)
const scrollMem = new Map()

export default function Transcript({ group }) {
  const t = usePlayhead(20)
  const fps = useStore(s => s.project.settings.fps) || 30
  const selId = useStore(s => s.selection.clips[s.selection.clips.length - 1])
  const [editing, setEditing] = useState(null) // { id, caret }
  const [find, setFind] = useState(null) // { q, r }
  const listRef = useRef(null)
  const lastActive = useRef(null)
  const lines = group.clips
  const cur = lines.findIndex(c => t >= c.start && t < c.start + c.duration)
  const gid = group.groupId
  useLayoutEffect(() => {
    const L = listRef.current
    if (!L) return
    if (scrollMem.has(gid)) L.scrollTop = scrollMem.get(gid)
    else if (cur >= 0) { const el = L.querySelector(`[data-id="${lines[cur].id}"]`); if (el) L.scrollTop = Math.max(0, el.getBoundingClientRect().top - L.getBoundingClientRect().top - L.clientHeight / 3) }
    const save = () => scrollMem.set(gid, L.scrollTop)
    L.addEventListener('scroll', save, { passive: true })
    return () => L.removeEventListener('scroll', save)
  }, [gid]) // eslint-disable-line
  // Oynatırken etkin satırı takip et; ama yalnız kullanıcı oynayan satırı görürken. Aşağı kaydırıp başka bir satırla
  // uğraşıyorsa (siliyor, düzeltiyor) liste onu oynayan satıra geri çekmez.
  useEffect(() => {
    const L = listRef.current
    if (cur < 0 || !L) return
    const id = lines[cur].id
    const prev = lastActive.current
    lastActive.current = id
    if (editing || !playback.playing) return
    const box = L.getBoundingClientRect()
    const seen = lid => {
      const el = lid && L.querySelector(`[data-id="${lid}"]`)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.bottom > box.top && r.top < box.bottom
    }
    if (!seen(prev) && !seen(id)) return
    const r = L.querySelector(`[data-id="${id}"]`).getBoundingClientRect()
    const pad = 24
    const dy = r.top < box.top + pad ? r.top - box.top - pad : r.bottom > box.bottom - pad ? r.bottom - box.bottom + pad : 0
    if (dy) L.scrollBy({ top: dy, behavior: 'smooth' })
  }, [cur, editing]) // eslint-disable-line

  const edit = (label, fn, opts) => store.edit(label, fn, opts)
  const hits = useMemo(() => {
    if (!find || !find.q) return 0
    const q = find.q.toLocaleLowerCase('tr-TR')
    return lines.reduce((a, c) => a + (c.text.content.toLocaleLowerCase('tr-TR').split(q).length - 1), 0)
  }, [find, lines])
  const replaceAll = () => {
    if (!find || !find.q) return
    const re = new RegExp(find.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let n = 0
    edit('Bul ve değiştir', d => {
      for (const { c } of groupClipsIn(d, gid)) {
        const txt = c.caption.words.map(w => w.w).join(' ')
        if (!re.test(txt)) continue
        re.lastIndex = 0
        setLineText(c, txt.replace(re, find.r || ''))
        n++
      }
    })
    store.toast(n + ' satır değişti', 'ok', 1400)
  }

  return (
    <div className="tx-wrap">
      <div className="tx-bar">
        <span className="tx-count"><b>{lines.length}</b> satır · {fmt(group.start)}–{fmt(group.end)}</span>
        <span className="grow" />
        <button className={'ibtn sm' + (find ? ' on' : '')} data-tip="Bul ve değiştir" onClick={() => setFind(find ? null : { q: '', r: '' })}><Icon name="search" size={14} /></button>
        <button className="ibtn sm" data-tip="Bütün altyazıları kaydır (senkron)" onClick={e => openMenu(e, [
          { header: 'Senkron' },
          ...[-0.5, -0.1, -1 / fps, 1 / fps, 0.1, 0.5].map(dt => ({ label: (dt > 0 ? '+' : '−') + (Math.abs(dt) < 0.05 ? '1 kare' : Math.abs(dt).toFixed(1) + ' sn'), icon: dt > 0 ? 'chevR' : 'chevL', onClick: () => edit('Altyazıları kaydır', d => { const items = groupClipsIn(d, gid); const arr = dt > 0 ? items.slice().reverse() : items; for (const { c } of arr) c.start = Math.max(0, Math.round((c.start + dt) * 1000) / 1000) }) })),
        ])}><Icon name="loop" size={14} /></button>
        <button className="ibtn sm" data-tip="Dışa aktar" onClick={e => openMenu(e, [
          { header: 'Altyazı dosyası' },
          { label: 'SRT (YouTube, çoğu oynatıcı)', icon: 'export', onClick: () => exportSubtitleFile('srt') },
          { label: 'VTT (web)', icon: 'export', onClick: () => exportSubtitleFile('vtt') },
          { label: 'ASS (stil ve karaoke)', icon: 'export', onClick: () => exportSubtitleFile('ass') },
          { label: 'Düz metin', icon: 'file', onClick: () => exportSubtitleFile('txt') },
        ])}><Icon name="export" size={14} /></button>
        <button className="ibtn sm danger" data-tip="Bu altyazıları sil" onClick={() => {
          edit('Altyazıları sil', d => removeCaptions(d, gid))
          store.toast('Altyazılar silindi · Ctrl+Z geri getirir', 'info', 2600)
        }}><Icon name="trash" size={14} /></button>
      </div>
      {find && (
        <div className="tx-find">
          <label className="search"><Icon name="search" size={13} /><input autoFocus placeholder="Bul" value={find.q} onChange={e => setFind({ ...find, q: e.target.value })} onKeyDown={e => e.stopPropagation()} /></label>
          <label className="search"><Icon name="text" size={13} /><input placeholder="Şununla değiştir" value={find.r} onChange={e => setFind({ ...find, r: e.target.value })} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') replaceAll() }} /></label>
          <button className="btn sm" disabled={!hits} onClick={replaceAll}>Tümü ({hits})</button>
        </div>
      )}
      <div className="tx-list" ref={listRef}>
        {lines.map((c, i) => (
          <Line key={c.id} c={c} i={i} t={t} fps={fps} on={i === cur} sel={c.id === selId} find={find && find.q}
            editing={editing && editing.id === c.id ? editing : null} setEditing={setEditing}
            prevId={i > 0 ? lines[i - 1].id : null} nextId={i < lines.length - 1 ? lines[i + 1].id : null} />
        ))}
      </div>
      <div className="tx-help"><kbd>Enter</kbd> böl · <kbd>⌫</kbd> satır başında birleştir · kelimeye tıkla: o ana git</div>
    </div>
  )
}

function Line({ c, i, t, fps, on, sel, editing, setEditing, prevId, nextId, find }) {
  const ref = useRef(null)
  // txt null: düzenleme henüz başlamadı → kutu satırın güncel metnini gösterir (bölme/birleştirmeden gelen satır da)
  const [txt, setTxt] = useState(null)
  const lt = t - c.start
  const words = c.caption.words
  const joined = words.map(w => w.w).join(' ')
  useEffect(() => { if (!editing) setTxt(null) }, [editing])
  useLayoutEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.focus()
    const pos = editing.caret == null ? el.value.length : editing.caret
    el.setSelectionRange(pos, pos)
    el.style.height = '0px'; el.style.height = el.scrollHeight + 'px'
  }, [editing])
  const open = (caret) => { setTxt(null); setEditing({ id: c.id, caret }) }
  const commit = (value) => {
    const v = (value ?? txt ?? joined).replace(/\s+/g, ' ').trim()
    if (v !== joined) store.edit('Altyazı metni', d => { const f = findClipDraft(d, c.id); if (f) setLineText(f, v) })
  }
  const seek = (time) => { playback.pause(); playback.seek(time + 0.001); store.select([c.id]) }
  const key = (e) => {
    e.stopPropagation()
    const el = e.target
    if (e.key === 'Escape') { setEditing(null); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const caret = el.selectionStart
      const before = el.value.slice(0, caret).trim()
      const k = before ? before.split(/\s+/).length : 0
      commit(el.value)
      let nid = null
      store.edit('Altyazıyı böl', d => { nid = splitLine(d, c.id, k) })
      setEditing(nid ? { id: nid, caret: 0 } : null)
      return
    }
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && prevId) {
      e.preventDefault()
      commit(el.value)
      const prevLen = findClip(store.get().project, prevId).caption.words.map(w => w.w).join(' ').length
      store.edit('Altyazıları birleştir', d => mergeNext(d, prevId))
      setEditing({ id: prevId, caret: prevLen + 1 })
      return
    }
    if (e.key === 'Delete' && el.selectionStart === el.value.length && nextId) {
      e.preventDefault()
      commit(el.value)
      const len = el.value.trim().length
      store.edit('Altyazıları birleştir', d => mergeNext(d, c.id))
      setEditing({ id: c.id, caret: len })
    }
  }
  const step = (ev) => (ev.shiftKey ? 0.1 : 1 / fps)
  const q = find ? find.toLocaleLowerCase('tr-TR') : null
  return (
    <div className={'tx-line' + (on ? ' on' : '') + (sel ? ' sel' : '') + (editing ? ' ed' : '')} data-i={i} data-id={c.id}>
      <button className="tx-tc mono" onClick={() => seek(c.start)} data-tip={'Bu satıra git · ' + c.duration.toFixed(2) + ' sn'}>{fmt(c.start)}</button>
      {editing ? (
        <textarea ref={ref} className="tx-in" value={txt ?? joined} spellCheck={false}
          onChange={e => { setTxt(e.target.value); e.target.style.height = '0px'; e.target.style.height = e.target.scrollHeight + 'px' }}
          onBlur={() => { commit(); setEditing(null) }} onKeyDown={key} />
      ) : (
        <div className="tx-words" onClick={e => { if (e.target === e.currentTarget) open(null) }} onDoubleClick={() => open(null)}>
          {words.map((w, k) => {
            const st = on && lt >= w.s && lt < w.e ? ' now' : on && lt >= w.e ? ' past' : ''
            const hit = q && w.w.toLocaleLowerCase('tr-TR').includes(q) ? ' hit' : ''
            return <span key={k} className={'tw' + st + hit + (w.emphasis ? ' em' : '')} onClick={() => seek(c.start + w.s)}>{w.w}</span>
          })}
          <button className="tx-edit" onClick={e => { e.stopPropagation(); open(null) }} data-tip="Metni düzenle"><Icon name="type" size={12} /></button>
        </div>
      )}
      <div className="tx-acts">
        <span className="tx-nudge" data-tip="Başlangıç (Shift: 0,1 sn)">
          <button onClick={e => store.edit('Altyazı zamanı', d => nudgeEdge(d, c.id, 'start', -step(e)), { coalesce: 'nud:' + c.id })}><Icon name="chevL" size={10} /></button>
          <b>baş</b>
          <button onClick={e => store.edit('Altyazı zamanı', d => nudgeEdge(d, c.id, 'start', step(e)), { coalesce: 'nud:' + c.id })}><Icon name="chevR" size={10} /></button>
        </span>
        <span className="tx-nudge" data-tip="Bitiş (Shift: 0,1 sn)">
          <button onClick={e => store.edit('Altyazı zamanı', d => nudgeEdge(d, c.id, 'end', -step(e)), { coalesce: 'nud:' + c.id })}><Icon name="chevL" size={10} /></button>
          <b>son</b>
          <button onClick={e => store.edit('Altyazı zamanı', d => nudgeEdge(d, c.id, 'end', step(e)), { coalesce: 'nud:' + c.id })}><Icon name="chevR" size={10} /></button>
        </span>
        <button className="ibtn sm" data-tip="Aşağıdakiyle birleştir" disabled={!nextId} onClick={() => store.edit('Altyazıları birleştir', d => mergeNext(d, c.id))}><Icon name="link" size={13} /></button>
        <button className="ibtn sm danger" data-tip="Satırı sil" onClick={() => store.edit('Altyazı satırını sil', d => { for (const tr of d.tracks) tr.clips = tr.clips.filter(x => x.id !== c.id) })}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  )
}

function findClipDraft(d, id) {
  for (const t of d.tracks) for (const c of t.clips) if (c.id === id) return c
  return null
}
