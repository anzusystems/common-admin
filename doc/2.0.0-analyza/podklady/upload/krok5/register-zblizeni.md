# Register zblížení a rozhodnutých zmien kroku 5 (pre vlastníka)

Zostavené v kroku Z z registrov oboch návrhov (`navrh-jadro.md` časť 6, `navrh-komponenty.md` časť 6), z plánu
(`plan-implementacie.md` 2.8, „Zmeny viditeľných textov") a z poznámok krokov `impl/*.md`. Nič tu nie je nové: pri
každej položke je len to, čo je v zdroji; miesta v kóde, dôkazy a testy ostávajú tam. Stav stromov (20. 10.,
dopoludnia): knižnica po `PV14c-L6-c2` (CK-LIB 389 súborov / 5 467 testov), admin-dam bez zmeny kódu na kópii C17a
(CK-DAM 150 / 2 068 s buildom), admin-ugc po `PV14c-U1-c1` (16 súborov / 108 testov, build). Bloky 1 až 13 sú
commitnuté a pushnuté na `origin/next` (blok 13 20. 10.: common-admin `f7ff8a2c`, admin-dam `0d4ec26f`); blok 14
(PV14c) v čase zápisu nie (záverečné `final14.sh` a `final14-ugc.sh` bežali). Opravy z 12. až 20. 10. sú v častiach
5.6 až 5.18.

**Ako čítať.** CMS = admin-cms, UGC = admin-ugc, DAM = admin-dam. Zaradenie:

- **viditeľné**: používateľ niečo vidí alebo môže urobiť inak;
- **kozmetika**: vidno to, ale nič sa tým nemení;
- **vnútorné**: nikto to nevidí;
- **zmluva API**: mení sa verejné rozhranie knižnice (typy, vlastnosti, voľby pluginu) alebo to, čo ide na backend;
  „pribúda" znamená, že doterajší kód aplikácie funguje bez zmeny.

Časti: 1. čo čaká na vlastníka, 2. zmeny viditeľných textov, 3. register jadra, 4. register komponentov,
5. rozhodnuté zmeny, ktoré nie sú zblížením, 6. čo ostáva na každej strane, 7. odovzdávka pre tím admin-ugc,
8. známe obmedzenia a nálezy mimo zmeny.

---

## 1. Čo čaká na vlastníka

Body 1 až 7 rozhodol vlastník 11. 10., body 8 až 11 18. 10.; na vlastníkovi ostávajú pohľady (bod 8, neskôr), Z2
(bod 9), schválenie zoznamu zmien admin-ugc (bod 11), rozhodnutia z bloku 13 (bod 12) a kontrola bloku 14 (bod 13).

| # | Čo | Kde |
|---|---|---|
| 1 | **Znenie dvoch nových textov U8** (prístupné meno „vyplniť prázdne" a „nahradiť všade" s názvom poľa): **potvrdené 11. 10.** Viditeľné texty (bubliny) ostali pôvodné, názov poľa je len v prístupnom mene | časť 2, U8 |
| 2 | **Galéria pri výbere z dvoch licencií** (N20-c2 až c4): assety inej licencie skopíruje, assety licencie nahrávania vezme, ako sú; poradie obrázkov sa môže líšiť od poradia výberu. **Potvrdené 11. 10.** | časť 5, N20 |
| 3 | **F-C v okne uploadu** (CMS): kto súbor práve nahral a otvorí detail riadku, kým sa súbor spracúva, má „Uložiť" vypnuté, kým detail neotvorí znova. **Rozhodnuté 11. 10.: ostáva** | časť 5, F-C |
| 4 | **Merač pri úplnom zastavení toku** (M, Z28): odhad rastie až k hodinám a ďalší kúsok sa zmenší; možnosti A (hlásiť len pri nových bajtoch), B (nulová rýchlosť bez času), C (nechať). **Rozhodnuté 11. 10.: A**, krok M-A: pri zastavení toku uprostred kúska riadok drží poslednú rýchlosť a čas a opakovaný kúsok sa tichom nezmenší; čakanie na odpoveď servera sa ráta ďalej | `impl/M-A.md`; `impl/M.md`, „Na vedomie vlastníkovi"; `impl/C3.md` |
| 5 | **N-U1-2**: chip s podaným titulkom, ktorého id DAM nevráti, ukáže v knižnici bublinu „nepodarilo sa načítať"; DAM doteraz mlčal. **Rozhodnuté 11. 10.: ostáva správanie knižnice** | časť 4 |
| 6 | **N9** (DAM): údaje poskytovateľa pri importe z výberu. Nič viditeľné. **Rozhodnuté 11. 10.: kód ostáva** | `impl/N9.md` |
| 7 | **ZK27**: dve pripnuté vlastné polia ako záloha pri neúplnej konfigurácii. **Rozhodnuté 11. 10.: ostáva záloha knižnice (dve polia)**, kľúč konfigurácie netreba | časť 4 |
| 8 | **Pohľad v dev serveri admin-dam (K-04)**: ZK5, ZK11, ZK15. **Vlastník 18. 10.: „neskôr"** | časť 4 |
| 9 | **Z2**: tajomstvo `admin-dam-sentry-dsn` je v skupinách `admin-dam-devel-secrets`, `-stage-secrets` aj `-production-secrets` (Azure DevOps Library, z Key Vaultu; overené 11. 10. cez `az`, hodnotu `az` neukáže). **Vlastník 18. 10. súhlasí s návrhom:** overiť hodnotu v Key Vault, alebo po nasadení na devel v Sentry, či chodia udalosti z admin-dam; ostáva na vlastníkovi | `navrh-jadro.md` 5, bod 9 |
| 10 | e2e admin-dam (K-14): **nerieši sa** (vlastník 11. 10.). Commit: bloky 1 až 12 sú commitnuté a pushnuté na `origin/next`, jedenásty 18. 10. (common-admin `63118c08..38a725cf`, admin-dam `a6899598..c7f81045`), dvanásty 19. 10. (common-admin `f7fc44d1..d7c14d79` a `96792faa`, admin-dam `72ee1f3d..4c3c05af` a `35326f20`), trinásty 20. 10. po zelenom `final13.sh` (vlastník 19. 10.: „ano mozes"; common-admin `f7ff8a2c`, admin-dam `0d4ec26f`). **Blok 14 (PV14c) v čase zápisu necommitnutý** (common-admin; admin-dam bez zmeny), záverečné kontroly bežali; zmena admin-ugc (`PV14c-U1`) tiež necommitnutá, na schválenie vlastníka (bod 11). Zmazanie: prvé 11. 10. (U9a až U9c); dočasné priečinky testov zmazal vedúci 18. 10. (vlastník: „upracme"); posledné (worktree `lib-u` a PRACA) až po tagu | plán 2.8 Z; `zoznam-na-zmazanie.md` |
| 11 | Odovzdávka tímu admin-ugc. **Vlastník 18. 10.:** je sám členom tímu admin-ugc, zmeny v admin-ugc sa môžu zapracovať; vedúci napíše zoznam zmien, vlastník ho schváli. **Na schválenie (20. 10.):** `PV14c-U1`, tri obaly obrázkov plnia obchod konfigurácie DAM svojho mena (necommitnuté) | časť 7; časť 5.18 |
| 12 | **Z bloku 13:** zastavené opravy (224, zlúčenie FE-47, cesta panela pri hromadnom uložení, FE-69 (a), 218), dva nové texty admin-dam na kontrolu (`newTabBlocked`, `fileMissing`; blok je commitnutý, prípadné úpravy ďalším commitom), poznámky na rozhodnutie a backendový nález `rotation` (vlastník ho pridá do #86919) | časť 8, „Na rozhodnutie vlastníka po bloku 13"; časť 2 |
| 13 | **Blok 14 (PV14c):** šesť predbežných volieb vedúceho (funkcie len s klientom bez kľúčov adries, text výpadku soketu, kľúč `/pub/v1/configuration`, predvyplnenie obchodu namiesto nového UI, jedna adresa soketu = jeden DAM, `ImageMediaWidgetInner` bez `skipCurrentUserCheck`) na kontrolu pred commitom; kontrola admin-cms s novou knižnicou (`lint:tsc`, jeden štart); počet procesov `ck-lib.sh` | časť 5.18 |

**TODO vlastníka (11. 10., stav 20. 10.):**

- Po uzavretí kroku 5 otagovať common-admin a dať novú verziu do všetkých adminov. **Vlastník 18. 10.: „zatiaľ
  nie".**
- admin-ugc: `copyToLicenceEnabled: false` pridané a `uploadStatusFallback: true` odstránené v `src/main.ts`, schválené
  a pushnuté 18. 10. (`19293f1..66fa782`), skôr než vyjde nová verzia knižnice (časť 7, bod 1).
- Pohľady v prehliadači (bod 8) pri testovaní celku; vlastník 18. 10.: neskôr.
- Z2 (bod 9): hodnota v Key Vault alebo udalosti admin-dam v Sentry po nasadení na devel.
- e2e admin-dam: zatiaľ sa nerieši (vlastník 11. 10.).
- Commit a push v oboch repozitároch: bloky 1 až 13 hotové (posledný 20. 10.); blok 14 (PV14c) v čase zápisu nie
  (bod 10).
- Štrnásty blok PV14c (pomenované konfigurácie DAM; vlastník 18. 10.) je hotový (časť 5.18); šesť jeho bodov pre
  vlastníka je dočasne podľa odporúčaní vedúceho, kontrola pred jeho commitom (bod 13); zmena admin-ugc na schválenie
  (bod 11).
- Zmazanie nepoužívaných súborov admin-dam: časti 1, 2, 4 a 7 zoznamu zmazané 11. 10. (kroky U9a, U9b,
  U9c); dočasné priečinky testov oboch repozitárov zmazané 18. 10.; ostáva posledné zmazanie (worktree `lib-u`
  a PRACA), až po tagu (`zoznam-na-zmazanie.md`).

---

## 2. Zmeny viditeľných textov

| Text | Kto ho uvidí | Krok | Stav |
|---|---|---|---|
| Potvrdzovacie tlačidlo otázky pri zastavení uploadu: „Zastaviť" / „Stop" / „Zastavit" namiesto „Zatvoriť" / „Close" / „Zavřít". Tlačidlo, ktoré otázku otvorí, a krížik ostávajú „Zatvoriť" | CMS, UGC, DAM (od C3) | 43 | schválené |
| „Sem sa dá nahrať len jeden súbor; použije sa prvý." / „Only one file can be uploaded here; the first one is used." / „Sem lze nahrát jen jeden soubor; použije se první." | CMS, UGC | 47 | schválené |
| „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný." / „The asset file is still being processed. Remove the item and select it again once it is processed." | DAM, riadok hromadnej úpravy | F5 s F-A | schválené |
| „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova." / „The file is still being processed. You can save once it is processed; then open the asset again." | DAM, detail a pravý panel | F-B | schválené |
| „Asset sa stále nahráva alebo spracováva serverom" pri vypnutom „Uložiť" detailu (existujúci kľúč na novom mieste) | CMS, UGC | F-C | nový text netreba |
| Hlášky pri zlyhanom uložení metadát a detailu z existujúcich textov, pri 422 jedna s názvami polí | CMS, UGC, DAM | N39-L, N39-D | schválené, bez nového textu |
| Prístupné meno dvoch ikonových tlačidiel pri poli hromadných operácií: SK „Vyplňte prázdne pole: {field}", „Nahradiť všade: {field}"; EN „Fill empty field: {field}", „Replace everywhere: {field}"; CS „Vyplňte prázdné pole: {field}", „Nahradit všude: {field}" | čítačka obrazovky: CMS, UGC, DAM (od C3) | U8-L, U8-D | **potvrdené 11. 10.** |
| 12 anglických reťazcov v admin-dam (tabuľka nižšie) | DAM, anglické rozhranie | R10 | rozhodnuté |
| Nové texty opráv z 12. až 14. 10. (znenia v riadkoch častí 5.6 až 5.14): „Pridať autora" (`common.damImage.author.button.addConflict`, FE-9), „Distribúcie sa nepodarilo načítať." (`coreDam.distribution.common.loadFailed`, FE-14), „Odobrať z výberu" (`coreDam.asset.selected.remove`, FE-16), bubliny editora podcastu `system.editor.*` (FE-25), „Niektorým súborom sa práve načítali metadáta…" (`common.damImage.upload.metadataJustLoaded`, FE-33), „Spracovanie súboru zlyhalo. Uložiť pôjde po novom otvorení assetu." (`coreDam.asset.detail.fileFailedOpenAgain`, `OP9-D1`) | podľa riadku v časti 5 | FE-9 až FE-33, `OP9-D1` | FE-9 až FE-33 potvrdené vlastníkom 12. 10.; posledný podľa rozhodnutia A vlastníka 14. 10. (nový text), znenie potvrdil 18. 10. („4 ok") |
| Blok 12 (časť 5.16): varovania „Asset medzitým dostal autorov v DAM. Ak obrázok nemal vlastný zdroj, má teraz ich mená; vybraní autori sa neuložili. Skontrolujte a potvrďte znova." (`common.damImage.image.meta.authorsGivenMeanwhile`) a „Assety niektorých obrázkov medzitým dostali autorov v DAM. Obrázky bez vlastného zdroja majú teraz ich mená; vybraní autori sa neuložili a nič sa neuložilo. Skontrolujte a uložte znova." (`…galleryAuthorsGivenMeanwhile`), sk, en, cs | CMS (widgety obrázka s autormi DAM) | `OP12-L1` | prvý zjednotil vlastník 19. 10., druhý z cyklu c1 (odporúčanie posudku, vlastník „suhlasim") |
| Blok 12: prístupné mená „Hlavné menu" / „Main menu" (`system.mainBar.mainMenu`, admin-dam) a „Odobrať" / „Remove" / „Odebrat" (`common.button.remove`, zatváranie čipov knižnice); ostatné mená z existujúcich textov (tooltipy, „Vybrať dátum", „Účet") | čítačka obrazovky: DAM (90 ovládačov), všetky adminy (čipy, kalendár, menu používateľa) | `OP12-D1`, `OP12-L2` | podľa odporúčaní, vlastník 18. a 19. 10. „suhlasim" |
| Blok 13, knižnica (časť 5.17): „Asset už neexistuje." / „The asset no longer exists." / „Asset už neexistuje." (`common.damImage.queueItem.assetGone`), „Originál duplikátu sa nepodarilo načítať." / „The original of the duplicate could not be read." / „Originál duplikátu se nepodařilo načíst." (`…queueItem.duplicateOriginalUnread`), meno pre čítačku „Pridať autora {name}" / „Add author {name}" / „Přidat autora {name}" (`common.damImage.author.button.addConflictNamed`); nový kľúč bez nového slova `common.system.upload.onlyOneFile` | CMS, UGC, DAM (`duplicateOriginalUnread` admin-dam nedostane) | `OP13-L3`, `OP13-L4` | schválené vlastníkom 19. 10. |
| Blok 13, admin-dam: „Slot nemá obrázok." / „The slot has no image." (`coreDam.asset.detail.roi.slotWithoutImage`, poistka, proti core-dam nenastane), mená desiatich farieb filtra (`coreDam.asset.color.*`: Červená, Žltá, Modrá, Oranžová, Zelená, Fialová, Biela, Čierna, Ružová, Hnedá) v tooltipe „meno (kód)", napr. „Červená (#ee0202)", „Asset bol medzitým zmazaný." / „The asset has been deleted meanwhile." (`coreDam.asset.detail.deletedMeanwhile`), „Súbor je spracovaný. Uložiť bude možné po novom otvorení detailu." / „The file is processed. Saving becomes possible after the detail is opened again." (`coreDam.asset.detail.fileProcessedOpenAgain`) | DAM | `OP13-D1`, `OP13-D2` | schválené vlastníkom 19. 10. |
| Blok 13, admin-dam: „Prehliadač neotvoril novú kartu. Povoľte pre túto stránku vyskakovacie okná a skúste znova." / „The browser did not open a new tab. Allow pop-up windows for this site and try again." (`coreDam.asset.newTabBlocked`), „Súbor už na serveri nie je." / „The file is no longer on the server." (`system.uploadErrors.fileMissing`; implementér navrhuje zvážiť zjednotenie s „Asset už neexistuje.") | DAM | `OP13-D3` | **na kontrolu vlastníka pred commitom** |
| Blok 13: existujúce texty na nových miestach: „Požiadavka na API vypršala…" (`error.apiTimedOut.message`, limity čakania widgetov), hlášky knižnice pri 403, 422 a zakázanej operácii akcií súborov namiesto „Systémová chyba…", „Skúsiť znova" (`common.button.retry`) pod zlyhaným náhľadom | CMS, UGC (limity); DAM | `OP13-L2`, `OP13-D3` | nový text netreba |
| Blok 14: varovanie „Notifikačná služba má dočasný výpadok, niektoré funkcie sa nemusia správať korektne." (`common.damImage.notificationsNotConnected`) aj pre soket pomenovanej konfigurácie, raz na soket, bez mena konfigurácie | len aplikácia s druhou konfiguráciou a vlastným soketom (dnes nikto) | `PV14c-L4` | existujúci text; predbežná voľba vedúceho 2, na kontrolu vlastníka (časť 5.18) |

**R10: anglické texty spoločných komponentov podľa knižnice.** Slovenské sa nemenia. `FileUpload` a prekrytia
admin-dam si nechávajú svoje texty.

| Kde | admin-dam doteraz | Potom |
|---|---|---|
| riadok, názov originálu | „Original name" | „Original Name" |
| riadok, kopírovanie ID | „Copy Asset ID" | „Copy asset ID" |
| riadok, neznáma chyba | „System error. Try again later or contact an administrator." | „System error. Please try again later or contact the administrator." |
| otázka pri zastavení (obe prekrytia) | „Are you sure you want to stop the upload?" | „Do you want to stop the upload?" |
| hromadné operácie, popis | „Bulk edit of all content data or selected fields." | „Bulk edit of metadata. To edit metadata line by line, use the button next to the line. To edit all lines at once, use the buttons at the very bottom." |
| hromadné operácie, panel | „General" | „Main" |
| hromadné operácie, pri poli | „Fill empty" | „Fill empty field" |
| hromadné operácie, dole | „Fill all empty" | „Fill only empty" |
| hromadné operácie, pri poli | „Replace in all assets" | „Replace everywhere" |
| hromadné operácie, dole | „Clear form" | „Clear" |
| dôvod zlyhania (riadok, zoznam v pätičke, infobox, sloty) | „Invalid mime type" | „Invalid file type" |
| dialóg „nový autor" (aj stránka autorov) | „Create author" | „Creating author" |

---

## 3. Register jadra (`navrh-jadro.md` časť 6)

Jedna služba uploadu a jedno jadro fronty pre knižnicu aj admin-dam. Položky, ktoré sú zároveň rozhodnutou zmenou,
majú podrobnosti v časti 5.

| # | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| Z1 | Hlavičku typu pri posielaní kúska obe strany nechajú dopísať prehliadaču | nikto; na server ide to isté | vnútorné (PV1) |
| Z2 | Kontrola kúska pred odoslaním a hlásenie do Sentry aj v admin-dam | používateľ nič; DAM začne posielať do Sentry a do konzoly hlásenia o odmietnutom kúsku a o odpovedi 400 | vnútorné, diagnostika (PV2) |
| Z3 | Kontrolný súčet sa pripraví až pri štarte súboru; admin-dam dá hotový hneď | nikto | vnútorné |
| Z4 | Texty dvoch chýb pri štarte sú jedny | nikto (nikto ich neukazuje) | vnútorné |
| Z5 | Zastavenie sa pozná podľa stavu riadku aj podľa príznaku, na všetkých miestach | nikto; v knižnici riadok, ktorý čaká na ďalší pokus, ho po zastavení fronty už nepošle | vnútorné |
| Z6 | Zrušený pokus kúska končí hneď; po poslednom pokuse sa veľkosť kúska už neprepočíta | nikto; prvý kúsok ďalšieho súboru môže mať inú veľkosť | vnútorné |
| Z7 | Kontrola identifikátora súboru pred kúskom aj v admin-dam | nikto | vnútorné |
| Z8 | Kontrola, či sa časť súboru prečítala ako bajty, aj v admin-dam | nikto | vnútorné (PV11) |
| Z9 | Po odoslaní posledného kúska príde ešte jedno hlásenie priebehu | DAM: riadok zoznamu ukáže plný kruh bez zvyšného času (ak upload stihol zmerať rýchlosť) | viditeľné (PV5) |
| Z10 | Merač rýchlosti zastaví služba sama pri každom zlyhaní | nikto | vnútorné |
| Z11 | Text pri odpovedi 400 po štvrtom pokuse zapíše služba, každá strana svoj | nikto (v DAM by pri zriedkavom súbehu so Z26 chýbalo upozornenie navyše; F4 ho aj tak ruší) | vnútorné |
| Z12 | Jedna funkcia, ktorá skladá text z chybných polí | nikto | vnútorné |
| Z13 | Zápis do fronty, ktorá neexistuje, nespraví nič (v admin-dam bola chyba programu) | nikto | vnútorné |
| Z14 | Počty fronty sa prepočítajú po každom úspešnom uploade | nikto | vnútorné |
| Z15 | Po odstránení súboru, ktorý čakal na ďalší pokus, sa ďalší súbor spustí hneď | CMS, UGC: ďalší súbor začne o 1 až 9 s skôr | vnútorné, časovanie (PV6) |
| Z16 | Po zlyhaní uploadu, ktorý server už ohlásil ako hotový, sa nič neprepočíta | nikto | vnútorné |
| Z17 | Odstránenie, „Zrušiť", zastavenie a vyčistenie fronty zastavia každý živý upload podľa jedného pravidla | CMS, UGC: po odstránení alebo zastavení riadku, ktorý server medzitým ohlásil, sa prestanú posielať zvyšné kúsky; asset na serveri ostáva ako doteraz. DAM: v bežnom toku nič (stráž v obale drží doterajšie správanie) | chyba knižnice; menej požiadaviek (PV7) |
| Z18 | „Zrušiť" nečaká krok na odstránenie riadku | nikto | vnútorné |
| Z19 | Vyčistenie fronty, ktorá neexistuje, vytvorí prázdnu | nikto | vnútorné |
| Z20 | Import od externého poskytovateľa ide tým istým štartom ako upload | nikto | vnútorné |
| Z21 | Jadro si pamätá bežiace uploady podľa riadku | nikto | vnútorné |
| Z22 | Jedno počítadlo kľúčov riadkov v jadre | nikto | vnútorné |
| Z23 | *Nahradené položkou Z28* | | |
| Z24 | Hromadné vyplnenie dá každému riadku vlastnú kópiu zoznamu (krok F2) | dnes nikto | chyba oboch strán, dnes bez prejavu (PV8) |
| Z25 | *Vyradené; rozhodnuté opravou F5 (Z29)* | | |
| Z26 | Súbor, ktorý server zlyhal počas posielania, sa prestane posielať (krok F4) | CMS, DAM: časť 5 | viditeľné; menej požiadaviek (PV13) |
| Z27 | admin-dam posiela na časti kúska typ súboru | nikto; server ho nečíta | vnútorné; mení sa, čo DAM pošle (PV3) |
| Z28 | Jeden merač rýchlosti a priebehu (krok M) | CMS, UGC, DAM: časť 5 | viditeľné (PV4, PV12) |
| Z29 | Riadok hromadnej úpravy, ktorého súbor zlyhal a server ho potom spracoval (krok F5) | DAM: časť 5 | viditeľné, chyba admin-dam (PV9) |
| Z30 | Nové nepovinné pole `uploadedAssetId` riadku (krok PV10) | nikto; pole v kroku 5 nikto nečíta | zmluva API, pribúda (PV10) |
| Z31 | Klienta a adresy upload prečíta raz pre všetky tri požiadavky | nikto | vnútorné |
| Z32 | `apiTimeout: null` znamená 30 s aj v admin-dam | nikto pri platnej konfigurácii | vnútorné (chyba admin-dam, nedosiahnuteľná) |
| Z33 | Zastavený riadok, ktorý nie je v menovanej fronte, sa prestane sledovať | nikto (stav nie je dosiahnuteľný) | vnútorné |

---

## 4. Register komponentov (`navrh-komponenty.md` 6.1 a zblíženia z poznámok)

Spoločné bloky (riadok, zoznam, sidebar hromadných operácií, výbery, chipy, rámce detailu), ktoré admin-dam od U3
až U5c používa z knižnice.

| # | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| ZK1 | Prázdny prvok v riadku duplikátu zanikol | nikto | vnútorné |
| ZK2, ZK3, ZK4 | *Vypustené: ostáva na každej strane (kedy sa ponúkne „Obnoviť", tvar udalosti)* | | |
| ZK5 | Pravý okraj oblasti s kartami 16 px od šírky md | DAM: zoznam je na širokej obrazovke o 16 px užší | kozmetika (K-04) |
| ZK6 | Obe kontroly upozornenia po „Obnoviť" (riadok odišiel z fronty, riadok nie je v zozname) | nikto | vnútorné |
| ZK7 | Panely typov assetov v hromadných operáciách: štyri, každý len pre typ vo fronte | nikto (fronta knižnice má len obrázky) | vnútorné |
| ZK8 | „Vyčistiť" v hromadných operáciách vymaže výber kľúčových slov a autorov vždy | nikto | vnútorné |
| ZK9 | Nepoužitá vlastnosť tlačidla zastavenia admin-dam zanikla | nikto | vnútorné |
| ZK10 | Text chyby formulára bez ext systému má meno komponentu | vývojár v konzole | vnútorné |
| ZK11 | Zástupný obrázok je SVG (1 KB) namiesto JPEG (58 KB) | DAM: nič viditeľné, stránka stiahne o 57 KB menej | kozmetika (K-04) |
| ZK12 | Polia kľúčových slov a autorov odovzdajú „vypnuté" len vtedy, keď sú vypnuté | nikto | vnútorné |
| ZK13 | Chip mena autora a kľúčového slova sleduje cache aj zmenu identifikátora | DAM: chip ukáže nové meno, keď sa zmení. Opačne: keď cache meno vyhodí (nad 1 000 mien), chip sa točí, kým id niekto znova nepridá; v bežnej práci sa to nestane (od `OP13-L3` sa zobrazené meno nevyhodí, časť 5.17) | viditeľné, chyba admin-dam |
| ZK14 | Vysvetlenie pri `#id` („nepodarilo sa načítať") je v bubline aplikácie | DAM: bublina namiesto natívneho titulku prehliadača, text ten istý | kozmetika |
| ZK15 | Prázdny chip má „-" namiesto „ - " | DAM: nanajvýš medzera okolo pomlčky | kozmetika (K-04) |
| ZK16 | Filter hľadania autora bez prázdneho `canBeCurrentAuthor` | nikto | vnútorné |
| ZK17 | Presmerovanie po vytvorení autora zaniklo (mŕtvy kód) | nikto | vnútorné |
| ZK18 | Ikonové tlačidlo „nový autor" má prístupné meno | DAM: čítačka obrazovky tlačidlo pomenuje | viditeľné čítačke, chyba admin-dam |
| ZK19 | Jeden rozsah validácie dialógu „nový autor" | nikto | vnútorné |
| ZK20 | Jedna cache mien autorov a kľúčových slov | nikto; DAM pošle menej požiadaviek na mená | vnútorné |
| ZK21 | Zoznam typov súborov s medzerami alebo veľkými písmenami sa prijme aj v admin-dam | nikto pri dnešnej konfigurácii | vnútorné, chyba admin-dam |
| ZK22 | Sledovanie ťahania súborov nad oknom zapína aplikácia výslovne | nikto | vnútorné |
| ZK23 | Pravý okraj tlačidiel panela v dialógu jedného súboru ako v detaile | CMS, UGC: tlačidlá sú o 4 px bližšie k pravému okraju | kozmetika |
| ZK24, ZK26 | *Vypustené: ostáva na adaptér (obal okolo obrázka, zalamovanie panela)* | | |
| ZK25 | Prázdne obsluhy načítania obrázka v detaile zanikli | nikto | vnútorné |
| ZK27 | Bez čísla od ext systému sú pripnuté dve vlastné polia (admin-dam mal nula) | nikto v bežnom toku: backend číslo posiela vždy | vnútorné, nedosiahnuteľné |
| N-U1-1 | Brána vytvorenia autora a kľúčového slova s nastaveným právom odpovie „nie", kde `can()` admin-dam hodil výnimku (nenačítaný používateľ, `AllowOwner` bez subjektu) | DAM od U3: nič; namiesto výnimky v konzole by len chýbala ponuka | vnútorné |
| N-U1-2 | Chip s podaným titulkom, ktorého id DAM nevráti, ukáže aj bublinu „nepodarilo sa načítať" | DAM od U3: bublina pri titulku z výberu | viditeľné v DAM; **rozhodnuté 11. 10.** (časť 1) |
| N39-L-1, N39-D-1 | Hromadné uloženie, uloženie detailu a uloženie autorov galérie idú jednou požiadavkou a jednou hláškou | nič navyše oproti rozhodnutiu N39 (časť 5) | vnútorné |
| N39-L-2, N39-D-2 | Pri 422 kľúčových slov a autorov v detaile je v hláške názov poľa | CMS, UGC, DAM: text hlášky namiesto „Systémová chyba" s technickou hláškou | viditeľné, v rámci rozhodnutia N39 |

**Vnútorné prírastky, ktoré nič nemenia** (6.4): väzby `queue` a `operations` s predvolenými väzbami knižnice; chip
volá sklad až pri potrebe; `UploadQueueItemErrorOverlay` vyňaté z riadku; watcher „Obnoviť" admin-dam presunutý do
obalu; `AssetFileInfoPanel`; obaly admin-dam na doterajších cestách; kontrola práva na editor oblasti v rámci.

---

## 5. Rozhodnuté zmeny, ktoré nie sú zblížením

### 5.1 Opravy pred krokom 5

| Položka | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| **N32** (nálezy 32, 32b) | Uloženie galérie neposiela do DAM zápis autorov za riadky bez vybraného autora (prázdny zoznam prepísal autorov uložených medzitým v detaile assetu). Autor vybraný v riadku po prvom uložení sa zapíše do assetu riadku (doteraz sa nezapísal) | CMS: autori assetu v DAM ostanú; s nevybranými autormi uloženie galérie DAM nevolá. UGC nič | zmluva API (čo ide do DAM) |
| **N39** (nálezy 39, 29, 48) | Zlyhané hromadné uloženie metadát už nemlčí (štyri tlačidlá knižnice, štyri admin-dam): 500, sieť, 2xx iné než 200 a 401 „Systémová chyba…", 403 „Prístup zamietnutý…", vypršanie „Požiadavka na API vypršala…", 422 „Opravte tieto chyby." s riadkom na pole. Uloženie detailu: pri 422 jedna hláška s názvami polí, pri 2xx inom než 200 „Systémová chyba…" (doteraz ticho), pri vypršaní hláška o vypršaní. Uloženie autorov galérie: 403, vypršanie, „zakázaná operácia" a 422 vlastnou hláškou. Dialóg jedného súboru: tlačidlo, ktoré ukladá, sa točí, druhé je vypnuté. Zlyhanie (500, sieť, 2xx iné než 200) sa zapíše do zapisovača chýb API. Na backend to isté; pri 2xx inom než 200 sa ďalšie dávky nepošlú | CMS, UGC, DAM | viditeľné |

### 5.2 Jadro a fronta

| Položka | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| **M** (Z28) | Jeden merač: kruh a percentá sa hýbu aj počas kúska; súbor z jedného kúska nestojí na „0 %", po prevzatí posledného kúska prehliadačom je 100 % a 0 s už počas čakania na server; pri opakovanom pokuse percentá neklesnú; zvyšný čas je skôr dlhší (rýchlosť ráta aj čas servera). Veľkosti kúskov sa mierne zmenia | CMS, UGC (dialóg fronty, dialóg jedného súboru). DAM od C3, navyše na rýchlej sieti kruh s percentami a časom namiesto kolieska. Zastavenie toku uprostred kúska: po kroku M-A riadok drží poslednú rýchlosť a čas (časť 1) | viditeľné |
| **F2** (Z24) | Hromadné vyplnenie dá každému riadku vlastnú kópiu kľúčových slov, autorov a vlastného poľa s viac hodnotami | dnes nikto; na backend to isté | vnútorné |
| **F4** (Z26) | Zvyšok súboru, ktorý server zlyhal počas posielania, sa neposiela (kúsok na ceste sa zruší, ďalšie kúsky ani dokončenie neodídu); naraz idú najviac dva súbory. V riadku ostane čip s dôvodom od servera, neskorší text služby ho neprepíše. Zvyšný čas a percentá zamrznú pri hlásení servera | CMS (notifikácie zapnuté). DAM od C3, navyše bez textu a upozornenia skladu | viditeľné; menej požiadaviek |
| **F5 s F-A** (Z29, nález 49) | Riadok hromadnej úpravy, ktorého súbor zlyhal a server ho potom spracoval, je znova načítaný riadok: bez chyby, s „Upraviť", košom a formulárom, ide do hromadného uloženia; riadok bez metadát sa vráti na „Metadáta sa nepodarilo načítať…". Asset vybraný na hromadnú úpravu, ktorý nie je popísaný a jeho súbor sa ešte spracúva, dostane namiesto formulára text „Súbor assetu sa ešte spracúva…" a do hromadného uloženia nejde | DAM. S dnešným core-dam prvý sled pri jednom súbore nenastane (poistka pre poradie doručenia) | viditeľné |
| **F-B s 50** | Detail a pravý panel: „Uložiť" je vypnuté, kým asset nie je popísaný a jeho súbor sa spracúva, s vetou „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova." Uloženie z detailu alebo panela zapíše odoslané hodnoty do riadkov toho assetu vo frontách, takže neskoršie hromadné uloženie pošle uložené, nie staré hodnoty. Po hromadnom uložení sa asset, ktorý drží detail, načíta znova (aj pri zatvorenom paneli), s loaderom nad panelom | DAM | viditeľné; mení, čo pošle neskoršie hromadné uloženie |
| **PV10** (Z30) | Riadok duplikátu si pamätá vlastný asset v novom nepovinnom poli `uploadedAssetId` | nikto; pole v kroku 5 nikto nečíta | zmluva API, pribúda |
| **PV14a** | Fronta nesie meno konfigurácie DAM; upload a čítania assetov idú klientom a adresami tej konfigurácie. Pribúda nepovinné `UploadReadOptions.queueKey` a druhý parameter `options?` čitateľa `duplicateOriginAsset`. Pridanie pod menom, ktoré nie je v `coreDam.configs`, a pridanie pod iným menom do fronty s riadkami sa odmietne výnimkou | nikto: CMS, UGC aj DAM majú len `default` | zmluva API, pribúda |
| **PV16** | Knižnica: `useApiFetchList` má nepovinné `report` (`false`: chyba sa hodí, zapisovač chýb ju nedostane). DAM: dopytovanie distribúcií na pozadí zapíše len prvé zlyhanie v rade; karta distribúcií otvorená pre iný asset pri zlyhanom čítaní ukáže chybu a prázdny zoznam (doteraz pod chybou ostali distribúcie predošlého assetu) | DAM: karta distribúcií pri chybe; inak nikto | knižnica: zmluva API, pribúda; DAM: viditeľné len pri chybe |

### 5.3 Komponenty a widgety knižnice

| Položka | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| **R10** | 12 anglických reťazcov admin-dam podľa knižnice (časť 2) | DAM, anglické rozhranie | viditeľné (text) |
| **U8** (názvy polí) | Dve ikonové tlačidlá pri každom poli hromadných operácií majú v prístupnom mene aj názov poľa („Vyplňte prázdne pole: Kľúčové slová"). Bubliny ostávajú krátke, tri tlačidlá dole sa nemenia. Dva nové kľúče v troch jazykoch | čítačka obrazovky: CMS, UGC, DAM od C3; na obrazovke nič | viditeľné čítačke; znenie **potvrdené 11. 10.** |
| **R16** | Vymyslený `AssetDetailItemDto` v dialógu jedného súboru zanikol (U6) | nikto | vnútorné |
| **PK3** (nález 46) | Posun zoznamu fronty klávesmi nechá kláves prehliadaču, keď je kurzor v textovom poli riadku alebo v otvorenom menu poľa: šípky, PageUp, PageDown, Home a End fungujú v poli, číselné pole šípkami mení hodnotu. Mimo poľa, na prepínači a tlačidle sa zoznam posúva ako doteraz | CMS, UGC, dialóg fronty. DAM nie (posun klávesmi má vypnutý) | viditeľné |
| **Nález 20 so 17** (N20) | Kópia vybraných assetov do licencie widgetu ide na cestu koncového bodu obrázka (`endPointImage` + `/copy-to-licence`, v CMS `PATCH /adm/v1/image/copy-to-licence`) namiesto koncového bodu assetu, ktorý ju nemá. Zlyhaná kópia sa zapíše do zapisovača chýb API. Od N20-c2: kópiu rozhoduje licencia každého vybraného assetu, nie licencia práve prehliadaná; asset už v licencii nahrávania sa nekopíruje a vezme sa, ako je | CMS: „kopírovať do licencie" doteraz skončilo chybou, teraz kópia uspeje. Galéria pri výbere z dvoch licencií: **potvrdené 11. 10.** (časť 1). UGC a DAM nič | viditeľné; zmluva API (adresa požiadavky) |
| **N20V** | Nepovinná voľba konfigurácie DAM `copyToLicenceEnabled`: pri `false` výber assetu prepínač „Kopírovať do licencie" neukáže a widgety kópiu nepošlú. Predvolene (voľba chýba) ako doteraz | predvolene nikto; UGC, až ju vypne (časť 7) | zmluva API, pribúda |
| **33** | Výber assetu sa po hláške „licencia nie je povolená" neotvorí prázdny; pri ďalšom stlačení sa hláška ukáže znova | CMS: používateľ bez používateľa DAM pre licenciu widgetu. DAM od C3 tam, kde pripája `AAssetSelect` knižnice (posudok C3). UGC kontrolu preskakuje | viditeľné |
| **25** | Dialóg jedného súboru ponúkne „Obnoviť" aj pri zlyhanej položke, ktorej obnovenie ešte môže pomôcť (upload vzdaný klientom po odoslaní dokončenia; duplikát s nenačítaným originálom), ako riadok fronty. Formulár a uloženia ostávajú vypnuté | CMS, UGC | viditeľné |
| **28** | Po „Obnoviť" sa „Asset sa stále nahráva alebo spracováva serverom" neukáže riadku, ktorý počas čítania skončil (zlyhal, nahral sa, zastavil sa) alebo odišiel z fronty | CMS, UGC (riadok fronty, dialóg jedného súboru); DAM od C3 | viditeľné |
| **30** | Keď po kontrole formátu a veľkosti nezostane žiadny súbor, widget dialóg uploadu neotvorí (doteraz dialóg jedného súboru s nekonečným načítavaním, v galérii prázdny dialóg fronty); upozornenie ostáva | CMS, UGC | viditeľné |
| **31** | Pozíciu nových obrázkov galérie prideľuje len widget; dialóg fronty ju už nezvyšuje. Nové obrázky idú do API obrázkov bez medzery (po dvoch starých 3 a 4 namiesto 5 a 6) | na obrazovke nikto; CMS, UGC: iné čísla `position` v požiadavke | zmluva API (čo ide na backend) |
| **36** (s 63) | (A) Do `createImage`, `updateImage` a `bulkUpdateImages` idú len polia obrázka: `texts`, `flags`, `dam`, a `position` a `id`, keď ich obrázok má. Doteraz šlo navyše `authorIds`, `assetId`, v galérii `key`, `damAuthors`, `showDamAuthors`, a pri úprave prečítaného obrázka všetko, čo čítanie aplikácie vrátilo (v CMS `ownerResourceName`, `ownerResourceId`, `site`, `siteGroup`, `removedAt`). (B) Widget neprečíta obrázok, ktorý práve vytvoril; ukáže ho z odpovede `createImage`. (C) Hromadné uloženie metadát pošle `mainFileSingleUse: false` namiesto `null`. Uložené dáta sa nemenia | CMS, UGC: náhľad po vytvorení neblikne a zlyhané druhé čítanie neukáže chybu po úspešnom uložení. CMS: kratšie telo `POST`/`PUT /adm/v1/image`, audit log core-cms bez tých kľúčov. UGC telo skladá sám | **zmluva API** (vlastné `updateImage` a `bulkUpdateImages` aplikácie dostanú len polia obrázka; o jedno čítanie menej); viditeľné (B) |
| **43** | Potvrdzovacie tlačidlo otázky pri zastavení má vlastný kľúč „Zastaviť" (časť 2) | CMS, UGC, DAM od C3 | viditeľné (text) |
| **44** | Pod poľom autorov sa neponúkne konflikt autora, ktorého pole už má; keď nezostane žiadny, zmizne aj nadpis „konflikty". Keď autor z poľa odíde, konflikt sa ponúkne znova | CMS: riadok fronty a dialóg jedného súboru. DAM od U3 (detail) a U5c (riadok). UGC nie | viditeľné |
| **45** (IM11) | Widget obrázka s médiom číta pri vybranom assete vlastné mapovanie aplikácie (`customAssetSelectMetadataToImageMap`) ako widget obrázka | dnes nikto: CMS mapovanie nemá, UGC nemá widget s médiom | vnútorné dnes |
| **47** | Z viacerých súborov pustených naraz na widget jedného obrázka sa nahrá len prvý a ukáže sa upozornenie (časť 2). Doteraz sa nahrali všetky a v DAM ostali assety bez obrázka | CMS, UGC: widget obrázka a widget s médiom; na backend jeden upload namiesto viacerých | viditeľné |
| **62** | Detail assetu neukáže pod „Spracovanie súboru zlyhalo" čip „None", keď DAM dôvod neuvedie | CMS, UGC | kozmetika |
| **64** | Dialóg jedného súboru: odmietnutý súbor ukáže sivý zástupný rámček na celej ploche so závojom chyby (doteraz ikona a texty cez sivý krúžok). Plochu dostane každý stav so zástupným rámčekom | CMS, UGC | viditeľné |
| **F-C s F-D** (nález 49) | Pri assete, ktorý nie je popísaný a ktorého súbor server ešte nespracoval: detail assetu má „Uložiť" vypnuté s vetou „Asset sa stále nahráva alebo spracováva serverom" (F-C); widget obrázka a widget s médiom takému assetu bez autorov neponúkne autorov DAM, zdroj sa píše ručne (F-D). Na backend v tom stave nejde uloženie metadát ani autorov | CMS, UGC (F-C); CMS s ext systémom s autormi (F-D). Prakticky len pri čerstvom ID vloženom do hľadania výberu; v CMS aj v okne uploadu (**rozhodnuté 11. 10.: ostáva**, časť 1) | viditeľné |
| **PV14b** | Meno konfigurácie DAM sa dedí stromom komponentov: výslovná `configName`, inak meno najbližšieho predka, inak `default`. Pod widgetom, výberom alebo detailom s menom idú všetky požiadavky na klienta a adresy tej konfigurácie (upload a jeho dialógy, výber assetu a jeho detail, uloženie detailu, hľadanie a vytvorenie autorov a kľúčových slov s právom tej konfigurácie, hromadné operácie obrázkov, validácie). Cache mien a notifikácie ostávajú spoločné pre stránku cez `default`. Vlastnosť `configName` už nemá predvolené `'default'`; nepovinnú `configName` dostali `AImageMassOperations`, `ADamKeywordRemoteAutocompleteWithCached`, `ADamAuthorRemoteAutocompleteWithCached`, `ADamAuthorCreateButton`, `ADamAuthorFilterRemoteAutocomplete`, `ADamKeywordFilterRemoteAutocomplete`. **Nie je len prírastok:** `AImagePublicInput` číta pod svojím menom aj voľby DAM (doteraz z `default`); s menom, ktoré je len v `image.configs`, pri vzniku hodí výnimku | nikto: CMS, UGC aj DAM majú len `default` (UGC ho podáva výslovne, časť 7). Aplikácia s druhou konfiguráciou | zmluva API |

### 5.4 Opravy v admin-dam

| Položka | Čo sa zmenilo | Kto to uvidí | Zaradenie |
|---|---|---|---|
| **19** | Po „Zrušiť" riadku importu alebo po zastavení fronty s importom na ceste sa neukáže „Systémová chyba…", keď server import potom odmietne | DAM | viditeľné |
| **38** | Kôš na riadku fronty odoberie riadok, na ktorom bol stlačený, aj keď má fronta viac riadkov toho istého assetu | DAM; v bežnom toku nič (cesta k dvom riadkom jedného assetu s košom sa nenašla) | vnútorné |
| **40** | Chipy konfliktov autorov v riadku hromadnej úpravy ukážu mená namiesto točiaceho sa kolieska | DAM | viditeľné |

### 5.5 Kroky bez zmeny pre používateľa

- **K0 až K6, U0 až U7, C2, C3:** presun kódu do spoločného jadra a blokov a kópia knižnice v admin-dam; všetko, čo
  sa pri tom zblížilo, je v častiach 3 a 4.
- **U7:** jedna funkcia `createDamImage` na deviatich miestach; mení sa len poradie kľúčov v JSON tela.
- **Zmluva API, pribúda** (pre admin-dam nad spoločným kódom): voľby `keywordCreateAcl` a `authorCreateAcl`
  (predvolene žiadne právo, ako doteraz v knižnici; admin-dam ich nastavuje); vyvezené jadro uploadu
  (`damFileUploadStart`, `damFileUploadChunk`, `damFileUploadFinish`, `useDamUpload`, `uploadStop`,
  `uploadValidationMessage`, `adminDamUploadPreset`, `createUploadQueueCore`, `UPLOAD_QUEUE_ITEM_CHUNK_SIZE`,
  `adminDamQueuePreset`, `adminDamImportRun`, `uploadQueueFillAuthors`, `uploadQueueFillKeywords`,
  `uploadQueueFillCustomDataValue` a ich typy) a komponenty (`ADamAssetImage`, `ADamAssetImageMetaIcons`,
  `ADamAssetFileFailReasonChip`, `ADamAssetCustomMetadataForm`, `ADamUploadQueueStopButton`,
  `ADamKeywordRemoteAutocompleteWithCached`, `ADamAuthorRemoteAutocompleteWithCached`, `ADamAuthorCachedChip`,
  `ADamAuthorCreateButton`, `ADamUploadQueueItem`, `ADamUploadQueueList`, `ADamUploadQueueMassOperations`,
  `useDamAssetFileFailReason`, `useDamCachedAuthors`, `useDamCachedKeywords`, `useExtSystemIdForCached`,
  `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig`, `useFormatAndSizeCheck`,
  `UploadQueueSuggestionsKey`). Zoznam pripína `src/test/publicExportsAdded.test.ts`.

---

### 5.6 Opravy overených nálezov (12. 10., kroky OP-L1 až OP-L3 a OP-D1 až OP-D3)

Rozhodol vlastník 12. 10. po overení (`overenie-nalezov.md`); podrobnosti v `impl/OP-*.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-1 (59, 84) | Po uložení detailu otvoreného z dialógu fronty sa do riadkov zapíše presne to, čo sa odoslalo, aj keď nové čítanie assetu zlyhá alebo sa detail medzitým zavrie; ďalšie uloženie fronty už uložené hodnoty neprepíše. Pri zatvorenom detaile jedno čítanie assetu navyše | CMS, UGC | viditeľné (oprava straty dát) |
| FE-2 (74) | Galéria bez kópie číta vybrané assety po licenciách assetov; obrázky z inej licencie dostanú popis, zdroj a autorov. Pri jednej licencii rovnaké požiadavky; zlyhané čítanie jednej licencie ukáže chybu a ostatné sa dočítajú | CMS, UGC | viditeľné |
| FE-3 (55) | Uloženie autorov pri výbere assetu cez spoločného pomocníka: pri 422 jedna hláška, „Potvrdiť" sa už nezasekne; pri vypršaní času hláška o čase, pri 2xx inom než 200 systémová chyba, zlyhanie ide do zapisovača chýb. Požiadavka bez zmeny | CMS | viditeľné (hlášky) |
| FE-4 (54) | Riadok galérie, ktorého asset DAM nevrátil, si po uložení nechá pole zdroja | CMS | viditeľné |
| FE-5 (79) | Pri prekročení limitu 50 súborov sa dialóg fronty neotvorí prázdny | CMS, UGC | viditeľné |
| FE-6 (81) | Dialóg výberu súboru skontroluje všetky pustené súbory a vezme prvý platný; upozorní, keď kontrolou prejde viac než jeden | CMS, UGC (widgety obrázka) | viditeľné |
| FE-7 (78) | Dialóg detailu obrázka označí príliš dlhý popis | CMS, UGC | viditeľné |
| FE-8 (82), FE-9 (67) | Prístupné mená: tlačidlá hromadných operácií galérie s názvom poľa; „+" na chipe konfliktu autora „Pridať autora" (nový kľúč `common.damImage.author.button.addConflict`, sk, en, cs) | čítačka obrazovky: CMS, UGC, DAM | viditeľné čítačke; znenie potvrdené vlastníkom 12. 10. |
| FE-10 (75) | Dialóg jedného súboru ukáže údaje súboru len vtedy, keď patria assetu jeho riadku | CMS, UGC | viditeľné |
| FE-11 (60) | Druhé stlačenie uloženia počas ukladania sa ignoruje (dialóg fronty, detail) | CMS, UGC | viditeľné (klávesnica) |
| FE-12 (koreň 49) | Hromadné uloženie admin-dam posiela len zmenené polia. Nedotknutý riadok popísaného assetu sa neposiela vôbec, nepopísaného ide ako `{id, described: true}`; riadok, pri ktorom sa nevie, čo prišlo zo servera, ide celý. Čítania a uloženia majú poradie, staršia odpoveď novší stav neprepíše. **Viditeľné:** nedotknutý asset už nedostane ukladajúceho ako posledného upravovateľa ani nový čas úpravy a nepreindexuje sa | DAM | **zmluva API** (kratšie telá `PATCH /asset/metadata-bulk-update`); viditeľné (upravovateľ, čas úpravy) |
| FE-13 (73) | Dávka čítania výberu neprepíše riadok, ktorý používateľ zmenil alebo ktorý má novší stav | DAM | viditeľné |
| FE-14 (PV16-D) | Karta distribúcií po zlyhanom prvom čítaní ukáže „Distribúcie sa nepodarilo načítať." s tlačidlom „Skúsiť znova" (nový kľúč `coreDam.distribution.common.loadFailed`, sk, en) | DAM | viditeľné; znenie potvrdené vlastníkom 12. 10. |
| FE-15 (56) | Pravý panel zoznamu po zlyhanom uložení ostane označený ako neuložený | DAM | viditeľné |
| FE-16 (14, časť) | Dvanásť ikonových tlačidiel dostalo bublinu z existujúcich textov; kôš, ktorý externý asset len odoberie z výberu, má nový text „Odobrať z výberu" (`coreDam.asset.selected.remove`, sk, en). Mená pre čítačku obrazovky sa nerobili (rozhodnutie vlastníka: len bubliny). Nový strážny test `src/test/a11y/iconButtonTooltips.test.ts` | DAM | viditeľné; znenie, obe bubliny z existujúcich textov („Vymazať", „Obnoviť") aj strážny test potvrdené vlastníkom 12. 10. |
| FE-17 (71) | Zmazaný mŕtvy riadok typov a nevolané akcie `resetList()` a `reset()` skladu distribúcií | nikto | vnútorné |

Dokázané a ponechané bez opravy: 61, 65, 80, 88, 89. Známe medze FE-12 sú v `impl/OP-D2.md` („Známe medze").

### 5.7 Opravy z druhého a tretieho overenia (12. 10., kroky OP2-L1, OP2-L2, OP2-D1, OP2-D2)

Rozhodol vlastník 12. 10. po overení nálezov 90 až 116 (`overenie-nalezov.md`, časti „Druhé overenie" a „Tretie
overenie"); podrobnosti v `impl/OP2-*.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-18 (102) | Galéria ponúkne výber autorov DAM len riadku, ktorého asset sa naozaj prečítal (výber z knižnice) alebo za ktorý odpovedalo uloženie fronty („Uložiť a použiť"), a ktorý nemá autorov. Inak riadok ukáže pole Zdroj; predtým dostal prázdny výber autorov a uloženie galérie nahradilo skutočných autorov assetu v DAM. **Viditeľné:** Zdroj takého riadku je povinný (predvolené) a prázdny, galéria sa neuloží, kým ho redaktor nevyplní alebo riadok neodoberie. Nastane výnimočne: čítanie pri výbere zlyhá, alebo notifikácia metadát po nahraní chýba či mešká | CMS (UGC autorov DAM nemá) | viditeľné (oprava straty dát) |
| FE-19 (94) | Dialóg jedného súboru zatvorený skôr, než zlyhá čítanie assetu nahraného súboru, už neukáže chybovú hlášku; zlyhanie ide do zapisovača chýb ako doteraz | CMS, UGC | viditeľné |
| FE-20 (108) | Uloženie detailu číta asset pre frontu len vtedy, keď niektorá fronta má riadok toho assetu; predtým po prvom otvorení detailu z fronty pri každom uložení do obnovenia stránky | CMS, UGC | vnútorné (o požiadavku menej, hláška „uložené" skôr) |
| FE-22 (90) | Karta distribúcií pri otvorení vyprázdni zdieľaný zoznam: zlyhané opätovné otvorenie karty toho istého assetu ukáže „Distribúcie sa nepodarilo načítať." a „Skúsiť znova" namiesto zoznamu z predošlého otvorenia. Po takom zlyhaní sa na pozadí nič nečíta | DAM | viditeľné |
| FE-23 (105) | Nové vlastné čítanie karty distribúcií zruší predošlé; predbehnutá odpoveď nezapíše zoznam, stránkovanie ani príznak zlyhania, nevypne loader a jej zlyhanie sa nehlási | DAM | viditeľné |
| FE-24 (91) | Po zmazaní distribúcie v rozšírených nastaveniach ostane loader až do nového zoznamu; zmazaná položka sa už na chvíľu nevráti | DAM | viditeľné |
| FE-25 (109) | Bubliny panela editora exportných dát podcastu idú cez preklad: nové kľúče `system.editor.*` (sk, en): „Tučné", „Kurzíva", „Podčiarknuté", „Odkaz", „Odstrániť odkaz" | DAM | viditeľné; znenie schválil vlastník 12. 10. |
| FE-26 (110) | Hromadné „vyplniť prázdne" autorov galérie už neprepíše vyplnený viditeľný Zdroj. Prázdny Zdroj (aj zložený len z medzier) plní ako doteraz; s prázdnym výberom nerobí nič a neposiela požiadavku. „Nahradiť" bez zmeny | CMS | viditeľné; pravidlo (užšie než pôvodné znenie) potvrdil vlastník 12. 10. |
| FE-27 (111, 123) | Kým dialóg fronty ukladá („Uložiť" aj „Uložiť a použiť"), jeho „+" a dropzóna sú vypnuté a vlastný vstup hostiteľa (zoznam assetov s vlastnou dropzónou stránky) súbor neprijme. Predtým sa taký súbor začal nahrávať a po uložení sa potichu zahodil | CMS, UGC | viditeľné |
| FE-28 (112) | `AFileInput` po spracovaní výberu vyprázdni natívny vstup: ten istý súbor sa dá vybrať znova | UGC (tlačidlo „Nahrať" zoznamu assetov); ostatní hostitelia bez zmeny | viditeľné |
| FE-29 (114) | Dialóg zrušenia čakajúcej distribúcie sa po úspechu zavrie a ukáže „Záznam bol odstránený."; kým zrušenie beží, ďalšie „Potvrdiť" nič neodošle | DAM | viditeľné |
| FE-30 (115) | „Potvrdiť" dialógu záznamu distribúcie sa počas ukladania točí a ďalšie stlačenie ignoruje | DAM | viditeľné |
| FE-31 (116) | „Odstrániť odkaz" v editore exportných dát podcastu sa ukáže, keď je kurzor v odkaze, a mimo neho zmizne; predtým sa rozhodlo raz pri otvorení | DAM | viditeľné |

FE-21 (104, rovnaké meno „+" konfliktov autorov pre čítačku) ostáva bez opravy podľa odporúčania. Vypadli: 92, 93,
96, 97, 98, 99, 101, 103, 106, 113.

Prijaté medze týchto opráv: FE-22: mazanie, ktoré odpovie počas čítania znovu otvorenej karty toho istého assetu,
jej vypne loader a karta do odpovede ukazuje „Nie je čo zobraziť". FE-24: keď sa rozšírené nastavenia skryjú alebo
karta zavrie počas mazania, zoznam sa znova neprečíta a zmazaná položka ostane do ďalšieho čítania (ako predtým).
FE-27: kópia do licencie potvrdená pred otvorením dialógu fronty, ktorej odpoveď príde počas „Uložiť a použiť",
sa zaradí a odíde s frontou (nález 128). FE-29: kým beží zrušenie jednej distribúcie, „Potvrdiť" dialógu otvoreného
medzitým pre inú sa točí a nič neodošle; neskorý úspech prvej ten dialóg nezavrie.

### 5.8 Opravy zo štvrtého overenia (12. 10., kroky OP3-L1 a OP3-D1)

Rozhodol vlastník 12. 10. po overení nálezov 117 až 129 (`overenie-nalezov.md`, časť „Štvrté overenie");
podrobnosti v `impl/OP3-L1.md`, `impl/OP3-D1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-32 (117) | Galéria po zavretí detailu assetu otvoreného z riadku („upraviť asset") prečíta asset, ktorý detail ukazoval, a riadkom toho assetu, ktoré ponúkajú výber autorov DAM, dá jeho autorov: Zdroj = ich mená, výber sa skryje. Na dobiehajúce uloženie detailu čítanie počká; uloženie galérie počká na bežiace čítanie. Čo redaktor v riadku vybral predtým, ustúpi tomu, čo detail uložil. Predtým riadok ostal s prázdnym výberom: uloženie galérie nahradilo autorov z detailu vybranými, alebo uložilo obrázok s prázdnym zdrojom. Po zavretí detailu jedno až tri čítania navyše | CMS | viditeľné (oprava straty dát) |
| FE-33 (119, 129) | „Uložiť a použiť" dialógu fronty najprv prečíta nahrané riadky bez formulára (rovnaké čítanie ako „obnoviť"); ak niektorý formulár dostal, zastaví sa s upozornením „Niektorým súborom sa práve načítali metadáta. Skontrolujte ich a uložte znova." (nový kľúč `common.damImage.upload.metadataJustLoaded`, sk, en, cs) a nič neuloží ani neodovzdá. Ak čítanie formulár nedá, pokračuje ako doteraz. `dam.internal` obrázka sa berie z riadku, keď ho odpoveď uloženia nemá | CMS (notifikácie); UGC sa netýka | viditeľné; znenie potvrdil vlastník 12. 10. |
| FE-34 (124) | Vypnutá dropzóna dialógu fronty (počas ukladania) sa pri ťahaní súboru nerozsvieti | CMS, UGC | viditeľné (kozmetika) |
| FE-35 (127) | „+" dialógu fronty je zastávka klávesu Tab; súbor sa dá pridať z klávesnice | CMS, UGC | viditeľné (klávesnica) |
| FE-36 (121) | Po úspešnom zmazaní distribúcie sa riadok hneď odoberie zo zoznamu, ešte pred čítaním; po zlyhanom alebo nevykonanom čítaní už zmazaná distribúcia neostane. Zatvára medzu FE-24 z časti 5.7 (nastavenia skryté počas mazania) | DAM | viditeľné |
| FE-37 (125) | Dialóg záznamu distribúcie sa počas ukladania nedá zavrieť („Zrušiť" vypnuté, krížik bez účinku) | DAM | viditeľné |

Vypadli: 118, 120, 122, 128 (nedokázané), 126 (vyvrátené).

Prijaté medze týchto opráv: FE-32: po ZLYHANOM opätovnom čítaní si riadok výber autorov nechá a uloženie galérie
zapíše, čo je v ňom vybrané; príznak bežiaceho uloženia detailu nie je viazaný na asset (zavretie iného detailu
počká aj naň); detail otvorený z dialógu fronty po zavretí nečíta nič. FE-36: vlastné čítanie karty, ktoré pri
odpovedi DELETE už beží, alebo karta toho istého assetu otvorená znova počas mazania, vie zmazaný riadok vrátiť do
ďalšieho čítania. FE-37: skryté rozšírené nastavenia, zavretá karta alebo prepnutie detailu na susedný asset
šípkou počas ukladania dialóg odpoja (nález 131).

### 5.9 Opravy z piateho overenia a FE-44 (12. 10., kroky OP4-L1 a OP4-D1)

Rozhodol vlastník 12. 10. po overení nálezov 130 až 135 (`overenie-nalezov.md`, časť „Piate overenie"); FE-44 je
nová vec na jeho pokyn. Podrobnosti v `impl/OP4-L1.md`, `impl/OP4-D1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-38 (132) | „Upraviť asset", ktorého čítanie z DAM zlyhá, už nezasekne stránku: detail sa zavrie a chybová hláška sa ukáže raz. Predtým ostala stmavená mŕtva stránka, pomohlo len obnovenie a neuložená práca bola preč (pri obrázku so zmazaným assetom pri každom kliku). Galéria, oba widgety jedného obrázka, dialóg fronty | CMS, UGC | viditeľné (oprava straty práce) |
| FE-39 (135) | Detail ukáže vždy asset posledného otvorenia: oneskorená odpoveď skoršieho čítania sa zahodí, otvorenie začína z prázdneho detailu, zavretie sa vzdá čítania na ceste. Čítanie bočného panela zoznamu assetov neprepíše detail otvorený medzitým. Vnútri: akcie skladu detailu `open`, `close`, `readBesideDetail` (sklad sa nevyváža) | CMS, UGC | viditeľné |
| FE-40 (133) | Po „Uložiť a použiť" si riadky galérie toho istého assetu, ktoré ponúkali výber autorov, prevezmú autorov a Zdroj z práve použitého obrázka (duplikát nahraný cez frontu) | CMS | viditeľné |
| FE-41 (134) | Dropzóna zozelenie, keď je ťahaný súbor nad ňou; doteraz bola pri ťahaní vždy modrosivá (od 2023). Vypnutá zóna neukáže nič | CMS, UGC | viditeľné; chcel vlastník 12. 10. |
| FE-42 (130) | Po úspešnom zastavení čakajúcej distribúcie riadok hneď zmizne zo zoznamu (spoločná akcia skladu `removeListItem` s FE-36) | DAM | viditeľné |
| FE-43 (131) | Šípky ← a → neprepnú detail na susedný asset, kým je nad detailom otvorený iný dialóg alebo menu; bublina a hláška ich neblokujú | DAM | viditeľné |
| FE-44 (nové) | Prechod z detailu na susedný asset (šípkou aj tlačidlami lišty) sa pri neuložených metadátach najprv spýta dialógom knižnice „Neuložené zmeny" (existujúce texty): „Zostať" nechá detail, „Odísť aj tak" prepne. Za neuloženú zmenu sa ráta aj zmena štyroch prepínačov karty Info. Uloženie v detaile značku „rozpísané" ruší (doteraz nie) | DAM | viditeľné; na pokyn vlastníka 12. 10. |

Viditeľné vedľajšie dôsledky FE-44: „Uložiť" bočného panela zoznamu sa zvýrazní aj po zmene prepínača a po
uložení v detaile už zvýraznené neostane.

Prijaté medze týchto opráv: FE-39: keď kľúč detailu jedného hostiteľa nahradí kľúč iného (cez rozhranie
nedosiahnuteľné), prvý sa dozvie o zániku svojho detailu; widget jedného obrázka, ktorého detail sa zavrel
z loadera, už nedostane asset z oneskorenej odpovede a výber autorov v dialógu obrázka tam ostane preč (staršia
chyba za tým je nález 136). FE-44: otázka len pri otvorenom detaile, ktorý ukazuje asset; šípka počas uloženia
na ceste sa nepýta, a ak to uloženie zlyhá, rozpísané je preč; na poslednom assete zoznamu sa otázka ukáže, hoci
suseda niet, a „Odísť aj tak" prečíta ten istý asset znova; uloženie bočného panela, ktoré zlyhá až po úspešnom
uložení v detaile, značku vráti (otázka o už uložených zmenách); Esc na otázke nezaberie, kým je nad ňou čerstvá
hláška.

### 5.10 Opravy zo šiesteho overenia, FE-45 a FE-63 (12. a 13. 10., kroky OP5-L1, OP5-D1 a OP5-D2)

Rozhodol vlastník 12. 10. („1 2 3" a „suhlasim s opravami"; `overenie-nalezov.md`, časť „Šieste overenie").
FE-63 je rozhodnutie vedúceho, vlastníkovi oznámené. Podrobnosti v `impl/OP5-L1.md`, `impl/OP5-D1.md`,
`impl/OP5-D2.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-45 (144) | Otázka „Neuložené zmeny" aj pri zatvorenom detaile, keď panel zoznamu drží rozpísané metadáta: pred klikom na inú dlaždicu alebo riadok tabuľky, šípkami v zozname, ceruzkou a dvojklikom inej dlaždice. Pýta sa len vtedy, keď by sa asset naozaj čítal (nie na aktívnej dlaždici do 5 s), nezávisle od toho, či je panel schovaný. „Zostať" nič nezmení; „Odísť aj tak" urobí akciu ako doteraz. Po zmazaní assetu v detaile sa nepýta. Tlačidlo „upraviť" riadka v tabuľkovom pohľade sa pri obyčajnom kliku nepýta (odchádza na stránku detailu) | DAM | viditeľné; na pokyn vlastníka |
| FE-46 (148) | Detail assetu externého poskytovateľa ukáže vždy svoj obrázok; výber ROI s obrázkom DAM z predošlého detailu sa tam už nenakreslí | DAM | viditeľné (oprava zápisu do nesprávneho obrázka) |
| FE-47 (146) | Po zmene hlavnej trasy súboru („Make private", „Make public") sa číta asset, ktorý detail alebo panel drží (nie aktívna dlaždica), a len po úspechu. S rozpísanými metadátami sa z odpovede prevezme len trasa súboru: napísané ostane, „Uložiť" ostane zvýraznené, otázka ostane. Menu „⋮" sa po úspechu zavrie. Tri obaly „Make private" berú za úspech aj odpoveď 204, ktorú backend pri obrázku a dokumente naozaj dáva (doteraz padal každý úspech do vetvy chyby a zachraňovalo ho čítanie po chybe) | DAM | viditeľné |
| FE-63 (nové) | Odmietnutá zmena trasy ukáže raz všeobecnú hlášku „Systémová chyba…" (doteraz nič). Kým je zmena na ceste, ďalší klik nič nepošle | DAM | viditeľné; rozhodnutie vedúceho, vlastníkovi oznámené |
| FE-48 (141), FE-50 (142) | Šípky ← → nerobia nič v detaile, ktorý nie je zo zoznamu (po „Vytvoriť prázdny asset", z fronty). „Upraviť" v paneli zoznamu otvorí detail s tlačidlami predchádzajúci/ďalší, počítadlom a názvom, keď panel drží asset aktívnej dlaždice | DAM | viditeľné |
| FE-49 (145) | Na konci a na začiatku načítaného zoznamu šípka ani tlačidlo lišty nerobia nič (žiadne čítanie, žiadna otázka); tlačidlá lišty sú tam vypnuté. Ďalšia strana sa z detailu nenačíta (rozhodnutie vlastníka) | DAM | viditeľné |
| FE-51 (147), FE-52 (150) | Lišta pod loaderom ukáže „1 / N" aj pre prvý asset. Šípka v zozname pri zatvorenom detaile už nemení adresu na `/assets/<id>` | DAM | viditeľné |
| FE-53 (137) | Dialóg obrázka widgetov jedného obrázka ponúkne výber autorov DAM len nad assetom, ktorý widget sám prečítal pre zobrazený obrázok; dva widgety jednej stránky sa nevidia. Po „nahradiť z DAM" a zavretí krížikom ukáže „upraviť metadáta" pôvodný obrázok s jeho povinným Zdrojom | CMS | viditeľné (oprava zápisu autorov do cudzieho assetu) |
| FE-54 (136) | Po „upraviť asset" v dialógu obrázka a zavretí detailu sa asset prečíta znova: má autorov, Zdroj sa vyplní ich menami a je povinný; nemá, výber ostane. „Potvrdiť" stlačené počas toho čítania naň počká (tlačidlo sa točí). Detail zavretý z loadera už výber nestratí | CMS | viditeľné |
| FE-55 (140) | Detail assetu sa zavrie, keď zanikne komponent, ktorý ho kreslí (odchod zo stránky, Späť v prehliadači): na ďalšej stránke sa nič neotvorí | CMS, UGC | viditeľné |
| FE-56 (139) | Galéria ukladá riadky jedného assetu spolu: autori vybraní v ktoromkoľvek z nich idú do assetu raz (rôzne výbery sa spoja) a Zdroj z mien dostanú všetky jeho riadky s výberom. Riadky sa zmenia až po tom, čo DAM zápis autorov prijme | CMS | viditeľné |
| FE-57 (149), FE-58 (138) | Bočný panel zoznamu assetov ukáže asset, o ktorý sa žiadalo naposledy (klik aj čítanie po zavretí detailu v jednom poradí). Zrušený alebo potvrdený výber z DAM sa vzdá čítania na ceste; ext systém stránky sa zapisuje už pri kliku na dlaždicu (aj po odpovedi) | UGC, CMS | viditeľné len pri súbehu |

Prijaté medze týchto opráv: FE-45: pod loaderom panela sa nepýta; dvojklik na inú dlaždicu sa pýta pri prvom kliku
a „Odísť aj tak" potom dlaždicu len vyberie; klik počas uloženia panela na ceste sa nepýta. FE-47: s rozpísanými
metadátami sa ostatné zmeny servera ukážu až pri ďalšom čítaní; stráž dvojitého odoslania drží len počas požiadavky.
FE-63: hláška je všeobecná aj tam, kde server dôvod pozná (403, 422; nález 176). FE-50: po novom načítaní zoznamu
otvorí „Upraviť" panela detail bez lišty, keď asset nie je na zapamätanom mieste (rieši FE-61). FE-53: existujúci
obrázok toho istého súboru, aký má asset vybraný a zavretý bez uloženia, výber dostane; widget sa nedozvie
o autoroch, ktorých asset dostal inde. FE-54: po zlyhanom čítaní výber ostane; keď dialóg zavrú skôr, než čítanie
odpovie, a asset autorov má, zdroj treba dopísať ručne. FE-55: hostiteľ znovu vytvorený počas otvoreného detailu
o detail príde (v adminoch taká cesta nenájdená). FE-56: keď zápis autorov prejde a uloženie obrázkov zlyhá, riadky
už autorov majú.

### 5.11 Opravy zo siedmeho a ôsmeho overenia (13. 10., kroky OP6-L1, OP6-D1 a OP6-D2)

Rozhodol vlastník 13. 10. („opravime vsetko"; `overenie-nalezov.md`, časti „Siedme overenie" a „Ôsme overenie").
Rozhodnutia vedúceho počas práce sú označené; vlastníkovi oznámené v záverečnom hlásení bloku. Podrobnosti
v `impl/OP6-L1.md`, `impl/OP6-D1.md`, `impl/OP6-D2.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-64 | Druhé „Potvrdiť" v dialógu obrázka počas ukladania nič nespraví (doteraz druhé uloženie) | CMS | viditeľné len pri dvojitom stlačení |
| FE-65 | Aktívna dlaždica zoznamu assetov a výberov ide za assetom (podľa id), nie za miestom v zozname; po prepnutí typu sa čítanie na ceste vzdá; zlyhanie hlási len posledné čítanie. Id sa zabudne, keď panel asset neukazuje (zavretie detailu, koniec posledného čítania, nový zoznam) | CMS, UGC | viditeľné |
| FE-66 | Mená autorov idú do zdroja obrázka až po tom, čo DAM zápis autorov prijme (widgety jedného obrázka; galéria to mala od FE-56). Dialóg zavretý počas čítania mien skončí bez zápisu ako doteraz | CMS | viditeľné (oprava zápisu mien odmietnutých autorov) |
| 165 | Prop `onDetailLoadedCallback` zmazaný z troch komponentov (nikto ho nevolal); changelog „Removed props" | knižnica | API |
| FE-62 | Tlačidlo „upraviť" riadka tabuľky zoznamu len naviguje na stránku detailu (obyčajný klik aj dvojklik); zoznam už popri tom nič neotvára ani nečíta | DAM | viditeľné |
| FE-59 | Detail zoznamu je jeden, mimo riadkov: otvorí sa aj nad prázdnym zoznamom a nezmizne, kým sa zoznam číta. Vstup na stránku zoznamu nenakreslí detail, ktorý ostal otvorený z inej stránky | DAM | viditeľné |
| FE-60 | Šípky ← → nerobia nič pod frontou na celú obrazovku (upload, hromadná úprava) | DAM | viditeľné |
| FE-61 | Aktívna dlaždica ide za assetom aj po novom načítaní zoznamu (hľadanie, zoradenie, „Zrušiť filter"); neskorší zoznam ju obnoví len, kým panel ten asset ukazuje. Vstup na stránku ju nuluje | DAM | viditeľné |
| P1, P2 | Otázka „Neuložené zmeny" aj pred ceruzkou riadka fronty a pred potvrdením „Vytvoriť prázdny asset", keď panel drží rozpísané metadáta | DAM | viditeľné |
| P3 | Otázka pred odchodom zo stránky zoznamu s rozpísanými metadátami (menu, logo, odkaz), pred zmenou licencie, a otázka prehliadača pri obnovení alebo zavretí karty. Pýta sa ako posledná stráž navigácie (`router.beforeResolve`), aby Späť nad otvoreným dialógom alebo menu robilo to, čo doteraz. Pre odkaz „Stiahnuť originál" sa prehliadač nepýta (značka stlačenia, 1 s, jedno povolenie na stlačenie, len obyčajný klik bez modifikátora); **od FE-85 (5.12) značka zanikla:** odkaz sa otvára v novej karte | DAM | viditeľné; spôsob (beforeResolve, značka sťahovania) je rozhodnutie vedúceho |
| FE-70 | Zlyhané čítanie suseda po šípke pri zatvorenom detaile ukáže chybu (doteraz nič) | DAM | viditeľné |
| FE-67 | Zlyhaná požiadavka, pri ktorej knižnica nič neukáže, ukáže všeobecnú hlášku: štyri zmeny slotov, otočenie obrázka, uloženie náhľadu videa (karta potom ukáže uložený obrázok), odkaz na stiahnutie (koliesko sa zastaví), „Stiahnuť" v menu slotu. Druhé stlačenie zmeny slotu počas bežiacej požiadavky nič nespraví. Náhľad videa (c1): uloženie z radu ide súboru slotu a s hodnotou, pre ktoré bolo vybrané, aj keď karta medzitým ukazuje iný slot; po zlyhaní ostane otvorený výber z knižnice otvorený a neskoršia zmena ostane | DAM | viditeľné; „po jednej" je rozhodnutie implementéra |
| 205 (c1) | Karta obrázka (`ImagePreview`: náhľad videa, dva obrázky podcastu, obrázok epizódy) kreslí obrázok len vtedy, keď nejaký drží: karta bez obrázka ukáže zástupný obrázok (doteraz ostal posledný čítaný, napr. iný slot videa bez náhľadu ukazoval obrázok prvého); neskorá odpoveď pre starší obrázok sa zahodí. Po „Zrušiť priradenie obrázka" sa ďalší vybraný obrázok číta pod kolieskom karty (doteraz na chvíľu „Obrázok sa spracováva, skúste neskôr") | DAM (aj formuláre podcastu a epizódy) | viditeľné; rozhodnutie vedúceho (príčina namiesto obchádzky) |
| FE-68 | Dialóg „Make public" sa zavrie len po úspechu (aj potvrdzovací dialóg obrázka, ktorý je ten istý dialóg bez poľa); slug sa kontroluje tak, ako sa odošle (povinný, 3 až 128 znakov), chyba pri poli | DAM | viditeľné; obrázok je spresnenie vedúceho |
| FE-69 | Samostatné stránky detailu po zmene trasy: s rozpísanými metadátami sa prevezme len trasa (pravidlo FE-47). Karta slotov: zmena trasy riadka hlavného súboru, „Spraviť ako hlavný súbor" a zmazanie hlavného súboru sa prejavia na karte Info. Bez rozpísaného sa asset číta celý (detail ide na chvíľu pod loader a vráti sa na kartu slotov); s rozpísaným bez loadera, prevezme sa trasa alebo nový hlavný súbor aj s jeho tromi prepínačmi (prepnutý a neuložený prepínač sa nahradí hodnotou nového súboru). Platí aj vtedy, keď používateľ pred odpoveďou prepol kartu alebo detail zavrel, a aj pre trasu zmenenú z karty Info (c1). „Uložiť" zadržané stavom spracovania ostane po prevzatí nového hlavného súboru zadržané do celého čítania (c1). Z dvoch zmien po sebe platí posledná. Zmena odpovedaná, keď zoznam už číta iný asset alebo bol opustený, sa nečíta (c2); stránka assetu súboru číta po zmene podľa id assetu, takže funguje aj po zmazaní súboru, ktorým bola otvorená (c2) | DAM | viditeľné; celé čítanie, prepínače (207) a zmazanie (210) sú rozhodnutia vedúceho |
| FE-71 | Lišta pod loaderom detailu má tie isté tlačidlá, v tom istom stave a s tým istým účinkom ako načítaný detail (DAM aj externý poskytovateľ) | DAM | viditeľné |
| FE-72 | Názov assetu je v lište detailu vždy (aj v detaile mimo zoznamu); počítadlo len v detaile zoznamu | DAM | viditeľné |

Neurobené v tomto bloku: „Make public" len pre spracovaný súbor (Q7): stav súboru v otvorenom detaile ostával
zastaraný (nález 203, FE-89), schovanie by vzalo akciu, ktorá funguje. Vlastník 13. 10. rozhodol urobiť ho spolu
s FE-89; opravené v `OP7-D2` (časť 5.12).

Prijaté medze: FE-65: po zlyhanom čítaní je dlaždica označená vedľa prázdneho panela, kým je v zozname; tabuľkový
pohľad značku nemá (177, FE-76). FE-61: zoznam, ktorý príde presne počas opätovného čítania toho istého assetu,
dlaždicu neobnoví (od OP6-D2 aj počas celého čítania spusteného z karty slotov). P3: pod otvorenou otázkou sa chyba
požiadavky, ktorá vtedy dobehne, neukáže; Späť dvakrát pod otvorenou otázkou môže nechať adresu predošlej stránky.
Značka sťahovania: prehliadač, ktorý pre sťahovanie otázku nevyvolá, pustí obnovenie do sekundy bez otázky; odkaz
žije 15 minút (201, FE-85). FE-67: hláška je všeobecná; keď server náhľad uložil a stratila sa len odpoveď, karta
ukazuje predošlý obrázok do nového otvorenia. FE-69: nespracovaný súbor nastavený ako hlavný pri rozpísaných
metadátach nepopísaného assetu zadrží „Uložiť" do celého čítania. FE-71: tlačidlá poskytovateľa sú vždy zapnuté (ako
v načítanom detaile, FE-83); pod loaderom nie je názov. **Správanie Späť, otázky prehliadača a vzhľad lišty nikto
nevidel v prehliadači.** Siedmy blok (časť 5.12) z týchto medzí opravil značku tabuľkového pohľadu (FE-76), tlačidlá
poskytovateľa na koncoch zoznamu (FE-83) a značku sťahovania nahradil odkaz do novej karty (FE-85).

### 5.12 Opravy z deviateho až jedenásteho overenia (13. a 14. 10., kroky OP7-L1, OP7-D1, OP7-D2 a OP7-T1)

Rozhodol vlastník 13. 10. (`overenie-nalezov.md`, „Rozhodnutie vlastníka k siedmemu bloku" a „Rozhodnutie vlastníka
k jedenástemu overeniu"): FE-73 až FE-95 podľa odporúčaní, FE-81 cez novú kartu, „Make public" len pre spracovaný
súbor spolu s FE-89, 192 priamo v admin-cms a admin-ugc, 179 do #86919 (BE-9), 214 nechať, 209 opraviť v podpore
testov. Rozhodnutia vedúceho a implementérov počas práce sú označené; vlastníkovi oznámené v záverečnom hlásení bloku.
Podrobnosti v `impl/OP7-L1.md`, `impl/OP7-D1.md`, `impl/OP7-D2.md`, `impl/OP7-T1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| FE-73 (188) | Fajka vybraného assetu prežije hľadanie, zoradenie aj ďalšiu stranu; jeden klik asset odoberie, pri plnom počte sa dá odobrať a vybrať iný (doteraz fajka zmizla a pri 50 nereagovala žiadna dlaždica) | CMS, UGC (výbery assetov) | viditeľné |
| FE-74 (189, 190) | Každý nový zoznam (zoradenie, hľadanie, filter, typ, licencia, výber otvorený znova, zoznam po „Uložiť a použiť" uploadu) začína prvou stranou; požiadavka na ceste sa zruší a „Načítať viac" sa nedá stlačiť pred prvou stranou. Riadky starého typu po prepnutí neprebliknú | CMS, UGC (zoznam assetov a oba výbery) | viditeľné |
| FE-75 (184) | Po zavretí detailu panel prečíta asset, podľa ktorého si zoznam pamätá aktívnu dlaždicu, aj keď ho nový zoznam nemá (doteraz „žiadny asset"); to isté po zavretí detailu riadka fronty (rozhodnutie implementéra). Jedno čítanie assetu navyše | UGC (zoznam assetov) | viditeľné |
| FE-76 (177) | Riadok tabuľkového pohľadu, ktorého asset ukazuje panel, má modrý rám ako aktívna dlaždica | CMS, UGC | kozmetika |
| FE-77 (191) | Keď zlyhajú všetky štyri čítania konfigurácie vlastných polí, panel zoznamu a výberov ukáže „Chyba načítania konfigurácie DAM" (existujúci text; vlastník 14. 10.: nechať) namiesto nekonečného kolieska. Ext systém bez jediného vlastného poľa je načítaný: panel ukáže asset a widgety obrázka sa nakreslia (doteraz text chyby konfigurácie) | CMS, UGC | viditeľné |
| FE-78 (187) | „Potvrdiť" dialógu obrázka patrí obrázku, pri ktorom ho stlačili: dialóg zavretý a znova otvorený počas zápisu autorov sa sám neuloží a vo widgete s médiami neodíde `createImage` s prázdnymi poľami. Po odpovedi uloženia widget ukáže uložený obrázok; dialóg z „upraviť metadáta" sa zavrie ako doteraz, dialóg iného výberu alebo uploadu ostane otvorený. Potvrdenie média počas uloženia obrázka sa neberie (tlačidlo sa točí) | CMS, UGC (widgety jedného obrázka; autori DAM len CMS) | viditeľné |
| FE-79 (193) | Widget, ktorý zanikol (embed zrušený počas čítania alebo uloženia), už nezapíše model, sklad dialógu, zámok ani udalosť: formulár ďalšieho embedu ostane jeho | CMS, UGC (embed obrázka v texte) | viditeľné len pri pomalom uložení |
| FE-80 (195) | Odpoveď kliku na dlaždicu, ktorá príde pri otvorenom detaile riadka fronty, detail nezmení; po jeho zavretí panel kliknutý asset prečíta | UGC (zoznam assetov s frontou) | viditeľné len pri súbehu |
| 192 | Embed dialóg obrázka: druhé stlačenie (Enter) počas ukladania embedu nič nespraví (`EmbedImageDialog.vue`, stráž `saveButtonLoading`; urobil vedúci v admin-cms a admin-ugc) | CMS, UGC | viditeľné len pri dvojitom stlačení |
| FE-81 (185) | Stránka externého poskytovateľa: „Upraviť" riadka fronty uploadu a „Vytvoriť prázdny asset" otvoria stránku assetu `/assets/<id>` v novej karte (pri vytvorení prázdnu hneď pri stlačení, po odpovedi na asset, pri zlyhaní sa zavrie); upload na stránke beží ďalej. Karty nemajú prístup k stránke, ktorá ich otvorila; kartu odvedenú používateľom aplikácia neprepíše ani nezavrie, prázdnu zavrie s odchodom stránky. Druhé „Vytvoriť" počas požiadavky nič nespraví, aj na zozname DAM (rozhodnutie implementéra) | DAM | viditeľné; nová karta na pokyn vlastníka |
| FE-82 (186) | → bez aktívnej dlaždice vyberie prvú (doteraz druhú, v zozname s jedným assetom nič); v detaile nad zoznamom bez jeho assetu vedie „nasledujúci" na prvú | DAM | viditeľné |
| FE-83 (196, 182) | Stránka poskytovateľa: ← → nerobia nič pod frontou uploadu na celú obrazovku; na prvom a poslednom assete je tlačidlo, ktoré vedie von, vypnuté (aj pod loaderom) a šípka nič nečíta | DAM | viditeľné |
| FE-85 (201) | „Stiahnuť originálny súbor" sa otvorí v novej karte: vypršaná adresa alebo nedostupné úložisko nechá chybu tam a aplikácia ostáva aj s napísaným. Sekundová značka sťahovania z P3 zanikla: obnovenie hneď po stlačení sa s neuloženými metadátami pýta | DAM | viditeľné |
| FE-86 (200) | `/` nahrádza svoj záznam histórie: Späť zo zoznamu, na ktorý sa prišlo logom, ide na stránku pred `/` | DAM | viditeľné |
| FE-87 (198, 199) | Dialóg licencie sa potvrdí raz (tlačidlo sa točí, ladiaci `console.log` preč); dialóg licencie aj dialóg nového assetu sa počas požiadavky nedajú zavrieť („Zrušiť" vypnuté, krížik nič). Odchod zo samostatnej stránky detailu do 100 ms už na ďalšej stránke neukáže „Nesprávne ID assetu…" | DAM | viditeľné |
| FE-84 (180, 183) | Karta náhľadu videa po zlyhanom čítaní súboru alebo obrázka ukáže hlášku raz, koliesko zhasne a tlačidlá sú späť; po zlyhanom čítaní súboru karta neukáže súbor iného slotu. Formuláre podcastu a epizódy: zástupný obrázok a tlačidlá namiesto „Obrázok sa spracováva, skúste neskôr" | DAM | viditeľné |
| FE-88 (204) | Karta Sloty ani žiadny výber slotu (náhľad, distribúcia, stiahnutie) neukáže riadky iného assetu, ani po zlyhanom čítaní: menu riadka nezmaže ani nepresunie súbor iného assetu. Z dvoch čítaní slotov platí neskoršie | DAM | viditeľné (oprava zápisu do iného assetu) |
| FE-89 (203), „Make public" (Q7) | Detail, panel aj obe stránky detailu sa dozvedia, že hlavný súbor je spracovaný (notifikácia, čítania fronty): asset sa prečíta bez loadera a nič sa nezatvorí; bez napísaného formulár vezme odpoveď na mieste a „Uložiť" sa uvoľní, s napísaným sa vezme len hlavný súbor a „Uložiť" ostane zadržané (zámer `OP5-D2`). „Make public" sa ponúka len pri spracovanom súbore (karta súboru aj riadok slotu). Po správe jedno `GET` assetu navyše | DAM (kto súbor nahral) | viditeľné; tiché čítanie namiesto celého je rozhodnutie vedúceho (`OP7-D2-c1`) |
| FE-90 (206) | „Spraviť ako hlavný súbor" je v menu len pri spracovanom súbore | DAM | viditeľné |
| FE-91 (202), FE-95 (213) | Dialóg „Stiahnuť" a karta náhľadu videa berú len poslednú požiadavku (adresa, súbor slotu): koliesko beží do jej odpovede, staršia sa neukáže ani nenahlási; uloženie náhľadu ide súboru slotu, ktorý ukazuje výber | DAM | viditeľné len pri súbehu |
| FE-93 (212) | Po výbere náhľadu z distribúcie karta prečíta súbor, ktorý dialóg upravil (slot z výberu, nie hlavný súbor); druhé „Potvrdiť" počas ukladania nič nespraví (rozhodnutie implementéra) | DAM | viditeľné |
| FE-92 (208) | Formulár dialógu „Make public" sa pri otvorení vynuluje (chyba slugu sa neukáže pred potvrdením); zvyšok upratania bol v `OP6-D2` | DAM | kozmetika |
| FE-94 (211) | Samostatné stránky detailu po zlyhanom opätovnom čítaní (po zmene súboru bez napísaného) ukážu chybu a žiadny asset namiesto starého assetu s akciami | DAM | viditeľné |
| FE-67 (doplnok, `OP7-D2-c1`) | Druhé stlačenie zmeny slotu počas bežiacej požiadavky nič nespraví ani po prepnutí na inú kartu a späť | DAM | viditeľné len pri dvojitom stlačení |
| 209 | Podpora testov admin-dam už nedrží pamäť každého prípadu (vyrovnávacia pamäť devtools Vue, vue-i18n, poslucháči témy): halda rástla o 50 až 88 MB na prípad, teraz nanajvýš o 3 MB; CK-DAM beží v troch procesoch | nikto | vnútorné (testy) |

Ostáva: 214 nechať (vlastník 13. 10.); 179 je v #86919 ako BE-9. 219 (história prihlásenia) sa v `OP7-D1-c1` spravil
a vrátil (rozhodnutie vedúceho); opravený v ôsmom bloku (časť 5.13). Nové nálezy 216 až 228 sú v časti 8.

Prijaté medze týchto opráv: FE-73: asset, ktorý strany vrátia dvakrát (194), má fajku na oboch dlaždiciach. FE-74:
nový zoznam počas požiadavky na ceste zhasne koliesko na 200 ms a pri prázdnom zozname vtedy bliká „nič sa
nenašlo". FE-78: výber, ktorý sa pri odpovedi uloženia ešte číta, sa zavrie, a dialóg nového výberu otvorený počas
pomalého vytvárania vytvorí druhý obrázok (nález 224; opravené v `OP8-L1` a `OP9-L1`). FE-81: dvojklik na ceruzku
otvorí dve karty; keď prehliadač kartu nedá, asset vznikne a neotvorí sa nič, bez hlášky. FE-83: na poslednom
načítanom assete zoznamu s ďalšími stranami je „nasledujúci" vypnutý. FE-84: zlyhané čítanie toho istého obrázka sa
samo neopakuje. FE-87: Späť nad dialógom na záznam zapísaný cez `replace` dialóg odpojí a jeho stráž zanikne (treba
požiadavku, ktorá visí sekundy). FE-89: s napísaným sa „Uložiť" v detaile neuvoľní; stav ostal starý pri súbore
nahratom iným používateľom a pri stavoch `failed` a `duplicate` (228 a 225, opravené v `OP8-D1`). FE-93: odpoveď po
zavretí dialógu kartu neprečíta (226, opravené v `OP8-D1`). **Nové karty (FE-81, FE-85) ani zavretie dialógov nikto
nevidel v prehliadači.**

### 5.13 Opravy nálezov siedmeho bloku (14. 10., kroky OP8-L1 a OP8-D1)

Rozhodol vlastník 14. 10. po 12:00 (`overenie-nalezov.md`, „Rozhodnutie vlastníka k nálezom siedmeho bloku": „1-11
suhlasim / 12 spravme vsetky dminy / 14 nechat / 15 over / ostatne suhlas"): opraviť 216 až 218, 220 až 223, 225 až
227 a z 224 časť s druhým obrázkom; 219 vo všetkých adminoch; 228 po overení (Codex `overenie12`: platí, nízka)
pridaný do `OP8-D1`. Podrobnosti v `impl/OP8-L1.md`, `impl/OP8-D1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| 222 | Zlyhaná ďalšia strana = jedna požiadavka a jedna hláška (doteraz desiatky, kým bolo tlačidlo v okne); „Načítať viac" ostane a jeho stlačenie pýta znova | CMS, UGC (oba výbery, zoznam assetov) | viditeľné |
| 223 | Dialóg obrázka zavretý počas ukladania nevráti zámok poľa so starou hodnotou: pole ostane zamknuté, kým uloženie neodpovie, potom druhý redaktor dostane uložený obrázok (pri zlyhaní starý). Keď pole pri odpovedi drží menu alebo výber z knižnice, druhý redaktor dostane uložený obrázok hneď a zámok vráti ich zatvorenie; widget, ktorý zanikol počas potvrdenia, vráti zámok na jeho konci, nie keď ho medzitým vzala kópia | CMS (dvaja redaktori v článku) | viditeľné druhému redaktorovi |
| 224 (časť) | Dialóg iného výberu alebo uploadu otvorený počas vytvárania obrázka dostane id vytvoreného obrázka (len obrázok vlastného výberu): jeho „Potvrdiť" obrázok nahradí, druhý obrázok nevznikne | CMS, UGC (widgety jedného obrázka) | viditeľné len pri pomalom vytváraní |
| 219 | Odhlásenie (`ALogoutView`) a prihlásenie (`ALoginView`; v admin-dam vlastný formulár aj odkaz SSO) nahrádzajú svoj záznam histórie: po odhlásení a novom prihlásení nie sú v histórii `/login` ani `/logout`, Späť neukáže prihlásenému prihlasovací formulár a neodhlási ho. Stlačenie s Ctrl, Cmd, Shift, Alt alebo iným tlačidlom ostáva prehliadaču; tlačidlo prihlásenia bez adresy nerobí nič. admin-ugc `logout.ts` je zámerne bez zmeny (vynútené odhlásenie nechá stránku redaktora v histórii) | všetky adminy s knižnicou 2.0 | viditeľné |
| 227 | Asset vytvorený prázdny: po spracovaní prvého súboru sa detail, panel aj stránka assetu prečítajú bez loadera; bez napísaného je formulár ten, ktorý server vyplnil zo súboru, a „Uložiť" voľné; s napísaným sa vezme hlavný súbor a „Uložiť" ostane zadržané do celého prečítania. Doteraz bolo „Uložiť" voľné nad formulárom spred súboru a uloženie prepísalo metadáta zo súboru | DAM | viditeľné (oprava zápisu zlých dát) |
| 225 | Otvorený detail sa dozvie aj o hlavnom súbore, ktorý zlyhal alebo je duplikát, a karta to povie; duplikát „Uložiť" uvoľní, zlyhaný pod napísaným ho zadrží (core-dam vie metadáta uložiť pred zlyhaním) | DAM | viditeľné |
| 228 | Čítanie zoznamu a dávka hromadnej úpravy povedia otvorenému detailu konečný stav hlavného súboru, aj keď súbor nahral niekto iný | DAM | viditeľné |
| `OP8-D1` c1-2, c2 | Súbor iného slotu spracovaný počas otvoreného detailu neopísaného assetu: bez napísaného sa asset prečíta potichu, s napísaným ostane „Uložiť" zadržané do celého prečítania; po vlastnom uložení (asset je opísaný) už nie. Jedno `GET` assetu na taký súbor | DAM | viditeľné |
| 221 | Kôš riadka fronty hromadnej úpravy povie zmazanie zoznamu aj detailu: dlaždica má ikonu koša, panel „Čoskoro bude zmazaný." s vypnutým „Uložiť"; riadok zmizne aj zo schovanej fronty. Čítanie zodpovedané po zmazaní asset do stavu pred zmazaním nevráti; zmazanie v detaile označí zmazaný asset aj po prechode na iný | DAM | viditeľné |
| 217, 216 | Zoznam externého poskytovateľa: aktívna dlaždica ide za assetom po filtri, hľadaní a novom načítaní; klik po kratšom zozname asset prečíta (doteraz chyba v konzole); → bez aktívnej dlaždice vyberie prvú. „Nahrať do ADAM" nahrá zobrazený asset | DAM | viditeľné |
| 220 | Nad frontou uploadu na stránke poskytovateľa už nestojí ladiace slovo „hidden", „compact" ani „full" | DAM | kozmetika |
| 226 | Dialóg výberu náhľadu z distribúcie zavretý počas ukladania: karta ukáže nový náhľad (aj po prepnutí karty a späť) | DAM | viditeľné |
| 218 | „Stiahnuť" v menu riadka slotu otvorí kartu hneď pri stlačení (bez prístupu k aplikácii), po odpovedi ide na súbor, pri zlyhaní sa zavrie a príde hláška | DAM | viditeľné |

Prijaté medze týchto opráv: 222: tlačidlo, ktoré po zlyhaní zmizne z okna len zmenou rozloženia, po návrate pýta
znova. 223: počítadlo zámkov je stránky, druhú kartu toho istého redaktora nevidí. 224: dialóg média otvorený počas
vytvárania obrázka id nedostane a vytvorený obrázok ostane nepoužitý; výber, ktorý sa pri odpovedi ešte číta, sa
zavrie (opravené v `OP9-L1`, časť 5.14). 219: história prihlasovacej služby (aj pri SSO) je mimo; admin-dam potrebuje
`ALogoutView` knižnice 2.0. 225, 227: pod napísaným ostáva text „Súbor sa ešte spracúva…" aj po spracovaní (pri
zlyhanom súbore nový text v `OP9-D1`). 221: druhé stlačenie koša počas `DELETE` a „Uložiť" detailu otvoreného cez
„Upraviť" panela pri mazanom assete (234, opravené v `OP9-D1`). 218: druhé stlačenie otvorí druhú kartu. Asset
držaný ako mazaný sa do detailu nečíta, kým ho detail drží; dialóg otvorený nad zmazaným assetom po prepnutí karty
ostane otvorený. **Karty prehliadača a históriu prihlásenia nikto nevidel v prehliadači.**

### 5.14 Opravy nálezov ôsmeho bloku, 235 a 236 (14. 10., kroky OP9-L1, OP9-L2 a OP9-D1)

Rozhodol vlastník 14. 10. (`overenie-nalezov.md`, „Rozhodnutie vlastníka k ôsmemu bloku a stav po opravách deviateho
bloku"): o 17:40 „commit a push a na rozhodnutie suhlasim, B 1-6 over a ak to plati tak odporucanie suhlasim" (A: nový
text zadržaného „Uložiť" pri zlyhanom súbore; B: 229 až 234 po overení Codexom `overenie13-lib` a `overenie13-dam`),
o 19:25 „235 a 236 mozme opravit" a pravidlo nadpisov (nadpis dialógu sa nemení podľa stavu; `PRAVIDLA.md`, pravidlo
5). Podrobnosti v `impl/OP9-L1.md` (aj krok `OP9-L2`), `impl/OP9-D1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| 229 | Widget s médiami ukáže po potvrdení výberu hneď dialóg s načítavaním (ako obrázkový widget); dialóg zavretý počas čítania výber zruší, takže dialóg iného widgetu otvorený potom ostane, ako ho redaktor napísal; z viacerých výberov sa ukáže len posledný. Kopírovanie do licencie ukazuje načítavanie v oboch widgetoch; odpoveď vlastného uloženia dialóg, ktorý načítava pre výber, nezavrie; neskorá odpoveď staršieho výberu nevymaže vybraných autorov | CMS, UGC | viditeľné (oprava straty napísaného) |
| 232 | Widget, ktorý zanikne s otvoreným dialógom, menu alebo výberom bez potvrdenia (pripnutie „Supplementary media"), vráti zámok poľa hneď s hodnotou poľa (doteraz ostalo pole zamknuté do odchodu z článku); počas uloženia alebo zmazania ho vráti ich koniec, kópii, ktorá zámok medzitým vzala, ho nechá | CMS (dvaja redaktori v článku) | viditeľné druhému redaktorovi |
| 233 | „Upraviť metadáta" kópie widgetu (pripnutie) alebo článku otvoreného znova počas uloženia obrázka ukáže uložené texty: kým uloženie beží, dialóg načítava a „Potvrdiť" je vypnuté; po zlyhaní texty, ktoré kópia prečítala. Vlastné uloženie widgetu sa nečaká | CMS | viditeľné (oprava zápisu starých textov) |
| 235 | Nadpis dialógu obrázka ide z toho, na čo je otvorený: pri obrázku „Upraviť obrázok" od otvorenia (aj počas načítavania, kopírovania a ukladania), pri videu a podcaste „Upraviť médium"; nový text nie je | CMS, UGC | viditeľné (text); pravidlo nadpisov vlastníka |
| 236 | Dialóg uploadu, ktorý zanikne so svojím widgetom (redaktor vyhodený z miestnosti článku), sa zabudne a ďalší widget s tým istým kľúčom ho neotvorí. Upload alebo kópia z widgetu zvonka dialógu najprv zastaví frontu, ktorú žiadny dialóg nemenuje, takže „Uložiť a použiť" nepoužije starý súbor; to isté galéria a zoznam assetov | CMS, UGC | viditeľné |
| A (text) | Pod „Uložiť" zadržaným pre zlyhaný hlavný súbor je „Spracovanie súboru zlyhalo. Uložiť pôjde po novom otvorení assetu." (nový kľúč `coreDam.asset.detail.fileFailedOpenAgain`, sk, en; doteraz „Súbor sa ešte spracúva…"); nové otvorenie „Uložiť" pustí, aj do 5 s od posledného čítania | DAM (detail, panel, obe stránky) | viditeľné (text); rozhodnutie A vlastníka |
| 230 | Box „Neobsahuje žiaden súbor." len pri assete bez hlavného súboru (doteraz aj pri súbore na ceste a pod napísaným po spracovaní); tiché prevzatie pod napísaným berie aj stav assetu: po spracovaní prvého súboru veľký obrázok detailu | DAM | viditeľné |
| 234 | Kôš riadka hromadnej úpravy pošle jedno `DELETE`: počas požiadavky sú vypnuté koše všetkých riadkov assetu aj „Odstrániť" detailu. Detail mazaného assetu (aj obe stránky detailu) má „Uložiť" aj „Odstrániť" vypnuté pod „Čoskoro bude zmazaný."; box hovorí mazanie pred zlyhaním a duplikátom a pod „Uložiť" nie je riadok | DAM | viditeľné |

Vypadol: 231 (neplatí: core-dam odpovedá 400 a hláška sa ukáže). 237 (nadpis dialógov uploadu podľa stavu, od 1.40.0)
ostáva: vlastník 14. 10. „toto je vynimka" (`PRAVIDLA.md`, pravidlo 5).

Prijaté medze týchto opráv (vlastník 14. 10.: „4-7 ok", časť 8): opustený upload nahráva, kým ho nezastaví ďalší upload
toho istého miesta; z dvoch pomalých uložení toho istého obrázka platí neskoršia odpoveď; uloženie zlyhané až po
zmazaní vráti „neuložené"; stránka detailu po zmazaní z inej karty ostane na assete. Ďalej: 232, 233: počítadlá sú
stránky (iná karta ani iný redaktor nie); 233 nepokrýva formulár `expandMetadata` ani uloženia galérie a uloženie, ktoré
nikdy neodpovie, nechá dialóg načítavať. Text A: „Upraviť" panela „Uložiť" nepustí (nečíta nič). 234: stav `deleting`
prevzatý zo servera urobí z tichého prevzatia mazaný asset.

### 5.15 Desiaty a jedenásty blok: 238, 239, 160, 175 a 197 (14. a 15. 10., kroky OP10-L1, OP10-D1, OP11-L1 a OP11-D1)

Rozhodol vlastník 14. 10. (23:52, „2 ok / 3 ok": 238 overiť a ak platí opraviť, 239 len test) a 15. 10. po audite
nálezov (21:05, „suhlasim s odporucaniami": 160 v detaile assetu knižnice, 175 zmazať, 197 overiť a ak platí
opraviť; overenie16 Claude a Codex: všetky tri platia). Podrobnosti v `impl/OP10-L1.md`, `impl/OP10-D1.md`,
`impl/OP11-L1.md`, `impl/OP11-D1.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| 238 | Úspešné zmazanie assetu (detail na ktorejkoľvek stránke, kôš riadka) vyberie všetky jeho riadky z hromadnej úpravy aj z fronty uploadu, aj schovanej (upload na ceste sa zastaví); dlaždicu mazaného assetu nevyberie checkbox, Ctrl+klik ani rozsah; ikonu mazania má každá dlaždica assetu, aj zopakovaná a pridaná neskôr; hromadné uloženie na ceste ho v ešte neodoslaných dávkach vynechá; prázdny pás „Vybrané súbory: 0" sa neukáže | DAM | viditeľné |
| 239 | Prípad „upraviť asset" po návrate do galérie ide cestou, ktorú redaktor má (nový upload namiesto pomenovania starého dialógu); produkčný kód bez zmeny | nikto | vnútorné (test) |
| 160 | Upraviteľný detail assetu knižnice ukáže pod Autormi riadok „Konflikt autorov" z vlastného assetu, s menami; „+" autora pridá do poľa. Nie v paneli na čítanie, nie pri vypnutých autoroch; dialóg obrázka bez zmeny | CMS (UGC autorov nemá, DAM má len panely na čítanie) | viditeľné |
| 175 | Mŕtva vetva `directDetailLoad` oboch samostatných stránok detailu zmazaná; asset priamej adresy sa číta raz. Mená kľúčových slov a autorov môžu prísť najviac o 1,5 s neskôr (z čítania) | DAM | vnútorné |
| 197, N1 | Späť alebo Vpred spod hromadnej úpravy DAM alebo výberu poskytovateľa cez celú obrazovku na záznam, kde sa ADAM načítal alebo obnovil: ďalšia stránka ukáže svoj zoznam a pás, nie prázdnu kartu cez celú obrazovku; fronta uploadu ide na ďalší zoznam ako doteraz. Neskoré „Uložiť a ukončiť" hromadnej úpravy po odchode nevyprázdni výber ďalšej stránky (po zrušenom odchode áno, ako na svojej stránke); neskoré „Uložiť a ukončiť" uploadu nezavrie výber otvorený medzitým | DAM | viditeľné |

Nechané (vlastník 15. 10.): 240 („nechame"; vynechanie opakovaní nie je jednoduché) a s ním 194; 161 (známe
obmedzenie); cesta panela pri hromadnom uložení. Audit 15. 10. našiel už opravené 178, 215, prvú časť 224 a cestu
panela „zlyhané čítanie" (časť 8).

Prijaté medze týchto opráv: 238 (vlastník 15. 10.: „2-5 je normálne chovanie, nechame to tak"): detail v inej karte
prehliadača; dávka hromadného uloženia už na ceste; pamäť id zmazaných assetov rastie s aplikáciou; riadky uploadu do
slotov sa nevyberajú. 160: vyrovnávacia pamäť autorov je jedna pre stránku a pýta sa cez `default` (s druhou
konfiguráciou by čip mohol ukázať `#id`; dnes nedosiahnuteľné); po uložení detailu ostanú konflikty do nového
otvorenia. 197: na záznam `replaced` inej stránky než zoznam sa výber skryje a hromadnú úpravu vyprázdni až ďalší
zoznam. **Späť a Vpred nad výberom nikto nevidel v prehliadači.**

### 5.16 Dvanásty blok: 163, 14, 18 a 76 (18. a 19. 10., kroky OP12-L1 až OP12-L4, OP12-D1 a OP12-D2)

Rozhodol vlastník 18. 10. k odloženým veciam („2 urobme": 14; „5 spravit refetch predtym?": 163) a po analýzach
overenia 17 („suhlasim s odporucaniami a sprav aj 18"; `impl/posudky/overenie17-*`), po posudkoch krokov body cyklov
(„suhlasim"), 19. 10. pre 18 možnosť (a) (jeden sklad ROI v knižnici), čipy „Odobrať" a text `authorsGivenMeanwhile`.
Nález 76 (12. 10. nedokázaný) potvrdil Codex v posudku `OP12-L3`. Podrobnosti v `impl/OP12-L1.md` až `impl/OP12-L4.md`,
`impl/OP12-D1.md`, `impl/OP12-D2.md` a v changelogoch. Commit a push 19. 10. (časť 1, bod 10); záverečné kontroly
`final12.sh`: CK-LIB 348 / 5 076, CK-DAM s kópiou C15 130 / 1 962, CI a build oboch, kontroly balíka zelené.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| 163 (`OP12-L1`) | Widget obrázka prečíta asset pred zápisom autorov DAM: „Upraviť obrázok" assetu vybraného bez autorov ho prečíta znova (krátke načítavanie, „Potvrdiť" vypnuté) a ukáže výber podľa DAM alebo povinný Zdroj s menami (A1); „Potvrdiť" s vybranými autormi asset prečíta a keď medzitým dostal autorov, nič nezapíše a ukáže varovanie, kým ho redaktor nezavrie (A2); galéria tesne pred zápisom autorov prečíta assety s výberom a pri konflikte neuloží nič (G). Zdroj sa prepíše menami len vtedy, keď je prázdny alebo pochádza z výberu („vyplniť prázdne"); vlastný a uložený zdroj ostáva (možnosť b vlastníka, aj pre FE-54). Jedno `GET` navyše na asset s výberom | CMS (UGC autorov DAM nemá) | viditeľné (oprava prepisu autorov); zmluva API, pribúda (`noteSourceOfPick`, `forgetSourceOfPick`, `hasSourceOfPick` v `useImageStore`) |
| 14 (`OP12-D1`) | Všetkých 90 ovládačov admin-dam len s ikonou má prístupné meno (text tooltipu; hamburger „Hlavné menu", lupa „Vyhľadať"); prepínače hovoria stav (`aria-pressed`: dlaždice, typy, zobrazenia, tučné, kurzíva, podčiarknuté; `aria-expanded`: info panel od 840 px, filtre, info, hromadné operácie, hamburger); zatvorený info panel a zatvorené hromadné operácie čítačka ani Tab nevidí; tlačidlo „Hromadné operácie" pod dvoma riadkami nie je; zaškrtávacie pole riadku tabuľky „Vybrať"; farby filtra sú tlačidlá (Enter, Medzerník ich len vyberú); tlačidlá nahrávania a „Pokročilé" idú z klávesnice. Strážny test celého `src` | DAM | viditeľné čítačke a klávesnici; „Hromadné operácie" pri jednom riadku (vlastník súhlasil) |
| 14, časť knižnice; čipy (`OP12-L2`) | Ikona kalendára `ADatetimePicker` má meno „Vybrať dátum" a otvorí sa aj Enterom a Medzerníkom; menu používateľa „Účet"; zatvárateľné čipy, ktoré odoberajú hodnotu, sa čítačke volajú „Odobrať"; krížik čipu filtra (`closable-chips`) hodnotu naozaj odoberie, pri filtri jednej hodnoty ako zmazanie poľa | všetky adminy s knižnicou 2.0 | viditeľné čítačke a klávesnici |
| 18 (`OP12-L2`, `OP12-D2`) | Jeden sklad ROI v knižnici (id `commonAdminDamImageRoiStore`, štyri členy admin-dam, vývoz `useDamImageRoiStore`), admin-dam ho používa. Záložka „Fókus" admin-dam s právom `dam_regionOfInterest_update`: „Znovu načítať náhľady", otočenie a zmena slotu bez chyby (e2e DAM-B6, `test.fail()` zrušené), orezávač kreslí otočený obrázok aj pri ďalšej návšteve, rýchle prepínanie slotov a otočení skončí na poslednom výbere, zlyhané čítanie regiónov ukáže chybu namiesto večného kolieska. Ďalších päť id skladov knižnice má predponu `commonAdmin` (strážny test) | DAM; knižnica | viditeľné; zmluva API (zmena id v „Changed — migrating an admin", vývoz pribúda) |
| 76 (`OP12-L4`) | Uloženie detailu z fronty dá riadkom assetu vo všetkých frontách vlastné kópie kľúčových slov, autorov a `customData`: „vyplniť" vlastného poľa v jednej fronte nezmení riadok druhej | CMS, UGC | viditeľné len pri dvoch frontách |
| Orezávač (`OP12-L4`) | Súbor prečítaný 2 s po uložení oblasti sa použije, len kým je ten súbor zobrazený a orezávač tam je; z dvoch uložení len čítanie po poslednom | kde je orezávač knižnice (DAM, detail assetu knižnice) | viditeľné len pri súbehu |
| Zmazanie filtra (`OP12-L4`) | `AFilterRemoteAutocomplete`: zmazanie poľa pošle jednu požiadavku zoznamu pre prázdne hľadanie (doteraz dve až tri a staršia odpoveď mohla vyhrať); filter jednej hodnoty zmazaný na predvolenú hodnotu, ktorú držal, ju ukáže; pole bez fokusu pri zmazaní nehodí chybu | všetky adminy | viditeľné |
| Testy (`OP12-L3`, `OP12-L4`) | Falošný DAM testov odpovedá kópiami (aj UGC kópie obrázkov); obchádzky klonom zrušené | nikto | vnútorné (testy) |

Posudky a cykly (každý krok Claude, potom Codex ako druhý názor; cykly potvrdil Codex): `OP12-L1` c1 (pravidlo zdroja
(b), varovania do zavretia, stráže po zániku a pri len na čítanie, kontrola galérie tesne pred zápisom) a c2 (značka
„vyplniť prázdne" sa zabudne pri inom zápise zdroja, text vlastníka); `OP12-D1` c1 (info panel `inert` od 840 px,
hromadné operácie od dvoch riadkov, Enter na farbe, prísnejšia stráž, klávesnica uploadu); `OP12-L2` c1 až c3 (krížik
čipu filtra, Enter kalendára s jedným `blur`, čipy s pamäťou „Odobrať", päť id skladov, jedna požiadavka pri zatvorení
čipu); `OP12-D2` c1 a c2 (otočený súbor do assetu detailu, jedno počítadlo načítaní záložky, otočenie s id súboru,
texty e2e, stráže po čakaní); `OP12-L4` c1 a c2 (hľadanie `null`, počítadlo uložení orezu, predvolená hodnota po
zmazaní, stráž orezávača podľa objektu súboru a id oblasti; vetu changelogu opravil vedúci). Nové nálezy bloku 12
(body 1 až 20) rozhodol vlastník 19. 10.: opraviť okrem 13 (tooltip a meno hovoria to isté, malý prínos) a 20 (len
popis); opravené v bloku 13 (časť 5.17).

Prijaté medze týchto opráv: 163: čítanie a zápis sú dve požiadavky, autora daného medzi nimi prepíše zápis (zavrieť
to vie len backend); mená ponúknuté v dialógu zavretom bez „Potvrdiť" sa znova neponúknu; galéria nemá ochranu proti
dvom súbežným uloženiam. 14: tooltip a meno majú ten istý text (čítačka ho môže povedať dvakrát); slepé miesta stráže
sú v `impl/OP12-D1.md`. 18: otočenie zodpovedané až po odchode zo záložky nezapísalo otočený súbor do assetu detailu
(opravené v `OP13-D1`). **Nič z bloku nikto nevidel v prehliadači; e2e sa nespúšťali (zmenené len texty a značka
DAM-B6).**

### 5.17 Trinásty blok: nové nálezy bloku 12 a staršie otvorené nálezy (19. a 20. 10., kroky OP13-L1 až OP13-L4 a OP13-D1 až OP13-D4)

Rozhodol vlastník 19. 10.: „ja by som opravil vsetko", „ak by slo ale o opravu ktora je velmi naorcna a prinesie malo
tak by som to nerobil" (nálezy bloku 12, body 1 až 19 bez 13; a staršie otvorené nálezy zo zoznamu
`krok5-praca/pracovne/veduci/stare-nalezy.md`), „ok mozes", „makaj bezo mna co najviac aj reviews"; o 20:20 „suhlasim
s odporucaniami" k 22 bodom (staré „nechať" znovu otvorené, texty, premenovanie testov; `plan-OP13.md`, „Rozhodnutia
vlastníka 19. 10."). Pravidlo bloku: súvisiace opraviť podľa odporúčaní, nesúvisiace zapísať, výslovné „nechať"
vlastníka nemeniť bez neho, viditeľné zmeny a nové texty na kontrolu pred commitom. Kroky menujú staršie nálezy
riadkami `stare-nalezy.md`; ktoré z nich a z prijatých medzí častí 5.6 až 5.16 blok opravil, vymenúva časť 8 („Staršie
nálezy a medze opravené v blokoch 12 a 13"); prijaté medze v tých častiach ostávajú v pôvodnom znení. Podrobnosti v
`impl/OP13-L1.md` až `impl/OP13-L4.md`, `impl/OP13-D1.md` až `impl/OP13-D4.md` a v changelogoch.

| Oprava (nález) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| Nálezy bloku 12, widgety (`OP13-L1` 1 až 4) | Duplikát z fronty nechá riadku galérie vlastný zdroj (mená len do prázdneho zdroja alebo zdroja z výberu); widget prepnutý na len na čítanie zavrie svoje menu a dialógy ako „Zrušiť" a vráti zámok poľa (dialóg, ktorý ukladá, dobehne; formulár `expandMetadata` ostane); mená autorov DAM sa hľadajú všade pod ext systémom licencie assetu (aj potvrdenie, nález 161); po zatvorení detailu riadka galérie jedno čítanie namiesto dvoch | CMS, UGC | viditeľné |
| Nálezy bloku 12, výbery a čipy (`OP13-L1` 5 až 9, c1) | `AFilterRemoteAutocomplete` zmazané na neprázdnu hodnotu ponúkne zoznam pre prázdne hľadanie; `AFormRemoteAutocomplete` a `ADamAuthorFilterRemoteAutocomplete`: zmazanie pošle jednu požiadavku v poradí ostatných (doteraz dve až tri, staršia mohla vyhrať) a bez fokusu nehodí chybu; spinner svieti, kým beží ktorákoľvek požiadavka poľa; čipy mien s pamäťou dostanú zatvorenie zo slotu, `AChipNoLink`, stavové čipy a `ACachedUserChip` sa pri zatvorení volajú „Odobrať" | všetky adminy | viditeľné; zmluva API, pribúda (`chipProps`, `closeLabel`) |
| Orezávač (`OP13-L1` 10, c1, c2) | Počas uloženia oblasti a čítania po ňom sa načítava len orezávač, panel nie; druhé uloženie počas čítania sa nedá spustiť; loader nevisí; panel knižnice neponúka „Obnoviť", kým čaká uloženie alebo čítanie po poslednom, a náhľady sa potom nakreslia znova. Sklad ROI má `cropperBusy` a `setCropperBusy` | detail assetu knižnice; DAM od `OP13-D4` | viditeľné; zmluva API, pribúda |
| A3, N20, FE-32 (`OP13-L2` 1 až 3) | Riadky jedného assetu majú vlastné pole `damAuthors`; zmiešaný výber galérie: widget len na čítanie alebo preč po čakaniach nič nepridá, assety „ako sú" idú pred kópie a dialóg fronty sa otvorí o jedno čítanie neskôr; príznak uloženia detailu patrí assetu (zavretie detailu B nečaká na uloženie A) | CMS, UGC | viditeľné |
| FE-53, FE-54 (`OP13-L2` 4, c1) | Dialóg zavretý pred odpoveďou čítania nechá držaný asset (ďalšie otvorenie dá prázdnemu zdroju mená); po zlyhanom čítaní dialóg do konca zobrazenia neponúkne výber autorov, ukáže povinný Zdroj; čakanie „Potvrdiť" má limit 4 × `coreDam.apiTimeout` (pri 30 s 120 s) s hláškou o vypršaní; zdroj napísaný namiesto výberu ostane aj pri ďalšom otvorení | CMS | viditeľné |
| FE-56, 80 (`OP13-L2` 5, 9) | Po zlyhanom uložení obrázkov galérie, keď autori v DAM už sú, druhé „Uložiť" uloží (doteraz „autori medzitým pribudli" a uložilo až tretie); po odobratí obrázka sa pozície prečíslujú | CMS (FE-56); CMS, UGC (80) | viditeľné; 80: zmluva API (pozície bez medzery) |
| 223, 232, 233 (`OP13-L2` 6, c1, c2) | Čakanie na uloženie iného widgetu má limit (`apiTimeout`, inak 30 s): dialóg kópie sa potom zavrie s hláškou; formulár `expandMetadata` a galéria čakajú na uloženia svojich obrázkov a vezmú uložené texty; galéria, ktorá zanikla, nezapíše odpoveď uloženia ani neuloží obrázky po zápise autorov; riadky vybrané alebo nahrané počas načítania galérie sa pridajú po obrázkoch entity (doteraz zmizli). Časť „medzi kartami" nie | CMS, UGC | viditeľné |
| FE-1, OP2-L1 (`OP13-L3` 1, 4, c1, c2) | Po uložení detailu z fronty sa v riadku prepíšu len polia, ktoré redaktor medzitým nezmenil (pri dvoch a troch uloženiach jedného assetu platí najnovšie); riadok, ktorý sa počas čítania stane originálom duplikátu, dostane zápis detailu a chyba čítania sa ohlási (len pre svoj riadok); jedno čítanie navyše, kým sa vo fronte spracúva súbor tej licencie | CMS, UGC | viditeľné |
| FE-10, FE-33 (`OP13-L3` 2, 3) | Dialóg jedného súboru ukáže „File info" originálu duplikátu; „Uložiť a použiť" po zavretí dialógu počas čítania nič neuloží | CMS, UGC | viditeľné |
| FE-65, FE-75, FE-73, FE-74, 222 (`OP13-L3` 6 až 9) | Po zlyhanom kliku nie je označená dlaždica vedľa iného panela; po zavretí detailu z panela sa číta asset, ktorý detail ukazoval; asset na dvoch dlaždiciach sa vyberá a odoberá naraz; „Načítať viac" sa počas pauzy pred novým zoznamom točí a nič nepýta (nebliká „nič sa nenašlo"); zlyhaná ďalšia strana sa nepýta znova, keď tlačidlo len prekryl panel | CMS, UGC; DAM (výber assetov, od `OP13-D4`) | viditeľné |
| ZK13 (`OP13-L3` 10, c1, c2) | Zobrazené mená autorov a kľúčových slov sa z pamäte nevyhodia (`pin` a `unpin` v `defineCached`), čip sa netočí; pamäť sa orezáva aj po zlyhanej dávke | CMS, UGC; DAM od `OP13-D4` | viditeľné; zmluva API, pribúda (`useCachedItem`) |
| 104 / FE-21 (`OP13-L3` 14) | „+" konfliktu autora sa čítačke volá „Pridať autora {name}" | čítačka: CMS, DAM | viditeľné čítačke |
| A4, A5, A6 (`OP13-L3` 11 až 13) | Prípad pre `prime` zoznamu fronty; zmazané nepoužité pravidlo `.a-datatable__row--active`; `AFileInput` berie kľúč `common.system.upload.onlyOneFile` (tie isté slová) | nikto | vnútorné |
| 61, 65, 88, 89 (`OP13-L4` 1 až 4) | Testy fronty, ktoré vedia zlyhať (61); prázdny súbor sa spustí raz (65); merač dôjde na 100 % a 0 s aj pri hodinách späť (88); kúsok sa pred opakovaním zbytočne nečíta zo súboru (89) | CMS, UGC, DAM | 88 viditeľné, ostatné vnútorné |
| 22, 27, 37 (`OP13-L4` 5, c1, c2) | „Obnoviť" rozlišuje tri príčiny (zlyhané čítanie ako doteraz, „Asset už neexistuje.", „Originál duplikátu sa nepodarilo načítať."); nahraný riadok bez metadát, ktorého asset zmizol, po treťom chýbaní zlyhá s „Asset už neexistuje." (doteraz „skúste znova" bez konca) a „Uložiť a použiť" to povie; upozornenie podľa toho, či obnovenie ešte pomôže (zlyhaný riadok ho nedostane dvakrát, riadok usadený počas čítania nič) | CMS, UGC, DAM (od `OP13-D4`) | viditeľné; zmluva API, pribúda (`missing`, `originalUnread`, `messages.assetGone`, `isGivenUpMissing`) |
| Druhá sada, bod 5 (`OP13-L4` 6) | Séria zlyhaných čítaní dopytovania začne až zlyhaním, ktoré sa naozaj zapísalo: po timeoute, 401 alebo 403 sa neskoršie 502 do logu chýb dostane (raz) | nikto (Sentry) | vnútorné; zmluva API, pribúda (`readers.failureReported`, vývoz `apiErrorIsReported`) |
| Hlavička (`OP13-L4` 7; `stare-nalezy-1.md` A1) | Nadpis „Nahrávanie ukončené" dialógu jedného súboru je pri odmietnutom alebo zlyhanom súbore červený (doteraz zelený); nadpis ostáva (výnimka 237) | CMS, UGC | kozmetika |
| Nálezy bloku 12 (`OP13-D1`, c1, c2) | Otočenie: výsledok z odpovede `PATCH` (bez druhého `GET`), jeden súbor sa naraz otáča raz (koliesko aj v záložke otvorenej znova), otočený súbor dostane asset detailu aj po odchode zo záložky; lupa poľa hľadania reaguje na Enter a Medzerník; farby filtra majú jeden tooltip „meno (kód)", napr. „Červená (#ee0202)", a preložené meno; štyri detaily majú úzke rozloženie (pod 1 145 px obrázok nad panelom, pod 840 px ikona obrázka na tlačidle info); slot bez obrázka: prázdny orezávač, veta „Slot nemá obrázok." a bez otočenia (poistka); manifest a komentáre e2e upratané | DAM | viditeľné |
| A1, A2 (`OP13-D2` 1, 2) | Detail mazaného assetu má vypnuté (niektoré skryté) všetky akcie, ktoré menia asset alebo súbory (trasa, otočenie, ROI, sloty, distribúcie, epizódy, náhľad videa); sťahovanie a kopírovanie ostáva. „Uložiť" detailu je plné len pri napísanom | DAM | viditeľné |
| FE-44, FE-45, OP4-D1, P3, OP6-D1 (`OP13-D2` 3 až 5, 8, 11, c1, c2) | Šípka, ostatné cesty aj odchod a obnovenie stránky sa počas uloženia s napísaným na ceste pýtajú; zlyhané uloženie vráti „neuložené", neskoré zlyhanie panela po úspechu detailu nie; pod loaderom panela sa pýta; dvojklik na inú dlaždicu po „Odísť aj tak" otvorí jej detail; šípky pri zatvorenom detaile pod menu či dialógom nič; šípka nad prepínačom s fokusom ide v zozname; chyby pod otázkou pred odchodom sa ukážu po „Zostať"; riadok fronty, ktorý medzitým zmizol, sa po „Odísť aj tak" neotvorí | DAM | viditeľné |
| FE-47, FE-61, FE-69 (b, c), FE-71 (`OP13-D2` 6, 7, 9, 10) | „Nastaviť ako súkromné/verejné" je po zmene vypnuté do dočítania (zlúčenie zmien nie, časť 8); dlaždica sa zvýrazní aj po zozname, ktorý prišiel počas opätovného čítania, pri assete dvakrát tá kliknutá; stránka assetu ukáže zmenu trasy z opusteného zoznamu; zlyhané čítanie po hromadnom uložení povie chybu; lišta loadera ukazuje meno assetu (aj detail poskytovateľa) | DAM | viditeľné |
| OP8-D1, 234, text A, FE-89, medze 9. bloku (a), (b) (`OP13-D2` 12 až 15, 17, c1 až c3) | Zlyhaný súbor iného slotu je pre detail správou; čítanie spustené po označení mazania sa prevezme; dialóg sa po zmazaní zavrie aj po prepnutí záložky (nie nad iným assetom); asset zmazaný inde povie „Asset bol medzitým zmazaný." (aj po zlyhanom vlastnom mazaní, len na stránke, kde čítanie bežalo), aj na oboch stránkach detailu po zmazaní z inej záložky; uloženie mazaného assetu, ktoré zlyhá, nič nerozsvieti; „Upraviť" panela prečíta asset, keď nič nie je napísané (zadržané „Uložiť" sa uvoľní); pod zadržaným „Uložiť" pri spracovanom súbore „Súbor je spracovaný. Uložiť bude možné po novom otvorení detailu." | DAM | viditeľné |
| 176 s FE-63 a FE-67 (`OP13-D3` 1) | 27 obalov akcií súborov ide cez `useApiCommand` a `useApiRequest`: pri 403, 422 a zakázanej operácii (verejné/súkromné, hlavný súbor, sloty, otočenie, stiahnutie, náhľad videa) sa ukáže dôvod (texty knižnice) namiesto „Systémová chyba…", pri vypršaní hláška o vypršaní | DAM | viditeľné |
| FE-22, FE-29, FE-36, FE-37 (`OP13-D3` 2, c1) | Karta distribúcií otvorená znova počas mazania sa točí do svojho čítania a zmazaná distribúcia sa nevráti; točí sa len „Potvrdiť" rušenej distribúcie; po uložení záznamu sa zoznam prečíta aj pri skrytých nastaveniach a v karte otvorenej znova | DAM | viditeľné |
| FE-15, FE-12 (a), (b), 157 (`OP13-D3` 3, 10, 13) | Druhé „Uložiť" panela, ktoré zlyhá po úspechu prvého, nenechá „Uložiť" zvýraznené; asset odznačený a vybraný znova počas hromadného uloženia ukáže uložené hodnoty (jedno `GET` navyše na asset); Ctrl, Cmd, Shift, Alt alebo stredný klik na „upraviť" v tabuľke otvorí len novú kartu | DAM | viditeľné |
| FE-81, FE-85, FE-87 (`OP13-D3` 4, 6, 7, c1) | Dvojklik na ceruzku na stránke poskytovateľa otvorí jednu kartu; keď prehliadač kartu nedá, hláška „Prehliadač neotvoril novú kartu…" a „Vytvoriť prázdny asset" nič nevytvorí (dialóg ostane); druhé „Stiahnuť" v menu slotu počas požiadavky nič; Späť alebo prechod na iného poskytovateľa počas zmeny licencie či vytvárania assetu sa odmietne | DAM | viditeľné; nový text na kontrolu vlastníka |
| FE-84, 197 s N1, OP5-D2 (`OP13-D3` 5, 8, 9) | „Skúsiť znova" pod zlyhaným náhľadom (video, podcast, epizóda); odchod zo zoznamu vyprázdni aj hromadnú úpravu a „Uložiť a ukončiť" pod iným dotazom tej istej stránky vyprázdni; chyba zmeny trasy pod otázkou sa ukáže po „Zostať", po „Odísť aj tak" nie | DAM | viditeľné |
| Návrhy 8, 9, 10 z 8. 10. (`OP13-D3` 15 až 17, c1, c2) | Riadok vzdaný pre chýbajúci súbor povie „Súbor už na serveri nie je." a ďalšie zlyhanie má znova upozornenie; `reset()` skladu fronty vyprázdni aj zlyhania metadát; súbor slotu zlyhaný alebo duplikát sa ohlási detailu aj bez notifikácií; na ukončený hlavný súbor jedno čítanie (nie dve či tri) a po zlyhanom čítaní ďalšia správa číta znova | DAM | viditeľné; nový text na kontrolu vlastníka |
| A3, `OP7-T1` (`OP13-D3` 11, 12) | Falošný DAM testov ctí `validateStatus`; úplné GC v podpore testov nad 1 GB haldy (max RSS procesu 2,19 → 1,40 GB) | nikto | vnútorné (testy) |
| Knižnica bloku 13 v admin-dam (`OP13-D4`, c1) | „Znovu načítať náhľady" nie je, kým orezávač ukladá a číta (`cropperBusy`), náhľady sa potom nakreslia znova; profil usadzovania má `messages.assetGone` a `readers.failureReported` (tiché čítania slotov sériu nezačnú); ostatné zmeny knižnice bloku 13 (merač, vzdialené výbery, „+" konfliktu, čipy mien, výber assetov) bez kódu admin-dam | DAM | viditeľné |

Zastavené alebo vrátené (na vlastníka, časť 8): 224 (`OP13-L2` 7), zlúčenie FE-47 (`OP13-D2` 6), cesta panela pri
hromadnom uložení (`OP13-D2` 16, vrátená v c1), FE-69 (a) (`OP13-D2` 9, vrátené v c1: spracovaný súbor nedokazuje
doplnenie metadát, migrácia NAXOS), `noreferrer` 218 (`OP13-D3` 7). Neplatí: Esc pod čerstvou hláškou (`OP13-L3` 5,
`AAlerts` je od 28. 9. mimo vrstvy prekryvov; prípad ostal ako pripnutie). Overené bez zmeny: zvyšok FE-78 (`OP13-L2`
8, neškodí). Vedúci so súhlasom vlastníka premenoval `uploadStatusFallback.test.ts` (knižnica) a
`notificationFallback.test.ts` (admin-dam) na `uploadStatusPolling.test.ts`.

Posudky a cykly (každý krok Claude, potom Codex; cykly potvrdil Codex, `OP13-D2` c3 a `OP13-L3` c2 aj vedúci čítaním):
`OP13-L1` c1 (príznak orezávača, `expandMetadata` prečká len na čítanie, bez čítania licencie, počítadlo požiadaviek
spinnera) a c2 (prekrývajúce sa uloženia orezávača); `OP13-D1` c1 (výsledok z `PATCH`, sklad otočení, ikona pod 840 px,
slot bez obrázka z changelogu preč) a c2 (test, nález backendu); `OP13-L2` c1 (zmena changelogu, L1 až L7) a c2 (upload
počas načítania galérie); `OP13-D2` c1 (body 9 (a) a 16 vrátené rozhodnutím vedúceho, dvojklik len na kliknutom
prvku, stránka súboru, šípky poskytovateľa), c2 (dvojklik s druhým klikom v karte otázky, zlyhané vlastné mazanie,
ohraničené čakanie `whileOnPage`) a c3 (hláška len na stránke čítania); `OP13-L3` c1 (pripnutie mien namiesto
opätovného pýtania, číslovanie zápisov detailu, chyba len pre svoj riadok, licencia) a c2 (spoločné počítadlo zápisov,
orezanie pamäte po dávke); `OP13-D3` c1 (poskytovateľ → poskytovateľ, jedno čítanie na súbor, počítadlo zmien
distribúcií, stráž sťahovania podľa súboru) a c2 (`readOfToldFailed`); `OP13-L4` c1 (stráž stavu pred čítaním
obnovenia, „Uložiť a použiť" povie, changelog) a c2 (značka `givenUpMissing` namiesto odhadu); `OP13-D4` c1 (zoznam
zmien bloku 13 v changelogu, test). Kontroly krokov: CK-LIB 376 / 5 289, CK-DAM 150 / 2 068 a linty zelené; záverečné
`final13.sh` (kópia C16, CK oboch, CI) v čase zápisu bežalo.

Prijaté medze týchto opráv: FE-53 a FE-54: „Upraviť obrázok" čaká na čítanie po detaile bez limitu (limit má len
„Potvrdiť"); 233 cez dve karty nie. 222: ukotvenie posunu v prehliadači môže návrat tlačidla rátať ako posun (časť 8).
ZK13: `ACachedChip` a `ACachedUserChip` pripnutie nedostali (časť 8). FE-1: uloženie, ktoré sa nikdy nevybaví (klient
bez časového limitu), nechá v pamäti malú poznámku riadkov. FE-45: po „Odísť aj tak", po ktorom čítanie nepríde, ostane
značka do najbližšieho loadera. 234: hláška len pri tichom prevzatí; napísané zmazaného inde sa pri odchode pýta ďalej.
FE-12: opätovné čítanie ide po assete (pri desiatich assetoch desať `GET`). FE-81: karta sa otvára bez `noopener`
(odstrihnutá hneď), zdieľa skupinu kontextov a dostane kópiu `sessionStorage`. Druhá sada 5 v admin-dam: čítanie slotov
ostáva ticho, kým majú všetky riadky assetu zapísaný 404. **Nič z bloku nikto nevidel v prehliadači; e2e sa nespúšťali.**

### 5.18 Štrnásty blok PV14c: pomenované konfigurácie DAM (20. 10., kroky PV14c-L1 až PV14c-L6, PV14c-U1 a PV14c-D1)

Rozhodol vlastník 18. 10. („3 by sme mali spravit tak ze sa da pouzit aj iny ako default, viem ze nie vsade v kode to
je podporovane, treba to dokrobit"; po analýze `impl/posudky/overenie17-pv14c-claude.md` s doplnkami Codexu
„suhlasim s odporucaniami"): každý stav DAM podľa mena konfigurácie, vlastný soket s pôvodom udalostí, rovnaké id
assetov dvoch DAM oddelené, kľúč `currentUser` a kľúče pevných adries podľa konfigurácie, nový vývoz
`useDamConfigStoreOf`, obaly admin-ugc. Plán `krok5-praca/zadania/plan-PV14c.md` (medzery N1 až N6, X1 až X3, C1 až C8,
P1 až P3, U1 až U3, G1, G2, F, D1 až D4, Codex K1 až K4). API len pribúda (nepovinné parametre, props a kľúče, nové
vývozy); vnútri knižnice je meno povinné. Podrobnosti v `impl/PV14c-L1.md` až `impl/PV14c-L6.md`, `impl/PV14c-U1.md`,
`impl/PV14c-D1.md`, v changelogu („Named DAM configurations, each a DAM of its own") a v `doc/guide/installation.md`.

**Čo vidí redaktor:** nič. admin-cms, admin-ugc aj admin-dam majú len konfiguráciu `default` a pre ňu je všetko ako
doteraz (rovnaké obchody, pamäte, soket, adresy, používateľ kontroly licencií). Zmena platí pre aplikáciu s druhou
konfiguráciou DAM.

| Krok (medzery) | Čo sa mení | Koho sa týka | Zaradenie |
|---|---|---|---|
| `PV14c-L1` (C1 až C8, D3, K4) | Obchod konfigurácie DAM podľa mena: nový `useDamConfigStoreOf(name)` (pre `default` dnešný obchod `useDamConfigStore()`, inak obchod s id `commonAdminDamConfigStore:` a meno), `useDamConfigState(client?, configName?)`; každé čítanie a načítanie konfigurácie v knižnici (koreňové widgety, výbery, zoznam assetov, vnútorné widgety, detail, fronta, hromadné operácie, vlastné formuláre, ikony, distribúcie) pod menom komponentu a klientom tej konfigurácie; veľkosť kúska podľa mena; nepovinný `configName` na šiestich exportovaných komponentoch; verejné composables s nepovinným menom (vynechané = zdedené v setupe, inak `default`); pomenované obchody pri horúcej zmene (HMR) načítajú stránku znova. Konfigurácia, ktorej klient konfiguráciu prečítať nevie, ukáže doterajší chybový stav, kým aplikácia nenaplní `useDamConfigStoreOf(meno)` | nikto dnes; aplikácia s druhou konfiguráciou | zmluva API, pribúda |
| `PV14c-L2` (N1 až N5, X1 až X3, D3) | Pamäte mien autorov, kľúčových slov a používateľov podľa mena (vzniknú pri prvom použití mena, `default` je dnešná) a ich ext systém podľa mena (v rámci mena posledný zapísaný); čipy, vstupy, panel súboru, dialógy obrázka, plnenie zo zoznamu, výberu a detailu pod svojím menom, dopyty klientom a na adresách tej konfigurácie; `useDamCached*` a `useExtSystemIdForCached` s nepovinným menom, `configName` na `ADamAuthorCachedChip`; neznáme meno po inštalácii pluginu hádže „Composable can't be used…" a pamäť nedostane. Detail a dialóg obrázka pod menom, ktorého widget nezapísal ext systém posledný, sa otvoria bez výnimky „Ext system must be initialised." | nikto dnes | zmluva API, pribúda |
| `PV14c-L3` (N6, N4d, K1 čítania, K2) | Fronta a usadzovanie podľa mena: ciele a udalosti môžu menovať konfigurácie (`configNames`), profil má `configOf`; riadky rovnakého id assetu dvoch DAM sa usadia, obnovia, dostanú zápis detailu a stanú duplikátom len vo svojej konfigurácii; čakajúce čítania podľa konfigurácie a assetu (viac mien = čítanie pre každé, meno bez riadku sa nečíta); `noteRowsOfAsset`, `updateFromDetail`, `setSaving`, `savingOf` podľa konfigurácie a assetu (uloženia detailu toho istého id pod dvoma menami sa nečakajú); mená riadku idú do pamäte jeho konfigurácie. Profil bez `configOf` (admin-dam) usadzuje ako doteraz | nikto dnes; stránka s dvoma DAM | zmluva API, pribúda (typy usadzovania) |
| `PV14c-L4` (P1 až P3, K1 udalosti) | Notifikácie podľa mena: nepovinná voľba `notification` konfigurácie (pomenovaná bez nej soket nemá a usadzuje sa hustým dopytovaním od 5 s); jeden soket na adresu; každá udalosť nesie pôvod (mená konfigurácií soketu); `addDamNotificationListener` bez volieb počúva len soket `default` ako doteraz, s `{ configName }` soket tej konfigurácie, s `{ all: true }` všetky; stav push podľa soketu a frontu; dráhy čítaní a séria zlyhaní podľa konfigurácie (pomalý DAM jednej nezdrží druhú); soket s adresou, ktorú prehliadač odmietne, len varuje | nikto dnes (jeden soket alebo žiadny) | zmluva API, pribúda |
| `PV14c-L5` (F, U1 až U3, G1, G2, D2) | Sedem kľúčov adries (`endPointConfiguration`, `endPointPubConfiguration`, `endPointAssetLicence`, `endPointAssetCustomForm`, `endPointUser`, `endPointPodcast`, `endPointCmsAsset`) s dnešnými predvoľbami, `damEndPointsOf(meno)`; `currentUser` podľa konfigurácie (predvolene `dam`; `false` povolí každú licenciu; používateľ systému, ktorý nie je používateľom DAM, nepovolí žiadnu, chyba konfigurácie do konzoly); `adminDomain` a `apiTimeout` podľa konfigurácie (odkaz do DAM, veľkosť kúska, limity čakania); `useCommonAdminImageOptions` s `Object.hasOwn` (83) | nikto dnes | zmluva API, pribúda |
| `PV14c-L6` (D1, D4) | Vnútorné prístupy knižnice vyžadujú meno (verejné ostávajú s nepovinným); päť funkcií usadenia obchodu fronty má povinné `of`; strážny test v `test:eslint` číta zdroje kompilátorom TypeScript a pustí len meno odovzdané podľa typu; changelog má jednu položku „Named DAM configurations, each a DAM of its own", príručka prepísaná; `ck-lib.sh` kontroluje aj typy testov | nikto | vnútorné; dokumenty |
| `PV14c-U1` (admin-ugc) | Tri obaly (`ImageWidget.vue`, `ImageWidgetMultiple.vue`, `AssetList.vue`) plnia obchod `useDamConfigStoreOf(props.configName)` (licencie → ext systém 4, vlastné formuláre, kúsky, `initialized`) namiesto obchodu `default`; meno najprv overí `useDamConfigState(undefined, meno)`, neznáme hodí v setupe obalu skôr, než vznikne jeho obchod. `ImageWidgetSimple.vue` nič nepíše, ostal | nikto (obaly dostávajú `default`) | vnútorné; **admin-ugc necommitnuté, na schválenie vlastníka** |
| `PV14c-D1` (admin-dam) | Kód sa nemenil: celá kontrola admin-dam na kópii C17a zelená (150 / 2 068, linty s buildom); admin-dam má len `default`, poslucháč notifikácií počuje len soket `default`, profil bez `configOf` usadzuje ako doteraz | nikto | — |

**Predbežné voľby vedúceho k šiestim bodom pre vlastníka** (koniec `plan-PV14c.md`, 20. 10. okolo 01:00; vlastník bol
preč a povedal pokračovať; každá je vratná alebo len pridáva API; **vlastník ich skontroluje pred commitom PV14c**):
1. Komponenty a funkcie, ktoré berú len klienta (vstupy licencií, skupín licencií a ext systémov, výbery distribučnej
   služby a externého poskytovateľa, `fetchDamUser*`, `fetchAssetAsCmsMedia` a ďalšie): bez kľúčov adries, volajúci
   volí klienta; v príručke ako obmedzenie.
2. Soket pomenovanej konfigurácie, ktorý sa nepripojí: existujúci text výpadku, raz na soket, bez mena konfigurácie
   (časť 2).
3. Kľúč aj pre `/pub/v1/configuration`: áno, nepovinný.
4. Konfigurácia, ktorej klient nevie prečítať konfiguráciu alebo licenciu podľa id (trasy UGC): existujúci chybový
   stav; zdokumentovaný spôsob je naplniť `useDamConfigStoreOf(meno)` vopred, nové UI nie.
5. Dve konfigurácie s tou istou adresou soketu sú jeden DAM (prijaté obmedzenie, zdokumentované).
6. `skipCurrentUserCheck` na `ImageMediaWidgetInner` sa nepridáva (kľúč `currentUser` ho nahrádza).

Ďalej na vlastníka: kontrola admin-cms s novou knižnicou (`lint:tsc` a jeden štart s jedným soketom na koreňovú
adresu; jeho `notificationTeardown.test.ts` rúčku DAM nepoužíva) a počet procesov `ck-lib.sh` (šesť).

Posudky a cykly (každý krok Claude, potom Codex; cykly potvrdil Codex, `PV14c-L2` c2 a `PV14c-U1` c1 aj vedúci čítaním):
`PV14c-L1` c1 (testové DAM sa líšia aj pravidlami autorov a kúskov, prípady widgetu s médiom, formulára hromadných
operácií a odmietnutého uloženia, HMR cez `import.meta.hot.data`, vývoz typu `DamConfigStore`, neznáme meno vo filtri
distribúcií; L1 sa nevydáva bez L2); `PV14c-L2` c1 (prípady pripnutia a vytvoreného autora pod menom, kontrola mena vo
vstupoch troch pamätí) a c2 (`checkDamConfigName` pri každom volaní, aj pred inštaláciou pluginu); `PV14c-L3` c1
(obnovenie s menom bez riadku nečíta, viac mien = čítanie pre každé, prípady widgetov a dialógu); `PV14c-L4` c1 (séria
zlyhaní končí s posledným frontom konfigurácie, jeden poslucháč na spätné volanie, kópia pôvodu, odmietnutá adresa bez
výnimky stránky, mapy podľa mena ako `Map`) a c2 (jedno varovanie na soket); `PV14c-L5` c1 (tvar používateľa DAM pred
skratkou správcu, `checkDamConfigName` v `useDamConfigState`, prípady adries); `PV14c-L6` c1 (strážca podľa typu
v node namiesto počtu argumentov, povinné `of`, dokumenty) a c2 (premenované importy a volania cez hranaté zátvorky,
hranica strážcu v teste, `default` bez kontroly v dokumentoch); `PV14c-U1` c1 (meno pred obchodom, riadok changelogu
admin-ugc). Kontroly krokov: CK-LIB 389 / 5 467 a linty s typmi testov zelené; admin-dam 150 / 2 068 zelené; admin-ugc
16 / 108, linty a build zelené. Záverečné `final14.sh` (kópia C17, CK oboch, CI) a `final14-ugc.sh` v čase zápisu
bežali.

Ostáva (mimo PV14c, zdokumentované v changelogu a príručke): stav rozhrania pre celú stránku (výber assetov a jeho
filter, otvorený detail, galéria, sklad dialógu obrázka, ROI, dialóg uploadu): dva výbery, galérie či detaily na jednej
stránke sa bijú bez ohľadu na meno, ako doteraz; v rámci mena platí ext systém pamätí zapísaný posledný; meno sa číta
raz v setupe a front drží jedno meno (PV14a); widget pod menom potrebuje to isté meno v `image.configs`; jedna adresa
soketu = jeden DAM; funkcie len s klientom na pevných adresách; admin-cms sa nemení a admin-ugc nemení
`skip-current-user-check` na `currentUser: false`. Medze krokov: `useDamUploadChunkSize` a
`useDamDistributionServiceType` vyrobia obchod aj pre neznáme meno; posledná veľkosť kúska sa neoreže na nové hranice,
kým ju neprepočíta rýchlosť; `dispose()` nahradenej rúčky notifikácií nastaví stav push mien na `false` aj pre sokety
novej; strážca dokazuje, že meno je odovzdané podľa typu, nie že je správne; `apiTimeout: 30` admin-cms a admin-ugc
nesúhlasí s časovým limitom ich klienta (mimo kroku); obaly admin-ugc píšu licenciu nahrávania (`ImageWidget`,
`ImageWidgetMultiple`) a licencie výberu (`AssetList`), licencia mimo obchodu by sa pýtala na adresu, ktorú trasy UGC
nemajú (dnes jedna licencia).

Staršie nálezy, na ktoré PV14c narazil (zapísané, neopravené; aj pod `default`; na vlastníka):
- detail assetu otvorený cez „upraviť asset" widgetu alebo riadku fronty ukáže čipy „vytvoril" a „upravil" točiace sa
  bez konca: používateľov do pamäte dá len klik vo výbere assetov (posudok `PV14c-L2`);
- widget jedného obrázka pri načítaní nezapíše ext systém; keď sa licencia assetu nedá rozlíšiť, „upraviť asset" hodí
  „Ext system must be initialised." (posudok `PV14c-L2`);
- upload pod konfiguráciou, ktorej hranice kúskov sa nikdy nenačítali, pošle prázdne kúsky (cez koreňové widgety
  nedosiahnuteľné; posudok `PV14c-L1`);
- admin-ugc: `ImageWidgetMultiple.vue` má vo `withDefaults` hodnoty props, ktoré nedeklaruje (bez účinku); stavy
  `'error'` a `'uploadNotAllowed'` (`ImageWidget.vue`, `ImageWidgetMultiple.vue`) a `'error'` (`AssetList.vue`) sa
  nikdy nenastavia (`PV14c-U1`).

**Pomenovanú konfiguráciu nikto nevidel v prehliadači; žiadny admin ju dnes nemá.**

## 6. Čo ostáva na každej strane (nezbližuje sa)

- **Jadro** (`navrh-jadro.md`, za registrom): adresy, klient a typy assetov; texty; časový limit; odkiaľ sa vezme
  `rusha`; či sa pošle prázdny súbor; import od externého poskytovateľa; text a upozornenie pri zlyhaní uploadu;
  „Obnoviť"; sloty a hromadná úprava; čo hromadné operácie zapíšu pri type, ktorý pole nemá zapnuté; zápis uloženého
  detailu do riadkov; kontajner front.
- **Komponenty** (`navrh-komponenty.md` 6.3): prekrytie a riadok duplikátu; tlačidlo úpravy; kôš (odstrániť z fronty
  proti zmazať asset); kedy sa dá zrušiť; formulár duplikátu; rozsah validácie; vzhľad zamknutých polí; prepínač
  jednorazovej licencie; kedy riadok ponúkne „Obnoviť" a kôš; od koľkých riadkov je sidebar; posun klávesmi; kto sa
  pýta servera, ruší, odstraňuje, upozorňuje a plní cache; do ktorých riadkov idú kľúčové slová a autori; ikona TTS;
  právo vytvoriť; obaly admin-dam.

---

## 7. Odovzdávka pre tím admin-ugc

Do admin-ugc sme v kroku 5 zapísali len opravu 192 (siedmy blok, `EmbedImageDialog.vue`: druhé stlačenie počas
ukladania embedu nič nespraví; pushnuté 14. 10., `d2e0b16..19293f1`). S vydaním knižnice 2.0.0 treba jedno, druhé je na
vedomie. **Vlastník 18. 10.:** je sám členom tímu admin-ugc, zmeny v admin-ugc sa môžu zapracovať; vedúci napíše
zoznam zmien a vlastník ho schváli. **Zapísané 18. 10. (`19293f1..66fa782`, vlastník „1 2 3 urob", „zatial to len
commitni aa pushni"):** bod 1 nižšie a odstránená voľba `uploadStatusFallback: true`, ktorú knižnica 2.0.0 nečíta;
obaly z bodu 2 bez zmeny. Kým admin-ugc nemá novú verziu knižnice, kontrola typov na `next` padne (kľúč
`copyToLicenceEnabled` stará verzia nepozná) a nahrávanie bez notifikácií sa o stave súboru nedozvie. **Necommitnuté,
na schválenie vlastníka (20. 10., `PV14c-U1`, časť 5.18):** tri obaly z bodu 2 okrem `ImageWidgetSimple.vue` plnia
obchod konfigurácie DAM svojho mena (`useDamConfigStoreOf(props.configName)`) a meno najprv overia; s dnešným
`default` sa nemení nič. Potrebuje knižnicu s PV14c.

1. **Vypnúť kópiu do licencie** (rozhodnutie vlastníka 9. 10., N20V). V `src/main.ts`, do `coreDam.configs.default`
   (`:50-69`), pridať jeden riadok:

   ```ts
   copyToLicenceEnabled: false,
   ```

   Výber assetu potom prepínač „Kopírovať do licencie" neukáže a widgety kópiu nepošlú. Dnes sa v admin-ugc
   prepínač neukáže len preto, že každý výber má jedinú licenciu, ktorá je aj licenciou nahrávania; voľba to robí
   výslovným. UGC API cestu kópie nemá (pod `endPointImage: '/ugc/v1/image'` by to bola
   `/ugc/v1/image/copy-to-licence`) a nerobí sa.

2. **Štyri obaly podávajú `configName` s predvolenou hodnotou `'default'` výslovne** (v
   `src/domains/blog/image/components/`):

   | Súbor | Vlastnosť a predvolená hodnota | Kde ju podá knižnici |
   |---|---|---|
   | `ImageWidget.vue` | `:24`, `:40` | `:168`, cez `v-bind="props"` |
   | `ImageWidgetMultiple.vue` | `:17`, `:25` | `:144`, cez `v-bind="props"` |
   | `ImageWidgetSimple.vue` | `:13`, `:28` | `:57` |
   | `AssetList.vue` | `:18`, `:22` | `:146` |

   Dnes to nemení nič: admin-ugc má jedinú konfiguráciu a `default` vyjde tak či tak. Od 2.0.0 však komponenty
   knižnice meno konfigurácie dedia (výslovné meno, inak meno najbližšieho predka, inak `default`) a výslovné meno má
   prednosť. Ak admin-ugc niekedy pridá druhú konfiguráciu a bude chcieť, aby tieto obaly meno dedili, treba z nich
   predvolenú hodnotu `'default'` odstrániť; inak ju obal vždy prebije na `default`.

3. **Na vedomie, bez úlohy:**
   - Vlastné `updateImage` a `bulkUpdateImages` v `image.configs.default.imageApi` dostanú len polia obrázka (`texts`,
     `flags`, `dam`, `position`, `id`). Podľa poznámky kroku 36 admin-ugc číta len tie a telo si skladá sám.
   - Widget po `createImage` obrázok znova nečíta (`fetchImage` sa po vytvorení nevolá); ukáže ho z odpovede.
   - Galéria posiela pozície nových obrázkov bez medzery (31).
   - Nové upozornenie pri pustení viacerých súborov na widget jedného obrázka (47) a tlačidlo „Zastaviť" (43)
     prichádzajú s textami knižnice.
   - `ALogoutView` a `ALoginView` nahrádzajú svoj záznam histórie (219, `OP8-L1`). `src/domains/system/logout.ts`
     (vynútené odhlásenie zo stránky redaktora) je zámerne bez zmeny; jeho komentár `:3-4` („`/logout` ends in this
     same assignment") po 2.0.0 doslova neplatí.

---

## 8. Známe obmedzenia a nálezy mimo zmeny (pôvodné znenia; kód sa pri zápise nemenil, stav je pri položke)

- **47:** pri dvoch pusteniach v tom istom okamihu (do 100 ms po pridelení zámku, alebo v jednom ťahu slučky bez
  spolupráce) sa použije posledné, nie prvé; nahrá sa aj tak len jeden súbor (`impl/47.md`). Blok 13: nerobí sa
  (`plan-OP13.md`).
- **Nález 81:** dialóg výberu súboru z menu má vlastnú dropzónu, ktorá z viacerých pustených súborov vezme prvý ešte
  pred kontrolou formátu a bez upozornenia. **Opravené 12. 10. ako FE-6** (časť 5.6).
- **28, 25 (nález 37):** položka, ktorá bola zlyhaná už pred stlačením „Obnoviť" a pri čítaní znova zlyhá, hlášku
  dostane (pravidlo pozerá na zmenu stavu). **Vlastník 19. 10. otvoril (37), opravené v `OP13-L4`** (upozornenie podľa
  toho, či obnovenie ešte pomôže; časť 5.17).
- **N20:** použitý dialóg skôr, než sa dočítajú assety „ako sú", dá kópie pred ne; prepnutie widgetu na len na čítanie
  počas kópie pridanie assetov „ako sú" nezastaví. **Opravené v `OP13-L2`** (bod 2, časť 5.17).
- **31 (nález 80):** medzera v pozíciách po odobratom obrázku galérie ostáva a ide na backend (dokázané, vlastník
  12. 10.: bez opravy). **Vlastník 19. 10.: opraviť; opravené v `OP13-L2`** (bod 9).
- **PV14a:** rozbehnuté pridanie môže pomenovať vyprázdnenú frontu znova a pridanie pod iným menom sa potom odmietne;
  latentné: riadok spustený dvakrát, keby vlastná sada aplikácie pri výrobe behu hodila len pre niektorý riadok
  (`impl/PV14a.md`). Prvá časť PV14c neriešil (front drží jedno meno, mimo PV14c; ostáva), latentná časť sa nerobí
  (`plan-OP13.md`).
- **PV14b (nálezy 84 až 86):** pridania do fronty z widgetov nemajú `catch` (odmietnutie skladu otvorí dialóg bez
  nových riadkov); cache mien sa pýta cez `default` s oneskorením 1,5 s; `/adm/v1/cms/asset/…` widgetu s médiom je
  adresa, ktorú konfigurácia nemenuje, a ide klientom konfigurácie widgetu. Čo testy PV14b nepripínajú, je v
  `impl/PV14b.md`. **PV14c (časť 5.18, necommitnuté):** pamäte mien podľa konfigurácie (`PV14c-L2`) a kľúč
  `endPointCmsAsset` (`PV14c-L5`, 86) hotové; chýbajúci `catch` (85, 12. 10. nedokázaný) PV14c neriešil.
- **PV14 (jedna stránka = jeden core-dam):** asset v dvoch frontách rôznych konfigurácií sa po notifikácii a pri
  „Obnoviť" číta cez frontu prvého dotknutého riadku. **Hotové v PV14c** (`PV14c-L3`, `PV14c-L4`: čítania a udalosti
  podľa konfigurácie, s pôvodom); ostáva len jedna adresa soketu = jeden DAM (predbežná voľba 5).
- **PV16-D:** po zlyhanom prvom čítaní karty distribúcií iného assetu sa nič nečíta znova; kartu musí používateľ
  načítať sám. **Opravené 12. 10. ako FE-14** (časť 5.6): karta ukáže chybu a „Skúsiť znova".
- **Komentár v `src/AnzuSystemsCommonAdmin.ts:68-72`** (`endPointAuthor`): opravený v kroku M-A (z `default` číta
  už len cache mien).
- **Staršie nálezy denníka (9. a 10. 10., „na rozhodnutie"):** 54, 55, 56, 58, 59 (ten istý problém ako 84), 60, 61.
  V zozname pre vlastníka z 11. 10. chýbali; doplnené 12. 10. a rozhodnuté po overení (`overenie-nalezov.md`,
  „Stav po opravách"): opravené 54 (FE-4), 55 (FE-3), 56 (FE-15), 59 s 84 (FE-1), 60 (FE-11), časť 5.6; 58
  nedokázaný; 61 dokázaný a bez opravy (vlastník 19. 10. otvoril, opravené v `OP13-L4`, len testy).
- **Odložené rozhodnutím vlastníka na čas po kroku 5:** nález 14 (ikonové tlačidlá admin-dam bez prístupného mena;
  12. 10. dostali bubliny, FE-16; **mená pre čítačku vlastník 18. 10. dal urobiť, opravené v `OP12-D1` a `OP12-L2`**,
  časť 5.16), PV14c (cache mien na konfiguráciu; **vlastník 18. 10.: plná podpora pomenovaných konfigurácií DAM, štrnásty
  blok**, hotový 20. 10., necommitnutý, časť 5.18). Koreň nálezu 49 (hromadné uloženie posiela každé pole s `described: true`) vlastník
  12. 10. dal opraviť: FE-12 (časť 5.6).
- **Backend:** Azure DevOps Anzu #86919 (BE-1 až BE-9, revízia 7; nálezy 51, 51b, 52, 53, 107, 179 a súvisiace;
  BE-8: „Make private" obrázka a dokumentu odpovedá 204; BE-9: nález 179). Nový nález `rotation` z bloku 13 pridá
  vlastník (časť 8, „Backend, nový nález bloku 13").
- **Nové nálezy z opráv 12. 10. (kód sa nemenil).** Po štvrtom overení (`overenie-nalezov.md`): dokázané 117, 119
  so 129, 121, 124, 125, 127 (body FE-32 až FE-37, rozhodol vlastník 12. 10.); nedokázané 118, 120, 122, 128;
  vyvrátené 126. FE-32 až FE-37 sú opravené (časť 5.8).
- **Nové nálezy z opráv štvrtého overenia (kód sa nemenil).** Po piatom overení (`overenie-nalezov.md`) je
  dokázaných všetkých šesť: body FE-38 až FE-43, opravené (časť 5.9).
- **Nové nálezy z opráv piateho overenia.** Po šiestom overení (`overenie-nalezov.md`, 12. 10. večer) sú
  dokázané body FE-46 až FE-58 opravené, aj 144 ako FE-45 (časť 5.10); 143 je vyvrátený, 149b neobstál.
  Pôvodné znenia:
  - **136** knižnica: widgety jedného obrázka po „upraviť asset" stratia v dialógu obrázka výber autorov DAM
    a obrázok sa dá potvrdiť bez zdroja (vybraný asset je v spoločnom sklade detailu, ktorý sa vyprázdni).
  - **137** knižnica: po zrušenom výbere z DAM ostane v sklade asset X aj príznak „ukázať autorov"; dialóg
    pôvodného obrázka Y ponúkne výber autorov assetu X, potvrdenie zapíše autorov do X a ich menami prepíše zdroj Y.
  - **138, 149** knižnica, zoznam assetov: `reset()` výberu sa nevzdá čítania detailu na ceste; čítanie bočného
    panela nepozná klik na inú dlaždicu (panel ukáže iný asset než aktívnu dlaždicu).
  - **139** knižnica: dva riadky galérie jedného súboru s autorom vybraným len v jednom.
  - **140** knižnica: hostiteľ odpojený s otvoreným detailom nechá svoj kľúč v sklade stránky.
  - **141, 142, 143** admin-dam, detail assetu: detail práve vytvoreného assetu nevypne klávesy zoznamu; „Upraviť"
    bočného panela nenastaví pohľad (po detaile z fronty je detail zo zoznamu bez tlačidiel predchádzajúci/ďalší
    a počítadla); Esc zavrie detail mimo `closeDialog` a adresa ostane `/assets/<id>`.
  - **144** admin-dam: bočný panel zoznamu pri zavretom detaile zahodí neuložené metadáta bez otázky (klik na inú
    dlaždicu, šípky v zozname); vlastník 12. 10. rozhodol upozornenie pridať (FE-45, časť 5.10).
  - **145, 146** admin-dam: → na poslednom assete zoznamu ho číta znova; opätovné čítanie po zmene hlavnej trasy
    súboru zahodí neuložené metadáta.
  - **147, 148** admin-dam: lišta loadera detailu neukáže „1 / N" pre prvý asset; ref karty detailu je zdieľaný
    s detailom externého poskytovateľa.
- **Nové nálezy zo šiesteho overenia, neoverené druhým čítaním (kód sa nemenil; stav: 150 FE-52, 151 FE-60, 152
  FE-59, 153 FE-72, 154 FE-65, 155 zaniká s FE-56, opravené v častiach 5.10 a 5.11):**
  - **150** admin-dam: šípka v zozname pri zavretom detaile zmení adresu na `/assets/<id>` a nič ju nevráti
    (prečítal aj vedúci; bod FE-52).
  - **151** admin-dam: `closeDialog` detailu zapne klávesy zoznamu vždy, aj po detaile z fronty na celú obrazovku.
  - **152** admin-dam: „Vytvoriť prázdny asset" pri prázdnom zozname asset vytvorí, ale detail neukáže.
  - **153** admin-dam: v pohľade „queue" lišta detailu neukazuje názov assetu.
  - **154** knižnica: `assetSelectStore.setList` nevynuluje `activeItemIndex`.
  - **155** knižnica: dva riadky galérie jedného assetu s rôznymi výbermi pošlú dva zápisy s tým istým `id`.
- **Siedme overenie (13. 10., `overenie-nalezov.md`):** z nálezov 153 až 176 sú dokázané a hodné opravy body
  FE-64 až FE-66 (knižnica) a FE-67 až FE-72 (admin-dam); vlastník 13. 10. „opravime vsetko", opravené (časť 5.11).
  160, 161, 163 platia čiastočne: 163 opravené v `OP12-L1` (vlastník 18. 10., časť 5.16), 160 opravené v `OP11-L1`
  (v dialógu obrázka nechať, vlastník 15. a 19. 10.), 161 nechať (audit 15. 10., nižšie; hľadanie mien pod ext
  systémom licencie assetu opravil `OP13-L1`, bod 3). 165 opravené (časť 5.11), 175 zmazané v `OP11-D1`. Nové 177 až 181: 177 FE-76, 180 FE-84 (opravené
  v siedmom bloku, časť 5.12), 178 opravené cestou v `OP9-L1` (audit 15. 10.), 179 je BE-9 v #86919, 181 zaniká
  s FE-70.
- **Ôsme overenie (13. 10. ráno, `overenie-nalezov.md`):** druhé nezávislé čítanie (Codex, pri FE-59 až FE-62 a troch
  cestách zahodenia aj Opus) potvrdilo FE-59 až FE-62, tri cesty zahodenia (bez loga), FE-64 až FE-72, prop 165
  a otázku „Make public" počas spracovania (opravené v `OP7-D2` spolu s FE-89, časť 5.12); spresnené opravy sú
  v tabuľke tam. Nové 182 až 186, overené v deviatom overení a opravené v siedmom bloku (časť 5.12): 182 s 196
  FE-83, 183 s 180 FE-84, 184 FE-75, 185 FE-81, 186 FE-82. Pôvodné znenia:
  - **182** admin-dam: detail externého poskytovateľa kreslí na koncoch zoznamu aktívne šípky, ktoré nič nerobia
    (`ExternalProviderAssetDetailDialog.vue:111`, `externalProviderAssetListStore.ts:105`).
  - **183** admin-dam: zlyhané hľadanie náhľadového obrázka nechá `ImagePreview` točiť bez konca
    (`A/components/ImagePreview.vue:47`); príbuzné so 180.
  - **184** knižnica: po hľadaní alebo zoradení ostane v paneli zoznamu assetov predošlý asset, aj keď v novom
    zozname nie je (`assetSelectStore.ts:66`, `AAssetListInner.vue:86`).
  - **185** admin-dam: „Vytvoriť prázdny asset" na stránke externého poskytovateľa asset vytvorí a neotvorí nič
    (`ExternalProviderAssetListView.vue:126`).
  - **186** admin-dam: bez aktívnej dlaždice vyberie → druhú dlaždicu a ← nerobí nič (`assetListStore.ts:111-129`,
    `assetListActions.ts:138`); po oprave FE-61 to bude bežný stav po každej zmene filtra.
- **Nové nálezy zo šiesteho bloku (13. 10., kroky OP6-L1 a OP6-D1 a ich posudky; kód sa nemenil, neoverené; čísla
  riadkov podľa stromu po krokoch).** Stav: overené v deviatom overení (odsek za zoznamom), rozhodnuté 13. 10. a
  opravené v siedmom bloku (časť 5.12), okrem 192 (opravený v admin-cms a admin-ugc), 194 (nechať s 240) a 197
  (opravené v `OP11-D1`). Pôvodné znenia:
  - **187** knižnica: uloženie dialógu obrázka pokračuje nad obrázkom, ktorý dialóg ukazuje až po odpovediach;
    dialóg zavretý počas uloženia a znova otvorený sa uloží bez stlačenia a zavrie (`ImageWidgetInner.vue:648,652`;
    `ImageMediaWidgetInner.vue:791,795`); vo widgete s médiami po znovuotvorení pre médium odíde `createImage`
    s prázdnymi poľami (`ImageMediaWidgetInner.vue:788`).
  - **188** knižnica: značka vybratia (fajka) sa po novom zozname stratí, výber ostane; pri dosiahnutom maxime sa
    taká dlaždica nedá odobrať (`assetSelectStore.ts:75,88,96-118`).
  - **189** knižnica: zoradenie a prepnutie typu nevracajú stránkovanie na prvú stranu (`AAssetListInner.vue:161-167`,
    `AAssetSelect.vue:211-217`, `AAssetSelectMedia.vue:209-223`, `assetSelectListActions.ts:74-77`).
  - **190** knižnica: strana vyžiadaná pred prepnutím typu sa môže pridať do vyprázdneného zoznamu
    (`assetSelectListActions.ts:52-54,60,81`).
  - **191** knižnica: zlyhané načítanie konfigurácie formulárov nechá bočný panel točiť bez konca
    (`AAssetListInner.vue:214-224`, `AAssetSelect.vue:223-233`, `AAssetSelectMedia.vue:229-239`).
  - **192** admin-cms a admin-ugc: embed dialógy obrázka nestrážia vlastné uloženie, tlačidlo sa len točí; druhé
    stlačenie počas ukladania embedu spustí `metadataConfirm()` znova (admin-ugc `EmbedImageDialog.vue:69-105`,
    admin-cms `EmbedImageDialogActions.ts:31-33`). Mimo našich repozitárov.
  - **193** knižnica: uloženie, ktoré odpovie po zániku svojho widgetu, píše do skladu dialógu stránky; pri
    `expandMetadata` formulár ďalšieho embed dialógu dostane prvý obrázok (`ImageWidgetInner.vue:646-652,429-431`;
    `ImageMediaWidgetInner.vue:789-796,442-444`). Predpoklad neoverený: „Zrušiť" hostiteľa widget odpojí.
  - **194** knižnica: dlaždice majú kľúč podľa id assetu (`AssetSelectListTiles.vue:29`); asset zopakovaný v ďalšej
    strane dá dve dlaždice s tým istým kľúčom.
  - **195** knižnica: odpoveď kliku na dlaždicu sa zapíše do skladu detailu bez ohľadu na otvorený detail riadka
    fronty (`assetSelectListActions.ts:142`); detail potom ukáže kliknutý asset a uloženie ide doň.
  - **196** admin-dam: zoznam externého poskytovateľa: ← a → chodia po zozname pod frontou uploadu na celú obrazovku
    (`A/composables/assetFooterUpload.ts:53-57`, `externalProviderAssetListActions.ts:358-366`); obdoba FE-60.
  - **185 (doplnok)** admin-dam: na stránke poskytovateľa neotvorí nič ani ceruzka riadka fronty uploadu
    (`AssetQueueItemEditable.vue:84-96`).
  - **197** admin-dam: príznak `customDialog` prežíva stránky (`useMainWrapper.ts:4`): po odchode zo stránky
    poskytovateľa s hromadným výberom na celú obrazovku nakreslí zoznam DAM prázdny dialóg na celú obrazovku.
  - **198** admin-dam: dialóg licencie sa dá potvrdiť dvakrát (`saving` tlačidlo nečíta); ostal ladiaci
    `console.log` (`AssetToolbarExtSystemLicenceDialog.vue:63,126-158,179,337-344`).
  - **199** admin-dam: samostatné stránky detailu štartujú čítanie časovačom 100 ms, ktorý odpojenie neruší; Späť do
    100 ms spustí čítanie na ďalšej stránke a ukáže chybu „nesprávne id" (`AssetDetailView.vue:126-131`,
    `AssetFileDetailView.vue:119-124`).
  - **200** admin-dam: `/` je stránka, ktorá po pripojení tlačí `/assets` (`HomepageView.vue:7-9`), nie
    presmerovanie: Späť zo zoznamu skončí znova na čerstvom zozname.
  - **201** admin-dam: odkaz „Stiahnuť originál" je podpísaný na 15 minút od načítania dialógom
    (`AssetFileDownloadFacade.php:19,40`) a dialóg ho znova nečíta; neskôr stlačený (alebo nedostupné úložisko)
    nahradí aplikáciu chybovou stránkou úložiska a rozpísané sa stratí (`AssetDownloadButton.vue:38-56,107-114`).
    Oprava `target="_blank"` by odstránila aj značku sťahovania z `OP6-D1-c2`; je to zmena pre používateľa.
    Vlastník 13. 10.: cez novú kartu; opravené ako FE-85 v `OP7-D1`.
- **Deviate overenie (13. 10. popoludní, `overenie-nalezov.md`):** dve nezávislé čítania (Codex a Opus) nad 177 až
  180, 182 až 186 a 187 až 201. Nič nepadlo celé. Body FE-73 až FE-80 (knižnica: 188, 189 s 190, 184, 177, 191, 187,
  193, 195) a FE-81 až FE-87 (admin-dam: 185, 186, 196 so 182, 180 so 183, 201, 200, 198 so 199) vlastník 13. 10.
  dal opraviť podľa odporúčaní (FE-81 cez novú kartu): opravené v siedmom bloku (časť 5.12). Odporúčanie nechať:
  194 ostáva (s 240); 178 opravené cestou v `OP9-L1` a 197 opravené v `OP11-D1` (audit 15. 10.). 192 opravil vedúci
  v admin-cms a admin-ugc; 179 je v úlohe #86919 ako BE-9.
- **Nové nálezy z kroku OP6-D2 (13. 10. podvečer, `impl/OP6-D2.md`; kód sa nemenil; pôvodné znenia, overenie
  v `overenie-nalezov.md`, „Desiate overenie").** Stav 202 až 215: 205, 207 a 210 opravené v `OP6-D2-c1`; 202 až
  204, 206, 208, 211 až 213 ako FE-88 až FE-95 a 215 s FE-84 v siedmom bloku (časť 5.12); 209 v `OP7-T1`; 214 nechať
  (vlastník 13. 10.). Ďalšie nálezy (216 a vyššie) sú pripísané na koniec tohto zoznamu:
  - **202** admin-dam: dialóg „Stiahnuť": odpovede dvoch požiadaviek o adresu nemajú poradie
    (`AssetDownloadButton.vue:46-58,68-71`): po zmene slotu vo výbere alebo po zavretí a novom otvorení počas
    bežiacej požiadavky nastaví odkaz odpoveď, ktorá príde posledná, a koliesko zastaví tá, ktorá príde prvá.
  - **203** admin-dam: stav spracovania súboru sa v otvorenom detaile ani paneli neobnoví
    (`uploadQueuesStore.ts:270-282`, `appNotificationListeners.ts:30-32`): „Uložiť" zablokované textom „súbor sa
    ešte spracúva" sa samo neodblokuje; preto sa „Make public" nedá schovať podľa stavu (Q7 kroku OP6-D2; od `OP7-D2`
    sa schováva spolu s FE-89).
  - **204** admin-dam: zoznam slotov predošlého assetu môže pristáť v karte slotov ďalšieho
    (`assetDetailSidebarSlotsActions.ts:27-39`): `getList` nemá stráž „stále ten istý asset".
  - **205** admin-dam: `ImagePreview` si drží obrázok, keď jeho hodnota zvonku prejde na „žiadny"
    (`ImagePreview.vue:115-123`); karta náhľadu videa to od OP6-D2 obchádza novým vykreslením, formuláre podcastu
    a epizódy nie (`PodcastEditForm.vue:200,209`, `PodcastEpisodeEditForm.vue:145`).
  - **206** admin-dam: „Spraviť ako hlavný súbor" sa ponúka aj pri súbore, ktorý nie je spracovaný
    (`AssetSlotListItem.vue:246-250`); s 203 to pri neuložených metadátach nepopísaného assetu zablokuje „Uložiť".
  - **207** admin-dam: po „Spraviť ako hlavný súbor" pri napísaných metadátach ostanú tri prepínače detailu
    (jednorazové použitie, dva „interné"; `assetDetailStore.ts:120-122`) od starého hlavného súboru a „Uložiť" ich
    zapíše novému (`AssetDetailSidebarMetadata.vue:82-88`). Pred OP6-D2 to platilo aj bez napísaných metadát; od
    OP6-D2 sa bez napísaných číta asset celý.
  - **208** admin-dam, drobnosti: `saving` v `AssetDetailSidebarImagePreview.vue` nikto nečíta; obe stránky
    detailu deklarujú udalosť `mainRouteChanged`, ktorú neposielajú; formulár dialógu „Make public" ostáva po
    potvrdení `$dirty` aj pre ďalšie otvorenie (`AssetFileRouteMakePublicDialog.vue:81,87`).
  - **209** admin-dam, testy: veľké súbory testov sú na hranici pamäte (asi 80 MB na prípad sa neuvoľní,
    `test/support/uploadUi.ts:91`); `mainRouteChange.test.ts` s 55 prípadmi spadol na limite haldy 4 GB. Nové
    prípady patria do nových súborov; oprava je v podpore testov.
  - **210** admin-dam: zmazanie hlavného súboru na karte slotov nechá kartu Info na zmazanom súbore: po zmazaní sa
    čítajú len sloty (`assetDetailSidebarSlotsActions.ts:46-56`), backend pritom hlavný súbor assetu zahodí
    a vyberie iný (`AbstractAssetFileFacade.php:296-298`, `AssetPropertiesRefresher.php:147-163`). Rovnaká trieda
    ako druhá polovica FE-69.
  - **211** admin-dam: celé čítanie assetu, ktoré zlyhá, nechá na oboch samostatných stránkach detailu nakreslený
    starý asset pod chybou (`AssetDetailView.vue:109-114`, `AssetFileDetailView.vue:102-107`), kým zoznam detail
    zavrie; od OP6-D2 dosiahnuteľné aj po „Spraviť ako hlavný súbor", ktoré prešlo (posudok Opus, O2).
  - **212** admin-dam: karta náhľadu videa po výbere náhľadu z distribúcie číta znova hlavný súbor
    (`AssetDetailSidebarImagePreview.vue:67-69`), hoci dialóg dostal súbor slotu, ktorý karta ukazuje: karta skočí
    na hlavný súbor (posudok Opus, O3).
  - **213** admin-dam: čítania dvoch prepnutí slotu v karte náhľadu videa nemajú poradie
    (`AssetDetailSidebarImagePreview.vue:48-53`; výber ostáva počas čítania zapnutý,
    `AssetDetailSlotSelect.vue:53-64`): pomalšia odpoveď staršieho prepnutia pristane posledná, karta ukáže súbor
    iného slotu, než hovorí výber, a ďalší výber alebo odobratie obrázka sa uloží tomu súboru (posudky `OP6-D2-c1`,
    Codex 4 a Opus 7, nezávisle; FE-95).
  - **214** admin-dam: na stránke assetu súboru (`/assets/file/<F>`) ostane po zmazaní súboru F adresa stránky pri
    zmazanom súbore; obnovenie stránky skončí chybou „nenájdené" (od `OP6-D2-c2` stránka po zmene číta podľa id
    assetu, takže bez obnovenia funguje ďalej). Staršie; posudok Opus `OP6-D2-c1`, bod 2.
  - **215** admin-dam: `ImagePreview` po čítaní obrázka, ktoré zlyhá, ostane pri koliesku natrvalo
    (`A/components/ImagePreview.vue`, `fetchImage` bez cesty zlyhania); od `OP6-D2-c2` sa aspoň nečíta obrázok,
    ktorý karta už drží. Staršie; posudok Opus `OP6-D2-c1`, bod 3.
  - **216** admin-dam, zoznam externého poskytovateľa: bez aktívnej dlaždice → vyberie druhú dlaždicu
    (`EP/store/externalProviderAssetListStore.ts:105-113`); obdoba FE-82, ktorá menovala len zoznam DAM
    (`impl/OP7-D1.md`, nový nález 1; neoverené druhým čítaním).
  - **217** admin-dam, zoznam externého poskytovateľa nemá obdobu FE-61: po filtri nie je zvýraznená žiadna dlaždica,
    klik na dlaždicu na starom mieste ju nezvýrazní a šípky idú od starého miesta; `setActiveByIndex`
    (`EP/store/externalProviderAssetListStore.ts:95-103`) spadne, keď je starý index za koncom kratšieho zoznamu:
    klik dlaždicu zvýrazní a asset neprečíta (`impl/OP7-D1.md`, nový nález 2; neoverené).
  - **218** admin-dam, „Stiahnuť" v menu riadka slotu (`D/components/slots/AssetSlotListItem.vue:102-111`): okno sa
    otvára až po požiadavke (prehliadač s blokovaním okien ho potichu zahodí) a bez `noopener`, takže stránka
    úložiska má prístup k `window.opener` (`impl/OP7-D1.md`, nový nález 3; neoverené).
  - **219** admin-dam: po prihlásení formulárom ostáva v histórii `/login`; Späť zo zoznamu ukáže prihlasovaciu
    stránku prihlásenému používateľovi (`loginActions.ts:26` píše `window.location.href`; `impl/OP7-D1.md`, nový
    nález 4; neoverené).
    **Druhé čítanie (posudok Codex `OP7-D1-codex.md`, body 4, 6, 7):** 217 platí (klik po filtri, ktorý zoznam
    skrátil, asset neprečíta), 218 platí, 219 platí. **219 sa v `OP7-D1-c1` opravilo a vrátilo späť** (rozhodnutie
    vedúceho v noci 14. 10.): s `window.location.replace` pri prihlásení by po odhlásení a novom prihlásení jedno
    Späť zo zoznamu skončilo na `/logout` a používateľa odhlásilo (záznam `/logout` ostáva v histórii:
    `currentUser.ts:2`, `CurrentUserDropdown.vue:23`, `pages/logout.vue` s `ALogoutView` knižnice). Celá oprava:
    prihlásenie AJ odhlásenie nahradia svoj záznam (aj odkaz SSO, `LoginFormSso.vue`). **Vlastník 14. 10.: „12 spravme
    vsetky dminy"; opravené v `OP8-L1` (`ALoginView`, `ALogoutView`) a `OP8-D1` (`loginActions.ts`,
    `LoginFormSso.vue`), časť 5.13; admin-ugc `logout.ts` zámerne bez zmeny.**
  - **220** admin-dam, stránka externého poskytovateľa: do dialógu fronty na celú obrazovku sa vypisuje ladiaca
    hodnota `{{ externalProviderFooterViewSelected }}` (`EP/components/ExternalProviderAssetListView.vue:187`): nad
    frontou stojí slovo „hidden", „compact" alebo „full". Staršie; posudok Opus `OP7-D1`, bod 3.
  - **221** admin-dam: kôš riadka fronty hromadnej úpravy zmaže asset a nikomu to nepovie
    (`A/components/queue/AssetQueueItemEditable.vue:116-127`, `AssetQueueEditable.vue:55-58`): dlaždica v zozname
    ostane a panel ďalej drží zmazaný asset so zapnutým „Uložiť". Staršie; posudok Opus `OP7-D1`, bod 4.
  - **222** knižnica: neúspešné „Načítať viac", kým je jeho tlačidlo na obrazovke, sa pýta znova bez konca
    (`assetSelect/composables/assetSelectListActions.ts:102-110`: `hasNextPage` ostane pravda, `v-intersect` po
    každom prekreslení hlási viditeľné tlačidlo znova): požiadavky a hlášky „neznáma chyba" sa opakujú, kým sa
    tlačidlo neodroluje alebo výber nezavrie. Staršie; posudok Opus `OP7-L1`, bod 6 (čítaním).
  - **223** knižnica: v článku otvorenom dvoma redaktormi zavretie dialógu obrázka počas ukladania vráti zámok poľa
    so starou hodnotou a uložené id sa druhému redaktorovi nepošle (`ImageWidgetInner.vue:599-602,771-781,180-188`;
    `ImageMediaWidgetInner.vue:944-954,198-199,814-816`); zmazanie takú stráž má (`deletePending`), uloženie nie.
    Staršie; posudok Opus `OP7-L1`, bod 7 (čítaním).
  - **224** knižnica: dve medze FE-78 pri uložení trvajúcom sekundy: výber, ktorý sa ešte číta, keď príde odpoveď
    uloženia, sa zavrie a stratí; dialóg nového výberu otvorený počas pomalého vytvárania si nenechá id a jeho
    potvrdenie vytvorí druhý obrázok (`ImageWidgetInner.vue:486,510,512,548,663-664`). Posudok Opus `OP7-L1`, bod 4.
  - **225** admin-dam: otvorený detail sa nedozvie o hlavnom súbore, ktorého spracovanie skončí zlyhaním alebo ako
    duplikát (`domains/system/composables/appNotificationListeners.ts:37`): ostane pri texte „spracúva sa" so
    zadržaným „Uložiť" do nového otvorenia. Staršie; `impl/OP7-D2.md` nález 3, posudok Codex `OP7-D2`, bod 5.
  - **226** admin-dam: dialóg výberu náhľadu z distribúcie zavretý počas ukladania stratí obnovenie karty (udalosť
    odpojenej komponenty; `D/components/AssetDetailSidebarImagePreviewFromDistributionDialog.vue:65`): hláška
    „uložené", karta pri starom náhľade. Staršie; `impl/OP7-D2.md` nález 4, posudok Codex `OP7-D2`, bod 6.
  - **227** admin-dam: asset vytvorený prázdny nedostane po prvom uploade nový formulár: „Vytvoriť prázdny asset" →
    „Sloty" → upload → po spracovaní karta Info ukáže súbor, formulár je spred súboru a „Uložiť" je voľné; uloženie
    prepíše metadáta, ktoré server medzitým vyplnil zo súboru (`A/store/uploadQueuesStore.ts:279-287`,
    `A/store/assetDetailStore.ts:178-187`; `MetadataProcessor.php:35-37`, `AssetMetadataManager.php:39`). Staršie;
    posudok Opus `OP7-D2`, bod 8 (čítaním; píše zlé dáta).
  - **228** admin-dam: `impl/OP7-D2.md` nález 5: hromadné načítanie úpravy a čítania zoznamu poznajú stav súboru
    a detailu ho nepovedia (neoverené).
    **Overené (Codex `overenie12-codex.md`): platí, nízka závažnosť; pridané do `OP8-D1`.**
  - **Stav 216 až 228:** vlastník 14. 10. („1-11 suhlasim / 12 spravme vsetky dminy / … / 15 over / ostatne suhlas"):
    opravené v ôsmom bloku (časť 5.13): `OP8-L1` 222, 223, z 224 časť s druhým obrázkom a 219 v knižnici; `OP8-D1`
    216, 217, 218, 219 v admin-dam, 220, 221, 225, 226, 227 a 228. Prvú časť 224 (výber, ktorý sa ešte číta) opravil
    `OP9-L1` c1-2 (audit 15. 10.). Medzu 224 vo widgete s médiami (nepoužitý obrázok v CMS) `OP13-L2` zastavil, je na
    vlastníkovi; medzu 222 (tlačidlo, ktoré zmizne len zmenou rozloženia) opravil `OP13-L3` (bod 9).
  - **229** knižnica: kým výber widgetu s médiami číta asset (`fetchAssetAsCmsMedia`,
    `ImageMediaWidgetInner.vue:556-574`), nič sa neukazuje (ani dialóg, ani koliesko); dialóg iného widgetu otvorený
    medzitým sa prekryje dialógom tohto widgetu a jeho formulár sa nahradí cez spoločný sklad (`:686`): napísané
    sa stratí. Staršie; posudok Opus `OP8-L1`, bod 5.
    **Overené (Codex `overenie13-lib-codex.md`): platí, stredná, M; výber obrázkového widgetu dialóg čítania ukazuje,
    widgetu s médiami nie. Opravené v `OP9-L1` (časť 5.14).**
  - **230** admin-dam: tiché prevzatie pod napísaným berie len hlavný súbor, nie stav assetu: asset `draft` ukazuje pod
    napísaným ďalej „Neobsahuje žiaden súbor." (`A/components/AssetInfobox.vue:50-57`), hoci karta súbor už ukazuje.
    Kozmetika; `impl/OP8-D1.md` nález 1, posudok Codex `OP8-D1`, bod 5.
    **Overené (Codex `overenie13-dam-codex.md`): platí, nízka, S. Opravené v `OP9-D1` (časť 5.14).**
  - **231** admin-dam: odmietnuté prihlásenie formulárom odpoveďou 401 v teste neukázalo „Login failed!" (s 400 áno);
    neoverené, možno len prostredie testu (`impl/OP8-D1.md` nález 2).
    **Overené (Codex `overenie13-dam-codex.md`): neplatí.** Formulár ukáže hlášku pri každom odmietnutí; skutočný klient
    401 z `/auth` nechá volajúcemu; core-dam na zlé údaje odpovedá 400 (a je nastavený na SSO). Nič sa nemení.
  - **232** knižnica: widget, ktorý zanikne s otvoreným dialógom bez potvrdenia (napr. pripnutie počas výberu), nechá
    pole zamknuté pre ostatných redaktorov, kým redaktor neodíde z článku. Z čítania (`impl/OP8-L1.md`, nález 5 po c1).
    **Overené (Codex `overenie13-lib-codex.md`): platí čiastočne, vysoká, M**: zánik nič neuvoľní (`onBeforeUnmount`
    len označí `disposed`); pole uvoľní až kópia, ak zámok vezme a vráti. Opravené v `OP9-L1` (časť 5.14).
  - **233** knižnica: kópia widgetu pripnutá počas uloženia úpravy obrázka drží texty spred uloženia; jej „Upraviť
    metadáta" a „Potvrdiť" ich zapíšu späť (zlé dáta, zriedkavé). Z čítania (`impl/OP8-L1.md`, nález 6 po c1).
    **Overené (Codex `overenie13-lib-codex.md`): platí čiastočne, vysoká, M**: len keď kópia prečíta obrázok skôr, než
    sa uloženie prejaví (pomalý server). Opravené v `OP9-L1` (s cyklami a `OP9-L2-c1`; časť 5.14).
  - **234** admin-dam: druhé stlačenie koša riadka hromadnej úpravy počas bežiaceho `DELETE` pošle druhé zmazanie
    (staršie); detail otvorený cez „Upraviť" panela má pri mazanom assete „Uložiť" zapnuté (`impl/OP8-D1.md`, medze).
    **Overené (Codex `overenie13-dam-codex.md`): platí, stredná, S + M**: druhé `DELETE` dá 204 alebo 404 (chybová
    hláška), iný riadok ani asset neoznačí; detail nemá pri `deleting` vypnuté ani „Uložiť", ani „Zmazať". Opravené
    v `OP9-D1` (časť 5.14).
  - **235** knižnica: dialóg čítania výberu (a od `OP9-L1` aj kópie do licencie) má nadpis „Upraviť médium" aj pri
    obrázku a pri čakaní na uloženie (`impl/OP9-L1.md`, nález 4). Kozmetika.
    **Vlastník 14. 10.: „235 a 236 mozme opravit"; opravené v `OP9-L2` (nadpis podľa toho, na čo je dialóg otvorený;
    časť 5.14).**
  - **236** knižnica: `UploadQueueDialogSingle.vue:86-90` zhodí stránkový `uploadQueueDialog` len pri zastavení alebo
    použití, nie keď dialóg zanikne s widgetom (napr. redaktor vyhodený z miestnosti článku počas uploadu); ďalší widget
    s tým istým kľúčom fronty hneď ukáže starý dialóg uploadu. Posudok Opus `OP9-L1`, bod 6; `impl/OP9-L1.md`, nález 5.
    **Vlastník 14. 10.: „235 a 236 mozme opravit"; opravené v `OP9-L2` s cyklami c1 a c2 (aj dialóg galérie a starý
    súbor ďalšieho uploadu; časť 5.14).**
  - **237** knižnica: oba dialógy uploadu (`UploadQueueDialogSingle.vue:224-234`, `UploadQueueDialog.vue:231-241`) menia
    nadpis podľa stavu („Nahrávanie" / „Nahrávanie ukončené"), proti pravidlu vlastníka o nadpisoch (14. 10.). Od 1.40.0;
    `impl/OP9-L1.md`, krok OP9-L2, nález 6. Overené posudkom Codex `OP9-L2`, bod 7.
    **Vlastník 14. 10.: „toto je vynimka". Ostáva, ako je; výnimka z pravidla nadpisov (`PRAVIDLA.md`, pravidlo 5).**
    Zelenú farbu nadpisu pri odmietnutom alebo zlyhanom súbore opravil `OP13-L4` (bod 7, vlastník 19. 10.).
  - **238** admin-dam: po zmazaní assetu z detailu ostane jeho riadok v hromadnej úprave a kôš riadka pošle ďalšie
    `DELETE` (204 alebo 404 s chybovou hláškou). Staršie, nie „naraz"; `impl/OP9-D1.md`, medze 234 (a). Neoverené.
    **Vlastník 14. 10.: „2 ok" (overiť; ak platí, opraviť podľa odporúčania). Overuje Codex `overenie14-dam`.**
    **Overené (Codex `overenie14-dam-codex.md`): platí čiastočne, M**: cez detail na stránke zoznamu (aj otvorený
    „Upraviť" riadka), bez súbehu; druhé zmazanie dá 204 a druhú hlášku, alebo 404 a chybu; riadok ostáva upraviteľný
    a v hromadnom uložení. Detail na samostatnej stránke v tej istej karte nie (návrat do zoznamu frontu vyprázdni).
    Opravené v `OP10-D1` (`impl-dam-op10`; časť 5.15): úspešné zmazanie z detailu vyberie riadky assetu z fronty ako
    kôš riadka.**
    **Súvisiace (posudky Codex a Opus, opravené v c1 a c2):** zmazanie na samostatnej stránke detailu, kôš riadka
    (berie všetky riadky assetu v `edit` aj `global`; zmenený prípad `queueRowActions.test.ts:270`), mazaná dlaždica sa
    nedá vybrať, prázdny pás „Vybrané súbory: 0", hromadné uloženie na ceste vynechá zmazané assety v neodoslaných
    dávkach, označené sú všetky dlaždice assetu.
  - **240** admin-dam: zoznam assetov môže ukázať jeden asset na dvoch dlaždiciach: ďalšia stránka sa pripája po posune
    (offset) bez odstránenia opakovaní (`A/store/assetListStore.ts:69`), napr. keď medzitým pribudnú nové assety pri
    zoradení od najnovších; dve dlaždice majú rovnaký kľúč Vue (`item.asset.id`). Staršie; posudok Opus `OP10-D1-c1`,
    poznámka `impl/OP10-D1.md`, c2. Neoverené.
    **Vlastník 15. 10.: „o tomto vieme, je to vedomá vec, ktorá sa dá akceptovať, ale pokiaľ je implementácia jednoduchá,
    tak by sme to opravili". Jednoduchosť opravy posudzuje Codex `overenie15`.**
    **Codex (`overenie15-codex.md`): potvrdené (stránkovanie posunom), aj vo výbere assetov knižnice
    (`assetSelectStore.ts:85-96`); vynechanie opakovaní S na strom, ale stránka len z opakovaní by zasekla
    automatické načítanie, treba pokračovanie v oboch „load more": nie jednoduché. Vlastník 15. 10.: „nechame".**
  - **Audit nálezov bez rozhodnutia (15. 10. večer; Claude `audit-nalezov`, Codex druhý názor; vlastník „suhlasim
    s odporucaniami"):**
    - už opravené, dokumenty to k nálezu nepriradili: **178** (`OP9-L1`: `resetUnlessShown`, formulár sa nevyprázdni,
      kým ho ukazuje dialóg iného widgetu); **215** (FE-84 v `OP7`: `ImagePreview` pri zlyhanom čítaní ukáže chybu
      a vráti tlačidlá); **224, prvá časť** (`OP9-L1` c1-2: dialóg, ktorý načítava pre výber, sa po uložení nezavrie);
      cesta panela **„zlyhané čítanie"** (FE-47: s rozpísanými metadátami `readQuietly`, napísané ostane);
    - **160**: opraviť v detaile assetu knižnice (riadok „Konflikty autorov" ako na karte riadka fronty); v dialógu
      obrázka nechať (sklad stránky je spoločný); `OP11`;
    - **161**: nechať, známe obmedzenie (dnes žiadny výber neponúka licencie dvoch ext systémov); hľadanie mien pod ext
      systémom licencie assetu opravil `OP13-L1` (bod 3, nález bloku 12); ext systém pamätí mien je od `PV14c-L2` podľa
      konfigurácie (X1 až X3), v rámci jednej konfigurácie ostáva posledný zapísaný;
    - **175** (`overenie-nalezov.md`, FE admin-dam): zmazať mŕtvu vetvu `directDetailLoad` na oboch stránkach detailu
      a v `currentExtSystem.ts` (`onMounted` → `resetAllStores` príznak zruší pred `getDetail`); `OP11`;
    - **194**: nechať spolu s 240;
    - **197**: overiť cestu cez tlačidlo Späť prehliadača spod rozbaleného výberu; ak platí, zrušiť príznak pri odchode
      zo stránky (`OP11`), inak nechať;
    - **Jedenásty blok (15. 10. večer):** 160 opravené v `OP11-L1` (detail assetu knižnice ukáže „Konflikt autorov"
      z vlastného assetu, s menami; nie v paneli na čítanie, nie pri vypnutých autoroch; dialóg obrázka bez zmeny);
      175 a 197 opravené v `OP11-D1` (197: Späť alebo Vpred na záznam, kde sa ADAM načítal alebo obnovil, už
      nenechá prázdny dialóg; výber sa zbalí, plný upload ide na ďalší zoznam ako predtým; k tomu nález N1: neskoré
      „Uložiť a ukončiť" hromadnej úpravy po odchode nevyprázdni výber ďalšej stránky a neskoré „Uložiť a ukončiť"
      uploadu nezavrie výber otvorený medzitým). Poznámky `impl/OP11-L1.md`, `impl/OP11-D1.md`.
    - **Nález pre backend z `OP11-L1` (nie je nový):** `AuthorSuggester` drží konfiguráciu ext systému v zdieľanej
      službe (`AuthorSuggester.php:99-104`, `??=`) a beží v handleri workera (`AssetFileMetadataProcessHandler.php:47`):
      po súbore jedného ext systému môže ten istý proces navrhovať a vytvárať autorov aj pre ext systém s vypnutými
      autormi (`AuthorSuggester.php:84-89`). **Vedúci 18. 10. overil v kóde core-dam, že je to ten istý nález ako 53 /
      BE-4** (v #86919 od 9. 10., doplnený 12. 10.: oba smery, aj zakladanie kľúčových slov a autorov v druhom
      systéme; `AbstractSuggester.php:19`, `KeywordSuggester.php:77-80`, `AuthorSuggester.php:99-104`). Nový bod sa
      nepridáva.
    - cesta panela **„uloženie hromadnej úpravy s assetom panela"**: nechať (hromadné uloženie je novší zápis, panel
      ukáže stav DAM). Ostatné cesty zo zoznamu „Cesty, ktorými sa rozpísané metadáta panela zahodia" nižšie vyriešili
      P1 až P3 (`overenie-nalezov.md`) a prijaté medze FE-45. **Vlastník 19. 10. dal cestu panela opraviť; `OP13-D2`
      (bod 16) opravu v c1 vrátil (ponechaný formulár by ďalším „Uložiť" vrátil hromadnú úpravu), znova na vlastníkovi**
      (časť 8, „Na rozhodnutie vlastníka po bloku 13").
  - **Medze desiateho bloku (vlastník 15. 10.: „2-5 je normálne chovanie, nechame to tak"):** detail v inej karte
    prehliadača; dávka hromadného uloženia už na ceste; pamäť id zmazaných assetov; riadky uploadu do slotov.
  - **239** knižnica (len test): `consumerProfileAssetDetailOpen.test.ts:282` (CMS, UGC) po návrate do galérie pomenuje
    starý dialóg uploadu sám; redaktor to urobiť nevie (pridanie súboru starú frontu zastaví), takže „upraviť asset" po
    návrate nepokrýva dosiahnuteľnú cestu. Posudok Codex `OP9-L2-c1`, bod 3.
    **Vlastník 14. 10.: „3 ok". Krok `OP10-L1` (`impl-lib-op10`): uzavretý 15. 10., posudky bez nálezu.**
  - **Medze deviateho bloku (vlastník 14. 10.: „4-7 ok", ostávajú):** opustený upload (redaktor vyhodený z článku sa
    k nemu nevráti, riadky nahrávajú, kým ich nezastaví ďalší upload toho istého miesta); dve pomalé uloženia toho istého
    obrázka (platí neskoršia odpoveď); admin-dam: uloženie zlyhané až po zmazaní vráti „neuložené"; stránka detailu po
    zmazaní z inej karty ostane na assete. **Vlastník 19. 10. otvoril dve posledné (a, b): opravené v `OP13-D2`**
    (bod 17); opustený upload a dve pomalé uloženia sa nerobia (`plan-OP13.md`).
- **Nové nálezy z krokov OP5-L1 a OP5-D2 (kód sa nemenil; pôvodné znenia).** Stav podľa siedmeho overenia
  (`overenie-nalezov.md`): 158 FE-67, 162 FE-64, 164 a 166 so 154 FE-65, 165 zmazaný prop, 167 FE-66, 168 (so 176)
  FE-68, 169 so 170 FE-69, 171 FE-70, 172 so 173 FE-71, 174 rieši FE-61; opravené v časti 5.11. 159 neobstál (149b),
  163 opravené v `OP12-L1`, 160 opravené v `OP11-L1` (dialóg obrázka nechať), 161 nechať (audit 15. 10.; hľadanie mien
  opravil `OP13-L1`). Dôvod servera pri 403 a 422 akcií súborov (176 s 158 a 168) ukazuje od `OP13-D3` (bod 1).
  - **158** admin-dam: volania, ktoré odmietajú surovou chybou axios, `showErrorsDefault` neukáže (zistené pri
    „Make private" / „Make public", tam opravené ako FE-63); či to platí aj inde, neoverené. Siedme overenie: osem
    miest, opravené ako FE-67.
  - **159** knižnica: 149b ostáva (odpoveď kliku na dlaždicu sa zapisuje priamo, `assetSelectListActions.ts:129`).
  - **160** knižnica: dialóg obrázka číta `authorConflicts` zo skladu stránky, ktorý nič neplní
    (`ImageDetailDialogMetadata.vue:66`).
  - **161** knižnica: „potvrdiť" dialógu obrázka hľadá mená autorov pod ext systémom skladu výberu stránky
    (`ImageWidgetInner.vue:625`, `ImageMediaWidgetInner.vue:768`); galéria pod ext systémom stránky, nie licencie
    assetu (`ImageWidgetMultipleInner.vue:597`).
  - **162** knižnica: druhé „potvrdiť" z klávesnice počas ukladania obrázka pošle druhé uloženie
    (`ImageDetailDialogMetadata.vue:96-103`).
  - **163** knižnica: widget jedného obrázka sa nedozvie o autoroch, ktorých asset dostal inde
    (`imageDialogDamAuthors.ts:53`); sklad dialógu obrázka je jeden pre stránku (`imageMediaWidgetStore.ts:19-36`).
  - **164** knižnica: predbehnuté čítanie po zavretí detailu stále hlási svoje zlyhanie
    (`assetSelectListActions.ts:155-156`).
  - **165** knižnica: `onDetailLoadedCallback` výberu a zoznamu assetov je mŕtvy verejný prop (dlaždice klikajú cez
    vlastnú inštanciu akcií bez spätného volania; `AAssetSelect.vue:84`, `AssetSelectListTiles.vue:17`).
  - **166** knižnica: `AAssetSelectMedia.typeChange` (`:211-215`) vyprázdni sklady bez vzdania sa čítania kliku:
    panel ukáže asset dlaždice, ktorá už v zozname nie je. Kozmetika.
  - **168** admin-dam: dialóg „Make public" sa zavrie aj po odmietnutej zmene; napísaný slug je preč
    (`AssetFileRouteMakePublicDialog.vue:86-89`).
  - **169** admin-dam: samostatná stránka detailu a stránka detailu súboru po zmene trasy čítajú celý asset znova
    a neuložené metadáta zahodia bez otázky (`AssetDetailView.vue:233`, `AssetFileDetailView.vue:210`).
  - **170** admin-dam: karta slotov po zmene trasy číta len zoznam slotov; karta súboru na Info ostane stará, keď
    je slot hlavným súborom (`AssetSlotListItem.vue:179`).
  - **171** admin-dam: šípka v zozname pri zatvorenom detaile: zlyhané čítanie nepovie nič
    (`assetListActions.ts:475,517`).
  - **172** admin-dam: detail poskytovateľa ukazuje pod loaderom počítadlo zoznamu DAM
    (`AssetDetailDialogLoader.vue:26-31`); po FE-51 aj pre prvú dlaždicu.
  - **173** admin-dam: tlačidlá ‹ › pod loaderom detailu vyzerajú aktívne a nerobia nič
    (`AssetDetailDialogLoader.vue:50,66`).
  - **174** admin-dam: „Upraviť" panela po novom načítaní zoznamu otvorí detail bez lišty, keď asset nie je na
    zapamätanom mieste (pravidlo FE-50 nad nálezom FE-61; FE-61 to rieši).
  - **167** knižnica: widgety jedného obrázka píšu mená autorov do zdroja obrázka pred zápisom autorov do DAM
    (`ImageWidgetInner.vue:628-635`, `ImageMediaWidgetInner.vue:771-778`): po odmietnutom zápise a vymazaní výberu
    sa obrázok uloží s menami odmietnutých autorov. Galéria to má od OP5-L1 opravené.
- **Nálezy 151, 152, 156, 157 potvrdili posudky kroku OP5-D1 druhým čítaním:** body FE-59 až FE-62
  (`overenie-nalezov.md`, „Doplnok k šiestemu overeniu"); vlastník 13. 10. „opravime vsetko", opravené (časť 5.11).
- **Nové nálezy z kroku OP5-D1 (kód sa nemenil; 156 je FE-61, 157 FE-62, opravené v časti 5.11; zvyšok 157, Ctrl+klik,
  opravil `OP13-D3`):**
  - **156** admin-dam: po novom načítaní zoznamu ostane index aktívnej dlaždice zo starého zoznamu
    (`assetListStore.ts:48`, `setList` ho neruší): žiadna dlaždica nie je zvýraznená, klik na dlaždicu na starom
    indexe ju nezvýrazní, šípky pokračujú od starého indexu (v knižnici to isté ako 154).
  - **157** admin-dam: tlačidlo „upraviť" riadka v tabuľkovom pohľade robí dve veci naraz: `showDetail` zoznamu aj
    prechod routera na samostatnú stránku detailu; asset sa číta dvakrát.
  - **Cesty, ktorými sa rozpísané metadáta panela zahodia aj po FE-45** (`impl/OP5-D1.md`, časť „Zoznam"):
    uloženie hromadnej úpravy s assetom panela, ceruzka riadka fronty, vytvorenie assetu, odchod zo stránky (menu,
    logo, tlačidlo riadka tabuľky, zmena licencie, obnovenie okna), uloženie panela na ceste, zlyhané čítanie. Čítanie
    po zmene hlavnej cesty súboru rieši FE-47. Filter, hľadanie, zoradenie a stránkovanie rozpísané nezahodia.
    **Rozhodnuté:** ceruzka riadka fronty, vytvorenie assetu a odchod zo stránky (bez loga) opravené ako P1 až P3,
    tlačidlo riadka tabuľky ako FE-62 (časť 5.11); zlyhané čítanie rieši FE-47 (audit 15. 10.); uloženie panela na
    ceste je prijatá medza FE-45 (opravená v `OP13-D2`, bod 4); uloženie hromadnej úpravy s assetom panela nechať
    (vlastník 15. 10.; 19. 10. dal opraviť, `OP13-D2` vrátil, na vlastníkovi).
  - **132** knižnica: detail assetu, ktorého prvé čítanie zlyhá, nechá prázdny dialóg cez celú obrazovku, ktorý sa
    nedá zavrieť (dialógy sú `persistent`); pomôže len obnovenie stránky, neuložené zmeny galérie sú preč
    (`ImageWidgetMultipleInner.vue`, `UploadQueueDialog.vue`, `AssetDetailDialogFrame.vue`).
  - **133** knižnica: asset, ktorý dostane autorov cez nahratý duplikát a „Uložiť a použiť", neobnoví svoj pôvodný
    riadok galérie (rovnaká trieda ako FE-32).
  - **134** knižnica: zelené farby dropzóny „súbor je nad ňou" sa nikdy neukážu (kozmetika).
  - **135** knižnica: odpoveď čítania detailu, ktorá príde po jeho zavretí, ostane v sklade detailu; ďalší detail,
    ktorého čítanie zlyhá, potom ukáže starší asset.
  - **130** admin-dam: dialóg zrušenia distribúcie má rovnakú dieru ako FE-36 (po zlyhanom čítaní ostane zastavená
    distribúcia v zozname); lieči sa dopytovaním.
  - **131** admin-dam: detail assetu sa šípkou vľavo alebo vpravo prepne na susedný asset aj nad otvoreným dialógom.
  - **117** knižnica: riadok galérie sa po „upraviť asset" neobnoví; autorov uložených v detaile potom uloženie
    galérie nahradí tým, čo redaktor vyberie v riadku (rovnaká trieda ako FE-18).
  - **118** knižnica: galéria nemá poistku „metadáta sa ešte môžu zmeniť", ktorú majú widgety jedného obrázka.
  - **119, 129** knižnica: „Uložiť a použiť" odovzdá nahraný riadok bez metadát bez popisu a zdroja, neuložený,
    a s `dam.internal: false` bez ohľadu na asset.
  - **124, 127** knižnica: vypnutá dropzóna sa pri ťahaní zvýrazní; do dialógu fronty sa z klávesnice súbor pridať
    nedá.
  - **128** knižnica: pozri medzu FE-27 v časti 5.7.
  - **120, 121, 122** admin-dam, karta distribúcií: po zlyhanej „ďalšej strane" ostane číslo strany na novej;
    keď čítanie po úspešnom zmazaní zlyhá, zmazaná distribúcia ostane klikateľná bez „Skúsiť znova"; každé
    zavretie dialógu „Pridať distribúciu" číta zoznam znova.
  - **125, 126** admin-dam, dialóg záznamu distribúcie: „Zrušiť" počas ukladania dialóg odpojí, uloženie dobehne
    a zoznam sa neobnoví; po zavretí cez Esc alebo klikom mimo sa dialóg neotvorí, kým sa rozšírené nastavenia
    neskryjú a neukážu.
- **Staršie nálezy a medze opravené v blokoch 12 a 13** (18. až 20. 10.; riadky
  `krok5-praca/pracovne/veduci/stare-nalezy.md` a `stare-nalezy-1.md` až `-3.md`, ktoré menujú zadania krokov; časti
  5.16 a 5.17):
  - blok 12: 14 (mená ikonových ovládačov admin-dam a dvoch prvkov knižnice), 163, 18 (spoločné id skladu ROI, e2e
    DAM-B6), 76 (12. 10. nedokázaný, posudok `OP12-L3` ho potvrdil);
  - bez rozhodnutia vlastníka (A): A1 (detail mazaného assetu), A2 („Uložiť" detailu), A3 (falošný DAM admin-dam), A4,
    A5, A6; z `stare-nalezy-3.md` A3 (`damAuthors` riadkov galérie), zo `stare-nalezy-2.md` A6 (zvyšok 157);
  - výslovné „nechať", ktoré vlastník 19. 10. otvoril (B1): 61, 65, 80, 88, 89, 104 (FE-21), 22, 27, 37, návrhy 8, 9
    a 10 z 8. 10., druhá sada bod 5, medze deviateho bloku (a), (b); zo `stare-nalezy-1.md` A1 (zelená hlavička) a A2
    (premenovanie dvoch testov, vedúci); cesta panela pri hromadnom uložení `OP13-D2` vrátil (nižšie);
  - medza prijatá vedúcim: 176 s FE-63 a FE-67 (dôvod servera pri 403 a 422 akcií súborov);
  - medze knižnice (B2): N20, FE-1, FE-10, FE-32, FE-33, FE-53 a FE-54, FE-56, FE-65 a FE-75, FE-73, FE-74, 222, 223,
    232 a 233 (časový limit, `expandMetadata`, galéria), ZK13, `OP2-L1` (časť s duplikátom); zvyšok FE-78 overený,
    neškodí;
  - medze admin-dam (B3): zvyšok FE-15, FE-22, FE-29, FE-36, FE-37, FE-44 (prvé dve časti; tretia, Esc, neplatí od
    28. 9.), OP4-D1, FE-45, FE-47 (stráž), FE-61, P3 (chyby pod otázkou), FE-69 (b), (c), FE-71, `OP6-D1` (P1), FE-81,
    FE-84, FE-87, 218 a FE-85 (druhé „Stiahnuť"), `OP8-D1` (a), (b), (c), 234, text A, FE-89 s 225 a 227 (tretí text),
    197 a N1, `OP5-D2` (odchod zo zoznamu), FE-12 (a), (b), `OP7-T1` (GC).
- **Nerobí sa** (`plan-OP13.md`; L s malým prínosom, nedosiahnuteľné, vlastnosť knižnice tretej strany alebo zámer):
  FE-2, FE-39 s `OP4-L1`, FE-55, M-A, FE-12 (C, d, e, c, A), P3 „Späť dvakrát", FE-67 (náhľad videa), 223 medzi kartami,
  mapovanie `OP2-L1`, medze deviateho bloku (c), (d), 47, latentná časť PV14a; z nálezov bloku 12 bod 13 (tooltip a meno
  hovoria to isté; vlastník 19. 10.) a 20 (len popis správania). Ďalej nechané rozhodnutím vlastníka: 160 v dialógu
  obrázka so zvyškom 68 (19. 10.), 194 a 240, 214, 237, medze 238, F-C, FE-49, 35, návrh 6 a druhá sada bod 1 z 8. 10.
  Časť D zoznamu (PV14c) riešil štrnásty blok; stav jej riadkov je v bode „Skupina D (PV14c) po štrnástom bloku" na
  konci tejto časti.
- **Na rozhodnutie vlastníka po bloku 13** (`plan-OP13.md`, „Na rozhodnutie vlastníka z behu"):
  - **224** (widget s médiom): obrázok vytvorený počas otvoreného dialógu média ostane v CMS nepoužitý. Bezpečná oprava
    M až L (zmazanie vytvoreného by pri automatickom ukladaní článku nechalo odkaz na zmazaný obrázok). Odporúčanie
    nechať: výsledok je ako pri každej výmene obrázka za médium (`OP13-L2`, bod 7).
  - **FE-47, zlúčenie:** pri napísaných metadátach prevziať po zmene trasy aj ostatné zmeny servera; L (napísané sa
    sleduje jedným príznakom, nie po poliach), malý prínos. Odporúčanie nechať (`OP13-D2`, bod 6).
  - **Cesta panela pri hromadnom uložení** (`OP13-D2`, bod 16, vrátený v c1): (a) pred hromadným uložením assetu, ktorý
    drží panel s napísaným, sa opýtať „Neuložené zmeny" (S, odporúčané), (b) zlučovanie po poliach (L), (c) nechať.
  - **FE-69 (a)** (`OP13-D2`, bod 9, vrátený v c1): „Uložiť" ostáva zadržané pri nespracovanom hlavnom súbore nastavenom
    pod napísaným; spracovaný súbor nedokazuje doplnenie metadát (migrácia NAXOS). Odstráni ho až príznak doplnenia
    (`autocompletedMetadata`) v DTO admina, úloha backendu (súvisí s BE-2).
  - **218** (`noreferrer` kariet sťahovania, `OP13-D3` bod 7): zastavené; predvolená politika posiela úložisku len pôvod
    admina. Odporúčanie nechať; prípadne `Referrer-Policy: same-origin` na serveri admina po overení úložiska a CDN,
    alebo odkaz s `referrerpolicy` v karte s overením v prehliadači.
  - **FE-81** (`OP13-D3` bod 4): keď prehliadač nedá novú kartu, „Vytvoriť prázdny asset" na stránke poskytovateľa asset
    nevytvorí a dialóg ostane s novou hláškou (nad rámec zadania; posudok: lepšie správanie). Potvrdiť.
  - **Nové texty** `coreDam.asset.newTabBlocked` a `system.uploadErrors.fileMissing` (časť 2), skontrolovať pred
    commitom; `fileMissing` prípadne zjednotiť s „Asset už neexistuje.", rovnako text „Neznáma chyba" (`assetMissing`)
    riadku knižnice vzdaného pre chýbajúci asset (`OP13-L4`, mimo bodov).
  - **222** (`OP13-L3`, posudok L4): ukotvenie posunu v Chromiu a Firefoxe môže návrat tlačidla po zlyhaní rátať ako
    posun a pýtať znova (neoverené). Možnosti: reagovať na posun používateľa (koliesko, dotyk, klávesy) namiesto polohy,
    alebo po zlyhaní opakovať len na stlačenie „Načítať viac".
  - **`ACachedChip` a `ACachedUserChip`** (čipy s pamäťou admina) sa pri vypadnutom mene točia bez konca; pripnutie by
    potrebovalo nové vlastnosti (pamäť admina cez `getCachedFn`).
  - **`ck-dam.sh`** spúšťa testy admin-dam s tromi procesmi (rozhodnutie vlastníka 14. 10.), globálne pravidlo hovorí dva;
    potvrdiť, ktoré platí.
  - Neoverené, bez rozhodnutia: widget zatvorený s otvorenou frontou nechá frontu v sklade a riadok, ktorý sa neusadí,
    sa dopytuje bez konca (`stare-nalezy-1.md`, nočná poznámka).
  - Rozhodnuté 19. 10., čaká na čin: komentár admin-ugc `src/domains/system/logout.ts:3-4` (`stare-nalezy.md` A7) sa
    opraví pri povýšení knižnice v admin-ugc; backendový nález `rotation` pridá vlastník do #86919 (nasledujúci bod).
- **Backend, nový nález bloku 13** (`OP13-D1` c2): `core-dam-bundle/src/Model/Dto/Image/Embeds/ImageAttributesAdmDto.php:40`
  `->setRotation($attributes->getRatioWidth())`: detail súboru (`GET` aj odpoveď otočenia) hlási ako
  `imageAttributes.rotation` pomer šírky (napr. 16), nie otočenie. admin-dam pole nečíta (len falošný server testov).
  Vlastník 19. 10.: pridá do #86919. Mimo #86919 (nízke, `stare-nalezy.md`, vedľajšie zistenia): `setToSlot`
  nekontroluje obsadený slot a zastaraný zoznam slotov dostane namiesto 4xx chybu 500 (`add_to_slot_failed`).
- **Nové nálezy blokov 12 a 13, len zapísané** (kód sa nemenil; znenia v poznámkach krokov):
  - knižnica (`OP13-L1`): výber alebo upload potvrdený pri galérii len na čítanie sa zahodí bez slova; hromadné
    operácie a výber galérie po čakaní zapíšu do spoločného skladu obrázkov aj po jej zániku; `getExtSystemByLicence`
    si pamätá len úspechy a nezdieľa čítanie na ceste; formulár `expandMetadata` drží zámok poľa, kým ho hostiteľ
    nepotvrdí; polia autorov berú autorov zo zoznamu ext systému stránky, mená vybraných sa hľadajú pod ext systémom
    licencie (pri dvoch ext systémoch by zdroj vyšiel prázdny alebo kratší; dnes nenastane);
  - knižnica (`OP13-L2`): `replaceEmptyAuthors` dáva riadkom to isté pole (neškodí); `removeItem` s
    `callDeleteApiOnRemove` odoberá podľa indexu spred čakania; obrázok daný hostiteľom sa počíta ako prečítaný v tej
    chvíli (233 ho nepokrýva); „Upraviť obrázok" čaká na čítanie po detaile bez limitu; galéria po zániku ešte povie
    chybu kópie, čítania „ako sú" a uloženia;
  - knižnica (`OP13-L3`): čítanie po zavretí detailu, ktoré zlyhá, nechá dlaždicu označenú vedľa prázdneho panela;
    zlyhané čítanie vlastného assetu duplikátu sa ohlási, hoci dialóg ukazuje originál; čipy pridajú id, ktoré rodič ešte
    nepridal (čítanie o 1,5 s neskôr); rám FE-76 a dlaždíc má v tmavej téme kontrast asi 1,9 až 2,2:1, pod 3:1 WCAG 1.4.11;
  - admin-dam (`OP13-D1`): manifest `explicit-imports` menuje ďalších 27 neexistujúcich súborov (záznam behu codemodu,
    na rozhodnutie vedúceho); e2e `settings/authorCleanPhrase.spec.ts:152` má stále `test.fail()` pre DAM-B4, ktorý
    changelog 3.0.0 uvádza ako opravený (pravdepodobne „expected to fail"; nespustené); obrazový asset bez obrazového
    hlavného súboru: „Fókus" pri otvorení nič nekreslí a vetu „Slot nemá obrázok." nepovie;
  - admin-dam (`OP13-D3`, `OP13-D4`): tichá záloha `showUnknownError` volajúcich obalov je takmer mŕtva; testy s ponukou
    mimo `RouterView` dostanú varovanie vue-routera k `onBeforeRouteLeave`; väzba `refreshMayHelp: () => false` sa pýta aj
    pri zlyhanom riadku (riadky admin-dam „Obnoviť" pri ňom neponúkajú).
- **Skupina D (PV14c) po štrnástom bloku** (riadky časti D `stare-nalezy.md`; časť 5.18; v čase zápisu necommitnuté):
  - **hotové:** 23 (upload vo widgete s pomenovanou konfiguráciou: obchod, kúsky, fronta a pamäte podľa mena; `L1`,
    `L3`); 86 (kľúč `endPointCmsAsset`, `L5`); medza PV14b, pamäte mien autorov, kľúčových slov a používateľov podľa
    konfigurácie (`L2`; oneskorenie 1,5 s pamäte ostáva); medza PV14, „jedna stránka = jeden core-dam" (čítania
    a udalosti podľa konfigurácie, `L3`, `L4`); medza FE-1 a Codex K2, zápis detailu do riadkov všetkých frontov
    (`L3`); medza 160, pamäť autorov cez `default` (`L2`); 83 a D2, `Object.hasOwn` vo voľbách obrázka (`L5`); 161
    a X1 až X3, ext systém pamätí podľa konfigurácie (`L2`); C1 až C8, obchod konfigurácie DAM a veľkosť kúska
    (`L1`); P1 až P3 a Codex K1, sokety a pôvod udalostí (`L4`); U1 až U3, `currentUser` konfigurácie (`L5`;
    `ImageMediaWidgetInner` bez `skipCurrentUserCheck`, voľba 6); G1, G2, `adminDomain` a `apiTimeout` (`L5`); F,
    kľúče pevných adries (`L5`; funkcie len s klientom ostávajú na pevných adresách, voľba 1); D1, D3, D4 a HMR
    (`L6`, `L1`, `L2`);
  - **ostáva:** v rámci jednej konfigurácie ext systém pamätí posledný zapísaný; medza PV14a 1 (rozbehnuté pridanie
    pomenuje vyprázdnenú frontu znova; front drží jedno meno, mimo PV14c); jedna adresa soketu = jeden DAM (voľba 5);
  - **neriešené:** 85 (pridania do fronty z widgetov bez `catch`; 12. 10. nedokázaný); nález PV14a „každé čítanie
    skladá celé voľby konfigurácie" (v pláne PV14c nie je, stav neoverený); medza PV14a 2 sa nerobí (`plan-OP13.md`).
