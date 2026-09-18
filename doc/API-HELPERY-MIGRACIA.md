# Migrácia starých API helperov na labs API — analýza

Stav k 18. 9. 2026, po review dvoch nezávislých agentov (Opus max effort, Codex).
Vzniklo z otázky, či staré helpery vyhodiť najskôr a až potom na nových stavať.

> **Záver dopredu — opravený.** Prvá verzia tohto plánu tvrdila, že filtrový a stránkovací model
> je „tá skutočná práca". **Nie je — tá práca je už urobená a leží v strome.** Každý zoznamový
> súbor, ktorý prvá verzia zadávala do svojich krokov 2 a 3, už má labs fetcher vedľa legacy
> dvojčaťa. Čo zo starého `apiFetchList` reálne zostáva: **tri mostíkové komponenty, sedem
> položiek mŕtveho kódu a jeden prehliadnutý súbor.** Deň práce, nie projekt.

---

## 1. Dve sady, nie jedna

| | staré `src/services/api/` | labs `src/labs/api/` |
|---|---|---|
| tvar | voľné funkcie, `new Promise` + `.then/.catch` | composables, `async/await` |
| abort | **žiadny** | `AbortController`, `Set` kontrolerov, `abortRequest()` |
| chyby | `apiFetchOne`/`CreateOne`/`UpdateOne`/`DeleteOne`/`AnyRequest`: 4 vetvy + `AnzuFatalError`.<br>**`apiFetchByIds`: už 8 vetiev** (`apiFetchByIds.ts:64-85`) | 8 vetiev |
| url | pozičné argumenty | pri konštrukcii alebo per volanie, s overridom |
| konzola | ticho | `console.error` pri axios chybe, vypnuteľné cez `silentConsoleError` |
| testy | **0** | 9 súborov, 90 testov (z toho 2 kontraktové, 27 testov) |

Prvá verzia písala „8 vetiev proti 5" plošne. **Pre `apiFetchByIds` to neplatí** — ten už timeout aj
axios chybu rozlišuje, takže sa pri jeho migrácii mapovanie chýb **nemení vôbec**. (Nález Codexu
aj Opusa, overené.)

## 2. Čo sa pri výmene naozaj mení

### 2a. Jednorazové: `apiFetchOne`, `apiCreateOne`, `apiUpdateOne`, `apiDeleteOne`, `apiFetchByIds`

```ts
// staré
const res = await apiFetchOne<T>(client, urlTemplate, urlParams, system, entity)

// labs
const { executeRequest } = useApiRequest<T>({ client, method: 'GET', system, entity })
const res = await executeRequest({ urlTemplate, urlParams })
```

Pozorovateľné rozdiely:

| rozdiel | staré | labs |
|---|---|---|
| 204 bez tela | `null` | `undefined` |
| **202 bez tela** | `reject(AnzuFatalError)` | `resolve(undefined)` |
| 204 v `apiFetchByIds` | `null` | **`[]`** (`useApiFetchByIds.ts:101`) |
| zrušený request | neexistuje | **odmietne sa** `AnzuApiAxiosError` |
| poradie v `apiFetchByIds` | natvrdo `'id'` | konfigurovateľné `field` |
| tvar chyby | vždy `AnzuFatalError` (okrem 4 prípadov) | + `AnzuApiAxiosError`, `AnzuApiTimeoutError`, `AnzuApiResponseCodeError` |
| konzola | ticho | `console.error`, ak sa nedá `silentConsoleError` |

**202 je tichá zmena smeru**, nie tvaru: cesta, ktorá dnes padá, po migrácii prejde.
`useApiRequest.ts:80` berie `HTTP_STATUS_ACCEPTED` spolu s `NO_CONTENT`, staré helpery len `NO_CONTENT`
a zvyšok posielajú do `reject(new AnzuFatalError())`.

**`apiAnyRequest` do tejto skupiny nepatrí.** Generiká sú prehodené:
`apiAnyRequest<T, R = T>` (T = telo) proti `useApiRequest<R, T = R>` (R = odpoveď). Mechanický port,
ktorý zachová poradie typových argumentov, zapíše typ tela tam, kde patrí odpoveď — a kvôli
vzájomným defaultom to `tsc` nemusí zachytiť. (`ADMIN-LABS-VZOR.md` §0b bod 1.)

Čo sa **nemení**, hoci sa to tak javí: telo sa serializuje rovnako, `useApiRequest` robí
`JSON.stringify(object)` presne ako `apiCreateOne`.

**Pasca s prázdnym telom je užšia, než sa zdá, a `apiAnyRequest` do nej nepatrí.**
`ADMIN-LABS-VZOR.md` bod 36 to hovorí výslovne: `apiAnyRequest` mal legacy `object: T | null = null`
(`apiAnyRequest.ts:28`) a telo nevynechával, takže prechod na labs je pri ňom bezpečný. Pasca je
**len pri `apiCreateOne`**, ktorý defaultuje na `{}` (`apiCreateOne.ts:24`), a pri **explicitnom
`{}`** na volaní. V knižnici default nehryzie nikde — všetky `apiCreateOne` volania podávajú reálne
`data` — a jediná expozícia je explicitné `{}` v
`damfetchAssetListByFileIdsMultipleLicences.ts:56`.

