// Araçlar sekmesi: akıllı kurgu araçları (her biri açılır kart: ayarlar + çalıştır + sonuç).
import React, { useEffect, useState } from 'react'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import { Slider, Toggle } from '../controls.jsx'
import { isElectron } from '../../platform/node.js'
import { PanelHead, lsGet, lsSet } from './common.jsx'
import { hasFeature, feature } from './features.js'
import { playback } from '../../engine/playback.js'
import * as T from './tools.js'

function useTarget(types) {
  // seçim / oynatma kafası değişince hedef yeniden hesaplanır
  useStore(s => s.selection.clips[s.selection.clips.length - 1])
  useStore(s => s.rev)
  return T.targetClip(types)
}

function Target({ clip, types }) {
  return <div className="tool-res">Hedef: {clip ? <b>{clip.name || clip.type}</b> : <span style={{ color: 'var(--danger)' }}>{types === 'video' ? 'bir video klip seç' : 'sesli bir klip seç'}</span>}</div>
}

async function withBusy(label, fn) {
  store.busy(label, 0)
  try { return await fn(p => store.busy(label, Math.max(0, Math.min(1, p || 0)))) } catch (e) {
    store.toast(String(e.message || e), 'error', 4000)
    return null
  } finally { store.busy(null) }
}

const HEAD = [
  { id: 'silence', icon: 'silence', title: 'Sessizlikleri kes', desc: 'Konuşmadaki boşlukları bulur ve tek tıkla çıkarır.', B: SilenceTool },
  { id: 'captions', icon: 'caption', title: 'Otomatik altyazı', desc: 'Konuşmayı yazıya döker, kelime kelime vurgulu altyazı.', action: () => store.setUI({ leftTab: 'captions' }) },
  { id: 'highlights', icon: 'highlight', title: 'Öne çıkanları bul', desc: 'Heyecanlı anları işaretler, isteğe bağlı otomatik yakınlaştırır.', B: HighlightsTool },
  { id: 'beats', icon: 'beat', title: 'Vuruşları bul', desc: 'Müziğin vuruşlarını işaretler; kesimler vuruşa yapışır.', B: BeatsTool },
]
// features/video yoksa yerel yedekler
const VIDEO_FALLBACK = [
  { id: 'scenes', icon: 'scene', title: 'Sahne algıla', desc: 'Kamera / sahne değişimlerinde klibi otomatik böler.', B: ScenesTool },
  { id: 'stab', icon: 'stabilize', title: 'Sabitle', desc: 'Titreyen görüntüyü yumuşatır (iki geçişli vidstab).', B: StabTool },
]
const TAIL = [
  { id: 'chroma', icon: 'chroma', title: 'Krom anahtar', desc: 'Yeşil perdeyi siler; klibi seçip ayarları açar.', action: () => { const c = T.chromaKey(); if (!c) store.toast('Önce bir video/görsel klip seç', 'info') } },
  { id: 'shorts', icon: 'ratio', title: "Uzun videoyu Shorts'a böl", desc: 'Ana izi eşit parçalara ya da öne çıkan anlara böler, işaret koyar.', B: ShortsTool },
  { id: 'normalize', icon: 'volume', title: 'Ses seviyesini eşitle', desc: 'Bütün kliplerin yüksekliğini aynı seviyeye getirir.', B: AudioTool },
]
const VIDEO_ORDER = ['scene-split', 'stabilize', 'bg-remove', 'auto-reframe', 'zoom-punch']
const vidx = id => { const i = VIDEO_ORDER.indexOf(id); return i < 0 ? 99 : i }

let videoToolsCache = null
function useVideoTools() {
  const [list, setList] = useState(videoToolsCache)
  useEffect(() => {
    if (videoToolsCache || !hasFeature('video')) return
    feature('video').then(V => {
      const tools = V && Array.isArray(V.TOOLS) ? V.TOOLS.filter(t => t.id !== 'highlight-zoom').sort((a, b) => vidx(a.id) - vidx(b.id)) : []
      videoToolsCache = tools.map(t => ({ id: 'v:' + t.id, icon: t.icon || 'film', title: t.name, desc: t.description, tool: t }))
      setList(videoToolsCache)
    })
  }, [])
  return list
}

