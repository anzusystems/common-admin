# Posudok Opus: collaboration 489a3ea (história štatistík a docId)

Zadanie `krok5-praca/zadania/posudok-stats-c-prompt.md`, agent `posudok-stats-c`, 24. 10. 2026. Text agenta, skrátený
o časť „Checked and correct" (výsledok: dotazy ohraničené, validácia, povolenia, single flight, cache, 503, súčty
a docId správne).

**Verdict:** Sound. One **Medium** (XS fix before the PR), no High.

## Medium
**M1.** A cursor with an ISO-looking but invalid date (`2026-13-01T00:00:00.000Z`, hour 25, `24:30`) passes `isoPattern`
(`collabStatsHistoryManager.ts:136`), then `new Date(s).toISOString()` throws at `:149`. The parse runs before the `try`
in `answerHistory` (`collabStatsRequest.ts:57` vs `:60`), the outer handler has only `finally` (`:126-130`) and
`onRequestHook.ts:101` discards the promise. No response at all (core-cms waits for its timeout), an unhandled
rejection to Sentry per request; the process survives and the permit is released. Fix XS: `Number.isNaN(Date.parse(s))`
→ null, a test; optionally a `catch` at `:126` answering 500 when nothing was sent.

## Low
- L1: the cursor's step 1 replaces the period's `startedAt` range with the cursor's exact start (`:500, :522, :526`); a
  cursor from before midnight or a crafted one returns sessions before `from`. XS.
- L2: single flight can break when the cache is full (a refreshed key keeps its Map position `:337`, evicted while
  pending `:324`, the old outcome overwrites the new pending entry `:328-334`): one duplicate query, rare.
- L3: a session removed by TTL is served from its stale cache entry instead of 404 (`CollabStatsSessionNotFoundError`
  falls back to `last.value`, `:327-334`). XS.
- L4: live and history share one log-damping window (`collabStatsRequest.ts:27-28, 43-53`).
- L5: the cache is capped by count, not bytes (`:41`); realistic sessions ~2 KB.
- L6: `people` is outside the 6-per-minute limit (`:585-588`) though it is the largest read (31 `collab_daily_users`
  up to ~150–250 KB at caps); inferred, not measured.
- L7: the contract's example cursor (`STATS-C.md:126`) decodes to `{k,s,i}` without `t`, the server answers 400.
