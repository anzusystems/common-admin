# Katalóg `$scope` vzorov vo flotile

Stav 2026-09-26, dva nezávislé prechody kódom (len čítanie) + tretí, ktorý tvrdenia z prvých dvoch adversariálne overil. Opravy z overenia sú priamo v texte (**Oprava**). Cesty sú relatívne k `src/` daného repa.

## Ako Vuelidate 2.0.3 zbiera (overené testom `runtime/test/vuelidate.test.mjs`)
- Každá inštancia `useVuelidate` hlási výsledky **len inštanciám najbližšieho predka**, ktorý volá `useVuelidate` (`inject` číta provides rodiča, `@vuelidate/core/dist/index.mjs:663`).
- Prijímač berie dieťa, ak `receiver.$scope === true` (default) alebo `receiver.$scope === child.$scope`. Nikdy, ak je `false` na ktorejkoľvek strane alebo má dieťa `$stopPropagation` (`:650`).
- Následky: medzikomponent s iným scope potomkov **tieňuje**; dve inštancie v tom istom komponente sa nevidia; `$scope: undefined` = `true`.
- Collector `true` berie aj deti so Symbol scope (forum na tom stojí).

## Počty podľa repa
| Repo | volania | Symbol/string collectory | `useVuelidate()` | `$scope:false` | stopProp |
|---|---|---|---|---|---|
| cms | 332 | 97 (91 v composables, 6 vo .vue) | 0 | 33 | 7 |
| dam | 65 | 2 | 21 | 0 | 1 |
| ugc | 21 | 7 | 0 | 0 | 3 |
| forum | 30 | 0 | 15 | 0 | 0 |
| inhouse | 59 | 0 | 23 | 0 | 0 |
| blog | 20 | 0 | 10 | 0 | 0 |
| common-admin | 35 | 12 | 6 | 1 | 4 |

- 102 deklarácií `Symbol.for('anzu:<app>:…')` v 94 súboroch, typicky v `composables/*Validation(s).ts`; 5× `Symbol()` v cms `domains/ai`; stringy `'embed'` (16), `'customFormDemo'`, v knižnici `'AFilterTimeIntervalScope'`.
- **Žiadny scope nie je reaktívny** (číta sa raz v setup). inhouse `shared/validators/vuelidate/useJsonObjectTextValidation.ts:13` robí jednorazový `.value`.
- Nepoužíva sa nikde: `$registerAs`, `$externalResults`, `$lazy`, `$rewardEarly`, `$silentErrors`, `$commit`, `$getResultsForChild`, `$model`, `helpers.withAsync`, async validátory, Options API.

## Vzory
| # | Vzor | Počet | Príklad |
|---|---|---|---|
| P1 | collector v `*Actions.ts` volaný zo stránky/dialógu | cms 91 composables v 266 .vue | cms `domains/cms/faq/composables/faqActions.ts:88` |
| P2 | `useVuelidate()` bez parametrov (default `true`) | dam, forum, inhouse, blog, knižnica `labs/anzuUser` | dam `keyword/composables/keywordActions.ts:98`, forum `job/composables/jobActions.ts:91` |
| P3 | reťaze s rovnakým scope | 79 z 91 composables zbierané na 2 úrovniach; 3+ úrovne: Page, PublicExport, `ACustomDataForm` → `ACustomDataFormElement`, `AUserSystemOverview` → `AUserCreateInSystemButton` | faq `edit.vue:34` → `FaqManage.vue:27` |
| P4 | riadkové formuláre vo v-for | ~13 s pevným Symbolom, ~17 so scope z propu; 11 list editorov cez `useListEditorScopeValidity.ts:71-86` | `FaqItemForm`, `MultiTitleItemForm`, `TimelineEventForm` |
| P5 | `$scope: false` (izolované dialógy, blokujú aj potomkov) | cms 33 | 17× `JobCreateForm*.vue`, 6 anzutap embed dialógov |
| P6 | `$stopPropagation` | 15 | cms `LinkDialog.vue:110`, `ButtonDialog.vue:109`; knižnica `UploadQueueDialog.vue:73`, `AssetDetailSidebarMetadata.vue:44`, `FilterBookmarkDialog.vue:135`, `AImagePublicInput.vue:74` |
| P7 | `validationScope` prop drilling | cms 74 komponentov, 95 call sites (78 bound, 17 static) + hub `ContentItemManage.vue:267` (40 formulárov), `LinkedListItemKindManageDialog.vue:167` (10) | `CustomForm` 17×, `PropertyValueForm` 10× |
| P8 | rovnaký scope, dva collectory naraz | pozri nižšie | dam asset list, cms keyword management |
| P9 | pravidlá, ktoré dnes žiadna brána nevidí | **16 brán** (pozri nižšie) | cms `keyword/composables/keywordValidations.ts:34` |
| P10 | collector s vlastnými pravidlami ako brána | `PageContentItemManageDialog.vue:39/54`, `UserAuthorWizardStepAuthorCreate.vue:47/108`, knižnica `ImageDetailDialogMetadata.vue:100/105`; medzičlánky `FaqManage.vue:28`, `SiteManage.vue:67`, `LinkedListManage.vue:166` | |
| P11 | nested routes / keep-alive | **žiadne** (jeden `<RouterView :key="route.path">`, KeepAlive len actionbar) | cms `App.vue:32` |
| P12 | collector mimo `$touch`/`$invalid` | `$errors` filtrované podľa `$propertyPath` (cms `organizationActions.ts:84`, `personActions.ts:108`), `$validate` cez `ACustomDataForm.vue:66` (articleEdit + 13 embed dialógov), collectory v Pinii, `:v="v$"` do `ACreateDialog` (cms 3, dam 13, ugc 2, inhouse 25) | |

