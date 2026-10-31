// ÇIKARTMA: tanım bilgisi, şema parametreleri (renk/yazı/aralık), emoji hareket hazırı
import React from 'react'
import { store } from '../../core/store.js'
import { get as regGet } from '../../engine/registry.js'
import * as SR from '../../engine/sticker-render.js'
import { Select } from '../controls.jsx'
import { Sec, Row, ParamControls, Note } from './common.jsx'

// Emoji / görsel çıkartma hareket hazırları — motorun listesi (clip.sticker.params.anim)
const ANIMS = SR.STICKER_ANIMS || [{ value: 'none', label: 'Yok' }, { value: 'bounce', label: 'Zıpla' }, { value: 'pulse', label: 'Nabız' }, { value: 'spin', label: 'Dön' }]
const KIND_TR = { emoji: 'Emoji', vector: 'Vektör animasyon', shape: 'Şekil', image: 'Görsel' }

export default function StickerTab({ ctx }) {
  const { clip, b } = ctx
  const st = clip.sticker || {}
  const def = st.id ? regGet('stickers', st.id) : null
  const kind = (def && def.kind) || st.kind
  const ownAnim = def && (def.params || []).some(p => p.key === 'anim')
  return (
    <>
      <Sec id="stk" code="01" title="Çıkartma" sub={KIND_TR[kind] || kind}>
        <div className="curfilter">
          <i className="fsw" style={{ background: 'var(--c-sticker)', overflow: 'hidden' }}>{def && def.src ? <img src={def.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}</i>
          <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="fname">{def ? def.name : clip.name || 'Çıkartma'}</span>
            <span className="faint" style={{ fontSize: 11 }}>{KIND_TR[kind] || kind || ''}{def && def.loop && kind === 'vector' ? ' · ' + def.loop + ' sn döngü' : ''}</span>
          </div>
        </div>
        {kind !== 'vector' && !ownAnim && (
          <>
            <Select label="Hareket" value={(st.params && st.params.anim) || ''}
              options={[{ value: '', label: def && def.anim ? 'Varsayılan (' + ((ANIMS.find(x => x.value === def.anim) || {}).label || def.anim) + ')' : 'Varsayılan (yok)' }, ...ANIMS]}
              onChange={v => b.edit(c => { const p = { ...(c.sticker.params || {}) }; if (v) p.anim = v; else delete p.anim; c.sticker = { ...c.sticker, params: p } }, 'Çıkartma hareketi')} />
            {((st.params && st.params.anim && st.params.anim !== 'none') || (def && def.anim && !(st.params && st.params.anim))) && (
              <Row label="Hareket hızı" value={(st.params && st.params.animSpeed) || 1} min={0.1} max={4} step={0.05} digits={2} suffix="×" def={1}
                onChange={(v, o) => { b.edit(c => { c.sticker = { ...c.sticker, params: { ...(c.sticker.params || {}), animSpeed: v } } }, 'Hareket hızı', 'stks:' + clip.id); if (o && o.final) store.endCoalesce() }} />
            )}
          </>
        )}
      </Sec>
      {def && def.params && def.params.length > 0 && (
        <Sec id="stkp" code="02" title="Ayarlar" onReset={() => b.edit(c => { c.sticker = { ...c.sticker, params: {} } }, 'Çıkartmayı sıfırla')}>
          <ParamControls schema={def.params} values={st.params}
            onChange={(k, v, o) => { b.edit(c => { c.sticker = { ...c.sticker, params: { ...(c.sticker.params || {}), [k]: v } } }, 'Çıkartma ayarı', 'stk:' + clip.id + k); if (o && o.final) store.endCoalesce() }} />
        </Sec>
      )}
      {!def && st.kind !== 'image' && <Note>Bu çıkartmanın tanımı kayıt defterinde yok.</Note>}
    </>
  )
}
