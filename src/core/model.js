// SWEAXCUT proje veri modeli — tek doğruluk kaynağı.
// Bütün paketler (efekt, geçiş, yazı, ses…) bu şemaya göre yazılır. Alan eklerken varsayılanı
// buraya koy; eski projeler normalize() ile yükseltilir.
//
// Koordinat sistemi:
//   transform.x / transform.y : tuval merkezine göre kayma, tuval GENİŞLİĞİ / YÜKSEKLİĞİ oranı
//                               (0 = ortada, 0.5 = sağ kenar, -0.5 = sol kenar; y aşağı pozitif)
//   transform.scale           : 1 = "sığdır" boyutu (medya tuvale contain), yazıda font çarpanı
//   transform.rotation        : derece, saat yönü
// Zaman: saniye (float). clip.start/duration zaman çizelgesi; clip.in/out kaynak medya zamanı.
// Anahtar kareler: clip.keyframes[propPath] = [{ t (klip başından saniye), v (sayı), ease }]

export const PROJECT_VERSION = 2

let _idc = 0
export function uid(prefix = 'x') {
  _idc = (_idc + 1) % 1e6
  return prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6) + _idc.toString(36)
}

export const RATIOS = [
  { id: '9:16', w: 1080, h: 1920, label: '9:16', hint: 'TikTok · Shorts · Reels' },
  { id: '16:9', w: 1920, h: 1080, label: '16:9', hint: 'YouTube' },
  { id: '1:1', w: 1080, h: 1080, label: '1:1', hint: 'Kare' },
  { id: '4:5', w: 1080, h: 1350, label: '4:5', hint: 'Instagram akış' },
  { id: '3:4', w: 1080, h: 1440, label: '3:4', hint: 'Dikey' },
  { id: '4:3', w: 1440, h: 1080, label: '4:3', hint: 'Klasik' },
  { id: '21:9', w: 2560, h: 1080, label: '21:9', hint: 'Sinema' },
  { id: '2:1', w: 2160, h: 1080, label: '2:1', hint: 'Geniş' },
  { id: '2.35:1', w: 2538, h: 1080, label: '2.35:1', hint: 'Anamorfik' },
]

export const FPS_OPTIONS = [24, 25, 30, 50, 60]

export function defaultTransform() {
  return { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, flipH: false, flipV: false }
}

export function defaultAdjust() {
  // Hepsi -100..100, 0 = etkisiz
  return {
    brightness: 0, contrast: 0, saturation: 0, exposure: 0, temperature: 0, tint: 0,
    highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0,
    sharpen: 0, clarity: 0, vignette: 0, fade: 0, grain: 0, bloom: 0,
  }
}

// 8 renk kanalı için HSL (her biri {h,s,l} -100..100)
export const HSL_CHANNELS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta']
export function defaultHSL() {
  const o = {}
  for (const c of HSL_CHANNELS) o[c] = { h: 0, s: 0, l: 0 }
  return o
}

export function defaultMask() {
  return { type: 'none', x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0, feather: 0, invert: false, round: 0 }
}

export function defaultChroma() {
  return { enabled: false, color: '#00ff00', strength: 0.4, smooth: 0.1, spill: 0.5 }
}

export function defaultAudio() {
  return {
    volume: 1,          // 0..4 doğrusal kazanç (1 = %100)
    muted: false,
    fadeIn: 0, fadeOut: 0,
    pan: 0,             // -1..1
    pitch: 0,           // yarım ton, -12..12
    preservePitch: true,
    voiceFx: null,      // { id, params }
    denoise: 0,         // 0..100 gürültü azaltma gücü (0 = kapalı)
    enhance: false,     // ses netleştirme (EQ+kompresör)
    normalize: false,   // yükseklik eşitleme (loudnorm)
    eq: { low: 0, mid: 0, high: 0 }, // dB -12..12
    duck: false,        // bu klip konuşma olduğunda diğer sesleri kıs
  }
}

export function defaultTextStyle() {
  return {
    content: 'Yazı ekle',
    font: 'Archivo Black',
    size: 96,           // 1080 genişlikli tuvalde px; tuval genişliğine göre ölçeklenir
    weight: 900,
    italic: false,
    underline: false,
    uppercase: false,
    color: '#ffffff',
    fill: null,         // { type:'linear'|'radial', angle, stops:[{at,color}] }
    stroke: { enabled: true, color: '#000000', width: 8 },
    stroke2: { enabled: false, color: '#ffffff', width: 16 }, // dış ikinci kontur
    shadow: { enabled: false, color: '#000000', blur: 12, x: 0, y: 6, opacity: 0.6 },
    glow: { enabled: false, color: '#4dd2ff', size: 24, strength: 1 },
    bg: { enabled: false, color: '#000000', opacity: 0.7, radius: 12, padX: 24, padY: 12, mode: 'block' }, // mode: block | line
    align: 'center',
    letterSpacing: 0,   // px
    lineHeight: 1.12,
    curve: 0,           // -100..100 kavis
    maxWidth: 0.86,     // tuval genişliği oranı (satır kaydırma)
    opacityFill: 1,
  }
}

