// Geçiş paketi: gl-transitions koleksiyonu (MIT) + SWEAXCUT özel geçişleri
import { register } from '../../engine/registry.js'
import { GL_TRANSITIONS, GL_DROPPED } from './gl.js'
import { MOTION } from './custom-motion.js'
import { LIGHT } from './custom-light.js'
import { SHAPE } from './custom-shape.js'
import { ART } from './custom-art.js'

export const TRANSITION_CATEGORIES = [
  { id: 'temel', name: 'Temel' },
  { id: 'kaydir', name: 'Kaydırma' },
  { id: 'yakinlas', name: 'Yakınlaştırma' },
  { id: 'isik', name: 'Işık & Flaş' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'silme', name: 'Silme' },
  { id: 'sekil', name: 'Şekil' },
  { id: '3d', name: '3D' },
  { id: 'cozul', name: 'Çözülme' },
  { id: 'bozulma', name: 'Bozulma' },
  { id: 'sanat', name: 'Sanatsal' },
  { id: 'oyun', name: 'Oyun' },
]

export const CUSTOM_TRANSITIONS = [...MOTION, ...LIGHT, ...SHAPE, ...ART]
// Özel geçişler önce: kütüphanede ilk görünenler editörlerin en çok kullandıkları
export const TRANSITIONS = [...CUSTOM_TRANSITIONS, ...GL_TRANSITIONS]
export { GL_DROPPED }

register('transitions', TRANSITIONS, TRANSITION_CATEGORIES)
