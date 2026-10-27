import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'chrome128',
    chunkSizeWarningLimit: 8000,
  },
  server: {
    port: 5199,
    strictPort: true,
  },
})
