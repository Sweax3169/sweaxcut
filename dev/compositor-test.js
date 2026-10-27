import * as model from '../src/core/model.js'
import { Compositor } from '../src/engine/compositor.js'
import { testPattern, fakeSources, testProject } from './testkit.js'
const img = testPattern()
const { p, c } = testProject(model, img)
c.adjust.saturation = 30
c.mask = { ...c.mask, type: 'heart', w: 0.8, h: 0.8, feather: 10 }
const t = model.createTextClip({ start: 0, duration: 5, text: { content: 'MERHABA ÇOCUKLAR', size: 110 } })
t.transform.y = -0.3
p.tracks.unshift(model.createTrack('text', { clips: [t] }))
const canvas = document.getElementById('c')
canvas.width = 540; canvas.height = 960
const comp = new Compositor(canvas, { preserve: true })
const st = comp.render({ project: p, time: 1, sources: fakeSources(img), scale: 0.5 })
window.__result = { stats: st, errors: [...comp.glw.errors.entries()] }
window.__done = true
