// Çevrimdışı konuşma → yazı (whisper.cpp / whisper-cli.exe). Kelime zamanlı döküm üretir.
//
// Windows notları:
//  • whisper-cli argümanları sistem kod sayfasıyla okur; Türkçe karakterli yollar bozulur. Paketteki exe'ye
//    UTF-8 activeCodePage manifesti gömülü, ayrıca bütün yollar çalışma klasörüne GÖRELİ ve ASCII verilir.
//  • İşlem düşük öncelikte ve OMP_WAIT_POLICY=PASSIVE ile çalışır: oyun/önizleme açıkken bile işlemciyi boğmaz.

import { capEnv, workDir, fileSize, abortError, hasFs } from './env.js'
import { getModel, resolveModelPath, pickModel, vadModelPath, DEFAULT_MODEL } from './models.js'
import { parseWhisperJson } from './parse.js'

export const LANGUAGES = [
  { id: 'auto', name: 'Otomatik algıla' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'en', name: 'İngilizce' },
  { id: 'de', name: 'Almanca' },
  { id: 'fr', name: 'Fransızca' },
  { id: 'es', name: 'İspanyolca' },
  { id: 'it', name: 'İtalyanca' },
  { id: 'pt', name: 'Portekizce' },
  { id: 'ru', name: 'Rusça' },
  { id: 'uk', name: 'Ukraynaca' },
  { id: 'pl', name: 'Lehçe' },
  { id: 'nl', name: 'Felemenkçe' },
  { id: 'ar', name: 'Arapça' },
  { id: 'fa', name: 'Farsça' },
  { id: 'az', name: 'Azerbaycan Türkçesi' },
  { id: 'kk', name: 'Kazakça' },
  { id: 'uz', name: 'Özbekçe' },
  { id: 'ja', name: 'Japonca' },
  { id: 'ko', name: 'Korece' },
  { id: 'zh', name: 'Çince' },
  { id: 'hi', name: 'Hintçe' },
]

const EXE = typeof process === 'undefined' || process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'

// ---------------------------------------------------------------- ikili dosyalar

// CPU her zaman pakette: vendor/whisper/bin. İsteğe bağlı GPU çeşidi (CUDA/Vulkan derlemesi) varsa:
// vendor/whisper/bin-gpu ya da <userData>/whisper/bin-gpu — çalışmazsa sessizce CPU'ya düşülür.
let gpuState = null // null: denenmedi · 'ok' · 'fail'

export function whisperBinaries() {
  const { path, vendor, userData } = capEnv()
  const out = []
  if (!hasFs()) return out
  const gpuDirs = [vendor && path.join(vendor, 'whisper', 'bin-gpu'), userData && path.join(userData, 'whisper', 'bin-gpu')]
  for (const dir of gpuDirs) {
    if (dir && fileSize(path.join(dir, EXE)) > 0) { out.push({ device: 'gpu', dir, bin: path.join(dir, EXE) }); break }
  }
  if (vendor) {
    const dir = path.join(vendor, 'whisper', 'bin')
    if (fileSize(path.join(dir, EXE)) > 0) out.push({ device: 'cpu', dir, bin: path.join(dir, EXE) })
  }
  return out
}

export function isAvailable() {
  const env = capEnv()
  return !!(env.cp && env.fs && whisperBinaries().some(b => b.device === 'cpu'))
}

export function gpuStatus() { return gpuState }

// Fiziksel çekirdek sayısı kadar iş parçacığı en hızlısı (SMT ve yük altında fazlası yavaşlatıyor — ölçüldü)
export function defaultThreads() {
  const { os } = capEnv()
  const n = os ? (os.availableParallelism ? os.availableParallelism() : os.cpus().length) : 4
  const physical = n >= 8 ? Math.floor(n / 2) : n
  return Math.max(1, Math.min(8, n >= 8 ? physical : physical - 1 || 1))
}

// ---------------------------------------------------------------- süreç

function relOrSelf(from, p) {
  const { path } = capEnv()
  const r = path.relative(from, p)
  return r && !path.isAbsolute(r) ? r : p
}
const isAscii = s => /^[\x20-\x7e]*$/.test(s)

