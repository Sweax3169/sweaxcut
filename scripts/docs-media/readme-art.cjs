'use strict'
// README sanatı (SWEAXCUT 3, "gösterim salonu"): hareketli başlık ve mimari şema, EN/TR × açık/koyu → docs/art/*.svg
//
// GitHub SVG'yi <img> olarak gösterir; dış yazı tipi yükleyemez. Bu yüzden bütün yazılar opentype.js ile yola çevrilir.
// opentype.js değişken yazı tipi okuyamaz ve woff2 açamaz; Mona Sans'ın geniş kesimi (wdth 112/125) ise yalnız değişken
// dosyada var. Statik örnekler bir kez fontTools ile çıkarılır (Python, `pip install fonttools brotli`):
//
//   python -I - <<'PY'   # çıkış klasörü ART_FONTS olur
//   import os; from fontTools.ttLib import TTFont; from fontTools.varLib import instancer
//   NM = 'node_modules/@fontsource-variable'; OUT = os.environ['ART_FONTS']
//   for sub in ('latin', 'latin-ext'):
//       for w, s in ((800, 125), (420, 125), (700, 112), (500, 100), (600, 100), (700, 100)):
//           f = instancer.instantiateVariableFont(TTFont(f'{NM}/mona-sans/files/mona-sans-{sub}-standard-normal.woff2'), {'wght': w, 'wdth': s})
//           f.flavor = None; f.save(f'{OUT}/mona-sans-{sub}-{w}-{s}.ttf')
//       for w in (500, 600):
//           f = instancer.instantiateVariableFont(TTFont(f'{NM}/geist-mono/files/geist-mono-{sub}-wght-normal.woff2'), {'wght': w})
//           f.flavor = None; f.save(f'{OUT}/geist-mono-{sub}-{w}.ttf')
//   PY
//
// opentype.js projenin bağımlılığı değil:  npm pack opentype.js@1.3.4  → paketi aç, OPENTYPE ile göster.
// Kullanım: OPENTYPE=<klasör>/package ART_FONTS=<klasör> node scripts/docs-media/readme-art.cjs
const fs = require('fs')
const path = require('path')
const opentype = require(process.env.OPENTYPE || 'opentype.js')

const ROOT = path.join(__dirname, '..', '..')
const OUT = path.join(ROOT, 'docs', 'art')
const FONTS = process.env.ART_FONTS
if (!FONTS) throw new Error('ART_FONTS ortam değişkeni gerekli (statik TTF örneklerinin klasörü, dosyanın başına bak)')
fs.mkdirSync(OUT, { recursive: true })

const load = name => ['latin', 'latin-ext'].map(s => opentype.loadSync(path.join(FONTS, name.replace('*', s) + '.ttf')))
const WIDE8 = load('mona-sans-*-800-125')   // kelime işareti, büyük başlık
const WIDE4 = load('mona-sans-*-420-125')   // "CUT"
const HEAD = load('mona-sans-*-700-112')    // başlıklar
const BODY = load('mona-sans-*-500-100')
const SEMI = load('mona-sans-*-600-100')
const MONO = load('geist-mono-*-500')

const r1 = v => Math.round(v * 10) / 10
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

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
function fit(s, fonts, size, max, track) { let z = size; while (z > 8 && width(s, fonts, z, track) > max) z -= 0.5; return z }

// Glif bankası: her (yazı tipi, glif, boyut) bir kez <path id> olur, metin <use> ile dizilir; dosya küçük kalır
function bank(prefix) {
  const ids = new Map(), defs = new Map()
  return {
    text(s, fonts, size, x, y, fill, o = {}) {
      const L = layout(s, fonts, size, o.track || 0)
      const x0 = x - (o.anchor === 'middle' ? L.w / 2 : o.anchor === 'end' ? L.w : 0)
      let out = '<g' + (fill ? ' fill="' + fill + '"' : '') + (o.attrs ? ' ' + o.attrs : '') + '>'
      for (const it of L.items) {
        if (!ids.has(it.f)) ids.set(it.f, ids.size)
        const id = prefix + ids.get(it.f) + '_' + it.g.index + '_' + String(size).replace('.', 'p')
        if (!defs.has(id)) { const d = it.g.getPath(0, 0, size).toPathData(2); defs.set(id, d ? '<path id="' + id + '" d="' + d + '"/>' : '') }
        if (defs.get(id)) out += '<use href="#' + id + '" x="' + r1(x0 + it.x) + '" y="' + r1(y) + '"/>'
      }
      return out + '</g>'
    },
    defs() { return [...defs.values()].join('') },
  }
}

