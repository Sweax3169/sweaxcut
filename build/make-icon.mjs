// SWEAXCUT 2 ikonu: grafit zemin, film karesi (perforasyonlu), limon sarısı çapraz kesik
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

const perf = (x) => Array.from({ length: 6 }, (_, i) => `<rect x="${x}" y="${92 + i * 58}" width="26" height="32" fill="#0d0e10"/>`).join('')
const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#0d0e10"/>
  <rect x="78" y="70" width="356" height="372" fill="#f1f1ec"/>
  ${perf(94)}${perf(392)}
  <rect x="142" y="92" width="228" height="328" fill="#0d0e10"/>
  <polygon points="300,40 380,40 212,472 132,472" fill="#e4ff3a"/>
  <polygon points="300,40 316,40 148,472 132,472" fill="#0d0e10" opacity="0.25"/>
</svg>`

const png512 = await sharp(Buffer.from(svg)).png().toBuffer()
fs.writeFileSync(path.join(dir, 'icon-512.png'), png512)
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(sizes.map(s => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer()))
fs.writeFileSync(path.join(dir, 'icon.ico'), await pngToIco(pngs))
fs.mkdirSync(path.join(dir, '..', 'public'), { recursive: true })
fs.writeFileSync(path.join(dir, '..', 'public', 'icon.png'), await sharp(Buffer.from(svg)).resize(128, 128).png().toBuffer())
console.log('ikon yazıldı')
