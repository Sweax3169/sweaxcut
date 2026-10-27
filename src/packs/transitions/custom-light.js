// Özel geçişler — ışık & flaş, glitch
import { UV, EASE, NOISE, HASH } from './glsl-lib.js'
import { T } from './custom-motion.js'

const P = (key, label, def, min, max, type = 'float') => ({ key, label, type, default: def, min, max, step: type === 'float' ? +((max - min) / 100).toPrecision(2) : 1 })
const C = (key, label, def) => ({ key, label, type: 'color', default: def })

// ---------------------------------------------------------------- flaşlar
const flash = (colorExpr, shape) => `
vec4 transition(vec2 uv){
  vec4 c = progress < 0.5 ? getFromColor(uv) : getToColor(uv);
  float w = 1.0 - abs(progress - 0.5) * 2.0;
  w = clamp(${shape} * strength, 0.0, 1.0);
  return vec4(mix(c.rgb, ${colorExpr}, w), c.a);
}`

const cameraFlash = `
vec4 transition(vec2 uv){
  float p = progress;
  float w = p < 0.5 ? pow(p * 2.0, 6.0) : exp(-(p - 0.5) * 9.0);
  float z = p < 0.5 ? 1.0 + 0.05 * p * 2.0 : 1.0 + 0.07 * (1.0 - (p - 0.5) * 2.0);
  vec2 q = 0.5 + (uv - 0.5) / z;
  bool first = p < 0.5;
  vec4 c = first ? getFromColor(q) : getToColor(q);
  vec3 b = vec3(0.0);
  for (int i = 0; i < 8; i++){
    float a = float(i) * 0.785398;
    vec2 o = vec2(cos(a) / ratio, sin(a)) * 0.018;
    b += (first ? getFromColor(q + o) : getToColor(q + o)).rgb;
  }
  b /= 8.0;
  vec3 col = c.rgb + b * b * w * 1.2;
  col = mix(col, vec3(1.0), w * strength);
  return vec4(clamp(col, 0.0, 1.0), c.a);
}`

const lightLeak = `
vec3 leak(vec2 uv, float t){
  vec2 q = uv; q.x *= ratio;
  vec2 c1 = vec2(mix(-0.3, 1.3, t) * ratio, 0.7 + 0.2 * sin(t * 3.0));
  vec2 c2 = vec2(mix(1.2, -0.2, t) * ratio, 0.25);
  vec2 c3 = vec2(0.5 * ratio + 0.4 * sin(t * 4.0), mix(1.2, -0.2, t));
  vec3 col = tint * exp(-dot(q - c1, q - c1) * 3.0);
  col += vec3(1.0, 0.15, 0.25) * exp(-dot(q - c2, q - c2) * 2.5);
  col += vec3(1.0, 0.85, 0.4) * exp(-dot(q - c3, q - c3) * 5.0);
  return col;
}
vec4 transition(vec2 uv){
  float p = progress;
  vec4 c = mix(getFromColor(uv), getToColor(uv), smoothstep(0.3, 0.7, p));
  float k = sin(T_PI * p) * strength;
  vec3 L = clamp(leak(uv, p) * k * 1.6, 0.0, 1.0);
  vec3 col = 1.0 - (1.0 - c.rgb) * (1.0 - L);
  col += L * 0.2 * k;
  return vec4(clamp(col, 0.0, 1.0), c.a);
}`

const filmBurn = `
vec4 transition(vec2 uv){
  float p = progress;
  vec2 q = uv * vec2(ratio, 1.0) / max(ratio, 1.0);
  float n = t_fbm(q * 3.0 + vec2(0.0, p * 0.6));
  vec2 m = vec2(ratio, 1.0) / max(ratio, 1.0);
  float d = min(length(q - vec2(0.2, 0.3) * m), length(q - vec2(0.85, 0.75) * m));
  float field = n * 0.65 + d * 0.5;
  float t = mix(0.15, 0.82, p);
  float s = smoothness;
  float keep = smoothstep(t - s, t + s, field);
  vec4 A = getFromColor(uv), B = getToColor(uv);
  A.rgb *= mix(1.0, 0.35 + 0.65 * smoothstep(t, t + 0.15, field), smoothstep(0.0, 0.1, p));
  vec4 c = mix(B, A, keep);
  float e = 1.0 - smoothstep(0.0, s * 3.0, abs(field - t));
  vec3 glow = mix(vec3(1.0, 0.25, 0.0), vec3(1.0, 0.9, 0.55), e * e);
  c.rgb += glow * e * 1.6 * sin(T_PI * p);
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`

const lumaFade = `
vec4 transition(vec2 uv){
  vec4 a = getFromColor(uv), b = getToColor(uv);
  float l = dot(a.rgb, vec3(0.299, 0.587, 0.114));
  if (invert) l = 1.0 - l;
  float x = 1.0 - l;
  float t = progress * (1.0 + smoothness);
  return mix(a, b, smoothstep(x, x + smoothness, t));
}`

