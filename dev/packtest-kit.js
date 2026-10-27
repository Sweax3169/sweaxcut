// Geçiş / animasyon paketleri için test yardımcıları (iki farklı test görüntüsü, iki klipli proje)
import { testPattern } from './testkit.js'

export { testPattern }

// İkinci test deseni: farklı renkler, farklı şekiller (geçişte iki kaynak ayırt edilsin)
export function testPatternB(w = 1280, h = 720) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const g = x.createLinearGradient(w, 0, 0, h); g.addColorStop(0, '#065f46'); g.addColorStop(0.5, '#14b8a6'); g.addColorStop(1, '#7c3aed')
  x.fillStyle = g; x.fillRect(0, 0, w, h)
  const s = h / 9
  for (let j = 0; j < 2; j++) for (let i = 0; i < 16; i++) { x.fillStyle = (i + j) % 2 ? '#fde047' : '#1e1b4b'; x.fillRect(i * w / 16, j * s * 0.6, w / 16, s * 0.6) }
  x.fillStyle = '#fff'; x.font = `900 ${h / 7}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillText('İKİNCİ KLİP', w / 2, h * 0.58)
  x.fillStyle = '#fde047'; x.fillRect(w * 0.78, h * 0.7, h * 0.18, h * 0.18)
  x.strokeStyle = '#fff'; x.lineWidth = h / 60; x.beginPath(); x.moveTo(w * 0.1, h * 0.9); x.lineTo(w * 0.3, h * 0.72); x.lineTo(w * 0.5, h * 0.9); x.stroke()
  return c
}

export function twoSources(imgA, imgB) {
  const pick = m => (m.id === 'mB' ? imgB : imgA)
  return {
    image: m => { const i = pick(m); return { src: i, w: i.width, h: i.height } },
    videoFrame: (c, m) => { const i = pick(m); return { src: i, w: i.width, h: i.height } },
  }
}

// İki görüntü klibi ardışık ana izde; ilkine geçiş takılabilir
export function twoClipProject(model, imgA, imgB, ratio = '16:9') {
  const p = model.createProject({ ratio })
  p.media.mA = { id: 'mA', type: 'image', name: 'A', width: imgA.width, height: imgA.height, duration: 3 }
  p.media.mB = { id: 'mB', type: 'image', name: 'B', width: imgB.width, height: imgB.height, duration: 3 }
  const a = model.createMediaClip(p.media.mA, { duration: 3, start: 0 })
  const b = model.createMediaClip(p.media.mB, { duration: 3, start: 3 })
  a.start = 0; b.start = 3
  p.tracks[0].clips.push(a, b)
  return { p, a, b }
}
