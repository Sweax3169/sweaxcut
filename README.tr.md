<a href="https://sweax3169.github.io/sweaxcut/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/art/banner-tr-dark.svg">
    <img alt="SWEAXCUT, Windows için video kurgu programı. Önizlemede altyazı kelime kelime doluyor, alttaki zaman çizelgesinde kırmızı oynatma kafası bir kesimden geçiyor." src="docs/art/banner-tr-light.svg" width="100%">
  </picture>
</a>

<p align="center">
  <a href="https://github.com/Sweax3169/sweaxcut/releases/latest"><b>Windows için indir</b></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://sweax3169.github.io/sweaxcut/">Web sitesi</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Sweax3169/sweaxcut/releases/latest"><img alt="Son sürüm" src="https://img.shields.io/github/v/release/Sweax3169/sweaxcut?label=s%C3%BCr%C3%BCm&color=ff4b3e"></a>
  <a href="https://github.com/Sweax3169/sweaxcut/releases"><img alt="İndirme sayısı" src="https://img.shields.io/github/downloads/Sweax3169/sweaxcut/total?label=indirme&color=13161c"></a>
  <img alt="Windows 10 ve 11, 64 bit" src="https://img.shields.io/badge/Windows-10%20%7C%2011%20%C2%B7%2064%20bit-13161c">
  <a href="LICENSE"><img alt="MIT lisansı" src="https://img.shields.io/badge/lisans-MIT-36d39b"></a>
</p>

<br>

<p align="center">
  <a href="docs/media/tour.mp4"><img alt="SWEAXCUT 3 ekran kaydı: ana ekran, ritimli montaj kuran bir tarif ve oynayan montaj, otomatik altyazılı proje, altyazı stili değişimleri, komut paleti ve dışa aktarma penceresi" src="docs/media/tour.gif" width="900"></a>
</p>
<p align="center"><sub>Ana ekrandan dışa aktarmaya: bir tarif ritimli montaj kuruyor, konuşma klibine altyazı ekleniyor, altyazının stili değişiyor, komut paleti açılıyor. <a href="docs/media/tour.mp4">Turu MP4 olarak izle</a>.</sub></p>

<br>

## Nedir

SWEAXCUT, Sweax Studios'un yaptığı bir Windows video kurgu programı. Kliplerini altı tariften birine bırakırsın, kurguyu o kurar: müziğin vuruşunda keser, konuşmadaki boşlukları atar, oyun kaydındaki sesli anları bulur, altyazıyı kelime kelime yazar. Kurduğu her şey çok izli zaman çizelgesinde düzenlenebilir kalır; zaman çizelgesini, dışa aktarmayı da çizen aynı WebGL2 bileşimci çizer.

Konuşma tanıma (whisper.cpp), seslendirme (Piper) ve efektler senin bilgisayarında çalışır. Kaynak kodu MIT lisanslı.

> [!NOTE]
> Arayüz Türkçe. Altyazı Türkçe, İngilizce ve başka dillerde oluşturulabilir.

<br>

## 3.0'da yeni

| | |
|---|---|
| **Baştan tasarım** | Ana ekran, editör, bütün paneller, denetçi, zaman çizelgesi, pencereler ve dışa aktarma. |
| **Ana ekranda tarifler** | Dosyaları bir tarif kartına bırak, kurgu kurulsun. Her kart küçük bir canlı önizleme oynatır. |
| **Otomatik sekmesi** | Altı tarif, Güzelleştir (sekiz adım) ve rengi, geçişi, altyazı stilini birlikte ayarlayan sekiz görünüm paketi. |
| **Altyazı** | Klipten tek tık, üç doğruluk seviyesi, müzik ve oyun sesini atlama, metin düzenleyici, stil düzenleyici, 45 hazır stil ve kendi stillerin. |
| **Komut paleti** | <kbd>Ctrl</kbd>+<kbd>K</kbd> komutları, tarifleri ve kütüphanedeki her şeyi arar. |
| **Uzmanlar için** | Anahtar kare eğri düzenleyicisi, renk kapsamları, önizleme çevresinde ortam ışığı. |
| **Dışa aktarma hazır ayarları** | Sosyal medyadan Yalnız sese altı hazır ayar. |
| **Rehber** | Boş zaman çizelgesinde dört adım (Ekle, Otomatik kurgu, Altyazı, Dışa aktar), dosya gelince "Sıradaki adım" şeridi. |

<br>

