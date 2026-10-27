// WebGL2 yardımcıları: program önbelleği, render hedefi havuzu, doku yükleme

export const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

// Dönüşümlü katman çizimi: köşeler piksel uzayında matrisle verilir
export const VS_LAYER = `#version 300 es
in vec2 aPos;
uniform mat3 uMat;      // birim kare (-0.5..0.5) → NDC
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vec3 p = uMat * vec3(aPos * 0.5, 1.0);
  gl_Position = vec4(p.xy, 0.0, 1.0);
}`

// Efekt / filtre parça kodlarında hazır bulunan yardımcılar
export const GLSL_HELPERS = `
float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(rand(i), rand(i+vec2(1,0)), u.x), mix(rand(i+vec2(0,1)), rand(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; } return v; }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`

export function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex
  let h = String(hex || '#000').replace('#', '')
  if (h.length === 3) h = h.split('').map(x => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export class GL {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance',
      desynchronized: !!opts.desynchronized,
    })
    if (!gl) throw new Error('WebGL2 desteklenmiyor')
    this.gl = gl
    gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('OES_texture_float_linear')
    this.programs = new Map()
    this.pool = []
    this.errors = new Map()
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    this.quad = buf
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    this.lost = false
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true })
  }

  // Program derle (anahtar ile önbellek). Hata olursa null döner ve hata kaydedilir.
  program(key, fsSource, vsSource = VS) {
    if (this.programs.has(key)) return this.programs.get(key)
    const gl = this.gl
    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s)
        gl.deleteShader(s)
        throw new Error(log)
      }
      return s
    }
    let prog = null
    try {
      const vs = compile(gl.VERTEX_SHADER, vsSource)
      const fs = compile(gl.FRAGMENT_SHADER, fsSource)
      prog = gl.createProgram()
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.bindAttribLocation(prog, 0, 'aPos')
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
      gl.deleteShader(vs); gl.deleteShader(fs)
      const uniforms = {}
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i)
        const name = info.name.replace(/\[0\]$/, '')
        uniforms[name] = { loc: gl.getUniformLocation(prog, info.name), type: info.type, size: info.size }
      }
      const p = { prog, uniforms, key }
      this.programs.set(key, p)
      return p
    } catch (e) {
      if (!this.errors.has(key)) {
        this.errors.set(key, String(e.message || e))
        console.warn('[gl] derleme hatası:', key, e.message || e)
      }
      this.programs.set(key, null)
      return null
    }
  }

  // Render hedefi (doku + fbo) — havuzdan
  target(w, h, opts = {}) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h))
    const i = this.pool.findIndex(t => !t.used && t.w === w && t.h === h)
    if (i >= 0) { const t = this.pool[i]; t.used = true; return t }
    const gl = this.gl
    const tex = this.texture(opts.nearest)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const t = { tex, fbo, w, h, used: true }
    this.pool.push(t)
    if (this.pool.length > 64) this.gc()
    return t
  }
  release(t) { if (t) t.used = false }
  releaseAll() { for (const t of this.pool) t.used = false }
  gc() {
    const gl = this.gl
    const keep = []
    for (const t of this.pool) {
      if (t.used) keep.push(t)
      else { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo) }
    }
    this.pool = keep
  }

  texture(nearest = false) {
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  // Kaynağı (video, img, canvas, ImageBitmap, {data,width,height}) dokuya yükle
  upload(tex, src) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (src && src.data && src.width) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src)
    }
  }

  bindTarget(t) {
    const gl = this.gl
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.w, t.h) }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height) }
  }

  // Programı kullan ve uniformları ata. vals: { name: number | [..] | {tex, unit} }
  use(p, vals) {
    const gl = this.gl
    gl.useProgram(p.prog)
    let unit = 0
    for (const name in vals) {
      const u = p.uniforms[name]
      if (!u) continue
      const v = vals[name]
      if (v && v.tex !== undefined) {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, v.tex)
        gl.uniform1i(u.loc, unit)
        unit++
        continue
      }
      setUniform(gl, u, v)
    }
    // atanmamış örnekleyiciler 0 dokusuna bağlı kalmasın
    gl.activeTexture(gl.TEXTURE0)
    return unit
  }

  draw() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  clear(r = 0, g = 0, b = 0, a = 1) {
    const gl = this.gl
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}

function setUniform(gl, u, v) {
  const T = gl
  switch (u.type) {
    case T.FLOAT:
      // dizi uniformları (uA[17] gibi) da FLOAT türü bildirir
      if (u.size > 1 && (Array.isArray(v) || v instanceof Float32Array)) gl.uniform1fv(u.loc, v)
      else gl.uniform1f(u.loc, typeof v === 'boolean' ? (v ? 1 : 0) : +v || 0)
      break
    case T.FLOAT_VEC2: gl.uniform2fv(u.loc, toArr(v, 2)); break
    case T.FLOAT_VEC3: gl.uniform3fv(u.loc, typeof v === 'string' ? hexToRgb(v) : toArr(v, 3)); break
    case T.FLOAT_VEC4: gl.uniform4fv(u.loc, typeof v === 'string' ? [...hexToRgb(v), 1] : ((Array.isArray(v) || v instanceof Float32Array) && v.length === 3 ? [v[0], v[1], v[2], 1] : toArr(v, 4))); break
    case T.INT: case T.BOOL: gl.uniform1i(u.loc, typeof v === 'boolean' ? (v ? 1 : 0) : Math.round(+v || 0)); break
    case T.INT_VEC2: gl.uniform2iv(u.loc, toArr(v, 2).map(Math.round)); break
    case T.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break
    case T.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break
    default:
      if (Array.isArray(v) || v instanceof Float32Array) {
        if (u.size > 1) gl.uniform1fv(u.loc, v)
      }
  }
}

function toArr(v, n) {
  if (Array.isArray(v) || v instanceof Float32Array) {
    if (v.length >= n) return v.length === n ? v : Array.prototype.slice.call(v, 0, n)
    const a = Array.from(v); while (a.length < n) a.push(0); return a
  }
  const x = +v || 0
  return new Array(n).fill(x)
}
