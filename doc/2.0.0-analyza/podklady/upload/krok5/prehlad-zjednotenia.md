# Krok 5: čo sa zjednotí a čo ostane na každej strane inak (prehľad pre vlastníka, 9. 10. 2026) — verzia 3

Zostavené len z uzavretých návrhov: `navrh-jadro.md` (verzia 10.3: požiadavky, služba uploadu, sklady fronty) a
`navrh-komponenty.md` (verzia 4.3: komponenty uploadu a „falošný" formulár), z denníka `upload-postup.md` a pri
otázke „kedy" z plánu `plan-implementacie.md` (časť 7). Nič tu nie je navyše; kde sa zdroje rozchádzajú, je to v
časti 7. Kód kroku 5 zatiaľ neexistuje, všetko je návrh.

**Verzia 3 oproti verzii 2** (posudok Opusa nad verziou 2, `posudok-prehladu-v2-opus.md`, 11 bodov; jadro 10.3;
komponenty 4.3; plán verzie 2)

| Vec | Verzia 2 | Verzia 3 |
|---|---|---|
| Čo blokuje a kedy (0; Opus 1) | „Začiatok nič neblokuje", PV po častiach pred K2, K3, K5 | podľa plánu: rozhodovacie sedenie V0 na začiatku rozhodne **všetkých sedem** „na potvrdenie" pred K2, k tomu súhlas s `copy.sh`, `mv` do koša, PK3, nález 20 ako vlastný malý krok a návrh uzavierať krok s výhradou K-04; pohľady K-04 po U3, U5c, U6 (po U6 už len ZK23) |
| Z26, PV13 (0, 2, 3; Opus 2; jadro 10.2) | viditeľný účinok len v admin-dam | čip s dôvodom od servera ostane **vo všetkých troch aplikáciách**; v admin-dam navyše nepríde upozornenie; citát PV13 podľa jadra 10.3 |
| Z17, PV7 (0, 2, 3; Opus 7; jadro 10.2) | „dnes sa dosiela nevidený a asset ostane" | asset ostane na serveri aj po zmene; zastavia sa len zvyšné kúsky; citát PV7 podľa jadra 10.3 |
| Opravy chýb, ktoré vidno (0, 2; Opus 8; jadro 10.2) | „dve opravy (Z26, ZK13)" | štyri: Z23 (odhad rýchlosti a zvyšného času, všetky tri aplikácie; jadro ho teraz vedie ako viditeľné, rozhodne vlastník), Z26, ZK13, ZK18 (čítačka obrazovky); citát PV4 podľa jadra 10.3 |
| ZK26 (0, 1.4, 2, 3.2; Opus 6; komp. 4.3) | kozmetika, „zalamujú sa ako v detaile" | **vypustené**: zalamovanie ostáva cez adaptér (JS29), na obrazovke sa nič nemení. Zblížení je 48 (jadro 26, komponenty 22), kozmetiky 5, adaptérových rozdielov 16 |
| PV16 (0, 4, 4.1; Opus 5; jadro 10.2) | chýbalo | nová otvorená téma: dopytovanie distribúcií v admin-dam hlási každé zlyhané čítanie; čaká na tvoje slovo spolu 20 položiek |
| PK3 (0, 1.2, 4; Opus 9; komp. 4.2) | „šípky" | šípky hore a dole, PageUp, PageDown, Home, End; doľava a doprava fungujú |
| Nález 20 v admin-ugc (4; Opus 10) | „admin-ugc túto cestu nemá" | API admin-ugc cestu nemá vôbec a admin-ugc nastavuje adresu obrázkov `/ugc/v1/image`, takže oprava pomôže len admin-cms; či sa admin-ugc k prepínaču kópie vôbec dostane, overí krok nálezu 20 |
| Sady v jadre (0; Opus 11) | „14 členov … a profil usadenia" | profil usadenia je jeden zo 14 členov |
| Viditeľné ZK (3.2; Opus 11) | ZK11 medzi viditeľnými | ZK11 nevidno (admin-dam stiahne o 57 KB menej), podľa registra |
| Časť 7 | 10 bodov | ostávajú 4: PV10, staršia verzia jadra v komponentoch, nález 36, zvyšok „červený" v denníku. Vypadli body, ktoré jadro 10.2, komponenty 4.2 a 4.3 a denník už zladili (Opus 3, 4) |

**Verzia 2 oproti verzii 1** (posudok Codexu nad verziou 1: počty v časti 0 a citáty v 3.1 sedia, sedem nálezov)

| Vec | Verzia 1 | Verzia 2 |
|---|---|---|
| Čo sa pošle na backend (0, 2) | „nemení sa, čo sa v bežnom toku pošle"; Z27 v skupine „nič" | povedané rovno: Z27 mení požiadavku (typ súboru na každej časti kúska), server ju nečíta; Z2, Z5, Z6 a ZK20 tiež menia, čo odíde |
| Skupiny časti 2 | (a) 35 vnútorných „nikto nič nevidí" | (a) 29 naozaj bez účinku; nová skupina (b) 6 položiek, ktoré menia požiadavku alebo časovanie (Z2, Z5, Z6, Z15, Z27, ZK20; registre ich vedú ako vnútorné); ostatné skupiny posunuté na (c) až (e) |
| Kôš v riadku (1.1) | admin-dam „vždy"; otázka knižnice neuvedená | admin-dam: tlačidlo je vždy, ale vypnuté bez upraviteľných metadát okrem duplikátu; otázky oboch strán doslova |
| Usadzovanie (1.10) | jeden riadok bez textov | tri riadky: roly a politiky, zhoda notifikácie s riadkom, texty usadenia oboch strán doslova (aj text admin-dam pre slot) |
| Nález 20 (kópia do licencie) | len v 4.1 | v časti 0 medzi vecami, ktoré čakajú na tvoje áno, a vlastný riadok v časti 4; spolu čaká 19 položiek |
| Nálezy 32 a 39 („pozrieť skôr") | len v 4.1 | vlastné riadky v časti 4 |
| Nález 31 (4.1) | „odložené" | pridelenie kroku 5 podľa denníka a otvorená voľba, kto prideľuje pozíciu |
| PV10 (4, 7) | nezrovnalosť vyriešená ako fakt | oba výroky vedľa seba; zladiť ich musíš ty alebo plán (plán ide dnes podľa komponentov) |
| Kedy treba rozhodnúť (0) | — | odkaz na plán implementácie, časť 7 |

**Hranica, podľa ktorej návrhy triedia** (tvoje usmernenie z 8. 10. 21:10): na každej strane ostáva, čo používateľ
vidí a môže robiť (polia, formuláre, tlačidlá, kroky), texty, čo sa v bežnom toku pošle a uloží, ktoré API strana
používa, a voľby aplikácie. Zjednotiť sa smie vnútorné časovanie a poradie, hodnoty, ktoré nikto neukazuje, kľúče a
počítadlá, pár pixelov, iný kontajner a chyby jednej strany. Pri každej položke časti 2 posúď, či je to naozaj
kozmetika; ak nie, vráti sa ako nastavenie alebo slot strany.

**Skratky.** *Knižnica* = `common-admin`; to dostávajú admin-cms a admin-ugc cez widgety a dialógy uploadu.
*admin-dam* = aplikácia DAM s vlastnou frontou, slotmi, hromadnou úpravou a externými poskytovateľmi. Spôsoby, akými
rozdiel ostane: *sada* (hodnota alebo podaná funkcia v službe či jadre fronty; sadu vyrobí len jej funkcia, nedá sa
poskladať z častí oboch strán), *vlastnosť* (prop), *slot*, *väzba* (objekt podaných funkcií, ktorý dá obal
admin-dam), *konfigurácia pluginu*, *obal* (tenký súbor admin-dam na mieste dnešného), *adaptér* (len medzi detailom
assetu a dialógom jedného súboru), *vlastný kód* (vec má len jedna strana a ostáva tam). Predvolené je vždy dnešné
správanie knižnice; admin-dam podá svoje.

**Zdroje v poslednom stĺpci.** „jadro 2.8 `requests`" = návrh jadra, časť 2.8, člen sady; „jadro C49" = riadok
tabuliek časti 1 návrhu jadra (A požiadavky, B služba, C sklady); „komp. RD12" = riadok časti 1 návrhu komponentov
(RD riadok, ZN zoznam, HO hromadné operácie, ST tlačidlo zastavenia, FM formulár, OB obrázok, AK autori a kľúčové
slová, SB výber súborov, OL obaly, JS detail a dialóg jedného súboru, IM objekt obrázka); Z a ZK = registre zblížení;
PV = témy pre vlastníka v jadre; PK3 = téma komponentov; „nález N" = tabuľka nálezov v denníku.

---

## 0. Na jednu obrazovku

**Čísla**

| | Jadro | Komponenty | Spolu |
|---|---|---|---|
| Porovnaných správaní (riadkov tabuliek) | 133 | 144 | 277 |
| rovnaké na oboch stranách | 39 | 42 | 81 |
| ostáva na každej strane cez sadu, vlastnosť, slot, väzbu, konfiguráciu | 15 | 27 | 42 |
| ostáva medzi detailom a dialógom jedného súboru (adaptér) | — | 16 | 16 |
| vlastný kód jednej strany, ostáva | 32 | 23 | 55 |
| už rozhodnuté skôr | 9 | 11 | 20 |
| zbližuje sa (riadky) | 33 | 22 | 55 |
| pre vlastníka (otvorené) | 5 (+ PV16 bez riadku) | 3 (+ PK3) | 8 riadkov, PV15 v oboch (+ PV16, PK3) |

- **Na každej strane ostáva** v jadre 14 členov sád (13 riadkov tabuľky jadra 2.8: 9 produktových rozdielov, 4 väzby
  na aplikáciu a stav skladu, medzi nimi profil usadenia `settlement`, a 1 do rozhodnutia PV12); v komponentoch
  7 nových vlastností riadku, 3 sloty riadku, 2 sloty a 2 vlastnosti zoznamu, väzby `queue` a `operations`, 2 kľúče
  konfigurácie, `disabledAs`, `showTts` a injekcia návrhov fronty.
- **Zbližuje sa 48 položiek** (26 v jadre: Z1 až Z27 bez vyradeného Z25; 22 v komponentoch: ZK1 až ZK27 bez
  vypustených ZK2, ZK3, ZK4, ZK24, ZK26): **29 bez účinku** (nikto nič nevidí a žiadna požiadavka sa nemení), **6 mení
  požiadavku alebo časovanie** (registre ich vedú ako vnútorné; Z15 si v admin-cms a admin-ugc všimne pozorný
  používateľ), **5 kozmetických**, **7 opráv chýb**, **1 mení zobrazený text** (Z9). Štyri opravy chýb menia aj to,
  čo používateľ vidí alebo počuje: Z23 (odhad rýchlosti a zvyšného času, všetky tri aplikácie), Z26 (čip s dôvodom od
  servera, všetky tri aplikácie; v admin-dam aj bez upozornenia navyše), ZK13 (meno v chipe, admin-dam), ZK18
  (čítačka obrazovky, admin-dam). Z9 a Z23 jadro výslovne vedie ako „viditeľné, rozhodne vlastník".
- **Čaká na tvoje slovo 20 položiek:** 10 zblížení „na potvrdenie" (všetky z jadra, časť 3), 9 otvorených tém (PV9,
  PV10, PV12, PV14, PV15, PV16 z jadra; nález 25, nález 36 a PK3 = nález 46 z komponentov; PV15 majú oba návrhy) a
  **oprava nálezu 20, ktorá čaká na tvoje áno**: kópia do licencie v knižnici ide na adresu, ktorú backend nemá, a od
  tretej sady každý pokus ukáže „neznámu chybu" (časť 4). Rozhodnuté D4 je súčasťou PV12 a bez teba sa nevykoná.
  Navyše dva nálezy denníka „pozrieť skôr" (32, 39) a ďalšie nálezy s otvorenou voľbou (4.1).
- **Čo blokuje a kedy** (plán implementácie, časť 7; plán sa ešte upravuje, platí jeho časť 7, nie toto zhrnutie).
  Kódovanie sa začne až s tebou. Na rozhodovacom sedení **V0 na začiatku, pred K2**, rozhodneš **všetkých sedem**
  zblížení „na potvrdenie", ktoré sa robia v krokoch zjednotenia (PV1, PV2, PV3, PV5, PV6, PV7, PV11); bez nich sa K2
  nezačne. Vo V0 ďalej: výslovný súhlas s `copy.sh` pred prvou kópiou knižnice (vo vnútri robí `cd` a `rm -rf` v
  `node_modules` admin-dam), `mv` do koša pri návrate, PK3 (áno: krok po U4), nález 20 (áno: vlastný malý krok) a
  návrh plánu uzavrieť krok s výhradou, keď nebudeš pri pohľade K-04. **Pohľady K-04** (vzhľad zblíženia v
  prehliadači) robíš po U3 (ZK11), U5c (ZK5) a U6 (ZK23). Až po K6: opravy F1, F2, F4 (PV4, PV8, PV13). Nič
  neblokujú: PV12 (krok K2-D4), PV9, PV10, PV14, PV15, PV16, nálezy 25, 36, 45 a „pozrieť skôr" 32, 39.
- **Už rozhodnuté zmeny, ktoré nie sú zblížením:** 12 anglických reťazcov admin-dam (R10), názov poľa v prístupných
  menách tlačidiel hromadných operácií (U8), zánik vymysleného assetu v dialógu jedného súboru (R16). Časť 5.
- **Čo sa mení.** Podľa oboch návrhov sa na žiadnej strane nemení, čo používateľ môže urobiť, čo sa uloží, ani API a
  typy assetov. Čo uvidí inak, je v častiach 2 a 5 (Z9, Z23, Z26, ZK13, ZK18, kozmetika, R10, U8). **Čo sa pošle, sa mení v
  drobnostiach:** admin-dam začne posielať typ súboru na každej časti kúska (Z27; mení sa požiadavka, server ju
  nečíta) a hlásenia do Sentry (Z2); prvý kúsok ďalšieho súboru môže mať po zlyhanom alebo zastavenom uploade inú
  veľkosť (Z6) a ďalšie kúsky mierne inú veľkosť po oprave merania (Z23); admin-dam pošle menej požiadaviek na mená
  (ZK20); niektoré zbytočné kúsky už neodídu (Z5, Z17, Z26); ďalší súbor v admin-cms a admin-ugc môže odísť skôr
  (Z15).

**Prečítaj najskôr**

1. **Z9 (PV5) a Z23 (PV4): jadro ich vedie ako viditeľné a rozhodneš o nich ty.** Z9: riadok zoznamu admin-dam po
   odoslaní posledného kúska ukáže plný kruh bez zvyšného času namiesto posledného percenta so zvyšným časom alebo
   točiaceho sa kolieska. Z23: odhad rýchlosti a zvyšného času je na začiatku trochu presnejší, vo všetkých troch
   aplikáciách. Časť 2 (d), (e) a 3.
2. **Z17 (PV7) a Z26 (PV13): čo sa stane s uploadom, ktorý ešte beží.** V admin-cms a admin-ugc sa po odstránení
   alebo zastavení riadku, ktorý server medzitým ohlásil, prestanú posielať zvyšné kúsky jeho súboru; asset ostane
   na serveri ako dnes. Súbor, ktorý server ohlásil ako zlyhaný, sa prestane posielať a vo všetkých troch
   aplikáciách ostane v riadku čip s dôvodom od servera; v admin-dam nepríde ani upozornenie navyše. Časť 3.
3. **D4 (PV12): rozhodnuté, ale zadržané.** Ak knižnica prevezme meranie rýchlosti z admin-dam, upload z viacerých
   kúskov v admin-cms a admin-ugc môže ostať na „0 %" (riziko R1). Návrh: potvrdiť len spolu s opravou F1 a po
   ručnom uploade súboru nad 1 MB v CMS. Časť 4.
4. **PK3 (nález 46): chyba, na ktorú používatelia narážajú dnes.** V dialógu fronty v admin-cms a admin-ugc
   nefungujú pri písaní metadát šípky hore a dole, PageUp, PageDown, Home ani End (doľava a doprava fungujú). Návrh
   odporúča zaradiť opravu do plánu ako samostatný krok. Časť 4.

---

## 1. Čo ostane na každej strane inak

Podľa obrazoviek a funkcií. Stĺpec „Ako" hovorí, akým spôsobom rozdiel prežije spoločný kód.

### 1.1 Riadok fronty

| Čo | Knižnica (admin-cms, admin-ugc) | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Prekrytie duplikátu nad obrázkom („Duplikát", „Zobraziť originál" v novej karte) | nie je | je | slot `image-overlay` (vyplní obal admin-dam) | komp. RD3 |
| Riadok „Hlavný súbor je duplikát." pod názvom | je | nie je | vlastnosť `duplicateNotice` (admin-dam `false`) | komp. RD4 |
| Tlačidlo úpravy | „Upraviť v DAM", vždy, vypnuté bez metadát; otvorí detail knižnice | „Upraviť", na duplikáte nie je; otvorí detail admin-dam | slot `edit` a vlastnosť `hideEditOnDuplicate` | komp. RD5 |
| Pri ktorých stavoch je „Zrušiť" (×) | načítava sa, čaká, posiela sa | navyše spracúva sa a zlyhal | vlastnosť `cancelStatuses` | komp. RD8 |
| Kôš | „Odstrániť z fronty" bez požiadavky na server; zobrazí sa len pri ponúknutom „Obnoviť" alebo pri zlyhanom riadku; otázka „Odstrániť z fronty nahrávania?" (EN „Remove item from queue?") | zmaže asset na serveri; tlačidlo je vždy, len s právom `dam_asset_delete`, a je vypnuté, kým riadok nemá upraviteľné metadáta, okrem duplikátu; predvolená otázka spoločného tlačidla „Odstrániť?" (EN „Remove?"), po zmazaní upozornenie | slot `remove` | komp. RD9; kód riadku oboch strán |
| Kedy riadok ponúkne „Obnoviť" (po 20 s posielania či spracovania, nahratý riadok bez metadát alebo s upozornením) | dnešné pravidlo knižnice; riadok, ktorý sa pripojí už s upozornením, ponúkne „Obnoviť" až po 20 s | dnešný watcher admin-dam, presunutý do obalu bez zmeny: riadok, ktorý prejde na nahratý alebo sa pripojí už s chybou, má „Obnoviť" hneď a nechá si ho aj s metadátami; upozornenie, ktoré príde neskôr, nič nezrýchli | vlastnosť `refreshOffered` | komp. RD10, RD12 |
| „Obnoviť" na zlyhanom riadku | len keď môže pomôcť a riadok má asset | nikdy | už rozhodnuté; vlastnosť `refreshMayHelp` admin-dam nepodá | komp. RD13; jadro C46 |
| Formulár na duplikáte | vypnutý len vtedy, keď riadok nesmie upravovať metadáta | vypnutý na duplikáte vždy | vlastnosť `disableFormOnDuplicate` | komp. RD15 |
| Kto zbiera validáciu polí riadku | rozsah knižnice | rozsah admin-dam | vlastnosť `validationScope` | komp. RD17 |
| Kľúčové slová a autori, kým sa riadok nedá upravovať | štítok s chipmi, „+" skryté | vypnuté pole, „+" vypnuté | vlastnosť `disabledFieldsAs` (`chips` / `input`) | komp. RD19, AK3 |
| Prepínač „Jednorazová licencia" | len pri voľbe `mainFileSingleUseEnabled` (admin-ugc ho nemá) | vždy | vlastnosť `mainFileSingleUseEnabled` (obal podá `true`) | komp. RD20 |
| Kôš pri dvoch riadkoch toho istého assetu odoberie prvý z nich (nález 38) | — | áno | vlastný kód obalu admin-dam | komp. RD24 |
| Obsah udalostí „Obnoviť" a „Zrušiť" (riadok navyše, meno kľúča fronty) | ako dnes | ako dnes | obal admin-dam ich doplní; nič viditeľné | komp. RD21, RD22 |

