// Anahtar kelime → emoji sözlüğü (Türkçe + İngilizce) ve vurgu (emphasis) tespiti.
// Satır biçimi: "<G|-> <emoji> kelime kök* …"
//   G = oyun/aksiyon terimi (vurgu adayı), - = genel
//   "kök*" = Türkçe ekleri kabul eder (para* → paralar, parayı); yıldızsızlar yalnız tam eşleşir.
// En uzun kök kazanır: "öldürdüm" → öldür* (🔪), "öldüm" → öldü* değil tam eşleşme (💀).

const RAW = `
G 💀 öl öldüm öldü* ölüyorum ölüyoruz ölmek ölüm ölü geberdim gebert* dead died death rip skull rekt wasted
G 🔪 öldür* kesti* bıçakla* kill* killed kills frag
G 🏆 kazand* kazanmak kazanıyoruz kazanan galibiyet* zafer* şampiyon* kupa* win won wins winner victory champion* trophy mvp
G 🔥 ateş* alev* yanıyor yandı* efsane* muhteşem inanılmaz fire lit insane epic clutch
G 🎯 sniper* nişan* keskin hedef* headshot kafadan aim target isabet*
G 🔫 silah* tüfek* tabanca* mermi* şarjör* pompalı gun guns rifle pistol ammo shotgun shoot* ateşle*
G 💣 bomba* patla* dinamit* bomb bombs grenade c4 tnt explode* explosion
G 👑 kral* kraliçe* prens king queen kingdom
G 👹 boss* canavar* iblis* şeytan* monster* demon*
G 💰 para* altın* zengin* dolar* lira* euro avro money cash gold rich coin coins kredi*
G 🛡️ zırh* kalkan* savun* armor armour shield* defend* defense
G ⚔️ kılıç* savaş* dövüş* sword* fight* battle* war pvp
G 🧪 iksir* potion* zehir* poison*
G 🩸 kan kanlı kanama blood bleeding
G 🏃 kaçın kaçalım kaçıyorum kaçıyoruz kaçtık kaçtım koş* run running escape* runner
G 💥 vurdum vurdu* vuruş* darbe* çarp* kombo* hit boom crash combo critical kritik*
G 🗺️ harita* keşf* keşif map maps explore*
G 📦 sandık* ganimet* loot chest* crate*
G 🎁 hediye* ödül* gift* reward* prize sürpriz* surprise
G 🌟 efsanevi legendary epik nadir* rare mitik mythic
G 💎 elmas* mücevher* diamond* gem gems
G ⚡ hız* hızlı çabuk şimşek* elektrik* güç* speed fast quick lightning power
G 💪 güçlü kuvvet* kaslı strong strength muscle buff buffed op haydi hadi hadii
G 🧠 zeka* akıllı beyin* strateji* taktik* dahi brain smart genius strategy tactic*
G 🤡 noob nub çaylak* acemi* palyaço* clown bot
G 😎 havalı karizma* cool swag pro profesyonel* ez easy
G 🤝 gg ggwp wp takım* ekip* team* squad duo birlikte together
G 🎮 oyun* oyna* gamer game games gaming playstation xbox konsol* controller kontrolcü steam
G 🧟 zombi* zombie*
G 👻 hayalet* ghost*
G 🐉 ejderha* dragon*
G 👾 düşman* rakip* enemy enemies opponent* rival*
G ✨ büyü büyüler büyülü sihir* magic spell spells mana
G 🧙 büyücü* wizard mage
G 🏅 madalya* rütbe* rank* ranked elo medal* lig league
G 🥇 birinci first
G 🥈 ikinci
G 🥉 üçüncü third
G ⬆️ seviye* level* levelup upgrade* yükselt* atladık
G 🪤 tuzak* trap* pusu* ambush
G 🐛 bug glitch* hile* cheat* hacker hack*
G 🩹 iyileş* heal* şifa* medkit revive* dirilt*
G 🔄 respawn yeniden dirildim retry
G ⛏️ kazma* maden* pickaxe mining minecraft
G 🧱 blok* block* inşa* build* building
G 🏹 okçu* bow arrow* archer
G 🗡️ bıçak* hançer* knife dagger
G 🪓 balta* axe
G 🪖 asker* ordu* kask* soldier* army
G 🚁 helikopter* helicopter heli
G 🏁 yarış* finiş bitiş* race* racing finish
G 🚀 roket* rocket* uçuyor uçtu* fly flying launch* fırlat*
G 💯 yüzde kesinlikle aynen totally absolutely hundred
G 🚨 dikkat tehlike* alarm* uyarı* warning danger alert careful
G 🆘 yardım* imdat help sos
G 🎰 kumar* jackpot slot şanslı şans* luck lucky
G 🃏 kart* joker* card cards ace
G 📶 ping lag* gecikme* internet* wifi
G 😩 kaybett* kaybet* kayıp yenildik yenildim lose lost loss losing defeat* mağlubiyet*
G 🏟️ stadyum* arena* stadium lobi* lobby
G 🔴 canlı yayın* live stream* streamer
- 😂 komik güldüm gülmek haha* hahaha lol lmao funny kahkaha* espri*
- 😭 ağla* ağlıyorum üzgün* üzüldüm sad cry crying cried
- 😡 sinir* kızgın* öfke* angry mad rage tilt tilted
- 😱 korku* kork* korkunç scary scared horror creepy
- 🤯 şok şoke inanamıyorum shock* shocked mindblown wtf
- 😮 vay vayy vaay wow woah whoa oha ohaa ohaaa
- 👍 tamam güzel peki okay ok nice good
- 👏 bravo tebrik* aferin alkış* congrats congratulations clap
- 🎉 parti* kutla* yaşasın party celebrate* yay hooray
- 🙌 sonunda nihayet finally
- 👋 merhaba selam* görüşürüz görüşmek hoşçakal hello hi hey bye goodbye
- 🙏 lütfen teşekkür* sağol* thanks thank please
- 🔔 bildirim* zil notification* bell
- 👉 abone* takip* subscribe* follow* follower*
- ❌ hayır olmaz yanlış* hata* başarısız* no nope wrong fail* failed mistake*
- ✅ evet doğru başarı* tamamlandı yes yep yeah correct success* done
- ⏰ zaman* saat* süre acele* time timer hurry deadline
- ⏳ bekle* sabır* yükleniyor wait waiting loading patience
- 🍕 pizza* yemek* acıktım food hungry
- 🍔 burger* hamburger* döner kebap* lahmacun*
- ☕ kahve* çay coffee tea
- 🥤 kola içecek* soda drink drinks
- 🍫 çikolata* chocolate
- 🍬 şeker* candy sugar
- 🍎 elma* apple
- 🍺 bira biralar beer
- 🎂 pasta* doğumgünü cake birthday
- 🚗 araba* araç car cars drive driving
- ✈️ uçak* plane airplane
- ⚽ futbol* gol* maç* football soccer goal match
- 🏀 basketbol* basketball
- 🎵 müzik* şarkı* ritim* music song* beat beats
- 🎤 mikrofon* rap rapçi* mic sing singing singer
- 🎧 kulaklık* headphone* headset
- ⌨️ klavye* keyboard
- 📱 telefon* phone mobile
- 💻 bilgisayar* laptop computer pc
- 🖥️ ekran* monitör* screen monitor
- 📸 fotoğraf* kamera* photo* camera
- 🎬 video* film* sahne* montaj* kurgu* movie scene edit editing
- 🔒 kilit* locked lock
- 🔑 anahtar* key keys
- 🚪 kapı* door
- 🏠 ev evim eve evde home house
- 🏰 kale kalesi kaleyi castle
- 🏙️ şehir* city
- 🌍 dünya* world earth
- 🇹🇷 türkiye türk türkçe türkler
- 🌲 orman* ağaç* forest tree trees
- 🌊 deniz* okyanus* su water ocean sea
- 🏝️ ada adası island
- ❄️ kar karlı snow
- 🥶 soğuk* buz* dondu* donuyorum frozen cold ice freeze
- 🥵 sıcak* terledim hot sweat
- 🌧️ yağmur* fırtına* rain storm
- ☀️ güneş* sun sunny
- 🌙 gece* night moon
- 🌅 sabah* günaydın morning
- 💤 uyku* uykum uyuyorum uyudum yorgun* yoruldum afk sleep sleepy tired
- 🤫 sessiz* sus gizli* sır shh quiet secret
- 👀 bak bakın bakalım bakıyorum izle* look watch see
- 🤔 acaba düşün* belki merak* hmm think maybe wonder
- 🤞 umarım inşallah hopefully hope
- 💡 fikir* ipucu* idea tip tips hint
- ⚙️ ayar* ayarlar settings setting
- 🔧 tamir* fix repair
- 🔋 şarj* batarya* enerji* battery energy
- 🐌 yavaş* slow
- 🔊 ses sesi sesli loud volume sound
- 🙈 utandım utanç* ayıp cringe embarrassing
- 💸 harca* satın alışveriş* mağaza* market* spend buy bought shop shopping
- 🏦 banka* bank
- 👶 bebek* çocuk* baby kid kids
- 👴 dede* yaşlı old
- 💔 kırık ayrıl* heartbreak broken
- ❤️ kalp* sevgi* seviyorum sevdim aşk* canım love heart health hp
- 😍 bayıldım güzelmiş aşık* beautiful gorgeous
- 😘 öpücük* kiss
- 🤤 nefis lezzetli* delicious yummy tasty
- 😬 eyvah eyvahlar oops
- 😤 hırs* hırslı determined
- 🤪 çılgın* deli delirdim deliler crazy
- 🙄 sıkıcı sıkıldım boring bored
- 😏 kurnaz* sneaky
- 🫡 emredersin* salute
- 💩 kaka berbat rezalet* çöp* poop trash garbage
- 👌 mükemmel* süper perfect super
- 🤖 robot* yapay ai
- 👽 uzaylı* alien* ufo
- 🐐 goat keçi*
- 🐍 yılan* snake*
- 🐺 kurt kurdu kurtlar wolf
- 🦁 aslan* lion
- 🐶 köpek* dog dogs
- 🐱 kedi* cat cats
- 🕷️ örümcek* spider*
- 🐔 tavuk* chicken
- 🐮 inek* cow
- 🐷 domuz* pig
- 🐒 maymun* monkey
- 🐻 ayı ayıyı bear
- 🦊 tilki* fox
- 🦅 kartal* eagle
- 🐟 balık* fish
- 🦈 köpekbalığı* shark
- 🐸 kurbağa* frog
- 🦄 unicorn tekboynuz*
- 🎨 resim* boya* sanat* art paint
- 📚 ders* okul* kitap* school book books study
- 🎟️ bilet* ticket
- 🎄 yılbaşı* christmas
- 🎃 cadılar halloween balkabağı*
- 💃 dans* dance dancing
- ♟️ satranç* chess
- 🧩 bulmaca* puzzle*
- 🌀 ışınlan* portal* teleport*
- 🚓 polis* police cop cops
- 🏥 hastane* doktor* hospital doctor
- 💊 ilaç* pill pills
- 💬 yorum* mesaj* sohbet* comment* message* chat
- 📢 duyuru* announcement
- ❓ neden niye niçin why
- 🔝 zirve* best
- 📍 konum* location
- 🧭 pusula* compass
- 🍀 yonca* clover
`

