# OP7-T1: podpora testov admin-dam, pamäť, ktorú drží každý prípad (nález 209) (impl-dam-op7t)

Zadanie `krok5-praca/zadania/zadanie-OP7-T1.md`, pravidlá `PRAVIDLA.md`; nález `overenie-nalezov.md` („Jedenáste
overenie"), `impl/posudky/overenie11-codex.md` („Claim 209"). Strom `admin-dam`, vetva `next`, HEAD `fc116a71` a nad ním
nezapísané `OP7-D1` a `OP7-D2` (c1). Zmenené len `src/test/support/uploadUi.ts` a nový `src/test/support/uploadUi.test.ts`;
produkčný kód, `vitest.config.mts`, tvrdenia prípadov ani počet procesov sa nemenili. Nič sa nemazalo, žiadny zápis do
gitu. Snímok haldy (heap snapshot) som nerobil: držiaky sa našli prehľadom globálneho objektu a okna po každom prípade
a vypínaním opráv po jednej (ablácia), dokázané novým prípadom so `WeakRef`.

## Držiaky a ako sa uvoľnia

1. **Vyrovnávacia pamäť devtools Vue (hlavný držiak).** `@vue/runtime-core` si do modulovej premennej `buffer` ukladá
   udalosti pre devtools (`app:init`, `component:added`, `component:updated` s inštanciou komponentu, teda celou
   aplikáciou), kým sa nerozhodne, že devtools nie sú: časovačom 3 s, ktorý spustí pri prvej aplikácii (vytvorení
   rendereru). Prvá aplikácia súboru vznikala v `mount` pod falošnými hodinami, ktoré `stopUploadUi` zahodí; 3 s nikdy
   neuplynuli (`__VUE_DEVTOOLS_HOOK_REPLAY__` ostal pole) a pamäť držala každý prípad súboru. **Oprava:** `startUploadUi`
   urobí `createApp({})` pred `vi.useFakeTimers()`; prvé volanie v súbore vytvorí renderer na skutočných hodinách,
   po 3 s Vue vyrovnávaciu pamäť vyprázdni a ďalej nič neukladá. Prípad nič nevidí (prvé 3 s sa ukladá a potom zahodí).
2. **`globalThis.__VUE_DEVTOOLS_PLUGINS__`.** vue-i18n (so svojím `@vue/devtools-api` v6) pri každom `app.use(i18n)`
   pridá do tohto globálneho poľa `{ pluginDescriptor: { app, … }, setupFn }`; devtools ho nikdy neprečítajú, pole
   rastie o aplikáciu každého prípadu. **Oprava:** `startUploadUi` si zapamätá dĺžku poľa, `stopUploadUi` ho na ňu skráti.
3. **Poslucháči okna (dokázaný držiak z overenia, malý).** Nastavenie témy knižnice (`themeSettings.js`) pri každom
   vyhodnotení pridá poslucháča `change` na `matchMedia('(prefers-color-scheme: dark)')` (happy-dom z neho urobí
   poslucháča `resize` okna) a `useStorage` poslucháčov `storage` a `vueuse-storage` okna. Držia len modul nastavenia
   témy daného prípadu (nie aplikáciu): ablácia ukázala ~0,5 MB na prípad, v šume merania. **Oprava:** od `startUploadUi` sa
   `addEventListener`/`removeEventListener` okna, dokumentu a každého `MediaQueryList`, ktorý vráti `window.matchMedia`,
   zaznamenávajú (odobratých komponentom sa zabudne); `stopUploadUi` po odpojení aplikácií, `useRealTimers` a
   `unstubAllGlobals` vráti pôvodné metódy a odoberie zaznamenaných, čo ešte ostali. Poslucháči pridaní pred štartom
   (vitest, happy-dom, testovací súbor) sa nedotknú. Okno vitestu je globálny objekt s prístupovými funkciami, ktoré
   priradenie pošlú do okna happy-dom; preto sa zaznamená aj poslucháč `resize`, ktorý pridáva sám `MediaQueryList`.

Ablácia (detailLoaderBar, 3 prípady, halda po vynútenom GC na konci každého prípadu, MB): všetko zapnuté 204 / 206 /
209; bez poslucháčov 204 / 206 / 210; bez bodu 1 228 / 324 / 415; bez bodu 2 204 / 275 / 349; bez všetkého 227 / 323 /
414. Body 1 a 2 držia každý sám celú aplikáciu prípadu.

