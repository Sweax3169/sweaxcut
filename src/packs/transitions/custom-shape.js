// Özel geçişler — şekil açılımları ve 3B
import { UV, EASE, HASH } from './glsl-lib.js'
import { T } from './custom-motion.js'

const P = (key, label, def, min, max, type = 'float') => ({ key, label, type, default: def, min, max, step: type === 'float' ? +((max - min) / 100).toPrecision(2) : 1 })
const C = (key, label, def) => ({ key, label, type: 'color', default: def })

// Şekil açılımı: d(q, s) işaretli uzaklık (içeride < 0), s büyüme ölçeği
const shapeReveal = (growth, sMax, extra = '') => `
${extra}
vec4 transition(vec2 uv){
  vec2 q = t_ac(uv);
  float e = ${growth || 't_cubicInOut(progress)'};
  float CD = length(vec2(0.5 * ratio, 0.5));
  float S = ${sMax};
  float s = mix(-0.05, S, e);
  float d = shapeD(q, s);
  float m = 1.0 - smoothstep(-smoothness, smoothness, d);
  m = mix(m, 1.0, smoothstep(0.93, 1.0, progress));
  m *= step(0.0001, progress);
  vec4 c = mix(getFromColor(uv), getToColor(uv), m);
  float rg = (1.0 - smoothstep(0.0, ring, abs(d + ring))) * sin(T_PI * progress);
  c.rgb = mix(c.rgb, color, clamp(rg, 0.0, 1.0));
  return c;
}`

const SD_HEART = `
float t_dot2(vec2 v){ return dot(v, v); }
float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(t_dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(t_dot2(p - vec2(0.0, 1.0)), t_dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float shapeD(vec2 q, float s){
  s = max(s, 1e-4);
  float beat = 1.0 + 0.08 * sin(progress * T_PI * 4.0) * (1.0 - progress);
  s *= beat;
  return sdHeart(q / s + vec2(0.0, 0.5)) * s;
}`

const SD_STAR = `
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float shapeD(vec2 q, float s){
  s = max(s, 1e-4);
  return sdStar5(t_rot(q, progress * 2.5) / s, 1.0, 0.45) * s;
}`

const SD_CIRCLE = `float shapeD(vec2 q, float s){ return length(q - (center - 0.5) * vec2(ratio, 1.0)) - s; }`
const SD_DIAMOND = `float shapeD(vec2 q, float s){ return (abs(q.x) + abs(q.y) - s) * 0.7071; }`

const hexReveal = `
vec4 hexCoord(vec2 p){
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, p - gv);
}
float hexDist(vec2 p){ p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
vec4 transition(vec2 uv){
  vec2 q = t_ac(uv) * cells;
  vec4 h = hexCoord(q);
  float maxR = length(vec2(0.5 * ratio, 0.5)) * cells;
  float t0 = clamp(length(h.zw) / maxR, 0.0, 1.0) * 0.62 + t_hash(h.zw) * 0.08;
  float cp = clamp((progress - t0) / 0.28, 0.0, 1.0);
  float hd = hexDist(h.xy);
  float inside = step(hd, cp * 0.52) * step(0.0001, cp);
  vec4 c = mix(getFromColor(uv), getToColor(uv), inside);
  float edge = (1.0 - smoothstep(0.0, 0.03, abs(hd - cp * 0.52))) * step(0.0001, cp) * (1.0 - cp);
  c.rgb = mix(c.rgb, color, edge);
  return c;
}`

const slash = `
vec4 transition(vec2 uv){
  float a = radians(angle);
  vec2 n = vec2(cos(a), sin(a));
  vec2 q = t_ac(uv);
  float ext = 0.5 * (abs(n.x) * ratio + abs(n.y));
  float pos = mix(-ext - 0.06, ext + 0.06, t_cubicInOut(progress));
  float d = dot(q, n) - pos;
  vec2 tg = vec2(-n.y, n.x);
  float k = sin(T_PI * progress);
  vec2 sh = vec2(tg.x / ratio, tg.y) * 0.035 * k;
  vec4 c = d < 0.0 ? getToColor(uv - sh) : getFromColor(uv + sh);
  float e = exp(-abs(d) * 260.0) * k;
  float g = exp(-abs(d) * 22.0) * k * 0.35;
  c.rgb = clamp(c.rgb + color * (e + g), 0.0, 1.0);
  return c;
}`

