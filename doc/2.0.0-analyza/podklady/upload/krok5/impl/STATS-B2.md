# STATS-B2: úpravy účastníkov v kolaboračnom serveri a základ hodnôt v admin-cms

Zadanie: `krok5-praca/zadania/zadanie-stats-b2.md`. Záväzný je návrh `COLLAB-STATS.md` (§8 a §10) a B1 (`STATS-B1.md`, §12).
Zmeny sú v dvoch repozitároch, v oboch na vetve `feature/collab-stats` a nič nie je commitnuté:

- collaboration: nad `331e30e`; `.gitignore` je vlastníkov, nemenil som ho;
- admin-cms: nad `5da04120b`.

Skripty, logy a výstupy sú v `krok5-praca/stats-b2/`. Cesty bez prefixu sú v repozitári collaboration.

Označenia: **overené** = test, kontrola alebo beh proti skutočnému Redisu a Mongu; **odvodené** = môj záver bez merania.

## 1. Čo pribudlo

| Súbor | Obsah |
|---|---|
| `src/manager/collabStatsEditManager.ts` (nový) | Pamäťový agregátor `Map<room, {counters, users: Map<userId, …>}>`: `recordBodyEdit`, `recordFieldBase`, `readFieldBefore` + `recordFieldWrite`, `recordLock`, `recordRequest`. Ďalej flush (`flushCollabStatsEdits`, `startCollabStatsFlush` každých 5 s, `stopCollabStatsFlush` pri vypnutí), strop 10 000 miestností a dvojíc miestnosť × človek a pamäť zlyhaných flushov. `separateCollabStatsBase` oddelí základ od dát (`:28`). |
| `src/storage/collabStatsRedis.ts` | Lua `collabStatsFlush` (`:246-308`), `collabStatsBase` (`:315`, zápis základu do relácie) a `collabStatsFieldBase` (`:335`, čítanie). Kľúč `stats:s:<sid>:base`. `reconcile` členstva obnovuje TTL aj kľúčov `:min` a `:fields` (`:172-177`) a každá udalosť aj základu (`:232`). Z `reconcile` je odstránená neúčinná kontrola zámku miestnosti (L1, bod 8/10). |
| `src/manager/roomUserManager.ts:296-298` | `startCollaboration`: odpoveď moderátora bez `collabStatsBase` ide do `data:<room>`, základ ide do štatistík (nečakané). |
| `src/manager/collabStatsFinalizer.ts` | Kľúč základu sa maže s reláciou. |
| `src/server/document/collabStatsExtension.ts` (nový) | Hocuspocus rozšírenie `CollabStats` s hookom `onChange` (rozhodnutie 3). |
| `src/server/hocuspocus.ts` | Rozšírenie sa registruje len pri `collabStatsEnabled`. |
| `changeFieldDataListener.ts:46`, `:78`; `releaseFieldLockListener.ts:69`, `:87`, `:114` | Čítanie poľa pred zápisom a zaznamenanie zápisu. |
| `acquireFieldLockListener.ts:70`, `:88` | `locksAcquired` a `locksRefused` (len kolízia, nie chyba Redisu). |
| listenery žiadostí, `joinRequestProcessor.ts:14` | Počítadlá `joinRequested`, `joinApproved`, `joinRejected`, `joinExecuted`, `moderationRequested`, `moderationApproved` a `moderationRejected` (presunuté z B1). |
| `src/manager/roomDataManager.ts` | `getStoredData(field)`: surový `HGET data:<room> <field>`. |
| `src/manager/collabStatsLiveManager.ts` | `live/rooms` vypĺňa pri účastníkoch miestností 2+ `bodyEdits`, `fieldEdits`, `locksAcquired` a `lastEditAt`. Sú z `stats:s:<sid>:u:<userId>` v tom istom druhom pipeline (§10.9.2). |
| `src/config/config.ts`, `.env.dist` | `COLLAB_STATS_SYSTEM_FIELDS`, predvolene `articleLockingVersion,modifiedAt,modifiedBy,attributesStandard.proofread` (§10.2.1). |
| `src/index.ts` | Flush sa spúšťa so štatistikami. Pri vypnutí beží posledný flush po zatvorení serverov a pred odpojením Redisu štatistík. |
| admin-cms `articleCollabActions.ts:47-74`, `:109`, `:304-320`, `:384` | Základ hodnôt pri štarte spolupráce pod vyhradeným kľúčom `collabStatsBase` (bod 4). |

**Prepínač** (overené testami a integráciou B1): pri `COLLAB_STATS_ENABLED=false` sa rozšírenie nezaregistruje (`hocuspocus.test.ts`), flush sa
nespustí (`index.test.ts`) a listenery nič nečítajú ani nerátajú (`collabStatsEditEvents.test.ts`).

### 1.1 Čo sa ráta

- **Telo** (rozhodnutie 3, §10.3): `onChange` s `transactionOrigin.source === 'connection'`, používateľ je `context.id`
  (vracia ho `onAuthenticate`). Pravidlá (overené):
  - Yjs emituje update len pri zmene, takže sync bez zmeny a nadbytočná správa sa nezarátajú;
  - offline zmena po opätovnom pripojení sa zaráta raz;
  - origin `redis` (relay z druhého podu) a `local` sa nerátajú;
  - miestnosť sa berie z `documentName` po poslednú dvojbodku.

  Hook je synchrónny v `try/catch` a len zapisuje do pamäte. Reťaz hookov Hocuspocus ho nečaká.