**Čo ostáva (ohraničené, nie kumulatívne).** Posledný skončený prípad drží register modulov vitestu, aktívna pinia
a obalené `client.get`/`client.request` jeho servera až do ďalšieho `startUploadUi` (ten hneď na začiatku urobí
`vi.resetModules()` a novú piniu); súbory si server tvoria v `beforeEach`. Prípad, ktorý v sebe štartuje dvakrát nad tým
istým serverom (napr. `assetDetailCreateGrants`), drží prvý štart do svojho konca. Uvoľnenie už pri `stop` (reset modulov,
`setActivePinia(undefined)`) som nepridal: špičku neznižuje, ďalší štart to robí skôr, než niečo postaví.

## Nový prípad, snímok, ohnutia

`src/test/support/uploadUi.test.ts`, 1 prípad: prípad s namontovaným komponentom knižnice sa zastaví, ďalší sa
naštartuje (s vlastným serverom, ako v súboroch), a s vynúteným GC (`v8.setFlagsFromString('--expose-gc')`,
`vm.runInNewContext('gc')`) sa čaká najviac 15 s, kým `WeakRef` na router aplikácie, knižnicu a `useTheme().settings`
prvého prípadu nič nedrží. **Nad snímkom červený** (drží sa `router`, `library`, `theme`; `uploadUi.ts` podaný zo snímku
cez `vitest.old.config.mts`, skopírovaný z TMPDIR `impl-dam-op7c`). Ohnutia (dočasný prepínač, odstránený), každé
červené: bez poslucháčov `['theme']`; bez `createApp` pred falošnými hodinami všetky tri; bez skrátenia
`__VUE_DEVTOOLS_PLUGINS__` všetky tri.

## Halda na prípad pred a po

