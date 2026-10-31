<a href="https://sweax3169.github.io/sweaxcut/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/art/banner-en-dark.svg">
    <img alt="SWEAXCUT: a free video editor for Windows. Captions, voice-over and the AI tools run on your PC, without the internet." src="docs/art/banner-en-light.svg" width="100%">
  </picture>
</a>

<p align="center">
  <a href="https://github.com/Sweax3169/sweaxcut/releases/latest"><b>Download for Windows</b></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://sweax3169.github.io/sweaxcut/">Website</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="README.tr.md">Türkçe</a>
</p>

<p align="center">
  <a href="https://github.com/Sweax3169/sweaxcut/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Sweax3169/sweaxcut?label=release&color=3FA9F5"></a>
  <a href="https://github.com/Sweax3169/sweaxcut/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Sweax3169/sweaxcut/total?color=121518"></a>
  <img alt="Windows 10 and 11, 64-bit" src="https://img.shields.io/badge/Windows-10%20%7C%2011%20%C2%B7%2064--bit-121518">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2EE6A6"></a>
</p>

<br>

<p align="center">
  <img alt="The SWEAXCUT editor playing a 16:9 project: the title GECE SÜRÜŞÜ animates in, a cross-zoom transition cuts to the next clip, then the transitions browser opens and a new transition is applied" src="docs/media/tour.gif" width="900">
</p>
<p align="center"><sub>One project played in the editor: an animated title, a cross-zoom cut, then a new transition picked from the browser. <a href="docs/media/tour.mp4">Watch the full 32-second tour (MP4)</a>.</sub></p>

<br>

## What it is

SWEAXCUT is a video editor for Windows, made by Sweax Studios for people who cut gameplay clips, Shorts and YouTube videos. It has a multi-track timeline with a GPU preview, a large library of effects, transitions, text styles, stickers, music and sound effects, automatic captions, text to speech and a set of AI tools. All of it runs on your own computer, the speech recognition and the voices included.

It is free to use and puts no watermark on what you export. There is no account to create.

> [!NOTE]
> The interface is in Turkish. Captions can be generated in 12 languages, and the downloadable voices cover 10.

<br>

## What is inside

<table>
<tr>
<td width="33%" valign="top">
<img alt="Transitions browser: 197 transitions with previews" src="docs/art/panel-transitions.webp" width="100%">
<h3>197 transitions</h3>
<p>Whips, zooms, light bursts, glitches, 3D cubes and shape reveals. 125 come from gl-transitions, 72 were written for SWEAXCUT.</p>
</td>
<td width="33%" valign="top">
<img alt="Effects browser with 161 effects" src="docs/art/panel-effects.webp" width="100%">
<h3>161 effects</h3>
<p>VHS, CRT, film grain, glitch, weather, light leaks, camera shake, game-style frames. Put one on a clip or on its own layer.</p>
</td>
<td width="33%" valign="top">
<img alt="Text templates browser with 126 templates" src="docs/art/panel-text.webp" width="100%">
<h3>126 text templates</h3>
<p>101 fonts that all contain the Turkish letters, 88 text animations, outlines, shadow, glow, a background box and curved text.</p>
</td>
</tr>
<tr>
<td width="33%" valign="top">
<img alt="Automatic captions panel: source, language, model and caption styles" src="docs/art/panel-captions.webp" width="100%">
<h3>Automatic captions</h3>
<p>whisper.cpp turns speech into word-timed captions on your PC, with 45 caption styles, keyword highlights and emoji.</p>
</td>
<td width="33%" valign="top">
<img alt="Text-to-speech panel with the bundled Turkish voice Fahrettin" src="docs/art/panel-voice.webp" width="100%">
<h3>Text to speech</h3>
<p>Piper voices that work offline, with a Turkish voice in the installer. The voices built into Windows can be used too.</p>
</td>
<td width="33%" valign="top">
<img alt="Sticker browser with 777 stickers" src="docs/art/panel-stickers.webp" width="100%">
<h3>777 stickers</h3>
<p>649 Twemoji emoji, 117 animated vector stickers (subscribe buttons, health bars, kill counters, comic bursts) and 11 shapes.</p>
</td>
</tr>
<tr>
<td width="33%" valign="top">
<img alt="Music library with 22 tracks synthesised by the app" src="docs/art/panel-audio.webp" width="100%">
<h3>Music and sound effects</h3>
<p>22 music tracks and 102 sound effects, all synthesised by the app. 40 voice changers, noise reduction and ducking.</p>
</td>
<td width="33%" valign="top">
<img alt="AI tools panel: cut silences, captions, highlights, beats" src="docs/art/panel-tools.webp" width="100%">
<h3>AI tools</h3>
<p>Background removal, stabilisation, auto reframe, scene detection, silence cutting, highlight finding and beat detection.</p>
</td>
<td width="33%" valign="top">
<img alt="Colour filter browser with 93 filters" src="docs/art/panel-filters.webp" width="100%">
<h3>Colour</h3>
<p>93 colour filters, light and colour controls, and HSL adjustments for eight colour ranges. The light and colour sliders can be keyframed.</p>
</td>
</tr>
</table>

