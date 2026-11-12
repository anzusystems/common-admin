# OP9-D1: admin-dam, nálezy 230 a 234 a text „Uložiť" zadržaného pre zlyhaný súbor (impl-dam-op9)

Zadanie `krok5-praca/zadania/zadanie-OP9-D1.md`, pravidlá `PRAVIDLA.md`; nálezy `register-zblizeni.md`, časť 8
(230, 234), overenie `impl/posudky/overenie13-dam-codex.md`, rozhodnutie A vlastníka (text). Strom
`/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `cffd0078`, čistý; knižnica v `node_modules` =
common-admin `6054fab4`. TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op9`, pracovný priečinok
`krok5-praca/pracovne/impl-dam-op9/`. Nič sa nemazalo, žiadny zápis do gitu, knižnica sa nemenila. **V prehliadači som
nevidel nič z tohto kroku.** Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `D/` =
`A/components/detail/`. Čísla riadkov platia pre strom po kroku.

## Podkroky

1. **Snímok `OP9-D1`** (`snimok.sh … OP9-D1 doc/changelog/3.0.0.md`), hotový pred prvou úpravou.
2. **Testy.** Starý kód len v pamäti (`vitest.old.config.mts`, `OLD_SNAP=OP9-D1`, 4 produkčné súbory kroku podané zo
   snímku; nový `A/composables/assetDeleteOnce.ts` snímok nemá), ohnutia `vitest.k3-bend.config.mts` (oba skopírované
   z TMPDIR `impl-dam-op8`). Skripty `t.sh`, `old.sh`, `files.sh`, `bends.py`, `bend-run.sh`, `fmt.sh`; logy `log/`,
   ohnutia `bends/vysledok.txt`. **Štyri nové súbory testov, 29 prípadov, na snímku 17 červených**; tri existujúce
   prípady zmenené (na snímku červené, nižšie). **Ohnutí 8, všetky červené.**
3. `oxfmt`, `oxlint`, `eslint` nad súbormi kroku: 0.
4. **CK-DAM `OP9-D1`, obe časti zelené:** `vysledky/OP9-D1-testy.log` 125 súborov / 1 886 testov (OP8-D1-c2: 121 /
   1 857; +4 súbory, +29 prípadov), `vysledky/OP9-D1-linty.log`: `generate:dts`, `lint:tsc`, `format:check`, `oxlint`,
   `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplaty/OP9-D1.diff`: 1 552 riadkov, 14 súborov (4 zmenené a 1 nový produkčný, 2 preklady, 4 nové
   a 2 zmenené testy, changelog); mimo `src` len `doc/changelog/3.0.0.md` (je v snímku).

## Text pri „Uložiť" zadržanom pre zlyhaný súbor (rozhodnutie A)

**Kód.** `D/components/AssetDetailSidebarMetadata.vue:63`, `A/components/list/components/AssetListSidebarMetadata.vue:58`:
`heldForFailedFile` = hlavný súbor, ktorý detail drží, je `failed`. Riadok pod „Uložiť" sa ukazuje ako doteraz len pri
`saveBlocked`; pri `heldForFailedFile` je to `coreDam.asset.detail.fileFailedOpenAgain` (`:172`, resp. `:196`), inak
`fileStillProcessing`. Nový text v `src/locales/sk/coreDam/asset.json:118` („Spracovanie súboru zlyhalo. Uložiť pôjde
po novom otvorení assetu.") a `en/…:118` („Processing of the file failed. You can save after opening the asset again.").

**Či nové otvorenie „Uložiť" pustí (čítaním a testom): áno, okrem dvoch prípadov nižšie.** Pri zlyhanom hlavnom súbore
je `metadataMayStillChange` false (`STILL_PROCESSING` nemá `failed`, `A/store/uploadQueuesStore.ts:130-139`), zadržiava
len `saveHeldBack`, a každé celé čítanie ide cez `setAsset`, ktoré ho zhodí (`A/store/assetDetailStore.ts:171`). Celé
čítanie: klik na dlaždicu, ceruzka dlaždice, ← a → detailu, stránka assetu načítaná znova; s napísaným až po „Odísť aj
tak". Tiché prevzatie, ktoré „Uložiť" zadrží, predtým zabudne päťsekundovú skratku (`fileStatusOnServer`
`assetDetailStore.ts:241`, `useAssetFileChanged` `D/composables/assetDetailFileChange.ts:47`), takže klik číta.
**Nepustí:** „Upraviť" panela (nečíta nič, detail ukáže ten istý formulár) a asset držaný ako mazaný (`setAsset` doň
nepíše, OP8-D1 c1-3; „Uložiť" je tam vypnuté pre mazanie). Iný text som nevymýšľal.

