// Özel geçişler — hareket: zum darbeleri, dönme, kırbaç, itme, örtme/açma, akordeon, kapılar
import { UV, EASE, uniformsFor } from './glsl-lib.js'

export function T(id, name, category, duration, params, body, libs = UV + EASE) {
  return { id, name, category, duration, params, glsl: uniformsFor(params) + '\n' + libs + '\n' + body, tags: ['sweax'] }
}

const P = (key, label, def, min, max, type = 'float') => ({ key, label, type, default: def, min, max, step: type === 'float' ? +((max - min) / 100).toPrecision(2) : 1 })

// ---------------------------------------------------------------- yakınlaştırma
const zoomPunch = (inward) => `
vec4 transition(vec2 uv){
  vec2 c = vec2(0.5);
  float p = progress;
  vec4 acc = vec4(0.0);
  bool first = p < 0.5;
  float x = first ? p * 2.0 : (p - 0.5) * 2.0;
  float k = first ? t_cubicIn(x) : t_cubicOut(x);
  float v = first ? 3.0 * x * x : 3.0 * (1.0 - x) * (1.0 - x);
  float s = ${inward
    ? 'first ? mix(1.0, zoom, k) : mix(1.0 / zoom, 1.0, k)'
    : 'first ? mix(1.0, 1.0 / zoom, k) : mix(zoom, 1.0, k)'};
  float bl = strength * 0.1 * v;
  for (int i = 0; i < 16; i++){
    float f = float(i) / 15.0;
    float ss = s * (1.0 + bl * f);
    vec2 q = c + (uv - c) / ss;
    acc += first ? t_fromM(q) : t_toM(q);
  }
  return acc / 16.0;
}`

const zoomBlur = `
vec4 transition(vec2 uv){
  float p = progress;
  float k = sin(T_PI * p);
  float a = k * strength * 0.3;
  float z = 1.0 + 0.2 * k;
  vec2 c = vec2(0.5);
  vec4 A = vec4(0.0); vec4 B = vec4(0.0);
  for (int i = 0; i < 20; i++){
    float f = float(i) / 19.0;
    vec2 q = c + (uv - c) * (1.0 - a * f) / z;
    A += t_fromM(q); B += t_toM(q);
  }
  return mix(A, B, smoothstep(0.35, 0.65, p)) / 20.0;
}`

const speedRamp = `
vec4 transition(vec2 uv){
  float p = progress;
  bool first = p < 0.5;
  float x = first ? p * 2.0 : (p - 0.5) * 2.0;
  float k = first ? pow(x, 4.0) : 1.0 - pow(1.0 - x, 4.0);
  float v = first ? 4.0 * pow(x, 3.0) : 4.0 * pow(1.0 - x, 3.0);
  float s = first ? exp(log(zoom) * k) : exp(log(zoom) * (k - 1.0));
  float bl = strength * 0.08 * v;
  vec2 c = vec2(0.5);
  vec3 acc = vec3(0.0); float al = 0.0;
  for (int i = 0; i < 20; i++){
    float f = float(i) / 19.0;
    float ss = s * (1.0 + bl * f);
    vec2 q = c + (uv - c) / ss;
    float ch = 0.02 * v * strength;
    vec2 qr = c + (uv - c) / (ss * (1.0 + ch));
    vec2 qb = c + (uv - c) / (ss * (1.0 - ch * 0.5));
    vec4 g = first ? t_fromM(q) : t_toM(q);
    float r = first ? t_fromM(qr).r : t_toM(qr).r;
    float b = first ? t_fromM(qb).b : t_toM(qb).b;
    acc += vec3(r, g.g, b); al += g.a;
  }
  acc /= 20.0;
  float fl = pow(max(0.0, 1.0 - abs(p - 0.5) * 2.0), 10.0) * flash;
  return vec4(mix(acc, vec3(1.0), fl), al / 20.0);
}`

const spin = (dirSign) => `
vec4 transition(vec2 uv){
  float p = progress;
  vec2 q = t_ac(uv);
  bool first = p < 0.5;
  float x = first ? p * 2.0 : (p - 0.5) * 2.0;
  float A = radians(angle) * ${dirSign};
  float a = first ? A * x * x * x : -A * pow(1.0 - x, 3.0);
  float va = first ? 3.0 * x * x : 3.0 * (1.0 - x) * (1.0 - x);
  float z = 1.0 + 0.35 * sin(T_PI * p);
  float spread = A * 0.06 * va * strength;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 18; i++){
    float f = float(i) / 17.0 - 0.5;
    vec2 r = t_uv(t_rot(q, -(a + spread * f)) / z);
    acc += first ? t_fromM(r) : t_toM(r);
  }
  return acc / 18.0;
}`

