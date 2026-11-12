# OP15-L1: adversarial review (Claude)

Scope: step OP15-L1 in `/home/volar/projects/anzusystems/common-admin` (branch `next`, base `c29209d4`, uncommitted;
patch `krok5-praca/zaplaty/OP15-L1.diff`, 19 files, 1 220 lines; snapshot `krok5-praca/snap/OP15-L1`). A bare file name
is the one under `src/` of common-admin (each is unique there); files of the admins carry their repository. Read-only,
nothing run; the working tree matches the patch (`git diff --stat HEAD`: the 15 tracked files, plus the 4 new ones).
Read whole: the 7 changed sources, the 3 new test files, `AssetFileInfoPanel.vue`, `ACachedUserChip.vue`,
`defineCached.ts`, `cachedUsers.ts`, `damConfigState.ts`, `damConfigStore.ts`, `extSystemIdForCached.ts`,
`assetDetailStore.ts`, `AssetDetailDialog.vue`, `AssetDetailDialogFrame.vue`, `AssetDetailSidebarMetadata.vue`,
`imageDialogDamAuthors.ts`, `uploadPresets.ts`, `queuePresets.ts`, `damUploadChunkSize.ts`, `AImageWidgetMultiple.vue`;
in parts `ImageWidgetMultipleInner.vue`, `uploadQueueCore.ts`, `uploadQueuesStore.ts`, `assetSelectListActions.ts`,
`AAssetListInner.vue`, `AAssetSelect.vue`, `alerts.ts`, `damImageApi.ts`, Vue's `runtime-core.cjs.prod.js`. Admins:
admin-cms `main.ts` and its widget and picker users; admin-ugc `main.ts`, `ImageWidget.vue`, `ImageWidgetMultiple.vue`,
`AssetList.vue`; admin-dam `main.ts`, `appInitialize.ts`, its `uploadService.ts`, `fileApi.ts`, its test support. Logs:
`pracovne/impl-lib-op12/op15-ohyb-*.log`, `vysledky/OP15-L1-*.log`.

## High

None.

## Medium

### M1. The gallery's "edit asset" still opens the detail under an ext system the store has not loaded (the note's item; strongly related; reachable on the same condition as the step's own second path)

Where: `domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue:517-537`. The read resolves the licence (`:525`),
`beforeShown` writes it into the ref (`:530-532`), nothing is loaded, and the detail is drawn under that ref (`:1049-1055`).

Why it fails: the gallery's root loads custom fields only for the ext system of its upload licence
(`AImageWidgetMultiple.vue:91-94`) and, for the select licences, only the configuration of their ext system (`:90` ->
`damConfigState.ts:306-316`); `getExtSystemByLicence` loads nothing (`damConfigState.ts:328-347`). Under an ext system
without configuration `AssetMetadata`'s setup throws (`AssetMetadata.vue:56-61` -> `damAuthorConfig.ts:16-17`); with the
configuration but without custom fields `AssetCustomMetadataForm.vue:39-41` throws "Custom form elements must be
initialised.".

Scenario (admin-cms `src/domains/cms/gallery/components/GalleryEdit.vue:107-115`, or a gallery of an article): the editor
picks an image from a select licence of a second DAM ext system G without the "copy to licence" switch (off by default,
`AAssetSelect.vue:66,148-159`), saves, reloads the page; "edit asset" of that row: G comes from the root's licence
cache, its configuration is there, its custom fields are not, the metadata panel draws empty. An older image of a
licence of an ext system H that no select licence covers: no metadata at all. These are the two cases the step now
handles for `AImageWidget`/`AImageMediaWidget` (`assetDetailExtSystem.ts:21-24` loads configuration and custom fields
independently), while the changelog says "edit asset ... no longer throws" (`doc/changelog/2.0.0.md:251`) for two of the
three image widgets.

Reachability: the same precondition as the brief's path (b) — images of licences of more than one DAM ext system on one
page. The code cannot tell whether admin-cms has that: its licences come from site-group settings at run time
(admin-cms `src/domains/cms/shared/composables/imageWidgetConfigProvider.ts:31-52`). Ranked Medium because the step
treats path (b) as reachable; if admin-cms's site groups use licences of one DAM ext system only, both are unreachable
and this is Low. admin-ugc: one seeded licence per widget (admin-ugc `src/domains/blog/gallery/components/GalleryEdit.vue:88-89`),
resolved to 4 — not affected.

