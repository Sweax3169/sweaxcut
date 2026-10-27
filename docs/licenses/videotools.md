# Yapay zekâ video araçları (src/features/video) — üçüncü parti bileşenler

| Bileşen | Sürüm | Lisans | Nerede | Boyut |
|---|---|---|---|---|
| `@mediapipe/tasks-vision` (Google) — JS paketi (`vision_bundle.mjs`, Vite ile ayrı parça olarak tembel yüklenir) | 1.1.1 | Apache-2.0 | `node_modules` → derlemede `dist/assets/*` | 156 KB |
| MediaPipe wasm çalışma zamanı (`vision_wasm_internal.js` + `.wasm`; SIMD'li sürüm. `nosimd` ve `module` sürümleri kasıtlı olarak kopyalanmadı) | 1.1.1 | Apache-2.0 | `public/models/mediapipe/wasm/` | 334 KB + 13.5 MB |
| Selfie Segmenter (kare, 256×256, float16) — `selfie_segmenter.tflite` | latest (2026-10) | Apache-2.0 (MediaPipe model kartı) | `public/models/mediapipe/` | 249.5 KB |
| Selfie Segmenter Landscape (144×256, float16) — `selfie_segmenter_landscape.tflite` | latest (2026-10) | Apache-2.0 (MediaPipe model kartı) | `public/models/mediapipe/` | 250.2 KB |
| BlazeFace kısa menzil (128×128, float16) — `blaze_face_short_range.tflite` | latest (2026-10) | Apache-2.0 (MediaPipe model kartı) | `public/models/mediapipe/` | 229.7 KB |
| ffmpeg `libvidstab` (vidstabdetect / vidstabtransform), `libvpx-vp9` | ffmpeg-static 5.x (gyan.dev 6.1.1 essentials) | GPL-2.0+ / BSD (libvpx) — zaten projedeki ffmpeg ikilisi | `node_modules/ffmpeg-static` | — |

Kaynaklar:
- Paket: https://www.npmjs.com/package/@mediapipe/tasks-vision (package.json `"license": "Apache-2.0"`)
- Modeller: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
  `.../selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite`,
  `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`
- Model kartları (Apache-2.0): MediaPipe Selfie Segmentation ve BlazeFace (Short Range) model kartları — ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter ve .../face_detector sayfalarında bağlantılı.

Kurulum boyutu etkisi: ham 14.74 MB (kurulu), NSIS/LZMA ile ≈ 3.3 MB (xz -9e ölçümü: 3,313,116 bayt).

Test varlığı (uygulamaya GİRMEZ): `test-videos/out/videotools/dl/armstrong.jpg` — NASA resmî portresi (Neil Armstrong, 1969),
ABD federal hükümeti eseri olduğundan kamu malı; Wikimedia Commons "File:Neil Armstrong pose.jpg". Yalnızca kişi bölütleme testinde kullanıldı.
