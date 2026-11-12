# Návrh kroku 5, časti 1 až 3: požiadavky uploadu, služba `useUpload`, jadro fronty a dva tenké sklady (2026-10-09) — verzia 11.1

Podklad na implementáciu prvých troch častí kroku 5 z `upload-plan.md` (časť 3.4 a krok 5, body 1 až 3). Len
návrh: nič z neho nie je v kóde. Nič som nespúšťal (žiadne testy, build ani lint). Všetko je z čítania
pracovných stromov oboch repozitárov (LIB `next` nad `49bd815b`, DAM `next` nad `ba8a66ec`, oboje s
nekomitnutými zmenami krokov 0 až 3). Kde sa podklady `podklady/upload/3` až `9` líšia od kódu, platí kód.

Verzia 11 zapracúva rozhodnutia vlastníka z 9. 10. (`upload-postup.md`, „Otvorené témy, rozhodnutia vlastníka"
a „Rozhodnutia vlastníka k analýzam") a analýzy v `analyzy/` (meranie rýchlosti, PV9, PV10, PV14). Z jadra už nie je
otvorená žiadna téma. Verzia 11.1 dopĺňa opravy admin-dam po K6, ktoré vlastník rozhodol 9. 10. (nálezy 49, 50,
9, 19 a 40), a zosúlaďuje text s plánom. Verzia 10 zjednodušila znenie PV5 a PV13 pre vlastníka. Verzia 9 len spresňovala znenie po posudkoch verzie 8 (PV5, PV13, B12, jedna veta v 0.1, jeden odkaz). Verzia 8
brala pri PV3 variant knižnice (rozhodnutie vedúceho), spresňuje Z9 a Z26, rozširuje pravidlo o
časovaní testov na celú cestu po dokončenie a opravuje počty a číslovanie (posudky verzie 7: Codex
`review-krok5-design-v7-codex.txt` v pracovnom priečinku relácie, Opus cez vedúceho). Verzia 7 vyradila opravu F3 (PV9 je znova otvorená téma), zbližuje PV3 podľa overenia backendu
(`overenia.md` v tomto priečinku, J-04) a spresňuje Z9, Z10 a Z26 po posudkoch verzie 6 (Codex:
`posudok-navrhu-jadra-v6-codex.md`; Opus cez vedúceho). Verzia 6 opravila päť položiek registra a niekoľko
nezrovnalostí po posudkoch verzie 5 (Opus: žiadne zblíženie
nemení bežný tok; Codex: `posudok-navrhu-jadra-v5-codex.md` v tomto priečinku). Verzia 5 zapracovala spresnenie
vlastníka k pravidlu „produktovo sa nič nemení" (8. 10. večer, cez vedúceho):
„To, že je niekde chyba, pár pixelov inak alebo iný kontajner, väčšinou nie je problém. Problém je, keď jedna
verzia ukáže formulár s tromi poľami a druhá s jedným." Hranica je teda produktový rozdiel, nie vnútorné
správanie (zásada 5 v 0.2). Verzia 4 zapracovala tretie posudky a usmernenie vlastníka o mechanizme (podaná
funkcia, hodnota, slot namiesto prepínača); z nej ostávajú sady, ale len pre produktové rozdiely. Časť 6 je
teraz register všetkého, čo sa zbližuje, písaný pre vlastníka.

Stav kódu je k 23:20. Oba stromy stoja: posledná zmena zdroja je v knižnici z 18:46, v admin-dam z 18:36. Obe
sady sú zelené (knižnica 295 súborov a 3 565 testov o 18:49; admin-dam 67 súborov a 1 153 testov o 18:36).
Čísla riadkov v testoch sú z tohto stavu; pri testoch uvádzam aj meno prípadu.

Komponenty a „falošný" editačný formulár (časti 4 a 5 kroku 5) tu nie sú. Čo im tieto rozhrania musia nechať
otvorené, je v časti 3.3.

## Čo sa zmenilo

### Verzia 11.1 oproti verzii 11

| Vec | Verzia 11 | Verzia 11.1 |
|---|---|---|
| Nález 49, admin-dam (C15, 3.2) | bez návrhu | **F-A** v kroku F5: hromadné načítanie nedá formulár assetu, ktorý nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored`; riadok zlyhá s textom „Súbor assetu sa ešte spracúva…" a ide do `metadataFailures` aj `leftOutByBatch`; oživí ho notifikácia metadát tomu, kto asset nahral (4.1; `analyzy/nalez49-frontend.md`, 7.1) |
| Nález 49 a nález 50, detail a pravý panel admin-dam (C51, 3.2) | bez návrhu | **F-B s nálezom 50** hneď po F5: „Uložiť" vypnuté počas spracovania s krátkou vetou; uloženie z detailu aj z panela zapíše hodnoty do riadkov toho assetu vždy, nielen pri pohľade `queue`; po hromadnom uložení sa otvorený panel načíta znova (4.1) |
| F5 a Z29 | `leftOutByBatch` len pre riadky bez metadát | zapisuje doň aj F-A |
| Nálezy 9, 19 a 40 (C65) | C65: „nález 19 ostáva otvorený"; 9 a 40 bez riadku | riadky v 4.1: 40 hneď po K6, 19 po ňom, 9 samostatne v admin-dam; C65 opravené |
| Nálezy 20 a 17 (A18) | nález 20 sa návrhu netýka, 17 bez zmienky | jeden riadok v 4.1 s odkazom na krok plánu |
| PV16 (4.1, 5.2) | len `report` | admin-dam navyše `resetList()` na začiatku čítania (bod mimo plánu DAM 1-3) |
| Zastarané „otvorené" | koniec registra, Z25, K7b „ak ho vlastník bude chcieť" | témy sú rozhodnuté (5.2); Z25 odkazuje na F5; o K7b rozhodne vedúci |

### Verzia 11 oproti verzii 10.3

| Vec | Verzia 10.3 | Verzia 11 |
|---|---|---|
| Meranie rýchlosti (B15 až B17, PV4, PV12, D4, F1, K2-D4, R1) | D4 čakalo na potvrdenie; F1 ako oprava po K6; člen `speedBaseline` v sadách; riziko R1 | **jeden merač** podľa `analyzy/meranie-rychlosti.md`, krok **M po K6** (2.3, pravidlo 4; 4.1). D4, F1, K2-D4 a riziko R1 sú nahradené; `speedBaseline` je v sadách len dočasne od K2 po M. Z23 v registri nahrádza nová položka **Z28**. PV4 a PV12 sú rozhodnuté. |
| PV9 (C55) | otvorená téma, vlastný návrh | rozhodnuté: oprava **F5** v admin-dam po K6, vrátane bodu 5 analýzy (riadok z `metadataFailures`, ktorému metadáta prinesie notifikácia, dostane stav „hotový"); nová položka registra **Z29**; Z25 ostáva vyradená |
| PV10 (C56) | otvorená téma; pole len v knižnici, „časť 4 ho bude potrebovať" | rozhodnuté: `uploadedAssetId` píše spoločné usadzovanie na oboch stranách v okamihu, keď označí riadok za duplikát (`markAsDuplicate`, podľa analýzy, nie len v `becomeOriginals`); veta o časti 4 opravená (platí návrh komponentov: časť 4 pole nepotrebuje); nová položka registra **Z30** |
| PV14 (B32) | otvorená téma; sada knižnice vždy `default` | rozhodnuté: plná podpora pomenovaných konfigurácií. Jadro: krok **PV14a** (fronta nesie meno, `libraryUploadPreset(configName)`, člen `configOf` sady jadra knižnice, nepovinné `UploadReadOptions.queueKey` v usadzovaní); komponenty: PV14b; cache mien na konfiguráciu (PV14c) neskôr. Zapísané obmedzenie „jedna stránka = jeden core-dam". Zmenené B32, 1.4, 2.3 (pravidlo 2), 2.4, 2.8, 3.1. |
| PV15 (C69) | otvorená téma | uzavreté: želaný stav |
| PV16 | otvorená téma | rozhodnuté áno, samostatný malý krok (možnosť a) |
| 5.2 | desať zblížení „na potvrdenie" a šesť otvorených tém | všetko potvrdené alebo rozhodnuté 9. 10.; z jadra nie je otvorená žiadna téma |
| Rozdiely (časť 1) | 39 rovnaké / 15 voľba / 32 vlastný kód / 9 rozhodnuté / 5 pre vlastníka / 33 zblížené | 38 / 15 / 32 / 11 / 0 / 37: B15, B17, C55, C56 sú „zblížené", B32 a C69 „rozhodnuté" |

### Verzia 10.3 oproti verzii 10.2

| Vec | Verzia 10.2 | Verzia 10.3 |
|---|---|---|
| PV16 (dopytovanie distribúcií) | možnosť (a) „jedno hlásenie na sériu do Sentry aj konzoly"; rytmus 15, 30, 60, 120, 300 s; `report: failures === 0` bez cesty k pomocníkovi | presne (posudok Codexu `review-krok5-navrhy-v102-v43-codex.txt`): `report` riadi len zapisovač pomocníka (v admin-dam predvolený `console.error`), udalosti Sentry pri 5xx zachytáva `httpClientIntegration` sama a tie ostanú (ako pri dopytovaní uploadu, druhá sada, bod 1, „nechať"); 15 až 300 s sú najmenšie odstupy, platí väčší z nich a bežného odstupu, a pri skrytej karte sa nečíta; cesta príznaku cez spätné volanie dopytovača a obal `fetchAssetDistributionList` je opísaná a veľkosť prepočítaná |

### Verzia 10.2 oproti verzii 10.1

Opravy po posudku prehľadu pre vlastníka (`posudok-prehladu-v2-opus.md`, body 2, 5, 7, 8; `prehlad-zjednotenia.md`,
§7, body 5, 6, 7). Kód oboch stromov sa od 8. 10. 18:46 (knižnica) a 18:36 (admin-dam) nezmenil.

| Vec | Verzia 10.1 | Verzia 10.2 |
|---|---|---|
| Z26 a PV13 (F4) | viditeľný účinok len v admin-dam | rovnaký účinok má aj knižnica: neskorší kúsok s odpoveďou 422 alebo pri štvrtom pokuse 400 zapíše do riadku text služby (`L/uploadQueue/composables/uploadService.ts:183-195`) po tom, čo usadzovanie pri hlásení `failed` text zmazalo (`L/uploadQueue/settlement/uploadSettle.ts:356`), a riadok aj dialóg jedného súboru ukážu ten text namiesto čipu s dôvodom (`L/uploadQueue/components/UploadQueueItemEditable.vue:281-286`, `UploadQueueDialogSingle.vue:448-453`); overené v kóde. Opravené v Z26 a v PV13; výhrada „závisí od toho, ako core-dam odpovie (neoverené)" ostáva. Veta „jediná oprava, ktorá v admin-dam mení…" v tomto návrhu nie je (je v prehľade). |
| Z17 a PV7 | „(dnes sa dosiela nevidený a asset ostane)" | asset, ktorý štart uploadu vytvoril, ostane na serveri aj po zmene; zmena zastaví len zvyšné kúsky (`L/uploadQueue/store/uploadQueuesStore.ts:396-414,470-491`) |
| Z23 (PV4, F1) a Z9 (PV5) | Z23 „chyba oboch strán" bez slova o tom, čo vidno | obe zaradené rovnako: „viditeľné", Z9 zobrazený text, Z23 odhad rýchlosti a zvyšného času vo všetkých troch aplikáciách (`L/uploadQueue/components/UploadQueueItemEditable.vue:259`); rozhodne vlastník |
| R9 | Z9 medzi „kozmetika, časovanie, hlásenia v Sentry" | viditeľné položky vymenované každá so svojím zaradením, v súlade s registrom |
| PV15 | „Rozdiel pri vlastnom poli je v sidebaroch, nie vo funkciách" | veta nesprávna (obe strany robia pri vlastnom poli to isté, J-14, komponenty HO10); nahradená |
| C58 | „voľba profilu `caches`" bez vysvetlenia | jedna veta: po ZK20 komponentov člen nenesie rozdiel strán; ostáva, lebo testy admin-dam nahrádzajú cache podľa cesty |
| PV16 (nová otvorená téma) | — | dopytovanie distribúcií v admin-dam hlási každé zlyhané čítanie (druhá sada, bod 6, „nechať do kroku 5"); v 5.2 s možnosťami, účinkom a odporúčaním; nie je v žiadnom kroku K |

### Verzia 10 oproti verzii 9

| Vec | Verzia 9 | Verzia 10 |
|---|---|---|
| PV5 (Z9), PV13 (Z26) | príklady jednotlivých prípadov časovania | PV5 a PV13 opísané bez príkladov jednotlivých prípadov; presné podmienky sú v stĺpci dôkazov |
| B19, stĺpec admin-dam (verzia 10.1) | len „ostane posledné percento a zvyšný čas" | doplnený aj druhý prípad, ako v Z9 a PV5: keď žiadny tik nič neohlásil, `progressPercent` ostane `null` a riadok zoznamu ukazuje točiace sa koliesko |

### Verzia 9 oproti verzii 8

| Vec | Verzia 8 | Verzia 9 |
|---|---|---|
| Z9 (PV5), prípad (2) | „malý súbor sa odošle a dokončí v prvej sekunde" | presná podmienka: žiadny tik merača nevidel vzorku rýchlosti skôr, než dokončenie odpovedalo; dva príklady (malý súbor v prvej sekunde; dlhší upload, kde každý kúsok dá jedinú udalosť priebehu až do neskorej vzorky) |
| Z26 (PV13, F4) | F4 mení, kedy čas zamrzne | navyše: dnes sa merač zastaví aj vtedy, keď mŕtvy upload skončí bez zlyhania, a ďalší tik po poslednom kúsku ukáže 100 % a 0 s, čo čas skryje. F4 zastaví beh pri hlásení servera a nechá posledný kladný odhad, takže keď hlásenie príde počas posledného kúska alebo dokončenia, alebo keď core-dam zlyhaný súbor ďalej prijíma, ostane pri červenej ikone starý čas tam, kde dnes nie je žiadny (kozmetika) |
| B12 | pripína len `LT/uploadServiceSequence.test.ts:76-82` | aj `LT0/consumerProfileUpload.test.ts:99-101` (profil CMS aj UGC) |
| 0.1 | „33 zblížených riadkov je 26 položiek registra" | opravené: odkazujú na 23 položiek; Z4, Z12 a Z20 sú len pri riadkoch s iným verdiktom (B4, B6, B25, B26, C21) |
| História verzie 5 | odkaz na vypustené testy K0 „(8.1)" | „(4.2, 8.4)" |

### Verzia 8 oproti verzii 6 a 7

| Vec | Verzia 7 | Verzia 8 |
|---|---|---|
| Z27 (PV3, typ súboru na časti kúska) | variant admin-dam (bez typu); menil sa `LT/uploadServiceSequence.test.ts:76-82` | **variant knižnice** (s typom), rozhodnutie vedúceho: typ pripína aj `LT0/consumerProfileUpload.test.ts:99-101` (prípad `:87`, pod profilom CMS aj UGC), ktorý verzia 7 prehliadla. Knižnica a jej dva profily ostávajú presne ako dnes; mení sa len admin-dam (K3), ktorý začne posielať typ, ktorý server nečíta. Žiadny test sa nemení: testy admin-dam na kúsku tvrdia len meno a veľkosť. |
| Z9 (PV5) | jeden prípad (starý čas) | dva prípady: ak pred posledným kúskom prišlo hlásenie, dnes ostane staré percento a čas; ak prvá vzorka prišla až po poslednom tiku, dnes sa točí neurčitý kruh, po zblížení sa ukáže plný kruh |
| Z26 (PV13, F4) | „zamrznutý čas" | presne: čas sa ukáže, len keď bol posledný odhad kladný; aj dnes zamrzne pri červenej ikone, keď mŕtvy upload neskôr zlyhá u klienta. F4 mení, **kedy** zamrzne. |
| Pravidlo o časovaní (2.3, R4) | „k prvej požiadavke" | celá cesta po dokončenie (`DT/upload/uploadSequence.test.ts:84-93`: štart, tri kúsky a dokončenie po jedinom `advanceTimersByTimeAsync(0)`), vrátane požiadavky kúska knižnice, ktorú admin-dam preberá v K3. Pribudol test `DT/queue/queueRefresh.test.ts:348-349` a rozsah `D-st:555-570`. |
| Počty a číslovanie | tabuľka v 0.1 nesedela pre 1.2 a 1.3; legenda „Z1 až Z26"; pravidlá v 2.3 v poradí 1 až 5, 7, 6 | 1.2: 2 pre vlastníka, 15 zblížené; 1.3: 3 pre vlastníka, 14 zblížené; legenda Z1 až Z27; pravidlá 1 až 7 po poradí, odkazy v R3, R4, R5 opravené |

### Verzia 7 oproti verzii 6

| Vec | Verzia 6 | Verzia 7 |
|---|---|---|
| F3, Z25, PV9 | oprava „stav riadku hromadnej úpravy späť na hotový" na potvrdenie | **vyradené z plánu** (rozhodnutie vedúceho): zmena stavu by vytvorila nové správanie (tlačidlo „Obnoviť", ktoré nič neurobí; neskoršia notifikácia metadát by riadok dostala do hromadného uloženia). Z25 ostáva v registri ako „vyradené" s dôvodom; PV9 je otvorená téma s opisom dnešného stavu; riadna oprava potrebuje vlastný návrh. |
| PV3 (typ súboru na časti kúska) | otvorená téma, hodnota `typedChunks`, test K0 | core-dam typ časti nečíta (`overenia.md`, J-04): **zblížené** (nová položka Z27, na potvrdenie); `typedChunks` a test K0 zanikli. Verzia 7 brala variant admin-dam; verzia 8 berie variant knižnice (tabuľka vyššie). |
| Z9 (PV5) | „kruh sa doplní, čas zmizne" | presne: v admin-dam ostane starý zvyšný čas aj pri zelenej fajke hotového riadku, kým je riadok v zozname; nastane, keď dokončenie odpovie skôr než o ďalší tik (0 až 1 s); bez vzorky rýchlosti sa nemení nič |
| Z26 (PV13, F4) | „neskoršie zlyhanie už nič neprepíše" | F4 to musí urobiť výslovne: v `catch` jadro riadok, ktorý zlyhal od servera, preskočí. Pribudlo, čo vidno: v zozname ostane vedľa červenej ikony zamrznutý posledný zvyšný čas. |
| Z10, stĺpec admin-dam | „okrem posielania bez prípravy" | opravené: posielanie bez prípravy admin-dam merač zastaví; bežať ho nechá len riadok bez súboru |
| Riziko R4 | počet `await` | prepísané podľa `overenia.md` (J-13): počet `await` je pod falošným časom voľný; citlivé sú nový 0 ms časovač, dynamický import a testy, ktoré po synchrónnom volaní skladu čakajú jediný `nextTick`. Pravidlá v 2.3 a 2.4. |
| R1, K2-D4 | ručná skúška so súborom väčším než jeden kúsok | so súborom nad 1 MB (predvolený prvý kúsok core-dam, J-06) |
| Drobnosti z `overenia.md` | — | rozsah axios (J-03), Sentry v nasadení (J-10), dve výhrady k R3 (J-12), PV15 v LIB robí to isté ako DAM (J-14) |
| Počty | K0 2; členy sád 15; register Z1 až Z26 | K0 1; členy sád 14; register Z1 až Z27, z toho Z25 vyradená; na potvrdenie 10 (bez PV9, s PV3); otvorené 5 (PV9, PV10, PV12, PV14, PV15) |

### Verzia 6 oproti verzii 5

| Vec | Verzia 5 | Verzia 6 |
|---|---|---|
| Z25 (PV9, F3) | „riadok hromadnej úpravy prestane byť červený" | nesprávne: červený dnes nie je, oba háky chybu už zmažú. F3 mení **stav** z „zlyhal" na „hotový", a to vidno: zmizne ×, zapne sa znak „hotovo" a na ceste po spracovaní súboru sa po 20 s ukáže „Obnoviť". Pribudol test `DT/queue/slotNotifications.test.ts:775` a otvorená otázka, či „Obnoviť" taký riadok dostane do hromadného uloženia. |
| Z26 (PV13, F4) | len „súbor sa prestane posielať" | navyše, čo vidí používateľ admin-dam: dnes neskoršie zlyhanie behu prepíše text riadku a ukáže upozornenie, takže namiesto čipu s dôvodom od servera je v riadku iný text. F4 to odstráni. Či to neskoršie zlyhanie vôbec nastane, závisí od toho, ako core-dam odpovie na kúsky a dokončenie zlyhaného súboru (neoverené). |
| Z9 (PV5) | „knižnica vždy ohlási 100 %"; kozmetika | presne: po poslednom kúsku sa v admin-dam kruh doplní a text so zvyšným časom zmizne aj vtedy, keď dokončenie odpovie do sekundy; knižnica toto hlásenie pošle, len ak už má vzorku rýchlosti. Zaradenie „zobrazený text, rozhodne vlastník", ostáva na potvrdenie. |
| Z1 (PV1) | „knižnica hlavičku nenastavuje" | knižnica ju nastavuje na `undefined`, a to je v admin-dam nutné: jeho klient má predvolené `application/json`, pod ktorým by axios `FormData` previedol na JSON. Zapísané do Z1 a do 2.2, aby ten riadok po K3 nikto nezmazal. |
| Z10, R11 | podmienka `upload()` bez prípravy bola mimo `try`, merač by ostal bežať | podmienka je vnútri; test K2 pokrýva aj tento výstup |
| Počítadlo kľúčov | R2 hovorilo „v moduloch skladov", Z22 „jedno v jadre" | všade jedno v jadre (Z22) |
| Kroky K5, K6 | Z16 a Z21 pri K6 | Z16 a Z21 menia knižnicu, teda K5 |
| 7.16 | sada admin-dam dostáva veľkosť kúska od aplikácie | opravené: dostáva časový limit; veľkosť kúska číta knižnica |
| Riziko R12 | blokuje K3, kým sa neoverí | vyriešené čítaním (oba posudky): obe náhrady `FileReader` v testoch admin-dam vracajú skutočný `ArrayBuffer`; potvrdí prvý beh K3 |

### Verzia 5 oproti verzii 4

| Vec | Verzia 4 | Verzia 5 |
|---|---|---|
| Čo sa drží na každej strane | každý rozdiel, aj vnútorný, cez člen sady | len produktový rozdiel: čo používateľ vidí a môže urobiť, aké texty, čo sa v bežnom toku pošle a uloží na backend, aké API a typy assetov strana používa, voľby aplikácie (upozornenie, „Obnoviť", import). Mechanizmus ostáva podľa usmernenia: podaná funkcia, hodnota, slot. |
| Vnútorné rozdiely a chyby | prepis dnešného kódu každej strany v jej sade | **zblížené** na jeden variant: správny alebo jednoduchší; kde sú oba v poriadku, admin-dam (originál), ak variant knižnice nie je zjavne lepší. Každé je zapísané v registri v časti 6 aj s tým, ktorej strany správanie sa berie a prečo. |
| Mechanizmus sád | dve zapečatené sady na vrstvu, typované stranou | ostáva: dve zapečatené sady na vrstvu, typované stranou (`UploadPreset<S>`, `UploadRun<S>`, `UploadQueuePreset<S>`); sada jadra admin-dam prijme len behy admin-dam. Spoločný kód nemá vetvu podľa strany; má tri vetvy podľa hodnoty sady (`emptyFile`, `typedChunks`, `speedBaseline`), lebo tie rozdiely sú hodnoty. |
| Členy sád | 20 (služba 10, jadro 8, požiadavka kúska, `accepts`) | 15: služba 7 (z toho 2 len do rozhodnutia PV3 a PV12), jadro 7, `accepts`. Stratégie `chunkRetry`, `stopAt`, `meter`, `runFailed`, `stopping`, `rejections`, `toChunk`, `strictRead`, `runDone` a nastavenie požiadavky kúska zanikli; spoločný kód je jeden. |
| Témy pre vlastníka | 15 otvorených | 5 otvorených (PV3, PV10, PV12, PV14, PV15, každá produktová). Desať zblížených „na potvrdenie" je v krátkom zozname na začiatku 5.2: PV1, PV2, PV5, PV6, PV7, PV11 berú variant jednej strany; PV4, PV8, PV9, PV13 sú opravy chýb, ktoré idú až po K6 a po potvrdení. |
| Testy K0 | 31 (dnešné správanie každej strany) | 2 (produktové rozdiely, ktorým na jednej strane chýba test). Ostatné chránili vnútorný rozdiel, ktorý sa teraz zbližuje; zoznam vypustených je v 4.2. |
| Časť 6 | žiadne zblíženie; mapa v3 → člen sady | **register zblížení pre vlastníka** (Z1 až Z26): čo to je, čo robila každá strana, čo sa berie a prečo, čo si kto všimne, zaradenie, dôkaz v kóde, testy. Každý ďalší krok doň dopisuje, čo zblíži navyše. |
| Codex (päť porušení) a Opus G1 až G3, Codex GAP pri C25 | všetko držané sadou, testy K0 navyše | podľa spresnenia vnútorné: zblížené (Z5, Z6, Z7, Z21, Z22, Z16); testy, ktoré ich chránili, odpadli (4.2, 8.4) |
| Rozdiely (časť 1) | 43 rovnaké / 28 voľba / 32 vlastný kód / 9 rozhodnuté / 21 pre vlastníka | 39 rovnaké / 15 voľba / 32 vlastný kód / 9 rozhodnuté / 5 pre vlastníka / 33 zblížené |
| Veľkosť | LIB asi +615 riadkov | LIB asi +345; DAM asi −1 310 |

### Verzia 4 oproti verzii 3

História. Kde riadok hovorí iné než tabuľka verzie 5, platí tabuľka verzie 5.

| Vec | Verzia 3 | Verzia 4 |
|---|---|---|
| Ako sa drží rozdiel strán | voľby v spoločnom kóde, každá zvlášť, väčšinou ako `if` podľa hodnoty | **sady.** Knižnica dodáva pre službu dve sady (`libraryUploadPreset`, `adminDamUploadPreset`) a pre jadro dve (`libraryQueuePreset`, `adminDamQueuePreset`). Čo sa líši celé (čo nasleduje po neúspešnom pokuse, ako merač meria a končí, kde a čím sa beh zastaví, čo zastavenie a odstránenie robí s riadkom, čo nasleduje po zlyhanom behu), je v sade funkcia; hodnota je hodnota; jediná vetva je príznak. Spoločný kód nemá ani jednu vetvu podľa strany (usmernenie vlastníka, zásada 6 v 0.2). |
| Kombinácie, aké nemá ani jedna strana (Opus W1) | dali sa namiešať: `chunkResize: 'afterFailure'` s `messages` bez textu pre 400; `onClientFailure` so `stopRuns: 'byStatus'` | nedajú sa. Sadu vyrobí len jej funkcia a jej obsah nie je verejný; typ nesie stranu (`UploadPreset<S>`, `UploadRun<S>`, `UploadQueuePreset<S>`) a sada jadra admin-dam prijme len behy admin-dam. Kontajner, profil usadenia a behy dáva sklad svojej sade, nie jadru zvlášť. Požiadavka kúska má dve povolené dvojice nastavení. |
| Hranica O17 | zásada 5 | spresnená vedúcim (21:05): chráni všetko dosiahnuteľné cez oba sklady, všetko vyvezené z `src/lib.ts` a obrazovky. Rozdiel viditeľný len priamemu volaniu nevyvezenej funkcie sa smie zblížiť, len keď by zachovanie stálo viac než funkcia alebo hodnota v sade, a s dôkazom, že ho žiadna cesta produktu nedosiahne. |
| Časť 6 | jedenásť zblížení Z1 až Z11 | **žiadne.** Všetkých jedenásť drží člen sady (tabuľka v 6.3), aj päť, ktoré Codex označil za porušenie (Z1, Z2, Z7, Z9, Z11). |
| Opakovanie kúska (B10, B22, B23, B33) | voľby `chunkResize`, `messages.chunkValidationFailed`, zblíženia Z1 a Z4 | stratégia `chunkRetry` každej strany, prepis dnešného `catch`. Vráti rozhodnutie synchrónne; čítanie a pauzu robí spoločný kód, takže počet krokov sľubov je na oboch stranách dnešný. |
| Zastavenie behu (B8, B9, B24) | dva mechanizmy na zjednotených miestach, voľba `stopRejection`, zblíženie Z7 | funkcia `stopAt` každej strany: v ktorom bode a čím beh odmieta, presne ako dnes |
| Texty | `messages` (päť kľúčov a nepovinný `chunkValidationFailed`), spoločná `uploadValidationMessage` | každá strana dá svoju dnešnú funkciu „text z polí" (`validationMessage`); text pre 400 je v knižničnej `chunkRetry`. Spoločná funkcia textu a typ `UploadMessages` zanikli. |
| Zlyhanie behu (C24 až C27) | hák `onClientFailure` a voľba `stopRuns` | celý `catch` je stratégia `runFailed` sady jadra. Sada admin-dam dostane od skladu text (`resolveUploadErrorMessage`) a upozornenie (`showError`) a zapisuje v jeho dnešnom poradí. |
| Zastavenie a odstránenie (C30 až C38) | voľba `stopRuns`, jedno telo s vetvami | štyri funkcie sady (`removeByIndex`, `stopItemUpload`, `stopUpload`, `clearQueue`), každá prepis dnešného kódu svojej strany, vrátane `async` a `await` admin-dam |
| Kľúč riadku (C7) | jedno počítadlo v module jadra (Z11) | každý sklad svoje, ako dnes; jadro kľúče nerobí |
| Zápis uloženého detailu (C51) | `core.writeAssetMetadata` s voľbou `suggestions` | vlastný kód každého skladu, bez zmeny |
| `addQueueItem`, `recalculateQueueCounts` nad frontou, ktorá nie je (C5) | zblíženie Z5 | prístup ku kontajneru strany: knižnica nič, admin-dam výnimka ako dnes |
| Test `DT/upload/uploadStop.test.ts` | v K3 sa upravovala príprava veľkosti kúska | bez zmeny: sada admin-dam dostane `chunkSize` od aplikácie, takže náhrada `useDamUploadChunkSize` v teste ju dosiahne |
| `useDamUpload` (Opus W2) | vyvezené v K2, hoci Z3 a Z4 tvrdili „nevyvezené" | vyvezené v K2, lebo ho potrebuje kópia knižnice pred K3; s každou z dvoch sád sa správa ako dnešná služba tej strany |
| Testy K0 | — | nové: beh zlyhá pri riadku `Uploaded` (obe strany, Codex GAP pri C25); merač po zlyhanom `upload()` (obe strany); `stopRejection` admin-dam aj pre kúsok zrušený na ceste. Opravené: prípady prepočtu veľkosti kúska každý vo svojom súbore (Opus G1); „400 nič nehlási" tvrdí synchrónne `console.error` (G2); riadok v teste poradia zápisov je pred zlyhaním upraviteľný (G3). |
| Rozdiely (časť 1) | 50 rovnaké / 22 voľba / 31 vlastný kód / 9 rozhodnuté / 21 pre vlastníka | 43 / 28 / 32 / 9 / 21: B8, B9, B10, B13, B20, B23 a C5 sú „voľba" (drží ich člen sady), C51 je „vlastný kód" |

### Verzia 3 oproti verzii 2

História. Kde riadok hovorí iné než novšie tabuľky, platia novšie.

| Vec | Verzia 2 | Verzia 3 |
|---|---|---|
| Hranica zblíženia bez voľby | podľa úsudku „nie je vidno" | pravidlo O17, zapísané ako zásada 5 v 0.2. Každé zblíženie je v časti 6 s tým, čo presne sa mení, kto to môže vidieť, s dôkazom posudkov a s testami, ktoré sa museli zmeniť. |
| Pravidlo „len obrázok" (A6) | presunuté do predvolených požiadaviek služby; K1 prepisoval test, ktorý ho pripína | ostáva, kde je dnes: v `damUploadStart/Chunk/Finish` (`api/uploadApi.ts`). Prípad `LT0/damImageApiUploadRequests.test.ts:163` ostáva; `uploadStopBetweenChunks.test.ts` a `uploadStopWhileHashLoads.test.ts` sa nedotknú. |
| Kde sú tri požiadavky | sťahovali sa z `damImageApi.ts` do `uploadApi.ts` | nesťahujú sa. `imageUploadStart/Chunk/Finish` ostávajú v `damImageApi.ts`, kúsok dostane voľby, z `src/lib.ts` idú von ako `damFileUploadStart/Chunk/Finish`. K1 je rozdelený: K1a (voľby kúska a exporty; žiadny existujúci test sa nemení) a K1b (O15; tri testovacie súbory). |
| Prepočet veľkosti kúska po neúspešnom pokuse (B23, B10) | volanie `updateChunkSize` po poslednom pokuse (LIB) a po zrušenom pokuse (DAM) odpadlo | ostáva na oboch stranách tam, kde je dnes; drží ho nová voľba `chunkResize` (B33). Odpadá len opätovné čítanie kúska a čakanie 1 ms. Dôvod v časti 6 je opravený. |
| Zrušený kúsok v admin-dam (B10) | „nie je vidno" | povedané priamo: beh odmietne hneď chybou zrušenia, nie po pauze textom `'upload stopped'`. Prijaté podľa hranice (Z1). |
| Zápis pri zlyhaní uploadu (C27) | hák zapísal text skôr, než jadro zapísalo `hasError` | jadro píše presne v poradí admin-dam: `hasError`, text, `Failed`, `canEditMetadata`, upozornenie. Hák len vráti text a funkciu upozornenia. |
| Zastavenie a odstránenie (PV6, PV7) | dve voľby (`stoppedRunFails`, `stopRuns`), ktoré sa dali skombinovať do správania, aké nemá ani jedna strana | jedna voľba `stopRuns` s dvoma hodnotami, každá je jedno dnešné správanie |
| Prepočet po úspešnom behu (C23) | jadro prepočítalo vždy (zblíženie) | nezbližuje sa: jadro neprepočíta, prepočet po importe ostáva v admin-dam cez hák `onRunDone`. Hranicou by neprešlo: testy admin-dam sejú fronty s `processedCount: 0` bez ohľadu na riadky. |
| Časť 6 | šesť zblížení | jedenásť zblížení (Z1 až Z11): päť z verzie 2 bez C23, štyri, ktoré pomenovali posudky, a dve, ktoré som našiel pri prepise |
| Testy, ktoré chýbali | — | K0: obe hlásenia kúska do Sentry (LIB); „neplatná veľkosť a posun aj tak odídu" a „400 nič nehlási" (DAM); B22 pripnuté na službe, nie na sklade; poradie zápisov pri zlyhaní (DAM); `chunkResize` na oboch stranách; `stopRejection` s vymenovanými bodmi zastavenia; „bežný upload počty neprepočíta" (DAM). K1a: dva prípady s hodnotami admin-dam. K2: zlyhaný upload s hlásením priebehu nenechá časovač merača. |
| Poradie krokov | K2-D4 „po K2"; PV6 a PV7 „po K5"; PV8 „po K4" | K2-D4 až po K3 a po kópii knižnice; PV6, PV7 a PV8 až po K6 |
| Témy pre vlastníka | 14 | 15: pribudla PV15 (nálezy 34 a 41 z denníka) |
| Blokuje začiatok | S1 (stromy sa hýbu), S2 (brány vlny 4) | nič: stromy stoja a obe brány sú splnené (5.1) |
| Čísla riadkov v testoch | stav z 18:05 | stav z 20:25 (stromy sa od 18:46 nezmenili) |
| Opravená drobnosť v 7.6 | „riadok v pauze, zastavený cez `stopUpload`, dnes ešte pošle ďalší pokus" | platí len pre riadok, ktorý v tej chvíli nebol `Uploading`; bežný riadok v pauze ďalší pokus nepošle |

### Verzia 2 oproti verzii 1

História. Kde riadok hovorí iné než novšie tabuľky, platia novšie.

| Vec | Verzia 1 | Verzia 2 |
|---|---|---|
| Dočasné pravidlo | malo výnimky: pri PV5 „tvar DAM pre obe", D4 sa vykonalo v K2 | **bez výnimky:** kým vlastník nerozhodne, každá strana sa správa presne ako dnes, cez voľbu, ktorej predvolená hodnota je dnešná LIB a DAM odovzdá svoju |
| D4 (meranie rýchlosti) | súčasť K2, test LIB sa otočil | voľba `speedBaseline`; vykonanie D4 je samostatný krok K2-D4, ktorý sa **nespustí**, kým vlastník nepotvrdí (PV12, spolu s PV4). K2 je len zapojenie volieb a neotáča žiadny test. |
| Posledné hlásenie merača (PV5) | dočasne tvar DAM, test LIB sa otočil | voľba `meterEnd` |
| Kontajner front | sklad LIB prejde z `Map` na objekt | každý sklad si nechá svoj; jadro číta fronty cez `UploadQueuesAccess`. Zvláštne kľúče (`toString`, `__proto__`, `hasOwnProperty`) sa v LIB správajú ako dnes. |
| Zastavenie a odstránenie (PV6, PV7) | dve dočasné voľby, len pre `removeByIndex`, mimo rozhrania | dve voľby v rozhraní (`stoppedRunFails`, `stopRuns`), pokrývajú `removeByIndex`, `stopItemUpload`, `stopUpload`, `clearQueue` aj to, kto uvoľní miesto vo fronte |
| Upozornenie pri zlyhaní uploadu | hák volal `showError` skôr, než jadro označilo riadok | hák vráti funkciu, ktorú jadro zavolá až po označení riadku `Failed`, ako dnes v DAM |
| Opravené verdikty | A12, B14, B24, C1, C3, C22, C32, C33, C37 boli „rovnaké" | A12 patrí k PV2; B14 je nová téma PV11; B24 je voľba `stopRejection`; C1 a C3 voľba kontajnera; C22, C32, C37 patria k PV7; C33 k PV6; A6 je vlastný kód každej strany |
| Nové témy pre vlastníka | 10 | 14: pribudli PV11 (kontrola výsledku čítania kúska), PV12 (potvrdenie D4), PV13 (nález 21 z denníka), PV14 (nález 23) |
| Vlna 4 testov | otázka Q1 | tvrdá brána: vlna 4 knižnice pred K2, vlna 4 admin-dam pred K3; nové súbory sú zatriedené v 4.3 a 4.4 |
| Účtovníctvo testov | chyby | `uploadStatusFallback.test.ts` volá `damUploadFinish` (chýbal); `uploadQueuesStore.test.ts:475` by po posune argumentov netvrdil nič; argumenty dokončenia číta jeden test, nie štyri; tri testy uvedené ako nové už existujú; `uploadStop.test.ts` má desať prípadov a jeho `:150` pripína PV4 |
| Kontroly pred prvou kópiou do DAM | cielené testy | celá sada `src/domains/dam` a oba projekty `vue-tsc` |
| Odchýlky od plánu | len väzby v DAM | aj `api/uploadApi.ts` v LIB, ktorý rastie namiesto zániku (2.7) |
| Väzby v DAM (Q3) | otázka | rozhodnuté: ostávajú; úplný zánik je voliteľný krok K7b, ktorý mení len testy a importy |
| Časť 6 | obsahovala D4 a „tvar DAM" pri PV5 | žiadna zmena správania; ostáva šesť zblížení zápisu, vypísaných s dôvodom |

**Cesty.** V LIB sú relatívne k `src/domains/dam/` (predpona `L/`), v DAM k `src/domains/coreDam/` (predpona `D/`). Súbor mimo týchto priečinkov
má pred cestou meno repozitára a cestu od jeho koreňa (napr. admin-dam `src/shared/types/EnvConfig.ts`).

| Skratka | Súbor |
|---|---|
| `L-ua` | LIB `api/uploadApi.ts` |
| `L-ia` | LIB `api/damImageApi.ts` |
| `L-aa` | LIB `api/damAssetApi.ts` |
| `L-us` | LIB `uploadQueue/composables/uploadService.ts` |
| `L-st` | LIB `uploadQueue/store/uploadQueuesStore.ts` |
| `L-mo` | LIB `uploadQueue/composables/uploadQueueMassOperations.ts` |
| `D-fa` | DAM `asset/api/fileApi.ts` |
| `D-ia` | DAM `asset/api/imageApi.ts`; `audioApi.ts`, `documentApi.ts` majú ten istý kód o riadok vyššie, `videoApi.ts` o šesť nižšie |
| `D-aa` | DAM `asset/api/assetApi.ts` |
| `D-us` | DAM `shared/services/upload/uploadService.ts` |
| `D-ep` | DAM `shared/services/upload/externalProviderImportService.ts` |
| `D-st` | DAM `asset/store/uploadQueuesStore.ts` |
| `LT/`, `LT0/`, `DT/` | LIB `uploadQueue/__tests__/`, LIB `__tests__/`, DAM `src/test/` |

**Verdikty v tabuľkách rozdielov** (posledný stĺpec, vždy jeden na riadok):

- **rovnaké** — obe strany robia to isté. „Tvar LIB" alebo „tvar DAM" pri verdikte znamená len tvar rozhrania
  (napríklad klient ako parameter), nie správanie.
- **voľba** — produktový rozdiel, ktorý ostáva na každej strane (zásada 5): drží ho člen sady (2.8), v sade
  knižnice dnešné správanie knižnice, v sade admin-dam dnešné správanie admin-dam. Člen je podaná funkcia,
  hodnota alebo príznak podľa toho, čo rozdiel je (zásada 6).
- **vlastný kód** — vec má len jedna strana (alebo ju každá robí po svojom nad tým istým bodom jadra); ostáva
  vlastným kódom tenkého skladu alebo aplikácie.
- **rozhodnuté** — rozdiel už zblížilo zapísané rozhodnutie (identifikátor z plánu alebo denníka) a je vykonané
  alebo sa vykoná bez ďalšej otázky.
- **zblížené** — vnútorný rozdiel, kozmetika alebo chyba jednej či oboch strán: spoločný kód berie jeden
  variant alebo opravu. Každé je v registri v časti 6 (Z1 až Z27) aj s tým, čo sa berie a čo si kto všimne. Pri
  „potvrdené" je to bývalá téma pre vlastníka (PV), ktorú vlastník potvrdil 9. 10.
- **pre vlastníka** — produktový rozdiel, o ktorom nerozhodujem. Je tam odporúčanie. Kým rozhodnutie nepríde,
  platí dnešné správanie každej strany, držané jej sadou. Zoznam je v časti 5.2.

---

## 0. Zhrnutie

### 0.1 Na jednu obrazovku

**Čo sa presúva do LIB**

1. **Požiadavky.** Tri požiadavky uploadu (štart, kúsok, dokončenie) s klientom a adresou ako parametrami v
   LIB už sú: `imageUploadStart`, `imageUploadChunk`, `imageUploadFinish` v `api/damImageApi.ts`; na typ assetu
   sa nepozerajú. Ostávajú, kde sú, a knižnica ich vyvezie pod menami `damFileUploadStart`, `damFileUploadChunk`,
   `damFileUploadFinish`. admin-dam ich bude volať tak, ako ich volá knižnica (s kontrolami kúska a bez
   vlastnej hlavičky; Z1, Z2). `api/uploadApi.ts` ostáva väzbou knižnice s pravidlom „len obrázok"; stráca len
   nepoužitý parameter `_endPointAsset`. V DAM zanikne ten istý kód v štyroch typových API (4 × asi 120 riadkov)
   a rozvetvenie podľa typu vo `fileApi.ts`; ostanú štyri krátke obaly a import od externého poskytovateľa ako
   jedna funkcia namiesto štyroch.
2. **Služba.** Jedno `useUpload(item, onProgress, preset?)` v LIB s jedným priebehom pre obe strany. Sada služby
   drží len to, čo je produkt alebo väzba na aplikáciu: požiadavky (adresy, typy assetov), texty, časový limit,
   odkiaľ sa vezme hash, či sa pošle prázdny súbor, a do kroku M základ merania rýchlosti.
   `libraryUploadPreset()` je predvolená, `adminDamUploadPreset(app)` dostane od admin-dam jeho veci. Z `shared/services/upload/uploadService.ts` v DAM ostane asi 95 riadkov z 311.
3. **Sklady.** Nové jadro `createUploadQueueCore(preset)` v LIB: čítania, počty, kľúče riadkov, dve posielania
   naraz, štart riadku a jeho zlyhanie, zastavenie, odstránenie a vyčistenie podľa jedného pravidla, zapojenie
   usadzovania z kroku 2. Sada jadra drží len produktové veci (import, text a upozornenie pri zlyhaní, „Obnoviť",
   evidenciu slotov a hromadnej úpravy) a stav skladu (kontajner, profil usadenia). Hromadné operácie ako čisté
   funkcie nad riadkami. Oba pinia sklady ostávajú, s dnešnými menami členov; sklad LIB spadne z 555 na asi 240
   riadkov, sklad DAM z 918 na asi 470.

**Čo ostáva, kde je**

- Usadzovanie a dopytovanie (`uploadQueue/settlement/*`, krok 2) sa nemení okrem dvoch malých doplnkov v
  samostatných krokoch: zápisu `uploadedAssetId` pri označení duplikátu (PV10) a nepovinného `queueKey` pre
  čitateľov (PV14a).
- Profil usadenia, odber notifikácií, tvorba riadkov a zápis uloženého detailu ostávajú v každom sklade.
- Len DAM: sloty, hromadná úprava (`Loading`, `metadataFailures`), externí poskytovatelia, text a upozornenie pri
  zlyhaní uploadu. Len LIB: kópia do licencie, „Obnoviť" na zlyhanom riadku, pravidlo „len obrázok".
- Limity 50 súborov sú v komponentoch, nie v skladoch; jadro ich nerieši.
- `useDamConfigStore` a všetky dnešné exporty z `src/lib.ts` ostávajú; pribudnú nové (2.6).

**Poradie** (každý krok končí zelenými cielenými testmi, časť 4): K0 jeden test produktového rozdielu → K1a
exporty požiadaviek v LIB → K1b zánik `_endPointAsset` (O15) → K2 služba a jej dve sady v LIB → celé kontroly
LIB, build a `./copy.sh` → K3 požiadavky a služba v DAM → K4 jadro a jeho dve sady v LIB → K5 sklad LIB na
jadre → celé kontroly, build a `./copy.sh` → K6 sklad DAM na jadre → K7 upratanie (voliteľné). Obe brány vlny 4
sú splnené. Po K6, všetko rozhodnuté vlastníkom 9. 10.: krok M (jeden merač), opravy F2 a F4; v admin-dam opravy
40, 19, F5 s F-A a F-B s nálezom 50; samostatné malé kroky PV10, PV14a (a v komponentoch PV14b), PV16, nález 9 v
admin-dam a nález 20 so 17 v knižnici (4.1).

**Veľkosť** (odhad z čítania, nie meranie): z DAM odíde asi 1 310 riadkov produkčného kódu (typové API −510,
`fileApi.ts` −140, `uploadService.ts` −215, sklad −445). V LIB pribudne asi 655 riadkov nových súborov (jadro
330, typy 100, dve sady služby a dve sady jadra 170, hromadné operácie 55) a služba narastie asi o 30; ubudne
asi 340 (sklad −315, composable hromadných operácií −25). Spolu LIB asi +345. Cieľ plánu „sklad DAM asi 280
riadkov" nevychádza: len profil usadenia so štyrmi čitateľmi, slotmi a hákmi, ktorý pribudol v kroku 2, má
asi 170 riadkov (3.2).

**Rozdiely** (štyri tabuľky v časti 1): 133 riadkov.

| Tabuľka | Riadkov | rovnaké | voľba | vlastný kód | rozhodnuté | pre vlastníka | zblížené |
|---|---|---|---|---|---|---|---|
| 1.1 Požiadavky | 22 | 10 | 3 | 4 | 1 | 0 | 4 |
| 1.2 Služba | 33 | 10 | 2 | 1 | 3 | 0 | 17 |
| 1.3 Sklady | 69 | 16 | 7 | 23 | 6 | 0 | 17 |
| 1.4 Profil usadenia | 9 | 1 | 3 | 4 | 1 | 0 | 0 |
| Spolu | 133 | 37 | 15 | 32 | 11 | 0 | 38 |

Tridsaťosem zblížených riadkov (C36 od posudku K4 c3, Z33) odkazuje na dvadsaťšesť položiek registra v časti 6 (B15, B16 a B17 na jednu, Z28).
Ďalšie tri položky (Z4, Z12, Z20) zbližujú len časť riadku, ktorý má iný verdikt (B4, B6, B25, B26, C21). Spolu je
platných položiek dvadsaťosem (Z1 až Z30 bez vyradenej Z25 a nahradenej Z23). Pri implementácii pribudli Z31 (K2, vnútorné), Z32
(K2, chyba jednej strany nedosiahnuteľná pri platnej konfigurácii; riadok B27) a Z33 (K4, vnútorné), spolu tridsaťjeden.
Žiadny riadok nie je „pre vlastníka": vlastník 9. 10. rozhodol všetky témy jadra (5.2), aj PV16 (dopytovanie
distribúcií v admin-dam), ktoré riadok v časti 1 nemá, lebo sa uploadu netýka.

**Čo návrh mení v správaní.** Produktovo nič: na žiadnej strane sa nemení, čo používateľ vidí a môže urobiť,
aké texty a upozornenia dostane, čo sa v bežnom toku pošle a uloží na backend, ani aké API a typy assetov strana
používa. Mení sa vnútorné správanie tam, kde ho spoločný kód zjednotil, a opravujú sa chyby; všetko je v
registri v časti 6 aj s tým, čo by si kto mohol všimnúť (väčšinou nič). Dvanásť položiek registra sú bývalé témy pre
vlastníka, ktoré vlastník potvrdil alebo rozhodol 9. 10. (5.2). Čo z toho vidno, je v riziku R9.

### 0.2 Šesť zásad, z ktorých návrh vychádza

1. **Čo testy DAM podvrhujú alebo nahrádzajú, volá kód DAM.** Testy DAM nahrádzajú časti knižnice cez
   `vi.mock('@anzusystems/common-admin', importOriginal)` (`useAlerts`, `useDamConfigState`, …) a moduly DAM
   podľa cesty. Náhrada platí len pre to, čo importuje kód DAM; kód vnútri knižnice volá svoje vnútorné
   funkcie. Preto upozornenia, texty, požiadavky a beh uploadu a importu dostáva sada admin-dam od aplikácie ako
   podané funkcie, nie ako vlastné importy. Tým prežije väčšina testov DAM bez prepisu.
2. **Bez sady je to knižnica.** `useUpload(item, callback)` bez tretieho parametra použije `libraryUploadPreset()`.
   CMS a UGC nič neodovzdávajú; mení sa im len vnútorné správanie z registra (časť 6).
3. **Produktový rozdiel ostáva na každej strane, vnútorný sa zbližuje.** Na každú vrstvu (služba, jadro) sú dve
   sady; sadu vyrobí len jej funkcia, jej obsah nie je verejný a typ nesie stranu (`UploadPreset<S>`,
   `UploadRun<S>`, `UploadQueuePreset<S>`, `S` je `'library'` alebo `'adminDam'`), takže sa nedá zostaviť z častí
   a sada jadra admin-dam prijme len behy admin-dam. Sada drží len produktové rozdiely a väzby na aplikáciu (2.8). Otvorená téma PV je produktový rozdiel; drží ju sada, kým
   vlastník nerozhodne, a potom je to malý krok: zmena jedného člena a otočenie menovaných testov.
4. **Jadro nedrží stav v module.** Fronty sú stavom skladu, ktorý jadro číta pri každom volaní; register
   bežiacich uploadov a množina „Obnoviť pomôže" žijú v inštancii jadra, teda so skladom. V module knižnice ostáva
   len počítadlo kľúčov riadkov a dnešná posledná veľkosť kúska (`damUploadChunkSize.ts:5`). Dôvod: v teste DAM,
   ktorý nahrádza časť knižnice, je knižnica jedna inštancia pre celý súbor a `vi.resetModules()` ju neobnoví
   (`noc/dam-krok2.md`, „Looked wrong", bod 8).
5. **Hranica: produktový rozdiel, nie vnútorné správanie (spresnenie vlastníka, 8. 10. večer; nahrádza prísne
   čítanie O17).**
   - **Musí ostať na každej strane** (cez hodnotu, podanú funkciu alebo slot, nikdy potichu jedným variantom): čo
     používateľ vidí a môže urobiť (polia, formuláre, tlačidlá, karty, kroky, toky), aké texty dostane, čo sa v
     bežnom toku pošle a uloží na backend (napríklad ktoré polia metadát idú do `PATCH`, sloty, import od
     externého poskytovateľa, hromadná úprava), aké API a typy assetov strana používa (`/adm` alebo `/ugc`, len
     obrázok alebo štyri typy), a voľby aplikácie (prepínač jednorazového použitia, polia autorov a kľúčových
     slov, „Obnoviť", upozornenia).
   - **Zbližuje sa na jeden variant** (správny alebo jednoduchší; kde sú oba v poriadku, variant admin-dam,
     lebo je originál, ak variant knižnice nie je zjavne lepší): vnútorné časovanie a poradie (kedy
     zastavený beh odmietne, pauzy, kroky sľubov), hodnoty odmietnutia, ktoré nikto neukazuje, opakovania na
     cestách, ktorými produkt nejde, kľúče riadkov a registra, počítadlá, kedy sa prepočíta, vnútorný tvar volieb,
     drobné rozdiely vzhľadu a kontajnera, a chyby jednej strany (berie sa správne správanie).
   - Každé zblíženie je v registri v časti 6 a každý neskorší krok doň dopíše to, čo zblíži navyše.
6. **Mechanizmus podľa toho, čo rozdiel je (usmernenie vlastníka z 8. 10. večer).** Pre každý rozdiel, ktorý
   ostáva, taký spôsob, ktorý spoločný kód zaťaží najmenej: správanie, ktoré sa líši celé, je podaná funkcia
   (beh importu, text a upozornenie pri zlyhaní, požiadavky); hodnota je hodnota (prázdny súbor, časový limit);
   príznak len tam, kde je rozdiel naozaj jedna vetva („Obnoviť"). Komponenty (časť 4) budú mať na to aj sloty.

---

## 1. Rozdiely

### 1.1 Požiadavky

| # | Správanie | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| A1 | Štart: adresa, telo, odpoveď | `imageUploadStart(client, endPoint, item)`: `POST {endPoint}/licence/{licenceId}`, telo `{ mimeType: damFileTypeFix(file), size }`, čaká 201, inak `reject()` bez hodnoty (`L-ia:33-60`) | `uploadStart(item)` štyrikrát, to isté (`D-ia:40-67`) | **rovnaké**. Tvar LIB: klient a adresa sú parametre. |
| A2 | Štart do slotu | pre `type === SlotFile` so `slotName` a `assetId`: `{endPoint}/asset/{assetId}/slot-name/{slotName}` (`L-ia:36-38`); LIB taký riadok nikdy nevytvorí | to isté (`D-ia:42-45`) | **rovnaké** |
| A3 | Slotový riadok bez slotu alebo bez assetu | ide ako bežný upload pod licenciou (rovnaká podmienka) | to isté; pripína `DT/upload/uploadRequests.test.ts` („starts a slot row that has no slot or no asset as an ordinary upload…") | **rovnaké** (nález 3.3.4 z `noc/dam-krok0.md`, nemení sa) |
| A4 | Klient | parameter `client`; služba ho berie z konfigurácie `default` (`L-us:31,88`) | `damClient` importovaný v každom typovom API (`D-ia:20`) | **voľba**: produkt (iné API, iný klient), `requests` sady služby (knižnica: `damUploadStart/Chunk/Finish` s klientom a adresou obrázka z konfigurácie `default`; admin-dam: jeho obaly nad `fileApi.ts`) |
| A5 | Adresa podľa typu assetu | jedna, `endPointImage` (predvolene `/adm/v1/image`, v UGC `/ugc/v1/image`) | štyri pevné: `/adm/v1/image`, `audio`, `video`, `document` (`D-ia:23` a súrodenci) | **voľba**: produkt (len obrázok, alebo štyri typy), `requests` sady služby |
| A6 | Typ, ktorý aplikácia nenahráva | `reject()` bez hodnoty, bez požiadavky (`L-ua:17-20,41-44,64-67`); pripína `LT0/damImageApiUploadRequests.test.ts:163` („a row of the type %s › is not started, sent nor finished") | `reject(new Error("fileApi: unsupported asset type '…'"))`, bez požiadavky (`D-fa:95-96,143-144,195-197`); text pripína `DT/upload/fileApiDispatch.test.ts` („is refused without a request for a type the app does not know") | **vlastný kód**: kontrola typu a to, čím odmieta, ostáva na každej strane tam, kde je dnes (LIB v `damUploadStart/Chunk/Finish` v `api/uploadApi.ts`, bez hodnoty; DAM v obale `fileApi.ts`, so svojím textom). Spoločná služba ani tri neutrálne požiadavky sa na typ nepozerajú. Verzia 2 kontrolu LIB sťahovala do služby; zamietnuté (7.8). |
| A7 | Kúsok: adresa, telo, odpoveď | `POST {endPoint}/{fileId}/chunk`, `FormData` s `file` a `chunk = {"offset","size"}`, `signal` riadku, `onUploadProgress`, čaká 201 (`L-ia:140-189`) | to isté (`D-ia:77-106`) | **rovnaké** |
| A8 | Kúsok: časový limit | 420 s v konfigurácii požiadavky (`L-ia:16,178`) | to isté (`D-ia:24,92`) | **rovnaké** |
| A9 | Kúsok: hlavička `Content-Type` v konfigurácii požiadavky | `undefined` (`L-ia:175-177`); pripína `LT0/damImageApiUploadRequests.test.ts:94` | `'multipart/form-data'` (`D-ia:94-96`); pripína `DT/upload/uploadRequests.test.ts:107` | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV1, Z1). Na drôte to isté: axios 1.20.0 v prehliadači typ pri `FormData` zmaže a nechá ho na prehliadač (`node_modules/axios/lib/helpers/resolveConfig.js:65-73`, rovnaká verzia v LIB, DAM, CMS aj UGC). |
| A10 | Kúsok: kontroly pred odoslaním | prázdny alebo ne-`Blob` obsah, neceločíselná alebo nekladná `size`, záporný alebo neceločíselný `offset` sa odmietnu bez požiadavky, každé so správou do Sentry (`L-ia:75-138,143-169`); pripína `LT0/damImageApiUploadRequests.test.ts` („is refused without a request for %s", šesť prípadov) | žiadne (`D-ia:77-110`); nepripnuté | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV2, Z2): kontroly aj v admin-dam. V bežnom toku je kúsok vždy platný, takže sa nič neodmietne. |
| A11 | Kúsok: odpoveď 400 do Sentry | chyba so značkou `dam_upload_chunk_400` a s odpoveďou (`L-ia:190-211`); kontroly z A10 hlásia správu `dam_upload_chunk_validation` (`L-ia:77,100,121`); ani jedno nepripína žiadny test | nič; nepripnuté | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV2, Z2): hlásenie do Sentry aj z admin-dam |
| A12 | Kúsok: čo smie byť obsahom | `Blob \| File` (`L-ia:67`); iné odmietne kontrola z A10 | parameter je typu `string` (`D-ia:72`) a pripojí sa k formuláru, čokoľvek to je (`D-ia:80`). Produkcia posiela `File`; dva testy volajú `fileApi.uploadChunk` s textom `'bytes'` a čakajú jednu požiadavku (`DT/upload/fileApiDispatch.test.ts:24`, `DT/upload/uploadRequests.test.ts:116`) | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV2, Z2): obsah kúska musí byť `Blob`; dva testy DAM, ktoré posielajú text, pošlú `Blob` |
| A13 | Dokončenie | `PATCH {endPoint}/{fileId}/uploaded`, telo `{ checksum }`, čaká 200 (`L-ia:216-244`) | to isté (`D-ia:114-137`) | **rovnaké** |
| A14 | Po úspešnom dokončení `Uploading → Processing` | len ak je riadok stále `Uploading`; v `damUploadFinish` (`L-ua:69-73`); pripína `LT/uploadStatusFallback.test.ts` („turns a row that is being sent into one that waits for the server", „leaves a row that is %s by then as it is") | to isté; vo `fileApi.uploadFinish` cez `startProcessing` (`D-fa:103-106`); pripína `DT/upload/uploadRequests.test.ts` („finishes the upload…", „rejects a finish…") | **rovnaké**. Zápis ostáva vo väzbe každej strany: `damUploadFinish` (LIB), `fileApi.uploadFinish` so `startProcessing` (DAM). |
| A15 | Nepoužitý parameter `_endPointAsset` v `damUploadFinish` | je (`L-ua:57-58`) | nie je | **rozhodnuté** O15: zaniká v kroku 5 (K1b); čo to znamená pre testy, je v 4.3 |
| A16 | Opakovanie na úrovni požiadavky | žiadne; kúsok opakuje služba, štart a dokončenie idú raz | to isté | **rovnaké** |
| A17 | Import od externého poskytovateľa | nie je | `POST {endPoint}/licence/{licenceId}/external-provider`, telo `{ id, externalProvider }`, čaká 201; štyrikrát (`D-ia:159-183`) a rozvetvenie (`D-fa:202-240`) | **vlastný kód** DAM: jedna funkcia vo `fileApi.ts` nad tou istou mapou adries |
| A18 | Kópia do licencie (predchádza riadku kópie) | `copyToLicence` (`L-ia:269-310`) | nie je | **vlastný kód** LIB: ostáva v `damImageApi.ts`. Adresu kópie vo widgetoch (nález 20) a jej hlásenie chýb (nález 17) opraví samostatný krok plánu (4.1); jadra sa netýka. |
| A19 | Čítanie jedného assetu pre usadenie | `fetchAsset(client, endPoint, id, { report })` (`L-aa:61-76`), 404 → `null` v sklade (`L-st:74-84`) | `fetchAsset(id, { report })` (`D-aa:171`), 404 → `null` v sklade (`D-st:114-122`) | **rovnaké** (krok 2). Každý sklad má svojho čitateľa. |
| A20 | Čítanie viacerých assetov licencie | `fetchAssetListByIds` priamo cez klienta, po 50; hlásenie zlyhania skladá sklad ručne (`L-aa:153-190`, `L-st:87-106`) | `fetchWaitingAssets` cez `useApiRequest` s `report`, po 50 (`D-aa:143-158`) | **rovnaké** navonok (tá istá adresa, dávka, „odpoveď bez zoznamu je zlyhanie"). Každý sklad si necháva svojho čitateľa; zjednotenie zápisu je nepovinné (K7a). |
| A21 | Čítanie zoznamu slotov | nie je | `fetchAssetSlotFiles` (`asset/api/assetSlotApi.ts:48-57`) | **vlastný kód** DAM (čitateľ profilu) |
| A22 | Čítanie originálu duplikátu | asset podľa súboru, `fetchAssetByFileId` (`L-aa:90-100`) | súbor podľa typu, `fetchImageFile` a súrodenci (`D-st:145-161`) | **voľba** profilu usadenia `readers.duplicateOriginAsset` / `duplicateOriginFile` (hotové v kroku 2) |

Mimo tabuľky: DAM má `uploadFailed(imageId)` (`PATCH /adm/v1/image/{id}/failed`, `D-ia:139-157`), ktorú nič
nevolá (grep v `admin-dam/src`). Navrhujem ju zmazať spolu s ostatným kódom uploadu v K3 (otázka Q5, neblokuje).

### 1.2 Služba

| # | Správanie | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| B1 | Opakovanie kúska | 4 pokusy, pauzy 1, 3, 9 s (`L-us:21-24,167-207`); pripína `LT/uploadServiceRetry.test.ts` („is tried four times when %s…") | to isté (`D-us:18-21,162-194`); pripína `DT/queue/uploadFailures.test.ts` („is given up on after four attempts…") | **rovnaké** |
| B2 | Hash súboru | `rusha` sa načíta lenivo v `uploadInit`, najviac 15 s, inak riadok zlyhá pred prvou požiadavkou (`L-us:25,245-252`); `upload()` bez `uploadInit()` odmietne (`L-us:284-285`) | statický import, hash vzniká pri volaní `useUpload` (`D-us:11,116`); `upload()` bez `uploadInit()` funguje (tak ho volá `DT/upload/uploadStop.test.ts`, „uploads every chunk when nothing stops it") | **zblížené** na tvar knižnice (Z3): hash sa pripraví v `uploadInit`; odkiaľ sa `rusha` vezme, dá aplikácia (`loadHash`: knižnica lenivo, admin-dam hneď zo svojho balíka). `upload()` bez `uploadInit()` odmietne aj v DAM. |
| B3 | Stav `Uploading` ešte pred čakaním na hash | áno, ak má riadok neprázdny súbor (`L-us:242`); bez toho by fronta spustila ten istý riadok dvakrát (`LT/uploadQueueStartsEachFileOnce.test.ts`) | netreba, `uploadInit` nečaká (`D-us:237`) | **zblížené** (Z3): stav sa píše pred čakaním na hash na oboch stranách |
| B4 | Riadok bez súboru | odmietne bez požiadavky (`L-us:254-257`) | odmietne bez požiadavky (`D-us:230-235`); pripína `DT/upload/uploadSequence.test.ts` („a row that has no file to send") | **rovnaké**. Text chyby, ktorý nikto neukazuje, je zblížený na text admin-dam (Z4). |
| B5 | Súbor s 0 bajtmi | odmietne pred požiadavkou, `Error('Empty file')` (`L-us:254`); pripína `LT/uploadQueueClientFailure.test.ts` („that is empty: the row fails before anything is asked…") | pošle štart so `size: 0` a hneď dokončenie, bez kúska (`D-us:269-287`); pripína `DT/upload/uploadSequence.test.ts` („is started and finished with no chunk between") | **voľba**: produkt (prázdny súbor knižnica nepošle, admin-dam áno), hodnota `emptyFile` sady (knižnica `'reject'`, admin-dam `'send'`) |
| B6 | Odpoveď štartu bez `id` alebo bez `asset` | zlyhá hneď (`L-us:262-267`) | zlyhá hneď (`D-us:243-247`) | **rozhodnuté** (tretia sada, bod 5; pre DAM zapísané v denníku, „Rozhodnuté bez vlastníka pri tretej sade"). Text chyby, ktorý nikto neukazuje, je zblížený na text admin-dam (Z4). |
| B7 | Zápis `assetId` a `fileId` po štarte | `L-us:268-269` | `D-us:248-249` | **rovnaké** |
| B8 | Ako sa služba dozvie o zastavení | číta `queueItem.status === Stop` (`L-us:28`) | príznak, ktorý nastaví vrátené `stop()` (`D-us:113,293-297`) | **zblížené** (Z5): beh je zastavený, keď je riadok `Stop` alebo bolo zavolané `stop()`; jadro pri zastavení robí oboje |
| B9 | Kde sa zastavenie kontroluje | stav: po načítaní hashu, na začiatku `upload()`, po prečítaní kúska, po poslednom kúsku (`L-us:251,287,163,297`) a v `catch` pokusu kúska (snímok K2 `:183`; doplnené po posudku K2) | príznak: pred a po prečítaní kúska, po pauze, v odpovedi štartu, na začiatku slučky, po poslednom kúsku (`D-us:153,156,191,251,276,283`) | **zblížené** (Z5): kontroluje sa na všetkých miestach, kde dnes kontroluje ktorákoľvek strana |
| B10 | Zrušený kúsok v slučke opakovania | končí hneď, chybou zrušenia, bez prepočtu veľkosti kúska (`L-us:183`) | prepočíta veľkosť kúska, prípadne kúsok znova prečíta, prejde k pauze a skončí až po nej textom `'upload stopped'`; zrušený posledný pokus skončí hneď, textom o vyčerpaných pokusoch (`D-us:184-191`); sklad na `Stop` aj tak nič nerobí | **zblížené** na tvar knižnice (Z6): zrušený pokus alebo zastavený beh končí hneď chybou, ktorá prišla |
| B11 | Kúsok ako `File`: meno | meno súboru | meno súboru; pripína `DT/upload/uploadSequence.test.ts` („names every chunk after the file…") | **rovnaké** |
| B12 | Kúsok ako `File`: typ | typ súboru, `{ type: file.type }` (`L-us:158-160,199-201`); pripína `LT/uploadServiceSequence.test.ts:76-82` a `LT0/consumerProfileUpload.test.ts:99-101` (pod profilom CMS aj UGC) | bez typu (`D-us:157,188`); nepripnuté | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV3, Z27): core-dam typ časti nečíta, typ kúska určí z obsahu (`overenia.md`, J-04); knižnica a jej dva profily ostávajú, ako sú |
| B13 | Kontrola `fileId` pred kúskom | odmietne bez požiadavky (`L-us:128-131`) | nie je (`D-us:141-142`, `@ts-ignore`) | **zblížené** na tvar knižnice (Z7). Cez sklady sa riadok bez `fileId` ku kúsku nedostane (B6). |
| B14 | Výsledok čítania kúska zo súboru | výsledok, ktorý nie je `ArrayBuffer`, čítanie odmietne a upload zlyhá (`L-us:62-81`) | výsledok sa pošle ďalej, nech je čokoľvek; typ je pretypovaný na `string` (`D-us:79-93`) | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV11, Z8). V prehliadači dáva `readAsArrayBuffer` vždy `ArrayBuffer`; náhrady `FileReader` v testoch DAM ho dávajú tiež (R12, vyriešené čítaním). |
| B15 | Rýchlosť: odkiaľ sa meria pokus | odznova len pri opakovanom pokuse (`L-us:173-176`); prvý pokus ďalšieho kúska pokračuje od konca predošlého; pripína `LT/uploadServiceRetry.test.ts` („goes on from the chunk before when the next chunk is sent for the first time") | odznova pri každom pokuse, aj prvom (`D-us:168-169`); pripína `DT/upload/uploadSequence.test.ts` („says how far the file is…": „Measured afresh for the second chunk") | **zblížené**: rozhodnuté 9. 10. (PV12): jeden merač pre obe strany, krok M po K6 (Z28; `analyzy/meranie-rychlosti.md`). Meria naprieč kúskami od odoslania požiadavky, odznova len po zlyhanom pokuse. D4 (tvar DAM) je nahradené. Do M drží každú stranu dočasná hodnota `speedBaseline`. |
| B16 | Rýchlosť: prvá vzorka po novom základe | prvá udalosť zapíše len čas; druhá ráta všetky dovtedy odoslané bajty, aj tie pred prvou udalosťou (`L-us:111-124`) | to isté (`D-us:124-137`); pripína 501 namiesto 500 (`DT/upload/uploadSequence.test.ts:164,173`) a 3 000 namiesto 2 000 (`DT/upload/uploadStop.test.ts:150`) | **zblížené**: rozhodnuté 9. 10. (PV4): chybu rieši jeden merač v kroku M (Z28), lebo základ zapíše pri odoslaní požiadavky; F1 zaniká |
| B17 | Rýchlosť: vzorka, priemer, odhad | bajty od poslednej udalosti / čas; priemer posledných 15; zvyšok = veľkosť × (100 − percentá); raz za sekundu (`L-us:111-124,211-229`) | to isté (`D-us:124-137,198-218`) | **zblížené** (Z28, krok M): rýchlosť ako bajty za posledných 10 s namiesto neváženého priemeru 15 vzoriek; percentá rátajú aj bajty kúska na ceste a neklesnú; zvyšný čas `ceil((veľkosť − odoslané) / rýchlosť)`; tik raz za sekundu ostáva |
| B18 | Hlásenie priebehu skladu | len keď existuje aspoň jedna vzorka (`L-us:214`) | to isté (`D-us:201`); pripína `DT/upload/uploadSequence.test.ts` („says nothing about speed where the server reports none") | **rovnaké** |
| B19 | Merač po poslednom kúsku, keď upload uspel | koniec sa zapíše pred dokončením; bežiaci časovač raz dobehne a ohlási 100 % a 0 s, aj keď dokončenie už odpovedalo; ďalší sa neplánuje (`L-us:296`); pripína `LT/uploadServiceSequence.test.ts:137-143` | počas dokončenia tiká ďalej; časovač sa ruší, keď dokončenie odpovie (`D-us:288-290`). Ak odpovie skôr než ďalší tik, na riadku ostane posledné percento a zvyšný čas; riadok zoznamu ich kreslí aj počas `Processing` (`asset/components/queue/AssetQueueItemList.vue:88-95,142-146`). Ak dovtedy žiadny tik nič neohlásil, `progressPercent` ostane `null` (`uploadQueue/factory/UploadQueueItemFactory.ts:46` v LIB) a riadok zoznamu ukazuje točiace sa koliesko (`asset/components/queue/AssetQueueItemList.vue:91`). Nepripnuté. | **zblížené** na tvar knižnice, potvrdené 9. 10. (PV5, Z9): mení, čo riadok zoznamu admin-dam ukazuje počas spracovania; rozhodne vlastník |
| B20 | Merač pri zlyhaní alebo zastavení | služba vracia `stopSpeedCheck`, volá ho sklad v `catch` (`L-us:231-237`, `L-st:328`) | služba ho ruší sama vo `finally` a v `stop()` (`D-us:288-290,295`) | **zblížené** na tvar admin-dam (Z10): služba zastaví merač pri každom neúspechu sama |
| B21 | Kúsok s validačnou odpoveďou (422, `fields`) | bez opakovania, text z polí do `error.message` (`L-us:191-195`) | to isté (`D-us:177-181`); pripína `DT/queue/uploadFailures.test.ts` („is not sent again when the server says what is wrong with it") | **rovnaké** |
| B22 | Kúsok so 400 pri poslednom pokuse | vlastný text `chunkValidationFailed`, odmietne chybou axiosu (`L-us:185-188`); pripína `LT/uploadServiceRetry.test.ts:103-112` | nič zvláštne: skončí ako vyčerpané pokusy, služba text riadku nepíše a sklad potom napíše `unknownError`; nepripnuté (test používa 500) | **zblížené** (Z11): služba vždy zapíše text `chunkValidationFailed` zo svojich textov; admin-dam ako ten text dá svoj `unknownError`, ktorý jeho sklad zapisuje aj dnes |
| B23 | Po poslednom neúspešnom pokuse | ešte prepočíta veľkosť kúska, prípadne ho znova prečíta, a čaká 1 ms (`L-us:197-205`) | hneď koniec slučky, bez prepočtu (`D-us:184`) | **zblížené** na tvar admin-dam (Z6): po poslednom pokuse hneď koniec |
| B24 | Čím služba odmieta zastavený upload | `Error('Upload stopped')`, pri zrušenom kúsku chyba zrušenia; pripína `LT/uploadStopWhileHashLoads.test.ts:51,62` | text `'upload stopped'` (`D-us:24`); nepripnuté (testy tvrdia len „odmietne") | **zblížené** na tvar knižnice (Z5): `Error('Upload stopped')`. Hodnotu nečíta žiadny sklad. |
| B25 | Texty chýb kúska | `common.damImage.uploadErrors.*` (`L-us:35-60`) | `system.uploadErrors.*`, iné znenie (`D-us:30-55`) | **voľba**: texty sú produkt, `messages` sady (každá strana svoje). Funkcia, ktorá z nich skladá text z polí, je jedna (Z12). |
| B26 | Text zlyhania riadku pre sklad | nie je; riadok má len to, čo napísala služba pri kúsku | `resolveUploadErrorMessage`: odmietnutá operácia → `error.apiForbiddenOperation.<detail>`, validácia → polia, inak `unknownError` (`D-us:57-77`); pripína `DT/upload/uploadErrorMessage.test.ts` | **vlastný kód** DAM, ostáva v jeho `uploadService.ts`; text z polí berie zo spoločnej funkcie so svojimi textami (Z12). |
| B27 | Časový limit pre veľkosť kúska | voľba pluginu `coreDam.apiTimeout`, bez nej 30 (`L-us:103-104`) | `envConfig.dam.apiTimeout` (`D-us:117`) | **rozhodnuté** (krok 1, záplata 7). Zapojenie: hodnota `apiTimeout` sady. Hodnota `null` je zblížená na knižnicu (Z32). |
| B28 | Veľkosť kúska | `useDamUploadChunkSize`: hranice z `damPrvConfig.settings.imageChunkConfig`, posledná veľkosť spoločná pre všetky uploady | používa to isté z knižnice (`D-us:7,117`) | **rovnaké** |
| B29 | `finishAttempted()` | `L-us:100,298,306` | `D-us:115,285,299` | **rovnaké** (krok 2) |
| B30 | Poradie kúskov, hash po úspešnom kúsku, percentá po kúsku, `currentChunkIndex`, nový `AbortController` na kúsok | `L-us:164-165,179,289-294` | `D-us:159-160,172,274-280` | **rovnaké** |
| B31 | Čo služba vracia | `{ uploadInit, upload, stopSpeedCheck, finishAttempted }` (`L-us:302-307`) | `{ uploadInit, upload, stop, finishAttempted }` (`D-us:301-306`) | **rovnaké** navonok: spoločná služba vracia zjednotenie (`stop` aj `stopSpeedCheck`), nikto nič nestráca |
| B32 | Pod akou konfiguráciou DAM upload beží | vždy pod `default`: služba aj sklad čítajú `useCommonAdminCoreDamOptions()` bez mena (`L-us:31,88`, `L-st:68`), aj keď widget beží pod pomenovanou konfiguráciou | jedna konfigurácia | **rozhodnuté** (PV14, 9. 10.): plná podpora pomenovaných konfigurácií (`analyzy/pv14-pomenovane-konfiguracie.md`). Jadro: krok PV14a (fronta nesie meno konfigurácie, `libraryUploadPreset(configName)`, `configOf` v sade jadra knižnice, nepovinné `UploadReadOptions.queueKey`; 2.3 pravidlo 2, 2.4, 3.1); komponenty PV14b. Obmedzenie: všetky konfigurácie jednej stránky hovoria s tým istým core-dam. |
| B33 | Prepočet veľkosti kúska po neúspešnom pokuse (`updateChunkSize`; posledná veľkosť je stav modulu a začína ňou ďalší súbor, `uploadQueue/composables/damUploadChunkSize.ts:5,9`) | po každom neúspešnom pokuse, aj poslednom (`L-us:197`); nie po zrušenom pokuse ani pri riadku `Stop` (`L-us:183`); nepripnuté | pred každým ďalším pokusom, aj po zrušenom (`D-us:186`); nikdy po poslednom (`D-us:184`); nepripnuté (testy majú `minSize` rovné `maxSize`) | **zblížené** (Z6): prepočet len pred pokusom, ktorý ešte príde (tvar admin-dam). Môže zmeniť veľkosť prvého kúska ďalšieho súboru po zlyhanom uploade; je to vnútorná vec. |

### 1.3 Sklady

| # | Správanie | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| C1 | Kontajner front | `ref<Map<UploadQueueKey, UploadQueue>>`, súkromný (`L-st:60`, nie je v `return`); berie každý text ako kľúč, aj `toString`, `__proto__`, `hasOwnProperty` | `ref<{ [queueId]: UploadQueue }>`, verejný (`D-st:174,876`); testy doň sejú riadky (`DT/support/fakeDam.ts`, `seedQueue`, a ďalšie miesta); kľúče sú tri pevné (`shared/services/upload/uploadQueueIds.ts`) | **vlastný kód**: kontajner je stav skladu a každý si necháva svoj; dá ho svojej sade jadra. Zblížiť by sa smel (iný kontajner nie je produkt), ale stálo by to prepis testov DAM, ktoré do `queues` sejú, alebo nové obmedzenie kľúčov v LIB. |
| C2 | Identifikátor skladu | `commonUploadQueuesStore` (`L-st:56`) | `damUploadQueuesStore` (`D-st:163`) | **vlastný kód**: dva sklady ostávajú |
| C3 | Čítania fronty | `getQueue` (`null`), `getQueueItems` (`[]`), počty (0), kľúč vstupu (−1), `getQueueItemsTypes`, riadky podľa stavu; existenciu zisťuje `Map.has` (`L-st:192-204,294-298,458-468,500-504,520-533`) | to isté pre bežné kľúče; existenciu zisťuje operátor `in`, ktorý pre meno člena `Object.prototype` (`toString`, `constructor`, …) nájde zdedený člen a vráti ho ako frontu (`D-st:297-337,356-367`) | **vlastný kód** (ako C1): čítanie ide cez kontajner strany, takže LIB ostáva pri `Map.has`, DAM pri `in`. Obmedzenie DAM (kľúč nesmie byť meno člena `Object.prototype`) platí už dnes; jeho kľúče sú tri pevné. |
| C4 | Nová fronta | prázdne `items`, počty 0, `fileInputKey` 0, prázdne návrhy mien (`L-st:273-283`) | to isté (`D-st:580-590`) | **rovnaké** |
| C5 | `addQueueItem`, `recalculateQueueCounts` nad frontou, ktorá nie je | nič (`L-st:267-271,285-287`) | výnimka (`D-st:592-594,774-779`); nikto ich tak nevolá | **zblížené** na tvar knižnice (Z13) |
| C6 | Počty | spolu = počet riadkov, hotové = `Uploaded` + `Failed` (`L-st:288-291`) | to isté (`D-st:775-778`) | **rovnaké** |
| C7 | Kľúč riadku | `predpona_poradie` z počítadla modulu; súbor `file_<meno>`, kópia `asset_<id>` (`L-st:53-54,221,251`) | to isté; súbor a slot `file_<meno>`, externý `externalProviderAsset_<id>` (`D-st:78-79,382,408,484`) | **zblížené** (Z22): jedno počítadlo v jadre (`core.uniqueKey`); tvar kľúča ostáva |
| C8 | Kľúč riadku hromadnej úpravy | nie je | `asset_<id>` bez poradia (`D-st:433`); kľúčom je aj záznam v `metadataFailures` | **vlastný kód** DAM, nemení sa |
| C9 | `chunkSize` na riadku | 10485760 (`L-st:43`); číta ho len Sentry v požiadavke kúska | 10485760 (`D-st:80`) | **rovnaké** |
| C10 | Riadky zo súborov: podpis | `addByFiles(queueKey, extSystem, assetLicence, files)` (`L-st:239`) | `addByFiles(queueId, files)`, licencia a ext systém sú aktuálne (`D-st:370-373`) | **vlastný kód** každého skladu; spoločné je pridanie riadku (C13) |
| C11 | Riadky zo súborov: ktoré typy | len obrázok (`L-st:249`); pripína `LT/uploadQueueOperations.test.ts:134` | každý typ, ktorý ext systém pozná (`D-st:380`); pripína `DT/queue/queueAdd.test.ts:58,104` | **vlastný kód** (filter je v sklade) |
| C12 | Riadky zo súborov: konfigurácia ext systému chýba | výnimka `useUploadQueuesStore.addByFiles: Ext system must be initialised.` (`L-st:243-245`) | výnimka `Ext system must be initialised.` (`D-st:375-377`); čítanie testy nahrádzajú cez `useDamConfigState` | **vlastný kód** |
| C13 | Pridanie jedného riadku | vytvor, `createQueue`, vlož, prepočítaj, `processUpload` (`L-st:258-263`) | to isté (`D-st:391-394`) | **rovnaké** → `core.addRow` |
| C14 | Riadky do slotu | nie je | `addByFilesAsSlotUpload` (`D-st:398-425`); formát sa nekontroluje (vlastník 8. 10.: nepridávať) | **vlastný kód** DAM |
| C15 | Riadky hromadnej úpravy | nie je | `addByAssets`, stav `Loading`, `fetchLazyAdditionalMetadata`, `failStillLoading` (`D-st:427-473,517-540`) | **vlastný kód** DAM; K6 ho nemení. Po K6 ho menia opravy admin-dam (4.1): 40 (do cache mien aj konflikty autorov) a F5 s F-A (nález 49: asset, ktorý nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored`, formulár nedostane; riadok zlyhá s textom „Súbor assetu sa ešte spracúva…" a ide do `metadataFailures` aj `leftOutByBatch`). |
| C16 | Zoznam riadkov bez metadát | nie je | `metadataFailures` a háky `metadataGate`, `onProcessedSeen`, `afterMetadataLoaded` (`D-st:166-167,252-282`) | **vlastný kód** DAM; sada admin-dam dostane `rowRemoved` |
| C17 | Riadky externého poskytovateľa | nie je | `addByExternalProviderAsset` (výber: `Uploaded`, import: `Waiting`), `removeByExternalProviderAssetId` holým `splice` (`D-st:475-510,572-578`) | **vlastný kód** DAM |
| C18 | Riadky kópie do licencie | `addByCopyToLicence`: `Asset`, `Processing`, obrázok, hneď sledovaný (`L-st:206-237`) | nie je | **vlastný kód** LIB |
| C19 | Riadky „podľa id" | samostatná akcia nie je; kópia dostáva `DocId[]` (C18) | samostatná akcia nie je; hromadná úprava číta metadáta podľa id (C15) | **rovnaké** (nič také nie je; grep `addBy` v oboch skladoch) |
| C20 | Koľko naraz | 2 na frontu; `processUpload` ráta riadky v stave `Uploading` a spustí prvé čakajúce do voľných miest (`L-st:42,300-312`) | to isté (`D-st:65,596-610`) | **rovnaké** → jadro, konštanta 2. Výnimka, ktorú majú obe strany, je C68. |
| C21 | Čím sa riadok posiela | vždy `useUpload` (`L-st:315`) | riadok `ExternalProviderAsset` cez `externalProviderImport`, ostatné cez `useUpload` (`D-st:654-670`) | **voľba**: produkt (import od externého poskytovateľa je len v admin-dam), `runnerFor` sady jadra: knižnica vždy upload; admin-dam beh importu od skladu pre externý riadok, inak `upload`. Import prejde tým istým štartom riadku ako upload (Z20). |
| C22 | Register zastavenia behu | nie je; sklad nastaví stav a zruší požiadavku na ceste | `uploadStopHandles`, `WeakMap` riadok → `stop()` (`D-st:68,671`) | **zblížené** na tvar admin-dam, potvrdené 9. 10. (PV7, Z17): register je v jadre pre obe strany a pri zastavení sa číta; kľúčom je riadok, ako ho dostane jadro, ako dnes v admin-dam (Z21) |
| C23 | Po úspešnom behu | sleduj riadok, ak je `Processing`; `processUpload`; počty sa neprepočítajú (`L-st:325-326`) | to isté (`D-st:677-678`); po importe navyše prepočet medzi sledovaním a `processUpload` (`D-st:656-660`) | **zblížené** (Z14): jadro prepočíta frontu po každom úspešnom behu; počty sa rátajú zo stavov, takže sa zmení nanajvýš počet, ktorý bol zastaraný |
| C24 | Beh zlyhal a riadok je `Stop` | označí ho `Failed`, prepočíta, spustí ďalší (`L-st:331-348`); riadok už vo fronte nie je; nepripnuté | nič (`D-st:681-684`); pripína `DT/queue/uploadFailures.test.ts` („a failure of an upload the user has stopped") | **zblížené** na tvar admin-dam, potvrdené 9. 10. (PV6, Z15): zlyhanie behu zastaveného riadku už nič nezapisuje |
| C25 | Beh zlyhal a riadok je `Uploaded` (notifikácia predbehla) | nechá ho; ešte prepočíta a spustí ďalší (`L-st:334,346-347`) | nechá ho a končí (`D-st:687`) | **zblížené** na tvar admin-dam (Z16): nič navyše; prepočet a štart spravilo už usadenie |
| C26 | Beh zlyhal: zápis do riadku | `hasError`, `Failed`, `canEditMetadata = false` (`L-st:335-338`) | to isté (`D-st:697-701`) | **rovnaké** |
| C27 | Beh zlyhal: text a upozornenie | nič; text ostane, aký napísala služba (`LT/uploadServiceRetry.test.ts:88`) | text z `resolveUploadErrorMessage`; riadok sa označí `Failed`; až potom jedno `showError` na rovnaký text medzi riadkami, ktoré boli zlyhané už predtým (`D-st:691-704`); pripína `DT/queue/uploadFailures.test.ts` („an upload the server refuses to start") | **voľba**: produkt (text a upozornenie ukazuje len admin-dam), `onClientFailure` sady jadra admin-dam (text od skladu a upozornenie, jedno na dôvod). Zapisuje jadro v poradí admin-dam: `hasError`, text, `Failed`, `canEditMetadata`, upozornenie. |
| C28 | Sledovanie po zlyhanom dokončení | `finishAttempted() && !failedByServer && !isRefusal(e)` → `track(…, { clientFailed: true })` (`L-st:343-345`) | to isté (`D-st:707-709`) | **rozhodnuté** (D5; druhá sada, bod 4) |
| C29 | Zápis priebehu | `setUploadSpeed` (`L-st:351-355`) | to isté (`D-st:768-772`) | **rovnaké** |
| C30 | Odstránenie riadku, ktorý je na ceste (`Waiting`, `Uploading`, `Processing`) | `untrack`, `Stop`, zrušenie požiadavky (`L-st:396-406`) | to isté cez register (`D-st:559-563`); pripína `DT/queue/queueOperations.test.ts` („stops its upload as a cancel would, and starts the row that waited") | **rovnaké** |
| C31 | Odstránenie usadeného riadku, ktorého súbor sa ešte posiela (notifikácia ho zlyhala alebo usadila skôr) | beh nezastaví: stav nie je medzi aktívnymi (`L-st:398-403`); kúsky idú ďalej; nepripnuté | zastaví ho: každý odstránený riadok dostane `Stop` a jeho `stop()` (`D-st:559-563`); pre `clearQueue` pripína `DT/queue/queueOperations.test.ts` („stops an upload whose row a notification has failed while its file is still being sent"), pre odstránenie nepripnuté | **zblížené** na tvar admin-dam, potvrdené 9. 10. (PV7, Z17): beh sa zastaví; v knižnici to bola chyba (súbor sa dosielal a asset ostal) |
| C32 | Odstránenie usadeného riadku bez behu: jeho stav | ostane, aký bol; pripína `LT/uploadQueueOperations.test.ts` („that is uploaded: stays an uploaded row to whoever holds it…") | `Stop` (`D-st:559`); nepripnuté | **zblížené** (Z17): usadený riadok bez behu ostane, aký je (tvar knižnice); v admin-dam sa to môže prejaviť len pri obnovení: `D/asset/components/queue/AssetQueueEditable.vue:35-46` drží riadok cez `await refreshQueueItem` a `refreshFailed` potlačí, len keď sa stav počas obnovenia **zmenil** na Failed, Uploaded alebo Stop (`item.status !== statusBefore`); riadok, ktorý po K6 ostane Uploaded, stav nezmení, takže upozornenie sa po odstránení už nepotlačí. „Obnoviť" na nahratom riadku je však len bez formulára alebo s chybou a kôš je dovtedy vypnutý (okrem duplikátu) (`AssetQueueItemEditable.vue:233-251,421`), takže ten sled sa v rozhraní dá vyvolať len zriedkavým súbehom (posudok K4 c3: `refreshDisabled` vypne len „Obnoviť", nie kôš; čítanie metadát zaradené pred obnovením môže zapnúť formulár a s ním kôš, kým obnovenie čaká, `uploadSettlement.ts:135-142,631-637`, `uploadSettle.ts:584`; keď potom obnovenie vráti chybu, po K6 sa po odstránení ukáže `refreshFailed`, dnes ho `D-st:559` potlačí); viditeľná zmena v bežnom toku nepreukázaná, na K6 strážiť (plán K6) (posudky K4 c1, c2; dôvod „odstránený riadok nikto nečíta" bol nesprávny) |
| C33 | Odstránenie: kto uvoľní miesto | `catch` zrušeného behu (`L-st:347`): ak bol riadok v pauze medzi pokusmi, až po nej; `removeByIndex` sám ďalší riadok nespúšťa (`L-st:408-414`) | hneď `processUpload` v `removeByIndex` (`D-st:568`) | **zblížené** na tvar admin-dam, potvrdené 9. 10. (PV6, Z15): ďalší súbor sa spustí hneď pri odstránení |
| C34 | `removeByIndex`: návratový typ | synchrónne (`L-st:408`) | `async` (`D-st:555`) | **zblížené** (Z18): jadro synchrónne; admin-dam má `async` obal, ale `stopItemUpload` už na odstránenie nečaká |
| C35 | `removeByAssetId` | nie je | prvý riadok s assetom; keď nie je, len prepočet (`D-st:542-553`) | **vlastný kód** DAM, ostáva v sklade bez zmeny (na konci `await` svojho `removeByIndex`) |
| C36 | `stopItemUpload` | podľa identity riadku; tretí parameter `_index` sa nečíta; `Stop` bez podmienky, zrušenie požiadavky, odstránenie, `processUpload` (`L-st:416-427`) | to isté a `stop()` z registra a `settlement.untrack` (`D-st:637-650`) | **zblížené** (Z33; krok 1, záplata 11): riadok sa zastaví podľa jedného pravidla (Z17) a usadzovanie ho prestane sledovať aj vtedy, keď nie je vo fronte, ktorú volajúci menuje (posudok K4 c3). |
| C37 | `stopUpload` | fronta nie je: nič; prázdna: len `dropQueue`; inak všetky riadky `Stop`, požiadavka sa zruší **len riadkom, ktoré boli `Uploading`** (`L-st:478-488`), `clearQueue`, nový kľúč vstupu (spolu +2). Riadok, ktorý notifikácia usadila počas posielania, dobehne kúsok a skončí pri ďalšej kontrole stavu. | to isté, ale každý riadok dostane aj svoje `stop()` (`D-st:621-625`), takže kúsok na ceste sa zruší každému živému behu; pripína `DT/queue/queueOperations.test.ts` („stopping a queue") | **zblížené** na tvar admin-dam, potvrdené 9. 10. (PV7, Z17): každý živý beh sa zastaví |
| C38 | `clearQueue` | súkromné, len zo `stopUpload`; riadky nezastavuje; frontu, ktorá nie je, nevytvorí (`L-st:506-518`) | verejné; zastaví riadky na ceste a so živým behom (tretia sada, bod 7); frontu, ktorá nie je, vytvorí (`D-st:781-802`); pripína `DT/queue/queueOperations.test.ts` („clearing a queue") | **zblížené** na tvar admin-dam (Z17, Z19): zastaví riadky na ceste a so živým behom; frontu, ktorá nie je, vytvorí. V LIB ho volá len `stopUpload`. |
| C39 | `reset()` | nie je | odhlási fronty z usadzovania a vyprázdni sklad; nič ho nevolá (`D-st:870-873`) | **vlastný kód** DAM, bez zmeny, nad `core.settlement` (prvá sada, bod 9: nechať) |
| C40 | `forceReloadFileInput` | `L-st:493-498` | `D-st:512-515` | **rovnaké** |
| C41 | Čo sklad vystavuje | 18 členov (`L-st:535-554`) | 37 členov vrátane `queues` a vnútorných funkcií (`D-st:875-914`) | **vlastný kód** (zoznamy v časti 3) |
| C42 | Odber notifikácií | v sklade, lenivo s prvým riadkom, v rozsahu skladu; 5 udalostí vrátane `asset_file_copied`; bez `fileId` (`L-st:151-190`) | v aplikácii, `system/composables/appNotificationListeners.ts:27-46`; 4 udalosti, s `fileId` | **vlastný kód** (O13; `noc/lib-krok2b.md`, odchýlky 1 a 8) |
| C43 | Profil usadenia | tabuľka 1.4 | tabuľka 1.4 | **voľba** profilu (hotové v kroku 2); sklad ho dá svojej sade jadra, jadro ho len odovzdá ďalej |
| C44 | Obaly so starými menami | `queueItemProcessed(assetId)`, `queueItemFullyProcessed`, `queueItemDuplicate(assetId, origin, type)`, `queueItemFailed` (`async`) (`L-st:359-377`) | `queueItemProcessed(assetId, fileId)`, `queueItemFailed(assetId, reason, fileId)`, `queueItemMetadataProcessed(assetId)`, `queueItemDuplicate(…, fileId)` (`D-st:739-758`) | **vlastný kód** (jednoriadkové obaly nad `core.settlement`; O8) |
| C45 | Ručné „Obnoviť" | `refreshAsset(assetId)` (`L-st:389-391`) | `refreshQueueItem(item)` so súborom riadku; riadok bez assetu → `'error'` (`D-st:762-766`) | **vlastný kód** (obaly nad `settlement.refreshAsset`) |
| C46 | „Obnoviť" na zlyhanom riadku len tam, kde pomôže | `refreshMayHelp(item)` a množina `refreshable` (`L-st:64,137-140,384-386`) | nie je | **rozhodnuté** (prvá sada, bod 3: len knižnica). Množinu drží jadro, plní ju len so sadou knižnice (príznak `refreshable`); sklad DAM člen nevystaví. |
| C47 | Hromadné operácie: kde sú | composable `useUploadQueueMassOperations(queueKey)` (`L-mo:6-51`) | akcie skladu (`D-st:804-855`) | **rovnaké** navonok. Spoločné čisté funkcie nad riadkami; oba vstupy ostávajú. |
| C48 | Hromadné operácie: vlastné pole | len riadky daného typu assetu; prázdne = nenastavené, `null`, `''`, prázdny zoznam (`L-mo:9-24`) | to isté (`D-st:804-821`) | **rovnaké** |
| C49 | Hromadné operácie: kľúčové slová a autori | do každého riadku (`L-mo:26-44`); pripína `LT/uploadQueueMassOperations.test.ts:92` | len do riadkov, ktorých typ ich má zapnuté (`D-st:825-855`); pripína `DT/queue/lazyMetadata.test.ts:195` | **voľba**: produkt (čo sa uloží pri type, ktorý pole nemá zapnuté), parameter `accepts` pri volaní (knižnica ho nedá; admin-dam `assetTypeHas`) |
| C50 | Hromadné operácie: jedno pole pre všetky riadky | každý riadok dostane ten istý objekt poľa (`L-mo:31,41`); pripína `LT/uploadQueueMassOperations.test.ts:108` | to isté (`D-st:840,852`) | **zblížené**: oprava chyby oboch strán, potvrdené 9. 10. (PV8, Z24); krok F2 po K6 |
| C51 | Uloženie v detaile späť do fronty | `updateFromDetail(asset)`: asset znova prečíta, doplní návrhy mien, konflikty autorov a cache; zlyhané čítanie mlčí (`L-st:429-456`); pripína `LT/uploadQueueOperations.test.ts:658,670` | `updateAssetMetadata(asset)`: skopíruje z odovzdaného objektu, bez požiadavky (`D-st:857-868`); pripína `DT/queue/queueOperations.test.ts` („is written back into every row of that asset, in every queue, with no request") | **vlastný kód** každého skladu, bez zmeny. Spoločné sú len štyri polia (C52); poradie, podmienka riadku, prepočet a cache sa líšia, takže spoločná funkcia by potrebovala vetvy. Po F5 mení admin-dam nález 50 (4.1): uloženie z detailu aj z pravého panela zapíše hodnoty do riadkov toho assetu vždy, nielen pri pohľade `queue`, a po hromadnom uložení sa otvorený panel načíta znova; člen skladu `updateAssetMetadata` sa nemení. |
| C52 | Polia prenesené z detailu | kľúčové slová, autori, vlastné dáta, `mainFileSingleUse` (`L-st:436-440`) | to isté (`D-st:861-864`) | **rozhodnuté** (krok 1, záplata 5) |
| C53 | Riadok fronty pre slot detailu | nie je | `getQueueItemForSlotItem` (`D-st:340-354`) | **vlastný kód** DAM |
| C54 | Zhoda udalosti s riadkom | len podľa assetu (`L-st:115`) | `notificationMatches`: slot podľa súboru, riadok hromadnej úpravy bez súboru len na doplnenie, `Loading` nikdy (`D-st:719-735`) | **voľba** profilu `matches` (krok 2) |
| C55 | Riadok hromadnej úpravy, ktorý zlyhal a potom je v poriadku | nie je | ostane `Failed` a s formulárom zamknutým: hák spracovaného súboru zmaže chybu súboru (`D-st:269-275`), hák metadát zmaže len chybu „metadáta chýbajú" (`D-st:277-282`); zlyhanie zamkne formulár a notifikáciu metadát riadok `Failed` odmietne (`uploadSettle.ts:357,582`); pripína `DT/queue/notificationSettlesQueue.test.ts:220` | **zblížené**: oprava admin-dam, rozhodnutá 9. 10. (PV9, Z29), krok F5 po K6 (`analyzy/pv9-riadok-hromadnej-upravy.md`): hák `onProcessedSeen` vráti riadku stav „hotový" a formulár naraz; riadok, ktorému hromadné načítanie metadáta nedalo, vráti na text „Metadáta sa nepodarilo načítať"; podľa bodu 5 dostane „hotový" aj riadok z `metadataFailures`, ktorému metadáta prinesie notifikácia. Z25 (len stav) ostáva vyradená. V tom istom kroku F-A (nález 49) zapíše do `leftOutByBatch` aj riadok, ktorému hromadné načítanie nedalo formulár, lebo súbor jeho assetu sa ešte spracúva. |
| C56 | Duplikát: čo si riadok pamätá | stane sa originálom; `assetId` aj `duplicateAssetId` sú id originálu, vlastný asset sa stratí (`uploadQueue/settlement/uploadSettle.ts:515,527`) | ostane sebou; `duplicateAssetId` je asset originálu (`uploadSettle.ts:450-451`) | **zblížené**: rozhodnuté 9. 10. (PV10, Z30; `analyzy/pv10-vlastny-asset-duplikatu.md`): nepovinné pole `uploadedAssetId` píše spoločné usadzovanie na oboch stranách, raz, keď riadok označí za duplikát (`markAsDuplicate`, `row.uploadedAssetId ??= row.assetId`). `assetId` ostáva voľbou profilu (produkt); pole v kroku 5 nikto nečíta. Časť 4 ho nepotrebuje: kôš admin-dam je vo vlastnom slote a číta `assetId`, ktorý admin-dam neprepíše; kôš knižnice len odoberá z fronty. |
| C57 | Limity fronty | 50 len vo viacnásobnom widgete (`imageWidget/components/ImageWidgetMultipleLimitDialog.vue:22,57,78`); ostatné vstupy bez limitu | 50 v `asset/components/AssetUpload.vue:70-101`, v `externalProvider/composables/externalProviderAssetImport.ts:29,47` a pri výbere (`maxSelectedItems`) | **rovnaké** miesto: komponenty a composables, nie sklad. Jadro limit nemá a nedostane. |
| C58 | Cache mien autorov a kľúčových slov | `useDamCachedAuthors`, `useDamCachedKeywords` (`L-st:57-58`) | `useCachedAuthors`, `useCachedKeywords` aplikácie (`D-st:171-172`) | **voľba** profilu `caches` (do časti 4). Po ZK20 z návrhu komponentov majú obe strany tú istú cache knižnice (admin-dam cez preposielače pod dnešnými menami), takže člen už rozdiel strán nenesie; ostáva, lebo testy admin-dam nahrádzajú `useCachedAuthors` a `useCachedKeywords` podľa cesty (napríklad `DT/upload/uploadSequence.test.ts:28-31`). |
| C59 | Texty usadenia | `common.damImage.uploadErrors.processingTooLong`, `readFailed`, `unknownError` (`L-st:127-131`) | `system.uploadErrors.processingTooLong` / `processingTooLongSlot`, `metadataFailed`, `unknownError` (`D-st:240-250`) | **voľba** profilu `messages` (krok 2) |
| C60 | Zánik skladu | `settlement.dispose()` v `onScopeDispose` (`L-st:145-147`) | to isté (`D-st:288`) | **rovnaké** → jadro |
| C61 | Výmena za behu vývoja | nie je | `acceptHMRUpdate` (`D-st:916-918`) | **vlastný kód** DAM |
| C62 | Dva sklady nažive v DAM | sklad LIB tam nedostane riadok, nepočúva a nedopytuje (`LT/uploadQueuesStore.test.ts`, „the notifications") | — | **rovnaké**: po kroku 5 dve jadrá, každé so svojím skladom, bez spoločného stavu |
| C63 | Polia riadku `notificationFallbackTimer`, `notificationFallbackTry` | zastarané, nikto ich nečíta (`types/UploadQueue.ts:81-84`); plní ich továreň | to isté | **rovnaké**: ostávajú (verejný typ sa len rozširuje) |
| C64 | Pamäť riadkov slotov odovzdaných dopytovaču a 404 zoznamu slotov | nie je | `handedOver`, `goneAssetWrittenDown`, oboje podľa `toRaw(riadok)` (`D-st:177-215,291-294`) | **vlastný kód** DAM; sada admin-dam dostane `rowTracked` |
| C65 | Upozornenie pri zlyhanom importe | nie je | `showUnknownError()` pri každom zlyhaní okrem duplikátu, ten mlčí (`D-ep:33-49`) | **vlastný kód** DAM; K6 ho nemení. Nález 19 opraví samostatný krok v admin-dam po K6 (4.1): import zastavený počas požiadavky, ktorá potom zlyhá, riadok neoznačí za zlyhaný ani neukáže upozornenie (vetva chyby skontroluje `Stop` ako vetva úspechu, `D-ep:14`). |
| C66 | Prístupné mená tlačidiel hromadných operácií s názvom poľa | bez názvu poľa | bez názvu poľa | **rozhodnuté** (prvá sada, bod 7: áno, v kroku 5). Patrí komponentom (časť 4); funkcie hromadných operácií na to nič nepotrebujú. |
| C67 | Upozornenie pri ručnom „Obnoviť", ktoré nič nezistilo | `uploadQueue/composables/uploadQueueItemRefresh.ts` (`refreshItem`) | `asset/components/queue/AssetQueueEditable.vue` (`refreshItem`) | **rozhodnuté** (tretia sada, bod 3), hotové; mimo skladu aj jadra |
| C68 | Riadok, ktorý notifikácia `failed` usadí ešte počas posielania súboru | upload beží ďalej (slučka kúskov pozná len `Stop`), riadok sa prestane rátať medzi posielané a miesto sa uvoľní hneď: pri limite dvoch idú tri súbory; pripína `LT/uploadNotificationEvents.test.ts` („frees the place of a file that is still being sent for the next one") | to isté; pripína `DT/queue/queueOperations.test.ts` („stops an upload whose row a notification has failed…": `failed, uploading, uploading`, tri kúsky na ceste) | **zblížené**: oprava chyby oboch strán, potvrdené 9. 10. (PV13, Z26); krok F4 po K6 |
| C69 | Hromadné „nahradiť vo všetkých" s prázdnym výberom kľúčových slov alebo autorov | zapíše prázdny zoznam do každého riadku: s `forceReplace` sa píše hodnota, aká príde (`L-mo:30-31,40-41`); pripína `LT0/consumerProfileUploadMassOperations.test.ts:238` („are taken off every row by "replace all" when the form has none picked") | to isté v riadkoch typov, ktoré ich majú zapnuté (`D-st:839-840,851-852`); pripína `DT/queue/massOperationsRows.test.ts:315` („"replace all" takes the keywords and the authors of every row away when the form holds none") | **rozhodnuté** (PV15, 9. 10.): želaný stav, uzavreté. Funkcie z 2.5 píšu, čo dostanú. |

### 1.4 Profil usadenia každého skladu (hotové v kroku 2; v kroku 5 pribudne len nepovinné pole)

Jadro profil neprekladá; sklad ho dá svojej sade jadra a jadro ho odovzdá `createUploadSettlement`. V kroku
PV14a pribudne nepovinné pole `UploadReadOptions.queueKey`, ktoré usadzovanie podá čitateľom (2.4, pravidlo 10);
čitateľ, ktorý ho ignoruje, sa správa ako predtým (admin-dam). V kroku PV10 zapíše usadzovanie pri označení
duplikátu `uploadedAssetId` (C56). Doplní len `queues` a za
hák skladu `onRowFinal` pripojí prepočet a `processUpload`.

| Pole profilu | LIB (`L-st:110-143`) | DAM (`D-st:82-108,219-285`) | Verdikt |
|---|---|---|---|
| `roleOf` | `Asset` → `copy`, inak `upload` | `SlotFile` → `slot`, `Asset` → `massEdit`, `ExternalProviderAsset` → `externalImport`, inak `upload` | **voľba** profilu |
| `policyFor` | každá rola `{ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }` | `slot`: `slots / event / markDuplicate / none`; `massEdit`: `none / never / markDuplicate / load`; ostatné: `asset / event / markDuplicate / load` | **voľba** profilu |
| `readers` | `asset`, `assets`, `duplicateOriginAsset`; od PV14a klienta a adresu vyberú podľa `options.queueKey` (`configOf`) | `asset`, `assets`, `slotFiles`, `duplicateOriginFile`; `queueKey` nečítajú | **voľba** profilu |
| `metadataGate` | nie je | zlyhaný riadok z `metadataFailures` smie dostať metadáta | **vlastný kód** DAM |
| `hooks.onRowFinal` | prepočet, `processUpload` | zabudni „metadáta chýbajú" zlyhaného riadku; prepočet, `processUpload` | **vlastný kód** DAM (zabudnutie); prepočet a `processUpload` za ním pripojí jadro obom |
| `hooks.onAssetRead` | nie je | doplní `mainFile` do otvoreného detailu | **vlastný kód** DAM |
| `hooks.onProcessedSeen`, `afterMetadataLoaded` | nie sú | chyba riadku hromadnej úpravy (C55) | **vlastný kód** DAM |
| `hooks.onRefreshMayHelp` | plní `refreshable` | nie je | **rozhodnuté** (C46); plní jadro, len so sadou knižnice |
| `connection` | `useDamNotificationsConnection()` | to isté | **rovnaké** |

### 1.5 Čo sa píše do riadku a kedy (po zjednotení)

| Pole | Kto | Kedy | Rozdiel strán |
|---|---|---|---|
| `status = Uploading` | služba, `uploadInit` | pred čakaním na hash a pred štartom | žiadny (Z3) |
| `assetId`, `fileId` | služba | po odpovedi štartu s oboma id | žiadny (B6, B7) |
| `currentChunkIndex`, `latestChunkAbortController` | služba | pred prvým pokusom každého kúska | žiadny (B30) |
| `error.message` | služba | validačná odpoveď na kúsok; 400 pri poslednom pokuse | texty každej strany (B22, B25) |
| `status = Processing` | väzba dokončenia každej strany (`damUploadFinish`, `fileApi.uploadFinish`) | po odpovedi 200, len ak je riadok `Uploading` | žiadny (A14) |
| `progress.*` | jadro, `setUploadSpeed` | pri každom hlásení merača | do kroku M základ merania (B15) |
| `error.hasError = true` | jadro | beh zlyhal a riadok nie je `Stop` ani `Uploaded` | žiadny (Z15, Z16) |
| `error.message` pri zlyhaní behu | jadro; text vrátil `onClientFailure` sady admin-dam | hneď po `hasError` | len DAM (C27) |
| `status = Failed`, `canEditMetadata = false` | jadro | hneď potom; v admin-dam až za nimi upozornenie | žiadny |
| `status = Stop` | jadro | `stopItemUpload` a `stopUpload` (každý riadok); `removeByIndex` a `clearQueue` riadku na ceste alebo so živým behom | žiadny (Z17) |
| stav, súbor, náhľad, metadáta, formulár, duplikát, texty „trvá dlho" a „nepodarilo sa načítať" | usadzovanie (krok 2) | čítanie, notifikácia, „Obnoviť" | podľa profilu (1.4) |
| `status`, `error` riadku importu | `D-ep` | odpoveď importu | len DAM (C65) |
| `status = Loading / Uploaded / Failed`, metadáta riadku hromadnej úpravy | sklad DAM | `addByAssets`, `fetchLazyAdditionalMetadata`, `failStillLoading` | len DAM (C15) |

---

## 2. Cieľové súbory a rozhrania

### 2.1 Rozloženie v LIB

| Súbor | Stav | Obsah po kroku 5 |
|---|---|---|
| `api/damImageApi.ts` | bez zmeny | `imageUploadStart`, `imageUploadChunk`, `imageUploadFinish` ostávajú, ako sú (310 riadkov). Vyvážajú sa z `src/lib.ts` (2.6). |
| `api/uploadApi.ts` | mení sa (K1b) | `damUploadFinish` stráca `_endPointAsset` (O15). Pravidlo „len obrázok" a zápis `Processing` po dokončení ostávajú. Asi 75 riadkov (dnes 77). |
| `uploadQueue/composables/uploadService.ts` | mení sa (K2) | `useUpload(item, onProgress?, preset?)` s jedným priebehom pre obe strany, merač, `uploadValidationMessage`, `uploadStop`. Asi 340 riadkov (dnes 312). |
| `uploadQueue/presets/uploadPresets.ts` | nový (K2) | `libraryUploadPreset()` a `adminDamUploadPreset(app)`, typ `UploadPreset`; asi 80 riadkov |
| `uploadQueue/core/uploadQueueCoreTypes.ts` | nový (K4) | typy z 2.4, asi 100 riadkov |
| `uploadQueue/core/uploadQueueCore.ts` | nový (K4) | `createUploadQueueCore(preset)`; asi 330 riadkov |
| `uploadQueue/presets/queuePresets.ts` | nový (K4) | `libraryQueuePreset(store)`, `adminDamQueuePreset(store)`, `adminDamImportRun`, prístup ku kontajneru `Map` a objektu; asi 95 riadkov |
| `uploadQueue/core/uploadQueueFill.ts` | nový (K4) | tri čisté funkcie hromadných operácií (2.5), asi 55 riadkov |
| `uploadQueue/composables/uploadQueueMassOperations.ts` | mení sa (K4) | ostáva vstupom komponentu; volá funkcie z `uploadQueueFill.ts` nad `getQueueItems(queueKey)` |
| `uploadQueue/store/uploadQueuesStore.ts` | mení sa (K5) | tenký sklad (3.1), asi 240 riadkov; `queues` ostáva `Map` |
| `uploadQueue/settlement/uploadSettle.ts`, `types/UploadQueue.ts`, `uploadQueue/factory/UploadQueueItemFactory.ts` | mení sa (krok PV10) | nepovinné pole `uploadedAssetId`; v `uploadSettle.ts` funkcia `markAsDuplicate`, ktorú volajú obe cesty duplikátu (C56) |
| `uploadQueue/composables/uploadMeter.ts` | nový (krok M) | jeden merač (2.3, pravidlo 4), asi 90 riadkov, nevyvezený |
| `uploadQueue/settlement/uploadSettlementTypes.ts`, `uploadSettlement.ts`, `uploadSettle.ts` | mení sa (krok PV14a) | nepovinné `UploadReadOptions.queueKey` a jeho podanie čitateľom pri dopyte, čítaní po notifikácii, „Obnoviť" a originále duplikátu (2.4, pravidlo 10) |
| `src/lib.ts` | rastie | 2.6 |
| ostatné (`damUploadChunkSize.ts`, `uploadQueueItemRefresh.ts`, `useUploadQueueDialog.ts`, `assetSuggestions.ts`, `settlement/*`) | bez zmeny | |

Závislosti idú jedným smerom: `damImageApi.ts` ← `uploadApi.ts` ← `uploadPresets.ts` ← `uploadService.ts` ←
`queuePresets.ts` ← sklad; `uploadQueueCore.ts` nečíta žiadnu sadu (dostane ju) a číta `settlement/*`. Strážny
test `src/test/importCycles.test.ts` („finds none") musí ostať bez výnimky.

### 2.2 Požiadavky (`api/damImageApi.ts`, `api/uploadApi.ts`)

Obe vrstvy dnes existujú a ostávajú na svojom mieste a pod svojimi menami; mení sa len `damUploadFinish`.

```ts
// api/damImageApi.ts, unchanged: the three requests. They do not look at the asset type of the item.
// Public as `damFileUploadStart`, `damFileUploadChunk`, `damFileUploadFinish`.
export const imageUploadStart: (client: () => AxiosInstance, endPoint: string, item: UploadQueueItem) => Promise<unknown>
export const imageUploadChunk: (
  client: () => AxiosInstance,
  endPoint: string,
  item: UploadQueueItem,
  imageId: DocId,
  buffer: Blob | File,
  size: number,
  offset: number,
  onUploadProgressCallback?: (progressEvent: any) => void
) => Promise<unknown>
export const imageUploadFinish: (client: () => AxiosInstance, endPoint: string, item: UploadQueueItem, sha: string) => Promise<unknown>

// api/uploadApi.ts: what the library itself uploads through. Images only, as today.
export const damUploadStart: (client, endPoint, item) => Promise<DamUploadStartResponse> // unchanged
export const damUploadChunk: (client, endPoint, item, imageId, buffer, size, offset, onProgress) => Promise<unknown> // unchanged
/** Writes `Processing` into an item that is still `Uploading` once the server has answered 200. */
export const damUploadFinish: (
  client: () => AxiosInstance,
  endPointImage: string, // O15: `_endPointAsset` in front of it is gone
  item: UploadQueueItem,
  sha: string
) => Promise<unknown>
```

- **Nič sa nesťahuje a nič sa nepremenúva.** Testy, ktoré požiadavky volajú priamo
  (`LT0/damImageApiUploadRequests.test.ts`, `LT0/damImageApiChunkTimeout.test.ts:20`,
  `LT/uploadStopAbortsChunk.test.ts:20`), a štyri testy, ktoré celý modul `damImageApi` podvrhujú (4.3), sa
  nemenia.
- **Pravidlo „len obrázok" ostáva v `uploadApi.ts`** (`L-ua:17-20,41-44,64-67`), v požiadavkách sady knižnice.
  Je to produkt (knižnica nahráva len obrázky). Prípad `LT0/damImageApiUploadRequests.test.ts:163` ostáva a tri
  testy, ktoré modul `uploadApi` podvrhujú podľa cesty a ktorých riadky `assetType` nemajú
  (`LT/uploadStopBetweenChunks.test.ts:21`, `LT/uploadStopWhileHashLoads.test.ts:18`,
  `LT/uploadQueueStartsEachFileOnce.test.ts:31`), prechádzajú ďalej.
- **Kúsok posielajú obe strany tak, ako ho dnes posiela knižnica:** s kontrolami pred odoslaním, s hlásením
  do Sentry a s hlavičkou `'Content-Type': undefined` v nastavení požiadavky (Z1, Z2, potvrdené 9. 10.). **Tento
  riadok (`L-ia:175-177`) musí ostať.** Klient admin-dam má predvolené `'Content-Type': 'application/json'`
  (`admin-dam/src/shared/apiClients/damClient.ts:16`); pod ním by `transformRequest` axiosu `FormData` previedol
  na JSON. `undefined` v nastavení požiadavky pri zlučovaní hlavičiek vyhrá nad predvolenou hlavičkou klienta a
  axios nechá typ aj s hranicou na prehliadač. Dnes to v admin-dam robí jeho `'multipart/form-data'`
  (`D-ia:94-96`). Nastavenie kúska z verzie 4
  (`DamUploadChunkOptions`) zaniklo. Obal kúska v DAM prijme už len `Blob` (A12).
- **`damUploadFinish` stráca `_endPointAsset`** (O15, krok K1b); presný zoznam dotknutých testov je v 4.3.
- **Zápis `Processing` po dokončení** ostáva vo väzbe každej strany (A14): v LIB v `damUploadFinish`
  (`L-ua:72`), v DAM vo `fileApi.uploadFinish` cez `startProcessing` (`D-fa:103-106`).
- **Verejné mená** `damFileUploadStart`, `damFileUploadChunk`, `damFileUploadFinish` sú tie isté tri funkcie z
  `damImageApi.ts`, vyvezené pod menom bez „image", lebo DAM ich volá s adresou každého typu.
- Import od externého poskytovateľa v LIB nie je (A17).

### 2.3 Služba (`uploadQueue/composables/uploadService.ts`) a jej dve sady

```ts
// uploadQueue/presets/uploadPresets.ts
export type UploadSide = 'library' | 'adminDam'
// Not exported from the library: only its own functions put it on a set or a run. Nothing reads it at runtime.
const uploadSide = Symbol('uploadSide')

/** How one side uploads. Made only by `libraryUploadPreset()` and `adminDamUploadPreset()`; what it holds is not public. */
export interface UploadPreset<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
}

