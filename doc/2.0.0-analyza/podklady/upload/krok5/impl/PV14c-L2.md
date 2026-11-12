# PV14c-L2: cache mien a ich ext systém podľa mena konfigurácie; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L2.md` (s doplnkom vedúceho), plán `plan-PV14c.md`. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (vetva `next`, PV14c-L1 necommitnutý). Snímok **`PV14c-L2`** (s
changelogom a príručkou), záplata `krok5-praca/zaplaty/PV14c-L2.diff` (29 súborov, 1 486 riadkov). Všetky body hotové,
žiadny nezastavený.

Čo vidí redaktor admin-cms, admin-ugc a admin-dam: **nič** (každý má len `default`).

## Body

**1. Cache podľa mena** (`author/composables/cachedAuthors.ts`, `keyword/composables/cachedKeywords.ts`,
`author/composables/cachedUsers.ts`). V každom súbore mapa meno → `defineCached`, urobená pri prvom použití mena;
`default` sa robí s modulom (dnešná inštancia). Fetch číta `useCommonAdminCoreDamOptions(meno)` a ext systém mena v čase,
keď sa pýta (používatelia bez ext systému, s voľbami `'id'`, 1 000, `retryNotFound: false`, adresa ostáva
`/adm/v1/user`). `useDamCachedAuthors(configName?)`, `useDamCachedKeywords(configName?)`, `useDamCachedUsers(configName?)`,
interné `useDamCachedAuthorsForRemoteAutocomplete(configName?)`, `useCachedKeywordsForRemoteAutocomplete(configName?)`;
meno vynechané podľa pravidla L1 (zdedené v setupe, inak `default`). `pin`/`unpin` pracujú na cache mena.

**2. Ext systém podľa mena** (`composables/extSystemIdForCached.ts`). `useExtSystemIdForCached(configName?)`: `ref` na
meno, `default` dnešný. V rámci mena posledný zapísaný.

**3. Všetko, čo cache plní, číta alebo zapisuje ich ext systém, pod svojím menom.**
- Plniace: konfliktné čipy detailu (`AssetMetadata`), `prime` väzby zoznamu (`uploadQueueBindings`), klik vo výbere
  assetov (`assetSelectListActions`: tri cache aj ext systém), vytvorené kľúčové slovo a autor
  (`KeywordRemoteAutocompleteWithCached`, `AuthorRemoteAutocompleteWithCached`) a ich `:use-cached` (funkcia, ktorá
  vráti cache ich mena).
- Čítajúce: tri čipy (`useDamConfigName()`; autorský čip podľa svojho nového `configName`), panel súboru
  (`AssetFileInfoPanel`, používatelia mena).
- Zapisovatelia a čitatelia ext systému: tri vnútorné widgety, `AImageWidgetMultiple`, `ImageWidgetMultipleItem`,
  `ImageMassOperations`, `ImageDetailDialogMetadata`, `imageDialogDamAuthors`, `useImageMassOperations`
  (`configName ?? 'default'`). Komentáre „ext systém stránky" upravené na „ext systém konfigurácie" (dva v galérii až v c1).
- Obchod fronty a cache usadzovania nemenené (L3).

**4. `ADamAuthorCachedChip`** má nepovinný `configName`, zdedený, keď chýba.

*Editor vidí:* pod pomenovanou konfiguráciou čipy, vstupy, panel súboru a dialógy obrázka ukazujú mená, ktoré dá DAM
tej konfigurácie, pýtané jej klientom (autori a kľúčové slová na jej adresách a pod jej ext systémom). Doplnok
vedúceho: detail a dialóg obrázka pod menom, ktorého widget nezapísal ext systém posledný, sa otvoria bez výnimky „Ext
system must be initialised." a s pravidlami svojej konfigurácie.

## Changelog a príručka

Added: nepovinné parametre štyroch verejných funkcií a `configName` autorského čipu. V položke pomenovaných
konfigurácií: cache mien a ich ext systém sú podľa konfigurácie; veta „the caches of names … are the page's and go by
`default`" preč (ostáva len o notifikáciách). V položke adries autorov a kľúčových slov preč rada pomenovať adresy aj v
`default`. `installation.md` rovnako. Komentár `endPointAuthor` v `AnzuSystemsCommonAdmin.ts` upravený.