// ------------------------------------------------------------ renkler (src/ui/styles/base.css)
const THEMES = {
  dark: {
    floor: '#08090c', s0: '#0d0f14', s1: '#13161c', s2: '#1a1e26', s3: '#222731', s4: '#2c323e',
    tx0: '#eef0f4', tx1: '#a9afbc', tx2: '#747b8a', mark: '#f4f6fa', wire: '#2c323e', lift: 'rgba(255,255,255,0.055)',
    shadow: 'rgba(0,0,0,0.55)', glowA: 0.55, glowB: 0.5,
  },
  light: {
    floor: '#f1f2f5', s0: '#ffffff', s1: '#ffffff', s2: '#e9ebf0', s3: '#dfe2e9', s4: '#cfd3dc',
    tx0: '#0d0f14', tx1: '#4a5263', tx2: '#6c7383', mark: '#13161c', wire: '#c9ced8', lift: 'rgba(255,255,255,0.9)',
    shadow: 'rgba(20,24,34,0.16)', glowA: 0.28, glowB: 0.26,
  },
}
const C = { rec: '#ff4b3e', recHi: '#ff6b5d', recLo: '#df3328', video: '#4d8dff', audio: '#36d39b', text: '#e070ee', sticker: '#ffb84d', effect: '#ff6b8b', filter: '#4fd6e8', key: '#ffc24b', cap: '#ffe14d' }

// logo işareti (src/ui/TitleBar.jsx, 24'lük ızgara)
const MARK_L = 'M6 3h7.7L8.7 21H6a3 3 0 01-3-3V6a3 3 0 013-3z'
const MARK_R = 'M15.3 3H18a3 3 0 013 3v12a3 3 0 01-3 3h-7.7z'

// ------------------------------------------------------------ örnek görüntü çizimleri (uygulamanın GLSL örnek sahneleri)
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
function scenes() {
  seed = 11
  const stars = Array.from({ length: 34 }, () => `<circle cx="${r1(rnd() * 512)}" cy="${r1(rnd() * 120)}" r="${r1(0.5 + rnd() * 0.9)}"/>`).join('')
  const vl = [], hl = []
  for (let k = -12; k <= 12; k++) vl.push(`<line x1="256" y1="172" x2="${256 + k * 70}" y2="288"/>`)
  for (let k = 1; k <= 9; k++) { const y = 172 + 116 * Math.pow(k / 9, 2); hl.push(`<line x1="0" y1="${r1(y)}" x2="512" y2="${r1(y)}"/>`) }
  const bars = [128, 140, 151, 161, 170].map((y, i) => `<rect x="150" y="${y}" width="212" height="${r1(2 + i * 1.6)}" fill="#000"/>`).join('')
  const A = `<symbol id="sA" viewBox="0 0 512 288"><defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14062e"/><stop offset="0.55" stop-color="#5b1a6e"/><stop offset="1" stop-color="#ff6a5c"/></linearGradient><linearGradient id="sunA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe06a"/><stop offset="1" stop-color="#ff3d8a"/></linearGradient><mask id="mA"><rect width="512" height="288" fill="#fff"/>${bars}</mask><linearGradient id="hzA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a5c" stop-opacity="0.75"/><stop offset="1" stop-color="#ff6a5c" stop-opacity="0"/></linearGradient></defs>
<rect width="512" height="172" fill="url(#skyA)"/><g fill="#fff" class="tw">${stars}</g><circle cx="256" cy="118" r="72" fill="url(#sunA)" mask="url(#mA)"/>
<path d="M0 172L0 150 40 138 78 150 120 128 162 146 205 133 248 152 292 136 338 149 380 127 424 145 466 134 512 148 512 172Z" fill="#170828" stroke="#ff4fb0" stroke-width="1.4"/>
<rect y="172" width="512" height="116" fill="#12031f"/><rect y="172" width="512" height="40" fill="url(#hzA)"/><g stroke="#ff3fbf" stroke-width="1.3" opacity="0.95">${vl.join('')}${hl.join('')}</g></symbol>`
  const cube = (cx, cy, s, col) => {
    const a = s * 0.5, v = s * 0.95, pt = p => p.map(q => q.map(r1).join(',')).join(' ')
    return `<polygon points="${pt([[cx, cy - a], [cx + s, cy], [cx, cy + a], [cx - s, cy]])}" fill="${col[0]}"/><polygon points="${pt([[cx - s, cy], [cx, cy + a], [cx, cy + a + v], [cx - s, cy + v]])}" fill="${col[1]}"/><polygon points="${pt([[cx + s, cy], [cx, cy + a], [cx, cy + a + v], [cx + s, cy + v]])}" fill="${col[2]}"/>`
  }
  const pal = [['#ff9a4a', '#e2711b', '#b85410'], ['#b85fd0', '#8e2ca0', '#6a1d7a'], ['#5b84f0', '#2f5ad6', '#2242a4'], ['#5cd2e6', '#23a6c0', '#16798d'], ['#f37a95', '#e2436a', '#b02e50']]
  seed = 5
  const cubes = []
  for (let row = 0; row < 4; row++) {
    const y = 112 + row * row * 12 + row * 26, s = 13 + row * 9, n = 8 - row
    for (let i = 0; i < n; i++) cubes.push(cube((i + 0.25 + (row % 2) * 0.5) * (512 / (n - 0.5)) + (rnd() - 0.5) * 16, y, s, pal[Math.floor(rnd() * pal.length)]))
  }
  const B = `<symbol id="sB" viewBox="0 0 512 288"><defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86a9dc"/><stop offset="1" stop-color="#f3cda4"/></linearGradient></defs><rect width="512" height="110" fill="url(#skyB)"/><rect y="104" width="512" height="184" fill="#e9e2d8"/><g>${cubes.join('')}</g></symbol>`
  return A + B
}

