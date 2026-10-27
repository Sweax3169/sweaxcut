import React from 'react'
import { formatTime, formatBytes } from '../util.js'

const STATE_LABELS = {
  loading: 'Okunuyor…',
  ready: 'Hazır',
  queued: 'Sırada',
  processing: 'Dönüşüyor',
  done: 'Bitti',
  error: 'Hata',
  cancelled: 'İptal',
}

function chipClass(state) {
  if (state === 'processing' || state === 'queued') return 'processing'
  if (state === 'done') return 'done'
  if (state === 'error') return 'error'
  if (state === 'cancelled') return 'cancelled'
  return 'ready'
}

export default function QueuePanel({ files, selectedId, onSelect, onRemove, onChooseFiles, onAddFolder, onShowOutput, dragOver, converting }) {
  return (
    <div className="panel left-panel">
      <div className="panel-title">
        Kuyruk
        {files.length > 0 && <span className="count">{files.length}</span>}
      </div>
      <div className={`dropzone ${dragOver ? 'drag' : ''}`} onClick={onChooseFiles}>
        <div className="dz-icon">🎬</div>
        <div className="dz-main">Videoyu buraya sürükle</div>
        <div className="dz-sub">ya da tıklayıp seç — mp4, mov, mkv…</div>
      </div>
      <button className="add-folder-btn" onClick={onAddFolder}>📁 Klasör ekle (toplu dönüştürme)</button>
      <div className="queue-list">
        {files.length === 0 && (
          <div className="queue-empty">
            Henüz video yok.<br />
            Oyun kaydını sürükleyip bırak,<br />gerisini SWEAXCUT halleder ✨
          </div>
        )}
        {files.map(f => (
          <div
            key={f.id}
            className={`qitem ${selectedId === f.id ? 'selected' : ''}`}
            onClick={() => onSelect(f.id)}
            title={f.path}
          >
            {f.thumb
              ? <img className="thumb" src={f.thumb} alt="" />
              : <div className="thumb placeholder">🎞️</div>}
            <div className="qinfo">
              <div className="qname">{f.name}</div>
              <div className="qmeta">
                <span className={`status-chip ${chipClass(f.state)}`}>{STATE_LABELS[f.state] || f.state}</span>
                {f.meta && <span>{f.meta.width}×{f.meta.height}</span>}
                {f.meta && f.meta.duration > 0 && <span>{formatTime(f.meta.duration)}</span>}
                {f.meta && f.meta.sizeBytes > 0 && <span>{formatBytes(f.meta.sizeBytes)}</span>}
              </div>
              {(f.state === 'processing') && (
                <div className="qprogress"><div style={{ width: `${f.percent || 0}%` }} /></div>
              )}
              {f.state === 'done' && f.output && (
                <div>
                  <button
                    className="link-btn"
                    style={{ fontSize: 10.5 }}
                    onClick={e => { e.stopPropagation(); onShowOutput(f.output) }}
                  >Klasörde göster</button>
                </div>
              )}
              {f.state === 'error' && f.message && (
                <div style={{ fontSize: 10.5, color: 'var(--err)', lineHeight: 1.4 }}>{f.message}</div>
              )}
            </div>
            {!converting && (
              <button className="qremove" title="Kaldır" onClick={e => { e.stopPropagation(); onRemove(f.id) }}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
