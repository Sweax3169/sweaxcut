// Otomatik kurgu penceresi: tarif + müzik + uzunluk + altyazı → tek tıkla kurgu. autorun ile açılırsa hemen başlar.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { store, useStore } from '../../core/store.js'
import { Modal, Toggle } from '../controls.jsx'
import Icon from '../Icon.jsx'
import { REG } from '../../engine/registry.js'
import { RECIPES, recipe, runRecipe } from '../../features/autoedit/index.js'

const LENGTHS = [[15, '15 sn'], [30, '30 sn'], [60, '1 dk'], [0, 'Hepsi']]
const LANGS = [['tr', 'Türkçe'], ['en', 'İngilizce'], ['auto', 'Otomatik']]

export default function AutoEditModal({ onClose, recipe: rid = 'beat', mediaIds = null, autorun = false }) {
  const [rec, setRec] = useState(rid)
  const R = recipe(rec) || RECIPES[0]
  const [music, setMusic] = useState(R.music)
  const [musicTouched, setMusicTouched] = useState(false)
  const [length, setLength] = useState(R.length || 30)
  const [captions, setCaptions] = useState(!!R.captions)
  const [lang, setLang] = useState('tr')
  const [run, setRun] = useState(null)
  const ctrl = useRef(null)
  const started = useRef(false)
  const media = useStore(s => s.project.media)
  const hasClips = useStore(s => s.project.tracks.some(t => t.clips.length))
  const list = useMemo(() => (mediaIds || Object.keys(media)).map(id => media[id]).filter(m => m && m.type !== 'audio'), [media, mediaIds])
  const userAudio = useMemo(() => Object.values(media).filter(m => m.type === 'audio' && !m.generated), [media])
  const srcDur = list.reduce((a, m) => a + (m.type === 'image' ? 3 : (m.duration || 0)), 0)

  useEffect(() => {
    const r = recipe(rec)
    if (!r) return
    if (!musicTouched) setMusic(r.music)
    setLength(r.length || 30)
    setCaptions(!!r.captions)
  }, [rec]) // eslint-disable-line

  const start = async () => {
    if (!list.length) { store.toast('Önce video ya da fotoğraf ekle', 'info'); return }
    const ac = new AbortController()
    ctrl.current = ac
    setRun({ p: 0, label: 'Hazırlanıyor…' })
    try {
      const res = await runRecipe(rec, {
        mediaIds: list.map(m => m.id), music, length: length || 9999, captions, language: lang,
        signal: ac.signal, onProgress: (p, label) => setRun(x => ({ ...x, p, label })),
      })
      onClose()
      const capNote = res.captions && /bulunamadı|başarısız|kurulu değil|yok/i.test(res.captions) ? ' · altyazı: ' + res.captions : ''
      store.toast(`${R.name} hazır · ${res.duration.toFixed(1)} sn${capNote}`, 'ok', 3200)
      store.setUI({ coach: true })
    } catch (e) {
      if (e && e.name === 'AbortError') { setRun(null); store.toast('Otomatik kurgu durduruldu', 'info'); return }
      setRun({ error: String(e.message || e) })
    }
  }
  useEffect(() => { if (autorun && !started.current) { started.current = true; start() } }, []) // eslint-disable-line

  const musicGroups = useMemo(() => {
    const g = new Map()
    for (const m of REG.music.list) { const k = m.category || 'diğer'; if (!g.has(k)) g.set(k, []); g.get(k).push(m) }
    return [...g.entries()]
  }, [])

  if (run) {
    const steps = [
      ['Müzik', 0.1], [R.highlights ? 'Öne çıkan anlar' : R.silence ? 'Sessizlikler' : 'Klipler', 0.55], ['Kurgu', 0.62], ...(captions ? [['Altyazı', 0.98]] : []), ['Bitti', 1],
    ]
    return (
      <Modal title={run.error ? 'Kurgu yapılamadı' : R.name} edge={run.error ? null : 'Otomatik kurgu çalışıyor'} width={520}
        onClose={run.error ? onClose : null}
        footer={run.error ? <><button className="btn" onClick={() => setRun(null)}>Geri</button><button className="btn" onClick={onClose}>Kapat</button></>
          : <button className="btn danger" onClick={() => ctrl.current && ctrl.current.abort()}><Icon name="x" />Durdur</button>}>
        {run.error ? <div className="inote warn" style={{ userSelect: 'text' }}>{run.error}</div> : (
          <div className="ae-run">
            <div className="ae-orb"><Icon name={R.icon} size={30} /></div>
            <div className="ae-label">{run.label}</div>
            <div className="bar"><i style={{ width: Math.max(3, (run.p || 0) * 100) + '%' }} /></div>
            <div className="ae-steps">
              {steps.map(([n, at], i) => {
                const prev = i ? steps[i - 1][1] : 0
                const st = run.p >= at ? 'ok' : run.p >= prev ? 'on' : ''
                return <span key={n} className={st}>{st === 'ok' ? <Icon name="check" size={12} sw={2.4} /> : <i />}{n}</span>
              })}
            </div>
          </div>
        )}
      </Modal>
    )
  }

  return (
    <Modal title="Otomatik kurgu" edge={`${list.length} klip · ${Math.round(srcDur)} sn kaynak`} onClose={onClose} width={820}
      footer={<>
        {hasClips && <span className="faint" style={{ marginRight: 'auto', fontSize: 12 }}>Zaman çizelgesindeki kurgunun yerine geçer · Ctrl+Z geri alır</span>}
        <button className="btn" onClick={onClose}>Vazgeç</button>
        <button className="btn sig lg" onClick={start} disabled={!list.length}><Icon name="wand" size={16} />Kurguyu oluştur</button>
      </>}>
      <div className="ae-grid">
        <div className="ae-list">
          {RECIPES.map(r => (
            <button key={r.id} className={'ae-rc' + (r.id === rec ? ' on' : '')} onClick={() => setRec(r.id)}>
              <span className="ic"><Icon name={r.icon} size={16} /></span>
              <span className="tt"><b>{r.name}</b><span>{r.desc}</span></span>
            </button>
          ))}
        </div>
        <div className="ae-opts">
          <div className="ae-f">
            <span className="lb">Müzik</span>
            <select className="field" value={music || 'none'} onChange={e => { setMusic(e.target.value); setMusicTouched(true) }}>
              <option value="none">Müzik yok</option>
              {userAudio.length > 0 && <optgroup label="Projedeki sesler">{userAudio.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
              {musicGroups.map(([k, items]) => (
                <optgroup key={k} label={k[0].toLocaleUpperCase('tr-TR') + k.slice(1)}>
                  {items.map(m => <option key={m.id} value={m.id}>{m.name}{m.bpm ? ` · ${m.bpm} BPM` : ''}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="hint">Kesimler müziğin vuruşuna oturur.</span>
          </div>
          {R.id !== 'talk' && (
            <div className="ae-f">
              <span className="lb">Uzunluk</span>
              <div className="ibtns">
                {LENGTHS.map(([v, l]) => <button key={v} className={'ib' + (length === v ? ' on' : '')} onClick={() => setLength(v)}>{l}</button>)}
              </div>
            </div>
          )}
          <div className="ae-f">
            <label className="ae-toggle">
              <span className="tt"><b>Otomatik altyazı</b><span>Konuşmayı kelime kelime yazar ve vurgular.</span></span>
              <Toggle on={captions} onChange={setCaptions} />
            </label>
            {captions && (
              <div className="ibtns">
                {LANGS.map(([v, l]) => <button key={v} className={'ib' + (lang === v ? ' on' : '')} onClick={() => setLang(v)}>{l}</button>)}
              </div>
            )}
          </div>
          <div className="ae-sum">
            <Icon name="info" size={14} />
            <span>{{
              beat: 'Her vuruşta kesim, ölçü başlarında zoom geçişi, canlı renk.',
              talk: 'Sessiz yerler kesilir, kesimlerde sıçrama zoomu, ses netleşir, müzik konuşmada kısılır.',
              game: 'Sesin patladığı anlar bulunur; her an zoomla vurgulanır, aralar flaşla geçer.',
              vlog: 'Klipler sırayla, yumuşak geçiş ve altın saat rengiyle; başta tarih başlığı.',
              slides: 'Her fotoğraf bir ölçü boyunca yavaşça yakınlaşır ya da kayar.',
              recap: 'Uzun videonun en hareketli yerlerinden hızlı kesimler.',
            }[R.id]}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
