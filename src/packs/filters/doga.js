// Doğa: altın saat, orman, okyanus, kar, çöl, gün batımı, sonbahar…
import { F } from './lib.js'

export default {
  id: 'doga', name: 'Doğa',
  items: [
    F('altin-saat', 'Altın Saat', {
      adjust: { temperature: 54, tint: 7, exposure: 4, highlights: -12, shadows: 10, vibrance: 15, contrast: 6 },
      tone: { shadows: '#3a2a4a', highlights: '#ffc061', amount: 0.3 }, tags: ['golden hour', 'altın', 'akşam'],
    }),
    F('orman', 'Orman', {
      adjust: { tint: -18, temperature: -7, saturation: 8, vibrance: 15, contrast: 12, shadows: 8 },
      tone: { shadows: '#0f2a1a', highlights: '#e8ffd0', amount: 0.25 }, tags: ['forest', 'yeşil', 'doğa'],
    }),
    F('okyanus', 'Okyanus', {
      adjust: { temperature: -36, tint: -7, saturation: 12, contrast: 10, highlights: -10 },
      tone: { shadows: '#002a40', highlights: '#c8f4ff', amount: 0.3 }, tags: ['ocean', 'deniz', 'mavi'],
    }),
    F('karli-gun', 'Karlı Gün', {
      adjust: { temperature: -22, exposure: 10, brightness: 4, saturation: -15, contrast: 6, highlights: -10 },
      tone: { shadows: '#2a3a5a', highlights: '#f0f8ff', amount: 0.2 }, tags: ['snow', 'kış', 'beyaz'],
    }),
    F('col', 'Çöl', {
      adjust: { temperature: 50, tint: 7, saturation: -8, contrast: 14, fade: 6, highlights: -10 },
      tone: { shadows: '#5a3a1f', highlights: '#ffdca0', amount: 0.3 }, tags: ['desert', 'kum', 'sıcak'],
    }),
    F('gun-batimi', 'Gün Batımı', {
      adjust: { temperature: 45, tint: 22, saturation: 15, contrast: 10, highlights: -15 },
      tone: { shadows: '#3a1a4a', highlights: '#ff9a5a', amount: 0.35 }, tags: ['sunset', 'akşam', 'turuncu'],
    }),
    F('ilkbahar', 'İlkbahar', {
      adjust: { brightness: 10, vibrance: 30, tint: -20, temperature: 4, contrast: -4, fade: 10 },
      tone: { shadows: '#4a6a4a', highlights: '#fffbe0', amount: 0.25 }, tags: ['spring', 'bahar', 'çiçek'],
    }),
    F('sonbahar', 'Sonbahar', {
      adjust: { temperature: 36, tint: 11, saturation: 10, contrast: 12 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  vec3 h = rgb2hsv(c);
  float g = smoothstep(0.1, 0.18, h.x) * (1.0 - smoothstep(0.38, 0.48, h.x));
  h.x = mix(h.x, 0.075, g * 0.6);
  return hsv2rgb(h);
}`, swatch: ['#6a2a10', '#ffb347'], tags: ['autumn', 'güz', 'turuncu'],
    }),
    F('yagmurlu-gun', 'Yağmurlu Gün', {
      adjust: { saturation: -30, temperature: -12, tint: -10, contrast: -6, fade: 18, exposure: -4 },
      tone: { shadows: '#2a3530', highlights: '#d4ddd8', amount: 0.25 }, tags: ['rainy', 'yağmur', 'gri'],
    }),
    F('dag-havasi', 'Dağ Havası', {
      adjust: { contrast: 14, vibrance: 20, temperature: -14, highlights: -20, shadows: 10, sharpen: 15 },
      tone: { shadows: '#2a3a4a', highlights: '#e6f4ff', amount: 0.15 }, tags: ['mountain', 'dağ', 'net'],
    }),
    F('yildizli-gece', 'Yıldızlı Gece', {
      adjust: { exposure: -15, temperature: -45, saturation: -10, contrast: 12, tint: 11 },
      tone: { shadows: '#0a0f2a', highlights: '#b8c8ff', amount: 0.35 }, tags: ['night sky', 'gece', 'mavi'],
    }),
    F('sisli-sabah', 'Sisli Sabah', {
      adjust: { fade: 32, contrast: -18, saturation: -30, temperature: -18, brightness: 8 },
      tone: { shadows: '#505a62', highlights: '#eef4f8', amount: 0.3 }, tags: ['misty', 'sis', 'sabah'],
    }),
  ],
}
