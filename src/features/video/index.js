// Yapay zekâ video araçları — dışa aktarımlar + kütüphanenin "Araçlar" sekmesi için genel araç tanımları.
// TOOLS[i].run(ctx): ctx = { store, selection, time, onProgress, signal, options }
//   selection: seçili klip id dizisi ya da store.selection nesnesi; options: aracın options[] alanlarından gelen değerler.

import { store as coreStore, findClip } from '../../core/store.js'
import { RATIOS } from '../../core/model.js'
import { removeBackground, setClipBgRemove, BG_QUALITY } from './bgremove.js'
import { stabilize, setClipStabilize, STAB_LEVELS } from './stabilize.js'
import { autoReframe, REFRAME_MODES } from './reframe.js'
import { detectScenes, splitClipAtScenes } from './scenes.js'
import { autoZoomPunch, autoZoomFromHighlights } from './autozoom.js'
import { isAbort, sourceToTimeline, sourceToLocal } from './util.js'

export {
  removeBackground, setClipBgRemove, BG_QUALITY,
  stabilize, setClipStabilize, STAB_LEVELS,
  autoReframe, REFRAME_MODES,
  detectScenes, splitClipAtScenes,
  autoZoomPunch, autoZoomFromHighlights,
  isAbort, sourceToTimeline, sourceToLocal,
}

function selectedIds(ctx) {
  const s = ctx.selection
  if (Array.isArray(s)) return s
  if (s && Array.isArray(s.clips)) return s.clips
  return (ctx.store || coreStore).get().selection.clips || []
}

// Seçili video klipleri; seçim yoksa oynatma kafasının altındaki ana iz klibi
function videoClips(ctx) {
  const st = (ctx.store || coreStore).get()
  const out = []
  for (const id of selectedIds(ctx)) {
    const f = findClip(st.project, id)
    if (f && f.clip.type === 'video') out.push(f.clip)
  }
  if (!out.length && ctx.time != null) {
    const main = st.project.tracks.find(t => t.main)
    const c = main && main.clips.find(x => x.type === 'video' && ctx.time >= x.start && ctx.time < x.start + x.duration)
    if (c) out.push(c)
  }
  if (!out.length) throw new Error('Önce bir video klibi seçin')
  return out
}

// Birden çok klipte ilerlemeyi tek 0..1'e topla
function multi(ctx, n) {
  return i => p => ctx.onProgress && ctx.onProgress((i + Math.max(0, Math.min(1, p))) / n)
}

const opt = (ctx, k, d) => (ctx.options && ctx.options[k] != null ? ctx.options[k] : d)

