// Ses değiştirici paketi — her öğe bir ffmpeg -af zinciri üretir; motor (src/engine/audio-process.js)
// sonucu önbelleğe yazar ve önizleme/dışa aktarma aynı dosyayı çalar.
// Kurallar: zincir SÜREYİ KORUR (perde için rubberband, asetrate kullanılırsa atempo ile telafi),
// 48 kHz'e döner; gecikme motor tarafından ölçülüp telafi edilir.

import { register } from '../../engine/registry.js'

const P = st => +Math.pow(2, st / 12).toFixed(5)            // yarım ton → oran
const num = (v, d) => (v == null || !isFinite(+v) ? d : +v)
const pitch = (st, formant = 'shifted') => `rubberband=pitch=${P(st)}:formant=${formant}:pitchq=quality:channels=together`
const echo = (delays, decays, inG = 0.8, outG = 0.88) => `aecho=${inG}:${outG}:${delays.join('|')}:${decays.join('|')}`
// ffmpeg 6.1 vibrato gecikme tamponunu sıfırlamadan ayırıyor → ilk ~5 ms çöp/NaN olabiliyor.
// Önüne 50 ms sessizlik ekle, ısınma bölgesini kes (süre ve hiza değişmez).
const vib = (f, d) => `adelay=delays=50:all=1,vibrato=f=${f}:d=${d},atrim=start=0.05,asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp`

// Ortak parametre tanımları
const pPerde = (def, min = -12, max = 12) => ({ key: 'perde', label: 'Perde (yarım ton)', type: 'range', min, max, step: 1, default: def })
const pYogunluk = (def = 70) => ({ key: 'yogunluk', label: 'Yoğunluk', type: 'range', min: 0, max: 100, step: 1, default: def })

const categories = [
  { id: 'karakter', name: 'Karakter' },
  { id: 'robot', name: 'Robot ve Dijital' },
  { id: 'mekan', name: 'Mekân' },
  { id: 'cihaz', name: 'Cihaz' },
  { id: 'modulasyon', name: 'Modülasyon' },
  { id: 'yayin', name: 'Yayın' },
]

