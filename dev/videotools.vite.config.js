// Uzun süren video araçları testi için ayrı geliştirme sunucusu (HMR kapalı): başka ekip üyeleri dosya
// değiştirdikçe sayfa yeniden yüklenip yarım kalan ffmpeg süreçleri bırakmasın.
// Kullanım (kökte): npx vite --config dev/videotools.vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  server: { port: 5198, strictPort: true, hmr: false },
})
