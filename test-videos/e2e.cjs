'use strict'
// SWEAXCUT uçtan uca test: kurulu uygulamayı CDP ile sürer.
// Akış: uygulamayı videoyla aç → kuyruğa düştüğünü gör → DÖNÜŞTÜR'e bas →
// bitmesini bekle → çıktıyı ffprobe ile doğrula → ekran görüntüleri kaydet.

const { spawn, spawnSync } = require('child_process')
const http = require('http')
const fs = require('fs')
const path = require('path')
const WebSocket = require('ws')
const ff = require('../electron/ffmpeg.cjs')

const PORT = 9223
const exe = path.join(process.env.LOCALAPPDATA, 'Programs', 'SWEAXCUT', 'SWEAXCUT.exe')
const video = path.join(__dirname, 'oyun kaydı çılgın şölen.mp4')
const expectedOut = path.join(__dirname, 'oyun kaydı çılgın şölen_dikey.mp4')
const shotDir = path.join(__dirname, 'out')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl, { maxPayload: 64 * 1024 * 1024 })
    this.id = 0
    this.pending = new Map()
    this.ws.on('message', m => {
      const msg = JSON.parse(m)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
    this.ready = new Promise(r => this.ws.on('open', r))
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval hatası: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  async shot(name) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' })
    const p = path.join(shotDir, name)
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'))
    console.log('  📸 ' + name)
    return p
  }
}

async function main() {
  if (!fs.existsSync(exe)) throw new Error('Kurulu uygulama yok: ' + exe)
  if (fs.existsSync(expectedOut)) fs.unlinkSync(expectedOut)

  console.log('Uygulama başlatılıyor (video argümanıyla)...')
  spawn(exe, [video, `--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref()

  // CDP hedefini bekle
  let target = null
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500)
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`)
      target = list.find(t => t.type === 'page' && (t.title === 'SWEAXCUT' || (t.url || '').includes('index.html')))
    } catch (e) { /* henüz açılmadı */ }
  }
  if (!target) throw new Error('CDP hedefi bulunamadı')
  console.log('CDP bağlandı: ' + target.title)

  const cdp = new CDP(target.webSocketDebuggerUrl)
  await cdp.ready
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')

  // 1) Dosya argümandan kuyruğa düştü mü?
  let ok = false
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const n = await cdp.eval('document.querySelectorAll(".qitem").length')
    if (n >= 1) { ok = true; break }
  }
  if (!ok) throw new Error('Video kuyruğa eklenmedi')
  console.log('  ✔ video argümandan kuyruğa eklendi')

  // 2) probe bitip "Hazır" oldu mu?
  ok = false
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const t = await cdp.eval('(document.querySelector(".qitem .status-chip")||{}).textContent')
    if (t === 'Hazır') { ok = true; break }
  }
  if (!ok) throw new Error('Video "Hazır" durumuna geçmedi')
  console.log('  ✔ metadata okundu, durum: Hazır')

  await sleep(1200) // küçük görsel yerleşme payı (thumbnail vs.)
  await cdp.shot('e2e_1_acilis.png')

  // 3) GPU rozeti
  const gpuChip = await cdp.eval('(document.querySelector(".gpu-chip")||{}).textContent')
  console.log('  GPU rozeti: ' + gpuChip)

  // 4) DÖNÜŞTÜR
  await cdp.eval('document.querySelector(".convert-btn").click()')
  console.log('  ▶ DÖNÜŞTÜR tıklandı')

  // 5) bitmesini bekle
  ok = false
  for (let i = 0; i < 240; i++) {
    await sleep(1000)
    const done = await cdp.eval('document.querySelectorAll(".status-chip.done").length')
    const err = await cdp.eval('(document.querySelector(".qitem [style*=err]")||{}).textContent || ""')
    if (i % 5 === 0) {
      const label = await cdp.eval('(document.querySelector(".op-label")||{}).textContent')
      if (label) console.log('    ilerleme: ' + label)
    }
    if (done >= 1) { ok = true; break }
    const errChip = await cdp.eval('document.querySelectorAll(".status-chip.error").length')
    if (errChip >= 1) throw new Error('Dönüştürme HATA verdi: ' + err)
  }
  if (!ok) throw new Error('Dönüştürme zaman aşımı')
  console.log('  ✔ dönüştürme bitti')

  await sleep(800)
  await cdp.shot('e2e_2_bitti.png')

  // 6) çıktı doğrulama
  if (!fs.existsSync(expectedOut)) throw new Error('Çıktı dosyası yok: ' + expectedOut)
  const m = await ff.probe(expectedOut)
  console.log(`  ✔ çıktı: ${m.width}x${m.height}, ${m.duration.toFixed(2)} sn, video=${m.videoCodec}, ses=${m.audioCodec}`)
  if (m.width !== 1080 || m.height !== 1920) throw new Error('Çıktı çözünürlüğü yanlış!')

  console.log('\n===== E2E TAMAM: uygulama gerçek kullanıcı akışıyla çalışıyor =====')
  spawnSync('taskkill', ['/im', 'SWEAXCUT.exe', '/f', '/t'], { windowsHide: true })
}

main().catch(e => {
  console.error('E2E BAŞARISIZ:', e.message)
  spawnSync('taskkill', ['/im', 'SWEAXCUT.exe', '/f', '/t'], { windowsHide: true })
  process.exit(1)
})
