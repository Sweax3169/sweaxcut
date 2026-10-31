// SWEAXCUT 3 ikonu: koyu zemin, çapraz kesilmiş kare çerçeve — sol parça beyaz, sağ parça kayıt kırmızısı
// ve kesik boyunca yukarı kaymış (logodaki LogoMark ile aynı geometri, 24 → 512 ölçek)
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

// 24'lük ızgaradaki işaret 512'de: ölçek 15, ortalama ofseti 76
const k = 15, o = 76
const P = (x, y) => `${(o + x * k).toFixed(1)},${(o + y * k).toFixed(1)}`
const left = `M${P(6, 3)} L${P(13.7, 3)} L${P(8.7, 21)} L${P(6, 21)} Q${P(3, 21)} ${P(3, 18)} L${P(3, 6)} Q${P(3, 3)} ${P(6, 3)} Z`
const right = `M${P(15.3, 3)} L${P(18, 3)} Q${P(21, 3)} ${P(21, 6)} L${P(21, 18)} Q${P(21, 21)} ${P(18, 21)} L${P(10.3, 21)} Z`
const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d222c"/><stop offset="1" stop-color="#0b0d12"/></linearGradient>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b5d"/><stop offset="1" stop-color="#df3328"/></linearGradient>
    <radialGradient id="glow" cx="0.62" cy="0.45" r="0.5"><stop offset="0" stop-color="#ff4b3e" stop-opacity="0.28"/><stop offset="1" stop-color="#ff4b3e" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>
  <rect x="2" y="2" width="508" height="508" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="4"/>
  <path d="${left}" fill="#f4f6fa"/>
  <path d="${right}" fill="url(#red)" transform="translate(${0.5 * k} ${-1.3 * k})"/>
</svg>`

const png512 = await sharp(Buffer.from(svg)).png().toBuffer()
fs.writeFileSync(path.join(dir, 'icon-512.png'), png512)
fs.writeFileSync(path.join(dir, 'icon.svg'), svg)
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(sizes.map(s => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer()))
fs.writeFileSync(path.join(dir, 'icon.ico'), await pngToIco(pngs))
fs.mkdirSync(path.join(dir, '..', 'public'), { recursive: true })
fs.writeFileSync(path.join(dir, '..', 'public', 'icon.png'), await sharp(Buffer.from(svg)).resize(128, 128).png().toBuffer())
console.log('ikon yazıldı')
