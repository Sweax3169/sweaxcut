// Kullanıcının kaydettiği altyazı stilleri: <userData>/caption-styles.json. Açılışta "Kaydettiklerim" kategorisine yüklenir.
import { register, unregister } from '../../engine/registry.js'
import { capEnv, hasFs } from './env.js'

export const USER_CATEGORY = { id: 'kayitli', name: 'Kaydettiklerim' }

function file() {
  const { path, userData } = capEnv()
  return path.join(userData, 'caption-styles.json')
}

export function readUserStyles() {
  if (!hasFs()) return []
  try {
    const list = JSON.parse(capEnv().fs.readFileSync(file(), 'utf8'))
    return Array.isArray(list) ? list.filter(s => s && s.id && s.text) : []
  } catch (e) { return [] }
}

function write(list) {
  if (!hasFs()) return
  const { fs } = capEnv()
  const tmp = file() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(list, null, 1))
  fs.renameSync(tmp, file())
}

export function loadUserStyles() {
  const list = readUserStyles()
  register('captionStyles', list.map(s => ({ ...s, category: USER_CATEGORY.id, user: true })), [USER_CATEGORY])
  return list.length
}

export function saveUserStyle(style) {
  const list = readUserStyles().filter(s => s.id !== style.id)
  const st = { ...style, category: USER_CATEGORY.id, user: true }
  list.unshift(st)
  write(list)
  register('captionStyles', [st], [USER_CATEGORY])
  return st
}

export function deleteUserStyle(id) {
  write(readUserStyles().filter(s => s.id !== id))
  unregister('captionStyles', id)
}