export default function ToolsPanel({ code }) {
  const [open, setOpen] = useState(() => lsGet('toolOpen', 'silence'))
  const toggle = id => { const v = open === id ? null : id; setOpen(v); lsSet('toolOpen', v) }
  const vt = useVideoTools()
  const tools = [...HEAD, ...(hasFeature('video') ? (vt || []) : VIDEO_FALLBACK), ...TAIL]
  return (
    <div className="lib-main">
      <PanelHead code={code} title="Araçlar" count={tools.length} unit="araç" />
      <div className="lib-body">
        {!isElectron && <div className="lib-note"><Icon name="info" size={14} />Araçlar masaüstü uygulamasında (ffmpeg ile) çalışır.</div>}
        <div className="tool-list">
          {tools.map((t, i) => (
            <div key={t.id} className={'tool' + (open === t.id ? ' open' : '')}>
              <div className="tool-h" onClick={() => t.action ? t.action() : toggle(t.id)}>
                <span className="ic"><Icon name={t.icon} size={17} /></span>
                <span className="tt"><b>{t.title}</b><span>{t.desc}</span></span>
                {t.action ? <Icon name="chevR" size={14} style={{ color: 'var(--tx-2)' }} /> : <Icon name="chevD" size={14} style={{ color: 'var(--tx-2)', transform: open === t.id ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />}
                <span className="code">AI·{String(i + 1).padStart(2, '0')}</span>
              </div>
              {open === t.id && (t.B || t.tool) && <div className="tool-b">{t.tool ? <VideoTool tool={t.tool} /> : <t.B />}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// features/video araçları: seçenekleri tanımından çizilir, runTool ile çalışır (iptal edilebilir)
function VideoTool({ tool }) {
  const clip = useTarget(['video'])
  const defs = {}
  for (const o of tool.options || []) defs[o.key] = o.default
  const [o, setO] = useState(() => ({ ...defs, ...lsGet('vt:' + tool.id, {}) }))
  const upd = p => setO(x => { const n = { ...x, ...p }; lsSet('vt:' + tool.id, n); return n })
  const [job, setJob] = useState(null)
  const [msg, setMsg] = useState(null)
  const go = async () => {
    const V = await feature('video')
    if (!V || !V.runTool) return
    const ctrl = new AbortController()
    setJob({ ctrl, p: 0 }); setMsg(null)
    const label = tool.name + '…'
    store.busy(label, 0)
    try {
      const r = await V.runTool(tool.id, {
        time: playback.time, options: o, signal: ctrl.signal,
        onProgress: p => { const v = typeof p === 'number' ? p : (p && p.progress) || 0; store.busy(label, Math.max(0, Math.min(1, v))); setJob(j => j && { ...j, p: v }) },
      })
      if (r && r.message) setMsg(r.message)
    } catch (e) { setMsg(null) } finally { store.busy(null); setJob(null) }
  }
  return (
    <>
      <Target clip={clip} types="video" />
      {(tool.options || []).map(op => (
        <div key={op.key} className="prop">
          <span className="lbl static" title={op.label}>{op.label}</span>
          {op.type === 'range' ? (
            <>
              <Slider value={+o[op.key]} min={op.min} max={op.max} step={op.step || 0.01} def={op.default} onChange={v => upd({ [op.key]: v })} />
              <span className="mono dim" style={{ width: 38, textAlign: 'right', fontSize: 11 }}>{(+o[op.key]).toFixed(op.step >= 1 ? 0 : 2)}</span>
            </>
          ) : op.type === 'select' ? (
            <select className="field grow" value={String(o[op.key])} onChange={e => { const raw = e.target.value; const opt = op.options.find(x => String(x.value) === raw); upd({ [op.key]: opt ? opt.value : raw }) }}>
              {op.options.map(x => <option key={String(x.value)} value={String(x.value)}>{x.label}</option>)}
            </select>
          ) : op.type === 'bool' ? (
            <span className={'toggle' + (o[op.key] ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => upd({ [op.key]: !o[op.key] })} />
          ) : null}
        </div>
      ))}
      {msg && <div className="tool-res">{msg}</div>}
      <div className="lib-actions">
        {job ? (
          <button className="btn danger" onClick={() => job.ctrl.abort()}><Icon name="x" size={13} />İptal · {Math.round((job.p || 0) * 100)}%</button>
        ) : (
          <button className="btn sig" onClick={go} disabled={!clip || !isElectron}><Icon name={tool.icon || 'magic'} size={13} />Çalıştır</button>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- araç gövdeleri
function SilenceTool() {
  const clip = useTarget(['video', 'audio'])
  const [o, setO] = useState(() => lsGet('silence', { threshold: -38, minDur: 0.5, pad: 0.12 }))
  const upd = p => setO(x => { const n = { ...x, ...p }; lsSet('silence', n); return n })
  const [res, setRes] = useState(null)
  const analyze = () => withBusy('Sessizlikler aranıyor…', async prog => { const r = await T.analyzeSilences(clip, o, prog); setRes(r); if (!r.cuts.length) store.toast('Kesilecek sessizlik bulunamadı', 'info') })
  const apply = () => {
    if (!res || !res.cuts.length) return
    const n = T.applyCuts(res.clipId, res.cuts)
    store.toast(`${n} sessizlik kesildi · ${res.total.toFixed(1)} sn kısaldı`, 'ok', 2200)
    setRes(null)
  }
  const stale = res && clip && res.clipId !== clip.id
  return (
    <>
      <Target clip={clip} />
      <div className="prop"><span className="lbl static">Eşik</span><Slider value={o.threshold} min={-60} max={-15} step={1} def={-38} onChange={v => { upd({ threshold: v }); setRes(null) }} /><span className="mono dim" style={{ width: 46, textAlign: 'right', fontSize: 11 }}>{o.threshold} dB</span></div>
      <div className="prop"><span className="lbl static">En kısa</span><Slider value={o.minDur} min={0.2} max={2} step={0.05} def={0.5} onChange={v => { upd({ minDur: v }); setRes(null) }} /><span className="mono dim" style={{ width: 46, textAlign: 'right', fontSize: 11 }}>{o.minDur.toFixed(2)} s</span></div>
      <div className="prop"><span className="lbl static">Pay</span><Slider value={o.pad} min={0} max={0.5} step={0.01} def={0.12} onChange={v => { upd({ pad: v }); setRes(null) }} /><span className="mono dim" style={{ width: 46, textAlign: 'right', fontSize: 11 }}>{o.pad.toFixed(2)} s</span></div>
      {res && !stale && <div className="tool-res"><b>{res.cuts.length}</b> SESSİZLİK · <b>{res.total.toFixed(1)}</b> SN KAZANÇ</div>}
      <div className="lib-actions">
        <button className="btn" onClick={analyze} disabled={!clip || !isElectron}><Icon name="search" size={13} />Analiz et</button>
        <button className="btn sig" onClick={apply} disabled={!res || stale || !res.cuts.length}><Icon name="scissors" size={13} />Kes</button>
      </div>
      {!hasFeature('silence') && <div className="lib-hint">ffmpeg silencedetect ile çalışır.</div>}
    </>
  )
}

function BeatsTool() {
  const clip = useTarget(['audio', 'video'])
  const [res, setRes] = useState(null)
  const run = () => withBusy('Vuruşlar aranıyor…', async prog => { const r = await T.findBeats(clip, prog); setRes(r); store.toast(`${r.count} vuruş işaretlendi`, 'ok', 1800) })
  return (
    <>
      <Target clip={clip} />
      {res && <div className="tool-res"><b>{res.count}</b> VURUŞ{res.bpm ? <> · <b>{Math.round(res.bpm)}</b> BPM</> : null}</div>}
      <div className="lib-actions"><button className="btn sig" onClick={run} disabled={!clip || !isElectron}><Icon name="beat" size={13} />Vuruşları bul</button></div>
      <div className="lib-hint">Vuruşlar ses klibinde işaretlenir; yakalama açıkken kesimler vuruşlara yapışır.</div>
    </>
  )
}

function HighlightsTool() {
  const [o, setO] = useState(() => lsGet('hl', { count: 6, zoom: true, strength: 0.18, scope: 'main' }))
  const upd = p => setO(x => { const n = { ...x, ...p }; lsSet('hl', n); return n })
  const clip = useTarget(['video', 'audio'])
  const run = () => withBusy('Öne çıkan anlar aranıyor…', async prog => {
    const p = store.get().project
    let clips = []
    if (o.scope === 'main') { const m = p.tracks.find(t => t.main); clips = m ? m.clips.filter(c => c.type === 'video') : [] } else if (clip) clips = [clip]
    if (!clips.length) throw new Error('Klip yok')
    const n = await T.findHighlights(clips, o, prog)
    store.toast(n ? `${n} öne çıkan an işaretlendi${o.zoom ? ' + yakınlaştırma' : ''}` : 'Öne çıkan an bulunamadı', n ? 'ok' : 'info', 2000)
  })
  return (
    <>
      <div className="prop"><span className="lbl static">Kapsam</span>
        <div className="row grow" style={{ gap: 0, border: '1px solid var(--line-2)' }}>
          {[['main', 'Ana iz'], ['clip', 'Seçili klip']].map(([v, l], i) => <button key={v} onClick={() => upd({ scope: v })} style={{ flex: 1, height: 22, fontSize: 11, fontWeight: 600, borderLeft: i ? '1px solid var(--line-2)' : 0, color: o.scope === v ? 'var(--sig-ink)' : 'var(--tx-1)', background: o.scope === v ? 'var(--sig)' : 'transparent' }}>{l}</button>)}
        </div>
      </div>
      {o.scope === 'clip' && <Target clip={clip} />}
      <div className="prop"><span className="lbl static">Adet</span><Slider value={o.count} min={1} max={20} step={1} def={6} onChange={v => upd({ count: v })} /><span className="mono dim" style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{o.count}</span></div>
      <Toggle label="Otomatik yakınlaştır" on={o.zoom} onChange={v => upd({ zoom: v })} hint="Her anda kısa bir 'zoom punch' anahtar karesi ekler" />
      {o.zoom && <div className="prop"><span className="lbl static">Güç</span><Slider value={o.strength} min={0.05} max={0.5} step={0.01} def={0.18} onChange={v => upd({ strength: v })} /><span className="mono dim" style={{ width: 30, textAlign: 'right', fontSize: 11 }}>{Math.round(o.strength * 100)}%</span></div>}
      <div className="lib-actions"><button className="btn sig" onClick={run} disabled={!isElectron}><Icon name="highlight" size={13} />Bul ve işaretle</button></div>
    </>
  )
}

function ScenesTool() {
  const clip = useTarget(['video'])
  const [thr, setThr] = useState(() => lsGet('scene', 0.35))
  const run = () => withBusy('Sahneler algılanıyor…', async prog => { const n = await T.detectScenes(clip, thr, prog); store.toast(n ? `${n} sahne değişiminde bölündü` : 'Sahne değişimi bulunamadı', n ? 'ok' : 'info', 2000) })
  return (
    <>
      <Target clip={clip} types="video" />
      <div className="prop"><span className="lbl static">Hassasiyet</span><Slider value={1 - thr} min={0.4} max={0.9} step={0.01} def={0.65} onChange={v => { setThr(1 - v); lsSet('scene', 1 - v) }} /><span className="mono dim" style={{ width: 34, textAlign: 'right', fontSize: 11 }}>{Math.round((1 - thr) * 100)}%</span></div>
      <div className="lib-actions"><button className="btn sig" onClick={run} disabled={!clip || !isElectron}><Icon name="scene" size={13} />Algıla ve böl</button></div>
    </>
  )
}

function StabTool() {
  const clip = useTarget(['video'])
  const [lvl, setLvl] = useState(2)
  const run = () => withBusy('Sabitleniyor…', async prog => { await T.stabilize(clip, lvl, prog); store.toast('Sabitlenmiş kopya hazır', 'ok', 2000) })
  return (
    <>
      <Target clip={clip} types="video" />
      <div className="prop"><span className="lbl static">Güç</span>
        <div className="row grow" style={{ gap: 0, border: '1px solid var(--line-2)' }}>
          {[[1, 'Hafif'], [2, 'Orta'], [3, 'Güçlü']].map(([v, l], i) => <button key={v} onClick={() => setLvl(v)} style={{ flex: 1, height: 22, fontSize: 11, fontWeight: 600, borderLeft: i ? '1px solid var(--line-2)' : 0, color: lvl === v ? 'var(--sig-ink)' : 'var(--tx-1)', background: lvl === v ? 'var(--sig)' : 'transparent' }}>{l}</button>)}
        </div>
      </div>
      {clip && clip.stabilize > 0 && <div className="tool-res">Sabitleme açık · güç <b>{clip.stabilize}</b></div>}
      <div className="lib-actions">
        <button className="btn sig" onClick={run} disabled={!clip || !isElectron}><Icon name="stabilize" size={13} />Sabitle</button>
        {clip && clip.stabilize > 0 && <button className="btn" onClick={() => store.edit('Sabitlemeyi kapat', d => { for (const t of d.tracks) for (const c of t.clips) if (c.id === clip.id) c.stabilize = 0 })}>Kapat</button>}
      </div>
      <div className="lib-hint">Uzun kayıtlarda birkaç dakika sürebilir; sonuç önbelleğe yazılır.</div>
    </>
  )
}

function ShortsTool() {
  const [sec, setSec] = useState(() => lsGet('shorts', 60))
  const dur = useStore(s => { const m = s.project.tracks.find(t => t.main); return m ? m.clips.reduce((e, c) => Math.max(e, c.start + c.duration), 0) : 0 })
  const n = Math.max(1, Math.ceil(Math.max(0, dur - 3) / sec))
  const run = () => { const k = T.splitForShorts(sec); store.toast(k ? `${k} parça işaretlendi` : 'Bölünecek kadar uzun değil', k ? 'ok' : 'info', 2000) }
  const fromMarkers = () => {
    const ms = store.get().project.markers.filter(m => /öne çıkan/i.test(m.label || '')).map(m => m.time)
    if (!ms.length) { store.toast('Önce "Öne çıkanları bul" ile an işaretle', 'info'); return }
    const k = T.splitForShorts(sec, ms.map(t => Math.max(0, t - 2)))
    store.toast(`${k} parça işaretlendi`, 'ok', 2000)
  }
  return (
    <>
      <div className="prop"><span className="lbl static">Parça süresi</span><Slider value={sec} min={15} max={180} step={5} def={60} onChange={v => { setSec(v); lsSet('shorts', v) }} /><span className="mono dim" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{sec} s</span></div>
      <div className="tool-res">Ana iz <b>{dur.toFixed(0)}</b> sn → <b>{dur > sec ? n : 1}</b> parça</div>
      <div className="lib-actions">
        <button className="btn sig" onClick={run} disabled={dur <= sec}><Icon name="scissors" size={13} />Eşit böl</button>
        <button className="btn" onClick={fromMarkers}><Icon name="highlight" size={13} />Öne çıkanlardan</button>
      </div>
    </>
  )
}

function AudioTool() {
  const run = (key, value, filter, label, msg) => { const n = T.setAudioFlag(key, value, filter, label); store.toast(n ? `${n} klip: ${msg}` : 'Sesli klip yok', n ? 'ok' : 'info', 1800) }
  return (
    <>
      <div className="lib-actions"><button className="btn sig" onClick={() => run('normalize', true, undefined, 'Ses seviyesini eşitle', 'yükseklik eşitlendi')}><Icon name="volume" size={13} />Tümünü eşitle</button></div>
      <div className="lib-actions">
        <button className="btn sm" onClick={() => run('denoise', 60, c => c.type === 'video' || c.role === 'voice' || c.role === 'extracted', 'Gürültü azalt', 'gürültü azaltma açıldı')}>Gürültü azalt</button>
        <button className="btn sm" onClick={() => run('enhance', true, c => c.role === 'voice' || c.role === 'extracted' || c.type === 'video', 'Sesi netleştir', 'ses netleştirildi')}>Sesi netleştir</button>
        <button className="btn sm" onClick={() => run('duck', true, c => c.role === 'voice', 'Konuşmada müziği kıs', 'konuşmada müzik kısılacak')}>Müziği kıs</button>
      </div>
      <div className="lib-hint"><b>Eşitle</b> bütün kliplerde loudnorm açar; dışa aktarmada uygulanır.</div>
    </>
  )
}
