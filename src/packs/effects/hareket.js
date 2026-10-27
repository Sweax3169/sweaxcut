// Hareket: vertigo, girdap, dalga, balık gözü, yankı, zoom yumruğu, salınım…
import { R, B, S, AMT, SPD, PER, fx } from './lib.js'

export default {
  id: 'hareket', name: 'Hareket',
  items: [
    fx('vertigo', 'Vertigo (Dolly Zoom)', [AMT(0.6), SPD(1)], `
vec4 effect(vec2 uv){
  float ph = 0.5 - 0.5 * cos(uTime * u_speed * 1.6);
  float k = u_amount * uIntensity * ph;
  vec2 p = (uv - 0.5) * asp();
  float r = length(p);
  float s = 1.0 + k * 0.7 * (1.0 - smoothstep(0.0, 0.85, r)) - k * 0.15 * smoothstep(0.3, 1.0, r);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++){
    float f = float(i) / 5.0;
    vec2 q = p / (s * (1.0 - f * 0.025 * k));
    acc += pm(tx(q / asp() + 0.5));
  }
  return unpm(acc, 6.0);
}`, { tags: ['dolly zoom', 'vertigo', 'baş dönmesi'] }),

    fx('girdap', 'Girdap', [AMT(0.6), R('radius', 'Yarıçap', 0.1, 1.2, 0.6), SPD(1)], `
vec4 effect(vec2 uv){
  vec2 p = (uv - 0.5) * asp();
  float r = length(p);
  float k = u_amount * uIntensity * (0.6 + 0.4 * sin(uTime * u_speed * 2.0));
  float ang = k * 5.0 * pow(max(0.0, 1.0 - r / u_radius), 2.0);
  return tex(rot(ang) * p / asp() + 0.5);
}`, { tags: ['swirl', 'twirl', 'burgu'] }),

    fx('dalga', 'Dalga', [AMT(0.5), R('freq', 'Sıklık', 0.5, 10, 3), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed * 4.0;
  vec2 q = uv;
  q.x += sin(uv.y * u_freq * 6.28318 + t) * 0.025 * A;
  q.y += cos(uv.x * u_freq * 4.0 + t * 0.8) * 0.012 * A;
  return tex(q);
}`, { tags: ['wave', 'dalgalanma', 'su'] }),

    fx('su-halkasi', 'Su Halkası', [AMT(0.6), R('freq', 'Halka sıklığı', 0.3, 3, 1), SPD(1), R('cx', 'Merkez X', 0, 1, 0.5), R('cy', 'Merkez Y', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  vec2 p = (uv - vec2(u_cx, u_cy)) * asp();
  float r = length(p) + 1e-4;
  float w = sin(r * u_freq * 40.0 - uTime * u_speed * 8.0);
  float fall = exp(-r * 2.5);
  vec2 off = p / r * w * 0.012 * A * fall;
  vec4 c = tex(uv + off / asp());
  c.rgb = min(c.rgb + pow(max(w, 0.0), 4.0) * fall * 0.15 * A, 1.0);
  return c;
}`, { tags: ['ripple', 'damla', 'halka'] }),

    fx('balik-gozu', 'Balık Gözü', [AMT(0.6, 'Bombe'), R('pulse', 'Nabız', 0, 1, 0), R('rim', 'Kenar karartma', 0, 1, 0.3)], `
vec4 effect(vec2 uv){
  float k = u_amount * uIntensity * (1.0 + u_pulse * 0.4 * sin(uTime * 5.0));
  float hd = length(asp() * 0.5);
  vec2 p = (uv - 0.5) * asp() / hd;
  float r = length(p);
  vec2 q = p * pow(max(r, 1e-4), k * 0.9);
  vec4 c = tex(q * hd / asp() + 0.5);
  c.rgb *= mix(1.0, 1.0 - smoothstep(0.75, 1.05, r), u_rim);
  return c;
}`, { tags: ['fisheye', 'bulge', 'bombe', 'gopro'] }),

    fx('sikistir', 'Sıkıştır', [AMT(0.6), SPD(1)], `
vec4 effect(vec2 uv){
  float k = u_amount * uIntensity * (0.75 + 0.25 * sin(uTime * u_speed * 3.0));
  float hd = length(asp() * 0.5);
  vec2 p = (uv - 0.5) * asp() / hd;
  float r = length(p);
  vec2 q = p * pow(max(r, 1e-3), -k * 0.6);
  return tex(q * hd / asp() + 0.5);
}`, { tags: ['pinch', 'içe çek'] }),

    fx('hayalet-iz', 'Hayalet İzi', [AMT(0.7), SPD(1), R('trail', 'İz uzunluğu', 0.2, 3, 1), B('rainbow', 'Renkli iz', false)], `
vec2 path(float t){ return vec2(sin(t * 2.1) * 0.03 + sin(t * 3.7) * 0.012, cos(t * 1.7) * 0.022); }
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 base = tex(uv - path(t) * A * 0.5);
  vec3 C = base.rgb * base.a; float aa = base.a;
  for (int i = 1; i <= 6; i++){
    float fi = float(i);
    vec4 g = tex(uv - path(t - fi * 0.07 * u_trail) * A);
    float w = 0.55 * pow(0.72, fi);
    vec3 tint = mix(vec3(1.0), rainbow(fi / 6.0 + t * 0.2) * 1.3, u_rainbow);
    C = scr(C, clamp(g.rgb * g.a * w * tint, 0.0, 1.0));
    aa = aa + g.a * w * (1.0 - aa);
  }
  return vec4(clamp(C / max(aa, 1e-4), 0.0, 1.0), aa);
}`, { tags: ['echo', 'ghost', 'trail', 'yankı'] }),

    fx('zoom-yumruk', 'Zoom Yumruğu', [AMT(0.6), PER(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float p = fract(uTime / max(u_period, 0.2));
  float zin = eob(p * 5.0);
  float zout = 1.0 - smoothstep(0.65, 1.0, p);
  float z = 1.0 + A * 0.35 * zin * zout;
  float vel = (1.0 - smoothstep(0.0, 0.2, p)) * A;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 8; i++){ float f = float(i) / 7.0; acc += pm(tx(0.5 + (uv - 0.5) / (z * (1.0 - f * 0.06 * vel)))); }
  return unpm(acc, 8.0);
}`, { tags: ['punch zoom', 'zoom', 'vuruş'] }),

    fx('donme-salinim', 'Dönme Salınımı', [AMT(1), R('angle', 'Açı (derece)', 1, 30, 8, 1), SPD(1)], `
vec4 effect(vec2 uv){
  float th = radians(u_angle) * u_amount * uIntensity * sin(uTime * u_speed * 3.0);
  float a = ar();
  float z = abs(cos(th)) + abs(sin(th)) * max(a, 1.0 / a);
  vec2 p = rot(th) * ((uv - 0.5) * asp()) / z;
  return tex(p / asp() + 0.5);
}`, { tags: ['rotate', 'wobble', 'sallanma'] }),

    fx('sarhos', 'Sarhoş', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec2 p = rot(sin(t * 0.9) * 0.05 * A) * ((uv - 0.5) * asp()) / (1.0 + 0.08 * A);
  vec2 q = p / asp() + 0.5;
  q += vec2(sin(q.y * 6.0 + t * 1.3), cos(q.x * 5.0 + t)) * 0.01 * A;
  vec2 dv = vec2(0.025 + 0.015 * sin(t * 1.7), 0.006 * cos(t * 1.3)) * A;
  vec4 c = mix(tex(q - dv), tex(q + dv), 0.5);
  c.rgb = satur(c.rgb, 1.0 + 0.2 * A * sin(t * 0.7));
  return c;
}`, { tags: ['drunk', 'çift görme', 'baş dönmesi'] }),

    fx('kalp-atisi', 'Kalp Atışı', [AMT(0.8), R('bpm', 'Nabız (BPM)', 40, 180, 96, 1), R('red', 'Kırmızı vinyet', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float p = fract(uTime * u_bpm / 60.0);
  float e = exp(-p * 14.0) + exp(-max(p - 0.2, 0.0) * 14.0) * 0.65 * step(0.2, p);
  float z = 1.0 + 0.09 * A * e;
  vec4 c = tex(0.5 + (uv - 0.5) / z);
  float v = 1.0 - vig(uv, 0.4, 1.5);
  c.rgb = mix(c.rgb, c.rgb * vec3(1.0, 0.3, 0.3), v * e * u_red * A);
  return c;
}`, { tags: ['heartbeat', 'nabız', 'thump'] }),

    fx('sonsuz-kaydirma', 'Sonsuz Kaydırma', [SPD(1), R('angle', 'Yön (derece)', 0, 360, 0, 1), B('mirror', 'Aynalı (dikişsiz)', true)], `
vec4 effect(vec2 uv){
  float a = radians(u_angle);
  vec2 q = uv + vec2(cos(a), sin(a)) * uTime * u_speed * 0.25 * uIntensity;
  q = u_mirror > 0.5 ? 1.0 - abs(1.0 - mod(q, 2.0)) : fract(q);
  return tex(q);
}`, { tags: ['scroll', 'kaydır', 'loop', 'döngü'] }),

    fx('jole', 'Jöle', [AMT(0.7), SPD(1), R('pivot', 'Sabit nokta (Y)', 0, 1, 0)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed * 6.0;
  float s = sin(t) * 0.12 * A;
  vec2 piv = vec2(0.5, u_pivot);
  vec2 d = uv - piv;
  d.x -= sin(t - 0.8) * 0.06 * A * d.y;
  return tex(piv + d / vec2(1.0 + s, 1.0 - s));
}`, { tags: ['jelly', 'squash', 'esnek', 'çıkartma'] }),

    fx('ken-burns', 'Ken Burns (Yavaş Zoom)', [AMT(0.6, 'Zoom'), S('dir', 'Yön', [['iceri', 'İçeri'], ['disari', 'Dışarı']]), R('angle', 'Kaydırma açısı', 0, 360, 0, 1), R('pan', 'Kaydırma', 0, 1, 0.5)], `
vec4 effect(vec2 uv){
  float p = smoothstep(0.0, 1.0, uProgress);
  if (u_dir > 0.5) p = 1.0 - p;
  float z = 1.0 + u_amount * uIntensity * 0.35 * p;
  float a = radians(u_angle);
  vec2 q = 0.5 + (uv - 0.5) / z + vec2(cos(a), sin(a)) * (0.5 - 0.5 / z) * u_pan;
  return tex(q);
}`, { tags: ['ken burns', 'yavaş zoom', 'fotoğraf'], previewDuration: 3 }),

    fx('zoom-izi', 'Zoom İzi', [AMT(0.7), SPD(1)], `
vec4 effect(vec2 uv){
  float A = u_amount * uIntensity;
  float t = uTime * u_speed;
  vec4 base = tex(uv);
  vec3 C = base.rgb * base.a; float aa = base.a;
  for (int i = 1; i <= 5; i++){
    float fi = float(i);
    float s = 1.0 + fi * 0.06 * A * (0.6 + 0.4 * sin(t * 3.0));
    vec4 g = tex(0.5 + (uv - 0.5) / s);
    float w = 0.4 * pow(0.72, fi);
    C = scr(C, g.rgb * g.a * w);
    aa = aa + g.a * w * (1.0 - aa);
  }
  return vec4(clamp(C / max(aa, 1e-4), 0.0, 1.0), aa);
}`, { tags: ['zoom trail', 'yankı', 'echo'] }),
  ],
}
