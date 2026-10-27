# Otomatik altyazı — lisans notları

Kapsam: `src/features/captions/`, `vendor/whisper/`, `scripts/test-captions.cjs`.

## Uygulamayla gelen dosyalar (`vendor/whisper/`, kurulumda `resources/vendor/whisper/`)

| Dosya | Sürüm / kaynak | Lisans |
|---|---|---|
| `bin/whisper-cli.exe`, `bin/whisper.dll`, `bin/ggml.dll`, `bin/ggml-base.dll`, `bin/ggml-cpu-*.dll` (9 işlemci çeşidi) | whisper.cpp v1.9.5, GitHub sürüm etiketi `b5454`, `whisper-bin-x64.zip` (sha256 `6ba69e34…16ccb`) — https://github.com/ggml-org/whisper.cpp | MIT, © The ggml authors |
| `bin/msvcp140.dll`, `bin/vcruntime140.dll`, `bin/vcruntime140_1.dll`, `bin/vcomp140.dll` | Microsoft Visual C++ 2015–2022 çalışma zamanı 14.44.35211 (VS 2022 `VC\Redist\MSVC\14.44.35112\x64`) | Microsoft yeniden dağıtılabilir kod (Visual Studio lisansı, "Distributable Code"); uygulama yanında dağıtım. VC++ yüklü olmayan bilgisayarlarda whisper-cli'nin açılması için. |
| `vad/ggml-silero-v6.2.0.bin` | Silero VAD v6.2.0, ggml dönüşümü — https://huggingface.co/ggml-org/whisper-vad (sha256 `2aa269b7…6987`) | MIT, © Silero Team |

`whisper-cli.exe` değiştirildi: gömülü manifeste `activeCodePage = UTF-8` eklendi (Windows SDK `mt.exe`), böylece
Türkçe karakterli yollar ve istemler (prompt) bozulmadan iletilir. Orijinal exe sha256 `331dba46…4366`, yamalı `db750391…43c8`.
Kod değişikliği yok; MIT lisansı değişikliğe izin verir.

## Kullanıcının indirdiği modeller (`<userData>/models/whisper/`)

| Model | Dosya | Kaynak | Lisans |
|---|---|---|---|
| tiny / base / small / medium / large-v3-turbo | `ggml-*-q5_1.bin`, `ggml-*-q5_0.bin` | https://huggingface.co/ggerganov/whisper.cpp (ggml dönüşümü + nicemleme) | Ağırlıklar: OpenAI Whisper, MIT. Dönüşüm: whisper.cpp, MIT |

Dosya boyutları ve sha256 değerleri `src/features/captions/models.js` içindeki katalogda; indirme sonunda doğrulanır.

## Kod
Bütün JS kodu SWEAXCUT için yazıldı. npm paketi kurulmadı. whisper.cpp yalnızca ayrı süreç olarak (`whisper-cli.exe`) çalıştırılır.
