// Node erişimi — Electron renderer'da nodeIntegration açık; tarayıcıda (vite dev) null döner.
// Bütün dosya sistemi / süreç işleri bu modül üzerinden gider ki tarayıcı önizlemesi çökmesin.

const req = typeof window !== 'undefined' && typeof window.require === 'function' ? window.require : null

export const isElectron = !!req
export const fs = req ? req('fs') : null
export const fsp = req ? req('fs/promises') : null
export const path = req ? req('path') : null
export const os = req ? req('os') : null
export const cp = req ? req('child_process') : null
export const crypto = req ? req('crypto') : null
export const ipc = req ? req('electron').ipcRenderer : null
export const nodeUrl = req ? req('url') : null

let _paths = null
// Uygulama klasörleri ana süreçten bir kez alınır (userData, documents, ffmpeg yolları, kaynaklar)
export function appPaths() {
  if (_paths) return _paths
  if (!ipc) {
    _paths = { userData: '/tmp/sweaxcut', documents: '/tmp', temp: '/tmp', ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', resources: '/', appRoot: '/', isPackaged: false }
    return _paths
  }
  _paths = ipc.sendSync('app:paths')
  return _paths
}

export function fileUrl(p) {
  if (!p) return ''
  if (/^(https?|data|blob|file):/.test(p)) return p
  if (nodeUrl) return nodeUrl.pathToFileURL(p).href
  return 'file:///' + encodeURI(p.replace(/\\/g, '/'))
}

// Sürükle-bırakla gelen dosyaların disk yolları. Electron 32+ File.path'i kaldırdı → webUtils.getPathForFile
const webUtils = req ? req('electron').webUtils : null
export function droppedPaths(dataTransfer) {
  return [...(dataTransfer?.files || [])].map(f => {
    try { if (webUtils && webUtils.getPathForFile) return webUtils.getPathForFile(f) || '' } catch (e) { /* eski Electron */ }
    return f.path || ''
  }).filter(Boolean)
}

export function ensureDir(dir) {
  if (!fs) return dir
  try { fs.mkdirSync(dir, { recursive: true }) } catch (e) { /* var */ }
  return dir
}

export function cacheDir(...parts) {
  const p = appPaths()
  // 'cache' DEĞİL: Windows'ta harf ayrımı olmadığından userData\Cache (Chromium'un HTTP önbelleği) ile aynı klasör olur ve
  // Chromium her açılışta orada kendi Cache_Data'sı dışındaki her şeyi siler (vekiller, dökümler, TTS her seferinde gidiyordu)
  return ensureDir(path ? path.join(p.userData, 'Onbellek', ...parts) : '/tmp/cache')
}

export function hashString(s) {
  if (crypto) return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(16)
}

// Bir süreci çalıştırır; stdout/stderr toplar. onStderr ilerleme ayrıştırması için.
export function run(bin, args, { onStdout, onStderr, cwd, input, keep } = {}) {
  return new Promise((resolve) => {
    if (!cp) { resolve({ code: -1, out: '', err: 'node yok' }); return }
    let child
    try {
      child = cp.spawn(bin, args, { windowsHide: true, cwd })
    } catch (e) {
      resolve({ code: -1, out: '', err: String(e) })
      return
    }
    if (keep) keep.child = child
    const outChunks = []
    let err = ''
    child.stdout.on('data', d => { outChunks.push(d); if (onStdout) onStdout(d) })
    child.stderr.on('data', d => { const s = d.toString(); err = (err + s).slice(-20000); if (onStderr) onStderr(s) })
    child.on('error', e => resolve({ code: -1, out: '', err: err + '\n' + String(e) }))
    child.on('close', code => {
      const buf = Buffer.concat(outChunks)
      resolve({ code, out: buf.toString('utf8'), buf, err })
    })
    if (input != null) { child.stdin.write(input); child.stdin.end() }
  })
}

export function killTree(child) {
  if (!child || child.killed || !cp) return
  try {
    if (process.platform === 'win32') cp.spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true })
    else child.kill('SIGKILL')
  } catch (e) { /* kapanmış */ }
}
