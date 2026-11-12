# Review of the components design, version 2 (Opus, read-only), 2026-10-08

0 PRODUCT, 2 GAP and 1 WRONG worth fixing (all in tests), plus 3 low ones; checks 1 (RD12 behaviour), 2 (ROI in the
frame) and 5 (G2, R2, R3) hold. Reviewed the file as of 22:43:52. Nothing was run.

1. **RD12** — behaviour right on both sides. WRONG (low): the stated reason "in the normal flow both buttons at
   once" is not supported: a library row becomes Uploaded only through a read, which clears the warning first; a
   warning reaches an already-Uploaded row only after 3 failed reads (≥ 45 s), when the 20 s offer is already
   showing. admin-dam reads the error only on a status change or on mount (`AQIE:233-239`). Converging would differ
   only for a row that mounts already warned (e.g. a reopened dialog). Keeping it per side is still the safe call.
   (Codex, same round: the proposed admin-dam value `true` would bring Refresh forward when a warning arrives after
   Uploaded, which admin-dam does not do today.)
2. **ROI in the frame (JS31)** — no findings; the dialog's denied grant is covered; the detail only by the new U0
   test.
3. **ZK27** — really internal (core-dam-bundle 1.52.0 always sends the pinned count, default 5). GAP:
   `DT/asset/assetMetadataValidation.test.ts:181-186` sets `pinned = undefined` and relies on today's 0; on the
   library form its only field becomes pinned, so the case stays green but no longer tests "behind show all". Set
   `pinned: 0` there in U5c.
4. **Test bookkeeping**
   - `iconButtonNames`: counts right; GAP (low): the 9 tooltip pairs at `:149` must move with `:95`.
   - `cachedChipUnresolved`, U2: write `cachedExtSystemId` through `useExtSystemIdForCached` (exported in U1)
     rather than running the real init. GAP (U5c): only `ADamAuthorCachedChip` is exported; the keyword chip and
     the conflict chip are not, and `package.json` `exports` allows no deep imports, so two of the three chip kinds
     cannot switch to the package. WRONG: with the library author chip `:164` turns red — `explained()` looks for
     `[title="common.model.cachedUnavailable"]`; the library chip puts the explanation in a VTooltip. Record under
     ZK14 and U5c.
   - RD21, R1, the moved validation tests: correct.
   - `ttsAudio`: the step can end green. WRONG (low): the reason "otherwise TS2717" — the augmentation is in a
     `.d.ts` and admin-dam has `skipLibCheck: true`, so `vue-tsc` probably reports nothing either way; list the
     removal as an explicit edit.
   - K-09 counts fixed (17, 12, 21).
5. **G2, R2, R3** — correct.

NEW: none.
