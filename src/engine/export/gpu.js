// Dışa aktarma GPU yardımcıları
//  • YuvPacker: bileşik RGBA kareyi GPU'da BT.709 sınırlı aralık YUV420p'ye paketler → okuma ve boru 2.67× küçülür
//  • installFrameUpload: kod çözücüden gelen YUV420p düzlemlerini GPU'da RGBA dokuya çevirir (bileşimci fark etmez)
//  • ownTarget: havuz dışı (yeniden kullanılmayan) render hedefi

const FS_PACK = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uTex;
uniform int uW; uniform int uH; uniform int uTW;
out vec4 fragColor;
const vec3 KY = vec3(0.2126, 0.7152, 0.0722);
vec3 px(int x, int y){ return texelFetch(uTex, ivec2(x, uH - 1 - y), 0).rgb; }
float byteAt(int b){
  int ysz = uW * uH;
  if (b < ysz) { int y = b / uW; int x = b - y * uW; return 16.0 + 219.0 * dot(px(x, y), KY); }
  int cw = uW / 2; int ch = uH / 2; int csz = cw * ch;
  int o = b - ysz;
  bool isV = o >= csz;
  if (isV) o -= csz;
  if (o >= csz) return 0.0;
  int cy = o / cw; int cx = o - cy * cw;
  int x0 = cx * 2; int y0 = cy * 2;
  vec3 c = (px(x0, y0) + px(x0 + 1, y0) + px(x0, y0 + 1) + px(x0 + 1, y0 + 1)) * 0.25;
  float Y = dot(c, KY);
  return isV ? 128.0 + 224.0 * (c.r - Y) / 1.5748 : 128.0 + 224.0 * (c.b - Y) / 1.8556;
}
void main(){
  int x = int(gl_FragCoord.x); int y = int(gl_FragCoord.y);
  int b = (y * uTW + x) * 4;
  fragColor = clamp(vec4(byteAt(b), byteAt(b + 1), byteAt(b + 2), byteAt(b + 3)) / 255.0, 0.0, 1.0);
}`

const FS_YUV = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uY; uniform sampler2D uU; uniform sampler2D uV;
uniform mat3 uM; uniform vec3 uOff;
void main(){
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 yuv = vec3(texture(uY, uv).r, texture(uU, uv).r, texture(uV, uv).r) - uOff;
  fragColor = vec4(clamp(uM * yuv, 0.0, 1.0), 1.0);
}`

export function ownTarget(glw, w, h) {
  const t = glw.target(w, h)
  const i = glw.pool.indexOf(t)
  if (i >= 0) glw.pool.splice(i, 1)
  t.used = true
  return t
}

export function freeTarget(glw, t) {
  if (!t) return
  try { glw.gl.deleteTexture(t.tex); glw.gl.deleteFramebuffer(t.fbo) } catch (e) { /* */ }
}

export class YuvPacker {
  constructor(glw, w, h, { pbo = false } = {}) {
    this.glw = glw
    this.gl = glw.gl
    this.w = w; this.h = h
    this.bytes = (w * h * 3) / 2
    this.tw = w % 4 === 0 ? w / 4 : 512
    this.th = Math.ceil(this.bytes / 4 / this.tw)
    this.readBytes = this.tw * this.th * 4
    this.prog = glw.program('export:yuvpack', FS_PACK)
    if (!this.prog) throw new Error('YUV paketleyici derlenemedi: ' + (glw.errors.get('export:yuvpack') || ''))
    this.target = ownTarget(glw, this.tw, this.th)
    this.pbos = null
    if (pbo) {
      const gl = this.gl
      // depolama ilk okumada ayrılır (önceden ayırmak Chromium'da gölge kopya uyarısı verir)
      this.pbos = [0, 1, 2].map(() => ({ b: gl.createBuffer(), sync: null, alloc: false }))
    }
  }

  pack(src) {
    const gl = this.gl
    this.glw.bindTarget(this.target)
    gl.disable(gl.BLEND)
    this.glw.use(this.prog, { uTex: { tex: src.tex }, uW: this.w, uH: this.h, uTW: this.tw })
    this.glw.draw()
  }