## Prípady a ohyby

- Nové: `damNamedConfigurationCaches.test.ts` (12: čip autora × dané meno / vnútri, čip kľúčového slova, jeden autor
  pod oboma menami, panel súboru, konfliktné čipy detailu, `prime`, klik vo výbere, vytvorené kľúčové slovo bez
  dopytu, meno jednej cache sa nestratí, keď sa druhá plní × 2, `useDamCachedAuthors()` bez mena mimo setupu je
  `default`) a `damNamedConfigurationExtSystem.test.ts` (7: dva widgety dvoch mien × poradie — každá cache sa pýta pod
  svojím ext systémom; detail widgetu pod menom, keď druhý widget zapísal posledný — bez výnimky, s pravidlami svojej
  konfigurácie × poradie (doplnok); hromadné operácie obrázkov a dialóg obrázka pod `own` — autori pod ext systémom
  `own`; dialóg widgetu pod `own` hľadá mená autorov daných medzitým pod ext systémom `own` (cesta
  `imageDialogDamAuthors`, licencia neznáma)).
- Na snímku: **19 z 19 červených**, všetky pre správanie (iný klient, iný ext systém, výnimka v detaile, jedna cache).
- Ohyby: b1 jedna cache pre všetky mená → 14 červených; b2 jeden ext systém pre všetky mená → 14 červených.
- Staré prípady: `damNamedConfigurationComponents` a `damAuthorKeywordEndpoints` zapisujú v nastavení ext systém `own`
  (ako by ho zapísal koreň widgetu pod `own`; profil zapisuje ten `default`). Bez toho dva prípady padli **zo správneho
  dôvodu**: vnútorný widget, resp. `useImageMassOperations('own')`, montovaný bez koreňa, nemal pre `own` zapísaný ext
  systém (0) — „hromadná operácia, ktorá plní autorov" (`damNamedConfigurationComponents`) a „widget viacerých obrázkov"
  (`damAuthorKeywordEndpoints`). Komentáre o cache stránky v oboch súboroch zosúladené. Tvrdenia nemenené.

## Kontroly

Formát a linty čisté. Celá kontrola: `testy` 380 súborov, 5 343 testov zelené, bez opakovaní; `linty` zelené.

## Mimo kroku (len poznámka)

- Vytvoreného autora pod menom prípad nepokrýva (kľúčové slovo áno, rovnaká cesta `afterCreate` → `addManual`).
- Cache sa robí aj pre meno, ktoré v `coreDam.configs` nie je (ako obchod v L1); jej dopyt potom zlyhá na „Composable
  can't be used…" (cache chybu zachytí ako každú inú).
- Fake DAM v starom prípade vytvorenia kľúčového slova (`damNamedConfigurationComponents`) vracia `{ id: 'created',
  ...telo }`, kde `id` tela prepíše `created`; prípad id nekontroluje (v novom prípade opačné poradie).

## c1

Posudky `posudky/PV14c-L2-claude.md` (4 nízke, mimo) a `PV14c-L2-codex.md` (súhlasí; neznáme meno do kroku).

1. **Posledný prípad `damNamedConfigurationExtSystem`** si ext systém `own` zapíše sám (ako klik vo výbere widgetu);
   `beforeEach` nuluje oba ext systémy. Zelený aj sám (`-t`).
2. **Kde čip pripína a kam ide vytvorený autor.** Prípad „pinned name" zo zadania bol v kroku napísaný bez pripnutia
   (pripnuté meno na snímku s jednou cache prežije každé plnenie, červený by nebol); ostáva ako „meno jednej cache sa
   nestratí, keď sa druhá plní". Nové: čip autora pod `own` drží svoje meno, keď sa cache `own` naplní nad 1 000 (ohyb:
   čip pripína v cache `default` → červený); autor vytvorený vo vstupe daného `own` (rodič bez mena = `default`) je v
   cache `own` a čip ho ukáže bez dopytu (ohyb: vstup bez mena → červený).
