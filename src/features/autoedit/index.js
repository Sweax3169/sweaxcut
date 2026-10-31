// Otomatik kurgu: bırakılan kliplerden tek tıkla hazır kurgu (tarifler) ve mevcut kurguyu "Güzelleştir".
// Önce analiz (müzik vuruşu, öne çıkan anlar, sessizlik) yapılır, sonra zaman çizelgesi TEK bir geri alınabilir
// düzenlemeyle baştan kurulur. Tarifler veri gibi okunur: her biri müzik, renk, geçiş, zoom ve altyazı kararını verir.

import { store } from '../../core/store.js'
import * as TL from '../../core/timeline.js'
import { createMediaClip, createAudioClip, createTextClip, uid } from '../../core/model.js'
import { upsertKey } from '../../core/keyframes.js'
import { get as regGet } from '../../engine/registry.js'

export const RECIPES = [
  {
    id: 'beat', name: 'Ritimli montaj', icon: 'beat',
    desc: 'Müziğin vuruşunda keser; geçiş, zoom ve renk ekler.',
    music: 'montaj-atesi', filter: 'canli', transition: 'zum-darbe-ici', length: 30, beatsPerCut: 'auto',
  },
  {
    id: 'talk', name: 'Konuşma + altyazı', icon: 'caption',
    desc: 'Sessizlikleri atar, kelime kelime altyazı ve vurgu zoomu ekler.',
    music: 'lofi-gece-yarisi', musicVolume: 0.1, captions: true, captionStyle: 'alt-hormozi', silence: true, jumpZoom: true,
  },
  {
    id: 'game', name: 'Oyun anları', icon: 'game',
    desc: 'En hareketli anları bulur; zoom, flaş ve müzikle diziler.',
    music: 'montaj-atesi', musicVolume: 0.32, filter: 'battle-royale', transition: 'beyaz-flas', highlights: true, length: 40,
  },
  {
    id: 'vlog', name: 'Vlog', icon: 'film',
    desc: 'Klipleri sırayla dizer; yumuşak geçiş, sıcak renk, hafif müzik.',
    music: 'gune-basla', musicVolume: 0.28, filter: 'altin-saat', transition: 'yumusak-karisim', length: 60, title: true,
  },
  {
    id: 'slides', name: 'Fotoğraf slaytı', icon: 'image',
    desc: 'Fotoğrafları müziğe göre yavaş zoom ve kaymayla canlandırır.',
    music: 'kafe-kosesi', filter: 'yaz-filmi', transition: 'gl-fade', length: 40, kenBurns: true,
  },
  {
    id: 'recap', name: 'Kısa özet', icon: 'bolt',
    desc: 'Uzun videodan 30 saniyelik hızlı bir özet çıkarır.',
    music: 'kovalamaca', musicVolume: 0.45, filter: 'vurucu', transition: 'kirbac-sol', length: 30, highlights: true,
  },
]

export function recipe(id) { return RECIPES.find(r => r.id === id) || null }

const r3 = x => Math.round(x * 1000) / 1000
const P = () => store.get().project
const isAbort = e => e && e.name === 'AbortError'
function check(signal) { if (signal && signal.aborted) throw new DOMException('iptal', 'AbortError') }

// ---------------------------------------------------------------- müzik
// Paket müziği dosyaya çizilir ve projeye medya olarak alınır (vuruş ızgarası bpm'den kesin bilinir)
async function musicMedia(musicId) {
  if (!musicId || musicId === 'none') return null
  const pm = P().media[musicId]
  if (pm && pm.type === 'audio') return { mediaId: musicId, def: null }
  const def = regGet('music', musicId)
  if (!def) return null
  const [{ audioDefToFile }, { importFiles }] = await Promise.all([import('../../ui/library/insert.js'), import('../../core/media.js')])
  const file = await audioDefToFile(def, 'music')
  const ids = await importFiles([file], { role: 'music', generated: true, name: def.name })
  if (!ids[0]) return null
  store.edit('medya', d => { if (d.media[ids[0]]) { d.media[ids[0]].name = def.name; d.media[ids[0]].generated = true } }, { noHistory: true })
  return { mediaId: ids[0], def }
}

