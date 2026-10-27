// Uygulama durumu: proje (geri alınabilir), seçim ve arayüz durumu.
// Proje değişmez (immutable) tutulur; düzenlemeler immer ile yapılır, her düzenleme geçmişe girer.
// Kaydırıcı sürüklerken aynı "coalesce" anahtarıyla gelen ardışık düzenlemeler tek adım sayılır.

import { produce, setAutoFreeze } from 'immer'
import { useSyncExternalStore, useRef, useCallback } from 'react'
import { createProject, normalizeProject } from './model.js'

setAutoFreeze(false) // motor her karede okur; dondurma maliyetinden kaçın

const HISTORY_MAX = 300
const COALESCE_MS = 900

function initialUI() {
  return {
    screen: 'home',          // home | editor
    leftTab: 'media',
    leftSub: null,
    inspectorTab: null,
    zoom: 60,                // zaman çizelgesi: saniye başına piksel
    scrollX: 0,
    snap: true,
    magnet: true,            // ana iz mıknatısı (boşluk bırakmaz)
    linkAudio: true,
    previewQuality: 'auto',  // auto | full | half | quarter
    safeArea: 'none',        // none | tiktok | shorts | reels | grid
    showWaveforms: true,
    timelineHeight: 300,
    leftWidth: 360,
    rightWidth: 330,
    projectPath: null,
    dirty: false,
    modal: null,             // { type, props }
    busy: null,              // { label, progress }
    loop: false,
    rangeIn: null, rangeOut: null,
  }
}

let state = {
  project: createProject(),
  selection: { clips: [], track: null },
  ui: initialUI(),
  toasts: [],
  history: { past: [], future: [], canUndo: false, canRedo: false, lastLabel: '' },
  rev: 0,                    // proje her değiştiğinde artar (motor yeniden çizim için)
}

const listeners = new Set()
function emit() { for (const l of listeners) l() }

let lastCoalesce = null
let lastCoalesceAt = 0

