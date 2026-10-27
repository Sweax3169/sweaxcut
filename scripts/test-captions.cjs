// Otomatik altyazı testleri (Node). Kullanım:
//   node scripts/test-captions.cjs                 → birim testleri + kurulu varsayılan modelle entegrasyon
//   node scripts/test-captions.cjs --models=all    → kurulu bütün modellerle süre/doğruluk ölçümü
//   node scripts/test-captions.cjs --download      → model indirme + yarıda kesip devam ettirme testi (tiny, base)
//   node scripts/test-captions.cjs --unit          → yalnız birim testleri (ikili/model gerekmez)
// Çıktılar: test-videos/out/captions/
'use strict'
const path = require('path')
const fs = require('fs')
const os = require('os')
const cp = require('child_process')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'test-videos', 'out', 'captions')
const ARGS = process.argv.slice(2)
const flag = (k) => ARGS.find(a => a === '--' + k || a.startsWith('--' + k + '='))
const flagVal = (k, d) => { const a = flag(k); return a && a.includes('=') ? a.split('=')[1] : d }

// platform/node.js window.require bekler: Node'da küçük bir dolgu (electron yerine boş ipc)
globalThis.window = { require: m => (m === 'electron' ? { ipcRenderer: null } : require(m)) }
process.removeAllListeners('warning') // "type": "module" uyarısını sustur
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href)

let pass = 0, fail = 0
const fails = []
function ok(cond, name, extra) {
  if (cond) { pass++; return true }
  fail++; fails.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : ''))
  return false
}
function near(a, b, eps = 0.0011) { return Math.abs(a - b) <= eps }
function section(t) { console.log('\n== ' + t) }

const TR_TEXT = `Arkadaşlar merhaba, kanala tekrar hoş geldiniz! Bugün sizlerle yepyeni bir oyuna başlıyoruz. İlk bölümde haritayı keşfedeceğiz, sonra da boss savaşına gireceğiz. Bakalım bu sefer kazanabilecek miyiz?

Tamam, şimdi sağ taraftaki köprüden geçiyoruz. Dikkat edin, orada bir sniper var. Hemen eğiliyorum. Ateş! Ateş! Vurdum onu, çok güzel oldu.

Şimdi biraz para toplamamız lazım. Yüz elli altın ile yeni bir kılıç alabiliriz. Ama önce şu sandığı açalım. Vay be, efsanevi bir zırh çıktı! İnanılmaz şanslıyız.

Evet arkadaşlar, boss geliyor. Canım az kaldı, iksir içiyorum. Kaçın, kaçın! Hayır, öldüm galiba. Yok yok, son anda kurtuldum. Haydi, son vuruş!

Kazandık! GG arkadaşlar, gerçekten kral gibi oynadık. Videoyu beğendiyseniz abone olmayı ve bildirimleri açmayı unutmayın. Bir sonraki bölümde görüşmek üzere, hoşça kalın!`

// Windows OneCore TTS (tr-TR "Tolga" varsa) + kelime sınırı zamanları (doğruluk ölçümü için)
const TTS_PS = String.raw`param([string]$TextFile, [string]$Out, [string]$Json, [string]$Lang = 'tr-TR')
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$g = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Await($op, $type) { $t = $g.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq $Lang } | Select-Object -First 1
if ($v) { $s.Voice = $v }
$s.Options.IncludeWordBoundaryMetadata = $true
$text = [IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8)
$st = Await ($s.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$r = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0))
$n = Await ($r.LoadAsync([uint32]$st.Size)) ([uint32])
$b = New-Object byte[] $n
$r.ReadBytes($b)
[IO.File]::WriteAllBytes($Out, $b)
$w = @()
foreach ($tr in $st.TimedMetadataTracks) { foreach ($c in $tr.Cues) { $w += [pscustomobject]@{ w = $c.Text; s = $c.StartTime.TotalSeconds } } }
[IO.File]::WriteAllText($Json, ($w | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
Write-Output ("ses: " + $s.Voice.DisplayName + " (" + $s.Voice.Language + ")")
`

function makeTts(wav, json) {
  if (fs.existsSync(wav) && fs.existsSync(json)) return true
  const txt = path.join(OUT, 'tr-tts.txt')
  const ps1 = path.join(os.tmpdir(), 'sweaxcut-tts.ps1')
  fs.writeFileSync(txt, TR_TEXT, 'utf8')
  fs.writeFileSync(ps1, TTS_PS, 'utf8')
  const r = cp.spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-TextFile', txt, '-Out', wav, '-Json', json], { encoding: 'utf8' })
  console.log('  ' + (r.stdout || '').trim(), (r.stderr || '').trim().slice(0, 300))
  return fs.existsSync(wav)
}

