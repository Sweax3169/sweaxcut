// Altyazı stilleri (REG.captionStyles) — kelime kelime vurgulu, viral biçimler
// text: yazı stili (kısmi; applyCaptionStyle defaultTextStyle üzerine uygular), words: ifade başına kelime
// active: { color, bg:{color,radius,padX,padY,opacity,outline}, scale, stroke, glow, shadow, fill, y, wipe, wipeColor, underline:{color,height,offset} }
// past / future: { color, opacity }, wordIn: pop|fade|slide|drop|bump|blur|type|spin|stretch|none|textAnim-id
// Ek alanlar: palette [renkler] (kelime başına sırayla), wordBg {color,opacity,radius,padX,padY} (her kelimeye kutu),
//   loop: 'wiggle'|'pulse'|'float', emoji: true

const NO = { enabled: false }
const sk = (color, width) => ({ enabled: true, color, width })
const sh = (color, blur, x, y, opacity = 0.6) => ({ enabled: true, color, blur, x, y, opacity })
const gw = (color, size, strength = 1) => ({ enabled: true, color, size, strength })
const lin = (angle, ...cols) => ({ type: 'linear', angle, stops: cols.map((c, i) => ({ at: i / Math.max(1, cols.length - 1), color: c })) })

function C(id, name, category, words, text, o = {}) {
  return { id, name, category, words, text: { stroke: NO, shadow: NO, glow: NO, bg: NO, stroke2: NO, size: 84, maxWidth: 0.82, ...text }, ...o }
}

export const CAPTION_CATEGORIES = [
  { id: 'viral', name: 'Viral' },
  { id: 'kutu', name: 'Kutulu' },
  { id: 'renkli', name: 'Renkli' },
  { id: 'sade', name: 'Sade' },
  { id: 'oyun', name: 'Oyun' },
  { id: 'ozel', name: 'Özel' },
]