### 2b. Modelové: `apiFetchList`

Zmena dátového modelu, nie volania:

| | staré | labs |
|---|---|---|
| stránkovanie | `Pagination` ako objekt, **mutuje sa** | `Ref<Pagination>`, **nahrádza sa** |
| `sortBy` | `string \| null` + `descending: boolean` | `DatatableSortBy` = `{ key, order }` |
| filtre | `FilterBag` | `FilterData` **+** `FilterConfig` |
| elastic | `filterBag._elastic` | **dva nezávislé príznaky** |
| `field` | `field` | `apiName` |
| offset pri `page = 0` | `page * limit - limit` → **záporný** | `Math.max(0, (page - 1) * limit)` |
| mandatory + prázdna hodnota | **mutuje reactive filter bag** (`queryBuilder.ts:40,48,58`) | nemutuje |

Tri z nich vie zmigrovaný kód pokaziť potichu:

1. **Stránkovanie.** Kto si drží referenciu na `pagination` a po volaní z nej číta `totalCount`,
   po migrácii číta zo starého objektu, ktorý sa už nemení.
2. **Elastic sa rozpadol na dva príznaky, a starý mechanizmus je iný, než sa zdá.**
   Legacy `_elastic` je marker **prítomnosťou, nie hodnotou**: `queryBuilder.ts:81` testuje
   `!isUndefined(filterBag._elastic)` a `apiFetchList.ts:47` rovnako, takže aj `_elastic: false` by
   poslalo `/search` a ploché filtre. Samotné pole je pritom `makeFilter({ exclude: true })`, takže
   sa do query nikdy nevypíše — existuje len preto, aby bolo vidieť.
   Labs to rozdelil: `general.elastic` prepína na `/search`, `general.simpleFilters` na ploché
   filtre, a spája ich späť **iba `createFilter`** (`filterFactory.ts:169-171`). Mapovanie
   `_elastic → general.elastic` samotné teda mení formát na drôte — `simpleFilters` zostane `false`
   a filtre vyjdú ako `filter_*[...]` proti elastickému endpointu.
3. **Legacy `getValue` mutoval filter bag**, keď bol filter `mandatory` a prázdny — dosadil si
   `default` späť do modelu, a teda do UI. Labs to nerobí. Viditeľná zmena správania bez varovania.

## 3. Rozsah — presné čísla

Pravidlo počítania: volania v tvare `helper<...>(`, mimo definícií v `src/services/api/api*.ts`.
Overené, že žiadne volanie bez generiky neexistuje.

**Knižnica: 20 súborov, 45 volaní.** Prvá verzia písala 19/~39 a jej vlastná tabuľka sa sčítavala
na 20 — prehliadla **`src/services/api/job/jobApi.ts`** (4 volania), lebo grep vylučoval celý
`src/services/api/` ako „to sú tie staré helpery". Lenže v tom adresári sedí aj ich konzument, a je
verejný (`useJobApi`, export `lib.ts:1071`). Nález Codexu aj Opusa nezávisle; overené.

| skupina | súborov | volaní | čo s tým |
|---|---|---|---|
| `components/damImage/uploadQueue/` | 11 | 25 | migračný cieľ |
| `components/dam/` | 5 | 11 | migračný cieľ (**5, nie 6**) |
| `services/api/job/jobApi.ts` | 1 | 4 | verejný `lib.ts:1071`, **nula konzumentov v adminoch** |
| `labs/job/jobApi.ts` | 1 | 3 | **27 súborov adminov** ho importuje — viď §5 |
| `playground/` | 2 | 2 | nejde do buildu |

**Adminy: nula volaní.** Zásahy vo `forum` a `inhouse` sú komentáre spomínajúce staré helpery ako
históriu. Overené trikrát, nezávisle. **Ale nula volaní ≠ nula expozície** — viď §5.

**Starý filtrový model:** `FilterBag` v **21 súboroch** knižnice, `Pagination` v 23, v adminoch nula.

## 4. Čo zo `apiFetchList` naozaj zostáva

Toto je oprava, ktorá mení celý plán. Sedem volaní `apiFetchList` v siedmich súboroch, a **vedľa
každého už stojí labs dvojča**:

