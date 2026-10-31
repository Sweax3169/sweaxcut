// Komut paleti (Ctrl+K): "ne yapmak istiyorsun?" — komutlar, araçlar ve kütüphanedeki her öğe tek aramada.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../../core/store.js'
import Icon from '../Icon.jsx'
import * as A from '../actions.js'
import { REG } from '../../engine/registry.js'
import { norm } from '../library/common.jsx'
import { RECIPES } from '../../features/autoedit/index.js'

function commands() {
  const s = store.get()
  const ed = s.ui.screen === 'editor'
  const tab = (id) => () => store.setUI({ screen: 'editor', leftTab: id, leftSub: null })
  const list = [
    { k: 'Komut', icon: 'caption', name: 'Otomatik altyazı oluştur', tags: 'altyazı konuşma whisper yazı', run: () => store.setUI({ leftTab: 'captions' }), ed: true },
    { k: 'Komut', icon: 'wand', name: 'Otomatik kurgu', tags: 'tarif montaj sihir', run: () => store.openModal('autoedit', {}), ed: true },
    { k: 'Komut', icon: 'sparkle', name: 'Güzelleştir', tags: 'iyileştir otomatik ses renk', run: tab('auto'), ed: true },
    { k: 'Komut', icon: 'export', name: 'Dışa aktar', kb: 'Ctrl+E', tags: 'kaydet video render', run: () => store.openModal('export'), ed: true },
    { k: 'Komut', icon: 'import', name: 'Medya içe aktar', kb: 'Ctrl+I', tags: 'video ekle dosya', run: () => A.pickAndImport(), ed: true },
    { k: 'Komut', icon: 'split', name: 'Böl', kb: 'Ctrl+B', tags: 'kes ikiye ayır', run: A.split, ed: true },
    { k: 'Komut', icon: 'trash', name: 'Seçileni sil', kb: 'Del', run: () => A.deleteSelected(), ed: true },
    { k: 'Komut', icon: 'dup', name: 'Çoğalt', kb: 'Ctrl+D', run: A.duplicate, ed: true },
    { k: 'Komut', icon: 'freeze', name: 'Kare dondur', run: A.freezeFrame, ed: true },
    { k: 'Komut', icon: 'wave', name: 'Sesi ayır', run: A.detachAudio, ed: true },
    { k: 'Komut', icon: 'reverse', name: 'Tersine oynat', run: A.toggleReverse, ed: true },
    { k: 'Komut', icon: 'text', name: 'Yazı ekle', kb: 'T', run: () => A.addText(null), ed: true },
    { k: 'Komut', icon: 'marker', name: 'İşaret ekle', kb: 'M', run: () => A.addMarker(), ed: true },
    { k: 'Komut', icon: 'adjust', name: 'Ayar katmanı ekle', run: A.addAdjustLayer, ed: true },
    { k: 'Komut', icon: 'save', name: 'Kaydet', kb: 'Ctrl+S', run: () => A.saveProject(), ed: true },
    { k: 'Komut', icon: 'folder', name: 'Proje aç', kb: 'Ctrl+O', run: () => A.openProject() },
    { k: 'Komut', icon: 'home', name: 'Ana ekran', run: () => store.setUI({ screen: 'home' }) },
    { k: 'Komut', icon: 'key', name: 'Klavye kısayolları', run: () => store.openModal('shortcuts') },
    { k: 'Komut', icon: 'silence', name: 'Sessizlikleri kes', tags: 'boşluk konuşma', run: tab('tools'), ed: true },
    { k: 'Komut', icon: 'highlight', name: 'Öne çıkan anları bul', tags: 'highlight zoom', run: tab('tools'), ed: true },
    { k: 'Komut', icon: 'beat', name: 'Vuruşları bul', tags: 'müzik ritim beat', run: tab('tools'), ed: true },
    { k: 'Komut', icon: 'person', name: 'Arka planı sil', tags: 'kişi segment', run: tab('tools'), ed: true },
    { k: 'Komut', icon: 'stabilize', name: 'Görüntüyü sabitle', tags: 'titreme', run: tab('tools'), ed: true },
    { k: 'Komut', icon: 'mic', name: 'Seslendirme kaydet', tags: 'mikrofon ses kaydı', run: () => store.setUI({ leftTab: 'audio', leftSub: 'voice' }), ed: true },
    { k: 'Komut', icon: 'tts', name: 'Yazıyı seslendir', tags: 'tts metin okuma', run: () => store.setUI({ leftTab: 'audio', leftSub: 'tts' }), ed: true },
    ...RECIPES.map(r => ({ k: 'Tarif', icon: r.icon, name: r.name, sub: r.desc, run: () => store.openModal('autoedit', { recipe: r.id }), ed: true })),
  ]
  const lib = (kind, reg, icon, label) => REG[reg].list.map(it => ({
    k: label, icon, name: it.name, tags: (it.tags || []).join(' ') + ' ' + (it.category || ''), ed: true,
    run: async () => { const { insertLibraryItem } = await import('../library/insert.js'); insertLibraryItem({ kind, id: it.id }) },
  }))
  list.push(...lib('effect', 'effects', 'fx', 'Efekt'), ...lib('transition', 'transitions', 'transition', 'Geçiş'), ...lib('filter', 'filters', 'filter', 'Filtre'),
    ...lib('text', 'textTemplates', 'text', 'Yazı'), ...lib('music', 'music', 'music', 'Müzik'), ...lib('sfx', 'sfx', 'sfx', 'Ses efekti'),
    ...lib('layout', 'layouts', 'layout', 'Düzen'))
  return list.filter(c => ed || !c.ed)
}

