import React, { useEffect, useMemo, useState } from 'react'
import { store } from '../core/store.js'
import { RATIOS } from '../core/model.js'
import Icon from './Icon.jsx'
import * as A from './actions.js'
import { fs, fileUrl, ipc, droppedPaths } from '../platform/node.js'
import { ALL_EXTS } from '../core/media.js'
import { openMenu, fmtDur } from './controls.jsx'
import { REG } from '../engine/registry.js'
import { RECIPES } from '../features/autoedit/index.js'
import { sampleA, sampleB } from './library/samples.js'

const RATIO_TILES = [
  ['9:16', 'TikTok · Reels · Shorts'], ['16:9', 'YouTube'], ['1:1', 'Kare'], ['4:5', 'Instagram'], ['21:9', 'Sinema'],
]
const lsRatio = () => { try { return localStorage.getItem('sweax.home.ratio') || '9:16' } catch (e) { return '9:16' } }

// prosedürel örnek kareler (kişisel video yok)
let frames = null
function sampleFrames() {
  if (frames) return frames
  try { frames = [sampleA(320, 200).toDataURL('image/jpeg', 0.82), sampleB(320, 200).toDataURL('image/jpeg', 0.82)] } catch (e) { frames = ['', ''] }
  return frames
}

async function pickFiles() {
  if (!ipc) return []
  return ipc.invoke('dialog:open', {
    title: 'Video, fotoğraf ya da ses seç',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Medya', extensions: ALL_EXTS.map(e => e.slice(1)) }],
  })
}

// Dosyalarla yeni proje: tarif verildiyse otomatik kurgu penceresi kendiliğinden çalışır
export async function startWith(files, ratio, recipeId) {
  const media = (files || []).filter(f => ALL_EXTS.some(e => f.toLowerCase().endsWith(e)))
  if (!media.length) return
  A.newProject(ratio)
  if (recipeId) {
    const { importFiles } = await import('../core/media.js')
    const ids = await importFiles(media)
    store.openModal('autoedit', { recipe: recipeId, mediaIds: ids, autorun: true })
  } else {
    await A.importAndPlace(media)
    store.setUI({ coach: true })
  }
}