- **Polia** (rozhodnutie 4, §10.2.1):
  - **Čítanie** hodnoty pred zápisom ide pred `write.mayStore()`:
    - pri zmene v `Promise.all` s `getLock`;
    - pri uvoľnení súbežne s `releaseLock`, s `await` pred `mayStore`.

    Najprv sa číta `HGET data:<room> <field>` na hlavnom klientovi. Až keď miestnosť pole nemá (jeho prvý zápis
    v spolupráci), nasleduje `collabStatsFieldBase` na klientovi štatistík: základ z relácie, zapísaný na tom istom
    spojení skôr. Medzi `mayStore` a `HSET` nie je `await`, čo test overuje poradím volaní.
  - **Porovnanie** po odpovedi klientovi: `JSON.stringify(uložené.value)` proti `JSON.stringify(nová hodnota)`. Úprava je len pri
    odlišnej hodnote a len keď `mayStore` dovolil zápis.
  - **Bez uloženej hodnoty a bez základu** sa úprava nezaráta (v1 konzervatívne).
  - **Základ** (rozhodnutie vlastníka po B2, bod 4): hodnoty polí pri štarte spolupráce sú len v relácii štatistík
    (`stats:s:<sid>:base`, TTL 7 dní, maže ich finalizér s reláciou). Ďalší štart v tej istej relácii ich nahradí. Do
    `data:<room>` sa nedostanú, takže ich opätovný vstup ani nikto iný nedostane.
  - **Systémové polia** sa vôbec nečítajú.
  - Select (zmena a potom uvoľnenie tej istej hodnoty) dá 1 úpravu, ozvena `alternateLinks` po uložení 0. Pôvodne to
    platilo len keď uvoľnenie prišlo až po odpovedi na zmenu; poslané naraz dali 2 úpravy. Opravené po posudkoch
    (§11.1/2). Any-data varianty idú na serveri tými istými udalosťami.
- **Aktívne minúty** (rozhodnutie 6): ráta sa len množina epoch minút s úpravou tela alebo poľa a
  `firstEditAt`/`lastEditAt`. Kategórie, `collabPairs`, `jointActiveMinutes` a `fieldsChanged` ako `{f, n}` počíta
  finalizér z B1 bez zmeny.

## 2. Flush (pamäť → Redis, §10.4.2)

1. **Interval**: každých 5 s na pod. Bežiaci flush sa nezdvojí a tick počas neho sa preskočí.
2. **Výmena mapy**: mapa sa na začiatku vymení, takže úpravy počas flushu idú do ďalšieho.
3. **Skripty**: jeden `EVALSHA collabStatsFlush` na miestnosť s aktivitou, všetky naraz na **klientovi štatistík**
   (`commandTimeout` 500 ms, bez offline fronty).
4. **Obsah skriptu**:
   - ukazovateľ miestnosti → relácia (bez nej nič);
   - `HINCRBY c:<počítadlo>`;
   - pre účastníka v `:users`: `HINCRBY` počtov, min/max časov (pody flushujú v ľubovoľnom poradí), `SADD` minút do
     480 a `HINCRBY` polí do 50 kľúčov, inak `other`, a `EXPIRE` 7 dní;
   - delta neúčastníka sa zahodí;
   - vstup je JSON (`cjson`).
5. **Zlyhaný flush** sa neposiela znova: Redis ho po timeoute mohol vykonať, takže by sa zarátal dvakrát. Pod si zapamätá čas
   zlyhania (strop 10 000 miestností) a ďalší flush tej miestnosti dá relácii `incomplete: 1`, ak `startedAt ≤ zlyhanie`.
6. **Strop pamäte** (10 000 miestností a dvojíc miestnosť × človek): úprava nad ním sa zahodí a zaráta. Pri flushi
   príde jeden tlmený `warn` s počtom a relácia miestnosti dostane `incomplete`. Mena polí od klienta majú strop 50 aj v
   pamäti.
7. **Pri riadenom vypnutí** sa spraví posledný flush. Ide medzi prvou skupinou (servery) a druhou (Redis), krok
   `stats edits` (overené integráciou, bod 6/4).

## 3. Horúca cesta a jej cena

| Udalosť | Pribudlo | Cena |
|---|---|---|
| úprava tela (`onChange`) | hľadanie v `Map`, prirátanie, `Set.add` minúty | 0 ciest do Redisu |
| `changeFieldData` (počítaná miestnosť, nie systémové pole) | `HGET` v `Promise.all` s `getLock` pod zámkom miestnosti; po odpovedi `JSON.parse` a 2× `JSON.stringify` | +1 príkaz na hlavnom spojení súbežne s `getLock`, bez ďalšej cesty (odvodené) |
| `releaseFieldLock` | `HGET` súbežne s `releaseLock` | +1 príkaz, bez ďalšej cesty (odvodené) |
| prvý zápis poľa v spolupráci (miestnosť ho nemá) | po `HGET` ešte `EVALSHA collabStatsFieldBase` na klientovi štatistík | +1 cesta raz na pole a spoluprácu; pri zaseknutom spojení štatistík čaká najviac 500 ms, pri odpojenom zlyhá hneď (nezaráta sa) |
| štart spolupráce | `EVALSHA collabStatsBase` na klientovi štatistík, nečakaný | 0 čakania |
| `acquireFieldLock`, žiadosti, `joinRequestProcessor` | zápis do pamäte | 0 |
| flush | 1 `EVALSHA` na miestnosť s aktivitou za 5 s na pod | merané (nižšie) |
| `live/rooms` | +1 `HMGET` na účastníka miestnosti 2+ v existujúcom druhom pipeline | stále 2 cesty |
| `reconcile` finalizéra | +2 `EXPIRE` na účastníka raz za 5 min | mimo handlerov |

**Mikromeranie flushu** (`meranie-flush.sh`, `meranie-flush.txt`, `dist` proti `stats-b2-redis` 7.2.4): scenár b z
`perf` je 30 miestností × 3 editori. Na editora pripadá 10 úprav tela za 5 s a na miestnosť 1 úprava poľa; spravených
20 flushov.

- **Flush 30 miestností**: p50 1 446 µs, p95 1 892 µs, max 2 043 µs čakania časovača. Beží mimo handlerov.
- **Redis**: 24 µs na `EVALSHA` (miestnosť s 3 účastníkmi), teda ~0,7 ms času Redisu za 5 s na pod.

Vplyv na latenciu úprav, ackov, CPU a slučky udalostí sa nemeral. Podľa zadania to spraví vedúci (brána 10.13/4).

## 4. admin-cms: základ hodnôt pri štarte spolupráce

Patrí do admin-cms a collaboration, common-admin sa nemení. Gathering listener `articleCollabActions.ts:372-390` je
admin-cms kód (len moderátor), ktorý už pridáva `site`, `rubric` a `multiTitleSnapshot`. Pribudol v ňom jeden kľúč
bufferu: **`collabStatsBase`** s objektom `{ pole: hodnota }` (`collabStatsBase()`, `:304-320`).

