// Kelime zamanlaması tahmini: Piper kelime zamanı vermez → cümle sesindeki konuşma sınırları ve duraklamalar
// (enerji tabanlı) bulunur, kelimeler harf sayısıyla orantılı paylaştırılır, noktalama duraklamaları yakalanır.

// Türkçe dahil harf sayımı (rakamlar okununca uzar)
function weightOf(word) {
  const letters = (word.match(/\p{L}/gu) || []).length
  const digits = (word.match(/\d/g) || []).length
  return Math.max(1, letters + digits * 3.2)
}

export function splitSentences(text) {
  const t = String(text || '').replace(/\r/g, '').trim()
  if (!t) return []
  const out = []
  for (const para of t.split(/\n\s*\n|\n/)) {
    const p = para.trim()
    if (!p) continue
    // . ! ? … sonrası boşlukta böl (sayılardaki noktaları koru)
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) || [p]
    let buf = ''
    for (const s of parts) {
      buf += s
      if (/\d[.]$/.test(buf.trim()) && buf.trim().length < 6) continue // "1." gibi kısa sıra numaraları
      if (buf.trim()) out.push({ text: buf.trim(), paragraphEnd: false })
      buf = ''
    }
    if (buf.trim()) out.push({ text: buf.trim(), paragraphEnd: false })
    if (out.length) out[out.length - 1].paragraphEnd = true
  }
  return out
}

export function wordsOf(sentence) {
  return sentence.split(/\s+/).filter(w => /[\p{L}\d]/u.test(w))
}

// 10 ms RMS zarfı (dB)
function envDb(pcm, sr) {
  const hop = Math.max(1, Math.round(sr / 100))
  const n = Math.floor(pcm.length / hop)
  const e = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < hop; j++) { const v = pcm[i * hop + j]; s += v * v }
    e[i] = 10 * Math.log10(s / hop + 1e-12)
  }
  return e
}

// Bir cümlenin sesi (mono Float32) + metni → [{w, s, e}] (cümle başına göre saniye)
export function alignSentence(pcm, sr, sentence) {
  const words = wordsOf(sentence)
  const dur = pcm.length / sr
  if (!words.length) return { words: [], speechStart: 0, speechEnd: dur }
  const e = envDb(pcm, sr)
  let mx = -120
  for (const v of e) if (v > mx) mx = v
  const thr = Math.max(mx - 38, -60) // konuşma eşiği
  let a = 0, b = e.length - 1
  while (a < e.length && e[a] < thr) a++
  while (b > a && e[b] < thr) b--
  const s0 = a / 100, s1 = Math.min(dur, (b + 1) / 100)
  // iç duraklamalar (≥ 70 ms eşik altı)
  const pauses = []
  const pthr = Math.max(mx - 30, -55)
  let run = -1
  for (let i = a; i <= b; i++) {
    if (e[i] < pthr) { if (run < 0) run = i }
    else if (run >= 0) { if (i - run >= 7) pauses.push({ s: run / 100, e: i / 100 }); run = -1 }
  }
  const w = words.map(weightOf)
  const total = w.reduce((x, y) => x + y, 0)
  // noktalamalı kelime sonları = çapa adayları
  const anchors = [] // { idx (bu kelimeden sonra), time }
  let acc = 0
  const speech = Math.max(0.01, s1 - s0 - pauses.reduce((x, p) => x + (p.e - p.s), 0))
  for (let i = 0; i < words.length - 1; i++) {
    acc += w[i]
    if (/[,;:\-–—).!?…]$/.test(words[i])) anchors.push({ idx: i, frac: acc / total })
  }
  // her çapayı en yakın duraklamaya oturt (sırayı koruyarak)
  const used = new Set()
  const fixed = [] // { idx, end (kelime sonu), next (sonraki başlangıç) }
  for (const an of anchors) {
    const expect = s0 + an.frac * (s1 - s0)
    let best = -1, bd = Infinity
    pauses.forEach((p, k) => {
      if (used.has(k)) return
      const d = Math.abs((p.s + p.e) / 2 - expect)
      if (d < bd) { bd = d; best = k }
    })
    if (best >= 0 && bd < Math.max(0.35, (s1 - s0) * 0.25)) {
      const p = pauses[best]
      if (!fixed.length || p.s > fixed[fixed.length - 1].next) { used.add(best); fixed.push({ idx: an.idx, end: p.s, next: p.e }) }
    }
  }
  // çapalar arası bölgeleri orantılı doldur
  const out = []
  let segStartIdx = 0, segStartT = s0
  const bounds = [...fixed, { idx: words.length - 1, end: s1, next: s1 }]
  for (const bd of bounds) {
    const ws = w.slice(segStartIdx, bd.idx + 1)
    const sum = ws.reduce((x, y) => x + y, 0)
    let t = segStartT
    const span = Math.max(0.01, bd.end - segStartT)
    for (let k = segStartIdx; k <= bd.idx; k++) {
      const d = span * w[k] / sum
      out.push({ w: words[k], s: t, e: t + d })
      t += d
    }
    segStartIdx = bd.idx + 1
    segStartT = bd.next
  }
  void speech
  return { words: out, speechStart: s0, speechEnd: s1 }
}

// Tek parça metin + toplam süre: yalnız harf orantılı (sesi olmayan yedek)
export function estimateWords(text, duration, offset = 0) {
  const words = wordsOf(text)
  const w = words.map(weightOf)
  // noktalama duraklaması ağırlığı
  const pause = words.map(x => /[.!?…]$/.test(x) ? 4 : /[,;:]$/.test(x) ? 2 : 0)
  const total = w.reduce((a, b) => a + b, 0) + pause.reduce((a, b) => a + b, 0)
  const out = []
  let t = offset
  for (let i = 0; i < words.length; i++) {
    const d = duration * w[i] / Math.max(1, total)
    out.push({ w: words[i], s: t, e: t + d })
    t += d + duration * pause[i] / Math.max(1, total)
  }
  return out
}
