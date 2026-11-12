# OP7-D1: zoznam, stránka externého poskytovateľa a drobnosti, FE-81, FE-82, FE-83, FE-85, FE-86, FE-87 (impl-dam-op7a)

Zadanie vedúceho z 13. 10. (`krok5-praca/zadania/zadanie-OP7-D1.md`, pravidlá `PRAVIDLA.md`); nálezy
`overenie-nalezov.md`, „Deviate overenie", tabuľka „FE, admin-dam"; druhé čítania `impl/posudky/overenie9-dam-a-codex.md`
a `overenie9-dam-b-codex.md`. Strom `/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `fc116a71`, čistý.
TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op7a`, pracovný priečinok
`krok5-praca/pracovne/impl-dam-op7a/`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu, knižnica ani texty
prekladov sa nemenili. **V prehliadači som nevidel nič z tohto kroku.**

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `D/` = `A/components/detail/`,
`EP/` = `domains/coreDam/externalProvider/`. Čísla riadkov v častiach kroku platia pre strom po kroku; cyklus c1 posunul
`A/composables/assetInNewTab.ts`, `A/components/AssetCreateButton.vue` a dialóg licencie, časť „Cyklus c1" uvádza
svoje. **Čo po cykle c1 platí inak než v častiach kroku, je pri nich označené a celé v časti „Cyklus c1".**

## Podkroky

1. **Snímok `OP7-D1`** (`snimok.sh … OP7-D1 doc/changelog/3.0.0.md`), hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`, `OLD_SNAP=OP7-D1`;
   `vitest.k3-bend.config.mts`; oba skopírované z TMPDIR `impl-dam-op6b`). Skripty a výsledky v pracovnom priečinku:
   `old.sh`, `old-all.sh` (log `log/old-all.log`), `bends.py`, `bend-run.sh`, `bends/vysledok.txt`.
   Desať súborov testov kroku, 115 prípadov; na kóde zo snímku **29 červených**, 86 zelených; na strome 115 zelených.
3. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`, skript `fmt.sh`) 0.
4. **CK-DAM OP7-D1**, obe časti zelené, nad konečným stromom: `vysledky/OP7-D1-testy.log` 101 súborov / 1 729 testov
   (CK C10 95 / 1 709; +6 súborov, +20 testov = 30 nových − 8 v `downloadUnload` − 2 v `sidebarUnsavedLeave`);
   `vysledky/OP7-D1-linty.log`: `generate:dts`, `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplaty/OP7-D1.diff`: 2 169 riadkov, 25 súborov; mimo `src` len `doc/changelog/3.0.0.md` (je v snímku).

## FE-81 (nález 185): na stránke poskytovateľa sa asset otvára v novej karte

**Čo sa mení v kóde.**
- Nový `A/composables/assetInNewTab.ts`. Stránka, ktorá nekreslí detail assetu DAM, to povie cez
  `provideAssetOpensInNewTab()` (`:13`; `provide` kľúča `:10`); robí to len stránka poskytovateľa
  (`EP/components/ExternalProviderAssetListView.vue:60`). `useAssetInNewTab()` (`:16`) dáva: `opensInNewTab()`
  (čo stránka povedala; bez stránky `false`), `openAssetInNewTab(id)` (`:23-25`:
  `window.open(<adresa z router.resolve>, '_blank', 'noopener')`) a `openTabForAsset()` (`:32-49`: hneď
  `window.open('', '_blank')`; vráti `show(id)` a `close()`). Stav kroku: `show` bez karty alebo so zavretou kartou
  nič; inak `tab.opener = null` a až potom `tab.location.replace(<adresa>)`. **Od cyklu c1** sa `opener` ruší hneď
  pri otvorení a `show` aj `close` konajú len nad kartou, ktorá je ešte tá prázdna (c1-1). Funkcia namiesto holej
  hodnoty je kvôli pravidlu `pinia/no-return-global-properties`.
- `A/components/queue/AssetQueueItemEditable.vue:79-85`: v tom režime `showDetail` len otvorí kartu a skončí: pred
  otázkou, pred `setView`, vypnutím kláves, loaderom, `showDetail()` skladu aj pred čítaním.
- `A/components/AssetCreateButton.vue`, `onConfirm`: `:66` stráž `if (buttonLoading.value) return`; `:69` v tom režime
  sa karta otvára tu, synchrónne v obsluhe stlačenia, pred prvým `await`; `:72` otázka o neuložených metadátach len
  mimo toho režimu; `:79-80` po vytvorení `tab.show(res.id)` namiesto `showDetail(res)`; `:82` pri zlyhaní
  `tab.close()`. Hláška „vytvorené", zavretie dialógu a `emit('afterCreate')` ostali pre oba režimy.

**Čo sa mení pre používateľa (stránka poskytovateľa).**
- „Upraviť" riadka fronty uploadu: nová karta so stránkou assetu `/assets/<id>`; stránka poskytovateľa ostáva, ako
  je (fronta nakreslená, nič sa nečíta, nič sa nepýta). Každé stlačenie otvorí kartu, aj dvojklik dve (prijatá
  medza, posudok Codex 3).
- „Vytvoriť prázdny asset" → „Vytvoriť": hneď sa otvorí prázdna karta; po odpovedi servera prejde na stránku nového
  assetu; na stránke poskytovateľa hláška „vytvorené" a dialóg sa zavrie. Keď vytvorenie zlyhá: karta sa zavrie,
  hláška chyby, dialóg ostáva; ďalšie „Vytvoriť" otvorí novú kartu.