## Tek tıkla kurgu

<p align="center">
  <img alt="Ana ekran: Dosya seç ve Boş proje düğmeli bırakma alanı, 9:16'dan 21:9'a beş biçim kartı, canlı önizlemeli altı tarif kartı ve kütüphane sayıları" src="docs/media/home.webp" width="100%">
</p>

Ana ekranda bir bırakma alanı, beş biçim (TikTok, Reels ve Shorts için 9:16, 16:9, 1:1, 4:5 ve 21:9) ve altı tarif var. Videolarını bir tarif kartına bırakırsan kurgu kendiliğinden kurulur; bırakma alanına bırakırsan zaman çizelgesine olduğu gibi dizilir.

| Tarif | Ne kurar |
|---|---|
| **Ritimli montaj** | Müziğin vuruşunda keser, iki ölçüde bir zoom geçişi, vurgu zoomu, canlı renk |
| **Konuşma + altyazı** | Sessizlikleri keser, sıçrama zoomu ve ses netleştirme ekler, altyazıyı kelime kelime yazar, müziği konuşmada kısar |
| **Oyun anları** | Sesin yükseldiği anları bulur, zoom ve flaş ekler |
| **Vlog** | Klipler sırayla, yumuşak geçiş, altın saat rengi, tarih başlığı |
| **Fotoğraf slaytı** | Müziğin her ölçüsünde yavaş zoom ya da kayma |
| **Kısa özet** | Uzun videodan 30 saniyelik özet |

Uygulamanın müzik kütüphanesindeki parçaların temposu bilindiği için vuruş ızgarası kesindir. Kendi müziğinde vuruşlar algılanır.

<table>
<tr>
<td width="50%" valign="top"><img alt="Otomatik kurgu penceresi: solda altı tarif, sağda müzik, uzunluk (15 sn, 30 sn, 1 dk, hepsi) ve otomatik altyazı" src="docs/media/autoedit.webp" width="100%"></td>
<td width="50%" valign="top"><img alt="Ritimli montaj tarifi çalışıyor: müzik hazırlanıyor; aşamalar Müzik, Klipler, Kurgu, Bitti" src="docs/media/autoedit-run.webp" width="100%"></td>
</tr>
<tr>
<td valign="top"><sub>Tarifi, müziği ve uzunluğu seç. Pencere, tarifin ne yapacağını çalıştırmadan önce yazar.</sub></td>
<td valign="top"><sub>Tarif dört aşamada çalışır: müzik, klipler, kurgu, bitti. Paketlenmiş uygulamada Ritimli montaj kartına bırakılan üç klip 6,3 sn'de 38 kesimli 30 saniyelik bir montaj oldu.</sub></td>
</tr>
</table>

### Güzelleştir

Güzelleştir, elindeki kurgunun üzerinden geçer. Her adım çalıştırmadan önce açılıp kapatılabilir.

| Adım | Ne yapar | Varsayılan |
|---|---|:---:|
| Sessizlikleri kes | Konuşmadaki boşlukları atar | |
| Sesi netleştir ve dengele | Gürültü azaltma, netlik, yükseklik eşitleme | ✓ |
| Rengi iyileştir | Hafif kontrast ve canlılık | ✓ |
| Kesimlere geçiş | Yumuşak karışım, 0,35 sn | ✓ |
| Vurgu zoomu | Sesin yükseldiği anlarda yakınlaşır | |
| Otomatik altyazı | Konuşmayı kelime kelime yazar | |
| Arka plan müziği | Konuşmada kendiliğinden kısılır | |
| Giriş ve bitiş | Başta belirme, sonda kararma | ✓ |

### Görünüm paketleri

Bir görünüm paketi renk filtresini, geçişleri ve altyazı stilini tek tıkla ayarlar. Sekiz paket var: **Sinematik, Enerjik, Sade, Oyun, Sıcak vlog, Retro, Neon gece** ve **Siyah beyaz**.

### Komut paleti

<p align="center">
  <img alt="Editörün üstünde komut paleti: 'altyazı' araması Otomatik altyazı oluştur komutunu ve Konuşma + altyazı tarifini buluyor" src="docs/media/command.webp" width="100%">
</p>

<kbd>Ctrl</kbd>+<kbd>K</kbd> *Ne yapmak istiyorsun?* kutusunu açar. Tek arama komutları, tarifleri ve kütüphanedeki her efekti, geçişi, filtreyi, yazı şablonunu ve müziği kapsar.