function clipBase(type, extra) {
  return {
    id: uid('c'),
    type,
    name: '',
    start: 0,
    duration: 3,
    transform: defaultTransform(),
    opacity: 1,
    blend: 'normal',
    keyframes: {},
    anim: { in: null, out: null, loop: null }, // { id, duration }
    effects: [],        // [{ uid, id, params, enabled }]
    filter: null,       // { id, intensity 0..1 }
    adjust: defaultAdjust(),
    locked: false,
    color: null,        // zaman çizelgesi etiket rengi
    ...extra,
  }
}

export function createMediaClip(media, opts = {}) {
  const isImage = media.type === 'image'
  const dur = isImage ? (opts.duration || 3) : Math.max(0.1, media.duration || 3)
  return clipBase(isImage ? 'image' : 'video', {
    name: media.name,
    mediaId: media.id,
    in: 0,
    out: isImage ? dur : dur,
    duration: dur,
    speed: 1,
    speedCurve: null,   // { id, points:[{x 0..1, y çarpan}] }
    reverse: false,
    freeze: false,
    fit: 'contain',     // contain | cover | fill
    crop: { l: 0, t: 0, r: 0, b: 0 }, // 0..1 oranları
    mask: defaultMask(),
    chroma: defaultChroma(),
    bgRemove: false,
    stabilize: 0,       // 0 kapalı, 1..3 güç (ffmpeg vidstab ile işlenmiş vekil)
    hsl: defaultHSL(),
    lut: null,          // { path, intensity }
    transition: null,   // sonraki klibe geçiş { id, duration, params }
    audio: defaultAudio(),
    canvasBg: null,     // klibe özel arka plan; null = proje ayarı
    ...opts,
  })
}

export function createAudioClip(media, opts = {}) {
  const dur = Math.max(0.1, media.duration || 3)
  return {
    id: uid('a'),
    type: 'audio',
    name: media.name,
    mediaId: media.id,
    start: 0,
    duration: dur,
    in: 0,
    out: dur,
    speed: 1,
    reverse: false,
    keyframes: {},
    audio: defaultAudio(),
    role: 'music',      // music | sfx | voice | extracted
    beats: null,        // [saniye] otomatik vuruş işaretleri (kaynak zamanı)
    color: null,
    locked: false,
    ...opts,
  }
}

export function createTextClip(opts = {}) {
  const { text, ...rest } = opts
  return clipBase('text', {
    name: 'Yazı',
    duration: 3,
    text: { ...defaultTextStyle(), ...(text || {}) },
    caption: null,      // { words:[{w,s,e}], styleId, groupId }
    templateId: null,
    tts: null,          // { voice, rate, pitch, audioClipId }
    ...rest,
  })
}

export function createStickerClip(sticker, opts = {}) {
  return clipBase('sticker', {
    name: sticker.name || 'Çıkartma',
    duration: 3,
    sticker: { kind: sticker.kind, id: sticker.id, mediaId: sticker.mediaId || null, params: sticker.params || {} },
    transform: { ...defaultTransform(), scale: 0.5 },
    ...opts,
  })
}

// Efekt katmanı: altındaki her şeye uygulanır (CapCut efekt şeridi)
export function createEffectClip(effect, opts = {}) {
  return clipBase('effect', { name: effect.name, duration: 3, effect: { id: effect.id, params: { ...(effect.defaults || {}) } }, ...opts })
}
export function createFilterClip(filter, opts = {}) {
  return clipBase('filter', { name: filter.name, duration: 3, filter: { id: filter.id, intensity: 1 }, ...opts })
}
export function createAdjustClip(opts = {}) {
  return clipBase('adjust', { name: 'Ayar katmanı', duration: 3, hsl: defaultHSL(), ...opts })
}

export const TRACK_KINDS = {
  video: { label: 'Video', accepts: ['video', 'image'], visual: true },
  text: { label: 'Yazı', accepts: ['text'], visual: true },
  sticker: { label: 'Çıkartma', accepts: ['sticker', 'image', 'video'], visual: true },
  effect: { label: 'Efekt', accepts: ['effect', 'filter', 'adjust'], visual: true },
  audio: { label: 'Ses', accepts: ['audio'], visual: false },
}

