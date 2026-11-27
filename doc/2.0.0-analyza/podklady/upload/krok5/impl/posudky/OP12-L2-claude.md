# OP12-L2 — review (Claude, adversarial)

Scope: `krok5-praca/zaplaty/OP12-L2.diff` (20 files) on `next` after OP12-L1; brief `zadanie-OP12-L2.md` with the 19 Oct addendum; note `impl/OP12-L2.md`. Read-only. No test was run: every claim below comes from reading the file and line cited. The suite numbers in the note (342 files, 5 034 cases) are not re-checked.

## Answers to the four checks

### 1. Correctness: names, chips, visuals — confirmed
- **Calendar icon** (`src/domains/ui/datetime/components/ADatetimePicker.vue:311-317`). The menu's activator props hold `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-owns` and `onKeydown` (`node_modules/vuetify/lib/components/VMenu/VMenu.js:170-176`), plus `ref` and the click events (`VOverlay/VOverlay.js:337-342`). They hold no `aria-label`, so the label placed before `v-bind="menuProps"` is not overwritten. `VIcon` renders `role="button"`, `aria-hidden=false` and `tabindex=0` when `attrs.onClick` is set (`VIcon/VIcon.js:54,71-73`). The mdi class icon (`composables/icons.js:70-80`, `VClassIcon`, attrs inherited) puts `aria-label` on the `<i>`.
- **`ACurrentUserDropdown.vue:29`**: `VBtn` has no `inheritAttrs: false`, so the label lands on the `<button>`. Before, the button's name was the initials text of `AAnzuUserAvatar.vue:47-52`.
- **Chips.** The close `<button>` gets `aria-label = t(closeLabel)`, default `$vuetify.close` (`VChip/VChip.js:40-43,133-142,274-279`). `t` is the vue-i18n adapter's `i18n.global.t` (`vuetify/lib/locale/adapters/vue-i18n.js`, `src/plugins/commonVuetifyConfig.ts:167-178`). All six admins build their Vuetify with `createAnzuVuetify`. They also take the library's `common` whole (admin-dam `src/locales/sk.ts:38`, admin-cms `src/locales/sk.ts:161-165`), so `common.button.remove` resolves. `src/test/i18nLiteralKeys.test.ts:29-30` already checks `close-label` literals in en/sk/cs.
- **`AAnzuUserRoleAutocomplete.vue:45-67`** works as before. In Vuetify 4.2.6, without a slot the chip is `VChip {closable: closableChips, size: chipDefaults?.size ?? 'small', text: item.title, disabled: item.props.disabled, ...slotProps}` (`VAutocomplete.js:636-641`). With the slot, the slot content is wrapped in a renderless `VDefaultsProvider` that gives `VChip` the same `closable`/`size`/`text` (`:642-652`, `VDefaultsProvider.js`). `v-bind="chipProps"` passes the same `onClick:close` → `select(item, false)`, the Enter/Space `onKeydown`, `onMousedown` and `modelValue: true` (`:600-619`). `closableChips` already excludes readonly and disabled on both paths (`:120`). The wrapper div that shows the keyboard-selected colour belongs to Vuetify on both (`:632-635`). Result: same DOM, size, colour, readonly behaviour, removal and keys. The other chip-slot edits only add `close-label`. Nothing else visible changed.
- **No closable library chip that removes still says "Zatvoriť".** Only the listed chips are closable by default. The author-conflict chip keeps "Pridať autora" (`AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:44-48`). A grep of the six admins found:
  - no `closable` passed to `AChipNoLink`;
  - no `closable-chips` passed to `AFilterRemoteAutocomplete`, to the cached author/keyword chips' autocompletes or to the library selects with `chips`;
  - no e2e or unit test that finds a chip's close by its name (they use `data-testid="close-chip"` or `.v-chip__close`: admin-cms `e2e/pages/system/locationPage.ts:26`, `articleTemplatePage.ts:404`; admin-dam `src/test/queue/queueRowKeywordsAuthors.test.ts:221`).

