# OP13-D3 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP13-D3.diff` (58 files; snapshot `krok5-praca/snap/OP13-D3/src` → admin-dam `next`,
uncommitted; the working tree matches the patch: `git hash-object` of `assetFileRequests.ts`, `assetDetailStore.ts`,
`assetInNewTab.ts`, `uploadQueuesStore.ts`, `MainWrapper.vue` and `doc/changelog/3.0.0.md` equals the post-image blob
ids of the patch). Brief `zadania/zadanie-OP13-D3.md` (points 1-13, 15-17; 14 and 18 skipped by the leader), rows of
`pracovne/veduci/stare-nalezy.md` (A3, B1 „176", „návrh 8/9/10", B3) and `stare-nalezy-2.md` (A6), `PRAVIDLA.md`,
note `impl/OP13-D3.md`, logs `pracovne/impl-dam-op12/log/d3-old1.log`, `d3-old2.log`, `gc-bez.log`, `gc-s.log`,
`bends-op13d3*.py`, `bends/vysledok.txt:231-296`, `vysledky/OP13-D3-testy.log` (145 files / 2 049 green) and
`OP13-D3-linty.log` (green). Library = installed `admin-dam/node_modules/@anzusystems/common-admin` (dist); vue-router,
Vuetify, happy-dom and vitest as installed; backend `core-dam/vendor/anzusystems/core-dam-bundle/src` (`B/`).
Read-only: no test, build or browser run; the only thing I executed is a 10-line node script with the GC trick of
point 12 (Node 24.15). "Verified" = read at the cited place; "inferred" = a runtime sequence reasoned from that code.

Short names: `A/` = `admin-dam/src/domains/coreDam/asset/`, `D/` = `A/components/detail/`, `S` =
`A/store/assetDetailStore.ts`, `Q` = `A/store/uploadQueuesStore.ts`, `NT` = `A/composables/assetInNewTab.ts`, `CL` =
`admin-dam/doc/changelog/3.0.0.md`, `LIB` = `admin-dam/node_modules/@anzusystems/common-admin/dist/`.

## Verdict

All 16 points the step owns (1-13, 15-17; 218 of point 7 stopped with reasons) are implemented and the core logic holds on every path I traced: the 27 wrappers keep their
statuses and return shapes and raise one alert, the loader tokens and the "gone" set cannot leave the loader stuck or
bring a deleted row back, the typed generations of FE-15 are right for every order of two saves, the re-read of FE-12
is bounded and guarded. No High. One Medium: FE-87 (point 6) is not covered on the page of an external provider when
Back goes to another provider's entry, although `CL` says the page is not left. Eight Low (a duplicate read per failed
or duplicate slot file with notifications on, a stale list after the distributions tab is reopened during a save, the
side effects of dropping `noopener`, a per-instance download guard, a fail-hard GC hook, the 218 reasoning, documentation
drift, one assertion that cannot fail).

## Findings

### High

None.

### Medium

**M1 — Point 6 (FE-87): the guard does not hold when Back leads to the same route with another path (provider → provider).**
- Code: `onBeforeRouteLeave(() => !buttonLoading.value)` (`A/components/AssetCreateButton.vue:54`) and
  `onBeforeRouteLeave(() => !saving.value)` (`A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:114`).
- Verified: vue-router runs leave guards only for records that are left; a record kept with other params is an
  *updating* record (`node_modules/vue-router/dist/devtools-CxgSYwGp.js:700-720`, `registerGuard` → `leaveGuards`
  `:498-518,528-534`). Both providers are one record (`src/pages/(coreDam)/external-providers/[provider]/index.vue`;
  switching pushes it with another param, `A/components/toolbar/AssetToolbarIntegrations.vue:22-23`), and the page is
  remounted on every path change (`src/App.vue:26`, `<RouterView :key="route.path" />`). Vuetify lets popstate onto a
  `replaced` entry through (`node_modules/vuetify/lib/composables/router.js:107-111`). Both dialogs are drawn on this
  page (`MainWrapper.vue:93` in `ExternalProviderAssetListView.vue:89`).
