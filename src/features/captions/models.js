// Whisper model yönetimi: katalog, indirme (devam ettirilebilir), doğrulama, silme.
// Modeller yazılabilir klasörde: <userData>/models/whisper/<dosya>. Geliştirmede vendor/whisper/models/
// de okunur (kurulum paketine girmez, .gitignore'da).

import { capEnv, ensureDirSync, fileSize, abortError, hasFs } from './env.js'

const HF = [
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/',
  'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/',
]

// Boyut ve sha256 değerleri Hugging Face LFS kayıtlarından (ggerganov/whisper.cpp, main).
// dtwLag: DTW kelime zamanının sistematik gecikmesi (sn) — TTS kelime sınırlarıyla ölçüldü (scripts/test-captions.cjs)
export const WHISPER_MODELS = [
  {
    id: 'tiny', name: 'Tiny', label: 'En hızlı', file: 'ggml-tiny-q5_1.bin', size: 32152673,
    sha256: '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7', dtw: 'tiny', dtwLag: 0.25,
    speed: 5, quality: 1, desc: 'Anında sonuç ama Türkçede sık hata yapar. Hızlı deneme için.',
  },
  {
    id: 'base', name: 'Base', label: 'Hızlı', file: 'ggml-base-q5_1.bin', size: 59707625,
    sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898', dtw: 'base', dtwLag: 0.21,
    speed: 4, quality: 2, desc: 'Hızlı, temiz konuşmada iş görür; eklerde ve isimlerde yanılabilir.',
  },
  {
    id: 'small', name: 'Small', label: 'Dengeli', file: 'ggml-small-q5_1.bin', size: 190085487,
    sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb', dtw: 'small', dtwLag: 0.18,
    speed: 3, quality: 3, desc: 'Hız ve doğruluk dengesi. Türkçe altyazı için önerilen.',
  },
  {
    id: 'medium', name: 'Medium', label: 'Doğru', file: 'ggml-medium-q5_0.bin', size: 539212467,
    sha256: '19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f', dtw: 'medium', dtwLag: 0.27,
    speed: 2, quality: 4, desc: 'Çok doğru ama yavaş; işlemcide Turbo ile benzer süre.',
  },
  {
    id: 'large-v3-turbo', name: 'Large v3 Turbo', label: 'En doğru', file: 'ggml-large-v3-turbo-q5_0.bin', size: 574041195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2', dtw: 'large.v3.turbo', dtwLag: 0.2,
    speed: 2, quality: 5, desc: 'En iyi Türkçe doğruluğu, noktalama ve özel isimler. Güçlü işlemci ister.',
  },
]

export const DEFAULT_MODEL = 'small'

// Ses etkinliği algılama (VAD) modeli — küçük olduğu için uygulamayla gelir
export const VAD_MODEL = { file: 'ggml-silero-v6.2.0.bin', size: 885098, sha256: '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987' }

export function getModel(id) {
  return WHISPER_MODELS.find(m => m.id === id) || null
}

export function sizeLabel(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1).replace('.', ',') + ' GB'
  return Math.round(bytes / 1e6) + ' MB'
}

export function modelsDir() {
  const { path, userData } = capEnv()
  if (!hasFs()) return null
  return ensureDirSync(path.join(userData, 'models', 'whisper'))
}

function devModelsDir() {
  const { path, vendor } = capEnv()
  return vendor && path ? path.join(vendor, 'whisper', 'models') : null
}

export function modelPath(id) {
  const m = getModel(id)
  if (!m || !hasFs()) return null
  return capEnv().path.join(modelsDir(), m.file)
}

// Kurulu modelin yolu (userData, yoksa geliştirme klasörü) ya da null
export function resolveModelPath(id) {
  const m = getModel(id)
  if (!m || !hasFs()) return null
  const p = modelPath(id)
  if (fileSize(p) === m.size) return p
  const dev = devModelsDir()
  if (dev) {
    const d = capEnv().path.join(dev, m.file)
    if (fileSize(d) === m.size) return d
  }
  return null
}

export function isInstalled(id) {
  return !!resolveModelPath(id)
}

export function partialBytes(id) {
  const p = modelPath(id)
  return p ? Math.max(0, fileSize(p + '.part')) : 0
}

