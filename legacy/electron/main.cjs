'use strict'

// SWEAXCUT ana süreç — Sweax Studios

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const ff = require('./ffmpeg.cjs')

let win = null

const settingsFile = () => path.join(app.getPath('userData'), 'sweaxcut-settings.json')

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
  } catch (e) {
    return {}
  }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(s || {}, null, 2), 'utf8')
    return true
  } catch (e) {
    return false
  }
}

// Komut satırıyla gelen video yolları ("Birlikte aç" / kısayola sürükleme)
function argvVideoPaths(argv) {
  return argv.filter(a =>
    typeof a === 'string' &&
    !a.startsWith('-') &&
    ff.VIDEO_EXTS.includes(path.extname(a).toLowerCase()) &&
    fs.existsSync(a)
  )
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 740,
    frame: false,
    show: false,
    backgroundColor: '#0f0a18',
    title: 'SWEAXCUT',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (process.env.SWEAXCUT_DEV_URL) {
    win.loadURL(process.env.SWEAXCUT_DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.on('maximize', () => win && win.webContents.send('window:state', { maximized: true }))
  win.on('unmaximize', () => win && win.webContents.send('window:state', { maximized: false }))

  win.webContents.once('did-finish-load', () => {
    const paths = argvVideoPaths(process.argv.slice(1))
    if (paths.length) safeSend(win.webContents, 'files:open', paths)
  })
}

// ---------------------------------------------------------------- kuyruk

const queueState = {
  running: false,
  cancelled: false,
  current: { child: null },
}

ipcMain.handle('queue:start', async (event, payload) => {
  if (queueState.running) return { ok: false, message: 'Zaten bir dönüştürme sürüyor.' }
  const { jobs, options } = payload || {}
  if (!Array.isArray(jobs) || jobs.length === 0) return { ok: false, message: 'Kuyrukta video yok.' }

  queueState.running = true
  queueState.cancelled = false
  const wc = event.sender

  ;(async () => {
    for (const job of jobs) {
      if (queueState.cancelled) {
        safeSend(wc, 'job:state', { id: job.id, state: 'cancelled' })
        continue
      }
      let output = null
      let overlayPath = null
      try {
        const meta = await ff.probe(job.input)
        output = job.output || ff.defaultOutput(job.input, options.outputDir)
        safeSend(wc, 'job:state', { id: job.id, state: 'processing', output })

        // Panel modu yazı PNG'si (renderer canvas'ından data URL olarak gelir)
        const jobOptions = { ...options }
        if (job.trim) jobOptions.trim = job.trim
        if (job.overlayPng && typeof job.overlayPng === 'string' && job.overlayPng.startsWith('data:image/png;base64,')) {
          overlayPath = path.join(app.getPath('temp'), `sweaxcut-overlay-${job.id}.png`)
          fs.writeFileSync(overlayPath, Buffer.from(job.overlayPng.slice('data:image/png;base64,'.length), 'base64'))
          jobOptions.overlayPngPath = overlayPath
        }

        // İlerleme mesajlarını 250 ms'de bire sınırla — IPC'yi ve arayüzü boğmasın
        let lastSent = 0
        const onProgress = p => {
          const now = Date.now()
          if (p.done || now - lastSent >= 250) {
            lastSent = now
            safeSend(wc, 'job:progress', { id: job.id, ...p })
          }
        }

        const wantGpu = !!options.useGpu
        try {
          await ff.convertOne(meta, jobOptions, output, onProgress, queueState.current, wantGpu)
        } catch (err) {
          if (queueState.cancelled) throw new Error('cancelled')
          if (wantGpu) {
            // GPU kodlayıcı düştü — kullanıcıyı bilgilendir, işlemciyle sil baştan dene
            safeSend(wc, 'job:note', { id: job.id, note: 'GPU kodlayıcı sorun çıkardı, işlemciyle yeniden deneniyor…' })
            await ff.convertOne(meta, jobOptions, output, onProgress, queueState.current, false)
          } else {
            throw err
          }
        }
        safeSend(wc, 'job:state', { id: job.id, state: 'done', output })
      } catch (err) {
        safeSend(wc, 'job:state', {
          id: job.id,
          state: queueState.cancelled ? 'cancelled' : 'error',
          message: ff.turkceHata(String((err && err.message) || err)),
        })
      } finally {
        if (overlayPath) { try { fs.unlinkSync(overlayPath) } catch (e) { /* önemsiz */ } }
      }
    }
    queueState.running = false
    safeSend(wc, 'queue:finished', { cancelled: queueState.cancelled })
  })()

  return { ok: true }
})

ipcMain.handle('queue:cancel', async () => {
  if (!queueState.running) return { ok: true }
  queueState.cancelled = true
  ff.cancelChild(queueState.current.child)
  return { ok: true }
})

function safeSend(wc, channel, data) {
  try { if (!wc.isDestroyed()) wc.send(channel, data) } catch (e) { /* pencere kapanmış */ }
}

// ---------------------------------------------------------------- IPC

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
}))

ipcMain.handle('probe', async (e, input) => {
  try {
    return { ok: true, meta: await ff.probe(input) }
  } catch (err) {
    return { ok: false, message: ff.turkceHata(String((err && err.message) || err)) }
  }
})

ipcMain.handle('gpu:detect', async () => {
  try { return await ff.detectNvenc() } catch (e) { return false }
})

ipcMain.handle('thumbnail', async (e, { input, time }) => {
  try {
    return { ok: true, dataUrl: await ff.thumbnail(input, time) }
  } catch (err) {
    return { ok: false }
  }
})

ipcMain.handle('files:choose', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Video seç',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video dosyaları', extensions: ff.VIDEO_EXTS.map(x => x.slice(1)) },
      { name: 'Tüm dosyalar', extensions: ['*'] },
    ],
  })
  return res.canceled ? [] : res.filePaths
})

ipcMain.handle('folder:choose', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Klasör seç',
    properties: ['openDirectory'],
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('music:choose', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Müzik seç',
    properties: ['openFile'],
    filters: [
      { name: 'Ses dosyaları', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wma'] },
      { name: 'Tüm dosyalar', extensions: ['*'] },
    ],
  })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('folder:scan', async (e, dir) => {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => ff.VIDEO_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(dir, f))
    return { ok: true, files }
  } catch (err) {
    return { ok: false, message: 'Klasör okunamadı.', files: [] }
  }
})

ipcMain.handle('path:show', async (e, p) => {
  try { shell.showItemInFolder(p) } catch (err) { /* önemsiz */ }
})

ipcMain.handle('path:open', async (e, p) => {
  try { await shell.openPath(p) } catch (err) { /* önemsiz */ }
})

ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:set', (e, s) => saveSettings(s))

ipcMain.on('window:control', (e, action) => {
  if (!win) return
  if (action === 'minimize') win.minimize()
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
  else if (action === 'close') win.close()
})

// ---------------------------------------------------------------- yaşam döngüsü

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      const paths = argvVideoPaths(argv.slice(1))
      if (paths.length) safeSend(win.webContents, 'files:open', paths)
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    ff.killTree(queueState.current.child)
    app.quit()
  })
}
