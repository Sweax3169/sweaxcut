// Sinema: turkuaz-turuncu, gişe filmi, pastel masal, matrix, gümüş atlatma, negatif film tonları…
import { F } from './lib.js'

export default {
  id: 'sinema', name: 'Sinema',
  items: [
    F('turkuaz-turuncu', 'Turkuaz & Turuncu', {
      adjust: { contrast: 14, saturation: 6, highlights: -8 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = luma(c);
  vec3 g = mix(c, c * vec3(0.78, 1.02, 1.12) + vec3(0.0, 0.02, 0.04), (1.0 - smoothstep(0.0, 0.6, l)) * 0.8);
  return mix(g, g * vec3(1.12, 1.0, 0.82), smoothstep(0.35, 1.0, l) * 0.8);
}`,
      swatch: ['#0f5d6b', '#f29b4b'], tags: ['teal orange', 'hollywood', 'aksiyon'],
    }),
    F('gise-filmi', 'Gişe Filmi', {
      adjust: { contrast: 22, blacks: -8, whites: 6, saturation: -8, temperature: -11, vignette: 18 },
      tone: { shadows: '#14324a', highlights: '#ffd9a8', amount: 0.35 }, tags: ['blockbuster', 'aksiyon', 'film'],
    }),
    F('kara-film', 'Kara Film', {
      adjust: { contrast: 35, blacks: -10, highlights: 8, vignette: 40, grain: 10, sharpen: 10 },
      mono: true, swatch: ['#0a0a0a', '#e8e8e8'], tags: ['noir', 'siyah beyaz', 'dedektif'],
    }),
    F('pastel-masal', 'Pastel Masal', {
      adjust: { saturation: -8, contrast: -10, fade: 15, temperature: 18, tint: 11 },
      tone: { shadows: '#6f7fa8', highlights: '#ffe2b0', amount: 0.3 },
      curve: { r: [[0, 0.04], [1, 1]], b: [[0, 0.08], [1, 0.92]] }, tags: ['wes anderson', 'pastel', 'simetrik'],
    }),
    F('matrix-yesili', 'Matrix Yeşili', {
      adjust: { contrast: 18, saturation: -12 },
      tone: { shadows: '#06200f', highlights: '#c8ffd0', amount: 0.25 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = luma(c);
  vec3 g = vec3(c.r * 0.75 + c.g * 0.1, c.g * 0.95 + 0.04, c.b * 0.6 + c.g * 0.1);
  return mix(g, vec3(l * 0.7, l, l * 0.65), 0.35);
}`, tags: ['matrix', 'yeşil', 'hacker'],
    }),
    F('gumus-atlatma', 'Gümüş Atlatma', {
      adjust: { saturation: -30, contrast: 12, highlights: -6 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  vec3 b = vec3(luma(c));
  vec3 o = mix(2.0 * c * b, 1.0 - 2.0 * (1.0 - c) * (1.0 - b), step(0.5, b));
  return mix(c, o, 0.7);
}`, swatch: ['#2a2c2e', '#d8d6cf'], tags: ['bleach bypass', 'savaş', 'sert'],
    }),
    F('sicak-negatif', 'Sıcak Negatif', {
      adjust: { contrast: 8, saturation: 8, temperature: 14, fade: 5, grain: 8 },
      curve: { r: [[0, 0.02], [0.5, 0.53], [1, 1]], g: [[0, 0], [0.5, 0.5], [1, 0.97]], b: [[0, 0.06], [0.5, 0.46], [1, 0.9]] },
      swatch: ['#3a2a1e', '#ffd8a0'], tags: ['film', 'negatif', 'analog', 'sıcak'],
    }),
    F('yesil-negatif', 'Yeşil Negatif', {
      adjust: { saturation: -5, contrast: 10, temperature: -7, tint: -11, grain: 6 },
      tone: { shadows: '#173a33', highlights: '#f0f4e8', amount: 0.15 },
      curve: { r: [[0, 0], [0.5, 0.48], [1, 0.98]], g: [[0, 0.04], [0.5, 0.52], [1, 1]], b: [[0, 0.07], [0.5, 0.5], [1, 0.94]] },
      tags: ['film', 'negatif', 'analog', 'yeşil'],
    }),
    F('dram', 'Dram', {
      adjust: { contrast: 25, saturation: -30, highlights: -20, shadows: -10, vignette: 30, temperature: -14 },
      swatch: ['#1c2226', '#b8bcbf'], tags: ['drama', 'karanlık', 'ciddi'],
    }),
    F('vahsi-bati', 'Vahşi Batı', {
      adjust: { temperature: 54, tint: 11, saturation: -15, contrast: 18, fade: 6, grain: 15 },
      tone: { shadows: '#3b2412', highlights: '#ffd59e', amount: 0.35 }, tags: ['western', 'kovboy', 'çöl'],
    }),
    F('distopya', 'Distopya', {
      adjust: { saturation: -25, temperature: -18, tint: -14, contrast: 15, fade: 10 },
      tone: { shadows: '#1d2b25', highlights: '#d8e8d0', amount: 0.3 }, tags: ['dystopia', 'soğuk', 'karanlık'],
    }),
    F('gece-cekimi', 'Gece Çekimi', {
      adjust: { exposure: -30, temperature: -90, saturation: -40, contrast: 12, highlights: -25 },
      tone: { shadows: '#0a1a33', highlights: '#8fa8d0', amount: 0.5 }, tags: ['day for night', 'gece', 'mavi'],
    }),
    F('yaz-filmi', 'Yaz Filmi', {
      adjust: { temperature: 32, fade: 12, saturation: -5, vibrance: 10, contrast: -4 },
      tone: { shadows: '#2c4a5a', highlights: '#ffe6a8', amount: 0.25 }, tags: ['indie', 'yaz', 'nostalji'],
    }),
  ],
}
