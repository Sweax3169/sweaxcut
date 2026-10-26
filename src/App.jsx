import React, { useState, useEffect, useRef, useCallback } from 'react'
import TitleBar from './components/TitleBar.jsx'
import QueuePanel from './components/QueuePanel.jsx'
import PreviewStage from './components/PreviewStage.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import BottomBar from './components/BottomBar.jsx'
import Toasts from './components/Toasts.jsx'
import { isVideoPath, baseName, nextId } from './util.js'
import { renderPanelOverlay } from './overlay.js'

const api = () => window.sweaxcut

export const DEFAULT_OPTS = {
  mode: 'blur',
  blurStrength: 55,
  bgDarken: 35,
  zoom: 1,
  focusX: 0.5,
  focusY: 0.5,
  panelColor: '#1b1128',
  topText: '',
  bottomText: '',
  textColor: '#ffffff',
  fontSize: 76,
  videoPos: 0.3,
  quality: 18,
  useGpu: true,
  outputDir: null,
  speed: 1,
  colorFilter: 'none',
  musicPath: null,
  musicVolume: 60,
  origVolume: 100,
}

export default function App() {
  const [files, setFiles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [opts, setOpts] = useState(DEFAULT_OPTS)
  const [theme, setTheme] = useState('seker')
  const [gpu, setGpu] = useState(null)
  const [converting, setConverting] = useState(false)
  const [toasts, setToasts] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const filesRef = useRef(files)
  filesRef.current = files
  const settingsLoaded = useRef(false)

  const toast = useCallback((text, kind = 'info', action = null) => {
    const id = nextId()
    setToasts(t => [...t, { id, text, kind, action }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 7000)
  }, [])

  const updateFile = useCallback((id, patch) => {
    setFiles(fs => fs.map(f => (f.id === id ? { ...f, ...(typeof patch === 'function' ? patch(f) : patch) } : f)))
  }, [])

  // --------------------------- açılış

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const s = await api().getSettings()
      if (!alive) return
      if (s && s.opts) setOpts(o => ({ ...o, ...s.opts }))
      if (s && s.theme) setTheme(s.theme)
      settingsLoaded.current = true
      const g = await api().detectGpu()
      if (alive) setGpu(!!g)
    })()
    return () => { alive = false }
  }, [])

  // ayarları kalıcılaştır (debounce)
  useEffect(() => {
    if (!settingsLoaded.current) return
    const t = setTimeout(() => {
      // Yazılar ve müzik oturuma özeldir — kalıcı ayarlara yazılmaz
      const { topText, bottomText, musicPath, ...persist } = opts
      api().setSettings({ opts: persist, theme })
    }, 500)
    return () => clearTimeout(t)
  }, [opts, theme])

  // --------------------------- kuyruk olayları

  useEffect(() => {
    const offs = [
      api().onJobProgress(d => {
        updateFile(d.id, { percent: d.percent, fps: d.fps, speed: d.speed, eta: d.eta })
      }),
      api().onJobState(d => {
        updateFile(d.id, f => ({
          state: d.state,
          output: d.output || f.output,
          message: d.message || null,
          percent: d.state === 'done' ? 100 : (d.state === 'processing' ? 0 : f.percent),
        }))
        if (d.state === 'error' && d.message) toast(`${baseName((filesRef.current.find(f => f.id === d.id) || {}).path || '')}: ${d.message}`, 'err')
      }),
      api().onJobNote(d => toast(d.note, 'info')),
      api().onQueueFinished(d => {
        setConverting(false)
        const done = filesRef.current.filter(f => f.state === 'done')
        if (d && d.cancelled) {
          toast('Dönüştürme iptal edildi.', 'info')
        } else if (done.length > 0) {
          const last = done[done.length - 1]
          toast(`${done.length} video dönüştürüldü 🎉`, 'ok', {
            label: 'Klasörde göster',
            onClick: () => api().showInFolder(last.output),
          })
        }
      }),
    ]
    return () => offs.forEach(off => off && off())
  }, [toast, updateFile])

  // --------------------------- dosya ekleme

  const addPaths = useCallback(async (paths) => {
    const existing = new Set(filesRef.current.map(f => f.path))
    for (const p of paths) {
      if (!p || existing.has(p)) continue
      if (!isVideoPath(p)) {
        // klasör olabilir — içini tara
        const res = await api().scanFolder(p)
        if (res && res.ok && res.files.length > 0) {
          await addPaths(res.files)
        } else {
          toast(`"${baseName(p)}" desteklenen bir video değil.`, 'err')
        }
        continue
      }
      existing.add(p)
      const id = nextId()
      const entry = {
        id, path: p, name: baseName(p),
        url: api().toFileUrl(p),
        meta: null, thumb: null,
        state: 'loading', percent: 0, output: null, message: null,
      }
      setFiles(fs => [...fs, entry])
      setSelectedId(sid => sid || id)
      ;(async () => {
        const res = await api().probe(p)
        if (!res.ok) {
          updateFile(id, { state: 'error', message: res.message })
          toast(`${baseName(p)}: ${res.message}`, 'err')
          return
        }
        updateFile(id, { meta: res.meta, state: 'ready' })
        const th = await api().thumbnail(p, Math.min(1, (res.meta.duration || 2) * 0.25))
        if (th && th.ok) updateFile(id, { thumb: th.dataUrl })
      })()
    }
  }, [toast, updateFile])

  const chooseFiles = useCallback(async () => {
    const paths = await api().chooseFiles()
    if (paths && paths.length) addPaths(paths)
  }, [addPaths])

  const addFolder = useCallback(async () => {
    const dir = await api().chooseFolder()
    if (!dir) return
    const res = await api().scanFolder(dir)
    if (res.ok && res.files.length > 0) {
      addPaths(res.files)
      toast(`Klasörden ${res.files.length} video eklendi.`, 'ok')
    } else {
      toast('Bu klasörde video bulunamadı.', 'info')
    }
  }, [addPaths, toast])

  const removeFile = useCallback((id) => {
    const f = filesRef.current.find(x => x.id === id)
    if (f && f.state === 'processing') return
    setFiles(fs => fs.filter(x => x.id !== id))
    setSelectedId(sid => {
      if (sid !== id) return sid
      const rest = filesRef.current.filter(x => x.id !== id)
      return rest.length ? rest[0].id : null
    })
  }, [])

  // "Birlikte aç" / komut satırından gelen dosyalar
  useEffect(() => {
    if (!api().onOpenFiles) return
    const off = api().onOpenFiles(paths => { if (paths && paths.length) addPaths(paths) })
    return () => off && off()
  }, [addPaths])

  // --------------------------- sürükle-bırak

  useEffect(() => {
    const onDragOver = e => { e.preventDefault(); setDragOver(true) }
    const onDragLeave = e => { if (!e.relatedTarget) setDragOver(false) }
    const onDrop = e => {
      e.preventDefault()
      setDragOver(false)
      const paths = [...(e.dataTransfer?.files || [])].map(f => api().filePath(f)).filter(Boolean)
      if (paths.length) addPaths(paths)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addPaths])

  // --------------------------- dönüştürme

  const startConvert = useCallback(async () => {
    const jobs = filesRef.current
      .filter(f => ['ready', 'error', 'cancelled', 'done'].includes(f.state) && f.meta)
      .map(f => {
        const job = { id: f.id, input: f.path }
        if (f.trim && (f.trim.start > 0 || f.trim.end != null)) job.trim = f.trim
        if (opts.mode === 'panel') {
          // Yazıları canvas'ta çiz — çıktı önizlemeyle birebir aynı olur
          try { job.overlayPng = renderPanelOverlay(f.meta, opts) } catch (e) { /* drawtext yedeği devreye girer */ }
        }
        return job
      })
    if (jobs.length === 0) {
      toast('Önce bir video ekle.', 'info')
      return
    }
    setFiles(fs => fs.map(f => (jobs.some(j => j.id === f.id) ? { ...f, state: 'queued', percent: 0, message: null } : f)))
    setConverting(true)
    const res = await api().startQueue(jobs, { ...opts, useGpu: opts.useGpu && gpu !== false })
    if (!res.ok) {
      setConverting(false)
      toast(res.message || 'Dönüştürme başlatılamadı.', 'err')
    }
  }, [opts, gpu, toast])

  const cancelConvert = useCallback(async () => {
    await api().cancelQueue()
  }, [])

  const selected = files.find(f => f.id === selectedId) || null

  return (
    <div className="app">
      <TitleBar gpu={gpu} />
      <div className="main">
        <QueuePanel
          files={files}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeFile}
          onChooseFiles={chooseFiles}
          onAddFolder={addFolder}
          onShowOutput={p => api().showInFolder(p)}
          dragOver={dragOver}
          converting={converting}
        />
        <div className="panel center-panel">
          <PreviewStage
            file={selected}
            opts={opts}
            setOpts={setOpts}
            onChooseFiles={chooseFiles}
            dragOver={dragOver}
            onSetTrim={(trim) => selected && updateFile(selected.id, { trim })}
          />
        </div>
        <SettingsPanel opts={opts} setOpts={setOpts} gpu={gpu} theme={theme} setTheme={setTheme} />
      </div>
      <BottomBar
        files={files}
        opts={opts}
        setOpts={setOpts}
        converting={converting}
        onConvert={startConvert}
        onCancel={cancelConvert}
        onChooseOutputDir={async () => {
          const dir = await api().chooseFolder()
          if (dir) setOpts(o => ({ ...o, outputDir: dir }))
        }}
      />
      <Toasts toasts={toasts} />
    </div>
  )
}
