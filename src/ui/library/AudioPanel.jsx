// Ses sekmesi: müzik, ses efektleri, seslendirme kaydı, metinden sese.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import { store } from '../../core/store.js'
import { REG } from '../../engine/registry.js'
import { createTextClip } from '../../core/model.js'
import * as TL from '../../core/timeline.js'
import { importFiles } from '../../core/media.js'
import { fileUrl, isElectron } from '../../platform/node.js'
import { Slider, Toggle, openMenu } from '../controls.jsx'
import {
  PanelHead, SearchBox, Chips, useTabState, useRegVersion, useFiltered, catCounts, useFavs, toggleFav,
  dragStart, dragEnd, useIncremental, lsGet, lsSet, useRecent,
} from './common.jsx'
import { synthBuffer, insertAudioDef, placeAudioOnNewTrack, now } from './insert.js'
import { recorderState, levelObs, listInputs, startRecording, stopRecording, observable } from './jobs.js'
import { ttsModule, hasFeature } from './features.js'

const SUBS = [
  { id: 'music', label: 'Müzik', icon: 'music' },
  { id: 'sfx', label: 'Ses efektleri', icon: 'sfx' },
  { id: 'voice', label: 'Seslendirme', icon: 'mic' },
  { id: 'tts', label: 'Metinden sese', icon: 'tts' },
]

function useObs(o) {
  const [v, setV] = useState(o.get())
  useEffect(() => o.sub(setV), [o])
  return v
}

export default function AudioPanel({ code }) {
  const [st, set] = useTabState('audio', { sub: 'music' })
  useRegVersion()
  const n = { music: REG.music.list.length, sfx: REG.sfx.list.length }
  return (
    <div className="lib-main">
      <PanelHead code={code} title="Ses" count={st.sub === 'music' || st.sub === 'sfx' ? n[st.sub] : null} unit={st.sub === 'music' ? 'parça' : 'efekt'} />
      <div className="lib-subgrid">
        {SUBS.map(s => (
          <button key={s.id} className={st.sub === s.id ? 'on' : ''} onClick={() => { stopPreview(); set({ sub: s.id }) }} title={s.label}>
            <Icon name={s.icon} size={15} />
            <span>{s.label}</span>
            {n[s.id] != null && <i className="mono">{n[s.id]}</i>}
          </button>
        ))}
      </div>
      {st.sub === 'music' && <AudioList kind="music" key="music" />}
      {st.sub === 'sfx' && <AudioList kind="sfx" key="sfx" />}
      {st.sub === 'voice' && <Recorder />}
      {st.sub === 'tts' && <TTS />}
    </div>
  )
}

// ---------------------------------------------------------------- önizleme çalar (tek AudioContext)
const playing = observable({ id: null, at: 0, dur: 0, loading: false })
let actx = null, srcNode = null
const bufCache = new Map()
export function stopPreview() {
  if (srcNode) { try { srcNode.onended = null; srcNode.stop() } catch (e) { /* */ } srcNode = null }
  playing.set({ id: null, loading: false })
}
async function togglePreview(def) {
  if (playing.get().id === def.id) { stopPreview(); return }
  stopPreview()
  playing.set({ id: def.id, loading: true, at: 0, dur: def.duration || 1 })
  try {
    let buf = bufCache.get(def.id)
    if (!buf) {
      buf = await synthBuffer(def)
      bufCache.set(def.id, buf)
      if (bufCache.size > 40) bufCache.delete(bufCache.keys().next().value)
    }
    if (playing.get().id !== def.id) return
    if (!actx) actx = new AudioContext()
    if (actx.state === 'suspended') await actx.resume()
    const s = actx.createBufferSource()
    s.buffer = buf
    s.connect(actx.destination)
    s.onended = () => { if (srcNode === s) { srcNode = null; playing.set({ id: null }) } }
    s.start()
    srcNode = s
    playing.set({ loading: false, at: actx.currentTime, dur: buf.duration })
  } catch (e) {
    store.toast('Önizleme çalınamadı: ' + (e.message || e), 'error', 3000)
    playing.set({ id: null, loading: false })
  }
}

