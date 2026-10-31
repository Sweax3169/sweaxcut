// Altyazı sekmesi: üç görünüm — Oluştur (konuşma → kelime zamanlı altyazı), Metin (satırları belge gibi düzenle),
// Stil (yazı, vurgu, hareket, konum, kaydedilmiş stiller). Altyazı varsa panel doğrudan Metin'de açılır.
import React, { useEffect, useMemo, useState } from 'react'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import { playback } from '../../engine/playback.js'
import { Slider, Toggle } from '../controls.jsx'
import { isElectron } from '../../platform/node.js'
import { PanelHead, useRegVersion, lsGet, lsSet, Bar, useTabState } from './common.jsx'
import { captionJob, cancelCaptions } from './jobs.js'
import { hasFeature, feature } from './features.js'
import { runCaptions, captionSources, importSubtitleFile, modelList, modelInstalled, downloadModel } from './captions-run.js'
import { captionGroups } from '../../features/captions/edit.js'
import { REG } from '../../engine/registry.js'
import { usePlayhead } from '../inspector/hooks.js'
import Transcript from '../captions/Transcript.jsx'
import { StyleGallery, CaptionStyleEditor, applyStyleToGroup } from '../captions/CaptionStyle.jsx'

const LANGS = [['tr', 'Türkçe'], ['en', 'English'], ['auto', 'Otomatik']]
const MORE_LANGS = [['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'], ['ru', 'Русский'], ['ar', 'العربية'], ['pt', 'Português'], ['it', 'Italiano'], ['ja', '日本語'], ['ko', '한국어'], ['az', 'Azərbaycanca']]
const QUALITY = [
  { id: 'small', name: 'Hızlı', hint: 'Videonun ~5 katı hızda' },
  { id: 'medium', name: 'Doğru', hint: 'En az hata · önerilen' },
  { id: 'large-v3-turbo', name: 'Büyük', hint: 'Çok dilli, en yavaş' },
]

function useObs(o) {
  const [v, setV] = useState(o.get())
  useEffect(() => o.sub(setV), [o])
  return v
}

export default function CaptionsPanel() {
  useRegVersion()
  const job0 = useObs(captionJob)
  const project = useStore(s => s.project)
  // başka projenin bitmiş işinin mesajı gösterilmez
  const job = job0.running || !job0.projectId || job0.projectId === project.id ? job0 : { ...job0, done: null, error: null }
  const groups = useMemo(() => captionGroups(project), [project])
  const [st, set] = useTabState('captions', { view: null, gid: null })
  const view = st.view && (st.view === 'create' || groups.length) ? st.view : (groups.length ? 'text' : 'create')
  const group = groups.find(g => g.groupId === st.gid) || groups[groups.length - 1] || null
  // başka bir panel belirli görünümü isteyebilir (denetçideki Stil paneli düğmesi)
  const want = useStore(s => s.ui.capView)
  useEffect(() => { if (want && want.v) set({ view: want.v }) }, [want]) // eslint-disable-line
  // yeni altyazı bitince Metin görünümüne geç
  useEffect(() => { if (job.done && !job.running && groups.length) set({ view: 'text', gid: groups[groups.length - 1].groupId }) }, [job.done]) // eslint-disable-line

  return (
    <div className="lib-main cap-panel">
      <PanelHead title="Altyazı" right={groups.length > 0 && (
        <div className="ibtns cap-views">
          {[['create', 'Oluştur', 'plus'], ['text', 'Metin', 'type'], ['style', 'Stil', 'sparkle']].map(([v, l, ic]) => (
            <button key={v} className={'ib' + (view === v ? ' on' : '')} onClick={() => set({ view: v })}><Icon name={ic} size={12} />{l}</button>
          ))}
        </div>
      )} />
      {job.running && <JobCard job={job} />}
      {!job.running && job.error && <div className="lib-note warn"><Icon name="warn" size={14} /><span>{job.error}</span></div>}
      {groups.length > 1 && view !== 'create' && (
        <div className="cap-group">
          <select className="field" value={group ? group.groupId : ''} onChange={e => set({ gid: e.target.value })}>
            {groups.map((g, i) => <option key={g.groupId} value={g.groupId}>Altyazı {i + 1} · {g.clips.length} satır · {Math.floor(g.start / 60)}:{String(Math.floor(g.start % 60)).padStart(2, '0')}</option>)}
          </select>
        </div>
      )}
      {view === 'create' && <CreateView />}
      {view === 'text' && group && <Transcript group={group} />}
      {view === 'style' && group && <StyleView group={group} />}
    </div>
  )
}

