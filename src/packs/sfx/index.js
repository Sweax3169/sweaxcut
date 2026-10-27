// Ses efekti paketi — tamamı OfflineAudioContext ile özgün sentez (örnek dosya yok)
import { register } from '../../engine/registry.js'
import a from './sfx-a.js'
import b from './sfx-b.js'

export const SFX_CATEGORIES = [
  { id: 'gecis', name: 'Geçiş' },
  { id: 'arayuz', name: 'Arayüz' },
  { id: 'oyun', name: 'Oyun' },
  { id: 'komik', name: 'Komik' },
  { id: 'darbe', name: 'Darbe & Patlama' },
  { id: 'sinematik', name: 'Sinematik' },
  { id: 'ortam', name: 'Ortam' },
  { id: 'muzikal', name: 'Müzikal' },
]

export const SFX = [...a, ...b]
register('sfx', SFX, SFX_CATEGORIES)