function fmtS(t) {
  if (!Number.isFinite(t)) return '—'
  if (t < 10) return t.toFixed(1) + ' sn'
  return Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0')
}

// ---------------------------------------------------------------- müzik / sfx listesi
function AudioList({ kind }) {
  const reg = REG[kind]
  const [st, set] = useTabState('audio-' + kind, { q: '', cat: null })
  const favs = useFavs()
  const list = useFiltered(reg.list, reg.categories, { q: st.q, cat: st.cat, kind })
  const counts = useMemo(() => catCounts(reg.list), [reg.list.length]) // eslint-disable-line
  const favCount = reg.list.filter(it => favs.has(kind + ':' + it.id)).length
  const [n, sent] = useIncremental(list.length, 50, st.q + st.cat)
  const recent = useRecent(kind).map(id => reg.byId.get(id)).filter(Boolean)
  useEffect(() => () => stopPreview(), [])
  return (
    <>
      <div className="lib-tools">
        <SearchBox value={st.q} onChange={q => set({ q })} placeholder={kind === 'music' ? 'Müzik ara… (ör. lofi, epik)' : 'Ses efekti ara… (ör. whoosh, bom)'} />
        <Chips cats={reg.categories} value={st.cat} onChange={cat => set({ cat })} counts={counts} favCount={favCount} allCount={reg.list.length} />
      </div>
      <div className="lib-body">
        {!reg.list.length ? (
          <div className="lib-empty"><div className="big">{kind === 'music' ? 'Müzik yok' : 'Efekt yok'}</div><div>Ses paketi yükleniyor ya da kurulu değil.</div></div>
        ) : (
          <>
            {!st.q && !st.cat && recent.length > 0 && (
              <>
                <div className="lib-sect"><div className="edge">SON KULLANILANLAR</div></div>
                <div className="lib-rows">{recent.slice(0, 4).map(def => <ARow key={'r' + def.id} kind={kind} def={def} />)}</div>
              </>
            )}
            <div className="lib-rows">
              {list.slice(0, n).map(def => <ARow key={def.id} kind={kind} def={def} />)}
            </div>
            {n < list.length && <div ref={sent} className="lib-more mono">+{list.length - n}</div>}
            {!list.length && <div className="lib-empty"><div className="mono">EŞLEŞEN SES YOK</div></div>}
          </>
        )}
      </div>
    </>
  )
}

