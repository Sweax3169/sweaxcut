// Düzenleme komutları — kısayollar, menüler, araç çubuğu ve sürükle-bırak hepsi buradan geçer.

import { store, selectedClips, primarySelection } from '../core/store.js'
import * as TL from '../core/timeline.js'
import { createTextClip, createStickerClip, createEffectClip, createFilterClip, createAdjustClip, createProject, uid, setPath, getPath, RATIOS } from '../core/model.js'
import { upsertKey, removeKey, keyAt, evalKeys } from '../core/keyframes.js'
import { importFiles, ensureReversed, ALL_EXTS, revalidateMedia, missingMedia } from '../core/media.js'
import { playback } from '../engine/playback.js'
import { get as regGet } from '../engine/registry.js'
import { ipc, fs, path, appPaths, ensureDir, isElectron } from '../platform/node.js'

const ui = () => store.get().ui
const now = () => playback.time

// ---------------------------------------------------------------- içe aktarma
export async function pickAndImport(opts = {}) {
  if (!ipc) return []
  const files = await ipc.invoke('dialog:open', {
    title: 'Medya içe aktar',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Medya', extensions: ALL_EXTS.map(e => e.slice(1)) },
      { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'gif'] },
      { name: 'Ses', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac'] },
      { name: 'Görsel', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg'] },
    ],
  })
  if (!files.length) return []
  const ids = await importFiles(files, opts)
  if (opts.addToTimeline) for (const id of ids) addMediaToTimeline(id)
  return ids
}

export async function importAndPlace(paths, time) {
  const ids = await importFiles(paths)
  const t0 = time ?? now()
  let t = t0
  for (const id of ids) {
    const m = store.get().project.media[id]
    if (!m) continue
    // ses dosyaları videoların yanına değil, bırakıldığı ana eklenir
    addMediaToTimeline(id, m.type === 'audio' ? t0 : t)
    if (m.type !== 'audio') t += m.type === 'image' ? 3 : m.duration
  }
  return ids
}

export function addMediaToTimeline(mediaId, time, opts = {}) {
  const media = store.get().project.media[mediaId]
  if (!media) return null
  let id = null
  store.edit('Zaman çizelgesine ekle', d => {
    const t = time ?? (media.type === 'audio' ? now() : now())
    const c = TL.addMedia(d, d.media[mediaId], t, ui(), opts)
    id = c.id
  })
  if (id) store.select([id])
  return id
}

// ---------------------------------------------------------------- temel düzenleme
export function split() {
  const sel = store.get().selection.clips
  const t = now()
  let created = []
  store.edit('Böl', d => { created = TL.splitAt(d, t, sel.length ? sel : null, ui()) })
  if (!created.length) store.toast('Oynatma kafasında bölünecek klip yok', 'info', 1600)
}

export function deleteSelected(ripple = false) {
  const sel = store.get().selection.clips
  if (!sel.length) return
  store.edit('Sil', d => TL.deleteClips(d, sel, ui(), { ripple }))
  store.select([])
}

export function duplicate() {
  const sel = store.get().selection.clips
  if (!sel.length) return
  let ids = []
  store.edit('Çoğalt', d => { ids = TL.duplicateClips(d, sel, ui()) })
  store.select(ids)
}

let clipboard = []
export function copy() {
  clipboard = JSON.parse(JSON.stringify(selectedClips()))
  if (clipboard.length) store.toast(clipboard.length + ' klip kopyalandı', 'info', 1200)
}
export function cut() { copy(); deleteSelected(false) }
export function paste() {
  if (!clipboard.length) return
  let ids = []
  store.edit('Yapıştır', d => { ids = TL.pasteClips(d, clipboard, now(), ui()) })
  store.select(ids)
}

export function selectAll() {
  const ids = []
  for (const t of store.get().project.tracks) for (const c of t.clips) ids.push(c.id)
  store.select(ids)
}

export function trimSide(side) {
  const sel = store.get().selection.clips
  store.edit(side === 'left' ? 'Solu kırp' : 'Sağı kırp', d => TL.trimToPlayhead(d, now(), side, sel, ui()))
}

export function freezeFrame() {
  const p = primarySelection()
  const target = p && p.clip.type === 'video' ? p.clip : TL.clipsAt(store.get().project, now()).map(x => x.clip).find(c => c.type === 'video')
  if (!target) { store.toast('Dondurmak için bir video klip seç', 'info'); return }
  let id = null
  store.edit('Kare dondur', d => { id = TL.freezeFrame(d, target.id, now(), ui()) })
  if (id) store.select([id])
}

