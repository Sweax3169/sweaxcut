// SAĞ DENETÇİ PANELİ — seçili klibin / projenin özellikleri.
// Seçim yok → PROJE; tek klip → türüne göre sekmeler; çoklu seçim → ortak temel özellikler.
// Yeniden çizim dar tutulur: yalnızca seçili klip değişince, ve klipte anahtar kare varsa oynatma kafasıyla (~20 fps).
import React, { useCallback, useEffect, useState } from 'react'
import '../styles/inspector.css'
import { store, useStore } from '../../core/store.js'
import { defaultTransform, defaultMask, defaultChroma, defaultAdjust, defaultHSL, defaultAudio } from '../../core/model.js'
import { keyAt, allKeyTimes } from '../../core/keyframes.js'
import { EASING_LABELS } from '../../core/easing.js'
import { timecode } from '../../core/time.js'
import * as A from '../actions.js'
import Icon from '../Icon.jsx'
import { useClip, useMedia, useSettings, useLocalTime, usePlayhead, bind, anyKeys, keysAtTime, clamp } from './hooks.js'
import BasicTab from './BasicTab.jsx'
import MaskTab from './MaskTab.jsx'
import ColorTab, { FilterSection, AdjustSections, HslSection } from './ColorTab.jsx'
import EffectsTab, { EffectLayerTab } from './EffectsTab.jsx'
import AnimTab from './AnimTab.jsx'
import SpeedTab from './SpeedTab.jsx'
import AudioTab, { VoiceSection, BeatsTab, hasBeats } from './AudioTab.jsx'
import TransitionTab from './TransitionTab.jsx'
import TextTab from './TextTab.jsx'
import TextStyleTab from './TextStyleTab.jsx'
import CaptionTab from './CaptionTab.jsx'
import TtsTab from './TtsTab.jsx'
import StickerTab from './StickerTab.jsx'
import ProjectTab from './ProjectTab.jsx'
import MultiTab from './MultiTab.jsx'

export const TYPE_LABEL = { video: 'Video', image: 'Görsel', audio: 'Ses', text: 'Yazı', sticker: 'Çıkartma', effect: 'Efekt', filter: 'Filtre', adjust: 'Ayar katmanı' }
const TYPE_CODE = { video: 'V', image: 'G', audio: 'A', text: 'T', sticker: 'Ç', effect: 'E', filter: 'F', adjust: 'K' }

const TAB = {
  basic: { label: 'Temel', icon: 'fit' },
  mask: { label: 'Maske', icon: 'mask' },
  color: { label: 'Renk', icon: 'palette' },
  effects: { label: 'Efekt', icon: 'fx' },
  anim: { label: 'Anim', icon: 'anim', tip: 'Animasyon' },
  speed: { label: 'Hız', icon: 'speed' },
  audio: { label: 'Ses', icon: 'volume' },
  transition: { label: 'Geçiş', icon: 'transition' },
  text: { label: 'Metin', icon: 'type' },
  style: { label: 'Stil', icon: 'sparkle' },
  caption: { label: 'Altyazı', icon: 'caption' },
  tts: { label: 'Seslendir', icon: 'tts' },
  sticker: { label: 'Çıkartma', icon: 'sticker' },
  voice: { label: 'Değiştir', icon: 'mic', tip: 'Ses değiştirici' },
  beats: { label: 'Vuruş', icon: 'beat', tip: 'Vuruşlar' },
  params: { label: 'Efekt', icon: 'fx' },
  filter: { label: 'Filtre', icon: 'filter' },
  adjust: { label: 'Ayar', icon: 'adjust' },
  project: { label: 'Proje', icon: 'film' },
  multi: { label: 'Temel', icon: 'layers' },
}

