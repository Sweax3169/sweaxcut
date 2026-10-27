// Tek tık düzenler — facecam + oyun, bölünmüş ekran, bulanık arka plan, sinema bantları, üç panel…
// apply(d, ctx): d = immer proje taslağı, ctx = { selectedClipIds | selection, time, ui, width, height }
//   1. seçili video/görsel klip = OYUN, 2. = KAMERA. Seçim yoksa oynatma kafasındaki klipler kullanılır.
//   Kamera gerekip yoksa oyun klibi kopyalanır ve kaynağın sol-alt köşesi (tipik facecam yeri) kırpılır.
// regions: şematik önizleme için tuval oranı (0..1) dikdörtgenleri; previewRatio: önizleme en-boy oranı.
import { register } from '../../engine/registry.js'
import { RATIOS, uid, defaultMask, defaultTransform } from '../../core/model.js'
import { getClip, trackOf, mainTrack, clipsAt, newTrack, compactMain } from '../../core/timeline.js'

// varsayılan facecam kaynak bölgesi (kaynak videonun oranı)
export const DEFAULT_CAM_SRC = { x: 0.015, y: 0.6, w: 0.27, h: 0.38 }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function setRatio(d, id) {
  const r = RATIOS.find(x => x.id === id)
  if (!r) return
  d.settings.ratio = r.id; d.settings.width = r.w; d.settings.height = r.h
}
function mediaSize(d, clip) {
  const m = d.media && d.media[clip.mediaId]
  let w = (m && m.width) || 1920, h = (m && m.height) || 1080
  if (m && (m.rotation === 90 || m.rotation === 270 || m.rotation === -90)) [w, h] = [h, w]
  return { w, h }
}
function clearKeys(clip) {
  if (!clip.keyframes) return
  for (const k of Object.keys(clip.keyframes)) if (/^(transform|mask|crop)\./.test(k)) delete clip.keyframes[k]
}
// klibi tuvaldeki rect'i (0..1) tam dolduracak şekilde kırp + konumla. src: kaynakta görünmesi istenen bölge (0..1)
function placeCover(d, clip, rect, o = {}) {
  const W = d.settings.width, H = d.settings.height
  const { w: mw, h: mh } = mediaSize(d, clip)
  const src = o.src || { x: 0, y: 0, w: 1, h: 1 }
  const targetAR = (rect.w * W) / Math.max(1, rect.h * H)
  let sx = src.x, sy = src.y, sw = src.w, sh = src.h
  const srcAR = (sw * mw) / Math.max(1, sh * mh)
  const fx = o.focusX ?? 0.5, fy = o.focusY ?? 0.5
  if (srcAR > targetAR) { const nw = sw * (targetAR / srcAR); sx = sx + (sw - nw) * fx; sw = nw }
  else { const nh = sh * (srcAR / targetAR); sy = sy + (sh - nh) * fy; sh = nh }
  sx = clamp(sx, 0, 1 - sw); sy = clamp(sy, 0, 1 - sh)
  clip.crop = { l: sx, t: sy, r: Math.max(0, 1 - sx - sw), b: Math.max(0, 1 - sy - sh) }
  clip.fit = 'contain'
  const ar = targetAR, canvasAR = W / H
  const baseW = ar > canvasAR ? W : H * ar
  clearKeys(clip)
  clip.transform = { ...defaultTransform(), ...(clip.transform || {}), x: rect.x + rect.w / 2 - 0.5, y: rect.y + rect.h / 2 - 0.5, scale: (rect.w * W) / baseW, scaleX: 1, scaleY: 1, rotation: 0 }
  clip.mask = o.mask ? { ...defaultMask(), ...o.mask } : defaultMask()
}
// kırpmadan sığdır (contain) ve ortala
function placeContain(d, clip, o = {}) {
  clearKeys(clip)
  clip.crop = { l: 0, t: 0, r: 0, b: 0 }
  clip.fit = 'contain'
  clip.transform = { ...defaultTransform(), ...(clip.transform || {}), x: 0, y: o.y || 0, scale: o.scale || 1, scaleX: 1, scaleY: 1, rotation: 0 }
  clip.mask = defaultMask()
}

