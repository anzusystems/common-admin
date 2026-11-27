# PV14c-L6: mená povinné vo vnútri knižnice, strážca, dokumenty ako celok; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L6.md`, plán `plan-PV14c.md`. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (vetva `next`, PV14c-L1 až L5 necommitnuté). Snímok **`PV14c-L6`** (s
changelogom a príručkou), záplata `krok5-praca/zaplaty/PV14c-L6.diff` (86 súborov, 3 105 riadkov; väčšinu tvoria
testy, ktorým pribudlo meno). Všetky body hotové, žiadny nezastavený.

Čo vidí redaktor: **nič**.

## Body

**1. Vnútorné prístupy vyžadujú meno** (žiadny nie je v `src/lib.ts`, overené): `useCommonAdminCoreDamOptions`,
`damEndPointsOf`, `useAssetSelectActions`, `usePodcastSelectActions`, `useAuthorSelectActions`,
`useKeywordSelectActions` (bez `?? 'default'`), `useImageMassOperations` (bez `?? 'default'`), `useImageValidation`,
`useDamExternalProviderAssetType` (bez dedenia, meno dáva volajúci), `useDamCachedAuthorsForRemoteAutocomplete`,
`useCachedKeywordsForRemoteAutocomplete`, `useUploadQueueItemRefresh`, `libraryUploadPreset`, `withinWaitLimit`
(aj `requests`), `showMetadataSaveError`, `filterAllowedImageWidgetSelectConfigs`, `isImageWidgetUploadConfigAllowed`
(a `licenceJudgeOf`), `setDamNotificationsPushAlive`, obchod fronty `addByFiles`, `addByCopyToLicence`,
`noteRowsOfAsset`, `updateFromDetail`, obchod detailu `setSaving`, `savingOf`. Verejné (`useDamConfigState`,
`useDamConfigStoreOf`, `useDamCached*`, `useExtSystemIdForCached`, `useDamNotificationsConnection`,
`useDamUploadChunkSize`, `useDam*AssetTypeConfig`, `useDamDistributionServiceType`, `useCommonAdminImageOptions`)
ostávajú s nepovinným menom. `lint:tsc` našiel dve volania bez mena: `libraryUploadPreset(configName?)` pre
predvolenú sadu `useUpload` (teraz `libraryUploadPreset('default')`: verejné `useUpload` bez sady je `default`-ové,
ako bolo) a `playground/tableView/authorActions.ts` (`'default'`). Testom, ktoré volali vnútorné prístupy bez mena
(253 volaní v 62 súboroch, skript nad zátvorkami argumentov) alebo s `undefined` (7), pribudlo `'default'`; jeden
riadok prípadu L3 („A name left out is `default`") pre `savingOf` odpadol.

**2. Strážca** `src/test/damConfigNameGuard.test.ts`: číta zdroje `src/domains/dam` mimo testov (`?raw`, ako strážca
kľúčov i18n; negatívny glob sa neuplatnil, testy sa vyfiltrujú v kóde), bez komentárov, a pre 37 prístupov (s pozíciou
mena) počíta argumenty každého volania; definícia (`function x(`) sa preskočí. Povolené dva, s dôvodom: `useDamConfigStore`
v `damConfigStore.ts` (implementácia pravidla: obchod `default` je `useDamConfigStore()`) a
`useDamNotificationsConnection` v obchode fronty (len `onChange`, ktorý volá zmena ktoréhokoľvek soketu). Druhý prípad
overí samotný parser na podsadených riadkoch (prázdne, viacriadkové, s čiarkou na konci, v komentári, definícia).

**3. Zvyšné `'default'` v `src/domains/dam`** (mimo testov), všetky zámerné:
- `uploadQueuesStore.ts` `configOf`: front, ktorému obchod meno nedal, je `default` (PV14a);
- `uploadQueuesStore.ts` `othersTakeWrite`: `RowsNote.configName` je v type nepovinné (poznámka zvonka); *(c1: dôvod neplatil, odstránené)*
- `commonAdminCoreDamOptions.ts` sokety: soket `default` z koreňovej voľby a vynechanie `default` v cykle ostatných;
- `uploadPresets.ts` `adminDamUploadPreset`: strana admin-dam je `default`;
- `uploadService.ts`: predvolená sada verejného `useUpload`;
- `queuePresets.ts`: `configOf` presetu je nepovinné („left out, every queue is under `default`");
- `damNotificationsConnection.ts`, `damConfigStore.ts` `useDamConfigStoreOf`, `commonAdminImageOptions.ts`: verejné
  s predvoleným `default`;
- `damNotifications.ts`: soket `default` hádže pri odmietnutej adrese; voľby poslucháča bez mena = `default`;
  udalosť bez pôvodu = `default`;
- `extSystemIdForCached.ts`, `cachedAuthors.ts`, `cachedUsers.ts`, `cachedKeywords.ts`: `default` urobený s modulom;
- `damConfigName.ts`: pravidlo dedenia (inak `default`) a výnimka `checkDamConfigName`;
- `AAssetListInner.vue` `variant: 'default'`: iný význam (vzhľad).
Zabudnuté meno v produkcii: žiadne (strážca na snímku našiel len `libraryUploadPreset()` v `useUpload`, zámerne
`default`). Prípad „červený pred" preto netreba.

**4. Dokumenty ako celok.** Changelog: položky „More of a DAM configuration under its name" (L5), „DAM notifications
per configuration" (L4), „DAM author and keyword endpoints" a „A named DAM configuration holds…" (PV14a, L1–L3) sú
jedna položka „Named DAM configurations, each a DAM of its own" s podbodmi: čo konfigurácia drží (klient, všetky
adresy s predvoľbami, jej DAM konfigurácia, cache mien a ich ext systém, notifikácie, `currentUser`, `adminDomain`,
`apiTimeout`), ako komponent a verejný composable nájdu meno (aj neznáme meno), fronty, notifikácie, čo dá aplikácia
s pomenovanou konfiguráciou, obmedzenia, ktoré ostávajú (stavy rozhrania pre stránku, posledný ext systém v mene, meno
raz v setupe, jedno meno na front, jedna adresa = jeden DAM, funkcie len s klientom), typy. „Changed" (`AImagePublicInput`)
a „Fixed" (meno `image.configs`) ostali. Príručka `:62-68` prepísaná rovnako (päť bodov). Veta „one core-dam" bola
len v komentároch dvoch testov: prepísaná.

## Kontroly

Formát a linty čisté. Strážca: zelený na strome; na snímku červený (`uploadService.ts libraryUploadPreset`); ohyb b1
(podsadené `useCommonAdminCoreDamOptions()` v `DamAdminAssetLink.vue`) červený. Celá kontrola: `testy` 389 súborov,
5 429 testov zelené, bez opakovaní (prvý beh: 6 červených, testy s `updateFromDetail(…, undefined, …)`, opravené);
`linty` zelené (`lint:tsc` dokazuje bod 1). `lint:tsc:test` prešiel bez chyby, hoci testy vtedy ešte volali bez mena
— zrejme nekontroluje (`--build` bez zmien?); nespoliehal som sa naň.

## c1

Zadanie `zadanie-PV14c-L6-c1.md`; posudky `posudky/PV14c-L6-claude.md` (M1–M6, L1–L6) a `PV14c-L6-codex.md`. M6 opravil
vedúci v `ck-lib.sh` (časť lintov spúšťa `vue-tsc -p tsconfig.test.json --noEmit`; v c1 zelené).

1. **M1, strážca podľa typu, nie počtu.** Nový strážca `src/test/eslint/damConfigNameGuard.test.ts` beží v node
   (`test:eslint`, časť lintov): TypeScript v prehliadači nejde (pokus: `typescript` by sa musel pridať do
   `optimizeDeps`, mimo mojich súborov, inak vite stránku znovu načíta). Zoznam prístupov je spoločný
   (`src/test/support/damConfigNameAccessors.ts`). Číta `src/domains/dam` mimo testov kompilátorom TypeScript (skripty
   `.vue` zvlášť, šablóna regexom) a meno prijme len ako: reťazec; výsledok `useDamConfigName`/`inheritedDamConfigName`
   (aj cez premennú); parameter alebo premennú typovanú `string` (`UploadQueueRowsOf`), nie `?`, alebo s reťazcom ako
   predvoľbou; prop komponentu bez `?` (`defineProps<{…}>`); `x ?? <meno>`, podmienku dvoch mien, volanie funkcie
   súboru, ktorá meno vracia (typ `string` alebo šípka s menom), metódu parametra typovanú na mieste
   (`store.configOf(…)` v `queuePresets.ts`), `{ queueKey }`. `undefined`, nepovinný prop alebo parameter a všetko
   ostatné nie. Volanie v šablóne je zakázané; `useDamConfigStore` (berie Piniu, nie meno) je dovolené len vnútri
   `useDamConfigStoreOf`; výnimka soketu je len `useDamNotificationsConnection().onChange` v obchode fronty (a test, že
   je jediná). Jediné meno, ktorého typ parser nevidí, s dôvodom: `useDamUploadChunkSize(…, configName)` v
   `uploadService.ts` (`configName` z členov sady, typ `string`). Premenované rozbalenie (`{ savingOf: wait }`),
   generické (`withinWaitLimit<T>`) a voliteľné (`addByFiles?.()`) volanie, metóda, rozbalené pole a rozbalenie
   neznámeho majú prípady parsera (40 riadkov a dva komponenty). Predchádzajúci súbor `src/test/damConfigNameGuard.test.ts` (zmazať
   nesmiem) teraz drží zoznam pri živote: každý prístup je funkcia domény, každá metóda metóda svojho obchodu.
   Na snímku strážca červený (7 nálezov: vnútorné prístupy s nepovinným menom pred L6, `libraryUploadPreset()`,
   `store.configOf?.()`); ohyb na kópii domény (`c1l6-ohyb-dam`, `DAM_GUARD_ROOT`) s `useDamConfigStoreOf(props.configName)`
   v `DamAdminAssetLink.vue` (len strážca ho chytí, typ je v poriadku) červený.
2. **M2.** Päť funkcií usadenia obchodu (`queueItemProcessed`, `queueItemFullyProcessed`, `queueItemDuplicate`,
   `queueItemFailed`, `refreshAsset`) má `of: UploadQueueRowsOf` povinné (`queueItemDuplicate` aj pôvodný súbor a typ,
   bez predvolieb); `targetOf` vždy menuje konfiguráciu. Sú v zozname strážcu (pozície 2, 2, 4, 3, 2; `settlement.refreshAsset`
   je iná funkcia); prípady parsera. Testy: 18 volaní dostalo `'default'`, jedno (rad `own`) `{ queueKey: QUEUE }`.
3. **M3–M5, dokumenty.** Changelog: predtým klient a tri adresy (`endPointAsset`, `endPointImage`, `endPointRoi`), nové
   kľúče `endPointAuthor` …; granty a prepínače „všetky nové v 2.0.0" (`roiUpdateAcl`, `imageRotateAcl`,
   `keywordCreateAcl`, `authorCreateAcl`, `copyToLicenceEnabled`); „share none of it but the user of the licence check"
   (bez vlastného `currentUser` súdi používateľ `dam`) aj v príručke; vrátené fakty: dráhy čítaní a séria zlyhaní na
   konfiguráciu v obchode knižnice, načítače `useDamConfigState` (aj `loadDamPubConfig`) na adresách konfigurácie a pred
   nastavením `coreDam` na predvolených bez hádzania, vstup a filter používateľov na `endPointUser`, podcasty na
   `endPointPodcast`, čipy, vstupy, panel a dialógy s menami svojho DAM; vety o dedení menujú aj `default`-ové
   verejné vstupy (`useCommonAdminImageOptions()`, `useDamUpload()` bez sady, `addDamNotificationListener(cb)`), v
   príručke deviatku dediacich menovite.
