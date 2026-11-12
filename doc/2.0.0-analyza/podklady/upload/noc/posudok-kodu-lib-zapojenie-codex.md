# Review of the LIB store wiring (Codex, gpt-6-sol, high, read-only), 2026-10-08

1. **BUG** — `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:66`: The store never calls
   `settlement.dispose()`. If Pinia disposes a store while a row is processing, its polling timer, visibility
   listener, and detached connection watcher remain active. A replacement store can then poll alongside the old
   one, which still holds the row and its file. Register `settlement.dispose()` with the store's scope disposal.

2. **MISMATCH** — `src/domains/dam/uploadQueue/composables/uploadQueueItemRefresh.ts:13`: Refresh now ignores
   `configName`. Previously, a component configured with a non-default DAM client sent its asset read there; it
   now reads through the store's default client. If the asset exists only under the named configuration, Refresh
   sends the wrong GET and leaves the row unchanged. Preserve the selected client and endpoint while applying the
   result through settlement.

I checked the `HEAD` comparison, the specified decisions, the three consumers, and the current store and
settlement paths. The no-service UGC profile, `OPEN`-only connection state, 404 handling, tracking after finish,
queue removal, and 50-item bulk read look sound. I did not run tests or verify requests against a live backend;
the non-default configuration scenario was established from the API paths, not a known consumer deployment.
