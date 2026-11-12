# 7 - Building blocks: asset image, fail reason, custom metadata forms, validation scopes, file picking, floating-panel components, view state

Read-only analysis. Nothing was built, run or changed. Both repos on `next`.

Path prefixes used below:

- `D/` = `/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/`
- `L/` = `/home/volar/projects/anzusystems/common-admin/src/domains/`
- `dam:` = `/home/volar/projects/anzusystems/admin-dam/`
- `lib:` = `/home/volar/projects/anzusystems/common-admin/`
- `be:` = `/home/volar/projects/petit/core-dam/` (a local backend checkout, read only to settle two questions)

Version note: DAM installs the library as `1.47.0-beta.dev-1790143991` (`dam:package.json:41`); the library source read here
is `1.47.0-beta.dev-1790167636` (`lib:package.json:38`). The library was read from its source repo only.

Classes: STRUCTURAL (wiring, DAM-only features), PRODUCT (deliberate UX difference), DRIFT-BUG (one side has a defect
the other does not), DRIFT (same, but nothing a user can see), UNKNOWN.

---

## 1. Result at a glance

| # | DAM file | Verdict | Blocking difference |
|---|---|---|---|
| 1 | `D/asset/components/AssetImage.vue` | CAN BE REPLACED after export | none in the file itself; pulls in pair 2 |
| 2 | `D/asset/components/AssetImageMetaIcons.vue` + `assetImageIconsConfig.ts` + `dam:src/assets/meta-icons/*` | CAN BE REPLACED after the library gains the TTS icon and exports the component | TTS icon (DAM-only feature, pinned by an e2e) |
| 3 | `D/asset/components/AssetFileFailReasonChip.vue` + `D/asset/valueObject/AssetFileFailReason.ts` | CAN BE REPLACED after export (chip and `useAssetFileFailReason`) | none; EN text of one reason differs |
| 4 | `D/shared/components/customMetadata/AssetCustomMetadataForm.vue` | CAN BE REPLACED after export + one line fixed in the library | pinned-count fallback `\|\| 2` vs `?? 0`; default validation scope symbol |
| 5 | `D/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue` | CAN BE REPLACED after export | none (library has two extra `aria-label`s) |
| 6 | `D/shared/validationScopes.ts` | MUST STAY (shrinks) | `DistributionUpdateDtoValidationScopeSymbol` is DAM-only; the other three can become the library's once exported |
| 7a | `D/shared/services/upload/fileValidation.ts` | CAN BE REPLACED after `useFormatAndSizeCheck` is exported | library check is a superset (trim + case) |
| 7b | `D/asset/composables/windowFilesDragWatcher.ts` | CAN BE REPLACED by `useDropzoneGlobalDragState` as it is (already exported) | init is explicit; no `hide` function, but the ref is writable |
| 7c | `D/shared/components/FileUpload.vue` | MUST STAY (full-window dropzone, folder walking); its three button variants could sit on `AFileInput` as it is | folders, texts, colours, e2e class |
| 7d | `D/asset/components/AssetUpload.vue` | MUST STAY | ACL, slots, current ext system, beta limit |
| 8 | `AssetLink.vue`, `AssetQueueItemList.vue`, `AssetQueueSelectedItemSimple.vue`, `AssetQueueSelectedSimple.vue`, `AssetQueueUploadList.vue` | MUST STAY | DAM-only panels; survive a store move with three contract points (section 6) |
| 9 | `assetFooterUpload.ts`, `assetFooterUploadSlots.ts`, `assetFooterSelected.ts`, `externalProviderAssetFooterSelected.ts`, `uploadQueueIds.ts` | MUST STAY | DAM view state; nothing duplicated in the library |

---

## 2. A - differences per pair (every `diff -w` hunk)

### Pair 1 - `AssetImage.vue` (D 316 lines / L 325 lines)

`D/asset/components/AssetImage.vue` vs `L/dam/assetDetail/components/AssetImage.vue`.

| Hunk | DAM | LIB | What the user sees | Class |
|---|---|---|---|---|
| imports | `:2-8` from the package | `:2-14` internal paths | nothing | STRUCTURAL |
| placeholder asset | `placeholder16x9.jpg` `:7` | `placeholder16x9.svg` `:4` | the same picture. It is shown only in the first branch (waiting / uploading / processing) and only when `src` is undefined (`D :108-110, :122-125`; `L :113-115, :127-130`). DAM's JPEG is byte-identical to the one the library used to ship (git blob `ad3f75ce...` for both `dam:src/assets/image/placeholder16x9.jpg` and `e1479025^:src/assets/image/placeholder16x9.jpg`). The library redrew it as SVG in `e1479025 perf: the image placeholder is a 1 KB SVG instead of a 58 KB JPEG`; its message says "renders within antialiasing of the original". Compared by eye here: same grey ground, same two-frame picture icon | DRIFT (library side improved, not visible) |
| prop type | `assetFileProperties?: AssetFileProperties` `:34` | `... \| undefined` `:40` | nothing | STRUCTURAL (types) |
| grey background statuses | cast `as unknown as` `:98-102` | typed array `:104-107` | nothing, same result | STRUCTURAL |
| texts x5 | `system.upload.waiting / processing / uploading / done` `:145, :163, :180, :230, :307` | `common.damImage.upload.*` `:150, :168, :185, :235, :316` | identical strings: SK "Čakanie", "Spracováva sa", "Nahrávanie", "Hotovo" (`dam:src/locales/sk/system.json:15-18`, `lib:src/locales/sk/common/damImage.json:147-150`); EN identical too (`dam:src/locales/en/system.json:15-18`, `lib:src/locales/en/common/damImage.json:147-150`) | STRUCTURAL (who owns the key) |
| style object formatting | `:277` | `:282-286` | nothing | - |

Props (23), their defaults, emits (`load`, `error`) and the four template branches are otherwise identical
(`D :10-65` / `L :16-71`; `D :121-316` / `L :126-325`). No slots on either side. The CSS classes
(`asset-image`, `--loading-bg`, `__progress`, `--animate-done`, `__icon-wrapper`, `__icon-circle`) are defined once, in
the library stylesheet (`lib:src/styles/dam/components/dam-upload-queue.scss:9-47, :128-137`), which DAM loads
(`dam:src/main.ts:12`); DAM has no rule of its own for them (`dam:src/styles/` holds only `dam-image-grid`,
`upload-overlay`, `anzutap`). The "done" animation is therefore the same rule on both sides.

Not a difference, present on both: `<img ... @onerror="onError">` (`D :250`, `L :255`) listens for an event named
`onerror`, so the plain-`<img>` branch never emits `error`.

### Pair 2 - `AssetImageMetaIcons.vue` (D 120 / L 109) and `assetImageIconsConfig.ts`

`D/asset/components/AssetImageMetaIcons.vue` vs `L/dam/assetDetail/components/AssetImageMetaIcons.vue`;
`D/asset/components/assetImageIconsConfig.ts` vs `L/dam/assetDetail/utils/assetImageIconsConfig.ts`.

| Hunk | DAM | LIB | What the user sees | Class |
|---|---|---|---|---|
| **TTS icon** | `ICON_TTS` imported `:13`, pushed when `assetFileProperties.ttsAudio` `:77-80`, title `coreDam.asset.metaIcons.tts` = "Syntetické (TTS)" (`dam:src/locales/sk/coreDam/asset.json:59`); config `assetImageIconsConfig.ts:9, :45`; file `dam:src/assets/meta-icons/tts.svg`; the type is added by augmentation (`dam:src/plugins.d.ts:31-33`) | none: `data` has slots, rss, dimensions, distributions only (`:58-74`); `AssetFileProperties` has no `ttsAudio` (`L/dam/types/Asset.ts:34-40`); no `tts.svg` in `lib:src/assets/dam-meta-icons/`; no `metaIcons.tts` key (`lib:src/locales/sk/common/damImage.json:127-136`) | DAM tiles and table rows show a TTS badge for synthetic audio | STRUCTURAL (TTS is a DAM feature: `9ea7c2b9 add #84735 implement voice family settings module (#254)`, 2026-06-10) |
| imports | `:2-15`, `storeToRefs` | `:2-12` | nothing | STRUCTURAL |
| dimension loop | index loop `:40-49` | `for...of` `:37-43` | nothing | - |
| distribution icons | `:52-63`, `isDefined(iconPath) && iconPath.length > 0` | `:46-56`, `service && iconPath && iconPath.length > 0` | nothing; both skip a service that is missing or has no icon (DAM's guard came with `89dce891 ref #73441 Ensure iconPath is defined before processing asset distribution icons (#241)`) | - |
| title keys | `coreDam.asset.metaIcons.low / slots / rss` `:36, :71, :75`; `titleT` `coreDam.asset.metaIcons.*` (`assetImageIconsConfig.ts:13-37`) | `common.damImage.asset.metaIcons.*` `:33, :64, :68`; config `:12-36` | identical SK and EN strings ("Nízka kvalita", "Sloty", "RSS", "FullHD", "2K", "QHD", "4K", "8K") | STRUCTURAL |
| SVG files | `dam:src/assets/meta-icons/` | `lib:src/assets/dam-meta-icons/` | the eight shared files are byte-identical (`cmp`): 2k, 4k, 8k, fhd, low, qhd, rss, slot | - |

Template and the unscoped `<style>` block are identical (`D :88-120` / `L :77-109`); props identical
(`assetType`, `assetFileProperties`, `disableAbsolute`). Config source is the same store on both sides
(`useDamConfigStore().damPrvConfig.distributionServices`, `D :53-57` / `L :47-49`). Icon order: slots, rss, [tts], low or
video dimension, distribution services.

Fact that matters for the fix: the backend puts `ttsAudio` into the asset file properties of the admin list DTO for
every client, not just DAM (`be:vendor/anzusystems/core-dam-bundle/src/Model/Dto/Asset/Embeds/AssetFilePropertiesAdmDto.php:15-23`,
`be:vendor/anzusystems/core-dam-bundle/src/Model/Dto/Asset/AssetAdmListDto.php:38`). The library's meta icons are shown
in the other admins' asset select (`L/dam/assetSelect/components/AssetSelectTableRowItem.vue:78-82`,
`L/dam/assetSelect/components/AssetImagePreview.vue:12`, `AssetSelectListTiles.vue:31`, `AssetSelectListTable.vue:53`).
So a TTS icon added to the library unconditionally would appear there too.

