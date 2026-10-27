// Zaman çizelgesi işlemleri — hepsi immer draft'ı (d = proje taslağı) üzerinde çalışır.
// Ana iz (main) mıknatıslıdır: klipler 0'dan başlayıp boşluksuz dizilir.

import { createTrack, createMediaClip, createAudioClip, TRACK_KINDS, uid, clipEnd } from './model.js'
import { durationFromSource, sourceTime } from './time.js'
import { shiftKeys } from './keyframes.js'

const EPS = 1e-4

export function projectDuration(p) {
  let end = 0
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, c.start + c.duration)
  return end
}

export function mainTrack(p) {
  return p.tracks.find(t => t.main) || p.tracks.find(t => t.kind === 'video')
}

export function trackOf(p, clipId) {
  return p.tracks.find(t => t.clips.some(c => c.id === clipId))
}

export function getClip(p, id) {
  for (const t of p.tracks) { const c = t.clips.find(x => x.id === id); if (c) return c }
  return null
}

export function clipsAt(p, time) {
  const out = []
  for (const t of p.tracks) for (const c of t.clips) if (time >= c.start - EPS && time < c.start + c.duration - EPS) out.push({ clip: c, track: t })
  return out
}

function sortTrack(t) { t.clips.sort((a, b) => a.start - b.start) }

export function isFree(track, start, duration, excludeIds = []) {
  const ex = new Set(excludeIds)
  const end = start + duration
  return !track.clips.some(c => !ex.has(c.id) && c.start < end - EPS && c.start + c.duration > start + EPS)
}

// Ana izi sıkıştır: sıraya göre boşluksuz diz
export function compactMain(d) {
  const m = mainTrack(d)
  if (!m) return
  sortTrack(m)
  let t = 0
  for (const c of m.clips) {
    const dt = t - c.start
    c.start = t
    t += c.duration
    void dt
  }
}

function afterMainEdit(d, ui) {
  if (!ui || ui.magnet !== false) compactMain(d)
}

// Görsel izlerin ekleneceği yer: ana izin hemen üstü. Ses: listenin sonu.
export function newTrack(d, kind, { above } = {}) {
  const t = createTrack(kind)
  if (kind === 'audio') {
    d.tracks.push(t)
  } else {
    const mi = d.tracks.findIndex(x => x.main)
    let idx = mi < 0 ? 0 : mi
    if (above != null) idx = Math.max(0, above)
    // yazı ve efekt izleri üstte dursun: eklenen görsel iz ana izin hemen üstüne
    d.tracks.splice(idx, 0, t)
  }
  return t
}

// Belirli türde, verilen aralıkta boş olan bir iz bul ya da oluştur
export function findOrCreateTrack(d, kind, start, duration) {
  const candidates = d.tracks.filter(t => t.kind === kind && !t.main && !t.locked)
  // ana ize en yakın olandan başla
  const ordered = kind === 'audio' ? candidates : candidates.slice().reverse()
  for (const t of ordered) if (isFree(t, start, duration)) return t
  if (kind === 'text' || kind === 'effect') {
    // yazı/efekt izleri en üstte açılsın
    const t = createTrack(kind)
    d.tracks.unshift(t)
    return t
  }
  return newTrack(d, kind)
}

// Klibi uygun ize yerleştir. opts: { trackId, kind, toMain, insertIndex }
export function placeClip(d, clip, opts = {}, ui) {
  if (opts.trackId) {
    const t = d.tracks.find(x => x.id === opts.trackId)
    if (t) {
      if (t.main) return insertIntoMain(d, clip, opts.time ?? clip.start, ui)
      if (isFree(t, clip.start, clip.duration)) { t.clips.push(clip); sortTrack(t); return t }
    }
  }
  const kind = opts.kind || (clip.type === 'audio' ? 'audio' : clip.type === 'text' ? 'text' : clip.type === 'sticker' ? 'sticker'
    : (clip.type === 'effect' || clip.type === 'filter' || clip.type === 'adjust') ? 'effect' : 'video')
  if (opts.toMain && kind === 'video') return insertIntoMain(d, clip, opts.time ?? clip.start, ui)
  const t = findOrCreateTrack(d, kind, clip.start, clip.duration)
  t.clips.push(clip)
  sortTrack(t)
  return t
}

