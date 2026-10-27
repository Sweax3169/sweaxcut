// Oyun: vuruş flaşı, hasar, düşük can, killcam, dürbün, gece görüşü, termal, matrix…
import { R, C, B, S, AMT, SPD, PER, fx } from './lib.js'

export default {
  id: 'oyun', name: 'Oyun',
  items: [
    fx('vurus-flasi', 'Vuruş Flaşı', [AMT(1), PER(1.2), C('color', 'Flaş rengi', '#ffffff')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.2);
  float k = floor(uTime / per);
  float p = mod(uTime, per);
  float fl = exp(-p * 16.0);
  float sh = exp(-p * 10.0);
  float ang = rand(vec2(k, uSeed)) * 6.2832;
  vec2 o = vec2(cos(ang), sin(ang)) * sin(p * 80.0) * sh * 0.03 * A;
  vec2 q = 0.5 + (uv - 0.5) / (1.0 + 0.05 * A * sh) + o;
  vec2 ca = (q - 0.5) * 0.02 * A * sh;
  vec4 c = tex(q);
  c.r = tex(q + ca).r; c.b = tex(q - ca).b;
  c.rgb = mix(c.rgb, u_color, fl * 0.85 * A);
  return c;
}`, { tags: ['hit', 'vuruş', 'flaş', 'darbe'] }),

    fx('hasar-vinyeti', 'Hasar Vinyeti', [AMT(0.85), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  float r = length((uv - 0.5) * 2.0 * vec2(0.9, 1.0));
  float n = fbm(uv * 4.0 + t * 0.15) * 0.45 + fbm(uv * 12.0 - t * 0.1) * 0.15;
  float pulse = 0.65 + 0.35 * sin(t * 6.0);
  float v = smoothstep(0.55, 1.35, r + n * 0.6 - 0.2);
  float veins = pow(ridge(uv * 9.0 + n * 2.0), 8.0) * smoothstep(0.6, 1.3, r);
  float m = clamp((v + veins * 0.5) * pulse, 0.0, 1.0);
  vec3 blood = mix(vec3(0.35, 0.0, 0.02), vec3(0.85, 0.05, 0.05), n + 0.3);
  vec3 c = mix(s.rgb, blood * (0.5 + 0.5 * luma(s.rgb)) + blood * 0.4, m * A);
  c = mix(c, c * vec3(1.15, 0.85, 0.85), 0.25 * A * pulse);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['damage', 'hasar', 'kan', 'kırmızı'] }),

    fx('dusuk-can', 'Düşük Can', [AMT(0.9), R('bpm', 'Nabız (BPM)', 50, 180, 100, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float p = fract(uTime * u_bpm / 60.0);
  float e = exp(-p * 10.0) + exp(-max(p - 0.22, 0.0) * 10.0) * 0.7 * step(0.22, p);
  vec2 q = 0.5 + (uv - 0.5) / (1.0 + 0.025 * A * e);
  vec4 s = tex(q);
  float l = luma(s.rgb);
  float redness = smoothstep(0.1, 0.4, s.r - max(s.g, s.b));
  vec3 c = mix(s.rgb, vec3(l), A * 0.85 * (1.0 - redness));
  vec4 b = disk(q, px() * 10.0);
  float edge = 1.0 - vig(uv, 0.35, 1.5);
  c = mix(c, mix(b.rgb, vec3(luma(b.rgb)), 0.85), edge * 0.6 * A);
  c = mix(c, vec3(0.8, 0.0, 0.0) * (0.3 + l), edge * (0.35 + 0.5 * e) * A);
  c *= 1.0 - 0.15 * A * e * edge;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['low hp', 'can', 'kalp atışı', 'ölüyor'] }),

    fx('kafadan-vurus', 'Kafadan Vuruş', [AMT(1), PER(1.25), R('zoom', 'Zoom', 0.1, 1, 0.45), R('cx', 'Hedef X', 0, 1, 0.5), R('cy', 'Hedef Y', 0, 1, 0.55)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.3);
  float p = mod(uTime, per);
  float z = 1.0 + u_zoom * A * eob(p * 6.0) * (1.0 - smoothstep(0.45, 0.9, p / per));
  vec2 c0 = vec2(u_cx, u_cy);
  vec2 q = c0 + (uv - c0) / z;
  float vel = exp(-p * 8.0) * A;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 10; i++){ float f = float(i) / 9.0; acc += pm(tx(c0 + (q - c0) * (1.0 - f * 0.12 * vel))); }
  vec4 c = unpm(acc, 10.0);
  vec2 ca = (q - c0) * 0.025 * vel;
  c.r = mix(c.r, tex(q + ca).r, 0.8); c.b = mix(c.b, tex(q - ca).b, 0.8);
  c.rgb = mix(c.rgb, vec3(1.0, 0.95, 0.9), exp(-p * 18.0) * 0.6 * A);
  c.rgb = mix(c.rgb, c.rgb * vec3(1.2, 0.75, 0.7), (1.0 - vig(uv, 0.4, 1.4)) * vel * 0.8);
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`, { tags: ['headshot', 'zoom', 'kafa', 'fps'] }),

    fx('killcam', 'Killcam', [AMT(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 q = 0.5 + (uv - 0.5) / (1.0 + 0.12 * A * smoothstep(0.0, 1.0, uProgress));
  vec2 d = q - 0.5;
  vec2 ca = d * dot(d, d) * 0.12 * A;
  vec4 s = tex(q);
  vec3 c = vec3(tex(q + ca).r, s.g, tex(q - ca).b);
  c = mix(c, vec3(luma(c)), 0.7 * A);
  c = mix(c, c * vec3(1.15, 0.92, 0.85) + vec3(0.04, 0.0, 0.0), A);
  c = contr(c, 1.0 + 0.2 * A);
  c *= mix(1.0, vig(uv, 0.25, 1.4), 0.9 * A);
  float sl = 0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159 / max(1.0, uRes.y / 360.0));
  c *= 1.0 - 0.08 * sl * A;
  c += (rand(uv * uRes + fract(uTime * 9.0) * 40.0) - 0.5) * 0.05 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['killcam', 'tekrar', 'ölüm', 'replay'], previewDuration: 3 }),

    fx('donma-patlama', 'Donma Patlaması', [AMT(1), PER(2)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.3);
  float p = mod(uTime, per);
  float k = floor(uTime / per);
  vec2 q = 0.5 + (uv - 0.5) / (1.0 + 0.08 * A * eob(p * 8.0));
  vec4 s = tex(q);
  vec3 c = contr(satur(s.rgb, 1.0 - 0.3 * A), 1.0 + 0.35 * A);
  vec2 P = cp(uv);
  float r = length(P);
  float cell = atan(P.y, P.x) / 6.28318 * 48.0;
  float rr = rand(vec2(floor(cell), k));
  float w = (0.15 + 0.3 * rr) * smoothstep(0.15, 0.9, r);
  float line = 1.0 - smoothstep(w * 0.6, w, abs(fract(cell) - 0.5));
  float inner = 0.28 + 0.2 * rr;
  float m = line * smoothstep(inner, inner + 0.12, r) * step(0.35, rr);
  float fl = exp(-p * 10.0);
  c = mix(c, vec3(1.0), m * A * (0.65 + 0.35 * fl));
  c = mix(c, vec3(1.0), fl * 0.7 * A);
  return vec4(c, s.a);
}`, { tags: ['freeze frame', 'patlama', 'anime', 'komik'] }),

    fx('hiz-cizgileri', 'Hız Çizgileri', [AMT(1), R('count', 'Çizgi sayısı', 30, 200, 90, 1), R('inner', 'Boş merkez', 0.05, 0.6, 0.25), SPD(1), C('color', 'Renk', '#ffffff')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = cp(uv);
  float r = length(P);
  float fr = floor(uTime * u_speed * 14.0);
  float cell = atan(P.y, P.x) / 6.28318 * u_count;
  float cid = floor(cell);
  float rr = rand(vec2(cid, fr + uSeed * 10.0));
  float len = u_inner + rand(vec2(cid + 31.0, fr)) * 0.25;
  float w = (0.1 + 0.4 * rr) * smoothstep(len, len + 0.5, r);
  float line = 1.0 - smoothstep(w * 0.5, w, abs(fract(cell) - 0.5));
  float m = line * step(0.3, rr) * smoothstep(len, len + 0.05, r) * A;
  return vec4(mix(s.rgb, u_color, m), max(s.a, m));
}`, { tags: ['speed lines', 'anime', 'manga', 'hız'] }),

    fx('gece-gorusu', 'Gece Görüşü', [AMT(1), R('gain', 'Kazanç', 0.5, 3, 1.6), B('goggles', 'Dürbün maskesi', false)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime;
  vec4 s = tex(uv);
  vec2 d = px() * 3.0;
  vec3 b = (tex(uv + d).rgb + tex(uv - d).rgb + tex(uv + vec2(d.x, -d.y)).rgb + tex(uv - vec2(d.x, -d.y)).rgb) * 0.25;
  float l = pow(max(luma(s.rgb) * 0.7 + luma(b) * 0.5, 0.0) * u_gain, 0.8);
  l += (rand(uv * uRes + fract(t * 11.0) * 77.0) - 0.5) * 0.2;
  l *= 0.92 + 0.08 * sin(uv.y * uRes.y * 1.2);
  l *= 0.95 + 0.05 * rand(vec2(floor(t * 20.0), 1.0));
  vec3 c = vec3(0.1, 1.0, 0.25) * l + vec3(0.0, 0.05, 0.0);
  c = mix(c, vec3(0.8, 1.0, 0.85), smoothstep(0.85, 1.2, l) * 0.6);
  vec2 P = cp(uv);
  float tube = vig(uv, 0.5, 1.5);
  if (u_goggles > 0.5) tube = 1.0 - smoothstep(0.4, 0.47, min(length(P - vec2(-0.36, 0.0)), length(P - vec2(0.36, 0.0))));
  c *= tube;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['night vision', 'gece', 'askeri', 'yeşil'] }),

    fx('termal', 'Termal Kamera', [AMT(1), S('pal', 'Palet', [['demir', 'Demir (sıcak)'], ['gokkusagi', 'Gökkuşağı'], ['beyaz', 'Beyaz-sıcak']]), R('contrast', 'Kontrast', 0.5, 2.5, 1.3)], `
vec3 iron(float x){
  x = clamp(x, 0.0, 1.0);
  if (x < 0.2) return mix(vec3(0.0, 0.0, 0.05), vec3(0.25, 0.0, 0.55), x / 0.2);
  if (x < 0.45) return mix(vec3(0.25, 0.0, 0.55), vec3(0.8, 0.05, 0.45), (x - 0.2) / 0.25);
  if (x < 0.7) return mix(vec3(0.8, 0.05, 0.45), vec3(1.0, 0.45, 0.0), (x - 0.45) / 0.25);
  if (x < 0.9) return mix(vec3(1.0, 0.45, 0.0), vec3(1.0, 0.9, 0.2), (x - 0.7) / 0.2);
  return mix(vec3(1.0, 0.9, 0.2), vec3(1.0, 1.0, 0.95), (x - 0.9) / 0.1);
}
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec4 b = disk(uv, px() * 4.0);
  float l = luma(b.rgb) * 0.8 + luma(s.rgb) * 0.2;
  l = clamp((l - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  l += (noise(uv * uRes * 0.3 + uTime * 5.0) - 0.5) * 0.04;
  vec3 c;
  if (u_pal < 0.5) c = iron(l);
  else if (u_pal < 1.5) c = hsv2rgb(vec3(0.7 * (1.0 - clamp(l, 0.0, 1.0)), 1.0, 0.25 + 0.75 * smoothstep(0.0, 0.3, l)));
  else c = vec3(pow(clamp(l, 0.0, 1.0), 1.2));
  return vec4(mix(s.rgb, c, u_amount * uIntensity), s.a);
}`, { tags: ['thermal', 'ısı', 'kızılötesi', 'predator'] }),

    fx('durbun', 'Keskin Nişancı Dürbünü', [AMT(1), R('radius', 'Dürbün boyutu', 0.2, 0.5, 0.42), R('zoom', 'Yakınlaştırma', 1, 4, 2), R('sway', 'Nefes salınımı', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime;
  vec2 sway = vec2(sin(t * 0.9) * 0.012, sin(t * 1.3 + 1.0) * 0.008) * u_sway;
  vec2 P = cp(uv) - sway;
  float r = length(P);
  float R0 = u_radius;
  float k = r / R0;
  vec2 q = P / u_zoom * (1.0 - 0.18 * k * k);
  vec2 quv = q * sn() / asp() + 0.5;
  vec2 ca = q * 0.02 * k * k * sn() / asp();
  vec4 s = tex(quv);
  vec3 c = vec3(tex(quv + ca).r, s.g, tex(quv - ca).b);
  c *= 1.0 - 0.45 * smoothstep(0.6, 1.0, k);
  float lw = 0.0025;
  float crs = (1.0 - smoothstep(lw * 0.5, lw, abs(P.x))) + (1.0 - smoothstep(lw * 0.5, lw, abs(P.y)));
  float gap = smoothstep(0.02, 0.025, r);
  float thick = (1.0 - smoothstep(0.006, 0.008, abs(P.x))) * step(R0 * 0.55, abs(P.y)) + (1.0 - smoothstep(0.006, 0.008, abs(P.y))) * step(R0 * 0.55, abs(P.x));
  float ticks = 0.0;
  for (int i = 1; i <= 4; i++){
    float fi = float(i) * R0 * 0.11;
    ticks += (1.0 - smoothstep(0.003, 0.0045, length(vec2(abs(P.x) - fi, P.y)))) + (1.0 - smoothstep(0.003, 0.0045, length(vec2(P.x, abs(P.y) - fi))));
  }
  c = mix(c, vec3(0.02), clamp(crs * gap + thick + ticks, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.1, 0.05), 1.0 - smoothstep(0.003, 0.0045, r));
  float inside = 1.0 - smoothstep(R0 - 0.004, R0, r);
  float ring = (1.0 - smoothstep(0.0, 0.012, abs(r - R0))) * 0.6;
  vec3 res = mix(vec3(0.0), c, inside);
  res = mix(res, vec3(0.08), ring * (1.0 - inside));
  vec4 o = tex(uv);
  return vec4(mix(o.rgb, res, A), mix(o.a, mix(1.0, s.a, inside), A));
}`, { tags: ['sniper', 'scope', 'dürbün', 'nişan'] }),

    fx('matrix-yagmuru', 'Hacker Matrix', [AMT(1), R('cols', 'Sütun sayısı', 20, 120, 48, 1), SPD(1)], `
const vec4 SEG[12] = vec4[12](
  vec4(-0.3, 0.45, 0.3, 0.45), vec4(-0.3, 0.0, 0.3, 0.0), vec4(-0.3, -0.45, 0.3, -0.45),
  vec4(-0.3, 0.45, -0.3, 0.0), vec4(-0.3, 0.0, -0.3, -0.45), vec4(0.3, 0.45, 0.3, 0.0), vec4(0.3, 0.0, 0.3, -0.45),
  vec4(0.0, 0.45, 0.0, 0.0), vec4(0.0, 0.0, 0.0, -0.45), vec4(-0.3, 0.45, 0.0, 0.0), vec4(0.3, 0.45, 0.0, 0.0), vec4(0.0, 0.0, 0.3, -0.45));
// 12 parçalı rastgele karakter (bits: 0..4095)
float glyph(vec2 f, float bits){
  vec2 p = (f - 0.5) * vec2(1.0, 1.0);
  float d = 1e3;
  for (int i = 0; i < 12; i++){
    if (mod(floor(bits / exp2(float(i))), 2.0) > 0.5) d = min(d, sdSeg(p, SEG[i].xy, SEG[i].zw));
  }
  return 1.0 - smoothstep(0.06, 0.11, d);
}
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float cw = 1.0 / u_cols;
  float ch = cw * ar() * 1.4;
  vec2 g = vec2(uv.x / cw, (1.0 - uv.y) / ch);
  vec2 id = floor(g); vec2 f = fract(g);
  float rows = 1.0 / ch;
  float cr = rand(vec2(id.x, 7.0 + uSeed));
  float sp = (4.0 + cr * 10.0) * u_speed;
  float head = mod(uTime * sp + cr * 80.0, rows + 25.0);
  float dist = head - id.y;
  float trail = 12.0 + cr * 14.0;
  float bright = (dist >= 0.0 && dist < trail) ? pow(1.0 - dist / trail, 1.6) : 0.0;
  float isHead = step(0.0, dist) * step(dist, 1.0);
  vec2 fs = (f - vec2(0.12, 0.08)) / vec2(0.76, 0.84);
  float inside = step(0.0, fs.x) * step(fs.x, 1.0) * step(0.0, fs.y) * step(fs.y, 1.0);
  float glyphT = floor(uTime * (2.0 + cr * 6.0) + rand(id) * 10.0);
  float bit = glyph(fs, floor(rand(id * 1.31 + glyphT * 0.71) * 4095.0));
  float img = luma(s.rgb);
  vec3 bg = s.rgb * 0.25 * vec3(0.5, 1.0, 0.6);
  vec3 glyph = mix(vec3(0.1, 0.9, 0.35), vec3(0.85, 1.0, 0.9), isHead) * bit * inside * bright * (0.5 + 0.8 * img);
  vec3 c = mix(s.rgb, bg, A) + glyph * 1.4 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['matrix', 'hacker', 'kod', 'yeşil'] }),

    fx('hata-yeniden', 'Hata: Yeniden Doğma', [AMT(1), PER(3)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.4);
  float p = mod(uTime, per);
  float k = floor(uTime / per);
  float e = (1.0 - smoothstep(0.0, per * 0.85, p)) * A;
  float ft = floor(uTime * 24.0);
  vec2 blk = floor(uv * vec2(4.0, 18.0));
  float on = step(1.0 - e * 0.8, rand(blk + ft + k));
  vec2 q = uv + vec2((rand(blk * 1.7 + ft) - 0.5) * 0.3 * on * e, 0.0);
  q.y += (rand(vec2(ft, 3.0)) - 0.5) * 0.06 * e * step(0.7, rand(vec2(ft, 9.0)));
  vec4 s = tex(q);
  float sh = 0.04 * e;
  vec3 c = vec3(tex(q + vec2(sh, 0.0)).r, s.g, tex(q - vec2(sh, 0.0)).b);
  c = mix(c, vec3(luma(c)) * vec3(0.9, 1.0, 1.1), e);
  c *= 1.0 - step(0.5, fract(uTime * 12.0)) * step(p, per * 0.25) * 0.6 * A;
  c += step(0.97, rand(vec2(floor(uv.y * 200.0), ft))) * e * 0.6;
  c *= 1.0 - e * 0.25 * (0.5 + 0.5 * sin(uv.y * uRes.y * 2.0));
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['respawn', 'error', 'hata', 'glitch'] }),

    fx('seviye-atla', 'Seviye Atlama', [AMT(1), PER(2), C('color', 'Renk', '#ffd447')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.4);
  float p = mod(uTime, per) / per;
  vec4 s = tex(uv);
  vec2 P = (uv - vec2(0.5, 0.42)) * asp() / sn();
  float r = length(P); float a = atan(P.y, P.x);
  float burst = eoc(p * 2.0);
  float fade = 1.0 - smoothstep(0.5, 1.0, p);
  float rays = pow(max(0.0, sin(a * 12.0 + p * 4.0)), 3.0) * (1.0 - smoothstep(0.0, 0.9 * burst + 0.05, r)) * fade;
  float ring = exp(-pow((r - burst * 0.7) * 18.0, 2.0)) * fade;
  vec3 c = scr(s.rgb, clamp(u_color * (rays * 0.55 + ring * 0.8) * A, 0.0, 1.0));
  c = scr(c, u_color * exp(-r * 3.0) * fade * 0.6 * A);
  vec2 G = uv * asp() * 10.0; G.y -= p * 6.0;
  vec2 id = floor(G); vec2 f = fract(G) - 0.5;
  vec2 rr = h22(id + floor(uTime / per) * 7.0);
  float sp = step(0.8, rr.x) * exp(-length(f - (rr - 0.5) * 0.5) * 25.0) * fade * smoothstep(0.0, 0.2, p);
  c += u_color * sp * 1.5 * A;
  c *= 1.0 + 0.2 * A * exp(-p * 8.0);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['level up', 'seviye', 'altın', 'başarı'] }),

    fx('guc-aurasi', 'Güç Aurası', [AMT(1), SPD(1), R('size', 'Hale boyutu', 4, 60, 24, 1), C('color', 'Renk', '#7cf8ff'), B('rainbow', 'Gökkuşağı', true)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  float dil = 0.0;
  vec2 rr = px() * u_size;
  for (int i = 0; i < 12; i++){
    float a = float(i) / 12.0 * 6.28318 + t * 0.5;
    vec2 dir = vec2(cos(a), sin(a));
    float flick = 0.75 + 0.25 * noise(vec2(float(i) * 1.7, t * 4.0));
    for (int j = 1; j <= 3; j++){ float fj = float(j) / 3.0; dil = max(dil, tx(uv + dir * rr * fj * flick).a * (1.15 - fj)); }
  }
  float outer = clamp(dil - s.a, 0.0, 1.0);
  float e = smoothstep(0.15, 0.8, sobel(uv, px() * 3.0)) * s.a;
  vec2 q = abs(uv - 0.5) * 2.0;
  float border = smoothstep(0.75, 1.0, max(q.x, q.y)) * s.a;
  float flow = 0.6 + 0.4 * noise(vec2(uv.x * 8.0, uv.y * 8.0 - t * 3.0));
  float aura = max(outer, max(e * 0.8, border * 0.9)) * flow;
  vec3 col = mix(u_color, rainbow(uv.y * 0.8 - t * 0.4 + uv.x * 0.3), u_rainbow);
  vec3 c = s.rgb * s.a + col * aura * 1.3 * A;
  float aOut = clamp(s.a + outer * flow * A, 0.0, 1.0);
  return vec4(clamp(c / max(aOut, 1e-4), 0.0, 1.0), aOut);
}`, { tags: ['aura', 'power up', 'güç', 'hale'] }),

    fx('piksel-cozunme', 'Piksel Çözülme', [S('mode', 'Mod', [['cikis', 'Dağıl (çıkış)'], ['giris', 'Toplan (giriş)'], ['dongu', 'Döngü']]), AMT(1), R('size', 'Blok ölçeği', 0.5, 3, 1), PER(2)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float p;
  if (u_mode < 0.5) p = uProgress;
  else if (u_mode < 1.5) p = 1.0 - uProgress;
  else p = 0.5 - 0.5 * cos(uTime * 6.28318 / max(u_period, 0.2));
  p = clamp(p * A, 0.0, 1.0);
  vec2 cell = px() * mix(4.0, 48.0, p) * u_size;
  vec2 g = floor((uv - 0.5) / cell);
  vec4 c = mix(tex(uv), tex((g + 0.5) * cell + 0.5), smoothstep(0.0, 0.15, p));
  float r = rand(g + uSeed);
  float gone = step(r, p * 1.15 - 0.1);
  c.rgb += vec3(0.5, 0.9, 1.0) * step(r, p * 1.15 - 0.02) * (1.0 - gone) * 0.6;
  return vec4(clamp(c.rgb, 0.0, 1.0) * (1.0 - gone), c.a * (1.0 - gone));
}`, { tags: ['dissolve', 'piksel', 'ışınlanma', 'çözülme'] }),

    fx('elendin', 'Elendin', [AMT(1), R('dur', 'Geçiş süresi (sn)', 0.2, 4, 1.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float k = smoothstep(0.0, u_dur, uTime);
  vec2 p = rot(0.03 * A * eoc(k)) * ((uv - 0.5) * asp()) / (1.0 + 0.15 * A * eoc(k));
  vec2 q = p / asp() + 0.5;
  vec4 s = tex(q);
  vec3 c = mix(s.rgb, disk(q, px() * 6.0 * k * A).rgb, 0.5 * k);
  c = mix(c, vec3(luma(c)) * vec3(1.05, 0.95, 0.92), k * A);
  c = contr(c, 1.0 + 0.25 * k * A);
  c *= 1.0 - 0.25 * k * A;
  c *= mix(1.0, vig(uv, 0.3, 1.4), k * A);
  c = mix(c, c * vec3(1.1, 0.7, 0.7), 0.25 * k * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['wasted', 'öldün', 'elendin', 'game over'] }),

    fx('enerji-kalkani', 'Enerji Kalkanı', [AMT(0.9), SPD(1), R('scale', 'Petek sıklığı', 4, 30, 12, 1), C('color', 'Renk', '#38d9ff')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = (uv - 0.5) * asp() * u_scale;
  vec4 h = hexCell(P);
  float d = hexDist(h.xy);
  float edge = smoothstep(0.42, 0.5, d);
  float wave = sin(length(h.zw) * 0.6 - t * 3.0) * 0.5 + 0.5;
  float flick = 0.5 + 0.5 * sin(t * 4.0 + rand(h.zw) * 20.0);
  float fres = smoothstep(0.3, 1.2, length((uv - 0.5) * 2.0));
  float m = edge * (0.25 + 0.75 * wave) * (0.4 + 0.6 * fres) + (1.0 - edge) * wave * flick * 0.08 * (0.5 + fres);
  vec4 r = tex(uv + h.xy * 0.01 * edge * A / u_scale);
  vec3 c = r.rgb + u_color * m * 1.1 * A;
  c = mix(c, c * mix(vec3(1.0), u_color, 0.3), 0.3 * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['shield', 'kalkan', 'sci-fi', 'petek'] }),

    fx('zafer-isinlari', 'Zafer Işınları', [AMT(0.8), SPD(1), R('count', 'Işın sayısı', 6, 30, 14, 1), R('y', 'Merkez Y', 0, 1, 0.5), C('color', 'Renk', '#ffc93c')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = (uv - vec2(0.5, u_y)) * asp() / sn();
  float a = atan(P.y, P.x) + uTime * u_speed * 0.4;
  float r = length(P);
  float rays = smoothstep(-0.2, 0.2, sin(a * u_count));
  vec3 c = mix(s.rgb, sft(s.rgb, u_color), 0.4 * A);
  c = scr(c, u_color * rays * exp(-r * 1.2) * 0.45 * A);
  c = scr(c, u_color * exp(-r * 4.0) * 0.5 * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['victory', 'zafer', 'kazandın', 'ışın'] }),

    fx('radar', 'Radar Taraması', [AMT(0.85), SPD(1), C('color', 'Renk', '#3dff7a')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = cp(uv);
  float r = length(P);
  float sweep = mod(t * 2.0 - atan(P.y, P.x), 6.28318) / 6.28318;
  float trail = exp(-sweep * 7.0);
  float beam = exp(-sweep * 120.0);
  float rings = (1.0 - smoothstep(0.0, 0.004, abs(fract(r * 5.0 + 0.5) - 0.5) / 5.0)) * 0.5;
  float grid = (1.0 - smoothstep(0.0, 0.0025, abs(P.x))) + (1.0 - smoothstep(0.0, 0.0025, abs(P.y)));
  vec3 base = mix(s.rgb, vec3(luma(s.rgb)) * u_color, 0.6);
  vec3 c = base * (0.45 + 0.55 * trail);
  c += u_color * (rings + grid * 0.4) * 0.6 + u_color * beam * 0.8 + u_color * trail * 0.15;
  vec2 G = P * 6.0; vec2 id = floor(G);
  vec2 hp = h22(id + uSeed);
  float blip = step(0.85, hp.x) * (1.0 - smoothstep(0.03, 0.06, length(fract(G) - hp)));
  vec2 bp = (id + hp) / 6.0;
  float bs = mod(t * 2.0 - atan(bp.y, bp.x), 6.28318) / 6.28318;
  c += u_color * blip * exp(-bs * 4.0) * 1.5;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['radar', 'tarama', 'askeri', 'sonar'] }),

    fx('nisan-alma', 'Nişan Alma', [AMT(1), C('color', 'Nişangah rengi', '#ff3b3b')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 q = 0.5 + (uv - 0.5) / (1.0 + 0.25 * A);
  vec4 s = tex(q);
  float m = 1.0 - vig(uv, 0.25, 1.1);
  vec3 c = mix(s.rgb, disk(q, px() * 14.0 * m * A).rgb, m);
  c *= mix(1.0, vig(uv, 0.3, 1.5), 0.7 * A);
  c = mix(c, satur(c, 0.85), m * A);
  vec2 P = cp(uv);
  float dotm = 1.0 - smoothstep(0.004, 0.006, length(P));
  float ring = 1.0 - smoothstep(0.0015, 0.003, abs(length(P) - 0.03));
  c = mix(c, u_color, clamp(dotm + ring * 0.8, 0.0, 1.0) * A);
  return vec4(c, s.a);
}`, { tags: ['ads', 'aim', 'nişan', 'fps'] }),

    fx('flas-bombasi', 'Flaş Bombası', [AMT(1), PER(3)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.5);
  float w = 1.0 - smoothstep(0.1, per * 0.75, mod(uTime, per));
  vec4 s = tex(uv);
  vec4 ghost = tex(uv + vec2(0.02, -0.01));
  vec3 c = mix(s.rgb, disk(uv, px() * 20.0 * w).rgb, w);
  c = mix(c, vec3(luma(c)), w * 0.8);
  c = scr(c, ghost.rgb * w * 0.6);
  c = mix(c, vec3(1.0), clamp(w * 1.15, 0.0, 1.0) * A * 0.92);
  return vec4(c, s.a);
}`, { tags: ['flashbang', 'flaş', 'kör', 'cs'] }),

    fx('zehirlenme', 'Zehirlenme', [AMT(0.9), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float pulse = 0.5 + 0.5 * sin(t * 2.5);
  vec2 q = uv + vec2(sin(uv.y * 8.0 + t * 2.0), cos(uv.x * 7.0 + t * 1.7)) * 0.008 * A * (0.5 + pulse);
  vec4 s = tex(q);
  vec3 c = mix(s.rgb, disk(q, px() * 8.0 * pulse * A).rgb, 0.6 * pulse);
  c = mix(c, vec3(0.2, 0.9, 0.15) * (0.25 + luma(c)), 0.45 * A);
  c = mix(c, vec3(0.15, 0.55, 0.05), (1.0 - vig(uv, 0.3, 1.4)) * (0.4 + 0.3 * pulse) * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['poison', 'zehir', 'toksik', 'yeşil'] }),

    fx('buz-tutma', 'Donma (Buz)', [AMT(1), B('grow', 'Büyüyerek gelsin', true)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 q = abs(uv - 0.5) * 2.0;
  float edge = max(pow(q.x, 3.0), pow(q.y, 3.0)) + length(q) * 0.25;
  vec2 P = uv * asp();
  float n = fbm(P * 6.0) * 0.6 + fbm(P * 20.0) * 0.4;
  float growth = u_grow > 0.5 ? smoothstep(0.0, 2.0, uTime) : 1.0;
  float frost = smoothstep(0.55, 0.95, edge * 0.8 + n * 0.55 - (1.0 - growth) * 0.6 - (1.0 - A) * 0.5);
  vec4 v = voro(P * 12.0);
  float cracks = (1.0 - smoothstep(0.0, 0.04, v.y)) * frost;
  vec2 off = (vec2(n, fbm(P * 6.0 + 3.0)) - 0.5) * 0.04 * frost;
  vec3 c = mix(s.rgb, disk(uv + off, px() * 8.0 * frost).rgb, frost);
  c = mix(c, c * vec3(0.75, 0.9, 1.1) + vec3(0.0, 0.05, 0.1), 0.6 * A);
  c = mix(c, vec3(0.9, 0.96, 1.0), clamp(frost * 0.55 + cracks * 0.4, 0.0, 1.0));
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['freeze', 'buz', 'donma', 'kış'] }),
  ],
}
