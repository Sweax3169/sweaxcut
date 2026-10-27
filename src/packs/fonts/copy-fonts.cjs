// Yazı tipi kopyalayıcı (geliştirici aracı — uygulama içe aktarmaz)
// node src/packs/fonts/copy-fonts.cjs
// spec.json'daki aileleri node_modules/@fontsource/*'tan public/fonts/<id>/ altına kopyalar (latin + latin-ext woff2),
// catalog.js (kayıt verisi), public/fonts/fonts.css ve docs/licenses/fonts.md üretir.
// Glif denetimi: her ağırlık için latin + latin-ext cmap birleşimi 12 Türkçe harfin hepsini içermeli
// (latin-ext alt kümesi olması yetmez; ı latin'de, ğ ş İ latin-ext'te). Eksik olan aile/ağırlık reddedilir.

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../..')
const spec = require('./spec.json')
const { woff2Codepoints } = require('./woff2-cmap.cjs')
const TR = [...'çÇğĞıİöÖşŞüÜ'].map(c => c.codePointAt(0))
const outDir = path.join(root, 'public/fonts')
const SUBSETS = ['latin', 'latin-ext']

// eski kopyaları temizle (yalnız yazı tipi klasörleri)
if (fs.existsSync(outDir)) for (const d of fs.readdirSync(outDir)) { const f = path.join(outDir, d); if (fs.statSync(f).isDirectory()) fs.rmSync(f, { recursive: true }) }
fs.mkdirSync(outDir, { recursive: true })
const catalog = []
const css = ['/* SWEAXCUT yazı tipleri — copy-fonts.cjs üretir, elle düzenleme */']
const lic = ['# Yazı tipleri — lisanslar', '', 'Hepsi npm `@fontsource/*` paketlerinden (Google Fonts kaynaklı) kopyalandı. Yalnızca latin + latin-ext woff2 dosyaları.', '', '| Aile | Lisans | Telif / kaynak |', '|---|---|---|']
const dropped = []
let files = 0, bytes = 0
const ranges = []

for (const category of Object.keys(spec)) {
  for (const row of spec[category]) {
    const [id, family, weights, italics = []] = row
    const pkg = path.join(root, 'node_modules/@fontsource', id)
    const meta = JSON.parse(fs.readFileSync(path.join(pkg, 'metadata.json'), 'utf8'))
    const uni = JSON.parse(fs.readFileSync(path.join(pkg, 'unicode.json'), 'utf8'))
    if (!meta.subsets.includes('latin-ext')) { dropped.push(id + ' (latin-ext yok)'); continue }
    const entry = { id: family, name: family, category, files: [] }
    const faces = [...weights.map(w => [w, 'normal']), ...italics.map(w => [w, 'italic'])]
    let ok = true
    for (const [w, style] of faces) {
      // Türkçe glif denetimi
      const cps = new Set()
      for (const sub of SUBSETS) {
        const f = path.join(pkg, 'files', `${id}-${sub}-${w}-${style}.woff2`)
        if (fs.existsSync(f)) for (const c of woff2Codepoints(fs.readFileSync(f))) cps.add(c)
      }
      const miss = TR.filter(c => !cps.has(c)).map(c => String.fromCodePoint(c)).join('')
      if (miss) { dropped.push(`${id} ${w}${style === 'italic' ? 'i' : ''} (eksik: ${miss})`); continue }
      for (const sub of SUBSETS) {
        const fn = `${id}-${sub}-${w}-${style}.woff2`
        const src = path.join(pkg, 'files', fn)
        if (!fs.existsSync(src)) { console.log('EKSİK', fn); ok = false; continue }
        const dst = path.join(outDir, id, fn)
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
        files++; bytes += fs.statSync(dst).size
        let ri = ranges.indexOf(uni[sub])
        if (ri < 0) { ri = ranges.length; ranges.push(uni[sub]) }
        entry.files.push({ weight: w, style, url: `./fonts/${id}/${fn}`, subset: sub, range: ri })
        css.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${w};font-display:swap;src:url(./${id}/${fn}) format('woff2');unicode-range:${uni[sub]}}`)
      }
    }
    if (!entry.files.length) { if (!ok) dropped.push(id + ' (dosya yok)'); continue }
    void ok
    catalog.push(entry)
    const L = meta.license || {}
    lic.push(`| ${family} | ${L.type || '?'} | ${(L.attribution || '').replace(/\|/g, '/')} |`)
  }
}

const js = `// copy-fonts.cjs üretir — elle düzenleme. ${catalog.length} aile, ${files} dosya.\nexport const UNICODE_RANGES = ${JSON.stringify(ranges)}\nexport const FONT_CATALOG = ${JSON.stringify(catalog)}\n`
fs.writeFileSync(path.join(__dirname, 'catalog.js'), js)
fs.writeFileSync(path.join(outDir, 'fonts.css'), css.join('\n') + '\n')
fs.mkdirSync(path.join(root, 'docs/licenses'), { recursive: true })
lic.push('', '## Elenen aileler (Türkçe glif eksik)', '',
  'cmap denetimiyle (woff2-cmap.cjs) latin + latin-ext birleşiminde 12 Türkçe harf (çÇğĞıİöÖşŞüÜ) arandı:', '',
  '- latin-ext var ama glif eksik: Rubik Mono One (ı), Passion One / Fredoka / Lilita One / Bubblegum Sans / Metal Mania / Zen Dots / Sniglet / Chango (ğĞİşŞ), Silkscreen (ğĞıİşŞ), Titan One (İ)',
  '- latin-ext hiç yok: Permanent Marker, Satisfy, Orbitron, Chewy',
  '- Yerlerine: Sedgwick Ave (+Display), Kaushan Script, Exo 2 / Oxanium, Paytone One, Rammetto One, Coiny, Rowdies, Tiny5, Bowlby One SC')
lic.push('', 'OFL-1.1: https://openfontlicense.org — Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0')
fs.writeFileSync(path.join(root, 'docs/licenses/fonts.md'), lic.join('\n') + '\n')
console.log(`aile=${catalog.length} dosya=${files} boyut=${(bytes / 1048576).toFixed(2)}MB reddedilen=${dropped.join(', ') || '-'}`)