const fan = `
vec4 transition(vec2 uv){
  vec2 q = t_ac(uv);
  float a = atan(abs(q.x), q.y);
  float t = progress * (T_PI + smoothness);
  float m = 1.0 - smoothstep(t - smoothness, t, a);
  return mix(getFromColor(uv), getToColor(uv), m);
}`

const blinds = (axis, other) => `
vec4 transition(vec2 uv){
  float n = count;
  float coord = uv.${axis};
  float slat = floor(coord * n);
  float l = fract(coord * n);
  float delay = ${axis === 'y' ? '(n - 1.0 - slat)' : 'slat'} / max(n - 1.0, 1.0) * 0.4;
  float t = clamp((progress - delay) / 0.6, 0.0, 1.0);
  float c = cos(t * T_PI);
  float h = abs(c);
  float y = (l - 0.5) / max(h, 1e-3) + 0.5;
  if (y < 0.0 || y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 s = uv; s.${axis} = (slat + y) / n;
  vec4 col = c > 0.0 ? getFromColor(s) : getToColor(s);
  col.rgb *= 0.5 + 0.5 * h;
  return col;
}`

// ---------------------------------------------------------------- 3B
const cubeH = `
vec4 face(vec3 C, vec3 dir, vec3 f, vec3 n, vec3 tg, bool isFrom, float shade, inout float best){
  float dn = dot(dir, n);
  if (dn >= 0.0) return vec4(-1.0);
  float t = dot(f - C, n) / dn;
  vec3 H = C + t * dir;
  float u = dot(H - f, tg) + 0.5;
  float v = H.y * ratio + 0.5;
  if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 || t >= best) return vec4(-1.0);
  best = t;
  vec4 c = isFrom ? getFromColor(vec2(u, v)) : getToColor(vec2(u, v));
  return vec4(c.rgb * shade, c.a);
}
vec4 transition(vec2 uv){
  float p = progress;
  float th = t_cubicInOut(p) * 1.5707963 * DIR;
  float push = unzoom * sin(T_PI * p);
  vec3 C = vec3(0.0, 0.0, -persp);
  vec3 dir = vec3(uv.x - 0.5, (uv.y - 0.5) / ratio, persp);
  vec3 Cc = vec3(0.0, 0.0, 0.5 + push);
  float ca = cos(th), sa = sin(th);
  vec3 nA = vec3(-sa, 0.0, -ca), tA = vec3(ca, 0.0, -sa);
  vec3 nB = vec3(ca, 0.0, -sa) * DIR, tB = vec3(sa, 0.0, ca) * DIR;
  float best = 1e9;
  vec4 col = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 r = face(C, dir, Cc + nA * 0.5, nA, tA, true, 1.0 - 0.5 * abs(sa), best);
  if (r.x >= 0.0) col = r;
  r = face(C, dir, Cc + nB * 0.5, nB, tB, false, 1.0 - 0.5 * abs(ca), best);
  if (r.x >= 0.0) col = r;
  return col;
}`