const isVis = (c) => c && (c.type === 'video' || c.type === 'image')
// seçimden oyun/kamera kliplerini bul
function pick(d, ctx) {
  const ids = (ctx && (ctx.selectedClipIds || ctx.selection)) || []
  let clips = ids.map(id => getClip(d, id)).filter(isVis)
  if (!clips.length && ctx && ctx.time != null) {
    const at = clipsAt(d, ctx.time).filter(x => isVis(x.clip))
    const m = mainTrack(d)
    at.sort((a, b) => (b.track === m) - (a.track === m) || d.tracks.indexOf(b.track) - d.tracks.indexOf(a.track))
    clips = at.map(x => x.clip)
  }
  if (!clips.length) { const m = mainTrack(d); if (m && m.clips[0] && isVis(m.clips[0])) clips = [m.clips[0]] }
  return clips
}
// kopya klip (yeni iz, aynı zaman, sessiz)
function duplicateAbove(d, clip, above) {
  const c = JSON.parse(JSON.stringify(clip))
  c.id = uid('c'); c.transition = null
  if (c.audio) c.audio = { ...c.audio, muted: true }
  const gt = trackOf(d, above.id)
  const t = newTrack(d, 'video', { above: Math.max(0, d.tracks.indexOf(gt)) })
  t.clips.push(c)
  return c
}
// kamera klibini oyunun ÜSTÜNDEKİ bir ize al (ana izdeyse çıkar, oyunla aynı zamana hizala)
function ensureAbove(d, cam, game, align = true) {
  const ct = trackOf(d, cam.id), gt = trackOf(d, game.id)
  if (!ct || !gt) return
  const ci = d.tracks.indexOf(ct), gi = d.tracks.indexOf(gt)
  const overlapping = cam.start < game.start + game.duration && cam.start + cam.duration > game.start
  if (ci < gi && !ct.main && (overlapping || !align)) return
  ct.clips = ct.clips.filter(c => c.id !== cam.id)
  if (align) cam.start = game.start
  const t = newTrack(d, 'video', { above: Math.max(0, d.tracks.indexOf(gt)) })
  t.clips.push(cam)
  if (ct.main) compactMain(d)
}
function getCam(d, clips, game) {
  if (clips[1]) { ensureAbove(d, clips[1], game); return { cam: clips[1], src: null } }
  return { cam: duplicateAbove(d, game, game), src: DEFAULT_CAM_SRC }
}
const px = (d) => ({ W: d.settings.width, H: d.settings.height })

