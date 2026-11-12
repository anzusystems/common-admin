# STATS-CMS: štatistiky kolaborácie v core-cms (proxy pre živý prehľad a 7 dní)

Zadanie `krok5-praca/zadania/zadanie-stats-cms.md`, návrh `COLLAB-STATS.md` §9.3, §10.9.1, §10.9.2. Repozitár
`/home/volar/projects/petit/core-cms`, vetva `feature/collab-stats` (z `origin/develop` 43fc959f2), necommitnuté.
Kontrakt collaboration: `STATS-C.md` §1 a jeho kód (`collabStatsHistoryManager.ts`, `collabStatsRequest.ts`), STATS-A §2–§3.
Skripty a logy v `krok5-praca/stats-cms/`. **Overené** = test, kontrola alebo beh; **odvodené** = môj záver.
Opravy po posudkoch (`posudky/STATS-CMS-opus.md`, `posudky/stats-krizom-codex.md` bod 2) sú v §9.

## 1. Kontrakt pre admin-cms

*Prepísané 25. 10. podľa vlastníka: **core-cms je len proxy** na API štatistík collaboration (má prednosť pred DTO z
posudku vzorov). Bez validácie, DTO a máp; zlý vstup odmieta collaboration (400).*

Všetko `GET` cez `cmsClient`, prefix `/adm/v1/collab-stats`. Prístup **len `ROLE_SUPER_ADMIN`** (iný prihlásený 403,
neprihlásený 401).

| Endpoint core-cms | collaboration (`GET`, token `SYS_API_TOKEN`) |
|---|---|
| `/live` | `/api/sys/v1/collab-stats/live` |
| `/live/rooms` | `…/live/rooms` |
| `/summary` | `…/summary` |
| `/people` | `…/people` |
| `/sessions` | `…/sessions` |
| `/sessions/{id}` (`id` = 24 hex znakov, inak route 404) | `…/sessions/{id}` |

- **Query string ide do collaboration nezmenený** (surový, v tom istom poradí; HTTP klient Symfony môže normalizovať
  kódovanie, napr. `%7E` → `~`, collaboration vstup overí sama). Parametre, predvolené hodnoty a
  validácia sú podľa collaboration: STATS-C §1 (`days=7`, `sort`, `peakUsers`, `category`, `limit`, `cursor`, `userId`,
  `docId`) a STATS-A §2 (`bucket`, `limit`).
- **Odpoveď: stav a telo collaboration nezmenené** pri 200, 400, 404, 429 (aj s hlavičkou `Retry-After`) a 503
  (`{ "error": "disabled" }` pri vypnutej histórii, inak `{ "detail": … }`). Typ obsahu tiež od collaboration.
- **502** `{ "error": "unavailable", "detail": "…", "contextId": "…" }` len keď collaboration nejde prečítať:
  nedostupná, timeout (8 s nečinnosti aj celej požiadavky), iný stav (presmerovanie, 401 zlý token, 5xx okrem 503),
  alebo čítanie collaboration vypnuté v core-cms.
  Zlyhanie sa zapíše do žurnálu ako `warning` najviac raz za 15 min pre všetky pody, medzitým nič.
- core-cms k telu nič nepridáva; články si admin-cms načíta cez `docId` (`fetchArticleListByDocIds`,
  `GET /adm/v1/article-kind/{docId}`), ľudí cez `useCachedUsers`.

## 2. Čo sa zmenilo (core-cms)

Stav po rozhodnutí „len proxy“ (§13). Kód štatistík nad `develop` (src, tests, config): **509 riadkov**.