// dikey küp: y ekseninde aynı hesap, x↔y yer değiştirerek
const cubeV = `
vec4 face(vec3 C, vec3 dir, vec3 f, vec3 n, vec3 tg, bool isFrom, float shade, inout float best){
  float dn = dot(dir, n);
  if (dn >= 0.0) return vec4(-1.0);
  float t = dot(f - C, n) / dn;
  vec3 H = C + t * dir;
  float u = H.x + 0.5;
  float v = dot(H - f, tg) * ratio + 0.5;
  if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 || t >= best) return vec4(-1.0);
  best = t;
  vec4 c = isFrom ? getFromColor(vec2(u, v)) : getToColor(vec2(u, v));
  return vec4(c.rgb * shade, c.a);
}
vec4 transition(vec2 uv){
  float p = progress;
  float th = t_cubicInOut(p) * 1.5707963 * DIR;
  float hd = 0.5 / ratio;
  float push = unzoom * sin(T_PI * p) / ratio;
  vec3 C = vec3(0.0, 0.0, -persp);
  vec3 dir = vec3(uv.x - 0.5, (uv.y - 0.5) / ratio, persp);
  vec3 Cc = vec3(0.0, 0.0, hd + push);
  float ca = cos(th), sa = sin(th);
  vec3 nA = vec3(0.0, -sa, -ca), tA = vec3(0.0, ca, -sa);
  vec3 nB = vec3(0.0, ca, -sa) * DIR, tB = vec3(0.0, sa, ca) * DIR;
  float best = 1e9;
  vec4 col = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 r = face(C, dir, Cc + nA * hd, nA, tA, true, 1.0 - 0.5 * abs(sa), best);
  if (r.x >= 0.0) col = r;
  r = face(C, dir, Cc + nB * hd, nB, tB, false, 1.0 - 0.5 * abs(ca), best);
  if (r.x >= 0.0) col = r;
  return col;
}`

const flip = (vertical) => `
vec4 transition(vec2 uv){
  float p = progress;
  float th = t_cubicInOut(p) * T_PI;
  float push = unzoom * sin(T_PI * p);
  vec3 C = vec3(0.0, 0.0, -persp);
  vec3 dir = vec3(uv.x - 0.5, (uv.y - 0.5) / ratio, persp);
  vec3 f = vec3(0.0, 0.0, push);
  float ca = cos(th), sa = sin(th);
  ${vertical
    ? 'vec3 n = vec3(0.0, -sa, -ca); vec3 tg = vec3(0.0, ca, -sa);'
    : 'vec3 n = vec3(-sa, 0.0, -ca); vec3 tg = vec3(ca, 0.0, -sa);'}
  float dn = dot(dir, n);
  if (abs(dn) < 1e-5) return vec4(0.0, 0.0, 0.0, 1.0);
  float t = dot(f - C, n) / dn;
  vec3 H = C + t * dir;
  float u, v;
  ${vertical
    ? 'u = H.x + 0.5; v = dot(H - f, tg) * ratio + 0.5;'
    : 'u = dot(H - f, tg) + 0.5; v = H.y * ratio + 0.5;'}
  bool front = dn < 0.0;
  ${vertical ? 'if (!front) v = 1.0 - v;' : 'if (!front) u = 1.0 - u;'}
  if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 c = front ? getFromColor(vec2(u, v)) : getToColor(vec2(u, v));
  c.rgb *= 1.0 - 0.55 * abs(sa);
  return c;
}`

const barn = `
vec4 transition(vec2 uv){
  float p = progress;
  float th = t_cubicInOut(p) * 1.5;
  float c = cos(th), sn = sin(th);
  float D = persp;
  float z = 1.1 - 0.1 * p;
  vec4 col = getToColor(0.5 + (uv - 0.5) / z);
  col.rgb *= 0.45 + 0.55 * smoothstep(0.0, 0.8, p);
  float x = uv.x - 0.5;
  // sol kapı (menteşe solda), sağ kapı aynalı
  float xl = x, xr = -x;
  float sl = (xl + 0.5) / (c + xl * sn / D);
  float sr = (xr + 0.5) / (c + xr * sn / D);
  if (x <= 0.0 && sl >= 0.0 && sl <= 0.5) {
    float v = (uv.y - 0.5) * (D - sl * sn) / D + 0.5;
    if (v >= 0.0 && v <= 1.0) { vec4 a = getFromColor(vec2(sl, v)); a.rgb *= 1.0 - 0.5 * sn * (sl * 2.0); return a; }
  }
  if (x > 0.0 && sr >= 0.0 && sr <= 0.5) {
    float v = (uv.y - 0.5) * (D - sr * sn) / D + 0.5;
    if (v >= 0.0 && v <= 1.0) { vec4 a = getFromColor(vec2(1.0 - sr, v)); a.rgb *= 1.0 - 0.5 * sn * (sr * 2.0); return a; }
  }
  return col;
}`

