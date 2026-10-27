// Özel geçişler için GLSL parçaları (geçiş sarmalayıcısı yardımcı vermez — burada tanımlarız)

export const HASH = `
float t_hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`

export const NOISE = HASH + `
float t_noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(t_hash(i), t_hash(i + vec2(1.0, 0.0)), u.x), mix(t_hash(i + vec2(0.0, 1.0)), t_hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float t_fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * t_noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`

export const UV = `
const float T_PI = 3.14159265;
vec2 t_mirror(vec2 uv){ vec2 m = mod(uv, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
float t_inside(vec2 uv){ return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
vec4 t_fromM(vec2 uv){ return getFromColor(t_mirror(uv)); }
vec4 t_toM(vec2 uv){ return getToColor(t_mirror(uv)); }
vec2 t_rot(vec2 p, float a){ float c = cos(a); float s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// en-boy düzeltmeli merkez koordinatı (y birimi = yükseklik)
vec2 t_ac(vec2 uv){ vec2 q = uv - 0.5; q.x *= ratio; return q; }
vec2 t_uv(vec2 q){ q.x /= ratio; return q + 0.5; }
`

export const EASE = `
float t_cubicIn(float x){ return x * x * x; }
float t_cubicOut(float x){ float y = 1.0 - x; return 1.0 - y * y * y; }
float t_cubicInOut(float x){ return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(max(-2.0 * x + 2.0, 0.0), 3.0) / 2.0; }
float t_quintInOut(float x){ return x < 0.5 ? 16.0 * x * x * x * x * x : 1.0 - pow(max(-2.0 * x + 2.0, 0.0), 5.0) / 2.0; }
float t_expoInOut(float x){ if (x <= 0.0) return 0.0; if (x >= 1.0) return 1.0;
  return x < 0.5 ? pow(2.0, 20.0 * x - 10.0) / 2.0 : (2.0 - pow(2.0, -20.0 * x + 10.0)) / 2.0; }
`

// Parametre listesinden uniform bildirimleri üret
export function uniformsFor(params) {
  return (params || []).map(p => {
    const t = p.type === 'color' ? 'vec3' : p.type
    return `uniform ${t} ${p.key};`
  }).join('\n')
}