async function musicBeats(mm) {
  if (!mm) return null
  const media = P().media[mm.mediaId]
  const dur = (mm.def && mm.def.duration) || (media && media.duration) || 30
  if (mm.def && mm.def.bpm) {
    const step = 60 / mm.def.bpm
    const beats = []
    for (let t = 0; t < dur - 0.05; t += step) beats.push(r3(t))
    return { bpm: mm.def.bpm, beats, duration: dur, perBar: 4 }
  }
  try {
    const A = await import('../audio/index.js')
    const r = await A.detectBeats(media.audioPath || media.path)
    if (r && r.beats && r.beats.length > 8) return { bpm: r.bpm, beats: r.beats, duration: dur, perBar: 4 }
  } catch (e) { /* vuruş bulunamadı: sabit ızgara */ }
  const beats = []
  for (let t = 0; t < dur; t += 0.5) beats.push(r3(t))
  return { bpm: 120, beats, duration: dur, perBar: 4 }
}

// ---------------------------------------------------------------- öne çıkan anlar
async function highlightsOf(media, count, onProgress) {
  if (!media || media.type !== 'video' || !media.hasAudio) return []
  try {
    const A = await import('../audio/index.js')
    const hs = await A.detectHighlights(media.audioPath || media.path, { count, minGap: Math.max(3, Math.min(8, (media.duration || 30) / (count + 1))) })
    onProgress && onProgress()
    return (hs || []).map(h => h.time).filter(t => Number.isFinite(t))
  } catch (e) { return [] }
}

// Uzun videodan eşit aralıklı pencereler (sonuna kadar yayılır)
function spreadWindows(dur, n, len) {
  const out = []
  if (dur <= len) return [{ a: 0, b: dur }]
  for (let i = 0; i < n; i++) {
    const c = (dur - len) * (n === 1 ? 0.5 : i / (n - 1))
    out.push({ a: r3(c), b: r3(c + len) })
  }
  return out
}

