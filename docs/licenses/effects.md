# Efekt ve filtre paketleri — lisans notları

Kapsam: `src/packs/effects/` (161 video efekti) ve `src/packs/filters/` (93 renk filtresi), test sayfaları `dev/effects*`, `dev/filters*`.

## Üçüncü parti varlık
Yok. Hiçbir görüntü, doku, yazı tipi, ses veya npm paketi kullanılmadı / kurulmadı.
Bütün parçacıklar (kar, konfeti, kalp, yıldız, yağmur, kıvılcım…), dokular (gren, toz, kâğıt, sis) ve desenler
gölgelendirici içinde prosedürel olarak üretilir.

## Kod
Bütün GLSL ve JS kodu SWEAXCUT için sıfırdan yazıldı. Shadertoy veya başka bir kaynaktan kod kopyalanmadı.
Aşağıdaki genel bilinen formül / tekniklerden yararlanıldı:

| Teknik | Nerede | Kaynak / lisans |
|---|---|---|
| 2B mesafe fonksiyonları: kutu, yuvarlak kutu, doğru parçası, kalp, 5 köşeli yıldız (`sdBox`, `sdRBox`, `sdSeg`, `sdHeart`, `sdStar`) | `effects/lib.js` | Inigo Quilez'in "2D distance functions" makalesindeki formüller (iquilezles.org; sitedeki örnek kodlar MIT lisanslı) |
| Voronoi kenar mesafesi (iki geçişli) | `effects/lib.js` → `voro` | Inigo Quilez, "Voronoi edges" makalesi (MIT) |
| Altıgen ızgara döşeme | `effects/lib.js` → `hexCell` | Genel bilinen geometri tekniği |
| Kuwahara filtresi (4 çeyrek) | `effects/sanat.js` → `yagli-boya` | Kuwahara (1976), kamu malı algoritma |
| Bayer 4×4 sıralı titreşim matrisi | `effects/lib.js` → `bayer` | Kamu malı |
| Game Boy (DMG) 4 tonlu yeşil palet değerleri | `effects/retro.js` → `gameboy` | Olgusal renk değerleri |

Motorda hazır gelen yardımcılar (`rand`, `noise`, `fbm`, `rgb2hsv`, `hsv2rgb`, `luma`, `tex`) `src/engine/gl.js` / `shaders.js` içindedir; bu paket onları yeniden tanımlamaz.

## İsimler
Efekt ve filtre adları geneldir; marka / oyun / film adı kullanılmadı (ör. "Elendin", "Battle Royale Parlak",
"Sıcak Negatif", "Yeşil Negatif" — belirli bir ürünü taklit etmez).
