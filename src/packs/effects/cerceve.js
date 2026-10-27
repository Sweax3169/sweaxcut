// Çerçeve & Kenarlık: yuvarlak köşe, film şeridi, vizör, polaroid, neon, bölünmüş ekran…
import { R, C, B, S, AMT, SPD, fx, mp, blurV } from './lib.js'

// Bölünmüş ekran (n kopya, hücreye "cover" sığdırma)
const split = (id, name, n, tags) => fx(id, name, [R('gap', 'Ara çizgi', 0, 20, 4, 1), C('color', 'Çizgi rengi', '#000000'), R('zoom', 'Yakınlık', 1, 2, 1)], `
vec4 effect(vec2 uv){
  float n = ${n}.0;
  bool grid = ${n === 4};
  vec2 cells = grid ? vec2(2.0) : (ar() >= 1.0 ? vec2(n, 1.0) : vec2(1.0, n));
  vec2 g = uv * cells;
  vec2 f = fract(g);
  float cellAR = ar() * cells.y / cells.x;
  vec2 q = f;
  if (cellAR < ar()) q.x = 0.5 + (f.x - 0.5) * (cellAR / ar()); else q.y = 0.5 + (f.y - 0.5) * (ar() / cellAR);
  q = 0.5 + (q - 0.5) / u_zoom;
  vec4 s = tex(q);
  vec2 bd = abs(fract(g + 0.5) - 0.5) * uRes / cells;
  if (g.x < 0.5 || g.x > cells.x - 0.5) bd.x = 1e5;
  if (g.y < 0.5 || g.y > cells.y - 0.5) bd.y = 1e5;
  float gw = u_gap * uRes.y / 1080.0 * 0.5;
  float line = gw > 0.0 ? 1.0 - smoothstep(gw - 0.5, gw + 0.5, min(bd.x, bd.y)) : 0.0;
  return vec4(mix(s.rgb, u_color, line), mix(s.a, 1.0, line));
}`, { tags: ['split screen', 'bölünmüş', 'kopya', ...tags] })

