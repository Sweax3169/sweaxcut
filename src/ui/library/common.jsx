// Kütüphane ortak parçaları: arama, kategori yongaları, artımlı ızgara, kart, sürükle-bırak, favori / son kullanılan.
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Icon from '../Icon.jsx'
import { onRegistry, registryVersion } from '../../engine/registry.js'
import { requestThumb, getThumb, startLive } from './preview-engine.js'

// ---------------------------------------------------------------- kalıcı tercihler (localStorage)
export function lsGet(key, def) {
  try { const v = localStorage.getItem('sweax.lib.' + key); return v == null ? def : JSON.parse(v) } catch (e) { return def }
}
export function lsSet(key, v) {
  try { localStorage.setItem('sweax.lib.' + key, JSON.stringify(v)) } catch (e) { /* */ }
}

// Basit gözlenebilir değer
function observable(init) {
  let v = init
  const subs = new Set()
  return {
    get: () => v,
    set: (nv) => { v = nv; for (const f of subs) f(v) },
    sub: (f) => { subs.add(f); return () => subs.delete(f) },
  }
}
function useObs(o) {
  const [, set] = useState(0)
  useEffect(() => o.sub(() => set(x => x + 1)), [o])
  return o.get()
}

// ---------------------------------------------------------------- favoriler
const favObs = observable(new Set(lsGet('favs', [])))
export function isFav(kind, id) { return favObs.get().has(kind + ':' + id) }
export function toggleFav(kind, id) {
  const s = new Set(favObs.get())
  const k = kind + ':' + id
  s.has(k) ? s.delete(k) : s.add(k)
  lsSet('favs', [...s])
  favObs.set(s)
}
export function useFavs() { return useObs(favObs) }

// ---------------------------------------------------------------- son kullanılanlar
const recentObs = observable(lsGet('recent', {}))
export function pushRecent(kind, id) {
  const r = { ...recentObs.get() }
  r[kind] = [id, ...(r[kind] || []).filter(x => x !== id)].slice(0, 12)
  lsSet('recent', r)
  recentObs.set(r)
}
export function useRecent(kind) { return (useObs(recentObs)[kind]) || [] }

// ---------------------------------------------------------------- kayıt defteri sürümü (paketler yüklendikçe yenile)
export function useRegVersion() {
  const [v, setV] = useState(registryVersion())
  useEffect(() => {
    let tm = 0
    const off = onRegistry(() => { clearTimeout(tm); tm = setTimeout(() => setV(registryVersion()), 120) })
    return () => { off(); clearTimeout(tm) }
  }, [])
  return v
}

// ---------------------------------------------------------------- Türkçe duyarsız arama
const TR = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }
export function norm(s) {
  return String(s || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, ch => TR[ch] || ch)
}
export function matches(item, q, catName) {
  if (!q) return true
  const hay = norm([item.name, item.id, catName, ...(item.tags || [])].join(' '))
  return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w))
}

// list → filtrelenmiş liste. cat: kategori id | '__fav' | null
export function useFiltered(list, categories, { q, cat, kind }) {
  const favs = useFavs()
  const ver = useRegVersion() // kayıt dizileri yerinde büyür: sürüm değişince yeniden süz
  return useMemo(() => {
    const cn = new Map((categories || []).map(c => [c.id, c.name]))
    return list.filter(it => {
      if (cat === '__fav') { if (!favs.has(kind + ':' + it.id)) return false }
      else if (cat && it.category !== cat) return false
      return matches(it, q, cn.get(it.category))
    })
  }, [list, categories, q, cat, kind, favs, ver, list.length])
}

// ---------------------------------------------------------------- başlık
export function PanelHead({ code, title, count, unit = 'öğe', right }) {
  return (
    <div className="lib-head">
      <div className="lib-title">
        <span className="lib-code mono">{code}</span>
        <h3>{title}</h3>
      </div>
      {count != null && <span className="lib-count mono"><b>{String(count).padStart(3, '0')}</b> {unit}</span>}
      {right}
    </div>
  )
}

// ---------------------------------------------------------------- arama kutusu
export function SearchBox({ value, onChange, placeholder = 'Ara…' }) {
  return (
    <label className="search lib-search">
      <Icon name="search" size={14} />
      <input type="search" value={value} placeholder={placeholder} spellCheck={false}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { onChange(''); e.target.blur() } e.stopPropagation() }} />
      {value && <button className="ibtn sm" onClick={() => onChange('')} title="Temizle"><Icon name="x" size={12} /></button>}
    </label>
  )
}

// ---------------------------------------------------------------- kategori yongaları (tek satır, yatay kaydırmalı)
export function Chips({ cats, value, onChange, counts, favCount, allCount }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault() } }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  return (
    <div className="lib-chips" ref={ref}>
      <button className={'chip' + (!value ? ' on' : '')} onClick={() => onChange(null)}>Tümü{allCount != null && <i className="mono">{allCount}</i>}</button>
      {favCount > 0 && (
        <button className={'chip fav' + (value === '__fav' ? ' on' : '')} onClick={() => onChange('__fav')}>
          <Icon name="star" size={11} fill />{favCount}
        </button>
      )}
      {cats.map(c => (
        <button key={c.id} className={'chip' + (value === c.id ? ' on' : '')} onClick={() => onChange(value === c.id ? null : c.id)}>
          {c.name}{counts && counts[c.id] != null && <i className="mono">{counts[c.id]}</i>}
        </button>
      ))}
    </div>
  )
}

export function catCounts(list) {
  const o = {}
  for (const it of list) o[it.category] = (o[it.category] || 0) + 1
  return o
}

// ---------------------------------------------------------------- görünürlük
export function useInView(ref, rootMargin = '160px') {
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setV(true); return }
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return v
}

