// Kütüphane önizlemeleri için prosedürel örnek kareler (oyun sahnesi A/B) + "kesim masası" zemini.
// Hepsi bir kez çizilir ve önbellekte tutulur.

const cache = new Map()

function mk(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key)
}

function rnd(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// A: gece arenası — synthwave gökyüzü, neon ızgara zemin, oyuncu silüeti, HUD (filtre farkları görünsün diye renkli + ten rengi)
export function sampleA(w = 176, h = 176) {
  return once('A' + w + 'x' + h, () => {
    const c = mk(w, h), x = c.getContext('2d')
    const k = w / 176
    const hz = h * 0.56
    let g = x.createLinearGradient(0, 0, 0, hz)
    g.addColorStop(0, '#120a3a'); g.addColorStop(0.55, '#6b1d8f'); g.addColorStop(1, '#ff6a3d')
    x.fillStyle = g; x.fillRect(0, 0, w, hz)
    // yıldızlar
    const r = rnd(7)
    x.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) x.fillRect(r() * w, r() * hz * 0.6, k, k)
    // güneş (çizgili)
    const sx = w * 0.62, sy = hz - 4 * k, sr = 34 * k
    g = x.createLinearGradient(0, sy - sr, 0, sy)
    g.addColorStop(0, '#ffe45c'); g.addColorStop(1, '#ff2d7a')
    x.save(); x.beginPath(); x.arc(sx, sy, sr, Math.PI, 0); x.closePath(); x.clip()
    x.fillStyle = g; x.fillRect(sx - sr, sy - sr, sr * 2, sr)
    x.fillStyle = '#6b1d8f'
    for (let i = 0; i < 5; i++) x.fillRect(sx - sr, sy - sr * 0.45 + i * sr * 0.12, sr * 2, (1.2 + i * 0.7) * k)
    x.restore()
    // dağlar
    x.fillStyle = '#2a0c4f'
    x.beginPath(); x.moveTo(0, hz)
    for (let i = 0; i <= 12; i++) x.lineTo(i * w / 12, hz - (8 + ((i * 37) % 23)) * k)
    x.lineTo(w, hz); x.fill()
    // zemin + perspektif ızgara
    g = x.createLinearGradient(0, hz, 0, h)
    g.addColorStop(0, '#1a0633'); g.addColorStop(1, '#05010d')
    x.fillStyle = g; x.fillRect(0, hz, w, h - hz)
    x.strokeStyle = '#ff2fd6'; x.lineWidth = 1 * k; x.globalAlpha = 0.85
    for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(w / 2 + i * 6 * k, hz); x.lineTo(w / 2 + i * 40 * k, h); x.stroke() }
    for (let i = 1; i < 9; i++) { const y = hz + Math.pow(i / 8, 1.9) * (h - hz); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke() }
    x.globalAlpha = 1
    // oyuncu silüeti (ten rengi yüz + kırmızı ceket + mavi silah)
    const px = w * 0.3, py = h * 0.86
    x.fillStyle = '#d93a3a'; x.fillRect(px - 13 * k, py - 46 * k, 26 * k, 30 * k)
    x.fillStyle = '#1d2a6b'; x.fillRect(px - 12 * k, py - 17 * k, 10 * k, 17 * k); x.fillRect(px + 2 * k, py - 17 * k, 10 * k, 17 * k)
    x.fillStyle = '#e8b48a'; x.beginPath(); x.arc(px, py - 56 * k, 10 * k, 0, 7); x.fill()
    x.fillStyle = '#2b1a10'; x.fillRect(px - 10 * k, py - 67 * k, 20 * k, 6 * k)
    x.fillStyle = '#29d3ff'; x.fillRect(px + 8 * k, py - 38 * k, 30 * k, 6 * k); x.fillRect(px + 12 * k, py - 33 * k, 6 * k, 9 * k)
    // HUD: can çubuğu, nişangah, cephane
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(8 * k, h - 18 * k, 62 * k, 9 * k)
    x.fillStyle = '#2ee66a'; x.fillRect(10 * k, h - 16 * k, 40 * k, 5 * k)
    x.fillStyle = '#ff3b3b'; x.fillRect(50 * k, h - 16 * k, 8 * k, 5 * k)
    x.strokeStyle = '#ffffff'; x.lineWidth = 1.5 * k
    const cx = w * 0.64, cy = h * 0.72
    x.beginPath(); x.moveTo(cx - 9 * k, cy); x.lineTo(cx - 3 * k, cy); x.moveTo(cx + 3 * k, cy); x.lineTo(cx + 9 * k, cy)
    x.moveTo(cx, cy - 9 * k); x.lineTo(cx, cy - 3 * k); x.moveTo(cx, cy + 3 * k); x.lineTo(cx, cy + 9 * k); x.stroke()
    x.fillStyle = '#ffffff'; x.font = `800 ${12 * k}px "Geist Mono Variable", monospace`; x.textAlign = 'right'; x.textBaseline = 'alphabetic'
    x.fillText('30/90', w - 8 * k, h - 9 * k)
    x.fillStyle = '#ffe45c'; x.font = `800 ${8 * k}px "Geist Mono Variable", monospace`; x.textAlign = 'left'
    x.fillText('x3 ELENDİ', 8 * k, 13 * k)
    return c
  })
}

