// Denetçi test düzeneği: sahte proje + bütün seçim/sekme senaryoları + işlev doğrulaması
// Ekran görüntüleri: dev/inspector-shots.cjs (her senaryo için ayrı PNG). Tek görüntü: scripts/devshot.cjs.
import React, { Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/ui/styles/base.css'
import { store } from '../src/core/store.js'
import * as M from '../src/core/model.js'
import { REG, register } from '../src/engine/registry.js'
import { playback } from '../src/engine/playback.js'
import { TipLayer, MenuLayer } from '../src/ui/controls.jsx'
import Inspector from '../src/ui/inspector/Inspector.jsx'

window.SWEAX_FONT_BASE = '/'
if (navigator.userAgent.includes('Electron')) document.documentElement.classList.add('noanim')
const packs = import.meta.glob('../src/packs/*/index.js')
const log = (...a) => console.log('[denetçi]', ...a)
const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function loadPacks() {
  const out = {}
  for (const [k, f] of Object.entries(packs)) {
    const name = k.split('/')[3]
    try { await f(); out[name] = 'ok' } catch (e) { out[name] = 'HATA: ' + e.message; console.warn('paket yüklenemedi', name, e) }
  }
  return out
}

// ---------------------------------------------------------------- eksik kayıtlar için sahteler
function fakes() {
  const made = []
  const need = (k) => { if (!REG[k].list.length) { made.push(k); return true } return false }
  if (need('effects')) register('effects', [
    { id: 'f-zoom', name: 'Ritim Zoom', category: 'temel', params: [{ key: 'amount', label: 'Zoom gücü', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 }, { key: 'bpm', label: 'Tempo', type: 'range', min: 40, max: 200, step: 1, default: 120 }], glsl: 'vec4 effect(vec2 uv){return tex(uv);}' },
    { id: 'f-rgb', name: 'RGB Kayma', category: 'glitch', params: [{ key: 'amount', label: 'Güç', type: 'range', min: 0, max: 1, default: 0.4 }, { key: 'tint', label: 'Renk', type: 'color', default: '#ff3b5c' }, { key: 'mono', label: 'Siyah-beyaz', type: 'bool', default: false }, { key: 'mode', label: 'Mod', type: 'select', options: [{ value: 'a', label: 'Yatay' }, { value: 'b', label: 'Dikey' }], default: 'a' }], glsl: 'vec4 effect(vec2 uv){return tex(uv);}' },
  ], [{ id: 'temel', name: 'Temel' }, { id: 'glitch', name: 'Glitch' }])
  if (need('filters')) register('filters', ['Sinema', 'Gece', 'Sıcak', 'Soğuk', 'Solgun', 'Neon', 'Siyah-beyaz', 'Film', 'Altın', 'Buz', 'Pastel', 'Kontrast'].map((n, i) => ({
    id: 'flt-' + i, name: n, category: i < 6 ? 'oyun' : 'film', adjust: { temperature: (i % 5 - 2) * 20, saturation: i * 4 - 20 },
    swatch: [['#1b3a5c', '#e0a050'], ['#0b1030', '#3050c0'], ['#e08030', '#602010'], ['#40a0e0', '#103050'], ['#c0b8a0', '#605848'], ['#ff2aa0', '#20e0ff'], ['#eee', '#111'], ['#a08060', '#203040'], ['#ffd040', '#604000'], ['#d0f0ff', '#4080a0'], ['#ffc0d0', '#c0e0ff'], ['#000', '#fff']][i],
  })), [{ id: 'oyun', name: 'Oyun' }, { id: 'film', name: 'Film' }])
  if (need('clipAnims')) register('clipAnims', [
    { id: 'a-fade', name: 'Belir', category: 'in', duration: 0.5, fn: p => ({ opacity: p }) },
    { id: 'a-zoom', name: 'Yakınlaş', category: 'in', duration: 0.5, fn: p => ({ scale: 0.3 + 0.7 * p, opacity: p }) },
    { id: 'a-slide', name: 'Soldan kay', category: 'in', duration: 0.5, fn: p => ({ x: -(1 - p) * 0.6 }) },
    { id: 'a-spin', name: 'Dönerek', category: 'in', duration: 0.6, fn: p => ({ rotation: (1 - p) * -180, scale: p }) },
    { id: 'o-fade', name: 'Kaybol', category: 'out', duration: 0.5, fn: p => ({ opacity: 1 - p }) },
    { id: 'o-drop', name: 'Düş', category: 'out', duration: 0.5, fn: p => ({ y: p * p * 0.8 }) },
    { id: 'l-pulse', name: 'Nabız', category: 'loop', duration: 1, fn: p => ({ scale: 1 + 0.1 * Math.sin(p * Math.PI * 2) }) },
    { id: 'l-shake', name: 'Titreşim', category: 'loop', duration: 0.4, fn: p => ({ x: Math.sin(p * 40) * 0.03 }) },
  ])
  if (need('textAnims')) register('textAnims', [
    { id: 't-type', name: 'Daktilo', category: 'in', duration: 1, unit: 'whole', fn: p => ({ visibleChars: p }) },
    { id: 't-pop', name: 'Harf harf zıpla', category: 'in', duration: 0.8, unit: 'char', stagger: 0.12, fn: p => ({ y: (1 - p) * 10, opacity: p, scale: 0.5 + p * 0.5 }) },
    { id: 't-out', name: 'Harf harf düş', category: 'out', duration: 0.8, unit: 'char', stagger: 0.1, fn: p => ({ y: p * 14, opacity: 1 - p }) },
    { id: 't-wave', name: 'Dalga', category: 'loop', duration: 1.2, unit: 'char', fn: (p, i) => ({ y: Math.sin(p * 6.28 + i) * 4 }) },
  ])
  if (need('textTemplates')) register('textTemplates', [
    { id: 'tp-1', name: 'Oyun başlığı', category: 'oyun', text: { font: 'Bungee', color: '#e4ff3a', stroke: { enabled: true, color: '#000', width: 10 } }, sampleText: 'GG!' },
    { id: 'tp-2', name: 'Neon', category: 'oyun', text: { font: 'Monoton', color: '#ff5da2', glow: { enabled: true, color: '#ff5da2', size: 30, strength: 1.2 }, stroke: { enabled: false } }, sampleText: 'NEON' },
    { id: 'tp-3', name: 'Altyazı kutusu', category: 'temel', text: { font: 'Archivo Black', color: '#fff', bg: { enabled: true, color: '#000', opacity: 0.8, radius: 6, padX: 20, padY: 10, mode: 'line' }, stroke: { enabled: false } }, sampleText: 'Aa' },
    { id: 'tp-4', name: 'Degrade', category: 'temel', text: { font: 'Anton', fill: { type: 'linear', angle: 90, stops: [{ at: 0, color: '#ff3b5c' }, { at: 1, color: '#ffd400' }] } }, sampleText: 'ŞOK' },
  ])
  if (need('captionStyles')) register('captionStyles', [
    { id: 'cs-1', name: 'Hormozi', category: 'pop', words: 3, uppercase: true, text: { font: 'Anton', color: '#fff', stroke: { enabled: true, color: '#000', width: 10 } }, active: { color: '#e4ff3a', scale: 1.15 } },
    { id: 'cs-2', name: 'Kutu vurgu', category: 'pop', words: 3, text: { font: 'Archivo Black', color: '#fff' }, active: { bg: { color: '#ff3b5c', radius: 6, padX: 8, padY: 4 } } },
    { id: 'cs-3', name: 'Sade', category: 'temel', words: 4, text: { font: 'Inter', color: '#fff' }, past: { opacity: 0.5 }, future: { opacity: 0.5 } },
  ])
  if (need('speedCurves')) register('speedCurves', [
    { id: 'montaj', name: 'Montaj', points: [{ x: 0, y: 1 }, { x: 0.3, y: 3 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 3 }, { x: 1, y: 1 }] },
    { id: 'kahraman', name: 'Kahraman', points: [{ x: 0, y: 2.5 }, { x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 1, y: 2.5 }] },
  ])
  if (need('voiceFx')) register('voiceFx', ['Sincap', 'Robot', 'Dev', 'Telsiz', 'Yankı', 'Mağara'].map((n, i) => ({ id: 'v-' + i, name: n, category: 'eglence', ffmpeg: () => 'anull', params: i === 1 ? [{ key: 'amount', label: 'Güç', type: 'range', min: 0, max: 1, default: 0.6 }] : [] })))
  if (need('transitions')) register('transitions', [{ id: 'tr-fade', name: 'Çapraz geçiş', category: 'temel', duration: 0.6, glsl: '', params: [{ key: 'smooth', label: 'Yumuşaklık', type: 'float', min: 0, max: 1, default: 0.5 }] }])
  if (need('stickers')) register('stickers', [{ id: 'st-sub', name: 'Abone ol', category: 'sosyal', kind: 'vector', draw: () => {}, params: [{ key: 'color', label: 'Renk', type: 'color', default: '#ff0033' }, { key: 'text', label: 'Yazı', type: 'text', default: 'ABONE OL' }, { key: 'speed', label: 'Hız', type: 'range', min: 0, max: 3, default: 1 }] }])
  return made
}

// ---------------------------------------------------------------- sahte proje
function buildProject() {
  const p = M.createProject({ ratio: '9:16', name: 'Battle royale kesit' })
  p.media.m1 = { id: 'm1', type: 'video', name: 'oyun-kaydi-1440p.mp4', path: 'C:/x/oyun.mp4', width: 2560, height: 1440, duration: 12, fps: 60, hasAudio: true, status: 'ready' }
  p.media.m2 = { id: 'm2', type: 'audio', name: 'arka-plan-muzik.mp3', path: 'C:/x/m.mp3', duration: 30, hasAudio: true, status: 'ready' }
  p.media.m3 = { id: 'm3', type: 'image', name: 'logo.png', path: 'C:/x/logo.png', width: 800, height: 800, status: 'ready' }
  const firstOf = (k, f = () => true) => (REG[k].list.find(f) || {}).id
  const v = M.createMediaClip(p.media.m1, { id: 'cv', start: 0, duration: 6, in: 0, out: 6, name: 'Son çember' })
  v.keyframes = { 'transform.scale': [{ t: 0, v: 1, ease: 'easeInOut' }, { t: 2, v: 1.4, ease: 'easeOut' }], opacity: [{ t: 0, v: 0.6, ease: 'linear' }, { t: 1.5, v: 1, ease: 'easeInOut' }] }
  v.transition = { id: firstOf('transitions'), duration: 0.6, params: {} }
  v.effects = REG.effects.list.slice(0, 2).map((d, i) => ({ uid: 'e' + i, id: d.id, enabled: i === 0, params: Object.fromEntries((d.params || []).map(q => [q.key, q.default])) }))
  v.filter = { id: firstOf('filters'), intensity: 0.8 }
  v.adjust = { ...v.adjust, contrast: 12, saturation: 10, temperature: -8, sharpen: 15 }
  v.hsl.orange = { h: 10, s: 20, l: 0 }
  v.mask = { ...v.mask, type: 'circle', w: 0.6, h: 0.45, feather: 12 }
  v.anim = { in: { id: firstOf('clipAnims', x => x.category === 'in'), duration: 0.5 }, out: null, loop: null }
  v.crop = { l: 0.1, t: 0, r: 0.1, b: 0.05 }
  const im = M.createMediaClip(p.media.m3, { id: 'ci', start: 6, duration: 3 })
  p.tracks[0].clips.push(v, im)

  const tt = M.createTrack('text', { name: 'Yazı' })
  const tx = M.createTextClip({ id: 'ct', start: 1, duration: 4, name: '', text: { content: 'SON ÇEMBER GELİYOR!\nHazır mısın?', font: 'Bungee', size: 88 } })
  tx.caption = { words: [{ w: 'SON', s: 0, e: 0.4 }, { w: 'ÇEMBER', s: 0.4, e: 1.1 }, { w: 'GELİYOR!', s: 1.1, e: 2 }], styleId: firstOf('captionStyles'), groupId: 'g1' }
  tx.anim = { in: { id: firstOf('textAnims', x => x.category === 'in'), duration: 0.8 }, out: null, loop: null }
  const tx2 = M.createTextClip({ id: 'ct2', start: 5.5, duration: 2, text: { content: 'İKİNCİ ALTYAZI' } })
  tx2.caption = { words: [{ w: 'İKİNCİ', s: 0, e: 1 }, { w: 'ALTYAZI', s: 1, e: 2 }], styleId: null, groupId: 'g1' }
  tt.clips.push(tx, tx2)

  const st = M.createTrack('sticker', { name: 'Çıkartma' })
  const sdef = REG.stickers.list.find(x => x.kind === 'vector' && x.params && x.params.length) || REG.stickers.list[0]
  const sk = M.createStickerClip(sdef || { kind: 'emoji', id: 'x', name: 'Emoji' }, { id: 'cs', start: 2, duration: 3 })
  const edef = REG.stickers.list.find(x => x.kind === 'emoji')
  const sk2 = edef ? M.createStickerClip(edef, { id: 'cs2', start: 6, duration: 2 }) : null
  st.clips.push(sk); if (sk2) st.clips.push(sk2)

  const et = M.createTrack('effect', { name: 'Efekt' })
  const ed = REG.effects.list[0]
  const ec = M.createEffectClip({ ...ed, defaults: Object.fromEntries((ed.params || []).map(q => [q.key, q.default])) }, { id: 'ce', start: 0, duration: 2 })
  const fc = M.createFilterClip(REG.filters.list[2] || REG.filters.list[0], { id: 'cf', start: 2.5, duration: 2 })
  const ac = M.createAdjustClip({ id: 'ca', start: 5, duration: 2 })
  ac.adjust.exposure = 10
  et.clips.push(ec, fc, ac)

  const at = M.createTrack('audio', { name: 'Ses' })
  const au = M.createAudioClip(p.media.m2, { id: 'cau', start: 0, duration: 12, out: 12, role: 'music' })
  au.beats = Array.from({ length: 24 }, (_, i) => +(i * 0.5).toFixed(2))
  au.audio.voiceFx = { id: firstOf('voiceFx'), params: {} }
  at.clips.push(au)

  p.tracks = [st, tt, et, p.tracks[0], at]
  return p
}

// ---------------------------------------------------------------- arayüz
let commits = 0
function App() {
  return (
    <div className="tstage">
      <div className="tslot" id="slot" style={{ width: +(new URLSearchParams(location.search).get('w') || 330) }}>
        <Profiler id="insp" onRender={() => { commits++ }}><Inspector /></Profiler>
      </div>
      <div className="tinfo" id="info" />
      <TipLayer /><MenuLayer />
    </div>
  )
}

// ---------------------------------------------------------------- senaryo yardımcıları
const sel = (...ids) => store.select(ids)
const tab = (type, id) => store.setUI({ inspectorTab: { [type]: id } })
const body = () => document.querySelector('.ibody')
function openSec(title, open = true) {
  for (const h of document.querySelectorAll('.isec > .shead')) {
    const t = h.querySelector('.sttl')
    if (t && t.textContent.trim() === title) {
      const closed = h.parentElement.classList.contains('closed')
      if (closed === open) h.click()
      return true
    }
  }
  return false
}
const clickText = (selector, text) => { const el = [...document.querySelectorAll(selector)].find(e => e.textContent.trim().startsWith(text)); if (el) el.click(); return !!el }
const setVal = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
function rowByLabel(label) {
  return [...document.querySelectorAll('.prop')].find(r => { const l = r.querySelector('.lbl'); return l && l.textContent.trim().startsWith(label) && (l.querySelector('.lt') ? l.querySelector('.lt').textContent.trim() === label : l.textContent.trim() === label) })
}
function typeNum(input, v) {
  input.focus(); input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  setVal(input, String(v))
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); input.blur()
}
const clip = (id) => { for (const t of store.get().project.tracks) for (const c of t.clips) if (c.id === id) return c; return null }