// Model yolunu çalışma klasörüne göre ASCII yap; olmuyorsa sabit bağlantı (hard link) / kopya
function asciiModelArg(cwd, modelFile, id) {
  const { fs, path } = capEnv()
  const rel = relOrSelf(cwd, modelFile)
  if (isAscii(rel)) return rel
  const link = path.join(cwd, `model-${id}.bin`)
  if (fileSize(link) !== fileSize(modelFile)) {
    try { fs.unlinkSync(link) } catch (e) { /* yok */ }
    try { fs.linkSync(modelFile, link) } catch (e) { fs.copyFileSync(modelFile, link) }
  }
  return path.basename(link)
}

function spawnProc(bin, args, { cwd, signal, onLine, lowPriority = true } = {}) {
  const { cp, os, killTree } = capEnv()
  return new Promise((resolve, reject) => {
    if (!cp) { reject(new Error('Otomatik altyazı yalnızca masaüstü uygulamasında çalışır')); return }
    if (signal && signal.aborted) { reject(abortError()); return }
    let child
    try {
      const penv = typeof process !== 'undefined' ? process.env : {}
      child = cp.spawn(bin, args, { cwd, windowsHide: true, env: { ...penv, OMP_WAIT_POLICY: 'PASSIVE' } })
    } catch (e) { reject(e); return }
    if (lowPriority && os && os.setPriority) {
      try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL) } catch (e) { /* izin yok */ }
    }
    let err = ''
    let out = ''
    let line = ''
    let aborted = false
    const onAbort = () => { aborted = true; killTree(child) }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const feed = s => {
      line += s
      let i
      while ((i = line.search(/[\r\n]/)) >= 0) {
        const l = line.slice(0, i)
        line = line.slice(i + 1)
        if (l && onLine) onLine(l)
      }
    }
    child.stdout.on('data', d => { out = (out + d.toString('utf8')).slice(-200000) })
    child.stderr.on('data', d => { const s = d.toString('utf8'); err = (err + s).slice(-60000); feed(s) })
    child.on('error', e => { if (signal) signal.removeEventListener('abort', onAbort); resolve({ code: -1, err: err + '\n' + String(e), out, aborted }) })
    child.on('close', code => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (line && onLine) onLine(line)
      resolve({ code, err, out, aborted })
    })
  })
}

// ---------------------------------------------------------------- ses hazırlama

function sourceKey(src, range) {
  const { fs, hashString } = capEnv()
  let st = null
  try { st = fs.statSync(src) } catch (e) { /* */ }
  return hashString(['v1', src, st ? st.size : 0, st ? st.mtimeMs : 0, range ? `${range.start}-${range.end}` : 'all'].join('|'))
}

export function inputPath(input) {
  if (!input) return null
  if (typeof input === 'string') return input
  // medya öğesi: çıkarılmış ses (FLAC 48k) varsa onu kullan
  return input.audioPath || input.path || null
}

