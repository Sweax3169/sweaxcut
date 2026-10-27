// Hazır yazı şablonları (REG.textTemplates) — stil + isteğe bağlı animasyon + örnek metin
// text alanı defaultTextStyle üzerine uygulanır (applyTextTemplate önce varsayılana sıfırlar).
// transform?: { y } — alt bant / meme gibi konumu belli şablonlar için önerilen konum.

// ------------------------------------------------------------------ dolgu hazırları
const lin = (angle, ...cols) => ({ type: 'linear', angle, stops: cols.map((c, i) => Array.isArray(c) ? { at: c[0], color: c[1] } : { at: i / Math.max(1, cols.length - 1), color: c }) })
export const FILL_PRESETS = {
  altin: { name: 'Altın', fill: lin(180, [0, '#FFF6C8'], [0.38, '#FFD45A'], [0.55, '#C98A12'], [0.78, '#FFE07A'], [1, '#9A5B00']) },
  krom: { name: 'Krom', fill: lin(180, [0, '#FFFFFF'], [0.45, '#D9E0E8'], [0.52, '#4E5866'], [0.72, '#C3CDD8'], [1, '#FFFFFF']) },
  ates: { name: 'Ateş', fill: lin(180, '#FFF3A0', '#FFB800', '#FF5A00', '#C4001A') },
  buz: { name: 'Buz', fill: lin(180, '#FFFFFF', '#BDF3FF', '#4FC3F7', '#1565C0') },
  zehir: { name: 'Zehir', fill: lin(180, '#F4FF9E', '#9DFF00', '#1F9E00') },
  gunbatimi: { name: 'Gün batımı', fill: lin(180, '#FFD86B', '#FF7A59', '#D63AA2') },
  okyanus: { name: 'Okyanus', fill: lin(180, '#7CF7FF', '#2C9BFF', '#2A2EB8') },
  gokkusagi: { name: 'Gökkuşağı', fill: { ...lin(90, '#FF3B3B', '#FF9F1C', '#FFE600', '#2EE6A6', '#3FA9F5', '#B98CFF'), scope: 'block' } },
  seker: { name: 'Şeker', fill: lin(180, '#FFC2E6', '#FF5DA2', '#B26BFF') },
  galaksi: { name: 'Galaksi', fill: lin(135, '#00F5FF', '#7A5CFF', '#FF3CAC') },
  bronz: { name: 'Bronz', fill: lin(180, '#FFE0B5', '#D9894A', '#7A3E12') },
  zumrut: { name: 'Zümrüt', fill: lin(180, '#D7FFE9', '#2EE6A6', '#00664A') },
  kan: { name: 'Kan', fill: lin(180, '#FF8A8A', '#E10600', '#5A0000') },
  vapor: { name: 'Vapor', fill: { ...lin(90, '#FF71CE', '#01CDFE', '#05FFA1'), scope: 'block' } },
  limon: { name: 'Limon', fill: lin(180, '#FFFFFF', '#E4FF3A', '#A8C400') },
  ikiton: { name: 'İki ton', fill: lin(180, [0, '#FFFFFF'], [0.52, '#FFFFFF'], [0.52, '#FFE600'], [1, '#FFE600']) },
  synth: { name: 'Synthwave', fill: lin(180, [0, '#FFE66D'], [0.45, '#FF6EC7'], [0.5, '#7B2FF7'], [0.55, '#FF6EC7'], [1, '#2DE2E6']) },
  serit: { name: 'Şerit', fill: { type: 'stripes', colors: ['#FFE600', '#111111'], size: 9 } },
  seker2: { name: 'Şeker çubuğu', fill: { type: 'stripes', colors: ['#FFFFFF', '#FF2E4D'], size: 8 } },
}
const F = k => FILL_PRESETS[k].fill

// ------------------------------------------------------------------ yardımcılar
const NO = { enabled: false }
const sk = (color, width, join) => ({ enabled: true, color, width, ...(join ? { join } : {}) })
const sh = (color, blur, x, y, opacity = 0.6) => ({ enabled: true, color, blur, x, y, opacity })
const gw = (color, size, strength = 1) => ({ enabled: true, color, size, strength })
const bx = (color, opacity, radius, padX, padY, mode = 'block', extra) => ({ enabled: true, color, opacity, radius, padX, padY, mode, ...extra })
const ex = (color, depth, angle = 60, color2) => ({ enabled: true, color, depth, angle, ...(color2 ? { color2 } : {}) })
const bar = (color, width = 8, side = 'left', gap) => ({ enabled: true, color, width, side, ...(gap != null ? { gap } : {}) })
const an = (inn, out, loop) => {
  const o = {}
  if (inn) o.in = Array.isArray(inn) ? { id: 'yazi-' + inn[0], duration: inn[1] } : { id: 'yazi-' + inn }
  if (out) o.out = Array.isArray(out) ? { id: 'yazi-cik-' + out[0], duration: out[1] } : { id: 'yazi-cik-' + out }
  if (loop) o.loop = Array.isArray(loop) ? { id: 'yazi-dongu-' + loop[0], duration: loop[1] } : { id: 'yazi-dongu-' + loop }
  for (const k in o) if (!o[k].duration) delete o[k].duration
  return o
}
// şablon: belirtilmeyen kontur KAPALI sayılır (varsayılan stilde kontur açık)
function T(id, name, category, sampleText, text, anim, extra) {
  const t = { stroke: NO, shadow: NO, glow: NO, bg: NO, stroke2: NO, ...text }
  return { id, name, category, sampleText, text: t, ...(anim && Object.keys(anim).length ? { anim } : {}), ...extra }
}

export const TEMPLATE_CATEGORIES = [
  { id: 'oyun', name: 'Oyun' },
  { id: 'baslik', name: 'Başlık' },
  { id: 'sosyal', name: 'Sosyal medya' },
  { id: 'komik', name: 'Komik / meme' },
  { id: 'neon', name: 'Neon' },
  { id: 'sinema', name: 'Sinematik' },
  { id: 'retro', name: 'Retro' },
  { id: 'zarif', name: 'Zarif' },
  { id: 'etiket', name: 'Etiket / alt bant' },
  { id: 'vurgu', name: 'Vurgu' },
]

