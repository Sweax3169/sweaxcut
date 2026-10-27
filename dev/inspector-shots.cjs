// Denetçi senaryo çekimleri: sayfayı bir kez açar, her senaryoyu çalıştırıp paneli ayrı PNG olarak kaydeder,
// sonda işlev doğrulamasını (__verify) koşar. Kullanım (Git Bash, kökte):
//   node_modules/electron/dist/electron.exe dev/inspector-shots.cjs
// Ortam: SHOTS_URL, SHOTS_DIR (test-videos/out/inspector), SHOTS_ONLY (ad listesi, virgüllü), SHOTS_H (1000), SHOTS_VERIFY=0
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

app.commandLine.appendSwitch('ignore-gpu-blocklist')
const url = process.env.SHOTS_URL || 'http://localhost:5199/dev/inspector.html'
const dir = process.env.SHOTS_DIR || 'test-videos/out/inspector'
const only = (process.env.SHOTS_ONLY || '').split(',').map(s => s.trim()).filter(Boolean)
const H = +(process.env.SHOTS_H || 1000)
const PW = +(process.env.SHOTS_PW || 330)
fs.mkdirSync(dir, { recursive: true })
const logFile = path.join(dir, 'shots.log')
fs.writeFileSync(logFile, '')
const out = (s) => { try { fs.appendFileSync(logFile, s + '\n') } catch (e) { /* */ } process.stdout.write(s + '\n') }

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000, height: H, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false },
  })
  win.webContents.on('console-message', (_e, level, message, line, src) => {
    const lv = ['LOG', 'WARN', 'ERR', 'ERR'][level] || 'LOG'
    out(`[${lv}] ${message}${level >= 2 ? `  (${path.basename(src || '')}:${line})` : ''}`)
  })
  // vite HMR soketini kes: diğer ekiplerin dosya değişiklikleri test sırasında sayfayı yeniden yüklemesin
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }))
  win.webContents.on('did-start-navigation', (_e, u, inPlace, main) => { if (main && !inPlace) out('NAV ' + u) })
  win.webContents.on('render-process-gone', (_e, d) => { out('RENDERER GONE ' + d.reason); app.exit(2) })
  await win.loadURL(url)
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    if (await win.webContents.executeJavaScript('!!window.__ready').catch(() => false)) break
    await new Promise(r => setTimeout(r, 150))
  }
  const names = await win.webContents.executeJavaScript('window.__scenarios || []')
  await new Promise(r => setTimeout(r, 600))
  await win.webContents.capturePage() // ısınma: gizli pencerenin ilk karesi bayat olabilir
  for (let i = 0; i < names.length; i++) {
    if (only.length && !only.includes(names[i]) && !only.includes(String(i))) continue
    const name = await win.webContents.executeJavaScript(`window.__run(${i})`).catch(e => { out('HATA ' + names[i] + ' ' + e.message); return names[i] })
    await new Promise(r => setTimeout(r, 260))
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: PW, height: H })
    const f = path.join(dir, String(i).padStart(2, '0') + '-' + name + '.png')
    fs.writeFileSync(f, img.toPNG())
    out('SHOT:' + path.resolve(f))
  }
  if (process.env.SHOTS_VERIFY !== '0') {
    const r = await win.webContents.executeJavaScript('window.__verify().then(r => JSON.stringify(r))').catch(e => JSON.stringify({ hata: e.message }))
    out('RESULT:' + r)
  }
  app.exit(0)
})
