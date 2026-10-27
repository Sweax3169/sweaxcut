// Renk filtreleri paketi — import edildiğinde kendini kayıt defterine yazar
import { register } from '../../engine/registry.js'
import portre from './portre.js'
import sinema from './sinema.js'
import canli from './canli.js'
import retro from './retro.js'
import doga from './doga.js'
import siyahBeyaz from './siyah-beyaz.js'
import oyun from './oyun.js'
import mood from './mood.js'

const GROUPS = [portre, sinema, canli, retro, doga, siyahBeyaz, oyun, mood]

export const FILTER_CATEGORIES = GROUPS.map(g => ({ id: g.id, name: g.name }))
export const FILTERS = GROUPS.flatMap(g => g.items.map(it => ({ ...it, category: g.id })))

register('filters', FILTERS, FILTER_CATEGORIES)
