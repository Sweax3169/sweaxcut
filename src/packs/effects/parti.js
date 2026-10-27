// Parti & Eğlence: disko, konfeti, kalpler, yıldız patlaması, lazer…
import { R, B, AMT, SPD, PER, fx } from './lib.js'

export default {
  id: 'parti', name: 'Parti & Eğlence',
  items: [
    fx('disko', 'Disko Işıkları', [AMT(0.85), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec3 light = vec3(0.0);
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    vec2 c = 0.5 + vec2(0.42 * sin(t * (0.7 + fi * 0.13) + fi * 2.1), 0.38 * cos(t * (0.9 + fi * 0.11) + fi * 1.3));
    float d = length((uv - c) * asp());
    light += hsv2rgb(vec3(fract(fi / 6.0 + t * 0.05), 0.85, 1.0)) * (1.0 - smoothstep(0.0, 0.3, d));
  }
  vec2 p = (uv - vec2(0.5, 1.05)) * asp();
  float rays = pow(max(0.0, sin(atan(p.x, -p.y) * 9.0 + t * 1.5)), 6.0) * 0.25;
  light += vec3(rays) * (1.0 - smoothstep(0.2, 1.4, length(p)));
  vec3 c = s.rgb * (1.0 - 0.5 * A) + s.rgb * light * 1.3 * A + light * 0.1 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['disco', 'parti', 'ışık', 'kulüp'] }),

    fx('konfeti', 'Konfeti', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.55)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = s.rgb;
  vec2 P = uv * asp();
  float t = uTime * u_speed;
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 8.0 - fl * 2.0;
    vec2 p = P * sc;
    p.y += t * sc * (0.1 + fl * 0.04);
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 17.0 + uSeed * 3.0);
    if (r.x > u_density) continue;
    vec2 o = (r - 0.5) * 0.45; o.x += sin(t * 2.0 + r.y * 6.28) * 0.12;
    vec2 d = rot(t * (2.0 + r.y * 4.0) + r.x * 6.28) * (f - o);
    d.x /= max(0.15, abs(cos(t * 3.0 * (0.5 + r.x) + r.y * 10.0)));
    float sd = sdBox(d, vec2(0.15, 0.075) * (0.8 + 0.4 * r.y));
    float aa = sc / uRes.y * 1.5;
    float m = 1.0 - smoothstep(-aa, aa, sd);
    vec3 cc = hsv2rgb(vec3(rand(id + fl + 3.7), 0.75, 1.0));
    col = mix(col, cc * (0.75 + 0.25 * cos(t * 5.0 + r.x * 9.0)), m * A);
  }
  return vec4(col, s.a);
}`, { tags: ['confetti', 'kutlama', 'doğum günü'] }),

    fx('kalpler', 'Uçan Kalpler', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.45)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = s.rgb;
  vec2 P = uv * asp();
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 3.0 + fl * 2.5;
    vec2 p = P * sc;
    p.y -= uTime * u_speed * (0.25 + fl * 0.08) * sc;
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 13.0 + uSeed * 5.0);
    if (r.x > u_density) continue;
    vec2 o = (r - 0.5) * 0.25; o.x += sin(uTime * 1.8 + r.y * 6.28) * 0.08;
    float size = 0.2 + 0.12 * r.y;
    vec2 d = rot(sin(uTime * 2.0 + r.x * 6.28) * 0.3) * (f - o) / size;
    d.y += 0.55;
    float h = sdHeart(d);
    float aa = sc / uRes.y * 2.0 / size;
    float m = 1.0 - smoothstep(-aa, aa, h);
    vec3 hc = mix(vec3(1.0, 0.12, 0.35), vec3(1.0, 0.55, 0.75), rand(id + 4.0));
    hc = mix(hc, vec3(1.0), (1.0 - smoothstep(0.0, 0.18, length(d - vec2(-0.22, 0.78)))) * 0.6);
    col = mix(col, hc, m * A);
    col += hc * exp(-max(h, 0.0) * 9.0) * 0.25 * A * (1.0 - m);
  }
  return vec4(clamp(col, 0.0, 1.0), s.a);
}`, { tags: ['hearts', 'aşk', 'sevgi', 'beğeni'] }),

    fx('yildiz-patlamasi', 'Yıldız Patlaması', [AMT(1), PER(2), R('spread', 'Yayılma', 0.3, 2, 1), B('colorful', 'Renkli', false)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = s.rgb;
  float per = max(u_period, 0.3);
  float k = floor(uTime / per);
  float p = fract(uTime / per);
  vec2 c0 = (vec2(0.5) + (h22(vec2(k, uSeed)) - 0.5) * 0.35) * asp();
  vec2 P = uv * asp();
  col += vec3(1.0, 0.9, 0.6) * exp(-p * 14.0) * 0.35 * A * exp(-length(P - c0) * 3.0);
  float fade = 1.0 - smoothstep(0.55, 1.0, p);
  for (int i = 0; i < 16; i++){
    float fi = float(i);
    float ang = fi / 16.0 * 6.2832 + rand(vec2(k, fi)) * 0.5;
    float sp = 0.25 + 0.35 * rand(vec2(fi, k + 1.0));
    vec2 pos = c0 + vec2(cos(ang), sin(ang)) * sp * eoc(p) * u_spread;
    pos.y -= p * p * 0.15;
    float size = 0.055 * (1.0 - p * 0.5) * (0.7 + 0.6 * rand(vec2(fi, k + 2.0)));
    vec2 d = rot(p * 6.0 + fi) * (P - pos) / size;
    float st = sdStar(d, 1.0, 0.45);
    float aa = 2.0 / (uRes.y * size);
    float m = (1.0 - smoothstep(-aa, aa, st)) * fade;
    vec3 sc = u_colorful > 0.5 ? hsv2rgb(vec3(rand(vec2(fi, k + 3.0)), 0.7, 1.0)) : mix(vec3(1.0, 0.85, 0.3), vec3(1.0), rand(vec2(fi, k)));
    col = mix(col, sc, m * A);
    col += sc * exp(-max(st, 0.0) * 3.0) * 0.15 * fade * A;
  }
  return vec4(clamp(col, 0.0, 1.0), s.a);
}`, { tags: ['stars', 'burst', 'yıldız', 'kutlama'] }),

    fx('gokkusagi-dongu', 'Gökkuşağı Döngüsü', [AMT(1), SPD(1), R('wave', 'Dalga', 0, 2, 0)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec3 h = rgb2hsv(s.rgb);
  h.x = fract(h.x + uTime * u_speed * 0.25 + u_wave * (uv.x * 0.6 + uv.y * 0.4));
  h.y = clamp(h.y * (1.0 + 0.4 * u_amount) + 0.15 * u_amount, 0.0, 1.0);
  return vec4(mix(s.rgb, hsv2rgb(h), u_amount * uIntensity), s.a);
}`, { tags: ['rainbow', 'hue', 'renk döngüsü'] }),

    fx('renkli-strobe', 'Renkli Strobe', [AMT(0.9), R('rate', 'Değişim/sn', 1, 16, 6, 0.5)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float k = floor(uTime * u_rate);
  float p = fract(uTime * u_rate);
  vec3 col = hsv2rgb(vec3(fract(k * 0.618 + uSeed), 0.9, 1.0));
  float e = 0.55 + 0.45 * exp(-p * 4.0);
  vec3 c = mix(s.rgb, s.rgb * col * 1.7 + col * 0.12, e * u_amount * uIntensity);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['strobe', 'renk', 'parti'] }),

    fx('parti-spot', 'Parti Spotları', [AMT(0.9), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  vec3 light = vec3(0.0);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    vec2 o = vec2((0.2 + fi * 0.3) * ar(), 1.1);
    float ang = sin(t * (0.8 + fi * 0.23) + fi * 2.0) * 0.6;
    vec2 dir = vec2(sin(ang), -cos(ang));
    vec2 d = P - o;
    float along = dot(d, dir);
    float perp = abs(dot(d, vec2(-dir.y, dir.x)));
    float inner = 0.05 + along * 0.15, outer = 0.12 + along * 0.22;
    float cone = (1.0 - smoothstep(inner, outer, perp)) * step(0.0, along);
    vec3 lc = hsv2rgb(vec3(fract(fi * 0.33 + t * 0.03), 0.6, 1.0));
    light += lc * cone * (0.6 + 0.4 * (1.0 - smoothstep(0.4, 1.4, along)));
  }
  vec3 c = s.rgb * (1.0 - 0.6 * A) + s.rgb * light * 1.4 * A + light * 0.06 * A;
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['spotlight', 'sahne', 'konser'] }),

    fx('baloncuklar', 'Baloncuklar', [AMT(1), SPD(1), R('density', 'Yoğunluk', 0.1, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 col = s.rgb;
  vec2 P = uv * asp();
  vec2 refr = vec2(0.0); float rim = 0.0; float spec = 0.0; float inside = 0.0;
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 3.0 + fl * 2.0;
    vec2 p = P * sc; p.y -= uTime * u_speed * (0.15 + fl * 0.05) * sc;
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + fl * 7.7 + uSeed * 3.0);
    if (r.x > u_density) continue;
    vec2 o = (r - 0.5) * 0.35; o.x += sin(uTime * 1.5 + r.y * 6.28) * 0.08;
    float rad = 0.12 + 0.18 * r.y;
    vec2 d = (f - o) / rad;
    float l = length(d);
    if (l < 1.0) {
      float z = sqrt(1.0 - l * l);
      refr += d * (1.0 - z) * rad / sc * 0.6;
      rim += smoothstep(0.75, 1.0, l) * (1.0 - smoothstep(0.97, 1.0, l));
      spec += 1.0 - smoothstep(0.0, 0.25, length(d - vec2(-0.35, 0.4)));
      inside = 1.0;
    }
  }
  vec4 rc = tex(uv - refr / asp());
  col = mix(col, rc.rgb, inside * A);
  vec3 irid = rainbow(rim * 0.8 + uv.x + uTime * 0.1) * 0.5 + 0.5;
  col += irid * rim * 0.6 * A + vec3(spec) * 0.8 * A;
  return vec4(clamp(col, 0.0, 1.0), s.a);
}`, { tags: ['bubbles', 'köpük', 'sabun'] }),

    fx('lazer-sov', 'Lazer Şov', [AMT(1), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  vec2 d = P - vec2(0.5 * ar(), -0.05);
  float ang = atan(d.x, d.y);
  float r = length(d);
  vec3 light = vec3(0.0);
  for (int i = 0; i < 7; i++){
    float fi = float(i);
    float a = (fi / 6.0 - 0.5) * 1.6 * (0.7 + 0.3 * sin(t * 0.9)) + sin(t * 1.3 + fi) * 0.15;
    float da = abs(ang - a) * r;
    float beam = exp(-da * 900.0) + exp(-da * 70.0) * 0.25;
    vec3 lc = i % 3 == 0 ? vec3(0.2, 1.0, 0.3) : i % 3 == 1 ? vec3(1.0, 0.15, 0.3) : vec3(0.3, 0.5, 1.0);
    light += lc * beam;
  }
  float haze = 0.06 * fbm(P * 3.0 + t * 0.2);
  vec3 c = s.rgb * (1.0 - 0.45 * A) + light * A + haze * A * vec3(0.5, 0.6, 1.0);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['laser', 'lazer', 'konser', 'kulüp'] }),

    fx('bas-dususu', 'Bas Düşüşü', [AMT(0.8), R('bpm', 'Tempo (BPM)', 40, 200, 128, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float per = 60.0 / max(u_bpm, 20.0);
  float e = exp(-mod(uTime, per) / per * 3.0);
  float z = 1.0 + 0.06 * A * e;
  vec2 q = 0.5 + (uv - 0.5) / z;
  vec2 o = (q - 0.5) * 0.03 * A * e;
  vec4 c = tex(q);
  c.r = tex(q + o).r; c.b = tex(q - o).b;
  c.rgb = contr(satur(c.rgb, 1.0 + 0.6 * A * e), 1.0 + 0.3 * A * e) * (1.0 + 0.25 * A * e);
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`, { tags: ['bass drop', 'beat', 'müzik', 'vuruş'] }),
  ],
}
