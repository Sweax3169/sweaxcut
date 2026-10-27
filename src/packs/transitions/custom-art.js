// Özel geçişler — sanatsal, bozulma, oyun, temel
import { UV, EASE, NOISE, HASH } from './glsl-lib.js'
import { T } from './custom-motion.js'

const P = (key, label, def, min, max, type = 'float') => ({ key, label, type, default: def, min, max, step: type === 'float' ? +((max - min) / 100).toPrecision(2) : 1 })
const C = (key, label, def) => ({ key, label, type: 'color', default: def })
const LN = UV + EASE + NOISE
const LH = UV + EASE + HASH

// ---------------------------------------------------------------- sanatsal
const ink = `
vec4 transition(vec2 uv){
  vec2 m = vec2(ratio, 1.0) / max(ratio, 1.0);
  vec2 q = uv * m;
  float n = t_fbm(q * 2.5 + 3.0);
  float n2 = t_fbm(q * 8.0 - 1.7);
  float d = min(min(length(q - vec2(0.3, 0.65) * m), length(q - vec2(0.72, 0.35) * m) * 1.15), length(q - vec2(0.55, 0.85) * m) * 1.3);
  float field = d * 0.8 + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.12;
  float t = mix(-0.2, 0.5, progress);
  float s = smoothness;
  float b = 1.0 - smoothstep(t - s, t + s, field);
  b = mix(b, 1.0, smoothstep(0.85, 1.0, progress)) * smoothstep(0.0, 0.05, progress);
  vec4 c = mix(getFromColor(uv), getToColor(uv), b);
  float rim = smoothstep(t - 0.1, t, field) * (1.0 - smoothstep(t, t + s, field));
  c.rgb = mix(c.rgb, color, clamp(rim * 0.9 * sin(T_PI * progress) * 1.6, 0.0, 1.0));
  return c;
}`

const smoke = `
vec4 transition(vec2 uv){
  vec2 q = uv * vec2(ratio, 1.0) / max(ratio, 1.0);
  float p = progress;
  float k = sin(T_PI * p);
  vec2 w = vec2(t_fbm(q * 3.0 + p * 0.8), t_fbm(q * 3.0 + 5.2 - p * 0.6));
  float n = clamp((t_fbm(q * 2.5 + w * 1.8) - 0.3) / 0.45, 0.0, 1.0);
  float s = 0.22;
  float t = p * (1.0 + s);
  float b = smoothstep(n, n + s, t);
  vec2 off = (w - 0.5) * 0.04 * k;
  vec4 c = mix(getFromColor(uv + off), getToColor(uv - off), b);
  float haze = (1.0 - abs(b - 0.5) * 2.0) * k;
  c.rgb = mix(c.rgb, color, haze * density);
  return c;
}`

const dreamBlur = `
vec4 transition(vec2 uv){
  float k = sin(T_PI * progress);
  float r = 0.03 * k * strength;
  vec4 a = vec4(0.0), b = vec4(0.0);
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + 0.5) / 24.0) * r;
    float an = fi * 2.39996;
    vec2 o = vec2(cos(an) / ratio, sin(an)) * rr;
    a += getFromColor(uv + o); b += getToColor(uv + o);
  }
  vec4 c = mix(a, b, smoothstep(0.25, 0.75, progress)) / 24.0;
  c.rgb = c.rgb + c.rgb * c.rgb * 0.7 * k;
  c.rgb = mix(c.rgb, vec3(1.0, 0.95, 0.9), 0.12 * k);
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`

const watercolor = `
vec4 transition(vec2 uv){
  vec2 q = uv * vec2(ratio, 1.0) / max(ratio, 1.0);
  float p = progress;
  vec2 w = vec2(t_fbm(q * 4.0), t_fbm(q * 4.0 + 9.1));
  float n = t_fbm(q * 3.0 + w * 1.2);
  float grain = t_noise(uv * 400.0);
  float field = (1.0 - uv.x) * 0.45 + n * 0.55 + (grain - 0.5) * 0.04;
  float t = mix(0.15, 0.93, p);
  float s = 0.06;
  float b = smoothstep(field - s, field + s, t);
  vec4 A = getFromColor(uv + (w - 0.5) * 0.015 * (1.0 - b) * sin(T_PI * p));
  vec4 B = getToColor(uv);
  float edge = smoothstep(0.0, 0.5, b) * (1.0 - smoothstep(0.5, 1.0, b));
  B.rgb *= 1.0 - 0.35 * edge;
  vec4 c = mix(A, B, b);
  c.rgb *= 1.0 - (grain - 0.5) * 0.08 * sin(T_PI * p);
  return c;
}`

