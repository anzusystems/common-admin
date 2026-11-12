# B10: every use of the library's i18n singleton

Library at `feat/list-editors` (paths relative to `src/`), admins at `upgrade-sep-2026`.
"Import-time" = the value is read when the module is evaluated, so it would break if the instance were only assigned in `install()`.
"Call-time" = read inside a function each time, so an instance assigned in `install()` works as-is once `i18n.global` becomes `getCommonI18n()`.

## Library (23 modules import `@/plugins/i18n`, 21 shipped)

| Site | What it does | When it reads | Breaks if set in install()? |
|---|---|---|---|
| plugins/i18n.ts:48 | `export const i18n = createI18n<[MessageSchema], string, false>(…)` singleton, pluralRules sk+cs, missing handler en+sk | import | it is the singleton |
| lib.ts:82, :1103-1104 | re-exports `i18n`, `slovakPluralizationRule` (+ `messagesSk/En/Cs` :208-210, :1012-1014) | — | public API |
| validators/vuelidate/common/useValidateRequired.ts:4 | `const { t } = i18n.global` → `createI18nMessage({ t })` | **import** | **yes** |
| …/useValidateRequiredIf.ts:4 | same | **import** | **yes** |
| …/useValidateMinLength.ts:4 | same | **import** | **yes** |
| …/useValidateMaxLength.ts:4 | same | **import** | **yes** |
| …/useValidateMinValue.ts:4 | same | **import** | **yes** |
| …/useValidateMaxValue.ts:4 | same | **import** | **yes** |
| …/useValidateBetween.ts:4 | same | **import** | **yes** |
| …/useValidateEmail.ts:4 | same | **import** | **yes** |
| …/useValidateHexColor.ts:4 | same | **import** | **yes** |
| …/useValidateNumeric.ts:4 | same | **import** | **yes** |
| …/useValidateSlug.ts:4 | same | **import** | **yes** |
| …/useValidateUrl.ts:4 | same | **import** | **yes** |
| …/useValidateStringArrayItemLength.ts:5 | same | **import** | **yes** |
| …/useValidateCompareDates.ts:6 | same | **import** | **yes** |
| components/damImage/uploadQueue/composables/damNotifications.ts:11 | `const { t } = i18n.global`, used :43 (warning toast) | **import** | **yes** |
| components/dam/assetSelect/composables/commonAdminCoreDamOptions.ts:6 | `const { t } = i18n.global`, default labels :35-43 | **import** | **yes** |
| composables/system/alerts.ts:30,44,58,72,77,87,97,132,146,156,207 | `const { t, te } = i18n.global` inside each `show*T`/`showValidationError`/`showRecordWas`/`showApi*`/`resolveListErrors` | call | no |
| components/damImage/uploadQueue/composables/uploadService.ts:39 | inside `handleValidationErrorMessage` | call | no |
| components/file/composables/formatAndSizeCheck.ts:38 | inside `checkFormatsAndSizes` | call | no |
| labs/filters/datatableColumns.ts:40-41 | `options.customI18n ?? i18n` inside `createDatatableColumnsConfig` (206 admin call sites, 0 pass `customI18n`) | call | no |
| composables/languageSettings.ts:4,41 | `modifyLanguageSettings(…, i18nInstance?: any)` defaults to the singleton; `ALanguageSelect.vue:23` calls it **without** an instance → switches only the singleton | call | no (make the default lazy) |
| plugins/vuetify.ts:6 | Vuetify adapter, playground only | import | playground only |
| playground.ts:5, playground/filterView/subjectTools.ts:3 | playground | import | playground only |
| plugins.d.ts:1 | `MessageSchema` type for the `DefineLocaleMessage` augmentation | type | no |

Module-level composable calls the doc flagged:
- `components/damImage/uploadQueue/api/damAssetApi.ts:221` `const { showUnknownError, showApiValidationError } = useAlerts()` — **harmless**: `useAlerts()` reads `i18n.global` inside each `show*` at call time.
- `components/damImage/uploadQueue/author/authorValidation.ts:8` `const { required, minLength } = useValidate()` — harmless by itself; it only wraps the `t` the validator modules captured at import. Fixed by fixing the 14 validators.
- No other module-level `useAlerts()`/`useValidate()` in `.ts` library files (the ~45 other hits are `<script setup>` bodies, i.e. per instance).

## Admins importing the library singleton `i18n` (47 imports, 41 outside loadLanguageMessages)