// Ana ize zamana göre araya ekle (CapCut: oynatma kafasının bulunduğu klibin sonrasına)
export function insertIntoMain(d, clip, time, ui) {
  const m = mainTrack(d)
  sortTrack(m)
  let idx = m.clips.length
  for (let i = 0; i < m.clips.length; i++) {
    const c = m.clips[i]
    if (time < c.start + c.duration / 2) { idx = i; break }
  }
  clip.start = idx < m.clips.length ? m.clips[idx].start - EPS : clipEnd(m.clips[m.clips.length - 1] || { start: 0, duration: 0 })
  m.clips.splice(idx, 0, clip)
  if (ui && ui.magnet === false) {
    // mıknatıs kapalıysa: sonrakileri ittir
    let t = idx > 0 ? clipEnd(m.clips[idx - 1]) : 0
    clip.start = Math.max(t, time)
    for (let i = idx + 1; i < m.clips.length; i++) {
      const prevEnd = clipEnd(m.clips[i - 1])
      if (m.clips[i].start < prevEnd) m.clips[i].start = prevEnd
    }
  } else compactMain(d)
  return m
}

// Medya öğesini zaman çizelgesine ekle
export function addMedia(d, media, time, ui, opts = {}) {
  if (media.type === 'audio') {
    const c = createAudioClip(media, { start: time, role: opts.role || 'music' })
    placeClip(d, c, { kind: 'audio' }, ui)
    return c
  }
  const c = createMediaClip(media)
  c.start = time
  const m = mainTrack(d)
  if (opts.overlay || (m.clips.length && !opts.toMain && opts.overlay !== false && opts.preferOverlay)) {
    c.transform.scale = 0.6
    placeClip(d, c, { kind: 'video' }, ui)
  } else {
    insertIntoMain(d, c, time, ui)
  }
  return c
}

// Oynatma kafasında böl. ids verilmezse o andaki tüm (kilitsiz) klipler.
export function splitAt(d, time, ids = null, ui) {
  const created = []
  const idSet = ids && ids.length ? new Set(ids) : null
  for (const t of d.tracks) {
    if (t.locked) continue
    const add = []
    for (const c of t.clips) {
      if (idSet && !idSet.has(c.id)) continue
      if (c.locked) continue
      if (time <= c.start + 0.02 || time >= c.start + c.duration - 0.02) continue
      const local = time - c.start
      const b = JSON.parse(JSON.stringify(c))
      b.id = uid(c.type === 'audio' ? 'a' : 'c')
      b.start = time
      b.duration = c.duration - local
      if (c.in != null && !c.freeze && c.type !== 'image') {
        const st = sourceTime(c, local)
        if (c.reverse) { b.out = st; c.in = st }
        else { b.in = st; c.out = st }
        if (c.speedCurve) {
          // eğriyi iki parçaya bölmek yerine iki tarafta da sabit ortalama hız bırakmayalım: noktaları yeniden ölçekle
          const x = local / c.duration
          c.speedCurve = rescaleCurve(c.speedCurve, 0, x)
          b.speedCurve = rescaleCurve(b.speedCurve, x, 1)
        }
      } else if (c.type === 'image') {
        b.in = 0; b.out = b.duration
      }
      c.duration = local
      if (c.type === 'image') c.out = local
      // anahtar kareler: b yerel zamanı kaydır
      shiftKeys(b, -local)
      // animasyonlar: giriş ilk parçada, çıkış ikinci parçada
      if (c.anim) { b.anim = { ...b.anim, in: null }; c.anim = { ...c.anim, out: null } }
      if (c.audio) { b.audio = { ...b.audio, fadeIn: 0 }; c.audio = { ...c.audio, fadeOut: 0 } }
      // geçiş ikinci parçaya kalır (sonraki klibe), ilk parçada temizlenir
      c.transition = null
      // altyazı kelimelerini böl
      if (c.caption && c.caption.words) {
        const words = c.caption.words
        c.caption = { ...c.caption, words: words.filter(w => w.s < local) }
        b.caption = { ...b.caption, words: words.filter(w => w.s >= local).map(w => ({ ...w, s: w.s - local, e: w.e - local })) }
      }
      add.push(b)
      created.push(b.id)
    }
    t.clips.push(...add)
    sortTrack(t)
  }
  void ui
  return created
}

