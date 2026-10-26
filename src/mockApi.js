// Tarayıcıda (Electron dışında) arayüzü test etmek için sahte API.
// Gerçek uygulamada window.sweaxcut preload'dan gelir ve bu dosya hiçbir şey yapmaz.

const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

export function installMockIfNeeded() {
  if (window.sweaxcut) return

  let progressCb = null
  let stateCb = null
  let finishCb = null
  let noteCb = null

  window.__SWEAX_MOCK__ = true
  window.sweaxcut = {
    appInfo: async () => ({ version: '1.0.0-mock', platform: 'browser' }),
    chooseFiles: async () => [`C:\\Videolar\\ornek-oyun-kaydı ${Math.floor(Math.random() * 90) + 10}.mp4`],
    chooseFolder: async () => 'C:\\Videolar\\Dönüşenler',
    chooseMusic: async () => 'C:\\Müzik\\fon müziği.mp3',
    scanFolder: async () => ({ ok: true, files: ['C:\\Videolar\\klip1.mp4', 'C:\\Videolar\\klip2.mkv'] }),
    probe: async (input) => ({
      ok: true,
      meta: {
        input, width: 1920, height: 1080, displayWidth: 1920, duration: 63.4, fps: 60,
        videoCodec: 'h264', audioCodec: 'aac', hasAudio: true, sizeBytes: 128 * 1024 * 1024, isVertical: false,
      },
    }),
    detectGpu: async () => true,
    thumbnail: async () => ({ ok: false }),
    startQueue: async (jobs) => {
      ;(async () => {
        for (const job of jobs) {
          stateCb && stateCb({ id: job.id, state: 'processing', output: job.input.replace(/\.\w+$/, '_dikey.mp4') })
          for (let p = 0; p <= 100; p += 4) {
            await new Promise(r => setTimeout(r, 90))
            progressCb && progressCb({ id: job.id, percent: p, fps: 240 + Math.random() * 60, speed: 4 + Math.random(), eta: (100 - p) / 8 })
          }
          stateCb && stateCb({ id: job.id, state: 'done', output: job.input.replace(/\.\w+$/, '_dikey.mp4') })
        }
        finishCb && finishCb({ cancelled: false })
      })()
      return { ok: true }
    },
    cancelQueue: async () => ({ ok: true }),
    getSettings: async () => JSON.parse(localStorage.getItem('sweax-mock-settings') || '{}'),
    setSettings: async (s) => { localStorage.setItem('sweax-mock-settings', JSON.stringify(s)); return true },
    showInFolder: async () => {},
    openFile: async () => {},
    winControl: () => {},
    filePath: () => SAMPLE,
    toFileUrl: () => SAMPLE,
    onJobProgress: (cb) => { progressCb = cb; return () => { progressCb = null } },
    onJobState: (cb) => { stateCb = cb; return () => { stateCb = null } },
    onJobNote: (cb) => { noteCb = cb; return () => { noteCb = null } },
    onQueueFinished: (cb) => { finishCb = cb; return () => { finishCb = null } },
    onWindowState: () => () => {},
  }
}
