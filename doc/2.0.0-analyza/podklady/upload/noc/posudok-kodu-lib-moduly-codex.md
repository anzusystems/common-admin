## Findings

1. **BUG** — [uploadSettle.ts:427](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettle.ts:427): A LIB duplicate notification starts a slow original-asset lookup; a later `failed` notification marks the row failed; the lookup then returns and rewrites it as uploaded. Snapshot the matching rows and their revisions before the lookup, then reject a result if a later event wrote to a row. Route the lookup through the read coordinator as well, so it cannot overlap a queue read.

2. **BUG** — [uploadSettlement.ts:543](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:543): A tick queued behind another read survives `dropQueue`. If the store replaces that queue and tracks a new row under the same key, the old tick reads the new row before its first scheduled mark. Invalidate queued work with a queue generation token and check it before dispatch.

3. **BUG** — [uploadSettlement.ts:593](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:593): `dispose()` stops timers but an in-flight read can still return, change a row, and call store hooks; a queued read can still issue its request. Check disposal before dispatch and after awaits, before any write.

4. **BUG** — [uploadSettle.ts:413](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettle.ts:413): A row whose finish request failed remains tracked under D5. If a tick sees a duplicate and the original lookup fails, this catch untracks that already-failed row. A later successful server result is never read, leaving the client failure permanently displayed. Keep that row tracked; stop tracking only a `Processing` row that this path actually fails.

5. **BUG** — [uploadSettlement.ts:391](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:391): Notification failures increment each row’s `readFailures`, but the warning waits for three failures of that *notification read*. Two failed ticks followed by one failed notification read therefore leave a row unwarned after its third consecutive failed read. Successful ticks between notification retries can cause the opposite error. Base the warning on each row’s consecutive counter; keep the notification retry counter solely for retry timing.

6. **BUG** — [uploadSettlement.ts:577](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:577): `untrack` and `dropQueue` leave named-read timers in `pending`. For example, remove the only row immediately after a metadata notification: its two-second timer and waiter remain until the timer fires. Prune targets and cancel a named read when no live row still needs it, resolving its waiters. Design §4.8 explicitly permits this retention, but it conflicts with the lifecycle rule in this review request.

7. **BUG** — [uploadSettlement.ts:355](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:355): The two-second automatic-read gap is enforced by the poller only. A tick can finish and a notification read for the same queue can start 250 ms later. Apply the gap to automatic reads in the coordinator, while preserving immediate manual refresh.

8. **TEST** — [uploadSettle.test.ts:645](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/settlement/__tests__/uploadSettle.test.ts:645): “Only completed by a processed file” supplies a file with no status and a `processed` hint, and both rows already start `Uploaded`. It cannot distinguish a processed file from an incorrect unconditional status write. Add a nonfinal read without a hint and a separate processed-file read, starting from a state where a wrong transition is visible.

I found no separate unintended **MISMATCH** against the existing stores; the other differences I saw are covered by the design, plan, or listed deviations.

## Author’s 16 deviations

1. **ACCEPT** — Keeps DAM’s existing duplicate metadata gate.
2. **ACCEPT** — Excludes rows a reader cannot use.
3. **REJECT** — Skipping the request is sound, but retaining its timer conflicts with the requested cancellation rule.
4. **ACCEPT** — Dropping a queue should forget its tracked rows.
5. **REJECT** — Untracking an already-failed finish-request row breaks D5.
6. **ACCEPT** — A successful manual read should reset the row’s read counters and warning.
7. **ACCEPT** — Fetching caches once per read preserves the intended result.
8. **ACCEPT** — One original lookup suffices for matching rows.
9. **ACCEPT** — Concurrent requests with ordered writes match the design.
10. **ACCEPT** — Rejecting malformed lists prevents false “missing asset” counts.
11. **ACCEPT** — Lazy subscriptions are reasonable while pollers remain active.
12. **ACCEPT** — Copying loaded metadata avoids shared mutable row values.
13. **ACCEPT** — Clearing settlement-owned text after duplicate lookup failure is consistent.
14. **ACCEPT** — `unknown` is a reasonable value for an absent failure reason.
15. **ACCEPT** — The no-document visibility fallback is appropriate.
16. **ACCEPT** — These exports do not alter settlement behavior.

I checked the schedule constants, status resolution, metadata merge, slot-list path, matching profiles, tests, both current stores, and the specified design and plan. Those paths were sound apart from the findings above. This was static review only: I made no changes and ran no tests, builds, or linters. Wiring behavior and real scheduler behavior remain unverified.
