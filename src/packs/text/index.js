// Yazı paketi: animasyonlar, şablonlar, altyazı stilleri + uygulama yardımcıları
import { register, get } from '../../engine/registry.js'
import { defaultTextStyle } from '../../core/model.js'
import { TEXT_ANIMS, TEXT_ANIM_CATEGORIES } from './anims.js'
import { TEMPLATES, TEMPLATE_CATEGORIES, FILL_PRESETS } from './templates.js'
import { CAPTION_STYLES, CAPTION_CATEGORIES } from './captions.js'

register('textAnims', TEXT_ANIMS, TEXT_ANIM_CATEGORIES)
register('textTemplates', TEMPLATES, TEMPLATE_CATEGORIES)
register('captionStyles', CAPTION_STYLES, CAPTION_CATEGORIES)

export { FILL_PRESETS, TEXT_ANIMS, TEMPLATES, CAPTION_STYLES }

const clone = o => JSON.parse(JSON.stringify(o))

// Şablonu bir yazı klibine uygula (immer taslağı da olur). Stil varsayılana sıfırlanır, içerik korunur.
// opts: { useSample: örnek metni içerik yap, position: önerilen konumu uygula, anim: animasyonu uygula (varsayılan true) }
export function applyTextTemplate(clip, templateId, opts = {}) {
  const t = get('textTemplates', templateId)
  if (!t || !clip) return clip
  const content = opts.useSample || !clip.text || !clip.text.content ? (t.sampleText || clip.text?.content || 'Yazı') : clip.text.content
  clip.text = { ...defaultTextStyle(), ...clone(t.text), content }
  clip.templateId = t.id
  if (opts.anim !== false) clip.anim = { in: null, out: null, loop: null, ...(t.anim ? clone(t.anim) : {}) }
  if (opts.position && t.transform && clip.transform) Object.assign(clip.transform, t.transform)
  return clip
}

// Altyazı stilini uygula: yazı stilini (varsayılan + stil.text) klibe yazar, caption.styleId'yi ayarlar.
export function applyCaptionStyle(clip, styleId) {
  const s = get('captionStyles', styleId)
  if (!s || !clip) return clip
  const content = clip.text ? clip.text.content : ''
  clip.text = { ...defaultTextStyle(), ...clone(s.text), content, ...(s.uppercase != null ? { uppercase: !!s.uppercase } : {}) }
  clip.caption = { ...(clip.caption || { words: [] }), styleId: s.id }
  return clip
}

// Kelime listesini (tam metin zamanlarıyla) stilin kelime sayısına göre ifadelere böl.
// words: [{ w, s, e }] mutlak saniye → [{ start, duration, words:[{w,s,e} klibe göre] }]
export function groupCaptionWords(words, styleId, maxGap = 0.8) {
  const st = get('captionStyles', styleId)
  const per = Math.max(1, (st && st.words) || 3)
  const out = []
  let cur = []
  const flush = () => {
    if (!cur.length) return
    const start = cur[0].s, end = cur[cur.length - 1].e
    out.push({ start, duration: Math.max(0.2, end - start), words: cur.map(w => ({ w: w.w, s: +(w.s - start).toFixed(3), e: +(w.e - start).toFixed(3) })) })
    cur = []
  }
  for (const w of words) {
    if (cur.length && (cur.length >= per || w.s - cur[cur.length - 1].e > maxGap || /[.!?…]$/.test(cur[cur.length - 1].w))) flush()
    cur.push(w)
  }
  flush()
  return out
}