  // eşzamanlı okuma
  read(out) {
    const gl = this.gl
    this.glw.bindTarget(this.target)
    gl.readPixels(0, 0, this.tw, this.th, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  // PBO ile eşzamansız okuma başlat (slot 0..2)
  kick(slot) {
    const gl = this.gl
    const p = this.pbos[slot]
    this.glw.bindTarget(this.target)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.b)
    if (!p.alloc) { gl.bufferData(gl.PIXEL_PACK_BUFFER, this.readBytes, gl.STREAM_READ); p.alloc = true }
    gl.readPixels(0, 0, this.tw, this.th, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    p.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    gl.flush()
  }

  async finish(slot, out, yieldFn) {
    const gl = this.gl
    const p = this.pbos[slot]
    if (p.sync) {
      let n = 0
      while (gl.clientWaitSync(p.sync, 0, 0) === gl.TIMEOUT_EXPIRED && n++ < 2000) await yieldFn()
      gl.deleteSync(p.sync)
      p.sync = null
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.b)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out, 0, this.readBytes)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    return out
  }

  dispose() {
    freeTarget(this.glw, this.target)
    if (this.pbos) for (const p of this.pbos) { try { if (p.sync) this.gl.deleteSync(p.sync); this.gl.deleteBuffer(p.b) } catch (e) { /* */ } }
  }
}

// YUV → RGB matrisi (sütun öncelikli mat3) — giriş sınırlı (tv) aralık
const KR = { bt709: [0.2126, 0.0722], bt601: [0.299, 0.114], bt2020: [0.2627, 0.0593] }
function yuvMatrix(matrix = 'bt709', range = 'tv') {
  const [kr, kb] = KR[matrix] || KR.bt709
  const kg = 1 - kr - kb
  const ys = range === 'pc' ? 1 : 255 / 219
  const cs = range === 'pc' ? 1 : 255 / 224
  return {
    m: new Float32Array([
      ys, ys, ys,
      0, -cs * 2 * kb * (1 - kb) / kg, cs * 2 * (1 - kb),
      cs * 2 * (1 - kr), -cs * 2 * kr * (1 - kr) / kg, 0,
    ]),
    off: [range === 'pc' ? 0 : 16 / 255, 128 / 255, 128 / 255],
  }
}

class PlaneConverter {
  constructor(glw) {
    this.glw = glw
    this.gl = glw.gl
    this.prog = glw.program('export:yuv2rgb', FS_YUV)
    if (!this.prog) throw new Error('YUV dönüştürücü derlenemedi: ' + (glw.errors.get('export:yuv2rgb') || ''))
    this.planes = null
    this.fbo = this.gl.createFramebuffer()
    this.sizes = new WeakMap()
    this.mats = new Map()
  }

  _plane(i, w, h, data, offset) {
    const gl = this.gl
    const p = this.planes[i]
    gl.bindTexture(gl.TEXTURE_2D, p.tex)
    if (p.w !== w || p.h !== h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data, offset)
      p.w = w; p.h = h
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED, gl.UNSIGNED_BYTE, data, offset)
    }
  }

  upload(tex, src) {
    const gl = this.gl
    const glw = this.glw
    const w = src.width, h = src.height
    if (!this.planes) this.planes = [0, 1, 2].map(() => ({ tex: glw.texture(), w: 0, h: 0 }))
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const cw = w >> 1, ch = h >> 1
    this._plane(0, w, h, src.data, 0)
    this._plane(1, cw, ch, src.data, w * h)
    this._plane(2, cw, ch, src.data, w * h + cw * ch)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    // hedef doku depolaması
    const sz = this.sizes.get(tex)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (!sz || sz.w !== w || sz.h !== h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      this.sizes.set(tex, { w, h })
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.viewport(0, 0, w, h)
    gl.disable(gl.BLEND)
    const key = (src.matrix || 'bt709') + ':' + (src.range || 'tv')
    let mat = this.mats.get(key)
    if (!mat) { mat = yuvMatrix(src.matrix, src.range); this.mats.set(key, mat) }
    glw.use(this.prog, { uY: { tex: this.planes[0].tex }, uU: { tex: this.planes[1].tex }, uV: { tex: this.planes[2].tex }, uM: mat.m, uOff: mat.off })
    glw.draw()
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  dispose() {
    const gl = this.gl
    try {
      if (this.planes) for (const p of this.planes) gl.deleteTexture(p.tex)
      gl.deleteFramebuffer(this.fbo)
    } catch (e) { /* */ }
  }
}

// Bileşimcinin GL sarmalayıcısına kare yükleme kancası: {planes:true} → GPU'da YUV→RGB;
// aynı kare (seq) tekrar gelirse yeniden yükleme yapılmaz.
export function installFrameUpload(glw) {
  if (glw.__exportUpload) return glw.__exportUpload
  const orig = glw.upload.bind(glw)
  const conv = new PlaneConverter(glw)
  const seqOf = new WeakMap()
  glw.upload = (tex, src) => {
    if (src && src.seq != null) {
      if (seqOf.get(tex) === src.seq) return
      seqOf.set(tex, src.seq)
    }
    if (src && src.planes) return conv.upload(tex, src)
    return orig(tex, src)
  }
  glw.__exportUpload = { conv, restore: () => { glw.upload = orig; conv.dispose() } }
  return glw.__exportUpload
}