### Pair 3 - `AssetFileFailReasonChip.vue` (D 25 / L 24) and `useAssetFileFailReason` (D 44 / L 44)

`D/asset/components/AssetFileFailReasonChip.vue` + `D/asset/valueObject/AssetFileFailReason.ts` vs
`L/dam/assetDetail/components/AssetFileFailReasonChip.vue` + `L/dam/assetDetail/composables/assetFileFailReason.ts`.

Only imports and the key prefix differ: `coreDam.asset.assetFileFailReason.*` (`D/.../AssetFileFailReason.ts:12-32`)
vs `common.damImage.asset.assetFileFailReason.*` (`L/.../assetFileFailReason.ts:12-32`). Template, prop (`reason`),
options and lookup are identical.

| Text | DAM | LIB | Class |
|---|---|---|---|
| SK, all six | "Žiadny", "Neznámy", "Neplatný kontrolný súčet", "Neplatný typ súboru", "Sťahovanie zlyhalo", "Neplatná veľkosť" | the same | - |
| EN `invalidMimeType` | "Invalid mime type" (`dam:src/locales/en/coreDam/asset.json:88`) | "Invalid file type" (`lib:src/locales/en/common/damImage.json:141`, `2fe737bb update translation`, 2024-10-24) | DRIFT (text, EN only; DAM offers `sk` and `en`, `dam:src/plugins/i18n.ts:10-11`) |

### Pair 4 - `AssetCustomMetadataForm.vue` (D 67 / L 71)

`D/shared/components/customMetadata/AssetCustomMetadataForm.vue` vs `L/dam/assetDetail/components/AssetCustomMetadataForm.vue`.

| Hunk | DAM | LIB | What the user sees | Class |
|---|---|---|---|---|
| model | `defineModel` `:25`, written `:58` | prop `modelValue` `:15`, emit `:27, :62` | nothing; both are `v-model` for the parent | STRUCTURAL |
| ext system | app-wide `useCurrentExtSystem()` `:28, :30, :39` | required prop `extSystem` `:14, :33, :43` | nothing | STRUCTURAL |
| `useDamConfigState(damClient)` `:27` | `useDamConfigState()` `:31` | - | nothing: the two getters used read the store and need no client (`L/dam/config/composables/damConfigState.ts:230-236`) | STRUCTURAL |
| `readonly` | none | prop `:17, :22`, passed on `:59` (the form then prints values as text, `L/customDataForm/components/ACustomDataForm.vue:110-115, :139-144`) | nothing while the prop is left at its default `false` | STRUCTURAL (library-only capability) |
| **pinned-count fallback** | `customMetadataPinnedAmount ?? 0` `:44-46` | `customMetadataPinnedAmount \|\| 2` `:49-51` | see below | **DRIFT-BUG, library side** |
| default validation scope | `AssetMetadataValidationScopeSymbol` `:18` | `ADamAssetMetadataValidationScopeSymbol` `:23` | nothing by itself, but see pair 6: a parent that validates through one symbol does not see a form registered under the other | STRUCTURAL |
| error text | "Ext system must be initialised." `:41` | "AssetCustomMetadataForm: Ext system must be initialised." `:46` | developer console only | - |
| template comment, slot order | `:50-51`, `:60-65` | `:64-69` | nothing | - |

`dataCy` is declared and unused on both sides (`D :13, :17`; `L :16, :21`; neither template binds it).

**The pinned count.** Both sides originally read `configExtSystem[props.assetType].customMetadataPinnedAmount` with no
fallback. Each made the read null-safe on its own and picked a different fallback: DAM `?? 0` in `0a338ce1 vuetify 4
upgrade` (2026-05-27), the library `|| 2` in `e5cc06f4 New image widget + several changes (#212)` (2026-04-15).

| Configured value | DAM | LIB |
|---|---|---|
| 1 or more | that many fields above keywords/authors, the rest behind "show all" | the same |
| 0 | no field pinned, all behind "show all" (`ACustomDataForm.vue:67-73, :84-86`) | first two fields pinned |
| asset type missing from the config | 0 | 2 |

The backend defines the setting as an integer with default 5 and no minimum
(`be:vendor/anzusystems/core-dam-bundle/src/DependencyInjection/Configuration.php:451-453`), so the value is always
sent and 0 is a legal setting. `|| 2` overrides a configured 0; `?? 0` keeps it. DAM is right. No configuration in the
checkout uses 0 (values 1 to 3, `be:config/packages/anzu_systems_core_dam_ext_systems.php:29-816`), so no user sees a
difference today; whether production does is not verified.

### Pair 5 - `AssetCustomMetadataFormMassOperations.vue` (D 105 / L 107)

`D/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue` vs
`L/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue`.

| Hunk | DAM | LIB | What the user sees | Class |
|---|---|---|---|---|
| model | `defineModel` `:22`, `:26-30` | prop + emit `:14, :20, :27-31` | nothing | STRUCTURAL |
| ext system | app-wide `:39-42` | prop `extSystem` `:13, :40-42` | nothing | STRUCTURAL |
| accessible names | two icon buttons without a name `:72-86, :87-100` | `:aria-label` on both `:73, :89` (`aef095d0 feat!: 2.0.0 fixes, the admins' shared building blocks and their guard tests`) | nothing visible; a screen reader gets a name in the library only | DRIFT-BUG, DAM side |
| tooltip keys | `coreDam.asset.massOperations.fillOneEmpty / replaceOne` `:84, :98` | `common.damImage.asset.massOperations.*` `:85, :100` | SK identical: "Vyplňte prázdne pole", "Nahradiť všade" (`dam:src/locales/sk/coreDam/asset.json:228, :230`; `lib:src/locales/sk/common/damImage.json:120, :122`). EN differs: "Fill empty" / "Replace in all assets" (`dam:src/locales/en/coreDam/asset.json:228, :230`) vs "Fill empty field" / "Replace everywhere" (`lib:src/locales/en/common/damImage.json:120, :122`) | STRUCTURAL + DRIFT (EN text) |

Emits (`fillEmptyField`, `replaceField`), icons (`mdi-file-arrow-left-right-outline`, `mdi-file-replace-outline`),
layout and `:validation-scope="false"` on the element are identical (`D :52-104` / `L :52-106`).

### Pair 6 - validation scopes

`D/shared/validationScopes.ts` (4 lines) vs `L/dam/composables/uploadValidations.ts` (63 lines).

| DAM symbol | key | LIB symbol | key | LIB users |
|---|---|---|---|---|
| `AssetMetadataValidationScopeSymbol` `:1` | `anzu:asset-metadata-validation-scope` | `ADamAssetMetadataValidationScopeSymbol` `:11` | `anzu:common:asset-metadata-validation-scope` | queue row, single dialog, asset detail (section 7) |
| `KeywordCreateValidationScopeSymbol` `:2` | `anzu:keyword-create-validation-scope` | `ADamKeywordCreateValidationScopeSymbol` `:15` | `anzu:common:keyword-create-validation-scope` | none: only its definition is left in the library |
| `AuthorCreateValidationScopeSymbol` `:3` | `anzu:author-create-validation-scope` | `ADamAuthorCreateValidationScopeSymbol` `:17` | `anzu:common:author-create-validation-scope` | `L/dam/author/components/AuthorCreateButton.vue:43` |
| `DistributionUpdateDtoValidationScopeSymbol` `:4` | `anzu:distribution-update-dto-validation-scope` | - | - | - |
| - | - | `AImageMetadataValidationScopeSymbol` `:13` | `anzu:common:image-validation-scope` | image widgets only |

