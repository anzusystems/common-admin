# Plán implementácie kroku 5 (2026-10-09, 14:00) — verzia 9.3

Ako sa vykoná to, čo opisujú dva návrhy: `navrh-jadro.md` (verzia 11; kroky K0 až K7 a po K6 M, F2, F4, F5, PV10,
PV14a, PV16) a `navrh-komponenty.md` (verzia 5.1; kroky U0 až U9, PV14b a opravy po krokoch, 4.5), a dve opravy pred
krokom 5 podľa analýz v `analyzy/`. Návrhy a analýzy hovoria **čo**; tento plán hovorí **v akom poradí, kto, v ktorom
strome, s ktorými kontrolami, čo pri neúspechu a koľko to potrvá**. Nič z neho sa ešte nevykonalo. Kódovanie sa
začne, keď to povie vlastník (denník, „V0, rozhodnutia vlastníka (9. 10.)", dávka 2).

Vstupy: oba návrhy, analýzy v `analyzy/` (meranie rýchlosti, nálezy 32, 36, 39 a 29, 49 z oboch strán, ostatné otvorené
nálezy, PV9, PV10, PV14), `overenia.md`, `lib-vlna4.md`, `dam-vlna4.md`, denník `upload-postup.md` (s časťami „V0,
rozhodnutia vlastníka (9. 10.)", „Súhrn zjednotení odsúhlasený vlastníkom", „Otvorené témy, rozhodnutia vlastníka",
„Rozhodnutia vlastníka k analýzam", „Nález 49 overený (9. 10.)", „Texty a posledné nálezy, rozhodnutia vlastníka
(9. 10.)", „Kópia do licencie (9. 10.)" a „Rozhodnutia vlastníka (9. 10., neskôr)"), plán `upload-plan.md`, prehľad
`prehlad-zjednotenia.md`, posudky plánu verzií 1 až 7 (`posudok-planu-v1-*.md` až `posudok-planu-v6-*.md`,
`posudok-planu-v7-codex.md`), posudok prehľadu `posudok-prehladu-v3-codex.md` a rozhodnutia vedúceho k nim.
Overené 9. 10. o 03:30 nečinnými príkazmi (`git status`, `find -newermt`, `df`, `/proc/meminfo`): `src` LIB sa
nezmenil od 18:46, `src` DAM od 18:36.
Kroky 0 až 3 sú od 9. 10. commitnuté bez pushu: LIB `03c3a108` (`src` a `doc/changelog/2.0.0.md`), DAM `9818e6b5`
(pracovný strom čistý, stash nedotknutý); kód sa tým nezmenil, ranné behy platia ďalej.

Skratky: **LIB** = `/home/volar/projects/anzusystems/common-admin` (hlavný strom LIB), **DAM** =
`/home/volar/projects/anzusystems/admin-dam` (hlavný strom DAM), **lib-u** =
`/home/volar/projects/anzusystems/krok5-praca/wt/lib-u` (worktree LIB pre komponenty), **PRACA** =
`/home/volar/projects/anzusystems/krok5-praca` (pracovný priečinok mimo repozitárov), **NASTROJE** =
`/home/volar/projects/anzusystems/krok5-praca/nastroje` (skripty z prílohy A), **ZAMOK** =
`/home/volar/projects/anzusystems/krok5-praca/zamok.lock`. **CK-LIB**, **CK-DAM** = celé kontroly, **CK-LIB-T**,
**CK-DAM-T** = celé kontroly kroku len s testami (5.1). **C1 až C3** (prípadne **C4**) = build a kópia knižnice do DAM,
**P0**, **I1** = prenos z `lib-u` do LIB, **V0** = rozhodnutia vlastníka pred začatím (hotové 9. 10.), **S0-A**,
**S0-B** = príprava pred opravami a východisko po nich, **N32**, **N39-L**, **N39-D** = opravy pred krokom 5 (2.1),
**N9** a čísla 17 až 44 = drobné opravy nálezov denníka (2.9). Skratky v cestách (`L/`, `D/`, `LT/`, `LT0/`, `LW/`,
`LS/`, `DT/`) ako v návrhoch; v príkazoch sú vždy celé cesty.

## Verzia 9.3 oproti verzii 9.2

Vlastník povolil commit krokov 0 až 3 a ďalšie veci (denník, „Rozhodnutia vlastníka (9. 10., neskôr)"). Nástroje
sa nemenia: žiadny skript nepozná pevný `HEAD` ani záplatu založenia (`snimok.sh` a `navrat.sh` berú vždy aktuálny
`HEAD`).

| Vec | Verzia 9.2 | Verzia 9.3 |
|---|---|---|
| HEAD | LIB `49bd815b`, DAM `ba8a66ec`, kroky 0 až 3 necommitnuté | LIB **`03c3a108`**, DAM **`9818e6b5`** (bez pushu); snímky porovnávajú s týmto `HEAD` (2.0, 5.2, 5.3) |
| `git status` v S0-A | LIB 100 riadkov, DAM 66 | LIB len šesť starších nesledovaných položiek `doc/` (`doc/2.0.0-IMPORTY-A-BUNDLE.md`, `doc/2.0.0-NAVRHY.md`, `doc/2.0.0-RELEASE-FLOW.md`, `doc/2.0.0-RELEASE-TOOLS-DOCS.md`, `doc/2.0.0-analyza/`, `doc/RELEASING.md`), v `src` nič; DAM čistý, stash jeden záznam (5.3, A2) |
| Založenie `lib-u` | záplata všetkých sledovaných zmien a tar všetkých nesledovaných súborov | `worktree add` z `HEAD` stačí; záplata a tar ostávajú **len pre `src`** a len vtedy, keď opravy N32 a N39 nie sú pred S0-B commitnuté (`git status --short -- src` nie je prázdny; prázdnu záplatu `git apply` odmietne). Kontroly ostávajú: `diff -rq` `src`, prázdny `src/test/scratch`, `.yarn/install-state.gz`, `cmp` koreňových súborov. `lib-u` je mimo `src` čistý, zápis pri založení býva prázdny (3.2; vyskúšané na pokusnom repozitári) |
| Commit (7) | signál na commit krokov 0 až 3, opráv a kroku 5 | kroky 0 až 3 **hotové**; ďalší commit (opravy N32, N39, krok 5) na signál vlastníka pred S0-B alebo v Z (0, 2.0, 7) |
| Ostatné rozhodnutia | — | nález 32 len v 2.0 (bez opravného vydania 1.49.x), audit log DAM sa nerieši, kontroly v Azure teraz nie, úlohy k notification-serveru teraz netreba (7) |
| Kritická cesta | asi 82,25 h | bez zmeny |

## Verzia 9.2 oproti verzii 9.1

Vlastník 9. 10. schválil texty a rozhodol posledné nálezy (denník, „Texty a posledné nálezy, rozhodnutia vlastníka
(9. 10.)" a „Kópia do licencie (9. 10.)"). Nástroje sa nemenia.

| Vec | Verzia 9.1 | Verzia 9.2 |
|---|---|---|
| Texty | štyri znenia čakajú na vlastníka | **všetky schválené**: F-A SK aj EN; F-B v **novom** znení SK „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova.", EN „The file is still being processed. You can save once it is processed; then open the asset again."; nález 47 SK, EN, CS; CS „Zastavit" pri 43 (2.8, 2.9) |
| Nález 48 | čaká na vlastníka | opraví sa s 39 a 29 pred krokom 5: `updateAssetMetadata` cez `useApiRequest`, hlášku pri 422 ukáže jedno miesto, záchrana `showUnknownError`; N39-L 4,25 h, N39-D 3 h (spolu +1 h) (2.1) |
| Nález 52 | čaká na vlastníka | zapísaný, mimo kroku 5 (2.9) |
| Kópia do licencie | — | voľba konfigurácie DAM `copyToLicenceEnabled` (predvolene zapnutá; vypnutá: výber assetu prepínač kópie neukáže a widget kópiu nepošle), LIB, asi 1,25 h, s nálezom 20. **Rozhodnutie plánu:** nález 20 so 17 ostáva v `lib-u` (zmestí sa presne do K5); voľba je samostatný krok **N20V** hneď na začiatku LIB po C2, pred 33 (tie isté súbory výberu assetu). V `lib-u` by I1 čakal 1,25 h a krok nálezu 20 celý v LIB by stál o 2 h viac. Admin-ugc ju vypne jedným riadkom konfigurácie; to sa **odovzdá tímu admin-ugc** (do admin-ugc nepíšeme; 7, Z) |
| Vlastník | otvorené: štyri texty, nálezy 48 a 52 | na nič sa nečaká; ostáva len jeho „kódime" a signál na commit (0, 7) |
| Kritická cesta | asi 80,5 h | **asi 82,25 h** (N39-L +0,5 h, N20V +1,25 h); LIB po C2 46 h (19 krokov), DAM po C2 39 h, rezerva asi 7 h; súčet asi 155 h |

## Verzia 9.1 oproti verzii 9

Opravy súladu podľa dvoch posudkov (Codex: `review-krok5-konzistencia-codex.txt` v pracovnom priečinku relácie; Opus
cez vedúceho). Kroky ani nástroje sa nemenia, okrem poradia nálezov 33 a 47.

| Vec | Verzia 9 | Verzia 9.1 |
|---|---|---|
| Nález 47 | po 25, pred U7; widget médií „overí krok" | po U6, 25 **a U7** (tie isté súbory widgetov; komponenty 5.1, 4.5), za 30, 31, 36, 45 a F-C s F-D; oba widgety (obrázka aj s médiom) určite (1.1, 2.9) |
| Nález 33 | v LIB po F-C | hneď po náleze 20, ako chcú návrh a analýza: v `lib-u`, ak sa zmestí pred K5; podľa odhadu nie (I1 by čakal asi 1 h), preto **prvý krok LIB po C2**, keď nález 20 prinesie I1 (2.5, 2.9) |
| Viditeľné texty | len v krokoch, bez stavu | zoznam všetkých zmien textov v 2.8 („Zmeny viditeľných textov") a v krokoch; **čakajú na vlastníka**: celá veta F-A „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný." (sk, en), F-B „Súbor sa ešte spracúva; po spracovaní detail obnovte." (sk, en), nález 47 „Sem sa dá nahrať len jeden súbor; použije sa prvý." (sk, en, cs) a CS „Zastavit" pri 43; SK „Zastaviť" a EN „Stop" sú schválené. Do changelogu ide len schválené znenie |
| Otvorené pre vlastníka | „otvorené rozhodnutie nie je" | znenie štyroch textov, nález 48 (nerozhodnutý, nie „zapísaný") a nový nález 52 (nezaradené); nález 51 je úloha core-dam mimo projektu; ďalšie voľné číslo 53 (0, 2.9, 7) |
| K2 | nový prípad „sada admin-dam: meranie pri každom pokuse" | vypustený (jadro 11, 4.2: krok M ho zruší, do M drží základ `DT/upload/uploadStop.test.ts:118`); zoznam testov M bez zmeny |
| F-C | veta nešpecifikovaná, testy všeobecne | veta z **existujúceho** kľúča `common.damImage.queueItem.stillUploadingOrProcessing`; testy v teste detailu z U0 (komponenty 5.1) |
| K-04 | ZK11, ZK5, ZK23 | aj **ZK15** (prázdny chip „-") pri pohľade po U5c, keď ho admin-dam prvý raz ukáže z knižnice (2.7, 7) |
| Zastarané odkazy | komponenty 5, jadro 10.3 pri U4 a v 8, PV10 v 8 ako téma | komponenty 5.1; jadro 11 (3.1 mení PV14a až po U4); PV10 rozhodnuté; F-A, F-B a nález 50 stoja na analýze, nie na návrhu (8) |
| Kritická cesta | asi 80,5 h | bez zmeny: **asi 80,5 h** (poradie v LIB po C2: 33 na začiatok, 47 za F-C); súčet asi 153 h |

## Verzia 9 oproti verzii 8

Obsahová úprava: vlastník 9. 10. rozhodol posledné otvorené položky (denník, „Nález 49 overený (9. 10.)"; analýzy
`nalez49-frontend.md`, 7.2, a `nalez49-backend.md`; nálezy 45 a 47). Nástroje sa nemenia.

| Vec | Verzia 8 | Verzia 9 |
|---|---|---|
| Nález 49 | overuje sa, nezaradený | overený: možný len zámerným krokom (filter „Koncept", zrušený čip „Obsahuje súbor", hľadanie podľa ID) v okne sekúnd pred doplnením metadát. Opravy F-A až F-D stoja na jednom pravidle z čítania: asset nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored` (analýza 7.1; napísané zvlášť v DAM a v LIB) |
| DAM po K6 | F5 (2,5 h) | **dva kroky za sebou** (rozhodnutie plánu: jeden by mal asi 8,5 h a dve rôzne veci): **F5 s F-A** (4,5 h; ten istý hák a `metadataFailures` v sklade DAM: riadok hromadnej úpravy so spracúvaným súborom dostane namiesto formulára text „Súbor assetu sa ešte spracúva…") a hneď po ňom **F-B s nálezom 50** (4 h; „Uložiť" v detaile a pravom paneli admin-dam vypnuté počas spracovania; riadok hromadnej úpravy sa obnoví po uložení z panela alebo detailu a otvorený panel po hromadnom uložení). Spolu 8,5 h, kópia netreba (2.9) |
| LIB po C2 | — | **47** po 25 (1 h; widget s jedným obrázkom vezme z pustených súborov prvý a upozorní), **45** po 36 (1 h; widget médií použije vlastné mapovanie), **F-C s F-D** po 45, teda po U6 aj U7 (2,5 h; „Uložiť" v detaile knižnice vypnuté počas spracovania, widget neponúkne autorov DAM pre taký asset); všetko nesie C3 (1.3) |
| Nerozhodnuté | 45, 47; 49 sa overuje | žiadne; koreň nálezu 49 (posielať len zmenené polia) je otvorená téma po kroku 5; ďalší nález má číslo 51 |
| Kritická cesta | asi 76 h; LIB po C2 40,25 h, rezerva DAM asi 7 h; súčet asi 142 h | **asi 80,5 h**; LIB po C2 44,75 h (18 krokov), DAM po C2 39 h (rezerva asi 5,75 h); súčet asi 153 h (1.1) |

## Verzia 8 oproti verzii 7.1 (skrátene)

Rozhodnutia vlastníka z 9. 10., návrhy jadro 11 a komponenty 5, analýzy v `analyzy/`.

| Vec | Verzia 8 |
|---|---|
| Opravy pred krokom 5 | N32, N39-L a N39-D; ich LIB časť nesie C1 (vlastná kópia nie je) |
| S0 | S0-A pred opravami, S0-B po nich (východisko z ich CK, `lib-u` zo stavu po opravách, prepočet citácií) |
| V0, vlastník, commit, `/tmp` | V0 hotové 9. 10.; pravidlo o krokoch v neprítomnosti vlastníka zrušené; commit na signál pred S0-B alebo v Z; `/tmp` upratané |
| Rozhodnuté kroky | M, F2, F4, F5, PV10, PV14a, PV14b, PV16 a drobné opravy zaradené (2.9); U7 do LIB po C2 |
| Kritická cesta | asi 76 h, od C2 kritická dráha LIB |

## Verzia 7.1 oproti verzii 7 (skrátene)

Podľa poslednej kontroly Codexu nad verziou 7 (2 BLOCKER, 1 WRONG; okrajové prípady pomocných skriptov), bez ďalšieho
kola posudkov.

| Vec | Verzia 7.1 |
|---|---|
| Kontrola `lib-u` pred odstránením | aj typ a práva (`stat -c '%F %a'` mimo `src`, `find -printf '%y %m'` v `src`) |
| `tezky.sh` | každý zápis značky overený, inak kód 79 bez spustenia; lehota sa overí aj po bráne |

## Verzia 7 oproti verzii 6 (skrátene)

Podľa úzkych posudkov verzie 6 (Codex: 1 BLOCKER, 2 WRONG, 1 GAP; Opus: 1 WRONG, 1 GAP, 2 MINOR).

| Vec | Verzia 7 |
|---|---|
| Kontrola `lib-u` pred odstránením | `kontrola-lib-u.sh`: `src` proti `I1-lib-u`, mimo `src` zoznam a obsah proti stavu pri založení (`zalozenie-lib-u.sh`) |
| Ručné zlúčenie pri I1 | záznam `rucne.sh` ku každej ceste RUCNE, posudok Codexu a Opusu nad ním |
| `tezky.sh` | `-ge`; značky `bezi`, `zamok`, `brana`, `cas`; volajúci sa rozhodujú podľa značky; 76 po neprejdenej bráne |
| `kopia.sh --stav` | len zo stavu `neoverene` alebo `obnovene` |

## Verzia 6 oproti verzii 5 (skrátene)

Podľa úzkych posudkov verzie 5 (Codex: 4 WRONG, 2 GAP, 2 MINOR; Opus: 1 WRONG, 5 MINOR) a rozhodnutí Z-1 až Z-7.

| Vec | Verzia 6 |
|---|---|
| `tezky.sh` (Z-1) | `-w` pred poistkou vnorenia; neúspech brány značkovým súborom namiesto kódu 199; zvyšný čas pred každým pokusom |
| `kopia.sh` (Z-2, Z-3) | stav `nejasne` pri nesediacom výstupe `copy.sh`; jedinečné cesty uložení (aj `-zahodene` v `navrat.sh`); `nainstalovane.txt` na oboch vetvách S0 |
| Koniec kroku 5 (Z-4 až Z-6) | prvá kontrola `lib-u` pred `git worktree remove --force`; po Z bod 4 DAM len dopredu; C4 po Z aj s e2e a commitom |
| Drobnosti (Z-7, pokusný beh) | príkaz na `/tmp` doslova z denníka; `copy.sh:103-105`; `rsync -a --checksum` v `navrat.sh` |

## Verzia 5 oproti verzii 4 (skrátene)

Podľa úzkych posudkov verzie 4 (Codex: 2 WRONG, 2 GAP; Opus: 1 WRONG, 1 GAP, 3 MINOR) a rozhodnutí Y-1 až Y-8.

| Vec | Verzia 5 |
|---|---|
| Vnorenie, brána pod zámkom (Y-1, Y-2) | poistka `KROK5_TEZKY`; `kopia.sh` a skripty CK sa neobaľujú; najprv zámok, potom brána |
| PRACA a N-K (Y-3 až Y-5) | PRACA sa maže posledná; obnova z najnovšieho uloženia so zeleným CK-DAM; súbor s viac odkazmi sa neprepíše |
| P0, K2-D4, `/tmp` (Y-6 až Y-8) | očakávaný zoznam P0 suchým behom `prenos.sh` nad zmrazenými snímkami; K2-D4 s kópiou; kritérium `/tmp` z denníka |

## Verzia 4 oproti verzii 3 (skrátene)

Podľa posudkov verzie 3 (Codex: 1 BLOCKER, 4 GAP, 1 MINOR; Opus: 1 WRONG, 1 GAP, 6 MINOR) a rozhodnutí X-1 až X-9.

| Vec | Verzia 4 |
|---|---|
| Commit, `/tmp` (X-1, X-2) | commit krokov 0 až 3 len pred S0 alebo v Z; upratanie `/tmp` je podmienka S0, prahy brány nikdy nad nečinné čítanie |
| `navrat.sh`, N-K (X-3, X-4) | zoznamy do súborov s kontrolou `find` pred akýmkoľvek `mv`; uloženie balíka a `obnova-balika.sh` |
| Vlastník, brána, C4, P0 (X-5 až X-8) | bez vlastníka predvolene žiadny nový krok; `tezky.sh` pre každý ťažký príkaz; C4 pre neskoré rozhodnutia; P0 potrebuje len otvárací snímok U1 |
| Drobnosti (X-9) | zmrazené body porovnania P0 a I1 a pravidlo `snap/U1`; `[ -e ]` v `zaplata.sh`; `lslocks` a `pstree`; poradie S0; build bez `COMMON_ADMIN_*` |

## Verzia 3 oproti verzii 2 (skrátene)

Podľa posudkov verzie 2 (Codex: 3 BLOCKER, 1 WRONG, 3 GAP, 1 MINOR; Opus: 1 BLOCKER, 1 WRONG, 5 GAP, 5 MINOR) a
rozhodnutí W-1 až W-12.

| Vec | Verzia 3 |
|---|---|
| P0 (W-1) | prenos zo `snap/U1/src`, po C1, pred K4 |
| C0 (W-2) | zrušená: nainštalovaná knižnica v DAM je bajt po bajte zhodná s `dist` LIB |
| Návrat (W-3) | N-H len pre otvorený alebo posledný uzavretý krok stromu; inak krok opravy dopredu; `snap/<meno>-zahodene` |
| Kópie (W-4) | kópia sa uzavrie celá skôr, než sa v LIB otvorí ďalší krok; N-C = N-H posledného kroku LIB |
| Skripty (W-5) | `prenos.sh` s `set -euo pipefail` a overením; kódy `git diff --no-index`; `HOTOVO` a pravidlo mien snímkov; `printf %q`; `kopia.sh` pripína zdroj; zoznam mazania nástrojov projektu pre V0 |
| Zámok, brána (W-6, W-7) | `flock -o -E 75`; brána pred každým príkazom CK; vzorky pamäte v S0 |
| Súbežnosť B, návrhy, K-04, S0, nález 20 (W-8 až W-12) | B zrušená; odkazy 10.3 a 4.3, ZK26 vypustené, PV16; odložený K-04 len na hranici stromu; `src/test/scratch` a `install-state.gz` v `lib-u`; UGC pri náleze 20 |

## Verzia 2 oproti verzii 1

Podľa posudkov verzie 1 (Codex: 5 BLOCKER, 1 WRONG, 3 GAP; Opus: 2 BLOCKER, 4 WRONG, 2 GAP, 3 MINOR) a rozhodnutí
vedúceho V-1 až V-14.

| Vec | Verzia 1 | Verzia 2 |
|---|---|---|
| Kroky v jednom strome (V-1) | súbežné kroky v jednom strome | jeden otvorený krok v strome; dvaja agenti v kroku len s disjunktnými súbormi (K2, K4) |
| U0-L (V-1) | v LIB | prvý krok v `lib-u`; do LIB ho prenesie P0 |
| K0, U0-D (V-1) | popri iných krokoch | za sebou v DAM, oba uzavreté pred C1 |
| Agenti testov (V-2) | jeden `testy` | `testy-lib`, `testy-dam`; riziko „vedúci ako jediný bod zlyhania" |
| I1, I2, C2b (V-3) | I1 aj pri otvorenom kroku; C2b | I1 len na hranici `lib-u` po K5 s uzavretými U1 a U4; C2b zrušená; `lib-u` sa pri I1 uzavrie, I2 netreba |
| Prenos (V-4) | `cmp` a `rsync` | trojcestne po cestách, `prenos.sh`; žiadny krok nemaže súbor |
| Snímok, záplata, návrat (V-5) | zástupné cesty, bez binárnych súborov | skripty s celými cestami, `git diff --no-index --binary`, súbory mimo `src` menované |
| C3 (V-6) | CK-DAM pred úpravou testov U8 | kópia → úpravy testov DAM → CK-DAM; U8-L a U8-D |
| CK-*-T (V-7) | bez `lint:tsc` | s `lint:tsc` |
| V0 (V-8) | PV po častiach | všetkých sedem PV pred K2; PK3, `mv`, `copy.sh`, nález 20 |
| Behy v prehliadači (V-9) | protirečivé | jeden beh LIB v prehliadači na stroji; zámok `flock`; pamäťová brána |
| `mv`, ohýbanie, K-04, Z, S0 (V-10 až V-14) | — | skúška `mv` v S0; ohýbanie v pamäti alebo na disku s `cmp`; ihrisko LIB pre K-04; bez `git worktree prune`; S0 bez opakovania ranných testov |

---

## 0. Zhrnutie

**Pred krokom 5** (keď vlastník povie, že sa kóduje): S0-A (nástroje), opravy **N32** a **N39-L** v LIB, súbežne
**N39-D** v DAM, potom S0-B (východisko po opravách a založenie `lib-u`).

**Tri stromy, v každom najviac jeden otvorený krok.**

- **LIB** (hlavný strom knižnice): N32 → N39-L → (S0-B) → K1 → K2 → C1 → P0 → K4 → K5 → I1 → C2 → [od 10. 10.: 28 → PK3 →
  PV16-L → nález 20 so 17 →] N20V → 33 → U6 → 25
  → M → F2 → F4 → PV10 → U7 → 30 → 31 → 36 → 45 → F-C (s F-D) → 47 → U8-L → PV14a → PV14b → 43 → C3.
- **`lib-u`** (worktree knižnice, súbežne s jadrom): U0-L → U1 (s 24) → 44 → U4 → 28 → PK3 → PV16-L → nález 20 so 17
  (→ 33, ak sa zmestí pred K5).
  Pri I1 sa jeho výsledok prenesie do LIB a `lib-u` sa zmrazí. **Skutočnosť (10. 10.):** K5 sa uzavrel (02:25) počas U4,
  takže podľa pravidla 2.5 `lib-u` po U4 ostal na hranici; I1 preniesol U0-L, U1 s 24, 44 a U4. 28, PK3, PV16-L a nález 20
  so 17 idú do LIB hneď po C2 (v tomto poradí, pred N20V) a do admin-dam ich prinesie C3; PV16-D preto ide v DAM po C3.
- **DAM**: N39-D → (S0-B) → K0 → U0-D → C1 → K3 → N9 → C2 → K6 → 40 → 19 → F5 (s F-A) → F-B (s 50) → U2 →
  U3 → U5a → U5b → U5c → 38 → C3 s U8-D → PV16-D (od 10. 10. po C3, PV16-L je v C3) → Z.
- Kópie knižnice: **C1** (N32, N39-L, K1, K2), **C2** (K4, K5 a všetko z `lib-u`), **C3** (všetko v LIB po C2). Každá
  sa uzavrie celá, kým sa v LIB alebo v DAM otvorí ďalší krok.

**Odhad** (tempo práce 7. a 8. 10.; rád, nie záväzok): súčet krokov asi **155 h**, kritická cesta asi **82,25 h**
(rozptyl asi 65 až 110 h). Od C2 je kritická dráha LIB (46 h krokov a opráv knižnice v jednom strome); DAM má
rezervu asi 7 h. Pri asi 10 h dozorovanej práce denne asi 8 až 9 pracovných dní.

**Vlastník** (časť 7): rozhodnutia V0 a všetkých tém urobil 9. 10.; kroky 0 až 3 sú commitnuté; povie, kedy sa začne
kódovať; dá signál na ďalší commit (pred S0-B alebo v Z); pohľady K-04 po U3, U5c a U6; odporúčaná ručná skúška merača
po C3; na konci príkaz na zmazanie a beh e2e. **Na vlastníka sa nečaká v žiadnom rozhodnutí okrem tých, ktoré vyšli pri
implementácii (časť 7, od 10. 10.: N-U1-2 pred I1, nálezy 65, 66, 9);** ostáva len jeho „kódime"
a signál na commit. Neskoré rozhodnutie, ktoré mení LIB a príde po C3, by dostalo kópiu C4. Zmenu konfigurácie admin-ugc
(vypnutá kópia do licencie) dostane tím admin-ugc (7).

---

## 1. Spojená postupnosť

### 1.1 Tabuľka

Odhad je čas od otvorenia po uzavretie kroku vrátane cielených testov, celých kontrol a posudkov. „Súbežne s" = krok
v inom strome, ktorý smie byť otvorený naraz (behy v prehliadači a ťažké príkazy sa aj tak striedajú cez zámok, 3.6).
Kópia C zaberá LIB (build) aj DAM (kópia, CK-DAM) a uzavrie sa celá, kým sa v ktoromkoľvek z nich otvorí ďalší krok.
Opravy nálezov sú označené číslom nálezu (2.9).

| # | Krok | Strom | Agent | Závisí od | Súbežne s | Odhad |
|---|---|---|---|---|---|---|
| 1 | S0-A nástroje, zámok, skúšky | PRACA | vedúci | slovo vlastníka | — | 0,5 h |
| 2 | N32 nálezy 32 a 32b | LIB | impl-komp-lib | S0-A | N39-D | 2,5 h |
| 3 | N39-L nálezy 39, 29 a 48, knižnica | LIB | impl-komp-lib | N32 | N39-D | 4,25 h |
| 4 | N39-D nálezy 39, 29 a 48, admin-dam | DAM | impl-dam | S0-A | N32, N39-L | 3 h |
| 5 | S0-B východisko, založenie `lib-u` | LIB, DAM, `lib-u` | vedúci | N32, N39-L, N39-D | — | 1 h |
| 6 | K0 test produktového rozdielu | DAM | testy-dam | S0-B | K1, U0-L | 0,75 h |
| 7 | U0-D testy dnešného správania | DAM | testy-dam | K0 | K1, K2, U0-L, U1 | 3,25 h |
| 8 | K1 (K1a exporty, K1b O15) | LIB | impl-jadro-lib | S0-B | K0, U0-D, U0-L | 1,75 h |
| 9 | U0-L testy dnešného správania | `lib-u` | testy-lib | S0-B (`lib-u` založený) | K0, U0-D, K1, K2 | 3,25 h |
| 10 | K2 služba a dve sady | LIB | impl-jadro-lib; testy-lib od uzavretia U0-L | K1 | U0-D, U1 | 5,75 h |
| 11 | U1 listové bloky (s nálezom 24) | `lib-u` | impl-komp-lib | U0-L | K2, C1, P0, K3 | 4,75 h |
| 12 | C1 kópia (N32, N39-L, K1, K2) | LIB, DAM | vedúci | K2; U0-D uzavretý | U1 | 0,5 h |
| 13 | P0 prenos U0-L do LIB | LIB | vedúci | C1 uzavretý; hotový otvárací snímok U1 (`snap/U1`) | U1, 44, K3 | 0,5 h |
| 14 | 44 konflikty autorov | `lib-u` | impl-komp-lib | U1 | P0, K3, K4 | 1 h |
| 15 | K3 požiadavky a služba v DAM | DAM | impl-dam | C1 | P0, K4, 44, U4 | 4,75 h |
| 16 | K4 jadro, sady jadra, hromadné operácie | LIB | impl-jadro-lib, testy-lib | P0 | K3, 44, U4, N9 | 6,75 h |
| 17 | U4 riadok, zoznam, sidebar | `lib-u` | impl-komp-lib | 44 | K3, K4, K5, N9 | 6,75 h |
| 18 | N9 údaje poskytovateľa (a „todo" z 8) | DAM | impl-dam | K3 | K4, U4 | 1 h |
| 19 | K5 sklad LIB na jadre | LIB | impl-jadro-lib | K4 | U4, 28, PK3, PV16-L, nález 20 | 5,75 h |
| 20 | 28 hláška „stále sa spracúva" | `lib-u` | impl-komp-lib | U4 | K5 | 0,5 h |
| 21 | PK3 posun klávesmi (nález 46) | `lib-u` | impl-komp-lib | 28 (ten istý strom, U4) | K5 | 1,75 h |
| 22 | PV16-L voľba `report` v `useApiFetchList` | `lib-u` | impl-komp-lib | PK3 | K5 | 1 h |
| 23 | nález 20 so 17 (kópia do licencie) | `lib-u`, ak sa zmestí pred K5; inak LIB po C2 pred U7 | impl-komp-lib | PV16-L | K5 | 2 h |
| 24 | I1 prenos `lib-u` do LIB, koniec `lib-u` | LIB | vedúci | K5; `lib-u` na hranici; U1, U4 uzavreté | — | 0,75 h |
| 25 | C2 kópia, odstránenie `ttsAudio` v DAM | LIB, DAM | vedúci, impl-dam | I1; K3 a N9 uzavreté | — | 0,75 h |
| 26 | K6 sklad DAM na jadre | DAM | impl-dam | C2 | N20V, 33, U6 | 7,75 h |
| 27 | N20V voľba kópie do licencie (`copyToLicenceEnabled`) | LIB | impl-komp-lib | C2 (nález 20 z `lib-u`) | K6 | 1,25 h |
| 28 | 33 výber po hláške o licencii | LIB | impl-komp-lib | N20V | K6 | 1 h |
| 29 | U6 rámec a adaptéry | LIB | impl-komp-lib | 33 | K6 | 6,25 h |
| 30 | 25 „Obnoviť" v dialógu jedného súboru | LIB | impl-komp-lib | U6 | 40, 19 | 1,5 h |
| 31 | 40 mená konfliktov pri hromadnej úprave | DAM | impl-dam | K6 | U6, 25 | 1 h |
| 32 | 19 zastavený import | DAM | impl-dam | 40 | 25 | 0,75 h |
| 33 | M jeden merač rýchlosti | LIB | impl-jadro-lib | K6 uzavretý; 25 | F5, F-B | 4,5 h |
| 34 | F5 s F-A (PV9; riadok so spracúvaným súborom) | DAM | impl-dam | 19 | 25, M | 4,5 h |
| 35 | F2 vlastné kópie zoznamu | LIB | impl-jadro-lib | M | F-B | 1,5 h |
| 36 | F-B s nálezom 50 (detail a panel admin-dam) | DAM | impl-dam | F5 | M, F2, F4 | 4 h |
| 37 | F4 zastavenie súboru zlyhaného serverom | LIB | impl-jadro-lib | F2 | F-B, PV16-D | 2,5 h |
| 38 | PV10 `uploadedAssetId` | LIB | impl-jadro-lib | F4 | PV16-D, U2 | 1,5 h |
| 39 | PV16-D dopytovanie distribúcií | DAM | impl-dam | C3 (od 10. 10.) | F4, PV10 | 1,25 h |
| 40 | U7 `createDamImage` | LIB | impl-komp-lib | PV10 | U2, U3 | 3,75 h |
| 41 | U2 cache v DAM | DAM | impl-dam | PV16-D | PV10, U7 | 2,25 h |
| 42 | U3 admin-dam mimo uploadu na bloky LIB | DAM | impl-dam | U2 | U7, 30, 31, 36 | 4,75 h |
| 43 | 30 prázdny zoznam vo widgete | LIB | impl-komp-lib | U7 | U3 | 1 h |
| 44 | 31 pozície galérie | LIB | impl-komp-lib | 30 | U3 | 1 h |
| 45 | 36 čo ide do API obrázkov | LIB | impl-komp-lib | 31 | U3, U5a, U5b | 3 h |
| 46 | U5a prekrytia na tlačidle zastavenia | DAM | impl-dam | U3 | 36 | 1,75 h |
| 47 | 45 vlastné mapovanie vo widgete médií | LIB | impl-komp-lib | 36 | U5b | 1 h |
| 48 | U5b obal sidebaru | DAM | impl-dam | U5a | 36, 45, F-C | 2,75 h |
| 49 | F-C s F-D (detail knižnice, autori vo widgete) | LIB | impl-komp-lib | 45 (po U6 aj U7) | U5b, U5c | 2,5 h |
| 50 | U5c obal riadku a zoznamu | DAM | impl-dam | U5b | F-C, 47, U8-L, PV14a | 7,75 h |
| 51 | 47 jeden súbor na widget s jedným obrázkom | LIB | impl-komp-lib | F-C (po U6, 25 a U7) | U5c | 1 h |
| 52 | U8-L prístupné mená s poľom (knižnica) | LIB | impl-komp-lib | 47 | U5c | 1,75 h |
| 53 | PV14a pomenovaná konfigurácia, jadro | LIB | impl-jadro-lib | U8-L (a U6, U7, 25, 30, 31, 36, 45, F-C, 47) | U5c, 38 | 4,5 h |
| 54 | 38 kôš na riadku admin-dam | DAM | impl-dam | U5c | PV14a | 0,5 h |
| 55 | PV14b pomenovaná konfigurácia, komponenty | LIB | impl-komp-lib | PV14a | — | 5,5 h |
| 56 | 43 „Zastaviť" v otázke pri zastavení | LIB | impl-komp-lib | PV14b; U5a uzavretý | — | 1 h |
| 57 | C3 kópia, U8-D a úpravy testov DAM | LIB, DAM | vedúci, impl-dam | 43; 38 (DAM na hranici) | — | 2,5 h |
| 58 | Z záver (K7d, U9) | obe | vedúci, vlastník | C3 | — | 3 h + vlastník |
| — | C4 kópia neskorého rozhodnutia (len ak treba) | LIB, DAM | vedúci, impl-dam | rozhodnutie po C3, ktoré mení LIB | — | 1 h |
| — | voliteľné K7a, K7b, K7c, K7e | 2.9 | impl-jadro-lib, impl-dam | rozhodnutie vedúceho | — | 0,5–2 h každý |

**Kritická cesta:** S0-A (0,5) → N32 (2,5) → N39-L (4,25) → S0-B (1) → K1 (1,75) → K2 (5,75) → C1 (0,5) → P0 (0,5) → K4
(6,75) → K5 (5,75) → I1 (0,75) → C2 (0,75) → N20V (1,25) → 33 (1) → U6 (6,25) → 25 (1,5) → M (4,5) → F2 (1,5) → F4 (2,5)
→ PV10 (1,5) → U7 (3,75) → 30 (1) → 31 (1) → 36 (3) → 45 (1) → F-C (2,5) → 47 (1) → U8-L (1,75) → PV14a (4,5) → PV14b
(5,5) → 43 (1) → C3 (2,5) → Z (3) = **asi 82,25 h**. Čakanie na zámok, na bránu a na posudky pridá podľa odhadu 0
až 7 h.

**Prečo je od C2 kritická LIB.** Po C2 má LIB 19 krokov a opráv (46 h), DAM 12 (39 h: K6 až 38). Väzby medzi nimi
čakanie nespôsobia: M potrebuje K6 (K6 skončí asi o 38,5 h, LIB príde k M asi o 40,75 h), 43 potrebuje U5a (U5a skončí
asi o 58,75 h, 43 sa otvorí asi o 75,75 h). DAM je na hranici po 38 asi o 69,75 h a čaká na C3 asi 7 h. Poradie v LIB po
C2 je voľné okrem väzieb v 1.2: ak K6 mešká, LIB vezme najprv U7 a jeho opravy a M až po K6.

**Prečo I1 nečaká:** `lib-u` uzavrie nález 20 asi o 29,25 h, presne keď sa podľa odhadu uzavrie K5; voľba kópie do
licencie (N20V) by sa tam už nezmestila, preto ide do LIB hneď po C2. Pravidlo (2.5)
zaručuje, že `lib-u` neotvorí krok, ktorý by skončil po K5: ak sa odhad mýli, nález 20 so 17 ide do LIB po C2 (pred U7)
a I1 nečaká.

**Možné skrátenie (plán ho nezavádza).** Druhý worktree knižnice po I1 pre blok widgetov (U7, 30, 31, 36, 45, F-C, 47)
by LIB po C2 skrátil asi o 13,25 h a kritickou by sa stala dráha DAM (asi o 6 h kratšia cesta), za cenu druhého
trojcestného prenosu pred C3 a ďalšieho stromu pod `kontrola-lib-u.sh`. Rozhoduje vedúci.

### 1.2 Dráhy a závislosti

```
PRED  : S0-A ─ N32 ─ N39-L ─ S0-B                 (DAM: S0-A ─ N39-D ─ čaká na S0-B)
LIB   : S0-B ─ K1 ─ K2 ─ C1 ─ P0 ─ K4 ─ K5 ─ I1 ─ C2 ─ N20V ─ 33 ─ U6 ─ 25 ─ M ─ F2 ─ F4 ─ PV10 ─ U7 ─ 30 ─ 31 ─
        ─ 36 ─ 45 ─ F-C ─ 47 ─ U8-L ─ PV14a ─ PV14b ─ 43 ─ C3
lib-u :   └ U0-L ─ U1 (24) ─ 44 ─ U4 ─ 28 ─ PK3 ─ PV16-L ─ [nález 20 + 17] ─ [33] ─ hranica ──┘ (koniec lib-u pri I1)
DAM   : S0-B ─ K0 ─ U0-D ── C1 ─ K3 ─ N9 ──────── C2 ─ K6 ─ 40 ─ 19 ─ F5 (F-A) ─ F-B (50) ─ PV16-D ─ U2 ─ U3 ─
        ─ U5a ─ U5b ─ U5c ─ 38 ─ C3+U8-D ─ Z
```

Väzby medzi dráhami:
- N32, N39-L a N39-D sa uzavrú pred S0-B; S0-B zakladá `lib-u` zo stavu LIB po opravách (inak by I1 videl súbory
  galérie a uloženia zmenené na oboch stranách).
- C1 potrebuje hranicu v LIB aj v DAM (kópia zapisuje do `node_modules` DAM) a uzavretý U0-D; LIB aj DAM otvoria ďalší
  krok (P0, K3) až po zelenom CK-DAM v C1.
- P0 potrebuje uzavretý U0-L a hotový otvárací snímok U1 (`snap/U1`; U1 sa otvorí hneď po U0-L a pri P0 môže byť
  otvorený aj uzavretý); K5 potrebuje P0 (stráže U0-L).
- I1 potrebuje uzavretý K5, uzavreté U1 a U4 a `lib-u` na hranici. C2 potrebuje I1 a uzavreté K3 a N9.
- K6 potrebuje C2 (jadro a sada jadra v kópii) a K3 (väzba služby admin-dam). U2, U3, U5a potrebujú U1 v kópii; U5b,
  U5c potrebujú U4 v kópii; obe prinesie C2. PV16-D potrebuje PV16-L v kópii (od 10. 10. C3, nie C2).
- M, F2 a F4 potrebujú uzavretý K6 (jadro 4.1); PV10 po K5, pred C3.
- PV14a ide po U6, U7 a ich opravách (25, 47, 30, 31, 36, 45, F-C), PV14b hneď po ňom, oba pred C3 (komponenty 2.13); 33
  a U8-L pred PV14b (súbory výberu assetu a sidebaru hromadných operácií, ktoré PV14b tiež mení).
- Opravy idú hneď po kroku, ktorý ten kód prepisuje, v tom istom strome: 44 po U1; 28 a PK3 po U4; 25 po U6; 30, 31,
  36, 45, F-C s F-D a 47 po U7 za sebou (tie isté súbory widgetov; 47 aj po 25, F-C aj po U6), nikdy súbežne s U7 ani
  s nálezom 20; N20V (voľba kópie do licencie) hneď po náleze 20, prvý krok LIB po C2; 33 hneď po náleze 20 (v
  `lib-u`, ak sa zmestí pred K5, inak hneď po N20V); 40, 19, F5 (s F-A)
  a F-B (s 50) po K6; 38 po U5c. 43 sa otvorí až po
  uzavretom U5a (od U5a používa admin-dam tlačidlo knižnice; testy DAM otočí C3). N9 kedykoľvek v DAM (súbor krok 5
  nemení); plán ho dáva do čakania DAM medzi K3 a C2.
- U6 potrebuje test detailu z U0-L, U7 test miest z U0-L. U5c potrebuje nový prípad U0-D „na duplikáte žiadne
  tlačidlo úpravy".
- C3 potrebuje DAM na hranici po 38 a uzavreté všetky kroky LIB po C2.

### 1.3 Kópie knižnice do admin-dam

Dnes je knižnica nainštalovaná v DAM bajt po bajte zhodná s `dist` LIB zo `src` 18:46 (posudok Opusu verzie 2:
`diff -rq` aj `sourcesContent` v mapách zdrojov). Opravy N32 a N39-L menia v knižnici len kód, ktorý admin-dam nepoužíva
(galéria, dialógy uploadu knižnice, nevyvážané hromadné uloženie `bulkUpdateAssetsMetadata`, `src/lib.ts:534-539`);
N39-D potrebuje z balíka len `useApiRequest`, `HTTP_STATUS_OK` a `useAlerts`, ktoré nainštalovaná knižnica má. **Vlastná
kópia po opravách preto nie je;** do DAM ich prinesie C1. Od S0-B teda nainštalovaná knižnica zodpovedá `src` LIB pred
opravami (stav „S0 zelene"). Keby CK-DAM v C1 očervenel pre opravu, je to oprava dopredu (N-C vracia len K2).

| Bod | Nesie | Používajú | Postup v DAM |
|---|---|---|---|
| C1 | N32, N39-L, K1a, K1b, K2 | K3 | CK-DAM s produkčným kódom DAM nezmeneným od S0-B |
| C2 | K4, K5, PV10, I1: U0-L (z P0), U1 s 24, 44, U4 (skutočnosť 10. 10.: 28, PK3, PV16-L, nález 20 so 17 a 33 sa do `lib-u` nezmestili, idú v C3) | K6, U2, U3, U5a, U5b, U5c | odstránenie augmentácie `ttsAudio`, CK-DAM |
| C3 | 28, PK3, PV16-L, nález 20 so 17, N20V, 33, U6, 25, M, F2, F4, U7, 30, 31, 36, 45, F-C s F-D, 47, U8-L, PV14a, PV14b, 43 (PV10 prišlo už s C2, 10. 10.) | U8-D, PV16-D, záver | úpravy testov DAM: U8-D (`DT/queue/massOperationsRows` na nové mená); M (`DT/upload/uploadSequence.test.ts:150-175` čísla, `:192-201` nový názov, `DT/upload/uploadStop.test.ts:117-151` číslo); F4 (`DT/queue/queueOperations.test.ts:231`); 43 (tlačidlo otázky `'Close'` → `'Stop'`; riadky po krokoch DAM z 11. 10. (posudok Opusa U8-L + 43): `DT/upload/uploadStopQuestion.test.ts:62,116`, `DT/queue/slotsOverlay.test.ts:131,147,178`, `DT/queue/overlaySave.test.ts:398,428`; tri z nich (`slotsOverlay:131,147`, `overlaySave:398`) sú `expect(dialogButton('Close')).toBeNull()` a po C3 by ostali zelené naprázdno — prepísať na nový text; konštanty `uploadStopQuestion:17` a `slotsOverlay:19` sú spoločné s otvárajúcim tlačidlom, treba ich rozdeliť; otvárajúce tlačidlo ostáva); PV10 nepovinne `DT/queue/queueRowActions.test.ts:271`; potom CK-DAM |
| C4 (len ak treba) | rozhodnutie, ktoré mení LIB a príde po C3 (napríklad PV14c) | časť DAM toho rozhodnutia, záver | ako C3: kópia, prípadné úpravy testov DAM, CK-DAM. Ak príde pred Z, Z sa robí po C4; ak po Z, po C4 sa zopakujú CK oboch stromov, register zo Z, beh e2e admin-dam a rozhodnutie o commite |

Kópia ide len cez `kopia.sh` (príloha A), len po zelených CK-LIB nad presne tým stavom LIB, len keď DAM nemá otvorený
krok, a uzavrie sa celá (build, kópia, úpravy DAM, CK-DAM) skôr, než sa v LIB alebo v DAM otvorí ďalší krok. Nikdy do
admin-cms ani admin-ugc. Ak `copy.sh` zlyhá, platí N-K (2.0). C3 nesie veľa: v DAM menia správanie najmä M, F4
a PV14a (jadro, služba a usadzovanie, ktoré admin-dam používa od K3 a K6); ostatné sú komponenty, ktoré admin-dam
nepoužíva alebo používa od U3 až U5c. PV10 prišlo do admin-dam s C2 (posudok Opusa C2): továreň dáva
`uploadedAssetId: null` a usadenie knižnice ho zapíše pri každom duplikáte admin-dam; nikto ho nečíta, nič viditeľné.

### 1.4 Míľniky a bezpečné zastavenie

Prerušiť sa dá v ktorejkoľvek chvíli takto: vedúci prestane otvárať kroky, otvorené kroky (najviac jeden v každom
strome) sa uzavrú alebo sa zastavia s poznámkou, všetky stromy sú zelené. Míľniky (čas na kritickej ceste):

| Míľnik | Uzavreté | Čas |
|---|---|---|
| M0 | S0-A, N32, N39-L, N39-D, S0-B | asi 8,25 h |
| M1 | K0, K1, U0-D, U0-L | asi 12,25 h |
| M2 | K2, U1, C1, P0, 44 | asi 17,25 h |
| M3 | K3, N9, K4, U4, 28 | asi 24,5 h |
| M4 | PK3, PV16-L, nález 20, K5, I1, C2 | asi 30,75 h |
| M5 | N20V, 33, U6, 25, K6, 40, 19, F5 s F-A | asi 44,75 h |
| M6 | M, F2, F4, PV10, F-B s 50, PV16-D, U2 | asi 52,25 h |
| M7 | U7, 30, 31, 36, 45, U3, U5a | asi 60,5 h |
| M8 | F-C s F-D, 47, U8-L, U5b | asi 65,75 h |
| M9 | PV14a, PV14b, 43, U5c, 38 | asi 76,75 h |
| M10 | C3 s U8-D, Z | asi 82,25 h |

---

## 2. Kroky

### 2.0 Čo platí pre každý krok

**Úspornosť posudkov (vlastník 10. 10., 22:55; platí od PK3).** (1) Prvé kolo kroku, ktorý mení kód: Codex aj Opus.
Opravné kolo, ktoré mení kód: Codex a Opus s úzkym zadaním (len záplata cyklu, obmedzený počet krokov; prípadne
lacnejší model). Opravné kolo len s testami alebo dokumentmi: len Codex. Nity v dokumentoch (čísla riadkov, znenie)
opraví vedúci bez ďalšieho kola. (2) Malé opravy idúce za sebou v jednom strome (napr. PK3 a PV16-L) dostanú jeden
spoločný posudok; každá má vlastný snímok, záplatu a CK. (3) Plná hĺbka Opusa na rizikové kroky: K6, U6, M, PV14a/b,
U5c a kópie so skutočnou zmenou. (4) Pre nový blok krokov (napr. widgety U7 až 47) čerstvý implementátor s krátkym
zadaním namiesto agenta s dlhým kontextom. (5) Vedúci hlási vlastníkovi len uzavreté kroky, rozhodnutia a problémy.

**Jeden otvorený krok v strome.** Krok otvára a uzatvára vedúci (záznam v denníku). V jednom kroku smú pracovať dvaja
agenti, ak majú disjunktné súbory (K2 a K4: implementátor kód, testy-lib nové súbory testov). Krok sa neotvorí, kým
predošlý v tom istom strome nie je uzavretý; po kópii C až po jej uzavretí.

**Vlastník** je pri práci a povie, kedy sa začne kódovať (prvý krok s kódom je N32; dovtedy beží len S0-A). Pravidlo
o krokoch v jeho neprítomnosti z verzie 7.1 je zrušené (denník, V0, dávka 2). **Commit** krokov 0 až 3 je urobený (LIB
`03c3a108`, DAM `9818e6b5`, bez pushu); snímky ukladajú `git status` a `git diff HEAD` voči tomuto `HEAD`. Ďalší commit
len na signál vlastníka a len vtedy, keď nie je otvorený žiadny krok: pred S0-B (po uzavretí opráv; potom sa N-H opráv
už nerobí, ich snímky sú voči staršiemu `HEAD`) alebo v Z.

**Priebeh.**
1. Snímok: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh <strom> <meno snímku> [súbory mimo src]`,
   napríklad `… snimok.sh /home/volar/projects/anzusystems/common-admin K2`,
   `… snimok.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u U1`,
   `… snimok.sh /home/volar/projects/anzusystems/admin-dam C2 tsconfig.test.json`.
   **Mená snímkov:** prvý pokus kroku = meno kroku (`K2`); nový pokus po návrate alebo po neúplnom snímku = `K2-o2`,
   `K2-o3`; pred opravami cyklu n = `K2-c1` (pri pokuse o2: `K2-o2-c1`). Snímok bez súboru `HOTOVO` je neúplný; skript
   to pri chybe vypíše a ostatné skripty ho odmietnu. Nič sa neprepisuje ani nemaže.
2. Kód a cielené testy (`--retry=0`; každý beh LIB a každý ťažký príkaz cez `tezky.sh`, 3.6).
3. CK stromu so slotom od vedúceho (`ck-lib.sh` alebo `ck-dam.sh`, 5.1).
4. Záplata `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/zaplata.sh <meno snímku>`; posudky Codexu
   a Opusu naraz nad ňou.
5. Opravy: pred nimi snímok `<krok>-c<n>`, po nich cielené testy a záplata `zaplata.sh <krok>-c<n>`; posudok opráv.
   Opakuje sa, kým posudok niečo nachádza.
6. CK po poslednej úprave.
7. Uzavretie: register a poznámka kroku doplnené, ohnuté súbory overené (`cmp`, 4.3), `zaplata.sh` neukazuje zmenu
   mimo `src` a `doc` okrem súborov kroku; vedúci krok uzavrie.

Krok, ktorý mení len testy, robí CK-LIB-T alebo CK-DAM-T (5.1).

**Súbory mimo `src`.** Mení ich len C2 (`/home/volar/projects/anzusystems/admin-dam/tsconfig.test.json`) a Z
(`/home/volar/projects/anzusystems/common-admin/doc/changelog/2.0.0.md`,
`/home/volar/projects/anzusystems/admin-dam/doc/changelog/3.0.0.md`). Snímok a návrat ich pokrývajú, keď sú v snímku
menované. Dokumentáciu PV14b (`doc/changelog/2.0.0.md:70`, `doc/guide/installation.md:62`) a texty opráv do
changelogov píše Z. **V `lib-u` sa mimo `src` nemení nič nikdy** (stav pri založení zapíše S0-B, kontroluje ho Z
bod 8). Ak by iný krok potreboval zmeniť súbor mimo `src` (napríklad konfiguráciu buildu), agent zastaví, vedúci
doplní zoznam a urobí doplnkový snímok. `src/typed-router.d.ts` v DAM prepisuje `generate:dts`; ak ho záplata ukáže,
nie je to zmena kroku. Poznámky krokov, registre a denník v `doc/` nie sú súčasťou snímkov: píšu sa priebežne a pri
návrate sa záznamy kroku označia „vrátené (dôvod)".

**Mazanie.** Naše príkazy nič nemažú a žiadny krok nemaže súbor; mazanie je len v U9 a robí ho vlastník. Testy, ktoré
návrhy „vypúšťajú", sa prepíšu alebo ostanú do U9; súbory admin-dam bez importéra ostanú na disku (R-K13). Preto sú
návrat aj prenos presné: `snimok.sh` uloží zoznam súborov a `navrat.sh` aj `prenos.sh` zastavia, ak súbor zo snímku či
zo základu chýba. **Nástroje projektu mažú pri bežnej práci**, a to vlastník povolil 9. 10.: `copy.sh` (vlastné `cd`;
`rm -rf` nainštalovaného `dist`, `src/eslint` a `src/vite` v balíku `DAM/node_modules/@anzusystems/common-admin`,
`rm -f` jeho `package.json`, `rm -rf` `DAM/node_modules/.vite/deps` a `DAM/node_modules/.cache/tsc`), `vite build`
v LIB aj v DAM (vyprázdni `dist`) a `generate:dts` v DAM (`rmSync` dvoch súborov po unplugin-auto-import, dnes
neexistujú, `scripts/generate-dts.mjs:12-15`).

**Návrat** (krok sa nedá dostať do zelena alebo ho vlastník zamietne; žiadny zápis do gitu, nič sa nemaže).

- **Kedy smie:** N-H sa robí len pre **otvorený krok** stromu alebo pre **posledný uzavretý krok** stromu, keď v ňom
  nie je otvorený žiadny krok (otvorený sa najprv vráti alebo uzavrie). Starší krok sa nikdy neobnovuje zo snímku
  celého `src` (zmazal by prácu neskorších krokov); namiesto toho sa otvorí **krok opravy dopredu**, o ktorom rozhodne
  vedúci a zapíše ho do denníka. **Po prvom zmazaní vlastníkom v Z (bod 4) sa DAM opravuje len dopredu:** N-H
  s ktorýmkoľvek snímkom DAM urobeným pred týmto zmazaním je zakázaný (`navrat.sh` by ohlásil chýbajúce súbory a ich
  obnova zo snímku by zrušila zmazanie vlastníka); snímky urobené po ňom (napríklad v C4) sú v poriadku.
- **N-H, strom** (LIB, DAM aj `lib-u`): `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/navrat.sh <meno snímku>`.
  1. Skript najprv overí snímok (`HOTOVO`, priečinok `src`, neprázdny `subory.txt` zhodný so súbormi snímku) a zapíše
     zoznamy snímku aj stromu do súborov v `PRACA/vysledky/` s kontrolou kódu každého `find`; ak čokoľvek z toho
     zlyhá, skončí bez jediného príkazu `mv`. Ak potom nájde nové položky kroku (kód 3), vypíše presné príkazy
     `mkdir -p … && mv … …` do `/home/volar/projects/anzusystems/krok5-praca/kos/<meno>/`. Vykonajú sa (vlastník
     `mv` do koša povolil 9. 10.); ak by `mv` vypýtal potvrdenie, krok ostáva otvorený a čaká na vlastníka.
  2. Po presune sa `navrat.sh` spustí znova: uloží dnešný stav `src` a menovaných súborov do
     `snap/<meno>-zahodene` (nič sa nestratí; cesta je vždy nová), obnoví `src` zo snímku (`rsync -a --checksum`, bez
     `--delete`; porovnáva obsah, nie len veľkosť a čas) a menované súbory,
     a overí zhodu: `diff -rq` nič nevypíše, obsah menovaných súborov sa zhoduje, sledované súbory
     (`git diff --binary HEAD -- src …`) sa zhodujú so snímkom a `git status --porcelain` mimo `doc/` sa zhoduje so
     stavom pri snímku.
  3. Cielené testy predošlého kroku. Nový pokus kroku dostane snímok `<krok>-o2`.
- **N-C, kópia knižnice:** keďže sa kópia uzavrie skôr, než sa v LIB otvorí ďalší krok, je N-C = N-H **posledného
  kroku LIB** pred kópiou (K2 pri C1, I1 pri C2, posledný krok LIB pred C3), potom `kopia.sh` a CK-DAM. Ak je príčina
  v staršom kroku LIB, krok opravy dopredu. Ak sa vracia len krok DAM, knižnica ostáva.
- **N-K, zlyhaná kópia:** `copy.sh` najprv zmaže nainštalovaný `dist`, `package.json`, `src/eslint` a `src/vite`
  balíka a potom kopíruje (`copy.sh:95-121`); ak zlyhá medzi tým, DAM nemá použiteľnú knižnicu. `kopia.sh` preto pred
  kópiou uloží celý nainštalovaný balík do `PRACA/balik/<bod>/` (15 MB) a do `PRACA/balik/zoznam.txt` zapíše, ktorá
  knižnica to je a či prešla CK-DAM (stav vedie `PRACA/balik/nainstalovane.txt`: S0-A ho založí ako „S0 zelene",
  `kopia.sh` po kópii zapíše „<bod> neoverene", po zlyhanom `copy.sh` „<bod> pokazene", keď `copy.sh` skončí 0, ale
  jeho výstup nesedí, „<bod> nejasne" (a zastaví sa), a vedúci po CK-DAM v bode kópie
  `kopia.sh --stav <bod> zelene` alebo `cervene`; `--stav` prijme len stav `neoverene` alebo `obnovene`, takže
  z `nejasne` vedie ďalej len nový `kopia.sh <bod>` alebo obnova). Obnova:
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/obnova-balika.sh` (bez argumentu) vezme **najnovšie
  uloženie knižnice so zeleným CK-DAM**, nikdy uloženie knižnice, ktorá práve zlyhala alebo nebola overená; uložené
  súbory `dist`, `package.json`, `src/eslint` a `src/vite` vráti do balíka po jednom (`cp -p`) a overí `cmp`. Súbor,
  ktorý má v balíku viac než jeden odkaz (`stat -c %h`), `copy.sh` ešte nenahradil, je pôvodný a neprepíše sa
  (pri pnpm by sa zapísalo do spoločného úložiska; admin-dam má `nodeLinker: node-modules`, je to poistka ako
  v `copy.sh:103-105`), len sa porovná. Skript vypíše súbory, ktoré `copy.sh` medzitým pridal (s uloženým `dist` sa
  nenačítajú, sú nečinné; zoznam ide vlastníkovi na zmazanie), a zapíše „<pôvod> obnovene". Potom
  `ck-dam.sh <meno> <bod>-obnova T`; ak je zelené, `kopia.sh --stav <pôvod> zelene`. Príčinu zlyhania `copy.sh`
  zistí vedúci skôr, než kópiu zopakuje.

**Register.** Každé zblíženie, ktoré register návrhu ešte nemá, implementátor zapíše v tvare registra do poznámky
kroku; vedúci ho prepíše do časti 6 príslušného návrhu (`navrh-jadro.md` pre K a F, `navrh-komponenty.md` pre U) skôr,
než krok uzavrie. Krok, ktorý by zmenil, čo používateľ vidí alebo môže urobiť, alebo čo sa pošle na backend, sa
zastaví a vráti vedúcemu ako nová téma; výnimkou je len zmena, ktorú vlastník rozhodol a krok ju má v pláne (2.1, 2.9).

**Pohľad K-04** (vzhľad zblíženia; komponenty 4.4) robí vlastník po U3, U5c a U6. **Schválené vlastníkom 9. 10.:** ak
vlastník v tej chvíli nie je k dispozícii, krok sa uzavrie s výhradou K-04 zapísanou v denníku a ďalší krok
v strome smie začať. Odložený pohľad sa urobí **len na hranici toho stromu** (žiadny otvorený krok), aby vlastník
nevidel polovičný krok. Ak pohľad ukáže viac než opísaný rozdiel, zblíženie sa vráti ako krok opravy dopredu.

**Nálezy mimo zmeny** sa neopravujú; vedúci ich zapíše do denníka ako ďalší bod. Najbližšie voľné číslo je **53**.

**Poznámka kroku**: `/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/impl/<krok>.md`
(aj pre kroky v DAM a v `lib-u`), písaná priebežne: stav po každom podkroku, príkazy a čísla, zmenené súbory, ohnuté
súbory, odchýlky od návrhu, zblíženia navyše, nové nálezy, výsledky posudkov. Posudky ukladá vedúci do
`…/krok5/impl/posudky/<krok>-c<n>-codex.md` a `…-opus.md`.

**Riadky v návrhoch a v pláne** sú zo stavu 18:46 / 18:36; testy sa hľadajú podľa mena prípadu. Opravy N32 a N39 menia
14 súborov, takže citácie v nich sa posunú a počty prípadov vzrastú: LIB
`L/imageWidget/components/ImageWidgetMultipleInner.vue`, `L/api/damAssetApi.ts`,
`L/uploadQueue/components/UploadQueueDialog.vue`, `UploadQueueDialogSingle.vue`,
`UploadQueueDialogSingleSidebarMetadata.vue`, `LW/consumerProfileImageWidgetMultipleUpload.test.ts`,
`LT0/consumerProfileUploadDialogActions.test.ts`, `LT0/consumerProfileUploadDialogSingle.test.ts`,
`LT0/damAssetApiBulkMetadata.test.ts`; DAM `D/asset/api/assetApi.ts`,
`D/asset/components/footer/AssetFooterUploadOverlayFull.vue`, `AssetFooterSelectedFull.vue`,
`DT/queue/overlaySave.test.ts`, `DT/asset/bulkMetadata.test.ts`. V pláne sa to týka napríklad
`overlaySave.test.ts:510-520` (K6) a `:329`, `:361` (43), `LT0/consumerProfileUploadDialogSingle` (34 prípadov,
`:412-450` (po U0-L; pred ním `:252-275`); U6), `UploadQueueDialog.vue:130-140` a `consumerProfileImageWidgetMultipleUpload.test.ts:329-331` (31),
`damAssetApi.ts:230`, `consumerProfileImageWidgetMultipleUpload.test.ts:421-428` a
`LT0/damAssetApiBulkMetadata.test.ts:99-106` (36), `AssetFooterSelectedFull.vue:62-79` (50). Oprava nálezu 48 môže
zmeniť aj volajúcich uloženia detailu (LIB `L/assetDetail/components/AssetDetailSidebarMetadata.vue`, DAM detail a pravý
panel); potom sa posunú aj citácie F-C (`:48-90`) a nálezu 50 (`:60-62`, `:62-86`). S0-B ich prepočíta (5.3, B9) podľa
záplat opráv a zadania citujú prepočítané riadky.

### 2.1 Pred krokom 5: S0-A, opravy N32 a N39, S0-B

Opravy nálezov 32 a 39 (a 29) idú pred krokom 5 ako samostatné kroky (denník, „Rozhodnutia vlastníka k analýzam",
body 1 a 2). Majú priebeh 2.0, preto potrebujú nástroje, zámok a bránu: S0 sa delí na S0-A pred nimi a S0-B po nich.
Obe opravy menia, čo používateľ vidí (hláška) alebo čo sa pošle na backend (N32); rozhodol vlastník 9. 10. Posudok
overí, že sa zmenilo len to. Nález 48 (uloženie detailu assetu) sa opraví spolu s nimi, rovnakým vzorom (vlastník 9. 10.).

**S0-A (vedúci; 0,5 h).**
- Kedy: vlastník povedal, že sa začína kódovať; nič nebeží.
- Cieľ: PRACA, nástroje, zámok a brána pre kroky opráv; skúšky otázok na potvrdenie; nečinné čítanie brány; stav
  nainštalovanej knižnice pre N-K. `lib-u` sa ešte nezakladá.
- Postup: kontrolný zoznam 5.3, časť A. Návrat: S0-A mení len PRACA.

**N32 (LIB; impl-komp-lib; 2,5 h; 1 cyklus).** Nálezy 32 a 32b (`analyzy/nalez32-autori-pri-ulozeni-galerie.md`,
časti 6 a 7). Len v 2.0: opravné vydanie 1.49.x ani vývojový build sa nerobí, audit log DAM sa nerieši (vlastník 9. 10.).
- Cieľ: (32) uloženie galérie pošle autorov do DAM len z riadku, v ktorom nejakých vybral: v
  `L/imageWidget/components/ImageWidgetMultipleInner.vue:450` podmienka `&& image.damAuthors.length > 0`, ako
  v jednoobrázkových widgetoch; (32b) riadky si po uložení nechajú `assetId` (`:478`, `:495`:
  `assetId: matchedImage ? matchedImage.assetId : item.assetId`). Do DAM sa už nepošle PATCH za riadky bez vybraného
  autora; autor pridaný medzitým v DAM ostane.
- Súbory: `ImageWidgetMultipleInner.vue`, `LW/consumerProfileImageWidgetMultipleUpload.test.ts`. Mimo `src`: nič.
- Testy: otočí sa `consumerProfileImageWidgetMultipleUpload.test.ts:434-447` (bez vybraného autora žiadny PATCH na
  `metadata-bulk-update`, oba profily); nové: „Upraviť asset" uloží autora a uloženie galérie ho nezmaže (na dnešnom
  kóde musí padnúť); čítanie detailu zlyhá a uloženie galérie autorov nezapíše; 32b: autor vybraný po prvom uložení
  ide pri druhom s ID assetu. Stráž: `:453-476` (autori vybraní v riadku sa zapíšu ako dnes) bez zmeny.
- CK-LIB. Veľkosť: dva riadky kódu, štyri prípady testov. Kópia: C1 (admin-dam galériu nepoužíva). Návrat: N-H.

**N39-L (LIB; impl-komp-lib; 4,25 h; 1 až 2 cykly).** Nálezy 39, 29 a 48, strana knižnice
(`analyzy/nalez39-29-tiche-ulozenie.md`, časti 5.1 až 5.8; v denníku body 2, 3, 6 a 8 analýzy).
- Cieľ: zlyhané hromadné uloženie metadát ukáže hlášku podľa druhu chyby (sieť, 500 a neočakávaná odpoveď
  „Systémová chyba…", 403 „Prístup zamietnutý…", vypršaný čas „Požiadavka na API vypršala…"); pri 422 názvy polí ako
  v detaile assetu; dialóg jedného súboru počas uloženia točí a nedovolí druhý klik; uloženie autorov galérie ide tou
  istou funkciou. Žiadny nový text (5.6); po chybe ostane dialóg otvorený s riadkami ako dnes.
- Súbory: `L/api/damAssetApi.ts` (`:102-132`, `:195-211`: `useApiRequest` pre každú dávku, `validateStatus` len 200;
  `:354-392` uloženie autorov galérie), `L/uploadQueue/components/UploadQueueDialog.vue` (`:106-108` bez
  `console.error`, `:142-144`), `UploadQueueDialogSingle.vue` (`:258-260`, `:300-302`; `saving`),
  `UploadQueueDialogSingleSidebarMetadata.vue` (`:loading` a `:disabled` tlačidiel `:82-99`). Mimo `src`: nič.
- Testy (analýza 5.7): `LT0/consumerProfileUploadDialogActions.test.ts:245-265`, `:366-381` a
  `LT0/consumerProfileUploadDialogSingle.test.ts:400-421` (oba profily) tvrdia hlášku; nové: „uložiť" dialógu jedného
  súboru pri zlyhaní, 403, 422 pri vlastnom poli a pri kľúčových slovách, točenie a jedna požiadavka pri dvojkliku, 403
  pri uložení autorov galérie; `LT0/damAssetApiBulkMetadata.test.ts:164-173` ostane, pribudne trieda chyby a zápis do
  hlásenia (401, 403 a 422 nie). Bez zmeny `LT/uploadQueueDialogSingle`, `uploadQueueDialogSave` a testy N32. Prvý beh
  overí, že falošný server rešpektuje `validateStatus` (analýza 7).
- Nález 48 (+0,5 h): uloženie detailu assetu `updateAssetMetadata` (`L/api/damAssetApi.ts:285-290`, `:296-298`) ide cez
  `useApiRequest` (úspech len 200), hlášku pri 422 ukáže jedno miesto (dnes dve), pri neznámej chybe záchrana
  `showUnknownError` (dnes pri 2xx inom než 200 ticho); volajúci uloženia detailu podľa potreby. Testy: uloženie detailu
  pri 422 jedna hláška, pri 2xx inom než 200 hláška, pri 500 a 403 hláška podľa druhu.
- CK-LIB. Veľkosť podľa analýzy 5.8 a +0,5 h za nález 48. Kópia: C1. Návrat: N-H.

**N39-D (DAM; impl-dam; 3 h; 1 cyklus; súbežne s N32 a N39-L).** Nálezy 39, 29 a 48, strana admin-dam.
- Súbory: `D/asset/api/assetApi.ts:228-265` (`useApiRequest` pre každú dávku, `validateStatus` 200),
  `D/asset/components/footer/AssetFooterUploadOverlayFull.vue:87-89`, `:108-110` a `AssetFooterSelectedFull.vue:74-76`,
  `:94-96` (`if (!showErrorsDefault(error)) showUnknownError()`), názvy polí pri 422. Z balíka len `useApiRequest`,
  `HTTP_STATUS_OK` a `useAlerts`; kópia netreba. Mimo `src`: nič.
- Testy: `DT/queue/overlaySave.test.ts` (9 prípadov `:253-271`, `:304-318`, `:492-503` tvrdia hlášku; falošná 422
  `:63-68` v tvare backendu `'[0].customData.title'`; nové: „uložiť" hromadnej úpravy pri zlyhaní, 403, zlyhaná druhá
  dávka po odoslanej prvej), `DT/asset/bulkMetadata.test.ts` (triedy chýb 403, 422, 500, 204, sieť, vypršanie; zápis do
  hlásenia pri 500 áno, pri 401 a 403 nie), 422 pri vlastnom poli a kľúčových slovách.
- Nález 48 (+0,5 h): uloženie detailu assetu (`D/asset/api/assetApi.ts:317-331`) rovnako: `useApiRequest`, jedno
  miesto hlášky pri 422, záchrana `showUnknownError`; volajúci (detail a pravý panel) podľa potreby. Testy ako v LIB.
- CK-DAM. Veľkosť podľa analýzy 5.8 a +0,5 h za nález 48. Návrat: N-H.

**S0-B (vedúci; 1 h).**
- Kedy: N32, N39-L a N39-D uzavreté; žiadny otvorený krok; prípadný commit na signál vlastníka je urobený.
- Cieľ: východisko po opravách (čísla z CK po N39-L a N39-D), `lib-u` zo stavu LIB po opravách, vzorky pamäte,
  skúška nástrojov v `lib-u`, ohýbanie v pamäti, build LIB, prepočet citácií, ktoré opravy posunuli.
- Postup: kontrolný zoznam 5.3, časť B. Návrat: S0-B v repozitároch mení len ignorované výstupy buildov.

### 2.2 Testy na začiatku a P0

Každý nový prípad prechádza na nezmenenom kóde. Prípad, ktorý tvrdí neprítomnosť („nie je tlačidlo", „nič neodíde"),
sa dokáže ohnutím produkčného riadku podľa 4.3.

**K0 (DAM; testy-dam; 0,75 h; 1 cyklus).**
- Cieľ: v DAM pripnúť B22/C27: kúsok štyrikrát odmietnutý s 400 bez `fields` → riadok ukáže `unknownError`
  a príde jedno upozornenie (jadro 4.2).
- Súbory: `DT/queue/uploadFailures.test.ts` (nový prípad). Mimo `src`: nič.
- Stráže: prejde na nezmenenom kóde; ohnutie textu alebo upozornenia v sklade DAM ho zhodí.
- CK-DAM-T. Veľkosť: asi 40 riadkov testu. Návrat: N-H.

**U0-D (DAM; testy-dam; 3,25 h; 1 cyklus).**
- Cieľ: testy dnešného správania admin-dam, ktoré chýbajú (komponenty 4.2).
- Súbory: `DT/queue/queueRowStates.test.ts` (nové prípady: RD12 (b) „Obnoviť" až 20 s po prechode, keď upozornenie
  príde až na nahratý riadok; „na duplikáte nie je žiadne tlačidlo úpravy"); nové `DT/list/assetMetaIconsTts.test.ts`,
  `DT/asset/assetDetailMetadataScope.test.ts`; voliteľne `DT/author/authorListCreate.test.ts`. Mimo `src`: nič.
- Stráže: prejdú na nezmenenom kóde; vlna 4 DAM bez zmeny. Prípad duplikátu sa dokáže tak, že ohnutie vloží do ľavej
  časti riadku na duplikáte tlačidlo s **iným textom** než „Edit more" (komponenty 4.2).
- CK-DAM-T. Veľkosť: asi 300 až 350 riadkov testov. Návrat: N-H. Uzavretý pred C1.

**U0-L (`lib-u`; testy-lib; 3,25 h; 1 cyklus).**
- Cieľ: testy dnešného správania knižnice (komponenty 4.2).
- Súbory: nové `L/assetDetail/__tests__/assetDetailDialog.test.ts` (aj editor oblasti s právom a bez neho),
  `LW/damImageSites.test.ts` (IM7, IM8, IM9); nové prípady v `LT/uploadQueueRowRefresh.test.ts` (riadok pripojený už
  `Uploaded`, bez metadát a s upozornením: pred 20 s ani „Obnoviť", ani kôš; po 20 s oba; príprava podľa N-Z21,
  `uploadSettlement.test.ts:1013-1033`). Mimo `src`: nič.
- Stráže: prejdú na nezmenenom kóde; ohnutie podľa 4.3.
- CK-LIB-T v `lib-u`. Veľkosť: asi 400 riadkov testov. Návrat: N-H v `lib-u`. Hneď po uzavretí sa otvorí U1, ktorého
  snímok `snap/U1` je presný stav `lib-u` po U0-L.

**P0 (LIB; vedúci; 0,5 h; bez posudku).**
- Cieľ: dostať súbory U0-L do LIB, aby strážili K4, K5 a neskoršie kroky.
- Kedy: po uzavretí C1 (C1 tak nasleduje priamo po K2, ktorý je potom jeho N-C), pred K4. Treba len hotový otvárací
  snímok U1 (`snap/U1`; ak sa U1 otváral znova, posledný `snap/U1-oN`); U1 môže byť otvorený aj uzavretý, P0 nečíta
  živý `lib-u`, ale tento snímok.
- Body porovnania sú len zmrazené snímky: worktree = `snap/U1/src`. Očakávaný zoznam v **rovnakom tvare ako triedy
  `prenos.sh`** dá suchý beh `prenos.sh` nad otváracími snímkami U0-L a U1 (základ aj hlavný strom = `snap/U0-L/src`,
  worktree = `snap/U1/src`, teda každá cesta, ktorú U0-L zmenil, vyjde VZIAT a nová NOVY):
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/prenos.sh /home/volar/projects/anzusystems/krok5-praca/snap/U0-L/src /home/volar/projects/anzusystems/krok5-praca/snap/U1/src /home/volar/projects/anzusystems/krok5-praca/snap/U0-L/src > /home/volar/projects/anzusystems/krok5-praca/zaplaty/P0-ocakavane.txt`
  (pri opakovaných pokusoch posledné `-oN` oboch; `zaplaty/U0-L.diff` sa nepoužíva, lebo `zaplata.sh` ho prepisuje
  voči živému stromu).
- Postup: `snimok.sh /home/volar/projects/anzusystems/common-admin P0`; suchý beh
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/prenos.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u-zaklad/src /home/volar/projects/anzusystems/krok5-praca/snap/U1/src /home/volar/projects/anzusystems/common-admin/src > /home/volar/projects/anzusystems/krok5-praca/zaplaty/P0-triedy.txt`;
  `diff /home/volar/projects/anzusystems/krok5-praca/zaplaty/P0-ocakavane.txt /home/volar/projects/anzusystems/krok5-praca/zaplaty/P0-triedy.txt`
  nesmie vypísať nič (žiadne ZMAZANE ani RUCNE; `src/lib.ts` a `src/test/publicExportsAdded.test.ts` U0-L nemení, vo
  worktree sú teda nezmenené a nevyjdú vôbec); potom ten istý príkaz s `--vykonaj` (skript sám overí každú
  skopírovanú cestu); CK-LIB-T v LIB.
- Posudok netreba: prenášajú sa už posúdené súbory a zhodu ukáže skript. Návrat: N-H (P0).

### 2.3 Jadro v knižnici: K1, K2, K4, K5 (LIB; impl-jadro-lib)

**K1 = K1a + K1b (1,75 h; 1 cyklus).**
- Cieľ: K1a tri požiadavky von ako `damFileUploadStart/Chunk/Finish`; K1b `damUploadFinish` bez `_endPointAsset` (O15).
- Súbory: `src/lib.ts`, `LS/publicExportsAdded.test.ts`; `L/api/uploadApi.ts:55-62`, `L/uploadQueue/composables/uploadService.ts:31-32`;
  testy `LT/uploadStatusFallback.test.ts:1340,1353`, `LT/uploadQueuesStore.test.ts:39,46,475` (`call[3].file` →
  `call[2].file`), `LT0/damImageApiUploadRequests.test.ts:170`. Mimo `src`: nič.
- Stráže: `LS/importCycles`, `publicExportsAdded`, `publicExportsDamConsumers` (bez zmeny); `LT/uploadStatusFallback`,
  `uploadQueuesStore`, `LT0/damImageApiUploadRequests`, `LT/uploadService*`, `uploadStop*`,
  `uploadQueueStartsEachFileOnce`, `uploadQueueOperations`, `uploadQueueClientFailure`.
- CK-LIB. Veľkosť: asi 3 + 15 riadkov kódu, 10 riadkov testov. Zblíženia: žiadne. Návrat: N-H.

**K2 (5,75 h; 2 až 3 cykly).**
- Cieľ: jeden priebeh služby pre obe strany, `libraryUploadPreset()` a `adminDamUploadPreset(app)`; exporty
  `useDamUpload`, `adminDamUploadPreset`, `uploadValidationMessage`, `uploadStop` a typy (jadro 2.3, 2.6).
- Súbory (impl-jadro-lib): `L/uploadQueue/composables/uploadService.ts` (prepis, asi 340 riadkov), nový
  `L/uploadQueue/presets/uploadPresets.ts` (asi 80), `src/lib.ts`, `LS/publicExportsAdded.test.ts`. Súbory (testy-lib):
  nový súbor testov služby pod sadami (meno navrhujem `LT/uploadServicePresets.test.ts`; podľa jadra 4.2, K2). Mimo
  `src`: nič.
- Stráže: bez zmeny `LT/uploadServiceRetry` (`:85` pauzy), `uploadServiceSequence` (typ kúska `:76-82`),
  `uploadServiceApiTimeout`, `uploadStop*`, `uploadStopWhileHashLoads` (`'Upload stopped'`),
  `LT0/consumerProfileUpload` (typ `:99-101`), `LT0/damImageApiChunkTimeout`, `LT/uploadStopAbortsChunk`, vlna 4 LIB
  (12 súborov), `LS/importCycles`. Nové prípady: sada admin-dam (prázdny súbor ide, texty aplikácie, `loadHash`
  aplikácie bez čítania volieb pluginu; prípad „meranie pri každom pokuse" sa nepíše: krok M ho zruší a do M drží
  základ admin-dam `DT/upload/uploadStop.test.ts:118`, jadro 4.2); pod oboma sadami kúsok s neplatnou veľkosťou alebo
  posunom neodíde a ohlási `dam_upload_chunk_validation`, 400 ohlási `dam_upload_chunk_400` (náhrada
  `@/domains/system/composables/sentry` podľa cesty), zlyhaný upload s hlásením priebehu nenechá tik merača ani
  ďalšie volanie `uploadCallback` pri žiadnom spôsobe zlyhania vrátane `upload()` bez `uploadInit()` (Z10),
  zastavenie stavom aj `stop()` v každom bode kontroly.
- Pravidlá, ktoré posudok výslovne overí: jadro 2.3, pravidlá 1 až 7 (najmä 6: na ceste po dokončenie žiadny 0 ms
  časovač ani dynamický import; 7: `axios` cez predvolený export).
- Zblíženia v LIB: Z5, Z6, Z10, Z12 (v registri). Vlastník 9. 10. potvrdil všetkých sedem PV (testy K2 pripínajú Z2
  a Z27 pod sadou admin-dam). Člen `speedBaseline` je v sadách len dočasne, do kroku M (jadro 11; F1 a K2-D4 nahradil
  M, 2.9).
- CK-LIB. Veľkosť: kód asi +120 / −90 netto (prepis asi 200 riadkov), testy asi 400. Návrat: N-H.

**K4 (6,75 h; 2 až 3 cykly).**
- Cieľ: jadro fronty, dve sady jadra, tri čisté funkcie hromadných operácií; zatiaľ ich používa len composable
  hromadných operácií (jadro 2.4, 2.5).
- Súbory (impl-jadro-lib): nové `L/uploadQueue/core/uploadQueueCoreTypes.ts` (asi 100), `uploadQueueCore.ts` (asi 330),
  `uploadQueueFill.ts` (asi 55), `L/uploadQueue/presets/queuePresets.ts` (asi 95); zmenené
  `L/uploadQueue/composables/uploadQueueMassOperations.ts` (asi −25), `src/lib.ts`, `LS/publicExportsAdded.test.ts`.
  Súbory (testy-lib): `L/uploadQueue/core/__tests__/uploadQueueCore.test.ts` a testy funkcií hromadných operácií
  (jadro 4.2, K4). Mimo `src`: nič.
- Stráže: `LT/uploadQueueMassOperations`, `massOperationsValidation`, `LT0/consumerProfileUploadMassOperations` bez
  zmeny; `LS/importCycles` („finds none", smer závislostí z jadra 2.1); prípady U0-L (od P0); nové prípady jadra pod
  oboma sadami: dve naraz a nezávislé fronty, `runnerFor`, úspech a zlyhanie s `onClientFailure` aj bez neho (poradie
  zápisov, jedno upozornenie na dôvod), sledovanie po zlyhaní len s `finishAttempted`, bez 4xx a bez zlyhania serverom,
  každý riadok tabuľky pravidla 5 (aj usadený riadok so živým behom; Z15 a Z17, PV6 a PV7 potvrdené 9. 10.),
  `clearQueue` vytvorí frontu, háky `rowTracked`, `rowRemoved`, `refreshMayHelp` len so sadou knižnice, `uniqueKey`;
  `accepts`; holé riadky.
- Pravidlá pre posudok: jadro 2.4, pravidlá 1 až 9 (najmä 5 a 7), zásada 4.
- Zblíženia v produkte: žiadne (jadro ešte nikto nepoužíva). CK-LIB. Veľkosť: kód asi +580, testy asi 500. Návrat: N-H.

**K5 (5,75 h; 2 až 3 cykly).**
- Cieľ: sklad LIB nad jadrom so sadou knižnice; `queues` ostáva `Map`; členy a podpisy sa nemenia (jadro 3.1).
- Súbory: `L/uploadQueue/store/uploadQueuesStore.ts` (555 → asi 240). Mimo `src`: nič.
- Stráže: celé `LT/`, `LT0/consumerProfile*`, `L/imageWidget/__tests__`, `L/assetSelect/__tests__`,
  `L/uploadQueue/settlement/__tests__`, vlna 4 LIB, prípady U0-L; `LT/uploadQueueOperations.test.ts:553-560` (C32) a
  `LT/uploadQueuesStore.test.ts:463-480` (J-01; po K5-c1).
- Zblíženia v LIB: Z14, Z15 (PV6), Z16, Z17 (PV7), Z19, Z21, Z22.
- CK-LIB. Veľkosť: asi −315. Návrat: N-H.

### 2.4 Jadro v admin-dam: K3, K6 (DAM; impl-dam)

**K3 (4,75 h; 2 až 3 cykly).**
- Cieľ: obaly požiadaviek a väzba sady služby; DAM posiela tak, ako knižnica (jadro 2.7).
- Súbory: `D/asset/api/imageApi.ts`, `audioApi.ts`, `videoApi.ts`, `documentApi.ts` (upload preč; v `imageApi.ts` aj
  `uploadFailed`, Q5), `D/asset/api/fileApi.ts` (`:63-240` → asi 40 riadkov; `'Content-Type': undefined` v knižnici
  sa nesmie „opraviť", Z1), `D/shared/services/upload/uploadService.ts` (311 → asi 95); testy
  `DT/upload/uploadStop.test.ts` (deväť prípadov dostane `await uploadInit()`, veľkosť kúska cez
  `seedDamConfig(useDamConfigStore(), 4)`), `DT/upload/uploadRequests.test.ts:107,116`, `DT/upload/fileApiDispatch.test.ts:24`.
  Mimo `src`: nič.
- Stráže: `DT/upload/*`, `DT/queue/*`, `DT/fallback/*`, vlna 4 DAM (10 súborov) bez zmeny;
  `DT/upload/uploadSequence.test.ts:84-93` (celá cesta po jedinom `advanceTimersByTimeAsync(0)`), `uploadErrorMessage`,
  `externalProviderImport`, `slotNotifications`, `lazyMetadata` bez zmeny; K0 a U0-D. Voliteľne nové tvrdenie Z2 cez
  `vi.mock('@sentry/vue')` (J-15).
- Zblíženia v DAM: Z1 (PV1), Z2 (PV2), Z3, Z4, Z5, Z6, Z7, Z8 (PV11), Z9 (PV5), Z10, Z11, Z12, Z27 (PV3).
- Prvý beh potvrdí R12 (náhrady `FileReader` dávajú `ArrayBuffer`) a R3 (hash pred štartom); ak nie, zastaviť a hlásiť.
- CK-DAM. Veľkosť: −510 (typové API), `fileApi.ts` −180 / +40, `uploadService.ts` −215; testy asi ±40. Návrat: N-H
  v DAM; knižnica ostáva.

**K6 (7,75 h; 3 cykly; najrizikovejší krok).**
- Cieľ: sklad DAM nad jadrom so sadou admin-dam; 37 členov a ich podpisy sa nemenia; `queues` ostáva verejný objekt
  (jadro 3.2).
- Súbory: `D/asset/store/uploadQueuesStore.ts` (918 → asi 470). Mimo `src`: nič.
- Stráže: celé `DT/` bez zmeny vrátane vlny 4, K0 a U0-D; menovite `DT/queue/slotNotifications.test.ts:688,707,731,756,807`
  (holý riadok, register podľa prijatého riadku, Z21), synchrónne zápisy po `stopUpload`, `clearQueue` a
  `removeByAssetId` (`DT/queue/slotUploadRow.test.ts:235-243`, `slotsOverlay.test.ts:127-130`,
  `overlaySave.test.ts:510-520`, `queueRefresh.test.ts:348-349`).
- Zblíženia v DAM: Z13, Z14, Z17 (len C32), Z18, Z20, Z22.
- Pravidlá pre posudok: zásada 1 jadra (upozornenie, text, beh uploadu a importu volá kód DAM); háky a `toRaw`.
- Z K4 (posudky 9. 10.): jadro ruší kúsok na ceste priamo cez `.abort()`, nie cez `uploadStop` služby. Testy
  `DT/queue/lazyMetadata.test.ts:32` a `DT/queue/slotNotifications.test.ts:51` podvrhujú `uploadStop` ako `vi.fn()`;
  po K6 ich náhrada zrušenie nezachytí. Pred kódom overiť, či niektorý ich prípad stojí na tom, že sa zrušenie nestane
  (ak áno, zapísať ako zmenu testu s dôvodom). **Overené posudkom Opusa K4:** falošné behy týchto testov nenastavia
  `latestChunkAbortController` a žiadny test DAM netvrdí `uploadStop`; poznámka je uzavretá.
- Z K4 c3 (Opus): zriedkavý súbeh obnovenie → odstránenie (kôš zapnutý metadátami, kým obnovenie čaká) po K6 ukáže
  `refreshFailed` po odstránení, dnes ho potlačí stav Stop (`D-st:559`). Pri K6 zvážiť stráž ako v knižnici
  (`L/uploadQueue/composables/uploadQueueItemRefresh.ts:39-49`, `removed()`) v obale admin-dam; zapísať ako zmenu s dôvodom.
- CK-DAM vrátane buildu. Veľkosť: asi −445. Návrat: N-H v DAM.

### 2.5 Komponenty v knižnici: U1, U4, PK3 (`lib-u`), U6, U7 a zvyšok (LIB po C2); impl-komp-lib

**Pravidlo pre `lib-u`:** po uzavretí kroku v `lib-u` vedúci otvorí ďalší krok tam len vtedy, ak sa podľa odhadu
uzavrie skôr než K5; inak `lib-u` ostane na hranici a čaká na I1. Poradie v `lib-u`: U0-L, U1 (s nálezom 24), 44, U4,
28, PK3, PV16-L, nález 20 so 17 (ak sa zmestí). Čo sa nezmestí (vždy U6 a U7; podľa okolností nález 20), ide po C2
v LIB. **U7 sa podľa odhadu už nezmestí:** pred ním pribudli 44 a 28, `lib-u` by skončil asi 0,75 h po K5 a I1 by
čakal. Preto U7 ide do LIB po C2 a jeho opravy 30, 31, 36, 45, F-C s F-D a 47 po ňom; voľné tri hodiny do K5 vyplní
PV16-L a nález 20. Voľba kópie do licencie (N20V, asi 1,25 h, s nálezom 20) by sa do `lib-u` pred K5 už nezmestila, preto
je prvým krokom LIB po C2. Nález 33 má ísť hneď po náleze 20 (návrh, analýza); v `lib-u` sa nezmestí (I1 by čakal asi
1 h), preto ide v LIB hneď po N20V (tie isté súbory výberu assetu).

**U1 (`lib-u`; 4,75 h; 2 cykly).**
- Cieľ: konfigurácia (2.12 komponentov), `disabledAs` a brána vytvorenia vo výberoch, injekcia návrhov a lenivý
  sklad v chipoch, `showTts` a ikona TTS, exporty U1 (2.11).
- Súbory: `src/AnzuSystemsCommonAdmin.ts`, `L/composables/commonAdminCoreDamOptions.ts`,
  `L/keyword/components/KeywordRemoteAutocompleteWithCached.vue`, `L/author/components/AuthorRemoteAutocompleteWithCached.vue`,
  `L/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue`, `L/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue`,
  `L/assetDetail/components/AssetImage.vue`, `AssetImageMetaIcons.vue`, `assetImageIconsConfig.ts`, nový
  `src/assets/dam-meta-icons/tts.svg`, `L/types/Asset.ts`, `src/locales/{sk,en,cs}/common/damImage.json`, nový
  `L/uploadQueue/components/uploadQueueBindings.ts`, `src/lib.ts`, `LS/publicExportsAdded.test.ts`. Mimo `src`: nič
  (ak by ikona potrebovala zmenu buildu, zastaviť).
- Stráže: **najprv** štyri nové prípady v `LT0/damNameChipsUnresolved.test.ts` na dnešnom kóde (chip kľúčového slova
  pri zlyhanom serveri ukáže `#id` a netočí sa; chip kľúčového slova pri opätovnom pýtaní sa točí a potom ukáže meno;
  chip konfliktu pri zlyhanom serveri ukáže `#id`; chip kľúčového slova s podaným titulkom ho ukáže hneď, bez točenia,
  pred odpoveďou na mená, a ponechá ho po nej); potom všetky testy LIB bez zmeny, `LT0/damAuthorKeywordEndpoints`,
  `LS/i18nLiteralKeys`, `a11y/iconButtonNames`, `a11y/accessibleNames`, `importCycles`, `publicExportsDamConsumers`;
  nové prípady pre druhé hodnoty (`disabledAs="input"`, brána s právom a bez neho v oboch výberoch, chip s ikonou
  „nové" bez skladu knižnice, `showTts`).
- Nález 24 (komponenty 4.5): v tom istom kroku zmazať riadok `uploadStatusFallback: true` v
  `src/playground/playground.ts:39` (voľba nič nerobí); profil testov ho drží zámerne. Ostatné opravy idú po U1 (2.9).
- Zblíženie: ZK12. CK-LIB v `lib-u`. Veľkosť: kód asi +200, testy asi +300. Návrat: N-H v `lib-u`.

**U4 (`lib-u`; 6,75 h; 2 až 3 cykly).**
- Cieľ: riadok, zoznam a sidebar so slotmi, vlastnosťami a väzbami; `UploadQueueItemErrorOverlay`,
  `createUploadQueueItemRefresh`, `refreshOffered`, `hideEditOnDuplicate`; ZK1, ZK6 až ZK8; exporty U4.
- Súbory: `L/uploadQueue/components/uploadQueueBindings.ts`, nový `UploadQueueItemErrorOverlay.vue`,
  `L/uploadQueue/composables/uploadQueueItemRefresh.ts`, `UploadQueueItemEditable.vue`, `UploadQueueEditable.vue`,
  `AssetQueueSelectedSidebar.vue`, `src/lib.ts`, `LS/publicExportsAdded.test.ts`; nové testy. Mimo `src`: nič.
- Stráže: bez zmeny `LT/uploadQueueRowStates`, `uploadQueueRowRefresh` (aj prípady U0-L a tvar udalosti `:129-131,172`),
  `uploadQueueItemRefresh` (emituje bez `item`), `queueRowValidation`, `massOperationsValidation`,
  `uploadQueueMassOperations`, `uploadQueueDialogSave`, `uploadQueueDialogDrop`, `LT0/consumerProfile*`. Nové: riadok
  s hodnotami admin-dam (každý slot a vlastnosť); `refreshOffered` nepodaná / `true` / `false` pri každom stave
  (polovica `false` aj v stave, keď vlastné pravidlo „Obnoviť" ponúka); nepodaná vlastnosť po 20 s „Obnoviť"
  ponúkne (stráž `withDefaults: refreshOffered: undefined`; prípad kľúč `refreshOffered` vôbec neuvedie);
  `hideEditOnDuplicate` (ani slot, ani predvolené); zoznam s väzbou bez jediného volania singletonu knižnice; ZK6.
- Pred začatím impl-komp-lib overí, že členy skladov z jadra 3.1 a 3.2 (verzia 11; zmeny PV14a v 3.1 prídu až po U4)
  sú tie, na ktorých stoja komponenty 4 („Vzťah k jadru"; časť 8, bod 7).
- CK-LIB v `lib-u`. Veľkosť: kód asi +400 / −150, testy asi +350. Návrat: N-H v `lib-u`.

**PK3 (`lib-u`; 1,75 h; 1 cyklus; po U4 a 28; vlastník áno 9. 10.).**
- Cieľ: posun zoznamu klávesmi (šípky hore a dole, PageUp, PageDown, Home, End) nereaguje, keď je cieľ udalosti
  v editovateľnom prvku (`input`, `textarea`, `contenteditable`); nález 46.
- Súbory: `L/uploadQueue/components/UploadQueueEditable.vue` (ten istý ako U4, preto hneď po ňom a po 28), nový
  prípad testu: obsluha s cieľom v poli nevolá `preventDefault` a zoznam sa neposunie. Mimo `src`: nič.
- Je to oprava jednej strany, ktorú používateľ v CMS a UGC uvidí; ide do „rozhodnutých zmien" (6.2 komponentov) a do
  changelogu. CK-LIB v `lib-u`. Veľkosť: asi 15 + 40. Návrat: N-H v `lib-u`.

**U7 (LIB po C2; 3,75 h; 2 cykly).**
- Cieľ: jedna funkcia `createDamImage` na deviatich miestach; každé miesto dostane presne dnešný objekt (2.9).
- Súbory: nový `L/imageWidget/utils/damImage.ts`; `L/imageWidget/utils/metadataToImageMap.ts`, `ImageWidgetInner.vue`,
  `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`, `ImageDetailDialogMetadata.vue`, `AImagePublicInput.vue`.
  Mimo `src`: nič. Tie isté súbory mení nález 20 (2.9; v `lib-u` pred I1, inak v LIB pred U7) a po U7 opravy 30, 31
  a 36; nikdy nie súčasne.
- Stráže: bez zmeny `LW/metadataToImageMap` (16), `consumerProfileImageWidgetUpload`, `…MultipleUpload`, `…Library`,
  `ImageWidgetInnerExpandMetadata`, `ImageWidgetMultipleInner`, `ImageMediaWidgetInner`, `ImageWidgetsCopyToLicenceFailure`,
  test miest z U0-L.
- CK-LIB. Veľkosť: +40 / −110. Návrat: N-H.

**U6 (LIB po C2; 6,25 h; 2 až 3 cykly).**
- Cieľ: rámec „obrázok a sidebar", rámec sidebaru, dva adaptéry, `AssetFileInfoPanel`; detail a dialóg jedného súboru
  na nich; vymyslený `AssetDetailItemDto` zanikne (komponenty 2.8). Zblíženia ZK23, ZK25; zalamovanie panela per
  adaptér (JS29): `AssetMetadata` podá `AssetFileInfoPanel` `style="overflow-wrap: normal"`, dialóg jedného súboru nič
  (ZK26 je vypustené, na obrazovke sa nič nemení).
- **Oprava nálezu 64** (rozhodnutie vlastníka 9. 10., overené v prehliadači): v dialógu jedného súboru má obal
  `.position-relative` s obrázkom a prekrytím dnes rozmer 0×0, takže pri odmietnutom súbore sa ikona a text chyby
  prekrývajú v sivom krúžku a závoj nevidno. Rámec dá obalu rozmer (zástupný obrázok a prekrytie dostanú plochu).
  Viditeľná oprava chyby v admin-cms a admin-ugc, zapísať do registra komponentov. Test: nový prípad v
  `LT0/consumerProfileUploadDialogSingle` so skutočným štýlom knižnice pre tento prípad (obal aj prekrytie majú nenulový
  rozmer a prekrytie kryje obrázok); prípad štruktúry z U0-L ostáva bez zmeny.
- **Nález 62** (rozhodnutie vlastníka 9. 10.): `AssetInfobox` v detaile (slot `#prepend` rámca sidebaru) neukáže čip
  dôvodu zlyhania „None", keď je dôvod `none`, ako to dnes robí riadok fronty (`UploadQueueItemEditable.vue:285`).
  Kozmetické zblíženie, do registra komponentov. Test: prípad `AssetInfobox` z U0-L s dôvodom `none` (čip nie je) a
  s iným dôvodom (čip je).
- Popri tom (posudok Codexu I1, len komentár): JSDoc slotu `sidebar` v `L/uploadQueue/components/UploadQueueEditable.vue:50`
  doplniť, že predvolený sidebar ide nad skladom knižnice aj pri podanej väzbe `queue`, takže hostiteľ s vlastným skladom
  podá vlastný sidebar (ako admin-dam); znenie ako v návrhu komponentov 2.3.
- Súbory: nové `L/assetDetail/composables/assetDetailView.ts`, `AssetDetailDialogFrame.vue`, `AssetDetailSidebarFrame.vue`,
  `AssetFileInfoPanel.vue`; zmenené `AssetDetailDialog.vue`, `AssetDetailDialogSidebar.vue`, `AssetMetadata.vue`,
  `L/uploadQueue/components/UploadQueueDialogSingle*.vue` (štyri). Mimo `src`: nič.
- Stráže: bez zmeny `LT/uploadQueueDialogSingle` (21), `LT0/consumerProfileUploadDialogSingle` (34; editor oblasti
  `:412-450` (po U0-L; pred ním `:252-275`)), `LW/consumerProfileImageWidgetUpload` (24), `LT0/damAuthorKeywordEndpoints`, test detailu z U0-L.
- **K-04 (vlastník):** pohľad na dialóg jedného súboru (ZK23; od 9. 10. aj oprava nálezu 64: odmietnutý súbor
  ukáže sivý rámček so závojom chyby) a na detail assetu so širokým obrázkom, napr. 3200×900 (medzera JS9 z U0-L:
  plocha sa nesmie roztiahnuť na šírku obrázka) v ihrisku knižnice: vlastník vo vlastnom termináli
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/tezky.sh yarn --cwd /home/volar/projects/anzusystems/common-admin playground:dev`
  a po pohľade ho sám ukončí (Ctrl+C), čím uvoľní aj zámok. Ihrisko potrebuje bežiaci lokálny core-dam
  (`src/playground/mock/coreDamClient.ts:10`); bez neho výhrada (2.0). Nikdy admin-cms. Bez core-dam sa dá použiť
  postup z overenia nálezu 64 (9. 10.): ihrisko a `playwright-cli` s podvrhnutými odpoveďami DAM a CMS
  (`scratchpad/overenie64/mock.js`, `upload-hold.js`, `upload-fail.js`; súbor sa do widgetu podá udalosťou `drop`).
- CK-LIB. Veľkosť: +280 / −340. Návrat: N-H.

### 2.6 Prenos a kópie: C1, I1, C2, C3 (vedúci)

Každá kópia sa uzavrie celá (všetky jej časti zelené) skôr, než sa v LIB alebo v DAM otvorí ďalší krok.

**C1 (0,5 h).**
- Kedy: K2 uzavretý (LIB na hranici), U0-D uzavretý (DAM na hranici); súhlas vlastníka s `copy.sh` je z 9. 10. Nesie
  aj N32 a N39-L (1.3).
- Postup: CK-LIB z K2 platí (od nej sa LIB nezmenil); `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/kopia.sh C1`;
  `ck-dam.sh vedouci C1` s produkčným kódom DAM nezmeneným od S0-B; výsledok `kopia.sh --stav C1 zelene` (alebo
  `cervene`).
  Až potom P0 a K3.
- Návrat: N-C (N-H K2).

**I1 (0,75 h; 1 cyklus posudku len nad ručne zlúčenými súbormi).**
- Kedy: prvá hranica v `lib-u` po uzavretí K5; U1 a U4 uzavreté; LIB bez otvoreného kroku.
- Postup podľa 3.4: snímok `I1` v LIB, suchý beh `prenos.sh` so základom `lib-u-zaklad/src` a živým `lib-u/src`
  (výstup `zaplaty/I1-triedy.txt`), `--vykonaj`, ručné zlúčenie tried RUCNE (očakávané `src/lib.ts`,
  `src/test/publicExportsAdded.test.ts` a od U4-c5 `src/domains/dam/uploadQueue/composables/uploadQueueMassOperations.ts`:
  LIB po K5 volá `fill*` jadra s `UploadQueueKey`, `lib-u` číta kľúč `MaybeRefOrGetter` pri každom vyplnení; zlúčenie
  berie telo LIB a podpis s `toValue` z `lib-u`), druhý suchý beh, `cmp` koreňových súborov konfigurácie, `ck-lib.sh` v LIB.
  Cesty U0-L vyjdú ako rovnaké na oboch stranách (žiadna trieda). Ak niektorá cesta U0-L vyjde RUCNE (neskorší krok
  v `lib-u`, alebo K4, K5 či krok opravy dopredu v LIB zmenil súbor U0-L), platí: **vyhráva strana, ktorá sa líši od
  `snap/U1/src`**: ak sa od neho líši len `lib-u`, vezme sa `lib-u`; ak len LIB, ostane LIB; ak obe, ručné zlúčenie
  (`cmp` každej strany so `snap/U1/src/<cesta>`, zápis do denníka).
- **Záznam každého ručného zlúčenia:** pre každú cestu RUCNE z `zaplaty/I1-triedy.txt` po jej vyriešení
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/rucne.sh <cesta v src>` (napríklad `lib.ts`) zapíše
  `zaplaty/I1-rucne/<cesta>.diff` s tromi časťami: (1) čo zmenil `lib-u` (základ → `lib-u`), (2) čo mala LIB pred I1
  (základ → snímok `I1`), (3) čo urobilo zlúčenie (snímok `I1` → LIB teraz). **Posudok I1 robia Codex aj Opus nad
  týmito záznamami:** (3) musí priniesť všetko z (1) a zachovať (2); pri ceste U0-L rozhoduje porovnanie so
  `snap/U1/src/<cesta>` (vyššie), ktoré vedúci pridá do zadania posudku. Neúplné zlúčenie sa hľadá tu, nie pri
  odstránení `lib-u` v Z.
- Na konci I1 sa urobí zmrazený snímok `lib-u` (`snimok.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u I1-lib-u`).
  **Od tejto chvíle je `lib-u` zmrazený** (pravidlo): nič sa v ňom nemení a nebeží v ňom žiadny krok ani CK; ostane
  len na kontrolu (čítaním) a odstránenie v Z (bod 8).
- Návrat: N-H (I1).

**C2 (0,75 h; 1 cyklus nad úpravou DAM).**
- Postup: CK-LIB z I1 platí, ak sa LIB odvtedy nezmenil; `kopia.sh C2`; v DAM (impl-dam):
  `snimok.sh /home/volar/projects/anzusystems/admin-dam C2 tsconfig.test.json`; **výslovne** odstrániť augmentáciu
  `ttsAudio` v `/home/volar/projects/anzusystems/admin-dam/src/plugins.d.ts:31-33` a v tej istej úprave opraviť komentár
  `tsconfig.test.json:3-5` (zahrnutie `plugins.d.ts` ostáva); odstránenie overiť pohľadom do súboru (žiadna kontrola ho
  nepripomenie, `skipLibCheck`); `ck-dam.sh impl-dam C2`; výsledok `kopia.sh --stav C2 zelene` (alebo `cervene`);
  posudok. Až potom U6 a K6.
- Návrat: N-H (C2) v DAM; N-C (N-H I1).

**C3 (2,5 h vrátane U8-D a úprav testov DAM).**
- Kedy: DAM na hranici po 38; v LIB uzavreté všetky kroky po C2 (U6 až 43, 1.1).
- Postup: `ck-lib.sh`, ak od posledných CK pribudla zmena; `kopia.sh C3`; v DAM (impl-dam):
  `snimok.sh /home/volar/projects/anzusystems/admin-dam C3`; **U8-D:** úprava `DT/queue/massOperationsRows.test.ts`
  na nové prístupné mená (U8); úpravy testov DAM pre M, F4, 43 a nepovinne PV10 (zoznam v 1.3, každá s dôvodom
  kroku); potom `ck-dam.sh impl-dam C3`; výsledok `kopia.sh --stav C3 zelene` (alebo `cervene`); posudok nad úpravami
  testov.
- Návrat: N-H (C3) v DAM; N-C (N-H posledného kroku LIB).

**C4 (1 h; len ak treba).** Rozhodnutie vlastníka, ktoré mení LIB a príde po C3 (napríklad PV14c, K7a alebo nová
položka): časť LIB ako samostatný krok v LIB, potom C4
rovnako ako C3 (`kopia.sh C4`, snímok `C4` v DAM, prípadná časť DAM rozhodnutia a úpravy testov DAM, `ck-dam.sh`,
`kopia.sh --stav C4 …`).
Ak rozhodnutie príde pred Z, Z sa robí po C4. Ak príde po Z, ale pred posledným zmazaním (PRACA a `lib-u`, Z bod 8),
po C4 sa zopakujú CK oboch stromov, register, beh e2e admin-dam a rozhodnutie o commite. Ak by prišlo až po zmazaní
PRACA, nástroje sa najprv znova zapíšu z prílohy A, založí sa nová PRACA (bez `lib-u`, priečinky podľa 3.2) a stav
nainštalovanej knižnice sa zapíše podľa posledného bodu kópie so zeleným CK-DAM v denníku, napríklad
`printf 'C3 zelene\n' > /home/volar/projects/anzusystems/krok5-praca/balik/nainstalovane.txt` (`zoznam.txt` je potom
prázdny až do prvého uloženia v novej `kopia.sh`). Pri viacerých neskorých rozhodnutiach C5, C6 a ďalej rovnako.

### 2.7 Komponenty v admin-dam: U2, U3, U5a, U5b, U5c (DAM; impl-dam; po K6)

**U2 (2,25 h; 1 až 2 cykly).**
- Cieľ: `D/author/composables/cachedAuthors.ts` a `D/keyword/composables/cachedKeywords.ts` sa stanú preposielačmi
  knižničnej cache; `cachedExtSystemId` sa zapíše v `initCurrentExtSystemAndLicence` po každom zápise aktuálneho
  (`D/asset/composables/currentExtSystem.ts:45,49,54,92`). Mimo `src`: nič.
- Testy: mení sa `DT/cached/cachedChipUnresolved.test.ts` (plugin s `damClient`, ext system cez
  `useExtSystemIdForCached`; náhrada `currentExtSystem` `:17-19` ostáva); ostatné `DT/` bez zmeny.
- Zblíženie: ZK20. CK-DAM. Veľkosť: −93 / +25, test ±20. Návrat: N-H.

**U3 (4,75 h; 2 až 3 cykly).**
- Cieľ: admin-dam mimo uploadu na bloky knižnice (komponenty 2.6); `main.ts` a nový spoločný modul volieb pluginu,
  ktorý číta aj `DT/support/uploadUi.ts:182-185` (R-K5).
- Súbory: 13 súborov s `AssetImage`, `AssetTableRowItem.vue`, `AssetInfobox.vue`, `AssetSlotListItem.vue`,
  `AssetQueueItemList.vue`, päť stránok s chipom autora, `AuthorListView.vue`, `AssetMetadata.vue` (formulár s výslovným
  rozsahom DAM), `AssetLicenceEditForm.vue` (aktuálny ext system), `FileUpload.vue`, `src/App.vue`, `src/main.ts`,
  nový modul volieb, `DT/support/uploadUi.ts`. Mimo `src`: nič.
- Testy: menia sa `DT/queue/slotUploadRow` (tvrdenie na skutočný chip) a `DT/upload/fileValidation` (prepis proti
  `useFormatAndSizeCheck`, ak to stojí menej než pol hodiny; inak ostáva nad súborom, ktorý do U9 zostane na disku);
  testy U0-D bez zmeny; ostatné `DT/` bez zmeny.
- Zblíženia: ZK10, ZK11, ZK13 (časť), ZK14 (päť stránok a výbery v detaile, paneli a licencii), ZK15 (chip autora
  v `AuthorCleanPhraseDetail`), ZK16 až ZK19, ZK21, ZK22, ZK27 (detail). Po U3 sú 4 prípady
  `DT/asset/assetMetadataValidation.test.ts:162-182` (sidebary) prázdne — sidebary už formulár admin-dam nepoužívajú;
  prepis v U5c (posudok Opusa U3).
- Z U1 (posudky 10. 10.): výbery KA/AA v `AssetMetadata.vue` a `AssetLicenceEditForm.vue` prinesú do admin-dam aj
  N-U1-1 (brána vytvorenia pri nenačítanom používateľovi DAM alebo `AllowOwner` bez subjektu zamietne namiesto výnimky;
  vnútorné) a N-U1-2 (chip s podaným titulkom a neznámym id ukáže „nepodarilo sa načítať"; admin-dam dnes mlčí) —
  **N-U1-2 rozhodne vlastník na konci** (pokračuje sa s dnešným správaním knižnice; druhá voľba = malý krok v LIB pred C3; `impl/U1.md`, časť 7).
  Oprava 44 (N44) sa v admin-dam prejaví už v U3 v detaile assetu (detail admin-dam konflikty plní,
  `D/asset/store/assetDetailStore.ts:65`, `AssetMetadata.vue:145`), v riadku fronty až v U5c.
- **K-04 (vlastník):** zástupný obrázok počas nahrávania v dlaždici a riadku (ZK11) v dev serveri admin-dam
  (`bash /home/volar/projects/anzusystems/krok5-praca/nastroje/tezky.sh yarn --cwd /home/volar/projects/anzusystems/admin-dam dev`
  vo vlastnom termináli vlastníka; po pohľade ho sám ukončí).
- Súbory DAM, ktoré stratia importéra, ostanú na disku a musia sa ďalej preložiť (R-K13); zoznam s cestami ide do
  poznámky kroku (pre U9).
- CK-DAM. Veľkosť: asi ±250 v asi 28 súboroch. Návrat: N-H.

**U5a (1,75 h; 1 cyklus).**
- Cieľ: obe prekrytia na `ADamUploadQueueStopButton`. Súbory: `AssetFooterUploadOverlayFull.vue`,
  `AssetFooterUploadSlotsOverlay.vue`. Mimo `src`: nič.
- Testy: `DT/queue/overlaySave`, `slotsOverlay` (len text R10), `DT/upload/uploadStopQuestion` (import, R10),
  `DT/upload/uploadStopConfirm` (prepis alebo nechať do U9), `DT/queue/saveNothing` (jeden `vi.mock`),
  `DT/a11y/iconButtonNames` (súbory 4 → 3, `:95` aj `:149` 9 → 8).
- Zblíženie: ZK9. CK-DAM. Veľkosť: ±60. Návrat: N-H.

**U5b (2,75 h; 1 až 2 cykly).**
- Z U4 (posudok Codexu c4, 10. 10.): v knižnici nik netvrdí, že vo fronte len s ne-obrázkovými typmi chýba všeobecný
  panel sidebaru (knižnica také fronty nemá); U5b pri obale sidebaru admin-dam (fronty so všetkými typmi) to pripne.
- Cieľ: `D/asset/components/queue/AssetQueueSelectedSidebar.vue` ako obal (363 → asi 35). Formulár hromadných
  operácií admin-dam tu stratí posledného importéra; testy, ktoré ho importujú, ho prestanú importovať v tomto kroku
  (komponenty 4.1). Mimo `src`: nič.
- Testy: `DT/queue/massOperationsRows` (R10; do prípadu `:141` pribudne tvrdenie „všetky zapisovateľné polia naraz,
  bez Zobraziť viac"), `DT/queue/customMetadataForms` (vypadnú štyri prípady formulára hromadných operácií, import
  `:253-254`; ich účinok tvrdí `massOperationsRows:141-200`), `DT/asset/assetMetadataValidation` (vypadne prípad
  `:114`; v knižnici ho tvrdí `LT/massOperationsValidation:41`), `massOperationsSidebar` (prepis alebo nechať),
  `DT/a11y/iconButtonNames` (súbory 3 → 1, 8 → 2), `queueRefresh` bez zmeny.
- CK-DAM. Veľkosť: −330 kódu, asi ±100 testov. Návrat: N-H.

**U5c (7,75 h; 3 cykly).**
- Cieľ: `AssetQueueItemEditable.vue` (512 → asi 160, watcher „Obnoviť" presunutý doslova) a `AssetQueueEditable.vue`
  (114 → asi 70) ako obaly; ZK5, ZK13, ZK15, ZK27 (riadok). Mimo `src`: nič. Obal zoznamu ruší vo fronte z udalosti
  riadku ako dnes (`D/asset/components/queue/AssetQueueEditable.vue:56-58`): `cancel: (item, _index, queueId) =>
  store.stopItemUpload(queueId, item)` (tretí parameter väzby od U4-c5; posudok Opusa U4 c6), prípad s iným kľúčom
  udalosti a ohnutie na `props.queueId`.
- Testy (zmeny len z dôvodu v komponentoch 4.1): `queueRowStates` (štyri texty R10), `queueRowActions` (jeden),
  `failReasonChip`, `customMetadataForms` (formulár vlastných metadát z balíka, otočenie `:129-138`, ZK27),
  `DT/asset/assetMetadataValidation` (formulár z balíka, rozsah DAM výslovne, sklad konfigurácie naplnený, `pinned: 0`
  v `:181-186`), `cachedChipUnresolved` (len chip autora, `:164` podľa ZK14; prípad `:215-225` hľadá vysvetlenie v atribúte `title`, chip knižnice vysvetľuje cez `VTooltip` a `aria-describedby`, takže po U5c by ostal zelený naprázdno: prispôsobiť podľa rozhodnutia N-U1-2), `queueRowValidation` (prepis nad
  `uploadUi.ts`), `DT/a11y/iconButtonNames` (2 → 0); prípad U0-D „na duplikáte žiadne tlačidlo úpravy" ostáva zelený;
  `queueListRow`, `queueRefresh`, `overlaySave`, `slotsOverlay`, `lazyMetadata` bez zmeny; `queueRowKeywordsAuthors`
  bez zmeny okrem prípadu konfliktov autora (`:201-229`), ktorý otočí oprava 44 z C2, keď riadok admin-dam začne
  používať výber knižnice (dôvod „nález 44", komponenty 4.5). Posudok N44 (10. 10.): `:212` sa otočí na `['John Doe']`, `:221` na `[]`;
  blok `:224-229` treba vypustiť (po stlačení nezostane chip konfliktu, `conflicts(card)[0]` je `undefined`) a doplniť
  tvrdenie, že po stlačení zmizne aj nadpis (`not.toContain('Author conflicts')`), inak polovica „nadpis zmizne" v admin-dam
  nemá test. Oprava 28 príde do admin-dam až s C3 (od 10. 10. ide v LIB po C2); v U5c sa „Obnoviť" admin-dam ešte nemení.
- **K-14:** selektory e2e admin-dam (`assetBulkEditPage.ts`, `errorPaths.spec.ts`, `assetTtsPage.ts`, `assetTts.spec.ts`)
  porovnať s vykresleným DOM v testoch vlny 4 (agent, čítaním). **K-04 (vlastník):** zoznam fronty na šírke md a
  väčšej (ZK5) a prázdny chip „-" (ZK15; admin-dam ho tu prvý raz ukáže z knižnice) v dev serveri admin-dam, ako
  pri U3.
- CK-DAM vrátane buildu. Veľkosť: −400 kódu, ±200 testov. Návrat: N-H.

### 2.8 U8-L, U8-D a Z

**U8-L (LIB; impl-komp-lib; 1,75 h; 1 až 2 cykly).**
- Cieľ: názov poľa v prístupnom mene „vyplniť prázdne" a „nahradiť všade" (prvá sada, bod 7), strana knižnice.
- Súbory: `L/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue`, `AssetQueueSelectedSidebar.vue`,
  `src/locales/{sk,en,cs}/…` (kľúče s `{field}`); test `LT0/consumerProfileUploadMassOperations` (pomocník `:78`).
  Mimo `src`: nič.
- CK-LIB. Veľkosť: ±50. Návrat: N-H. Do DAM sa dostane až v C3; dovtedy sú testy DAM zelené, lebo DAM má knižnicu z C2.

**U8-D** je súčasť C3 (2.6): `DT/queue/massOperationsRows` na nové mená. e2e admin-dam hľadá podľa mena len tri
tlačidlá dole, tých sa to netýka.

**Z (3 h agentov + vlastník).**
1. `ck-lib.sh` a `ck-dam.sh` s konečnými číslami do denníka.
2. Jeden dokument pre vlastníka `…/krok5/register-zblizeni.md`: oba registre (časť 6 oboch návrhov) so všetkým, čo
   kroky dopísali, a s rozhodnutými zmenami (R10, prvá sada bod 7, R16, PK3, nález 20, M, F2, F4, F5, PV10, PV14a,
   PV14b, PV16, opravy 2.9 vrátane F-A až F-D a nálezov 45, 47 a 50, a opravy pred krokom 5 N32 a N39); z neho návrhy
   textov do changelogov a dokumentácia PV14b (snímky `Z-lib` a `Z-dam` so súbormi mimo `src`: `doc/changelog/2.0.0.md`,
   `doc/guide/installation.md`, `doc/changelog/3.0.0.md`). Zmeny viditeľných textov vypíše podľa zoznamu nižšie (všetky
   schválené) a novú voľbu `copyToLicenceEnabled` opíše v changelogu knižnice. Pripraví aj **odovzdávku pre tím
   admin-ugc**: v jeho konfigurácii DAM vypnúť kópiu do licencie (`copyToLicenceEnabled: false`) s vydaním knižnice;
   do admin-ugc nepíšeme.
3. Dva zoznamy na zmazanie s presnými cestami. **Prvý** (U9a): súbory DAM bez importéra (komponenty 2.10, doplnené
   v U3 až U5c), všetky `node_modules/.cache/vitest-tmp-*` (dnes LIB 6, DAM 5 priečinkov, DAM spolu asi 9 GB),
   prípadné nové pozostatky v `/tmp` (kritérium 5.3, A1) a súbory NAVYSE z N-K, ak nastala. **Posledný**: worktree
   `lib-u` a celá PRACA (nástroje, zámok, snímky, kôš, záplaty, výsledky, uložené balíky, stavy `-zahodene`).
4. **Vlastník** zmaže prvý zoznam jedným príkazom. **Potom znova `ck-dam.sh`** (nástroje a zámok sú ešte v PRACA):
   `vue-tsc` a testy nad zdrojmi (`DT/closeButton`, `sortable`, `layouts/alertHost`, `declaredDependencies`,
   `a11y/iconButtonNames`) čítajú celý `src` (R-K13). **Od tejto chvíle sa DAM opravuje len dopredu:** N-H
   s ktorýmkoľvek snímkom DAM spred zmazania je zakázaný (2.0).
5. Voliteľne U9b (nepoužité kľúče `coreDam.*`, `system.upload.*` v jazykoch admin-dam).
6. **Vlastník** spustí e2e admin-dam (K-14) a rozhodne o commite.
7. Až do posledného zmazania sú možné neskoré rozhodnutia s C4 (2.6); C4 po Z zopakuje CK oboch stromov, register,
   beh e2e a rozhodnutie o commite.
8. **Posledné zmazanie**, až keď vlastník krok 5 uzavrie.
   - **Kontrola `lib-u` pred odstránením** (vedúci):
     `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/kontrola-lib-u.sh` skončí kódom 0. Overí (a) `src`
     v `lib-u` sa zhoduje so zmrazeným snímkom `snap/I1-lib-u/src` (`diff -rq`); (b) každý neignorovaný zmenený alebo
     nový súbor mimo `src` (`git ls-files -m -d -o --exclude-standard` mimo `src`) je ten istý a má ten istý typ, práva
     (`stat -c '%F %a'`) aj obsah (`cmp`) ako pri založení `lib-u` v S0-B (`snap/lib-u-zalozenie`, 3.2); v `src` sa
     porovnajú aj typ a práva každej položky so snímkom (`find -printf '%y %m'`). Mimo `src` sa v `lib-u` nemení nič
     nikdy a od I1 je zmrazený, takže **akýkoľvek rozdiel** je práca, ktorú by `--force` zahodil: stop, výpis skriptu
     ukázať vlastníkovi, `lib-u` sa neodstraňuje. Ignorované súbory (`node_modules`, `.yarn/install-state.gz`,
     vyrovnávacie pamäte) sa nekontrolujú. Neúplné ručné zlúčenie z I1 sa tu nehľadá; zachytil ho posudok I1 nad
     `zaplaty/I1-rucne/` (2.6).
   - Až po čistej kontrole vlastník
     `git -C /home/volar/projects/anzusystems/common-admin worktree remove --force /home/volar/projects/anzusystems/krok5-praca/wt/lib-u`
     (deštruktívna operácia; spustí ju **len vlastník na výslovnú žiadosť**; `git worktree prune` sa nespúšťa, odstránil
     by aj cudzí worktree `…/common-admin-main-sync`), potom PRACA ako celok. Zmazanie PRACA pred odstránením worktree
     by nechalo v gite záznam „prunable", ktorý sa bez `prune` nedá odstrániť.

**Zmeny viditeľných textov** (kroky ich píšu takto; Z ich vypíše vlastníkovi). Všetky znenia schválil vlastník 9. 10.
(denník, „Texty a posledné nálezy, rozhodnutia vlastníka").

| Text | Kde ho uvidí | Krok | Jazyky | Stav |
|---|---|---|---|---|
| potvrdzovacie tlačidlo otázky pri zastavení „Zastaviť" / „Stop" / „Zastavit"; otvárajúce tlačidlo a krížik ostávajú „Zatvoriť" | všetky tri adminy | 43 | sk, en, cs | schválené |
| SK „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný.", EN „The asset file is still being processed. Remove the item and select it again once it is processed." (riadok hromadnej úpravy namiesto formulára) | admin-dam | F5 s F-A | sk, en | schválené |
| SK „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova.", EN „The file is still being processed. You can save once it is processed; then open the asset again." (pri vypnutom „Uložiť") | admin-dam, detail a pravý panel | F-B | sk, en | schválené (presnejšie znenie namiesto „…detail obnovte") |
| SK „Sem sa dá nahrať len jeden súbor; použije sa prvý.", EN „Only one file can be uploaded here; the first one is used.", CS „Sem lze nahrát jen jeden soubor; použije se první." (upozornenie pri pustení viacerých súborov) | admin-cms, admin-ugc (widget obrázka a widget s médiom) | 47 | sk, en, cs | schválené |
| hlášky pri zlyhanom uložení detailu assetu (nález 48) z existujúcich textov, pri 422 jedna | všetky tri adminy | N39-L, N39-D | existujúce | schválené, bez nového textu |
| veta pri vypnutom „Uložiť" v detaile knižnice z existujúceho kľúča `common.damImage.queueItem.stillUploadingOrProcessing` | admin-cms, admin-ugc | F-C | existujúce | nový text netreba |
| hlášky pri zlyhanom hromadnom uložení (neznáma chyba, prístup, vypršanie, validácia s názvami polí) z existujúcich textov | všetky tri adminy | N39-L, N39-D | existujúce | schválené, bez nového textu |
| názov poľa v prístupnom mene „vyplniť prázdne" a „nahradiť všade" (kľúče s `{field}`) | všetky tri adminy (čítačka) | U8-L | sk, en, cs | schválené (prvá sada, bod 7) |
| texty admin-dam podľa knižnice (R10) | admin-dam | U5a až U5c | — | rozhodnuté (komponenty, R10) |

### 2.9 Opravy a rozhodnuté kroky mimo zjednotenia (rozhodnutia vlastníka 9. 10.)

Každý je malý samostatný krok s priebehom 2.0 (snímok, cielené testy, CK, posudok Codexu a Opusu; 1 cyklus, ak nie je
uvedené inak), v strome, ktorý ten kód drží, a **hneď po kroku, ktorý ten kód prepisuje** (komponenty 4.5, jadro 4.1):
nikdy do kroku K alebo U (tie menia správanie len v rozsahu registra) a nikdy súbežne s krokom, ktorý mení ten istý
súbor. Test admin-dam, ktorý oprava v knižnici otočí, sa mení v kroku, ktorý ju do admin-dam prinesie (kópia alebo krok
U, od ktorého admin-dam ten komponent používa), s dôvodom „nález N". Oprava mení správanie len tak, ako ju vlastník
rozhodol; posudok to overí a zmenu zapíše do registra (6.2 komponentov alebo časť 6 jadra); opravy len v admin-dam
mimo zjednotenia (40, 19) register nemajú (`navrh-jadro.md`, časť 6 úvod), zápis je v poznámke kroku a v denníku. Poradie a čas: 1.1 a 1.2.
N32 a N39 sú v 2.1, U-kroky v 2.5 a 2.7.

| Krok | Po kroku | Strom, agent | Čo sa zmení | Testy | Kópia | Odhad |
|---|---|---|---|---|---|---|
| 24 | v U1 | `lib-u`, impl-komp-lib | riadok `uploadStatusFallback: true` v `src/playground/playground.ts:39` preč; profil testov (`LT0/support/consumerProfiles.ts:108,236`) ho drží zámerne | — | C2 | 5 min |
| 44 | U1 | `lib-u`, impl-komp-lib | `L/author/components/AuthorRemoteAutocompleteWithCached.vue:278-294` (po U1; pred ním `:264-280`): ponúkať len konflikty, ktoré ešte nie sú medzi vybranými autormi; keď nezostane žiadny, ani nadpis | nový prípad v knižnici; `LT/uploadQueueDialogSingle.test.ts:437-449` ostáva; admin-dam `DT/queue/queueRowKeywordsAuthors.test.ts:201-229` sa otočí v U5c („nález 44") | C2 | 1 h |
| 28 | U4 | `lib-u`, impl-komp-lib | `createUploadQueueItemRefresh`: „stále sa nahráva alebo spracúva" len pri riadku, ktorý medzitým neskončil ani neodišiel z fronty (podmienka, akú má „nepodarilo sa načítať") | nový prípad v `LT/uploadQueueItemRefresh`; `:125` (po 28 `:129`), `LT0/consumerProfileUploadQueueRows.test.ts:235`, `DT/queue/queueRefresh.test.ts:278-288` ostávajú | C3 (od 10. 10.; LIB po C2) | 0,5 h |
| PK3 (46) | 28 | LIB po C2 (od 10. 10.), impl-komp-lib | 2.5 | 2.5 | C3 | 1,75 h |
| PV16-L | PK3 (kedykoľvek; slot v `lib-u`) | `lib-u`, impl-komp-lib | `src/domains/api/composables/useApiFetchList.ts`: nepovinné `report` vo `FetchListParams` ako v `useApiRequest`; chyba ide zapisovaču len pri `report !== false` (`:182`; jadro 5.2, PV16 možnosť a) | jeden test LIB | C3 (od 10. 10.; LIB po C2) | 1 h |
| nález 20 so 17 | PV16-L, ak sa zmestí pred K5; inak LIB po C2, pred U7 | `lib-u` (alebo LIB), impl-komp-lib | (20) tri volania kópie do licencie (`ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`) dostanú `endPointImage` namiesto `endPointAsset`; čítaním overiť dosah v admin-ugc (UGC API cestu nemá, `/home/volar/projects/petit/admin-ugc/src/main.ts:63`), zistenie do poznámky; (17) zlyhaná kópia ide do hlásenia chýb API ako ostatné požiadavky (`L/api/damImageApi.ts:303-308`) | nový prípad: widget pošle `PATCH /adm/v1/image/copy-to-licence` a kópia uspeje; `LT0/damImageApiCopyToLicence.test.ts:63` a `LW/ImageWidgetsCopyToLicenceFailure.test.ts` sa upravia len tam, kde tvrdia adresu widgetu; 17: zápis do hlásenia | C3 (od 10. 10.; LIB po C2) | 2 h |
| N20V (kópia do licencie) | nález 20, prvý krok LIB po C2 | LIB, impl-komp-lib | voľba konfigurácie DAM `copyToLicenceEnabled` (nepovinná, predvolene zapnutá, typ konfigurácie len pribudne); pri vypnutej výber assetu (`L/assetSelect/components/AAssetSelect.vue`, `AAssetSelectMedia.vue`) prepínač kópie do licencie neukáže a widget (`ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`) kópiu nepošle; admin-cms ju nechá zapnutú (kópia funguje od nálezu 20), admin-ugc ju vypne vo svojej konfigurácii (odovzdávka tímu admin-ugc, 2.8 Z); backendová cesta pre UGC sa nerobí (denník, „Kópia do licencie (9. 10.)") | nové prípady: vypnutá voľba (výber prepínač neukáže; widget nepošle `PATCH /adm/v1/image/copy-to-licence`), predvolená ako dnes; `LS/publicExportsAdded` bez zmeny (len pole typu) | C3 | 1,25 h |
| 33 | hneď po náleze 20: v `lib-u`, ak sa zmestí pred K5 (podľa odhadu nie), inak hneď po N20V | `lib-u` alebo LIB, impl-komp-lib | výber assetu sa po hláške „licencia nie je povolená" neotvorí (`L/assetSelect/components/AAssetSelect.vue:104-107`, `AAssetSelectMedia.vue:102-105`: `modelValue.value = false`) | `LW/consumerProfileImageWidgetLibrary.test.ts:224-240` sa otočí (ten istý test beží pri náleze 20) | C3 (C2, ak bol v `lib-u`) | 1 h |
| 25 | U6 | LIB, impl-komp-lib | dialóg jedného súboru ponúkne „Obnoviť" aj pri zlyhanej položke tam, kde ho ponúka riadok (`Failed`, `refreshMayHelp`, položka má asset); `UploadQueueDialogSingleSidebar.vue` (dnes `:59-88`) | `LT/uploadQueueDialogSingle.test.ts:328-348` sa otočí v `:347`; `:401-412` ostáva, ak `refreshMayHelp` pre ručne zlyhanú položku vráti `false` (overí krok); nový prípad | C3 | 1,5 h |
| M (PV4, PV12, Z28) | K6 uzavretý (a 25) | LIB, impl-jadro-lib; 2 cykly | jeden merač namiesto dnešného vzorkovača a dočasného `speedBaseline` (jadro 2.3 pravidlo 4, 4.1; `analyzy/meranie-rychlosti.md`, časť 4); nahrádza F1 a K2-D4 | LIB: `LT/uploadServiceRetry.test.ts:238-268`, `:270-293`, nový `LT/uploadMeter.test.ts`; DAM v C3 (1.3) | C3 | 4,5 h (+0,5 h v C3) |
| F2 (PV8, Z24) | M (K6) | LIB, impl-jadro-lib | každý riadok dostane pri hromadnom vyplnení vlastnú kópiu zoznamu a hodnoty poľa (`L/uploadQueue/core/uploadQueueFill.ts`) | `LT/uploadQueueMassOperations.test.ts:108` | C3 | 1,5 h |
| F4 (PV13, Z26) | F2 (K6) | LIB, impl-jadro-lib | jadro zastaví beh riadku, ktorý usadzovanie zlyhalo počas posielania; riadok zlyhaný serverom v `catch` behu preskočí (`onClientFailure` nevolá, nič nezapíše ani neohlási; jadro 4.1) | `LT/uploadNotificationEvents.test.ts:461`; DAM `DT/queue/queueOperations.test.ts:231` v C3 | C3 | 2,5 h |
| PV10 (Z30) | F4 (najskôr K5) | LIB, impl-jadro-lib | `uploadedAssetId` v type riadku (nepovinné, továreň `null`); `markAsDuplicate` v `L/uploadQueue/settlement/uploadSettle.ts`, ktorú volajú `markDuplicates` aj `becomeOriginals`, ho zapíše raz (`??=`) pri označení duplikátu (jadro 4.1); nikto ho nečíta | `settlementFixtures.ts` (`settledState`), tvrdenia v `uploadSettle.test.ts` (N-S7, N-S8, N-S11), nový prípad „riadok, ktorý sa stal originálom, si prvú hodnotu nechá"; DAM nepovinne v C3 (posudok PV10: komentár `admin-dam src/test/support/fakeDam.ts:293` „every field the factory gives one" po C3 zastará, riadok `:294-329` doplniť o `uploadedAssetId: null`) | C3 | 1,5 h (+0,25 h v C3) |
| 30 | U7 | LIB, impl-komp-lib | widget nič nezaradí a dialóg uploadu neotvorí, keď po kontrole formátu nezostane súbor (`ImageWidgetInner.vue:344-350`, `ImageMediaWidgetInner.vue:352-358`; pozrieť `ImageWidgetMultipleInner.vue:197-204`); upozornenie ostáva | `LW/consumerProfileImageWidgetUpload.test.ts:276-292` sa otočí; rovnaký prípad pre widget s médiom | C3 | 1 h |
| 31 | 30 | LIB, impl-komp-lib | pozíciu nových obrázkov galérie pri „uložiť a použiť" prideľuje len widget (`ImageWidgetMultipleInner.vue:404-416`); dialóg fronty ju prestane zvyšovať (`UploadQueueDialog.vue:130-140`) | `LW/consumerProfileImageWidgetMultipleUpload.test.ts:329-331` (`[1, 2, 5, 6]` → `[1, 2, 3, 4]`) | C3 | 1 h |
| 36 | 31 | LIB, impl-komp-lib; 1 až 2 cykly | do `createImage`, `updateImage` a `bulkUpdateImages` len polia obrázka (A, A2); widget nečíta obrázok, ktorý práve vytvoril (B; aj tretie miesto `L/imageWidget/components/AImagePublicInput.vue:139,191,211-217`, nález 63, rozhodnutie vlastníka 9. 10.); `mainFileSingleUse` `false` namiesto `null` (C) (`analyzy/nalez36-co-ide-do-api-obrazkov.md`; komponenty 4.5) | komponenty 4.5, riadok 36 (`consumerProfileImageWidgetUpload.test.ts:330,358,444,463`, `:328-336`; nový prípad galérie; `LT0/damAssetApiBulkMetadata.test.ts:99-106`) | C3 | 3 h |
| 45 (IM11) | 36 (U7) | LIB, impl-komp-lib | widget médií pri vybranom assete použije vlastné mapovanie aplikácie `customAssetSelectMetadataToImageMap`, ako `ImageWidgetInner.vue:446-449` (dnes `ImageMediaWidgetInner.vue:565-583`; po U7 cez `createDamImage`) | nový prípad vo widgete médií s vlastným mapovaním | C3 | 1 h |
| F-C s F-D (nález 49) | 45 (po U6 aj U7) | LIB, impl-komp-lib | (F-C) „Uložiť" v detaile knižnice (`L/assetDetail/components/AssetDetailSidebarMetadata.vue:48-90`, obsah záložky „Info"; U6 ho nemení) vypnuté pri assete, ktorý nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored` (vnútorná funkcia pravidla v LIB, nevyváža sa); pri tlačidle veta z **existujúceho** kľúča `common.damImage.queueItem.stillUploadingOrProcessing`; pokryje „Upraviť v DAM" vo výbere aj „Upraviť asset" vo widgetoch; (F-D) widget pri výbere takého assetu bez autorov nezapne pole autorov DAM (`showDamAuthorsInCmsImage` ostane `false`), takže `updateAssetAuthors` nepošle `described: true` (dnes `ImageWidgetInner.vue:458-467`, `ImageMediaWidgetInner.vue:575-581`) (komponenty 5.1, 4.5) | F-C: nové prípady v teste detailu z U0 (`L/assetDetail/__tests__/assetDetailDialog.test.ts`): rizikový asset v každom z troch stavov má „Uložiť" vypnuté a vetu; popísaný, spracovaný, zlyhaný, duplikát a asset bez súboru ho majú zapnuté; F-D: nový prípad pre oba widgety (rizikový asset bez autorov pole autorov DAM nedostane, `updateAssetAuthors` sa nevolá; spracovaný ako dnes) | C3 | 2,5 h |
| 47 | F-C (po U6, 25 a U7: tie isté súbory widgetov) | LIB, impl-komp-lib | widget obrázka aj widget s médiom (`ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, obsluha pustenia, zaradenie `:314`) zaradia z viacerých pustených súborov len prvý a ukážu upozornenie (nový kľúč: SK „Sem sa dá nahrať len jeden súbor; použije sa prvý.", EN „Only one file can be uploaded here; the first one is used.", CS „Sem lze nahrát jen jeden soubor; použije se první."; schválené); dialóg jedného súboru tak dostane vždy jednu položku. `AFileDropzone` sa nemení (používa ho aj galéria a výber assetu) | nový prípad pre oba widgety: dva pustené súbory → vo fronte jeden riadok (prvý), upozornenie, dialóg s jednou položkou; jeden pustený súbor ako dnes; `ImageWidgetCollab`, `ImageMediaWidgetCollab` („two drops") ostávajú | C3 | 1 h |
| PV14a | U8-L (po U6, U7, 25, 47, 30, 31, 36, 45, F-C) | LIB, impl-jadro-lib; 2 cykly | meno konfigurácie vo fronte, `libraryUploadPreset(configName)`, `configOf` sady jadra knižnice, `UploadReadOptions.queueKey` a jeho podanie v usadzovaní, čitatelia skladu, `updateFromDetail(asset, configName?)` (jadro 4.1; 2.3 pravidlo 2, 2.4 pravidlo 10, 3.1) | nový súbor testov LIB (widget pod konfiguráciou `own` vedľa `default`: štart, kúsky, dokončenie, dopyt, notifikácia, „Obnoviť", originál duplikátu); test usadzovania s `queueKey`; testy admin-dam bez zmeny | C3 | 4,5 h |
| PV14b | PV14a | LIB, impl-komp-lib; 2 cykly | `DamConfigNameKey` a `useDamConfigName(explicit?)`; vlastnosť `configName` bez predvoleného `'default'`; meno poskytnú vstupné komponenty, ostatné ho dedia; výbery, tlačidlo z U1 a `AImageMassOperations` s nepovinnou `configName`; `keywordCreateAcl`, `authorCreateAcl` z konfigurácie výberu (komponenty 2.13). Dokumentácia (`doc/changelog/2.0.0.md:70`, `doc/guide/installation.md:62`) sa píše v Z | nový súbor testov pod `own`; prípady `useDamConfigName`; `LT0/damAuthorKeywordEndpoints.test.ts:232-520` prejsť (`:372`, `:414` ostávajú); admin-dam nič neposkytuje, jeho testy bez zmeny | C3 | 5,5 h |
| 43 | PV14b; otvorí sa až po uzavretom U5a | LIB, impl-komp-lib | potvrdzovacie tlačidlo otázky pri zastavení dostane vlastný kľúč (`L/uploadQueue/components/UploadQueueButtonStop.vue:86`; jazyky sk, en, cs): „Zastaviť", „Stop", „Zastavit" (schválené); otvárajúce tlačidlo a krížik ostávajú „Zatvoriť" | `LT/uploadQueueButtonStop.test.ts:53`; DAM v C3 (1.3); K-14: e2e admin-dam klikajú podľa `data-cy`, ten sa nemení | C3 | 1 h |
| N9 (a 8) | K3 (kedykoľvek; čakanie DAM pred C2) | DAM, impl-dam | import z výberu u externého poskytovateľa dá riadku údaje poskytovateľa (`D/externalProvider/composables/externalProviderAssetImport.ts:67`: `metadata: item.externalProviderMetadata ?? {}`); (8) zmazať poznámku „todo add check by type for slot uploads" (`D/asset/components/AssetUpload.vue:57`) | nový prípad v admin-dam | netreba | 1 h |
| 40 | K6 | DAM, impl-dam | hromadné načítanie zapíše do cache mien aj konflikty autorov, nielen autorov (`D/asset/store/uploadQueuesStore.ts:528-535`, po K6 tenký sklad; detail to robí, `assetDetailStore.ts:76`) | nový prípad: chipy konfliktov dostanú mená | netreba | 1 h |
| 19 | 40 | DAM, impl-dam | zastavený import, ktorého požiadavka potom zlyhá, riadok neoznačí za zlyhaný ani neukáže upozornenie (`D/shared/services/upload/externalProviderImportService.ts:33-49` skontroluje `Stop` ako vetva úspechu, `:14`) | nový prípad | netreba | 0,75 h |
| F5 s F-A (PV9, Z29; nález 49) | 19 (K6) | DAM, impl-dam; 2 cykly | (F5) len vlastný kód skladu DAM: pamäť `leftOutByBatch`, hák `onProcessedSeen` (zlyhaný riadok späť na „hotový" s formulárom, ako ho používateľ nechal, alebo text „Metadáta sa nepodarilo načítať"), bod 5: `afterMetadataLoaded` dá „hotový" aj riadku z `metadataFailures`, ktorému metadáta prinesie notifikácia (jadro 4.1; `analyzy/pv9-riadok-hromadnej-upravy.md`, časť 3); (F-A) `fetchLazyAdditionalMetadata` (`D/asset/store/uploadQueuesStore.ts:517-540` pred K6, po K6 tenký sklad `:440-480`) nedá formulár assetu, ktorý nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored` (pravidlo napísané v DAM, `analyzy/nalez49-frontend.md`, 7.1): riadok zlyhá s textom SK „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný.", EN „The asset file is still being processed. Remove the item and select it again once it is processed." (schválené), zapíše sa do `metadataFailures` aj `leftOutByBatch`; tomu, kto asset nahral, ho oživí notifikácia metadát. Uloženie sa nemení (riadok bez formulára do neho nejde) | F5: otočia sa `DT/queue/notificationSettlesQueue.test.ts:219-235` a `DT/queue/slotNotifications.test.ts:773-799`; pribudnú štyri prípady (`notificationSettlesQueue`, `overlaySave`, `queueRowStates`) a tvrdenie stavu v `notificationSettlesQueue.test.ts:603-613`; F-A: `DT/queue/lazyMetadata.test.ts` (spracúvaný, popísaný a spracovaný asset, oživenie notifikáciou) a jeden prípad v `overlaySave.test.ts` | netreba | 4,5 h |
| F-B s nálezom 50 (nález 49) | F5 | DAM, impl-dam; 1 až 2 cykly | (F-B) „Uložiť" v `D/asset/components/detail/components/AssetDetailSidebarMetadata.vue` a `D/asset/components/list/components/AssetListSidebarMetadata.vue` vypnuté pri tom istom pravidle, s vetou SK „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova.", EN „The file is still being processed. You can save once it is processed; then open the asset again." (schválené); (50) uloženie z detailu alebo pravého panela zapíše uložené hodnoty do riadku hromadnej úpravy toho assetu vždy, nielen pri pohľade `queue` (`AssetDetailSidebarMetadata.vue:60-62`; panel dnes nič, `AssetListSidebarMetadata.vue:62-86`), a po hromadnom uložení sa otvorený panel načíta znova (`D/asset/components/footer/AssetFooterSelectedFull.vue:62-79`). Mení, čo pošle neskoršie hromadné uloženie (rozhodnuté) | nové prípady: detail a panel s vypnutým „Uložiť" pri spracúvanom súbore a zapnutým pri spracovanom; riadok hromadnej úpravy po uložení z panela aj z detailu otvoreného zo zoznamu; panel po hromadnom uložení | netreba | 4 h |
| PV16-D | C3 (od 10. 10.; PV16-L ide v LIB po C2) | DAM, impl-dam | dopytovanie distribúcií podá `read(current.signal, failures === 0)` (`D/asset/composables/distributionListPoll.ts:56,102`), karta ho prepošle (`AssetDetailSidebarDistribution.vue:83-85`), `fetchAssetDistributionList` pošle `report` do `execute` (`D/asset/api/distributionApi.ts:42-52`); navyše vynulovanie zoznamu na začiatku čítania **iného assetu** (PV16-D-c1, 11. 10.: `listOfAsset(assetId)` v `distributionListStore.ts`; nulovanie pri každom čítaní by pri zlyhanom obnovení toho istého assetu nechalo prázdny zoznam a zastavilo dopytovanie), aby pod chybou čítania nebol zoznam predošlého assetu (`ostatne-otvorene-nalezy.md`, bod mimo plánu DAM 1-3, „opraviť s PV16") | jeden prípad v `DT/distribution/distributionListPoll.test.ts`; prípad pre `resetList()` | netreba | 1,25 h |
| 38 | U5c | DAM, impl-dam | kôš v obale `D/asset/components/queue/AssetQueueEditable.vue` (obsah slotu `remove` v `AssetQueueItemEditable.vue`) pošle riadok a zoznam odoberie ten riadok (`removeByIndex`), nie prvý s tým assetom | nový prípad: dva riadky jedného assetu, zmazanie na druhom odoberie druhý | netreba | 0,5 h |

**Nález 49** je overený a jeho opravy sú v tabuľke (F-A a F-B v DAM s F5, F-C s F-D v LIB, nález 50 s F-B). F-A, F-B
a nález 50 nie sú v žiadnom návrhu; zdroj je `analyzy/nalez49-frontend.md`, 7.1 a 7.2 (8, bod 16).

**Nález 48** (uloženie detailu assetu) sa opraví v N39-L a N39-D (2.1).

**Zapísané, mimo kroku 5 (vlastník 9. 10.):** nález 52 (nepopísaný asset so spracovaným súborom, do ktorého niekto
nahrá ďalší slot: server znova spustí návrhy a otvorený formulár ich uložením odoberie; pravidlo F-A to nezachytí;
`analyzy/nalez49-frontend.md`, 4.2).

**Mimo projektu:** nález 51 (opačný súbeh v core-dam: spracovanie súboru môže v krátkom okne prepísať práve uložené
metadáta; úloha pre core-dam, `analyzy/nalez49-backend.md`, 4.3).

**Samostatne po kroku 5:** nález 14 (75 ikonových tlačidiel admin-dam bez prístupného mena; strážny test na celý
`src`; 3 až 4 h). PV14c (cache mien na konfiguráciu), až keď ju aplikácia bude potrebovať. Koreň nálezu 49: hromadné
uloženie posiela každé pole, aj nedotknuté, s `described: true`; posielať len zmenené polia je otvorená téma po kroku 5
(asi deň v DAM a rozhodnutie vlastníka, kedy posielať `described: true`; `analyzy/nalez49-frontend.md`, bod 8).

**Voliteľné, vnútorné** (rozhoduje vedúci, nie vlastník): K7a, K7b, K7c, K7e (jadro 4.1); predvolene sa nerobia (K7b
a K7c podľa jadra Q6 a 2.7); ak áno, časť LIB pred C3.

**Uzavreté bez zmeny (9. 10.):** 8 (len zmazanie poznámky „todo" v N9), 13, 16, 18, 22, 26, 27, 35, 37, 42, druhá
polovica 15, body mimo plánu DAM 2, DAM 9, LIB 1 a LIB 2, PV15 (želaný stav); F1 a K2-D4 nahradil M, PV9 je F5, PV14 je
PV14a a PV14b.

---

## 3. Súbežnosť a worktree

### 3.1 Stromy, agenti a súbory

| Strom | Agent | Kroky a súbory |
|---|---|---|
| LIB | impl-komp-lib | pred S0-B: N32, N39-L; po C2: N20V, U6, 25, 47, U7, 30, 31, 36, 45, F-C s F-D, 33, U8-L, PV14b, 43 (a nález 20 so 17, ak sa nezmestil do `lib-u`) |
| LIB | impl-jadro-lib | K1, K2, K4, K5 (súbory v 2.3); po K6: M, F2, F4, PV10, PV14a |
| LIB | testy-lib | nové súbory testov K2 a K4 (počas týchto krokov, disjunktné so súbormi implementátora) |
| LIB | vedúci | S0-A, S0-B, P0, časti LIB v C1 až C3, I1, Z |
| `lib-u` | testy-lib | U0-L |
| `lib-u` | impl-komp-lib | U1 (s 24), 44, U4, 28, PK3, PV16-L, nález 20 so 17 |
| DAM | testy-dam | K0, U0-D |
| DAM | impl-dam | N39-D, K3, N9, časť DAM v C2 a C3 (U8-D a úpravy testov pre M, F4, 43, PV10), K6, 40, 19, F5 s F-A, F-B s 50, PV16-D, U2, U3, U5a, U5b, U5c, 38 |
| DAM | vedúci | časť DAM v C1 |

Strom má v každej chvíli najviac jeden otvorený krok; jeho poradie určuje 1.2 a vedúci. Do I1 menia `src/lib.ts` a
`LS/publicExportsAdded.test.ts` aj kroky jadra v LIB, aj kroky komponentov v `lib-u` (3.3).

Dokumenty: poznámku kroku píše jej agent (jeden súbor na krok); register a denník len vedúci. `doc/` nečíta vitest
(`exclude: doc/**`), oxfmt, linty ani `vue-tsc`, takže zápis do `doc/` počas celých kontrol neprekáža.

### 3.2 Založenie `lib-u`, nástrojov a zámku (nástroje a zámok v S0-A, `lib-u` v S0-B; vedúci)

Nástroje a zámok:

```
mkdir -p /home/volar/projects/anzusystems/krok5-praca/nastroje /home/volar/projects/anzusystems/krok5-praca/wt /home/volar/projects/anzusystems/krok5-praca/snap /home/volar/projects/anzusystems/krok5-praca/kos /home/volar/projects/anzusystems/krok5-praca/zaplaty /home/volar/projects/anzusystems/krok5-praca/vysledky /home/volar/projects/anzusystems/krok5-praca/balik /home/volar/projects/anzusystems/krok5-praca/ohyb /home/volar/projects/anzusystems/krok5-praca/znacky
touch /home/volar/projects/anzusystems/krok5-praca/zamok.lock
```

Skripty z prílohy A sa zapíšu doslova do `NASTROJE` (nástroj Write) a spúšťajú sa vždy cez `bash <celá cesta>`.

Worktree (`--detach`: nevzniká vetva; nič sa necommituje). Kroky 0 až 3 sú v `HEAD` (`03c3a108` alebo novší, ak
vlastník pred S0-B commitne aj opravy), takže `worktree add` prinesie celý `src`; nesledované staršie súbory `doc/` LIB
`lib-u` nepotrebuje:

```
git -C /home/volar/projects/anzusystems/common-admin worktree add --detach /home/volar/projects/anzusystems/krok5-praca/wt/lib-u HEAD
mkdir -p /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/test/scratch
mkdir -p /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/.yarn
cp -p /home/volar/projects/anzusystems/common-admin/.yarn/install-state.gz /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/.yarn/install-state.gz
rsync -a --exclude=/.cache --exclude=/.vite /home/volar/projects/anzusystems/common-admin/node_modules/ /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/node_modules/
```

Len ak opravy N32 a N39 nie sú commitnuté, teda
`git -C /home/volar/projects/anzusystems/common-admin status --short -- src` nie je prázdny, prenesú sa ich zmeny `src`
(prázdnu záplatu by `git apply` odmietol):

```
git -C /home/volar/projects/anzusystems/common-admin diff --binary HEAD -- src > /home/volar/projects/anzusystems/krok5-praca/zaplaty/S0-lib-opravy.patch
git -C /home/volar/projects/anzusystems/krok5-praca/wt/lib-u apply --binary /home/volar/projects/anzusystems/krok5-praca/zaplaty/S0-lib-opravy.patch
git -C /home/volar/projects/anzusystems/common-admin ls-files -z --others --exclude-standard -- src | tar -C /home/volar/projects/anzusystems/common-admin --null -T - -cf /home/volar/projects/anzusystems/krok5-praca/zaplaty/S0-lib-opravy-nove.tar
tar -C /home/volar/projects/anzusystems/krok5-praca/wt/lib-u -xf /home/volar/projects/anzusystems/krok5-praca/zaplaty/S0-lib-opravy-nove.tar
```

`src/test/scratch` je v LIB prázdny priečinok, ktorý git nevidí; bez neho by `diff -rq` nižšie hlásil rozdiel.
`.yarn/install-state.gz` je ignorovaný a Yarn ho pri `run` číta; neobsahuje absolútne cesty LIB, preto stačí kópia
(žiadny `yarn install`).

Overenie (všetko musí sedieť, inak sa `lib-u` nepoužije):

```
diff -rq /home/volar/projects/anzusystems/common-admin/src /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src
for f in package.json vitest.config.mts vitest.config.node.mts tsconfig.json tsconfig.app.json tsconfig.test.json tsconfig.node.json eslint.config.mjs .yarnrc.yml; do cmp /home/volar/projects/anzusystems/common-admin/$f /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/$f; done
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-lib.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u vedouci S0-lib-u T
```

Posledný príkaz beží na pozadí; tesne pred ním sa na pozadí spustí `vzorky.sh` (5.3, B5). Musí ukázať tie isté čísla
ako CK-LIB po N39-L a čisté kontroly. Základ na trojcestný prenos (raz, hneď po overení, pred U0-L):

```
mkdir -p /home/volar/projects/anzusystems/krok5-praca/wt/lib-u-zaklad
cp -a /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src /home/volar/projects/anzusystems/krok5-praca/wt/lib-u-zaklad/src
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/prenos.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u-zaklad/src /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src /home/volar/projects/anzusystems/common-admin/src
```

Posledný príkaz (suchý beh) nesmie vypísať nič. Hneď potom, stále pred U0-L, sa zapíše stav `lib-u` pri založení
(zoznam, typ, práva a obsah každého neignorovaného zmeneného alebo nového súboru mimo `src`; pre kontrolu v Z bod 8):

```
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/zalozenie-lib-u.sh
```

Skript odmietne, ak zápis `snap/lib-u-zalozenie` už existuje alebo ak v `lib-u` chýba sledovaný súbor mimo `src`.
Keďže `lib-u` vznikol z `HEAD` a mimo `src` doňho nič neprišlo, zápis býva prázdny; kontrola v Z bod 8 potom žiada,
aby `lib-u` ostal mimo `src` čistý.
Overovacia CK-LIB-T beží pred ním, takže čokoľvek, čo CK zapíše mimo `src`, je už v zápise (v LIB dnes CK mimo `src`
nič nezapisuje: `git status` mimo `src` ukazuje len `doc/`); ak by neskoršia CK v `lib-u` taký súbor prepísala, Z bod 8
ho ukáže a rozhodne vlastník. `lib-u` leží mimo repozitára LIB, takže ho nečíta vitest, oxlint ani
eslint hlavného stromu. `copy.sh` sa z `lib-u` nespúšťa nikdy. Ak by `lib-u` predsa nebežal: skopírovať
`.yarn/cache` z LIB a `yarn --cwd /home/volar/projects/anzusystems/krok5-praca/wt/lib-u install --immutable` (bez
siete); ak ani to, súbežnosť sa vzdá a komponenty v knižnici idú v LIB po K5 (kritická cesta asi +20 h).

### 3.3 Spoločné súbory

`src/lib.ts` a `LS/publicExportsAdded.test.ts` menia do I1 oba prúdy. Každý píše svoje exporty do vlastného súvislého
bloku s komentárom (`// DAM upload core (step 5)`, `// DAM upload components (step 5)`). Pri I1 ich `prenos.sh`
zaradí ako RUCNE a vedúci vloží prípisy z `lib-u` ručne (Edit) vedľa prípisov jadra. Iné spoločné súbory nie sú
(súpisy v 2.3 a 2.5 sú disjunktné); ak by `prenos.sh` ukázal iný RUCNE, vedúci ho zlúči a zapíše do denníka.

### 3.4 Prenos z `lib-u` (P0, I1; vedúci)

**Trojcestne po každej ceste** nad zjednotením ciest troch stromov `src`, skript `prenos.sh` (príloha A):

| Prenos | Základ | Worktree | Hlavný strom |
|---|---|---|---|
| P0 | `…/wt/lib-u-zaklad/src` | **`…/snap/U1/src`** (otvárací snímok U1 = stav po U0-L; pri opakovaní posledný `U1-oN`) | LIB `src` |
| I1 | `…/wt/lib-u-zaklad/src` | `…/wt/lib-u/src` (na hranici) | LIB `src` |

Pre každú cestu:

| Základ | Worktree | Hlavný strom | Trieda | Čo sa stane |
|---|---|---|---|---|
| je | rovnaký ako základ | ľubovoľne | — | nič (worktree ju nemenil) |
| je | zmenený | rovnaký ako základ | VZIAT | `cp` z worktree do LIB |
| je | zmenený | rovnaký ako worktree | — | nič (už prenesené, napríklad súbory U0-L pri I1) |
| je | zmenený | inak zmenený | RUCNE | ručné zlúčenie, zápis do denníka |
| nie je | je | nie je | NOVY | `mkdir -p` rodiča a `cp` po súboroch |
| nie je | je | je, rovnaký | — | nič |
| nie je | je | je, iný | RUCNE | ručné zlúčenie |
| nie je | nie je | je | — | nič (práca jadra) |
| je | chýba, alebo chýba v LIB | | ZMAZANE | **porušenie pravidla (2.0); prenos sa nevykoná, vedúci zastaví** |

Postup:
1. Zmrazenie: LIB bez otvoreného kroku; pri I1 aj `lib-u` na hranici.
2. `cmp` koreňových súborov konfigurácie medzi LIB a `lib-u` (zoznam v 3.2); musia byť zhodné.
3. `snimok.sh /home/volar/projects/anzusystems/common-admin <P0|I1>`.
4. Suchý beh `prenos.sh` (cesty podľa tabuľky) s výstupom do `…/zaplaty/<P0|I1>-triedy.txt`; skontrolovať, že triedy
   zodpovedajú očakávaniu: pri P0 `diff` s `P0-ocakavane.txt` (suchý beh `prenos.sh` nad zmrazenými snímkami
   `snap/U0-L` a `snap/U1`, 2.2) nič nevypíše; I1 VZIAT a NOVY pre súbory krokov U, RUCNE len pre dva spoločné súbory (a pre súbor
   U0-L, ktorý medzitým zmenila jedna strana: rozhodne `snap/U1`, 2.6).
5. `prenos.sh … --vykonaj`: skopíruje VZIAT a NOVY, každú skopírovanú cestu znova porovná a pri nezhode skončí
   s chybou; ručné zlúčenie RUCNE; pri I1 po každej vyriešenej ceste RUCNE záznam `rucne.sh <cesta>` pre posudok (2.6).
6. Druhý suchý beh: smie vypísať len RUCNE pre ručne zlúčené súbory.
7. CK v LIB (P0: CK-LIB-T, I1: CK-LIB).

Keďže žiadny krok nemaže, LIB po I1 obsahuje každý súbor `lib-u`. Ak by sa `lib-u` predsa po I1 používal ďalej
(plán s tým nepočíta), zosúladil by sa `rsync -a --checksum /home/volar/projects/anzusystems/common-admin/src/ /home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/`
bez `--delete` a zhodu by overil `diff -rq`; presné je to práve preto, že nikto nemaže.

### 3.5 Súbežnosť B

Zrušená: druhý worktree admin-dam počas K6 by obišiel `kopia.sh` (kópia do iného cieľa), potreboval druhý trojcestný
prenos a miešal by zmeny DAM s najrizikovejším krokom; ušetril by asi 7 h.

### 3.6 Zámok, slot, pamäť a behy v prehliadači

- **Jeden obal pre každý ťažký príkaz: `tezky.sh`** (príloha A). Spúšťa sa
  `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/tezky.sh [-w <sekundy>] <príkaz…>` a urobí:
  (1) **najprv zámok** ZAMOK cez `flock -o -E 75 -w <zvyšok času>`; (2) **pod zámkom** pamäťovú bránu `brana.sh`; ak
  neprejde, zámok pustí, počká 15 s a skúša znova; pred každým pokusom, po čakaní, pod zámkom pred bránou aj **po
  návrate brány tesne pred spustením** kontroluje zvyšný čas a **v sekunde lehoty ani po nej príkaz nespustí** (`-ge`);
  čítanie brány je teda vždy čerstvé vo chvíli, keď príkaz začína. Čo sa stalo, zapíše do **značkového súboru**
  (`TEZKY_ZNACKA`, inak `PRACA/znacky/tezky-<PID>`; prepisuje sa, nemaže): `bezi` = príkaz sa spustil a kód je jeho
  (aj 75, 76 či 199); `zamok`, `brana` alebo `cas` = príkaz sa nespustil, `tezky.sh` vypíše dôvod a skončí **76, ak
  brána v tomto volaní aspoň raz neprešla**, inak 75. Každý zápis značky sa overí; **príkaz sa spustí len po úspešnom
  zápise `bezi`**; ak niektorý zápis zlyhá, príkaz sa nespustí a kód je **79**.
  **`kopia.sh`, `ck-lib.sh` a `ck-dam.sh` sa rozhodujú podľa značky, nikdy podľa kódu:** vlastný kód 75 či 76 príkazu
  je pri nich červený výsledok (pri `copy.sh` stav `<bod> pokazene`), nie „skús neskôr"; (3) príkaz spustí bez
  premenných `COMMON_ADMIN_COPY`, `COMMON_ADMIN_TARGETS` a `COMMON_ADMIN_PROJECT` (bez nich `devCopyToAdmins` pri
  builde LIB nič nekopíruje do iných aplikácií a `copy.sh` berie zdroj len z `.env.local`) a so značkou
  `KROK5_TEZKY=1`. Predvolené `-w` je 100 s; skripty CK a `kopia.sh` používajú
  1 800 s.
- **Žiadne vnorenie.** `kopia.sh`, `ck-lib.sh` a `ck-dam.sh` obaľujú svoje príkazy samy a **nikdy sa `tezky.sh`
  neobaľujú** (vonkajší obal by držal zámok a vnútorný by naň čakal, kým by neskončil kódom 75). Ak sa to predsa
  stane, poistka v `tezky.sh` (značka `KROK5_TEZKY`) najprv spracuje `-w` a vnútorný príkaz spustí bez druhého zámku
  a brány (vyskúšané: obalený `ck-lib.sh` aj `kopia.sh` s vnútorným `-w 1800` dobehnú, kód 0).
- **Najviac jeden beh LIB v prehliadači na stroji** (cielený aj celý, v ktoromkoľvek strome) a najviac jeden ťažký
  príkaz: cez `tezky.sh` ide každý beh vitestu v LIB, každý ťažký príkaz v ktoromkoľvek strome (`lint:tsc`, eslint,
  stylelint, build, `generate:dts`, celé testy DAM, `test:eslint`) a servery na pohľad K-04; skripty CK a `kopia.sh`
  takto obaľujú každý svoj príkaz. `-o` zatvorí deskriptor zámku pred spustením príkazu, takže ho nededí yarn, node,
  vitest ani prehliadač; keď sa príkaz nespustil (výpis „Príkaz sa nespustil" alebo „BRÁNA neprešla", kód 75, 76
  alebo 79), je to „skús neskôr", nie červený beh. Bez `tezky.sh` smú bežať len cielené testy DAM (do 15 súborov;
  prostredie node, sekundy), `oxlint` a `oxfmt` na pár súboroch a čítanie.
- **Držiteľ zámku:** `lslocks -o COMMAND,PID,MODE,BLOCKER,PATH | grep -F /home/volar/projects/anzusystems/krok5-praca/zamok.lock`;
  držiteľ má stĺpec BLOCKER prázdny, čakajúci v ňom majú PID držiteľa. Držiteľom je obal `flock`; čo pod ním naozaj
  beží (yarn, vitest, prehliadač), ukáže `pstree -p <PID>`. Zabitím obalu by sa zámok uvoľnil, kým beh pod ním pokračuje;
  preto sa nič nezabíja bez vlastníka (časť 6).
- **Cielené behy** cez `tezky.sh` (predvolene `-w 100`) v nástroji Bash s časovým limitom 600 000 ms; dlhšie behy na
  pozadí. **Celé kontroly** idú vždy na pozadí.
- **Slot od vedúceho** potrebujú celé kontroly (`ck-lib.sh`, `ck-dam.sh`), `kopia.sh`, prenosy a pohľady K-04.
  Agent pošle „SLOT? CK-LIB, K2", vedúci odpovie „SLOT áno" alebo „čakaj", agent po skončení pošle „SLOT voľný"
  s číslami. Počas CK v strome sa v ňom nič neupravuje (okrem `doc/`). **Návrh plánu (z verzie 2):** cielené behy LIB
  v prehliadači slot od vedúceho nepotrebujú, len `tezky.sh`; vylúčenie je rovnako mechanické.
- **Pamäťová brána** (`brana.sh`): `/tmp` aspoň 1 GB voľné, MemAvailable aspoň 3 GB, voľný swap aspoň 1 GB.
  **Upratanie pozostatkov vitestu v `/tmp` je podmienkou S0-A** (splnená 9. 10.; S0-A ju kontroluje): ležia v swape
  (o 03:30 SwapFree 1,6 GB a klesá aj bez behu, posudok Opusu verzie 3), čakaním sa neuvoľnia a bez upratania by brána
  časom zablokovala každý ťažký príkaz.
- **Kalibrácia:** S0-A urobí **nečinné čítanie** brány (`brana.sh`, zapíše sa do denníka) a S0-B počas celej sady
  v prehliadači v `lib-u` vzorky `vzorky.sh` (každých 5 s, sám skončí). Ak minimum počas sady klesne pod
  4 GB MemAvailable alebo 1,5 GB swapu, vedúci smie prahy zvýšiť, **nikdy však nad nečinné čítanie** (inak by brána
  neprešla nikdy); zmenu zapíše do denníka a do `brana.sh`.
- **`test:eslint`** beží bez TMPDIR (s TMPDIR v repozitári padá šesť testov Vite pluginov, denník) a do `/tmp` nechá
  asi 0,6 MB (posudok Opusu verzie 1); brána pred ním kontroluje `/tmp`. Behy LIB v prehliadači píšu do TMPDIR
  v `node_modules`, nie do `/tmp`; prehliadač používa `/dev/shm` (7,9 GB, prázdny).
- Nikdy `yarn ci` ani `yarn lint` (púšťajú veci súbežne).

### 3.7 Riziko konfliktov a ako sa im vyhne

| Riziko | Ako sa mu vyhne |
|---|---|
| Dva kroky v jednom strome (snímok, záplata a návrat by zasiahli cudzí krok) | jeden otvorený krok v strome (2.0) |
| Dva agenti v jednom súbore | vlastníctvo súborov (3.1); v K2 a K4 disjunktné súbory |
| Prenos prepíše prácu jadra alebo pridaný súbor | trojcestný prenos (3.4), RUCNE ručne |
| Prenos polovičného kroku | P0 zo snímku `snap/U1`; I1 len na hranici `lib-u` |
| Zmazaný súbor sa nedá preniesť ani vrátiť | žiadny krok nemaže; ZMAZANE zastaví prenos aj návrat |
| Návrat zmaže prácu neskorších krokov | N-H len pre otvorený alebo posledný uzavretý krok stromu; inak oprava dopredu |
| Kópia počas kroku v DAM; krok v LIB počas kópie | kópia len pri DAM bez otvoreného kroku a celá pred ďalším krokom v LIB |
| Súbežné behy v prehliadači, nedostatok pamäte | `tezky.sh` (brána a zámok) pred každým ťažkým príkazom; upratanie `/tmp` pred S0-A (3.6) |
| Oprava nálezu v kroku, ktorý ten kód prepisuje | opravy idú ako samostatný krok hneď po ňom, v tom istom strome (2.9) |
| Oprava pred krokom 5 a `lib-u` | `lib-u` sa zakladá až po opravách (S0-B), takže ich nevidí ako zmenu jednej strany |

---

## 4. Roly agentov a zadania

### 4.1 Roly

| Agent | Kde | Kroky | Poznámka |
|---|---|---|---|
| vedúci | — | S0-A, S0-B, C1, P0, I1, časti C2 a C3, Z; otvára a uzatvára kroky; slot; spúšťa Codex; zakladá posudkových agentov Opus; zapisuje denník a registre; rozhoduje o krokoch opravy dopredu | jediný, kto spúšťa `kopia.sh` a robí prenosy |
| impl-jadro-lib | LIB | K1, K2, K4, K5; po K6 M, F2, F4, PV10, PV14a | |
| impl-komp-lib | LIB pred S0-B, `lib-u`, po C2 LIB | N32, N39-L; U1 (s 24), 44, U4, 28, PK3, PV16-L, nález 20 so 17; N20V, U6, 25, 47, U7, 30, 31, 36, 45, F-C s F-D, 33, U8-L, PV14b, 43 | |
| impl-dam | DAM | N39-D, K3, N9, časť DAM v C2, K6, 40, 19, F5 s F-A, F-B s 50, PV16-D, U2, U3, U5a, U5b, U5c, 38, U8-D a úpravy testov v C3 | |
| testy-lib | `lib-u`, potom LIB | U0-L; nové súbory testov K2 a K4 (z jadra 4.2) | testy píše z návrhu, nie z kódu implementátora |
| testy-dam | DAM | K0, U0-D | ako testy-lib |
| posudok-opus-<krok>-c<n> | len čítanie | jeden posudok jedného cyklu | vždy nový agent (nezávislý), typ `deep-reviewer` na Opuse |
| Codex | len čítanie | ten istý posudok | `gpt-6-sol`, úsilie high, `--sandbox read-only`, `-c approval_policy="never"`, stdin `/dev/null`; spúšťa vedúci; pri zlyhaní raz znova, potom len Opus |

Otvorené sú najviac tri kroky (jeden v každom strome), teda pracujú najviac štyria agenti naraz (v K2 a K4 dvaja
v LIB), plus posudky.

### 4.2 Spoločný úvod každého zadania (vložiť doslova)

**Doplnok 10. 10. (prestoj 5,5 h):** v príkaze Bash žiadne `cd`, shellové funkcie, slučky, `"$@"`, `eval`, zložité
`$(…)` ani dlhé reťazce `;` — také príkazy si pýtajú potvrdenie vlastníka a zastavia agenta na hodiny. Viackrokové veci
sa zapíšu do skriptu v scratchpade a spustia jedným `bash /cesta/skript.sh`.
**Mazanie (10. 10., vlastník):** väčšinu nočných zastavení v posledných týždňoch spôsobila vstavaná kontrola mazania,
ktorá sa pýta aj pri `--dangerously-skip-permissions`. Cieľ `rm`, `rmdir`, `find -delete` len ako doslovná absolútna
cesta alebo chránená premenná `"${VAR:?}"`; nikdy nechránená `$VAR`, `$(…)` ako cieľ ani po `cd`. Mazanie neschovávať do
skriptu, aby sa kontrole vyhlo; v skriptoch `set -u` a `${VAR:?}`. (Naše príkazy aj tak nič nemažú, 3.x „Mazanie".)

```
Pracuješ na kroku 5 uploadu. Tvoj krok: <X> (plán:
/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md,
časti 2.0, <2.n>, 3.6 a príloha A). Návrh: <navrh-jadro.md časti … | navrh-komponenty.md časti …>.
Strom: <celá cesta>. Tvoje meno pre TMPDIR: <meno>.

Pravidlá (každé vzniklo z incidentu, výnimky nie sú):
1. Shell: len celé cesty, nikdy `cd`. Nikdy `rm`, `rmdir`, `find -delete`, `git clean`, `rsync --delete`. Nič nemaž;
   súbor, ktorý by mal zaniknúť, nechaj a zapíš do poznámky (zmaže ho vlastník v U9). `mv` len do koša pri návrate,
   len príkazmi, ktoré vypíše `navrat.sh` (vlastník to povolil 9. 10.). Nikdy `pkill`; visiaci proces:
   pošli vedúcemu PID a príkazový riadok, nič nezabíjaj.
2. Git len na čítanie: status, diff, log, show. Žiadny commit, push, branch, merge, rebase, stash, checkout, restore,
   reset, apply. Stash a commity v admin-dam sú nedotknuteľné.
3. Do admin-cms a admin-ugc sa nepíše nič. `copy.sh` a `kopia.sh` spúšťa len vedúci.
4. Testy a kontroly:
   - cielené testy DAM (do 15 súborov) smieš bez obalu, s `--retry=0` a
     TMPDIR=/home/volar/projects/anzusystems/admin-dam/node_modules/.cache/vitest-tmp-<meno>;
   - každý beh testov LIB (prehliadač, aj jeden súbor) a každý ťažký príkaz (`lint:tsc`, eslint, stylelint, build,
     celé testy DAM) len cez obal `tezky.sh` (pamäťová brána a zámok), v nástroji Bash s časovým limitom 600000 ms:
     bash /home/volar/projects/anzusystems/krok5-praca/nastroje/tezky.sh env TMPDIR=<strom>/node_modules/.cache/vitest-tmp-<meno> yarn --cwd <strom> vitest run <súbory> --retry=0
     výpis „Príkaz sa nespustil" alebo „BRÁNA neprešla" (kód 75, 76 alebo 79) = príkaz nebežal, nie je to červený beh:
     skús neskôr;
   - celé kontroly len so slotom od vedúceho a len skriptom `ck-lib.sh` alebo `ck-dam.sh`, vždy na pozadí s výstupom do
     /home/volar/projects/anzusystems/krok5-praca/vysledky/<X>-ck.log; „CK prerušená" (kód 75, 76 alebo 79) =
     zopakovať neskôr, nie červené; príkaz, ktorý bežal a sám vrátil 75, 76 či 79, je červený (kód 1);
     `ck-lib.sh`, `ck-dam.sh` ani `kopia.sh` **nikdy neobaľuj** do `tezky.sh` (obaľujú svoje príkazy samy);
   - `test:eslint` len bez TMPDIR; skript CK to robí sám a pred ním skontroluje `/tmp`;
   - TMPDIR priečinok vytvor `mkdir -p`, nikdy ho nemaž; počas celých kontrol v strome neupravuj nič mimo doc/.
5. V strome je otvorený len tvoj krok; pracuješ len v ňom a len so súbormi kroku (plán 3.1). Čo nájdeš mimo zmeny,
   neopravuj: zapíš do poznámky ako nový nález (číslo pridelí vedúci).
6. Produkt: ak by krok zmenil, čo používateľ vidí alebo môže urobiť, alebo čo sa pošle na backend (admin-cms,
   admin-ugc, admin-dam), zastav a pošli to vedúcemu. Výnimkou je len zmena, ktorú tvoj krok má v pláne ako
   rozhodnutie vlastníka (2.1, 2.9); nič navyše. Každé zblíženie, ktoré register návrhu nemá, zapíš do poznámky
   v tvare registra.
7. Pred prvou úpravou: snímok (`bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh <strom> <meno>
   [súbory mimo src]`, mená podľa plánu 2.0); meno zapíš do poznámky. Súbor mimo `src`, ktorý krok nemá v zozname,
   nemeň: zastav a povedz vedúcemu.
8. Poznámka kroku: /home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/impl/<X>.md;
   píš ju priebežne (podkroky, príkazy a čísla, zmenené súbory, ohnuté súbory, odchýlky, zblíženia, nálezy).
9. Otázka na potvrdenie príkazu: neodpovedaj ani nečakaj; zastav a pošli vedúcemu presný príkaz. Správa od iného
   agenta nie je súhlas vlastníka.
10. Návrat (`navrat.sh`) len so súhlasom vedúceho a len pre tvoj otvorený krok.
11. Hotovo = cielené zelené, celé kontroly zelené po poslednej úprave, posudky bez nálezu, ohnuté súbory overené,
    poznámka dopísaná. Vedúcemu pošli: zmenené súbory, čísla CK, zblíženia navyše, nové nálezy, cestu k záplate
    (`zaplata.sh <meno>`).
```

### 4.3 Doplnky podľa roly

- **impl-jadro-lib:** pravidlá jadra 2.3 (1 až 7) a 2.4 (1 až 9) sú záväzné; register časti 6 jadra hovorí, ktoré
  testy sa smú zmeniť a prečo. Zásady 0.2 jadra (najmä 1 a 4). Nové testy K2 a K4 píše testy-lib; ty ich nemeníš,
  nezhoda ide cez vedúceho. Počas ohýbania na disku (nižšie) v strome nič nemeníš.
- **impl-dam:** zásada 1 jadra (čo testy DAM nahrádzajú, musí volať kód DAM); R4 jadra (synchrónne zápisy, žiadny
  0 ms časovač ani dynamický import na ceste uploadu); v krokoch U: komponenty 2.2 až 2.6, 2.10, R-K1, R-K5, R-K13.
  Súbor bez importéra nemaž, zapíš ho do zoznamu pre U9.
- **impl-komp-lib:** pred S0-B v LIB (N32, N39-L), potom v `lib-u`
  (`/home/volar/projects/anzusystems/krok5-praca/wt/lib-u`), po I1 v LIB; poznámky do hlavného stromu. Predvolená
  hodnota každej novej vlastnosti a väzby je dnešná knižnica (komponenty 0.1); mená súborov sa nemenia (R-K8);
  `withDefaults` pri `refreshOffered` (2.2, pravidlo 1). Exporty do vlastného bloku (3.3).
- **testy-lib, testy-dam:** test prejde na nezmenenom kóde; podvrhuj len okraj (HTTP klient, WebSocket, čas), nie
  moduly; identifikátory ber z riadkov, nie z poradia štartov (`lib-vlna4.md`, „A trap…"); v DAM falošný čas po celý
  prípad (`dam-vlna4.md`, časť 3). **Ohýbanie** (dôkaz, že prípad tvrdenia neprítomnosti vie zlyhať):
  - prednostne v pamäti: konfigurácia vitestu v `<strom>/node_modules/.cache/vitest-tmp-<meno>/`, ktorá načíta
    skutočnú konfiguráciu, nastaví `root` na strom a pridá plugin s `transform`, ktorý v jednom produkčnom module
    nahradí presný text (DAM: `dam-vlna4.md`, časť 4; LIB: ak S0-B overí, že to funguje aj v prehliadači); beh
    s ohnutím ide v LIB cez `tezky.sh` ako každý iný beh;
  - na disku len ak v pamäti nefunguje, a len keď v strome pracuješ sám (v K2 a K4 sa implementátor na ten čas
    zastaví): pred ohnutím `cp` súboru do `/home/volar/projects/anzusystems/krok5-praca/ohyb/<X>/<cesta>`, ohnutie
    Editom, beh, vrátenie `cp` z tej kópie, overenie `cmp`; zoznam ohnutých súborov do poznámky; pred každou CK
    `cmp` každého z nich s kópiou.
- **posudok-opus (aj zadanie pre Codex):**
  ```
  Nezávislý posudok kroku <X> uploadu (krok 5). Vstupy: záplata kroku /home/volar/projects/anzusystems/krok5-praca/zaplaty/<meno>.diff
  (alebo záplata opráv <X>-c<n>), časť <2.n> plánu, <časti návrhu>, register v časti 6 návrhu, zoznam stráží kroku.
  Stromy len čítaj; testy nespúšťaj (beží na nich práca a kontroly iných).
  Hľadaj: (1) chyby; (2) čokoľvek, čo zmení, čo používateľ vidí alebo môže urobiť, alebo čo sa pošle na backend,
  v admin-cms, admin-ugc alebo admin-dam (pri oprave nálezu: čokoľvek nad rámec rozhodnutia v časti <2.n>);
  (3) zblíženie, ktoré register nemá, alebo záznam registra, ktorý nesedí; (4) test, ktorý nemôže zlyhať, a zmenu
  testu bez dôvodu z návrhu; (5) porušenie pravidiel návrhu menovaných v časti <2.n>. Oddelene: (6) nálezy mimo tejto zmeny.
  Výstup: číslované nálezy so závažnosťou, súbor:riadok a dôkazom; „bez nálezu", ak nič.
  ```

---

## 5. Východisko a suchý štart

### 5.1 Celé kontroly

Spúšťajú sa len skriptmi (príloha A), vždy na pozadí, s výstupom do `PRACA/vysledky/<krok>-ck.log`:

```
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-lib.sh <strom LIB> <meno> <krok>        # CK-LIB
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-lib.sh <strom LIB> <meno> <krok> T      # CK-LIB-T
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-dam.sh <meno> <krok>                    # CK-DAM
bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-dam.sh <meno> <krok> T                  # CK-DAM-T
```

`<strom LIB>` je `/home/volar/projects/anzusystems/common-admin` alebo `/home/volar/projects/anzusystems/krok5-praca/wt/lib-u`.
Kódy: 0 zelené, 1 červené, 75, 76 alebo 79 = „CK prerušená": príkaz sa nespustil (zámok, lehota, brána, nezapísaná
značka; podľa značky `tezky.sh`, 3.6), zopakovať neskôr. Príkaz, ktorý bežal a sám vrátil 75, 76 či 79, je červený
(kód 1).

| Kontrola | Príkazy (každý cez `tezky.sh`: brána, zámok, bez premenných `COMMON_ADMIN_*`) |
|---|---|
| CK-LIB | `test:browser` (TMPDIR agenta, JSON do `vysledky`), `test:eslint` (bez TMPDIR), `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` |
| CK-LIB-T | to isté bez `lint:stylelint` |
| CK-DAM | `generate:dts`, `test` (TMPDIR agenta, JSON), `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint`, `build` |
| CK-DAM-T | `test`, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint` |

- `lint:tsc` je `vue-tsc --build` nad `tsconfig.json`, ktorý odkazuje aj na `tsconfig.test.json`; `lint:tsc:test`
  z návrhov je v ňom obsiahnutý (časť 8, bod 3).
- `generate:dts` v DAM prepíše len ignorovaný `src/typed-router.d.ts`.
- Build a kópia knižnice: len `kopia.sh <bod>` (príloha A), len vedúci: overí, že `copy.sh` bude kopírovať z LIB
  (`.env.local` ukazuje na LIB; `.env` ukazuje na `/home/admin/projects/anzusystems/common-admin`), uloží nainštalovaný
  balík do `PRACA/balik/<bod>/` (pre N-K), `yarn build` v LIB cez `tezky.sh` (bez `COMMON_ADMIN_COPY`,
  `COMMON_ADMIN_TARGETS`, `COMMON_ADMIN_PROJECT`), kontrola troch súborov `dist`, `copy.sh` **s výslovným cieľom DAM**
  cez `tezky.sh`, kontrola, že výstup menuje presne jeden cieľ; pri zlyhaní `copy.sh` vypíše postup N-K. Či sa build
  a `copy.sh` spustili, rozhoduje značka `tezky.sh`: ak nie (kód 75, 76 alebo 79), v DAM sa nič nezmenilo a stav ostáva;
  ak `copy.sh` bežal a skončil čímkoľvek iným než 0 (aj 75 či 76), stav je `<bod> pokazene` a platí N-K; ak skončil 0
  a výstup nesedí, `<bod> nejasne`.
- `kopia.sh --stav <bod> zelene|cervene` prijme len stav `neoverene` (po kópii) alebo `obnovene` (po N-K). **Po
  `nejasne` vedú ďalej len dve cesty:** nový `kopia.sh <bod>` (po zistení, prečo výstup nesedel) alebo
  `obnova-balika.sh` (N-K); zelené CK-DAM samo stav `nejasne` nezmení (mohlo bežať nad starou knižnicou).
- Trvanie: CK-LIB asi 8 až 10 min (sada v prehliadači 126 s, `test:eslint` krátko; `lint:tsc`, eslint a stylelint
  nemerané), CK-DAM asi 6 až 8 min (testy 25 s).

### 5.2 Východiskové čísla

Ranné čísla (nezmenený kód 18:46 / 18:36) ostávajú na porovnanie. **Východisko kroku 5 sú čísla z posledných CK
opráv:** LIB z CK-LIB po N39-L, DAM z CK-DAM po N39-D; od ranných sa smú líšiť len prípadmi, ktoré pridali alebo
otočili N32 a N39 (vymenované v ich poznámkach). S0-B ich zapíše do denníka a do tejto tabuľky; počet varovaní eslint
je strop.

| Repozitár | Čo | Ráno 9. 10. (pred opravami) | Východisko (S0-B) |
|---|---|---|---|
| LIB (HEAD `03c3a108`, `next`; ten istý kód ako ráno) | `test:browser` | 295 súborov / 3 565 testov, 0 zlyhaných, 126 s | CK-LIB po N39-L |
| LIB | `test:eslint` | 7 súborov / 82 testov, bez TMPDIR; `/tmp` pred aj po 2,2 GB voľných | CK-LIB po N39-L (opravy sa ho netýkajú) |
| LIB | `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint` | čisté 8. 10. 18:36 až 18:49 | CK-LIB po N39-L; `build` v S0-B |
| DAM (HEAD `9818e6b5`, `next`; ten istý kód ako ráno) | `test` | 67 súborov / 1 153 testov, 0 zlyhaných, 25 s | CK-DAM po N39-D |
| DAM | `generate:dts`, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:eslint`, `lint:stylelint`, `build` | čisté 8. 10. 18:36 | CK-DAM po N39-D |
| DAM | nainštalovaná knižnica | bajt po bajte zhodná s `dist` LIB zo `src` 18:46 (posudok Opusu verzie 2) | tá istá (opravy LIB prinesie C1) |
| `lib-u` | CK-LIB-T | — | tie isté čísla ako CK-LIB po N39-L |

Ak S0-B ukáže iné čísla, kódovanie kroku 5 sa nezačne, kým vedúci nezistí prečo. Výstupy JSON z CK opráv a z S0-B sú
zoznam testov, s ktorým sa porovnáva každý neskorší červený beh (časť 6).

### 5.3 Kontrolný zoznam S0-A a S0-B

**Časť A (S0-A, pred opravami).** Body idú v tomto poradí.

1. **Podmienky:** vlastník povedal, že sa začína kódovať. **`/tmp` je upratané** (vlastník 9. 10.: 6,4 GB voľných,
   voľný odkladací priestor 5,9 GB); kontrola ostáva: naprázdno
   ```
   pgrep -fa '[v]itest|[v]ite ' && echo "niečo z testov beží" || find /tmp -maxdepth 1 -mindepth 1 -type d -regextype posix-extended -regex '/tmp/[A-Za-z0-9_-]{21}' -mmin +60 \( -exec test -d '{}/client' \; -o -exec test -d '{}/ssr' \; \) -print
   ```
   nevypíše nič (text hlásenia neobsahuje hľadané slová, takže `pgrep` nenájde sám seba). Ak vypíše priečinky, vlastník
   spustí príkaz z denníka (časť „Dočasné súbory na zmazanie"); agenti ho nespúšťajú (obsahuje `rm`).
2. **Stromy stoja:** `find /home/volar/projects/anzusystems/common-admin/src -newermt '2026-10-08 18:47' -type f` a
   `find /home/volar/projects/anzusystems/admin-dam/src -newermt '2026-10-08 18:37' -type f` nevypíšu nič.
   `git status --short`: LIB len šesť starších nesledovaných položiek `doc/` (`doc/2.0.0-IMPORTY-A-BUNDLE.md`,
   `doc/2.0.0-NAVRHY.md`, `doc/2.0.0-RELEASE-FLOW.md`, `doc/2.0.0-RELEASE-TOOLS-DOCS.md`, `doc/2.0.0-analyza/`,
   `doc/RELEASING.md`), `-- src` prázdne; DAM prázdne. HEAD LIB `03c3a108`, DAM `9818e6b5` (kroky 0 až 3, bez pushu);
   v DAM `git stash list` ukazuje jeden záznam. V LIB je cudzí worktree
   `/tmp/claude-1000/…/0c60a27e…/scratchpad/common-admin-main-sync` (prunable): nedotýkať sa. **Ak `find` niečo
   vypíše**, vedúci zistí prečo skôr, než sa otvorí N32.
3. **Nič nebeží:** `ps -eo pid,etime,args | grep -E 'vitest|vue-tsc|vite build|oxlint|eslint|stylelint|codex' | grep -v grep`
   je prázdne.
4. **Priečinky, zámok, nástroje** (3.2, „Nástroje a zámok"): PRACA so všetkými podpriečinkami vrátane `vysledky/`,
   `zamok.lock` a skripty z prílohy A zapísané doslova. Potom
   `lslocks -o COMMAND,PID,MODE,BLOCKER,PATH | grep -F /home/volar/projects/anzusystems/krok5-praca/zamok.lock` nič
   nevypíše.
5. **Skúška otázok na potvrdenie** (len v PRACA): `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/brana.sh`;
   `touch /home/volar/projects/anzusystems/krok5-praca/kos/probe` a
   `mv /home/volar/projects/anzusystems/krok5-praca/kos/probe /home/volar/projects/anzusystems/krok5-praca/kos/probe2`.
   `mv` do koša pri návrate vlastník povolil 9. 10.; skúška ukáže, či ho nástroj nezastaví otázkou. Ak by otázku
   vypýtalo už `bash <skript>`, nástroje sa nedajú používať bez vlastníka a S0-A sa zastaví.
6. **Nečinné čítanie brány:** `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/brana.sh`, keď nič nebeží;
   výsledok do denníka. Je to strop, nad ktorý sa prahy brány nikdy nezvýšia (3.6). Ak brána neprejde ani teraz, S0-A
   sa zastaví a vedúci to povie vlastníkovi.
7. **Stav nainštalovanej knižnice pre N-K:**
   `printf 'S0 zelene\n' > /home/volar/projects/anzusystems/krok5-praca/balik/nainstalovane.txt` (knižnica v DAM
   prešla ranné testy DAM a kontroly 8. 10.; opravy ju nemenia). Bez tohto súboru `kopia.sh` v C1 odmietne beh.
8. **Codex:** `codex --version` (8. 10.: 0.156.1); model `gpt-6-sol`.
9. **Zadania** pre N32, N39-L a N39-D (4.2, 4.3) pripravené; zámok voľný; denník: S0-A hotové, nečinné čítanie.

**Časť B (S0-B, po opravách).**

1. **Podmienky:** N32, N39-L a N39-D uzavreté (posudky bez nálezu); žiadny otvorený krok. Ak vlastník dal signál na
   commit, je urobený teraz (potom sa N-H opráv už nerobí: ich snímky sú voči starému `HEAD`).
2. **Stav stromov:** `find /home/volar/projects/anzusystems/common-admin/src -newermt '<koniec CK-LIB po N39-L>'
   -type f` a to isté pre `admin-dam/src` s koncom CK-DAM po N39-D nevypíšu nič (inak celé `ck-lib.sh` a `ck-dam.sh` znova).
   `git status --short` (aj `-- src`) a HEAD zapísať ako nové počty: LIB šesť položiek `doc/` a zmeny N32 a N39-L
   v `src`, DAM zmeny N39-D (ak vlastník opravy commitol, len položky `doc/` a nový HEAD); mimo `src` a `doc` sa oproti
   časti A nič nezmenilo.
   Čísla oboch CK do denníka a do 5.2.
3. **Nič nebeží** (ako A3).
4. **`lib-u`:** založenie a kópie súborov podľa 3.2 (bez overovacej CK).
5. **Overenie `lib-u` a vzorky pamäte:** tesne pred CK spustiť na pozadí
   `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/vzorky.sh 1200 /home/volar/projects/anzusystems/krok5-praca/vysledky/S0-pamat.tsv`
   (20 min, skončí sám), hneď potom na pozadí
   `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/ck-lib.sh /home/volar/projects/anzusystems/krok5-praca/wt/lib-u vedouci S0-lib-u T`
   (tie isté čísla ako CK-LIB po N39-L a čisté); potom základ na prenos, suchý beh `prenos.sh` a zápis stavu pri
   založení `zalozenie-lib-u.sh` (3.2). Minimá vzoriek do denníka.
6. **Skúška nástrojov v `lib-u`** (pred U0-L): `snimok.sh` na `lib-u` ako `S0-skuska`, doplnenie riadku komentára do
   jedného súboru v `lib-u/src`, `zaplata.sh S0-skuska` ukáže práve ten rozdiel, `navrat.sh S0-skuska` uloží
   `S0-skuska-zahodene`, vráti strom a ohlási zhodu.
7. **Skúška ohýbania v pamäti v LIB** (cez `tezky.sh`): jeden prípad, napríklad `LT/uploadQueueButtonStop.test.ts`,
   s ohnutím textu v `UploadQueueButtonStop.vue` cez plugin konfigurácie (4.3) musí očervenieť a bez ohnutia byť
   zelený. Výsledok zapísať; ak nefunguje, platí ohýbanie na disku podľa 4.3.
8. **Build LIB** cez `tezky.sh` (`yarn --cwd /home/volar/projects/anzusystems/common-admin build`; CK-LIB build nemá,
   CK-DAM áno).
9. **Citácie:** riadky, ktoré opravy posunuli (2.0, „Riadky"), prepočítať podľa mena prípadu a zapísať do poznámky
   S0-B; zadania krokov ich citujú odtiaľ.
10. **Zadania** agentov kroku 5 (4.2, 4.3) pripravené; zámok voľný; denník: S0-B hotové, čísla, minimá pamäte.

---

## 6. Riziká vykonávania

| Riziko | Príznak | Čo urobiť |
|---|---|---|
| Vedúci vypadne (limit, chyba) — jediný bod zlyhania | nikto neodpovedá na slot, kroky sa neotvárajú | agenti dokončia rozpracovanú úpravu a zastavia sa pri najbližšej žiadosti o slot (CK, kópia, prenos, uzavretie); cielené behy pod zámkom môžu ešte dobehnúť, ale nič sa neuzavrie, neskopíruje ani neprenesie; nič nebeží bez dozoru dlhšie než jeden cielený beh. Nový vedúci pokračuje z denníka, poznámok krokov a snímkov; vlastník sa o výpadku dozvie od prvého agenta, ktorý nedostane odpoveď |
| Červený test, ktorý nie je náš | zlyhá súbor, ktorého sa krok netýka | 1) pustiť ten súbor sám, `--retry=0`, dvakrát; 2) porovnať s výstupom JSON z rána a z posledných CK; 3) `zaplata.sh`: týka sa krok jeho importov? 4) ak je červený aj po N-H otvoreného kroku (stav pred krokom), nie je náš: nový nález, neopravovať; krok sa uzavrie len so súhlasom vedúceho a zápisom v denníku |
| Chyba v staršom, uzavretom kroku | červený beh alebo posudok ukáže príčinu v kroku, ktorý nie je posledný v strome | žiadny N-H toho kroku; vedúci otvorí krok opravy dopredu a zapíše ho do denníka |
| Nestabilný test (LIB v prehliadači pod záťažou) | červený raz, sám zelený | konfigurácia LIB má jedno opakovanie; pustiť samostatne s `--retry=0` trikrát; ak je zelený, je to nestabilita: meno prípadu do poznámky. Ten istý prípad v dvoch krokoch → nový nález. „Page crashed": brána, počkať, znova. V DAM (falošný čas) sa nestabilita berie ako chyba, kým sa nedokáže opak |
| Chyba návrhu zistená pri kódení | návrh predpisuje niečo, čo nejde, alebo test „bez zmeny" musí zmeniť | zastaviť dotknutú časť, dôkaz do poznámky, poslať vedúcemu. Vnútorná vec → záznam do registra a pokračuje sa. Produktová vec → téma pre vlastníka; krok čaká alebo sa vráti (N-H). Návrh sa potichu nemení |
| Agentovi dôjde limit použitia | agent prestane odpovedať | jeho strom stojí, ostatné idú. Vedúci zistí stav (poznámka, `zaplata.sh`, `ps`, `lslocks` na zámok); nový agent pokračuje z poznámky, alebo sa krok vráti (N-H) |
| Objaví sa otázka na potvrdenie | agent čaká na odpoveď | agent hneď pošle vedúcemu presný príkaz a zastaví; vedúci neodpovedá namiesto vlastníka; strom stojí, ostatné idú. (Denník: deväť a pol hodiny stál celý postup pre `rm -rf`.) |
| Visiaci proces | test beží dlhšie než dvojnásobok bežného času | vedúci ukáže vlastníkovi PID a príkazový riadok a spýta sa; nikdy `pkill node` ani `pkill vite` |
| Zámok sa neuvoľňuje | opakovaný kód 75 | `lslocks -o COMMAND,PID,MODE,BLOCKER,PATH` ukáže držiteľa (prázdny BLOCKER), `pstree -p <PID>` čo pod ním beží; ak visí, postup ako pri visiacom procese (obal `flock` sa nezabíja, uvoľnil by zámok pod bežiacim behom); ak je to server pohľadu K-04, počkať na vlastníka |
| `copy.sh` kopíruje odinakiaľ alebo inam | `kopia.sh` odmietne beh alebo hlási iný cieľ (stav `<bod> nejasne`) | `kopia.sh` overuje `.env.local` aj cieľ; ak by kópia predsa išla inam: zastaviť všetko a povedať vlastníkovi, čo sa prepísalo. Zo stavu `nejasne` nevedie `--stav` (ani po zelenom CK-DAM), len nový `kopia.sh <bod>` po zistení príčiny alebo `obnova-balika.sh` |
| `copy.sh` zlyhá uprostred | `kopia.sh` skončí s chybou po zmazaní nainštalovaného `dist` (stav `<bod> pokazene`, aj keď `copy.sh` sám vrátil 75 či 76) | N-K (2.0): `obnova-balika.sh` bez argumentu (najnovšie uloženie so zeleným CK-DAM), potom CK-DAM-T a `kopia.sh --stav <pôvod> zelene`; príčinu zistiť skôr, než sa kópia zopakuje |
| Brána dlho neprejde | kód 76 (brána v čase `-w` aspoň raz neprešla) | žiadna ďalšia ťažká kontrola; pozrieť, čo zaberá pamäť a `/tmp` (`df`, `/proc/meminfo`, `ps`); povedať vlastníkovi. Prahy sa nezvyšujú nad nečinné čítanie z S0-A |
| `vue-tsc` bez pamäte | `heap out of memory` | pustiť znova sám; ak znova, hlásiť |
| Ohnutý súbor ostal na disku | `cmp` s kópiou pred ohnutím nesedí | vrátiť `cp` z kópie, `cmp`; CK sa nespustí, kým nie sú všetky zhodné |
| Prenos ukáže ZMAZANE alebo nečakané RUCNE | `prenos.sh` | ZMAZANE: zastaviť, zistiť, kto mazal (porušenie pravidla), obnoviť súbor zo snímku; RUCNE navyše: vedúci zlúči a zapíše |
| Neúplný snímok | `snimok.sh` skončí s chybou | snímok bez `HOTOVO` sa nepoužíva a nemaže; nový snímok pod ďalším menom (`-o2`) |
| `mv` vypýta potvrdenie | skúška v S0-A | návrat nového súboru čaká na vlastníka a krok ostáva otvorený |
| Vlastník nie je pri K-04 | U3, U5c, U6 hotové | podľa rozhodnutia vlastníka 9. 10.: uzavrieť s výhradou a pohľad urobiť na neskoršej hranici stromu, alebo čakať |
| Posudky nekonvergujú | aj po štvrtom cykle nový nález | vedúci zhrnie vlastníkovi a spýta sa, či pokračovať; nálezy mimo zmeny sa neopravujú |
| Codex zlyhá | chyba alebo prázdny výstup | raz znova; potom len Opus a zapísať to |
| Kópia knižnice zlomí DAM | CK-DAM v bode C červený s nezmeneným DAM | N-C (N-H posledného kroku LIB), alebo krok opravy dopredu, ak je príčina staršia |
| Riadky v návrhoch nesedia | číslo riadku ukazuje inde | hľadať podľa mena prípadu a funkcie; v súboroch opráv N32 a N39 platia riadky prepočítané v S0-B |
| LIB po C2 mešká (kritická dráha, 19 krokov v jednom strome) | C3 sa posúva, DAM čaká na hranici po 38 | poradie v LIB po C2 je voľné okrem väzieb 1.2 (napríklad U7 a jeho opravy pred M, keď K6 mešká); posudok kroku beží, kým vedúci pripravuje ďalší; skrátenie druhým worktree (1.1) rozhodne vedúci |
| CK-DAM v C3 červený | C3 nesie 19 krokov LIB | `zaplata.sh` krokov LIB a `zaplaty/` ukážu, ktorý mení dotknutý kód (najskôr M, F4, PV10, PV14a: jadro, služba a usadzovanie, ktoré admin-dam používa); N-C vráti len posledný krok LIB, staršia príčina = krok opravy dopredu |
| Oprava pred krokom 5 sa natiahne | N39-L v druhom cykle posudku | S0-B a K1 čakajú (kritická cesta); N39-D je nezávislý, DAM potom čaká na S0-B |

---

## 7. Vlastník: rozhodnutia a úlohy, a kedy blokujú

Všetky rozhodnutia pred začatím (V0) a všetky témy návrhov vlastník urobil 9. 10. (denník, štyri časti menované vo
vstupoch, aj texty a posledné nálezy); procesné veci sa mu nepredkladajú. Na jeho rozhodnutie sa nečaká okrem tých,
ktoré vyšli pri implementácii (riadky od 10. 10. nižšie; vlastník ich dá na koniec, nič neblokujú); inak ostáva len „kódime", signál na commit
a jeho úlohy:

| Kedy | Čo | Blokuje | Poznámka |
|---|---|---|---|
| 9. 10., hotové | V0: sedem „na potvrdenie" (PV1, PV2, PV3, PV5, PV6, PV7, PV11), PK3, nález 20, PV16, mazanie nástrojmi projektu (`copy.sh`, `vite build`, `generate:dts`), `mv` do koša pri návrate, uzavretie kroku s výhradou K-04; súhrn zjednotení (F1 → M, F2, F4, ZK5, ZK13, ZK14, ZK15, ZK18, ZK23, vnútorné zjednotenia); témy (M, F5, PV10, PV14a a PV14b, PV15 uzavreté, 25, 36); analýzy (N32, N39, drobné opravy, uzavreté nálezy); nález 49 (F-A až F-D), nálezy 45, 47, 48 a 50, nález 52 mimo kroku 5; texty F-A, F-B, 47 a CS pri 43; voľba kópie do licencie (N20V) | — | 2.9, 2.8 |
| 9. 10., hotové | upratanie `/tmp` (6,4 GB voľných, swap 5,9 GB) | — | S0-A to kontroluje ďalej (5.3, A1) |
| **na konci, pred C3** (vlastník 10. 10.; pôvodne pred I1) | N-U1-2: chip s podaným titulkom, ktorého id DAM nevráti (knižnica „nepodarilo sa načítať", admin-dam mlčí) | nie; pokračuje sa s dnešným správaním knižnice, druhá voľba = malý krok v LIB pred C3 | `impl/U1.md`; posudok U1 c3; U3 prinesie rozdiel do admin-dam, U5c prispôsobí `cachedChipUnresolved.test.ts:215-225` |
| ráno 10. 10. | nález 65 (K5), nález 66 (výbery KA/AA v jednovýberovom režime), nález 9 (N9: ponechať neviditeľnú zmenu) | nie | denník, „Na rozhodnutie vlastníka ráno" |
| pred S0-A | povedať, že sa začína kódovať | všetko | vlastník je pri práci |
| 9. 10., hotové | commit krokov 0 až 3: LIB `03c3a108`, DAM `9818e6b5`, bez pushu | — | denník, „Rozhodnutia vlastníka (9. 10., neskôr)" |
| pred S0-B, alebo až v Z | signál na ďalší commit (opravy N32 a N39, krok 5): len keď nie je otvorený žiadny krok; neskôr až v Z (commit posunie `HEAD`, voči ktorému snímky ukladajú `git status` a `diff HEAD`) | nie | — |
| po U3 | K-04: zástupný obrázok počas nahrávania (ZK11), dev server admin-dam | uzavretie U3 (alebo výhrada) | — |
| po U5c | K-04: zoznam fronty na šírke md a väčšej (ZK5) a prázdny chip „-" (ZK15), dev server admin-dam | uzavretie U5c (alebo výhrada) | — |
| po U6 | K-04: dialóg jedného súboru (ZK23), ihrisko knižnice s lokálnym core-dam | uzavretie U6 (alebo výhrada) | — |
| po C3 | ručná skúška merača (M): fotka okolo 5 MB v admin-cms, video nad 200 MB v admin-dam | nie (odporúčaná) | `analyzy/meranie-rychlosti.md`, časť 7 |
| Z | prvé zmazanie (súbory DAM bez importéra, `vitest-tmp-*`, prípadné nové pozostatky `/tmp`, súbory NAVYSE z N-K) | posledné CK-DAM | — |
| Z | beh e2e admin-dam (K-14) | uzavretie kroku 5 | — |
| Z | texty changelogov, register pre vlastníka, commit (ak nebol pred S0-B) a push | — | — |
| Z (odovzdávka, nie úloha vlastníka) | tím admin-ugc: v konfigurácii DAM admin-ugc vypnúť kópiu do licencie (`copyToLicenceEnabled: false`, jeden riadok) s vydaním knižnice; do admin-ugc nepíšeme | nie | 2.8 Z bod 2 |
| po Z, pred posledným zmazaním | neskoré rozhodnutie, ktoré mení LIB: C4, potom znova CK oboch stromov, register, e2e a rozhodnutie o commite | — | — |
| **posledné, keď vlastník uzavrie krok 5** | po čistej kontrole vedúceho `kontrola-lib-u.sh` (Z bod 8: `src` ako pri I1, mimo `src` ako pri založení; inak rozdiely rozhodne vlastník): `git worktree remove --force` pre `lib-u` (na jeho výslovnú žiadosť, bez `prune`), potom zmazanie PRACA ako celku | — | PRACA až po worktree, inak ostane záznam „prunable" |
| mimo kroku 5 | rozhodnuté 9. 10.: nález 32 len v 2.0 (bez 1.49.x), audit log DAM sa nerieši, úlohy k vypnutiu notification-servera teraz netreba (podklad `analyzy/be-vypnutie-notifikacii.md`); nález 14 a koreň nálezu 49 (posielať len zmenené polia) po kroku 5; nález 51 je úloha core-dam | nie | — |
| pred vydaním (kontroly v Azure nie teraz, vlastník 9. 10.) | hodnota `admin-dam-sentry-dsn` v Azure, nasadené `APP_SIZE_*_CHUNK_SIZE`, verzia backendu v produkcii; e2e a ručný upload dvoch súborov v CMS a UGC z krokov 0 až 3 | nie | — |

**Neplánovaný bod:** krok, ktorý by zmenil produkt nad rámec rozhodnutia, sa zastaví a vráti; vtedy rozhoduje
vlastník.

---

## 8. Nezrovnalosti medzi návrhmi (zistené pri plánovaní)

Žiadna neblokuje; plán ich rieši tak, ako je uvedené.

1. **PV10 a časť 4** (vyriešené). Jadro do verzie 10.3 písalo, že časť 4 bude pole `uploadedAssetId` potrebovať;
   návrh komponentov nechal kôš každej strane (slot `remove`, RD9). Jadro 11 vetu opravilo a vlastník 9. 10. rozhodol
   pole zjednotiť (krok PV10, 2.9); časť 4 ho nepotrebuje.
2. **Čo sú „celé kontroly" knižnice.** Jadro 4.1 menuje sadu `src/domains/dam` a `src/test`; východisko (295
   súborov) je celá sada `yarn test:browser`. Plán berie celú sadu.
3. **`lint:tsc:test`.** Obe návrhy chcú `yarn lint:tsc` aj `yarn lint:tsc:test`; prvé je `vue-tsc --build` nad
   `tsconfig.json`, ktorý odkazuje aj na `tsconfig.test.json`, takže druhé je v ňom. Plán púšťa len prvé.
4. **Kópie.** Jadro má dve (po K2, po K5), komponenty štyri (po U1, U4, U7, U8). Plán má tri (C1, C2, C3; 1.3).
5. **Changelog a register na konci** sú v oboch návrhoch (K7d, U9c, U9d); plán z nich robí jeden krok Z a jeden
   dokument pre vlastníka.
6. **„Na potvrdenie" a poradie.** Jadro robí sedem zblížení „na potvrdenie" vnútri K2 až K6 a potvrdenie čaká až po
   nich. Vlastník ich potvrdil 9. 10. pred K2 (časť 7).
7. **Komponenty stoja na jadre verzie 6** (úvod komponentov), jadro je vo verzii 11. Zmeny 7 až 10.3 sa týkali PV3,
   PV5, PV13, PV16, Z9, Z17, Z23, Z26 a znenia, nie členov skladov; jadro 11 mení 3.1 pre PV14a (meno konfigurácie vo
   fronte, čitatelia skladu), čo príde až krokom PV14a po U4. Pred U4 to impl-komp-lib overí (2.5).
8. **Pohľad K-04:** komponenty 4.4 hovoria „krok neskončí, kým ju neukáže"; plán navrhuje výhradu (2.0).
9. **Drobnosti znenia:** jadro 3.3 má body v poradí 10, 12, 11; denník (časť „Krok 5: stav") ešte uvádza väzby DAM
   „asi 75 a 40 riadkov", jadro asi 95 a 345 (celý `fileApi.ts`).
10. **Nález 43 „po U5a"** (komponenty 4.5): zmena je v knižnici a do admin-dam ju prinesie až C3, takže v LIB smie ísť
    kedykoľvek pred C3. Plán ju otvorí až po uzavretom U5a, ako ju vlastník zaradil (testy DAM otočí C3).
11. **PV16 „kedykoľvek, nezávisle"** (jadro 4.1): časť admin-dam potrebuje `report` z `useApiFetchList`, teda kópiu.
    Plán dáva časť LIB do voľného miesta v `lib-u` (C2) a časť DAM po C2.
12. **Dokumentácia PV14b** (komponenty 2.13) je mimo `src`; podľa pravidla 2.0 ju píše Z.
13. **Analýza nálezov 39 a 29** odhaduje LIB 1,5 h a DAM 1,5 h bez voliteľných častí; s názvami polí pri 422, točením
    a uložením autorov galérie (všetko rozhodnuté) je to 3,75 h a 2,5 h (analýza 5.8, denník bod 2).
14. **F5, F-A, F-B a nález 50** (analýza nálezu 49, 7.2) majú byť jeden krok DAM po K6. Spolu by mal asi 8,5 h
    a dve veci (sklad hromadnej úpravy a uloženie detailu a panela), preto plán robí dva kroky za sebou: F5 s F-A
    (ten istý hák a `metadataFailures`) a hneď po ňom F-B s nálezom 50 (tie isté dva súbory detailu a panela). Odhad
    zo súčtu analýz (8,5 až 10,5 h) je znížený o spoločné kontroly a posudky.
15. **F-C a F-D „po U6":** F-D mení výber assetu vo widgetoch, ktoré prepisuje U7, preto plán dáva F-C s F-D po U7
    a jeho opravách (po náleze 45), stále pred PV14a; komponenty 5.1 to pripúšťajú („spolu s F-C").
16. **F-A, F-B a nález 50** nie sú v žiadnom návrhu: komponenty 5.1 ich výslovne nechávajú admin-dam a jadro 11
    skončilo pred rozhodnutím o náleze 49. Krok stojí na `analyzy/nalez49-frontend.md`, 7.1 a 7.2, a na denníku;
    posudok ho overí proti nim.
17. **Voľba kópie do licencie „s nálezom 20"** (denník): krok nálezu 20 je v `lib-u` a voľba by sa tam pred K5 už
    nezmestila. Plán ju robí ako N20V, prvý krok LIB po C2; je to lacnejšie (+1,25 h) než celý krok nálezu 20 v LIB
    (+3,25 h) a rovnako drahé ako čakanie I1.

## 9. Čo som neoveril

- V repozitároch som nič nespúšťal okrem nečinných príkazov (git na čítanie, `find`, `df`, `/proc/meminfo`, `ps`,
  `du`, `flock --help`, `lslocks --list-columns`). Všetky skripty v prílohe A prešli `bash -n`. Na pokusných
  kópiách v scratchpade sedenia (cesty PRACA, LIB a admin-dam presmerované do scratchpadu; `yarn`, `copy.sh` a pri
  `navrat.sh`, `zalozenie-lib-u.sh` a `kontrola-lib-u.sh` aj `git` a pri lehote aj `date` nahradené pokusnými
  skriptmi) som vyskúšal: `prenos.sh` (triedy, `--vykonaj`, overenie po kópii, ZMAZANE); `navrat.sh` (overenia pred
  výpisom `mv`, nové položky, obnova a nová cesta `-zahodene` pri troch návratoch v tej istej sekunde; pritom sa
  ukázalo, že `rsync -a` bez `--checksum` súbor s rovnakou veľkosťou a časom neobnoví, opravené).
  Verzia 7: `tezky.sh` (kód príkazu 0, 7, 75, 76 aj 199 prejde po jednom behu so značkou `bezi`; poistka vnorenia
  s `-w 1800` a `TEZKY_ZNACKA` → `bezi`, `COMMON_ADMIN_*` odstránené; zámok držaný inde → 75, značka `zamok`, bez
  behu; brána nikdy neprejde → 76 po 15 s, značka `brana`, zámok počas čakania voľný, bez behu; brána raz neprejde
  a potom zámok držaný inde až po lehotu → **76** (nie 75), bez behu; pod zámkom presne sekunda lehoty (pokusný
  `date`) → 75, značka `cas`, bez behu, kým verzia 6 v tej istej situácii príkaz spustila; `-w 0` → 75 bez behu;
  brána prejde na druhý pokus → jeden beh s vlastným kódom 9); `ck-lib.sh` a `ck-dam.sh` (každý `yarn` vráti 75
  alebo 76 → všetky príkazy bežali, výsledok ČERVENÉ, kód 1; zámok držaný inde alebo brána nikdy neprejde → „CK
  prerušená", kód 75 alebo 76, nič nebežalo; zelené `ck-dam.sh … T`; obalený `ck-lib.sh` → 0); `kopia.sh` (bežná
  kópia → `neoverene`; `copy.sh` zmení DAM a vráti 75 alebo 76 → `<bod> pokazene`, kód 1, výpis N-K; build sám vráti
  75 alebo 1 → stav bez zmeny, DAM bez zmeny, kód 1; build sa nespustí pre zámok → 75, stav aj DAM bez zmeny; build
  bežal a pred `copy.sh` brána neprejde → 76, `copy.sh` nebežal, stav bez zmeny; nesediaci výstup → `nejasne`;
  `--stav` prijatý zo stavu `neoverene` a `obnovene`, odmietnutý z `nejasne`, `pokazene`, `zelene` aj `cervene`;
  z `nejasne` cez `obnova-balika.sh` → `obnovene` → `--stav` prijatý, cez nový `kopia.sh` → `neoverene` → `--stav`
  prijatý; obalený `kopia.sh` → 0); `zalozenie-lib-u.sh` a `kontrola-lib-u.sh` (čistý `lib-u` → 0; iný obsah
  súboru mimo `src` pri rovnakom zozname → 1, „Iný obsah"; nový súbor mimo `src` → 1; zmena v `src` → 1; po vrátení
  → 0; chýbajúci sledovaný súbor pri založení → odmietnuté bez `HOTOVO`; prázdny zoznam → 0; druhé založenie
  odmietnuté); `rucne.sh` (so skutočným `git diff --no-index`: tri časti pri ceste so základom aj pri ceste bez
  základu; chýbajúca strana → 1; nezapísateľný výstup → 1 s hlásením). Z verzie 6 platí: obalené skripty s vnútorným
  `-w 1800`, dve uloženia `kopia.sh` v tej istej sekunde do rôznych ciest, `obnova-balika.sh` (najnovšie zelené
  uloženie, nejasné a červené nie; súbor s dvoma odkazmi neprepíše).
  Verzia 7.1 (pri `tezky.sh` celá sada verzie 7 zopakovaná s rovnakým výsledkom, vlastný kód 79 príkazu prejde so
  značkou `bezi`): brána skončí po lehote (`-w 3`, brána 4 s) → 75, značka `cas`, bez behu, kým verzia 7 príkaz
  spustila; značka sa nedá zapísať od začiatku, pri vnorení, pri zápise `bezi` po prejdenej bráne aj pri zápise
  `zamok` po vypršanom čakaní → 79, bez behu; stará značka `bezi` len na čítanie pri `-w 0` → 79, bez behu;
  `ck-dam.sh` so značkou tretieho kroku len na čítanie → dva príkazy bežali, „CK prerušená", 79; `ck-lib.sh`, keď
  každý `yarn` vráti 79 → ČERVENÉ, kód 1; `kopia.sh` so značkou kroku `copy.sh` len na čítanie → build bežal,
  `copy.sh` nie, 79, stav aj DAM bez zmeny; `copy.sh` zmení DAM a vráti 79 → `pokazene`; obalené `ck-lib.sh`
  a `kopia.sh` → 0; `kontrola-lib-u.sh`: čistý → 0, právo spúšťania na súbore mimo `src` pri rovnakom obsahu → 1,
  súbor mimo `src` nahradený symbolickým odkazom na rovnaký obsah → 1, právo spúšťania v `src` → 1, zmena obsahu
  → 1, späť → 0, zápis bez `mimo-src.stat` → odmietnuté; `zalozenie-lib-u.sh` so súborom v zozname, na ktorom
  `stat` zlyhá → 1 bez `HOTOVO`. Ostatné vyskúšajú S0-A a S0-B (5.3).
- Cykly posudkov plánu uzavreté po siedmom kole; posledné nálezy boli okrajové prípady pomocných skriptov, opravené
  v 7.1 bez ďalšieho posudku.
- Že `rsync` kópia `node_modules` s `.yarn/install-state.gz` stačí na beh prehliadača a `vue-tsc` v `lib-u` (S0-B).
- Že ohýbanie v pamäti funguje v režime prehliadača LIB (S0-B, bod 7).
- Že `bash <skript>` a `mv` nevypýtajú potvrdenie (S0-A, bod 5).
- Že ihrisko knižnice ukáže dialóg jedného súboru; potrebuje bežiaci lokálny core-dam (`src/playground/mock/coreDamClient.ts:10`).
- Trvanie `lint:tsc`, eslint, stylelint a buildov (odhad v 5.1) a špička pamäte počas celej sady (S0-B, „Kalibrácia").
- Odhady času sú z tempa práce 7. a 8. 10.; najväčšia neistota sú počty cyklov posudkov pri K6, U5c, M a PV14b.
  Odhady nových krokov sú z analýz v `analyzy/` a z návrhov (jadro 4.1, komponenty 4.5); nevyskúšal som ich.
- Verzie 8 a 9 sú obsahové (rozhodnutia vlastníka 9. 10.); nástroje a ich pokusné behy sa nemenili. Čísla po opravách
  a riadky, ktoré opravy posunú, zapíše S0-B.

---

## Príloha A: nástroje (`/home/volar/projects/anzusystems/krok5-praca/nastroje/`)

Zapíšu sa doslova v S0-A a spúšťajú sa `bash <celá cesta> …`. Naše skripty nič nemažú, samy nič nepresúvajú a nerobia
`cd`; mažú len nástroje projektu, ktoré spúšťajú cez `tezky.sh` (`copy.sh`, `vite build`, `generate:dts`), a to s
povolením vlastníka (2.0, „Mazanie"). `navrat.sh` len vypisuje príkazy `mv`, ktoré sa vykonajú, ak ich vlastník povolil.
Pokusné behy všetkých skriptov okrem `vzorky.sh` (ten prešiel len `bash -n`) sú opísané v časti 9; prebehli na kópiách v
scratchpade sedenia 9. 10. v noci a ráno. „S0" v komentároch skriptov znamená S0-A a S0-B. `zalozenie-lib-u.sh` sa
spúšťa raz v S0-B (3.2), `rucne.sh` pri I1 (2.6), `kontrola-lib-u.sh` v Z bod 8.

### `brana.sh`

```bash
#!/bin/bash
# Pamäťová brána pred ťažkým príkazom: /tmp aspoň 1 GB voľné, MemAvailable aspoň 3 GB, voľný swap aspoň 1 GB.
# Kód 0 = prejde, 1 = neprejde.
t=$(df --output=avail -m /tmp | tail -1 | tr -d ' ')
m=$(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo)
s=$(awk '/^SwapFree:/{print int($2/1024)}' /proc/meminfo)
echo "brána: /tmp ${t} MB, MemAvailable ${m} MB, swap voľný ${s} MB"
[ "$t" -ge 1024 ] && [ "$m" -ge 3072 ] && [ "$s" -ge 1024 ]
```

### `tezky.sh`

```bash
#!/bin/bash
# Obal každého ťažkého príkazu (plán 3.6): najprv zámok, pod ním pamäťová brána, potom príkaz bez premenných
# COMMON_ADMIN_*. Neobaľuje sa ním kopia.sh, ck-lib.sh ani ck-dam.sh (obaľujú svoje príkazy samy).
# Použitie: [TEZKY_ZNACKA=<súbor>] bash tezky.sh [-w <sekundy>] <príkaz> [argumenty…]     (predvolene -w 100)
# Značkový súbor (TEZKY_ZNACKA, inak PRACA/znacky/tezky-<PID>) povie volajúcemu, čo sa stalo: „bezi" = príkaz sa
# spustil a kód je jeho; „zamok", „brana" alebo „cas" = príkaz sa nespustil (skús neskôr). Volajúci sa rozhoduje
# podľa značky, nie podľa kódu. Príkaz sa spustí len po úspešnom zápise „bezi". Kód, keď sa príkaz nespustil:
# 79, ak sa značka nedala zapísať; 76, ak brána v tomto volaní aspoň raz neprešla; inak 75.
# (79 je mimo kódov sysexits, ktoré flock používa pre vlastné chyby.)
set -uo pipefail
P=/home/volar/projects/anzusystems/krok5-praca
W=100
if [ "${1:-}" = -w ]; then W=$2; shift 2; fi
if [ "$#" -eq 0 ]; then echo "Chýba príkaz." >&2; exit 2; fi
mkdir -p "$P/znacky" || exit 2
M=${TEZKY_ZNACKA:-$P/znacky/tezky-$$}
znac() {  # znac <obsah>: zápis značky; ak zlyhá, príkaz sa nespustí
  if ! printf '%s' "$1" > "$M"; then echo "Príkaz sa nespustil: značku $M sa nepodarilo zapísať." >&2; exit 79; fi
}
# Poistka vnorenia: pod iným tezky.sh už zámok aj brána sú; príkaz sa len spustí.
if [ -n "${KROK5_TEZKY:-}" ]; then
  znac bezi
  exec env -u COMMON_ADMIN_COPY -u COMMON_ADMIN_TARGETS -u COMMON_ADMIN_PROJECT -u TEZKY_ZNACKA "$@"
fi
koniec=$(( $(date +%s) + W ))
brana_neprisla=0
nespustene() {  # nespustene <značka>
  znac "$1"
  if [ "$brana_neprisla" = 1 ]; then echo "BRÁNA neprešla do $W s, príkaz sa nespustil ($1): skús neskôr a povedz vedúcemu." >&2; exit 76; fi
  if [ "$1" = cas ]; then echo "Príkaz sa nespustil (cas): lehota $W s uplynula; skús neskôr." >&2
  else echo "Príkaz sa nespustil ($1): zámok sa do $W s neuvoľnil; skús neskôr." >&2; fi
  exit 75
}
while :; do
  zostava=$(( koniec - $(date +%s) ))
  if [ "$zostava" -le 0 ]; then nespustene cas; fi
  znac ""
  rc=0
  # Bez COMMON_ADMIN_COPY a COMMON_ADMIN_TARGETS build LIB nič nekopíruje do iných aplikácií (devCopyToAdmins);
  # bez COMMON_ADMIN_PROJECT berie copy.sh zdroj len z .env.local.
  # Pod zámkom: lehota pred bránou aj po nej, tesne pred zápisom „bezi" a spustením; každý zápis značky overený.
  env -u COMMON_ADMIN_COPY -u COMMON_ADMIN_TARGETS -u COMMON_ADMIN_PROJECT -u TEZKY_ZNACKA KROK5_TEZKY=1 \
    flock -o -E 75 -w "$zostava" "$P/zamok.lock" \
    bash -c 'P=$1; M=$2; K=$3; shift 3
      z() { printf "%s" "$1" > "$M" || exit 79; }
      if [ "$(date +%s)" -ge "$K" ]; then z cas; exit 1; fi
      if ! bash "$P/nastroje/brana.sh" >&2; then z brana; exit 1; fi
      if [ "$(date +%s)" -ge "$K" ]; then z cas; exit 1; fi
      z bezi
      exec "$@"' _ "$P" "$M" "$koniec" "$@" || rc=$?
  znacka=$(cat "$M")
  if [ "$znacka" = bezi ]; then exit "$rc"; fi
  if [ "$rc" = 79 ]; then echo "Príkaz sa nespustil: značku $M sa nepodarilo zapísať." >&2; exit 79; fi
  case "$znacka" in
    "") nespustene zamok ;;
    cas) nespustene cas ;;
    brana) brana_neprisla=1 ;;
  esac
  if [ $(( koniec - $(date +%s) )) -le 15 ]; then nespustene brana; fi
  sleep 15
done
```

### `vzorky.sh`

```bash
#!/bin/bash
# Vzorky pamäte každých 5 s počas zadaného počtu sekúnd; skončí sám. Spúšťa sa na pozadí.
# Použitie: bash vzorky.sh <sekundy> <výstup.tsv>
set -euo pipefail
N=$1; O=$2
printf 'cas\ttmp_volne_mb\tmemavailable_mb\tswap_volny_mb\n' > "$O"
koniec=$(( $(date +%s) + N ))
while [ "$(date +%s)" -lt "$koniec" ]; do
  printf '%s\t%s\t%s\t%s\n' "$(date +%H:%M:%S)" "$(df --output=avail -m /tmp | tail -1 | tr -d ' ')" \
    "$(awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo)" "$(awk '/^SwapFree:/{print int($2/1024)}' /proc/meminfo)" >> "$O"
  sleep 5
done
awk -F'\t' 'NR > 1 { if (t == "" || $2 < t) t = $2; if (m == "" || $3 < m) m = $3; if (s == "" || $4 < s) s = $4 }
  END { print "minimá: /tmp " t " MB, MemAvailable " m " MB, swap " s " MB" }' "$O"
```

### `snimok.sh`

```bash
#!/bin/bash
# Snímok pred krokom. Použitie: bash snimok.sh <strom> <meno snímku> [súbor mimo src, relatívne k stromu]...
# Mená (plán 2.0): K2; po návrate alebo neúplnom snímku K2-o2, K2-o3; pred opravami K2-c1, K2-o2-c1.
# Hotový snímok má súbor HOTOVO; bez neho je neúplný a nepoužíva sa. Existujúci snímok neprepíše, nič nemaže.
set -euo pipefail
export LC_ALL=C
T=$1; K=$2; shift 2
S=/home/volar/projects/anzusystems/krok5-praca/snap/$K
if [ -e "$S" ]; then echo "Snímok $S už existuje; použi ďalšie meno (-o2, -o3…)." >&2; exit 1; fi
trap 'echo "Snímok $S je neúplný (bez HOTOVO): nepoužívať, ďalší pokus pod ďalším menom (-o2…)." >&2' ERR
mkdir -p "$S/mimo-src"
cp -a "$T/src" "$S/src"
: > "$S/mimo-src.txt"
for f in "$@"; do
  mkdir -p "$S/mimo-src/$(dirname "$f")"
  cp -a "$T/$f" "$S/mimo-src/$f"
  printf '%s\n' "$f" >> "$S/mimo-src.txt"
done
printf '%s\n' "$T" > "$S/strom.txt"
git -C "$T" status --porcelain > "$S/status.txt"
git -C "$T" diff --binary HEAD -- src "$@" > "$S/sledovane.patch"
find "$T/src" -type f -printf '%P\n' | sort > "$S/subory.txt"
date '+%F %T' > "$S/HOTOVO"
echo "Snímok $S hotový."
```

### `zaplata.sh`

```bash
#!/bin/bash
# Záplata od snímku po dnešný stav stromu, aj binárne súbory a menované súbory mimo src.
# Použitie: bash zaplata.sh <meno snímku>     Kód 0 = záplata zapísaná, 1 = chyba.
# git diff --no-index vráti 1 pri rozdieloch aj pri nedostupnej ceste, preto sa cesty overujú vopred.
set -uo pipefail
K=$1
S=/home/volar/projects/anzusystems/krok5-praca/snap/$K
[ -f "$S/HOTOVO" ] || { echo "Snímok $S nie je hotový." >&2; exit 1; }
T=$(cat "$S/strom.txt") || exit 1
if [ ! -d "$S/src" ] || [ ! -d "$T/src" ]; then echo "Chýba $S/src alebo $T/src." >&2; exit 1; fi
O=/home/volar/projects/anzusystems/krok5-praca/zaplaty/$K.diff
rc=0; git diff --no-index --binary "$S/src" "$T/src" > "$O" || rc=$?
if [ "$rc" -gt 1 ]; then echo "git diff zlyhal (kód $rc)." >&2; exit 1; fi
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if [ ! -e "$S/mimo-src/$f" ] || [ ! -e "$T/$f" ]; then echo "Menovaný súbor $f chýba v snímku alebo v strome." >&2; exit 1; fi
  rc=0; git diff --no-index --binary "$S/mimo-src/$f" "$T/$f" >> "$O" || rc=$?
  if [ "$rc" -gt 1 ]; then echo "git diff zlyhal pri $f (kód $rc)." >&2; exit 1; fi
done < "$S/mimo-src.txt"
echo "Záplata: $O"
echo "Zmeny mimo src a doc oproti snímku (každá musí byť v zozname kroku):"
diff <(grep -v -E '^.. (src|doc)/' "$S/status.txt" || true) <(git -C "$T" status --porcelain | grep -v -E '^.. (src|doc)/' || true) || true
```

### `navrat.sh`

```bash
#!/bin/bash
# Návrat stromu na snímok (plán 2.0, N-H): len otvorený krok alebo posledný uzavretý krok stromu.
# Použitie: bash navrat.sh <meno snímku>
# Kódy: 0 zhoda, 1 nezhoda alebo chyba, 2 strom mazal, 3 nové položky (vypíše príkazy na presun do koša).
# Pred akýmkoľvek výpisom mv overí snímok aj oba zoznamy. Pred obnovou uloží dnešný stav do snap/<meno>-zahodene.
# Nič nemaže a sám nič nepresúva.
set -uo pipefail
export LC_ALL=C
K=$1
P=/home/volar/projects/anzusystems/krok5-praca
S=$P/snap/$K
V=$P/vysledky
KOS=$P/kos/$K
[ -f "$S/HOTOVO" ] || { echo "Snímok $S nie je hotový." >&2; exit 1; }
[ -d "$S/src" ] || { echo "Snímok $S nemá src." >&2; exit 1; }
[ -s "$S/subory.txt" ] || { echo "Zoznam súborov snímku $S je prázdny." >&2; exit 1; }
T=$(cat "$S/strom.txt") || exit 1
[ -d "$T/src" ] || { echo "Strom $T nemá src." >&2; exit 1; }
mkdir -p "$V" || exit 1
ZS=$V/navrat-$K-snimok.txt; FS=$V/navrat-$K-snimok-subory.txt
ZT=$V/navrat-$K-strom.txt; FT=$V/navrat-$K-strom-subory.txt
find "$S/src" -mindepth 1 -printf '%P\n' | sort > "$ZS" || { echo "Zoznam snímku sa nepodaril." >&2; exit 1; }
find "$S/src" -type f -printf '%P\n' | sort > "$FS" || { echo "Zoznam súborov snímku sa nepodaril." >&2; exit 1; }
find "$T/src" -mindepth 1 -printf '%P\n' | sort > "$ZT" || { echo "Zoznam stromu sa nepodaril." >&2; exit 1; }
find "$T/src" -type f -printf '%P\n' | sort > "$FT" || { echo "Zoznam súborov stromu sa nepodaril." >&2; exit 1; }
if [ ! -s "$ZS" ] || [ ! -s "$FS" ]; then echo "Zoznam snímku je prázdny: nič sa nerobí." >&2; exit 1; fi
cmp -s "$FS" "$S/subory.txt" || { echo "Súbory snímku sa nezhodujú so subory.txt (snímok je poškodený)." >&2; exit 1; }
mapfile -t M < "$S/mimo-src.txt"
chyba=$(comm -23 "$FS" "$FT") || exit 1
if [ -n "$chyba" ]; then
  echo "Súbory zo snímku v strome chýbajú (porušenie pravidla). Obnoviť ich kópiou zo $S/src:"
  printf '%s\n' "$chyba"
  exit 2
fi
# Nové súbory a priečinky kroku; vypíše sa len najvyššia nová položka (rodič, ktorý nie je nový).
nove=$(comm -13 "$ZS" "$ZT") || exit 1
if [ -n "$nove" ]; then
  echo "Nové položky kroku. Ak vlastník povolil mv do koša, vykonaj tieto príkazy a spusti návrat znova:"
  while IFS= read -r p; do
    d=$(dirname "$p")
    if [ "$d" != . ] && grep -Fxq -- "$d" <<< "$nove"; then continue; fi
    if [ "$d" = . ]; then d=""; fi
    printf 'mkdir -p %q && mv %q %q\n' "$KOS/$d" "$T/src/$p" "$KOS/$d/"
  done <<< "$nove"
  exit 3
fi
# Cesta je vždy nová (aj pri dvoch návratoch v tej istej sekunde), aby cp -a nikdy nekopíroval do existujúcej.
Z=$P/snap/$K-zahodene
if [ -e "$Z" ]; then
  zaklad=$Z-$(date +%Y%m%d%H%M%S)-$$; Z=$zaklad; i=2
  while [ -e "$Z" ]; do Z=$zaklad-$i; i=$((i + 1)); done
fi
mkdir -p "$Z/mimo-src" || exit 1
cp -a "$T/src" "$Z/src" || exit 1
for f in "${M[@]}"; do
  [ -n "$f" ] || continue
  mkdir -p "$Z/mimo-src/$(dirname "$f")" && cp -a "$T/$f" "$Z/mimo-src/$f" || exit 1
done
echo "Dnešný stav uložený do $Z."
rsync -a --checksum "$S/src/" "$T/src/" || exit 1
for f in "${M[@]}"; do [ -n "$f" ] || continue; cp -a "$S/mimo-src/$f" "$T/$f" || exit 1; done
ok=1
diff -rq "$S/src" "$T/src" || ok=0
for f in "${M[@]}"; do [ -n "$f" ] || continue; cmp -s "$S/mimo-src/$f" "$T/$f" || { echo "Nezhoda obsahu: $f"; ok=0; }; done
git -C "$T" diff --binary HEAD -- src "${M[@]}" | cmp -s - "$S/sledovane.patch" || { echo "Nezhoda sledovaných súborov."; ok=0; }
diff <(grep -v -E '^.. doc/' "$S/status.txt" || true) <(git -C "$T" status --porcelain | grep -v -E '^.. doc/' || true) \
  || { echo "Nezhoda git status (mimo doc/)."; ok=0; }
if [ "$ok" = 1 ]; then echo "Strom $T je zhodný so snímkom $K."; else echo "Strom sa so snímkom $K nezhoduje." >&2; exit 1; fi
```

### `prenos.sh`

```bash
#!/bin/bash
# Trojcestný prenos src (plán 3.4). Nikdy nič nemaže. Pri akejkoľvek chybe skončí s kódom ≠ 0.
#   bash prenos.sh <základ/src> <worktree/src> <hlavný/src>             # suchý beh: vypíše triedy
#   bash prenos.sh <základ/src> <worktree/src> <hlavný/src> --vykonaj   # skopíruje VZIAT a NOVY a overí ich
set -euo pipefail
export LC_ALL=C
Z=$1; W=$2; H=$3; DO=${4:-}
for d in "$Z" "$W" "$H"; do
  if [ ! -d "$d" ]; then echo "Nie je priečinok: $d" >&2; exit 1; fi
done
cesty=$( { find "$Z" -type f -printf '%P\n'; find "$W" -type f -printf '%P\n'; find "$H" -type f -printf '%P\n'; } | sort -u )
triedy=""
while IFS= read -r p; do
  if [ -z "$p" ]; then continue; fi
  z=0; w=0; h=0
  if [ -f "$Z/$p" ]; then z=1; fi
  if [ -f "$W/$p" ]; then w=1; fi
  if [ -f "$H/$p" ]; then h=1; fi
  t=""
  if [ "$z" = 1 ]; then
    if [ "$w" = 0 ] || [ "$h" = 0 ]; then t=ZMAZANE
    elif cmp -s "$Z/$p" "$W/$p"; then t=""
    elif cmp -s "$Z/$p" "$H/$p"; then t=VZIAT
    elif cmp -s "$W/$p" "$H/$p"; then t=""
    else t=RUCNE
    fi
  elif [ "$w" = 1 ]; then
    if [ "$h" = 0 ]; then t=NOVY
    elif ! cmp -s "$W/$p" "$H/$p"; then t=RUCNE
    fi
  fi
  if [ -n "$t" ]; then triedy+="$t $p"$'\n'; fi
done <<< "$cesty"
printf '%s' "$triedy"
if grep -q '^ZMAZANE ' <<< "$triedy"; then
  echo "Prenos zastavený: niektorý strom mazal (porušenie pravidla)." >&2
  exit 2
fi
if [ "$DO" != --vykonaj ]; then exit 0; fi
while read -r t p; do
  case "${t:-}" in
    VZIAT) cp -p "$W/$p" "$H/$p" ;;
    NOVY) mkdir -p "$(dirname "$H/$p")"; cp -p "$W/$p" "$H/$p" ;;
  esac
done <<< "$triedy"
chyby=0
while read -r t p; do
  case "${t:-}" in
    VZIAT|NOVY) if ! cmp -s "$W/$p" "$H/$p"; then echo "NEZHODA po kópii: $p" >&2; chyby=1; fi ;;
  esac
done <<< "$triedy"
if [ "$chyby" != 0 ]; then exit 1; fi
echo "Skopírované a overené. Cesty RUCNE zlúč ručne a zapíš do denníka."
```

### `zalozenie-lib-u.sh`

```bash
#!/bin/bash
# Zápis stavu lib-u pri založení (plán 3.2, S0): zoznam, typ a práva (stat %F %a) a obsah každého neignorovaného
# zmeneného alebo nového súboru mimo src. Spúšťa sa raz, hneď po založení a overení lib-u, pred U0-L. Nič nemaže,
# existujúci zápis neprepíše.
set -euo pipefail
export LC_ALL=C
P=/home/volar/projects/anzusystems/krok5-praca
W=$P/wt/lib-u
Z=$P/snap/lib-u-zalozenie
if [ -e "$Z" ]; then echo "Zápis $Z už existuje." >&2; exit 1; fi
mkdir -p "$Z"
git -C "$W" ls-files -z -m -d -o --exclude-standard -- . ':(exclude)src' > "$Z/mimo-src.lst"
if [ -n "$(git -C "$W" ls-files -d -- . ':(exclude)src')" ]; then echo "V lib-u chýba sledovaný súbor mimo src." >&2; exit 1; fi
tr '\0' '\n' < "$Z/mimo-src.lst" | while IFS= read -r f; do stat -c '%F %a %n' -- "$W/$f"; done > "$Z/mimo-src.stat"
tar -C "$W" --null -T "$Z/mimo-src.lst" -cf "$Z/mimo-src.tar"
date '+%F %T' > "$Z/HOTOVO"
echo "Stav lib-u pri založení zapísaný do $Z ($(tr -cd '\0' < "$Z/mimo-src.lst" | wc -c) súborov mimo src)."
```

### `rucne.sh`

```bash
#!/bin/bash
# Záznam jedného ručného zlúčenia pri I1 (plán 2.6, 3.4) pre posudok Codexu a Opusu.
# Použitie: bash rucne.sh <cesta v src, napr. lib.ts>      (spúšťa sa po ručnom zlúčení, pred CK-LIB a posudkom)
# Zapíše zaplaty/I1-rucne/<cesta>.diff s tromi časťami: (1) čo zmenil lib-u (základ → lib-u); (2) čo mala LIB pred
# zlúčením (základ → LIB pred I1, zo snímku I1); (3) čo zlúčenie urobilo v LIB (LIB pred I1 → LIB teraz).
# Posudok overí, že (3) prinieslo všetko z (1) a zachovalo (2). Nič nemaže.
set -uo pipefail
p=$1
P=/home/volar/projects/anzusystems/krok5-praca
ZK=$P/wt/lib-u-zaklad/src/$p; WU=$P/wt/lib-u/src/$p; LP=$P/snap/I1/src/$p; LT=/home/volar/projects/anzusystems/common-admin/src/$p
# Základ chýba pri RUCNE „nový na oboch stranách, iný" (3.4): porovná sa s prázdnym súborom.
if [ ! -e "$ZK" ]; then ZK=/dev/null; fi
for f in "$WU" "$LP" "$LT"; do
  if [ ! -f "$f" ]; then echo "Chýba $f." >&2; exit 1; fi
done
O=$P/zaplaty/I1-rucne/$p.diff
mkdir -p "$(dirname "$O")" || exit 1
(
  echo "### (1) lib-u: základ -> lib-u"
  rc=0; git diff --no-index "$ZK" "$WU" || rc=$?; [ "$rc" -le 1 ] || exit 1
  echo "### (2) LIB pred I1: základ -> LIB pred I1"
  rc=0; git diff --no-index "$ZK" "$LP" || rc=$?; [ "$rc" -le 1 ] || exit 1
  echo "### (3) zlúčenie: LIB pred I1 -> LIB teraz"
  rc=0; git diff --no-index "$LP" "$LT" || rc=$?; [ "$rc" -le 1 ] || exit 1
) > "$O" || { echo "Záznam $O sa nepodaril." >&2; exit 1; }
echo "Záznam ručného zlúčenia: $O"
```

### `kontrola-lib-u.sh`

```bash
#!/bin/bash
# Kontrola pred git worktree remove --force pre lib-u (plán 2.8, Z bod 8). lib-u je od I1 zmrazený.
# (a) src sa zhoduje so snímkom I1-lib-u v obsahu, type aj právach; (b) každý neignorovaný zmenený alebo nový súbor
# mimo src je ten istý a má ten istý typ, práva (stat %F %a) aj obsah ako pri založení lib-u (snap/lib-u-zalozenie).
# Kódy: 0 čisté, 1 nie (vypíše rozdiely).
# Nič nemaže.
set -uo pipefail
export LC_ALL=C
P=/home/volar/projects/anzusystems/krok5-praca
W=$P/wt/lib-u
Z=$P/snap/lib-u-zalozenie
I=$P/snap/I1-lib-u
if [ ! -f "$I/HOTOVO" ] || [ ! -d "$I/src" ]; then echo "Chýba hotový snímok $I." >&2; exit 1; fi
if [ ! -f "$Z/HOTOVO" ] || [ ! -f "$Z/mimo-src.lst" ] || [ ! -f "$Z/mimo-src.stat" ] || [ ! -f "$Z/mimo-src.tar" ]; then echo "Chýba zápis $Z." >&2; exit 1; fi
K=$P/vysledky/kontrola-lib-u-$(date +%Y%m%d%H%M%S)-$$
zaklad=$K; i=2
while [ -e "$K" ]; do K=$zaklad-$i; i=$((i + 1)); done
mkdir -p "$K/zalozenie" || exit 1
tar -C "$K/zalozenie" -xf "$Z/mimo-src.tar" || { echo "Zápis pri založení sa nedá rozbaliť." >&2; exit 1; }
ok=1
echo "(a) src proti snímku I1-lib-u:"
diff -rq "$I/src" "$W/src" || ok=0
find "$I/src" -printf '%y %m %P\n' | sort > "$K/src-i1.txt" || exit 1
find "$W/src" -printf '%y %m %P\n' | sort > "$K/src-teraz.txt" || exit 1
diff "$K/src-i1.txt" "$K/src-teraz.txt" || { echo "Typ alebo práva v src sa od snímku I1-lib-u zmenili."; ok=0; }
echo "(b) súbory mimo src proti stavu pri založení:"
tr '\0' '\n' < "$Z/mimo-src.lst" | sort -u > "$K/zalozenie.txt" || exit 1
git -C "$W" ls-files -z -m -d -o --exclude-standard -- . ':(exclude)src' | tr '\0' '\n' | sort -u > "$K/teraz.txt" \
  || { echo "git ls-files zlyhal." >&2; exit 1; }
diff "$K/zalozenie.txt" "$K/teraz.txt" || { echo "Zoznam zmenených a nových súborov mimo src sa od založenia zmenil."; ok=0; }
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if [ ! -e "$W/$f" ]; then echo "Chýba: $f"; ok=0; continue; fi
  cmp -s "$K/zalozenie/$f" "$W/$f" || { echo "Iný obsah: $f"; ok=0; }
done < "$K/zalozenie.txt"
sort "$Z/mimo-src.stat" > "$K/zalozenie.stat" || exit 1
while IFS= read -r f; do
  [ -n "$f" ] || continue
  stat -c '%F %a %n' -- "$W/$f" 2>/dev/null || echo "chýba $W/$f"
done < "$K/zalozenie.txt" | sort > "$K/teraz.stat"
diff "$K/zalozenie.stat" "$K/teraz.stat" || { echo "Typ alebo práva súborov mimo src sa od založenia zmenili."; ok=0; }
if [ "$ok" = 1 ]; then
  echo "lib-u je čistý: src ako pri I1, mimo src ako pri založení. Vlastník smie spustiť git worktree remove --force."
  exit 0
fi
echo "lib-u NIE JE čistý: rozdiely ukázať vlastníkovi; worktree sa neodstraňuje." >&2
exit 1
```

### `ck-lib.sh`

```bash
#!/bin/bash
# Celé kontroly LIB. Použitie: bash ck-lib.sh <strom LIB> <meno agenta> <krok> [T]
#   T = krok len s testami (bez stylelintu). Každý príkaz cez tezky.sh (brána, zámok, bez COMMON_ADMIN_*).
# Kódy: 0 zelené, 1 červené (aj keď príkaz sám vráti 75, 76 či 79); 75, 76 alebo 79 = príkaz sa nespustil (značka
# tezky.sh: zámok, lehota, brána, nezapísaná značka), CK prerušená: zopakovať neskôr.
set -uo pipefail
T=$1; A=$2; K=$3; UROVEN=${4:-}
P=/home/volar/projects/anzusystems/krok5-praca
mkdir -p "$T/node_modules/.cache/vitest-tmp-$A" "$P/vysledky" "$P/znacky" || exit 1
vysledok=0
poradie=0
krok() {
  local rc=0 z
  poradie=$((poradie + 1))
  z=$P/znacky/ck-$$-$poradie
  : > "$z" || exit 1
  echo "== $*"
  TEZKY_ZNACKA=$z bash "$P/nastroje/tezky.sh" -w 1800 "$@" || rc=$?
  # O prerušení rozhoduje značka, nie kód: vlastný kód príkazu (aj 75 či 76) je výsledok príkazu.
  if [ "$(cat "$z")" != bezi ]; then echo "CK prerušená ($(cat "$z"), kód $rc): zopakuj neskôr."; exit "$rc"; fi
  if [ "$rc" != 0 ]; then echo "!! zlyhalo (kód $rc): $*"; vysledok=1; fi
}
krok env TMPDIR="$T/node_modules/.cache/vitest-tmp-$A" yarn --cwd "$T" test:browser --reporter=default --reporter=json --outputFile="$P/vysledky/$K-lib-browser.json"
krok env -u TMPDIR yarn --cwd "$T" test:eslint
krok yarn --cwd "$T" lint:tsc
krok yarn --cwd "$T" format:check
krok yarn --cwd "$T" lint:oxlint
krok yarn --cwd "$T" lint:eslint
if [ "$UROVEN" != T ]; then krok yarn --cwd "$T" lint:stylelint; fi
if [ "$vysledok" = 0 ]; then echo "CK-LIB${UROVEN:+-$UROVEN} $K: zelené"; else echo "CK-LIB${UROVEN:+-$UROVEN} $K: ČERVENÉ"; fi
exit "$vysledok"
```

### `ck-dam.sh`

```bash
#!/bin/bash
# Celé kontroly DAM. Použitie: bash ck-dam.sh <meno agenta> <krok> [T]
#   T = krok len s testami (bez generate:dts, stylelintu a buildu). Každý príkaz cez tezky.sh.
# Kódy: 0 zelené, 1 červené (aj keď príkaz sám vráti 75, 76 či 79); 75, 76 alebo 79 = príkaz sa nespustil (značka
# tezky.sh: zámok, lehota, brána, nezapísaná značka), CK prerušená: zopakovať neskôr.
set -uo pipefail
D=/home/volar/projects/anzusystems/admin-dam
A=$1; K=$2; UROVEN=${3:-}
P=/home/volar/projects/anzusystems/krok5-praca
mkdir -p "$D/node_modules/.cache/vitest-tmp-$A" "$P/vysledky" "$P/znacky" || exit 1
vysledok=0
poradie=0
krok() {
  local rc=0 z
  poradie=$((poradie + 1))
  z=$P/znacky/ck-$$-$poradie
  : > "$z" || exit 1
  echo "== $*"
  TEZKY_ZNACKA=$z bash "$P/nastroje/tezky.sh" -w 1800 "$@" || rc=$?
  # O prerušení rozhoduje značka, nie kód: vlastný kód príkazu (aj 75 či 76) je výsledok príkazu.
  if [ "$(cat "$z")" != bezi ]; then echo "CK prerušená ($(cat "$z"), kód $rc): zopakuj neskôr."; exit "$rc"; fi
  if [ "$rc" != 0 ]; then echo "!! zlyhalo (kód $rc): $*"; vysledok=1; fi
}
if [ "$UROVEN" != T ]; then krok yarn --cwd "$D" generate:dts; fi
krok env TMPDIR="$D/node_modules/.cache/vitest-tmp-$A" yarn --cwd "$D" test --reporter=default --reporter=json --outputFile="$P/vysledky/$K-dam.json"
krok yarn --cwd "$D" lint:tsc
krok yarn --cwd "$D" format:check
krok yarn --cwd "$D" lint:oxlint
krok yarn --cwd "$D" lint:eslint
if [ "$UROVEN" != T ]; then krok yarn --cwd "$D" lint:stylelint; krok yarn --cwd "$D" build; fi
if [ "$vysledok" = 0 ]; then echo "CK-DAM${UROVEN:+-$UROVEN} $K: zelené"; else echo "CK-DAM${UROVEN:+-$UROVEN} $K: ČERVENÉ"; fi
exit "$vysledok"
```

### `kopia.sh`

```bash
#!/bin/bash
# Build knižnice z LIB a kópia do admin-dam. Spúšťa len vedúci, len keď DAM nemá otvorený krok; nikdy cez tezky.sh.
# Použitie: bash kopia.sh <bod kópie, napr. C1>
#           bash kopia.sh --stav <bod> zelene|cervene     (výsledok CK-DAM po kópii, plán 2.6)
# Kódy: 0 hotové, 1 chyba (pri zlyhaní copy.sh platí N-K; pri nesediacom výstupe stav nejasne), 2 zlé použitie,
# 75, 76 alebo 79 = build alebo copy.sh sa nespustil (zámok, brána, nezapísaná značka), v DAM sa nič nezmenilo.
# Zelený stav dá knižnici len --stav <bod> zelene po CK-DAM, a to len zo stavu neoverene alebo obnovene.
# PRACA/balik/nainstalovane.txt: <bod> <stav> knižnice v DAM; PRACA/balik/zoznam.txt: <uloženie> <bod> <stav>.
set -euo pipefail
L=/home/volar/projects/anzusystems/common-admin
D=/home/volar/projects/anzusystems/admin-dam
P=/home/volar/projects/anzusystems/krok5-praca
B=$D/node_modules/@anzusystems/common-admin
N=$P/balik/nainstalovane.txt
if [ "${1:-}" = --stav ]; then
  if [ "$#" != 3 ] || { [ "$3" != zelene ] && [ "$3" != cervene ]; }; then echo "Použitie: kopia.sh --stav <bod> zelene|cervene" >&2; exit 2; fi
  aktualne=$(cat "$N")
  if [ "${aktualne%% *}" != "$2" ]; then echo "V DAM je nainštalovaná knižnica $aktualne, nie $2." >&2; exit 1; fi
  # Stav sa dá zapísať len po kópii (neoverene) alebo po obnove (obnovene). Z nejasne, pokazene ani zelene/cervene nie:
  # z nejasne vedie len nový kopia.sh <bod> alebo obnova-balika.sh.
  case "${aktualne#* }" in
    neoverene|obnovene) ;;
    *) echo "Stav $aktualne sa cez --stav nemení (len z neoverene alebo obnovene)." >&2; exit 1 ;;
  esac
  printf '%s %s\n' "$2" "$3" > "$N"
  echo "Nainštalovaná knižnica: $2 $3."
  exit 0
fi
C=$1
if [ ! -f "$N" ]; then echo "Chýba $N (zapíše ho S0)." >&2; exit 1; fi
# copy.sh berie zdroj z .env.local, ak existuje, inak z .env (ukazuje na /home/admin/…), inak z vlastného priečinka.
if [ ! -f "$L/.env.local" ]; then echo "Chýba $L/.env.local; copy.sh by čítal .env s inou cestou." >&2; exit 1; fi
zdroj=$(env -u COMMON_ADMIN_PROJECT bash -c 'source "$1/.env.local" >/dev/null 2>&1; printf "%s" "${COMMON_ADMIN_PROJECT:-$1}"' _ "$L")
if [ "$(realpath "$zdroj" 2>/dev/null || true)" != "$L" ]; then echo "copy.sh by kopíroval z $zdroj, nie z $L." >&2; exit 1; fi
# Uloženie nainštalovaného balíka pre N-K, so záznamom, ktorá knižnica to je a či prešla CK-DAM.
# Cesta je vždy nová (aj pri dvoch pokusoch v tej istej sekunde), aby cp -a nikdy nekopíroval do existujúcej.
Z=$P/balik/$C
if [ -e "$Z" ]; then
  zaklad=$Z-$(date +%Y%m%d%H%M%S)-$$; Z=$zaklad; i=2
  while [ -e "$Z" ]; do Z=$zaklad-$i; i=$((i + 1)); done
fi
cp -a "$B" "$Z"
printf '%s %s\n' "$(basename "$Z")" "$(cat "$N")" >> "$P/balik/zoznam.txt"
echo "Nainštalovaný balík ($(cat "$N")) uložený do $Z."
# O tom, či sa build a copy.sh spustili, rozhoduje značka tezky.sh, nie kód (plán 3.6).
mkdir -p "$P/znacky"
zb=$P/znacky/kopia-$$-build; zc=$P/znacky/kopia-$$-copy
: > "$zb"; : > "$zc"
rc=0
TEZKY_ZNACKA=$zb bash "$P/nastroje/tezky.sh" -w 1800 yarn --cwd "$L" build || rc=$?
if [ "$(cat "$zb")" != bezi ]; then echo "Build sa nespustil ($(cat "$zb")): skús neskôr; v DAM sa nič nezmenilo." >&2; exit "$rc"; fi
if [ "$rc" != 0 ]; then echo "Build zlyhal (kód $rc); v DAM sa nič nezmenilo." >&2; exit 1; fi
ls -l "$L/dist/common-admin.js" "$L/dist/common-admin.d.ts" "$L/dist/common-admin.css"
rc=0
out=$(TEZKY_ZNACKA=$zc bash "$P/nastroje/tezky.sh" -w 1800 "$L/copy.sh" "$D" 2>&1) || rc=$?
echo "$out"
if [ "$(cat "$zc")" != bezi ]; then echo "copy.sh sa nespustil ($(cat "$zc")): skús neskôr; v DAM sa nič nezmenilo." >&2; exit "$rc"; fi
if [ "$rc" != 0 ]; then
  printf '%s pokazene\n' "$C" > "$N"
  echo "copy.sh skončil s kódom $rc. Ak už zmazal nainštalovaný dist: N-K, bash $P/nastroje/obnova-balika.sh" >&2
  exit 1
fi
# copy.sh skončil 0, ale výstup nesedí: DAM sa mohol zmeniť, stav je nejasný (nie zelený, nie predošlý); stop.
if [ "$(grep -c '^Successfully copied' <<< "$out")" != 1 ]; then printf '%s nejasne\n' "$C" > "$N"; echo "copy.sh nemal presne jeden cieľ; stav $C nejasne." >&2; exit 1; fi
if ! grep -q "to $B\$" <<< "$out"; then printf '%s nejasne\n' "$C" > "$N"; echo "copy.sh kopíroval inam; stav $C nejasne." >&2; exit 1; fi
printf '%s neoverene\n' "$C" > "$N"
echo "Kópia $C do $D hotová. Po CK-DAM: bash $P/nastroje/kopia.sh --stav $C zelene|cervene"
```

### `obnova-balika.sh`

```bash
#!/bin/bash
# N-K (plán 2.0): vráti do admin-dam uložený balík knižnice, ktorá prešla CK-DAM. Nič nemaže.
# Použitie: bash obnova-balika.sh [meno uloženia]   (bez mena: najnovšie uloženie so stavom zelene v zozname)
# Kódy: 0 vrátené a overené, 1 chyba. NAVYSE = súbory, ktoré copy.sh pridal (nečinné; zmaže ich vlastník).
# Súbor s viac ako jedným odkazom copy.sh nenahradil (pri pnpm je to odkaz do spoločného úložiska): neprepisuje sa.
set -euo pipefail
export LC_ALL=C
P=/home/volar/projects/anzusystems/krok5-praca
D=/home/volar/projects/anzusystems/admin-dam
B=$D/node_modules/@anzusystems/common-admin
Q=$P/balik/zoznam.txt
if [ ! -s "$Q" ]; then echo "Chýba alebo je prázdny $Q." >&2; exit 1; fi
if [ "$#" -ge 1 ]; then M=$1; else M=$(tac "$Q" | awk '$3 == "zelene" { print $1; exit }'); fi
if [ -z "$M" ]; then echo "V $Q nie je uloženie so zeleným CK-DAM." >&2; exit 1; fi
riadok=$(awk -v m="$M" '$1 == m' "$Q" | tail -1)
if [ "$(awk '{ print $3 }' <<< "$riadok")" != zelene ]; then echo "Uloženie $M nemá zelené CK-DAM ($riadok); nepoužije sa." >&2; exit 1; fi
POVOD=$(awk '{ print $2 }' <<< "$riadok")
Z=$P/balik/$M
for x in dist package.json src/eslint src/vite; do
  if [ ! -e "$Z/$x" ]; then echo "V uložení chýba $Z/$x." >&2; exit 1; fi
done
if [ -z "$(find "$Z/dist" -type f -print -quit)" ]; then echo "Uložený dist je prázdny." >&2; exit 1; fi
chyby=0
vrat() {  # vrat <relatívna cesta súboru v balíku>
  local f=$1
  if [ -e "$B/$f" ] && [ "$(stat -c %h "$B/$f")" -gt 1 ]; then
    cmp -s "$Z/$f" "$B/$f" || { echo "NEZHODA (pôvodný súbor s odkazmi, neprepísaný) $f" >&2; chyby=1; }
    return 0
  fi
  mkdir -p "$(dirname "$B/$f")"
  cp -p "$Z/$f" "$B/$f"
  cmp -s "$Z/$f" "$B/$f" || { echo "NEZHODA $f" >&2; chyby=1; }
}
vrat package.json
for x in dist src/eslint src/vite; do
  uloz=$(find "$Z/$x" -type f -printf '%P\n' | sort)
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    vrat "$x/$f"
  done <<< "$uloz"
  teraz=$(find "$B/$x" -type f -printf '%P\n' | sort)
  comm -13 <(printf '%s\n' "$uloz") <(printf '%s\n' "$teraz") | sed "s#^#NAVYSE $B/$x/#"
done
if [ "$chyby" != 0 ]; then exit 1; fi
printf '%s obnovene\n' "$POVOD" > "$P/balik/nainstalovane.txt"
echo "Vrátená knižnica $POVOD (uloženie $M). Ďalej: bash $P/nastroje/ck-dam.sh <meno> <bod>-obnova T,"
echo "a ak je zelené: bash $P/nastroje/kopia.sh --stav $POVOD zelene"
```
