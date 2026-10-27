// Ekip arkadaşlarının özellik modülleri — dosya yoksa derleme bozulmaz (import.meta.glob boş döner).
// Hepsi tembel yüklenir: whisper / tts gibi ağır modüller açılışı yavaşlatmaz.

const MODS = {
  ...import.meta.glob('../../features/audio/recorder.js'),
  ...import.meta.glob('../../features/audio/silence.js'),
  ...import.meta.glob('../../features/audio/beats.js'),
  ...import.meta.glob('../../features/audio/highlights.js'),
  ...import.meta.glob('../../features/tts/*.js'),
  ...import.meta.glob('../../features/captions/*.js'),
  ...import.meta.glob('../../packs/sfx/render.js'),
  ...import.meta.glob('../../features/video/index.js'),
}

const PATHS = {
  recorder: ['../../features/audio/recorder.js'],
  silence: ['../../features/audio/silence.js'],
  beats: ['../../features/audio/beats.js'],
  highlights: ['../../features/audio/highlights.js'],
  tts: ['../../features/tts/index.js', '../../features/tts/tts.js', '../../features/tts/piper.js'],
  models: ['../../features/captions/models.js'],
  whisper: ['../../features/captions/whisper.js'],
  build: ['../../features/captions/build.js'],
  subtitles: ['../../features/captions/subtitles.js'],
  sfx: ['../../packs/sfx/render.js'],
  video: ['../../features/video/index.js'],
}

function pathOf(name) {
  const list = PATHS[name] || []
  for (const p of list) if (MODS[p]) return p
  if (name === 'tts') return Object.keys(MODS).find(k => k.includes('/features/tts/')) || null
  return null
}

export function hasFeature(name) { return !!pathOf(name) }

const loaded = new Map()
export async function feature(name) {
  if (loaded.has(name)) return loaded.get(name)
  const p = pathOf(name)
  if (!p) return null
  const prom = MODS[p]().catch(e => { console.warn('özellik modülü yüklenemedi', name, e); loaded.delete(name); return null })
  loaded.set(name, prom)
  return prom
}

// TTS: synthesize dışa aktaran ilk modül (index.js yoksa klasördeki diğerleri)
export async function ttsModule() {
  const m = await feature('tts')
  if (m && m.synthesize) return m
  for (const k of Object.keys(MODS)) {
    if (!k.includes('/features/tts/')) continue
    try { const x = await MODS[k](); if (x && x.synthesize) return x } catch (e) { /* */ }
  }
  return m
}