// ---------------------------------------------------------------- yardımcılar (taslak üzerinde)
function setTransition(c, id, dur) {
  const def = id && regGet('transitions', id)
  if (!def) return
  c.transition = { id: def.id, duration: Math.min(dur ?? (def.duration || 0.5), c.duration * 0.45), params: {} }
}
function setFilter(c, id, intensity = 0.85) {
  if (id && regGet('filters', id)) c.filter = { id, intensity }
}
function punch(c, lt, amount = 1.14, dur = 0.32) {
  if (lt < 0.02 || lt > c.duration - 0.08) return
  const base = c.transform.scale || 1
  upsertKey(c, 'transform.scale', Math.max(0, lt - 1 / 60), base, 'easeInOut')
  upsertKey(c, 'transform.scale', Math.min(c.duration, lt + 0.07), base * amount, 'cubicOut')
  upsertKey(c, 'transform.scale', Math.min(c.duration, lt + dur), base, 'sineInOut')
}
function kenBurns(c, i) {
  const s0 = i % 2 ? 1.14 : 1.0, s1 = i % 2 ? 1.0 : 1.14
  const dx = ((i % 3) - 1) * 0.025
  upsertKey(c, 'transform.scale', 0, s0, 'linear')
  upsertKey(c, 'transform.scale', c.duration, s1, 'linear')
  if (dx) { upsertKey(c, 'transform.x', 0, -dx, 'linear'); upsertKey(c, 'transform.x', c.duration, dx, 'linear') }
}
function videoClip(media, a, b, start) {
  const c = createMediaClip(media)
  c.in = r3(a); c.out = r3(b); c.duration = r3(b - a); c.start = r3(start)
  c.fit = 'cover'
  return c
}
function imageClip(media, dur, start) {
  const c = createMediaClip(media, { duration: dur })
  c.duration = r3(dur); c.out = r3(dur); c.start = r3(start)
  c.fit = 'cover'
  return c
}
function addMusicClips(d, mm, total, { volume = 0.8, fadeOut = 1.5 } = {}) {
  if (!mm) return
  const media = d.media[mm.mediaId]
  if (!media) return
  const tr = TL.newTrack(d, 'audio')
  tr.name = 'Müzik'
  const len = Math.max(1, media.duration || 30)
  let t = 0
  while (t < total - 0.05) {
    const dur = Math.min(len, total - t)
    const c = createAudioClip(media, { start: r3(t), duration: r3(dur), in: 0, out: r3(dur), role: 'music' })
    c.audio.volume = volume
    if (t + dur >= total - 0.05) c.audio.fadeOut = Math.min(fadeOut, dur * 0.4)
    if (t === 0) c.audio.fadeIn = 0.15
    tr.clips.push(c)
    t += dur
  }
}
function clearTimeline(d) {
  d.tracks = d.tracks.filter(t => t.main)
  if (!d.tracks.length) d.tracks = [{ id: uid('t'), kind: 'video', name: 'Ana', main: true, hidden: false, muted: false, locked: false, clips: [] }]
  d.tracks[0].clips = []
}
function titleClip(d, text, dur) {
  const c = createTextClip({ start: 0.2, duration: Math.max(1.5, dur) })
  c.name = 'Başlık'
  c.text.content = text
  c.text.font = 'Montserrat'
  c.text.weight = 800
  c.text.size = 110
  c.text.stroke = { enabled: false, color: '#000000', width: 0 }
  c.text.shadow = { enabled: true, color: '#000000', blur: 24, x: 0, y: 8, opacity: 0.55 }
  c.transform.y = -0.05
  c.anim = { in: regGet('clipAnims', 'giris-yuksel') ? { id: 'giris-yuksel', duration: 0.6 } : null, out: regGet('clipAnims', 'cikis-belir') ? { id: 'cikis-belir', duration: 0.5 } : null, loop: null }
  const t = TL.findOrCreateTrack(d, 'text', c.start, c.duration)
  t.clips.push(c)
}

// ---------------------------------------------------------------- tarifler: plan → taslak
function visualMedia(ids) {
  const p = P()
  return (ids || Object.keys(p.media)).map(id => p.media[id]).filter(m => m && (m.type === 'video' || m.type === 'image') && m.status !== 'error')
}

// Ritim: kesim başına vuruş sayısı (segment ~0.45–1.1 sn)
function beatsPerCut(bpm) {
  const beat = 60 / bpm
  if (beat * 2 <= 1.1 && beat * 2 >= 0.45) return 2
  if (beat >= 0.45) return 1
  return 4
}

