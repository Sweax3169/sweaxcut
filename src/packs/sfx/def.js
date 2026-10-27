// Ses efekti tanım yardımcısı
import { mixer } from './dsp.js'

// mo: mixer seçenekleri (rev süresi vb.), fn(ctx, m, t0)
export const S = (id, name, category, duration, mo, fn, extra = {}) => ({
  id, name, category, duration, tags: extra.tags || [], ...extra,
  synth: (ctx, t0 = 0) => { const m = mixer(ctx, mo || {}); fn(ctx, m, t0 || 0) },
})
