// gl-transitions (MIT) paketinden GLSL ES 3.00 sürümlerini gl-vendor.json'a aktarır.
// Kullanım: npm pack gl-transitions@2.0.0 → aç → node vendor-gl.cjs <paket-klasörü>
const fs = require('fs')
const path = require('path')
const dir = process.argv[2]
if (!dir) { console.error('paket klasörü ver'); process.exit(1) }
const all = JSON.parse(fs.readFileSync(path.join(dir, 'gl-transitions.json'), 'utf8'))
const ver = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version
const out = []
for (const t of all) {
  const f = path.join(dir, 'glsl3', t.name + '.glsl')
  let glsl = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : t.glsl
  // ilk satırdaki "generated from" yorumu gereksiz
  glsl = glsl.replace(/^\/\/ .*GLSL ES 3\.00, generated from .*\n/, '')
  out.push({
    name: t.name, author: t.author, license: t.license, description: t.description || '',
    tags: t.tags || [], textures: t.textures || [], params: t.params || {}, glsl,
  })
}
const dst = path.join(__dirname, '..', 'gl-vendor.json')
fs.writeFileSync(dst, JSON.stringify({ source: 'gl-transitions@' + ver, transitions: out }))
console.log('yazıldı', out.length, 'geçiş →', dst)
