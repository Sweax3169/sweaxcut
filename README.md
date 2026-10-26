# 🎬 SWEAXCUT — Sweax Studios

Yatay oyun videolarını **hiç kesmeden, hiç bozmadan** dikey (1080×1920) Shorts / TikTok / Reels formatına çeviren ultra premium masaüstü araç.

## Kurulum

`release\SWEAXCUT-Kurulum-1.0.0.exe` → çift tık → otomatik kurulur → masaüstü kısayolu oluşur → açılır. Hepsi bu.

> **Not (arkadaşına gönderirken):** Dosya imzasız olduğu için Windows SmartScreen mavi bir uyarı gösterebilir.
> "**Daha fazla bilgi → Yine de çalıştır**" demesi yeterli. Bu tek seferlik bir uyarıdır, virüs değildir —
> uygulama tamamen çevrimdışı çalışır, hiçbir veri göndermez.

## Kullanım (3 adım)

1. Videoyu pencereye sürükle (veya tıklayıp seç — mp4/mov/mkv/avi… hepsi olur; klasör atarsan toplu dönüşür)
2. Mod seç: **Blur Dolgu** (önerilen) / **Akıllı Zoom** / **Üst-Alt Düzen** — önizleme canlı gösterir
3. **DÖNÜŞTÜR** → çıktı `videoadı_dikey.mp4` olarak kaynağın yanına düşer

## Özellikler

- **Blur Dolgu**: orijinal görüntü ortada TAM durur, üst-alt bulanık büyütülmüş kopyayla dolar (bulanıklık + karartma ayarlı)
- **Akıllı Zoom**: önizlemede sürükleyerek odak seç, ×1–×3 yakınlaştır
- **Üst-Alt Düzen**: video üstte, altta/üstte renkli alan + yazı (Türkçe karakter ve renkli emoji dahil — canvas overlay ile önizlemeyle birebir)
- **Kesme**: oynatıcıda ⟦ Başlangıç / Bitiş ⟧ işaretle, sadece o aralık dönüşür
- **Hız**: ×0.50–×2.00 (ses otomatik uyumlanır)
- **Müzik**: mp3/wav ekle, video sesi + müzik sesi ayrı ayrı %0–200; müzik kısaysa döngüye girer
- **Renk filtreleri**: Canlı / Sinematik / Sıcak / Soğuk / Siyah-Beyaz
- **Güvenli alan kılavuzu**: TikTok/Reels arayüzünün kapattığı bölgeleri önizlemede gösterir
- **GPU hızlandırma**: NVIDIA NVENC (yoksa otomatik işlemciye düşer, iş yarıda kalmaz)
- **Kalite**: CRF 16–24 (varsayılan 18 = görsel kayıpsız), ses uyumluysa **birebir kopyalanır**
- 4 tema: Şeker / Mor Büyü / Çikolata / Nane
- "Birlikte aç": video dosyasını SWEAXCUT kısayoluna sürüklersen otomatik kuyruğa girer

## Geliştirici notları

- `npm run dev` — vite dev server (tarayıcıda mock API ile arayüz)
- `npm start` — Electron (önce `npm run build:renderer`)
- `npm run dist` — setup.exe üretir (`release/`)
- `node test-videos\make-tests.cjs` — test videoları üretir
- `node test-videos\run-tests.cjs` — motor testi (59 doğrulama: 3 mod × GPU/CPU + kenar durumlar + özellikler)
- `node test-videos\e2e.cjs` — kurulu uygulamayı CDP ile uçtan uca sürer (ekran görüntülü kanıt)

Teknik: Electron 33 + React 18 + Vite; ffmpeg/ffprobe gömülü (ffmpeg-static); NVENC `p7+tune hq+vbr cq -b:v 0`;
blur çeyrek çözünürlükte gblur (10× hız); ilerleme `-progress pipe:1` (out_time_us µs!); iptal önce `q` sonra taskkill;
çıktı önce `~sweaxtmp-*` adına yazılır, başarıda yeniden adlandırılır.

— Sweax Studios 💜
