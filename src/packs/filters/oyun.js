// Oyun: oyun türlerine göre görünüm (genel adlar) — battle royale, korku, bilim kurgu, fantastik…
import { F } from './lib.js'

export default {
  id: 'oyun', name: 'Oyun',
  items: [
    F('battle-royale', 'Battle Royale Parlak', {
      adjust: { vibrance: 40, saturation: 18, brightness: 6, contrast: 10, shadows: 15, temperature: 7, sharpen: 15 },
      tone: { shadows: '#2a4a6a', highlights: '#fff0b0', amount: 0.12 }, tags: ['battle royale', 'parlak', 'canlı'],
    }),
    F('korku-karanligi', 'Korku Karanlığı', {
      adjust: { exposure: -18, saturation: -40, contrast: 20, temperature: -14, tint: -11, vignette: 50, grain: 10, blacks: -6 },
      tone: { shadows: '#0a140f', highlights: '#c8d0c0', amount: 0.3 }, tags: ['horror', 'korku', 'karanlık'],
    }),
    F('bilim-kurgu', 'Bilim Kurgu', {
      adjust: { temperature: -54, saturation: -10, contrast: 18, highlights: -10, tint: -7, sharpen: 10 },
      tone: { shadows: '#001020', highlights: '#a0f0ff', amount: 0.35 }, tags: ['sci-fi', 'uzay', 'soğuk'],
    }),
    F('fantastik', 'Fantastik Diyar', {
      adjust: { temperature: 32, tint: 14, vibrance: 25, contrast: 8, highlights: -12, shadows: 8, vignette: 15 },
      tone: { shadows: '#2a1a40', highlights: '#ffd68a', amount: 0.3 }, tags: ['fantasy', 'rpg', 'büyü'],
    }),
    F('retro-atari', 'Retro Atari', {
      adjust: { saturation: 35, contrast: 25 },
      glsl: 'vec3 grade(vec3 c, vec2 uv){ return floor(c * 5.0 + 0.5) / 5.0; }',
      swatch: ['#2b1b8f', '#ff5e3a'], tags: ['arcade', 'retro', '8bit'],
    }),
    F('gece-operasyonu', 'Gece Operasyonu', {
      adjust: { exposure: 10, contrast: 15, vignette: 35, grain: 20 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = luma(c);
  return vec3(l * 0.35, min(l * 1.1 + 0.03, 1.0), l * 0.45);
}`, swatch: ['#021a06', '#9dff9a'], tags: ['night ops', 'gece görüşü', 'askeri'],
    }),
    F('cehennem-atesi', 'Cehennem Ateşi', {
      adjust: { temperature: 63, tint: 18, saturation: 15, contrast: 22, highlights: -10, vignette: 25 },
      tone: { shadows: '#2a0500', highlights: '#ffb040', amount: 0.4 }, tags: ['hell', 'ateş', 'kırmızı'],
    }),
    F('buz-diyari', 'Buz Diyarı', {
      adjust: { temperature: -60, saturation: -5, brightness: 12, contrast: 6, highlights: 10 },
      tone: { shadows: '#0a2a50', highlights: '#d8ffff', amount: 0.45 }, tags: ['ice', 'buz', 'kış'],
    }),
    F('zehirli-bolge', 'Zehirli Bölge', {
      adjust: { tint: -45, temperature: 9, saturation: -10, contrast: 15 },
      tone: { shadows: '#102000', highlights: '#d8ff60', amount: 0.35 }, tags: ['toxic', 'zehir', 'radyasyon'],
    }),
    F('arena', 'Arena', {
      adjust: { contrast: 26, vibrance: 30, saturation: -5, sharpen: 40, highlights: -20, shadows: 12, whites: 6, temperature: -14 },
      swatch: ['#0a2a4a', '#f5f5f5'], tags: ['esports', 'rekabet', 'net'],
    }),
    F('kiyamet-sonrasi', 'Kıyamet Sonrası', {
      adjust: { saturation: -35, temperature: 27, tint: 7, contrast: 20, fade: 10, grain: 15 },
      tone: { shadows: '#2a2018', highlights: '#e8d0a8', amount: 0.35 }, tags: ['post apocalyptic', 'çorak', 'toz'],
    }),
    F('sanal-dalga', 'Sanal Dalga', {
      adjust: { tint: 36, temperature: -18, saturation: 15, fade: 10 },
      tone: { shadows: '#2a1a6a', highlights: '#ffa0e0', amount: 0.35 }, tags: ['vaporwave', 'pembe', 'mor'],
    }),
  ],
}