**Čo vidí používateľ.** Detail nad zoznamom, panel a obe stránky detailu: pod napísaným so zlyhaným hlavným súborom karta
„Spracovávanie súboru zlyhalo.", „Uložiť" zadržané a pod ním nový text (doteraz „Súbor sa ešte spracúva…"). Ostatné
zadržania (súbor na ceste, spracovaný súbor pod napísaným, súbor iného slotu) majú starý text.

**Testy.** Nový `src/test/list/detailFailedFileText.test.ts` (7): nový text v detaile zoznamu, v paneli a na stránke
assetu (3, na snímku červené); nové otvorenie pustí „Uložiť" v paneli (klik na dlaždicu) a v detaile (zavretie
a ceruzka), formulár zo servera, žiadny riadok (2 strážcovia, zelené aj na snímku: dokazujú tvrdenie textu); súbor na
ceste má starý text v detaile a v paneli (2 strážcovia). **Zmenené existujúce prípady (3, na snímku červené):**
`detailFileEnded` „keeps what was typed into the panel beside the list, says the file failed, and "Save" stays held back"
a `detailFirstFile` „takes a first file that failed under what was typed…" a „keeps "Save" held back under what was typed
once the first file on its way has failed": tvrdia nový text namiesto „The file is still being processed.".

| Ohnutie | Červené |
|---|---|
| vždy starý text (detail aj panel) | 3 |
| nový text pri akomkoľvek zadržaní | 2 (strážcovia súboru na ceste) |

## 230: „Neobsahuje žiaden súbor." pri assete s hlavným súborom

**Kód.** `A/components/AssetInfobox.vue:54`: riadok `draft` len pri assete **bez hlavného súboru**
(`!assetMainFileStatus`; obaja volajúci, `AssetDetailDialogSidebar.vue` a `AssetListSidebarMetadata.vue`, podávajú stav
hlavného súboru). Voľba: riadok podľa hlavného súboru, stav assetu sa pri tichom prevzatí v kroku nebral (**od c1-4 sa berie**, pravidlo
boxu ostáva podľa hlavného súboru); formulár ani napísané sa nemenia. Samotné prevzatie stavu by nestačilo: server drží asset ako `draft`, kým nespracuje niektorý jeho súbor
(`AssetPropertiesRefresher.php:127-140`), teda aj pri celom čítaní so súborom na ceste, zlyhaným alebo duplikátom.

**Čo hovorí box** (detail, panel, obe stránky) pri assete s hlavným súborom:

| Hlavný súbor | Box teraz | Box predtým |
|---|---|---|
| na ceste (`uploading`, `uploaded`, `stored`) | nič | „Neobsahuje žiaden súbor." |
| spracovaný (`with_file` po celom čítaní; pod napísaným po tichom prevzatí v kroku `draft`, od c1-4 `with_file`) | nič | pod napísaným „Neobsahuje žiaden súbor." |
| zlyhaný | „Spracovávanie súboru zlyhalo." (s dôvodom) | to isté (zlyhanie malo prednosť) |
| duplikát | „Hlavný súbor je duplikát." | to isté a „Neobsahuje žiaden súbor." |

Asset bez hlavného súboru: „Neobsahuje žiaden súbor." ako doteraz; asset `deleting`: „Čoskoro bude zmazaný." ako doteraz (od c1-2 aj pred zlyhaným a duplicitným súborom).
Riadok pod „Uložiť" sa nemení (súbor na ceste neopísaného assetu: „Súbor sa ešte spracúva…").