const ring = (def = 0.012) => P('ring', 'Halka kalınlığı', def, 0, 0.06)
const smooth = (def = 0.01) => P('smoothness', 'Yumuşaklık', def, 0, 0.2)
const P3 = [P('persp', 'Perspektif mesafesi', 2, 0.8, 6), P('unzoom', 'Uzaklaşma', 0.35, 0, 1.5)]

export const SHAPE = [
  T('daire-acilimi', 'Daire Açılımı', 'sekil', 0.7, [smooth(), ring(), C('color', 'Halka rengi', '#ffffff'), { key: 'center', label: 'Merkez', type: 'vec2', default: [0.5, 0.5], min: 0, max: 1, step: 0.01 }],
    shapeReveal(null, 'length(vec2(max(center.x, 1.0 - center.x) * ratio, max(center.y, 1.0 - center.y))) + smoothness + ring * 2.0', SD_CIRCLE)),
  T('kalp-acilimi', 'Kalp Açılımı', 'sekil', 0.9, [smooth(0.008), ring(0.015), C('color', 'Halka rengi', '#ff5da2')], shapeReveal('progress * progress', 'CD / 0.33 + 0.1', SD_HEART)),
  T('yildiz-acilimi', 'Yıldız Patlaması', 'sekil', 0.9, [smooth(0.006), ring(0.012), C('color', 'Halka rengi', '#ffd23f')], shapeReveal('progress * progress', 'CD / 0.42 + 0.1', SD_STAR)),
  T('elmas-acilimi', 'Elmas Açılımı', 'sekil', 0.7, [smooth(0.006), ring(0.01), C('color', 'Halka rengi', '#ffffff')], shapeReveal(null, '0.5 * ratio + 0.5 + 0.1', SD_DIAMOND)),
  T('petek-acilimi', 'Petek Açılımı', 'sekil', 1.0, [P('cells', 'Petek sıklığı', 7, 2, 20), C('color', 'Kenar rengi', '#e4ff3a')], hexReveal, UV + EASE + HASH),
  T('capraz-kesik', 'Çapraz Kesik', 'sekil', 0.5, [P('angle', 'Açı', 35, 0, 360), C('color', 'Kesik rengi', '#e4ff3a')], slash),
  T('cift-kanat', 'Çift Kanat', 'sekil', 0.7, [P('smoothness', 'Yumuşaklık', 0.15, 0, 1)], fan),
  T('jaluzi', 'Jaluzi', 'sekil', 0.9, [P('count', 'Kanat sayısı', 8, 2, 30)], blinds('y')),
  T('dikey-jaluzi', 'Dikey Jaluzi', 'sekil', 0.9, [P('count', 'Kanat sayısı', 10, 2, 30)], blinds('x')),
  T('kup-sola', 'Küp Sola', '3d', 0.8, P3, 'const float DIR = 1.0;\n' + cubeH),
  T('kup-saga', 'Küp Sağa', '3d', 0.8, P3, 'const float DIR = -1.0;\n' + cubeH),
  T('kup-asagi', 'Küp Aşağı', '3d', 0.8, P3, 'const float DIR = 1.0;\n' + cubeV),
  T('kup-yukari', 'Küp Yukarı', '3d', 0.8, P3, 'const float DIR = -1.0;\n' + cubeV),
  T('kart-cevir', 'Kart Çevir', '3d', 0.7, [P('persp', 'Perspektif mesafesi', 2, 0.8, 6), P('unzoom', 'Uzaklaşma', 0.5, 0, 1.5)], flip(false)),
  T('dikey-cevir', 'Dikey Çevir', '3d', 0.7, [P('persp', 'Perspektif mesafesi', 2, 0.8, 6), P('unzoom', 'Uzaklaşma', 0.5, 0, 1.5)], flip(true)),
  T('ahir-kapisi', 'Ahır Kapısı', '3d', 0.9, [P('persp', 'Perspektif mesafesi', 1.2, 0.6, 6)], barn),
]
