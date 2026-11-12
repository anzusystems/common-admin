# Nález #34 — list editory bez registrácie v unsaved guarde

Rozbor po editoroch (2026-09-28). Kontrola `describeSortableLists` (`unsavedRegistration`) hlási editor, ktorého úvodný tag nemá `:unsaved-section-label`, holé `disable-unsaved` ani holé `readonly`.

## Čo znamenajú tie tri možnosti

- `:unsaved-section-label="…"`: editor zaregistruje pomenovanú sekciu. Guard stránky sa pri odchode spýta a v dialógu ukáže jej názov.
- `disable-unsaved`: vypne žlté riadky a registráciu sekcie. `hasUnsaved`, ktoré čítajú volajúci (`useListEditorController.ts:294`, cez `defineExpose` v editore), tým vypnuté nie je. Kde okolitý kód číta `editor.hasUnsaved` (mostík `unsavedKeys`, ručný `useUnsavedSection`), sa správanie pri odchode nezmení. Zmiznú len žlté riadky.
- `readonly`: editor nemá neuložený stav.

## Oprava kontroly (súvisiaca, opravená)

Kontrola maskovala hodnoty v úvodzovkách naprieč celým súborom. Nespárovaná úvodzovka (apostrof v komentári `editor's`, `t('…')` v `{{ }}`) sa spárovala s úvodzovkou o veľa riadkov ďalej a tag editora zmizol. Prehliadla tak 4 editory:

- dam `PodcastEditForm.vue:165`
- cms `ArticleWidgetRedirect.vue:217`
- cms `ContentItemKindAggregationForm.vue:157`
- cms `EmbedRelatedDialog.vue:249`

Teraz sa každý tag číta od `<` po prvé `>` mimo úvodzoviek a úvodzovky sa párujú len v ňom (`unregisteredListEditorTags` v `src/testing/sortableLists.ts`, test v `guardTests.test.ts`, mutácia so starým maskovaním padá). Spolu je to 33 editorov: forum 1, dam 3, cms 29.

## Guardy v adminoch

- **cms:** každá edit stránka (~65) a tri dialógy majú `useUnsavedChangesGuard`. Väčšina má `sources: []`; stránky, články, auto-distribúcie, public exporty a rss feedy majú `[unsavedKeys]`; kvízy a recenzie `[listsDirty]`.
- **forum, dam:** `useUnsavedChangesGuard` nie je nikde, takže samotný label tam nič neurobí, kým stránka nedostane guard.

## Tabuľka

„Pokryté“ = odchod zo stránky sa už dnes spýta. „K“ = mostík content itemu: kind formulár zapisuje `hasUnsaved` do `v-model:unsaved-keys` (`ContentItemKindBoxForm.vue:78-90`) → `ContentItemManage.vue:261` → dialóg obsahu stránky / `PageContentsManage.vue:136-146` / `PageEdit.vue:498` → `pages/[id]/edit.vue:39` `sources: [unsavedKeys]`. Auto-distribúcie rovnako cez `AutoDistributionManage.vue:102`.

| # | súbor:riadok | edituje | ukladá | pokrytie | pôvod | návrh |
|---|---|---|---|---|---|---|
| 1 | forum `WidgetThemeClusterPalette.vue:85` | `clusterPalette` | save stránky + `commit` | forum nemá guard | label pridaný v `61fe39e`, o 6 h zmazaný v `a69a729` — funkčne bez rozdielu: forum nemá guard, label bez neho nerobí nič | label `forum.widgetTheme.model.clusterPalette` + guard stránky |
| 2 | dam `DistributionCategorySelectEditForm.vue:40` | `options` | save stránky, `validateAll`, `commit` | dam nemá guard | `bab00080` nahradil ručný `useSortable` bez sledovania | label `coreDam.distributionCategorySelect.model.options` + guard |
| 3 | dam `DistributionManage.vue:134` | distribúcie assetu | každá akcia volá API | nikdy nie je dirty (reload remountuje) | `a8da3a07` | `disable-unsaved` (pohľad na dáta zo servera) |
| 4 | cms `ArticleWidgetArticleBookmarks.vue:424` (dialóg) | `bookmark.items` | potvrdenie dialógu | vlastná sekcia `:99` + mostík; zatvorenie dialógu zahodí potichu | `b8bdce394` | label na tag, zmazať ručnú sekciu `:99-102` |
| 5 | cms `ArticleWidgetThirdPartyTracker.vue:206` | trackery | vlastný PATCH widgetu | vlastná sekcia `:74` | `b8bdce394` | label na tag (presun) |
| 6–7 | cms `PublicExportManage.vue:218`, `:240` | `advertising`, `placedContentItems` | save stránky | vlastná sekcia `:84` + `unsavedKeys` | `b8bdce394` | label na tag (presun) |
| 8 | cms `QuizManageQuestionAnswers.vue:65` (vnorený, zdvihnutý controller) | odpovede otázky | save stránky | label vonkajšieho editora + `listsDirty` | zámer | label (v dialógu pribudne „Odpovede“ za každú otvorenú otázku) alebo výnimka pre `embedded` / `:editor` v kontrole |
| 9 | cms `ArticleIntentionItemManage.vue:31` (vnorený) | zámery kategórie | save stránky | label vonkajšieho editora | zámer | ako #8 |
| 10–25 | cms `ContentItemKind*Form.vue` (Search, SimilarArticles, BoxHistory ×2, Minute, AugmentBox ×4, ArticleList ×4, Box ×3) | pozície layoutu, reklamy, teleport, cyklus | save hostiteľa | K | `b8bdce394`, mostík zámerne | label s kľúčom nadpisu nad zoznamom (`cms.contentItemKind.model.*`) |
| 26 | cms `PageContentsManage.vue:297` (jeden na pozíciu) | obsahy pozície | save stránky | sekcie po pozíciách `:151` + `unsavedKeys` | `b8bdce394` | label na tag, zmazať ručnú sekciu `:151-158` |
| 27 | cms `RelatedItemForm.vue:131` | viacpoložkový zoznam | — | jediný volajúci (`BreakingNewsForm:64`) posiela `max-count=1`, vetva sa nikdy nerenderuje | mŕtvy kód od `3abac056b` | na rozhodnutie: zmazať vetvu (odporúčané), alebo label |
| 28 | cms `BoxSelectionManageDialog.vue:130` | pracovná kópia filtra boxov | potvrdenie dialógu | bez guardu, zatvorenie zahodí | `2e6b2eaa8` | na rozhodnutie: skôr `disable-unsaved`, alebo guard dialógu + label |
| 29 | cms `LiveBlogPostAuthorsForm.vue:69` | autori postu (store) | publish/update v dialógu | dialógy layoutu, žiadny guard | `b8bdce394` | `disable-unsaved`; rozhodnuté: label (žlté riadky ostávajú) |
| 30* | dam `PodcastEditForm.vue:165` | `exportData` | save stránky + `commit` | bez guardu | `a8da3a07` | label `coreDam.podcast.model.exportData` + guard |
| 31* | cms `ArticleWidgetRedirect.vue:217` | `draftLinks` | Apply, potom save článku | vlastná sekcia `:79` (aj `pendingApply`) | `caee945ab` | label na tag, vlastná sekcia nechá len `pendingApply` |
| 32* | cms `ContentItemKindAggregationForm.vue:157` | `contentItems` | save hostiteľa | K | `b8bdce394` | label |
| 33* | cms `EmbedRelatedDialog.vue:249` | položky embedu | potvrdenie dialógu | guard článku dosiahnuteľný, zatvorenie zahodí | `b8bdce394` | label `editor.node.embedRelated.items`; rozhodnuté: `editor.node.embedRelated.name` („Súvisiaci článok“, `.items` je „Položky:“) |

