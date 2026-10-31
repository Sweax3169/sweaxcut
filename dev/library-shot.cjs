// Kütüphane paneli görsel + işlev testi (Electron). devshot.cjs'in çok adımlı sürümü:
// app:paths IPC'sini de sağlar (ffmpeg, önbellek), sekmeleri gezer, her birinin ekran görüntüsünü alır, sonra işlev denetimlerini çalıştırır.
// Kullanım (Git Bash, kökte):
//   LIBSHOT_OUT=test-videos/out/lib node_modules/electron/dist/electron.exe dev/library-shot.cjs
// Ortam: LIBSHOT_URL (http://localhost:5199/dev/library.html), LIBSHOT_TABS (virgüllü), LIBSHOT_CHECKS=0 (denetimleri atla)

const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const root = path.join(__dirname, '..')
app.setPath('userData', path.join(os.tmpdir(), 'sweaxcut-libtest'))

const url = process.env.LIBSHOT_URL || 'http://localhost:5199/dev/library.html'
const out = process.env.LIBSHOT_OUT || 'test-videos/out/lib'
const W = +(process.env.LIBSHOT_W || 1280), H = +(process.env.LIBSHOT_H || 900)
const TABS = (process.env.LIBSHOT_TABS || 'media,audio,text,captions,stickers,effects,transitions,filters,layouts,tools').split(',')
const logFile = out + '.log'
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
fs.writeFileSync(logFile, '')
const log = (s) => { fs.appendFileSync(logFile, s + '\n'); try { process.stdout.write(s + '\n') } catch (e) { /* */ } }

let ffmpeg = 'ffmpeg', ffprobe = 'ffprobe'
try { ffmpeg = require(path.join(root, 'node_modules', 'ffmpeg-static')) } catch (e) { /* */ }
if (fs.existsSync(path.join(root, 'vendor', 'ffprobe', 'ffprobe.exe'))) ffprobe = path.join(root, 'vendor', 'ffprobe', 'ffprobe.exe')

ipcMain.on('app:paths', e => {
  e.returnValue = {
    userData: app.getPath('userData'), documents: app.getPath('documents'), videos: app.getPath('videos'), music: app.getPath('music'),
    desktop: app.getPath('desktop'), temp: app.getPath('temp'), ffmpeg, ffprobe, appRoot: root, resources: root,
    vendor: path.join(root, 'vendor'), isPackaged: false, version: 'test',
  }
})
ipcMain.handle('dialog:open', async () => [])
ipcMain.handle('dialog:save', async () => null)
ipcMain.handle('dialog:message', async () => 0)
ipcMain.handle('shell:show', async () => true)

const sleep = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false },
  })
  win.webContents.on('console-message', (_e, level, message, line, src) => {
    const lv = ['LOG', 'WARN', 'ERR', 'ERR'][level] || 'LOG'
    log(`[${lv}] ${message}${level >= 2 ? `  (${path.basename(src || '')}:${line})` : ''}`)
  })
  win.webContents.on('render-process-gone', (_e, d) => { log('RENDERER GONE ' + d.reason); app.exit(2) })
  const js = (code) => win.webContents.executeJavaScript(code)
  const shot = async (name) => {
    // gizli pencerede kare bayat kalmasın: iki rAF bekle + yeniden boya
    await js('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))').catch(() => null)
    win.webContents.invalidate()
    await sleep(160)
    await win.webContents.capturePage() // ilk yakalama bayat olabilir
    await sleep(250)
    const img = await win.webContents.capturePage(); const f = `${out}-${name}.png`; fs.writeFileSync(f, img.toPNG()); log('SHOT:' + path.resolve(f)) }
  const waitIdle = async (max = 8000) => { const t0 = Date.now(); await sleep(400); while (Date.now() - t0 < max) { const q = await js('window.__lib ? window.__lib.stats().queued : 0').catch(() => 0); if (!q) break; await sleep(250) } await sleep(300) }
  const hover = async (sel) => {
    const r = await js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } })()`)
    if (!r) return false
    win.webContents.sendInputEvent({ type: 'mouseMove', x: r.x, y: r.y })
    return true
  }
  await win.loadURL(url)
  const t0 = Date.now()
  const ready = process.env.LIBSHOT_READY || '!!window.__libReady'
  while (Date.now() - t0 < 60000) { if (await js(ready).catch(() => false)) break; await sleep(250) }
  await sleep(+(process.env.LIBSHOT_DELAY || 0))
  if (process.env.LIBSHOT_EVAL) { try { log('EVAL:' + JSON.stringify(await js(process.env.LIBSHOT_EVAL))) } catch (e) { log('EVAL FAILED ' + e) } }
  for (const tab of TABS) {
    await js(`(window.__lib ? __lib.setTab(${JSON.stringify(tab)}) : __sweax.store.setUI({ leftTab: ${JSON.stringify(tab)} }))`)
    await waitIdle()
    await shot(tab)
    if (tab === 'audio') {
      for (const [i, n] of [[1, 'sfx'], [2, 'voice'], [3, 'tts']]) { await js(`document.querySelectorAll('.lib-subgrid button')[${i}]?.click()`); await sleep(900); await shot('audio-' + n) }
      await js(`document.querySelectorAll('.lib-subgrid button')[0]?.click()`)
    }
    if (tab === 'stickers') {
      await js(`[...document.querySelectorAll('.lib-chips .chip')].find(b => /Yüzler/.test(b.textContent))?.click()`)
      await sleep(900); await shot('stickers-emoji')
      await js(`document.querySelector('.lib-chips .chip')?.click()`)
    }
    if (tab === 'effects' || tab === 'transitions' || tab === 'filters' || tab === 'text' || tab === 'stickers') {
      const sel = { effects: '.fx-card .thumb', transitions: '.tr-card .thumb', filters: '.flt-card .thumb', text: '.text-card .thumb', stickers: '.stk-card .thumb' }[tab]
      if (await hover(sel)) { await sleep(700); await shot(tab + '-hover') }
      win.webContents.sendInputEvent({ type: 'mouseMove', x: W - 10, y: H - 10 })
    }
  }
  if (process.env.LIBSHOT_CHECKS !== '0' && await js('!!window.__lib').catch(() => false)) {
    try {
      const res = await js('__lib.checks()')
      log('RESULT:' + res)
    } catch (e) { log('CHECKS FAILED ' + e) }
    await js(`__lib.setTab('effects')`)
    await js(`__lib.sample('frame')`)
    await sleep(600)
    await waitIdle()
    await shot('final-frame-sample')
  }
  app.exit(0)
})
