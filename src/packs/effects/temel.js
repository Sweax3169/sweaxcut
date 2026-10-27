// Temel: zoom, sarsıntı, bulanıklık, ayna, kaleydoskop, piksel…
import { R, C, B, S, AMT, SPD, fx, mp, blurH, blurV } from './lib.js'

export default {
  id: 'temel', name: 'Temel',
  items: [
    fx('zoom-nabiz', 'Ritim Zoom', [AMT(0.5, 'Zoom gücü'), R('bpm', 'Tempo (BPM)', 40, 200, 100, 1), R('flash', 'Parlama', 0, 1, 0.3)], `
vec4 effect(vec2 uv){
  float per = 60.0 / max(u_bpm, 20.0);
  float e = exp(-mod(uTime, per) / per * 5.0);
  float z = 1.0 + u_amount * uIntensity * 0.3 * e;
  vec4 c = tex(0.5 + (uv - 0.5) / z);
  c.rgb += c.rgb * u_flash * e * 0.6 * uIntensity;
  return vec4(min(c.rgb, 1.0), c.a);
}`, { tags: ['beat', 'vuruş', 'müzik', 'zoom'] }),

    fx('el-kamerasi', 'El Kamerası', [AMT(0.5), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed + uSeed * 50.0;
  vec2 o = vec2(fbm(vec2(t * 0.6, 1.7)) - 0.5, fbm(vec2(4.1, t * 0.55)) - 0.5) * 0.07 * A;
  float r = (fbm(vec2(t * 0.4, 8.3)) - 0.5) * 0.06 * A;
  float z = 1.0 + 0.08 * A;
  vec2 p = (uv - 0.5) * asp();
  p = rot(r) * p / z;
  return tex(p / asp() + 0.5 + o);
}`, { tags: ['shake', 'sallantı', 'handheld', 'titreme'] }),

    fx('deprem', 'Deprem', [AMT(0.6), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed + uSeed * 20.0;
  float env = 0.55 + 0.45 * noise(vec2(t * 1.3, 3.0));
  vec2 o = (vec2(noise(vec2(t * 22.0, 1.0)), noise(vec2(2.0, t * 24.0))) - 0.5) * 0.09 * A * env;
  vec2 o2 = (vec2(noise(vec2(t * 22.0 - 0.6, 1.0)), noise(vec2(2.0, t * 24.0 - 0.6))) - 0.5) * 0.09 * A * env;
  float z = 1.0 + 0.09 * A;
  vec2 b = 0.5 + (uv - 0.5) / z;
  vec4 c = (tx(b + o) * 2.0 + tx(b + mix(o, o2, 0.5)) + tx(b + o2)) / 4.0;
  return c;
}`, { tags: ['earthquake', 'sarsıntı', 'shake'] }),

    fx('darbe-sarsinti', 'Darbe Sarsıntısı', [AMT(0.7), R('period', 'Tekrar (sn)', 0.2, 4, 1, 0.05)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.1);
  float k = floor(uTime / per);
  float p = mod(uTime, per);
  float e = exp(-p * 9.0);
  float ang = rand(vec2(k, uSeed)) * 6.2832;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 o = dir * sin(p * 70.0) * e * 0.06 * A + vec2(-dir.y, dir.x) * sin(p * 53.0) * e * 0.025 * A;
  float z = 1.0 + 0.06 * A + 0.05 * A * e;
  return tex(0.5 + (uv - 0.5) / z + o);
}`, { tags: ['impact', 'vuruş', 'shake', 'patlama'] }),

    mp('bulanik', 'Bulanıklık', [R('radius', 'Yarıçap', 0, 60, 16, 1)], [
      [blurH('u_radius * uIntensity'), 0.5],
      [blurV('u_radius * uIntensity'), 0.5],
    ], { tags: ['blur', 'gauss', 'yumuşak'] }),

    fx('radyal-bulanik', 'Zoom Bulanıklığı', [AMT(0.5, 'Güç'), R('cx', 'Merkez X', 0, 1, 0.5), R('cy', 'Merkez Y', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  vec2 c = vec2(u_cx, u_cy);
  vec2 d = uv - c;
  float s = u_amount * uIntensity * 0.35;
  float j = rand(uv * uRes) / 24.0;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 24; i++){
    float f = float(i) / 24.0 + j;
    float w = 1.0 - f * 0.6;
    acc += pm(tx(c + d * (1.0 - s * f))) * w; ws += w;
  }
  return unpm(acc, ws);
}`, { tags: ['radial', 'zoom blur', 'hız'] }),

    fx('hareket-bulanik', 'Yönlü Bulanıklık', [R('length', 'Uzunluk', 0, 160, 40, 1), R('angle', 'Açı', 0, 180, 0, 1)], `
vec4 effect(vec2 uv){
  float a = radians(u_angle);
  vec2 d = vec2(cos(a), sin(a)) * px() * u_length * uIntensity;
  float j = rand(uv * uRes) - 0.5;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 24; i++){
    float f = (float(i) + j) / 23.0 - 0.5;
    acc += pm(tx(uv + d * f)); ws += 1.0;
  }
  return unpm(acc, ws);
}`, { tags: ['motion blur', 'hareket', 'hız'] }),

    mp('tilt-shift', 'Minyatür (Tilt-Shift)', [R('pos', 'Odak konumu', 0, 1, 0.45), R('width', 'Odak genişliği', 0.05, 0.8, 0.2), R('radius', 'Bulanıklık', 0, 40, 14, 1), R('sat', 'Oyuncak rengi', 0, 1, 0.5)], [
      [`vec4 effect(vec2 uv){
  float m = smoothstep(u_width * 0.5, u_width * 0.5 + 0.25, abs(uv.y - u_pos));
  return gblur(uv, vec2(px().x * u_radius * m * uIntensity, 0.0));
}`, 1],
      [`vec4 effect(vec2 uv){
  float m = smoothstep(u_width * 0.5, u_width * 0.5 + 0.25, abs(uv.y - u_pos));
  vec4 c = gblur(uv, vec2(0.0, px().y * u_radius * m * uIntensity));
  c.rgb = contr(satur(c.rgb, 1.0 + 0.5 * u_sat * uIntensity), 1.0 + 0.12 * u_sat * uIntensity);
  return c;
}`, 1],
    ], { tags: ['miniature', 'oyuncak', 'odak'] }),

    fx('keskinlestir', 'Keskinleştir', [AMT(0.5, 'Keskinlik'), R('radius', 'Yarıçap', 0.5, 4, 1, 0.1)], `
vec4 effect(vec2 uv){
  vec2 d = u_radius / uRes;
  vec4 c = tex(uv);
  vec3 b = (tex(uv + vec2(d.x, 0.0)).rgb + tex(uv - vec2(d.x, 0.0)).rgb + tex(uv + vec2(0.0, d.y)).rgb + tex(uv - vec2(0.0, d.y)).rgb
    + 0.5 * (tex(uv + d).rgb + tex(uv - d).rgb + tex(uv + vec2(d.x, -d.y)).rgb + tex(uv + vec2(-d.x, d.y)).rgb)) / 6.0;
  c.rgb = clamp(c.rgb + (c.rgb - b) * u_amount * 3.0 * uIntensity, 0.0, 1.0);
  return c;
}`, { tags: ['sharpen', 'netlik', 'detay'] }),

    fx('ayna-yatay', 'Yatay Ayna', [S('side', 'Kaynak taraf', [['sol', 'Sol'], ['sag', 'Sağ']])], `
vec4 effect(vec2 uv){
  float x = uv.x;
  if (u_side < 0.5) { if (x > 0.5) x = 1.0 - x; } else { if (x < 0.5) x = 1.0 - x; }
  return tex(vec2(mix(uv.x, x, step(0.5, uIntensity)), uv.y));
}`, { tags: ['mirror', 'simetri'] }),

    fx('ayna-dikey', 'Dikey Ayna', [S('side', 'Kaynak taraf', [['ust', 'Üst'], ['alt', 'Alt']])], `
vec4 effect(vec2 uv){
  float y = uv.y;
  if (u_side < 0.5) { if (y < 0.5) y = 1.0 - y; } else { if (y > 0.5) y = 1.0 - y; }
  return tex(vec2(uv.x, mix(uv.y, y, step(0.5, uIntensity))));
}`, { tags: ['mirror', 'simetri', 'göl'] }),

    fx('ayna-dortlu', 'Dörtlü Ayna', [R('zoom', 'Yakınlık', 1, 3, 1)], `
vec4 effect(vec2 uv){
  vec2 q = uv * 2.0;
  vec2 f = fract(q);
  vec2 m = mod(floor(q), 2.0);
  f = mix(f, 1.0 - f, m);
  f = 0.5 + (f - 0.5) / u_zoom;
  return tex(f);
}`, { tags: ['mirror', 'quad', '4'] }),

    fx('doseme', 'Döşeme', [R('count', 'Kare sayısı', 2, 8, 3, 1), SPD(0.3), B('flip', 'Aynalı', false)], `
vec4 effect(vec2 uv){
  float n = floor(u_count + 0.5);
  vec2 q = uv * n + vec2(1.0, 0.5) * uTime * u_speed * 0.4;
  vec2 f = fract(q);
  if (u_flip > 0.5) { vec2 m = mod(floor(q), 2.0); f = mix(f, 1.0 - f, m); }
  return tex(f);
}`, { tags: ['tile', 'tekrar', 'grid'] }),

    fx('kaleydoskop', 'Kaleydoskop', [R('segments', 'Dilim', 3, 16, 6, 1), SPD(0.5), R('zoom', 'Yakınlık', 0.5, 3, 1)], `
vec4 effect(vec2 uv){
  vec2 p = (uv - 0.5) * asp();
  float r = length(p);
  float seg = 6.28318 / floor(u_segments + 0.5);
  float a = atan(p.y, p.x) + uTime * u_speed * 0.4;
  a = mod(a, seg); a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r / u_zoom;
  q = q / asp() + 0.5;
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  return mix(tex(uv), tex(q), uIntensity);
}`, { tags: ['kaleidoscope', 'simetri', 'psikedelik'] }),

    fx('pikselle', 'Pikselleştir', [R('size', 'Piksel boyutu', 2, 80, 16, 1), R('grid', 'Izgara', 0, 1, 0)], `
vec4 effect(vec2 uv){
  vec2 cell = px() * max(u_size * uIntensity, 1.0);
  vec2 g = (uv - 0.5) / cell;
  vec4 c = tex((floor(g) + 0.5) * cell + 0.5);
  vec2 f = abs(fract(g) - 0.5);
  float e = smoothstep(0.38, 0.5, max(f.x, f.y));
  c.rgb *= 1.0 - u_grid * 0.45 * e;
  return c;
}`, { tags: ['pixel', 'sansür', 'mozaik', 'blok'] }),

    fx('posterize', 'Posterize', [R('levels', 'Ton sayısı', 2, 16, 4, 1), B('dither', 'Titreşim deseni', false)], `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float L = floor(u_levels) - 1.0;
  float d = u_dither > 0.5 ? bayer(uv * uRes / max(1.0, uRes.y / 540.0)) - 0.5 : 0.0;
  vec3 q = floor(c.rgb * L + 0.5 + d) / L;
  return vec4(mix(c.rgb, clamp(q, 0.0, 1.0), uIntensity), c.a);
}`, { tags: ['poster', 'renk azalt', 'ton'] }),

    fx('negatif', 'Negatif', [AMT(1), B('lum', 'Renkleri koru', false)], `
vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  vec3 inv = u_lum > 0.5 ? clamp(c.rgb + (1.0 - 2.0 * luma(c.rgb)), 0.0, 1.0) : 1.0 - c.rgb;
  return vec4(mix(c.rgb, inv, u_amount * uIntensity), c.a);
}`, { tags: ['invert', 'ters', 'negative'] }),

    fx('kenar-parlama', 'Kenar Parlaması', [AMT(0.8), C('color', 'Renk', '#4df3ff'), B('rainbow', 'Gökkuşağı', false), R('dark', 'Karartma', 0, 1, 0.4)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float e = sobel(uv, px() * 1.5) * 0.7 + sobel(uv, px() * 4.0) * 0.5;
  e = smoothstep(0.08, 0.9, e);
  vec3 col = mix(u_color, rainbow(uv.x * 0.8 + uv.y * 0.4 - uTime * 0.25), u_rainbow);
  vec3 c = s.rgb * (1.0 - u_dark * A) + col * e * 1.4 * A;
  return vec4(min(c, 1.0), s.a);
}`, { tags: ['edge', 'glow', 'kontur'] }),
  ],
}