<br>

## Counted from the code

These numbers come from the content registry of the running app (`src/engine/registry.js`, version 2.0.1), not from a feature list.

| | Count | Detail |
|---|---:|---|
| <img src="https://img.shields.io/badge/-%20-FFD23F?style=flat-square" alt=""> Effects | **161** | 11 categories, from basic and gaming to glitch, retro and weather |
| <img src="https://img.shields.io/badge/-%20-3FA9F5?style=flat-square" alt=""> Transitions | **197** | 12 categories · 125 from gl-transitions, 72 original |
| <img src="https://img.shields.io/badge/-%20-3FA9F5?style=flat-square" alt=""> Colour filters | **93** | 8 categories |
| <img src="https://img.shields.io/badge/-%20-3FA9F5?style=flat-square" alt=""> Clip animations | **137** | 46 in · 56 out · 35 loop |
| <img src="https://img.shields.io/badge/-%20-3FA9F5?style=flat-square" alt=""> Speed curves | **22** | 5 categories |
| <img src="https://img.shields.io/badge/-%20-3FA9F5?style=flat-square" alt=""> Layouts | **13** | facecam with gameplay, split screen, cinema bars and more |
| <img src="https://img.shields.io/badge/-%20-FF5DA2?style=flat-square" alt=""> Text templates | **126** | 10 categories |
| <img src="https://img.shields.io/badge/-%20-FF5DA2?style=flat-square" alt=""> Text animations | **88** | 36 in · 28 out · 24 loop |
| <img src="https://img.shields.io/badge/-%20-FF5DA2?style=flat-square" alt=""> Caption styles | **45** | 6 categories |
| <img src="https://img.shields.io/badge/-%20-FF5DA2?style=flat-square" alt=""> Fonts | **101** | 7 groups, each checked for all 12 Turkish letters |
| <img src="https://img.shields.io/badge/-%20-B98CFF?style=flat-square" alt=""> Stickers | **777** | 649 emoji · 117 animated vector · 11 shapes |
| <img src="https://img.shields.io/badge/-%20-2EE6A6?style=flat-square" alt=""> Sound effects | **102** | 8 categories, synthesised in the app |
| <img src="https://img.shields.io/badge/-%20-2EE6A6?style=flat-square" alt=""> Music tracks | **22** | 10 genres, synthesised in the app |
| <img src="https://img.shields.io/badge/-%20-2EE6A6?style=flat-square" alt=""> Voice changers | **40** | 6 categories |
| Easing curves | **38** | for keyframes (`src/core/easing.js`) |
| Blend modes | **24** | `src/engine/shaders.js` |
| Mask shapes | **8** | linear, mirror, circle, rectangle, heart, star, diamond, hexagon |
| Aspect ratios | **9** | 9:16, 16:9, 1:1, 4:5, 3:4, 4:3, 21:9, 2:1, 2.35:1 |

<br>

## Editing

<p align="center">
  <img alt="A 16:9 project: the transitions browser on the left, a Cross Zoom transition half-way through in the preview, its settings on the right, and the timeline with effect, text, sticker, video and music tracks" src="docs/media/transitions.png" width="100%">
</p>

