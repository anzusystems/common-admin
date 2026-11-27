# OP4-D1: tri opravy admin-dam, FE-42, FE-43 a FE-44 (impl-dam-op4)

Zadanie vedúceho z 12. 10.; nálezy `overenie-nalezov.md`, „Piate overenie", tabuľka „FE, admin-dam" (130, 131)
a odsek pod ňou (FE-44, na žiadosť vlastníka). Strom `/home/volar/projects/anzusystems/admin-dam`. TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op4`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu.

## Podkroky

1. **Snímok `OP4-D1`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam OP4-D1 doc/changelog/3.0.0.md`, hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** po nálezoch nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP4-D1`; `vitest.k3-bend.config.mts`, oba skopírované z TMPDIR `impl-dam-op3`; skripty
   `scratchpad/op4d1-bend-run.sh` a `op4d1-bends.py`, výsledok `scratchpad/op4d1-final.txt`). Tri súbory testov,
   34 prípadov; na kóde zo snímku 16 červených (2 FE-42, 2 FE-43, 12 FE-44), 18 zelených (strážcovia).
3. `oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
4. **CK-DAM OP4-D1** (`krok5-praca/vysledky/OP4-D1-ck.log`) zelené: 82 súborov / 1 421 testov (CK OP3-D1 81 / 1 401,
   +1 súbor, +20 testov), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplata.sh OP4-D1`: `krok5-praca/zaplaty/OP4-D1.diff` (950 riadkov, 12 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku. `src/typed-router.d.ts` v nej nie je.

## FE-42 (nález 130): zastavená distribúcia ostane v zozname, keď čítanie po zastavení zlyhá

**Čo sa mení v kóde.** Sklad `distributionListStore` má akciu `removeListItem(distributionId)`: vyberie riadok
podľa `id` (`findIndex`, `splice` na mieste), pri `id`, ktoré v zozname nie je, neurobí nič. Volajú ju obe miesta:
`DistributionCancelDialog.vue` (`onConfirm`, hneď po úspešnom `DELETE`, pred `emit('reloadList')`) a
`forms/DistributionManage.vue` (namiesto dvoch riadkov z OP3-D1; správanie FE-36 sa nemení).

**Čo sa mení pre používateľa.** Len keď čítanie po zastavení zlyhá: zastavená distribúcia v karte nie je (predtým
ostala „čaká" s tlačidlom „Zastaviť distribúciu" do ďalšieho úspešného čítania na pozadí; druhé zastavenie 404).
Ak bola posledná: „Distribúcie sa nepodarilo načítať." a „Skúsiť znova". Pri úspešnom čítaní nič: odpoveď zoznam
nahradí celý. **Na backend:** nič inak.

**Medze** (tie isté ako pri FE-36, nemenil som):
- ak bola zastavená distribúcia jediná „v behu", dopytovanie na pozadí sa zápisom zastaví; zvyšok zoznamu je po
  zlyhanom čítaní z čítania pred zastavením, ako po každom zlyhanom obnovení;
- stránkovanie (`currentViewCount`, `totalCount`) píše len úspešné čítanie: po zlyhanom je v zozname o riadok menej,
  než hovorí stránkovanie (stránkovač sa pri dnešnej konfigurácii nekreslí);
- karta zatvorená počas zastavovania: zoznam medzitým patrí karte iného assetu, `id` v ňom nie je, nezapíše sa nič.

**Testy** (`src/test/distribution/distributionDialogs.test.ts`, blok zastavenia 4 → 6 prípadov, súbor 8 → 10):
- nový: čítanie po zastavení zlyhá a ostáva druhá distribúcia: hlášky o odstránení a o chybe, v karte len druhá,
  žiadne „Stop distribution", žiadne „could not be loaded", dialóg zavretý;
- nový: zastavená bola posledná a čítanie zlyhá: „The distributions could not be loaded." a tlačidlo; to potom
  prečíta prázdny zoznam a karta povie „Nothing to show";
- prípady FE-36 (`distributionManageDelete.test.ts`, 6) sú zelené nad spoločnou akciou;
- na kóde zo snímku: 2 červené (oba nové).

| Ohnutie | Červené |
|---|---|
| akcia vyprázdni celý zoznam | 4 (nový s druhou distribúciou a tri prípady FE-36) |
| riadok sa vyberie pred odpoveďou `DELETE` | 2 (odmietnuté zastavenie: riadok chýba; dialóg otvorený pre druhú distribúciu) |

## FE-43 (nález 131): šípky prepnú detail aj pod otvoreným dialógom alebo menu

**Znak otvoreného overlayu** (Vuetify 4.2.1 v `admin-dam/node_modules`):
- `VOverlay.js:348-352`: koreň každého overlayu má triedu `v-overlay--active` presne vtedy, keď je otvorený;
  `VDialog.js:77` pridáva `v-dialog` (aj `VBottomSheet`), `VMenu.js:182` `v-menu` (selecty, autocomplete, výber
  dátumu a času knižnice), `VTooltip.js:73` `v-tooltip`, `VSnackbar.js:236` `v-snackbar`.
- Stôl overlayov (`composables/stack.js`, `globalStack`) nie je exportovaný; `globalTop` dialógu sa mení až cez
  `setTimeout`. `localTop` ráta aj tooltip (`_disableGlobalStack` ho berie len z globálneho stola). Preto trieda,
  nie stôl.
- Použitý znak: prvok `.v-dialog.v-overlay--active` alebo `.v-menu.v-overlay--active`, ktorý nie je detail. Detail
  má vlastnú značku: trieda `dam-image-detail-dialog` na svojom `VDialog` (`ASSET_DETAIL_DIALOG_CLASS`).
- Tooltip a hláška nerátajú: tooltip sa ukáže aj na tlačidle s fokusom (`useActivator.js:42`, `openOnFocus`),
  hlášky aplikácie sú `VSnackbar` (`AAlerts.vue` knižnice). Ohnutie „každý otvorený overlay" to potvrdilo: červený
  je prípad s tooltipom aj tri prípady, kde svieti hláška po uložení.

**Čo sa mení v kóde.**
- `src/shared/utils/event.ts`: `anotherDialogOrMenuIsOpen(own)`.
- `assetListActions.ts`: `onArrowRight` a `onArrowLeft` sa vrátia, keď je detail otvorený
  (`assetDetailStore.detail`) a nad ním je otvorený iný dialóg alebo menu. `nextItem` a `prevItem` (tlačidlá lišty)
  sa týmto nemenia.
- `AssetDetailDialog.vue`: trieda na `VDialog`.

**Čo sa mení pre používateľa.** S otvoreným dialógom alebo menu nad detailom šípky ← a → asset neprepnú; dialóg aj
jeho rozpísaný formulár ostanú. Bez ničoho nad detailom, s tooltipom alebo hláškou, prepínajú ako doteraz; tlačidlá
lišty tiež. **Na backend:** nič inak (neodíde čítanie susedného assetu).

**Rozsah, ktorý som zvolil (nad rámec znenia nič):** stráž platí len pri otvorenom detaile. So zatvoreným detailom
šípky vyberajú suseda v zozname ako doteraz, aj pod otvoreným menu stránky; drží to prípad v testoch (pozri nálezy).

**Externý poskytovateľ** (`externalProviderAssetListActions.ts:358-366`): rovnaký poslucháč, stráž som tam nedal.
Jeho detail (`ExternalProviderAssetDetailDialog.vue`, `ExternalProviderAssetDetailDialogSidebar.vue`,
`ExternalProviderAssetMetadata.vue`) nemá dialóg, menu ani formulár: lišta so štyrmi tlačidlami s tooltipom, jedna
záložka, zoznam metadát na čítanie a „Importovať", ktoré detail zavrie (`externalProviderAssetImport.ts:34`).

**Testy** (`src/test/list/detailNeighbour.test.ts`, nový; skutočná stránka `AssetListView.vue` so skutočným
detailom, falošný je len server a `fetch` verzie aplikácie; kláves je `keyup` poslaný na prvok, počúva ho okno):
- nič nad detailom: → zo stránky aj ← z tlačidla detailu prepnú, tlačidlá lišty prepnú, žiadna otázka (strážca);
- otvorený dialóg „Pridať distribúciu" s rozpísaným poľom, fokus na „Cancel": → ani ← neprepnú, nič sa nečíta,
  dialóg aj hodnota ostanú; po zavretí šípka prepne;
- otvorené menu selectu vo formulári detailu, kláves z jeho položky: neprepnú; po zavretí menu prepnú;
- svieti len tooltip tlačidla lišty: → prepne (strážca);
- detail zatvorený, otvorené menu stránky: → vyberie suseda v zozname (strážca rozsahu);
- na kóde zo snímku: 2 červené (dialóg, select).

| Ohnutie | Červené |
|---|---|
| ráta sa každý otvorený overlay | 4 (tooltip a tri prípady s hláškou po uložení) |
| detail sa ráta sám za dialóg nad sebou | 15 (šípky neprepnú nikdy) |
| ráta sa len dialóg, menu nie | 1 (select) |
| stráž aj pri zatvorenom detaile | 1 (zatvorený detail s menu) |

## FE-44: prechod na susedný asset zahodí neuložené metadáta detailu bez otázky

**(a) Je `metadataAreTouched` spoľahlivý?** Nastavuje ho len `AssetMetadata.vue:86-88` (`any-change` vlastného
formulára, kľúčové slová, autori). Ruší ho každé čítanie assetu (`assetDetailStore.setAsset`, `:96` v snímku),
`reset` a uloženie panela pri zozname (`AssetListSidebarMetadata.vue:96`, pred požiadavkou; po zlyhaní ho vráti,
FE-15). **Uloženie detailu ho nerušilo** (`AssetDetailSidebarMetadata.vue:45-73` v snímku): po uložení by sa otázka
pýtala zbytočne. Oprava je súčasťou kroku: detail robí to isté ako panel (príznak dole pri odoslaní, späť po
zlyhaní, ak detail drží ten istý asset a je to posledné uloženie). Pri pripojení sa príznak sám nenastaví (držia to
staršie prípady panela).

**(b) Čo príznak nevidí** (v prvom kole som nerozširoval; od cyklu 1 ich vidí, pozri „Cyklus 1"): štyri prepínače
záložky Info (`AssetMetadata.vue:167-208`: jednorazové použitie, TTS audio, „override internal", „internal"), ktoré
idú `v-model` priamo na sklad a posiela ich to isté „Uložiť". Všetko ostatné v detaile ukladá vlastnou požiadavkou alebo dialógom (ROI, otočenie, sloty,
kategória distribúcie, distribúcie, epizódy, hlavná cesta súboru); rozpísaný dialóg je prípad FE-43.

**(c) Čo dnes urobí zatvorenie detailu s neuloženými metadátami** (nemenil som): X volá len `hideDetail`. Asset
s napísanými hodnotami aj príznak ostanú v sklade, panel pri zozname ich ukáže so zvýrazneným „Uložiť". Bez otázky
ich zahodí až ďalšie čítanie assetu: klik na inú dlaždicu, šípky v zozname, tá istá dlaždica po 5 s, čítanie po
zmene hlavnej cesty súboru.

**Čím sa pýta.** `AUnsavedConfirmDialog` knižnice sám, s jej textami `common.sortable.unsavedChanges.*`
(„Neuložené zmeny", „Máte neuložené zmeny. Naozaj chcete odísť?", „Zostať", „Odísť aj tak"): žiadny nový text,
žiadna zmena knižnice. `useUnsavedChangesGuard`, ktorý používajú `PodcastEditView.vue`
a `DistributionCategorySelectEditView.vue`, sa použiť nedá: pýta sa len pri odchode z trasy, zatvorení okna alebo
modelu dialógu a svoje „opýtaj sa" von nedáva.

**Čo sa mení v kóde.**
- `assetDetailStore.ts`: `leaveUnsavedQuestion` (otázka je otvorená), `showsUnsavedMetadata` (detail otvorený, bez
  loadera, príznak nastavený), `askToLeaveUnsaved()` (sľub s odpoveďou; druhé opýtanie počas otvorenej otázky
  dostane hneď „zostať"), `answerLeaveUnsaved(leave)`. `hideDetail` a `reset` otvorenú otázku zodpovedia „zostať".
- `assetListActions.ts`: `nextItem` aj `prevItem` sa najprv opýtajú, keď `showsUnsavedMetadata`; inak bežia bez
  jediného `await` navyše. Idú tadiaľ šípky aj tlačidlá lišty.
- `AssetDetailDialog.vue`: `AUnsavedConfirmDialog` vnútri `VDialog` detailu (je jeho potomkom v stole overlayov).
- `AssetDetailSidebarMetadata.vue`: bod (a).

**Čo sa mení pre používateľa.** Po zmene kľúčových slov, autorov alebo vlastného poľa v detaile sa ← a → aj
tlačidlá „predchádzajúci" a „ďalší" najprv opýtajú. „Zostať": ten istý asset s napísaným, nič sa nečíta. „Odísť aj
tak": prechod ako doteraz. Bez zmeny alebo po uložení detailom sa nepýta. Dôsledok bodu (a): „Uložiť" panela pri
zozname po uložení v detaile už nie je zvýraznené. **Na backend:** nič inak.

**Rozsah a medze.**
- Pýta sa len pri otvorenom detaile, ktorý ukazuje asset. So zatvoreným detailom (panel pri zozname) šípky aj klik
  na inú dlaždicu zahadzujú ako doteraz.
- Pod loaderom sa nepýta: po „Odísť aj tak" by druhá rýchla šípka pýtala znova na formulár, ktorý už nevidno.
- Uloženie na ceste má príznak dole: šípka počas neho sa nepýta; ak potom zlyhá, napísané je preč so starým
  assetom (chyba sa ukáže nad ďalším).
- Na konci zoznamu → (na začiatku ←) číta ten istý asset: otázka príde, „Odísť aj tak" do 5 s od posledného čítania
  neurobí nič (skratka `checkQuickDetailReFetch`), neskôr asset prečíta znova a napísané nahradí.
- Kláves Esc na otázke je „Zostať" (dialóg knižnice).

**Testy** (`src/test/list/detailNeighbour.test.ts`, 13 prípadov):
- štyri cesty (→, ←, „ďalší", „predchádzajúci"): otázka s textom knižnice, pred odpoveďou sa nič nečíta; „Stay":
  ten istý asset, pole s napísaným je to isté a pripojené, nič sa nečíta, ďalší pokus sa pýta znova; „Leave
  anyway": sused, prečítaný raz, pole zo servera;
- bez zmeny sa nepýta, ani na ceste späť z assetu, do ktorého sa nepísalo;
- po uložení detailom sa nepýta (strážca na starom kóde, červený pri ohnutí bodu (a));
- po odmietnutom uložení sa pýta; po úspešnom uložení sa pýta na to, čo sa napísalo počas neho;
- s otvorenou otázkou šípka nerobí nič (dva otvorené dialógy, nič sa nečíta), „Leave anyway" potom jeden krok;
- počas čítania suseda sa znova nepýta;
- druhé opýtanie skladu počas otvorenej otázky dostane „zostať", odpoveď patrí prvému;
- detail zavretý (X) alebo vyprázdnený (`reset`) pod otvorenou otázkou: otázka zmizne, nič sa nečíta, ďalší
  otvorený detail je bez nej a šípky idú;
- na kóde zo snímku: 12 červených.

| Ohnutie | Červené |
|---|---|
| `prevItem` sa nepýta | 4 (← a „predchádzajúci", dva prípady s cestou späť) |
| uloženie detailu príznak nezruší | 1 (po uložení sa nepýta) |
| príznak sa zruší až po odpovedi uloženia | 1 (napísané počas uloženia) |
| zlyhané uloženie príznak nevráti | 1 (odmietnuté uloženie) |
| pýta sa aj pod loaderom | 1 (čítanie suseda) |
| `hideDetail` otázku nezodpovie | 1 (zavretý detail) |
| `reset` otázku nezodpovie | 1 (vyprázdnený detail) |
| „Zostať" odíde | 6 (štyri cesty, zavretý a vyprázdnený detail) |
| druhé opýtanie čaká ako prvé | 1 (jedna otázka naraz) |

## Zmenené súbory (11 v `src`, 1 mimo)

- `src/domains/coreDam/asset/store/distributionListStore.ts` (FE-42)
- `src/domains/coreDam/asset/components/detail/components/distribution/DistributionCancelDialog.vue` (FE-42)
- `src/domains/coreDam/asset/components/detail/components/distribution/forms/DistributionManage.vue` (FE-42)
- `src/shared/utils/event.ts` (FE-43)
- `src/domains/coreDam/asset/components/list/composables/assetListActions.ts` (FE-43, FE-44)
- `src/domains/coreDam/asset/components/detail/components/AssetDetailDialog.vue` (FE-43, FE-44)
- `src/domains/coreDam/asset/store/assetDetailStore.ts` (FE-44)
- `src/domains/coreDam/asset/components/detail/components/AssetDetailSidebarMetadata.vue` (FE-44)
- `src/test/distribution/distributionDialogs.test.ts` (8 → 10 prípadov)
- `src/test/list/detailNeighbour.test.ts` (nový, 18 prípadov)
- `src/test/support/uploadUi.ts` (`startUploadUi` vracia aj `router`: test stránky zoznamu pridá trasu
  `/(coreDam)/assets`)
- `doc/changelog/3.0.0.md` („Fixed": dve nové položky za „Asset detail", jedna v „Distributions tab")

## Nové nálezy (neopravené)

- **So zatvoreným detailom šípky prepnú asset v zozname aj pod otvoreným menu alebo dialógom stránky** a panel pri
  zozname pritom zahodí neuložené metadáta bez otázky; to isté klik na inú dlaždicu a ceruzka inej dlaždice
  (`assetListActions.ts`, `onItemClick`, `showDetail`). Mimo znenia FE-43 a FE-44; prípad v testoch drží dnešný stav
  šípok.
- **→ na poslednom asset zoznamu (← na prvom) číta ten istý asset znova** (`assetListStore.setActiveNext` neurobí
  nič, `nextItem` pokračuje s tým istým indexom): po 5 s od posledného čítania sa detail načíta znova. S neuloženými
  metadátami sa po tomto kroku najprv pýta.
- **Čítanie detailu po zmene hlavnej cesty súboru** (`AssetMetadata.vue` → `mainRouteChanged` →
  `refreshActiveItem`) zahodí neuložené metadáta bez otázky.
- **Štyri prepínače záložky Info príznak nenastavia** (bod (b); **opravené v cykle 1**): prechod na suseda po
  zmene samotného prepínača ho zahodí bez otázky a „Uložiť" panela pri zozname sa nezvýrazní.
- **Lišta detailu pod loaderom neukáže „1 / N" pre prvý asset**: `AssetDetailDialogLoader.vue:27` testuje
  `!assetListStore.activeItemIndex`, čo platí aj pre index 0. Kozmetika; čítaním kódu.
- **Záložka detailu je spoločná pre detail assetu a detail externého poskytovateľa** (`assetDetailTab.ts`, jeden
  `ref` modulu; vracajú ho na Info len dve samostatné stránky detailu). Po záložke ROI v detaile assetu by detail
  externého poskytovateľa kreslil výber ROI namiesto obrázka (`ExternalProviderAssetDetailDialog.vue:198`). Čítaním
  kódu, bez testu.

## Cyklus 1 (OP4-D1-c1): štyri prepínače formulára sa rátajú za neuloženú zmenu

Rozhodnutie vlastníka cez vedúceho (12. 10.): návrh FE-44 platí, ako bol, a navyše sa za neuloženú zmenu rátajú aj
štyri prepínače záložky Info, lebo ich posiela to isté „Uložiť". Panel pri zozname so zatvoreným detailom do FE-44
ďalej nepatrí.

1. **Snímok `OP4-D1-c1`** (rovnaký príkaz ako v podkroku 1, s menom `OP4-D1-c1`), hotový pred prvou úpravou cyklu.
2. **Čo sa mení v kóde** (`src/domains/coreDam/asset/components/AssetMetadata.vue`): každý zo štyroch `VSwitch`
   (jednorazové použitie, TTS audio, „override internal", „internal") má `@update:model-value="onAnyMetadataChange"`,
   ako kľúčové slová a autori. Nič iné.
3. **Nastaví príznak už hodnota, s ktorou sa asset prečíta?** Nie. Štyri hodnoty v sklade píše len `setAsset`
   (hneď za nimi príznak zruší), `reset` a `v-model` prepínača. `VSwitch` posiela `update:modelValue` len po zásahu
   používateľa, nie pri zmene hodnoty zvonka; v sklade nad nimi nie je žiadny `watch`. Drží to prípad nižšie.
4. **Čo sa mení pre používateľa.** Po prepnutí ktoréhokoľvek zo štyroch prepínačov v detaile sa prechod na suseda
   (šípky aj tlačidlá lišty) najprv opýta; po uložení detailom nie. Prijatý dôsledok: „Uložiť" panela pri zozname
   je po prepnutí prepínača zvýraznené (príznak je ten istý); doteraz ostalo nezvýraznené. **Na backend:** nič inak.
5. **Testy** (súbor `detailNeighbour.test.ts` 18 → 23, `bulkMetadata.test.ts` +1):
   - štyri prípady, pre každý prepínač jeden (jednorazové použitie na videu, TTS na audiu, „override internal" na
     obrázku, „internal" na obrázku prečítanom so zapnutým „override internal", inak je vypnutý): prepnutý → šípka
     sa pýta a nič nečíta; „Stay", uloženie, šípka → bez otázky sused;
   - assety prečítané so zapnutými prepínačmi (obrázok s tromi, audio s TTS), nikto na ne nesiahol: šípka tam aj
     späť bez otázky. Strážca: na starom kóde zelený a jednoduchým ohnutím sa červeným spraviť nedá (pri čítaní je
     formulár pod loaderom odpojený, takže by ho nezlomilo ani sledovanie hodnôt cez `watch`);
   - panel pri zozname: asset prečítaný so zapnutým jednorazovým použitím „Save" nezvýrazní, prepnutie áno;
   - zoznam assetov v teste je teraz premenná (`inThePlaceOfItsVideo`), aby prípad mohol dať obrázok alebo audio
     na miesto videa.
   - Na kóde zo snímku `OP4-D1-c1`: 5 červených (štyri prepínače a panel). Ohnutia (skript
     `scratchpad/op4d1c1-bend-run.sh`, výsledok `op4d1c1-bends.txt`):

   | Ohnutie | Červené |
   |---|---|
   | jednorazové použitie príznak nenastaví | 2 (jeho prípad a panel pri zozname) |
   | TTS audio príznak nenastaví | 1 (jeho prípad) |
   | „override internal" príznak nenastaví | 1 (jeho prípad) |
   | „internal" príznak nenastaví | 1 (jeho prípad) |

6. `oxfmt`, `oxlint` 0; `eslint` nad súbormi cyklu (cez `tezky.sh`) 0; `lint:tsc` v CK.
7. **CK-DAM OP4-D1-c1** (`krok5-praca/vysledky/OP4-D1-c1-ck.log`) zelené: 82 súborov / 1 427 testov (CK OP4-D1
   82 / 1 421, +6), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
8. **Záplata** `zaplata.sh OP4-D1-c1`: `krok5-praca/zaplaty/OP4-D1-c1.diff` (202 riadkov, 4 súbory:
   `AssetMetadata.vue`, `detailNeighbour.test.ts`, `bulkMetadata.test.ts`, `doc/changelog/3.0.0.md`).
9. **Changelog:** položka FE-44 teraz menuje prepínače medzi zmenami a hovorí o zvýraznenom „Uložiť" panela.

**Medza, ktorá ostáva:** kláves šípky pustený nad prepínačom, ktorý má fokus, zoznam nepočúva vôbec (prepínač je
`input`, `shared/utils/event.ts`), ako doteraz; otázka príde až pri šípke mimo poľa alebo pri tlačidle lišty.

## Cyklus 2 (OP4-D1-c2): otázka zmizne, keď sa asset detailu číta znova

Po posudkoch (Codex, Opus): vo FE-42 a FE-43 nič, vo FE-44 jedna malá vec, jeden riadok testu a poznámky.

1. **Snímok `OP4-D1-c2`**, hotový pred prvou úpravou cyklu.
2. **Nález posudkov.** Otázka ostala otvorená, keď sa asset detailu počas nej prečítal inou cestou
   (`refreshActiveItem` po zmene hlavnej cesty súboru, `readAgainIfSaved` po hromadnom uložení): stála nad loaderom
   alebo nad čerstvo prečítaným assetom, hoci napísané už bolo preč, a „Odísť aj tak" potom prešlo zo znova
   prečítaného assetu.
3. **Čo sa mení v kóde** (`assetDetailStore.ts`): `showLoader` (čítanie detailu sa začína) aj `setAsset` (asset sa
   zapíše) otvorenú otázku zodpovedia „zostať", ako to už robia `hideDetail` a `reset`. Čakajúci `nextItem` alebo
   `prevItem` sa tým vráti a nič sa neprepne. Po „Odísť aj tak" je to bez účinku: odpoveď je v tej chvíli už
   odovzdaná.
4. **Čo sa mení pre používateľa.** Keď sa detail počas otvorenej otázky načíta znova, otázka zmizne a detail ukáže
   prečítaný asset; na suseda sa neprejde. **Na backend:** nič inak.
5. **Testy** (`detailNeighbour.test.ts` 23 → 25):
   - nový, skutočnou cestou: obrázok s verejným súborom, „Make private" z menu súboru sa drží na ceste, menu sa
     zavrie, do poľa sa napíše, → otvorí otázku; po odpovedi požiadavky detail číta asset znova
     (`mainRouteChanged` → `refreshActiveItem`). Otázka je preč už pri začatom čítaní (čítanie sa drží), sused sa
     nečíta; po odpovedi detail ukazuje ten istý asset so serverovou hodnotou a ďalšia → prejde bez otázky;
   - nový, sklad priamo: `setAsset` pod otvorenou otázkou (zápis bez loadera, ako pri štarte aplikácie z priameho
     odkazu): otázka preč, nič sa nečíta;
   - bod 2 zadania: prípady „Stay" a „Leave anyway" (štyri cesty) navyše tvrdia, že neodišiel žiadny `PATCH`.
     Strážca: zelený aj na starom kóde, ohnutie „odísť najprv uloží" sa textovou zámenou urobiť nedá;
   - príprava testu: právo `dam_image_update` (menu súboru), pole `title` aj vo formulári obrázka, trasa `/settings`
     (menu lišty na ňu odkazuje; bez nej router v jednom prípade písal varovanie).
   - Na kóde zo snímku `OP4-D1-c2`: 2 červené (oba nové). Ohnutia (`scratchpad/op4d1c2-bend-run.sh`, výsledok
     `op4d1c2-bends.txt`):

   | Ohnutie | Červené |
   |---|---|
   | začaté čítanie otázku nezodpovie | 1 (čítanie znova) |
   | zapísaný asset otázku nezodpovie | 1 (`setAsset`) |
   | začaté čítanie odpovie „odísť" | 1 (čítanie znova: prečíta sa sused) |

6. `oxfmt`, `oxlint` 0; `eslint` nad súbormi cyklu (cez `tezky.sh`) 0; `lint:tsc` v CK.
7. **CK-DAM OP4-D1-c2** (`krok5-praca/vysledky/OP4-D1-c2-ck.log`) zelené: 82 súborov / 1 429 testov (CK OP4-D1-c1
   82 / 1 427, +2), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
8. **Záplata** `zaplata.sh OP4-D1-c2`: `krok5-praca/zaplaty/OP4-D1-c2.diff` (155 riadkov, 2 súbory:
   `assetDetailStore.ts`, `detailNeighbour.test.ts`). Changelog sa v cykle nemenil.

**Známe medze z posudkov (neopravené):**
- uloženie z panela pri zozname, ktoré je ešte na ceste, keď detail uloží úspešne, a zlyhá ako posledné, vráti
  spoločný príznak: ďalší prechod sa pýta na zmeny, ktoré sú uložené, a „Uložiť" panela je zvýraznené. Každý
  z dvoch komponentov si pamätá len svoje posledné uloženie;
- Esc na otázke neurobí nič, kým je navrchu stola overlayov Vuetify hláška, ktorá prišla po otázke; tlačidlá
  otázky fungujú.

**Nálezy zapísané vedúcim, neopravujú sa v tomto kroku:** päť mojich z časti „Nové nálezy" (panel pri zozname so
zatvoreným detailom je u vlastníka) a tri z posudku: detail práve vytvoreného assetu nevypne klávesy zoznamu;
„Upraviť" panela pri zozname nenastaví pohľad, takže po detaile otvorenom z fronty nemá detail zoznamu tlačidlá
„predchádzajúci" a „ďalší"; Esc zavrie detail mimo `closeDialog` a adresa ostane.
