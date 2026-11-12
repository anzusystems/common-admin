# U8-L: názov poľa v prístupnom mene „vyplniť prázdne" a „nahradiť všade" (impl-komp-lib)

**Stav: cyklus 1 (U8-L-c1, len testy), CK zelená, čaká na posudok.** Kód bez nálezu (posudky Codex a Opus). **Znenie dvoch nových
textov čaká na potvrdenie vlastníka** (plán `:1053-1054` hovorí „všetky znenia schválené"; tieto dva kľúče nie).

Plán `plan-implementacie.md` 2.8 „U8-L" (`:1004-1009`), tabuľka textov (`:1065`); návrh komponentov 1.3 HO8, 4.1
(U8), 6.2 („Prvá sada, bod 7"). Strom LIB `/home/volar/projects/anzusystems/common-admin` (po 36-c1), TMPDIR
`common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.

## Podkroky

1. **Snímok `U8-L`** pred prvou úpravou.
2. **Texty** (`src/locales/{sk,en,cs}/common/damImage.json`, `asset.massOperations`): nové kľúče `fillOneEmptyField` a
   `replaceOneField` s `{field}` (znenia v registri 6.2); doterajšie `fillOneEmpty` a `replaceOne` ostávajú (bubliny,
   a hromadné operácie galérie).
3. **Kód:** `L/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue` (`:aria-label` oboch tlačidiel s
   `{ field: element.name }`, meno poľa ako ho ukazuje `ACustomDataFormElement`); `AssetQueueSelectedSidebar.vue`
   (štyri tlačidlá: kľúčové slová a autori; mená skladajú dve malé funkcie `fillEmptyName`, `replaceName` v skripte,
   pole je text z `common.damImage.asset.model.keywords` / `authors`). Bubliny (`VTooltip`) sa nemenia.
4. **Testy** (`LT0/consumerProfileUploadMassOperations.test.ts`, obe aplikácie): pomocník `onTheLine(line, field)`
   (pred krokom `:76-80`) hľadá tlačidlá podľa mena s poľom, `beside` a `besideList` dostanú názov poľa; nový prípad
   „names the two buttons beside each field by what they do and by the field" (všetky mená s poľom, a meno bez poľa
   už nemá žiadne tlačidlo; +2).
5. **Dôkaz** (v pamäti, snímok `U8-L`; súbor 22 prípadov): formulár so starým menom „vyplniť" → 4 / 22, „nahradiť" →
   4; meno s názvom iného poľa → 4; sidebar: kľúčové slová s menom autorov → 2, autori so starým menom → 2; oba
   komponenty zo snímku (`N39L_OLD`) → 7 / 22.
6. **Behy** (skript `u8l-check.sh`): cielené 113 súborov / 2 089 zelených (celý `L/`, `src/test` s kontrolou
   doslovných kľúčov v sk, en, cs, `src/plugins`); `oxfmt` (aj tri JSON), `oxlint`, `eslint` na troch súboroch čisté,
   `lint:tsc` 0. Prvý beh: `oxfmt` rozlámal výrazy mien v šablóne sidebaru na štyri riadky, preto idú cez dve funkcie.
7. **Register**: `navrh-komponenty.md` 6.2, odrážka „Prvá sada, bod 7" (doplnená).
8. **Záplata** `zaplata.sh U8-L` → `krok5-praca/zaplaty/U8-L.diff` (6 súborov v `src`; mimo `src` a `doc` nič), pred
   CK. **CK-LIB U8-L v LIB zelené** (`vysledky/U8-L-ck.log`): `test:browser` 308 / 4 153 (36-c1 + 2), `test:eslint`
   7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania.

## Zmenené súbory

- `src/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue`
- `src/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue`
- `src/locales/sk/common/damImage.json`, `src/locales/en/common/damImage.json`, `src/locales/cs/common/damImage.json`
- `src/domains/dam/__tests__/consumerProfileUploadMassOperations.test.ts`
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md` (6.2)

## Čo sa mení pre používateľa

Čítačka obrazovky pri dvoch ikonových tlačidlách vedľa poľa hromadných operácií fronty povie aj pole: „Vyplňte
prázdne pole: Kľúčové slová", „Nahradiť všade: Autori". Na obrazovke sa nemení nič (bubliny ostávajú krátke).
admin-cms a admin-ugc hneď, admin-dam po C3. Dva nové kľúče v troch jazykoch.

## Odchýlky

Znenie nových textov plán neuvádza („kľúče s `{field}`"): doterajší text tlačidla, dvojbodka, názov poľa (SK
„Vyplňte prázdne pole: {field}", „Nahradiť všade: {field}"; EN „Fill empty field: {field}", „Replace everywhere:
{field}"; CS „Vyplňte prázdné pole: {field}", „Nahradit všude: {field}"). **Čaká na potvrdenie vlastníka**; v registri
je označené „na potvrdenie vlastníkovi".

## Zblíženia navyše (tvar registra)

Žiadne.

## Nové nálezy

- **Hromadné operácie galérie** (`L/imageWidget/components/ImageMassOperations.vue:96,112,151,167,197,213`) majú tie
  isté dve ikonové tlačidlá pri popise, zdroji a autoroch s menom bez poľa. Plán U8-L ich nemenuje (len hromadné
  operácie fronty); nemenené.

## Cyklus 1 (U8-L-c1, 11. 10.; posudky Codex a Opus; len testy)

Snímok `U8-L-c1` (strom po PV14a). Produkčný kód sa nemení; mení sa len
`src/domains/dam/__tests__/consumerProfileUploadMassOperations.test.ts` (+7 prípadov, 22 → 29).

1. **Pole s menom iným než vlastnosť.** Podvrh konfigurácie dáva každému vlastnému poľu `name: property`
   (`__tests__/support/consumerProfiles.ts:54`), takže zámena `element.name` za `element.property` v
   `AssetCustomMetadataFormMassOperations.vue:73,89` nechala všetkých 22 prípadov zelených. Nový prípad „names the
   buttons of a custom field by the name it is shown under, and writes it under its property" (obe aplikácie): pole
   dostane v sklade konfigurácie meno „Shown to the user"; tlačidlá sa volajú podľa neho, žiadne podľa vlastnosti,
   a „nahradiť všade" zapíše hodnotu do riadku pod vlastnosťou.
2. **`{field}` v SK a CS.** Nový describe „the names of the two buttons beside a field of the mass operations" (tri
   prípady, ako pri 43): oba kľúče v sk, en a cs cez vue-i18n s poľom „Titulok".
3. **Bubliny.** „Bubliny ostávajú krátke" bol len komentár. Nový prípad „keeps the tooltips of those buttons short,
   without the field" (obe aplikácie): bublina každého tlačidla (otvorená ukazovateľom) má doterajší text bez poľa.

**Dôkaz** (v pamäti, snímok `U8-L-c1`; skript `u8lc1-check.sh`, súbor 29 prípadov): formulár s `element.property` v
mene „vyplniť" → 2 / 29, „nahradiť" → 2; bublina formulára s poľom („vyplniť" → 2, „nahradiť" → 2); bublina
kľúčových slov s poľom → 1, autorov → 1 (len admin-cms); SK bez `{field}` („vyplniť" → 1, „nahradiť" → 1); CS bez
`{field}` (1, 1); EN bez `{field}` → 7.
**Behy**: cielené 54 súborov / 1 284 zelených (`L/__tests__`, `L/uploadQueue`); `oxfmt`, `oxlint`, `eslint` na súbore
čisté, `lint:tsc` 0. Záplata `zaplaty/U8-L-c1.diff`. **CK-LIB U8-L-c1**: zelená, 309 súborov / 4 197 testov (`vysledky/U8-L-c1-ck.log`; PV14a + 7).
