// Test aracı: bir sayfayı Electron'da (Node erişimli, WebGL açık) açar, konsolu yazdırır, ekran görüntüsü alır.
// Kullanım (Git Bash): DEVSHOT_URL=http://localhost:5199/dev/x.html DEVSHOT_OUT=test-videos/out/x.png node_modules/electron/dist/electron.exe scripts/devshot.cjs
// (URL'yi argüman olarak vermek Windows'ta Electron'u açılışta düşürüyor, ortam değişkeni kullan)
// Konsol çıktısı ayrıca <cikti>.log dosyasına yazılır (Windows'ta stdout boruya düşmeyebilir).
// Sayfa hazır olduğunda window.__done = true atamalı (yoksa zaman aşımında çekilir).
// window.__result içine konan JSON stdout'a "RESULT:" önekiyle basılır.

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// NOT: Windows'ta fazladan sayısal argümanlar Electron'u açılışta düşürüyor (çıkış 127) — ayarlar ortam değişkeniyle:
//   DEVSHOT_TIMEOUT (ms, 15000), DEVSHOT_W (1600), DEVSHOT_H (1000)
const args = process.argv.slice(2)
const url = process.env.DEVSHOT_URL || args[0]
const out = process.env.DEVSHOT_OUT || args[1] || 'devshot.png'
const timeout = +(process.env.DEVSHOT_TIMEOUT || 15000)
const W = +(process.env.DEVSHOT_W || 1600), H = +(process.env.DEVSHOT_H || 1000)
// Windows'ta GUI süreç stdout'u boruya düşmeyebilir: her şeyi <cikti>.log dosyasına da yaz
const logFile = out.replace(/\.png$/i, '') + '.log'
try { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(logFile, '') } catch (e) { /* */ }
const _w = process.stdout.write.bind(process.stdout)
process.stdout.write = (s) => { try { fs.appendFileSync(logFile, s) } catch (e) { /* */ } return _w(s) }
console.log = (...a) => process.stdout.write(a.join(' ') + '\n')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, paintWhenInitiallyHidden: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false, offscreen: false },
  })
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const lv = ['LOG', 'WARN', 'ERR', 'ERR'][level] || 'LOG'
    process.stdout.write(`[${lv}] ${message}${level >= 2 ? `  (${path.basename(sourceId || '')}:${line})` : ''}\n`)
  })
  win.webContents.on('render-process-gone', (_e, d) => { console.log('RENDERER GONE', d.reason); app.exit(2) })
  const u = /^(https?|file):/.test(url) ? url : 'file:///' + path.resolve(url).replace(/\\/g, '/')
  await win.loadURL(u)
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const done = await win.webContents.executeJavaScript('!!window.__done').catch(() => false)
    if (done) break
    await new Promise(r => setTimeout(r, 200))
  }
  try {
    const res = await win.webContents.executeJavaScript('JSON.stringify(window.__result ?? null)')
    if (res && res !== 'null') console.log('RESULT:' + res)
  } catch (e) { /* yok */ }
  const img = await win.webContents.capturePage()
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(out, img.toPNG())
  console.log('SHOT:' + path.resolve(out))
  app.exit(0)
})