function ARow({ kind, def }) {
  const p = useObs(playing)
  const on = p.id === def.id
  const favs = useFavs()
  const fav = favs.has(kind + ':' + def.id)
  const [prog, setProg] = useState(0)
  useEffect(() => {
    if (!on || p.loading || !actx) { setProg(0); return }
    let raf = 0
    const tick = () => { setProg(Math.min(1, (actx.currentTime - p.at) / Math.max(0.01, p.dur))); raf = requestAnimationFrame(tick) }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [on, p.loading, p.at, p.dur])
  const cat = REG[kind].categories.find(c => c.id === def.category)
  const insert = () => { stopPreview(); insertAudioDef(kind, def, now()) }
  return (
    <div className={'arow ' + kind + (on ? ' playing' : '')} draggable
      onDragStart={e => dragStart(e, kind, def.id, def.name)} onDragEnd={dragEnd}
      onClick={() => togglePreview(def)} onDoubleClick={insert}
      onContextMenu={e => openMenu(e, [{ header: def.name }, { label: 'Oynatma kafasına ekle', icon: 'plus', onClick: insert }, { label: on ? 'Durdur' : 'Dinle', icon: on ? 'stop' : 'play', onClick: () => togglePreview(def) }, { label: fav ? 'Favorilerden çıkar' : 'Favorilere ekle', icon: 'star', onClick: () => toggleFav(kind, def.id) }])}
      title="Tıkla: dinle · Çift tık / + : ekle · Sürükle: zaman çizelgesine bırak">
      <div className="cover">
        <Cover id={def.id} kind={kind} />
        <span className="pp">{on && p.loading ? <span className="mono" style={{ fontSize: 8 }}>…</span> : <Icon name={on ? 'stop' : 'play'} size={11} />}</span>
      </div>
      <div className="meta">
        <div className="n">{def.name}</div>
        <div className="s">{(cat ? cat.name : def.category || '').toLocaleUpperCase('tr-TR')} · {fmtS(def.duration)}{def.bpm ? ' · ' + def.bpm + ' BPM' : ''}</div>
      </div>
      <div className="acts">
        <button className={'ibtn sm' + (fav ? ' on' : '')} title="Favori" onClick={e => { e.stopPropagation(); toggleFav(kind, def.id) }}><Icon name="star" size={13} fill={fav} /></button>
        <button className="addb" title="Oynatma kafasına ekle" onClick={e => { e.stopPropagation(); insert() }}><Icon name="plus" size={14} sw={2.2} /></button>
      </div>
      {on && !p.loading && <span className="pbar" style={{ width: prog * 100 + '%' }} />}
    </div>
  )
}

// Kimliğe göre belirlenimci kapak deseni
function Cover({ id, kind }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = 80; c.height = 80
    const x = c.getContext('2d')
    let h = 2166136261
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
    const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000 }
    x.fillStyle = kind === 'music' ? '#0c1714' : '#15130a'
    x.fillRect(0, 0, 80, 80)
    const col = kind === 'music' ? '#2ee6a6' : '#e4ff3a'
    x.fillStyle = col
    const bars = 10
    for (let i = 0; i < bars; i++) {
      const v = 0.2 + r() * 0.75
      x.globalAlpha = 0.35 + v * 0.6
      x.fillRect(6 + i * 7, 74 - v * 60, 4, v * 60)
    }
    x.globalAlpha = 1
  }, [id, kind])
  return <canvas ref={ref} />
}

// ---------------------------------------------------------------- seslendirme kaydı
function Recorder() {
  const rs = useObs(recorderState)
  const [devs, setDevs] = useState([])
  const [prefs, setPrefs] = useState(() => lsGet('rec', { deviceId: '', noiseSuppression: true, echoCancellation: false, countdown: true, playAlong: false }))
  const upd = (p) => setPrefs(o => { const n = { ...o, ...p }; lsSet('rec', n); return n })
  const [, tick] = useState(0)
  useEffect(() => { listInputs().then(setDevs) }, [])
  useEffect(() => {
    if (!rs.recording) return
    const t = setInterval(() => tick(x => x + 1), 100)
    return () => clearInterval(t)
  }, [rs.recording])
  const el = rs.recording ? (performance.now() - rs.startedAt) / 1000 : 0
  const tc = `${String(Math.floor(el / 60)).padStart(2, '0')}:${String(Math.floor(el % 60)).padStart(2, '0')}.${Math.floor((el % 1) * 10)}`
  const toggle = () => rs.recording ? stopRecording() : startRecording(prefs)
  return (
    <div className="lib-body">
      <div className="rec-deck">
        {rs.countdown > 0 && <div className="rec-count" key={rs.countdown}>{rs.countdown}</div>}
        <div className="rec-top">
          <button className={'rec-btn' + (rs.recording ? ' on' : '')} onClick={toggle} disabled={rs.starting && !rs.countdown} title={rs.recording ? 'Kaydı bitir ve ekle' : 'Kayda başla'}>
            <i /><span className="lb">{rs.recording ? 'DURDUR' : 'KAYIT'}</span>
          </button>
          <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
            <div className={'rec-time' + (rs.recording ? ' on' : '')}>{tc}</div>
            <div className={'rec-state' + (rs.recording ? ' on' : '')}>{rs.recording ? 'KAYDEDİLİYOR' : rs.starting ? 'HAZIRLANIYOR…' : 'BEKLEMEDE'}</div>
          </div>
        </div>
        <div style={{ marginTop: 6 }}><Meter active={rs.recording} /></div>
        <div className="meter-scale"><span>-60</span><span>-24</span><span>-12</span><span>-6</span><span>0 dB</span></div>
      </div>
      {rs.error && <div className="lib-note warn"><Icon name="warn" size={14} />{rs.error}</div>}
      <div className="lib-form">
        <div className="lib-label">Giriş aygıtı</div>
        <select className="field" value={prefs.deviceId} onChange={e => upd({ deviceId: e.target.value })} disabled={rs.recording}>
          <option value="">Varsayılan mikrofon</option>
          {devs.map(d => <option key={d.deviceId || d.id} value={d.deviceId || d.id}>{d.label || d.name}</option>)}
        </select>
        <Toggle label="Gürültü bastırma" on={prefs.noiseSuppression} onChange={v => upd({ noiseSuppression: v })} />
        <Toggle label="Yankı engelleme" on={prefs.echoCancellation} onChange={v => upd({ echoCancellation: v })} />
        <Toggle label="3 sn geri sayım" on={prefs.countdown} onChange={v => upd({ countdown: v })} />
        <Toggle label="Videoyu oynat" on={prefs.playAlong} onChange={v => upd({ playAlong: v })} hint="Kayıt sırasında zaman çizelgesi oynatılır (kulaklık önerilir)" />
        <div className="lib-hint">Kayıt <b>oynatma kafasından</b> başlar ve bitince <b>yeni bir ses izine</b> yerleştirilir.</div>
      </div>
    </div>
  )
}