function rescaleCurve(curve, x0, x1) {
  if (!curve || !curve.points) return curve
  const pts = []
  const span = Math.max(1e-6, x1 - x0)
  const sample = x => {
    const p = curve.points
    if (x <= p[0].x) return p[0].y
    for (let i = 1; i < p.length; i++) if (x <= p[i].x) { const k = (x - p[i - 1].x) / Math.max(1e-6, p[i].x - p[i - 1].x); return p[i - 1].y + (p[i].y - p[i - 1].y) * k }
    return p[p.length - 1].y
  }
  for (let i = 0; i <= 8; i++) { const x = i / 8; pts.push({ x, y: sample(x0 + x * span) }) }
  return { ...curve, id: 'custom', points: pts }
}

export function deleteClips(d, ids, ui, { ripple = false } = {}) {
  const set = new Set(ids)
  let mainTouched = false
  for (const t of d.tracks) {
    if (t.locked) continue
    const before = t.clips.length
    if (ripple && !t.main) {
      // ripple: silinen aralık kadar sonrakileri kaydır
      const removed = t.clips.filter(c => set.has(c.id)).sort((a, b) => b.start - a.start)
      t.clips = t.clips.filter(c => !set.has(c.id))
      for (const r of removed) for (const c of t.clips) if (c.start >= r.start + r.duration - EPS) c.start -= r.duration
    } else {
      t.clips = t.clips.filter(c => !set.has(c.id))
    }
    if (t.main && t.clips.length !== before) mainTouched = true
  }
  if (mainTouched) afterMainEdit(d, ui)
  cleanupTracks(d)
}

// Boş ve ana olmayan izleri kaldır
export function cleanupTracks(d) {
  d.tracks = d.tracks.filter(t => t.main || t.clips.length || t.keep)
}

// Klibi taşı. targetTrackId verilmezse aynı iz. Çakışma varsa yeni iz açılır.
export function moveClips(d, moves, ui) {
  // moves: [{ id, start, trackId }]
  const touchedMain = new Set()
  const pulled = []
  for (const mv of moves) {
    const src = trackOf(d, mv.id)
    if (!src || src.locked) continue
    const c = src.clips.find(x => x.id === mv.id)
    src.clips = src.clips.filter(x => x.id !== mv.id)
    if (src.main) touchedMain.add(src.id)
    c.start = Math.max(0, mv.start)
    pulled.push({ c, mv, src })
  }
  const movingIds = pulled.map(p => p.c.id)
  for (const { c, mv, src } of pulled) {
    let target = mv.trackId ? d.tracks.find(t => t.id === mv.trackId) : src
    if (!target || target.locked) target = src
    const kindOk = TRACK_KINDS[target.kind] && TRACK_KINDS[target.kind].accepts.includes(c.type)
    if (!kindOk) target = null
    if (target && target.main) {
      insertIntoMain(d, c, c.start + c.duration / 2, ui)
      continue
    }
    if (target && isFree(target, c.start, c.duration, movingIds)) {
      target.clips.push(c)
      sortTrack(target)
    } else if (target && mv.newTrackAbove) {
      const idx = d.tracks.indexOf(target)
      const nt = createTrack(target.kind)
      d.tracks.splice(target.kind === 'audio' ? idx + 1 : idx, 0, nt)
      nt.clips.push(c)
    } else {
      placeClip(d, c, {}, ui)
    }
  }
  if (touchedMain.size) afterMainEdit(d, ui)
  cleanupTracks(d)
}

