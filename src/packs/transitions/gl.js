// gl-transitions koleksiyonunu SWEAXCUT geçiş biçimine çevir
import vendor from './gl-vendor.json'
import { GL_META, PARAM_LABELS, PARAM_OVERRIDES, GL_PATCHES } from './gl-meta.js'

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
const hex2 = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
const toHex = a => '#' + hex2(a[0]) + hex2(a[1]) + hex2(a[2])
const nice = v => {
  if (v <= 0) return 1
  const e = Math.pow(10, Math.floor(Math.log10(v)))
  const m = v / e
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e
}

function convParam(tname, key, p) {
  const ov = PARAM_OVERRIDES[tname + '.' + key] || {}
  let type = p.type
  let def = p.default
  const out = { key, label: ov.label || PARAM_LABELS[key] || key, type, default: def }
  if (type === 'vec3' && p.color) { out.type = 'color'; out.default = toHex(def || [1, 1, 1]); return out }
  if (type === 'bool') { out.default = !!def; return out }
  if (p.color) out.color = true
  let min = ov.min ?? p.min, max = ov.max ?? p.max
  if (min == null || max == null) {
    const vals = [].concat(def ?? 0).map(Number)
    const m = Math.max(...vals.map(Math.abs))
    const neg = vals.some(v => v < 0)
    if (p.color || key === 'center' || key === 'star_center') { min = 0; max = 1 }
    else if (type === 'int' || type === 'ivec2') { min = neg ? -nice(m * 3) : 0; max = Math.max(4, nice(m * 3)) }
    else if (m === 0) { min = 0; max = 1 }
    else if (m <= 1) { min = neg ? -1 : 0; max = m < 0.2 ? nice(m * 5) : 1 }
    else { max = nice(m * 3); min = neg ? -max : 0 }
  }
  out.min = min; out.max = max
  out.step = (type === 'int' || type === 'ivec2') ? 1 : +((max - min) / 100).toPrecision(2)
  return out
}

export const GL_TRANSITIONS = []
export const GL_DROPPED = []

for (const t of vendor.transitions) {
  const meta = GL_META[t.name]
  if (!meta) { GL_DROPPED.push(t.name + ' (Türkçe ad yok)'); continue }
  let glsl = t.glsl
  if (t.textures && t.textures.length) {
    const patch = GL_PATCHES[t.name]
    if (!patch) { GL_DROPPED.push(t.name + ' (ek doku)'); continue }
    glsl = patch(glsl)
  }
  GL_TRANSITIONS.push({
    id: 'gl-' + kebab(t.name),
    name: meta[0],
    category: meta[1],
    duration: meta[2],
    glsl,
    params: Object.entries(t.params || {}).map(([k, p]) => convParam(t.name, k, p)),
    tags: ['gl', ...(t.tags || [])],
    source: { collection: vendor.source, name: t.name, author: t.author, license: t.license },
  })
}
