J-01 now fails if a does not reach `Stop` or its held chunk is not aborted. The mock makes those checks deterministic. **Low coverage gap:** it cannot independently detect a missing `run.stop()` call, because the core also aborts the chunk directly. Tests were not run.

The corrected comment matches [the core](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/core/uploadQueueCore.ts:225): removal stops a and starts the next row immediately.

The test change follows Z15 and Z17 in [the design](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:995) and is recorded in [K5’s cycle 1 log](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/impl/K5.md:93).

Outside this patch, the previously reported duplicate start of an empty file remains; no new outside finding.