function Meter({ active }) {
  const lv = useObs(levelObs)
  const seg = 28
  const db = v => v > 0 ? 20 * Math.log10(v) : -90
  const k = v => Math.max(0, Math.min(1, (db(v) + 60) / 60))
  const on = Math.round(k(active ? lv.level : 0) * seg)
  const pk = Math.round(k(active ? lv.peak : 0) * seg)
  return (
    <div className="meter">
      {Array.from({ length: seg }, (_, i) => {
        const cls = (i < on || i === pk - 1 ? 'on' : '') + (i >= seg * 0.8 ? ' r' : i >= seg * 0.6 ? ' y' : '')
        return <i key={i} className={cls} />
      })}
    </div>
  )
}

// ---------------------------------------------------------------- metinden sese
let voicesCache = null
async function loadVoices() {
  const m = await ttsModule()
  let list = []
  if (m && m.listVoices) { try { list = await m.listVoices() } catch (e) { list = [] } }
  else if (window.speechSynthesis) {
    list = window.speechSynthesis.getVoices().map(v => ({ id: 'sys:' + v.name, name: v.name, lang: v.lang, system: true, installed: true }))
  }
  list = (list || []).map(v => ({ ...v, id: v.id || v.name }))
  // Türkçe önce, sonra kurulu olanlar, sonra ad
  const tr = v => /^tr/i.test(v.lang || v.language || '') ? 0 : 1
  const ok = v => v.installed === false ? (v.downloadable === false ? 2 : 1) : 0
  list.sort((a, b) => tr(a) - tr(b) || ok(a) - ok(b) || String(a.name).localeCompare(String(b.name), 'tr'))
  return { list, mod: m && m.synthesize ? m : null }
}

