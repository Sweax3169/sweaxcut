'use strict'

// SWEAXCUT 2 — ana süreç. Renderer Node erişimli çalışır (yerel masaüstü aracı; medya işleri renderer'da).

const { app, BrowserWindow, ipcMain, dialog, shell, screen, systemPreferences } = require('electron')
const path = require('path')
const fs = require('fs')

if (process.env.SWEAXCUT_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.SWEAXCUT_DEBUG_PORT)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('force_high_performance_gpu')
// enable/disable-features tek seferde verilmeli (sonraki çağrı öncekini ezer)
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,SharedArrayBuffer')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

function fixAsar(p) {
  if (!p) return p
  return p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)
}

let ffmpegPath = 'ffmpeg'
let ffprobePath = 'ffprobe'
try { ffmpegPath = fixAsar(require('ffmpeg-static')) } catch (e) { /* yok */ }
// ffprobe, ffmpeg.exe ile aynı gyan.dev 6.1.1 derlemesinden: scripts/fetch-ffprobe.cjs vendor/ffprobe/ altına koyar
const bundledProbe = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'vendor', 'ffprobe', 'ffprobe.exe')
if (fs.existsSync(bundledProbe)) ffprobePath = bundledProbe

const MEDIA_EXTS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.mts', '.m2ts', '.wmv', '.flv', '.3gp', '.mpg', '.mpeg',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wma', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.sweax']

let win = null
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

function argvFiles(argv) {
  return argv.filter(a => typeof a === 'string' && !a.startsWith('-') && MEDIA_EXTS.includes(path.extname(a).toLowerCase()) && fs.existsSync(a))
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  win = new BrowserWindow({
    width: Math.min(1720, width),
    height: Math.min(1020, height),
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    show: false,
    backgroundColor: '#0b0b0c',
    title: 'SWEAXCUT',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => { win.show(); if (process.env.SWEAXCUT_MAX !== '0') win.maximize() })
  const dev = process.env.SWEAXCUT_DEV_URL
  if (dev) win.loadURL(dev)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  win.on('maximize', () => win && win.webContents.send('window:state', { maximized: true }))
  win.on('unmaximize', () => win && win.webContents.send('window:state', { maximized: false }))
  win.on('close', (e) => {
    if (win && !win.__forceClose) {
      e.preventDefault()
      win.webContents.send('app:before-close')
    }
  })
  win.webContents.once('did-finish-load', () => {
    const files = argvFiles(process.argv.slice(1))
    if (files.length) win.webContents.send('files:open', files)
  })
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
}

app.on('second-instance', (_e, argv) => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  const files = argvFiles(argv.slice(1))
  if (files.length) win.webContents.send('files:open', files)
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) systemPreferences.askForMediaAccess('microphone')
  createWindow()
})
app.on('window-all-closed', () => app.quit())

// ---------------------------------------------------------------- IPC

ipcMain.on('app:paths', (e) => {
  const appRoot = path.join(__dirname, '..')
  e.returnValue = {
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    videos: app.getPath('videos'),
    music: app.getPath('music'),
    desktop: app.getPath('desktop'),
    temp: app.getPath('temp'),
    ffmpeg: ffmpegPath,
    ffprobe: ffprobePath,
    appRoot,
    resources: app.isPackaged ? process.resourcesPath : appRoot,
    vendor: app.isPackaged ? path.join(process.resourcesPath, 'vendor') : path.join(appRoot, 'vendor'),
    isPackaged: app.isPackaged,
    version: app.getVersion(),
  }
})

ipcMain.handle('dialog:open', async (_e, opts) => {
  const r = await dialog.showOpenDialog(win, opts || {})
  return r.canceled ? [] : r.filePaths
})

ipcMain.handle('dialog:save', async (_e, opts) => {
  const r = await dialog.showSaveDialog(win, opts || {})
  return r.canceled ? null : r.filePath
})

ipcMain.handle('dialog:message', async (_e, opts) => {
  const r = await dialog.showMessageBox(win, opts || {})
  return r.response
})

ipcMain.on('win:minimize', () => win && win.minimize())
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize() })
ipcMain.on('win:close', () => win && win.close())
ipcMain.on('win:force-close', () => { if (win) { win.__forceClose = true; win.close() } })
ipcMain.on('win:fullscreen', (_e, v) => win && win.setFullScreen(!!v))
ipcMain.handle('shell:show', (_e, p) => { shell.showItemInFolder(p); return true })
ipcMain.handle('shell:open', (_e, p) => shell.openPath(p))
ipcMain.handle('shell:external', (_e, url) => shell.openExternal(url))
ipcMain.on('win:progress', (_e, v) => win && win.setProgressBar(v == null ? -1 : v))