const S = [
  ['proje', async () => { sel() }],
  ['video-temel', async () => { sel('cv'); tab('video', 'basic'); playback.seek(2) }],
  ['video-temel-alt', async () => { sel('cv'); tab('video', 'basic'); await wait(50); openSec('Kırp'); openSec('Arka plan tuvali'); openSec('Krom anahtar'); openSec('Konum ve boyut', false); openSec('Görünüm', false) }],
  ['video-maske', async () => { openSec('Konum ve boyut'); openSec('Görünüm'); sel('cv'); tab('video', 'mask') }],
  ['video-renk', async () => { sel('cv'); tab('video', 'color') }],
  ['video-renk-alt', async () => { sel('cv'); tab('video', 'color'); await wait(50); openSec('Filtre', false); openSec('Işık', false); openSec('HSL') }],
  ['video-efekt', async () => { openSec('Filtre'); openSec('Işık'); sel('cv'); tab('video', 'effects'); await wait(50); const h = document.querySelector('.fxh'); if (h) h.click() }],
  ['video-efekt-secici', async () => { sel('cv'); tab('video', 'effects'); await wait(30); clickText('.btn.addfx', 'Efekt ekle') }],
  ['video-anim', async () => { document.body.click(); sel('cv'); tab('video', 'anim') }],
  ['video-hiz', async () => { sel('cv'); tab('video', 'speed') }],
  ['video-hiz-egri', async () => { sel('cv'); tab('video', 'speed'); await wait(30); clickText('.isub .st', 'Eğri') }],
  ['video-ses', async () => { sel('cv'); tab('video', 'audio') }],
  ['video-gecis', async () => { sel('cv'); store.setUI({ inspectorTab: 'transition' }) }],
  ['yazi-metin', async () => { playback.seek(2); sel('ct'); tab('text', 'text') }],
  ['yazi-font', async () => { sel('ct'); tab('text', 'text'); await wait(30); document.querySelector('.fpbtn').click() }],
  ['yazi-stil', async () => { document.body.click(); sel('ct'); tab('text', 'style') }],
  ['yazi-stil-alt', async () => { sel('ct'); tab('text', 'style'); await wait(30); openSec('Şablonlar', false); openSec('Gölge'); openSec('Arka plan kutusu') }],
  ['yazi-anim', async () => { openSec('Şablonlar'); sel('ct'); tab('text', 'anim') }],
  ['yazi-altyazi', async () => { sel('ct'); tab('text', 'caption') }],
  ['yazi-seslendir', async () => { sel('ct'); tab('text', 'tts') }],
  ['yazi-temel', async () => { sel('ct'); tab('text', 'basic') }],
  ['cikartma', async () => { sel('cs'); tab('sticker', 'sticker') }],
  ['cikartma-emoji', async () => { if (clip('cs2')) { sel('cs2'); tab('sticker', 'sticker') } }],
  ['ses', async () => { sel('cau'); tab('audio', 'audio') }],
  ['ses-degistir', async () => { sel('cau'); tab('audio', 'voice') }],
  ['ses-hiz', async () => { sel('cau'); tab('audio', 'speed') }],
  ['efekt-katmani', async () => { sel('ce'); tab('effect', 'params') }],
  ['filtre-katmani', async () => { sel('cf'); tab('filter', 'filter') }],
  ['ayar-katmani', async () => { sel('ca'); tab('adjust', 'adjust') }],
  ['coklu', async () => { sel('cv', 'ci', 'ct', 'cau') }],
  ['gorsel-temel', async () => { sel('ci'); tab('image', 'basic') }],
  ['yazi-degrade', async () => {
    sel('ct'); tab('text', 'text')
    store.edit('t', d => { for (const t of d.tracks) for (const c of t.clips) if (c.id === 'ct') c.text.fill = { type: 'linear', angle: 90, stops: [{ at: 0, color: '#ff3b5c' }, { at: 0.55, color: '#ffd400' }, { at: 1, color: '#2ee6a6' }] } }, { noHistory: true })
    await wait(40); openSec('Yerleşim')
  }],
]
window.__scenarios = S.map(s => s[0])
window.__run = async (i) => {
  const s = S[i]
  if (body()) body().scrollTop = 0
  await s[1]()
  await wait(140)
  return s[0]
}