// Kenar kırpma. edge: 'start' | 'end'. newTime: zaman çizelgesindeki yeni kenar.
export function trimClip(d, id, edge, newTime, ui, media) {
  const t = trackOf(d, id)
  if (!t || t.locked) return
  const c = t.clips.find(x => x.id === id)
  const minDur = 1 / 30
  const hasSrc = (c.type === 'video' || c.type === 'audio') && !c.freeze
  const rate = hasSrc ? ((c.out - c.in) / c.duration) : 1
  const srcMax = media && media.duration ? media.duration : Infinity
  if (edge === 'start') {
    let ns = Math.min(newTime, c.start + c.duration - minDur)
    if (hasSrc) {
      const dSrc = (ns - c.start) * rate
      let nin = c.reverse ? c.in : c.in + dSrc
      let nout = c.reverse ? c.out - dSrc : c.out
      if (!c.reverse && nin < 0) { ns -= nin / rate; nin = 0 }
      if (c.reverse && nout > srcMax) { ns -= (nout - srcMax) / rate; nout = srcMax }
      c.in = nin; c.out = nout
    }
    if (!t.main) {
      // komşuyla çakışmasın
      const prev = t.clips.filter(x => x.id !== id && x.start + x.duration <= c.start + EPS).pop()
      if (prev) ns = Math.max(ns, prev.start + prev.duration)
    }
    ns = Math.max(0, ns)
    const delta = ns - c.start
    c.duration -= delta
    if (t.main && ui && ui.magnet !== false) {
      // mıknatısta başlangıç sabit kalır, süre değişir
    } else c.start = ns
    shiftKeys(c, -delta)
  } else {
    let ne = Math.max(newTime, c.start + minDur)
    if (hasSrc) {
      let nout = c.reverse ? c.out : c.in + (ne - c.start) * rate
      let nin = c.reverse ? c.out - (ne - c.start) * rate : c.in
      if (!c.reverse && nout > srcMax) { ne = c.start + (srcMax - c.in) / rate; nout = srcMax }
      if (c.reverse && nin < 0) { ne = c.start + c.out / rate; nin = 0 }
      c.in = nin; c.out = nout
    }
    if (!t.main) {
      const next = t.clips.find(x => x.id !== id && x.start >= c.start + c.duration - EPS)
      if (next) ne = Math.min(ne, next.start)
    }
    c.duration = Math.max(minDur, ne - c.start)
    if (c.type === 'image') c.out = c.duration
  }
  if (t.main) afterMainEdit(d, ui)
}

export function setClipSpeed(d, id, speed, curve, ui) {
  const t = trackOf(d, id)
  const c = t && t.clips.find(x => x.id === id)
  if (!c || (c.type !== 'video' && c.type !== 'audio')) return
  const oldDur = c.duration
  c.speed = Math.max(0.05, Math.min(100, speed))
  c.speedCurve = curve || null
  const nd = durationFromSource(c)
  // anahtar kareleri oransal ölçekle
  if (c.keyframes) {
    const k = nd / oldDur
    for (const p of Object.keys(c.keyframes)) c.keyframes[p] = c.keyframes[p].map(x => ({ ...x, t: x.t * k }))
  }
  c.duration = nd
  if (!t.main) {
    const next = t.clips.find(x => x.id !== id && x.start >= c.start + oldDur - EPS)
    if (next && c.start + nd > next.start + EPS) {
      // sığmıyorsa sonrakileri it
      const push = c.start + nd - next.start
      for (const x of t.clips) if (x.id !== id && x.start >= c.start + oldDur - EPS) x.start += push
    }
  }
  if (t.main) afterMainEdit(d, ui)
}

export function duplicateClips(d, ids, ui) {
  const out = []
  for (const id of ids) {
    const t = trackOf(d, id)
    if (!t) continue
    const c = t.clips.find(x => x.id === id)
    const n = JSON.parse(JSON.stringify(c))
    n.id = uid(c.type === 'audio' ? 'a' : 'c')
    n.start = c.start + c.duration
    if (t.main) {
      const idx = t.clips.indexOf(c)
      t.clips.splice(idx + 1, 0, n)
      afterMainEdit(d, ui)
    } else if (isFree(t, n.start, n.duration)) {
      t.clips.push(n); sortTrack(t)
    } else placeClip(d, n, {}, ui)
    out.push(n.id)
  }
  return out
}