// ---------------------------------------------------------------- yönlü hareket (D: içeriğin gittiği yön)
const DIRS = {
  sol: ['vec2(-1.0, 0.0)', 'Sola'],
  sag: ['vec2(1.0, 0.0)', 'Sağa'],
  yukari: ['vec2(0.0, 1.0)', 'Yukarı'],
  asagi: ['vec2(0.0, -1.0)', 'Aşağı'],
}

// A [0,1] karesinde, B onun hareket yönünün tersinde bitişik: şerit örnekleme
const STRIP = (D) => `
const vec2 D = ${D};
vec4 strip(vec2 s){
  return t_inside(s) > 0.5 ? getFromColor(s) : getToColor(clamp(s + D, 0.0, 1.0));
}`

const whip = (D, ease, taps) => STRIP(D) + `
float E(float x){ x = clamp(x, 0.0, 1.0); return ${ease}; }
vec4 transition(vec2 uv){
  float o = E(progress);
  float vel = (E(progress + 0.01) - E(progress - 0.01)) / 0.02;
  float bl = strength * 0.07 * vel * min(1.0, min(progress, 1.0 - progress) * 40.0);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${taps}; i++){
    float f = float(i) / ${taps - 1}.0 - 0.5;
    acc += strip(uv - D * (o + bl * f));
  }
  return acc / ${taps}.0;
}`

const cover = (D) => `
const vec2 D = ${D};
vec4 transition(vec2 uv){
  float o = t_cubicInOut(progress);
  float vel = (t_cubicInOut(min(progress + 0.01, 1.0)) - t_cubicInOut(max(progress - 0.01, 0.0))) / 0.02;
  vec2 sb = uv + D * (1.0 - o);
  vec4 b = vec4(0.0); float inB = 0.0;
  for (int i = 0; i < 8; i++){
    float f = float(i) / 7.0 - 0.5;
    vec2 s = sb + D * f * strength * 0.04 * vel;
    float ins = t_inside(s);
    b += getToColor(clamp(s, 0.0, 1.0)) * ins; inB += ins;
  }
  vec4 a = getFromColor(uv);
  a.rgb *= 1.0 - 0.45 * o;
  // B kenarının A üstüne düşen gölgesi
  float edge = dot(clamp(sb, 0.0, 1.0) - sb, -D);
  float sh = (1.0 - smoothstep(0.0, 0.08, edge)) * step(0.0, edge) * 0.5 * sin(T_PI * progress);
  a.rgb *= 1.0 - sh;
  float w = inB / 8.0;
  return w > 0.0 ? mix(a, b / max(inB, 1.0), w) : a;
}`

const uncover = (D) => `
const vec2 D = ${D};
vec4 transition(vec2 uv){
  float o = t_cubicInOut(progress);
  float vel = (t_cubicInOut(min(progress + 0.01, 1.0)) - t_cubicInOut(max(progress - 0.01, 0.0))) / 0.02;
  vec2 sa = uv - D * o;
  float z = 1.0 + 0.06 * (1.0 - o);
  vec4 b = getToColor(0.5 + (uv - 0.5) / z);
  b.rgb *= 0.55 + 0.45 * o;
  vec4 a = vec4(0.0); float inA = 0.0;
  for (int i = 0; i < 8; i++){
    float f = float(i) / 7.0 - 0.5;
    vec2 s = sa + D * f * strength * 0.04 * vel;
    float ins = t_inside(s);
    a += getFromColor(clamp(s, 0.0, 1.0)) * ins; inA += ins;
  }
  float edge = dot(clamp(sa, 0.0, 1.0) - sa, D);
  float sh = (1.0 - smoothstep(0.0, 0.08, edge)) * step(0.0, edge) * 0.5 * sin(T_PI * progress);
  b.rgb *= 1.0 - sh;
  float w = inA / 8.0;
  return w > 0.0 ? mix(b, a / max(inA, 1.0), w) : b;
}`

const accordion = (axis) => `
vec4 transition(vec2 uv){
  float b = t_cubicInOut(progress);
  float X = 1.0 - b;
  float c = uv.${axis};
  vec2 s = uv;
  vec4 col;
  if (c < X) { s.${axis} = c / max(X, 1e-4); col = getFromColor(s); col.rgb *= 1.0 - 0.35 * b * smoothstep(0.6, 1.0, s.${axis}); }
  else { s.${axis} = (c - X) / max(b, 1e-4); col = getToColor(s); col.rgb *= 1.0 - 0.35 * (1.0 - b) * (1.0 - smoothstep(0.0, 0.4, s.${axis})); }
  return col;
}`