export function listModels() {
  return WHISPER_MODELS.map(m => ({
    ...m,
    sizeLabel: sizeLabel(m.size),
    installed: isInstalled(m.id),
    path: resolveModelPath(m.id),
    partial: partialBytes(m.id),
    recommended: m.id === DEFAULT_MODEL,
  }))
}

// Kullanılacak model: istenen kuruluysa o, değilse önerilen, değilse kurulu en kalitelisi
export function pickModel(preferred) {
  if (preferred && isInstalled(preferred)) return preferred
  if (isInstalled(DEFAULT_MODEL)) return DEFAULT_MODEL
  const inst = WHISPER_MODELS.filter(m => isInstalled(m.id)).sort((a, b) => b.quality - a.quality)
  return inst.length ? inst[0].id : null
}

export function vadModelPath() {
  const { path, vendor, userData } = capEnv()
  if (!hasFs()) return null
  for (const dir of [vendor && path.join(vendor, 'whisper', 'vad'), path.join(userData, 'models', 'whisper')]) {
    if (!dir) continue
    const p = path.join(dir, VAD_MODEL.file)
    if (fileSize(p) === VAD_MODEL.size) return p
  }
  return null
}

export async function deleteModel(id) {
  const p = modelPath(id)
  if (!p) return false
  const { fs } = capEnv()
  let ok = false
  for (const f of [p, p + '.part']) {
    try { await fs.promises.unlink(f); ok = true } catch (e) { /* yok */ }
  }
  return ok
}

// Dosyanın sha256'sı (akışla; arayüzü kilitlemez)
export function sha256File(file, onProgress, signal) {
  const { fs, crypto } = capEnv()
  return new Promise((resolve, reject) => {
    const total = fileSize(file)
    const h = crypto.createHash('sha256')
    const rs = fs.createReadStream(file, { highWaterMark: 1 << 20 })
    let done = 0
    const onAbort = () => { rs.destroy(); reject(abortError('Doğrulama iptal edildi')) }
    if (signal) { if (signal.aborted) return onAbort(); signal.addEventListener('abort', onAbort, { once: true }) }
    rs.on('data', c => { h.update(c); done += c.length; if (onProgress) onProgress(done / Math.max(1, total)) })
    rs.on('error', e => { if (signal) signal.removeEventListener('abort', onAbort); reject(e) })
    rs.on('end', () => { if (signal) signal.removeEventListener('abort', onAbort); resolve(h.digest('hex')) })
  })
}

// Bir URL'yi dosyaya indirir; `part` varsa Range ile kaldığı yerden devam eder.
// onChunk(received, total) — total bilinmiyorsa 0
async function fetchToFile(url, part, { signal, onChunk, expected, stallMs = 30000 }) {
  const env = capEnv()
  const { fs } = env
  if (!env.fetch) throw new Error('Ağ erişimi yok')
  let have = Math.max(0, fileSize(part))
  if (expected && have > expected) { try { fs.unlinkSync(part) } catch (e) { /* */ } have = 0 }
  if (expected && have === expected) return have
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal) { if (signal.aborted) throw abortError('İndirme iptal edildi'); signal.addEventListener('abort', onAbort, { once: true }) }
  let stallTimer = null
  let stalled = false
  const kick = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => { stalled = true; ctrl.abort() }, stallMs) }
  let ws = null
  try {
    kick()
    const headers = { 'User-Agent': 'SWEAXCUT' }
    if (have > 0) headers.Range = `bytes=${have}-`
    const res = await env.fetch(url, { headers, signal: ctrl.signal, redirect: 'follow', cache: 'no-store' })
    if (res.status === 416 && expected && have === expected) return have
    if (!(res.status === 200 || res.status === 206)) {
      const e = new Error(`Sunucu yanıtı ${res.status}`)
      e.http = res.status
      throw e
    }
    // Sunucu Range'i yok saydıysa baştan yaz
    const append = res.status === 206 && have > 0
    if (!append) have = 0
    const len = +res.headers.get('content-length') || 0
    const total = expected || (len ? len + have : 0)
    ws = fs.createWriteStream(part, { flags: append ? 'a' : 'w' })
    const wsErr = new Promise((_, rej) => ws.on('error', rej))
    wsErr.catch(() => {})
    const reader = res.body.getReader()
    let got = have
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), wsErr])
      if (done) break
      kick()
      got += value.length
      if (!ws.write(Buffer.from(value.buffer, value.byteOffset, value.byteLength))) {
        await Promise.race([new Promise(r => ws.once('drain', r)), wsErr])
      }
      if (onChunk) onChunk(got, total)
    }
    await new Promise((resolve, reject) => ws.end(err => err ? reject(err) : resolve()))
    ws = null
    return got
  } catch (e) {
    if (signal && signal.aborted) throw abortError('İndirme iptal edildi')
    if (stalled) { const se = new Error('Bağlantı yanıt vermiyor'); se.retry = true; throw se }
    if (e && e.http == null) e.retry = true
    throw e
  } finally {
    clearTimeout(stallTimer)
    if (signal) signal.removeEventListener('abort', onAbort)
    if (ws) await new Promise(r => ws.end(r))
  }
}

