// Hız eğrisi hazırları — x: klip içi 0..1, y: hız çarpanı (yaklaşık 0.1..8)
// Noktalar arası motor yumuşak (smoothstep) geçiş yapar; uçlara 0 ve 1 noktası konur.
import { register } from '../../engine/registry.js'

const pts = (...a) => a.map(([x, y]) => ({ x, y }))

export const SPEED_CURVES = [
  // CapCut hazırları
  { id: 'montaj', name: 'Montaj', category: 'capcut', points: pts([0, 1], [0.12, 1], [0.24, 3.2], [0.36, 0.6], [0.5, 0.6], [0.64, 3.2], [0.78, 0.7], [0.9, 1.6], [1, 1.6]) },
  { id: 'kahraman', name: 'Kahraman', category: 'capcut', points: pts([0, 2.6], [0.28, 2.6], [0.42, 0.3], [0.58, 0.3], [0.72, 2.6], [1, 2.6]) },
  { id: 'kursun', name: 'Kurşun', category: 'capcut', points: pts([0, 3], [0.22, 3], [0.34, 0.2], [0.66, 0.2], [0.78, 3], [1, 3]) },
  { id: 'atlama', name: 'Atlama Kesimi', category: 'capcut', points: pts([0, 1], [0.28, 1], [0.34, 7], [0.4, 1], [0.6, 1], [0.66, 7], [0.72, 1], [1, 1]) },
  { id: 'flas-giris', name: 'Flaş Giriş', category: 'capcut', points: pts([0, 6], [0.25, 4], [0.45, 1.2], [0.7, 0.8], [1, 0.8]) },
  { id: 'flas-cikis', name: 'Flaş Çıkış', category: 'capcut', points: pts([0, 0.8], [0.3, 0.8], [0.55, 1.2], [0.75, 4], [1, 6]) },
  // SWEAXCUT hazırları
  { id: 'nefes', name: 'Nefes', category: 'ritim', points: pts([0, 1.55], [0.25, 0.45], [0.5, 1.55], [0.75, 0.45], [1, 1.55]) },
  { id: 'ritim', name: 'Ritim', category: 'ritim', points: pts([0, 2], [0.11, 2], [0.14, 0.5], [0.236, 0.5], [0.264, 2], [0.361, 2], [0.389, 0.5], [0.486, 0.5], [0.514, 2], [0.611, 2], [0.639, 0.5], [0.736, 0.5], [0.764, 2], [0.861, 2], [0.889, 0.5], [1, 0.5]) },
  { id: 'yavas-cekim-orta', name: 'Yavaş Çekim Ortası', category: 'sinematik', points: pts([0, 1], [0.3, 1], [0.42, 0.25], [0.58, 0.25], [0.7, 1], [1, 1]) },
  { id: 'rampa-yukari', name: 'Rampa Yukarı', category: 'rampa', points: pts([0, 0.3], [0.25, 0.45], [0.55, 1.2], [0.8, 3.2], [1, 5]) },
  { id: 'rampa-asagi', name: 'Rampa Aşağı', category: 'rampa', points: pts([0, 5], [0.2, 3.2], [0.45, 1.2], [0.75, 0.45], [1, 0.3]) },
  { id: 'dalga', name: 'Dalga', category: 'ritim', points: pts([0, 1], [0.0833, 2.4], [0.25, 0.42], [0.4167, 2.4], [0.5833, 0.42], [0.75, 2.4], [0.9167, 0.42], [1, 1]) },
  { id: 'darbe', name: 'Darbe', category: 'oyun', points: pts([0, 1], [0.44, 1], [0.48, 0.15], [0.56, 0.15], [0.6, 2.4], [0.7, 1], [1, 1]) },
  { id: 'sinematik-fren', name: 'Sinematik Fren', category: 'sinematik', points: pts([0, 3], [0.45, 3], [0.6, 0.6], [0.75, 0.25], [1, 0.25]) },
  { id: 'oyun-vurusu', name: 'Oyun Vuruşu', category: 'oyun', points: pts([0, 1.4], [0.35, 1.4], [0.42, 0.18], [0.55, 0.18], [0.62, 4], [0.75, 1.4], [1, 1.4]) },
  { id: 'patlama', name: 'Patlama', category: 'oyun', points: pts([0, 0.5], [0.4, 0.35], [0.55, 0.2], [0.62, 6], [0.8, 3], [1, 1.5]) },
  { id: 'kalp-atisi', name: 'Kalp Atışı', category: 'ritim', points: pts([0, 1], [0.12, 1], [0.17, 3], [0.22, 0.6], [0.27, 2.5], [0.33, 1], [0.62, 1], [0.67, 3], [0.72, 0.6], [0.77, 2.5], [0.83, 1], [1, 1]) },
  { id: 'zaman-bukulmesi', name: 'Zaman Bükülmesi', category: 'sinematik', points: pts([0, 1], [0.2, 0.3], [0.4, 3], [0.6, 0.3], [0.8, 3], [1, 1]) },
  { id: 'agir-final', name: 'Ağır Çekim Final', category: 'sinematik', points: pts([0, 1.6], [0.6, 1.6], [0.78, 0.3], [1, 0.2]) },
  { id: 'hizli-baslangic', name: 'Hızlı Başlangıç', category: 'rampa', points: pts([0, 8], [0.12, 4], [0.3, 1], [1, 1]) },
  { id: 'kill-cam', name: 'Kill-Cam', category: 'oyun', points: pts([0, 2], [0.3, 2], [0.45, 0.12], [0.75, 0.12], [0.85, 1], [1, 1]) },
  { id: 'drift', name: 'Drift', category: 'sinematik', points: pts([0, 2.2], [0.3, 0.7], [0.5, 0.45], [0.7, 0.7], [1, 2.2]) },
]

export const SPEED_CURVE_CATEGORIES = [
  { id: 'capcut', name: 'Klasik' },
  { id: 'sinematik', name: 'Sinematik' },
  { id: 'ritim', name: 'Ritim' },
  { id: 'rampa', name: 'Rampa' },
  { id: 'oyun', name: 'Oyun' },
]

register('speedCurves', SPEED_CURVES, SPEED_CURVE_CATEGORIES)
