# Noc 24./25. 10. 2026: rozhodnutia bez vlastníka a čo čaká na neho

Pokyn vlastníka: „Makaj. Ráno to chcem mať done." Ráno si pozrie rozhodnutia, ktoré som spravil bez neho, a spraví tie,
na ktoré som si netrúfol.

## A. Rozhodol som (bez vlastníka)

| # | rozhodnutie | prečo | kde |
|---|---|---|---|
| A1 | Konflikty pri zlúčení `next` do `feature/collab-stats` (39f546c): komentáre podľa `next`, kód štatistík (`Promise.all` s `readFieldBefore`, Occupied s `recordMembership`) podľa vetvy štatistík | `next` mal už upratané komentáre; kód štatistík musí ostať | collaboration |
| A2 | admin-cms rozdelené na 2 commity: `collabStatsDocId` v editore (e2a6ac7bf) a stránka (827934a24) | editor článku je iná oblasť ako dashboard, ľahšia revízia | admin-cms |
| A3 | Opravy collaboration po posudkoch: zlý dátum kurzora → 400 a `catch` s 500 (Opus M1 = Codex 1), tlmené logy so súčtom namiesto `info` za každú chybu (Codex 3), kurzor drží rozsah obdobia (L1), 404 bez starej cache (L3), oddelené tlmenie živých a histórie (L4), `people` pod limitom 6/min (L6), príklad kurzora v kontrakte (L7). L2 (zriedkavý dvojitý dotaz pri plnej cache) a L5 (cache podľa počtu, nie bajtov) len ako známe | malé opravy, bez zmeny správania pre platné požiadavky | collaboration |
| A4 | Brány C (10× dát, plány, p95, súbežnosť) spustené na 39f546c súbežne s opravami | opravy nemenia dotazy; šetrí čas | `zadanie-stats-c-perf.md` |

| A5 | core-cms po posudkoch: mapa `articles` dvoma jednoduchými dotazmi (id → docId cez primárny kľúč, potom najnovšie verzie podľa `docId` cez `UNIQ_docId_version`) namiesto `OR` s poddotazom, ktorý by v MySQL skenoval 3,8M článkov (Opus H1); telo collaboration nezmenené a kľúč `docId ?? entityId` podľa zadania (agent ho bez pokynu zmenil na len docId s dopisovaním docId, čo rozbíjalo filter článku); tlmenie chýb klienta rate limiterom, `warning` raz za 15 min (Opus M1 = Codex 2); regex s `D`, timeout histórie 8 s, test timeoutu | dva dotazy s istým plánom sú jednoduchšie ako jeden závislý od optimalizátora | core-cms |

| A6 | collaboration opravy z A3 commitnuté 3842da9 a pushnuté | – | collaboration |
| A7 | admin-cms po posudku: živý polling cez `allSettled` (nikdy viac ako 3 požiadavky od diváka, Opus M1), filter článku (M2), Obnoviť bez dvojitého načítania (L1), id relácie malými písmenami (L2), časová zóna pri dňoch a hodinách (L3), všeobecná chyba pri 404 súhrnu (L4), čísla podľa jazyka (L5), test prístupu cez meta route (L7); L6 (zrušená požiadavka nezastaví prácu servera) len ako známe | malé opravy, M1 chráni server pri preťažení | admin-cms |

| A8 | Brány C: všetkých 41 dotazov ide po indexe, p95 1,4–5,3 ms, len `people` na strope (1 000 ľudí a 2 000 dvojíc denne) má p95 37 ms za 7 dní a 140 ms za 30 dní a raz za 60 s zablokuje slučku na 210–280 ms → cache `people` predĺžená na 5 min (rebríček nemusí byť čerstvejší) | menej výpočtov bez zmeny dát | collaboration |

| A9 | admin-cms opravy z A7 commitnuté ef822a603 a pushnuté (celá sada 2 146 OK) | – | admin-cms |
| A10 | Komentáre: collaboration štatistiky (`komentare`) a admin-cms (`komentare-admin`) súbežne; core-cms po jeho oprave | čas | všetky |

| A11 | core-cms commit 9c08dbb00 (celá sada 5 008 OK, 79 testov štatistík; EXPLAIN na dev DB: `range PRIMARY` a `range UNIQ_docId_version`), nová vetva pushnutá; test limitera používa `InMemoryStorage`, produkcia Redis | – | core-cms |
| A12 | Overenie opráv Codexom (`posudky/stats-opravy-codex.md`) súbežne s fázou B brán C (end-to-end cez core-cms) | posudky na opravy, ako pri B2 | všetky |