<br>

## Otomatik altyazı

Altyazıyı [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`b5454` sürümü) senin bilgisayarında çıkarır. Her kelimenin kendi zamanı olduğu için o an söylenen kelime vurgulanabilir.

<table>
<tr>
<th width="33%">1 · Oluştur</th>
<th width="33%">2 · Düzenle</th>
<th width="33%">3 · Stil</th>
</tr>
<tr>
<td valign="top"><img alt="Konuşma yazıya dökülürken altyazı paneli, yüzde 8: kaynak Ana iz, dil Türkçe, doğruluk Doğru seçili" src="docs/media/captions-running.webp" width="100%"></td>
<td valign="top"><img alt="Altyazı metin düzenleyici: başlangıç zamanlarıyla 22 satır; önizlemede SONRA MERDİVENLERDEN yazarken SONRA kelimesi vurgulu" src="docs/media/captions.webp" width="100%"></td>
<td valign="top"><img alt="Altyazı stil düzenleyici: hazır stiller, yazı tipi, boyut, kalınlık, harf aralığı, renk ve BÜYÜK HARF; yanda dikey önizleme" src="docs/media/caption-style.webp" width="100%"></td>
</tr>
</table>

**Oluştur.** Klibin denetçisindeki *Altyazı oluştur* düğmesine, zaman çizelgesi araç çubuğundaki *Altyazı* düğmesine bas ya da klibin sağ tık menüsünü kullan.

| Doğruluk | Model | İndirme |
|---|---|---:|
| Hızlı | small | 190 MB |
| **Doğru** (önerilen) | medium | 539 MB |
| Büyük | large-v3-turbo | 574 MB |

Kelime zamanı DTW ile bulunur. *Müzik ve oyun sesini atla* önce Silero VAD çalıştırır; bir süzgeç de uydurma yazıyı atar (konuşma olmayan oyun sesinin üstüne modelin yazabildiği "bzzzz" gibi).

**Düzenle.** Bütün satırlar tek bir belge gibi okunur:

- kelimeye tıkla, o ana git; çift tıkla, yaz
- <kbd>Enter</kbd> satırı imleçten böler, satır başında <kbd>Geri sil</kbd> öncekiyle birleştirir
- başlangıç ve bitişi kare kare kaydır (<kbd>Shift</kbd>: 0,1 sn) ya da senkron için bütün altyazıları birlikte kaydır
- bul ve değiştir
- SRT, VTT, ASS ya da TXT olarak dışa aktar; SRT, VTT ya da ASS içe aktar

**Stil.** Değişiklik bütün satırlara aynı anda uygulanır ve önizlemede canlı görünür.

| | Seçenekler |
|---|---|
| Yazı | yazı tipi, boyut, kalınlık, harf aralığı, renk, Türkçe kuralıyla BÜYÜK HARF (i → İ) |
| Konuşulan kelime | Renk, Kutu, Çizgi, Karaoke dolgu ya da Yok; rengi, kutu köşesi, büyüme, zıplama |
| Söylenecek kelimeler | kendi opaklıkları |
| Kelime girişi | Pat, Belir, Kay, Düş, Vur, Bulanık, Daktilo, Dön, Esne |
| Sürekli hareket | Nabız, Sallan, Süzül |
| Ekler | emoji, kontur, gölge, parlama |
| Arka plan | satır, blok ya da her kelime |
| Yerleşim | üst, orta ya da alt; dikey ve yatay kaydırma, genişlik, satır başına kelime (kelime zamanlarıyla yeniden böler) |

45 hazır stil gerçek altyazı çizicisiyle önizlenir. *Bu stili kaydet* kendi stilini *Kaydettiklerim* altına kaydeder (uygulama veri klasöründe `caption-styles.json`).

### Ölçülen doğruluk

TTS sesiyle üretilmiş 66 saniyelik Türkçe konuşma; beş model `scripts/test-captions.cjs --models=all` ile, AMD Ryzen 5 7600 işlemcide çalıştırıldı (whisper ekran kartını kullanmadı).

| Model | Kelime hata oranı | 66 sn için süre |
|---|---:|---:|
| tiny | %23,9 | |
| base | %16,2 | |
| small · *Hızlı* | %6,0 | 13,5 sn |
| **medium · *Doğru*** | **%2,6** | **42,6 sn** |
| large-v3-turbo · *Büyük* | %5,1 | 78,3 sn |

