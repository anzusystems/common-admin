# STATS-ADMIN: dashboard štatistík kolaborácie v admin-cms (Živé / 7 dní / 30 dní, detail relácie)

Zadanie `krok5-praca/zadania/zadanie-stats-admin.md`, návrh `COLLAB-STATS.md` §10.9.2 (taby, tvary, mockup), §9.4
(route, guard, menu, doména, grafy, polling), §10.1 (kategórie). Kontrakt: `STATS-CMS.md` §1 a `STATS-C.md` §1.
Repozitár `/home/volar/projects/petit/admin-cms`, vetva `feature/collab-stats` nad `78e53d48b`, **necommitnuté**.
Skripty a logy v `krok5-praca/stats-admin/`. **Overené** = test alebo kontrola; **odvodené** = môj záver.

## 1. Čo pribudlo

### 1.1 Route, prístup, menu

| Čo | Kde |
|---|---|
| `/(cms)/collab-stats` → `/collab-stats`, taby Živé / 7 dní / 30 dní | `src/pages/(cms)/collab-stats/index.vue` |
| `/(cms)/collab-stats/sessions/[id]` → `/collab-stats/sessions/:id([0-9a-f]{24})`, detail relácie | `src/pages/(cms)/collab-stats/sessions/[id].vue` |
| Príznak `superAdminOf?: string` v `RouteMeta`; obe stránky `superAdminOf: SYSTEM_CMS`, `requiredPermissions: []` | `src/plugins.d.ts` |
| Guard: ak route má `superAdminOf` a `useCurrentUser(system).isSuperAdmin` nie je `true`, vráti `/unauthorized` (pred kontrolou práv a pred `superAdminOfParam`) | `src/plugins/router/checkRequirements.ts` |
| Položka menu za Systémovými úlohami, `v-if="isSuperAdmin"` (`useCurrentUser(SYSTEM_CMS)`) | `src/domains/system/components/sidebar/SidebarSystemItems.vue` |
| Breadcrumbs `breadcrumb.cms.collabStats.list` a `.detail`, menu `sidebar.content.collabStats` | `src/locales/{sk,en}/breadcrumb.json`, `sidebar.json` |

Skupina Systém sa super adminovi zobrazí vždy (`can()` mu vracia `true`), novú podmienku do `resolveListGroups`
netreba.

### 1.2 Doména `src/domains/cms/collabStats/`

