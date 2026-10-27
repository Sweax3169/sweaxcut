// MediaPipe Tasks Vision yükleyici — wasm ve modeller public/models/mediapipe altında (çevrimdışı çalışır).
// Paket tembel yüklenir: araç kullanılmadıkça 13 MB'lık wasm hiç açılmaz.

let modP = null
let delegateOk = null // GPU başarısız olursa bir daha deneme

// Model klasörü: uygulama sayfası (index.html) kökte; test sayfaları window.__SWEAX_MODEL_BASE ile verebilir
export function modelBase() {
  if (typeof window !== 'undefined' && window.__SWEAX_MODEL_BASE) return window.__SWEAX_MODEL_BASE
  return new URL('models/mediapipe/', document.baseURI).href
}

async function vision() {
  if (!modP) {
    modP = import('@mediapipe/tasks-vision').then((mod) => {
      const base = modelBase()
      const fileset = { wasmLoaderPath: base + 'wasm/vision_wasm_internal.js', wasmBinaryPath: base + 'wasm/vision_wasm_internal.wasm' }
      return { mod, fileset }
    }).catch((e) => { modP = null; throw e })
  }
  return modP
}

async function withDelegate(make) {
  if (delegateOk !== false) {
    try {
      const r = await make('GPU')
      delegateOk = true
      return { task: r, delegate: 'GPU' }
    } catch (e) {
      console.warn('MediaPipe GPU kullanılamadı, CPU ile devam', e)
      delegateOk = false
    }
  }
  return { task: await make('CPU'), delegate: 'CPU' }
}

// Kişi bölütleyici. landscape: 16:9 benzeri kareler için 256×144 girişli model
export async function createSegmenter({ landscape = false } = {}) {
  const { mod, fileset } = await vision()
  const model = modelBase() + (landscape ? 'selfie_segmenter_landscape.tflite' : 'selfie_segmenter.tflite')
  return withDelegate(delegate => mod.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: model, delegate },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  }))
}

export async function createFaceDetector({ minConfidence = 0.5 } = {}) {
  const { mod, fileset } = await vision()
  return withDelegate(delegate => mod.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelBase() + 'blaze_face_short_range.tflite', delegate },
    runningMode: 'VIDEO',
    minDetectionConfidence: minConfidence,
    minSuppressionThreshold: 0.3,
  }))
}