The rest of the library file is image-widget code with no DAM counterpart: `buildFieldRules` (`:19-36`, used by
`L/dam/imageWidget/components/AImagePublicInput.vue:18` and `ImageMassOperations.vue:14`) and `useImageValidation`
(`:38-63`, used by `ImageWidgetMultipleItem.vue:10` and `ImageDetailDialogMetadata.vue:8`).

The keys have differed since the copy was made (`2c202a9b Release/1.40.0 (#155)`, 2024-01-02), so the `common:`
namespace is deliberate: STRUCTURAL. None of the symbols is exported (`lib:src/lib.ts` exports only the type
`ValidationScope`, `:264, :944`).

Why it matters: a collector and its fields must share the symbol. DAM's collectors are
`D/asset/components/detail/components/AssetDetailSidebarMetadata.vue:41` and
`D/asset/components/list/components/AssetListSidebarMetadata.vue:60`; the fields under them are the form's default
(`D/shared/components/customMetadata/AssetCustomMetadataForm.vue:18`) and the keyword/author inputs
(`D/asset/components/AssetMetadata.vue:126, :150`). `D/asset/components/AssetMetadata.vue:102-106` passes no scope to
the form. Swapping in the library's form there without passing a scope would register its fields under the library's
symbol and the two sidebars would validate nothing - the defect DAM fixed in `13812f57` and describes at
`D/shared/components/customMetadata/AssetCustomMetadataForm.vue:50-51`.

---

## 3. C - file picking in depth

### 3.1 What exists

DAM: `D/shared/components/FileUpload.vue` (picker), `D/asset/components/AssetUpload.vue` (ACL, queue, limit dialog),
`D/shared/services/upload/fileValidation.ts`, `D/asset/composables/windowFilesDragWatcher.ts`. DAM already takes
`useDamAcceptTypeAndSizeHelper` and `damFileTypeFix` from the library (`D/asset/components/AssetUpload.vue:6, :110`;
`D/shared/services/upload/fileValidation.ts:1`), so `acceptTypeAndSizeHelper.ts` and `fileType.ts` are one source
already.

LIB: `L/ui/file/components/AFileInput.vue`, `AFileDropzone.vue`, `AFileInputDialog.vue`,
`L/ui/file/composables/formatAndSizeCheck.ts`, `dropzone.ts`. These are not a copy of DAM's picker: they date from
July 2023 (`3ee50e50 Feature/images (#127)`) and are a different design. Only the format/size check and the drag state
share an origin with DAM's.

### 3.2 What DAM's `FileUpload.vue` does that the library's three components do not

| Capability | DAM | LIB |
|---|---|---|
| Four variants in one component | `dropzone-fullscreen` (default), `button`, `icon`, `slot-upload` (`:14, :24`) | none; the button is whatever the consumer puts in the `#activator` slot (`AFileInput.vue:116-120`) |
| `icon` variant | 36 px text button, `mdi-plus`, tooltip "Pridať do nahrávania" (`:278-298`; `dam:src/locales/sk/system.json:10`) | - |
| `slot-upload` variant | flat icon button, `mdi-plus` size 18, same tooltip (`:299-318`) | - |
| `button` variant | primary pill, `mdi-upload` prepended, text from `buttonText` (`:319-336`) | - |
| Full-window dropzone that exists only while files are dragged over the window | `v-show="dragOverWindow"`, fixed, `z-index 9999`, `text-display-large` "Sem presuňte nahrávané súbory" (`:337-347, :363-378`; `dam:src/locales/sk/system.json:11`); a click on it opens the file chooser (`:342`) | `AFileDropzone variant="fullscreen" hover-only` gives a fixed full-window zone shown only while dragging (`AFileDropzone.vue:115-119, :145-155`), but with other text, other look and no click-to-browse of its own (it emits `click`, `:71`) |
| Colours | one fixed pair, light and dark alike: `#e5edf1` ground, `2px dashed #bacfd4` (`:366-368`) | the same pair for "a file is being dragged" in the light theme (`:173-176`), a second green pair once the pointer is over the zone (`#dcedc8` / `#7cb342`, `:168-171`), and dark-theme pairs (`:180-199`). A full-window zone is always "over", so it would be green |
| Texts | the one sentence above | "Nahrať súbory" while dragging, "Nahrať alebo presunúť súbory" otherwise, in a small grey pill (`:77-88, :103-109`; `lib:src/locales/sk/common/system.json:59-60`) |
| Walking dropped folders | `webkitGetAsEntry()` per item (`:192-200`), recursive `traverseFileTree` (`:145-172`), `readEntries` repeated until an empty batch (`:107-125`), each entry settled on its own so one unreadable file does not discard the rest (`:127-143, :161-164, :201-204`), `$path` stamped on each file (`:150`), prop `disableTraverse` to switch it off (`:18, :193`) | none. `useDropZone` hands over `event.dataTransfer.files` as a flat list (`lib:node_modules/@vueuse/core/dist/index.js:2962-2966`, third-party, v15.0.0). A dropped folder arrives as one entry with an empty type, which the format check then refuses with the "incorrect format" alert when `accept` is set (inferred from `formatAndSizeCheck.ts:52-73` and `fileType.ts:1-15`) |
| `directory` prop | `:webkitdirectory` on the input (`:17, :353`); never passed by `AssetUpload` (`D/asset/components/AssetUpload.vue:138-148`) | - |
| Hiding the zone on drop | immediately, `hideDragOverWindow()` (`:65`), needed because the handler stops propagation (`:64`) and the document `drop` listener never runs | after the 100 ms timer of the document `drop` listener (`dropzone.ts:25-30, :44-47`) |
| Buttons out of the tab order | `tabindex="-1"` on all three (`:283, :301, :324`) | up to the consumer |

### 3.3 What the library has that DAM's picker does not

| Capability | Where |
|---|---|
| `#activator` slot handing the consumer an `onClick` (already stop-modified) | `AFileInput.vue:116-120` |
| Inline dropzone inside the input component (`useDropzone`, `dropzoneVariant`, `hoverOnly`) and a click callback that can be disabled (`false`), default (browse) or custom | `AFileInput.vue:17-20, :82-91, :109-115` |
| `activate()` exposed, to open the chooser from outside | `AFileInput.vue:103-105` |
| `fileInputKey` optional, kept in a local ref | `AFileInput.vue:13, :43, :93-101` |
| `multiple` defaults to `false` (DAM: `true`, `FileUpload.vue:29`) | `AFileInput.vue:26` |
| `AFileDropzone`: `useDropZone` on its own element, `variant` (`fill` / `default` / `fullscreen`), `size`, `transparent`, `disabled`, `hoverOnly`, `hideText`, "over" highlight, dark theme | `AFileDropzone.vue:12-33, :52-70, :92-200` |
| `AFileInputDialog`: a persistent 500 px dialog around an `AFileInput` with a dropzone, toolbar text from `toolbarT`, close button `data-cy="button-close"`, card `data-cy="create-panel"`, `activate()` that opens the dialog and the chooser in one click | `AFileInputDialog.vue:13-28, :52-60, :64-114` |
| Limits that can change after mount (getters, not values) | `AFileInput.vue:57-60`, `formatAndSizeCheck.ts:12-31` |
| Collab lock | not in these components: the image widgets disable their own buttons and hide the zone text (`L/dam/imageWidget/components/ImageWidgetInner.vue:653, :771, :883`) |

### 3.4 `checkFormats` / `checkSizes` vs `useFormatAndSizeCheck`, rule by rule

DAM: `D/shared/services/upload/fileValidation.ts`, called from `FileUpload.vue:222-251`.
LIB: `L/ui/file/composables/formatAndSizeCheck.ts`.