- **Čo obsahuje**:
  - pole `COLLAB_BASE_FIELDS` cez `objectGetValueByPath`, ak nie je `undefined`: `texts.headline`, `texts.perex`,
    `texts.overline`, `seo.title`, `seo.description`, `seo.slug`, `canonicalUrl`, `keywords`, `articleAuthors`,
    `listingImage`, `socialImage`, `attributesStandard.lockType`, `flagsStandard.aiReclassifyOnPublish`,
    `recommender.manual`, `recommender.eligible`, `recommender.evergreen`, `recommender.shelfLifeDays`,
    `experiment.startOnPublish` a `experiment.autoApplyResult`;
  - `leadImageMedia` ako `{ image: leadImage, media }` (poradie kľúčov ako `ImageMediaWidgetInner`);
  - pri načítaných multi-titulkoch `multiTitleHeadline:<v>` a `multiTitlePerex:<v>` variantov, ktoré nie sú použité.
- **Zhoda formátu**: každá hodnota je JSON-zhodná s tým, čo posiela komponent poľa. Overené čítaním komponentov
  common-admin (`AFormTextarea`, `AFormTextField`, `AFormSwitch`, `AFormRemoteAutocomplete`, `ImageWidgetInner`,
  `ImageMediaWidgetInner`) a admin-cms. Inštalovaný common-admin `2.0.0-rc.1` sa zhoduje so zdrojom.
- **Na serveri** `startCollaboration` odpoveď rozdelí: dáta bez kľúča `collabStatsBase` idú do `data:<room>` ako doteraz
  (aj pri vypnutých štatistikách sa kľúč odstráni). Základ ide nečakane do relácie štatistík, systémové polia bez neho.
  Hodnoty zmenené moderátorom v samote ostávajú v dátach a majú prednosť.
- **`collabStatsBase` je v admin-cms riadiace pole** (`isCollabControlField`), takže sa nikdy nezapíše do článku. Na
  poradí nasadenia preto nezáleží: starý server by kľúč nechal v dátach miestnosti, klient ho však ignoruje.
- **Zoznam je širší ako v prvej verzii.** Riziká vynechaných polí (lokálna zmena prepísaná pri opätovnom vstupe, nové
  načítanie u pripájajúceho) zanikli, lebo základ klienti nedostávajú.
- **Bez základu ostávajú** spúšťače a hodnoty mimo článku (`route`, `audioNarration`, `articlePublicPreview`,
  `articlePreviewExpires`, `articleBookmarks`, udalosti multi-titulkov, štádiá), komentáre a embedy. `site`, `rubric`,
  `alternateLinks` a `thirdPartyTrackers` sú v dátach miestnosti už dnes.

## 5. Testy

collaboration `yarn test`: **31 súborov, 295 testov a 3 preskočené** (skutočný Redis). S `REDIS_TEST_URL` proti
`stats-b2-redis` ich je **298** a nič sa nepreskočí. Pred B2 to bolo 28 súborov, 259 testov a 2 preskočené.

| Súbor | Testy | Čo overuje |
|---|---|---|
| `collabStatsEdits.test.ts` (nový) | 16 | **Základ**: je v relácii, nie v `data:<room>` ani v tom, čo dostane opätovný vstup (`enteredCollabRoom`). Ďalší štart ho nahradí. Systémové polia ani `undefined` v ňom nie sú. Odpoveď bez neho sa uloží celá a pri vypnutí sa nezapíše. Prvý zápis zmeneného poľa sa zaráta raz, nezmeneného nie. Uložená hodnota má prednosť, základ sa číta len pre pole, ktoré miestnosť nemá. Nová relácia začína bez neho. Flush do relácie: počty, časy v ľubovoľnom poradí, minúty, polia, zámky, počítadlá a TTL. Nič pre neúčastníka, miestnosť bez relácie, nepočítanú miestnosť ani pri vypnutí. Porovnanie hodnôt (fokus/blur, ozvena, select, bez základu). Systémové pole sa nečíta a zlyhané čítanie nehodí. Strop 50 polí a `other` v pamäti aj v Redise, 480 minút. Strop pamäte → jeden `warn` a `incomplete`. Zlyhaný flush → tlmený `warn`, stratený, `incomplete` ďalším flushom. Neoznačí reláciu začatú po zlyhaní. Jeden flush naraz. Časovač 5 s a posledný flush pri zastavení. |
| `collabStatsEditEvents.test.ts` (nový) | 9 | Skutočné listenery: prvé uvoľnenie poľa zmeneného od štartu sa zaráta raz, nezmenené nie; základ sa číta až po prázdnom `HGET`. zmena a uvoľnenie s inou hodnotou sú úpravy, rovnaká hodnota nie je. Select = 1. Prvý zápis bez základu ani systémové pole sa nerátajú (a systémové sa nečíta). Poradie **čítanie → `mayStore` → store bez prechodu slučky** (mikroúloha zaradená v `mayStore` príde až po store). **Súbeh dvoch používateľov na jednom poli**: každý sa porovná s hodnotou, ktorú prečítal (oba zarátané, aj keď druhý zapísal tú istú hodnotu). Zámky: kolízia áno, chyba Redisu nie. Všetkých 7 počítadiel žiadostí. Vypnuté nič nečíta. |
| `collabStatsBody.test.ts` (nový) | 5 | Skutočný Hocuspocus 4.7.1 a provideri: úprava sa pripíše používateľovi spojenia, sync ani prijatá zmena sa nerátajú. Offline zmena po návrate sa zaráta raz. Hook je zaregistrovaný. Originy `redis`, `local`, bez používateľa a bez miestnosti sa nerátajú. Hook nikdy nezamietne. |
| `collabStatsMembership.test.ts` | +3, 1 nahradený | `reconcile` drží `:min` a `:fields` aj po 8 dňoch. L1: test preskočenia zamknutej miestnosti nahradil test „nezapíše pod finalizéra“, pribudol test známeho obmedzenia (posledný odchod počas kontroly → `stale`, koniec v čase snímku) a paritný scenár je bez zápisu zámku. **Lua flushu a základu na skutočnom Redise = zrcadlo v TS** (stav aj odpovede; scenár so zlyhaným flushom, neúčastníkom, miestnosťou bez relácie, poliami nad stropom, časmi mimo poradia, základom nahradeným druhým štartom a porovnaním so základom). |
| `collabStatsFinalizer.test.ts` | +1 | Od úprav po Mongo: `realCollab` dvojice, čitateľ `edited: false`, `fieldsChanged`, `activeMinutes`, `jointActiveMinutes`; kľúč základu zmazaný s reláciou. |
| `collabStatsLive.test.ts` | +1 (1 rozšírený) | Úpravy účastníkov v `live/rooms`, 0 pred prvým flushom; `null` v miestnosti 1 človeka a bez `HMGET`. |
| `config.test.ts`, `hocuspocus.test.ts`, `index.test.ts` | +1, +1, 2 rozšírené | Systémové polia, žiadny hook pri vypnutí, štart flushu a posledný flush pred odpojením Redisu. |

