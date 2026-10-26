import React from 'react'

const MODES = [
  {
    key: 'blur',
    icon: '🌫️',
    name: 'Blur Dolgu',
    desc: 'Video ortada tam durur, boşluklar bulanık kopyayla dolar',
    badge: 'ÖNERİLEN',
  },
  {
    key: 'zoom',
    icon: '🎯',
    name: 'Akıllı Zoom',
    desc: 'Odak noktası seçilebilir dikey kırpma',
  },
  {
    key: 'panel',
    icon: '🧁',
    name: 'Üst-Alt Düzen',
    desc: 'Video üstte, altta renkli alan + yazı',
  },
]

const PANEL_COLORS = ['#1b1128', '#2d1436', '#ff4fa3', '#9b5cff', '#3b2417', '#0f2d28', '#101418', '#f4e3ee']
const TEXT_COLORS = ['#ffffff', '#ffd6ec', '#ffe9a8', '#111111', '#ff4fa3']

const QUALITIES = [
  { q: 16, label: 'Maksimum' },
  { q: 18, label: 'Yüksek' },
  { q: 21, label: 'Dengeli' },
  { q: 24, label: 'Küçük dosya' },
]

const COLOR_FILTERS = [
  { key: 'none', label: 'Yok' },
  { key: 'canli', label: 'Canlı' },
  { key: 'sinematik', label: 'Sinematik' },
  { key: 'sicak', label: 'Sıcak' },
  { key: 'soguk', label: 'Soğuk' },
  { key: 'siyahbeyaz', label: 'S&B' },
]

const THEMES = [
  { key: 'seker', label: 'Şeker', grad: 'linear-gradient(135deg,#ff4fa3,#9b5cff)' },
  { key: 'mor', label: 'Mor Büyü', grad: 'linear-gradient(135deg,#8b5cf6,#d78cff)' },
  { key: 'cikolata', label: 'Çikolata', grad: 'linear-gradient(135deg,#f59e5b,#ff6fa5)' },
  { key: 'nane', label: 'Nane', grad: 'linear-gradient(135deg,#2dd4bf,#86efac)' },
]