/** What a run asks the server. */
export interface UploadRunRequests {
  start(item: UploadQueueItem): Promise<DamUploadStartResponse>
  chunk(
    item: UploadQueueItem,
    fileId: DocId,
    chunk: File,
    size: number,
    offset: number,
    onUploadProgress: (event: AxiosProgressEvent) => void
  ): Promise<unknown>
  finish(item: UploadQueueItem, sha: string): Promise<unknown>
}

/** The texts a run writes into its row. Each side keeps its own. */
export interface UploadMessages {
  unknownError(): string
  /** A field the server refused, by its name. */
  size(): string
  offset(): string
  mimeType(): string
  /** Put before the name of a refused field there is no text for. */
  systemError(): string
  /** HTTP 400 on the last try of a chunk. */
  chunkValidationFailed(): string
}

export interface UploadHash {
  update(data: ArrayBuffer): unknown
  digest(encoding: 'hex'): string
}

/**
 * Not exported from `src/lib.ts`; the default of `useUpload`. The library's API, texts and choices, under the DAM
 * configuration `configName` (step PV14a; until then always `default`).
 */
export function libraryUploadPreset(configName?: string): UploadPreset<'library'>

/** admin-dam's API, texts and choices. What is the application's own, the application hands in. */
export function adminDamUploadPreset(app: {
  /** `uploadStart`, `uploadChunk`, `uploadFinish` of `fileApi.ts`: four asset types, admin-dam's addresses. */
  requests: UploadRunRequests
  /** `system.uploadErrors.*`; as `chunkValidationFailed` its `unknownError`, which its store writes today. */
  messages: UploadMessages
  /** `envConfig.dam.apiTimeout`. */
  apiTimeout: number | null | undefined
  /** `() => Promise.resolve(rusha.createHash())`: rusha stays a static import of admin-dam. */
  loadHash(): Promise<UploadHash>
}): UploadPreset<'adminDam'>

