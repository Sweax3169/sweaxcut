// Klavye kısayolları (CapCut / Premiere alışkanlıklarıyla uyumlu)
import { store } from '../core/store.js'
import { playback } from '../engine/playback.js'
import * as A from './actions.js'

export const SHORTCUTS = [
  ['Ctrl+K', 'Komut paleti: her araç ve efekt'],
  ['Boşluk', 'Oynat / duraklat'],
  ['Ctrl+B · S', 'Oynatma kafasında böl'],
  ['Q · W', 'Solu / sağı kırp (dalgalı)'],
  ['Delete', 'Sil'],
  ['Shift+Delete', 'Dalgalı sil (boşluğu kapat)'],
  ['Ctrl+Z · Ctrl+Y', 'Geri al · yinele'],
  ['Ctrl+C · X · V', 'Kopyala · kes · yapıştır'],
  ['Ctrl+D', 'Çoğalt'],
  ['Ctrl+A', 'Tümünü seç'],
  ['← →', 'Bir kare geri / ileri'],
  ['Shift+← →', '1 saniye geri / ileri'],
  ['Home · End', 'Başa / sona git'],
  ['↑ ↓', 'Önceki / sonraki kesime git'],
  ['J · K · L', 'Geri sar · dur · ileri sar'],
  ['Ctrl+ + / −', 'Zaman çizelgesi yakınlaştır / uzaklaştır'],
  ['Shift+Z', 'Zaman çizelgesini sığdır'],
  ['M', 'İşaret ekle'],
  ['T', 'Yazı ekle'],
  ['K (Alt)', 'Anahtar kare ekle'],
  ['[ · ]', 'Önceki / sonraki anahtar kare'],
  ['I · O', 'Aralık başı / sonu'],
  ['N', 'Yakalamayı aç/kapat'],
  ['Ctrl+S', 'Kaydet'],
  ['Ctrl+E', 'Dışa aktar'],
  ['Ctrl+I', 'Medya içe aktar'],
  ['F', 'Önizlemeyi tam ekran yap'],
]