### 1.2 Zoznam fronty

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Od koľkých riadkov je vedľa zoznamu sidebar hromadných operácií | od 1 | od 2 | vlastnosť `massOperationsFrom` | komp. ZN2 |
| Posun zoznamu klávesmi (šípky hore a dole, PageUp, PageDown, Home, End) | áno (s chybou PK3, časť 4) | nie | vlastnosť `keyboardScroll` | komp. ZN3 |
| Kto sa pýta servera pri „Obnoviť" | sklad knižnice podľa assetu | sklad admin-dam podľa riadku | väzba `queue.refresh` | komp. ZN7 |
| „Zrušiť" | sklad knižnice | sklad admin-dam | väzba `queue.cancel` | komp. ZN8 |
| Odstránenie riadku | odstráni z fronty | zmazaním assetu v riadku | väzba `queue.remove` a slot `remove` riadku | komp. ZN9 |
| Otvorenie detailu | dialóg knižnice počúva udalosť riadku | robí obsah slotu v riadku | slot `edit` riadku | komp. ZN10 |
| Načítanie mien kľúčových slov a autorov pri otvorení | cache knižnice | cache admin-dam (po kroku U2 preposielač tej istej cache) | väzba `queue.prime` | komp. ZN11 |
| Kto ukáže upozornenie | upozornenia knižnice | upozornenia z kódu admin-dam | väzba `queue.warn` | komp. ZN12 |
| Ktorý sidebar sa vykreslí | sidebar knižnice | obal sidebaru admin-dam | slot `sidebar` | komp. ZN13 |

