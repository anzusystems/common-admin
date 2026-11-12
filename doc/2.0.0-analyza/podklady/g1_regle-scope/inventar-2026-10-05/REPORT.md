# Inventár Vuelidate v 6 adminoch (2026-10-05)

Prepočet nad aktuálnymi pracovnými stromami (všetky na `upgrade-sep-2026`, čisté). Čísla z AST skriptov v tomto priečinku; stromy a brány zo statickej simulácie pravidla „najbližší predok“ a čítania kódu. Nič sa v adminoch nespúšťalo ani nemenilo. Nahrádza čísla v `../katalog-scope.md` (ten ostáva pre vzory P1–P12).

Prefixy: `CMS=/home/volar/projects/petit/admin-cms/src`, `BLOG`, `FORUM`, `INH`, `UGC` = `/home/volar/projects/petit/admin-{blog,forum,inhouse,ugc}/src`, `DAM=/home/volar/projects/anzusystems/admin-dam/src`. Cesty bez prefixu sú pod `domains/<systém>/…` daného repa.

## 1. Počty
| | cms | blog | forum | inhouse | ugc | dam |
|---|---|---|---|---|---|---|
| súbory s `@vuelidate/core` | 281 (2 testy) | 20 | 32 | 57 | 20 | 61 |
| súbory s `@vuelidate/validators` | 29 | 3 | 4 | 17 | 0 | 2 |
| volania `useVuelidate(` | 341 (339 app) | 20 | 30 | 59 | 19 | 65 |
| collector `()` | 0 | 10 | 15 | 23 | 0 | 21 |
| collector so `$scope` | 99 (93 + 6 `({}, {}, opts)`) | 0 | 0 | 0 | 7 | 2 |
| pravidlá + stav | 3 (1 app) | 10 | 11 | 32 | 0 | 28 |
| pravidlá + stav + config | 239 | 0 | 4 | 4 | 12 | 14 |
| `$scope` = Symbol | 233 | 0 | 4 | 0 | 15 | 4 |
| `$scope: false` | 33 | 0 | 0 | 0 | 0 | 0 literál, 3× `:validation-scope="false"` |
| `$scope` z propu/parametra | 65 | 0 | 0 | 4 | 1 | 11 |
| `$stopPropagation` | 7 | 0 | 0 | 0 | 3 | 1 |
| `$autoDirty` | 27 | 0 | 0 | 0 | 0 | 0 |
| `$reset()` | 25 | 0 | 0 | 0 | 2 | 2 |
| `$validate()` | 11 (5 súborov) | 0 | 0 | 0 | 0 | 0 |
| `helpers.forEach` | 7 | 0 | 0 | 0 | 0 | 0 |
| riadky s `:v=` | 1145 | 59 | 96 | 187 | 49 | 124 |
| komponenty s propom `validationScope` | 74 | 0 | 0 | 4 (nikdy nenaviazaný) | 0 | 8 |
| väzby `validation-scope` | 94 (77 bound, 17 static) | 0 | 0 | 0 | 0 | 10 |
| volania `useValidate()` | 233 | 10 | 15 | 33 | 12 | 38 |
| deklarácie scope Symbolov | 106 `Symbol.for` + 5 `Symbol()` | 0 | 4 | 0 | 10 | 5 |

Klasifikátor volaní (`codemod-dry.txt`): všetky volania automatické, 0 ručných. Stringové scopes v cms: `'embed'` ×16, `'customFormDemo'` ×1.

## 2. Priame importy z `@vuelidate/validators`
- **cms:** `helpers` v 20 súboroch (`withMessage` 25, `regex` 8, `forEach` 7, `req` 2, `withParams` 2), `createI18nMessage` 13, `required` 3 (domains/ai), `integer` 2, `decimal` 1.
- **inhouse:** `integer` 10 súborov, `createI18nMessage` 7, `helpers` 6 (`regex` 3, `req` 3, `withParams` 2, `withMessage` 1); `required`, `minValue`, `maxValue` raz (`INH/domains/weather/locationMonthlySummary/composables/locationMonthlySummaryValidation.ts:2`).
- **blog:** `* as validators` 2 (len `.createI18nMessage`), `createI18nMessage` 1, `helpers.regex` 1.
- **forum:** `* as validators` 2, `createI18nMessage` 2, `helpers.regex` 1.
- **dam:** `* as validators` 1, `helpers` 1 (`withMessage`, `req`). **ugc:** nič.