| legacy export | labs dvojča | kto legacy volá |
|---|---|---|
| `fetchDamUserList` (`userApi.ts:23`) | `useFetchDamUserList` (`:26`) | `damUserSelectActions.fetchItemsLegacy` → **`DamUserFilterRemoteAutocompleteLegacy.vue`** |
| `fetchKeywordList` (`keywordApi.ts:41`) | `useFetchKeywordList` (`:29`) | `keywordActions` → **`DamKeywordFilterRemoteAutocompleteLegacy.vue`** |
| `fetchAuthorList` (`authorApi.ts:41`) | `useFetchAuthorList` (`:32`) | `authorActions` → **`DamAuthorFilterRemoteAutocompleteLegacy.vue`** |
| `fetchDamExtSystemList` | `useFetchDamExtSystemList` (`:19`) | **nikto** — len `lib.ts` |
| `fetchDamAssetLicenceList` | `useFetchDamAssetLicenceList` | **nikto** — len `lib.ts` |
| `fetchDamAssetLicenceGroupList` | `useFetchDamAssetLicenceGroupList` | **nikto** — len `lib.ts` |
| `fetchJobList` (`services/api/job/jobApi.ts:15`) | `labs/job/jobApi.ts` | `useJobApi`, `lib.ts:1071` |

Tie tri mostíky sú **presne to, čo `ADMIN-LABS-VZOR.md` §0b bod 31 zakazuje** — druhá api vrstva
pod legacy komponentom. A žiadny z našich šiestich adminov ich nepoužíva.

Tá istá `*Actions.ts` vrstva už labs cestu má: `keywordActions.ts:46` drží `useFetchKeywordList`
a `:64,71` stále volá `fetchKeywordList`. Legacy `.vue` berie `fetchItemsLegacy`, moderné `.vue`
berie `fetchItems`. **11 z 20 súborov importuje obe vrstvy naraz.**

## 5. Kto to odnesie

Adminy nemajú volania, ale majú expozíciu — cez knižnicu:

- **`useJobApi` je najväčšia expozícia a je to `labs/job/jobApi.ts`, nie ten druhý.**
  **27 súborov** (21 v admin-cms, 6 v admin-dam), každý s jedným importom, a **všetkých 27 z
  `@anzusystems/common-admin/labs`** — z hlavného vstupu ani jeden. Vnútri už `useApiFetchList`
  má; legacy mu zostali `apiFetchOne`, `apiCreateOne`, `apiDeleteOne`.
- **Riziko abortu je ale iba na dvoch z tých 27, a je presne lokalizované.**
  25 z nich sú `.vue` so `<script lang="ts" setup>` — tam beží všetko **raz na inštanciu
  komponentu**, nie raz na modul, a každý si berie iba `createJob`. Nič sa nezdieľa.
  Module scope majú **dva** obyčajné `.ts`: `admin-cms/.../job/composables/jobActions.ts:12` a
  `admin-dam/.../job/composables/jobActions.ts:14`. A práve tie si berú **`fetchJob`** — jednu
  z troch funkcií, ktoré krok 4 migruje. Tam platí §0b bod 5: jeden `useApiRequest` na funkciu,
  inak `abortRequest` zruší nesúvisiace volanie.
- **`services/api/job/jobApi.ts` naopak nemá v adminoch konzumenta žiadneho** — je exportovaný z
  `lib.ts:1071`, ale nikto z našej flotily ho neimportuje. Patrí k mŕtvym verejným exportom, nie
  k rizikovým krokom.
- `fetchDam*ListByIds` ťahá `apiFetchByIds` do admin-dam a admin-cms.

Prvá verzia tohto dokumentu ani prvé kolo review toto nerozlíšili — obe hovorili o „useJobApi"
ako o jednej veci a odhadovali 10 komponentov. Sú to dva rôzne súbory s opačným rizikovým profilom.

Moja vlastná oprava tohto miesta bola v druhom kole dvakrát nesprávna a obe chyby našiel review:
písal som **45 importov** (glob `admin-*/src` zmietol aj `admin-cms-backup/src`, ktorý do flotily
nepatrí) a **„všetkých 45 na module scope"** (25 z nich sú `<script setup>`, čo je pravý opak
module scope). Správne je 27 súborov a dve module-scope miesta.

DAM komponenty konzumuje: dam ≫ cms > ugc; blog/forum/inhouse nula. (Presné čísla závisia od
pravidla počítania — moje meranie a Opusovo sa líšia, poradie nie.)

Pokrytie testami je najslabšie práve tam: testy, ktoré sa tých api súborov dotýkajú, riešia chunk
timeout a ROI — nie tvar volaní ani filtre.

## 6. Testy — čo je pripnuté a čo nie

`src/test/labs/useApiRequestContract.test.ts` (17) a `useApiFetchListContract.test.ts` (10) — 27
z celkových 90 testov v `src/test/labs/` (9 súborov). Zvyšné pokrývajú filtre a komponenty, nie api.

**Pripnuté:** všetkých osem vetiev mapovania chýb v `useApiRequest`, tri z nich v liste, návratové
hodnoty (204/202 → `undefined`, telo, prázdne telo → fatal), `JSON.stringify` tela, override url,
`silentConsoleError`, zápis do stránkovania (nahradenie, nie mutácia), `hasNextPage`, limit/offset/
order, elastic vs `/search`, `forceElastic`.

**Nepripnuté a je to diera:**

1. **Preklad filtrov do query — teda celé 2b — netestuje nikto.** Fixtúra listu je
   `{ name, default: '' }`, nie `mandatory`, takže `getValue` vracia `null` a všetkých desať testov
   posiela query **bez jediného `filter_*`**. V repe nie je ani jeden test, ktorý by sa dotkol
   ktoréhokoľvek z dvoch query builderov. Nález Opusa, overený.
