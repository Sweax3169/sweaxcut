// Dışa aktarma sesi: önce ekip ses motoru (src/engine/audio.js → renderProjectAudio), hata verirse / yoksa
// ffmpeg ile yedek karıştırıcı (atrim/atempo/volume/fade/pan/eq/amix). Yedek KALICI güvenlik ağıdır.

import { fs, path } from '../../platform/node.js'
import { runFF, tailErr, fileSize, AbortErr } from './proc.js'

// audio.js henüz yoksa derleme kırılmasın diye glob ile tembel yükle
const audioMods = import.meta.glob('../audio.js')

export async function loadAudioModule() {
  const f = audioMods['../audio.js']
  if (!f) return null
  try { return await f() } catch (e) { console.warn('[dışa aktar] audio.js yüklenemedi', e); return null }
}

// AudioBuffer → WAV (32 bit kayan nokta)
export function writeWavLocal(buffer, file) {
  const ch = Math.max(1, buffer.numberOfChannels || 1)
  const n = buffer.length
  const sr = buffer.sampleRate || 48000
  const data = Buffer.allocUnsafe(n * ch * 4)
  const chans = []
  for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c))
  let o = 0
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { data.writeFloatLE(chans[c][i] || 0, o); o += 4 }
  const h = Buffer.alloc(58)
  h.write('RIFF', 0); h.writeUInt32LE(50 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(18, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(ch, 22)
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * ch * 4, 28); h.writeUInt16LE(ch * 4, 32); h.writeUInt16LE(32, 34); h.writeUInt16LE(0, 36)
  h.write('fact', 38); h.writeUInt32LE(4, 42); h.writeUInt32LE(n, 46)
  h.write('data', 50); h.writeUInt32LE(data.length, 54)
  fs.writeFileSync(file, Buffer.concat([h, data]))
}

// Projenin [start, start+duration] sesini WAV'a yaz. Döner: { path, via }
export async function renderAudioWav(project, { start, duration, sampleRate = 48000 }, wavPath, { signal, warn, useEngine = true, onProgress } = {}) {
  const end = start + duration
  const list = audibleClips(project, start, end)
  // ses motoru çıkarılmış ses dosyasıyla (media.audioPath) çalışır; hazır değilse yedeğe geç
  const notReady = list.filter(it => !(it.m.audioPath && fs.existsSync(it.m.audioPath)))
  const mod = useEngine ? await loadAudioModule() : null
  const hasEngine = mod && (typeof mod.renderProjectAudioToWav === 'function' || typeof mod.renderProjectAudio === 'function')
  if (hasEngine && notReady.length) {
    warn && warn(`${notReady.length} klibin sesi henüz hazırlanmadı, yedek karıştırıcı kullanıldı`)
  } else if (hasEngine) {
    try {
      if (typeof mod.renderProjectAudioToWav === 'function') {
        await mod.renderProjectAudioToWav(project, wavPath, { start, end, sampleRate, onProgress })
      } else {
        const buf = await mod.renderProjectAudio(project, { start, end, sampleRate, onProgress })
        if (buf) {
          if (typeof mod.writeWav === 'function') await mod.writeWav(buf, wavPath)
          else writeWavLocal(buf, wavPath)
        }
      }
      if (signal && signal.aborted) throw new AbortErr()
      if (fileSize(wavPath) > 64) {
        if (!list.length || !wavIsSilent(wavPath)) return { path: wavPath, via: 'audio.js' }
        warn && warn('Ses motoru sessiz sonuç verdi, yedek karıştırıcı kullanılıyor')
      } else warn && warn('Ses motoru boş sonuç verdi, yedek karıştırıcı kullanılıyor')
    } catch (e) {
      if (e && e.name === 'AbortError') throw e
      warn && warn('Ses motoru hata verdi, yedek karıştırıcı kullanılıyor: ' + String(e && e.message || e).slice(0, 160))
    }
  }
  await mixFallback(project, { start, duration, sampleRate }, wavPath, { signal, warn })
  return { path: wavPath, via: 'ffmpeg' }
}

