'use strict'

// SWEAXCUT preload — renderer'a güvenli köprü

const { contextBridge, ipcRenderer, webUtils } = require('electron')

function toFileUrl(p) {
  if (!p) return ''
  let s = String(p).replace(/\\/g, '/')
  if (!s.startsWith('/')) s = '/' + s
  return encodeURI('file://' + s).replace(/#/g, '%23').replace(/\?/g, '%3F')
}

const listeners = new Map()

function on(channel, cb) {
  const wrapped = (e, data) => cb(data)
  if (!listeners.has(channel)) listeners.set(channel, [])
  listeners.get(channel).push(wrapped)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
    const arr = listeners.get(channel) || []
    const i = arr.indexOf(wrapped)
    if (i >= 0) arr.splice(i, 1)
  }
}

contextBridge.exposeInMainWorld('sweaxcut', {
  appInfo: () => ipcRenderer.invoke('app:info'),
  chooseFiles: () => ipcRenderer.invoke('files:choose'),
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  chooseMusic: () => ipcRenderer.invoke('music:choose'),
  scanFolder: (dir) => ipcRenderer.invoke('folder:scan', dir),
  probe: (input) => ipcRenderer.invoke('probe', input),
  detectGpu: () => ipcRenderer.invoke('gpu:detect'),
  thumbnail: (input, time) => ipcRenderer.invoke('thumbnail', { input, time }),
  startQueue: (jobs, options) => ipcRenderer.invoke('queue:start', { jobs, options }),
  cancelQueue: () => ipcRenderer.invoke('queue:cancel'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  showInFolder: (p) => ipcRenderer.invoke('path:show', p),
  openFile: (p) => ipcRenderer.invoke('path:open', p),
  winControl: (action) => ipcRenderer.send('window:control', action),
  filePath: (file) => {
    try { return webUtils.getPathForFile(file) } catch (e) { return null }
  },
  toFileUrl,
  onOpenFiles: (cb) => on('files:open', cb),
  onJobProgress: (cb) => on('job:progress', cb),
  onJobState: (cb) => on('job:state', cb),
  onJobNote: (cb) => on('job:note', cb),
  onQueueFinished: (cb) => on('queue:finished', cb),
  onWindowState: (cb) => on('window:state', cb),
})
