# Verification 17: finding 14, accessible names of the icon-only buttons of admin-dam

Read-only analysis, 18. 10. Code: `admin-dam` at `next` c7f81045 (working tree; `src` clean, only `package.json` and
`yarn.lock` modified), `common-admin` at 38a725cf (`src` clean), installed Vuetify 4.2.6, Vue 3.5.44. Paths: `A/` =
`admin-dam/src/`, `D/` = `admin-dam/src/domains/coreDam/`, `S/` = `admin-dam/src/domains/`, `L/` = `common-admin/src/`,
`V/` = `admin-dam/node_modules/vuetify/lib/components/`. Inferences are marked *(inference)*.

Method: a scanner (`krok5-praca/pracovne/overenie17-14/scan.mjs`, Node with admin-dam's own `vue/compiler-sfc`, reads
templates only) that reproduces three detectors: (a) the library's guard `L/test/a11y/iconButtonNames.test.ts:17-77`,
which is how the night of 7. 10. counted 75 (`podklady/upload/noc/dam-krok1-3.md:70-71`); (b) the app's guard
`A/test/a11y/iconButtonTooltips.test.ts:48-53,96-121`; (c) an extension: the `ABtn*` aliases, `VAppBarNavIcon`, a
`VIcon` bound to a menu activator, icon-only links. It ran on c7f81045 and, through `git show`, on 9818e6b5~1,
9818e6b5, 811075f2, 3d9fff01. Tooltip keys were resolved from the JSON files (`A/locales/{sk,en}/**`,
`L/locales/{sk,en}/**`). I read the context of every row that has a note in the table. No test, build, lint or
browser was run.

## 0. Verdict

- Today **90 icon-only controls in 43 files have no accessible name**. No `.vue` in admin-dam has an `aria-label`,
  `aria-labelledby` or `aria-pressed` at all (grep over `A/**/*.vue`: no hit).
  - **73 in 41 files** by the night's method: 72 `VBtn` (40 files) and 1 clickable `VIcon`. Table 3.1.
  - **17 more that the night's method cannot see**: the hamburger `VAppBarNavIcon` of the layout, and 16 icon-only
    links of the collapsed (rail) main navigation. Table 3.2.
- 75/43 is reproduced exactly on 9818e6b5, the tree of that night. From 75 to 73: two buttons went away with their
  files when the upload moved to the library (811075f2). FE-16 (3d9fff01) added 12 tooltips and no names. Section 2.
