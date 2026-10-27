// Geliştirme: vite sunucusuna bağlı Electron (vite ayrı çalışıyor olmalı: npm run dev)
const { spawn } = require('child_process')
const electron = require('electron')
const env = { ...process.env, SWEAXCUT_DEV_URL: process.env.SWEAXCUT_DEV_URL || 'http://localhost:5199/' }
const args = ['.', ...process.argv.slice(2)]
const p = spawn(electron, args, { stdio: 'inherit', env, cwd: require('path').join(__dirname, '..') })
p.on('close', c => process.exit(c))