Fix: in the read of `ImageWidgetMultipleInner.vue:523-527` the three lines of `ImageWidgetInner.vue:779-783`
(`shownUnder = (await getExtSystemByLicence(asset.licence)) ?? imageWidgetUploadConfig.value!.extSystem`,
`await loadAssetDetailExtSystem(damClient, shownUnder, damConfigName)`, `extSystem = shownUnder`; the inner has
`imageWidgetUploadConfig`, `:104-111`). Cases: the gallery as a third root in `imageWidgetRootEditAssetExtSystem.test.ts`,
and one case "configuration there, custom fields not" (the select-licence variant), which no case pins for any widget.

## Low

### L1. The changelog and the note describe the old symptom inexactly for admin-cms

Where: `doc/changelog/2.0.0.md:251` "which left the detail without its asset"; note `impl/OP15-L1.md:28` "namiesto
výnimky ... a prázdneho detailu".

What the old code did: the throw is in the setup of `AssetMetadata` (`AssetMetadata.vue:56-61`) or of
`AssetCustomMetadataForm` (`:39-41`). Vue hands a setup error to the error handler and draws that component as nothing
(`node_modules/@vue/runtime-core/dist/runtime-core.cjs.prod.js:6713-6721,6795`); the toolbar with the title and the
picture are drawn by the frame, outside the sidebar (`AssetDetailDialogFrame.vue:94-171`). In admin-cms (full sidebar)
the old detail showed the asset's title and picture with an empty metadata panel. "Without its asset" fits only the
simple sidebar (admin-ugc, admin-ugc `src/main.ts:69`), whose left side is the region editor, which throws as well
(`AssetDetailDialogFrame.vue:143-150`, `DamAssetImageRoiSelect.vue:42-47`). Inferred from Vue's code: the snapshot cases
stop at their first assertion (`thrown`), before `assetDrawn()` (`op15-ohyb-pred2.log:786-807`).

Fix: "..., which left the detail without its metadata (the picture drew, the metadata panel stayed empty)"; the note
likewise.

### L2. The changelog names the roots only; the fallback and the load are in the inner widget, also under an application's own root

Where: `doc/changelog/2.0.0.md:251-254`. The code of `:253-254` is in `ImageWidgetInner.vue:777-784` and
`ImageMediaWidgetInner.vue:920-927`; the first is public as `AImageWidgetInner` (`lib.ts:74,825`), which admin-ugc mounts
under its own wrapper (admin-ugc `src/domains/blog/image/components/ImageWidget.vue:170-177`). The note mentions
admin-ugc for point 1 only.

Scenario: nothing visible in admin-ugc today — each of its widgets has one licence, seeded with ext system 4 and its
custom fields (admin-ugc `ImageWidget.vue:106-150`; `ArticleEdit.vue:137-138`, `EmbedImageDialog.vue:127-128`,
`RegisterStepsPhoto.vue:63-64`), so the resolution gives 4 and nothing loads. An application with a root of its own
reads the changelog as if its inner widget were unchanged.

Fix: sub-bullets 2 and 3 "... of `AImageWidget`, `AImageMediaWidget` and `AImageWidgetInner` (also under an
application's own root)"; one line in the note: admin-ugc reached, nothing changes there.

## Na neskôr

1. No case pins the variant "configuration loaded, custom fields not" (a select licence of another ext system: the roots
   load only the configuration for those, `AImageWidget.vue:118`, `AImageWidgetMultiple.vue:90`); the helper handles it
   (`assetDetailExtSystem.ts:21-24`), and it is the variant M1's gallery meets first.
2. Closed from its loader and pressed again before the first load answers: the loads go twice (five requests each), and
   when the first then fails its "unknown error" stays over the detail the second opening shows (`assetDetailStore.ts:63-66`
   rethrows for any turn). Theoretical; as a failed asset read of a closed detail today.
3. A configuration the editor may not read (403 on the ext system or its custom fields): the loaders reject `false`
   (`damConfigState.ts:121-124,189-192`), so the detail closes with "unknown error", not the forbidden text; before, it
   showed the picture without metadata. Only with several ext systems.
