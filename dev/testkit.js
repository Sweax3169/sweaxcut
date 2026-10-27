// Ortak test yardımcıları: test deseni görüntüsü + sahte kaynak sağlayıcı
export function testPattern(w = 1280, h = 720) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1d4ed8'); g.addColorStop(0.5, '#db2777'); g.addColorStop(1, '#f59e0b')
  x.fillStyle = g; x.fillRect(0, 0, w, h)
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#111111'; x.fillRect(i * w / 12, h * 0.8, w / 12, h * 0.2) }
  x.fillStyle = '#fff'; x.font = `900 ${h / 6}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillText('SWEAX ÇŞĞÜİ', w / 2, h * 0.4)
  x.beginPath(); x.arc(w * 0.15, h * 0.2, h * 0.1, 0, 7); x.fillStyle = '#22c55e'; x.fill()
  return c
}
export function fakeSources(img) {
  return {
    image: () => ({ src: img, w: img.width, h: img.height }),
    videoFrame: () => ({ src: img, w: img.width, h: img.height }),
  }
}
export function testProject(model, img) {
  const p = model.createProject({ ratio: '9:16' })
  p.media.m1 = { id: 'm1', type: 'image', name: 'test', width: img.width, height: img.height, duration: 5 }
  const c = model.createMediaClip(p.media.m1, { duration: 5 })
  p.tracks[0].clips.push(c)
  return { p, c }
}