admin-cms:

- `articleCollabGathering.test.ts` (+2 testy, 1 rozšírený): základ moderátora je pod `collabStatsBase`, nie ako
  samostatné polia; hodnota z bufferu ostáva v dátach. Pole bez hodnoty sa nepošle, `leadImageMedia` má tvar widgetu
  a multi-titulky, ktoré nie sú použité, idú pod vlastnými menami. Nemoderátor nepošle nič.
- `articleCollabFieldKeys.test.ts` (+1): `collabStatsBase` sa nezapíše do článku.
- Všetkých 6 súborov okolo gatheringu a kolaborácie článku prešlo, spolu 179 testov.

## 6. Integrácia (`integracia.sh` → `integracia.mjs`)

Prostredie: 2 pody z `dist`, `stats-b2-redis` 7.2.4 a `stats-b2-mongo` 8.0.20 (replica set). Klienti sú socket.io a
Hocuspocus provideri s JWT z `perf`. Výstup je v `integracia-vystup.txt`, logy v `server-a.log` a `server-b.log`.

Behy:

- prvý (`integracia-vystup-1.txt`) dal 11/14: miestnosti 3 a 4 v skripte boli spolu kratšie ako 30 s, takže vyšli
  správne ako `clickThrough`;
- druhý po oprave skriptu (`-2.txt`) a tretí po odstránení L1 (`-3.txt`) dali 14/14;
- štvrtý na finálnom `dist` so základom mimo dát miestnosti (`integracia-vystup.txt`) dal **15/15 OK**.

Moderátor v ňom posiela základ pod `collabStatsBase` ako admin-cms.

1. **Dvaja editori.** 101 má socket.io na A a telo na B, 202 opačne.
   - **Základ**: po štarte sú v `data:<room>` aj v tom, čo dostane opätovný vstup 101 (`enteredCollabRoom`), len
     `bodyEditor`. V relácii je `seo.title` a `texts.headline`.
   - Úpravy a ich počty:
     - 101: 3 + 1 úprava tela;
     - 202: 1 + 1 úprava tela, zmena titulku (porovnaná so základom), zámok;
     - 101: zámok odmietnutý, `keywords` dvakrát (prvý zápis bez základu, druhý je úprava);
     - nerátané: select (uvoľnenie tej istej hodnoty), ozvena `seo.title` so základom a `articleLockingVersion` a
       `modifiedAt`.
   - `live/rooms` po flushi: 101 má `3/1/0`, 202 má `1/1/1` a obaja `lastEditAt`.
   - Relácia: `realCollab`, `editors 2`, `collabPairs [[101,202]]`, `jointActiveMinutes 2`.
     - 101: `bodyEdits 4`, `fieldsChanged [{keywords:1}]`, `locksRefused 1`, `activeMinutes 2`;
     - 202: `bodyEdits 2`, `fieldsChanged [{texts.headline:1}]`, `locksAcquired 1`, `activeMinutes 2`;
     - `counters`: `joinRequested`, `joinApproved`, `joinExecuted`, `collabStarts` a `occupied` po 1.
2. **Čitateľ bez úprav** vedľa editora: `presenceOnly`. Čitateľ 302 má `edited false`, 0 úprav a 0 minút.
3. **Offline.** 402 spraví 2 úpravy online, potom 1 zmenu offline a pripojí sa naspäť. Druhá karta cez B sa
   synchronizuje bez zmeny. Výsledok: `bodyEdits` 402 je **presne 3** a relácia je `realCollab`.
4. **Riadené vypnutie.** 501 cez B spraví 3 úpravy. Redis ich ešte nemá (0), nasleduje `SIGTERM` podu B. Po skončení je
   v Redise 3 a v logu B je `Shutdown: stats edits closed in 2 ms`.
5. **Celkovo:**
   - žiadna relácia nie je `incomplete`;
   - `collab_daily_users` má páry `101_202` a `401_402`;
   - Redis je po zápisoch prázdny;
   - v logoch oboch podov nie je žiadny `warn` ani `error` štatistík.

## 7. Kontroly

collaboration (`kontroly.sh`, `kontroly.log`, `kontrola-*.log`) skončili všetky s 0:

- `yarn lint:fix` a `yarn ci`;
- `yarn test` 3× (295 + 3 preskočené) a raz s `REDIS_TEST_URL=redis://127.0.0.1:6398/15` (298);
- `yarn build` a `yarn tsc`.

Prod štart (`start-prod.sh`): moduly sa načítajú a štart skončí na `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`.

admin-cms (`kontroly-admin-cms.sh`, `kontroly-admin.log`) skončili všetky s 0:

- `generate:dts`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` a `lint:tsc` (`vue-tsc --build`);
- testy dotknutých súborov s `VITEST_MAX_WORKERS=2`.

`yarn ci` v admin-cms púšťa `vue-tsc` (6 GB) a celú sadu testov súbežne. Preto som jeho časti spustil po jednej a celú
sadu admin-cms som nespúšťal (zadanie: testy dotknutých súborov).

Kontajnery `stats-b2-redis` a `stats-b2-mongo` sú zmazané.

## 8. Odchýlky od návrhu a rozhodnutia

1. **`HGET` pri uvoľnení súbežne s `releaseLock`, nie po ňom** (§10.2.1). Ušetrí sa tak jedna cesta do Redisu na
   uvoľnenie. Čítanie má vlastný `catch` (zlyhanie znamená, že sa úprava nezaráta), takže uvoľnenie zámku neovplyvní.
   Pred `mayStore` je `await`, medzi `mayStore` a `HSET` nie.
2. **`HGET` na hlavnom klientovi, nie na klientovi štatistík.** `data:<room>` je kľúč kolaborácie. Príkaz ide po tom istom
   spojení ako `getLock`/`releaseLock`, takže nepridá samostatnú cestu ani nový spôsob zlyhania. Klient štatistík s
   timeoutom ostáva pre flush (zadanie, bod 4) a pre zápis a čítanie základu (kľúče relácie).
3. **Zlyhaný flush sa neopakuje, ale označí reláciu `incomplete`.** Opakovanie po timeoute by mohlo zarátať dvakrát.
   `incomplete` tak okrem zlyhaného záznamu členstva (B1) znamená aj stratené úpravy. Komentáre v modeli sú upravené,
   tvar dát je bez zmeny.
4. **`reconcile` obnovuje TTL aj `:min` a `:fields`** (Lua členstva z B1, zrkadlo aj paritný test). Bez toho by
   relácia dlhšia ako 7 dní stratila minúty a polia účastníka, ktorý dávno odišiel.
5. **`live/rooms` vypĺňa úpravy účastníkov**: typ z časti A ich mal `null` „do B2". Sú staré najviac ~10 s.
6. **Význam `joinExecuted`**: spracovaný job žiadosti o vstup, či už po schválení, alebo po uplynutí čakania (vtedy klient
   dostane `approvedRequestToJoin`). `moderationExecuted` ostáva v Lua členstva (B1).
7. **`COLLAB_STATS_SYSTEM_FIELDS`** má predvolenú hodnotu v kóde a prázdna hodnota znamená predvolenú. V `configuration.yaml` nie
   je, takže nasadenie nič nevyžaduje.
8. **Paritný test Lua flushu je v `collabStatsMembership.test.ts`**, nie vo vlastnom súbore. Testy na skutočnom Redise
   robia `FLUSHDB` a merajú `INFO commandstats` celého servera, takže dva súbory bežiace súbežne sa rušili (overené:
   test počtu príkazov z B1 zlyhal). V jednom súbore idú po sebe.
9. **Základ mimo dát miestnosti** (rozhodnutie vlastníka po B2; návrh §10.2.1 ho mal v odpovedi `startCollab` ako dáta).
   Vlastný kľúč v odpovedi (`collabStatsBase`), oddelený na serveri, uložený v relácii štatistík. Zapisuje sa aj číta
   na klientovi štatistík, nečakane, a pravidlo porovnania ostalo: uložená hodnota miestnosti, inak základ.

10. **L1 (rozhodnutie vlastníka, možnosť b): neúčinná kontrola zámku z `reconcile` odstránená.** Odstránené sú
    `EXISTS KEYS[4]` v Lua členstva, kľúč `lock:room:<room>` ako argument (skript má 3 kľúče), `roomLockResource`
    v `exectionLockHelper.ts` (súbor je ako pred `331e30e`), podmienka v zrkadle a testy so zápisom zámku cez `SET`.
    Kontrola nikdy nezabrala: Redlock robí v svojich skriptoch `SELECT 0` (`@sesamecare-oss/redlock`, `settings.db`
    predvolene 0, overené čítaním), štatistiky čítajú databázu z `REDIS_URL`. Známe obmedzenie je zapísané v
    `STATS-B1.md` §12.1: posledný odchod súbežný s 5-minútovou kontrolou skončí ako `stale` namiesto `empty`.

## 9. Riziká a neoverené

- **Výkon** (brána 10.13/4) a Mongo dole pod záťažou (10.13/5) som nemeral; podľa zadania ich meria vedúci. Mám len
  mikromeranie flushu (bod 3).
- **Základ**:
  - opätovný vstup ho už nedostáva (overené testom aj integráciou);
  - ak sa relácia miestnosti počas spolupráce vymení (vstup do miestnosti s mŕtvym podom), nová relácia základ nemá a
    prvý zápis poľa v nej sa nezaráta;
  - základ, ktorý sa nezapíše (zlyhanie Redisu štatistík), dá len tlmený `warn`.
- **Prvý zápis poľa bez základu** (polia z konca bodu 4) sa nezaráta, v1 je konzervatívne.
- **Prvá zmena tela v spojení bez textu sa nezaráta**: len mazanie, formát, Enter alebo vloženie embedu ako prvá vec po
  otvorení editora. Server neráta prvú aktualizáciu spojenia Hocuspocus, ktorá nevkladá text (§11.8/4), lebo to isté
  zapíše editor sám pri otvorení. Ďalšie zmeny sa už rátajú.
- **Zachovaná približnosť**:
  - ozvena `alternateLinks` po uložení, keď server pridelil novým riadkom id, sa zaráta raz (vždy až po skutočnej
    úprave odkazov). Pôvodne to boli 2 úpravy, keď zmena a uvoľnenie išli naraz (Apply a potom uloženie); opravené
    v §11.1/2;
  - ozvena `multiTitleBoxItemsOverride` (`{ ids: [], ts }`) po uložení sa zaráta ukladajúcemu ako 1 úprava poľa
    (len po výbere položiek boxov, `ts` sa vždy líši);
  - súbeh dvoch používateľov na jednom poli sa počíta proti hodnote prečítanej pred zápisom (test).
- **Pád podu** stratí najviac 5 s jeho úprav a reláciu neoznačí `incomplete` (pamäť zlyhaní je v pode). Rovnako pri
  zlyhanom flushi miestnosti, ktorá na tom pode už žiadnu úpravu nemá.
- **Nová relácia v okne 5 s**: keď relácia miestnosti v tom okne vymení inú (vstup do miestnosti s mŕtvym podom), úpravy
  sa pripíšu novej relácii (odvodené).
- **Veľkosť odpovede `startCollab`**: základ ju zväčší o niekoľko KB. Limit socket.io je 1 MB spolu s telom; nad 200
  polí alebo 64 KB server základ zahodí (§11.1/3).
- **Redis Cluster** podporovaný nie je (ako v B1). Skript používa `cjson` zo štandardného Lua v Redise; overené na 7.2.4.
- Celú sadu testov admin-cms ani `yarn ci` v jednom kuse som nespúšťal (bod 7).

## 10. Návrhy správ commitov

collaboration:

```
feat: the edits of the collaboration sessions of the stats (part B2): a Hocuspocus hook counts each update of a client's connection that changed the body, for its user (offline changes too, a sync that changes nothing and an update relayed by another instance not); a change or a release of a field counts only when its value differs from the one the room holds, or while it holds none from the value the field had when the collaboration started, read along with the lock before the write may store; the moderator's client sends those values apart in its startCollab answer (collabStatsBase), kept only in the stats' session, never in the room's data a rejoin gets; the locks acquired and refused and the requests to join and to take the moderation are counted too; all in the memory of the instance, with no I/O on an event, and written into the session every 5 s by one Lua script per room on the stats' own client (the first and the last edit, the minutes with an edit up to 480, the edits per field up to 50 and other), the last time on the shutdown; a failed flush or edits over the cap of the instance mark the session incomplete instead of being sent again; the fields a save sends (COLLAB_STATS_SYSTEM_FIELDS) never count; the liveness check keeps the minutes and fields of a participant as long as the session and no longer checks the lock of the room, which Redlock keeps in database 0 where the check never saw it (a last leave during the check ends as stale); live/rooms shows what each participant did; COLLAB_STATS_ENABLED=false turns it all off
```

admin-cms:

```
feat: when a collaboration starts, the moderator also sends, apart under collabStatsBase, the current values of the article's collaboration fields as their widgets send them (texts, SEO, canonical URL, keywords, authors, images, lead image and media, lock type, flags, recommender, experiment, the multi-title variants not in use), so the collaboration stats can tell a first change of each field from a value sent again; the server keeps them out of the room's data, and collabStatsBase is never written into the article
```

## 11. Opravy po posudkoch

Zadanie: `krok5-praca/zadania/zadanie-stats-b2-opravy.md`. Posudky: `posudky/stats-b2-codex.md` a
`posudky/STATS-B2-opus.md`. Pracoval som nad collaboration `d7fe2f7` a admin-cms `290185d11` (len bod 6). Nič nie je
commitnuté a `.gitignore` je vlastníkov. Skripty a logy sú v `krok5-praca/stats-b2-opravy/`.

### 11.1 Čo sa zmenilo

1. **Pred zápisom poľa nič nečaká na klient štatistík** (Codex H1+H2, Opus M1).
   - Pred `mayStore()` ostal len `HGET data:<room>` na hlavnom klientovi, súbežne s `getLock` alebo `releaseLock`
     (`readFieldBefore`, `collabStatsEditManager.ts:291-297`).
   - Základ `collabStatsFieldBase` sa číta až po odpovedi, nečakane a len keď `HGET` vrátil null. Až potom ide
     porovnanie a `recordEdit` (`recordFieldWrite`, `:306-330`).
   - Platí to pre zmenu, uvoľnenie s dátami aj any-data varianty, ktoré idú tými istými udalosťami.
   - Zápis poľa tak nedrží zámok miestnosti kvôli štatistikám a uvoľnenie neodloží svoj zápis za zápis iného
     používateľa.
2. **Zmena a uvoľnenie tej istej hodnoty sú 1 úprava**, aj poslané naraz (Opus M2).
   - `fieldWriteOrder` si pri `mayStore(value)` pamätá, čo soket pre pole uložil (`fieldWriteOrder.ts:6`, `:22-35`).
   - Hodnota rovnaká ako posledná uložená týmto soketom sa nezaráta (`collabStatsEditManager.ts:316`). Nejde to cez
     Redis, je to len odkaz na hodnotu.
3. **Základ pri štarte** (Opus L1, Codex M3).
   - Oddelenie a zápis základu sú v `try/catch` v callbacku socket.io (`roomUserManager.ts:296-305`).
   - Páry idú ako jedno pole, ktoré ioredis rozvinie, nie ako spread argumentov.
   - Nad 200 polí alebo 64 KB sa základ zahodí s tlmeným `warn`.
   - Každý štart kolaborácie zmaže starý základ relácie, aj keď klient žiadny neposlal (`:256-288`, Lua prázdnym
     zoznamom).
4. **Názvy polí** (Opus L2).
   - Štatistiky berú len reťazec s `isWellFormed()` a najviac 200 znakmi (`:26-31`), pri čítaní, zápise aj v základe.
   - Iné názvy ignorujú; kolaborácia ich spracuje ako doteraz, takže zlý názov nezhodí flush miestnosti (test).
5. **Do §9 pribudli známe veci**: ozvena `multiTitleBoxItemsOverride` a veľkosť odpovede `startCollab`.
6. **Prah úprav tela** (Codex M2, Opus „neoverené"): test so skutočným editorom (11.2), rozpoznanie koncového odseku
   na serveri a `minEditOps` 1.
   - Server: prvá aktualizácia každého spojenia Hocuspocus, teda otvorenie editora, sa dekóduje
     (`collabStatsExtension.ts:11-30`, `:50-54`).
   - Ak má najviac 256 B, obsahuje len prázdny odsek s atribútmi a nič nemaže, nezaráta sa. Ďalšie aktualizácie
     spojenia sa nedekódujú.
   - `minEditOps` je 1 (`collabStatsSessionHelper.ts:14`, `COLLAB-STATS.md` §8/5 a §10.1/4): každá skutočná zmena
     tela znamená, že účastník upravoval.

### 11.2 Bod 6: čo ukázal test so skutočným editorom

Test je v admin-cms, `src/test/articleBodyCollabOpen.test.ts` (13 testov).

- **Zostava ako v admin-cms**: rozšírenia článku z `useArticleBodyExtensions`, `Collaboration` nad Y.Doc a
  `CollaborationCaret`. Editor je pripojený cez `EditorContent`, takže sa vykreslia aj node views embedov. Beží s
  pluginom common-admin, Vuetify a i18n.
- **Telá**: text so zoznamom a citátom a odsekom na konci; embedy medzi odsekmi s embedom na konci; nadpis na konci;
  prázdne telo.
- **Úlohy**: moderátor (telo, ako ho pri štarte drží jeho editor bez kolaborácie), pripájajúci sa (telo zo servera) a
  dokument synchronizovaný ešte pred naviazaním editora.

Výsledky:

- **Editor naviazaný pred synchronizáciou** (tak ho zakladá `ArticleBodyEditor`, provider až potom synchronizuje):
  - pri otvorení odíde **0 aktualizácií** vo všetkých prípadoch;
  - trailing node pridá koncový odsek len do ProseMirror: y-prosemirror ho počas synchronizácie nezapíše, lebo
    zápis z Y beží v `mux`;
  - ~~odsek ide do dokumentu až s prvou zmenou~~ **Opravené v 11.8**: test aktualizácie zbiera hneď po
    synchronizácii. V skutočnej relácii ide odsek do dokumentu hneď po otvorení, pri prvom update view (fokus, kurzor
    druhého používateľa), spolu s ostatnými opravami editora. 1 napísaná zmena dá 1 aktualizáciu.
- **Dokument synchronizovaný pred naviazaním** (stane sa, ak provider stihne sync skôr, ako sa editor pripojí; preteky,
  odvodené):
  - pri tele bez koncového odseku odíde 1 aktualizácia: **presne prázdny odsek s atribútom `textAlign`**, bez mazania
    (test ju dekóduje);
  - iný zápis pri otvorení test nenašiel.
- **Fixtures** `test/fixtures/collabBodyUpdates.ts` v collaboration sú aktualizácie z tohto testu: dokument servera,
  koncový odsek, znak napísaný po ňom a prvý znak, ktorý odsek nesie. `collabStatsBody.test.ts` ich pošle skutočnému
  Hocuspocus:
  - koncový odsek pri otvorení sa nezaráta;
  - znak po ňom sa zaráta;
  - prvý znak s odsekom sa zaráta;
  - koncový odsek, ktorý nie je prvou aktualizáciou spojenia, sa zaráta.

### 11.3 Testy

collaboration `yarn test`: **31 súborov, 305 testov a 3 preskočené**. S `REDIS_TEST_URL` proti `stats-b2o-redis` ich je
**308**. Pred opravami to bolo 298.

- `collabStatsEditEvents.test.ts` (+2):
  - zaseknutý klient štatistík: zmena aj uvoľnenie odpovedia, zámok miestnosti je voľný a úprava sa zaráta, až keď
    klient odpovie;
  - zmena a uvoľnenie jednej hodnoty poslané naraz dajú 1 úpravu (`alternateLinks`, `articlePreviewExpires`). Bez
    opravy test zlyhá s 2, overené;
  - čítanie základu ide až po store.
- `collabStatsEdits.test.ts` (+3): štart bez základu a nad stropom (201 polí, 64 KB) zmaže starý s jedným `warn`;
  zlyhanie štatistík v callbacku socket.io nezabráni uloženiu dát miestnosti; zlé názvy polí.
- `collabStatsBody.test.ts` (+4): fixtures zo skutočného editora; `isTrailingParagraph` (prázdny odsek áno, text,
  nadpis, mazanie, dva odseky a veľký atribút nie).
- `collabStatsSessionHelper.test.ts` (+1, 1 upravený): jedna úprava tela znamená, že účastník upravoval.
- `collabStatsMembership.test.ts`: paritný scenár na skutočnom Redise prechádza aj s poľom párov základu a s čítaním
  základu po odpovedi.

admin-cms: `articleBodyCollabOpen.test.ts` (13, nový). 7 dotknutých súborov má spolu 194 testov.

### 11.4 Integrácia (`krok5-praca/stats-b2-opravy/integracia.sh`)

Skript je B2 s proxy z B1-opráv, ktorá vie zadržať odpovede spojeniu štatistík. Výstup `integracia-vystup-kolo1.txt` dal
**17/17 OK**: všetky scenáre B2 a fáza 5.

- **Fáza 5**: spojenie štatistík zaseknuté na 2 s, potom zmena poľa, zámok ďalšieho poľa a jeho uvoľnenie. Odpovedali
  za 51, 16 a 57 ms, bez zaseknutia za 9, 9 a 9 ms.
- **Opakovaný beh** `STALL_ONLY=1` (`integracia-stall.txt`, 5 kôl): časy so zaseknutím a bez neho sú rovnaké, 7–61 ms.
  ~50 ms sa objavuje aj bez zaseknutia, takže nejde od štatistík. Nič nečaká 500 ms timeoutu klienta štatistík.
- **Počty**: prvý zápis poľa pred zaseknutím sa zarátal proti základu. Ten počas zaseknutia nie, lebo čítanie základu
  klient vzdal po 500 ms.

### 11.5 Kontroly

collaboration (`kontroly.sh`, `kontroly-kolo1.log`; `kontrola-*.log` prepísal beh z 11.9) skončili všetky s 0:

- `yarn lint:fix` a `yarn ci`;
- `yarn test` 3× a raz s `REDIS_TEST_URL=redis://127.0.0.1:6397/15`;
- `yarn build` a `yarn tsc`.