### 2. Finding 18 — confirmed, with the additions below
- **Pinia** (`node_modules/pinia/dist/pinia.js:1349-1361`). The first `useStore` call for an id creates the store from its own setup. Every later call with that id gets that instance from `_s.get(id)`, whatever its own definition. The library store now has all twelve members of admin-dam's, and `reset()` does the same (`src/domains/dam/cropper/store/imageRoiStore.ts:13-66` vs admin-dam `src/domains/coreDam/asset/store/imageRoiStore.ts:7-60`). `RegionOfInterest` is identical field by field (`src/domains/dam/types/Roi.ts` vs admin-dam `coreDam/asset/types/Roi.ts`).
- **admin-cms, admin-ugc (and blog, forum, inhouse)**:
  - none of them uses `useImageRoiStore`, the cropper, the ROI select or the id string in `src`;
  - none of the store ids defined in the six admins equals a library id (only admin-dam's `damImageRoiStore` did);
  - no Pinia plugin is keyed by store id (no persisted state);
  - they reach the store only through library components (`AssetDetailDialogFrame.vue:143-146`, `AssetDetailSidebarFrame.vue:93-97`), which all import the one definition.
  So the rename is safe for them.
- **HMR.** `imageRoiStore.ts:68-70` still accepts updates with the renamed definition. `acceptHMRUpdate` compares the new module's `$id` with the first one (`pinia.js:925-951`), so a rename during a running library dev session at worst leaves a stale store until reload. The built library has no HMR code (admin-dam's copy, `node_modules/@anzusystems/common-admin/dist/domains/dam/cropper/store/imageRoiStore.js`), so the admins see nothing of it.
- **Today's bug is real, and admin-dam's own e2e already records it.**
  - admin-dam imports the eager component (`dist/common-admin.js:224` → `DamAssetImageRoiSelect.js`), which calls the store in setup (`DamAssetImageRoiSelect.vue_vue_type_script_setup_true_lang.js:32`).
  - `activeTab` is one module-level ref (`assetDetailTab.ts:17`). A tab click in the sidebar's `VTabs` (`AssetDetailDialogSidebar.vue:82-84`) queues the render jobs of the page and of the sidebar.
  - Vue keeps the queue sorted by job id, which is the component uid (`@vue/runtime-core/dist/runtime-core.cjs.js:288-316,941`). So the page (the parent, with the smaller uid) patches first. It mounts `ADamAssetImageRoiSelect` in the left pane (`AssetDetailView.vue:221-224`; the same in `AssetDetailDialog.vue:288-291` and `AssetFileDetailView.vue:207-210`). Only then does the sidebar's own job mount admin-dam's panel (`AssetDetailDialogSidebar.vue:163-168`). Even within a single patch, the left pane comes first in the template.
  - Stores are never disposed at run time (`$dispose` appears only in tests). So the 8-member store made from the library's definition (admin-dam's current copy: id `damImageRoiStore`, no timestamps) stays for the whole session.
  - Effects:
    - `AssetDetailSidebarROI.vue:86` (reload previews) throws `forceReloadRoiPreviews is not a function`;
    - `:52` (after a rotation) and `:63` (after a slot change) throw after `loadRois()`, as an unhandled rejection;
    - after a rotation the previews keep `?timestamp=undefined`, so they stay the cached pre-rotation images;
    - the slot change is emitted only when the user changes the slot (`AssetDetailSlotSelect.vue:57-64`).
  - admin-dam's e2e pins exactly this bug: `e2e/tests/assets/assetRoi.spec.ts:83-94`, `test.fail() // DAM-B6: the handler throws and the previews never reload` (see finding 1).
  - A condition the note and the changelog leave out: `can(ACL.DAM_REGION_OF_INTEREST_UPDATE)` (`AssetDetailView.vue:221`). A user without that permission sees `ADamAssetImage` in the left pane, admin-dam's definition creates the store, and nothing throws.
