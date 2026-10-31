// Sol kütüphane paneli: dikey ikon rayı + seçili sekmenin içeriği (ui.leftTab).
import React, { useEffect, useState } from 'react'
import '../styles/library.css'
import Icon from '../Icon.jsx'
import { store, useStore } from '../../core/store.js'
import MediaPanel from './MediaPanel.jsx'
import AudioPanel from './AudioPanel.jsx'
import TextPanel from './TextPanel.jsx'
import CaptionsPanel from './CaptionsPanel.jsx'
import StickersPanel from './StickersPanel.jsx'
import { EffectsPanel, FiltersPanel, TransitionsPanel } from './FxPanels.jsx'
import LayoutsPanel from './LayoutsPanel.jsx'
import ToolsPanel from './ToolsPanel.jsx'
import AutoPanel from './AutoPanel.jsx'
import { recorderState, captionJob } from './jobs.js'

export const LIB_TABS = [
  { id: 'media', label: 'Medya', icon: 'media', C: MediaPanel },
  { id: 'auto', label: 'Otomatik', icon: 'wand', C: AutoPanel, magic: true },
  { id: 'audio', label: 'Ses', icon: 'music', C: AudioPanel },
  { id: 'text', label: 'Yazı', icon: 'text', C: TextPanel },
  { id: 'captions', label: 'Altyazı', icon: 'caption', C: CaptionsPanel },
  { id: 'stickers', label: 'Çıkartma', icon: 'sticker', C: StickersPanel },
  { id: 'effects', label: 'Efekt', icon: 'fx', C: EffectsPanel },
  { id: 'transitions', label: 'Geçiş', icon: 'transition', C: TransitionsPanel },
  { id: 'filters', label: 'Filtre', icon: 'filter', C: FiltersPanel },
  { id: 'layouts', label: 'Düzen', icon: 'layout', C: LayoutsPanel },
  { id: 'tools', label: 'Araçlar', icon: 'magic', C: ToolsPanel },
]

function useObsVal(o) {
  const [v, setV] = useState(o.get())
  useEffect(() => o.sub(setV), [o])
  return v
}

export default function Library() {
  const tab = useStore(s => s.ui.leftTab) || 'media'
  const cur = LIB_TABS.find(t => t.id === tab) || LIB_TABS[0]
  const rec = useObsVal(recorderState)
  const cap = useObsVal(captionJob)
  const P = cur.C
  return (
    <div className="lib panel" data-tab={cur.id}>
      <nav className="lib-rail">
        {LIB_TABS.map((t, i) => (
          <React.Fragment key={t.id}>
            {(t.id === 'audio' || t.id === 'effects' || t.id === 'layouts') && <div className="sep" />}
            <button className={'lib-ri' + (t.id === cur.id ? ' on' : '') + (t.magic ? ' magic' : '')} onClick={() => store.setUI({ leftTab: t.id, leftSub: null })}>
              <span className="no">{String(i + 1).padStart(2, '0')}</span>
              {t.id === 'audio' && rec.recording && <span className="rec-dot" />}
              {t.id === 'captions' && cap.running && <span className="busy-dot" />}
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          </React.Fragment>
        ))}
      </nav>
      <P key={cur.id} code={`L·${String(LIB_TABS.indexOf(cur) + 1).padStart(2, '0')} / ${LIB_TABS.length}`} />
    </div>
  )
}
