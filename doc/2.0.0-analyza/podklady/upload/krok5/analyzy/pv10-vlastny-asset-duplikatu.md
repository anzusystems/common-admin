# PV10: vlastný asset riadku duplikátu (`uploadedAssetId`), analýza (9. 10.)

Zadanie: jadro 5.2 PV10 a C56, denník nález 11 (LIB, bod 7 zoznamu po krokoch 0 až 3), rozhodnutie vlastníka
(denník, „Otvorené témy…", bod 3): **zjednotiť**, aj keď pole jedna strana zatiaľ nečíta. Len čítanie kódu, testy som
nespúšťal.

Skratky: `L/` = `common-admin/src/domains/dam/`, `D/` = `admin-dam/src/domains/coreDam/`, `LT` = testy LIB v
`L/uploadQueue/…/__tests__/`, `DT` = `admin-dam/src/test/`. `L-se` = `L/uploadQueue/settlement/uploadSettle.ts`,
`L-st` = `L/uploadQueue/store/uploadQueuesStore.ts`, `D-st` = `D/asset/store/uploadQueuesStore.ts`, `UQIE` =
`L/uploadQueue/components/UploadQueueItemEditable.vue`, `AQIE` = `D/asset/components/queue/AssetQueueItemEditable.vue`.

## 1. Dnes

### 1.1 Jeden kód, dve voľby

Duplikát na oboch stranách usadzuje **ten istý** kód knižnice z kroku 2 (`createUploadSettle`, `L-se`); admin-dam ho
dostáva z balíka (`D-st:10,219`). Strany sa líšia len hodnotou `duplicate` v profile: knižnica `becomeOriginal` pre
každú rolu (`L-st:113`), admin-dam `markDuplicate` pre každú rolu (`D-st:101,104,106`). Typ riadku `UploadQueueItem`
je jeden, z knižnice (`L/types/UploadQueue.ts:44-89`, vyvezený v `src/lib.ts:360`).

### 1.2 Čo riadok drží po usadení duplikátu

| Pole | LIB (`becomeOriginals`, `L-se:459-542`) | DAM (`markDuplicates`, `L-se:419-455`) | Rozdiel |
|---|---|---|---|
| `isDuplicate` | `true` (`:511`) | `true` (`:427`) | žiadny |
| `assetId` | **originál** (`:527`) | **vlastný** (nemení sa) | produkt (voľba `duplicate`) |
| `duplicateAssetId` | originál (`:515`) | originál, `file.asset` (`:451`) | žiadny: na oboch „asset originálu, keď sa ho podarilo prečítať" |
| `fileId` | súbor originálu (`:514`) | súbor originálu, `file.id` (`:450`) | žiadny: vlastný súbor sa stráca na oboch stranách |
| vlastný asset | **stratený** | v `assetId` | **toto je nález 11** |
| metadáta, formulár | originálu, formulár zapnutý (`:518-531`) | žiadne, formulár vypnutý (`:429`) | produkt |
| náhľad, `mainFileSingleUse` | originálu | originálu (`:452-453`) | žiadny |

Ak sa originál nepodarí prečítať, čakajúci LIB riadok zlyhá s vlastným `assetId` a bez `isDuplicate` (`L-se:481-506`), DAM
riadok ostane označený bez `duplicateAssetId` (`:438-445`). Import od externého poskytovateľa v DAM, ktorý server
odmietne ako „nie je jedinečný", dostane `isDuplicate = true` bez assetu (`D/shared/services/upload/
externalProviderImportService.ts:37-41`); usadzovaním nejde.

### 1.3 Kto píše a kto číta `assetId` (a s ním súvisiace polia)

| Oblasť | LIB | DAM |
|---|---|---|
| továreň | `assetId: null`, `duplicateAssetId: null`, `isDuplicate: false` (`L/uploadQueue/factory/UploadQueueItemFactory.ts:24-29`) | tá istá továreň z balíka (`D-st:19,169`) |
| štart uploadu | `assetId = res.asset`, `fileId = res.id` (`L/uploadQueue/composables/uploadService.ts:268-269`) | to isté (`D/../shared/services/upload/uploadService.ts:248-249`); po K2/K3 jedna služba |
| vznik riadku s assetom | kópia do licencie `assetId = targetAsset` (`L-st:228`) | slot `:417`, hromadná úprava `:442-443`, import `externalProviderImportService.ts:24-25` |
| usadzovanie | zápisy z 1.2; sledovanie a „Obnoviť" podľa `assetId` (`L/uploadQueue/settlement/uploadSettlement.ts:110-111,560-563,701`) | to isté |
| zhoda udalostí | `row.assetId === target.assetId` (`L-st:115`) | `notificationMatches`, najprv `assetId`, potom súbor (`D-st:223-227,719-735`) |
| notifikácie | `toSettlementEvent` posiela asset udalosti (`L-st:151-171`) | poslucháči aplikácie cez obaly `D-st:739-758` |
| „Obnoviť" | `refreshAsset(assetId)` (`L-st:389-391`); riadok `UQIE:162,175-178` | `refreshQueueItem(item)` (`D-st:762-766`); riadok `AQIE:136-140`; duplikát nikdy |
| odstránenie | `removeByIndex` podľa indexu, bez požiadavky (`L-st:408-414`); kôš „odstrániť z fronty" `UQIE:353-358` | kôš zmaže asset `deleteAsset(item.assetId)`, potom `removeByAssetId` (`AQIE:167-177,418-424`; `D/asset/components/queue/AssetQueueEditable.vue:60-62`; `D-st:542-553`, nález 38) |
| hromadné operácie | `assetId` nečítajú | to isté |
| uloženie fronty | `hasMetadataToSave`: `assetId` a `canEditMetadata` (`L/api/damAssetApi.ts:214-225`): **LIB duplikát ukladá metadáta do originálu** | `D/asset/api/assetApi.ts:205-213`: DAM duplikát formulár nemá, neukladá sa |
| detail, kópia id | „Upraviť v DAM" a „Kopírovať ID" podľa `assetId` (`UQIE:170-173,315-316`) | „Upraviť" (na duplikáte skryté) a „Kopírovať ID" podľa `assetId` (`AQIE:142-151,380-381`) |
| odkaz na originál | nie je (len text „duplikát", `UQIE:374-381`) | „Zobraziť originál" podľa `duplicateAssetId` (`AQIE:321-322`); **jediný čitateľ `duplicateAssetId` v oboch stromoch** |
| dialóg jedného súboru | detail a karta ROI podľa `assetId` (`L/uploadQueue/components/UploadQueueDialogSingle.vue:82-93,306-312`); „Obnoviť" `UploadQueueDialogSingleSidebar.vue:87` | nie je |
| widget | obrázok sa skladá z `assetId` a `fileId` riadku (`L/imageWidget/utils/metadataToImageMap.ts:64-96`, `UploadQueueDialog.vue:138`): **článok dostane originál** | nie je |
| zápis z detailu | `updateFromDetail` podľa `assetId` (`L-st:435`) | `updateAssetMetadata` podľa `assetId` (`D-st:860`) |

Záver: v knižnici je riadok po usadení „originálom" pre všetko (formulár, uloženie, obrázok vo widgete, detail,
zhoda udalostí). To je produkt a ostáva. Stratí sa len jedna informácia, asset, ktorý vytvoril upload riadku.
admin-cms ani admin-ugc typ riadku nečítajú ani neskladajú (grep `UploadQueueItem`, `duplicateAssetId`, `isDuplicate`
v ich `src`: nič).

## 2. Návrh zjednoteného modelu

**Pole.** `uploadedAssetId?: DocIdNullable` v `UploadQueueItem`, nepovinné, továreň ho dá `null`.

```ts
/**
 * The asset the server found the file of this row a duplicate on: the row's own asset, the one its upload made.
 * `assetId` names the original once the row has become it (the library). Null while the row is no duplicate.
 */
uploadedAssetId?: DocIdNullable
```

Nepovinné, lebo typ je verejný: povinné pole by zlomilo každého, kto riadok skladá doslova; v admin-dam je to aspoň
pomocník testov `queueRow` s návratovým typom `UploadQueueItem` (`DT/support/fakeDam.ts:294-320`). Rovnako je
nepovinné `imagePreview` (`L/types/UploadQueue.ts:65`).

**Kto a kedy píše.** Len usadzovanie, jednou malou funkciou v `L-se`, ktorú volajú obe cesty duplikátu tam, kde dnes
píšu `isDuplicate = true` (`L-se:427` a `:511`):

```ts
const markAsDuplicate = (row: UploadQueueItem) => {
  row.isDuplicate = true
  // Once, before anything may write the original over `assetId`.
  row.uploadedAssetId ??= row.assetId
}
```

- Hodnota je `assetId` riadku v tej chvíli, teda asset, na ktorom server súbor označil za duplikát (zhoda riadku s
  cieľom ide na oboch stranách cez `assetId`, `L-st:115`, `D-st:725`). Pri uploade je to asset, ktorý vytvoril štart;
  pri slote a hromadnej úprave asset, ku ktorému súbor patrí (tam sa rovná `assetId`).
- V LIB sa zapíše v tom istom kroku ako originál (len riadkom, ktoré ostali nedotknuté, `L-se:509`), nie pred čakaním.
  Ak sa originál nepodarí prečítať, riadok nie je duplikát a pole ostane `null`; vlastný asset je ďalej v `assetId`.
- `??=`: riadok, ktorý sa už stal originálom, si prvú hodnotu nechá, aj keby ho neskôr usadzovanie označilo znova.
- admin-dam nemení ani riadok kódu: dostane to cez balík. Import (`externalProviderImportService.ts:39`) sa nemení;
  asset nemá, pole by bolo `null` aj tak.

**Model po zjednotení** (rovnaké mená, rovnaký význam na oboch stranách):

| Pole | Význam | LIB duplikát | DAM duplikát |
|---|---|---|---|
| `isDuplicate` | server označil súbor riadku za duplikát | `true` | `true` |
| `uploadedAssetId` | vlastný asset riadku duplikátu; `null`, kým riadok duplikát nie je | vlastný | vlastný |
| `duplicateAssetId` | asset originálu, keď sa ho podarilo prečítať | originál | originál |
| `assetId` | asset, s ktorým riadok pracuje (formulár, uloženie, widget, detail, „Obnoviť", zhoda udalostí) | originál | vlastný |
| `fileId` | súbor, s ktorým riadok pracuje | súbor originálu | súbor originálu |

Pravidlo pre budúceho čitateľa: vlastný asset ľubovoľného riadku je `uploadedAssetId ?? assetId`, originál je
`duplicateAssetId`. Rozdiel strán ostáva len v `assetId` a je to voľba profilu (produkt), nie stratená informácia.

**Čo sa nemení.** Nikto pole v kroku 5 nečíta, takže používateľ nevidí nič, na backend nejde nič iné. `assetId`,
`duplicateAssetId`, `fileId`, zhoda udalostí, sledovanie, „Obnoviť", uloženie a widget ostávajú presne ako dnes. Pole
sa zapíše v tom istom synchrónnom kroku ako `isDuplicate`, a nad riadkami nie je hlboký watcher (grep `deep: true` v
komponentoch fronty a widgetov oboch strán: nič), takže ani prekreslenie navyše.

**Zvažované a zamietnuté.**
- Písať len v `becomeOriginals` (návrh jadra, 5.2): v admin-dam by pole ostalo vždy `null`, teda dva významy toho
  istého poľa; to nie je zjednotenie.
- Písať pri štarte uploadu (`res.asset` v službe): viac zapisovateľov (služba, import DAM, kópia LIB, slot a hromadná
  úprava DAM), zmena kódu DAM, a čitateľ by `?? assetId` potreboval aj tak (hromadná úprava nič neuploaduje).
- Prevrátiť význam (LIB nechá vlastný asset v `assetId`, originál inde): zmenilo by formulár, uloženie aj obrázok
  vo widgete, teda produkt.
- `uploadedFileId`: vlastný súbor sa stráca na oboch stranách rovnako (`L-se:450,514`), rozdiel strán nie je a nikto ho
  nepotrebuje. Nepridávať.

## 3. Čo sa potom môže zblížiť

| Čo | Dnes | S poľom | Vnútorné? | Odporúčanie |
|---|---|---|---|---|
| zápis „riadok je duplikát" v usadzovaní | dve cesty píšu `isDuplicate` zvlášť | jedna funkcia `markAsDuplicate` pre obe | áno | áno, v tomto kroku (jediné zblíženie kódu teraz) |
| kôš „zmazať asset" ako variant spoločného riadku | len obsah slotu `remove` obalu DAM, číta `assetId` (`navrh-komponenty.md`, RD9, 2.2 pravidlá a obal DAM) | spoločný kôš by čítal `uploadedAssetId ?? assetId` a v knižnici by nezmazal originál | áno, kým CMS a UGC ostanú pri „odstrániť z fronty" | nie v kroku 5: zisk asi 10 riadkov, cena nová väzba (požiadavka, upozornenia DAM) a testy; pole len odstraňuje pascu, ktorú jadro opísalo |
| odkaz „Zobraziť originál" aj v knižnici | len DAM (`AQIE:321-322`) | `duplicateAssetId` je na oboch stranách už dnes | nie, produkt | nenavrhujem; pole na to netreba |
| zmazanie assetu, ktorý upload duplikátu v knižnici nechal na serveri | nikto ho nemaže (odvodené, 6) | knižnica by vedela, ktorý to je | nie, produkt | len ako možnosť do budúcna |
| zhoda udalostí, sledovanie, „Obnoviť" podľa vlastného assetu | podľa `assetId` | dalo by sa | áno, ale mení, ktoré udalosti dôjdu k riadku, ktorý sa stal originálom | nie: žiadny zisk, len riziko |
| zápis z detailu (`updateFromDetail`, `updateAssetMetadata`) | podľa `assetId`; LIB riadok originálu dostane detail originálu, čo je správne | nič | — | bez zmeny (C51 ich drží osobitne z iných dôvodov) |
| nález 38 (kôš DAM odoberie prvý riadok assetu) | `removeByAssetId` | nič | — | oprava „posielať riadok" je od PV10 nezávislá |

Skutočný zisk poľa je teda hlavne v tom, že spoločný kód, ktorý sa bude raz pýtať na vlastný asset riadku (kôš,
upratanie duplikátu), dostane rovnakú odpoveď v oboch aplikáciách a nezmaže originál.

## 4. Nezrovnalosť návrhov (prehľad §7, bod 1; plán §8, bod 1)

Platí návrh komponentov: **časť 4 pole nepotrebuje a PV10 ju neblokuje.**
- Kôš knižnice len odoberá z fronty, bez požiadavky: `UQIE:353-358` (`emit('removeItem', index)`); v časti 4 je to
  predvolený obsah slotu `remove` (`navrh-komponenty.md`, RD9, riadok 246).
- Kôš admin-dam je obsah slotu `remove` v obale DAM, kód `AQIE:167-177,418-424` bez zmeny (`navrh-komponenty.md:596`;
  väzba zoznamu `remove: () => {}`, `:673`). Číta `item.assetId`, ktorý v admin-dam `markDuplicates` nikdy neprepíše
  (`L-se:426-454`); pripína `DT/queue/queueRowActions.test.ts:259-279` („deletes the asset the upload of a duplicate
  made, never the original…").
- Veta jadra („časť 4 ho bude potrebovať", 5.2 PV10 a C56) platí len podmienečne: keby sa „zmazať asset" stal kódom
  spoločného riadku a ponúkol sa aj riadku knižnice. To by bola produktová zmena a žiadny návrh ju nemá. Odporúčam
  vetu v jadre opraviť a bod 1 v prehľade §7 uzavrieť; C56 potom nie je „produkt, lebo kôš", ale vnútorné doplnenie
  poľa, keďže produktový rozdiel (`becomeOriginal` proti `markDuplicate`) ostáva voľbou profilu.

## 5. Testy, krok, veľkosť

**LIB** (`L/uploadQueue/settlement/__tests__/`):
- `support/settlementFixtures.ts:460-476`: `settledState` dostane `uploadedAssetId` („čo usadzovanie píše"). Pomocník
  `queueRow` (`:38-46`) ide cez továreň, takže `null` dostane sám.
- `uploadSettle.test.ts`: N-S7 `:362-378` očakáva `uploadedAssetId: 'asset-1'`; `:392-395` dva riadky, oba
  `'asset-1'`; `:407-413` nečitateľný originál: `uploadedAssetId: null`, `assetId: 'asset-1'`. N-S8 `:462-470` (hneď
  pri označení) a `:476-485` (po prečítaní originálu) `'asset-1'`; `:496-501` `'asset-1'` aj bez originálu. N-S11
  `:763-777` riadok hromadnej úpravy: `uploadedAssetId` = jeho `assetId`.
- Nový prípad N-S7: riadok, ktorý sa stal originálom a usadzovanie ho označí znova, si nechá `'asset-1'`. Dôkaz
  ohnutím: `??=` na `=`, prípad očervenie.
- Bez zmeny, ale strážia poradie: `uploadSettlement.test.ts:1413-1426` („does not write the original of a duplicate
  that answers after it") a `uploadSettle.test.ts:427-440` („changes nothing and asks for nothing"); s `settledState`
  rozšíreným o pole očervenejú, ak by sa pole písalo pred čakaním na originál alebo bez neho.
- `doc/changelog/2.0.0.md`: jeden riadok o novom nepovinnom poli.

**DAM**: kód sa nemení. Nepovinne jedno tvrdenie v `DT/queue/queueRowActions.test.ts:271`
(`[assetId, duplicateAssetId, uploadedAssetId]` = `['asset-1', 'asset-original', 'asset-1']`), ktoré dokáže, že pole
cez balík príde aj do admin-dam; patrí k U8-D po kópii.

**Krok.** Samostatný malý krok PV10 v 2.9 plánu, ako je tam zapísaný (súbory `L-se`, `L/types/UploadQueue.ts`,
továreň), plus `settlementFixtures.ts` a changelog. Kódovú závislosť na K1 až K7 ani na U-krokoch nemá: tieto tri
súbory iný krok nemení. Ide v strome LIB, keď je voľný, najneskôr pred C3, aby išiel s tou istou kópiou; po C3 by
potreboval C4. Spoločný súbor s PV9, ak jeho oprava pôjde do `L-se`: robiť jeden po druhom.

**Veľkosť.** LIB 1,5 h (asi 10 riadkov kódu, 8 tvrdení, 1 nový prípad, cielené testy, `lint:tsc`); DAM 0,25 h
(jedno tvrdenie v U8-D). Spolu asi 1,75 h; plán ráta 1,5 h.

## 6. Čo som neoveril

- Testy ani `lint:tsc` som nespúšťal (zadanie). Že nepovinné pole nič nezlomí, je odvodené z typu a z grepov.
- Osud assetu duplikátu na serveri: z kódu core-dam-bundle to vyzerá, že sa nezmaže. Upratovanie maže súbory
  duplikátov staršie ako týždeň, ale nie hlavný súbor assetu (`core-dam-bundle/src/Repository/
  AbstractAssetFileRepository.php:101-114`), a nový upload robí súbor hlavným (`Domain/AssetSlot/AssetSlotFactory.php:38`).
  Odvodené, nespúšťané.
- Či kópia do licencie môže skončiť ako duplikát: neoverené. Návrh to pokrýva tak či tak (pole píše usadzovanie
  pri každej role).

## Pre vlastníka

1. Pridať do riadku nepovinné pole `uploadedAssetId` (vlastný asset riadku duplikátu; továreň `null`). Odporúčam áno.
2. Pole píše len spoločné usadzovanie, na oboch stranách rovnako, raz, keď označí riadok za duplikát. To je odchýlka od
   jadra, ktoré ho písalo len v knižnici. Odporúčam áno, inak by pole v admin-dam bolo vždy prázdne.
3. Potvrdiť, že sa produkt nemení: v knižnici duplikát ďalej pracuje s originálom (formulár, uloženie, obrázok vo
   widgete), v admin-dam ostane sebou s odkazom na originál; nové pole v kroku 5 nikto nečíta.
4. Nezrovnalosť návrhov: platí návrh komponentov, časť 4 pole nepotrebuje (kôš admin-dam je vo vlastnom slote, kôš
   knižnice nič nemaže). Odporúčam vetu v jadre opraviť a bod uzavrieť.
5. Spoločný kôš „zmazať asset" pre obe strany neskôr, nad týmto poľom: nie v kroku 5 (malý zisk, nová väzba).
6. Odkaz „Zobraziť originál" v knižnici, prípadne mazanie assetu, ktorý upload duplikátu nechal na serveri: produktové
   rozhodnutia, nenavrhujem; len na vedomie, že pole ich umožní.
7. Zhoda udalostí, sledovanie a „Obnoviť" ostávajú podľa `assetId`. Odporúčam áno.
8. `uploadedFileId` nepridávať (vlastný súbor sa stráca rovnako na oboch stranách a nikto ho nepotrebuje). Odporúčam áno.
9. Rozsah: samostatný krok PV10 v 2.9, len knižnica, pred C3; asi 1,5 h plus 0,25 h jedno tvrdenie v admin-dam (U8-D).