// Ritimli montaj / kısa özet / oyun anları ortak ızgara planı: vuruşlara oturan segmentler
async function planBeatCut(R, medias, mm, beatInfo, opts, onProgress) {
  const target = Math.min(opts.length || R.length || 30, beatInfo ? beatInfo.duration : 60)
  const beats = beatInfo ? beatInfo.beats : null
  const per = R.beatsPerCut === 'auto' || !R.beatsPerCut ? (beatInfo ? beatsPerCut(beatInfo.bpm) : 2) : R.beatsPerCut
  // kesim anları
  const cuts = []
  if (beats && beats.length) {
    for (let i = 0; i < beats.length; i += per) { if (beats[i] > target + 0.01) break; cuts.push(beats[i]) }
    if (cuts[cuts.length - 1] < target - 0.2) cuts.push(target)
  } else {
    for (let t = 0; t < target; t += 0.8) cuts.push(r3(t))
    cuts.push(target)
  }
  if (cuts[0] > 0.01) cuts.unshift(0)
  const segLens = []
  for (let i = 1; i < cuts.length; i++) segLens.push(cuts[i] - cuts[i - 1])
  // her video için aday pencereler: öne çıkan anların çevresi, yoksa eşit aralık
  const pools = []
  let done = 0
  for (const m of medias) {
    if (m.type === 'image') { pools.push({ m, wins: [{ a: 0, b: 999, img: true }], k: 0 }); continue }
    const want = Math.max(1, Math.ceil(segLens.length / medias.length) + 1)
    let wins = []
    if (R.highlights) {
      const hs = await highlightsOf(m, Math.min(16, want), null)
      wins = hs.map(h => ({ a: Math.max(0, h - 0.9), b: Math.min(m.duration, h + 1.6), peak: h }))
    }
    if (!wins.length) wins = spreadWindows(m.duration || 3, want, Math.min(m.duration || 3, 2.4))
    pools.push({ m, wins, k: 0 })
    done++
    onProgress && onProgress(0.15 + 0.45 * (done / medias.length))
  }
  // segmentleri sırayla havuzlardan doldur; videolar kaynak sırasını korur
  const plan = []
  let pi = 0
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i]
    let pool = null
    for (let tries = 0; tries < pools.length; tries++) {
      const cand = pools[(pi + tries) % pools.length]
      if (cand.m.type === 'image' || cand.k < cand.wins.length * 3) { pool = cand; pi = (pi + tries + 1) % pools.length; break }
    }
    if (!pool) break
    if (pool.m.type === 'image') { plan.push({ m: pool.m, len, img: true }); continue }
    const w = pool.wins[pool.k % pool.wins.length]
    const round = Math.floor(pool.k / pool.wins.length)
    pool.k++
    const dur = pool.m.duration || 3
    // pencerenin içinde ilerleyen başlangıç (aynı pencere tekrar gelirse biraz ileriden)
    let a = w.peak != null ? w.peak - Math.min(len * 0.45, 0.6) : w.a
    a += round * len
    a = Math.max(0, Math.min(dur - len, a))
    if (dur < len) { plan.push({ m: pool.m, a: 0, b: dur, len: dur, peak: null }); continue }
    plan.push({ m: pool.m, a, b: a + len, len, peak: w.peak != null && w.peak >= a && w.peak <= a + len ? w.peak - a : null })
  }
  return { plan, target, per }
}

function buildBeat(d, R, plan, mm, beatInfo, opts) {
  clearTimeline(d)
  const main = TL.mainTrack(d)
  let t = 0
  const perBar = (beatInfo && beatInfo.perBar) || 4
  plan.forEach((s, i) => {
    const media = d.media[s.m.id]
    const c = s.img ? imageClip(media, s.len, t) : videoClip(media, s.a, s.b, t)
    if (!s.img) c.audio.volume = R.id === 'game' ? 0.9 : (mm ? 0 : 1)
    if (s.img) kenBurns(c, i)
    setFilter(c, opts.filter ?? R.filter)
    // her ölçü başında vurucu geçiş, aralarda kesme; ilk segmentte giriş
    // vurucu geçiş iki ölçüde bir (her kesimde olursa yorar); aralar düz kesme
    const barEdge = beatInfo ? Math.round((t + c.duration) / (60 / beatInfo.bpm)) % (perBar * 2) === 0 : i % 6 === 5
    if (i < plan.length - 1 && (barEdge || R.id === 'game')) setTransition(c, opts.transition ?? R.transition, R.id === 'game' ? 0.3 : 0.28)
    // vurgu zoomu: tepede (oyun) ya da ölçü başında
    if (s.peak != null) punch(c, s.peak, 1.18, 0.4)
    else if (!s.img && i % 2 === 0) punch(c, 0.03, 1.1, 0.26)
    main.clips.push(c)
    t += c.duration
  })
  if (main.clips[0]) main.clips[0].anim = { in: regGet('clipAnims', 'giris-zum-bulanik') ? { id: 'giris-zum-bulanik', duration: 0.4 } : null, out: null, loop: null }
  const last = main.clips[main.clips.length - 1]
  if (last) last.anim = { ...(last.anim || {}), out: regGet('clipAnims', 'cikis-belir') ? { id: 'cikis-belir', duration: Math.min(0.8, last.duration * 0.5) } : null }
  TL.compactMain(d)
  const total = main.clips.reduce((a, c) => Math.max(a, c.start + c.duration), 0)
  addMusicClips(d, mm, total, { volume: R.musicVolume ?? 0.9 })
  return total
}

