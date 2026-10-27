// Hazır arka planlar: düz renkler ve degradeler — ilk kullanımda proje boyutunda PNG olarak üretilir.
import { fs, path, cacheDir } from '../../platform/node.js'

export const SOLIDS = [
  ['siyah', 'Siyah', '#000000'], ['beyaz', 'Beyaz', '#ffffff'], ['limon', 'Limon', '#e4ff3a'],
  ['kirmizi', 'Kırmızı', '#ff2d4a'], ['mavi', 'Mavi', '#2f6bff'], ['mor', 'Mor', '#7b2fff'],
  ['pembe', 'Pembe', '#ff5da2'], ['turuncu', 'Turuncu', '#ff7a00'], ['lacivert', 'Lacivert', '#0b1a3a'],
  ['grafit', 'Grafit', '#2a2d32'], ['yesil-ekran', 'Yeşil perde', '#00ff00'], ['mavi-ekran', 'Mavi perde', '#0047bb'],
].map(([id, name, c]) => ({ id: 'solid-' + id, name, kind: 'solid', colors: [c] }))

export const GRADIENTS = [
  ['gece', 'Gece', ['#0f0c29', '#302b63', '#24243e'], 160],
  ['gun-batimi', 'Gün batımı', ['#ff512f', '#dd2476'], 135],
  ['okyanus', 'Okyanus', ['#2193b0', '#6dd5ed'], 180],
  ['neon', 'Neon', ['#ff00cc', '#3333ff'], 135],
  ['zehir', 'Zehir', ['#a8ff00', '#00b36b'], 160],
  ['ates', 'Ateş', ['#f12711', '#f5af19'], 180],
  ['buz', 'Buz', ['#e0eafc', '#9fb8d9'], 180],
  ['karbon', 'Karbon', ['#232526', '#414345'], 135],
  ['aurora', 'Aurora', ['#00c9ff', '#92fe9d'], 135],
  ['vapor', 'Vapor', ['#fc466b', '#3f5efb'], 135],
  ['zumrut', 'Zümrüt', ['#0b3d2e', '#1f9e74'], 160],
  ['kan', 'Kan kırmızı', ['#2b0000', '#a3001b'], 180],
].map(([id, name, colors, angle]) => ({ id: 'grad-' + id, name, kind: 'gradient', colors, angle }))

export const BUILTINS = [...SOLIDS, ...GRADIENTS]

export function cssOf(def) {
  if (def.kind === 'solid') return def.colors[0]
  return `linear-gradient(${def.angle}deg, ${def.colors.join(', ')})`
}

function drawDef(def, W, H) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')
  if (def.kind === 'solid') { x.fillStyle = def.colors[0]; x.fillRect(0, 0, W, H); return c }
  // CSS açısıyla aynı yön (0° = yukarı)
  const a = (def.angle - 90) * Math.PI / 180
  const L = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))
  const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2
  const g = x.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy)
  def.colors.forEach((col, i) => g.addColorStop(i / Math.max(1, def.colors.length - 1), col))
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  return c
}

// Senkron: sürükleme başlangıcında da çağrılabilir
export function builtinFile(def, W, H) {
  if (!fs) return null
  const dir = cacheDir('generated', 'hazir')
  const out = path.join(dir, `${def.id}-${W}x${H}.png`)
  try { if (fs.statSync(out).size > 0) return out } catch (e) { /* yok */ }
  const url = drawDef(def, W, H).toDataURL('image/png')
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
  return out
}