4. The unresolved-licence fallback shows an asset of another ext system under the widget's: that ext system's custom
   fields, author and keyword searches, and a save sends what the form left (`damAssetApi.ts:316-334`). Only with
   several ext systems and a licence the user cannot read on an asset they can; the brief's choice.
5. A root's write at mount replaces an ext system a pick or a drop of another widget wrote, when that root mounts later
   on the page (admin-cms `src/domains/cms/shared/components/anzutap/nodes/embedImage/components/EmbedImageDialog.vue:118`,
   a root in a dialog); the gallery root did so already (`AImageWidgetMultiple.vue:75`). Only with several ext systems.
6. A failed configuration load is no longer reported to Sentry: the old throw reached Vue's error handler (Sentry's,
   where configured); now `console.error` (`damConfigState.ts:40-42`) and the alert only. Neither the note nor the
   changelog says so.
7. `doc/changelog/2.0.0.md:250` "(another asset, or the same one after a save)": the detail never replaces its asset
   after a save (`AssetDetailSidebarMetadata.vue:73-81`); the same asset comes back with a new last editor only where it
   is read again (the picker's side panel after its detail closed, `assetSelectListActions.ts:253-275`, or a new
   opening). Wording.
8. The note's three items, confirmed: the gallery (M1); a library row refused for unloaded bounds fails without text
   (`queuePresets.ts:41-57` has no `onClientFailure`; `uploadQueueCore.ts:214-217`); `getExtSystemByLicence` remembers no
   refusal (`damConfigState.ts:343-346`).

## Answers to the checks (confirmed by reading)

1. **Point 1, correct and complete.** `AssetMetadata.vue:99-111`: an `immediate` watch of both ids, gated by
   `showFileInfoEnabled` (a plain boolean, `commonAdminCoreDamOptions.ts:101`); `add` skips falsy and cached ids into one
   set (`defineCached.ts:122-146`); the fetch is the cache's debounce (1.5 s, at most 5 s, never rejects, `:288-313`). The
   same cache as the chips (`AssetFileInfoPanel.vue:27` inherits the name `AssetMetadata` provides,
   `damConfigName.ts:14-18`); a chip spins while not loaded and shows `#id` once unresolved (`ACachedUserChip.vue:78-82,108-109`).
   Every detail of the three widgets and of a queue row draws `AssetMetadata` (`AssetDetailSidebarMetadata.vue:115-118`).
   Pickers: `AssetMetadata` is also their side panel (`AAssetSelect.vue:349`, `AAssetSelectMedia.vue:352`,
   `AAssetListInner.vue:374,419`); the click adds the same ids before the asset is set (`assetSelectListActions.ts:211-224`),
   so the watch adds nothing and its fetch joins the same debounce: no extra request, as the note says. admin-dam reaches
   this only through `AAssetSelect` (admin-dam `src/domains/coreDam/asset/components/detail/components/slots/AssetSibling.vue:2`).
   admin-ugc: the panel is off (admin-ugc `src/main.ts:55`), nothing is asked (the UGC case).
2. **Point 2, correct and complete for the two widgets.** The roots write once the licence's configuration is there and
   before the inner can mount, also in the read-only branch (`AImageWidget.vue:93,102-103`, `AImageMediaWidget.vue:98,107-108`),
   as `AImageWidgetMultiple.vue:66,75`; admin-ugc's own wrappers are not reached. Openers: any failure of the licence
   read gives `null` (`damConfigState.ts:328-347`), then the upload licence's ext system, guaranteed at setup
   (`ImageWidgetInner.vue:224-231`). Everything the detail reads of an ext system is its configuration or its custom
   fields (`damAuthorConfig.ts:13-17`, `damKeywordConfig.ts:17-22`, `AssetCustomMetadataForm.vue:37-52`,
   `KeywordRemoteAutocompleteWithCached.vue:92-96`, `AuthorCreateButton.vue:57-61`, `DamAssetImageRoiSelect.vue:42-47`),
   both loaded by the helper with the configuration's client and addresses (`damConfigState.ts:33-38`). The common
   admin-cms case (licence and ext system loaded by the root) asks nothing more and waits for nothing.