Kelime zamanındaki hatanın ortancası 29–49 ms. 39 saniyelik İngilizce konuşmada (Windows'un Zira sesi) medium bütün kelimeleri doğru yazdı, süre yaklaşık 26–32 sn. Paketlenmiş uygulamada klibin *Altyazı oluştur* düğmesi, 32 saniyelik Türkçe konuşmayı medium ile 43 sn'de 22 satır, 53 kelimeye çevirdi.

<br>

## Kütüphane

<table>
<tr>
<td width="33%" valign="top" align="center"><img alt="Otomatik paneli: tarifler, Güzelleştir ve görünüm paketleri" src="docs/art/panel-auto.webp" width="100%"><br><b>Otomatik</b><br><sub>6 tarif · Güzelleştir · 8 görünüm</sub></td>
<td width="33%" valign="top" align="center"><img alt="Önizlemeli geçiş paneli" src="docs/art/panel-transitions.webp" width="100%"><br><b>197 geçiş</b><br><sub>125'i gl-transitions, 72'si SWEAXCUT için yazıldı</sub></td>
<td width="33%" valign="top" align="center"><img alt="Efekt paneli" src="docs/art/panel-effects.webp" width="100%"><br><b>161 efekt</b><br><sub>klibe ya da kendi katmanına</sub></td>
</tr>
<tr>
<td valign="top" align="center"><img alt="Renk filtresi paneli" src="docs/art/panel-filters.webp" width="100%"><br><b>93 renk filtresi</b><br><sub>HSL ve ayar katmanıyla</sub></td>
<td valign="top" align="center"><img alt="Yazı şablonu paneli" src="docs/art/panel-text.webp" width="100%"><br><b>126 yazı şablonu</b><br><sub>88 animasyon, Türkçe harfli 101 yazı tipi</sub></td>
<td valign="top" align="center"><img alt="Çıkartma paneli" src="docs/art/panel-stickers.webp" width="100%"><br><b>777 çıkartma</b><br><sub>Twemoji ve vektör çıkartmalar</sub></td>
</tr>
<tr>
<td valign="top" align="center"><img alt="Müzik ve ses efekti paneli" src="docs/art/panel-audio.webp" width="100%"><br><b>102 ses efekti, 22 müzik</b><br><sub>uygulamada sentezlenir; 40 ses değiştirici</sub></td>
<td valign="top" align="center"><img alt="Araçlar paneli" src="docs/art/panel-tools.webp" width="100%"><br><b>Araçlar</b><br><sub>arka plan silme, sabitleme, kadraj, sahne bölme</sub></td>
<td valign="top" align="center"><img alt="Düzen paneli" src="docs/art/panel-layouts.webp" width="100%"><br><b>13 düzen</b><br><sub>kamera + oyun, bölünmüş ekran ve daha fazlası</sub></td>
</tr>
</table>

Uygulamanın içerik kayıt defterinden (`src/engine/registry.js`) sayıldı:

| | Sayı | |
|---|---:|---|
| <img src="https://img.shields.io/badge/-%20-ff6b8b?style=flat-square" alt=""> Efekt | **161** | |
| <img src="https://img.shields.io/badge/-%20-4d8dff?style=flat-square" alt=""> Geçiş | **197** | 125 gl-transitions + 72 SWEAXCUT için yazıldı |
| <img src="https://img.shields.io/badge/-%20-4fd6e8?style=flat-square" alt=""> Renk filtresi | **93** | |
| <img src="https://img.shields.io/badge/-%20-e070ee?style=flat-square" alt=""> Yazı şablonu | **126** | |
| <img src="https://img.shields.io/badge/-%20-e070ee?style=flat-square" alt=""> Yazı animasyonu | **88** | |
| <img src="https://img.shields.io/badge/-%20-e070ee?style=flat-square" alt=""> Yazı tipi | **101** | hepsinde Türkçe harfler |
| <img src="https://img.shields.io/badge/-%20-e070ee?style=flat-square" alt=""> Altyazı stili | **45** | ve kaydettiklerin |
| <img src="https://img.shields.io/badge/-%20-ffb84d?style=flat-square" alt=""> Çıkartma | **777** | Twemoji (CC-BY 4.0) ve vektör |
| <img src="https://img.shields.io/badge/-%20-36d39b?style=flat-square" alt=""> Ses efekti | **102** | uygulamada sentezlenir |
| <img src="https://img.shields.io/badge/-%20-36d39b?style=flat-square" alt=""> Müzik | **22** | uygulamada sentezlenir |
| <img src="https://img.shields.io/badge/-%20-36d39b?style=flat-square" alt=""> Ses değiştirici | **40** | |
| <img src="https://img.shields.io/badge/-%20-4d8dff?style=flat-square" alt=""> Klip animasyonu | **137** | |
| <img src="https://img.shields.io/badge/-%20-4d8dff?style=flat-square" alt=""> Hız eğrisi | **22** | ve özel eğri |
| <img src="https://img.shields.io/badge/-%20-4d8dff?style=flat-square" alt=""> Düzen | **13** | |
| <img src="https://img.shields.io/badge/-%20-ff4b3e?style=flat-square" alt=""> Otomatik kurgu tarifi | **6** | |
| <img src="https://img.shields.io/badge/-%20-ff4b3e?style=flat-square" alt=""> Görünüm paketi | **8** | |
| <img src="https://img.shields.io/badge/-%20-ff4b3e?style=flat-square" alt=""> Dışa aktarma hazır ayarı | **6** | |

<br>

## Uzmanlar için

<p align="center">
  <img alt="Denetçide anahtar kare eğri düzenleyicisi (iki altın tutamaçlı yavaş başla-bitir eğrisi ve altı hazır eğri), önizlemenin üstünde luma dalga formu kapsamı" src="docs/media/pro-curve-scopes.webp" width="100%">
</p>

3.0'da yeni:

- **Anahtar kare eğri düzenleyicisi.** İki anahtar kare arasında iki tutamaçlı bezier; değerler −0,5 ile 1,5 arasında, böylece hareket hedefini aşabilir ya da önce geri çekilebilir. Altı hazır eğri: Yumuşak, Hızlan, Yavaşla, Çarpıcı, Taşma, Hazırlan.
- **Renk kapsamları.** Histogram, luma dalga formu, RGB geçit ve ten çizgili vektörskop.
- **Ortam ışığı.** Önizlemenin çevresi rengini kareden alır.

Önceki sürümlerden korunanlar:

| Alan | |
|---|---|
| Animasyon | anahtar kareler, 137 klip animasyonu, 22 hız eğrisi ve özel eğri |
| Bileşim | maske, krom anahtar, karışım modları, ayar katmanı |
| Renk | 93 filtre, HSL |
| Video araçları | arka plan silme (MediaPipe), sabitleme (ffmpeg vidstab), otomatik kadraj, sahne bölme |
| Ses | gürültü azaltma, netleştirme, yükseklik eşitleme, ducking, 40 ses değiştirici |
| Seslendirme | Piper; Türkçe ses Fahrettin gömülü |

<br>

## Dışa aktarma

<p align="center">
  <img alt="Dışa aktarma penceresi: altı hazır ayar (Sosyal medya, YouTube, En yüksek, Hızlı paylaş, GIF, Yalnız ses), dosya adı, klasör, biçim, çözünürlük, kare hızı, kalite, kodek, donanım ve ses kalitesi" src="docs/media/export.webp" width="100%">
</p>

| Hazır ayar | Çıktı |
|---|---|
| Sosyal medya | 1080p, 30 kare, H.264 |
| YouTube | 1080p, 60 kare |
| En yüksek | 4K, H.265 |
| Hızlı paylaş | 720p |
| GIF | döngülü hareketli görsel |
| Yalnız ses | MP3, 320 kbps |

Hazır ayarların altındaki her alan elle de değiştirilebilir. Kodlama mümkünse ekran kartında yapılır (NVIDIA NVENC, AMD AMF, Intel Quick Sync); kareler önizlemeyle aynı WebGL2 bileşimciden gelir. Pencere filigran eklemez.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/art/pipeline-tr-dark.svg">
    <img alt="Mimari: dosyalar içe aktarmadan (ffprobe, önizleme kopyaları) zaman çizelgesi modeline geçer; whisper.cpp altyazısı ve Piper seslendirmesi zaman çizelgesine eklenir; tek WebGL2 bileşimci önizlemeyi ve dışa aktarmada klip başına bir ffmpeg kod çözücüden gelen kareleri çizer; kareler ekran kartında BT.709 YUV 4:2:0'a paketlenir, geri okunur ve NVENC, AMF, Quick Sync ya da işlemci kodlayıcısına gider" src="docs/art/pipeline-tr-light.svg" width="100%">
  </picture>
</p>

Dışa aktarmada her klibi kendi ffmpeg süreci çözer; her kare WebGL2 bileşimcide (`src/engine/compositor.js`) birleştirilir, ekran kartında BT.709 YUV 4:2:0'a çevrilir, geri okunur ve kodlayıcıya verilir. Ses yanda WAV'a karıştırılır ve sonunda dosyaya eklenir. [Dışa aktarılmış bir örnek](docs/media/export-sample.mp4) depoda duruyor.

<br>

## Tek makinede ölçüldü

Paketlenmiş uygulama, uçtan uca betikler, AMD Ryzen 5 7600.

| İş | Sonuç |
|---|---|
| *Ritimli montaj* tarif kartına bırakılan üç klip | 38 kesimli 30 saniyelik montaj, **6,3 sn** |
| 32 sn Türkçe konuşmalı klipte *Altyazı oluştur* (medium) | 22 satır, 53 kelime, **43 sn** |
| 32 saniyelik 1080×1920 projenin `h264_nvenc` ile dışa aktarılması | **23,8 sn** |
| 66 sn Türkçe TTS konuşmasının altyazısı, medium | %2,6 kelime hatası, **42,6 sn** |

<br>

## Klavye kısayolları

| Tuş | İşlem | Tuş | İşlem |
|---|---|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Komut paleti | <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> | Geri sar, dur, ileri sar |
| <kbd>Boşluk</kbd> | Oynat / duraklat | <kbd>←</kbd> <kbd>→</kbd> | Bir kare geri / ileri |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> ya da <kbd>S</kbd> | Oynatma kafasında böl | <kbd>Shift</kbd>+<kbd>←</kbd> <kbd>→</kbd> | Bir saniye geri / ileri |
| <kbd>Q</kbd> / <kbd>W</kbd> | Oynatma kafasının solunu / sağını kırp | <kbd>↑</kbd> <kbd>↓</kbd> | Önceki / sonraki kesim |
| <kbd>Delete</kbd> | Sil | <kbd>Home</kbd> <kbd>End</kbd> | Başa / sona git |
| <kbd>Shift</kbd>+<kbd>Delete</kbd> | Sil ve boşluğu kapat | <kbd>I</kbd> <kbd>O</kbd> | Aralık başı / sonu |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Geri al / yinele | <kbd>M</kbd> | İşaret ekle |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd> | Kopyala, kes, yapıştır | <kbd>T</kbd> | Yazı ekle |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Çoğalt | <kbd>Alt</kbd>+<kbd>K</kbd> | Anahtar kare ekle |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | Tümünü seç | <kbd>[</kbd> <kbd>]</kbd> | Önceki / sonraki anahtar kare |
| <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>−</kbd> | Zaman çizelgesini yakınlaştır | <kbd>N</kbd> | Yakalamayı aç / kapat |
| <kbd>Shift</kbd>+<kbd>Z</kbd> | Zaman çizelgesini sığdır | <kbd>F</kbd> | Önizlemeyi tam ekran yap |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Kaydet | <kbd>Ctrl</kbd>+<kbd>O</kbd> | Proje aç |
| <kbd>Ctrl</kbd>+<kbd>E</kbd> | Dışa aktar | <kbd>Ctrl</kbd>+<kbd>I</kbd> | Medya içe aktar |

Aynı liste uygulamada **Yardım → Klavye kısayolları** altında (`src/ui/shortcuts.js`).

<br>

## Gizlilik

Videoların senin bilgisayarında düzenlenir, hiçbir yere yüklenmez. Hesap yok; kodda analiz, telemetri ya da güncelleme denetimi yok.

Uygulama yalnızca iki durumda, o da sen başlatınca internete çıkar:

| Ne zaman | Nereden | Ne |
|---|---|---|
| Diskinde olmayan bir modelle altyazı oluşturduğunda | `huggingface.co/ggerganov/whisper.cpp` ya da yedek `hf-mirror.com` | model dosyası; boyutu ve SHA-256'sı denetlenir |
| Kurulu olmayan bir Piper sesi seçtiğinde | `huggingface.co` (`rhasspy/piper-voices`, `speaches-ai`) | ses modeli ve ayar dosyası |

Geri kalan her şey (Silero VAD modeli, MediaPipe modelleri, yazı tipleri, çıkartmalar, müzik ve ses efektleri) kurulum dosyasıyla gelir.

<br>

## Dosyaların nerede

| Ne | Nerede |
|---|---|
| Projeler (`.sweax`) | `Belgeler\SWEAXCUT\Projeler` |
| 45 saniyede bir otomatik kayıt | `%APPDATA%\SWEAXCUT\autosave\` |
| Kaydedilen altyazı stilleri | `%APPDATA%\SWEAXCUT\caption-styles.json` |
| Önizleme kopyaları, ses dalgaları, küçük resimler | `%APPDATA%\SWEAXCUT\cache\` |
| İndirilen konuşma modelleri | `%APPDATA%\SWEAXCUT\models\whisper\` |
| Dışa aktarılan videolar | `Videolar\SWEAXCUT` ya da dışa aktarma penceresinde seçtiğin klasör |

<br>

## Kurulum

1. [Son sürümden](https://github.com/Sweax3169/sweaxcut/releases/latest) `SWEAXCUT-Kurulum-3.0.0.exe` dosyasını indir (yaklaşık 214 MB).
2. Çalıştır. Yalnız senin kullanıcı hesabına kurulur, masaüstüne ve Başlat menüsüne kısayol ekler, `.sweax` proje dosyalarını tanıtır ve uygulamayı açar.
3. Videolarını bir tarif kartına ya da kendin düzenlemek için bırakma alanına bırak.

> [!IMPORTANT]
> Kurulum dosyası kod imzalı değil, bu yüzden Windows SmartScreen ilk seferde mavi bir uyarı gösterebilir. **Ek bilgi**'ye, sonra **Yine de çalıştır**'a tıkla.

**Gereksinimler:** 64 bit Windows 10 ya da 11 ve WebGL 2 destekli bir ekran kartı. Donanım video kodlayıcısı (NVIDIA, AMD ya da Intel) dışa aktarmayı hızlandırır ama şart değil.

<br>

## Sık sorulanlar

<details>
<summary><b>İnternet gerekiyor mu?</b></summary>
<br>
Yalnızca bir konuşma modeliyle ilk kez altyazı oluştururken o modeli indirmek ve ek Piper sesleri indirmek için. Kurgu, efektler, tarifler, gömülü Türkçe ses ve dışa aktarma internetsiz çalışır.
</details>

<details>
<summary><b>Hangi doğruluğu seçmeliyim?</b></summary>
<br>
<i>Doğru</i> (medium) önerilen seçenek; yukarıdaki ölçümde Türkçede en az hatayı yaptı (%2,6). <i>Hızlı</i> (small) aynı 66 saniyeyi 42,6 sn yerine 13,5 sn'de bitirdi, hata oranı %6,0.
</details>

<details>
<summary><b>Konuşma olmayan oyun klibinde altyazı saçma şeyler yazdı.</b></summary>
<br>
<i>Müzik ve oyun sesini atla</i> seçeneğini aç. Whisper'dan önce konuşma algılama çalışır, bir süzgeç de "bzzzz" gibi uydurma yazıyı atar.
</details>

<details>
<summary><b>İndirilebilir Türkçe ses <code>tr_TR-dfki-medium</code>'u ticari bir videoda kullanabilir miyim?</b></summary>
<br>
Hayır. Bu sesin lisansı CC BY-NC-SA 4.0; ticari kullanıma izin vermez. Gömülü ses Fahrettin CC0. Her sesin lisansı <a href="THIRD_PARTY_NOTICES.md">THIRD_PARTY_NOTICES.md</a> içinde.
</details>

<details>
<summary><b>Windows kurulum dosyasının bilinmeyen bir yayıncıdan olduğunu söylüyor.</b></summary>
<br>
Kurulum dosyası kod imzalı değil. <b>Ek bilgi</b>'ye, sonra <b>Yine de çalıştır</b>'a tıkla. İstersen bu depodan kendin de derleyebilirsin.
</details>

<details>
<summary><b>Uygulama beklenmedik şekilde kapandı. Projem gitti mi?</b></summary>
<br>
Proje 45 saniyede bir <code>%APPDATA%\SWEAXCUT\autosave\</code> klasörüne kaydedilir; uygulamayı yeniden açtığında ana ekran geri yüklemeyi önerir.
</details>

<br>

## Kaynaktan derleme

```bash
git clone https://github.com/Sweax3169/sweaxcut.git
cd sweaxcut
npm install                # MediaPipe wasm dosyalarını da public/ içine kopyalar
npm run prepare:vendor     # Piper'ı, gömülü Türkçe sesi ve FFprobe'u vendor/ içine indirir
```

whisper.cpp bir betikle indirilmiyor. [`b5454` sürümündeki](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454) `whisper-blas-bin-x64.zip` dosyalarını ve Microsoft Visual C++ çalışma zamanı DLL'lerini `vendor/whisper/bin/` içine koy. Bu ikili dosyaların hiçbiri git'te tutulmuyor; bkz. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

```bash
npm run dev                # Vite geliştirme sunucusu
npm run start:dev          # ona bağlı Electron penceresi
npm run dist               # üretim derlemesi ve release/ içinde NSIS kurulum dosyası
```

Bu sayfadaki görüntüler çalışan uygulamadan alındı. `scripts/docs-media/footage.html` örnek görüntüleri özgün GLSL sahnelerinden üretir, `drive.cjs` uygulamayı Chrome DevTools Protokolü ile sürer, `encode.cjs` MP4 ve GIF'i yapar, `readme-art.cjs` başlığı ve mimari şemayı çizer, `site-build.cjs` web sitesinin yazı tiplerini ve gölgelendirici verisini günceller.

<br>

## Proje yapısı

```
sweaxcut/
├─ electron/main.cjs        ana süreç: pencere, dosya pencereleri, yollar
├─ src/
│  ├─ core/                 proje modeli, geri alma deposu, zaman çizelgesi işlemleri, anahtar kareler, içe aktarma
│  ├─ engine/               WebGL2 bileşimci, gölgelendiriciler, oynatma, ses, yazı ve çıkartma çizimi
│  │  └─ export/            kod çözücüler, GPU YUV paketleme, kodlayıcı seçimi, ses karışımı
│  ├─ features/             autoedit (tarifler, Güzelleştir, görünümler), captions (whisper.cpp), tts (Piper),
│  │                        video (arka plan silme, sabitleme, kadraj, sahneler), audio (vuruş, sessizlik)
│  ├─ packs/                efektler, geçişler, filtreler, yazılar, yazı tipleri, çıkartmalar, sesler, müzik, düzenler
│  ├─ platform/node.js      arayüzün Node'a dokunduğu tek yer
│  └─ ui/                   ana ekran, editör, kütüphane, denetçi, zaman çizelgesi, önizleme, stiller
├─ public/                  yazı tipleri, Twemoji SVG'leri, MediaPipe modelleri
├─ vendor/                  Piper, whisper.cpp, FFprobe (ikili dosyalar git'te değil)
├─ scripts/                 vendor indirme, test sürücüleri, belge görselleri
└─ docs/                    web sitesi, README görselleri, ekran görüntüleri, lisans notları
```

<br>

## Emeği geçenler ve lisanslar

SWEAXCUT'ı **Sweax Studios** yaptı; şu açık projelerin üzerine kurulu:

| Bileşen | Ne için | Lisans |
|---|---|---|
| [FFmpeg](https://ffmpeg.org) 6.1.1, [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) derlemesi | kod çözme, kodlama, sabitleme, ses süzgeçleri; ayrı bir program olarak çalışır | GPL |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | otomatik altyazı | MIT |
| [Piper](https://github.com/rhasspy/piper) ve [eSpeak NG](https://github.com/espeak-ng/espeak-ng) | seslendirme | MIT, GPL |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | arka plan silme, yüz algılama | Apache-2.0 |
| [gl-transitions](https://github.com/gl-transitions/gl-transitions) | 197 geçişin 125'i | MIT |
| [Twemoji](https://github.com/jdecked/twemoji) | emoji çıkartmalar | CC-BY 4.0 |
| Fontsource üzerinden Google Fonts'tan 101 yazı tipi ailesi, Mona Sans ve Geist Mono | yazı şablonları, arayüz | SIL Open Font License (Luckiest Guy: Apache-2.0) |
| Piper sesi `tr_TR-dfki-medium` (isteğe bağlı indirme) | Türkçe ses | CC BY-NC-SA 4.0, **ticari olmayan** |

Uygulamayla gelen her bileşen, lisansı ve kaynağıyla **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)** içinde listeli. Efektler, filtreler, geçişlerin 72'si, vektör çıkartmalar, müzik ve ses efektleri SWEAXCUT için yapıldı.

## Lisans

SWEAXCUT kaynak kodu [MIT Lisansı](LICENSE) ile yayımlanır. © 2026 Sweax Studios.