All translate **admin** keys through the library singleton, which works only because every `loadLanguageMessages.ts` copies the full admin tree into it.

| Admin | Site | Reads |
|---|---|---|
| cms | src/loadLanguageMessages.ts:1,23-24 (`setLocaleMessage`, `locale.value =`) | sync |
| cms | src/plugins/vuetify.ts:1,15 (Vuetify adapter) | import |
| cms | src/shared/validators/vuelidate/useValidateAnchor.ts:4, useValidateDateInFuture.ts:6, useValidateDateRange.ts:8, useValidateDocId.ts:4, useValidateHexColor.ts:4, useValidateRouteSettings.ts:4, useValidateRouteUriFull.ts:4, useValidateStringList.ts:5, useValidateStyleClass.ts:4 | import (9) |
| cms | src/domains/cms/scenario/composables/scenarioValidations.ts:15; …/blockPlaceholder/composables/blockPlaceholderDialogValidations.ts:11 | import (2) |
| cms | …/anzutap/extensions/linterDemoExtension.ts:55, pasteDamAssetExtension.ts:254, slashCommands/composables/suggestion.ts:17, tableCaptionExtension.ts:37; src/domains/cms/shared/valueObject/WebEntityType.ts:9 | call (5) |
| blog | src/loadLanguageMessages.ts:1,22-23 | sync |
| blog | src/plugins/vuetify.ts:15 | import |
| blog | src/domains/blog/job/composables/jobValidations.ts:11, routeSettings/composables/routeSettingsValidations.ts:8 (`i18n.global \|\| i18n`), src/shared/validators/vuelidate/useValidateUri.ts:4 | import (3) |
| forum | src/loadLanguageMessages.ts:1,22-23 | sync |
| forum | src/plugins/vuetify.ts:15 | import |
| forum | src/domains/forum/clusteringProfile/composables/clusteringProfileValidations.ts:10, job/composables/jobValidations.ts:15 (`\|\| i18n`), src/shared/validators/vuelidate/useValidateDigitList.ts:5, useValidateUuid.ts:4 | import (4) |
| inhouse | src/loadLanguageMessages.ts:1,22-23 | sync |
| inhouse | src/plugins/vuetify.ts:15 | import |
| inhouse | src/domains/weather/locationGroup/composables/locationGroupActions.ts:195; src/shared/validators/vuelidate/useValidateDayInMonth.ts:7, useValidateJsonObject.ts:6, useValidateLatitude.ts:4, useValidateLatitudeNotZeroAsLongitude.ts:5, useValidateLongitude.ts:4, useValidateLongitudeNotZeroAsLatitude.ts:5, useValidateSlovakPhoneNumber.ts:4 | import (8) |
| ugc | src/loadLanguageMessages.ts:1,22-23 | sync |
| ugc | src/domains/blog/blog/composables/blogAssetLicence.ts:7 | import |
| ugc | src/domains/anzutap/extensions/slashCommands/composables/suggestion.ts:14 | call |
| ugc | src/plugins/vuetify.ts:9 already uses the admin's own `@/plugins/i18n` | — |
| dam | src/loadLanguageMessages.ts:1,21-22 | sync |
| dam | src/plugins/vuetify.ts:3,14 | import |
| dam | src/domains/coreDam/asset/api/fileApi.ts:131, asset/store/uploadQueuesStore.ts:63, shared/services/upload/uploadService.ts:33,60,69 (all `\|\| i18n`) | call (3 files) |

Other lib i18n exports in admins: `messagesSk` 6 (every `locales/sk.ts`), `messagesEn` 2 (cms, dam `locales/en.ts`), `messagesCs` 1 (forum), `slovakPluralizationRule` 8 (6× plugins/i18n.ts, cms shared/i18nContent.ts, cms test proofreadingStrings.test.ts), `modifyLanguageSettings` 6 (loaders, all pass the admin instance).

Admin tests that install the plugin (must pass `i18n` if it becomes required): cms/blog/forum/inhouse/dam `src/test/listEditorUnsaved.test.ts`, ugc `src/test/listEditorUnsaved.test.ts` + `src/test/relatedArticlesReorder.test.ts` (7). Library: `src/test/setup.ts` (installs its own `createI18n`; the singleton used by alerts/validators in tests is empty).

Reproduce: `node b10-find-lib-i18n-imports.mjs <admin roots>`.
