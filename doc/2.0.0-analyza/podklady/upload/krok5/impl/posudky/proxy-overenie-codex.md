**Verdict: changes still needed in core-cms.** The targeted admin-cms fixes are present. I found no new High or Medium regression in either commit.

**core-cms — prior findings**

1. Redirects: **resolved**; `max_redirects: 0` makes a 302 an unexpected response and yields 502.
2. Eight-second total limit: **resolved** with `max_duration`.
3. Query unchanged: **not resolved**. [AnzuCollaborationClient.php](/home/volar/projects/petit/core-cms/src/HttpClient/AnzuCollaborationClient.php:125) still appends the raw query to a URL that Symfony parses, so encoding such as `%7E` can change and a literal `#` becomes a fragment. The revised test compares parsed parameters, not the original query bytes.
4. `Retry-After: 0`: **resolved**; the filter now removes only `null`.
6. Forwarded error responses and focused coverage: **resolved** for the documented statuses and per-route upstream paths.

**core-cms — Opus items:** M1 journal `info`, L1 stale comment, L2 six-endpoint release requirement, L3 absent-document references, L4 per-route path test and extra headers, and L5 exception locations are **resolved**. The known `ExtSystemLinkGuard` `info` on every disabled read remains **not resolved**, as explicitly retained.

**admin-cms:** M1 overlapping title searches, M2 empty detail after 429/502/503, Opus B persistent failure toasts, and Opus C repeated failing title searches are **resolved**. The optional bucket table now uses `VDataTable`.

The earlier concern about article lookup failures remains: [list lookup](/home/volar/projects/petit/admin-cms/src/domains/cms/collabStats/composables/collabStatsLoad.ts:75) and [detail lookup](/home/volar/projects/petit/admin-cms/src/pages/(cms)/collab-stats/sessions/[id].vue:49) still swallow errors and show only a numeric link. Whether that meets “shows failures as the admin does” needs an owner decision.

Read-only inspection only; no tests or builds were run.