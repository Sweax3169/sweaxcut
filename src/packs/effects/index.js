// Video efektleri paketi — import edildiğinde kendini kayıt defterine yazar
import { register } from '../../engine/registry.js'
import temel from './temel.js'
import glitch from './glitch.js'
import retro from './retro.js'
import isik from './isik.js'
import hareket from './hareket.js'
import parti from './parti.js'
import hava from './hava.js'
import sinematik from './sinematik.js'
import oyun from './oyun.js'
import cerceve from './cerceve.js'
import sanat from './sanat.js'

const GROUPS = [temel, glitch, retro, isik, hareket, parti, hava, sinematik, oyun, cerceve, sanat]

export const EFFECT_CATEGORIES = GROUPS.map(g => ({ id: g.id, name: g.name }))
export const EFFECTS = GROUPS.flatMap(g => g.items.map(it => ({ ...it, category: g.id })))

register('effects', EFFECTS, EFFECT_CATEGORIES)
