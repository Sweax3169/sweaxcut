// Efekt paketi ortak parçaları: parametre kısayolları + GLSL kütüphanesi.
// Kütüphaneden yalnızca efektin kullandığı fonksiyonlar (ve bağımlılıkları) gölgelendiriciye eklenir.

// ---------------------------------------------------------------- parametreler
const autoStep = (min, max) => (max - min > 20 ? 1 : max - min > 4 ? 0.1 : 0.01)
export const R = (key, label, min, max, def, step) => ({ key, label, type: 'range', min, max, step: step ?? autoStep(min, max), default: def })
export const C = (key, label, def) => ({ key, label, type: 'color', default: def })
export const B = (key, label, def = false) => ({ key, label, type: 'bool', default: def })
export const S = (key, label, options, def) => ({
  key, label, type: 'select', options: options.map(([value, l]) => ({ value, label: l })), default: def ?? options[0][0],
})
export const AMT = (def = 1, label = 'Yoğunluk') => R('amount', label, 0, 1, def, 0.01)
export const SPD = (def = 1, max = 3) => R('speed', 'Hız', 0, max, def, 0.05)
export const PER = (def = 1.2, label = 'Tekrar (sn)') => R('period', label, 0.2, 5, def, 0.05)

// ---------------------------------------------------------------- GLSL kütüphanesi (bağımlılık sırasıyla)
// NOT: rand, noise, fbm, rgb2hsv, hsv2rgb, luma, tex motorda hazır — burada yeniden tanımlanmaz.
const LIB = [
  ['tx', 'vec4 tx(vec2 uv){ return textureLod(uTex, clamp(uv, 0.0, 1.0), 0.0); }'],
  ['ox', 'vec4 ox(vec2 uv){ return textureLod(uOrig, clamp(uv, 0.0, 1.0), 0.0); }'],
  ['ar', 'float ar(){ return uRes.x / uRes.y; }'],
  ['asp', 'vec2 asp(){ return vec2(uRes.x / uRes.y, 1.0); }'],
  // 1080p piksel birimi (uv cinsinden) — her çözünürlükte aynı görünüm
  ['px', 'vec2 px(){ return vec2(uRes.y / uRes.x, 1.0) / 1080.0; }'],
  // kısa kenar = 1 olacak şekilde merkezli koordinat (dikey videoda da şekiller taşmaz)
  ['sn', 'float sn(){ return min(uRes.x / uRes.y, 1.0); }'],
  ['cp', 'vec2 cp(vec2 uv){ return (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) / min(uRes.x / uRes.y, 1.0); }'],
  ['rot', 'mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }'],
  ['h11', 'float h11(float n){ return fract(sin(n * 127.1 + 31.7) * 43758.5453); }'],
  ['h22', 'vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }'],
  ['pm', 'vec4 pm(vec4 c){ return vec4(c.rgb * c.a, c.a); }'],
  ['unpm', 'vec4 unpm(vec4 acc, float ws){ return vec4(acc.rgb / max(acc.a, 1e-4), acc.a / max(ws, 1e-4)); }'],
  ['lumA', 'float lumA(vec4 c){ return luma(c.rgb) * c.a; }'],
  ['vig', 'float vig(vec2 uv, float a, float b){ vec2 q = (uv - 0.5) * 2.0; return 1.0 - smoothstep(a, b, length(q)); }'],
  ['scr', 'vec3 scr(vec3 a, vec3 b){ return 1.0 - (1.0 - a) * (1.0 - b); }'],
  ['ovl', 'vec3 ovl(vec3 a, vec3 b){ return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a)); }'],
  ['sft', 'vec3 sft(vec3 a, vec3 b){ return (1.0 - 2.0 * b) * a * a + 2.0 * b * a; }'],
  ['satur', 'vec3 satur(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }'],
  ['contr', 'vec3 contr(vec3 c, float k){ return clamp((c - 0.5) * k + 0.5, 0.0, 1.0); }'],
  ['rainbow', 'vec3 rainbow(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }'],
  ['tri', 'float tri(float x){ return abs(fract(x) * 2.0 - 1.0); }'],
  ['ridge', 'float ridge(vec2 p){ return 1.0 - abs(noise(p) * 2.0 - 1.0); }'],
  ['eob', 'float eob(float x){ x = clamp(x, 0.0, 1.0); float c1 = 1.70158; float c3 = c1 + 1.0; return 1.0 + c3 * pow(x - 1.0, 3.0) + c1 * pow(x - 1.0, 2.0); }'],
  ['eoc', 'float eoc(float x){ x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }'],
  ['barrel', 'vec2 barrel(vec2 uv, float k){ vec2 c = uv - 0.5; return 0.5 + c * (1.0 + k * dot(c, c) * 4.0) / (1.0 + k * 0.5); }'],
  ['sdBox', 'float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }'],
  ['sdRBox', 'float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p, b - r) - r; }'],
  ['sdSeg', 'float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }'],
  // kalp: uç (0,0), üst ~ (0,1)
  ['sdHeart', `float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25, 0.75)) - 0.35355;
  vec2 a = p - vec2(0.0, 1.0); vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}`],
  ['sdStar', `float sdStar(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}`],
  ['hexDist', 'float hexDist(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }'],
  // altıgen ızgara: xy = hücre içi konum, zw = hücre kimliği
  ['hexCell', `vec4 hexCell(vec2 p){
  vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 0.5);
}`],
  // Voronoi: x = en yakın merkez uzaklığı, y = kenara uzaklık, zw = hücre kimliği
  ['voro', `vec4 voro(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float md = 8.0; vec2 mg = vec2(0.0), mr = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j)); vec2 r = g + h22(n + g) - f; float d = dot(r, r);
    if (d < md){ md = d; mr = r; mg = g; }
  }
  float me = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec2 g = mg + vec2(float(i), float(j)); vec2 r = g + h22(n + g) - f;
    vec2 dd = r - mr;
    if (dot(dd, dd) > 1e-5) me = min(me, dot(0.5 * (mr + r), normalize(dd)));
  }
  return vec4(sqrt(md), me, n + mg);
}`],
  ['bayer', `float bayer(vec2 p){
  const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 q = ivec2(mod(p, 4.0));
  return (B[q.x + q.y * 4] + 0.5) / 16.0;
}`],
  // Sobel kenar büyüklüğü (alfa ağırlıklı parlaklık)
  ['sobel', `float sobel(vec2 uv, vec2 d){
  float tl = lumA(tx(uv + vec2(-d.x, d.y))), tc = lumA(tx(uv + vec2(0.0, d.y))), tr = lumA(tx(uv + d));
  float ml = lumA(tx(uv - vec2(d.x, 0.0))), mr = lumA(tx(uv + vec2(d.x, 0.0)));
  float bl = lumA(tx(uv - d)), bc = lumA(tx(uv - vec2(0.0, d.y))), br = lumA(tx(uv + vec2(d.x, -d.y)));
  float gx = tr + 2.0 * mr + br - tl - 2.0 * ml - bl;
  float gy = tl + 2.0 * tc + tr - bl - 2.0 * bc - br;
  return length(vec2(gx, gy));
}`],
  // Tek yönlü Gauss (premultiplied — saydam kenarlarda koyu hale olmaz). r = yarıçap vektörü (uv)
  ['gblur', `vec4 gblur(vec2 uv, vec2 r){
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -10; i <= 10; i++){
    float x = float(i) / 10.0; float w = exp(-x * x * 3.0);
    vec4 c = tx(uv + r * x);
    acc += vec4(c.rgb * c.a, c.a) * w; ws += w;
  }
  return vec4(acc.rgb / max(acc.a, 1e-4), acc.a / ws);
}`],
  // Disk bulanıklığı (12 örnek, dönen desen) — tek geçişte yumuşatma
  ['disk', `vec4 disk(vec2 uv, vec2 r){
  vec4 acc = pm(tx(uv)); float ws = 1.0;
  float a0 = rand(uv * 913.7) * 6.2832;
  for (int i = 0; i < 12; i++){
    float fi = float(i);
    float a = a0 + fi * 2.39996; float d = sqrt((fi + 0.5) / 12.0);
    acc += pm(tx(uv + vec2(cos(a), sin(a)) * r * d)); ws += 1.0;
  }
  return unpm(acc, ws);
}`],
]

