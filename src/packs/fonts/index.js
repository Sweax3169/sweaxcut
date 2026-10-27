// Yazı tipi paketi — 97 aile, hepsi çevrimdışı (public/fonts), hepsinde Türkçe (latin-ext) glifler.
// Dosyalar copy-fonts.cjs ile @fontsource paketlerinden kopyalanır; catalog.js o betiğin çıktısıdır.
// Kullanım: import { loadFonts, ensureFont, fontsReady } from './packs/fonts/index.js'
//   loadFonts()       → bütün FontFace'leri document.fonts'a ekler ve yükler (tekrar çağrılırsa aynı sözü döner)
//   ensureFont('Anton') → o ailenin bütün dosyalarını yükler (dışa aktarmadan önce bekle)
//   fontsReady        → loadFonts bitince çözülür
// Sayfa kökü dışında (ör. /dev/x.html) çalışıyorsan önce window.SWEAX_FONT_BASE = '/' ata.

import { register, list } from '../../engine/registry.js'
import { FONT_CATALOG, UNICODE_RANGES } from './catalog.js'

export const FONT_CATEGORIES = [
  { id: 'display', name: 'Kalın başlık' },
  { id: 'sans', name: 'Yalın' },
  { id: 'serif', name: 'Tırnaklı' },
  { id: 'hand', name: 'El yazısı' },
  { id: 'gaming', name: 'Oyun' },
  { id: 'fun', name: 'Eğlenceli' },
  { id: 'mono', name: 'Eş aralıklı' },
]

// Arayüzün kendi yazı tipleri (önce bunlar yüklenir)
export const UI_FONTS = ['Archivo', 'JetBrains Mono', 'Anton']

const TAGS = {
  display: ['başlık', 'kalın', 'display'], sans: ['sade', 'modern'], serif: ['klasik', 'zarif'],
  hand: ['el yazısı', 'script', 'imza'], gaming: ['oyun', 'piksel', 'gamer'], fun: ['eğlenceli', 'komik'], mono: ['kod', 'sayı'],
}

export const FONTS = FONT_CATALOG.map(f => ({
  id: f.id,
  name: f.name,
  category: f.category,
  tags: TAGS[f.category] || [],
  weights: [...new Set(f.files.filter(x => x.style === 'normal').map(x => x.weight))].sort((a, b) => a - b),
  italic: f.files.some(x => x.style === 'italic'),
  files: f.files.map(x => ({ weight: x.weight, style: x.style, url: x.url, unicodeRange: UNICODE_RANGES[x.range] })),
}))

register('fonts', FONTS, FONT_CATEGORIES)

const hasDOM = typeof document !== 'undefined' && !!document.fonts && typeof FontFace !== 'undefined'
const faces = new Map()     // aile → [FontFace]
let resolveReady
export const fontsReady = new Promise(r => { resolveReady = r })
let loading = null

function baseUrl() {
  const b = (typeof window !== 'undefined' && window.SWEAX_FONT_BASE) || (hasDOM ? document.baseURI : '')
  try { return new URL(b, hasDOM ? document.baseURI : undefined).href } catch (e) { return b }
}

function resolveUrl(u) {
  try { return new URL(u, baseUrl()).href } catch (e) { return u }
}

// FontFace nesnelerini document.fonts'a ekle (yüklemeden). Tuval yazısı bunları ihtiyaçta yükler.
export function registerFontFaces() {
  if (!hasDOM) return 0
  let n = 0
  for (const f of list('fonts')) {
    if (faces.has(f.id) || !f.files) continue
    const arr = []
    for (const file of f.files) {
      try {
        const desc = { weight: String(file.weight), style: file.style || 'normal', display: 'swap' }
        if (file.unicodeRange) desc.unicodeRange = file.unicodeRange
        const face = new FontFace(f.id, `url("${resolveUrl(file.url)}") format("woff2")`, desc)
        document.fonts.add(face)
        arr.push(face)
        n++
      } catch (e) { /* bozuk tanım */ }
    }
    faces.set(f.id, arr)
  }
  return n
}

function loadFaces(arr) {
  return Promise.all(arr.map(face => face.status === 'loaded' ? face : face.load().catch(e => { console.warn('yazı tipi yüklenemedi:', face.family, e && e.message); return null })))
}

function redraw() { if (typeof window !== 'undefined' && window.__sweaxRedraw) window.__sweaxRedraw() }

export function loadFonts() {
  if (loading) return loading
  if (!hasDOM) { resolveReady([]); loading = Promise.resolve([]); return loading }
  registerFontFaces()
  loading = (async () => {
    // önce arayüz yazı tipleri, sonra hepsi
    await loadFaces(UI_FONTS.flatMap(id => faces.get(id) || []))
    const all = [...faces.values()].flat()
    const res = await loadFaces(all)
    const failed = res.filter(x => !x).length
    redraw()
    const out = { families: faces.size, faces: all.length, failed }
    resolveReady(out)
    return out
  })()
  return loading
}

// Tek ailenin bütün dosyalarını yükle (dışa aktarma öncesi)
export async function ensureFont(family) {
  if (!hasDOM || !family) return false
  if (!faces.has(family)) registerFontFaces()
  const arr = faces.get(family)
  if (!arr || !arr.length) return false
  const res = await loadFaces(arr)
  redraw()
  return res.every(Boolean)
}

// Projedeki bütün yazı kliplerinin yazı tiplerini yükle
export async function ensureProjectFonts(project) {
  const fams = new Set()
  for (const t of (project && project.tracks) || []) for (const c of t.clips || []) if (c.text && c.text.font) fams.add(c.text.font)
  await Promise.all([...fams].map(ensureFont))
  return [...fams]
}

export function fontFamilies(category) { return list('fonts', category) }

if (hasDOM) registerFontFaces()