\* kontrola ich predtým prehliadla.

## Čo z toho vyplýva

- **Väčšina cms je zámer, nie chyba.** Migrácia (`b8bdce394`) dala label každému zoznamu na úrovni stránky. Vnorené a dialógové zoznamy premostila zámerne. Odchod sa pri nich pýta už dnes (K, ručné sekcie). Kontrola vidí len tag, nie mostík. Label by do potvrdzovacieho dialógu len doplnil názvy. `disable-unsaved` by kontrolu tiež uspokojil a odchod by sa pýtal ďalej, ale zmizli by žlté riadky, ktoré formuláre po uložení zámerne čistia.
- **Ručné sekcie (#4–7, #26):** presunúť label na tag a zmazať ručný `useUnsavedSection` je rovnaké správanie s menej kódom. #31 sa dá len rozdeliť.
- **Skutočné medzery:**
  - forum paleta (#1): bez guardu stránky (label bez neho nerobí nič, ani pred `a69a729`);
  - dam edit stránky bez guardu (#2, #30);
  - dialógy, ktoré pri zatvorení potichu zahodia pracovnú kópiu (#28, #29, #33);
  - mŕtva vetva (#27).
- **Návrh poradia:**
  1. forum #1 a dam #2, #30 (label + guard stránky, ako má cms);
  2. cms label na tagy tam, kde je mostík (#10–26, #32, #33) a presun ručných sekcií;
  3. #3 a #29 `disable-unsaved`;
  4. rozhodnúť #8/#9 (label vs. výnimka), #27, #28;
  5. potom zapnúť `unsavedRegistration` vo forum, dam a cms.

## Riešenie (2026-09-28, vlastník: všetky odporúčané možnosti)

- forum téma widgetu (edit), dam výber distribučnej kategórie a podcast (edit): guard `useUnsavedChangesGuard({ sources: [] })` + `AUnsavedConfirmDialog` ako v cms, zoznam s labelom (forum zmazanie posiela `:guard`, aby sa po zmazaní nepýtal); stránka „nový“ vo forum bez guardu (`onCreate` presmeruje bez callbacku, guard by sa pýtal po úspešnom vytvorení).
- cms: 19 nových labelov (#10–25, #32, #33, #29 — pri #29 label namiesto pôvodne navrhnutého `disable-unsaved`, podľa odporúčania v rozhodovaní: žlté riadky ostávajú, dnes bez guardu); ručné `useUnsavedSection` záložiek (#4), trackerov (#5), public exportu (#6, #7) a obsahov stránky (#26) nahradené labelom na tagu (sekcie čítali `hasUnsaved` toho istého editora; záložky sú vo `VDialog v-if`); presmerovania (#31) label na tagu, ručná sekcia už len pre `pendingApply` a len kým znovu otvorený editor nemá vlastné neuložené riadky (inak by dialóg uviedol label dvakrát: po Apply sa editor dá znovu otvoriť).
- `disable-unsaved`: dam distribúcie assetu (#3), cms výber boxov (#28; logika dialógu `hasUnsaved` ostáva).
- #27: vetva so zoznamom a prop `maxCount` v `RelatedItemForm` zmazané (volajúci posielal 1); zobrazenie jednej položky aj pole s jednou položkou ostávajú.
- #8, #9: kontrola v knižnici vynecháva editor so zdvihnutým controllerom (`:editor`), registruje vonkajší.
- cms vytvorenie auto-distribúcie volá pred presmerovaním `guard.acknowledge()`: labelované editory obsahu by sa inak pýtali po úspešnom vytvorení.
- `unsavedRegistration` zapnuté vo forum, dam a cms.
