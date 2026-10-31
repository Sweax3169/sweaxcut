'use strict'
// MediaPipe wasm çalışma zamanını node_modules'tan public/models/mediapipe/wasm/ altına kopyalar.
// 13.5 MB'lık .wasm git'te tutulmuyor; `npm install` (postinstall) ve `npm run dist` bunu çalıştırır.
// Kaynak: @mediapipe/tasks-vision (Apache-2.0). Yalnız SIMD'li sürüm gerekir (bkz. src/features/video/mp.js).

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const DST = path.join(ROOT, 'public', 'models', 'mediapipe', 'wasm')
const FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']

if (!fs.existsSync(SRC)) {
  console.warn('copy-mediapipe: ' + SRC + ' yok, atlandı (önce npm install)')
  process.exit(0)
}
fs.mkdirSync(DST, { recursive: true })
for (const f of FILES) {
  const a = path.join(SRC, f)
  const b = path.join(DST, f)
  const same = fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size
  if (!same) fs.copyFileSync(a, b)
}
console.log('copy-mediapipe: tamam')
