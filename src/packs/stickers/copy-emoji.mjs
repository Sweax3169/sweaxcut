// Emoji SVG'lerini Twemoji paketinden public/stickers/emoji/ altına kopyalar (uygulama bunu içe aktarmaz).
// Kullanım: npm pack @twemoji/svg@15.0.0 → açılan "package" klasörünün yolunu ver:
//   node src/packs/stickers/copy-emoji.mjs <twemoji-svg-klasoru>
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const srcDir = process.argv[2]
if (!srcDir || !fs.existsSync(srcDir)) { console.error('twemoji svg klasörü verilmedi'); process.exit(1) }
const { emojiList } = await import(pathToFileURL(path.join(here, 'emoji-data.js')).href)
const outDir = path.join(root, 'public', 'stickers', 'emoji')
fs.mkdirSync(outDir, { recursive: true })

const list = emojiList()
const missing = []
const seen = new Set()
let n = 0
for (const e of list) {
  if (seen.has(e.code)) { console.log('tekrar:', e.ch, e.name); continue }
  seen.add(e.code)
  // aday adlar: hesaplanan, FE0F'siz, FE0F'li
  const cps = [...e.ch].map(c => c.codePointAt(0).toString(16))
  const cands = [e.code, cps.filter(c => c !== 'fe0f').join('-'), cps.join('-')]
  const hit = cands.find(c => fs.existsSync(path.join(srcDir, c + '.svg')))
  if (!hit) { missing.push(e); continue }
  fs.copyFileSync(path.join(srcDir, hit + '.svg'), path.join(outDir, e.code + '.svg'))
  n++
}
console.log('kopyalandı:', n, '/', list.length)
if (missing.length) console.log('EKSİK:', missing.map(e => e.ch + ' ' + e.name + ' (' + e.code + ')').join(', '))