## 3. Vlastné definície validátorov
Úplný zoznam: `validators-defs.txt` (144 riadkov).
- **cms shared** `CMS/shared/validators/vuelidate/` (11 súborov, kľúče `error.jsValidation.*`): regex cez `createI18nMessage` + `helpers.regex` (`Anchor`, `DocId`, `HexColor`, `RouteSettings`, `RouteUriFull`, `StyleClass`), `Integer` (obal `integer`), `DateInFuture` (funkcia), `{ $validator, $params }` (`ArrayUnique`, `StringList` s `withArguments`, `DateRange` — dve pravidlá s Ref).
- **cms inline:** `createI18nMessage` v `scenarioValidations.ts:19-36`, `blockPlaceholderDialogValidations.ts:15-17`; `helpers.withMessage(() => t(…))` v aiDigest, aiDigestRun (selection, testRun), contentItemKind (:162, :1265), job (deskArticleMigrate, nofollowExternalArticleLinks), personalAccessToken, promptCascade, promptVersion (+ `withParams` :84), `shared/composables/thinkingConfigValidation.ts`, `CMS/shared/components/AFormJson.vue:92`.
- **blog:** `useValidateUri.ts`; na úrovni modulu `jobValidations.ts:14,45,66`, `routeSettingsValidations.ts:10`.
- **forum:** `useValidateDigitList.ts` (`withArguments`), `useValidateUuid.ts`; na úrovni modulu `clusteringProfileValidations.ts:13,25,37,49`, `jobValidations.ts:18…183`.
- **inhouse** `INH/shared/validators/vuelidate/` (8): `Latitude`, `Longitude`, `SlovakPhoneNumber` (regex), `JsonObject`, `DayInMonth` (`withParams`, `req`, siblings), `LatitudeNotZeroAsLongitude`, `LongitudeNotZeroAsLatitude` (siblings + vm), `useJsonObjectTextValidation` (obal `useVuelidate`); inline `schoolHolidayValidations.ts:18-31`.
- **dam:** `jobValidations.ts:16`, `voiceFamilyValidation.ts:18`. **ugc:** nič.

## 4. Validátory s `(value, siblings, vm)` — 19
blog 3 (`jobValidations.ts:15,46,67`), forum 11 (`clusteringProfileValidations.ts:14,26,38`, `jobValidations.ts:19,51,72,90,108,133,161,184`), inhouse 4 (`schoolHolidayValidations.ts:19`, `useValidateDayInMonth.ts:20`, `useValidateLatitudeNotZeroAsLongitude.ts:11`, `useValidateLongitudeNotZeroAsLatitude.ts:11` — posledné dva čítajú aj `vm.required`, prop `GeoLocation.vue:18`), dam 1 (`jobValidations.ts:17`, composable nikde nepoužitý). cms, ugc: žiadne.

## 5. Priame čítania vnútra Vuelidate
- **cms:** `AiDigestManage.vue:76-79` (`$error`, odznak tabu), `aiDigestRunSelectionValidation.ts:101` (`$silentErrors[].$message`), `promptCascadeValidations.ts:61` (`$errors[].$message`), `ContentItemKindAugmentBoxForm.vue:724-733` (`$error`, `$errors`, `$uid`, `$message`), `KeywordRemoteAutocomplete.vue:286,298,305` a `SiteGroupAutocomplete.vue:69,76,82` (`$errors`, `$path`, `required.$params.type`), `organizationActions.ts:93-94` a `personActions.ts:117-118` (`$propertyPath`), `PromoLockManage.vue:124,127`, `EmbedElectionDialog.vue:144,156`, `CMS/shared/components/AFormCombobox.vue:18`, `AFormJson.vue:104`, `MultiTitleItemForm.vue:108` (`$invalid` poľa).
- **forum:** `ViolationSelect.vue:47,52,57-59`, `ExtSystemSelect.vue:51`. **inhouse:** `GeoLocation.vue:150-157`. **dam:** `DistributionBlockedBy.vue:111`, `AssetToolbarExtSystemLicenceDialog.vue:117-118`, `DistributionCategorySelectOptionSelect.vue:53`. **ugc:** `EmbedGalleryDialog.vue:92`, `:153-155` (`v$` dieťaťa cez template ref). **blog:** nič.
- **Nikde:** `$model`, `$response`, `$dirty`, `$anyDirty`, `$pending`, `$externalResults`, `withAsync`; žiadna šablóna nečíta `$each`.

## 6. Inštancie v store alebo mimo setup
- Pinia cms: `article/store/articleOneStore.ts:20-21` (zapisuje `ArticleEditView.vue:179-180`, číta `articleEditActions.ts:350-352, 618-620, 811-813`). Pinia ugc: `blog/gallery/store/gallery.ts:22` (dvaja zapisovatelia), `blog/article/store/article.ts:18`.
- Mimo setup: len `CMS/domains/cms/notification/composables/notificationActions.ts:115` (async handler).
- Validátory na úrovni modulu: blog a forum (sekcia 3); dam volá `useValidate()` na úrovni modulu v 19 composables.

