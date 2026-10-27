// Portre: yumuşak ten, şeftali, sıcak ışıltı…
import { F } from './lib.js'

export default {
  id: 'portre', name: 'Portre',
  items: [
    F('yumusak-ten', 'Yumuşak Ten', {
      adjust: { brightness: 4, contrast: -8, highlights: -10, shadows: 12, temperature: 11, tint: 5, saturation: -6, vibrance: 8, fade: 8, sharpen: -15 },
      tone: { shadows: '#5a4a52', highlights: '#ffe2cf', amount: 0.15 }, tags: ['skin', 'ten', 'yumuşak'],
    }),
    F('seftali', 'Şeftali', {
      adjust: { exposure: 4, temperature: 22, tint: 14, contrast: -5, saturation: -4, vibrance: 10, fade: 6 },
      tone: { shadows: '#6b4a5a', highlights: '#ffd2b8', amount: 0.25 }, tags: ['peach', 'pembe', 'sıcak'],
    }),
    F('sicak-isilti', 'Sıcak Işıltı', {
      adjust: { exposure: 6, temperature: 36, highlights: -15, shadows: 10, vibrance: 12, vignette: 15 },
      tone: { shadows: '#4a3020', highlights: '#ffcf8f', amount: 0.2 }, tags: ['warm', 'glow', 'sıcak'],
    }),
    F('porselen', 'Porselen', {
      adjust: { brightness: 8, contrast: 6, saturation: -18, temperature: -11, highlights: 10, shadows: 6 },
      tone: { shadows: '#3a4658', highlights: '#f6f2ee', amount: 0.15 },
      curve: { rgb: [[0, 0.03], [0.5, 0.53], [1, 1]] }, tags: ['porcelain', 'beyaz', 'temiz'],
    }),
    F('gul-kurusu', 'Gül Kurusu', {
      adjust: { tint: 25, temperature: 11, saturation: -15, fade: 18, contrast: -6 },
      tone: { shadows: '#5a3a48', highlights: '#ffd8dc', amount: 0.3 }, tags: ['dusty rose', 'pembe', 'soft'],
    }),
    F('bal', 'Bal', {
      adjust: { temperature: 50, tint: -7, saturation: 6, contrast: 8, shadows: 6, highlights: -10 },
      tone: { shadows: '#3d2a10', highlights: '#ffd27a', amount: 0.25 }, tags: ['honey', 'altın', 'sıcak'],
    }),
    F('dogal-isik', 'Doğal Işık', {
      adjust: { exposure: 3, contrast: 6, highlights: -12, shadows: 14, vibrance: 14, temperature: 7, sharpen: 8 },
      swatch: ['#6d5a4a', '#f4e6d4'], tags: ['natural', 'doğal', 'gün ışığı'],
    }),
    F('studyo', 'Stüdyo', {
      adjust: { contrast: 14, whites: 8, saturation: -4, sharpen: 12, temperature: -4 },
      tone: { shadows: '#40434a', highlights: '#f2f4ff', amount: 0.1 }, tags: ['studio', 'net', 'profesyonel'],
    }),
    F('altin-ten', 'Altın Ten', {
      adjust: { temperature: 29, tint: 7, vibrance: 18, highlights: -8, contrast: 6 },
      tone: { shadows: '#2d1f2a', highlights: '#ffc46b', amount: 0.22 }, tags: ['bronze', 'bronz', 'yaz'],
    }),
    F('pastel-ruya', 'Pastel Rüya', {
      adjust: { brightness: 10, contrast: -14, saturation: -10, fade: 25, tint: 22, temperature: -8 },
      tone: { shadows: '#7a6aa8', highlights: '#ffd6ea', amount: 0.4 }, tags: ['pastel', 'soft', 'yumuşak'],
    }),
    F('sinematik-portre', 'Sinematik Portre', {
      adjust: { contrast: 12, highlights: -18, shadows: 8, saturation: -10, temperature: 11, vignette: 22 },
      tone: { shadows: '#1d3340', highlights: '#ffd9b5', amount: 0.3 }, tags: ['cinematic', 'portre', 'film'],
    }),
  ],
}