function isTyping(e) {
  const t = e.target
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

let shuttle = 0
let shuttleTimer = 0
function runShuttle(dir) {
  shuttle = dir === 0 ? 0 : (Math.sign(dir) === Math.sign(shuttle) ? Math.max(-8, Math.min(8, shuttle * 2)) : dir)
  clearInterval(shuttleTimer)
  if (shuttle === 0) { playback.pause(); return }
  if (shuttle === 1) { playback.play(); return }
  playback.pause()
  let last = performance.now()
  shuttleTimer = setInterval(() => {
    const n = performance.now()
    playback.seek(playback.time + shuttle * (n - last) / 1000, { noSnap: true, scrub: true })
    last = n
  }, 33)
}

function cutPoints() {
  const pts = new Set([0])
  for (const t of store.get().project.tracks) for (const c of t.clips) { pts.add(+c.start.toFixed(4)); pts.add(+(c.start + c.duration).toFixed(4)) }
  return [...pts].sort((a, b) => a - b)
}

export function installShortcuts() {
  const down = (e) => {
    const s = store.get()
    // komut paleti her ekranda (yazı yazarken bile)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K') && !e.altKey) {
      e.preventDefault()
      if (s.ui.modal && s.ui.modal.type === 'command') store.closeModal(); else if (!s.ui.modal) store.openModal('command')
      return
    }
    if (s.ui.screen !== 'editor' || s.ui.modal) return
    if (isTyping(e)) return
    const k = e.key
    const ctrl = e.ctrlKey || e.metaKey
    const fps = s.project.settings.fps
    let handled = true
    if (k === ' ') { clearInterval(shuttleTimer); shuttle = 0; playback.toggle() }
    else if (ctrl && (k === 'z' || k === 'Z') && !e.shiftKey) { const l = store.undo(); if (l) store.toast('Geri alındı: ' + l, 'info', 1100) }
    else if (ctrl && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { const l = store.redo(); if (l) store.toast('Yinelendi: ' + l, 'info', 1100) }
    else if (ctrl && (k === 'b' || k === 'B')) A.split()
    else if (ctrl && (k === 'c' || k === 'C')) A.copy()
    else if (ctrl && (k === 'x' || k === 'X')) A.cut()
    else if (ctrl && (k === 'v' || k === 'V')) A.paste()
    else if (ctrl && (k === 'd' || k === 'D')) A.duplicate()
    else if (ctrl && (k === 'a' || k === 'A')) A.selectAll()
    else if (ctrl && (k === 's' || k === 'S')) A.saveProject(e.shiftKey)
    else if (ctrl && (k === 'e' || k === 'E')) store.openModal('export')
    else if (ctrl && (k === 'i' || k === 'I')) A.pickAndImport()
    else if (ctrl && (k === 'o' || k === 'O')) A.openProject()
    else if (ctrl && (k === '+' || k === '=')) store.setUI(u => ({ zoom: Math.min(800, u.zoom * 1.4) }))
    else if (ctrl && (k === '-' || k === '_')) store.setUI(u => ({ zoom: Math.max(2, u.zoom / 1.4) }))
    else if (ctrl) handled = false
    else if (k === 'Delete' || k === 'Backspace') A.deleteSelected(e.shiftKey)
    else if (k === 's' || k === 'S') { if (e.shiftKey) handled = false; else A.split() }
    else if (k === 'q' || k === 'Q') A.trimSide('left')
    else if (k === 'w' || k === 'W') A.trimSide('right')
    else if (k === 'ArrowLeft') { playback.pause(); playback.seek(playback.time - (e.shiftKey ? 1 : 1 / fps)) }
    else if (k === 'ArrowRight') { playback.pause(); playback.seek(playback.time + (e.shiftKey ? 1 : 1 / fps)) }
    else if (k === 'ArrowUp') { const t = playback.time; const p = cutPoints().reverse().find(x => x < t - 1e-3); if (p != null) playback.seek(p) }
    else if (k === 'ArrowDown') { const t = playback.time; const p = cutPoints().find(x => x > t + 1e-3); if (p != null) playback.seek(p) }
    else if (k === 'Home') playback.seek(0)
    else if (k === 'End') playback.seek(playback.duration())
    else if (k === 'j' || k === 'J') runShuttle(-1)
    else if (k === 'k' || k === 'K') { if (e.altKey) { const p = s.selection.clips[0]; if (p) A.toggleKey(p, 'transform.scale') } else runShuttle(0) }
    else if (k === 'l' || k === 'L') runShuttle(1)
    else if (k === 'm' || k === 'M') A.addMarker()
    else if (k === 't' || k === 'T') A.addText()
    else if (k === '[') A.jumpKey(-1)
    else if (k === ']') A.jumpKey(1)
    else if (k === 'i' || k === 'I') store.setUI({ rangeIn: playback.time })
    else if (k === 'o' || k === 'O') store.setUI({ rangeOut: playback.time })
    else if (k === 'n' || k === 'N') { store.setUI(u => ({ snap: !u.snap })); store.toast(store.get().ui.snap ? 'Yakalama açık' : 'Yakalama kapalı', 'info', 1000) }
    else if ((k === 'z' || k === 'Z') && e.shiftKey) window.dispatchEvent(new CustomEvent('sweax:fit-timeline'))
    else if (k === 'f' || k === 'F') window.dispatchEvent(new CustomEvent('sweax:fullscreen'))
    else if (k === 'Escape') { store.select([]); store.setUI({ rangeIn: null, rangeOut: null }) }
    else handled = false
    if (handled) { e.preventDefault(); e.stopPropagation() }
  }
  window.addEventListener('keydown', down)
  return () => window.removeEventListener('keydown', down)
}
