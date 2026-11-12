# OP-D2: hromadné uloženie pošle z riadku len to, čo sa v ňom zmenilo, FE-12, koreň nálezu 49 (impl-dam-op)

Zadanie vedúceho z 12. 10. (rozhodnutie vlastníka: sledovať zmeny a poslať len ich); `overenie-nalezov.md`, tabuľka
„FE, admin-dam", riadok „Koreň 49". Strom `/home/volar/projects/anzusystems/admin-dam` (po OP-D1). TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu.
Backend len čítaný: `B` = `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src`.

## Podkroky

1. **Snímok `OP-D2`**: `bash …/nastroje/snimok.sh /home/volar/projects/anzusystems/admin-dam OP-D2
   doc/changelog/3.0.0.md`, hotový.
2. **Overenie backendu pred kódom** (nižšie, „Backend"); súhrn návrhu poslaný vedúcemu, práca pokračovala.
3. **Kód** (nižšie). Celá sada pred novými testami (cez `tezky.sh`): 73 súborov / 1 301 testov zelených na novom
   kóde, žiadny existujúci test sa nezmenil (riadky sú v nich vložené do fronty priamo, teda bez známych hodnôt
   servera, a idú celé).
4. **Testy:** nový súbor `src/test/queue/bulkSaveChanges.test.ts` (21 prípadov) a prepísaný prípad v
   `src/test/queue/overlaySave.test.ts`.
5. **Dôkazy** v pamäti (`scratchpad/opd2-bends.py`, `opd2-bend-run.sh`, výsledky `scratchpad/opd2-*-run.txt`).
6. `oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
7. **CK-DAM OP-D2** (`krok5-praca/vysledky/OP-D2-ck.log`) zelené: 74 súborov / 1 322 testov (po OP-D1 1 301, +21),
   všetko čisté vrátane buildu.
8. **Záplata** `zaplata.sh OP-D2`: `krok5-praca/zaplaty/OP-D2.diff` (708 riadkov, 6 súborov, z toho 2 nové); mimo
   `src` len `doc/changelog/3.0.0.md`, ktorý je v snímku.

## Backend (overené pred kódom)

- **(a) Čiastočná položka prejde validáciou.** `B/Validator/Constraints/AssetValidator.php:35-39` a `:47-51`
  kontrolujú kľúčové slová a autorov len vtedy, keď prišli (`false === $value->isKeywordsUndefined()`,
  `isAuthorsUndefined()`); `B/Validator/Constraints/CustomDataValidator.php:51-53` sa vráti, keď `customData`
  neprišli. Validátor sa teda pozerá len na DTO, nie na asset, a pole, ktoré nepríde, nekontroluje.
- **(b) `customData` backend NAHRÁDZA.** `B/Domain/AssetMetadata/AssetMetadataManager.php:66-78`
  (`updateCustomData`): pre každý prvok formulára, ktorý nie je len na čítanie, sa kľúč, ktorý v poslanom objekte
  chýba, z uložených dát odstráni (`:71-72`), inak sa prepíše (`:77`). Preto sa `customData` posielajú **celé**,
  keď sa líši ktorýkoľvek kľúč.
- Polia, ktoré neprídu, správca preskočí: `B/Domain/Asset/AssetMetadataBulkManager.php:45` (kľúčové slová),
  `:57` (autori), `:79` (prepínač), `:122` (`customData`).

**Pozor:** dve veci z tohto kroku zmenil cyklus 1 (na konci poznámky): nedotknutý riadok popísaného assetu sa
neposiela vôbec a základ drží aj `described`. Časti nižšie opisujú stav po kroku; kde sa cyklom zmenili, je to
pri nich napísané.

## Čo sa mení v kóde

- **Nový modul** `src/domains/coreDam/shared/services/upload/queueRowBaseline.ts`: „základ" riadku, teda kópia
  `keywords`, `authors`, `customData` a `mainFileSingleUse`, ako ich riadok naposledy dostal zo servera alebo
  naposledy úspešne uložil. Drží ho `WeakMap` podľa surového riadku (typ riadku je knižničný, pole doň pridať
  nejde); so zánikom riadku zanikne. Modul má aj porovnanie hodnotou (`sameMetadataValue`): zoznamy podľa hodnôt
  v poradí, objekty podľa kľúčov, kľúč bez hodnoty (`undefined`) ako chýbajúci kľúč, lebo taký sa ani nepošle.
- **`src/domains/coreDam/asset/api/assetApi.ts`**, `bulkUpdateAssetsMetadata`:
  - Pre každý riadok s formulárom ide vždy `id` a `described: true` (**po cykle 1:** len pre riadok, ktorý sa
    posiela). `keywords`, `authors`, `customData` idú len vtedy, keď sa líšia od základu; `mainFileSingleUse` len
    keď nie je `null` a líši sa od základu.
  - Riadok bez základu ide celý, presne ako doteraz (aj `mainFileSingleUse`, keď nie je `null`).
  - Odoslané hodnoty sú kópia riadku zobratá pri začiatku uloženia. Po dávke, ktorú server potvrdil kódom 200,
    sa táto kópia stane základom riadkov tej dávky. Dávka, ktorá zlyhala, a dávky po nej základ nemenia.
  - Typ `AssetMetadataBulkItem`: `keywords`, `authors` a `customData` sú nepovinné. Uloženie jedného assetu
    (`updateAssetMetadata`, detail a panel) posiela všetko ako doteraz.
- **`src/domains/coreDam/asset/store/uploadQueuesStore.ts`** zapisuje základ všade, kde do riadku idú hodnoty
  servera (zoznam nižšie).

### Kto zapisuje do riadku hodnoty servera (a teda základ)

| Miesto | Kedy | Základ |
|---|---|---|
| `fetchLazyAdditionalMetadata`, bežná vetva | čítanie výberu hromadnej úpravy | hodnoty assetu z odpovede |
| `updateAssetMetadata` skladu | po uložení z detailu alebo z panela zoznamu, do každého riadku toho assetu | uložené hodnoty |
| knižnica, `mergeLoadedMetadata` (`uploadSettle`) | prvé načítanie metadát riadku: notifikácia o metadátach, dopytovanie fronty, tlačidlo obnoviť (všetky cez `applyAssetRead`) | hodnoty assetu z toho čítania |
| `bulkUpdateAssetsMetadata` | po dávke potvrdenej kódom 200 | čo dávka poslala |

- **Cesta knižnice.** Háčik `afterMetadataLoaded` dostane len riadok, nie asset, a zlúčenie necháva v riadku
  neprázdne hodnoty používateľa. Základ preto nemôže byť riadok po zlúčení (čo bolo napísané pred načítaním, by
  sa nikdy neposlalo). Sklad si v `afterMetadataLoaded` zapamätá riadok a základ zapíše v háčiku `onAssetRead`
  toho istého čítania, z assetu, ktorý prišiel.
- **Len prvé volanie háčika pre riadok.** Knižnica zlúči metadáta do riadku raz (`metadataLoaded`), ale
  `afterMetadataLoaded` volá aj pri neskoršom čítaní, keď riadok už svoje hodnoty má a nič sa doň nezapíše.
  Neskoršie volanie základ nemení: riadok drží staršie hodnoty a nový základ by ich poslal cez to, čo medzitým
  uložil niekto iný.
- **Bez základu ostáva** (hodnoty servera sa nezapisujú, alebo sa riadok neukladá): `mainFileSingleUse` zapísaný
  do riadku bez formulára (`addByAssets`, knižničný `decorateRow`; prepíše ho čítanie výberu alebo zlúčenie),
  duplikát (neukladá sa), oživenie riadku hromadnej úpravy po zlyhanom súbore (`onProcessedSeen`: riadok aj
  základ ostávajú, ako boli).

## Čo sa mení pre používateľa

Tlačidlá, upozornenia, validácia riadkov pred uložením a stav fronty po uložení sú rovnaké. **Jedno viditeľné je**
(spresnené v cykle 2, posudok Opusu): riadok, ktorý sa neposiela (nedotknutý riadok popísaného assetu, od cyklu 1),
backend vôbec nezapíše. Pred krokom dostal každý asset fronty pri každom hromadnom uložení nový čas úpravy a ako
posledného upravovateľa toho, kto uložil (`AssetManager.php:43-47`, `trackModification`), a bol znova
zaindexovaný (`AssetMetadataBulkFacade.php:76`). Teraz to platí len pre assety, ktorých riadok odišiel:
- detail assetu prečítaný po uložení ukáže pôvodného upravovateľa a pôvodný čas úpravy;
- zoznam zoradený podľa úpravy nedotknutý asset neposunie.

## Čo sa posiela na backend inak

`PATCH /adm/v1/asset/metadata-bulk-update`, položka riadku:

| Riadok | Doteraz | Teraz |
|---|---|---|
| nedotknutý, so základom | `id`, `keywords`, `authors`, `described`, `customData`, prípadne `mainFileSingleUse` | `id`, `described: true` (**po cykle 1:** popísaný asset sa neposiela vôbec) |
| zmenené jedno pole | všetko | `id`, `described: true` a to pole (`customData` celé) |
| druhé uloženie bez zmeny | všetko | `id`, `described: true` (**po cykle 1:** nič, žiadna požiadavka) |
| bez základu | všetko | všetko, ako doteraz |

Delenie po desať riadkov na požiadavku, poradie riadkov a zastavenie pri prvej zlyhanej dávke sa nemení. Každý
uložený riadok je ďalej označený `described` (rozhodnutie vlastníka).

## Dôsledky na backende (na rozhodnutie, poslané vedúcemu)

1. **Backend ohlási ako zmenený aj asset, ktorému neprišli `customData` alebo `authors`.** (Rozhodnuté: cyklus 1
   takú položku pre nedotknutý popísaný riadok neposiela; nález pre backend je v cykle 1.)
   `B/Domain/AssetMetadata/AssetMetadataBulkFacade.php:82-89` (`isAssetChanged`): položka BEZ `customData`, keď
   asset nejaké má (`:84`), alebo BEZ `authors`, keď asset nejakých má (`:86`), sa počíta ako zmena. Nasleduje
   `AssetChangedEvent` (`:69-73`), v core-dam `src/Event/Listener/AssetChangedEventListener.php:22-27` pošle
   `AssetChangedMessage` a `src/Messenger/Handler/AssetChangedMessageHandler.php:21-29` zavolá
   `ExtSystemCallbackFacade::notifyAssetsChanged`, teda CMS. Doteraz nedotknutý riadok poslal rovnaké hodnoty a
   udalosť nevznikla. Po OP-D2 vznikne pre takmer každý uložený asset pri každom hromadnom uložení, aj pri druhom
   „Uložiť" bez zmeny. Dáta sa nestratia; backend a CMS robia prácu navyše. Možnosti: prijať; alebo posielať
   `authors` a `customData` vždy (chránené by ostali len kľúčové slová a prepínač); alebo najprv opraviť
   `isAssetChanged` na backende. Zmena na strane admin-dam je pár riadkov v jednej funkcii.
2. **Server už nekontroluje povinné pole nedotknutého riadku.** Keď `keywords`, `authors` alebo `customData`
   neprídu, backend ich nevaliduje (bod (a)). Validácia riadku v prehliadači pred uložením beží ďalej; druhá
   kontrola na serveri pre nedotknuté polia odpadá.
3. **Základ po uložení je to, čo sa poslalo, nie to, čo server uložil.** Odpoveď uloženia sa nečíta (ako
   doteraz). Backend môže autorov pri uložení zameniť za „aktuálnych" (`AssetMetadataBulkManager.php:65`,
   `provideCurrentAuthorToColl`); riadok aj základ potom držia poslaných. Nie je to horšie než doteraz (riadok
   sa z odpovede neobnovoval ani predtým), druhé uloženie ich už nepošle.

## Testy a prečo môžu zlyhať

**Nový súbor `src/test/queue/bulkSaveChanges.test.ts`** (21 prípadov; skutočný sklad a skutočná požiadavka nad
falošným serverom, riadky dostanú metadáta cestami aplikácie, falošný čas na celý prípad):

- hromadná úprava (výber cez `addByAssets`, čítanie výberu zo servera): nedotknutý riadok ide ako
  `{ id, described: true }`; ide len zmenené pole (kľúčové slová, vyprázdnené kľúčové slová, autori, jedno vlastné
  pole s ostatnými, vyprázdnené vlastné pole, prepínač); rovnaké hodnoty v novom zozname či objekte nie sú zmena,
  iné poradie zoznamu je; hromadná operácia sa počíta (vyplniť prázdne, nahradiť všade); druhé uloženie nepošle
  žiadne pole; po zlyhanom uložení ide zmena znova; čo sa napíše počas uloženia, pošle ďalšie uloženie;
- po desať riadkov: 23 riadkov ide ako 10, 10, 3; po zlyhanej druhej dávke ďalšie uloženie pošle zmeny druhej a
  tretej dávky, prvej nie;
- riadok bez základu ide celý (aj prepínač, keď je známy) a po tom uložení základ má;
- odkiaľ je základ: uloženie z detailu alebo panela (`updateAssetMetadata` skladu); notifikácia o metadátach
  uploadu (to, čo hromadná operácia zapísala pred načítaním, sa pošle, hodnoty servera nie); tlačidlo obnoviť;
  neskoršie čítanie assetu základ nemení; oživenie riadku po zlyhanom súbore základ nechá.

**Prepísaný prípad s dôvodom:** `overlaySave.test.ts`, hromadná úprava › „its save button", prvý prípad
(`:499-520` pred krokom). Tvrdil, že každý vybraný asset ide celý. Teraz sa assety vyberú tak, ako ich vyberá
zoznam (`addByAssets`, čítanie zo servera), do formulára prvého riadku sa napíše titul a uloženie pošle
`[{ id, described, customData }, { id, described }]`; ostatné tvrdenia prípadu (zoznam sa nečíta, výber ostáva)
sú bez zmeny. Pri pomôcke `editable` je poznámka, že riadky vložené priamo do fronty základ nemajú a idú celé.

**Na kóde zo snímku** (`OLD_SNAP=OP-D2`, `assetApi.ts` a `uploadQueuesStore.ts`): 21 z 81 červených, a to 20 z 21
nových a prepísaný prípad prekrytia. Jediný nový zelený je „riadok bez základu ide celý": pripína dnešné
správanie ako poistku.

**Ohnutia**, každé zvlášť nad novým súborom (21 prípadov):

| Ohnutie | Červené |
|---|---|
| čítanie výberu základ nezapíše | 14 (všetky prípady hromadnej úpravy so základom) |
| `updateAssetMetadata` skladu základ nezapíše | 1 (uloženie z detailu alebo panela) |
| základ pri každom volaní háčika | 1 (neskoršie čítanie assetu) |
| základ z riadku po zlúčení, nie z assetu | 1 (notifikácia o metadátach uploadu) |
| cesta knižnice základ nezapíše | 3 (notifikácia, obnoviť, neskoršie čítanie) |
| uloženie základ neposunie | 3 (druhé uloženie, riadok bez základu po uložení, zlyhaná dávka) |
| základ sa posunie pred odpoveďou | 2 (zlyhané uloženie, zlyhaná dávka) |
| základ z riadku pri odpovedi, nie z odoslanej kópie | 1 (napísané počas uloženia) |
| `keywords` vždy / `authors` vždy / `customData` vždy / prepínač vždy | 17 / 17 / 18 / 18 |
| riadok bez základu sa berie ako nezmenený | 1 (riadok bez základu ide celý) |
| zoznamy bez ohľadu na poradie | 1 |
| kľúč bez hodnoty je rozdiel | 1 |

## Zmenené súbory (5 v `src`, 1 mimo)

- `src/domains/coreDam/shared/services/upload/queueRowBaseline.ts` (nový)
- `src/domains/coreDam/asset/api/assetApi.ts`
- `src/domains/coreDam/asset/store/uploadQueuesStore.ts`
- `src/test/queue/bulkSaveChanges.test.ts` (nový)
- `src/test/queue/overlaySave.test.ts`
- `doc/changelog/3.0.0.md` (jedna položka v „Fixed")

## Texty na potvrdenie

Žiadne.

## Odchýlky, nové nálezy

- Odchýlka: žiadna z piatich rozhodnutí návrhu. Doplnené v súhrne návrhu: odoslané hodnoty sú kópia zo začiatku
  uloženia a tá istá kópia je nový základ (telo požiadavky a základ sa nemôžu rozísť, kým dávka čaká).
- Nové nálezy: body 1 až 3 v časti „Dôsledky na backende". Bod 1 mení správanie backendu a čaká na rozhodnutie.
- Položka changelogu o bode 1 nehovorí; ak ostane, treba ju doplniť o vetu pre backend.

## Cyklus 1 (OP-D2-c1; rozhodnutie vedúceho k bodu 1 dôsledkov a nález Codexu k FE-13)

Správy vedúceho prišli až po uzavretí OP-D2 aj OP-D3, cyklus je preto nad stromom po OP-D3. Snímok **`OP-D2-c1`**
(`doc/changelog/3.0.0.md` v ňom).

### Rozhodnutie (vedúci, po prečítaní `isAssetChanged` a odberateľov udalosti)

Čiastočná položka pri každom uložení každého riadku je pre backend priveľa práce; posielať `authors` a
`customData` vždy by zrušilo zmysel kroku. Preto:

1. Základ drží aj `described`: príznak assetu pri každom zapisovateľovi, ktorý asset má, a `true` po úspešnom
   hromadnom uložení riadku.
2. Riadok BEZ zmeneného poľa, ktorého základ hovorí `described: true`, sa **neposiela vôbec**. Keď nemá čo poslať
   žiadny riadok, **nejde žiadna požiadavka** a uloženie skončí ako úspešné.
3. Riadok BEZ zmeneného poľa so základom `described: false` ide ako `{ id, described: true }`. Je to jedna
   udalosť „zmenený" navyše za život assetu, prijaté.
4. Riadok SO zmeneným poľom ide ako `{ id, described: true }` a zmenené polia, ako v kroku.
5. Riadok bez základu, alebo so základom bez `described` (nevie sa), ide celý ako doteraz.

### Čo sa mení v kóde

- `queueRowBaseline.ts`: základ (`QueueRowBaseline`) má navyše `described: boolean | undefined`; `baselineOfAsset`
  ho berie z `asset.flags?.described` (odpoveď bez príznakov = nevie sa). Nová `queueRowHoldsBaseline(riadok)`:
  riadok má základ a jeho štyri hodnoty sa mu rovnajú, teda ho nikto nezmenil.
- `assetApi.ts`:
  - `listItemsToMetadataBulkItems` zloží zmenené polia; riadok bez zmeny so základom `described: true` vynechá.
    „Celý" ide riadok bez základu alebo so základom bez `described`.
  - `bulkUpdateAssetsMetadata` odmietne (`assetApi: no metadata to save`) len vtedy, keď žiadny riadok nemá
    formulár, ako doteraz. Keď riadky formulár majú, ale žiadny nemá čo poslať, cyklus dávok neprebehne a funkcia
    skončí úspechom.
  - Dávky po desať sa počítajú z riadkov, ktoré sa posielajú. Chyba validácie servera (`[index].pole`) sa preto
    priraďuje riadku dávky (`batch[index]`), nie riadku fronty na tom mieste.
  - Po dávke potvrdenej kódom 200 je základ jej riadkov odoslaná kópia s `described: true`.
- `uploadQueuesStore.ts`:
  - Zapisovatelia základu berú `described` z assetu (`fetchLazyAdditionalMetadata`, `onAssetRead`).
  - **Spresnenie rozhodnutia 1:** po uložení z detailu alebo panela (`updateAssetMetadata` skladu) je v základe
    `described: true`, nie príznak objektu assetu. To uloženie posiela `described: true` vždy
    (`assetApi.ts`, `updateAssetMetadata`) a objekt, ktorý panel drží, je spred neho.
  - **FE-13 podľa základu** (bežná vetva dávky): riadok s formulárom si hodnoty nechá, len keď
    `!queueRowHoldsBaseline(riadok)`, teda keď ho používateľ zmenil alebo základ nemá. Nedotknutý riadok odpoveď
    dávky prevezme (hodnoty aj nový základ). `failStillLoading` ostáva ako v OP-D1: dávka tam pre riadok žiadnu
    odpoveď nemá (vynechala ho alebo zlyhala), takže niet čo prevziať a riadok s formulárom si ho nechá, zmenený
    aj nezmenený. Vetva „súbor sa ešte spracúva" sa nemenila.

### Čo sa posiela na backend (stav po cykle)

| Riadok | Položka |
|---|---|
| nedotknutý, základ `described: true` | žiadna |
| nedotknutý, základ `described: false` | `{ id, described: true }`, raz; druhé uloženie nič |
| zmenené pole | `{ id, described: true }` a zmenené polia (`customData` celé) |
| bez základu, alebo základ bez `described` | celý, ako pred krokom |
| žiadny riadok nemá čo poslať | žiadna požiadavka |

### Čo dostane používateľ, keď uloženie nemá čo poslať (na kontrolu posudku)

- **Žiadny riadok nemá formulár** (pred krokom aj teraz, bez zmeny): „Uložiť" aj „Uložiť a ukončiť" sú vypnuté
  (`nothingToSave`: `AssetFooterSelectedFull.vue:58,170,180`, `AssetFooterUploadOverlayFull.vue:67,174,186`). Keby
  sa funkcia zavolala, odmietne (`assetApi: no metadata to save`) a používateľ dostane všeobecnú systémovú chybu.
- **Riadky formulár majú a nič sa v nich nezmenilo** (nový prípad „nič na poslanie"): pred krokom išla požiadavka
  so všetkými riadkami celými a po odpovedi 200 úspešná vetva. Teraz požiadavka nejde a úspešná vetva prebehne
  rovnako:
  - upozornenie „Záznam bol upravený" (`showRecordWas('updated')`);
  - prekrytie uploadu, „Uložiť": zoznam assetov sa číta znova, fronta aj prekrytie ostanú;
  - prekrytie uploadu, „Uložiť a ukončiť": fronta sa zastaví a vyprázdni, prekrytie sa skryje, zoznam sa číta;
  - hromadná úprava, „Uložiť": výber ostáva; asset v sklade detailu sa číta znova, ak bol medzi riadkami s
    formulárom (ako doteraz, aj keď sa jeho riadok neposlal);
  - hromadná úprava, „Uložiť a ukončiť": fronta sa vyprázdni, assety sa v zozname odznačia, prekrytie sa skryje.
- Validácia riadkov pred uložením beží rovnako a pri neplatnom riadku uloženie zastaví ako doteraz.

### Testy

`src/test/queue/bulkSaveChanges.test.ts` (30 prípadov, predtým 21; assety na falošnom serveri majú príznak
`described`):
- nedotknutý riadok popísaného assetu nie je v žiadnej požiadavke; fronta len takých riadkov nepošle nič a
  uloženie skončí úspechom; nedotknutý riadok nepopísaného assetu ide raz ako `{ id, described: true }` a druhé
  uloženie nepošle nič;
- po zlyhanom uložení ide znova zmenený riadok aj nedotknutý nepopísaný;
- po desať sa počítajú poslané riadky: 12 zmenených z 23 ide ako 10 a 2; všetky zmenené ako 10, 10, 3; po zlyhanej
  druhej dávke ďalšie uloženie pošle len 13 neuložených (10, 3);
- chyba validácie sa pomenuje podľa riadku, ktorý bol na danom mieste požiadavky, keď riadky pred ním neodišli;
- riadok, o ktorého assete server nepovedal, či je popísaný, ide celý;
- uloženie z detailu či panela dá základu `described: true`; tlačidlo obnoviť pri popísanom assete nepošle nič,
  pri nepopísanom `{ id, described: true }`;
- **odobratie a nové označenie assetu** (dve čítania toho istého riadku, staršie odpovie prvé): nedotknutý riadok
  prevezme novšiu odpoveď a uloženie potom nepošle nič (základ je novší); riadok, do ktorého sa medzitým písalo,
  si napísané nechá a uloženie to pošle.

`src/test/queue/lazyMetadata.test.ts` (+1): riadok s formulárom od notifikácie, do ktorého sa nič nenapísalo,
prevezme odpoveď svojej dávky. Tri prípady z OP-D1 (napísané ostáva) prechádzajú bez zmeny.

`src/test/queue/overlaySave.test.ts` (+4, 1 upravený):
- prepísaný prípad hromadnej úpravy má tri assety: zmenený (ide so zmenou), nedotknutý nepopísaný
  (`{ id, described: true }`), nedotknutý popísaný (nejde);
- nič na poslanie, cez tlačidlá: prekrytie uploadu „Uložiť" (upozornenie, zoznam sa číta, žiadny `PATCH`) a
  „Uložiť a ukončiť" (fronta prázdna, prekrytie skryté, zoznam sa číta, žiadny `PATCH`); hromadná úprava „Uložiť"
  (upozornenie, výber ostáva, žiadny `PATCH`) a „Uložiť a ukončiť" (fronta prázdna, odznačené, skryté, žiadny
  `PATCH`).

**Na kóde zo snímku `OP-D2-c1`** (kód OP-D2; `assetApi.ts`, `uploadQueuesStore.ts`, `queueRowBaseline.ts`): 19 zo
115 červených v troch súboroch.

**Ohnutia**, každé zvlášť nad tromi súbormi (115 prípadov; `scratchpad/opd2c1-bend-run.sh`, výsledky
`scratchpad/opd2c1-*-run.txt`):

| Ohnutie | Červené |
|---|---|
| nedotknutý popísaný riadok sa pošle | 17 |
| nedotknutý nepopísaný riadok sa vynechá | 12 |
| základ bez `described` sa neberie ako „celý" | 1 (server nepovedal, či je popísaný) |
| po uložení základ nemá `described: true` | 4 |
| bez riadkov na poslanie funkcia odmietne | 12 (aj štyri prípady tlačidiel) |
| chyba validácie podľa miesta vo fronte | 1 |
| po uložení z detailu príznak z objektu assetu | 3 |
| holá podmienka `canEditMetadata` (stav OP-D1) | 2 (novšia odpoveď; nedotknutý riadok od notifikácie) |
| odpoveď dávky sa prevezme vždy | 2 (napísané po staršej odpovedi; napísané po notifikácii) |
| príznak assetu sa ignoruje (`described: true`) | 13 |

`oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. **CK-DAM OP-D2-c1**
(`krok5-praca/vysledky/OP-D2-c1-ck.log`) zelené: 75 súborov / 1 341 testov (po OP-D3 1 327, +14), všetko čisté
vrátane buildu. **Záplata** `zaplata.sh OP-D2-c1`: `krok5-praca/zaplaty/OP-D2-c1.diff` (845 riadkov, 7 súborov);
mimo `src` len `doc/changelog/3.0.0.md` (položka OP-D2 prepísaná, veta o FE-13 spresnená).

Zmenené súbory v cykle: `assetApi.ts`, `uploadQueuesStore.ts`, `queueRowBaseline.ts`, `bulkSaveChanges.test.ts`,
`lazyMetadata.test.ts`, `overlaySave.test.ts`, `doc/changelog/3.0.0.md`.

### Známe obmedzenia (prijaté vedúcim, body A a C z hlásenia kroku)

- **A. Server nekontroluje povinné pole, ktoré mu neprišlo.** Riadok, ktorý sa neposiela, a pole, ktoré v položke
  chýba, backend nevaliduje (`AssetValidator.php:35-39, :47-51`; `CustomDataValidator.php:51-53`). Povinné
  kľúčové slová, autorov a vlastné polia nedotknutého riadku tak stráži len validácia riadku v prehliadači, ktorá
  pred uložením beží ako doteraz. Pred krokom bola kontrola servera druhou poistkou pre každý riadok.
- **C. Základ po uložení je to, čo sa poslalo, nie to, čo server uložil.** Odpoveď uloženia sa nečíta (ako pred
  krokom). Backend môže poslaných autorov zameniť za „aktuálnych" (`AssetMetadataBulkManager.php:65`); riadok aj
  základ potom držia poslaných a ďalšie uloženie ich znova nepošle.

### Nález pre backend (pre vedúceho, neopravené)

**`isAssetChanged` počíta neposlané `customData` a `authors` ako zmenu.**
`B/Domain/AssetMetadata/AssetMetadataBulkFacade.php:82-89`: položka bez `customData`, keď asset nejaké má (`:84`),
alebo bez `authors`, keď asset nejakých má (`:86`), vráti „zmenené". Správca pritom neposlané pole len preskočí
(`AssetMetadataBulkManager.php:45, :57, :122`), takže sa na assete nič nezmenilo. Asset ide do
`AssetChangedEvent` (`:69-73`), ktorý majú traja odberatelia:
- core-dam `src/Event/Listener/AssetChangedEventListener.php:22-27` → `AssetChangedMessage` →
  `src/Messenger/Handler/AssetChangedMessageHandler.php:21-29` → `ExtSystemCallbackFacade::notifyAssetsChanged`
  (`B/Domain/ExtSystem/ExtSystemCallbackFacade.php:74-102`), teda volania CMS pre audio a video a pre obrázky
  (`src/Domain/ExtSystem/AbstractExtSystemCallback.php:50`);
- core-dam `src/Event/Listener/TtsEpisodePublishListener.php:20-30`: znova publikuje epizódy TTS assetu;
- bundle `B/Event/Subscriber/AssetInternalRuleSubscriber.php:26-34`: znova vyhodnotí interné pravidlá súborov.

Čiastočné položky pritom posiela už dnes knižnica: `updateAssetAuthors`
(`common-admin/src/domains/dam/api/damAssetApi.ts:326-335`, položka `{ id, authors, described: true }` bez
`customData`), volaná z `ImageWidgetInner.vue:599` a `ImageMediaWidgetInner.vue:742`. Pre asset s vlastnými dátami
teda každé také uloženie autorov ohlási zmenu, aj keď sa autori nezmenili. Po cykle 1 posiela admin-dam čiastočnú
položku len pre riadok, v ktorom sa naozaj niečo zmenilo, a raz pre nepopísaný asset.

### Nové nálezy z cyklu (neopravené, čísla pridelí vedúci)

- **(Codex, mimo záplaty) `failStillLoading` po odobratí a novom označení.** Keď staršia dávka naplní nový riadok
  a novšia dávka asset vynechá alebo zlyhá, `failStillLoading` riadok preskočí, lebo už nie je `Loading`; formulár
  zo staršej odpovede ostane. Staršie než OP-D1.
- **Staršia odpoveď po novšej (opravené v cykle 2).** Pravidlo cyklu nerozlišuje, ktorá dávka je novšia: nedotknutý riadok prevezme
  odpoveď, ktorá príde neskôr. Keď novšia dávka odpovie prvá a staršia po nej, nedotknutý riadok dostane staršie
  hodnoty aj starší základ (ako pred OP-D1, kde vyhrala posledná odpoveď; OP-D1 to načas otočil na prvú). Úplná
  oprava by potrebovala poradie dávok na riadku. Škoda je po OP-D2 malá: uloženie pošle len polia, ktoré
  používateľ zmenil.

## Cyklus 2 (OP-D-c2, spoločný s OP-D3; posudky Codex + Opus nad OP-D2 s cyklom 1)

Posudky: žiadna prekážka; čiastočné položky backendom prejdú. Päť bodov k OP-D2, jeden spoločný snímok
**`OP-D-c2`** (`doc/changelog/3.0.0.md` v ňom), jedna záplata a jedna CK s bodmi OP-D3 (`OP-D3.md`, „Cyklus 1").

### 1. Poradie čítaní a uložení (Codex vysoké, Opus nízke až stredné, a vlastný nález z cyklu 1)

**Chyba.** Po uložení sa riadok rovná svojmu novému základu. Dávka čítania, ktorá bola ODOSLANÁ pred tým uložením
a odpovedala až po ňom, preto podľa pravidla cyklu 1 („riadok nikto nezmenil") nahradila hodnoty riadku aj základ
stavom spred uloženia. Ďalšia úprava vlastného poľa potom poslala staré `customData` celé a uloženie na serveri
vrátila.

**Oprava.** Čítania a uloženia majú poradie (počítadlo v `queueRowBaseline.ts`, `nextMetadataOrder`):
- dávka čítania si vezme miesto, keď sa ODOSIELA (`fetchLazyAdditionalMetadata`, pred požiadavkou);
- základ si pamätá miesto toho, čo ho zapísalo: dávka to, kedy bola odoslaná; načítanie knižnicou
  (`onAssetRead`) to, kedy dopadlo; uloženie to, kedy naň prišla odpoveď;
- odpoveď dávky sa na riadok s formulárom použije, len keď je dávka MLADŠIA než základ riadku A ZÁROVEŇ sa
  riadok svojmu základu stále rovná (`queueRowTakesAnswer`). Riadok bez formulára sa plní ako doteraz; riadok s
  formulárom bez základu si hodnoty nechá ako doteraz.

**Odchýlka od zadania, vedome:** zadanie hovorí, že uloženie (hromadné aj z detailu či panela) má miesto, „keď
začalo". Dal som mu miesto, **keď naň prišla odpoveď**. Dôvod: dávka odoslaná, kým je uloženie na ceste, mohla
server čítať ešte pred zápisom uloženia; s miestom „pri začiatku" by bola mladšia než základ a jej odpoveď spred
uloženia by riadok nahradila, čo je tá istá chyba. S miestom „pri odpovedi" je staršia a odmietne sa. Opačné
riziko (odmietne sa odpoveď, ktorá uloženie už obsahovala) nič nepokazí: riadok drží uložené hodnoty. Navyše
uloženie z detailu a panela tak nepotrebuje zmenu v dvoch paneloch (sklad sa volá až po odpovedi). Ak má platiť
znenie zadania, je to presun jedného riadku v `assetApi.ts` a odovzdanie miesta z dvoch panelov.

**Dôsledok pre cyklus 1:** riadok s formulárom od notifikácie už odpoveď svojej dávky neprevezme ani nedotknutý,
lebo dávka bola odoslaná skôr, než čítanie notifikácie dopadlo. Prípad z cyklu 1 v `lazyMetadata.test.ts` je
preto otočený (nižšie). Odobratie a nové označenie assetu prevezme novšiu odpoveď ďalej.

### 2. Spoločný objekt (Opus nízke)

`updateAssetMetadata` skladu dávala každému riadku assetu vo všetkých frontách TEN ISTÝ objekt `customData` (aj
zoznamy). Hromadná operácia vlastného poľa píše do `customData` riadkov svojej fronty na mieste
(knižnica, `uploadQueueFill`), takže zmenila aj riadok v druhom prekrytí, ktorý sa potom líšil od základu, hoci
sa ho tam nikto nedotkol. **Oprava:** každý riadok dostane vlastné kópie (`cloneDeep`).

### 3. Dokumenty (Opus nízke)

„Nič viditeľné" neplatilo presne. Časť „Čo sa mení pre používateľa" vyššie a položka changelogu hovoria, že
neposlaný riadok backend nezapíše: asset nedostane nového upravovateľa ani čas úpravy a neindexuje sa znova.

### 4. Test (Opus nízke)

„sends %s again after a save that failed" znova pripína očakávané telo oboch požiadaviek (zmenený riadok:
`{ id, described, keywords }`; nedotknutý nepopísaný: `{ id, described }`), nielen ich zhodu.

### Testy

`src/test/queue/bulkSaveChanges.test.ts` (36 prípadov, predtým 30). Prípady poradia tvrdia hodnoty riadku
(`keywords`, `customData`) AJ základ (čítaný z modulu `queueRowBaseline`), nielen stav:
- dve čítania toho istého riadku (odobratie a nové označenie):
  - staršie odpovie prvé, nikto riadok nezmenil: prevezme novšiu odpoveď;
  - novšie odpovie prvé, staršie po ňom: ostáva novšia odpoveď;
  - napísané po staršej odpovedi ostáva a pošle sa;
  - **napísané a uložené medzi dvoma odpoveďami:** ostáva uložené; ďalšia úprava iného vlastného poľa pošle
    `customData` s uloženým titulom, nie s titulom neskorej odpovede;
  - uloženie z detailu či panela medzi dvoma odpoveďami: ostáva uložené;
- formulár od notifikácie, kým je čítanie výberu na ceste: neskorá odpoveď čítania riadok nezmení, nedotknutý
  ani napísaný a uložený;
- jeden asset v riadku fronty uploadu aj hromadnej úpravy: hromadná operácia v jednej fronte nezmení riadok v
  druhej a uloženie druhej fronty nič nepošle.

`src/test/queue/lazyMetadata.test.ts`: **otočený prípad s dôvodom.** Prípad z cyklu 1 „takes what its batch
answers with when nothing was changed in the form the metadata notification gave it" je teraz „keeps what the
metadata notification read when its batch, sent before that, answers with the asset after it". Dôvod je bod 1:
dávka bola odoslaná pred čítaním notifikácie, jej odpoveď je staršia.

**Na kóde zo snímku `OP-D-c2`:** 8 zo 129 červených (šesť prípadov poradia, spoločný objekt, text koša z OP-D3).

**Ohnutia** (`scratchpad/opdc2-bend-run.sh`, každé zvlášť nad piatimi súbormi, 129 prípadov):

| Ohnutie | Červené |
|---|---|
| poradie sa neberie do úvahy (pravidlo cyklu 1) | 6 |
| len poradie, bez „riadok sa rovná základu" | 1 (napísané po staršej odpovedi) |
| hromadné uloženie si miesto nevezme | 2 (uložené medzi odpoveďami; uložené po notifikácii) |
| dávka si miesto vezme až pri odpovedi | 6 |
| načítanie knižnicou si miesto nevezme | 2 (notifikácia a neskorá dávka, oba súbory) |
| uloženie z detailu si miesto nevezme | 1 |
| riadky dostanú spoločný objekt | 1 |

`oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. **CK-DAM OP-D-c2**
(`krok5-praca/vysledky/OP-D-c2-ck.log`) zelené: 76 súborov / 1 355 testov (po OP-D1-c1 1 346, +9), všetko čisté
vrátane buildu. **Záplata** `zaplata.sh OP-D-c2`: `krok5-praca/zaplaty/OP-D-c2.diff` (769 riadkov, 11 súborov,
spoločná s OP-D3); mimo `src` len `doc/changelog/3.0.0.md`.

Zmenené súbory k OP-D2 v cykle: `assetApi.ts`, `uploadQueuesStore.ts`, `queueRowBaseline.ts`,
`bulkSaveChanges.test.ts`, `lazyMetadata.test.ts`, `doc/changelog/3.0.0.md`.

### Nové nálezy z posudkov (neopravené, čísla pridelí vedúci)

- **(b) Dávka vráti formulár riadku, ktorého súbor medzi dvoma čítaniami zlyhal alebo sa stal duplikátom.**
  Bežná vetva `fetchLazyAdditionalMetadata` nastaví `Uploaded` a `canEditMetadata = true` každému riadku bez
  formulára, chybu riadku pritom zmaže len pre riadky v `metadataFailures`. Taký riadok potom ide do hromadného
  uloženia.
- **(c) Backend: kľúčové slová nie sú v `isAssetChanged` vôbec** (`AssetMetadataBulkFacade.php:82-89`). Zmena len
  kľúčových slov sa ohlási, len keď má asset náhodou vlastné dáta alebo autorov (cez vetvy „neprišlo").

## Cyklus 3 (OP-D-c3; posudky Codex + Opus nad `zaplaty/OP-D-c2.diff`)

Posudky: odchýlka z cyklu 2 (uloženie má miesto, keď naň prišla odpoveď) je prijatá, Opus poradia prešiel; body 2
až 6 cyklu 2 potvrdené. Ostali tri veci. Snímok **`OP-D-c3`** (`doc/changelog/3.0.0.md` v ňom).

### 1. Riadok BEZ formulára sa na poradie nepýtal (Opus, nízke až stredné)

**Chyba.** Uloženie z detailu alebo panela zapíše hodnoty aj základ do každého riadku assetu, aj do riadku, ktorý
sa ešte načítava. Keď naň odpoveď prišla, kým bola dávka toho riadku na ceste, odpoveď dávky (možno prečítaná
pred uložením) nahradila uložené hodnoty a vrátila základ späť: riadok bez formulára sa plnil vždy.

**Oprava** (`uploadQueuesStore.ts`, bežná vetva; `queueRowBaseline.ts`, `queueRowGivenSince`): riadok, ktorého
základ je mladší než dávka, si hodnoty aj základ nechá a dostane len formulár a stav, či formulár mal, alebo nie.
Konflikty autorov z takej staršej odpovede sa do riadku nezapíšu (sú spred uloženia). Riadok bez základu alebo so
starším základom sa plní ako doteraz.

**Test cez skutočnú cestu** (`bulkSaveChanges.test.ts`, blok „an asset saved from the panel of the list while its
mass-edit row is still loading", 2 prípady): skutočný zoznam dlaždíc a skutočný pravý panel. Klik otvorí prvý
asset v paneli, do titulu sa napíše, Shift+klik na druhú dlaždicu vyberie rozsah s otvoreným assetom (jedna
dávka čítania, drží sa), panel uloží. Tvrdí sa hodnota riadku aj základ (`customData` uložené z panela), že
druhý riadok rozsahu je z čítania, a že hromadné uloženie potom nepošle nič.
- Poradie „dávka odoslaná pred začiatkom uloženia".
- Poradie „uloženie začalo, potom odišla dávka, potom prišla odpoveď uloženia, potom odpoveď dávky". **Tu je
  vidno umiestnenie „pri odpovedi, nie pri začiatku":** ohnutie, v ktorom si uloženie vezme miesto pri začiatku
  (panel odovzdá miesto skladu), dá práve tento jeden prípad červený.

Poučenie z prvého behu dôkazov: falošný server vracia ten istý objekt assetu pri každom čítaní a detail doň píše,
takže „stav spred uloženia" v odpovedi dávky bol v skutočnosti prepísaný panelom a prípady prechádzali aj na
starom kóde. V tomto bloku testu sa odpoveď dávky skladá nanovo (vlastná obsluha testu); až potom dôkazy sedia
(nižšie). Sám falošný server (`fakeDam.ts`) sa v tomto cykle nemenil a uložený objekt vracal ďalej: to opravil až
cyklus 4.

### 2. Čo hromadné uloženie zapíše ako základ pri odpovedi (Opus; rovnaký koreň ako „prekrývajúce sa uloženia" Codexu)

**Chyba.** Pri odpovedi sa zapísala kópia všetkých štyroch polí z okamihu kliku. Ak sa základ riadku medzitým
posunul (nedotknutý riadok prevzal druhú dávku; uloženie z detailu prišlo skôr), staršia kópia novší základ
nahradila a ďalšie uloženie poslalo polia, ktoré nikto nezmenil.

**Oprava** (`assetApi.ts`): pri odpovedi sa cez základ, aký riadok v tom okamihu má, zapíšu len ODOSLANÉ polia a
`described: true`. Riadok bez základu (išiel celý) dostane kópiu z kliku ako doteraz.

**Testy** (`bulkSaveChanges.test.ts`, 2 prípady):
- nedotknutý riadok nepopísaného assetu prevezme druhú dávku, kým je jeho uloženie `{ id, described }` na ceste:
  hodnoty aj základ sú z novšej dávky a ďalšie uloženie nepošle nič;
- uloženie z detailu príde, kým je hromadné uloženie toho istého riadku na ceste: základ drží hodnoty z detailu
  a odoslané kľúčové slová, ďalšie hromadné uloženie nepošle nič.

### 3. Drobnosti

- Changelog (`3.0.0.md`, veta o riadku s formulárom od notifikácie) ešte hovoril pravidlo cyklu 1 („a row nobody
  changed takes the answer of the read"), ktoré cyklus 2 otočil. Opravené; pribudla veta o poradí čítaní a
  uložení.
- `iconButtonTooltips.test.ts`: pozri `OP-D3.md`, „Cyklus 2".

### Dôkazy, CK, záplata

**Na kóde zo snímku `OP-D-c3`** (`assetApi.ts`, `uploadQueuesStore.ts`, `queueRowBaseline.ts`): 4 z 205 červené
(oba prípady panela, oba prípady bodu 2).

**Ohnutia** (`scratchpad/opdc3-bend-run.sh`, každé zvlášť nad piatimi súbormi, 205 prípadov):

| Ohnutie | Červené |
|---|---|
| riadok bez formulára sa na poradie nepýta | 2 (oba prípady panela) |
| uloženie z panela má miesto pri začiatku | 1 (dávka odoslaná počas uloženia) |
| pri odpovedi sa zapíše kópia z kliku | 2 (oba prípady bodu 2) |
| odoslané polia sa do základu nezapíšu | 4 |
| aktivátor bubliny: stačí akýkoľvek holý `v-bind` | 1 (test bublín) |

`oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. **CK-DAM OP-D-c3**
(`krok5-praca/vysledky/OP-D-c3-ck.log`) zelené: 76 súborov / 1 360 testov (po OP-D-c2 1 355, +5), všetko čisté
vrátane buildu. **Záplata** `zaplata.sh OP-D-c3`: `krok5-praca/zaplaty/OP-D-c3.diff` (408 riadkov, 6 súborov:
`assetApi.ts`, `uploadQueuesStore.ts`, `queueRowBaseline.ts`, `bulkSaveChanges.test.ts`,
`iconButtonTooltips.test.ts`, `doc/changelog/3.0.0.md`); mimo `src` len changelog.

### Známe obmedzenia (prijaté vedúcim, neopravujú sa)

- **(a) Dávka odoslaná, kým je uloženie na ceste, sa odmietne**, aj keby náhodou prečítala novší stav, ktorý po
  uložení zapísal iný redaktor. Riadok si nechá, čo mal, ako každý riadok načítaný pred zmenou iného redaktora.
- **(b) Asset odznačený a znova vybraný, kým je hromadné uloženie na ceste,** dostane nový riadok bez formulára aj
  bez základu. Ten prevezme svoju dávku, aj keď bola prečítaná pred uložením.
- **(c) `customData` idú celé, keď sa zmení jeden kľúč** (backend ich nahrádza), takže dva riadky toho istého
  assetu si môžu navzájom vrátiť vlastné polia.
- **(d) Telá hromadného uloženia sú dané pri kliku.** Uloženie z detailu alebo panela, na ktoré príde odpoveď, kým
  je skoršia požiadavka po desať na ceste, prepíše neskoršia požiadavka toho riadku; ako pred krokom, teraz už
  len v zmenených poliach.
- **(e) Keď sa hromadné uloženie a uloženie z detailu toho istého assetu na serveri skrížia,** môže základ menovať
  hodnotu, ktorú server už nemá; ďalšie uloženie potom pošle ešte raz to, čo riadok ukazuje.

## Cyklus 4 (OP-D-c4, len podpora testov; pokyn vedúceho po posudku cyklu 3)

**Oprava vlastného hlásenia.** V správe o cykle 3 som napísal, že falošný server skladá odpovede nanovo pri každom
čítaní. Nebola to pravda: `src/test/support/fakeDam.ts` sa v cykle 3 nemenil a ďalej vracal uložený objekt
assetu. Nanovo sa skladala len odpoveď dávky v novom bloku panela, cez vlastnú obsluhu toho testu. Pasca, pre
ktorú dva prípady panela prešli aj na starom kóde, tak ostala nastražená pre každý iný test, ktorý číta asset po
tom, čo doň detail, panel alebo hromadná operácia na mieste zapísali.

Snímok **`OP-D-c4`** (mimo `src` nič).

1. **Zmena** (`src/test/support/fakeDam.ts`): predvolené obsluhy čítania assetu (`GET /adm/v1/asset/{id}` a
   `GET /adm/v1/asset/licence/{licencia}/ids/{ids}`) odpovedajú pri každom čítaní kópiou uloženého assetu
   (`structuredClone`), aj keď asset dáva funkcia (`assetBy`). Produkčný kód sa nemenil.
2. **Celá sada po zmene** (cez `tezky.sh`): **0 červených**, 76 súborov / 1 360 testov. Žiadny test sa teda o
   spoločný objekt neopieral tak, aby mu zmena zmenila výsledok, a nenašlo sa nič, v čom by aplikácia závisela od
   toho, že objekt servera je spoločný. Nebolo čo opravovať ani hlásiť.
3. **Nový test** `src/test/support/fakeDam.test.ts` (2 prípady) drží to pravidlo: čo sa zapíše do jednej odpovede,
   nie je v ďalšej (jedno čítanie; čítanie viacerých; asset daný funkciou). S `fakeDam.ts` zo snímku `OP-D-c4` sú
   oba červené.
4. **Navyše, len v pamäti a bez zmeny v strome:** to isté pre čítanie súborov a zoznamu slotov (kópia pri každom
   čítaní) nad celou sadou tiež nedalo žiadny červený prípad. Tie obsluhy ďalej vracajú uložený objekt; rozšíriť
   ich je vec troch riadkov, ak to vedúci chce.

`oxfmt`, `oxlint` 0. **CK-DAM-T OP-D-c4** (`krok5-praca/vysledky/OP-D-c4-ck.log`, úroveň `T`: testy, `lint:tsc`,
`format:check`, `lint:oxlint`, `lint:eslint`) zelené: 77 súborov / 1 362 testov (po OP-D-c3 1 360, +2).
**Záplata** `zaplata.sh OP-D-c4`: `krok5-praca/zaplaty/OP-D-c4.diff` (2 súbory: `fakeDam.ts`, `fakeDam.test.ts`);
mimo `src` nič.