// Konuşma: klipler sırayla; sessizlikler sonra (analiz sonucu) kesilir
function buildTalk(d, R, medias, mm, opts) {
  clearTimeline(d)
  const main = TL.mainTrack(d)
  let t = 0
  for (const m of medias) {
    const media = d.media[m.id]
    const c = m.type === 'image' ? imageClip(media, 3, t) : videoClip(media, 0, media.duration || 3, t)
    if (c.type === 'video') { c.audio.normalize = true; c.audio.enhance = true; c.audio.duck = true }
    setFilter(c, opts.filter ?? R.filter, 0.6)
    main.clips.push(c)
    t += c.duration
  }
  TL.compactMain(d)
  return t
}

function buildVlog(d, R, medias, mm, opts) {
  clearTimeline(d)
  const main = TL.mainTrack(d)
  const target = opts.length || R.length || 60
  const vids = medias.filter(m => m.type === 'video')
  const totalSrc = vids.reduce((a, m) => a + (m.duration || 0), 0) + medias.filter(m => m.type === 'image').length * 3
  const k = totalSrc > target ? target / totalSrc : 1
  let t = 0
  medias.forEach((m, i) => {
    const media = d.media[m.id]
    let c
    if (m.type === 'image') { c = imageClip(media, 3, t); kenBurns(c, i) } else {
      const dur = media.duration || 3
      const len = Math.max(1.5, Math.min(dur, dur * k))
      const a = Math.max(0, (dur - len) * 0.4)
      c = videoClip(media, a, a + len, t)
      c.audio.volume = mm ? 0.85 : 1
      c.audio.duck = true
    }
    setFilter(c, opts.filter ?? R.filter, 0.7)
    if (i < medias.length - 1) setTransition(c, opts.transition ?? R.transition, 0.5)
    main.clips.push(c)
    t += c.duration
  })
  TL.compactMain(d)
  const total = main.clips.reduce((a, c) => Math.max(a, c.start + c.duration), 0)
  if (R.title && opts.title !== false) titleClip(d, opts.titleText || new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }), Math.min(3, total * 0.4))
  addMusicClips(d, mm, total, { volume: R.musicVolume ?? 0.3 })
  return total
}

function buildSlides(d, R, medias, mm, beatInfo, opts) {
  clearTimeline(d)
  const main = TL.mainTrack(d)
  const bar = beatInfo ? (60 / beatInfo.bpm) * 4 : 2.5
  const slot = bar < 1.6 ? bar * 2 : bar
  let t = 0
  medias.forEach((m, i) => {
    const media = d.media[m.id]
    let c
    if (m.type === 'image') c = imageClip(media, slot, t)
    else { const dur = media.duration || 3; const len = Math.min(dur, slot); const a = Math.max(0, (dur - len) / 2); c = videoClip(media, a, a + len, t); c.audio.volume = 0 }
    kenBurns(c, i)
    setFilter(c, opts.filter ?? R.filter, 0.7)
    if (i < medias.length - 1) setTransition(c, opts.transition ?? R.transition, Math.min(0.8, slot * 0.3))
    main.clips.push(c)
    t += c.duration
  })
  TL.compactMain(d)
  const total = main.clips.reduce((a, c) => Math.max(a, c.start + c.duration), 0)
  addMusicClips(d, mm, total, { volume: 0.85, fadeOut: 2.5 })
  return total
}

// ---------------------------------------------------------------- giriş noktası
/**
 * runRecipe(id, opts) → { clips, duration }
 * opts: mediaIds (vars. projedeki bütün görsel medya), music (paket müzik id | medya id | 'none'), filter, transition,
 *       length (hedef sn), captions (bool), captionStyle, language, onProgress(0..1, etiket), signal
 */