export default {
  id: 'cerceve', name: 'Çerçeve & Kenarlık',
  items: [
    fx('yuvarlak-kose', 'Yuvarlak Köşeler', [R('radius', 'Köşe yuvarlaklığı (%)', 0, 50, 12, 1), R('inset', 'İçe kaçış', 0, 0.3, 0.04), R('border', 'Kenarlık', 0, 40, 6, 1), C('color', 'Kenarlık rengi', '#ffffff')], `
vec4 effect(vec2 uv){
  vec2 P = (uv - 0.5) * uRes;
  vec2 hs = uRes * 0.5 * (1.0 - u_inset * uIntensity);
  float r = u_radius / 100.0 * min(hs.x, hs.y);
  float d = sdRBox(P, hs, r);
  float bw = u_border * uRes.y / 1080.0;
  vec4 s = tex(P / (1.0 - u_inset * uIntensity) / uRes + 0.5);
  float inside = 1.0 - smoothstep(-0.75, 0.75, d);
  float bm = bw > 0.0 ? 1.0 - smoothstep(-0.75, 0.75, d + bw) : 1.0;
  return vec4(mix(u_color, s.rgb, bm), inside * mix(1.0, s.a, bm));
}`, { tags: ['rounded', 'köşe', 'kart', 'çerçeve'] }),

    fx('film-seridi', 'Film Şeridi', [R('width', 'Şerit genişliği', 0.04, 0.2, 0.09), R('holes', 'Delik sıklığı', 3, 20, 8, 1), SPD(0.5)], `
vec4 effect(vec2 uv){
  float t = uTime * u_speed;
  vec2 P = uv * asp();
  float bw = u_width * uIntensity;
  float band = min(P.x, ar() - P.x);
  vec4 s = tex(uv);
  float inBand = step(band, bw);
  float hx = band / max(bw, 1e-4);
  float hy = fract(P.y * u_holes - t);
  vec2 hp = vec2((hx - 0.5) * bw, (hy - 0.5) / u_holes);
  float hole = sdRBox(hp, vec2(bw * 0.24, 0.28 / u_holes), 0.012);
  float hm = (1.0 - smoothstep(-0.002, 0.002, hole)) * inBand;
  vec3 c = mix(s.rgb, vec3(0.06, 0.05, 0.04), inBand);
  c = mix(c, vec3(0.95, 0.93, 0.85), hm);
  float ec = inBand * step(0.84, hx) * step(hx, 0.93) * step(0.55, fract(P.y * u_holes * 2.0 - t * 2.0));
  c = mix(c, vec3(0.92, 0.78, 0.25), ec * 0.75);
  return vec4(c, mix(s.a, 1.0, inBand));
}`, { tags: ['film strip', 'film', 'makara', 'perfore'] }),

    fx('vizor-rec', 'Kamera Vizörü (REC)', [AMT(1), R('margin', 'Kenar payı', 0.02, 0.2, 0.06), R('thick', 'Çizgi kalınlığı', 0.5, 3, 1.5), B('grid', 'Üçte bir ızgara', false), C('color', 'Renk', '#ffffff')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = (uv - 0.5) * asp();
  vec2 hb = asp() * 0.5 - u_margin;
  float lw = 0.004 * u_thick;
  float L = 0.09;
  vec2 c = abs(P) - hb;
  float hor = (1.0 - smoothstep(lw * 0.5, lw, abs(c.y))) * step(-L, c.x) * step(c.x, lw * 0.5);
  float ver = (1.0 - smoothstep(lw * 0.5, lw, abs(c.x))) * step(-L, c.y) * step(c.y, lw * 0.5);
  float ui = max(hor, ver);
  ui += (1.0 - smoothstep(lw * 0.5, lw, abs(P.x))) * step(abs(P.y), 0.03) + (1.0 - smoothstep(lw * 0.5, lw, abs(P.y))) * step(abs(P.x), 0.03);
  vec2 bp = P - vec2(hb.x - 0.08, hb.y - 0.05);
  ui += 1.0 - smoothstep(0.0, lw * 0.5, abs(sdBox(bp, vec2(0.04, 0.018))) - lw * 0.5);
  ui += 1.0 - smoothstep(0.0, 0.0015, sdBox(bp - vec2(0.046, 0.0), vec2(0.005, 0.008)));
  for (int i = 0; i < 3; i++) ui += 1.0 - smoothstep(0.0, 0.0015, sdBox(bp - vec2(-0.025 + float(i) * 0.025, 0.0), vec2(0.009, 0.011)));
  ui = clamp(ui, 0.0, 1.0);
  float dotm = (1.0 - smoothstep(0.017, 0.02, length(P - vec2(-hb.x + 0.05, hb.y - 0.05)))) * step(0.5, fract(uTime));
  float gx = min(abs(uv.x - 0.3333), abs(uv.x - 0.6667)) * ar();
  float gy = min(abs(uv.y - 0.3333), abs(uv.y - 0.6667));
  float grid = (1.0 - smoothstep(0.0, 0.0015, min(gx, gy))) * u_grid * 0.5;
  vec3 col = mix(s.rgb, u_color, clamp(ui + grid, 0.0, 1.0) * A);
  col = mix(col, vec3(1.0, 0.12, 0.1), dotm * A);
  return vec4(col, max(s.a, clamp(ui + dotm, 0.0, 1.0) * A));
}`, { tags: ['rec', 'kamera', 'vizör', 'kayıt'] }),

    fx('polaroid-cerceve', 'Polaroid Çerçeve', [R('margin', 'Kenar', 0.02, 0.12, 0.05), C('color', 'Kağıt rengi', '#f4f1ea')], `
vec4 effect(vec2 uv){
  vec2 P = uv * asp();
  float W = ar();
  float m = u_margin * uIntensity;
  vec2 lo = vec2(m, m * 3.2), hi = vec2(W - m, 1.0 - m);
  vec2 sz = hi - lo;
  vec2 rel = (P - lo) / sz;
  float boxAR = sz.x / sz.y;
  vec2 q = rel;
  if (boxAR > W) q.y = 0.5 + (rel.y - 0.5) * (W / boxAR); else q.x = 0.5 + (rel.x - 0.5) * (boxAR / W);
  vec4 s = tex(q);
  float inPhoto = step(0.0, rel.x) * step(rel.x, 1.0) * step(0.0, rel.y) * step(rel.y, 1.0);
  vec3 paper = u_color * (0.96 + 0.04 * noise(uv * uRes * 0.35));
  vec2 e = min(rel, 1.0 - rel) * sz;
  vec3 ph = s.rgb * mix(0.75, 1.0, smoothstep(0.0, 0.02, min(e.x, e.y)));
  ph = mix(ph, ph * 0.9 + vec3(0.04, 0.03, 0.0), 0.5);
  return vec4(mix(paper, ph, inPhoto), 1.0);
}`, { tags: ['polaroid', 'fotoğraf', 'anı', 'çerçeve'] }),

    fx('neon-cerceve', 'Neon Çerçeve', [AMT(1), SPD(1), R('inset', 'İçe kaçış', 0.01, 0.2, 0.05), B('rainbow', 'Gökkuşağı', true), C('color', 'Renk', '#ff2bd6')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = (uv - 0.5) * asp();
  float d = abs(sdRBox(P, asp() * 0.5 - u_inset, 0.04));
  vec3 col = mix(u_color, hsv2rgb(vec3(fract(atan(P.y, P.x) / 6.28318 + t * 0.2), 0.9, 1.0)), u_rainbow);
  float flick = 0.85 + 0.15 * step(0.1, noise(vec2(t * 8.0, 2.0)));
  float core = 1.0 - smoothstep(0.002, 0.005, d);
  float glow = exp(-d * 40.0) * 0.8 + exp(-d * 12.0) * 0.3;
  vec3 c = s.rgb + col * glow * flick * A;
  c = mix(c, mix(col, vec3(1.0), 0.6), core * A * flick);
  return vec4(clamp(c, 0.0, 1.0), max(s.a, clamp((glow + core) * A, 0.0, 1.0)));
}`, { tags: ['neon', 'çerçeve', 'parlak', 'gaming'] }),

    fx('sekilli-vinyet', 'Şekilli Vinyet', [S('shape', 'Şekil', [['daire', 'Daire'], ['kalp', 'Kalp'], ['yildiz', 'Yıldız'], ['elmas', 'Elmas'], ['kare', 'Yuvarlak kare']]), R('size', 'Boyut', 0.3, 2, 1), R('feather', 'Yumuşaklık', 0, 0.3, 0.08), C('color', 'Renk', '#000000'), B('clear', 'Dışı saydam', false)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 P = cp(uv) / u_size;
  float d;
  if (u_shape < 0.5) d = length(P) - 0.45;
  else if (u_shape < 1.5) d = sdHeart(P * 1.1 + vec2(0.0, 0.55)) / 1.1;
  else if (u_shape < 2.5) d = sdStar(P, 0.55, 0.5);
  else if (u_shape < 3.5) d = (abs(P.x) + abs(P.y) - 0.55) * 0.7071;
  else d = sdRBox(P, vec2(0.42), 0.12);
  float f = max(u_feather, 0.002);
  float m = 1.0 - smoothstep(-f, f, d);
  vec3 c = mix(u_color, s.rgb, m);
  float a = u_clear > 0.5 ? s.a * m : mix(1.0, s.a, m);
  return vec4(mix(s.rgb, c, uIntensity), mix(s.a, a, uIntensity));
}`, { tags: ['vignette', 'kalp', 'yıldız', 'maske'] }),

    split('bolunmus-2', 'İkili Ekran', 2, ['2']),
    split('bolunmus-3', 'Üçlü Ekran', 3, ['3']),
    split('bolunmus-4', 'Dörtlü Ekran', 4, ['4', 'ızgara']),

    mp('bulanik-kenarlik', 'Bulanık Kenarlık', [R('scale', 'Görüntü boyutu', 0.5, 1, 0.82), R('blur', 'Bulanıklık', 4, 60, 30, 1), R('dim', 'Karartma', 0, 1, 0.2)], [
      [`vec4 effect(vec2 uv){ return gblur(0.5 + (uv - 0.5) / 1.12, vec2(px().x * u_blur, 0.0)); }`, 0.25],
      [blurV('u_blur'), 0.25],
      [`vec4 effect(vec2 uv){
  float sc = mix(1.0, u_scale, uIntensity);
  vec2 q = 0.5 + (uv - 0.5) / sc;
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec4 s = ox(q);
  vec4 b = tex(uv);
  vec2 e = min(q, 1.0 - q);
  float ds = 1.0 - smoothstep(0.0, 0.05, -min(e.x, e.y));
  vec3 bg = b.rgb * (1.0 - u_dim) * (1.0 - (1.0 - inside) * ds * 0.45);
  return vec4(mix(bg, s.rgb, inside), mix(b.a, s.a, inside));
}`, 1],
    ], { tags: ['blur border', 'bulanık', 'kenarlık', 'arka plan'] }),

    fx('hud-cerceve', 'Oyun HUD Çerçevesi', [AMT(1), SPD(1), C('color', 'Renk', '#5cf2ff')], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 P = (uv - 0.5) * asp();
  vec2 hb = asp() * 0.5 - 0.04;
  vec2 a = abs(P);
  float lw = 0.0025;
  vec2 c = a - hb;
  float L = 0.12, cut = 0.03;
  float h1 = (1.0 - smoothstep(lw * 0.5, lw, abs(c.y))) * step(-L, c.x) * step(c.x, -cut);
  float v1 = (1.0 - smoothstep(lw * 0.5, lw, abs(c.x))) * step(-L, c.y) * step(c.y, -cut);
  float dg = (1.0 - smoothstep(lw * 0.5, lw, abs(c.x + c.y + cut) * 0.7071)) * step(-cut, c.x) * step(-cut, c.y) * step(c.x, 0.0) * step(c.y, 0.0);
  float corners = max(max(h1, v1), dg);
  float tkx = 1.0 - smoothstep(lw * 0.4, lw * 0.9, abs(fract(P.x / 0.05) - 0.5) * 0.05);
  float tky = 1.0 - smoothstep(lw * 0.4, lw * 0.9, abs(fract(P.y / 0.05) - 0.5) * 0.05);
  float ticks = tkx * step(hb.y - 0.015, a.y) * step(a.y, hb.y) * step(a.x, hb.x - L - 0.02)
              + tky * step(hb.x - 0.015, a.x) * step(a.x, hb.x) * step(a.y, hb.y - L - 0.02);
  float sy = fract(t * 0.25) * 2.0 * hb.y - hb.y;
  float inX = step(a.x, hb.x);
  float scan = exp(-abs(P.y - sy) * 200.0) * inX * 0.5 + exp(-max(sy - P.y, 0.0) * 12.0) * step(P.y, sy) * inX * 0.06;
  float r = length(P);
  float ring = (1.0 - smoothstep(lw * 0.5, lw, abs(r - 0.08))) * step(0.0, sin((atan(P.y, P.x) + t) * 3.0));
  float ui = clamp(corners + ticks * 0.6 + ring * 0.8, 0.0, 1.0);
  vec3 col = s.rgb * mix(1.0, vig(uv, 0.4, 1.6), 0.4 * A);
  col = mix(col, u_color, ui * A);
  col += u_color * scan * A;
  return vec4(clamp(col, 0.0, 1.0), max(s.a, ui * A));
}`, { tags: ['hud', 'sci-fi', 'arayüz', 'gaming'] }),

    fx('yirtik-kagit', 'Yırtık Kağıt', [R('width', 'Kağıt genişliği', 0.01, 0.15, 0.05), C('color', 'Kağıt rengi', '#f7f3ea')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  vec2 q = min(uv, 1.0 - uv) * asp();
  float d = min(q.x, q.y);
  float along = q.x < q.y ? P.y : P.x;
  float n = fbm(vec2(along * 18.0, 3.0)) * 0.6 + noise(vec2(along * 90.0, 1.0)) * 0.4;
  float edge = u_width * uIntensity * (0.6 + 0.8 * n);
  float paper = 1.0 - smoothstep(edge - 0.002, edge, d);
  float shadow = (1.0 - smoothstep(edge, edge + 0.025, d)) * (1.0 - paper);
  vec3 pc = u_color * (0.92 + 0.08 * fbm(P * 60.0));
  float fiber = (1.0 - smoothstep(0.0, 0.006, abs(d - edge + 0.004))) * paper * 0.15;
  vec3 c = mix(s.rgb * (1.0 - shadow * 0.45), pc - fiber, paper);
  return vec4(c, mix(s.a, 1.0, paper));
}`, { tags: ['torn paper', 'kağıt', 'yırtık', 'scrapbook'] }),

    fx('zarif-cerceve', 'Zarif Çerçeve', [R('inset', 'Kenar payı', 0.01, 0.15, 0.04), R('thick', 'Kalınlık', 0.5, 4, 1.2), C('color', 'Renk', '#f2e3b3')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 P = (uv - 0.5) * asp();
  vec2 hb = asp() * 0.5 - u_inset;
  float lw = 0.0025 * u_thick;
  float m = (1.0 - smoothstep(lw * 0.5, lw, abs(sdBox(P, hb)))) + (1.0 - smoothstep(lw * 0.3, lw * 0.6, abs(sdBox(P, hb - 0.012)))) * 0.8;
  vec2 cq = abs(P) - (hb - 0.006);
  m += 1.0 - smoothstep(0.0, 0.002, (abs(cq.x) + abs(cq.y)) * 0.7071 - 0.012);
  m = clamp(m, 0.0, 1.0) * uIntensity;
  return vec4(mix(s.rgb, u_color, m), max(s.a, m));
}`, { tags: ['elegant', 'klasik', 'altın', 'düğün'] }),

    fx('isiltili-cerceve', 'Işıltılı Çerçeve', [AMT(1), SPD(1), R('width', 'Kenar genişliği', 0.03, 0.3, 0.12), C('color', 'Renk', '#fff1b8'), B('rainbow', 'Renkli', false)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 s = tex(uv);
  vec2 q = min(uv, 1.0 - uv) * asp();
  float band = 1.0 - smoothstep(u_width * 0.5, u_width, min(q.x, q.y));
  vec2 P = uv * asp() * 30.0;
  vec2 id = floor(P); vec2 f = fract(P) - 0.5;
  vec2 r = h22(id + uSeed);
  vec2 dd = f - (r - 0.5) * 0.5;
  float tw = pow(max(0.0, sin(t * 4.0 + r.y * 6.28)), 4.0);
  float star = (exp(-length(dd) * 10.0) + exp(-abs(dd.x) * 30.0) * exp(-abs(dd.y) * 4.0) + exp(-abs(dd.y) * 30.0) * exp(-abs(dd.x) * 4.0)) * tw * step(0.45, r.x);
  vec3 col = mix(u_color, hsv2rgb(vec3(r.y, 0.5, 1.0)), u_rainbow);
  vec3 c = s.rgb + col * star * band * 1.4 * A + col * band * 0.12 * A;
  return vec4(clamp(c, 0.0, 1.0), max(s.a, clamp(star * band * A, 0.0, 1.0)));
}`, { tags: ['sparkle', 'ışıltı', 'yıldız', 'çerçeve'] }),
  ],
}
