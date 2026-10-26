'use strict'
// SWEAXCUT motor testi: 3 mod × gerçek render + ffprobe doğrulama
const path = require('path')
const fs = require('fs')
const ff = require('../electron/ffmpeg.cjs')

const dir = __dirname
const outDir = path.join(dir, 'out')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

const results = []

function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra || '' })
  console.log((cond ? '  ✔ ' : '  ✘ ') + name + (extra ? ` (${extra})` : ''))
}

async function verifyOutput(name, outPath, srcMeta, expectAudio) {
  const m = await ff.probe(outPath)
  check(`${name}: çözünürlük 1080x1920`, m.width === 1080 && m.height === 1920, `${m.width}x${m.height}`)
  check(`${name}: süre korunmuş`, Math.abs(m.duration - srcMeta.duration) < 0.6, `${m.duration.toFixed(2)}s / kaynak ${srcMeta.duration.toFixed(2)}s`)
  check(`${name}: video codec h264`, m.videoCodec === 'h264', m.videoCodec)
  if (expectAudio) {
    check(`${name}: ses akışı var`, m.hasAudio, m.audioCodec || 'yok')
  }
  const size = fs.statSync(outPath).size
  check(`${name}: dosya boyutu makul`, size > 50 * 1024, `${(size / 1024 / 1024).toFixed(1)} MB`)
  return m
}

async function convert(label, input, opts, useGpu) {
  const meta = await ff.probe(input)
  const out = path.join(outDir, label + '.mp4')
  if (fs.existsSync(out)) fs.unlinkSync(out)
  let lastP = 0
  const t0 = Date.now()
  await ff.convertOne(meta, opts, out, p => { lastP = p.percent }, {}, useGpu)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`  → ${label}: ${secs} sn (girdi ${meta.duration.toFixed(1)} sn, ${(meta.duration / (secs)).toFixed(1)}× gerçek zaman)`)
  return { meta, out }
}

