# Ses paketi — üçüncü parti bileşenler ve lisanslar

Ses motoru (`src/engine/audio.js`, `audio-process.js`), ses değiştiriciler (`src/packs/voiceFx`), ses özellikleri
(`src/features/audio`) ve metin okuma (`src/features/tts`) kendi kodumuzdur (proje lisansı, MIT).
Aşağıdakiler ayrı programlar / veri dosyaları olarak dağıtılır; uygulama onları **ayrı süreç** olarak çalıştırır
(bağlanmaz), bu yüzden GPL bileşenleri "birlikte dağıtım" (aggregation) kapsamındadır.

## Çalıştırılabilir dosyalar (`vendor/`, kurulumda `resources/vendor/`)

| Bileşen | Sürüm / kaynak | Lisans | Not |
|---|---|---|---|
| Piper TTS (`vendor/piper/piper.exe`, `piper_phonemize.dll`) | rhasspy/piper sürüm `2023.11.14-2`, `piper_windows_amd64.zip` — https://github.com/rhasspy/piper | MIT | Bakımı süren çatal OHF-Voice/piper1-gpl GPL-3.0'a geçti; biz MIT lisanslı rhasspy sürümünü kullanıyoruz. |
| eSpeak NG (`espeak-ng.dll`, `espeak-ng-data/`) | Piper paketinin içinden (rhasspy/espeak-ng çatalı) — https://github.com/rhasspy/espeak-ng | **GPL-3.0-or-later** | Fonem üretimi için Piper tarafından yüklenir. Kaynak kodu yukarıdaki depoda. Kurulumda GPL metni ve kaynak bağlantısı gösterilmeli (ffmpeg için zaten gerekli). Katalog dışı dillerin `*_dict` sözlükleri çıkarıldı (tr, en, de, fr, es, ru, it, pt, nl, pl, uk kaldı). |
| ONNX Runtime (`onnxruntime.dll`, `onnxruntime_providers_shared.dll`) | Piper paketinin içinden — https://github.com/microsoft/onnxruntime | MIT | |
| RNNoise modelleri (`vendor/rnnoise/std.rnnn`, `bd.rnnn`, `sh.rnnn`) | https://github.com/richardpl/arnndn-models | `std`: Xiph RNNoise (BSD-3-Clause); `bd`, `sh`: GregorR/rnnoise-models — yazarı "yaratıcı eser değildir, telif konusu değildir" diye beyan ediyor | ffmpeg `arnndn` filtresiyle gürültü azaltma (konuşma). |
| ffmpeg (zaten projede) | gyan.dev 6.1.1 essentials (`ffmpeg-static`) | GPL-3.0 | `rubberband` (GPL-2.0+), `afftdn`, `arnndn`, `loudnorm`, `silencedetect`, `ebur128` filtreleri bu ikilinin içinde. JS paketine rubberband-wasm EKLENMEDİ. |

İndirme betiği: `node scripts/fetch-piper.cjs` (Piper + gömülü ses + RNNoise; gereksiz dosyaları ayıklar).

## Piper ses modelleri

Model ağırlıkları Hugging Face'ten (`rhasspy/piper-voices`, deponun README lisansı MIT); her sesin kullanım koşulu
**MODEL_CARD**'daki veri kümesi lisansına bağlıdır. Yalnızca kullanıma/yeniden dağıtıma izin veren sesler katalogda
(`src/features/tts/voices.js`). Çoğu ses "U.S. English lessac" kontrol noktasından ince ayarlanmıştır (Piper projesinin
standart uygulaması); lessac veri kümesinin kendi lisansı Blizzard 2013 araştırma lisansıdır — Piper projesi ince ayarlı
sesleri MODEL_CARD'daki veri lisansıyla yayınlıyor, biz de öyle etiketliyoruz.

### Kurulumla gelen (gömülü)

| Ses | Dosya | Veri kümesi / lisans | Kaynak |
|---|---|---|---|
| **tr_TR-fahrettin-medium** (Türkçe, erkek) | `vendor/piper/voices/tr_TR-fahrettin-medium.onnx` (+`.json`), 63.2 MB, sha256 `39081c47…b190` | NabuCasa voice-datasets — **CC0** | https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium (MODEL_CARD: https://huggingface.co/csukuangfj/vits-piper-tr_TR-fahrettin-medium) |

### İsteğe bağlı indirilen (`<userData>/models/piper/`, boyut + md5/sha256 doğrulamalı)

| Ses | Dil | Lisans (MODEL_CARD) | Ticari kullanım |
|---|---|---|---|
| tr_TR-fettah-medium | Türkçe | CC0 (NabuCasa voice-datasets) | evet |
| tr_TR-dfki-medium | Türkçe | **CC BY-NC-SA 4.0** (marytts/dfki-ot-data) | **hayır** — arayüz `commercial:false` ile uyarmalı; gömülmedi |
| en_US-ljspeech-medium | İngilizce (ABD) | Kamu malı (LJ Speech) | evet |
| en_US-kristin-medium | İngilizce (ABD) | Kamu malı (LibriVox) | evet |
| en_US-bryce-medium | İngilizce (ABD) | Kamu malı | evet |
| en_US-norman-medium | İngilizce (ABD) | Kamu malı (LibriVox) | evet |
| en_US-john-medium | İngilizce (ABD) | Kamu malı (LibriVox) | evet |
| en_US-joe-medium | İngilizce (ABD) | CC0 | evet |
| en_GB-cori-medium | İngilizce (İngiltere) | Kamu malı (LibriVox) | evet |
| en_GB-alba-medium | İngilizce (İngiltere) | CC BY 4.0 (atıf gerekir) | evet |
| de_DE-thorsten-medium | Almanca | CC0 | evet |
| fr_FR-siwis-medium | Fransızca | CC BY 4.0 | evet |
| es_ES-davefx-medium | İspanyolca | CC0 | evet |
| es_MX-claude-high | İspanyolca (MX) | Apache-2.0 | evet |
| ru_RU-denis-medium, ru_RU-dmitri-medium | Rusça | CC0 | evet |
| it_IT-serena-medium | İtalyanca | CC BY 4.0 | evet |
| pt_BR-faber-medium | Portekizce (BR) | CC0 | evet |
| nl_NL-pim-medium | Felemenkçe | CC0 | evet |
| pl_PL-gosia-medium | Lehçe | CC0 | evet |
| uk_UA-ukrainian_tts-medium | Ukraynaca | CC0 | evet |

**Bilerek dışarıda bırakılanlar:** ar_JO-kareem (lisans "See URL", belirsiz), en_US-ryan / hfc_* / l2arctic / semaine,
ru_RU-ruslan (NC), en_GB-northern_english_male / fr_FR-upmc (BY-SA — proje kuralı dışı), fr_FR-tom (AGPL),
ru_RU-irina (lisans "Unknown").

## Windows yerleşik sesleri (yedek)

OneCore (`Windows.Media.SpeechSynthesis`, ör. Türkçe "Microsoft Tolga") ve System.Speech (SAPI5) sesleri işletim
sisteminin parçasıdır; dağıtmıyoruz, yalnız PowerShell üzerinden çağırıyoruz. Bulut / belgelenmemiş TTS uç noktası
KULLANILMIYOR.
