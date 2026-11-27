# PV14c-L3: fronta a usadzovanie podľa mena konfigurácie; rovnaké id assetov dvoch DAM oddelené; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L3.md`, plán `plan-PV14c.md`. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (vetva `next`, PV14c-L1 a L2 necommitnuté). Snímok **`PV14c-L3`** (s
changelogom a príručkou), záplata `krok5-praca/zaplaty/PV14c-L3.diff` (18 súborov, 1 643 riadkov). Všetky body hotové,
žiadny nezastavený.

Čo vidí redaktor admin-cms, admin-ugc a admin-dam: **nič** (každý má len `default`).

## Body

**1. Cieľ a udalosť môžu menovať konfigurácie** (`settlement/uploadSettlementTypes.ts`, exportované typy, len
nepovinné). `UploadSettlementTarget.configNames?`, `UploadSettlementEvent.configNames?`, `UploadSettlementProfile.configOf?(queueKey)`.
Jeden pomocník `concerns(queueKey, row, target, purpose)` v `uploadSettle.ts`: riadok sa týka cieľa, keď ho
`matches` profilu pustí a zároveň profil nemá `configOf`, cieľ nemenuje žiadnu (alebo prázdny zoznam), alebo
konfigurácia frontu riadku je medzi menovanými. Použitý všade, kde sa pýtalo `profile.matches` (známe zlyhanie,
`processed` udalosťou, `announceProcessed`, riadky duplikátu, `applyAssetRead` trikrát) a v `concernedRows` /
`anyRowMatches` (`uploadSettlement.ts`).

**2. Čakajúce čítania podľa konfigurácie** (`uploadSettlement.ts`). `pending` má kľúč `asset` (bez mena) alebo
`meno\u0000asset`; udalosť, ktorá menuje viac konfigurácií, dá jedno čítanie každej, každé frontom svojho prvého
dotknutého riadku a zapíše len riadky svojej konfigurácie. Bez mien (aj s menami pri profile bez `configOf`) jedno
čítanie na id ako doteraz. `fireNamed`, `retryNamed`, `cancelUnneeded` podľa kľúča čítania.

**3. Kto menuje konfiguráciu.**
- Ťah frontu: konfiguráciu svojho frontu (`applyAssets`, aj slot DAM, ten bez `configOf` nič nemení).
- Obchod (`store/uploadQueuesStore.ts`): profil dostal `configOf`. `queueItemProcessed`, `queueItemFullyProcessed`,
  `queueItemDuplicate`, `queueItemFailed`, `refreshAsset` majú nepovinný posledný parameter `of`: meno konfigurácie
  (reťazec) alebo `{ queueKey }` (konfigurácia toho frontu); typ `UploadQueueRowsOf` (obchod nie je v `src/lib.ts`).
  Bez neho všetky fronty ako doteraz.
- Volajúci: tri vnútorné widgety pri známom duplikáte (`damConfigName`), väzba zoznamu (`{ queueKey }` väzby),
  `UploadQueueDialog` (`{ queueKey }` dialógu), `useUploadQueueItemRefresh` (`{ queueKey }`, keď ho dostane, inak svoje
  `configName`, predtým nepoužité `_configName`).
- Notifikácia nemenuje nič (L4): týka sa všetkých frontov ako doteraz.

**4. Zápisy detailu podľa konfigurácie.** `noteRowsOfAsset(assetId, configName = 'default')` si poznačí len riadky
frontov tej konfigurácie, `RowsNote.configName?` (nepovinné, `default`). `updateFromDetail(asset, configName = 'default', …)`
číta, zapisuje (aj riadky, ktoré sa môžu stať riadkami assetu) a prepočítava len fronty tej konfigurácie; mená idú do
cache tej konfigurácie. `detailWrites` s kľúčom `meno\u0000asset`; otvorené poznámky sa navzájom berú len pri rovnakom
assete a konfigurácii. Detail (`AssetDetailSidebarMetadata`) dáva svoje meno do `noteRowsOfAsset` aj `setSaving`.
Obchod detailu: `setSaving(assetId, save, configName?)`, `savingOf(assetId, configName?)` s kľúčom `meno\u0000asset`
(vynechané = `default`); `imageDialogDamAuthors` a `ImageWidgetMultipleInner` čakajú na uloženie svojho mena.