**Testy.** Nový `src/test/list/infoboxMainFile.test.ts` (11): prvý súbor spracovaný pod napísaným v detaile a v paneli
(2), prvý súbor na ceste prevzatý pod napísaným z čítania fronty (1), súbor na ceste pri celom čítaní v detaile, paneli
a na stránke (3), duplikát (1) — 7 na snímku červených; strážcovia: zlyhaný súbor (1), asset bez súboru v troch
miestach (3). Ohnutie „riadok podľa stavu assetu" → 7 červených.

## 234 (a): druhé zmazanie z koša riadka hromadnej úpravy

**Kód.** Nový `A/composables/assetDeleteOnce.ts`: reaktívna množina id assetov, ktorých `DELETE` je na ceste, mimo
komponentov (riadok aj karta detailu sa počas požiadavky môžu odpojiť a nakresliť znova); `deleteAssetOnce(assetId)`
(`:16`) pošle `deleteAsset`, ak jedno nie je na ceste (inak `false` bez požiadavky), a v `finally` id vyberie;
`assetDeleteOnItsWay(id)` (`:13`). `A/components/queue/AssetQueueItemEditable.vue:129`: `remove` cez `deleteAssetOnce`,
odmietnuté nerobí nič; `:270` kôš vypnutý aj počas `DELETE` assetu riadka.

**Čo vidí používateľ.** Po potvrdení koša je kôš vypnutý do odpovede (bez kolieska), aj na riadku nakreslenom znova po
schovaní a ukázaní fronty; jedno „Záznam bol odstránený.", jedno `DELETE`. Zlyhané zmazanie: hláška ako doteraz, kôš
znova funguje. **Navyše (nehovorí zadanie):** kľúčom je asset, nie riadok: počas `DELETE` sú vypnuté koše všetkých
riadkov toho assetu v ktorejkoľvek fronte a „Odstrániť" detailu toho assetu (234 b).

**Testy.** Nový `src/test/list/queueRowDeleteOnce.test.ts` (5): kôš vypnutý počas `DELETE` a jedno zmazanie (1), to isté
po schovaní a ukázaní fronty (1) — na snímku 2 červené; strážcovia: zlyhané zmazanie a druhé stlačenie zmaže (1), kôš
riadka iného assetu funguje (1); jednotkový prípad `deleteAssetOnce` (1; nový modul, na snímku sa nepodáva, zelený).

| Ohnutie | Červené |
|---|---|
| kôš nie je vypnutý počas `DELETE` | 2 |
| `deleteAssetOnce` pošle druhé `DELETE` | 1 (jednotkový) |

## 234 (b): detail mazaného assetu

**Kód.** `D/components/AssetDetailSidebarMetadata.vue:66`: `isDeleting` ako v paneli
(`AssetListSidebarMetadata.vue:136`); `:158` „Uložiť" `saveBlocked || isDeleting`; `:148` „Odstrániť"
`isDeleting || assetDeleteOnItsWay(asset?.id)`; `:133` `onDelete` cez `deleteAssetOnce`.

