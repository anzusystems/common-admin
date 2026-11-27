# Posudok plánu implementácie, verzia 1 (Opus, deep-reviewer, 9. 10.)

Prepísané zo správ posudkového agenta (prišli v troch častiach; prvá bola v správe skrátená v strede bodu 6, body 6 až 11
poslal agent znova doslova).

**Review of plan-implementacie.md v1.** Read-only: no tests, builds or git writes. 2 BLOCKER, 4 WRONG, 2 GAP, 3 MINOR.

1. **BLOCKER – two steps in one tree break the snapshot, patch and rollback.** Section 1.1 defines "súbežne" as no
   shared files and no shared tree (plan:53-54), yet U0-L (testy) runs in LIB main beside K1 and K2 (plan:62,63,65).
   Every step snapshots, diffs and restores the whole `src`, and N-H must end with `diff -rq` empty (plan:158-161,168,
   174-180). So K1's patch for review contains U0-L's tests; rolling back either step overwrites the other agent's
   edits to existing files with no copy kept (e.g. U0-L's new cases in `LT/uploadQueueRowRefresh.test.ts`) and moves
   the other agent's new files into the wrong bin. Copying U0-L into lib-u while U1 is open (plan:245-246) has the same
   effect: a U1 rollback reverts the copied files, and I1 then copies the old `uploadQueueRowRefresh.test.ts` over
   main. C1's CK-DAM (plan:66,116) does not require U0-D to be closed, and U0-D may still be running beside K2
   (plan:61); half-written U0-D tests turn it red, and plan:854 then rolls the library back (N-C). Fix: one open step
   per tree, or limit snapshot, diff and restore to the step's own files from 3.1.
2. **BLOCKER – I1/I2 while a U step is still open in lib-u.** U6 goes over only "ak sú uzavreté" (plan:417-418), and
   C2b says "Ak U4 nestihol I1" (plan:427); C2b also contradicts row 16, which requires U1 and U4 closed (plan:73).
   3.4 diffs the whole lib-u against the base (plan:611-615), so a half-done step lands in main and, through C2, in
   DAM. If its files are skipped instead, step 8's `rsync -a …/common-admin/src/ …/lib-u/src/` (plan:619-620)
   overwrites the open step's edits (e.g. U6's `AssetDetailDialog.vue`, `UploadQueueDialogSingle*.vue`). Fix:
   transfer from `snap/<open step>/src` and resync only the files transferred, or wait for the step to close.
3. **WRONG – CK-LIB-T drops `lint:tsc`.** "prvé tri príkazy" are `mkdir`, `test:browser` and `test:eslint`; `lint:tsc`
   is the 4th (plan:745-748,761). 2.0 drops only stylelint and build for test-only steps (plan:152-153). Tests are
   type-checked only by `vue-tsc --build` through LIB `tsconfig.json:11`, and the core design requires `lint:tsc` aj
   `:test` (jadro:1263). U0-L's ~400 lines of tests would close without a type check.
4. **WRONG – owner decisions are scheduled one step late.** Z15 and Z17 are written once, in the core
   (jadro:885,900-909), and K4 tests them under both presets (jadro:1359-1365; plan:296), yet PV6 and PV7 are due only
   "najneskôr pred K5" (plan:309,869). K2's tests pin Z2 under the admin-dam preset (jadro:1353-1355; plan:271-273),
   but K2's condition leaves out PV2 (plan:280). A rejection after those steps means reworking K4 or K2
   (jadro:1275-1277). Fix: decide all seven before K2.
5. **WRONG – C3 runs CK-DAM before the U8 DAM test change** (plan:119,432). `DT/queue/massOperationsRows.test.ts:23-24,
   151` finds the buttons by exact name (DAM `src/test/support/uploadUi.ts:241-244`), and U8 changes those names. F1
   and F4, which ride C3, also flip DAM tests (plan:525,527; jadro:1283,1285). CK-DAM is red by construction, and
   plan:854 then orders N-C. Fix: copy, then DAM test edits, then CK-DAM.