Prod štart z `dist` skončí na `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`.

admin-cms (`kontroly-admin-cms.sh`) skončili všetky s 0: `generate:dts`, `format:check`, oxlint, eslint, stylelint,
`vue-tsc` a testy dotknutých súborov s `VITEST_MAX_WORKERS=2`.

Kontajnery `stats-b2o-*` sú zmazané. Na chvíľu som omylom spustil aj `stats-b2-redis` zo skriptu B2 a hneď ho zmazal.

### 11.6 Odchýlky a známe

- **Koncový odsek per spojenie, nie per používateľ v relácii**: každé otvorenie editora, aj reload v tej istej relácii,
  môže koncový odsek zapísať. Cena je rovnaká (`WeakSet`, dekódovanie len prvej aktualizácie; po 11.8 do 16 KB).
- **Počas zaseknutia klienta štatistík** sa prvý zápis poľa, ktoré miestnosť ešte nemá, nezaráta: čítanie základu
  zlyhá.
- ~~Pravidlo „posledná hodnota soketu"~~ **nahradené v 11.8/1**: pôvodne nezarátalo soket, ktorý po zmene iného
  používateľa vráti pole na svoju skoršiu hodnotu.
- **Postrehy mimo rozsahu**:
  - ~~`anchorExtension` netestované~~ **otestované v 11.8/4**: kotvy aj autolink zapíšu pri otvorení, bez textu;
  - ~50 ms pri zápise poľa v integrácii nie sú od štatistík (bod 11.4), príčinu som nehľadal.