**Otázka pri odchode, ako v paneli.** Panel nemá vlastnú kontrolu: `setDeleting` (`A/store/assetDetailStore.ts:297-302`)
zhodí `metadataAreTouched`, takže napísané pred označením sa nepýta ani v paneli, ani v detaile (jeden sklad pre oba);
napísané po označení sa pýta v oboch (formulár ostáva upraviteľný). Detail tak panelu zodpovedá bez zmeny kódu; dva
prípady to tvrdia (ich časť „nepýta sa" je zelená aj na snímku).

**Čo vidí používateľ.** Pri assete v stave `deleting` „Uložiť" aj „Odstrániť" vypnuté pod „Čoskoro bude zmazaný.":
v detaile nad zoznamom (aj otvorenom cez „Upraviť" panela) po koši riadka, po vlastnom zmazaní s inou kartou otvorenou
a pri assete, ktorý server už vráti ako `deleting`; na oboch stránkach detailu v kroku len pri assete `deleting` zo
servera (vlastné zmazanie stránky asset neoznačili, **opravené v c1-1**). **Navyše (pravidlo 5, druhé stlačenie):** „Odstrániť"
detailu je vypnuté aj počas vlastného `DELETE` (aj na karte Info nakreslenej znova po inej karte) a počas `DELETE` toho
assetu z koša riadka; doteraz druhé stlačenie poslalo druhé `DELETE`.

**Ostatné akcie detailu, ktoré na mazaný asset ešte pôsobia (nemenené, z čítania):** Info: „Stiahnuť"
(`AssetDownloadButton`), karta hlavného súboru („Nastaviť ako verejné" / „súkromné", `AssetFileMainRoute` v
`AssetMetadata.vue`), úprava polí formulára; Fókus: úprava ROI a otočenie súboru (`AssetFileRotate`); Distribúcia:
kategória (`DistributionCategoryWidget`), nové distribúcie (YouTube, JW, vlastná), zastavenie a úprava záznamu
distribúcie; Podcasty: nová epizóda; Video relácie: nová epizóda; TTS; Sloty: upload do slotu, „Spraviť ako hlavný súbor",
duplikát do iného slotu, odstránenie súboru, súrodenecký asset, stiahnutie súboru slotu; Miniatúra videa: výber obrázka,
„Vybrať z distribúcie", zrušenie priradenia.

**Testy.** Nový `src/test/list/detailDeleting.test.ts` (6): „Upraviť" panela po koši riadka (1), vlastné zmazanie s inou
kartou (1), asset `deleting` zo servera v detaile zoznamu a na stránke assetu (2), druhé „Odstrániť" počas `DELETE` aj po
inej karte (1) — na snímku 5 červených; strážca: zlyhané zmazanie nechá „Odstrániť" funkčné (1).

| Ohnutie | Červené |
|---|---|
| „Uložiť" nie je vypnuté pre `deleting` | 4 |
| „Odstrániť" nie je vypnuté pre `deleting` | 4 |
| „Odstrániť" nie je vypnuté počas vlastného `DELETE` | 1 |

## Changelog

`doc/changelog/3.0.0.md`, Fixed: nové položky „"Uložiť" held back for a main file that failed says why",
„"Neobsahuje žiaden súbor." is said only of an asset with no main file", „The bin of a row of the mass edit deletes the
asset once", „The detail of an asset being deleted offers neither "Uložiť" nor "Odstrániť"". Položka „A detail opened
while its file was being processed learns…" hovorila o starom texte pri zlyhanom súbore: jej koniec teraz odkazuje na
nasledujúcu položku.

## Medze

- Text: asset držaný ako mazaný so zlyhaným hlavným súborom a zadržaným „Uložiť" (napísané, zlyhanie, potom kôš riadka):
  riadok hovorí o novom otvorení, ktoré „Uložiť" nepustí (vypnuté pre mazanie, asset sa do detailu nečíta); box hovorí
  zlyhanie, nie mazanie (staršie, nález 2). **Po c1-2 neplatí.**
- Text: klik na dlaždicu do 5 s od celého čítania toho istého assetu nečíta (staršia skratka). Tiché prevzatie ju
  zabudne; nastane to len, keď celé čítanie pristane medzi správou o súbore a tichým čítaním a potom sa do 5 s píše
  a klikne. **Po c1-3 neplatí.**
- 234 (a): odmietnutie v `deleteAssetOnce` (stlačenie, ktoré by prešlo vypnutým tlačidlom) dokazuje len jednotkový
  prípad. Po zmazaní z detailu ostáva riadok toho assetu v hromadnej úprave a jeho kôš pošle ďalšie `DELETE` (204 alebo
  404): staršie, nie „naraz".
- 234 (b): uloženie odoslané pred označením, ktoré zlyhá po ňom, vráti „napísané" (`onSave`, `catch`) a pri odchode sa
  pýta; rovnako v paneli (staršie).
- Testy dokazujú vypnuté tlačidlá, texty a počty požiadaviek, nie správanie prehliadača.

## Nové nálezy (neopravené)

1. **(Opravené v c1-4.) Veľký obrázok detailu pod napísaným po tichom prevzatí spracovaného súboru ostáva zástupnou ikonou**: stav assetu
   ostáva `draft` (berie sa len hlavný súbor) a `ADamAssetImage` kreslí obrázok len pri `with_file`
   (`common-admin/src/domains/dam/assetDetail/components/AssetImage.vue:200,250`, rovnaké v `node_modules`), inak ikonu
   `mdi-image-off`; karta súboru súbor ukazuje. Čítaním kódu, v teste neoverené. Oprava: prevzatie stavu assetu
   v `setMainFile` (voľba A zadania 230), stav nie je pole formulára.
2. **(Opravené v c1-2.) Box: zlyhaný hlavný súbor má prednosť pred mazaním** (`A/components/AssetInfobox.vue:30-49`, `v-if` / `v-else-if`):
   mazaný asset so zlyhaným súborom nehovorí „Čoskoro bude zmazaný.". Staršie, nízka závažnosť.

## Cyklus c1 (14. 10.; štyri body po posudkoch Codex `impl/posudky/OP9-D1-codex.md` a Opus)

Zadanie `krok5-praca/zadania/zadanie-OP9-D1-c1.md`. Snímok `OP9-D1-c1` pred prvou zmenou; starý kód cyklu `old-c1.sh`,
`files-c1.sh` (7 produkčných súborov podaných zo snímku), ohnutia `bends-c1.py`, zoznam `bends/mena-c1.txt`.

| Bod | Čo robí kód teraz | Čo vidí používateľ |
|---|---|---|
| c1-1 | `D/AssetDetailView.vue:130` a `D/AssetFileDetailView.vue:133`: obe stránky poskytnú `provideAssetDeleted`; pri zmazaní assetu, ktorý stránka drží, `assetDetailStore.setDeleting()`, iný asset nič (zoznam na stránke nie je). | Na stránke assetu a stránke assetu súboru: „Odstrániť" → potvrdiť → iná karta pred odpoveďou → späť na Info: „Uložiť" aj „Odstrániť" vypnuté pod „Čoskoro bude zmazaný.", jedno `DELETE` (doteraz oba zapnuté, druhé `DELETE`). Napísané pred zmazaním sa pri odchode nepýta (`setDeleting`). S kartou Info otvorenou pri odpovedi stránka assetu odíde na zoznam a stránka assetu súboru asset zahodí, ako doteraz. |
| c1-2 | `A/components/AssetInfobox.vue:24`: mazanie je prvé v reťazi `v-if`/`v-else-if` (pred duplikátom, zlyhaním a „bez súboru"). `D/components/AssetDetailSidebarMetadata.vue:169`, `A/components/list/components/AssetListSidebarMetadata.vue:192`: riadok pod „Uložiť" len pri `saveBlocked && !isDeleting`. | Mazaný asset (kôš riadka, detail) so zlyhaným alebo duplicitným hlavným súborom: box „Čoskoro bude zmazaný." (doteraz zlyhanie, pri duplikáte oboje); pod vypnutým „Uložiť" žiadny riadok, ani nový, ani „Súbor sa ešte spracúva…" (ani jeden by nebol pravda). V detaile aj v paneli. |
| c1-3 | `A/store/assetDetailStore.ts:181`, `holdSaveBack(assetId)`: zadrží „Uložiť" a zabudne päťsekundovú skratku (`forgetLastFetched`); volá ho `setMainFile` (`:195`) a správa o súbore iného slotu (`:258`). | Klik na dlaždicu číta aj do 5 s od celého čítania toho assetu, ak „Uložiť" medzitým zadržalo tiché prevzatie; s napísaným sa pýta a po „Odísť aj tak" asset číta a „Uložiť" pustí. |
| c1-4 | `A/store/assetDetailStore.ts:198`: `setMainFile` (tiché prevzatie pod napísaným) berie aj `attributes.assetStatus` prečítaného assetu; pravidlo boxu ostáva podľa hlavného súboru. | Pod napísaným: po spracovaní prvého súboru veľký obrázok detailu (doteraz zástupná plocha); po „Odstrániť súbor natrvalo" jediného (hlavného) súboru v Slotoch box „Neobsahuje žiaden súbor." (doteraz nič, stav ostal `with_file`). Napísané sa nemení. Asset, ktorý server medzitým vráti ako `deleting`, sa prevzatím stane mazaným (vypnuté „Uložiť" aj „Odstrániť"). |

**c1-3: kto má pravdu.** Codex. Tiché zadržanie skratku zabúda (`fileStatusOnServer` `:250` pred odložením,
`useAssetFileChanged`), ale celé čítanie, ktoré je pri správe na ceste, ju po pristátí znova zapíše
(`A/components/list/composables/assetListActions.ts:115`, `updateLastFetched`), a odložené tiché čítanie zadrží až potom.
Poradie: celé čítanie (dlaždica po 5 s) → správa o zlyhaní (odloženie za čítanie) → čítanie pristane so súborom na ceste
(pečiatka) → tiché čítanie → napísané → tiché čítanie pristane so zlyhaným súborom (zadržanie) → klik do 5 s od pečiatky
nečítal a nepýtal sa. Teraz zadržanie skratku zabudne, veta changelogu o novom otvorení platí (doplnená o päť sekúnd).

**Testy cyklu.** Nové prípady v súboroch kroku, 6, na snímku cyklu všetkých 6 červených: `detailDeleting.test.ts` +2
(c1-1: stránka assetu a stránka assetu súboru), `detailFailedFileText.test.ts` +2 (c1-3: poradie Codexu so zadržanými
čítaniami; c1-2: zlyhaný súbor pod napísaným, zmazanie z detailu s inou kartou, detail aj panel po zavretí),
`infoboxMainFile.test.ts` +2 (c1-4: obrázok po spracovaní prvého súboru v detaile zoznamu; „bez súboru" po odstránení
jediného súboru v Slotoch). Existujúce prípady sa nemenili.

| Ohnutie | Červené |
|---|---|
| c1-1: stránky nič neoznačia | 2 |
| c1-2: box mazanie neukáže | 1 |
| c1-2: riadok pod „Uložiť" aj pri mazaní | 1 |
| c1-3: zadržanie skratku nezabudne | 1 |
| c1-4: stav assetu sa neberie | 2 |

**CK-DAM `OP9-D1-c1`, obe časti zelené:** `vysledky/OP9-D1-c1-testy.log` 125 súborov / 1 892 testov (+6),
`vysledky/OP9-D1-c1-linty.log` čisté. **Záplata** `zaplaty/OP9-D1-c1.diff`: 617 riadkov, 11 súborov (7 produkčných,
3 testy, changelog).

**Changelog.** Položky „"Uložiť" held back for a main file that failed…" (päť sekúnd, žiadny riadok pri mazaní),
„"Neobsahuje žiaden súbor."…" (mazanie v boxe, prevzatie stavu pod napísaným: obrázok, asset bez súboru), „A delete in
the detail marks…" (stránky označia držaný asset; doteraz „mark nothing, as before") a „The detail of an asset being
deleted…" (stránky asset ani neoznačili; mazanie v boxe prvé; žiadny riadok pod „Uložiť").

**Medze cyklu.**
- c1-2: pri mazanom assete nie je pod „Uložiť" žiadny riadok, ani pre súbor na ceste; brief žiadal skryť nový, starý by
  pri mazaní tiež nebol pravda (rozhodnutie).
- c1-4: prevzatý stav `deleting` zo servera (zmazal niekto iný) robí z tichého prevzatia mazaný asset; potom ho do
  detailu nič neprečíta (c1-3 z OP8-D1), kým ho detail drží.
- c1-1: stránka po vlastnom zmazaní z inej karty ostáva na mazanom assete (ako dialóg nad zoznamom); odísť treba ručne.

**Nové nálezy cyklu:** žiadne.

## Cyklus c2 (14. 10.; len text, posudok Codex `impl/posudky/OP9-D1-c1-codex.md`)

Changelog `3.0.0.md:134,156,157,169,176`: tiché prevzatie pod napísaným berie s hlavným súborom aj stav assetu (c1-4; doteraz „only the main file"); v poznámke časť 230 (voľba, tabuľka, `deleting`) doplnená o c1-4 a c1-2. Kód bez zmeny; snímok `OP9-D1-c2` len pre záplatu `zaplaty/OP9-D1-c2.diff`, CK sa nespúšťala.
