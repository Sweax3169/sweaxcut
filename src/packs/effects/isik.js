// Işık: sızıntılar, mercek parlaması, bloom, tanrı ışınları, strobe, neon, parıltı…
import { R, C, B, AMT, SPD, PER, fx, mp, blurH, blurV } from './lib.js'

const leak = (id, name, c1, c2, tags) => fx(id, name, [AMT(0.8), SPD(1), C('color1', 'Renk 1', c1), C('color2', 'Renk 2', c2)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed * 0.35 + uSeed * 10.0;
  vec4 s = tex(uv);
  float x1 = -0.15 + 0.3 * sin(t * 0.7);
  float e1 = exp(-pow((uv.x - x1) * 2.4, 2.0)) * (0.35 + 0.9 * fbm(vec2(uv.y * 1.6 + t, t * 0.6)));
  vec2 c2p = vec2(1.05, 0.25 + 0.35 * sin(t * 0.5 + 1.0));
  float e2 = exp(-pow(length((uv - c2p) * vec2(1.4, 1.0)) * 1.9, 2.0)) * (0.4 + 0.8 * fbm(uv * 2.0 + t));
  vec2 c3p = vec2(0.5 + 0.5 * sin(t * 0.33 + 2.0), 1.1);
  float e3 = exp(-pow(length((uv - c3p) * vec2(1.0, 2.2)) * 1.6, 2.0)) * 0.7;
  vec3 lk = e1 * mix(u_color1, u_color2, uv.y) + e2 * u_color2 + e3 * mix(u_color2, vec3(1.0, 0.95, 0.8), 0.4);
  lk *= 1.5;
  vec3 c = scr(s.rgb, clamp(lk, 0.0, 1.0) * A);
  c = mix(c, c * mix(vec3(1.0), u_color1 * 0.5 + 0.6, 0.35), clamp(luma(lk), 0.0, 1.0) * A);
  return vec4(clamp(c, 0.0, 1.0), s.a);
}`, { tags: ['light leak', 'ışık sızıntısı', ...tags] })

export default {
  id: 'isik', name: 'Işık',
  items: [
    leak('isik-sizintisi-sicak', 'Sıcak Işık Sızıntısı', '#ff6a1a', '#ff2d55', ['sıcak', 'turuncu']),
    leak('isik-sizintisi-soguk', 'Soğuk Işık Sızıntısı', '#2de2ff', '#7b3dff', ['soğuk', 'mavi']),
    leak('isik-sizintisi-pastel', 'Pastel Işık Sızıntısı', '#ff7ae6', '#59ffc8', ['pastel', 'pembe']),

    fx('mercek-parlamasi', 'Mercek Parlaması', [AMT(0.9), R('x', 'Konum X', 0, 1, 0.25), R('y', 'Konum Y', 0, 1, 0.78), SPD(0.6), C('color', 'Renk', '#ffd9a0')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 L = vec2(u_x, u_y) + vec2(sin(uTime * u_speed * 0.5), cos(uTime * u_speed * 0.37)) * 0.06;
  vec2 p = (uv - 0.5) * asp(); vec2 lp = (L - 0.5) * asp();
  vec2 d = p - lp; float r = length(d);
  float ang = atan(d.y, d.x);
  float glow = exp(-r * 9.0) * 0.9 + 0.012 / (r + 0.012) * 0.25;
  float rays = (pow(abs(cos(ang * 3.0)), 60.0) + pow(abs(cos(ang * 3.0 + 0.5)), 90.0) * 0.6) * exp(-r * 4.0) * 0.8;
  float streak = exp(-abs(d.y) * 160.0) * exp(-abs(d.x) * 2.2) * 0.9;
  vec3 fl = u_color * (glow + rays) + vec3(0.6, 0.75, 1.0) * streak;
  fl += rainbow(r * 3.0) * exp(-pow((r - 0.32) * 30.0, 2.0)) * 0.12;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float k = -0.35 - fi * 0.38 + (i == 2 ? 1.1 : 0.0);
    vec2 gp = lp * k;
    float gs = 0.025 + 0.03 * fract(fi * 0.618 + 0.3);
    float gd = length(p - gp);
    float g = (1.0 - smoothstep(gs * 0.6, gs, gd)) * 0.12 + exp(-gd / gs * 2.0) * 0.05;
    fl += rainbow(fi * 0.21 + 0.1) * g;
  }
  return vec4(scr(s.rgb, clamp(fl, 0.0, 1.0) * A), s.a);
}`, { tags: ['lens flare', 'güneş', 'parlama'] }),

    mp('parlama', 'Parlama (Bloom)', [AMT(0.7, 'Parlama'), R('threshold', 'Eşik', 0, 1, 0.55), R('radius', 'Yayılma', 8, 120, 40, 1), C('color', 'Renk', '#ffffff')], [
      [`vec4 effect(vec2 uv){
  vec2 o = 0.5 / uRes;
  vec4 c = (pm(tx(uv + o)) + pm(tx(uv - o)) + pm(tx(uv + vec2(o.x, -o.y))) + pm(tx(uv - vec2(o.x, -o.y)))) * 0.25;
  float l = luma(c.rgb / max(c.a, 1e-4));
  return vec4(c.rgb * smoothstep(u_threshold, u_threshold + 0.25, l), 1.0);
}`, 0.5],
      [blurH('u_radius'), 0.25],
      [blurV('u_radius'), 0.25],
      [`vec4 effect(vec2 uv){
  vec4 o = ox(uv);
  vec3 g = clamp(tex(uv).rgb * u_amount * uIntensity * 2.2 * u_color, 0.0, 1.0);
  vec3 base = o.rgb * o.a;
  vec3 sum = base + g - base * g;
  float a = clamp(o.a + luma(g) * 1.5, 0.0, 1.0);
  return vec4(clamp(sum / max(a, 1e-4), 0.0, 1.0), a);
}`, 1],
    ], { tags: ['bloom', 'glow', 'ışıltı'] }),

    mp('tanri-isinlari', 'Tanrı Işınları', [AMT(0.8), R('x', 'Işık X', 0, 1, 0.5), R('y', 'Işık Y', 0, 1, 0.85), R('threshold', 'Eşik', 0, 1, 0.5), R('length', 'Işın uzunluğu', 0.2, 1, 0.7), SPD(0.5), C('color', 'Renk', '#fff2d0')], [
      [`vec4 effect(vec2 uv){
  vec4 c = tex(uv);
  float m = smoothstep(u_threshold, u_threshold + 0.3, luma(c.rgb)) * c.a;
  return vec4(c.rgb * m, 1.0);
}`, 0.5],
      [`vec4 effect(vec2 uv){
  vec2 L = vec2(u_x + sin(uTime * u_speed * 0.6) * 0.05, u_y);
  vec2 d = (uv - L) / 40.0 * u_length;
  vec3 acc = vec3(0.0); float w = 1.0; float ws = 0.0;
  vec2 q = uv - d * rand(uv * uRes);
  for (int i = 0; i < 40; i++){ acc += tx(q).rgb * w; ws += w; w *= 0.96; q -= d; }
  return vec4(acc / ws * 2.0, 1.0);
}`, 0.5],
      [`vec4 effect(vec2 uv){
  vec4 o = ox(uv);
  vec3 r = clamp(tex(uv).rgb * u_amount * uIntensity * 1.6 * u_color, 0.0, 1.0);
  return vec4(scr(o.rgb, r), o.a);
}`, 1],
    ], { tags: ['god rays', 'ışın', 'güneş ışığı', 'volumetrik'] }),

    fx('flas-strobe', 'Flaş Strobe', [AMT(0.85), R('rate', 'Flaş/sn', 0.5, 15, 4, 0.5), B('hard', 'Sert', false), C('color', 'Renk', '#ffffff')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float p = fract(uTime * u_rate);
  float f = u_hard > 0.5 ? step(p, 0.25) : exp(-p * 10.0);
  return vec4(mix(s.rgb, u_color, f * u_amount * uIntensity), s.a);
}`, { tags: ['strobe', 'flaş', 'yanıp sönme'] }),

    fx('neon-kenar', 'Neon Kenarlar', [AMT(1), SPD(1), R('bg', 'Arka plan', 0, 1, 0.15), B('mono', 'Tek renk', false), C('color', 'Renk', '#ff2bd6')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float e1 = sobel(uv, px() * 1.2);
  float e2 = sobel(uv, px() * 3.0);
  float e3 = sobel(uv, px() * 7.0);
  float e = smoothstep(0.1, 0.7, e1) + smoothstep(0.1, 0.9, e2) * 0.5 + smoothstep(0.1, 1.0, e3) * 0.3;
  vec3 col = hsv2rgb(vec3(fract(uv.x * 0.5 - uv.y * 0.3 + uTime * u_speed * 0.15), 0.85, 1.0));
  col = mix(col, u_color, u_mono);
  vec3 c = s.rgb * u_bg + col * e * 1.3;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['neon', 'kenar', 'kontur', 'glow'] }),

    fx('simli', 'Simli Parıltı', [AMT(1), R('density', 'Sıklık', 4, 40, 12, 1), SPD(1), R('thresh', 'Parlaklık eşiği', 0, 1, 0.25), C('color', 'Renk', '#fff6d6')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec3 c = s.rgb;
  for (int L = 0; L < 2; L++){
    float fl = float(L);
    float dens = u_density * (1.0 + fl * 0.8);
    vec2 off = vec2(fl * 17.3);
    vec2 p = uv * asp() * dens + off;
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + uSeed * 7.0);
    vec2 o = (r - 0.5) * 0.6;
    vec2 d = f - o;
    if (r.x > 0.5) d = rot(0.785) * d;
    float tw = pow(max(0.0, sin(uTime * u_speed * 4.0 + r.y * 6.28)), 3.0);
    vec2 suv = ((id + 0.5 + o) - off) / dens / asp();
    float k = smoothstep(u_thresh, u_thresh + 0.3, luma(tex(suv).rgb)) * tw;
    float core = exp(-length(d) * 14.0);
    float crs = exp(-abs(d.x) * 40.0) * exp(-abs(d.y) * 4.5) + exp(-abs(d.y) * 40.0) * exp(-abs(d.x) * 4.5);
    c += u_color * (core + crs * 0.8) * k * (0.6 + 0.8 * r.y) * 1.5 * A;
  }
  return vec4(min(c, 1.0), s.a);
}`, { tags: ['glitter', 'sparkle', 'yıldız', 'parıltı'] }),

    fx('gokkusagi-isilti', 'Gökkuşağı Işıltısı', [AMT(0.7), R('scale', 'Bant sıklığı', 0.3, 4, 1.2), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float x = dot(uv * asp(), vec2(0.7, 0.45)) * u_scale - uTime * u_speed * 0.3;
  vec3 rb = rainbow(x);
  vec3 c = mix(s.rgb, sft(s.rgb, rb), 0.8 * A);
  c = scr(c, rb * pow(tri(x * 0.5 + 0.25), 12.0) * 0.35 * A);
  return vec4(c, s.a);
}`, { tags: ['rainbow', 'holografik', 'renkli'] }),

    fx('prizma', 'Prizma', [AMT(0.7), R('angle', 'Açı', 0, 360, 30, 1), SPD(0.3)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float ang = radians(u_angle) + uTime * u_speed * 0.6;
  vec2 dir = vec2(cos(ang), sin(ang)) * 0.03 * A;
  vec3 acc = vec3(0.0), ws = vec3(0.0); float a = 0.0;
  for (int i = 0; i < 9; i++){
    float f = float(i) / 8.0;
    vec3 w = rainbow(f * 0.85);
    vec4 c = tx(uv + dir * (f - 0.5) * 2.0);
    acc += c.rgb * w; ws += w; a = max(a, c.a);
  }
  vec3 c = acc / ws;
  vec3 gh = tex(0.5 + (uv - 0.5) * 0.92 + dir * 2.0).rgb * rainbow(uv.x + uTime * 0.2);
  c = scr(c, gh * 0.25 * A);
  return vec4(c, a);
}`, { tags: ['prism', 'dispersion', 'kırılma'] }),

    fx('parilti-supurme', 'Parıltı Süpürme', [AMT(0.8), PER(2.2), R('width', 'Genişlik', 0.02, 0.4, 0.12), R('angle', 'Açı', 0, 180, 60, 1), C('color', 'Renk', '#ffffff')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float ph = fract(uTime / max(u_period, 0.3));
  float ang = radians(u_angle);
  vec2 dir = vec2(cos(ang), sin(ang));
  float x = dot((uv - 0.5) * asp(), dir);
  float span = 0.5 * (abs(dir.x) * ar() + abs(dir.y)) + u_width * 2.0;
  float pos = mix(-span, span, smoothstep(0.0, 0.8, ph));
  float w = max(u_width, 0.01);
  float band = exp(-pow((x - pos) / w, 2.0) * 2.0);
  float band2 = exp(-pow((x - pos + w * 1.8) / (w * 0.35), 2.0) * 2.0) * 0.6;
  vec3 c = s.rgb + u_color * (band + band2) * u_amount * uIntensity;
  return vec4(min(c, 1.0), s.a);
}`, { tags: ['shine', 'parlama', 'logo', 'yazı'] }),
  ],
}