function Slider({ label, value, display, min, max, step = 1, onChange }) {
  return (
    <div className="slider-row">
      <div className="sr-head">
        <span className="sr-label">{label}</span>
        <span className="sr-value">{display != null ? display : value}</span>
      </div>
      <input
        type="range" className="styled"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

export default function SettingsPanel({ opts, setOpts, gpu, theme, setTheme }) {
  const set = (patch) => setOpts(o => ({ ...o, ...patch }))
  const mode = opts.mode

  return (
    <div className="panel right-panel">
      <div className="panel-title">Dönüştürme Modu</div>
      <div className="mode-cards">
        {MODES.map(m => (
          <button key={m.key} className={`mode-card ${mode === m.key ? 'active' : ''}`} onClick={() => set({ mode: m.key })}>
            <span className="mc-icon">{m.icon}</span>
            <span>
              <div className="mc-name">{m.name}</div>
              <div className="mc-desc">{m.desc}</div>
            </span>
            {m.badge && <span className="mc-badge">{m.badge}</span>}
          </button>
        ))}
      </div>

      {mode === 'blur' && (
        <div className="settings-group">
          <div className="sg-title">Blur Ayarları</div>
          <Slider label="Bulanıklık" value={opts.blurStrength} min={0} max={100}
            onChange={v => set({ blurStrength: v })} />
          <Slider label="Arka plan karartma" value={opts.bgDarken} min={0} max={80} display={`%${opts.bgDarken}`}
            onChange={v => set({ bgDarken: v })} />
        </div>
      )}

      {mode === 'zoom' && (
        <div className="settings-group">
          <div className="sg-title">Zoom Ayarları</div>
          <Slider label="Yakınlaştırma" value={opts.zoom} min={1} max={3} step={0.05} display={`×${Number(opts.zoom).toFixed(2)}`}
            onChange={v => set({ zoom: v })} />
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 10 }}>
            💡 Önizlemede kadrajı sürükleyerek odak noktasını seçebilirsin.
          </div>
          <button
            className="add-folder-btn" style={{ margin: 0, width: '100%' }}
            onClick={() => set({ focusX: 0.5, focusY: 0.5, zoom: 1 })}
          >Kadrajı sıfırla</button>
        </div>
      )}

      {mode === 'panel' && (
        <div className="settings-group">
          <div className="sg-title">Düzen Ayarları</div>
          <input
            className="text-input" placeholder="Üst yazı (isteğe bağlı)"
            value={opts.topText} maxLength={60}
            onChange={e => set({ topText: e.target.value })}
          />
          <input
            className="text-input" placeholder="Alt yazı (isteğe bağlı)"
            value={opts.bottomText} maxLength={60}
            onChange={e => set({ bottomText: e.target.value })}
          />
          <div className="sr-head" style={{ marginBottom: 6 }}><span className="sr-label" style={{ fontSize: 12 }}>Alan rengi</span></div>
          <div className="color-swatches">
            {PANEL_COLORS.map(c => (
              <div key={c} className={`swatch ${opts.panelColor === c ? 'active' : ''}`} style={{ background: c }}
                onClick={() => set({ panelColor: c })} />
            ))}
          </div>
          <div className="sr-head" style={{ marginBottom: 6 }}><span className="sr-label" style={{ fontSize: 12 }}>Yazı rengi</span></div>
          <div className="color-swatches">
            {TEXT_COLORS.map(c => (
              <div key={c} className={`swatch ${opts.textColor === c ? 'active' : ''}`} style={{ background: c }}
                onClick={() => set({ textColor: c })} />
            ))}
          </div>
          <Slider label="Yazı boyutu" value={opts.fontSize} min={40} max={140}
            onChange={v => set({ fontSize: v })} />
          <Slider label="Video konumu" value={Math.round(opts.videoPos * 100)} min={0} max={100} display=""
            onChange={v => set({ videoPos: v / 100 })} />
        </div>
      )}

      <div className="settings-group">
        <div className="sg-title">Ek Dokunuşlar</div>
        <Slider label="Oynatma hızı" value={opts.speed} min={0.5} max={2} step={0.05} display={`×${Number(opts.speed).toFixed(2)}`}
          onChange={v => set({ speed: v })} />
        <div className="sr-head" style={{ marginBottom: 6 }}><span className="sr-label" style={{ fontSize: 12 }}>Renk filtresi</span></div>
        <div className="filter-grid">
          {COLOR_FILTERS.map(f => (
            <button key={f.key} className={`select-pill ${opts.colorFilter === f.key ? 'active' : ''}`}
              onClick={() => set({ colorFilter: f.key })}>{f.label}</button>
          ))}
        </div>
        <div className="sr-head" style={{ marginBottom: 6 }}><span className="sr-label" style={{ fontSize: 12 }}>Müzik</span></div>
        {opts.musicPath ? (
          <div className="music-row">
            <span className="music-name" title={opts.musicPath}>🎵 {opts.musicPath.split(/[\\/]/).pop()}</span>
            <button className="out-reset" title="Müziği kaldır" onClick={() => set({ musicPath: null })}>✕</button>
          </div>
        ) : (
          <button className="add-folder-btn" style={{ margin: '0 0 10px', width: '100%' }}
            onClick={async () => {
              const p = await window.sweaxcut.chooseMusic()
              if (p) set({ musicPath: p })
            }}>🎵 Müzik ekle (videoya karışır)</button>
        )}
        <Slider label="Video sesi" value={opts.origVolume} min={0} max={200} display={`%${opts.origVolume}`}
          onChange={v => set({ origVolume: v })} />
        {opts.musicPath && (
          <Slider label="Müzik sesi" value={opts.musicVolume} min={0} max={200} display={`%${opts.musicVolume}`}
            onChange={v => set({ musicVolume: v })} />
        )}
      </div>

      <div className="settings-group">
        <div className="sg-title">Kalite &amp; Hız</div>
        <div className="select-row">
          {QUALITIES.map(x => (
            <button key={x.q} className={`select-pill ${opts.quality === x.q ? 'active' : ''}`}
              onClick={() => set({ quality: x.q })}>{x.label}</button>
          ))}
        </div>
        <div className="toggle-row">
          <span>
            GPU hızlandırma
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
              {gpu ? 'NVIDIA NVENC hazır ⚡' : gpu === false ? 'Bu bilgisayarda bulunamadı' : 'Denetleniyor…'}
            </div>
          </span>
          <div
            className={`toggle ${opts.useGpu && gpu ? 'on' : ''} ${gpu === false ? 'disabled' : ''}`}
            onClick={() => { if (gpu) set({ useGpu: !opts.useGpu }) }}
          />
        </div>
      </div>

      <div className="settings-group" style={{ paddingBottom: 20 }}>
        <div className="sg-title">Tema</div>
        <div className="theme-swatches">
          {THEMES.map(t => (
            <div key={t.key} className={`theme-dot ${theme === t.key ? 'active' : ''}`} style={{ background: t.grad }}
              onClick={() => setTheme(t.key)}>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
