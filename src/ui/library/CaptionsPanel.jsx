// Altyazı sekmesi: otomatik altyazı (whisper), stil seçimi, altyazı dosyası içe/dışa aktarma.
import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import { REG } from '../../engine/registry.js'
import { Slider, Toggle } from '../controls.jsx'
import { isElectron } from '../../platform/node.js'
import { PanelHead, useRegVersion, lsGet, lsSet, Bar } from './common.jsx'
import { captionJob, cancelCaptions } from './jobs.js'
import { hasFeature, feature } from './features.js'
import { runCaptions, captionSources, importSubtitleFile, exportSubtitleFile, modelList, modelInstalled, downloadModel } from './captions-run.js'
import { sampleA } from './samples.js'

const LANGS = [
  ['tr', 'Türkçe'], ['auto', 'Otomatik algıla'], ['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'],
  ['ru', 'Русский'], ['ar', 'العربية'], ['pt', 'Português'], ['it', 'Italiano'], ['ja', '日本語'], ['ko', '한국어'], ['az', 'Azərbaycanca'],
]

function useObs(o) {
  const [v, setV] = useState(o.get())
  useEffect(() => o.sub(setV), [o])
  return v
}

let bgUrl = null
function sampleBg() {
  if (!bgUrl) { try { bgUrl = sampleA(176, 176).toDataURL('image/jpeg', 0.7) } catch (e) { bgUrl = '' } }
  return bgUrl
}

