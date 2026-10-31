// İçerik kayıt defteri — efektler, geçişler, filtreler, animasyonlar, yazı şablonları, çıkartmalar, sesler…
// Paketler (src/packs/*) kendi öğelerini buraya kaydeder; arayüz kütüphaneleri ve motor buradan okur.
// Paket yazarı için sözleşme aşağıda — ALAN ADLARINI DEĞİŞTİRME.

const make = () => ({ list: [], byId: new Map(), categories: [] })

export const REG = {
  effects: make(),        // video efektleri (klip üstü ya da efekt katmanı)
  transitions: make(),    // klip geçişleri
  filters: make(),        // renk filtreleri (hazır renk ayarları)
  clipAnims: make(),      // klip giriş/çıkış/döngü animasyonları
  textAnims: make(),      // yazı giriş/çıkış/döngü animasyonları
  textTemplates: make(),  // hazır yazı stilleri (+animasyon)
  captionStyles: make(),  // altyazı şablonları (kelime vurgulama)
  stickers: make(),       // çıkartmalar (emoji, vektör animasyonlu, şekil)
  sfx: make(),            // ses efektleri (prosedürel sentez)
  music: make(),          // müzik döngüleri (prosedürel)
  speedCurves: make(),    // hız eğrisi hazırları
  voiceFx: make(),        // ses değiştirici
  masks: make(),          // maske şekilleri
  blendModes: make(),     // karışım modları
  fonts: make(),          // yazı tipleri
  layouts: make(),        // tek tık düzenler (facecam + oyun vb.)
}

// Kayıt: kind = REG anahtarı, items = dizi. Aynı id ikinci kez gelirse üzerine yazar.
export function register(kind, items, categories) {
  const r = REG[kind]
  if (!r) throw new Error('bilinmeyen kayıt türü: ' + kind)
  for (const it of [].concat(items)) {
    if (!it || !it.id) continue
    if (r.byId.has(it.id)) r.list = r.list.filter(x => x.id !== it.id)
    r.list.push(it)
    r.byId.set(it.id, it)
  }
  if (categories) for (const c of [].concat(categories)) if (!r.categories.find(x => x.id === c.id)) r.categories.push(c)
  bump()
}

export function unregister(kind, id) {
  const r = REG[kind]
  if (!r || !r.byId.has(id)) return
  r.byId.delete(id)
  r.list = r.list.filter(x => x.id !== id)
  bump()
}

export function get(kind, id) {
  return REG[kind] && REG[kind].byId.get(id)
}

export function list(kind, category) {
  const r = REG[kind]
  if (!r) return []
  return category ? r.list.filter(x => x.category === category) : r.list
}

let ver = 0
const subs = new Set()
function bump() { ver++; for (const s of subs) s() }
export function registryVersion() { return ver }
export function onRegistry(fn) { subs.add(fn); return () => subs.delete(fn) }