2. Elastic fixtúra nastavuje `general.elastic = true` **až po** `createFilter`, takže `simpleFilters`
   zostáva `false` — konfigurácia, akú `createFilter` nevyrobí. Preto test rozdelenie elasticu
   nezachytil.
3. ~~Hlavička listového testu tvrdí, že pripína „tých istých osem vetiev".~~ **Opravené pred
   commitom `aa0db978`**: komentár teraz hovorí „tri z ôsmich" aj to, čo z toho plynie, a pomenúva
   nepokrytý preklad filtrov. Nález prvého kola, platil na necommitnutú verziu.
4. `useApiFetchByIds` — tretia kópia toho istého mapovania — nemá test žiadny.

Diera č. 1 je sieť pod **krok 1**, nie pod krok 5. `querySetFilters` má štyroch volajúcich
(`apiFetchList.ts:29`, `apiFetchListBatch.ts:34,49`, `useApiFetchList.ts:57`); po krokoch 1–3
prežije z `apiFetchList` jediné volanie — to vo verejnom `fetchDamUserList` — a to sa nemigruje.
`apiFetchByIds` si query stavia cez `queryAddFilter('in', …)` (`apiFetchByIds.ts:26-34`), nie cez
`querySetFilters`. Krok 5 sa teda filtrov nedotkne. Krok 1 je **jediný** krok, ktorý mení, ktorý builder filter vyrobí — a preto ide krok 0
pred ním.

Poznámka k prvej verzii: tvrdila „13 mutácií overených". Mutačné testovanie som robil, ale z repa sa
spätne overiť nedá a ani jeden z dvoch reviewerov ho nevie potvrdiť. **Berte ako neoverené.**

## 7. Plán — prestavaný

**Krok 0 — testy. Čiastočne hotové, nie hotové.**
27 testov je v strome. Chýba to podstatné: **test prekladu filtrov do query pre obe vrstvy.**
Je to sieť pod **krok 1** — jediný krok, ktorý mení, ktorý builder filter vyrobí (viď krok 1).

Netreba mock axiosu: **oba buildery sú už exportované** —
`apiGenerateListQuery` (`apiFetchList.ts:24`, verejné v `lib.ts:1070`) a `generateListQuery`
(`useApiFetchList.ts:46`). Zavolať oba, porovnať reťazce. Pozor, **legacy generátor nie je čistý** —
cez `getValue` prepisuje `filter.model` (`queryBuilder.ts:40,48,58`), takže sa nedá volať dvakrát nad
tým istým bagom a očakávať to isté. Prípad C to práve využíva ako aserciu. **Asertovať presnú rovnosť, nie
`toContain`** — `toContain` v `useApiFetchListContract.test.ts:111-113` je presne dôvod, prečo
chýbajúci segment prejde.

Štyri prípady:

| | čo pripína |
|---|---|
| **A** neelastický `startsWith` na `person.lastName` | `field` → `apiName`, zachovanie variantu, tvar `filter_<variant>[…]`. Tvar DamUser — jediný z troch mostov, kde sa rozdiel builderov môže prejaviť. |
| **B** elastický `text` → ploché `text=abc` | spojenie `_elastic` → `general.elastic` + `simpleFilters` cez `createFilter`, a zároveň to, že nesúlad variantu (`eq` vs `search`) je pri zapnutom elasticu neviditeľný |
| **C** `mandatory: true, default: 'active'`, model `null` | rovnaký segment na oboch stranách **plus** že legacy `filter.model` prepísal a labs `filterData` nechal. Variant s poľom: legacy vráti `default` **surovo**, labs `.join(',')` + `encodeURIComponent` — divergencia, ktorú nepripol nikto. |
| **D** kľúč v `filterData` bez položky v `fields` | labs ho **zahodí ticho** (`useApiQueryBuilder.ts:134`), legacy iteroval bag a vypísal všetko |

**A druhá polovica kroku 0: opraviť meradlo, inak kroky 3–5 nemajú ako byť merateľné.**
Dnes eslint hlási čisto aj na nespravenej práci, z dvoch nezávislých dôvodov:

1. `eslint.config.mjs:31-33` má `mode: 'internal'`, takže na knižnicu platí **len interný zoznam** —
   a ten nemá položku pre ani jeden zo **šiestich** jednorazových helperov (`apiFetchOne`,
   `apiCreateOne`, `apiUpdateOne`, `apiDeleteOne`, `apiFetchByIds`, `apiAnyRequest`). Overené:
   `damConfigApi.ts` s troma `apiFetchOne` volaniami vráti `"messages":[],"suppressedMessages":[]`.
2. `plugin.mjs:218-234` preskočí **celý súbor**, keď sa jeho meno zhoduje s cestou niektorého
   pravidla — a `@/services/api/job/jobApi` takou cestou je (`:63-66`). `services/api/job/jobApi.ts`
   je teda pre lint neviditeľný a **žiadne rozšírenie zoznamu to nespraví**; ten jeden súbor treba
   sledovať ručne.

