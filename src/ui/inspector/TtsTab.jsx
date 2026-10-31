// SESLENDİR: metni sese çevir (src/features/tts — çevrimdışı Piper / Windows sesleri), sesi içe aktar,
// yazının başlangıcına "konuşma" rolüyle ses klibi koy; clip.tts = { voice, rate, pitch, audioClipId }
import React, { useEffect, useState } from 'react'
import { store } from '../../core/store.js'
import { importFiles } from '../../core/media.js'
import { deleteClips } from '../../core/timeline.js'
import { shortTime } from '../../core/time.js'
import * as A from '../actions.js'
import Icon from '../Icon.jsx'
import { Select } from '../controls.jsx'
import { Sec, Row, Note } from './common.jsx'

const ttsMods = import.meta.glob('../../features/tts/index.js')
const loadTts = () => { const k = Object.keys(ttsMods)[0]; return k ? ttsMods[k]() : Promise.resolve(null) }

export default function TtsTab({ ctx }) {
  const { clip, b } = ctx
  const tts = clip.tts || {}
  const [mod, setMod] = useState(undefined)
  const [voices, setVoices] = useState([])
  const [defId, setDefId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  useEffect(() => {
    let dead = false
    loadTts().then(async m => {
      if (dead) return
      setMod(m || null)
      if (!m) return
      try {
        const list = (await (m.listVoices ? m.listVoices() : [])) || []
        const d = m.defaultVoice ? await m.defaultVoice('tr-TR') : null
        if (dead) return
        // Türkçe ve kurulu sesler önce
        list.sort((a, c) => ((c.lang === 'tr-TR') - (a.lang === 'tr-TR')) || ((c.installed ? 1 : 0) - (a.installed ? 1 : 0)))
        setVoices(list)
        setDefId(d ? d.id : (list.find(v => v.installed) || {}).id || null)
      } catch (e) { console.warn('ses listesi alınamadı', e) }
    }).catch(e => { console.warn('tts modülü yüklenemedi', e); if (!dead) setMod(null) })
    return () => { dead = true }
  }, [])
  const voice = tts.voice || defId || ''
  const rate = tts.rate ?? 1, pitch = tts.pitch ?? 0
  const setT = (k, label) => (v, o) => { b.edit(c => { c.tts = { voice, rate, pitch, ...(c.tts || {}), [k]: v } }, label, 'tts:' + clip.id + k); if (o && o.final) store.endCoalesce() }
  const text = ((clip.text && clip.text.content) || '').trim()
  const prevClip = tts.audioClipId && store.get().project.tracks.some(t => t.clips.some(c => c.id === tts.audioClipId))
  const vdef = voices.find(v => v.id === voice)
  const run = async () => {
    if (!mod || !text || typeof mod.synthesize !== 'function') return
    setBusy(true)
    try {
      const r = await mod.synthesize(text, {
        voice: voice || undefined, rate, pitch, autoDownload: true,
        onProgress: (p) => store.busy('Ses modeli indiriliyor', p),
      })
      store.busy(null)
      const file = r && (r.path || r.file)
      if (!file) throw new Error('ses dosyası üretilmedi')
      const ids = await importFiles([file], { role: 'voice', generated: true, name: 'Seslendirme · ' + String((clip.text && clip.text.content) || '').replace(/\s+/g, ' ').slice(0, 28) })
      if (!ids.length) throw new Error('ses içe aktarılamadı')
      const textId = clip.id
      if (prevClip) store.edit('Eski seslendirmeyi kaldır', d => deleteClips(d, [tts.audioClipId], store.get().ui))
      const aid = A.addMediaToTimeline(ids[0], clip.start, { role: 'voice' })
      store.select([textId])
      A.setProps(textId, c => { c.tts = { voice, rate, pitch, audioClipId: aid } }, 'Seslendir')
      setLast(r)
      store.toast('Seslendirme eklendi' + (r.duration ? ' · ' + shortTime(r.duration) : ''), 'ok', 1800)
    } catch (e) {
      store.busy(null)
      store.toast('Seslendirilemedi: ' + String(e.message || e).slice(0, 140), 'error', 5000)
    }
    setBusy(false)
  }
  const opts = voices.length
    ? voices.map(v => ({ value: v.id, label: v.name + ' · ' + (v.langName || v.lang) + (v.installed ? '' : v.downloadable ? ' (indirilir)' : ' (yok)') }))
    : [{ value: '', label: mod === undefined ? 'Sesler yükleniyor…' : 'Varsayılan ses' }]
  return (
    <Sec id="tts" code="01" title="Metni seslendir" sub={prevClip ? 'eklendi' : null}>
      <Select label="Ses" value={voice} options={opts} onChange={v => setT('voice', 'Seslendirme sesi')(v, { final: true })} />
      {vdef && vdef.commercial === false && <Note kind="warn">Bu ses yalnız ticari olmayan kullanım içindir ({vdef.license || 'CC BY-NC-SA'}). Para kazanılan videolarda başka bir ses seç.</Note>}
      {vdef && <div className="ttsvoice"><span>{vdef.engine || ''}</span><span>{vdef.gender === 'female' ? 'Kadın' : vdef.gender === 'male' ? 'Erkek' : ''}</span><span>{vdef.quality ? String(vdef.quality) : ''}</span><span className={vdef.installed ? 'ok' : ''}>{vdef.installed ? 'Kurulu' : vdef.downloadable ? 'İndirilecek' : 'Yok'}</span></div>}
      <Row label="Hız" value={rate} min={0.5} max={2} step={0.05} digits={2} suffix="×" def={1} onChange={setT('rate', 'Konuşma hızı')} />
      <Row label="Perde" value={pitch} min={-12} max={12} step={1} suffix=" yt" def={0} onChange={setT('pitch', 'Ses perdesi')} />
      <div className="ttsquote">“{text.length > 140 ? text.slice(0, 140) + '…' : text || '—'}”</div>
      <button className="btn sig ttsgo" disabled={!mod || !text || busy} onClick={run}>
        <Icon name="tts" size={14} />{busy ? 'Seslendiriliyor…' : prevClip ? 'Yeniden seslendir' : 'Seslendir'}
      </button>
      {mod === null && <Note kind="warn">Seslendirme modülü yüklenemedi.</Note>}
      {mod === undefined && <Note>Modül yükleniyor…</Note>}
      {last && last.words && last.words.length > 0 && <Note>{last.words.length} kelime zamanlandı · {shortTime(last.duration || 0)}</Note>}
      {prevClip && <Note>Konuşma klibi yazının başlangıcında. Yeniden seslendirmek eskisinin yerini alır.</Note>}
    </Sec>
  )
}