function TTS() {
  const [text, setText] = useState(() => lsGet('ttsText', 'Selam! Bugün bu oyunda inanılmaz bir şey denedik.'))
  const [opts, setOpts] = useState(() => lsGet('ttsOpts', { voice: null, rate: 1, pitch: 0, volume: 1, caption: true }))
  const [voices, setVoices] = useState(voicesCache ? voicesCache.list : [])
  const [mod, setMod] = useState(voicesCache ? voicesCache.mod : null)
  const [busy, setBusy] = useState(null)
  const audio = useRef(null)
  const upd = (p) => setOpts(o => { const n = { ...o, ...p }; lsSet('ttsOpts', n); return n })
  useEffect(() => {
    let alive = true
    loadVoices().then(r => {
      if (!alive) return
      voicesCache = r; setVoices(r.list); setMod(r.mod)
      const cur = r.list.find(v => v.id === opts.voice)
      if ((!cur || cur.installed === false) && r.list[0]) upd({ voice: (r.list.find(v => v.installed !== false) || r.list[0]).id })
    })
    if (window.speechSynthesis && !hasFeature('tts')) window.speechSynthesis.onvoiceschanged = () => loadVoices().then(r => { if (alive) { setVoices(r.list); if (!opts.voice && r.list[0]) upd({ voice: r.list[0].id }) } })
    return () => { alive = false; if (audio.current) audio.current.pause() }
  }, []) // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => lsSet('ttsText', text), 400); return () => clearTimeout(t) }, [text])
  const voice = voices.find(v => v.id === opts.voice) || voices[0]

  const synth = async () => {
    if (!mod) throw new Error('Metinden sese motoru kurulu değil')
    if (voice && voice.installed === false && voice.downloadable === false) throw new Error('Bu ses kurulu değil ve indirilemiyor (Piper motoru yok)')
    if (voice && voice.installed === false && mod.downloadVoice) {
      setBusy({ label: 'Ses indiriliyor', p: 0 })
      await mod.downloadVoice(voice.id, p => setBusy({ label: 'Ses indiriliyor', p }))
      setVoices(vs => vs.map(v => v.id === voice.id ? { ...v, installed: true } : v))
    }
    setBusy({ label: 'Seslendiriliyor', p: null })
    return await mod.synthesize(text, { voice: voice && voice.id, rate: opts.rate, pitch: opts.pitch, volume: opts.volume })
  }

  const preview = async () => {
    if (!text.trim()) return
    if (audio.current) { audio.current.pause(); audio.current = null }
    if (!mod && window.speechSynthesis && voice && voice.system) {
      // yalnızca dinleme: sistem sesi
      const u = new SpeechSynthesisUtterance(text)
      const sv = window.speechSynthesis.getVoices().find(v => 'sys:' + v.name === voice.id)
      if (sv) u.voice = sv
      u.rate = opts.rate; u.pitch = Math.max(0, Math.min(2, 1 + opts.pitch / 12)); u.volume = opts.volume
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u)
      return
    }
    try {
      const r = await synth()
      const a = new Audio(fileUrl(r.path))
      audio.current = a
      a.play()
    } catch (e) { store.toast(String(e.message || e), 'error', 3500) } finally { setBusy(null) }
  }

  const add = async () => {
    if (!text.trim()) return
    const t0 = now()
    try {
      const r = await synth()
      setBusy({ label: 'Ekleniyor', p: null })
      const ids = await importFiles([r.path], { role: 'voice', generated: true, name: 'Seslendirme · ' + String(text || '').replace(/\s+/g, ' ').slice(0, 28) })
      if (!ids[0]) throw new Error('ses içe aktarılamadı')
      store.edit('medya', d => { if (d.media[ids[0]]) { d.media[ids[0]].name = 'TTS · ' + text.slice(0, 28); d.media[ids[0]].generated = true } }, { noHistory: true })
      const aid = placeAudioOnNewTrack(ids[0], t0, 'voice', 'Metinden sese')
      if (opts.caption) {
        const dur = r.duration || (store.get().project.media[ids[0]] || {}).duration || 3
        const clip = createTextClip({ start: t0, duration: Math.max(0.5, dur) })
        clip.name = 'TTS altyazı'
        clip.text = { ...clip.text, content: text, size: 64, maxWidth: 0.8 }
        clip.transform = { ...clip.transform, y: 0.28 }
        if (r.words && r.words.length) clip.caption = { words: r.words.map(w => ({ w: w.w ?? w.word ?? w.text, s: w.s ?? w.start, e: w.e ?? w.end })), styleId: null, groupId: null }
        clip.tts = { voice: voice && voice.id, rate: opts.rate, pitch: opts.pitch, audioClipId: aid }
        store.edit('TTS altyazısı', d => { TL.placeClip(d, clip, {}, store.get().ui) })
      }
      store.toast('Seslendirme eklendi', 'ok', 1500)
    } catch (e) { store.toast(String(e.message || e), 'error', 3500) } finally { setBusy(null) }
  }

  return (
    <div className="lib-body">
      {!mod && (
        <div className="lib-note">
          <Icon name="info" size={14} />
          <span>{hasFeature('tts') ? 'Metinden sese motoru yükleniyor…' : 'Çevrimdışı metinden sese motoru kurulu değil. Sistem sesleriyle yalnızca dinleme yapılabilir.'}</span>
        </div>
      )}
      <div className="lib-form">
        <div className="row"><span className="lib-label grow">Metin</span><span className="mono faint" style={{ fontSize: 10 }}>{text.length} KR</span></div>
        <textarea className="field" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.stopPropagation()} spellCheck={false} placeholder="Seslendirilecek metni yaz…" />
        <div className="lib-label">Ses · {voices.length}</div>
        <div className="voice-list">
          {!voices.length && <div className="voice-it faint">Ses bulunamadı</div>}
          {voices.map(v => (
            <div key={v.id} className={'voice-it' + (voice && v.id === voice.id ? ' on' : '')} onClick={() => upd({ voice: v.id })}>
              <span className="lang">{String(v.lang || v.language || '').split(/[-_]/)[0].toUpperCase()}</span>
              <span className="vn">{v.name}{v.gender ? ' · ' + v.gender : ''}{v.langName ? <span className="faint"> · {v.langName}</span> : null}</span>
              {v.installed === false
                ? (v.downloadable === false ? <span className="tag">YOK</span> : <span className="tag">İNDİR{v.size ? ' ' + Math.round(v.size / 1e6) + 'MB' : ''}</span>)
                : (v.system || (v.engine && v.engine !== 'piper')) ? <span className="tag">SİSTEM</span> : <span className="tag ok">HAZIR</span>}
            </div>
          ))}
        </div>
        <div className="prop"><span className="lbl static">Hız</span><Slider value={opts.rate} min={0.5} max={2} step={0.05} def={1} onChange={v => upd({ rate: v })} /><span className="mono dim" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{opts.rate.toFixed(2)}×</span></div>
        <div className="prop"><span className="lbl static">Perde</span><Slider value={opts.pitch} min={-12} max={12} step={1} def={0} onChange={v => upd({ pitch: v })} /><span className="mono dim" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{opts.pitch > 0 ? '+' : ''}{opts.pitch}</span></div>
        <div className="prop"><span className="lbl static">Ses düzeyi</span><Slider value={opts.volume} min={0} max={1} step={0.01} def={1} onChange={v => upd({ volume: v })} /><span className="mono dim" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{Math.round(opts.volume * 100)}%</span></div>
        <Toggle label="Altyazı da ekle" on={opts.caption} onChange={v => upd({ caption: v })} hint="Konuşmaya denk gelen bir yazı klibi de oluşturulur" />
        {busy && (
          <div className="lib-progress">
            <div className="row"><span className="grow" style={{ fontWeight: 600 }}>{busy.label}…</span>{busy.p != null && <span className="mono">{Math.round(busy.p * 100)}%</span>}</div>
            <div className={'bar' + (busy.p == null ? ' indet' : '')}><i style={{ width: (busy.p || 0) * 100 + '%' }} /></div>
          </div>
        )}
        <div className="lib-actions">
          <button className="btn" onClick={preview} disabled={!!busy || !text.trim()}><Icon name="play" size={12} />Önizle</button>
          <button className="btn sig" onClick={add} disabled={!!busy || !mod || !text.trim() || !isElectron}><Icon name="plus" size={14} sw={2.2} />Ekle</button>
        </div>
      </div>
    </div>
  )
}
