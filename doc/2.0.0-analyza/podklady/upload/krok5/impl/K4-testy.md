# K4-testy: testy jadra fronty a hromadných operácií (testy-lib, meno `testy-lib`)

Plán 2.3 „K4", 3.6, 4.3 „testy-lib, testy-dam"; návrh jadra 2.4 (pravidlá 1 až 9), 2.5, 4.2 („K4, jadro", „K4,
hromadné operácie"). Strom LIB `/home/volar/projects/anzusystems/common-admin` (krok K4 otvorený; snímok `K4` urobil
impl-jadro-lib). Moje súbory sú len dva nové súbory testov; kód implementátora som nemenil. Mimo `src` nič.

## Podkroky

1. Začiatok po správe impl-jadro-lib „snímok K4 hotový". Testy písané z návrhu (2.4, 2.5, 4.2), až potom porovnané
   s menami kódu implementátora (`uploadQueueCore.ts`, `uploadQueueCoreTypes.ts`, `uploadQueueFill.ts`,
   `presets/queuePresets.ts`); mená a podpisy sedeli s návrhom, nič som neprispôsoboval.
2. **Cielené behy** (cez `tezky.sh`, `--retry=0`, TMPDIR `…/common-admin/node_modules/.cache/vitest-tmp-testy-lib`):
   prvý beh 63 / 63 zelených; po úprave zlyhania knižnice (bod 4) a novom prípade prepočtu (bod 5) **65 / 65
   zelených**, štyri behy po sebe.
3. **Okraj, ktorý je podvrhnutý** (plán 4.3): HTTP (falošný DAM `createFakeDam` pre behy sady knižnice, ktorá ide
   vždy cez skutočný `useUpload`), čas (`manualScheduler` v `uploadSettlementRuntime`; pri zlyhaní kúska knižnice
   na chvíľu `holdLongWaits` s `passFrom: 1_000`, aby pauzy medzi pokusmi prešli hneď), čitatelia profilu
   usadzovania (`fakeDamServer` z `settlementFixtures`). Sada admin-dam dostáva od „skladu" vstupy, ktoré sú aplikácie
   (`upload`, `importRun`, `failureMessage`, `alert`, `rowTracked`, `rowRemoved`): to sú behy a háky, ktoré test
   riadi a zapisuje; `adminDamImportRun` je skutočná funkcia knižnice. Žiadny `vi.mock`. Identifikátory z riadkov
   (`row.fileId`, `row.assetId`), nie z poradia štartov.
4. **Zlyhanie behu knižnice pred dokončením:** prvá verzia odpovedala kúsku 422, a to je aj odmietnutie (4xx), takže
   prípad „pred dokončením" nedokazoval podmienku `finishAttempted` (ohnutie ju vyhodilo a prípad knižnice ostal
   zelený). Teraz každý zo štyroch pokusov kúska dostane 503 (nie odmietnutie) a beh vzdá pred dokončením.
5. Nový prípad „counts a row the server settles once its file is sent": prepočet za hákom `onRowFinal` (2.4,
   pravidlo 8).
6. `oxfmt --check`, `oxlint` čisté; `eslint` (cez `tezky.sh`) 0; `lint:tsc` (cez `tezky.sh`) kód 0.

## Súbory (2 nové, v `src`, len testy)

- `src/domains/dam/uploadQueue/core/__tests__/uploadQueueCore.test.ts` (28 prípadov × 2 sady, spolu 56): pod
  `libraryQueuePreset` aj `adminDamQueuePreset`:
  - fronty: dva riadky naraz na frontu, druhá fronta nezávisle, ďalší riadok po odoslaní; počty po pridaní;
    `uniqueKey` rôzne kľúče s predponou; `addQueueItem` a `recalculateQueueCounts` nad frontou, ktorá nie je, nič
    (Z13); `clearQueue` vytvorí aj frontu, ktorá nebola, kľúč vstupu o jeden vyšší (Z19);
  - beh: `runnerFor` (knižnica: aj riadok externého poskytovateľa ide uploadom knižnice; admin-dam: import pre
    `ExternalProviderAsset`, upload inak); admin-dam priebeh behu do riadku (`setUploadSpeed`); úspech → riadok
    `Processing` sa pýta servera (a v admin-dam `rowTracked`); prepočet po usadení (`onRowFinal`); riadok usadený
    počas posielania sa po úspechu nesleduje; zlyhanie: `Failed`, formulár preč, počet, ďalší riadok; knižnica bez
    háku nezapíše text; admin-dam text sa pýta pred zápisom (riadok ešte `Uploading`, bez textu), upozornenie až po
    označení; jedno upozornenie na dôvod vo fronte; po zlyhaní s dokončením sa riadok pýta, „Obnoviť" len knižnica
    (`refreshMayHelp`); nie pred dokončením, nie pri odmietnutom dokončení, nie pri riadku zlyhanom serverom; beh
    zlyhá pri `Stop` (Z15) a pri `Uploaded` (Z16): nič;
  - riadok von (pravidlo 5): `removeByIndex` nič bez fronty a riadku; riadok na ceste `Stop`, beh aj kúsok zastavený,
    ďalší riadok hneď (Z15); čakajúci `Stop`; čakajúci na server `Stop` a už sa nepýta; usadený bez behu ostane;
    usadený so živým behom `Stop` a beh zastavený (Z17); `stopItemUpload` nič bez fronty a pri prázdnej, inak podľa
    identity a synchrónne (Z18); `stopUpload` nič bez fronty, prázdna ostane, inak všetko `Stop`, behy a kúsky
    zastavené, fronta prázdna, kľúč vstupu +2 (vyčistenie a nový vstup); `clearQueue`: na ceste a so živým behom
    `Stop`, usadený ostane, kľúč +1; `rowRemoved` pri každom odstránení (admin-dam).
