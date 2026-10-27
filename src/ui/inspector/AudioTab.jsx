// SES: seviye (dB), sessiz, yumuşak giriş/çıkış, pan, perde, ses değiştirici, iyileştirme, EQ, ayırma, rol, vuruşlar
import React, { useState } from 'react'
import { store } from '../../core/store.js'
import { defaultAudio } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import * as A from '../actions.js'
import Icon from '../Icon.jsx'
import { Toggle, Select } from '../controls.jsx'
import { Sec, Row, Note, ParamControls, IconBtns } from './common.jsx'
import { useReg, useRegCats } from './hooks.js'

const beatMods = import.meta.glob('../../features/audio/beats.js')
export const hasBeats = Object.keys(beatMods).length > 0

export const dB = (g) => (g <= 0.0001 ? '−∞' : (20 * Math.log10(g) >= 0 ? '+' : '−') + Math.abs(20 * Math.log10(g)).toFixed(1))
const panTxt = (p) => (Math.abs(p) < 0.005 ? 'ORTA' : (p < 0 ? 'SOL ' : 'SAĞ ') + Math.round(Math.abs(p) * 100))

function EqCurve({ eq }) {
  const W = 290, H = 44
  const y = (db) => H / 2 - (db / 12) * (H / 2 - 5)
  const pts = [[0, eq.low], [0.18, eq.low], [0.5, eq.mid], [0.82, eq.high], [1, eq.high]]
  let d = ''
  for (let i = 0; i <= 60; i++) {
    const x = i / 60
    let k = 1
    while (k < pts.length - 1 && pts[k][0] < x) k++
    const a = pts[k - 1], c = pts[k]
    const t = (x - a[0]) / Math.max(1e-6, c[0] - a[0])
    const s = t * t * (3 - 2 * t)
    d += (i ? 'L' : 'M') + (x * W).toFixed(1) + ' ' + y(a[1] + (c[1] - a[1]) * s).toFixed(1)
  }
  return (
    <svg className="eqcurve" width={W} height={H}>
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--line-3)" strokeDasharray="3 3" />
      {[0.18, 0.5, 0.82].map(x => <line key={x} x1={x * W} x2={x * W} y1="0" y2={H} stroke="var(--line)" />)}
      <path d={d + `L${W} ${H / 2} L0 ${H / 2} Z`} fill="var(--sig-glow)" />
      <path d={d} fill="none" stroke="var(--sig)" strokeWidth="1.5" />
      <text x="4" y={H - 4} className="cax">BAS</text><text x={W / 2} y={H - 4} className="cax" textAnchor="middle">ORTA</text><text x={W - 4} y={H - 4} className="cax" textAnchor="end">TİZ</text>
    </svg>
  )
}