- All 72 `VBtn` and the 16 links already have a tooltip with an i18n key. The fix reuses those keys (`:aria-label` =
  the tooltip's `t('…')`, as U8 did). **One new text** is needed, for the hamburger, which has no tooltip. The search
  icon gets its field's existing key `system.mainBar.search`.
- The tooltip text fits as a name everywhere. It does not carry **state** for 17 toggles (the pressed state shows
  only by colour or by the icon), and it has **no row subject** for 12 per-row buttons. Section 4. Two owner
  decisions follow from this. There are two wording notes.
- Extending the guard: the app's guard already finds all 72 `VBtn`. With an `ariaLabel` check it fails on each of
  them. It needs three more detectors to catch the other 18 rows: a clickable `VIcon`, `VAppBarNavIcon`, icon-only
  links. Section 5.
- Library components used by admin-dam: one unnamed control (the calendar icon of `ADatetimePicker`, 24 uses in
  admin-dam). One more has only a weak name (the user menu, named by the initials of the user). Neither counts
  toward the admin-dam fix. Section 6.
- Size: core about 4 h (names, the new text, the guard). Optional about 2 h more (toggle state; related
  non-button controls). Section 7.

## 1. What names a button here, and what does not

| Fact | Where |
|---|---|
| `VBtn` sets no name of its own. With no default slot and an `icon` string it draws only a `VIcon`, and its `text` is dropped. With a default slot it draws the slot | `V/VBtn/VBtn.js:166`, `:205-217`, `:182` (only `aria-busy`) |
| A `VIcon` without a click handler is `aria-hidden="true"`. So an icon-only button has an empty name | `V/VIcon/VIcon.js:54`, `:71-73` |
| A `VIcon` with a click handler becomes `role="button"`, `tabindex="0"`. It has no key handler, and it needs a name of its own | `V/VIcon/VIcon.js:54`, `:71-73` |
| A menu activator also hands an `onClick` to what it is bound to. A `VIcon` bound to it is therefore `role="button"` too | `V/VOverlay/useActivator.js:43`, `:121-122` |
| `VTooltip` gives its activator only `aria-describedby`. Its content sits in an overlay that is rendered while open. **A tooltip with `activator="parent"` is not a name** | `V/VTooltip/VTooltip.js:66-68` |
| `VMenu` gives its activator `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-owns`. It gives no name | `V/VMenu/VMenu.js:171-174` |
| The close icon of a closable `VChip` is named `t(closeLabel)`, by default `$vuetify.close` ("Zatvoriť") | `V/VChip/VChip.js:40-43`, `:133-134` |
| An input's icon with a `click:*` handler is named `$vuetify.input.appendAction` / `prependAction` with the label | `V/VInput/InputIcon.js:29-32` |
| `VAppBarNavIcon` is a `VBtn` with `icon: '$menu'` and nothing else | `V/VAppBar/VAppBarNavIcon.js:5-9`, `:16-18` |
| `ABtnIcon` (and `ABtnPrimary` / `Secondary` / `Tertiary`) are plain aliases of `VBtn` with defaults. They add no name | `L/plugins/commonVuetifyConfig.ts:132-135`, `:141-145` |
| The library's own wrappers are named: `:aria-label="t(buttonT)"` next to a tooltip with the same text | `L/domains/ui/buttons/table/components/ATableDetailButton.vue:50,60-65`; `ATableEditButton.vue:50`; `ATableCopyIdButton.vue:52`; `L/domains/ui/buttons/action/components/AActionDeleteButton.vue:103`; `AActionCloseButtonHistory.vue:50`; `L/domains/ui/buttons/components/ABtnSplit.vue:118` |
| The U8 pattern: `:aria-label="t('<key>')"`, the same key as the button's tooltip | `L/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue:46,55-60`; `UploadQueueItemEditable.vue:339,356`; `UploadQueueDialog.vue:281,310,334`; a clickable `VIcon` named the same way: `L/domains/ui/datetime/components/ADatetimePicker.vue:295-301` |
| U8-L puts the field's name only into the name, where identical buttons sit side by side in one form. The tooltips stay short (owner, 11. 10.) | `L/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue:73,89`; `upload-postup.md:692-694,764-765,1983-1985` |

admin-dam has the locales `sk` and `en` only. `A/locales/xx.ts:1-5` is a stub, and there is no `cs`.

## 2. The 75/43 of the night against today

Counted by the night's method (detector (a); `title` counts as a name there, `L/test/a11y/iconButtonNames.test.ts:35`):

| Tree | Unnamed | Files | What changed |
|---|---|---|---|
| 9818e6b5~1 (before krok 1) | 84 | 47 | |
| 9818e6b5 (krok 1-3, committed 9. 10.; the tree of the night) | **75** | **43** | krok 1 named 9 buttons in 4 files (`dam-krok1-3.md:36-39`) |
| 811075f2 (12. 10. 00:07, the upload on the library's core) | 73 | 41 | −2, files deleted: `D/asset/components/toolbar/AssetToolbarExtSystemLicence.vue:25` (`mdi-chevron-down`) and `D/author/components/AuthorCreateButton.vue:116` (`mdi-plus`; the list now uses the library's `ADamAuthorCreateButton`, `D/author/components/AuthorListView.vue:2,33`). The 9 named buttons left for the library with their files |
| 3d9fff01 (FE-16, 12. 10. 09:07) | 73 | 41 | 12 tooltips in 11 files, no name. Unnamed buttons without any tooltip: 13 → 1 (the `VIcon`, which the tooltip guard does not look at) |
| c7f81045 (today) | **73** | **41** | the same buttons, some lines moved |

`overenie-nalezov.md:39` (12. 10.: "72 `VBtn` in 40 files and 1 clickable icon") is the same 73 in 41 files.

Neither count sees the 17 controls of table 3.2. They were there on the night too: `A/layouts/AppLayoutDrawer.vue` was
last changed on 28. 9. (e577c589), `S/system/components/sidebar/SidebarRail.vue` on 5. 10. (ed0553bc). The night
therefore had 92 by today's method *(inference: same files, same markup)*.

## 3. Inventory

### 3.1 The 73 the night's method counts

Every `VBtn` here has its own `<VTooltip activator="parent">` with the text shown. "Name" = proposed accessible name;
"same key" = `:aria-label="t('<the tooltip's key>')"`. Notes: **T** toggle, its state shows only by colour or icon (4.1);
**R** one per row, tile or slot, the name says nothing of the row (4.2); **M** menu activator (the menu's `aria-*`
attributes come from Vuetify, the name does not); **D** dynamic key (4.3); **W1/W2** wording note (4.4); **K**
`tabindex="-1"`, named but not reachable by keyboard (4.5); **S** the current choice is not shown at all (4.1).

| # | Element (start line) | What | Tooltip today: key, sk / en | Name | Note |
|---|---|---|---|---|---|
| 1 | `D/asset/components/detail/AssetDetailView.vue:176` | `VBtn` `mdi-information-outline` | `coreDam.asset.detail.toggleInfo` "Info karta" / "Toggle info" | same key | T |
| 2 | `D/asset/components/detail/AssetDetailView.vue:194` | `VBtn` `mdi-close` | `common.button.close` "Zatvoriť" / "Close" | same key |  |
| 3 | `D/asset/components/detail/AssetFileDetailView.vue:179` | `VBtn` `mdi-information-outline` | `coreDam.asset.detail.toggleInfo` "Info karta" / "Toggle info" | same key | T |
| 4 | `D/asset/components/detail/components/AssetDetailDialog.vue:191` | `VBtn` `mdi-chevron-left` | `coreDam.asset.list.prev` "Predchádzajúci asset" / "Prev asset" | same key |  |
| 5 | `D/asset/components/detail/components/AssetDetailDialog.vue:208` | `VBtn` `mdi-chevron-right` | `coreDam.asset.list.next` "Nasledujúci asset" / "Next asset" | same key |  |
| 6 | `D/asset/components/detail/components/AssetDetailDialog.vue:241` | `VBtn` `mdi-information-outline` | `coreDam.asset.detail.toggleInfo` "Info karta" / "Toggle info" | same key | T |
| 7 | `D/asset/components/detail/components/AssetDetailDialog.vue:259` | `VBtn` `mdi-close` | `common.button.close` "Zatvoriť" / "Close" | same key |  |
| 8 | `D/asset/components/detail/components/AssetDetailDialogLoader.vue:39` | `VBtn` `mdi-chevron-left` | `coreDam.asset.list.prev` "Predchádzajúci asset" / "Prev asset" | same key |  |
| 9 | `D/asset/components/detail/components/AssetDetailDialogLoader.vue:56` | `VBtn` `mdi-chevron-right` | `coreDam.asset.list.next` "Nasledujúci asset" / "Next asset" | same key |  |
| 10 | `D/asset/components/detail/components/AssetDetailDialogLoader.vue:84` | `VBtn` `mdi-close` | `common.button.close` "Zatvoriť" / "Close" | same key |  |
| 11 | `D/asset/components/detail/components/AssetDownloadButton.vue:81` | `VBtn` `mdi-download` | `common.button.download` "Stiahnuť" / "Download" | same key |  |
| 12 | `D/asset/components/detail/components/DistributionImagePreviewItem.vue:86` | `VBtn` `mdi-checkbox-outline` / `mdi-checkbox-blank-outline` | `coreDam.asset.list.toggleSelect` "Vybrať" / "Toggle select" | same key | T, R |
| 13 | `D/asset/components/detail/components/DistributionImagePreviewItem.vue:112` | `VBtn` `mdi-open-in-new` | `coreDam.asset.list.preview` "Náhľad" / "Preview" | same key | R; a link (`:href`, `target="_blank"`) |
| 14 | `D/asset/components/detail/components/distribution/DistributionYoutubePlaylistSelect.vue:64` | `VBtn` `mdi-refresh` | `common.button.refresh` "Obnoviť" / "Refresh" | same key |  |
| 15 | `D/asset/components/detail/components/slots/AssetSibling.vue:66` | `VBtn` `mdi-trash-can-outline` | `coreDam.asset.slots.actions.remove` "Odstrániť" / "Remove" | same key |  |
| 16 | `D/asset/components/detail/components/slots/AssetSlotListItem.vue:219` | `VBtn` `mdi-dots-horizontal` | `coreDam.asset.slots.actions.slotOptions` "Nastavenia slotu" / "Slot options" | same key | R, M |
| 17 | `D/asset/components/footer/AssetFooterSelected.vue:96` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 18 | `D/asset/components/footer/AssetFooterSelected.vue:114` | `VBtn` `mdi-chevron-up` | `common.system.modal.show` "Zobraziť" / "Show" | same key |  |
| 19 | `D/asset/components/footer/AssetFooterSelectedButtonClear.vue:42` | `VBtn` `mdi-close` | `coreDam.asset.selected.clear` "Vyčistiť" / "Clear" | same key |  |
| 20 | `D/asset/components/footer/AssetFooterSelectedButtonClear.vue:60` | `VBtn` `mdi-close` | `coreDam.asset.selected.cancel` "Zrušiť" / "Cancel" | same key | W2 |
| 21 | `D/asset/components/footer/AssetFooterSelectedFull.vue:182` | `VBtn` `mdi-content-save` | `coreDam.asset.selected.save` "Uložiť a pokračovať" / "Save and continue" | same key |  |
| 22 | `D/asset/components/footer/AssetFooterSelectedFull.vue:203` | `VBtn` `mdi-tag-text-outline` | `coreDam.asset.massOperations.title` "Hromadné operácie" / "Mass operations" | same key | T |
| 23 | `D/asset/components/footer/AssetFooterSelectedFull.vue:221` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 24 | `D/asset/components/footer/AssetFooterUploadOverlay.vue:89` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 25 | `D/asset/components/footer/AssetFooterUploadOverlay.vue:107` | `VBtn` `mdi-chevron-up` | `common.system.modal.show` "Zobraziť" / "Show" | same key |  |
| 26 | `D/asset/components/footer/AssetFooterUploadOverlayFull.vue:179` | `VBtn` `mdi-content-save` | `coreDam.asset.upload.save` "Uložiť a pokračovať" / "Save and continue" | same key |  |
| 27 | `D/asset/components/footer/AssetFooterUploadOverlayFull.vue:206` | `VBtn` `mdi-tag-text-outline` | `coreDam.asset.massOperations.title` "Hromadné operácie" / "Mass operations" | same key | T |
| 28 | `D/asset/components/footer/AssetFooterUploadOverlayFull.vue:224` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 29 | `D/asset/components/footer/AssetFooterUploadSlotsOverlay.vue:103` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 30 | `D/asset/components/footer/AssetFooterUploadSlotsOverlay.vue:121` | `VBtn` `mdi-chevron-up` | `common.system.modal.show` "Zobraziť" / "Show" | same key |  |
| 31 | `D/asset/components/list/AssetListView.vue:220` | `VBtn` `mdi-refresh` | `coreDam.asset.list.refresh` "Znovu načítať zoznam" / "Reload list" | same key |  |
| 32 | `D/asset/components/list/components/AssetListItem.vue:91` | `VBtn` `mdi-checkbox-outline` / `mdi-checkbox-blank-outline` | `coreDam.asset.list.toggleSelect` "Vybrať" / "Toggle select" | same key | T, R |
| 33 | `D/asset/components/list/components/AssetListItem.vue:117` | `VBtn` `mdi-pencil` | `coreDam.asset.list.edit` "Úprava" / "Edit" | same key | R |
| 34 | `D/asset/components/list/components/AssetListSidebarFilter.vue:70` | `VBtn` `mdi-filter-remove-outline` | `common.button.resetFilter` "Zrušiť filter" / "Reset Filter" | same key |  |
| 35 | `D/asset/components/queue/AssetQueueItemList.vue:113` | `VBtn` `mdi-close-circle-outline` | `common.button.cancel` "Zrušiť" / "Cancel" | same key | R |
| 36 | `D/asset/components/toolbar/AssetSearchInput.vue:37` | clickable `VIcon` `mdi-magnify` | none | `system.mainBar.search` "Vyhľadať" / "Search" |  |
| 37 | `D/asset/components/toolbar/AssetToolbarOptions.vue:74` | `VBtn` `mdi-view-grid-plus-outline` | `system.mainBar.options` "Nastavenia" / "Options" | same key | M, W1 |
| 38 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:35` | `VBtn` `mdi-multimedia` | `coreDam.asset.list.allTypes` "Všetky typy" / "All types" | same key |  |
| 39 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:54` | `VBtn` `mdi-image` | `coreDam.asset.assetType.image` "Obrázok" / "Image" | same key | T |
| 40 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:75` | `VBtn` `mdi-video` | `coreDam.asset.assetType.video` "Video" / "Video" | same key | T |
| 41 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:96` | `VBtn` `mdi-music` | `coreDam.asset.assetType.audio` "Audio" / "Audio" | same key | T |
| 42 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:117` | `VBtn` `mdi-note` | `coreDam.asset.assetType.document` "Dokument" / "Document" | same key | T |
| 43 | `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:137` | `VBtn` `mdi-podcast` | `coreDam.asset.filter.inPodcast` "V podcastoch" / "In podcast" | same key | T |
| 44 | `D/distributionCategory/components/DistributionCategoryWidget.vue:81` | `VBtn` `mdi-pencil` | `common.button.edit` "Editovať" / "Edit" | same key |  |
| 45 | `D/distributionCategory/components/DistributionCategoryWidget.vue:123` | `VBtn` `mdi-pencil` | `common.button.edit` "Editovať" / "Edit" | same key |  |
| 46 | `D/extSystem/components/ExtSystemTtsSettingsForm.vue:101` | `VBtn` `mdi-trash-can-outline` | `common.button.clear` "Vymazať" / "Clear" | same key |  |
| 47 | `D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:120` | `VBtn` `mdi-chevron-left` | `coreDam.asset.list.prev` "Predchádzajúci asset" / "Prev asset" | same key |  |
| 48 | `D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:137` | `VBtn` `mdi-chevron-right` | `coreDam.asset.list.next` "Nasledujúci asset" / "Next asset" | same key |  |
| 49 | `D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:163` | `VBtn` `mdi-information-outline` | `coreDam.asset.detail.toggleInfo` "Info karta" / "Toggle info" | same key | T |
| 50 | `D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:181` | `VBtn` `mdi-close` | `common.button.close` "Zatvoriť" / "Close" | same key |  |
| 51 | `D/externalProvider/components/ExternalProviderAssetFooterSelected.vue:108` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 52 | `D/externalProvider/components/ExternalProviderAssetFooterSelected.vue:126` | `VBtn` `mdi-chevron-up` | `common.system.modal.show` "Zobraziť" / "Show" | same key |  |
| 53 | `D/externalProvider/components/ExternalProviderAssetFooterSelectedFull.vue:84` | `VBtn` `mdi-chevron-down` | `common.system.modal.hide` "Skryť" / "Hide" | same key |  |
| 54 | `D/externalProvider/components/ExternalProviderAssetListItem.vue:106` | `VBtn` `mdi-checkbox-outline` / `mdi-checkbox-blank-outline` | `coreDam.asset.list.toggleSelect` "Vybrať" / "Toggle select" | same key | T, R |
| 55 | `D/externalProvider/components/ExternalProviderAssetListItem.vue:132` | `VBtn` `mdi-pencil` | `coreDam.asset.list.edit` "Úprava" / "Edit" | same key | R |
| 56 | `D/externalProvider/components/ExternalProviderAssetListSidebarFilter.vue:54` | `VBtn` `mdi-filter-remove-outline` | `common.button.resetFilter` "Zrušiť filter" / "Reset Filter" | same key |  |
| 57 | `D/externalProvider/components/ExternalProviderAssetListView.vue:152` | `VBtn` `mdi-refresh` | `coreDam.asset.list.refresh` "Znovu načítať zoznam" / "Reload list" | same key |  |
| 58 | `D/externalProvider/components/ExternalProviderAssetQueueItemReadonly.vue:53` | `VBtn` `mdi-trash-can-outline` | `coreDam.asset.selected.remove` "Odobrať z výberu" / "Remove from selection" | same key | R |
| 59 | `D/keyword/components/KeywordCreateButton.vue:107` | `VBtn` `mdi-plus` | `coreDam.keyword.button.add` "Pridať kľúčové slovo" / "Add new keyword" | same key |  |
| 60 | `D/shared/assetFileRoute/components/AssetFileMainRoute.vue:95` | `VBtn` `mdi-dots-vertical` | `common.button.moreOptions` "Ďalšie možnosti" / "More options" | same key | M |
| 61 | `D/shared/assetFileRoute/components/AssetFileRouteChangeBtn.vue:27` | `VBtn` `:icon` (prop, default `mdi-lock-open`) | `t(buttonT)`, default `coreDam.asset.assetFilePublicLink.actions.makePublic` | `t(buttonT)` | D (no caller uses `variant="button"` today) |
| 62 | `D/shared/components/FileUpload.vue:275` | `VBtn` `mdi-plus` | `system.upload.add` "Pridať do nahrávania" / "Add to upload" | same key | K |
| 63 | `D/shared/components/FileUpload.vue:292` | `VBtn` `mdi-plus` | `system.upload.add` "Pridať do nahrávania" / "Add to upload" | same key | K |
| 64 | `D/shared/components/FilterClosestColor.vue:113` | `VBtn` `mdi-close-circle` | `common.button.clear` "Vymazať" / "Clear" | same key |  |
| 65 | `D/shared/components/anzutap/components/AnzutapToolbarItem.vue:27` | `VBtn` `:icon="item.icon"` | `t(item.titleT)`: `system.editor.bold` / `.italic` / `.underline` / `.link` / `.removeLink` | `t(item.titleT)` | D, T (bold, italic, underline) |
| 66 | `D/ttsNarrationRequest/components/TtsNarrationRequestDatatable.vue:157` | `VBtn` `mdi-cancel` | `coreDam.ttsNarrationRequest.button.cancelRequest` "Zrušiť požiadavku" / "Cancel request" | same key | R |
| 67 | `D/voiceFamily/components/VoiceBindingsList.vue:110` | `VBtn` `mdi-pencil` | `coreDam.voice.button.edit` "Upraviť" / "Edit" | same key | R |
| 68 | `D/voiceFamily/components/VoiceBindingsList.vue:126` | `VBtn` `mdi-dots-horizontal` | `common.button.moreOptions` "Ďalšie možnosti" / "More options" | same key | R, M |
| 69 | `S/system/components/GridViewToggle.vue:13` | `VBtn` `mdi-view-compact` | `coreDam.asset.list.gridView.masonry` "Dlaždice" / "Masonry" | same key | S |
| 70 | `S/system/components/GridViewToggle.vue:27` | `VBtn` `mdi-view-grid` | `coreDam.asset.list.gridView.thumbnail` "Mriežka" / "Grid" | same key | S |
| 71 | `S/system/components/GridViewToggle.vue:41` | `VBtn` `mdi-view-headline` | `coreDam.asset.list.gridView.table` "Zoznam" / "List" | same key | S |
| 72 | `S/system/components/MainWrapper.vue:107` | `VBtn` `mdi-tune` | `coreDam.asset.list.filterToggle` "Filtre" / "Toggle filters" | same key | T |
| 73 | `S/system/components/MainWrapper.vue:132` | `VBtn` `mdi-information-outline` | `coreDam.asset.list.infoToggle` "Info karta" / "Toggle info" | same key | T |

### 3.2 Not seen by the night's method

| # | Element | What | Tooltip today | Name | Note |
|---|---|---|---|---|---|
| 74 | `A/layouts/AppLayoutDrawer.vue:61` | `VAppBarNavIcon` (`$menu`), collapses or opens the main drawer (`:19-27`) | none | **new text** (4.4) | toggle: `aria-expanded` (4.1). The file has no `useI18n` yet |
| 75 | `S/system/components/sidebar/SidebarRail.vue:21` | `VListItem :to` `mdi-home` | `sidebar.settings.backToAssets` "Späť na assety" / "Back to assets" | same key | link |
| 76 | `S/system/components/sidebar/SidebarRail.vue:33` | `VListItem :to` `mdi-cog` | `sidebar.settings.settings` "Osobné" / "Personal" | same key | link |
| 77 | `S/system/components/sidebar/SidebarRail.vue:46` | `VListItem :to` `mdi-podcast` | `sidebar.settings.podcasts` "Podcasty" / "Podcasts" | same key | link |
| 78 | `S/system/components/sidebar/SidebarRail.vue:60` | `VListItem :to` `mdi-video-box` | `sidebar.settings.videoShows` "Video relácie" / "Video shows" | same key | link |
| 79 | `S/system/components/sidebar/SidebarRail.vue:74` | `VListItem :to` `mdi-account-multiple` | `sidebar.settings.users` "Používatelia" / "Users" | same key | link |
| 80 | `S/system/components/sidebar/SidebarRail.vue:88` | `VListItem :to` `mdi-television-stop` | `sidebar.settings.extSystems` "Externé systémy" / "External systems" | same key | link |
| 81 | `S/system/components/sidebar/SidebarRail.vue:102` | `VListItem :to` `mdi-account-key` | `sidebar.settings.assetLicences` "Licencie assetov" / "Asset licences" | same key | link |
| 82 | `S/system/components/sidebar/SidebarRail.vue:116` | `VListItem :to` `mdi-account-key` | `sidebar.settings.assetLicenceGroups` "Skupiny licencií assetov" / "Asset licence groups" | same key | link |
| 83 | `S/system/components/sidebar/SidebarRail.vue:130` | `VListItem :to` `mdi-account-circle-outline` | `sidebar.settings.authors` "Autori" / "Authors" | same key | link |
| 84 | `S/system/components/sidebar/SidebarRail.vue:144` | `VListItem :to` `mdi-file-key-outline` | `sidebar.settings.keywords` "Kľúčové slová" / "Keywords" | same key | link |
| 85 | `S/system/components/sidebar/SidebarRail.vue:158` | `VListItem :to` `mdi-folder-edit` | `sidebar.settings.distributionCategory` "Kategórie distribúcií" / "Distribution categories" | same key | link |
| 86 | `S/system/components/sidebar/SidebarRail.vue:172` | `VListItem :to` `mdi-form-dropdown` | `sidebar.settings.distributionCategorySelect` "Výbery kategórie distribúcií" / "Distribution category selects" | same key | link |
| 87 | `S/system/components/sidebar/SidebarRail.vue:187` | `VListItem :to` `mdi-folder-account-outline` | `sidebar.settings.permissionGroups` "Skupiny oprávnení" / "Permission groups" | same key | link |
| 88 | `S/system/components/sidebar/SidebarRail.vue:201` | `VListItem :to` `mdi-account-edit-outline` | `sidebar.settings.anzuUser` "Oprávnenia používateľov" / "User permissions" | same key | link |
| 89 | `S/system/components/sidebar/SidebarRail.vue:215` | `VListItem :to` `mdi-file-cabinet` | `sidebar.settings.job` "Systémové úlohy" / "System jobs" | same key | link |
| 90 | `S/system/components/sidebar/SidebarRail.vue:229` | `VListItem :to` `mdi-math-log` | `sidebar.settings.log` "Logy" / "Logs" | same key | link |

The rail list is shown instead of the full one while the drawer is collapsed (`A/layouts/AppLayoutDrawer.vue:39-43`).
Every item is a `VListItem` with `:to` and `prepend-icon` and only a tooltip as content. It renders as a link with an
empty name. These are links, not buttons. I count them because they fail in the same way and are fixed with the same
attribute.

### 3.3 Related, not icon-only buttons (not counted)

| Element | Problem | Fix |
|---|---|---|
| `D/asset/components/list/components/AssetTableRowItem.vue:96-99` | `VCheckboxBtn` of a table row with no label: an unnamed checkbox. It selects, as the tile's button #32 does | `:aria-label="t('coreDam.asset.list.toggleSelect')"` (existing key, `A/locales/sk/coreDam/asset.json:101`) |
| `D/shared/components/FilterClosestColor.vue:91-112` | the colour swatches are `div`s with `@click` and `:title="item.name"`: they have a name but no role, no `tabindex`, no key handler, and the chosen state is only the check icon | role, focus, keys and state; markup changes, own small step |
| `D/shared/components/FileUpload.vue:275-276`, `:292-294` (#62, #63) | `tabindex="-1"` on the "+" buttons | out of finding 14; keep as is *(inference: the dropzone is the keyboard path; not verified)* |

## 4. Where the tooltip text does not fit as it is

### 4.1 Toggles: the name is right, the state is missing (17 + the hamburger)

#1, #3, #6, #49 (info panel of the detail views), #72, #73 (filter and info panels, `:active`, `S/system/components/MainWrapper.vue:108,133`),
#39-#43 (type filters, `:active`, `D/asset/components/toolbar/AssetToolbarTypeFilters.vue:13-31`), #12, #32, #54 (select a tile,
state only by the checkbox icon, `D/asset/components/list/components/AssetListItem.vue:99-108`), #22, #27 (mass operations panel,
`:color="massOperations ? …"`, `D/asset/components/footer/AssetFooterSelectedFull.vue:208`), #65 for bold / italic / underline
(`item.active()`, `D/shared/components/anzutap/components/AnzutapToolbarItem.vue:31`, `anzutapToolbar.ts:32,41,50`).
A name such as "Obrázok" with no pressed state does not say whether the image filter is on.
WCAG 4.1.2 asks for the state. Fix: `:aria-pressed="<the same boolean>"` (the hamburger: `aria-expanded`). Neither U8
nor the library does this (`L/domains/dam/uploadQueue/components/UploadQueueDialog.vue:333-342` is the same toggle with a
name only). That is why this is an owner decision (D2). The English names "Toggle info" / "Toggle filters" /
"Toggle select" can stay; with `aria-pressed` they read "Toggle info, toggle button, pressed".
#69-#71 (`S/system/components/GridViewToggle.vue:13-50`) do not even show visually which view is current. A pressed
state there would need `gridView` from `useGridView`. Optional.

### 4.2 Row-dependent buttons (12): recommend the plain key

#12-#13, #32-#33, #54-#55 (tiles: select, edit, preview), #35, #58 (queue cards), #66-#68 (datatable rows), #16 (one per
slot). In the tiles the title is the text just before the buttons (`AssetListItem.vue:87-89`). Precedent: the library's
per-row buttons use plain keys (`UploadQueueItemEditable.vue:339,356`; `ATableDetailButton.vue:50`; `ATableEditButton.vue:50`).
U8-L added the field only where identical buttons sit next to each other in one form. An
`aria-describedby` pointing at the title is not possible: `VTooltip` sets `aria-describedby` on the same button
(`V/VTooltip/VTooltip.js:66-68`). So a subject needs new parameterised texts (about 6 keys × sk, en) *(inference)*.
Recommendation: plain keys now (D3).

### 4.3 Dynamic keys (2)

- #61 `AssetFileRouteChangeBtn.vue:27`: `:aria-label="t(buttonT)"`. The default key exists (`asset.json`
  `assetFilePublicLink.actions.makePublic`, "Nastaviť ako verejné"). Both callers use `variant="listItem"`, which has a
  visible `title` (`D/shared/assetFileRoute/components/AssetFileMainRoute.vue:124-137`; `AssetFileRouteChangeBtn.vue:44-50`). So the
  button variant is unused today.
- #65 `AnzutapToolbarItem.vue:27`: `:aria-label="t(item.titleT)"`. All five keys exist in sk and en
  (`A/locales/sk/system.json:42`, `en/system.json:42`). The app's guard checks only literal `t('…')`
  (`iconButtonTooltips.test.ts:208`), so it checks neither of these two.

### 4.4 Wording

- **New text** for #74 (no tooltip, no fitting key: no "menu" / "navigation" text in `A/locales/sk` or
  `L/locales/sk` except the pagination's `$vuetify` one). Proposal `system.mainBar.mainMenu`: sk "Hlavné menu",
  en "Main menu". The owner confirms the wording (D1).
- #36 search icon: `system.mainBar.search` "Vyhľadať" / "Search" (`A/locales/sk/system.json:51`), the
  placeholder of its own field (`D/asset/components/toolbar/AssetSearchInput.vue:29`). The icon has no key handler (1),
  but Enter in the field submits the form (`AssetToolbarSearch.vue:24`).
- W1 #37: "Nastavenia" / "Options" names the menu of create, podcasts, video shows, licence switch and settings
  (`D/asset/components/toolbar/AssetToolbarOptions.vue:82-130`). It fits loosely. I recommend keeping it.
- W2 #20: the normal variant says "Zrušiť" / "Cancel", the small one "Vyčistiť" / "Clear" (#19), for the same
  action: both open the same "clear the selection" question (`D/asset/components/footer/AssetFooterSelectedButtonClear.vue:24-27,76-106`).
  I recommend keeping the name equal to the tooltip, so nothing visible changes. The alternative is to change the
  tooltip and the name together to `coreDam.asset.selected.clear`.

### 4.5 Fits, with notes

The rest fit as they are. #17/#18 and the other "Skryť" / "Zobraziť" pairs sit in a toolbar whose visible title
says which panel it is ("Vybrané súbory: N", `D/asset/components/footer/AssetFooterSelected.vue:75`). #15 "Odstrániť" removes the
sibling link. It sits under the "sibling" title (`D/asset/components/detail/components/slots/AssetSibling.vue:61-80`).
#13 is a link (`:href`, `target="_blank"`, `D/asset/components/detail/components/DistributionImagePreviewItem.vue:112-134`); the name
is the same.

## 5. The guard test

### 5.1 What it does today

`A/test/a11y/iconButtonTooltips.test.ts` parses every `A/**/*.vue` (`:13-16`). It collects a `VBtn` with no
content of its own and no shown `text` (`:107`, `:29-36`, `:48-53`), finds its tooltip (`:55-88`), and asserts a
tooltip (`:201-203`) whose literal keys resolve in sk and en (`:205-214`). It says that it does not ask for a name
(`:9-11`). My replica (detector (b)) finds exactly the 72 `VBtn` of table 3.1. `iconButtonNames.test.ts` checks
names, but only in 3 queue wrappers, which have no buttons left (`:15-22`, `:93-96`).

### 5.2 How to extend it (one file, fold `iconButtonNames.test.ts` into it)

1. `ariaLabel(el)` from `iconButtonNames.test.ts:36-51` (and `SIMPLE_EXPRESSION: 4` in `NodeTypes`, `:28`). Also accept
   `aria-labelledby`. Do not accept `title` (the library does, `L/test/a11y/iconButtonNames.test.ts:35`): it is a
   second, native tooltip next to `VTooltip`.
2. Buttons: `BUTTONS = new Set(['VBtn', 'ABtnIcon', 'ABtnPrimary', 'ABtnSecondary', 'ABtnTertiary', 'VAppBarNavIcon'])`
   instead of `node.tag === 'VBtn'` at `:107`. `VAppBarNavIcon` counts as icon-only always (`VAppBarNavIcon.js:5-9`).
3. A clickable `VIcon` outside a button: `@click` with any modifiers, or a `v-bind` of the props of a `VMenu` /
   `VDialog` activator slot (reuse `activatorSlot` / `slotPropsName` / `bindsSlotProps`, `:68-88`, for those parents).
   Track "inside a button" as the library does (`L/test/a11y/iconButtonNames.test.ts:59-75`).
4. Icon-only links: a `VListItem` with `to` / `href` / `link` / `@click`, no `title` / `subtitle`, and no text content
   other than overlays and icons.
5. Cases:
   - "all have an accessible name": `buttons.filter((b) => !b.label)` is `[]`. Today it is red with the 90 rows of
     section 3.
   - "are named by a text the app has in sk / en": as `iconButtonNames.test.ts:115-123`. A label must be
     `t('<key>')` or `t('<key>', {…})`. The two dynamic labels (#61, #65) are an explicit list. For them, assert that
     the default `buttonT` and every `titleT` of `anzutapToolbar.ts` resolve.
   - "are named by what their tooltip says": as `iconButtonNames.test.ts:125-151`, matching both `{{ label }}` and
     `:text="label"` (#65 uses the second). An explicit list holds intended differences (none, unless D3 changes).
   - optional, with D2: the toggles of 4.1 carry `aria-pressed`, a list by file.
   - detector cases, as `:133-194`: `<VIcon @click>`, `<VIcon v-bind="props">` in a menu activator,
     `<VAppBarNavIcon>`, `<ABtnTertiary icon="mdi-x" />`, an icon-only `VListItem :to`; static, bound and
     `aria-labelledby` names; a `VListItem` with `title` is not icon-only.
6. Bends to show it bites: drop one `aria-label` (the row comes back red), add an unnamed `VIcon @click`, point
   one label at a missing key.

Would it catch every row? #1-#35 and #37-#73: yes, with point 1 alone, because the guard already collects them.
#36: only with point 3. #74: only with point 2. #75-#90: only with point 4. The controls of 3.3: no.

### 5.3 Blind spots that remain

- Buttons that library components render (section 6). The library's guard covers them, with its own gaps.
- A child component counts as content (`:29-36`). An icon-only button whose only child is a component that draws
  an icon passes as "has text". There is none in admin-dam today. The library's user menu is such a case (6).
- A `v-bind="object"` may carry an `aria-label` the parser cannot see. Today the only one is a menu's
  `activatorProps` (`AssetFileMainRoute.vue:95`), which carries none.
- Runtime emptiness: a label such as `cond ? t(a) : undefined` passes a presence check. Requiring the `t('…')`
  shape closes most of it.
- Clickable non-buttons (`div @click`, an unlabeled `VCheckboxBtn`), buttons in render functions (none:
  no `h(VBtn` or `createVNode` in `A/**/*.ts`), `tabindex="-1"`, the same name twice in one view.
- Controls whose names Vuetify generates (chip close, input icons, data-table footer). They are named, so this is
  acceptable.

## 6. Library components admin-dam uses (out of admin-dam's control, not counted)

My scan over `L/**/*.vue` with detectors (a) and (c): the library's guard flags only `L/playground/copyTextView/CopyTextView.vue:37`.
It excludes the playground (`L/test/a11y/iconButtonNames.test.ts:8`). The extension finds:

| Where | What | Used by admin-dam | Fix (in the library) |
|---|---|---|---|
| `L/domains/ui/datetime/components/ADatetimePicker.vue:310-316` | the calendar `VIcon` is bound to the menu's activator props, so it is `role="button"` (1). It has **no name**. The library's guard checks only `@click` (`iconButtonNames.test.ts:70`) | through `AFormDatetimePicker` (`L/domains/form/components/AFormDatetimePicker.vue:158`), 24 uses, e.g. `D/podcast/components/PodcastCreateButton.vue:122`, `D/videoShowEpisode/components/VideoShowEpisodeEditForm.vue:68`, `D/job/components/JobCreateFormSynchronizeImageChanged.vue:80,88` | `:aria-label="t('$vuetify.datePicker.title')"`, an existing text: "Vybrať dátum" / "Select date" / "Vybrat datum" (`L/locales/sk/vuetify.json:61`, `en:61`, `cs:61`); plus the activator case in the library's guard |
| `L/domains/ui/components/ACurrentUserDropdown.vue:25-40` | the button's content is `AAnzuUserAvatar`, so its name is the user's **initials** (`L/domains/ui/components/AAnzuUserAvatar.vue:31-37,51`). The tooltip "Účet" is not the name | `S/system/components/CurrentUserDropdown.vue:20` (the rail's bottom, `SidebarAppendRail.vue:7`) | `:aria-label="t('common.system.currentUser.button')"` (`L/locales/sk/common/system.json:32`). admin-dam could pass it through attribute fallthrough (the component has a single root `VBtn`). I recommend not to: the fix belongs in the library |
| `L/domains/cached/components/ACachedChip.vue:114,144`, `L/domains/filters/components/FiltersSelected.vue:79`, `L/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue:369`, `AFormRemoteAutocomplete.vue:472` | closable chips without `close-label`: named "Zatvoriť" / "Close" by Vuetify (`V/VChip/VChip.js:40-43,133-134`) where the action is "remove" | yes (`ACachedChip` 16, `AFormRemoteAutocomplete` 15, `FiltersSelected` 3 uses) | wording only, low; as was done for finding 67 (`AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:48`) |

All other library wrappers that admin-dam uses (`ATable*`, `AAction*`, `ADialogToolbar`, `ADatatablePagination`,
`ADatatableConfigButton`, `ACopyText`, the upload queue) are named by `aria-label` (detector (a) is clean outside the
playground).

## 7. Implementation proposal

### 7.1 Pattern (as U8)

```vue
<VBtn
  v-if="…"
  :aria-label="t('common.button.close')"
  icon
  variant="text"
  @click.stop="closeDialog"
>
  <VIcon icon="mdi-close" />
  <VTooltip activator="parent" location="bottom">
    {{ t('common.button.close') }}
  </VTooltip>
</VBtn>
```

- The key is the one the button's tooltip already shows. The same goes for the rail links
  (`<VListItem :aria-label="t('sidebar.settings.podcasts')" …>`) and for the search `VIcon` (as `ADatetimePicker.vue:299`).
  The hamburger: `:aria-label="t('system.mainBar.mainMenu')"`, plus `useI18n` in `AppLayoutDrawer.vue`.
- Put `:aria-label` after `v-if` / `v-show` / `v-for`. `vue/attributes-order` comes from `flat/recommended`
  (`L/eslint/adminConfig.mjs:118`).
- I recommend against a new wrapper component: it would rewrite 72 templates, and the library has none either.
  `ABtnIcon` is only an alias (1) and cannot add a name.

### 7.2 i18n

- Core: **1 new key**, sk and en (admin-dam has no cs): `system.mainBar.mainMenu`, wording D1.
- Everything else reuses existing keys (sections 3.1, 3.2, 4.4).
- Only if D3 = yes: about 6 parameterised keys × 2 languages.

### 7.3 Steps and sizes

| Step | What | Size |
|---|---|---|
| A11Y-1 | `:aria-label` on #1-#90 (90 attributes, 43 files), the new key, `useI18n` in the layout | 2 h |
| A11Y-2 | the guard as in 5.2, `iconButtonNames.test.ts` folded in, bends | 2 h |
| A11Y-3 (D2) | `aria-pressed` on the 17 toggles of 4.1, `aria-expanded` on #74, one guard case. Optional: the current view on #69-#71 | 1 h |
| A11Y-4 (optional) | 3.3: name of the table-row checkbox (5 min); the colour swatches as real buttons (role, focus, keys, state) | 1 h |
| LIB (separate) | the two library items of section 6 and the activator case in the library's guard | 1 h + CK-LIB |

Core A11Y-1 + A11Y-2: about 4 h, then CK-DAM (lint, `vue-tsc`, unit tests with `VITEST_MAX_WORKERS=2`, build: one
heavy run at a time, `free -m` first). The split by step is for review. One commit is fine.

### 7.4 Risks

- **e2e by name** (Playwright matches a substring, case-insensitive, unless `exact`). No e2e was run. I checked
  every `getByRole('button' | 'link', { name })` with a literal name in `admin-dam/e2e` and `A/test` against the new names:
  - `admin-dam/e2e/pages/assets/assetBulkEditPage.ts:118` (`'Hromadné operácie'` in the footer) has nothing to match
    today. *(inference: it passes only through the early return at `:117`)*. After A11Y-1 it finds #22. This is a
    behaviour change of the e2e path, in the intended direction.
  - `admin-dam/e2e/pages/assets/assetListFilterPage.ts:149` and `externalProviderPage.ts:34` (`'Hľadať'`) are a
    substring of the new "Vyhľadať" (#36). They are scoped to `nav.v-navigation-drawer`, and the search sits in the
    app bar (`D/asset/components/list/AssetListView.vue:203-205`), so there is no clash. I recommend `exact: true`
    there anyway.
  - `distributionPage.ts:99` (`'Zrušiť'`, scoped to the dialog), `assetBulkEditPage.ts:110` (`'Upraviť'`), `:200`
    (`'Vyčistiť'`, scoped to the sidebar) and `assetSlotsPage.ts:241` (`'Pridať'`, scoped to the twin row) match new
    names only outside their scope.
  - Most e2e locators select icon buttons by the icon's class (e.g. `assetBulkEditPage.ts:221,258`,
    `appsMenu.ts:4`, `assetListFilterPage.ts:52`). These are unaffected.
- **Unit tests**: none selects these buttons by role or name (grep for `getByRole` / `aria-label` in `A/**/*.test.ts`:
  only queue, mass operations, upload stop and a11y tests, about library components). `iconButtonTooltips.test.ts` stays green after
  A11Y-1, and `iconButtonNames.test.ts:93-96` (0 buttons) too.
- **Double reading**: on focus the tooltip opens and describes the button with the same text, so a screen reader
  may say "Zatvoriť … Zatvoriť". The library's pattern has the same effect (`UploadQueueButtonStop.vue:46,55-60`).
  I recommend accepting it.
- **Drift** between name and tooltip (two copies of one key): the guard case "named by what their tooltip says"
  catches it.
- Nothing changes visibly in the core steps (the only visible option is W2).

## 8. Owner decisions

- **D1** wording of the one new text (the hamburger, #74): proposal sk "Hlavné menu", en "Main menu".
- **D2** toggles: name only, as U8 and the library do, or also `aria-pressed` / `aria-expanded` (A11Y-3, +1 h).
  Recommendation: yes. Without the state the type filters and the select buttons do not say whether they are on.
- **D3** row buttons: plain key (recommended, as the library's per-row buttons), or a name with the row's subject (new
  texts).
- W2 (#20 "Zrušiť" vs. #19 "Vyčistiť" for the same action) and the rail links (#75-#90, links rather than buttons):
  I would keep W2 as it is and include the links. They need a nod only if the owner reads "button" strictly.
