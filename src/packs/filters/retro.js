// Retro: 70'ler, 80'ler, 90'lar, soluk film, çapraz işlem, polaroid, sepya…
import { F } from './lib.js'

export default {
  id: 'retro', name: 'Retro',
  items: [
    F('70ler', "70'ler", {
      adjust: { temperature: 45, tint: 11, saturation: -10, fade: 20, contrast: -6, grain: 10 },
      tone: { shadows: '#4a2f1a', highlights: '#ffcf7a', amount: 0.35 },
      curve: { b: [[0, 0.1], [1, 0.85]] }, tags: ['70s', 'vintage', 'turuncu'],
    }),
    F('80ler', "80'ler", {
      adjust: { saturation: 18, contrast: 10, tint: 22, temperature: -9, fade: 8, grain: 6 },
      tone: { shadows: '#2d1b5a', highlights: '#ff9de0', amount: 0.3 }, tags: ['80s', 'retro', 'pembe'],
    }),
    F('90lar', "90'lar", {
      adjust: { saturation: 14, contrast: 10, temperature: 9, tint: 8, fade: 14, sharpen: 12, grain: 10 },
      tone: { shadows: '#1f3a4a', highlights: '#ffe4c8', amount: 0.3 },
      curve: { r: [[0, 0.04], [1, 0.97]], b: [[0, 0.09], [1, 0.9]] }, tags: ['90s', 'kamera', 'nostalji'],
    }),
    F('soluk-film', 'Soluk Film', {
      adjust: { fade: 35, saturation: -25, contrast: -10, temperature: 11, grain: 12 },
      curve: { rgb: [[0, 0.1], [0.5, 0.52], [1, 0.9]] }, swatch: ['#5a5650', '#e6dccb'], tags: ['faded', 'soluk', 'film'],
    }),
    F('capraz-islem', 'Çapraz İşlem', {
      adjust: { saturation: 15, contrast: 6 },
      curve: { r: [[0, 0], [0.25, 0.18], [0.75, 0.85], [1, 1]], g: [[0, 0], [0.25, 0.22], [0.75, 0.82], [1, 1]], b: [[0, 0.18], [0.5, 0.5], [1, 0.78]] },
      swatch: ['#1f3a5c', '#f5f07a'], tags: ['cross process', 'film', 'sarı'],
    }),
    F('polaroid', 'Polaroid', {
      adjust: { fade: 20, temperature: 18, tint: 7, saturation: -12, highlights: -8, vignette: 18 },
      tone: { shadows: '#2f4a52', highlights: '#fff0d0', amount: 0.3 }, tags: ['polaroid', 'anı', 'instant'],
    }),
    F('sepya', 'Sepya', {
      adjust: { contrast: 6, fade: 8 }, mono: true,
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = c.r;
  return l < 0.5 ? mix(vec3(0.1, 0.06, 0.03), vec3(0.6, 0.43, 0.27), l * 2.0) : mix(vec3(0.6, 0.43, 0.27), vec3(0.98, 0.93, 0.82), l * 2.0 - 1.0);
}`, swatch: ['#3b2412', '#f2d6a2'], tags: ['sepia', 'eski', 'kahverengi'],
    }),
    F('vhs-kapak', 'VHS Kapak', {
      adjust: { saturation: 20, contrast: -8, fade: 18, tint: 18, temperature: 10, sharpen: -50, grain: 15 },
      swatch: ['#3a2a4a', '#ffd0c0'], tags: ['vhs', 'kaset', 'bulanık'],
    }),
    F('disko-77', 'Disko 77', {
      adjust: { temperature: 27, tint: 27, saturation: 10, fade: 15, contrast: 8 },
      tone: { shadows: '#4a1a3a', highlights: '#ffc070', amount: 0.35 }, tags: ['disco', '70s', 'parti'],
    }),
    F('eski-dergi', 'Eski Dergi', {
      adjust: { saturation: -20, fade: 18, contrast: 12, temperature: 14, grain: 18 },
      curve: { b: [[0, 0.05], [1, 0.86]] }, swatch: ['#3a342a', '#efe2c0'], tags: ['magazine', 'baskı', 'eski'],
    }),
    F('lomo', 'Lomo', {
      adjust: { contrast: 30, saturation: 25, vignette: 45 },
      tone: { shadows: '#1a2a4a', highlights: '#fff2c8', amount: 0.2 },
      curve: { r: [[0, 0], [0.25, 0.2], [0.75, 0.82], [1, 1]], b: [[0, 0.12], [1, 0.88]] }, tags: ['lomo', 'toy camera', 'vinyet'],
    }),
    F('slayt-filmi', 'Slayt Filmi', {
      adjust: { saturation: 20, contrast: 18, blacks: -5, temperature: 9 },
      tone: { shadows: '#0f2440', highlights: '#fff4e0', amount: 0.15 },
      curve: { r: [[0, 0], [0.5, 0.52], [1, 1]], b: [[0, 0.02], [0.5, 0.47], [1, 0.95]] }, tags: ['slide film', 'diya', 'canlı'],
    }),
  ],
}
