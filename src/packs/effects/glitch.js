// Glitch: RGB ayrışma, blok bozulma, yırtılma, datamosh, sinyal kaybı…
import { R, S, AMT, SPD, PER, fx } from './lib.js'

export default {
  id: 'glitch', name: 'Glitch',
  items: [
    fx('rgb-ayrisma', 'RGB Ayrışma', [AMT(0.5, 'Kayma'), R('angle', 'Açı', 0, 360, 0, 1), SPD(1)], `
vec4 effect(vec2 uv){
  float t = uTime * u_speed;
  float A = u_amount * uIntensity;
  float j = 0.55 + 0.9 * noise(vec2(t * 7.0, uSeed * 13.0));
  float ang = radians(u_angle) + (noise(vec2(t * 3.0, 5.0)) - 0.5) * 0.6 * min(u_speed, 1.0);
  vec2 d = vec2(cos(ang), sin(ang)) * A * j * 0.025;
  vec4 r = tex(uv + d), g = tex(uv), b = tex(uv - d);
  return vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}`, { tags: ['rgb split', 'chromatic', 'kayma'] }),

    fx('dijital-blok', 'Dijital Blok', [AMT(0.6), SPD(1), R('size', 'Blok ölçeği', 0.5, 3, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = floor(uTime * u_speed * 12.0);
  float burst = 0.35 + 0.65 * smoothstep(0.35, 0.65, noise(vec2(uTime * u_speed * 2.5, uSeed * 9.0)));
  vec2 grid = vec2(6.0, 12.0) * u_size;
  vec2 blk = floor(uv * grid);
  vec2 blk2 = floor(uv * grid * vec2(0.5, 2.0));
  float r = rand(blk + t * 0.37 + uSeed);
  float r2 = rand(blk2 + t * 1.13);
  float on = step(1.0 - A * 0.45 * burst, max(r, r2 * 0.97));
  vec2 off = (vec2(rand(blk * 1.7 + t), rand(blk * 2.3 + t)) - 0.5) * vec2(0.25, 0.05) * on;
  vec2 q = uv + off;
  vec4 c = tex(q);
  if (on > 0.5) {
    float sh = 0.012 + 0.03 * rand(blk + t * 2.0);
    c.r = tex(q + vec2(sh, 0.0)).r;
    c.b = tex(q - vec2(sh, 0.0)).b;
    float m = rand(blk * 3.1 + t);
    if (m > 0.85) c.rgb = 1.0 - c.rgb;
    else if (m > 0.7) c.rgb = floor(c.rgb * 3.0) / 3.0;
    else if (m > 0.6) c.rgb = c.gbr;
  }
  return c;
}`, { tags: ['block', 'digital', 'bozulma'] }),

    fx('tarama-yirtigi', 'Satır Yırtılması', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float ft = floor(t * 15.0);
  float tear = smoothstep(0.55, 0.75, noise(vec2(uv.y * 7.0 + t * 2.0, t * 1.5)));
  float off = (rand(vec2(floor(uv.y * 70.0), ft)) - 0.5) * 0.18 * tear * A;
  off += (noise(vec2(uv.y * 90.0, t * 25.0)) - 0.5) * 0.006 * A;
  vec4 c = tex(vec2(uv.x + off, uv.y));
  c.r = tex(vec2(uv.x + off * 1.4 + 0.004 * A * tear, uv.y)).r;
  c.b = tex(vec2(uv.x + off * 0.6 - 0.004 * A * tear, uv.y)).b;
  float line = step(0.992, rand(vec2(floor(uv.y * 240.0), ft)));
  c.rgb = mix(c.rgb, vec3(1.0), line * 0.5 * A);
  return c;
}`, { tags: ['scanline', 'tear', 'yırtık'] }),

    fx('datamosh', 'Datamosh Bulaşma', [AMT(0.8), SPD(1), R('block', 'Blok sıklığı', 0.5, 3, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float k = floor(t * 0.7);
  float ph = 0.35 + 0.65 * fract(t * 0.7);
  vec2 bs = vec2(16.0, 9.0) * u_block;
  vec2 b = floor(uv * bs);
  vec2 mv = vec2(noise(b * 0.31 + k * 3.1), noise(b * 0.27 + 7.0 + k * 2.7)) - 0.5;
  mv = floor(mv * 6.0) / 3.0;
  float m = smoothstep(0.35, 0.6, noise(b * 0.18 + k * 5.3 + uSeed * 4.0));
  float s = ph * ph * 0.2 * A * m;
  vec2 q = uv - mv * s;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++){ float f = float(i) / 7.0; acc += tx(q + mv * f * 0.05 * A * m); }
  vec4 c = acc / 8.0;
  vec2 cell = px() * 6.0;
  vec4 blocky = tx((floor(q / cell) + 0.5) * cell);
  c = mix(c, blocky, m * 0.5 * A);
  c.rgb = mix(c.rgb, floor(c.rgb * 6.0 + 0.5) / 6.0, m * 0.35 * A);
  return c;
}`, { tags: ['datamosh', 'smear', 'bulaşma'] }),

    fx('kromatik', 'Kromatik Sapma', [AMT(0.6), SPD(0)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity * (1.0 + 0.35 * sin(uTime * u_speed * 5.0));
  vec2 d = uv - 0.5;
  vec2 o = d * dot(d, d) * 0.35 * A + d * 0.012 * A;
  vec3 acc = vec3(0.0), ws = vec3(0.0); float a = 0.0;
  for (int i = 0; i < 9; i++){
    float f = float(i) / 8.0;
    vec3 w = clamp(vec3(1.0 - 2.0 * f, 1.0 - abs(2.0 * f - 1.0), 2.0 * f - 1.0), 0.0, 1.0) + 0.02;
    vec4 c = tx(uv + o * (1.0 - 2.0 * f));
    acc += c.rgb * w; ws += w; a = max(a, c.a);
  }
  return vec4(acc / ws, a);
}`, { tags: ['chromatic aberration', 'lens', 'renk saçılması'] }),

    fx('sinyal-kaybi', 'Sinyal Kaybı', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float burst = smoothstep(0.5, 0.75, noise(vec2(t * 1.7, uSeed * 5.0)));
  float roll = step(0.6, noise(vec2(t * 0.9, 11.0))) * fract(t * 1.3) * A;
  vec2 q = vec2(uv.x, fract(uv.y + roll));
  q.x += (noise(vec2(uv.y * 40.0, t * 30.0)) - 0.5) * 0.04 * A * (0.3 + burst);
  vec4 c = tex(q);
  float sn = rand(floor(uv * uRes / max(1.0, uRes.y / 270.0)) + fract(t * 13.1) * 100.0);
  float g = luma(c.rgb);
  c.rgb = mix(c.rgb, vec3(g) * vec3(0.9, 1.0, 1.1), 0.6 * A);
  c.rgb = mix(c.rgb, vec3(sn), clamp(0.18 * A + burst * A * 0.75, 0.0, 1.0));
  float bar = smoothstep(0.0, 0.12, abs(fract(uv.y * 0.7 - t * 0.35) - 0.5));
  c.rgb *= mix(1.0, 0.55 + 0.45 * bar, A);
  return c;
}`, { tags: ['signal', 'static', 'karlanma', 'parazit'] }),

    fx('piksel-siralama', 'Piksel Sıralama', [AMT(0.8), R('threshold', 'Eşik', 0, 1, 0.45), R('length', 'Uzunluk', 0.05, 0.6, 0.3), S('dir', 'Yön', [['dikey', 'Dikey'], ['yatay', 'Yatay']]), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 dir = u_dir < 0.5 ? vec2(0.0, 1.0) : vec2(-1.0, 0.0);
  float sc = max(1.0, uRes.y / 540.0);
  float colId = u_dir < 0.5 ? floor(uv.x * uRes.x / sc) : floor(uv.y * uRes.y / sc);
  float cr = rand(vec2(colId, uSeed + 3.0));
  float len = u_length * (0.35 + 0.65 * cr) * A * (0.85 + 0.15 * sin(uTime * u_speed * 2.0 + cr * 6.28));
  vec4 c = tex(uv);
  if (luma(c.rgb) < u_threshold) return c;
  vec4 best = c; float bl = luma(c.rgb);
  vec3 avg = c.rgb; float n = 1.0;
  for (int i = 1; i <= 28; i++){
    float f = float(i) / 28.0;
    vec4 s = tx(uv + dir * f * len);
    float l = luma(s.rgb);
    if (l < u_threshold) break;
    avg += s.rgb; n += 1.0;
    if (l > bl) { best = s; bl = l; }
  }
  return vec4(mix(avg / n, best.rgb, 0.5), c.a);
}`, { tags: ['pixel sort', 'sıralama', 'akma'] }),

    fx('kirik-ekran', 'Kırık Ekran', [AMT(1), R('cx', 'Darbe X', 0, 1, 0.62), R('cy', 'Darbe Y', 0, 1, 0.55)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 p = (uv - vec2(u_cx, u_cy)) * asp();
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float sectors = 13.0;
  float wob = (noise(vec2(r * 5.0, uSeed * 7.0)) - 0.5) * 0.9;
  float sa = a / 6.28318 * sectors + wob + uSeed * 3.0;
  float si = floor(sa);
  float lr = log(r * 10.0 + 1.0) * 2.4 + (noise(vec2(a * 2.0, si)) - 0.5) * 0.8;
  float ri = floor(lr);
  vec2 cid = vec2(si, ri);
  float fa = fract(sa), fr = fract(lr);
  float e1 = min(fa, 1.0 - fa) * r * 6.28318 / sectors;
  float keep = step(0.35, rand(cid + 1.7));
  float e2 = mix(1.0, min(fr, 1.0 - fr) * (r * 10.0 + 1.0) / 24.0, keep);
  float e = min(e1, e2);
  float w = 0.0018 + 0.002 * exp(-r * 4.0);
  float line = 1.0 - smoothstep(w * 0.5, w * 1.5, e);
  float shadow = 1.0 - smoothstep(w, w * 4.0, e);
  vec2 off = (h22(cid + uSeed * 9.0) - 0.5) * 0.014 * A * smoothstep(0.0, 0.3, r);
  vec4 c = tex(uv + off);
  c.rgb *= mix(1.0, 0.88 + 0.24 * rand(cid), A);
  c.rgb = mix(c.rgb, c.rgb * 0.35, shadow * 0.6 * A);
  c.rgb = mix(c.rgb, vec3(0.95), line * 0.85 * A);
  float core = 1.0 - smoothstep(0.0, 0.07, r);
  c.rgb = mix(c.rgb, vec3(0.9) * (0.6 + 0.4 * rand(floor(uv * uRes * 0.5))), core * 0.8 * A);
  return c;
}`, { tags: ['broken screen', 'çatlak', 'cam'] }),

    fx('glitch-flas', 'Glitch Flaşı', [AMT(1), PER(1.2), R('dur', 'Süre (sn)', 0.05, 1, 0.35, 0.01)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = max(u_period, 0.2);
  float p = mod(uTime, per);
  vec4 c = tex(uv);
  if (p > u_dur || A <= 0.0) return c;
  float k = floor(uTime * 20.0);
  float m = rand(vec2(k, uSeed));
  float row = floor(uv.y * 14.0);
  float band = step(0.5, rand(vec2(row, k)));
  vec2 q = uv + vec2((rand(vec2(row, k + 3.0)) - 0.5) * 0.25 * band * A, 0.0);
  vec4 g = tex(q);
  float sh = 0.03 * A;
  g.r = tex(q + vec2(sh, 0.0)).r; g.b = tex(q - vec2(sh, 0.0)).b;
  if (m > 0.66) g.rgb = 1.0 - g.rgb;
  else if (m > 0.33) g.rgb = mix(g.rgb, vec3(1.0, 0.1, 0.8) * luma(g.rgb) * 1.8, 0.6);
  else g.rgb = mix(g.rgb, vec3(0.1, 1.0, 0.9) * luma(g.rgb) * 1.8, 0.6);
  return vec4(mix(c.rgb, clamp(g.rgb, 0.0, 1.0), A), max(c.a, g.a));
}`, { tags: ['flash', 'glitch', 'geçiş'] }),

    fx('gecmeli', 'Geçmeli Tarama', [AMT(0.7), SPD(1), R('size', 'Satır kalınlığı', 1, 12, 3, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float line = floor(uv.y * uRes.y / max(1.0, u_size * uRes.y / 1080.0));
  float odd = mod(line, 2.0);
  float off = odd * ((noise(vec2(t * 9.0, 1.0)) - 0.5) * 0.03 + sin(t * 31.0) * 0.003) * A;
  vec4 c = tex(uv + vec2(off, 0.0));
  c.rgb *= 1.0 - odd * 0.3 * A;
  return c;
}`, { tags: ['interlace', 'satır', 'tv'] }),

    fx('jpeg-bozulma', 'JPEG Bozulması', [AMT(0.9), R('size', 'Blok boyutu', 0.5, 4, 2), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = floor(uTime * u_speed * 6.0);
  vec2 bs = px() * 8.0 * u_size;
  vec2 b = floor(uv / bs);
  vec2 bc = (b + 0.5) * bs;
  vec2 f = fract(uv / bs);
  vec3 dc = (tex(bc + bs * vec2(-0.25, -0.25)).rgb + tex(bc + bs * vec2(0.25, -0.25)).rgb + tex(bc + bs * vec2(-0.25, 0.25)).rgb + tex(bc + bs * vec2(0.25, 0.25)).rgb) * 0.25;
  float gx = luma(tex(bc + vec2(bs.x * 0.35, 0.0)).rgb) - luma(tex(bc - vec2(bs.x * 0.35, 0.0)).rgb);
  float gy = luma(tex(bc + vec2(0.0, bs.y * 0.35)).rgb) - luma(tex(bc - vec2(0.0, bs.y * 0.35)).rgb);
  float Y = luma(dc) - gx * cos(3.14159 * f.x) * 0.5 - gy * cos(3.14159 * f.y) * 0.5;
  vec2 bc2 = (floor(uv / (bs * 2.0)) + 0.5) * bs * 2.0;
  vec3 ch = tex(bc2).rgb; ch -= luma(ch);
  vec3 jp = clamp(Y + ch * 1.15, 0.0, 1.0);
  float err = step(0.965, rand(b + t * 0.71 + uSeed));
  vec3 tint = rand(b * 1.3 + t) > 0.5 ? vec3(0.2, 1.0, 0.3) : vec3(1.0, 0.2, 0.9);
  jp = mix(jp, tint * (0.3 + Y), err * 0.8);
  vec4 c = tex(uv);
  return vec4(mix(c.rgb, jp, A), c.a);
}`, { tags: ['jpeg', 'compression', 'sıkıştırma', 'makroblok'] }),

    fx('anten-paraziti', 'Anten Paraziti', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec2 q = uv;
  q.y = fract(q.y + sin(t * 0.7) * 0.03 * A * step(0.6, noise(vec2(t, 4.0))));
  q.x += sin(uv.y * 30.0 + t * 8.0) * 0.003 * A;
  vec4 c = tex(q);
  vec4 ghost = tex(q + vec2(0.035, 0.0) * A);
  c.rgb = mix(c.rgb, c.rgb * 0.7 + ghost.rgb * 0.45, 0.6 * A);
  float sn = rand(floor(uv * uRes / max(1.0, uRes.y / 360.0)) + fract(t * 17.3) * 61.0);
  c.rgb = mix(c.rgb, vec3(sn), 0.35 * A);
  float hl = noise(vec2(uv.y * 120.0, t * 60.0));
  c.rgb += smoothstep(0.75, 1.0, hl) * 0.25 * A;
  c.rgb = mix(c.rgb, vec3(luma(c.rgb)), 0.4 * A);
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`, { tags: ['antenna', 'tv', 'karlanma', 'hayalet'] }),

    fx('kare-kaymasi', 'Kare Kayması', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  float k = floor(t * 8.0);
  float on = step(0.35, rand(vec2(k, uSeed + 0.37)));
  float jump = on * (rand(vec2(k, 2.0)) - 0.5) * 0.5 * A;
  float sx = on * (rand(vec2(k, 5.0)) - 0.5) * 0.06 * A;
  float y = fract(uv.y + jump);
  vec2 q = vec2(uv.x + sx, y);
  vec4 c = tex(q);
  float sh = 0.012 * A * on;
  c.r = tex(q + vec2(sh, 0.0)).r; c.b = tex(q - vec2(sh, 0.0)).b;
  float seam = (1.0 - smoothstep(0.0, 0.02, min(y, 1.0 - y))) * on * step(0.001, abs(jump));
  c.rgb = mix(c.rgb, vec3(0.0), seam * 0.85);
  return c;
}`, { tags: ['frame skip', 'kayma', 'zıplama'] }),
  ],
}
