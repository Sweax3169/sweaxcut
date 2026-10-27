// Retro & VHS: kaset, eski film, CRT, 8/16-bit, Game Boy, yarım ton…
import { R, AMT, SPD, fx } from './lib.js'

export default {
  id: 'retro', name: 'Retro & VHS',
  items: [
    fx('vhs', 'VHS Kaset', [AMT(0.85), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec2 q = uv;
  q.x += (noise(vec2(uv.y * 3.0, t * 1.5)) - 0.5) * 0.006 * A;
  float by = fract(-t * 0.12 + uSeed);
  float band = 1.0 - smoothstep(0.0, 0.07, abs(uv.y - by));
  q.x += band * (noise(vec2(uv.y * 220.0, t * 40.0)) - 0.5) * 0.05 * A;
  float hs = 1.0 - smoothstep(0.0, 0.05, uv.y);
  q.x += hs * noise(vec2(uv.y * 80.0, t * 25.0)) * 0.05 * A;
  vec4 c0 = tx(q);
  vec3 cs = vec3(0.0);
  for (int i = 0; i < 6; i++) cs += tx(q + vec2(px().x * (float(i) * 4.0 - 4.0) * A + 0.004 * A, 0.0)).rgb;
  cs /= 6.0;
  float Y = luma(c0.rgb);
  vec3 c = Y + (cs - luma(cs)) * 1.15;
  c += (rand(uv * uRes + fract(t * 7.0) * 100.0) - 0.5) * 0.09 * A;
  float streak = step(0.75, noise(vec2(uv.x * 30.0 + t * 50.0, floor(uv.y * uRes.y * 0.5))));
  c += band * streak * 0.5 * A;
  c += hs * 0.15 * A;
  c = mix(c, c * vec3(1.04, 0.98, 0.9) * 0.88 + 0.07, A);
  c *= 1.0 - 0.06 * A * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.5));
  return vec4(clamp(c, 0.0, 1.0), c0.a);
}`, { tags: ['vhs', 'kaset', '90lar', 'analog'] }),

    fx('eski-film', 'Eski Film', [AMT(1), R('sepia', 'Sepya', 0, 1, 0.85)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float fr = floor(uTime * 18.0);
  vec2 jit = (vec2(rand(vec2(fr, 1.0)), rand(vec2(fr, 2.0))) - 0.5) * vec2(0.002, 0.007) * A;
  vec4 s = tex(uv + jit);
  float l = luma(s.rgb);
  vec3 sep = vec3(l * 1.07 + 0.03, l * 0.93 + 0.01, l * 0.72);
  vec3 c = mix(s.rgb, sep, u_sepia * A);
  c = contr(c, 1.0 + 0.15 * A);
  c *= 1.0 - 0.12 * A * rand(vec2(fr, 3.0));
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float on = step(0.45, rand(vec2(fr, fi + 5.0)));
    float x = rand(vec2(floor(fr / 3.0) + fi * 7.0, 4.0)) + (rand(vec2(fr, fi)) - 0.5) * 0.01;
    float w = 0.0006 + 0.0012 * rand(vec2(fi, fr));
    float m = on * (1.0 - smoothstep(w, w * 2.5, abs(uv.x - x))) * (0.4 + 0.6 * noise(vec2(uv.y * 8.0, fi + fr)));
    c = mix(c, vec3(0.92, 0.88, 0.8), m * 0.7 * A);
  }
  vec2 g = uv * asp() * 14.0; vec2 id = floor(g);
  float rr = rand(id + fr * 1.37);
  if (rr > 0.975) {
    vec2 pos = h22(id + fr);
    float sz = 0.04 + 0.12 * rand(id + 2.0);
    float d = length(fract(g) - pos);
    c = mix(c, rr > 0.99 ? vec3(0.95) : vec3(0.05), (1.0 - smoothstep(sz * 0.5, sz, d)) * A);
  }
  c *= mix(1.0, vig(uv, 0.3, 1.5), 0.85 * A);
  c += (rand(uv * uRes + fr) - 0.5) * 0.12 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['old film', 'sepya', 'çizik', 'nostalji'] }),

    fx('crt', 'CRT Ekran', [AMT(1), R('curve', 'Kavis', 0, 1, 0.5), R('lines', 'Tarama satırı', 100, 600, 280, 10)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 q = barrel(uv, u_curve * 0.6 * A);
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec4 c = tex(q);
  vec3 col = c.rgb;
  col += (tex(q + vec2(px().x * 2.0, 0.0)).rgb + tex(q - vec2(px().x * 2.0, 0.0)).rgb) * 0.15 * A;
  float sl = 0.5 + 0.5 * cos(q.y * min(u_lines, uRes.y / 3.0) * 6.28318);
  col *= mix(1.0, 0.6 + 0.4 * sl, A);
  float m = mod(floor(uv.x * uRes.x / max(1.0, uRes.y / 360.0)), 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 0.7, 0.7) : m < 2.0 ? vec3(0.7, 1.0, 0.7) : vec3(0.7, 0.7, 1.0);
  col *= mix(vec3(1.0), mask, 0.6 * A);
  col *= 1.0 + 0.3 * A;
  vec2 e = clamp(q * (1.0 - q), 0.0, 1.0);
  col *= mix(1.0, clamp(pow(e.x * e.y * 30.0, 0.3), 0.0, 1.0), A);
  col *= 1.0 - 0.04 * A * sin(uTime * 60.0);
  col = mix(vec3(0.0), col, inside);
  return vec4(clamp(col, 0.0, 1.0), mix(tex(uv).a, c.a, inside));
}`, { tags: ['crt', 'tüplü tv', 'monitör', 'retro'] }),

    fx('8-bit', '8-Bit', [R('size', 'Piksel boyutu', 2, 40, 10, 1), R('dither', 'Titreşim', 0, 1, 0.6)], `
const vec3 PAL[16] = vec3[16](
  vec3(0.0), vec3(0.27), vec3(0.62), vec3(1.0),
  vec3(0.55, 0.1, 0.12), vec3(0.95, 0.25, 0.2), vec3(1.0, 0.6, 0.3), vec3(1.0, 0.9, 0.45),
  vec3(0.1, 0.45, 0.15), vec3(0.35, 0.82, 0.3), vec3(0.1, 0.18, 0.55), vec3(0.25, 0.5, 0.95),
  vec3(0.45, 0.82, 1.0), vec3(0.5, 0.15, 0.55), vec3(0.98, 0.45, 0.75), vec3(0.6, 0.38, 0.2));
vec4 effect(vec2 uv){
  vec2 cell = px() * u_size;
  vec2 g = floor((uv - 0.5) / cell);
  vec4 s = tex((g + 0.5) * cell + 0.5);
  vec3 c = s.rgb + (bayer(g) - 0.5) * 0.2 * u_dither;
  float bd = 1e9; vec3 best = c;
  for (int i = 0; i < 16; i++){ vec3 d = (c - PAL[i]) * vec3(0.8, 1.0, 0.6); float dd = dot(d, d); if (dd < bd){ bd = dd; best = PAL[i]; } }
  return vec4(mix(tex(uv).rgb, best, uIntensity), s.a);
}`, { tags: ['8bit', 'nes', 'piksel', 'retro oyun'] }),

    fx('16-bit', '16-Bit', [R('size', 'Piksel boyutu', 2, 24, 5, 1), R('levels', 'Renk basamağı', 3, 12, 6, 1)], `
vec4 effect(vec2 uv){
  vec2 cell = px() * u_size;
  vec2 g = floor((uv - 0.5) / cell);
  vec4 s = tex((g + 0.5) * cell + 0.5);
  vec3 c = satur(s.rgb, 1.25);
  c = floor(c * u_levels + bayer(g)) / u_levels;
  return vec4(mix(tex(uv).rgb, clamp(c, 0.0, 1.0), uIntensity), s.a);
}`, { tags: ['16bit', 'snes', 'sega', 'piksel'] }),

    fx('gameboy', 'Game Boy', [R('res', 'Çözünürlük (satır)', 60, 300, 144, 1)], `
vec4 effect(vec2 uv){
  vec2 cell = vec2(1.0 / (u_res * ar()), 1.0 / u_res);
  vec2 g = floor(uv / cell);
  vec4 s = tex((g + 0.5) * cell);
  float l = clamp(luma(s.rgb) + (bayer(g) - 0.5) * 0.2, 0.0, 1.0);
  float idx = floor(l * 3.999);
  vec3 c = idx < 1.0 ? vec3(0.06, 0.22, 0.06) : idx < 2.0 ? vec3(0.19, 0.38, 0.19) : idx < 3.0 ? vec3(0.55, 0.67, 0.06) : vec3(0.61, 0.74, 0.06);
  vec2 f = fract(uv / cell);
  float gl = smoothstep(0.0, 0.14, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  c *= 0.86 + 0.14 * gl;
  return vec4(mix(tex(uv).rgb, c, uIntensity), s.a);
}`, { tags: ['gameboy', 'yeşil', 'el konsolu', 'dmg'] }),

    fx('90lar-kamera', "90'lar Kamerası", [AMT(0.9)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime;
  vec2 d = px() * 2.5;
  vec4 s = tex(uv);
  vec3 b = (tex(uv + vec2(d.x, 0.0)).rgb + tex(uv - vec2(d.x, 0.0)).rgb + tex(uv + vec2(0.0, d.y)).rgb + tex(uv - vec2(0.0, d.y)).rgb) * 0.25;
  vec3 c = s.rgb + (s.rgb - b) * 1.2 * A;
  vec3 ch = tex(uv + vec2(px().x * 6.0, 0.0)).rgb;
  c = mix(c, luma(c) + (ch - luma(ch)), 0.6 * A);
  c = satur(c, 1.0 + 0.25 * A);
  c = mix(c, c * vec3(1.06, 0.98, 1.04) + vec3(0.03, 0.0, 0.03), A);
  vec2 n = vec2(rand(uv * uRes + fract(t * 9.0) * 50.0), rand(uv * uRes * 1.3 + fract(t * 7.0) * 30.0)) - 0.5;
  c.r += n.x * 0.08 * A; c.b += n.y * 0.08 * A;
  float line = mod(floor(uv.y * uRes.y / max(1.0, uRes.y / 540.0)), 2.0);
  c *= 1.0 - line * 0.06 * A;
  c *= mix(1.0, vig(uv, 0.5, 1.6), 0.5 * A);
  c = mix(c, c * 0.94 + 0.03, A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['camcorder', 'handycam', 'ev videosu'] }),

    fx('polaroid', 'Polaroid Anı', [AMT(0.9)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 c = s.rgb;
  vec3 soft = (tex(uv + px() * 1.5).rgb + tex(uv - px() * 1.5).rgb) * 0.5;
  c = mix(c, soft, 0.4 * A);
  float l = luma(c);
  c = mix(c, c * 0.82 + 0.12, A);
  c += vec3(-0.03, 0.02, 0.05) * (1.0 - l) * A;
  c += vec3(0.06, 0.03, -0.04) * l * A;
  c = satur(c, 1.0 - 0.15 * A);
  vec2 lp = uv - vec2(1.0, 1.0);
  c = scr(c, vec3(1.0, 0.5, 0.2) * exp(-dot(lp, lp) * 6.0) * 0.35 * A);
  c *= mix(1.0, vig(uv, 0.6, 1.7), 0.5 * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['polaroid', 'anı', 'instant', 'soluk'] }),

    fx('cizgi-roman', 'Çizgi Roman Noktası', [AMT(1), R('size', 'Nokta boyutu', 4, 30, 10, 1)], `
float ink(vec2 uv, float ang, int ch, float sc){
  vec2 p = rot(ang) * (uv * asp()) * sc;
  vec2 cid = floor(p); vec2 f = fract(p) - 0.5;
  vec2 cuv = (rot(-ang) * ((cid + 0.5) / sc)) / asp();
  vec3 col = tex(cuv).rgb;
  float v = 1.0 - (ch == 0 ? col.r : ch == 1 ? col.g : col.b);
  float r = sqrt(clamp(v, 0.0, 1.0)) * 0.62;
  float aa = sc / uRes.y * 1.2;
  return 1.0 - smoothstep(r - aa, r + aa, length(f));
}
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float sc = 1080.0 / max(u_size, 2.0);
  vec4 s = tex(uv);
  vec3 c = vec3(1.0 - ink(uv, 0.26, 0, sc), 1.0 - ink(uv, 1.31, 1, sc), 1.0 - ink(uv, 0.0, 2, sc));
  c *= vec3(1.0, 0.98, 0.93);
  float e = sobel(uv, px() * 2.0);
  c *= 1.0 - smoothstep(0.25, 0.6, e);
  return vec4(mix(s.rgb, c, A), s.a);
}`, { tags: ['comic', 'halftone', 'pop art', 'nokta'] }),

    fx('gazete', 'Gazete Baskısı', [AMT(1), R('size', 'Nokta boyutu', 3, 24, 8, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float sc = 1080.0 / max(u_size, 2.0);
  vec2 p = rot(0.785) * (uv * asp()) * sc;
  vec2 cid = floor(p); vec2 f = fract(p) - 0.5;
  vec2 cuv = (rot(-0.785) * ((cid + 0.5) / sc)) / asp();
  vec4 s = tex(uv);
  float l = clamp((luma(tex(cuv).rgb) - 0.5) * 1.3 + 0.5, 0.0, 1.0);
  float r = sqrt(1.0 - l) * 0.7;
  float aa = sc / uRes.y * 1.2;
  float dotm = 1.0 - smoothstep(r - aa, r + aa, length(f));
  vec3 paper = vec3(0.93, 0.91, 0.85) * (0.95 + 0.05 * noise(uv * uRes * 0.5));
  vec3 c = mix(paper, vec3(0.08, 0.08, 0.1), dotm);
  return vec4(mix(s.rgb, c, A), s.a);
}`, { tags: ['newspaper', 'halftone', 'baskı', 'siyah beyaz'] }),

    fx('super8', 'Süper 8', [AMT(0.9)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float fr = floor(uTime * 18.0);
  vec2 jit = (vec2(rand(vec2(fr, 7.0)), rand(vec2(fr, 9.0))) - 0.5) * vec2(0.003, 0.004) * A;
  vec2 q = uv + jit;
  vec4 s = tex(q);
  vec2 d = px() * 2.0;
  vec3 b = (tex(q + d).rgb + tex(q - d).rgb + tex(q + vec2(d.x, -d.y)).rgb + tex(q - vec2(d.x, -d.y)).rgb) * 0.25;
  vec3 c = mix(s.rgb, b, 0.5 * A);
  c = satur(c, 1.0 + 0.3 * A);
  c = mix(c, c * vec3(1.1, 1.0, 0.82) + vec3(0.03, 0.01, 0.0), A);
  c = contr(c, 1.0 + 0.1 * A);
  c *= 1.0 + (rand(vec2(fr, 1.0)) - 0.5) * 0.12 * A;
  float g = rand(uv * uRes * 0.5 + fr * 3.1) + rand(uv * uRes * 0.25 + fr * 1.7) - 1.0;
  c += g * 0.09 * A;
  float gate = sdRBox((uv - 0.5) * 2.0, vec2(0.98), 0.25);
  c *= mix(1.0, 1.0 - smoothstep(-0.25, 0.02, gate), A);
  float leak = smoothstep(0.6, 1.0, noise(vec2(uTime * 0.7, 3.0))) * exp(-uv.x * 4.0);
  c = scr(c, vec3(1.0, 0.45, 0.15) * leak * 0.7 * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['super 8', 'film', 'vintage', 'aile'] }),

    fx('vhs-duraklat', 'VHS Duraklatma', [AMT(1), R('pos', 'Bant konumu', 0, 1, 0.18)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime;
  float field = step(0.5, fract(t * 15.0));
  vec2 q = uv + vec2(0.0, field * 0.004 * A);
  q.x += (noise(vec2(uv.y * 50.0, floor(t * 30.0))) - 0.5) * 0.004 * A;
  float bandY = u_pos + sin(t * 0.8) * 0.01;
  float band = 1.0 - smoothstep(0.0, 0.045, abs(uv.y - bandY));
  q.x += band * (rand(vec2(floor(uv.y * uRes.y * 0.5), floor(t * 30.0))) - 0.5) * 0.08 * A;
  vec4 c = tex(q);
  float sn = rand(floor(uv * uRes * 0.5) + floor(t * 30.0));
  c.rgb = mix(c.rgb, vec3(sn), band * 0.85 * A);
  float line = mod(floor(uv.y * uRes.y / max(1.0, uRes.y / 540.0)), 2.0);
  c.rgb *= 1.0 - line * 0.1 * A;
  c.rgb = mix(c.rgb, c.rgb * vec3(1.02, 0.98, 1.05) * 0.92 + 0.04, A);
  return c;
}`, { tags: ['vhs', 'pause', 'duraklat', 'kaset'] }),

    fx('synthwave', 'Synthwave', [AMT(0.85)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float l = luma(s.rgb);
  vec3 a = vec3(0.12, 0.02, 0.25), m = vec3(1.0, 0.18, 0.62), h = vec3(0.2, 0.95, 1.0);
  vec3 g = l < 0.5 ? mix(a, m, l * 2.0) : mix(m, h, (l - 0.5) * 2.0);
  vec3 c = mix(s.rgb, g, 0.75);
  float sl = 0.5 + 0.5 * cos(uv.y * uRes.y * 3.14159 / max(1.0, uRes.y / 360.0));
  c *= 1.0 - 0.12 * sl;
  c += vec3(1.0, 0.3, 0.7) * smoothstep(0.4, 1.0, uv.y) * 0.12;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['synthwave', 'outrun', '80ler', 'neon'] }),
  ],
}