export function VoiceSection({ ctx, code, all }) {
  const { clip, b } = ctx
  const list = useReg('voiceFx')
  const cats = useRegCats('voiceFx')
  const [more, setMore] = useState(!!all)
  const cur = clip.audio && clip.audio.voiceFx
  const def = cur && cur.id ? regGet('voiceFx', cur.id) : null
  const set = (d) => b.edit(c => {
    c.audio = { ...defaultAudio(), ...(c.audio || {}) }
    if (!d) { c.audio.voiceFx = null; return }
    const params = {}
    for (const p of d.params || []) params[p.key] = p.default
    c.audio.voiceFx = { id: d.id, params }
  }, d ? 'Ses değiştirici: ' + d.name : 'Ses değiştiriciyi kaldır')
  return (
    <Sec id="vfx" code={code} title="Ses değiştirici" sub={def ? def.name : null}>
      {(() => {
        const tile = d => (
          <button key={d.id} className={'vt' + (cur && cur.id === d.id ? ' on' : '')} onClick={() => set(d)} data-tip={d.name}>
            <Icon name="mic" size={12} /><span>{d.name}</span>
          </button>
        )
        const none = <button key="_" className={'vt' + (!cur ? ' on' : '')} onClick={() => set(null)}><Icon name="x" size={12} /><span>Yok</span></button>
        const curIdx = cur ? list.findIndex(d => d.id === cur.id) : -1
        if (!more) {
          const head = list.slice(0, 9)
          if (curIdx >= 9) head.push(list[curIdx])
          return (
            <div className="vgrid">
              {none}{head.map(tile)}
              {list.length > head.length && <button className="vt more" onClick={() => setMore(true)}><Icon name="plus" size={12} /><span>{list.length - head.length} ses daha</span></button>}
            </div>
          )
        }
        const groups = []
        for (const d of list) { let g = groups.find(x => x.id === d.category); if (!g) groups.push(g = { id: d.category, items: [] }); g.items.push(d) }
        return (
          <>
            <div className="vgrid">{none}</div>
            {groups.map(g => (
              <div key={g.id || '_'} className="vgroup">
                <div className="edge">{(cats.find(c => c.id === g.id) || {}).name || g.id || 'Diğer'}</div>
                <div className="vgrid">{g.items.map(tile)}</div>
              </div>
            ))}
            {!all && <button className="btn sm ghost" onClick={() => setMore(false)}><Icon name="chevU" size={11} />Daralt</button>}
          </>
        )
      })()}
      {!list.length && <Note>Ses değiştirici paketi yüklenmedi.</Note>}
      {def && def.params && def.params.length > 0 && (
        <ParamControls schema={def.params} values={cur.params}
          onChange={(k, v, o) => { b.edit(c => { c.audio.voiceFx.params = { ...(c.audio.voiceFx.params || {}), [k]: v } }, 'Ses değiştirici ayarı', 'vfx:' + clip.id + k); if (o && o.final) store.endCoalesce() }} />
      )}
      {cur && <Note>İşlenmiş ses önbelleğe yazılır; ilk dinlemede kısa bir hazırlık olabilir.</Note>}
    </Sec>
  )
}

export function LevelSection({ ctx, code }) {
  const { clip, b } = ctx
  const au = { ...defaultAudio(), ...(clip.audio || {}) }
  const vol = b.val('audio.volume', 1)
  const maxFade = Math.max(0.1, Math.min(10, clip.duration / 2))
  return (
    <Sec id="lvl" code={code} title="Ses seviyesi" keys={{ clip, paths: ['audio.volume'] }}
      right={<button className={'ibtn sm' + (au.muted ? ' on' : '')} data-tip={au.muted ? 'Sesi aç' : 'Sessize al'} onClick={e => { e.stopPropagation(); b.setS('audio.muted', 'Sessiz')(!au.muted, { final: true }) }}>
        <Icon name={au.muted ? 'mute' : 'volume'} size={13} /></button>}
      onReset={() => b.edit(c => {
        c.audio = { ...c.audio, volume: 1, fadeIn: 0, fadeOut: 0, pan: 0, pitch: 0, muted: false }
        if (c.keyframes) delete c.keyframes['audio.volume']
      }, 'Sesi sıfırla')}>
      <Row {...b.row('audio.volume', 'Seviye', { def: 1 })} min={0} max={4} step={1} scale={100} suffix="%" badge={dB(vol) + ' dB'} disabled={au.muted} />
      <Toggle label="Sessiz" on={!!au.muted} onChange={v => b.setS('audio.muted', 'Sessiz')(v, { final: true })} />
      <Row {...b.srow('audio.fadeIn', 'Yumuşak giriş', { def: 0 })} min={0} max={maxFade} step={0.05} digits={2} suffix=" sn" />
      <Row {...b.srow('audio.fadeOut', 'Yumuşak çıkış', { def: 0 })} min={0} max={maxFade} step={0.05} digits={2} suffix=" sn" />
      <Row {...b.srow('audio.pan', 'Pan', { def: 0 })} min={-1} max={1} step={1} scale={100} badge={panTxt(au.pan)} hint="Sol (−) / sağ (+) kanal dengesi" />
      <Row {...b.srow('audio.pitch', 'Perde', { def: 0 })} min={-12} max={12} step={1} suffix=" yt" hint="Yarım ton" />
    </Sec>
  )
}