// ---------------------------------------------------------------- bozulma
const twister = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p);
  vec2 q = t_ac(uv);
  float r = length(q);
  float R = 0.5 * max(ratio, 1.0) * 1.3;
  float f = 1.0 - smoothstep(0.0, R, r);
  float a = strength * k * f * f;
  vec2 s = t_uv(t_rot(q, a) / (1.0 + 0.3 * k));
  return mix(t_fromM(s), t_toM(s), smoothstep(0.4, 0.6, p));
}`

const shockwave = `
vec4 transition(vec2 uv){
  float p = progress;
  vec2 q = t_ac(uv);
  float r = length(q);
  float maxR = length(vec2(0.5 * ratio, 0.5));
  float rr = (0.55 * p + 0.45 * t_cubicOut(p)) * (maxR + 0.25) - 0.1;
  float x = (r - rr) / 0.08;
  float w = exp(-x * x);
  vec2 dn = r > 1e-4 ? q / r : vec2(0.0);
  float k = sin(T_PI * p);
  vec2 off = dn * 0.06 * w * k * strength; off.x /= ratio;
  float m = 1.0 - smoothstep(-0.015, 0.015, r - rr);
  vec2 s = uv - off;
  vec4 c = mix(getFromColor(s), getToColor(s), m);
  vec2 co = dn * w * 0.014 * k * strength; co.x /= ratio;
  float rch = mix(getFromColor(s + co), getToColor(s + co), m).r;
  float bch = mix(getFromColor(s - co), getToColor(s - co), m).b;
  return vec4(clamp(vec3(rch, c.g, bch) + w * 0.3 * k, 0.0, 1.0), c.a);
}`

const heat = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p);
  vec2 n = vec2(t_noise(vec2(uv.x * 9.0, uv.y * 5.0 - p * 6.0)), t_noise(vec2(uv.x * 7.0 + 3.0, uv.y * 6.0 - p * 5.0))) - 0.5;
  vec2 s = uv + n * 0.05 * k * strength;
  vec4 c = mix(getFromColor(s), getToColor(s), smoothstep(0.3, 0.7, p));
  c.rgb = mix(c.rgb, c.rgb * vec3(1.12, 0.98, 0.85), k * 0.6);
  return c;
}`

// ---------------------------------------------------------------- oyun
const gameOver = `
vec4 transition(vec2 uv){
  float p = progress;
  bool first = p < 0.5;
  float a = first ? p * 2.0 : (1.0 - p) * 2.0;
  float lv = floor(smoothstep(0.0, 0.7, a) * 6.0);
  float hY = 1.0 - smoothstep(0.72, 0.9, a);
  float hX = 1.0 - smoothstep(0.88, 1.0, a) * 0.985;
  vec2 s = uv;
  s.y = (s.y - 0.5) / max(hY, 0.006) + 0.5;
  s.x = (s.x - 0.5) / max(hX, 0.006) + 0.5;
  float ins = t_inside(s);
  if (lv > 0.5) {
    float cells = 140.0 / pow(2.0, lv);
    vec2 cv = vec2(cells * ratio, cells);
    s = (floor(s * cv) + 0.5) / cv;
  }
  vec4 c = first ? getFromColor(s) : getToColor(s);
  float L = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  if (first) c.rgb = mix(c.rgb, vec3(L * 1.3, L * 0.15, L * 0.18), smoothstep(0.15, 0.6, a));
  vec3 col = c.rgb * ins;
  float line = (1.0 - hY) * exp(-abs(uv.y - 0.5) * 500.0) * step(abs(uv.x - 0.5), 0.5 * hX + 0.002);
  col = col * (1.0 + 1.5 * (1.0 - hY)) + vec3(1.0) * line;
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`

