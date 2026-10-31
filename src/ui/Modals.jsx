import React, { useEffect, useMemo, useRef, useState } from 'react'
import { store, useStore } from '../core/store.js'
import { projectDuration } from '../core/timeline.js'
import { timecode } from '../core/time.js'
import { Modal, Segmented, Select, Toggle, PropRow } from './controls.jsx'
import Icon from './Icon.jsx'
import { SHORTCUTS } from './shortcuts.js'
import { playback } from '../engine/playback.js'
import { ipc, path, appPaths, fs, ensureDir } from '../platform/node.js'
import { Logo } from './TitleBar.jsx'
import AutoEditModal from './modals/AutoEditModal.jsx'
import CommandPalette from './modals/CommandPalette.jsx'

const expMods = import.meta.glob('../engine/export.js', { eager: true })
const exporter = expMods['../engine/export.js'] || null

export default function Modals() {
  const modal = useStore(s => s.ui.modal)
  if (!modal) return null
  const close = () => store.closeModal()
  if (modal.type === 'export') return <ExportModal onClose={close} {...modal.props} />
  if (modal.type === 'shortcuts') return <ShortcutsModal onClose={close} />
  if (modal.type === 'about') return <AboutModal onClose={close} />
  if (modal.type === 'autoedit') return <AutoEditModal onClose={close} {...modal.props} />
  if (modal.type === 'command') return <CommandPalette onClose={close} />
  return null
}

function ShortcutsModal({ onClose }) {
  return (
    <Modal title="Klavye kısayolları" edge="Yardım" onClose={onClose} width={560}>
      <div className="kbd-list">
        {SHORTCUTS.map(([k, d]) => <React.Fragment key={k}><span className="k">{k}</span><span>{d}</span></React.Fragment>)}
      </div>
    </Modal>
  )
}

function AboutModal({ onClose }) {
  const v = appPaths().version || '3.0.0'
  return (
    <Modal title="SWEAXCUT" edge={'Sürüm ' + v} onClose={onClose} width={460}>
      <div className="col" style={{ gap: 12 }}>
        <Logo size={34} />
        <div className="dim">Sweax Studios yapımı video kurgu programı. Kurgu, altyazı ve dışa aktarma bilgisayarında çalışır.</div>
        <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
          Emoji grafikleri: Twemoji © Twitter, Inc. ve katkıda bulunanlar, CC-BY 4.0.<br />
          Geçişlerin bir kısmı gl-transitions (MIT), yazı tipleri SIL OFL, altyazı whisper.cpp (MIT), seslendirme Piper (MIT),
          görüntü işleme FFmpeg (GPL) ve MediaPipe (Apache-2.0) ile yapılır. Ayrıntılar: docs/licenses.
        </div>
      </div>
    </Modal>
  )
}

const EXP_PRESETS = [
  { id: 'sosyal', name: 'Sosyal medya', hint: 'TikTok · Reels · Shorts', o: { format: 'mp4', resolution: '1080p', fps: 30, quality: 'yuksek', codec: 'h264' } },
  { id: 'youtube', name: 'YouTube', hint: '1080p · 60 kare', o: { format: 'mp4', resolution: '1080p', fps: 60, quality: 'yuksek', codec: 'h264' } },
  { id: '4k', name: 'En yüksek', hint: '4K · H.265', o: { format: 'mp4', resolution: '4k', fps: 30, quality: 'maksimum', codec: 'hevc' } },
  { id: 'hizli', name: 'Hızlı paylaş', hint: '720p · küçük dosya', o: { format: 'mp4', resolution: '720p', fps: 30, quality: 'orta', codec: 'h264' } },
  { id: 'gif', name: 'GIF', hint: 'Döngülü hareketli görsel', o: { format: 'gif', resolution: '480p' } },
  { id: 'ses', name: 'Yalnız ses', hint: 'MP3 · 320k', o: { format: 'mp3', audioBitrate: 320 } },
]
const RES = [['auto', 'Proje'], ['480p', '480p'], ['720p', '720p'], ['1080p', '1080p'], ['1440p', '2K'], ['4k', '4K']]
const QUAL = [['dusuk', 'Düşük'], ['orta', 'Orta'], ['yuksek', 'Yüksek'], ['maksimum', 'Maksimum']]
const FORMATS = [
  { value: 'mp4', label: 'MP4 (önerilen)' }, { value: 'mov', label: 'MOV' }, { value: 'webm', label: 'WebM' },
  { value: 'gif', label: 'GIF' }, { value: 'mp3', label: 'MP3 (yalnız ses)' }, { value: 'wav', label: 'WAV (yalnız ses)' },
]

