# Third-party notices

SWEAXCUT's own source code is released under the MIT License (see [LICENSE](LICENSE)).
The components listed below are not covered by that license. Each keeps its own license and copyright.

FFmpeg, ffprobe and eSpeak NG are GPL programs. SWEAXCUT starts them as separate processes
(`ffmpeg.exe`, `ffprobe.exe`, `piper.exe` which loads `espeak-ng.dll`). It does not link to them.

More detailed notes, in Turkish, are in [`docs/licenses/`](docs/licenses/).

Contents:

- [A. Included in this repository](#a-included-in-this-repository)
- [B. Bundled in the Windows installer, not stored in git](#b-bundled-in-the-windows-installer-not-stored-in-git)
- [C. Downloaded on demand by the user](#c-downloaded-on-demand-by-the-user)
- [D. Made for SWEAXCUT (no third-party assets)](#d-made-for-sweaxcut-no-third-party-assets)
- [E. Notes for publishing](#e-notes-for-publishing)

---

## A. Included in this repository

| Component | Where | License | Link |
|---|---|---|---|
| 101 font families (latin + latin-ext `.woff2` only) | `public/fonts/` | SIL OFL 1.1 (100 families), Apache-2.0 (Luckiest Guy) | Table below |
| Interface fonts: Mona Sans (variable, wdth + wght) and Geist Mono (variable, wght) | bundled by Vite from `@fontsource-variable/mona-sans` 5.3.0 and `@fontsource-variable/geist-mono` 5.3.0 | SIL OFL 1.1 | https://github.com/github/mona-sans · https://github.com/vercel/geist-font · full texts in `docs/licenses/OFL-mona-sans.txt`, `docs/licenses/OFL-geist-mono.txt` |
| Twemoji, 649 emoji SVGs from `@twemoji/svg@15.0.0` | `public/stickers/emoji/` | Graphics: CC-BY 4.0. Code: MIT | https://github.com/jdecked/twemoji |
| gl-transitions 2.0.0, 125 GLSL ES 3.00 transitions | `src/packs/transitions/gl-vendor.json` | MIT (123), BSD-3-Clause (1), BSD-2-Clause (1) | https://github.com/gl-transitions/gl-transitions |
| Material Icons path data (`thumb`, `bell`, `reply`, `eye`, `person`) | `src/packs/stickers/vdef.js` | Apache-2.0 | https://github.com/google/material-design-icons |
| MediaPipe models: `selfie_segmenter.tflite`, `selfie_segmenter_landscape.tflite`, `blaze_face_short_range.tflite` (float16) | `public/models/mediapipe/` | Apache-2.0 (MediaPipe model cards) | https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter |
| Silero VAD v6.2.0, ggml conversion (`ggml-silero-v6.2.0.bin`) | `vendor/whisper/vad/` | MIT, © Silero Team | https://huggingface.co/ggml-org/whisper-vad · https://github.com/snakers4/silero-vad |
| RNNoise model `std.rnnn` (original Xiph RNNoise model) | `vendor/rnnoise/` | BSD-3-Clause, © Xiph.Org | https://github.com/xiph/rnnoise · https://github.com/richardpl/arnndn-models |
| RNNoise models `bd.rnnn` (beguiling-drafter), `sh.rnnn` (somnolent-hogwash) | `vendor/rnnoise/` | The author states the models are not creative work and not subject to copyright | https://github.com/GregorR/rnnoise-models |
| 2D signed distance and Voronoi formulas (`sdBox`, `sdSeg`, `sdHeart`, `sdStar`, `voro`), re-implemented | `src/packs/effects/lib.js`, `src/packs/transitions/` | MIT, after Inigo Quilez's articles (as recorded in `docs/licenses/effects.md`) | https://iquilezles.org/articles/distfunctions2d/ |

### Twemoji attribution

> Emoji graphics: Twemoji, © Twitter, Inc and other contributors, licensed under CC-BY 4.0,
> https://creativecommons.org/licenses/by/4.0/ . Source: https://github.com/jdecked/twemoji

The SVG files are copied unchanged (`src/packs/stickers/copy-emoji.mjs`). The app shows this attribution in
**Yardım → SWEAXCUT hakkında** (Help → About SWEAXCUT).

### gl-transitions

The collection is MIT, Copyright (c) 2017-present gl-transitions contributors. The author and license of every
transition are kept in `gl-vendor.json` (`author`, `license` fields) and listed in
[`docs/licenses/transitions.md`](docs/licenses/transitions.md), which also reproduces the MIT text.

Two transitions use other licenses. Their full license texts are reproduced in
[`docs/licenses/transitions.md`](docs/licenses/transitions.md):

| Transition | License | Copyright |
|---|---|---|
| InvertedPageCurl | BSD-3-Clause | Copyright (c) Hewlett-Packard Development Company, L.P. (webvfx page curl, adapted by Sergey Kosarevsky) |
| StereoViewer | BSD-2-Clause | Copyright (c) 2016, Theodore K Schundler |

Changes: `LumaWipe` and `DisplacementMap` expect an extra texture; their texture lookups are replaced with
procedural noise (`src/packs/transitions/gl-meta.js`, `GL_PATCHES`). The other 123 are unchanged.

### Interface fonts

The app's own interface uses **Mona Sans** (Copyright 2022 The Mona Sans Project Authors, https://github.com/github/mona-sans,
with Reserved Font Name "Mona") and **Geist Mono** (Copyright 2024 The Geist Project Authors, https://github.com/vercel/geist-font).
Both are under the SIL Open Font License 1.1; the full licence texts ship as `licenses/OFL-mona-sans.txt` and
`licenses/OFL-geist-mono.txt`. They are not offered as text fonts for titles in the editor.

### Fonts

All families come from the `@fontsource/*` npm packages (Google Fonts sources). Only the latin and latin-ext
`.woff2` subsets are copied. The license column is the `license` field of each package's `package.json`. Copyright
lines for every family are in [`docs/licenses/fonts.md`](docs/licenses/fonts.md). The `.woff2` files keep their
name-table metadata, which carries the license URL (checked on Anton, Inter, Coiny and Luckiest Guy).

- SIL Open Font License 1.1: https://openfontlicense.org
- Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0

Only one family is not OFL: **Luckiest Guy** (Apache-2.0, Copyright (c) 2010 by Brian J. Bonislawsky DBA
Astigmatic (AOETI)).

| # | Family | License | Source package |
|---:|---|---|---|
| 1 | Abril Fatface | OFL-1.1 | [@fontsource/abril-fatface](https://www.npmjs.com/package/@fontsource/abril-fatface) |
| 2 | Alfa Slab One | OFL-1.1 | [@fontsource/alfa-slab-one](https://www.npmjs.com/package/@fontsource/alfa-slab-one) |
| 3 | Amatic SC | OFL-1.1 | [@fontsource/amatic-sc](https://www.npmjs.com/package/@fontsource/amatic-sc) |
| 4 | Anton | OFL-1.1 | [@fontsource/anton](https://www.npmjs.com/package/@fontsource/anton) |
| 5 | Archivo | OFL-1.1 | [@fontsource/archivo](https://www.npmjs.com/package/@fontsource/archivo) |
| 6 | Archivo Black | OFL-1.1 | [@fontsource/archivo-black](https://www.npmjs.com/package/@fontsource/archivo-black) |
| 7 | Audiowide | OFL-1.1 | [@fontsource/audiowide](https://www.npmjs.com/package/@fontsource/audiowide) |
| 8 | Baloo 2 | OFL-1.1 | [@fontsource/baloo-2](https://www.npmjs.com/package/@fontsource/baloo-2) |
| 9 | Bangers | OFL-1.1 | [@fontsource/bangers](https://www.npmjs.com/package/@fontsource/bangers) |
| 10 | Barlow | OFL-1.1 | [@fontsource/barlow](https://www.npmjs.com/package/@fontsource/barlow) |
| 11 | Barlow Condensed | OFL-1.1 | [@fontsource/barlow-condensed](https://www.npmjs.com/package/@fontsource/barlow-condensed) |
| 12 | Bebas Neue | OFL-1.1 | [@fontsource/bebas-neue](https://www.npmjs.com/package/@fontsource/bebas-neue) |
| 13 | Big Shoulders Display | OFL-1.1 | [@fontsource/big-shoulders-display](https://www.npmjs.com/package/@fontsource/big-shoulders-display) |
| 14 | Black Ops One | OFL-1.1 | [@fontsource/black-ops-one](https://www.npmjs.com/package/@fontsource/black-ops-one) |
| 15 | Bodoni Moda | OFL-1.1 | [@fontsource/bodoni-moda](https://www.npmjs.com/package/@fontsource/bodoni-moda) |
| 16 | Bowlby One SC | OFL-1.1 | [@fontsource/bowlby-one-sc](https://www.npmjs.com/package/@fontsource/bowlby-one-sc) |
| 17 | Bruno Ace SC | OFL-1.1 | [@fontsource/bruno-ace-sc](https://www.npmjs.com/package/@fontsource/bruno-ace-sc) |
| 18 | Bungee | OFL-1.1 | [@fontsource/bungee](https://www.npmjs.com/package/@fontsource/bungee) |
| 19 | Bungee Inline | OFL-1.1 | [@fontsource/bungee-inline](https://www.npmjs.com/package/@fontsource/bungee-inline) |
| 20 | Bungee Outline | OFL-1.1 | [@fontsource/bungee-outline](https://www.npmjs.com/package/@fontsource/bungee-outline) |
| 21 | Bungee Shade | OFL-1.1 | [@fontsource/bungee-shade](https://www.npmjs.com/package/@fontsource/bungee-shade) |
| 22 | Bungee Spice | OFL-1.1 | [@fontsource/bungee-spice](https://www.npmjs.com/package/@fontsource/bungee-spice) |
| 23 | Caveat | OFL-1.1 | [@fontsource/caveat](https://www.npmjs.com/package/@fontsource/caveat) |
| 24 | Caveat Brush | OFL-1.1 | [@fontsource/caveat-brush](https://www.npmjs.com/package/@fontsource/caveat-brush) |
| 25 | Chakra Petch | OFL-1.1 | [@fontsource/chakra-petch](https://www.npmjs.com/package/@fontsource/chakra-petch) |
| 26 | Cinzel | OFL-1.1 | [@fontsource/cinzel](https://www.npmjs.com/package/@fontsource/cinzel) |
| 27 | Coiny | OFL-1.1 | [@fontsource/coiny](https://www.npmjs.com/package/@fontsource/coiny) |
| 28 | Cormorant Garamond | OFL-1.1 | [@fontsource/cormorant-garamond](https://www.npmjs.com/package/@fontsource/cormorant-garamond) |
| 29 | Courgette | OFL-1.1 | [@fontsource/courgette](https://www.npmjs.com/package/@fontsource/courgette) |
| 30 | Dancing Script | OFL-1.1 | [@fontsource/dancing-script](https://www.npmjs.com/package/@fontsource/dancing-script) |
| 31 | Dela Gothic One | OFL-1.1 | [@fontsource/dela-gothic-one](https://www.npmjs.com/package/@fontsource/dela-gothic-one) |
| 32 | DM Serif Display | OFL-1.1 | [@fontsource/dm-serif-display](https://www.npmjs.com/package/@fontsource/dm-serif-display) |
| 33 | Exo 2 | OFL-1.1 | [@fontsource/exo-2](https://www.npmjs.com/package/@fontsource/exo-2) |
| 34 | Fira Code | OFL-1.1 | [@fontsource/fira-code](https://www.npmjs.com/package/@fontsource/fira-code) |
| 35 | Fjalla One | OFL-1.1 | [@fontsource/fjalla-one](https://www.npmjs.com/package/@fontsource/fjalla-one) |
| 36 | Gloria Hallelujah | OFL-1.1 | [@fontsource/gloria-hallelujah](https://www.npmjs.com/package/@fontsource/gloria-hallelujah) |
| 37 | Gluten | OFL-1.1 | [@fontsource/gluten](https://www.npmjs.com/package/@fontsource/gluten) |
| 38 | Grandstander | OFL-1.1 | [@fontsource/grandstander](https://www.npmjs.com/package/@fontsource/grandstander) |
| 39 | Great Vibes | OFL-1.1 | [@fontsource/great-vibes](https://www.npmjs.com/package/@fontsource/great-vibes) |
| 40 | IBM Plex Mono | OFL-1.1 | [@fontsource/ibm-plex-mono](https://www.npmjs.com/package/@fontsource/ibm-plex-mono) |
| 41 | Inter | OFL-1.1 | [@fontsource/inter](https://www.npmjs.com/package/@fontsource/inter) |
| 42 | Jersey 10 | OFL-1.1 | [@fontsource/jersey-10](https://www.npmjs.com/package/@fontsource/jersey-10) |
| 43 | JetBrains Mono | OFL-1.1 | [@fontsource/jetbrains-mono](https://www.npmjs.com/package/@fontsource/jetbrains-mono) |
| 44 | Josefin Sans | OFL-1.1 | [@fontsource/josefin-sans](https://www.npmjs.com/package/@fontsource/josefin-sans) |
| 45 | Kalam | OFL-1.1 | [@fontsource/kalam](https://www.npmjs.com/package/@fontsource/kalam) |
| 46 | Kanit | OFL-1.1 | [@fontsource/kanit](https://www.npmjs.com/package/@fontsource/kanit) |
| 47 | Kaushan Script | OFL-1.1 | [@fontsource/kaushan-script](https://www.npmjs.com/package/@fontsource/kaushan-script) |
| 48 | League Gothic | OFL-1.1 | [@fontsource/league-gothic](https://www.npmjs.com/package/@fontsource/league-gothic) |
| 49 | League Spartan | OFL-1.1 | [@fontsource/league-spartan](https://www.npmjs.com/package/@fontsource/league-spartan) |
| 50 | Lobster | OFL-1.1 | [@fontsource/lobster](https://www.npmjs.com/package/@fontsource/lobster) |
| 51 | Luckiest Guy | **Apache-2.0** | [@fontsource/luckiest-guy](https://www.npmjs.com/package/@fontsource/luckiest-guy) |
| 52 | Manrope | OFL-1.1 | [@fontsource/manrope](https://www.npmjs.com/package/@fontsource/manrope) |
| 53 | Marck Script | OFL-1.1 | [@fontsource/marck-script](https://www.npmjs.com/package/@fontsource/marck-script) |
| 54 | Merriweather | OFL-1.1 | [@fontsource/merriweather](https://www.npmjs.com/package/@fontsource/merriweather) |
| 55 | Modak | OFL-1.1 | [@fontsource/modak](https://www.npmjs.com/package/@fontsource/modak) |
| 56 | Monoton | OFL-1.1 | [@fontsource/monoton](https://www.npmjs.com/package/@fontsource/monoton) |
| 57 | Montserrat | OFL-1.1 | [@fontsource/montserrat](https://www.npmjs.com/package/@fontsource/montserrat) |
| 58 | Nabla | OFL-1.1 | [@fontsource/nabla](https://www.npmjs.com/package/@fontsource/nabla) |
| 59 | Nosifer | OFL-1.1 | [@fontsource/nosifer](https://www.npmjs.com/package/@fontsource/nosifer) |
| 60 | Nunito | OFL-1.1 | [@fontsource/nunito](https://www.npmjs.com/package/@fontsource/nunito) |
| 61 | Oswald | OFL-1.1 | [@fontsource/oswald](https://www.npmjs.com/package/@fontsource/oswald) |
| 62 | Outfit | OFL-1.1 | [@fontsource/outfit](https://www.npmjs.com/package/@fontsource/outfit) |
| 63 | Oxanium | OFL-1.1 | [@fontsource/oxanium](https://www.npmjs.com/package/@fontsource/oxanium) |
| 64 | Pacifico | OFL-1.1 | [@fontsource/pacifico](https://www.npmjs.com/package/@fontsource/pacifico) |
| 65 | Patrick Hand | OFL-1.1 | [@fontsource/patrick-hand](https://www.npmjs.com/package/@fontsource/patrick-hand) |
| 66 | Paytone One | OFL-1.1 | [@fontsource/paytone-one](https://www.npmjs.com/package/@fontsource/paytone-one) |
| 67 | Pirata One | OFL-1.1 | [@fontsource/pirata-one](https://www.npmjs.com/package/@fontsource/pirata-one) |
| 68 | Pixelify Sans | OFL-1.1 | [@fontsource/pixelify-sans](https://www.npmjs.com/package/@fontsource/pixelify-sans) |
| 69 | Playfair Display | OFL-1.1 | [@fontsource/playfair-display](https://www.npmjs.com/package/@fontsource/playfair-display) |
| 70 | Poppins | OFL-1.1 | [@fontsource/poppins](https://www.npmjs.com/package/@fontsource/poppins) |
| 71 | Press Start 2P | OFL-1.1 | [@fontsource/press-start-2p](https://www.npmjs.com/package/@fontsource/press-start-2p) |
| 72 | Rajdhani | OFL-1.1 | [@fontsource/rajdhani](https://www.npmjs.com/package/@fontsource/rajdhani) |
| 73 | Raleway | OFL-1.1 | [@fontsource/raleway](https://www.npmjs.com/package/@fontsource/raleway) |
| 74 | Rammetto One | OFL-1.1 | [@fontsource/rammetto-one](https://www.npmjs.com/package/@fontsource/rammetto-one) |
| 75 | Righteous | OFL-1.1 | [@fontsource/righteous](https://www.npmjs.com/package/@fontsource/righteous) |
| 76 | Roboto | OFL-1.1 | [@fontsource/roboto](https://www.npmjs.com/package/@fontsource/roboto) |
| 77 | Rowdies | OFL-1.1 | [@fontsource/rowdies](https://www.npmjs.com/package/@fontsource/rowdies) |
| 78 | Rubik | OFL-1.1 | [@fontsource/rubik](https://www.npmjs.com/package/@fontsource/rubik) |
| 79 | Rubik Bubbles | OFL-1.1 | [@fontsource/rubik-bubbles](https://www.npmjs.com/package/@fontsource/rubik-bubbles) |
| 80 | Rubik Glitch | OFL-1.1 | [@fontsource/rubik-glitch](https://www.npmjs.com/package/@fontsource/rubik-glitch) |
| 81 | Rubik Spray Paint | OFL-1.1 | [@fontsource/rubik-spray-paint](https://www.npmjs.com/package/@fontsource/rubik-spray-paint) |
| 82 | Rubik Wet Paint | OFL-1.1 | [@fontsource/rubik-wet-paint](https://www.npmjs.com/package/@fontsource/rubik-wet-paint) |
| 83 | Russo One | OFL-1.1 | [@fontsource/russo-one](https://www.npmjs.com/package/@fontsource/russo-one) |
| 84 | Sacramento | OFL-1.1 | [@fontsource/sacramento](https://www.npmjs.com/package/@fontsource/sacramento) |
| 85 | Saira Stencil One | OFL-1.1 | [@fontsource/saira-stencil-one](https://www.npmjs.com/package/@fontsource/saira-stencil-one) |
| 86 | Sedgwick Ave | OFL-1.1 | [@fontsource/sedgwick-ave](https://www.npmjs.com/package/@fontsource/sedgwick-ave) |
| 87 | Sedgwick Ave Display | OFL-1.1 | [@fontsource/sedgwick-ave-display](https://www.npmjs.com/package/@fontsource/sedgwick-ave-display) |
| 88 | Shadows Into Light Two | OFL-1.1 | [@fontsource/shadows-into-light-two](https://www.npmjs.com/package/@fontsource/shadows-into-light-two) |
| 89 | Shrikhand | OFL-1.1 | [@fontsource/shrikhand](https://www.npmjs.com/package/@fontsource/shrikhand) |
| 90 | Space Grotesk | OFL-1.1 | [@fontsource/space-grotesk](https://www.npmjs.com/package/@fontsource/space-grotesk) |
| 91 | Space Mono | OFL-1.1 | [@fontsource/space-mono](https://www.npmjs.com/package/@fontsource/space-mono) |
| 92 | Staatliches | OFL-1.1 | [@fontsource/staatliches](https://www.npmjs.com/package/@fontsource/staatliches) |
| 93 | Syne | OFL-1.1 | [@fontsource/syne](https://www.npmjs.com/package/@fontsource/syne) |
| 94 | Teko | OFL-1.1 | [@fontsource/teko](https://www.npmjs.com/package/@fontsource/teko) |
| 95 | Tektur | OFL-1.1 | [@fontsource/tektur](https://www.npmjs.com/package/@fontsource/tektur) |
| 96 | Tilt Neon | OFL-1.1 | [@fontsource/tilt-neon](https://www.npmjs.com/package/@fontsource/tilt-neon) |
| 97 | Tiny5 | OFL-1.1 | [@fontsource/tiny5](https://www.npmjs.com/package/@fontsource/tiny5) |
| 98 | Unbounded | OFL-1.1 | [@fontsource/unbounded](https://www.npmjs.com/package/@fontsource/unbounded) |
| 99 | VT323 | OFL-1.1 | [@fontsource/vt323](https://www.npmjs.com/package/@fontsource/vt323) |
| 100 | Work Sans | OFL-1.1 | [@fontsource/work-sans](https://www.npmjs.com/package/@fontsource/work-sans) |
| 101 | Yeseva One | OFL-1.1 | [@fontsource/yeseva-one](https://www.npmjs.com/package/@fontsource/yeseva-one) |

---

## B. Bundled in the Windows installer, not stored in git

These files are fetched or copied at build time and packed by electron-builder into
`release/SWEAXCUT-Kurulum-<version>.exe`. They are listed in `.gitignore`.

| Component | Version | Where in the install folder | License | Source / link |
|---|---|---|---|---|
| Electron (includes Chromium, Node.js, V8, and Chromium's `ffmpeg.dll`) | 33.x (33.4.11 in `node_modules`) | install root | Electron: MIT. Chromium and its dependencies: BSD-3-Clause and others; the full list ships as `LICENSES.chromium.html`, Electron's license as `LICENSE.electron.txt` | https://github.com/electron/electron |
| FFmpeg `ffmpeg.exe`, gyan.dev "essentials" static build, via `ffmpeg-static` 5.3.0 | 6.1.1 | `resources/app.asar.unpacked/node_modules/ffmpeg-static/` | **GPL-3.0-or-later**. Build configured with `--enable-gpl --enable-version3`, no `--enable-nonfree`. Includes GPL libraries such as libx264, libx265, librubberband and libvidstab. GPL text ships as `ffmpeg.exe.LICENSE` | Source: https://github.com/FFmpeg/FFmpeg/commit/e38092ef93 · Builds: https://www.gyan.dev/ffmpeg/builds/ · https://github.com/GyanD/codexffmpeg |
| FFprobe `ffprobe.exe` from the same gyan.dev "essentials" build as `ffmpeg.exe` (`ffmpeg-6.1.1-essentials_build.zip`, fetched and SHA-256 checked by `scripts/fetch-ffprobe.cjs`) | 6.1.1 | `resources/vendor/ffprobe/` | **GPL-3.0-or-later**, same build configuration as `ffmpeg.exe`. GPL text ships as `ffprobe.exe.LICENSE`, gyan.dev's build notes as `ffprobe.exe.README` | Source: https://github.com/FFmpeg/FFmpeg/commit/e38092ef93 · Builds: https://www.gyan.dev/ffmpeg/builds/ · https://github.com/GyanD/codexffmpeg/releases/tag/6.1.1 |
| MediaPipe Tasks Vision (`vision_bundle` JS + `vision_wasm_internal.js/.wasm`, SIMD build) | 1.1.1 | `resources/app.asar` (`dist/assets`, `dist/models/mediapipe/wasm`) | Apache-2.0 | https://www.npmjs.com/package/@mediapipe/tasks-vision · https://github.com/google-ai-edge/mediapipe |
| whisper.cpp `whisper-cli.exe`, `whisper.dll`, `ggml*.dll` (9 CPU variants) | 1.9.5, release asset `whisper-blas-bin-x64.zip` (tag `b5454` per `docs/licenses/captions.md`) | `resources/vendor/whisper/bin/` | MIT, © The ggml authors | https://github.com/ggml-org/whisper.cpp |
| OpenBLAS `libopenblas.dll` (from the same whisper.cpp zip) | DYNAMIC_ARCH | `resources/vendor/whisper/bin/` | BSD-3-Clause | https://github.com/OpenMathLib/OpenBLAS |
| Microsoft Visual C++ runtime `msvcp140.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`, `vcomp140.dll` | 14.44.35211 (VS 2022 redist folder) | `resources/vendor/whisper/bin/` | Microsoft Visual Studio license terms, "Distributable Code": may be redistributed with an application, not on its own | https://learn.microsoft.com/visualstudio/releases/2022/redistribution |
| Piper `piper.exe`, `piper_phonemize.dll` | 2023.11.14-2 (`piper_windows_amd64.zip`) | `resources/vendor/piper/` | MIT | https://github.com/rhasspy/piper |
| ONNX Runtime `onnxruntime.dll`, `onnxruntime_providers_shared.dll` (from the Piper zip) | as shipped in the Piper zip | `resources/vendor/piper/` | MIT | https://github.com/microsoft/onnxruntime |
| eSpeak NG, rhasspy fork (`espeak-ng.dll`, `espeak-ng-data/`; dictionaries for unused languages removed, otherwise unmodified) | as shipped in the Piper zip | `resources/vendor/piper/` | **GPL-3.0-or-later** | Source: https://github.com/rhasspy/espeak-ng · https://www.gnu.org/licenses/gpl-3.0.txt |
| Piper voice `tr_TR-fahrettin-medium` (`.onnx` + `.json`, 63.2 MB) | medium | `resources/vendor/piper/voices/` | Dataset: NabuCasa voice-datasets, CC0 | https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium |
| React, ReactDOM | 18.3.1 | bundled into `dist/assets` | MIT | https://github.com/facebook/react |
| immer | 10.2.0 | bundled into `dist/assets` | MIT | https://github.com/immerjs/immer |
| electron-builder NSIS installer stub and `elevate.exe` | electron-builder 25 | installer / `resources/` | NSIS: zlib/libpng license. electron-builder: MIT | https://nsis.sourceforge.io/License · https://github.com/electron-userland/electron-builder |

Notes:

- `whisper-cli.exe` is modified: `activeCodePage = UTF-8` was added to its embedded manifest (Windows SDK
  `mt.exe`) so Turkish characters in paths and prompts reach the program intact. No code was changed. The MIT
  license allows this.
- `ggml-blas.dll` and `libopenblas.dll` are optional; without them whisper.cpp falls back to its plain CPU backend.
- The MediaPipe WASM files (about 13.5 MB) are not stored in git. They are copied from
  `node_modules/@mediapipe/tasks-vision/wasm/` into `public/models/mediapipe/wasm/` by
  `scripts/copy-mediapipe.cjs` when dependencies are installed.
- Piper, its voice and the RNNoise models are fetched by `scripts/fetch-piper.cjs`. The whisper.cpp binaries and the
  Visual C++ runtime DLLs are placed in `vendor/whisper/bin/` by hand (see `docs/licenses/captions.md`).

---

## C. Downloaded on demand by the user

SWEAXCUT does not ship these files. The user downloads them from inside the app. Downloads are checked against
the size and hash recorded in the catalogs.

### Whisper models (`<userData>/models/whisper/`)

Catalog: `src/features/captions/models.js`. Source: https://huggingface.co/ggerganov/whisper.cpp (mirror:
hf-mirror.com).

| Model | File | License |
|---|---|---|
| Tiny | `ggml-tiny-q5_1.bin` | OpenAI Whisper weights: MIT. ggml conversion and quantisation: whisper.cpp, MIT |
| Base | `ggml-base-q5_1.bin` | same |
| Small (default) | `ggml-small-q5_1.bin` | same |
| Medium | `ggml-medium-q5_0.bin` | same |
| Large v3 Turbo | `ggml-large-v3-turbo-q5_0.bin` | same |

Whisper: https://github.com/openai/whisper

### Optional Piper voices (`<userData>/models/piper/`)

Catalog: `src/features/tts/voices.js`. Most files come from https://huggingface.co/rhasspy/piper-voices; the two
Turkish NabuCasa voices come from `speaches-ai` mirrors. Each voice's terms follow the dataset license in its
`MODEL_CARD`.

| Voice | Language | Dataset license | Commercial use |
|---|---|---|---|
| tr_TR-fettah-medium | Turkish | CC0 (NabuCasa voice-datasets) | yes |
| **tr_TR-dfki-medium** | Turkish | **CC BY-NC-SA 4.0** (marytts / dfki-ot-data) | **no** |
| en_US-ljspeech-medium | English (US) | Public domain (LJ Speech) | yes |
| en_US-kristin-medium | English (US) | Public domain (LibriVox) | yes |
| en_US-bryce-medium | English (US) | Public domain | yes |
| en_US-norman-medium | English (US) | Public domain (LibriVox) | yes |
| en_US-john-medium | English (US) | Public domain (LibriVox) | yes |
| en_US-joe-medium | English (US) | CC0 | yes |
| en_GB-cori-medium | English (UK) | Public domain (LibriVox) | yes |
| en_GB-alba-medium | English (UK) | **CC BY 4.0**, attribution required | yes |
| de_DE-thorsten-medium | German | CC0 | yes |
| fr_FR-siwis-medium | French | **CC BY 4.0**, attribution required | yes |
| es_ES-davefx-medium | Spanish | CC0 | yes |
| es_MX-claude-high | Spanish (Mexico) | Apache-2.0 | yes |
| ru_RU-denis-medium | Russian | CC0 | yes |
| ru_RU-dmitri-medium | Russian | CC0 | yes |
| it_IT-serena-medium | Italian | **CC BY 4.0**, attribution required | yes |
| pt_BR-faber-medium | Portuguese (Brazil) | CC0 | yes |
| nl_NL-pim-medium | Dutch | CC0 | yes |
| pl_PL-gosia-medium | Polish | CC0 | yes |
| uk_UA-ukrainian_tts-medium | Ukrainian (3 speakers) | CC0 | yes |

- `tr_TR-dfki-medium` is for non-commercial use only. It is marked `commercial: false` in the catalog and its
  license string says so, but the current interface does not display that flag or the license string (no use of
  either under `src/ui/`). It is not bundled.
- Videos made with `en_GB-alba`, `fr_FR-siwis` or `it_IT-serena` need attribution to the dataset authors.
- Many Piper "medium" voices were fine-tuned from the "lessac" checkpoint, whose dataset (Blizzard Challenge 2013)
  has a research licence. The Piper project publishes the fine-tuned voices under the licence of the fine-tuning
  dataset, and the catalog follows that. This only matters for the optional downloads above; it was not verified
  offline whether the bundled Fahrettin voice also started from that checkpoint (its model card lists only the CC0
  dataset).
- Voices left out on purpose (unclear, non-commercial, share-alike or AGPL terms) are listed in
  [`docs/licenses/audio.md`](docs/licenses/audio.md).

### Windows voices

The Windows OneCore voices (for example "Microsoft Tolga") and SAPI5 voices are part of the operating system.
SWEAXCUT calls them through PowerShell and does not distribute them. No cloud or undocumented text-to-speech
endpoint is used.

---

## D. Made for SWEAXCUT (no third-party assets)

These are covered by SWEAXCUT's MIT license. Counts are taken from the app's content registry
(`src/engine/registry.js`) at runtime.

| Content | Count | How it is made |
|---|---:|---|
| Sound effects | 102 | Procedural synthesis in `OfflineAudioContext` (oscillators, noise, filters, envelopes, generated reverb). No samples or recordings (`src/packs/sfx/`) |
| Music tracks | 22 | Procedural synthesis, original melodies and chord progressions (`src/packs/music/`) |
| Video effects | 161 | Original GLSL; particles and textures are generated in the shader (`src/packs/effects/`) |
| Colour filters | 93 | Original GLSL (`src/packs/filters/`) |
| Custom transitions | 72 | Original GLSL (`src/packs/transitions/custom-*.js`); the other 125 transitions are gl-transitions (section A) |
| Animated vector stickers | 117 | Hand-coded drawings (`src/packs/stickers/vec-*.js`), apart from the five Material Icons paths in section A |
| Shape stickers | 11 | Hand-coded |

Vector stickers draw text with the app's own bundled fonts (section A) or system fonts; the sticker pack contains
no font files.

---

## E. Notes for publishing

- **No blocker found.** Every asset in the repository and in the installer allows redistribution under its
  license, with the conditions below. The only non-commercial asset in the catalogs (`tr_TR-dfki-medium`) is
  downloaded by the user and never redistributed.
- **GPL (FFmpeg, FFprobe, eSpeak NG).** The installer contains GPL binaries. Their license texts ship with them
  (`ffmpeg.exe.LICENSE`, `ffprobe.exe.LICENSE`; `vendor/piper/NOTICE.txt` names eSpeak NG's licence and source).
  Put the source links from section B into the GitHub release notes as the written source offer.
- **FFprobe.** Since 2.0.2, `ffprobe.exe` comes from the same gyan.dev 6.1.1 build as `ffmpeg.exe`, so one source
  link covers both. Up to 2.0.1 the installer carried `ffprobe-static` 3.1.0, a 2018 Zeranoe build of FFprobe
  4.0.2; its source is https://ffmpeg.org/releases/ffmpeg-4.0.2.tar.xz.
- **Notices in the installer.** `package.json` copies `LICENSE`, this file and `docs/licenses/` into the install
  folder (`extraResources`), so the whisper.cpp (MIT) and OpenBLAS (BSD) notices, the font licenses, the Twemoji
  CC-BY attribution and the gl-transitions BSD texts ship as files. Every published installer includes them.
- **Twemoji.** Keep the CC-BY 4.0 attribution (above) in the README, the website and the app's About dialog.
- **Visual C++ runtime DLLs** stay out of git (`vendor/whisper/bin/` is ignored). They are only redistributed
  inside the installer, next to `whisper-cli.exe`.
- **Code signing.** The installer is not signed. This is not a licensing issue, but Windows SmartScreen may warn.
