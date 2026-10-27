// Klip başına ffmpeg kod çözücü (dışa aktarma için kare-doğru).
// Kare dizini k = floor(kaynakZamanı × F). -ss (k-0.25)/F ile başlatılır → ilk çıkan kare tam k olur.
// İleri mod: kareler k, k+m, k+2m… gelir (m = sabit hızda tamsayı seyreltme).
// Ters parça modu (ters kopya yoksa): [k-C+1, k] aralığı çözülür, 'reverse' ile k, k-m… sırasıyla gelir.

import { spawnFF, killChild, tailErr } from './proc.js'

const MAXQ = 4        // tampondaki en fazla kare
let SEQ = 1

export class ClipDecoder {
  // o: { file, F, Fstr, w, h, mode:'yuv'|'rgba', matrix, range, colorFilter, preInput[], m, reverse, chunk,
  //      maxIdx, still, label, warn }
  constructor(o) {
    Object.assign(this, o)
    this.opts = o
    this.m = Math.max(1, o.m | 0 || 1)
    this.frameBytes = this.mode === 'yuv' ? (this.w * this.h * 3) / 2 : this.w * this.h * 4
    this.queue = []
    this.free = []
    this.cur = null
    this.proc = null
    this.gen = 0
    this.eof = true
    this.paused = false
    this.waiter = null
    this.fill = null
    this.foff = 0
    this.errors = 0
    this.produced = 0
    this.jump = Math.max(4, Math.round(this.F * 2))   // 2 sn'den uzak ileri sıçrama → yeniden başlat
    this.closed = false
    this.restarts = 0
  }

  // kaynak zamanı → kare dizini
  index(srcTime) {
    const k = Math.floor(Math.max(0, srcTime) * this.F + 1e-3)
    return Math.min(this.maxIdx, Math.max(0, k))
  }

  _args(k) {
    const F = this.F
    const a = ['-hide_banner', '-v', 'error', '-nostdin', ...(this.preInput || [])]
    let S = 0, T = 0
    if (this.reverse) {
      const lo = Math.max(0, k - this.chunk + 1)
      this.chunkLow = lo
      if (lo > 0) S = (lo - 0.25) / F
      T = (k + 0.5) / F - S
    } else if (k > 0) S = (k - 0.25) / F
    if (S > 0) a.push('-ss', S.toFixed(6))
    if (T > 0) a.push('-t', T.toFixed(6))
    a.push('-i', this.file, '-map', '0:v:0', '-an', '-sn', '-dn')
    const vf = [`fps=${this.Fstr}`]
    const sc = `scale=${this.w}:${this.h}:flags=bicubic`
    if (this.mode === 'yuv') {
      vf.push(`${sc}:in_range=${this.range === 'pc' ? 'pc' : 'tv'}:out_range=tv`, 'format=yuv420p')
      if (this.reverse) vf.push('reverse')
      if (this.m > 1) vf.push(`select='not(mod(n,${this.m}))'`)
    } else {
      // RGBA: önce boyutla (yuv'de ucuz), sonra renk dönüşümü
      vf.push(sc)
      if (this.reverse) vf.push('reverse')
      if (this.m > 1) vf.push(`select='not(mod(n,${this.m}))'`)
      vf.push(this.colorFilter || 'format=rgba')
    }
    a.push('-vf', vf.join(','))
    if (this.still) a.push('-frames:v', '1')
    a.push('-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1')
    return a
  }

  start(k) {
    this._kill()
    if (this.closed) return
    const gen = ++this.gen
    this.restarts++
    for (const f of this.queue) this._recycle(f)
    this.queue = []
    this.fill = null
    this.foff = 0
    this.eof = false
    this.paused = false
    this.base = k
    this.next = k
    this.genProduced = 0
    let proc
    try {
      proc = spawnFF(this._args(k), { stdout: true })
    } catch (e) {
      this.eof = true
      this._fail(String(e.message || e))
      return
    }
    this.proc = proc
    proc.stdout.on('data', chunk => { if (gen === this.gen) this._onData(chunk) })
    proc.done.then(code => {
      if (gen !== this.gen) return
      if (this.fill && this.foff > 0) { this._recycleBuf(this.fill); this.fill = null }
      this.eof = true
      this.proc = null
      if (code !== 0 && !this.genProduced && !this.closed) this._fail(tailErr(proc.errTail))
      this._wake()
    })
  }

  _fail(msg) {
    this.errors++
    // hiç kare vermeden iki kez düştüyse ölü say: bir daha başlatma (her karede süreç açmasın)
    if (!this.produced && this.errors >= 2) this.dead = true
    if (this.warn && this.errors === 1) {
      const line = String(msg || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).pop() || ''
      this.warn(`"${this.label}" karesi çözülemedi${line ? ': ' + line.slice(0, 160) : ''}`)
    }
  }