**5. Cache usadzovania podľa frontu.** `caches.addAuthors(ids, queueKey?)`, `addKeywords`, `fetchAuthors(queueKey?)`,
`fetchKeywords`. Jadro (`cachesOf(queueKey)` v `uploadSettle.ts`) dá frontu riadku pri načítaní metadát a pri
duplikáte, ktorý sa stal originálom; `fetchNames()` (tam, kde sa doteraz volal fetch: po čítaní, po originále) žiada
fetch pre každý front, ktorého riadky dostali mená od posledného. Obchod smeruje do cache `configOf(queueKey)` (L2);
zrušené cache `default` v setupe obchodu, veta o obmedzení z L2-c1 v changelogu nahradená.

*Editor vidí:* na stránke s dvoma konfiguráciami dvoch DAM sa riadok usadí, obnoví, vyplní z uloženia detailu alebo
stane duplikátom len tým, čo sa stalo v jeho DAM; uloženia detailu toho istého id pod dvoma menami sa nerušia ani
nečakajú na seba.

## Rozhodnutia

- **Front do cache len profilu s `configOf`.** Zadanie počíta, že admin-dam nové argumenty ignoruje; jeho profil však
  dáva `addToCachedAuthors` priamo, a to je variadické `add(...args)` z `defineCached`: druhý argument (kľúč frontu) by
  pridal ako id autora. Profil bez `configOf` sa preto volá presne ako doteraz (jeden argument, fetch bez argumentu po
  každom čítaní), typovo admin-dam prejde.
