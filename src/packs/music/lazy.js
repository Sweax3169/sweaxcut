// Tembel zamanlama: uzun parçalarda bütün düğümleri baştan yaratmak Chrome'da çok yavaş (her işlem dilimi tüm grafı dolaşır).
// Ses çağrıları kuyruğa alınır; OfflineAudioContext.suspend() ile ~2 sn'lik dilimler halinde, çalmadan hemen önce yaratılır.
let Q = null

// f(ctx, m, t, ...) biçimli ses fonksiyonunu kuyruklanabilir yap (getT: başlangıç zamanını bulur)
export function lazy(f, getT = (a) => a[2]) {
  return (...a) => { if (Q) Q.push({ t: +getT(a) || 0, f, a }); else return f(...a) }
}
export function lazyAll(mod) {
  const o = {}
  for (const k in mod) o[k] = typeof mod[k] === 'function' ? lazy(mod[k]) : mod[k]
  return o
}

// build() içinde yapılan bütün tembel çağrıları dilimler halinde zamanla
export function scheduleLazy(ctx, build, { chunk = 2, look = 0.6 } = {}) {
  Q = []
  try { build() } finally { /* aşağıda */ }
  const q = Q.sort((x, y) => x.t - y.t)
  Q = null
  const total = ctx.length / ctx.sampleRate
  let i = 0
  const flush = (until) => { while (i < q.length && q[i].t < until) { const e = q[i++]; e.f(...e.a) } }
  if (typeof ctx.suspend !== 'function' || typeof ctx.startRendering !== 'function') { flush(Infinity); return }
  flush(chunk + look)
  const quantum = 128 / ctx.sampleRate
  for (let ts = chunk; ts < total - 0.05; ts += chunk) {
    const at = Math.round(ts / quantum) * quantum
    ctx.suspend(at).then(() => { flush(at + chunk + look); ctx.resume() })
  }
}
