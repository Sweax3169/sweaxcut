// Doğa & Hava: kar, yağmur, camda yağmur, sis, ateş, şimşek, çiçek, su altı…
import { R, C, B, AMT, SPD, fx } from './lib.js'

// Düşen yaprak / taç yaprağı (şekil GLSL'i dışarıdan)
const petals = (id, name, c1, c2, size, shape, tags) => fx(id, name, [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.5), R('size', 'Boyut', 0.5, 2, size), C('color1', 'Renk 1', c1), C('color2', 'Renk 2', c2)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = s.rgb;
  vec2 P = uv * asp();
  float t = uTime * u_speed;
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = (7.0 - fl * 1.8) / u_size;
    vec2 p = P * sc;
    p.y += t * sc * (0.06 + fl * 0.03);
    p.x += t * sc * (0.04 + fl * 0.02);
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 11.0 + uSeed * 6.0);
    if (r.x > u_density) continue;
    vec2 o = (r - 0.5) * 0.5 + vec2(sin(t * 1.3 + r.y * 6.28), cos(t * 1.1 + r.x * 6.28)) * 0.08;
    vec2 d = rot(t * (1.0 + r.y * 2.0) + r.x * 6.28) * (f - o);
    d.x /= max(0.25, abs(cos(t * 1.7 + r.y * 9.0)));
    float sz = 0.13 + 0.07 * r.y;
    vec2 q = d / sz;
    ${shape}
    float aa = sc / uRes.y * 2.5 / sz;
    float m = 1.0 - smoothstep(-aa, aa, sdf);
    vec3 pc = mix(u_color1, u_color2, clamp(length(q) * 0.8 + r.y * 0.3, 0.0, 1.0)) * shade;
    col = mix(col, pc, m * (0.85 + fl * 0.05) * A);
  }
  return vec4(clamp(col, 0.0, 1.0), s.a);
}`, { tags })

export default {
  id: 'hava', name: 'Doğa & Hava',
  items: [
    fx('kar', 'Kar Yağışı', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.6), R('wind', 'Rüzgâr', -1, 1, 0.2), R('cold', 'Soğuk ton', 0, 1, 0.4)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = mix(s.rgb, s.rgb * vec3(0.92, 0.97, 1.05) + 0.03, u_cold * A);
  vec2 P = uv * asp();
  float t = uTime * u_speed;
  float snow = 0.0;
  for (int L = 0; L < 4; L++){
    float fl = float(L);
    float sc = 22.0 - fl * 5.0;
    vec2 p = P * sc;
    p.y += t * sc * (0.05 + fl * 0.03);
    p.x += sin(t * 0.6 + fl) * 0.8 + t * sc * u_wind * (0.03 + fl * 0.015);
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 19.0 + uSeed * 4.0);
    if (r.x > u_density) continue;
    vec2 o = (r - 0.5) * 0.7;
    o.x += sin(t * 1.7 + r.y * 6.28) * 0.12;
    float d = length(f - o);
    float rad = (0.06 + 0.1 * r.y) * (0.7 + fl * 0.15);
    float soft = rad * (0.4 + fl * 0.3);
    snow += (1.0 - smoothstep(rad - soft, rad, d)) * (0.55 + fl * 0.15);
  }
  col = mix(col, vec3(1.0), clamp(snow, 0.0, 1.0) * A);
  return vec4(col, s.a);
}`, { tags: ['snow', 'kış', 'kar'] }),

    fx('yagmur', 'Yağmur', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.5), R('angle', 'Eğim', -40, 40, 12, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = mix(s.rgb, s.rgb * vec3(0.8, 0.86, 0.95), 0.6 * A);
  vec2 P = rot(radians(u_angle)) * (uv * asp());
  float t = uTime * u_speed;
  float rain = 0.0;
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    vec2 sc = vec2(60.0 - fl * 15.0, 3.0 + fl);
    vec2 p = P * sc;
    float colId = floor(p.x);
    p.y += t * sc.y * (1.4 + fl * 0.5) + rand(vec2(colId, fl)) * 10.0;
    vec2 id = floor(p); vec2 f = fract(p);
    if (rand(id + fl * 3.3 + uSeed) > u_density) continue;
    float x = 0.2 + 0.6 * rand(id + 1.7);
    float w = 0.06 + fl * 0.03;
    float len = 0.3 + 0.3 * rand(id + 4.1);
    float m = (1.0 - smoothstep(w * 0.4, w, abs(f.x - x))) * smoothstep(0.0, len * 0.3, f.y) * (1.0 - smoothstep(len * 0.6, len, f.y));
    rain += m * (0.35 + fl * 0.2);
  }
  col += vec3(0.75, 0.82, 0.9) * clamp(rain, 0.0, 1.0) * A;
  return vec4(clamp(col, 0.0, 1.0), s.a);
}`, { tags: ['rain', 'yağmur', 'fırtına'] }),

    fx('camda-yagmur', 'Camda Yağmur', [AMT(1), SPD(1), R('scale', 'Damla ölçeği', 1, 6, 3), R('fog', 'Buğu', 0, 2, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec2 P = uv * asp() * u_scale;
  vec2 off = vec2(0.0); float wet = 0.0;
  vec2 g = P * 4.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  vec2 r = h22(id + uSeed);
  vec2 d = f - (r - 0.5) * 0.6;
  float rad = 0.08 + 0.12 * fract(r.x * 7.3);
  float life = fract(t * 0.15 + r.y);
  float m = (1.0 - smoothstep(rad * 0.75, rad, length(d))) * step(0.35, r.x) * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.85, 1.0, life));
  off += d / rad * m * 0.6; wet = max(wet, m);
  float dark = smoothstep(rad * 0.45, rad * 0.95, length(d)) * m;
  float hl = (1.0 - smoothstep(0.0, rad * 0.28, length(d - vec2(-0.3, 0.35) * rad))) * m;
  vec2 g2 = P * vec2(2.5, 1.0);
  float cr = rand(vec2(floor(g2.x), 3.1 + uSeed));
  float sp = 0.25 + 0.3 * cr;
  float yd = (1.0 - fract(t * sp * 0.25 + cr * 5.0)) * u_scale * 1.3 - 0.15 * u_scale;
  float lx = (fract(g2.x) - 0.5 + sin(g2.y * 9.0 + cr * 20.0) * 0.08) / 2.5;
  vec2 dd = vec2(lx, g2.y - yd);
  float rad2 = 0.035 + 0.025 * cr;
  float on = step(0.3, cr);
  float m2 = (1.0 - smoothstep(rad2 * 0.8, rad2, length(dd * vec2(1.0, 0.8)))) * on;
  float above = g2.y - yd;
  float trail = (1.0 - smoothstep(0.004, 0.012, abs(lx))) * step(0.0, above) * (1.0 - smoothstep(0.0, 0.5, above)) * on;
  vec2 td = vec2(lx, (fract(above * 12.0) - 0.5) / 12.0);
  float tdm = (1.0 - smoothstep(0.01, 0.02, length(td))) * trail;
  off += dd / rad2 * m2 * 0.8 + td / 0.02 * tdm * 0.3;
  wet = max(wet, max(m2, max(tdm, trail * 0.3)));
  dark = max(dark, smoothstep(rad2 * 0.45, rad2 * 0.95, length(dd * vec2(1.0, 0.8))) * m2);
  hl = max(hl, (1.0 - smoothstep(0.0, rad2 * 0.3, length(dd - vec2(-0.3, 0.3) * rad2))) * m2);
  vec4 s = tex(uv);
  vec4 bl = disk(uv, px() * 18.0 * u_fog);
  vec4 sh = tex(uv - off * 0.035);
  vec3 c = mix(bl.rgb * 0.85 + 0.06, sh.rgb, clamp(wet, 0.0, 1.0));
  c = c * (1.0 - dark * 0.4) + hl * 0.55;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['rain on glass', 'cam', 'damla', 'pencere'] }),

    fx('sis', 'Sis', [AMT(0.7), SPD(1), R('low', 'Yerde yoğun', 0, 1, 0.6), C('color', 'Sis rengi', '#d8dde3')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  float f1 = fbm(P * 2.0 + vec2(t * 0.12, t * 0.03));
  float f2 = fbm(P * 4.0 - vec2(t * 0.2, -t * 0.05) + f1);
  float fog = smoothstep(0.25, 0.85, f1 * 0.6 + f2 * 0.5);
  float hgt = mix(1.0, 1.0 - smoothstep(0.1, 0.9, uv.y), u_low);
  fog = clamp(fog * hgt * 1.2 + 0.15 * hgt, 0.0, 1.0);
  vec3 c = mix(s.rgb, u_color, fog * A);
  c = mix(c, satur(c, 0.7), A * 0.5);
  return vec4(c, s.a);
}`, { tags: ['fog', 'mist', 'pus', 'duman'] }),

    fx('isi-dalgasi', 'Isı Dalgası', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float m = mix(1.0, 1.0 - smoothstep(0.0, 0.8, uv.y), 0.6);
  vec2 n = vec2(noise(vec2(uv.x * 25.0, uv.y * 12.0 - t * 3.0)), noise(vec2(uv.x * 22.0 + 5.0, uv.y * 10.0 - t * 2.6))) - 0.5;
  vec4 c = tex(uv + n * 0.012 * A * m);
  c.rgb = mix(c.rgb, c.rgb * vec3(1.08, 1.0, 0.88), 0.5 * A);
  return c;
}`, { tags: ['heat haze', 'sıcak', 'çöl', 'serap'] }),

    fx('alevli-kenar', 'Alevli Kenarlar', [AMT(1), SPD(1), R('height', 'Alev yüksekliği', 0.05, 0.6, 0.25), B('edges', 'Bütün kenarlar', false)], `