| Rule | DAM | LIB | Same? |
|---|---|---|---|
| accept list parsing | `accept.split(',')` (`FileUpload.vue:222-227`) | `split(',')` then `trim().toLowerCase()` on each (`:16-23`) | LIB accepts `'image/*, .jpg'` and `.JPG`; DAM does not (`dc806be7 fix: file keys in any case, ...`) |
| no accept | pass (`:6-8`) | pass (`:53-55`) | yes |
| `.ext` accept | lower-cased file name ends with the key as written (`:10-14`) | the same against the lower-cased key (`:57-61`) | yes for lower-case keys |
| `type/*` accept | `damFileTypeFix(file)` starts with `type/` (`:17-19`) | the same (`:64-66`) | yes |
| exact mime accept | equality with `damFileTypeFix(file)` (`:20-21`) | the same (`:67-68`) | yes |
| no size keys or no sizes | pass (`:34-36`) | pass (`:76-78`) | yes |
| `*` size key | `limit >= size` (`:38-40`) | `limit >= size` (`:84-85`) | yes, inclusive |
| `.ext` size key | name ends with lower-cased key and `limit >= size` (`:41-47`) | key trimmed and lower-cased, same test (`:86-87`) | yes |
| `type/*` size key | type prefix and `limit >= size` (`:51`) | the same on the lower-cased key (`:90-92`) | yes |
| exact mime size key | equality and `limit >= size` (`:53`) | the same on the lower-cased key (`:93-94`) | yes |
| warning | `showWarning(t('system.upload.incorrectFormatSize') + ':' + names.join(', '))` (`FileUpload.vue:245-248`) | the same shape with `common.system.upload.incorrectFormatSize`, and an optional `disableAlert` (`:33, :43-47`) | SK text identical "Nesprávny formát alebo veľkosť" (`dam:src/locales/sk/system.json:12`, `lib:src/locales/sk/common/system.json:63`); EN "Incorrect format or size" vs "Invalid format or size" (`dam:src/locales/en/system.json:12`, `lib:src/locales/en/common/system.json:63`) |

Both fixed the inverted size comparison on their own: DAM in `3a242125 fix(dam): refs #86567 upload queue, list and
start-up fixes with a test suite` (comment at `fileValidation.ts:28-32`), the library in `aef095d0` (comment at
`formatAndSizeCheck.ts:79`). The library's check is now a superset of DAM's (it additionally trims and ignores case).
For what DAM actually passes - mime types from the config joined by commas
(`L/dam/config/composables/acceptTypeAndSizeHelper.ts:9-35`) - the two give the same answer unless the config holds
upper-case mime types, in which case the library is right. The library's two functions are closures inside the
composable (`:52, :75`), not exported; the composable itself is not exported from `lib:src/lib.ts`.

### 3.5 The two drag-state composables, line by line

DAM: `D/asset/composables/windowFilesDragWatcher.ts`. LIB: `L/ui/file/composables/dropzone.ts`.

| Part | DAM | LIB | Same? |
|---|---|---|---|
| state | `dragOverWindow` `:4`, plain timer variable `:5`, `isInitialized` `:3` | `isDraggingFile` `:3`, timer in a ref `:4` | same meaning |
| "does the drag hold files" | `:7-17` | `:6-16` | identical |
| set true on drag, false 100 ms after it ends | `:19-32` | `:18-31` | identical |
| handlers | `onDragOver`, one `onDragEnd` for `dragleave` and `drop`, at module level `:34-41` | three handlers at module level `:36-47` | identical bodies (`preventDefault` + the check) |
| listeners | `document` `dragover` / `dragleave` / `drop`, attached on the first call, once (`:44-49`) | the same three, attached by an explicit `initGlobalDragState()` (`:50-54`) | DAM is implicit, LIB explicit |
| teardown | none | `destroyGlobalDragState()` (`:56-62`) | LIB only |
| returned | `readonly(dragOverWindow)`, `hideDragOverWindow()` (`:51-58`) | the writable `isDraggingFile` ref, `init`, `destroy` (`:64-68`) | DAM has a hide function; in LIB the ref can be set |

Both moved their handlers to module level for the same reason (DAM in `3a242125`, LIB in `e229d012 fix(system): stop
system bar retries and fix dropzone teardown`). DAM initialises in `dam:src/App.vue:17-18` and reads the state in
`FileUpload.vue:216, :338`. DAM never calls the library's `initGlobalDragState` (no match for
`useDropzoneGlobalDragState` in `dam:src`), so any library `AFileDropzone` mounted in DAM today would never see
`isDraggingFile` turn true.

### 3.6 The limit dialog: inside `AssetUpload.vue` vs `ImageWidgetMultipleLimitDialog.vue`

| | DAM `D/asset/components/AssetUpload.vue` | LIB `L/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue` | Class |
|---|---|---|---|
| limit | `maxUploadItems`, a ref of 50 (`:51`; `dam:src/shared/utils/BetaTestFeaturesService.ts:4`), never reassigned in `dam:src` | constant 50 (`:22`) | STRUCTURAL |
| layout | 500 px dialog, toolbar, one or four sentences, cancel + "add first N" (`:149-187`) | the same (`:91-140`) | - |
| texts | `system.upload.limits.*` (`:158-183`) | `common.damImage.upload.limits.*` (`:101-136`) | SK identical except `onlyAllowedAtOnce`: DAM "Maximálne {count} súborov je možné nahrať súčasne." with the full stop (`dam:src/locales/sk/system.json:24`, from `105a9541 fix(i18n): correct the language errors in the Slovak and English texts`), LIB without it (`lib:src/locales/sk/common/damImage.json:164`). EN differs in three sentences (`dam:src/locales/en/system.json:21-24`, `lib:src/locales/en/common/damImage.json:161-164`). DRIFT (text), DAM is the corrected one |
| Esc | not handled; the dialog closes itself and `onDialogCancel` does not run, so the file input is not reloaded (`:149-152`, `:88-92`) | `@keydown.esc="onDialogCancel"` (`:94`, added in `aef095d0`) | DRIFT-BUG, DAM side. Effect: after Esc, picking the very same files again does nothing, because the input still holds them (inferred from browser behaviour, not run) |
| where the files go | `addByFiles(queueId, files)` (`:97`); below the limit also `addByFilesAsSlotUpload` (`:59-63`) | `addByFiles(queueKey, extSystem, licence, files)` with ext system and licence injected (`:29-36, :58-63`), then `emit('afterAdd')` (`:67`) | STRUCTURAL |
| entry | `assetUpload(files)` from the picker (`:53-70`) | `check(files)` exposed (`:76-87`) | STRUCTURAL |
| `data-cy` | `delete-panel` (`:155`) | `delete-panel` (`:98`) | - |

The library dialog throws at setup without the image widget's injected config (`:34-36`), so DAM cannot mount it as it
is.

### 3.7 Is any part shareable?

Facts only; the recommendation is in section 10.

- Format/size check: yes. Same rules, same warning, SK text identical; needs the composable exported.
- Window drag state: yes. Same listeners, same flag; already exported (`lib:src/lib.ts:406, :869`).
- Hidden input + double-click guard + validation + `filesInput` emit: the same in `AFileInput.vue:39-80, :121-130` and
  `FileUpload.vue:40-60, :236-274, :348-359`. With the `#activator` slot the three button variants can be rendered by
  DAM's own markup around `AFileInput` as it is.
- Full-window dropzone with folder walking: not shareable as the library stands (no traversal, different text, look
  and class).

---

## 4. Pair 8 - DAM-only components of the floating panels

None has a library counterpart. The `dam-upload-queue--list` and `--simple` rules they rely on live in the library
stylesheet (`lib:src/styles/dam/components/dam-upload-queue.scss:53-68, :70-110`) although only DAM uses those two
modifiers (`D/asset/components/queue/AssetQueueUploadList.vue:30`, `AssetQueueSelectedSimple.vue:16`,
`D/asset/components/detail/components/slots/AssetSlotListItem.vue:146`; the library uses only `--editable`,
`L/dam/uploadQueue/components/UploadQueueEditable.vue:123`).

| File | Reads from a queue row | Reads from the store | Already from the library | DAM-local imports |
|---|---|---|---|---|
| `D/asset/components/AssetLink.vue` (28) | nothing; prop `assetId` | nothing | type `DocId` (`:2`) | the router: `router.resolve({ name: '/(coreDam)/assets/[id]' })` (`:16`) |
| `D/asset/components/queue/AssetQueueItemList.vue` (150) | `error.assetFileFailReason`, `error.message`, `error.hasError` (`:28-32, :83`), `status` (`:43, :64`), `progress.progressPercent` (`:47`), `progress.remainingTime` (`:142-145`), `isDuplicate` (`:97`), `displayTitle` (`:132-138`) | nothing; emits `cancelItem { index, item, queueId }` (`:18-20, :50-52`) | `UploadQueueItem`, `UploadQueueItemStatusType`, `AssetFileFailReason`, `UploadQueueItemStatus`, `useRemainingTime` (`:2-3`) | `useAssetFileFailReason` (`:7`) |
| `D/asset/components/queue/AssetQueueSelectedItemSimple.vue` (83) | `status` (`:28`), `imagePreview.url` (`:31`), `assetType` (`:34`), `assetStatus` (`:38`), `isDuplicate` (`:61`), `displayTitle` (`:78`) | nothing | `UploadQueueItem`, `UploadQueueItemStatusType`, `DamAssetStatusDefault`, `UploadQueueItemStatus` (`:2-3`) | `AssetImage` (`:7`) |
| `D/asset/components/queue/AssetQueueSelectedSimple.vue` (25) | `key` (`:19`) | `getQueueItems(QUEUE_ID_MASS_EDIT)` (`:11`) | nothing | the store (`:5`), `QUEUE_ID_MASS_EDIT` (`:6`), the item component (`:4`) |
| `D/asset/components/queue/AssetQueueUploadList.vue` (40) | `key` (`:33`) | `getQueueItems(queueId)` (`:21`), `stopItemUpload(queueId, item)` (`:25`) | type `UploadQueueItem` (`:2`) | the store (`:6`), `QUEUE_ID_UPLOAD_GLOBAL` (`:7`), the row (`:5`) |