| Súbor | Obsah |
|---|---|
| `src/Domain/CollabStats/Controller/Api/Adm/V1/CollabStatsController.php` | 6 pevných ciest, každá `denyAccessUnlessGranted(User::ROLE_SUPER_ADMIN)`, surový `QUERY_STRING` do klienta; `{id}` s `Requirement::MONGODB_ID`; OpenAPI s popismi 200, 400, 401, 403, 404, 429, 502, 503 |
| `src/HttpClient/AnzuCollaborationClient.php` | `getStats(endpoint, queryString)`: existujúci klient `anzu_collaboration`, `timeout` a `max_duration` 8 s, `max_redirects: 0`; 200/400/404/429/503 ako `Response` so stavom, telom, `Content-Type` a `Retry-After` collaboration; inak alebo bez odpovede `CollaborationClientException` a tlmený `warning` |
| `src/Exception/HttpClient/CollaborationClientException.php`, `src/Exception/Handler/CollaborationClientExceptionHandler.php` | 502 `{ error: "unavailable", detail, contextId }`, umiestnenie a tvar ako `MailerClientException(Handler)` |
| `src/Logger/CmsLogger.php` | `NAMESPACE_COLLABORATION` |
| `config/packages/rate_limiter.php`, `config/services/rate_limiter.php` | limiter `collab_stats_failure` (1 za 15 min) so `storage_service`, ako dva existujúce |
| `config/packages/anzu_systems_common.php` | `CollabStatsException` v `logs.app.ignored_exceptions` (log rieši klient, tlmene) |
| `config/services_test.php`, `tests/data/HttpClient/CollaborationMockClientCallback.php`, `tests/data/UrlFactory/Api/Adm/CollabStatsUrl.php` | `MockHttpClient` (zaznamená URL), `InMemoryStorage` limitera, URL po endpointoch |
| `tests/Domain/CollabStats/Controller/Adm/V1/CollabStatsControllerTest.php` | testy (§4) |
| `request/adm/collabStats.http`, `doc/Core-Cms-Changelog/Unreleased/collab-stats.md` | vzorové volania, changelog |

Zrušené počas práce: validácia (`CollabStatsQueryFactory`, potom 4 DTO s `Assert\Callback`), fasáda, mapy `users` a
`articles` s metódami repozitárov, `OAResponseCollabStats`. Nový token, premenná ani úloha pre DevOps nie sú.

## 3. Ako to funguje

1. Rola v každej akcii, potom `GET <ANZU_COLLABORATION_HOST>/api/sys/v1/collab-stats/<endpoint>?<surový query string>`
   (`Request::getQueryString()` by parametre zoradil, preto `$request->server->get('QUERY_STRING')`).
2. Odpoveď 200, 400, 404, 429 a 503 ide ďalej ako `Response` s tým istým stavom, telom, `Content-Type` a `Retry-After`.
3. Bez odpovede (nedostupná, timeout 8 s), s iným stavom (401 zlý token, 5xx okrem 503) alebo pri vypnutom čítaní
   collaboration v core-cms → 502 `unavailable`. Okrem vypnutého čítania zápis do žurnálu cez `CmsLogger`
   (`[Collaboration] Reading the stats failed.`) ako `warning` najviac raz za 15 min pre všetky pody, medzitým nič
   (žurnál ukladá aj `info`; jeden dashboard by pri výpadku zapísal ~1 080 riadkov za hodinu).

## 4. Testy

`CollabStatsControllerTest`, **12 testov** (s dátovými sadami), collaboration zamockovaná `MockHttpClient`:

- **403** pre `ROLE_ADMIN` na všetkých 6 cestách, collaboration nevolaná.
- **Query a odpoveď bez zmeny** (5): query string v tom istom poradí aj s `,` a neznámym `entity`; 200 (`{}`, `[]`,
  `null`), 400, 404, 429 s `Retry-After: 3` a 503 `disabled` so stavom, telom a `Content-Type` collaboration.
- **502 a log**: nedostupná collaboration → 502 `unavailable` a `WARNING` v žurnále; hneď potom 401 → 502 a `INFO`.
- **Testy chytia chybu** (`mutacie.sh`, 6 mutácií, zdroj obnovený a porovnaný `cmp`): bez roly, zoradený query string,
  429 mimo prenášaných stavov, bez `Retry-After`, bez tlmenia, 503 namiesto 502 → každá padne.

## 5. Kontroly a ako spustiť

Všetko v kontajneri `core-cms-core-cms-1` cez `flock` na `krok5-praca/tazky.lock` (skripty v `krok5-praca/stats-cms/`).

- Testy štatistík `bin/test tests/Domain/CollabStats` → **OK (12 testov, 52 asercií)** (`round10-test-one.log`).
- Celá sada `bin/test` → **OK (4 941 testov, 18 542 asercií)**, 1:30 (`round10-test-all.log`).
- PHPStan (`phpstan.neon`, 4 procesy) → 0; ECS na zmenených súboroch a `config/services` → 0 (`round10-*.log`).
- Psalm nie je nainštalovaný ani v CI. Rector padá pri štarte (nekompatibilita s PHPStanom), v CI nie je.
- Kontajnery som na konci zastavil.