- `src/domains/dam/uploadQueue/core/__tests__/uploadQueueFill.test.ts` (9 prípadov): vlastné pole (prázdne hodnoty
  `undefined`, `null`, `''`, `[]`; ponechanie; nahradenie len v type), kľúčové slová a autori (`describe.each`:
  prázdne a chýbajúce sa doplnia, plné ostanú, nahradenie, prázdny výber vyprázdni, `accepts` aj pri nahradení),
  holý riadok so štyrmi poliami dostane všetky tri a nič iné.

Počet: +2 súbory, +65 testov oproti stavu pred K4 (CK spúšťa implementátor so slotom).

## Ohnutia v pamäti (dôkaz, že prípady vedia zlyhať)

Konfigurácia `…/common-admin/node_modules/.cache/vitest-tmp-testy-lib/vitest.k4.config.mts` (ako `vitest.u0l`:
skutočná konfigurácia, `root` = strom, plugin `load` nahradí presný text, ktorý musí byť v module práve raz); súbory
`k4-*.json`; beh cez `tezky.sh`. Na disku sa neohol ani jeden riadok. Kód implementátora ako bol o 21:02.

- `k4-g1` (jadro, 54 prípadov pred bodom 5): **17 červených** = očakávaných 16 a jeden navyše, vysvetlený:
  track aj bez `Processing` (usadený počas posielania × 2); bez `isRefusal` (odmietnuté dokončenie × 2); bez návratu
  pri `Stop` (zastavený × 2, **a navyše knižnica „by itself …": zrušený beh prvého odstráneného riadku ho potom
  označí `Failed`**, teda to isté pravidlo); bez stráže riadku v `removeByIndex` (× 2); `addQueueItem` vytvorí frontu
  (× 2); `stopRun` bez zrušenia kúska (admin-dam × 4); `refreshable: true` v admin-dam (1); import ako upload (1).
- `k4-g2`: **13 červených** (presne): bez `finishAttempted` (pred dokončením × 2, po bode 4); bez návratu pri
  `Uploaded` (× 2); knižnica zapíše text (1); upozornenie pred označením (1); usadený riadok sa zastaví (× 4); bez
  stráže prázdnej fronty v `stopItemUpload` (× 2); bez „už ohlásené" (1).
- `k4-g3`: **11 červených** (presne): bez `failedByServer` (× 2); text sa pýta až po zápise (1); živý beh sa
  nerozozná (× 2); prázdna fronta v `stopUpload` sa vyčistí (× 2); `removeByIndex` bez `processUpload` (× 4: na
  ceste, a „by itself" čaká na štart tretieho riadku).
- `k4-g4`: bez prepočtu za `onRowFinal`: **2 červené** (nový prípad × 2).
- `k4-gf1` (hromadné operácie, 9): **5 červených** (presne): prázdnota vlastného poľa vždy pravda (1); kľúčové slová
  bez kontroly prázdnoty (× 2); autori bez `accepts` a s poľom navyše (`accepts` 1, holý riadok 1).
- `k4-gf2`: bez kontroly typu vlastného poľa: **1 červený** (presne).

## Odchýlky a poznámky

1. Návrh 4.2 hovorí „okamžitý plánovač"; použil som manuálny (`manualScheduler`), lebo bez tikov by sa nedalo
   pozorovať, či sa riadok pýta servera; je to ten istý okraj (čas usadzovania).
2. Sada knižnice nemá „falošný beh": jej `runnerFor` je vždy `useUpload` knižnice, takže beh ide cez skutočnú službu
   a falošné HTTP (kúsky zadržané). Zastavenie behu a zrušenie kúska sa v nej nedá rozlíšiť (obe zrušia ten istý
   kúsok); v admin-dam sa tvrdia oddelene.
3. `stopUpload` zvýši kľúč vstupu o 2 (`clearQueue` +1 a `forceReloadFileInput` +1), ako dnes v knižnici aj podľa
   návrhu; test to tvrdí.
4. Prípad riadku zlyhaného serverom tvrdil v prvej verzii len „nesleduje sa"; od cyklu 1 pripína aj dnešný text
   a upozornenie (oprava F4 ich zmení a prípad upraví, Z26).
5. Rovnaká hodnota poľa pre všetky riadky (Z24, F2) sa v testoch hromadných operácií nepripína.

## Cyklus 1 (posudky `impl/posudky/K4-c1-codex.md` a Opus; v kóde jadra bez chyby)

Snímok `K4-c1` (`snimok.sh /home/volar/projects/anzusystems/common-admin K4-c1`, kód 0) pred úpravou; kód
impl-jadro-lib som nemenil. Zmenený len `uploadQueueCore.test.ts`:

1. (Codex stredné) Riadok zlyhaný serverom počas posielania: okrem „nesleduje sa" pripína dnešný konečný stav pre
   každú sadu: knižnica `error` `{ hasError: true, message: '', assetFileFailReason: InvalidMimeType }` a žiadne
   upozornenie; admin-dam text skladu „the upload failed" namiesto prázdneho, dôvod servera ostane, jedno
   upozornenie. Komentár hovorí, že F4 to zmení (Z26).
2. (Codex nízke) Jedno počítadlo kľúčov na stránku (Z22): prípad kľúčov pridá druhé jadro (sada knižnice) a tvrdí
   šesť rôznych kľúčov naprieč oboma jadrami.
3. (Opus nízke) Účinok `untrack`: nový prípad „by its position: a failed row the server may still finish is let go
   by the settlement" (oba sady): riadok zlyhaný po dokončení je sledovaný (hák profilu `onRefreshMayHelp` dostal
   `+key`), po `removeByIndex` dostane `-key`, ostane `Failed` a knižnica už „Obnoviť" neponúka. Sady teraz
   sprístupňujú zápis háku profilu (`calls.refreshMayHelp` zo `settlementFixtures`). Prípad `clearQueue` dostal tretí
   riadok, ktorý server usadil, kým sa jeho súbor ešte posielal: po vyčistení `Stop`, beh aj kúsok zastavený (ako
   sľubuje názov).
