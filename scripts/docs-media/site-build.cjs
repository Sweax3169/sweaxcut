'use strict'
// docs/index.html içindeki üretilmiş bölümleri yeniler:
//  1) /* fonts:start */ … /* fonts:end */ arası: docs/fonts'taki değişken woff2 dosyaları için @font-face kuralları
//     (Mona Sans: wght 200–900 + wdth 75–125 %, Geist Mono: wght 100–900; yalnız latin + latin-ext, fontsource unicode aralıklarıyla).
//     Dosyalar ve SIL OFL lisans metinleri node_modules/@fontsource-variable'dan kopyalanır; docs/fonts'ta başka bir şey kalmaz.
//  2) <script id="fx-data" type="application/json"> … </script> arası: canlı önizlemenin geçiş/efekt GLSL kodu
//
// Kullanım: node scripts/docs-media/site-build.cjs [fx-dump.json]
// fx-dump.json, çalışan uygulamada (drive.cjs, vite HMR'siz sunucu) registry'den alınır: her geçiş için
// transitionShader(def.glsl), her efekt için effectShader(def, def.glsl) (src/engine/shaders.js) ve def.params:
//   { transitions:[{id,name,params,duration,src}], effects:[{id,name,params,src}] }  — src = transitionShader()/effectShader() çıktısı

const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', '..')
const html = path.join(root, 'docs', 'index.html')
const FONTS = path.join(root, 'docs', 'fonts')
let page = fs.readFileSync(html, 'utf8')

// ---------------------------------------------------------------- yazı tipleri
const F = path.join(root, 'node_modules', '@fontsource-variable')
const WANT = [
  { pkg: 'mona-sans', css: 'standard.css', file: s => `mona-sans-${s}-standard-normal.woff2` },
  { pkg: 'geist-mono', css: 'wght.css', file: s => `geist-mono-${s}-wght-normal.woff2` },
]
fs.mkdirSync(FONTS, { recursive: true })
const keep = new Set()
let css = ''
for (const w of WANT) {
  const src = fs.readFileSync(path.join(F, w.pkg, w.css), 'utf8')
  const blocks = src.split('/* ').slice(1)
  for (const sub of ['latin-ext', 'latin']) {
    const file = w.file(sub)
    const b = blocks.find(x => x.includes(`/files/${file}`))
    if (!b) throw new Error('yok: ' + w.pkg + ' ' + sub)
    fs.copyFileSync(path.join(F, w.pkg, 'files', file), path.join(FONTS, file))
    keep.add(file)
    const get = re => { const m = re.exec(b); return m ? m[1].trim() : null }
    const name = get(/font-family:\s*'([^']+)'/)
    const weight = get(/font-weight:\s*([^;]+);/)
    const stretch = get(/font-stretch:\s*([^;]+);/)
    const ur = get(/unicode-range:\s*([^;]+);/)
    css += `@font-face{font-family:"${name}";font-style:normal;font-weight:${weight};${stretch ? `font-stretch:${stretch};` : ''}font-display:swap;src:url(fonts/${file}) format("woff2");unicode-range:${ur}}\n`
  }
  const lic = `LICENSE-${w.pkg}.txt`
  fs.copyFileSync(path.join(F, w.pkg, 'LICENSE'), path.join(FONTS, lic))
  keep.add(lic)
}
// eski yazı tipi dosyalarını kaldır (bodoni / manrope / jetbrains ve benzerleri)
for (const f of fs.readdirSync(FONTS)) if (!keep.has(f)) { fs.unlinkSync(path.join(FONTS, f)); console.log('silindi: docs/fonts/' + f) }
page = page.replace(/\/\* fonts:start \*\/[\s\S]*?\/\* fonts:end \*\//, '/* fonts:start */\n' + css + '/* fonts:end */')

// ---------------------------------------------------------------- geçiş / efekt verisi
const dumpFile = process.argv[2]
if (dumpFile) {
  const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'))
  const EN = {
    'gl-cross-zoom': 'Cross zoom', 'kirbac-sol': 'Whip left', 'isik-patlamasi': 'Light burst', 'kup-sola': 'Cube left',
    'sok-dalgasi': 'Shockwave', 'film-yanmasi': 'Film burn', 'glitch-kesme': 'Glitch cut', 'murekkep-damlasi': 'Ink drop',
    'gl-doom-melt': 'Doom melt', 'piksel-dalgasi': 'Pixel wave', 'vhs-sarma': 'VHS rewind', 'gl-wind': 'Wind',
    'gl-pixelize': 'Pixelize', 'gl-circle-open': 'Soft circle', 'kalp-acilimi': 'Heart reveal', 'gl-dreamy': 'Dreamy',
    vhs: 'VHS tape', 'eski-film': 'Old film', crt: 'CRT screen', '8-bit': '8-bit', kar: 'Snowfall', 'rgb-ayrisma': 'RGB split',
    'film-greni': 'Film grain', kaleydoskop: 'Kaleidoscope', 'neon-kenar': 'Neon edges',
  }
  const pv = ps => Object.fromEntries((ps || []).map(p => [p.key, p.type === 'color' ? hex(p.default) : p.type === 'bool' ? (p.default ? 1 : 0) : p.default]))
  const hex = h => { const n = parseInt(String(h || '#ffffff').slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] }
  const data = {
    transitions: dump.transitions.filter(t => t.src).map(t => ({ id: t.id, en: EN[t.id] || t.name, tr: t.name, d: t.duration || 0.7, gl: !!t.source, p: pv(t.params), src: t.src })),
    effects: dump.effects.filter(e => e.src).map(e => ({ id: e.id, en: EN[e.id] || e.name, tr: e.name, p: Object.fromEntries(Object.entries(pv(e.params)).map(([k, v]) => ['u_' + k, v])), src: e.src })),
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  page = page.replace(/(<script id="fx-data" type="application\/json">)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b)
}
fs.writeFileSync(html, page)
console.log('docs/index.html güncellendi', (page.length / 1024).toFixed(0) + ' KB')