// Kare dondur: oynatma kafasındaki kareyi 3 sn'lik dondurulmuş klip olarak araya koy
export function freezeFrame(d, id, time, ui, holdSec = 3) {
  const t = trackOf(d, id)
  const c = t && t.clips.find(x => x.id === id)
  if (!c || c.type !== 'video') return null
  const local = time - c.start
  const st = sourceTime(c, local)
  const created = splitAt(d, time, [id], ui)
  const f = JSON.parse(JSON.stringify(c))
  f.id = uid('c')
  f.freeze = true
  f.in = st; f.out = st + 0.001
  f.speed = 1; f.speedCurve = null
  f.start = time
  f.duration = holdSec
  f.keyframes = {}
  f.anim = { in: null, out: null, loop: null }
  f.transition = null
  f.audio = { ...f.audio, muted: true }
  f.name = (c.name || '') + ' · dondur'
  const after = created[0] ? t.clips.find(x => x.id === created[0]) : null
  // sonrakileri kaydır
  for (const x of t.clips) if (x.start >= time - EPS && x.id !== f.id) x.start += holdSec
  t.clips.push(f)
  sortTrack(t)
  if (t.main) afterMainEdit(d, ui)
  void after
  return f.id
}

// Video klibin sesini ayrı ses klibine çıkar
export function detachAudio(d, id, ui) {
  const t = trackOf(d, id)
  const c = t && t.clips.find(x => x.id === id)
  if (!c || c.type !== 'video') return null
  const media = d.media[c.mediaId]
  if (!media || !media.hasAudio) return null
  const a = createAudioClip(media, {
    start: c.start, duration: c.duration, in: c.in, out: c.out, speed: c.speed, reverse: c.reverse,
    audio: { ...c.audio, muted: false }, role: 'extracted', name: (c.name || media.name) + ' · ses',
  })
  if (c.speedCurve) a.speedCurve = c.speedCurve
  if (c.keyframes && c.keyframes['audio.volume']) a.keyframes = { 'audio.volume': c.keyframes['audio.volume'] }
  c.audio = { ...c.audio, muted: true, detached: a.id }
  placeClip(d, a, { kind: 'audio' }, ui)
  return a.id
}

// Q / W: oynatma kafasının solunu / sağını sil (ripple)
export function trimToPlayhead(d, time, side, ids, ui) {
  const targets = []
  for (const t of d.tracks) for (const c of t.clips) {
    if (ids && ids.length && !ids.includes(c.id)) continue
    if (time > c.start + 0.02 && time < c.start + c.duration - 0.02) targets.push(c.id)
  }
  for (const id of targets) trimClip(d, id, side === 'left' ? 'start' : 'end', time, ui, d.media[getClip(d, id).mediaId])
  return targets
}

// Yapıştır: kopyalanan klipleri zaman kaydırarak ekle
export function pasteClips(d, clips, time, ui) {
  if (!clips.length) return []
  const minStart = Math.min(...clips.map(c => c.start))
  const out = []
  for (const src of clips) {
    const n = JSON.parse(JSON.stringify(src))
    n.id = uid(src.type === 'audio' ? 'a' : 'c')
    n.start = time + (src.start - minStart)
    placeClip(d, n, { toMain: false }, ui)
    out.push(n.id)
  }
  return out
}

// Yakalama noktaları: klip kenarları, işaretler, oynatma kafası, vuruşlar
export function snapPoints(p, excludeIds = [], extra = []) {
  const ex = new Set(excludeIds)
  const pts = [0, ...extra]
  for (const t of p.tracks) for (const c of t.clips) {
    if (ex.has(c.id)) continue
    pts.push(c.start, c.start + c.duration)
    if (c.type === 'audio' && c.beats) for (const b of c.beats) {
      const lt = (b - c.in) / Math.max(1e-6, (c.out - c.in) / c.duration)
      if (lt >= 0 && lt <= c.duration) pts.push(c.start + lt)
    }
  }
  for (const m of p.markers || []) pts.push(m.time)
  return pts
}

export function snapTime(t, points, threshold) {
  let best = t, bd = threshold
  for (const p of points) {
    const dd = Math.abs(p - t)
    if (dd < bd) { bd = dd; best = p }
  }
  return { time: best, snapped: best !== t }
}

// Ana izde ardışık iki klip arasında geçiş penceresi
export function transitionWindow(track, clip) {
  if (!clip.transition || !clip.transition.id) return null
  const i = track.clips.indexOf(clip)
  const next = track.clips[i + 1]
  if (!next) return null
  if (Math.abs(next.start - (clip.start + clip.duration)) > 0.05) return null
  const dur = Math.min(clip.transition.duration || 0.5, clip.duration, next.duration)
  const cut = clip.start + clip.duration
  return { from: clip, to: next, start: cut - dur / 2, end: cut + dur / 2, duration: dur, cut }
}
