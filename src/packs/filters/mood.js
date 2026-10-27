// Duygu: melankoli, rüya gibi, karamsar, sıcak yuva, buz gibi, nostalji…
import { F } from './lib.js'

export default {
  id: 'mood', name: 'Duygu',
  items: [
    F('melankoli', 'Melankoli', {
      adjust: { saturation: -35, temperature: -40, contrast: -6, fade: 15, exposure: -10 },
      tone: { shadows: '#18233a', highlights: '#c0cee0', amount: 0.4 }, tags: ['melancholy', 'hüzün', 'mavi'],
    }),
    F('ruya-gibi', 'Rüya Gibi', {
      adjust: { brightness: 6, contrast: -12, fade: 12, saturation: -5, tint: 14, highlights: -10 },
      tone: { shadows: '#6a5a9a', highlights: '#ffe8f4', amount: 0.25 },
      glsl: `vec3 grade(vec3 c, vec2 uv){
  vec2 r = 12.0 / uRes;
  vec3 b = vec3(0.0);
  for (int i = 0; i < 8; i++){ float a = float(i) * 0.785398; b += texture(uTex, uv + vec2(cos(a), sin(a)) * r).rgb; }
  b /= 8.0;
  return 1.0 - (1.0 - c) * (1.0 - b * 0.45);
}`, tags: ['dreamy', 'rüya', 'parıltı'],
    }),
    F('karamsar', 'Karamsar', {
      adjust: { contrast: 18, saturation: -25, exposure: -10, highlights: -25, shadows: -10, temperature: -11, vignette: 30 },
      tone: { shadows: '#0f1a1f', highlights: '#b4bcc0', amount: 0.25 }, tags: ['moody', 'karanlık', 'ağır'],
    }),
    F('sicak-yuva', 'Sıcak Yuva', {
      adjust: { temperature: 45, tint: 7, fade: 10, contrast: -4, saturation: -4, highlights: -10, vignette: 18 },
      tone: { shadows: '#3a2418', highlights: '#ffd08a', amount: 0.3 }, tags: ['cozy', 'ev', 'sıcak'],
    }),
    F('buz-gibi', 'Buz Gibi', {
      adjust: { temperature: -50, saturation: -40, contrast: 18, exposure: -6 },
      tone: { shadows: '#0a1626', highlights: '#d6e4ee', amount: 0.3 }, tags: ['icy', 'soğuk', 'mesafeli'],
    }),
    F('nostalji', 'Nostalji', {
      adjust: { fade: 24, temperature: 20, saturation: -20, contrast: -5, grain: 14, vignette: 20 },
      tone: { shadows: '#2a3a2a', highlights: '#fff0b8', amount: 0.35 },
      curve: { g: [[0, 0.04], [1, 0.98]], b: [[0, 0.06], [1, 0.84]] }, tags: ['nostalgia', 'anı', 'eski'],
    }),
    F('umut', 'Umut', {
      adjust: { exposure: 8, temperature: 18, vibrance: 18, highlights: -10, shadows: 15, contrast: -4 },
      tone: { shadows: '#4a4a5a', highlights: '#fff2c8', amount: 0.2 }, tags: ['hope', 'aydınlık', 'pozitif'],
    }),
    F('yalnizlik', 'Yalnızlık', {
      adjust: { saturation: -50, temperature: -27, exposure: -8, contrast: 10, vignette: 25 },
      tone: { shadows: '#141c26', highlights: '#c0c8d0', amount: 0.2 }, tags: ['lonely', 'yalnız', 'boş'],
    }),
    F('tutku', 'Tutku', {
      adjust: { temperature: 18, tint: 27, saturation: 18, contrast: 15, blacks: -4, vignette: 20 },
      tone: { shadows: '#3a0a1a', highlights: '#ff9090', amount: 0.35 }, tags: ['passion', 'aşk', 'kırmızı'],
    }),
    F('huzur', 'Huzur', {
      adjust: { brightness: 5, contrast: -10, saturation: -10, tint: -7, temperature: 4, fade: 10 },
      tone: { shadows: '#2a4a40', highlights: '#f0fff4', amount: 0.2 }, tags: ['calm', 'sakin', 'huzurlu'],
    }),
    F('gizem', 'Gizem', {
      adjust: { exposure: -12, temperature: -18, tint: 22, saturation: -10, contrast: 15, vignette: 30 },
      tone: { shadows: '#1a0f30', highlights: '#c8b0ff', amount: 0.3 }, tags: ['mystery', 'gizemli', 'mor'],
    }),
  ],
}