export default function CaptionsPanel({ code }) {
  useRegVersion()
  const job = useObs(captionJob)
  const selCount = useStore(s => s.selection.clips.length)
  const hasMain = useStore(s => s.project.tracks.some(t => t.main && t.clips.length))
  const [o, setO] = useState(() => lsGet('caps', { source: 'main', language: 'tr', model: null, styleId: null, maxWords: 3, uppercase: true, emoji: false, highlightKeywords: true, markFillers: false }))
  const upd = p => setO(x => { const n = { ...x, ...p }; lsSet('caps', n); return n })
  const [models, setModels] = useState([])
  const [inst, setInst] = useState({})
  const [dl, setDl] = useState(null)
  const styles = REG.captionStyles.list
  const style = styles.find(s => s.id === o.styleId) || styles[0]
  const [engineOk, setEngineOk] = useState(true)
  const available = hasFeature('whisper') && hasFeature('build') && engineOk
  useEffect(() => { feature('whisper').then(W => { if (W && W.isAvailable) { try { setEngineOk(!!W.isAvailable()) } catch (e) { /* */ } } }) }, [])

  useEffect(() => {
    let alive = true
    modelList().then(async list => {
      if (!alive) return
      setModels(list)
      const st = {}
      for (const m of list) st[m.id] = await modelInstalled(m.id)
      if (!alive) return
      setInst(st)
      if (!o.model || !list.find(m => m.id === o.model)) {
        const pick = list.find(m => st[m.id] && m.default) || list.find(m => st[m.id]) || list.find(m => m.default) || list[0]
        if (pick) upd({ model: pick.id })
      }
    })
    return () => { alive = false }
  }, []) // eslint-disable-line

  const model = models.find(m => m.id === o.model)
  const installed = model ? inst[model.id] : false
  const src = useMemo(() => captionSources(o.source), [o.source, selCount, hasMain]) // eslint-disable-line

  const getModel = async () => {
    if (!model) return
    const ctrl = new AbortController()
    setDl({ p: 0, ctrl })
    try {
      await downloadModel(model.id, p => setDl({ p, ctrl }), ctrl.signal)
      setInst(s => ({ ...s, [model.id]: true }))
      store.toast(model.name + ' modeli indirildi', 'ok', 1600)
    } catch (e) {
      if (!ctrl.signal.aborted) store.toast('Model indirilemedi: ' + (e.message || e), 'error', 4000)
    } finally { setDl(null) }
  }

  const start = () => runCaptions({ ...o, styleId: style ? style.id : null, maxWords: o.maxWords })

  return (
    <div className="lib-main">
      <PanelHead code={code} title="Altyazı" count={styles.length} unit="stil" />
      <div className="lib-body">
        {!available && (
          <div className="lib-note"><Icon name="info" size={14} /><span>{hasFeature('whisper') && !engineOk ? 'Konuşma tanıma motoru bulunamadı (vendor/whisper).' : 'Konuşma tanıma motoru (whisper) henüz kurulu değil.'} Altyazı dosyası içe aktarabilirsin.</span></div>
        )}
        <div className="lib-sect"><div className="edge"><b>OTOMATİK</b> ALTYAZI</div></div>
        <div className="lib-form">
          <div className="prop">
            <span className="lbl static">Kaynak</span>
            <div className="row grow" style={{ gap: 0, border: '1px solid var(--line-2)' }}>
              {[['main', 'Ana iz'], ['selected', 'Seçili klip'], ['voice', 'Seslendirme']].map(([v, l], i) => (
                <button key={v} onClick={() => upd({ source: v })} style={{ flex: 1, height: 24, fontSize: 11, fontWeight: 600, borderLeft: i ? '1px solid var(--line-2)' : 0, color: o.source === v ? 'var(--sig-ink)' : 'var(--tx-1)', background: o.source === v ? 'var(--sig)' : 'transparent' }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="lib-hint mono" style={{ fontSize: 10, marginTop: -4, paddingLeft: 100 }}>{src.length ? `${src.length} KLİP · ${src.reduce((a, c) => a + c.duration, 0).toFixed(1)} SN` : 'SESLİ KLİP YOK'}</div>
          <div className="prop">
            <span className="lbl static">Dil</span>
            <select className="field grow" value={o.language} onChange={e => upd({ language: e.target.value })}>
              {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="prop">
            <span className="lbl static">Model</span>
            <select className="field grow" value={o.model || ''} onChange={e => upd({ model: e.target.value })} disabled={!models.length}>
              {!models.length && <option value="">— model yok —</option>}
              {models.map(m => <option key={m.id} value={m.id}>{m.name}{m.label ? ' · ' + m.label : ''}{m.size ? ` · ${Math.round(m.size / 1e6)} MB` : ''}{inst[m.id] ? '  ✓ kurulu' : ''}</option>)}
            </select>
          </div>
          {model && model.desc && <div className="lib-hint" style={{ paddingLeft: 100, marginTop: -4 }}>{model.desc}</div>}
          {model && !installed && !dl && (
            <div className="row" style={{ paddingLeft: 100 }}>
              <button className="btn sm" onClick={getModel} disabled={!isElectron}><Icon name="import" size={12} />Modeli indir{model.size ? ` · ${Math.round(model.size / 1e6)} MB` : ''}</button>
            </div>
          )}
          {dl && (
            <div className="lib-progress">
              <div className="row"><span className="grow" style={{ fontWeight: 600 }}>Model indiriliyor…</span><span className="mono">{Math.round(dl.p * 100)}%</span><button className="ibtn sm" onClick={() => dl.ctrl.abort()} title="İptal"><Icon name="x" size={12} /></button></div>
              <Bar value={dl.p} />
            </div>
          )}
        </div>

        <div className="lib-sect"><div className="edge"><b>STİL</b> {styles.length}</div></div>
        {styles.length ? (
          <div className="grid lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', paddingTop: 8 }}>
            {styles.map(s => <CapStyleCard key={s.id} s={s} on={style && style.id === s.id} onPick={() => upd({ styleId: s.id, maxWords: s.words || o.maxWords, uppercase: s.uppercase ?? o.uppercase, emoji: s.emoji ?? o.emoji })} />)}
          </div>
        ) : <div className="lib-empty" style={{ padding: 14 }}><div className="mono">ALTYAZI STİLİ YÜKLENMEDİ · VARSAYILAN KULLANILIR</div></div>}

        <div className="lib-form">
          <div className="prop"><span className="lbl static">Satır başına</span><Slider value={o.maxWords} min={1} max={8} step={1} def={3} onChange={v => upd({ maxWords: v })} /><span className="mono dim" style={{ width: 52, textAlign: 'right', fontSize: 11 }}>{o.maxWords} kelime</span></div>
          <Toggle label="BÜYÜK HARF" on={o.uppercase} onChange={v => upd({ uppercase: v })} />
          <Toggle label="Emoji ekle" on={o.emoji} onChange={v => upd({ emoji: v })} hint="Anahtar kelimelere uygun emoji ekler" />
          <Toggle label="Anahtar kelime vurgusu" on={o.highlightKeywords} onChange={v => upd({ highlightKeywords: v })} />
          <Toggle label="Dolgu kelimelerini işaretle" on={o.markFillers} onChange={v => upd({ markFillers: v })} hint="ııı, şey, yani… gibi kelimeleri işaretler (zaman çizelgesinde işaret)" />
          {job.running ? (
            <div className="lib-progress">
              <div className="row"><span className="grow" style={{ fontWeight: 600 }}>{job.label || 'Çözümleniyor…'}</span><span className="mono">{Math.round((job.progress || 0) * 100)}%</span></div>
              <Bar value={job.progress} indet={!job.progress} />
              <button className="btn sm danger" onClick={cancelCaptions}><Icon name="x" size={12} />İptal</button>
            </div>
          ) : (
            <button className="btn sig lg" onClick={start} disabled={!available || !src.length || !model || !isElectron}>
              <Icon name="caption" size={16} />Altyazı oluştur
            </button>
          )}
          {job.error && !job.running && <div className="lib-note warn" style={{ margin: 0 }}><Icon name="warn" size={14} />{job.error}</div>}
          {job.done && !job.running && !job.error && <div className="lib-hint mono" style={{ fontSize: 10 }}>{job.done}</div>}
        </div>

        <div className="lib-sect"><div className="edge"><b>DOSYA</b> SRT · VTT · ASS</div></div>
        <div className="lib-form">
          <div className="lib-actions">
            <button className="btn" onClick={importSubtitleFile} disabled={!isElectron}><Icon name="import" size={13} />İçe aktar</button>
            <button className="btn" onClick={() => exportSubtitleFile('srt')} disabled={!isElectron}><Icon name="export" size={13} />Dışa aktar (SRT)</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stil önizlemesi (HTML/CSS) — üzerine gelince aktif kelime ilerler
const WORDS = ['BU', 'OYUN', 'TAM', 'EFSANE']
function CapStyleCard({ s, on, onPick }) {
  const [i, setI] = useState(1)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    if (!hover) { setI(1); return }
    const t = setInterval(() => setI(x => (x + 1) % WORDS.length), 380)
    return () => clearInterval(t)
  }, [hover])
  const tx = s.text || {}
  const act = s.active || {}
  const stroke = tx.stroke && tx.stroke.enabled !== false && tx.stroke.width ? `${Math.max(1, tx.stroke.width / 8)}px ${tx.stroke.color || '#000'}` : null
  const shadow = tx.shadow && tx.shadow.enabled ? `0 2px 4px ${tx.shadow.color || '#000'}` : '0 1px 2px rgba(0,0,0,0.6)'
  const words = (s.words ? WORDS.slice(0, Math.max(2, Math.min(4, s.words))) : WORDS.slice(0, 3))
  const upper = s.uppercase !== false
  return (
    <div className={'card lib-card cap-card' + (on ? ' sel' : '')} onClick={onPick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} title={s.name}>
      <div className="thumb" style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${sampleBg()})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="cap-prev" style={{ fontFamily: `"${tx.font || 'Archivo Black'}", Archivo, sans-serif`, fontWeight: tx.weight || 900, fontStyle: tx.italic ? 'italic' : 'normal' }}>
          {words.map((w, k) => {
            const isAct = k === i % words.length
            const past = k < i % words.length
            const st = isAct ? act : past ? (s.past || {}) : (s.future || {})
            const bg = isAct && act.bg ? act.bg : null
            return (
              <span key={k} style={{
                color: st.color || (isAct ? act.color : null) || tx.color || '#fff',
                opacity: st.opacity ?? 1,
                WebkitTextStroke: stroke || undefined,
                paintOrder: 'stroke fill',
                textShadow: act.glow && isAct ? `0 0 8px ${act.glow.color || '#fff'}` : shadow,
                background: bg ? (bg.color || bg) : undefined,
                padding: bg ? '0 3px' : undefined,
                borderRadius: bg ? Math.min(4, (bg.radius || 0) / 4) : undefined,
                transform: isAct && act.scale ? `scale(${Math.min(1.25, act.scale)})` : undefined,
                transition: 'transform 90ms steps(2)',
              }}>{upper ? w : w.toLocaleLowerCase('tr-TR')}</span>
            )
          })}
        </div>
      </div>
      <div className="name">{s.name}</div>
    </div>
  )
}
