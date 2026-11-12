# OP13-D2 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP13-D2.diff` (52 files, 4 116 lines; snapshot `krok5-praca/snap/OP13-D2/src` → admin-dam
`next`, uncommitted), brief `zadania/zadanie-OP13-D2.md` with the addendum (16, 17), rows A1, A2, B1 („cesta panela",
„medze deviateho bloku") and B3 of `pracovne/veduci/stare-nalezy.md`, `PRAVIDLA.md`, note `impl/OP13-D2.md`, logs
`pracovne/impl-dam-op12/log/d2-1617-old.log`, `d2-s1-old.log`, `d2-mod-old.log`, `bends/vysledok.txt:137-202`,
`bends-op13d2.py`, `bends-op13d2-1617.py`, `vysledky/OP13-D2-testy.log` (134 files / 2 007 green), `OP13-D2-linty.log`
(green). Library = installed `admin-dam/node_modules/@anzusystems/common-admin` (dist); vue-router 5.4.0 and Vuetify
4.2.6 as installed; backend `core-dam/vendor/anzusystems/core-dam-bundle/src` (`B/`) and, for M1, the project's own
`core-dam/src` and `core-dam/config`. Read-only: I ran no test, build or browser. "Verified" = read at the cited place;
"inferred" = a runtime sequence reasoned from that code, not executed.

Short names: `S` = `src/domains/coreDam/asset/store/assetDetailStore.ts`, `ACT` =
`src/domains/coreDam/asset/components/list/composables/assetListActions.ts`, `FC` =
`src/domains/coreDam/asset/components/detail/composables/assetDetailFileChange.ts`, `D/` =
`src/domains/coreDam/asset/components/detail/`, `CL` = `doc/changelog/3.0.0.md`.

## Verdict

All 17 points are implemented, and the new global pieces hold on every path I traced: the double-click listener is
removed on every exit, `whileOnPage` removes its hooks on every settle, "unsaved" of a save on its way can neither
stick nor vanish wrongly, the remembered tile and read are consistent, the 5 s rule never blocks a held „Uložiť", and
the 17 (b) close is synchronous today. No High. Three Medium: (M1) point 9 (a) lifts the overwrite hold for assets
core-dam has not autocompleted yet although their main file is processed — the project's own NAXOS migration creates
exactly those; (M2) point 16 lets the panel's next „Uložiť" silently send the pre-mass-edit values back, a situation an
earlier line of the same changelog calls a bug, and the new line does not say it; (M3) six earlier lines of `CL` still
state the limits this step removed. Seven Low.

## Findings

### High

None.

### Medium

**M1 — Point 9 (a): `formIsAfterFillIn` takes a processed main file for "already autocompleted"; core-dam's own
migration makes assets for which that is false.**
- Code: `S:218-220,230` (set from `mainFile.status === Processed`), used at `S:255` and in `saveBlocked`
  (`D/components/AssetDetailSidebarMetadata.vue:51-55`, `list/components/AssetListSidebarMetadata.vue:54-58`).
- Backend, verified: autocomplete runs only while `isNotDescribed() && isNotAutocompletedMetadata()`
  (`B/Domain/AssetFile/FileProcessor/MetadataProcessor.php:35`) and then sets the flag
  (`B/Domain/AssetMetadata/AssetMetadataAutocomplete.php:48`); it already runs at the first chunk
  (`B/Domain/Chunk/ChunkFacade.php:57-59` → `B/Messenger/Handler/AssetFileMetadataProcessHandler.php:47`). The flag is not
  in the admin DTO (`B/Model/Dto/Asset/Embeds/AssetFlagsAdmDto.php:12-19`: described, visible, ttsAudio). The project's
  migration inserts assets with `asset_flags_autocompleted_metadata = 0`, `described` from its config, and files with
  status `processed` (`core-dam/src/AssetMigration/Migrate/BulkAssetInserter.php:171-191,219-246`); the production config
  has `'described' => false` (`core-dam/config/packages/asset_migration.php:25`, NAXOS images of the cms ext system, which
  has one image slot, `core-dam/config/packages/anzu_systems_core_dam_ext_systems.php:38-43`). Deleting the only file is
  allowed and leaves the asset a draft with no main file (`B/Domain/AssetFile/AbstractAssetFileFacade.php:296-304`).
- Scenario (inferred): an archive photo (not described, processed main file, flag 0) in the detail or the panel; the
  editor types a description, deletes the only file in „Sloty" and puts a replacement into the empty slot. Core-dam
  autocompletes from the new file at its first chunk. Snapshot: „Uložiť" off while the file is on its way
  (`metadataMayStillChange`) and held after it. Now `saveBlocked` stays false throughout (`... && !formIsAfterFillIn`) and
  `setMainFile` does not hold (`S:255`), so „Uložiť" writes the form's older custom data over what core-dam just filled
  in, without a word. The note's rationale (point 9: „Backend dopĺňa metadáta nepopísaného assetu raz") and `CL:266`
  („fills in the metadata of an asset that is not described once") are false for these assets.
- Fix: revert 9 (a) and keep the hold (the brief allows stopping a point that needs the backend), or gate it on
  `flags.autocompletedMetadata` once core-dam serializes it (a BE item for #86919). For the same reason do not implement
  the note's new finding (`mayHaveFilledIn` should respect `formIsAfterFillIn`): the conservative hold there is right
  while the flag is not exposed.

**M2 — Point 16: the panel keeps what was typed, and its next „Uložiť" reverts what the mass edit saved, without a
word; `CL:256` does not say so.**
- Code: with typed text the read after the bulk save is `readQuietly(false)` (`footer/AssetFooterSelectedFull.vue:79-81` →
  `FC:124`), which takes main file, state and switches only (`S:253-260`). The panel's save sends the whole form —
  keywords, authors, customData (`list/components/AssetListSidebarMetadata.vue:107,113-119` → `api/assetApi.ts:368-378`) —
  and „Uložiť" is free (the bulk save marked it described, `api/assetApi.ts:346`, so `formMayBeOlder` is false).
- Scenario (inferred): a title typed into the panel for asset X, not saved; X picked for the mass edit, its keywords
  changed there, „Uložiť a ukončiť" → „Záznam bol upravený.". The panel still shows the old keywords with „Uložiť"
  standing out; pressing it sends them back. The same changelog calls that a fixed bug at `CL:236` („it showed its
  values from before the save, under a working save button that would have put them back"). The note says it (point 16,
  „ďalšie Uložiť panela prepíše hodnoty hromadného uloženia"); `CL:256` and `CL:236` do not.
- Fix: owner decision. Minimum: say it in `CL:256` and amend `CL:236`. S alternative with existing texts: ask
  („Neuložené zmeny": stay = keep the typed form, leave = read whole) — the B1 row's own alternative „alebo sa opýtať";
  the per-field merge is the L part stopped in point 6.

**M3 — `CL` now contradicts itself: earlier lines still describe the limits this step removed.** The diff of `CL` only
adds `CL:255-276`.
- `CL:133` „A double click on another tile is asked about at its first click, and "Odísť aj tak" then only picks the
  tile: its detail has to be opened once more." ↔ `CL:261`.
- `CL:133` „Still without a question: the read after a mass edit save, and a click made while a save of the panel is
  on its way" ↔ `CL:256`, `CL:260`.
- `CL:173` „the form stays as it is, and a "Uložiť" held back stays so with the same text" ↔ `CL:276`.
- `CL:182` „"Upraviť" of the panel reads nothing: the detail shows the same form, with "Uložiť" still held back." ↔
  `CL:275`.
- `CL:184` „"Uložiť" is held back with "Súbor sa ešte spracúva…" until the asset is read whole" — with a processed main
  file the line is the third text now (`CL:276`).
- `CL:188` „The other actions of the detail are as they were" ↔ `CL:255`.
- `CL:236` „The panel shows its loader meanwhile. A read of the detail already on its way when the save answers is let
  land and the asset is then read once more" ↔ `CL:256` (typed: quiet, no loader) and `CL:268` (not read again behind
  the read of a file change).
- Fix: rewrite those sentences to the current behaviour (S, docs only).

### Low

**L1 — 12 (c) closes the detail under the loader of the next asset.** `D/components/AssetDetailDialog.vue:66-70`
compares `asset.value?.id`, which under the loader is still the deleted asset. Scenario (inferred): Delete confirmed,
→ pressed before the DELETE answers → loader for B; the answer marks A and closes the dialog (address back to
`/assets`) while B loads into the panel. Snapshot: the event of the unmounted sidebar was dropped and the detail went on
to B. Contradicts the comment at `:62-64` („not over the next one it has gone on to"). Fix: compare
`assetDetailStore.shownOrReadAssetId()`.

**L2 — Point 10 not in the external provider's detail.** It draws the same loader without `title`
(`src/domains/coreDam/externalProvider/components/ExternalProviderAssetDetailDialog.vue:99-108`); the recorded FE-71
limit covered both (`register-zblizeni.md:428-429`, „pod loaderom nie je názov"). The note says „Poskytovateľ bez
zmeny"; `CL:269` reads as general. Fix: pass the provider's active item title, or scope `CL:269` to the list of DAM.

**L3 — Visible effects missing from `CL` (and partly from the note).**
- (a) Point 3: during a save on its way the licence dialog asks too (`toolbar/AssetToolbarExtSystemLicenceDialog.vue:145-146`)
  and the browser asks on reload (`list/AssetListView.vue:119-124`; the note mentions the reload only); `CL:260` names
  neither.
- (b) Point 14: a failed read of „Upraviť" now closes the detail, empties the panel and shows an error (`ACT:340-347`),
  e.g. 404 once an asset marked deleting is gone; before, nothing was read. Not in the note nor `CL:272,275`.
- (c) Point 16: a failed quiet read shows „Systémová chyba…" right after „Záznam bol upravený." (`FC:106-108`), while
  the untyped path stays console-only (`AssetFooterSelectedFull.vue:88-91`). In the note, not in `CL:256`.
- (d) Point 1: „Nastaviť ako súkromné/verejné" of the file card is off for a deleting asset in the panel beside the
  list too (`shared/assetFileRoute/components/AssetFileMainRoute.vue:58`, drawn by `components/AssetMetadata.vue:267`);
  note and `CL:255` say „the detail". Harmless.
- Fix: one clause each.

**L4 — 13 (234) can greet the user's own delete.** Core-dam commits `deleting` before answering 204
(`B/Domain/Asset/AssetFacade.php:120-123,207-215`); a quiet read answered in between sees `deleting` while `held` is not
yet marked (`FC:113-116`) → „Asset bol medzitým zmazaný." beside „Záznam bol odstránený.". Needs a quiet read in flight
(notification, route change, bulk save). Fix: skip when `assetDeleteOnItsWay(held.id)`
(`composables/assetDeleteOnce.ts:13`; the set is emptied only after the answer, `:22`).

**L5 — `whileOnPage` after an aborted back/forward puts the address back on the wrong history entry.** For a popstate
navigation vue-router calls `routerHistory.go(-delta)` before `triggerAfterEach` (`node_modules/vue-router/dist/vue-router.js:1455-1461`);
`history.go` is asynchronous and `browserHistoryReplaceUrlByRouter` replaces the current entry
(`common-admin/dist/shared/utils/history.js`), i.e. the previous page's. Applies only to the branches of `ACT` that put the
address back (`:319-322,344-347,522-525,564-567`) and only inside Vuetify's one-task hold of a popstate
(`vuetify/lib/composables/router.js:78-112`): no long question can be open while those reads run. Very narrow, but the
helper's contract (`src/domains/system/composables/whileOnPage.ts:4-9`) promises more. Fix: in the deferred branch put
the address back after the next `popstate`, or only when `location` still names the page.

**L6 — Tests.** (a) The panel's copies of the 9 (a) `saveBlocked` change and of the point 15 line
(`AssetListSidebarMetadata.vue:54-70`) are not bent (`d2-fe69a-po-doplneni`, `d2-fe89-treti-text` edit only
`AssetDetailSidebarMetadata.vue`), and 9 (a) has no case in the panel. (b) `!isDeleting` inside `holdsUnsavedMetadata`
(`S:131`) has no case: the 17 (a) case asserts only after the failure (`olderLimitsPanel.test.ts`, „are not called
unsaved again when that save fails after the delete"), so removing it stays green. (c) The 9 (c) case („say so when the
read of the asset after them fails") clicks a tile and the panel's file menu while the full-page mass edit covers them —
an order an editor cannot produce (the code path equals the reachable order). Fix: one bend on the panel copy, one
assertion before `fail()`.

**L7 — Stale comment in a touched file.** `D/AssetFileDetailView.vue:122-124` still says the mark is „so that
"Uložiť" and "Odstrániť" are off"; point 1 turns off much more. Its twin was updated (`D/AssetDetailView.vue:123-126`).

## Answers to the checks

1. Points against the brief and rows (verified by reading):
   - 1 A1: one source `S:126`; disabled or hidden in every component the brief names (route change, rotation, ROI
     readonly in the dialog and both pages — `D/components/AssetDetailDialog.vue:318-321`, `D/AssetDetailView.vue:243-246`,
     `D/AssetFileDetailView.vue` likewise; the library draws `VImg` when readonly — dist
     `DamAssetImageRoiSelect.vue_vue_type_script_setup_true_lang.js:65-84` —, slot actions incl. the „+" of an empty
     slot, sibling, distribution category, distributions incl. advanced settings, podcast and video episodes, video
     preview actions incl. the „from distribution" slot inside `v-if="showActions"`). Download, copy, tabs stay; the TTS
     tab has no action. Plus L3 (d).
   - 2 A2: `D/components/AssetDetailSidebarMetadata.vue:150`.
   - 3 FE-44: `S:89-116,130-147`. A second press inherits „typed" (`S:105`); only the last save of the asset decides
     (`S:114`, `of.sent === sent`); both forms pass the store's reactive proxy (`AssetDetailSidebarMetadata.vue:93`,
     `AssetListSidebarMetadata.vue:110`); nothing replaces the form while a save is on its way (`FC:100-102`). Cannot
     stick: every answer removes its entry, and the client has a timeout (`shared/apiClients/damClient.ts:13`). Plus L3 (a).
   - 4 FE-45: (a) `typedLeft` (`S:140,158,189,231,413`) — no loader with typed text is reachable today, as the note says.
     (b) Listener added and removed with the same capture flag in `try/finally` (`ACT:373,379`); the awaited answer
     settles on every exit (`S:157-163` via the answer, `hideDetail`, `showLoader`, `setAsset`, `reset`; page unmount →
     `reset`, `ACT:587`); a second ask returns at once (`S:151`); a double click on the answer button arrives after the
     removal (microtasks). (c) Via 3. (d) `ACT:593-594`.
   - 5 OP4-D1: `shared/utils/event.ts:5,11`; also the detail and the provider (`externalProviderAssetListActions.ts:389,395`);
     no checkbox or switch in provider components (grep).
   - 6 FE-47: `AssetFileMainRoute.vue:54-58,61,73,82,143,150`; slot rows are read again after a change
     (`AssetSlotListItem.vue:193` → `AssetDetailSidebarSlots.vue:93`). Merge stopped as L, documented.
   - 7 FE-61: `S:50-55,298`, `store/assetListStore.ts:25,53-54,147`; every list-page loader starts a request with its asset.
   - 8 P3: `whileOnPage.ts:10-34` relies on the library tracker registered first (`src/router/index.ts:17`; dist
     `domains/system/composables/pageNavigation.js`); cancelled is skipped, aborted/settled/error handled; hooks removed on
     settle; vue-router copies its callback lists (`useCallbacks().list()` = `slice`). Not on the wrong page: `pageId`
     moves with every successful change of path. Plus L5.
   - 9 FE-69: (a) M1. (b) `list/AssetListView.vue:71-74`, `S:293-295`; `tellPageBy` clears only its own function. (c)
     `AssetFooterSelectedFull.vue:78`: `readAgainIfSaved` runs only through `readAfterCurrentRead` (`:99-102`), so a loader
     seen there was raised in the same `hideLoader` chain, after the save was answered.
   - 10 FE-71: dialog `AssetDetailDialog.vue:154-161,193`; provider L2.
   - 11 OP6-D1: `queue/AssetQueueItemEditable.vue:78-79,96`.
   - 12 OP8-D1: (a) `S:316-319` (fill-in at the first chunk verified, so a failed file can have filled in); (b)
     `S:213-216,223-224,388`, every detail read passes its token; (c) `AssetDetailDialog.vue:65-70`, plus L1.
   - 13 (234): `FC:113-116`, plus L4.
   - 14 Text A: `ACT:361-365`, `AssetListSidebarMetadata.vue:88`. The 5 s rule never blocks a held „Uložiť": every hold
     forgets the stamp (`S:241-244`), a whole read clears the hold, and the status-only block is never a failed or
     processed file (`store/uploadQueuesStore.ts:131-140`). Plus L3 (b).
   - 15 FE-89: `AssetDetailSidebarMetadata.vue:58-67`, `AssetListSidebarMetadata.vue:61-70`.
   - 16: `AssetFooterSelectedFull.vue:71-94`; M2, L3 (c).
   - 17: (a) `S:114,131` (plus L6 b). (b) the chain is synchronous: `AssetDetailSidebarMetadata.vue:128-129` →
     `AssetDetailDialogSidebar.vue:54-56` → `D/AssetDetailView.vue:76-77`, microtask `:130-133`; the file page left as the
     note says.
   - Texts: `deletedMeanwhile` and `fileProcessedOpenAgain` exactly as approved, sk and en
     (`locales/{sk,en}/coreDam/asset.json:131-132`).
2. Second press, late answer, closed detail, left page, deleted asset, failure: traced per action above; holes L1, L3 (b),
   L4, L5.
3. Tests: 34 new, 31 red on the snapshot (`d2-1617-old.log`: panel 14/16, detail 13/14; `d2-s1-old.log` 4/4); 14 changed
   existing cases red on the snapshot (`d2-mod-old.log`). I read the failure text of five (the switch, the route guard,
   the read after a delete, the 15 s timeouts of 17 (b) and 9 (b)): right reasons. Each changed existing case traces to a
   point (12 c `detailDeleting`, `detailFailedFileText`; 12 a `detailFileEnded`; 9 b `detailMainFile`; 4 a/b
   `sidebarUnsaved`; 4 d and 10 `detailNeighbour`; 10 `detailLoaderBar`; 15 `mainRouteChange` and the `saysWhy` helpers;
   14 the `detailNotOfList` server). 26 bends, all red (`bends/vysledok.txt:137-202`). Gaps L6. Changelog M2, M3, L2, L3;
   the note is accurate except the 9 (a) rationale (M1).

## Outside the step

- O1 — `D/AssetFileDetailView.vue:125-127`: the page of the asset of a file stays silently on an asset deleted from
  another tab (the implementer's own finding; confirmed). S, the pattern of `D/AssetDetailView.vue:127-134`.
- O2 — The list of an external provider walks under an open menu or dialog of its page
  (`externalProviderAssetListActions.ts:388-398` has no overlay check), unlike the DAM list after 4 (d). Pre-existing; S.
- O3 — The note's new finding on `mayHaveFilledIn` vs `formIsAfterFillIn` (`S:316-319`): its recommendation would widen
  M1; keep the hold until core-dam exposes the flag.

## Verified vs inferred

Verified by reading: every admin-dam file:line above (current tree = snapshot + patch), the installed library dist
(`pageNavigation.js`, `history.js`, `DamAssetImageRoiSelect…js`, `AActionDeleteButton.vue.d.ts`), installed vue-router
5.4.0 (`vue-router.js:1429-1464`, `devtools-*.js:478-495`), Vuetify 4.2.6 (`lib/composables/router.js:78-112`,
`lib/components/VOverlay/VOverlay.js:298-304`), the core-dam-bundle and core-dam files cited in M1 and L4, the logs and
the bend files. Inferred, not executed: every runtime sequence in M1, M2, L1, L4, L5 and the reachability statements.