Every row field read is in the library's `UploadQueueItem` (`L/dam/types/UploadQueue.ts:44-87`: `key :45`, `status :47`,
`assetStatus :48`, `isDuplicate :49`, `assetType :51`, `displayTitle :52`, `imagePreview? :65`, `progress :71-75`,
`error :76-80`), and DAM already imports the type from the library.

What a move of the store into the library touches in these files:

1. `stopItemUpload`. DAM calls it with two arguments (`AssetQueueUploadList.vue:25`;
   `D/asset/components/detail/components/slots/AssetSlotListItem.vue:134-136`). DAM's store removes by identity
   (`D/asset/store/uploadQueuesStore.ts:423-436`); the library's takes an index as third argument and removes by it
   (`L/dam/uploadQueue/store/uploadQueuesStore.ts:505-514`, `removeByIndex :497-503`). Called the DAM way against the
   library store, nothing is removed (`!queue.items[index]` returns early, `:499`).
2. `getQueueItems(key)` - same name and result on both sides (`D ...:102-107`, `L ...:76-81`). No change.
3. The store import path, and for `AssetQueueItemList.vue` and `AssetQueueSelectedItemSimple.vue` the import paths of
   `useAssetFileFailReason` and `AssetImage` once those come from the library.

Not affected by any move: `AssetLink.vue` (router only). Its only user is the queue row
(`D/asset/components/queue/AssetQueueItemEditable.vue:22, :320-327`). The library's `ADamAdminAssetLink` is a different
thing: an absolute link built from the configured admin domain with a fixed label
(`L/dam/assetDetail/components/DamAdminAssetLink.vue:20-39`).

Unrelated oddity: `dam-upload-queue__duplicate-overlay` (`AssetQueueSelectedItemSimple.vue:62`) has no rule in either
repo; the stylesheet only knows `__overlay` (`lib:src/styles/dam/components/dam-upload-queue.scss:122-125`). The class
has been in the template since `9efe7d07 initial project commit`.

---

## 5. Pair 9 - DAM view-state composables

| File | Holds | Depends on | Used by |
|---|---|---|---|
| `D/asset/composables/assetFooterUpload.ts` (80) | one module-level ref `footerViewUpload`: hidden / minimal / compact / full (`:6-18`); setters that also switch the asset list's keyboard navigation and `customDialog` (`:33-67`) | `useAssetListStore` (`:3, :21`), `useMainWrapper` (`:4, :16`) | `D/asset/components/footer/AssetFooterUploadOverlay.vue:7, :15-24`, `AssetFooterUploadOverlayFull.vue:13, :27`, `AssetFooterUploadSlotsOverlay.vue:8, :17`, `D/asset/components/list/AssetListView.vue:24, :55`, `D/externalProvider/components/ExternalProviderAssetListView.vue:10, :73`; mocked in `dam:src/test/queue/saveNothing.test.ts:31` |
| `D/asset/composables/assetFooterUploadSlots.ts` (61) | `footerViewUploadSlots`: hidden / minimal / compact (`:5-16`) | `useMainWrapper` (`:3, :14`) | `D/asset/components/footer/AssetFooterUploadSlotsOverlay.vue:9, :18-26` |
| `D/asset/composables/assetFooterSelected.ts` (99) | `footerViewSelected`: four states, and the footer height each one reserves - 32 / 160 / 0 / 0 (`:6-36`) | `useAssetListStore` (`:3, :39`), `useMainWrapper` (`:4, :21`) | `D/asset/components/footer/AssetFooterSelected.vue:8, :18-27`, `AssetFooterSelectedFull.vue:10`, `D/asset/components/list/AssetListView.vue:23, :54`; mocked in `dam:src/test/queue/saveNothing.test.ts:34` |
| `D/asset/composables/externalProviderAssetFooterSelected.ts` (102) | the same shape for the external provider list (`:6-39`) | `useExternalProviderAssetListStore` (`:3, :42`), `useMainWrapper` (`:4, :22`) | `D/externalProvider/components/ExternalProviderAssetFooterSelected.vue:8, :19-28`, `ExternalProviderAssetFooterSelectedFull.vue:7`, `ExternalProviderAssetListView.vue:14, :72`, `D/externalProvider/composables/externalProviderAssetImport.ts:4, :70` |
| `D/shared/services/upload/uploadQueueIds.ts` (3) | `'global'`, `'slots'`, `'edit'` | nothing | 14 files (section 7) |

None of the five touches the upload store. The library's `useUploadQueueDialog`
(`L/dam/uploadQueue/composables/useUploadQueueDialog.ts:4-16`) holds two other things: `uploadQueueDialog`, the key of
the queue whose modal dialog is open or `null`, and `uploadQueueSidebar`, whether the mass-operations sidebar of that
dialog is open (starts closed, `:5`). Nothing is duplicated:

- DAM has no "which dialog is open" key; its panels are fixed overlays with a size state.
- DAM keeps "mass operations open" as a local ref in each full overlay, with other defaults: open unless on mobile for
  the upload overlay (`D/asset/components/footer/AssetFooterUploadOverlayFull.vue:43-44, :67`), always open for the
  selection (`D/asset/components/footer/AssetFooterSelectedFull.vue:45, :55`).
- The library has no queue-key constants; the consumer passes any string (`L/dam/types/UploadQueue.ts:11`).

---

## 6. Contract points a store move creates for the DAM-only consumers

Collected from sections 3 and 4, so the store plan can check them off:

| Consumer | Calls | DAM store | LIB store |
|---|---|---|---|
| `AssetUpload.vue:73` | `getQueueFileInputKey(queueId)` | exposed (`D/asset/store/uploadQueuesStore.ts:88-93, :823`) | defined but not returned (`L/dam/uploadQueue/store/uploadQueuesStore.ts:580-584`, return list `:614-631`); library consumers read `getQueue(key)?.fileInputKey` (`L/dam/assetSelect/components/AAssetListInner.vue:260`) |
| `AssetUpload.vue:65, :97` | `addByFiles(queueId, files)` | `:161` | `addByFiles(queueKey, extSystem, assetLicence, files)` (`:117`) |
| `AssetUpload.vue:61` | `addByFilesAsSlotUpload(...)` | `:189` | none |
| `AssetUpload.vue:77, :90` | `getQueueTotalCount`, `forceReloadFileInput` | `:116, :303` | `:543, :573` same |
| `AssetQueueUploadList.vue:25`, `AssetSlotListItem.vue:135` | `stopItemUpload(queueId, item)` | by identity `:423-436` | by index, three arguments `:505-514` |

---

## 7. B - usage map

### DAM side