function outDir() {
  try { return ensureDir(path.join(appPaths().videos || appPaths().documents, 'SWEAXCUT')) } catch (e) { return '' }
}

function ExportModal({ onClose, mode }) {
  const project = useStore(s => s.project)
  const dur = projectDuration(project)
  const rangeIn = useStore(s => s.ui.rangeIn), rangeOut = useStore(s => s.ui.rangeOut)
  const [opts, setOpts] = useState(() => {
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem('sweax.export') || '{}') } catch (e) { /* */ }
    return { format: 'mp4', resolution: 'auto', fps: project.settings.fps, quality: 'yuksek', codec: 'h264', hw: 'auto', audioBitrate: 192, onlyRange: false, ...saved }
  })
  const [name, setName] = useState((project.name || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim())
  const [dir, setDir] = useState(outDir())
  const [run, setRun] = useState(null) // { progress, stage, fps, eta, done, error, path }
  const ctrl = useRef(null)
  const [thumb, setThumb] = useState(null)
  useEffect(() => { setThumb(playback.snapshotDataURL()) }, [])
  useEffect(() => { try { localStorage.setItem('sweax.export', JSON.stringify({ ...opts, onlyRange: false })) } catch (e) { /* */ } }, [opts])

  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }))
  const audioOnly = opts.format === 'mp3' || opts.format === 'wav'
  const ext = opts.format
  const range = opts.onlyRange && (rangeIn != null || rangeOut != null) ? { start: rangeIn ?? 0, end: rangeOut ?? dur } : null
  const len = range ? range.end - range.start : dur
  const outW = useMemo(() => sizeFor(project, opts.resolution), [project, opts.resolution])
  const estMB = useMemo(() => {
    if (exporter && exporter.estimateSize) { try { return exporter.estimateSize({ ...opts, width: outW.w, height: outW.h }, len) / 1e6 } catch (e) { /* */ } }
    const mbps = audioOnly ? 0.2 : ({ dusuk: 4, orta: 8, yuksek: 14, maksimum: 28 }[opts.quality] || 10) * (outW.w * outW.h) / (1920 * 1080)
    return mbps * len / 8
  }, [opts, len, outW, audioOnly])

  if (mode === 'frame') return <FrameExport onClose={onClose} />

  const start = async () => {
    if (!exporter || !exporter.exportProject) { store.toast('Dışa aktarma motoru henüz hazır değil', 'error'); return }
    if (dur <= 0) { store.toast('Zaman çizelgesi boş', 'error'); return }
    let file = path.join(dir, name + '.' + ext)
    if (fs.existsSync(file)) {
      let i = 2
      while (fs.existsSync(path.join(dir, `${name} (${i}).${ext}`))) i++
      file = path.join(dir, `${name} (${i}).${ext}`)
    }
    const ac = new AbortController()
    ctrl.current = ac
    playback.pause()
    setRun({ progress: 0, stage: 'hazirlik' })
    const t0 = performance.now()
    try {
      const res = await exporter.exportProject(store.get().project, { ...opts, path: file, range }, {
        signal: ac.signal,
        onProgress: (p) => {
          const progress = p.total ? p.frame / p.total : (p.progress || 0)
          setRun(r => ({ ...r, ...p, progress }))
          ipc && ipc.send('win:progress', progress)
        },
      })
      ipc && ipc.send('win:progress', null)
      setRun({ done: true, path: res && res.path ? res.path : file, seconds: (performance.now() - t0) / 1000, progress: 1, encoder: res && res.encoder })
    } catch (e) {
      ipc && ipc.send('win:progress', null)
      if (ac.signal.aborted) { setRun(null); store.toast('Dışa aktarma iptal edildi', 'info'); return }
      console.error(e)
      setRun({ error: String(e.message || e) })
    }
  }

  if (run) {
    return (
      <Modal title={run.done ? 'Hazır' : run.error ? 'Hata' : 'Dışa aktarılıyor'} edge={run.done ? 'Video kaydedildi' : 'Lütfen bekle'} width={560}
        onClose={run.done || run.error ? onClose : null}
        footer={run.done ? <>
          <button className="btn" onClick={() => ipc.invoke('shell:show', run.path)}><Icon name="folder" />Klasörde göster</button>
          <button className="btn" onClick={() => ipc.invoke('shell:open', run.path)}><Icon name="play" />Oynat</button>
          <button className="btn sig" onClick={onClose}>Tamam</button>
        </> : run.error ? <button className="btn" onClick={() => setRun(null)}>Geri</button>
          : <button className="btn danger" onClick={() => ctrl.current && ctrl.current.abort()}><Icon name="x" />İptal</button>}>
        <div className="exp-run">
          {run.done ? <>
            <div className="exp-big">%100</div>
            <div className="dim">{path.basename(run.path)} · {run.seconds.toFixed(1)} sn{run.encoder ? ' · ' + run.encoder : ''}</div>
          </> : run.error ? <div style={{ color: 'var(--danger)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{run.error}</div> : <>
            <div className="exp-big">%{Math.floor((run.progress || 0) * 100)}</div>
            <div className="bar"><i style={{ width: (run.progress || 0) * 100 + '%' }} /></div>
            <div className="row dim" style={{ fontSize: 12, gap: 16 }}>
              <span>{{ hazirlik: 'Hazırlanıyor', goruntu: 'Görüntü işleniyor', ses: 'Ses işleniyor', birlestirme: 'Birleştiriliyor' }[run.stage] || 'İşleniyor'}</span>
              {run.frame != null && <span>Kare {run.frame}/{run.total}</span>}
              {run.fps ? <span>{run.fps.toFixed(0)} kare/sn</span> : null}
              {run.eta != null && isFinite(run.eta) ? <span>Kalan ~{Math.ceil(run.eta)} sn</span> : null}
            </div>
          </>}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Dışa aktar" edge="Videoyu bilgisayarına kaydet" onClose={onClose} width={760}
      footer={<>
        <span className="faint" style={{ marginRight: 'auto', fontSize: 12 }}>Filigran eklenmez</span>
        <button className="btn" onClick={onClose}>Vazgeç</button>
        <button className="btn sig lg" onClick={start}><Icon name="export" size={15} sw={2} />Dışa aktar</button>
      </>}>
      <div className="exp-grid">
        <div className="col" style={{ gap: 10 }}>
          <div className="exp-prev" style={{ aspectRatio: `${project.settings.width}/${project.settings.height}` }}>{thumb && <img src={thumb} alt="" />}</div>
          <div className="exp-sum">
            <div><div className="k">Süre</div><div className="v">{timecode(len, project.settings.fps, false)}</div></div>
            <div><div className="k">Boyut</div><div className="v">{audioOnly ? '—' : outW.w + '×' + outW.h}</div></div>
            <div><div className="k">Tahmini</div><div className="v">~{estMB < 1 ? estMB.toFixed(1) : Math.round(estMB)} MB</div></div>
          </div>
        </div>
        <div className="exp-opts">
          <div className="exp-presets">
            {EXP_PRESETS.map(p => {
              const on = Object.entries(p.o).every(([k, v]) => opts[k] === v)
              return <button key={p.id} className={'exp-preset' + (on ? ' on' : '')} onClick={() => setOpts(o => ({ ...o, ...p.o }))}><b>{p.name}</b><span>{p.hint}</span></button>
            })}
          </div>
          <div className="prop"><span className="lbl static">Dosya adı</span><input className="field grow" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.stopPropagation()} /></div>
          <div className="prop"><span className="lbl static">Klasör</span>
            <input className="field grow mono" style={{ fontSize: 11 }} value={dir} readOnly />
            <button className="btn sm" onClick={async () => { const r = await ipc.invoke('dialog:open', { properties: ['openDirectory'], defaultPath: dir }); if (r[0]) setDir(r[0]) }}>Değiştir</button>
          </div>
          <Select label="Biçim" value={opts.format} onChange={v => set('format', v)} options={FORMATS} />
          {!audioOnly && <>
            <Segmented label="Çözünürlük" value={opts.resolution} onChange={v => set('resolution', v)} options={RES.map(([v, l]) => ({ value: v, label: l }))} />
            <Segmented label="Kare hızı" value={opts.fps} onChange={v => set('fps', v)} options={[24, 25, 30, 50, 60].map(v => ({ value: v, label: String(v) }))} />
            <Segmented label="Kalite" value={opts.quality} onChange={v => set('quality', v)} options={QUAL.map(([v, l]) => ({ value: v, label: l }))} />
            {opts.format !== 'gif' && <Select label="Kodek" value={opts.codec} onChange={v => set('codec', v)} options={[
              { value: 'h264', label: 'H.264 (her yerde oynar)' }, { value: 'hevc', label: 'H.265 / HEVC (küçük dosya)' },
              { value: 'av1', label: 'AV1 (en küçük)' }, ...(opts.format === 'webm' ? [{ value: 'vp9', label: 'VP9' }] : []),
              ...(opts.format === 'mov' ? [{ value: 'prores', label: 'ProRes (kurgu ara dosyası)' }] : []),
            ]} />}
            {opts.format !== 'gif' && <Select label="Donanım" value={opts.hw} onChange={v => set('hw', v)} options={[
              { value: 'auto', label: 'Otomatik (ekran kartı varsa onu kullan)' }, { value: 'nvenc', label: 'NVIDIA NVENC' },
              { value: 'amf', label: 'AMD AMF' }, { value: 'qsv', label: 'Intel Quick Sync' }, { value: 'cpu', label: 'İşlemci (en uyumlu)' },
            ]} />}
          </>}
          {opts.format !== 'gif' && <Segmented label="Ses kalitesi" value={opts.audioBitrate} onChange={v => set('audioBitrate', v)} options={[128, 192, 256, 320].map(v => ({ value: v, label: v + 'k' }))} />}
          {(rangeIn != null || rangeOut != null) && <Toggle label="Yalnız seçili aralık" on={opts.onlyRange} onChange={v => set('onlyRange', v)} />}
          {!exporter && <div style={{ color: 'var(--danger)' }}>Dışa aktarma motoru yüklenmedi.</div>}
        </div>
      </div>
    </Modal>
  )
}

function sizeFor(project, res) {
  const W = project.settings.width, H = project.settings.height
  if (res === 'auto') return { w: W, h: H }
  const short = { '480p': 480, '720p': 720, '1080p': 1080, '1440p': 1440, '4k': 2160 }[res] || Math.min(W, H)
  const k = short / Math.min(W, H)
  const ev = n => Math.max(2, Math.round(n * k / 2) * 2)
  return { w: ev(W), h: ev(H) }
}

function FrameExport({ onClose }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    const t = playback.time
    const file = await ipc.invoke('dialog:save', { title: 'Kareyi kaydet', defaultPath: path.join(outDir(), 'kare-' + timecode(t, 30).replace(/:/g, '-') + '.png'), filters: [{ name: 'PNG', extensions: ['png'] }, { name: 'JPEG', extensions: ['jpg'] }] })
    if (!file) return
    setBusy(true)
    try {
      if (exporter && exporter.exportFrame) await exporter.exportFrame(store.get().project, t, file, { scale: 1 })
      else { const url = playback.snapshotDataURL(); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')) }
      store.toast('Kare kaydedildi', 'ok')
      onClose()
    } catch (e) { store.toast('Kaydedilemedi: ' + e.message, 'error') }
    setBusy(false)
  }
  return (
    <Modal title="Kareyi kaydet" edge="Tek kare" onClose={onClose} width={420}
      footer={<><button className="btn" onClick={onClose}>Vazgeç</button><button className="btn sig" disabled={busy} onClick={go}>Kaydet</button></>}>
      <div className="dim">Oynatma kafasındaki kare proje çözünürlüğünde PNG olarak kaydedilir.</div>
    </Modal>
  )
}
