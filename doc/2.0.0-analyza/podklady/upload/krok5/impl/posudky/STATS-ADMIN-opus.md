# Posudok Opus: admin-cms e2a6ac7bf (editor docId) a 827934a24 (stránka štatistík)

Zadanie `krok5-praca/zadania/posudok-stats-admin-prompt.md`, agent `posudok-stats-admin`, 24. 10. 2026. Skrátené.

**Verdict:** no High, 2 Medium (small). e2a6ac7bf correct and tested. Guard, cursor, contract and numbers hold.

- Guard OK (`checkRequirements.ts:10-14`, warm and cold start, `superAdminOf: SYSTEM_CMS`, menu `v-if`).
- Polling OK except M1 (interval and visibility listener cleaned on unmount; hidden → pause; 429/503 alert, last data kept).
- Cursor and filters OK (`cancelPrevious`, aborted page not appended, load more guarded).
- Contract OK apart from M2; `collabStatsDocId` only from the moderator, never in the article, tested.

**M1** `collabStatsLive.ts:36-55`: `Promise.all` rejects on the first failure and `finally` clears `loading` while the
other requests are pending → retry, visibility or the next tick starts 3 more; up to 5 in flight from one viewer, over
the server's 4 per pod while it is overloaded. Fix: `Promise.allSettled`, `loading` until all settle (~8 lines + test).

**M2** `collabStatsSessions.ts:17-42`, `CollabStatsSessionList.vue:32-37`: no article (docId) filter in 827934a24 (the
uncommitted tree adds it, not reviewed).

**Low**
1. `CollabStatsPeriod.vue:65-68`: Refresh after a failed or empty summary loads people and sessions twice.
2. `[id].vue:12,22`: the route regex matches uppercase hex, core-cms accepts only lowercase → 400; lowercase the id.
3. Days and hours are Europe/Bratislava, start times browser-local; the hour chart does not name the zone.
4. A 404 on summary/people/sessions (an older collaboration) shows "session not found" (`collabStatsLoad.ts:32`).
5. `CollabStatsPeriod.vue:214`: `toFixed(1)` prints a dot in sk; large counts not grouped.
6. Client aborts do not stop server work (fast tab switching adds concurrency).
7. The access test checks page source text (`collabStatsAccess.test.ts:60-72`), not route meta.