4. (Codex nízke) Zastavenie behu a zrušenie kúska v knižnici: ostáva odchýlka 2 (vedúci zamietol s dôvodom).

Behy (cez `tezky.sh`, `--retry=0`): **67 / 67 zelených** (jadro 58, hromadné operácie 9), dva behy po sebe.
Ohnutia v pamäti (`k4c1-*.json`), každé zvlášť:
- skorý návrat pri `failedByServer` pred `onClientFailure`: **1 červený** (admin-dam, riadok zlyhaný serverom;
  v knižnici bez háku sa nič nezmení: stav napísal server);
- počítadlo kľúčov v inštancii jadra: **2 červené** (prípad kľúčov × 2);
- bez `settlement.untrack` v `removeByIndex` (`:243`): **2 červené** (nový prípad × 2); bez oboch `untrack`
  (`:243`, `:255`) tých istých 2; `untrack` v `stopItemUpload` (`:255`) sa pri riadku, ktorý je vo fronte, samostatne
  pozorovať nedá: hneď po ňom ho pre ten istý riadok urobí `removeByIndex` (opravené v cykle 2: pri riadku, ktorý
  vo fronte nie je, je jediné, pozri „Cyklus 2");
- `clearQueue` zastaví len riadok na ceste (nie usadený so živým behom): **2 červené** (prípad `clearQueue` × 2).
`oxfmt --check`, `oxlint`, `eslint` (cez `tezky.sh`) čisté, `lint:tsc` kód 0.

## Cyklus 2 (posudky Codexu a Opusa: opravy cyklu 1 správne, jeden doplnok)

Snímok `K4-c2` (kód 0) pred úpravou; `diff -rq` stromu proti nemu pred začatím prázdny. Zmenený len
`uploadQueueCore.test.ts`.

- (oba posudky, nízke) `untrack` v `stopItemUpload` (`uploadQueueCore.ts:255`) je jediné, keď riadok vo fronte nie
  je (`indexOf` −1, `removeByIndex` sa preskočí, `:258-259`; pravidlo 5, `navrh-jadro.md:996`; admin-dam
  `D-st:640`). Nový prípad pod oboma sadami „by itself: a row that is not in the queue named is stopped and let go by
  the settlement": riadok fronty `OTHER` zlyhá po dokončení (hák profilu `+key`), `stopItemUpload(QUEUE, row)` pri
  neprázdnej `QUEUE` → riadok `Stop`, hák `-key`, vo fronte `OTHER` ostane (dnešné správanie admin-dam; v knižnici je `-key` zblíženie Z33, poznámka vedúceho po posudku K4 c3). Veta v cykle 1 opravená.

Behy (cez `tezky.sh`, `--retry=0`): **69 / 69 zelených** (jadro 60, hromadné operácie 9), dva behy. Ohnutie
`k4c2-untrack-stop.json` (bez `settlement.untrack` na `:255`): **2 červené** (nový prípad × 2). `oxfmt --check`,
`oxlint`, `eslint` (cez `tezky.sh`) čisté, `lint:tsc` kód 0.

## Zblíženia navyše

Žiadne (len testy).

## Nové nálezy

Žiadne.