| Súbor | Obsah |
|---|---|
| `api/collabStatsApi.ts` | `useFetchCollabStats{Live,LiveRooms,Summary,People,Sessions,Session}` cez `useApiRequest` + `cmsClient` (zoznam s `cancelPrevious`); `collabStatsUrl(path, query)` skladá `/adm/v1/collab-stats<path>?entity=article&…` bez prázdnych hodnôt |
| `types/CollabStats.ts` | typy odpovedí podľa STATS-C §1 a STATS-CMS §1.1 vrátane `docId`, `articles`, `users` |
| `valueObject/CollabSessionCategory.ts`, `CollabPeakBucket.ts` | kategórie (`clickThrough`, `presenceOnly`, `separateEdits`, `realCollab`) a koše (`2`, `3`, `4`, `5plus`) s textami |
| `composables/collabStatsLoad.ts` | `collabStatsFailureOf(error)`: 429 → `tooManyRequests`, 503 s `error: 'disabled'` → `disabled`, iná 503 → `unavailable`, 404 → `notFound`, inak `error`; `useCollabStatsLoad(request, url)` = dáta, chyba, `loading`, `load` (chyba zahodí staré dáta, zrušená požiadavka nič nemení, abort pri odchode) |
| `composables/collabStatsLive.ts` | živý tab: `live` + `live/rooms?bucket=twoPlus` + `live/rooms?bucket=one` naraz, `useIntervalFn` 10 s, `useDocumentVisibility` (skrytá karta → `pause`, viditeľná → hneď znova a `resume`), koniec scope (odchod zo stránky alebo z tabu) → stop a abort; počas čakajúcej odpovede sa nepýta znova; pri chybe ostane posledná odpoveď; zapíše sa len prvá chyba série (`report: false` pre ďalšie) |
| `composables/collabStatsSessions.ts` | zoznam relácií: filter (triedenie, koše, kategórie, človek, článok `docId`), prvá strana vymaže zoznam, „Načítať ďalšie" pridá stranu podľa `nextCursor`, dvojklik nepošle dvakrát, zmena filtra zruší rozbehnutú stranu (`cancelPrevious`), „Skúsiť znova" zopakuje tú istú stranu; `collabStatsSessionsQuery`: s `userId` len `days`, `userId`, `cursor`; s `docId` len `days`, `docId`, `cursor` |
| `composables/collabStatsFormat.ts` | trvania (`45 s`, `34 min`, `2 h 10 min`, zaokrúhlené nadol), čas, deň `D.M.`, meno z `users` alebo `#id`, `useCollabStatsFieldLabel` (popisy polí, §1.4) |
| `composables/collabStatsTab.ts` | aktívny tab v module (vzor `promptDetailTab.ts`): späť z detailu sa otvorí ten istý tab |
| `components/CollabStatsLive.vue` | obnovené `generatedAt` „každých 10 s", 4 karty (s 1 človekom, s 2+ ľuďmi, rôzni ľudia, inštancie), `VDataTable` miestností 2+ (článok, od, moderátor, zamknuté polia s človekom, účastníci „meno od; telo / polia / zámky", `null` = „–"), `VDataTable` miestností s 1 človekom (článok, človek, od), „Zobrazených X z Y" nad 200 |
| `components/CollabStatsPeriod.vue` | 7 alebo 30 dní: obdobie a čas výpočtu, Obnoviť, `partialDays` ako varovanie, prázdne obdobie, karty Sólo (prekliky, ø trvanie) a 2+ (skutočné, ø trvanie), riadok ukončených odhadom / neúplných / zahodených, tabuľka podľa počtu ľudí (2, 3, 4, 5+, Spolu) s kategóriami, ø trvaním, ø spolu, telom, poliami, ø editormi a tlačidlom „zobraziť relácie" (nastaví filter koša), grafy, ľudia, zoznam |
| `components/CollabStatsDailyChart.vue`, `CollabStatsHourChart.vue` | zdieľané `LineChart` (po dňoch) a `BarChart` ako stĺpce (hodina začiatku); sólo na vlastnej osi, 2+ a skutočná spolupráca na druhej |
| `components/CollabStatsPeople.vue` | `people`: najviac spolupracujúci (klik na meno = filter zoznamu podľa človeka) a dvojice, `overCap` ako poznámka |
| `components/CollabStatsSessionList.vue` | filtre (triedenie začiatok / trvanie / spoločne aktívne, koše a kategórie viacnásobne, človek cez `UserRemoteAutocomplete`, „tento článok" tlačidlom v riadku relácie s `docId` a zrušiteľným čipom s titulkom; s človekom alebo článkom sú ostatné vypnuté a nepošlú sa, článok zruší človeka a naopak), `VDataTable`, „Načítať ďalšie", riadok a `ATableDetailButton` → detail, neúplná relácia s ikonou |
| `components/CollabStatsSessionDetail.vue` | hlavička (článok, čas od – do, trvanie, „N naraz, M spolu", kategória, spoločne aktívne minúty, spolu prítomní, poznámka pri `stale`/`incomplete`) a tabuľka účastníkov podľa `order` (moderátor, prítomný, aktívne min., telo, polia, zámky a odmietnuté, prvá / posledná úprava, zmenené polia „Titulok 3, SEO Titulok 1"), `participantsOverflow` |
| `components/CollabStatsFailureAlert.vue`, `CollabStatsArticleLink.vue`, `CollabStatsCard.vue` | chyba na mieste s „Skúsiť znova" (nie pri vypnutých a nenájdených); odkaz na článok `articles[docId ?? entityId]` → `/(cms)/articles/[docId]` s titulkom, bez záznamu `#id`; karta čísla |

Ostatné: `RESOURCE_CMS.COLLAB_STATS`, farby `--chart-series-collab-{solo,multi,real}` (svetlá aj tmavá téma) v
`src/styles/components/charts.scss`, preklady `src/locales/{sk,en}/cms/collabStats.json` (admin-cms má `sk` a `en`;
`xx.ts` je pseudo bez kľúčov), changelog `doc/Admin-Cms-Changelog/Unreleased/collab-stats.md` (Requirements, Added,
`#TICKET` ako v collaboration, `by @stanislav.volar`). Žiadna nová závislosť.

### 1.3 `collabStatsDocId` (STATS-C §1.1)

`articleCollabActions.ts`: moderátor pri štarte spolupráce pošle vedľa `collabStatsBase` aj
`collabStatsDocId` = `article.docId` (reťazec, nie obálka poľa); `isCollabControlField` ho nepustí do článku
(server bez štatistík by ho nechal v dátach miestnosti a opätovný vstup by ho zapísal). Testy
`articleCollabGathering.test.ts` (moderátor ho pošle, iný nie) a `articleCollabFieldKeys.test.ts`.

### 1.4 Popisy polí

`fieldsChanged` a zamknuté polia nesú surové kľúče kolaborácie. Popis: `other` → „Ostatné", `comment:*` →
„Komentáre", `multiTitleHeadline:X` / `multiTitlePerex:X` → „Nadpis variantu X" / „Perex variantu X", iné `multiTitle*` →
„Varianty titulku a perexu"; `leadImageMedia`, `alternateLinks` a `recommender.*` cez popisy widgetov; inak
`cms.articleKind.model.<kľúč>`, ak existuje (`te`), inak surový kľúč. Test overí, že každý kľúč z `COLLAB_BASE_FIELDS`
plus `leadImageMedia` a `alternateLinks` má popis v `sk` aj `en`.

## 2. Testy (`src/test/collabStats/`, vzor `aiDigestApi.test.ts`)

`cmsStub.ts` nahrádza `cmsClient` skutočnou inštanciou axios s vlastným adaptérom: zapisuje URL, chybový stav
odmietne ako axios (`AxiosError` s odpoveďou), zrušená požiadavka je `CanceledError`. Ide sa teda cez `useApiRequest`
a mapovanie chýb knižnice, nič z nich nie je zamockované.

| Súbor | Čo overuje |
|---|---|
| `collabStatsAccess.test.ts` (7) | guard nad route z `vue-router/auto-routes`: obe stránky pre iného ako super admina → `/unauthorized` (pýta sa systému `cms`), super admin prejde, `/jobs` sa nepýta; položka menu len pre super admina (mount `SidebarSystemItems`) |
| `collabStatsLive.test.ts` (8) | 3 požiadavky hneď a každých 10 s (nie skôr); skrytá karta nič, po zobrazení hneď; po zániku scope nič ani po zmene viditeľnosti; počas čakania sa nepýta znova; rýchla chyba a pomalé súrodenecké požiadavky (M1); 429 → `tooManyRequests`, posledná odpoveď ostane, ďalší tik ju zmaže; 503 → `unavailable`; séria chýb zapísaná raz, ďalšia séria znova |
| `collabStatsSessions.test.ts` (9) | „Načítať ďalšie" s `cursor` a pripojením; po poslednej strane nič; nové načítanie bez kurzora; koše a kategórie ako zoznam; človek aj článok (`docId`) bez triedenia a filtrov aj s kurzorom; dvojklik raz; zmena filtra zruší rozbehnutú stranu bez chyby; „Skúsiť znova" po 429 tú istú stranu |
| `collabStatsMapping.test.ts` (21) | 429, 503 `disabled`, 503 `unavailable`, 404 a 500 → stav (404 súhrnu všeobecná chyba, 404 detailu „nenájdená") a zahodené dáta; ďalšia odpoveď zmaže chybu, URL súhrnu; odkaz na článok podľa `docId`, inak `entityId`, inak `#id`; popisy polí v `sk` a `en`; trvania a mená; každý kľúč `cms.collabStats.*` zo zdrojov a stránok aj doplnené prefixy (chyby, koše, kategórie), breadcrumbs a menu existujú v `sk` aj `en` |

Zmenené: `articleCollabGathering.test.ts`, `articleCollabFieldKeys.test.ts` (§1.3).

**Testy chytia chybu** (`mutacia.sh`, `mutacia.log`, zdroj po každej obnovený z kópie): bez pauzy pri skrytej karte,
bez zábrany počas čakania, bez guardu, položka menu pre všetkých, strana nahradí zoznam, `userId` s ostatnými filtrami,
503 bez rozlíšenia `disabled`, bez popisu `leadImageMedia`, `docId` s ostatnými filtrami, článok podľa `entityId` namiesto
`docId ?? entityId`, editor bez `collabStatsDocId`, `collabStatsDocId` zapísaný do článku → všetkých 12 padne aspoň
v 1 teste; po opravách z posudku 14 z 14 (navyše `Promise.all` namiesto `allSettled` a 404 vždy „nenájdená").

## 3. Kontroly (logy v `krok5-praca/stats-admin/`, všetko cez `flock`, vitest s `VITEST_MAX_WORKERS=2`)

- `yarn generate:dts` 0 (`generate-dts.log`; `typed-router.d.ts` má obe route).
- `lint.sh`: `yarn lint:oxlint` 0, `eslint` na dotknutých súboroch 0, `stylelint` (`charts.scss`, nové `.vue`) 0,
  `oxfmt --check` 0 (`lint.log`).
- `yarn lint:tsc` (vue-tsc --build) 0 (`tsc.log`).
- Vitest dotknutých súborov: 6 súborov, 56 testov OK (`test-collab.log`).
- Celá sada `vitest run` po opravách z posudku: **87 súborov, 2 146 testov OK**, 62 s (`test-all.log`).

Dev server a prehliadač som nespúšťal (zadanie), proti skutočnému core-cms a collaboration to nebežalo; snímka
obrazovky nie je.

## 4. Odchýlky od návrhu a rozhodnutia

1. **`collabStatsDocId`** (§1.3) a filter článku: pôvodné zadanie ich nemalo, doplnil ich vlastník (team lead
   2026-10-24) a STATS-C §1.1, §1.4.
2. **Tab v module, nie v URL** (vzor `promptDetailTab`): späť z detailu ten istý tab; filtre zoznamu sa po návrate
   začnú odznova.
3. **Ľudia a zoznam až po súhrne** (`v-if` na súhrne): pri vypnutej histórii jedno upozornenie namiesto troch, pri
   prázdnom období žiadne ďalšie požiadavky, a nikdy 3 požiadavky naraz (semafor collaboration 4 na pod). Cena: jedna
   cesta navyše pred ľuďmi a zoznamom (odvodené: stovky ms).
4. **Chyby na mieste** (`VAlert`), nie toast: polling by toastoval každých 10 s. 429 má text „skúste znova o chvíľu" a
   tlačidlo, bez automatického opakovania (`Retry-After` sa nečíta); živý tab sa opýta znova sám pri ďalšom tiku.
5. **Polling = 3 požiadavky** (`live` + oba koše `live/rooms`) za 10 s; collaboration ich obslúži z jedného snímku
   (cache 5 s). „Pri 1 človeku stačí zoznam" je tabuľka s 3 stĺpcami.
6. **Filtre košov a kategórií viacnásobné** (API berie zoznam). S človekom alebo článkom sú vypnuté a nepošlú sa (API ich
   odmietne); hodnoty si pamätajú pre chvíľu, keď sa filter zruší. **Článok sa vyberá tlačidlom v riadku relácie**, nie
   vyhľadávaním (jednoduchšie, relácia bez `docId` ho nemá); z detailu relácie ani zo živého tabu sa naň neprechádza.
7. **Nezobrazené**: `durationBuckets` sólo relácií, `counters` relácie a `thresholds` (nie sú v mockupe). V detaile
   navyše trvanie, čas spolu prítomných a poznámka pri odhadnutom konci alebo neúplnej relácii.
8. **Route detailu s regexom** `[0-9a-f]{24}`: preklep v adrese je stránka 404 bez volania API.
9. **Popisy polí** z existujúcich prekladov formulára článku a widgetov; nové texty len pre komentáre, varianty a
   `other`. Pole bez popisu ostane surovým kľúčom.
10. **Mapa článkov `docId ?? entityId`** podľa STATS-CMS §1.1 (§10.9.2 mal len `entityId`); článok bez záznamu je `#id`
    bez odkazu.

## 5. Opravy po posudku (`posudky/STATS-ADMIN-opus.md` na 827934a24)

Necommitnuté nad 827934a24, spolu s filtrom článku (M2).

| Nález | Oprava | Test |
|---|---|---|
| M1 rýchla chyba uvoľnila `loading` pri 2 čakajúcich | `collabStatsLive.ts`: `Promise.allSettled`, `loading` do konca všetkých troch, potom prvá chyba (zrušená nič neukáže); od diváka nikdy viac ako 3 naraz | `collabStatsLive.test.ts`: `live` 503 hneď, `live/rooms` čakajú → 30 s žiadna ďalšia požiadavka, chyba až po dobehnutí, ďalší tik 3 nové |
| M2 filter článku | `docId` vo filtri a dotaze (len `days`, `docId`, `cursor`), tlačidlo v riadku relácie s `docId`, čip s titulkom, človek a článok sa vylučujú | `collabStatsSessions.test.ts` (aj s kurzorom) |
| L1 Obnoviť načítalo ľudí a relácie dvakrát | `CollabStatsPeriod.vue`: znova sa pýtajú len tie, ktoré boli zobrazené pred aj po súhrne; zobrazené až teraz sa pýtajú pri pripojení | – |
| L2 veľké písmená v id | `[id].vue`: `id.toLowerCase()` (vzor route nerozlišuje veľkosť) | – |
| L3 časová zóna | grafy „Po dňoch (čas Bratislavy)", „Podľa hodiny začiatku (čas Bratislavy)" (sk, en) | kľúče v teste prekladov |
| L4 404 súhrnu ako „relácia nenájdená" | `collabStatsFailureOf(error, recordRead)`: `notFound` len pri čítaní jednej relácie (detail), inak všeobecná chyba | `collabStatsMapping.test.ts`: 404 súhrnu → `error`, 404 detailu → `notFound` |
| L5 čísla | `useNumericHelper().formatNumber` (ako inde v admin-cms): karty, tabuľka košov (ø editorov 1 desatinné miesto), stĺpce počtov cez `useCollabStatsCountColumn`, živé úpravy, detail | – |
| L7 test prístupu z textu stránky | `collabStatsAccess.test.ts`: guard dostane route z `vue-router/auto-routes` (`router.resolve`) pre obe stránky a `/jobs`; súbor tým načíta všetky stránky (+~15 s, ako `routes.test.ts`) | áno |
| **L6** (známe, neopravené) | zrušená požiadavka (rýchle prepínanie tabov) nezastaví prácu servera; collaboration ju dopočíta a uloží do cache | – |

## 6. Návrh správy commitu

```
feat: collaboration stats for the cms super admin: a System page with the live rooms asked every 10 s while the tab is visible, 7 and 30 days of sessions by people at once and category, by day and hour, the people and pairs who collaborate most and the sessions of 2+ sorted, filtered (also by a person or an article across its versions) and loaded 50 at a time, and a session's detail with each participant's edits and the fields they changed by their labels; the moderator sends the article's docId with collabStatsBase
```

Commit opráv a filtra článku (nad 827934a24):

```
feat: the collaboration sessions list filters by article across its versions; the live tab waits for all three answers before it asks again, Refresh asks once, a session id goes lowercase, a 404 of the lists is a plain error, numbers follow the language and the charts name the Bratislava time
```

## 7. Len 7 dní (rozhodnutie vlastníka 2026-10-25)

Tab 30 dní odstránený, ostali Živé a 7 dní; retencia na serveri 8 dní. Preč aj to, čo slúžilo len jemu: typ
`CollabStatsDays`, prop `days` stránky obdobia, ľudí a zoznamu, `days` v `useCollabStatsSessions` a
`collabStatsSessionsQuery`, `CollabStatsTab.Days30`, text `tab.days30`. Obdobie je konštanta `COLLAB_STATS_DAYS = 7` v
`collabStatsApi.ts`; text „relácia nenájdená" hovorí o 8 dňoch; changelog „7 days". Kontroly: linty 0, vue-tsc 0,
testy štatistík 4 súbory / 45 OK, celá sada 87 / 2 146 OK. Necommitnuté nad c2c1cddc7.

```
refactor: the collaboration stats keep only the 7-day history, the 30-day tab and the period passed down for it are gone
```

## 8. Kontrakt core-cms podľa vzorov projektu (2026-10-25, STATS-CMS §1)

- **Mená ľudí** z `CachedUserChip` a `useCachedUsers` (vzor admin-cms): `cacheCollabStatsUsers` pridá ID odpovede
  (živé: moderátor, zámky, účastníci oboch košov; ľudia: `topUsers` a dvojice; detail: účastníci) a načíta ich naraz.
  Mapa `users`, typ `CollabStatsUser` a `collabStatsUserName` sú preč; klik na meno vedie na používateľa, filter
  zoznamu podľa človeka je ikona vedľa mena.
- **422 `validation_failed`**: `showErrorsDefault` (štandardné upozornenie s názvami polí `cms.collabStats.model.*`),
  na mieste nič. **502** = „nedostupné", 503 `disabled` = „Štatistiky sú vypnuté", 400 (zlý kurzor) = všeobecná chyba.
- Testy: 422 s poľom, 502, 400, ID do cache (živé aj detail), preklady polí. Kontroly: linty 0, vue-tsc 0, testy
  štatistík 4 súbory / 49 OK, celá sada 87 / 2 150 OK. Necommitnuté nad 00c96d008.

```
refactor: the collaboration stats name people from the user cache, show a refused query as any validation error and a 502 as unavailable
```

## 9. Bez mapy `articles` a zjednodušenie podľa existujúceho kódu (2026-10-25)

core-cms vracia telo collaboration nezmenené (STATS-CMS §1.1). Necommitnuté nad f34ca2185.

| Bolo | Teraz (vzor) |
|---|---|
| mapa `articles` z core-cms | `useCollabStatsHeadlines`: jedna `fetchArticleListByDocIds` (`article/api/articleApi.ts:52`) na odpoveď pre `docId`, ktoré komponent ešte nepozná; najvyššia verzia ako `tryLoadLatestVersionOfArticle` (`articleApiHelpers.ts:71`); stav v komponente |
| `CollabStatsArticleLink` s mapou | ten istý komponent, 25 riadkov: s `docId` → `/articles/{docId}`, bez → `/articles/{id}` s číslom. `ArticleByDocIdChip.vue` som nepoužil: pýta sa raz na každý čip (`articleFindActions.ts:15`), zoznam by poslal 50 požiadaviek |
| `CollabStatsFailureAlert.vue` (61 r.), `CollabStatsFailure`, „Skúsiť znova" | toast cez `useAlerts`: `showWarningT` (vypnuté, 429), `showErrorT` (502/503), inak `showErrorsDefault` (422 s poľami, 400, 5xx) ako `personalAccessTokenActions.ts:32`; živý tab len prvú chybu série |
| detail sám s „relácia nenájdená" | stránka podľa `jobs/[id]/index.vue:104-110` a `jobActions.ts:57`: `useRecordPage` + `handleRecordLoadError` (404 = záznam sa nenašiel a odchod), `ACard :loading`; komponent detailu len zobrazuje |
| `collabStatsDuration` | `useDateTimeHelper().formatTimeSpent` (`shared/composables/dateTimeHelper.ts:107`) |
| `collabStatsTime` | `dateTimeFriendly(…, '', true)` (common-admin `datetime.ts:74`) |
| `collabStatsDay` | `dateUtcPretty` (common-admin `datetime.ts:110`) |
| `CollabStatsDailyChart` + `CollabStatsHourChart` (128 r.) | jeden `CollabStatsChart` (68 r.) nad zdieľanými `LineChart`/`BarChart` |
| „Zobrazených X z Y", 4 karty po jednej | preč (karty nesú počty); karty cez `v-for` |
| `retry`, `failure`, `articles` v `useCollabStatsSessions` | preč; neúspešné „Načítať ďalšie" ostane s kurzorom |

Riadky: produkčný kód −191 (+369 / −560), testy +10, preklady a changelog −8; spolu 22 súborov, +494 / −683.
Kontroly: linty 0, vue-tsc 0, testy štatistík 4 súbory / 44 OK, celá sada 87 / 2 145 OK.

```
refactor: the collaboration stats name articles by their docId from the article list, one request per answer, and reuse the admin's toasts, record page, time formats and charts instead of their own
```

### 9.1 Spresnenie vlastníka a čistá proxy core-cms

- Titulky v zoznamoch: prvý nájdený článok pre `docId` z `fetchArticleListByDocIds`, bez výberu verzie (jedna
  požiadavka na zoznam). Detail relácie: `useFetchArticleByDocId` (#86833, `article/api/articleApi.ts:108`).
- core-cms je čistá proxy: zlý vstup je 400 od collaboration, ukáže sa ako všeobecná chyba (`showErrorsDefault`);
  preklady `cms.collabStats.model.*` preč; parameter `entity` sa neposiela (collaboration predvolí `article`).
- Spolu voči f34ca2185: produkčný kód −180 (+377 / −557), všetko +516 / −744 v 23 súboroch. Kontroly: linty 0,
  vue-tsc 0, testy štatistík 4 súbory / 43 OK, celá sada 87 / 2 144 OK.

```
refactor: the collaboration stats name articles from the article search (a session's detail from its docId), show any other failure as the admin does and leave the entity to collaboration, reusing the admin's toasts, record page, time formats and charts
```

## 10. Opravy po posudkoch jednoduchosti (Codex `posudky/admin-jednoduchost-codex.md`, Opus), nad 333708c84

- **Titulky (Codex M1, Opus C):** `useCollabStatsHeadlines` označí `docId` pred vyhľadávaním, takže pomalé
  vyhľadávanie ďalší tik nepošle znova a zlyhané sa v rámci stránky nepýta (ani neloguje) každých 10 s.
- **Detail pri 429, 502, 503 (Codex M2):** `showCollabStatsRecordError` = vlastný toast alebo `handleRecordLoadError`
  (`recordPage.ts:30`), stránka potom odíde ako pri každom zázname, ktorý sa nedá načítať.
- **Toasty (Opus B):** vypnuté, 429 a nedostupné s trvaním `-1`, ako `showErrorsDefault`.
- **Tabuľka košov:** `VTable` → `VDataTable` so stĺpcami `countColumn` ako ostatné tabuľky stránky.
- Opus A a A2 nerieše (rozhodne vlastník). Testy: pomalé a zlyhané vyhľadávanie, odchod detailu pri 404/429/502/503
  a nie pri zrušení, trvanie toastov. Kontroly: linty 0, vue-tsc 0, testy štatistík 49 OK, celá sada 87 / 2 150 OK.

```
fix: the collaboration stats ask for an article's headline once a page, also while the search is out or after it failed, leave a session's detail that is busy or unavailable as any record that cannot load, keep their toasts open as other failures and show the buckets in a data table
```

## 11. Priamo na collaboration, bez proxy v core-cms (STATS-C §1.1, §1.7), nad 9825e086b

- `src/shared/apiClients/collabClient.ts`: `defineApiClient` podľa `weatherClient.ts` (`withCredentials`,
  `userRefreshRequestInterceptor`, ktorý obnoví JWT cookie pred požiadavkou), base URL z `envConfig.collab.hocuspocusUrl`
  (`ws:` → `http:`, `wss:` → `https:`), bez novej premennej; timeout `cms.apiTimeout`.
- `collabStatsApi.ts`: klient `collabClient`, cesta `/api/sys/v1/collab-stats/*`, parametre bez zmeny (`entity` nie).
- 401 (bez platnej session) → `showForbiddenError` ako 403; 403 (mimo `COLLAB_STATS_USER_IDS`) → `showErrorsDefault`
  („nemáš prístup"); detail pri 401/403 odíde (`handleRecordLoadError`). Ostatné stavy bez zmeny; 502 = brána pred
  collaboration. Stránka a menu ďalej len pre super admina CMS.
- Testy: 401 a 403, odchod detailu pri 401/403, base URL a `withCredentials` klienta. Changelog: požiadavka na
  `COLLAB_STATS_USER_IDS` a `COLLABORATION_SERVER_CORS` v collaboration. Kontroly: linty 0, vue-tsc 0, testy štatistík
  53 OK, celá sada 87 / 2 154 OK.

```
refactor: the collaboration stats ask the collaboration server directly at the address of its Hocuspocus with the session cookies, and show a 401 or 403 as no access
```