### P8 — dva collectory s rovnakým scope naraz
- **dam asset list** (`AssetListView.vue`): sidebar je vždy namontovaný (`:199`), detail dialóg sa montuje pri otvorení (`:132`, tab metadata `AssetDetailDialogSidebar.vue:155`), pätička `AssetFooterSelectedFull.vue:56` (`useVuelidate()`, prijme aj tento scope). **Oprava:** všetky tri naraz sú nepravdepodobné, sidebar+detail a sidebar+pätička áno. Vo Vuelidate sa nemiešajú (strom), natívny Regle scope by ich miešal.
- **cms keyword management**: každý riadok `KeywordManagementDatatable.vue:131-143` má 3 tlačidlá, každé s vlastným collectorom (`keywordManagementActions.ts:75`); merge pravidlá sú v setup tlačidla mimo lazy dialógu (`KeywordMergeButton.vue:39`). App-wide by každá brána riadku videla prázdne merge formuláre všetkých riadkov.
- Neškodné duplicity: `usePermissionGroupActions` v každom autocomplete/filtri, `ArticleButtonCreate.vue:94` v každom riadku `TaskTableServer.vue:123`.

### P9 — 16 brán, ktoré dnes potichu preskakujú pravidlá (všetky cms)
**Oprava:** prvý prechod uvádzal ~55 (počítal call sites), overenie napočítalo 16 brán.

| Príčina | Brány |
|---|---|
| dieťa s default scope pod Symbol collectorom (11) | keywords/new (`KeywordCreate.vue:20` bez scope → žiadne create pravidlo sa nevynúti) · PageContent dialóg, auto-distribution new/edit (`ContentItemBaseAdvancedForm`, `limitedDisplayType: required`, `contentItemKindValidations.ts:828`; 34 call sites bez scope) · rss-feeds new/edit · public-exports new/edit · advert-settings new/edit (`AdvertSettingsManage.vue:144`, kryje `validateAll`) · bookmarks (`ArticleWidgetArticleBookmarks.vue:443`) |
| collector a pravidlá v tom istom komponente (3) | `EmbedRelatedDialog.vue:181/183` (`embed.title` min/max sa nekontroluje) · `KeywordMergeButton.vue:36/39` · `PeopleEventDialog.vue:13/16` |
| filter podľa `$propertyPath` (2) | `organizationActions.ts:84`, `personActions.ts:108` (blokujú len pri chybe s „organization“/„person“ v ceste) |

Ďalej:
- `ContentItemBaseAdvancedForm` je aj tieňujúci medzikomponent: so scope `true` prijme Symbol riadky zo slotu `#advanced-form` a hlási hore ako `true` → kind form ich zahodí (AdvertDtoForm, ArticleListItemLayoutDtoForm, BoxPositionIncludeForm, PropertyValueForm v ArticleList/Box/BoxHistory/AugmentBox/Minute). Čiastočne kryje `validateAll()`. Podobne `ArticleItemLayoutForm` v `BoxPositionIncludeForm.vue:59`.
- `articleEditActions.ts:304` a `:495` robia `$touch` na `multiTitleScope`, ale nekontrolujú jeho `$invalid` (len `:662`).
- knižnica `ADatetimePicker.vue:94` (`requiredIf(props.required)`, default scope): Symbol brány ho ignorujú, `true` collectory (forum, dam) ho vynucujú.
- **Oprava:** `LinkedListItemKindManageDialog.vue:51` netieňuje nič — všetkých 9 item formulárov dostáva `LinkedListItemDialogValidationSymbol` (`:167`), dialóg je samostatná zámerná brána.
- **Potvrdené:** forum stránky (jobs, codexes, prompts, clustering-profiles) majú strom page `useVuelidate()` → ACard → VCardText → `XManage` bez medzičlánku; zber funguje vďaka collectoru `true`.