  _onData(chunk) {
    const fb = this.frameBytes
    let off = 0
    while (off < chunk.length) {
      if (!this.fill) { this.fill = this.free.pop() || Buffer.allocUnsafeSlow(fb); this.foff = 0 }
      const n = Math.min(fb - this.foff, chunk.length - off)
      chunk.copy(this.fill, this.foff, off, off + n)
      this.foff += n
      off += n
      if (this.foff === fb) {
        const idx = this.next
        this.next += this.reverse ? -this.m : this.m
        this.queue.push(this._frame(idx, this.fill))
        this.fill = null
        this.produced++
        this.genProduced++
      }
    }
    if (this.queue.length >= MAXQ && this.proc && !this.paused) { this.paused = true; this.proc.stdout.pause() }
    this._wake()
  }

  _frame(idx, buf) {
    const seq = SEQ++
    const src = { data: buf, width: this.w, height: this.h, seq }
    if (this.mode === 'yuv') { src.planes = true; src.matrix = this.matrix; src.range = 'tv' }
    return { idx, buf, view: { src, w: this.w, h: this.h } }
  }

  _recycleBuf(buf) { if (buf && this.free.length < 3) this.free.push(buf) }
  _recycle(f) { if (f) this._recycleBuf(f.buf) }

  _setCur(f) {
    if (this.cur && this.cur !== f) this._recycle(this.cur)
    this.cur = f
  }

  _shift() {
    const f = this.queue.shift()
    if (this.paused && this.queue.length < MAXQ - 1 && this.proc) { this.paused = false; this.proc.stdout.resume() }
    return f
  }

  _wake() { const w = this.waiter; this.waiter = null; if (w) w() }
  _wait() { return new Promise(r => { this.waiter = r }) }

  _covers(f, k) { return f && k >= f.idx && k < f.idx + this.m }

  // k dizinli kareyi döndür → { src, w, h } (görünüm) ya da null
  async frameAt(k) {
    if (this.closed || this.dead) return this.cur ? this.cur.view : null
    k = Math.min(this.maxIdx, Math.max(0, k))
    // seyreltmede kafes dışı uç kare (kaynak sonu/başı kıstırması, geçiş taşması) → tek kare çöz
    if (this.m > 1 && this.base != null && (k === this.maxIdx || k === 0) && Math.abs(k - this.base) % this.m !== 0) return this._edge(k)
    if (this._covers(this.cur, k)) return this.cur.view
    if (this.still && this.cur) return this.cur.view
    if (this.reverse) return this._frameRev(k)
    const pos = this.cur ? this.cur.idx : this.base
    if (this.base == null || k < pos || k > this.next + this.jump) this.start(k)
    else if (this.eof && !this.queue.length && !this.cur) this.start(k)
    let guard = 0
    for (;;) {
      while (this.queue.length) {
        const f = this.queue[0]
        if (f.idx + this.m <= k) { this._recycle(this._shift()); continue }
        if (f.idx > k && this.cur && this.cur.idx <= k) return this.cur.view
        this._setCur(this._shift())
        return this.cur.view
      }
      if (this.eof) {
        if (this.cur) return this.cur.view   // dosya sonu: son kareyi tut
        if (this.errors) { if (guard++ === 0 && !this.dead) { this.start(k); continue } return null }
        if (guard++ === 0 && k > 0) { this.start(Math.max(0, k - Math.round(this.F))); continue }
        return null
      }
      await this._wait()
      if (this.closed) return null
    }
  }

  _edge(k) {
    if (!this.edges) this.edges = new Map()
    let p = this.edges.get(k)
    if (!p) {
      const d = new ClipDecoder({ ...this.opts, m: 1, still: true, reverse: false })
      p = d.frameAt(k).finally(() => d.close())
      this.edges.set(k, p)
    }
    return p
  }

  async _frameRev(k) {
    const top = this.cur ? this.cur.idx : this.next
    if (!this.proc && this.eof && !this.queue.length) this.start(k)
    else if (k > top || k < (this.chunkLow ?? 0) || top - k > this.jump) this.start(k)
    let guard = 0
    for (;;) {
      while (this.queue.length) {
        const f = this.queue[0]
        if (f.idx > k) { this._recycle(this._shift()); continue }
        this._setCur(this._shift())
        return this.cur.view
      }
      if (this.eof) {
        if (guard++ < 2 && !this.dead) { this.start(k); continue }
        return this.cur ? this.cur.view : null
      }
      await this._wait()
      if (this.closed) return null
    }
  }

  _kill() {
    if (this.proc) { killChild(this.proc); this.proc = null }
    this.gen++
  }

  close() {
    this.closed = true
    this._kill()
    this.queue = []
    this.free = []
    this.cur = null
    this._wake()
  }
}