export const CAPTION_STYLES = [
  // ---------------------------------------------------------------- viral
  C('alt-sari-kelime', 'Sarı kelime', 'viral', 3, { font: 'Archivo Black', weight: 400, color: '#FFFFFF', stroke: sk('#000000', 9), shadow: sh('#000', 10, 0, 6, 0.6) },
    { uppercase: true, active: { color: '#FFE600', scale: 1.14 }, wordIn: 'pop' }),
  C('alt-hormozi', 'Hormozi', 'viral', 3, { font: 'Montserrat', weight: 900, size: 92, color: '#FFFFFF', stroke: sk('#000000', 11), shadow: sh('#000', 0, 0, 8, 0.9) },
    { uppercase: true, active: { color: '#FFD400', scale: 1.22 }, past: { color: '#FFFFFF' }, wordIn: 'pop' }),
  C('alt-yesil-kutu', 'Yeşil kutu', 'viral', 3, { font: 'Montserrat', weight: 900, color: '#FFFFFF', stroke: sk('#000000', 7) },
    { uppercase: true, active: { color: '#FFFFFF', bg: { color: '#22C55E', radius: 12, padX: 14, padY: 8 }, scale: 1.08 }, wordIn: 'none' }),
  C('alt-renkli-tombul', 'Renkli tombul', 'viral', 2, { font: 'Luckiest Guy', weight: 400, size: 100, color: '#FFFFFF', stroke: sk('#000000', 12), extrude: { enabled: true, color: '#000000', depth: 8, angle: 70 } },
    { uppercase: true, palette: ['#FFE600', '#2EE6A6', '#FF5DA2', '#3FA9F5'], active: { scale: 1.25 }, wordIn: 'pop' }),
  C('alt-tiktok', 'Kısa video klasiği', 'viral', 4, { font: 'Inter', weight: 800, color: '#FFFFFF', stroke: sk('#000000', 7) },
    { active: { color: '#FE2C55', scale: 1.06 }, wordIn: 'none' }),
  C('alt-pembe-pop', 'Pembe pop', 'viral', 3, { font: 'Poppins', weight: 800, color: '#FFFFFF', stroke: sk('#1A0010', 8) },
    { uppercase: true, active: { color: '#FF5DA2', scale: 1.25 }, wordIn: 'pop' }),
  C('alt-dev-anton', 'Dev Anton', 'viral', 2, { font: 'Anton', weight: 400, size: 120, color: '#FFFFFF', stroke: sk('#000000', 8), letterSpacing: 1 },
    { uppercase: true, active: { color: '#E4FF3A', scale: 1.12 }, wordIn: 'pop' }),
  C('alt-vurgulu-buyut', 'Vurgulu büyüt', 'viral', 4, { font: 'Archivo', weight: 900, color: '#FFFFFF', stroke: sk('#000000', 8) },
    { uppercase: true, active: { scale: 1.38, y: -8 }, past: { opacity: 0.6 }, future: { opacity: 0.6 }, wordIn: 'none' }),
  C('alt-kalin-kontur', 'Kalın kontur', 'viral', 3, { font: 'Bangers', weight: 400, size: 104, color: '#FFFFFF', stroke: sk('#000000', 14), letterSpacing: 2 },
    { uppercase: true, active: { color: '#FFE600' }, wordIn: 'bump' }),
  C('alt-ziplayan', 'Zıplayan', 'viral', 3, { font: 'Rubik', weight: 900, color: '#FFFFFF', stroke: sk('#000000', 9) },
    { uppercase: true, active: { color: '#3FA9F5', scale: 1.15, y: -10 }, wordIn: 'drop' }),

  // ---------------------------------------------------------------- kutu
  C('alt-kelime-kutulari', 'Kelime kutuları', 'kutu', 4, { font: 'Archivo', weight: 800, color: '#FFFFFF' },
    { wordBg: { color: '#000000', opacity: 0.72, radius: 6, padX: 10, padY: 6 }, active: { color: '#111111', bg: { color: '#FFE600', radius: 6, padX: 10, padY: 6 } }, wordIn: 'fade' }),
  C('alt-kirmizi-kutu', 'Kırmızı kutu', 'kutu', 3, { font: 'Archivo', weight: 900, color: '#FFFFFF' },
    { uppercase: true, active: { bg: { color: '#E10600', radius: 4, padX: 14, padY: 8 }, scale: 1.06 }, wordIn: 'none', past: { opacity: 0.85 } }),
  C('alt-mavi-kutu', 'Mavi kutu', 'kutu', 3, { font: 'Poppins', weight: 800, color: '#FFFFFF', shadow: sh('#000', 12, 0, 4, 0.5) },
    { active: { bg: { color: '#3FA9F5', radius: 4, padX: 12, padY: 6 } }, wordIn: 'none' }),
  C('alt-sari-kutu', 'Sarı kutu', 'kutu', 3, { font: 'Montserrat', weight: 900, color: '#FFFFFF', stroke: sk('#000000', 6) },
    { uppercase: true, active: { color: '#111111', bg: { color: '#FFE600', radius: 8, padX: 14, padY: 6 }, stroke: { width: 0, color: '#FFE600' } }, wordIn: 'none' }),
  C('alt-ters-renk', 'Ters renk', 'kutu', 3, { font: 'Space Grotesk', weight: 700, color: '#FFFFFF', shadow: sh('#000', 10, 0, 4, 0.6) },
    { active: { color: '#000000', bg: { color: '#FFFFFF', radius: 2, padX: 10, padY: 6 } }, wordIn: 'none' }),
  C('alt-kayan-cerceve', 'Kayan çerçeve', 'kutu', 4, { font: 'Outfit', weight: 800, color: '#FFFFFF', shadow: sh('#000', 12, 0, 4, 0.6) },
    { active: { bg: { color: '#E4FF3A', radius: 10, padX: 12, padY: 8, outline: 4 } }, wordIn: 'none' }),
  C('alt-klasik', 'Klasik altyazı', 'kutu', 6, { font: 'Inter', weight: 600, size: 66, color: '#FFFFFF', bg: { enabled: true, color: '#000000', opacity: 0.62, radius: 6, padX: 18, padY: 8, mode: 'line' } },
    { active: { color: '#FFE97A' }, wordIn: 'none' }),
  C('alt-golgeli-kart', 'Beyaz kart', 'kutu', 5, { font: 'Nunito', weight: 900, size: 74, color: '#1A1A1A', bg: { enabled: true, color: '#FFFFFF', opacity: 1, radius: 18, padX: 24, padY: 12, mode: 'block' } },
    { active: { color: '#E10600', scale: 1.08 }, wordIn: 'none' }),
  C('alt-podcast', 'Podcast', 'kutu', 6, { font: 'Manrope', weight: 800, size: 70, color: '#FFFFFF', bg: { enabled: true, color: '#0E0E0E', opacity: 0.8, radius: 4, padX: 22, padY: 12, mode: 'block' } },
    { active: { color: '#E4FF3A' }, future: { opacity: 0.45 }, wordIn: 'none' }),

  // ---------------------------------------------------------------- renkli
  C('alt-karaoke', 'Karaoke dolgu', 'renkli', 4, { font: 'Poppins', weight: 800, color: '#FFFFFF', stroke: sk('#101030', 8) },
    { uppercase: true, active: { wipe: true, wipeColor: '#00E5FF' }, past: { color: '#00E5FF' }, wordIn: 'none' }),
  C('alt-gradyan', 'Gradyan kelime', 'renkli', 3, { font: 'Archivo Black', weight: 400, color: '#FFFFFF', stroke: sk('#000000', 8) },
    { uppercase: true, active: { fill: lin(180, '#FFD86B', '#FF7A59', '#D63AA2'), scale: 1.15 }, wordIn: 'pop' }),
  C('alt-iki-ton', 'İki ton', 'renkli', 4, { font: 'Kanit', weight: 900, color: '#FFFFFF', stroke: sk('#000000', 8) },
    { uppercase: true, palette: ['#FFFFFF', '#FFE600'], active: { scale: 1.12 }, wordIn: 'pop' }),
  C('alt-ates', 'Ateş', 'renkli', 3, { font: 'Bowlby One SC', weight: 400, color: '#FFFFFF', stroke: sk('#2A0000', 9) },
    { active: { fill: lin(180, '#FFF3A0', '#FFB800', '#FF5A00', '#C4001A'), glow: { color: '#FF5A00', size: 20, strength: 0.8 }, scale: 1.12 }, wordIn: 'pop' }),
  C('alt-krom', 'Krom', 'renkli', 3, { font: 'Russo One', weight: 400, color: '#D9E0E8', stroke: sk('#10151C', 8) },
    { uppercase: true, active: { fill: lin(180, '#FFFFFF', '#D9E0E8', '#4E5866', '#C3CDD8', '#FFFFFF'), scale: 1.15 }, wordIn: 'pop' }),
  C('alt-graffiti', 'Grafiti', 'renkli', 3, { font: 'Sedgwick Ave Display', weight: 400, size: 104, color: '#FFFFFF', stroke: sk('#000000', 8) },
    { palette: ['#FF5DA2', '#2EE6A6', '#FFE600'], active: { scale: 1.2 }, wordIn: 'spin' }),
  C('alt-rekor', 'Rekor', 'renkli', 3, { font: 'Russo One', weight: 400, color: '#FFFFFF', stroke: sk('#1A1000', 8) },
    { uppercase: true, active: { fill: lin(180, '#FFF6C8', '#FFD45A', '#C98A12', '#FFE07A'), scale: 1.2, glow: { color: '#FFB800', size: 18, strength: 0.7 } }, wordIn: 'pop' }),
  C('alt-sicak-soguk', 'Sıcak soğuk', 'renkli', 4, { font: 'Barlow Condensed', weight: 900, size: 104, color: '#FFFFFF', stroke: sk('#000000', 8), letterSpacing: 1 },
    { uppercase: true, palette: ['#3FA9F5', '#FF5A3C'], active: { color: '#FFFFFF', scale: 1.15 }, wordIn: 'stretch' }),

  // ---------------------------------------------------------------- sade
  C('alt-minimal', 'Minimal beyaz', 'sade', 5, { font: 'Inter', weight: 600, size: 70, color: '#FFFFFF', shadow: sh('#000000', 14, 0, 3, 0.7) },
    { future: { opacity: 0.5 }, wordIn: 'none' }),
  C('alt-bulanik', 'Bulanıktan net', 'sade', 4, { font: 'Outfit', weight: 700, color: '#FFFFFF', shadow: sh('#000000', 14, 0, 4, 0.7) },
    { future: { opacity: 0 }, wordIn: 'blur' }),
  C('alt-kayan', 'Aşağıdan kayan', 'sade', 4, { font: 'Montserrat', weight: 800, color: '#FFFFFF', stroke: sk('#000000', 6) },
    { future: { opacity: 0 }, wordIn: 'slide' }),
  C('alt-daktilo', 'Daktilo altyazı', 'sade', 5, { font: 'JetBrains Mono', weight: 700, size: 64, color: '#FFFFFF', bg: { enabled: true, color: '#000000', opacity: 0.75, radius: 0, padX: 18, padY: 10, mode: 'block' } },
    { future: { opacity: 0 }, active: { color: '#E4FF3A' }, wordIn: 'type' }),
  C('alt-sinema', 'Sinema', 'sade', 5, { font: 'Playfair Display', weight: 400, italic: true, size: 72, color: '#FFFFFF', shadow: sh('#000', 16, 0, 4, 0.6) },
    { future: { opacity: 0.35 }, wordIn: 'fade' }),
  C('alt-sakin', 'Sakin', 'sade', 4, { font: 'Nunito', weight: 800, size: 78, color: '#FFFFFF', shadow: sh('#000', 12, 0, 4, 0.5) },
    { active: { color: '#2EE6A6' }, wordIn: 'fade' }),
  C('alt-alt-cizgi', 'Alt çizgi', 'sade', 4, { font: 'Archivo', weight: 800, color: '#FFFFFF', shadow: sh('#000', 10, 0, 4, 0.6) },
    { active: { underline: { color: '#E4FF3A', height: 8, offset: 12 } }, wordIn: 'none' }),

  // ---------------------------------------------------------------- oyun
  C('alt-hud', 'Oyun HUD', 'oyun', 4, { font: 'Chakra Petch', weight: 700, color: '#7FF6FF', letterSpacing: 2 },
    { uppercase: true, wordBg: { color: '#04121C', opacity: 0.75, radius: 0, padX: 10, padY: 6 }, active: { color: '#04121C', bg: { color: '#00E5FF', radius: 0, padX: 10, padY: 6 } }, wordIn: 'slide' }),
  C('alt-neon', 'Neon parıltı', 'oyun', 3, { font: 'Audiowide', weight: 400, color: '#FFFFFF', glow: gw('#FF2D95', 6, 0.4) },
    { uppercase: true, future: { opacity: 0.5 }, active: { color: '#FFE3F2', glow: { color: '#FF2D95', size: 30, strength: 1.6 }, scale: 1.1 }, wordIn: 'none' }),
  C('alt-piksel', 'Piksel', 'oyun', 3, { font: 'Press Start 2P', weight: 400, size: 54, color: '#FFFFFF', stroke: sk('#000000', 7), lineHeight: 1.5 },
    { uppercase: true, active: { color: '#39FF14' }, wordIn: 'type' }),
  C('alt-korku', 'Korku', 'oyun', 3, { font: 'Nosifer', weight: 400, size: 70, color: '#E6E6E6', stroke: sk('#120000', 5) },
    { uppercase: true, active: { color: '#FF1A1A', glow: { color: '#B00000', size: 22, strength: 1.2 } }, loop: 'wiggle', wordIn: 'fade' }),
  C('alt-gece-mavisi', 'Gece mavisi', 'oyun', 4, { font: 'Exo 2', weight: 800, color: '#DDEBFF', stroke: sk('#04102A', 6) },
    { active: { color: '#FFFFFF', glow: { color: '#3FA9F5', size: 24, strength: 1.3 }, scale: 1.1 }, wordIn: 'none' }),
  C('alt-tetris', 'Blok blok', 'oyun', 3, { font: 'Tiny5', weight: 400, size: 96, color: '#FFFFFF' },
    { uppercase: true, wordBg: { color: '#5B21B6', opacity: 0.95, radius: 0, padX: 12, padY: 6 }, active: { color: '#111111', bg: { color: '#2EE6A6', radius: 0, padX: 12, padY: 6 } }, wordIn: 'drop' }),

  // ---------------------------------------------------------------- özel
  C('alt-emoji', 'Emojili', 'ozel', 3, { font: 'Archivo Black', weight: 400, color: '#FFFFFF', stroke: sk('#000000', 9) },
    { uppercase: true, emoji: true, active: { color: '#FFE600', scale: 1.12 }, wordIn: 'pop' }),
  C('alt-el-yazisi', 'El yazısı', 'ozel', 4, { font: 'Caveat', weight: 700, size: 100, color: '#FFFFFF', shadow: sh('#000', 12, 0, 4, 0.6) },
    { active: { color: '#FFD166', scale: 1.1 }, wordIn: 'fade' }),
  C('alt-firca', 'Fırça', 'ozel', 3, { font: 'Kaushan Script', weight: 400, size: 96, color: '#FFFFFF', stroke: sk('#000000', 5) },
    { active: { color: '#FF5DA2', scale: 1.15 }, wordIn: 'pop', loop: 'float' }),
  C('alt-sallanan', 'Sallanan', 'ozel', 3, { font: 'Grandstander', weight: 900, size: 92, color: '#FFFFFF', stroke: sk('#000000', 9) },
    { uppercase: true, active: { color: '#FFE600', scale: 1.2 }, loop: 'wiggle', wordIn: 'pop' }),
  C('alt-emoji-sade', 'Emojili sade', 'ozel', 4, { font: 'Outfit', weight: 800, color: '#FFFFFF', shadow: sh('#000', 12, 0, 4, 0.6) },
    { emoji: true, active: { color: '#E4FF3A' }, wordIn: 'fade' }),
]