- Ani jedna karta nemá prístup k stránke, ktorá ju otvorila.
- **Zoznam DAM:** obe ovládania robia to, čo doteraz. **Jedna zmena aj tam** (moje rozhodnutie, pravidlo 5
  „druhé stlačenie"): druhé „Vytvoriť", kým prvé beží, neurobí nič. Tlačidlo sa počas požiadavky točí a myšou sa
  stlačiť nedá (`pointer-events: none`, `vuetify/lib/components/VBtn/VBtn.css:237`), ale obsluha je na prvku
  a Enter na tlačidle, ktoré drží fokus, ju spustil znova: druhý `POST`, druhý asset. Čítaním kódu, prípad to drží.
- **Na backend:** na stránke poskytovateľa neodíde čítanie assetu riadka (`GET asset/<id>` teraz pošle až nová karta).

**Rozhodnutia.**
1. „Zavrieť, keď je vytvorenie odvolané": v tomto režime cesta, ktorá by vytvorenie po stlačení odvolala, nie je.
   Otázka sa nekladie (zadanie) a „Zrušiť" dialógu požiadavku nezastavilo (ani na zozname DAM); od cyklu c1 sa
   dialóg počas požiadavky zavrieť nedá (c1-3). `close()` sa volá pri zlyhaní, od cyklu c1 aj pri odchode stránky.
2. Kartu, ktorú stránka nemá (prehliadač ju nedal) alebo ktorú používateľ medzitým zavrel či odviedol inam,
   neposielam nikam a neotváram inú. Asset je vytvorený a povie sa to. (Ako sa „odvedená inam" pozná, je od cyklu
   c1 inak: podľa adresy karty, nie podľa výnimky pri rušení `opener`.)
3. Po odchode zo stránky poskytovateľa počas vytvárania sa karta pošle na asset tak či tak (je otvorená a prázdna).

**Čo testy dokazujú a čo nie** (`window.open` je v testoch náhrada, karta je falošný objekt):
- dokazujú: aké volania odídu, s akými argumentmi a kedy: karta pre riadok `['/assets/asset-9', '_blank', 'noopener']`;
  karta pre nový asset `['', '_blank']` hneď po `click()`, bez čakania (teda pred prvým `await`), `POST` až potom;
  `opener = null` pred `location.replace('/assets/asset-new')` (od cyklu c1 hneď po otvorení); `close()` pri zlyhaní; že sa nič nezapíše do skladu
  detailu, nič nečíta a nič nepýta; hlášku a zavretie dialógu; že zoznam DAM robí to, čo robil;
- nedokazujú: že prehliadač kartu naozaj otvorí a nezablokuje; že po `tab.opener = null` má stránka načítaná v karte
  `window.opener === null` (podľa HTML špecifikácie áno: setter ruší „opener browsing context" karty, nie len
  vlastnosť dokumentu); že relatívna adresa v `tab.location.replace` sa vyhodnotí voči pôvodu aplikácie (podľa
  špecifikácie voči volajúcemu); čo používateľ vidí, kým `POST` beží.

**Medze, ktoré prijímam.**
- Prázdna karta je počas požiadavky v popredí; hláška „vytvorené" a zavretie dialógu sa dejú v karte poskytovateľa
  na pozadí.
- Keď prehliadač kartu nedá (blokovanie vyskakovacích okien), asset vznikne a neotvorí sa nič, ako pred krokom;
  hlášku na to nemám (nový text prekladu).
- Karta nového assetu nevzniká s `noopener` (inak by ju stránka nevedela poslať ďalej): dostane kópiu
  `sessionStorage` stránky poskytovateľa (jediný kľúč je značka knižnice „naposledy načítané znova pre novú verziu",
  `common-admin/dist/domains/system/systemBar/utils/appReload.js`). Karta riadka `noopener` má.

**Testy.** Nový `src/test/list/externalProviderNewTab.test.ts` (12 prípadov; skutočné stránky oboch zoznamov, menu,
dialóg, fronta uploadu): riadok fronty na stránke poskytovateľa (2: karta a nič viac; nepýta sa, ani keď je sklad
umelo označený ako neuložený); „Vytvoriť prázdny asset" tamže (7: karta pri stlačení a poslanie po vytvorení;
zlyhanie zavrie kartu a ďalší pokus má vlastnú; jedno potvrdenie počas požiadavky; tri karty, ktoré sa neposielajú,
`it.each`; nepýta sa); zoznam DAM (3: riadok otvorí detail a žiadnu kartu; nový asset otvorí detail a žiadnu kartu;
jedno potvrdenie počas požiadavky). Na snímku 10 červených; dvaja strážcovia zoznamu DAM sú zelení.