function tabsFor(clip, media) {
  const t = clip.type
  const ids = t === 'video' ? ['basic', 'mask', 'color', 'effects', 'anim', 'speed', media && media.hasAudio ? 'audio' : null, clip.transition ? 'transition' : null]
    : t === 'image' ? ['basic', 'mask', 'color', 'effects', 'anim', clip.transition ? 'transition' : null]
      : t === 'text' ? ['text', 'style', 'anim', 'basic', 'effects', clip.caption ? 'caption' : null, 'tts']
        : t === 'sticker' ? ['basic', 'sticker', 'anim', 'effects']
          : t === 'audio' ? ['audio', 'voice', 'speed', hasBeats ? 'beats' : null]
            : t === 'effect' ? ['params']
              : t === 'filter' ? ['filter', 'adjust']
                : t === 'adjust' ? ['adjust', 'filter']
                  : ['basic']
  return ids.filter(Boolean)
}

// Sekme hafızası: türe göre son sekme (ui.inspectorTab dizgeyse bir kerelik istek sayılır, ör. 'transition')
const tabMem = new Map()
function useTab(type, tabs) {
  const pref = useStore(s => s.ui.inspectorTab)
  let tab = null
  if (typeof pref === 'string' && tabs.includes(pref)) tab = pref
  else if (pref && typeof pref === 'object' && tabs.includes(pref[type])) tab = pref[type]
  else if (tabs.includes(tabMem.get(type))) tab = tabMem.get(type)
  else tab = tabs[0]
  useEffect(() => {
    // dizge isteğini türe özel hafızaya çevir
    if (typeof pref === 'string' && tabs.includes(pref)) {
      tabMem.set(type, pref)
      store.setUI({ inspectorTab: { [type]: pref } })
    }
  }, [pref, type, tabs.join()])
  const set = useCallback((id) => {
    tabMem.set(type, id)
    store.setUI(u => ({ inspectorTab: { ...(u.inspectorTab && typeof u.inspectorTab === 'object' ? u.inspectorTab : {}), [type]: id } }))
  }, [type])
  return [tab, set]
}

function Tabs({ tabs, tab, setTab, dots }) {
  return (
    <div className="itabs" role="tablist">
      {tabs.map((id, i) => {
        const d = TAB[id] || { label: id, icon: 'dots' }
        return (
          <button key={id} role="tab" aria-selected={id === tab} className={'itab' + (id === tab ? ' on' : '')} onClick={() => setTab(id)}
            data-tip={d.tip || d.label} data-kb={i < 9 ? 'Alt+' + (i + 1) : undefined}>
            <Icon name={d.icon} size={15} />
            <span>{d.label}</span>
            {dots && dots[id] && <i className="tdot" />}
          </button>
        )
      })}
    </div>
  )
}

// Başlık: tür şeridi + ad + işlemler
function Head({ color, code, kind, meta, name, placeholder, onName, actions }) {
  const [txt, setTxt] = useState(null)
  return (
    <div className="ihead" style={{ '--tc': color }}>
      <i className="tbar" />
      <div className="hmain">
        <div className="tline">
          {code && <span className="tcode">{code}</span>}
          <span className="tkind">{kind}</span>
          {meta && <span className="tmeta">{meta}</span>}
        </div>
        {onName ? (
          <input className="iname" value={txt != null ? txt : name} placeholder={placeholder} spellCheck={false}
            onFocus={() => setTxt(name)} onChange={e => { setTxt(e.target.value); onName(e.target.value) }}
            onBlur={() => { setTxt(null); store.endCoalesce() }}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur() }} />
        ) : <div className="iname static">{name}</div>}
      </div>
      <div className="hact">{actions}</div>
    </div>
  )
}

