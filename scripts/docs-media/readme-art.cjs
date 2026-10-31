'use strict'
// README sanatı: hareketli SVG başlık (EN/TR × açık/koyu) ve dışa aktarma hattı şeması (EN/TR × açık/koyu).
// Yazılar opentype.js ile yola (path) çevrilir: GitHub SVG'yi <img> olarak gösterir, dış yazı tipi yükleyemez.
// opentype.js projenin bağımlılığı değil:  npm pack opentype.js@1.3.4  → paketi açıp OPENTYPE ortam değişkeniyle göster.
// Kullanım: OPENTYPE=<klasör>/package node scripts/docs-media/readme-art.cjs  → docs/art/*.svg
const fs = require('fs')
const path = require('path')
const opentype = require(process.env.OPENTYPE || 'opentype.js')

const ROOT = path.join(__dirname, '..', '..')
const OUT = path.join(ROOT, 'docs', 'art')
const NM = path.join(ROOT, 'node_modules', '@fontsource')
fs.mkdirSync(OUT, { recursive: true })

const load = (fam, w) => ['latin', 'latin-ext'].map(s => opentype.loadSync(path.join(NM, fam, 'files', `${fam}-${s}-${w}-normal.woff`)))
const BODONI = load('bodoni-moda', 700)
const MAN5 = load('manrope', 500)
const MAN7 = load('manrope', 700)
const MONO = load('jetbrains-mono', 400)

function layout(str, fonts, size, track = 0) {
  const items = []
  let x = 0, prev = null
  for (const ch of str) {
    const f = fonts.find(ff => ff.charToGlyph(ch).index > 0) || fonts[0]
    const g = f.charToGlyph(ch)
    if (prev && prev.f === f) x += f.getKerningValue(prev.g, g) * size / f.unitsPerEm
    items.push({ f, g, x })
    x += g.advanceWidth * size / f.unitsPerEm + track
    prev = { f, g }
  }
  return { items, w: Math.max(0, x - track) }
}
const width = (s, fonts, size, track) => layout(s, fonts, size, track).w
function text(s, fonts, size, x, y, o = {}) {
  const L = layout(s, fonts, size, o.track || 0)
  const x0 = x - (o.anchor === 'middle' ? L.w / 2 : o.anchor === 'end' ? L.w : 0)
  return L.items.map(it => it.g.getPath(x0 + it.x, y, size).toPathData(1)).join('')
}
// Glif bankası: her (yazı tipi, glif, boyut) bir kez <path id> olarak tanımlanır, metin <use> ile dizilir (dosya küçülür)
const FONT_IDS = new Map()
function bank(prefix) {
  const defs = new Map()
  return {
    text(s, fonts, size, x, y, fill) {
      const L = layout(s, fonts, size)
      let out = '<g fill="' + fill + '">'
      for (const it of L.items) {
        if (!FONT_IDS.has(it.f)) FONT_IDS.set(it.f, FONT_IDS.size)
        const id = prefix + FONT_IDS.get(it.f) + '_' + it.g.index + '_' + String(size).replace('.', 'p')
        if (!defs.has(id)) { const d = it.g.getPath(0, 0, size).toPathData(1); defs.set(id, d ? '<path id="' + id + '" d="' + d + '"/>' : '') }
        if (defs.get(id)) out += '<use href="#' + id + '" x="' + r1(x + it.x) + '" y="' + r1(y) + '"/>'
      }
      return out + '</g>'
    },
    defs() { return [...defs.values()].join('') },
  }
}
// metni verilen genişliğe sığacak boyuta indir
function fit(s, fonts, size, max, track) { let z = size; while (z > 8 && width(s, fonts, z, track) > max) z -= 0.5; return z }
// basit, tekrarlanabilir sözde rastgele
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const r1 = v => Math.round(v * 10) / 10

const THEMES = {
  light: { bench: '#ECEEF0', glass: '#F8FAFB', ink: '#121518', ink2: '#4A5159', line: '#C9CED4', film: '#1A1E23', hole: '#F3F5F6', tape: 'rgba(255,255,255,0.5)', tapeEdge: 'rgba(18,21,24,0.16)', glow: 0.95 },
  dark: { bench: '#0E1012', glass: '#1A1E22', ink: '#E9ECEF', ink2: '#9AA3AD', line: '#2A3036', film: '#07080A', hole: '#22272C', tape: 'rgba(233,236,239,0.13)', tapeEdge: 'rgba(233,236,239,0.22)', glow: 1 },
}
const C = { video: '#3FA9F5', audio: '#2EE6A6', text: '#FF5DA2', sticker: '#B98CFF', effect: '#FFD23F', red: '#E5383B' }