const crt = `
vec4 transition(vec2 uv){
  float p = progress;
  bool first = p < 0.5;
  float a = first ? p * 2.0 : (1.0 - p) * 2.0;
  float hY = 1.0 - smoothstep(0.35, 0.7, a) * 0.996;
  float hX = 1.0 - smoothstep(0.7, 0.95, a) * 0.99;
  vec2 s = vec2((uv.x - 0.5) / hX + 0.5, (uv.y - 0.5) / hY + 0.5);
  float ins = t_inside(s);
  vec4 c = first ? getFromColor(s) : getToColor(s);
  vec3 col = c.rgb * (1.0 + 2.5 * smoothstep(0.25, 0.65, a)) * ins;
  col *= mix(1.0, 0.8 + 0.2 * sin(uv.y * 1200.0), a);
  vec2 q = t_ac(uv);
  float dotG = smoothstep(0.65, 0.95, a) * exp(-length(vec2(q.x / max(hX * ratio, 0.01), q.y * 60.0)) * 3.0);
  col += vec3(0.85, 0.95, 1.0) * dotG;
  col = mix(col, vec3(0.0), smoothstep(0.95, 1.0, a));
  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`

const pixelWave = `
vec4 transition(vec2 uv){
  float f = mix(-0.35, 1.35, progress);
  float d = uv.x - f;
  float lv = floor(exp(-d * d * 18.0) * 6.0);
  if (lv < 0.5) return d < 0.0 ? getToColor(uv) : getFromColor(uv);
  float cells = 120.0 / pow(2.0, lv);
  vec2 cv = vec2(cells * ratio, cells);
  vec2 puv = (floor(uv * cv) + 0.5) / cv;
  return puv.x - f < 0.0 ? getToColor(puv) : getFromColor(puv);
}`

const tiles = `
vec4 transition(vec2 uv){
  vec2 grid = vec2(max(1.0, floor(rows * ratio + 0.5)), rows);
  vec2 g = uv * grid;
  vec2 id = floor(g);
  vec2 l = fract(g) - 0.5;
  float r = t_hash(id);
  float delay = (id.x / grid.x) * 0.45 + r * 0.15;
  float t = clamp((progress - delay) / 0.4, 0.0, 1.0);
  float e = t * t;
  float s = 1.0 - e;
  float a = e * (r - 0.5) * 6.0;
  vec2 lp = t_rot(l - vec2(0.0, -e * 0.3), -a) / max(s, 1e-3);
  if (s > 0.001 && abs(lp.x) < 0.5 && abs(lp.y) < 0.5) {
    vec4 c = getFromColor((id + lp + 0.5) / grid);
    c.rgb *= 1.0 - 0.45 * e;
    return c;
  }
  return getToColor(uv);
}`

const levelUp = `
vec4 transition(vec2 uv){
  vec2 grid = vec2(max(1.0, floor(16.0 * ratio + 0.5)), 16.0);
  vec2 id = floor(uv * grid);
  float tq = floor(progress * 14.0 + 0.0001) / 14.0;
  float diag = (id.x / grid.x + id.y / grid.y) * 0.5;
  float front = tq * 1.2 - 0.1;
  float d = diag - front;
  if (d < 0.0) return getToColor(uv);
  if (d < 0.065) return vec4(color, 1.0);
  return getFromColor(uv);
}`