// Kodu tara, kullanılan kütüphane fonksiyonlarını başa ekle
export function withLib(code) {
  const used = new Set()
  const visit = (src) => {
    for (const [name, body] of LIB) {
      if (used.has(name)) continue
      if (new RegExp('\\b' + name + '\\s*\\(').test(src)) { used.add(name); visit(body) }
    }
  }
  visit(code)
  return LIB.filter(([n]) => used.has(n)).map(([, b]) => b).join('\n') + '\n' + code
}

const defaultsOf = (params) => Object.fromEntries(params.map(p => [p.key, p.default]))

// Tek geçişli efekt
export function fx(id, name, params, glsl, extra = {}) {
  return { id, name, params, defaults: defaultsOf(params), glsl: withLib(glsl), ...extra }
}

// Çok geçişli efekt: passes = [[glsl, scale], ...]
export function mp(id, name, params, passes, extra = {}) {
  return {
    id, name, params, defaults: defaultsOf(params),
    passes: passes.map(([g, scale]) => ({ glsl: withLib(g), scale: scale || 1 })),
    ...extra,
  }
}

// Ayrılabilir bulanıklık geçişleri (r: 1080p piksel cinsinden GLSL ifadesi)
export const blurH = (r) => `vec4 effect(vec2 uv){ return gblur(uv, vec2(px().x * (${r}), 0.0)); }`
export const blurV = (r) => `vec4 effect(vec2 uv){ return gblur(uv, vec2(0.0, px().y * (${r}))); }`
