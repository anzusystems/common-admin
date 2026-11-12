# Review of the components design, version 3 (Opus, read-only), 2026-10-08

1 WRONG, 4 GAP, plus 1 PRODUCT outside the three checks. Nothing run.

1. **RD10/RD12, `refreshOffered`** — behaviour holds on both sides (the moved watcher reacts only to a status change or
   the mount; the bin is the wrapper's `#remove`).
   - GAP: an absent Boolean prop without a declared default is cast to `false` by Vue
     (`runtime-core.cjs.js:5117-5119`, 3.5.43); this file defaults its booleans to `false`. Then `refreshOffered ?? own`
     is always `false`: no Refresh in CMS/UGC, the bin only on Failed. Specify `{ refreshOffered: undefined }` in
     `withDefaults`. The gates would catch it (`LT/uploadQueueRowRefresh.test.ts:121-137`).
   - GAP (low, U4): the `false` half catches `refreshOffered || own` only where the row's own rule offers Refresh.
2. **Test bookkeeping** — ZK27 `pinned: 0`, `iconButtonNames` 9 → 8 → 2 → 0, `cachedChipUnresolved` U2/U5c: no
   findings. GAP (low, `ttsAudio`): `admin-dam/tsconfig.test.json:3-5` gives this augmentation as the reason
   `plugins.d.ts` is included; update that comment in the same edit.
3. **2.11 exports** — WRONG: `ADamAssetCustomMetadataFormMassOperations` has no production user (its only admin-dam
   importer becomes a wrapper over the library sidebar in U5b). GAP (low): `useDamCached{Authors,Keywords}ForRemoteAutocomplete`
   serve only admin-dam's own pickers, unused after U5c and deleted in U9; 14 importers go through the shims, not 17.

**Outside the checks, PRODUCT (RD5).** `#edit` copies `AQIE:368-376` as is, and that `VBtn` has
`v-if="!item.isDuplicate"`. On a duplicate the slot yields only a comment, so Vue draws the default
(`runtime-core.cjs.js:3329-3339,3355-3363`): a disabled "Edit in Media Library" on every admin-dam duplicate.
`queueRowStates.test.ts:335-339` stays green, because it matches "Edit more" exactly.

(Codex, same round: the library replacement guard does not cover admin-dam's keyword retry / server-failure cases and the
conflict-chip server-failure case, `DT/cached/cachedChipUnresolved.test.ts:167,179`; the same exports have no production
user.)