export async function runRecipe(id, opts = {}) {
  const R = recipe(id)
  if (!R) throw new Error('Tarif bulunamadı')
  const onProgress = (p, label) => opts.onProgress && opts.onProgress(Math.max(0, Math.min(1, p)), label)
  const signal = opts.signal
  let medias = visualMedia(opts.mediaIds)
  if (!medias.length) throw new Error('Önce video ya da fotoğraf ekle')
  if (R.id === 'slides') medias = [...medias.filter(m => m.type === 'image'), ...medias.filter(m => m.type !== 'image')]
  onProgress(0.03, 'Müzik hazırlanıyor…')
  const musicId = opts.music !== undefined ? opts.music : R.music
  let mm = null
  try { mm = await musicMedia(musicId) } catch (e) { mm = null }
  check(signal)
  const beatInfo = await musicBeats(mm)
  check(signal)
  onProgress(0.12, R.highlights ? 'Öne çıkan anlar aranıyor…' : 'Klipler diziliyor…')
  let total = 0
  if (R.id === 'beat' || R.id === 'game' || R.id === 'recap') {
    const { plan } = await planBeatCut(R, medias, mm, beatInfo, opts, p => onProgress(p, 'Öne çıkan anlar aranıyor…'))
    check(signal)
    if (!plan.length) throw new Error('Kesilecek uygun bölüm bulunamadı')
    store.edit('Otomatik kurgu: ' + R.name, d => { total = buildBeat(d, R, plan, mm, beatInfo, opts) })
  } else if (R.id === 'talk') {
    store.edit('Otomatik kurgu: ' + R.name, d => { total = buildTalk(d, R, medias, mm, opts) })
  } else if (R.id === 'vlog') {
    store.edit('Otomatik kurgu: ' + R.name, d => { total = buildVlog(d, R, medias, mm, opts) })
  } else if (R.id === 'slides') {
    store.edit('Otomatik kurgu: ' + R.name, d => { total = buildSlides(d, R, medias, mm, beatInfo, opts) })
  }
  check(signal)
  // konuşma: sessizlik kes, sıçrama zoomu, sonra müzik (kesimden sonraki uzunluğa göre)
  if (R.silence && opts.silence !== false) {
    onProgress(0.5, 'Sessizlikler kesiliyor…')
    total = await cutSilences(signal)
  }
  if (R.jumpZoom && opts.jumpZoom !== false) jumpZoom()
  if (R.id === 'talk') {
    total = TL.projectDuration(P())
    store.edit('Arka plan müziği', d => addMusicClips(d, mm, total, { volume: R.musicVolume ?? 0.1, fadeOut: 2 }))
  }
  // altyazı
  const wantCaps = opts.captions ?? !!R.captions
  let capMsg = null
  if (wantCaps) {
    onProgress(0.62, 'Altyazı oluşturuluyor…')
    capMsg = await autoCaptions({ styleId: opts.captionStyle || R.captionStyle || 'alt-hormozi', language: opts.language || 'tr', signal, onProgress: p => onProgress(0.62 + p * 0.36, 'Altyazı oluşturuluyor…') })
  }
  onProgress(1, 'Hazır')
  const { playback } = await import('../../engine/playback.js')
  playback.seek(0)
  store.select([])
  return { duration: TL.projectDuration(P()), captions: capMsg }
}

// ---------------------------------------------------------------- ortak adımlar (Güzelleştir ile paylaşılır)
async function cutSilences(signal) {
  const T = await import('../../ui/library/tools.js')
  const ids = (TL.mainTrack(P()).clips || []).filter(c => c.type === 'video').map(c => c.id)
  for (const id of ids) {
    check(signal)
    const c = TL.getClip(P(), id)
    if (!c) continue
    const m = P().media[c.mediaId]
    if (!m || !m.hasAudio) continue
    try {
      const r = await T.analyzeSilences(c, { threshold: -38, minDur: 0.5, pad: 0.12 })
      if (r.cuts.length) T.applyCuts(c.id, r.cuts, 'Sessizlikleri kes')
    } catch (e) { if (isAbort(e)) throw e }
  }
  return TL.projectDuration(P())
}