// ---------------------------------------------------------------- işlev doğrulaması
window.__verify = async () => {
  const r = {}
  const ok = (k, v, extra) => { r[k] = v ? 'OK' : 'BAŞARISIZ' + (extra != null ? ' (' + JSON.stringify(extra) + ')' : ''); if (!v) console.warn('doğrulama başarısız:', k, extra) }
  document.body.click()
  // 1) anahtarlı opaklık: oynatma kafasına kare yazar
  playback.seek(2); sel('cv'); tab('video', 'basic'); await wait(120)
  typeNum(rowByLabel('Opaklık').querySelector('.num'), 55); await wait(60)
  const ko = clip('cv').keyframes.opacity
  ok('opaklik_anahtar_kare', ko.some(k => Math.abs(k.t - 2) < 0.01 && Math.abs(k.v - 0.55) < 1e-6), ko)
  // 2) konum X piksel → oran
  const xin = document.querySelector('.irow.v2 .cell .num')
  typeNum(xin, 108); await wait(60)
  ok('konum_x_piksel', Math.abs(clip('cv').transform.x - 0.1) < 1e-6, clip('cv').transform.x)
  // 3) döndürme elması → anahtar kare, geri al → kalkar
  rowByLabel('Döndürme').querySelector('.kf').click(); await wait(60)
  ok('dondurme_elmas', (clip('cv').keyframes['transform.rotation'] || []).length === 1)
  store.undo(); await wait(60)
  ok('geri_al', !clip('cv').keyframes['transform.rotation'])
  // 4) değer oynatma kafasıyla güncellenir (anahtarlı ölçek)
  playback.seek(0); await wait(120)
  const sc0 = rowByLabel('Ölçek').querySelector('.num').value
  playback.seek(2); await wait(120)
  const sc2 = rowByLabel('Ölçek').querySelector('.num').value
  ok('oynatma_kafasi_degeri', sc0.startsWith('100') && sc2.startsWith('140'), [sc0, sc2])
  // 5) kaydırıcı sürükleme (yazı boyutu)
  sel('ct'); tab('text', 'text'); await wait(120)
  const sl = rowByLabel('Boyut').querySelector('.slider')
  const rc = sl.getBoundingClientRect()
  sl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rc.left + 5, clientY: rc.top + 9, button: 0 }))
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + rc.width * 0.5, clientY: rc.top + 9 }))
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: rc.left + rc.width * 0.5, clientY: rc.top + 9 }))
  await wait(60)
  const sz = clip('ct').text.size
  ok('kaydirici_surukle', Math.abs(sz - 156) <= 2, sz)
  // 6) sekme hafızası + dizge isteği
  sel('cv'); tab('video', 'color'); await wait(60)
  sel('ct'); await wait(60)
  const tText = document.querySelector('.itab.on span').textContent
  sel('cv'); await wait(60)
  const tVid = document.querySelector('.itab.on span').textContent
  ok('sekme_hafizasi', tText === 'Metin' && tVid === 'Renk', [tText, tVid])
  store.setUI({ inspectorTab: 'transition' }); await wait(80)
  ok('dizge_sekme_istegi', document.querySelector('.itab.on span').textContent === 'Geçiş')
  // 7) yazı düzenleme olayı → Metin sekmesi + odak
  window.dispatchEvent(new CustomEvent('sweax:edit-text', { detail: 'ct' })); await wait(150)
  ok('edit_text_odak', document.activeElement && document.activeElement.classList.contains('itext') && store.get().selection.clips[0] === 'ct')
  setVal(document.activeElement, 'MERHABA ŞĞÜİÇÖ'); await wait(40)
  ok('metin_yaz', clip('ct').text.content === 'MERHABA ŞĞÜİÇÖ', clip('ct').text.content)
  document.activeElement.blur()
  // 8) efekt ekle (seçiciden ilk öğe)
  sel('ci'); tab('image', 'effects'); await wait(80)
  clickText('.btn.addfx', 'Efekt ekle'); await wait(80)
  const pi = document.querySelector('.picker .pi'); if (pi) pi.click(); await wait(60)
  ok('efekt_ekle', (clip('ci').effects || []).length === 1, (clip('ci').effects || []).length)
  // 9) maske türü
  tab('image', 'mask'); await wait(60)
  clickText('.icard', 'Yıldız'); await wait(60)
  ok('maske_turu', clip('ci').mask.type === 'star', clip('ci').mask.type)
  // 10) hız hazırı 2× → süre yarıya
  sel('cv'); tab('video', 'speed'); await wait(80)
  clickText('.isub .st', 'Normal'); await wait(40)
  const d0 = clip('cv').duration
  clickText('.chips.quick .chip', '2×'); await wait(60)
  ok('hiz_2x', clip('cv').speed === 2 && Math.abs(clip('cv').duration - d0 / 2) < 0.01, [clip('cv').speed, d0, clip('cv').duration])
  store.undo(); await wait(40)
  // 11) çoklu seçim: opaklık hepsine
  sel('ci', 'cs'); await wait(80)
  typeNum(rowByLabel('Opaklık').querySelector('.num'), 40); await wait(60)
  ok('coklu_opaklik', Math.abs(clip('ci').opacity - 0.4) < 1e-6 && Math.abs(clip('cs').opacity - 0.4) < 1e-6, [clip('ci').opacity, clip('cs').opacity])
  // 12) proje oranı
  sel(); await wait(60)
  clickText('.ratio', '16:9'); await wait(60)
  ok('proje_oran', store.get().project.settings.ratio === '16:9' && store.get().project.settings.width === 1920)
  store.undo(); await wait(40)
  // 13) gereksiz yeniden çizim yok: anahtarsız klipte oynatma kafası / ilgisiz klip düzenlemesi
  sel('ci'); await wait(100)
  let c0 = commits
  store.edit('ilgisiz', d => { for (const t of d.tracks) for (const c of t.clips) if (c.id === 'cau') c.audio.volume = 0.5 })
  await wait(80)
  ok('ilgisiz_duzenleme_cizmez', commits - c0 === 0, commits - c0)
  c0 = commits
  for (let i = 0; i < 10; i++) { playback.seek(6 + i * 0.1); await wait(16) }
  await wait(120)
  // yalnız alt şerit (12 fps) güncellenir; gövde anahtarsız klipte zamana abone değil
  ok('anahtarsiz_klip_az_cizim', commits - c0 <= 4, commits - c0)
  sel('cv'); await wait(100)
  c0 = commits
  for (let i = 0; i < 10; i++) { playback.seek(0.2 + i * 0.15); await wait(70) }
  await wait(80)
  const n = commits - c0
  ok('anahtarli_klip_zamanla_cizer', n >= 5, n)
  // 14) bölüm anahtar karelerini temizle
  tab('video', 'basic'); await wait(80)
  const kc = document.querySelector('.isec .kfclr'); if (kc) kc.click(); await wait(60)
  ok('bolum_kare_temizle', !clip('cv').keyframes['transform.scale'], Object.keys(clip('cv').keyframes))
  store.undo(); await wait(40)
  // 15) yumuşatma seçimi (kare üstündeyken)
  playback.seek(2); await wait(120)
  const es = document.querySelector('.kfbar select')
  if (es) { es.value = 'bounceOut'; es.dispatchEvent(new Event('change', { bubbles: true })) }
  await wait(60)
  ok('yumusatma', (clip('cv').keyframes['transform.scale'] || []).some(k => Math.abs(k.t - 2) < 0.01 && k.ease === 'bounceOut'))
  store.undo(); await wait(40)
  // 16) eğri düzenleyicide orta noktayı yukarı sürükle → özel eğri
  sel('cv'); tab('video', 'speed'); await wait(80)
  clickText('.isub .st', 'Eğri'); await wait(80)
  const pts = [...document.querySelectorAll('.curveed svg g[transform]')]
  const mid = pts[Math.floor(pts.length / 2)]
  if (mid) {
    const rr = mid.getBoundingClientRect()
    mid.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height / 2, button: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: rr.left + rr.width / 2, clientY: rr.top - 30 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: rr.left + rr.width / 2, clientY: rr.top - 30 }))
  }
  await wait(60)
  const scv = clip('cv').speedCurve
  ok('egri_surukle', scv && scv.id === 'custom' && scv.points.some(q => q.y > 1.5), scv)
  store.undo(); await wait(40)
  // 17) onaltılık renk yazma + degrade aç
  store.edit('t', d => { for (const t of d.tracks) for (const c of t.clips) if (c.id === 'ct') c.text.fill = null }, { noHistory: true })
  sel('ct'); tab('text', 'text'); await wait(80)
  const hx = rowByLabel('Renk').querySelector('.hex')
  typeNum(hx, 'FF0000'); await wait(40)
  ok('renk_hex', clip('ct').text.color === '#ff0000', clip('ct').text.color)
  rowByLabel('Degrade').querySelector('.toggle').click(); await wait(60)
  ok('degrade_ac', !!(clip('ct').text.fill && clip('ct').text.fill.stops.length === 2))
  // 18) altyazı stilini gruba uygula
  tab('text', 'caption'); await wait(80)
  clickText('.btn', 'Tüm altyazılara uygula'); await wait(60)
  ok('altyazi_tumune', clip('ct2').caption.styleId === clip('ct').caption.styleId && clip('ct2').text.font === clip('ct').text.font && clip('ct2').text.content === 'İKİNCİ ALTYAZI')
  // 19) başlıktan ad değiştir
  const nm = document.querySelector('.ihead input.iname')
  nm.focus(); nm.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); setVal(nm, 'Giriş yazısı'); nm.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  await wait(40)
  ok('ad_degistir', clip('ct').name === 'Giriş yazısı', clip('ct').name)
  // 20) maske merkezini şemada sürükle (tek geçmiş adımı)
  sel('cv'); tab('video', 'mask'); await wait(80)
  const h0 = store.get().history.past.length
  const cross = document.querySelector('.maskview svg g[style]')
  if (cross) {
    const rr = cross.getBoundingClientRect()
    cross.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rr.left + 9, clientY: rr.top + 9, button: 0 }))
    for (let i = 1; i <= 5; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: rr.left + 9 + i * 6, clientY: rr.top + 9 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: rr.left + 39, clientY: rr.top + 9 }))
  }
  await wait(60)
  const mx = clip('cv').mask.x, mh = store.get().history.past.length - h0
  // 21) efekt katmanı parametresi anahtar karelenir (fx:layer:<key>)
  sel('ce'); tab('effect', 'params'); playback.seek(0.5); await wait(120)
  const lp = (REG.effects.byId.get(clip('ce').effect.id).params || []).find(q => q.type === 'range')
  const lrow = rowByLabel(lp.label)
  lrow.querySelector('.kf').click(); await wait(60)
  const lpath = 'fx:layer:' + lp.key
  ok('efekt_katmani_elmas', (clip('ce').keyframes[lpath] || []).length === 1, Object.keys(clip('ce').keyframes))
  playback.seek(1.5); await wait(120)
  typeNum(rowByLabel(lp.label).querySelector('.num'), lp.max); await wait(60)
  const lk = clip('ce').keyframes[lpath] || []
  ok('efekt_katmani_ikinci_kare', lk.length === 2 && Math.abs(lk[1].v - lp.max) < 1e-6, lk)
  playback.seek(1.0); await wait(120)
  const mv = parseFloat(rowByLabel(lp.label).querySelector('.num').value)
  ok('efekt_katmani_ara_deger', mv > Math.min(lk[0].v, lk[1].v) && mv < Math.max(lk[0].v, lk[1].v), [mv, lk.map(k => k.v)])
  // 22) klip efekti parametresi (fx:<uid>:<key>)
  sel('cv'); tab('video', 'effects'); playback.seek(2); await wait(120)
  const fx0 = clip('cv').effects[0]
  const fp = (REG.effects.byId.get(fx0.id).params || []).find(q => q.type === 'range')
  if (!document.querySelector('.fxitem.open')) document.querySelector('.fxh').click()
  await wait(60)
  rowByLabel(fp.label).querySelector('.kf').click(); await wait(60)
  ok('klip_efekti_elmas', (clip('cv').keyframes['fx:' + fx0.uid + ':' + fp.key] || []).length === 1)
  ok('maske_surukle', mx > 0.05 && mh === 1, [mx, mh])
  return r
}

// ---------------------------------------------------------------- başlat
;(async () => {
  const lp = await loadPacks()
  const made = fakes()
  store.loadProject(buildProject())
  playback.seek(2)
  createRoot(document.getElementById('root')).render(<App />)
  await wait(400)
  try { if (document.fonts) await Promise.race([document.fonts.ready, wait(2500)]) } catch (e) { /* */ }
  const info = document.getElementById('info')
  const counts = Object.fromEntries(Object.keys(REG).map(k => [k, REG[k].list.length]))
  info.textContent = 'paketler: ' + JSON.stringify(lp, null, 1) + '\nsahte: ' + made.join(', ') + '\nkayıt: ' + JSON.stringify(counts, null, 1)
  log('paketler', JSON.stringify(lp), 'sahte', made.join(','))
  window.__ready = true
  const hash = location.hash.slice(1)
  if (hash === 'verify') {
    const r = await window.__verify()
    window.__result = r
    info.textContent += '\n\nDOĞRULAMA\n' + JSON.stringify(r, null, 1)
  } else if (hash) {
    const i = window.__scenarios.indexOf(hash)
    if (i >= 0) await window.__run(i)
  }
  window.__done = true
})()
