# OP5-D2: sedem opráv admin-dam, FE-46 až FE-52 (impl-dam-op5b)

Zadanie vedúceho z 12. 10. (`scratchpad/zadanie-OP5-D2.md`); nálezy `overenie-nalezov.md`, „Šieste overenie", tabuľka
„FE, admin-dam" a „Rozhodnutie vlastníka k šiestemu overeniu". Strom `/home/volar/projects/anzusystems/admin-dam`,
vetva `next`, HEAD `1af3c3ac` a nad ním nezapísaný krok `OP5-D1` s cyklom `OP5-D1-c1` (východiskový stav, nič z neho
som nevracal). TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op5b`. Bash bez `cd`, nič sa nemazalo,
žiadny zápis do gitu, knižnica ani texty sa nemenili.

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `EP/` = `domains/coreDam/externalProvider/`,
`R/` = `domains/coreDam/shared/assetFileRoute/components/`. Čísla riadkov v častiach kroku platia pre strom po kroku
(pred cyklom 1); cyklus 1 posunul `assetListActions.ts` a `R/AssetFileMainRoute.vue` o niekoľko riadkov a svoje
čísla uvádza v časti „Cyklus 1".

## Podkroky

1. **Snímok `OP5-D2`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam OP5-D2 doc/changelog/3.0.0.md`, hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP5-D2`; `vitest.k3-bend.config.mts`, oba skopírované z TMPDIR `impl-dam-op5`; skripty
   `scratchpad/op5d2-bend-run.sh`, `op5d2-bends.py`, `op5d2-final-run.sh`; výsledok posledného prechodu nad konečnými
   testami `scratchpad/op5d2-final2.txt`, pracovné prechody `op5d2-final.txt`). Päť súborov testov, 104 prípadov; na
   kóde zo snímku **36 červených**, 68 zelených.
3. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`, skript `scratchpad/op5d2-lint.sh`) 0.
4. **CK-DAM OP5-D2** (`krok5-praca/vysledky/OP5-D2-ck.log`) zelené: 86 súborov / 1 508 testov (CK OP5-D1-c1
   83 / 1 466, +3 súbory, +42 testov), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
   Prvý beh CK bol červený na `lint:tsc` (jeden riadok nového testu, typ návratu pomocníka v
   `mainRouteChange.test.ts`); opravené a CK zopakovaná celá.