- **What breaks between the copy and OP12-D2.** Situation: the L2 library is in admin-dam and admin-dam is unchanged.
  - admin-dam's panel creates `damImageRoiStore` from its own complete definition, so reload, rotation and slot change work.
  - `ADamAssetImageRoiSelect` reads `commonAdminDamImageRoiStore`, which nothing in admin-dam fills. With `imageFile` null and `loader` false the component renders nothing at all (`DamAssetImageRoiSelect.vue:97-131`): no spinner, no image, no cropper.
  - So for every user with `DAM_REGION_OF_INTEREST_UPDATE`, in all three detail views, the left pane of the ROI tab is empty and the region cannot be edited.
  - Nothing reports it:
    - admin-dam compiles (its imports are unchanged; `useDamImageRoiStore` is unused);
    - no admin-dam unit test touches the ROI tab (grep of `src/**/*.test.ts`);
    - the e2e spec does not look at the cropper.
  - The one thing that turns red is DAM-B6 (finding 1).
  - The library's own detail (through `AAssetSelect`) is unaffected.
  - The reverse order (D2 on the old library copy) fails to compile on the missing export, so it would be noticed at once.

### 3. Tests
By reading, the new cases are red on the snapshot code as the note says:
- the snapshot's id lets `useOwnOfAnAdmin()` take the library's place;
- the snapshot store has no timestamps;
- the snapshot `lib` has no `useDamImageRoiStore`;
- the snapshot components have no names and give "Zatvoriť";
- the guard flags `ADatetimePicker.vue:311` and the nine chips.

The guard extensions catch what they claim. Gaps are in finding 7.

### 4. Changelog and note
Findings 2, 3, 4, 5 and 6. Answer to "is the store-id change a 'Changed — migrating an admin' item?": yes (finding 3).

## Findings

### 1. Medium — admin-dam's e2e pins the bug as expected to fail; copying this library makes it red, and no step owns that
- **Where**: admin-dam `e2e/tests/assets/assetRoi.spec.ts:83-94` (`test.fail() // DAM-B6 …`, title tagged `@bug`). The OP12-D2 brief, `krok5-praca/zadania/zadanie-OP12-D2.md:11`, says "Never touch … `e2e/`".
- **Scenario**:
  1. The leader copies the library with OP12-L2 into admin-dam (the D2 brief assumes this copy, `:11`).
  2. From then on the reload works: before D2 because admin-dam's own complete store no longer collides with the library's; after D2 because the one shared store has the member.
  3. The spec's body passes, and Playwright reports "expected to fail, but passed". The admin-dam e2e run is red (`e2e/playwright.config.ts` and the e2e README do not filter `@bug`).
  4. D2 may not edit `e2e/`. The note and the changelog do not mention DAM-B6. The `KNOWN-BUGS.md` the comment points to is not in the admin-dam tree.
- **Fix**:
  - When D2 lands, the leader or owner drops `test.fail()` and the `@bug` tag at `assetRoi.spec.ts:83-85` and closes DAM-B6 wherever that list lives.
  - Cite DAM-B6 in the note (part 3) and in the Fixed entry (`doc/changelog/2.0.0.md:207`). The trace is then no longer only "odvodené" (note `:65`): admin-dam's e2e observed it.

### 2. Medium — `timestampCropper` / `forceReloadCropper()` are documented as redrawing the cropper, but nothing reads `timestampCropper`
- **Where**:
  - the Added entry, `doc/changelog/2.0.0.md:107`: "which take a new time for an admin to draw the cropper and the previews of the regions anew (after a rotation, another slot)";
  - the JSDoc, `src/domains/dam/cropper/store/imageRoiStore.ts:10-11`, says the same.
  - The code does otherwise. `ADamAssetImageRoiSelect` takes the image URL and the `ACropper` key from `imageFile.manipulatedAt` (`DamAssetImageRoiSelect.vue:49-54,116-118`). A grep finds no component, in the library or in admin-dam, that reads `timestampCropper`; it is only set (admin-dam `AssetDetailSidebarROI.vue:53,64`).