// ------------------------------------------------------------ sahneler (örnek görüntülerin çizimleri)
function scenes() {
  seed = 11
  const stars = Array.from({ length: 34 }, () => `<circle cx="${r1(rnd() * 512)}" cy="${r1(rnd() * 120)}" r="${r1(0.5 + rnd() * 0.9)}"/>`).join('')
  const vlines = []
  for (let k = -12; k <= 12; k++) vlines.push(`<line x1="256" y1="172" x2="${256 + k * 70}" y2="288"/>`)
  const hlines = []
  for (let k = 1; k <= 9; k++) { const y = 172 + 116 * Math.pow(k / 9, 2); hlines.push(`<line x1="0" y1="${r1(y)}" x2="512" y2="${r1(y)}"/>`) }
  const bars = [128, 140, 151, 161, 170].map((y, i) => `<rect x="150" y="${y}" width="212" height="${2 + i * 1.6}" fill="#000"/>`).join('')
  const sceneA = `<symbol id="sA" viewBox="0 0 512 288"><defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14062e"/><stop offset="0.55" stop-color="#5b1a6e"/><stop offset="1" stop-color="#ff6a5c"/></linearGradient><linearGradient id="sunA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe06a"/><stop offset="1" stop-color="#ff3d8a"/></linearGradient><mask id="mA"><rect width="512" height="288" fill="#fff"/>${bars}</mask><linearGradient id="hzA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a5c" stop-opacity="0.75"/><stop offset="1" stop-color="#ff6a5c" stop-opacity="0"/></linearGradient></defs>
<rect width="512" height="172" fill="url(#skyA)"/><g fill="#fff" class="tw">${stars}</g>
<circle cx="256" cy="118" r="72" fill="url(#sunA)" mask="url(#mA)"/>
<path d="M0 172 L0 150 L40 138 L78 150 L120 128 L162 146 L205 133 L248 152 L292 136 L338 149 L380 127 L424 145 L466 134 L512 148 L512 172Z" fill="#170828" stroke="#ff4fb0" stroke-width="1.4"/>
<rect y="172" width="512" height="116" fill="#12031f"/><rect y="172" width="512" height="40" fill="url(#hzA)"/>
<g stroke="#ff3fbf" stroke-width="1.3" opacity="0.95">${vlines.join('')}${hlines.join('')}</g></symbol>`

  // küpler
  const cube = (cx, cy, s, col) => {
    const a = s * 0.5, v = s * 0.95
    const top = `${cx},${cy - a} ${cx + s},${cy} ${cx},${cy + a} ${cx - s},${cy}`
    const left = `${cx - s},${cy} ${cx},${cy + a} ${cx},${cy + a + v} ${cx - s},${cy + v}`
    const right = `${cx + s},${cy} ${cx},${cy + a} ${cx},${cy + a + v} ${cx + s},${cy + v}`
    const pt = p => p.split(' ').map(q => q.split(',').map(v => r1(+v)).join(',')).join(' ')
    return `<polygon points="${pt(top)}" fill="${col[0]}"/><polygon points="${pt(left)}" fill="${col[1]}"/><polygon points="${pt(right)}" fill="${col[2]}"/>`
  }
  const pal = [['#ff9a4a', '#e2711b', '#b85410'], ['#b85fd0', '#8e2ca0', '#6a1d7a'], ['#5b84f0', '#2f5ad6', '#2242a4'], ['#5cd2e6', '#23a6c0', '#16798d'], ['#f37a95', '#e2436a', '#b02e50']]
  seed = 5
  const cubes = []
  for (let row = 0; row < 4; row++) {
    const y = 112 + row * row * 12 + row * 26, s = 13 + row * 9
    const n = 8 - row
    for (let i = 0; i < n; i++) {
      const x = (i + 0.25 + (row % 2) * 0.5) * (512 / (n - 0.5)) + (rnd() - 0.5) * 16
      cubes.push(cube(x, y, s, pal[Math.floor(rnd() * pal.length)]))
    }
  }
  const sceneB = `<symbol id="sB" viewBox="0 0 512 288"><defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86a9dc"/><stop offset="1" stop-color="#f3cda4"/></linearGradient></defs>
<rect width="512" height="110" fill="url(#skyB)"/><rect y="104" width="512" height="184" fill="#e9e2d8"/><g class="bob">${cubes.join('')}</g></symbol>`

  // tünel: halkalar 1.35 oranla dizili; 1.35 ölçekleme döngüyü kesintisiz yapar
  const rings = []
  for (let k = 0; k < 13; k++) { const r = 8 * Math.pow(1.35, k); rings.push(`<circle r="${r1(r)}" stroke="${k % 2 ? '#ff4fd8' : '#39e6ff'}" stroke-opacity="${Math.min(1, 0.25 + k * 0.08).toFixed(2)}"/>`) }
  const spokes = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<line x1="0" y1="0" x2="${r1(Math.cos(a) * 340)}" y2="${r1(Math.sin(a) * 340)}"/>` }).join('')
  const sceneC = `<symbol id="sC" viewBox="0 0 512 288"><defs><radialGradient id="tC"><stop offset="0" stop-color="#0d1b2a"/><stop offset="1" stop-color="#030508"/></radialGradient><clipPath id="cC"><rect width="512" height="288"/></clipPath></defs>
<rect width="512" height="288" fill="url(#tC)"/><g clip-path="url(#cC)"><g transform="translate(256 144)"><g stroke="#39e6ff" stroke-opacity="0.35" stroke-width="1">${spokes}</g><g class="fly" fill="none" stroke-width="1.6">${rings.join('')}</g><circle r="22" fill="#9fe8ff" opacity="0.18"/></g></g></symbol>`
  return sceneA + sceneB + sceneC
}

// rakamlar bir kez yol olarak tanımlanır, sonra <use> ile dizilir
function digitDefs(size, fill) {
  let s = ''
  for (let d = 0; d <= 9; d++) s += `<path id="g${d}" d="${text(String(d), MONO, size, 0, 0)}" fill="${fill}"/>`
  s += `<path id="gc" d="${text(':', MONO, size, 0, 0)}" fill="${fill}"/>`
  return s
}
const ADV = size => MONO[0].charToGlyph('0').advanceWidth * size / MONO[0].unitsPerEm
function digits(str, x, y, size) {
  const a = ADV(size)
  return [...str].map((ch, i) => `<use href="#g${ch === ':' ? 'c' : ch}" x="${r1(x + i * a)}" y="${y}"/>`).join('')
}

// ------------------------------------------------------------ başlık
function banner(lang, theme) {
  const T = THEMES[theme]
  const W = 1280, H = 540
  const L = { x0: 64, tlX: 64, tlW: 1152 }
  const sub = lang === 'tr'
    ? ['Windows için ücretsiz video kurgu programı.', 'Altyazı, seslendirme ve yapay zekâ araçları', 'internet olmadan, bilgisayarda çalışır.']
    : ['A free video editor for Windows.', 'Captions, voice-over and the AI tools', 'run on your PC, without the internet.']
  // kelime işareti: SWEAX | ek yeri | CUT
  const gap = 24, WS = Math.min(100, fit('SWEAXCUT', BODONI, 100, 560 - gap))
  const wA = width('SWEAX', BODONI, WS), wB = width('CUT', BODONI, WS)
  const base = 138
  const xCut = L.x0 + wA + gap / 2
  const word = `<path d="${text('SWEAX', BODONI, WS, L.x0, base)}" fill="${T.ink}"/><path d="${text('CUT', BODONI, WS, L.x0 + wA + gap, base)}" fill="${T.ink}"/>`
  const subSize = Math.min(fit(sub[1], MAN5, 22, 590), fit(sub[2], MAN5, 22, 590), fit(sub[0], MAN7, 22, 590))
  const subP = `<path d="${text(sub[0], MAN7, subSize, L.x0, 196)}" fill="${T.ink}"/>` +
    `<path d="${text(sub[1], MAN5, subSize, L.x0, 196 + subSize * 1.45)}" fill="${T.ink2}"/>` +
    `<path d="${text(sub[2], MAN5, subSize, L.x0, 196 + subSize * 2.9)}" fill="${T.ink2}"/>`
  // ek bandı (splice tape) — iki zımba deliğiyle
  const tapeY = base - WS * 0.86, tapeH = WS * 1.12
  const tape = `<g><rect x="${r1(xCut - 30)}" y="${r1(tapeY)}" width="60" height="${r1(tapeH)}" fill="${T.tape}" stroke="${T.tapeEdge}" stroke-width="1"/>` +
    `<rect x="${r1(xCut - 4)}" y="${r1(tapeY + 7)}" width="8" height="6" rx="1.5" fill="${T.bench}" opacity="0.9"/><rect x="${r1(xCut - 4)}" y="${r1(tapeY + tapeH - 13)}" width="8" height="6" rx="1.5" fill="${T.bench}" opacity="0.9"/></g>`
  const cutMark = `<path d="M${r1(xCut)} ${r1(tapeY - 16)} L${r1(xCut)} ${r1(tapeY + tapeH + 14)}" stroke="${C.red}" stroke-width="2.6" stroke-linecap="round" class="mark"/>`

  // zaman sayacı 00:0S:FF — saniye ve kare sütunları kayar
  const cs = 30, cy = 318, cA = ADV(cs)
  const cx0 = L.x0
  const secCol = Array.from({ length: 9 }, (_, i) => digits(String(i), cx0 + 4 * cA, cy + i * 40, cs)).join('')
  const frCol = Array.from({ length: 30 }, (_, i) => digits(String(i).padStart(2, '0'), cx0 + 6 * cA, cy + i * 40, cs)).join('')
  const counter = `<g fill="${T.ink2}">${digits('00:0', cx0, cy, cs)}${digits(':', cx0 + 5 * cA, cy, cs)}</g>` +
    `<clipPath id="cpS"><rect x="${r1(cx0 + 4 * cA)}" y="${cy - 30}" width="${r1(cA)}" height="40"/></clipPath><clipPath id="cpF"><rect x="${r1(cx0 + 6 * cA)}" y="${cy - 30}" width="${r1(cA * 2)}" height="40"/></clipPath>` +
    `<g clip-path="url(#cpS)"><g class="sec">${secCol}</g></g><g clip-path="url(#cpF)"><g class="frm">${frCol}</g></g>`
  const tcLabel = ''

  // izleme penceresi: A → (silme) → B → (iris) → C, 9 sn döngü, oynatma kafasıyla aynı anda
  const MX = 704, MY = 40, MW = 512, MH = 288
  const corner = (x, y, dx, dy) => `<path d="M${x + dx * 16} ${y} L${x} ${y} L${x} ${y + dy * 16}" fill="none" stroke="${T.ink2}" stroke-width="1.5"/>`
  const monitor = `<defs><linearGradient id="wipeG" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="mB" maskUnits="userSpaceOnUse" x="${MX}" y="${MY}" width="${MW}" height="${MH}"><rect class="wipe" x="${MX - 600}" y="${MY}" width="600" height="${MH}" fill="url(#wipeG)"/></mask>
<mask id="mC" maskUnits="userSpaceOnUse" x="${MX}" y="${MY}" width="${MW}" height="${MH}"><g transform="translate(${MX + MW / 2} ${MY + MH / 2})"><circle class="iris" r="300" fill="#fff"/></g></mask>
<clipPath id="mon"><rect x="${MX}" y="${MY}" width="${MW}" height="${MH}"/></clipPath></defs>
<g clip-path="url(#mon)"><use href="#sA" x="${MX}" y="${MY}" width="${MW}" height="${MH}"/><g mask="url(#mB)"><use href="#sB" x="${MX}" y="${MY}" width="${MW}" height="${MH}"/></g><g mask="url(#mC)"><use href="#sC" x="${MX}" y="${MY}" width="${MW}" height="${MH}"/></g></g>
<rect x="${MX - 0.5}" y="${MY - 0.5}" width="${MW + 1}" height="${MH + 1}" fill="none" stroke="${T.line}"/>
${corner(MX - 10, MY - 10, 1, 1)}${corner(MX + MW + 10, MY - 10, -1, 1)}${corner(MX - 10, MY + MH + 10, 1, -1)}${corner(MX + MW + 10, MY + MH + 10, -1, -1)}`

  // zaman çizelgesi
  const TX = L.tlX, TW = L.tlW, sec = TW / 9
  const xs = s => r1(TX + s * sec)
  let ruler = ''
  for (let i = 0; i <= 18; i++) { const x = r1(TX + i * sec / 2); ruler += `<line x1="${x}" y1="${i % 2 ? 360 : 354}" x2="${x}" y2="364" stroke="${T.ink2}" stroke-width="1" opacity="${i % 2 ? 0.45 : 0.8}"/>` }
  const rulerDigits = Array.from({ length: 8 }, (_, i) => digits(String(i + 1), TX + (i + 1) * sec + 4, 352, 11)).join('')
  const clip = (s, e, y, h, col, extra = '') => `<rect x="${xs(s)}" y="${y}" width="${r1((e - s) * sec)}" height="${h}" rx="2" fill="${col}" fill-opacity="${theme === 'dark' ? 0.30 : 0.26}" stroke="${col}" stroke-width="1.2"/>${extra}`
  const row1 = clip(4.2, 5.8, 372, 18, C.effect) + `<rect x="${xs(4.2)}" y="372" width="4" height="18" fill="${C.effect}"/>`
  const row2 = clip(0.35, 3.0, 396, 18, C.text) + `<rect x="${xs(0.35)}" y="396" width="4" height="18" fill="${C.text}"/>` + clip(6.5, 8.6, 396, 18, C.sticker) + `<rect x="${xs(6.5)}" y="396" width="4" height="18" fill="${C.sticker}"/>`
  // film şeridi = video izi
  const FY = 420, FH = 58
  let holes = ''
  for (let x = TX + 6; x < TX + TW - 6; x += 13) holes += `<rect x="${r1(x)}" y="${FY + 4}" width="6" height="4.5" rx="1.2"/><rect x="${r1(x)}" y="${FY + FH - 8.5}" width="6" height="4.5" rx="1.2"/>`
  const fh = FH - 22, fw = fh * 16 / 9
  let frames = ''
  const sceneOf = s => (s < 3 ? 'sA' : s < 6 ? 'sB' : 'sC')
  for (let c = 0; c < 3; c++) {
    const x0 = TX + c * 3 * sec + 3, x1 = TX + (c + 1) * 3 * sec - 3
    for (let x = x0; x + 4 < x1; x += fw + 3) {
      const w = Math.min(fw, x1 - x)
      frames += `<svg x="${r1(x)}" y="${FY + 11}" width="${r1(w)}" height="${r1(fh)}" viewBox="0 0 ${r1(512 * w / fw)} 288" preserveAspectRatio="xMinYMid slice"><use href="#${sceneOf(c * 3)}" width="512" height="288"/></svg>`
    }
    frames += `<rect x="${r1(x0 - 1)}" y="${FY + 10}" width="${r1(x1 - x0 + 2)}" height="${r1(fh + 2)}" fill="none" stroke="${C.video}" stroke-width="1.6"/>`
  }
  const bow = s => { const x = xs(s), y = FY + FH / 2; return `<path d="M${x - 9} ${y - 9} L${x + 9} ${y + 9} L${x + 9} ${y - 9} L${x - 9} ${y + 9}Z" fill="${T.glass}" stroke="${C.video}" stroke-width="1.4"/>` }
  const film = `<rect x="${TX}" y="${FY}" width="${TW}" height="${FH}" fill="${T.film}"/><g fill="${T.hole}">${holes}</g>${frames}${bow(3)}${bow(6)}`
  // dalga biçimi = ses izi
  seed = 3
  let wave = ''
  const AY = 488, AH = 26
  for (let x = TX + 3; x < TX + TW - 3; x += 4) {
    const t = (x - TX) / TW
    const env = 0.35 + 0.65 * Math.abs(Math.sin(t * 31) * Math.sin(t * 7.3 + 1)) * (0.6 + 0.4 * rnd())
    const h = Math.max(1.5, env * (AH - 6))
    wave += `<rect x="${r1(x)}" y="${r1(AY + AH / 2 - h / 2)}" width="2.2" height="${r1(h)}"/>`
  }
  const audio = `<rect x="${TX}" y="${AY}" width="${TW}" height="${AH}" rx="2" fill="${C.audio}" fill-opacity="${theme === 'dark' ? 0.16 : 0.2}" stroke="${C.audio}" stroke-width="1.2"/><g fill="${C.audio}" class="wave">${wave}</g>`
  const inout = `<path d="M${TX + 7} 344 L${TX} 344 L${TX} 366 L${TX + 7} 366" fill="none" stroke="${C.red}" stroke-width="2.4" stroke-linecap="round"/><path d="M${TX + TW - 7} 344 L${TX + TW} 344 L${TX + TW} 366 L${TX + TW - 7} 366" fill="none" stroke="${C.red}" stroke-width="2.4" stroke-linecap="round"/>`
  const playhead = `<g class="ph"><path d="M${TX - 7} 336 L${TX + 7} 336 L${TX + 7} 344 L${TX} 351 L${TX - 7} 344Z" fill="${C.red}"/><line x1="${TX}" y1="350" x2="${TX}" y2="${AY + AH + 4}" stroke="${C.red}" stroke-width="1.8"/></g>`

  const css = `<style>
.ph{animation:ph 9s linear infinite}
@keyframes ph{from{transform:translateX(0)}to{transform:translateX(${TW}px)}}
.wipe{animation:wipe 9s linear infinite}
@keyframes wipe{0%,30%{transform:translateX(0)}36.7%,100%{transform:translateX(600px)}}
.iris{transform-box:fill-box;transform-origin:center;animation:iris 9s linear infinite}
@keyframes iris{0%,63.3%{transform:scale(0)}70%,100%{transform:scale(1)}}
.sec{animation:sec 9s steps(9) infinite}
@keyframes sec{from{transform:translateY(0)}to{transform:translateY(-360px)}}
.frm{animation:frm 1s steps(30) infinite}
@keyframes frm{from{transform:translateY(0)}to{transform:translateY(-1200px)}}
.fly{animation:fly 1.1s linear infinite}
@keyframes fly{from{transform:scale(1)}to{transform:scale(1.35)}}
.tw{animation:tw 2.4s ease-in-out infinite alternate}
@keyframes tw{from{opacity:.45}to{opacity:1}}
.mark{stroke-dasharray:200;animation:mark 9s ease-out infinite}
@keyframes mark{0%{stroke-dashoffset:200}6%,100%{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`
  const bg = `<defs><radialGradient id="lt" cx="0.56" cy="0.42" r="0.75"><stop offset="0" stop-color="${T.glass}"/><stop offset="0.7" stop-color="${T.glass}" stop-opacity="${theme === 'dark' ? 0.55 : 0.6}"/><stop offset="1" stop-color="${T.bench}"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${T.bench}"/><rect width="${W}" height="${H}" fill="url(#lt)"/>`
  const title = lang === 'tr' ? 'SWEAXCUT: Windows için ücretsiz, çevrimdışı video kurgu programı' : 'SWEAXCUT: a free, offline video editor for Windows'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}"><title>${title}</title>${css}
<defs>${scenes()}${digitDefs(30, T.ink2).replace(/id="g/g, 'id="g')}</defs>
${bg}
${word}${tape}${cutMark}${subP}
${counter}${tcLabel}
${monitor}
<g transform="translate(0 18)">${ruler}<g fill="${T.ink2}">${rulerDigitsFix(rulerDigits)}</g>${inout}${row1}${row2}${film}${audio}${playhead}</g>
</svg>`
}
// cetvel rakamları küçük boyutta ayrı tanım ister: 30 px tanımı ölçekle
function rulerDigitsFix(s) { return s.replace(/<use href="#g(\w)" x="([\d.]+)" y="([\d.]+)"\/>/g, (m, d, x, y) => `<use href="#g${d}" transform="translate(${x} ${y}) scale(${(11 / 30).toFixed(4)})"/>`) }

// ------------------------------------------------------------ dışa aktarma hattı şeması (dikey)
function pipeline(lang, theme) {
  const T = THEMES[theme]
  const GB = bank('p')
  const W = 880
  const tr = lang === 'tr'
  const stages = tr ? [
    { col: C.video, t: 'Çöz', b: ['Her klip için ayrı bir ffmpeg süreci, kare doğruluklu.', 'Ham YUV 4:2:0 kareler boruyla gelir. Sıradaki klip 0,6 sn', 'önceden başlar; büyük ve HEVC kaynaklarda donanım çözücü istenir.'] },
    { col: C.sticker, t: 'GPU’ya yükle', b: ['Y, U ve V düzlemleri ekran kartında RGBA dokuya çevrilir.'] },
    { col: C.text, t: 'Birleştir', b: ['Önizlemeyi çizen WebGL2 bileşimci dışa aktarmayı da çizer:', 'efektler, geçişler, maskeler, renk, yazı ve çıkartmalar.'] },
    { col: C.effect, t: 'Paketle', b: ['Bir gölgelendirici her kareyi BT.709 YUV 4:2:0’a çevirir;', 'ekran kartından okunan veri 2,67 kat azalır.'] },
    { col: C.video, t: 'Geri oku', b: ['readPixels, piksel arabellekleriyle eşzamansız;', 'kodlayıcıya giden dört kare kuyrukta bekler.'] },
    { col: T.ink, t: 'Kodla', b: ['ffmpeg kareleri standart girişten okur. Deneme kodlaması', 'başarılıysa ekran kartı, değilse işlemci kodlayıcısı.'], chips: ['NVENC', 'AMF', 'Quick Sync', 'x264 · x265 · libaom AV1 · VP9 · ProRes'] },
  ] : [
    { col: C.video, t: 'Decode', b: ['One ffmpeg process per clip, frame-accurate.', 'Raw YUV 4:2:0 frames arrive over a pipe. The next clip starts', '0.6 s early; large or HEVC sources ask for hardware decoding.'] },
    { col: C.sticker, t: 'Upload', b: ['The Y, U and V planes become an RGBA texture on the GPU.'] },
    { col: C.text, t: 'Composite', b: ['The WebGL2 compositor that draws the preview draws the export:', 'effects, transitions, masks, colour, text and stickers.'] },
    { col: C.effect, t: 'Pack', b: ['A shader turns each finished frame into BT.709 YUV 4:2:0,', 'so 2.67 times less data is read back from the GPU.'] },
    { col: C.video, t: 'Read back', b: ['readPixels, asynchronous through pixel buffer objects;', 'four frames wait in the queue for the encoder.'] },
    { col: T.ink, t: 'Encode', b: ['ffmpeg reads the frames from stdin. A hardware encoder', 'when its test encode succeeds, otherwise a CPU encoder.'], chips: ['NVENC', 'AMF', 'Quick Sync', 'x264 · x265 · libaom AV1 · VP9 · ProRes'] },
  ]
  const audioT = tr ? ['Ses', 'Görüntü işlenirken ses ayrı olarak WAV’a karıştırılır,', 'sonra çıktı dosyasına eklenir.'] : ['Audio', 'While the video renders, the audio is mixed to a WAV file', 'and then muxed into the output.']
  const outT = tr ? ['Dosya', 'MP4 · MOV · WebM · GIF  ya da yalnız ses: MP3 · WAV'] : ['File', 'MP4 · MOV · WebM · GIF  or audio only: MP3 · WAV']
  const head = tr ? 'Önizleme ile dışa aktarma aynı bileşimciyi kullanır' : 'Preview and export share one compositor'

  const SX = 150, top = 96
  let y = top
  let body = ''
  const titleSize = 24, bodySize = 16.5, lh = 24
  const rowY = []
  for (const s of stages) {
    rowY.push(y)
    body += `<rect x="${SX}" y="${y + 6}" width="6" height="26" fill="${s.col}"/>`
    body += `${GB.text(s.t, MAN7, titleSize, SX + 20, y + 28, T.ink)}`
    let yy = y + 28 + lh + 2
    for (const line of s.b) { body += `${GB.text(line, MAN5, bodySize, SX + 20, yy, T.ink2)}`; yy += lh }
    if (s.chips) {
      let cx = SX + 20
      for (const c of s.chips) {
        const w = width(c, MAN7, 14) + 20
        body += `<rect x="${r1(cx)}" y="${yy - 8}" width="${r1(w)}" height="28" fill="none" stroke="${T.line}" stroke-width="1.2"/>${GB.text(c, MAN7, 14, cx + 10, yy + 11, T.ink)}`
        cx += w + 8
      }
      yy += 34
    }
    y = yy + 22
    body += `<line x1="${SX}" y1="${y - 10}" x2="${W - 40}" y2="${y - 10}" stroke="${T.line}" stroke-width="1"/>`
  }
  // ses kolu + dosya
  const ay = y + 6
  seed = 9
  let wave = ''
  for (let x = SX + 20; x < SX + 330; x += 5) { const h = 4 + Math.abs(Math.sin(x * 0.08) * Math.sin(x * 0.021 + 1)) * 20 * (0.6 + 0.4 * rnd()); wave += `<rect x="${x}" y="${r1(ay + 52 - h / 2)}" width="3" height="${r1(h)}"/>` }
  body += `<rect x="${SX}" y="${ay + 6}" width="6" height="26" fill="${C.audio}"/>${GB.text(audioT[0], MAN7, titleSize, SX + 20, ay + 28, T.ink)}`
  body += `<g fill="${C.audio}" class="wv">${wave}</g>`
  body += `${GB.text(audioT[1], MAN5, bodySize, SX + 20, ay + 96, T.ink2)}${GB.text(audioT[2], MAN5, bodySize, SX + 20, ay + 96 + lh, T.ink2)}`
  const oy = ay + 96 + lh + 46
  body += `<line x1="${SX}" y1="${oy - 26}" x2="${W - 40}" y2="${oy - 26}" stroke="${T.line}" stroke-width="1"/>`
  body += `<rect x="${SX}" y="${oy + 6}" width="6" height="26" fill="${C.red}"/>${GB.text(outT[0], MAN7, titleSize, SX + 20, oy + 28, T.ink)}${GB.text(outT[1], MAN5, bodySize, SX + 20, oy + 28 + lh + 2, T.ink2)}`
  const H = oy + 28 + lh + 40
  // sol: kareleri taşıyan dikey film şeridi
  const FX = 40, FW = 72
  let holes = ''
  for (let yy = top - 30; yy < H - 20; yy += 14) holes += `<rect x="${FX + 5}" y="${yy}" width="6" height="7" rx="1.5"/><rect x="${FX + FW - 11}" y="${yy}" width="6" height="7" rx="1.5"/>`
  const pitch = 52
  const colors = [C.video, C.text, C.effect, C.sticker, C.audio]
  let fr = ''
  for (let i = -2, yy = top - 30 - pitch * 2; yy < H; i++, yy += pitch) fr += `<rect x="${FX + 17}" y="${yy}" width="${FW - 34}" height="${pitch - 8}" fill="${colors[(i + 10) % 5]}" fill-opacity="0.85"/>`
  const film = `<clipPath id="fc"><rect x="${FX}" y="${top - 30}" width="${FW}" height="${H - top + 10}"/></clipPath><g clip-path="url(#fc)"><rect x="${FX}" y="${top - 30}" width="${FW}" height="${H - top + 10}" fill="${T.film}"/><g class="roll">${fr}</g><g fill="${T.hole}">${holes}</g></g>`
  // aşama işaretleri: şeritten aşamaya kısa çizgi
  let ticks = ''
  for (const ry of rowY) ticks += `<line x1="${FX + FW}" y1="${ry + 19}" x2="${SX - 8}" y2="${ry + 19}" stroke="${T.line}" stroke-width="1.2"/><circle cx="${SX - 8}" cy="${ry + 19}" r="3" fill="${T.ink2}"/>`
  ticks += `<line x1="${FX + FW}" y1="${ay + 19}" x2="${SX - 8}" y2="${ay + 19}" stroke="${C.audio}" stroke-width="1.2"/><line x1="${FX + FW}" y1="${oy + 19}" x2="${SX - 8}" y2="${oy + 19}" stroke="${C.red}" stroke-width="1.2"/>`
  const headP = GB.text(head, BODONI, fit(head, BODONI, 30, W - SX - 40), SX, 58, T.ink)
  const css = `<style>.roll{animation:roll 1.6s linear infinite}@keyframes roll{from{transform:translateY(0)}to{transform:translateY(${pitch}px)}}
.wv rect{transform-box:fill-box;transform-origin:center;animation:wv 1.2s ease-in-out infinite alternate}.wv rect:nth-child(3n){animation-delay:-.4s}.wv rect:nth-child(3n+1){animation-delay:-.8s}
@keyframes wv{from{transform:scaleY(.55)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`
  const title = tr ? 'SWEAXCUT dışa aktarma hattı' : 'SWEAXCUT export pipeline'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}"><title>${title}</title>${css}
<defs>${GB.defs()}</defs><defs>${GB.defs()}</defs><rect width="${W}" height="${H}" fill="${T.bench}"/>${headP}${film}${ticks}${body}</svg>`
}

const files = []
for (const lang of ['en', 'tr']) for (const theme of ['light', 'dark']) {
  const b = banner(lang, theme)
  const p = pipeline(lang, theme)
  fs.writeFileSync(path.join(OUT, `banner-${lang}-${theme}.svg`), b)
  fs.writeFileSync(path.join(OUT, `pipeline-${lang}-${theme}.svg`), p)
  files.push([`banner-${lang}-${theme}.svg`, b.length], [`pipeline-${lang}-${theme}.svg`, p.length])
}
for (const [f, n] of files) console.log(f, (n / 1024).toFixed(0) + ' KB')