// ------------------------------------------------------------ başlık
const LOOP = 8   // sn; 4. saniyede kesim
function banner(lang, theme) {
  const T = THEMES[theme], tr = lang === 'tr'
  const G = bank('b')
  const W = 1280, H = 640
  const pct = s => r1(s / LOOP * 100) + '%'

  // sol sütun: işaret + kelime işareti, başlık, alt satırlar
  const X0 = 64
  const markS = 2.6                    // 24'lük ızgara → 62 px
  const markY = 70
  const mark = `<g transform="translate(${X0 - 8} ${markY - 8}) scale(${markS})"><path d="${MARK_L}" fill="${T.mark}"/><path class="lr" d="${MARK_R}" fill="${C.rec}"/></g>`
  const wmSize = 44, wmBase = markY + 42
  const wA = width('SWEAX', WIDE8, wmSize, 0.4)
  const word = G.text('SWEAX', WIDE8, wmSize, X0 + 68, wmBase, T.tx0, { track: 0.4 }) + G.text('CUT', WIDE4, wmSize, X0 + 68 + wA + 2, wmBase, T.tx1, { track: 0.4 })

  const head = tr ? ['Windows için', 'video kurgu programı'] : ['Video editor', 'for Windows']
  const sub = tr ? ['Otomatik altyazı, tek tıkla kurgu ve WebGL2', 'zaman çizelgesi. Hepsi bilgisayarında çalışır.']
    : ['Automatic captions, one-click edits and a WebGL2', 'timeline. All of it runs on your PC.']
  const hs = Math.min(fit(head[0], HEAD, 50, 560), fit(head[1], HEAD, 50, 560))
  const hy = 232
  const headP = G.text(head[0], HEAD, hs, X0, hy, T.tx0) + G.text(head[1], HEAD, hs, X0, hy + hs * 1.22, T.tx0)
  const ss = Math.min(fit(sub[0], BODY, 20, 560), fit(sub[1], BODY, 20, 560))
  const sy = hy + hs * 1.22 + 52
  const subP = G.text(sub[0], BODY, ss, X0, sy, T.tx1) + G.text(sub[1], BODY, ss, X0, sy + ss * 1.5, T.tx1)

  // sağ: önizleme ekranı (tek ışık kaynağı) + ortam ışığı
  const PX = 664, PY = 40, PW = 552, pad = 10
  const SW = PW - pad * 2, SH = Math.round(SW * 9 / 16), PH = SH + pad * 2
  const SX = PX + pad, SY = PY + pad
  const ambient = `<defs>
<radialGradient id="ambA" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff3d8a" stop-opacity="${T.glowA}"/><stop offset="0.45" stop-color="#7a2a9a" stop-opacity="${r1(T.glowA * 0.45 * 100) / 100}"/><stop offset="1" stop-color="#7a2a9a" stop-opacity="0"/></radialGradient>
<radialGradient id="ambB" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff9a4a" stop-opacity="${T.glowB}"/><stop offset="0.5" stop-color="#5b84f0" stop-opacity="${r1(T.glowB * 0.5 * 100) / 100}"/><stop offset="1" stop-color="#5b84f0" stop-opacity="0"/></radialGradient>
<filter id="psh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${T.shadow}" flood-opacity="1"/></filter>
<clipPath id="scr"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="8"/></clipPath></defs>
<ellipse class="amA" cx="${PX + PW / 2}" cy="${PY + PH / 2}" rx="${PW * 0.78}" ry="${PH * 0.95}" fill="url(#ambA)"/>
<ellipse class="amB" cx="${PX + PW / 2}" cy="${PY + PH / 2}" rx="${PW * 0.78}" ry="${PH * 0.95}" fill="url(#ambB)"/>`
  const panel = `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="16" fill="${T.s1}" filter="url(#psh)"/>`

  // altyazı: kelime kelime karaoke dolgu (oynatma kafasıyla aynı saat)
  const lines = tr
    ? [{ t0: 0.5, t1: 3.7, w: ['SONRA', 'MERDİVENLERDEN'] }, { t0: 4.3, t1: 7.5, w: ['AŞAĞI', 'İNİYORUZ'] }]
    : [{ t0: 0.5, t1: 3.7, w: ['THEN', 'DOWN', 'THE', 'STAIRS'] }, { t0: 4.3, t1: 7.5, w: ['AND', "WE'RE", 'IN'] }]
  let capDefs = '', capBase = '', capHi = '', capCss = ''
  const capSize = 34, capY = SY + SH - 46, gapW = capSize * 0.3
  lines.forEach((ln, li) => {
    const ws = ln.w.map(w => width(w, WIDE8, capSize))
    const total = ws.reduce((a, b) => a + b, 0) + gapW * (ws.length - 1)
    let x = SX + SW / 2 - total / 2
    const span = (ln.t1 - ln.t0) / ln.w.length
    let g1 = '', g2 = ''
    ln.w.forEach((w, wi) => {
      const id = `k${li}${wi}`
      const a = ln.t0 + wi * span, b = a + span * 0.85
      capDefs += `<clipPath id="c${id}"><rect class="${id}" x="${r1(x - 3)}" y="${capY - capSize}" width="${r1(ws[wi] + 6)}" height="${capSize * 1.4}"/></clipPath>`
      g1 += G.text(w, WIDE8, capSize, x, capY, '#ffffff', { attrs: 'stroke="#05060a" stroke-width="7" stroke-linejoin="round" paint-order="stroke"' })
      g2 += `<g clip-path="url(#c${id})">${G.text(w, WIDE8, capSize, x, capY, C.cap)}</g>`
      capCss += `.${id}{transform-box:fill-box;transform-origin:0 50%;transform:scaleX(${li === 0 && wi === 0 ? 1 : 0});animation:${id} ${LOOP}s linear infinite}@keyframes ${id}{0%,${pct(a)}{transform:scaleX(0)}${pct(b)},100%{transform:scaleX(1)}}`
      x += ws[wi] + gapW
    })
    const vis = `${pct(ln.t0 - 0.12)}`, hid = `${pct(ln.t1 + 0.1)}`
    capCss += `.ln${li}{opacity:${li === 0 ? 1 : 0};animation:ln${li} ${LOOP}s steps(1,end) infinite}@keyframes ln${li}{0%{opacity:0}${vis}{opacity:1}${hid}{opacity:0}100%{opacity:0}}`
    capBase += `<g class="ln${li}">${g1}${g2}</g>`
  })
  const screen = `<g clip-path="url(#scr)"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" fill="#000"/>
<use href="#sA" x="${SX}" y="${SY}" width="${SW}" height="${SH}"/>
<g class="sB"><g class="zp"><use href="#sB" x="${SX}" y="${SY}" width="${SW}" height="${SH}"/></g></g>
${capBase}</g>`

  // alt: zaman çizelgesi paneli
  const TX = 64, TY = 412, TW = 1152, TH = 196
  const LX = TX + 18, AX = TX + 150, AW = TW - 150 - 18
  const xs = s => r1(AX + s / LOOP * AW)
  let ruler = ''
  for (let i = 0; i <= LOOP * 2; i++) {
    const x = xs(i / 2)
    ruler += `<rect x="${r1(x - 0.6)}" y="${TY + (i % 2 ? 37 : 33)}" width="1.2" height="${i % 2 ? 5 : 9}" fill="${T.tx2}" opacity="${i % 2 ? 0.5 : 0.85}"/>`
    if (!(i % 2) && i < LOOP * 2) ruler += G.text('00:0' + (i / 2), MONO, 11, x + 4, TY + 29, T.tx2)
  }
  const rowY = { cap: TY + 50, vid: TY + 88, aud: TY + 150 }
  const rowH = { cap: 30, vid: 54, aud: 32 }
  const names = tr ? ['Altyazı', 'Ana iz', 'Müzik'] : ['Captions', 'Main', 'Music']
  const nameP = [['cap', C.text], ['vid', C.video], ['aud', C.audio]].map(([k, col], i) =>
    `<rect x="${LX}" y="${rowY[k] + 4}" width="3" height="${rowH[k] - 8}" rx="1.5" fill="${col}"/>` + G.text(names[i], SEMI, 14, LX + 12, rowY[k] + rowH[k] / 2 + 5, T.tx0)).join('')
  // altyazı klipleri
  let capClips = ''
  lines.forEach((ln, li) => {
    const x = xs(ln.t0), w = xs(ln.t1) - x
    const label = ln.w.join(' ')
    const ls = fit(label, SEMI, 13, w - 22)
    capClips += `<g class="cc${li}"><rect x="${x}" y="${rowY.cap}" width="${r1(w)}" height="${rowH.cap}" rx="6" fill="${C.text}" fill-opacity="${theme === 'dark' ? 0.26 : 0.2}"/><rect x="${x}" y="${rowY.cap}" width="${r1(w)}" height="${rowH.cap}" rx="6" fill="none" stroke="${C.text}" stroke-opacity="0.7" stroke-width="1.2"/>` +
      `<rect x="${x + 8}" y="${rowY.cap + 12}" width="5" height="6" rx="1" fill="${theme === 'dark' ? T.tx0 : '#7c2a88'}"/>` + G.text(label, SEMI, ls, x + 17, rowY.cap + 20, theme === 'dark' ? T.tx0 : '#5c1f66') + '</g>'
    capCss += `.cc${li}{animation:cc${li} ${LOOP}s steps(1,end) infinite}@keyframes cc${li}{0%{opacity:.55}${pct(ln.t0)}{opacity:1}${pct(ln.t1)}{opacity:.55}100%{opacity:.55}}`
  })
  // video klipleri: küçük resimler
  const thumbs = (s0, s1, sym) => {
    const x0 = xs(s0) + 2, x1 = xs(s1) - 2, h = rowH.vid - 4, w = h * 16 / 9
    let o = ''
    for (let x = x0; x < x1 - 2; x += w) {
      const ww = Math.min(w, x1 - x)
      o += `<svg x="${r1(x)}" y="${rowY.vid + 2}" width="${r1(ww)}" height="${h}" viewBox="0 0 ${r1(512 * ww / w)} 288" preserveAspectRatio="xMinYMid slice"><use href="#${sym}" width="512" height="288"/></svg>`
    }
    return `<clipPath id="v${sym}"><rect x="${xs(s0)}" y="${rowY.vid}" width="${r1(xs(s1) - xs(s0))}" height="${rowH.vid}" rx="7"/></clipPath><g clip-path="url(#v${sym})"><rect x="${xs(s0)}" y="${rowY.vid}" width="${r1(xs(s1) - xs(s0))}" height="${rowH.vid}" fill="#000"/>${o}</g>` +
      `<rect x="${xs(s0)}" y="${rowY.vid}" width="${r1(xs(s1) - xs(s0))}" height="${rowH.vid}" rx="7" fill="none" stroke="${C.video}" stroke-width="1.6"/>`
  }
  const vids = thumbs(0, 4, 'sA') + thumbs(4, LOOP, 'sB')
  // müzik: dalga biçimi + vuruş işaretleri
  seed = 3
  let wave = ''
  for (let x = AX + 4; x < AX + AW - 4; x += 4) {
    const t = (x - AX) / AW * LOOP
    const beat = Math.pow(1 - ((t * 2) % 1), 3)
    const env = 0.22 + 0.55 * beat + 0.23 * Math.abs(Math.sin(t * 7.1) * Math.sin(t * 2.3)) * (0.7 + 0.3 * rnd())
    const h = Math.max(1.5, env * (rowH.aud - 8))
    wave += `<rect x="${r1(x)}" y="${r1(rowY.aud + rowH.aud / 2 - h / 2)}" width="2.2" height="${r1(h)}" rx="1"/>`
  }
  const audio = `<rect x="${AX}" y="${rowY.aud}" width="${AW}" height="${rowH.aud}" rx="7" fill="${C.audio}" fill-opacity="${theme === 'dark' ? 0.14 : 0.16}"/><g fill="${C.audio}">${wave}</g>`
  // kesim anı: kırmızı kesim çizgisi kısa parlar
  const cutX = xs(4)
  const cutMark = `<rect class="cut" x="${r1(cutX - 1.5)}" y="${rowY.vid - 4}" width="3" height="${rowH.vid + 8}" rx="1.5" fill="${C.rec}"/>`
  const playhead = `<g class="ph"><rect x="${AX - 1}" y="${TY + 24}" width="2" height="${TH - 34}" fill="${C.rec}"/><path d="M${AX - 7} ${TY + 14}h14a2 2 0 012 2v6l-9 7-9-7v-6a2 2 0 012-2z" fill="${C.rec}"/></g>`
  const tl = `<rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="16" fill="${T.s0}" filter="url(#psh)"/>` +
    `<rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="16" fill="none" stroke="${T.lift}" stroke-width="1"/>` +
    ruler + nameP + capClips + vids + audio + cutMark + playhead

  const css = `<style>
.lr{transform:translate(0.5px,-1.3px);animation:lr ${LOOP}s infinite}
@keyframes lr{0%,44%{transform:translate(0.5px,-1.3px);animation-timing-function:cubic-bezier(.5,0,.75,0)}49%{transform:translate(-0.45px,2.1px);animation-timing-function:cubic-bezier(.2,1.6,.4,1)}62%,100%{transform:translate(0.5px,-1.3px)}}
.ph{animation:ph ${LOOP}s linear infinite}@keyframes ph{from{transform:translateX(0)}to{transform:translateX(${AW}px)}}
.sB{opacity:0;animation:sB ${LOOP}s steps(1,end) infinite}@keyframes sB{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
.zp{transform-box:fill-box;transform-origin:50% 50%;animation:zp ${LOOP}s infinite}@keyframes zp{0%,50%{transform:scale(1.08);animation-timing-function:cubic-bezier(.2,.9,.3,1)}56%,100%{transform:scale(1)}}
.amA{animation:amA ${LOOP}s infinite}@keyframes amA{0%,47%{opacity:1}53%,96%{opacity:0}100%{opacity:1}}
.amB{opacity:0;animation:amB ${LOOP}s infinite}@keyframes amB{0%,47%{opacity:0}53%,96%{opacity:1}100%{opacity:0}}
.cut{opacity:0;animation:cut ${LOOP}s infinite}@keyframes cut{0%,49%{opacity:0}50%{opacity:1}62%,100%{opacity:0}}
.tw{animation:tw 2.4s ease-in-out infinite alternate}@keyframes tw{from{opacity:.45}to{opacity:1}}
${capCss}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`
  const title = tr ? 'SWEAXCUT: Windows için video kurgu programı' : 'SWEAXCUT: video editor for Windows'
  const body = `${ambient}${panel}${screen}${mark}${word}${headP}${subP}${tl}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${css}
<defs>${scenes()}${capDefs}${G.defs()}</defs>
<rect width="${W}" height="${H}" fill="${T.floor}"/>
${body}
</svg>`
}