<table>
<tr>
<td width="50%" valign="top"><img alt="Text style inspector next to the title GECE SÜRÜŞÜ on the preview" src="docs/media/text.png" width="100%"></td>
<td width="50%" valign="top"><img alt="A VHS effect layer over the tunnel clip with its intensity and speed settings" src="docs/media/effects.png" width="100%"></td>
</tr>
<tr>
<td valign="top"><sub>Text templates and the style inspector: outline, second outline, shadow, glow, background box.</sub></td>
<td valign="top"><sub>An effect on its own layer changes everything under it for as long as the layer lasts.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img alt="Animated sticker Abone Ol over the aurora clip with position and opacity settings" src="docs/media/stickers.png" width="100%"></td>
<td width="50%" valign="top"><img alt="Colour filters and light controls for the blocks clip" src="docs/media/filters.png" width="100%"></td>
</tr>
<tr>
<td valign="top"><sub>Stickers are clips like any other: move, scale, animate, blend.</sub></td>
<td valign="top"><sub>A colour filter with an intensity slider, followed by light, colour and HSL controls.</sub></td>
</tr>
</table>

- **Timeline.** The main track is magnetic, so its clips stay butted together; overlays, text, stickers, effects and audio go on their own tracks. Split, trim from either side, ripple delete, copy, duplicate, markers and an in/out range.
- **Keyframes** on position, scale, rotation, opacity, volume, colour and effect parameters, with 38 easing curves.
- **Speed** from 0.1× to 100× on a logarithmic slider, 22 speed curves, reverse, freeze frame and pitch preservation.
- **Masks, blending, keying.** 8 mask shapes with feather, rounded corners and invert, 24 blend modes, and a chroma key with spill control.
- **Projects** in 9 aspect ratios at 24, 25, 30, 50 or 60 fps. 13 one-click layouts arrange a facecam and gameplay for vertical video.
- **Heavy recordings** (formats the preview cannot play, anything above 1440p, long keyframe intervals) get a light preview copy in the background, and you can keep editing while it is being made.

<br>

## Captions and voice

<table>
<tr>
<td width="34%" valign="top" align="center">
<img alt="Vertical clip with automatic captions highlighted word by word" src="docs/media/captions.gif" width="288">
</td>
<td width="66%" valign="top">
<img alt="9:16 project with automatic captions on the timeline and the caption style inspector" src="docs/media/captions.png" width="100%">
<p><sub>The voice in this clip was made by the bundled Piper voice "Fahrettin", and whisper.cpp made the captions from it on the same PC. One misheard word was corrected in the caption word editor, the way you would fix it yourself.</sub></p>
</td>
</tr>
</table>