3. **Neznáme meno.** Verejné vstupy troch cache (`useDamCachedAuthors`, `useDamCachedKeywords`, `useDamCachedUsers`,
   a cez ne `configName` čipu) overia meno vo voľbách skôr, než cache urobia (len iné ako `default`): neznáme meno
   vyhodí „Composable can't be used…" a cache nedostane, ani pri druhom pokuse. Čip autora s `configName` preklepom
   spadne v setupe. Prípady 2 (ohyb: cache pred kontrolou → oba červené).
4. **Dokumenty.** Changelog `:75` (cache sa robí pri prvom pýtaní mena, `default` s knižnicou, neznáme meno hádže;
   kto zapisuje ext systém mena, aplikácia mimo widgetov ho zapíše sama; obmedzenie do L3: obchod fronty plní cache
   `default` aj pre pomenovanú frontu, `default` sa pýta svojho klienta, čipy pod menom svojej cache); pravidlo
   vynechaného mena platí v setupe, pri vykresľovaní a v háčiku životného cyklu (nie po `await`) — aj v JSDoc;
   `:176` a `:195` už nehovoria o cache/ext systéme stránky. `installation.md` veta o zapisovateľovi ext systému.
   Komentáre `ImageWidgetMultipleInner.vue:528,626`.

*Editor vidí:* nič nové.

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 380 súborov, 5 347 testov zelené, bez opakovaní; `linty`
zelené. Záplata kroku s cyklom: 29 súborov, 1 628 riadkov.

**Mimo (len poznámka, posudok Claude).**
- Čipy používateľov v paneli súboru nemajú plniča okrem kliku vo výbere: detail otvorený cez „upraviť asset" widgetu
  alebo riadku fronty pre asset, na ktorý sa na stránke neklikalo, ukáže dva točiace sa čipy (aj pod `default`; staršie
  ako PV14c). Oprava: detail pridá `createdBy` a `modifiedBy` do cache používateľov svojej konfigurácie.
- Koreň widgetu jedného obrázka (`AImageWidget`, `AImageMediaWidget`) ext systém nezapisuje; „upraviť asset" obrázka,
  ktorého licenciu klient mena nerozlíši, nechá ext systém 0 (ak ho nič iné nezapísalo) a detail spadne na „Ext system
  must be initialised." (staršie, aj pod `default`; prípad doplnku — iný widget zapísal posledný — je uzavretý).

## c2

Posudok `posudky/PV14c-L2-c1-codex.md` (dva nálezy ku kontrole mena v troch cache z c1).

1. **Meno pred inštaláciou pluginu.** Kontrola čítala voľby, ktoré do inštalácie nie sú: platné pomenované meno
   vyhodilo. Nová `checkDamConfigName(name)` (`damConfigName.ts`; v `commonAdminCoreDamOptions.ts` nie, lebo ten modul
   37 testov nahrádza `vi.mock` bez nej) kým voľby nie sú, meno pustí: cache vznikne a jej prvý dopyt meno overí
   (neznáme nechá id nevyriešené, ako doteraz cesta dopytu). `default` prechádza vždy, ako v c1.
2. **Voľby nastavené znova.** Kontrola je pri každom volaní (nie len pri vzniku cache): meno, ktoré nové voľby
   vynechali, hádže aj s cache, ktorú má; keď sa vráti, dostane svoju pôvodnú cache.

Prípady: nový súbor `damNamedConfigurationCacheOptions.test.ts` (2). Na kóde pred c2 oba červené, v oboch poradiach
(poradie prehodené ohybom súboru testov); po c2 oba zelené v oboch poradiach. Ohyb c2-b1 (autori kontrolujú meno len
pri vzniku cache): oba červené. Changelog `:75`: kedy neznáme meno hádže a čo pred inštaláciou.

*Editor vidí:* nič nové.

**Kontroly c2.** Formát a linty čisté. Celá kontrola: `testy` 381 súborov, 5 349 testov zelené, bez opakovaní;
`linty` zelené. Záplata kroku s cyklami: 31 súborov, 1 804 riadkov.