// ---------------------------------------------------------------- artımlı ızgara (büyük listeler sayfa sayfa)
export function Grid({ items, render, min = 84, page = 60, className = '', cols, resetKey }) {
  const [n, setN] = useState(page)
  const sent = useRef(null)
  useEffect(() => { setN(page) }, [resetKey, page])
  useEffect(() => {
    const el = sent.current
    if (!el || n >= items.length) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setN(x => x + page) }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [n, items.length, page])
  const style = cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : { gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }
  return (
    <>
      <div className={'grid lib-grid ' + className} style={style}>
        {items.slice(0, n).map(render)}
      </div>
      {n < items.length && <div ref={sent} className="lib-more mono">+{items.length - n}</div>}
    </>
  )
}

// Artımlı liste: [görünen sayı, gözcü ref'i]
export function useIncremental(len, page = 60, resetKey) {
  const [n, setN] = useState(page)
  const ref = useRef(null)
  useEffect(() => { setN(page) }, [resetKey, page])
  useEffect(() => {
    const el = ref.current
    if (!el || n >= len) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setN(x => x + page) }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [n, len, page])
  return [n, ref]
}

// ---------------------------------------------------------------- sürükle-bırak
let ghost = null
export function dragStart(e, kind, id, label, extra = {}) {
  const obj = { kind, id, ...extra }
  try {
    e.dataTransfer.setData('application/x-sweax', JSON.stringify(obj))
    e.dataTransfer.setData('application/x-sweax-' + kind, '1')
    e.dataTransfer.effectAllowed = 'copy'
  } catch (err) { /* */ }
  window.__sweaxDragObj = obj
  // film etiketi biçiminde sürükleme hayaleti
  if (!ghost) { ghost = document.createElement('div'); ghost.className = 'lib-ghost'; document.body.appendChild(ghost) }
  ghost.innerHTML = ''
  const k = document.createElement('b'); k.textContent = KIND_LABEL[kind] || kind
  const n = document.createElement('span'); n.textContent = label || id
  ghost.append(k, n)
  ghost.dataset.kind = kind
  try { e.dataTransfer.setDragImage(ghost, 10, 12) } catch (err) { /* */ }
  return obj
}
export function dragEnd() { window.__sweaxDragObj = null }

export const KIND_LABEL = {
  media: 'MEDYA', text: 'YAZI', sticker: 'ÇIKARTMA', effect: 'EFEKT', filter: 'FİLTRE',
  transition: 'GEÇİŞ', sfx: 'SES EFEKTİ', music: 'MÜZİK', layout: 'DÜZEN',
}

// ---------------------------------------------------------------- kart
// thumb: (hover:boolean) => ReactNode
export function Card({ kind, id, name, thumb, onApply, title, badge, sub, className = '', onContext, dragExtra, noFav, wide, onDouble }) {
  const [hover, setHover] = useState(false)
  const favs = useFavs()
  const fav = favs.has(kind + ':' + id)
  return (
    <div className={'card lib-card ' + className + (wide ? ' wide' : '')} title={title}
      draggable
      onDragStart={e => { setHover(false); dragStart(e, kind, id, name, dragExtra) }}
      onDragEnd={dragEnd}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onApply && onApply()}
      onDoubleClick={onDouble}
      onContextMenu={onContext}>
      <div className="thumb">
        {thumb(hover)}
        {badge}
        {!noFav && (
          <button className={'lib-star' + (fav ? ' on' : '')} title={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            onClick={e => { e.stopPropagation(); toggleFav(kind, id) }}>
            <Icon name="star" size={11} fill={fav} />
          </button>
        )}
        <span className="add"><Icon name="plus" size={13} sw={2.2} /></span>
      </div>
      <div className="name">{name}</div>
      {sub && <div className="lib-sub mono">{sub}</div>}
    </div>
  )
}

// GL önizlemeli küçük resim (efekt / filtre / geçiş / yazı)
export function GLThumb({ kind, id, hover, fallback }) {
  const ref = useRef(null)
  const vis = useInView(ref)
  const [url, setUrl] = useState(() => getThumb(kind, id))
  useEffect(() => {
    if (!vis) return
    return requestThumb(kind, id, u => setUrl(u))
  }, [vis, kind, id])
  const cv = useRef(null)
  useEffect(() => {
    if (!hover || !cv.current) return
    return startLive(kind, id, cv.current)
  }, [hover, kind, id])
  return (
    <div ref={ref} className="lib-gl">
      {url && url !== 'x' ? <img src={url} alt="" draggable={false} /> : url === 'x' ? (fallback || <span className="lib-nopv mono">ÖNİZLEME YOK</span>) : <span className="lib-load" />}
      {hover && url !== 'x' && <canvas ref={cv} width={176} height={176} className="lib-live" />}
    </div>
  )
}

// Son kullanılanlar şeridi
export function RecentRow({ kind, ids, render }) {
  if (!ids.length) return null
  return (
    <div className="lib-recent">
      <div className="edge">SON KULLANILANLAR</div>
      <div className="lib-recent-row">{ids.map(render)}</div>
    </div>
  )
}

// Basit mekanik ilerleme çubuğu
export function Bar({ value, indet }) {
  return <div className={'bar' + (indet ? ' indet' : '')}><i style={{ width: Math.round((value || 0) * 100) + '%' }} /></div>
}

// Ortak kütüphane sekme durumu: arama + kategori (sekme başına bellekte)
const tabState = new Map()
export function useTabState(key, init) {
  const [s, setS] = useState(() => tabState.get(key) || init)
  const set = useCallback((patch) => setS(prev => { const n = { ...prev, ...patch }; tabState.set(key, n); return n }), [key])
  return [s, set]
}