**Automatic captions** use [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (v1.9.5, BLAS build), started as a separate process. Every word gets its own timing, so the caption styles can highlight the word being spoken. Captions can be made from the main track, from selected clips or from the voice-over track, in 12 languages or with automatic language detection. Filler words can be marked on the timeline. Subtitle files can be imported as SRT, VTT or ASS, and exported as SRT.

The speech model is downloaded the first time you make captions and then stays on your disk:

| Model | Size | |
|---|---:|---|
| Tiny | 32 MB | fastest |
| Base | 60 MB | fast |
| **Small** | **190 MB** | **default, recommended for Turkish** |
| Medium | 539 MB | more accurate |
| Large v3 Turbo | 574 MB | most accurate |

<p align="center">
  <img alt="Text-to-speech panel with Turkish and other voices, and the voice-over tab of a caption clip" src="docs/media/voice.png" width="100%">
</p>

**Text to speech** uses [Piper](https://github.com/rhasspy/piper). The Turkish voice *Fahrettin* comes with the installer, and 21 more voices in 10 languages can be downloaded inside the app. The voices built into Windows (OneCore and SAPI, for example *Microsoft Tolga*) are in the same list. Any text clip can be voiced from its own inspector tab; the voice-over lands on an audio track under it. You can also record from a microphone.

<br>

## AI tools

<p align="center">
  <img alt="Tools panel with silence cutting, captions, highlights, beats, scene detection and stabilisation; the colour inspector is open on the right" src="docs/media/tools.png" width="100%">
</p>

| Tool | What it does | How |
|---|---|---|
| Remove background | Separates a person from the background without a green screen | MediaPipe Selfie Segmenter, on the GPU with a CPU fallback |
| Stabilise | Smooths shaky footage and zooms in slightly to hide the edges | ffmpeg vidstab, two passes |
| Auto reframe | Turns 16:9 into 9:16 (or the other way) while following the subject | MediaPipe face detection, or motion when there is no face |
| Split into scenes | Cuts a clip at every scene change | ffmpeg scene detection |
| Find highlights | Marks sudden loud moments (hits, explosions, shouts) and can add zooms | short-term loudness against the clip's baseline |
| Zoom punch | Adds a short, hard zoom at the playhead | keyframes |
| Cut silences | Finds pauses in speech and removes them | ffmpeg silencedetect |
| Find beats | Marks the beats of the music so cuts snap to them | onset detection and beat tracking |
| Split for Shorts | Splits a long video into equal parts or around its highlights | timeline markers |
| Even out loudness | Brings every clip to the same loudness | ffmpeg loudnorm, applied on export |
| Chroma key | Removes a green screen, or any other colour | compositor shader |

<br>

## Export and GPU acceleration

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/art/pipeline-en-dark.svg">
    <img alt="Export pipeline: one ffmpeg decoder per clip, YUV planes uploaded to the GPU, the same WebGL2 compositor as the preview, BT.709 YUV 4:2:0 packing on the GPU, asynchronous read-back, then NVENC, AMF, Quick Sync or a CPU encoder; the audio is mixed to WAV in parallel and muxed into the file" src="docs/art/pipeline-en-light.svg" width="760">
  </picture>
</p>

The preview and the export are drawn by the same WebGL2 compositor (`src/engine/compositor.js`), so what you see while editing is what ends up in the file. During export each clip is decoded frame-accurately by its own ffmpeg process, every frame is composited and converted to YUV on the graphics card, and only then read back and handed to the encoder.

A few seconds after the app starts, it runs a tiny test encode with each hardware encoder that ffmpeg lists (NVIDIA NVENC, AMD AMF, Intel Quick Sync) and remembers the result for three days. *Automatic* in the export dialog uses the first one that works and the CPU otherwise.

<table>
<tr>
<td width="62%" valign="top"><img alt="Export dialog: file name, folder, format, resolution, frame rate, quality, codec, hardware and audio quality" src="docs/media/export.png" width="100%"></td>
<td width="38%" valign="top"><img alt="Export in progress at 96 frames per second, frame 143 of 960" src="docs/media/export-progress.png" width="100%">
<p><sub>Measured on one machine (RTX 4070 SUPER, development build): the 32-second 1080p30 project in these screenshots, with four clips, three transitions, a title, a sticker, an effect layer and music, exported in <b>12.5 s</b> with <code>h264_nvenc</code>. <a href="docs/media/export-sample.mp4">See the exported video</a> (re-encoded to 960 px for the web).</sub></p>
</td>
</tr>
</table>

| | Options |
|---|---|
| Formats | MP4, MOV, WebM, GIF, and audio only as MP3 or WAV |
| Video codecs | H.264, HEVC (H.265), AV1, VP9, ProRes |
| Hardware encoders | NVIDIA NVENC, AMD AMF, Intel Quick Sync, for H.264, HEVC and AV1 where the card supports them |
| CPU encoders | x264, x265, libaom AV1, libvpx VP9, ProRes (prores_ks) |
| Resolution | project size, 480p, 720p, 1080p, 2K, 4K |
| Frame rate | 24, 25, 30, 50, 60 |
| Quality | Low, Medium, High, Maximum |
| Audio | AAC (MP4, MOV), Opus (WebM), MP3 or WAV; 128 to 320 kbps for compressed audio |
| Colour | BT.709, tagged in the file |

<br>

## Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| <kbd>Space</kbd> | Play / pause | <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> | Shuttle back, stop, forward |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> or <kbd>S</kbd> | Split at the playhead | <kbd>←</kbd> <kbd>→</kbd> | One frame back / forward |
| <kbd>Q</kbd> / <kbd>W</kbd> | Trim left / right of the playhead | <kbd>Shift</kbd>+<kbd>←</kbd> <kbd>→</kbd> | One second back / forward |
| <kbd>Delete</kbd> | Delete | <kbd>↑</kbd> <kbd>↓</kbd> | Previous / next cut |
| <kbd>Shift</kbd>+<kbd>Delete</kbd> | Ripple delete | <kbd>Home</kbd> <kbd>End</kbd> | Start / end |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Undo / redo | <kbd>I</kbd> <kbd>O</kbd> | Range in / out |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd> | Copy, cut, paste | <kbd>M</kbd> | Add a marker |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate | <kbd>T</kbd> | Add text |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | Select all | <kbd>Alt</kbd>+<kbd>K</kbd> | Add a scale keyframe |
| <kbd>Esc</kbd> | Clear the selection and range | <kbd>[</kbd> <kbd>]</kbd> | Previous / next keyframe |
| <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>−</kbd> | Zoom the timeline | <kbd>N</kbd> | Snapping on / off |
| <kbd>Shift</kbd>+<kbd>Z</kbd> | Fit the timeline | <kbd>F</kbd> | Full-screen preview |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save | <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open a project |
| <kbd>Ctrl</kbd>+<kbd>E</kbd> | Export | <kbd>Ctrl</kbd>+<kbd>I</kbd> | Import media |

With the mouse: <kbd>Ctrl</kbd> or <kbd>Alt</kbd> + wheel zooms the timeline, <kbd>Shift</kbd> + wheel scrolls between tracks, <kbd>Alt</kbd> + wheel over the preview scales the selected clip, holding <kbd>Shift</kbd> while dragging turns snapping off for that drag, and <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>9</kbd> switches the inspector tabs. The list is also in the app under **Yardım → Klavye kısayolları**.

<br>

## Privacy

SWEAXCUT does its work on your computer. Your videos are not uploaded anywhere, there is no account, and the code has no analytics, telemetry or update check.

The app goes online in two situations, and only when you start them:

| When | From | What |
|---|---|---|
| You make captions with a speech model that is not on your disk yet | `huggingface.co/ggerganov/whisper.cpp`, then the `hf-mirror.com` mirror if that fails twice | the model file, checked against its size and SHA-256 |
| You choose a Piper voice that is not installed yet | `huggingface.co` (`rhasspy/piper-voices`, `speaches-ai`) | the voice model and its config, checked against its size and checksum |

Everything else, including the MediaPipe models, fonts, stickers, music and sound effects, comes with the installer.

<br>

## Where your files live

| What | Where |
|---|---|
| Projects (`.sweax`) | `Documents\SWEAXCUT\Projeler` |
| Autosave, every 45 seconds | `%APPDATA%\SWEAXCUT\autosave\` (offered back on the start screen after a crash) |
| Preview copies, waveforms, thumbnails | `%APPDATA%\SWEAXCUT\cache\` and `thumbs\` |
| Downloaded speech models and voices | `%APPDATA%\SWEAXCUT\models\` |
| Exports | `Videos\SWEAXCUT`, or any folder you pick in the export dialog |
| The program | `%LOCALAPPDATA%\Programs\sweaxcut` |

A project remembers where your media files are, so moving them breaks the link. Uninstalling keeps everything in `%APPDATA%\SWEAXCUT`.

<br>

## Install

<p align="center">
  <img alt="Start screen: choose an aspect ratio, open a project or pick a video" src="docs/media/home.png" width="430">
</p>

1. Download `SWEAXCUT-Kurulum-2.0.1.exe` (about 207 MB) from the [latest release](https://github.com/Sweax3169/sweaxcut/releases/latest).
2. Run it. It installs for your user account only, adds desktop and Start menu shortcuts, registers `.sweax` project files and opens the app.
3. On the start screen, pick an aspect ratio (9:16 for Shorts, TikTok and Reels, 16:9 for YouTube) and drop a video onto the window.

> [!IMPORTANT]
> The installer is not code-signed, so Windows SmartScreen may show a blue warning the first time. Click **More info**, then **Run anyway**.

**Requirements:** 64-bit Windows 10 or 11 and a graphics card with WebGL 2. A hardware video encoder (NVIDIA, AMD or Intel) makes exports faster but is not required.

<br>

## Build from source

```bash
git clone https://github.com/Sweax3169/sweaxcut.git
cd sweaxcut
npm install                # also copies the MediaPipe wasm runtime into public/ (scripts/copy-mediapipe.cjs)
npm run prepare:vendor     # downloads Piper, the bundled Turkish voice and the RNNoise models into vendor/
```

whisper.cpp is not fetched by a script. Put the files from `whisper-blas-bin-x64.zip` of the [`b5454` release](https://github.com/ggml-org/whisper.cpp/releases/tag/b5454) and the Microsoft Visual C++ runtime DLLs (`msvcp140.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`, `vcomp140.dll`) into `vendor/whisper/bin/`. None of these binaries are kept in git; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

```bash
npm run dev                # Vite dev server on port 5199
npm run start:dev          # Electron window connected to it
npm run dist               # production build and NSIS installer in release/
```

The images in this README come from the real app. `scripts/docs-media/footage.html` renders the sample footage from original GLSL scenes, `drive.cjs` opens the app with a throw-away profile and drives it over the Chrome DevTools Protocol, `encode.cjs` turns the recorded frames into the MP4 and GIFs, and `readme-art.cjs` draws the banner and the pipeline diagram.

<br>

## Project structure

```
sweaxcut/
├─ electron/main.cjs        main process: window, file dialogs, paths
├─ src/
│  ├─ core/                 project model, undo store, timeline operations, keyframes, easing, media import
│  ├─ engine/               WebGL2 compositor, shaders, playback, audio engine, text and sticker rendering
│  │  └─ export/            decoders, GPU YUV packing, encoder selection, audio mix
│  ├─ features/             captions (whisper.cpp), tts (Piper, Windows voices), video (AI tools), audio (analysis)
│  ├─ packs/                effects, transitions, filters, text, fonts, stickers, sfx, music, speed curves, voice fx, layouts
│  ├─ platform/node.js      the only place the interface touches Node
│  └─ ui/                   start screen, editor, library, inspector, timeline, preview
├─ public/                  fonts, Twemoji SVGs, MediaPipe models
├─ vendor/                  Piper, RNNoise models, whisper.cpp (binaries not in git)
├─ scripts/                 vendor download, app drivers for tests and for the documentation media
├─ dev/                     test pages for each content pack
├─ docs/                    website, README art, screenshots, licence notes
└─ legacy/                  source of version 1 (vertical video converter)
```

<br>

## Credits and licences

SWEAXCUT is made by **Sweax Studios** and builds on these open projects:

- **[Twemoji](https://github.com/jdecked/twemoji)**: emoji graphics © Twitter, Inc and other contributors, licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **[gl-transitions](https://github.com/gl-transitions/gl-transitions)**: 125 of the transitions (MIT; two of them BSD).
- **[whisper.cpp](https://github.com/ggml-org/whisper.cpp)** (MIT) with the OpenAI Whisper models (MIT) and Silero VAD (MIT) for captions.
- **[Piper](https://github.com/rhasspy/piper)** (MIT) and eSpeak NG (GPL-3.0) for text to speech. The bundled *Fahrettin* voice is CC0; the optional *dfki* Turkish voice is CC BY-NC-SA 4.0 and may not be used commercially.
- **[FFmpeg](https://ffmpeg.org)** (GPL-3.0 build by gyan.dev), run as a separate program for decoding, encoding, stabilisation and audio filters.
- **[MediaPipe](https://github.com/google-ai-edge/mediapipe)** (Apache-2.0) for background removal and face detection.
- **[Electron](https://www.electronjs.org)**, **[React](https://react.dev)** and **[Vite](https://vite.dev)** (MIT).
- **101 font families** from Google Fonts through Fontsource: 100 under the SIL Open Font License, Luckiest Guy under Apache-2.0.

Every bundled component with its licence and source is listed in **[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)**. The effects, filters, 72 of the transitions, the vector stickers, the music and the sound effects were made for SWEAXCUT and use no third-party assets.

## License

The SWEAXCUT source code is released under the [MIT License](LICENSE). © 2026 Sweax Studios.
