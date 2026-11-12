# F-C s F-D (nález 49): „Uložiť" detailu a autori DAM vo widgete pri assete, ktorého súbor sa ešte spracúva (impl-komp-lib)

**Stav: uzavretý 11. 10.** (vedúci; Codex k FC-47-c1 bez nálezu v kóde). CK zelená.

Plán `plan-implementacie.md` 2.9 riadok „F-C s F-D (nález 49)" (`:1098`); návrh komponentov 4.5 (`:1256-1257`), 6.2
(text F-C); `analyzy/nalez49-frontend.md` 5 a 7. Strom LIB `/home/volar/projects/anzusystems/common-admin` (po 45),
TMPDIR `common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.

## Podkroky

1. **Snímok `F-C`** pred prvou úpravou.
2. **Pravidlo** (nový, nevyvezený `L/assetDetail/utils/assetMetadataMayStillChange.ts`): asset nie je popísaný, má
   hlavný súbor a ten je `uploading`, `uploaded` alebo `stored` (analýza 7.1).
3. **F-C** (`L/assetDetail/components/AssetDetailSidebarMetadata.vue`): `saveBlocked`; „Uložiť" `:disabled`, `onSave`
   sa pri ňom vráti; veta `common.damImage.queueItem.stillUploadingOrProcessing` nad formulárom
   (`data-cy="save-blocked"`, v obsahu sidebaru, nie v teleportovanej lište akcií s pevnou výškou: poučenie z F-B).
4. **F-D** (`ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, výber assetu bez autorov): pole autorov DAM sa zapne,
   len keď ext systém autorov má **a** asset nie je rizikový; `asset` detailu sa vtedy nenastaví, potvrdenie dialógu
   obrázka teda `updateAssetAuthors` nezavolá.
5. **Testy:**
   - `L/assetDetail/__tests__/assetDetailDialog.test.ts`, describe „of an asset whose file the server has not processed
     yet" (obe aplikácie, +16): tri stavy → „Uložiť" vypnuté, veta, klik nič nepošle; spracovaný, zlyhaný, duplikát, bez
     súboru a popísaný so súborom `stored` → zapnuté, bez vety;
   - `LW/damImageWidgetSites.test.ts`, describe „the authors of the DAM … offers a picked asset that has none" (oba
     widgety, +10): tri stavy → dialóg obrázka nedostane `showDamAuthors`, `asset` detailu ostane prázdny, po
     potvrdení žiadny `PATCH …/metadata-bulk-update`; spracovaný a popísaný asset → ponuka ako doteraz a zápis
     `{ id, authors, described: true }`. Stráž dostala konfiguráciu ext systému s autormi, `createImage` a
     vyprázdnenie assetu detailu po pripojení widgetu.
6. **Dôkaz** (v pamäti, snímok `F-C`; dva súbory, 98 prípadov; skript `fc-check.sh`): pravidlo bez „nepopísaný" →
   4 / 98; bez `stored`, bez `uploading`, bez `uploaded` → po 4; so `failed` a `duplicate` navyše → 4; F-C bez
   `:disabled` → 6; bez vety → 6; F-D bez podmienky vo widgete obrázka → 3, vo widgete s médiom → 3; tri súbory zo
   snímku (`N39L_OLD`) → 12 / 98.
7. **Behy** (skript `fc-check.sh`): cielené 108 súborov / 2 055 zelených (celý `L/` a `src/test`); `oxfmt`, `oxlint`,
   `eslint` na šiestich súboroch čisté, `lint:tsc` 0. Prvý beh: stráž padla celá (26), lebo vyprázdnenie assetu
   detailu bolo v `beforeEach` pred prvým pripojením (žiadna aktívna pinia); presunuté za pripojenie widgetu.
8. **Register**: `navrh-komponenty.md` 6.2, odrážka „Nález 49, F-C a F-D, oprava" (text F-C mal odrážku už predtým).
9. **Záplata** `zaplata.sh F-C` → `krok5-praca/zaplaty/F-C.diff` (6 súborov v `src`; mimo `src` a `doc` nič), pred CK.
   **CK-LIB F-C v LIB zelené** (`vysledky/F-C-ck.log`): `test:browser` 308 / 4 137 (45 + 26), `test:eslint` 7 / 82,
   ostatné čisté, `lint:eslint` 4 staršie varovania.