Meradlo potom je `eslint -f json | jq .suppressedMessages`, nie grep — hlásenia sú **potlačené**
tam, kde je explicitný `eslint-disable` (napr. `assetLicenceApi.ts:8`).

**Krok 1 — tri mostíky. Vzor už existuje ako hotový súbor, netreba ho vymýšľať.**
`DamUser`/`DamKeyword`/`DamAuthor` `FilterRemoteAutocompleteLegacy.vue` majú dnes legacy prop
**aj** legacy api vrstvu. `ADMIN-LABS-VZOR.md` §0b bod 31: most smie držať legacy prop, ale **musí
bežať nad labs api** — druhá api vrstva je presne to, čo zakazuje.

Predloha je `admin-blog`, `git show 9101400:src/views/blog/blog/components/FilterBlogRemoteAutocompleteLegacy.vue`
— **presne 44 riadkov**, tie, ktoré bod 31 spomína. **Čo sa z nej preberá, je umiestnenie adaptéra,
nie ten bag.** Adaptér patrí **do toho `.vue`**, nie do `*Actions.ts`: most si vezme labs akciu,
vlastnú `usePagination` z `/labs`, a vo `fetchItems(legacyPagination, legacyFilterBag)` preloží,
čo treba. Blog si bag staval ručne len preto, že mu stačil jediný kľúč `text`; naše tri mosty
svoje composables už majú a nechávajú si ich (viď nižšie).

Dôsledok pre `*Actions.ts`: **päť funkcií sa zmaže**, neprepisuje — akčná vrstva zostane
labs-only, čo je to, čo bod 31 chce. Ale len **tri z nich potrebujú most**:

| funkcia | konzument |
|---|---|
| `damUserSelectActions.ts:36` `fetchItemsLegacy` | `DamUserFilterRemoteAutocompleteLegacy.vue:23` |
| `keywordActions.ts:63` `fetchItemsLegacy` | `DamKeywordFilterRemoteAutocompleteLegacy.vue:19` |
| `authorActions.ts:76` `fetchItemsMinimalLegacy` | `DamAuthorFilterRemoteAutocompleteLegacy.vue:20` |
| `keywordActions.ts:70` `fetchItemsMinimalLegacy` | **žiadny** — len deklarácia a return |
| `authorActions.ts:69` `fetchItemsLegacy` | **žiadny** — author most berie minimal variant |

Tie dve mŕtve patria ku kroku 2, nie sem.

**Pozor pri kopírovaní predlohy — na DamUser spadne.** `AFilterRemoteAutocomplete.vue:95-96` robí
`innerFilter.value[props.filterByField].model = query` **bez kontroly**. `filter-by-field` je `text`
pri Keyword aj Author, ale **`lastName`** pri DamUser
(`DamUserFilterRemoteAutocompleteLegacy.vue:34`). Ručne postavený bag s kľúčom `text` — ako má blog
predloha — dá pri prvom údere do klávesnice `undefined.model`. `tsc` to neodhalí, prop je index
signature. Riešenie: nechať existujúce `useDamUserFilter()` (`DamUserFilter.ts:49`),
`useKeywordListFilter()` (`KeywordFilter.ts:44`) a `useAuthorFilter()` (`AuthorFilter.ts:29`) —
všetky tri ten kľúč už majú, takže na strane vnútorného filtra je to nulová zmena. Bag nestavať
ručne.

Dve veci o tých composables, nech nie sú prekvapením:
- `useDamUserFilter` a `useKeywordListFilter` vracajú **module-scope singleton**
  (`DamUserFilter.ts:29`, `KeywordFilter.ts:26`), takže dva z troch mostov zdieľajú jeden bag
  naprieč inštanciami. `useAuthorFilter` vyrába nový pri každom volaní.
- Všetky tri sú samy `@deprecated`, takže krok 1 **nepohne** počtom 21 súborov s `FilterBag`
  z §3 — ten klesne až zmazaním mostov.

**Dva tvary, nie jeden.** DamUser a DamKeyword visia pod `AFilterRemoteAutocomplete`
(`:fetch-items`, vracia `ValueObjectOption[]`). **DamAuthor visí pod
`AFilterRemoteAutocompleteWithMinimal`** (`:fetch-items-minimal`, vracia `DamAuthorMinimal[]`,
plus dva vlastné sloty). Tretí most je iná práca než prvé dva.

**Koľko z §2b tam naozaj dopadne — menej, než sa zdá.** Overené po položkách:

| rozdiel z §2b | dopadá sem? |
|---|---|
| rozdelený elastic | **nie** — keyword aj author vnútorné filtre idú cez `createFilter(…, { elastic: true })`, takže `simpleFilters` sa dopáruje; DamUser je neelastický na oboch stranách |
| `field` → `apiName` | **nie** — labs dvojčatá to už majú (`DamUserFilter.ts:13`) |
| mutácia bagu pri `mandatory` | **nie** — ani jedno pole týchto filtrov nie je `mandatory` |
| klampovaný offset | **nie** — obe `usePagination` štartujú na `page: 1`, builder-y sa pre `page ≥ 1` zhodujú |
| nahradenie refu vs. mutácia | **čiastočne** — ref vlastní most, `totalCount` z neho nikto nečíta |
| stratené default triedenie | **nie** — všetky tri už posielajú `:filter-sort-by="null"` |

Takže predošlá veta tohto plánu — „ten preklad je jediné miesto, kde žijú všetky tiché rozdiely
z §2b naraz" — bola **prehnaná**. Preklad je v praxi jeden až dva riadky na most. Testy z kroku 0
sú aj tak potrebné, ale nie kvôli tomuto kroku.

**Zmazaním akcií to ale nekončí — a to je najľahšie prehliadnuteľná diera celého plánu.**
Pod tými akciami sedia api funkcie `fetchDamUserList` (`userApi.ts:23`), `fetchKeywordList`
(`keywordApi.ts:41`) a `fetchAuthorList` (`authorApi.ts:41`), a **tie volajú `apiFetchList`**.
Keď sa zmažú len akcie, tieto tri osirejú, ale volania zostanú. Takže krok 1 musí povedať aj ich
osud, a nie je pre všetky tri rovnaký:

| funkcia | verejná? | čo s ňou |
|---|---|---|
| `fetchKeywordList` | nie | zmazať rovno spolu s akciou |
| `fetchAuthorList` | nie | zmazať rovno spolu s akciou |
| `fetchDamUserList` | **áno** (`lib.ts:580`, `:1087`) | `@deprecated`, zmazať až v ďalšej major |

Odmena: zmizne zakázaná druhá api vrstva a v adminoch sa nezmení nič — žiadny z našich šiestich
tie mosty nepoužíva. **Ale `apiFetchList` po krokoch 1–3 nezmizne**: `fetchDamUserList` je verejné
API a jeho volanie prežije do ďalšej major. `src/` teda nebude „čisté" v zmysle nula volaní, len
nula *živých* konzumentov.

**Krok 2 — mŕtvy kód, sedem položiek.** Rozhodnutie, nie práca.

**Dva mechanizmy, netreba ich zamieňať** — a doteraz ich tento plán zamieňal.
`@deprecated` v JSDoc je značka pre človeka a IDE; eslint pravidlo `anzu/no-deprecated-imports`
je to, čo import skutočne zastaví. Konzumentský zoznam v `plugin.mjs` dnes obsahuje **generické
helpery, nie tieto konkrétne mená** — `fetchDamExtSystemList`, `fetchDamAssetLicenceList`,
`fetchDamAssetLicenceGroupList`, `fetchDamUserList`, `apiGenerateListQuery`
ani `usePaginationAutoHide` tam nie sú. Takže pri každej verejnej položke nižšie treba **oboje**:
JSDoc značku a záznam v konzumentskom zozname. Vnútorné položky stačí zmazať.

| položka | stav |
|---|---|
| `fetchDamExtSystemList` | nula konzumentov, labs dvojča existuje |
| `fetchDamAssetLicenceList` | to isté |
| `fetchDamAssetLicenceGroupList` | to isté |
| `keywordActions.ts:70` `fetchItemsMinimalLegacy` | mŕtve už dnes, odovzdáva krok 1 |
| `authorActions.ts:69` `fetchItemsLegacy` | mŕtve už dnes, odovzdáva krok 1 |
| `apiGenerateListQuery` (`lib.ts:1070`) | používa ho len `apiFetchList.ts:50`, nula vo flotile, **nie je na deprecated zozname** |
| `usePaginationAutoHide` (`lib.ts:739`) | nula volaní kdekoľvek, **nie je na zozname** |

Dve výhrady, overené:

- `apiGenerateListQuery` **používa test z kroku 0**. Deprekovať áno, zmazať až keď ten test padne
  spolu s legacy builderom — inak si podrežeme vlastnú sieť.
- `usePaginationAutoHide` **nemá labs náhradu**. Nie je to teda len mŕtvy export, ale diera:
  `admin-blog/.../NoteDatatable.vue:58` si to už poznačil komentárom a hneď pod ním má trojriadkový
  inline `computed` s obrátenou podmienkou z `composables/system/pagination.ts:18-21`. To je
  zatiaľ jediná náhrada — uviesť ju, nie len varovať.

Tým je `apiFetchList` vyriešený všade okrem jedného miesta: `fetchDamUserList` je verejné
a jeho volanie stojí až do ďalšej major.

Pri tom doplniť **`@deprecated` na `authorApi.ts:41 fetchAuthorList`** — jediný legacy zoznamový
fetcher, ktorý ho nemá; ostatných päť áno. Podkopáva to premisu §4, že každé legacy dvojča je
označené.

**Krok 3 — `services/api/job/jobApi.ts` (4 volania).** Napriek menu je to ten bezpečný:
`lib.ts:1071` ho exportuje (`:279` je len import), ale **žiadny z našich šiestich adminov ho neimportuje**. Rovnaká
kategória ako krok 2 — rozhodnúť, nie migrovať.