export default function Home({ ready }) {
  const [recent, setRecent] = useState([])
  const [auto, setAuto] = useState(null)
  const [ratio, setRatioS] = useState(lsRatio)
  const [over, setOver] = useState(null)
  const setRatio = r => { setRatioS(r); try { localStorage.setItem('sweax.home.ratio', r) } catch (e) { /* */ } }
  useEffect(() => {
    setRecent(A.loadRecent())
    try {
      const p = A.autosavePath()
      if (p && fs && fs.existsSync(p)) {
        const st = fs.statSync(p)
        if (Date.now() - st.mtimeMs < 7 * 864e5) setAuto({ path: p, when: st.mtime })
      }
    } catch (e) { /* */ }
  }, [])

  const counts = useMemo(() => ({
    fx: REG.effects.list.length, tr: REG.transitions.list.length, fl: REG.filters.list.length,
    tx: REG.textTemplates.list.length, cs: REG.captionStyles.list.length, st: REG.stickers.list.length, au: REG.sfx.list.length + REG.music.list.length,
  }), [ready]) // eslint-disable-line

  // sürükle-bırak: tarif kartına bırakılırsa o tarif, bırakma alanına bırakılırsa düz proje
  const dropProps = (target) => ({
    onDragOver: e => { e.preventDefault(); e.stopPropagation(); if (over !== target) setOver(target) },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => (o === target ? null : o)) },
    onDrop: e => {
      e.preventDefault(); e.stopPropagation(); e.nativeEvent.__handled = true
      setOver(null)
      const files = droppedPaths(e.dataTransfer)
      const proj = files.find(f => f.toLowerCase().endsWith('.sweax'))
      if (proj) { A.openProject(proj); return }
      startWith(files, ratio, target === 'drop' ? null : target)
    },
  })

  const [fa, fb] = sampleFrames()
  return (
    <div className="home">
      <div className="home-main">
        <div className="home-inner">
          <div className="home-top">
            <h1 className="home-title">Yeni kurgu</h1>
            <span className="grow" />
            <button className="btn lg ghost" onClick={() => A.openProject()}><Icon name="folder" size={16} />Proje aç</button>
          </div>

          <div className={'home-drop' + (over === 'drop' ? ' over' : '')} {...dropProps('drop')}>
            <div className="hd-art" aria-hidden="true">
              <div className="fr b"><img src={fb} alt="" draggable={false} /></div>
              <div className="fr a"><img src={fa} alt="" draggable={false} style={{ filter: 'hue-rotate(-30deg) saturate(1.2)' }} /></div>
              <div className="fr c"><img src={fa} alt="" draggable={false} style={{ objectPosition: '70% 50%' }} /></div>
              <div className="tl">
                {['var(--c-video)', 'var(--c-video)', 'var(--c-image)', 'var(--c-video)', 'var(--c-text)', 'var(--c-video)'].map((c, i) => <i key={i} style={{ '--c': c, flex: [1.4, 1, 0.7, 1.2, 0.6, 1][i] }} />)}
                <b />
              </div>
            </div>
            <div className="hd-body">
              <h2>Videolarını buraya bırak</h2>
              <p>Video, fotoğraf ve müzik. Bıraktığın dosyalar zaman çizelgesine dizilir.</p>
              <div className="hd-acts">
                <button className="btn light xl" onClick={async () => startWith(await pickFiles(), ratio, null)}><Icon name="import" size={17} sw={1.9} />Dosya seç</button>
                <button className="btn lg ghost" onClick={() => A.newProject(ratio)}><Icon name="plus" size={15} />Boş proje</button>
              </div>
              <div className="hd-ratio">
                <span className="lb">Biçim</span>
                <div className="ratio-row">
                  {RATIO_TILES.map(([id, hint]) => {
                    const r = RATIOS.find(x => x.id === id)
                    const k = 26 / Math.max(r.w, r.h)
                    return (
                      <button key={id} className={'ratio-tile' + (ratio === id ? ' on' : '')} onClick={() => setRatio(id)}>
                        <span className="rt-box"><span className="rt-frame" style={{ width: r.w * k, height: r.h * k }} /></span>
                        <span className="rt-txt"><span className="rt-id">{r.label}</span><span className="rt-hint">{hint}</span></span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="home-sec">
            <div className="home-sec-h"><h3>Tek tıkla kurgu</h3><span>Bir tarif seç, videolarını ver.</span></div>
            <div className="recipe-grid">
              {RECIPES.map((r, i) => (
                <button key={r.id} className={'recipe' + (over === r.id ? ' over' : '')} {...dropProps(r.id)}
                  onClick={async () => startWith(await pickFiles(), ratio, r.id)}>
                  <RecipePreview kind={r.id} i={i} frames={[fa, fb]} />
                  <span className="rp-t"><b><Icon name={r.icon} size={14} />{r.name}</b><span>{r.desc}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div className="home-sec">
            <div className="home-sec-h"><h3>Kütüphane</h3><span>Hepsi bilgisayarında, internetsiz çalışır.</span></div>
            <div className="home-stats">
              <span><Icon name="fx" size={14} /><b>{counts.fx}</b> efekt</span>
              <span><Icon name="transition" size={14} /><b>{counts.tr}</b> geçiş</span>
              <span><Icon name="filter" size={14} /><b>{counts.fl}</b> filtre</span>
              <span><Icon name="text" size={14} /><b>{counts.tx}</b> yazı şablonu</span>
              <span><Icon name="caption" size={14} /><b>{counts.cs}</b> altyazı stili</span>
              <span><Icon name="sticker" size={14} /><b>{counts.st}</b> çıkartma</span>
              <span><Icon name="music" size={14} /><b>{counts.au}</b> ses ve müzik</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel home-side">
        <div className="phead"><span className="ttl">Son projeler</span><span className="faint" style={{ fontSize: 12 }}>{recent.length || ''}</span></div>
        {auto && (
          <div className="home-recover">
            <Icon name="warn" size={16} />
            <span className="grow">Son oturumdan kurtarılan bir proje var · {auto.when.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <button className="btn sm" onClick={() => {
              try {
                const p = JSON.parse(fs.readFileSync(auto.path, 'utf8'))
                const orig = p.__path || null
                delete p.__path
                store.loadProject(p, orig)
                store.setUI({ dirty: true })
              } catch (e) { store.toast('Kurtarılamadı', 'error') }
            }}>Geri yükle</button>
            <button className="ibtn sm" onClick={() => setAuto(null)} data-tip="Yoksay"><Icon name="x" size={12} /></button>
          </div>
        )}
        <div className="pbody">
          {!recent.length && (
            <div className="empty" style={{ paddingTop: 70 }}>
              <Icon name="film" size={30} />
              <div className="big">Henüz proje yok</div>
              <div>Kaydettiğin projeler burada görünür.</div>
            </div>
          )}
          <div className="recent-grid">
            {recent.map(r => (
              <button key={r.path} className="recent" onClick={() => A.openProject(r.path)}
                onContextMenu={e => openMenu(e, [
                  { label: 'Aç', icon: 'folder', onClick: () => A.openProject(r.path) },
                  { label: 'Klasörde göster', icon: 'search', onClick: () => ipc && ipc.invoke('shell:show', r.path) },
                ])}>
                <div className="rc-thumb">
                  {r.thumb && fs && fs.existsSync(r.thumb) ? <img src={fileUrl(r.thumb) + '?' + r.modified} alt="" /> : <Icon name="film" size={22} />}
                  <span className="rc-ratio">{r.ratio || ''}</span>
                </div>
                <div className="rc-txt">
                  <div className="rc-name">{r.name}</div>
                  <div className="rc-meta">{new Date(r.modified).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · {fmtDur(r.duration || 0)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tarif önizlemesi
// Her tarifin küçük kurgusu kendi kendine oynar: kareler vuruşta değişir, zaman çizelgesi çubukları yanar.
const CAP_WORDS = ['BU', 'AN', 'EFSANE']
function RecipePreview({ kind, i, frames }) {
  const [tick, setTick] = useState(i * 3)
  const bpm = { beat: 128, talk: 70, game: 150, vlog: 92, slides: 60, recap: 140 }[kind] || 100
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000 / bpm)
    return () => clearInterval(t)
  }, [bpm])
  const n = 6
  const on = tick % n
  const fr = frames[(kind === 'talk' ? 0 : Math.floor(tick / (kind === 'slides' ? 2 : 1))) % 2]
  const hue = kind === 'vlog' ? 25 : kind === 'recap' ? -40 + (tick % 3) * 40 : kind === 'slides' ? 60 : 0
  const scale = kind === 'beat' || kind === 'game' ? (tick % 2 ? 1.12 : 1) : kind === 'talk' ? (Math.floor(tick / 4) % 2 ? 1.14 : 1.02) : kind === 'slides' || kind === 'vlog' ? 1 + ((tick % 8) / 8) * 0.12 : 1.05
  const pos = kind === 'slides' ? `${30 + (tick % 8) * 5}% 50%` : 'center'
  return (
    <span className="rp-mon">
      <span className="fx" style={{
        backgroundImage: `url(${fr})`, backgroundPosition: pos, filter: `hue-rotate(${hue}deg) saturate(1.15)`,
        transform: `scale(${scale})`, transition: kind === 'slides' || kind === 'vlog' ? 'transform 900ms linear' : 'transform 260ms var(--spring-pop)',
      }} />
      {kind === 'talk' && <span className="cap">{CAP_WORDS.map((w, k) => <i key={k} className={k === tick % 3 ? 'on' : ''}>{w}</i>)}</span>}
      {kind === 'game' && tick % 4 === 0 && <span key={tick} className="flash on" />}
      <span className="mtl">{Array.from({ length: n }, (_, k) => <i key={k} className={k === on ? 'on' : ''} />)}</span>
    </span>
  )
}