const EXACT = new Map()   // kelime → { e, g }
const STEMS = []          // [{ k, e, g }] uzunluk azalan

function lower(s, lang) {
  return lang === 'en' ? s.toLowerCase() : s.toLocaleLowerCase('tr-TR')
}

for (const line of RAW.split('\n')) {
  const t = line.trim()
  if (!t) continue
  const [flag, e, ...words] = t.split(/\s+/)
  const g = flag === 'G'
  for (const w0 of words) {
    if (w0.endsWith('*')) STEMS.push({ k: lower(w0.slice(0, -1)), e, g })
    else if (!EXACT.has(lower(w0))) EXACT.set(lower(w0), { e, g })
  }
}
STEMS.sort((a, b) => b.k.length - a.k.length)

export const EMOJI_COUNT = EXACT.size + STEMS.length

// Noktalama ve tırnakları at, küçük harfe çevir; kesme işaretinden sonrası ek sayılır (İstanbul'a → istanbul)
export function normWord(word, lang = 'tr') {
  let s = lower(String(word || ''), lang)
  s = s.replace(/[’'`´].*$/u, '')
  return s.replace(/[^\p{L}\p{N}]+/gu, '')
}

function lookup(word, lang) {
  const n = normWord(word, lang)
  if (!n) return null
  const ex = EXACT.get(n)
  if (ex) return ex
  for (const st of STEMS) {
    if (n.length >= st.k.length && n.startsWith(st.k) && n.length - st.k.length <= 8) {
      // kısa köklerde (≤3 harf) yalnız birkaç harflik eke izin ver
      if (st.k.length <= 3 && n.length - st.k.length > 3) continue
      return st
    }
  }
  return null
}

// Kelimeye uygun emoji ya da null
export function autoEmoji(word, lang = 'tr') {
  const hit = lookup(word, lang)
  return hit ? hit.e : null
}

export function isGamingTerm(word, lang = 'tr') {
  const hit = lookup(word, lang)
  return !!(hit && hit.g)
}

// Vurgulanacak kelime mi? Sayılar, ünlemler, tamamı büyük harf kelimeler, oyun terimleri
export function isKeyword(word, lang = 'tr') {
  const w = String(word || '')
  if (/\d/.test(w)) return true
  if (/!/.test(w)) return true
  const letters = w.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 2 && letters === letters.toLocaleUpperCase('tr-TR') && letters !== letters.toLocaleLowerCase('tr-TR')) return true
  return isGamingTerm(w, lang)
}

// Bir ifade (kelime dizisi) için tek emoji: oyun terimlerine öncelik, sonra ilk eşleşme
export function phraseEmoji(words, lang = 'tr') {
  let first = null
  for (const w of words) {
    const hit = lookup(typeof w === 'string' ? w : w.w, lang)
    if (!hit) continue
    if (hit.g) return hit.e
    if (!first) first = hit.e
  }
  return first
}
