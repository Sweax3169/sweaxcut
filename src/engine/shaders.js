// Motorun yerleşik gölgelendiricileri: renk düzeltme, katman bileşimi (maske+kırpma), karışım modları, bulanıklık

import { GLSL_HELPERS } from './gl.js'

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
`

export const FS_COPY = HEAD + `
uniform sampler2D uTex;
uniform float uFlip;
uniform float uDim;
void main(){
  vec2 uv = vUv; if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec4 c = texture(uTex, uv);
  fragColor = vec4(c.rgb * (1.0 - uDim), c.a);
}`

export const FS_SOLID = HEAD + `
uniform vec4 uColor;
void main(){ fragColor = uColor; }`

export const FS_GRADIENT = HEAD + `
uniform vec3 uA; uniform vec3 uB; uniform float uAngle;
void main(){
  vec2 d = vec2(sin(uAngle), cos(uAngle));
  float t = clamp(dot(vUv - 0.5, d) + 0.5, 0.0, 1.0);
  fragColor = vec4(mix(uA, uB, t), 1.0);
}`

// Ayrılabilir Gauss bulanıklığı (yön + yarıçap px)
export const FS_BLUR = HEAD + `
uniform sampler2D uTex; uniform vec2 uDir; uniform vec2 uRes; uniform float uRadius;
void main(){
  vec2 px = uDir / uRes;
  float r = max(uRadius, 0.001);
  float sigma = r / 2.0;
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -12; i <= 12; i++){
    float x = float(i) * r / 12.0;
    float w = exp(-(x*x) / (2.0*sigma*sigma));
    acc += texture(uTex, vUv + px * x) * w;
    wsum += w;
  }
  fragColor = acc / wsum;
}`

// RGB kayması (animasyonlar için)
export const FS_RGBSPLIT = HEAD + `
uniform sampler2D uTex; uniform float uAmt; uniform vec2 uRes;
void main(){
  vec2 o = vec2(uAmt * 24.0 / uRes.x, 0.0);
  vec4 c = texture(uTex, vUv);
  float r = texture(uTex, vUv + o).r; float b = texture(uTex, vUv - o).b;
  fragColor = vec4(r, c.g, b, max(c.a, max(texture(uTex, vUv + o).a, texture(uTex, vUv - o).a)));
}`

// Katman bileşimi: dönüşümlü dörtgen, kırpma, maske, opaklık, parlaklık
export const FS_COMPOSE = HEAD + `
uniform sampler2D uTex;
uniform float uOpacity;
uniform float uBright;
uniform vec4 uCrop;          // l, t, r, b
uniform vec2 uLayerPx;       // katmanın ekrandaki piksel boyutu (maske en-boy oranı için)
uniform int uMaskType;       // 0 yok,1 doğrusal,2 ayna,3 daire,4 dikdörtgen,5 kalp,6 yıldız,7 elmas,8 altıgen
uniform vec2 uMaskPos;       // katman oranı, merkezden
uniform vec2 uMaskSize;
uniform float uMaskRot;
uniform float uMaskFeather;
uniform float uMaskRound;
uniform float uMaskInvert;

