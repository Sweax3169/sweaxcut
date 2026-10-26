import React from 'react'

export default function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>{t.kind === 'err' ? '⚠️' : t.kind === 'ok' ? '✅' : '💡'}</span>
          <div>
            {t.text}
            {t.action && (
              <div style={{ marginTop: 4 }}>
                <button className="link-btn" onClick={t.action.onClick}>{t.action.label}</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