- Scenario (inferred): ADAM opened at `/external-providers/A` (entry written by `replace`), provider B picked in the
  bar, "Vytvoriť prázdny asset" → "Vytvoriť" (POST on its way), browser Back → no guard runs, the page is drawn anew
  and the dialog with what held a second confirm back is gone; the menu opened again makes a second asset — exactly
  what the comment at `AssetCreateButton.vue:46-48` guards against. The licence dialog the same: a second change under
  the reload of the first (`AssetToolbarExtSystemLicenceDialog.vue:106-108`). `CL:164` ("While the asset is being
  created the page is not left either … does nothing until the request is answered") and `CL:169` say otherwise. The
  new cases navigate to another record only (`src/test/list/olderFixesDialogLeave.test.ts:27,57,66-67`).
- Fix: add `onBeforeRouteUpdate((to, from) => to.path === from.path || !buttonLoading.value)` (and with `saving` in the
  licence dialog): another query keeps the page (no remount), another path remounts it. One case on the provider page:
  provider A → push B → confirm → back to A stays on B with the dialog.

### Low

**L1 — Point 17: with notifications working, a failed or duplicate slot file now reads the asset twice.**
`onRowFinal` reports the end (`Q:284-293`), and the notification listener reports it again right after
(`src/domains/system/composables/appNotificationListeners.ts:38-50`).
For a failed notification `queueItemFailed` → `settleKnownFailed` → `onRowFinal` is synchronous (`Q:679-681`,
`LIB/domains/dam/uploadQueue/settlement/uploadSettle.js:92-99`), for a duplicate `markDuplicate` calls `onRowFinal`
before its first await (`uploadSettle.js:108-113`). The first `fileStatusOnServer` tells the page, which starts a quiet
read (`S:321-353`, `D/composables/assetDetailFileChange.ts:140-141`, `A/components/list/composables/assetListActions.ts:356`);
the second comes while that read is on its way, `heldAsBefore()` is still true, so a second read starts and the first
answer is dropped (`assetDetailFileChange.ts:100-102`). Only files of another slot are deduplicated (`S:343-348`); the
main file, or an asset with no main file yet, read twice. Inferred, not run. The same pattern exists for Processed; I
did not check whether it is deterministic there. Fix: remember in `fileStatusOnServer` what the page was told
(asset, file, status) until its read lands, as `toldOfOtherFiles` does for other files.

**L2 — FE-37: the distributions tab closed and opened again during a save shows the list as it was before the save.**
The dialog takes `listChanged` of the tab instance it was drawn in (`D/components/distribution/forms/DistributionManageDialog.vue:52,81`);
that instance is gone (`D/components/distribution/AssetDetailSidebarDistribution.vue:75-79,123-125`). The new instance
reads on mount, possibly before the save is answered, and nothing reads again unless a listed distribution is under way
(the poll, `A/composables/distributionListPoll.ts:61-63,121-129`). `CL:252` ("the tab reads its list as it is opened
again") holds only when it is opened after the answer. Fix: let the store count saves (`listChanged` bumps a counter the
mounted tab watches), or say the limit in `CL` and the note.

**L3 — Point 4: side effects of dropping `noopener` in `openAssetInNewTab` (`NT:72-76`).** Security is fine (see the
judgement of 4 below). But a tab opened with an opener stays in the opener's browsing context group: in Chromium a
same-site page there shares the renderer process (and main thread) of the provider page whose uploads run (inferred from
the process model, not measured), and the new tab gets a copy of `sessionStorage` (inferred from browser behaviour; only `anzu.appReloadAt` today,
`LIB/domains/system/systemBar/utils/appReload.js`). `CL:164` still says the queue-row tab "is opened that way" (cut off
by `noopener`); it is now cut off as it is opened. Related: on the no-tab path `openTabForAddress` registers its
`pagehide` listener before the callers return without `close()` (`NT:44-46`, `AssetCreateButton.vue:79`,
`D/components/slots/AssetSlotListItem.vue:114`), one listener per blocked press for the life of the page. Fix: register
the listener only with a tab; mention the process/sessionStorage trade-off in the note.

**L4 — FE-85: the guard of a second "Stiahnuť" is per row instance.** `let downloading` (`AssetSlotListItem.vue:109-127`)
is lost when the Slots tab is drawn again (another tab of the detail and back) while the address is asked for; the same
press then opens a second tab and sends a second request. The slot changes of the same tab use a module-level set for
exactly this redraw (`D/composables/assetDetailSidebarSlotsActions.ts:18-19,81-95`). `CL:194` ("a second press while it
is asked for opens no second tab and asks nothing") is true only within one drawing. Fix: a module-level set by file id.

**L5 — Point 12: the GC hook fails hard where the flag does not take.** `setFlagsFromString('--expose_gc')` +
`runInNewContext('gc')` (`src/test/support/uploadUi.ts:238-247`) works on Node 24.15 — I ran exactly this: `gc` is a
function and collects; CI runs Node 24 (`.github/workflows/ci.yml:20`). `package.json` also admits `^22.22.2` and
`>=26.0.0`, not checked; Node documents flags set after start as unpredictable. Where `gc` is not installed,
`runInNewContext('gc')` throws a ReferenceError in `stopUploadUi` (an `afterEach`) of every case once the heap passes
1 GiB. Side effects: the flag is per worker process (no `pool` in `vitest.config.mts`, default forks), every new V8
context in it gets a `gc` global (verified with `runInNewContext('typeof gc')`), but vitest's happy-dom environment uses
`GlobalWindow` (`node_modules/vitest/dist/chunks/index.CK-t0WMg.js:1214-1215`), whose `setupVMContext` does nothing
(`node_modules/happy-dom/lib/window/GlobalWindow.js:81-83`), so the tests see no `gc` (inferred). Measurements: max RSS
2 187 772 kB without, 1 398 244 kB with, 52.35 s vs 52.59 s (`log/gc-bez.log`, `log/gc-s.log`; I found one log per
variant, not the two runs the note mentions). Fix: `try { … } catch { collect = () => undefined }`.

**L6 — Point 7 (218): the reasoning overstates what disabling the referrer needs.** The note (`impl/OP13-D3.md:46-53`)
says the full switch-off needs a policy for the whole admin. Not so: the tab is an `about:blank` of the admin's origin
until it is sent on (`NT:30-34,54`), so the page can create an `<a href=… referrerpolicy="no-referrer">` (or
`rel="noreferrer"`) in that document and click it, which navigates that tab without a Referer (HTML "follow the
hyperlink"; inferred, not tried in a browser). That the default `strict-origin-when-cross-origin` sends only the origin
is right (no `<meta name="referrer">` in `index.html`, no `Referrer-Policy` under `docker/`), and keeping it is a fair
recommendation; the note should not say the per-tab way does not exist.

**L7 — Documentation drift.**
- `CL:260`: "only the save of the asset that went out last, from the detail or from the panel, decides" no longer holds:
  two saves with nothing typed between them, the second failing first and the first saving after it, leave nothing
  unsaved now (`S:107-132`, `typed <= savedTyped`). The comment `A/components/list/components/AssetListSidebarMetadata.vue:89-91`
  ("only while no later save of the asset went out") states the removed rule. The note (point 3) omits the second
  condition (`takenFurther`, a save still on its way that takes the same generation).
- `CL:155`: "With Ctrl, Cmd, Shift or Alt held, or by another button of the mouse, the browser opens that page in a new
  tab or window" — Alt+click on a link downloads it in Chromium, and Firefox follows it in the same tab with a full page
  load (neither the router nor VBtn calls `preventDefault` for it); the code is right, the sentence is not.
- Point 1, unlisted visible change: a timeout of the 27 requests now says "Požiadavka na API vypršala. Skúste to prosím
  znova." (`LIB/domains/api/utils/apiErrors.js` → `AnzuApiTimeoutError`, `LIB/domains/system/composables/alerts.js:58`)
  where it said "Systémová chyba…"; the note (`impl/OP13-D3.md:16-19`) and `CL:157` list 403, 422 and the operation only.

**L8 — A case that cannot fail on half of its title.** "says so when the browser gives no tab, and the next press tries
again" (`src/test/list/olderFixesNewTab.test.ts:136-150`) discards the second `browserOpensTabs(true)` and asserts only
that no second alert came: a second press that does nothing passes. Fix: keep the spy and expect one call to it.

## Judgement of the decisions the leader listed

1. **`assetFileRequests.ts`** — verified: 27 wrappers (audio 7, document 7, image 7, video 6) with the old success
   statuses, which are the backend's (`B/Controller/Api/Adm/V1/ImageController.php:142,161,176,245,280,289,329,346`;
   audio make-private 200, `AudioController.php:280-295`). Callers read a result only from `downloadLink`
   (`D/components/AssetDownloadButton.vue:55`, `AssetSlotListItem.vue:117`) and `rotateImage`
   (`A/store/imageRotationStore.ts:24`): `fileRequest` returns the body (`LIB/domains/api/composables/useApiRequest.js:47-57`);
   `fileCommand` resolves `undefined` where nothing read the result (`useApiRequest.js:58`), so 204 bodies do not matter.
   `validationEntity` only on audio/document make-public, whose slug label exists (`src/locales/sk/coreDam/asset.json:239-242`);
   the backend names the field `slug` (`B/Model/Dto/AssetFileRoute/AssetFileRouteAdmCreateDto.php:15-23`). The helpers raise
   no alert themselves (`useApiRequest.js:10-46`; `report` only logs), each caller alerts once. Texts are the library's
   (`alerts.js:58`); `file_is_used` and `invalid_asset_slot` now show their own text, the route refusals
   (`forbidden_operation_error`, `B/Domain/AssetFileRoute/AssetFileRouteFacade.php:79,155,168`) show "Nastala neznáma
   chyba…", as the note says.
2. **FE-22/36/29/37** — verified: the last raise lowers the loader; every path that raised it lowers it or is followed by
   a raise that does (delete answered closed / not closed / failed, read aborted by a newer read or by unmount). Stop and
   delete both delete on the server (`B/Domain/CustomDistribution/CustomDistributionFacade.php:61-72`), so `gone` never
   hides a listed row. Per-distribution spinner correct. FE-37 correct for hidden settings; L2 for a reopened tab.
3. **FE-15 generations** — verified for every order of two saves (with and without typing between): restored only when
   nothing saved that generation and no save on its way takes it. Dropping `of.sent === sent` is safe: both forms pass
   the store's `asset.value` (`AssetListSidebarMetadata.vue:106`, `D/components/AssetDetailSidebarMetadata.vue:89`), and
   `asset.value === form` covers a form replaced since. Docs: L7.
4. **`window.open` without `noopener`** — nothing can run between `window.open` and `tab.opener = null` (`NT:73-74`): both
   are in one task, the new document of a same-origin auxiliary context loads asynchronously on the same event loop
   (inferred from the HTML spec). The storage page never has an opener: `openTabForAddress` opens `about:blank`, nulls
   the opener before any await (`NT:30-34`) and sends the tab on later (`NT:54`) — unchanged by this step. Side effects:
   L3. `coreDam.asset.newTabBlocked` — no existing text fits (none about pop-ups in the app or library locales); the
   wording is clear. "Vytvoriť prázdny asset" without a tab makes nothing: a product decision beyond the literal brief
   ("the editor is told"), but the better one (no invisible orphan asset), documented in the note and `CL:164`; owner to
   confirm with the texts.
5. **Retry** — verified: only after a failed read, hidden while reading, reuses a processed image held (`ImagePreview.vue:58-79,96-99,207-215`).
6. **`onBeforeRouteLeave`** — M1. The vue-router warning appears only in `licenceDialogConfirm.test.ts` (4× in
   `OP13-D3-testy.log`); in the app both dialogs sit under the page's `RouterView` (`MainWrapper` inside the two list
   views), so the guard is registered.
7. **FE-85** — correct within one drawing (L4). **218** — stop defensible, reasoning partly wrong (L6).
8. **197/N1** — verified: `clearQueue` is safe on a queue that does not exist (`LIB/domains/dam/uploadQueue/core/uploadQueueCore.js:137-141`),
   both lists empty the mass edit as they mount anyway (`A/components/list/composables/assetListActions.ts:595-596`,
   `src/domains/coreDam/externalProvider/composables/externalProviderAssetListActions.ts:421-423`); `whileOnPage` counts
   another path only as leaving (`LIB/domains/system/composables/pageNavigation.js`).
9. **OP5-D2** — verified in both components; success still says "Záznam bol upravený." at once, as the note says.
10. **FE-12 (a)(b)** — verified: all batches registered at the click and ended on answer or in `finally`; a re-read only
    for assets read while a save was on its way, not for a row taken out (`Q:594-601`), keeps typed rows
    (`queueRowTakesAnswer`). One GET per asset, as the note says.
11. **A3** — verified, same rule as the library's fake (`common-admin/src/domains/dam/__tests__/support/fakeDam.ts:264-265`);
    no other `validateStatus` workaround left under `src/test`.
12. **GC** — L5.
13. **Modified clicks** — verified: `ATableEditButton` declares no emits, so the parent's `@click.stop=""` falls through
    to its `VBtn` link (`LIB/domains/ui/buttons/table/components/ATableEditButton.vue_vue_type_script_setup_true_lang.js`);
    the router ignores modified clicks. `CL` wording for Alt: L7.
15. **`fileMissing`** — verified: the library still compares texts (`LIB/domains/dam/uploadQueue/presets/queuePresets.js`,
    `onClientFailure`), an own text is the only admin-dam-side way; `giveUpOnMissing` raises no alert (`uploadSettle.js:205-206`).
16. **`reset()`** — verified; no caller outside tests.
17. **`onRowFinal`** — verified: a server failure always carries a reason other than `none`
    (`B/Domain/AssetFile/AssetFileStatusManager.php:100-113`, `B/Domain/AssetFile/AbstractAssetFileStatusFacade.php:237-250`),
    client failures and give-ups carry `none`; `uploadedAssetId ?? assetId` is the slot's asset for slot rows
    (`uploadSettle.js:40-42`, policy `markDuplicate`, `Q:101-106`). L1.

## Tests, bends, check

- New cases 32 (4+2+2+2+2+2+5+3+3+6+1) as the note says. On the snapshot: `d3-old1.log` 39 red in 15 files, then
  `d3-old2.log` 10 red in 2 files (the reworked panel and queue-report files), all for the asserted behaviour (I read
  the assertion messages: held values, tabs asked, alerts, address); the guard "tells nothing of a file it gave up on"
  is red there only for the old text, as the note says. The A3 case cannot run against the snapshot's fake (test
  support is not swapped); its bend is red.
