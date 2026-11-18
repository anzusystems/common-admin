# Review of the LIB fixes (Codex, gpt-6-sol, high, read-only), 2026-10-08

**BUG — Post-disposal cleanup still invokes hooks.**
`src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:694`: Track a row, call `dispose()`, then have the store
remove that row. `untrack()` still deletes its tracking state and calls `onUntracked`; `dropQueue()` can do the same
for a tracked queue. That contradicts the fix's rule that the settlement makes no writes or hook calls after
disposal. Add a disposed guard to both methods, and cover both calls in the post-disposal test.

I found no further **BUG**, **MISMATCH**, or **TEST** finding. Static inspection supports the file-specific status
guard, stale-read metadata handling, poller idle and generation guards, failed-row Refresh condition, and additive
public option types. I compared the relevant tracked changes with `HEAD` and read the new settlement code, notes,
and affected tests. I did not run tests, builds, or linters, and could not verify runtime behaviour or downstream
application consumers.