export default function CommandPalette({ onClose }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const all = useMemo(commands, [])
  const res = useMemo(() => {
    const qq = norm(q).trim()
    if (!qq) return all.filter(c => c.k === 'Komut' || c.k === 'Tarif').slice(0, 40)
    const words = qq.split(/\s+/)
    const scored = []
    for (const c of all) {
      const n = norm(c.name), hay = n + ' ' + norm(c.tags || '') + ' ' + norm(c.k)
      if (!words.every(w => hay.includes(w))) continue
      let sc = n.startsWith(words[0]) ? 0 : n.includes(words[0]) ? 1 : 2
      if (c.k === 'Komut') sc -= 0.5
      scored.push([sc, c])
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, 60).map(x => x[1])
  }, [q, all])
  const listRef = useRef(null)
  useEffect(() => { setI(0) }, [q])
  useEffect(() => {
    const el = listRef.current && listRef.current.children[i]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [i])
  const go = (c) => { onClose(); setTimeout(() => c.run(), 0) }
  return createPortal(
    <div className="scrim cmd-scrim" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmd">
        <label className="cmd-in">
          <Icon name="search" size={18} />
          <input autoFocus value={q} placeholder="Ne yapmak istiyorsun? (ör. altyazı, zoom, geçiş, müzik)" spellCheck={false}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(res.length - 1, x + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) }
              else if (e.key === 'Enter' && res[i]) go(res[i])
            }} />
          <kbd>Esc</kbd>
        </label>
        <div className="cmd-list" ref={listRef}>
          {res.map((c, k) => (
            <button key={c.k + c.name + k} className={'cmd-it' + (k === i ? ' on' : '')} onMouseMove={() => setI(k)} onClick={() => go(c)}>
              <span className="ic"><Icon name={c.icon} size={15} /></span>
              <span className="nm">{c.name}{c.sub && <i>{c.sub}</i>}</span>
              <span className="kd">{c.k}</span>
              {c.kb && <kbd>{c.kb}</kbd>}
            </button>
          ))}
          {!res.length && <div className="cmd-empty">Sonuç yok</div>}
        </div>
      </div>
    </div>, document.body)
}
