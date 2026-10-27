// Kütüphane paneli test düzeneği: <Library/> + canlı önizleme tuvali + proje durumu dökümü.
// dev/library-shot.cjs bu sayfayı açar, sekmeleri gezer, ekran görüntüsü alır ve window.__lib.checks() sonucunu yazar.
import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/ui/styles/base.css'
import { initPacks, loadedPacks } from '../src/packs/index.js'
import { store, useStore } from '../src/core/store.js'
import { createProject } from '../src/core/model.js'
import * as TL from '../src/core/timeline.js'
import { playback } from '../src/engine/playback.js'
import { MenuLayer, TipLayer } from '../src/ui/controls.jsx'
import Library from '../src/ui/library/Library.jsx'
import * as A from '../src/ui/actions.js'
import { insertLibraryItem, insertAudioDef } from '../src/ui/library/insert.js'
import * as T from '../src/ui/library/tools.js'
import { previewStats, setSampleMode } from '../src/ui/library/preview-engine.js'
import { builtinFile, BUILTINS } from '../src/ui/library/builtins.js'
import { captionSources, importSubtitlePath, subtitleText, captionClipsFromResult } from '../src/ui/library/captions-run.js'
import { feature } from '../src/ui/library/features.js'
import { ttsModule } from '../src/ui/library/features.js'
import { placeAudioOnNewTrack } from '../src/ui/library/insert.js'
import { hasFeature } from '../src/ui/library/features.js'
import { REG, register } from '../src/engine/registry.js'
import { importFiles } from '../src/core/media.js'
import { appPaths, run, path, fs, isElectron } from '../src/platform/node.js'

function State() {
  const p = useStore(s => s.project)
  const sel = useStore(s => s.selection.clips)
  const lines = []
  lines.push(`PROJE ${p.settings.width}×${p.settings.height} · medya ${Object.keys(p.media).length} · işaret ${p.markers.length} · seçili ${sel.length}`)
  for (const t of p.tracks) {
    lines.push(`── ${t.kind}${t.main ? ' (ana)' : ''} ${t.name || ''}`)
    for (const c of t.clips) {
      const extra = [c.effect && 'efekt:' + c.effect.id, c.filter && 'filtre:' + c.filter.id, c.transition && 'geçiş:' + c.transition.id, c.sticker && 'çık:' + (c.sticker.id || c.sticker.mediaId), c.text && '"' + String(c.text.content).slice(0, 18) + '"', c.role && 'rol:' + c.role, c.effects && c.effects.length && 'fx×' + c.effects.length, c.beats && 'vuruş×' + c.beats.length, c.audio && c.audio.normalize && 'norm'].filter(Boolean).join(' ')
      lines.push(`   ${c.type.padEnd(7)} ${c.start.toFixed(2).padStart(6)} +${c.duration.toFixed(2).padEnd(6)} ${extra}`)
    }
  }
  return <div className="lt-state">{lines.join('\n')}</div>
}