3. **Failed, late, closed, pressed again.** A failed load: `open` closes (`assetDetailStore.ts:63-65`), the host is told
   with `null` (`AssetDetailDialog.vue:52-58`), `onAssetDetailClose(null)` returns (`imageDialogDamAuthors.ts:217`), one
   "unknown error" (`alerts.ts:167-170`). A load answering after a close from the loader: `mine !== turn`, no
   `beforeShown`, the ref unchanged (pinned by a case); one failing then is said, as the changelog says. A second press:
   the detail is a fullscreen dialog over the button (`AssetDetailDialogFrame.vue:85-89`); a second opening would
   supersede the first (`assetDetailStore.ts:53`; the race in "na neskôr" 2).
4. **Point 3, correct; it cannot refuse a valid upload in the three admins.** `uploadService.ts:206-209` is the first
   statement of `uploadInit`, before the status, the hash and the start; the core keeps the waiting row from a second
   start (`uploadQueueCore.ts:189,197`) and fails it without tracking (`:205-229`); admin-dam says one "unknown error" per
   reason (`queuePresets.ts:86-98`). The chunk guard (`uploadService.ts:161-162`) is inside the retry loop, before the
   try: it covers a resized retry too; with loaded bounds no chunk is empty (`damUploadChunkSize.ts:16,40-58`). Bounds:
   admin-cms — every upload entry is inside a library root that loads the prv configuration before its inner mounts
   (`AImageWidget.vue:114-128`, `AImageMediaWidget.vue:119-133`, `AImageWidgetMultiple.vue:86-100`); the picker uploads
   only under an injected upload configuration (`AAssetListInner.vue:188-189`), and admin-cms's stand-alone pickers inject
   none (`EmbedAudioDialog.vue:86`, `EmbedVideoDialog.vue:86`, `ArticleWidgetAudio.vue:237`). admin-ugc — its wrappers
   write 1 MiB / 50 MiB before `ready` (`ImageWidget.vue:98-104,151`, `ImageWidgetMultiple.vue:73-79,126`,
   `AssetList.vue:67-73,136`). admin-dam — the router guard awaits `loadDamPrvConfig()` and goes to the error page when it
   fails (admin-dam `src/domains/system/composables/appInitialize.ts:80-98`); its set names `default`
   (`uploadPresets.ts:135-136`); an empty file ('send') makes no chunk (`uploadService.ts:264-268`). No admin calls the
   store's `reset()` (grep). The brief's premise: the chunk request already refused a chunk of no bytes and wrote to
   Sentry (`damImageApi.ts:76-95`; admin-dam sends through the same function, `lib.ts:1527`, admin-dam
   `src/domains/coreDam/asset/api/fileApi.ts:89-100`); four tries over 13 s (1 + 3 + 9 s, `uploadService.ts:26-28,194-197`).
5. **Tests red before for the right reason.** `op15-ohyb-pred1.log:3027-3038,3134-3135`: 4 of 5 red, the chips "spins",
   the UGC control green. `op15-ohyb-pred2.log:751-767,786-807,838,861,884`: 10 of 10 (the root wrote 0; the throw; no
   alert, as nothing was loaded; nothing asked). `op15-ohyb-pred3.log:39-48,116,184,207`: 4 of 5 (`uploadInit` resolved;
   the DAM asked; "max tries exceeded"), the control green. Bends b1 4, b2a 6, b2b 6, b3a 3, b3b 1 red; the runs on the
   final sources green (`op15-ohyb-po-a/b/c.log`: 283, 226, 105). Full check green: 392 files, 5 487 tests; lints green
   (`vysledky/OP15-L1-testy.log:1303-1304`, `vysledky/OP15-L1-linty.log`).
6. **Changelog** `doc/changelog/2.0.0.md:250-255`, under "Fixed" (`:119`): exact but L1, L2 and "na neskôr" 7; `:255`
   is exact for both sides.
7. **What the `default` admins see beyond the note:** nothing visible with one DAM ext system per page; with several,
   "na neskôr" 3-5.

## Verified and inferred

Verified by reading, at the places cited: all of the above; from the logs: the red and bend counts and the full check.
Inferred, not run: what Vue drew for the old detail in a running admin (L1, from Vue's code); what admin-ugc's client
answers for a licence read (L2, no effect either way); whether admin-cms's licences span several DAM ext systems (M1 and
the brief's path (b) depend on it).