export const TOOLS = [
  {
    id: 'bg-remove',
    name: 'Arka planı kaldır',
    description: 'Kişiyi arka plandan ayırır — yeşil perde gerekmez. Çevrimdışı yapay zekâ; sonuç önizlemede ve dışa aktarımda kullanılır.',
    icon: 'person',
    needs: 'video-clip',
    options: [
      { key: 'quality', label: 'Kalite', type: 'select', default: 'hizli', options: [{ value: 'hizli', label: 'Hızlı (720p)' }, { value: 'kaliteli', label: 'Kaliteli (1080p, keskin kenar)' }] },
    ],
    async run(ctx) {
      const clips = videoClips(ctx)
      const st = ctx.store || coreStore
      const step = multi(ctx, clips.length)
      const quality = opt(ctx, 'quality', 'hizli')
      for (let i = 0; i < clips.length; i++) {
        await removeBackground(clips[i].mediaId, { quality, onProgress: step(i), signal: ctx.signal })
      }
      const ids = new Set(clips.map(c => c.id))
      st.edit('Arka planı kaldır', d => { for (const t of d.tracks) for (const c of t.clips) if (ids.has(c.id)) c.bgRemove = true })
      return { message: clips.length > 1 ? `${clips.length} klibin arka planı kaldırıldı` : 'Arka plan kaldırıldı' }
    },
  },
  {
    id: 'stabilize',
    name: 'Görüntü sabitleme',
    description: 'Titreyen el kamerası ve aksiyon çekimlerini sabitler. Kenar boşluğu kalmasın diye görüntü hafifçe yakınlaşır.',
    icon: 'stabilize',
    needs: 'video-clip',
    options: [
      { key: 'level', label: 'Güç', type: 'select', default: 2, options: [1, 2, 3].map(v => ({ value: v, label: STAB_LEVELS[v].label })) },
    ],
    async run(ctx) {
      const clips = videoClips(ctx)
      const st = ctx.store || coreStore
      const level = Math.max(1, Math.min(3, +opt(ctx, 'level', 2)))
      const step = multi(ctx, clips.length)
      for (let i = 0; i < clips.length; i++) await stabilize(clips[i].mediaId, level, { onProgress: step(i), signal: ctx.signal })
      const ids = new Set(clips.map(c => c.id))
      st.edit('Görüntü sabitleme', d => { for (const t of d.tracks) for (const c of t.clips) if (ids.has(c.id)) c.stabilize = level })
      return { message: `Sabitlendi (${STAB_LEVELS[level].label})` }
    },
  },
  {
    id: 'auto-reframe',
    name: 'Otomatik kadraj',
    description: 'Yatay videoyu dikeye (ya da tersi) çevirirken konuyu kadrajda tutar: yüzü ya da aksiyonu izleyen yumuşak kamera hareketi.',
    icon: 'ratio',
    needs: 'video-clip',
    options: [
      { key: 'targetRatio', label: 'Hedef oran', type: 'select', default: '', options: [{ value: '', label: 'Proje oranı' }, ...RATIOS.map(r => ({ value: r.id, label: `${r.label} · ${r.hint}` }))] },
      { key: 'mode', label: 'İzle', type: 'select', default: 'yuz', options: Object.entries(REFRAME_MODES).map(([value, m]) => ({ value, label: m.label })) },
      { key: 'smoothing', label: 'Yumuşaklık', type: 'range', default: 0.6, min: 0, max: 1, step: 0.05 },
    ],
    async run(ctx) {
      const clips = videoClips(ctx)
      const step = multi(ctx, clips.length)
      let last = null
      for (let i = 0; i < clips.length; i++) {
        last = await autoReframe(clips[i].id, {
          targetRatio: opt(ctx, 'targetRatio', '') || null, mode: opt(ctx, 'mode', 'yuz'), smoothing: +opt(ctx, 'smoothing', 0.6),
          onProgress: step(i), signal: ctx.signal,
        })
      }
      const how = last && last.mode === 'yuz' ? 'yüz izlendi' : last && last.mode === 'merkez' ? 'ortadan kırpıldı' : 'hareket izlendi'
      return { message: `Kadraj ayarlandı · ${how}`, result: last }
    },
  },
  {
    id: 'scene-split',
    name: 'Sahnelere böl',
    description: 'Videodaki sahne değişimlerini bulur ve klibi her kesmeden otomatik böler.',
    icon: 'scene',
    needs: 'video-clip',
    options: [
      { key: 'threshold', label: 'Hassasiyet', type: 'select', default: 0.3, options: [{ value: 0.45, label: 'Düşük (yalnız sert kesmeler)' }, { value: 0.3, label: 'Orta' }, { value: 0.18, label: 'Yüksek (yumuşak geçişler de)' }] },
    ],
    async run(ctx) {
      const clips = videoClips(ctx)
      const step = multi(ctx, clips.length)
      let total = 0
      for (let i = 0; i < clips.length; i++) {
        const created = await splitClipAtScenes(clips[i].id, { threshold: +opt(ctx, 'threshold', 0.3), onProgress: step(i), signal: ctx.signal })
        total += created.length
      }
      return { message: total ? `${total} kesme yapıldı` : 'Sahne değişimi bulunamadı' }
    },
  },
  {
    id: 'highlight-zoom',
    name: 'Vurgularda zoom',
    description: 'Sesteki en heyecanlı anları (bağırış, patlama, vuruş) bulur ve oralara hızlı yakınlaşma ekler.',
    icon: 'zoomIn',
    needs: 'video-clip',
    options: [
      { key: 'count', label: 'Vurgu sayısı', type: 'range', default: 6, min: 1, max: 20, step: 1 },
      { key: 'amount', label: 'Yakınlaşma', type: 'range', default: 1.25, min: 1.05, max: 1.8, step: 0.05 },
    ],
    async run(ctx) {
      const clips = videoClips(ctx)
      let n = 0
      for (const c of clips) {
        n += await autoZoomFromHighlights(c.id, { count: +opt(ctx, 'count', 6), amount: +opt(ctx, 'amount', 1.25), onProgress: ctx.onProgress, signal: ctx.signal })
      }
      return { message: n ? `${n} vurguya zoom eklendi` : 'Vurgu bulunamadı' }
    },
  },
  {
    id: 'zoom-punch',
    name: 'Anlık zoom vuruşu',
    description: 'Oynatma kafasının olduğu anda kısa, sert bir yakınlaş-uzaklaş efekti ekler.',
    icon: 'bolt',
    needs: 'video-clip',
    options: [
      { key: 'amount', label: 'Yakınlaşma', type: 'range', default: 1.25, min: 1.05, max: 1.8, step: 0.05 },
      { key: 'duration', label: 'Süre (sn)', type: 'range', default: 0.35, min: 0.15, max: 1.2, step: 0.05 },
    ],
    async run(ctx) {
      if (ctx.time == null) throw new Error('Oynatma kafası konumu yok')
      const clips = videoClips(ctx).filter(c => ctx.time >= c.start && ctx.time < c.start + c.duration)
      if (!clips.length) throw new Error('Oynatma kafası seçili klibin üstünde değil')
      let n = 0
      for (const c of clips) n += autoZoomPunch(c.id, [ctx.time], { amount: +opt(ctx, 'amount', 1.25), duration: +opt(ctx, 'duration', 0.35) })
      if (ctx.onProgress) ctx.onProgress(1)
      return { message: n ? 'Zoom vuruşu eklendi' : 'Bu anda zoom eklenemedi' }
    },
  },
]

export function getTool(id) { return TOOLS.find(t => t.id === id) || null }

// Genel çalıştırıcı: hata/iptal mesajını Türkçe toast'a çevirir
export async function runTool(id, ctx = {}) {
  const tool = getTool(id)
  if (!tool) throw new Error('Araç bulunamadı: ' + id)
  const st = ctx.store || coreStore
  try {
    const r = await tool.run({ store: st, selection: st.get().selection, ...ctx })
    if (r && r.message) st.toast(r.message, 'info')
    return r
  } catch (e) {
    if (isAbort(e)) { st.toast('İşlem iptal edildi'); return null }
    st.toast(String(e.message || e).slice(0, 160), 'error', 5000)
    throw e
  }
}
