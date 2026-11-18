# Review of the admin-dam store wiring (Codex, gpt-6-sol, high, read-only), 2026-10-08

1. **BUG** — `src/domains/coreDam/asset/store/uploadQueuesStore.ts:605`: A file-failed notification can settle and
   untrack a row while its finish request is still in flight. If that request then rejects, the catch replaces the
   server failure with a generic error and tracks the already-failed row again at line 622. If asset reads keep
   failing, polling and its timer continue for a terminal row. **Fix:** when the catch sees a row already marked
   `Failed` by settlement, preserve that result and return without tracking it.

2. **BUG** — `src/domains/coreDam/asset/store/uploadQueuesStore.ts:678`: Refresh passes the clicked row's `fileId`,
   but the library reports its outcome from the asset's *main* file. If the main file is processed and the clicked
   row holds another, still-processing file, Refresh returns `settled` while that row remains `Processing`;
   `AssetQueueEditable.vue:36` shows no pending warning. **Fix:** derive the outcome from the requested file; when
   the asset read cannot establish that file's state, return an indeterminate/error outcome rather than `settled`.

I checked the step 2 decisions, author notes, `HEAD` behavior, changed wiring, notification listener, and library
settlement source. Tracking after IDs arrive, queue teardown, 404 handling, slot list reads, bulk response
validation, optional notification config, and the mass-edit policy appeared sound. I did not run tests, builds, or
linters; browser behavior and responses from a live backend remain unverified.
