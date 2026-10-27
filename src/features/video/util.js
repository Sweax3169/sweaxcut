// Video araçları ortak yardımcıları: iptal edilebilir ffmpeg, ham kare akışı, kaynak bilgisi, türev kaydı.

import { store } from '../../core/store.js'
import { appPaths, fs, path, cp, run, cacheDir, killTree } from '../../platform/node.js'
import { sourceTime } from '../../core/time.js'

export const ffmpegBin = () => appPaths().ffmpeg
export const ffprobeBin = () => appPaths().ffprobe

export function exists(p) { try { return fs.statSync(p).size > 0 } catch (e) { return false } }
export function rm(p) { try { fs.unlinkSync(p) } catch (e) { /* yok */ } }

export function abortError() {
  const e = new Error('İşlem iptal edildi')
  e.name = 'AbortError'
  return e
}
export function checkAbort(signal) { if (signal && signal.aborted) throw abortError() }
export const isAbort = e => e && e.name === 'AbortError'

// Ana iş parçacığına nefes aldır (arayüz donmasın)
export const tick = () => new Promise(r => setTimeout(r, 0))

// İlerleme bildirimi: hem geri çağırma hem (istenirse) store.busy
export function progressFn(onProgress, label) {
  let last = -1, lastAt = 0
  return (p) => {
    p = Math.max(0, Math.min(1, p))
    const now = performance.now()
    if (p < 1 && Math.abs(p - last) < 0.005 && now - lastAt < 250) return
    last = p; lastAt = now
    if (onProgress) { try { onProgress(p) } catch (e) { /* */ } }
    if (label) store.busy(label, p)
  }
}