**Krok 4 — `labs/job/jobApi.ts` (3 volania). Najviac konzumovaný krok, ale riziko je úzke.**
Importuje ho **27 súborov** admin-cms a admin-dam, všetky z `/labs`. 25 z nich sú ale `<script setup>`
komponenty — jedna inštancia na komponent, iba `createJob`, nič zdieľané. Zostávajú **dva**
module-scope `jobActions.ts`, ktoré držia **`fetchJob`**. `useApiFetchList` tam už je; ide o
`apiFetchOne`, `apiCreateOne`, `apiDeleteOne`, čiže čisté 2a.

**Zoznam problém podľa bod 5 nemá a ani ho krokom 4 nezíska — a je to vzor riešenia v tom istom
súbore.** `useFetchJobList` je **továreň**, nie inštancia (`labs/job/jobApi.ts:13` je
`() => useApiFetchList(...)`), a `useApiFetchList` si `abortControllers` vyrába **vo vlastnom tele**
(`useApiFetchList.ts:66`). Oba adminy tú továreň volajú **až vnútri** `useJobListActions()`
(cms `:16`, dam `:18`), takže module-scope destrukturácia (cms `:12`, dam `:14`) drží továreň, nie
hotovú funkciu. `fetchJob` naopak žiadnu tovární vrstvu pod sebou nemá — a to je celý rozdiel.

**Odporúčanie: `useJobApi` vracia ďalej viazané funkcie (`fetchJob(id)`), ktoré si `useApiRequest`
stavajú čerstvý vnútri pri každom volaní.** To je to, čo §0b bod 5 žiada — žiadna zdieľaná abort
scope — a **nepohne ani jedným z 27 volajúcich**.

Vedome sa to líši od predlohy v tých troch adminoch, ktorá továreň vystavuje navonok
(`useFetchJob()`). Ten tvar sprístupní `abortRequest`, ale prepíše 27 miest, aby si odovzdávali
handle, ktorý nikto nevolá: naprieč všetkými siedmimi repami je **nula** volaní
`abortFetch`/`abortRequest`, jediní volajúci vo flotile sú
`common-admin/src/labs/log/logActions.ts:80,120`. Ak sa abort niekedy bude treba, prechod na
továreň je potom samostatná a viditeľná zmena.

**Pozor na generiká `createJob`.** `apiCreateOne` je `<T = telo, R = T>` (`apiCreateOne.ts:22`),
labs potrebuje `useApiRequest<JobType, JobType>` — odpoveď prvá (`useApiRequest.ts:39`). Tu oba
argumenty splývajú, takže prehodené poradie `tsc` prejde. Presne slepé miesto §0b bod 1.

A ešte jedna vec do tých istých súborov: `datatableHiddenColumns`, `listLoading` a `detailLoading`
**sú** module-level refy (cms `:8-10`, dam `:10-12`), takže loading príznaky zdieľané sú, kým abort
Sety nie. Tá istá zámena „čo tu vlastne je module scope", z ktorej vznikla aj moja 45.

**Precedens pre *vnútro*, nie pre *povrch*.** `admin-blog/.../job/api/jobApi.ts`
(`useFetchJobList:23`, `useFetchJob:31`, `useCreateJob:40`, `useDeleteJob:49`), rovnako
`admin-forum/.../job/api/jobApi.ts:34` a `admin-inhouse/.../job/api/jobApi.ts:16` — tri zo šiestich
adminov už knižničný `useJobApi` opustili. Preberá sa z nich **jeden `useApiRequest` na funkciu
a poradie generík** (`useApiRequest<Job, Job>` na `:41`, `useApiRequest<void, null>` na `:50`).
**Nepreberá sa ich povrch** — tie súbory továreň vystavujú navonok, my ju necháme vnútri, z dôvodov
vyššie.

Tu, nie inde, patrí aj rozhodnutie o **dvojitom exporte**. Ide z `lib.ts` aj `labs.ts` s rôznym
tvarom: `useJobApi`, `usePagination`, `useApiQueryBuilder`, `Pagination`, a ďalej `useFilterHelpers`
(`lib.ts:742` / `labs.ts:175`), `ADatatablePagination` (`lib.ts:650` / `labs.ts:167`)
a `DatatablePaginationKey`. Lint to nechytí — `plugin.mjs:241,530-533` porovnáva zdrojový reťazec
presne, takže `/labs` sa nikdy netrafí.

