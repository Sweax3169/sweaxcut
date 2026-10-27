// Windows yerleşik sesleri (çevrimdışı yedek): önce OneCore (Windows.Media.SpeechSynthesis — Türkçe "Tolga" burada),
// son çare System.Speech (SAPI5). PowerShell 5.1 üzerinden; metin ve sonuçlar UTF-8 dosyalarla taşınır.

import { fs, path, run, cacheDir } from '../../platform/node.js'

// Betikler yalnız ASCII (PowerShell 5.1 BOM'suz UTF-8'i yanlış okur)
const ONECORE_PS = String.raw`param([string]$Mode='speak',[string]$TextFile='',[string]$Out='',[string]$Meta='',[string]$VoiceId='',[string]$Lang='tr-TR',[double]$Rate=1.0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Await($op,[Type]$t){ $task=$asTask.MakeGenericMethod($t).Invoke($null,@($op)); $task.Wait(-1)|Out-Null; $task.Result }
[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]|Out-Null
[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]|Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false
$all = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
if ($Mode -eq 'list') {
  $list = @($all | ForEach-Object { @{ id=$_.Id; name=$_.DisplayName; lang=$_.Language; gender=[string]$_.Gender } })
  [IO.File]::WriteAllText($Meta, (ConvertTo-Json -InputObject $list -Compress), $utf8)
  exit 0
}
$text = [IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8)
$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = $null
if ($VoiceId) { $v = $all | Where-Object { $_.Id -eq $VoiceId -or $_.DisplayName -eq $VoiceId } | Select-Object -First 1 }
if (-not $v) { $v = $all | Where-Object { $_.Language -eq $Lang } | Select-Object -First 1 }
if ($v) { $s.Voice = $v }
$s.Options.SpeakingRate = [Math]::Max(0.5, [Math]::Min(6.0, $Rate))
$s.Options.IncludeWordBoundaryMetadata = $true
$st = Await ($s.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$r = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0)); $n=[uint32]$st.Size
$null = Await ($r.LoadAsync($n)) ([uint32]); $b = New-Object byte[] $n; $r.ReadBytes($b); [IO.File]::WriteAllBytes($Out,$b)
$cues = @(foreach($t in $st.TimedMetadataTracks){ foreach($c in $t.Cues){ @{ text=$c.Text; s=$c.StartTime.TotalMilliseconds; d=$c.Duration.TotalMilliseconds } } })
[IO.File]::WriteAllText($Meta, (ConvertTo-Json -InputObject $cues -Compress), $utf8)
`

const SAPI_PS = String.raw`param([string]$Mode='speak',[string]$TextFile='',[string]$Out='',[string]$Meta='',[string]$VoiceId='',[int]$Rate=0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$utf8 = New-Object System.Text.UTF8Encoding $false
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($Mode -eq 'list') {
  $list = @($s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { @{ id=$_.VoiceInfo.Name; name=$_.VoiceInfo.Name; lang=$_.VoiceInfo.Culture.Name; gender=[string]$_.VoiceInfo.Gender } })
  [IO.File]::WriteAllText($Meta, (ConvertTo-Json -InputObject $list -Compress), $utf8)
  exit 0
}
$text = [IO.File]::ReadAllText($TextFile, [Text.Encoding]::UTF8)
if ($VoiceId) { $s.SelectVoice($VoiceId) }
$s.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($Out, $fmt); $s.Speak($text); $s.Dispose()
[IO.File]::WriteAllText($Meta, '[]', $utf8)
`

const isWin = typeof process !== 'undefined' && process.platform === 'win32'

function script(name, body) {
  const p = path.join(cacheDir('tts'), name)
  try { if (fs.readFileSync(p, 'utf8') === body) return p } catch (e) { /* yok */ }
  fs.writeFileSync(p, body, 'utf8')
  return p
}

async function ps(file, args) {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, ...args])
}

const GENDER = { Male: 'erkek', Female: 'kadın' }

async function listWith(engine, body) {
  if (!isWin || !fs) return []
  const meta = path.join(cacheDir('tts'), engine + '-voices.json')
  const r = await ps(script(engine + '.ps1', body), ['-Mode', 'list', '-Meta', meta])
  if (r.code !== 0) return []
  try {
    const list = JSON.parse(fs.readFileSync(meta, 'utf8').replace(/^﻿/, ''))
    return (Array.isArray(list) ? list : [list]).map(v => ({
      id: engine + ':' + v.id, rawId: v.id, engine, name: v.name, lang: String(v.lang || '').replace('_', '-'),
      gender: GENDER[v.gender] || 'bilinmiyor', installed: true, bundled: false, license: 'Windows yerleşik ses', commercial: true,
    }))
  } catch (e) { return [] }
}

let _cache = null
export async function listWindowsVoices({ refresh = false } = {}) {
  if (_cache && !refresh) return _cache
  const [one, sapi] = await Promise.all([listWith('onecore', ONECORE_PS), listWith('sapi', SAPI_PS)])
  // aynı ses iki API'de görünürse OneCore olanı tut
  const names = new Set(one.map(v => v.name.replace(/ Desktop$/, '')))
  _cache = [...one, ...sapi.filter(v => !names.has(v.name.replace(/ Desktop$/, '')))]
  return _cache
}

// → { wav (ham çıktı), cues: [{text, s, e}] | null }
export async function synthWindows(voice, text, { rate = 1, workDir }) {
  const textFile = path.join(workDir, 'text.txt')
  const out = path.join(workDir, 'win.wav')
  const meta = path.join(workDir, 'win.json')
  fs.writeFileSync(textFile, text, 'utf8')
  let r
  if (voice.engine === 'onecore') {
    r = await ps(script('onecore.ps1', ONECORE_PS), ['-Mode', 'speak', '-TextFile', textFile, '-Out', out, '-Meta', meta, '-VoiceId', voice.rawId || '', '-Lang', voice.lang || 'tr-TR', '-Rate', String(Math.max(0.5, Math.min(6, rate)))])
  } else {
    const sr = Math.round(Math.log(Math.max(0.3, rate)) / Math.log(1.1)) // SAPI: −10..10, adım ≈ %10
    r = await ps(script('sapi.ps1', SAPI_PS), ['-Mode', 'speak', '-TextFile', textFile, '-Out', out, '-Meta', meta, '-VoiceId', voice.rawId || '', '-Rate', String(Math.max(-10, Math.min(10, sr)))])
  }
  if (r.code !== 0) throw new Error('Windows sesi üretilemedi: ' + (r.err || '').slice(-300))
  let cues = null
  try {
    const arr = JSON.parse(fs.readFileSync(meta, 'utf8').replace(/^﻿/, ''))
    if (Array.isArray(arr) && arr.length) {
      cues = arr.map((c, i) => ({ text: c.text, s: c.s / 1000, e: arr[i + 1] ? arr[i + 1].s / 1000 : (c.s + Math.max(c.d || 0, 250)) / 1000 }))
    }
  } catch (e) { cues = null }
  return { wav: out, cues }
}
