# U0-D (DAM; testy-dam)

Plán 2.2 „U0-D", komponenty 4.2 (riadky DAM). Strom `/home/volar/projects/anzusystems/admin-dam`; TMPDIR
`node_modules/.cache/vitest-tmp-testy-dam`.

## Snímok

- `snimok.sh /home/volar/projects/anzusystems/admin-dam U0-D` (2026-10-09, po uzavretí K0). Východisko: oprava N39-D
  (7 súborov) a `src/test/queue/uploadFailures.test.ts` z K0, necommitnuté; HEAD `9818e6b5`.

## Priebeh

1. Snímok `U0-D` hotový.
2. Testy (len testy; produkčný súbor ani spoločná pomôcka `fakeDam.ts`, `uploadUi.ts` sa nemenia; jediný `vi.mock`
   v nových súboroch je klient `damClient`; čas falošný po celý prípad cez `startUploadUi`/`stopUploadUi`):

   | súbor | prípady | čo |
   |---|---|---|
   | `src/test/queue/queueRowStates.test.ts` | 64 → 67 | RD12 (b) dvakrát: riadok bez metadát usadený počas zobrazenia (`processing` → `uploaded`, upozornenie o 5 s neskôr) a riadok pripojený už `uploaded` (upozornenie o 5 s); „Obnoviť" nie je pri upozornení ani 1 ms pred 20 s od prechodu, je po 20 s. „Na duplikáte žiadne tlačidlo úpravy": ľavá časť riadku akcií (`.justify-space-between` → prvé dieťa, v `card()` ako `editPlace`; rovnaká stavba je aj v riadku knižnice) nemá na duplikáte žiadny `button`, `a` ani `[role="button"]`; na druhom riadku (nie duplikát) je tam presne „Edit more" (aby výber nebol prázdny naprázdno). Pomocník `controls()`. RD12 (a) a (c) už pripínajú „is there at once when the row has an error" a „stays on a row with an error…" (vlna 4), nové nie sú. |
   | `src/test/list/assetMetaIconsTts.test.ts` (nový) | 6 | `describe.each` dlaždica (`AssetListTilesView`) a riadok tabuľky (`AssetListTableView`) nad skutočným `assetListStore.setList` v tvare odpovede hľadania: asset s `ttsAudio: true` má práve jednu ikonu s titulkom „Syntetické (TTS)" (sk, ako e2e `assetTtsPage.ts`) a neprázdnym `src`; asset s `ttsAudio: false` a `fromRss` má len ikonu „RSS"; asset bez kľúča `ttsAudio` žiadnu; v angličtine „Synthesized (TTS)". `src` sa netvrdí presne (po U3 ikona z knižnice); titulky sk aj en má knižnica rovnaké (komponenty 2.5). |
   | `src/test/asset/assetDetailMetadataScope.test.ts` (nový) | 3 | Montuje `AssetDetailDialogSidebar` (záložka „Info", cieľ teleportu tlačidiel) nad `assetDetailStore.setAsset`; „Save" (`data-cy="button-save"`): povinné vlastné pole prázdne → žiadny PATCH `metadata-bulk-update`, upozornenie „Please fill all required fields and fix problems"; povinné kľúčové slová chýbajú → to isté; obe vyplnené → jeden PATCH s hodnotami a „Record was updated". |
   | `src/test/author/authorListCreate.test.ts` (nový, voliteľný) | 2 | `AuthorListView` pod `AActionbarTarget` knižnice (tlačidlo sa teleportuje do actionbaru); trasy autora pridané do testovacieho smerovača v `setup` obalu (`router.addRoute`, skutočné mená), lebo riadky zoznamu na ne odkazujú. „Create" → dialóg, meno, „Create" → `POST /adm/v1/author` s menom a `extSystem: 1`, „Record was created", dialóg zavretý, zoznam načítaný znova a s novým autorom, cesta ostáva `/`. Bez mena: nič sa nepošle, „Please fill all required fields and fix problems", dialóg ostáva. |

3. Cielené behy na nezmenenom kóde (bez obalu, `--retry=0`, TMPDIR testy-dam): štyri súbory U0-D a
   `uploadFailures.test.ts` → **5 súborov / 98 prípadov zelených**; v cielenom behu nič na stderr (opravené v cykle 2: v CK `uploadFailures.test.ts` vypíše varovania „Missing sk translation", štyri súbory U0-D nič). `oxfmt --check` a `oxlint`
   na štyroch súboroch čisté (dva nové súbory prešli `oxfmt` raz, len zalomenie riadkov).
4. Ohnutie v pamäti (konfigurácia `vitest.testy-dam-bend.config.mts` z K0; kolá `td-edits-u0d-*.json`, hlásenia
   `td-report-u0d-*.json` v `node_modules/.cache/vitest-tmp-testy-dam/`). Každá úprava použitá práve raz (`1 0`),
   žiadne `MISSING`. Po kolách `cmp` všetkých deviatich ohnutých súborov so snímkom `U0-D`: zhodné; v `src` nie je
   značka `U0D` ani `data-u0d`.

   | kolo | ohnutý riadok | červené |
   |---|---|---|
   | `u0d-rd12-now` | `AQIE` pred `onUnmounted`: nový `watch` na `item.error.hasError`, ktorý na `Uploaded` hneď ukáže „Obnoviť" | 2 z 67: oba nové RD12 (b), na prvom tvrdení neprítomnosti (`:230`, `:245`) |
   | `u0d-rd12-cancel` | `AQIE:247` časovač: `… \|\| props.item.error.hasError) return` | 2 z 67: oba nové RD12 (b), na tvrdení po 20 s (`:236`, `:251`) |
   | `u0d-dup-text` | `AQIE:367` do ľavej časti na duplikáte `<VBtn>Upraviť v DAM</VBtn>` | 1 z 67: nový prípad duplikátu; starý „is not there on a duplicate" (vtedy `:335-339`, po cykle 3 `queueRowStates.test.ts:406-410`) ostal zelený |
   | `u0d-dup-icon` | to isté ako ikonové tlačidlo s `href` a `aria-label="Edit in DAM"` (vykreslí sa ako `<a>`) | 1 z 67: nový prípad duplikátu |
   | `u0d-tts-always` | `AssetImageMetaIcons.vue:77` `if (true)` | 2 z 6: oba prípady neprítomnosti |
   | `u0d-tts-never` | `:77` `if (false)` | 4 z 6: prítomnosť a jazyk |
   | `u0d-tts-title` | `:79` kľúč `rss` namiesto `tts` | 4 z 6 |
   | `u0d-tts-tile` | `AssetListItem.vue:82` `:show-meta-icons="false"` | 3 z 6: všetky prípady dlaždice |
   | `u0d-tts-row` | `AssetTableRowItem.vue:115` `v-if="false"` na ikonách | 3 z 6: všetky prípady riadku |
   | `u0d-scope-sidebar` | `AssetDetailSidebarMetadata.vue` `useVuelidate(…, { $scope: false })` | 2 z 3: oba prípady „nič neodíde" |
   | `u0d-scope-form` | `AssetCustomMetadataForm.vue` predvolený `validationScope: false` | 2 z 3: oba (formulár s rozsahom `false` si nechá aj výbery v slote) |
   | `u0d-scope-keywords` | `AssetMetadata.vue` výber kľúčových slov `:validation-scope="false"` | 1 z 3: prípad kľúčových slov |
   | `u0d-author-redirect` | `AuthorListView.vue` bez `disable-redirect` | 1 z 2: cesta `/authors/author-2` namiesto `/` |
   | `u0d-author-refresh` | `AuthorListView.vue` bez `datatable.value?.refresh()` | 1 z 2: zoznam sa nenačíta znova |
   | `u0d-author-validation` | `AuthorCreateButton.vue` `if (false)` namiesto `$invalid` | 1 z 2: prípad bez mena |

5. Záplata `zaplaty/U0-D.diff` (štyri súbory testov, žiadna zmena mimo `src` a `doc`).

6. CK-DAM-T U0-D: **zelené**, exit 0. `test` 70 súborov / 1 220 prípadov, 0 zlyhaných; `lint:tsc`, `format:check`,
   `lint:oxlint`, `lint:eslint` čisté. Log `vysledky/U0-D-ck.log`.

## Cyklus 1 (posudky Codex `posudky/U0-D-c1-codex.md` a Opus; snímok `U0-D-c1`)

Opravy podľa pokynu vedúceho (len testy):

1. (Codex 1) RD12 (b), oba prípady: hneď po príchode upozornenia tvrdenie, že karta ho ukáže
   (`texts(card().error())` = `['Error', 'Metadata could not be loaded.']`), potom časovanie „Obnoviť" ako predtým.
2. (Codex 3, Opus 2) TTS: položky sa hľadajú podľa assetu (titulok = id; `item(assetId)` tvrdí práve jednu), nie
   podľa poradia; `icons()` už neberie `undefined`; prípad neprítomnosti najprv tvrdí, že sú vykreslené všetky tri
   (`shown()` = `['asset-tts', 'asset-rss', 'asset-plain']`).
3. (Codex 5) Autor: obal pridá trasy, prejde na `/(coreDam)/authors` (`/authors`) a stránku vykreslí až po príchode
   (ako `RouterView`); `mountPage` čaká na `/authors`; po vytvorení tvrdenie `path()` = `/authors`.
4. (Opus 1) Rozsah detailu: nový prípad „required authors are missing" (`authors: { enabled: true, required: true }`,
   `authors: []` → žiadny PATCH, „Please fill all required fields and fix problems"); nastavenie cez
   `requiredInputs(keywords, authors)`; server mien odpovedá podľa druhu (kľúčové slovo / autor); prípad uloženia
   teraz so všetkými tromi povinnými a tvrdí aj `authors: ['author-1']` v tele.

Cielené: štyri súbory U0-D a `uploadFailures` → **5 súborov / 99 prípadov zelených**, v cielenom behu nič na stderr (queueRowStates 67,
TTS 6, detail 4, autor 2, uploadFailures 20). `oxfmt --check` (raz `oxfmt` na detaile, zalomenie) a `oxlint` čisté.

Ohnutie v pamäti po opravách (každá úprava použitá raz, žiadne `MISSING`; po kolách `cmp` jedenástich ohnutých
súborov so snímkom `U0-D-c1` zhodný, značka `U0D` v `src` nie je):

| kolo | ohnutý riadok | červené |
|---|---|---|
| `c1-rd12-warning` (nové) | `AQIE:330` `v-if="item.error.hasError && item.status !== 'uploaded'"` | 3 z 67: oba RD12 (b) (`:231`, `:247`, tvrdenie upozornenia) a starý „a warning on an uploaded row as well" |
| `u0d-rd12-now` | ako v pôvodnom kole | 2 z 67: oba RD12 (b), prvé tvrdenie neprítomnosti „Obnoviť" |
| `u0d-rd12-cancel` | ako v pôvodnom kole | 2 z 67: oba RD12 (b), po 20 s |
| `u0d-dup-text`, `u0d-dup-icon` | ako v pôvodných kolách | po 1 z 67: nový prípad duplikátu |
| `c1-tts-missing-key` (nové) | `AssetImageMetaIcons.vue:77` `ttsAudio !== false` | 2 z 6: prípad neprítomnosti (asset bez kľúča má ikonu), dlaždica aj riadok |
| `c1-tts-drop-third` (nové) | `AssetListTilesView.vue:21` a `AssetListTableView.vue:52` `items.slice(0, 2)` | 2 z 6: `shown()` bez `asset-plain` |
| `u0d-tts-always`, `-never`, `-title`, `-tile`, `-row` | ako v pôvodných kolách | 2, 4, 4, 3, 3 z 6 (rovnako ako pred c1) |
| `c1-scope-authors` (nové) | `AssetMetadata.vue:150` výber autorov bez `:validation-scope` | 1 z 4: prípad autorov |
| `c1-scope-authors-false` (nové) | `:150` `:validation-scope="false"` | 1 z 4: prípad autorov |
| `u0d-scope-sidebar`, `u0d-scope-form` | ako v pôvodných kolách | po 3 z 4: všetky tri prípady „nič neodíde" |
| `u0d-scope-keywords` | ako v pôvodnom kole | 1 z 4: prípad kľúčových slov |
| `u0d-author-redirect` | ako v pôvodnom kole | 1 z 2: `/authors/author-2` namiesto `/authors` |
| `u0d-author-refresh`, `u0d-author-validation` | ako v pôvodných kolách | po 1 z 2 |

Záplata `zaplaty/U0-D-c1.diff` (štyri súbory testov).

**Zamietnuté (pokyn vedúceho), s dôvodom:**
- Codex 2 (ľavá časť riadku závisí od rozloženia): `.justify-space-between` a ľavý `<div>` má rovnako aj riadok
  knižnice a návrh 1a ľavý `<div>` drží; zmena rozloženia spadne hlasno na druhom tvrdení prípadu (riadok, ktorý nie
  je duplikát, tam musí mať „Edit more"); „Edit more" kdekoľvek inde chytá starý prípad (po cykle 3 `queueRowStates.test.ts:406-410`).
- Codex 4 (TTS pripína značky `img` pod `.asset-image__meta-icons`): je to zmluva e2e `assetTtsPage.ts:41`.
- Codex 6 (ohnutie nepokrýva každé tvrdenie, napr. telo PATCH a POST): tvrdenie rovnosti odoslaných údajov naprázdno
  prejsť nevie; ohnutie je podľa plánu 4.3 pre tvrdenia neprítomnosti.
- Opus 3: len informácia.

CK-DAM-T U0-D-c1: **zelené**, exit 0 (vedúci: 70 / 1 221). Log `vysledky/U0-D-c1-ck.log`.

## Cyklus 2 (posudky Codex `posudky/U0-D-c2-codex.md` a Opus; snímok `U0-D-c2`)

Opravy podľa pokynu vedúceho (len testy; menia sa `queueRowStates.test.ts` a `assetMetaIconsTts.test.ts`):

1. (Codex) Viditeľnosť: pomocník `visible()` v `queueRowStates` (prvok je a ani on, ani nič nad ním nemá
   `display: none`, rovnaký spôsob ako `shown` polí v `card()`); RD12 (b) oba prípady tvrdia aj
   `visible(card().error())`. V TTS `icons()` je `drawn` = `src` neprázdny **a** ikona nie je pod `display: none`
   (kontajner má `v-show="data.icons.length > 0"`, `AssetImageMetaIcons.vue:90`).
2. (Codex) `shown()` zoradené, tvrdenie `['asset-plain', 'asset-rss', 'asset-tts']`. Presné pole ikon a selektor
   `img[title]` pod `.asset-image__meta-icons` ostávajú: zmluva e2e (`assetTtsPage.ts:41`, R-K9) — **zamietnuté**
   pokynom vedúceho.
3. (Opus 1) Nový prípad „never comes for a row without metadata whose warning reaches it first and its metadata
   after": nahratý riadok bez metadát, upozornenie o +5 s, `canEditMetadata` o ďalších +5 s (+10 s), `after(60 s)` →
   žiadne „Obnoviť" (časovač končí na `AQIE:247`, watcher `canEditMetadata` riadok s `hasError` preskočí na `:264`).
   Pripína dnešné správanie admin-dam.
4. (Opus 2) Poznámka: vety o stderr opravené (v cielenom behu nič; v CK `uploadFailures.test.ts` vypíše varovania
   „Missing sk translation" z `src/plugins/i18n.ts:25`: **18 riadkov v 17 blokoch** stderr, z toho jeden blok
   s jedným riadkom pridal **prípad K0** — `N39-D-ck.log` má 17 riadkov v 16 blokoch, `K0-ck.log` 18 v 17 (blok
   `:39-41` má dva riadky); nové je `system.uploadErrors.unknownError` pri „bad request", ten istý druh, aký vypisujú
   staré prípady súboru; štyri súbory U0-D nič). (Počty opravené v cykle 3: pôvodne tu stálo 17 a 16 „varovaní",
   to boli bloky, nie riadky.) Odkaz na starý prípad duplikátu je po cykle 3 `queueRowStates.test.ts:406-410`.

Duplikát (Codex 3) ostáva zamietnutý; Opus dôvody cyklu 1 potvrdil.

Cielené: štyri súbory U0-D **4 / 80 zelených** (queueRowStates 68, TTS 6, detail 4, autor 2) a `uploadFailures`
**1 / 20**; v cielenom behu nič na stderr. `oxfmt --check` a `oxlint` čisté.

Ohnutie v pamäti (každá úprava použitá raz, žiadne `MISSING`; `cmp` jedenástich ohnutých súborov so snímkom
`U0-D-c2` zhodný, značka `U0D` v `src` nie je):

| kolo | ohnutý riadok | červené |
|---|---|---|
| `c2-warning-hidden` (nové) | `AQIE:330` k `v-if` pridané `v-show="item.status !== 'uploaded'"` | 2 z 68: oba RD12 (b) na `visible` (`:235`, `:252`); starý „a warning on an uploaded row as well" (číta len text) ostal zelený |
| `c2-rd12-late-metadata` (nové) | `AQIE:247` `if ((props.item.canEditMetadata && !props.item.error.hasError) \|\| props.item.isDuplicate) return` | 1 z 68: nový prípad (`:273`) |
| `c2-icons-hidden` (nové) | `AssetImageMetaIcons.vue:90` `v-show="false"` | 6 z 6 (`drawn: false`) |
| `c2-tts-reversed` (kontrola, má ostať zelené) | oba zoznamy `items.slice().reverse()` | 0 z 6 (`shown()` nezávisí od poradia) |
| `c1-rd12-warning` | ako v cykle 1 | 3 z 68 |
| `u0d-rd12-now` | ako predtým | 3 z 68: oba RD12 (b) a nový prípad cyklu 2 |
| `u0d-rd12-cancel` | ako predtým | 2 z 68 |
| `u0d-dup-text`, `u0d-dup-icon` | ako predtým | po 1 z 68 |
| `c1-tts-missing-key`, `c1-tts-drop-third` | ako v cykle 1 | po 2 z 6 |
| `u0d-tts-always`, `-never`, `-title`, `-tile`, `-row` | ako predtým | 2, 4, 4, 3, 3 z 6 |

Detail a autor sa v cykle 2 nemenili (ich kolá z cyklu 1 platia). Záplata `zaplaty/U0-D-c2.diff` (dva súbory testov).

CK-DAM-T U0-D-c2: **zelené**, exit 0 (vedúci: 70 / 1 222). Log `vysledky/U0-D-c2-ck.log`.

## Cyklus 3 (posudky Codex `posudky/U0-D-c3-codex.md` a Opus; snímok `U0-D-c3`)

Opravy podľa pokynu vedúceho (len testy; mení sa len `queueRowStates.test.ts`). Práca sa prerušila limitom použitia;
po obnovení `diff -r` stromu so snímkom `U0-D-c3` ukázal hotové body 1, 2 a časť 3 (RD12), dorobené zvyšné.

1. (Codex) Prípad „never comes … within the twenty seconds" tvrdí neprítomnosť „Obnoviť" hneď po metadátach, 1 ms pred
   koncom 20 s od prechodu, na ich konci a o ďalších 50 s (predtým len raz na konci).
2. (Opus 1) Názov prípadu doplnený o „within the twenty seconds" (metadáta prídu pred koncom časovača riadku); čo sa
   stane, keď prídu po 20 s, sa netvrdí.
3. (Opus 2) Viditeľnosť riadkov upozornenia: `texts(element, seen)` s druhým argumentom `true` vynechá kúsky pod
   `display: none` (`visible()` presunuté pred `texts`); RD12 (b) oba prípady tvrdia `texts(card().error(), true)`,
   teda aj riadok so správou. Navyše `visible(card().error())` v „shows the message of the row" (zlyhaný riadok) a
   `visible(card().duplicate())` v „says so over its picture and links…" (duplikát) — staré prípady vlny 4 dostali
   po jednom tvrdení, nič existujúce sa nezmenilo.
4. (Opus 3) Poznámka: počty stderr opravené na bloky a riadky (vyššie, cyklus 2, bod 4); odkazy na starý prípad
   duplikátu na `:406-410`.

Cielené: štyri súbory U0-D a `uploadFailures` → **5 súborov / 100 prípadov zelených** (queueRowStates 68), v cielenom
behu nič na stderr. `oxfmt --check` a `oxlint` na `queueRowStates.test.ts` čisté.

Ohnutie v pamäti (každá úprava použitá raz, žiadne `MISSING`; `cmp` `AssetQueueItemEditable.vue` so snímkom
`U0-D-c3` zhodný, značka `U0D` v `src` nie je):

| kolo | ohnutý riadok | červené |
|---|---|---|
| `c3-message-hidden` (nové) | `AQIE:345-349` riadok správy dostane `v-show="false"` | 2 z 68: oba RD12 (b) (`:234`, `:251`, viditeľné len `['Error']`) |
| `c3-failed-overlay-hidden` (nové) | `AQIE:330` k `v-if` pridané `v-show="item.status !== 'failed'"` | 1 z 68: „shows the message of the row" (`:499`) |
| `c3-duplicate-hidden` (nové) | `AQIE:305` k `v-if="item.isDuplicate"` pridané `v-show="false"` | 1 z 68: duplikát „says so over its picture…" (`:475`) |
| `c3-refresh-flash` (nové) | `AQIE:247` časovač ponúkne „Obnoviť" aj riadku s metadátami a o 5 s ho skryje | 1 z 68: nový prípad na tvrdení po 20 s (`:278`); starý „does not come for a row whose metadata arrives within the twenty seconds" ostal zelený, lebo v ňom pri +10 s watcher `canEditMetadata` riadku bez chyby zruší časovač (`AQIE:264-267`) a ohnutá vetva `AQIE:247-248` sa nespustí; nový prípad ju dosiahne len vďaka chybe (opravené v cykle 4, pôvodne tu stálo „tvrdí len na konci") |
| `c2-warning-hidden` | ako v cykle 2 | 2 z 68 |
| `c2-rd12-late-metadata` | ako v cykle 2 | 1 z 68 |
| `c1-rd12-warning` | ako v cykle 1 | 3 z 68 |
| `u0d-rd12-now`, `u0d-rd12-cancel` | ako predtým | 3, 2 z 68 |
| `u0d-dup-text`, `u0d-dup-icon` | ako predtým | po 1 z 68 |

TTS, detail a autor sa v cykle 3 nemenili (ich kolá z cyklu 2 a 1 platia). Záplata `zaplaty/U0-D-c3.diff` (jeden
súbor testov).

CK-DAM-T U0-D-c3: **zelené**, exit 0 (vedúci: 70 / 1 222). Log `vysledky/U0-D-c3-ck.log`.

## Cyklus 4 (Codex bez nálezu; Opus dva nízke; snímok `U0-D-c4`)

Opravy podľa pokynu vedúceho (len `queueRowStates.test.ts`):

1. (Opus 1) Zlyhaný riadok „shows the message of the row" a duplikát „says so over its picture and links…": `texts(el)`
   prepnuté na `texts(el, true)` (viditeľné kúsky; pokrýva aj rámček, preto riadky `visible()` z cyklu 3 vypustené).
   Predtým `v-show` len na riadku správy alebo len na odkaze „View original" prešiel.
2. (Opus 2) Poznámka: dôvod pri `c3-refresh-flash` opravený (watcher `canEditMetadata` zruší časovač riadku bez chyby,
   `AQIE:264-267`); CK c3 doplnená do „Cyklus 3".

Cielené: štyri súbory U0-D a `uploadFailures` → **5 súborov / 100 prípadov zelených** (queueRowStates 68), v cielenom
behu nič na stderr. `oxfmt --check` a `oxlint` čisté. Starý prípad duplikátu ostáva na `queueRowStates.test.ts:406-410`.

Ohnutie v pamäti (každá úprava použitá raz, žiadne `MISSING`; `cmp` `AssetQueueItemEditable.vue` so snímkom
`U0-D-c4` zhodný, značka `U0D` v `src` nie je):

| kolo | ohnutý riadok | červené |
|---|---|---|
| `c4-failed-message-hidden` (nové) | `AQIE:345-349` riadok správy `v-show="item.status !== 'failed'"` | 1 z 68: „shows the message of the row" (`:497`, viditeľné len `['Error']`) |
| `c4-link-hidden` (nové) | `AQIE:320-327` odkaz „View original" `v-show="false"` | 1 z 68: duplikát (`:474`, viditeľné len `['Duplicate']`) |
| `c3-message-hidden` | ako v cykle 3 | 3 z 68 (oba RD12 (b) a teraz aj „shows the message of the row") |
| `c3-failed-overlay-hidden`, `c3-duplicate-hidden` | ako v cykle 3 | po 1 z 68 (teraz na `texts(…, true)`, viditeľné `[]`) |
| `c3-refresh-flash` | ako v cykle 3 | 1 z 68 |
| `c2-warning-hidden`, `c2-rd12-late-metadata` | ako v cykle 2 | 2, 1 z 68 |
| `c1-rd12-warning` | ako v cykle 1 | 3 z 68 |
| `u0d-rd12-now`, `u0d-rd12-cancel` | ako predtým | 3, 2 z 68 |
| `u0d-dup-text`, `u0d-dup-icon` | ako predtým | po 1 z 68 |

Záplata `zaplaty/U0-D-c4.diff` (jeden súbor testov).

CK-DAM-T U0-D-c4: **zelené**, exit 0 — 70 súborov / 1 222 prípadov; `lint:tsc`, `format:check`, `lint:oxlint`,
`lint:eslint` čisté. Log `vysledky/U0-D-c4-ck.log`.

## Cyklus 5

Codex aj Opus bez nálezu v zmene. **Stav: U0-D uzavretý vedúcim 9. 10.** Ďalší krok v DAM je K3 (impl-dam) po kópii C1.

## Incident

- Prvé kolo ohýbania spustil skript `scratchpad/u0d/bend.sh` s chybou `sort | uniq -c < súbor`: `sort` čaká na stdin
  a visí (PID 2503405, rodičia 2503404, 2503023, 2503021 = úloha na pozadí `bliidwd2t`). Vitest toho kola dobehol
  a hlásenie je zapísané. Nič nezabíjam; PID a príkaz poslané vedúcemu. Ďalšie kolá idú opraveným `bend2.sh`.
  **Vyriešené** (nasledujúci bod): žiadny z týchto PID už nebeží.
- Vedúci o 20:2x so súhlasom vlastníka zastavil `kill` len visiaci `sort` 2503405. Slučka úlohy `bliidwd2t` sa tým
  rozbehla a o 20:23:14–20:23:28 spustila neplánované kolo `u0d-rd12-cancel`: prepísalo `td-report`, `td-applied` a
  `td-run` tohto kola, výsledok rovnaký (2 z 68 na `:242` a `:259`), strom nezmenený (ohýba len v pamäti), CK c4 už
  skončila o 20:22:55. Slučka sa potom zavesila na ďalšom `sort` (PID 2608971); vedúci zastavil celú úlohu
  `bliidwd2t` (TaskStop). Žiadny proces z nej nebeží.

## Ohnuté súbory na disku

Žiadne.

## Odchýlky, zblíženia, nálezy

- Odchýlky od návrhu: titulok TTS sa tvrdí po slovensky (ako návrh a e2e) a navyše po anglicky. Zblíženia: žiadne
  (krok mení len testy). Nové nálezy: žiadne.