| File | Part of upload / queue | Elsewhere |
|---|---|---|
| `D/asset/components/AssetImage.vue` | `D/asset/components/queue/AssetQueueItemEditable.vue:21`, `AssetQueueSelectedItemSimple.vue:7`, `D/externalProvider/components/ExternalProviderAssetQueueItemReadonly.vue:6` | `D/asset/components/list/components/AssetListItem.vue:5`, `AssetTableRowItem.vue:14`, `D/asset/components/detail/AssetDetailView.vue:18`, `AssetFileDetailView.vue:18`, `D/asset/components/detail/components/AssetDetailDialog.vue:19`, `DistributionImagePreviewItem.vue:7`, `D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:8`, `ExternalProviderAssetListItem.vue:6`, `D/podcast/components/PodcastDetail.vue:7`, `D/podcastEpisode/components/PodcastEpisodeDetail.vue:8`; test mock `dam:src/test/queue/queueRowValidation.test.ts:55` |
| `D/asset/components/AssetImageMetaIcons.vue` | - | `D/asset/components/AssetImage.vue:8`, `D/asset/components/list/components/AssetTableRowItem.vue:15, :115-119` |
| `D/asset/components/assetImageIconsConfig.ts` | - | `AssetImageMetaIcons.vue:15` only |
| `D/asset/components/AssetFileFailReasonChip.vue` | `D/asset/components/queue/AssetQueueItemEditable.vue:20`, `D/asset/components/detail/components/slots/AssetSlotListItem.vue:17` | `D/asset/components/AssetInfobox.vue:6`; test mock `dam:src/test/queue/queueRowValidation.test.ts:57` |
| `D/asset/valueObject/AssetFileFailReason.ts` | `D/asset/components/queue/AssetQueueItemList.vue:7` | `AssetFileFailReasonChip.vue:6` |
| `D/shared/components/customMetadata/AssetCustomMetadataForm.vue` | `D/asset/components/queue/AssetQueueItemEditable.vue:29, :438-444` | `D/asset/components/AssetMetadata.vue:27, :102-106`; test `dam:src/test/asset/assetMetadataValidation.test.ts:49` |
| `...AssetCustomMetadataFormMassOperations.vue` | `D/asset/components/queue/AssetQueueSelectedSidebar.vue:11, :277-327` (four asset types) | tests `dam:src/test/asset/assetMetadataValidation.test.ts:61`, `dam:src/test/queue/massOperationsSidebar.test.ts:40` |
| `D/shared/validationScopes.ts` | `D/asset/components/queue/AssetQueueItemEditable.vue:30, :104`, the form `:7, :18` | asset metadata: `D/asset/components/AssetMetadata.vue:28, :126, :150`, `D/asset/components/list/components/AssetListSidebarMetadata.vue:19, :60`, `D/asset/components/detail/components/AssetDetailSidebarMetadata.vue:14, :41`, `D/asset/components/detail/components/distribution/DistributionCustomMetadataForm.vue:7, :53`; keyword/author create: `D/keyword/components/KeywordCreateButton.vue:19, :41`, `D/author/components/AuthorCreateButton.vue:21, :43`; distribution: `D/asset/components/detail/composables/distributionValidations.ts:11, :28`, `D/asset/components/detail/components/distribution/forms/DistributionManageDialog.vue:24, :141`; test `dam:src/test/asset/assetMetadataValidation.test.ts:12` |
| `D/shared/components/FileUpload.vue` | `D/asset/components/AssetUpload.vue:15` only | - |
| `D/asset/components/AssetUpload.vue` | `dam:src/domains/system/components/MainWrapper.vue:7, :171` (full-window zone), `D/asset/components/footer/AssetFooterUploadOverlayFull.vue:9, :195-198` (icon), `:252` (full-window zone), `D/asset/components/list/AssetListView.vue:8, :149-152` (button), `D/externalProvider/components/ExternalProviderAssetListView.vue:7, :142-145` (button), `D/asset/components/detail/components/slots/AssetSlotListItem.vue:18, :197-207` (slot upload) | test mock `dam:src/test/queue/saveNothing.test.ts:38` |
| `D/shared/services/upload/fileValidation.ts` | `FileUpload.vue:7` | test `dam:src/test/upload/fileValidation.test.ts:3` |
| `D/asset/composables/windowFilesDragWatcher.ts` | `FileUpload.vue:6, :216` | `dam:src/App.vue:7, :18` |
| `D/asset/components/AssetLink.vue` | `D/asset/components/queue/AssetQueueItemEditable.vue:22` | test mock `dam:src/test/queue/queueRowValidation.test.ts:56` |
| `AssetQueueItemList.vue` | `AssetQueueUploadList.vue:5`, `D/asset/components/detail/components/slots/AssetSlotListItem.vue:23, :147-153` | - |
| `AssetQueueSelectedItemSimple.vue` | `AssetQueueSelectedSimple.vue:4` | - |
| `AssetQueueSelectedSimple.vue` | `D/asset/components/footer/AssetFooterSelected.vue:7, :128`, `D/externalProvider/components/ExternalProviderAssetFooterSelected.vue:7, :139` | - |
| `AssetQueueUploadList.vue` | `D/asset/components/footer/AssetFooterUploadOverlay.vue:6, :152`, `AssetFooterUploadSlotsOverlay.vue:7, :170` | - |
| `uploadQueueIds.ts` | `AssetUpload.vue:16`, `AssetQueueUploadList.vue:7`, `AssetQueueSelectedSimple.vue:6`, `D/asset/components/footer/AssetFooterUploadOverlay.vue:9`, `AssetFooterUploadOverlayFull.vue:15`, `AssetFooterUploadSlotsOverlay.vue:11`, `AssetFooterSelected.vue:11`, `AssetFooterSelectedFull.vue:13`, `D/asset/components/detail/components/slots/AssetSlotListItem.vue:27`, `D/asset/components/list/composables/assetListActions.ts:27`, `D/externalProvider/components/ExternalProviderAssetFooterSelected.vue:12`, `ExternalProviderAssetFooterSelectedFull.vue:12`, `D/externalProvider/composables/externalProviderAssetImport.ts:12`, `externalProviderAssetListActions.ts:30` | - |

The four view-state composables: see the "Used by" column in section 5.

### LIB side, with export status (`lib:src/lib.ts` is the only public entry, `lib:package.json:14-37`)

| File | Part of upload / queue | Elsewhere | Exported today |
|---|---|---|---|
| `L/dam/assetDetail/components/AssetImage.vue` | `L/dam/uploadQueue/components/UploadQueueItemEditable.vue:17`, `UploadQueueDialogSingle.vue:14` | `L/dam/assetDetail/components/AssetDetailDialog.vue:9` | no |
| `L/dam/assetDetail/components/AssetImageMetaIcons.vue` | - | `AssetImage.vue:14`, `L/dam/assetSelect/components/AssetSelectTableRowItem.vue:10`, `AssetImagePreview.vue:12` | no |
| `L/dam/assetDetail/utils/assetImageIconsConfig.ts` | - | `AssetImageMetaIcons.vue:11` | no |
| `L/dam/assetDetail/components/AssetFileFailReasonChip.vue` | `UploadQueueItemEditable.vue:18`, `UploadQueueDialogSingle.vue:27` | `L/dam/assetDetail/components/AssetInfobox.vue:9` | no |
| `L/dam/assetDetail/composables/assetFileFailReason.ts` | - | the chip `:4` | no |
| `L/dam/assetDetail/components/AssetCustomMetadataForm.vue` | `UploadQueueItemEditable.vue:16`, `UploadQueueDialogSingleSidebarMetadataContent.vue:8` | `L/dam/assetDetail/components/AssetMetadata.vue:8`; test `L/dam/uploadQueue/__tests__/queueRowValidation.test.ts:11` | no |
| `L/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue` | `L/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue:7` (image only, `:276-282`) | test `L/dam/uploadQueue/__tests__/massOperationsValidation.test.ts:9` | no |
| `L/dam/composables/uploadValidations.ts` | `UploadQueueItemEditable.vue:20`, `UploadQueueDialogSingleSidebarMetadata.vue:8`, `UploadQueueDialogSingleSidebarMetadataContent.vue:17` | `L/dam/assetDetail/components/AssetCustomMetadataForm.vue:6`, `AssetMetadata.vue:14`, `AssetDetailSidebarMetadata.vue:14`, `L/dam/author/components/AuthorCreateButton.vue:5`, image widgets (`AImagePublicInput.vue:18`, `ImageWidgetMultipleItem.vue:10`, `ImageWidgetMultipleInner.vue:42`, `ImageDetailDialogMetadata.vue:8`, `ImageMassOperations.vue:14`) | no, nothing from it |
| `L/ui/file/components/AFileInput.vue` | `L/dam/uploadQueue/components/UploadQueueDialog.vue:14` | `L/dam/assetSelect/components/AAssetListInner.vue:38`, `L/dam/imageWidget/components/ImageWidgetMultipleInner.vue:18`, `AFileInputDialog.vue:4` | **yes** (`:67, :812`) |
| `L/ui/file/components/AFileDropzone.vue` | `UploadQueueDialog.vue:15` | `AFileInput.vue:4`, `ImageWidgetInner.vue:2`, `ImageWidgetMultipleInner.vue:19`, `ImageMediaWidgetInner.vue:2` | no |
| `L/ui/file/components/AFileInputDialog.vue` | - | `ImageWidgetInner.vue:42`, `ImageMediaWidgetInner.vue:42` | no |
| `L/ui/file/composables/formatAndSizeCheck.ts` | - | `AFileInput.vue:6`, `AFileDropzone.vue:6` | no |
| `L/ui/file/composables/dropzone.ts` | - | `AFileDropzone.vue:4` | **yes** (`:406, :869`) |
| `L/ui/file/utils/fileType.ts` | `L/dam/uploadQueue/store/uploadQueuesStore.ts:16` | `formatAndSizeCheck.ts:2`, `L/dam/api/damImageApi.ts:6` | **yes** (`:398, :1281`) |
| `L/dam/config/composables/acceptTypeAndSizeHelper.ts` | - | `AAssetListInner.vue:34`, `ImageWidgetInner.vue:12`, `ImageWidgetMultipleInner.vue:20`, `ImageMediaWidgetInner.vue:12` | **yes** (`:399, :864`) |
| `L/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue` | - | `ImageWidgetMultipleInner.vue:45, :724-728` | no |
| `L/dam/uploadQueue/composables/useUploadQueueDialog.ts` | `UploadQueueDialog.vue:2`, `UploadQueueDialogSingle.vue:20` | `AAssetListInner.vue:35`, the three image widget inners (`:24`, `:25`, `:26`) | no |