## 6. Odchýlky, rozhodnutia a známe

1. **Len proxy** (vlastník, má prednosť pred DTO z posudku vzorov): core-cms nevaliduje, vstup overuje collaboration
   (STATS-C §1, STATS-A §2) a jej 400 ide ďalej; telo sa nedekóduje ani nemení.
2. **Jeden timeout 8 s** pre živé aj históriu (predtým 5 a 8 s): jednoduchšie, polling je každých 10 s.
3. **503 ide ďalej vždy**, aj bez JSON od ingressu (vlastník: stav a telo collaboration nezmenené); 502 len pri inom
   stave alebo bez odpovede.
4. **`Content-Type`** sa preberá od collaboration (vždy `application/json`).
5. **Test mock** `$anzuCollaboration` je globálny: `room-data` a validácia schémy v testoch dostanú prázdne 200.
6. **Známe (posudok Low 4, Codex 5)**: pri vypnutom čítaní collaboration (`EXT_SYSTEM_COLLABORATION_READ_DISABLED`)
   zapíše `ExtSystemLinkGuard` pri každom pollingu jeden `info` do žurnálu, mimo limitera. Ponechané: je to existujúca
   poistka projektu na vypnutie externého systému.

## 7. Neoverené

- Volanie proti skutočnej collaboration a ingressu; overené len s `MockHttpClient`.

## 8. Návrh správy commitu

```
refactor: the collaboration stats are only a proxy to collaboration: the query, the status and the body go through unchanged, 502 when it cannot be read
```

## 9. Opravy po posudkoch (Opus, Codex 2)

- **H1**: mapa `articles` dvoma jednoduchými dotazmi (`id IN` cez primárny kľúč, len pre položky bez `docId`;
  `doc_id IN` cez `UNIQ_docId_version`) namiesto `OR` s poddotazom; EXPLAIN §5.1.
- **Kontrakt**: telo nezmenené, kľúč `docId ?? entityId`, hodnota aktuálna verzia dokumentu (§1.1, §6/2).
- **M1 = Codex 2**: zlyhania klienta tlmené limiterom `collab_stats_failure` na Redise, `warning` raz za 15 min, inak
  `info`; 502, 504 a 503 bez JSON sú nedostupnosť s logom; test s `TestHandler`.
- **Low 1**: regexy s `D`, testy s `\n`. **Low 2**: história 8 s, živé 5 s. **Low 6**: test timeoutu a `max_duration`.
- **Low 4, Low 5**: len zapísané (§6/8–9).
- Tretie kolo malo 1 zlyhanie: v teste je pool limitera `array`, ktorý sa medzi požiadavkami maže, takže limiter vždy
  pustil `warning`. Oprava: test limiter má `InMemoryStorage` (`config/packages/test/rate_limiter.php`); produkcia
  ostáva na Redise.

## 10. Doplnenie z end-to-end testu

`sessions?userId=…`: mapa `users` obsahuje aj filtrovaného človeka (`CollabStatsFacade::getSessions`), inak by
admin-cms pri filtri nemal meno. Test `testSessionsOfAUserGetTheirName`; mutácia bez neho padne. Testy štatistík OK (80),
PHPStan 0, ECS 0 (`round5-*.log`), kontajnery zastavené.

```
fix: the sessions of a user get the name of that user in the users map
```

## 11. Refaktor na vzory projektu (vlastník, posudky `CMS-VZORY-opus.md`, `cms-vzory-codex.md`)

- Vstup cez `#[SerializeParam]` DTO s `Assert\*`, `ArrayStringHandler` a jedným `Assert\Callback`, `toQueryParams()`;
  fasáda `Validator::validate()` → 422 s `fields`; kurzor ďalej bez kontroly; `{id}` cez `Requirement::MONGODB_ID`;
  `Uuid::isValid()`. `CollabStatsQueryFactory` zrušená.