// Anahtar kare şeridi: önceki/sonraki, sayaç, bu karedeki yumuşatma, hepsini temizle
function KfBar({ clip, lt, b }) {
  if (!anyKeys(clip)) return null
  const times = allKeyTimes(clip)
  const at = keysAtTime(clip, lt)
  const idx = times.findIndex(x => Math.abs(x - lt) <= 1 / 120)
  let ease = null
  if (at.length) {
    const k = clip.keyframes[at[0]][keyAt(clip, at[0], lt)]
    ease = k ? (typeof k.ease === 'string' ? k.ease : k.ease ? 'custom' : 'linear') : null
  }
  const before = times.filter(x => x < lt - 1e-3).length
  return (
    <div className="kfbar">
      <i className={'dia' + (at.length ? ' on' : '')} />
      <span className="kcnt mono">{idx >= 0 ? idx + 1 : before + '·' + (before + 1)}<b>/{times.length}</b></span>
      <button className="ibtn sm" data-tip="Önceki anahtar kare" onClick={() => A.jumpKey(-1)} disabled={!times.some(x => x < lt - 1e-3)}><Icon name="chevL" size={12} /></button>
      <button className="ibtn sm" data-tip="Sonraki anahtar kare" onClick={() => A.jumpKey(1)} disabled={!times.some(x => x > lt + 1e-3)}><Icon name="chevR" size={12} /></button>
      {at.length ? (
        <label className="kease" data-tip="Önceki kareden bu kareye geçiş eğrisi">
          <Icon name="ease" size={12} />
          <select value={ease || 'easeInOut'} onChange={e => b.edit(c => {
            for (const p of at) { const i = keyAt(c, p, lt); if (i >= 0) c.keyframes[p][i].ease = e.target.value }
          }, 'Yumuşatma')}>
            {ease === 'custom' && <option value="custom">Özel eğri</option>}
            {Object.entries(EASING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      ) : <span className="kgap">kareler arası</span>}
      <span className="grow" />
      <button className="ibtn sm" data-tip="Bütün anahtar kareleri temizle" onClick={() => A.clearKeys(clip.id)}><Icon name="trash" size={12} /></button>
    </div>
  )
}

// Alt şerit: klip içi zaman + anahtar kare çentikleri
function Foot({ clip, fps }) {
  const t = usePlayhead(12)
  const lt = t - clip.start
  const inside = lt >= -1e-4 && lt <= clip.duration + 1e-4
  const keys = allKeyTimes(clip)
  const pct = clamp(lt / Math.max(1e-6, clip.duration), 0, 1) * 100
  return (
    <div className="ifoot">
      <span className={'fst' + (inside ? '' : ' out')}>{inside ? 'KLİP İÇİ' : 'KLİP DIŞI'}</span>
      <span className="ftc">{timecode(clamp(lt, 0, clip.duration), fps)}</span>
      <span className="fdur">/ {timecode(clip.duration, fps)}</span>
      <div className="fbar">
        {keys.map(k => <i key={k} className="fk" style={{ left: (k / Math.max(1e-6, clip.duration)) * 100 + '%' }} />)}
        <i className={'fph' + (inside ? '' : ' out')} style={{ left: pct + '%' }} />
      </div>
    </div>
  )
}

// Bütün görsel/ses ayarlarını sıfırla (içerik, zamanlama, hız korunur)
function resetAll(c) {
  if (c.transform) c.transform = { ...defaultTransform(), scale: c.type === 'sticker' ? 0.5 : 1 }
  if ('opacity' in c) c.opacity = 1
  if ('blend' in c) c.blend = 'normal'
  if (c.crop) c.crop = { l: 0, t: 0, r: 0, b: 0 }
  if (c.mask) c.mask = defaultMask()
  if (c.chroma) c.chroma = defaultChroma()
  if (c.adjust) c.adjust = defaultAdjust()
  if (c.hsl) c.hsl = defaultHSL()
  if (c.type === 'video' || c.type === 'image') { c.filter = null; c.fit = 'contain'; c.canvasBg = null }
  if (c.effects) c.effects = []
  if (c.anim) c.anim = { in: null, out: null, loop: null }
  if (c.audio) c.audio = { ...defaultAudio(), muted: !!c.audio.detached, detached: c.audio.detached }
  c.keyframes = {}
}

function ClipInspector({ id, focusTick }) {
  const clip = useClip(id)
  const lt = useLocalTime(clip)
  const media = useMedia(clip && clip.mediaId)
  const settings = useSettings()
  const tabs = clip ? tabsFor(clip, media) : ['basic']
  const [tab, setTab] = useTab(clip ? clip.type : 'none', tabs)
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 2200); return () => clearTimeout(t) }, [armed])
  // Alt+1..9 sekme kısayolu (odak denetçideyken ya da genel)
  useEffect(() => {
    const k = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const n = +e.key
      if (n >= 1 && n <= tabs.length) { e.preventDefault(); setTab(tabs[n - 1]) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [tabs.join(), setTab])
  if (!clip) return <ProjectInspector />
  const b = bind(clip, lt)
  const ctx = { clip, lt, b, media, settings }
  const type = clip.type
  const meta = [timecode(clip.duration, settings.fps), media && media.width ? media.width + '×' + media.height : null, clip.speed && clip.speed !== 1 ? clip.speed.toFixed(2) + '×' : null].filter(Boolean).join('  ')
  const dots = {
    mask: clip.mask && clip.mask.type !== 'none',
    color: !!(clip.filter && clip.filter.id) || (clip.adjust && Object.values(clip.adjust).some(Boolean)),
    effects: clip.effects && clip.effects.length > 0,
    anim: clip.anim && !!(clip.anim.in || clip.anim.out || clip.anim.loop),
    speed: (clip.speed && clip.speed !== 1) || !!clip.speedCurve || !!clip.reverse,
    voice: !!(clip.audio && clip.audio.voiceFx),
    tts: !!clip.tts,
  }
  let body = null
  switch (tab) {
    case 'basic': body = <BasicTab ctx={ctx} />; break
    case 'mask': body = <MaskTab ctx={ctx} />; break
    case 'color': body = <ColorTab ctx={ctx} />; break
    case 'effects': body = <EffectsTab ctx={ctx} />; break
    case 'anim': body = <AnimTab ctx={ctx} text={type === 'text'} />; break
    case 'speed': body = <SpeedTab ctx={ctx} />; break
    case 'audio': body = <AudioTab ctx={ctx} />; break
    case 'transition': body = <TransitionTab ctx={ctx} />; break
    case 'text': body = <TextTab ctx={ctx} focusTick={focusTick} />; break
    case 'style': body = <TextStyleTab ctx={ctx} />; break
    case 'caption': body = <CaptionTab ctx={ctx} />; break
    case 'tts': body = <TtsTab ctx={ctx} />; break
    case 'sticker': body = <StickerTab ctx={ctx} />; break
    case 'voice': body = <VoiceSection ctx={ctx} code="01" all />; break
    case 'beats': body = <BeatsTab ctx={ctx} />; break
    case 'params': body = <EffectLayerTab ctx={ctx} />; break
    case 'filter': body = <FilterSection ctx={ctx} full code="01" />; break
    case 'adjust': body = <><AdjustSections ctx={ctx} startCode={1} /><HslSection ctx={ctx} code="04" /></>; break
    default: body = null
  }
  const placeholder = type === 'text' ? ((clip.text && clip.text.content) || 'Yazı').split('\n')[0].slice(0, 40) : (media ? media.name : TYPE_LABEL[type])
  return (
    <div className="panel insp" data-type={type}>
      <Head color={`var(--c-${type})`} code={TYPE_CODE[type]} kind={TYPE_LABEL[type]} meta={meta}
        name={clip.name || ''} placeholder={placeholder}
        onName={v => A.setProps(clip.id, c => { c.name = v }, 'Ad değiştir', 'name:' + clip.id)}
        actions={<>
          <button className={'ibtn sm' + (armed ? ' armed' : '')} data-tip={armed ? 'Tekrar tıkla: sıfırla' : 'Tümünü sıfırla'}
            onClick={() => { if (!armed) { setArmed(true); return } setArmed(false); A.setProps(clip.id, resetAll, 'Tümünü sıfırla') }}>
            <Icon name="undo" size={13} />{armed && <span className="armtxt">Emin misin?</span>}
          </button>
          <button className="ibtn sm danger" data-tip="Klibi sil" data-kb="Del" onClick={() => A.deleteSelected()}><Icon name="trash" size={13} /></button>
        </>} />
      {tabs.length > 1 && <Tabs tabs={tabs} tab={tab} setTab={setTab} dots={dots} />}
      <KfBar clip={clip} lt={lt} b={b} />
      <div className="pbody ibody" key={tab}>
        {body}
        <div className="iend"><span className="perf" /></div>
      </div>
      <Foot clip={clip} fps={settings.fps} />
    </div>
  )
}

const selSel = s => s.selection.clips
const selProjName = s => s.project.name

function ProjectInspector() {
  const settings = useSettings()
  const name = useStore(selProjName)
  return (
    <div className="panel insp" data-type="project">
      <Head color="var(--sig)" code="P" kind="Proje" meta={settings.width + '×' + settings.height + '  ' + settings.fps + ' fps'} name={name}
        onName={v => store.edit('Proje adı', d => { d.name = v }, { coalesce: 'pname' })} />
      <div className="pbody ibody">
        <ProjectTab settings={settings} />
        <div className="iend"><span className="perf" /></div>
      </div>
      <div className="ifoot"><span className="fst">SEÇİM YOK</span><span className="fdur">bir klip seç ya da zaman çizelgesine medya bırak</span></div>
    </div>
  )
}

const selMulti = s => {
  const ids = new Set(s.selection.clips)
  const out = []
  for (const t of s.project.tracks) for (const c of t.clips) if (ids.has(c.id)) out.push(c)
  // birincil (son seçilen) en sonda
  const last = s.selection.clips[s.selection.clips.length - 1]
  out.sort((a, b) => (a.id === last) - (b.id === last))
  return out
}

function MultiInspector() {
  const clips = useStore(selMulti, 'shallow')
  const settings = useSettings()
  if (clips.length < 2) return clips.length === 1 ? <ClipInspector id={clips[0].id} /> : <ProjectInspector />
  return (
    <div className="panel insp" data-type="multi">
      <Head color="var(--tx-1)" code={String(clips.length)} kind="Çoklu seçim" meta="ortak özellikler" name={clips.length + ' klip'}
        actions={<button className="ibtn sm danger" data-tip="Seçilenleri sil" data-kb="Del" onClick={() => A.deleteSelected()}><Icon name="trash" size={13} /></button>} />
      <div className="pbody ibody">
        <MultiTab clips={clips} settings={settings} />
        <div className="iend"><span className="perf" /></div>
      </div>
      <div className="ifoot"><span className="fst">{clips.length} KLİP</span><span className="fdur">Shift / Ctrl ile seçime ekle-çıkar</span></div>
    </div>
  )
}

export default function Inspector() {
  const sel = useStore(selSel)
  const [focusTick, setFocusTick] = useState(0)
  // Önizleme / zaman çizelgesinde yazıya çift tık → Metin sekmesi + odak
  useEffect(() => {
    const h = (e) => {
      const id = e.detail
      if (!id) return
      const s = store.get()
      if (s.selection.clips.length !== 1 || s.selection.clips[0] !== id) store.select([id])
      tabMem.set('text', 'text')
      store.setUI(u => ({ inspectorTab: { ...(u.inspectorTab && typeof u.inspectorTab === 'object' ? u.inspectorTab : {}), text: 'text' } }))
      setFocusTick(x => x + 1)
    }
    window.addEventListener('sweax:edit-text', h)
    return () => window.removeEventListener('sweax:edit-text', h)
  }, [])
  if (!sel.length) return <ProjectInspector />
  if (sel.length > 1) return <MultiInspector />
  return <ClipInspector id={sel[0]} focusTick={focusTick} />
}