Also exported and already used by the DAM files in scope: `AChipNoLink` (`:38, :745`), `ADialogToolbar` (`:19, :767`),
`ACustomDataForm`, `ACustomDataFormElement` (`:71-72, :797-798`), `useRemainingTime` (`:311, :849`),
`useDamConfigState` (`:373, :861`), `useDamConfigStore` (`:498, :1242`), the `UploadQueue*` types (`:354-359, :996-1001`),
`AssetFileFailReason` (`:332, :973`), `DamAssetStatusDefault` (`:320, :1013`), `arrayFlatten`, `arrayFromArgs`
(`:255-256`).

---

## 8. D - verdicts

### Per DAM file

| DAM file | Verdict | What DAM passes / what the library needs first |
|---|---|---|
| `AssetImage.vue` | CAN BE REPLACED after export | Same 23 props, same emits; the 13 importers change only the import. Needs: export (pair 2 settled first, because the library's `AssetImage` renders the library's meta icons). The JPEG stays in DAM regardless: four other files use it (`D/externalProvider/components/ExternalProviderAssetDetailDialog.vue:7`, `ExternalProviderAssetListItem.vue:5`, `D/asset/components/ImagePreview.vue:18`, `ImageFile.vue:7`) |
| `AssetImageMetaIcons.vue`, `assetImageIconsConfig.ts`, `dam:src/assets/meta-icons/*` | CAN BE REPLACED after the library gains X | X = (1) `tts.svg` and `ICON_TTS`; (2) the `ttsAudio` branch; (3) `ttsAudio` on `AssetFileProperties`, after which DAM's augmentation `dam:src/plugins.d.ts:31-33` goes; (4) `common.damImage.asset.metaIcons.tts` in sk, en and cs; (5) export, because `AssetTableRowItem.vue:15` imports the component directly; (6) a way to keep the icon out of the other admins' asset select - see section 10 |
| `AssetFileFailReasonChip.vue` | CAN BE REPLACED as it is, after export | prop `reason` |
| `valueObject/AssetFileFailReason.ts` | CAN BE REPLACED as it is, after export of `useAssetFileFailReason` | needed by `AssetQueueItemList.vue:7, :23` |
| `AssetCustomMetadataForm.vue` | CAN BE REPLACED after the library gains X | X = `?? 0` in place of `\|\| 2` (`L/dam/assetDetail/components/AssetCustomMetadataForm.vue:50`), and export. DAM passes `v-model`, `:asset-type`, `:ext-system="currentExtSystemId"`, `@any-change`, and **`:validation-scope` at both call sites** (today only the queue row passes it, `AssetQueueItemEditable.vue:443`; `AssetMetadata.vue:102-106` relies on the default) - or DAM switches to the library's symbol everywhere (pair 6) |
| `AssetCustomMetadataFormMassOperations.vue` | CAN BE REPLACED as it is, after export | `v-model`, `:asset-type`, `:ext-system`, `@fill-empty-field`, `@replace-field` |
| `validationScopes.ts` | MUST STAY | `DistributionUpdateDtoValidationScopeSymbol` is DAM-only (two users). The other three lines can be replaced by the library's symbols once exported; that is a change of key, safe only if every DAM collector and field moves together (11 use sites listed in section 7) |
| `fileValidation.ts` | CAN BE REPLACED after export of `useFormatAndSizeCheck` | `FileUpload.vue:222-251` becomes one call with two getters |
| `windowFilesDragWatcher.ts` | CAN BE REPLACED by `useDropzoneGlobalDragState` as it is | `dam:src/App.vue:18` calls `initGlobalDragState()`; `FileUpload.vue:65` sets `isDraggingFile.value = false` |
| `FileUpload.vue` | MUST STAY | full-window zone with folder walking, its text, look and the class the e2e waits for (`dam:e2e/pages/shared/upload.ts:124`). Internally it can use the two shared composables; the button variants could use `AFileInput` |
| `AssetUpload.vue` | MUST STAY | ACL (`:112-132`), slot uploads (`:59-63`), current ext system (`:103-110`), beta limit (`:51`). Its limit dialog could be the library's only after that dialog stops injecting the image widget config and calling the store itself |
| `AssetLink.vue` | MUST STAY | bound to DAM's route name |
| `AssetQueueItemList.vue`, `AssetQueueSelectedItemSimple.vue`, `AssetQueueSelectedSimple.vue`, `AssetQueueUploadList.vue` | MUST STAY | no library counterpart; change only import paths and the `stopItemUpload` call (section 4) |
| the four footer composables, `uploadQueueIds.ts` | MUST STAY | DAM layout state and DAM's choice of queue keys |

### Per LIB file

| LIB file | Change | Export |
|---|---|---|
| `AssetImage.vue` | unchanged | must be exported |
| `AssetImageMetaIcons.vue` | gains the TTS branch | must be exported |
| `assetImageIconsConfig.ts` | gains `ICON_TTS` | internal |
| `L/dam/types/Asset.ts` | `AssetFileProperties` gains `ttsAudio` | type already exported with the others |
| `AssetFileFailReasonChip.vue` | unchanged | must be exported |
| `assetFileFailReason.ts` | unchanged | `useAssetFileFailReason` must be exported |
| `AssetCustomMetadataForm.vue` | `\|\| 2` becomes `?? 0` | must be exported |
| `AssetCustomMetadataFormMassOperations.vue` | unchanged | must be exported |
| `uploadValidations.ts` | unchanged | `ADamAssetMetadataValidationScopeSymbol` must be exported if DAM is to share it; the author/keyword pair depends on the author/keyword analysis |
| `formatAndSizeCheck.ts` | unchanged | `useFormatAndSizeCheck` must be exported |
| `dropzone.ts`, `fileType.ts`, `acceptTypeAndSizeHelper.ts`, `AFileInput.vue` | unchanged | already exported |
| `AFileDropzone.vue`, `AFileInputDialog.vue` | unchanged | not needed by DAM |
| `ImageWidgetMultipleLimitDialog.vue` | unchanged unless the dialog is to be shared | not needed |
| `useUploadQueueDialog.ts` | unchanged | not needed by these blocks |
| `lib:src/locales/{sk,en,cs}/common/damImage.json` | gain `asset.metaIcons.tts`; `upload.limits.onlyAllowedAtOnce` (sk) gains the full stop if the dialog is shared | - |

---

## 9. E - risks

### DAM unit tests that mock or import by path

| Test | What it does | What breaks |
|---|---|---|
| `dam:src/test/queue/queueRowValidation.test.ts:55-59` | mocks `AssetImage.vue`, `AssetLink.vue`, `AssetFileFailReasonChip.vue` by DAM path | once the row imports image and chip from the package the two mocks match nothing and the real components render. `AssetLink` stays valid |
| same file `:35-46` | replaces the package's `useDamConfigState` export | a library `AssetCustomMetadataForm` calls the composable inside the bundle, which this mock does not reach (inferred from how module mocks work; not run). It then reads an empty store and throws "Custom form elements must be initialised." (`L/dam/assetDetail/components/AssetCustomMetadataForm.vue:33-36`). The test must seed `useDamConfigStore` instead |
| `dam:src/test/asset/assetMetadataValidation.test.ts:36-42, :49, :61` | the same package mock, and imports both forms by DAM path | the paths disappear; the same store seeding is needed. `:12, :55, :76` build a field and a collector with DAM's symbol, so the test also pins which symbol the form answers to |
| same file `:181-186` | pins "no pinned amount -> every field behind show all" | passes either way, but documents the `?? 0` behaviour |
| `dam:src/test/queue/massOperationsSidebar.test.ts:40-42` | mocks the mass-operations form by DAM path | the real library form would mount and throw as above (`L/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue:42-45`) |
| `dam:src/test/queue/saveNothing.test.ts:31-38` | mocks `assetFooterUpload`, `assetFooterSelected`, `AssetUpload.vue` by path | nothing, as long as those three stay where they are |
| `dam:src/test/upload/fileValidation.test.ts:3` | imports `checkFormats`, `checkSizes` | the file disappears; the library has the same cases against the composable (`L/ui/file/__tests__/formatAndSizeCheck.test.ts:10-48`), so the DAM test is dropped or rewritten against `useFormatAndSizeCheck` |