float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  vec2 a = p - vec2(0.0, 1.0); vec2 b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
float sdStar5(vec2 p, float r, float rf){
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdHex(vec2 p, float r){
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float maskAlpha(){
  if (uMaskType == 0) return 1.0;
  vec2 p = (vUv - 0.5) * uLayerPx;            // piksel, merkez orijin, y yukarı
  vec2 c = vec2(uMaskPos.x, -uMaskPos.y) * uLayerPx;
  p -= c;
  float a = radians(uMaskRot);
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  vec2 hs = max(uMaskSize * uLayerPx * 0.5, vec2(1.0));
  float mn = min(hs.x, hs.y);
  float d;
  if (uMaskType == 1) d = -p.y;
  else if (uMaskType == 2) d = abs(p.y) - hs.y;
  else if (uMaskType == 3) d = (length(p / hs) - 1.0) * mn;
  else if (uMaskType == 4) {
    float rr = uMaskRound * mn;
    vec2 q = abs(p) - hs + rr;
    d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
  }
  else if (uMaskType == 5) { vec2 q = p / hs; q.y = q.y * 0.9 + 0.55; d = sdHeart(vec2(q.x * 0.75, q.y)) * mn; }
  else if (uMaskType == 6) d = sdStar5(p / mn, 1.0, 0.45) * mn;
  else if (uMaskType == 7) { vec2 q = abs(p) / hs; d = (q.x + q.y - 1.0) * mn * 0.707; }
  else d = sdHex(p / mn, 0.9) * mn;
  float f = max(uMaskFeather * mn, 0.75);
  float al = 1.0 - smoothstep(-f, f, d);
  return uMaskInvert > 0.5 ? 1.0 - al : al;
}

void main(){
  vec2 uv = vec2(uCrop.x + vUv.x * (1.0 - uCrop.x - uCrop.z), uCrop.w + vUv.y * (1.0 - uCrop.y - uCrop.w));
  vec4 c = texture(uTex, uv);
  c.rgb = clamp(c.rgb + uBright, 0.0, 1.0);
  fragColor = vec4(c.rgb, c.a * uOpacity * maskAlpha());
}`

// Karışım modları — uBase (opak birikim) + uLayer (tuval boyutlu, düz alfa)
export const BLEND_MODES = [
  ['normal', 'Normal'], ['darken', 'Koyulaştır'], ['multiply', 'Çarp'], ['colorBurn', 'Renk yak'], ['linearBurn', 'Doğrusal yak'],
  ['lighten', 'Açıklaştır'], ['screen', 'Ekran'], ['colorDodge', 'Renk soldur'], ['add', 'Ekle (doğrusal soldur)'],
  ['overlay', 'Kaplama'], ['softLight', 'Yumuşak ışık'], ['hardLight', 'Sert ışık'], ['vividLight', 'Canlı ışık'],
  ['linearLight', 'Doğrusal ışık'], ['pinLight', 'İğne ışık'], ['hardMix', 'Sert karışım'], ['difference', 'Fark'],
  ['exclusion', 'Dışlama'], ['subtract', 'Çıkar'], ['divide', 'Böl'], ['hue', 'Ton'], ['saturation', 'Doygunluk'],
  ['color', 'Renk'], ['luminosity', 'Parlaklık'],
]

export const FS_BLEND = HEAD + GLSL_HELPERS + `
uniform sampler2D uBase; uniform sampler2D uLayer; uniform int uMode;
float bl(float b, float s, int m){
  if (m == 3) return s == 0.0 ? 0.0 : max(1.0 - (1.0 - b) / s, 0.0);
  if (m == 7) return s == 1.0 ? 1.0 : min(b / (1.0 - s), 1.0);
  if (m == 9) return b < 0.5 ? 2.0*b*s : 1.0 - 2.0*(1.0-b)*(1.0-s);
  if (m == 10) return s < 0.5 ? b - (1.0-2.0*s)*b*(1.0-b) : b + (2.0*s-1.0)*((b < 0.25 ? ((16.0*b-12.0)*b+4.0)*b : sqrt(b)) - b);
  if (m == 11) return s < 0.5 ? 2.0*b*s : 1.0 - 2.0*(1.0-b)*(1.0-s);
  if (m == 12) return s < 0.5 ? (s == 0.0 ? 0.0 : max(1.0 - (1.0-b)/(2.0*s), 0.0)) : (s == 1.0 ? 1.0 : min(b/(2.0*(1.0-s)), 1.0));
  if (m == 13) return clamp(b + 2.0*s - 1.0, 0.0, 1.0);
  if (m == 14) return s < 0.5 ? min(b, 2.0*s) : max(b, 2.0*s - 1.0);
  if (m == 15) return (b + s >= 1.0) ? 1.0 : 0.0;
  return s;
}
vec3 setLum(vec3 c, float l){ float d = l - luma(c); c += d; float L = luma(c); float n = min(min(c.r,c.g),c.b); float x = max(max(c.r,c.g),c.b);
  if (n < 0.0) c = L + (c - L) * L / (L - n); if (x > 1.0) c = L + (c - L) * (1.0 - L) / (x - L); return c; }
float sat(vec3 c){ return max(max(c.r,c.g),c.b) - min(min(c.r,c.g),c.b); }
vec3 setSat(vec3 c, float s){ float mx = max(max(c.r,c.g),c.b); float mn = min(min(c.r,c.g),c.b); float d = mx - mn; if (d <= 0.0) return vec3(0.0); return (c - mn) * s / d; }
vec3 blendRGB(vec3 b, vec3 s, int m){
  if (m == 1) return min(b, s);
  if (m == 2) return b * s;
  if (m == 4) return max(b + s - 1.0, 0.0);
  if (m == 5) return max(b, s);
  if (m == 6) return 1.0 - (1.0 - b) * (1.0 - s);
  if (m == 8) return min(b + s, 1.0);
  if (m == 16) return abs(b - s);
  if (m == 17) return b + s - 2.0 * b * s;
  if (m == 18) return max(b - s, 0.0);
  if (m == 19) return vec3(s.r > 0.0 ? min(b.r/s.r,1.0) : 1.0, s.g > 0.0 ? min(b.g/s.g,1.0) : 1.0, s.b > 0.0 ? min(b.b/s.b,1.0) : 1.0);
  if (m == 20) return setLum(setSat(s, sat(b)), luma(b));
  if (m == 21) return setLum(setSat(b, sat(s)), luma(b));
  if (m == 22) return setLum(s, luma(b));
  if (m == 23) return setLum(b, luma(s));
  return vec3(bl(b.r, s.r, m), bl(b.g, s.g, m), bl(b.b, s.b, m));
}
void main(){
  vec4 b = texture(uBase, vUv);
  vec4 s = texture(uLayer, vUv);
  vec3 r = uMode == 0 ? s.rgb : blendRGB(b.rgb, s.rgb, uMode);
  fragColor = vec4(mix(b.rgb, r, s.a), max(b.a, s.a));
}`

// Renk düzeltme süper-gölgelendirici. uA (klip ayarı) ve uF (filtre) dizileri:
// 0 parlaklık 1 kontrast 2 doygunluk 3 pozlama 4 sıcaklık 5 renk tonu 6 vurgular 7 gölgeler 8 beyazlar 9 siyahlar
// 10 canlılık 11 ton(hue) 12 keskinlik 13 netlik 14 vinyet 15 soldurma 16 gren
export const ADJ_KEYS = ['brightness', 'contrast', 'saturation', 'exposure', 'temperature', 'tint', 'highlights', 'shadows', 'whites', 'blacks', 'vibrance', 'hue', 'sharpen', 'clarity', 'vignette', 'fade', 'grain']

export function colorShader(filterGlsl) {
  return HEAD + GLSL_HELPERS + `
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uA[17];
uniform float uF[17];
uniform float uFAmt;
uniform float uHasF;
uniform vec3 uToneS; uniform vec3 uToneH; uniform float uToneAmt; uniform float uToneBal;
uniform sampler2D uCurve; uniform float uHasCurve;
uniform float uMono;
uniform vec3 uHSL[8]; uniform float uHasHSL;
uniform float uKeyOn; uniform vec3 uKeyColor; uniform float uKeyStrength; uniform float uKeySmooth; uniform float uKeySpill;
${filterGlsl ? filterGlsl : 'vec3 grade(vec3 c, vec2 uv){ return c; }'}

vec3 adjust(vec3 c, vec2 uv, float a[17], bool isClip){
  // pozlama
  c *= pow(2.0, a[3] * 1.6);
  // beyaz/siyah seviyeleri
  float lo = -a[9] * 0.18; float hi = 1.0 - a[8] * 0.25;
  c = clamp((c - lo) / max(hi - lo, 0.05), 0.0, 1.0);
  // parlaklık
  c = a[0] >= 0.0 ? mix(c, vec3(1.0), a[0] * 0.25) + a[0] * 0.08 : c * (1.0 + a[0] * 0.45);
  // kontrast (S-eğrisi)
  float k = a[1];
  c = clamp((c - 0.5) * (1.0 + k * (k > 0.0 ? 1.2 : 0.85)) + 0.5, 0.0, 1.0);
  // vurgu / gölge
  float l = luma(c);
  float ws = 1.0 - smoothstep(0.0, 0.55, l);
  float wh = smoothstep(0.45, 1.0, l);
  c += a[7] * 0.32 * ws * (a[7] > 0.0 ? (1.0 - c) : c);
  c += a[6] * 0.32 * wh * (a[6] > 0.0 ? (1.0 - c) : c);
  // sıcaklık / renk tonu
  c.r += a[4] * 0.10; c.b -= a[4] * 0.10; c.g += a[4] * 0.015;
  c.g -= a[5] * 0.08; c.r += a[5] * 0.03; c.b += a[5] * 0.03;
  c = clamp(c, 0.0, 1.0);
  // ton döndürme
  if (abs(a[11]) > 0.001) { vec3 h = rgb2hsv(c); h.x = fract(h.x + a[11] * 0.5); c = hsv2rgb(h); }
  // doygunluk + canlılık
  float g = luma(c);
  float s = a[2] >= 0.0 ? 1.0 + a[2] * 1.1 : 1.0 + a[2];
  c = mix(vec3(g), c, s);
  float curS = max(max(c.r,c.g),c.b) - min(min(c.r,c.g),c.b);
  c = mix(vec3(luma(c)), c, 1.0 + a[10] * (1.0 - curS) * 1.2);
  // soldurma (siyahları kaldır)
  if (a[15] > 0.0) c = mix(c, c * 0.78 + 0.16, a[15]); else c = mix(c, c * c * (3.0 - 2.0 * c), -a[15]);
  // vinyet
  if (abs(a[14]) > 0.001) {
    vec2 q = uv - 0.5; q.x *= uRes.x / uRes.y;
    float v = smoothstep(0.95, 0.25, length(q) * 1.15);
    c = a[14] > 0.0 ? c * mix(1.0, v, a[14]) : mix(c, vec3(1.0), (1.0 - v) * -a[14]);
  }
  // gren
  if (a[16] > 0.001) { float n = rand(uv * uRes + fract(uTime * 7.13) * 91.7) - 0.5; c += n * a[16] * 0.22; }
  return clamp(c, 0.0, 1.0);
}

vec3 hslAdjust(vec3 c){
  vec3 h = rgb2hsv(c);
  float hue = h.x * 360.0;
  float centers[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 275.0, 315.0);
  float dh = 0.0; float ds = 0.0; float dl = 0.0;
  for (int i = 0; i < 8; i++){
    float d = abs(hue - centers[i]); d = min(d, 360.0 - d);
    float w = (1.0 - smoothstep(0.0, i == 1 || i == 2 ? 24.0 : 40.0, d)) * smoothstep(0.03, 0.18, h.y);
    dh += uHSL[i].x * w; ds += uHSL[i].y * w; dl += uHSL[i].z * w;
  }
  h.x = fract(h.x + dh * 0.08);
  h.y = clamp(h.y * (1.0 + ds), 0.0, 1.0);
  h.z = clamp(h.z * (1.0 + dl * 0.6), 0.0, 1.0);
  return hsv2rgb(h);
}

void main(){
  vec4 src = texture(uTex, vUv);
  vec3 c = src.rgb;
  float alpha = src.a;
  // krom anahtar
  if (uKeyOn > 0.5) {
    float Y = luma(c);
    vec2 cc = vec2(c.b - Y, c.r - Y);
    float ky = luma(uKeyColor);
    vec2 kc = vec2(uKeyColor.b - ky, uKeyColor.r - ky);
    float d = distance(cc, kc);
    float th = uKeyStrength * 0.42;
    float m = smoothstep(th, th + uKeySmooth * 0.3 + 0.002, d);
    alpha *= m;
    // yeşil taşmayı bastır
    float spill = (1.0 - m) * uKeySpill;
    c = mix(c, vec3(Y), clamp(spill + (1.0 - smoothstep(th, th + 0.25, d)) * uKeySpill * 0.6, 0.0, 1.0));
  }
  // keskinlik
  float shp = uA[12] + uF[12] * uFAmt * uHasF;
  if (abs(shp) > 0.001) {
    vec2 px = 1.0 / uRes;
    vec3 bl = (texture(uTex, vUv + vec2(px.x, 0)).rgb + texture(uTex, vUv - vec2(px.x, 0)).rgb + texture(uTex, vUv + vec2(0, px.y)).rgb + texture(uTex, vUv - vec2(0, px.y)).rgb) * 0.25;
    c = clamp(c + (c - bl) * shp * 2.2, 0.0, 1.0);
  }
  float clr = uA[13];
  if (abs(clr) > 0.001) {
    vec2 px = 4.0 / uRes;
    vec3 bl = (texture(uTex, vUv + vec2(px.x, px.y)).rgb + texture(uTex, vUv - vec2(px.x, px.y)).rgb + texture(uTex, vUv + vec2(px.x, -px.y)).rgb + texture(uTex, vUv - vec2(px.x, -px.y)).rgb) * 0.25;
    c = clamp(c + (c - bl) * clr * 1.5, 0.0, 1.0);
  }
  // filtre
  if (uHasF > 0.5) {
    vec3 f = adjust(c, vUv, uF, false);
    if (uHasCurve > 0.5) {
      f = vec3(texture(uCurve, vec2(f.r, 0.5)).r, texture(uCurve, vec2(f.g, 0.5)).g, texture(uCurve, vec2(f.b, 0.5)).b);
    }
    if (uToneAmt > 0.001) {
      float L = luma(f);
      float wS = 1.0 - smoothstep(0.0, 0.6 + uToneBal * 0.3, L);
      float wH = smoothstep(0.4 + uToneBal * 0.3, 1.0, L);
      f = mix(f, f * 0.4 + uToneS * 0.6 * (0.4 + L), wS * uToneAmt);
      f = mix(f, f * 0.5 + uToneH * 0.5 + (L - 0.5) * 0.2, wH * uToneAmt);
    }
    if (uMono > 0.5) f = vec3(luma(f));
    f = grade(clamp(f, 0.0, 1.0), vUv);
    c = mix(c, clamp(f, 0.0, 1.0), uFAmt);
  }
  if (uHasHSL > 0.5) c = hslAdjust(c);
  c = adjust(c, vUv, uA, true);
  fragColor = vec4(c, alpha);
}`
}

// Efekt sarmalayıcı
export function effectShader(eff, glsl) {
  const params = (eff.params || []).map(p => {
    if (p.type === 'color') return `uniform vec3 u_${p.key};`
    if (p.type === 'vec2') return `uniform vec2 u_${p.key};`
    return `uniform float u_${p.key};`
  }).join('\n')
  return HEAD + `
uniform sampler2D uTex;
uniform sampler2D uOrig;
uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
uniform float uIntensity;
uniform float uSeed;
${GLSL_HELPERS}
vec4 tex(vec2 uv){ return texture(uTex, clamp(uv, vec2(0.0), vec2(1.0))); }
${params}
#define texture2D texture
${glsl}
void main(){ fragColor = effect(vUv); }`
}

// gl-transitions sarmalayıcı
export function transitionShader(glsl) {
  return HEAD + `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float progress;
uniform float ratio;
uniform float uTime;
vec4 getFromColor(vec2 uv){ return texture(uFrom, uv); }
vec4 getToColor(vec2 uv){ return texture(uTo, uv); }
#define texture2D texture
${glsl}
void main(){ fragColor = transition(vUv); }`
}
