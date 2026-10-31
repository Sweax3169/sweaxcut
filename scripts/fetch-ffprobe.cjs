'use strict'
// ffprobe.exe'yi vendor/ffprobe/ altına indirir. ffmpeg-static'teki ffmpeg.exe ile AYNI derlemeden gelir
// (gyan.dev 6.1.1 essentials; iki exe'nin aynı zip'ten çıktığı SHA-256 ile doğrulandı).
// Kullanım: node scripts/fetch-ffprobe.cjs          (doğru dosya zaten varsa atlar)
// Kaynak: github.com/GyanD/codexffmpeg sürüm 6.1.1 (gyan.dev derlemelerinin GitHub yansısı), GPL-3.0-or-later.
// FFmpeg kaynak kodu: https://github.com/FFmpeg/FFmpeg/commit/e38092ef93

const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const VENDOR = path.join(ROOT, 'vendor', 'ffprobe')
const ZIP_URL = 'https://github.com/GyanD/codexffmpeg/releases/download/6.1.1/ffmpeg-6.1.1-essentials_build.zip'
const ZIP_SHA256 = '742e32fc9f92681f9f254b925e1b613fdd8074ba40749d4879aefdb009b94cc5'
const EXE_SHA256 = '3a7e2dc003dc2cd1472827e4c7c4f056ae1ae0ae7c5bbc580c99b49827351ba4'
const DIR = 'ffmpeg-6.1.1-essentials_build'

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function download(url, out, n = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'sweaxcut-build' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 8) {
        res.resume()
        return resolve(download(new URL(res.headers.location, url).href, out, n + 1))
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' → HTTP ' + res.statusCode)) }
      const total = +res.headers['content-length'] || 0
      let got = 0, last = 0
      const tmp = out + '.part'
      const ws = fs.createWriteStream(tmp)
      res.on('data', d => {
        got += d.length
        if (total && Date.now() - last > 1000) { last = Date.now(); process.stdout.write(`  ${path.basename(out)} %${Math.round(got / total * 100)}\n`) }
      })
      res.pipe(ws)
      ws.on('finish', () => { ws.close(() => { fs.renameSync(tmp, out); resolve(got) }) })
      ws.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(120000, () => req.destroy(new Error('zaman aşımı')))
  })
}

async function main() {
  const exe = path.join(VENDOR, 'ffprobe.exe')
  if (fs.existsSync(exe) && sha256(exe) === EXE_SHA256) { console.log('ffprobe hazır: ' + exe); return }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sweaxcut-ffprobe-'))
  try {
    const zip = path.join(work, 'ffmpeg.zip')
    console.log('ffprobe indiriliyor (gyan.dev 6.1.1 essentials)…')
    await download(ZIP_URL, zip)
    if (sha256(zip) !== ZIP_SHA256) throw new Error('zip özeti tutmuyor: ' + zip)
    // Windows'un kendi bsdtar'ı zip açar (Git Bash'in GNU tar'ı "D:" yolunu uzak makine sanıyor)
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    const r = spawnSync(tar, ['-xf', zip, '-C', work, `${DIR}/bin/ffprobe.exe`, `${DIR}/LICENSE`, `${DIR}/README.txt`], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error('zip açılamadı: ' + r.stderr)
    const src = path.join(work, DIR)
    if (sha256(path.join(src, 'bin', 'ffprobe.exe')) !== EXE_SHA256) throw new Error('ffprobe.exe özeti tutmuyor')
    fs.mkdirSync(VENDOR, { recursive: true })
    // ffmpeg-static'in ffmpeg.exe.LICENSE / ffmpeg.exe.README adlandırmasıyla aynı
    fs.copyFileSync(path.join(src, 'bin', 'ffprobe.exe'), exe)
    fs.copyFileSync(path.join(src, 'LICENSE'), exe + '.LICENSE')
    fs.copyFileSync(path.join(src, 'README.txt'), exe + '.README')
    console.log('ffprobe hazır: ' + exe)
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