- Bends: 27, each red on its cases (`bends/vysledok.txt:231-296`); `d3-navrh10-klient` was green first and went red
  after the guard was reworked (`d3-guard-fix.py`) — the process worked.
- Changed existing cases change for brief reasons (FE-29, 157, `fileMissing`, 422 of an operation, `noopener`), except
  `externalProviderNewTab` "makes no asset when the browser gives no tab", which encodes the product decision of
  point 4 (see above).
- Full check: tests 145/2 049 green (`vysledky/OP13-D3-testy.log`), linters and build green (`OP13-D3-linty.log`). The 8
  "Composable can't be used without properly configured common admin" lines in `bulkSaveChanges.test.ts` are also in
  the OP13-D2-c3 run (not new).

## Outside the step

Nothing new of substance. Checked and fine: `logoutUser` leaves by `window.location` (`src/domains/system/composables/currentUser.ts:1-3`),
so the new route guards cannot block a sign-out; no Sentry console capture, so the new `console.error` of failed file
requests reaches no report (`src/main.ts:68-75`).

## Verified / inferred / not done

Verified by reading: every file of the patch in the working tree, the library helpers, alerts, settlement and core
listed above, vue-router guard classification, Vuetify back-button handling, happy-dom/vitest environment, backend
controllers and facades cited. Executed: the GC trick on Node 24.15 only. Inferred: the runtime sequences of M1, L1,
L2, L3 (process model), L6; browser behaviour of Alt+click. Not done: tests, builds, browser checks, Node 22/26.