vec3 fireRamp(float x){ x = clamp(x, 0.0, 1.0); return vec3(smoothstep(0.0, 0.4, x), smoothstep(0.25, 0.75, x), smoothstep(0.6, 1.0, x)); }
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float d = uv.y;
  if (u_edges > 0.5) d = min(d, min(min(uv.x, 1.0 - uv.x) * ar() * 0.9, 1.0 - uv.y));
  vec2 P = uv * asp();
  float n = fbm(vec2(P.x * 5.0, P.y * 3.5 - t * 2.2)) * 0.7 + fbm(vec2(P.x * 11.0, P.y * 7.0 - t * 4.0)) * 0.35;
  float f = pow(clamp((n - d / u_height * 0.9) * 2.2, 0.0, 1.0), 1.3);
  float heat = 1.0 - smoothstep(0.0, u_height * 2.0, d);
  vec2 hz = (vec2(noise(vec2(P.x * 20.0, P.y * 10.0 - t * 4.0)), noise(vec2(P.x * 18.0 + 3.0, P.y * 9.0 - t * 3.5))) - 0.5) * 0.015;
  vec4 s = tex(uv + hz * heat * A);
  vec3 c = s.rgb + fireRamp(f * 1.2) * 1.3 * A;
  c = mix(c, c * vec3(1.1, 0.95, 0.8), heat * 0.5 * A);
  return vec4(clamp(c, 0.0, 1.0), max(s.a, clamp(f * A, 0.0, 1.0)));
}`, { tags: ['fire', 'ateş', 'alev', 'yangın'] }),

    fx('simsek', 'Şimşek', [AMT(1), R('period', 'Aralık (sn)', 0.5, 6, 1.6, 0.1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float per = max(u_period, 0.5);
  float k = floor(uTime / per);
  float p = fract(uTime / per);
  float st = smoothstep(0.68, 0.7, p) * (1.0 - smoothstep(0.7, 0.98, p));
  float f = st * (0.6 + 0.4 * step(0.5, fract(uTime * 22.0)));
  float x0 = 0.25 + 0.5 * rand(vec2(k, uSeed));
  float yEnd = 0.15 + 0.35 * rand(vec2(k, 2.0));
  float bx = x0 + (fbm(vec2(uv.y * 5.0, k * 3.7)) - 0.5) * 0.35 + (noise(vec2(uv.y * 40.0, k)) - 0.5) * 0.03;
  float dx = abs(uv.x - bx) * ar();
  float bolt = (exp(-dx * 600.0) + exp(-dx * 60.0) * 0.35) * step(yEnd, uv.y);
  float bx2 = bx + (uv.y - 0.6) * (rand(vec2(k, 5.0)) - 0.5) * 1.4 + (noise(vec2(uv.y * 30.0, k + 9.0)) - 0.5) * 0.04;
  bolt += exp(-abs(uv.x - bx2) * ar() * 900.0) * step(0.35, uv.y) * step(uv.y, 0.62) * 0.7;
  vec3 c = s.rgb * mix(1.0, 0.72, A) * mix(vec3(1.0), vec3(0.9, 0.95, 1.08), A);
  c = mix(c, c * 2.2 + vec3(0.25, 0.3, 0.45), f * 0.7 * A);
  c += vec3(0.75, 0.85, 1.0) * bolt * f * 1.5 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['lightning', 'fırtına', 'yıldırım'] }),

    petals('kiraz-cicegi', 'Kiraz Çiçekleri', '#ffd6e4', '#ff8fb3', 1, `
    float e = length(q * vec2(1.0, 1.6)) - 1.0;
    float notch = length(q - vec2(1.05, 0.0)) - 0.32;
    float sdf = max(e, -notch);
    float shade = 1.0;`, ['sakura', 'çiçek', 'bahar', 'pembe']),

    petals('sonbahar-yapraklari', 'Sonbahar Yaprakları', '#ffb02e', '#b5401b', 1.4, `
    float sdf = pow(abs(q.x), 1.4) + pow(abs(q.y) * 2.0, 1.4) - 1.0;
    float shade = 1.0 - (1.0 - smoothstep(0.0, 0.08, abs(q.y))) * 0.35;`, ['autumn', 'yaprak', 'sonbahar', 'güz']),

    fx('toz', 'Toz Zerreleri', [AMT(1), SPD(1), C('color', 'Renk', '#ffe7b8')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  float t = uTime * u_speed;
  vec3 dust = vec3(0.0);
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 9.0 - fl * 2.5;
    vec2 p = P * sc + vec2(t * 0.15, t * 0.05) * (1.0 + fl);
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 5.3 + uSeed);
    if (r.x > 0.55) continue;
    vec2 o = (r - 0.5) * 0.6 + vec2(sin(t * 0.7 + r.y * 6.28), cos(t * 0.5 + r.x * 6.28)) * 0.15;
    float rad = 0.03 + 0.06 * r.y * (1.0 + fl * 0.6);
    float m = 1.0 - smoothstep(rad * (0.3 + fl * 0.25), rad, length(f - o));
    dust += u_color * m * (0.3 + 0.7 * (0.5 + 0.5 * sin(t * 2.0 + r.x * 20.0))) * (0.8 + fl * 0.4);
  }
  return vec4(scr(s.rgb, clamp(dust * (0.4 + 0.6 * luma(s.rgb)) * A, 0.0, 1.0)), s.a);
}`, { tags: ['dust', 'toz', 'zerre', 'bokeh'] }),

    fx('su-alti', 'Su Altı', [AMT(0.9), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec2 q = uv + vec2(sin(uv.y * 10.0 + t * 1.5), cos(uv.x * 8.0 + t * 1.2)) * 0.004 * A;
  vec4 s = tex(q);
  vec2 P = uv * asp() * 3.0;
  vec2 w = P + vec2(fbm(P * 0.7 + t * 0.25), fbm(P * 0.7 - t * 0.2 + 3.0)) * 0.9;
  float c1 = 1.0 - smoothstep(0.0, 0.09, voro(w + vec2(t * 0.1, 0.0)).y);
  float c2 = 1.0 - smoothstep(0.0, 0.07, voro(w * 1.6 - vec2(0.0, t * 0.12) + 5.0).y);
  float caus = (c1 * 0.6 + c2 * 0.4) * (0.4 + 0.6 * uv.y) * 0.55;
  vec3 c = s.rgb * vec3(0.55, 0.85, 1.0) * mix(0.8, 1.05, uv.y) + vec3(0.0, 0.06, 0.1);
  c += vec3(0.6, 0.9, 1.0) * caus * 0.5;
  float rays = pow(max(0.0, sin((uv.x + uv.y * 0.3) * 18.0 + t * 0.5) * sin((uv.x - uv.y * 0.2) * 7.0 - t * 0.3)), 3.0) * smoothstep(0.3, 1.0, uv.y);
  c += vec3(0.5, 0.8, 1.0) * rays * 0.12;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['underwater', 'deniz', 'havuz', 'kostik'] }),

    fx('gun-batimi', 'Gün Batımı Işıltısı', [AMT(0.8), R('x', 'Güneş X', 0, 1, 0.7)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 top = vec3(1.0, 0.45, 0.25), mid = vec3(1.0, 0.65, 0.35), bot = vec3(0.45, 0.25, 0.55);
  vec3 grad = uv.y > 0.5 ? mix(mid, top, (uv.y - 0.5) * 2.0) : mix(bot, mid, uv.y * 2.0);
  vec3 c = mix(s.rgb, sft(s.rgb, grad), 0.85 * A);
  vec2 sp = (uv - vec2(u_x, 0.72 + 0.02 * sin(uTime * 0.5))) * asp();
  c = scr(c, vec3(1.0, 0.7, 0.35) * (exp(-length(sp) * 5.0) + exp(-length(sp) * 1.5) * 0.25) * A);
  c = mix(c, c * vec3(1.06, 0.98, 0.9), A * 0.5);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['sunset', 'akşam', 'altın saat', 'güneş'] }),

    fx('kivilcim', 'Kıvılcımlar', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  float t = uTime * u_speed;
  vec3 em = vec3(0.0);
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 10.0 - fl * 2.5;
    vec2 p = P * sc;
    p.y -= t * sc * (0.12 + fl * 0.05);
    p.x += sin(p.y * 0.8 + t + fl) * 0.4;
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 9.1 + uSeed * 2.0);
    if (r.x > u_density) continue;
    vec2 d = f - ((r - 0.5) * 0.6 + vec2(sin(t * 3.0 + r.y * 6.28), 0.0) * 0.1);
    d.y *= 0.45;
    float rad = 0.04 + 0.05 * r.y;
    float m = exp(-length(d) / rad * 1.6);
    float life = 1.0 - smoothstep(0.3, 1.0, uv.y);
    em += mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.4), r.y) * m * (0.6 + 0.4 * sin(t * 12.0 + r.x * 30.0)) * (0.6 + 0.4 * life);
  }
  em += vec3(1.0, 0.3, 0.05) * (1.0 - smoothstep(0.0, 0.35, uv.y)) * 0.25;
  vec3 c = s.rgb + em * A;
  return vec4(clamp(c, 0.0, 1.0), max(s.a, clamp(luma(em) * A, 0.0, 1.0)));
}`, { tags: ['embers', 'kıvılcım', 'ateş', 'kor'] }),
  ],
}
