'use strict'
// Belge görselleri için uygulama sürücüsü (CDP). Gerçek kullanıcı verisine dokunmaz:
// uygulama ayrı bir --user-data-dir ile açılır, ekran/fare kontrolü kullanılmaz.
//
// Kullanım: node scripts/docs-media/drive.cjs <adımlar.json>
// Adımlar: {eval:"js"} {wait:ms} {shot:"yol.png", clip?:{x,y,width,height}} {cdp:"Yöntem", params:{}}
//          {record:"başlat klasörü"} {record:false}  (Page.startScreencast kareleri + zaman damgaları)
// Ortam:  DRIVE_ATTACH=1        açık uygulamaya bağlan (9333), yeni süreç başlatma
//         DRIVE_URL=http://localhost:5201/   vite (HMR'siz) adresi; yoksa dist/ açılır
//         DRIVE_USERDATA=<klasör>  ayrı kullanıcı verisi (zorunlu değilse geçici klasör)
//         DRIVE_KEEP=1          bitince uygulamayı açık bırak
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const http = require('http')
const WebSocket = require('ws')

const PORT = 9333
const root = path.join(__dirname, '..', '..')
const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
function getJSON(u) { return new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej)) }

;(async () => {
  let app = null
  if (!process.env.DRIVE_ATTACH) {
    const env = { ...process.env, SWEAXCUT_DEBUG_PORT: String(PORT), SWEAXCUT_MAX: '0' }
    delete env.ELECTRON_RUN_AS_NODE
    if (process.env.DRIVE_URL) env.SWEAXCUT_DEV_URL = process.env.DRIVE_URL; else delete env.SWEAXCUT_DEV_URL
    const ud = process.env.DRIVE_USERDATA || fs.mkdtempSync(path.join(os.tmpdir(), 'sweaxcut-docs-'))
    app = spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), ['.', '--user-data-dir=' + ud], { cwd: root, env, stdio: 'ignore', detached: !!process.env.DRIVE_KEEP })
    if (process.env.DRIVE_KEEP) app.unref()
  }
  let target = null
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500)
    try { const list = await getJSON(`http://127.0.0.1:${PORT}/json`); target = list.find(t => t.type === 'page') } catch (e) { /* */ }
  }
  if (!target) { console.log('CDP bağlanamadı'); if (app) app.kill(); process.exit(1) }
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 })
  await new Promise(r => ws.on('open', r))
  let id = 0
  const pending = new Map()
  const logs = []
  let rec = null
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  ws.on('message', m => {
    const j = JSON.parse(m)
    if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id) }
    if (j.method === 'Runtime.consoleAPICalled') logs.push('[' + j.params.type + '] ' + j.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    if (j.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text))
    if (j.method === 'Page.screencastFrame') {
      const p = j.params
      send('Page.screencastFrameAck', { sessionId: p.sessionId })
      if (rec) {
        const n = rec.frames.length
        const f = path.join(rec.dir, String(n).padStart(5, '0') + '.jpg')
        fs.writeFileSync(f, Buffer.from(p.data, 'base64'))
        rec.frames.push({ f: path.basename(f), t: p.metadata.timestamp })
      }
    }
  })
  await send('Runtime.enable')
  await send('Page.enable')
  for (let i = 0; i < 80; i++) {
    const r = await send('Runtime.evaluate', { expression: "!!document.querySelector('.titlebar')", returnByValue: true })
    if (r.result && r.result.result && r.result.result.value) break
    await sleep(500)
  }
  await sleep(600)
  for (const s of steps) {
    if (s.wait) await sleep(s.wait)
    if (s.eval) {
      const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true })
      const v = r.result && r.result.result
      console.log('EVAL>', s.label || s.eval.slice(0, 60).replace(/\s+/g, ' '), '=>', String(JSON.stringify(v && (v.value !== undefined ? v.value : v.description))).slice(0, 1200))
      if (r.result && r.result.exceptionDetails) console.log('  EXC', r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)
    }
    if (s.cdp) {
      const r = await send(s.cdp, s.params || {})
      console.log('CDP>', s.label || s.cdp, r.error ? 'HATA ' + JSON.stringify(r.error) : 'ok')
    }
    if (s.record) {
      const dir = path.resolve(root, s.record)
      fs.rmSync(dir, { recursive: true, force: true })
      fs.mkdirSync(dir, { recursive: true })
      rec = { dir, frames: [] }
      await send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
      console.log('REC başladı', dir)
    } else if (s.record === false && rec) {
      await send('Page.stopScreencast')
      await sleep(300)
      fs.writeFileSync(path.join(rec.dir, 'frames.json'), JSON.stringify(rec.frames))
      console.log('REC bitti', rec.frames.length, 'kare')
      rec = null
    }
    if (s.shot) {
      const params = { format: 'png' }
      if (s.clip) params.clip = { ...s.clip, scale: 1 }
      const r = await send('Page.captureScreenshot', params)
      fs.mkdirSync(path.dirname(path.resolve(root, s.shot)), { recursive: true })
      fs.writeFileSync(path.resolve(root, s.shot), Buffer.from(r.result.data, 'base64'))
      console.log('SHOT', s.shot)
    }
  }
  console.log('--- konsol ---\n' + logs.slice(-40).join('\n'))
  if (!process.env.DRIVE_KEEP && !process.env.DRIVE_ATTACH) {
    try { await send('Runtime.evaluate', { expression: "require('electron').ipcRenderer.send('win:force-close')" }) } catch (e) { /* */ }
    await sleep(500); if (app) app.kill()
  }
  process.exit(0)
})()
