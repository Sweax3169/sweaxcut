'use strict'
// Piper (çevrimdışı metin-okuma) ikili dosyasını ve gömülü Türkçe sesi vendor/piper/ altına indirir.
// Kullanım: node scripts/fetch-piper.cjs          (zaten varsa atlar)
// Kaynaklar: github.com/rhasspy/piper sürüm 2023.11.14-2 (MIT) + Hugging Face ses modelleri (bkz. docs/licenses/audio.md)

const https = require('https')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const VENDOR = path.join(ROOT, 'vendor', 'piper')
const PIPER_ZIP = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
// gömülü ses(ler): veri kümesi CC0 (NabuCasa voice-datasets)
const BUNDLED = [
  { id: 'tr_TR-fahrettin-medium', onnx: 'https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/main/model.onnx', json: 'https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/main/config.json', size: 63201294 },
]

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
  fs.mkdirSync(path.join(VENDOR, 'voices'), { recursive: true })
  const exe = path.join(VENDOR, 'piper.exe')
  if (!fs.existsSync(exe)) {
    const zip = path.join(VENDOR, 'piper_windows_amd64.zip')
    console.log('piper indiriliyor…')
    await download(PIPER_ZIP, zip)
    // zip içinde "piper/" klasörü var → vendor/ altına aç
    // Windows'un kendi bsdtar'ı zip açar (Git Bash'in GNU tar'ı "D:" yolunu uzak makine sanıyor)
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    const r = spawnSync(tar, ['-xf', zip, '-C', path.dirname(VENDOR)], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error('zip açılamadı: ' + r.stderr)
    fs.unlinkSync(zip)
    // kullanılmayanları at: Arapça hareke modeli (Arapça ses yok), pkgconfig, katalog dışı dillerin sözlükleri
    for (const f of ['libtashkeel_model.ort']) { try { fs.unlinkSync(path.join(VENDOR, f)) } catch (e) { /* */ } }
    try { fs.rmSync(path.join(VENDOR, 'pkgconfig'), { recursive: true, force: true }) } catch (e) { /* */ }
    const keep = new Set(['tr', 'en', 'de', 'fr', 'es', 'ru', 'it', 'pt', 'nl', 'pl', 'uk'])
    const ed = path.join(VENDOR, 'espeak-ng-data')
    for (const f of fs.readdirSync(ed)) if (f.endsWith('_dict') && !keep.has(f.slice(0, -5))) fs.unlinkSync(path.join(ed, f))
  }
  for (const v of BUNDLED) {
    const onnx = path.join(VENDOR, 'voices', v.id + '.onnx')
    const json = onnx + '.json'
    if (!fs.existsSync(onnx) || fs.statSync(onnx).size !== v.size) { console.log(v.id + ' indiriliyor…'); await download(v.onnx, onnx) }
    if (!fs.existsSync(json)) await download(v.json, json)
  }
  // RNNoise modelleri (gürültü azaltma) — bkz. docs/licenses/audio.md
  const rn = path.join(ROOT, 'vendor', 'rnnoise')
  fs.mkdirSync(rn, { recursive: true })
  for (const m of ['std', 'bd', 'sh']) {
    const p = path.join(rn, m + '.rnnn')
    if (!fs.existsSync(p)) await download(`https://raw.githubusercontent.com/richardpl/arnndn-models/master/${m}.rnnn`, p)
  }
  console.log('tamam:', VENDOR)
}

main().catch(e => { console.error(e); process.exit(1) })