## 7. Typové importy z `@vuelidate/core`
- **cms:** `BaseValidation` (5× aiDigest formuláre), `ErrorObject` (`KeywordRemoteAutocomplete.vue:27`, `SiteGroupAutocomplete.vue:10`), `ValidationRule` (`linkedListItemKindValidations.ts:4`), `Validation` (`personalAccessTokenActions.ts:3`, `taskActions.ts:11`, `customFormActions.ts:10`, 6× `embed*DialogActions.ts`).
- **forum:** `ExtSystemSelect.vue:2`, `ViolationSelect.vue:9`. **inhouse:** `GeoLocation.vue:3`, `LocationRemoteAutocomplete.vue:11`. **ugc:** `BlogRubricSelect.vue:4`, `PublicRubricSelect.vue:4`. **dam:** `DistributionBlockedBy.vue:17`, `AssetToolbarExtSystemLicenceDialog.vue:17`, `DistributionCategorySelectOptionSelect.vue:3`, `userValidation.ts:3`. **blog:** nič. `ValidationArgs` nikde.

## 8. P9 a P8 (stav)
Všetkých 16 brán z P9 stále existuje (cms): keywords/new (`KeywordCreate.vue:20` → `keywordValidations.ts:34`), `ContentItemBaseAdvancedForm` (34 použití bez scope; PageContent dialóg, auto-distributions new/edit), rss-feeds new/edit, public-exports new/edit, advert-settings new/edit (`AdvertSettingsManage.vue:145`, kryje `validateAll`), bookmarks (`ArticleWidgetArticleBookmarks.vue:441`), collector a pravidlá v jednom komponente (`EmbedRelatedDialog.vue:181/183`, `KeywordMergeButton.vue:36/39`, `PeopleEventDialog.vue:13/16`), filter podľa `$propertyPath` (`organizationActions.ts:93-94`, `personActions.ts:117-118`).
Nezmenené: tieňovanie cez `ContentItemBaseAdvancedForm` a `BoxPositionIncludeForm.vue:59`; `articleEditActions.ts:350-352, 618-620` robia touch na `multiTitleScope` bez kontroly.
Noví kandidáti (len statická úvaha): `ArticleEditForm.vue:73` (inštancia s Article scope medzi `ArticleEditView.vue:180` a `MultiTitleItemForm`), `ArticleIntentionItemRow.vue:11`.
P8 stále: dam asset list (`AssetListView.vue:132,199,206`), cms keyword management (`KeywordManagementDatatable.vue:132-140`).

## 9. Stromy (jednotky migrácie)
| | stromy | s collectorom | pravidlá s deťmi | samostatné pravidlá | `$scope:false` | stop |
|---|---|---|---|---|---|---|
| cms | 181 | 97 | 15 | 29 | 33 | 7 |
| blog | 10 | 10 | 0 | 0 | 0 | 0 |
| forum | 15 | 15 | 0 | 0 | 0 | 0 |
| inhouse | 47 | 23 | 9 | 15 | 0 | 0 |
| ugc | 16 | 7 | 1 | 5 | 0 | 3 |
| dam | 50 | 23 | 10 | 14 | 2 | 1 |

V cms patrí 685 súborov do nejakého stromu, 131 zdieľajú dva a viac (hlavne kind formuláre). Zoznamy: `trees.<repo>.txt`.

## 10. Nástroje (rovnaké vo všetkých šiestich)
- `yarn ci`: `generate:dts`, `lint:tsc` (`vue-tsc --build`), `format:check` (oxfmt), `lint:oxlint`, `lint:eslint`, `lint:stylelint`, `test` (`vitest run`, happy-dom).
- Testové súbory: cms 80, dam 28, inhouse 23, forum 22, blog 19, ugc 15. Validácie sa dotýka len cms (7 súborov v `CMS/test/`; `i18n/languageSwitch*.test.ts` montujú skutočný `useVuelidate`).
- e2e je samostatný balík v `e2e/` (Playwright cms 187, dam 61, forum 38, ugc 8; Cypress blog 11, inhouse 20).
- Knižnica v dev: `package.json` pinuje `1.47.0-beta.dev-1790143991`, nainštalovaná kópia je z `copy.sh`; eslint cez `defineAnzuAdminConfig` z `@anzusystems/common-admin/eslint`, oxlint rozširuje `oxlint-admin.json` knižnice.

## 11. Zmeny oproti katalógu z 26.–27. 9.
- 5 menších adminov: rovnaké súbory, posunuté riadky. cms: collectory článku sa presunuli do `ArticleEditView.vue:179-180`; nové domény aiDigest, aiDigestRun, promptCascade (prvé použitie `$silentErrors`, odznaky cez `$error`, podformuláre typované `BaseValidation`); volaní 333 → 341.
- cms má druhú validačnú cestu: `validateAll()` cez `defineExpose` + `:validate` list editora (142 odkazov v 83 súboroch, 90 značiek list editora, 21 s mostom `:validation-scope`).
- dam: scope Symboly v `shared/validationScopes.ts`.
- 10 composables s `useVuelidate`, ktoré nikto nevolá (cms 6, forum 1, dam 2 + `useJobValidation`).
- Knižnica je v `src/domains/…`.