| A13 | Overenie opráv (Codex `stats-opravy-codex.md`): všetko vyriešené, bez nových High/Medium; zvyšok logov: collaboration `debug` za každú potlačenú chybu (pri dnešnom `LOG_LEVEL=debug` riadok za každý polling) → odstránim, počet ide do ďalšieho `warn`; core-cms `info` za každú chybu nechávam, v produkcii ho nič nezapíše (jediný handler je Sentry od `warning`, `config/packages/prod/monolog.php`) | menej šumu, žiadna strata informácie | collaboration |

| A14 | Brány C fáza B (end-to-end cez core-cms 9c08dbb00 a collaboration 4751304): super admin 200 na 6 endpointoch, admin 403, bez prihlásenia 401; mapy článkov (docId aj entityId) a mien OK; 503/429 sa prenesú; 20 dashboardov: MySQL a Mongo v šume. Mapa `users` doplní aj filtrovaného človeka (`userId` z dotazu), inak by filter v admin-cms nemal meno | XS oprava | core-cms |

| A15 | collaboration: komentáre da12785 (495 v diffe: 56 zmazaných, 151 skrátených, 288 ponechaných; kód bez komentárov zhodný), tlmené chyby bez `debug` riadku bc5cdf1; `debug` breakera finalizéra (~1/min) a reconnectu Redis štatistík pri výpadku nechávam | nie je to riadok za polling | collaboration |
| A16 | **PR collaboration #17487** `feature/collab-stats` → `next` otvorený (https://dev.azure.com/petitpress/Anzu/_git/collaboration/pullrequest/17487) | – | collaboration |

| A17 | admin-cms: komentáre c2c1cddc7 (71 blokov: 17 zmazaných, 34 skrátených; kód bez komentárov zhodný, celá sada 2 146 OK); **PR admin-cms #17488** `feature/collab-stats` → `next` (https://dev.azure.com/petitpress/Anzu/_git/admin-cms/pullrequest/17488) | – | admin-cms |

| A18 | core-cms: meno filtrovaného človeka v mape `users` 2462667de, komentáre 06f1e4f6b (39: 6 zmazaných, 10 skrátených; `php -w` zhodné; celá sada 5 009 OK); **PR core-cms #17489** `feature/collab-stats` → `develop` (merge s novým `develop` čistý) | – | core-cms |
| A19 | Popisy PR v angličtine (ako commity), navzájom prepojené (!17487, !17488, !17489) | – | všetky |

## Po rozhodnutiach vlastníka (25. 10. doobeda)

- B1/B4 → požiadavky v changelogu bez mien prostredí (`next` 010868b; `collab-stats.md` v 3e79449); B2 → vetva heap-lock a
  worktree zmazané; B3 → TICKET ostáva; B5 → `feature/collab-next-comments` 9a2ed0f (čaká na pokyn na zlúčenie do `next`);
  B6 → história len 7 dní, TTL 8 dní (collaboration 3e79449, core-cms b6d4d66ef, admin-cms 00c96d008), 7/8 ponechané.
- Posudok vzorov core-cms (Codex, Opus) → 7 bodov schválených → core-cms f3d6f7361 (DTO + validator 422, `FLOW_PRIORITY`,
  bez `users`, `CmsLogger`, 502, drobnosti; odpoveď bez DTO ako výnimka), admin-cms f34ca2185 (mená cez `CachedUserChip`,
  422/502); overenie Codex: vyriešené, `limit` mimo rozsahu ostáva `error_field_invalid` ako inde v projekte (kontrakt
  opravený, test f08dd5973).