### 11.7 Návrhy správ commitov

Sú v 11.9 a pokrývajú obe kolá opráv; nič z nich nie je commitnuté.

### 11.8 Druhé kolo po overení

Overenia: `posudky/stats-b2-opravy-codex.md` a `posudky/STATS-B2-opravy-opus.md`. Schválil vlastník, pracoval som nad
rovnakým pracovným stromom.

1. **Zmena a uvoľnenie.**
   - Zápis sa preskočí, len keď sa so soketovým posledným zápisom poľa zhoduje nová hodnota aj hodnota pred zápisom
     (`HGET` miestnosti).
   - Dvojica zmena a uvoľnenie poslaná naraz je 1 úprava: obe prečítali pole pred uložením.
   - Prípad A=X, B=Y, A=X sa zaráta: druhý zápis A čítal Y (test).
   - Zápisy jedného soketu sa zaznamenajú v poradí, v akom sa uložili (jeden klient Redisu).
2. **Odtlačok namiesto hodnoty.**
   - `fieldWriteOrder` nedrží hodnotu: má len slot `mark`, ktorý nastavujú štatistiky (`lastMark`, `setMark`).
   - Je to 16-znakový odtlačok sha1 z hodnoty pred zápisom a novej hodnoty.
   - Ukladá sa až po odpovedi, len pri zapnutých štatistikách a len pre rátané polia: počítaná miestnosť, platný názov,
     nie systémové pole.
   - Pri `COLLAB_STATS_ENABLED=false` ani pre nerátané pole sa nič neuloží (test).