6. **WRONG – the browser-run rules contradict each other.** "Dva behy v prehliadači naraz sa nepúšťajú" (plan:643),
   yet targeted runs in another tree during a CK are allowed (plan:640-641), and the agent preamble says "kedykoľvek"
   (plan:690). Every LIB run is a browser run (LIB `vitest.config.mts:120-121`). CK-LIB in main plus a targeted lib-u
   run, or three LIB agents at once, means several Chromiums. Swap is at 6/8 GB and `/tmp` has 2.2 GB free. The
   preamble also lacks the `test:eslint` exception (it must run without TMPDIR).
7. **GAP – `testy` is one agent, scheduled in parallel.** 4.1 has a single testy agent (plan:669,673), loaded with
   K0→U0-D (row 4), U0-L (row 5), and the K2 and K4 test files (rows 8, 11). K0, U0-D and U0-L alone take 8 h against
   the 5 h of block B1 (plan:131). K2 and C1 cannot close before testy delivers, so the critical path (plan:88-90) runs
   through testy unless a second test agent is added. The lead is also a single point of failure (slots, copies,
   transfers: plan:638,665), but the risk table covers only worker limits (plan:845).
8. **GAP – `mv` to the bin is not cleared with the owner.** The log already treats a rename as a deletion that waits
   for him (log:821). The plan leaves it to "prvé použitie ukáže" (plan:177,926-927), which would surface in the
   middle of a rollback in a shared tree. It belongs in V0.
9. **MINOR – the Z.3 cleanup commands won't work as written** (plan:511). `git worktree remove` refuses lib-u without
   `--force` (modified and untracked files). `git worktree prune` would also prune the foreign prunable
   `…/common-admin-main-sync` worktree, which plan:813-814 says not to touch.
10. **MINOR – 3.4.4 copies new files blindly.** "Nový súbor: mkdir -p a cp" (plan:614-615) does not check that main
    lacks that path, and a new directory needs `cp -r`.
11. **MINOR – the U6 K-04 view has no place.** The plan names none (plan:397,875); the design allows "ihrisko knižnice
    alebo admin-cms" (komp:1042). Writing to admin-cms is off-limits (log:76; plan:122). Fix: name the LIB playground,
    run it from lib-u while U6 is there, and count it as a browser run under 3.6.

**Checked and correct.** Worktree setup (3.2): tracked changes including binary and untracked files come over
correctly; no ignored files under `src`, no hooks, no `.gitattributes`, no diff config that would break the patch.
lib-u `node_modules`: the self-link `@anzusystems/common-admin -> ../..` is relative, no absolute symlinks at depth 3
or less; Yarn 4.18.0 from `packageManager`. Every CK command exists in both `package.json`; `lint:tsc` includes the
test project (plan 8.3 right). `doc/` holds no code and is excluded from vitest, oxlint, oxfmt, stylelint, vue-tsc. DAM
tests live under `src/test`, so snapshots cover them. `copy.sh`: a target argument replaces the `.env.local` targets;
source fixed to the main tree. `ttsAudio` at DAM `src/plugins.d.ts:31-33`, comment at `tsconfig.test.json:3-5`. `git
status` 100 lines (55 M, 45 ??) and 66 (30, 36), one DAM stash. `test:eslint` leaves about 0.6 MB in `/tmp` per run.
Completeness: every step scheduled or explicitly parked (K0-K7, F1, F2, F4, K2-D4, U0-U9, PK3, PV9/10/14/15, findings
25, 36, 45, 46); the copies each U step needs match components 2.11; `ttsAudio` removal travels with C2.

**Not verified.** Whether `mv` raises a prompt. Whether in-memory bending of production lines works in LIB's browser
mode (LIB wave 4 bent lines on disk, lib-vlna4.md:124-127; the plan cites only the DAM method, plan:213-215).

(Agent note: one of its read-only commands started with `cd` by mistake; it had no effect.)