const doors = `
vec4 transition(vec2 uv){
  float o = t_cubicInOut(progress) * 0.5;
  float z = 1.12 - 0.12 * progress;
  vec4 b = getToColor(0.5 + (uv - 0.5) / z);
  float gapL = 0.5 - o, gapR = 0.5 + o;
  float d = min(abs(uv.x - gapL), abs(uv.x - gapR));
  b.rgb *= 1.0 - 0.6 * exp(-d * 30.0) * sin(T_PI * progress);
  if (uv.x < gapL) { vec4 a = getFromColor(vec2(uv.x + o, uv.y)); a.rgb *= 1.0 - 0.3 * smoothstep(gapL - 0.1, gapL, uv.x) * (o * 2.0); return a; }
  if (uv.x > gapR) { vec4 a = getFromColor(vec2(uv.x - o, uv.y)); a.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(gapR, gapR + 0.1, uv.x)) * (o * 2.0); return a; }
  return b;
}`

const stretch = `
vec4 transition(vec2 uv){
  float p = progress;
  float xa = clamp(p * 2.0, 0.0, 1.0);
  float xb = clamp((p - 0.5) * 2.0, 0.0, 1.0);
  float sa = 1.0 + amount * t_cubicIn(xa);
  float sb = 1.0 + amount * (1.0 - t_cubicOut(xb));
  float va = 3.0 * xa * xa, vb = 3.0 * (1.0 - xb) * (1.0 - xb);
  vec4 A = vec4(0.0); vec4 B = vec4(0.0);
  for (int i = 0; i < 12; i++){
    float f = float(i) / 11.0 - 0.5;
    A += t_fromM(vec2(0.5 + (uv.x - 0.5) / (sa * (1.0 + f * 0.15 * va)), uv.y));
    B += t_toM(vec2(0.5 + (uv.x - 0.5) / (sb * (1.0 + f * 0.15 * vb)), uv.y));
  }
  vec4 c = mix(A, B, smoothstep(0.42, 0.58, p)) / 12.0;
  c.rgb += 0.25 * pow(sin(T_PI * p), 4.0);
  return c;
}`

export const MOTION = [
  T('zum-darbe-ici', 'Zum Darbe İçeri', 'yakinlas', 0.5, [P('zoom', 'Zum', 3, 1.2, 8), P('strength', 'Bulanıklık', 1, 0, 3)], zoomPunch(true)),
  T('zum-darbe-disi', 'Zum Darbe Dışarı', 'yakinlas', 0.5, [P('zoom', 'Zum', 3, 1.2, 8), P('strength', 'Bulanıklık', 1, 0, 3)], zoomPunch(false)),
  T('zum-bulanikligi', 'Zum Bulanıklığı', 'yakinlas', 0.6, [P('strength', 'Güç', 1, 0, 3)], zoomBlur),
  T('hiz-rampasi-zum', 'Hız Rampası Zum', 'yakinlas', 0.6, [P('zoom', 'Zum', 6, 1.5, 20), P('strength', 'Bulanıklık', 1, 0, 3), P('flash', 'Flaş', 0.8, 0, 1)], speedRamp),
  T('donerek-sag', 'Döner Bulanık Sağa', 'yakinlas', 0.6, [P('angle', 'Açı', 180, 30, 720), P('strength', 'Bulanıklık', 1, 0, 3)], spin('-1.0')),
  T('donerek-sol', 'Döner Bulanık Sola', 'yakinlas', 0.6, [P('angle', 'Açı', 180, 30, 720), P('strength', 'Bulanıklık', 1, 0, 3)], spin('1.0')),
  ...Object.entries(DIRS).map(([k, [D, ad]]) => T('kirbac-' + k, 'Kırbaç ' + ad, 'kaydir', 0.45, [P('strength', 'Bulanıklık', 1, 0, 3)], whip(D, 't_expoInOut(x)', 24))),
  ...Object.entries(DIRS).map(([k, [D, ad]]) => T('it-' + k, 'İt ' + ad, 'kaydir', 0.6, [P('strength', 'Bulanıklık', 0.4, 0, 3)], whip(D, 't_quintInOut(x)', 12))),
  ...Object.entries(DIRS).map(([k, [D, ad]]) => T('ort-' + k, 'Ört ' + ad, 'kaydir', 0.6, [P('strength', 'Bulanıklık', 0.6, 0, 3)], cover(D))),
  ...Object.entries(DIRS).map(([k, [D, ad]]) => T('ac-' + k, 'Aç ' + ad, 'kaydir', 0.6, [P('strength', 'Bulanıklık', 0.6, 0, 3)], uncover(D))),
  T('akordeon-yatay', 'Akordeon Yatay', 'kaydir', 0.7, [], accordion('x')),
  T('akordeon-dikey', 'Akordeon Dikey', 'kaydir', 0.7, [], accordion('y')),
  T('surgulu-kapi', 'Sürgülü Kapı', 'kaydir', 0.8, [], doors),
  T('esnet', 'Esnet', 'bozulma', 0.5, [P('amount', 'Esneme', 6, 1, 15)], stretch),
]