async function main() {
  console.log('ffmpeg:', ff.ffmpegPath)
  console.log('ffprobe:', ff.ffprobePath)

  // ---- GPU tespiti
  const gpu = await ff.detectNvenc()
  check('NVENC tespiti (RTX 4070 SUPER bekleniyor)', gpu === true, String(gpu))

  const kaynak = path.join(dir, 'oyun kaydı çılgın şölen.mp4')

  // ---- MOD 1: Blur Dolgu (GPU)
  console.log('\n[MOD 1] Blur Dolgu — GPU, Türkçe dosya adı')
  {
    const { meta, out } = await convert('blur_gpu', kaynak, { mode: 'blur', blurStrength: 55, bgDarken: 35, quality: 18 }, true)
    await verifyOutput('blur_gpu', out, meta, true)
  }

  // ---- MOD 1: Blur Dolgu (CPU fallback yolu)
  console.log('\n[MOD 1b] Blur Dolgu — CPU (libx264 fallback)')
  {
    const { meta, out } = await convert('blur_cpu', kaynak, { mode: 'blur', blurStrength: 55, bgDarken: 35, quality: 18 }, false)
    await verifyOutput('blur_cpu', out, meta, true)
  }

  // ---- MOD 2: Akıllı Zoom
  console.log('\n[MOD 2] Akıllı Zoom — odak sağda, 1.2× zoom')
  {
    const { meta, out } = await convert('zoom_gpu', kaynak, { mode: 'zoom', focusX: 0.8, focusY: 0.5, zoom: 1.2, quality: 18 }, true)
    await verifyOutput('zoom_gpu', out, meta, true)
  }

  // ---- MOD 3: Üst-Alt Düzen (Türkçe yazılar!)
  console.log('\n[MOD 3] Üst-Alt Düzen — Türkçe yazı + renk')
  {
    const { meta, out } = await convert('panel_gpu', kaynak, {
      mode: 'panel', panelColor: '#2d1436', topText: 'ŞÖLEN BAŞLIYOR! 🔥', bottomText: 'Beğenmeyi unutma 💜',
      textColor: '#ffffff', fontSize: 76, videoPos: 0.3, quality: 18,
    }, true)
    await verifyOutput('panel_gpu', out, meta, true)
  }

  // ---- MOD 3b: Panel + canvas overlay PNG (yeni birincil yol)
  console.log('\n[MOD 3b] Üst-Alt Düzen — overlay PNG girişi')
  {
    const ovPng = path.join(dir, 'overlay_test.png')
    await ff.run(ff.ffmpegPath, ['-hide_banner', '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red@0.4:s=1080x1920:d=0.1,format=rgba',
      '-frames:v', '1', ovPng])
    check('overlay PNG üretildi', fs.existsSync(ovPng))
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, 'panel_overlay.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'panel', panelColor: '#2d1436', overlayPngPath: ovPng, videoPos: 0.3, quality: 21 }, out, () => {}, {}, true)
    await verifyOutput('panel_overlay', out, meta, true)
  }

  // ---- mkv + opus (ses re-encode zorunlu)
  console.log('\n[SES] mkv+opus → aac re-encode')
  {
    const { meta, out } = await convert('opus_blur', path.join(dir, 'klip_opus.mkv'), { mode: 'blur', quality: 21 }, true)
    const m = await verifyOutput('opus_blur', out, meta, true)
    check('opus→aac dönüşmüş', m.audioCodec === 'aac', m.audioCodec)
  }

  // ---- Dikey kaynak (fit ters yön)
  console.log('\n[KENAR] Zaten dikey video — blur dolgu yanlarda')
  {
    const { meta, out } = await convert('dikey_blur', path.join(dir, 'dikey_sessiz.mp4'), { mode: 'blur', quality: 21 }, true)
    await verifyOutput('dikey_blur', out, meta, false)
  }

  // ---- Ultrawide
  console.log('\n[KENAR] Ultrawide 21:9')
  {
    const { meta, out } = await convert('ultrawide_blur', path.join(dir, 'ultrawide.mov'), { mode: 'blur', quality: 21 }, true)
    await verifyOutput('ultrawide_blur', out, meta, true)
  }

  // ---- YENİ ÖZELLİKLER: kesme, hız, müzik, renk filtresi
  console.log('\n[ÖZELLİK] Kesme (trim 2-6 sn)')
  {
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, 'trim.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'blur', quality: 21, trim: { start: 2, end: 6 } }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check('trim: süre ~4 sn', Math.abs(m.duration - 4) < 0.35, `${m.duration.toFixed(2)}s`)
    check('trim: çözünürlük', m.width === 1080 && m.height === 1920, `${m.width}x${m.height}`)
  }

  console.log('\n[ÖZELLİK] Hız ×1.5 (video + ses birlikte)')
  {
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, 'hiz.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'blur', quality: 21, speed: 1.5 }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check('hız: süre ~5.33 sn', Math.abs(m.duration - 8 / 1.5) < 0.4, `${m.duration.toFixed(2)}s`)
    check('hız: ses korunmuş', m.hasAudio, m.audioCodec)
  }

  console.log('\n[ÖZELLİK] Müzik miksi (kısa müzik döngüde)')
  {
    const music = path.join(dir, 'muzik.mp3')
    await ff.run(ff.ffmpegPath, ['-hide_banner', '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=44100:duration=3',
      '-c:a', 'libmp3lame', '-b:a', '128k', music])
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, 'muzik_miks.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'blur', quality: 21, musicPath: music, musicVolume: 80, origVolume: 90 }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check('müzik: süre video kadar (döngü kesildi)', Math.abs(m.duration - meta.duration) < 0.5, `${m.duration.toFixed(2)}s`)
    check('müzik: ses aac', m.audioCodec === 'aac', m.audioCodec)
  }

  console.log('\n[ÖZELLİK] Müzik — sessiz videoya')
  {
    const meta = await ff.probe(path.join(dir, 'dikey_sessiz.mp4'))
    const out = path.join(outDir, 'muzik_sessiz.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'blur', quality: 21, musicPath: path.join(dir, 'muzik.mp3'), musicVolume: 100 }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check('sessiz+müzik: ses eklendi', m.hasAudio, m.audioCodec || 'yok')
    check('sessiz+müzik: süre video kadar', Math.abs(m.duration - meta.duration) < 0.5, `${m.duration.toFixed(2)}s / ${meta.duration.toFixed(2)}s`)
  }

  console.log('\n[ÖZELLİK] Renk filtreleri')
  for (const cf of ['canli', 'sinematik', 'sicak', 'soguk', 'siyahbeyaz']) {
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, `filtre_${cf}.mp4`)
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, { mode: 'blur', quality: 24, colorFilter: cf, trim: { start: 0, end: 2 } }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check(`filtre ${cf}: render OK`, m.width === 1080 && m.height === 1920, `${m.duration.toFixed(1)}s`)
  }

  console.log('\n[ÖZELLİK] Kombine: trim + hız + müzik + filtre + panel yazı')
  {
    const meta = await ff.probe(kaynak)
    const out = path.join(outDir, 'kombine.mp4')
    if (fs.existsSync(out)) fs.unlinkSync(out)
    await ff.convertOne(meta, {
      mode: 'blur', quality: 21,
      trim: { start: 1, end: 7 }, speed: 1.25,
      musicPath: path.join(dir, 'muzik.mp3'), musicVolume: 70, origVolume: 110,
      colorFilter: 'canli',
    }, out, () => {}, {}, true)
    const m = await ff.probe(out)
    check('kombine: süre ~4.8 sn (6 sn / 1.25)', Math.abs(m.duration - 6 / 1.25) < 0.5, `${m.duration.toFixed(2)}s`)
    check('kombine: ses var', m.hasAudio, m.audioCodec)
  }

  // ---- Bozuk dosya: anlaşılır Türkçe hata
  console.log('\n[HATA] Bozuk dosya')
  try {
    await ff.probe(path.join(dir, 'bozuk.mp4'))
    check('bozuk dosya reddedildi', false)
  } catch (e) {
    const msg = ff.turkceHata(String(e.message))
    check('bozuk dosya reddedildi', true, msg)
  }

  // ---- Ses birebir kopya doğrulaması (aac → copy)
  console.log('\n[SES] aac kaynak → stream copy (birebir)')
  {
    const src = await ff.probe(kaynak)
    const out = await ff.probe(path.join(outDir, 'blur_gpu.mp4'))
    check('ses codec aac korunmuş', out.audioCodec === 'aac', out.audioCodec)
  }

  const fails = results.filter(r => !r.ok)
  console.log(`\n===== SONUÇ: ${results.length - fails.length}/${results.length} test geçti =====`)
  if (fails.length) {
    console.log('BAŞARISIZ:')
    fails.forEach(f => console.log('  ✘ ' + f.name + ' — ' + f.extra))
    process.exit(1)
  }
}

main().catch(e => { console.error('TEST ÇÖKTÜ:', e); process.exit(1) })
