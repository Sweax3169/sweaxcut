// Sinematik: sinema bantları, gren, turkuaz-turuncu, orton, anamorfik, noir…
import { R, C, B, S, AMT, SPD, mp, fx, blurH, blurV } from './lib.js'

// Odak çekme: bulanıklık miktarı (0 net, 1 tam bulanık)
const FOCUS = `
float focusAmt(){
  float dur = uProgress > 0.001 ? uTime / uProgress : 1e6;
  if (u_mode < 0.5) return 1.0 - smoothstep(0.0, u_dur, uTime);
  if (u_mode < 1.5) return 1.0 - smoothstep(0.0, u_dur, dur - uTime);
  return 0.5 - 0.5 * cos(uTime * 6.28318 / max(u_dur * 2.0, 0.2));
}`

export default {
  id: 'sinematik', name: 'Sinematik',
  items: [
    fx('sinema-bantlari', 'Sinema Bantları', [S('ratio', 'Oran', [['239', '2.39:1 Sinemaskop'], ['200', '2:1'], ['185', '1.85:1'], ['100', '1:1 Kare']]), R('anim', 'Kayma süresi (sn)', 0, 2, 0.6), B('out', 'Sonda çekil', true), C('color', 'Renk', '#000000')], `
vec4 effect(vec2 uv){
  float ratio = u_ratio < 0.5 ? 2.39 : u_ratio < 1.5 ? 2.0 : u_ratio < 2.5 ? 1.85 : 1.0;
  float bar = min((1.0 - min(1.0, ar() / ratio)) * 0.5, 0.42);
  float tin = u_anim > 0.0 ? smoothstep(0.0, u_anim, uTime) : 1.0;
  float dur = uProgress > 0.001 ? uTime / uProgress : 1e6;
  float tout = (u_anim > 0.0 && u_out > 0.5) ? smoothstep(0.0, u_anim, dur - uTime) : 1.0;
  float b = bar * eoc(tin) * eoc(tout) * uIntensity;
  vec4 s = tex(uv);
  float m = clamp(step(uv.y, b) + step(1.0 - b, uv.y), 0.0, 1.0);
  return mix(s, vec4(u_color, 1.0), m);
}`, { tags: ['letterbox', 'sinema', 'bant', 'film'], previewDuration: 3 }),

    fx('film-greni', 'Film Greni + Vinyet', [AMT(0.6, 'Gren'), R('size', 'Gren boyutu', 1, 4, 1.5), R('vig', 'Vinyet', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float fr = floor(uTime * 24.0);
  vec2 g = uv * uRes / max(1.0, u_size * uRes.y / 1080.0);
  float n = (rand(floor(g) + fr * 17.13) - 0.5) * 0.6 + (noise(g * 0.5 + fr * 3.7) - 0.5) * 0.8;
  float l = luma(s.rgb);
  float w = 1.0 - pow(abs(l - 0.5) * 2.0, 2.0) * 0.6;
  vec3 cn = vec3(rand(floor(g) + 3.1 + fr), rand(floor(g) + 5.7 + fr), rand(floor(g) + 7.3 + fr)) - 0.5;
  vec3 c = s.rgb + n * 0.22 * A * w + cn * 0.04 * A;
  c *= mix(1.0, vig(uv, 0.35, 1.55), u_vig * uIntensity);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['grain', 'gren', 'vinyet', 'film'] }),

    mp('turkuaz-turuncu', 'Turkuaz & Turuncu', [AMT(0.85), R('bloom', 'Parlama', 0, 1, 0.5)], [
      [`vec4 effect(vec2 uv){
  vec2 o = 0.5 / uRes;
  vec3 c = (tx(uv + o).rgb + tx(uv - o).rgb + tx(uv + vec2(o.x, -o.y)).rgb + tx(uv - vec2(o.x, -o.y)).rgb) * 0.25;
  return vec4(c * smoothstep(0.55, 0.9, luma(c)), 1.0);
}`, 0.25],
      [blurH('18.0'), 0.25],
      [blurV('18.0'), 0.25],
      [`vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 o = ox(uv);
  vec3 c = o.rgb;
  float l = luma(c);
  vec3 g = c;
  g = mix(g, g * 0.6 + vec3(0.0, 0.42, 0.5) * 0.5 * (0.3 + l), (1.0 - smoothstep(0.0, 0.55, l)) * 0.7);
  g = mix(g, g * 0.7 + vec3(1.0, 0.6, 0.3) * 0.4 * l, smoothstep(0.45, 1.0, l) * 0.6);
  g = contr(satur(g, 1.15), 1.1);
  g = scr(g, clamp(tex(uv).rgb * vec3(1.0, 0.8, 0.6) * u_bloom * 1.5, 0.0, 1.0));
  return vec4(mix(c, g, A), o.a);
}`, 1],
    ], { tags: ['teal orange', 'hollywood', 'blockbuster', 'renk'] }),

    mp('orton', 'Rüya Parıltısı (Orton)', [AMT(0.7), R('radius', 'Yumuşaklık', 4, 50, 20, 1)], [
      [blurH('u_radius'), 0.5],
      [blurV('u_radius'), 0.5],
      [`vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 o = ox(uv);
  vec3 b = tex(uv).rgb;
  vec3 r = scr(o.rgb, o.rgb) * scr(b, b);
  r = mix(r, scr(r, b * 0.3), 0.5);
  return vec4(mix(o.rgb, r, A * 0.85), o.a);
}`, 1],
    ], { tags: ['orton', 'dreamy', 'rüya', 'yumuşak'] }),

    mp('anamorfik', 'Anamorfik Çizgiler', [AMT(0.8), R('threshold', 'Eşik', 0.3, 1, 0.7), R('length', 'Uzunluk', 0.2, 2, 1), C('color', 'Renk', '#3d8bff')], [
      [`vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float m = smoothstep(u_threshold, u_threshold + 0.15, luma(c.rgb)) * c.a;
  return vec4(c.rgb * m, 1.0);
}`, 0.5],
      [blurH('60.0 * u_length'), 0.25],
      [blurH('240.0 * u_length'), 0.25],
      [`vec4 effect(vec2 uv){
  vec4 o = ox(uv);
  vec3 st = tex(uv).rgb;
  vec3 tint = u_color * luma(st) * 2.2 + st * 0.25;
  return vec4(scr(o.rgb, clamp(tint * u_amount * uIntensity, 0.0, 1.0)), o.a);
}`, 1],
    ], { tags: ['anamorphic', 'lens', 'çizgi', 'flare'] }),

    fx('sinematik-kararma', 'Sinematik Kararma', [R('in', 'Açılış (sn)', 0, 3, 1), R('out', 'Kapanış (sn)', 0, 3, 1), C('color', 'Renk', '#000000')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float dur = uProgress > 0.001 ? uTime / uProgress : 1e6;
  float fin = u_in > 0.0 ? smoothstep(0.0, u_in, uTime) : 1.0;
  float fout = u_out > 0.0 ? smoothstep(0.0, u_out, dur - uTime) : 1.0;
  vec3 c = s.rgb * mix(1.0, vig(uv, 0.4, 1.6), 0.4 * uIntensity);
  c = mix(u_color, c, mix(1.0, fin * fout, uIntensity));
  return vec4(c, s.a);
}`, { tags: ['fade', 'kararma', 'açılış', 'kapanış'] }),

    fx('noir', 'Kara Film (Noir)', [AMT(1), R('blinds', 'Panjur gölgesi', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float l = smoothstep(0.08, 0.92, dot(s.rgb, vec3(0.3, 0.59, 0.11)));
  l = mix(l, l * l * (3.0 - 2.0 * l), 0.7);
  vec2 p = rot(-0.5) * (uv * asp());
  float f = fract(p.y * 10.0);
  float bl = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.55, 0.63, f));
  float c = l * mix(1.0, 0.4 + 0.6 * bl, u_blinds);
  c *= mix(1.0, vig(uv, 0.3, 1.45), 0.8);
  c += (rand(uv * uRes + fract(uTime * 7.0) * 50.0) - 0.5) * 0.08;
  vec3 col = vec3(c) * vec3(1.0, 0.99, 0.96);
  return vec4(mix(s.rgb, clamp(col, 0.0, 1.0), A), s.a);
}`, { tags: ['noir', 'siyah beyaz', 'dedektif', 'kontrast'] }),

    mp('halasyon', 'Film Halasyonu', [AMT(0.8), R('threshold', 'Eşik', 0.3, 1, 0.65), R('radius', 'Yayılma', 2, 30, 10, 1)], [
      [`vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  return vec4(c.rgb * smoothstep(u_threshold, u_threshold + 0.2, luma(c.rgb)) * c.a, 1.0);
}`, 0.5],
      [blurH('u_radius'), 0.5],
      [blurV('u_radius'), 0.5],
      [`vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 o = ox(uv);
  vec3 h = tex(uv).rgb;
  vec3 c = o.rgb + h * vec3(1.0, 0.25, 0.08) * A * 3.0;
  c = mix(c, c * vec3(1.03, 1.0, 0.96), A);
  return vec4(clamp(c, 0.0, 1.0), o.a);
}`, 1],
    ], { tags: ['halation', 'film', 'kırmızı hale'] }),

    mp('merkez-odak', 'Merkez Odak', [R('size', 'Odak alanı', 0.1, 1.2, 0.45), R('radius', 'Bulanıklık', 0, 40, 16, 1), R('cx', 'Merkez X', 0, 1, 0.5), R('cy', 'Merkez Y', 0, 1, 0.5)], [
      [`vec4 effect(vec2 uv){
  float m = smoothstep(u_size, u_size + 0.5, length((uv - vec2(u_cx, u_cy)) * 2.0));
  return gblur(uv, vec2(px().x * u_radius * m * uIntensity, 0.0));
}`, 1],
      [`vec4 effect(vec2 uv){
  float m = smoothstep(u_size, u_size + 0.5, length((uv - vec2(u_cx, u_cy)) * 2.0));
  vec4 c = gblur(uv, vec2(0.0, px().y * u_radius * m * uIntensity));
  c.rgb *= 1.0 - 0.2 * m * uIntensity;
  return c;
}`, 1],
    ], { tags: ['iris blur', 'odak', 'portre', 'bokeh'] }),

    mp('odaklanma', 'Odak Çekme', [S('mode', 'Mod', [['netlesme', 'Netleşme (başta)'], ['bulaniklasma', 'Bulanıklaşma (sonda)'], ['dongu', 'Döngü']]), R('dur', 'Süre (sn)', 0.2, 4, 2), R('radius', 'Bulanıklık', 2, 50, 24, 1)], [
      [FOCUS + `
vec4 effect(vec2 uv){ return gblur(uv, vec2(px().x * u_radius * focusAmt() * uIntensity, 0.0)); }`, 1],
      [FOCUS + `
vec4 effect(vec2 uv){
  float f = focusAmt();
  vec4 c = gblur(uv, vec2(0.0, px().y * u_radius * f * uIntensity));
  c.rgb *= 1.0 + 0.06 * f;
  return c;
}`, 1],
    ], { tags: ['rack focus', 'odak', 'netleşme'] }),

    fx('capraz-islem', 'Çapraz İşlem', [AMT(0.85)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 c = s.rgb;
  vec3 x = vec3(smoothstep(0.05, 0.95, c.r), smoothstep(0.0, 1.0, c.g) * 0.9 + 0.05 * c.g, c.b * 0.55 + 0.22);
  x = mix(x, x * vec3(1.05, 1.07, 0.85), smoothstep(0.5, 1.0, luma(x)));
  x = satur(x, 1.2);
  x += (rand(uv * uRes + fract(uTime * 9.0) * 30.0) - 0.5) * 0.05;
  return vec4(mix(c, clamp(x, 0.0, 1.0), A), s.a);
}`, { tags: ['cross process', 'film', 'renk'] }),
  ],
}
