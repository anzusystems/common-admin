**Repair: no findings.** The watcher is registered before upload, follows the store’s row, and uses `flush: 'sync'`. It records a different service text before the store overwrites it. Under the planned K3/K6 path, the service and store write the same `unknownError` text, so the assertion should still pass. The change adds no new timing or mocks to other cases.

**Outside the change: no findings.** This was a read-only review; I did not run tests.