## Zmenené súbory

- `src/domains/dam/assetDetail/utils/assetMetadataMayStillChange.ts` (nový)
- `src/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue`
- `src/domains/dam/imageWidget/components/ImageWidgetInner.vue`
- `src/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue`
- `src/domains/dam/assetDetail/__tests__/assetDetailDialog.test.ts`
- `src/domains/dam/imageWidget/__tests__/damImageWidgetSites.test.ts`
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md` (6.2)

## Čo sa mení pre používateľa

Rozhodnuté vlastníkom 9. 10. Len pri assete, ktorý nie je popísaný a ktorého súbor server ešte nespracoval (v
knižnici prakticky cez čerstvé ID vložené do hľadania výberu): detail assetu („Upraviť v DAM", „Upraviť asset") má
„Uložiť" vypnuté a nad formulárom vetu „Asset sa stále nahráva alebo spracováva serverom"; po spracovaní treba detail
otvoriť znova. Widget obrázka a widget s médiom (admin-cms, ext systém s autormi) takému assetu bez autorov neponúkne
autorov DAM; zdroj sa píše ručne (či je povinný, určuje validácia zdroja aplikácie). Na backend v tom stave nejde uloženie metadát ani
autorov. Nový text ani kľúč nie je.

**Aj okno uploadu (opravené po posudku, FC-47-c1; pôvodne tu, v pláne a v registri stálo, že sa nemení).** Detail
otvorený z riadku fronty („Upraviť asset" v dialógu uploadu galérie a výberu assetu) číta asset čerstvo
(`UploadQueueDialog.vue`, `onEditAsset`), a riadok má formulár aj „Upraviť asset" už z notifikácie metadát bez ohľadu
na stav súboru (`uploadSettle.ts`). V admin-cms (notifikácie) teda ten, kto súbor práve nahral a otvorí detail riadku
počas spracovania, nájde „Uložiť" vypnuté s vetou, kým detail neotvorí znova po spracovaní; admin-ugc dopytuje a
formulár riadku dostane až so spracovaným súborom. Kód ostáva (pravidlo chráni pred prepísaním toho, čo doplní
spracovanie); **na rozhodnutie vlastníka**.

## Odchýlky

1. Veta je nad formulárom v obsahu sidebaru, nie „pri tlačidle" v lište akcií (lišta je teleportovaná a má pevnú
   výšku; rovnako to po posudku skončilo v admin-dam pri F-B).
2. Prípady F-D sú v stráži miest z U7 (`damImageWidgetSites.test.ts`), nad náhradou dialógu obrázka: tvrdia, čo widget
   dialógu podá a čo po potvrdení zapíše do DAM, nie vykreslené pole autorov.

## Zblíženia navyše (tvar registra)

Žiadne.

## Nové nálezy

Žiadne.

## Cyklus 1 (FC-47-c1, 11. 10.; posudky Codex a Opus; spoločný s krokom 47)

Snímok `FC-47-c1` (strom po U8-L). Kód F-C sa nemení.

1. **Zápisy** (Opus 1, 2): okno uploadu sa mení tiež (odsek vyššie, register 6.2 a 4.5).
2. **Prípad** „has its save off, with the word why, while the file of the row is still processed"
   (`L/assetDetail/__tests__/assetDetailDialog.test.ts`, describe detailu otvoreného z fronty uploadu): riadok po
   odoslaní súboru (`Processing`, súbor v DAM `uploaded`), detail jeho assetu má „Uložiť" vypnuté s vetou.
3. **Stráž v `onSave` pripnutá**: `save().click()` na vypnutom tlačidle neodošle nič, nech je stráž akákoľvek; tri
   prípady vypnutého „Uložiť" teraz volajú uloženie sidebaru priamo (`saveOfTheSidebar`), a nový prípad „is sent when
   asked for past its button, for an asset whose file is processed" ukazuje, že tá cesta inak ukladá.

**Dôkaz** (v pamäti, snímok `FC-47-c1`; skript `fc47c1-check.sh`, štyri súbory, 202 prípadov): `onSave` bez stráže →
6 / 202 (tri stavy v oboch aplikáciách). Behy, záplata a CK sú v `47.md` (spoločný cyklus).
