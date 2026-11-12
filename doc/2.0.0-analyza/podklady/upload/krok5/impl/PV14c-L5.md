# PV14c-L5: kľúče adries, `currentUser`, `adminDomain` a `apiTimeout` podľa konfigurácie; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L5.md`, plán `plan-PV14c.md` (predbežné voľby vedúceho 1, 3, 4, 6).
Strom LIB `/home/volar/projects/anzusystems/common-admin` (vetva `next`, PV14c-L1 až L4 necommitnuté). Snímok
**`PV14c-L5`** (s changelogom a príručkou), záplata `krok5-praca/zaplaty/PV14c-L5.diff` (35 súborov, 1 499 riadkov).
Všetky body hotové, žiadny nezastavený.

Čo vidí redaktor admin-cms, admin-ugc a admin-dam: **nič** (žiadny kľúč, `currentUser` `dam`, koreňové `adminDomain` a
`apiTimeout`).

## Body

**1. Kľúče adries** (`CommonAdminCoreDamConfig`): `endPointConfiguration`, `endPointPubConfiguration` (voľba vedúceho 3,
hoci zadanie ju dáva mimo), `endPointAssetLicence`, `endPointAssetCustomForm`, `endPointUser`, `endPointPodcast`,
`endPointCmsAsset`; mená zo zadania. Predvoľby v novom `api/damEndPoints.ts` (čítajú ich API aj voľby, ani jeden
nenačíta druhý). `damEndPointsOf(name)` (`commonAdminCoreDamOptions.ts`) nehádže: bez nakonfigurovaného pluginu alebo
bez tej konfigurácie predvoľby (`Object.hasOwn`); `useCommonAdminCoreDamOptions` ich vracia tiež. API s nepovinnou
adresou (predvoľba dnešná): `fetchConfiguration`, `fetchPubConfiguration`, `fetchExtSystemConfiguration`,
`fetchDamAssetLicence`, `fetchAssetCustomFormElements`, `fetchDistributionCustomFormElements`, `fetchDamUserListByIds`,
`useFetchDamUserList`, `fetchDamPodcastListByIds`, `useFetchDamPodcastList`, `fetchAssetAsCmsMedia`. Čítajú ich:
`useDamConfigState` (pri každej požiadavke, podľa svojho mena), cache používateľov, `useDamUserSelectAction(client,
endPoint?)` vo filtri a vo vstupe používateľov (vstup s `client` ostáva na pevnej adrese), akcie podcastov, čítanie
vybraného assetu v `ImageMediaWidgetInner`. `/adm/v1/cms/asset/` + `:id` je teraz `endPoint + '/:id'` (tá istá URL).

**2. `currentUser?: string | false`** (predvolené `dam`): `filterAllowedImageWidgetSelectConfigs(values, configName?)`
a `isImageWidgetUploadConfigAllowed(value, configName?)` súdia `useCurrentUser(<systém>)`; `false` povolí všetko.
Systém `?? 'dam'` aj v pomôcke (testy, ktoré voľby mockujú bez `currentUser`). Volajúci (tri koreňové widgety, dva
výbery, `AAssetListInner`) dávajú svoje meno; `skipCurrentUserCheck` ostáva pred volaním, teda vyhráva.
`ImageMediaWidgetInner` bez `skipCurrentUserCheck` (voľba 6).

**3. `adminDomain?`, `apiTimeout?`** konfigurácie, inak koreňové (`useCommonAdminCoreDamOptions` ich vracia):
`DamAdminAssetLink`, `libraryUploadPreset(configName)` (veľkosť chunku), `withinWaitLimit(wait, requests, configName)`
(číta voľby bez hádzania, `Object.hasOwn`) a jeho šiesti volajúci s menom.

**4. `useCommonAdminImageOptions`**: `Object.hasOwn`.

Mapy podľa mena: nová žiadna (`damEndPointsOf` a `withinWaitLimit` čítajú `configs` cez `Object.hasOwn`).

## Rozhodnutia

- Kľúč `/pub/v1/configuration` pridaný podľa predbežnej voľby vedúceho 3 (zadanie ho vynechávalo).
- Komponenty a funkcie len s klientom ostali na pevných adresách (voľba 1), v príručke ako obmedzenie.
- Starší prípad `consumerProfileOptions.test.ts` (dva) rozšírený o nové vyriešené členy (adresy, `currentUser`,
  `adminDomain`, `apiTimeout`): vymenúva celý výsledok `useCommonAdminCoreDamOptions()`.

## Prípady

Nové súbory: `dam/__tests__/damNamedConfigurationKeys.test.ts` (13) a `damNamedConfigurationCurrentUser.test.ts` (9).
Na snímku (28 zmenených zdrojov starých) **13 červených**; zelené sú stráže `default` (rovnaké adresy, odkaz, chunky,
čakanie, `useDamConfigState(client)` bez pluginu, neznáme meno, zoznam pod `default`, `skipCurrentUserCheck` vyhráva).
- adresy pod `own` (nastavenia, verejná konfigurácia, ext systém, licencia, vlastný formulár, formulár distribúcie,
  používatelia cache, podcasty) a pod `default` dnešné; bez pluginu dnešné bez hádzania; čítanie vybraného assetu
  widgetom obrázka a média pod `own` (výber cez zástupcu);