// B: gündüz voksel tepeler — mavi gök, bulutlar, yeşil bloklar, hedef, mini harita
export function sampleB(w = 176, h = 176) {
  return once('B' + w + 'x' + h, () => {
    const c = mk(w, h), x = c.getContext('2d')
    const k = w / 176
    let g = x.createLinearGradient(0, 0, 0, h * 0.6)
    g.addColorStop(0, '#2a7fff'); g.addColorStop(1, '#9fe0ff')
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(w * 0.18, h * 0.18, 14 * k, 0, 7); x.fill()
    x.fillStyle = 'rgba(255,255,255,0.92)'
    for (const [cx, cy, s] of [[0.55, 0.16, 1], [0.82, 0.28, 0.7], [0.32, 0.33, 0.6]]) {
      const bw = 34 * k * s, bh = 9 * k * s
      x.fillRect(w * cx - bw / 2, h * cy, bw, bh); x.fillRect(w * cx - bw / 4, h * cy - bh * 0.8, bw / 2, bh)
    }
    const r = rnd(3), bs = 11 * k
    for (let col = 0; col * bs < w; col++) {
      const top = h * 0.52 + Math.round(Math.sin(col * 0.55) * 3 + r() * 2) * bs * 0.5
      for (let y = top; y < h; y += bs) {
        const first = y === top
        x.fillStyle = first ? (col % 2 ? '#4fc93a' : '#5ad642') : ((Math.floor(y / bs) + col) % 2 ? '#8a5a2b' : '#7a4f25')
        x.fillRect(col * bs, y, bs, bs)
        x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(col * bs, y + bs - k, bs, k)
      }
    }
    // ağaç
    const tx = w * 0.72, ty = h * 0.5
    x.fillStyle = '#6b3f1d'; x.fillRect(tx, ty - 6 * k, 7 * k, 24 * k)
    x.fillStyle = '#1f8a3a'; x.fillRect(tx - 12 * k, ty - 30 * k, 31 * k, 26 * k)
    x.fillStyle = '#2aa84a'; x.fillRect(tx - 6 * k, ty - 38 * k, 19 * k, 10 * k)
    // hedef
    const gx = w * 0.36, gy = h * 0.56
    for (const [rr, col] of [[16, '#ffffff'], [12, '#ff2d55'], [8, '#ffffff'], [4, '#ff2d55']]) { x.fillStyle = col; x.beginPath(); x.arc(gx, gy, rr * k, 0, 7); x.fill() }
    // mini harita
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(w - 40 * k, 8 * k, 32 * k, 32 * k)
    x.strokeStyle = '#ffffff'; x.lineWidth = k; x.strokeRect(w - 40 * k, 8 * k, 32 * k, 32 * k)
    x.fillStyle = '#ffd400'; x.beginPath(); x.moveTo(w - 24 * k, 18 * k); x.lineTo(w - 20 * k, 28 * k); x.lineTo(w - 28 * k, 28 * k); x.fill()
    x.fillStyle = '#ffffff'; x.font = `800 ${9 * k}px "Geist Mono Variable", monospace`; x.textBaseline = 'alphabetic'
    x.fillText('TUR 2', 8 * k, h - 9 * k)
    return c
  })
}

// Yazı şablonları için nötr gri "kesim masası" zemini (siyah kontur da görünsün)
export function matBackdrop(w = 400, h = 400) {
  return once('mat' + w + 'x' + h, () => {
    const c = mk(w, h), x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#3d424b'); g.addColorStop(1, '#23262c')
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1
    const s = w / 10
    for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke() }
    return c
  })
}

// Görüntüyü kare olarak kırp (cover)
export function coverSquare(src, size) {
  const c = mk(size, size), x = c.getContext('2d')
  const sw = src.width || src.videoWidth, sh = src.height || src.videoHeight
  if (!sw || !sh) return null
  const k = Math.max(size / sw, size / sh)
  x.drawImage(src, (size - sw * k) / 2, (size - sh * k) / 2, sw * k, sh * k)
  return c
}

// Kare neredeyse tamamen siyah/boş mu?
export function isBlank(c) {
  try {
    const x = c.getContext('2d')
    const d = x.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4 * 37) sum += d[i] + d[i + 1] + d[i + 2]
    return sum / (d.length / (4 * 37)) < 12
  } catch (e) { return true }
}
