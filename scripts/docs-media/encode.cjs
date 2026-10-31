'use strict'
// drive.cjs'in kaydettiği screencast karelerini (zaman damgalı JPEG) sabit kare hızlı MP4 / GIF'e çevirir.
// Kullanım: node scripts/docs-media/encode.cjs <kare klasörü> <çıkış.mp4|.gif> [--from s] [--to s] [--width px] [--fps n] [--crf n] [--colors n] [--crop w:h:x:y]
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const [dir, out] = process.argv.slice(2)
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d }
const ffmpeg = process.env.FFMPEG || (() => { try { return require('ffmpeg-static') } catch (e) { return 'ffmpeg' } })()
const frames = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'))
const t0 = frames[0].t
const from = arg('from', 0), to = arg('to', Infinity)
const sel = frames.filter(f => f.t - t0 >= from && f.t - t0 <= to)
const lines = []
for (let i = 0; i < sel.length; i++) {
  const d = i + 1 < sel.length ? sel[i + 1].t - sel[i].t : 0.1
  lines.push(`file '${path.join(dir, sel[i].f).replace(/\\/g, '/')}'`, `duration ${Math.max(0.001, d).toFixed(4)}`)
}
lines.push(`file '${path.join(dir, sel[sel.length - 1].f).replace(/\\/g, '/')}'`)
const list = path.join(dir, 'list.txt')
fs.writeFileSync(list, lines.join('\n'))
const width = arg('width', 1280), fps = arg('fps', 30)
const ci = process.argv.indexOf('--crop')
const crop = ci > 0 ? 'crop=' + process.argv[ci + 1] + ',' : ''
let args
if (out.endsWith('.gif')) {
  const colors = arg('colors', 160)
  args = ['-f', 'concat', '-safe', '0', '-i', list, '-vf',
    `${crop}fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${process.env.GIF_DITHER || "bayer:bayer_scale=4"}:diff_mode=rectangle`,
    '-loop', '0', out]
} else {
  args = ['-f', 'concat', '-safe', '0', '-i', list, '-vf', `${crop}fps=${fps},scale=${width}:-2:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(arg('crf', 26)), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]
}
const r = spawnSync(ffmpeg, ['-hide_banner', '-v', 'error', '-y', ...args], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status || 1)
console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB', sel.length + ' kare, ' + (sel[sel.length - 1].t - sel[0].t).toFixed(1) + ' sn')
