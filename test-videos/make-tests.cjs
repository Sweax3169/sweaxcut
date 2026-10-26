'use strict'
// Test videoları üretir: gerçekçi senaryolar (Türkçe ad, farklı codec, dikey video)
const { spawnSync } = require('child_process')
const path = require('path')
const ffmpeg = require('ffmpeg-static')

const dir = __dirname

function make(args, out) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-v', 'error', '-y', ...args, path.join(dir, out)], { encoding: 'utf8' })
  console.log(out, '->', r.status === 0 ? 'OK' : 'FAIL: ' + r.stderr)
}

// 1) Standart oyun kaydı benzeri: 1920x1080 60fps h264 + aac ses, 8 sn
make([
  '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60:duration=8',
  '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=8',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest',
], 'oyun kaydı çılgın şölen.mp4')

// 2) mkv + opus ses (ses re-encode yolu test edilsin), 30fps, 6 sn
make([
  '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=6',
  '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=6',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-c:a', 'libopus', '-b:a', '128k', '-shortest',
], 'klip_opus.mkv')

// 3) Zaten dikey video (fit mantığı ters yönde çalışmalı), 5 sn, sessiz
make([
  '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30:duration=5',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
], 'dikey_sessiz.mp4')

// 4) Ultrawide 21:9 (agresif oran), 5 sn
make([
  '-f', 'lavfi', '-i', 'testsrc2=size=2560x1080:rate=30:duration=5',
  '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=44100:duration=5',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-shortest',
], 'ultrawide.mov')

// 5) Bozuk dosya (hata mesajı testi)
require('fs').writeFileSync(path.join(dir, 'bozuk.mp4'), Buffer.from('bu bir video degildir, sadece cop veridir'.repeat(100)))
console.log('bozuk.mp4 -> OK (kasıtlı bozuk)')