export function CleanSection({ ctx, code }) {
  const { clip, b } = ctx
  const au = { ...defaultAudio(), ...(clip.audio || {}) }
  const eq = au.eq || { low: 0, mid: 0, high: 0 }
  const setEq = (k, label) => (v, o) => { b.edit(c => { c.audio.eq = { ...(c.audio.eq || { low: 0, mid: 0, high: 0 }), [k]: v } }, label, 'eq:' + clip.id + k); if (o && o.final) store.endCoalesce() }
  const n = (au.denoise ? 1 : 0) + (au.enhance ? 1 : 0) + (au.normalize ? 1 : 0) + (au.duck ? 1 : 0)
  const eqOn = eq.low || eq.mid || eq.high
  return (
    <>
      <Sec id="clean" code={code} title="İyileştirme" sub={n ? n + ' açık' : null}>
        <Row {...b.srow('audio.denoise', 'Gürültü azalt', { def: 0 })} min={0} max={100} step={1} hint="Fan, rüzgâr, uğultu (arnndn + afftdn)" />
        <Toggle label="Netleştir" on={!!au.enhance} hint="Konuşmayı öne çıkaran EQ + kompresör" onChange={v => b.setS('audio.enhance', 'Sesi netleştir')(v, { final: true })} />
        <Toggle label="Seviyeyi eşitle" on={!!au.normalize} hint="Yayın yüksekliğine eşitle (loudnorm, −14 LUFS)" onChange={v => b.setS('audio.normalize', 'Seviyeyi eşitle')(v, { final: true })} />
        <Toggle label="Konuşmada kıs" on={!!au.duck} hint="Bu klip konuşurken diğer sesleri otomatik kısar" onChange={v => b.setS('audio.duck', 'Konuşma: diğer sesleri kıs')(v, { final: true })} />
        {au.duck && <Note>Konuşma süresince müzik ve efektler kısılır.</Note>}
      </Sec>
      <Sec id="eq" code={String(+code + 1).padStart(2, '0')} title="Ekolayzer" sub={eqOn ? 'açık' : null} defaultOpen={!!eqOn}
        onReset={eqOn ? () => b.edit(c => { c.audio.eq = { low: 0, mid: 0, high: 0 } }, 'EQ sıfırla') : null}>
        <EqCurve eq={eq} />
        <Row label="Bas" value={eq.low} min={-12} max={12} step={0.5} digits={1} suffix=" dB" def={0} onChange={setEq('low', 'EQ bas')} />
        <Row label="Orta" value={eq.mid} min={-12} max={12} step={0.5} digits={1} suffix=" dB" def={0} onChange={setEq('mid', 'EQ orta')} />
        <Row label="Tiz" value={eq.high} min={-12} max={12} step={0.5} digits={1} suffix=" dB" def={0} onChange={setEq('high', 'EQ tiz')} />
      </Sec>
    </>
  )
}

const ROLES = [{ value: 'music', label: 'Müzik' }, { value: 'sfx', label: 'Ses efekti' }, { value: 'voice', label: 'Konuşma' }, { value: 'extracted', label: 'Ayrılmış ses' }]

export default function AudioTab({ ctx }) {
  const { clip, b, media } = ctx
  const isVideo = clip.type === 'video'
  const detached = clip.audio && clip.audio.detached
  return (
    <>
      {clip.type === 'audio' && (
        <div className="rolebar">
          <Select label="Rol" value={clip.role || 'music'} options={ROLES} onChange={v => b.setS('role', 'Ses rolü')(v, { final: true })} />
        </div>
      )}
      <LevelSection ctx={ctx} code="01" />
      {isVideo && <VoiceSection ctx={ctx} code="02" />}
      <CleanSection ctx={ctx} code={isVideo ? '03' : '02'} />
      {isVideo && (
        <Sec id="detach" code="05" title="Ses kanalı">
          {detached ? <Note>Ses ayrı bir klibe çıkarıldı; bu klibin kendi sesi kapalı.</Note> : (
            <IconBtns items={[{ icon: 'unlinkI', label: 'Sesi ayır', tip: 'Sesi ayrı bir ses klibine çıkar', onClick: () => A.detachAudio(), disabled: media && !media.hasAudio }]} />
          )}
        </Sec>
      )}
    </>
  )
}