Príkaz zo zadania (`--logHeapUsage`, bez GC) a ten istý s úplným GC po každom prípade (pomocný `setupFiles`
`gc-po-pripade.ts` cez `vitest.gc.config.mts` v TMPDIR; „pred" = `uploadUi.ts` zo snímku). MB po prípade; rast =
priemer na prípad od 2. prípadu po posledný.

| Súbor (prípady) | Bez GC pred | Bez GC po | Po GC pred | Po GC po |
| --- | --- | --- | --- | --- |
| makePublicDialog (12) | 247 → 1 285, rast 92 | 243 → 894, pád na 411, → 822; rast 47 | 206 → 1 062, rast 78 | 197, 267 … 272, rast 0,5 |
| detailLoaderBar (3) | 265 / 377 / 496 | 257 / 373 / 495 | 217 / 308 / 395 | 193 / 261 / 264 |
| detailMainFile (32) | 303 → 2 479, rast 69 | 303 → 2 416, pád na 364, → 819; rast 13 | 218 → 1 778, rast 50 | 219, 216 až 296, koniec 216; rast −2 |

Zadržaná pamäť (po GC) je po oprave rovná: cieľ < 15 MB na prípad je splnený (0,5 / 3 / −2). Čísla bez GC rastú ďalej
do píly: je to smetie, ktoré V8 zbiera lenivo a pri každom veľkom GC spadne. Prvý veľký GC prišiel v mojich behoch
pri 0,9 GB (makePublicDialog) až 2,4 GB haldy (detailMainFile, mainRouteChange), ďalšie okolo 1 až 1,2 GB; kedy, určuje
V8, nie podpora. **Špička RSS procesu**
(`/usr/bin/time -v`, `mainRouteChange`, 44 prípadov): pred 4,04 GB (halda na konci 3 626 MB, blízko limitu), po 2,34 GB.

Päť najväčších súborov s podporou (podľa počtu prípadov; väčšie `closeButton`, `routes`, `distributionListPoll` ju
nepoužívajú), každý dvakrát, zelené: `bulkMetadata` 73 (najviac 799 / 797 MB), `queueRowStates` 69 (668 / 545),
`overlaySave` 64 (691 / 1 241), `sidebarUnsaved` 45 (1 160 / 1 138), `mainRouteChange` 44 (2 015 / 2 012).

## Kontrola a čas

CK-DAM OP7-T1, obe časti zelené: `vysledky/OP7-T1-testy.log` 109 súborov / 1 795 testov (+1 súbor, +1 prípad tohto
kroku), `vysledky/OP7-T1-linty.log` čisté. Záplata `zaplaty/OP7-T1.diff`, 170 riadkov, 2 súbory.

Čas testovej časti: pred 255,45 s (`OP7-D2-c1-testy.log`, 09:32, pred reštartom WSL), po 450,73 s (CK) a 300,42 s
(druhý beh hneď po ňom, `pracovne/impl-dam-op7t/testy-2.log`). Spomalenie je prostredím, nie zmenou: súbory bez podpory
(zmena sa ich netýka) boli voči `OP7-D2-c1` pomalšie 1,83× a 1,38×, súbory s podporou 1,73× a 1,10×. Samostatné behy
v rovnakom prostredí sú po oprave rýchlejšie (detailMainFile 59,9 → 41,0 s, mainRouteChange 72,0 → 64,1 s).

## Koľko procesov

Po oprave už pamäť procesu nerastie s počtom prípadov súboru; špičku určuje lenivý GC V8: veľký súbor ~2,3 až 2,6 GB
RSS (zmerané 2,34 GB na `mainRouteChange`; `detailMainFile` mal haldu až 2,4 GB), bežný 0,6 až 1,2 GB haldy. V cgroupe
agentov (10 GB + 2 GB swap) odhadujem bezpečne **3 procesy** (3 × 2,6 GB + hlavný proces), na celom stroji 16 GB bez
cgroupy 4. Počet som nemenil (`tezky.sh` a `ck-dam.sh` ostávajú
na 2). Možnosti ďalej znížiť špičku (nerobil som):

- (a) Úplný GC v `stopUploadUi`, keď je halda nad 1 GB (`setFlagsFromString('--expose-gc')` + `vm`): zmerané na
  `mainRouteChange` s dočasným prepínačom: RSS 2,34 → 1,33 GB, čas 64,09 → 64,28 s (5 GC na 44 prípadov). Potom by
  bolo bezpečných ~6 procesov v 10 GB. Riziko: príznak V8 nastavený po štarte Node opisuje ako nepodporovaný (v praxi
  funguje; nový prípad ho používa).
- (b) `--max-old-space-size` (napr. 1 536) pre procesy vitestu v konfigurácii: V8 zbiera skôr; zmena konfigurácie
  procesov, nemerané.
- (c) Úplný GC po každom prípade: halda bez GC by bola rovná (~270 MB), cena ~0,1 až 0,2 s na prípad (~800 prípadov
  s podporou).

## Mimo kroku

Súbory, ktoré montujú bez podpory pod falošnými hodinami (`distributionListPoll`, `queueRefresh`,
`notificationFallback`, `slotUploadRow`, `cachedChipUnresolved`, `editorToolbarTooltips`), môžu mať ten istý držiak
devtools Vue; sú malé (`distributionListPoll` 74 prípadov 124 až 197 MB, `notificationFallback` 68 prípadov do 450 MB),
nechal som ich. Pracovný priečinok `krok5-praca/pracovne/impl-dam-op7t/` (skripty `halda.sh`, `halda-gc.sh`, `rss.sh`,
`patka.sh`, `ohyby.sh`, výstupy `halda-*`, `gc-*`, `rss-*`, `patka-*`, `ohyb*`, `ablacia-*`, `diag*`); pomocné súbory
v TMPDIR `vitest-tmp-impl-dam-op7t/` (`vitest.old.config.mts`, `vitest.gc.config.mts`, `gc-po-pripade.ts`).

## Po posudku (vedúci, 14. 10., 11:24)

Codex (`impl/posudky/OP7-T1-codex.md`), dva body P2, oba opravené vedúcim v `src/test/support/uploadUi.ts`:
1. `stopUploadUi` upratuje v `finally`: keď `app.unmount()` hodí výnimku, okno aj tak dostane späť pôvodné metódy
   a zaznamenaní poslucháči sa odoberú (inak by nahradené metódy prežili do ďalšieho prípadu a súboru).
2. Poslucháč sa zaznamená raz (rovnaký cieľ, typ, funkcia a `capture`; druhé pridanie DOM ignoruje) a pri upratovaní
   sa odoberá s tým istým `capture`. **Medza, ktorá ostáva:** poslucháča, ktorý bol na okne pred štartom prípadu
   a ten istý (tá istá funkcia) sa počas prípadu pridá znova, upratovanie odoberie; DOM to nevie rozlíšiť. Moduly
   prípadu sa vyhodnocujú nanovo (nové funkcie), takže sa to týka len modulov, ktoré sa medzi prípadmi nevyhodnocujú.
Overenie: celá CK-DAM C11 (záver bloku) beží už s touto úpravou.