export const store = {
  get: () => state,
  getState: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

  // label: geçmişte görünen ad; recipe(draft) projeyi değiştirir
  edit(label, recipe, opts = {}) {
    const prev = state.project
    const next = produce(prev, d => { recipe(d) })
    if (next === prev) return
    next.modified = Date.now()
    const now = performance.now()
    let past = state.history.past
    const coalesce = opts.coalesce && opts.coalesce === lastCoalesce && now - lastCoalesceAt < COALESCE_MS
    if (!coalesce && !opts.noHistory) {
      past = past.concat([{ project: prev, label, selection: state.selection }])
      if (past.length > HISTORY_MAX) past = past.slice(past.length - HISTORY_MAX)
    }
    lastCoalesce = opts.coalesce || null
    lastCoalesceAt = now
    state = {
      ...state,
      project: next,
      rev: state.rev + 1,
      ui: state.ui.dirty ? state.ui : { ...state.ui, dirty: true },
      history: { past, future: opts.noHistory ? state.history.future : [], canUndo: past.length > 0, canRedo: opts.noHistory ? state.history.canRedo : false, lastLabel: label },
    }
    emit()
  },

  // Sürükleme bitti: bir sonraki düzenleme yeni adım olsun
  endCoalesce() { lastCoalesce = null },

  undo() {
    const { past, future } = state.history
    if (!past.length) return
    const entry = past[past.length - 1]
    state = {
      ...state,
      project: entry.project,
      selection: sanitizeSelection(entry.project, entry.selection),
      rev: state.rev + 1,
      ui: { ...state.ui, dirty: true },
      history: { past: past.slice(0, -1), future: [{ project: state.project, label: entry.label, selection: state.selection }, ...future], canUndo: past.length > 1, canRedo: true, lastLabel: entry.label },
    }
    lastCoalesce = null
    emit()
    return entry.label
  },

  redo() {
    const { past, future } = state.history
    if (!future.length) return
    const entry = future[0]
    state = {
      ...state,
      project: entry.project,
      selection: sanitizeSelection(entry.project, entry.selection),
      rev: state.rev + 1,
      ui: { ...state.ui, dirty: true },
      history: { past: past.concat([{ project: state.project, label: entry.label, selection: state.selection }]), future: future.slice(1), canUndo: true, canRedo: future.length > 1, lastLabel: entry.label },
    }
    lastCoalesce = null
    emit()
    return entry.label
  },

  loadProject(p, projectPath = null) {
    const project = normalizeProject(p)
    state = {
      ...state,
      project,
      selection: { clips: [], track: null },
      rev: state.rev + 1,
      ui: { ...state.ui, screen: 'editor', projectPath, dirty: false, scrollX: 0 },
      history: { past: [], future: [], canUndo: false, canRedo: false, lastLabel: '' },
    }
    emit()
  },

  setUI(partial) {
    state = { ...state, ui: { ...state.ui, ...(typeof partial === 'function' ? partial(state.ui) : partial) } }
    emit()
  },

  select(clipIds, opts = {}) {
    const ids = Array.isArray(clipIds) ? clipIds : clipIds ? [clipIds] : []
    let clips = ids
    if (opts.toggle) {
      const cur = new Set(state.selection.clips)
      for (const id of ids) cur.has(id) ? cur.delete(id) : cur.add(id)
      clips = [...cur]
    } else if (opts.add) {
      clips = [...new Set([...state.selection.clips, ...ids])]
    }
    state = { ...state, selection: { ...state.selection, clips, track: opts.track ?? state.selection.track } }
    emit()
  },

  markSaved(projectPath) {
    state = { ...state, ui: { ...state.ui, dirty: false, projectPath: projectPath ?? state.ui.projectPath } }
    emit()
  },

  toast(text, kind = 'info', ms = 2600) {
    const id = Math.random().toString(36).slice(2)
    state = { ...state, toasts: [...state.toasts, { id, text, kind }] }
    emit()
    setTimeout(() => {
      state = { ...state, toasts: state.toasts.filter(t => t.id !== id) }
      emit()
    }, ms)
  },

  busy(label, progress = null) {
    state = { ...state, ui: { ...state.ui, busy: label ? { label, progress } : null } }
    emit()
  },

  openModal(type, props = {}) { store.setUI({ modal: { type, props } }) },
  closeModal() { store.setUI({ modal: null }) },
}

function sanitizeSelection(project, sel) {
  if (!sel) return { clips: [], track: null }
  const ids = new Set()
  for (const t of project.tracks) for (const c of t.clips) ids.add(c.id)
  return { ...sel, clips: (sel.clips || []).filter(id => ids.has(id)) }
}

// React kancası. selector durumdan değer seçer; eşitlik varsayılan Object.is, 'shallow' verilebilir.
export function useStore(selector = s => s, eq = Object.is) {
  const ref = useRef({ has: false, val: undefined })
  const getSnap = useCallback(() => {
    const v = selector(state)
    const r = ref.current
    if (r.has && (eq === 'shallow' ? shallowEq(r.val, v) : eq(r.val, v))) return r.val
    r.has = true
    r.val = v
    return v
  }, [selector, eq])
  return useSyncExternalStore(store.subscribe, getSnap, getSnap)
}

export function shallowEq(a, b) {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
    return true
  }
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!Object.is(a[k], b[k])) return false
  return true
}

// ------------------------------------------------------------ yardımcı sorgular

export function findClip(project, id) {
  for (const t of project.tracks) {
    const c = t.clips.find(x => x.id === id)
    if (c) return { clip: c, track: t }
  }
  return null
}

export function selectedClips(s = state) {
  const out = []
  const ids = new Set(s.selection.clips)
  if (!ids.size) return out
  for (const t of s.project.tracks) for (const c of t.clips) if (ids.has(c.id)) out.push(c)
  return out
}

export function primarySelection(s = state) {
  const id = s.selection.clips[s.selection.clips.length - 1]
  if (!id) return null
  return findClip(s.project, id)
}

if (typeof window !== 'undefined') window.__sweax = { store }