// ---------------------------------------------------------------- vuruşlar (ses klibi)
export function BeatsTab({ ctx }) {
  const { clip, b, media } = ctx
  const [busy, setBusy] = useState(false)
  const [sens, setSens] = useState(0.5)
  const beats = clip.beats || []
  let bpm = null
  if (beats.length > 3) {
    const d = []
    for (let i = 1; i < beats.length; i++) d.push(beats[i] - beats[i - 1])
    d.sort((a, c) => a - c)
    const med = d[d.length >> 1]
    if (med > 0) bpm = Math.round(60 / med)
  }
  const run = async () => {
    const k = Object.keys(beatMods)[0]
    if (!k) return
    setBusy(true)
    try {
      const mod = await beatMods[k]()
      const fn = mod.detectBeats || mod.findBeats || mod.default
      if (typeof fn !== 'function') throw new Error('beats.js uygun fonksiyon dışa aktarmıyor')
      const src = media && (media.audioPath || media.path)
      if (!src) throw new Error('medya dosyası yok')
      const r = await fn(src, { sensitivity: sens })
      const arr = Array.isArray(r) ? r : (r && (r.beats || r.times)) || []
      b.edit(c => { c.beats = arr.map(Number).filter(Number.isFinite) }, 'Vuruşları bul')
      store.toast(arr.length + ' vuruş bulundu' + (r && r.bpm ? ' · ' + Math.round(r.bpm) + ' BPM' : ''), 'ok', 2000)
    } catch (e) {
      store.toast('Vuruşlar bulunamadı: ' + String(e.message || e).slice(0, 100), 'error', 4000)
    }
    setBusy(false)
  }
  return (
    <Sec id="beats" code="01" title="Vuruşlar" sub={beats.length ? beats.length + ' işaret' : null}>
      <div className="readout">
        <div><span className="k">Vuruş</span><span className="v mono">{beats.length || '—'}</span></div>
        <div><span className="k">Tempo</span><span className="v mono">{bpm ? bpm + ' BPM' : '—'}</span></div>
      </div>
      {beats.length > 0 && (
        <svg className="beatstrip" width="290" height="22">
          {beats.map((t, i) => {
            const span = Math.max(0.01, (clip.out ?? clip.duration) - (clip.in ?? 0))
            const x = ((t - (clip.in || 0)) / span) * 290
            return x >= 0 && x <= 290 ? <line key={i} x1={x} x2={x} y1={i % 4 ? 8 : 2} y2="20" stroke={i % 4 ? 'var(--tx-2)' : 'var(--sig)'} /> : null
          })}
        </svg>
      )}
      <Row label="Hassasiyet" value={sens} min={0} max={1} step={1} scale={100} suffix="%" def={0.5} onChange={v => setSens(v)} hint="Yüksek: zayıf vuruşları da yakalar" />
      <div className="row">
        <button className="btn sm sig" disabled={busy || !media} onClick={run}><Icon name="beat" size={13} />{busy ? 'Analiz ediliyor…' : beats.length ? 'Yeniden bul' : 'Vuruşları bul'}</button>
        {beats.length > 0 && <button className="btn sm ghost" onClick={() => b.edit(c => { c.beats = null }, 'Vuruşları temizle')}>Temizle</button>}
      </div>
      <Note>Vuruş işaretleri zaman çizelgesinde görünür; kesimler ve efektler onlara yapışır.</Note>
    </Sec>
  )
}
