// Sanatsal: çizgi film, karakalem, yağlı boya, suluboya, ASCII, duotone, mozaik…
import { R, C, B, AMT, SPD, fx } from './lib.js'

export default {
  id: 'sanat', name: 'Sanatsal',
  items: [
    fx('cizgi-film', 'Çizgi Film', [AMT(1), R('levels', 'Ton basamağı', 2, 8, 4, 1), R('edge', 'Çizgi gücü', 0.5, 2, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 d = px() * 2.0;
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec3 c = tx(uv + vec2(float(i), float(j)) * d).rgb;
    float w = exp(-dot(c - s.rgb, c - s.rgb) * 20.0);
    acc += c * w; ws += w;
  }
  vec3 h = rgb2hsv(acc / ws);
  h.z = floor(h.z * u_levels + 0.5) / u_levels;
  h.y = min(1.0, h.y * 1.25);
  vec3 c = hsv2rgb(h);
  c *= 1.0 - smoothstep(0.2 / u_edge, 0.45 / u_edge, sobel(uv, px() * 1.5));
  return vec4(mix(s.rgb, c, A), s.a);
}`, { tags: ['cartoon', 'toon', 'anime', 'çizgi'] }),

    fx('karakalem', 'Karakalem', [AMT(1), R('edge', 'Çizgi gücü', 0.5, 3, 1.4), R('tint', 'Renkli kalem', 0, 1, 0)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  float l = luma(s.rgb);
  float lines = 1.0 - smoothstep(0.1, 0.6, sobel(uv, px() * 1.5) * u_edge);
  vec2 P = uv * uRes / max(1.0, uRes.y / 720.0);
  float h1 = smoothstep(0.3, 0.7, abs(sin((P.x + P.y) * 0.9 + noise(P * 0.05) * 3.0)));
  float h2 = smoothstep(0.3, 0.7, abs(sin((P.x - P.y) * 0.9 + noise(P * 0.05 + 7.0) * 3.0)));
  float shade = mix(1.0, mix(1.0, h1, 0.6), 1.0 - smoothstep(0.35, 0.65, l));
  shade *= mix(1.0, mix(1.0, h2, 0.6), 1.0 - smoothstep(0.1, 0.35, l));
  float g = lines * shade * (0.94 + 0.06 * fbm(uv * uRes * 0.15));
  g = mix(g, g * (0.75 + 0.25 * l), 0.6);
  vec3 c = vec3(g) * vec3(1.0, 0.99, 0.96);
  c = mix(c, c * mix(vec3(1.0), s.rgb * 1.3, 0.5), u_tint);
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['pencil', 'sketch', 'çizim', 'kalem'] }),

    fx('yagli-boya', 'Yağlı Boya', [AMT(1), R('radius', 'Fırça boyutu', 2, 24, 10, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 d = px() * u_radius / 3.0;
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 v0 = vec3(0.0), v1 = vec3(0.0), v2 = vec3(0.0), v3 = vec3(0.0);
  for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++){
    vec2 o = vec2(float(i), float(j)) * d;
    vec3 c0 = tx(uv - o).rgb; m0 += c0; v0 += c0 * c0;
    vec3 c1 = tx(uv + vec2(o.x, -o.y)).rgb; m1 += c1; v1 += c1 * c1;
    vec3 c2 = tx(uv + vec2(-o.x, o.y)).rgb; m2 += c2; v2 += c2 * c2;
    vec3 c3 = tx(uv + o).rgb; m3 += c3; v3 += c3 * c3;
  }
  m0 /= 16.0; m1 /= 16.0; m2 /= 16.0; m3 /= 16.0;
  vec3 s0 = abs(v0 / 16.0 - m0 * m0), s1 = abs(v1 / 16.0 - m1 * m1), s2 = abs(v2 / 16.0 - m2 * m2), s3 = abs(v3 / 16.0 - m3 * m3);
  float e0 = s0.r + s0.g + s0.b, e1 = s1.r + s1.g + s1.b, e2 = s2.r + s2.g + s2.b, e3 = s3.r + s3.g + s3.b;
  vec3 res = m0; float best = e0;
  if (e1 < best) { best = e1; res = m1; }
  if (e2 < best) { best = e2; res = m2; }
  if (e3 < best) { best = e3; res = m3; }
  float n = noise(uv * uRes * 0.25) - noise(uv * uRes * 0.25 + vec2(0.7, 0.0));
  res = satur(res * (1.0 + n * 0.1), 1.15);
  return vec4(mix(s.rgb, clamp(res, 0.0, 1.0), A), s.a);
}`, { tags: ['oil paint', 'tablo', 'boya', 'kuwahara'] }),

    fx('suluboya', 'Suluboya', [AMT(1), R('bleed', 'Akma', 0, 2, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  vec2 w = (vec2(fbm(P * 6.0), fbm(P * 6.0 + 5.2)) - 0.5) * 0.02 * u_bleed;
  vec3 c = disk(uv + w, px() * 6.0).rgb;
  c = floor(c * 6.0 + 0.5) / 6.0 * 0.5 + c * 0.5;
  c *= 1.0 - smoothstep(0.1, 0.8, sobel(uv + w, px() * 2.5)) * 0.35;
  c = mix(c, c * c, (fbm(P * 14.0) - 0.4) * 0.6);
  c = mix(vec3(1.0), c, 0.85) * (fbm(uv * uRes * 0.12) * 0.15 + 0.88);
  c = satur(c, 1.15);
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), A), s.a);
}`, { tags: ['watercolor', 'suluboya', 'resim', 'kağıt'] }),

    fx('kabartma', 'Kabartma', [AMT(1), R('angle', 'Işık açısı', 0, 360, 135, 1), R('depth', 'Derinlik', 1, 8, 2), R('tint', 'Renk koru', 0, 1, 0)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float a = radians(u_angle);
  vec2 d = vec2(cos(a), sin(a)) * px() * u_depth;
  float e = (lumA(tex(uv + d)) - lumA(tex(uv - d))) * 2.0 + 0.5;
  vec3 g = vec3(clamp(e, 0.0, 1.0));
  vec3 c = mix(g, ovl(s.rgb, g), u_tint);
  return vec4(mix(s.rgb, c, u_amount * uIntensity), s.a);
}`, { tags: ['emboss', 'kabartma', 'metal', 'taş'] }),

    fx('ascii', 'ASCII Blokları', [R('size', 'Hücre boyu', 8, 48, 18, 1), B('mono', 'Tek renk', true), C('color', 'Renk', '#33ff66')], `
float glyph(vec2 f, float lvl){
  vec2 p = f - 0.5;
  float lw = 0.09;
  float hl = (1.0 - smoothstep(lw * 0.5, lw, abs(p.y))) * step(abs(p.x), 0.3);
  float vl = (1.0 - smoothstep(lw * 0.5, lw, abs(p.x))) * step(abs(p.y), 0.32);
  if (lvl < 1.0) return 0.0;
  if (lvl < 2.0) return 1.0 - smoothstep(0.06, 0.1, length(p + vec2(0.0, 0.25)));
  if (lvl < 3.0) return (1.0 - smoothstep(0.06, 0.1, length(p - vec2(0.0, 0.15)))) + (1.0 - smoothstep(0.06, 0.1, length(p + vec2(0.0, 0.2))));
  if (lvl < 4.0) return hl;
  if (lvl < 5.0) return max(hl, vl);
  if (lvl < 6.0) return (1.0 - smoothstep(lw * 0.4, lw * 0.8, min(abs(p.x - p.y), abs(p.x + p.y)) * 0.7071)) * step(max(abs(p.x), abs(p.y)), 0.32);
  if (lvl < 7.0) return 1.0 - smoothstep(lw * 0.4, lw * 0.8, abs(length(p * vec2(1.0, 0.8)) - 0.25));
  float h2 = (1.0 - smoothstep(lw * 0.4, lw * 0.8, abs(abs(p.y) - 0.13))) * step(abs(p.x), 0.32);
  float v2 = (1.0 - smoothstep(lw * 0.4, lw * 0.8, abs(abs(p.x) - 0.12))) * step(abs(p.y), 0.36);
  return max(h2, v2);
}
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 cell = px() * vec2(u_size * 0.6, u_size);
  vec2 g = uv / cell;
  vec2 id = floor(g);
  vec4 c = tex((id + 0.5) * cell);
  float lvl = floor(clamp(luma(c.rgb) * 1.1, 0.0, 0.999) * 8.0);
  float m = clamp(glyph(fract(g), lvl), 0.0, 1.0);
  vec3 ink = u_mono > 0.5 ? u_color : c.rgb * 1.3;
  vec3 col = mix(vec3(0.02), ink, m);
  return vec4(mix(s.rgb, clamp(col, 0.0, 1.0), uIntensity), s.a);
}`, { tags: ['ascii', 'metin', 'terminal', 'kod'] }),

    fx('nokta-matris', 'LED Nokta Matris', [R('size', 'Nokta boyutu', 4, 40, 12, 1)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 cell = px() * u_size;
  vec2 g = (uv - 0.5) / cell;
  vec2 f = fract(g) - 0.5;
  vec4 c = tex((floor(g) + 0.5) * cell + 0.5);
  float r = length(f);
  vec3 col = c.rgb * ((1.0 - smoothstep(0.32, 0.42, r)) * 1.25 + exp(-r * 5.0) * 0.4) + vec3(0.015);
  return vec4(mix(s.rgb, clamp(col, 0.0, 1.0), uIntensity), s.a);
}`, { tags: ['led', 'dot matrix', 'ekran', 'stadyum'] }),

    fx('cift-ton', 'Çift Ton (Duotone)', [AMT(1), C('dark', 'Koyu renk', '#1b1464'), C('light', 'Açık renk', '#ff6fb5'), R('contrast', 'Kontrast', 0.5, 2, 1.1)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float l = clamp((smoothstep(0.02, 0.98, luma(s.rgb)) - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  return vec4(mix(s.rgb, mix(u_dark, u_light, l), u_amount * uIntensity), s.a);
}`, { tags: ['duotone', 'iki renk', 'spotify', 'poster'] }),

    fx('uc-ton', 'Üç Ton (Tritone)', [AMT(1), C('c1', 'Gölge', '#0b1d3a'), C('c2', 'Orta ton', '#d94f5c'), C('c3', 'Işık', '#ffe9a8')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float l = luma(s.rgb);
  vec3 c = l < 0.5 ? mix(u_c1, u_c2, smoothstep(0.0, 0.5, l)) : mix(u_c2, u_c3, smoothstep(0.5, 1.0, l));
  return vec4(mix(s.rgb, c, u_amount * uIntensity), s.a);
}`, { tags: ['tritone', 'üç renk', 'gradyan haritası'] }),

    fx('renk-vurgu', 'Renk Vurgusu', [AMT(1), R('hue', 'Korunan renk tonu', 0, 360, 0, 1), R('range', 'Aralık', 0.02, 0.4, 0.12)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec3 h = rgb2hsv(s.rgb);
  float d = abs(h.x - u_hue / 360.0); d = min(d, 1.0 - d);
  float keep = (1.0 - smoothstep(u_range * 0.5, u_range * 0.5 + 0.06, d)) * smoothstep(0.12, 0.3, h.y);
  vec3 c = mix(vec3(luma(s.rgb)), satur(s.rgb, 1.2), keep);
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), u_amount * uIntensity), s.a);
}`, { tags: ['color pop', 'color splash', 'tek renk', 'seçici renk'] }),

    fx('buzlu-cam', 'Buzlu Cam', [AMT(1), R('size', 'Pürüz', 4, 60, 24, 1), R('frost', 'Beyazlık', 0, 1, 0.4)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 n = vec2(rand(uv * uRes), rand(uv * uRes + 17.3)) - 0.5;
  vec2 n2 = vec2(noise(uv * uRes * 0.08), noise(uv * uRes * 0.08 + 9.1)) - 0.5;
  vec4 c = disk(uv + (n * 0.7 + n2 * 0.6) * px() * u_size, px() * u_size * 0.5);
  c.rgb = mix(c.rgb, vec3(1.0), 0.12 * u_frost);
  return vec4(mix(s.rgb, c.rgb, u_amount * uIntensity), mix(s.a, c.a, u_amount * uIntensity));
}`, { tags: ['frosted glass', 'cam', 'buzlu', 'gizlilik'] }),

    fx('mozaik', 'Mozaik Karolar', [R('density', 'Karo sıklığı', 5, 80, 24, 1), C('grout', 'Derz rengi', '#2a2622')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec4 v = voro(uv * asp() * u_density);
  vec4 c = tex(((v.zw + h22(v.zw)) / u_density) / asp());
  float grout = 1.0 - smoothstep(0.02, 0.06, v.y);
  vec3 col = c.rgb * (0.88 + 0.2 * rand(v.zw)) * (0.8 + 0.2 * smoothstep(0.0, 0.25, v.y));
  col = mix(col, u_grout, grout);
  return vec4(mix(s.rgb, col, uIntensity), s.a);
}`, { tags: ['mosaic', 'karo', 'fayans', 'voronoi'] }),

    fx('altigen-piksel', 'Altıgen Piksel', [R('size', 'Hücre boyutu', 6, 80, 24, 1), R('border', 'Kenar', 0, 1, 0.35)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float sc = 1080.0 / u_size;
  vec2 P = uv * asp() * sc;
  vec4 h = hexCell(P);
  vec4 c = tex((P - h.xy) / sc / asp());
  vec3 col = c.rgb * (1.0 - smoothstep(0.44, 0.5, hexDist(h.xy)) * u_border);
  return vec4(mix(s.rgb, col, uIntensity), s.a);
}`, { tags: ['hexagon', 'petek', 'piksel', 'altıgen'] }),

    fx('pop-art', 'Pop Art', [R('contrast', 'Kontrast', 0.8, 2.5, 1.6)], `
vec4 effect(vec2 uv){
  vec2 g = uv * 2.0;
  vec2 id = floor(g); vec2 f = fract(g);
  vec4 s = tex(f);
  float l = clamp((luma(s.rgb) - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float q = min(floor(l * 3.0) / 2.0, 1.0);
  float k = id.x + id.y * 2.0;
  vec3 a, b, c;
  if (k < 0.5) { a = vec3(0.1, 0.1, 0.5); b = vec3(1.0, 0.2, 0.55); c = vec3(1.0, 0.92, 0.2); }
  else if (k < 1.5) { a = vec3(0.6, 0.0, 0.3); b = vec3(0.1, 0.75, 0.95); c = vec3(1.0, 0.95, 0.85); }
  else if (k < 2.5) { a = vec3(0.05, 0.3, 0.2); b = vec3(1.0, 0.5, 0.0); c = vec3(0.6, 1.0, 0.4); }
  else { a = vec3(0.25, 0.0, 0.45); b = vec3(1.0, 0.85, 0.0); c = vec3(1.0, 0.45, 0.75); }
  vec3 col = q < 0.25 ? a : q < 0.75 ? b : c;
  vec2 dp = fract(uv * uRes / max(4.0, uRes.y / 90.0)) - 0.5;
  col = mix(col, col * 0.85, (1.0 - smoothstep(0.25, 0.35, length(dp))) * 0.5);
  col *= 1.0 - smoothstep(0.3, 0.6, sobel(f, px() * 3.0)) * 0.8;
  return vec4(mix(tex(uv).rgb, col, uIntensity), mix(tex(uv).a, s.a, uIntensity));
}`, { tags: ['pop art', 'warhol', 'poster', '4lü'] }),

    fx('kontur', 'Kontur Çizgileri', [R('levels', 'Çizgi sayısı', 4, 30, 12, 1), SPD(0.3), B('bg', 'Koyu zemin', true)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float l = luma(disk(uv, px() * 3.0).rgb) * u_levels + uTime * u_speed;
  float f = abs(fract(l) - 0.5);
  float w = max(fwidth(l) * 1.5, 0.02);
  float line = 1.0 - smoothstep(0.0, w, 0.5 - f);
  vec3 col = u_bg > 0.5 ? mix(vec3(0.03, 0.04, 0.08), hsv2rgb(vec3(fract(floor(l) * 0.13), 0.7, 1.0)), line) : mix(s.rgb * 0.7, vec3(1.0), line);
  return vec4(mix(s.rgb, col, uIntensity), s.a);
}`, { tags: ['contour', 'topografik', 'harita', 'çizgi'] }),

    fx('mavi-baski', 'Mavi Baskı (Blueprint)', [AMT(1)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 P = uv * asp();
  vec2 g1 = abs(fract(P * 20.0 + 0.5) - 0.5) / 20.0;
  vec2 g2 = abs(fract(P * 4.0 + 0.5) - 0.5) / 4.0;
  float grid = (1.0 - smoothstep(0.0, 0.0012, min(g1.x, g1.y))) * 0.18 + (1.0 - smoothstep(0.0, 0.0018, min(g2.x, g2.y))) * 0.35;
  vec3 bg = vec3(0.05, 0.25, 0.55) * (0.9 + 0.1 * fbm(P * 4.0));
  float ink = smoothstep(0.12, 0.5, sobel(uv, px() * 1.5));
  vec3 c = bg + vec3(0.85, 0.92, 1.0) * clamp(ink + grid, 0.0, 1.0) * 0.9;
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), u_amount * uIntensity), s.a);
}`, { tags: ['blueprint', 'teknik çizim', 'mavi', 'mimari'] }),

    fx('tarama-cizim', 'Tarama Çizim', [AMT(1), R('size', 'Çizgi aralığı', 0.5, 4, 1.5), C('ink', 'Mürekkep', '#1d2340')], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  float l = luma(s.rgb);
  vec2 P = uv * uRes / max(1.0, uRes.y / 720.0) / u_size;
  float h1 = 1.0 - smoothstep(0.08, 0.18, abs(fract((P.x + P.y) * 0.25) - 0.5));
  float h2 = 1.0 - smoothstep(0.08, 0.18, abs(fract((P.x - P.y) * 0.25) - 0.5));
  float h3 = 1.0 - smoothstep(0.08, 0.18, abs(fract(P.y * 0.25) - 0.5));
  float h4 = 1.0 - smoothstep(0.08, 0.18, abs(fract(P.x * 0.25) - 0.5));
  float ink = h1 * step(l, 0.75);
  ink = max(ink, h2 * step(l, 0.5));
  ink = max(ink, h3 * step(l, 0.3));
  ink = max(ink, h4 * step(l, 0.15));
  ink = max(ink, smoothstep(0.2, 0.6, sobel(uv, px() * 1.5)));
  vec3 c = mix(vec3(0.96, 0.94, 0.88), u_ink, ink);
  return vec4(mix(s.rgb, c, u_amount * uIntensity), s.a);
}`, { tags: ['crosshatch', 'tarama', 'mürekkep', 'gravür'] }),

    fx('vitray', 'Vitray', [R('density', 'Cam sıklığı', 4, 40, 12, 1)], `
vec4 effect(vec2 uv){
  vec4 s = tex(uv);
  vec2 P = uv * asp() * u_density;
  vec4 v = voro(P);
  vec3 c = tex(((v.zw + h22(v.zw)) / u_density) / asp()).rgb;
  vec3 h = rgb2hsv(c); h.y = min(1.0, h.y * 1.5 + 0.15); h.z = 0.35 + h.z * 0.75; c = hsv2rgb(h);
  c *= 0.85 + 0.3 * fbm(P * 3.0 + v.zw);
  c += c * exp(-v.x * 2.0) * 0.25;
  c = mix(c, vec3(0.04), 1.0 - smoothstep(0.03, 0.07, v.y));
  return vec4(mix(s.rgb, clamp(c, 0.0, 1.0), uIntensity), s.a);
}`, { tags: ['stained glass', 'vitray', 'kilise', 'cam'] }),

    fx('kristal', 'Kristal Kırılma', [AMT(1), R('density', 'Parça sıklığı', 2, 20, 6, 1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 P = uv * asp() * u_density;
  vec2 g = floor(P); vec2 f = fract(P);
  vec2 id = g * 2.0 + step(f.x, f.y);
  vec4 c = tex(uv + (h22(id + uSeed) - 0.5) * 0.06 * A);
  float e = min(min(min(f.x, f.y), min(1.0 - f.x, 1.0 - f.y)), abs(f.x - f.y) * 0.7071);
  float edge = 1.0 - smoothstep(0.0, 0.03, e);
  c.rgb = mix(c.rgb, c.rgb * (0.85 + 0.3 * rand(id + 3.0)), A) + edge * 0.25 * A;
  c.rgb += rainbow(rand(id) + uTime * 0.1) * 0.06 * A;
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`, { tags: ['crystal', 'kristal', 'prizma', 'kırık'] }),
  ],
}