- Prieskum Bunu (`BUN-PRIESKUM.md`): neprechádzať.
- **Vlastník (25. 10.):** rozhodnutia A (1–21) **ok**; komentáre do `next` hneď → fast-forward `next` 010868b..9a2ed0f (PR
  #17487 sa zlúči bez konfliktu); Bun **skip**; Azure (pamäť devel/stage, `COLLAB_STATS_ENABLED` na devel, `LOG_LEVEL`),
  test na devel a vydanie zatiaľ nie. Kódovanie štatistík uzavreté.
- **Vlastník (25. 10. poobede):** core-cms má byť len proxy; admin-cms názvy článkov v zoznamoch zo štandardného
  vyhľadávania s filtrom `docIds` (verzia je jedno), v detaile fetch podľa docId (#86833), odkazy `/articles/{docId}`.
  core-cms ca35486ee (509 riadkov kódu štatistík, −1 105), admin-cms 333708c84. Posudky Codex + Opus na oboch → opravy
  podľa odporúčaní („vieš čo máš robiť"): core-cms `max_redirects` 0, `max_duration` 8, normalizácia query povolená,
  `Retry-After: 0`, OpenAPI stavy, `ExtSystemLinkGuard` ako známe; admin-cms prebiehajúce vyhľadávania názvov, prázdny
  detail pri 429/502/503, trvalé toasty, `VDataTable`. Opus A: miestnosti s jedným človekom bez názvu (`#id` s odkazom)
  **prijaté** podľa odporúčania.
- Opravy commitnuté: core-cms 76f897cbd (aj Opus M1 bez `info` medzi varovaniami, hlavičky preč, výnimka do
  `src/Exception/HttpClient`, L1–L4), admin-cms 9825e086b. Overenie Codex (`proxy-overenie-codex.md`): všetko vyriešené,
  bez nových High/Medium; ostávajú vedome: normalizácia query (Symfony; povolená v kontrakte, Opus: nie je chyba),
  `ExtSystemLinkGuard` info pri vypnutom čítaní (poistka projektu), zlyhané vyhľadanie názvu článku bez hlásenia (len
  číslo s odkazom; názov je doplnok). Popisy PR #17489 a #17488 aktualizované.

## PR (25. 10. ráno)

| repo | PR | vetva → cieľ | HEAD |
|---|---|---|---|
| collaboration | [#17487](https://dev.azure.com/petitpress/Anzu/_git/collaboration/pullrequest/17487) | `feature/collab-stats` → `next` | bc5cdf1 |
| admin-cms | [#17488](https://dev.azure.com/petitpress/Anzu/_git/admin-cms/pullrequest/17488) | `feature/collab-stats` → `next` | c2c1cddc7 |
| core-cms | [#17489](https://dev.azure.com/petitpress/Anzu/_git/core-cms/pullrequest/17489) | `feature/collab-stats` → `develop` | 06f1e4f6b |

Výkonnostné zmeny kolaborácie (heap 300, zámok, 6 optimalizácií) sú priamo v `next` (0fac4db), podľa pokynu vlastníka.

## B. Čaká na vlastníka (netrúfol som si)

| # | čo | oprava a veľkosť | odporúčanie |
|---|---|---|---|
| B1 | Skupiny premenných v Azure DevOps: devel a stage majú 300Mi/200Mi, pri heape 300 tesné; na devel chýba `COLLAB_STATS_ENABLED=true` | konfigurácia, minúty | devel a stage 600Mi/400Mi ako produkcia, na devel `true` |
| B2 | Vetva `feature/collab-heap-lock-retry` (origin aj lokálna) a pracovná kópia `krok5-praca/collab-next-wt` sú po zlúčení do `next` zbytočné | zmazanie | zmazať |
| B3 | `#TICKET` v changelogoch (collaboration `collab-stats.md`, `heap-room-lock-retry.md`, core-cms a admin-cms `collab-stats.md`) | doplniť čísla úloh | doplniť pred zlúčením PR |
| B4 | Produkcia `LOG_LEVEL=debug` | Azure, minúty | `info` |
| B5 | Dlhé komentáre v `next` mimo týchto PR (z predošlých opráv kolaborácie) | samostatné upratanie, S–M | samostatne po vydaní |
| B6 | `people` za 30 dní: p95 13,6 ms pri 100 ľuďoch denne, 34,6 ms pri 300, 133 ms na strope 1 000 (limit návrhu 20 ms); blokovanie slučky pri prvom výpočte 40–58 / 83–118 / 268–286 ms, s cache 5 min najviac raz za 5 min na pod. Možnosti: prijať; znížiť stropy `byUser`/`byPair` (napr. 300/600); rebríček vo finalizéri | stropy XS, finalizér M | **prijať** (realisticky ≤ 300 ľudí denne, ~100 ms raz za 5 min len pri otvorenom 30-dňovom tabe); ak by v produkcii bolo viac, znížiť stropy |