const items = [
  // ------------------------------------------------------------ karakter
  { id: 'vfx-sincap', name: 'Sincap', category: 'karakter', tags: ['chipmunk', 'tiz', 'çizgi film'],
    params: [pPerde(9, 3, 12)],
    ffmpeg: p => `${pitch(num(p.perde, 9))},highpass=f=120` },
  { id: 'vfx-helyum', name: 'Helyum', category: 'karakter', tags: ['balon', 'gaz', 'tiz'],
    params: [pPerde(6, 2, 12)],
    ffmpeg: p => `${pitch(num(p.perde, 6))},highpass=f=200,equalizer=f=3200:t=q:w=1:g=3` },
  { id: 'vfx-bebek', name: 'Bebek', category: 'karakter', tags: ['çocuk', 'minik'],
    ffmpeg: () => `${pitch(5)},equalizer=f=2600:t=q:w=1.2:g=4,lowpass=f=9500` },
  { id: 'vfx-cuce', name: 'Cüce', category: 'karakter', tags: ['küçük', 'komik'],
    ffmpeg: () => `${pitch(3)},equalizer=f=1800:t=q:w=1:g=3` },
  { id: 'vfx-dev', name: 'Dev', category: 'karakter', tags: ['kalın', 'büyük', 'giant'],
    params: [pPerde(-7, -12, -2)],
    ffmpeg: p => `${pitch(num(p.perde, -7))},equalizer=f=120:t=q:w=1:g=4,${echo([40, 70], [0.25, 0.18], 0.8, 0.7)}` },
  { id: 'vfx-canavar', name: 'Canavar', category: 'karakter', tags: ['monster', 'korku', 'hırıltı'],
    ffmpeg: () => `${pitch(-9)},equalizer=f=100:t=q:w=1:g=6,acrusher=bits=10:mix=0.25:mode=log:aa=1,${echo([25], [0.3], 0.8, 0.7)},volume=1.2` },
  { id: 'vfx-seytan', name: 'Şeytan', category: 'karakter', tags: ['demon', 'korku', 'karanlık'],
    ffmpeg: () => `${pitch(-8)},afreqshift=shift=-60,${echo([30, 55], [0.4, 0.3], 0.8, 0.75)},equalizer=f=80:t=q:w=1:g=5,acompressor=threshold=-18dB:ratio=4:makeup=2` },
  { id: 'vfx-ince', name: 'İnce ses', category: 'karakter', tags: ['kadın', 'tiz', 'doğal'],
    params: [pPerde(4, 1, 9)],
    ffmpeg: p => pitch(num(p.perde, 4), 'preserved') },
  { id: 'vfx-kalin', name: 'Kalın ses', category: 'karakter', tags: ['erkek', 'bas', 'doğal'],
    params: [pPerde(-4, -9, -1)],
    ffmpeg: p => pitch(num(p.perde, -4), 'preserved') },
  { id: 'vfx-yavas-agir', name: 'Yavaş ağır', category: 'karakter', tags: ['ağır çekim', 'kalın', 'slow'],
    ffmpeg: () => `${pitch(-5)},lowpass=f=5000,${echo([60], [0.25], 0.8, 0.6)}` },
  { id: 'vfx-uzayli', name: 'Uzaylı', category: 'karakter', tags: ['alien', 'uzay'],
    ffmpeg: () => `${pitch(4, 'preserved')},${vib(9, 0.35)},aphaser=type=t:speed=0.8:decay=0.6,afreqshift=shift=120` },
  { id: 'vfx-hayalet', name: 'Hayalet', category: 'karakter', tags: ['ghost', 'korku', 'ürkütücü'],
    // ters yankı: yankı kelimeden ÖNCE kabarır
    ffmpeg: () => `areverse,${echo([120, 260, 400], [0.4, 0.3, 0.2])},areverse,${pitch(-2, 'preserved')},flanger=delay=5:depth=6:speed=0.2:regen=30,highpass=f=300` },
  { id: 'vfx-fisilti', name: 'Fısıltı', category: 'karakter', tags: ['whisper', 'gizli'],
    ffmpeg: () => `afftfilt=real='hypot(re,im)*cos((random(0)*2-1)*2*3.14)':imag='hypot(re,im)*sin((random(1)*2-1)*2*3.14)':win_size=512:overlap=0.75,highpass=f=400,volume=1.6` },

  // ------------------------------------------------------------ robot
  { id: 'vfx-robot', name: 'Robot', category: 'robot', tags: ['makine', 'tekdüze'],
    ffmpeg: () => `afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,${echo([7], [0.4], 0.8, 0.85)},volume=2.6` },
  { id: 'vfx-android', name: 'Android', category: 'robot', tags: ['yapay zekâ', 'metal'],
    ffmpeg: () => `${pitch(2)},${echo([8, 13], [0.5, 0.4], 0.8, 0.9)},tremolo=f=35:d=0.4,highpass=f=150` },
  { id: 'vfx-uzay-robotu', name: 'Uzay robotu', category: 'robot', tags: ['dalek', 'halka modülasyon'],
    ffmpeg: () => `tremolo=f=30:d=1,highpass=f=200,${echo([5], [0.5], 0.8, 0.9)},volume=1.4` },
  { id: 'vfx-elektronik', name: 'Elektronik', category: 'robot', tags: ['synth', 'vocoder'],
    ffmpeg: () => `${echo([5, 10], [0.6, 0.5], 0.8, 0.85)},flanger=delay=1:depth=2:regen=60:speed=4,highpass=f=200,acompressor=threshold=-20dB:ratio=6:makeup=2` },
  { id: 'vfx-8bit', name: '8-bit', category: 'robot', tags: ['retro', 'oyun', 'chiptune'],
    params: [{ key: 'bit', label: 'Bit', type: 'range', min: 3, max: 10, step: 1, default: 6 }],
    ffmpeg: p => `acrusher=bits=${num(p.bit, 6)}:mode=lin:aa=0:samples=6:mix=1,lowpass=f=7000,volume=0.9` },
  { id: 'vfx-bozuk-hoparlor', name: 'Bozuk hoparlör', category: 'robot', tags: ['cızırtı', 'distorsiyon'],
    ffmpeg: () => `highpass=f=700,lowpass=f=3500,volume=3,asoftclip=type=hard:threshold=0.3,acrusher=bits=6:mix=0.4,tremolo=f=12:d=0.25,volume=0.8` },

  // ------------------------------------------------------------ mekân
  { id: 'vfx-yanki', name: 'Yankı', category: 'mekan', tags: ['echo', 'tekrar'],
    params: [
      { key: 'gecikme', label: 'Gecikme (ms)', type: 'range', min: 80, max: 900, step: 10, default: 280 },
      { key: 'geri', label: 'Geri besleme', type: 'range', min: 10, max: 80, step: 1, default: 45 },
    ],
    ffmpeg: p => { const d = num(p.gecikme, 280), g = num(p.geri, 45) / 100; return echo([d, d * 2], [g, +(g * g).toFixed(3)], 0.8, 0.85) } },
  { id: 'vfx-magara', name: 'Mağara', category: 'mekan', tags: ['cave', 'derin'],
    ffmpeg: () => `${echo([150, 330, 520, 760], [0.5, 0.35, 0.25, 0.15], 0.8, 0.9)},lowpass=f=6000` },
  { id: 'vfx-stadyum', name: 'Stadyum', category: 'mekan', tags: ['arena', 'açık hava'],
    ffmpeg: () => `${echo([400, 800, 1200], [0.35, 0.22, 0.12], 0.8, 0.9)},highpass=f=120,equalizer=f=2000:t=q:w=1:g=2` },
  { id: 'vfx-konser', name: 'Konser salonu', category: 'mekan', tags: ['reverb', 'salon', 'hall'],
    ffmpeg: () => echo([47, 79, 113, 167, 229, 311, 419], [0.35, 0.3, 0.26, 0.21, 0.17, 0.12, 0.08], 0.8, 0.9) },
  { id: 'vfx-banyo', name: 'Banyo', category: 'mekan', tags: ['fayans', 'küçük oda'],
    ffmpeg: () => `${echo([23, 37, 51], [0.4, 0.3, 0.2], 0.8, 0.8)},equalizer=f=1200:t=q:w=1:g=2` },
  { id: 'vfx-su-alti', name: 'Su altı', category: 'mekan', tags: ['underwater', 'boğuk'],
    ffmpeg: () => `lowpass=f=500,aphaser=in_gain=0.6:out_gain=0.9:delay=4:decay=0.5:speed=0.5,${vib(1.5, 0.15)},volume=1.5` },
  { id: 'vfx-eko-patlamasi', name: 'Eko patlaması', category: 'mekan', tags: ['çoklu yankı', 'drop'],
    ffmpeg: () => echo([120, 240, 360, 480, 600, 720], [0.6, 0.5, 0.4, 0.3, 0.2, 0.1], 0.7, 0.8) },

  // ------------------------------------------------------------ cihaz
  { id: 'vfx-telefon', name: 'Telefon', category: 'cihaz', tags: ['ahize', 'hat'],
    ffmpeg: () => 'highpass=f=300,lowpass=f=3400,acompressor=threshold=-20dB:ratio=4:makeup=2,acrusher=bits=12:mix=0.15' },
  { id: 'vfx-telsiz', name: 'Telsiz', category: 'cihaz', tags: ['walkie talkie', 'asker', 'polis'],
    ffmpeg: () => 'highpass=f=500,lowpass=f=2800,acompressor=threshold=-25dB:ratio=8:makeup=3,acrusher=bits=8:mix=0.25:mode=log,asoftclip=type=hard:threshold=0.7' },
  { id: 'vfx-radyo', name: 'Radyo', category: 'cihaz', tags: ['eski radyo', 'AM'],
    ffmpeg: () => 'highpass=f=200,lowpass=f=4500,equalizer=f=1000:t=q:w=1:g=5,acompressor=threshold=-18dB:ratio=3:makeup=1.5' },
  { id: 'vfx-megafon', name: 'Megafon', category: 'cihaz', tags: ['hoparlör', 'anons'],
    ffmpeg: () => 'highpass=f=500,lowpass=f=4000,acrusher=bits=8:mix=0.3:mode=log,volume=1.6,asoftclip=type=tanh' },
  { id: 'vfx-plak', name: 'Eski plak', category: 'cihaz', tags: ['gramofon', 'nostalji'],
    ffmpeg: () => `highpass=f=300,lowpass=f=3500,acrusher=bits=10:mix=0.1,${vib(0.7, 0.05)},equalizer=f=1500:t=q:w=1:g=4` },

  // ------------------------------------------------------------ modülasyon
  { id: 'vfx-titrek', name: 'Titrek', category: 'modulasyon', tags: ['vibrato', 'titreşim'],
    params: [{ key: 'hiz', label: 'Hız (Hz)', type: 'range', min: 1, max: 14, step: 0.5, default: 6 }, pYogunluk(50)],
    ffmpeg: p => vib(num(p.hiz, 6), (num(p.yogunluk, 50) / 100).toFixed(2)) },
  { id: 'vfx-tremolo', name: 'Tremolo', category: 'modulasyon', tags: ['dalgalanma', 'ses seviyesi'],
    params: [{ key: 'hiz', label: 'Hız (Hz)', type: 'range', min: 1, max: 20, step: 0.5, default: 6 }, pYogunluk(70)],
    ffmpeg: p => `tremolo=f=${num(p.hiz, 6)}:d=${(num(p.yogunluk, 70) / 100).toFixed(2)}` },
  { id: 'vfx-koro', name: 'Koro', category: 'modulasyon', tags: ['chorus', 'çok ses'],
    ffmpeg: () => 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3' },
  { id: 'vfx-flanger', name: 'Flanger', category: 'modulasyon', tags: ['jet', 'süpürme'],
    ffmpeg: () => 'flanger=delay=2:depth=4:regen=40:width=70:speed=0.6' },
  { id: 'vfx-faz', name: 'Faz kaydırıcı', category: 'modulasyon', tags: ['phaser', 'psikedelik'],
    ffmpeg: () => 'aphaser=type=t:speed=0.6:decay=0.6' },
  { id: 'vfx-ruya', name: 'Rüya', category: 'modulasyon', tags: ['dreamy', 'yumuşak'],
    ffmpeg: () => `chorus=0.6:0.9:55|70:0.35|0.3:0.3|0.25:1.5|1.8,${echo([180, 360], [0.3, 0.15])},lowpass=f=7000` },

  // ------------------------------------------------------------ yayın
  { id: 'vfx-spiker', name: 'Spiker', category: 'yayin', tags: ['sunucu', 'radyo sesi', 'announcer'],
    ffmpeg: () => 'highpass=f=80,equalizer=f=180:t=q:w=1:g=3,equalizer=f=3500:t=q:w=1.2:g=4,acompressor=threshold=-21dB:ratio=4:attack=5:release=80:makeup=3,alimiter=limit=0.95:level=false:latency=true' },
  { id: 'vfx-podcast', name: 'Podcast', category: 'yayin', tags: ['net ses', 'mikrofon'],
    ffmpeg: () => 'highpass=f=90,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=4000:t=q:w=1:g=3,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,deesser' },
  { id: 'vfx-sicak', name: 'Sıcak ses', category: 'yayin', tags: ['radyo DJ', 'bas'],
    ffmpeg: () => 'highpass=f=70,equalizer=f=150:t=q:w=1.2:g=4,equalizer=f=6000:t=q:w=1:g=-2,acompressor=threshold=-22dB:ratio=3:makeup=2' },
]

register('voiceFx', items, categories)

export default items
