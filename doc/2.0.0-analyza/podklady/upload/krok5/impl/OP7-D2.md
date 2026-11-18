# OP7-D2: detail assetu, FE-84, FE-88, FE-89 s „Make public" len pre spracovaný súbor, FE-90 až FE-95 (impl-dam-op7b)

Zadanie vedúceho z 13. 10. (`krok5-praca/zadania/zadanie-OP7-D2.md`, pravidlá `PRAVIDLA.md`); nálezy
`overenie-nalezov.md` („Deviate overenie" FE-84, „Desiate overenie" FE-88 až FE-94, FE-95, „Otvorené z OP6-D2").
Strom `/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `fc116a71` a nad ním nezapísaný krok `OP7-D1`
(východiskový stav; nič z neho som nevracal). TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op7b`, pracovný
priečinok `krok5-praca/pracovne/impl-dam-op7b/`. Nič sa nemazalo, žiadny zápis do gitu, knižnica ani texty prekladov
sa nemenili. Bash bez `cd`, cyklov a funkcií; niekoľko príkazov malo dve až štyri časti spojené `&&` alebo `;`
(všetky prešli bez otázky). **V prehliadači som nevidel nič z tohto kroku.**

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `D/` = `A/components/detail/`,
`R/` = `domains/coreDam/shared/assetFileRoute/components/`. Čísla riadkov platia pre strom po kroku.

**Počas kroku bežal cyklus opráv `OP7-D1`** (iný agent, ten istý strom). Od môjho snímku zmenil šesť súborov, ktoré nie
sú moje (`A/components/AssetCreateButton.vue`, `A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue`,
`A/composables/assetInNewTab.ts`, testy `externalProviderNewTab`, `licenceDialogConfirm`, `downloadUnload`) a dva
riadky changelogu. Záplata `OP7-D2.diff` je rozdiel snímok → strom, takže ich obsahuje tiež. V troch súboroch, ktoré
meníme obaja (`AssetDownloadButton.vue`, `AssetDetailView.vue`, `AssetFileDetailView.vue`), je oproti snímku len moja
zmena (overené rozdielom).

## Podkroky

1. **Snímok `OP7-D2`** (`snimok.sh … OP7-D2 doc/changelog/3.0.0.md`), hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** nižšie. Starý kód a ohnutia len v pamäti (`vitest.old.config.mts`, `OLD_SNAP=OP7-D2`;
   `vitest.k3-bend.config.mts`; skopírované z TMPDIR `impl-dam-op6b`). Skripty a výsledky v pracovnom priečinku:
   `t.sh`, `old.sh` (`log/old-all.log`), `bends.py`, `bend-run.sh`, `bends/vysledok.txt`, `fmt.sh`.
   Deväť súborov testov kroku, 133 prípadov; nad zdrojmi snímku (15 produkčných súborov kroku podaných zo snímku)
   **31 červených**, 102 zelených, a 5 nezachytených chýb starého kódu; na strome 133 zelených.
3. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
4. **CK-DAM OP7-D2**, obe časti zelené: `vysledky/OP7-D2-testy.log` 106 súborov / 1 780 testov (CK OP7-D1 101 / 1 729:
   +5 súborov a +40 prípadov je z tohto kroku, +11 prípadov z cyklu `OP7-D1`); `vysledky/OP7-D2-linty.log`:
   `generate:dts`, `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplaty/OP7-D2.diff`: 3 310 riadkov, 31 súborov (25 tohto kroku, 6 cyklu `OP7-D1`); mimo `src` len
   `doc/changelog/3.0.0.md` (je v snímku).

## Skupina A

### FE-88 (nález 204): sloty iného assetu v karte „Sloty"

**Čo robí kód.**
- `A/store/assetSlotsStore.ts:24-44`: každé zdvihnutie loadera slotov je počítané. `showLoader()` vráti poradie,
  `isAwaited(poradie)` hovorí, či loader odvtedy nezdvihlo nič iné, `hideLoader(poradie)` loader zhodí len vtedy.
- `D/composables/assetDetailSidebarSlotsActions.ts:31-64`: `getList` zapíše odpoveď len vtedy, keď (a) sklad detailu
  drží asset, pre ktorý sa čítalo (`detailHoldsAsset`, `:38`), a (b) loader odvtedy nezdvihlo nič iné (`isTaken`,
  `:52`). Zlyhanie čítania, ktoré sa nezapisuje, sa nehlási (`:59`). Loader zhadzuje `finally` aj po odpovedi, ktorá
  sa nezapísala, ak je to stále posledné zdvihnutie (`:62`). Keď detail drží iný asset už vo chvíli, keď sa má
  čítať (čítanie po zmene slotu, ktorá trvala), nečíta sa vôbec a zhodí sa len loader, ktorý zdvihla zmena, ak ho
  medzitým nezdvihla karta ďalšieho assetu (`:46-50`). Štyri zmeny slotu zdvíhajú loader cez `showLoader` composable
  (`:41`, `:85`, `:100`, `:116`, `:128`), aby sa vedelo, čo táto časť detailu zdvihla naposledy.
- `getListAfterChange` (`:70-73`) je bez zmeny správania; upravený je len komentár (dôvod „odpoveď prvého zhodí loader
  pod druhým" po počítaní neplatí, ostáva „druhé čítanie zbytočne").

**Rozhodnutie, v ktorom sa odchyľujem od znenia zadania (oznámené vedúcemu správou).** Zadanie: odpoveď sa berie „len
kým karta, ktorá sa pýtala, ešte je". Zánik karty nesledujem. Dôvod: pri zaniknutej karte a INOM assete v detaile
odpoveď zahodí podmienka (a). Pri zaniknutej karte a TOM ISTOM assete (Sloty → Info → Sloty počas pomalej zmeny) je
čítanie, ktoré nasleduje po zmene, jediné, ktoré prinesie sloty po zmene: nová karta si sloty prečítala ešte pred
odpoveďou servera. Zahodiť ho by nechalo znovu otvorenú kartu pri riadkoch spred zmeny až do „Znovu načítať sloty
assetu", čo kód pred krokom nerobil. Pri obyčajnom čítaní zaniknutej karty sledovanie nemení nič, čo používateľ
vidí: nová karta číta neskôr, takže staršiu odpoveď zahodí (b). Ten prípad drží strážca (nižšie).

**Čo vidí používateľ.** Po zmene slotu a prechode na susedný asset ukazuje karta „Sloty" sloty svojho assetu, aj keď
odpoveď zmeny príde až potom; menu riadkov sú o súboroch toho assetu. Z dvoch čítaní slotov platí neskoršie; riadky
sa nakreslia až po ňom. **Na backend:** po zmene odpovedanej, keď detail drží iný asset, neodíde čítanie slotov
predošlého assetu.

**Medze.**
- Kým detail nasledujúci asset ešte len číta (sklad drží predošlý), čítanie po zmene odíde a jeho odpoveď sa do skladu
  zapíše, ak príde pred assetom; karta ďalšieho assetu sa pripojí až potom a číta sama (jej čítanie je neskoršie).
- Loader slotov ostáva v sklade hore po zmene, ktorej následné čítanie je prenechané karte kreslenej znova
  (`getListAfterChange` pod loaderom detailu), ak sa tá karta už nenakreslí (zlyhané celé čítanie). Nevidno to: každá
  karta aj výber slotov pri pripojení číta a loader si zdvihne a zhodí sama.

**Testy** (nový `src/test/list/slotsTab.test.ts`, 6 prípadov; zoznam s dvoma audio assetmi, detail prvého na karte
„Sloty", prechod tlačidlom „ďalší"): odpoveď zmeny slotu predošlého assetu príde po prechode: riadky ďalšieho assetu
ostávajú, nič sa nečíta, a „Odstrániť súbor natrvalo" riadka zmaže súbor tohto assetu (1); to isté pre neskorú odpoveď
čítania („Znovu načítať sloty assetu") (1); dve čítania jedného assetu, staršie odpovedané posledné (1) a prvé, keď
riadky čakajú na neskoršie (1); strážca: zmena odpovedaná po odchode z karty a návrate ukáže sloty po zmene (1; zelený
aj na snímku). Na snímku 4 červené z 5.

| Ohnutie | Červené |
|---|---|
| odpoveď sa píše, nech detail drží čokoľvek | 1 (neskorá odpoveď zmeny) |
| píše sa aj staršia odpoveď | 1 (staršie odpovedané posledné) |
| píše sa každá odpoveď (bez oboch podmienok) | 2 (neskorá odpoveď čítania, staršie posledné) |
| loader zhodí každá odpoveď | 1 (staršie odpovedané prvé) |

Prípad „neskorá odpoveď čítania" držia obe podmienky naraz (červený je len pri ohnutí bez oboch). Zhodenie loadera
pri vynechanom čítaní (`:47`) a podmienka (a) vnútri `isTaken` nemajú vlastné ohnutie: ich účinok cez rozhranie
nevidno (pozri medze).

### FE-90 (nález 206): „Spraviť ako hlavný súbor" len pre spracovaný súbor

`D/components/slots/AssetSlotListItem.vue:241-248`: položka má navyše podmienku
`statusComputed === AssetFileProcessStatus.Processed` (stav riadka zo zoznamu slotov). Používateľ: pri súbore, ktorý
zlyhal, je duplikát alebo sa spracúva, položka v menu nie je. Test: `slotsTab.test.ts`, 1 prípad s piatimi slotmi
(hlavný, spracovaný, `stored`, `failed`, `duplicate`): ponúknutá len pri spracovanom, ktorý nie je hlavný; na snímku
červený. Ohnutie „bez podmienky stavu": 1 červený.

## Skupina B

### FE-89 (nález 203): detail otvorený počas spracovania sa dozvie, že súbor je spracovaný

**Čo robí kód.**
- `A/store/assetDetailStore.ts:155-188`: `tellPageBy(fileChanged)` zapíše funkciu stránky, ktorá detail kreslí, a
  vráti jej odhlásenie; `mainFileProcessed(assetId, fileId)`: keď sklad drží ten asset, súbor je jeho hlavný a je
  držaný v inom stave než `processed`, zabudne pečiatku „práve čítaný" (`forgetLastFetched`) a cez
  `readAfterCurrentRead` povie stránke: hneď, alebo po dobehnutí čítania, ktoré práve beží, ak aj to prinieslo súbor
  ako nespracovaný (podmienka sa vyhodnotí znova po dobehnutí).
- `D/composables/assetDetailFileChange.ts:21-24`: `provideAssetFileChanged` okrem `provide` zapíše funkciu stránky do
  skladu a pri odpojení stránky ju odhlási. Stránka tak číta tou istou cestou ako po zmene súboru v detaile
  (`readAfterFileChange`): bez napísaného celé čítanie stránky, s napísaným tiché.
- Dve miesta, kde sa aplikácia o spracovaní dozvie: notifikácia `AssetFileProcessed`
  (`domains/system/composables/appNotificationListeners.ts:35`; nezávisle od riadkov front) a každé čítanie assetu,
  ktoré robí fronta uploadu pre svoje riadky, cez hook `onAssetRead` (`A/store/uploadQueuesStore.ts:282-287`):
  poll fronty, čítanie po notifikácii (aj po spracovaní slotového súboru), tlačidlo obnovenia riadka. Overené v
  `uploadSettlement.ts` knižnice: `applyAssetRead` volá `onAssetRead` po každom z nich.
- Tiché čítanie (`assetDetailFileChange.ts:64-78`) už neberie z toho istého hlavného súboru len trasu, ale celý
  súbor, ako ho má server; `setMainFile` (`assetDetailStore.ts:148-154`) pri TOM ISTOM súbore nechá tri prepínače, ako
  sú (pri inom súbore ich berie, ako od OP6-D2-c1), a keď bolo „Uložiť" zadržané, zapne `saveHeldBack`.

**Čo vidí používateľ.**
- Bez napísaného: po spracovaní súboru ide detail (dialóg nad zoznamom, panel pri zozname, obe stránky detailu) sám
  pod svoj loader, asset sa prečíta celý, formulár je nový a „Uložiť" sa uvoľní. **Deje sa to samo, aj keď je
  používateľ na inej karte detailu alebo má v detaile otvorený dialóg (karta aj dialóg sa pod loaderom odpoja).**
- S napísaným: žiadny loader, napísané ostáva v tom istom poli, „Uložiť" ostáva zadržané s tým istým textom; hlavný
  súbor sa vezme, ako ho má server (obrázok vľavo, „Nastaviť ako verejné" v menu karty súboru).
- To isté tiché prevzatie platí odteraz aj po zmene trasy s napísanými metadátami (predtým len trasa).
- **Na backend:** po notifikácii alebo čítaní fronty jedno `GET /adm/v1/asset/:id` navyše (na stránke súboru prvé
  čítanie podľa súboru, opakované podľa id assetu).

**Rozhodnutie.** Detailu hovorím len o stave `processed`, ako znie zadanie. Stavy `failed` a `duplicate` otvorený
detail ďalej nedostane (nový nález 3).

**Kedy stav ostane starý a čo používateľ urobí** (zadanie to žiada vymenovať):
- súbor nahral iný používateľ: notifikácia ide tomu, kto nahrával, a riadok fronty má len on;
- notifikácie sú vypnuté alebo spojenie vypadlo a riadok fronty assetu už nie je (používateľ ho zmazal, frontu
  vyčistil, stránku obnovil počas spracovania): nepýta sa nikto;
- iná karta prehliadača toho istého používateľa pri vypnutých notifikáciách;
- hromadná úprava a čítania zoznamu stav poznajú, detailu ho nepovedia (nenapojené, zadanie menuje notifikáciu a
  poll);
- celé čítanie, ktoré samo prinesie ešte starý stav, keď po ňom už nepríde ďalšia správa.
V karte Info pomôže nové prečítanie assetu (zavrieť a otvoriť detail, iná dlaždica a späť po 5 s, obnoviť stránku), v
riadkoch slotov „Znovu načítať sloty assetu".

**Medze.** S napísanými metadátami sa „Uložiť" v tom detaile neuvoľní vôbec (zámer OP5-D2, zadanie: „as today").
Odhlásenie funkcie stránky nemá vlastný prípad (funkcie stránok sa po odchode strážia samy: `pageLeft`, `onPage()`).
Zlyhané celé čítanie po takejto správe zavrie detail zoznamu s chybou, ako po každej zmene súboru; na stránkach
detailu pozri FE-94.

**Testy** (nový `src/test/list/detailFileProcessed.test.ts`, 13 prípadov; skutočný poslucháč notifikácií nad falošným
spojením, skutočné stránky): bez napísaného sa po notifikácii číta celý asset a „Uložiť" sa uvoľní, v detaile a v
paneli (2) a na oboch stránkach detailu (2); s napísaným ostáva to isté pole, „Uložiť" zadržané, menu karty ponúkne
„Make public" (2); detail riadka fronty po čítaní fronty (`refreshQueueItem`, bez notifikácie) (1); správa počas
čítania, ktoré prinesie starý stav: číta sa ešte raz (1); strážcovia: čítanie prinieslo `processed` (nič navyše), súbor
iného slotu a iného assetu, opustená stránka (3); „Make public" (2, nižšie). `appNotificationListeners.test.ts`:
nový prípad (poslucháč povie detailu id assetu a súboru). Na snímku 9 + 1 červených.

| Ohnutie | Červené |
|---|---|
| notifikácia sa do detailu nedostane | 8 (7 prípadov s notifikáciou, prípad poslucháča) |
| čítanie fronty sa do detailu nedostane | 1 |
| „Uložiť" sa pri napísanom uvoľní | 3 (2 nové, starší `detailMainFile` „keeps "Save" held back…") |
| z toho istého súboru sa berie len trasa | 4 (2 nové, 2 zmenené v `mainRouteChange`) |
| ten istý súbor prepíše prepínače | 1 (starší `detailMainFile` „leaves a switch as it was flipped…") |
| správa počas čítania sa stratí | 1 |
| číta sa, aj keď je súbor držaný ako spracovaný | 1 (strážca) |
| číta sa pre ktorýkoľvek súbor assetu | 1 (strážca) |

### „Make public" len pre spracovaný súbor

`R/AssetFileMainRoute.vue:42-46`: `canMakePublic` = právo a stav `processed`; menu sa kreslí pri `mainRoute ||
canMakePublic` (`:91`), položka pri `canMakePublic` (`:134`). Používateľ: pri súkromnom súbore, ktorý nie je
spracovaný, menu „⋮" v karte súboru ani v riadku slotu nie je; verejný súbor má menu ďalej (adresa, „Nastaviť ako
súkromné"). Stav karty Info sleduje spracovanie podľa FE-89 (pre toho, kto nahrával); zvyšné prípady sú vymenované
vyššie. Testy v `detailFileProcessed.test.ts`: karta Info pred správou bez menu a po nej s „Make public" (v štyroch
prípadoch FE-89), riadok slotu so `stored` bez menu a so spracovaným s „Make public" (1), strážca verejného súboru
(1). Ohnutia: „ponúka sa pri každom stave" 5 červených, „menu sa kreslí aj prázdne" 5 červených.

## Skupina C

### FE-84 (nálezy 180, 183): zlyhané čítanie v karte náhľadu

- `D/components/AssetDetailSidebarImagePreview.vue:53-68`, `readVideoFile`: `try / catch / finally`; po zlyhaní
  všeobecná hláška raz, koliesko zhasne a **karta neukáže žiadny súbor** (`videoFile = null`): súbor prečítaný
  predtým patrí inému slotu, než hovorí výber, a uloženie by išlo jemu. Ostáva výber slotu; ďalší výber číta znova.
  Tá istá funkcia číta aj pri otvorení karty (`initLoad`, `:75-83`), kde zlyhanie tiež nechávalo koliesko.
- `A/components/ImagePreview.vue:53-78`: stav `readFailed`; po zlyhanom čítaní obrázka hláška raz, koliesko zhasne,
  karta neukazuje text „spracováva sa" ani obrázok prečítaný predtým (`shownFile`, `:94`; `isProcessing`, `:117`),
  kreslí zástupný obrázok a tlačidlá. Nové čítanie stav zruší (`:60`).
- **Formuláre podcastu a epizódy** (ten istý komponent): po zlyhanom čítaní obrázka hláška „Systémová chyba…" raz,
  zástupný obrázok a tlačidlá „Zrušiť priradenie obrázka" a „Vybrať obrázok"; predtým text „Obrázok sa spracováva,
  skúste neskôr" bez tlačidiel (prvé čítanie) alebo koliesko (po výbere iného obrázka) a nezachytená chyba v konzole.
- Medza: zlyhané čítanie toho istého obrázka sa samo neopakuje (pomôže odobrať a vybrať znova, alebo otvoriť kartu
  nanovo). Hláška zlyhaného čítania príde, kde používateľ práve je (ako pri uložení v tej istej karte).

Testy (nový `src/test/list/videoPreviewRead.test.ts`, 9 prípadov, z toho 4 tu): zlyhané čítanie súboru po zmene slotu
(žiadna karta pod výberom „extra", ďalší výber číta), pri otvorení karty, zlyhané čítanie obrázka (tlačidlá sú,
odobratie sa uloží), zlyhané čítanie obrázka práve vybraného (žiadny obrázok predošlého, uloženie prešlo). Na snímku
4 červené. Ohnutia: „zlyhané čítanie súboru mlčí" 2, „nechá súbor spred zmeny" 1, „obrázok sa nepozná ako zlyhaný" 2,
„zlyhané čítanie obrázka mlčí" 2.

### FE-95 (nález 213): poradie čítaní po zmene slotu

`AssetDetailSidebarImagePreview.vue:48-51,55-68`: čítania súboru sú počítané (`latestFileRead`); ukáže sa len naposledy
vyžiadané, koliesko beží do jeho odpovede, zlyhanie staršieho sa nehlási. Uloženie berie súbor z karty (`onSave`,
bez zmeny), ktorá teraz ukazuje súbor slotu z výberu. Testy (3): staršie odpovedané posledné (karta ostáva, odobratie
sa uloží súboru slotu z výberu), staršie odpovedané prvé (koliesko do neskoršieho), strážca: zlyhané staršie mlčí. Na
snímku 2 červené. Ohnutia: „ukáže sa každé čítanie" 1, „koliesko zhasne s každou odpoveďou" 2, „zlyhanie staršieho sa
hlási" 1.

### FE-93 (nález 212): po výbere z distribúcie karta číta súbor, ktorý dialóg upravil

Dialóg posiela s udalosťou id súboru (`AssetDetailSidebarImagePreviewFromDistributionDialog.vue:33,75,80`), karta
číta ten súbor, keď je to ten, ktorý ukazuje (`AssetDetailSidebarImagePreview.vue:85-89`). **Navyše (moje rozhodnutie,
pravidlo 5):** druhé „Potvrdiť" dialógu počas ukladania neurobí nič (`:73`); z klávesnice na točiacom sa tlačidle
odišla požiadavka dvakrát. Testy (2): pri vybranom slote „extra" sa číta a ďalej ukladá súbor toho slotu; dve
potvrdenia, jedna požiadavka. Na snímku 2 červené. Ohnutia: „karta číta hlavný súbor" 1, „druhé potvrdenie sa nedrží" 1.
Medza: odpoveď po zavretí dialógu („Zrušiť" počas ukladania) kartu neprečíta, udalosť odpojeného dialógu Vue zahodí
(ako pred krokom; nový nález 4).

### FE-91 (nález 202): odkaz dialógu „Stiahnuť"

`D/components/AssetDownloadButton.vue:44-64`: požiadavky o adresu sú počítané; odkaz nastaví len posledná, koliesko
beží do jej odpovede, zlyhanie staršej sa nehlási. Testy (nový `src/test/list/downloadLink.test.ts`, 4): adresa
hlavného súboru odpovedaná posledná, odpovedaná prvá, zlyhaná staršia mlčí, zlyhaná posledná sa povie raz. Na snímku 4
červené. Ohnutia: „odkaz nastaví každá odpoveď" 2, „koliesko zhasne s každou odpoveďou" 2, „zlyhanie staršej sa hlási" 1.

### FE-92 (nález 208, zvyšok): formulár dialógu „Make public"

`R/AssetFileRouteMakePublicDialog.vue:77-84`: pri otvorení `v$.$reset()`; sledovač je presunutý pod `useVuelidate`.
Používateľ: dialóg otvorený znova po potvrdení neukáže chybu slugu, kým ho nikto nepotvrdil (viditeľné len pri názve,
z ktorého vznikne neplatný slug). Test: `makePublicDialog.test.ts` 11 → 12 (názov „ab"); na snímku červený. Ohnutie
„bez resetu": 1 červený.

### FE-94 (nález 211): stránka detailu po zlyhanom opätovnom čítaní

`D/AssetDetailView.vue:108-115`, `D/AssetFileDetailView.vue:86-93`: po zlyhanom čítaní, ktoré je ešte aktuálne,
`assetDetailStore.reset()` (ako zoznam), potom hláška, ak je používateľ ešte na stránke. Prvé čítanie stránky asset
nemá, viditeľný výsledok je pri ňom rovnaký ako predtým. Používateľ: po zlyhanom čítaní, ktoré nasleduje po zmene
súboru bez napísaných metadát (aj po správe FE-89), stránka ukáže chybu a žiadny asset; treba ju načítať znova. S
napísaným sa nemení nič (tiché čítanie, formulár ostáva). Testy (nový `src/test/list/detailPageReadFails.test.ts`,
6; obe stránky): po „Make private" a zlyhanom čítaní žiadny asset, žiadne „Uložiť", jedna hláška (2; na snímku
červené); strážcovia: s napísaným formulár ostáva (2), zlyhané prvé čítanie (2). Ohnutia: „stránka assetu asset nechá"
2 (aj zmenený prípad `detailMainFile`), „stránka súboru asset nechá" 1.

## Testy spolu

| Súbor | Prípady | Červené na snímku |
|---|---|---|
| `src/test/list/slotsTab.test.ts` (nový) | 6 | 5 |
| `src/test/list/detailFileProcessed.test.ts` (nový) | 13 | 9 |
| `src/test/list/videoPreviewRead.test.ts` (nový) | 9 | 8 |
| `src/test/list/downloadLink.test.ts` (nový) | 4 | 4 |
| `src/test/list/detailPageReadFails.test.ts` (nový) | 6 | 2 |
| `src/test/list/makePublicDialog.test.ts` | 11 → 12 | 1 |
| `src/test/appInitialize/appNotificationListeners.test.ts` | 6 → 7 | 1 |
| `src/test/list/detailMainFile.test.ts` | 32 | 1 |
| `src/test/list/mainRouteChange.test.ts` | 44 | 0 |
| spolu | 133 | 31 |

Nových prípadov je 40, na snímku červených 30; desať zelených sú strážcovia (zmena po návrate na kartu, štyria v
`detailFileProcessed`, zlyhané staršie čítanie súboru videa, štyria v `detailPageReadFails`). Traja z nich sú
červení pri aspoň jednom ohnutí (dvaja „nečíta sa znova" v `detailFileProcessed`, zlyhané staršie čítanie). **Bez
ohnutia, ktoré ich otočí, je sedem: „zmena po návrate na kartu" (FE-88), „opustená stránka" (FE-89), „verejný súbor má
menu", a štyria v `detailPageReadFails` (s napísaným formulár ostáva, zlyhané prvé čítanie): držia cesty, ktoré krok
nemá meniť.** Ohnutí je 30, všetky červené (`bends/vysledok.txt`). Zadanie chce jedno až dve na opravu; FE-89 a FE-84
majú po viac nezávislých častí, preto 8 a 4. Ohnutia skupín A a B bežali pred kódom skupiny C (ich súbory sa potom
nemenili).

**Existujúce prípady, ktoré som zmenil** (držali stav, ktorý krok mení):
1. `detailMainFile.test.ts`, „are read once, and as they are by then, when the whole read fails on the page of an
   asset" → „are not read when the whole read fails on the page of an asset, which draws the asset no more" (FE-94:
   stránka asset nekreslí, sloty sa nečítajú).
2. `mainRouteChange.test.ts`, „gives %s the route alone: a file not yet processed as the form was read stays so, and
   "Save" held back" (dve miesta) → „gives %s its file as it is by now, processed since the form was read, and keeps
   "Save" held back", s tvrdením navyše, že karta má menu (FE-89: berie sa celý súbor; „Uložiť" ostáva zadržané).
3. `appNotificationListeners.test.ts`: náhrada skladu detailu (poslucháč ho odteraz používa); dva prípady
   (`failed`, `duplicate`) tvrdia navyše, že detailu sa nepovie nič.
4. `makePublicDialog.test.ts`: pomocník `pressMakePublic` vyňatý z `openDialog`, premenná `titled`.

## Zmenené súbory (15 produkčných, 9 testov, z toho 5 nových; 1 mimo)

- `A/store/assetSlotsStore.ts`, `D/composables/assetDetailSidebarSlotsActions.ts` (FE-88)
- `D/components/slots/AssetSlotListItem.vue` (FE-90)
- `A/store/assetDetailStore.ts`, `D/composables/assetDetailFileChange.ts`, `A/store/uploadQueuesStore.ts`,
  `domains/system/composables/appNotificationListeners.ts` (FE-89)
- `R/AssetFileMainRoute.vue` („Make public")
- `A/components/ImagePreview.vue` (FE-84), `D/components/AssetDetailSidebarImagePreview.vue` (FE-84, FE-95, FE-93),
  `D/components/AssetDetailSidebarImagePreviewFromDistributionDialog.vue` (FE-93)
- `D/components/AssetDownloadButton.vue` (FE-91), `R/AssetFileRouteMakePublicDialog.vue` (FE-92)
- `D/AssetDetailView.vue`, `D/AssetFileDetailView.vue` (FE-94)
- testy: tabuľka vyššie
- `doc/changelog/3.0.0.md` („Fixed": deväť nových položiek pred položkou „The slot remove dialog…"; v troch starších
  položkách o zmene trasy a o karte Info je namiesto „len trasa" „hlavný súbor, ako ho má server")

Žiadny súbor `src/test/support` sa nemenil. E2E špecifikácie (`e2e/`) som nespúšťal.

## Nové nálezy (neopravené, čítaním kódu, neoverené druhým čítaním ani behom)

1. **Zlyhané čítanie slotov nechá v karte riadky predošlého assetu.** Sklad slotov sa medzi assetmi nečistí
   (`A/store/assetSlotsStore.ts`, `reset` nikto nevolá) a `getList` po zlyhaní zoznam nemení: karta „Sloty" ďalšieho
   assetu, ktorej vlastné čítanie zlyhá, ukáže pod chybou riadky predošlého assetu s funkčnými menu. Tá istá trieda
   ako FE-88, iná príčina (zlyhanie, nie poradie).
2. **Karta „Sloty" pri pripojení na jeden prechod nakreslí riadky zo skladu** (predošlý asset), kým jej `onMounted`
   zdvihne loader (`D/components/slots/AssetDetailSidebarSlots.vue:43-46,63-94`): riadky obrázka pri tom môžu
   vyžiadať súbory predošlého assetu. Nevidno to, sú to požiadavky navyše.
3. **Otvorený detail sa nedozvie o stave `failed` a `duplicate`** hlavného súboru: ostáva pri „Súbor sa ešte
   spracúva…" so zadržaným „Uložiť" do nového otvorenia (`appNotificationListeners.ts:37-47`; FE-89 rieši len
   `processed`). Pri duplikáte treba najprv overiť, čo backend robí s assetom duplikátu.
4. **Dialóg „Vybrať z distribúcie" zavretý počas ukladania kartu neprečíta** (udalosť odpojeného komponentu;
   `AssetDetailSidebarImagePreviewFromDistributionDialog.vue:71-87`): hláška „upravené" príde, karta ukazuje starý
   náhľad do novej zmeny slotu. Obdoba c1-4 (funkcia namiesto udalosti).
5. **Hromadná úprava a čítania zoznamu poznajú stav súboru a otvorenému detailu ho nepovedia**
   (`uploadQueuesStore.ts`, `fetchLazyAdditionalMetadata`; `assetListActions.ts`, `fetchAssetList`): jedna z ciest, kde
   stav v detaile ostáva starý.

## Cyklus c1 (14. 10. ráno; kód a testy `impl-dam-op7c`, poznámku píše vedúci)

Posudky kroku: Codex (`impl/posudky/OP7-D2-codex.md`) a Opus: FE-88 nebolo zavreté pri zlyhanom čítaní slotov
a FE-89 bralo rozrobené; zvyšok kroku drží. Implementér kroku zanikol pri reštarte počítača pre Windows Update
(01:44); cyklus robil `impl-dam-op7c` podľa `krok5-praca/zadania/zadanie-OP7-D2-c1.md` a zanikol o 09:38 na chybe
spojenia s API (ECONNREFUSED) po zelenej časti testov celej CK, pred lintami, záplatou a poznámkou; tie dokončil
vedúci. Snímok cyklu `OP7-D2-c1` (pred akoukoľvek zmenou), záplata `zaplaty/OP7-D2-c1.diff`.

| Bod | Čo robí kód teraz | Čo vidí používateľ |
|---|---|---|
| c1-1 (FE-88) | Sklad slotov vie, čí je zoznam (`listOf`, `A/store/assetSlotsStore.ts`). Každá časť detailu, ktorá zoznam číta (karta Sloty aj výbery slotu v kartách a dialógoch, cez `useAssetDetailSidebarSlotsActions`), pri vzniku zavolá `holdListOf(assetId)`: riadky iného assetu sa zahodia hneď, pred prvým kreslením. `setList(items, assetId)` zapíše aj vlastníka. | Karta Sloty ani žiadny výber slotu neukáže riadky iného assetu, ani na okamih, ani po zlyhanom čítaní: po chybe sú sloty bez súborov (ako pri zlyhanom prvom čítaní) a hláška. Menu riadka tak nemôže zmazať ani presunúť súbor iného assetu; náhľad, distribúcia a stiahnutie nedostanú súbor iného assetu. |
| c1-2 (FE-89) | Oznámenie zo servera (`byServer`, z `tellPageBy`) ide vždy cez `readQuietly(true)` (`D/composables/assetDetailFileChange.ts`): čítanie bez loadera, podľa id drženého assetu, v poradí s ostatnými tichými čítaniami. Keď pri odoslaní aj pri odpovedi nie je nič napísané a nebežalo ani neprebehlo uloženie formulára (`saveSent` / `savesOf` v `A/store/assetDetailStore.ts`, volané z „Uložiť" detailu aj panela), formulár prevezme celú odpoveď na mieste (`setAsset`); inak len hlavný súbor so zadržaným „Uložiť". Zmeny, ktoré spustí používateľ (hlavný súbor, zmazanie, trasa bez napísaného), ostávajú pri celom čítaní pod loaderom. | Keď sa súbor dospracuje, detail ani panel neprejde pod loader a nič sa nezatvorí: otvorený dialóg (nová epizóda podcastu, nová distribúcia, relácia, potvrdenia slotov) aj s napísaným ostáva, rozpísaná hodnota v poli tiež; formulár za ním sa obnoví a „Uložiť" sa uvoľní. Počas bežiaceho uloženia sa formulár neprepíše. |
| c1-3 (FE-84) | Bez zmeny kódu. | Pri videu s jediným obsadeným slotom po zlyhanom čítaní súboru videa karta zmizne a výber je vypnutý; používateľ dostane chybu a skúsi znova novým otvorením karty „Miniatúra". Changelog a poznámka to hovoria takto. |
| c1-4 | Zmena slotu na ceste sa pamätá podľa assetu (`changesOnTheirWay`), nie len loaderom slotov. | Druhé stlačenie zmeny slotu počas bežiacej požiadavky nič nespraví ani po prepnutí na inú kartu a späť. |

**Testy.** Nové `src/test/list/slotsOfItsAsset.test.ts` a `detailFileProcessedInPlace.test.ts`; zmenený jeden riadok
v `detailFileProcessed.test.ts`. Nad zdrojmi snímku červené. Ohybov 6, všetky červené (`pracovne/impl-dam-op7c/bends/
vysledok.txt`). **CK-DAM `OP7-D2-c1`:** testy 108 súborov / 1 794 prípadov zelené (implementér), linty zelené (vedúci).
**Ostáva:** potvrdzovacie čítanie cyklu; staršie nálezy 225 až 228 v registri.
