// Filtre paketi yardımcısı: renk ayarı (-100..100) + ayrık tonlama + eğri + isteğe bağlı GLSL
// tone: { shadows, highlights, amount 0..1, balance } — gölge rengi ~%25-30 parlaklıkta seçilirse ton parlaklığı korunur

export function F(id, name, o = {}) {
  const f = { id, name, adjust: o.adjust || {} }
  if (o.tone) f.tone = { balance: 0, ...o.tone }
  if (o.curve) f.curve = o.curve
  if (o.mono) f.mono = true
  if (o.glsl) f.glsl = o.glsl
  f.swatch = o.swatch || (o.tone ? [o.tone.shadows, o.tone.highlights] : ['#444444', '#cccccc'])
  if (o.tags) f.tags = o.tags
  return f
}