### DAM e2e selectors

| Selector | Where | Depends on |
|---|---|---|
| `.dam-upload-dropzone--fullscreen` must become visible during a drag | `dam:e2e/pages/shared/upload.ts:124` | `FileUpload.vue:340` and the drag state turning true on `dragover` |
| the native drag relies on the app reading `webkitGetAsEntry()` | `dam:e2e/pages/shared/upload.ts:90-93, :114-130` | `FileUpload.vue:192-200` |
| `input[type="file"]` first on the page | `dam:e2e/pages/shared/upload.ts:99`, `dam:e2e/tests/errors/errorPaths.spec.ts:62, :156, :187` | a hidden input for the global queue being in the DOM; `AFileInput` renders one too (`AFileInput.vue:121-130`) |
| `input[type="file"]` inside a slot row / the sidebar | `dam:e2e/pages/assets/assetSlotsPage.ts:230`, `dam:e2e/pages/assetEmpty/emptyAssetPage.ts:45` | the hidden input staying inside `AssetUpload`'s place in the row |
| alert text "Nesprávny formát alebo veľkosť" plus the file name | `dam:e2e/tests/errors/errorPaths.spec.ts:37, :157-160, :188-190` | the SK text and the `text + ':' + names` shape, both the same in the library |
| `.asset-image__meta-icons img[title="Syntetické (TTS)"]` | `dam:e2e/pages/assets/assetTtsPage.ts:13, :41` | the TTS icon **and its exact SK title**; a new library key must carry the same string |
| `.asset-upload-overlay .dam-upload-queue--list [data-cy="icon-duplicate"]` | `dam:e2e/pages/licence/licenceDuplicatePage.ts:17` | `AssetQueueItemList.vue:100` and the `--list` class |
| `.dam-upload-queue__item .mdi-alert:not([data-cy="icon-duplicate"])` | `dam:e2e/tests/errors/errorPaths.spec.ts:221` | `AssetQueueItemList.vue:82-87` |
| `.mdi-file-arrow-left-right-outline`, `.mdi-file-replace-outline` inside a `.v-row` of `.asset-queue-editable__sidebar`; `[data-cy="custom-field-<name>"] textarea` | `dam:e2e/pages/assets/assetBulkEditPage.ts:18-21, :29-39, :129-135, :188-190` | the mass-operations form's row structure and icons - identical in the library's form |
| buttons by name "Vyplniť len prázdne", "Nahradiť všetko", "Vyčistiť" in the sidebar | `dam:e2e/pages/assets/assetBulkEditPage.ts:193-201` | the library's new `aria-label`s are "Vyplňte prázdne pole" and "Nahradiť všade"; neither is a substring match for these names |

### Library guard tests

| Test | Rule | Consequence here |
|---|---|---|
| `lib:src/test/i18nLiteralKeys.test.ts:57-67` | every literal key in library source exists in en, sk **and cs** | `common.damImage.asset.metaIcons.tts` needs a Czech string. Any DAM code moved into the library with `coreDam.*` or `system.upload.*` keys fails (only `system.subject.` is exempt, `:20`) |
| same `:69-75` | no `show*('literal')` alerts | not triggered by the files in scope |
| `lib:src/test/a11y/iconButtonNames.test.ts:53-78, :95-99` | every icon-only `VBtn` has `aria-label` / `title` | relevant only if DAM components move into the library: `FileUpload.vue:282-297, :299-318` and `AssetQueueItemList.vue:110-129` would fail as they are. The library's mass-operations form already passes |
| `lib:src/test/publicExportsAdded.test.ts:44-68` | 2.0.0 convention: exported components start with `A`, injection keys end in `Key` | new exports need names such as `ADamAssetImage`; the scope symbols are not injection keys, so the `...Symbol` suffix is not caught by the test, but it sits next to that convention |
| `lib:src/test/publicExportsRemoved.test.ts:8-19` | four removed type names must not come back | no clash |

### Other

- **Type clash on `ttsAudio`.** If the library declares the property and DAM's augmentation stays
  (`dam:src/plugins.d.ts:31-33`), the two declarations must be identical or type-checking fails (inferred, not run).
- **Stylesheet clean-up.** `--list`, `--simple`, `__item-status`, `__item-remove` in
  `lib:src/styles/dam/components/dam-upload-queue.scss:53-110` look unused from inside the library; removing them
  strips DAM's two floating panels.
- **Two drag listeners.** If DAM mounts any library `AFileDropzone` (the library's upload dialog has one,
  `L/dam/uploadQueue/components/UploadQueueDialog.vue:317-324`) while keeping its own watcher, both sets of document
  listeners run; and without `initGlobalDragState()` the library zone stays hidden.
- **Translation-id mode.** In DAM's `xx` language texts show their keys (`dam:src/test/languageMessagesTranslationIds.test.ts:7-17`);
  every replaced block then shows a `common.damImage.*` key instead of a DAM key, and the place where the text is
  edited moves to the library.
- **EN wording** changes in DAM for one fail reason, two mass-operation tooltips and the format alert (pairs 3, 5,
  section 3.4). SK is unchanged everywhere except the TTS title, which does not exist in the library yet.

---

## 10. Proposals (my own, not facts)

1. **Order.** Export first, replace second. One library change set: export `AssetImage`, `AssetImageMetaIcons`,
   `AssetFileFailReasonChip`, `useAssetFileFailReason`, `AssetCustomMetadataForm`,
   `AssetCustomMetadataFormMassOperations`, `useFormatAndSizeCheck`, `ADamAssetMetadataValidationScopeSymbol`; fix
   `|| 2` to `?? 0`; add TTS. Then DAM deletes pairs 1 to 5, `fileValidation.ts` and `windowFilesDragWatcher.ts`.
2. **TTS icon without touching the other admins.** Give `AssetImageMetaIcons` a boolean prop (for example `showTts`,
   default `false`) and pass it through `AssetImage`; DAM sets it at its two call sites
   (`AssetListItem.vue:82`, `AssetTableRowItem.vue:115`). The alternative - show it everywhere - is a visible change
   in the asset select of the other admins and needs the owner's yes.
3. **Pinned count.** Take DAM's `?? 0` into the library as the allowed bug fix. It changes the other admins only where
   an ext system configures 0, which the checkout does not; worth one look at the production configuration before
   merging.
4. **Validation scope.** Keep it boring: DAM keeps its own symbol and passes `:validation-scope` explicitly at
   `AssetMetadata.vue:102`. Switching DAM to the library's symbol is cleaner but touches 11 use sites in one step and
   buys nothing visible. `validationScopes.ts` stays either way.
5. **File picking: two components, shared insides.** Keep `FileUpload.vue` in DAM for the full-window zone and folder
   walking; replace its private check and drag watcher by the library's two composables. Moving the button variants
   onto `AFileInput` is optional and saves little. Do not try to teach `AFileDropzone` folders, DAM's text and DAM's
   look for one consumer.
6. **Limit dialog.** Leave it in `AssetUpload.vue`. Port the library's one-line Esc fix into it
   (`@keydown.esc="onDialogCancel"`) as the allowed bug fix. Sharing the dialog would need a new callback prop, a limit
   prop and removal of the injection for about 40 lines of template.
7. **Mass-operation `aria-label`s** come to DAM for free with the library's form; nothing to decide.
8. **Tests.** Rewrite the three DAM tests that mock `useDamConfigState` on the package to seed `useDamConfigStore`
   before the swap, so they fail for the right reason if something else breaks. Drop `fileValidation.test.ts` in favour
   of the library's.
9. **Leave alone:** `AssetLink.vue`, the four panel components, the four footer composables, `uploadQueueIds.ts`,
   `AssetUpload.vue`. Add a comment in the library stylesheet that `--list` and `--simple` are DAM's.

---

## 11. Not verified / inferred

- Nothing was executed. Every statement about a test failing, a type error or a mock not reaching bundle-internal
  calls is inferred from reading.
- "Not visible" for the JPEG vs SVG placeholder rests on the library commit message and a comparison by eye.
- Whether any production ext system sets `custom_metadata_pinned_amount` to 0 is unknown; only the local backend
  checkout was read.
- That the backend sends `ttsAudio` to other admins is read from the bundle version installed in that checkout.
- The dropped-folder behaviour of the library zone and the Esc consequence in DAM's limit dialog are inferred from the
  code and standard browser behaviour.
