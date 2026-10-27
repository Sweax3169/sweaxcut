// whisper-cli JSON (-ojf) çıktısını kelime zamanlı segmentlere çevirir. Saf JS — test edilebilir.
// Belirteçler (token) bayt düzeyinde birleştirilir: Türkçe ç/ğ/ı/ö/ş/ü bazen iki belirtece bölünür,
// metin kelime sınırında UTF-8 olarak çözülür ki harfler bozulmasın.

const SPECIAL_ID = 50257 // çok dilli sözlükte <|endoftext|> ve sonrası özel belirteç
const SPECIAL_RE = /^\[_[A-Z]+_?\d*\]$|^<\|.*\|>$/
// kelimeye sondan eklenen noktalama (ayrı belirteç olarak gelir)
const TRAIL_RE = /^[\s.,!?;:…)\]}»"'”’%‰·-]+$/u
// kelimenin önüne gelen işaretler
const LEAD_RE = /^[\s(\[{«"'“‘¿¡#@$₺€]+$/u
const OPEN_RE = /^[(\[{«"'“‘¿¡]+$/u

let _dec = null
function utf8(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    if (!_dec) _dec = new TextDecoder('utf-8', { fatal: false })
    return _dec.decode(bytes)
  }
  return Buffer.from(bytes).toString('utf8')
}

function latin1Bytes(s) {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}

function concat(chunks) {
  let n = 0
  for (const c of chunks) n += c.length
  const out = new Uint8Array(n)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

// whisper.cpp JSON'u ham UTF-8 yazar; yarım kalmış çok baytlı karakterler de olabilir.
// Bu yüzden baytları latin1 olarak (1 bayt = 1 karakter) ayrıştırıp metni sonra çözüyoruz.
export function parseJsonBytes(buf) {
  let s
  if (typeof buf === 'string') s = buf
  else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) s = buf.toString('latin1')
  else { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)) }
  if (s.charCodeAt(0) === 0xef && s.charCodeAt(1) === 0xbb && s.charCodeAt(2) === 0xbf) s = s.slice(3)
  return JSON.parse(s)
}

function isSpecial(tok) {
  return (tok.id != null && tok.id >= SPECIAL_ID) || SPECIAL_RE.test(tok.text || '')
}

// Belirteç dizisinden kelimeler. tokens: [{ text(latin1 baytları), offsets:{from,to} ms, p, t_dtw }]
// timing: 'tokens' (belirteç zaman damgaları) | 'dtw' (t_dtw varsa)
export function tokensToWords(tokens, { timing = 'tokens', dtwLag = DTW_LAG } = {}) {
  const words = []
  let cur = null
  let pendingLead = []
  const useDtw = timing === 'dtw' && tokens.some(t => t.t_dtw != null && t.t_dtw >= 0)
  const flush = () => {
    if (!cur) return
    const text = utf8(concat(cur.bytes)).replace(/\s+/g, ' ').trim()
    if (text) {
      const w = { w: text, s: cur.s, e: cur.e, p: cur.pn ? cur.p / cur.pn : 1 }
      if (useDtw && cur.dtw != null) w.dtw = cur.dtw
      words.push(w)
    }
    cur = null
  }
  for (const tok of tokens) {
    if (isSpecial(tok)) continue
    const raw = tok.text || ''
    if (!raw) continue
    const bytes = latin1Bytes(raw)
    const from = tok.offsets ? tok.offsets.from / 1000 : 0
    const to = tok.offsets ? tok.offsets.to / 1000 : from
    const dtw = tok.t_dtw != null && tok.t_dtw >= 0 ? tok.t_dtw / 100 : null
    // çözülebilen kısım noktalama mı? (yarım bayt dizileri harf sayılır)
    const asText = utf8(bytes)
    const spaceLed = bytes[0] === 0x20
    const core = asText.trim()
    const clean = !/�/.test(asText)
    // boşlukla gelen tek başına tire: diyalog işareti, at
    if (spaceLed && clean && /^[-–—]+$/.test(core)) continue
    if (spaceLed && clean && core && OPEN_RE.test(core)) {
      // açılış tırnağı / parantez: sonraki kelimeye yapışır
      flush()
      pendingLead.push(bytes.subarray(1))
      continue
    }
    if (clean && core && TRAIL_RE.test(core) && cur) {
      // nokta, virgül, ünlem, kesme işareti… önceki kelimeye yapışır; zamanı uzatmaz
      cur.bytes.push(spaceLed ? bytes.subarray(1) : bytes)
      continue
    }
    if (spaceLed && clean && core && LEAD_RE.test(core)) {
      flush()
      pendingLead.push(bytes.subarray(1))
      continue
    }
    if (spaceLed || !cur) {
      flush()
      cur = { bytes: [...pendingLead], s: from, e: to, p: 0, pn: 0, dtw }
      pendingLead = []
      cur.bytes.push(spaceLed ? bytes.subarray(1) : bytes)
    } else {
      cur.bytes.push(bytes)
      cur.e = Math.max(cur.e, to)
    }
    if (typeof tok.p === 'number') { cur.p += tok.p; cur.pn++ }
  }
  flush()
  if (useDtw) {
    // DTW zamanı kelimenin başlangıcıdır ama modele göre sistematik olarak 0,18–0,27 sn geç (models.js dtwLag)
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      if (w.dtw != null) {
        const dur = Math.max(0.1, w.e - w.s)
        w.s = Math.max(0, w.dtw - dtwLag)
        w.e = w.s + dur
      }
      delete w.dtw
    }
  }
  return words
}

export const DTW_LAG = 0.2

// Kelime zamanlarını düzelt: artan sıra, sıfır süre yok, çakışma yok
export function fixWordTimes(words, segStart, segEnd) {
  const n = words.length
  for (let i = 0; i < n; i++) {
    const w = words[i]
    if (!(w.s >= 0)) w.s = i ? words[i - 1].e : segStart
    if (segStart != null) w.s = Math.max(segStart, w.s)
    if (i && w.s < words[i - 1].s) w.s = words[i - 1].s
  }
  for (let i = 0; i < n; i++) {
    const w = words[i]
    const next = i + 1 < n ? words[i + 1].s : (segEnd != null ? segEnd : w.e)
    if (!(w.e > w.s)) w.e = Math.min(next, w.s + 0.25)
    if (w.e > next && next > w.s) w.e = next
    if (!(w.e > w.s)) w.e = w.s + 0.05
    w.s = round3(w.s)
    w.e = round3(w.e)
    if (w.p != null) w.p = Math.round(w.p * 1000) / 1000
  }
  return words
}

function round3(x) { return Math.round(x * 1000) / 1000 }

// Whisper'ın sessizlikte/müzikte uydurduğu bilinen kalıplar
const HALLUCINATIONS = [
  /altyaz[ıi]\s*(lar)?\s*m\.?\s*k\.?/i,
  /alt\s*yaz[ıi].{0,30}taraf[ıi]ndan/i,
  /amara\.org/i,
  /subtitles?\s+(by|made)/i,
  /(www\.|https?:\/\/)\S+/i,
  /^\s*[[(*♪♫].*[\])*♪♫]\s*$/u, // [Müzik], (alkış), ♪…♪
  /^\s*(müzik|music|alkış|applause|gülüşmeler|laughter)\.?\s*$/i,
]

export function isHallucination(text) {
  return HALLUCINATIONS.some(re => re.test(text))
}

// Tam JSON → { language, segments:[{ start, end, text, words:[{w,s,e,p}] }] }
// minProb: ortalama belirteç olasılığı bunun altındaki segment atılır (müzik/oyun sesinde uydurma metin ≈ 0,00–0,05; gerçek konuşma ≥ 0,5)
export function parseWhisperJson(buf, { timing = 'tokens', dtwLag = DTW_LAG, offset = 0, filter = true, minProb = 0.15 } = {}) {
  const j = typeof buf === 'object' && !(buf instanceof Uint8Array) && !(typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) ? buf : parseJsonBytes(buf)
  const language = (j.result && j.result.language) || (j.params && j.params.language) || null
  const segments = []
  let prevText = ''
  let repeat = 0
  for (const seg of j.transcription || []) {
    const start = seg.offsets ? seg.offsets.from / 1000 : 0
    const end = seg.offsets ? seg.offsets.to / 1000 : start
    let words
    if (seg.tokens && seg.tokens.length) {
      words = tokensToWords(seg.tokens, { timing, dtwLag })
    } else {
      // belirteç yoksa: segment metnini kelimelere eşit dağıt
      const text = utf8(latin1Bytes(seg.text || '')).trim()
      words = distributeWords(text, start, end)
    }
    fixWordTimes(words, start, end)
    const text = words.map(w => w.w).join(' ')
    if (!text) continue
    if (filter) {
      const avgP = words.reduce((a, w) => a + (w.p ?? 1), 0) / words.length
      if (isHallucination(text)) continue
      if (avgP < minProb) continue
      // aynı cümle art arda tekrar ediyorsa (müzikte döngü) ilkini tut
      if (text === prevText) { repeat++; if (repeat >= 1 && avgP < 0.6) continue; if (repeat >= 2) continue } else repeat = 0
      prevText = text
    }
    const o = offset || 0
    segments.push({
      start: round3(start + o),
      end: round3(end + o),
      text,
      words: words.map(w => ({ ...w, s: round3(w.s + o), e: round3(w.e + o) })),
    })
  }
  return { language, segments }
}

// Kelimeleri karakter uzunluğuna göre aralığa dağıt (kelime zamanı olmayan altyazılar için)
export function distributeWords(text, start, end) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!parts.length) return []
  const weights = parts.map(p => Math.max(1, p.replace(/[^\p{L}\p{N}]/gu, '').length) + 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0.01, end - start)
  const out = []
  let t = start
  for (let i = 0; i < parts.length; i++) {
    const d = span * weights[i] / total
    out.push({ w: parts[i], s: round3(t), e: round3(t + d) })
    t += d
  }
  return out
}
