// Zaman çizelgesi yerleşimi: iz yükseklikleri, renkler, satır konumları

export const RULER_H = 30
export const HEADER_W = 132

export const TRACK_H = {
  main: 68,
  video: 54,
  text: 34,
  sticker: 34,
  effect: 28,
  audio: 48,
}

export const CLIP_COLORS = {
  video: '#4d8dff',
  image: '#5cb6ff',
  audio: '#36d39b',
  text: '#e070ee',
  sticker: '#ffb84d',
  effect: '#ff6b8b',
  filter: '#4fd6e8',
  adjust: '#b9c0cd',
}

export const TRACK_LABELS = {
  video: 'Video', text: 'Yazı', sticker: 'Çıkartma', effect: 'Efekt', audio: 'Ses',
}

export function trackHeight(t) {
  if (t.main) return TRACK_H.main
  return TRACK_H[t.kind] || 40
}

// Satırlar: ana izden önce bir ayraç boşluğu bırakılır (ana iz ortada, görsel izler üstte, ses altta)
export function computeRows(tracks) {
  const rows = []
  let y = RULER_H + 6
  for (const t of tracks) {
    const h = trackHeight(t)
    if (t.main) y += 4
    rows.push({ track: t, y, h })
    y += h + (t.main ? 10 : 3)
  }
  return { rows, height: y + 40 }
}

export function rowAt(rows, y) {
  for (const r of rows) if (y >= r.y - 2 && y < r.y + r.h + 2) return r
  return null
}
