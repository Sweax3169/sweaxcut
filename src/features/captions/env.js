// Altyazı modülünün dış bağımlılıkları. Electron'da platform/node.js'ten gelir;
// Node testlerinde setCaptionEnv({ vendor, userData, ffmpeg, ... }) ile üzerine yazılır.
// Tarayıcıda (vite önizleme) fs/path null'dır: fonksiyonlar çökmeden "kurulu değil" davranır.

import * as node from '../../platform/node.js'

const over = {}

export function setCaptionEnv(o) { Object.assign(over, o || {}) }

export function capEnv() {
  const p = node.appPaths()
  const path = over.path || node.path
  let vendor = over.vendor || p.vendor || (path && p.appRoot ? path.join(p.appRoot, 'vendor') : null)
  let userData = over.userData || p.userData
  // süreçler başka klasörde koştuğu için yollar mutlak olmalı
  if (path && node.fs) { if (vendor) vendor = path.resolve(vendor); if (userData) userData = path.resolve(userData) }
  return {
    fs: node.fs,
    os: node.os,
    cp: node.cp,
    crypto: node.crypto,
    run: node.run,
    killTree: node.killTree,
    hashString: node.hashString,
    fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    ffmpeg: p.ffmpeg,
    ...over,
    path,
    vendor,
    userData,
  }
}

// Dosya sistemi var mı (Electron / Node)
export function hasFs() {
  const e = capEnv()
  return !!(e.fs && e.path && e.userData)
}

export function ensureDirSync(dir) {
  const { fs } = capEnv()
  if (fs && dir) { try { fs.mkdirSync(dir, { recursive: true }) } catch (e) { /* var */ } }
  return dir
}

// Çalışma klasörü: <userData>/cache/whisper (whisper-cli buradan göreli yollarla çağrılır)
export function workDir() {
  const { path, userData } = capEnv()
  if (!path) throw new Error('Otomatik altyazı yalnızca masaüstü uygulamasında çalışır')
  // platform/node.js cacheDir ile aynı kök (userData\Cache Chromium'a ait, açılışta temizlenir)
  return ensureDirSync(path.join(userData, 'Onbellek', 'whisper'))
}

export function fileSize(p) {
  try { return capEnv().fs.statSync(p).size } catch (e) { return -1 }
}

export function abortError(msg = 'İşlem iptal edildi') {
  const e = new Error(msg)
  e.name = 'AbortError'
  return e
}