// Konuşma kesimlerinde sırayla %0 / %12 yakın plan (sıçrama zoomu)
function jumpZoom() {
  store.edit('Sıçrama zoomu', d => {
    const main = TL.mainTrack(d)
    main.clips.forEach((c, i) => { if (c.type === 'video' && c.duration > 0.6) c.transform.scale = i % 2 ? 1.12 : 1 })
  })
}

export async function autoCaptions({ styleId, language = 'tr', model, signal, onProgress } = {}) {
  const C = await import('../../ui/library/captions-run.js')
  const list = await C.modelList()
  let pick = model
  if (!pick) {
    const inst = []
    for (const m of list) if (await C.modelInstalled(m.id)) inst.push(m)
    const pref = ['medium', 'small', 'large-v3-turbo', 'base', 'tiny']
    pick = (pref.map(p => inst.find(m => m.id === p)).find(Boolean) || inst[0] || list.find(m => m.default) || list[0] || {}).id
  }
  const { captionJob } = await import('../../ui/library/jobs.js')
  const off = captionJob.sub(j => { if (j.running && onProgress) onProgress(j.progress || 0) })
  try {
    await C.runCaptions({ source: 'main', language, model: pick, styleId, maxWords: 3, uppercase: true, emoji: false, highlightKeywords: true, markFillers: false })
  } finally { off() }
  const j = captionJob.get()
  return j.error || j.done || null
}

// ---------------------------------------------------------------- Güzelleştir (mevcut kurgu)
export const POLISH_STEPS = [
  { id: 'silence', name: 'Sessizlikleri kes', desc: 'Konuşmadaki boşlukları atar', icon: 'silence', def: false },
  { id: 'audio', name: 'Sesi netleştir ve dengele', desc: 'Gürültü azaltma, netlik, yükseklik eşitleme', icon: 'volume', def: true },
  { id: 'color', name: 'Rengi iyileştir', desc: 'Hafif kontrast ve canlılık', icon: 'palette', def: true },
  { id: 'transitions', name: 'Kesimlere geçiş', desc: 'Yumuşak karışım, 0,35 sn', icon: 'transition', def: true },
  { id: 'zoom', name: 'Vurgu zoomu', desc: 'Sesin yükseldiği anlarda yakınlaşır', icon: 'zoomIn', def: false },
  { id: 'captions', name: 'Otomatik altyazı', desc: 'Konuşmayı kelime kelime yazar', icon: 'caption', def: false },
  { id: 'music', name: 'Arka plan müziği', desc: 'Konuşmada kendiliğinden kısılır', icon: 'music', def: false },
  { id: 'fade', name: 'Giriş ve bitiş', desc: 'Başta belirme, sonda kararma', icon: 'film', def: true },
]