// 16 kHz tek kanal WAV (önbellekli). Dönen yol çalışma klasöründedir.
export async function prepareAudio(src, { range, signal, onProgress } = {}) {
  const env = capEnv()
  const { fs, path } = env
  if (!src || fileSize(src) <= 0) throw new Error('Ses dosyası bulunamadı')
  src = path.resolve(src) // süreçler çalışma klasöründe koşar
  const cwd = workDir()
  const key = sourceKey(src, range)
  const out = path.join(cwd, `a-${key}.wav`)
  if (fileSize(out) > 44) return { wav: out, key, cached: true }
  const tmp = path.join(cwd, `a-${key}.tmp.wav`)
  const args = ['-y', '-hide_banner', '-nostdin', '-nostats', '-progress', 'pipe:2']
  let dur = 0
  if (range && range.start > 0) args.push('-ss', String(range.start))
  args.push('-i', src)
  if (range && range.end > (range.start || 0)) { dur = range.end - (range.start || 0); args.push('-t', String(dur)) }
  args.push('-vn', '-sn', '-dn', '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', tmp)
  const r = await spawnProc(env.ffmpeg, args, {
    cwd, signal, lowPriority: false,
    onLine: l => {
      const md = !dur && /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(l)
      if (md) dur = (+md[1]) * 3600 + (+md[2]) * 60 + (+md[3]) - ((range && range.start) || 0)
      const mt = /out_time_us=(\d+)/.exec(l)
      if (mt && dur > 0 && onProgress) onProgress(Math.min(1, +mt[1] / 1e6 / dur))
    },
  })
  if (r.aborted) { try { fs.unlinkSync(tmp) } catch (e) { /* */ } throw abortError() }
  if (r.code !== 0 || fileSize(tmp) <= 44) {
    try { fs.unlinkSync(tmp) } catch (e) { /* */ }
    if (/does not contain any stream|matches no streams|Stream map '0:a:0'/i.test(r.err)) throw new Error('Bu dosyada ses yok')
    throw new Error('Ses hazırlanamadı: ' + r.err.trim().split('\n').slice(-2).join(' ').slice(0, 200))
  }
  fs.renameSync(tmp, out)
  return { wav: out, key, cached: false }
}

// ---------------------------------------------------------------- döküm

function buildArgs({ modelArg, wavArg, outArg, lang, threads, translate, beam, timing, dtw, vadArg, prompt, maxContext }) {
  // -np kullanılmaz: ilerleme satırlarını (-pp) da susturuyor
  const a = ['-m', modelArg, '-f', wavArg, '-l', lang, '-t', String(threads), '-ojf', '-of', outArg, '-pp']
  a.push('-sns') // [Müzik] gibi konuşma dışı belirteçleri bastır
  if (beam > 1) a.push('-bs', String(beam), '-bo', String(beam))
  else a.push('-bs', '1', '-bo', '1')
  if (translate) a.push('-tr')
  if (timing === 'dtw' && dtw) a.push('-dtw', dtw, '-nfa')
  if (vadArg) a.push('--vad', '-vm', vadArg, '-vsd', '300', '-vp', '200')
  if (prompt) a.push('--prompt', prompt)
  if (maxContext != null) a.push('-mc', String(maxContext))
  return a
}

const memCache = new Map()

// Whisper dolgu seslerini (ıı, ee, şey) normalde temizler; bu ilk istem onları da yazdırır ("dolgu kelimelerini kes" için)
export const VERBATIM_PROMPTS = {
  tr: 'Iıı, şey, yani... Ee, hani, ımm, işte, böyle.',
  en: 'Um, uh, like, you know, I mean... Hmm, uh-huh.',
}

/**
 * transcribe(input, opts) → { language, segments:[{ start, end, text, words:[{ w, s, e, p }] }], model, device, duration, elapsed }
 *   input: dosya yolu ya da medya öğesi ({ audioPath, path })
 *   opts:  language ('tr' | 'auto' | …), model (id), translate, range:{start,end} (kaynak sn),
 *          quality: 'fast' (açgözlü, varsayılan) | 'accurate' (ışın araması 5),
 *          timing: 'dtw' (varsayılan; kelime başı ~35 ms hata, ~2 kat süre) | 'tokens' (hızlı; ~220 ms hata),
 *          vad (true: sessiz/müzikli bölümleri atla), verbatim (dolgu seslerini de yaz),
 *          minConfidence (0.15; müzik/oyun sesinde uydurulan düşük güvenli segmentleri atar),
 *          threads, gpu ('auto' | false), prompt, cache (true), onProgress({ phase, progress, label, device }), signal
 * Zamanlar kaynak medya saniyesidir (range verilmişse range.start eklenmiş olarak).
 */