export type UploadProgressCallback = (progress: number, speed: number, estimate: number) => void

export interface UploadRun<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  uploadInit(): Promise<unknown>
  upload(): Promise<unknown>
  /** Stops the run wherever it is, and cancels the chunk on the wire. */
  stop(): void
  /** Whether the finish request went out: the server may complete the file whatever became of the answer. */
  finishAttempted(): boolean
}

// uploadQueue/composables/uploadService.ts; public as `useDamUpload`
// Two overloads (posudok K2, 9. 10.): a run without a set is the library's, and only a set names another side.
export function useUpload(
  queueItem: UploadQueueItem,
  uploadCallback?: UploadProgressCallback,
  preset?: undefined
): UploadRun<'library'> & { stopSpeedCheck(): void }
export function useUpload<S extends UploadSide>(
  queueItem: UploadQueueItem,
  uploadCallback: UploadProgressCallback | undefined,
  preset: UploadPreset<S>
): UploadRun<S> & { stopSpeedCheck(): void }

/** The text of a validation answer (422 with `fields`): one line per field, in the texts of the side. */
export function uploadValidationMessage(error: unknown, messages: UploadMessages): string

export const uploadStop: (abortController: AbortController) => void
```

**Dve sady služby** (každý člen je produkt alebo väzba na aplikáciu):

| Člen | Druh | `libraryUploadPreset()` | `adminDamUploadPreset(app)` | Prečo ostáva na každej strane | Riadky |
|---|---|---|---|---|---|
| `requests` | funkcie | `damUploadStart/Chunk/Finish` z `api/uploadApi.ts` (len obrázok) s klientom a `endPointImage` konfigurácie `default` | od aplikácie: obaly `fileApi.ts`, štyri typy | iné API a typy assetov | A4 až A6, B32 |
| `messages` | funkcie | `common.damImage.uploadErrors.*` | od aplikácie: `system.uploadErrors.*` | texty | B22, B25 |
| `apiTimeout` | hodnota | voľba pluginu `coreDam.apiTimeout`, bez nej 30 | od aplikácie: `envConfig.dam.apiTimeout` | konfigurácia aplikácie | B27 |
| `loadHash` | funkcia | lenivé `rusha`, najviac 15 s | od aplikácie: hash z jej statického `rusha` | balík aplikácie (knižnica nechce `rusha` na každej stránke) | B2 |
| `emptyFile` | hodnota | `'reject'` | `'send'` | čo sa pošle na backend: prázdny súbor | B5 |
| `speedBaseline` | hodnota | `'upload'` | `'attempt'` | dočasne, od K2 po krok M: vtedy ju nahradí jeden merač (Z28) a zo sád zmizne | B15 |

**Jeden priebeh pre obe strany** (pri každom kroku, ktorej strany je tvar; Z = položka registra v časti 6):

```
useUpload(item, report, preset = libraryUploadPreset())
  stopped() = stopRequested || item.status === Stop                              // Z5

