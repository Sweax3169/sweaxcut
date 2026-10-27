// Tuval arka planı düzenleyici — proje ayarı ve klibe özel arka plan ortak kullanır
import React from 'react'
import { useStore } from '../../core/store.js'
import { Row, Color, Line, Note } from './common.jsx'
import { Select } from '../controls.jsx'
import Icon from '../Icon.jsx'

const selImages = s => s.project.media
const TYPES = [
  { id: 'blur', name: 'Bulanık' },
  { id: 'color', name: 'Renk' },
  { id: 'gradient', name: 'Degrade' },
  { id: 'image', name: 'Görsel' },
]

function Swatch({ type, bg }) {
  if (type === 'blur') return <i className="bgsw blur" />
  if (type === 'color') return <i className="bgsw" style={{ background: bg.color || '#000' }} />
  if (type === 'gradient') {
    const g = bg.gradient || ['#141414', '#000']
    return <i className="bgsw" style={{ background: `linear-gradient(${180 - (bg.angle || 0)}deg, ${g[0]}, ${g[1]})` }} />
  }
  return <i className="bgsw img"><Icon name="image" size={14} /></i>
}

export default function BgEditor({ bg, onPatch }) {
  const media = useStore(selImages)
  const images = Object.values(media).filter(m => m.type === 'image')
  const type = bg.type || 'blur'
  const set = (k) => (v, o) => onPatch({ [k]: v }, o && o.final)
  const grad = bg.gradient || ['#141414', '#000000']
  return (
    <>
      <div className="bgtypes">
        {TYPES.map(t => (
          <button key={t.id} className={'bgt' + (t.id === type ? ' on' : '')} onClick={() => onPatch({ type: t.id }, true)}>
            <Swatch type={t.id} bg={bg} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      {type === 'blur' && (
        <>
          <Row label="Bulanıklık" value={bg.blur ?? 28} min={0} max={100} step={1} def={28} onChange={set('blur')} />
          <Row label="Karartma" value={bg.dim ?? 0.15} min={0} max={1} step={1} scale={100} suffix="%" def={0.15} onChange={set('dim')} />
        </>
      )}
      {type === 'color' && <Color label="Renk" value={bg.color || '#000000'} onChange={set('color')} />}
      {type === 'gradient' && (
        <>
          <div className="gradbar" style={{ background: `linear-gradient(90deg, ${grad[0]}, ${grad[1]})` }}>
            <button className="ibtn sm" data-tip="Renkleri değiştir" onClick={() => onPatch({ gradient: [grad[1], grad[0]] }, true)}><Icon name="shuffle" size={12} /></button>
          </div>
          <Color label="Başlangıç" value={grad[0]} onChange={(v, o) => onPatch({ gradient: [v, grad[1]] }, o && o.final)} />
          <Color label="Bitiş" value={grad[1]} onChange={(v, o) => onPatch({ gradient: [grad[0], v] }, o && o.final)} />
          <Row label="Açı" value={bg.angle || 0} min={0} max={360} step={1} suffix="°" def={0} onChange={set('angle')} />
        </>
      )}
      {type === 'image' && (images.length ? (
        <Select label="Görsel" value={bg.mediaId || ''} onChange={v => onPatch({ mediaId: v || null }, true)}
          options={[{ value: '', label: '— seç —' }, ...images.map(m => ({ value: m.id, label: m.name }))]} />
      ) : <Note>Projede görsel yok. Medya kütüphanesine bir görsel aktar.</Note>)}
      {type === 'image' && bg.mediaId && !media[bg.mediaId] && <Line label=""><span className="faint">Görsel bulunamadı</span></Line>}
    </>
  )
}