export async function transcribe(input, opts = {}) {
  const env = capEnv()
  const { fs, path } = env
  if (!hasFs() || !env.cp) throw new Error('Otomatik altyazı yalnızca masaüstü uygulamasında çalışır')
  const t0 = Date.now()
  const onProgress = opts.onProgress || (() => {})
  const signal = opts.signal
  const lang = opts.language || 'tr'
  const modelId = opts.model ? opts.model : pickModel(DEFAULT_MODEL)
  if (!modelId) throw new Error('Önce bir konuşma tanıma modeli indirin')
  const model = getModel(modelId)
  const modelFile = resolveModelPath(modelId)
  if (!model || !modelFile) throw new Error(`"${model ? model.name : modelId}" modeli kurulu değil`)
  const bins = whisperBinaries()
  if (!bins.length) throw new Error('Konuşma tanıma motoru bulunamadı (vendor/whisper/bin)')
  const src = inputPath(input)
  const range = opts.range && opts.range.end > (opts.range.start || 0) ? { start: Math.max(0, opts.range.start || 0), end: opts.range.end } : (opts.range && opts.range.start > 0 ? { start: opts.range.start, end: 0 } : null)
  const quality = opts.quality || 'fast'
  const timing = opts.timing || 'dtw'
  const beam = quality === 'accurate' ? 5 : 1
  const threads = opts.threads || defaultThreads()
  const vad = opts.vad ? vadModelPath() : null
  const prompt = opts.prompt || (opts.verbatim ? (VERBATIM_PROMPTS[lang] || VERBATIM_PROMPTS.en) : '')
  const minProb = opts.minConfidence ?? 0.15

  // 1) ses
  onProgress({ phase: 'audio', progress: 0, label: 'Ses hazırlanıyor…' })
  const { wav, key } = await prepareAudio(src, { range, signal, onProgress: p => onProgress({ phase: 'audio', progress: p * 0.05, label: 'Ses hazırlanıyor…' }) })
  const audioSec = Math.max(0, (fileSize(wav) - 44) / 32000)

  const cacheKey = env.hashString(['t4', model.dtwLag, key, modelId, lang, opts.translate ? 1 : 0, beam, timing, vad ? 1 : 0, prompt, minProb].join('|'))
  const cwd = workDir()
  const cacheFile = path.join(cwd, `t-${cacheKey}.json`)
  if (opts.cache !== false) {
    const hit = memCache.get(cacheKey) || readJson(cacheFile)
    if (hit) {
      onProgress({ phase: 'done', progress: 1, label: 'Hazır' })
      return { ...structuredCloneSafe(hit), cached: true, elapsed: Date.now() - t0 }
    }
  }

  // 2) whisper-cli
  const modelArg = asciiModelArg(cwd, modelFile, modelId)
  const wavArg = path.basename(wav)
  const outBase = `o-${cacheKey}`
  const vadArg = vad ? asciiModelArg(cwd, vad, 'vad') : null
  const order = bins.filter(b => b.device === 'cpu' || (opts.gpu !== false && gpuState !== 'fail'))
  let res = null
  let used = null
  for (const b of order) {
    const args = buildArgs({ modelArg, wavArg, outArg: outBase, lang, threads, translate: !!opts.translate, beam, timing, dtw: model.dtw, vadArg, prompt })
    onProgress({ phase: 'load', progress: 0.06, label: 'Model yükleniyor…', device: b.device })
    let started = false
    const r = await spawnProc(b.bin, args, {
      cwd, signal,
      onLine: l => {
        const m = /progress\s*=\s*(\d+)%/.exec(l)
        if (m) { started = true; onProgress({ phase: 'transcribe', progress: 0.08 + 0.9 * (+m[1] / 100), label: `Konuşma yazıya dökülüyor… %${m[1]}`, device: b.device }) }
        else if (!started && /whisper_full|processing '/.test(l)) onProgress({ phase: 'transcribe', progress: 0.08, label: 'Konuşma yazıya dökülüyor…', device: b.device })
      },
    })
    if (r.aborted) { cleanup(cwd, outBase); throw abortError('Altyazı oluşturma iptal edildi') }
    if (b.device === 'gpu') {
      const usedGpu = /using (CUDA|Vulkan|vulkan|cuda)\d*|ggml_cuda_init|ggml_vulkan: Found/.test(r.err) && !/no GPU found/.test(r.err)
      if (r.code !== 0 || !usedGpu) {
        gpuState = 'fail'
        if (r.code === 0 && fileSize(path.join(cwd, outBase + '.json')) > 0) { res = r; used = { ...b, device: 'cpu' }; break }
        cleanup(cwd, outBase)
        continue
      }
      gpuState = 'ok'
    }
    res = r
    used = b
    break
  }
  const jsonFile = path.join(cwd, outBase + '.json')
  if (!res || res.code !== 0 || fileSize(jsonFile) <= 0) {
    cleanup(cwd, outBase)
    const tail = res ? res.err.trim().split('\n').filter(l => !/^whisper_|^ggml_|^load_backend|^system_info/.test(l)).slice(-3).join(' ') : ''
    throw new Error('Konuşma tanıma başarısız' + (res ? ` (kod ${res.code})` : '') + (tail ? ': ' + tail.slice(0, 240) : ''))
  }
  const buf = fs.readFileSync(jsonFile)
  cleanup(cwd, outBase)
  const parsed = parseWhisperJson(buf, { timing, dtwLag: model.dtwLag, offset: range ? range.start : 0, minProb })
  const result = {
    language: parsed.language || (lang !== 'auto' ? lang : null),
    segments: parsed.segments,
    model: modelId,
    device: used.device,
    duration: audioSec,
    range: range || null,
  }
  try { fs.writeFileSync(cacheFile, JSON.stringify(result)) } catch (e) { /* önbellek yazılamadı */ }
  memCache.set(cacheKey, result)
  onProgress({ phase: 'done', progress: 1, label: 'Hazır' })
  return { ...structuredCloneSafe(result), cached: false, elapsed: Date.now() - t0 }
}

// Yalnızca dil algıla → { language, probability }
export async function detectLanguage(input, { model, signal, range } = {}) {
  const { path } = capEnv()
  const modelId = model || pickModel(DEFAULT_MODEL)
  const modelFile = modelId && resolveModelPath(modelId)
  if (!modelFile) throw new Error('Önce bir konuşma tanıma modeli indirin')
  const bin = whisperBinaries().find(b => b.device === 'cpu')
  if (!bin) throw new Error('Konuşma tanıma motoru bulunamadı')
  const r0 = range || { start: 0, end: 30 }
  const { wav } = await prepareAudio(inputPath(input), { range: r0, signal })
  const cwd = workDir()
  const r = await spawnProc(bin.bin, ['-m', asciiModelArg(cwd, modelFile, modelId), '-f', path.basename(wav), '-l', 'auto', '-dl', '-t', String(defaultThreads())], { cwd, signal })
  if (r.aborted) throw abortError()
  const m = /auto-detected language:\s*(\w+)\s*\(p\s*=\s*([\d.]+)\)/.exec(r.err + r.out)
  if (!m) throw new Error('Dil algılanamadı')
  return { language: m[1], probability: +m[2] }
}

function cleanup(cwd, base) {
  const { fs, path } = capEnv()
  for (const ext of ['.json', '.txt', '.srt', '.vtt']) { try { fs.unlinkSync(path.join(cwd, base + ext)) } catch (e) { /* */ } }
}

function readJson(p) {
  try { return JSON.parse(capEnv().fs.readFileSync(p, 'utf8')) } catch (e) { return null }
}

function structuredCloneSafe(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o))
}

// Önbelleği temizle (ses + döküm dosyaları)
export function clearTranscriptCache() {
  const { fs, path } = capEnv()
  const cwd = workDir()
  memCache.clear()
  let n = 0
  for (const f of fs.readdirSync(cwd)) {
    if (/^(a|t|o)-[0-9a-f]+/.test(f)) { try { fs.unlinkSync(path.join(cwd, f)); n++ } catch (e) { /* */ } }
  }
  return n
}

// Tüm döküm metni
export function resultText(result) {
  return (result.segments || []).map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
}

export function resultWords(result) {
  const out = []
  for (const s of result.segments || []) for (const w of s.words || []) out.push(w)
  return out
}
