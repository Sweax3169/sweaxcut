import React from 'react'
import { formatTime, baseName } from '../util.js'

export default function BottomBar({ files, opts, setOpts, converting, onConvert, onCancel, onChooseOutputDir }) {
  const convertible = files.filter(f => ['ready', 'error', 'cancelled', 'done'].includes(f.state) && f.meta)
  const total = files.filter(f => ['queued', 'processing', 'done', 'error', 'cancelled'].includes(f.state)).length
  const finished = files.filter(f => ['done', 'error', 'cancelled'].includes(f.state)).length
  const current = files.find(f => f.state === 'processing')

  let overallPct = 0
  if (converting && total > 0) {
    overallPct = ((finished + (current ? (current.percent || 0) / 100 : 0)) / total) * 100
  }

  return (
    <div className="bottom-bar">
      <div
        className="out-selector"
        onClick={onChooseOutputDir}
        title={opts.outputDir || 'Dönüşen video kaynak dosyanın yanına kaydedilir'}
      >
        <span>📂</span>
        <span className="out-path">
          {opts.outputDir ? baseName(opts.outputDir) : 'Kaynağın yanına kaydet'}
        </span>
        {opts.outputDir && (
          <button
            className="out-reset" title="Varsayılana dön"
            onClick={e => { e.stopPropagation(); setOpts(o => ({ ...o, outputDir: null })) }}
          >✕</button>
        )}
      </div>

      <div className="overall-progress">
        {converting && (
          <>
            <div className="op-track"><div className="op-fill" style={{ width: `${overallPct}%` }} /></div>
            <div className="op-label">
              <span>
                {current
                  ? `${current.name} — %${Math.floor(current.percent || 0)}`
                  : 'Hazırlanıyor…'}
              </span>
              <span>
                {current && current.speed ? `${current.speed.toFixed(1)}× hız` : ''}
                {current && current.eta != null ? ` • kalan ${formatTime(current.eta)}` : ''}
                {total > 1 ? ` • ${finished}/${total}` : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {converting ? (
        <button className="cancel-btn" onClick={onCancel}>İPTAL ET</button>
      ) : (
        <button className="convert-btn" disabled={convertible.length === 0} onClick={onConvert}>
          {convertible.length > 1 ? `TÜMÜNÜ DÖNÜŞTÜR (${convertible.length})` : 'DÖNÜŞTÜR ✨'}
        </button>
      )}
    </div>
  )
}
