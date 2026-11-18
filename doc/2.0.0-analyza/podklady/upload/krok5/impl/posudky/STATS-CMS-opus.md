# Posudok Opus: core-cms proxy štatistík (necommitnutý strom, 24. 10. 2026)

Zadanie `krok5-praca/zadania/posudok-stats-cms-prompt.md`, agent `posudok-stats-cms`. Skrátené, podstata doslova.
Súbory sa počas posudku zmenili (mapa `articles` len podľa docId, core-cms dopĺňa docId do položiek); posudok je na
strome po zmene.

**Verdict: not mergeable as it stands.** Role, validation, error mapping and the map logic are correct.

- Q1 role: all 6 actions `denyAccessUnlessGranted(ROLE_SUPER_ADMIN)` before validation and any call
  (`CollabStatsController.php:51,67,82,97,119,134`); `/api/adm` JWT firewall; no voter or hierarchy grants it; tests
  prove 403 for ROLE_ADMIN without calling collaboration.
- Q2 validation same as collaboration (line by line); deviations in §6 acceptable.
- Q3 mapping correct, `max_duration` 5 s, no retries.

**H1 (High).** `ArticleKindStandardRepository.php:206-224`: `docId IN (:docIds) OR docId IN (SELECT docId … WHERE id IN
(:ids))` – under OR MySQL 8.0 cannot semijoin the subquery and has no range for that branch → full scan of
`article_kind` (3.8M rows; a similar join took > 30 s, `doc/Core-Cms-Changelog/1.112.0.md:29`), on the primary
connection without `max_execution_time`, every 10 s per viewer whenever a response mixes items with and without docId
(normal: solo rooms in `live/rooms`, sessions from before admin-cms sends docId, failed starts). Fix S: a single
top-level IN with the OR inside the subquery, or a UNION; EXPLAIN on a production-sized copy.

**M1 (Medium) = Codex 2.** `AnzuCollaborationClient.php:119-121,144,162-169`: one Sentry `warning` per failed request
(~720/h per open tab while collaboration is down, a stale token, 502/504); a 503 from the ingress is logged nowhere.
Fix S: Symfony rate limiter on Redis (exists: `config/packages/rate_limiter.php`), `warning` once per 15 min, else `info`.

**Low**
1. `$` without `D` accepts a trailing newline (`CollabStatsQueryFactory.php:30-32, 264`); still 400 from collaboration.
2. 5 s timeout vs a cursor page of up to three 2 s queries plus index setup after a pod start.
3. The filled-in docId changes collaboration's body; a `?docId=` link from such a session will not list it
   (collaboration filters on the stored docId).
4. With collaboration reads switched off, each poll writes one journal info (`ExtSystemLinkGuard.php:36`).
5. core-cms decodes the whole cursor although STATS-C calls it opaque; a cursor format change breaks page 2+.
6. Tests: no log assertions, no read-off case, no timeout case; the query-count test cannot see the plan.