// Modeli indir. onProgress({ phase:'download'|'verify'|'done', received, total, ratio, speed (B/sn), eta (sn) })
// İptal edilirse .part dosyası kalır; bir sonraki çağrı kaldığı yerden devam eder.
export async function downloadModel(id, onProgress, signal, opts = {}) {
  const m = getModel(id)
  if (!m) throw new Error('Bilinmeyen model: ' + id)
  if (!hasFs()) throw new Error('Model indirme yalnızca masaüstü uygulamasında çalışır')
  const { fs } = capEnv()
  const dest = modelPath(id)
  if (fileSize(dest) === m.size && !opts.force) {
    if (onProgress) onProgress({ phase: 'done', received: m.size, total: m.size, ratio: 1, speed: 0, eta: 0 })
    return dest
  }
  const part = dest + '.part'
  const t0 = Date.now()
  const start = Math.max(0, fileSize(part))
  let lastEmit = 0
  const emit = (received, force) => {
    const now = Date.now()
    if (!force && now - lastEmit < 120) return
    lastEmit = now
    const sec = Math.max(0.001, (now - t0) / 1000)
    const speed = (received - start) / sec
    const eta = speed > 0 ? (m.size - received) / speed : null
    if (onProgress) onProgress({ phase: 'download', received, total: m.size, ratio: received / m.size, speed, eta })
  }
  const urls = (opts.urls || HF).map(u => u + m.file)
  let lastErr = null
  let done = false
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    const url = urls[Math.min(urls.length - 1, Math.floor(attempt / 2))]
    try {
      const got = await fetchToFile(url, part, { signal, expected: m.size, onChunk: r => emit(r) })
      emit(got, true)
      done = true
    } catch (e) {
      if (e.name === 'AbortError') throw e
      lastErr = e
      if (!e.retry && !(e.http >= 500 || e.http === 403 || e.http === 404 || e.http === 429)) break
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  if (!done) throw new Error('Model indirilemedi: ' + (lastErr ? lastErr.message : 'bilinmeyen hata'))
  const size = fileSize(part)
  if (size !== m.size) throw new Error(`İndirme eksik kaldı (${sizeLabel(size)} / ${m.sizeLabel || sizeLabel(m.size)}). Tekrar deneyin, kaldığı yerden devam eder.`)
  if (onProgress) onProgress({ phase: 'verify', received: m.size, total: m.size, ratio: 1, speed: 0, eta: null })
  if (m.sha256 && opts.verify !== false) {
    const sum = await sha256File(part, null, signal)
    if (sum !== m.sha256) {
      try { fs.unlinkSync(part) } catch (e) { /* */ }
      throw new Error('İndirilen dosya bozuk (sağlama toplamı tutmadı). Lütfen yeniden indirin.')
    }
  }
  try { fs.unlinkSync(dest) } catch (e) { /* yok */ }
  fs.renameSync(part, dest)
  if (onProgress) onProgress({ phase: 'done', received: m.size, total: m.size, ratio: 1, speed: 0, eta: 0 })
  return dest
}

// Var olan dosyayı katalogla karşılaştır (boyut + isteğe bağlı sha256)
export async function verifyModel(id, { hash = false, signal } = {}) {
  const m = getModel(id)
  const p = resolveModelPath(id)
  if (!m || !p) return { ok: false, reason: 'kurulu değil' }
  if (!hash) return { ok: true, path: p }
  const sum = await sha256File(p, null, signal)
  return sum === m.sha256 ? { ok: true, path: p } : { ok: false, reason: 'sağlama toplamı tutmadı', path: p }
}