4. **Nízke.** L1: `skipCurrentUserCheck` výberu, a `AImageWidgetInner`/`AImageWidgetMultipleInner` pre ich výber;
   voľba vlastníka 6 (`AImageMediaWidget` ho nemá, `currentUser: false`) v obmedzeniach changelogu aj príručky. L2:
   komentár `showMetadataSaveError`. L3: `RowsNote.configName` a `configOf` presetu fronty povinné (bez `?? 'default'`;
   testy jadra `configOf: () => 'default'`). L4: dva názvy testov. L5: príručka „Once the plugin has set `coreDam`".
   L6: medzery strážcu vyššie. `src/test/README.md` spomína strážcu v node.

*Editor vidí:* nič.

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 389 súborov, 5 467 testov zelené, bez opakovaní (prvý
beh: jeden červený, môj `'default'` v prípade radu `own`, opravený; a pád spojenia s prehliadačom v
`createAnzuVuetify.test.ts`, v druhom behu nie); `linty` zelené (`test:eslint` 8 súborov, 127 testov so strážcom;
`lint:tsc`; typová kontrola testov). Záplata kroku s cyklom: 90 súborov, 3 784 riadkov.

## c2

Posudok `posudky/PV14c-L6-c1-codex.md`.

1. **Strážca číta aj premenovaný import a volanie hranatými zátvorkami.** `calleeName` berie aj
   `store['refreshAsset'](…)` (reťazec v zátvorkách), `receiverOf` dáva príjemcu oboch tvarov (výnimka
   `settlement.refreshAsset` platí pre oba), aliasy aj z `import { useX as y }`. Riadky parsera: 6 nových
   (`store['refreshAsset'](id)` bez mena, s menom; `settlement['refreshAsset'](target)`; `usersOf()` a `usersOf('own')`
   z premenovaného importu; premenovaný `useDamConfigStore`). Pred c2 by `calleeName` pre hranaté zátvorky vrátil
   `null` a import by alias nedal, teda riadky bez mena by nedali nález (nespúšťané: starý súbor testu v strome nemám).
2. **Hranica strážcu** v hlavičke testu: dokazuje, že meno je odovzdané podľa typov, nie že je správne; reťazec alebo
   `string` pevne `'default'` v komponente pod `own` prejde a prop bez `?` môže byť za behu `undefined`, ak ho rodič
   vynechá.
3. **Dokumenty** (changelog `:76`, príručka `:64`): `default` sa tam nekontroluje (`checkDamConfigName`); bez
   `default` v `coreDam.configs` jeho cache nechajú pýtané mená nevyriešené (ich dopyt hádže), `useDamConfigState(client)`
   načíta daným klientom na predvolených adresách a komponent pod `default` hádže v setupe.

**Kontroly c2.** Formát a linty čisté. `testy` 389 súborov, 5 467 testov zelené, bez opakovaní; `linty` zelené
(`test:eslint` 8 súborov, 133 testov). Záplata kroku s cyklami: 90 súborov, 3 801 riadkov.

