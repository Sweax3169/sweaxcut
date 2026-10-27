// WOFF2 → cmap kod noktası kümesi (yazı tipi glif denetimi için, geliştirici aracı)
const zlib = require('zlib')

const TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

function base128(buf, o) {
  let v = 0
  for (let i = 0; i < 5; i++) {
    const b = buf[o.p++]
    v = (v * 128) + (b & 0x7f)
    if (!(b & 0x80)) return v
  }
  throw new Error('UIntBase128 bozuk')
}

function tables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('woff2 değil')
  const numTables = buf.readUInt16BE(12)
  const compLen = buf.readUInt32BE(20)
  const o = { p: 48 }
  const dir = []
  for (let i = 0; i < numTables; i++) {
    const flags = buf[o.p++]
    const ti = flags & 0x3f
    const tv = flags >> 6
    let tag
    if (ti === 63) { tag = buf.toString('latin1', o.p, o.p + 4); o.p += 4 } else tag = TAGS[ti]
    const orig = base128(buf, o)
    let len = orig
    const transformed = (tag === 'glyf' || tag === 'loca') ? tv !== 3 : tv !== 0
    if (transformed) len = base128(buf, o)
    dir.push({ tag, len })
  }
  const data = zlib.brotliDecompressSync(buf.subarray(o.p, o.p + compLen))
  const out = {}
  let off = 0
  for (const t of dir) { out[t.tag] = data.subarray(off, off + t.len); off += t.len }
  return out
}

// cmap → glifi olan kod noktası kümesi (format 4 ve 12)
function codepoints(cmap) {
  const set = new Set()
  const n = cmap.readUInt16BE(2)
  for (let i = 0; i < n; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8), eid = cmap.readUInt16BE(6 + i * 8)
    const off = cmap.readUInt32BE(8 + i * 8)
    if (!(pid === 3 && (eid === 1 || eid === 10)) && pid !== 0) continue
    const fmt = cmap.readUInt16BE(off)
    if (fmt === 4) {
      const segX2 = cmap.readUInt16BE(off + 6), seg = segX2 / 2
      const endO = off + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2
      for (let s = 0; s < seg; s++) {
        const end = cmap.readUInt16BE(endO + s * 2), start = cmap.readUInt16BE(startO + s * 2)
        const delta = cmap.readInt16BE(deltaO + s * 2), ro = cmap.readUInt16BE(rangeO + s * 2)
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g
          if (ro === 0) g = (c + delta) & 0xffff
          else {
            const a = rangeO + s * 2 + ro + (c - start) * 2
            g = a + 1 < cmap.length ? cmap.readUInt16BE(a) : 0
            if (g) g = (g + delta) & 0xffff
          }
          if (g) set.add(c)
        }
      }
    } else if (fmt === 12) {
      const groups = cmap.readUInt32BE(off + 12)
      for (let g = 0; g < groups; g++) {
        const a = off + 16 + g * 12
        const s = cmap.readUInt32BE(a), e = cmap.readUInt32BE(a + 4), sg = cmap.readUInt32BE(a + 8)
        for (let c = s; c <= e && c < 0x110000; c++) if (sg + (c - s)) set.add(c)
      }
    }
  }
  return set
}

function woff2Codepoints(buf) {
  const t = tables(buf)
  if (!t.cmap) throw new Error('cmap yok')
  return codepoints(t.cmap)
}

module.exports = { woff2Codepoints }
