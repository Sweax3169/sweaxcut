'use strict'
// Belge görselleri için örnek görüntü üretir (kişisel kayıt KULLANILMAZ).
// Gizli bir Electron penceresinde footage.html içindeki GLSL sahnelerini kare kare çizer,
// ham RGBA kareleri ffmpeg'e borular → MP4. Ses: yok (müzik ve seslendirme uygulamanın içinden eklenir).
//
// Kullanım (Git Bash):
//   node_modules/electron/dist/electron.exe scripts/docs-media/footage.cjs <çıkış klasörü>
// Ortam: FOOTAGE_FFMPEG (varsayılan: ffmpeg-static), FOOTAGE_SECONDS (8), FOOTAGE_FPS (30)

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const out = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.cjs')) || 'docs-media-out')
fs.mkdirSync(out, { recursive: true })
let ffmpeg = process.env.FOOTAGE_FFMPEG
if (!ffmpeg) try { ffmpeg = require('ffmpeg-static') } catch (e) { ffmpeg = 'ffmpeg' }
const SECONDS = +process.env.FOOTAGE_SECONDS || 8
const FPS = +process.env.FOOTAGE_FPS || 30
const W = 1920, H = 1080

const SCENES = ['synthwave', 'tunnel', 'aurora', 'blocks']

app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 640, height: 360,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false },
  })
  await win.loadFile(path.join(__dirname, 'footage.html'))
  for (const scene of SCENES) {
    const file = path.join(out, scene + '.mp4')
    const ff = spawn(ffmpeg, ['-hide_banner', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
      '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] })
    const frames = SECONDS * FPS
    const t0 = Date.now()
    for (let f = 0; f < frames; f++) {
      const buf = await win.webContents.executeJavaScript(`window.renderFrame(${JSON.stringify(scene)}, ${f / FPS}, ${W}, ${H})`)
      if (!ff.stdin.write(Buffer.from(buf))) await new Promise(r => ff.stdin.once('drain', r))
    }
    ff.stdin.end()
    await new Promise(r => ff.on('close', r))
    console.log(scene, '->', file, ((Date.now() - t0) / 1000).toFixed(1) + ' s')
  }
  app.quit()
})