function JobCard({ job }) {
  return (
    <div className="cap-job">
      <div className="row"><span className="cap-spin" /><span className="grow" style={{ fontWeight: 620 }}>{job.label || 'Konuşma çözümleniyor…'}</span><span className="mono dim" style={{ fontSize: 11 }}>{Math.round((job.progress || 0) * 100)}%</span></div>
      <Bar value={job.progress} indet={!job.progress} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="faint" style={{ fontSize: 11 }}>Bilgisayarında çalışır, internet gerekmez.</span>
        <button className="btn sm danger" onClick={cancelCaptions}><Icon name="x" size={12} />Durdur</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- oluştur
function CreateView() {
  const job0 = useObs(captionJob)
  const pid = useStore(s => s.project.id)
  const job = job0.running || !job0.projectId || job0.projectId === pid ? job0 : { ...job0, done: null, error: null }
  const selCount = useStore(s => s.selection.clips.length)
  const rev = useStore(s => s.rev)
  const [o, setO] = useState(() => lsGet('caps', { source: 'main', language: 'tr', model: null, styleId: 'alt-hormozi', maxWords: 3, uppercase: true, emoji: false, highlightKeywords: true, markFillers: false, vad: true }))
  const upd = p => setO(x => { const n = { ...x, ...p }; lsSet('caps', n); return n })
  const [models, setModels] = useState([])
  const [inst, setInst] = useState({})
  const [dl, setDl] = useState(null)
  const [engineOk, setEngineOk] = useState(true)
  const available = hasFeature('whisper') && hasFeature('build') && engineOk
  useEffect(() => { feature('whisper').then(W => { if (W && W.isAvailable) { try { setEngineOk(!!W.isAvailable()) } catch (e) { /* */ } } }) }, [])
  useEffect(() => {
    let alive = true
    modelList().then(async list => {
      const s = {}
      for (const m of list) s[m.id] = await modelInstalled(m.id)
      if (!alive) return
      setModels(list); setInst(s)
      if (!o.model || !list.some(m => m.id === o.model) || !s[o.model]) {
        const best = ['medium', 'small', 'large-v3-turbo', 'base', 'tiny'].find(id => s[id]) || 'small'
        upd({ model: best })
      }
    })
    return () => { alive = false }
  }, []) // eslint-disable-line
  const src = useMemo(() => captionSources(o.source), [o.source, selCount, rev]) // eslint-disable-line
  const model = models.find(m => m.id === o.model)
  const installed = model ? inst[model.id] : false
  const getModel = async (id) => {
    const ctrl = new AbortController()
    setDl({ id, p: 0, ctrl })
    try {
      await downloadModel(id, p => setDl({ id, p, ctrl }), ctrl.signal)
      setInst(s => ({ ...s, [id]: true }))
      store.toast('Model indirildi', 'ok', 1600)
    } catch (e) {
      if (!ctrl.signal.aborted) store.toast('Model indirilemedi: ' + (e.message || e), 'error', 4000)
    } finally { setDl(null) }
  }
  const lang = o.language || 'tr'
  const total = src.reduce((a, c) => a + c.duration, 0)
  const start = () => runCaptions({ ...o })

  return (
    <div className="lib-body">
      {!available && <div className="lib-note warn"><Icon name="info" size={14} /><span>Konuşma tanıma motoru bulunamadı. Altyazı dosyası içe aktarabilirsin.</span></div>}
      <div className="cap-hero">
        <div className="cap-hero-t">
          <b>Konuşmayı altyazıya çevir</b>
          <span>Her kelime söylendiği anda vurgulanır.</span>
        </div>
        <div className="ibtns seg">
          {[['main', 'Ana iz'], ['selected', 'Seçili klip'], ['voice', 'Seslendirme']].map(([v, l]) => (
            <button key={v} className={'ib' + (o.source === v ? ' on' : '')} onClick={() => upd({ source: v })}>{l}</button>
          ))}
        </div>
        <div className={'cap-src' + (src.length ? '' : ' no')}>
          <Icon name={src.length ? 'wave' : 'warn'} size={13} />
          {src.length ? `${src.length} sesli klip · ${total.toFixed(1)} sn` : o.source === 'selected' ? 'Zaman çizelgesinde sesli bir klip seç' : 'Sesli klip yok — önce video ekle'}
        </div>

        <div className="cap-f">
          <span className="lb">Dil</span>
          <div className="ibtns">
            {LANGS.map(([v, l]) => <button key={v} className={'ib' + (lang === v ? ' on' : '')} onClick={() => upd({ language: v })}>{l}</button>)}
            <select className="cap-more" value={MORE_LANGS.some(x => x[0] === lang) ? lang : ''} onChange={e => e.target.value && upd({ language: e.target.value })}>
              <option value="">Diğer…</option>
              {MORE_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="cap-f">
          <span className="lb">Doğruluk</span>
          <div className="cap-q">
            {QUALITY.map(q => {
              const m = models.find(x => x.id === q.id)
              const ok = inst[q.id]
              const busy = dl && dl.id === q.id
              return (
                <button key={q.id} className={'cap-qi' + (o.model === q.id ? ' on' : '')} onClick={() => upd({ model: q.id })}>
                  <b>{q.name}</b>
                  <span>{q.hint}</span>
                  <i className={ok ? 'ok' : ''}>{busy ? Math.round(dl.p * 100) + '%' : ok ? 'Hazır' : m && m.size ? Math.round(m.size / 1e6) + ' MB' : '—'}</i>
                </button>
              )
            })}
          </div>
          {model && !installed && !dl && (
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => getModel(model.id)} disabled={!isElectron}><Icon name="import" size={12} />{model.name} modelini indir{model.size ? ` · ${Math.round(model.size / 1e6)} MB` : ''}</button>
          )}
          {dl && <div className="row" style={{ gap: 8 }}><Bar value={dl.p} /><button className="ibtn sm" onClick={() => dl.ctrl.abort()}><Icon name="x" size={12} /></button></div>}
        </div>

        {job.running ? null : (
          <button className="btn sig xl cap-go" onClick={start} disabled={!available || !src.length || !isElectron}>
            <Icon name="caption" size={18} />Altyazı oluştur
          </button>
        )}
        {job.done && !job.running && !job.error && <div className="cap-done"><Icon name="check" size={13} sw={2.4} />{job.done}</div>}
      </div>

      <div className="lib-sect"><div className="edge"><b>Stil</b><span className="faint">· sonra da değiştirebilirsin</span></div></div>
      <div style={{ padding: '6px 12px 4px' }}>
        <StyleGallery value={o.styleId} onPick={id => upd({ styleId: id, ...(stylePick(id)) })} compact />
      </div>

      <div className="lib-sect"><div className="edge"><b>Ayarlar</b></div></div>
      <div className="lib-form">
        <div className="prop"><span className="lbl static">Satırda kelime</span><Slider value={o.maxWords} min={1} max={8} step={1} def={3} onChange={v => upd({ maxWords: v })} /><span className="mono dim" style={{ width: 24, textAlign: 'right', fontSize: 12 }}>{o.maxWords}</span></div>
        <Toggle label="BÜYÜK HARF" on={o.uppercase} onChange={v => upd({ uppercase: v })} />
        <Toggle label="Emoji ekle" on={o.emoji} onChange={v => upd({ emoji: v })} hint="Anahtar kelimelere uygun emoji ekler" />
        <Toggle label="Müzik ve oyun sesini atla" on={o.vad !== false} onChange={v => upd({ vad: v })} hint="Konuşma olmayan bölümleri ses etkinliği algılamasıyla atlar; uydurma yazıyı önler" />
        <Toggle label="Önemli kelimeleri vurgula" on={o.highlightKeywords} onChange={v => upd({ highlightKeywords: v })} />
        <Toggle label="Dolgu kelimelerini işaretle" on={o.markFillers} onChange={v => upd({ markFillers: v })} hint="ııı, şey, yani gibi kelimelere zaman çizelgesinde işaret koyar" />
        <div className="lib-actions" style={{ marginTop: 4 }}>
          <button className="btn" onClick={importSubtitleFile} disabled={!isElectron}><Icon name="import" size={13} />SRT / VTT / ASS içe aktar</button>
        </div>
      </div>
    </div>
  )
}

function stylePick(id) {
  const s = REG.captionStyles.byId.get(id)
  return s ? { maxWords: s.words || 3, uppercase: s.uppercase ?? true, emoji: !!s.emoji } : {}
}

// ---------------------------------------------------------------- stil
function StyleView({ group }) {
  // temsilci satır: oynatma kafasındaki ya da ilk satır
  const now = usePlayhead(6)
  const clip = group.clips.find(c => now >= c.start && now < c.start + c.duration) || group.clips[0]
  // stil düzenlerken önizleme bir altyazıyı göstersin
  useEffect(() => {
    const inside = group.clips.some(c => playback.time >= c.start && playback.time < c.start + c.duration)
    if (!inside && group.clips[0]) { playback.pause(); playback.seek(group.clips[0].start + Math.min(0.6, group.clips[0].duration * 0.5)) }
  }, [group.groupId]) // eslint-disable-line
  return (
    <div className="lib-body">
      <div className="lib-sect"><div className="edge"><b>Hazır stiller</b><span className="faint">· bütün satırlara uygulanır</span></div></div>
      <div style={{ padding: '6px 12px 4px' }}>
        <StyleGallery value={clip.caption.styleId} onPick={id => applyStyleToGroup(group.groupId, id)} compact />
      </div>
      <div className="lib-sect"><div className="edge"><b>Özelleştir</b></div></div>
      <CaptionStyleEditor gid={group.groupId} clip={clip} />
    </div>
  )
}