5. **Záplata** `zaplata.sh OP5-D2`: `krok5-praca/zaplaty/OP5-D2.diff` (2 054 riadkov, 14 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku. `src/typed-router.d.ts` v nej nie je.

## FE-46 (nález 148): detail assetu externého poskytovateľa vedel prepísať ROI obrázka DAM

**Čo sa mení v kóde.** `EP/components/ExternalProviderAssetDetailDialog.vue`: preč je vetva
`v-if="activeTab === AssetDetailTab.ROI"` s `ADamAssetImageRoiSelect`, `useAssetDetailTab`, `useCurrentExtSystem`
(slúžil len tej vetve) a tri importy. Ostal jeden `div` s obrázkom assetu (`:191-207`). Kde sa karta detailu assetu
vracia na „Info" (dve samostatné stránky detailu), som nemenil.

**Čo sa mení pre používateľa.** Detail assetu poskytovateľa ukáže vždy svoj obrázok, aj keď detail obrázka DAM ostal
na karte „Fókus". Rám ROI obrázka DAM sa tam už nenakreslí, takže sa ním nedá pohnúť ani nič uložiť. Karta detailu
DAM sa ďalej pamätá: detail obrázka DAM sa po návrate otvorí znova na „Fókus" (drží to test). **Na backend:** nič
inak (neodíde `PUT /adm/v1/roi/:id`, ktorý tam odchádzal po posune rámu).

**Testy** (`src/test/list/externalProviderDetail.test.ts`, nový, 2 prípady; skutočné stránky oboch zoznamov pod
hostiteľom, ktorý ich vie vymeniť ako router, skutočné detaily, falošný len server):
- detail poskytovateľa ukáže obrázok svojho assetu (strážca, zelený aj na starom kóde);
- celá cesta nálezu: detail obrázka DAM, karta „Fókus" (rám ROI sa nakreslí, sklad ROI je naplnený), zavrieť,
  stránka poskytovateľa, detail dlaždice: obrázok, žiadny rám, žiadny `PUT` ROI; potom späť na zoznam DAM a detail
  obrázka je znova na „Fókus" (strážca toho, že sa karta nikde navyše nevracia);
- na kóde zo snímku: 1 červený.

| Ohnutie | Červené |
|---|---|
| vetva ROI späť v dialógu poskytovateľa | 1 (cesta nálezu) |

## FE-47 (nález 146): čítanie po zmene hlavnej trasy súboru

**Čo sa mení v kóde.**
- `R/AssetFileMainRoute.vue:43-56` (`makePrivate`) a `R/AssetFileRouteMakePublicDialog.vue:79-92` (`onConfirm`):
  udalosť (`mainRouteChanged`, `afterUpdate`) ide až po úspešnej odpovedi; po zlyhaní sa skončí hneď po hláške.
  Poradie ostatného sa nemení (dialóg „Nastaviť ako verejné" sa zavrie aj po zlyhaní, ako doteraz).
- `A/components/list/composables/assetListActions.ts:307-345`, `refreshActiveItem`:
  - číta asset, ktorý detail drží (`assetDetailStore.asset`), nie asset aktívnej dlaždice; bez držaného assetu nič;
  - **neuložené metadáta** (`metadataAreTouched`, `:314-324`): žiadny `showLoader`, žiadny `startDetailRequest`,
    žiadny `setAsset`; z odpovede sa do držaného assetu zapíše len `mainFile` (`:318`; od cyklu 1 len jeho
    `mainRoute`), a len keď sklad stále drží
    ten istý objekt assetu, pre ktorý sa čítalo (identita, nie `id`: ani iný asset, ani ten istý prečítaný medzitým
    nanovo). Zlyhanie: hláška obvyklou cestou (`showErrorsDefault`, len kým sklad drží ten asset a používateľ je na
    stránke), nič iné. Otázka FE-44 / OP5-D1 sa tým nezodpovie (zodpovedal ju `showLoader`, ktorý tu nebeží);
  - **bez neuložených metadát**: telo ako doteraz (loader, počítadlo požiadaviek, celý asset, zlyhanie vyprázdni
    sklad a vráti adresu), len `id` je z držaného assetu.
- Volajúci `refreshActiveItem` sú len dvaja, oba v `A/components/list/AssetListView.vue` (`:137` detail, `:206`
  panel) a oba po zmene trasy; iného volajúceho niet, ostatným sa teda nič nemení.

**Rozhodnutia.**
1. **Podmienka vetvy je `metadataAreTouched`, bez ohľadu na loader.** Udalosť príde len z formulára, ktorý je
   nakreslený (pod loaderom je odpojený a Vue udalosť odpojeného komponentu nedoručí), takže loader je v tej chvíli
   dole; keby predsa hore bol (používateľ povedal „Odísť aj tak" a číta sa sused), vetva bez počítadla prebiehajúce
   čítanie nezruší a jej odpoveď sa do iného assetu nezapíše.
2. **Stráž vetvy s neuloženými metadátami je identita držaného assetu, nie počítadlo požiadaviek.** Počítadlo
   zvyšuje aj klik na tú istú dlaždicu a jej ceruzka do 5 s, ktoré nič nečítajú: odpoveď by sa zahodila a karta
   súboru by ostala stará, hoci formulár drží ten istý asset. Identita toto prežije a zároveň drží bod 5 zadania
   (iný asset, vyprázdnený sklad, ten istý asset prečítaný nanovo).
3. **„Zavretý detail" v bode 5 zadania:** zavretie cez X (`hideDetail`) požiadavky neruší ani dnes, lebo panel pri
   zozname číta ten istý sklad. Odpoveď sa preto po X zapíše (v oboch vetvách) a ukáže ju panel, pri neuložených
   metadátach aj s napísaným. Nič sa nezapíše po vyprázdnení skladu (`reset`), po prechode na iný asset a po novom
   čítaní toho istého assetu. Drží to prípad „gives the file to the panel when the detail was closed over the read".
4. **Čítanie bez loadera nepíše značku „naposledy čítané"** (`updateLastFetched`): skratka „do 5 s nečítať znova"
   aj otázka OP5-D1 pri tej istej dlaždici sa rátajú od pôvodného čítania, ako doteraz.

**Čo sa mení pre používateľa.**
- Po „Nastaviť ako súkromné" / „Nastaviť ako verejné", keď sú v detaile alebo v paneli pri zozname neuložené
  metadáta: karta súboru ukáže nový stav, napísané ostane v tých istých poliach bez loadera, „Uložiť" panela ostane
  zvýraznené, otvorená otázka „Máte neuložené zmeny" ostane a funguje. Zlyhané čítanie: hláška, nič iné sa nezmení
  (karta súboru ostane v starom stave do ďalšieho čítania assetu).
- Bez neuložených metadát ako doteraz.
- Číta sa asset, ktorý detail alebo panel drží: detail riadka fronty uploadu po zmene trasy už neukáže asset aktívnej
  dlaždice, a bez aktívnej dlaždice sa stav trasy obnoví.
- Po zlyhanej zmene trasy sa nič nečíta. Zlyhaná zmena trasy pred krokom neukazovala žiadnu hlášku (nálezy, bod 1);
  jediným znakom bolo opätovné čítanie s loaderom. **Od cyklu 1** ukáže „Systémová chyba. Skúste neskôr alebo
  kontaktujte administrátora." (FE-63); dialóg „Nastaviť ako verejné" sa pri nej zavrie ako doteraz.
- **Krok sám mal chybu, ktorú opravil cyklus 1:** úspešné „Nastaviť ako súkromné" obrázka a dokumentu backend
  odpovedá 204 bez tela a obal požiadavky bral za úspech len 200. Pred krokom to skrylo čítanie vo `finally`; po
  kroku („udalosť len po úspechu") by karta ostala „verejná" a druhý klik by server odmietol. Veta „karta súboru
  ukáže nový stav" platí pre všetky tri typy až od cyklu 1.
- Udalosť z tých istých dvoch komponentov počúvajú aj samostatná stránka detailu, stránka detailu súboru a karta
  slotov (`A/components/detail/AssetDetailView.vue:233`, `AssetFileDetailView.vue:210`,
  `A/components/detail/components/slots/AssetSlotListItem.vue:179`): aj tie po zlyhanej zmene už nečítajú. Inak sa
  im nič nemení.
- Menu „⋮" karty súboru ostáva po kliku otvorené, kým beží požiadavka; potom ho doteraz odniesol loader. Pri
  neuložených metadátach loader nie je a menu po kroku ostalo otvorené s opačnou akciou. **Od cyklu 1** sa menu po
  úspešnej zmene zavrie samo.

**Na backend:** po zlyhanej zmene neodíde `GET /adm/v1/asset/:id`; po úspešnej odíde ten istý `GET`, ale pre asset,
ktorý detail drží. Nič iné.

**Medze, ktoré prijímam.**
- Pri neuložených metadátach sa z odpovede berie len `mainFile` (od cyklu 1 len `mainFile.mainRoute`); ostatné, čo
  server medzitým zmenil (dátum a autor úpravy, názov v lište, stav spracovania súboru), sa ukáže až pri ďalšom
  čítaní assetu.
- Uloženie na ceste má príznak dole (známa medza FE-44): zmena trasy počas neho ide vetvou s loaderom, a ak
  uloženie potom zlyhá, napísané je preč.
- Loader hore vo chvíli udalosti a žiadne neuložené metadáta: vetva s loaderom zruší prebiehajúce čítanie a číta
  držaný asset. Cez rozhranie sa to nedá dosiahnuť (rozhodnutie 1), dnes by sa v tom okne čítala aktívna dlaždica.
- Odpoveď po odchode zo stránky zoznamu sa do skladu zapíše (len `mainFile`, nikto ho nekreslí; pripojenie zoznamu
  sklad vyprázdni); hláška o zlyhaní sa po odchode neukáže (`onPage`).

**Testy.** Nový `src/test/list/mainRouteChange.test.ts` (20 prípadov; skutočná stránka zoznamu s detailom, panelom
a frontou uploadu; server si pamätá, ktoré súbory sú verejné, a `PATCH make-private` / `make-public` to mení):
- bez napísaného: detail aj panel idú pod loader a vezmú celý asset (názov v lište, prepínač jednorazového použitia
  zo servera): strážcovia „ako doteraz" (2);
- s napísaným: počas čítania to isté pole pripojené, karta ešte „File is public"; po odpovedi „File is private", to
  isté pole s napísaným, prepínač nezmenený, lišta s pôvodným názvom, žiadna otázka ani hláška, „Save" zvýraznené
  a `PATCH` uloženia nesie napísané (2);
- odmietnutá zmena: nič sa nečíta, bez napísaného aj s ním (2); „Make public" cez dialóg: odmietnuté nič nečíta,
  úspešné číta a napísané ostáva (1);
- zlyhané čítanie s napísaným: hláška, to isté pole, karta v starom stave, adresa, aktívna dlaždica a zvýraznené
  „Save" ako boli (2); bez napísaného sa detail aj panel vyprázdnia ako doteraz (2 strážcovia);
- odpoveď po prechode na iný asset nič nezapíše (detail šípkou, panel klikom, oboje cez „Leave anyway") (2); po
  novom čítaní toho istého assetu tiež nie (staršia odpoveď príde posledná) (1); po zavretí detailu cez X ju
  dostane panel aj s napísaným (1);
- číta sa asset, ktorý panel drží, nie ten na mieste aktívnej dlaždice (zoznam načítaný znova v inom poradí), a
  asset, ktorý drží detail riadka fronty uploadu, nie aktívna dlaždica; každé bez napísaného aj s ním (4);
- bez držaného assetu sa nečíta nič (1). Tento jediný prípad nejde cez tlačidlá stránky: formulár, ktorý udalosť
  posiela, je nakreslený len keď sklad asset drží. Zoznamu sa zmena oznámi volaním `refreshActiveItem` z malého
  hostiteľa po vyprázdnení skladu.

Prepísané prípady (držali dnešný stav, zadanie ich menuje):
- `detailNeighbour.test.ts`, pôvodne „…a question that goes when the detail reads its asset anew under it: nothing
  moves" (`:495-541` v snímku): teraz „…a question that stays while the detail takes the file of its asset read anew
  under it". Tá istá cesta („Make private" na ceste, písanie, →, odpoveď). Tvrdí: otázka ostáva pri začatom aj
  dokončenom čítaní, to isté pole s napísaným, karta „File is private", „Stay" nechá napísané a nič nečíta, ďalšia
  → a „Leave anyway" prejde na suseda. Predtým tvrdil opak (otázka preč, hodnota zo servera).
- `sidebarUnsaved.test.ts`, pôvodne „goes when the panel reads its asset anew under it: nothing moves": teraz „stays
  while the panel takes the file of its asset read anew under it, and its answer still counts", s tými istými
  tvrdeniami pre panel a „Leave anyway" dokončí klik, ktorý sa pýtal.
- Aby pravidlo „začaté čítanie otázku zodpovie" (OP4-D1-c2) nestratilo test, pribudol v oboch súboroch prípad na
  úrovni skladu: `showLoader()` pod otvorenou otázkou ju zavrie (v `sidebarUnsaved` ako tretí variant existujúceho
  `it.each`, v `detailNeighbour` samostatný). Prípad so `setAsset` ostal bez zmeny.

Na kóde zo snímku: 16 z 20 prípadov nového súboru je červených (zelení sú štyria strážcovia „ako doteraz"),
k tomu oba prepísané prípady. Dva prípady na úrovni skladu sú zelené aj na snímku a červené pri ohnutí nižšie.

| Ohnutie | Červené |
|---|---|
| „Make private" pošle udalosť aj po zlyhaní | 2 (odmietnutá zmena: detail, panel) |
| „Make public" pošle udalosť aj po zlyhaní | 1 (dialóg) |
| vetva s loaderom číta aktívnu dlaždicu | 2 (držaný asset, bez napísaného: detail, panel) |
| vetva bez loadera číta aktívnu dlaždicu | 2 (držaný asset, s napísaným: detail, panel) |
| číta sa aj bez držaného assetu | 1 |
| s napísaným ide pod loader ako doteraz | 13 |
| s napísaným sa vezme celý asset | 8 |
| po zápise súboru sa príznak zruší | 5 |
| začiatok čítania zodpovie otázku | 2 (dva prepísané prípady) |
| zlyhané čítanie s napísaným vyprázdni sklad | 2 |
| zlyhané čítanie s napísaným nič nepovie | 2 |
| aj bez napísaného sa berie len súbor | 4 (dvaja strážcovia celého čítania, dvaja zlyhaného) |
| odpoveď sa zapíše do assetu, ktorý sklad drží práve teraz | 3 (iný asset: detail, panel; ten istý prečítaný nanovo) |
| odpovedi stačí rovnaké `id` | 1 (ten istý asset prečítaný nanovo) |
| `showLoader` otvorenú otázku nezodpovie (pravidlo OP4-D1-c2) | 2 (dva prípady na úrovni skladu: detail, panel) |

## FE-48 (nález 141, čiastočne): šípky v detaile práve vytvoreného assetu

**Čo sa mení v kóde.** `assetListActions.ts:548-562`: `detailIsNotOfList()` (detail otvorený a pohľad nie je
„list"); `onArrowRight` aj `onArrowLeft` sa pri ňom vrátia, na tom istom riadku ako stráž FE-43. Jedno miesto pre
oboch otváračov (`A/components/AssetCreateButton.vue`, `A/components/queue/AssetQueueItemEditable.vue`), ktorých
som sa nedotkol: riadok fronty klávesy zoznamu vypína ďalej sám.

**Čo sa mení pre používateľa.** V detaile po „Vytvoriť prázdny asset" šípky ← a → nerobia nič (doteraz po prvom
kliku do detailu prečítali suseda aktívnej dlaždice, alebo druhú dlaždicu, keď žiadna aktívna nebola). So zavretým
detailom šípky vyberajú v zozname ako doteraz, aj keď po ňom ostal pohľad „queue". **Na backend:** neodíde čítanie
suseda.

**Testy** (`src/test/list/detailNotOfList.test.ts`, nový, 13 prípadov spolu s FE-50; skutočná stránka zoznamu
s menu stránky, frontou uploadu na celú obrazovku, detailom a panelom):
- šípky v detaile práve vytvoreného assetu aj v detaile riadka fronty nečítajú nič, adresa aj aktívna dlaždica
  ostávajú (2; riadok fronty je strážca, zelený aj na starom kóde); to isté bez aktívnej dlaždice (1);
- po zavretí takého detailu šípky v zozname znova vyberajú suseda (2);
- detail otvorený potom ceruzkou dlaždice šípkami prepína (2 strážcovia).
- Príprava: menu stránky po vytvorení assetu ostáva otvorené, kým sa neklikne do detailu, a drží klávesy samo
  (FE-43); pomocník `createEmpty` preto do detailu klikne a počká, kým menu zmizne.

| Ohnutie | Červené |
|---|---|
| šípky počúva aj detail, ktorý nie je zo zoznamu | 4 (vytvorený asset s aktívnou dlaždicou aj bez nej, dva prípady FE-50 „nie je zo zoznamu") |
| šípky nepočúva žiadny otvorený detail | 30 (všetky prípady so šípkou v detaile zo zoznamu) |
| šípky sú vypnuté aj po zavretí detailu s pohľadom „queue" | 2 |

## FE-50 (nález 142): „Upraviť" bočného panela nenastavilo pohľad detailu

**Čo sa mení v kóde.** `A/components/list/components/AssetListSidebarMetadata.vue:60-73`, `onEditMore`: pred
otvorením nastaví pohľad: „list", keď panel drží asset aktívnej dlaždice (`assetListStore.getActiveAsset()`), inak
„queue". Spolu s FE-48: detail zo zoznamu má šípky vždy, detail assetu mimo zoznamu ich nemá.

**Čo sa mení pre používateľa.** Po detaile z fronty alebo po „Vytvoriť prázdny asset" má detail otvorený tlačidlom
„Upraviť" panela tlačidlá ‹ ›, počítadlo a názov, keď panel ukazuje asset aktívnej dlaždice, a šípky v ňom
prepínajú. Keď panel drží iný asset (riadka fronty, práve vytvorený), detail ich nemá a šípky v ňom nerobia nič.
**Viditeľný dôsledok pravidla, na ktorý upozorňujem:** „iný asset" je aj asset, ktorý po novom načítaní zoznamu
(filter, zoradenie, „Obnoviť") už nie je na zapamätanom mieste aktívnej dlaždice (známy nález FE-61). „Upraviť"
panela vtedy otvorí detail bez tlačidiel, počítadla a názvu; doteraz ich mal, s poradím a susedmi rátanými od
cudzej dlaždice. Keď asset na svojom mieste ostal, nič sa nemení. **Na backend:** nič.

**Testy** (`detailNotOfList.test.ts`):
- po detaile vytvoreného assetu aj riadka fronty: klik na dlaždicu, „Edit more" panela: „2 / 3 asset-2", adresa
  assetu, obe tlačidlá aktívne, šípka aj tlačidlo prepínajú (2);
- panel drží asset zavretého detailu mimo zoznamu: „Edit more" otvorí detail bez lišty a tlačidiel, šípky nič
  nečítajú (2);
- po detaile zo zoznamu (pohľad „list") a zozname načítanom znova v inom poradí: panel drží asset-2, na mieste
  aktívnej dlaždice je asset-3: detail bez lišty a tlačidiel, šípka nič nečíta (1);
- strážca pravidla: zoznam načítaný znova, asset na tom istom mieste: detail zo zoznamu, šípka prepne (1).

| Ohnutie | Červené |
|---|---|
| „Upraviť" pohľad nenastaví | 3 (dva prípady „zo zoznamu", prípad s cudzou dlaždicou) |
| „Upraviť" nastaví vždy „list" | 3 (dva prípady „nie je zo zoznamu", prípad s cudzou dlaždicou) |
| „Upraviť" nastaví vždy „queue" | 3 (dva prípady „zo zoznamu", strážca pravidla) |

## FE-49 (nález 145): koniec zoznamu

**Čo sa mení v kóde.**
- `assetListActions.ts:133-135`, `neighbourOfActive(1 | -1)`: sused aktívnej dlaždice, na konci zoznamu nič
  (predtým „na konci znova aktívny"). Vrátený je aj z `useAssetListActions()`.
- `nextItem` (`:440-443`) a `prevItem` (`:484-487`): cieľ sa hľadá ako prvý riadok; bez cieľa návrat pred otázkou
  FE-44, pred otázkou OP5-D1, pred `setActiveNext`, loaderom, adresou aj požiadavkou. `readReplacesUnsavedOfPanel`
  už nedostáva `undefined` (parameter je `DocId`).
- `A/components/detail/components/AssetDetailDialog.vue:193,210`: `:disabled="!neighbourOfActive(-1)"` a
  `:disabled="!neighbourOfActive(1)"` na tlačidlách lišty. Sklad zoznamu sa nemenil.

**Čo sa mení pre používateľa.** → na poslednej načítanej dlaždici a ← na prvej nerobia nič: nič sa nečíta (ani po
5 s), detail ani panel nejdú pod loader, nič sa nepýta ani s neuloženými metadátami, adresa ostáva. Platí pri
otvorenom aj zavretom detaile. Tlačidlá „Predchádzajúci asset" a „Nasledujúci asset" sú na koncoch vypnuté. Ďalšia
strana zoznamu sa z detailu nenačíta (rozhodnutie vlastníka), počítadlo „25 / 25+" ostáva. Tým padá medza OP5-D1
„šípka na konci zoznamu sa po 5 s pýta". **Na backend:** neodíde opätovné čítanie toho istého assetu.

**Testy.**
- `detailNeighbour.test.ts`, nový blok „the detail of the asset at an end of the list": pre posledný aj prvý asset
  (2): tlačidlo von vypnuté, druhé nie; po 6 s šípka aj tlačidlo nič nečítajú, to isté pole pripojené; s napísaným
  žiadna otázka; druhým smerom sa pýta a prejde, v strede zoznamu sú obe tlačidlá aktívne. Prvý prípad súboru navyše
  tvrdí obe tlačidlá aktívne v strede.
- `sidebarUnsaved.test.ts`: prípad „are asked about by an arrow key at the end of the list only once the asset would
  be read anew" (držal dnešný stav: po 5 s otázka a opätovné čítanie) je prepísaný na `it.each` pre → na poslednej
  a ← na prvej dlaždici: bez napísaného sa po 6 s nič nečíta a pole ostáva pripojené, s napísaným sa nič nepýta,
  adresa zoznamu, „Save" zvýraznené. Prípad „stays open over a way that would not be asked about by itself" ostal
  bez zmeny a je zelený (otázku tam teraz drží klik na aktívnu dlaždicu; šípka na konci sa jej nedotkne).

| Ohnutie | Červené |
|---|---|
| koniec zoznamu vedie znova na aktívny asset | 4 (oba konce v detaile aj v paneli) |
| `nextItem` sa pýta pred hľadaním cieľa | 1 (posledný asset v detaile) |
| `prevItem` sa pýta pred hľadaním cieľa | 1 (prvý asset v detaile) |
| tlačidlo „ďalší" sa na konci nevypne | 1 |
| tlačidlo „predchádzajúci" sa na začiatku nevypne | 1 |
| tlačidlá sa vypínajú naopak | 3 (oba konce a prípad zo stredu zoznamu) |

## FE-52 (nález 150): adresa po šípke v zozname

**Čo sa mení v kóde.** `assetListActions.ts:455-458` a `:498-500`: `nextItem` a `prevItem` menia adresu len keď
`assetDetailStore.detail`. Vetva zlyhaného čítania sa nemenila: adresu vracia len pri otvorenom detaile, teda
práve vtedy, keď ju krok pred ňou zmenil.

**Čo sa mení pre používateľa.** So zavretým detailom ostáva po šípke adresa zoznamu; obnovenie stránky otvorí
zoznam. S otvoreným detailom adresa ďalej sleduje asset. **Na backend:** nič.

**Testy.**
- `sidebarUnsaved.test.ts`: tabuľka ciest („are asked about by %s") držala pre obe šípky adresu `/assets/asset-N`
  s komentárom „as they always did"; teraz adresu zoznamu. Prípad „are not asked about when nothing was typed"
  tvrdí navyše adresu zoznamu po dvoch šípkach a adresu assetu po ceruzke (posledný krok je ceruzka druhej dlaždice
  namiesto prvej, lebo prvá je po šípkach aktívna a práve prečítaná).
- `detailNeighbour.test.ts`: prvý prípad tvrdí adresu assetu po každom kroku pri otvorenom detaile (strážca);
  súbor si teraz pred každým prípadom vracia adresu okna na `/assets`.
- `detailNotOfList.test.ts`: po zavretom detaile šípka vyberie suseda a adresa ostane.

| Ohnutie | Červené |
|---|---|
| `nextItem` mení adresu aj so zavretým detailom | 3 |
| `prevItem` mení adresu aj so zavretým detailom | 2 |
| `nextItem` nemení adresu pri otvorenom detaile | 7 |
| `prevItem` nemení adresu pri otvorenom detaile | 6 |

## FE-51 (nález 147): počítadlo pod loaderom

**Čo sa mení v kóde.** `A/components/detail/components/AssetDetailDialogLoader.vue:27`: `isNull(…)` namiesto `!…`
(a import `isNull`). Nič iné v súbore.

**Čo sa mení pre používateľa.** Lišta detailu pod loaderom ukáže „1 / N" aj pre prvý asset. Ten istý loader kreslí
detail poskytovateľa (pozri nálezy, bod 6): počítadlo zoznamu DAM pod ním sa teraz ukáže aj pri prvej dlaždici DAM.
**Na backend:** nič.

**Testy** (`detailNeighbour.test.ts`): čítanie prvého assetu sa drží, lišta hovorí „1 / 3" a formulár nie je
nakreslený; to isté pre druhý asset (strážca). Na kóde zo snímku 1 červený.

| Ohnutie | Červené |
|---|---|
| prvé miesto sa berie za žiadne (`!index`) | 1 |

## Komentár v sklade

`A/store/assetDetailStore.ts:162-164`: „no way out but Esc" → „no way out: the dialogs are persistent, Esc does not
close one". Len text.

## Testy spolu

| Súbor | Prípady | Červené na snímku |
|---|---|---|
| `src/test/list/mainRouteChange.test.ts` (nový) | 20 | 16 |
| `src/test/list/detailNotOfList.test.ts` (nový) | 13 | 9 |
| `src/test/list/externalProviderDetail.test.ts` (nový) | 2 | 1 |
| `src/test/list/detailNeighbour.test.ts` | 25 → 30 | 4 |
| `src/test/list/sidebarUnsaved.test.ts` | 37 → 39 | 6 |
| spolu | 104 | 36 |

Zelených na snímku je 68: 56 pôvodných prípadov (z nich prvý prípad `detailNeighbour` s tvrdeniami navyše) a 12
nových strážcov: celé čítanie bez napísaného a jeho zlyhanie (4), detail poskytovateľa bez cesty cez „Fókus" (1),
šípky v detaile riadka fronty (1), detail z ceruzky po detaile mimo zoznamu (2), strážca pravidla FE-50 (1),
počítadlo pod loaderom pre druhý asset (1), `showLoader` pod otázkou na úrovni skladu (2). Deväť z nich je
červených aspoň pri jednom ohnutí. Traja nie: detail poskytovateľa bez „Fókus", šípky v detaile riadka fronty
(klávesy vypína riadok sám, drží to aj `queueRowActions.test.ts`) a počítadlo pre druhý asset; hovoria, čo sa
krokom nemá zmeniť, a žiadne z 33 ohnutí kroku na ne nemieri.

Ohnutí je 33, každé je červené (posledný prechod nad konečnými 104 prípadmi, `scratchpad/op5d2-final2.txt`). Jedno
ohnutie pri prvom prechode červené nebolo („odpovedi stačí rovnaké `id`"): prípad „read anew meanwhile" odpovedal
staršiemu čítaniu stavom servera z chvíle odpovede, nie z chvíle čítania. Prípad je opravený, ohnutie je červené.

**Existujúce prípady, ktoré som musel zmeniť** (žiadny nie je oslabený, všetky držali dnešný stav, ktorý krok mení):
1. `detailNeighbour.test.ts`: otázka pod čítaním po zmene trasy (FE-47, menuje ho zadanie).
2. `sidebarUnsaved.test.ts`: to isté pre panel (FE-47, menuje ho zadanie).
3. `sidebarUnsaved.test.ts`: šípka na konci zoznamu (FE-49).
4. `sidebarUnsaved.test.ts`: adresa po šípke v tabuľke ciest a v prípade „nothing was typed" (FE-52).
5. `detailNeighbour.test.ts`: prvý prípad dostal tvrdenia navyše (adresa, aktívne tlačidlá), pomocník `openDetail`
   berie poradie dlaždice, `shown` je na úrovni súboru. Tvrdenia ostali.

## Zmenené súbory (8 v `src` produkčných, 5 testov, 1 mimo)

- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetDetailDialog.vue` (FE-46)
- `src/domains/coreDam/shared/assetFileRoute/components/AssetFileMainRoute.vue` (FE-47)
- `src/domains/coreDam/shared/assetFileRoute/components/AssetFileRouteMakePublicDialog.vue` (FE-47)
- `src/domains/coreDam/asset/components/list/composables/assetListActions.ts` (FE-47, FE-48, FE-49, FE-52)
- `src/domains/coreDam/asset/components/list/components/AssetListSidebarMetadata.vue` (FE-50)
- `src/domains/coreDam/asset/components/detail/components/AssetDetailDialog.vue` (FE-49)
- `src/domains/coreDam/asset/components/detail/components/AssetDetailDialogLoader.vue` (FE-51)
- `src/domains/coreDam/asset/store/assetDetailStore.ts` (komentár)
- `src/test/list/mainRouteChange.test.ts` (nový, 20), `src/test/list/detailNotOfList.test.ts` (nový, 13),
  `src/test/list/externalProviderDetail.test.ts` (nový, 2)
- `src/test/list/detailNeighbour.test.ts` (25 → 30), `src/test/list/sidebarUnsaved.test.ts` (37 → 39)
- `doc/changelog/3.0.0.md` („Fixed": sedem nových položiek za položkou OP5-D1; z jej poslednej vety vypadlo
  „the read after a file is made public or private in the panel")

## Nové nálezy (neopravené)

1. **(Opravené v cykle 1, FE-63.) Odmietnutá zmena trasy súboru neukáže žiadnu hlášku.** A k tomu, čo som pri
   kroku nevidel a našiel posudok: úspešné „Nastaviť ako súkromné" obrázka a dokumentu backend odpovedá 204 a obal
   ho bral za odmietnuté (bez dôvodu, `reject()`), takže aj úspech končil v tej istej tichej vetve; testy kroku to
   nevideli, lebo falošný server odpovedal 200. Cyklus 1 opravuje oboje.
   Pôvodný zápis: `imageApi.makePrivate` / `makePublic`
   (`A/api/imageApi.ts:138-176`, rovnako audio a dokument cez `A/api/fileApi.ts:304-360`) odmietnu surovou chybou
   axiosu; `showErrorsDefault` knižnice pozná len triedy `Anzu…Error` a vráti `false`
   (`common-admin/src/domains/system/composables/alerts.ts:130-175`), volajúci s tým nič neurobia
   (`R/AssetFileMainRoute.vue:47-48`, `R/AssetFileRouteMakePublicDialog.vue:83-84`). Overené testom: po odpovedi 500
   je zoznam hlášok prázdny. Po FE-47 ostane obrazovka po zlyhaní úplne bez zmeny. Oprava bez knižnice a bez nového
   textu: `if (!showErrorsDefault(e)) showUnknownError()` na dvoch miestach (S). Oznámené vedúcemu správou počas
   práce.
2. **Dialóg „Nastaviť ako verejné" sa zavrie aj po odmietnutej zmene** (`R/AssetFileRouteMakePublicDialog.vue:86-89`,
   `finally`): slug napísaný pri audiu a dokumente je preč, spolu s bodom 1 bez slova.
3. **Samostatná stránka detailu a stránka detailu súboru čítajú po zmene trasy celý asset a neuložené metadáta
   zahodia bez otázky** (`A/components/detail/AssetDetailView.vue:233` → `getDetail` `:74-113`;
   `AssetFileDetailView.vue:210` → `:67-105`). FE-47 rieši len zoznam (`refreshActiveItem`).
4. **Karta slotov po zmene trasy číta len zoznam slotov** (`A/components/detail/components/slots/
   AssetSlotListItem.vue:179`): keď je slot hlavným súborom, karta súboru na „Info" ostane v starom stave do ďalšieho
   čítania assetu. Čítaním kódu, bez testu.
5. **Šípka v zozname so zavretým detailom: zlyhané čítanie nepovie nič.** `nextItem` / `prevItem` sa po `reset()`
   vrátia pred hláškou, keď detail nebol otvorený (`assetListActions.ts:475`, `:517`); panel povie „žiadny asset" bez
   chyby. Klik na dlaždicu chybu ukáže (`:364-369`). Čítaním kódu.
6. **Detail poskytovateľa ukazuje pod loaderom počítadlo zoznamu DAM** (`AssetDetailDialogLoader.vue:26-31`, použitý
   v `EP/components/ExternalProviderAssetDetailDialog.vue:96-99`); po FE-51 aj pri prvej dlaždici DAM. Zadanie:
   zapísať, neopravovať.
7. **Tlačidlá ‹ › pod loaderom vyzerajú aktívne a nerobia nič** (`AssetDetailDialogLoader.vue:50,66`,
   `@click.stop=""`), aj na koncoch zoznamu, kde sú po načítaní vypnuté. Kozmetika.
8. **„Upraviť" panela po novom načítaní zoznamu** otvorí detail bez lišty (dôsledok pravidla FE-50 nad známym
   FE-61, pozri FE-50). Zmizne s opravou FE-61.
9. **(Opravené v cykle 1.) Menu „⋮" karty súboru ostáva po akcii otvorené** (`R/AssetFileMainRoute.vue:62`, položky
   s `@click.stop`); po FE-47 je to pri neuložených metadátach vidieť (pozri FE-47).
10. **Mŕtva vetva `directDetailLoad` na dvoch samostatných stránkach detailu** (`A/components/detail/
    AssetDetailView.vue:75-84`, `AssetFileDetailView.vue:68-77`; z posudku cyklu 1, čítal som ju): `onMounted` volá
    `resetAllStores()`, ktoré príznak zruší (`:119`, `:112`), skôr než po 100 ms beží `getDetail`; vetva sa teda
    nevykoná ani pri priamom odkaze, kde príznak nastavuje štart aplikácie (`A/composables/currentExtSystem.ts:96`).
11. **Odmietnutie, ktoré server vysvetlí, ukáže len všeobecnú „Systémová chyba…"** (zapísané v cykle 2): 403 bez
    práva, 422 s chybou validácie slugu, 422 zakázanej operácie (pri „Nastaviť ako verejné" súbor, ktorý sa ešte
    spracúva, alebo už trasu má; pri „Nastaviť ako súkromné" súbor bez trasy: `core-dam-bundle/src/Domain/
    AssetFileRoute/AssetFileRouteFacade.php:75-80,149-169`). Šesť obalov trasy sú staré `new Promise` nad klientom
    a odmietajú surovou chybou axiosu (`A/api/imageApi.ts:138-178`, `documentApi.ts:124-168`,
    `audioApi.ts:124-168`), ktorú `showErrorsDefault` nepozná, takže dôvod sa k používateľovi nedostane. Dialóg
    „Nastaviť ako verejné" sa pri tom zavrie (nález 2): chyba slugu sa neukáže pri poli a napísaný slug je preč.
    Oprava: obaly na `useApiRequest` (chyby, ktoré hlášky poznajú) a dialóg po odmietnutí nechať otvorený (S až M).

## Cyklus 1 (OP5-D2-c1): 204 pri „Nastaviť ako súkromné", hláška o odmietnutej zmene a päť menších bodov

Po posudkoch (Opus, Codex). Ostatné opravy kroku v oboch obstáli. Čísla riadkov v tejto časti platia pre strom po
cykle.

1. **Snímok `OP5-D2-c1`** (rovnaký príkaz, meno `OP5-D2-c1`), hotový pred prvou úpravou cyklu.

### Bod 1 (vysoká závažnosť): úspešná zmena je úspech, či backend odpovie 200, alebo 204

Čo backend naozaj odpovedá (`/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src/Controller/
Api/Adm/V1/`), čo obal bral pred cyklom a čo berie teraz:

| Akcia | Backend | Obal pred cyklom | Obal po cykle |
|---|---|---|---|
| obrázok, `make-private` | 204 bez tela (`ImageController.php:340-347`, `noContentResponse()`) | len 200: úspech odmietnutý | 200 aj 204 (`A/api/imageApi.ts:158-178`) |
| dokument, `make-private` | 204 bez tela (`DocumentController.php:280-287`) | len 200: úspech odmietnutý | 200 aj 204 (`A/api/documentApi.ts:149-168`) |
| audio, `make-private` | 200 s `AudioFileAdmDetailDto` (`AudioController.php:285-294`) | len 200: sedelo | 200 aj 204 (`A/api/audioApi.ts:149-168`) |
| obrázok, `make-public` | 200 s `AssetFileRouteAdmDetailDecorator` (`ImageController.php:324-332`) | len 200: sedí | bez zmeny |
| dokument, `make-public` | 200 s tým istým (`DocumentController.php:264-272`) | len 200: sedí | bez zmeny |
| audio, `make-public` | 200 s tým istým (`AudioController.php:268-277`) | len 200: sedí | bez zmeny |
| video | backend akciu nemá, aplikácia obal nemá (`A/api/fileApi.ts` skončí chybou „unsupported asset type") | | bez zmeny |

**Rozhodnutia.**
- Tri obaly `makePrivate` berú 200 aj 204, všetky tri rovnako, aj audio: tri radiče tej istej akcie dnes odpovedajú
  dvoma spôsobmi a anotácia obrázka a dokumentu sľubuje telo (pozri „Pre backend"), takže ktorýkoľvek z nich sa môže
  zmeniť na ten druhý. Úspešná zmena sa už za odmietnutú nevezme ani potom.
- Tri obaly `makePublic` som nemenil: všetky tri radiče odpovedajú 200 s trasou a majú `OAResponseValidation`,
  odpoveď je teda kontrolovaná zmluva; obal ju berie. Tri nové prípady to držia.
- Vrátenú hodnotu nikto nečíta: obaja volajúci (`R/AssetFileMainRoute.vue:55`, `R/AssetFileRouteMakePublicDialog.vue:80`)
  len čakajú na koniec. Obaly `makePrivate` a `makePrivateFile` (`A/api/fileApi.ts:334`) preto vracajú
  `Promise<void>`; doterajší typ `AssetFileRoute` neplatil pre žiadnu z troch odpovedí (nič, nič, audio súbor).
- Iná odpoveď než 200 alebo 204 je ďalej odmietnutie bez dôvodu (`reject()`); s bodom 2 už povie hlášku.

**Pre používateľa.** „Nastaviť ako súkromné" obrázka a dokumentu funguje: karta prejde na „Súbor je neprístupný"
a nič sa neukáže ako chyba. Oproti stavu pred krokom sa tým nemení nič viditeľné (vtedy to skrývalo čítanie po
každej zmene); oproti kroku áno.

### Bod 2 (FE-63): odmietnutá zmena to povie

`R/AssetFileMainRoute.vue:58` a `R/AssetFileRouteMakePublicDialog.vue:85`:
`if (!showErrorsDefault(e)) showUnknownError()`, ako `A/api/assetApi.ts:344`. Existujúci text knižnice, žiadna
zmena knižnice. Spolu s bodom 1, takže skutočný úspech ju neukáže.

**Pre používateľa.** Po odmietnutej zmene (chyba servera, sieť, odpoveď iná než 200 / 204) sa raz ukáže „Systémová
chyba. Skúste neskôr alebo kontaktujte administrátora.", nič sa nečíta a formulár ostane, ako bol. Oprava vedúceho
po posudku Codexu: obaly týchto dvoch akcií odmietajú surovou chybou axios, ktorú `showErrorsDefault` nepozná, takže
ani 403 či 422 doteraz neukázali nič; po cykle ukážu tú istú všeobecnú hlášku, nie konkrétnu („nemáte oprávnenie",
chyby validácie slugu).

### Bod 3: pri neuložených metadátach sa berie len trasa súboru

`A/components/list/composables/assetListActions.ts:319-331`: namiesto celého `mainFile` sa zapíše len
`mainFile.mainRoute` (obe strany musia súbor mať a nesmie to byť video, ktoré trasu nemá; tá istá podmienka ako
`routableAssetFile` v `A/components/AssetMetadata.vue:71-74`). Stav spracovania súboru ostáva, ako bol prečítaný, takže
„Uložiť" zablokované hláškou „súbor sa ešte spracúva" sa zmenou trasy neodblokuje nad formulárom prečítaným pred
spracovaním.

**Medza.** Ak server medzitým vymenil hlavný súbor assetu, držaný súbor dostane trasu nového; celý formulár je vtedy
starý až do ďalšieho čítania.

### Bod 4: menu karty súboru sa po úspešnej zmene zavrie

`R/AssetFileMainRoute.vue:44-50,71-74,126`: `VMenu` má `v-model`; `routeChanged()` ho zavrie a pošle udalosť, volá ho
úspešné „Nastaviť ako súkromné" aj `afterUpdate` dialógu „Nastaviť ako verejné".

**Rozhodnutie.** Zavrie sa len po úspešnej zmene, teda presne tam, kde ho doteraz odniesol loader. Po odmietnutej
zmene ostáva otvorené (ako po kroku) pre ďalší pokus, s hláškou z bodu 2; drží to prípad aj ohnutie.

### Bod 5: chvost OP5-D1-c1

- (a) `assetListActions.ts:127-134`, `leaveUnsavedFor`: po „Odísť aj tak" ostane kliknuté miesto, keď na ňom stále je
  kliknutý asset; podľa `id` sa hľadá len inak. Asset uvedený v zozname dvakrát sa tak zvýrazní tam, kde sa naň
  kliklo, nie na svojom prvom mieste.
- (b) changelog, položka FE-45: „kam asset medzitým prešiel, a nikam, keď v zozname nie je" je teraz napísané len pre
  klik a ceruzku (šípky idú od aktívneho miesta zoznamu, aký vtedy je); „with Ctrl, Cmd, Shift or Alt held the link
  opens elsewhere" → „is not followed in this tab".

### Bod 6: texty

- changelog: tlačidlá lišty sú vypnuté na koncoch „v detaile, ktorý svoj asset ukazuje"; lišta pod loaderom má obe
  tlačidlá ako doteraz (nakreslené aktívne, nerobia nič). Loader som nemenil.
- changelog, položka FE-47: „only the route of the file is now taken… the card shows whether the file is public or
  private by then" (pravda po bodoch 1 a 3); posledná veta teraz hovorí, že odmietnutá zmena to povie a nič nečíta.
- táto poznámka: časť FE-47 („Čo sa mení pre používateľa", medze) a nálezy 1 a 9 hovoria, čo platí po cykle.

### Testy cyklu

- **Falošný server odpovedá ako core-dam** vo všetkých troch súboroch: `make-private` obrázka a dokumentu 204 bez
  tela, audia 200 so súborom; `make-public` 200 s trasou. V `mainRouteChange.test.ts` je druhý asset zoznamu podľa
  prípadu obrázok, dokument alebo audio. Tým sú na snímku cyklu červené aj prípady kroku, ktoré robia obrázok
  súkromným: predtým chybu vidieť nemohli.
- `mainRouteChange.test.ts` 20 → 40:
  - bod 1: každý typ súboru × detail a panel s odpoveďou, akú dáva backend: karta „File is private", jedno čítanie
    držaného assetu, žiadna hláška, menu preč (6); každý typ × odpoveď 200 a 204 (6); `make-public` každého typu:
    karta „File is public", jediná hláška je „Record was updated" dialógu (3);
  - bod 2: odmietnutie tromi spôsobmi (500, sieť bez odpovede, odpoveď 202): jedna hláška, karta ako bola, nič sa
    nečíta (3); dva existujúce prípady odmietnutej zmeny a prípad „Make public" navyše tvrdia hlášky (po úspechu
    žiadnu chybovú);
  - bod 3: súbor „stored" pri čítaní formulára, „Save" vypnuté a text o spracúvaní; server medzitým súbor spracuje;
    po zmene trasy karta „File is private", „Save" stále vypnuté a text tam je; detail aj panel (2);
  - bod 4: v prípadoch s napísaným sa menu po úspešnej zmene samo zavrie (pomocník `closeMenu` s Esc je preč,
    nahradil ho `menuIsClosed`, ktorý to tvrdí); po odmietnutej zmene ostáva.
- `sidebarUnsaved.test.ts` 39 → 40: bod 5a, asset uvedený v zozname dvakrát, klik na jeho druhú dlaždicu a „Leave
  anyway": aktívna je kliknutá dlaždica (1).
- `detailNeighbour.test.ts`: bez nového prípadu, len odpoveď 204.

Na kóde zo snímku `OP5-D2-c1` (päť súborov kroku, 125 prípadov): **34 červených**, 91 zelených. Z 21 nových prípadov
je červených 13; zelených 8 sú strážcovia (audio s odpoveďou backendu v detaile a v paneli, každý typ s odpoveďou
200, tri `make-public`). Zvyšných 21 červených sú prípady kroku, ktoré po oprave falošného servera vidia bod 1 alebo
dostali tvrdenia bodov 2 a 4. Na kóde stromu 125 zelených. Skripty `scratchpad/op5d2c1-bend-run.sh`,
`op5d2c1-bends.py`, výsledok `op5d2c1-final.txt`. Ohnutí je 13, každé je červené.

| Ohnutie | Červené |
|---|---|
| bod 1: obal obrázka berie len 200 | 23 (všetky prípady, ktoré robia obrázok súkromným) |
| bod 1: obal obrázka berie len 204 | 1 (obrázok s odpoveďou 200) |
| bod 1: obal dokumentu berie len 200 | 3 (dokument v detaile, v paneli, s odpoveďou 204) |
| bod 1: obal dokumentu berie len 204 | 1 (dokument s odpoveďou 200) |
| bod 1: obal audia berie len 200 | 1 (audio s odpoveďou 204) |
| bod 1: obal audia berie len 204 | 3 (audio v detaile, v paneli, s odpoveďou 200) |
| bod 2: odmietnuté „Make private" nič nepovie | 5 (tri spôsoby odmietnutia, dva prípady odmietnutej zmeny) |
| bod 2: odmietnuté „Make public" nič nepovie | 1 |
| bod 3: s napísaným sa vezme celý súbor | 2 (detail, panel) |
| bod 4: menu po úspešnej zmene ostane | 7 |
| bod 4: menu sa zavrie aj po odmietnutej zmene | 2 |
| bod 5a: berie sa prvé miesto assetu | 1 |
| bod 5a: kliknuté miesto ostane, nech je na ňom čokoľvek | 2 (dva prípady OP5-D1-c1 „asset presunutý") |

2. `oxfmt`, `oxlint` 0; `eslint` nad súbormi cyklu (cez `tezky.sh`, `scratchpad/op5d2c1-lint.sh`) 0; `lint:tsc` v CK.
3. **CK-DAM OP5-D2-c1** (`krok5-praca/vysledky/OP5-D2-c1-ck.log`) zelené: 86 súborov / 1 529 testov (CK OP5-D2
   86 / 1 508, +21), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
4. **Záplata** `zaplata.sh OP5-D2-c1`: `krok5-praca/zaplaty/OP5-D2-c1.diff` (630 riadkov, 11 súborov: `imageApi.ts`,
   `documentApi.ts`, `audioApi.ts`, `fileApi.ts`, `assetListActions.ts`, `AssetFileMainRoute.vue`,
   `AssetFileRouteMakePublicDialog.vue`, tri súbory testov, `doc/changelog/3.0.0.md`).

**Mimo zmeny, neopravené (ostávajú v zozname nálezov):** samostatné stránky detailu po zmene trasy zahodia neuložené
metadáta bez otázky (nález 3), karta slotov číta len zoznam slotov (nález 4), mŕtva vetva `directDetailLoad`
(nález 10).

### Pre backend

`makePrivate` obrázka a dokumentu vracia 204 bez tela, hoci jeho anotácia dokumentuje telo, a to cudzie:
`OAResponse(AudioFileAdmDetailDto::class)` (`core-dam-bundle/src/Controller/Api/Adm/V1/ImageController.php:339-347`,
`DocumentController.php:279-287`; pri dokumente je aj `OAParameterPath('audio')` namiesto `'document'`, `:279`).
`makePrivate` audia vracia 200 s `AudioFileAdmDetailDto` (`AudioController.php:284-294`). Tri radiče tej istej akcie
teda odpovedajú dvoma spôsobmi a dokumentácia API sedí len pri audiu. Frontend po cykle berie oboje; backendu som sa
nedotkol.

## Cyklus 2 (OP5-D2-c2): jedna zmena trasy naraz

Po úzkych posudkoch cyklu 1 (v siedmich bodoch žiadna chyba v kóde), jeden malý bod, dôsledok FE-63.

1. **Snímok `OP5-D2-c2`**, hotový pred prvou úpravou cyklu.
2. **Nález.** Položka „Nastaviť ako súkromné" ostáva v otvorenom menu, kým beží jej požiadavka (`@click.stop`,
   `:loading` nie je vlastnosť `VListItem`, položka sa nevypína); druhý klik poslal druhý `PATCH`. Prvý uspel, druhý
   server odmietol (trasa už nie je, `AssetFileRouteFacade.php:75-80`) a od cyklu 1 to ukázalo „Systémová chyba" nad
   kartou, ktorá správne prešla na súkromnú.
3. **Čo sa mení v kóde.**
   - `R/AssetFileMainRoute.vue:52-55`, `makePrivate`: `if (loading.value) return` ako prvý riadok. `loading` sa
     ruší po odmietnutí aj po úspechu (`:62`, `:66`), takže položka potom funguje znova.
   - `R/AssetFileRouteMakePublicDialog.vue:71-73`, `onConfirm`: `if (buttonLoading.value) return`.
4. **Je dvojité odoslanie v dialógu „Nastaviť ako verejné" naozaj dosiahnuteľné? Áno, klávesnicou.** Tlačidlo
   „Potvrdiť" má počas požiadavky len `:loading`: Vuetify mu dá `pointer-events: none` a `tabindex="-1"`, ale nie
   `disabled` (`vuetify/lib/components/VBtn/VBtn.js:144,176,183-184`, `VBtn.sass:128-129`). Myšou sa druhýkrát
   kliknúť nedá; tlačidlo však po prvom kliku ostáva vo fokuse a Enter alebo medzerník na ňom je znova `click`. Druhý
   `PATCH` by server odmietol (súbor už trasu má, `AssetFileRouteFacade.php:161-169`) a hláška by prišla nad úspešnou
   zmenou, rovnako ako pri „Nastaviť ako súkromné". Preto rovnaká stráž.
5. **Čo sa mení pre používateľa.** Kým zmena trasy beží, ďalší klik na položku (alebo stlačenie klávesu na
   „Potvrdiť") nič nepošle a nič neukáže. Po jej skončení, úspešnom aj odmietnutom, akcia funguje znova. Vzhľad sa
   nemení (položka sa počas požiadavky nevypína ani netočí, ako doteraz). **Na backend:** neodíde druhý `PATCH`.
6. **Medza, ktorá ostáva.** Stráž drží len počas požiadavky. Pri neuložených metadátach (bez loadera) ostáva po
   úspešnej zmene karta v starom stave, kým nedobehne čítanie assetu (jeden `GET`); menu sa síce zavrie samo (cyklus
   1), ale kto ho v tom okne znova otvorí a klikne, pošle druhú zmenu, ktorú server odmietne, s hláškou.
7. **Testy** (`mainRouteChange.test.ts` 40 → 44, blok „while a change is on its way"; požiadavky sa držia a po
   pustení odpovedajú v poradí ako core-dam, druhá by bola odmietnutá 422):
   - tri kliky na „Make private" počas požiadavky, v detaile aj v paneli: jeden `PATCH`; po odpovedi karta „File is
     private", jedno čítanie, žiadna hláška (2);
   - dve potvrdenia dialógu „Make public" počas požiadavky: jeden `PATCH`; po odpovedi karta „File is public",
     jediná hláška je „Record was updated", dialóg zavretý (1);
   - po odmietnutej zmene nový klik pošle znova a zmena prejde (1; strážca, zelený aj na snímku). To isté držia aj
     dva staršie prípady odmietnutej zmeny (dva `PATCH`).
   - Na kóde zo snímku `OP5-D2-c2` (44 prípadov súboru): **3 červené**, 41 zelených. Ohnutia
     (`scratchpad/op5d2c2-bend-run.sh`, `op5d2c2-bends.py`, výsledok `op5d2c2-final.txt`):

   | Ohnutie | Červené |
   |---|---|
   | druhé „Make private" odíde počas prvého | 2 (detail, panel) |
   | druhé potvrdenie „Make public" odíde počas prvého | 1 |
   | odmietnuté „Make private" nechá položku zablokovanú | 3 (nový strážca a dva staršie prípady odmietnutej zmeny) |

8. `oxfmt`, `oxlint` 0; `eslint` nad súbormi cyklu (cez `tezky.sh`, `scratchpad/op5d2c2-lint.sh`) 0; `lint:tsc` v CK.
9. **CK-DAM OP5-D2-c2** (`krok5-praca/vysledky/OP5-D2-c2-ck.log`) zelené: 86 súborov / 1 533 testov (CK OP5-D2-c1
   86 / 1 529, +4), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
10. **Záplata** `zaplata.sh OP5-D2-c2`: `krok5-praca/zaplaty/OP5-D2-c2.diff` (152 riadkov, 3 súbory:
    `AssetFileMainRoute.vue`, `AssetFileRouteMakePublicDialog.vue`, `mainRouteChange.test.ts`). Changelog sa v cykle
    nemenil: oproti vydanému stavu sa pre používateľa nemení nič (hláška o odmietnutej zmene je z cyklu 1).
11. **Bod 2 zadania cyklu (len poznámka):** vetu vedúceho v časti „Bod 2 (FE-63)" som nechal, ako je; pribudol nález 11
    v časti „Nové nálezy".
