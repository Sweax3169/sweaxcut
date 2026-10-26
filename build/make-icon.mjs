// SWEAXCUT ikonu: şeker gradyanlı dikey telefon çerçevesi + play + pop-it noktaları
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4fa3"/>
      <stop offset="1" stop-color="#9b5cff"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d0f2e"/>
      <stop offset="1" stop-color="#120a1c"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="161" y="84" width="190" height="316" rx="40" fill="none" stroke="url(#g)" stroke-width="26" filter="url(#glow)"/>
  <path d="M225 186 L318 242 L225 298 Z" fill="url(#g)" filter="url(#glow)"/>
  <circle cx="196" cy="446" r="17" fill="#ff4fa3"/>
  <circle cx="256" cy="446" r="17" fill="#c95cd6"/>
  <circle cx="316" cy="446" r="17" fill="#9b5cff"/>
</svg>`

const master = await sharp(Buffer.from(svg)).png().toBuffer()
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = []
for (const s of sizes) {
  pngs.push(await sharp(master).resize(s, s).png().toBuffer())
}
const ico = await pngToIco(pngs)
fs.writeFileSync(path.join(dir, 'icon.ico'), ico)
fs.writeFileSync(path.join(dir, 'icon-512.png'), await sharp(master).resize(512, 512).png().toBuffer())
console.log('icon.ico + icon-512.png üretildi')