- **Scenario**:
  1. After D2, an editor rotates the image in admin-dam's ROI tab.
  2. `afterRotate` (`AssetDetailSidebarROI.vue:50-54`) reloads the regions and calls `forceReloadCropper()`.
  3. The loader toggle remounts `ACropper`, but `imageFile` was never read again after the rotation. The cropper keeps the old `?manipulated=` URL and the old width and height (`DamAssetImageRoiSelect.vue:59-63`).
  4. An admin following the changelog calls `forceReloadCropper()` and gets no redraw from it.

  The behaviour is pre-existing in admin-dam. The new text, however, promises a mechanism that does not exist, which PRAVIDLA rule 5 forbids ("a sentence … must say exactly what the code does").
- **Fix**:
  - Write what the code does: "`timestampCropper` is not read by `ADamAssetImageRoiSelect`, which redraws when `imageFile` changes; after a rotation, set the file read again (`setImageFile`)". Keep the member for admin-dam's sake.
  - Tell OP12-D2: if the cropper is to show the rotated image, `afterRotate` reads the file again (`fetchImageFile` + `setImageFile`).
  - Keying the cropper on the timestamp as well would be a visible change: the owner's decision, not this step's.

### 3. Low — the store-id change belongs in "Changed — migrating an admin" (answer to check 4: yes)
- **Where**: the section intro, `doc/changelog/2.0.0.md:34`: "All six admins are migrated in their working trees; the list is what another consumer has to do". The migration sentence instead sits at the end of the Added entry (`:107`). The note gives its reason at `OP12-L2.md:99-101`.
- **Scenario**:
  - A consumer that, like admin-dam, defined its own store under `damImageRoiStore` to feed `ADamAssetImageRoiSelect` upgrades and reads the migration list. Nothing there tells it to switch, and the result is an empty ROI pane with no error (check 2, "What breaks").
  - Until D2 lands, `:34` is also untrue for admin-dam.
  - The precedent at `:26` (the list stores renamed to `commonAdmin…`, under Packaging) needed nothing from a consumer; this rename does.
- **Fix**:
  - Add one line under "Changed — migrating an admin": "The store `ADamAssetImageRoiSelect` reads is `useDamImageRoiStore` (Pinia id `commonAdminDamImageRoiStore`, was `damImageRoiStore`). An admin that defined its own store under the old id to fill it fills the exported store instead; with its own, the region editor stays empty."
  - Keep the Added entry for the export.
  - In the Fixed entry (`:207`), say that the fix takes effect with the admin's switch (admin-dam, OP12-D2).

### 4. Low — `AFilterRemoteAutocomplete`'s chip is named "Remove", but its close would remove nothing
- **Where**:
  - `src/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue:368-384`: no `v-bind="chipProps"` and no `@click:close`. In Vuetify, `onClick:close` is only in the slot props (`VAutocomplete.js:605-606`).
  - The note says "Zatvoriť ho znamená vždy odobrať hodnotu" (`OP12-L2.md:25-27`).
  - The changelog lists it among the chips "that remove a value" (`2.0.0.md:206`).
- **Scenario**:
  1. An admin passes `closable-chips`. It falls through to the root `VAutocomplete` (`:334`), and the chip gets a close button named "Odobrať".
  2. A click sets the chip's own `isActive` to false (`VChip.js:136-141`). The chip disappears, but the filter value stays selected and keeps filtering.

  This is latent: no caller enables `closable-chips` today (grep of the six admins).
- **Fix**: either remove the value on close (`@click:close` as in `AFormRemoteAutocomplete.vue:478`, or bind `chipProps`), which changes behaviour and is the owner's call; or correct the sentence in the note and the changelog and record this as a latent finding.

### 5. Low — the changelog names components an admin cannot import, and leaves one out
- **Where**: `doc/changelog/2.0.0.md:206`.
  - `AAnzuUserRoleAutocomplete` and `AFilterRemoteAutocompleteWithMinimal` are not exported from `src/lib.ts`. The roles field is reached through the exported `AAnzuUserForm` (`lib.ts:732,1476`). The WithMinimal chip is reached through `ADamAuthorFilterRemoteAutocomplete`, which the entry already lists.
  - "(and so of `AFormDatetimePicker`)" leaves out `AFilterDatetimePicker`, which also wraps `ADatetimePicker` (`AFilterDatetimePicker.vue:92`).
