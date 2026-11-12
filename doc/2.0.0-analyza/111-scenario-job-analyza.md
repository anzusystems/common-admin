# #111 — správa scenario jobu nahradí celý článok na edit stránke (analýza 2026-10-01)

Len čítanie kódu (admin-cms `upgrade-sep-2026`, core-cms `develop`, collaboration `/home/volar/projects/petit/collaboration`), nič nespustené. Neoverené body sú na konci.

## Backend
- Správu `ScenarioJobChangedMessage` posielajú 4 miesta, všetky `OnArticlePublish`: úspech jobu (`ArticlePublishScenarioJobCompleter.php:39-43`, po `publish()`), zlyhanie (`:50-54`, po `rollbackPublishingToDraft`), zrušenie (`ScenarioJobCanceler.php:51-66,72-82`) a úspech oneskorenej úlohy (`AbstractArticleDelayedTaskExecutor.php:55-60`, pre joby každej udalosti, admin filtruje). Vytvorenie ani štart jobu nič neposiela.
- `resource` je ten istý článok (to isté id), načítaný `find` až keď worker správu spracuje (`ScenarioJobChangedHandler.php:37-64`), serializovaný ako admin GET (s `lockingVersion`, `alternateLinks`). Môže teda obsahovať neskoršie zápisy (autosave editora), pri zrušení byť starší.
- Job mení: stav, `modifiedAt`, dátumy publikovania ak chýbajú, `dynamicPaywallEnabled`, body (ProcessBody), `smsCode`; rollback vráti len stav a routy.
- Collab server správu len preposiela do miestnosti (`onRequestHook.ts:56-91`), neukladá; pri vstupe sa neprehrá. Edit stránka vstupuje až po načítaní článku.

## Kedy to zasiahne edit stránku
Bežné postupy nie: publikovanie z edit stránky ide cez `/empty` na detail a odíde z miestnosti, ostatných editorov pred publikovaním vyhodí, druhá karta vyhodí prvú, ne-Draft článok edit stránka presmeruje na detail.
- A: oneskorená úloha uspeje po ZLYHANOM jobe, kým editor opravuje draft (najreálnejšie; závisí od konfigurácie scenárov).
- B: neskorá správa o zlyhaní/zrušení (pomalá fronta).
- C: zrušenie pošle zastaraný stav Publishing s NIŽŠÍM `lockingVersion` (#116).
- D: článok publikovaný mimo editora (sys API, súbeh #117).
- E: ako A po stiahnutí do Draft.
- F: správa počas autosave — worker prečíta stav pred PUT, PUT sa zapíše, správa nahradí článok starým stavom, odpoveď PUT mu nastaví novú verziu a ďalší autosave potichu vráti editorove uložené zmeny v DB. (Po #112 `Math.max` verziu nezníži, ale obsah sa aj tak nahradí.)

## Čo sa po nahradení stane
- Body editor ostane (obsah sa nekopíruje späť), ostatné polia a zoznamy sa vrátia na DB bez upozornenia; guard neuložených zmien skalárne polia nesleduje.
- Redirect: aplikované odkazy sa stratia; pri ďalšom uložení sa pošlú tie z DB.
- `lockingVersion` sa prevezme (C ho zníži → 422).
- Stav Published/Publishing (C, D): zmiznú Uložiť, Publikovať aj autosave, formulár ostane editovateľný.
- Znova bežia watche s efektmi (`ArticleWidgetAd.vue:43-53`, `ArticleWidgetRecommender.vue:33-43` pri zmene `prAuthor`).

## História
9067876ae (2026-03-09) nastavoval len `status = Published` pri dokončenom jobe; 602a5d272 (v ten istý deň) celé nahradenie pre detail; 9ca84df1c (2026-03-26) presunul do composable, vypustil filter na výsledok, pridal `mainBarDialogsStore` a pridal vstup aj na edit stránke. Nič nenaznačuje, že edit stránka nahradenie potrebuje. Testy composable žiadne.

## Možnosti
1. Prevziať len polia, ktoré job mení — prevzatá verzia by dovolila ďalšiemu uloženiu prepísať akýkoľvek serverový zápis bez 422; Published nechá stránku bez uloženia; zoznam polí musí sledovať backend.
2. Preskočiť pri neuložených zmenách a upozorniť — skalárne polia nemajú sledovanie zmien; ďalšie uloženie aj tak 422.
3. Opýtať sa (ponechať / načítať) — nové UI, duplikuje dialóg konfliktu.
4. Automaticky načítať znova — tá istá strata, len viditeľná, aj pre správy bez zmeny.
5. Edit stránka do miestnosti nevstupuje — najjednoduchšie, ako s vypnutým collabom (422 pri ďalšom uložení); D sa ukáže až ako `source_article_published` do 15 s bez vysvetlenia.
6. **Odporúčané:** konflikt podľa `lockingVersion`. Edit stránka článok nikdy nenahrádza; po dobehnutí prebiehajúceho uloženia/publikovania: ak `resource.lockingVersion > article.lockingVersion`, `enterLockingVersionConflict()` (existujúci dialóg: článok sa medzitým zmenil, ostať a skopírovať / načítať; Uložiť, Publikovať, autosave aj PATCH trackerov zablokované; načítanie ne-Draft presmeruje na detail), inak ignorovať. Detail ponechá celé nahradenie.

Riziká 6: aj neškodný serverový zápis (neskorý `smsCode`) otvorí dialóg — ďalšie uloženie by aj tak dostalo 422, len skôr. Čakanie na prebiehajúce uloženie je nutné (inak falošné konflikty). Rozhodnúť: dialóg len moderátorovi, alebo všetkým (analýza: všetkým, ich kópia je tiež zastaraná).

Náčrt: `useArticleScenarioJobCollab(id, view: 'detail' | 'edit')`; edit: číslo verzie z `resource`, zapamätať `resetCount`, `until(saveInFlight || publishButtonLoading).toBe(false)` (`saveInFlight` treba exportovať), skončiť pri inom `resetCount` alebo otvorenom konflikte, pri vyššej verzii `enterLockingVersionConflict()`; nikdy nepriraďovať `article` ani `mainBarDialogsStore.article`. Upraviť komentáre (`articleOneStore.ts:48-49`, tracker `:170`, testy `:696-697,736`).

Testy: vyššia verzia (ten istý objekt, lokálna úprava aj `alternateLinksApplied` ostanú, konflikt, tick +1, `lastSaveStatus`, `mainBarDialogsStore` bez zmeny); rovnaká/nižšia (aj zastaraný Publishing) nič; iná udalosť nič; počas uloženia (rovnaká verzia ako odpoveď nič, o 1 vyššia konflikt po odpovedi, F ignorované a autosave pošle obsah po uložení); odchod počas čakania nič; počas publikovania nič; detail stále nahrádza (Publishing → Published, Publishing → Draft); voliteľne dialóg a zastavený autosave; znova `articleWidgetCollabLock` a `articleCollabFieldKeys`.

## Neoverené
Konfigurácia scenárov v produkcii (oneskorené úlohy v OnArticlePublish — prípady A, E); či worker naozaj vyhrá súbehy C a F; či workery čistia entity manager medzi správami; poradie autorov, `unsavedKeys` zoznamov a osirelý lead image po nahradení; kto volá sys batch zmenu stavu (`ArticleSysFacade.php:85`) na editovaných draftoch.