| Ohnutie | Červené |
|---|---|
| riadok kartu neotvorí | 2 |
| každá stránka otvára kartu (aj zoznam DAM) | 3 (všetky tri prípady zoznamu DAM) |
| karta sa otvorí až po vytvorení | 3 |
| karta si nechá `opener` | 3 |
| zlyhané vytvorenie kartu nezavrie | 1 |
| druhé potvrdenie sa nedrží | 2 (stránka poskytovateľa, zoznam DAM) |
| vytvorenie sa na stránke poskytovateľa pýta | 1 („nepýta sa" pri vytvorení) |
| zavretá karta sa pošle ďalej | 1 |

Bez ohnutia z vlastného dôvodu ostali dva prípady: „nepýta sa" pri riadku fronty (červený len pri ohnutí „riadok
kartu neotvorí") a karta, ktorú prehliadač nedal (ohnutie som nerobil).

## FE-82 (nález 186): bez aktívnej dlaždice → vyberie prvú

**Čo sa mení v kóde.** `A/store/assetListStore.ts:147-152`, `setActiveNext`: bez aktívnej dlaždice je hľadané miesto 0,
inak aktívne + 1. `A/components/list/composables/assetListActions.ts:142-147`, `neighbourOfActive`: bez aktívnej
dlaždice sa počíta od miesta −1, teda „ďalší" je prvý riadok a „predchádzajúci" nie je. `setActivePrev` sa nemenil.

**Čo sa mení pre používateľa.** Bez aktívnej dlaždice (vstup na stránku; zoznam načítaný znova bez assetu aktívnej
dlaždice) → vyberie prvú dlaždicu a prečíta jej asset do panela; doteraz druhú, a v zozname s jedným assetom nič.
← nerobí nič, ako doteraz. Vedľajší dôsledok toho istého pravidla: v detaile zoznamu, ktorý ostal otvorený nad
zoznamom načítaným bez jeho assetu, vedie „nasledujúci" (tlačidlo aj →) na prvú dlaždicu, doteraz na druhú;
„predchádzajúci" je vypnutý ako doteraz. Shift + klik bez aktívnej dlaždice berie rozsah od prvej, ako doteraz.
**Na backend:** číta sa iný asset (prvý).

**Testy.** Nový `src/test/list/arrowNoActiveTile.test.ts` (5): → na čerstvej stránke vyberie prvú a ďalšie → druhú;
← nič (strážca); po zozname načítanom bez assetu ← nič a → prvú; zoznam s jedným assetom; tlačidlá otvoreného
detailu. Na snímku 4 červené. **Zmenené staršie prípady** (držali „druhú dlaždicu"):
`activeTile.test.ts` „…the keys start as in a list nothing was picked in" (oba; prvý číta znova zoznam bez `asset-1`,
lebo šípka teraz vyberie ten) a `detailNeighbour.test.ts` „pick the neighbour in the list while no detail is open…",
premenovaný na „walk the list while no detail is open…" (tvrdí prvú dlaždicu). Všetky tri sú na snímku červené.

| Ohnutie | Červené |
|---|---|
| sklad ide od prvej (ako doteraz) | 6 (4 nové, 2 v `activeTile`) |
| ← bez aktívnej dlaždice vyberie prvú | 4 (strážca ← a tri ďalšie) |

## FE-83 (nálezy 196, 182): stránka poskytovateľa, šípky pod frontou a konce zoznamu

**Čo sa mení v kóde.** `EP/composables/externalProviderAssetListActions.ts`: `:38` `customDialog` z `useMainWrapper`;
`:372-375` `listIsUnderQueue()` a jeho použitie v `onArrowRight` / `onArrowLeft` (`:379`, `:385`), tá istá podmienka
ako v zozname DAM od FE-60; `:301-306` `neighbourOfActive(step)` (sused aktívnej dlaždice; bez aktívnej sa počíta od
prvej, tak ako krokuje sklad poskytovateľa); `:310` a `:342` `nextItem` / `prevItem` sa bez suseda vrátia pred
čímkoľvek. `EP/components/ExternalProviderAssetDetailDialog.vue`: `:126`, `:143` tlačidlá načítaného detailu
a `:100-101` lišta loadera majú `disabled` z toho istého `neighbourOfActive(∓1)`.

**Čo sa mení pre používateľa.**
- Kým je cez zoznam poskytovateľa nakreslená fronta uploadu na celú obrazovku, ← a → nerobia nič; po jej schovaní
  chodia po zozname. (Vlastný výber poskytovateľa na celú obrazovku klávesy vypínal už doteraz; podmienka ho kryje
  tiež, aj po zavretí detailu, ktorý klávesy zapína.)
- Na prvom a poslednom assete zoznamu: tlačidlo detailu, ktoré vedie von, je vypnuté, aj v lište kreslenej počas
  čítania; šípka ani tlačidlo tam nič nečítajú (doteraz sa znova čítal ten istý asset a detail prešiel loaderom).
  To isté platí pre šípky v zozname bez otvoreného detailu.
- **Na backend:** na koncoch zoznamu neodíde opakované čítanie toho istého assetu.

**Medze.** Na poslednom načítanom assete zoznamu, ktorý má ďalšie strany („3 / 3+"), je „nasledujúci" vypnutý, ako
v detaile DAM. Vypnuté tlačidlo happy-dom neklikne; „nič sa nečíta" drží na koncoch šípka (tá istá `nextItem`).

**Testy.** Nový `src/test/list/externalProviderWalk.test.ts` (5; skutočná stránka poskytovateľa, jej detail, fronta
uploadu): šípky pred frontou chodia, pod ňou nič, po schovaní chodia; šípky na koncoch nič nečítajú; tlačidlá
načítaného detailu na koncoch, v strede obe zapnuté; to isté pod loaderom a zhoda po načítaní; zoznam s jedným
assetom. Na snímku 5 červených z 5. Starší prípad `externalProviderDetail.test.ts` (lišta pod loaderom, „2 / 3" obe
zapnuté) platí bez zmeny.

| Ohnutie | Červené |
|---|---|
| šípky pod frontou nie sú držané | 1 |
| šípky sú držané vždy | 1 |
| „nasledujúci" na konci číta | 2 |
| tlačidlo „nasledujúci" načítaného detailu sa nevypne | 3 |
| lišta loadera tlačidlá nevypne | 1 |

## FE-85 (nález 201): „Stiahnuť originálny súbor" v novej karte

**Čo sa mení v kóde.** `D/components/AssetDownloadButton.vue:116-123`: odkaz má `target="_blank"`
a `rel="noopener noreferrer"` (zvyk aplikácie pri odkazoch do novej karty, napr. `A/components/AssetLink.vue`);
preč je `onLinkPress` a `useFileDownloadUnload`. `A/components/list/AssetListView.vue:106-113`: obsluha `beforeunload`
sa už na značku stiahnutia nepozerá. **`A/composables/fileDownloadUnload.ts` nikto nepoužíva** (súbor mazať nesmiem).

**Čo sa mení pre používateľa.** Odkaz sa otvorí v novej karte: vypršaná podpísaná adresa alebo nedostupné úložisko
nechá svoju chybovú stránku tam a aplikácia ostáva aj s napísaným. Obnovenie stránky alebo zavretie okna hneď po
stlačení odkazu sa s neuloženými metadátami pýta ako inokedy (sekundová výnimka zanikla). Vypršanú adresu treba
ďalej získať novým otvorením dialógu. **Na backend:** nič.

**„Stiahnuť" v menu riadka slotu** (`D/components/slots/AssetSlotListItem.vue:102-111`) funguje inak, nechal som ho:
pri každom stlačení si adresu prečíta nanovo (nevyprší) a otvorí ju cez `window.open(res.link)`, teda v novom okne;
aplikáciu neopúšťa. Dve veci k nemu sú v nových nálezoch (bod 3).

**Medze.** Čo prehliadač urobí s novou kartou pri odpovedi „príloha" (Chrome a Firefox ju podľa nálezu zavrú samy),
som nevidel. `noreferrer`: úložisko nedostane hlavičku `Referer`.

**Testy.** `src/test/list/downloadUnload.test.ts` prepísaný, 10 → 2 prípady: odkaz má adresu, `target="_blank"`
a `rel="noopener noreferrer"`, a stlačenie sa nasleduje v inej karte (1; tvrdenie o stlačení je od cyklu c1 iné,
bod c1-4: v kroku nedokazovalo nič); s napísaným sa okno pýta pred stlačením, hneď po ňom aj o 300 ms (1). Oba na
snímku červené. Osem zrušených prípadov držalo
značku (kláves pri stlačení ×5, dve stlačenia, dve stlačenia s odstupom, hodiny ×2): pravidlo, ktoré už nie je.
`sidebarUnsavedLeave.test.ts`: zrušené dva prípady bloku „and a file is downloaded from the detail" (32 → 30) a s nimi
konštanty a odpoveď servera pre adresu stiahnutia.

| Ohnutie | Červené |
|---|---|
| odkaz v tej istej karte (bez `target`) | 1 |
| značka stlačenia sa používa ďalej (odkaz ju píše, stránka ju číta) | 1 |

Prvé ohnutie druhého riadka (stránka prepustí `beforeunload`, keď má odkaz fokus) červené nebolo: chyba ohnutia
(`click()` v happy-dom fokus nedáva), nie prípadu; nahradil som ho tým v tabuľke.

## FE-86 (nález 200): `/` nahrádza svoj záznam histórie

**Čo sa mení v kóde.** `domains/system/views/HomepageView.vue:9`: `router.replace` namiesto `router.push`.

**Čo sa mení pre používateľa.** Späť zo zoznamu, na ktorý sa prišlo cez `/`, ide na stránku pred `/`; doteraz na `/`,
ktorá poslala na čerstvý zoznam, a za zoznam sa nedalo dostať. **Kedy sa `HomepageView` vôbec pripojí:** len pri
navigácii na `/` v bežiacej aplikácii, čo je logo stránok s bočným menu (`layouts/AppLayoutDrawer.vue:69`,
`RouterLink to="/"`). Pri celom načítaní `/` (aj po prihlásení, `loginActions.ts:26`) odpovie štart aplikácie na
prvú navigáciu presmerovaním na zoznam (`domains/system/composables/appInitialize.ts:143-145`) a prvú navigáciu
vue-router zapisuje cez `replace` (`vue-router/dist/vue-router.js:1403-1406`): stránka `/` sa nepripojí a záznam `/`
nevznikne. `loginActions.ts` som preto nemenil. (Cyklus c1 ho zmenil z iného dôvodu a zmenu vzal späť: bod c1-2.)

**Testy.** Nový `src/test/router/homepageBack.test.ts` (2; skutočná `HomepageView` pod routerom s históriou v pamäti):
z `/settings` na `/` skončí na `/assets` (strážca); Späť potom skončí na `/settings` (na snímku červený: `/assets`).
Ohnutia: „`push` namiesto `replace`" 1 červený; „stránka neposiela nikam" 1 červený (strážca).

## FE-87 (nálezy 198, 199): upratanie

**Dialóg licencie** (`A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue`): `:128` druhé potvrdenie počas
`saving` skončí hneď; `:342` tlačidlo má `:loading="saving"`; `console.log` je preč. Pre používateľa: druhé
„Potvrdiť a znovu načítať ADAM" počas prvého neurobí nič (doteraz druhé čítanie licencie, druhý `PATCH`, druhý
reload) a tlačidlo sa točí. `saving` platí aj počas otvorenej otázky o neuložených metadátach, tlačidlo sa teda točí
aj pod ňou; druhé potvrdenie pod otázkou doteraz dostalo „zostať" a zhodilo `saving` prvému, teraz neurobí nič.
Nový `src/test/list/licenceDialogConfirm.test.ts` (2; skutočné menu a dialóg): dve potvrdenia počas podržaného čítania
licencie: jedno čítanie, tlačidlo sa točí, po odpovedi jeden `PATCH` a jeden reload (na snímku červený); strážca: po
odmietnutej zmene sa tlačidlo netočí a ďalšie potvrdenie prejde. Odstránenie `console.log` test nemá.

**Časovač stránok detailu** (`D/AssetDetailView.vue:133-145`, `D/AssetFileDetailView.vue:136-148`): časovač prvého
čítania sa drží v premennej a `onUnmounted` ho ruší. Pre používateľa: odchod zo stránky do 100 ms už na ďalšej
stránke neukáže „Nesprávne ID assetu alebo neoprávnený prístup". Nový `src/test/list/detailPageTimer.test.ts`
(2 stránky × 2): odchod do 50 ms, potom sekunda: žiadna hláška, žiadne čítanie (na snímku 2 červené); strážca: bez
odchodu sa asset prečíta raz.

| Ohnutie | Červené |
|---|---|
| licencia: druhé potvrdenie sa nedrží | 1 |
| licencia: tlačidlo sa netočí | 1 |
| licencia: `saving` sa nikdy nezhodí | 1 (strážca) |
| stránka assetu časovač neruší | 1 |
| stránka assetu súboru časovač neruší | 1 |
| časovač sa nikdy nespustí | 2 (obaja strážcovia) |

## Testy spolu

| Súbor | Prípady | Červené na snímku |
|---|---|---|
| `src/test/list/externalProviderNewTab.test.ts` (nový) | 12 | 10 |
| `src/test/list/arrowNoActiveTile.test.ts` (nový) | 5 | 4 |
| `src/test/list/externalProviderWalk.test.ts` (nový) | 5 | 5 |
| `src/test/list/detailPageTimer.test.ts` (nový) | 4 | 2 |
| `src/test/list/licenceDialogConfirm.test.ts` (nový) | 2 | 1 |
| `src/test/router/homepageBack.test.ts` (nový) | 2 | 1 |
| `src/test/list/downloadUnload.test.ts` (prepísaný) | 10 → 2 | 2 |
| `src/test/list/activeTile.test.ts` | 17 | 2 |
| `src/test/list/detailNeighbour.test.ts` | 36 | 1 |
| `src/test/list/sidebarUnsavedLeave.test.ts` | 32 → 30 | 1 |
| spolu | 115 | 29 |

Nových prípadov je 30, na snímku červených 23; sedem zelených sú strážcovia (zoznam DAM ×2, ← bez dlaždice, `/` vedie
na zoznam, licencia po odmietnutí, čítanie stránok detailu ×2) a každý je červený pri jednom ohnutí. Ohnutí je 25,
všetky červené (jedno až po oprave ohnutia, FE-85). Zadanie chce jedno až dve na opravu, nie desiatky: FE-81, FE-83
a FE-87 majú po viac nezávislých častí a chcel som, aby každý strážca mal ohnutie, preto 25. Každé bežalo nad jedným
malým súborom (FE-82 nad dvoma), spolu asi desať minút.

**Existujúce prípady, ktoré som zmenil** (držali stav, ktorý krok mení; žiadny nie je oslabený):
1. `activeTile.test.ts`, dva prípady „…the keys start as in a list nothing was picked in" (FE-82).
2. `detailNeighbour.test.ts`, „walk the list while no detail is open, also under an open menu of the page" (FE-82;
   pôvodne „pick the neighbour in the list…").
3. `sidebarUnsavedLeave.test.ts`, blok stránky poskytovateľa (FE-81): „reads the asset of a row of the upload queue at
   once" je „opens the asset of a row of the upload queue at once" (čítania `[0, 1, 0, 0]` a jedno volanie
   `window.open`; doteraz `[0, 1, 0, 1]`); „creates an empty asset at once…" má len náhradu `window.open`, tvrdenia
   bez zmeny. Komentár bloku to hovorí.
4. `sidebarUnsavedLeave.test.ts`, dva zrušené prípady stiahnutia, a `downloadUnload.test.ts` celý (FE-85).

## Zmenené súbory (14 produkčných v `src`, z toho 1 nový; 10 testov, z toho 6 nových; 1 mimo)

- `src/domains/coreDam/asset/composables/assetInNewTab.ts` (nový; FE-81)
- `src/domains/coreDam/asset/components/AssetCreateButton.vue`, `components/queue/AssetQueueItemEditable.vue` (FE-81)
- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetListView.vue` (FE-81)
- `src/domains/coreDam/asset/store/assetListStore.ts` (FE-82)
- `src/domains/coreDam/asset/components/list/composables/assetListActions.ts` (FE-82; a komentár v `listUnmounted`:
  mimo zoznamu DAM by sa už pýtal len dialóg licencie)
- `src/domains/coreDam/externalProvider/composables/externalProviderAssetListActions.ts`,
  `components/ExternalProviderAssetDetailDialog.vue` (FE-83)
- `src/domains/coreDam/asset/components/detail/components/AssetDownloadButton.vue`,
  `components/list/AssetListView.vue` (FE-85)
- `src/domains/system/views/HomepageView.vue` (FE-86)
- `src/domains/coreDam/asset/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue`,
  `components/detail/AssetDetailView.vue`, `AssetFileDetailView.vue` (FE-87)
- testy: tabuľka vyššie
- `doc/changelog/3.0.0.md` („Fixed": sedem nových položiek pred položkou „The slot remove dialog…"; vo vete
  o otázke prehliadača pri obnovení stránky je namiesto opisu značky stiahnutia odkaz na novú položku)

Žiadny súbor `src/test/support` sa nemenil. E2E špecifikácie (`e2e/`) som nespúšťal.

## Súbory na zmazanie vedúcim

- `src/domains/coreDam/asset/composables/fileDownloadUnload.ts` (po FE-85 ho nič neimportuje). Vedúci ho po kroku
  zmazal.

## Nové nálezy (neopravené, čítaním kódu, neoverené druhým čítaním ani behom)

1. **Zoznam poskytovateľa má tú istú chybu ako FE-82**: bez aktívnej dlaždice → vyberie druhú
   (`EP/store/externalProviderAssetListStore.ts:105-113`). FE-82 menuje len zoznam DAM; `neighbourOfActive`
   poskytovateľa pravidlo jeho skladu zrkadlí.
2. **Zoznam poskytovateľa nemá obdobu FE-61**: `setList` (`:55-72`) nové riadky nezvýrazní a index aktívnej dlaždice
   nechá: po filtri nie je zvýraznená žiadna dlaždica, klik na dlaždicu na starom mieste ju nezvýrazní
   (`setActiveByIndex` sa pri rovnakom indexe vráti) a šípky idú od starého miesta. **A `setActiveByIndex` (`:95-103`)
   spadne**, keď je starý index za koncom kratšieho zoznamu (`list[oldActiveIndex].active = false` nad `undefined`;
   sklad DAM tam stráž má): klik na dlaždicu po filtri, ktorý zoznam skrátil, ju zvýrazní a asset neprečíta.
3. **„Stiahnuť" v menu riadka slotu**: okno otvára až po požiadavke (`AssetSlotListItem.vue:105-106`), čo prehliadač,
   ktorý takéto okná blokuje, potichu zahodí; a bez `noopener`, takže stránka úložiska má prístup k `window.opener`.
4. **Po prihlásení formulárom ostáva v histórii `/login`**: Späť zo zoznamu ukáže prihlasovaciu stránku prihlásenému
   používateľovi (stránka ho nepresmeruje; `pages/login.vue`, `requiresAuth: false`). `loginActions.ts:26` píše
   `window.location.href`, nie `replace`. **Neopravené:** cyklus c1 to opravil a opravu vzal späť (c1-2), lebo sama
   o sebe škodí: po odhlásení je pred prihlasovacou stránkou v histórii `/logout`, a keď prihlásenie svoj záznam
   nahradí, Späť zo zoznamu skončí hneď na `/logout` a používateľa odhlási. Celá oprava: záznam musí nahrádzať
   prihlásenie AJ odhlásenie: `loginActions.ts:26` (`window.location.replace`), odhlásenie v `pages/logout.vue`
   (namiesto `ALogoutView`) alebo v `ALogoutView` knižnice (dnes `window.location.href = logoutUrl()`), cesty na
   `/logout` (`domains/system/composables/currentUser.ts:2`, `domains/system/components/CurrentUserDropdown.vue:23`)
   a odkaz prihlásenia cez SSO (`domains/system/views/components/LoginFormSso.vue`, `:href`). Na rozhodnutie vlastníka.
5. **happy-dom nasleduje `target="_blank"` naozaj** (nová stránka a čítanie zo siete,
   `happy-dom/lib/window/WindowPageOpenUtility.js`): test, ktorý taký odkaz stláča alebo nechá kód volať
   `window.open`, ho musí zastaviť alebo nahradiť.

## Cyklus c1 (14. 10.): štyri body po posudkoch

Posudky: `impl/posudky/OP7-D1-codex.md` a Opus (citovaný v zadaní cyklu). V strome medzitým pracuje krok OP7-D2:
bez snímku, bez celej CK a bez záplaty (pokyn vedúceho); púšťal som len súbory testov, ktoré som menil, `oxfmt`,
`oxlint` a `eslint` nad súbormi cyklu (0) a `lint:tsc` (cez `tezky.sh`, 0 chýb v celom strome). „Pred cyklom" =
snímok `OP7-D2`, ktorý moje súbory drží v stave po kroku (overené `cmp`; skript `old-c1.sh`). Súborov
`D/AssetDetailView.vue`, `D/AssetFileDetailView.vue` a `D/components/AssetDownloadButton.vue` som sa nedotkol.

### c1-1 (FE-81): karta nového assetu

**Čo sa mení v kóde** (`A/composables/assetInNewTab.ts:30-66`, `openTabForAsset`):
- (a) `:41` hneď po `window.open('', '_blank')`, v tej istej úlohe, `tab.opener = null`. Karta je vtedy ešte prázdna
  stránka pôvodu aplikácie, takže to prejde; stránke ostáva jej odkaz na kartu pre `location.replace`.
- (b) `:43-50` `whileEmpty()`: karta, len kým nie je zavretá a jej `location.href` je `about:blank`; čítanie adresy
  karty na cudzom pôvode hodí výnimku, tá sa chytí a znamená „už nie je naša". `show` (`:56-60`) aj `close`
  (`:61-64`) konajú len nad takou kartou. Kartu, ktorú používateľ odviedol inam (na iný web alebo na inú stránku
  aplikácie), stránka neposiela ani nezatvára.
- (c) `:51-53` kým sa nezavolá `show` alebo `close`, počúva okno `pagehide` a zavrie pri ňom kartu, ak je ešte
  prázdna; `show` aj `close` počúvanie rušia ako prvé (`show` pred `location.replace`: karta na ceste na asset sa
  ešte hlási ako prázdna). `AssetCreateButton.vue` volá po odpovedi vždy jedno z nich (`:82`, `:85`).
- (d) Veta changelogu aj poznámky „ani jedna karta nemá prístup k stránke, ktorá ju otvorila" platí, ako je
  napísaná: karta riadka vzniká s `noopener`, prázdna karta má `opener` zrušený pri otvorení.

**Čo sa mení pre používateľa.** Prázdna karta odvedená počas požiadavky na iný web nemá prístup k stránke
poskytovateľa. Zlyhané vytvorenie nezavrie kartu, v ktorej má používateľ medzitým niečo iné; úspešné ju neprepíše.
Stránka poskytovateľa zavretá alebo obnovená počas požiadavky zavrie so sebou ešte prázdnu kartu (doteraz ostala
prázdna navždy).

**Medze.** V prehliadači nevidené, ako celý FE-81: že `opener = null` nad `about:blank` hneď po otvorení platí aj
pre stránky načítané v karte neskôr (špecifikácia: ruší sa „opener browsing context" karty); že prehliadač pri
`pagehide` zavretie cudzej karty vykoná; že `location.href` prázdnej karty je vo všetkých prehliadačoch
`about:blank`. `pagehide` príde aj pri odchode stránky do bfcache. Dvojklik na ceruzku riadka otvorí dve karty
(prijaté, posudok Codex 3).

**Testy** (`src/test/list/externalProviderNewTab.test.ts`, 12 → 20; falošná karta má adresu: prázdna, „iný web"
čítanie odmieta, `replace` adresu hneď nemení): (a) `opener` je `null` hneď po `click()`, bez čakania (1);
(b) asset vznikne a karta, ktorú používateľ zavrel / odviedol na iný web / na inú stránku aplikácie, sa neposiela
ani nezatvára (3, `it.each`), a pri zlyhaní sa odvedená karta nezavrie (2); karta, ktorú prehliadač nedal (1,
doteraz v `it.each`); (c) `pagehide` počas požiadavky zavrie prázdnu kartu (1), odvedenú nie (1; strážca), a po
odpovedi kartu na ceste na asset nie (1; strážca). Pôvodný prípad „kartu, ktorej sa nedá zrušiť `opener`" zanikol
s vetvou, ktorú držal. Pred cyklom červených 6 z nových a zmenených (a: 1, b: 4, c: 1).

| Ohnutie | Červené |
|---|---|
| `opener` sa pri otvorení neruší | 3 |
| odvedená karta sa berie ako vlastná (bez pohľadu na adresu) | 5 (štyri prípady b, strážca `pagehide`) |
| karta nejde so stránkou (`pagehide` sa nepočúva) | 1 |
| karta ide so stránkou aj po odpovedi | 1 (strážca) |

Tri ohnutia kroku (karta si nechá `opener`, zavretá karta sa pošle ďalej, riadky `show`) mieria na riadky, ktoré
cyklus prepísal; nahrádzajú ich tieto.

### c1-2 (FE-86): prihlásenie malo nahrádzať svoj záznam histórie; urobené a vzaté späť

**Čo sa urobilo.** `domains/system/views/composables/loginActions.ts`: `window.location.replace('/')` namiesto
`window.location.href = '/'`, aby Späť zo zoznamu po prihlásení formulárom nešlo na prihlasovaciu stránku; k tomu
veta v položke FE-86 changelogu a nový `src/test/router/loginHistory.test.ts` (2 prípady, jeden pred zmenou červený;
ohnutie „prihlásenie pridáva záznam" 1 červený).

**Prečo je to späť** (rozhodnutie vedúceho po mojej správe; vlastník nie je k dispozícii). Po odhlásení ostáva
v histórii `/logout` pred prihlasovacou stránkou: na `/logout` vedie odkaz routera
(`domains/system/components/CurrentUserDropdown.vue:23`) alebo `window.location.pathname = '/logout'` pri vynútenom
odhlásení (`domains/system/composables/currentUser.ts:2`), a stránka `/logout` kreslí `ALogoutView` knižnice, ktorý
ide ďalej cez `window.location.href = logoutUrl()`
(`common-admin/dist/domains/ui/view/components/ALogoutView.vue_vue_type_script_setup_true_lang.js`), teda pridaním
záznamu. Keď prihlásenie svoj záznam nahradí, po odhlásení a novom prihlásení je hneď pred zoznamom `/logout`: jedno
Späť používateľa odhlási. S pôvodným `window.location.href` je medzi nimi `/login` (prvé Späť ukáže prihlasovací
formulár prihlásenému používateľovi, až druhé odhlási). Čítaním kódu, v prehliadači nevidené. Takú zmenu správania
nikto nerozhodol.

**Stav po vrátení.** `loginActions.ts` je bajt po bajte ako v snímku `OP7-D1` (`cmp` bez rozdielu, `git status` ho
neuvádza). Položka FE-86 changelogu hovorí len o logu, ako po kroku. `src/test/router/loginHistory.test.ts` v strome
ostal (mazať nesmiem) a **na pôvodnom kóde je jeho prvý prípad červený: je to jediný súbor na zmazanie vedúcim**;
nepúšťal som ho.

**Celá oprava** (nález 4 v časti „Nové nálezy"): záznam musí nahrádzať prihlásenie aj odhlásenie, teda
`loginActions.ts`, odhlásenie v `pages/logout.vue` alebo v `ALogoutView` knižnice, cesty na `/logout` a odkaz
prihlásenia cez SSO (`LoginFormSso.vue`). `pages/error.vue:31` (`window.location.href = '/'`, tlačidlo chybovej
stránky) nie je prihlásenie ani odhlásenie.

### c1-3 (FE-87): dialóg licencie sa počas zmeny nedá zavrieť; to isté dialóg nového assetu

**Voľba.** Z dvoch ciest zadania som vzal „dialóg sa nedá zavrieť, kým ukladá": je to vzor, ktorý aplikácia už má
(`D/components/distribution/forms/DistributionManageDialog.vue:51-57`), a pre tlačidlo nového assetu sú to tie isté
tri riadky, takže je opravené rovnako.

**Čo sa mení v kóde.** `A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:104-109`: `onCancel` sa počas
`saving` vráti; `:337` „Zrušiť" má `:disabled="saving"`. `A/components/AssetCreateButton.vue:44-49`: `onCancel` sa
počas `buttonLoading` vráti; `:132` „Zrušiť" má `:disabled="buttonLoading"`. Krížik lišty oboch dialógov ide cez
`onCancel`.

**Čo sa mení pre používateľa.** Kým zmena licencie alebo vytváranie assetu beží, „Zrušiť" je vypnuté a krížik
nerobí nič; po odpovedi (úspech dialóg zavrie, zlyhanie ho nechá) sa dá zavrieť ako doteraz. Dialóg licencie drží
`saving` aj počas otázky o neuložených metadátach, ktorá je vtedy nad ním. Pri novom assete to platí na oboch
stránkach; na stránke poskytovateľa tým odpadá aj „Vytvoriť, Zrušiť, a karta aj tak ukáže asset" (Codex 2).

**Čo ostáva.** Stráž žije ďalej v inštancii dialógu. Zanikne s ňou, keď počas požiadavky zanikne celá stránka
navigáciou: Späť prehliadača nad otvoreným dialógom Vuetify ruší, okrem návratu na záznam zapísaný cez `replace`
(taký je zoznam, na ktorý sa prišlo cez `/`: po FE-86 z loga, pri celom načítaní aplikácie aj doteraz). Na ďalšej stránke s tým istým menu
potom nový dialóg môže poslať zmenu znova, kým prvá ešte visí. Treba na to požiadavku, ktorá visí niekoľko sekúnd.
Úplne by to zavrela stráž mimo inštancie (druhá cesta zadania). Po úspešnej zmene licencie sa dialóg zavrie
a stránka sa načítava znova; kým sa načíta, dá sa dialóg otvoriť znova, ako doteraz.

**Testy.** `src/test/list/licenceDialogConfirm.test.ts` (2 → 3): počas podržaného čítania licencie je „Zrušiť"
vypnuté a krížik dialóg nezavrie (ten istý dialóg, tlačidlo sa točí, jedna požiadavka); po odmietnutí je „Zrušiť"
zapnuté a krížik zavrie (pred cyklom červený). `externalProviderNewTab.test.ts`: ten istý prípad pre dialóg nového
assetu (pred cyklom červený; ráta sa do 20 vyššie). Ohnutia „dialóg licencie sa dá zavrieť" a „dialóg nového assetu
sa dá zavrieť": po 1 červenom.

**Doplnok po potvrdzovacom posudku** (`impl/posudky/OP7-D1-c1-codex.md`: „dialógy sa dajú zavrieť klávesom Escape
a stlačením mimo nich"). **V aplikácii to neplatí a produkčný kód som nemenil.** Knižnica dáva každému `VDialog`
predvoľbu `persistent` (`common-admin/dist/plugins/commonVuetifyConfig.js:56-60`; aplikácia berie Vuetify
z `createAnzuVuetify`, `src/plugins/vuetify.ts:7`, a žiadny z dvoch dialógov ju neprepisuje), a perzistentný overlay
Vuetify pri Escape ani pri stlačení mimo nezatvára (`vuetify/lib/components/VOverlay/VOverlay.js:195-198`,
`:279-291`). Platí to vždy, nie len počas požiadavky, a platilo aj pred cyklom. Posudok čítal len šablóny, kde
`persistent` napísané nie je.
- **Dva nové prípady** (strážcovia; „červené pred zmenou" byť nemôžu, lebo zmena nie je):
  `externalProviderNewTab.test.ts` (20 → 21) a `licenceDialogConfirm.test.ts` (3 → 4), „is not closed by Escape nor
  by a press outside it while …": počas podržanej požiadavky Escape (`keydown` na okne) a stlačenie na pozadie
  dialógu (`mousedown` a `click`) dialóg nezavrú, požiadavka je jedna, po odpovedi sa dokončí. Že prípady hryzú,
  ukazujú dve ohnutia v pamäti „dialóg nie je perzistentný" (`:persistent="false"`): v každom súbore 1 červený,
  práve ten prípad.
- **Čo ešte zatvára dialógy počas požiadavky** (čítaním kódu): nič, čo dialóg ponúka. Vlastné zavretie ide len cez
  `onCancel` (stráž c1-3) a po úspechu. Späť prehliadača nad perzistentným dialógom Vuetify ruší
  (`VOverlay.js:297-304`), okrem návratu na záznam zapísaný cez `replace`, čo je zmena stránky. Dialóg nového assetu
  žije v obsahu menu: menu sa zatvára klikom do svojho obsahu, stlačením mimo alebo Escape, a to len keď je navrchu
  (`VMenu.js:70-80`, `VOverlay.js:200`, `:280`); s otvoreným dialógom navrchu nie je, kliky v dialógu do obsahu menu
  nedôjdu (dialóg je v DOM mimo neho) a fokus drží dialóg.
- Vety changelogu „dialóg sa nedá zavrieť" teda platili, ako boli napísané; doplnil som k nim, že Escape ani
  stlačenie mimo dialógy aplikácie nezatvára nikdy.

### c1-4: prípad odkazu na stiahnutie dokazuje, čo hovorí

`src/test/list/downloadUnload.test.ts`: pomocník `press()` volal `preventDefault`, takže tvrdenie „adresa aplikácie
ostáva" prešlo pri hocijakom odkaze. Teraz test prehliadaču nič nezakazuje: `window.open` okna testu je nahradené
priradením (len to dôjde až k oknu, ktorého sa happy-dom pýta; `vi.stubGlobal` nie) a zapisuje, čo prehliadač testu
pri nasledovaní odkazu otvára. Prípad tvrdí `[adresa, '_blank', 'noreferrer,noopener']`; odkaz bez `target` dá
`'_self'` (ohnutie „odkaz v tej istej karte": prípad červený práve týmto riadkom, `bends/85-link-in-same-tab.log`).
Dokazuje teda, kam happy-dom stlačenie nasleduje; čo urobí skutočný prehliadač, nie.

### Testy a ohnutia cyklu

Po vrátení bodu c1-2 a po doplnku k c1-3 platia tri súbory, 27 prípadov (`externalProviderNewTab` 21,
`licenceDialogConfirm` 4, `downloadUnload` 2), na strome zelené; pred cyklom (dva súbory s produkčnou zmenou, bez
dvoch strážcov doplnku 23 prípadov) **8 červených**. Ohnutí je 8 (s dvoma doplnku) a jedno zopakované z kroku,
všetky červené; výsledky `bends/vysledok.txt` (od riadka
`c1-tab-not-cut-at-open`; riadok `c1-login-adds-entry` patrí vrátenému bodu). Po vrátení bežal
`src/test/router/homepageBack.test.ts` (FE-86, logo): 2 z 2 zelené. Jeden beh
ohnutia `85-link-in-same-tab` spadol na cudzom súbore v polovici úpravy (`D/composables/assetDetailFileChange.ts`,
krok OP7-D2: `onBeforeUnmount is not defined`); zopakovaný o pár minút prešiel, ako má.

### Zmenené súbory cyklu

- `src/domains/coreDam/asset/composables/assetInNewTab.ts` (c1-1)
- `src/domains/coreDam/asset/components/AssetCreateButton.vue` (c1-3)
- `src/domains/coreDam/asset/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue` (c1-3)
- `src/test/list/externalProviderNewTab.test.ts`, `licenceDialogConfirm.test.ts`, `downloadUnload.test.ts`
- `doc/changelog/3.0.0.md`: položky FE-81 (karta, dialóg) a licencie (dialóg)
- `src/domains/system/views/composables/loginActions.ts` je po vrátení bodu c1-2 bez zmeny;
  `src/test/router/loginHistory.test.ts` (nový, patrí vrátenému bodu) je na zmazanie