export function detachAudio() {
  const p = primarySelection()
  if (!p || p.clip.type !== 'video') { store.toast('Sesini ayırmak için video klip seç', 'info'); return }
  let id = null
  store.edit('Sesi ayır', d => { id = TL.detachAudio(d, p.clip.id, ui()) })
  if (!id) store.toast('Bu klipte ses yok', 'info')
}

export async function toggleReverse() {
  const p = primarySelection()
  if (!p || (p.clip.type !== 'video' && p.clip.type !== 'audio')) { store.toast('Ters çevirmek için video/ses klip seç', 'info'); return }
  const c = p.clip
  if (!c.reverse) {
    const out = await ensureReversed(c.mediaId)
    if (!out) return
  }
  store.edit(c.reverse ? 'Ters çevirmeyi kaldır' : 'Ters çevir', d => {
    const x = TL.getClip(d, c.id)
    if (x) x.reverse = !x.reverse
  })
}

export function mirror(axis = 'h') {
  const sel = selectedClips().filter(c => c.transform)
  if (!sel.length) return
  store.edit('Ayna', d => {
    for (const s of sel) { const c = TL.getClip(d, s.id); if (axis === 'h') c.transform.flipH = !c.transform.flipH; else c.transform.flipV = !c.transform.flipV }
  })
}

export function rotate90() {
  const sel = selectedClips().filter(c => c.transform)
  if (!sel.length) return
  store.edit('Döndür', d => { for (const s of sel) { const c = TL.getClip(d, s.id); c.transform.rotation = ((Math.round(c.transform.rotation / 90) * 90 + 90) % 360) } })
}

export function setSpeed(clipId, speed, curve = null) {
  store.edit('Hız', d => TL.setClipSpeed(d, clipId, speed, curve, ui()), { coalesce: 'speed:' + clipId })
}

// ---------------------------------------------------------------- özellik bağlama
// Bir özelliği ayarla: o özellikte anahtar kare varsa oynatma kafasında anahtar kare günceller/ekler.
export function setProp(clipId, p, value, label = 'Özellik', opts = {}) {
  store.edit(label, d => {
    const c = TL.getClip(d, clipId)
    if (!c) return
    const keys = c.keyframes && c.keyframes[p]
    if (keys && keys.length && !opts.static) {
      const lt = Math.max(0, Math.min(c.duration, now() - c.start))
      upsertKey(c, p, lt, value)
    } else setPath(c, p, value)
  }, { coalesce: 'prop:' + clipId + ':' + p })
}

export function setProps(clipIds, fn, label = 'Düzenle', coalesce) {
  const ids = [].concat(clipIds)
  store.edit(label, d => { for (const id of ids) { const c = TL.getClip(d, id); if (c) fn(c, d) } }, coalesce ? { coalesce } : {})
}

export function toggleKey(clipId, p) {
  const s = store.get()
  const c = TL.getClip(s.project, clipId)
  if (!c) return
  const lt = Math.max(0, Math.min(c.duration, now() - c.start))
  const idx = keyAt(c, p, lt)
  store.edit(idx >= 0 ? 'Anahtar kareyi kaldır' : 'Anahtar kare ekle', d => {
    const x = TL.getClip(d, clipId)
    if (idx >= 0) removeKey(x, p, lt)
    else {
      const keys = x.keyframes && x.keyframes[p]
      const v = keys && keys.length ? evalKeys(keys, lt, getPath(x, p)) : getPath(x, p)
      upsertKey(x, p, lt, typeof v === 'number' ? v : 0)
    }
  })
}

export function clearKeys(clipId, prefix) {
  store.edit('Anahtar kareleri temizle', d => {
    const c = TL.getClip(d, clipId)
    if (!c || !c.keyframes) return
    for (const k of Object.keys(c.keyframes)) if (!prefix || k.startsWith(prefix)) delete c.keyframes[k]
  })
}

// Sonraki/önceki anahtar kareye git
export function jumpKey(dir) {
  const p = primarySelection()
  if (!p) return
  const c = p.clip
  const times = new Set()
  for (const k of Object.keys(c.keyframes || {})) for (const x of c.keyframes[k]) times.add(c.start + x.t)
  const arr = [...times].sort((a, b) => a - b)
  const t = now()
  const target = dir > 0 ? arr.find(x => x > t + 1e-3) : arr.reverse().find(x => x < t - 1e-3)
  if (target != null) playback.seek(target)
}

// ---------------------------------------------------------------- içerik ekleme
function placeNew(clip, label) {
  store.edit(label, d => { TL.placeClip(d, clip, {}, ui()) })
  store.select([clip.id])
  return clip.id
}