const burst = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p);
  vec2 q = t_ac(uv);
  float r = length(q);
  float a = atan(q.y, q.x);
  float z = 1.0 + 0.18 * k;
  vec2 s = 0.5 + (uv - 0.5) / z;
  vec4 c = p < 0.5 ? getFromColor(s) : getToColor(s);
  float rays = 0.5 + 0.5 * sin(a * 13.0 + p * 6.0) * sin(a * 7.0 - p * 4.0);
  float glow = k * (0.12 / (r + 0.12)) * (0.5 + 0.8 * rays * rays);
  float ring = exp(-pow((r - p * 1.4) * 9.0, 2.0)) * k;
  vec3 col = c.rgb + tint * (glow * 1.6 + ring * 0.8) * strength;
  col = mix(col, vec3(1.0), pow(k, 8.0) * strength);
  return vec4(clamp(col, 0.0, 1.0), c.a);
}`

const glare = `
vec4 transition(vec2 uv){
  float p = progress;
  float d = (uv.x * ratio + uv.y) / (ratio + 1.0);
  float pos = mix(-width, 1.0 + width, p);
  float x = (d - pos) / width;
  float w = 1.0 - smoothstep(-0.3, 0.3, x);
  vec4 c = mix(getFromColor(uv), getToColor(uv), w);
  float fade = smoothstep(0.0, 0.08, p) * smoothstep(1.0, 0.92, p);
  float band = (exp(-x * x * 4.0) * 0.9 + exp(-x * x * 80.0) * 0.8) * fade;
  c.rgb = c.rgb + tint * band * strength;
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`

// ---------------------------------------------------------------- glitch
const glitchCut = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p) * strength;
  float fr = floor(p * 24.0);
  float rows = 18.0;
  float row = floor(uv.y * rows + t_hash(vec2(fr, 3.0)) * 4.0);
  float rnd = t_hash(vec2(row, fr));
  float on = step(0.5, t_hash(vec2(row * 1.7, fr + 9.0)));
  float shift = (rnd - 0.5) * 0.3 * k * on;
  float blk = t_hash(vec2(floor(uv.x * 6.0), row + fr * 3.1));
  bool useB = p + (blk - 0.5) * 0.5 * k > 0.5;
  vec2 s = vec2(fract(uv.x + shift), uv.y);
  vec2 o = vec2(0.02 * k * (0.5 + rnd), 0.0);
  vec4 c = useB ? getToColor(s) : getFromColor(s);
  float r = useB ? getToColor(s + o).r : getFromColor(s + o).r;
  float b = useB ? getToColor(s - o).b : getFromColor(s - o).b;
  vec3 col = vec3(r, c.g, b);
  float inv = step(0.93, t_hash(vec2(row + 4.0, fr * 1.3))) * step(0.3, k);
  col = mix(col, 1.0 - col, inv * 0.8);
  col *= mix(1.0, 0.85 + 0.15 * sin(uv.y * 900.0), k);
  return vec4(col, c.a);
}`

const rgbSplit = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p) * strength;
  float z = 1.0 + 0.06 * k;
  vec2 s = 0.5 + (uv - 0.5) / z;
  vec2 o = vec2(0.05, 0.01) * k;
  float pr = smoothstep(0.25, 0.5, p), pg = smoothstep(0.38, 0.62, p), pb = smoothstep(0.5, 0.75, p);
  float r = mix(getFromColor(s + o).r, getToColor(s + o).r, pr);
  vec4 g = mix(getFromColor(s), getToColor(s), pg);
  float b = mix(getFromColor(s - o).b, getToColor(s - o).b, pb);
  return vec4(r, g.g, b, g.a);
}`

const shakeCut = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p); k = k * k * strength;
  float fr = floor(p * 30.0);
  vec2 off = (vec2(t_hash(vec2(fr, 1.0)), t_hash(vec2(fr, 2.0))) - 0.5) * 0.14 * k;
  vec2 off2 = (vec2(t_hash(vec2(fr - 1.0, 1.0)), t_hash(vec2(fr - 1.0, 2.0))) - 0.5) * 0.14 * k;
  float rot = (t_hash(vec2(fr, 3.0)) - 0.5) * 0.15 * k;
  float z = 1.0 + 0.12 * k;
  bool first = p < 0.5;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++){
    float f = float(i) / 5.0;
    vec2 q = t_uv(t_rot(t_ac(uv), rot) / z) + mix(off, off2, f * 0.6);
    acc += first ? t_fromM(q) : t_toM(q);
  }
  return acc / 6.0;
}`

