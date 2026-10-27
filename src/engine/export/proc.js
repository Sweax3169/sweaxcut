// Dışa aktarma süreç yardımcıları: ffmpeg başlat, stderr kuyruğu, iptal ('q' → öldür), geçici dosyalar

import { cp, fs, path, appPaths } from '../../platform/node.js'

export function ffmpegPath() { return appPaths().ffmpeg }
export function ffprobePath() { return appPaths().ffprobe }

export class AbortErr extends Error {
  constructor(msg = 'Dışa aktarma iptal edildi') { super(msg); this.name = 'AbortError' }
}

// Uzun süren ffmpeg süreci. stdin/stdout borusu açık; stderr son 8 KB tutulur.
export function spawnFF(args, { stdin = false, stdout = false, bin } = {}) {
  if (!cp) throw new Error('ffmpeg çalıştırılamıyor (Node erişimi yok)')
  const child = cp.spawn(bin || ffmpegPath(), args, {
    windowsHide: true,
    stdio: [stdin ? 'pipe' : 'ignore', stdout ? 'pipe' : 'ignore', 'pipe'],
  })
  child.errTail = ''
  child.stderr.on('data', d => { child.errTail = (child.errTail + d.toString()).slice(-8000) })
  child.done = new Promise(resolve => {
    child.on('error', e => { child.errTail += '\n' + String(e && e.message || e); resolve(-1) })
    child.on('close', code => resolve(code == null ? -1 : code))
  })
  child.on('error', () => { /* done içinde işlendi */ })
  if (child.stdin) child.stdin.on('error', () => { /* süreç kapandıysa EPIPE */ })
  return child
}

// Süreci çalıştır ve bitmesini bekle. signal iptal ederse 'q' gönderilir, sonra öldürülür.
export async function runFF(args, { signal, onStderr, bin, input } = {}) {
  const child = spawnFF(args, { stdin: true, bin })
  if (onStderr) child.stderr.on('data', d => onStderr(d.toString()))
  let aborted = false
  const onAbort = () => { aborted = true; stopChild(child) }
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  if (input != null) { try { child.stdin.end(input) } catch (e) { /* */ } }
  const code = await child.done
  if (signal) signal.removeEventListener('abort', onAbort)
  if (aborted) throw new AbortErr()
  return { code, err: child.errTail }
}

// Kibar durdurma: stdin komut kanalıysa 'q', kısa süre sonra zorla öldür
export function stopChild(child, { graceful = true } = {}) {
  if (!child || child.exitCode != null || child.killed) return
  if (graceful && child.stdin && !child.stdin.destroyed) {
    try { child.stdin.write('q') } catch (e) { /* */ }
    try { child.stdin.end() } catch (e) { /* */ }
  }
  const t = setTimeout(() => { try { child.kill() } catch (e) { /* */ } }, graceful ? 600 : 0)
  child.done.then(() => clearTimeout(t))
}

export function killChild(child) {
  if (!child) return
  try { if (child.stdout) child.stdout.destroy() } catch (e) { /* */ }
  try { if (child.stdin) child.stdin.destroy() } catch (e) { /* */ }
  try { if (child.exitCode == null) child.kill() } catch (e) { /* */ }
}

export function tailErr(s, n = 400) {
  s = String(s || '').trim()
  return s.length > n ? '…' + s.slice(-n) : s
}

// Geçici çalışma klasörü
export function makeTempDir(tag = 'disa') {
  const base = (appPaths().temp) || (path && path.dirname(appPaths().userData))
  // yarıda kalmış (sayfa yenilenmiş / çökmüş) eski çalışma klasörlerini temizle
  try {
    for (const n of fs.readdirSync(base)) {
      if (!n.startsWith('sweaxcut-' + tag + '-')) continue
      const p = path.join(base, n)
      if (Date.now() - fs.statSync(p).mtimeMs > 6 * 3600e3) rmrf(p)
    }
  } catch (e) { /* */ }
  const dir = path.join(base, 'sweaxcut-' + tag + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function rmrf(p) {
  if (!p || !fs) return
  try { fs.rmSync(p, { recursive: true, force: true }) } catch (e) { /* */ }
}

export function unlinkQuiet(p) {
  if (!p || !fs) return
  try { fs.unlinkSync(p) } catch (e) { /* */ }
}

export function fileSize(p) {
  try { return fs.statSync(p).size } catch (e) { return 0 }
}

// ffprobe JSON
export async function probeJson(file, extra = ['-show_streams', '-show_format']) {
  const r = await new Promise((resolve) => {
    const child = cp.spawn(ffprobePath(), ['-v', 'error', '-print_format', 'json', ...extra, file], { windowsHide: true })
    const out = []
    child.stdout.on('data', d => out.push(d))
    child.on('error', () => resolve(null))
    child.on('close', code => resolve(code === 0 ? Buffer.concat(out).toString('utf8') : null))
  })
  if (!r) return null
  try { return JSON.parse(r) } catch (e) { return null }
}

// Mikro görev beklemesi (MessageChannel — 4 ms setTimeout sınırı yok)
let _mc = null, _q = []
export function yieldTask() {
  if (typeof MessageChannel === 'undefined') return new Promise(r => setTimeout(r, 0))
  if (!_mc) {
    _mc = new MessageChannel()
    _mc.port1.onmessage = () => { const q = _q; _q = []; for (const f of q) f() }
  }
  return new Promise(r => { _q.push(r); _mc.port2.postMessage(0) })
}
