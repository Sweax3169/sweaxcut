// Gerçek uygulamayı (Electron + vite dev) CDP ile sürer: JS çalıştırır, ekran görüntüsü alır.
// Kullanım: node scripts/appshot.cjs <adımlar.json|-> ; adımlar: [{eval:"..."}, {wait:ms}, {shot:"out.png"}]
// Ortam: SWEAXCUT_DEV_URL (varsayılan http://localhost:5199/), APPSHOT_KEEP=1 uygulamayı açık bırakır
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const WebSocket = require('ws')
const PORT = 9333
const root = path.join(__dirname, '..')
const steps = JSON.parse(process.argv[2] === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(process.argv[2], 'utf8'))

function getJSON(u) { return new Promise((res, rej) => http.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej)) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const env = { ...process.env, SWEAXCUT_DEV_URL: process.env.SWEAXCUT_DEV_URL || 'http://localhost:5199/', SWEAXCUT_DEBUG_PORT: String(PORT), SWEAXCUT_MAX: '0' }
  delete env.ELECTRON_RUN_AS_NODE
  if (process.env.APPSHOT_PROD) delete env.SWEAXCUT_DEV_URL
  const app = spawn(path.join(root, 'node_modules/electron/dist/electron.exe'), ['.'], { cwd: root, env, stdio: 'ignore' })
  let target = null
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500)
    try { const list = await getJSON(`http://127.0.0.1:${PORT}/json`); target = list.find(t => t.type === 'page') } catch (e) { /* */ }
  }
  if (!target) { console.log('CDP bağlanamadı'); app.kill(); process.exit(1) }
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false })
  await new Promise(r => ws.on('open', r))
  let id = 0
  const pending = new Map()
  const logs = []
  ws.on('message', m => {
    const j = JSON.parse(m)
    if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id) }
    if (j.method === 'Runtime.consoleAPICalled') logs.push('[' + j.params.type + '] ' + j.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    if (j.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + (j.params.exceptionDetails.exception?.description || j.params.exceptionDetails.text))
  })
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Runtime.enable')
  await send('Page.enable')
  // uygulama kabuğu çizilene kadar bekle (soğuk vite yüklemesi uzun sürebilir)
  for (let i = 0; i < 60; i++) {
    const r = await send('Runtime.evaluate', { expression: "!!document.querySelector('.titlebar')", returnByValue: true })
    if (r.result && r.result.result && r.result.result.value) break
    await sleep(500)
  }
  await sleep(800)
  for (const s of steps) {
    if (s.wait) await sleep(s.wait)
    if (s.eval) {
      const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true })
      const v = r.result && r.result.result
      console.log('EVAL>', s.label || s.eval.slice(0, 60).replace(/\s+/g, ' '), '=>', JSON.stringify(v && (v.value !== undefined ? v.value : v.description)).slice(0, 1500))
      if (r.result && r.result.exceptionDetails) console.log('  EXC', r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)
    }
    if (s.shot) {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      fs.mkdirSync(path.dirname(path.resolve(root, s.shot)), { recursive: true })
      fs.writeFileSync(path.resolve(root, s.shot), Buffer.from(r.result.data, 'base64'))
      console.log('SHOT', s.shot)
    }
  }
  console.log('--- konsol ---\n' + logs.slice(-60).join('\n'))
  if (!process.env.APPSHOT_KEEP) { try { await send('Runtime.evaluate', { expression: "require('electron').ipcRenderer.send('win:force-close')" }) } catch (e) { /* */ } await sleep(500); app.kill() }
  process.exit(0)
})()
