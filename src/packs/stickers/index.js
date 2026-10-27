// Çıkartma paketi — Twemoji emojileri + el yapımı animasyonlu vektör çıkartmalar
import { register } from '../../engine/registry.js'
import { STICKER_ANIMS } from '../../engine/sticker-render.js'
import { EMOJI_CATEGORIES, emojiList } from './emoji-data.js'
import social from './vec-social.js'
import arrows from './vec-arrows.js'
import comic from './vec-comic.js'
import gaming from './vec-gaming.js'
import reactions from './vec-reactions.js'
import ui from './vec-ui.js'

export const VECTOR_CATEGORIES = [
  { id: 'sosyal', name: 'Sosyal Medya' },
  { id: 'oyun', name: 'Oyun' },
  { id: 'tepki', name: 'Tepkiler' },
  { id: 'cizgi-roman', name: 'Çizgi Roman' },
  { id: 'balon', name: 'Konuşma Balonu' },
  { id: 'ok', name: 'Ok & İşaret' },
  { id: 'sekil', name: 'Şekiller' },
  { id: 'cerceve', name: 'Çerçeve & Kamera' },
  { id: 'alt-bant', name: 'Alt Bant & Etiket' },
  { id: 'ilerleme', name: 'İlerleme & Gösterge' },
]

const ANIM_PARAM = { key: 'anim', label: 'Animasyon', type: 'select', default: 'none', options: STICKER_ANIMS }

export const EMOJI_STICKERS = emojiList().map(e => ({
  id: 'emoji-' + e.code,
  name: e.name,
  category: e.category,
  kind: 'emoji',
  src: './stickers/emoji/' + e.code + '.svg',
  char: e.ch,
  aspect: 1,
  tags: ['emoji', ...e.name.toLocaleLowerCase('tr').split(/\s+/)],
  params: [ANIM_PARAM, { key: 'animSpeed', label: 'Animasyon hızı', type: 'range', min: 0.25, max: 3, step: 0.05, default: 1 }],
}))

export const VECTOR_STICKERS = [...social, ...gaming, ...reactions, ...comic, ...arrows, ...ui]

register('stickers', [...VECTOR_STICKERS, ...EMOJI_STICKERS], [...VECTOR_CATEGORIES, ...EMOJI_CATEGORIES])
