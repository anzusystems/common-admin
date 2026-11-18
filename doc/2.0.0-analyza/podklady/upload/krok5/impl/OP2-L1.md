# OP2-L1: autori neprečítaného assetu, chyba po zatvorení, čítanie navyše; nálezy 102, 94, 108 (impl-lib-op2)

**Stav: čaká na posudok.** Cielené testy a CK zelené po poslednej úprave `src` (CK-LIB OP2-L1, 12. 10.).

Zadanie vedúceho (`overenie-nalezov.md`, „Druhé overenie", tabuľka „FE, knižnica"): FE-18 (102), FE-19 (94),
FE-20 (108). Strom LIB `/home/volar/projects/anzusystems/common-admin`, TMPDIR
`node_modules/.cache/vitest-tmp-impl-lib-op2`. Snímok **`OP2-L1`** (urobil vedúci, s `doc/changelog/2.0.0.md`),
záplata `krok5-praca/zaplaty/OP2-L1.diff` (10 súborov; mimo `src` a `doc` nič).

## Zmenené súbory

- `src/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue`
- `src/domains/dam/uploadQueue/components/UploadQueueDialog.vue`
- `src/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue`
- `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts`
- `src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogActions.test.ts`
- `src/domains/dam/__tests__/consumerProfileUploadDialogSingle.test.ts`
- `src/domains/dam/assetDetail/__tests__/consumerProfileAssetDetailSave.test.ts`
- `src/domains/dam/uploadQueue/__tests__/uploadQueueOperations.test.ts`
- `doc/changelog/2.0.0.md` (jedna odrážka v „Image widgets and asset select, uploads and picks.", dve v „Upload queue
  and its dialogs.")

Testy, ktoré príznak `updateUploadStore` nastavujú ručne (`consumerProfileAssetDetailSave.test.ts:194`,
`assetDetailDialog.test.ts:517,541`, `damNamedConfigurationComponents.test.ts:605`), sa nemenili: každý má vo fronte
riadok toho assetu.

## FE-18 (102): autori DAM sa ponúkajú len pre asset, o ktorom sa vie, že ich nemá

**Čo sa mení v kóde.**
- Výber z knižnice, `assetSelectConfirmMap` (`ImageWidgetMultipleInner.vue:366-368`): `showDamAuthors` je pravda len
  pre asset, ktorý je v `assetMetadataMap` (prečítal sa) a nemá autorov. Asset, ktorého čítanie zlyhalo alebo ktorý DAM
  v odpovedi vynechal, dostane riadok so `showDamAuthors: false`. Vetva vlastného mapovania aplikácie (admin-ugc) sa
  nemení, tá dáva `false` vždy.
- „Uložiť a použiť" dialógu fronty, `onSaveAndApply` (`UploadQueueDialog.vue:145-155`): z odpovede uloženia `res` sa
  urobí množina id assetov a `showDamAuthors` je pravda len pre obrázok, ktorého `assetId` v nej je a ktorý nemá
  `authorIds`. Typy a podpisy `UploadMetadataToImageMapItem`, `UploadMetadataToImageMapFn` a
  `mapUploadMetadataToImages` sa nemenia.
- `assetId` na riadku ostáva. Číta ho len uloženie galérie (`ImageWidgetMultipleInner.vue:485-486`), a to len pri
  `showDamAuthors`; `:532` ho po uložení prenáša ďalej. Bez `showDamAuthors` nič neposiela.

**Čo som overil o `res` (druhý vstup).** `bulkUpdateAssetsMetadata` (`damAssetApi.ts:98-113`) pošle len riadky, ktoré
prejdú `hasMetadataToSave` (`:237-238`: majú `assetId` a `canEditMetadata`), po desiatich, a vráti spojené odpovede
`PATCH …/metadata-bulk-update`. Odpoveď musí byť zoznam (`useApiFetchItems`, `shape: 'array'`). core-dam vracia jednu
položku za každú poslanú (`AssetMetadataBulkFacade.php:54-65,79`), dávka prejde celá alebo vôbec. Nahraný riadok
s `assetId` a `fileId` teda v `res` chýba vtedy, keď sa neposlal: nemá `canEditMetadata`. **Taký riadok vie vzniknúť
v admin-cms** (notifikácie), ale výnimočne (spresnené po posudku Opusa): backend posiela `asset_metadata_processed`
prvú a `asset_file_processed` až po commite (`AbstractAssetFileStatusFacade.php:302-309,318`), knižnica ich v tom
poradí spojí do jedného čítania s metadátami (`uploadSettlement.ts:411-425,440-451,617-643`) a riadok dostane
formulár spolu so stavom „nahraný". Bez formulára ostane, len keď notifikácia metadát nepríde alebo príde viac než
250 ms po notifikácii súboru (`uploadPollSchedule.ts:47`): `asset_file_processed` vtedy číta asset bez metadát
(`metadata: false`), riadok je „nahraný" bez formulára (`uploadSettle.ts:337-348`) a z pollu vypadne (`:353`).
Dovtedy, kým metadáta neprídu (alebo natrvalo), je fronta „hotová", tlačidlo „Uložiť a použiť" svieti, uloženie
riadok preskočí a `mapUploadMetadataToImages` mu dá `authorIds: []` (`metadataToImageMap.ts:69,89`). Druhý vstup je
skutočný, pri bežnom nahraní však nenastane. V admin-ugc
(bez notifikácií) takto riadok nevzniká: poll aj obnovenie čítajú s metadátami. Druhá možnosť, odpoveď kratšia než
dopyt, od core-dam neprichádza; oprava ju kryje rovnako.

**Čo taký riadok ukazuje** (`ImageWidgetMultipleItem.vue`, nemenené). Výber autorov je len pri
`showDamAuthors && authorEnabled` (`:110-132`), inak textové pole zdroja (`:133-145`). Zdroj sa kontroluje rovnako ako
pri riadku, ktorého asset DAM pri načítaní nevrátil: `imageSourceRequired` (`:50-53`) je pravda, takže platí
`sourceValidation.required` aplikácie (`uploadValidations.ts:51`; predvolene `true`, admin-ugc `false`). Rozdiel
oproti načítaniu: tam má riadok uložený zdroj, tu je zdroj prázdny.

**Čo sa mení pre používateľa.** admin-cms, galéria (`AImageWidgetMultiple`):
- výber z knižnice, pri ktorom čítanie assetu zlyhá (hláška „systémová chyba" ako doteraz) alebo DAM asset
  v odpovedi vynechá: riadok má pole „Zdroj" namiesto prázdneho výberu autorov;
- „Uložiť a použiť" v dialógu fronty, keď nahraný riadok ešte nemá metadáta: jeho obrázok príde do galérie s poľom
  „Zdroj" namiesto prázdneho výberu autorov;
- **dôsledok, ktorý zadanie nemenuje:** pole „Zdroj" je v admin-cms povinné a pri takom riadku prázdne. Galéria sa
  neuloží („opravte chyby vo formulári"), kým redaktor zdroj nevyplní (ručne alebo hromadným vyplnením) alebo riadok
  neodstráni. Doteraz sa uložila s prázdnym zdrojom a bez autorov;
- hromadné operácie nad galériou (`AImageMassOperations`), keď ponúkajú autorov (aspoň jeden riadok ich ponúka):
  takému riadku zapíšu mená autorov do zdroja, do assetu nejde nič (`useImageMassOperations.ts:52-58` píše
  `damAuthors` každému riadku, uloženie ich posiela len pri `showDamAuthors`).

admin-ugc: viditeľne nič (autorov DAM nemá, `authorEnabled` je `false`). Obrázok riadku, za ktorý uloženie fronty
neodpovedalo, nesie `showDamAuthors: false` namiesto `true`.

**Na backend.** Pre asset, ktorý sa neprečítal alebo za ktorý uloženie fronty neodpovedalo, už nejde
`PATCH …/metadata-bulk-update` s autormi z galérie. Keď sa všetko prečíta a uloží, požiadavky aj riadky sú ako doteraz.

**Obmedzenie.** Aplikácia s vlastným `customUploadMetadataToImageMap`, ktoré vráti obrázok bez `assetId` alebo
s iným id, než má odpoveď uloženia, a s prázdnymi `authorIds`, dostane `showDamAuthors: false` (doteraz `true`).
admin-ugc vracia `assetId` riadku.

## FE-19 (94): dialóg jedného súboru po zatvorení nehlási chybu čítania

**Čo sa mení v kóde.** `UploadQueueDialogSingle.vue:196-197`: `catch` čítania assetu skončí bez hlášky, keď prvý
riadok fronty už nemá ten asset (tá istá podmienka ako úspešná vetva, `:192`).

**Zapisovač chýb API.** Zlyhanie sa hlási ako doteraz: `fetchAsset` (`damAssetApi.ts:57-72`) ide cez `useApiRequest`,
ktorý chybu odovzdá zapisovaču skôr, než ju hodí (`useApiRequest.ts:166`, `report` predvolene zapnuté, `:104`), teda
pred `catch` dialógu. Testy to pripínajú pri otvorenom aj zatvorenom dialógu.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc, widget obrázka a widget obrázka s médiom: keď používateľ
zatvorí dialóg uploadu hneď po dokončení súboru a čítanie assetu potom zlyhá, už sa neukáže „systémová chyba", ktorá
sama nezmizne. Pri otvorenom dialógu sa hlási ako doteraz.

**Na backend.** Nič.

**Obmedzenie.** Rovnako ako úspešná vetva: riadok, ktorý počas čítania zmení asset (stane sa originálom duplikátu),
už chybu toho čítania nehlási, hoci dialóg je otvorený.

## FE-20 (108): uloženie detailu nečíta asset, ktorého riadok žiadna fronta nemá

**Čo sa mení v kóde.** `updateFromDetail` (`uploadQueuesStore.ts:303-308`): po kontrole mena konfigurácie a pred
čítaním skončí, keď žiadna fronta nemá riadok toho assetu (`item.assetId === asset.id && item.type`, podmienka
zápisov). Príznak `updateUploadStore` sa nemení. Neznáme meno konfigurácie končí potichu ako doteraz (`:297-302`).

**Čo ešte robili obe vetvy bez zhody riadku.** `recalculateQueueCounts` (`uploadQueueCore.ts:151-158`) len znova
spočíta riadky fronty podľa ich stavu; každý zápis stavu počíta sám, takže bez zmeny riadku vyjde to isté.
`fetchCachedAuthors` a `fetchCachedKeywords` (`defineCached.ts:279-304`) spustia odložené čítanie mien, ktoré sú vo
fronte pamäte; bez zhody riadku do nej `updateFromDetail` nič nepridal a každý, kto pridáva, si čítanie spúšťa sám.
Vynechaním teda nič nezmizne; jediný rozdiel je, že cudzie čakajúce čítanie mien sa týmto volaním neodloží o ďalších
1,5 s.

**Čo sa mení pre používateľa.** admin-cms a admin-ugc: kto raz v dialógu fronty otvoril „upraviť asset", mal do
obnovenia stránky po každom uložení detailu (aj otvoreného z galérie alebo z výberu assetov) jedno čítanie assetu
navyše; hláška „upravené" a tlačidlo čakali naň. Teraz sa číta len vtedy, keď niektorá fronta má riadok toho assetu.

**Na backend.** Bez riadku toho assetu vo fronte nejde `GET …/asset/{id}` po uložení detailu. S riadkom ide ako doteraz.

**Obmedzenie.** Riadok, ktorý sa stane riadkom toho assetu až počas čítania (duplikát, ktorý sa stáva originálom),
keď dovtedy žiadna fronta riadok toho assetu nemala, už zápis nedostane; doteraz ho dostal, lebo zhoda sa hľadala až
po čítaní.

## Testy a prečo vedia zlyhať

Nové a prepísané prípady (+28; päť súborov, 239 prípadov):

- `consumerProfileImageWidgetMultipleUpload.test.ts` (+11):
  - výber z knižnice, obe aplikácie (`:602`): asset, ktorého čítanie DAM odmietne, a asset, ktorý DAM vynechá,
    majú riadok so zdrojom; prečítaný asset bez autorov má v admin-cms výber autorov ako doteraz;
  - uloženie galérie, admin-cms (`:1018-1085`, namiesto prípadu „…though its row offers them", ktorý pripínal starý
    stav): „nahradiť všade" hromadných operácií zapíše autorov do oboch riadkov, do DAM ide len asset, ktorý sa
    prečítal; zdroj takého riadku je povinný; autori vybraní v riadku prečítaného assetu bez autorov sa uložia ako
    doteraz;
  - „Uložiť a použiť" (`:682`, obe aplikácie): riadok, za ktorý uloženie neodpovedalo, má zdroj; (`:728,763`,
    admin-cms, notifikácia zo socketu): nahraný riadok bez metadát príde so zdrojom a do jeho assetu nejdú autori;
    riadok, za ktorý uloženie odpovedalo a nemá autorov, ich ponúka a ukladá ako doteraz.
- `consumerProfileUploadDialogActions.test.ts` (+3): to isté na udalosti `apply` dialógu (odpoveď bez assetu, obe
  aplikácie; riadok bez metadát, admin-cms: uloženie nepošle nič a obrázok nesie `showDamAuthors: false`).
- `consumerProfileUploadDialogSingle.test.ts` (+4): čítanie dialógu podržané a zlyhané (500): pri otvorenom dialógu
  hláška, po zatvorení žiadna; zapisovač chýb API dostal zlyhanie v oboch prípadoch.
- `consumerProfileAssetDetailSave.test.ts` (+6): s príznakom a bez riadku toho assetu (žiadna fronta; fronta s inými
  assetmi) nejde po uložení žiadny `GET` assetu, hláška „upravené", riadky nedotknuté; s riadkom sa číta a riadok
  dostane, čo má DAM (úspešná vetva; neúspešnú držia staršie prípady tej istej skupiny).
- `uploadQueueOperations.test.ts` (+4): `updateFromDetail` bez riadku toho assetu nepošle nič a nechá riadky aj počty
  (asset čitateľný aj nečitateľný; žiadna fronta); riadok len v druhej fronte: číta sa raz a zapíše.

`useImageMassOperations().replaceEmptyAuthors` volajú testy priamo (to, čo robí tlačidlo „nahradiť všade"); komponent
hromadných operácií widget sám nepripája.

**Dôkaz** (v pamäti, `vitest.bend.config.mts`, snímok `OP2-L1`; skript `scratchpad/op2l1-bend.sh`, výpisy
`scratchpad/op2l1-bend-*.log`, `op2l1-old.log`):

| Ohyb | Zlyhá |
|---|---|
| štyri produkčné súbory zo snímku | 20 / 239 (všetky prípady, ktoré pripínajú zmenu) |
| galéria: `showDamAuthors` bez `assetMetadataMap.has` (po starom) | 5 |
| galéria: `showDamAuthors` vždy `false` | 6 (aj „autori vybraní v riadku sa uložia") |
| galéria: len pre neprečítaný asset | 6 |
| dialóg: `showDamAuthors` bez odpovede uloženia (po starom) | 6 |
| dialóg: vždy `false` | 9 (aj staršie prípady „ako doteraz") |
| dialóg: stačí, že uloženie odpovedalo za hocičo | 5 |
| dialóg jedného súboru: `catch` bez kontroly (po starom) | 2 |
| dialóg jedného súboru: `catch` nikdy nehlási | 2 |
| dialóg jedného súboru: kontrola obrátená | 4 |
| sklad: číta vždy (po starom) | 7 |
| sklad: nečíta nikdy | 23 |
| sklad: podmienka obrátená | 30 |
| sklad: pozerá len prvú frontu | 1 |
| sklad: stačí hocijaký riadok | 4 |

**Behy.** Cielené (`scratchpad/op2l1-run.sh`): 5 súborov / 239 zelených; okolie (`dam/uploadQueue`, `assetDetail`,
`dam/__tests__`, `imageWidget`, `assetSelect`) 84 súborov / 1 910 zelených. `oxfmt`, `oxlint`, `eslint` na deviatich
súboroch čisté, `lint:tsc` 0. **CK-LIB OP2-L1 zelená** (`vysledky/OP2-L1-ck.log`): `test:browser` 314 súborov / 4 395
testov (pred krokom 4 367, +28), `test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`,
`lint:stylelint` čisté.

## Texty na potvrdenie

Žiadne.

## Nové nálezy (nemenené)

- **Povinný prázdny zdroj po FE-18** (admin-cms): riadok galérie s neprečítaným assetom a obrázok nahraného riadku bez
  metadát majú povinné prázdne pole „Zdroj"; galéria sa neuloží, kým sa nevyplní. Je to dôsledok rozhodnutej opravy,
  nie chyba kódu; ak má byť zdroj takého riadku nepovinný, je to zmena v `ImageWidgetMultipleItem.vue:50-53`.
- **„Uložiť a použiť" odovzdá nahraný riadok bez metadát** (admin-cms, okno medzi notifikáciou súboru a notifikáciou
  metadát): obrázok príde do galérie bez popisu a bez zdroja, hoci asset ich v DAM má alebo dostane, a uloženie fronty
  ten riadok neuloží. Tlačidlo sa riadi len stavom „nahraný" (`UploadQueueDialog.vue:81-82`). Starší stav, pripnutý
  v `metadataToImageMap.test.ts:199-216`.
- **Hromadné vyplnenie autorov píše aj do riadkov, ktoré autorov neponúkajú** (`useImageMassOperations.ts:52-58`
  nepozerá `showDamAuthors`): riadku s vlastným zdrojom prepíše zdroj menami vybraných autorov („nahradiť všade"),
  alebo vyplní prázdny. Do DAM nejde nič.