### 1.3 Hromadné operácie

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Do ktorých riadkov idú kľúčové slová a autori | do každého | len do riadkov typu, ktorý ich má zapnuté | parameter `accepts` pri volaní (jadro); väzba `operations.fillKeywords`, `fillAuthors` (komponenty) | jadro 2.8 `accepts`, C49; komp. HO4 |
| Kto zapisuje do riadkov | composable knižnice nad jej skladom | akcie skladu admin-dam | väzba `operations` | komp. HO5; jadro C47 |
| Je sidebar pri otvorení rozbalený | nie, na celé sedenie | na počítači áno, v hromadnej úprave áno | vlastný kód hostiteľov | komp. HO11 |
| Hromadná úprava vybraných assetov (riadky „načítava sa", zoznam riadkov bez metadát) | nie je | je | vlastný kód skladu admin-dam; sada jadra `rowTracked`, `rowRemoved` | jadro 2.8, C15, C16 |

Anglické texty sidebaru admin-dam sa menia podľa rozhodnutia R10 (časť 5); panely typov a „Vyčistiť" sa zbližujú
(ZK7, ZK8, časť 2).

### 1.4 Detail assetu a dialóg jedného súboru (obe obrazovky sú v knižnici)

Obe pôjdu cez jeden rámec „obrázok a sidebar". Rozdiel medzi nimi je rozdiel dvoch obrazoviek tej istej strany a
ostáva cez adaptér (z assetu detailu, z riadku fronty) alebo slot rámca.

| Čo | Detail assetu | Dialóg jedného súboru | Ako | Zdroj |
|---|---|---|---|---|
| Kedy sa ukáže načítavanie | počas načítania | aj kým nie je riadok (nad prázdnou frontou nekonečne, nález 30) | adaptér (`loading`) | komp. JS2 |
| Nadpis | „Zdrojový systém: …" | „Nahrávanie" / zelené „Nahrávanie ukončené" | slot `title` | komp. JS3 |
| Zatvorenie | ikonové „Zatvoriť" | tlačidlo zastavenia: počas posielania sa pýta, zastaví frontu, zavrie | slot `toolbar-actions` | komp. JS4 |
| Editor oblasti záujmu vľavo, záložka „Fókus", jednoduchý sidebar (admin-ugc) | pri záložke „Fókus" alebo jednoduchom sidebare; záložka pri obrázku | to isté, ale len s načítaným assetom | adaptér | komp. JS6, JS15, JS16 |
| Obrázok | náhľad detailu, inak 356 × 200 a sivé pozadie; bez stavov uploadu | náhľad riadku, stavy uploadu, percentá, pomer 16 : 9 | adaptér | komp. JS7, JS8 |
| Prekrytie chyby nad obrázkom | nie | áno, to isté ako v riadku | slot `image-overlay`; obal okolo obrázka len s ním | komp. JS9, JS10 |
| Nad obsahom sidebaru | stav assetu, súboru a dôvod | oznam duplikátu, „Jednorazová licencia" originálu | slot `prepend` | komp. JS17 |
| Obsah záložky „Info" a ukladanie | metadáta assetu, jedno „Uložiť" | metadáta riadku; „Obnoviť", „Uložiť", „Uložiť a použiť", ukladá dialóg hromadne | slot `info`; tlačidlá ukladania sú vlastný kód každej obrazovky | komp. JS18, JS23, JS25 |
| Panel „Info o súbore" | pri voľbe `showFileInfoEnabled`; s tým, kto asset vytvoril a zmenil | aj len s načítaným assetom; bez používateľov | jeden komponent panela, vlastnosť `showUsers` | komp. JS27, JS28 |
| Zalamovanie v paneli „Info o súbore" | dlhé slovo sa nezalomí (`overflow-wrap: normal`); platí aj pre pravý sidebar výberu assetu | slovo sa zalomí kdekoľvek (`break-word` karty) | adaptér: detail podá panelu atribút so štýlom, dialóg nič; na obrazovke sa nič nemení (zblíženie ZK26 vypustené) | komp. JS29 |
| Načítanie assetu po dokončení, záložka „Info" pri otvorení, „Obnoviť" po 20 s | — | áno | vlastný kód dialógu | komp. JS13, JS14, JS20 |
| Validácia pred uložením, tlačidlo „upraviť v DAM", len na čítanie, typ assetu | voliteľné tlačidlo, len na čítanie, typ z assetu | nie; formulár vypnutý bez metadát, vždy obrázok | vlastný kód | komp. JS24, JS26 |
| „Obnoviť" pri zlyhanej položke | — | neponúka (riadok fronty áno) | otvorená téma, nález 25 (časť 4) | komp. JS21 |

**Detail assetu v admin-dam** ostáva celý (jeho sklad aj dialóg); jeho metadáta prejdú na formulár a výbery
knižnice s výslovne podaným rozsahom validácie admin-dam (komp. FM4, 2.6). **Zápis uloženého detailu do riadkov
fronty** ostáva vlastným kódom každého skladu: knižnica asset znova prečíta a doplní návrhy, konflikty autorov a
cache; admin-dam skopíruje hodnoty z objektu bez požiadavky (jadro C51).

### 1.5 Formulár vlastných metadát, obrázok assetu, výber súborov

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Predvolený rozsah validácie formulára | rozsah knižnice | rozsah admin-dam, odteraz podaný výslovne na oboch miestach | vlastnosť `validationScope` | komp. FM4 |
| Hodnoty len na čítanie | áno (výber assetu) | nie | vlastný kód knižnice | komp. FM5 |
| Ikona TTS pri syntetickom audiu (dlaždice a tabuľka) | nie | áno, titulok „Syntetické (TTS)" | vlastnosť `showTts` (knižnica `false`) | komp. OB3 |
| Upozornenie „Nesprávny formát alebo veľkosť" | kľúč knižnice | `FileUpload` admin-dam so svojím kľúčom | vlastný kód admin-dam (kontrola knižnice bez jej upozornenia) | komp. SB3 |
| Celookenná zóna, prechádzanie priečinkov, tri varianty tlačidla | — | áno | vlastný kód admin-dam | komp. SB6 |
| Dialóg nad limitom 50 súborov | vo viacnásobnom widgete | v `AssetUpload` | vlastný kód každej strany; jadro limit nemá | komp. SB7; jadro C57 |

### 1.6 Autori a kľúčové slová

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Kto smie vytvoriť kľúčové slovo alebo autora | každý | len s `dam_keyword_create` / `dam_author_create` | konfigurácia `keywordCreateAcl`, `authorCreateAcl` | komp. AK2, 2.12 |
| Vzhľad poľa, kým sa nedá upravovať | štítok s chipmi, „+" skryté | vypnuté pole, „+" vypnuté | vlastnosť `disabledAs` | komp. AK3 |
| Ikona „nové" na chipe podľa návrhov fronty | sklad knižnice | sklad admin-dam | injekcia `UploadQueueSuggestionsKey` (poskytne obal zoznamu admin-dam) | komp. AK7 |
| Konflikty autorov pri hromadnej úprave bez mien (nález 40) | — | sklad admin-dam | vlastný kód | komp. AK20 |
| Tlačidlo nového kľúčového slova na stránke kľúčových slov | — | áno | vlastný kód admin-dam | komp. AK21 |
| Cache mien | cache knižnice | vlastná | jedna cache knižnice (zblíženie ZK20); člen profilu `caches` ostáva | jadro C58; ZK20 |

### 1.7 Obaly: dialóg fronty a prekrytia

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Kto vlastní dialóg na celú obrazovku | dialóg sám | obal aplikácie | vlastný kód | komp. OL1 |
| Hlavné tlačidlo | „Uložiť a použiť" (odovzdá obrázky widgetu) | „Uložiť a ukončiť" (vyčistí frontu, načíta zoznam) | vlastný kód | komp. OL2 |
| Právo na uloženie, minimalizácia, zatvorenie, „+", obnovenie zoznamu | podľa knižnice | podľa admin-dam | vlastný kód | komp. OL3 |
| Plávajúce panely, panel slotov, pás výberu, import od externých poskytovateľov | — | áno | vlastný kód | komp. OL4 |
| Dialóg jedného súboru | áno | — | vlastný kód (časť 1.4) | komp. OL5 |
| Zlyhané uloženie nič nepovie (nálezy 29, 39) | áno | áno | vlastný kód obalov; témy v denníku | komp. OL7 |
| Galéria pri „Uložiť a použiť" pridelí pozíciu dvakrát (nález 31) | áno | — | vlastný kód knižnice | komp. OL8 |
| Odtieň ikon, posuv panela | svoj | svoj | vlastný kód | komp. OL9 |

V admin-dam ostávajú celé aj zoznam fronty v pätičke a jeho riadky, kompaktné zobrazenie výberu, riadok slotu,
`AssetUpload`, `FileUpload`, súbory externých poskytovateľov, kľúče front a pohľady pätičky (komp. 0.1 bod 5, 2.7).

### 1.8 Obrázkové widgety v admin-cms a admin-ugc

Aplikácie komponenty fronty priamo nemontujú; dostanú sa k nim cez widgety, výber assetu a zoznam assetov. Nič z
toho, čo dnes podávajú, sa nemení (komp. 3).

| Čo | Ako to ostane | Zdroj |
|---|---|---|
| 33 widgetov v admin-cms, ich vlastnosti a sloty; dialógy fronty → zoznam, riadok a sidebar | bez väzby a bez nových vlastností; predvolené hodnoty sú dnešná knižnica | komp. 3 |
| Objekt obrázka pre CMS, dnes skladaný ručne na deviatich miestach | jedna funkcia `createDamImage`; každé miesto dostane presne dnešný objekt (mení sa len poradie kľúčov v JSON) | komp. IM1 až IM9, 2.9 |
| Voľby admin-ugc (`mainFileSingleUseEnabled: false`, `showFileInfoEnabled: false`, `simpleAssetSidebar: true`, adresy `/ugc/v1/*`, vlastné mapovania metadát) | ten istý zdroj hodnôt ako dnes | komp. 3 |
| Autori a kľúčové slová v admin-ugc nemajú byť viditeľné (tvoje rozhodnutie) | admin-ugc ich nemá zapnuté v konfigurácii; nemení sa | komp. 3; denník, tretia sada, bod 2 |
| „Obnoviť" a kôš v riadku | admin-cms a admin-ugc `refreshOffered` nepodajú, riadok počíta dnešným kódom | komp. 3 |
| Ikona „nové" na chipe | bez poskytnutej hodnoty číta sklad knižnice ako dnes | komp. 3 |
| Widget médií pri vybranom assete nepoužije vlastné mapovanie aplikácie (nález 45, v návrhu N1) | vlastný kód knižnice; dnes ho nikto nedosiahne | komp. IM11 |
| Kópia do licencie; limit 50 vo viacnásobnom widgete | len knižnica; kópia dnes ide na zlú adresu (nález 20, časť 4) | jadro A18, C18, C57; komp. SB7 |

### 1.9 Služba uploadu a požiadavky

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| API a typy assetov | `damUpload*`, klient a adresa obrázka z konfigurácie `default` (`/adm/v1/image`, v admin-ugc `/ugc/v1/image`); len obrázok | vlastné obaly; štyri pevné adresy `/adm/v1/image`, `audio`, `video`, `document` | podaná funkcia `requests` (sada služby) | jadro 2.8 `requests`, A4, A5 |
| Typ, ktorý aplikácia nenahráva | odmietne bez hodnoty, bez požiadavky | odmietne s vlastným textom, bez požiadavky | vlastný kód každej strany | jadro A6 |
| Texty chýb kúska | `common.damImage.uploadErrors.*` | `system.uploadErrors.*`, iné znenie | `messages` (sada služby) | jadro 2.8 `messages`, B25 |
| Text zlyhania riadku pre sklad (odmietnutá operácia, validácia, neznáma chyba) | nie je | áno | vlastný kód admin-dam | jadro B26 |
| Časový limit pre výpočet veľkosti kúska | voľba pluginu `coreDam.apiTimeout` (bez nej 30) | `envConfig` aplikácie | hodnota `apiTimeout` | jadro 2.8 `apiTimeout`, B27 |
| Odkiaľ sa vezme knižnica kontrolného súčtu `rusha` | načíta sa lenivo, najviac 15 s | statický import aplikácie | funkcia `loadHash`; priebeh je jeden (Z3) | jadro 2.8 `loadHash`, B2 |
| Prázdny súbor (0 B) | odmietne pred prvou požiadavkou | pošle štart s veľkosťou 0 a hneď dokončenie | hodnota `emptyFile` (`reject` / `send`) | jadro 2.8 `emptyFile`, B5 |
| Odkiaľ sa meria rýchlosť pokusu | odznova len po neúspešnom pokuse | odznova pri každom pokuse | hodnota `speedBaseline`, kým nerozhodneš PV12 | jadro 2.8 `speedBaseline`, B15 |
| Pod akou konfiguráciou DAM upload beží | vždy `default`, aj keď widget beží pod pomenovanou | jedna konfigurácia | `requests` knižnice čítajú `default` (otvorené PV14) | jadro B32 |
| Import od externého poskytovateľa | — | áno, jedna funkcia namiesto štyroch | vlastný kód admin-dam | jadro A17 |
| Kópia do licencie | áno | — | vlastný kód knižnice | jadro A18 |
| Čítanie zoznamu slotov, čítanie originálu duplikátu | — / asset podľa súboru | sloty / súbor podľa typu | čitatelia profilu usadenia | jadro A21, A22 |

### 1.10 Fronta: sklady a jadro

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Ktoré súbory sa pridajú do fronty | len obrázky | každý typ, ktorý ext systém pozná | vlastný kód skladu | jadro C11 |
| Čím sa riadok posiela | vždy upload | riadok externého poskytovateľa importom | funkcia `runnerFor` (sada jadra) | jadro 2.8 `runnerFor`, C21 |
| Text a upozornenie pri zlyhaní uploadu | nič navyše, ostane text služby | text podľa príčiny a jedno upozornenie na dôvod | funkcia `onClientFailure` | jadro 2.8 `onClientFailure`, C27 |
| „Obnoviť" na zlyhanom riadku | len tam, kde pomôže | nie | príznak `refreshable` | jadro 2.8 `refreshable`, C46 |
| Sloty, hromadná úprava, riadky externých poskytovateľov | — | áno | vlastný kód skladu admin-dam; evidenciu dostane sada cez `rowTracked`, `rowRemoved` | jadro 2.8, C14 až C17, C64 |
| Riadky kópie do licencie | áno | — | vlastný kód knižnice | jadro C18 |
| Usadzovanie: roly riadkov a kedy sa riadok usadí | dve roly (kópia, upload); obe čítajú asset, usadia sa čítaním, načítajú metadáta, duplikát sa stane originálom | štyri roly (slot, hromadná úprava, import od externého poskytovateľa, upload): slot číta zoznam slotov, usadí sa notifikáciou a metadáta nenačíta; riadok hromadnej úpravy nečíta nič, neusadí sa nikdy a len načíta metadáta; ostatné čítajú asset a usadia sa notifikáciou; duplikát sa len označí | profil `settlement` (hotový v kroku 2, v kroku 5 sa nemení) | jadro 2.8 `settlement`, 1.4 (`roleOf`, `policyFor`, `readers`), C43 |
| Usadzovanie: ktorá notifikácia patrí ktorému riadku | len podľa assetu | slot podľa súboru; riadok hromadnej úpravy bez súboru len na doplnenie; riadok, ktorý sa ešte načítava, nikdy | profil (`matches`) | jadro C54 |
| Texty usadenia (slovensky; anglické sa tiež líšia) | „trvá dlho": „Spracovanie trvá príliš dlho. Použite tlačidlo obnovenia položky alebo položku odstráňte a skúste to neskôr."; nepodarilo sa načítať: „Údaje sa nepodarilo načítať. Použite tlačidlo obnovenia položky alebo položku odstráňte a skúste to znova."; neznáma chyba: „Systémová chyba. Skúste neskôr alebo kontaktujte administrátora." | „trvá dlho": „Spracovanie trvá príliš dlho. Použite tlačidlo obnoviť alebo položku odstráňte a skúste to neskôr."; **pre slot vlastný text**: „Spracovanie trvá príliš dlho. Zrušte položku a skúste to neskôr."; nepodarilo sa načítať metadáta: „Metadáta sa nepodarilo načítať. Použite tlačidlo obnoviť alebo položku odstráňte a skúste to znova."; neznáma chyba: rovnaká slovenčina | profil (`messages`) | jadro C59; texty z jazykových súborov oboch strán |
| Odber notifikácií | v sklade, lenivo, päť udalostí vrátane kópie | v aplikácii, štyri udalosti | vlastný kód | jadro C42 |
| Zápis uloženého detailu do riadkov | asset znova prečíta | skopíruje bez požiadavky | vlastný kód každého skladu | jadro C51 |
| Kontajner front | `Map` | objekt (testy admin-dam doň sejú) | stav skladu `queues`; jadro k obom pristupuje jedným kódom | jadro 2.8 `queues`, C1, C3 |
| Drobné vnútorné členy (odstránenie podľa assetu, `reset()`, výmena za behu vývoja, obaly so starými menami, obaly „Obnoviť", kľúč riadku hromadnej úpravy) | | | vlastný kód, bez zmeny | jadro C8, C35, C39, C44, C45, C61 |

### 1.11 Nastavenia

| Čo | Knižnica | admin-dam | Ako | Zdroj |
|---|---|---|---|---|
| Právo vytvoriť kľúčové slovo a autora | nové kľúče konfigurácie pluginu, predvolene žiadne (admin-cms a admin-ugc nič nevidia) | podá `dam_keyword_create`, `dam_author_create` | konfigurácia `keywordCreateAcl`, `authorCreateAcl`; konfigurácia pluginu len pribúda | komp. 2.12, AK2 |
| Časový limit uploadu | voľba pluginu | `envConfig` | hodnota sady | jadro 2.8 `apiTimeout` |
| Jednorazová licencia | voľba `mainFileSingleUseEnabled` | vždy | vlastnosť riadku | komp. RD20 |
| Pomenovaná konfigurácia DAM | upload aj nové kľúče sa čítajú z `default` | — | otvorené PV14 | jadro B32; komp. 2.12 |

---

## 2. Čo sa zjednotí

Všetkých 48 platných položiek oboch registrov. „Berie sa" = čí variant ostane. **[na potvrdenie]** = čaká na teba
(časť 3). **[mení zobrazené]** = oprava, po ktorej používateľ uvidí niečo iné než dnes. Skupiny (a) a (b) registre zaraďujú
spolu ako „vnútorné"; tu sú rozdelené podľa toho, či sa mení niečo, čo odíde z prehliadača, alebo časovanie.

### (a) Nič: bez účinku na obrazovku aj na požiadavky (29)

| # | Čo sa zjednotí | Berie sa | Čo si kto všimne |
|---|---|---|---|
| Z1 | Hlavička typu pri posielaní kúska súboru | knižnica | nič; na server ide to isté. **[na potvrdenie PV1]** |
| Z3 | Kedy sa pripraví kontrolný súčet a kedy sa riadok označí „posiela sa" | knižnica (admin-dam dá hotový súčet hneď) | nič |
| Z4 | Texty dvoch chýb pri štarte, ktoré nikto neukazuje | admin-dam | nič |
| Z7 | Kontrola identifikátora súboru pred kúskom | knižnica | nič |
| Z8 | Kontrola, že sa časť súboru prečítala ako bajty | knižnica | nič. **[na potvrdenie PV11]** |
| Z10 | Zastavenie merača rýchlosti po zlyhaní | admin-dam (služba sama), doplnené | nič |
| Z11 | Kto zapíše text pri odpovedi 400 po štvrtom pokuse | služba, text svojej strany | nič |
| Z12 | Funkcia, ktorá skladá text z chybných polí | jedna, s kontrolou admin-dam | nič |
| Z13 | Zápis do fronty, ktorá neexistuje | knižnica (nestane sa nič) | nič |
| Z14 | Prepočet počtov fronty po úspešnom uploade | vždy | nič; nanajvýš sa obnoví zastaraný počet |
| Z16 | Upload zlyhá, keď server už ohlásil súbor ako hotový | admin-dam | nič |
| Z18 | Či „Zrušiť" čaká na odstránenie riadku | nečaká | nič |
| Z19 | Vyčistenie fronty, ktorá neexistuje | admin-dam | nič |
| Z20 | Import od externého poskytovateľa ide tým istým štartom ako upload | spoločný štart | nič |
| Z21 | Podľa čoho si jadro pamätá bežiace uploady | admin-dam | nič |
| Z22 | Počítadlo kľúčov riadkov | jedno v jadre | nič |
| ZK1 | Prázdny prvok v riadku duplikátu | zanikne | nič |
| ZK6 | Upozornenie po „Obnoviť" pri riadku, ktorý medzitým odišiel z fronty | kontroly oboch strán | nič; v bežnom toku sa to nestane |
| ZK7 | Panely typov assetov v hromadných operáciách | štyri, každý len pre typ vo fronte | nič; fronta knižnice má len obrázky |
| ZK8 | „Vyčistiť" v hromadných operáciách | admin-dam (vymaže výber vždy) | nič |
| ZK9 | Nepoužitá vlastnosť tlačidla zastavenia | zanikne | nič |
| ZK10 | Text chyby formulára bez nastaveného ext systému | knižnica | len vývojár v konzole |
| ZK12 | Ako sa vypnú polia kľúčových slov a autorov vo vzhľade „pole" | „vypnuté" len keď sú vypnuté, inak rozhodne formulár | nič |
| ZK16 | Filter vnútorného hľadania autora | knižnica | nič |
| ZK17 | Presmerovanie po vytvorení autora (mŕtvy kód) | knižnica | nič |
| ZK19 | Rozsah validácie dialógu „nový autor" | knižnica | nič |
| ZK22 | Kto zapne sledovanie ťahania súborov nad oknom | knižnica (aplikácia výslovne) | nič |
| ZK25 | Prázdne obsluhy načítania obrázka v detaile | zaniknú | nič |
| ZK27 | Koľko vlastných polí je pripnutých nad „Zobraziť viac", keď ext systém číslo nedá | knižnica (2) | nič v bežnom toku: backend číslo posiela vždy. Ak to budeš mať za produkt, vráti sa ako kľúč konfigurácie |

### (b) Mení požiadavku alebo časovanie (6)

Používateľ na obrazovke nič nové neuvidí (pri Z15 si pozorný používateľ všimne skorší štart ďalšieho súboru), ale
mení sa, čo alebo kedy odíde na server alebo do Sentry.

| # | Čo sa zjednotí | Berie sa | Čo sa zmení |
|---|---|---|---|
| Z2 | Kontrola kúska pred odoslaním a hlásenie do Sentry | knižnica | používateľ nič; **admin-dam začne posielať do Sentry** hlásenia o odmietnutom kúsku a o odpovedi 400 a vypíše ich do konzoly. Kúsok, ktorý neprejde kontrolou, neodíde; v bežnom toku je vždy v poriadku. **[na potvrdenie PV2]** |
| Z5 | Ako upload zistí, že ho používateľ zastavil | kontroly oboch strán | v knižnici riadok, ktorý server už ohlásil a ktorý čaká na ďalší pokus, **ten pokus už nepošle**, keď sa zastaví celá fronta |
| Z6 | Čo sa stane po neúspešnom poslaní kúska | zrušený pokus končí hneď (knižnica); po poslednom pokuse koniec hneď, veľkosť kúska sa prepočíta len pred ďalším pokusom (admin-dam) | po zlyhanom alebo zastavenom uploade **môže mať prvý kúsok ďalšieho súboru inú veľkosť** (len keď konfigurácia dovolí rôzne veľkosti) |
| Z15 | Zastavený riadok a voľné miesto pre ďalší súbor | admin-dam | v admin-cms a admin-ugc sa po odstránení súboru, ktorý čakal na ďalší pokus, **ďalší súbor spustí hneď, nie o 1 až 9 s neskôr**; pozorný používateľ si to všimne. **[na potvrdenie PV6]** |
| Z27 | Typ súboru na časti kúska | knižnica | **mení sa požiadavka, server ju nečíta**: admin-dam začne na každej časti kúska posielať typ súboru (napríklad „image/jpeg") namiesto „application/octet-stream"; overené na lokálnej kópii core-dam, nie na nasadenej verzii. **[na potvrdenie PV3]** |
| ZK20 | Cache mien autorov a kľúčových slov | jedna cache knižnice | admin-dam **pošle menej požiadaviek na mená**: mená, ktoré načítal výber assetu, použije aj inde |

### (c) Kozmetika (5)

| # | Čo sa zjednotí | Berie sa | Čo si kto všimne |
|---|---|---|---|
| ZK5 | Pravý okraj oblasti s kartami vo fronte | knižnica | v admin-dam je zoznam na širokej obrazovke o 16 px užší |
| ZK11 | Zástupný obrázok, kým sa súbor nahráva | knižnica (SVG 1 KB namiesto JPEG 58 KB) | nič viditeľné; stránka admin-dam stiahne o 57 KB menej |
| ZK14 | Vysvetlenie pri `#id` autora či kľúčového slova, ktoré server nevrátil | knižnica | v admin-dam sa vysvetlenie ukáže v bubline aplikácie namiesto natívneho titulku prehliadača; text ten istý |
| ZK15 | Obsah prázdneho chipu | knižnica | nanajvýš medzera okolo pomlčky |
| ZK23 | Pravý okraj tlačidiel v paneli dialógu jedného súboru | detail (8 px) | tlačidlá o 4 px bližšie k pravému okraju |

Vzhľad ZK11, ZK5 a ZK23 overí tvoj pohľad v prehliadači po U3, U5c a U6 (K-04); ak ukáže viac než opísaný rozdiel,
zblíženie sa vráti (komp. 4.4).

### (d) Opravené chyby (7)

| # | Čo sa zjednotí | Berie sa | Čo si kto všimne | Chyba |
|---|---|---|---|---|
| Z17 | Čo urobí odstránenie, „Zrušiť", zastavenie a vyčistenie fronty s uploadom, ktorý ešte beží | admin-dam (jedno pravidlo) | v admin-cms a admin-ugc sa po odstránení alebo zastavení riadku, ktorý server medzitým ohlásil, prestanú posielať zvyšné kúsky jeho súboru (dnes sa dosielajú nevidené); asset, ktorý štart uploadu vytvoril, ostane na serveri ako dnes, odstránenie ani zastavenie ho nemaže; v admin-dam nič. **[na potvrdenie PV7]** | knižnice |
| Z23 | Prvé meranie rýchlosti uploadu | oprava (krok F1, po K6) | **odhad rýchlosti a zvyšného času je na začiatku trochu presnejší, vo všetkých troch aplikáciách**; ďalšie kúsky môžu mať mierne inú veľkosť. Jadro ho vedie ako viditeľné, rozhodneš ty. **[na potvrdenie PV4] [mení zobrazené]** | oboch strán |
| Z24 | Hromadné vyplnenie dá všetkým riadkom ten istý zoznam | každý riadok vlastnú kópiu (krok F2) | dnes nič; zabráni, aby zmena na jednom riadku zmenila aj ostatné. **[na potvrdenie PV8]** | oboch strán |
| Z26 | Súbor, ktorý server ohlási ako zlyhaný ešte počas posielania | jadro jeho upload zastaví (krok F4) | zbytočné kúsky neodídu a súbory idú najviac po dvoch; **vo všetkých troch aplikáciách ostane v riadku čip s dôvodom od servera** (dnes ho neskoršie zlyhanie môže prepísať textom; v knižnici ho tak ukáže aj dialóg jedného súboru), **v admin-dam nepríde ani upozornenie navyše**; či to dnešné prepísanie nastane, závisí od odpovede core-dam (neoverené); zvyšný čas pri červenej ikone môže ostať alebo zmiznúť inak než dnes (kozmetika). **[na potvrdenie PV13] [mení zobrazené]** | oboch strán |
| ZK13 | Ako chip ukáže meno autora alebo kľúčového slova (aj príznak „schválený") | knižnica | **v admin-dam chip ukáže nové meno**, keď sa zmení v cache alebo sa chipu zmení identifikátor. Opačne: keď cache meno vyhodí (nad 1 000 mien), chip sa začne točiť, kým id niekto znova nepridá; v bežnej práci sa toľko mien nenazbiera. **[mení zobrazené]** | admin-dam |
| ZK18 | Prístupné meno ikonového tlačidla „nový autor" | knižnica | čítačka obrazovky v admin-dam tlačidlo pomenuje. **[mení, čo prečíta čítačka]** | admin-dam |
| ZK21 | Zoznam povolených typov súborov s medzerami alebo veľkými písmenami | knižnica | nič pri dnešnej konfigurácii | admin-dam |

### (e) Mení zobrazený text (1)

| # | Čo sa zjednotí | Berie sa | Čo si kto všimne |
|---|---|---|---|
| Z9 | Posledné hlásenie priebehu po odoslaní posledného kúska | knižnica: hotový súbor má ukázať plný kruh a žiadny zvyšný čas | v riadku zoznamu admin-dam sa po odoslaní posledného kúska ukáže plný kruh bez zvyšného času, ak upload stihol zmerať rýchlosť. Dnes tam môže ostať posledné percento so zvyšným časom (aj pri zelenej fajke hotového riadku) alebo točiace sa koliesko. Bez zmeranej rýchlosti sa nemení nič. Návrh to nechá na teba. **[na potvrdenie PV5]** |

### Vyradené, nezbližujú sa

- **Z25** (riadok hromadnej úpravy po zlyhanom a potom spracovanom súbore): zmena stavu by vytvorila nové správanie,
  téma je otvorená ako PV9.
- **ZK2, ZK3**: kedy riadok ponúkne „Obnoviť" a kôš ostáva každej strane cez `refreshOffered` (RD10, RD12).
- **ZK4**: tvar udalosti „Obnoviť" ostáva každej strane cez obal (RD21).
- **ZK24**: obal okolo obrázka v detaile by mohol zmeniť zmenšovanie širokého obrázka; ostáva cez adaptér (JS9).
- **ZK26** (vypustené v komponentoch 4.3): zblíženie zalamovania v paneli „Info o súbore" by v pravom sidebare výberu
  assetu (admin-cms a admin-dam, mimo uploadu) zalomilo popisy ako „Vytvorené" vo vnútri slova; dnešný vzhľad drží
  jeden atribút, ostáva cez adaptér (JS29).

---

## 3. Na tvoje potvrdenie

### 3.1 Desať zblížení z jadra

Texty sú doslova z návrhu jadra (5.2, verzia 10.3), ktorý ich písal pre teba. Prvých sedem berie variant jednej
strany a stane sa v krokoch zjednotenia; podľa plánu ich rozhodneš všetky na sedení V0 pred K2. Posledné tri sú
opravy chýb, ktoré idú až po K6 a až po potvrdení. Ak niektoré
neprijmeš, vráti sa ako člen sady s hodnotou každej strany a menované testy sa vrátia; každá položka je na jednom
mieste spoločného kódu (jadro 4.1).

1. **PV1 → Z1.** „Hlavička typu pri posielaní kúska ako v knižnici (`undefined`, typ aj s hranicou dopíše
   prehliadač). Nikto si nič nevšimne: na server ide to isté."
   *Odporúčanie:* potvrdiť.
2. **PV2 → Z2.** „Kontrola kúska pred odoslaním a hlásenie do Sentry ako v knižnici. Používateľ nič; admin-dam
   začne posielať do Sentry hlásenia o odmietnutom kúsku a o odpovedi 400."
   *Odporúčanie:* potvrdiť; či hlásenia naozaj dorazia, závisí od toho, či má tajomstvo `admin-dam-sentry-dsn` v
   Azure hodnotu, a to vieš overiť len ty.
3. **PV3 → Z27.** „Typ súboru na časti kúska ako v knižnici (napríklad „image/jpeg"); začne ho posielať aj
   admin-dam. Server typ časti nečíta a typ kúska si určí z obsahu (overené na lokálnej kópii core-dam). Nikto si
   nič nevšimne."
   *Odporúčanie:* potvrdiť, s vedomím, že sa mení požiadavka admin-dam (server ju nečíta); overené na
   `core-dam-bundle` 1.52.0, nie na nasadenej verzii backendu.
4. **PV5 → Z9.** „Posledné hlásenie priebehu ako v knižnici. V riadku zoznamu admin-dam sa po odoslaní
   posledného kúska ukáže plný kruh bez zvyšného času, ak upload stihol zmerať rýchlosť. Dnes tam podľa toho, ako
   rýchlo server dokončí, môže ostať posledné namerané percento so zvyšným časom (aj pri zelenej fajke hotového
   riadku) alebo točiace sa koliesko. Bez zmeranej rýchlosti sa nemení nič. Mení to zobrazený text, preto rozhodne
   vlastník."
   *Odporúčanie:* návrh berie variant knižnice (hotový súbor má ukázať plný kruh bez zvyšného času); ak je to pre
   teba produkt, ostane ako člen sady.
5. **PV6 → Z15.** „Zastavený riadok ako v admin-dam (ostane „zastavený", miesto sa uvoľní hneď). V knižnici sa po
   odstránení súboru, ktorý čakal na ďalší pokus, ďalší súbor spustí hneď, nie o 1 až 9 s neskôr."
   *Odporúčanie:* potvrdiť.
6. **PV7 → Z17.** „Zastavenie živých uploadov ako v admin-dam. V knižnici sa po odstránení alebo zastavení riadku,
   ktorý server medzitým ohlásil, prestanú posielať zvyšné kúsky jeho súboru (dnes sa dosielajú nevidené). Asset,
   ktorý štart uploadu vytvoril, ostane na serveri ako dnes: odstránenie ani zastavenie ho nemaže."
   *Odporúčanie:* potvrdiť; je to oprava chyby knižnice.
7. **PV11 → Z8.** „Kontrola prečítaných bajtov ako v knižnici. Nikto si nič nevšimne."
   *Odporúčanie:* potvrdiť.
8. **PV4 → Z23 (F1).** „Oprava prvého merania rýchlosti na oboch stranách. Odhad rýchlosti a zvyšného času je na
   začiatku trochu presnejší, vo všetkých troch aplikáciách."
   *Odporúčanie:* potvrdiť; jadro ho vedie ako viditeľné (odhad), takže je to tvoje rozhodnutie; rozhodni ho spolu s
   PV12, lebo D4 má ísť len s touto opravou.
9. **PV8 → Z24 (F2).** „Každý riadok dostane pri hromadnom vyplnení vlastnú kópiu zoznamu. Dnes nič."
   *Odporúčanie:* potvrdiť.
10. **PV13 → Z26 (F4).** „Súbor, ktorý server ohlásil ako zlyhaný, sa prestane posielať a naraz idú najviac dva
    súbory. V knižnici aj v admin-dam ostane v riadku čip s dôvodom od servera a v admin-dam nepríde ani
    upozornenie navyše (dnes ich neskoršie zlyhanie uploadu môže prepísať textom, v admin-dam aj s upozornením,
    podľa toho, ako server odpovie). Zvyšný čas pri červenej ikone sa môže zobraziť inak než dnes: zamrzne už pri
    hlásení servera, takže niekedy ostane číslo tam, kde dnes zmizne, inokedy naopak (kozmetika)."
    *Odporúčanie:* potvrdiť; mení, čo riadok ukáže vo všetkých troch aplikáciách (čip ostane; v knižnici aj v
    dialógu jedného súboru), v admin-dam navyše nepríde upozornenie. Či dnešné prepísanie vôbec nastane, závisí od
    toho, ako core-dam odpovie na kúsky a dokončenie zlyhaného súboru (neoverené).

### 3.2 Z návrhu komponentov

Register komponentov nemá žiadnu položku označenú „na potvrdenie". Celý je na tvoje posúdenie „produkt alebo
kozmetika"; viditeľný účinok majú ZK5, ZK13, ZK14, ZK15, ZK18 a ZK23 (rovnaký zoznam má teraz aj úvod návrhu
komponentov); ZK11 nevidno (admin-dam len stiahne o 57 KB menej, overí pohľad) a ZK20 mení počet požiadaviek na
mená (časť 2). Pre ZK27
má návrh pripravený návrat, ak ho budeš mať za produkt: kľúč konfigurácie čítaný z `default`. Ktorékoľvek iné
zblíženie, ktoré označíš za produkt, sa vráti ako vlastnosť alebo slot (komp. 6). Štyri témy komponentov, ktoré čakajú
na tvoje rozhodnutie (PV15, nález 25, nález 36, PK3), sú v časti 4: návrh ich nemení a dnešný stav drží nedotknutý kód.

---

## 4. Otvorené, rozhodneš neskôr

Kým nerozhodneš, každá strana ostáva ako dnes. Žiadna z tém v tejto tabuľke neblokuje kroky zjednotenia; PK3 a nález
20 sa podľa plánu rozhodnú na sedení V0 a pri „áno" dostanú vlastný malý krok.

| Téma | Čo to je | Čo znamenajú možnosti | Odporúčanie návrhu | Dovtedy |
|---|---|---|---|---|
| **PV9** (jadro C55; nález 10) | Riadok hromadnej úpravy v admin-dam, ktorého súbor zlyhal a potom ho server spracoval, ostane „zlyhal" a so zamknutým formulárom, ale nie je červený. Do hromadného uloženia sa nedostane. | Jednoduchá zmena stavu na „hotový" je vyradená (Z25): po 20 s by sa ukázalo „Obnoviť", ktoré nič neurobí, a neskoršia notifikácia metadát by riadok dostala do hromadného uloženia. Riadna oprava: napríklad „Obnoviť", ktoré pri takom riadku číta skôr (`early: true`) a metadáta načíta, alebo nechať „zlyhal" a upraviť len to, čo riadok ukazuje. | Nechať, ako je; oprava potrebuje vlastný návrh. Nález 10 je podľa tretej sady rozhodnutí pridelený kroku 5; návrh ho nerieši. | ostáva |
| **PV10** (jadro C56; nález 11) | Riadok duplikátu v knižnici si nepamätá vlastný asset: `assetId` aj `duplicateAssetId` sú originál. admin-dam si pamätá oboje. | Nové nepovinné pole riadku `uploadedAssetId` (asset, ktorý vytvoril upload tohto riadku), ktoré zatiaľ nikto nečíta; alebo nič. | Jadro: pridať pole (najskôr po K5), lebo ho podľa neho bude potrebovať časť 4. Komponenty píšu, že kôš admin-dam je vo vlastnom slote a od poľa nezávisí. Návrhy sa tu rozchádzajú (časť 7); zladiť to musíš ty alebo plán. | pole nepribudne |
| **PV12** (jadro B15; D4; riziko R1) | D4 rozhodlo, že knižnica prevezme meranie rýchlosti z admin-dam (odznova pri každom pokuse). Následok, ktorý vtedy nebol známy: upload z viacerých kúskov, z ktorých každý dá jedinú udalosť priebehu, by v admin-cms a admin-ugc ostal na „0 %", a čísla rýchlosti by vyšli vyššie. | Potvrdiť D4 (knižnica meria ako admin-dam), alebo ostať pri sade (každá strana meria ako dnes). | Potvrdiť D4 **len spolu s opravou F1 (PV4)** a po jednom ručnom uploade súboru nad 1 MB v CMS na rýchlej sieti; inak ostať pri sade. Nasadené veľkosti kúskov (`APP_SIZE_*_CHUNK_SIZE`) vieš overiť len ty. | hodnota `speedBaseline`; krok K2-D4 sa nespustí |
| **PV14** (jadro B32; nález 23) | Upload vo widgete pod pomenovanou konfiguráciou DAM beží pod `default` (služba, sklad aj „Obnoviť"). | Podporiť pomenovanú konfiguráciu v celom uploade (samostatná úloha, týka sa aj usadzovania a dialógov), alebo ju pri uploade výslovne nepodporovať. | V kroku 5 nepodporovať (dnes ju pri uploade žiadna aplikácia nepoužíva) a zapísať to do dokumentácie widgetov; rozhranie ju nezatvára. | knižnica číta `default` |
| **PV15** (jadro C69; komp. HO10; nálezy 34, 41) | „Nahradiť vo všetkých" s prázdnym výberom vymaže kľúčové slová a autorov každého riadku; jednotlivé „nahradiť" nedotknutého vlastného poľa zapíše do každého riadku typu prázdnu hodnotu. Na oboch stranách rovnako. | Je to zámer (nič), alebo nie je: „nahradiť" s prázdnym výberom nič nepošle, jedna podmienka tlačidla pre obe strany naraz. | Nechať, kým produkt nepovie, či je to zámer. | ostáva |
| **PV16** (jadro 5.2, nová vo verzii 10.2; druhá sada rozhodnutí, bod 6: „nechať do kroku 5") | Karta distribúcií v detaile assetu v admin-dam číta zoznam znova, kým niektorá distribúcia beží, a **každé zlyhané čítanie** odovzdá zapisovaču chýb, teda do konzoly prehliadača (dopytovanie uploadu odovzdá len prvé zlyhanie v sérii). Na obrazovke chybu neukazuje. Po zlyhaní príde ďalšie čítanie najskôr o 15, 30, 60, 120 a potom 300 s (platí väčší z tohto a bežného odstupu); pri skrytej karte sa nečíta. Sentry zachytí každú odpoveď 5xx samo, nezávisle od toho. Uploadu sa netýka, knižnica distribúcie nedopytuje. | (a) Zjednotiť s pravidlom uploadu: pomocník knižnice na čítanie zoznamov dostane nepovinnú voľbu „hlásiť" a dopytovanie distribúcií ju použije; v konzole jeden riadok na sériu zlyhaní namiesto každého; udalosti Sentry pri 5xx ostanú. Knižnica asi 8 riadkov a test, admin-dam asi 6 riadkov v troch súboroch a prípad testu; verejné rozhranie len pribudne. (b) Nechať. Používateľ si v oboch prípadoch nevšimne nič. | (a) ako samostatný malý krok, nezávislý od uploadu, až po rozhodnutí; zisk je malý (konzola), takže aj (b) je obhájiteľné. | ostáva; nie je v žiadnom kroku K |
| **Nález 25** (komp. JS21) | Dialóg jedného súboru v knižnici neponúka „Obnoviť" na zlyhanej položke tam, kde ho riadok fronty ponúka (klient vzdal po odoslaní dokončenia; originál duplikátu sa nepodarilo prečítať). | Dať dialógu pravidlo riadku, alebo nechať. | Dať dialógu pravidlo riadku knižnice pre zlyhanú položku (podľa denníka). | ostáva |
| **Nález 36** (komp. IM10) | Do API obrázkov idú z mapovania uploadu aj `authorIds` a `assetId`; dialóg jedného súboru pošle `mainFileSingleUse: false` za prázdny riadok, dialóg fronty `null`. | Upratať, alebo nechať. Mení to, čo sa pošle na backend. | Len s tvojím rozhodnutím (denník: pri upratovaní formulára, krok 5.5). `createDamImage` to nemení. | ostáva |
| **PK3 = nález 46** (komp. ZN3; overené v prehliadači) | **V dialógu fronty v admin-cms a admin-ugc nefungujú pri písaní metadát šípky hore a dole, PageUp, PageDown, Home ani End** (doľava a doprava fungujú). Kurzor sa nepohne, posunie sa zoznam; pri šípke hore alebo dole v dlhšom texte ostane kurzor na starom mieste a písmeno pribudne tam. Posun zoznamu klávesmi počúva na celom dokumente a kláves „zje". admin-dam to nemá. | Opraviť (kláves s cieľom v editovateľnom prvku nechať prehliadaču), alebo nechať. | **Zaradiť opravu do plánu** ako malý samostatný krok s testom, nie potichu v rámci zjednotenia, lebo mení, čo používateľ vie robiť. | ostáva |
| **Nález 20: čaká na tvoje áno** (denník; jadro A18 sa ho netýka) | **Kópia do licencie v knižnici ide na adresu, ktorú backend nemá:** knižnica volá `PATCH /adm/v1/asset/copy-to-licence`, backend má túto cestu len pod obrázkom, `PATCH /adm/v1/image/copy-to-licence`. Vzniklo, keď sa adresa stala parametrom a tri widgety obrázka začali odovzdávať adresu assetu; zlú adresu majú vydané verzie 1.48.0 a 1.49.0 (tú má admin-cms). Spustí sa vo výbere assetu, len pri obrázkoch: pri prezeraní inej licencie než tej, do ktorej sa nahráva, so zapnutým prepínačom „kopírovať do licencie". **admin-ugc:** jeho API túto cestu nemá vôbec (denník) a admin-ugc nastavuje adresu obrázkov `/ugc/v1/image` (admin-ugc `src/main.ts`), takže oprava pomôže len admin-cms; či sa admin-ugc k prepínaču kópie vôbec dostane, sa overí v kroku nálezu 20. | **Dnes:** kópia nikdy neprebehne; doteraz ticho, od bodu 4 tretej sady každý pokus ukáže „neznámu chybu". Bez prepínača sa obrázok z inej licencie použije priamo a to funguje. Proti bežiacemu serveru to overené nie je; overíš to za minútu v sieťovom paneli admin-cms. | **Opraviť hneď:** tri volania vo widgetoch odovzdajú `endPointImage`, pribudne test s úspešnou kópiou proti správnej adrese (dva nové testy dnes pripínajú zlú adresu). | kópia nefunguje |
| **Nález 32: pozri skôr** (denník; komp. 5.2) | Uloženie galérie v admin-cms zapíše do DAM `authors: []` pre každý obrázok, ktorého asset pri načítaní nemal autora, aj keď sa ho nikto nedotkol; autor, ktorého medzitým niekto pridal v DAM, by sa zmazal. Odvodené z testu nad falošným serverom. | Rozhodnúť samostatne, mimo kroku 5. | Denník: **pozrieť skôr, môže to potichu mazať dáta.** | ostáva |
| **Nález 39: pozri skôr** (denník; komp. OL7) | Zlyhané uloženie fronty v admin-dam nič nepovie: v oboch prekrytiach (upload aj hromadná úprava) odmietnuté hromadné uloženie len zastaví točenie, bez upozornenia. Používateľ nerozlíši zlyhané uloženie od pomalého. To isté robia dialógy knižnice (nález 29). | Rozhodnúť samostatne; oprava je v každom obale zvlášť. | Denník: **pozrieť skôr**, ukázať chybu; malé. | ostáva |

### 4.1 Nálezy denníka, ktorých sa krok 5 dotýka

| Nález | Čo | Kde je v návrhoch | Stav |
|---|---|---|---|
| 10, 11 | riadok hromadnej úpravy po zlyhaní; duplikát bez vlastného assetu | PV9, PV10 | otvorené (pridelené kroku 5, návrhy ich nechávajú na teba) |
| 12 | zdieľané pole pri hromadných operáciách | Z24 (F2) | na potvrdenie |
| 15 | prvá vzorka rýchlosti; zastavený riadok knižnice končí „zlyhaný" | Z23 (F1), Z15 | na potvrdenie |
| 19 | zastavený import, ktorého požiadavka potom zlyhá, ukáže upozornenie (admin-dam) | jadro C65: vlastný kód sa nemení | ostáva otvorený |
| 20 | kópia do licencie ide na adresu, ktorú backend nemá (knižnica) | jadro A18: návrhu sa netýka | **čaká na tvoje áno** (riadok vyššie v časti 4); denník „opraviť hneď" |
| 21 | súbor zlyhaný od servera sa posiela ďalej, idú tri súbory naraz | Z26 (F4) | na potvrdenie |
| 23 | pomenovaná konfigurácia | PV14 | otvorené |
| 25, 36, 46 | „Obnoviť" v dialógu; čo sa pošle do API obrázkov; klávesy | JS21, IM10, PK3 | otvorené |
| 34, 41 | „nahradiť vo všetkých" bez výberu | PV15 | otvorené |
| druhá sada, bod 6 (nie je očíslovaný nález) | dopytovanie distribúcií v admin-dam hlási každé zlyhané čítanie; rozhodnutie „nechať do kroku 5" | PV16 (jadro 5.2); komponenty ho nespomínajú | otvorené; nie je v žiadnom kroku K |
| 29, 39 | zlyhané uloženie nič nepovie | obaly každej strany (OL7) | odložené; 39 je „pozri skôr" (riadok vyššie v časti 4) |
| 30 | prázdny zoznam otvorí dialóg s nekonečným načítavaním | widget; `loading` adaptéra | odložené |
| 31 | galéria pri „Uložiť a použiť" počíta pozíciu dvakrát, dialóg aj widget: dva nové obrázky po pozíciách 1 a 2 dostanú 5 a 6 (poradie ostáva správne, čísla majú medzery) | dialóg fronty knižnice a viacnásobný widget (OL8); `createDamImage` pozície nemení | **otvorená voľba, ktorú denník pridelil kroku 5** (formulár): rozhodnúť, kto pozíciu prideľuje; po rozhodnutí jeden z dvoch prestane prideľovať. Návrhy voľbu neurobili |
| 32 | uloženie galérie zapíše `authors: []` | viacnásobný widget | „pozri skôr" (riadok vyššie v časti 4) |
| 33, 35 | výber assetu | mimo komponentov návrhu | odložené |
| 38 | kôš admin-dam podľa assetu | obal riadku admin-dam (RD24) | odložené; oprava je jeden riadok obalu |
| 40 | konflikty bez mien pri hromadnej úprave | sklad admin-dam (AK20) | odložené |
| 42, 43, 44 | neznámy dôvod nič neukáže; dve „Zatvoriť"; chip konfliktu zmizne | spoločný chip a prekrytie, tlačidlo zastavenia, výber autora | odložené; po rozhodnutí jedna zmena pre obe strany naraz |
| 14 | 75 ikonových tlačidiel admin-dam bez mena | mimo uploadu | odložené; obaly nové bezmenné tlačidlá nepridajú |
| 45 | widget médií ignoruje vlastné mapovanie (N1) | IM11 | odložené; jeden riadok, keď sa widget bude meniť |
| 8, 9, 13, 16, 17, 18, 22, 24, 26, 27, 28, 37 | ostatné | návrhy kroku 5 ich nespomínajú | ostávajú v denníku (pri 22 denník spomína „prípadne samostatné texty v kroku 5") |

### 4.2 Drobné otázky, ktoré nič neblokujú

| # | Otázka | Odporúčanie návrhu |
|---|---|---|
| jadro Q4 | Prázdny súbor ostáva rozdielom sád (mení, čo sa pošle). Chceš ho neskôr zblížiť? | nechať |
| jadro Q5 | Zmazať v admin-dam funkciu `uploadFailed`, ktorú nikto nevolá? | áno, v K3 |
| jadro Q6 | Zrušiť v sklade knižnice tri obaly, ktoré produkcia nevolá? | nechať; prípadne v upratovaní K7 |
| jadro Q7 | Zjednotiť hromadné čítanie assetov? | nepovinné, v K7, tvar admin-dam; mení tvar hlásenia chyby |
| jadro Q8 | Zastarané polia riadku `notificationFallbackTimer`, `notificationFallbackTry`? | nechať; verejný typ sa len rozširuje |
| komp. Q1 | Vypustiť staré testy admin-dam, ktoré pokrýva vlna 4? | vypustenie je mazanie súboru (U9, ty); dovtedy prepísať, ak to stojí menej než pol hodiny |
| komp. Q2 | Spojiť polia detailu a dialógu jedného súboru do jedného komponentu? | nie v kroku 5; panel „Info o súbore" áno |
| komp. Q3 | Vyviezť `createDamImage`? | nie teraz |
| komp. Q4 | Nevyužité kľúče `coreDam.*` a `system.upload.*` v admin-dam? | v U9, voliteľné |

**Čo vieš overiť len ty:** či má `admin-dam-sentry-dsn` v Azure hodnotu (Z2), nasadené `APP_SIZE_*_CHUNK_SIZE`
(ručná skúška pred D4) a verziu backendu v produkcii (Z27). **Čo urobíš na konci ty:** zmazanie súborov admin-dam bez
importéra jedným príkazom a beh e2e admin-dam (komp. U9).

---

## 5. Už rozhodnuté zmeny, ktoré nie sú zjednotením

### 5.1 R10: anglické texty spoločných komponentov podľa knižnice

Používateľ admin-dam s anglickým rozhraním uvidí inak 12 reťazcov; slovenské sa nemenia. `FileUpload` a prekrytia
admin-dam si nechávajú svoje texty. V režime prekladových kľúčov ukáže admin-dam kľúče `common.damImage.*`.

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

### 5.2 Názov poľa v prístupných menách (prvá sada, bod 7; krok U8)

Tlačidlá „vyplniť prázdne" a „nahradiť všade" pri každom poli hromadných operácií dostanú v prístupnom mene názov
poľa, na oboch stranách naraz; čítačka obrazovky ich už neprečíta pri každom poli rovnako. Nové kľúče s `{field}` v
slovenčine, angličtine a češtine. e2e admin-dam hľadá podľa mena len tri tlačidlá dole, tých sa to netýka.

### 5.3 Ďalšie

- **D4** (meranie rýchlosti ako v admin-dam): rozhodnuté, ale krok K2-D4 sa bez tvojho potvrdenia nespustí (PV12,
  riziko R1). Dovtedy meria každá strana ako dnes.
- **R16**: vymyslený asset s asi 25 výplňovými poľami v dialógu jedného súboru zanikne (U6); správanie sa nemení.
  Typ `AssetDetailItemDto` ostáva (admin-cms ho používa).
- **O15**: nepoužitý parameter `_endPointAsset` pri dokončení uploadu v knižnici zanikne (K1b); vnútorné.
- Ostatné „rozhodnuté" riadky (jadro B6, B27, C28, C46, C52, C67; komp. RD13, OL6) sú rozhodnutia z krokov 1 až 3,
  ktoré krok 5 len zachová.

---

## 6. Kde nájdeš podrobnosti

Návrhy sú v tomto priečinku (`podklady/upload/krok5/`).

- `navrh-jadro.md` 0.1: prehľad jadra, veľkosť, poradie krokov.
- `navrh-jadro.md` 0.2: šesť zásad (hranica produktu, mechanizmus rozdielov).
- `navrh-jadro.md` 1.1 až 1.4: tabuľky rozdielov požiadaviek (A), služby (B), skladov (C) a profilu usadenia.
- `navrh-jadro.md` 1.5: čo sa po zjednotení píše do riadku a kedy.
- `navrh-jadro.md` 2.8: sady a ich členy s dôvodom pri každom.
- `navrh-jadro.md` 4.1: kroky K0 až K7, opravy F1, F2, F4 a kroky otvorených tém.
- `navrh-jadro.md` 5.2: na potvrdenie a otvorené témy (aj PV16); 5.3 ostatné otázky; 5.4 riziká (R1 = D4).
- `navrh-jadro.md` 6: register Z1 až Z27 s dôkazmi v kóde a testami.
- `navrh-komponenty.md` 0.1, 0.2: prehľad komponentov a počty.
- `navrh-komponenty.md` 1.1 až 1.11: rozdiely riadku, zoznamu, hromadných operácií, tlačidla zastavenia,
  formulára, obrázka, autorov a kľúčových slov, výberu súborov, obalov, detailu a dialógu, objektu obrázka.
- `navrh-komponenty.md` 2.2 až 2.4: vlastnosti, sloty a väzby riadku, zoznamu a sidebaru, s obalmi admin-dam.
- `navrh-komponenty.md` 2.5 až 2.7: listové bloky, čo admin-dam mení mimo uploadu, čo ponechá celé.
- `navrh-komponenty.md` 2.8, 2.9: rámec „obrázok a sidebar", dva adaptéry, `createDamImage`.
- `navrh-komponenty.md` 2.10 až 2.12: súbory admin-dam dnes a potom, exporty, konfigurácia pluginu.
- `navrh-komponenty.md` 3: prečo sa admin-cms a admin-ugc nič nemení.
- `navrh-komponenty.md` 4: kroky U0 až U9 a testy, ktoré ich strážia.
- `navrh-komponenty.md` 5.2: témy pre vlastníka a nálezy na vedomie; 5.4 riziká.
- `navrh-komponenty.md` 6.1 až 6.4: register ZK, rozhodnuté zmeny (R10), čo ostáva na každej strane, vnútorné
  prírastky.
- `overenia.md`: overenia predpokladov (J-xx pre jadro, K-xx pre komponenty), napríklad J-04 typ časti kúska, J-14
  PV15, K-13 PK3.
- `../../../upload-postup.md`: tvoje usmernenie k hranici („Usmernenie vlastníka k pravidlu…"), sady rozhodnutí,
  tabuľka nálezov 8 až 46.
- `plan-implementacie.md` 7: čo rozhodneš kedy (sedenie V0, pohľady K-04, opravy po K6) a čo ktoré rozhodnutie blokuje.

---

## 7. Nezrovnalosti

1. **PV10 a kôš spoločného riadku: dva uzavreté návrhy hovoria o závislosti opak.** Jadro (5.2, PV10): časť 4 bude
   pole `uploadedAssetId` potrebovať, lebo tlačidlo „zmazať asset" spoločného riadku by v knižnici bez neho zmazalo
   originál, nie asset, ktorý upload vytvoril. Komponenty (5.2, „na vedomie" pri PV10): kôš admin-dam je vo vlastnom
   slote `remove` a „nezávisí od toho"; predvolený kôš knižnice len odstraňuje z fronty bez požiadavky. Ktoré
   tvrdenie platí, návrhy medzi sebou nezladili; zladiť to musíš ty alebo plán implementácie. Plán ide dnes podľa
   návrhu komponentov (PV10 nič neblokuje).
2. **Komponenty stoja na staršej verzii jadra.** Návrh komponentov uvádza, že stojí na návrhu jadra verzie 6 (22:22);
   jadro je teraz vo verzii 10.3. Zmeny jadra 7 až 10.3 (vyradené Z25 a otvorené PV9, rozhodnutie PV3 na Z27,
   spresnenia Z9, Z10, Z17, Z23, Z26, nová PV16) komponenty nespomínajú; ich verzie 4.2 a 4.3 reagovali len na
   posudok tohto prehľadu. Pri čítaní som nenašiel miesto, kde by to zmenilo niečo v tomto prehľade (účinok Z26 v
   knižnici ide cez spoločné prekrytie chyby, ktoré komponenty nemenia); výslovne to však žiadny z návrhov netvrdí.
3. **Nález 36.** Denník k nemu uvádza aj to, že widget po vytvorení číta obrázok ešte raz; komponenty (IM10) túto
   časť nespomínajú.
4. **Nález 10 (PV9): zvyšok v denníku.** Pri nálezoch mimo plánu má denník už opravu (po kroku 2 riadok červený nie
   je, ostane „zlyhal" so zamknutým formulárom, ako píše jadro pri PV9 a C55); tabuľka tretej sady rozhodnutí ešte
   píše „riadok hromadnej úpravy červený bez textu". Tento prehľad ide podľa jadra.

Vypadli body verzie 2, ktoré zdroje medzičasom zladili: viditeľné ZK v úvode komponentov a vypustené ZK v ich úvode
(komponenty 4.2, 4.3), zaradenie Z9 v riziku R9, veta pri PV15 a poznámka pri C58 (jadro 10.2), opis prvej verzie
komponentov a znenie nálezu 46 v denníku.