export function addText(template, time) {
  const t = time ?? now()
  const clip = createTextClip({ start: t, duration: 3 })
  if (template) {
    clip.text = { ...clip.text, ...(template.text || {}) }
    for (const k of ['stroke', 'stroke2', 'shadow', 'glow', 'bg']) if (template.text && template.text[k]) clip.text[k] = { ...createTextClip().text[k], ...template.text[k] }
    if (template.sampleText) clip.text.content = template.sampleText
    if (template.anim) clip.anim = { in: null, out: null, loop: null, ...JSON.parse(JSON.stringify(template.anim)) }
    if (template.effects) clip.effects = template.effects.map(e => ({ uid: uid('e'), enabled: true, ...e }))
    if (template.transform) clip.transform = { ...clip.transform, ...template.transform }
    clip.templateId = template.id
    clip.name = template.name
  }
  return placeNew(clip, 'Yazı ekle')
}

export function addSticker(def, time) {
  const clip = createStickerClip(def, { start: time ?? now(), duration: 3 })
  if (def.defaultScale) clip.transform.scale = def.defaultScale
  return placeNew(clip, 'Çıkartma ekle')
}

export function addImageSticker(mediaId, time) {
  const m = store.get().project.media[mediaId]
  const clip = createStickerClip({ kind: 'image', id: null, mediaId, name: m ? m.name : 'Görsel' }, { start: time ?? now(), duration: 3 })
  return placeNew(clip, 'Görsel çıkartma ekle')
}

export function addEffect(def, opts = {}) {
  const defaults = {}
  for (const p of def.params || []) defaults[p.key] = p.default
  const sel = selectedClips().filter(c => c.type === 'video' || c.type === 'image' || c.type === 'text' || c.type === 'sticker')
  if (opts.toClip && sel.length) {
    store.edit('Efekt uygula', d => {
      for (const s of sel) { const c = TL.getClip(d, s.id); c.effects = [...(c.effects || []), { uid: uid('e'), id: def.id, params: defaults, enabled: true }] }
    })
    return
  }
  const clip = createEffectClip({ ...def, defaults }, { start: opts.time ?? now(), duration: opts.duration || 3 })
  return placeNew(clip, 'Efekt ekle')
}

export function addFilter(def, opts = {}) {
  const sel = selectedClips().filter(c => c.type === 'video' || c.type === 'image')
  if ((opts.toClip ?? true) && sel.length) {
    store.edit('Filtre uygula', d => { for (const s of sel) { const c = TL.getClip(d, s.id); c.filter = { id: def.id, intensity: c.filter ? c.filter.intensity : 1 } } })
    return
  }
  const clip = createFilterClip(def, { start: opts.time ?? now(), duration: opts.duration || 3 })
  return placeNew(clip, 'Filtre katmanı ekle')
}

export function addAdjustLayer() {
  const clip = createAdjustClip({ start: now(), duration: 3 })
  return placeNew(clip, 'Ayar katmanı ekle')
}

// Geçiş: seçili klip(ler)in sonuna; seçim yoksa oynatma kafasına en yakın ana iz kesimi
export function applyTransition(def, clipId) {
  const s = store.get()
  const ids = clipId ? [clipId] : s.selection.clips
  let targets = []
  const main = TL.mainTrack(s.project)
  if (ids.length) targets = ids
  else if (main) {
    let best = null, bd = Infinity
    for (let i = 0; i < main.clips.length - 1; i++) {
      const c = main.clips[i]
      const dd = Math.abs(c.start + c.duration - now())
      if (dd < bd) { bd = dd; best = c }
    }
    if (best) targets = [best.id]
  }
  if (!targets.length) { store.toast('Geçiş için iki klip arasını seç', 'info'); return }
  store.edit('Geçiş ekle', d => {
    for (const id of targets) {
      const c = TL.getClip(d, id)
      if (!c || (c.type !== 'video' && c.type !== 'image')) continue
      c.transition = { id: def.id, duration: c.transition ? c.transition.duration : (def.duration || 0.6), params: {} }
    }
  })
}

export function applyTransitionAll(def) {
  store.edit('Geçişi tümüne uygula', d => {
    const m = TL.mainTrack(d)
    for (let i = 0; i < m.clips.length - 1; i++) m.clips[i].transition = { id: def.id, duration: def.duration || 0.6, params: {} }
  })
}

export function addMarker(label = '', color = '#e4ff3a') {
  const t = now()
  store.edit('İşaret ekle', d => { d.markers.push({ id: uid('k'), time: t, color, label }) })
}

