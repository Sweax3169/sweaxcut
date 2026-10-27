// Siyah-Beyaz: klasik, sert, soluk, gümüş, selenyum, siyanotip, renk filtreli…
import { F } from './lib.js'

export default {
  id: 'siyah-beyaz', name: 'Siyah-Beyaz',
  items: [
    F('klasik-sb', 'Klasik S/B', {
      adjust: { contrast: 10 }, mono: true, swatch: ['#1a1a1a', '#e0e0e0'], tags: ['black white', 'siyah beyaz', 'klasik'],
    }),
    F('sert-sb', 'Sert S/B', {
      adjust: { contrast: 40, blacks: -10, whites: 10, sharpen: 15 }, mono: true, swatch: ['#000000', '#ffffff'], tags: ['high contrast', 'sert', 'grafik'],
    }),
    F('soluk-sb', 'Soluk S/B', {
      adjust: { fade: 30, contrast: -10, grain: 10 }, mono: true, swatch: ['#4a4a4a', '#d6d6d6'], tags: ['faded', 'soluk', 'mat'],
    }),
    F('gumus-sb', 'Gümüş', {
      adjust: { contrast: 15, highlights: 10 }, mono: true,
      glsl: 'vec3 grade(vec3 c, vec2 uv){ return clamp(c * vec3(0.97, 1.0, 1.04), 0.0, 1.0); }',
      swatch: ['#22262c', '#e8eef6'], tags: ['silver', 'gümüş', 'soğuk'],
    }),
    F('selenyum', 'Selenyum', {
      adjust: { contrast: 15 }, mono: true,
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = c.r;
  return l < 0.5 ? mix(vec3(0.08, 0.04, 0.09), vec3(0.5, 0.42, 0.48), l * 2.0) : mix(vec3(0.5, 0.42, 0.48), vec3(0.97, 0.95, 0.92), l * 2.0 - 1.0);
}`, swatch: ['#2a1a2c', '#f0ece4'], tags: ['selenium', 'mor ton', 'baskı'],
    }),
    F('siyanotip', 'Siyanotip', {
      adjust: { contrast: 10 }, mono: true,
      glsl: 'vec3 grade(vec3 c, vec2 uv){ return mix(vec3(0.02, 0.12, 0.3), vec3(0.85, 0.93, 1.0), c.r); }',
      swatch: ['#06204d', '#d8ecff'], tags: ['cyanotype', 'mavi', 'baskı'],
    }),
    F('kirmizi-filtre', 'Kırmızı Filtre S/B', {
      adjust: { contrast: 15 },
      glsl: 'vec3 grade(vec3 c, vec2 uv){ return vec3(clamp(dot(c, vec3(0.7, 0.25, 0.05)), 0.0, 1.0)); }',
      swatch: ['#111111', '#f0f0f0'], tags: ['red filter', 'dramatik gökyüzü', 'manzara'],
    }),
    F('yesil-filtre', 'Yeşil Filtre S/B', {
      adjust: { contrast: 12 },
      glsl: 'vec3 grade(vec3 c, vec2 uv){ return vec3(clamp(dot(c, vec3(0.02, 0.93, 0.05)) * 1.05, 0.0, 1.0)); }',
      swatch: ['#1d1d1d', '#e4e4e4'], tags: ['green filter', 'portre', 'yaprak'],
    }),
    F('gece-sb', 'Gece S/B', {
      adjust: { exposure: -15, contrast: 25, vignette: 40, grain: 20 }, mono: true, swatch: ['#050505', '#a8a8a8'], tags: ['night', 'karanlık', 'gerilim'],
    }),
    F('sut-beyazi', 'Süt Beyazı', {
      adjust: { exposure: 15, brightness: 8, contrast: -10, highlights: 15, shadows: 20 }, mono: true, swatch: ['#8a8a8a', '#ffffff'], tags: ['high key', 'aydınlık', 'temiz'],
    }),
  ],
}
