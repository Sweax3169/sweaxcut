# SWEAXCUT 2 — Sweax Studios

Oyun içerikleri için **ücretsiz** video kurgu programı. Filigran yok, abonelik yok, hesap yok, ücretli özellik yok.
İnternet gerekmez: altyazı, seslendirme ve yapay zekâ araçları dahil her şey bilgisayarda çalışır.

## Kurulum

`release\SWEAXCUT-Kurulum-2.0.1.exe` dosyasına çift tıkla. Kurulur, masaüstüne kısayol koyar ve açılır.

> Dosya imzasız olduğu için Windows SmartScreen mavi bir uyarı gösterebilir:
> **Daha fazla bilgi → Yine de çalıştır**. Tek seferliktir, virüs değildir.

## 30 saniyede ilk video

1. Ana ekranda bir en-boy oranı seç (**9:16** = TikTok / Shorts / Reels, **16:9** = YouTube).
2. Videonu pencereye sürükle ya da soldaki **İÇE AKTAR** düğmesiyle seç. Zaman çizelgesine kendiliğinden yerleşir (birden fazla dosya sırayla dizilir).
3. Soldaki kütüphaneden istediğini seç: **tıkla** = oynatma kafasına ekle, **sürükle** = istediğin yere bırak.
4. Bir klibe tıklayınca sağdaki panelde bütün ayarları çıkar (konum, renk, hız, ses, animasyon…).
5. Sağ üstteki **DIŞA AKTAR** → MP4. Video `Videolar\SWEAXCUT` klasörüne kaydedilir.

## Neler var

| | |
|---|---|
| **Efekt** | 161 (Oyun: vuruş flaşı, hasar vinyeti, killcam, gece görüşü, dürbün, hacker matrix… / Glitch / VHS / Işık / Hava / Parti / Sanat) |
| **Geçiş** | 197 (zum darbe, kırbaç, 3D küp, ışık patlaması, glitch, kalp açılımı, oyun bitti…) |
| **Filtre** | 93 renk filtresi + pozlama, kontrast, sıcaklık, HSL (8 kanal), keskinlik, vinyet, gren… |
| **Yazı** | 126 hazır şablon, 88 yazı animasyonu, 101 yazı tipi (hepsi Türkçe harfli), kontur, gölge, parıltı, degrade, kavisli yazı |
| **Otomatik altyazı** | Çevrimdışı (Whisper). 45 altyazı stili (kelime kelime vurgulu viral stiller), otomatik emoji, anahtar kelime vurgusu, SRT/VTT/ASS içe/dışa aktarma |
| **Seslendirme** | Yazıyı sese çevir (Türkçe: Fahrettin, Fettah, Tolga + 21 yabancı ses), mikrofonla kayıt |
| **Ses** | 102 ses efekti, 22 müzik, 40 ses değiştirici (sincap, canavar, robot, telsiz…), gürültü azaltma, ses eşitleme, EQ, konuşmada müziği otomatik kısma (ducking), vuruş bulma |
| **Çıkartma** | 777 (649 emoji + 128 animasyonlu çizim: abone ol, can barı, kill sayacı, nişangâh, çizgi roman patlamaları…) |
| **Animasyon** | 137 klip animasyonu (giriş / çıkış / döngü), anahtar kare (40 yumuşatma eğrisi) |
| **Hız** | 0.1× – 100×, 22 hız eğrisi (Montaj, Kahraman, Kurşun, Kill-Cam…), ters çevirme, kare dondurma |
| **Maske / Karışım** | 8 maske şekli (yumuşak kenarlı), 24 karışım modu, krom anahtar (yeşil perde) |
| **Yapay zekâ araçları** | Arka plan silme (facecam), video sabitleme, otomatik kadraj (yataydan dikeye), sahne bölme, sessizlikleri kes, öne çıkan anları bul + otomatik zum, uzun videoyu Shorts'a böl |
| **Düzen** | 13 tek tık düzen (facecam üstte + oyun altta, köşe kamera, bölünmüş ekran…) |
| **Dışa aktarma** | 480p – 4K, 24–60 fps, H.264 / H.265 / AV1 / ProRes / WebM / GIF / MP3 / WAV, ekran kartıyla hızlandırma (NVIDIA / AMD / Intel) |

## Kısayollar (en çok kullanılanlar)

| Tuş | İş |
|---|---|
| Boşluk | Oynat / duraklat |
| Ctrl+B veya S | Oynatma kafasında böl |
| Q / W | Solu / sağı kes |
| Delete · Shift+Delete | Sil · boşluğu kapatarak sil |
| Ctrl+Z / Ctrl+Y | Geri al / yinele |
| ← → | Bir kare geri / ileri |
| Ctrl + fare tekerleği | Zaman çizelgesini yakınlaştır |
| Shift + fare tekerleği | İzler arasında yukarı/aşağı kaydır |
| Alt + fare tekerleği (önizlemede) | Seçili klibi büyüt/küçült |
| Ctrl+S / Ctrl+E | Kaydet / dışa aktar |

Hepsi: **Yardım → Klavye kısayolları**.

## Bilmen gerekenler

- **Otomatik altyazı** ilk kullanımda dil modelini indirir. Varsayılan "Small" (~180 MB) Türkçede çok iyidir, 1 dakikalık konuşmayı ~12 saniyede yazar. Bir kez inince internet gerekmez.
- **Uzun kayıtlar** içe aktarılınca arka planda hafif bir önizleme kopyası hazırlanır (2 dakikalık 1080p60 kayıt ≈ 30 sn). Bu sırada da kurguya başlayabilirsin.
- **Proje dosyaları** `Belgeler\SWEAXCUT\Projeler` içine `.sweax` olarak kaydedilir. Program her 45 saniyede bir otomatik kaydeder. Çökerse ana ekranda "Geri yükle" çıkar.
- Proje, kullandığın videoların **yerini** hatırlar. Videoları taşırsan proje onları bulamaz.

## Geliştirici notları

- `npm run dev` + `npm run start:dev` — vite + Electron geliştirme modu
- `npm run dist` — Piper/RNNoise dosyalarını indirir, derler, `release\` içine kurulum dosyası üretir
- Whisper ikilileri `vendor\whisper\bin\` içinde (git'te yok; ggml-org/whisper.cpp `b5454` sürümünden)
- Testler: `scripts/appshot.cjs` (gerçek uygulamayı CDP ile sürer), `scripts/devshot.cjs` + `dev/*.html` (paket test sayfaları), `scripts/test-captions.cjs`
- Mimari ve paket sözleşmeleri: `docs/AGENT-BRIEF.md`, `src/engine/registry.js`
- Üçüncü parti lisanslar: `docs/licenses/`
- Eski sürüm (v1 dikey dönüştürücü) kaynak kodu: `legacy/`