const normW = s => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '')
function wer(ref, hyp) {
  const a = ref.split(/\s+/).map(normW).filter(Boolean), b = hyp.split(/\s+/).map(normW).filter(Boolean)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length] / a.length
}
function timingError(words, truth) {
  let j = 0
  const errs = []
  for (const w of words) {
    const n = normW(w.w)
    for (let k = j; k < Math.min(truth.length, j + 4); k++) if (normW(truth[k].w) === n) { errs.push(w.s - truth[k].s); j = k + 1; break }
  }
  if (!errs.length) return null
  const abs = errs.map(Math.abs).sort((x, y) => x - y)
  return { matched: errs.length, median: abs[abs.length >> 1], p90: abs[Math.floor(abs.length * 0.9)], bias: errs.reduce((x, y) => x + y, 0) / errs.length }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const env = await imp('src/features/captions/env.js')
  const userData = flagVal('userdata', path.join(process.env.APPDATA || os.homedir(), 'SWEAXCUT'))
  env.setCaptionEnv({ vendor: path.join(ROOT, 'vendor'), userData, ffmpeg: require(path.join(ROOT, 'node_modules', 'ffmpeg-static')) })
  const C = await imp('src/features/captions/index.js')
  const model = await imp('src/core/model.js')
  const timeline = await imp('src/core/timeline.js')

  // ================================================================ birim testleri
  section('Belirteç → kelime (Türkçe bayt birleştirme)')
  {
    const L = s => Buffer.from(s, 'utf8').toString('latin1') // whisper JSON'u latin1 okunmuş gibi
    const sh = Buffer.from('ş', 'utf8') // 2 bayt: ayrı belirteçlere bölünmüş hali
    const toks = [
      { text: '[_BEG_]', id: 50364, offsets: { from: 0, to: 0 }, p: 1 },
      { text: L(' Ar'), id: 1, offsets: { from: 100, to: 200 }, p: 0.9 },
      { text: L('kada'), id: 2, offsets: { from: 200, to: 400 }, p: 0.9 },
      { text: String.fromCharCode(sh[0]), id: 3, offsets: { from: 400, to: 450 }, p: 0.9 },
      { text: String.fromCharCode(sh[1]) + 'lar', id: 4, offsets: { from: 450, to: 600 }, p: 0.9 },
      { text: ',', id: 11, offsets: { from: 600, to: 900 }, p: 0.9 },
      { text: L(' İstanbul'), id: 5, offsets: { from: 1000, to: 1400 }, p: 0.9 },
      { text: "'", id: 6, offsets: { from: 1400, to: 1450 }, p: 0.9 },
      { text: L('a'), id: 7, offsets: { from: 1450, to: 1500 }, p: 0.9 },
      { text: L(' "'), id: 8, offsets: { from: 1500, to: 1500 }, p: 0.9 },
      { text: L('Gel'), id: 9, offsets: { from: 1500, to: 1700 }, p: 0.9 },
      { text: L('!"'), id: 10, offsets: { from: 1700, to: 1900 }, p: 0.9 },
      { text: L(' -'), id: 12, offsets: { from: 1900, to: 1950 }, p: 0.9 },
      { text: L(' 1'), id: 13, offsets: { from: 2000, to: 2100 }, p: 0.9 },
      { text: L('50'), id: 14, offsets: { from: 2100, to: 2300 }, p: 0.9 },
      { text: L(' altın.'), id: 15, offsets: { from: 2300, to: 2700 }, p: 0.9 },
      { text: '[_TT_150]', id: 50514, offsets: { from: 2700, to: 2700 }, p: 0.1 },
    ]
    const ws = C.tokensToWords(toks)
    const txt = ws.map(w => w.w)
    console.log('  ' + JSON.stringify(txt))
    ok(JSON.stringify(txt) === JSON.stringify(['Arkadaşlar,', "İstanbul'a", '"Gel!"', '150', 'altın.']), 'kelimeler doğru birleşti (ş bölünmesi, kesme, tırnak, tire, sayı)', JSON.stringify(txt))
    ok(near(ws[0].s, 0.1) && near(ws[0].e, 0.6), 'virgül kelime bitişini uzatmaz', `${ws[0].s}-${ws[0].e}`)
    ok(!txt.join(' ').includes('�'), 'bozuk harf yok')
    const json = { result: { language: 'tr' }, transcription: [
      { offsets: { from: 0, to: 2700 }, text: '', tokens: toks },
      { offsets: { from: 3000, to: 5000 }, text: ' Altyazı M.K.', tokens: [{ text: L(' Alt'), id: 1, offsets: { from: 3000, to: 3500 }, p: 0.4 }, { text: L('yazı M.K.'), id: 2, offsets: { from: 3500, to: 5000 }, p: 0.4 }] },
    ] }
    const buf = Buffer.from(JSON.stringify(json), 'latin1')
    const r = C.parseWhisperJson(buf, { offset: 10 })
    ok(r.segments.length === 1, 'uydurma "Altyazı M.K." segmenti atıldı', r.segments.length)
    ok(near(r.segments[0].words[0].s, 10.1), 'aralık ofseti eklendi', r.segments[0].words[0].s)
  }

  section('Emoji sözlüğü ve vurgu')
  {
    console.log('  sözlük girdisi: ' + C.EMOJI_COUNT)
    ok(C.EMOJI_COUNT >= 300, 'en az 300 girdi', C.EMOJI_COUNT)
    const cases = { 'öldüm': '💀', 'Öldük!': '💀', 'öldürdüm': '🔪', 'kazandık': '🏆', 'Kazandık!': '🏆', 'paraları': '💰', 'ateş': '🔥', 'boss': '👹', 'bossu': '👹', 'gg': '🤝', 'sniper': '🎯', 'kral': '👑', 'krallar': '👑', 'efsanevi': '🌟', 'evet': '✅', 'İstanbul\'a': null, 'kurtuldum': null, 'biraz': null, 'kolay': null, 'büyük': null, 'arkadaşlar': null, 'win': '🏆', 'headshot': '🎯' }
    for (const [w, e] of Object.entries(cases)) ok(C.autoEmoji(w) === e, `autoEmoji(${w}) = ${e}`, C.autoEmoji(w))
    ok(C.isKeyword('150') && C.isKeyword('Ateş!') && C.isKeyword('sniper') && C.isKeyword('GG') && !C.isKeyword('masa'), 'vurgu: sayı, ünlem, oyun terimi, büyük harf')
  }

  // örnek döküm (elle)
  const W = (w, s, e) => ({ w, s, e })
  const sample = { language: 'tr', segments: [
    { start: 0, end: 3.2, text: '', words: [W('Arkadaşlar', 0.1, 0.9), W('merhaba,', 0.9, 1.6), W('kanala', 1.7, 2.1), W('tekrar', 2.1, 2.5), W('hoş', 2.5, 2.7), W('geldiniz!', 2.7, 3.2)] },
    { start: 3.9, end: 6.4, text: '', words: [W('Bugün', 3.9, 4.2), W('yepyeni', 4.2, 4.7), W('bir', 4.7, 4.9), W('oyuna', 4.9, 5.3), W('başlıyoruz.', 5.3, 6.4)] },
    { start: 7, end: 9, text: '', words: [W('ıı', 7.0, 7.3), W('şey', 7.4, 7.6), W('bir', 7.7, 7.8), W('şey', 7.8, 8.0), W('ee', 8.1, 8.3), W('150', 8.3, 8.6), W('altın!', 8.6, 9.0)] },
  ] }

  section('Gruplama ve klip üretimi')
  {
    const clips = C.buildCaptionClips(sample, { maxWords: 3, maxChars: 24, emoji: true, uppercase: true, styleId: 'test' })
    for (const c of clips) console.log(`  ${c.start.toFixed(2)}-${(c.start + c.duration).toFixed(2)}  ${c.text.content}  ${c.caption.emoji || ''}  [${c.caption.words.map(w => w.w + (w.emphasis ? '*' : '')).join(' ')}]`)
    ok(clips.every(c => c.caption.words.length <= 4), 'ifade başına en fazla maxWords(+1 yetim)')
    ok(clips.every((c, i) => i === 0 || clips[i - 1].start + clips[i - 1].duration <= c.start + 1e-6), 'klipler çakışmıyor')
    ok(clips.some(c => c.text.content.includes('İ') || c.text.content.includes('ĞİNİZ')), 'Türkçe büyük harf (i → İ)')
    ok(clips.every(c => c.caption.words.every(w => w.s >= 0 && w.e <= c.duration + 1e-6)), 'kelime zamanları klip içinde')
    ok(!clips.some(c => /GELDİNİZ! BUGÜN/.test(c.text.content)), 'cümle sonunda bölündü')
    ok(clips.some(c => c.caption.words.some(w => w.w === '150' && w.emphasis)), 'sayı vurgulandı')
    ok(clips.every(c => c.type === 'text' && c.caption.groupId === clips[0].caption.groupId && c.name === 'Altyazı'), 'klip biçimi (text + caption.groupId)')
    // medya klibi eşlemesi: zaman çizelgesinde 10. sn, kaynak 2..8, 2x hız
    const mc = { start: 10, duration: 3, in: 2, out: 8, speed: 2 }
    ok(near(C.sourceToTimeline(mc, 4), 11), 'kaynak→zaman çizelgesi (hız 2x)', C.sourceToTimeline(mc, 4))
    const clipped = C.buildCaptionClips(sample, { mediaClip: mc, maxWords: 4 })
    ok(clipped.length > 0 && clipped[0].start >= 10 - 1e-6 && clipped[clipped.length - 1].start + clipped[clipped.length - 1].duration <= 13 + 1e-6, 'klip dışındaki kelimeler atıldı, kalanlar eşlendi', clipped.map(c => c.start).join(','))
    const curve = { start: 0, duration: 4, in: 0, out: 4, speed: 1, speedCurve: { id: 'x', points: [{ x: 0, y: 0.5 }, { x: 1, y: 2 }] } }
    const tl = C.sourceToTimeline(curve, 2)
    const back = (await imp('src/core/time.js')).sourceTime(curve, tl)
    ok(near(back, 2, 0.01), 'hız eğrisinde ters eşleme', `${tl} → ${back}`)
    // projeye yerleştir
    const p = model.createProject()
    const n0 = p.tracks.length
    const tid = C.insertCaptions(p, clips)
    const tr = p.tracks.find(t => t.id === tid)
    ok(tr && tr.kind === 'text' && tr.name === 'Altyazı' && p.tracks[0] === tr && p.tracks.length === n0 + 1, '"Altyazı" izi en üstte açıldı')
    ok(tr.clips.every(c => timeline.isFree({ clips: tr.clips.filter(x => x !== c) }, c.start, c.duration)), 'izde çakışma yok')
    const tid2 = C.insertCaptions(p, C.buildCaptionClips(sample, { offset: 20 }))
    ok(tid2 === tid, 'boş aralıkta aynı "Altyazı" izi yeniden kullanıldı')
    // kütüphane akışı: iki ardışık ana iz klibinin altyazıları tek insertCaptions çağrısında
    {
      const r2 = { language: 'tr', segments: [{ start: 0, end: 4, words: [W('son', 2.0, 2.3), W('kelime', 2.3, 2.95)] }, { start: 4, end: 8, words: [W('ilk', 3.0, 3.2), W('söz', 3.2, 3.5)] }] }
      const mA = { start: 0, duration: 3, in: 0, out: 3, speed: 1 }   // kaynak 0–3 → zaman 0–3
      const mB = { start: 3, duration: 2, in: 3, out: 5, speed: 1 }   // kaynak 3–5 → zaman 3–5
      const a = C.buildCaptionClips(r2, { mediaClip: mA, minDuration: 1.5 })
      const b = C.buildCaptionClips(r2, { mediaClip: mB })
      ok(a.every(c => c.start + c.duration <= 3 + 1e-6), 'altyazı kaynak klibin sonunu aşmıyor', a.map(c => c.start + '+' + c.duration).join(','))
      const pp = model.createProject()
      const both = [...b, ...a]
      both[0].start = 2.8 // yapay çakışma
      const tid3 = C.insertCaptions(pp, both)
      const tt = pp.tracks.find(t => t.id === tid3)
      ok(tt.clips.every((c, i) => i === 0 || tt.clips[i - 1].start + tt.clips[i - 1].duration <= c.start + 1e-6), 'çok kaynaklı eklemede çakışmalar çözüldü', tt.clips.map(c => c.start + '+' + c.duration).join(','))
      ok(tt.clips.every(c => c.caption.words.every(w => w.e <= c.duration + 1e-6 && w.s < w.e)), 'kırpılan klibin kelimeleri de kırpıldı')
    }
    const gid = clips[0].caption.groupId
    C.removeCaptions(p, gid)
    ok(!p.tracks.some(t => t.clips.some(c => c.caption && c.caption.groupId === gid)), 'grup silindi')
    const re = C.captionsToResult(clips)
    ok(re.segments.length === clips.length && near(re.segments[0].words[0].s, clips[0].start + clips[0].caption.words[0].s), 'kliplerden yeniden döküm (yeniden gruplama için)')
  }

  section('Dolgu kelimeleri')
  {
    const f = C.findFillers(sample, 'tr')
    console.log('  ' + JSON.stringify(f.map(x => x.w)))
    ok(JSON.stringify(f.map(x => x.w)) === JSON.stringify(['ıı', 'şey', 'ee']), '"ıı", "şey", "ee" bulundu; "bir şey" atlandı', JSON.stringify(f.map(x => x.w)))
    const soft = C.findFillers({ segments: [{ words: [W('yani', 0, 0.3), W('you', 0.4, 0.5), W('know', 0.5, 0.7), W('uhh', 0.8, 1), W('ıııım', 1, 1.4)] }] }, 'tr', { soft: true })
    ok(soft.some(x => x.w === 'yani' && x.soft) && soft.some(x => x.w === 'ıııım'), 'yumuşak dolgu + uzatmalı ses', JSON.stringify(soft))
    const en = C.findFillers({ segments: [{ words: [W('so', 0, 0.2), W('um,', 0.2, 0.5), W('you', 0.6, 0.7), W('know', 0.7, 0.9), W('like', 1, 1.2)] }] }, 'en', { soft: true })
    ok(en.length === 3 && en[1].w === 'you know', 'İngilizce: um, "you know", like', JSON.stringify(en.map(x => x.w)))
    const cuts = C.fillerCutRanges(f)
    ok(cuts.length >= 1 && cuts.every(r => r.end > r.start), 'kesim aralıkları', JSON.stringify(cuts))
  }

  section('SRT / VTT / ASS / TXT')
  {
    const clips = C.buildCaptionClips(sample, { maxWords: 3 })
    const p = model.createProject()
    C.insertCaptions(p, clips)
    const srt = C.exportSubtitles(p, 'srt')
    const back = C.importSubtitles(srt, { format: 'srt' })
    ok(back.length === clips.length, 'SRT gidiş-dönüş: klip sayısı', `${back.length}/${clips.length}`)
    ok(back.every((c, i) => near(c.start, clips[i].start) && near(c.duration, clips[i].duration, 0.002) && c.text.content === clips[i].text.content), 'SRT gidiş-dönüş: zaman ve metin')
    const vtt = C.exportSubtitles(p, 'vtt', { karaoke: true })
    const vb = C.importSubtitles(vtt, { format: 'vtt' })
    ok(vb.length === clips.length && vb.every((c, i) => c.caption.words.every((w, k) => near(c.start + w.s, clips[i].start + clips[i].caption.words[k].s))), 'VTT karaoke: kelime zamanları korundu')
    const ass = C.exportSubtitles(p, 'ass', { karaoke: true })
    const ab = C.importSubtitles(ass, { format: 'ass' })
    ok(ab.length === clips.length && ab.every((c, i) => c.caption.words.every((w, k) => near(c.start + w.s, clips[i].start + clips[i].caption.words[k].s, 0.011))), 'ASS {\\kf}: kelime zamanları korundu (cs)')
    ok(/PlayResX: 1080/.test(ass) && /Style: Default,Archivo Black/.test(ass), 'ASS başlık + stil')
    const sr2 = C.parseSRT('﻿1\r\n00:00:01,500 --> 00:00:03,000\r\n<i>Merhaba</i> {\\an8}dünya\r\nikinci satır\r\n\r\n2\r\n0:00:04.25 --> 0:00:05.000 X1:10\r\nSon\r\n')
    ok(sr2.length === 2 && sr2[0].text === 'Merhaba dünya\nikinci satır' && near(sr2[1].start, 4.25), 'SRT hoşgörülü ayrıştırma (BOM, CRLF, etiket, nokta)', JSON.stringify(sr2))
    const v2 = C.parseVTT('WEBVTT\nKind: captions\n\nNOTE yorum\n\n1\n00:01.000 --> 00:02.500 align:start position:0%\n<v Ali>Selam <00:01.800><c>millet</c>\n')
    ok(v2.length === 1 && v2[0].text === 'Selam millet' && near(v2[0].words[1].s, 1.8), 'VTT: başlık, NOTE, ayarlar, ses etiketi, satır içi zaman', JSON.stringify(v2))
    const a2 = C.parseASS('[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\k50}Mer{\\k50}ha{\\k40}ba, {\\k60}dünya\\Nsatır\nComment: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,yorum\n')
    ok(a2.length === 1 && a2[0].words.length === 3 && a2[0].words[0].w === 'Merhaba,' && near(a2[0].words[1].s, 2.4) && a2[0].text === 'Merhaba, dünya\nsatır', 'ASS: karaoke hece→kelime, \\N, Comment atlandı', JSON.stringify(a2))
    const cp1254 = Buffer.from([0x31, 0x0a, 0x30, 0x30, 0x3a, 0x30, 0x30, 0x3a, 0x30, 0x31, 0x2c, 0x30, 0x30, 0x30, 0x20, 0x2d, 0x2d, 0x3e, 0x20, 0x30, 0x30, 0x3a, 0x30, 0x30, 0x3a, 0x30, 0x32, 0x2c, 0x30, 0x30, 0x30, 0x0a, 0xde, 0x61, 0x6b, 0x61, 0x20, 0xe7, 0xfd, 0x6b, 0x74, 0xfd, 0x0a])
    ok(C.parseSRT(C.decodeSubtitleBytes(cp1254))[0].text === 'Şaka çıktı', 'Windows-1254 (eski Türkçe SRT) çözüldü')
    const txt = C.toTXT(C.collectCues(p), { timestamps: true, paragraphGap: 0.5 })
    ok(/^\[00:00\] Arkadaşlar merhaba, kanala/.test(txt) && txt.includes('\n\n[00:03]'), 'TXT döküm (paragraf + zaman damgası)', JSON.stringify(txt.slice(0, 90)))
    fs.writeFileSync(path.join(OUT, 'ornek.srt'), srt); fs.writeFileSync(path.join(OUT, 'ornek.vtt'), vtt); fs.writeFileSync(path.join(OUT, 'ornek.ass'), ass); fs.writeFileSync(path.join(OUT, 'ornek.txt'), txt)
  }

  if (flag('unit')) return finish()

  // ================================================================ indirme testi
  if (flag('download')) {
    section('Model indirme (devam ettirme + sha256)')
    for (const id of ['tiny', 'base']) {
      if (C.isInstalled(id) && !flag('redownload')) { console.log(`  ${id}: zaten kurulu`); continue }
      await C.deleteModel(id)
      const ctrl = new AbortController()
      let last = null
      const m = C.getModel(id)
      try {
        await C.downloadModel(id, pr => { last = pr; if (pr.phase === 'download' && pr.ratio > 0.3) ctrl.abort() }, ctrl.signal)
        ok(false, id + ': iptal edilmeliydi')
      } catch (e) { ok(e.name === 'AbortError', id + ': yarıda iptal → AbortError', e.message) }
      const part = C.partialBytes(id)
      console.log(`  ${id}: iptal sonrası .part = ${(part / 1e6).toFixed(1)} MB`)
      ok(part > 0 && part < m.size, id + ': kısmi dosya kaldı')
      const t0 = Date.now()
      let firstResume = null
      await C.downloadModel(id, pr => { if (firstResume == null && pr.phase === 'download') firstResume = pr.received; last = pr })
      console.log(`  ${id}: devam edildi (ilk ilerleme ${(firstResume / 1e6).toFixed(1)} MB), ${((Date.now() - t0) / 1000).toFixed(1)} sn, son: ${last.phase}`)
      ok(firstResume >= part, id + ': kaldığı yerden devam etti')
      ok(C.isInstalled(id), id + ': kuruldu ve doğrulandı (boyut + sha256)')
    }
  }

  // ================================================================ entegrasyon
  section('Ortam')
  const bins = C.whisperBinaries()
  console.log('  ikililer: ' + bins.map(b => `${b.device}: ${path.relative(ROOT, b.bin)}`).join(' | '))
  console.log('  iş parçacığı: ' + C.defaultThreads() + ' / ' + os.cpus().length + ' mantıksal')
  for (const m of C.listModels()) console.log(`  ${m.installed ? '●' : '○'} ${m.id.padEnd(15)} ${m.label.padEnd(10)} ${m.sizeLabel.padStart(7)}${m.recommended ? '  (önerilen)' : ''}`)
  if (!C.isAvailable()) { console.log('  whisper-cli yok → entegrasyon atlandı'); return finish() }
  if (flag('verify')) {
    for (const m of C.listModels().filter(x => x.installed)) {
      const v = await C.verifyModel(m.id, { hash: true })
      ok(v.ok, `${m.id}: sha256 doğrulandı`, v.reason)
    }
  }
  const installed = C.listModels().filter(m => m.installed).map(m => m.id)
  if (!installed.length) { console.log('  kurulu model yok → --download ile indirin'); return finish() }

  section('Test sesi (Windows TTS)')
  const wav = path.join(OUT, 'tr-tts.wav'), truthFile = path.join(OUT, 'tr-tts-words.json')
  if (!makeTts(wav, truthFile)) { console.log('  TTS üretilemedi → entegrasyon atlandı'); return finish() }
  const truth = JSON.parse(fs.readFileSync(truthFile, 'utf8'))
  const dur = (fs.statSync(wav).size - 44) / 32000
  console.log(`  ${path.relative(ROOT, wav)}: ${dur.toFixed(1)} sn, ${truth.length} kelime sınırı`)

  const want = flagVal('models', null)
  const models = want === 'all' ? installed : want ? want.split(',').filter(id => installed.includes(id)) : [C.pickModel(C.DEFAULT_MODEL)]
  const timings = (flagVal('timing', 'dtw')).split(',')
  const qualities = (flagVal('quality', 'fast')).split(',')
  const results = {}
  section('Döküm ölçümü')
  for (const id of models) for (const timing of timings) for (const quality of qualities) {
    let lastP = 0
    const r = await C.transcribe(wav, { model: id, language: 'tr', timing, quality, cache: false, onProgress: p => { lastP = p.progress } })
    const words = C.resultWords(r)
    const te = timingError(words, truth)
    const w = wer(TR_TEXT, C.resultText(r))
    const rtf = r.elapsed / 1000 / dur
    console.log(`  ${id.padEnd(15)} ${timing.padEnd(6)} ${quality.padEnd(8)} ${(r.elapsed / 1000).toFixed(1).padStart(6)} sn  (x${(1 / rtf).toFixed(1)} gerçek zaman, ${r.device})  WER ${(w * 100).toFixed(1)}%  kelime başı hata: medyan ${(te.median * 1000).toFixed(0)} ms, p90 ${(te.p90 * 1000).toFixed(0)} ms, sapma ${(te.bias * 1000).toFixed(0)} ms`)
    ok(lastP === 1, `${id}: ilerleme %100'e ulaştı`)
    ok(r.language === 'tr' && words.length > 80, `${id}: Türkçe ve kelimeler var`, `${r.language} ${words.length}`)
    results[`${id}/${timing}/${quality}`] = { r, w, te }
  }

  const mainKey = Object.keys(results).find(k => k.startsWith(C.DEFAULT_MODEL + '/')) || Object.keys(results)[0]
  if (!mainKey) return finish()
  const main = results[mainKey].r
  section(`Kelime zamanları (${mainKey}, ilk 24)`)
  console.log('  ' + C.resultWords(main).slice(0, 24).map(w => `${w.w}[${w.s.toFixed(2)}-${w.e.toFixed(2)}]`).join(' '))
  ok(!C.resultText(main).includes('�'), 'dökümde bozuk harf yok')
  ok(/ş|ğ|ı|ü|ö|ç|İ/.test(C.resultText(main)), 'Türkçe harfler korunmuş')

  section('Altyazı klipleri (gerçek döküm)')
  {
    const clips = C.buildCaptionClips(main, { maxWords: 4, maxChars: 24, emoji: true, highlightKeywords: true, styleId: 'pop' })
    for (const c of clips.slice(0, 12)) console.log(`  ${c.start.toFixed(2).padStart(6)}-${(c.start + c.duration).toFixed(2).padEnd(6)} ${c.text.content.padEnd(30)} ${c.caption.emoji || '  '}  ${c.caption.words.filter(w => w.emphasis).map(w => w.w).join(',')}`)
    console.log(`  … toplam ${clips.length} klip, ortalama ${(clips.reduce((a, c) => a + c.caption.words.length, 0) / clips.length).toFixed(1)} kelime/klip`)
    ok(clips.every((c, i) => i === 0 || clips[i - 1].start + clips[i - 1].duration <= c.start + 1e-6), 'gerçek klipler çakışmıyor')
    const p = model.createProject()
    C.insertCaptions(p, clips)
    const srt = C.exportSubtitles(p, 'srt')
    await C.writeSubtitleFile(path.join(OUT, 'tr-tts.srt'), srt)
    const back = await C.importSubtitleFile(path.join(OUT, 'tr-tts.srt'))
    ok(back.length === clips.length && back.every((c, i) => near(c.start, clips[i].start) && c.text.content === clips[i].text.content), 'SRT dosyası yaz → oku gidiş-dönüş (BOM, CRLF)', `${back.length}/${clips.length}`)
    fs.writeFileSync(path.join(OUT, 'tr-tts.vtt'), C.exportSubtitles(p, 'vtt', { karaoke: true }))
    fs.writeFileSync(path.join(OUT, 'tr-tts.ass'), C.exportSubtitles(p, 'ass', { karaoke: true }))
    fs.writeFileSync(path.join(OUT, 'tr-tts.txt'), C.toTXT(main, { timestamps: true }))
    console.log('  yazıldı: ' + ['srt', 'vtt', 'ass', 'txt'].map(e => path.relative(ROOT, path.join(OUT, 'tr-tts.' + e))).join(', '))
  }

  section('Önbellek, aralık, iptal, Türkçe yol')
  {
    const id = models.includes(C.DEFAULT_MODEL) ? C.DEFAULT_MODEL : models[0]
    await C.transcribe(wav, { model: id, language: 'tr' })
    const t0 = Date.now()
    const c2 = await C.transcribe(wav, { model: id, language: 'tr' })
    ok(c2.cached && Date.now() - t0 < 1500, 'ikinci çağrı önbellekten', `${Date.now() - t0} ms`)
    // Türkçe karakterli klasör + aralık
    const trDir = path.join(OUT, 'Çağrı Şölen klasörü')
    fs.mkdirSync(trDir, { recursive: true })
    const trWav = path.join(trDir, 'ses kaydı ğüşiöç.wav')
    fs.copyFileSync(wav, trWav)
    const rr = await C.transcribe(trWav, { model: id, language: 'tr', range: { start: 13.5, end: 21 }, cache: false })
    const rw = C.resultWords(rr)
    console.log(`  aralık 13.5–21 sn: "${C.resultText(rr)}" (${rw.length ? rw[0].s.toFixed(2) + '…' + rw[rw.length - 1].e.toFixed(2) : '-'})`)
    ok(rw.length > 3 && rw[0].s >= 13.4 && rw[rw.length - 1].e <= 21.2, 'Türkçe yolda + aralıkla döküm, zamanlar kaynak saniyesi')
    // iptal
    const ctrl = new AbortController()
    const ta = Date.now()
    setTimeout(() => ctrl.abort(), 1500)
    try {
      await C.transcribe(wav, { model: id, language: 'tr', cache: false, signal: ctrl.signal })
      ok(false, 'iptal edilmeliydi')
    } catch (e) {
      ok(e.name === 'AbortError' && Date.now() - ta < 6000, 'iptal → AbortError, süreç sonlandı', `${e.name} ${Date.now() - ta} ms`)
    }
    await new Promise(r => setTimeout(r, 800))
    const tl = cp.spawnSync('tasklist', ['/FI', 'IMAGENAME eq whisper-cli.exe'], { encoding: 'utf8' }).stdout || ''
    ok(!/whisper-cli\.exe/i.test(tl), 'arkada whisper-cli kalmadı')
    // müzik + sessizlik: başta 4 sn akor, 13.6. sn'den sonra 5 sn sessizlik → zamanlar kaymamalı, müzik yazıya dökülmemeli
    const mv = path.join(OUT, 'tr-muzik-sessizlik.wav')
    if (!fs.existsSync(mv)) {
      cp.spawnSync(require(path.join(ROOT, 'node_modules', 'ffmpeg-static')), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=0.25*sin(2*PI*220*t)+0.2*sin(2*PI*277*t)+0.2*sin(2*PI*330*t):s=16000:d=4', '-i', wav, '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono',
        '-filter_complex', '[1:a]atrim=0:13.6,asetpts=PTS-STARTPTS[a1];[1:a]atrim=13.6:21,asetpts=PTS-STARTPTS[a2];[2:a]atrim=0:5,asetpts=PTS-STARTPTS[sil];[0:a][a1][sil][a2]concat=n=4:v=0:a=1,aformat=sample_rates=16000:channel_layouts=mono[out]',
        '-map', '[out]', '-c:a', 'pcm_s16le', mv])
    }
    const mr = await C.transcribe(mv, { model: id, language: 'tr' })
    const mw = C.resultWords(mr)
    const tamam = mw.find(w => /^Tamam/i.test(w.w))
    const expT = 4 + 5 + truth.find(w => w.w === 'Tamam').s // müzik + sessizlik kayması
    console.log(`  müzik+sessizlik: ilk kelime "${mw[0].w}" @${mw[0].s.toFixed(2)} (beklenen ~${(4 + truth[0].s).toFixed(2)}), "Tamam" @${tamam ? tamam.s.toFixed(2) : '-'} (beklenen ~${expT.toFixed(2)})`)
    ok(mw[0].s >= 3.8 && Math.abs(mw[0].s - (4 + truth[0].s)) < 0.35, 'baştaki müzik yazıya dökülmedi, ilk kelime doğru yerde')
    ok(tamam && Math.abs(tamam.s - expT) < 0.35, 'sessizlikten sonra zaman kaymadı')
    // konuşmasız oyun kaydı: otomatik dilde uydurma metin çıkmamalı (düşük güven filtresi)
    const game = path.join(ROOT, 'test-videos', 'oyun kaydı çılgın şölen.mp4')
    if (fs.existsSync(game)) {
      const gr = await C.transcribe(game, { model: id, language: 'auto', range: { start: 0, end: 20 } })
      console.log(`  konuşmasız oyun kaydı (auto): "${C.resultText(gr)}"`)
      ok(C.resultWords(gr).length === 0, 'oyun sesinde uydurma altyazı yok')
    }
    // dolgu (verbatim istemi)
    const fv = await C.transcribe(wav, { model: id, language: 'tr', range: { start: 0, end: 14 }, verbatim: true })
    console.log(`  verbatim istemiyle (0–14 sn): "${C.resultText(fv).slice(0, 100)}…"  dolgu: ${JSON.stringify(C.findFillers(fv, 'tr').map(f => f.w))}`)
    ok(C.resultWords(fv).length > 10, 'verbatim (UTF-8 istem) çalışıyor')
  }
  finish()
})().catch(e => { console.error('\nHATA:', e && e.stack || e); process.exit(1) })

function finish() {
  console.log(`\n${fail ? '✗' : '✓'} ${pass} geçti, ${fail} kaldı`)
  if (fail) { for (const f of fails) console.log('  - ' + f); process.exitCode = 1 }
}