export async function polish(steps, opts = {}) {
  const on = new Set(steps)
  const signal = opts.signal
  const say = (p, l) => opts.onProgress && opts.onProgress(p, l)
  const main = TL.mainTrack(P())
  if (!main || !main.clips.length) throw new Error('Zaman çizelgesi boş')
  if (on.has('silence')) { say(0.05, 'Sessizlikler kesiliyor…'); await cutSilences(signal) }
  check(signal)
  store.edit('Güzelleştir', d => {
    const m = TL.mainTrack(d)
    m.clips.forEach((c, i) => {
      if (on.has('audio') && c.type === 'video') { c.audio.denoise = Math.max(c.audio.denoise || 0, 35); c.audio.enhance = true; c.audio.normalize = true; c.audio.duck = true }
      if (on.has('color') && (c.type === 'video' || c.type === 'image')) {
        c.adjust.contrast = Math.max(c.adjust.contrast, 8); c.adjust.vibrance = Math.max(c.adjust.vibrance, 14); c.adjust.sharpen = Math.max(c.adjust.sharpen, 6)
      }
      if (on.has('transitions') && i < m.clips.length - 1 && !c.transition) setTransition(c, 'yumusak-karisim', 0.35)
    })
    if (on.has('fade') && m.clips.length) {
      const f = m.clips[0], l = m.clips[m.clips.length - 1]
      if (!f.anim.in && regGet('clipAnims', 'giris-belir')) f.anim = { ...f.anim, in: { id: 'giris-belir', duration: Math.min(0.5, f.duration * 0.3) } }
      if (!l.anim.out && regGet('clipAnims', 'cikis-belir')) l.anim = { ...l.anim, out: { id: 'cikis-belir', duration: Math.min(0.8, l.duration * 0.4) } }
    }
    for (const t of d.tracks) if (t.kind === 'audio') for (const c of t.clips) if (on.has('audio') && c.role === 'voice') { c.audio.enhance = true; c.audio.normalize = true; c.audio.duck = true }
  })
  check(signal)
  if (on.has('zoom')) {
    say(0.35, 'Vurgu anları aranıyor…')
    const V = await import('../video/autozoom.js')
    for (const c of TL.mainTrack(P()).clips.filter(x => x.type === 'video').slice(0, 30)) {
      check(signal)
      try { await V.autoZoomFromHighlights(c.id, { count: Math.max(1, Math.round(c.duration / 6)), amount: 1.15, duration: 0.4 }) } catch (e) { if (isAbort(e)) throw e }
    }
  }
  if (on.has('music')) {
    say(0.5, 'Müzik ekleniyor…')
    const mm = await musicMedia(opts.music || 'lofi-gece-yarisi')
    const total = TL.projectDuration(P())
    store.edit('Arka plan müziği', d => addMusicClips(d, mm, total, { volume: 0.12, fadeOut: 2 }))
  }
  let capMsg = null
  if (on.has('captions')) {
    say(0.6, 'Altyazı oluşturuluyor…')
    capMsg = await autoCaptions({ styleId: opts.captionStyle || 'alt-hormozi', language: opts.language || 'tr', signal, onProgress: p => say(0.6 + p * 0.38, 'Altyazı oluşturuluyor…') })
  }
  say(1, 'Hazır')
  return { captions: capMsg }
}

// ---------------------------------------------------------------- görünüm paketleri (tek tıkla tutarlı stil)
// Renk + geçiş + altyazı stilini birlikte uygular; her biri bir duygu.
export const LOOKS = [
  { id: 'sinematik', name: 'Sinematik', filter: 'gise-filmi', transition: 'gl-fade', caption: 'alt-sinema' },
  { id: 'enerjik', name: 'Enerjik', filter: 'vurucu', transition: 'zum-darbe-ici', caption: 'alt-hormozi' },
  { id: 'sade', name: 'Sade', filter: 'dogal-isik', transition: 'yumusak-karisim', caption: 'alt-minimal' },
  { id: 'oyun', name: 'Oyun', filter: 'battle-royale', transition: 'glitch-kesme', caption: 'alt-hud' },
  { id: 'vlog', name: 'Sıcak vlog', filter: 'altin-saat', transition: 'yumusak-karisim', caption: 'alt-golgeli-kart' },
  { id: 'retro', name: 'Retro', filter: '90lar', transition: 'vhs-sarma', caption: 'alt-piksel' },
  { id: 'neon', name: 'Neon gece', filter: 'neon-gece', transition: 'rgb-ayrisma', caption: 'alt-neon' },
  { id: 'sb', name: 'Siyah beyaz', filter: 'klasik-sb', transition: 'siyah-flas', caption: 'alt-klasik' },
]

export async function applyLook(id) {
  const L = LOOKS.find(x => x.id === id)
  if (!L) return
  const textPack = await import('../../packs/text/index.js')
  let nc = 0
  store.edit('Görünüm: ' + L.name, d => {
    const m = TL.mainTrack(d)
    m.clips.forEach((c, i) => {
      if (c.type === 'video' || c.type === 'image') setFilter(c, L.filter, 0.85)
      if (i < m.clips.length - 1 && (c.type === 'video' || c.type === 'image')) setTransition(c, L.transition)
    })
    for (const t of d.tracks) for (const c of t.clips) {
      if (c.caption && textPack.applyCaptionStyle && regGet('captionStyles', L.caption)) { textPack.applyCaptionStyle(c, L.caption); if (c.text) c.text.uppercase = false; nc++ }
    }
  })
  return nc
}
