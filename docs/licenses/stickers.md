# Çıkartma paketi — üçüncü parti varlıklar

## Twemoji (emoji görselleri) — CC-BY 4.0
- Kaynak: jdecked/twemoji (Twitter Twemoji'nin bakımlı çatalı), npm paketi `@twemoji/svg@15.0.0`
  (optimize edilmiş SVG'ler, paket lisansı MIT; grafiklerin lisansı CC-BY 4.0).
- Kopyalanan dosyalar: `public/stickers/emoji/*.svg` (649 emoji). Kopyalama betiği: `src/packs/stickers/copy-emoji.mjs`.
- Atıf (uygulamanın Hakkında / Lisanslar ekranında gösterilmeli):
  > Emoji grafikleri: Twemoji — Copyright 2019 Twitter, Inc ve diğer katkıcılar; jdecked/twemoji.
  > Lisans: CC-BY 4.0 — https://creativecommons.org/licenses/by/4.0/
- Değişiklik yapılmadı (dosyalar olduğu gibi kopyalandı, yalnızca dosya adları Twemoji kodlarıdır).

## Material Icons (bazı simge yolları) — Apache-2.0
- `src/packs/stickers/vdef.js` içindeki `thumb`, `bell`, `reply`, `eye`, `person` SVG yol verileri Google Material Icons'tan
  (https://github.com/google/material-design-icons, Apache License 2.0).

## Vektör animasyonlu çıkartmalar
- `src/packs/stickers/vec-*.js` içindeki bütün çizimler bu proje için elle kodlandı (özgün), ek lisans gerekmez.
- Yazı tipleri: çizimler önce uygulamanın kayıtlı yazı tiplerini (Anton, Archivo, Archivo Black, JetBrains Mono, Bangers)
  sonra sistem yazı tiplerini (Impact, Arial Black, Segoe UI, Consolas) dener; çıkartma paketi yazı tipi dosyası içermez.
