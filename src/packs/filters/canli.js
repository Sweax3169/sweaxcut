// Canlı: canlı, pop, vurucu, neon gece, siberpunk, oyun renkleri, HDR…
import { F } from './lib.js'

export default {
  id: 'canli', name: 'Canlı',
  items: [
    F('canli', 'Canlı', {
      adjust: { vibrance: 35, saturation: 10, contrast: 10, sharpen: 8 },
      swatch: ['#1e6bff', '#ffcc00'], tags: ['vivid', 'canlı', 'renkli'],
    }),
    F('pop', 'Pop', {
      adjust: { saturation: 28, contrast: 16, brightness: 4 },
      curve: { rgb: [[0, 0], [0.25, 0.21], [0.75, 0.8], [1, 1]] },
      swatch: ['#ff2d6f', '#2de1ff'], tags: ['pop', 'parlak', 'renkli'],
    }),
    F('vurucu', 'Vurucu', {
      adjust: { contrast: 28, blacks: -6, whites: 8, saturation: 15, vibrance: 15, sharpen: 15, vignette: 10 },
      swatch: ['#101010', '#ff4d2e'], tags: ['punchy', 'sert', 'kontrast'],
    }),
    F('neon-gece', 'Neon Gece', {
      adjust: { contrast: 18, saturation: 30, temperature: -32, tint: 32, highlights: -10, blacks: -5 },
      tone: { shadows: '#1b0b3d', highlights: '#ff4fd8', amount: 0.3 }, tags: ['neon', 'gece', 'şehir'],
    }),
    F('siberpunk', 'Siberpunk', {
      adjust: { contrast: 15, saturation: 20 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  float l = luma(c);
  vec3 m = l < 0.5 ? mix(vec3(0.05, 0.1, 0.35), vec3(1.0, 0.25, 0.75), l * 2.0) : mix(vec3(1.0, 0.25, 0.75), vec3(0.3, 1.0, 1.0), (l - 0.5) * 2.0);
  return mix(c, m * (0.6 + 0.6 * c), 0.45);
}`, swatch: ['#1a1a5e', '#ff3fc0'], tags: ['cyberpunk', 'neon', 'gelecek'],
    }),
    F('tropik', 'Tropik', {
      adjust: { vibrance: 30, temperature: 14, tint: -11, saturation: 12, highlights: -10 },
      tone: { shadows: '#004d4d', highlights: '#ffe066', amount: 0.2 }, tags: ['tropical', 'yaz', 'plaj'],
    }),
    F('seker', 'Şeker', {
      adjust: { saturation: 20, brightness: 8, contrast: -4, tint: 18, fade: 6 },
      tone: { shadows: '#5b3a8a', highlights: '#ffd1f0', amount: 0.25 }, tags: ['candy', 'tatlı', 'pembe'],
    }),
    F('oyun-renkleri', 'Oyun Renkleri', {
      adjust: { vibrance: 40, saturation: 20, contrast: 18, sharpen: 20, highlights: -10, shadows: 10 },
      swatch: ['#00c2ff', '#ff3b5c'], tags: ['gaming', 'oyun', 'canlı'],
    }),
    F('yaz-patlamasi', 'Yaz Patlaması', {
      adjust: { saturation: 18, temperature: 22, exposure: 6, contrast: 10, vibrance: 15 },
      swatch: ['#ff7a00', '#ffe14d'], tags: ['summer', 'yaz', 'güneş'],
    }),
    F('elektrik-mavisi', 'Elektrik Mavisi', {
      adjust: { temperature: -45, saturation: 20, contrast: 15, tint: 9 },
      tone: { shadows: '#001a4d', highlights: '#a8f0ff', amount: 0.3 }, tags: ['electric', 'mavi', 'soğuk'],
    }),
    F('hdr', 'HDR Etkisi', {
      adjust: { highlights: -40, shadows: 40, contrast: 18, vibrance: 25, sharpen: 25, whites: 10, blacks: -8 },
      swatch: ['#2a3d4f', '#ffd9a0'], tags: ['hdr', 'detay', 'keskin'],
    }),
    F('limonata', 'Limonata', {
      adjust: { temperature: 11, tint: -22, saturation: 12, brightness: 6 },
      tone: { shadows: '#3a4a2a', highlights: '#f6ff8a', amount: 0.25 }, tags: ['lemon', 'sarı', 'ferah'],
    }),
  ],
}