function Toasts() {
  const toasts = useStore(s => s.toasts)
  const busy = useStore(s => s.ui.busy)
  return (
    <>
      <div className="toasts">{toasts.map(t => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
      {busy && <div className="busy"><div className="row"><span className="grow">{busy.label}</span>{busy.progress != null && <span className="mono dim">{Math.round(busy.progress * 100)}%</span>}</div><div className={'bar' + (busy.progress == null ? ' indet' : '')}><i style={{ width: (busy.progress || 0) * 100 + '%' }} /></div></div>}
    </>
  )
}

function Shell() {
  const cv = useRef(null)
  useEffect(() => { playback.attach(cv.current) }, [])
  return (
    <div className="lt-shell">
      <Library />
      <div className="lt-split" />
      <div className="lt-right">
        <canvas ref={cv} style={{ width: 240 }} />
        <State />
      </div>
      <Toasts />
      <TipLayer />
      <MenuLayer />
    </div>
  )
}

async function makeMedia() {
  const out = path.join(appPaths().appRoot, 'test-videos', 'out', 'lib-sample.mp4')
  if (fs.existsSync(out)) return out
  fs.mkdirSync(path.dirname(out), { recursive: true })
  // 3 sahne (sahne algılama) + 1 sn ton / 1 sn sessizlik (sessizlik kesme)
  const r = await run(appPaths().ffmpeg, ['-y', '-v', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=3:r=30', '-f', 'lavfi', '-i', 'smptebars=s=640x360:d=3:r=30', '-f', 'lavfi', '-i', 'mandelbrot=s=640x360:r=30',
    '-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t\\,2)\\,1)\\,0.5*sin(2*PI*440*t)\\,0)':s=48000:d=9",
    '-filter_complex', '[2:v]trim=duration=3,setpts=PTS-STARTPTS[m];[0:v][1:v][m]concat=n=3:v=1:a=0,format=yuv420p[v]',
    '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-shortest', out])
  if (r.code !== 0) throw new Error('örnek video üretilemedi: ' + r.err)
  return out
}

async function waitReady(id, ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const m = store.get().project.media[id]
    if (m && m.status === 'ready') return true
    await new Promise(r => setTimeout(r, 150))
  }
  return false
}

const clipsOf = type => store.get().project.tracks.flatMap(t => t.clips).filter(c => c.type === type)
const mainClips = () => TL.mainTrack(store.get().project).clips

async function checks() {
  const R = {}
  const step = async (name, fn) => { try { R[name] = await fn() } catch (e) { R[name] = 'HATA: ' + (e && e.message || e); console.error(name, e) } }
  await step('text', async () => { const b = clipsOf('text').length; const tpl = REG.textTemplates.list[0]; await insertLibraryItem({ kind: 'text', id: tpl ? tpl.id : '__default' }, { time: 0 }); return { added: clipsOf('text').length - b, tpl: tpl && tpl.id } })
  await step('textDefault', async () => { const b = clipsOf('text').length; await insertLibraryItem({ kind: 'text', id: '__default' }, { time: 4 }); return clipsOf('text').length - b })
  await step('sticker', async () => { const b = clipsOf('sticker').length; const d = REG.stickers.list.find(x => x.kind === 'vector') || REG.stickers.list[0]; if (!d) return 'paket yok'; await insertLibraryItem({ kind: 'sticker', id: d.id }, { time: 1 }); return { added: clipsOf('sticker').length - b, id: d.id } })
  await step('effectLayer', async () => { store.select([]); const b = clipsOf('effect').length; const d = REG.effects.list[0]; if (!d) return 'paket yok'; await insertLibraryItem({ kind: 'effect', id: d.id }, { time: 0, toClip: false }); return { added: clipsOf('effect').length - b, id: d.id } })
  await step('effectToClip', async () => { const c = mainClips()[0]; store.select([c.id]); const d = REG.effects.list[1] || REG.effects.list[0]; await insertLibraryItem({ kind: 'effect', id: d.id }, { toClip: true }); return TL.getClip(store.get().project, c.id).effects.map(e => e.id) })
  await step('filterClip', async () => { const c = mainClips()[0]; store.select([c.id]); const d = REG.filters.list[0]; if (!d) return 'paket yok'; await insertLibraryItem({ kind: 'filter', id: d.id }); return TL.getClip(store.get().project, c.id).filter })
  await step('filterLayer', async () => { store.select([]); const d = REG.filters.list[1] || REG.filters.list[0]; if (!d) return 'paket yok'; const b = clipsOf('filter').length; await insertLibraryItem({ kind: 'filter', id: d.id }, { time: 2 }); return clipsOf('filter').length - b })
  await step('sfx', async () => { const d = REG.sfx.list[0]; if (!d) return 'paket yok'; const b = clipsOf('audio').length; await insertAudioDef('sfx', d, 0.5); return { added: clipsOf('audio').length - b, role: clipsOf('audio').slice(-1)[0]?.role } })
  await step('music', async () => { const d = REG.music.list[0]; if (!d) return 'paket yok'; const b = clipsOf('audio').length; await insertAudioDef('music', d, 0); return { added: clipsOf('audio').length - b } })
  await step('scenes', async () => { const c = mainClips()[0]; return await T.detectScenes(c, 0.35) })
  await step('silence', async () => { const c = mainClips()[0]; const r = await T.analyzeSilences(c, { threshold: -38, minDur: 0.5, pad: 0.1 }); const b = mainClips().length; const n = T.applyCuts(r.clipId, r.cuts); return { cuts: r.cuts.length, total: +r.total.toFixed(2), applied: n, mainBefore: b, mainAfter: mainClips().length } })
  await step('transition', async () => { store.select([]); playback.seek(mainClips()[0].duration); const d = REG.transitions.list[0]; if (!d) return 'paket yok'; await insertLibraryItem({ kind: 'transition', id: d.id }); return mainClips().filter(c => c.transition).map(c => c.transition.id) })
  await step('beats', async () => { const c = mainClips()[0]; return await T.findBeats(c) })
  await step('highlights', async () => { const n = await T.findHighlights(mainClips(), { count: 2, zoom: true }); return { n, markers: store.get().project.markers.length, keys: Object.keys(mainClips()[0].keyframes || {}) } })
  await step('builtin', async () => { const p = builtinFile(BUILTINS[13], 1080, 1920); const ids = await importFiles([p]); A.addMediaToTimeline(ids[0], 0, { overlay: true }); return { file: path.basename(p), media: !!store.get().project.media[ids[0]] } })
  await step('shorts', async () => T.splitForShorts(3))
  await step('normalize', async () => T.setAudioFlag('normalize', true, undefined, 'Ses seviyesini eşitle'))
  await step('captionSources', async () => captionSources('main').length)
  await step('srtImport', async () => {
    const f = path.join(appPaths().appRoot, 'test-videos', 'out', 'lib-test.srt')
    fs.writeFileSync(f, '1\n00:00:00,500 --> 00:00:02,000\nMerhaba çocuklar\n\n2\n00:00:02,200 --> 00:00:04,000\nBugün şölen var\n')
    const n = await importSubtitlePath(f)
    const srt = await subtitleText('srt')
    return { n, exportLines: srt.split('\n').filter(Boolean).length, sample: srt.slice(0, 60) }
  })
  await step('captionBuild', async () => {
    const B = await feature('build')
    const c = mainClips()[0]
    const res = { language: 'tr', segments: [{ start: 0.1, end: 1.0, text: 'bu oyun tam efsane', words: [{ w: 'bu', s: 0.1, e: 0.3 }, { w: 'oyun', s: 0.3, e: 0.55 }, { w: 'tam', s: 0.55, e: 0.7 }, { w: 'efsane', s: 0.7, e: 1.0 }] }] }
    const style = REG.captionStyles.list[0]
    const clips = captionClipsFromResult(B, res, c, { language: 'tr', styleId: style && style.id, maxWords: 2, uppercase: true, emoji: true, highlightKeywords: true })
    store.edit('Altyazı (test)', d => B.insertCaptions(d, clips))
    return { n: clips.length, first: clips[0] && clips[0].text.content, font: clips[0] && clips[0].text.font, style: clips[0] && clips[0].caption.styleId }
  })
  await step('tts', async () => {
    const m = await ttsModule()
    if (!m || !m.synthesize) return 'modül yok'
    const vs = await m.listVoices()
    const v = vs.find(x => x.installed && /^tr/i.test(x.lang)) || vs.find(x => x.installed)
    if (!v) return 'kurulu ses yok'
    const r = await m.synthesize('Merhaba, bu bir deneme.', { voice: v.id })
    const ids = await importFiles([r.path], { role: 'voice' })
    const id = placeAudioOnNewTrack(ids[0], 1, 'voice', 'TTS')
    return { voice: v.id, dur: r.duration, words: r.words ? r.words.length : 0, clip: !!id }
  })
  await step('layout', async () => { const d = REG.layouts.list[0]; if (!d) return 'paket yok'; const r0 = store.get().rev; await insertLibraryItem({ kind: 'layout', id: d.id }); return store.get().rev - r0 })
  R.features = Object.fromEntries(['recorder', 'silence', 'beats', 'highlights', 'tts', 'models', 'whisper', 'build', 'subtitles', 'sfx'].map(k => [k, hasFeature(k)]))
  R.previews = previewStats()
  R.counts = Object.fromEntries(Object.entries(REG).map(([k, v]) => [k, v.list.length]))
  R.undo = store.get().history.past.length
  return R
}

// Paketi henüz gelmeyen türler için test öğeleri (yalnız bu sayfada)
function testItems() {
  if (!REG.layouts.list.length) register('layouts', [
    { id: 'test-facecam-ust', name: 'Facecam üstte', category: 'facecam', regions: [{ x: 0, y: 0, w: 1, h: 0.36, kind: 'cam' }, { x: 0, y: 0.36, w: 1, h: 0.64, kind: 'game' }],
      apply: (d) => { const m = d.tracks.find(t => t.main); if (m && m.clips[0]) { m.clips[0].transform.y = 0.18; m.clips[0].transform.scale = 1.4 } } },
    { id: 'test-pip-kose', name: 'Köşede kamera', category: 'facecam', apply: () => {} },
    { id: 'test-bolunmus', name: 'Bölünmüş ekran', category: 'bolunmus', apply: () => {} },
  ], [{ id: 'facecam', name: 'Facecam' }, { id: 'bolunmus', name: 'Bölünmüş' }])
  if (!REG.music.list.length) {
    const loop = (f) => (ctx) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'triangle'; o.connect(g); g.connect(ctx.destination); for (let i = 0; i < 16; i++) { o.frequency.setValueAtTime(f * [1, 1.25, 1.5, 2][i % 4], i * 0.25); g.gain.setValueAtTime(0.3, i * 0.25); g.gain.linearRampToValueAtTime(0.02, i * 0.25 + 0.22) } o.start(0); o.stop(4) }
    register('music', [
      { id: 'test-lofi', name: 'Test lofi döngüsü', category: 'lofi', duration: 4, bpm: 90, synth: loop(220) },
      { id: 'test-epik', name: 'Test epik döngü', category: 'epik', duration: 4, bpm: 120, synth: loop(330) },
    ], [{ id: 'lofi', name: 'Lo-fi' }, { id: 'epik', name: 'Epik' }])
  }
}

async function boot() {
  await initPacks().catch(() => null)
  testItems()
  store.loadProject(createProject({ ratio: '9:16', name: 'Kütüphane testi' }))
  const root = createRoot(document.getElementById('root'))
  root.render(<Shell />)
  let mediaId = null
  if (isElectron) {
    try {
      const f = await makeMedia()
      const ids = await importFiles([f])
      mediaId = ids[0]
      A.addMediaToTimeline(mediaId, 0)
      await waitReady(mediaId)
    } catch (e) { console.error('medya', e) }
  }
  window.__lib = {
    setTab: t => store.setUI({ leftTab: t }),
    checks: () => checks().then(r => JSON.stringify(r)),
    stats: () => previewStats(),
    sample: m => setSampleMode(m),
    packs: loadedPacks,
  }
  window.__libReady = true
  window.__done = true
  console.log('hazır · paketler: ' + loadedPacks.join(','))
}
boot()