uploadInit
  sendable = item.file && (preset.emptyFile === 'send' || item.file.size > 0)
  if (sendable) item.status = Uploading                                          // Z3: before the wait, both
  sha = await preset.loadHash()                                                  // Z3
  if (stopped()) throw new Error('Upload stopped')                               // Z5
  return new Promise((resolve, reject) =>
    if (!sendable) → reject(no file ? <admin-dam's text> : new Error('Empty file'))   // Z4
    fileSize = item.file.size; item.status = Uploading
    preset.requests.start(item)
      .then(res →
        if (!res?.id || !res?.asset) → reject(new Error(<admin-dam's text>))     // B6, Z4
        item.assetId = res.asset; item.fileId = res.id
        if (stopped()) → reject(new Error('Upload stopped'))                     // Z5
        resolve(item))
      .catch(reject))

upload
  if (report) meter.start()
  try
    if (filesize undefined || sha undefined) throw undefined                     // Z3, Z10: inside, so the meter stops
    if (stopped()) throw stop error
    i = 0
    while (i < filesize)
      if (stopped()) throw stop error                                            // Z5
      chunk = await processAndUploadChunk(i); i += chunk.size; progress = i / filesize * 100
    meter.lastChunkSent()                                                        // Z9: no tick planned after this one
    if (stopped()) throw stop error
    finishAttempted = true
    return await preset.requests.finish(item, sha.digest('hex'))
  catch (e)
    meter.stop()                                                                 // Z10
    throw e

processAndUploadChunk(offset)
  if (stopped()) reject stop error                                               // Z5
  updateChunkSize(item.progress.speed)
  data = await readFile(offset, lastChunkSize.value, item.file)                  // Z8: not an ArrayBuffer → fails
  chunk = new File([data], item.file.name, { type: item.file.type })             // Z27: typed, as the library
  if (stopped()) reject stop error
  item.currentChunkIndex = offset; item.latestChunkAbortController = new AbortController()
  pause = 1000; attempt = 0
  do
    attempt++
    if (preset.speedBaseline === 'attempt' || attempt > 1) meter.newBaseline()   // step M: onProgress = meter.attempt(chunk.size, attempt > 1)
    try
      if (!item.fileId) throw undefined                                          // Z7: no request
      await preset.requests.chunk(item, item.fileId, chunk, chunk.size, offset, meter.progress)
      sha.update(data); return chunk
    catch (error)
      if (axios.isCancel(error) || stopped()) return Promise.reject(error)       // Z6
      last = attempt >= 4
      if (last && error is axios 400) { item.error.message = preset.messages.chunkValidationFailed(); reject(error) }   // Z11
      if (validation answer) { item.error.message = uploadValidationMessage(error, preset.messages); reject(error) }  // Z12
      if (last) break                                                            // Z6
      if (updateChunkSize(item.progress.speed)) { data = await readFile(…); chunk = new File(…) }
      await sleep(pause)
      if (stopped()) return Promise.reject(new Error('Upload stopped'))          // Z5
      pause *= 3
  while (attempt < 4)
  return Promise.reject('Unable to upload chunk, max tries exceeded')

stop(): stopRequested = true; meter.stop(); item.latestChunkAbortController?.abort()
```

Pravidlá:

1. **Predvolená sada sa robí, len keď volajúci žiadnu nedá.** `libraryUploadPreset()` číta
   `useCommonAdminCoreDamOptions()` a `useCommonAdminCoreDamOptionsGlobal()`, ktoré bez nastaveného pluginu hodia
   výnimku (staršie testy DAM plugin neinštalujú). DAM dáva vždy svoju sadu, takže sa nezavolajú.
2. **Pomenovaná konfigurácia (PV14, rozhodnuté 9. 10.: plná podpora; krok PV14a po U6/U7, pred C3).** Do PV14a
   používa sada knižnice konfiguráciu `default`, ako dnes (nález 23). V PV14a: `libraryUploadPreset(configName =
   'default')` číta `useCommonAdminCoreDamOptions(configName)`; sada jadra knižnice dostane od skladu
   `configOf(queueKey)` a jej `runnerFor(item, queueKey)` vráti `useUpload(item, cb, libraryUploadPreset(configOf(queueKey)))`
   (2.4). `apiTimeout` ostáva koreňová voľba pluginu. Sada admin-dam sa nemení (admin-dam má jednu konfiguráciu).
   **Obmedzenie:** všetky konfigurácie jednej stránky hovoria s tým istým core-dam; notifikácie (jeden socket),
   cache mien, sklad konfigurácie DAM, výberu a detailu sú spoločné pre stránku. Konfigurácia je iný klient alebo
   iné adresy toho istého DAM (`/adm` popri `/ugc`). Cache mien na konfiguráciu (PV14c) príde až vtedy, keď ju
   niektorá aplikácia bude potrebovať.
3. **Spoločný kód má dve vetvy podľa sady** (`emptyFile`, `speedBaseline`), každú na jednom mieste, a druhá
   zanikne v kroku M. Ostatné rozdiely strán sú požiadavky, texty a väzby.
4. **Merač.** Od K2 po krok M platí dnešný vzorkovač: vzorka, priemer posledných 15, odhad a tik raz za sekundu
   sú na oboch stranách rovnaké (B18); základ určuje dočasná hodnota `speedBaseline`; prvá vzorka po novom základe
   ráta aj bajty pred prvou udalosťou (B16). **Krok M (po K6, rozhodnutie vlastníka 9. 10.) ho nahradí jedným
   meračom** (`analyzy/meranie-rychlosti.md`, časť 4; nový nevyvezený súbor `uploadQueue/composables/uploadMeter.ts`,
   asi 90 riadkov): merač sleduje jednu krivku „odoslané bajty súboru v čase" od prvého kúska po posledný. Základ
   zapíše pri odoslaní každej požiadavky kúska (tým zaniká F1 aj riziko R1), ďalšie body dajú udalosti priebehu
   (bajty na ceste ako `loaded / total × veľkosť kúska`) a odpoveď servera na kúsok; po zlyhanom pokuse krivka začne
   odznova. Rýchlosť sú bajty za posledných 10 s (okraj okna sa interpoluje); platí, len ak úsek má aspoň 0,5 s alebo
   v ňom server odpovedal. Percentá rátajú aj bajty na ceste a nikdy neklesnú; zvyšný čas je
   `ceil((veľkosť − odoslané) / rýchlosť)`. Hlásenie ostáva tik raz za sekundu, prvý hneď, len s platnou rýchlosťou.
   V službe nahradí riadok so `speedBaseline` volanie `meter.attempt(chunk.size, attempt > 1)` a po úspechu
   `meter.chunkDone(chunk.size)`; `speedBaseline` zo sád zmizne. Nepridá žiadny časovač okrem tiku (pravidlo 6).
   `setUploadSpeed`, `UploadProgressCallback` ani `useDamUploadChunkSize` sa nemenia; veľkosť kúska ďalej číta
   `progress.speed`. Testy podľa analýzy (časť 5): v knižnici sa menia dva prípady `LT/uploadServiceRetry.test.ts`
   (čísla, zmysel ostáva), v admin-dam `DT/upload/uploadSequence.test.ts` („says how far the file is…") a
   `DT/upload/uploadStop.test.ts` („measures a retried chunk…"), prípad `uploadSequence.test.ts:192-201` sa premenuje; pribudne
   `LT/uploadMeter.test.ts` s asi 10 prípadmi. D4 (tvar DAM pre meranie) je tým nahradené.
   Pred aj po kroku M: po poslednom kúsku sa ďalší tik neplánuje a ten, ktorý už je naplánovaný, ohlási 100 % a
   0 s, ak už je známa rýchlosť (Z9). Pri každom neúspechu, aj pri `upload()` bez `uploadInit()`, a pri `stop()`
   služba časovač zruší sama (Z10); `stopSpeedCheck` ostáva vo vrátenom objekte, ale nikto ho nepotrebuje.
5. **Texty.** `uploadValidationMessage(error, messages)` je jedna funkcia s textami strany, v tvare admin-dam
   (vstup, ktorý nie je chyba axiosu, dá `messages.unknownError()`; Z12): bez odpovede alebo bez polí vráti
   `messages.unknownError()` (pripína `DT/upload/uploadErrorMessage.test.ts`, štyri prípady).
   admin-dam ju volá aj vo svojom `resolveUploadErrorMessage`.
6. **Na celej ceste od `processUpload` po dokončenie nepribudne časovač s 0 ms ani dynamický import**
   (`overenia.md`, J-12 a J-13). `DT/upload/uploadSequence.test.ts:84-93` po jedinom
   `advanceTimersByTimeAsync(0)` tvrdí štart, tri kúsky aj dokončenie; pod falošným časom by časovač
   naplánovaný počas posunu dostal +1 ms a dynamický import nedobehol, takže test by niektorú z týchto
   požiadaviek nevidel. Platí to aj pre požiadavku kúska knižnice, ktorú admin-dam preberá v K3
   (`imageUploadChunk`): lenivý import Sentry je v nej len na ceste odmietnutého kúska a odpovede 400
   (`L-ia:75-169,190-211`), nie na bežnej. Počet `await` je voľný. Hash admin-dam je preto už vyriešený sľub (Z3).
7. **Knižnica volá `axios.isAxiosError` a `axios.isCancel` cez predvolený export**, ako dnes. Podvrh
   pomenovaného `isAxiosError` v `DT/upload/uploadStop.test.ts:25` ju nezasiahne; v tom súbore žiadny prípad
   nečaká text z polí.

### 2.4 Jadro fronty (`uploadQueue/core/`) a jeho dve sady

```ts
/** What a store hands its core. Made only by `libraryQueuePreset()` and `adminDamQueuePreset()`. */
export interface UploadQueuePreset<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
}

/** The settlement profile of a store (step 2). The core adds `queues` and, after `hooks.onRowFinal`, counts the queue and starts the next row. */
export type UploadQueueSettlementProfile = Omit<UploadSettlementProfile, 'queues' | 'hooks'> & {
  hooks?: Partial<UploadSettlementProfile['hooks']>
}

// Not exported from `src/lib.ts`: only the library store uses it.
export function libraryQueuePreset(store: {
  queues: Ref<Map<UploadQueueKey, UploadQueue>>
  settlement: UploadQueueSettlementProfile
  /** Step PV14a: the DAM configuration the queue was made under; `'default'` for a queue the store does not know. */
  configOf?(queueKey: UploadQueueKey): string
}): UploadQueuePreset<'library'>

/** admin-dam's queue: what it shows and does that the library does not. The store hands in what is its own. */
export function adminDamQueuePreset(store: {
  queues: Ref<Record<UploadQueueKey, UploadQueue>>
  settlement: UploadQueueSettlementProfile
  /** `useUpload` of admin-dam's `uploadService.ts`. */
  upload(item: UploadQueueItem, onProgress: UploadProgressCallback): UploadRun<'adminDam'>
  /** The run of an `ExternalProviderAsset` row: `adminDamImportRun(externalProviderImport(item).importInit)`. */
  importRun(item: UploadQueueItem): UploadRun<'adminDam'>
  /** `resolveUploadErrorMessage`: the text of a failed upload. */
  failureMessage(error: unknown): string
  /** `showError` of the store's `useAlerts()`: one alert per reason. */
  alert(message: string): void
  /** `handedOver.add(toRaw(item))`. */
  rowTracked(queueKey: UploadQueueKey, item: UploadQueueItem): void
  /** `metadataFailures.delete(metadataFailureKey(queueKey, item))`. */
  rowRemoved(queueKey: UploadQueueKey, item: UploadQueueItem): void
}): UploadQueuePreset<'adminDam'>

/** The run of an import: its request is all there is; `upload` and `stop` do nothing, never `finishAttempted`. */
export function adminDamImportRun(uploadInit: () => Promise<unknown>): UploadRun<'adminDam'>

export function createUploadQueueCore<S extends UploadSide>(preset: UploadQueuePreset<S>): UploadQueueCore

export interface UploadQueueCore {
  settlement: UploadSettlement
  roleOf(item: UploadQueueItem): UploadRowRoleType

  getQueue(queueKey: UploadQueueKey): UploadQueue | null
  getQueueItems(queueKey: UploadQueueKey): UploadQueueItem[]
  getQueueItemsByStatus(queueKey: UploadQueueKey, status: UploadQueueItemStatusType): UploadQueueItem[]
  getQueueTotalCount(queueKey: UploadQueueKey): number
  getQueueProcessedCount(queueKey: UploadQueueKey): number
  getQueueFileInputKey(queueKey: UploadQueueKey): number
  getQueueItemsTypes(queueKey: UploadQueueKey): DamAssetTypeType[]

  /** `prefix` and a number no other row of this page has. */
  uniqueKey(prefix: string): string
  createQueue(queueKey: UploadQueueKey): void
  addQueueItem(queueKey: UploadQueueKey, item: UploadQueueItem): void
  /** Makes the queue if need be, adds the row, counts, starts what may start. */
  addRow(queueKey: UploadQueueKey, item: UploadQueueItem): void
  recalculateQueueCounts(queueKey: UploadQueueKey): void
  setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number): void
  forceReloadFileInput(queueKey: UploadQueueKey): void

  processUpload(queueKey: UploadQueueKey): void
  queueItemUploadStart(item: UploadQueueItem, queueKey: UploadQueueKey): Promise<void>
  track(queueKey: UploadQueueKey, item: UploadQueueItem, options?: { clientFailed?: boolean }): void

  removeByIndex(queueKey: UploadQueueKey, index: number): void
  stopItemUpload(queueKey: UploadQueueKey, item: UploadQueueItem): void
  stopUpload(queueKey: UploadQueueKey): void
  clearQueue(queueKey: UploadQueueKey): void

  /** Whether a refresh may still change a failed row. Filled only with the library's preset. */
  refreshMayHelp(item: UploadQueueItem): boolean
}

export const UPLOAD_QUEUE_ITEM_CHUNK_SIZE = 10485760
```

**Dve sady jadra:**

| Člen | Druh | `libraryQueuePreset(store)` | `adminDamQueuePreset(store)` | Prečo ostáva na každej strane | Riadky |
|---|---|---|---|---|---|
| `queues` | stav skladu | `Map` (`Map.get`) | objekt (`in`) | stav skladu; zblížiť by stálo prepis testov DAM | C1, C3 |
| `settlement` | profil (krok 2) | profil knižnice | profil admin-dam | sloty, hromadná úprava, čitatelia, texty | 1.4 |
| `runnerFor` | funkcia | vždy `useUpload` so sadou knižnice | `importRun` pre riadok `ExternalProviderAsset`, inak `upload` | import je len v admin-dam | C21 |
| `onClientFailure` | funkcia | nie je | text od skladu a upozornenie, jedno na dôvod | text a upozornenie ukazuje len admin-dam | C27 |
| `rowTracked`, `rowRemoved` | funkcie | nie sú | od skladu | evidencia slotov a hromadnej úpravy, ktoré má len admin-dam | C64, C16 |
| `refreshable` | príznak | `true` | `false` | „Obnoviť" ponúka len knižnica | C46 |

Pravidlá (pri každom je, odkiaľ je tvar):

1. **Fronty.** Jadro fronty nedrží; každé čítanie a zápis ide cez kontajner sady, ktorý číta stav skladu v tom
   okamihu. Kľúče `toString`, `__proto__`, `hasOwnProperty` sa v LIB správajú ako každý iný; v DAM platí dnešné
   obmedzenie (C3). `createQueue`, `getQueue`, `getQueueItems`, počty, `getQueueFileInputKey`,
   `getQueueItemsTypes`, `forceReloadFileInput` sú jeden kód. `addQueueItem` a `recalculateQueueCounts` nad
   frontou, ktorá nie je, nerobia nič (Z13).
2. **`addRow`** = `createQueue`, vlož, `recalculateQueueCounts`, `processUpload` (C13). Sklady si nechávajú
   svoje slučky `for await` nad súbormi a volajú `addRow` pre každý riadok. Kľúč riadku dá `uniqueKey` (Z22).
3. **`processUpload`** ako dnes (C20), konštanta 2: ráta riadky `Uploading`. Preto platí aj C68 až do opravy
   F4 (PV13).
4. **`queueItemUploadStart(item, queueKey)`**:
   ```
   let run
   try
     run = preset.runnerFor(item, queueKey)(item, (p, s, e) => setUploadSpeed(item, p, s, e))   // PV14a-c1: inside `try`
     stopHandles.set(item, run.stop)                                             // Z21: as admin-dam
     await run.uploadInit(); await run.upload()                                  // Z20: an import has an empty upload
     stopHandles.delete(item)
     if (item.status === Processing) track(queueKey, item)
     recalculateQueueCounts(queueKey); processUpload(queueKey)                   // Z14
   catch (error)
     stopHandles.delete(item)
     if (item.status === Stop || item.status === Uploaded) return                // Z15, Z16 (admin-dam)
     if (item.status === Failed) return                                          // F4 (Z26): failed by the server
     failure = preset.onClientFailure?.(queueKey, item, error)                   // admin-dam: text and alert
     item.error.hasError = true
     if (failure) item.error.message = failure.message
     item.status = Failed; item.canEditMetadata = false
     failure?.alert()                                                            // after the row is marked, as today
     if (run?.finishAttempted() && !isRefusal(error)) track(queueKey, item, { clientFailed: true })
     recalculateQueueCounts(queueKey); processUpload(queueKey)
   ```
   Stav po F4 a PV14a-c1 (pôvodne sa beh vyrábal pred `try` a `catch` rátal `failedByServer`). Od opravy F4 (Z26)
   riadok, ktorý zlyhal od servera, jadro nechá tak (nevolá `onClientFailure`, nič nezapíše). Od PV14a-c1 sa beh
   vyrába vnútri `try`: sada, ktorá ho vyrobiť nevie, zlyhá riadok ako neúspešný upload, a `run` môže byť v `catch`
   prázdny (`run?.finishAttempted()`).
   `onClientFailure` sady admin-dam si text a to, či už ten dôvod niekto ohlásil, prečíta skôr, než jadro
   čokoľvek zapíše (`D-st:691-695`), a upozornenie pošle až potom; poradie zápisov je dnešné poradie admin-dam a
   v knižnici (bez háku) dnešné poradie knižnice. `isRefusal` je jedna funkcia (obe dnešné sú rovnaké).
5. **Ako riadok odchádza** (jedno pravidlo, Z17; „živý beh" = riadok má záznam v registri):

   | Cesta | Čo sa stane |
   |---|---|
   | `removeByIndex` | fronta alebo riadok nie je: nič. Riadok na ceste (`Waiting`, `Uploading`, `Processing`) alebo so živým behom: `Stop`, `untrack`, `stop()` behu (zruší aj kúsok na ceste), zrušenie `latestChunkAbortController`. Usadený riadok bez behu: len `untrack`, stav ostane. Potom `rowRemoved`, `splice`, prepočet a `processUpload` (Z15). |
   | `stopItemUpload` | fronta nie je alebo je prázdna: nič. Inak riadok `Stop`, `untrack`, `stop()` behu, zrušenie požiadavky; odstránenie podľa identity cez `removeByIndex`; `processUpload`. Synchrónne (Z18). |
   | `stopUpload` | fronta nie je: nič; prázdna: len `dropQueue`. Inak každý riadok `Stop` (obe strany dnes) a `stop()` svojho behu; zrušenie požiadavky riadkom, ktoré boli `Uploading`; `clearQueue`; `forceReloadFileInput`. |
   | `clearQueue` | pre každý riadok `rowRemoved`; riadok na ceste alebo so živým behom: `Stop`, `stop()`, zrušenie požiadavky; `dropQueue`; nová prázdna fronta s kľúčom vstupu o jeden vyšším, aj keď predtým nebola (Z19). |
   | beh zlyhá a riadok je `Stop` | nič (Z15) |
   | beh zlyhá a riadok je `Uploaded` | nič (Z16) |

   Sklad DAM vystavuje `removeByIndex` a `stopItemUpload` ako `async` (obal jedného riadku), ako dnes.
   `stopUpload`, `clearQueue` a telo `removeByIndex` sú synchrónne až po svoje zápisy, ako dnes v admin-dam
   (`D-st:555-570,612-635,781-802`): testy `DT/queue/slotUploadRow.test.ts:235-243`,
   `DT/queue/slotsOverlay.test.ts:127-130` a `DT/queue/overlaySave.test.ts:510-520` po nich čakajú jediný
   `nextTick` (`overenia.md`, J-13), a `DT/queue/queueRefresh.test.ts:348-349` hneď po `removeByAssetId` (bez
   čakania) tvrdí, že riadok už vo fronte nie je.
6. **`track`**: `rowTracked` sady, ak je, potom `settlement.track`.
7. **Háky dostávajú riadok tak, ako ho drží fronta, teda reaktívny objekt.** Kto si z háku pamätá identitu
   riadku, musí použiť `toRaw(item)`; sklad DAM to tak robí už dnes (`D-st:188-195,292`). Register behov je
   kľúčovaný riadkom, ako ho jadro dostane, ako dnes v admin-dam (Z21).
8. **Usadzovanie.** Jadro ho vytvorí z profilu sady a pri zániku rozsahu skladu zavolá `dispose()` (C60). Za
   hák profilu `onRowFinal` pripojí prepočet a `processUpload`. So sadou knižnice obalí aj `onRefreshMayHelp`,
   ktorý plní reaktívnu `WeakSet` jadra (`L-st:137-140`).
9. **V jadre nie sú** upozornenia, preklady, konfigurácia ext systému, aktuálna licencia (zásada 1 z 0.2), zápis
   uloženého detailu (C51, produkt: každý sklad svoj), `removeByAssetId`, `removeByExternalProviderAssetId` a
   `reset` (vlastný kód DAM).
10. **Pomenovaná konfigurácia v jadre a usadzovaní (krok PV14a).** Jadro meno konfigurácie nečíta. Sada jadra
    knižnice dostane od skladu `configOf(queueKey)` a vyberie podľa neho sadu služby pre beh riadku (2.3, pravidlo
    2). Usadzovanie dostane nepovinné `UploadReadOptions.queueKey` a podá ho čitateľom: dopyt fronty kľúč svojej
    fronty (jednotky dopytu sú vždy z jednej fronty), čítanie po notifikácii a „Obnoviť" kľúč prvého dotknutého
    riadku (pri „Obnoviť" spočítaný pred čítaním), originál duplikátu `duplicateOriginAsset(originFileId, options?)`
    kľúč prvého kandidáta. Riadok bez fronty dostane `'default'`. Asset v dvoch frontách rôznych konfigurácií sa
    prečíta raz, cez prvú (jeden core-dam). Testy usadzovania z volieb čítajú len `report`, nové pole ich
    nezasiahne; sada admin-dam ani sklad DAM sa nemenia. Vyvezený typ `UploadReadOptions` len pribudne.

### 2.5 Hromadné operácie (`uploadQueue/core/uploadQueueFill.ts`)

```ts
export function fillCustomDataValue(
  items: UploadQueueItem[],
  data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue },
  forceReplace?: boolean
): void

