// Piper ses kataloğu — yalnızca lisansı kullanıma/yeniden dağıtıma izin veren sesler (bkz. docs/licenses/audio.md).
// size/md5/sha256 indirme doğrulaması içindir. bundled: kurulumla gelir (vendor/piper/voices).

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'
const rh = (id, path, size, md5, extra) => ({ id, engine: 'piper', size, md5, url: HF + path, jsonUrl: HF + path + '.json', ...extra })

export const LANG_NAMES = {
  tr_TR: 'Türkçe', en_US: 'İngilizce (ABD)', en_GB: 'İngilizce (İngiltere)', de_DE: 'Almanca', fr_FR: 'Fransızca',
  es_ES: 'İspanyolca', es_MX: 'İspanyolca (Meksika)', ru_RU: 'Rusça', it_IT: 'İtalyanca', pt_BR: 'Portekizce (Brezilya)',
  nl_NL: 'Felemenkçe', pl_PL: 'Lehçe', uk_UA: 'Ukraynaca',
}

export const PIPER_VOICES = [
  // ---- Türkçe (Hugging Face'teki bütün Türkçe Piper sesleri)
  { id: 'tr_TR-fahrettin-medium', engine: 'piper', name: 'Fahrettin', lang: 'tr_TR', gender: 'erkek', quality: 'orta',
    size: 63201294, sha256: '39081c47270180e8a0dfac69b07bf329fb6d039fcc1279dbe26c2daf2848b190',
    url: 'https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/main/model.onnx',
    jsonUrl: 'https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/main/config.json',
    license: 'CC0 (veri kümesi: NabuCasa voice-datasets)', commercial: true, bundled: true },
  { id: 'tr_TR-fettah-medium', engine: 'piper', name: 'Fettah', lang: 'tr_TR', gender: 'erkek', quality: 'orta',
    size: 63201294, sha256: '5d14d5222f36aea2b8fc8dba097fcb18dcf8f5b33e5b2aa76b5e0b44602aa8d7',
    url: 'https://huggingface.co/speaches-ai/piper-tr_TR-fettah-medium/resolve/main/model.onnx',
    jsonUrl: 'https://huggingface.co/speaches-ai/piper-tr_TR-fettah-medium/resolve/main/config.json',
    license: 'CC0 (veri kümesi: NabuCasa voice-datasets)', commercial: true },
  rh('tr_TR-dfki-medium', 'tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx', 63201294, 'f51287b350a042dd8d67b2b215145e5a',
    { name: 'DFKI', lang: 'tr_TR', gender: 'erkek', quality: 'orta', license: 'CC BY-NC-SA 4.0 (veri) — yalnız ticari olmayan kullanım', commercial: false }),
  // ---- İngilizce
  rh('en_US-ljspeech-medium', 'en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx', 63531379, '109d552e9dd78d92d1169a7edd6de38d', { name: 'Linda', lang: 'en_US', gender: 'kadın', quality: 'orta', license: 'Kamu malı (LJ Speech)', commercial: true }),
  rh('en_US-kristin-medium', 'en/en_US/kristin/medium/en_US-kristin-medium.onnx', 63531379, '5fed42d2296baca042e2bf74785db725', { name: 'Kristin', lang: 'en_US', gender: 'kadın', quality: 'orta', license: 'Kamu malı (LibriVox)', commercial: true }),
  rh('en_US-bryce-medium', 'en/en_US/bryce/medium/en_US-bryce-medium.onnx', 63531379, 'a8482817c3bdc3d20121a0e31bfa9809', { name: 'Bryce', lang: 'en_US', gender: 'erkek', quality: 'orta', license: 'Kamu malı', commercial: true }),
  rh('en_US-norman-medium', 'en/en_US/norman/medium/en_US-norman-medium.onnx', 63531379, '829cea515dc724d694b83b71e8083f9f', { name: 'Norman', lang: 'en_US', gender: 'erkek', quality: 'orta', license: 'Kamu malı (LibriVox)', commercial: true }),
  rh('en_US-john-medium', 'en/en_US/john/medium/en_US-john-medium.onnx', 63531379, '70480857f21f2560f3a232722023b36d', { name: 'John', lang: 'en_US', gender: 'erkek', quality: 'orta', license: 'Kamu malı (LibriVox)', commercial: true }),
  rh('en_US-joe-medium', 'en/en_US/joe/medium/en_US-joe-medium.onnx', 63201294, '74fd6a4dc39e0aa9dce145d7f5acd4f6', { name: 'Joe', lang: 'en_US', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('en_GB-cori-medium', 'en/en_GB/cori/medium/en_GB-cori-medium.onnx', 63531379, 'f143307611eccea9d976235d0895f57c', { name: 'Cori', lang: 'en_GB', gender: 'kadın', quality: 'orta', license: 'Kamu malı (LibriVox)', commercial: true }),
  rh('en_GB-alba-medium', 'en/en_GB/alba/medium/en_GB-alba-medium.onnx', 63201294, 'c07f313752bb3aba8061041666251654', { name: 'Alba', lang: 'en_GB', gender: 'kadın', quality: 'orta', license: 'CC BY 4.0 (veri)', commercial: true }),
  // ---- diğer diller
  rh('de_DE-thorsten-medium', 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx', 63201294, 'a129b00fb3078df43c96bab6c94535c0', { name: 'Thorsten', lang: 'de_DE', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('fr_FR-siwis-medium', 'fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx', 63201294, '20e876e8c839e9b11a26085858f2300c', { name: 'Siwis', lang: 'fr_FR', gender: 'kadın', quality: 'orta', license: 'CC BY 4.0 (veri)', commercial: true }),
  rh('es_ES-davefx-medium', 'es/es_ES/davefx/medium/es_ES-davefx-medium.onnx', 63201294, 'dc515cd4ecc5f6f72fe14a941188fc9c', { name: 'Davefx', lang: 'es_ES', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('es_MX-claude-high', 'es/es_MX/claude/high/es_MX-claude-high.onnx', 63122309, 'cb1966e0ff20ca3aa010f6c9a0ce296a', { name: 'Claude', lang: 'es_MX', gender: 'erkek', quality: 'yüksek', license: 'Apache-2.0', commercial: true }),
  rh('ru_RU-denis-medium', 'ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx', 63201294, '76c2f14e521fef3ed574f97ad492728e', { name: 'Denis', lang: 'ru_RU', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('ru_RU-dmitri-medium', 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx', 63201294, '589ccc91745a1e2353508ff62c5941b7', { name: 'Dmitri', lang: 'ru_RU', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('it_IT-serena-medium', 'it/it_IT/serena/medium/it_IT-serena-medium.onnx', 63516051, 'f8c82f1139dfa382686bd7564a633400', { name: 'Serena', lang: 'it_IT', gender: 'kadın', quality: 'orta', license: 'CC BY 4.0 (veri)', commercial: true }),
  rh('pt_BR-faber-medium', 'pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx', 63201294, 'e0724a2f07965f6523d2a1e96b488a4c', { name: 'Faber', lang: 'pt_BR', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('nl_NL-pim-medium', 'nl/nl_NL/pim/medium/nl_NL-pim-medium.onnx', 63516050, '190b3e6463a931d3c583d2fa7cd0e4a0', { name: 'Pim', lang: 'nl_NL', gender: 'erkek', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('pl_PL-gosia-medium', 'pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx', 63201294, 'ecf817530e575025166e454adde1f382', { name: 'Gosia', lang: 'pl_PL', gender: 'kadın', quality: 'orta', license: 'CC0 (veri)', commercial: true }),
  rh('uk_UA-ukrainian_tts-medium', 'uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx', 76735663, '3366c3d4f31cb77966fb14d042956b4f', { name: 'Ukrayna (3 ses)', lang: 'uk_UA', gender: 'karışık', quality: 'orta', license: 'CC0 (veri)', commercial: true, speakers: 3 }),
]