// WAV tamamen sessiz mi? (ilk duyulur örnekte erken çıkar)
export function wavIsSilent(file) {
  let fd = null
  try {
    fd = fs.openSync(file, 'r')
    const head = Buffer.alloc(4096)
    const hn = fs.readSync(fd, head, 0, 4096, 0)
    let pos = 12, fmt = 1, bits = 16, dataOff = -1
    while (pos + 8 <= hn) {
      const id = head.toString('ascii', pos, pos + 4), sz = head.readUInt32LE(pos + 4)
      if (id === 'fmt ') { fmt = head.readUInt16LE(pos + 8); bits = head.readUInt16LE(pos + 22); if (fmt === 0xfffe) fmt = head.readUInt16LE(pos + 32) }
      if (id === 'data') { dataOff = pos + 8; break }
      pos += 8 + sz + (sz & 1)
    }
    if (dataOff < 0) return false
    const buf = Buffer.alloc(1 << 20)
    let off = dataOff
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, off)
      if (n <= 0) return true
      if (fmt === 3 && bits === 32) { for (let i = 0; i + 4 <= n; i += 4) if (Math.abs(buf.readFloatLE(i)) > 1e-5) return false }
      else if (bits === 16) { for (let i = 0; i + 2 <= n; i += 2) if (Math.abs(buf.readInt16LE(i)) > 1) return false }
      else if (bits === 24) { for (let i = 0; i + 3 <= n; i += 3) if (Math.abs(buf.readIntLE(i, 3)) > 256) return false }
      else return false
      off += n
    }
  } catch (e) { return false } finally { if (fd != null) try { fs.closeSync(fd) } catch (e) { /* */ } }
}

function hasVolKeys(c) { const k = c.keyframes && c.keyframes['audio.volume']; return !!(k && k.length) }

// Duyulabilir klipler ve görünür aralıkları
export function audibleClips(project, start, end) {
  const out = []
  for (const track of project.tracks) {
    if (track.muted) continue
    for (const c of track.clips) {
      if (c.type !== 'audio' && c.type !== 'video') continue
      if (c.freeze) continue
      const a = c.audio || {}
      if (a.muted) continue
      if (!((a.volume ?? 1) > 0) && !hasVolKeys(c)) continue
      const m = project.media[c.mediaId]
      if (!m || m.type === 'image') continue
      if (c.type === 'video' && !m.hasAudio) continue
      const s = Math.max(start, c.start), e = Math.min(end, c.start + c.duration)
      if (e - s < 0.002) continue
      out.push({ c, m, lt0: s - c.start, lt1: e - c.start, at: s - start })
    }
  }
  return out
}

const f6 = x => (Math.round(x * 1e6) / 1e6).toString()

function tempoChain(s) {
  const parts = []
  let r = s
  while (r > 2.0) { parts.push('atempo=2.0'); r /= 2 }
  while (r < 0.5) { parts.push('atempo=0.5'); r /= 0.5 }
  if (Math.abs(r - 1) > 1e-4) parts.push('atempo=' + f6(r))
  return parts
}

// volume ifadesi: L = klip yerel zamanı (t + lt0)
function volumeExpr(c, lt0) {
  const a = c.audio || {}
  const L = `(t+${f6(lt0)})`
  let v
  const keys = c.keyframes && c.keyframes['audio.volume']
  if (keys && keys.length) {
    const ks = keys.slice().sort((x, y) => x.t - y.t)
    v = f6(ks[ks.length - 1].v)
    for (let i = ks.length - 1; i > 0; i--) {
      const k0 = ks[i - 1], k1 = ks[i]
      const span = Math.max(1e-6, k1.t - k0.t)
      v = `if(lt(${L},${f6(k1.t)}),${f6(k0.v)}+(${f6(k1.v - k0.v)})*(${L}-${f6(k0.t)})/${f6(span)},${v})`
    }
    v = `if(lt(${L},${f6(ks[0].t)}),${f6(ks[0].v)},${v})`
  } else v = f6(a.volume ?? 1)
  let e = v
  const D = c.duration
  if (a.fadeIn > 0) e += `*min(1,max(0,${L}/${f6(a.fadeIn)}))`
  if (a.fadeOut > 0) e += `*min(1,max(0,(${f6(D)}-${L})/${f6(a.fadeOut)}))`
  return e
}