- Prázdny `configNames` = žiadne meno = všetky fronty.
- Bez mena znamená v `noteRowsOfAsset`, `updateFromDetail`, `setSaving`, `savingOf` `default`, nie všetky fronty (ako
  pravidlo vynechaného mena v L1/L2). Preto zmenený starší prípad PV14a v `uploadNamedConfiguration.test.ts` („is read
  under the default configuration when the detail names none"): uloženie bez mena už nečíta ani nezapisuje riadok
  frontu `own` (žiadny front `default` riadok assetu nemá).
- Okamžité čítanie (obnovenie, `settleKnownProcessed`) s viacerými menami ostáva jedno čítanie frontom prvého
  dotknutého riadku; delia sa len čítania udalostí (bod 2). Knižnica viac mien neposiela nikde. *(Zmenené v c1.)*

## Prípady

Nové súbory: `uploadQueue/settlement/__tests__/uploadSettlementConfigurations.test.ts` (9, profil knižnice s dvoma
servermi podľa frontu) a `uploadQueue/__tests__/uploadNamedConfigurationScope.test.ts` (10, obchod s dvoma DAM, oba
dali `a-1`, riadok kópie vo fronte `default` aj `own`). Na snímku (všetkých 13 zmenených zdrojov starých) **17 červených**;
2 zelené sú stráže profilu bez `configOf` (admin-dam), ktoré majú ostať ako doteraz (jedno čítanie pre oba fronty,
cache bez frontu).
- poll frontu `own` a `default` (obe poradia), dve čítania `a-1` (`queueItemProcessed` pod každým menom), obnovenie
  cez väzbu zoznamu `own`, známy duplikát pod `own`, mená riadku `own` do cache `own` (a jej dopyty na adresy `own`),
  uloženie detailu pod `own` cez `AssetDetailSidebarMetadata` (riadok `default` nedotknutý, mená do cache `own`), dve
  uloženia naraz pod dvoma menami (obe poradia), `savingOf` pod `own` nečaká na `default`;
- usadzovanie: udalosť s jedným menom a s dvoma, obnovenie, známy duplikát, známe zlyhanie s menom, mená do cache s
  frontom (čítanie, originál duplikátu), dve stráže.

Ohyby: b1 pomocník ignoruje mená → 13 červených; b2 čakajúce čítanie podľa assetu → 3; b3 cache vždy s frontom → 1
(stráž); b4 `detailWrites` podľa assetu → 2.

Nepokryté prípadom: odovzdanie mena z troch widgetov pri duplikáte, z `UploadQueueDialog`, `useUploadQueueItemRefresh`,
`imageDialogDamAuthors` a `ImageWidgetMultipleInner` (len prepojenie; obchod a väzba zoznamu pokryté).

## Kontroly

Formát a linty zmenených súborov čisté. Celá kontrola: `testy` 383 súborov, 5 368 testov zelené, bez opakovaní (po
oprave typu v novom teste znova); `linty` zelené (prvý beh: `lint:tsc` 3 chyby typu stavu v novom teste, opravené).
admin-dam nekontrolovaný (D1).

## c1

Posudky `posudky/PV14c-L3-claude.md` (5 nízkych, 1 stredný mimo) a `PV14c-L3-codex.md` (súhlasí).

1. **Obnovenie s menom bez riadku nečíta** (`uploadSettlement.ts`, `readOneNow`): profil s `configOf`, cieľ s menom a
   žiadny riadok tej konfigurácie (odišiel) → bez dopytu, `settled`. Predtým čítal `default`-ov DAM (front `undefined`)
   s `report: true`. Prípad (aj `settleKnownProcessed`); ohyb c1-b1 → červený.
2. **Viac mien na okamžitých cestách: čítanie pre každé** (rozdelenie, nie zúženie typov: udalosti L4 môžu menovať
   viac konfigurácií jedného soketu). `byConfiguration(target)` v `uploadSettle.ts`: pri profile s `configOf` a
   viacerých menách cieľ pre každé meno zvlášť. Obnovenie a `settleKnownProcessed` (`readTargetNow` → `readOneNow` pre
   každé, každé svojím frontom a do svojich riadkov; výsledok prvý z `error`, `originalUnread`, `missing`, `pending`,
   `settled`, ktorý niektoré čítanie malo) a originál duplikátu (`becomeOriginals` pre každé meno). Pri jednom cieli
   kód ako doteraz (bez obalu `Promise.all`). Typy a changelog to hovoria. Prípady 3 (obnovenie oboch, obnovenie, ktoré
   pod jedným zlyhá → `error`, originál oboch); ohyb c1-b2 (`byConfiguration` vráti cieľ celý) → 3 červené.
3. **Prípady vstupov** (nový `uploadQueue/__tests__/uploadNamedConfigurationScopeEntries.test.ts`, 4): každý z troch
   widgetov (kód nezdieľajú) pod `own` s kópiou, ktorá už je (`onCopyToLicence` s `exists`), vedľa riadku `a-1` vo
   fronte `default`: originál len do riadku `own`, čítaný z DAM `own`; „uložiť a použiť" dialógu frontu `own` s riadkom
   bez formulára: obnovenie len DAM `own`, riadok `default` nedotknutý. Ohyby: c1-b3 (widgety bez mena) → 3 červené,
   c1-b4 (dialóg bez `{ queueKey }`) → 1.
4. **Dokumenty.** Changelog `:75` a príručka `:65`: rovnaké id dvoch DAM sú bezpečné okrem notifikácie (nemenuje
   konfiguráciu, číta ju klient prvého frontu s riadkom assetu a zapíše do riadkov všetkých frontov); typy: viac mien
   = čítanie pre každé, meno bez riadku sa nečíta, profil s `configOf` dostane front ako druhý argument cache (`add`
   z `defineCached` treba obaliť). Komentár `uploadQueuesStore.ts` „in every queue of the configuration".
5. **Len poznámka.** Low 3: `scheduleNamed` vracia `Promise.all(…).then()` aj pre profil bez `configOf`, takže
   `notify` admin-dam sa vyrieši o dve mikroúlohy neskôr ako pred L3 (zápisy rovnaké); jeho sadu spustí D1. Stredný
   mimo (jedna reťaz čítaní a jeden `failing` pre všetky konfigurácie) ide do L4.

*Editor vidí:* nič nové v troch adminoch; na stránke s dvoma DAM obnovenie riadku, ktorý medzitým odišiel, už nepýta
DAM inej konfigurácie.

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 384 súborov, 5 376 testov zelené, bez opakovaní
(znova po oprave props v novom teste); `linty` zelené (prvý beh: `lint:tsc` chýbajúce `accept`/`maxSizes` dialógu v
novom teste, doplnené). Záplata kroku s cyklom: 19 súborov, 1 998 riadkov.