**Krok 5 — `components/dam/` (5 súborov) a `components/damImage/uploadQueue/` (11).**
Je to **2a plus jedno volanie, ktoré sa tu zámerne nechá stáť**: `userApi.ts:24` je v tomto
zhluku a volá `apiFetchList` z verejného `fetchDamUserList`. Zmigrovať ho tu **nie**, zmenilo by to
správanie verejného exportu mimo major. Zvyšok zhluku filtre nerieši.
Jedna výnimka na pozor: `damConfigApi.ts:19` si url skladá zreťazením
(`END_POINT + '/ext-system/' + extSystem`). `anzu/url-params-match-template` (`plugin.mjs:260+`)
rozumie len statickým šablónam, takže to musí prejsť na `urlTemplate: END_POINT + '/ext-system/:extSystem'`
plus `urlParams`, inak pravidlo ticho nevidí nič. Jediné také volanie zo 45.
Zvyšok je 2a: `apiFetchOne`/`CreateOne`/`UpdateOne`/`DeleteOne`/`FetchByIds`. Pred `uploadQueue`
doplniť testy na `imageApiCms`, `keywordApi`, `authorApi`. `apiAnyRequest` vždy ručne — prehodené
generiká.

**Krok 6 — `apiFetchListBatch`.** Nula volaní kdekoľvek. **Nie je to port**: legacy verzia je
rozbitá — slučka `for (i = 0; i < numPages; i++)` posiela `i` do 1-based `querySetOffset`, takže
prvá požiadavka ide so **záporným offsetom**, druhá zopakuje stranu 1 a **posledná strana sa
nenačíta nikdy** (`apiFetchListBatch.ts:107-121`, `queryBuilder.ts:17`). Labs verzia offset
klampuje. Mení sa **výsledná množina**, nie tvar. Overené.

**Krok 7 — deprekácia exportov.** Až keď je `src/` čisté: `@deprecated` na zvyšné exporty
v `lib.ts` (**nie zmazanie**, sú to verejné API), changelog, mazanie v ďalšej major.

Vynucovacím mechanizmom nie je JSDoc tag, ale eslint pravidlo
`anzu/no-deprecated-imports` (`src/eslint/plugin.mjs`), severity `error`. Konzumentský zoznam už
obsahuje všetkých sedem helperov plus `FilterBag`, `Filter`, `Pagination`, `usePagination`,
`useApiQueryBuilder`, `makeFilterHelper`, `useJobApi`. Zostáva doplniť `apiFetchListBatch` (je na
internom zozname a na konzumentskom chýba) a **konkrétne verejné wrappery z kroku 2** — bez nich
je ich deprekácia len JSDoc komentár, ktorý nikoho nezastaví.

Playground ide s tým zhlukom, ktorý používa.

## 8. Čo už je hotové

`composables/auth/defineAuth.ts` — `fetchCurrentUser` cez `useApiRequest` (commit `41dc2add`).
Vynútené tým, že `admin-cms` potreboval rozlíšiť 401 od sieťového zlyhania. So `silentConsoleError`,
aby cesta zostala taká tichá ako predtým. Presný prípad 2a: jeden riadok plus prepísaný test.

A hlavne: **celá labs zoznamová vrstva v `components/dam/` a `components/damImage/uploadQueue/`.**
Napísal ju niekto pred týmto plánom; plán o nej nevedel a zadával ju znova ako kroky 2 a 3.

## 9. Nálezy mimo tejto migrácie

- `useApiFetchByIds` bez testu — tretia kópia mapovania chýb.
- Mapovanie chýb existuje **štyrikrát** (`useApiRequest`, `useApiFetchList`, `useApiFetchByIds`,
  `useApiFetchListBatch`). Zlúčiť = meniť štyri vstupné body naraz, samostatná úloha.
- **Vetva pre abort je vo všetkých štyroch mŕtva.** Testuje `err instanceof DOMException &&
  err.name === 'AbortError'`, ale axios pri zrušení hádže `CanceledError` (`isAxiosError: true`,
  `code: ERR_CANCELED`). Overené spustením. Zrušený request teda **nikdy nevráti `[]`** — odmietne
  sa ako `AnzuApiAxiosError`. Prvá verzia tohto dokumentu tvrdila opak a odvolávala sa na test,
  ktorý pripínal vymyslenú cestu; test je opravený.
- `Promise.all` v `appInitialize.ts` padne na tom, čo zlyhá prvé.
- `canHelper` hádže, keď sú contentHub/ai vypnuté.

## 10. Záznam review

Plán verifikovali dvaja nezávislí agenti. Zhodli sa na: prehliadnutom `services/api/job/jobApi.ts`,
neplatnom „8 vs 5" pre `apiFetchByIds`, 204 → `[]`, `apiFetchListBatch` ako ôsmom helperi mimo
plánu, kroku 0 označenom za hotový predčasne, a na tom, že „adminy sú čisté" platí pre volania,
nie pre expozíciu.

Opus navyše priniesol nález, ktorý plán prestaval: **2b je už v strome**, plus 202 flip, rozdelenie
elasticu, mutáciu filter bagu, rozbitú batch slučku a to, že listový test neemituje ani jeden filter.

Počet volaní je uzavretý: **45 podľa pravidla v §3**, nezávisle pre-odvodené v treťom kole vrátane
overenia, že pravidlo nič neskrýva. Otvorené zostáva len to, čo na plán nemá vplyv: počet súborov
s DAM komponentmi a niekoľko drobností v `apiFetchListBatch`.
