// Denetçi kancaları: dar store seçicileri, oynatma kafası zamanı, anahtar kare bağlayıcısı
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { store, useStore } from '../../core/store.js'
import { prop, hasKeys, keyAt, upsertKey } from '../../core/keyframes.js'
import { setPath, getPath } from '../../core/model.js'
import { playback } from '../../engine/playback.js'
import { REG, onRegistry, registryVersion } from '../../engine/registry.js'
import * as A from '../actions.js'

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

function findById(p, id) {
  for (const t of p.tracks) for (const c of t.clips) if (c.id === id) return c
  return null
}

// Tek klip: immer yapısal paylaşımı sayesinde yalnızca bu klip değişince yeni referans döner
export function useClip(id) {
  const sel = useCallback(s => (id ? findById(s.project, id) : null), [id])
  return useStore(sel)
}

export function useTrackOf(id) {
  const sel = useCallback(s => {
    for (const t of s.project.tracks) if (t.clips.some(c => c.id === id)) return t
    return null
  }, [id])
  return useStore(sel)
}

export function useMedia(mediaId) {
  const sel = useCallback(s => (mediaId ? s.project.media[mediaId] || null : null), [mediaId])
  return useStore(sel)
}

const selSettings = s => s.project.settings
export function useSettings() { return useStore(selSettings) }

// Kayıt defteri listesi (paket yüklendikçe yeniden çiz)
export function useReg(kind) {
  useSyncExternalStore(onRegistry, registryVersion, registryVersion)
  return REG[kind] ? REG[kind].list : []
}
export function useRegCats(kind) {
  useSyncExternalStore(onRegistry, registryVersion, registryVersion)
  return REG[kind] ? REG[kind].categories : []
}

export function anyKeys(clip) {
  if (!clip || !clip.keyframes) return false
  for (const k in clip.keyframes) if (clip.keyframes[k] && clip.keyframes[k].length) return true
  return false
}

// Klip içi oynatma kafası zamanı. Yalnızca klipte anahtar kare varsa zamana abone olur (~20 fps).
export function useLocalTime(clip) {
  const need = anyKeys(clip)
  const [, bump] = useState(0)
  const tRef = useRef(playback.time)
  const subbed = useRef(false)
  useEffect(() => {
    if (!need) return
    subbed.current = true
    let last = 0, timer = 0
    const off = playback.onTime(tt => {
      const now = performance.now()
      if (now - last >= 50) { last = now; tRef.current = tt; bump(x => x + 1) } else if (!timer) {
        timer = setTimeout(() => { timer = 0; last = performance.now(); tRef.current = playback.time; bump(x => x + 1) }, 50 - (now - last))
      }
    })
    return () => { off(); clearTimeout(timer); subbed.current = false }
  }, [need])
  if (!subbed.current) tRef.current = playback.time
  if (!clip) return 0
  return clamp(tRef.current - clip.start, 0, clip.duration)
}

// Bileşen başına hafif zaman aboneliği (alt bilgi şeridi, eğri düzenleyici imleci vb.)
export function usePlayhead(fps = 12) {
  const [t, setT] = useState(playback.time)
  useEffect(() => {
    let last = 0, timer = 0
    const gap = 1000 / fps
    const off = playback.onTime(tt => {
      const now = performance.now()
      if (now - last >= gap) { last = now; setT(tt) } else if (!timer) timer = setTimeout(() => { timer = 0; last = performance.now(); setT(playback.time) }, gap)
    })
    return () => { off(); clearTimeout(timer) }
  }, [fps])
  return t
}

// ---------------------------------------------------------------- bağlayıcı
// b.val(path)  : oynatma kafasındaki değer
// b.kf(path)   : PropRow/Row için anahtar kare durumu
// b.set(path)  : değişiklik işleyici (anahtar kare farkında, sürüklemede birleşik geçmiş)
// b.setS(path) : anahtar kare dışı (statik) değişiklik
export function bind(clip, lt) {
  const id = clip.id
  const b = {
    clip, lt,
    val: (p, fb) => { const v = prop(clip, p, lt); return v == null ? fb : v },
    raw: (p, fb) => { const v = getPath(clip, p); return v == null ? fb : v },
    has: p => hasKeys(clip, p),
    kf: p => ({ has: hasKeys(clip, p), on: keyAt(clip, p, lt) >= 0, onClick: () => A.toggleKey(id, p) }),
    set: (p, label) => (v, o) => { A.setProp(id, p, v, label || 'Özellik'); if (o && o.final) store.endCoalesce() },
    setS: (p, label) => (v, o) => { A.setProp(id, p, v, label || 'Özellik', { static: true }); if (o && o.final) store.endCoalesce() },
    edit: (fn, label, key) => A.setProps(id, fn, label || 'Düzenle', key),
  }
  // Birden çok yolu tek geçmiş adımında yaz (anahtar kare farkında)
  b.multi = (vals, label, final) => {
    const t = playback.time
    A.setProps(id, c => {
      const l = clamp(t - c.start, 0, c.duration)
      for (const p in vals) { if (hasKeys(c, p)) upsertKey(c, p, l, vals[p]); else setPath(c, p, vals[p]) }
    }, label || 'Düzenle', 'multi:' + id + ':' + Object.keys(vals).join(','))
    if (final) store.endCoalesce()
  }
  // PropRow/Row için hazır özellikler
  b.row = (p, label, opts = {}) => ({ label, value: b.val(p, opts.def ?? 0), onChange: b.set(p, label), kf: b.kf(p), ...opts })
  b.srow = (p, label, opts = {}) => ({ label, value: b.raw(p, opts.def ?? 0), onChange: b.setS(p, label), ...opts })
  return b
}

// Birden çok klibe aynı değeri yaz (anahtar karesi olanlarda oynatma kafasına kare)
export function setMany(ids, p, v, label, final) {
  const t = playback.time
  A.setProps(ids, c => {
    if (getPath(c, p) === undefined) return // bu türde olmayan alan (ör. ses klibinde dönüşüm)
    if (hasKeys(c, p)) upsertKey(c, p, clamp(t - c.start, 0, c.duration), v)
    else setPath(c, p, v)
  }, label, 'many:' + p)
  if (final) store.endCoalesce()
}

// Ortak tetik: "anahtar kareleri temizle" — yol önekleri listesine göre
export function clearKeysFor(clipId, prefixes, label = 'Anahtar kareleri temizle') {
  A.setProps(clipId, c => {
    if (!c.keyframes) return
    for (const k of Object.keys(c.keyframes)) if (prefixes.some(px => k === px || k.startsWith(px.endsWith('.') ? px : px + '.'))) delete c.keyframes[k]
  }, label)
}

export function countKeys(clip, prefixes) {
  if (!clip || !clip.keyframes) return 0
  let n = 0
  for (const k of Object.keys(clip.keyframes)) {
    if (prefixes.some(px => k === px || k.startsWith(px.endsWith('.') ? px : px + '.'))) n += clip.keyframes[k].length
  }
  return n
}

// Oynatma kafasındaki bütün anahtar karelerin yolları
export function keysAtTime(clip, lt) {
  const out = []
  if (!clip || !clip.keyframes) return out
  for (const k of Object.keys(clip.keyframes)) if (keyAt(clip, k, lt) >= 0) out.push(k)
  return out
}
