# Review of the components design (Opus, read-only), 2026-10-08

Two test claims of the design are wrong (each would turn a step red); minor inaccuracies and gaps; no regression a
user would hit in a normal flow. Check 2 (consumers) and check 3 (the frame with two adapters reproduces both
screens; `createDamImage` reproduces all nine image objects field by field): no findings.

## PRODUCT
- **P1 (low, ZK3, rule 2.2.1).** In the library, "Remove from queue" shows up together with "Refresh": the bin
  follows `showRefresh` (`UploadQueueItemEditable.vue:161-168`). Today both appear 20 s after upload and only when
  the row has no metadata (`:204-213`); the read warning exists only in that state (`uploadSettle.ts:285-292`). So
  in admin-cms with the notification service a warned row gets two buttons at once instead of after up to 20 s.
  (Codex found the same.)
- Verified, no product change: ZK7 (library queues hold only images), ZK8, ZK13 (texts and keys the same; live vs
  latched names), ZK19, ZK20 (current ext system written only in `currentExtSystem.ts`; same URLs and client),
  ZK21, the new config keys (admin-dam values reproduce today's gates; `useAclAllowed(undefined)` is true, so
  admin-cms and admin-ugc keep today's behaviour), R10: exactly the 12 English strings of 6.2 differ, no Slovak one.

## CONSUMER
No findings: admin-cms passes only `damClient`; admin-ugc's options and config-store writes touch no added or
renamed key; its mappings always return strings; `src/lib.ts` changes are additions only.

## WRONG
- **W1 (U2 gate).** `DT/cached/cachedChipUnresolved.test.ts` imports the real admin-dam caches, mocks only
  `damClient` and `currentExtSystem`, mounts without the common-admin plugin and expects `/ext-system/1/`. After U2
  the forwarded library cache calls `useCommonAdminCoreDamOptions()`, which throws without the plugin, so every id
  settles unresolved and two cases fail; even with the plugin `cachedExtSystemId` stays 0 and the request goes to
  `/ext-system/0/search`. Fix: move this test's edit from U3 to U2 (install the plugin, set `cachedExtSystemId` or
  call the real init).
- **W2 (U4 gate; 4.3 "no library assertion changes in U1-U7").** ZK4 adds `item` to the library row's
  `refreshItem` payload; `LT/uploadQueueRowRefresh.test.ts:129-131` and `:172` assert exactly
  `[{ index: 0, assetId: 'asset-1' }]` with `toEqual`. Fix: list the edits, or keep the library payload and let the
  admin-dam wrapper add `item` (cheaper).
- **W3 (2.9 "key order changes only in IM7").** Order also changes in IM1-IM6. Harmless (JSON bodies; tests use
  `toEqual` or `toContain`); field by field all nine match.
- **W4 (ZK23).** `pr-3` → `pr-2` moves the dialog's buttons 4 px closer to the edge, not further.

## GAP
- **G1.** The library adds `AssetFileProperties.ttsAudio?: boolean` in U1; admin-dam's augmentation declares
  `ttsAudio: boolean` (`admin-dam/src/plugins.d.ts:31-33`) and is removed only in U3. Between the U1 copy and U3 the
  declarations differ in optionality, so admin-dam `lint:tsc` would fail (inferred). Drop the augmentation at the
  U1 copy.
- **G2.** `:ext-system` for `AssetLicenceEditForm` is unstated. Today the author input searches and creates in the
  CURRENT ext system (`D/author/components/AuthorCreateButton.vue:50-58`), while the form has its own
  `assetLicence.extSystem`. Binding that field changes the author list and the "+" target, and the library
  `AuthorCreateButton` throws in setup for an ext system whose config is not loaded (admin-dam loads only the
  current one). Name `currentExtSystemId`.
- **G3 (low).** The pinned-fields fallback is read via `configs?.[configName]`, but the form has no `configName`
  prop. Say `default`, or add the prop and say who passes it.

## RISK
- R1: the list's default `#item` content must call the slot's `refresh` with the loop row, not `$event.item`;
  `LT/uploadQueueItemRefresh.test.ts:194,215,247` emit `{ index, assetId }` without `item` and would silently stop
  asking under rule 2.3.2.
- R2: `createDamImage` "position/id only when given" must test `!== undefined`; IM6 and IM8 pass `position: 0`.
- R3: ZK24 makes the detail image a child of a non-growing `div.position-relative` instead of a flex item with
  `max-width: 100%`; a wide image may overflow instead of shrinking (inferred from CSS).
- R4: with live chips (ZK13), an id the cache prunes leaves the chip spinning until something adds it again.

## Not verified
Nothing run (tests, `vue-tsc`, browser). G1 and R3 inferred; the G2 throw inferred from code; W1/W2 from reading the
tests.