## Najzložitejšie stromy cms (⊕ collector, * jeden na riadok)
```
Article  pages/(cms)/articles/[id]/edit.vue:246-247 → articleOneStore
├ 7 widgetov useArticleUpdateValidation (articleValidations.ts:116)           [Article]
├ ArticleWidgetMultiTitle → MultiTitleItemForm*                               [MultiTitle]
├ ArticleWidgetThirdPartyTracker.vue:98 ⊕ → ThirdPartyTrackerItemForm*        [3rdParty]
├ ArticleWidgetArticleBookmarks.vue:112 ⊕ → RelatedItem forms*               [Bookmark]
├ ArticleWidgetCustomForm → CustomForm → ACustomDataForm ⊕ → elements         [CustomData]
└ AnzutapEditor → dialógy (stopProp) | Embed*Dialog → CustomForm['embed'] | EmbedRelatedDialog ⊕

Page  pages/(cms)/pages/[id]/edit.vue:36 ⊕                                  [Page]
└ PageEdit.vue:52 ⊕ +:113 rules → PageContentsManage.vue:40 ⊕               [Page]
  └ PageContentItemManageDialog.vue:39 rules⊕ (brána :54)                     [PageContent]
    └ ContentItemManage → Kind*Form → Dto/Advert/PropertyValue riadky

PublicExport  publicExportActions.ts:116 ⊕ → PublicExportManage.vue:95 ⊕ +:99 rules   [PE]
  ├ PublicExportFormManage.vue:45 rules → KindBoxForm → Dto riadky*
  └ PlacedContentItemForm* :259 → ContentItemManage → Kind forms → riadky (hĺbka 7)

Site  siteActions.ts:113 ⊕ → SiteManage.vue:66 ⊕ +:67 rules                 [Site]
LinkedList  linkedListActions.ts:93 ⊕ → LinkedListManage.vue:34 ⊕ +:166 rules [LinkedList]
  └ LinkedListItemKindManageDialog.vue:51 ⊕ (samostatná brána)               [LLItemDialog]
```

## Fakty pre migráciu
- **`$reset()` — 31 volaní** (cms 24, dam 2, ugc 2, knižnica 3). Všetky resetujú inštanciu s pravidlami okrem `AUserCreateInSystemButton.vue:72` (collector). Mnohé resetujú a hodnoty nechávajú (`ArticlePropagation.vue:103`, `PageCreateButton.vue:109-110`, dam `DistributionCategoryCreateButton.vue:83`, `CommentDialogs.vue:48/53/57`, `BlockPlaceholderDialog.vue:38`). Regle `$reset()` hodnoty ponechá (overené), takže bez rizika.
- **`helpers.forEach` — 7× v cms** (`contentItemKindValidations.ts:218/471/1157/1297`, `pollValidations.ts:63`, `quizValidations.ts:40/54`). Žiadna šablóna nečíta `$each`/`$response`/per-item `$message`, pravidlá len prepínajú `$invalid` brány → priamo `$each`.
- **Validátory so `siblings`/`vm` — 18** (žiadne v cms, ugc, knižnici; `this` nikde): dam `jobValidations.ts:17-31`; forum `jobValidations.ts` (8), `clusteringProfileValidations.ts:13-45`; blog `jobValidations.ts:14/45/66`; inhouse `schoolHolidayValidations.ts:19-27`, `useValidateDayInMonth.ts:21-29`, `useValidateLatitudeNotZeroAsLongitude.ts`/`useValidateLongitudeNotZeroAsLatitude.ts` (`vm.required` = prop `GeoLocation.vue:18`). → `createRule` s getter parametrom (overené `regleFeatures.test.mjs`).
- **Priame čítanie `$errors`/`$message`/`$params` mimo AForm\*:** cms `EmbedElectionDialog.vue:144,156`, `ContentItemKindAugmentBoxForm.vue:732-735` (aj `$uid`), `PromoLockManage.vue:127`, `SiteGroupAutocomplete.vue:76,82`, `KeywordRemoteAutocomplete.vue:286,305`, vlastné `AFormCombobox.vue:18`, `AFormJson.vue:104`, definície `useValidateStringList.ts:24`, `useValidateDateRange.ts:26,66`; dam `DistributionCategorySelectOptionSelect.vue:53`, `AssetToolbarExtSystemLicenceDialog.vue:117`, `DistributionBlockedBy.vue:111`; forum `ViolationSelect.vue:47,52`, `useValidateDigitList.ts:24`; inhouse `GeoLocation.vue:150-157`; knižnica `ACustomDataFormElement.vue:95`, `ADatetimePicker.vue:187`, `AUserMetadataForm.vue:266`, `useValidateCompareDates.ts:57-68`, `useValidateStringArrayItemLength.ts:16-22`. `$silentErrors` a `$property` nikde.
- **Inštancie mimo setup:** Pinia refy cms `article/store/articleOneStore.ts:19-20`, ugc `blog/gallery/store/gallery.ts:22` (dvaja zapisovatelia, vyhrá posledný), `blog/article/store/article.ts:18` — všetky priradené v `<script setup>`. Jediná inštancia mimo setup: cms `notificationActions.ts:112`.
- **Knižnica — čo komponenty čítajú z `v`:** 9 form polí `$path` (všetky, collab zámky), `$errors[].$message` + `$touch()` (7), `required.$params.type === 'required'` (6); `ACreateDialog` len `$touch()` + `$invalid`. `$dirty` nikto.