3. **Strop základu.**
   - Počet polí sa kontroluje hneď (`Object.keys`), pred prevodom: nad 200 sa nič neprevedie.
   - Prevod sa zastaví pri prekročení 64 KB.
   - Test má getter, ktorý by pri prevode hodil.
4. **Telo, všeobecné pravidlo.**
   - Prvá aktualizácia každého spojenia Hocuspocus, ktorá nevkladá text (žiadna položka `ContentString`), sa nezaráta
     (`insertsNoText`).
   - Dekóduje sa len prvá aktualizácia spojenia a len do 16 KB; väčšia sa ráta.
   - Editor som nemenil.
   - `articleBodyCollabOpen.test.ts` (16 testov) pribudlo telo s kotvou dvakrát a prázdnou kotvou, holou URL na konci
     prvého bloku a embedom na konci. Pribudol aj krok fokusu a zmeny awareness (kurzor druhého používateľa).
   - **Výsledok**: pri každom tele a v každej úlohe odíde bez písania najviac 1 aktualizácia, bez textu. 1 napísaný
     znak dá 1 aktualizáciu s textom.
   - Pri tele s kotvami a URL je jediná aktualizácia otvorenia overená: duplicitná a prázdna kotva sú zrušené, URL má
     značku `link` a na konci pribudol odsek.
   - Fixtures zo skutočného editora (`collabBodyFixes`) idú na server (`collabStatsBody.test.ts`): otvorenie = 0
     úprav, znak = 1.
5. **`STATS-B2.md`**: §9 má známu vec „prvá zmena spojenia bez textu sa nezaráta", tvrdenie v 11.2 je opravené.

**Testy**: collaboration `yarn test` má 31 súborov, **308 testov a 3 preskočené**; s `REDIS_TEST_URL` proti
`stats-b2o-redis` **311**. Pribudli:

- `collabStatsEditEvents.test.ts` (+2): A=X, B=Y, A=X sa zaráta; bez štatistík ani pre nerátané pole sa odtlačok
  neuloží.
- `collabStatsBody.test.ts` (+1, 1 nahradený): opravy editora pri otvorení sa nerátajú, znak po nich áno;
  `insertsNoText` pokrýva fixtures, mazanie, prázdne bloky, text a aktualizáciu nad 16 KB.

admin-cms: `articleBodyCollabOpen.test.ts` 16 testov.

### 11.9 Kontroly druhého kola a návrhy správ commitov

Všetko v `krok5-praca/stats-b2-opravy/`.

- collaboration (`kontroly.sh`, `kontroly.log`, `kontrola-*.log`) skončili všetky s 0: `yarn lint:fix`, `yarn ci`,
  `yarn test` 3× (308 a 3 preskočené), raz s `REDIS_TEST_URL=redis://127.0.0.1:6397/15` (311), `yarn build` a
  `yarn tsc`.
- **Integrácia** (`integracia.sh`, výstup `integracia-vystup.txt`) dala **17/17 OK**, počty sú rovnaké ako v 11.4.
  - Fáza 5: so zaseknutým spojením štatistík odpovedali zmena, zámok a uvoľnenie za 75, 25 a 73 ms, bez zaseknutia
    za 78, 26 a 74 ms.
  - Prvý beh skončil 11/12 na chybe skriptu: `let before` som po kole 1 obalil do bloku `STALL_ONLY`. Opravil som
    skript, kód nie.
- Prod štart z `dist` skončí na `MongooseServerSelectionError: getaddrinfo ENOTFOUND mongo-anzu`.
- admin-cms (`kontroly-admin-cms.sh`, `kontroly-admin.log`) skončili s 0: `generate:dts`, `format:check`, eslint,
  stylelint, `vue-tsc` a 8 dotknutých súborov (197 testov, `VITEST_MAX_WORKERS=2`).
  - oxlint najprv hlásil poradie importu z `y-protocols/awareness` (`sort-imports`). Po oprave prešli `format:check`,
    oxlint, eslint aj test súboru (16).
- Kontajnery `stats-b2o-*` sú zmazané.

collaboration:

```
fix: the edits of the collaboration stats after the reviews: no write of a field waits for the stats' client any more, only the HGET of the room's data stays before it may store, and the value the field had when the collaboration started is read after the answer, unawaited, when the room held none; a write with the value and the value before of the socket's last write to the field is the same edit, so a change and a release of one value sent together count once and a value put back after another user's counts, kept as a short fingerprint only while the stats count the field; the values at the start are separated and written in a try in the callback of socket.io, as one list, their fields counted before any is converted, capped at 200 fields and 64 KB, and a start without them deletes those of an earlier one; a field name the stats cannot take (not a string, not well formed, over 200 characters) is left to the collaboration; the first update of a Hocuspocus connection that inserts no text, what the editor fixes in a body when it opens (its trailing paragraph, the link of a bare URL, anchors made unique), is no edit, an update over 16 KB not decoded; one edit of the body is enough to have edited (minEditOps 1)
```

admin-cms:

```
test: the body editor opened in a collaboration, with the extensions of the article, Collaboration and its caret, sends before a keystroke at most one update and no text, for the moderator and a joiner, also after a focus and another user's cursor, and one update for one typed character; what it fixes when it opens (the trailing paragraph, the link of a bare URL ending the first block, duplicate and empty anchors) goes in that one update
```