// ffmpeg'i iptal edilebilir çalıştır. duration verilirse -progress ile 0..1 bildirir.
export async function runFF(args, { signal, cwd, duration, onProgress, onStderr } = {}) {
  checkAbort(signal)
  const keep = {}
  const onAbort = () => killTree(keep.child)
  if (signal) signal.addEventListener('abort', onAbort, { once: true })
  const full = duration && onProgress ? ['-progress', 'pipe:2', '-nostats', ...args] : args
  try {
    const r = await run(ffmpegBin(), full, {
      cwd, keep,
      onStderr: (s) => {
        if (onStderr) onStderr(s)
        if (duration && onProgress) {
          const m = /out_time_us=(\d+)/.exec(s) || /out_time_ms=(\d+)/.exec(s)
          if (m) onProgress(Math.min(1, +m[1] / 1e6 / duration))
        }
      },
    })
    checkAbort(signal)
    return r
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

// ------------------------------------------------------------ kaynak bilgisi
const STD = [[23.976, '24000/1001'], [29.97, '30000/1001'], [59.94, '60000/1001'], [47.952, '48000/1001'], [119.88, '120000/1001']]
const rate = s => { if (!s) return 0; const [n, d] = String(s).split('/').map(Number); return n && d ? n / d : +s || 0 }

const infoCache = new Map()
// Dışa aktarımla aynı kurallar: kare hızı kesri, renk matrisi, döndürme sonrası boyut
export async function probeVideo(file) {
  if (infoCache.has(file)) return infoCache.get(file)
  const r = await run(ffprobeBin(), ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  if (r.code !== 0) throw new Error('Dosya okunamadı: ' + (r.err || '').slice(-200))
  const j = JSON.parse(r.out || '{}')
  const st = j.streams || []
  const v = st.find(s => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic))
  if (!v) throw new Error('Video akışı yok')
  const a = st.find(s => s.codec_type === 'audio')
  const rr = rate(v.r_frame_rate), avg = rate(v.avg_frame_rate)
  let F = (rr > 0 && rr <= 240 && (!avg || Math.abs(rr - avg) / rr < 0.05)) ? rr : (avg > 0 && avg <= 240 ? avg : 30)
  let Fstr = (rr > 0 && Math.abs(rr - F) < 1e-3 && /^\d+\/\d+$/.test(v.r_frame_rate)) ? v.r_frame_rate
    : (avg > 0 && Math.abs(avg - F) < 1e-3 && /^\d+\/\d+$/.test(v.avg_frame_rate)) ? v.avg_frame_rate : null
  if (!Fstr) { const s = STD.find(([f]) => Math.abs(F - f) < 0.01); Fstr = s ? s[1] : String(Math.round(F * 1000) / 1000) }
  // 1000/1 gibi aşırı değerler (değişken kare hızlı telefon kaydı) → ortalama
  if (F > 120 && avg > 0 && avg <= 120) { F = avg; Fstr = v.avg_frame_rate }
  F = rate(Fstr) || F
  let rotation = 0
  if (v.tags && v.tags.rotate) rotation = +v.tags.rotate
  const sd = (v.side_data_list || []).find(x => x.rotation != null)
  if (sd) rotation = -(+sd.rotation)
  rotation = ((rotation % 360) + 360) % 360
  let width = v.width, height = v.height
  if (rotation === 90 || rotation === 270) [width, height] = [height, width]
  const cs = v.color_space || ''
  const matrix = /bt709/.test(cs) ? 'bt709' : /(bt470|smpte170|bt601|fcc)/.test(cs) ? 'bt601' : (height >= 720 || width >= 1280 ? 'bt709' : 'bt601')
  const range = (v.color_range === 'pc' || /^yuvj/.test(v.pix_fmt || '')) ? 'pc' : 'tv'
  const duration = +(j.format && j.format.duration) || +v.duration || 0
  const info = { F, Fstr, width, height, duration, rotation, matrix, range, hasAudio: !!a, acodec: a ? a.codec_name : null, vcodec: v.codec_name, pix: v.pix_fmt }
  infoCache.set(file, info)
  return info
}

// ------------------------------------------------------------ ham kare akışı (ffmpeg stdout → RGBA kareler)
// Geri basınç: kuyruk dolunca stdout duraklatılır. recycle(buf) ile tampon havuza döner.
export class FrameStream {
  constructor(args, frameBytes, { signal, highWater = 6 } = {}) {
    this.frameBytes = frameBytes
    this.queue = []
    this.pool = []
    this.waiters = []
    this.ended = false
    this.err = ''
    this.highWater = highWater
    this.cur = null
    this.off = 0
    this.count = 0
    const child = cp.spawn(ffmpegBin(), args, { windowsHide: true })
    this.child = child
    this.onAbort = () => this.close()
    if (signal) { this.signal = signal; signal.addEventListener('abort', this.onAbort, { once: true }) }
    child.stdout.on('data', (d) => this._data(d))
    child.stderr.on('data', (d) => { this.err = (this.err + d.toString()).slice(-4000) })
    this.done = new Promise((resolve) => {
      const fin = (code) => { this.ended = true; this.code = code; this._wake(); resolve(code) }
      child.on('close', fin)
      child.on('error', (e) => { this.err += String(e); fin(-1) })
    })
  }

  _buf() { return this.pool.pop() || Buffer.allocUnsafe(this.frameBytes) }

  _data(d) {
    if (this.closed) return
    let i = 0
    while (i < d.length) {
      if (!this.cur) { this.cur = this._buf(); this.off = 0 }
      const n = Math.min(d.length - i, this.frameBytes - this.off)
      d.copy(this.cur, this.off, i, i + n)
      this.off += n; i += n
      if (this.off === this.frameBytes) {
        this.queue.push(this.cur)
        this.cur = null
        this.count++
        this._wake()
      }
    }
    if (this.queue.length >= this.highWater) this.child.stdout.pause()
  }

  _wake() { const w = this.waiters; this.waiters = []; for (const f of w) f() }

  // Sonraki kare (Buffer) ya da akış bitti ise null
  async next() {
    for (;;) {
      if (this.queue.length) {
        const b = this.queue.shift()
        if (this.queue.length < this.highWater && this.child.stdout.isPaused()) this.child.stdout.resume()
        return b
      }
      if (this.ended || this.closed) return null
      if (this.child.stdout.isPaused()) this.child.stdout.resume()
      await new Promise(r => this.waiters.push(r))
    }
  }

  recycle(b) { if (b && b.length === this.frameBytes && this.pool.length < 8) this.pool.push(b) }

  // Erken bitir: duraklatılmış stdout'ta bekleyen veri boşaltılmazsa 'close' olayı hiç gelmez → akıt ve at
  close() {
    if (this.signal) this.signal.removeEventListener('abort', this.onAbort)
    this.closed = true
    this.queue = []
    try { this.child.stdout.resume() } catch (e) { /* */ }
    if (!this.ended) killTree(this.child)
    this._wake()
  }
}

// stdin'e ham kare yazan kodlayıcı; aynı tampon yazılırken yeniden kullanılmasın diye write() bitişini bekler
export class FrameSink {
  constructor(args, { signal, cwd } = {}) {
    const child = cp.spawn(ffmpegBin(), args, { windowsHide: true, cwd })
    this.child = child
    this.err = ''
    this.broken = false
    child.stderr.on('data', (d) => { this.err = (this.err + d.toString()).slice(-4000) })
    child.stdin.on('error', () => { this.broken = true })
    child.stdout.resume() // çıktı dosyaya gider; boruyu akıt ki 'close' gecikmesin
    this.onAbort = () => killTree(child)
    if (signal) { this.signal = signal; signal.addEventListener('abort', this.onAbort, { once: true }) }
    this.done = new Promise((resolve) => {
      child.on('close', (code) => resolve(code))
      child.on('error', (e) => { this.err += String(e); resolve(-1) })
    })
  }

  // Yazım tamamlanınca (tampon serbest) çözülür
  write(buf) {
    if (this.broken) return Promise.reject(new Error('Kodlayıcı kapandı: ' + this.err.slice(-300)))
    return new Promise((resolve, reject) => {
      this.child.stdin.write(buf, (e) => (e ? reject(e) : resolve()))
    })
  }

  async end() {
    try { this.child.stdin.end() } catch (e) { /* */ }
    const code = await this.done
    if (this.signal) this.signal.removeEventListener('abort', this.onAbort)
    return code
  }

  kill() { killTree(this.child) }
}

// ------------------------------------------------------------ medya / klip yardımcıları
export function getMedia(id) { return store.get().project.media[id] }

export function findClipById(id) {
  for (const t of store.get().project.tracks) {
    const c = t.clips.find(x => x.id === id)
    if (c) return { clip: c, track: t }
  }
  return null
}

export function mediaCache(media) { return cacheDir('media', media.key || media.id) }

// media.variants'a yaz (geçmişe girmez — işlenmiş türev bir önbellek kaydıdır)
export function setVariant(mediaId, key, file) {
  store.edit('Türev', d => {
    const m = d.media[mediaId]
    if (!m) return
    m.variants = { ...(m.variants || {}), [key]: file }
  }, { noHistory: true })
}

// Kaynak zamanı → klip yerel zamanı (hız eğrisi / ters dahil, sayısal ters çevirme)
export function sourceToLocal(clip, st) {
  const D = clip.duration
  if (clip.freeze) return null
  const lo = Math.min(clip.in, clip.out), hi = Math.max(clip.in, clip.out)
  if (st < lo - 1e-6 || st > hi + 1e-6) return null
  if (!clip.speedCurve) {
    const span = Math.max(1e-6, clip.out - clip.in)
    const p = clip.reverse ? (clip.out - st) / span : (st - clip.in) / span
    return p * D
  }
  // sourceTime monoton: ikili arama
  let a = 0, b = D
  const inc = !clip.reverse
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2
    const v = sourceTime(clip, m)
    if ((v < st) === inc) a = m; else b = m
  }
  return (a + b) / 2
}

export function localToTimeline(clip, lt) { return clip.start + lt }

export function sourceToTimeline(clip, st) {
  const lt = sourceToLocal(clip, st)
  return lt == null ? null : clip.start + lt
}

// Çift sayıya yuvarlanmış hedef boyut (uzun kenar ve kısa kenar sınırı)
export function fitSize(w, h, maxLong, maxShort) {
  const long = Math.max(w, h), short = Math.min(w, h)
  const k = Math.min(1, maxLong / long, maxShort / short)
  const ew = Math.max(2, Math.round(w * k / 2) * 2)
  const eh = Math.max(2, Math.round(h * k / 2) * 2)
  return { w: ew, h: eh }
}

export { fs, path, cacheDir, run }
