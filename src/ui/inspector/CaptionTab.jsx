// ALTYAZI: stil seçici (kelime vurgulu önizleme), kelime listesi (metin + zamanlama kaydırma), tüm altyazılara uygula
import React from 'react'
import { store } from '../../core/store.js'
import { defaultTextStyle } from '../../core/model.js'
import { get as regGet } from '../../engine/registry.js'
import { playback } from '../../engine/playback.js'
import Icon from '../Icon.jsx'
import { Sec, Note, Empty } from './common.jsx'
import { useReg, usePlayhead } from './hooks.js'
import { textCss } from './TextStyleTab.jsx'

const NESTED = ['stroke', 'stroke2', 'shadow', 'glow', 'bg']
const textPack = Object.values(import.meta.glob('../../packs/text/index.js', { eager: true }))[0] || {}

function mergeStyle(c, st) {
  const d = defaultTextStyle()
  const tt = st.text || {}
  for (const k of Object.keys(tt)) {
    if (k === 'content') continue
    c.text[k] = NESTED.includes(k) ? { ...d[k], ...tt[k] } : JSON.parse(JSON.stringify(tt[k]))
  }
  if (st.uppercase != null) c.text.uppercase = !!st.uppercase
}

function StylePreview({ st }) {
  const base = { ...defaultTextStyle(), ...(st.text || {}) }
  for (const k of NESTED) base[k] = { ...defaultTextStyle()[k], ...((st.text || {})[k] || {}) }
  const a = st.active || {}
  const words = ['BU', 'ÇOK', 'İYİ']
  return (
    <span className="capprev">
      {words.map((w, i) => {
        const on = i === 1
        const s = textCss({ ...base, uppercase: st.uppercase ?? base.uppercase }, 12)
        if (on) {
          if (a.color) s.color = a.color
          if (a.bg) { s.background = a.bg.color; s.padding = '1px 3px'; s.borderRadius = Math.min(3, a.bg.radius || 0) }
          if (a.scale) s.transform = `scale(${a.scale})`
          if (a.glow) s.textShadow = `0 0 6px ${a.glow.color || '#fff'}`
        } else if (i < 1 && st.past) { if (st.past.color) s.color = st.past.color; if (st.past.opacity != null) s.opacity = st.past.opacity } else if (i > 1 && st.future) { if (st.future.color) s.color = st.future.color; if (st.future.opacity != null) s.opacity = st.future.opacity }
        return <span key={i} style={{ ...s, display: 'inline-block' }}>{w}</span>
      })}
    </span>
  )
}

function Words({ ctx }) {
  const { clip, b } = ctx
  const t = usePlayhead(15)
  const fps = store.get().project.settings.fps || 30
  const words = (clip.caption && clip.caption.words) || []
  const lt = t - clip.start
  const upd = (i, patch, label, key) => b.edit(c => { const w = c.caption.words[i]; if (w) Object.assign(w, patch) }, label, key)
  const nudge = (i, d) => b.edit(c => {
    const w = c.caption.words[i]
    if (!w) return
    const dt = d / fps
    w.s = Math.max(0, +(w.s + dt).toFixed(3)); w.e = Math.max(w.s + 1 / fps, +(w.e + dt).toFixed(3))
  }, 'Kelime zamanı', 'wn:' + clip.id + i)
  if (!words.length) return <Note>Bu altyazıda kelime zamanlaması yok.</Note>
  return (
    <div className="words">
      {words.map((w, i) => {
        const on = lt >= w.s && lt < w.e
        return (
          <div key={i} className={'wd' + (on ? ' on' : '')}>
            <button className="wt mono" data-tip="Bu kelimeye git" onClick={() => playback.seek(clip.start + w.s + 0.001)}>{w.s.toFixed(2)}</button>
            <input className="field ww" value={w.w} spellCheck={false}
              onChange={e => upd(i, { w: e.target.value }, 'Kelimeyi düzenle', 'ww:' + clip.id + i)}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur() }} />
            <span className="wdur mono">{Math.round((w.e - w.s) * 1000)}<i>ms</i></span>
            <button className="ibtn sm" data-tip="1 kare erken" onClick={() => nudge(i, -1)}><Icon name="chevL" size={11} /></button>
            <button className="ibtn sm" data-tip="1 kare geç" onClick={() => nudge(i, 1)}><Icon name="chevR" size={11} /></button>
          </div>
        )
      })}
    </div>
  )
}

export default function CaptionTab({ ctx }) {
  const { clip, b } = ctx
  const styles = useReg('captionStyles')
  const cap = clip.caption
  if (!cap) return <Empty title="Altyazı değil" text="Bu yazı bir otomatik altyazı parçası değil." />
  const cur = cap.styleId ? regGet('captionStyles', cap.styleId) : null
  const apply = (st) => b.edit(c => {
    if (textPack.applyCaptionStyle) textPack.applyCaptionStyle(c, st.id)
    else { c.caption.styleId = st.id; mergeStyle(c, st) }
  }, 'Altyazı stili: ' + st.name)
  const applyAll = () => {
    const gid = cap.groupId
    const src = JSON.parse(JSON.stringify(clip.text))
    let n = 0
    store.edit('Tüm altyazılara uygula', d => {
      for (const tr of d.tracks) for (const c of tr.clips) {
        if (c.id === clip.id || !c.caption) continue
        if (gid != null && c.caption.groupId !== gid) continue
        const content = c.text.content
        c.text = { ...JSON.parse(JSON.stringify(src)), content }
        c.caption.styleId = cap.styleId
        n++
      }
    })
    store.toast(n + ' altyazıya uygulandı', 'ok', 1600)
  }
  return (
    <>
      <Sec id="capst" code="01" title="Altyazı stili" sub={cur ? cur.name : null}>
        {styles.length ? (
          <div className="capgrid">
            {styles.map(st => (
              <button key={st.id} className={'capst' + (cap.styleId === st.id ? ' on' : '')} onClick={() => apply(st)} data-tip={st.name}>
                <span className="cpv"><StylePreview st={st} /></span>
                <span className="inm">{st.name}</span>
              </button>
            ))}
          </div>
        ) : <Note>Altyazı stili paketi yüklenmedi.</Note>}
        <button className="btn sm" onClick={applyAll}><Icon name="copy" size={12} />Tüm altyazılara uygula</button>
      </Sec>
      <Sec id="capw" code="02" title="Kelimeler" sub={(cap.words || []).length + ' kelime'}>
        <Words ctx={ctx} />
      </Sec>
    </>
  )
}
