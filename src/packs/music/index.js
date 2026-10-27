// Müzik paketi — prosedürel döngüler (OfflineAudioContext). Hepsi özgün; döngüye uygun (seamless: kuyruk başa katlanır).
import { register } from '../../engine/registry.js'
import a from './music-a.js'
import b from './music-b.js'

export const MUSIC_CATEGORIES = [
  { id: 'lofi', name: 'Lo-fi & Sakin' },
  { id: 'hiphop', name: 'Hip-Hop, Trap & Phonk' },
  { id: 'elektronik', name: 'Elektronik' },
  { id: 'oyun', name: 'Oyun & Chiptune' },
  { id: 'sinematik', name: 'Sinematik' },
  { id: 'gerilim', name: 'Gerilim & Korku' },
  { id: 'eglenceli', name: 'Eğlenceli' },
  { id: 'duygusal', name: 'Duygusal' },
  { id: 'vlog', name: 'Vlog & Neşeli' },
  { id: 'ambiyans', name: 'Ambiyans' },
]

export const MUSIC = [...a, ...b]
register('music', MUSIC, MUSIC_CATEGORIES)