// ---------------------------------------------------------------- proje dosyaları
export function projectsDir() {
  const p = appPaths()
  return ensureDir(path ? path.join(p.documents, 'SWEAXCUT', 'Projeler') : '/tmp')
}

function recentFile() { return path.join(appPaths().userData, 'recent.json') }
export function loadRecent() {
  if (!fs) return []
  try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter(r => fs.existsSync(r.path)) } catch (e) { return [] }
}
function pushRecent(entry) {
  if (!fs) return
  const list = loadRecent().filter(r => r.path !== entry.path)
  list.unshift(entry)
  try { fs.writeFileSync(recentFile(), JSON.stringify(list.slice(0, 30), null, 1)) } catch (e) { /* */ }
}

export function thumbsDir() { return ensureDir(path.join(appPaths().userData, 'thumbs')) }

function saveThumb(projectId) {
  try {
    const url = playback.snapshotDataURL()
    if (!url || url.length < 2000) return null
    const p = path.join(thumbsDir(), projectId + '.png')
    fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'))
    return p
  } catch (e) { return null }
}

export function newProject(ratioId = '9:16', name) {
  const p = createProject({ ratio: ratioId, name: name || 'Proje ' + new Date().toLocaleDateString('tr-TR') })
  store.loadProject(p, null)
  playback.seek(0)
}

export async function saveProject(as = false) {
  if (!isElectron) { store.toast('Kaydetme yalnızca masaüstü uygulamasında', 'info'); return false }
  const s = store.get()
  let file = s.ui.projectPath
  if (!file || as) {
    const safe = (s.project.name || 'proje').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'proje'
    file = await ipc.invoke('dialog:save', {
      title: 'Projeyi kaydet',
      defaultPath: path.join(projectsDir(), safe + '.sweax'),
      filters: [{ name: 'SWEAXCUT projesi', extensions: ['sweax'] }],
    })
    if (!file) return false
  }
  try {
    const project = { ...s.project, modified: Date.now() }
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(project))
    fs.renameSync(tmp, file)
    const thumb = saveThumb(project.id)
    pushRecent({ path: file, name: project.name, modified: Date.now(), thumb, ratio: project.settings.ratio, duration: TL.projectDuration(project) })
    store.markSaved(file)
    store.toast('Kaydedildi', 'ok', 1400)
    return true
  } catch (e) {
    store.toast('Kaydedilemedi: ' + e.message, 'error', 5000)
    return false
  }
}

export async function openProject(file) {
  if (!file) {
    const files = await ipc.invoke('dialog:open', { title: 'Proje aç', properties: ['openFile'], filters: [{ name: 'SWEAXCUT projesi', extensions: ['sweax'] }], defaultPath: projectsDir() })
    file = files[0]
    if (!file) return
  }
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'))
    store.loadProject(p, file)
    playback.seek(0)
    pushRecent({ path: file, name: p.name, modified: Date.now(), thumb: path.join(thumbsDir(), p.id + '.png'), ratio: p.settings && p.settings.ratio, duration: TL.projectDuration(p) })
    const miss = missingMedia(store.get().project)
    if (miss.length) store.toast(miss.length + ' medya dosyası bulunamadı (taşınmış olabilir)', 'error', 6000)
    revalidateMedia()
  } catch (e) {
    store.toast('Proje açılamadı: ' + e.message, 'error', 5000)
  }
}

// Otomatik kayıt (çökme kurtarma)
let autosaveTimer = 0
export function startAutosave() {
  clearInterval(autosaveTimer)
  autosaveTimer = setInterval(() => {
    const s = store.get()
    if (!fs || s.ui.screen !== 'editor' || !s.ui.dirty) return
    try {
      const dir = ensureDir(path.join(appPaths().userData, 'autosave'))
      fs.writeFileSync(path.join(dir, 'son.sweax'), JSON.stringify({ ...s.project, __path: s.ui.projectPath }))
      if (s.ui.projectPath) {
        fs.writeFileSync(s.ui.projectPath + '.tmp', JSON.stringify(s.project))
        fs.renameSync(s.ui.projectPath + '.tmp', s.ui.projectPath)
        store.markSaved()
      }
    } catch (e) { /* */ }
  }, 45000)
}

export function autosavePath() { return path ? path.join(appPaths().userData, 'autosave', 'son.sweax') : null }

export function setRatio(ratioId) {
  const r = RATIOS.find(x => x.id === ratioId)
  if (!r) return
  store.edit('En-boy oranı', d => { d.settings.ratio = r.id; d.settings.width = r.w; d.settings.height = r.h })
}

export { now }