// ------------------------------------------------------------ mimari şema
function pipeline(lang, theme) {
  const T = THEMES[theme], tr = lang === 'tr'
  const G = bank('p')
  const W = 1280
  const tx = tr ? {
    head: 'Önizleme ve dışa aktarma aynı bileşimciyi kullanır',
    sub: 'Zaman çizelgesinde gördüğün kare, dosyaya yazılan karedir.',
    files: ['Dosyalar', ['Video, fotoğraf ve müzik;', 'pencereye ya da bir', 'tarif kartına bırakılır.'], ''],
    imp: ['İçe aktarma', ['Ağır kayıtlar için arka planda', 'hafif bir önizleme kopyası', 'hazırlanır.'], 'ffprobe · proxy'],
    tl: ['Zaman çizelgesi', ['İzler, klipler, anahtar', 'kareler, altyazılar ve', 'hız eğrileri.'], 'proje: .sweax'],
    comp: ['WebGL2 bileşimci', ['Efekt, geçiş, renk, maske,', 'yazı ve çıkartma. Önizleme', 'ile dışa aktarma aynı kod.'], 'src/engine/compositor.js'],
    prev: ['Önizleme', ['Editörde; renk kapsamları', 've ortam ışığıyla.'], ''],
    dec: ['Kod çözücüler', ['Klip başına bir', 'ffmpeg süreci; YUV', '4:2:0 boruyla gelir.'], 'yalnız dışa aktarmada'],
    yuv: ['GPU paketleme', ['Kare ekran kartında', 'BT.709 YUV 4:2:0 olur,', 'sonra geri okunur.'], 'readPixels · PBO'],
    enc: ['Kodlayıcı', ['NVENC, AMF ya da Quick', 'Sync; yoksa işlemci. Ses', 'ayrıca karışıp eklenir.'], 'MP4 · GIF · MP3'],
    wh: ['whisper.cpp altyazı', ['Konuşmayı kelime zamanlı', 'altyazıya çevirir.'], 'small · medium · large-v3-turbo'],
    pi: ['Piper seslendirme', ['Yazıyı sese çevirir. Türkçe', 'ses Fahrettin gömülü.'], 'seslendirme izine'],
    live: 'önizleme', exp: 'dışa aktarma',
  } : {
    head: 'Preview and export share one compositor',
    sub: 'The frame you see on the timeline is the frame written to the file.',
    files: ['Files', ['Video, photos and music,', 'dropped on the window', 'or on a recipe card.'], ''],
    imp: ['Import', ['Heavy recordings get a', 'light preview copy, made', 'in the background.'], 'ffprobe · proxy'],
    tl: ['Timeline model', ['Tracks, clips, keyframes,', 'captions and speed', 'curves.'], 'project: .sweax'],
    comp: ['WebGL2 compositor', ['Effects, transitions, colour,', 'masks, text, stickers. Same', 'code for preview and export.'], 'src/engine/compositor.js'],
    prev: ['Preview', ['In the editor, with scopes', 'and ambient light.'], ''],
    dec: ['Decoders', ['One ffmpeg process', 'per clip, YUV 4:2:0', 'over a pipe.'], 'export only'],
    yuv: ['GPU packing', ['Each frame becomes', 'BT.709 YUV 4:2:0 on the', 'GPU, then is read back.'], 'readPixels · PBO'],
    enc: ['Encoder', ['NVENC, AMF or Quick', 'Sync, otherwise the CPU.', 'Audio is muxed in after.'], 'MP4 · GIF · MP3'],
    wh: ['whisper.cpp captions', ['Speech to word-timed', 'captions, on your PC.'], 'small · medium · large-v3-turbo'],
    pi: ['Piper voice', ['Text to speech, offline. Turkish', 'voice Fahrettin built in.'], 'onto a voice-over track'],
    live: 'preview', exp: 'export',
  }
  // düğümler (yükseklik satır sayısından)
  const hOf = t => 50 + t[1].length * 21 + (t[2] ? 34 : 12)
  const N = {
    files: { x: 48, y: 300, w: 200, c: C.video, t: tx.files },
    imp: { x: 272, y: 300, w: 224, c: C.filter, t: tx.imp },
    tl: { x: 520, y: 300, w: 224, c: C.key, t: tx.tl },
    comp: { x: 768, y: 300, w: 232, c: C.rec, t: tx.comp, hero: true },
    prev: { x: 1040, y: 132, w: 200, c: C.sticker, t: tx.prev },
    wh: { x: 272, y: 132, w: 236, c: C.text, t: tx.wh },
    pi: { x: 532, y: 132, w: 236, c: C.effect, t: tx.pi },
    dec: { x: 520, y: 500, w: 200, c: C.video, t: tx.dec },
    yuv: { x: 768, y: 500, w: 232, c: C.rec, t: tx.yuv },
    enc: { x: 1040, y: 482, w: 200, c: C.audio, t: tx.enc },
  }
  const MAIN = ['files', 'imp', 'tl', 'comp']
  const mainH = Math.max(...MAIN.map(k => hOf(N[k].t)))
  for (const k of Object.keys(N)) N[k].h = MAIN.includes(k) ? mainH : hOf(N[k].t)
  N.wh.h = N.pi.h = Math.max(N.wh.h, N.pi.h)
  N.dec.y = N.tl.y + mainH + 64
  N.yuv.y = N.dec.y
  N.dec.h = N.yuv.h = Math.max(N.dec.h, N.yuv.h)
  N.enc.y = N.yuv.y + N.yuv.h / 2 - N.enc.h / 2
  let nodes = ''
  for (const [k, n] of Object.entries(N)) {
    const [title, lines, tag] = n.t
    const bodyMax = n.w - 34
    const ts = fit(title, HEAD, 19, n.w - 52)
    const bs = Math.min(...lines.map(l => fit(l, BODY, 14.5, bodyMax)))
    nodes += `<g class="nd">`
    nodes += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" fill="${n.hero ? T.s2 : T.s1}" filter="url(#nsh)"/>`
    nodes += `<rect x="${n.x + 0.5}" y="${n.y + 0.5}" width="${n.w - 1}" height="${n.h - 1}" rx="13.5" fill="none" stroke="${n.hero ? C.rec : T.lift}" stroke-opacity="${n.hero ? 0.75 : 1}" stroke-width="${n.hero ? 1.6 : 1}"/>`
    nodes += `<circle cx="${n.x + 24}" cy="${n.y + 30}" r="5.5" fill="${n.c}"/>`
    nodes += G.text(title, HEAD, ts, n.x + 38, n.y + 37, T.tx0)
    lines.forEach((l, i) => { nodes += G.text(l, BODY, bs, n.x + 18, n.y + 64 + i * 21, T.tx1) })
    if (tag) nodes += G.text(tag, MONO, fit(tag, MONO, 12, n.w - 36), n.x + 18, n.y + n.h - 16, T.tx2)
    nodes += '</g>'
  }
  // ön izleme düğümünün içinde küçük ekran, kodlayıcıda ilerleme
  // bağlantılar: [yol noktaları], renk, paket sınıfı
  const mid = n => n.y + n.h / 2
  const gapY = (N.tl.y + N.tl.h + N.dec.y) / 2
  const H = Math.max(N.dec.y + N.dec.h, N.enc.y + N.enc.h) + 44
  const links = [
    { p: [[N.files.x + N.files.w, mid(N.files)], [N.imp.x, mid(N.files)]], c: C.video },
    { p: [[N.imp.x + N.imp.w, mid(N.imp)], [N.tl.x, mid(N.imp)]], c: C.filter },
    { p: [[N.tl.x + N.tl.w, mid(N.tl)], [N.comp.x, mid(N.tl)]], c: C.key },
    { p: [[N.wh.x + N.wh.w / 2, N.wh.y + N.wh.h], [N.wh.x + N.wh.w / 2, N.wh.y + N.wh.h + 20], [N.tl.x + 44, N.wh.y + N.wh.h + 20], [N.tl.x + 44, N.tl.y]], c: C.text },
    { p: [[N.pi.x + 92, N.pi.y + N.pi.h], [N.pi.x + 92, N.tl.y]], c: C.effect },
    { p: [[N.comp.x + N.comp.w, mid(N.comp)], [N.comp.x + N.comp.w + 20, mid(N.comp)], [N.comp.x + N.comp.w + 20, mid(N.prev)], [N.prev.x, mid(N.prev)]], c: C.rec, label: tx.live, lab: 1 },
    { p: [[N.tl.x + N.tl.w / 2, N.tl.y + N.tl.h], [N.tl.x + N.tl.w / 2, N.dec.y]], c: C.video, label: tx.exp, lab: 0 },
    { p: [[N.dec.x + N.dec.w, mid(N.dec)], [N.dec.x + N.dec.w + 24, mid(N.dec)], [N.dec.x + N.dec.w + 24, gapY], [N.comp.x + 40, gapY], [N.comp.x + 40, N.comp.y + N.comp.h]], c: C.video },
    { p: [[N.comp.x + N.comp.w - 40, N.comp.y + N.comp.h], [N.comp.x + N.comp.w - 40, N.yuv.y]], c: C.rec },
    { p: [[N.yuv.x + N.yuv.w, mid(N.enc)], [N.enc.x, mid(N.enc)]], c: C.rec },
  ]
  // köşeleri yuvarlatılmış yol
  const pathOf = pts => {
    let d = `M${pts[0][0]} ${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i]
      if (i < pts.length - 1) {
        const [px, py] = pts[i - 1], [nx, ny] = pts[i + 1]
        const r = Math.min(10, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2)
        const ax = x - Math.sign(x - px) * r, ay = y - Math.sign(y - py) * r
        const bx = x + Math.sign(nx - x) * r, by = y + Math.sign(ny - y) * r
        d += ` L${r1(ax)} ${r1(ay)} Q${x} ${y} ${r1(bx)} ${r1(by)}`
      } else d += ` L${x} ${y}`
    }
    return d
  }
  let wires = '', packets = '', css = '', labels = ''
  links.forEach((L, i) => {
    wires += `<path d="${pathOf(L.p)}" fill="none" stroke="${T.wire}" stroke-width="2.4" stroke-linecap="round"/>`
    const last = L.p[L.p.length - 1], prev = L.p[L.p.length - 2]
    const dx = Math.sign(last[0] - prev[0]), dy = Math.sign(last[1] - prev[1])
    wires += `<path d="M${last[0] - dx * 7 - dy * 5} ${last[1] - dy * 7 - dx * 5} L${last[0]} ${last[1]} L${last[0] - dx * 7 + dy * 5} ${last[1] - dy * 7 + dx * 5}" fill="none" stroke="${T.wire}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    // paket: yol boyunca kayan küçük kare (çok parçalı yol → parça parça çeviri)
    const segs = []
    let total = 0
    for (let j = 1; j < L.p.length; j++) { const l = Math.hypot(L.p[j][0] - L.p[j - 1][0], L.p[j][1] - L.p[j - 1][1]); segs.push(l); total += l }
    const dur = r1(Math.max(1.4, total / 90))
    let acc = 0, kf = `0%{transform:translate(${L.p[0][0]}px,${L.p[0][1]}px);opacity:0}6%{opacity:1}`
    for (let j = 1; j < L.p.length; j++) { acc += segs[j - 1]; kf += `${r1(acc / total * 88)}%{transform:translate(${L.p[j][0]}px,${L.p[j][1]}px)}` }
    kf += `94%{opacity:1}100%{transform:translate(${last[0]}px,${last[1]}px);opacity:0}`
    css += `.pk${i}{animation:pk${i} ${dur}s linear infinite;animation-delay:-${r1(i * 0.37)}s}@keyframes pk${i}{${kf}}`
    packets += `<g class="pk${i}" transform="translate(${L.p[0][0]} ${L.p[0][1]})"><rect x="-6" y="-4.5" width="12" height="9" rx="2.5" fill="${L.c}"/></g>`
    if (L.label) {
      const a = L.p[L.lab], b = L.p[L.lab + 1]
      labels += G.text(L.label, MONO, 12, Math.max(a[0], b[0]) + 10, (a[1] + b[1]) / 2 + 4, T.tx2)
    }
  })
  const headS = fit(tx.head, HEAD, 30, W - 96)
  const top = G.text(tx.head, HEAD, headS, 48, 64, T.tx0) + G.text(tx.sub, BODY, fit(tx.sub, BODY, 17, W - 96), 48, 96, T.tx1)
  const glow = `<radialGradient id="cg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.rec}" stop-opacity="${theme === 'dark' ? 0.22 : 0.12}"/><stop offset="1" stop-color="${C.rec}" stop-opacity="0"/></radialGradient>`
  const style = `<style>${css}
.cgl{transform-box:fill-box;transform-origin:center;animation:cgl 3.2s ease-in-out infinite alternate}@keyframes cgl{from{opacity:.6;transform:scale(.94)}to{opacity:1;transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`
  const title = tr ? 'SWEAXCUT mimarisi: dosyadan dışa aktarmaya' : 'SWEAXCUT architecture: from files to export'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${style}
<defs>${glow}<filter id="nsh" x="-20%" y="-20%" width="140%" height="170%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="${T.shadow}" flood-opacity="1"/></filter>${G.defs()}</defs>
<rect width="${W}" height="${H}" fill="${T.floor}"/>
<ellipse class="cgl" cx="${N.comp.x + N.comp.w / 2}" cy="${mid(N.comp)}" rx="260" ry="200" fill="url(#cg)"/>
${top}${wires}${labels}${nodes}${packets}
</svg>`
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