/* ===================================================================================
   PAKET SÖZLEŞMELERİ
   ===================================================================================

   Ortak alanlar (hepsinde): { id: 'kebab-case benzersiz', name: 'Türkçe ad', category: 'kategori-id',
                               tags?: ['arama', 'kelimeleri'], isNew?: bool }
   Kategori: { id, name }  — register(kind, items, categories) ile verilir.

   ---------------------------------------------------------------- effects
   {
     id, name, category,
     params: [ { key, label, type:'range'|'color'|'bool'|'select', min, max, step, default, options? } ],
     // Tek geçiş: GLSL ES 3.00 parça kodu. Aşağıdakiler HAZIR tanımlıdır:
     //   uniform sampler2D uTex;   // giriş (premultiplied değil, düz RGBA)
     //   uniform vec2  uRes;       // giriş dokusu piksel boyutu
     //   uniform float uTime;      // klip başından saniye
     //   uniform float uProgress;  // klip içi 0..1
     //   uniform float uIntensity; // genel yoğunluk 0..1 (varsayılan 1)
     //   uniform float uSeed;      // klibe özel rastgele tohum
     //   in vec2 vUv;              // 0..1 (sol-alt orijin)
     //   yardımcılar: float rand(vec2), float noise(vec2), float fbm(vec2), vec3 rgb2hsv(vec3), vec3 hsv2rgb(vec3),
     //                float luma(vec3), vec4 tex(vec2 uv) (kenar sıkıştırmalı örnekleme)
     //   her param için: 'range'/'bool' → uniform float u_<key>; 'color' → uniform vec3 u_<key>
     // Kod `vec4 effect(vec2 uv)` fonksiyonunu tanımlamalı.
     glsl: `vec4 effect(vec2 uv){ ... }`,
     // Çok geçişli efektler için glsl yerine passes: [ { glsl, scale?: 0.5 } ] — her geçiş bir öncekinin
     // çıktısını uTex olarak alır; ilk geçişten önceki orijinal görüntü uOrig olarak da erişilebilir.
     passes?: [...],
     // Kütüphane önizlemesi için önerilen süre (sn) — animasyonlu efektlerde
     previewDuration?: 2,
   }

   ---------------------------------------------------------------- transitions
   gl-transitions biçimi:
   { id, name, category, duration: 0.6 (varsayılan sn),
     glsl: `vec4 transition(vec2 uv){ return mix(getFromColor(uv), getToColor(uv), progress); }`,
     params: [ { key, label, type, default, min, max } ]   // uniform adı = key (gl-transitions'taki gibi düz ad)
     // HAZIR: uniform float progress, ratio; vec4 getFromColor(vec2), getToColor(vec2);
     //        param tipleri: float, vec2, vec3, vec4, int, bool, ivec2 (type alanında 'float'|'vec2'|...|'color')
   }

   ---------------------------------------------------------------- filters
   Renk filtresi = renk ayarları seti + isteğe bağlı ek GLSL:
   { id, name, category,
     adjust: { brightness, contrast, saturation, exposure, temperature, tint, highlights, shadows, vibrance, hue, fade, vignette, grain }  // -100..100
     tone?: { shadows:'#rrggbb', highlights:'#rrggbb', balance: 0 }   // ayrık tonlama (split toning)
     curve?: { r:[[x,y]...], g:[...], b:[...], rgb:[...] }           // 0..1 eğri noktaları
     mono?: bool,
     glsl?: `vec3 grade(vec3 c, vec2 uv){ ... }`                     // ek renk fonksiyonu (isteğe bağlı)
     swatch?: ['#..','#..']                                          // kütüphanede gösterilecek renkler
   }
   Filtre yoğunluğu (0..1) bütün etkiyi orijinal ile karıştırır.

   ---------------------------------------------------------------- clipAnims
   { id, name, category: 'in'|'out'|'loop', duration: 0.5 (varsayılan sn),
     // p: 0..1 animasyon ilerlemesi (in: 0→1 giriş biter; out: 0→1 çıkış biter; loop: döngü fazı, sürekli artar)
     // dönen nesne katmanın temel durumuna EKLENİR/ÇARPILIR:
     //   { x, y (tuval oranı ofset), scale (çarpan), scaleX, scaleY, rotation (derece ek), opacity (çarpan),
     //     blur (0..1), brightness (-1..1 ek), rgbSplit (0..1), skewX, skewY (derece), cropReveal? {l,t,r,b} }
     fn: (p, ctx) => ({ ... }),   // ctx: { w, h (tuval px), clipW, clipH, seed }
   }

   ---------------------------------------------------------------- textAnims
   { id, name, category: 'in'|'out'|'loop', duration: 0.6,
     unit: 'whole'|'char'|'word'|'line',     // harf harf / kelime kelime / bütün
     stagger?: 0.06,                          // birimler arası gecikme oranı (0..1, toplam süreye göre)
     // birim başına: p = 0..1 (bu birimin kendi ilerlemesi), i = birim indeksi, n = birim sayısı
     // dönüş: { x, y (px, yazı boyutuna göre), scale, scaleX, scaleY, rotation (derece), opacity, blur (px),
     //          color?: '#hex' (geçici renk), skewX?, clip?: 0..1 (soldan görünürlük maskesi) }
     fn: (p, i, n, ctx) => ({ ... }),  // ctx: { fontSize, lineH, seed }
     // daktilo gibi: whole için visibleChars döndürülebilir: { visibleChars: 0..1 }
   }

   ---------------------------------------------------------------- textTemplates
   { id, name, category, text: { ...defaultTextStyle alanları (kısmi) }, anim?: { in:{id,duration}, out:{...}, loop:{...} },
     effects?: [...], sampleText?: 'GG!' }

   ---------------------------------------------------------------- captionStyles
   { id, name, category,
     text: { ...yazı stili (kısmi) },
     words: 2..6 (ifade başına kelime),
     uppercase?: bool,
     // aktif kelime vurgusu:
     active: { color?, bg?: { color, radius, padX, padY }, scale?: 1.15, stroke?: {...}, glow?: {...}, y?: -6 },
     past?: { color?, opacity? },  future?: { color?, opacity? },
     wordIn?: 'pop'|'fade'|'slide'|'none'|textAnim-id,  // kelime ilk göründüğünde
     emoji?: bool  // anahtar kelimelere emoji ekle
   }

   ---------------------------------------------------------------- stickers
   { id, name, category, kind: 'emoji'|'vector'|'shape',
     // emoji: src (svg/png yolu veya data url), anim?: 'bounce'|'pulse'|'spin'|...
     // vector: draw(ctx2d, t, w, h, params) — t saniye; kendi animasyonunu çizer (w×h kutuya sığdır)
     src?, draw?, aspect?: 1 (genişlik/yükseklik), loop?: 2 (döngü süresi sn),
     params?: [ { key, label, type:'color'|'range'|'text', default } ]
   }

   ---------------------------------------------------------------- sfx / music
   { id, name, category, duration: sn,
     // OfflineAudioContext içinde sesi sentezle; ctx.destination'a bağla. render() motor tarafından çağrılır.
     synth: (ctx, t0) => void,      // t0 = başlangıç zamanı (genelde 0)
     sampleRate?: 48000, channels?: 2 }

   ---------------------------------------------------------------- speedCurves
   { id, name, points: [{x,y}] }   // x 0..1, y hız çarpanı

   ---------------------------------------------------------------- voiceFx
   { id, name, category,
     // ffmpeg -af zinciri (işlenmiş ses önbelleğe yazılır) — WYSIWYG için önizleme de bu dosyayı çalar
     ffmpeg: (params) => 'asetrate=48000*1.3,aresample=48000,atempo=0.77',
     params?: [...] }

   ---------------------------------------------------------------- fonts
   { id: 'Anton' (CSS font-family adı), name, category: 'display'|'sans'|'serif'|'hand'|'mono'|'gaming'|'fun',
     files: [{ weight, style, url }]   // url: dist'e göre göreli (./fonts/...)
   }

   ---------------------------------------------------------------- layouts
   { id, name, category, apply: (draftProject, ctx) => void }  // tek tık düzen (facecam üstte, oyun altta…)
*/