// ------------------------------------------------------------ düzenler
const LAYOUTS = [
  {
    id: 'facecam-ust-oyun-alt', name: 'Facecam üstte + oyun altta (9:16)', category: 'dikey', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 0.35, kind: 'cam' }, { x: 0, y: 0.35, w: 1, h: 0.65, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0, y: 0.35, w: 1, h: 0.65 })
      const { cam, src } = getCam(d, clips, game)
      placeCover(d, cam, { x: 0, y: 0, w: 1, h: 0.35 }, { src })
    },
  },
  {
    id: 'oyun-ust-facecam-alt', name: 'Oyun üstte + facecam altta (9:16)', category: 'dikey', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 0.62, kind: 'game' }, { x: 0, y: 0.62, w: 1, h: 0.38, kind: 'cam' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0, y: 0, w: 1, h: 0.62 })
      const { cam, src } = getCam(d, clips, game)
      placeCover(d, cam, { x: 0, y: 0.62, w: 1, h: 0.38 }, { src })
    },
  },
  {
    id: 'dikey-kose-kamera', name: 'Dikey oyun + köşe kamera (9:16)', category: 'dikey', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }, { x: 0.04, y: 0.035, w: 0.44, h: 0.186, kind: 'cam' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0, y: 0, w: 1, h: 1 })
      const { cam, src } = getCam(d, clips, game)
      const { W, H } = px(d), w = 0.44, h = (w * W * 0.75) / H
      placeCover(d, cam, { x: 0.04, y: 0.035, w, h }, { src, mask: { type: 'rect', w: 1, h: 1, round: 22 } })
    },
  },
  {
    id: 'dikey-ortadan-kirp', name: 'Dikey tam ekran (ortadan kırp)', category: 'dikey', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); if (!clips[0]) return
      placeCover(d, clips[0], { x: 0, y: 0, w: 1, h: 1 })
    },
  },
  {
    id: 'bulanik-arka-dikey', name: 'Bulanık arka plan (dikey)', category: 'dikey', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'bg' }, { x: 0, y: 0.342, w: 1, h: 0.316, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeContain(d, game, { scale: 1 })
      game.canvasBg = null
      d.settings.bg = { ...(d.settings.bg || {}), type: 'blur', blur: 30, dim: 0.22 }
    },
  },
  {
    id: 'oyun-tam-kose-facecam', name: 'Oyun tam ekran + köşe facecam', category: 'yatay', ratio: null, previewRatio: '16:9',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }, { x: 0.72, y: 0.6, w: 0.26, h: 0.347, kind: 'cam' }],
    apply(d, ctx) {
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0, y: 0, w: 1, h: 1 })
      const { cam, src } = getCam(d, clips, game)
      const { W, H } = px(d), portrait = H > W
      const w = portrait ? 0.4 : 0.26, h = (w * W * 0.75) / H
      const mx = 0.02 * Math.min(W, H) / W, my = 0.02 * Math.min(W, H) / H
      placeCover(d, cam, { x: 1 - w - mx, y: 1 - h - my * (portrait ? 6 : 1), w, h }, { src, mask: { type: 'rect', w: 1, h: 1, round: 14 } })
    },
  },
  {
    id: 'oyun-tam-yuvarlak-facecam', name: 'Oyun tam ekran + yuvarlak kamera', category: 'yatay', ratio: null, previewRatio: '16:9',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }, { x: 0.77, y: 0.6, w: 0.21, h: 0.373, kind: 'cam', shape: 'circle' }],
    apply(d, ctx) {
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0, y: 0, w: 1, h: 1 })
      const { cam, src } = getCam(d, clips, game)
      const { W, H } = px(d), s = 0.34 * Math.min(W, H)
      const w = s / W, h = s / H, m = 0.03 * Math.min(W, H)
      placeCover(d, cam, { x: 1 - w - m / W, y: 1 - h - m / H * (H > W ? 5 : 1), w, h }, { src, mask: { type: 'circle', w: 1, h: 1, feather: 2 } })
    },
  },
  {
    id: 'bolunmus-50-50', name: 'Bölünmüş ekran 50/50', category: 'bolunmus', ratio: null, previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 0.5, kind: 'game' }, { x: 0, y: 0.5, w: 1, h: 0.5, kind: 'cam' }],
    apply(d, ctx) {
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      const { W, H } = px(d), portrait = H >= W
      const a = portrait ? { x: 0, y: 0, w: 1, h: 0.5 } : { x: 0, y: 0, w: 0.5, h: 1 }
      const b = portrait ? { x: 0, y: 0.5, w: 1, h: 0.5 } : { x: 0.5, y: 0, w: 0.5, h: 1 }
      placeCover(d, game, a)
      const { cam, src } = getCam(d, clips, game)
      placeCover(d, cam, b, { src })
    },
  },
  {
    id: 'facecam-sol-oyun-sag', name: 'Facecam solda + oyun sağda (16:9)', category: 'yatay', ratio: '16:9', previewRatio: '16:9',
    regions: [{ x: 0, y: 0, w: 0.3, h: 1, kind: 'cam' }, { x: 0.3, y: 0, w: 0.7, h: 1, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '16:9')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeCover(d, game, { x: 0.3, y: 0, w: 0.7, h: 1 })
      const { cam, src } = getCam(d, clips, game)
      placeCover(d, cam, { x: 0, y: 0, w: 0.3, h: 1 }, { src })
    },
  },
  {
    id: 'uc-panel', name: 'Üç panel (dikey)', category: 'bolunmus', ratio: '9:16', previewRatio: '9:16',
    regions: [{ x: 0, y: 0, w: 1, h: 1 / 3, kind: 'cam' }, { x: 0, y: 1 / 3, w: 1, h: 1 / 3, kind: 'game' }, { x: 0, y: 2 / 3, w: 1, h: 1 / 3, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '9:16')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      const R = [0, 1, 2].map(i => ({ x: 0, y: i / 3, w: 1, h: 1 / 3 }))
      if (clips.length >= 3) {
        placeCover(d, clips[0], R[1])
        ensureAbove(d, clips[1], clips[0]); placeCover(d, clips[1], R[0])
        ensureAbove(d, clips[2], clips[0]); placeCover(d, clips[2], R[2])
      } else if (clips.length === 2) {
        placeCover(d, game, R[1])
        const cam = clips[1]; ensureAbove(d, cam, game); placeCover(d, cam, R[0])
        const zoom = duplicateAbove(d, game, game)
        placeCover(d, zoom, R[2], { src: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })
      } else {
        // tek klip: üstte facecam kırpması, ortada oyun, altta orta yakınlaştırma
        placeCover(d, game, R[1])
        placeCover(d, duplicateAbove(d, game, game), R[0], { src: DEFAULT_CAM_SRC })
        placeCover(d, duplicateAbove(d, game, game), R[2], { src: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })
      }
    },
  },
  {
    id: 'sinema-bantlari', name: 'Sinema bantları (2.39:1)', category: 'sinematik', ratio: null, previewRatio: '16:9',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'bg', color: '#000' }, { x: 0, y: 0.128, w: 1, h: 0.744, kind: 'game' }],
    apply(d, ctx) {
      const clips = pick(d, ctx); if (!clips.length) return
      const { W, H } = px(d)
      const bandAR = 2.39
      const h = Math.min(1, (W / bandAR) / H)
      for (const c of clips) {
        placeCover(d, c, { x: 0, y: (1 - h) / 2, w: 1, h })
        c.canvasBg = { type: 'color', color: '#000000' }
      }
    },
  },
  {
    id: 'kare-bulanik', name: 'Kare (1:1) + bulanık arka plan', category: 'sosyal', ratio: '1:1', previewRatio: '1:1',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'bg' }, { x: 0, y: 0.219, w: 1, h: 0.5625, kind: 'game' }],
    apply(d, ctx) {
      setRatio(d, '1:1')
      const clips = pick(d, ctx); const game = clips[0]; if (!game) return
      placeContain(d, game, { scale: 1 })
      game.canvasBg = null
      d.settings.bg = { ...(d.settings.bg || {}), type: 'blur', blur: 30, dim: 0.22 }
    },
  },
  {
    id: 'sifirla', name: 'Düzeni sıfırla', category: 'sosyal', ratio: null, previewRatio: '16:9',
    regions: [{ x: 0, y: 0, w: 1, h: 1, kind: 'game' }],
    apply(d, ctx) {
      for (const c of pick(d, ctx)) { placeContain(d, c); c.canvasBg = null }
    },
  },
]

export const LAYOUT_CATEGORIES = [
  { id: 'dikey', name: 'Dikey (Shorts / TikTok)' },
  { id: 'yatay', name: 'Yatay (YouTube)' },
  { id: 'bolunmus', name: 'Bölünmüş ekran' },
  { id: 'sinematik', name: 'Sinematik' },
  { id: 'sosyal', name: 'Sosyal & Diğer' },
]

register('layouts', LAYOUTS, LAYOUT_CATEGORIES)
export default LAYOUTS