const teleport = `
vec4 transition(vec2 uv){
  float p = progress;
  float a = 1.0 - abs(p - 0.5) * 2.0;
  float fr = floor(p * 30.0);
  float sq = smoothstep(0.55, 1.0, a);
  float h = mix(1.0, 0.004, sq);
  float y = (uv.y - 0.5) / h + 0.5;
  float row = floor(uv.y * 70.0);
  float shift = (t_hash(vec2(row, fr)) - 0.5) * 0.5 * smoothstep(0.1, 0.8, a) * step(0.45, t_hash(vec2(row, fr + 7.0)));
  vec2 s = vec2(uv.x + shift, y);
  vec4 c = p < 0.5 ? getFromColor(s) : getToColor(s);
  float inBand = step(0.0, y) * step(y, 1.0);
  float L = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  vec3 col = mix(c.rgb, tint * (L * 1.5 + 0.15), smoothstep(0.15, 0.85, a)) * inBand;
  col *= 1.0 + 0.6 * sq;
  float glow = exp(-abs(uv.y - 0.5) * mix(600.0, 18.0, sq * sq)) * sq;
  col += mix(tint, vec3(1.0), 0.5) * glow * 1.4;
  return vec4(clamp(col, 0.0, 1.0), mix(c.a * inBand, 1.0, max(sq, glow)));
}`

const vhs = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p);
  float fr = floor(p * 24.0);
  float yy = uv.y + k * k * 0.7 * (p < 0.5 ? p * 2.0 : (p - 1.0) * 2.0);
  float y2 = fract(yy);
  float bar = smoothstep(0.0, 0.03, y2) * smoothstep(1.0, 0.97, y2);
  float band = step(0.72, t_noise(vec2(uv.y * 9.0 + fr * 3.7, fr)));
  float sh = band * (t_hash(vec2(floor(uv.y * 140.0), fr)) - 0.5) * 0.1 * k + sin(uv.y * 40.0 + fr) * 0.004 * k;
  vec2 s = vec2(uv.x + sh, y2);
  bool first = p < 0.5;
  vec4 c = first ? getFromColor(s) : getToColor(s);
  vec2 o = vec2(0.008 * k, 0.0);
  float r = (first ? getFromColor(s + o) : getToColor(s + o)).r;
  float b = (first ? getFromColor(s - o) : getToColor(s - o)).b;
  vec3 col = vec3(r, c.g, b);
  float n = t_hash(uv * vec2(420.0, 310.0) + fr);
  col = mix(col, vec3(n), band * 0.65 * k);
  col *= mix(1.0, bar, k);
  col = mix(col, col * vec3(1.06, 0.94, 1.1) + 0.04, k);
  return vec4(clamp(col, 0.0, 1.0), c.a);
}`

export const LIGHT = [
  T('beyaz-flas', 'Beyaz Flaş', 'isik', 0.4, [P('strength', 'Güç', 1, 0, 1)], flash('vec3(1.0)', 'pow(w, 2.2)')),
  T('siyah-flas', 'Kararak Kes', 'isik', 0.4, [P('strength', 'Güç', 1, 0, 1)], flash('vec3(0.0)', 'pow(w, 1.4)')),
  T('renk-flasi', 'Renk Flaşı', 'isik', 0.4, [C('color', 'Renk', '#ff2d6f'), P('strength', 'Güç', 1, 0, 1)], flash('color', 'pow(w, 1.8)')),
  T('kamera-flasi', 'Kamera Flaşı', 'isik', 0.6, [P('strength', 'Güç', 1, 0, 1)], cameraFlash),
  T('isik-sizintisi', 'Işık Sızıntısı', 'isik', 1.0, [C('tint', 'Renk', '#ff7a1a'), P('strength', 'Güç', 1, 0, 2)], lightLeak),
  T('film-yanmasi', 'Film Yanması', 'isik', 1.0, [P('smoothness', 'Yumuşaklık', 0.05, 0.01, 0.3)], filmBurn, UV + EASE + NOISE),
  T('isiklik-soldurma', 'Işıklık Soldurma', 'temel', 0.8, [P('smoothness', 'Yumuşaklık', 0.3, 0.01, 1), { key: 'invert', label: 'Koyudan başla', type: 'bool', default: false }], lumaFade),
  T('isik-patlamasi', 'Işık Patlaması', 'isik', 0.7, [C('tint', 'Renk', '#fff2c8'), P('strength', 'Güç', 1, 0, 2)], burst),
  T('parlama-supurmesi', 'Parlama Süpürmesi', 'isik', 0.7, [C('tint', 'Renk', '#fff6dc'), P('width', 'Genişlik', 0.25, 0.05, 0.8), P('strength', 'Güç', 1, 0, 2)], glare),
  T('glitch-kesme', 'Glitch Kesme', 'glitch', 0.5, [P('strength', 'Güç', 1, 0, 2)], glitchCut, UV + EASE + HASH),
  T('rgb-ayrisma', 'RGB Ayrışma', 'glitch', 0.5, [P('strength', 'Güç', 1, 0, 3)], rgbSplit),
  T('sarsinti-kesme', 'Sarsıntı Kesme', 'glitch', 0.5, [P('strength', 'Güç', 1, 0, 3)], shakeCut, UV + EASE + HASH),
  T('isinlanma', 'Işınlanma', 'glitch', 0.7, [C('tint', 'Renk', '#59f2ff')], teleport, UV + EASE + HASH),
  T('vhs-sarma', 'VHS Geri Sarma', 'glitch', 0.7, [], vhs, UV + EASE + NOISE),
]