export const TEMPLATES = [
  // ================================================================ OYUN
  T('oyun-gg', 'GG', 'oyun', 'GG!', { font: 'Bungee', size: 170, weight: 400, fill: lin(180, '#F4FF9E', '#9DFF00', '#2BB400'), stroke: sk('#0B2A00', 10), stroke2: sk('#ffffff', 7), extrude: ex('#0B2A00', 14, 70) }, an(['damga', 0.45], 'uzaklas', 'nabiz')),
  T('oyun-kill', 'Leş bildirimi', 'oyun', 'TRIPLE KILL', { font: 'Black Ops One', size: 120, weight: 400, color: '#FF2E3A', stroke: sk('#140003', 6), glow: gw('#FF1A2E', 26, 1), letterSpacing: 2 }, an('glitch', 'glitch')),
  T('oyun-zafer', 'Zafer', 'oyun', 'ZAFER', { font: 'Cinzel', size: 150, weight: 900, fill: F('altin'), stroke: sk('#3B2200', 5), glow: gw('#FFB800', 30, 0.7), shadow: sh('#000000', 18, 0, 10, 0.6), letterSpacing: 10 }, an('uzaktan-yaklas', 'bulanik-son')),
  T('oyun-hasar', 'Hasar sayısı', 'oyun', '-248', { font: 'Luckiest Guy', size: 150, weight: 400, italic: true, fill: F('ates'), stroke: sk('#4A0000', 9), shadow: sh('#000', 0, 6, 8, 0.7) }, an('buyuyerek', 'yukari-uc')),
  T('oyun-kritik', 'Kritik vuruş', 'oyun', 'KRİTİK! 999', { font: 'Bangers', size: 140, weight: 400, color: '#FFE600', stroke: sk('#C4001A', 7), stroke2: sk('#000000', 7), letterSpacing: 3, curve: 14 }, an('damga', 'patla', 'titre')),
  T('oyun-kombo', 'Kombo sayacı', 'oyun', 'x12 KOMBO', { font: 'Russo One', size: 120, weight: 400, italic: true, fill: lin(180, '#FFFFFF', '#7FF6FF', '#00A3FF'), stroke: sk('#001A3A', 8), shadow: sh('#00A3FF', 0, 6, 6, 0.9) }, an('kelime-patla', 'esnek', 'nabiz')),
  T('oyun-boss', 'Boss başlığı', 'oyun', 'KADİM EJDERHA', { font: 'Pirata One', size: 140, weight: 400, fill: F('kan'), stroke: sk('#120000', 5), glow: gw('#A30000', 34, 1.2), letterSpacing: 6 }, an('bulanik-buyu', 'buhar')),
  T('oyun-seviye', 'Seviye atladın', 'oyun', 'SEVİYE 25!', { font: 'Press Start 2P', size: 82, weight: 400, color: '#FFE600', stroke: sk('#000000', 8, 'miter'), extrude: ex('#FF5A00', 10, 90), lineHeight: 1.4 }, an('harf-patla', 'harf-kucul')),
  T('oyun-bitti', 'Oyun bitti', 'oyun', 'OYUN BİTTİ', { font: 'VT323', size: 170, weight: 400, color: '#FF3B3B', glow: gw('#FF0000', 28, 1.4), letterSpacing: 6 }, an('neon-yan', 'neon-son', 'neon-titresim')),
  T('oyun-hud', 'HUD görevi', 'oyun', 'GÖREV: KALEYİ AL', { font: 'Chakra Petch', size: 64, weight: 700, color: '#7FF6FF', bg: bx('#04121C', 0.78, 2, 28, 16), bar: bar('#00E5FF', 8, 'left'), letterSpacing: 4, align: 'left' }, an('daktilo-imlec', 'maske-kapa'), { transform: { y: -0.3 } }),
  T('oyun-clutch', 'Clutch', 'oyun', '1v4 CLUTCH', { font: 'Teko', size: 190, weight: 700, italic: true, fill: lin(180, '#FFFFFF', '#FFC1C1', '#FF2E3A'), stroke: sk('#1A0004', 6), shadow: sh('#FF2E3A', 0, 10, 0, 0.8), letterSpacing: 2 }, an('hizli-iz', 'hizli-iz')),
  T('oyun-kafadan', 'Kafadan', 'oyun', 'HEADSHOT', { font: 'Black Ops One', size: 130, weight: 400, color: '#FFFFFF', stroke: sk('#E10600', 10), shadow: sh('#000', 12, 0, 8, 0.7) }, an('damga', 'ekrana-yaklas', 'titre')),
  T('oyun-rutbe', 'Rütbe', 'oyun', 'ELMAS III', { font: 'Exo 2', size: 130, weight: 900, italic: true, fill: F('krom'), stroke: sk('#10151C', 6), glow: gw('#9AD8FF', 22, 0.8), letterSpacing: 4 }, an('maske-ac', 'maske-kapa', 'parilti')),
  T('oyun-puan', 'Piksel puan', 'oyun', '+500 PUAN', { font: 'Pixelify Sans', size: 120, weight: 700, color: '#2EE6A6', stroke: sk('#00261A', 8, 'miter'), shadow: sh('#000', 0, 6, 6, 0.8) }, an('asagidan-cik', 'yukari-uc')),
  T('oyun-mvp', 'MVP', 'oyun', 'MVP', { font: 'Bowlby One SC', size: 190, weight: 400, fill: F('altin'), stroke: sk('#2A1600', 8), stroke2: sk('#FFF6C8', 5), extrude: ex('#5A3200', 16, 70) }, an('esnek', 'esnek', 'parilti')),
  T('oyun-tur', 'Tur sayacı', 'oyun', 'TUR 3', { font: 'Oxanium', size: 140, weight: 800, color: '#FFFFFF', stroke: sk('#000', 6), glow: gw('#B98CFF', 24, 1), letterSpacing: 8 }, an('ortadan-acil', 'ortaya-kapan')),
  T('oyun-dalga', 'Zombi dalgası', 'oyun', 'DALGA 40', { font: 'Nosifer', size: 100, weight: 400, color: '#9DFF00', stroke: sk('#0A1A00', 5), glow: gw('#4DFF00', 22, 1) }, an('dalga-yuksel', 'dus', 'dalga')),
  T('oyun-pixel-oyuncu', 'Oyuncu 1', 'oyun', 'OYUNCU 1 HAZIR', { font: 'Tiny5', size: 110, weight: 400, color: '#FFFFFF', bg: bx('#1F1B4D', 0.92, 0, 26, 12), stroke: NO, letterSpacing: 4 }, an('daktilo', 'daktilo-sil', 'imlec')),

  // ================================================================ BAŞLIK
  T('baslik-kalin', 'Kalın beyaz', 'baslik', 'EFSANE AN', { font: 'Archivo Black', size: 120, weight: 400, color: '#FFFFFF', stroke: sk('#000000', 10), shadow: sh('#000', 16, 0, 8, 0.55) }, an('buyuyerek', 'uzaklas')),
  T('baslik-dev', 'Dev başlık', 'baslik', 'BÜYÜK FİNAL', { font: 'Anton', size: 170, weight: 400, color: '#FFFFFF', shadow: sh('#000', 24, 0, 12, 0.6), letterSpacing: 2 }, an('kuculerek-otur', 'bulanik-son')),
  T('baslik-limon', 'Limon', 'baslik', 'BUNU İZLE', { font: 'Archivo', size: 130, weight: 900, color: '#E4FF3A', stroke: sk('#000000', 9) }, an('kelime-patla', 'kelime-kay')),
  T('baslik-cift-kontur', 'Çift kontur', 'baslik', 'SÜPER', { font: 'Bungee', size: 150, weight: 400, color: '#FFFFFF', stroke: sk('#111111', 8), stroke2: sk('#FF5DA2', 9) }, an('harf-patla', 'harf-kucul')),
  T('baslik-3d', 'Üç boyutlu', 'baslik', 'WOW', { font: 'Rammetto One', size: 170, weight: 400, color: '#FFE600', stroke: sk('#3A1400', 6), extrude: ex('#FF5A00', 22, 65, '#8A1200') }, an('esnek', 'esnek', 'suzul')),
  T('baslik-gunbatimi', 'Gün batımı', 'baslik', 'YAZ TATİLİ', { font: 'Montserrat', size: 130, weight: 900, fill: F('gunbatimi'), shadow: sh('#3A0A2A', 20, 0, 10, 0.6) }, an('dalga-yuksel', 'dalga-in')),
  T('baslik-krom', 'Krom', 'baslik', 'TURBO', { font: 'Russo One', size: 160, weight: 400, fill: F('krom'), stroke: sk('#1A1F26', 6), stroke2: sk('#6C7A89', 4), shadow: sh('#000', 18, 0, 10, 0.6) }, an('hizli-iz', 'hizli-iz', 'parilti')),
  T('baslik-altin', 'Altın', 'baslik', 'Şampiyon', { font: 'Abril Fatface', size: 150, weight: 400, fill: F('altin'), stroke: sk('#3B2200', 3), shadow: sh('#000', 16, 0, 8, 0.6), glow: gw('#FFC94A', 16, 0.5) }, an('maske-ac', 'maske-kapa')),
  T('baslik-kavisli', 'Kavisli', 'baslik', 'HARİKA GÜN', { font: 'Luckiest Guy', size: 120, weight: 400, color: '#FFFFFF', stroke: sk('#FF5DA2', 9), curve: 40, shadow: sh('#8A0040', 0, 0, 8, 0.8) }, an('harf-patla', 'harf-son', 'dalga')),
  T('baslik-ince-uzun', 'İnce uzun', 'baslik', 'YENİ SEZON', { font: 'Bebas Neue', size: 170, weight: 400, color: '#FFFFFF', letterSpacing: 8, shadow: sh('#000', 20, 0, 10, 0.5) }, an('yukaridan-in', 'yukari-uc')),
  T('baslik-genis', 'Modern geniş', 'baslik', 'HIZ', { font: 'Unbounded', size: 160, weight: 900, color: '#FFFFFF', stroke: sk('#000', 6), extrude: ex('#3FA9F5', 10, 45) }, an('sagdan-kay', 'sola-kay')),
  T('baslik-kirmizi-blok', 'Kırmızı blok', 'baslik', 'SON DAKİKA', { font: 'Barlow Condensed', size: 130, weight: 900, color: '#FFFFFF', bg: bx('#E10600', 1, 0, 30, 10), italic: true }, an('maske-ac', 'maske-kapa')),
  T('baslik-ice', 'Buz gibi', 'baslik', 'SOĞUKKANLI', { font: 'Kanit', size: 120, weight: 900, fill: F('buz'), stroke: sk('#002A5A', 6), glow: gw('#7FDBFF', 20, 0.8) }, an('bulanik-buyu', 'bulanik-son')),
  T('baslik-outfit', 'Temiz başlık', 'baslik', 'Nasıl yapılır?', { font: 'Outfit', size: 120, weight: 900, color: '#FFFFFF', shadow: sh('#000', 18, 0, 6, 0.5) }, an('kelime-kay', 'kelime-kay')),
  T('baslik-spartan', 'Sert başlık', 'baslik', 'DİKKAT ET', { font: 'League Spartan', size: 140, weight: 900, color: '#111111', stroke: sk('#FFFFFF', 8), stroke2: sk('#111111', 5) }, an('damga', 'uzaklas')),

  // ================================================================ SOSYAL
  T('sosyal-abone', 'Abone ol', 'sosyal', 'ABONE OL', { font: 'Archivo', size: 96, weight: 900, color: '#FFFFFF', bg: bx('#FF0033', 1, 14, 34, 16), shadow: sh('#000', 20, 0, 8, 0.4) }, an('buyuyerek', 'esnek', 'nabiz')),
  T('sosyal-begen', 'Beğenmeyi unutma', 'sosyal', 'BEĞENMEYİ UNUTMA', { font: 'Poppins', size: 84, weight: 800, color: '#FFFFFF', bg: bx('#1877F2', 1, 12, 30, 14) }, an('asagidan-cik', 'dalga-in', 'kalp-atisi')),
  T('sosyal-takip', 'Takip et', 'sosyal', 'TAKİP ET +', { font: 'Montserrat', size: 90, weight: 900, color: '#111111', bg: bx('#FFFFFF', 1, 60, 40, 16), shadow: sh('#000', 24, 0, 10, 0.35) }, an('buyuyerek', 'uzaklas', 'nabiz')),
  T('sosyal-yorum', 'Yorumlara yaz', 'sosyal', 'YORUMLARA YAZ 👇', { font: 'Nunito', size: 84, weight: 900, color: '#FFFFFF', bg: bx('#111111', 0.85, 18, 30, 14) }, an('kelime-kay', 'kelime-kay')),
  T('sosyal-bildirim', 'Bildirimi aç', 'sosyal', '🔔 BİLDİRİMLERİ AÇ', { font: 'Rubik', size: 80, weight: 900, color: '#111111', bg: bx('#FFE600', 1, 10, 28, 14) }, an('sarsilarak', 'sola-kay', 'sallan')),
  T('sosyal-kullanici', 'Kullanıcı adı', 'sosyal', '@sweaxstudios', { font: 'Space Grotesk', size: 76, weight: 700, color: '#FFFFFF', bg: bx('#000000', 0.55, 8, 24, 12) }, an('daktilo', 'daktilo-sil')),
  T('sosyal-canli', 'Canlı yayın', 'sosyal', '● CANLI', { font: 'Archivo', size: 80, weight: 800, color: '#FFFFFF', bg: bx('#E10600', 1, 4, 26, 12), letterSpacing: 4 }, an('maske-ac', 'maske-kapa', 'neon-titresim')),
  T('sosyal-paylas', 'Arkadaşına gönder', 'sosyal', 'ARKADAŞINA GÖNDER', { font: 'Paytone One', size: 84, weight: 400, color: '#FFFFFF', stroke: sk('#5B21B6', 8), shadow: sh('#2E0E6B', 0, 0, 8, 0.9) }, an('harf-patla', 'harf-kucul')),
  T('sosyal-son-video', 'Son video', 'sosyal', 'YENİ VİDEO', { font: 'Kanit', size: 120, weight: 900, italic: true, color: '#FFFFFF', stroke: sk('#000', 7), bar: bar('#FF0033', 12, 'bottom', 10) }, an('egik-gir', 'egik-cik')),
  T('sosyal-link', 'Link açıklamada', 'sosyal', 'LİNK AÇIKLAMADA', { font: 'Inter', size: 76, weight: 800, color: '#111111', bg: bx('#E4FF3A', 1, 2, 26, 12) }, an('yukaridan-in', 'yukari-uc')),
  T('sosyal-kaydet', 'Kaydet', 'sosyal', 'SONRA İZLEMEK İÇİN KAYDET', { font: 'Outfit', size: 70, weight: 700, color: '#FFFFFF', bg: bx('#B98CFF', 1, 12, 26, 12), maxWidth: 0.7 }, an('perde-yuksel', 'perdeye-in')),
  T('sosyal-anket', 'Sence?', 'sosyal', 'SENCE HANGİSİ?', { font: 'Outfit', size: 96, weight: 800, color: '#FFFFFF', stroke: sk('#111', 6), shadow: sh('#000', 0, 0, 6, 0.9) }, an('sarkac-gir', 'kelime-kay', 'sallan')),

  // ================================================================ KOMİK / MEME
  T('komik-meme-ust', 'Meme üst yazı', 'komik', 'BEN OYUNA GİRERKEN', { font: 'Anton', size: 110, weight: 400, uppercase: true, color: '#FFFFFF', stroke: sk('#000000', 7), letterSpacing: 1, maxWidth: 0.92 }, null, { transform: { y: -0.38 } }),
  T('komik-meme-alt', 'Meme alt yazı', 'komik', 'TAKIM ARKADAŞLARIM', { font: 'Anton', size: 110, weight: 400, uppercase: true, color: '#FFFFFF', stroke: sk('#000000', 7), letterSpacing: 1, maxWidth: 0.92 }, null, { transform: { y: 0.38 } }),
  T('komik-pow', 'POW!', 'komik', 'POW!', { font: 'Bangers', size: 200, weight: 400, color: '#FFE600', stroke: sk('#E10600', 9), stroke2: sk('#000000', 9), extrude: ex('#000000', 14, 55), curve: 18 }, an('damga', 'esnek', 'titre')),
  T('komik-bam', 'BAM!', 'komik', 'BAM!', { font: 'Luckiest Guy', size: 190, weight: 400, fill: F('ates'), stroke: sk('#000000', 12), extrude: ex('#5A0000', 12, 60) }, an('damga', 'patla', 'sarsinti')),
  T('komik-balon', 'Çizgi roman balonu', 'komik', 'NE OLUYOR?!', { font: 'Bangers', size: 110, weight: 400, color: '#111111', bg: bx('#FFFFFF', 1, 36, 36, 18), shadow: sh('#000', 0, 8, 8, 0.85), letterSpacing: 2 }, an('buyuyerek', 'uzaklas', 'sallan')),
  T('komik-sok', 'Şok', 'komik', 'ŞOK!!', { font: 'Rubik Wet Paint', size: 170, weight: 400, color: '#9DFF00', stroke: sk('#0A2A00', 6), glow: gw('#5CFF00', 20, 0.8) }, an('ziplayarak-dus', 'dus', 'titre')),
  T('komik-aglama', 'Ağlayan', 'komik', 'neden ben 😭', { font: 'Gluten', size: 110, weight: 800, color: '#BDE7FF', stroke: sk('#0A4A8A', 7) }, an('harf-belir', 'dalga-in', 'yuzen-harfler')),
  T('komik-bruh', 'Bruh', 'komik', 'BRUH', { font: 'Grandstander', size: 180, weight: 900, color: '#FFFFFF', stroke: sk('#000000', 10), curve: -22 }, an('esnek', 'uzaklas', 'lastik')),
  T('komik-kahkaha', 'Kahkaha', 'komik', 'HAHAHAHA', { font: 'Coiny', size: 140, weight: 400, color: '#FFE600', stroke: sk('#5A3200', 8) }, an('harf-patla', 'harf-kucul', 'zipla')),
  T('komik-vay', 'Vay be', 'komik', 'VAY BE!', { font: 'Modak', size: 190, weight: 400, color: '#FF5DA2', stroke: sk('#3A0020', 8), extrude: ex('#3A0020', 10, 70) }, an('yay', 'esnek', 'lastik')),
  T('komik-boom', 'BOOM', 'komik', 'BOOM!', { font: 'Bangers', size: 210, weight: 400, italic: true, fill: F('ates'), stroke: sk('#2A0000', 8), stroke2: sk('#FFE600', 6), glow: gw('#FF5A00', 30, 1) }, an('uzaktan-yaklas', 'ekrana-yaklas', 'sarsinti')),
  T('komik-zzz', 'Uykulu', 'komik', 'zzz...', { font: 'Caveat Brush', size: 150, weight: 400, color: '#E6E1FF', stroke: sk('#3B2A7A', 6) }, an('harf-belir', 'buhar', 'suzul')),
  T('komik-kirmizi-ok', 'Kırmızı daire notu', 'komik', 'BURAYA BAK', { font: 'Kalam', size: 110, weight: 700, color: '#FF2E2E', stroke: sk('#FFFFFF', 6), curve: -18 }, an('maske-ac', 'maske-kapa', 'nabiz')),

  // ================================================================ NEON
  T('neon-pembe', 'Pembe neon', 'neon', 'GECE MODU', { font: 'Tilt Neon', size: 140, weight: 400, color: '#FFE3F2', stroke: sk('#FF2D95', 2), glow: gw('#FF2D95', 34, 1.6) }, an('neon-yan', 'neon-son', 'neon-titresim')),
  T('neon-mavi', 'Mavi neon', 'neon', 'Açık', { font: 'Tilt Neon', size: 160, weight: 400, color: '#E0F8FF', stroke: sk('#00B7FF', 2), glow: gw('#00B7FF', 34, 1.6) }, an('neon-yan', 'neon-son')),
  T('neon-yesil', 'Zehir yeşili', 'neon', 'TOKSİK', { font: 'Audiowide', size: 140, weight: 400, color: '#ECFFD6', glow: gw('#39FF14', 30, 1.6), letterSpacing: 6 }, an('glitch', 'glitch', 'glitch')),
  T('neon-mor', 'Mor tabela', 'neon', 'Oyun gecesi', { font: 'Righteous', size: 130, weight: 400, color: '#F3E6FF', stroke: sk('#9D4DFF', 2), glow: gw('#9D4DFF', 32, 1.5) }, an('harf-belir', 'harf-son', 'neon-titresim')),
  T('neon-kirmizi', 'Kırmızı tabela', 'neon', 'AÇIĞIZ', { font: 'Monoton', size: 140, weight: 400, color: '#FFD9D9', glow: gw('#FF2A2A', 30, 1.6) }, an('neon-yan', 'neon-son', 'neon-titresim')),
  T('neon-sari', 'Sarı tabela', 'neon', 'BAR', { font: 'Bungee Outline', size: 190, weight: 400, color: '#FFF6B0', glow: gw('#FFD500', 28, 1.6) }, an('neon-yan', 'neon-son', 'neon-titresim')),
  T('neon-cift', 'İki renk neon', 'neon', 'SİBER', { font: 'Righteous', size: 160, weight: 400, fill: { ...lin(90, '#FF71CE', '#01CDFE'), scope: 'block' }, glow: gw('#9D4DFF', 30, 1.4) }, an('karistir', 'karisarak')),
  T('neon-siber', 'Siber şehir', 'neon', 'NEO İSTANBUL', { font: 'Oxanium', size: 110, weight: 800, color: '#00FFF0', glow: gw('#00FFF0', 22, 1.2), letterSpacing: 8, stroke: sk('#002A2A', 3) }, an('glitch', 'glitch', 'glitch')),
  T('neon-synth', 'Synthwave tabela', 'neon', 'RETRO GECE', { font: 'Monoton', size: 120, weight: 400, fill: F('synth'), glow: gw('#FF2D95', 26, 1.2) }, an('maske-ac', 'maske-kapa', 'parilti')),
  T('neon-beyaz', 'Beyaz floresan', 'neon', 'stüdyo', { font: 'Tilt Neon', size: 170, weight: 400, color: '#FFFFFF', glow: gw('#C8E6FF', 26, 1.4) }, an('neon-yan', 'neon-son', 'bulanik-nefes')),

  // ================================================================ SİNEMATİK
  T('sinema-genis', 'Geniş aralık', 'sinema', 'BİR SWEAX FİLMİ', { font: 'Raleway', size: 64, weight: 300, color: '#FFFFFF', letterSpacing: 26, uppercase: true, shadow: sh('#000', 18, 0, 4, 0.5) }, an(['harf-belir', 1.6], ['harf-son', 1.0])),
  T('sinema-destan', 'Destan', 'sinema', 'YÜZÜKLERİN EFENDİSİ', { font: 'Cinzel', size: 90, weight: 400, color: '#EBDDB0', letterSpacing: 14, glow: gw('#C99A3A', 20, 0.6) }, an(['bulanik-buyu', 1.4], ['bulanik-son', 1.0])),
  T('sinema-fragman', 'Fragman', 'sinema', 'YAKINDA', { font: 'Bebas Neue', size: 190, weight: 400, color: '#FFFFFF', letterSpacing: 22, shadow: sh('#000', 30, 0, 0, 0.6) }, an(['kuculerek-otur', 1.2], ['bulanik-son', 0.8])),
  T('sinema-belgesel', 'Belgesel', 'sinema', 'BÖLÜM 1 · BAŞLANGIÇ', { font: 'Josefin Sans', size: 64, weight: 300, color: '#FFFFFF', letterSpacing: 10 }, an(['maske-ac', 1.2], 'harf-son')),
  T('sinema-klasik', 'Klasik film', 'sinema', 'Bir zamanlar...', { font: 'Cormorant Garamond', size: 110, weight: 400, italic: true, color: '#F5ECD7', letterSpacing: 3, shadow: sh('#000', 16, 0, 4, 0.5) }, an(['harf-belir', 1.6], 'harf-son')),
  T('sinema-gerilim', 'Gerilim', 'sinema', 'KAÇIŞ YOK', { font: 'Teko', size: 140, weight: 400, color: '#D9D9D9', letterSpacing: 24 }, an(['neon-yan', 1.4], 'neon-son', 'neon-titresim')),
  T('sinema-noir', 'Kara film', 'sinema', 'Gece Yarısı', { font: 'Playfair Display', size: 130, weight: 900, italic: true, color: '#FFFFFF', shadow: sh('#000000', 0, 12, 12, 0.85) }, an('perde-yuksel', 'perdeye-in')),
  T('sinema-uzay', 'Uzay', 'sinema', 'YÖRÜNGE', { font: 'Unbounded', size: 80, weight: 400, fill: lin(180, '#FFFFFF', '#B9C6D6'), letterSpacing: 28 }, an(['ortadan-acil', 1.4], 'ortaya-kapan')),
  T('sinema-jenerik', 'Jenerik', 'sinema', 'YÖNETMEN\nSWEAX STUDIOS', { font: 'Oswald', size: 60, weight: 400, color: '#E8E8E8', letterSpacing: 12, lineHeight: 1.6 }, an(['yukaridan-in', 1.0], 'yukari-uc')),
  T('sinema-cizgili', 'Çizgili başlık', 'sinema', 'SON SAVAŞ', { font: 'Fjalla One', size: 120, weight: 400, color: '#FFFFFF', letterSpacing: 16, bar: bar('#FFFFFF', 3, 'bottom', 20) }, an(['maske-ac', 1.0], 'maske-kapa')),
  T('sinema-bodoni', 'Dergi kapağı', 'sinema', 'Vogue gibi', { font: 'Bodoni Moda', size: 140, weight: 400, italic: true, color: '#FFFFFF', letterSpacing: 2 }, an('bulanik-buyu', 'bulanik-son')),

  // ================================================================ RETRO
  T('retro-80ler', '80\'ler', 'retro', 'RETRO GECE', { font: 'Audiowide', size: 130, weight: 400, fill: F('krom'), stroke: sk('#FF2D95', 4), extrude: ex('#5B21B6', 12, 75), glow: gw('#FF2D95', 18, 0.6) }, an('hizli-iz', 'hizli-iz', 'parilti')),
  T('retro-atari', 'Atari salonu', 'retro', 'JETON AT', { font: 'Press Start 2P', size: 90, weight: 400, fill: lin(180, '#FFE600', '#FF7A00', '#FF2E3A'), stroke: sk('#1A0033', 8, 'miter'), extrude: ex('#1A0033', 10, 90) }, an('harf-patla', 'harf-kucul', 'yan-son')),
  T('retro-vhs', 'VHS', 'retro', 'OYNAT ▶', { font: 'VT323', size: 150, weight: 400, color: '#FFFFFF', shadow: sh('#FF0040', 0, -5, 0, 0.9), glow: gw('#00E5FF', 10, 0.6), letterSpacing: 4 }, an('glitch', 'glitch', 'glitch')),
  T('retro-70ler', '70\'ler', 'retro', 'harika!', { font: 'Shrikhand', size: 150, weight: 400, color: '#FF8A1F', stroke: sk('#5A2600', 5), stroke2: sk('#FFF1D6', 7), extrude: ex('#5A2600', 12, 70), curve: 30 }, an('esnek', 'esnek', 'suzul')),
  T('retro-lokanta', 'Lokanta tabelası', 'retro', 'Açık', { font: 'Lobster', size: 170, weight: 400, color: '#E10600', stroke: sk('#FFFFFF', 6), stroke2: sk('#E10600', 4), shadow: sh('#000', 10, 0, 8, 0.5) }, an('maske-ac', 'maske-kapa')),
  T('retro-yukleniyor', 'Yükleniyor', 'retro', 'YÜKLENİYOR...', { font: 'Tiny5', size: 110, weight: 400, color: '#39FF14', bg: bx('#000000', 0.9, 0, 24, 12), glow: gw('#39FF14', 12, 0.6) }, an('daktilo', 'daktilo-sil', 'imlec')),
  T('retro-synth', 'Gece sürüşü', 'retro', 'GECE SÜRÜŞÜ', { font: 'Exo 2', size: 130, weight: 900, italic: true, fill: F('synth'), stroke: sk('#14002A', 4), glow: gw('#FF2D95', 16, 0.8) }, an('sagdan-kay', 'sola-kay')),
  T('retro-aranan', 'Aranıyor', 'retro', 'ARANIYOR', { font: 'Alfa Slab One', size: 140, weight: 400, color: '#5A2E0A', stroke: sk('#F4E1BC', 6), stroke2: sk('#5A2E0A', 4), letterSpacing: 6 }, an('damga', 'uzaklas')),
  T('retro-disko', 'Disko', 'retro', 'DİSKO', { font: 'Bungee Shade', size: 170, weight: 400, fill: F('altin') }, an('kelime-patla', 'esnek', 'disko')),
  T('retro-gazete', 'Gazete manşeti', 'retro', 'SON DAKİKA!', { font: 'Playfair Display', size: 110, weight: 900, color: '#111111', bg: bx('#F2EAD8', 1, 0, 34, 18) }, an('sarsilarak', 'uzaklas')),
  T('retro-bowling', 'Bowling', 'retro', 'STRIKE!', { font: 'Bungee Inline', size: 160, weight: 400, color: '#FFFFFF', fill: F('seker2'), stroke: sk('#002A5A', 6) }, an('ziplayarak-dus', 'dus')),

  // ================================================================ ZARİF
  T('zarif-imza', 'İmza', 'zarif', 'Teşekkürler', { font: 'Great Vibes', size: 170, weight: 400, color: '#FFFFFF', shadow: sh('#000', 14, 0, 4, 0.5) }, an(['maske-ac', 1.4], 'maske-kapa')),
  T('zarif-altin-yazi', 'Altın el yazısı', 'zarif', 'Mutlu yıllar', { font: 'Sacramento', size: 190, weight: 400, fill: F('altin'), glow: gw('#FFC94A', 14, 0.6) }, an(['maske-ac', 1.6], 'harf-son', 'parilti')),
  T('zarif-davetiye', 'Davetiye', 'zarif', 'Sizi de bekleriz', { font: 'Playfair Display', size: 100, weight: 400, italic: true, color: '#F5E6C8', letterSpacing: 2 }, an(['harf-belir', 1.4], 'harf-son')),
  T('zarif-minimal', 'Minimal', 'zarif', 'günlük', { font: 'Manrope', size: 90, weight: 400, color: '#FFFFFF', letterSpacing: 10 }, an('bulanik-buyu', 'bulanik-son')),
  T('zarif-ince-serif', 'İnce serif', 'zarif', 'Sessiz sabah', { font: 'Bodoni Moda', size: 120, weight: 400, italic: true, color: '#FFFFFF' }, an('perde-yuksel', 'perdeye-in')),
  T('zarif-pastel', 'Pastel', 'zarif', 'tatlı anlar', { font: 'Josefin Sans', size: 110, weight: 300, color: '#FFC9DE', shadow: sh('#7A3550', 16, 0, 4, 0.4), letterSpacing: 6 }, an('harf-belir', 'harf-son', 'suzul')),
  T('zarif-dergi', 'Dergi', 'zarif', 'Haftanın en iyileri', { font: 'DM Serif Display', size: 120, weight: 400, italic: true, color: '#FFFFFF' }, an('kelime-kay', 'kelime-kay')),
  T('zarif-botanik', 'Botanik', 'zarif', 'Doğa yürüyüşü', { font: 'Cormorant Garamond', size: 100, weight: 600, color: '#3E5A3A', bg: bx('#F2EFE6', 0.95, 2, 30, 14) }, an('maske-ac', 'maske-kapa')),
  T('zarif-not', 'Not', 'zarif', 'sevgilerle...', { font: 'Marck Script', size: 140, weight: 400, color: '#FFFFFF' }, an(['daktilo', 1.4], 'harf-son')),
  T('zarif-dans', 'Dans', 'zarif', 'Dans et', { font: 'Dancing Script', size: 160, weight: 700, color: '#FFFFFF', glow: gw('#FF8FC7', 22, 0.8) }, an('maske-ac', 'maske-kapa', 'suzul')),
  T('zarif-kaligrafi', 'Kaligrafi', 'zarif', 'Huzur', { font: 'Kaushan Script', size: 170, weight: 400, color: '#FFFFFF', shadow: sh('#000', 20, 0, 6, 0.5) }, an('bulanik-buyu', 'bulanik-son')),
  T('zarif-merriweather', 'Alıntı', 'zarif', '"Asla vazgeçme."', { font: 'Merriweather', size: 84, weight: 400, italic: true, color: '#FFFFFF', bar: bar('#E4FF3A', 6, 'left', 24), align: 'left' }, an('perde-yuksel', 'perdeye-in')),

  // ================================================================ ETİKET / ALT BANT
  T('etiket-klasik', 'Klasik alt bant', 'etiket', 'Ahmet Yılmaz\nOyun yayıncısı', { font: 'Archivo', size: 56, weight: 700, color: '#FFFFFF', bg: bx('#0E0E0E', 0.82, 0, 30, 16), bar: bar('#E4FF3A', 10, 'left'), align: 'left', lineHeight: 1.3 }, an('maske-ac', 'maske-kapa'), { transform: { y: 0.3 } }),
  T('etiket-sari', 'Sarı bant', 'etiket', 'SWEAX · KAPTAN', { font: 'Archivo', size: 60, weight: 800, color: '#111111', bg: bx('#E4FF3A', 1, 2, 26, 12), letterSpacing: 2 }, an('maske-ac', 'maske-kapa'), { transform: { y: 0.3 } }),
  T('etiket-cizgi', 'Çizgili isim', 'etiket', 'Mert Kaya', { font: 'Montserrat', size: 72, weight: 700, color: '#FFFFFF', bar: bar('#FF5DA2', 6, 'bottom', 12), shadow: sh('#000', 14, 0, 4, 0.5) }, an('perde-yuksel', 'perdeye-in'), { transform: { y: 0.3 } }),
  T('etiket-haber', 'Haber bandı', 'etiket', 'SON DAKİKA · TURNUVA BAŞLADI', { font: 'Barlow Condensed', size: 60, weight: 700, color: '#FFFFFF', bg: bx('#C4001A', 1, 0, 28, 10), uppercase: true, letterSpacing: 2, maxWidth: 0.95 }, an('soldan-kay', 'sola-kay'), { transform: { y: 0.36 } }),
  T('etiket-oyuncu', 'Oyuncu kartı', 'etiket', 'SWEAX · TAKIM KAPTANI', { font: 'Chakra Petch', size: 58, weight: 700, color: '#FFFFFF', bg: bx('#0B1A33', 0.92, 0, 28, 14), bar: bar('#00E5FF', 8, 'left'), letterSpacing: 3 }, an('maske-ac', 'maske-kapa'), { transform: { y: 0.3 } }),
  T('etiket-konum', 'Konum', 'etiket', '📍 İstanbul, Kadıköy', { font: 'Inter', size: 56, weight: 600, color: '#FFFFFF', bg: bx('#000000', 0.6, 40, 28, 14) }, an('asagidan-cik', 'dalga-in'), { transform: { y: 0.34 } }),
  T('etiket-yumusak', 'Yumuşak etiket', 'etiket', 'Bölüm 3: Kale', { font: 'Poppins', size: 60, weight: 600, color: '#1A1A1A', bg: bx('#FFFFFF', 1, 16, 28, 14), shadow: sh('#000', 24, 0, 8, 0.3) }, an('buyuyerek', 'uzaklas'), { transform: { y: 0.3 } }),
  T('etiket-satir', 'Satır bandı', 'etiket', 'Bugün yeni bir\nharitayı deniyoruz', { font: 'Work Sans', size: 64, weight: 700, color: '#FFFFFF', bg: bx('#5B21B6', 0.95, 4, 18, 8, 'line'), lineHeight: 1.35 }, an('perde-yuksel', 'perdeye-in'), { transform: { y: 0.28 } }),
  T('etiket-skor', 'Skor tabelası', 'etiket', 'KIRMIZI 3 — 2 MAVİ', { font: 'Oxanium', size: 64, weight: 800, color: '#FFFFFF', bg: bx('#0E0E0E', 0.9, 0, 28, 12), bar: bar('#FF2E3A', 8, 'top', 0), letterSpacing: 3 }, an('maske-ac', 'maske-kapa'), { transform: { y: -0.38 } }),
  T('etiket-saat', 'Zaman damgası', 'etiket', '00:42:17', { font: 'JetBrains Mono', size: 64, weight: 700, color: '#E4FF3A', bg: bx('#000000', 0.85, 0, 22, 10), letterSpacing: 2 }, an('daktilo', 'daktilo-sil'), { transform: { y: -0.4 } }),
  T('etiket-kanal', 'Kanal adı', 'etiket', 'SWEAX STUDIOS', { font: 'League Spartan', size: 58, weight: 800, color: '#FFFFFF', letterSpacing: 6, bar: bar('#3FA9F5', 4, 'left', 18), align: 'left' }, an('karistir', 'karisarak'), { transform: { y: 0.32 } }),
  T('etiket-cerceve', 'Çerçeveli', 'etiket', 'KONUK: ZEYNEP', { font: 'Space Grotesk', size: 60, weight: 700, color: '#FFFFFF', bg: bx('#FFFFFF', 1, 0, 26, 12, 'block', { outline: 3 }), letterSpacing: 3 }, an('ortadan-acil', 'ortaya-kapan'), { transform: { y: 0.3 } }),

  // ================================================================ VURGU
  T('vurgu-fosforlu', 'Fosforlu kalem', 'vurgu', 'ÖNEMLİ KISIM', { font: 'Archivo', size: 100, weight: 800, color: '#111111', bg: bx('#E4FF3A', 1, 6, 18, 0, 'marker') }, an('maske-ac', 'maske-kapa')),
  T('vurgu-pembe-marker', 'Pembe marker', 'vurgu', 'kesinlikle dene', { font: 'Caveat', size: 130, weight: 700, color: '#FFFFFF', bg: bx('#FF5DA2', 0.9, 8, 20, 0, 'marker') }, an('maske-ac', 'maske-kapa')),
  T('vurgu-kutu', 'Siyah kutu', 'vurgu', 'DİKKAT', { font: 'Archivo Black', size: 120, weight: 400, color: '#FFFFFF', bg: bx('#000000', 1, 0, 30, 12), letterSpacing: 4 }, an('damga', 'uzaklas')),
  T('vurgu-kirmizi', 'Kırmızı kutu', 'vurgu', 'YENİ!', { font: 'Archivo', size: 120, weight: 900, color: '#FFFFFF', bg: bx('#E10600', 1, 4, 28, 10), italic: true }, an('esnek', 'esnek', 'nabiz')),
  T('vurgu-alti-cizili', 'Altı çizili', 'vurgu', 'BUNU BİL', { font: 'Montserrat', size: 120, weight: 900, color: '#FFE600', underline: true, stroke: sk('#000', 6) }, an('maske-ac', 'maske-kapa')),
  T('vurgu-bak', 'Bak buraya', 'vurgu', 'bak buraya ↓', { font: 'Kalam', size: 120, weight: 700, color: '#FF2E2E', curve: -15, stroke: sk('#FFFFFF', 5) }, an('harf-belir', 'harf-son', 'zipla')),
  T('vurgu-damga', 'Damga', 'vurgu', 'ONAYLANDI', { font: 'Black Ops One', size: 120, weight: 400, color: '#E10600', opacityFill: 0, stroke: sk('#E10600', 4), bg: bx('#E10600', 1, 6, 26, 12, 'block', { outline: 5 }), letterSpacing: 4 }, an('damga', 'uzaklas')),
  T('vurgu-iki-ton', 'İki ton', 'vurgu', 'İKİ TON', { font: 'Anton', size: 170, weight: 400, fill: F('ikiton'), stroke: sk('#111', 5) }, an('perde-yuksel', 'perdeye-in')),
  T('vurgu-yesil', 'Yeşil kutu', 'vurgu', 'DOĞRU CEVAP', { font: 'Poppins', size: 100, weight: 800, color: '#06281D', bg: bx('#2EE6A6', 1, 8, 26, 12) }, an('buyuyerek', 'uzaklas')),
  T('vurgu-parlak', 'Parlak', 'vurgu', 'YILDIZ', { font: 'Paytone One', size: 160, weight: 400, color: '#FFFFFF', glow: gw('#FFE600', 26, 1.2), stroke: sk('#C79A00', 4) }, an('buyuyerek', 'bulanik-son', 'parilti')),
  T('vurgu-serit', 'Uyarı şeridi', 'vurgu', 'TEHLİKE', { font: 'Bowlby One SC', size: 140, weight: 400, fill: F('serit'), stroke: sk('#111111', 8) }, an('sarsilarak', 'uzaklas', 'sarsinti')),
  T('vurgu-mavi-cerceve', 'Mavi çerçeve', 'vurgu', 'İPUCU', { font: 'Rowdies', size: 110, weight: 700, color: '#3FA9F5', bg: bx('#3FA9F5', 1, 10, 26, 12, 'block', { outline: 4 }) }, an('ortadan-acil', 'ortaya-kapan')),
]