- `adminDomain` v odkaze, `apiTimeout` vo veľkosti chunku (120 s → [3000], 30 s → [1000 ×3]) a v čakaní (dĺžka
  zadržaného čakania);
- `useCommonAdminImageOptions('constructor' / 'toString')` hádže;
- `currentUser`: pomôcky pod `default` / `own` (`x`), `false` povolí aj bez používateľa; tri koreňové widgety pod `own`
  len na čítanie, pod `default` a `open` nie; zoznam assetov pod `own` hlási nepovolenú licenciu a nepýta nič,
  s `skipCurrentUserCheck` pýta, pod `default` pýta.

Ohyby: b1 kľúč nečítaný (nastavenia `default`ovou adresou) → 1 červený; b2 `currentUser` ignorovaný → 6 červených.

Nepokryté prípadom: `AAssetSelect` a `AAssetSelectMedia` (to isté odovzdanie mena ako `AAssetListInner`), šiesti
volajúci `withinWaitLimit` (pokrytá funkcia). *(c1: zoznam podcastov a vstup a filter používateľov doplnené; veta
„pokrytá cache používateľov a API" platila len pre čítanie podľa id.)*

## Kontroly

Formát a linty čisté. Celá kontrola: `testy` 388 súborov, 5 419 testov zelené, bez opakovaní; `linty` zelené.
admin-dam nekontrolovaný (D1): volá `useDamConfigState(damClient)` pri štarte; bez kľúčov dnešné adresy.

## c1

Posudky `posudky/PV14c-L5-claude.md` (L1–L4) a `PV14c-L5-codex.md` (súhlasí, jeden nález navyše).

1. **`currentUser` so systémom, ktorého používateľ nie je používateľom DAM** (L3 + Codex;
   `damFilterUserAllowedUploadConfigs.ts`): spoločný `licenceJudgeOf` overí tvar používateľa DAM
   (`adminToExtSystems`, `userToExtSystems`, `resolvedAssetLicences` sú polia) **pred** skratkou správcu; iný
   používateľ (aj správca svojho systému) nepovolí žiadnu licenciu a chyba konfigurácie ide do `console.error` (bez
   nového textu). Widget teda opustí načítanie a je len na čítanie, výber hlási existujúce
   `common.assetSelect.error.unallowedLicence` a neotvorí sa. Nie ako `false`. Prípady 2 (správca `cms`, používateľ
   `cms`: pomôcky, koreňový widget, zoznam assetov, zápis do konzoly); ohyby c1-b1a (skratka správcu pred kontrolou →
   1 červený), c1-b1b (bez kontroly tvaru, ako pred c1 → 2 červené).
2. **`useDamConfigState(client, meno)`** (L4): `checkDamConfigName(name)` na začiatku: po inštalácii neznáme meno
   hádže ako cache mien; pred inštaláciou a pre `default` nič (`damEndPointsOf` naďalej predvoľby bez hádzania).
   Prípad; ohyb c1-b2 → červený.
3. **Prípady adries** (L2): zoznam podcastov (`fetchItems`) v prípade adries pod `own`/`default`; vstup používateľov pod
   `own` (jeho `endPointUser`), vstup s `client` (pevná `/adm/v1/user` na tom klientovi), filter používateľov pod `own`
   (čítanie podľa id aj zoznam, cez zástupcu vnútorného vstupu). Ohyby: c1-b3 (zoznam podcastov bez adresy), c1-b4
   (filter bez adresy), c1-b5 (vetvy vstupu prehodené) → každý červený.
4. **Dokumenty** (L1 + L3): príručka `:65` (používatelia na `endPointUser`), `:67` (zoznam toho, čo berie len klienta
   a ostáva na pevných adresách, podľa posudku; zmazaná veta o `/adm/v1/cms/asset/…`), changelog `:77` (to isté),
   `:229`, `:231` (čakanie podľa `apiTimeout` konfigurácie, inak koreňového), „Added" (`currentUser` musí byť
   používateľ DAM, inak žiadna licencia; `apiTimeout` je timeout jej `damClient`, ktorý knižnica nenastavuje;
   `useDamConfigState` hádže pre neznáme meno), JSDoc `currentUser` a `apiTimeout`, prop `client` v
   `DamUserRemoteAutocomplete` („at `/adm/v1/user` (not `endPointUser`)"). Veta poznámky o pokrytí opravená vyššie.
5. **Len poznámka:** `apiTimeout: 30` admin-cms a admin-ugc: nesúlad s timeoutom ich klienta, ktorý posudok uvádza mimo kroku.

*Editor vidí:* nič nové v troch adminoch.

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 388 súborov, 5 425 testov zelené, bez opakovaní;
`linty` zelené. Záplata kroku s cyklom: 35 súborov, 1 690 riadkov.

