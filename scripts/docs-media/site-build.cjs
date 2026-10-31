'use strict'
// docs/index.html içindeki üretilmiş bölümleri yeniler:
//  1) /* fonts:start */ … /* fonts:end */ arası: docs/fonts'taki woff2 dosyaları için @font-face kuralları (fontsource unicode aralıklarıyla)
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
let page = fs.readFileSync(html, 'utf8')

// ---------------------------------------------------------------- yazı tipleri
const F = path.join(root, 'node_modules', '@fontsource')
const WANT = {
  'bodoni-moda': [['400', 'normal'], ['500', 'normal'], ['600', 'normal'], ['400', 'italic']],
  manrope: [['400', 'normal'], ['500', 'normal'], ['600', 'normal'], ['700', 'normal']],
  'jetbrains-mono': [['400', 'normal'], ['500', 'normal']],
}
let css = ''
for (const [fam, list] of Object.entries(WANT)) for (const [w, st] of list) {
  const src = fs.readFileSync(path.join(F, fam, w + (st === 'italic' ? '-italic' : '') + '.css'), 'utf8')
  const blocks = src.split('/* ').slice(1)
  for (const sub of ['latin-ext', 'latin']) {
    const b = blocks.find(x => x.startsWith(`${fam}-${sub}-${w}-${st} */`))
    if (!b) throw new Error('yok: ' + fam + ' ' + sub + ' ' + w + ' ' + st)
    const file = `${fam}-${sub}-${w}-${st}.woff2`
    fs.copyFileSync(path.join(F, fam, 'files', file), path.join(root, 'docs', 'fonts', file))
    const ur = /unicode-range:\s*([^;]+);/.exec(b)[1].trim()
    const name = /font-family:\s*'([^']+)'/.exec(b)[1]
    css += `@font-face{font-family:"${name}";font-style:${st};font-weight:${w};font-display:swap;src:url(fonts/${file}) format("woff2");unicode-range:${ur}}\n`
  }
}
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
