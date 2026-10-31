// Altyazı stili: hazır + kaydedilmiş stil galerisi ve gruba uygulanan tam stil düzenleyicisi.
// Değişiklikler grubun bütün satırlarına aynı anda gider (store.edit → patchGroup); önizleme monitörü canlı gösterir.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { store } from '../../core/store.js'
import { REG } from '../../engine/registry.js'
import { Toggle, Segmented, openMenu } from '../controls.jsx'
import Icon from '../Icon.jsx'
import { Sec, Row, Color } from '../inspector/common.jsx'
import { FontPicker } from '../inspector/TextTab.jsx'
import { GLThumb, useRegVersion } from '../library/common.jsx'
import { effectiveLook, patchGroup, regroup, groupClipsIn, setCase, styleFromClip } from '../../features/captions/edit.js'
import { saveUserStyle, deleteUserStyle } from '../../features/captions/userstyles.js'

const textPackMods = import.meta.glob('../../packs/text/index.js', { eager: true })
const textPack = Object.values(textPackMods)[0] || {}

// ---------------------------------------------------------------- galeri
export function StyleGallery({ value, onPick, compact }) {
  useRegVersion()
  const [cat, setCat] = useState(null)
  const [hover, setHover] = useState(null)
  const cats = REG.captionStyles.categories
  const strip = useRef(null)
  // yatay şeritte fare tekerleği yana kaydırır
  useEffect(() => {
    const el = strip.current
    if (!el || !compact) return
    const wheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault() } }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [compact])
  const list = REG.captionStyles.list.filter(s => !cat || s.category === cat)
  return (
    <div className="capgal">
      <div className="lib-chips" style={{ padding: compact ? '0 0 8px' : '0 0 10px' }}>
        <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat(null)}>Tümü</button>
        {cats.filter(c => REG.captionStyles.list.some(s => s.category === c.id)).map(c => (
          <button key={c.id} className={'chip' + (cat === c.id ? ' on' : '')} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.name}</button>
        ))}
      </div>
      <div ref={strip} className={'capgal-grid' + (compact ? ' strip' : '')} style={compact ? null : { gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
        {list.map(s => (
          <div key={s.id} className={'card lib-card cap-card' + (value === s.id ? ' sel' : '')} title={s.name}
            onClick={() => onPick(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
            onContextMenu={s.user ? (e => openMenu(e, [{ label: 'Kaydedilen stili sil', icon: 'trash', onClick: () => { deleteUserStyle(s.id); store.toast('Stil silindi', 'info', 1400) } }])) : undefined}>
            <div className="thumb"><GLThumb kind="caption" id={s.id} hover={hover === s.id} /></div>
            <div className="name">{s.user && <Icon name="star" size={10} fill />}{s.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Hazır stili gruba uygula (görünüm değişiklikleri sıfırlanır, metin ve konum korunur)
export function applyStyleToGroup(gid, styleId) {
  const st = REG.captionStyles.byId.get(styleId)
  if (!st) return
  store.edit('Altyazı stili: ' + st.name, d => {
    for (const { c } of groupClipsIn(d, gid)) {
      const keepX = c.transform.x
      if (textPack.applyCaptionStyle) textPack.applyCaptionStyle(c, styleId)
      c.text.uppercase = false
      c.caption.look = null
      if (st.uppercase != null) setCase(c, !!st.uppercase)
      if (st.user && st.y != null) c.transform.y = st.y
      c.transform.x = keepX
    }
  })
}

// ---------------------------------------------------------------- düzenleyici
const WORD_IN = [
  ['none', 'Yok'], ['pop', 'Pat'], ['fade', 'Belir'], ['slide', 'Kay'], ['drop', 'Düş'], ['bump', 'Vur'],
  ['blur', 'Bulanık'], ['type', 'Daktilo'], ['spin', 'Dön'], ['stretch', 'Esne'],
]
const LOOPS = [['none', 'Yok'], ['pulse', 'Nabız'], ['wiggle', 'Sallan'], ['float', 'Süzül']]
const POS = [['Üst', -0.32], ['Orta', 0], ['Alt', 0.24]]

function hiKind(a) {
  if (!a) return 'yok'
  if (a.wipe) return 'dolgu'
  if (a.bg) return 'kutu'
  if (a.underline) return 'alt'
  if (a.color || a.fill || (a.scale && a.scale !== 1)) return 'renk'
  return 'yok'
}

export function CaptionStyleEditor({ gid, clip }) {
  const [name, setName] = useState(null)
  const look = useMemo(() => effectiveLook(clip), [clip])
  const t = clip.text
  const a = look.active || {}
  const hk = hiKind(a)
  const bgKind = look.wordBg ? 'kelime' : t.bg && t.bg.enabled ? (t.bg.mode === 'line' || t.bg.mode === 'marker' ? 'satir' : 'blok') : 'yok'
  const upper = look.uppercase != null ? !!look.uppercase : clip.caption.words.length > 0 && clip.caption.words.every(w => w.w === w.w.toLocaleUpperCase('tr-TR'))
  const key = k => 'capst:' + gid + ':' + k
  const P = (patch, label, k) => (v, o = {}) => {
    const p = typeof patch === 'function' ? patch(v) : patch
    store.edit(label, d => patchGroup(d, gid, p), { coalesce: o.final === true && !k ? undefined : key(k || label) })
  }
  const hiColor = hk === 'kutu' ? (a.bg && a.bg.color) : hk === 'alt' ? (a.underline && a.underline.color) : hk === 'dolgu' ? a.wipeColor : a.color
  const setHiKind = (v) => {
    const col = hiColor || '#FFE600'
    const base = { bg: null, underline: null, wipe: false }
    const active = v === 'renk' ? { ...base, color: col, scale: a.scale || 1.12 }
      : v === 'kutu' ? { ...base, color: '#FFFFFF', bg: { color: col === '#FFFFFF' ? '#22C55E' : col, radius: 10, padX: 12, padY: 6 }, scale: a.scale || 1.06 }
        : v === 'alt' ? { ...base, underline: { color: col, height: 8, offset: 10, radius: 3 } }
          : v === 'dolgu' ? { ...base, wipe: true, wipeColor: col, color: null }
            : { ...base, color: null, scale: 1, y: 0 }
    store.edit('Vurgu türü', d => patchGroup(d, gid, { look: { active } }))
  }
  const setHiColor = (v, o) => {
    const active = hk === 'kutu' ? { bg: { ...(a.bg || {}), color: v } } : hk === 'alt' ? { underline: { ...(a.underline || {}), color: v } } : hk === 'dolgu' ? { wipeColor: v } : { color: v }
    store.edit('Vurgu rengi', d => patchGroup(d, gid, { look: { active } }), { coalesce: o && o.final ? undefined : key('hic') })
  }
  const setBgKind = (v) => {
    const col = (look.wordBg && look.wordBg.color) || (t.bg && t.bg.color) || '#000000'
    const patch = v === 'yok' ? { text: { bg: { enabled: false } }, look: { wordBg: null } }
      : v === 'kelime' ? { text: { bg: { enabled: false } }, look: { wordBg: { color: col, opacity: 0.78, radius: 8, padX: 10, padY: 6 } } }
        : { text: { bg: { enabled: true, mode: v === 'satir' ? 'line' : 'block', color: col, opacity: t.bg && t.bg.opacity != null ? t.bg.opacity : 0.7, radius: 12, padX: 22, padY: 10 } }, look: { wordBg: null } }
    store.edit('Altyazı arka planı', d => patchGroup(d, gid, patch))
  }
  const bgSrc = bgKind === 'kelime' ? look.wordBg : t.bg
  const bgPatch = (k) => (v) => bgKind === 'kelime' ? { look: { wordBg: { ...look.wordBg, [k]: v } } } : { text: { bg: { [k]: v } } }
  const words = clip.caption.maxWords || null

  return (
    <div className="capedit">
      <Sec id="cs-yazi" title="Yazı">
        <FontPicker value={t.font} onChange={v => store.edit('Altyazı yazı tipi', d => patchGroup(d, gid, { text: { font: v } }))} />
        <Row label="Boyut" value={t.size || 84} min={24} max={220} step={1} def={84} onChange={P(v => ({ text: { size: v } }), 'Altyazı boyutu', 'size')} />
        <Row label="Kalınlık" value={t.weight || 800} min={300} max={900} step={100} def={800} onChange={P(v => ({ text: { weight: v } }), 'Kalınlık', 'w')} />
        <Row label="Harf aralığı" value={t.letterSpacing || 0} min={-6} max={30} step={0.5} def={0} onChange={P(v => ({ text: { letterSpacing: v } }), 'Harf aralığı', 'ls')} />
        <Color label="Renk" value={t.color || '#ffffff'} onChange={P(v => ({ text: { color: v } }), 'Yazı rengi', 'col')} />
        <Toggle label="BÜYÜK HARF" on={upper} onChange={v => store.edit('Büyük harf', d => patchGroup(d, gid, { upper: v, look: { uppercase: v } }))} />
      </Sec>

      <Sec id="cs-vurgu" title="Konuşulan kelime" sub={{ renk: 'renk', kutu: 'kutu', alt: 'alt çizgi', dolgu: 'karaoke', yok: 'kapalı' }[hk]}>
        <Segmented value={hk} onChange={setHiKind} options={[{ value: 'renk', label: 'Renk' }, { value: 'kutu', label: 'Kutu' }, { value: 'alt', label: 'Çizgi' }, { value: 'dolgu', label: 'Karaoke' }, { value: 'yok', label: 'Yok' }]} />
        {hk !== 'yok' && <Color label={hk === 'kutu' ? 'Kutu rengi' : 'Vurgu rengi'} value={hiColor || '#ffe600'} onChange={setHiColor} />}
        {hk === 'kutu' && <Color label="Kutudaki yazı" value={a.color || '#ffffff'} onChange={P(v => ({ look: { active: { color: v } } }), 'Kutu yazı rengi', 'kc')} />}
        {hk === 'kutu' && <Row label="Köşe" value={(a.bg && a.bg.radius) ?? 10} min={0} max={40} step={1} def={10} onChange={P(v => ({ look: { active: { bg: { ...(a.bg || {}), radius: v } } } }), 'Kutu köşesi', 'kr')} />}
        {hk !== 'yok' && <Row label="Büyüme" value={a.scale || 1} min={1} max={1.6} step={0.01} scale={100} digits={0} suffix="%" def={1.1} onChange={P(v => ({ look: { active: { scale: v } } }), 'Vurgu büyümesi', 'sc')} />}
        {hk !== 'yok' && <Row label="Zıplama" value={-(a.y || 0)} min={0} max={30} step={1} def={0} onChange={P(v => ({ look: { active: { y: -v } } }), 'Vurgu zıplaması', 'jy')} />}
        <Row label="Söylenecekler" value={(look.future && look.future.opacity) ?? 1} min={0.1} max={1} step={0.01} scale={100} digits={0} suffix="%" def={1}
          hint="Henüz söylenmemiş kelimelerin görünürlüğü" onChange={P(v => ({ look: { future: { opacity: v } } }), 'Söylenecek kelimeler', 'fo')} />
        <Toggle label="Söyleneni boya" hint="Söylenmiş kelimeleri vurgu rengiyle bırakır" on={!!(look.past && look.past.color)} onChange={v => store.edit('Söylenen kelimeler', d => patchGroup(d, gid, { look: { past: v ? { color: hiColor || '#ffe600' } : { color: null } } }))} />
      </Sec>

      <Sec id="cs-anim" title="Hareket">
        <div className="prop irow"><span className="lbl static"><span className="lt">Kelime girişi</span></span>
          <select className="field grow" value={look.wordIn || 'none'} onChange={e => store.edit('Kelime girişi', d => patchGroup(d, gid, { look: { wordIn: e.target.value } }))}>
            {WORD_IN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="prop irow"><span className="lbl static"><span className="lt">Sürekli</span></span>
          <select className="field grow" value={look.loop || 'none'} onChange={e => store.edit('Altyazı hareketi', d => patchGroup(d, gid, { look: { loop: e.target.value } }))}>
            {LOOPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Toggle label="Emoji ekle" on={!!look.emoji} onChange={v => store.edit('Altyazı emojisi', d => patchGroup(d, gid, { look: { emoji: v } }))} />
      </Sec>

      <Sec id="cs-kontur" title="Kontur ve gölge" defaultOpen={false}>
        <Toggle label="Kontur" on={!!(t.stroke && t.stroke.enabled && t.stroke.width)} onChange={v => store.edit('Kontur', d => patchGroup(d, gid, { text: { stroke: { enabled: v, width: v ? Math.max(6, (t.stroke && t.stroke.width) || 8) : 0 } } }))} />
        {t.stroke && t.stroke.enabled && <>
          <Color label="Kontur rengi" value={t.stroke.color || '#000000'} onChange={P(v => ({ text: { stroke: { color: v } } }), 'Kontur rengi', 'stc')} />
          <Row label="Kalınlık" value={t.stroke.width || 0} min={0} max={30} step={0.5} def={8} onChange={P(v => ({ text: { stroke: { width: v } } }), 'Kontur kalınlığı', 'stw')} />
        </>}
        <Toggle label="Gölge" on={!!(t.shadow && t.shadow.enabled)} onChange={v => store.edit('Gölge', d => patchGroup(d, gid, { text: { shadow: { enabled: v } } }))} />
        {t.shadow && t.shadow.enabled && <>
          <Color label="Gölge rengi" value={t.shadow.color || '#000000'} onChange={P(v => ({ text: { shadow: { color: v } } }), 'Gölge rengi', 'shc')} />
          <Row label="Yumuşaklık" value={t.shadow.blur || 0} min={0} max={50} step={1} def={12} onChange={P(v => ({ text: { shadow: { blur: v } } }), 'Gölge yumuşaklığı', 'shb')} />
          <Row label="Mesafe" value={t.shadow.y || 0} min={-20} max={30} step={1} def={6} onChange={P(v => ({ text: { shadow: { y: v } } }), 'Gölge mesafesi', 'shy')} />
          <Row label="Opaklık" value={t.shadow.opacity ?? 0.6} min={0} max={1} step={0.01} scale={100} digits={0} suffix="%" def={0.6} onChange={P(v => ({ text: { shadow: { opacity: v } } }), 'Gölge opaklığı', 'sho')} />
        </>}
        <Toggle label="Parlama" on={!!(t.glow && t.glow.enabled)} onChange={v => store.edit('Parlama', d => patchGroup(d, gid, { text: { glow: { enabled: v } } }))} />
        {t.glow && t.glow.enabled && <>
          <Color label="Parlama rengi" value={t.glow.color || '#4dd2ff'} onChange={P(v => ({ text: { glow: { color: v } } }), 'Parlama rengi', 'glc')} />
          <Row label="Boyut" value={t.glow.size || 0} min={0} max={80} step={1} def={24} onChange={P(v => ({ text: { glow: { size: v } } }), 'Parlama boyutu', 'gls')} />
        </>}
      </Sec>

      <Sec id="cs-bg" title="Arka plan" sub={{ yok: 'yok', satir: 'satır', blok: 'blok', kelime: 'her kelime' }[bgKind]} defaultOpen={false}>
        <Segmented value={bgKind} onChange={setBgKind} options={[{ value: 'yok', label: 'Yok' }, { value: 'satir', label: 'Satır' }, { value: 'blok', label: 'Blok' }, { value: 'kelime', label: 'Kelime' }]} />
        {bgKind !== 'yok' && bgSrc && <>
          <Color label="Renk" value={bgSrc.color || '#000000'} onChange={(v, o) => store.edit('Arka plan rengi', d => patchGroup(d, gid, bgPatch('color')(v)), { coalesce: o && o.final ? undefined : key('bgc') })} />
          <Row label="Opaklık" value={bgSrc.opacity ?? 0.7} min={0} max={1} step={0.01} scale={100} digits={0} suffix="%" def={0.7} onChange={(v, o) => store.edit('Arka plan opaklığı', d => patchGroup(d, gid, bgPatch('opacity')(v)), { coalesce: key('bgo') })} />
          <Row label="Köşe" value={bgSrc.radius ?? 10} min={0} max={50} step={1} def={10} onChange={(v) => store.edit('Arka plan köşesi', d => patchGroup(d, gid, bgPatch('radius')(v)), { coalesce: key('bgr') })} />
          <Row label="İç boşluk" value={bgSrc.padX ?? 12} min={0} max={60} step={1} def={12} onChange={(v) => store.edit('Arka plan boşluğu', d => patchGroup(d, gid, bgPatch('padX')(v)), { coalesce: key('bgp') })} />
        </>}
      </Sec>

      <Sec id="cs-konum" title="Konum ve satır">
        <div className="prop irow"><span className="lbl static"><span className="lt">Hazır</span></span>
          <div className="ibtns grow seg">
            {POS.map(([l, y]) => <button key={l} className={'ib' + (Math.abs((clip.transform.y || 0) - y) < 0.02 ? ' on' : '')} onClick={() => store.edit('Altyazı konumu', d => patchGroup(d, gid, { transform: { y } }))}>{l}</button>)}
          </div>
        </div>
        <Row label="Dikey" value={clip.transform.y || 0} min={-0.48} max={0.48} step={0.005} scale={100} digits={0} suffix="%" def={0.22} onChange={P(v => ({ transform: { y: v } }), 'Altyazı dikey konumu', 'ty')} />
        <Row label="Yatay" value={clip.transform.x || 0} min={-0.4} max={0.4} step={0.005} scale={100} digits={0} suffix="%" def={0} onChange={P(v => ({ transform: { x: v } }), 'Altyazı yatay konumu', 'tx')} />
        <Row label="Genişlik" value={t.maxWidth || 0.86} min={0.3} max={1} step={0.01} scale={100} digits={0} suffix="%" def={0.86} onChange={P(v => ({ text: { maxWidth: v } }), 'Altyazı genişliği', 'mw')} />
        <Row label="Satırda kelime" value={words || 3} min={1} max={10} step={1} def={3} hint="Altyazıları kelime zamanlarıyla yeniden böler"
          onChange={(v, o) => { if (o && o.final === false) return; store.edit('Satır başına kelime', d => regroup(d, gid, Math.round(v))) }} />
      </Sec>

      <div className="capsave">
        {name == null ? (
          <button className="btn" onClick={() => setName('Stilim ' + (REG.captionStyles.list.filter(s => s.user).length + 1))}><Icon name="star" size={13} />Bu stili kaydet</button>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <input className="field grow" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.target.nextSibling.click(); if (e.key === 'Escape') setName(null) }} />
            <button className="btn sig" onClick={() => {
              const st = saveUserStyle(styleFromClip(clip, name.trim() || 'Stilim'))
              store.edit('Stili kaydet', d => { for (const { c } of groupClipsIn(d, gid)) c.caption.styleId = st.id })
              store.toast(`"${st.name}" kaydedildi · Kaydettiklerim`, 'ok', 1800)
              setName(null)
            }}>Kaydet</button>
          </div>
        )}
        <button className="btn ghost" onClick={() => clip.caption.styleId && applyStyleToGroup(gid, clip.caption.styleId)} data-tip="Seçili hazır stile geri dön"><Icon name="undo" size={13} />Sıfırla</button>
      </div>
    </div>
  )
}