export async function mixFallback(project, { start, duration, sampleRate = 48000 }, wavPath, { signal, warn } = {}) {
  const end = start + duration
  const list = audibleClips(project, start, end)
  const D = f6(duration)
  const args = ['-hide_banner', '-v', 'error', '-y', '-nostdin']
  const graph = []
  const labels = []
  let n = 0
  for (const it of list) {
    const { c, m } = it
    const a = c.audio || {}
    const span = Math.max(0, (c.out ?? 0) - (c.in ?? 0))
    const s = c.freeze ? 1 : Math.max(0.01, span / Math.max(1e-6, c.duration))
    const srcFile = m.audioPath && fs.existsSync(m.audioPath) ? m.audioPath : m.path
    let file = srcFile, A, B, rev = false
    if (c.reverse) {
      const rf = m.reversedAudioPath && fs.existsSync(m.reversedAudioPath) ? m.reversedAudioPath : null
      if (rf) {
        const Dm = m.duration || 0
        file = rf
        A = Dm - c.out + it.lt0 * s; B = Dm - c.out + it.lt1 * s
      } else {
        A = c.out - it.lt1 * s; B = c.out - it.lt0 * s; rev = true
      }
    } else {
      A = (c.in || 0) + it.lt0 * s; B = (c.in || 0) + it.lt1 * s
    }
    A = Math.max(0, A); B = Math.max(A + 0.001, B)
    args.push('-ss', f6(A), '-t', f6(B - A), '-i', file)
    const ch = [`[${n}:a:0]aresample=${sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS`]
    if (rev) ch.push('areverse')
    if (Math.abs(s - 1) > 1e-4) {
      if (a.preservePitch === false) ch.push(`asetrate=${Math.round(sampleRate * s)}`, `aresample=${sampleRate}`)
      else ch.push(...tempoChain(s))
    }
    if (a.pitch) ch.push(`rubberband=pitch=${f6(Math.pow(2, a.pitch / 12))}`)
    const eq = a.eq || {}
    if (eq.low) ch.push(`bass=g=${f6(eq.low)}:f=150`)
    if (eq.mid) ch.push(`equalizer=f=1000:t=q:w=0.9:g=${f6(eq.mid)}`)
    if (eq.high) ch.push(`treble=g=${f6(eq.high)}:f=5000`)
    if (a.denoise > 0) ch.push(`afftdn=nr=${f6(Math.min(97, 6 + a.denoise * 0.35))}:nf=-40`)
    if (a.enhance) ch.push('highpass=f=80', 'acompressor=threshold=0.125:ratio=3:attack=10:release=120:makeup=1.5')
    if (a.normalize) ch.push('loudnorm=I=-16:TP=-1.5:LRA=11', `aresample=${sampleRate}`)
    const ve = volumeExpr(c, it.lt0)
    ch.push(/^[\d.]+$/.test(ve) ? `volume=${ve}` : `volume=eval=frame:volume='${ve}'`)
    if (a.pan) {
      const p = Math.max(-1, Math.min(1, a.pan))
      ch.push(`pan=stereo|c0=${f6(Math.min(1, 1 - p))}*c0|c1=${f6(Math.min(1, 1 + p))}*c1`)
    }
    ch.push(`atrim=0:${f6(it.lt1 - it.lt0)}`)
    const delay = Math.round(it.at * sampleRate)
    if (delay > 0) ch.push(`adelay=delays=${delay}S:all=1`)
    graph.push(ch.join(',') + `[a${n}]`)
    labels.push(`[a${n}]`)
    n++
  }
  const outArgs = ['-c:a', 'pcm_f32le', '-ar', String(sampleRate), '-ac', '2', '-f', 'wav', wavPath]
  if (!n) {
    args.push('-f', 'lavfi', '-i', `anullsrc=r=${sampleRate}:cl=stereo`, '-t', D, ...outArgs)
    const r = await runFF(args, { signal })
    if (r.code !== 0) throw new Error('Sessiz ses üretilemedi: ' + tailErr(r.err))
    return
  }
  const mix = n > 1 ? `${labels.join('')}amix=inputs=${n}:duration=longest:dropout_transition=0:normalize=0,` : `${labels[0]}`
  graph.push(`${mix}${n > 1 ? '' : 'anull,'}apad=whole_dur=${D},atrim=0:${D},alimiter=limit=0.98:attack=3:release=60:level=0[out]`)
  const script = path.join(path.dirname(wavPath), 'mix-graph.txt')
  fs.writeFileSync(script, graph.join(';\n'))
  args.push('-filter_complex_script', script, '-map', '[out]', ...outArgs)
  const r = await runFF(args, { signal })
  if (r.code !== 0) {
    warn && warn('Yedek ses karıştırma başarısız: ' + tailErr(r.err, 300))
    // son çare: sessizlik
    const r2 = await runFF(['-hide_banner', '-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=${sampleRate}:cl=stereo`, '-t', D, ...outArgs], { signal })
    if (r2.code !== 0) throw new Error('Ses üretilemedi: ' + tailErr(r.err))
  }
}