- **Fix**:
  - write "the roles field of `AAnzuUserForm`";
  - drop `AFilterRemoteAutocompleteWithMinimal`, or write "inside `ADamAuthorFilterRemoteAutocomplete`";
  - write "of `AFormDatetimePicker` and `AFilterDatetimePicker`".

### 6. Low — the note's trace misses the most-used view, the permission condition and the e2e evidence; one count is off
- **Where**:
  - `OP12-L2.md:54-56` names `AssetDetailView.vue:224` and `AssetFileDetailView.vue:210`, but not `AssetDetailDialog.vue:288-291`, the detail dialog of the asset list, which has the same order.
  - `:60-65` leaves out `can(ACL.DAM_REGION_OF_INTEREST_UPDATE)` (without it, nothing throws) and DAM-B6.
  - `:114-115` says "Zelené sú štyri samotesty a „found the components"". The file has three self-tests (`src/test/a11y/iconButtonNames.test.ts:128,138,157`); three plus "found the components" is the 4 green that "14 z 18" needs.
- **Fix**: add the dialog, the condition and DAM-B6, and write "tri samotesty".

### 7. Low — test gaps
- `src/domains/dam/cropper/__tests__/damImageRoiStore.test.ts:46-57`: both `it.each` rows call the same function (`lib.useDamImageRoiStore === useImageRoiStore`, asserted at `src/test/publicExportsAdded.test.ts:172`). "Whoever asks for it first" therefore cannot fail by order: it is one members test counted twice. The order that mattered (two definitions, one id) can only be reached in admin-dam, which is D2's case.
- `src/test/a11y/libraryControlNames.test.ts:100-146` pins the role chip's name, text and removal. It does not pin the changelog's "look and close as before" (size `small`, no close when `readonly`). Check 1 confirms that claim from Vuetify's source, but no case covers it.
- Blind spots of the guard, none of them hit by today's code:
  - a chip made closable by the slot defaults but drawn by a custom component (`AuthorRemoteAutocompleteCachedAuthorChip.vue:93`, `KeywordRemoteAutocompleteCachedKeywordChip.vue:78`, as the note says);
  - a `VIcon` inside a wrapper element in an activator slot (`iconButtonNames.test.ts:88` resets `clickActivator` for element children);
  - an icon bound to `mergeProps(menuProps, tooltipProps)` in a tooltip activator nested inside a menu activator (`:85`: the parent is `VTooltip`, so it is not counted).
- **Fix (optional)**: keep one row instead of two, and add `size` and `readonly` assertions to the role case.

### 8. Low — outside the step: the calendar "button" now has a name, but Enter and Space do nothing
- **Where**: `ADatetimePicker.vue:311-317`. `VIcon` has no key handler (`VIcon.js`). The overlay activator handles only clicks (`VOverlay/useActivator.js`, no Enter or Space). VMenu's activator `onKeydown` opens the menu only on ArrowDown and ArrowUp (`VMenu.js:130-153`).
- **Scenario**: a keyboard user tabs to the icon, hears "Vybrať dátum, button", presses Enter, and nothing happens. Typing in the field still works. This is pre-existing, but now more noticeable because the control is announced by name.
- **Fix**: report it as a new finding. A fix (for example a `VBtn` activator) would change what the user sees, so it is out of this step.

## Verdict
No High. The code of all four parts does what the brief asks:
- the names reach the rendered elements;
- the role autocomplete's chip slot behaves exactly as Vuetify's own chip;
- the store is complete under its own id and safe for the other five admins.

The bug that part 3 fixes is real and already pinned in admin-dam's e2e (DAM-B6). Before closing:
- assign the DAM-B6 `test.fail()` flip to someone, since D2 may not touch `e2e/` (finding 1);
- correct the `forceReloadCropper` sentence and tell D2 how the cropper redraws after a rotation (finding 2).

Findings 3–7 are wording and coverage.
