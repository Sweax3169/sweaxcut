// Bütün içerik paketlerini yükle — her paket src/packs/<ad>/index.js içinde kendini kaydeder.
const mods = import.meta.glob('./*/index.js', { eager: true })

export const loadedPacks = Object.keys(mods).map(k => k.split('/')[1])

// Yazı tiplerini yükle (fonts paketi loadFonts dışa aktarır)
export async function initPacks() {
  const fonts = mods['./fonts/index.js']
  if (fonts && fonts.loadFonts) {
    try { await fonts.loadFonts() } catch (e) { console.warn('yazı tipleri yüklenemedi', e) }
  }
}