const damage = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = p < 0.5 ? smoothstep(0.15, 0.5, p) : 1.0 - smoothstep(0.5, 1.0, p);
  float fr = floor(p * 30.0);
  vec2 sh = (vec2(t_hash(vec2(fr, 1.0)), t_hash(vec2(fr, 2.0))) - 0.5) * 0.06 * k * strength;
  vec2 s = uv + sh;
  vec2 co = vec2(0.014 * k * strength, 0.0);
  bool first = p < 0.5;
  vec4 c = first ? t_fromM(s) : t_toM(s);
  float r = (first ? t_fromM(s + co) : t_toM(s + co)).r;
  float b = (first ? t_fromM(s - co) : t_toM(s - co)).b;
  vec3 col = vec3(r, c.g, b);
  float vig = smoothstep(0.2, 0.95, length(t_ac(uv)) / max(ratio, 1.0) * 1.2);
  col = mix(col, color, vig * k * 0.9);
  col = mix(col, color * 1.2 + 0.1, k * k * 0.3);
  return vec4(clamp(col, 0.0, 1.0), c.a);
}`

const dither = `
float bayer4(vec2 p){
  vec2 f = mod(floor(p), 4.0);
  float i = f.x + f.y * 4.0;
  int ii = int(i);
  int idx[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(idx[ii]) + 0.5) / 16.0;
}
vec4 transition(vec2 uv){
  vec2 px = uv * vec2(ratio, 1.0) * dots;
  float th = bayer4(px);
  float m = step(th, progress * 1.0001);
  return mix(getFromColor(uv), getToColor(uv), m);
}`

// ---------------------------------------------------------------- temel
const softMix = `
vec4 transition(vec2 uv){
  vec4 a = getFromColor(uv), b = getToColor(uv);
  float t = smoothstep(0.0, 1.0, progress);
  vec3 la = pow(a.rgb, vec3(2.2)), lb = pow(b.rgb, vec3(2.2));
  vec3 c = pow(mix(la, lb, t), vec3(1.0 / 2.2));
  return vec4(c, mix(a.a, b.a, t));
}`

const burnFade = `
vec4 transition(vec2 uv){
  vec4 a = getFromColor(uv), b = getToColor(uv);
  float p = progress;
  float k = sin(T_PI * p);
  vec4 c = mix(a, b, smoothstep(0.2, 0.8, p));
  c.rgb = c.rgb + (a.rgb * (1.0 - p) + b.rgb * p) * k * strength;
  return vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`

export const ART = [
  T('murekkep-damlasi', 'Mürekkep Damlası', 'sanat', 1.0, [P('smoothness', 'Yumuşaklık', 0.03, 0.005, 0.2), C('color', 'Mürekkep rengi', '#0a0a12')], ink, LN),
  T('duman-gecisi', 'Duman Geçişi', 'sanat', 1.0, [C('color', 'Duman rengi', '#d8d8dc'), P('density', 'Yoğunluk', 0.6, 0, 1)], smoke, LN),
  T('ruya-bulanikligi', 'Rüya Bulanıklığı', 'sanat', 0.9, [P('strength', 'Güç', 1, 0, 3)], dreamBlur),
  T('suluboya', 'Suluboya', 'sanat', 1.0, [], watercolor, LN),
  T('hortum', 'Hortum', 'bozulma', 0.8, [P('strength', 'Burulma', 7, 0, 20)], twister),
  T('sok-dalgasi', 'Şok Dalgası', 'bozulma', 0.8, [P('strength', 'Güç', 1, 0, 3)], shockwave),
  T('isi-dalgasi', 'Isı Dalgası', 'bozulma', 0.8, [P('strength', 'Güç', 1, 0, 3)], heat, LN),
  T('oyun-bitti', 'Oyun Bitti', 'oyun', 1.2, [], gameOver),
  T('crt-kapanis', 'Tüplü TV Kapanışı', 'oyun', 0.9, [], crt),
  T('piksel-dalgasi', 'Piksel Dalgası', 'oyun', 0.8, [], pixelWave),
  T('karo-dagilmasi', 'Karo Dağılması', 'oyun', 1.0, [P('rows', 'Satır sayısı', 8, 2, 30)], tiles, LH),
  T('seviye-atla', 'Seviye Atla', 'oyun', 0.8, [C('color', 'Kenar rengi', '#e4ff3a')], levelUp),
  T('hasar-aldi', 'Hasar Aldı', 'oyun', 0.5, [C('color', 'Hasar rengi', '#e0101e'), P('strength', 'Güç', 1, 0, 3)], damage, LH),
  T('dither-gecisi', 'Dither Geçişi', 'oyun', 0.8, [P('dots', 'Nokta sıklığı', 180, 20, 600)], dither),
  T('yumusak-karisim', 'Yumuşak Karışım', 'temel', 0.6, [], softMix),
  T('yanik-soldur', 'Parlayarak Soldur', 'temel', 0.6, [P('strength', 'Parlama', 0.6, 0, 2)], burnFade),
]