export function createTrack(kind, opts = {}) {
  return { id: uid('t'), kind, name: '', main: false, hidden: false, muted: false, locked: false, clips: [], ...opts }
}

export function createProject(opts = {}) {
  const ratio = RATIOS.find(r => r.id === (opts.ratio || '9:16')) || RATIOS[0]
  const main = createTrack('video', { main: true, name: 'Ana' })
  return {
    version: PROJECT_VERSION,
    id: uid('p'),
    name: opts.name || 'Yeni proje',
    created: Date.now(),
    modified: Date.now(),
    settings: {
      ratio: ratio.id,
      width: ratio.w,
      height: ratio.h,
      fps: opts.fps || 30,
      sampleRate: 48000,
      bg: { type: 'blur', color: '#000000', blur: 28, dim: 0.15, mediaId: null, gradient: ['#141414', '#000000'] },
    },
    media: {},          // id → MediaItem
    tracks: [main],     // ekranda yukarıdan aşağıya; görsel izler ana izin üstünde, ses izleri altında
    markers: [],        // [{ id, time, color, label }]
  }
}

// MediaItem: { id, type:'video'|'audio'|'image', path, name, size, mtime, duration, width, height, fps,
//              hasAudio, codec, rotation, proxyPath, audioPath, peaksPath, thumbsDir, thumbInterval,
//              thumbCount, status:'ready'|'processing'|'error', reversedPath, stabPath }

export function isVisualClip(c) { return c && c.type !== 'audio' }
export function isMediaClip(c) { return c && (c.type === 'video' || c.type === 'image' || c.type === 'audio') }
export function hasSourceTime(c) { return c && (c.type === 'video' || c.type === 'audio') }

export function clipEnd(c) { return c.start + c.duration }

// Eski / eksik alanları tamamla
export function normalizeProject(p) {
  if (!p || typeof p !== 'object') return createProject()
  const base = createProject()
  p.version = PROJECT_VERSION
  p.settings = { ...base.settings, ...(p.settings || {}), bg: { ...base.settings.bg, ...((p.settings || {}).bg || {}) } }
  p.media = p.media || {}
  p.markers = p.markers || []
  if (!Array.isArray(p.tracks) || !p.tracks.length) p.tracks = base.tracks
  if (!p.tracks.some(t => t.main)) {
    const v = p.tracks.find(t => t.kind === 'video')
    if (v) v.main = true
    else p.tracks.push(createTrack('video', { main: true, name: 'Ana' }))
  }
  for (const t of p.tracks) {
    t.clips = (t.clips || []).map(c => normalizeClip(c))
    t.clips.sort((a, b) => a.start - b.start)
  }
  return p
}

export function normalizeClip(c) {
  const d = c.type === 'audio' ? createAudioClip({ id: 'm', name: '', duration: c.duration })
    : c.type === 'text' ? createTextClip()
      : c.type === 'sticker' ? createStickerClip({ kind: 'emoji', id: '' })
        : c.type === 'effect' ? createEffectClip({ id: '', name: '' })
          : c.type === 'filter' ? createFilterClip({ id: '', name: '' })
            : c.type === 'adjust' ? createAdjustClip()
              : createMediaClip({ id: 'm', type: c.type === 'image' ? 'image' : 'video', duration: c.duration })
  const out = { ...d, ...c }
  for (const k of ['transform', 'audio', 'adjust', 'mask', 'chroma', 'crop', 'anim', 'text']) {
    if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) out[k] = { ...d[k], ...(c[k] || {}) }
  }
  if (d.text && c.text) {
    for (const k of ['stroke', 'stroke2', 'shadow', 'glow', 'bg']) out.text[k] = { ...d.text[k], ...(c.text[k] || {}) }
  }
  if (d.hsl) out.hsl = { ...d.hsl, ...(c.hsl || {}) }
  out.keyframes = c.keyframes || {}
  out.effects = c.effects || []
  return out
}

// Yol ile değer okuma/yazma: 'transform.x', 'audio.volume', 'adjust.brightness'
export function getPath(obj, p) {
  let o = obj
  for (const k of p.split('.')) { if (o == null) return undefined; o = o[k] }
  return o
}
export function setPath(obj, p, v) {
  const ks = p.split('.')
  let o = obj
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}
    o = o[ks[i]]
  }
  o[ks[ks.length - 1]] = v
}