export function fillKeywords(
  items: UploadQueueItem[],
  value: DocId[],
  forceReplace?: boolean,
  accepts?: (item: UploadQueueItem) => boolean
): void

export function fillAuthors(
  items: UploadQueueItem[],
  value: DocId[],
  forceReplace?: boolean,
  accepts?: (item: UploadQueueItem) => boolean
): void
```

Čisté funkcie nad zoznamom riadkov; čítajú len `assetType`, `customData`, `keywords`, `authors`, takže im
stačia aj holé riadky, aké sejú testy DAM (`DT/queue/lazyMetadata.test.ts:142,187`). Telá sú na oboch stranách
dnes rovnaké (`L-mo:9-44`, `D-st:804-855`). LIB composable ich volá nad `getQueueItems(queueKey)` bez
`accepts`. Sklad DAM ich volá nad `queues.value[queueId].items` s `accepts = (item) => enabled(item.assetType)`
zo svojho `assetTypeHas` (produkt: čo sa uloží, C49). Každý riadok dostane ten istý objekt poľa ako dnes až do
opravy F2 (PV8); prázdny výber pri „nahradiť" vyprázdni zoznamy ako dnes (C69, PV15).

### 2.6 Exporty z `src/lib.ts` (len pribúdajú)

| Export | Krok | Pre koho |
|---|---|---|
| `damFileUploadStart`, `damFileUploadChunk`, `damFileUploadFinish` (verejné mená funkcií `imageUploadStart`, `imageUploadChunk`, `imageUploadFinish`) | K1a | obaly `fileApi.ts` v DAM |
| `useDamUpload` (verejné meno funkcie `useUpload`), `adminDamUploadPreset`, `uploadValidationMessage`, `uploadStop`; typy `UploadSide`, `UploadPreset`, `UploadRun`, `UploadRunRequests`, `UploadMessages`, `UploadHash`, `UploadProgressCallback` | K2 | väzba v `uploadService.ts` v DAM |
| `createUploadQueueCore`, `adminDamQueuePreset`, `adminDamImportRun`, `UPLOAD_QUEUE_ITEM_CHUNK_SIZE`; typy `UploadQueueCore`, `UploadQueuePreset`, `UploadQueueSettlementProfile` | K4 | sklad DAM |
| `uploadQueueFillCustomDataValue`, `uploadQueueFillKeywords`, `uploadQueueFillAuthors` (verejné mená troch funkcií z 2.5) | K4 | sklad DAM |

Nevyvážajú sa `libraryUploadPreset`, `libraryQueuePreset` ani značka strany. Sklad LIB sa neexportuje ani teraz.
`useDamUploadChunkSize` ostáva exportované, hoci ho DAM prestane importovať.

**Prečo `useDamUpload` ide von už v K2** (Opus W2): potrebuje ho väzba admin-dam v K3, a tá beží nad knižnicou
skopírovanou po K2. Dnes taký export nie je, takže nemá volajúcich.

`src/test/publicExportsAdded.test.ts` dostane tvrdenia o nových menách; strážny test
`src/test/publicExportsDamConsumers.test.ts` (mená, ktoré importujú CMS a UGC) musí ostať zelený bez úpravy.

### 2.7 Čo ostane z každého súboru DAM, a dve odchýlky od plánu

| Súbor | Dnes | Potom | Čo ostane |
|---|---|---|---|
| `asset/api/imageApi.ts` | 337 | asi 195 | všetko okrem `uploadStart`, `uploadChunk`, `uploadFinish`, `uploadFailed`, `externalProviderUpload`, `CHUNK_UPLOAD_TIMEOUT` |
| `asset/api/audioApi.ts`, `documentApi.ts` | 307 | asi 185 | to isté bez `uploadFailed` |
| `asset/api/videoApi.ts` | 326 | asi 205 | to isté |
| `asset/api/fileApi.ts` | 485 | asi 345 | riadky `:63-240` nahradí asi 40 riadkov nižšie (`startProcessing` ostáva); rozvetvenia, ktoré nie sú upload (`unsetAssetSlot` až `makePrivateFile`, `:242-485`), ostávajú |
| `shared/services/upload/uploadService.ts` | 311 | asi 95 | texty DAM, `handleForbiddenOperationMessage`, `resolveUploadErrorMessage`, väzba sady, `uploadStop` |
| `shared/services/upload/externalProviderImportService.ts` | 57 | 57 | bez zmeny v krokoch K; po K6 pribudne kontrola `Stop` vo vetve chyby (nález 19, 4.1) |
| `shared/services/upload/uploadQueueIds.ts`, `fileValidation.ts` | 3, 59 | bez zmeny | (`fileValidation.ts` je vec časti 4) |
| `asset/store/uploadQueuesStore.ts` | 918 | asi 470 | 3.2 |

`fileApi.ts`, časť uploadu po kroku K3 (tvar, nie konečný kód):

```ts
const UPLOAD_END_POINT: Partial<Record<DamAssetTypeType, string>> = {
  [DamAssetType.Image]: '/adm/v1/image',
  [DamAssetType.Audio]: '/adm/v1/audio',
  [DamAssetType.Video]: '/adm/v1/video',
  [DamAssetType.Document]: '/adm/v1/document',
}

// Every request below rejects on a type it does not cover: the promise would otherwise never settle.
const toEndPoint = <T>(item: UploadQueueItem, send: (endPoint: string) => Promise<T>) => { … }
//   → Promise.reject(new Error(`fileApi: unsupported asset type '${item.assetType}'`))

export const uploadStart = (item) =>
  toEndPoint(item, (endPoint) => damFileUploadStart(damClient, endPoint, item) as Promise<DamUploadStartResponse>)
// Sent as the library sends it (Z1, Z2): checked first, reported to Sentry, no type named.
export const uploadChunk = (item, fileId, buffer: Blob, size, offset, onProgress) =>
  toEndPoint(item, (endPoint) => damFileUploadChunk(damClient, endPoint, item, fileId, buffer, size, offset, onProgress))
// `startProcessing` stays as it is (`D-fa:103-106`): only an item that is still `Uploading`.
export const uploadFinish = (item, sha) =>
  toEndPoint(item, (endPoint) =>
    damFileUploadFinish(damClient, endPoint, item, sha).then((res) => {
      startProcessing(item)
      return res
    })
  )
export const externalProviderUpload = (item) => toEndPoint(item, (endPoint) => /* POST …/external-provider, 201 */)
```

`uploadService.ts` po kroku K3:

```ts
const messages: UploadMessages = {
  unknownError: () => t('system.uploadErrors.unknownError'),
  size: …, offset: …, mimeType: …, systemError: …,
  // The store writes its own text over it, as today: the text a user sees does not change.
  chunkValidationFailed: () => t('system.uploadErrors.unknownError'),
}

export const resolveUploadErrorMessage = (error: unknown) => { /* forbidden → …; validation →
  uploadValidationMessage(error, messages); else unknownError */ }

export const useUpload = (queueItem: UploadQueueItem, uploadCallback?: UploadProgressCallback) =>
  useDamUpload(
    queueItem,
    uploadCallback,
    adminDamUploadPreset({
      requests: { start: uploadStart, chunk: uploadChunk, finish: uploadFinish },   // from fileApi
      messages,
      apiTimeout: envConfig.dam.apiTimeout,
      loadHash: () => Promise.resolve(rusha.createHash()),
    })
  )