- Revízia článku podľa `ArticleStatus::FLOW_PRIORITY` a `version`; test pripína ready verziu 1 pred draftom verzie 2.
- Mapa `users` zrušená aj s `UserRepository::findFullNamesByIds()` a prechodom kľúčov ľudí (aj doplnenie z §10).
- Logy zlyhaní cez `CmsLogger` (žurnál); limiter so `storage_service` ako dva existujúce.
- Nedostupná collaboration 502 (vzor `MailerClientExceptionHandler`); 404 cez `NotFoundExceptionHandler` (telo rovnaké).
- `timeout` konštanty namiesto `max_duration`, hlavičky `X-Context-ID` a `X-App-Version`, `CollabStatsUrl` s metódou na
  endpoint.
- Odpoveď bez DTO ako vedomá výnimka (§6/1).

## 12. Zjednodušenie (vlastník: „naozaj jednoduché, čo najviac prepoužiť“)

- Mapa `articles` zrušená aj s `findDocIdsByIds`, `findHeadlinesByDocIds` a prechodom odpovede; repozitáre článkov a
  používateľov sú zhodné s `develop`.
- Klient vracia telo 200 ako reťazec, kontrolér `JsonResponse::fromJsonString()`; fasáda len validuje a volá klienta.
- `OAResponseCollabStats` zrušený, odpoveď 200 opisuje `OAResponse(description: …)` z common-bundle.
- Parameter `entity` a `CollabStatsEntityDto` zrušené (`live` a detail bez DTO).
- Testy a fixtures len pre mapu zrušené; pribudol test nezmeneného tela.

## 13. Len proxy (vlastník: „core-cms minimálny, viac-menej len proxy“)

- Zmazané: 4 DTO s `Assert\Callback`, fasáda, validačné testy, `CollabStatsEntityDto`, mapa `articles`; výnimka
  bez polí (len 502), handler s pevným stavom.
- Klient vracia `Response` collaboration (stav, telo, `Content-Type`, `Retry-After`), kontrolér len rola a surový query
  string.
- Kód štatistík nad `develop`: 1 614 (HEAD `f08dd5973`) → 509 riadkov, −1 105.

## 14. Opravy proxy po posudku Codexu (`posudky/cms-proxy-codex.md`)

- `max_redirects: 0`: presmerovanie od collaboration je neočakávaný stav → 502 (test 302).
- `max_duration: 8` popri `timeout: 8`: limit celej požiadavky, nie len nečinnosti.
- Query string: normalizácia kódovania klientom Symfony je dovolená (§1); test porovnáva parametre a ich poradie, nie
  bajty.
- `Retry-After: 0` prejde (filtruje sa len `null`); test.
- Vypnuté čítanie collaboration ponechané ako známe (§6/6).
- OpenAPI: popisy odovzdávaných 400, 404, 429 a 503 (`OAResponseError`), bez DTO.
- Kontroly: testy štatistík OK (13), celá sada OK (4 942), PHPStan 0, ECS 0 (`round11-*.log`); mutácia `Retry-After: 0`
  (filter bez `null`) padne. Presmerovanie mock klient Symfony nenasleduje, takže test 302 overuje len mapovanie na 502,
  nie `max_redirects`. Kontajnery zastavené.

## 15. Doplnenie z posudku Opusu (`posudok-cms-proxy`)

- M1: medzi varovaniami sa nezapisuje nič (ani `info`), ako v collaboration; test čaká `[]` po prvom `WARNING`.
- L1: komentár pri `ignored_exceptions` hovorí len „collaboration nejde prečítať“.
- L2: changelog: novú verziu collaboration potrebuje všetkých šesť endpointov, aj `live` a `live/rooms`.
- L3: kontrolér neodkazuje na dokumenty mimo core-cms.
- L4: test roly overí pre super admina aj cestu v collaboration pre každú routu.
- Hlavičky `X-Context-ID` a `X-App-Version` zrušené (collaboration ich nečíta).
- L5: výnimka a handler presunuté do `src/Exception/HttpClient/CollaborationClientException.php` a
  `src/Exception/Handler/CollaborationClientExceptionHandler.php` (vzor `MailerClientException`).
- `ExtSystemLinkGuard` pri vypnutom čítaní ponechaný (§6/6).
- Kontroly: testy štatistík OK (13), celá sada OK (4 942), PHPStan 0, ECS 0 (`round12-*.log`); mutácie `Retry-After: 0`,
  tlmenie a zámena cesty endpointu padnú. Kontajnery zastavené.
