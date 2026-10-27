// Test sunucusu: HMR kapalı (başka ajanlar dosya düzenlerken sayfa kendiliğinden yenilenmesin)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5201, strictPort: true, hmr: false, watch: null },
})