export { uploadStop }
```

**Dve vedomé odchýlky od plánu (krok 5, body 1 a 2).**

1. Plán hovorí, že `uploadService.ts` v DAM „zanikne" a že kód uploadu zanikne vo `fileApi.ts:73-294`. Tu
   zaniká kód, ale súbory ostávajú ako väzba DAM. Dôvody: (a) texty a `resolveUploadErrorMessage` sú vec DAM;
   (b) sedem testovacích súborov DAM je naviazaných na tieto cesty (4.4); s väzbou ostávajú nezávislým svedkom
   presunu; (c) každý krok tak končí zelený bez prepisu testov uprostred. Rozhodnuté vedúcim 8. 10.: väzby
   ostávajú. Úplný zánik je voliteľný krok K7b, v ktorom sa mení len umiestnenie asi 135 riadkov a testy.
2. Plán hovorí, že v LIB „zanikne zvyšok `api/uploadApi.ts`". Tu ten súbor ostáva väzbou knižnice s pravidlom
   „len obrázok", ktoré je produkt (knižnica nahráva len obrázky); pripína ho test
   (`LT0/damImageApiUploadRequests.test.ts:163`) a tri testy stoja na tom, že je v module, ktorý podvrhujú.
   Zaniká len parameter `_endPointAsset`. Tri neutrálne požiadavky ostávajú v `api/damImageApi.ts`, hoci slúžia
   všetkým typom; presun do súboru s neutrálnym menom je len upratanie a je v K7e.

### 2.8 Sady a ich členy na jednom mieste

Každá vrstva má dve sady; sadu vyrobí len jej funkcia a jej obsah nie je verejný. Člen ostáva len pre
produktový rozdiel alebo väzbu na aplikáciu; všetko ostatné je jeden spoločný kód a je v registri (časť 6).

| Vrstva | Člen | Druh | knižnica | admin-dam | Prečo per strana | Čaká na |
|---|---|---|---|---|---|---|
| služba | `requests` | funkcie | `damUpload*`, konfigurácia `default` (od PV14a konfigurácia fronty), len obrázok | obaly aplikácie, štyri typy | API a typy assetov | — |
| služba | `messages` | funkcie | `common.damImage.uploadErrors.*` | `system.uploadErrors.*` | texty | — |
| služba | `apiTimeout` | hodnota | voľba pluginu | `envConfig` | konfigurácia aplikácie | — |
| služba | `loadHash` | funkcia | lenivé `rusha` | statické `rusha` aplikácie | balík aplikácie | — |
| služba | `emptyFile` | hodnota | `'reject'` | `'send'` | čo sa pošle na backend | — |
| služba | `speedBaseline` | hodnota | `'upload'` | `'attempt'` | dočasný: drží dnešný základ merania od K2 po krok M | zanikne v kroku M (Z28) |
| jadro | `queues` | stav skladu | `Map` | objekt | stav skladu | — |
| jadro | `settlement` | profil | profil knižnice | profil admin-dam | sloty, hromadná úprava, čitatelia, texty | — |
| jadro | `runnerFor` | funkcia | vždy upload | import pre externý riadok | import je len v admin-dam | — |
| jadro | `onClientFailure` | funkcia | nie je | text a upozornenie | text a upozornenie | — |
| jadro | `rowTracked`, `rowRemoved` | funkcie | nie sú | evidencia skladu | sloty a hromadná úprava | — |
| jadro | `refreshable` | príznak | `true` | `false` | „Obnoviť" | — |
| jadro | `configOf` | funkcia | meno konfigurácie fronty zo skladu (krok PV14a) | nie je (jedna konfigurácia) | väzba na stav skladu (pomenovaná konfigurácia, PV14) | — |
| hromadné operácie | `accepts` | funkcia pri volaní | nie je | `assetTypeHas` | čo sa uloží | — |

**Koľko ich je.** Verzia 3 mala 23 volieb, verzia 4 dvadsať členov sád, verzia 5 pätnásť, verzia 7 štrnásť
členov (13 riadkov tabuľky): 4 väzby na aplikáciu a stav skladu (`apiTimeout`, `loadHash`, `queues`,
`settlement`), 9 produktových rozdielov (`requests`, `messages`, `emptyFile`, `runnerFor`, `onClientFailure`,
`rowTracked`, `rowRemoved`, `refreshable`, `accepts`) a 1 dočasný, ktorý zanikne v kroku M (`speedBaseline`).
Krok PV14a pridá väzbu `configOf` (len sada jadra knižnice); po M a PV14a je to opäť štrnásť členov.

**Kombinácie.** Sadu vyrobí len jej funkcia a typ nesie stranu, takže sa nedá zostaviť z častí jednej a druhej
strany a sada jadra admin-dam neprijme beh knižnice. Kombinácie, ktoré zo zmesi vznikali vo verzii 3 (Opus W1),
boli medzi vnútornými rozdielmi a tie sa zblížili.

**Prečo ktorý člen ostal** (jedna veta na člen):
- `requests`: knižnica nahráva len obrázky na svoje adresy, admin-dam štyri typy na svoje; to je iné API.
- `messages`: texty, ktoré používateľ vidí.
- `apiTimeout`: konfigurácia aplikácie (rozhodnuté v kroku 1).
- `loadHash`: odkiaľ sa vezme `rusha`, je vec balíka aplikácie; priebeh je jeden (Z3).
- `emptyFile`: či sa prázdny súbor pošle na backend, je to, čo sa pošle.
- `speedBaseline`: drží dnešný základ merania každej strany od K2 po krok M, ktorý ho nahradí jedným meračom.
- `configOf` (PV14a): meno konfigurácie fronty; sklad knižnice ho drží, admin-dam ho nemá.
- `queues`: stav skladu; vlastník povedal, že iný kontajner nie je problém, a zblíženie by stálo prepis testov
  admin-dam, ktoré do neho sejú. Jadro k obom pristupuje jedným kódom.
- `settlement`: sloty, hromadná úprava, čitatelia a texty usadenia (krok 2) sú produkt.
- `runnerFor`: import od externého poskytovateľa je len v admin-dam.
- `onClientFailure`: text a upozornenie pri zlyhaní ukazuje len admin-dam.
- `rowTracked`, `rowRemoved`: evidencia slotov a hromadnej úpravy, ktoré má len admin-dam.
- `refreshable`: „Obnoviť" ponúka len knižnica (prvá sada, bod 3).
- `accepts`: či sa kľúčové slová a autori zapíšu do riadku typu, ktorý ich nemá zapnuté, je to, čo sa uloží.

**Čo zaniklo zo sád verzie 4:** nastavenie požiadavky kúska (Z1, Z2), `hash` ako stratégia (Z3), `rejections`
(Z4), `stopAt` (Z5), `chunkRetry` (Z6, Z7, Z11), `strictRead` (Z8), `meter` (Z9, Z10), `validationMessage` ako
funkcia strany (Z12), zápis nad frontou, ktorá nie je (Z13), `runDone` (Z14), `runFailed` (Z15, Z16) a
`stopping` (Z17 až Z19). Vo verzii 7 navyše `typedChunks` (Z27).

---

## 3. Dva tenké sklady

„Jadro" = člen je priamo člen jadra. „Obal" = jeden až tri riadky nad jadrom alebo usadzovaním. „Vlastný" =
kód skladu.

### 3.1 Sklad LIB (`useUploadQueuesStore`, `commonUploadQueuesStore`)

Členovia sa nemenia (18). `queues` ostáva `ref<Map<UploadQueueKey, UploadQueue>>`, stále súkromný. Jadro:
`createUploadQueueCore(libraryQueuePreset({ queues, settlement: profile, configOf }))`; beh každého riadku je
`useUpload` so sadou knižnice pod konfiguráciou svojej fronty (od kroku PV14a).

**Krok PV14a v sklade:** sklad drží `Map<UploadQueueKey, string>` s menom konfigurácie každej fronty. Meno zapíšu
`addByFiles(…, configName?)` a `addByCopyToLicence(…, configName?)` (nepovinný posledný parameter, predvolene
`'default'`); kľúč fronty patrí jednému widgetu, a ak do fronty s riadkami príde iné meno, sklad pridanie odmietne
výnimkou a riadok nepridá (od PV14a-c1; pôvodne „nezmení a napíše varovanie do konzoly", čo by riadky poslalo inam,
než volajúci povedal). Frontu pomenuje až vloženie riadku (`addRowUnder`), bez `await` medzi menom a riadkom.
`configOf(queueKey)` vráti meno fronty, inak `'default'`. Čitatelia skladu (`readAsset`,
`readAssets`, originál duplikátu) vyberú klienta a adresu podľa `configOf(options.queueKey)` v okamihu volania.
`updateFromDetail(asset, configName?)` dostane meno detailu. Členovia sa nepremenúvajú, parametre len pribúdajú.

Hotové v kroku PV14a a jeho cykle 1 (11. 10., `impl/PV14a.md`). Spresnenia oproti textu vyššie, s číslami odchýlok
z poznámky (odchýlka 1 je o testoch):

- (2) meno, ktoré aplikácia v `coreDam.configs` nemá, `addByFiles` a `addByCopyToLicence` odmietnu výnimkou pluginu
  skôr, než pridajú riadok;
- (3) sklad pri svojom vzniku už konfiguráciu `default` nečíta, číta konfiguráciu fronty pri každej požiadavke;
- (4) originál duplikátu dostane z volieb len `queueKey` (`Pick<UploadReadOptions, 'queueKey'>`), o hlásení chýb mu
  usadzovanie nehovorí nič, ako doteraz;
- (5) `updateFromDetail(asset, configName)` s menom, ktoré aplikácia nemá, mlčí ako pri zlyhanom čítaní (detail je
  vtedy už uložený), na rozdiel od pridania;
- (6, cyklus 1) iné meno do fronty s riadkami sklad odmietne výnimkou; fronta dostane meno až s vložením riadku,
  takže z dvoch prekrývajúcich sa pridaní pomenuje frontu to, ktorého riadok je v nej prvý, a druhé sa odmietne;
- (7, cyklus 1) jadro robí beh riadku vnútri `try`: sada, ktorá beh nevie vyrobiť, zlyhá riadok ako neúspešný upload
  (predtým ostal čakať).

Meno do `addBy*` a do `updateFromDetail` podajú komponenty až v PV14b; dovtedy ide všetko pod `default`. Cache mien
autorov a kľúčových slov čítajú `default` ďalej (2.3 pravidlo 2; PV14c).

| Člen | Kód | Poznámka | Kto ho číta (produkcia) |
|---|---|---|---|
| `getQueue` | jadro | | 3 widgety, `AAssetListInner.vue`, chipy autora a kľúčového slova |
| `getQueueItems` | jadro | | 7 komponentov `uploadQueue/components/*`, `L-mo` |
| `getQueueTotalCount`, `getQueueProcessedCount` | jadro | | `UploadQueueDialog.vue`, `UploadQueueDialogSingle.vue`, `ImageWidgetMultipleLimitDialog.vue` |
| `getQueueItemsTypes` | jadro | | `AssetQueueSelectedSidebar.vue` |
| `forceReloadFileInput` | jadro | | `ImageWidgetMultipleLimitDialog.vue` |
| `addByFiles(queueKey, extSystem, assetLicence, files, configName?)` | vlastný | konfigurácia ext systému, overenie mena konfigurácie (PV14a), len obrázky, `listenToNotifications()`, továreň riadku s kľúčom z `core.uniqueKey`; potom `addRowUnder` (meno fronty a `core.addRow`) | 3 widgety, `AAssetListInner.vue`, `ImageWidgetMultipleLimitDialog.vue` |
| `addByCopyToLicence(queueKey, extSystem, assetLicence, assets, configName?)` | vlastný | overenie mena konfigurácie (PV14a); riadok `Asset` / `Processing`; `addRowUnder` (meno fronty a `core.addRow`), `core.track` | 3 widgety |
| `queueItemProcessed`, `queueItemFullyProcessed`, `queueItemFailed` | obal | nad `core.settlement`; v produkcii ich nič nevolá, len `LT/uploadQueuesStore.test.ts` (otázka Q6) | — |
| `queueItemDuplicate(assetId, origin, type)` | obal | `settlement.settleKnownDuplicate` | 3 widgety (kópia, ktorá už existuje) |
| `refreshAsset(assetId)` | obal | `settlement.refreshAsset` | `uploadQueueItemRefresh.ts` |
| `refreshMayHelp(item)` | jadro | | `UploadQueueEditable.vue` |
| `removeByIndex(queueKey, index)` | jadro | | `UploadQueueEditable.vue` |
| `stopItemUpload(queueKey, item, _index?)` | obal | `async` ako dnes; tretí parameter sa nečíta | `UploadQueueEditable.vue` |
| `stopUpload(queueKey)` | jadro | | 2 dialógy, `AAssetListInner.vue`, `ImageWidgetMultipleInner.vue` |
| `updateFromDetail(asset, configName?)` | vlastný | číta pod konfiguráciou detailu (PV14a; bez mena `default`), inak bez zmeny (`L-st:429-456`): `fetchAsset`, zápis do riadkov, návrhy mien, konflikty, cache, prepočet; zlyhané čítanie mlčí, aj pri mene, ktoré aplikácia nemá | `assetDetail/components/AssetDetailSidebarMetadata.vue` |

Vlastný kód mimo členov: `readAsset`, `readAssets` (dnešné, `L-st:74-106`), profil usadenia (1.4),
`toSettlementEvent` a `listenToNotifications` (`L-st:151-190`). Počítadlo kľúčov riadkov sa sťahuje do jadra
(Z22). Do kroku PV14a sada služby knižnice číta konfiguráciu `default` (PV14).

### 3.2 Sklad DAM (`useUploadQueuesStore`, `damUploadQueuesStore`)

Členovia a ich podpisy sa nemenia (37), preto sa nemení žiadny z 21 produkčných súborov, ktoré sklad
používajú. `queues` je ten istý verejný `ref` objektu; testy doň sejú ďalej. Jadro:
`createUploadQueueCore(adminDamQueuePreset({ queues, settlement: profile, upload: useUpload, importRun,
failureMessage: resolveUploadErrorMessage, alert: showError, rowTracked, rowRemoved }))` (vstupy nižšie).

| Člen | Kód | Poznámka | Kto ho číta (produkcia) |
|---|---|---|---|
| `queues` | vlastný | stav skladu | len testy |
| `getQueue` | jadro | | chipy autora a kľúčového slova |
| `getQueueItems` | jadro | | 9 súborov (zoznamy, pätičky, akcie zoznamov) |
| `getQueueTotalCount` | jadro | | 9 súborov (limity, pätičky) |
| `getQueueProcessedCount` | jadro | | 3 prekrytia uploadu |
| `getQueueFileInputKey` | jadro | | `AssetUpload.vue` |
| `getQueueItemsTypes` | jadro | | `AssetQueueSelectedSidebar.vue`, 2 pätičky externého poskytovateľa |
| `getQueueItemsByStatus` | jadro | | len testy |
| `getQueueItemForSlotItem` | vlastný | bez zmeny | `AssetSlotListItem.vue` |
| `addByFiles(queueId, files)` | vlastný | aktuálna licencia a ext systém, každý známy typ; `core.addRow` | `AssetUpload.vue` |
| `addByFilesAsSlotUpload(…)` | vlastný | `core.addRow` | `AssetUpload.vue` |
| `addByAssets(queueId, assets)` | vlastný | kľúč `asset_<id>` ako dnes; `core.addRow`; `fetchLazyAdditionalMetadata` | `assetListActions.ts` |
| `fetchLazyAdditionalMetadata` | vlastný | v K6 bez zmeny; po K6 ho menia 40 (konflikty autorov do cache mien) a F5 s F-A (asset so spracúvaným súborom bez formulára, `metadataFailures` a `leftOutByBatch`; 4.1) | len sklad a testy |
| `addByExternalProviderAsset(…)` | vlastný | `core.addRow` | `externalProviderAssetImport.ts`, `externalProviderAssetListActions.ts` |
| `forceReloadFileInput` | jadro | | `AssetUpload.vue` |
| `removeByAssetId` | vlastný | bez zmeny (`D-st:542-553`), na konci `await` svojho `removeByIndex` | `AssetQueueEditable.vue`, `assetListActions.ts` |
| `removeByIndex` | obal | `async`, volá `core.removeByIndex` | `ExternalProviderAssetQueueReadonly.vue` |
| `removeByExternalProviderAssetId` | vlastný | holý `splice` a `core.recalculateQueueCounts`, ako dnes | `externalProviderAssetListActions.ts` |
| `createQueue`, `addQueueItem`, `processUpload`, `queueItemUploadStart`, `setUploadSpeed`, `recalculateQueueCounts` | jadro | | len testy |
| `stopUpload` | jadro | | 2 prekrytia uploadu |
| `stopItemUpload(queueId, item)` | obal | `async`, volá `core.stopItemUpload` | `AssetQueueEditable.vue`, `AssetQueueUploadList.vue`, `AssetSlotListItem.vue` |
| `queueItemProcessed`, `queueItemFailed`, `queueItemMetadataProcessed`, `queueItemDuplicate` | obal | nad `core.settlement`, ako dnes | `appNotificationListeners.ts` |
| `refreshQueueItem(item)` | obal | ako dnes | `AssetQueueEditable.vue` |
| `clearQueue` | jadro | | 4 pätičky, akcie oboch zoznamov, `externalProviderAssetImport.ts` |
| `queueItemsReplaceEmptyCustomDataValue` | obal | `uploadQueueFillCustomDataValue(queues.value[queueId].items, …)` | `AssetQueueSelectedSidebar.vue` |
| `queueItemsReplaceEmptyKeywords`, `queueItemsReplaceEmptyAuthors` | obal | s `accepts` z `assetTypeHas` (vlastný, číta `useDamConfigState` a aktuálny ext systém) | `AssetQueueSelectedSidebar.vue` |
| `updateAssetMetadata(asset)` | vlastný | bez zmeny (`D-st:857-868`); nález 50 (po F5) ho volá aj z pravého panela a z detailu otvoreného zo zoznamu, nielen pri pohľade `queue` | `AssetDetailSidebarMetadata.vue`; po náleze 50 aj `AssetListSidebarMetadata.vue` |
| `reset` | vlastný | bez zmeny (`D-st:870-873`), nad `core.settlement` | nič |

Vlastný kód mimo členov (všetko dnešné, len zapojené do jadra):

- profil: `roleOf`, `policyFor`, `notificationMatches`, `readAsset`, `readAssets`, `readSlotFiles` so
  `slotRowsOf`, `fetchDuplicateOriginFile`, texty, `metadataGate`, háky `onRowFinal` (len zabudnutie
  „metadáta chýbajú"), `onAssetRead`, `onProcessedSeen`, `afterMetadataLoaded`;
- `metadataFailures`, `failStillLoading`, `handedOver`, `goneAssetWrittenDown`;
- vstupy sady jadra admin-dam:
  ```ts
  const core = createUploadQueueCore(
    adminDamQueuePreset({
      queues,
      settlement: profile,
      upload: useUpload, // from `uploadService.ts`, so the tests that replace that module by its path still do
      // The import request is all there is: it never rejects and writes the row itself (`D-ep`).
      importRun: (item) => adminDamImportRun(externalProviderImport(item).importInit),
      failureMessage: resolveUploadErrorMessage,
      alert: showError, // of the store's own `useAlerts()`, so the tests that replace `useAlerts` still do
      rowTracked: (_queueId, item) => handedOver.add(toRaw(item)),
      rowRemoved: (queueId, item) => metadataFailures.delete(metadataFailureKey(queueId, item)),
    })
  )
  ```
  Text, upozornenie, beh uploadu a beh importu volá kód DAM, takže náhrady testov DAM účinkujú ako dnes
  (zásada 1).

Prečo asi 470 a nie 280 riadkov: profil s čitateľmi a slotmi má asi 170 riadkov, štyri zdroje riadkov s
hromadnou úpravou asi 150, obaly, vstupy sady a zoznam členov asi 90, importy a pomocné veci asi 60. Nič z toho nie je
spoločné s LIB. Ak má byť súbor skladu kratší, profil sa dá vyňať do `asset/store/uploadQueuesProfile.ts`
(len presun v DAM, správanie sa nemení); nenavrhujem to robiť v rámci kroku 5.

### 3.3 Čo tieto rozhrania nechávajú otvorené pre časti 4 a 5

1. **Riadok, zoznam a sidebar bez skladu.** Hostiteľ (dialóg LIB, obal DAM) im dá riadky z `getQueueItems` a
   na udalosti zavolá svoj sklad. Oba sklady po K6 ponúkajú to isté pod tým istým významom: riadky, počty,
   `getQueueItemsTypes`, `getQueue(…).suggestions`, `stopItemUpload(kľúč, riadok)`, `stopUpload`,
   `forceReloadFileInput`.
2. **Odstránenie riadku** podľa poradia (`removeByIndex`) je v jadre pre oba sklady, s jedným pravidlom (Z17).
   Podľa assetu (`removeByAssetId`, riadok DAM po zmazaní assetu) je dnešný vlastný kód DAM
   nad `removeByIndex` jadra; keby ho spoločný riadok potreboval aj v LIB, je to päť riadkov v sklade LIB.
3. **„Obnoviť".** `settlement.refreshAsset({ assetId, fileId })` je spoločné; dva obaly (`refreshAsset`,
   `refreshQueueItem`) sa dajú zjednotiť, keď bude jasné, čo emituje spoločný riadok. `refreshMayHelp` je v
   jadre pre oba sklady, plní ho len sada knižnice; DAM ho zatiaľ nevystavuje (aj nález 25 z denníka o dialógu pre jeden súbor sa rieši
   tam, kde sa dialóg zjednotí).
4. **Rola riadku.** `core.roleOf(item)` dá `UploadRowRole` pre varianty riadku (zamknutý vzhľad, slot, TTS)
   bez čítania `item.type`, ktorého `Asset` znamená na každej strane iné.
5. **Hromadné operácie** sú čisté funkcie: spoločný sidebar ich môže volať nad riadkami, ktoré dostal, a
   `accepts` mu odovzdá hostiteľ. Prístupné mená tlačidiel s názvom poľa (C66) sú len vec komponentu.
6. **Cache autorov a kľúčových slov** ostáva odovzdaná v profile (`caches`); jadro žiadnu neimportuje, takže
   zámena cache v časti 4 sa jadra nedotkne.
7. **Detail assetu.** Uložený detail píše do riadkov člen každého skladu (`updateFromDetail` v LIB,
   `updateAssetMetadata` v DAM), ako dnes; adaptéry z časti 5 volajú člen svojho skladu.
8. **Typ riadku** sa len rozširuje (PV10 pridáva nepovinné pole). Funkcia, ktorá bude skladať
   `ImageCreateUpdateAware`, číta dnešné polia riadku; žiadne nezaniká, ani dve zastarané (C63).
9. **Limity** (50) ostávajú v komponentoch; jadro dáva len počty.
10. **Upozornenia a texty** jadro nevolá; sada admin-dam volá upozornenie, ktoré jej dal sklad. Spoločný
    komponent tak nedostane upozornenie „zo vzduchu".
12. **Sloty komponentov.** Usmernenie vlastníka pripúšťa pre rozdiely v komponentoch aj sloty. Časti 1 až 3
    žiadny komponent nemenia; rozdiely riadku, zoznamu a sidebaru rieši časť 4 tým istým pravidlom (zásada 6).
11. **Pomenovaná konfigurácia** (PV14, rozhodnuté: plná podpora): v jadre krok PV14a (2.3 pravidlo 2, 2.4 pravidlo
    10, 3.1); meno v strome komponentov (kľúč inject, výslovný prop má prednosť) je krok PV14b v časti 4.

---

## 4. Poradie implementácie

Pravidlá práce platia ako doteraz: žiadny commit bez súhlasu, ťažké kontroly po jednej, počas behu kontroly sa
v repozitári nič neupravuje, žiadne `rm` ani `cd`. Každý krok končí zelenými cielenými testmi.

### 4.1 Kroky a brány

| # | Kde | Čo | Súbory | Stráži | Zblíženia, ktoré krok uskutoční |
|---|---|---|---|---|---|
| K0 | DAM | jeden test produktového rozdielu, ktorému v DAM chýba test (4.2). Stromy stoja (5.1), dá sa začať. | len testy | prechádzajú na nezmenenom kóde | — |
| K1a | LIB | tri požiadavky idú von z `src/lib.ts` ako `damFileUpload*` | `src/lib.ts` | **žiadny existujúci test sa nemení**: `src/test/importCycles`, `publicExportsAdded`, `publicExportsDamConsumers` | — |
| K1b | LIB | `damUploadFinish` bez `_endPointAsset` (O15) | `api/uploadApi.ts:55-62`, `uploadService.ts:31-32` (jedno volanie), tri testovacie súbory (4.3) | `LT/uploadStatusFallback`, `uploadQueuesStore`, `LT0/damImageApiUploadRequests`; `LT/uploadService*`, `uploadStop*`, `uploadQueueStartsEachFileOnce`, `uploadQueueOperations`, `uploadQueueClientFailure`; `yarn lint:tsc:test` | — |
| **brána, splnená** | LIB | **vlna 4 knižnice je hotová a zelená**: 12 súborov, 261 prípadov; celá sada 295 súborov a 3 565 testov o 18:49 | | súbory z 4.3, „vlna 4" | |
| K2 | LIB | služba s jedným priebehom, obe sady služby; `useDamUpload`, `adminDamUploadPreset`, `uploadValidationMessage` von | `uploadService.ts`, `presets/uploadPresets.ts`, `src/lib.ts` | tie isté ako K1a a K1b, vlna 4 knižnice, nové prípady sady admin-dam (4.2) | v LIB: Z5, Z6, Z10, Z12 (drobné, žiadny test LIB sa podľa čítania nemení) |
| kontroly a kópia | LIB → DAM | pred prvou kópiou **celé kontroly knižnice**: celá sada `src/domains/dam` a `src/test` v prehliadači, druhá sada (`yarn test:eslint`), `yarn lint:tsc` aj `yarn lint:tsc:test`, oxlint, eslint, stylelint, formát. Potom `yarn build` a `./copy.sh /home/volar/projects/anzusystems/admin-dam`. | | `yarn build` typy nekontroluje a testy majú vlastný projekt; bez toho by chyba v teste alebo v type odišla do DAM nevidená. Sada DAM zelená s nezmeneným kódom DAM. | |
| **brána, splnená** | DAM | **vlna 4 admin-dam je hotová a zelená, s overením ohýbaním produkčných riadkov**: 10 súborov, 201 prípadov, 200 z nich očervenelo aspoň v jednom kole (`dam-vlna4.md`, časť 4); celá sada 67 súborov a 1 153 testov o 18:36 | | súbory z 4.4, „vlna 4" | |
| K3 | DAM | obaly požiadaviek, väzba sady služby | 4 typové API, `fileApi.ts`, `uploadService.ts`, testy zo 4.4 | `DT/upload/*`, `DT/queue/*`, `DT/fallback/*`; potom celé kontroly DAM | v DAM: Z1, Z2 (potvrdené), Z3, Z4, Z5, Z6, Z7, Z8 (potvrdené), Z9 (potvrdené), Z10, Z11, Z12, Z27 (potvrdené) |
| K4 | LIB | jadro, obe sady jadra, hromadné operácie; zatiaľ ich používa len composable | `uploadQueue/core/*`, `presets/queuePresets.ts`, `uploadQueueMassOperations.ts`, `src/lib.ts` | nové `uploadQueue/core/__tests__/*`, `LT/uploadQueueMassOperations`, `massOperationsValidation`, `LT0/consumerProfileUploadMassOperations` | — |
| K5 | LIB | sklad na jadre so sadou knižnice (`queues` ostáva `Map`) | `uploadQueuesStore.ts` | celé `LT/`, `LT0/consumerProfile*`, `imageWidget/__tests__`, `assetSelect/__tests__`, `uploadQueue/settlement/__tests__` | v LIB: Z14, Z15 a Z17 (potvrdené), Z16, Z19, Z21, Z22 |
| kontroly a kópia | LIB → DAM | celé kontroly knižnice ako vyššie, `yarn build`, `./copy.sh …/admin-dam` | | sada DAM zelená s nezmeneným kódom DAM | |
| K6 | DAM | sklad na jadre so sadou admin-dam | `asset/store/uploadQueuesStore.ts` | celé `DT/`; potom celé kontroly DAM a build | v DAM: Z13, Z14, Z17 (len C32), Z18, Z20, Z22 |
| K7 | obe | upratanie, každý bod zvlášť a voliteľne: (a) jedno hromadné čítanie assetov (A20); (b) zánik väzieb DAM; (c) obaly LIB bez volajúcich (Q6); (d) texty do `doc/changelog/2.0.0.md` a `admin-dam/doc/changelog/3.0.0.md`, vrátane registra z časti 6; (e) tri neutrálne požiadavky do súboru s neutrálnym menom | | | |

Každý krok, ktorý zblíži niečo, čo register v časti 6 nemá, ho tam dopíše skôr, než krok skončí (6.1). Do CMS a
UGC sa knižnica v rámci tejto práce nekopíruje.

**Vlastník 9. 10. potvrdil všetky zblíženia „na potvrdenie".** Keby niektoré neskôr odvolal, vráti sa ako člen
sady s hodnotou každej strany (spôsob je pri položke registra) a menované testy sa vrátia. Nič z toho nie je ťažké vrátiť: každá položka je
na jednom mieste spoločného kódu.

**Kroky po K6, rozhodnuté vlastníkom 9. 10.** (nie sú potrebné na zjednotenie; každý je malý samostatný krok, F-A
ide v kroku F5). Opravy admin-dam 40, 19, F-A, F-B a nález 50 nie sú zblíženia: menia len vlastný kód admin-dam a
v registri nie sú; sú to nálezy denníka. Poradie v admin-dam podľa plánu: K6 → 40 → 19 → F5 s F-A → F-B s nálezom 50.

| Krok | Čo sa zmení | Testy, ktoré sa otočia alebo upravia |
|---|---|---|
| M (PV4, PV12, Z28) | jeden merač namiesto dnešného vzorkovača a dočasného `speedBaseline` (2.3, pravidlo 4; `analyzy/meranie-rychlosti.md`). Nahrádza F1 a K2-D4. Strom LIB po K6; testy admin-dam sa upravia v kópii, ktorá M prenesie. Ručná skúška po kópii (odporúčaná, neblokuje): fotka okolo 5 MB v admin-cms a video nad 200 MB v admin-dam. | LIB: dva prípady `LT/uploadServiceRetry.test.ts` (`:238-268`, `:270-293`); nový `LT/uploadMeter.test.ts`. DAM: `DT/upload/uploadSequence.test.ts:150-175` (čísla), `:192-201` (nový názov), `DT/upload/uploadStop.test.ts:117-151` (číslo) |
| F2 (PV8, Z24) | každý riadok dostane vlastnú kópiu zoznamu a hodnoty poľa | `LT/uploadQueueMassOperations.test.ts:108` |
| F4 (PV13, Z26) | keď usadzovanie zlyhá riadok, ktorého súbor sa ešte posiela, jadro jeho beh zastaví. V `catch` behu jadro riadok, ktorý zlyhal od servera (`failedByServer`), výslovne preskočí: nevolá `onClientFailure`, nič nezapíše ani neohlási (dnes ho spracuje ako každé zlyhanie, `D-st:690-704`). V knižnici aj v admin-dam ostane čip s dôvodom od servera, v admin-dam žiadne upozornenie navyše. | `LT/uploadNotificationEvents.test.ts:461` („frees the place…"), `DT/queue/queueOperations.test.ts:231` („stops an upload whose row a notification has failed…") |
| 40 (nález 40) | admin-dam, hneď po K6: hromadné načítanie (`fetchLazyAdditionalMetadata`) zapíše do cache mien aj konflikty autorov, nielen autorov (`D-st:528,535`; detail to robí, `asset/store/assetDetailStore.ts:76`), takže chipy konfliktov riadku hromadnej úpravy dostanú mená namiesto večného načítavania. Asi 1 h. | nový prípad: chipy konfliktov riadku hromadnej úpravy dostanú mená |
| 19 (nález 19) | admin-dam, po 40: zastavený import, ktorého požiadavka potom zlyhá, riadok neoznačí za zlyhaný ani neukáže upozornenie; vetva chyby skontroluje `Stop` ako vetva úspechu (`D-ep:14,33-49`). Asi 0,75 h. | nový prípad |
| F5 (PV9, Z29) | admin-dam, len vlastný kód skladu (`analyzy/pv9-riadok-hromadnej-upravy.md`, časť 3): pamäť `leftOutByBatch` (riadky, ktorým hromadné načítanie metadáta nedalo); hák `onProcessedSeen` vráti zlyhaný riadok na „hotový" s formulárom, ako ho používateľ nechal, alebo riadok bez metadát na text „Metadáta sa nepodarilo načítať"; bod 5: `afterMetadataLoaded` dá „hotový" aj riadku z `metadataFailures`, ktorému metadáta prinesie notifikácia. S F-A (riadok nižšie, v tom istom kroku) zapisuje do `leftOutByBatch` aj riadok so spracúvaným súborom. Strom DAM po 19, pred C3; knižnica sa nemení, kópia netreba. Asi 2,5 h. | otočia sa `DT/queue/notificationSettlesQueue.test.ts:219-235` a `DT/queue/slotNotifications.test.ts:773-799`; pribudnú štyri prípady (`notificationSettlesQueue`, `overlaySave`, `queueRowStates`) a tvrdenie stavu v `notificationSettlesQueue.test.ts:603-613` |
| F-A (nález 49; v kroku F5) | admin-dam, `fetchLazyAdditionalMetadata` (`D-st:517-540`): asset, ktorý nie je popísaný (`flags.described`) a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored` (pravidlo z čítania, napísané v admin-dam; `analyzy/nalez49-frontend.md`, 7.1), formulár nedostane. Riadok zlyhá s textom „Súbor assetu sa ešte spracúva. Odstráňte položku a označte ju znova, keď bude spracovaný." (sk, en) a zapíše sa do `metadataFailures` aj `leftOutByBatch`, ako riadok bez metadát (`D-st:461-473`, pred K6; po K6 `failStillLoading` na `:406-419`, vetva F-A `:460-469`). Tomu, kto asset nahral, ho oživí notifikácia metadát (`metadataGate`, `D-st:252`; podľa bodu 5 F5 dostane „hotový"); ostatní ho odstránia a označia znova. Hromadné uloženie sa nemení: riadok bez formulára doň nejde. S F5 spolu asi 4,5 h. | pribudnú prípady v `DT/queue/lazyMetadata.test.ts` (spracúvaný asset, popísaný asset, spracovaný súbor, oživenie notifikáciou) a jeden v `DT/queue/overlaySave.test.ts` |
| F-B a nález 50 (hneď po F5) | admin-dam, detail a pravý panel (`asset/components/detail/components/AssetDetailSidebarMetadata.vue`, `asset/components/list/components/AssetListSidebarMetadata.vue`). (F-B) „Uložiť" je vypnuté pri tom istom pravidle ako F-A, s vetou „Súbor sa ešte spracúva; po spracovaní detail obnovte." (50) Uloženie z detailu aj z pravého panela zapíše hodnoty do riadkov toho assetu vždy, nielen pri pohľade `queue` (`AssetDetailSidebarMetadata.vue:60-62`; panel dnes nezapíše nič, `AssetListSidebarMetadata.vue:62-86`), cez nezmenený člen skladu `updateAssetMetadata`; po hromadnom uložení sa otvorený panel načíta znova (`asset/components/footer/AssetFooterSelectedFull.vue:62-79`). Mení, čo pošle neskoršie hromadné uloženie (rozhodnuté 9. 10.). Asi 4 h. | pribudnú prípady: detail a panel s vypnutým „Uložiť" pri spracúvanom súbore a zapnutým pri spracovanom; riadok hromadnej úpravy po uložení z panela aj z detailu otvoreného zo zoznamu; panel po hromadnom uložení |

**Samostatné malé kroky rozhodnutých tém (9. 10.):**

| Krok | Kedy | Čo sa zmení | Testy |
|---|---|---|---|
| PV10 (Z30) | strom LIB, keď je voľný, najneskôr pred C3 | `uploadedAssetId` v type riadku (nepovinné, továreň `null`) a funkcia `markAsDuplicate` v `uploadSettle.ts`, ktorú volajú obe cesty duplikátu (`markDuplicates`, `becomeOriginals`); hodnotu zapíše raz, keď označí riadok za duplikát (`??=`) | LIB: `settlementFixtures.ts` (`settledState`), tvrdenia v `uploadSettle.test.ts` (N-S7, N-S8, N-S11) a nový prípad „riadok, ktorý sa stal originálom, si prvú hodnotu nechá"; DAM nepovinne jedno tvrdenie v `DT/queue/queueRowActions.test.ts:271` po kópii |
| PV14a | strom LIB po U6 (a U7), pred C3 | meno konfigurácie vo fronte, `libraryUploadPreset(configName)`, `configOf` sady jadra knižnice, `UploadReadOptions.queueKey` a jeho podanie v usadzovaní, čitatelia skladu, `updateFromDetail(asset, configName?)` (2.3 pravidlo 2, 2.4 pravidlo 10, 3.1). Asi 4,5 h. | nový súbor testov LIB (widget pod konfiguráciou `own` popri `default`: štart, kúsky, dokončenie, dopyt, notifikácia, „Obnoviť", originál duplikátu); test usadzovania: čitatelia dostanú `queueKey`; testy admin-dam bez zmeny |
| PV14b | hneď po PV14a | meno v strome komponentov (časť 4, návrh komponentov) a dokumentácia obmedzenia „jedna stránka = jeden core-dam" | podľa návrhu komponentov |
| PV14c | neskôr, keď to aplikácia bude potrebovať | cache mien autorov, kľúčových slov a používateľov na konfiguráciu | — |
| PV16 | kedykoľvek, nezávisle od uploadu | možnosť (a) z 5.2: nepovinné `report` v `useApiFetchList` a `report: failures === 0` v dopytovaní distribúcií admin-dam; v admin-dam navyše `resetList()` skladu distribúcií (`asset/store/distributionListStore.ts:86`) na začiatku čítania karty, aby pod chybou čítania nebol zoznam predošlého assetu (bod mimo plánu DAM 1-3, `analyzy/ostatne-otvorene-nalezy.md`) | jeden test LIB, jeden prípad v `DT/distribution/distributionListPoll.test.ts` a jeden pre `resetList()` |
| 9 (nález 9) | v admin-dam kedykoľvek, samostatne (súbor krok 5 nemení) | import z výberu u externého poskytovateľa dá riadku údaje poskytovateľa: `externalProvider/composables/externalProviderAssetImport.ts:67` dnes posiela `metadata: {}` a sklad ich berie z tohto poľa (`D-st:495`); oprava `metadata: item.externalProviderMetadata ?? {}`. Na backend sa neposielajú. Asi 1 h. | nový prípad v admin-dam |
| nález 20 so 17 | podľa plánu (`plan-implementacie.md`, 2.9) | knižnica: adresa kópie do licencie vo widgetoch (20) a zlyhaná kópia v hlásení chýb API (17); jadra sa netýka (A18) | podľa plánu |

### 4.2 K0: testy produktových rozdielov, ktoré jednej strane chýbajú

Je jeden. Má prejsť na nezmenenom kóde a stráži rozdiel, ktorý ostáva na každej strane, aby ho spoločný kód potichu
nezjednotil.

| Kde | Test | Drží |
|---|---|---|
| DAM `DT/queue/uploadFailures.test.ts` | kúsok štyrikrát odmietnutý so 400 bez `fields`: riadok ukáže `unknownError` a príde jedno upozornenie; na strane knižnice vlastný text pripína `LT/uploadServiceRetry.test.ts:103` | `messages` a `onClientFailure` (B22, C27) |

**Že zblíženie nemení, čo používateľ vidí**, ukazujú existujúce testy, ktoré ostávajú bez zmeny a bežia nad
zblíženým kódom: v admin-dam vlna 4 (`queue/queueRowActions.test.ts`: „Zrušiť" zruší kúsok a pošle čakajúci
súbor; `queue/queueRowStates.test.ts`, `queue/queueListRow.test.ts`: riadok podľa stavu a priebehu;
`queue/overlaySave.test.ts`, `queue/slotsOverlay.test.ts`, `upload/uploadStopQuestion.test.ts`: počty,
zastavenie a vyčistenie fronty), `upload/uploadSequence.test.ts` (požiadavky a ich poradie),
`upload/uploadErrorMessage.test.ts` a `queue/uploadFailures.test.ts` (text a upozornenie), `queue/queueAdd.test.ts`
(kľúče len jedinečné); v knižnici vlna 4 (`LT0/consumerProfileUpload*`: celý tok pod profilom CMS aj UGC) a
`LT/uploadQueueOperations.test.ts`. Test K0 vyššie patrí sem tiež (Z11). Pre Z9, Z15 a Z17, ktoré
vidno, testy nič také netvrdia; tie vlastník potvrdil 9. 10.

Ostatné produktové rozdiely sú pripnuté na oboch stranách už dnes: prázdny súbor (B5:
`LT/uploadQueueClientFailure.test.ts`, „that is empty…"; `DT/upload/uploadSequence.test.ts`, „is started and
finished with no chunk between"), meranie rýchlosti (B15: „goes on from the chunk before…"; „says how far the
file is…"), adresy a typy (A4 až A6: `LT0/damImageApiUploadRequests.test.ts`, `DT/upload/fileApiDispatch.test.ts`,
`DT/upload/uploadRequests.test.ts`), text a upozornenie pri zlyhaní (C27: `DT/queue/uploadFailures.test.ts`, „an
upload the server refuses to start"; `LT/uploadServiceRetry.test.ts:88`), hromadné operácie podľa typu (C49:
`LT/uploadQueueMassOperations.test.ts:92`, `DT/queue/lazyMetadata.test.ts:195`), zápis detailu (C51:
`LT/uploadQueueOperations.test.ts:658,670`; `DT/queue/queueOperations.test.ts`, „is written back…"), import, sloty
a hromadná úprava (vlna 4 admin-dam), „Obnoviť" (testy `refreshMayHelp` v LIB), pravidlo „len obrázok" (A6,
`LT0/damImageApiUploadRequests.test.ts:163`).

**Vypustené testy K0 verzie 4** (chránili vnútorný rozdiel, ktorý sa teraz zbližuje; zblížený priebeh stráži
nový test kroku, kde je to užitočné, alebo existujúce testy):

| Vypustený test K0 | Prečo | Položka registra |
|---|---|---|
| LIB: stopnutý riadok je po zrušenom behu `Failed`; čakajúci riadok čaká, kým zrušený beh skončí; `removeByIndex` a `stopUpload` nechajú beh usadeného riadku bežať | knižnica preberá pravidlo admin-dam | Z15, Z17 |
| LIB a DAM: beh zlyhá pri riadku `Uploaded` (Codex GAP pri C25) | vnútorné, zblížené na tvar admin-dam | Z16 |
| LIB: fronty s kľúčmi `toString`, `__proto__`, `hasOwnProperty` | kontajner ostáva každému skladu, nie je to produkt | — |
| LIB a DAM: čítanie, ktoré nie je `ArrayBuffer` | zblížené na tvar knižnice | Z8 |
| LIB a DAM: merač po zlyhanom `upload()`; DAM: koniec merača pri dokončení | zblížené; v K2 nový test „zlyhaný upload s hlásením priebehu nenechá časovač" | Z9, Z10 |
| LIB: obe hlásenia kúska do Sentry | zblížené na tvar knižnice; ako nový test kroku K2, pod oboma sadami | Z2 |
| LIB a DAM: štyri prípady prepočtu veľkosti kúska (Opus G1) | zblížené | Z6 |
| DAM: 400 bez `fields` cez službu (text riadku ostane `''`) | vnútorné; produktovú stránku drží druhý test K0 vyššie | Z11 |
| DAM: kúsok s neplatnou veľkosťou a posunom odíde; 400 nič nehlási (Opus G2) | zblížené na tvar knižnice | Z2 |
| DAM: kúsok nenesie typ súboru (verzia 6) | PV3 zblížené na tvar knižnice: admin-dam začne typ posielať, server ho nečíta; žiadny test admin-dam typ kúska netvrdí (len meno a veľkosť, `DT/upload/uploadSequence.test.ts:63,116`, `DT/upload/uploadRequests.test.ts:100`) | Z27 |
| DAM: poradie zápisov pri zlyhaní (Opus G3) | vnútorné poradie; jadro aj tak zapisuje v poradí admin-dam | — |
| DAM: `'upload stopped'` v šiestich bodoch | zblížené na `Error('Upload stopped')` | Z5 |
| DAM: `removeByAssetId` a `stopUpload` riadku, ktorý notifikácia zlyhala počas posielania; stav `Stop` odstráneného usadeného riadku | pravidlo admin-dam je cieľ zblíženia; stráži ho test jadra v K4 | Z17 |
| DAM: bežný upload počty neprepočíta, import áno | zblížené: prepočet po každom behu | Z14 |
| DAM: `addQueueItem` nad frontou, ktorá nie je, hodí výnimku | zblížené na tvar knižnice | Z13 |
| DAM: kľúče `uploadQueueIds.ts` nie sú mená členov `Object.prototype`; `store.queues = …` a `reset()` | vnútorné; strážia to dnešné testy DAM, ktoré do `queues` sejú | — |

Nové testy, ktoré vznikajú s krokom (testujú spoločný kód, nie rozdiel strán):

- **K2, služba pod sadou admin-dam** (LIB, falošný HTTP klient ako v `LT/uploadServiceRetry.test.ts`, sada s
  falošnými vstupmi aplikácie): prázdny súbor ide; texty aplikácie;
  `loadHash` aplikácie a žiadne čítanie volieb pluginu. Pod oboma sadami: kúsok s neplatnou veľkosťou alebo
  posunom neodíde a ohlási `dam_upload_chunk_validation`, odpoveď 400 ohlási `dam_upload_chunk_400` (náhrada
  modulu `@/domains/system/composables/sentry` podľa cesty); zlyhaný upload s hlásením priebehu nenechá
  naplánovaný tik merača a `uploadCallback` sa už nezavolá, a to pri každom spôsobe zlyhania vrátane `upload()`
  bez `uploadInit()` (Z10); zastavenie stavom aj `stop()` v každom bode
  kontroly.
  Prípad „sada admin-dam: meranie pri každom pokuse" sa nepíše: krok M ho zruší a do M drží základ admin-dam
  jej vlastný `DT/upload/uploadStop.test.ts:118` („measures a retried chunk…") po kópii (`analyzy/meranie-rychlosti.md`,
  časť 5).
- **K4, jadro** (`uploadQueue/core/__tests__/uploadQueueCore.test.ts`, bez HTTP: falošný beh, okamžitý
  plánovač, falošní čitatelia profilu), pod oboma sadami: dve naraz na frontu a nezávislé fronty; `runnerFor`
  podľa riadku; úspech → sledovaný len riadok `Processing`, prepočet, ďalší riadok; zlyhanie s `onClientFailure`
  a bez neho (poradie zápisov, jedno upozornenie na dôvod); sledovanie po zlyhaní len s `finishAttempted`, bez
  odmietnutia 4xx a bez zlyhania serverom; každý riadok tabuľky z 2.4 (pravidlo 5), vrátane usadeného riadku so
  živým behom; `clearQueue` vytvorí frontu; háky `rowTracked`, `rowRemoved`; `refreshMayHelp` len so sadou
  knižnice; `uniqueKey` dá rôzne kľúče.
- **K4, hromadné operácie**: `accepts`; holé riadky bez ostatných polí.

### 4.3 Testy LIB: úprava, prepis, zatriedenie

**Existujúce testy, ktorých sa K1 až K5 dotýka:**

| Krok | Súbor | Zásah | Dôvod |
|---|---|---|---|
| K1a | `src/test/publicExportsAdded.test.ts` | nové tvrdenia o `damFileUploadStart`, `damFileUploadChunk`, `damFileUploadFinish` | exporty pribudli |
| K1b | `LT/uploadStatusFallback.test.ts:1340,1353` | úprava: dve volania `damUploadFinish` z piatich argumentov na štyri (bez `endPoints.asset`) | O15 |
| K1b | `LT/uploadQueuesStore.test.ts:39,46` | úprava: podvrh `damUploadFinish` berie riadok z tretieho argumentu a pretypovanie v `vi.mock` má dve položky pred ním | O15 |
| K1b | `LT/uploadQueuesStore.test.ts:475` | úprava: `call[3].file` → `call[2].file`. Bez nej by bol `call[3]` kontrolný súčet, `.file` nedefinované a tvrdenie by prešlo, nech sa dokončilo čokoľvek. | O15 |
| K1b | `LT0/damImageApiUploadRequests.test.ts:170` | úprava: `damUploadFinish(dam.client, IMAGE, item, 'sha')`, o argument menej. Prípad („a row of the type %s › is not started, sent nor finished", `:163`) ostáva. | O15 |
| K1b | `LT/uploadQueueStartsEachFileOnce.test.ts`, `uploadStopBetweenChunks.test.ts`, `uploadStopWhileHashLoads.test.ts` | **bez zmeny**: modul `uploadApi` podvrhujú podľa cesty a pravidlo „len obrázok" ostáva v ňom | |
| K1, K2 | `LT0/damImageApiChunkTimeout.test.ts:20`, `LT/uploadStopAbortsChunk.test.ts:20`, štyri testy s podvrhom celého `damImageApi` | bez zmeny: `damImageApi.ts` sa nemení | |
| K2 | testy služby (`LT/uploadServiceRetry`, `uploadServiceSequence`, `uploadServiceApiTimeout`, `uploadStop*`) a `LT0/consumerProfileUpload.test.ts` (typ kúska `:99-101`, Z27) | **bez zmeny podľa čítania.** Zblíženia Z5, Z6, Z10 a Z12 menia v LIB len vnútorný priebeh: `:85` tvrdí pauzy `[1000, 3000, 9000]` a pomôcka zapisuje až od 1 000 ms, takže vypustená 1 ms sa neprejaví; prípady zastavenia tvrdia „odmietne" a `'Upload stopped'` (`uploadStopWhileHashLoads.test.ts:51,62`), čo ostáva. Ak niektorý očervenie, zapíše sa do registra. | |
| K4 | `LT/uploadQueueMassOperations.test.ts` | bez zmeny | |
| K5 | celé `LT/` | **bez zmeny podľa čítania.** Zblíženia Z15 a Z17 menia v LIB, kedy sa spustí ďalší súbor po odstránení a čo sa stane s behom usadeného riadku; žiadny test LIB som nenašiel, ktorý by dnešné správanie knižnice v týchto dvoch veciach tvrdil (C24, C31, C33 nepripnuté; C32 `:553` platí aj po zblížení; **oprava po K5:** C33 urobil test J-01 `:463-480` neúčinným na „stops", v K5-c1 doplnený o zrušenie kúska, Z15). Ak niektorý očervenie, upraví sa a zapíše do registra. | |

**Vlna 4 knižnice** (dvanásť nových súborov, 261 prípadov; `lib-vlna4.md` v tomto priečinku, stav z 18:14).
Bežia nad skutočným skladom a falošným HTTP klientom (`createFakeDam`, `installConsumerProfile`), väčšina pod
oboma profilmi; žiadny `vi.mock`, žiadne falošné časovače. Pre K1 až K5 sú to strážcovia: nemá sa v nich meniť
nič. Poznámka z `lib-vlna4.md`, ktorá platí aj pre nové testy tohto návrhu: poradie dvoch súčasných štartov
nie je pevné, identifikátory treba brať z riadkov, nie z poradia.

| Súbor | Čo drží pre časti 1 až 3 |
|---|---|
| `LT0/consumerProfileUploadQueueRows.test.ts`, `consumerProfileUploadDialogActions.test.ts`, `consumerProfileUploadDialogSingle.test.ts`, `consumerProfileUploadMassOperations.test.ts` | celý tok fronty pod profilom CMS aj UGC: požiadavky, stavy riadkov, zastavenie, hromadné operácie; K1, K2, K4, K5 |
| `imageWidget/__tests__/consumerProfileImageWidgetUpload.test.ts`, `consumerProfileImageWidgetMultipleUpload.test.ts`, `consumerProfileImageWidgetLibrary.test.ts`, `assetSelect/__tests__/consumerProfileAssetListUpload.test.ts` | widgety nad skladom: pridanie súborov, kópia do licencie, `stopUpload` pri zatvorení; K1, K2, K5 |
| `LT/uploadQueueRowStates.test.ts` | riadok podľa stavu a priebehu (zapisuje `item.progress` sám); pre PV5 dôkaz, že LIB kreslí priebeh len v stave `Uploading` |
| `LT/uploadQueueButtonStop.test.ts`, `imageWidget/__tests__/metadataToImageMap.test.ts` | komponent a prevod; častí 1 až 3 sa netýkajú |
| staršie, nie vlna 4: `LT/uploadQueueDialogDrop.test.ts`, `imageWidget/__tests__/ImageWidgetMultipleLimitDialog.test.ts`, `ImageWidgetsCopyToLicenceFailure.test.ts` | skutočný sklad; K5 |
| `src/test/publicExportsDamConsumers.test.ts` | mená, ktoré importujú CMS a UGC; K1, K2, K4 (exporty len pribúdajú) |
| `LT0/support/uploadUi.ts`, `support/consumerImageApi.ts` | pomôcky |

### 4.4 Testy DAM: úprava, prepis, zatriedenie

**Existujúce testy, ktorých sa K3 a K6 dotýka** (väzby `fileApi.ts` a `uploadService.ts` ostávajú, 2.7). „Bez
zmeny" je z čítania, nie z behu; že väzba ostala, ešte nie je dôkaz, že test prejde.

| Krok | Súbor | Viaže sa na | Zásah |
|---|---|---|---|
| K3 | `upload/uploadStop.test.ts` (desať prípadov) | podvrh `fileApi` podľa cesty; náhrada `useDamUploadChunkSize` v knižnici; podvrh `axios` | **úprava** (Z3): deväť prípadov volá `upload()` bez `uploadInit()`; pred `upload()` pribudne `await uploadInit()` (štart je podvrhnutý už dnes). Náhrada `useDamUploadChunkSize` (`:23`) na službu v knižnici nedosiahne; veľkosť kúska 4 sa nastaví cez `seedDamConfig(useDamConfigStore(), 4)` s aktívnou pinia. Prípad `:117-151` (3 000) sa mení až v kroku M. |
| K3 | `upload/uploadRequests.test.ts`, `upload/fileApiDispatch.test.ts` | import `fileApi`, falošný klient | **úprava** (Z1, Z2): `uploadRequests.test.ts:107` hlavička `Content-Type` už nie je `'multipart/form-data'`; `uploadRequests.test.ts:116` a `fileApiDispatch.test.ts:24` posielajú `Blob` namiesto textu `'bytes'`. Adresy a text chyby pri neznámom type ostávajú. |
| K3 | `upload/uploadErrorMessage.test.ts` | import `resolveUploadErrorMessage` | bez zmeny |
| K3 | `upload/uploadSequence.test.ts` | falošný klient, skutočná služba | bez zmeny podľa čítania (`:150-175` sa mení až v kroku M a `:192-201` sa vtedy premenuje; „Measured afresh…" drží `speedBaseline` admin-dam do M). Z9 mení posledné hlásenie po dokončení; ak niektorý prípad tvrdí hlásenie po odpovedi dokončenia, upraví sa a zapíše do registra. |
| K3 | `queue/externalProviderImport.test.ts` | podvrh `fileApi.externalProviderUpload` | bez zmeny |
| K3, K6 | `queue/slotNotifications.test.ts`, `queue/lazyMetadata.test.ts` | podvrh `uploadService` a `externalProviderImportService` podľa cesty; `store.queues` | bez zmeny: sklad ďalej importuje `useUpload` z väzby a `externalProviderImport` zo služby importu a dá ich svojej sade jadra; podvrh vracia `{ upload, uploadInit, stop, finishAttempted }`, presne `UploadRun`. Po K6 pribudnú prípady F5 a F-A (4.1). |
| K6 | `queue/queueOperations`, `queueAdd`, `uploadFailures`, `notificationSettlesQueue`, `queueRefresh`, `slotUploadRow`, `slotUploadWithoutSocket`, `fallback/*`, `upload/assetUploadLimit`, `list/*`, `init/startNotificationService` | falošný klient; náhrady `useAlerts`, `useDamConfigState` v knižnici; `store.queues` | bez zmeny. Náhrady ostávajú účinné, lebo upozornenie a čítanie konfigurácie volá kód DAM (zásada 1). |
| K6 | `queue/slotNotifications.test.ts:688,707,731,756,807` | päť prípadov dáva `queueItemUploadStart` holý riadok, nie riadok z fronty; služba je podvrhnutá | bez zmeny: register je kľúčovaný ako dnes v admin-dam (Z21) |
| K6 | `appInitialize/appNotificationListeners.test.ts`, `cached/cachedChipUnresolved.test.ts`, `list/detailRequests.test.ts`, `list/externalProviderList.test.ts`, `queue/massOperationsSidebar.test.ts`, `queue/saveNothing.test.ts` | podvrh skladu podľa cesty | bez zmeny (cesta a mená členov ostávajú) |

**Vlna 4 admin-dam** (desať nových súborov, 201 prípadov; `dam-vlna4.md` v tomto priečinku, stav z 18:32, s
overením ohýbaním produkčných riadkov: 200 z 201 prípadov očervenelo aspoň v jednom kole, časť 4). Bežia nad skutočným skladom, skutočnou službou a nainštalovaným
pluginom knižnice s klientom DAM; riadky sejú cez `seedQueue` (`DT/support/uploadUi.ts`), server je
`createFakeDam`, čas je falošný po celý prípad. Jediný `vi.mock` je klient (`@/shared/apiClients/damClient`);
`fileApi`, `uploadService` ani sklad sa nepodvrhujú. Pre K3 a K6 sú to strážcovia: nemá sa v nich meniť nič.

| Súbor | Čo drží pre časti 1 až 3 |
|---|---|
| `queue/queueRowActions.test.ts` | „Zrušiť" na riadku (`stopItemUpload`: kúsok zrušený, čakajúci súbor sa pošle), „Obnoviť", zmazanie assetu a `removeByAssetId`; K3, K6 |
| `queue/queueListRow.test.ts` | riadok zoznamu: kruh podľa `progress.progressPercent` aj počas `Processing`, zvyšný čas, kým je kladný; pri PV5 dôkaz, čo je v DAM vidno |
| `queue/queueRowStates.test.ts`, `queue/failReasonChip.test.ts`, `queue/queueRowKeywordsAuthors.test.ts`, `queue/customMetadataForms.test.ts` | riadok podľa stavu riadku fronty; K6 (riadky a ich polia ostávajú) |
| `queue/massOperationsRows.test.ts` | hromadné operácie cez sidebar až do riadkov, vrátane „len do typov, ktoré to majú zapnuté"; K6. Spoločné pole (C50) zámerne nepripína (`dam-vlna4.md`, „Not written"), takže PV8 ho neotočí |
| `queue/overlaySave.test.ts`, `queue/slotsOverlay.test.ts`, `upload/uploadStopQuestion.test.ts` | prekrytia: počty, `stopUpload`, `clearQueue`; K6 |
| `support/uploadUi.ts` | pomôcka |

**Variant bez väzieb (K7b)**; či sa urobí, rozhodne vedúci (mení len testy a importy, žiadne správanie):
**prepis** `upload/uploadStop.test.ts` (predmet je už v LIB; prípady DAM cez sklad a falošný klient),
`upload/uploadRequests.test.ts` a `upload/fileApiDispatch.test.ts` (cez sklad: „riadok typu X ide na adresu
X"), `upload/uploadErrorMessage.test.ts` (nový domov funkcie), `queue/externalProviderImport.test.ts` (iný cieľ
podvrhu), a v `queue/slotNotifications.test.ts` (872 riadkov) a `queue/lazyMetadata.test.ts` náhrada podvrhu
`uploadService` za falošný klient, ktorý drží uploady otvorené.

---

## 5. Riziká a otvorené otázky

### 5.1 Blokuje začiatok

**Nič.** K0 a K1 (K1a aj K1b) sa môžu začať. Obe podmienky verzie 2 sú splnené, a s nimi aj obe brány pred K2
a K3.

| # | Čo bolo | Stav k 21:45 |
|---|---|---|
| S1 | Stromy sa ešte hýbali (opravy z posudkov). | Stoja. Posledná zmena zdroja: knižnica 18:46 (`uploadQueue/components/UploadQueueDialogSingleSidebar.vue`), admin-dam 18:36. Celé kontroly oboch strán zelené podľa denníka a výstupov kontrol (spustil ich vedúci, nie ja): knižnica 295 súborov a 3 565 testov o 18:49; admin-dam 67 súborov a 1 153 testov, typy, lint a build o 18:36. Čísla riadkov v tomto návrhu sú z tohto stavu; kto začne neskôr, overí si ich podľa mien prípadov. |
| S2 | Brána: vlna 4 knižnice pred K2, vlna 4 admin-dam pred K3. | Obe splnené. Knižnica: 12 súborov, 261 prípadov (`lib-vlna4.md`). Admin-dam: 10 súborov, 201 prípadov, s overením ohýbaním produkčných riadkov (`dam-vlna4.md`, časť 4: 34 kôl, 168 úprav, 200 z 201 prípadov očervenelo aspoň raz; ten jeden porovnáva tabuľku dôvodov so zoznamom knižnice). |

Nič z 5.2 začiatok neblokuje a R12 už nič neblokuje (vyriešené čítaním). Všetky témy rozhodol vlastník 9. 10.
(5.2); kroky po K6 a malé kroky sú v 4.1.

### 5.2 Pre vlastníka: všetko rozhodnuté (9. 10.)

**Z jadra nie je otvorená žiadna téma.** Vlastník 9. 10. potvrdil všetky zblíženia „na potvrdenie" a rozhodol všetky
otvorené témy (denník, „Súhrn zjednotení odsúhlasený vlastníkom", „Otvorené témy, rozhodnutia vlastníka" a
„Rozhodnutia vlastníka k analýzam").

**Zblíženia potvrdené vlastníkom 9. 10.** (bývalé „na potvrdenie"; podrobnosti v registri v časti 6). Prvých sedem
berie variant jednej strany a uskutoční sa v krokoch zjednotenia; opravy chýb idú po K6.

- **PV1 → Z1.** Hlavička typu pri posielaní kúska ako v knižnici (`undefined`, typ aj s hranicou dopíše
  prehliadač). Nikto si nič nevšimne: na server ide to isté.
- **PV2 → Z2.** Kontrola kúska pred odoslaním a hlásenie do Sentry ako v knižnici. Používateľ nič; admin-dam
  začne posielať do Sentry hlásenia o odmietnutom kúsku a o odpovedi 400.
- **PV3 → Z27.** Typ súboru na časti kúska ako v knižnici (napríklad „image/jpeg"); začne ho posielať aj
  admin-dam. Server typ časti nečíta a typ kúska si určí z obsahu (overené na lokálnej kópii core-dam). Nikto si
  nič nevšimne.
- **PV5 → Z9.** Posledné hlásenie priebehu ako v knižnici. V riadku zoznamu admin-dam sa po odoslaní posledného
  kúska ukáže plný kruh bez zvyšného času, ak upload stihol zmerať rýchlosť. Dnes tam podľa toho, ako rýchlo
  server dokončí, môže ostať posledné namerané percento so zvyšným časom (aj pri zelenej fajke hotového riadku)
  alebo točiace sa koliesko. Bez zmeranej rýchlosti sa nemení nič. Mení to zobrazený text, preto rozhodne
  vlastník.
- **PV6 → Z15.** Zastavený riadok ako v admin-dam (ostane „zastavený", miesto sa uvoľní hneď). V knižnici sa po
  odstránení súboru, ktorý čakal na ďalší pokus, ďalší súbor spustí hneď, nie o 1 až 9 s neskôr.
- **PV7 → Z17.** Zastavenie živých uploadov ako v admin-dam. V knižnici sa po odstránení alebo zastavení riadku,
  ktorý server medzitým ohlásil, prestanú posielať zvyšné kúsky jeho súboru (dnes sa dosielajú nevidené). Asset,
  ktorý štart uploadu vytvoril, ostane na serveri ako dnes: odstránenie ani zastavenie ho nemaže.
- **PV11 → Z8.** Kontrola prečítaných bajtov ako v knižnici. Nikto si nič nevšimne.
- **PV4 a PV12 → Z28 (krok M).** Jeden merač rýchlosti pre obe strany namiesto opravy F1 a merania podľa D4.
  Percentá sa hýbu aj počas kúska a pri opakovanom pokuse neklesnú; zvyšný čas odpočítava plynulo a ráta aj čakanie
  na server; v admin-dam na rýchlej sieti namiesto točiaceho sa kolieska kruh s percentami a časom
  (`analyzy/meranie-rychlosti.md`, časť 6).
- **PV8 → Z24 (F2).** Každý riadok dostane pri hromadnom vyplnení vlastnú kópiu zoznamu. Dnes nič.
- **PV13 → Z26 (F4).** Súbor, ktorý server ohlásil ako zlyhaný, sa prestane posielať a naraz idú najviac dva
  súbory. V knižnici aj v admin-dam ostane v riadku čip s dôvodom od servera a v admin-dam nepríde ani
  upozornenie navyše (dnes ich neskoršie zlyhanie uploadu môže prepísať textom, v admin-dam aj s upozornením,
  podľa toho, ako server odpovie). Zvyšný čas pri červenej ikone sa môže zobraziť inak než dnes: zamrzne už pri
  hlásení servera, takže niekedy ostane číslo tam, kde dnes zmizne, inokedy naopak (kozmetika).

**Témy rozhodnuté 9. 10.** (opis zo stavu pred rozhodnutím ostáva; rozhodnutie je v poslednom stĺpci):

| # | Vec | LIB dnes | DAM dnes | Odporúčanie | Rozhodnutie (9. 10.) |
|---|---|---|---|---|---|
| PV9 | Riadok hromadnej úpravy, ktorého súbor zlyhal a potom ho server spracoval (C55; nález 10) | — (hromadnú úpravu nemá) | Stav ostane „zlyhal" a formulár zamknutý, aj keby metadáta prišli: zlyhanie zamkne formulár a notifikáciu metadát riadok so stavom „zlyhal" odmietne (`uploadSettle.ts:357,582`). Hák spracovaného súboru zmaže chybu súboru, hák metadát len chybu „metadáta chýbajú" (`D-st:267-282`), takže riadok nie je červený. V upraviteľnom riadku ostane × a zamknutý formulár; fronta hromadnej úpravy je pripojená s `disable-done-animation` (`asset/components/footer/AssetFooterSelectedFull.vue:198`), takže znak „hotovo" tam nie je ani dnes, ani by nebol; kompaktné zobrazenie tejto fronty (`asset/components/queue/AssetQueueSelectedItemSimple.vue:42-83`) nemá × ani fajku. Do hromadného uloženia sa riadok nedostane. | Nechať, ako je. Jednoduchá zmena stavu na „hotový" (F3 verzie 6) je vyradená: po 20 s by sa ukázalo „Obnoviť", ktoré metadáta nenačíta (číta s `early: false`, `uploadSettlement.ts:589-590`; riadok so `settleOn: 'never'` dostane len doplnenie vzhľadu, `uploadSettle.ts:616-618`), takže by ostalo na obrazovke ako tlačidlo, ktoré nič neurobí; a neskoršia notifikácia metadát by formulár odomkla a riadok dostala do hromadného uloženia, čo dnes nejde (`DT/queue/slotNotifications.test.ts:837`). Riadna oprava potrebuje vlastný návrh: napríklad „Obnoviť" s `early: true` pre taký riadok, alebo nechať stav „zlyhal" a upraviť len to, čo riadok ukazuje. | **opraviť**: krok F5 v admin-dam po K6, vrátane bodu 5 analýzy (`analyzy/pv9-riadok-hromadnej-upravy.md`; 4.1, Z29) |
| PV10 | Riadok duplikátu si nepamätá vlastný asset (C56) | `assetId` aj `duplicateAssetId` sú originál | pamätá si oboje | Nové nepovinné pole riadku `uploadedAssetId` („asset, ktorý vytvoril upload tohto riadku"), zapísané v `becomeOriginals` pred prepisom `assetId`. Nikto ho zatiaľ nečíta. Význam `duplicateAssetId` (asset originálu) ostáva na oboch stranách. Nález 11, pridelený kroku 5. Časť 4 ho nepotrebuje (platí návrh komponentov): kôš admin-dam je vo vlastnom slote a číta `assetId`, ktorý admin-dam neprepíše, a kôš knižnice len odoberá z fronty; pole len odstraňuje pascu pre budúci spoločný kôš „zmazať asset" (`analyzy/pv10-vlastny-asset-duplikatu.md`, časť 4). | **zjednotiť**: `uploadedAssetId` píše spoločné usadzovanie na oboch stranách pri označení duplikátu (`analyzy/pv10-vlastny-asset-duplikatu.md`; 4.1, Z30) |
| PV12 | Potvrdenie D4: rýchlosť merať odznova pri každom pokuse (B15) | odznova len po neúspešnom pokuse | odznova pri každom pokuse | D4 je rozhodnuté, ale s dôsledkom, ktorý vtedy nebol známy (riziko R1): v LIB by upload z viacerých kúskov, z ktorých každý dá jedinú udalosť priebehu, ostal na „0 %"; a čísla rýchlosti by vyšli vyššie, lebo chyba z PV4 by sa rátala pri každom kúsku. Odporúčam potvrdiť D4 **len spolu s opravou F1 (PV4)** a po jednom ručnom uploade súboru nad 1 MB (viac kúskov pri predvolenej konfigurácii) v CMS na rýchlej sieti. Inak ostať pri voľbe. | **jeden merač** namiesto D4 a F1, krok M po K6 (`analyzy/meranie-rychlosti.md`; 2.3 pravidlo 4, Z28) |
| PV14 | Upload pod pomenovanou konfiguráciou DAM beží pod `default` (B32; nález 23) | služba, sklad aj „Obnoviť" používajú klienta a adresy `default` | jedna konfigurácia | V kroku 5 pomenovanú konfiguráciu pri uploade výslovne nepodporovať (dnešný stav, žiadna aplikácia ju pri uploade nepoužíva) a zapísať to do dokumentácie widgetov. Rozhranie ju nezatvára (2.3, pravidlo 2). Podpora v celom uploade je samostatná úloha, lebo sa týka aj čitateľov usadzovania a dialógov. | **plná podpora** pomenovaných konfigurácií: PV14a (jadro), PV14b (komponenty), PV14c (cache) neskôr; obmedzenie „jedna stránka = jeden core-dam" (`analyzy/pv14-pomenovane-konfiguracie.md`; 2.3 pravidlo 2, 2.4 pravidlo 10, 3.1) |
| PV15 | Hromadné „nahradiť vo všetkých" bez vybraných kľúčových slov alebo autorov (C69; nálezy 34 a 41 z denníka) | vyprázdni kľúčové slová a autorov každého riadku; nedotknuté vlastné polia ostanú (nález 34) | to isté v riadkoch typov, ktoré ich majú zapnuté. Podľa nálezu 41 navyše jednotlivé „nahradiť" nedotknutého vlastného poľa zapíše do každého riadku typu `undefined` (pripína `DT/queue/massOperationsRows.test.ts:192`); v LIB to isté: zapíše `undefined` do `customData` každého riadku typu (`overenia.md`, J-14), nepripnuté. | Ponechať, ako je, kým produkt nepovie, či je to zámer. Ak nie je, oprava patrí tlačidlu (prázdny výber nič neposiela), teda komponentom v časti 4; funkcie z 2.5 majú písať, čo dostanú. Pri vlastnom poli robia obe strany to isté (overenie J-14; C48 je rovnaké), takže rozdiel strán tu nie je. | **želaný stav**, uzavreté |
| PV16 | Dopytovanie zoznamu distribúcií v admin-dam hlási každé zlyhané čítanie (druhá sada rozhodnutí, bod 6: „nechať do kroku 5"; denník, nálezy po kroku 2). Uploadu sa netýka, riadok v časti 1 nemá. | Zoznam distribúcií nedopytuje. Pomocník `useApiFetchList`, cez ktorý admin-dam zoznam číta, voľbu `report` nemá: každé zlyhanie odovzdá zapisovaču chýb (LIB `src/domains/api/composables/useApiFetchList.ts:32-38,182`). `useApiRequest` ju má (LIB `src/domains/api/composables/useApiRequest.ts:24-33`) a dopytovanie uploadu ňou odovzdá zapisovaču len prvé zlyhanie v sérii. Zapisovač je predvolene `console.error` (LIB `src/domains/api/utils/apiErrors.ts:70-73`); 401, 403 a vypršané prihlásenie nedostane nikdy (`:132-134`). | Karta distribúcií detailu assetu číta zoznam znova, kým niektorá distribúcia ešte beží (`asset/composables/distributionListPoll.ts`; čítanie `asset/api/distributionApi.ts:42-52` cez `useApiFetchList`). Na obrazovke chybu neukazuje (`distributionListPoll.ts:106-108`). Každé zlyhané čítanie ide do zapisovača, teda do konzoly (admin-dam vlastný zapisovač nenastavuje). Po zlyhaní príde ďalšie čítanie najskôr o 15, 30, 60, 120 a potom 300 s, a to len ak je bežný odstup dopytovania kratší: platí väčší z oboch (`:22-27,42-46`), takže napríklad päť minút po začiatku distribúcie už prvé zlyhanie čaká 60 s. Pri skrytej karte sa nečíta vôbec (`:81-82,149-155`). Nezávisle od toho Sentry, keď je zapnuté, zachytí každú odpoveď 5xx samo (`admin-dam/src/main.ts:77`, `httpClientIntegration`). | Dve možnosti. (a) Zjednotiť s pravidlom uploadu: `FetchListParams` pomocníka `useApiFetchList` dostane nepovinné `report` ako `useApiRequest` a na `:182` sa chyba odovzdá zapisovaču len pri `report !== false`; dopytovač v admin-dam podá spätnému volaniu druhý argument, `read(current.signal, failures === 0)` (`distributionListPoll.ts:56,102`), karta ho prepošle (`AssetDetailSidebarDistribution.vue:83-85`) a `fetchAssetDistributionList` dostane nepovinný parameter `report` a pošle ho do `execute` (`distributionApi.ts:42-52`). Vlastné čítania karty (otvorenie, stránkovanie) hlásia ako dnes. Veľkosť: knižnica asi 8 riadkov s komentárom a jeden test; admin-dam asi 6 riadkov v troch súboroch a jeden prípad v `DT/distribution/distributionListPoll.test.ts`; verejné rozhranie knižnice len pribudne. Čo to zmení: v konzole jeden riadok na sériu zlyhaní namiesto každého a rovnako v zapisovači, ak by ho admin-dam niekedy napojil na Sentry. Čo nezmení: udalosti Sentry pri 5xx, ktoré zachytáva `httpClientIntegration`; to je rovnaký stav ako pri dopytovaní uploadu, kde vlastník pri druhej sade (bod 1) rozhodol „nechať". (b) Nechať. Používateľ si v oboch prípadoch nevšimne nič. Odporúčam (a) ako samostatný malý krok, nezávislý od uploadu, až po rozhodnutí; zisk je malý (konzola), takže aj (b) je obhájiteľné. Do žiadneho kroku K nepatrí. | **áno**, možnosť (a), samostatný malý krok nezávislý od uploadu (4.1); v admin-dam s ním aj `resetList()` na začiatku čítania karty (bod mimo plánu DAM 1-3) |

### 5.3 Ostatné otázky (neblokujú)

| # | Otázka | Čo som našiel | Odporúčanie |
|---|---|---|---|
| Q4 | Prázdny súbor (B5) ostáva rozdielom sád, lebo mení, čo sa pošle na backend. Chce ho vlastník neskôr zblížiť? | B5 a B22 sú pripnuté testami na oboch stranách a nie sú chybou jednej strany. B24 nikto nečíta. | Nechať. Text pri 400 (B22) a odmietnutie zastaveného uploadu (B24) sú vo verzii 5 zblížené (Z11, Z5). |
| Q5 | Zmazať `uploadFailed` v `imageApi.ts` DAM? | Nikto ju nevolá (grep). | Áno, v K3. |
| Q6 | Zrušiť v sklade LIB obaly `queueItemProcessed`, `queueItemFullyProcessed`, `queueItemFailed`? | V produkcii ich nič nevolá; volá ich päť miest v `LT/uploadQueuesStore.test.ts`. O8 ich nechalo „do kroku 5". | Nechať (tri riadky); zrušenie ako K7c. |
| Q7 | Zjednotiť hromadné čítanie assetov (A20)? | Dve funkcie s tou istou adresou a pravidlami, iný zápis hlásenia. | Nepovinné, K7a, tvar DAM (`useApiRequest` s `report`). Mení tvar hlásenia chyby do zapisovača, preto nie v K1 až K6. |
| Q8 | Zastarané polia riadku `notificationFallbackTimer`, `notificationFallbackTry` | `navrh-krok2.md` (časť 1) ich zánik písal „až v kroku 5". Typ `UploadQueueItem` je verejný. | Nechať: verejné rozhranie sa len rozširuje. |

Rozhodnuté vedúcim 8. 10.: vlna 4 je brána (S2); väzby v DAM ostávajú (2.7). Rozhodnuté vlastníkom 8. 10.
večer: rozdiel ako podaná funkcia, hodnota alebo slot (zásada 6); hranica je produktový rozdiel, nie vnútorné
správanie (zásada 5).

### 5.4 Riziká

| # | Riziko | Čo som našiel | Čo s tým |
|---|---|---|---|
| R1 | **Nahradené (verzia 11).** D4 a jeho dôsledok „0 %" | Vlastník 9. 10. nahradil D4 jedným meračom (krok M): základ sa zapíše pri odoslaní požiadavky, takže aj kúsok s jedinou udalosťou priebehu dá rýchlosť (`analyzy/meranie-rychlosti.md`, časti 3 a 4). | Ručná skúška po kópii, ktorá M prenesie (4.1); neblokuje. |
| R2 | Testy DAM, ktoré nahrádzajú časť knižnice, majú jednu inštanciu knižnice na súbor | `noc/dam-krok2.md`, „Looked wrong", bod 8. Jedno počítadlo kľúčov riadkov v jadre (Z22) a posledná veľkosť kúska (`damUploadChunkSize.ts:5`) prežijú `vi.resetModules()`, takže poradové číslo v kľúči pokračuje. | Hodnotu kľúča netvrdí žiadny test (grep: len jedinečnosť, `DT/queue/queueAdd.test.ts:100`). Fronty, register a množina „Obnoviť pomôže" sú v inštancii jadra (zásada 4). |
| R3 | Hash v admin-dam pred štartom | Testy po `processUpload` čakajú `advanceTimersByTimeAsync(0)` a hneď tvrdia požiadavky (`DT/upload/uploadSequence.test.ts:84-85`). Po Z3 čaká `uploadInit` na `loadHash()`, ktorý v admin-dam vráti už vyriešený sľub. | `advanceTimersByTimeAsync` vyprázdni ľubovoľný počet mikroúloh (`overenia.md`, J-12), takže štart odíde pred tvrdením. Dve výhrady: časovač s 0 ms naplánovaný počas posunu dostane +1 ms a pri `advanceTimersByTimeAsync(0)` nevybehne; skutočné I/O (dynamický import ešte nenačítaného modulu) nedobehne. Preto pravidlo 6 v 2.3. Ukáže to K3. |
| R4 | Čo testy admin-dam s falošným časom uvidia | Počet `await` medzi `processUpload` a požiadavkou nevidia (`overenia.md`, J-12, J-13). Citlivé sú tri iné veci: (a) nový 0 ms časovač alebo `sleep(0)` na ceste `processUpload` → požiadavka; (b) dynamický import na tej ceste; (c) testy, ktoré po synchrónnom volaní skladu čakajú jediný `await nextTick()` alebo nečakajú vôbec: `DT/queue/slotUploadRow.test.ts:235-243` (`stopUpload`, `clearQueue`), `DT/queue/slotsOverlay.test.ts:127-130` a `DT/queue/overlaySave.test.ts:510-520` (vyčistenie cez tlačidlo), `DT/queue/queueRefresh.test.ts:348-349` (`removeByAssetId`). Test `DT/upload/uploadSequence.test.ts:84-93` tvrdí po jedinom `advanceTimersByTimeAsync(0)` celú cestu po dokončenie. | Na celej ceste po dokončenie žiadny 0 ms časovač ani dynamický import (2.3, pravidlo 6); `stopUpload`, `clearQueue` a telo `removeByIndex` ostanú synchrónne až po svoje zápisy (2.4, pravidlo 5). Zblíženia Z3, Z18 a Z20 menia len počet `await`, a ten je voľný. |
| R5 | Test DAM s podvrhnutým `axios` | Knižnica je v DAM spracovaná spolu s testami (`vitest.config.mts:56`), takže `vi.mock('axios')` ju dosiahne. Dnes neškodí, lebo knižnica volá `axios.isAxiosError` a `axios.isCancel` cez predvolený export, a funkcia „text z polí", ktorú podvrh mieri, ostáva v DAM. | Pravidlo 7 v 2.3. |
| R6 | Dve jadrá v DAM | Sklad LIB sa v DAM vytvorí cez chipy; riadok tam nedostane. | Jadrá nemajú spoločný stav. Test „the notifications" v LIB ostáva. |
| R7 | Odhad riadkov | Počítané z čítania, nie z hotového kódu. | Berie sa ako rád, nie ako cieľ. |
| R8 | Knižnica medzi dvoma kópiami | Po prvej kópii beží DAM s novou knižnicou a starým vlastným kódom. | Knižnica len pribúda; DAM nič, čo importuje, nestratí (`useDamUploadChunkSize` ostáva exportované). Pred každou kópiou celé kontroly knižnice (4.1). |
| R9 | Zblížené správanie v produkcii | Vnútorné zblíženia (časť 6) sa prejavia u používateľov CMS, UGC a admin-dam s vydaním. Väčšina sa nedá vidieť. Vidieť je Z9 (zobrazený text), Z28 (jeden merač: percentá, odhad rýchlosti a zvyšného času), Z26 (čip s dôvodom od servera v knižnici aj v admin-dam, v admin-dam aj upozornenie; zvyšný čas je kozmetika), Z15 (časovanie: ďalší súbor sa spustí hneď), Z17 (zvyšné kúsky sa prestanú posielať), Z29 (v admin-dam riadok hromadnej úpravy po zlyhanom a potom spracovanom súbore) a Z2 (hlásenia v Sentry, nie na obrazovke). | Register v časti 6 je to, čo sa napíše do changelogov (K7d). Vlastník tieto položky potvrdil alebo rozhodol 9. 10.; keby niektorú odvolal, vráti sa ako člen sady. |
| R10 | Veľkosť kúska je stav modulu a testy ju nevidia | Každý test uploadu v DAM má `minSize` rovné `maxSize` (`seedDamConfig`, `DT/support/fakeDam.ts:386`), takže prepočet nikdy nič nezmení. Po Z6 sa prepočíta za inej podmienky než dnes. | Vnútorné (Z6); test na to netreba. |
| R11 | Časovač merača po zlyhaní | Po Z10 zastaví merač zlyhaného uploadu len služba; sklad LIB `stopSpeedCheck` už nevolá. Keby služba vynechala jeden spôsob zlyhania, ostal by časovač na každý zlyhaný súbor. | Nový test v K2: zlyhaný upload s hlásením priebehu nenechá naplánovaný tik (4.2). |
| R12 | Kontrola prečítaných bajtov v testoch admin-dam (Z8) | Testy admin-dam nahrádzajú `FileReader` (`DT/support/fakeDam.ts:353-365`, `DT/upload/uploadStop.test.ts:38-54`). Prvá náhrada vracia `blob.arrayBuffer()`, ktorý happy-dom robí z `Uint8Array` (`admin-dam/node_modules/happy-dom/lib/file/Blob.js:114`), druhá `new ArrayBuffer(…)`; obe sú globálny `ArrayBuffer`. | **Vyriešené čítaním** (Codex a Opus, posudky verzie 5). Potvrdí to prvý beh testov v K3. |

### 5.5 Čo som nevedel overiť

1. Nič nebežalo: testy, `vue-tsc`, lint ani build. Tvrdenia „bez zmeny" a „ostane zelený" v 4.3 a 4.4 sú
   z čítania testov a kódu.
2. Z1: správanie axiosu pri `FormData` je overené vo verziách 1.15.0 až 1.20.0; staršie verzie z rozsahu
   `^1.13.4` žiadny zo štyroch projektov nepripúšťa (všetky majú `^1.20.0`; `overenia.md`, J-03).
3. Z27 (PV3): že core-dam typ časti `file` nečíta, je overené na lokálnej kópii (`core-dam-bundle` 1.52.0,
   `overenia.md`, J-04), nie na nasadenej verzii.
4. Z17: pôvodný dôvod „odstránený riadok nikto nečíta" bol nesprávny (posudky K4 c1, c2: obnovenie v admin-dam riadok
   drží, `AssetQueueEditable.vue:35-46`); záver „nič viditeľné" stojí na tom, že sled obnovenie → odstránenie sa v rozhraní
   dá vyvolať len zriedkavým súbehom (posudok K4 c3; odvodené z kódu, nie z behu).
5. Krok M: ako často posielajú udalosti priebehu Firefox a Safari a koľko tela prevezme sieťový zásobník naraz
   (`analyzy/meranie-rychlosti.md`, časť 8); ukáže ručná skúška po kópii. Nasadené veľkosti `imageChunkConfig`
   (predvolené 1 MB a 50 MB, J-06).
6. R12: že náhrady `FileReader` v testoch DAM dávajú `ArrayBuffer`, ktorý prejde `instanceof`, je z čítania
   (oba posudky verzie 5); potvrdí to prvý beh K3.
7. Vlnu 4 testov som zatriedil podľa `lib-vlna4.md` (18:14) a `dam-vlna4.md` (18:32) a podľa hlavičiek súborov;
   prípady som nečítal jeden po druhom.
8. `admin-cms` a `admin-ugc` som čítal len na to, čo z knižnice importujú (sklad ani službu uploadu
   neimportujú) a aké kľúče front a verziu axiosu používajú.
9. Z2: Sentry je v nasadení admin-dam zapojené pre všetky prostredia (`overenia.md`, J-10); overiť ostáva len,
   či má tajomstvo DSN v Azure hodnotu.
10. Ktoré testy zblíženia naozaj zhodia, je z čítania (4.3, 4.4); register v časti 6 uvádza tie, ktoré som
    našiel, a každý krok doplní tie, ktoré nájde beh.

---

## 6. Register zblížení (pre vlastníka)

**Ako ho čítať.** Každý riadok je jedna vec, ktorú spoločný kód robí na oboch stranách rovnako, hoci ju doteraz
každá strana robila inak alebo jedna z nich chybne. Pri každom je, čo robila knižnica (to dostávajú CMS a UGC),
čo admin-dam, čo sa berie a prečo, čo by si mohol všimnúť používateľ alebo aplikácia, a ako to zaraďujem:
**vnútorné** (nikto to nevidí), **kozmetika** (vidno to, ale nič sa tým nemení), **chyba jednej strany** alebo
**chyba oboch strán** (berie sa správne správanie). Produktový rozdiel sem nepatrí: ostáva na každej strane (2.8)
alebo bol témou pre vlastníka (5.2). Ak vlastník pri niektorom riadku usúdi, že je to produkt, riadok sa presunie
do 5.2 a rozdiel sa vráti ako člen sady. Riadky s „potvrdené 9. 10." alebo „rozhodnuté 9. 10." boli témy pre
vlastníka; vlastník ich potvrdil alebo rozhodol 9. 10. (5.2).
Posledný stĺpec je pre toho, kto chce dôkaz: miesta v kóde, krok, v ktorom sa zblíženie stane, a testy, ktoré
sa kvôli nemu menia.

**Každý ďalší krok implementácie (K0 až K7, M, F2, F4, F5, PV10, PV14a, PV16 a opravy admin-dam zo 4.1) dopíše do tohto registra každé zblíženie, ktoré spraví a
ktoré tu nie je, skôr než krok skončí, v tom istom tvare.** Register je jediné miesto, ktoré vlastník číta; z
neho sa robia aj záznamy do changelogov (K7d). Kto pri kroku zistí, že by musel zmeniť produktové správanie,
nezblíži ho a vráti ho vedúcemu ako novú tému.

| # | Čo to je | Knižnica doteraz | admin-dam doteraz | Berie sa a prečo | Čo si kto všimne | Zaradenie | Dôkaz, krok, testy |
|---|---|---|---|---|---|---|---|
| Z1 | Hlavička typu pri posielaní kúska súboru | v nastavení požiadavky ju nastaví na „žiadna" (`undefined`); tým zruší predvolenú hlavičku klienta a typ aj s hranicou častí dopíše prehliadač | v nastavení požiadavky ju prepíše na „multipart/form-data"; prehliadač ju potom aj tak nahradí typom s hranicou | knižnica: tak to odporúča axios a je to jednoduchšie. Riadok s „žiadna" je v admin-dam nutný: jeho klient má predvolené „application/json" a pod ním by sa súbor poslal ako JSON; preto ten riadok po K3 nesmie nikto zmazať | nič; na server ide to isté | vnútorné; **potvrdené 9. 10. (PV1)** | `L-ia:175-177`, `D-ia:94-96`, `admin-dam/src/shared/apiClients/damClient.ts:16`, `node_modules/axios/lib/helpers/resolveConfig.js:65-73`; K3; test `DT/upload/uploadRequests.test.ts:107-109` |
| Z2 | Kontrola kúska pred odoslaním a hlásenie do Sentry | kúsok bez obsahu, so zlou veľkosťou alebo posunom neodíde a zapíše sa do Sentry; odpoveď 400 tiež | nekontroluje, nehlási | knižnica: diagnostika, ktorú knižnica dostala neskôr (`f15b1b5d`) | používateľ nič (v bežnom toku je kúsok vždy v poriadku); admin-dam začne posielať do Sentry hlásenia o odmietnutom kúsku a o odpovedi 400 a vypíše ich do konzoly prehliadača | vnútorné (diagnostika); **potvrdené 9. 10. (PV2)** | `L-ia:75-169,190-211`, `D-ia:77-110`, `admin-dam/package.json:44`; K3; testy `DT/upload/fileApiDispatch.test.ts:24`, `DT/upload/uploadRequests.test.ts:116` (pošlú `Blob` namiesto textu) |
| Z3 | Kedy sa pripraví výpočet kontrolného súčtu súboru a kedy sa riadok označí „posiela sa" | súčet až pri štarte súboru (načíta sa knižnica `rusha`, najviac 15 s); riadok sa označí ešte pred tým | súčet hneď; riadok sa označí tesne pred štartom | knižnica; admin-dam dá hotový súčet hneď a jeho `rusha` ostane v jeho balíku | nič; priame volanie posielania bez prípravy (robia ho len testy) v admin-dam odmietne | vnútorné | `L-us:242-252,284-285`, `D-us:116,237`; K3; `DT/upload/uploadStop.test.ts`: deväť prípadov dostane `await uploadInit()` |
| Z4 | Texty dvoch chýb pri štarte (riadok bez súboru, odpoveď štartu bez identifikátorov) | vlastné texty | iné vlastné texty | admin-dam (originál; oba sú v poriadku); pre prázdny súbor, ktorý admin-dam neodmieta, ostáva text knižnice | nič: nikto ich neukazuje a sklad admin-dam z nich ukáže všeobecný text ako dnes | vnútorné | `L-us:254-267`, `D-us:230-247,57-77`; K2, K3; žiadny test ich netvrdí |
| Z5 | Ako upload zistí, že ho používateľ zastavil, a čím skončí | podľa stavu riadku na piatich miestach (piate, `catch` pokusu kúska, doplnené po posudku K2); chyba „Upload stopped" | podľa príznaku na šiestich miestach; text „upload stopped" | oboje na všetkých miestach; chyba knižnice | nič; v knižnici riadok, ktorý server už ohlásil a ktorý práve čaká na ďalší pokus, už ten pokus nepošle, keď sa zastaví celá fronta | vnútorné | `L-us:163,183,251,287,297` (snímok K2), `D-us:24,113,153,156,191,251,276,283`; K2, K3; žiadny test sa nemení |
| Z6 | Čo sa stane po neúspešnom poslaní kúska | zrušený pokus končí hneď; po poslednom pokuse ešte prepočíta veľkosť kúska, prípadne ho znova prečíta a čaká 1 ms | zrušený pokus čaká pauzu a až potom končí (keby ho nikto nezastavil, skúsi znova); po poslednom končí hneď | zrušený pokus končí hneď (knižnica); po poslednom koniec hneď a veľkosť sa prepočíta len pred ďalším pokusom (admin-dam) | nič; po zlyhanom alebo zastavenom uploade môže mať prvý kúsok ďalšieho súboru inú veľkosť (len keď konfigurácia dovolí rôzne veľkosti) | vnútorné | `L-us:167-208`, `D-us:162-195`, `damUploadChunkSize.ts:5-32`; K2, K3; žiadny test sa nemení |
| Z7 | Kontrola identifikátora súboru pred kúskom | je | nie je (poslal by kúsok na zlú adresu) | knižnica | nič: cez sklad sa riadok bez identifikátora ku kúsku nedostane | vnútorné | `L-us:128-131`, `D-us:139-142`; K3 |
| Z8 | Kontrola, či sa časť súboru prečítala ako bajty | je | nie je | knižnica | nič: prehliadač dáva vždy bajty | vnútorné; **potvrdené 9. 10. (PV11)** | `L-us:62-81`, `D-us:79-93`; K3; náhrady čítania v testoch admin-dam vracajú bajty (R12, vyriešené čítaním) |
| Z9 | Posledné hlásenie priebehu po odoslaní posledného kúska | ešte jedno hlásenie príde a ukáže 100 % a žiadny zvyšný čas, ak upload stihol zmerať rýchlosť | hlásenia chodia, kým server neodpovie na dokončenie; podľa toho, ako rýchlo server dokončí, môže v riadku zoznamu ostať posledné namerané percento so zvyšným časom (aj pri zelenej fajke hotového riadku) alebo točiace sa koliesko | knižnica: hotový súbor má ukázať plný kruh a žiadny zvyšný čas | v riadku zoznamu admin-dam sa po odoslaní posledného kúska ukáže plný kruh bez zvyšného času, ak upload stihol zmerať rýchlosť. Bez zmeranej rýchlosti sa nemení nič. | viditeľné (zobrazený text; Codex to zaraďuje ako produkt), preto rozhodne vlastník; **potvrdené 9. 10. (PV5)** | Podmienky: tik merača beží raz za sekundu, prvý hneď na začiatku posielania, a ohlási priebeh, len keď už je aspoň jedna vzorka rýchlosti (`L-us:211-214`, `D-us:198-217,265-267`); vzorka vzniká až z druhej udalosti priebehu toho istého pokusu, lebo prvá len zapíše základ (`D-us:124-137,166-169`); admin-dam zruší časovač, keď server odpovie na dokončenie (`D-us:220-226,288-290`); knižnica po poslednom kúsku ďalší tik neplánuje, ale naplánovaný nechá dobehnúť (`L-us:296`); zvyšný čas sa v riadku kreslí, kým je kladný, bez ohľadu na stav a priebeh na začiatku je `null` (`asset/components/queue/AssetQueueItemList.vue:83-108,141-146`, `uploadQueue/factory/UploadQueueItemFactory.ts:45-46`). K3. |
| Z10 | Zastavenie merača rýchlosti po zlyhaní | zastaví ho sklad, keď beh zlyhá | zastaví ho služba sama, keď posielanie opúšťa svoj `try`, aj pri posielaní bez prípravy (veľkosť z riadku, súčet je pripravený od začiatku); bežať ho nechá len riadok bez súboru, ktorý odmietne ešte pred `try` | služba ho zastaví sama pri každom zlyhaní, aj pri riadku bez súboru a pri posielaní bez prípravy (tvar admin-dam, doplnený): nezávisí od toho, kto službu volá | nič | vnútorné | `L-us:231-237,278-285`, `L-st:328`, `D-us:264-290,295` (odmietnutie `:270` pred `try` na `:273`); K2; test K2 (4.2) |
| Z11 | Kto zapíše text pri odpovedi 400 po štvrtom pokuse | služba zapíše text „kúsok neprešiel kontrolou" | služba nič; sklad zapíše všeobecný text | služba zapíše text svojej strany (admin-dam ako ten text dá svoj všeobecný) | nič: knižnica ukáže to, čo dnes, admin-dam tiež. Výnimka (posudok K3, 9. 10.): v prípade Z26 (server riadok zlyhal počas posielania, usadzovanie zmazalo text) zapíše služba admin-dam pri 400 po štvrtom pokuse svoj všeobecný text do riadku skôr než sklad, takže sklad riadok považuje za ohlásený a upozornenie navyše neukáže (dnes ho ukáže); zriedkavé a neoverené (core-dam vráti 400 pri chybnom tele kúska alebo chýbajúcom súbore bez ohľadu na stav súboru, `ChunkParamValueResolver.php:42-50`; posudok K3 c2) a F4 to upozornenie po K6 aj tak ruší | vnútorné | `L-us:185-188`, `D-st:691,698`, admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts:693-704`; K3 |
| Z12 | Funkcia, ktorá skladá text z chybných polí | vlastná | vlastná, s kontrolou, že ide o chybu axiosu | jedna funkcia s textami každej strany, s kontrolou admin-dam (originál) | nič: na tejto ceste je to vždy chyba axiosu | vnútorné | `L-us:35-60`, `D-us:30-55`, common-admin `src/shared/error/AnzuApiValidationError.ts:22-29`; K2, K3; `DT/upload/uploadErrorMessage.test.ts` bez zmeny |
| Z13 | Zápis riadku alebo počtov do fronty, ktorá neexistuje | nestane sa nič | chyba programu | knižnica | nič: v produkte sa to nestáva | vnútorné | `L-st:267-271,285-292`, `D-st:592-594,774-779`; K6 |
| Z14 | Prepočet počtov fronty po úspešnom uploade | neprepočíta | prepočíta len po importe | prepočíta vždy | nič: počty sa rátajú zo stavov, nanajvýš sa obnoví zastaraný počet | vnútorné | `L-st:325-326`, `D-st:656-660,677-678`; K5, K6 |
| Z15 | Zastavený riadok a voľné miesto pre ďalší súbor | riadok, ktorého upload po zastavení zlyhá, sa označí „zlyhal" (vo fronte už nie je); ďalší súbor sa spustí až po tom zlyhaní, pri riadku v pauze medzi pokusmi o 1 až 9 s neskôr | riadok ostane „zastavený"; ďalší súbor sa spustí hneď pri odstránení | admin-dam | v knižnici (CMS, UGC) sa po odstránení súboru, ktorý čakal na ďalší pokus, ďalší súbor spustí hneď | vnútorné (časovanie); **potvrdené 9. 10. (PV6)** | `L-st:331-348,408-414`, `D-st:568,681-684`; odložený nález 15; K5; mení sa test J-01 `LT/uploadQueuesStore.test.ts:463-480` (K5-c1: po K5 by inak nevedel zlyhať na „stops"; pribudlo tvrdenie zrušenia kúska a stavu Stop) |
| Z16 | Upload zlyhá, keď server už ohlásil súbor ako hotový | ešte prepočíta a spustí ďalší | nič | admin-dam | nič: to isté už spravilo spracovanie notifikácie | vnútorné | `L-st:334,346-347`, `D-st:687`; K5 |
| Z17 | Čo urobí odstránenie, „Zrušiť", zastavenie a vyčistenie fronty s uploadom, ktorý ešte beží | upload riadku, ktorý server medzitým ohlásil (hotový alebo zlyhaný), beží ďalej a nikto ho nevidí; zastavenie fronty mu nechá dobehnúť kúsok. Asset, ktorý štart uploadu vytvoril, ostane na serveri (tak ako po zmene) | zastaví každý živý upload; každý odstránený riadok označí „zastavený" | jedno pravidlo admin-dam z vyčistenia fronty: zastaví sa riadok na ceste a riadok so živým uploadom; hotový riadok bez uploadu ostane, aký je | v knižnici sa po odstránení alebo zastavení takého riadku prestanú posielať zvyšné kúsky jeho súboru; asset, ktorý štart vytvoril, ostane na serveri ako dnes (odstránenie ani zastavenie ho nemaže); v admin-dam nič viditeľné: v admin-dam sa to môže prejaviť len pri obnovení: `D/asset/components/queue/AssetQueueEditable.vue:35-46` drží riadok cez `await refreshQueueItem` a `refreshFailed` potlačí, len keď sa stav počas obnovenia **zmenil** na Failed, Uploaded alebo Stop (`item.status !== statusBefore`); riadok, ktorý po K6 ostane Uploaded, stav nezmení, takže upozornenie sa po odstránení už nepotlačí. „Obnoviť" na nahratom riadku je však len bez formulára alebo s chybou a kôš je dovtedy vypnutý (okrem duplikátu) (`AssetQueueItemEditable.vue:233-251,421`), takže ten sled sa v rozhraní dá vyvolať len zriedkavým súbehom (posudok K4 c3: `refreshDisabled` vypne len „Obnoviť", nie kôš; čítanie metadát zaradené pred obnovením môže zapnúť formulár a s ním kôš, kým obnovenie čaká, `uploadSettlement.ts:135-142,631-637`, `uploadSettle.ts:584`; keď potom obnovenie vráti chybu, po K6 sa po odstránení ukáže `refreshFailed`, dnes ho `D-st:559` potlačí); viditeľná zmena v bežnom toku nepreukázaná, na K6 strážiť (plán K6) (posudky K4 c1, c2; dôvod „odstránený riadok nikto nečíta" bol nesprávny). **K6 (10. 10.):** stráž v obale admin-dam (`AssetQueueEditable.vue`, `!list.value.includes(item) ||`) drží dnešné správanie pri koši, „Zrušiť" a prekrytí; pri `clearQueue` je širšia (dnes riadok po vyčistení stav nemenil a `refreshFailed` by sa ukázal, teraz nie), no vyčisťuje sa len zoznam hromadnej úpravy, ktorého riadky „Obnoviť" neponúkajú, takže nič viditeľné. C32 zasiahne aj riadok hromadnej úpravy v stave `Loading`, odobratý zrušením výberu (`D/asset/components/list/composables/assetListActions.ts:343`): ostane `Loading` namiesto Stop; odstránený riadok nikto nečíta, nič viditeľné (posudok Opusa K6) | chyba jednej strany (knižnica); **potvrdené 9. 10. (PV7)** | `L-st:396-427,470-518` (nič v nich asset nemaže), `D-st:555-570,612-650,781-802`; tretia sada rozhodnutí, bod 7; K5, K6 |
| Z18 | Či „Zrušiť" čaká na odstránenie riadku, kým spustí ďalší súbor | nečaká | čaká jeden krok | nečaká | nič | vnútorné | `L-st:416-427`, `D-st:648`; K6 |
| Z19 | Vyčistenie fronty, ktorá neexistuje | nespraví nič | vytvorí prázdnu | admin-dam | nič: v knižnici sa volá len nad existujúcou frontou | vnútorné | `L-st:507-508`, `D-st:795-801`; K5 |
| Z20 | Import od externého poskytovateľa ide tým istým štartom ako upload | — (import nemá) | vlastná vetva | spoločný štart; import má prázdne „pošli" a „zastav" | nič | vnútorné | `D-st:654-662`, `D-ep:7-52`; K6; riziko R4 |
| Z21 | Podľa čoho si jadro pamätá bežiace uploady | nepamätá si ich (zastavuje stavom riadku) | podľa riadku, ako ho dostalo | admin-dam (originál): register je pre zastavenie podľa jedného pravidla potrebný aj v knižnici (Z17) | nič | vnútorné | `D-st:68,671`; K5 (admin-dam sa nemení) |
| Z22 | Počítadlo kľúčov riadkov | v module skladu knižnice | v module skladu admin-dam | jedno v jadre | nič: kľúče sú len jedinečné značky a ich tvar ostáva | vnútorné | `L-st:53-54`, `D-st:78-79`; K5, K6; hodnotu kľúča netvrdí žiadny test |
| Z23 | **Nahradené (verzia 11) položkou Z28.** Prvé meranie rýchlosti uploadu (oprava F1) | zarátava aj bajty pred prvým meraním | to isté | — | — | nahradené: chybu rieši jeden merač (Z28, krok M) | `L-us:111-124`, `D-us:124-137` |
| Z24 | Hromadné vyplnenie dá všetkým riadkom ten istý zoznam | áno | áno | každý riadok vlastnú kópiu | dnes nič; zabráni, aby zmena na jednom riadku zmenila aj ostatné | chyba oboch strán; **potvrdené 9. 10. (PV8)**; až po K6 | `L-mo:31,41`, `D-st:840,852`; nález 12; F2; `LT/uploadQueueMassOperations.test.ts:108`. **V LIB hotové v kroku F2 (11. 10.):** `L/uploadQueue/core/uploadQueueFill.ts` dá každému riadku vlastnú kópiu kľúčových slov, autorov aj vlastného poľa s viac hodnotami (pole hodnôt); prípad `:108` otočený („hand every filled row a list of its own"), dva nové prípady vlastného poľa; admin-dam s C3 (jeho sklad volá tie isté funkcie, `admin-dam/src/domains/coreDam/asset/store/uploadQueuesStore.ts`) |
| Z25 | **Vyradené (verzia 7).** Riadok hromadnej úpravy, ktorého súbor zlyhal a potom ho server spracoval | — (hromadnú úpravu nemá) | stav ostane „zlyhal" a formulár zamknutý (podrobne v 5.2, PV9) | nič sa nezbližuje: oprava F3 verzie 6 (stav na „hotový") je vyradená | zmena stavu by vytvorila nové správanie: po 20 s tlačidlo „Obnoviť", ktoré metadáta nenačíta a nič neurobí, a neskoršia notifikácia metadát by riadok dostala do hromadného uloženia, čo dnes nejde | produkt, preto nepatrí sem; PV9 vlastník 9. 10. rozhodol opravou F5, ktorá vráti stav aj formulár naraz (Z29) | `uploadSettle.ts:357,582,616-618`, `uploadSettlement.ts:589-590`, `asset/components/footer/AssetFooterSelectedFull.vue:198`, `DT/queue/slotNotifications.test.ts:775,837` |
| Z26 | Súbor, ktorý server ohlási ako zlyhaný ešte počas posielania | posiela sa ďalej a uvoľní miesto: pri limite dvoch idú tri súbory; ak neskorší kúsok dostane odpoveď 422 (validácia) alebo pri štvrtom pokuse 400, služba zapíše do riadku svoj text a riadok aj dialóg jedného súboru ho ukážu namiesto čipu s dôvodom od servera (podľa toho, ako server odpovie) | to isté; neskoršie zlyhanie uploadu môže podľa toho, ako server odpovie, prepísať v riadku čip s dôvodom od servera vlastným textom a ukázať upozornenie | jadro upload takého súboru zastaví a pri jeho neskoršom zlyhaní riadok, ktorý zlyhal od servera, výslovne preskočí (nevolá hák zlyhania, nič nezapíše ani neohlási) | zbytočné kúsky už neodídu a súbory idú najviac po dvoch; v knižnici aj v admin-dam ostane v riadku čip s dôvodom od servera, v admin-dam nepríde ani upozornenie navyše. Zvyšný čas pri červenej ikone sa môže zobraziť inak než dnes: zamrzne už pri hlásení servera, takže niekedy ostane číslo tam, kde dnes zmizne, inokedy naopak (kozmetika). | chyba oboch strán; viditeľné (čip s dôvodom, v admin-dam aj upozornenie; zvyšný čas je kozmetika); **potvrdené 9. 10. (PV13)**; až po K6 | Podmienky: dnes beží mŕtvy upload ďalej a merač s ním; keď upload skončí alebo zlyhá, časovač sa zruší (`D-us:220-226,288-290`) a v riadku ostane posledné zapísané hlásenie; po poslednom kúsku ukáže tik 100 % a 0 s; zvyšný čas sa kreslí, len kým je kladný (`asset/components/queue/AssetQueueItemList.vue:141-146`); priebeh po zlyhaní nikto nemaže. Neskoršie zlyhanie u klienta a jeho text a upozornenie: `D-st:690-704`, `asset/components/queue/AssetQueueItemEditable.vue:346-352`; v knižnici text služby po odpovedi 422 alebo 400 pri štvrtom pokuse (`L-us:183-195`), zapísaný po tom, čo usadzovanie pri hlásení `failed` text zmazalo (`L/uploadQueue/settlement/uploadSettle.ts:356`), a zobrazený namiesto čipu (`L/uploadQueue/components/UploadQueueItemEditable.vue:281-286`, `UploadQueueDialogSingle.vue:448-453`); či nastane, závisí od toho, ako core-dam odpovie na kúsky a dokončenie zlyhaného súboru (neoverené). Limit dvoch: `L-st:300-312`, `D-st:596-610`. Nález 21; F4; testy v 4.1. **V LIB hotové v kroku F4 (11. 10.):** `L/uploadQueue/core/uploadQueueCore.ts` — v `onRowFinal` jadro zastaví živý beh riadku, ktorý usadzovanie zlyhalo (`stop()` behu a zrušenie kúska na ceste), a v `catch` behu riadok `Failed` preskočí; riadok bez živého behu sa nezastavuje. Testy: `LT/uploadNotificationEvents.test.ts` („stops sending a file that is still being sent, and gives its place to the next one", otočený `:461`), `L/uploadQueue/core/__tests__/uploadQueueCore.test.ts` (otočený „stops the run of a row the server failed…", nový „…with nothing to stop", obe sady); admin-dam s C3 (`DT/queue/queueOperations.test.ts:231`) |
| Z27 | Typ súboru na časti kúska v požiadavke | posiela typ súboru (napríklad „image/jpeg") | neposiela (prehliadač dá „application/octet-stream") | knižnica (rozhodnutie vedúceho): knižnica a jej dva profily (CMS, UGC) ostanú presne ako dnes a typ pripínajú dva jej testy; server typ časti nečíta a typ kúska určí z obsahu | nič; admin-dam začne posielať typ, ktorý server nečíta | vnútorné; **potvrdené 9. 10. (PV3)** | `L-us:158-160,199-201`, `D-us:157,188`; core-dam, lokálna kópia `core-dam-bundle` 1.52.0: `src/Request/ValueResolver/ChunkParamValueResolver.php:46`, `src/Domain/Chunk/ChunkFileManager.php:36` (`overenia.md`, J-04); K3; žiadny test sa nemení (typ pripínajú `LT/uploadServiceSequence.test.ts:76-82` a `LT0/consumerProfileUpload.test.ts:99-101`, testy admin-dam tvrdia na kúsku len meno a veľkosť) |
| Z28 | Meranie rýchlosti a priebehu uploadu (jeden merač) | rýchlosť z udalostí priebehu naprieč kúskami (odznova len po zlyhanom pokuse), nevážený priemer 15 vzoriek; percentá sa posunú len po celom kúsku; prvá vzorka ráta aj bajty spred nej | to isté, ale každý pokus meria odznova, takže kúsok s jedinou udalosťou nedá vzorku: na rýchlej sieti často točiace sa koliesko bez času a kúsky nerastú | jeden merač (rozhodnutie vlastníka 9. 10. namiesto D4 a F1): krivka odoslaných bajtov od odoslania požiadavky, rýchlosť za posledných 10 s, percentá aj počas kúska | v knižnici (CMS, UGC) aj v admin-dam sa percentá hýbu aj počas kúska (súbor z jedného kúska už nestojí na „0 %") a pri opakovanom pokuse neklesnú; bajty kúska na ceste sú v podiele aj v zvyšnom čase, takže po prevzatí tela posledného kúska prehliadačom je 100 % a 0 s už počas čakania na odpoveď servera (jednokúskový súbor namiesto „0 %" čaká na „100 %"; na vedomie vlastníkovi, M-c1); zvyšný čas odpočítava plynulo a je skôr dlhší, lebo rýchlosť ráta aj čakanie na odpovede predošlých kúskov; pri úplnom zastavení toku rýchlosť klesá a odhad rastie až k hodinám, posledná hodnota pred tichom ostane v riadku a ďalší kúsok sa zmenší (na rozhodnutie vlastníka, možnosti A až C v `impl/M.md`); v admin-dam na rýchlej sieti kruh s percentami a časom namiesto kolieska; veľkosti kúskov sa mierne zmenia (vnútorné) | viditeľné (priebeh a odhad); **potvrdené 9. 10. (PV4, PV12)** | `analyzy/meranie-rychlosti.md` (časti 1 až 6); `L-us:111-124,173-176,211-229`, `D-us:124-137,166-169,198-218`; krok M po K6; testy v 4.1. **V LIB hotové v kroku M (11. 10.):** nový nevyvezený `L/uploadQueue/composables/uploadMeter.ts`, `L-us` volá merač namiesto vzorkovača, `speedBaseline` zo sád zmizol; v pauze pred opakovaným pokusom sa nehlási (krivka sa zahodí už pri zlyhaní: `attempt(veľkosť)` a `attemptFailed()` namiesto náčrtu `attempt(veľkosť, opakovanie)`, `impl/M.md`); `LT/uploadMeter.test.ts` (11 prípadov, od M-c1 13), `LT/uploadServiceRetry.test.ts` dva prípady s novými číslami; M-c1: pri bodoch s rovnakou milisekundou (falošný čas testov) berie pravý okraj krivky posledný bod, ľavý prvý; testy DAM v C3 |
| Z29 | Riadok hromadnej úpravy, ktorého súbor zlyhal a potom ho server spracoval | — (hromadnú úpravu nemá) | stav ostane „zlyhal" a formulár zamknutý, mimo hromadného uloženia; riadok z `metadataFailures`, ktorému metadáta prinesie notifikácia, dostane formulár, ale ostane „zlyhal" | riadok sa vráti na „hotový" s formulárom, ako ho používateľ nechal, a ide do hromadného uloženia; riadok, ktorému hromadné načítanie metadáta nedalo, sa vráti na text „Metadáta sa nepodarilo načítať"; „hotový" dostane aj riadok, ktorému metadáta prinesie notifikácia (bod 5). Do `leftOutByBatch` zapisuje aj F-A (nález 49, ten istý krok): riadok, ktorému hromadné načítanie nedalo formulár, lebo súbor jeho assetu sa ešte spracúva | v admin-dam: × zmizne, „Upraviť", kôš a formulár sú zapnuté a riadok sa uloží s ostatnými; „Obnoviť" sa neukáže. S dnešným core-dam tento sled pri jednom súbore nenastane (stav „zlyhal" je konečný); oprava je poistka pre poradie doručenia a budúci backend | chyba jednej strany (admin-dam); **rozhodnuté 9. 10. (PV9)**; až po K6 | `analyzy/pv9-riadok-hromadnej-upravy.md`; `D-st:262-282,461-473`, `L/uploadQueue/settlement/uploadSettle.ts:350-363,397-402,577-588`; krok F5 (s F-A, `analyzy/nalez49-frontend.md`, 7.2); testy v 4.1 |
| Z30 | Vlastný asset riadku duplikátu | riadok sa stane originálom a vlastný asset (ten, ktorý vytvoril upload) sa stratí | vlastný asset ostane v `assetId` | nové nepovinné pole `uploadedAssetId` na oboch stranách, ktoré zapíše spoločné usadzovanie raz, keď riadok označí za duplikát | nič: pole v kroku 5 nikto nečíta; v knižnici duplikát ďalej pracuje s originálom, v admin-dam ostane sebou (to ostáva voľbou profilu) | chyba jednej strany (knižnica stráca informáciu); **rozhodnuté 9. 10. (PV10)** | `analyzy/pv10-vlastny-asset-duplikatu.md`; `L/uploadQueue/settlement/uploadSettle.ts:419-455,459-542`; krok PV10; testy v 4.1 |
| Z31 | Kedy upload prečíta klienta a adresu, ktorými pošle dokončenie | štart a kúsok pri volaní `useUpload`, dokončenie znova pri dokončení (`useCommonAdminCoreDamOptions()` v `finishUpload`) | klient a adresy sú pevné v `fileApi.ts` (statický import) | raz, pri vytvorení sady knižnice, pre všetky tri požiadavky (pravidlo 1 v 2.3: sada sa robí pri volaní `useUpload`) | nič: voľby pluginu sa nastavujú raz pri jeho inštalácii; líšilo by sa to len pri novom nastavení volieb počas uploadu (to robia nanajvýš testy) | vnútorné; pridané pri implementácii 9. 10. (K2, odchýlka 3) | `L-us:31-32,88` (snímok K2); `impl/K2.md`; K2; žiadny test sa nemení |
| Z32 | Časový limit `null` pri veľkosti kúska | `apiTimeout ?? undefined`: `null` dá predvolených 30 s | `envConfig.dam.apiTimeout` sa podá bez zmeny; `null` (len ak ho `config.json` výslovne nastaví, typ je `number` a hodnota sa neoveruje) nastaví všetky prahy na 0 a každý kúsok spadne na `minSize` | knižnica: jedna služba, `null` = 30 s | nič pri platnej konfigurácii; admin-dam s `apiTimeout: null` v `config.json` by kúsky veľkosťou prispôsoboval rýchlosti namiesto stálej najmenšej veľkosti | chyba jednej strany (admin-dam), nedosiahnuteľná pri platnej konfigurácii; pridané po posudku K2 9. 10. | `L-us` (`useDamUploadChunkSize(apiTimeout ?? undefined)`, od K2; pred K2 `L-us:104`), `L/uploadQueue/composables/damUploadChunkSize.ts:7,11-13`; `D-us:117`, admin-dam `src/shared/types/EnvConfig.ts:15` a `src/shared/EnvConfigService.ts:40`; B27; K2 (sada), K3 (admin-dam ju začne používať); pripína `LT/uploadServicePresets.test.ts` (prípad `null` pod sadou admin-dam) |
| Z33 | Zastavenie riadku, ktorý nie je vo fronte, ktorú volajúci menuje (`stopItemUpload(queueKey, row)`) | zastaví ho, ale usadzovanie ho ďalej sleduje (`L-st:416-427`, bez `untrack`) | zastaví ho a usadzovanie ho prestane sledovať (`D-st:637-640`) | jadro podľa pravidla 5: zastaví a `untrack` (`L/uploadQueue/core/uploadQueueCore.ts:255`) | nič: každý volajúci podá kľúč fronty, v ktorej riadok vypísal (LIB `UploadQueueEditable.vue:41,45`; DAM `AssetQueueEditable.vue:53,57`, `AssetQueueUploadList.vue:21,25`, `AssetSlotListItem.vue:74,135`), takže stav nie je dosiahnuteľný | vnútorné; pridané po posudkoch K4 (10. 10.) | K4 (jadro), K5; pripína `L/uploadQueue/core/__tests__/uploadQueueCore.test.ts` (prípad „a row that is not in the queue named…") |

**Čo v registri nie je, lebo sa nezbližuje** (produkt, ostáva na každej strane; 2.8): adresy, klient a typy
assetov; texty; časový limit; odkiaľ sa vezme `rusha`; či sa pošle prázdny súbor; import od externého
poskytovateľa; text a upozornenie pri zlyhaní uploadu; „Obnoviť"; sloty a hromadná úprava; čo hromadné operácie
zapíšu pri type, ktorý pole nemá zapnuté; zápis uloženého detailu do riadkov; kontajner front. Bývalé otvorené
témy vlastník rozhodol 9. 10. (5.2): riadok hromadnej úpravy po zlyhanom súbore (F5, Z29), meranie rýchlosti
(krok M, Z28), pamäť duplikátu (PV10, Z30), pomenovaná konfigurácia (PV14a, PV14b) a „nahradiť vo všetkých"
(PV15, želaný stav).

**Testy, ktoré sa menia bez súvisu so zblížením:** O15 v K1b (`LT/uploadStatusFallback.test.ts:1340,1353`,
`LT/uploadQueuesStore.test.ts:39,46,475`, `LT0/damImageApiUploadRequests.test.ts:170`) a nové mená vo
`src/test/publicExportsAdded.test.ts`.

---

## 7. Zvažované a zamietnuté

1. **Sklad LIB z `Map` na objekt** (verzia 1). Zamietnuté po posudkoch: objekt nezvládne kľúče `__proto__` a
   `hasOwnProperty`, pre `toString` by sa správal inak než `Map`, a prechod by menil, ako Vue sleduje vznik
   fronty. Prístup cez `UploadQueuesAccess` nestojí nič a nemení nič.
2. **Objekt bez prototypu pre oba sklady.** Zamietnuté: menilo by to DAM (testy doň sejú obyčajné objekty a
   `reset()` priraďuje `{}`) kvôli kľúčom, ktoré DAM nepoužíva.
3. **Továreň na celý pinia sklad** (`defineUploadQueuesStore(id, options)`). Zamietnuté: DAM má 37 členov,
   z nich polovica je vlastný kód; továreň by ich musela prijať ako rozšírenie a nič by neušetrila.
4. **Jadro importuje `useUpload` priamo** a sklad odovzdá len sadu služby. Zamietnuté: import od externého
   poskytovateľa je iný beh, a testy DAM, ktoré podvrhujú `uploadService` podľa cesty, by prestali účinkovať
   (zásada 1).
5. **Import od externého poskytovateľa v LIB.** Zamietnuté: LIB ho nemá a mať nebude; v DAM stačí jedna
   funkcia nad mapou adries.
6. **Jeden mechanizmus zastavenia** (len `stop()`, alebo stav a príznak na všetkých miestach naraz).
   Zamietnuté: testy služby v LIB zastavujú stavom riadku (`LT/uploadServiceRetry.test.ts:63-66`), a zlúčené
   kontroly by v LIB ukončili beh na inom mieste než dnes. Príklad: riadok, ktorý notifikácia usadila počas
   posielania (už nie je `Uploading`) a ktorý je práve v pauze medzi pokusmi, keď príde `stopUpload`, dnes
   ďalší pokus ešte pošle, lebo jeho požiadavku nikto nezrušil (`L-st:478-488`); kontrola po pauze by mu ho
   zobrala. Bežný riadok `Uploading` v pauze ďalší pokus nepošle ani dnes: `stopUpload` zruší jeho
   `latestChunkAbortController` a axios pokus odmietne pred odoslaním (`LT/uploadServiceRetry.test.ts:164`,
   „in the pause before a chunk is tried again: no further request goes out").
7. **Dočasné zblíženie tam, kde to „nie je vidno"** (PV5 a D4 vo verzii 1). Zamietnuté rozhodnutím vedúceho:
   dočasné pravidlo nemá výnimky.
8. **Pravidlo „len obrázok" v spoločnej službe** (verzia 2). Zamietnuté rozhodnutím O17: priame
   `damUploadStart`, `damUploadChunk` alebo `damUploadFinish` s riadkom iného typu by poslali požiadavku, test,
   ktorý to pripína, by sa musel prepísať, a v dvoch testoch s riadkami bez `assetType` by očerveneli štyri z
   piatich prípadov.
9. **Vypustiť `updateChunkSize` po poslednom a po zrušenom pokuse** (verzia 2, B23 a B10). Zamietnuté: môže
   zmeniť veľkosť a počet prvých kúskov ďalšieho súboru. Po spresnení vlastníka je to vnútorná vec; verzia 5
   prepočítava len pred pokusom, ktorý ešte príde (Z6).
10. **Dve voľby pre zastavenie** (`stoppedRunFails`, `stopRuns`; verzia 2). Zamietnuté: dve zo štyroch
    kombinácií nemá dnes ani jedna strana. Verzia 3 z nich spravila jednu voľbu, verzia 4 funkcie sád.
11. **Jadro prepočíta frontu po každom úspešnom behu** (verzia 2, C23). Verzie 3 a 4 to zamietli, lebo
    prepočet môže zmeniť počet, ktorý číta test dnešného skladu (`seedQueue` seje `processedCount: 0`). Po
    spresnení vlastníka je to vnútorná vec a verzia 5 to robí (Z14); test, ktorý by to zhodilo, sa upraví a
    zapíše do registra.
12. **Zblíženie B10 bez sady** (verzia 3, Z1). Verzia 4 ho držala stratégiou admin-dam; po spresnení vlastníka
    je to vnútorná vec a verzia 5 ho zbližuje (Z6).
13. **Presunúť tri neutrálne požiadavky do `uploadApi.ts`** (verzia 2). Odložené ako upratanie K7e, a to do
    súboru s neutrálnym menom: po presune do `uploadApi.ts` by tri testy, ktoré ten modul podvrhujú, museli
    podvrhnúť aj neutrálne funkcie.
14. **Voľby s vetvami v spoločnom kóde** (verzie 2 a 3). Nahradené sadami podľa usmernenia vlastníka: spoločný
    kód by niesol vetvu za každú tému PV a voľby sa dali namiešať (Opus W1).
15. **Kontroly dvojíc volieb za behu** namiesto sád (Opus W1, druhá možnosť). Zamietnuté: kontrola za behu by
    bol nový kód, ktorý môže zlyhať v produkcii; sady robia nesprávnu kombináciu nemožnou už pri preklade.
16. **Sady admin-dam v admin-dam namiesto v knižnici.** Zamietnuté: knižnica by nemohla zaručiť, že sa sady
    nedajú namiešať (obsah sady by musel byť verejný), a plán chce kód uploadu na jednom mieste. Čo je vec
    aplikácie (texty, upozornenie, obaly požiadaviek, `rusha`, časový limit, beh importu), sada dostáva od nej.
17. **Stratégie ako `async` funkcie.** Zamietnuté: pridali by kroky sľubov do cesty opakovania kúska (R4).
    Stratégia vráti rozhodnutie a čakanie robí kostra.
18. **`writeAssetMetadata` v jadre** (verzia 3). Zamietnuté: zápis detailu sa na stranách líši vo všetkom okrem
    štyroch polí a líši sa aj tým, čo používateľ uvidí (návrhy mien, konflikty autorov), takže je to produkt.
19. **Sady, ktoré prepisujú aj vnútorné správanie každej strany** (verzia 4). Nahradené po spresnení vlastníka:
    vnútorné rozdiely sa zbližujú a sady držia len produkt; spoločný kód je jeden priebeh s tromi hodnotami.
20. **Zblížiť aj kontajner front** (Map v LIB, objekt v DAM). Zamietnuté, hoci by smelo: testy DAM sejú do
    `queues` priamo (`DT/support/fakeDam.ts`, `seedQueue`) a objekt v LIB by zaviedol obmedzenie kľúčov, ktoré
    knižnica dnes nemá. Kontajner je stav skladu a nestojí nič.
21. **Zblížiť aj prázdny súbor** (B5). Zamietnuté: mení, čo sa pošle na backend, takže je to produkt.
22. **Zblížiť hash na lenivé načítanie aj v admin-dam bez väzby `loadHash`.** Zamietnuté: dynamický import nie je
    časovač, takže by rozbil testy admin-dam s falošným časom (R3), a statické `rusha` v knižnici by ho pridalo
    každej stránke CMS a UGC.
23. **Oprava F3: riadok hromadnej úpravy po zlyhanom a potom spracovanom súbore späť na „hotový"** (verzie 5 a
    6, PV9). Vyradené rozhodnutím vedúceho: samotná zmena stavu by ukázala „Obnoviť", ktoré nič neurobí, a
    neskoršia notifikácia metadát by riadok dostala do hromadného uloženia. PV9 vlastník 9. 10. rozhodol opravou
    F5, ktorá vráti stav aj formulár naraz (Z29).
24. **D4 (meranie rýchlosti podľa admin-dam) a oprava F1** (do verzie 10.3). Nahradené rozhodnutím vlastníka
    9. 10. jedným meračom (krok M): tvar admin-dam by kúsku s jedinou udalosťou nedal vzorku (R1) a F1 by opravila
    len prvú vzorku.
25. **`uploadedAssetId` len v `becomeOriginals`** (odporúčanie verzie 10.3). Zamietnuté podľa analýzy PV10: v
    admin-dam by pole ostalo vždy prázdne, takže by to isté pole znamenalo na stranách niečo iné.
26. **Pomenovanú konfiguráciu pri uploade nepodporovať** (odporúčanie PV14 vo verzii 10.3). Nahradené rozhodnutím
    vlastníka 9. 10.: plná podpora (PV14a, PV14b).

---

## 8. Posudky: čo som neprevzal tak, ako bolo navrhnuté

### 8.1 Posudky verzie 7 (verzia 7 → 8)

Zapracované je všetko, čo vedúci z posudkov vybral (tabuľka „Verzia 8 oproti verzii 6 a 7"). Pri PV3 verzia 7
brala podľa zásady 5 variant admin-dam s tým, že sa mení jeden test knižnice; oba posudky našli druhý
(`LT0/consumerProfileUpload.test.ts:99-101`, pod profilmi CMS aj UGC). Vedúci rozhodol variant knižnice: ten
nemení žiadny test a knižnicu nechá presne ako dnes.

### 8.2 Posudky verzie 6 (verzia 6 → 7)

Zapracované bolo všetko, čo vedúci z posudkov a z `overenia.md` vybral (tabuľka „Verzia 7 oproti verzii 6").
Pri PV3 som vtedy vybral variant admin-dam; verzia 8 to zmenila (8.1).

### 8.3 Posudky verzie 5 (verzia 5 → 6)

Zapracované je všetko, čo vedúci z posudkov vybral (tabuľka „Verzia 6 oproti verzii 5"). Neprevzatý je jeden
bod Codexu:

1. **Codex, GAP: `queues` a `loadHash` sú vnútorné a dali by sa zblížiť.** Neprevzaté. Kontajner front:
   vlastník výslovne povedal, že iný kontajner nie je problém, a zblíženie by stálo prepis testov admin-dam,
   ktoré do `queues` sejú; jadro k obom pristupuje jedným kódom. Zdroj `rusha`: priebeh je už jeden (Z3); líši
   sa len to, odkiaľ aplikácia modul vezme, a lenivé načítanie v admin-dam by rozbilo jeho testy s falošným
   časom (7.22), statické v knižnici by ho pridalo každej stránke CMS a UGC.

### 8.4 Spresnenie vlastníka (verzia 4 → 5)

Tretie posudky a body Opusa som po spresnení posúdil znova:

1. **Codex, päť porušení (Z1, Z2, Z7, Z9, Z11 verzie 3)** sú vnútorné: zrušený kúsok (Z6 registra), kontrola
   `fileId` (Z7), kontroly stavu a príznaku (Z5), kľúč registra (Z21, tvar admin-dam), počítadlo kľúčov (Z22).
   Zblížené.
2. **Codex GAP pri C25** (beh zlyhá pri riadku `Uploaded`): vnútorné, zblížené na tvar admin-dam (Z16); testy K0
   odpadli.
3. **Opus G1** (prípady prepočtu veľkosti kúska): prepočet je vnútorný (Z6); testy K0 odpadli, a s nimi aj
   problém stavu modulu medzi prípadmi.
4. **Opus G2** („400 nič nehlási"): kontroly a hlásenia sú zblížené na tvar knižnice (Z2, na potvrdenie); test
   K0 odpadol. Že sa hlási, overí nový test v K2.
5. **Opus G3** (poradie zápisov): vnútorné; jadro aj tak zapisuje v poradí admin-dam; test K0 odpadol.
6. **Opus W1** (kombinácie): zostali len produktové členy; sadu vyrobí len jej funkcia a typ nesie stranu.
7. **Opus W2** (`useDamUpload`): export v K2, lebo ho potrebuje K3; s predvolenou sadou je to služba knižnice so
   zblíženiami z registra.

### 8.5 Tretie posudky (verzia 3 → 4)

História. Ako to vyriešila verzia 4; po spresnení vlastníka platí 8.4.


Všetko z posudkov a zo zadania vedúceho je zapracované. Kde posudok ponúkal viac ciest, alebo kde som šiel
inak:

1. **Codex, BREAKS RULE (Z1, Z2, Z7, Z9, Z11).** Vedúci pripustil prijať rozdiel s dôkazom, ak je zachovanie
   drahé. Ani jeden nebol drahý, takže sa neprijal žiadny; všetkých päť drží sada (6.3). Rovnako ostatných šesť
   zblížení verzie 3, ktoré Codex za porušenie nepovažoval.
2. **Opus W1: „sady, alebo obmedziť dvojice typom či kontrolou za behu".** Sady (prvá cesta), a navyše tak, že
   sada sa nedá zostaviť z častí a typ nesie stranu. Kontrola za behu zamietnutá (7.15).
3. **Opus W2: „neexportovať v K2, alebo povedať pravý dôvod".** Pravý dôvod (2.6): export potrebuje kópia pred K3.
   Zblíženia Z3 a Z4, ktoré sa naň odvolávali, zanikli.
4. **Opus G1: „vlastné súbory, alebo vynulovať stav modulu".** Vlastné súbory: stav modulu sa z testu
   vynulovať nedá, `chunkSize` je súkromný `ref` (`damUploadChunkSize.ts:5`).
5. **Opus G2: „synchrónny `console.error`, alebo najprv vyprázdniť dynamický import".** Prvá cesta, s
   dôkazom ohnutím v K3.
6. **Opus G3.** Riadok je pred zlyhaním upraviteľný a test tvrdí aj zápis `canEditMetadata`.
7. **Codex GAP C25.** Test na oboch stranách, nie len v admin-dam: aj prepočet a štart knižnice dnes nič
   nepripína.

Navyše oproti posudkom: `chunkSize` od aplikácie (`DT/upload/uploadStop.test.ts` sa v K3 nemení),
`validationMessage` každej strany (spoločná funkcia textu zanikla), zápis detailu späť do skladov, zápis nad
frontou, ktorá nie je, cez kontajner sady (C5), zastavenie a odstránenie ako prepis aj s `async` a `await`
admin-dam, a test K0 „`addQueueItem` nad frontou, ktorá nie je, hodí výnimku".

### 8.6 Druhé posudky (verzia 2 → 3)

História. Platí register v časti 6 a 8.4.

Všetko, čo vedúci z dvoch posudkov vybral (hranica O17 a sedem bodov zadania), je zapracované. Kde posudok
ponúkal dve cesty, alebo kde som šiel inak:

1. **Codex, CONVERGED: „vo všetkých šiestich miestach sa mení niečo pozorovateľné".** Neprevzaté ako šesť
   volieb. Platí hranica O17: B10, B13, B20, B23 (bez volania `updateChunkSize`) a C5 ostávajú zblížené a sú v
   časti 6 so všetkým, čo Codex našiel.
2. **C23.** Vedúci ho prijal ako zblíženie; nechal som ho nezblížené cez hák `onRunDone` (dôvod v 7.11). Vo
   verzii 4 je to `runDone` sady admin-dam.
3. **Opus, ORDER 1: „pridať `assetType` do riadkov dvoch testov, alebo nechať pravidlo v `uploadApi.ts`".**
   Druhá možnosť (rozhodnutie vedúceho).
4. **Opus, CONVERGED B23: „zapísať ako prijaté, alebo nechať volanie".** Druhá možnosť. Keďže strany volajú
   `updateChunkSize` za inej podmienky, drží to voľba `chunkResize` (B33).
5. **Opus, OPTION 3: „vymenovať body a vynechať kúsok na ceste, alebo dať B10 voľbu".** Prvá možnosť.
6. **Codex, OPTION: „párové obmedzenie dvoch volieb zastavenia".** Namiesto obmedzenia jedna voľba.
7. **Codex, RISK (kroky mikroúloh pri importe).** Ostáva rizikom R4 s náhradným riešením; je to aj
   zblíženie Z8.

Navyše oproti posudkom: zblíženia Z10 a Z11, štyri testy K0 pre `chunkResize`, test K0 „bežný upload počty
neprepočíta" a posun PV8 za K6.

### 8.7 Prvé posudky (verzia 1 → 2)

Všetky nálezy označené WRONG, CHANGE a GAP boli zapracované. Štyri inak, než ich posudok navrhol:

1. **Codex, GAP „vlna 4 pred K0/K1".** Zapracované podľa rozhodnutia vedúceho: brána je pred K2 (knižnica) a
   pred K3 (admin-dam). K0 a K1 smú ísť skôr. Obe brány sú medzitým splnené (5.1).
2. **Codex, GAP „objekt bez prototypu alebo kontajner, ktorý berie každý text".** Zvolená druhá možnosť, a len
   pre LIB (ostáva `Map`). DAM ostáva pri obyčajnom objekte so svojím dnešným obmedzením; pripne ho test.
3. **Opus, G4 „uviesť pri B24 tvar LIB".** Namiesto zblíženia voľba `stopRejection`, podľa dočasného pravidla.
4. **Opus, R-1 (kroky mikroúloh).** Neodstránené návrhom, ostáva ako riziko R4 s náhradným riešením.
