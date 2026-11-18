# Ostatné otvorené nálezy denníka: triedenie (9. 10.)

Ide o nálezy z `upload-postup.md`, o ktorých vlastník 8. a 9. 10. nerozhodol a ktoré neanalyzuje iný agent:
odložené 8, 9, 13, 14, 16, tabuľka 17 až 44 a „Nálezy mimo plánu". Vynechané sú tie, o ktorých sa už rozhodlo
alebo ich analyzuje niekto iný: 10, 11, 12, 15 (meranie), 20, 21, 23, 25, 29, 32, 34, 36, 39, 41, 45, 46. Nález 19
mal v zadaní otáznik; zaradil som ho, lebo návrh jadra ho výslovne nechal otvorený (`navrh-jadro.md:474`, C65).

Všetko som overil čítaním dnešných pracovných stromov (LIB `next` nad `49bd815b`, DAM `next` nad `ba8a66ec`) a
backendu (`core-dam-bundle` 1.52.0 vo `vendor`). Nič som nespúšťal. Skratky ciest: `L/` = `common-admin/src/domains/dam`,
`D/` = `admin-dam/src/domains/coreDam`, `B/` = `petit/core-dam/vendor/anzusystems/core-dam-bundle/src`.

**Ako čítať stĺpec „Krok 5":** kroky plánu nesmú meniť správanie nad rámec registra zblížení, preto oprava nejde
*do* kroku, ktorý ten kód prepisuje, ale ako malý samostatný krok hneď *po* ňom (ako nálezy 20, 25, 45 v pláne 2.9).
„Lacné" znamená, že ten súbor je vtedy otvorený, otestovaný a v posudku. Odhady sú v tempe plánu (cielené testy,
kontroly a posudok sú v čísle).

## A. Chyby, na ktoré používateľ narazí: odporúčam opraviť

| # | Platí dnes? (dôkaz) | Krok 5 | Odporúčanie |
|---|---|---|---|
| 30 | Áno. Súbor, ktorý externý systém neprijme, vo widgete obrázka: upozornenie a potom dialóg na nekonečnom načítavaní. `L/imageWidget/components/ImageWidgetInner.vue:344-350` a `ImageMediaWidgetInner.vue:352-358` nemajú kontrolu prázdneho zoznamu, ktorú má `L/assetSelect/components/AAssetListInner.vue:206`. Viacnásobný widget (`ImageWidgetMultipleInner.vue:197-204`) otvorí dialóg tiež; čo ukáže, som neoveroval. | Áno: tie isté tri súbory menia U7 a nález 20. Lacné. | **Opraviť** po U7 alebo spolu s nálezom 20; 1 h. admin-cms aj admin-ugc. |
| 33 | Áno. Hláška „licencia nie je povolená" a potom sa aj tak otvorí prázdny výber assetu: `L/assetSelect/components/AAssetSelect.vue:104-107` sa vráti bez `modelValue.value = false`, hoci dialóg už otvoril widget (`:122-129`); rovnako `AAssetSelectMedia.vue:102-105`. Pripnuté v `L/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts:224-240`. | Nie (súbor výberu krok 5 nemení); test je ten istý, ktorý pri náleze 20 aj tak beží. | **Opraviť**, dva riadky a otočenie testu; samostatne v LIB, najlepšie hneď po kroku nálezu 20; 1 h. Narazí naň používateľ admin-cms bez používateľa DAM pre licenciu (admin-ugc kontrolu preskakuje). |
| 40 | Áno. Chipy konfliktov autorov pri hromadnej úprave v admin-dam sa točia navždy: `D/asset/store/uploadQueuesStore.ts:528` zapíše konflikty, ale `:535` pridá do cache len `authors`; detail to robí správne (`D/asset/store/assetDetailStore.ts:76`). | Áno: K6 prepisuje celý súbor skladu (funkcia ostáva vlastným kódom admin-dam). | **Opraviť** jedným riadkom hneď po K6; 1 h. Len admin-dam. |

## B. Viditeľné drobnosti: lacné v kroku 5, ale menia, čo používateľ vidí

| # | Platí dnes? (dôkaz) | Krok 5 | Odporúčanie |
|---|---|---|---|
| 28 | Áno, v oboch. „Stále sa nahráva alebo spracúva" sa ukáže aj riadku, ktorý medzitým usadila notifikácia: `L/uploadQueue/composables/uploadQueueItemRefresh.ts:44` a `D/asset/components/queue/AssetQueueEditable.vue:37` nemajú podmienku `ended`, ktorú má hláška o zlyhaní o dva riadky nižšie. | Áno: U4 robí z oboch jednu funkciu `createUploadQueueItemRefresh` (komponenty 4, pravidlo 2). | **Opraviť** po U4, jedna oprava pre všetky tri admina (admin-dam ju dostane s U5c); 0,5 h. Chyba oboch strán. |
| 44 | Áno, v oboch. Stlačený chip konfliktu zmizne (Vuetify `closable` skryje sám seba, `L/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue:45-47`), zoznam konfliktov ostane, nadpis visí nad ničím (`AuthorRemoteAutocompleteWithCached.vue:265-273`). | Áno: U1 mení `AuthorRemoteAutocompleteWithCached.vue`; od U3 a U5c ho používa aj admin-dam. | **Opraviť** po U1: ukazovať len konflikty, ktoré ešte nie sú medzi vybranými autormi; 1 h. Kozmetika. |
| 43 | Áno, v oboch. V otázke pri zastavení sa potvrdzovacie tlačidlo aj krížik volajú „Zatvoriť": `L/uploadQueue/components/UploadQueueButtonStop.vue:86` (`src/locales/sk/common/damImage.json:152` „Zatvoriť", EN „Close"), krížik `src/domains/ui/components/ADialogToolbar.vue:27` (`src/locales/sk/common/button.json:6` „Zatvoriť"). admin-dam rovnako (`admin-dam/src/locales/sk/system.json:13`). | Áno: od U5a obe prekrytia admin-dam používajú tlačidlo knižnice (`ADamUploadQueueStopButton`), takže jedna oprava stačí. | **Opraviť** po U5a: potvrdzovacie tlačidlo dostane vlastný text (návrh „Zastaviť", EN „Stop"); 1 h. Je to zmena textu vo všetkých troch adminoch; pred tým pozrieť selektory e2e admin-dam (K-14). |
| 31 | Áno. „Uložiť a použiť" v galérii zvýši pozíciu dvakrát: `L/uploadQueue/components/UploadQueueDialog.vue:131-135` aj `L/imageWidget/components/ImageWidgetMultipleInner.vue:409-412`. Poradie je správne, čísla majú medzery. | Áno: U7 mení `ImageWidgetMultipleInner.vue` (pozície tam výslovne nemení). | **Opraviť** po U7 (zvyšovať len vo widgete); 1 h. Mení len čísla pozícií poslané do CMS, nie poradie. Kozmetika. |
| 9 | Áno (oprava 10. 10., posudok N9: údaje nikto pri importovanom riadku nezobrazuje, zmena je neviditeľná). Import z výberu u externého poskytovateľa nedá riadku údaje poskytovateľa: `D/externalProvider/composables/externalProviderAssetImport.ts:67` (`metadata: {}`), sklad ich berie z tohto poľa (`D/asset/store/uploadQueuesStore.ts:495`). Na backend sa neposielajú. | Nie (súbor krok 5 nemení). | **Opraviť** samostatne v admin-dam (`metadata: item.externalProviderMetadata ?? {}` a test); 1 h. Chyba jednej strany. |

## C. Latentné alebo vnútorné: nikto ich dnes nevidí, oprava je lacná

| # | Platí dnes? (dôkaz) | Krok 5 | Odporúčanie |
|---|---|---|---|
| 17 | Áno. Zlyhaná kópia do licencie ide len cez `mapApiError`, nie cez `report` (`L/api/damImageApi.ts:303-308`; porovnaj `src/domains/api/composables/useApiRequest.ts:166`). Dnes kópia nikdy neprebehne (nález 20), takže na tom nezáleží. | Áno: krok nálezu 20 mení tie isté testy (`damImageApiCopyToLicence.test.ts`). | **Opraviť** spolu s nálezom 20; +0,5 h. Vnútorné (hlásenie chýb). |
| 19 | Áno. Import zastavený počas požiadavky, ktorá potom zlyhá, označí zahodený riadok „zlyhal" a ukáže upozornenie: `D/shared/services/upload/externalProviderImportService.ts:33-49` nekontroluje `Stop` (vetva úspechu áno, `:14`). | Nie: jadro súbor nechá bez zmeny (`navrh-jadro.md:1008`, C65); K6 len vedie import cez spoločný štart. | **Opraviť** samostatne v admin-dam po K6 (dva riadky a test); 0,75 h. Zriedkavé: treba zastaviť a server musí zlyhať. |
| 38 | Áno. Kôš v admin-dam zmaže asset a zo zoznamu odoberie prvý riadok s tým assetom: `D/asset/components/queue/AssetQueueEditable.vue:60-62`, `AssetQueueItemEditable.vue:167-176`. Cestu, ako dostať dva riadky jedného assetu do fronty s košom, som nenašiel (sloty kôš nemajú); neoverené. | Áno: U5c robí z `AssetQueueEditable.vue` obal a kôš v ňom ostáva (komponenty RD24). | **Opraviť** po U5c (posielať riadok, ako pri „Obnoviť"); 0,5 h. Latentné, len admin-dam. |
| 24 | Áno: `src/playground/playground.ts:39` stále nastavuje `uploadStatusFallback: true`. Profil testov (`L/__tests__/support/consumerProfiles.ts:108,236`) ho má zámerne, napodobňuje aplikácie. | Áno: U1 mení súbor s tou voľbou (`src/AnzuSystemsCommonAdmin.ts:105`). | **Zmazať** riadok ihriska pri U1, profil testov nechať; 5 min. Vnútorné. |
| 8 | Áno, poznámka „todo add check by type for slot uploads" je na `D/asset/components/AssetUpload.vue:57`. **Backend typ kontroluje aj pri slotoch** (čítaním, nespúšťané): súbor slotu vzniká pod API typu assetu (`B/Controller/Api/Adm/V1/ImageController.php:117`), dokončenie a spracovanie idú tou istou cestou (`:219-229`, `B/Domain/AssetFile/AbstractAssetFileStatusFacade.php:212`), kde `FileAttributesProcessor::processAttributes` porovná typ súboru s typom assetu a zlyhá s `invalid_mime_type` (`B/Domain/AssetFile/FileProcessor/FileAttributesProcessor.php:63-83`). Riadok slotu potom ukáže zlyhanie s dôvodom. | Nie (súbor krok 5 nemení). | **Zavrieť**: nie je to chyba, kontrola vo frontende by len ušetrila čas uploadu. Poznámku „todo" zmazať pri ľubovoľnom kroku v admin-dam; 5 min. Dôkaz čítaním, nie proti serveru. |
| DAM 1-3, bod 3 | Čiastočne. Čítanie zoznamu distribúcií sa pri zatvorení karty ruší (prvá sada, bod 4: `D/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue:66-69`), zoznam v sklade sa nevynuluje. Počas načítavania ho karta skrýva (`:117-125`), takže ostane vidieť len vtedy, keď čítanie ďalšieho assetu zlyhá: pod chybou sa ukážu distribúcie predošlého assetu. | Nie; ten istý súbor mení krok PV16 (plán 2.9), ak ho vlastník schváli. | **Opraviť len s PV16** (`resetList()` na začiatku čítania; +0,25 h), inak zavrieť. Latentné. |

## D. Odporúčam zavrieť bez zmeny

| # | Platí dnes? (dôkaz) | Krok 5 | Prečo zavrieť |
|---|---|---|---|
| 13 | Áno: bez služby dialóg YouTube po návrate do okna len znova pýta „je prihlásený?" (`D/asset/components/detail/components/distribution/DistributionNewDialogYoutube.vue:205-216`). | Nie. | Backend odpovedá len áno/nie; rozlíšiť „odmietol" by chcelo zmenu backendu. So službou to funguje. |
| 16 | Nie je to chyba (overené 8. 10.): backend pre meno bez zhody pošle `{}`, `L/uploadQueue/composables/assetSuggestions.ts:8` to čaká. Typ `L/types/Asset.ts:47` hovorí `string[]`. | Nie (súbor jadro nemení, `navrh-jadro.md:535`). | Opraviť typ nemá žiadny dosah; nanajvýš pri inej práci v tom súbore. |
| 18 | Áno: nad 50 položiek `copyToLicence` odmietne holým textom (`L/api/damImageApi.ts:274-276`). | Nie. | Nedosiahnuteľné: výber viacerých obrázkov má strop 50, ostatné widgety kopírujú jeden. |
| 22 | Áno: jeden text pre tri príčiny (`uploadQueueItemRefresh.ts:45-50`, `AssetQueueEditable.vue:38-46`). Usadzovanie vracia len `'error'` (`L/uploadQueue/settlement/uploadSettlement.ts:551-553`). | Rozlíšenie by menilo usadzovanie, ktoré krok 5 nemení. | Text „Skúste to znova" sedí na všetky tri; tri texty by stáli zmenu rozhrania usadzovania a preklady (asi 2 h). |
| 26 | Áno v kóde (`L/uploadQueue/settlement/uploadSettle.ts:465`), ale nedosiahnuteľné: knižnica nahráva len obrázky a backend pri duplikáte vždy posiela `originAssetFile` (`B/Model/Dto/Image/ImageFileAdmDetailDto.php:88-91`) aj `assetType` v notifikácii (`B/Model/Domain/AssetFile/AssetFileStatusAdmNotificationDecorator.php:49-56`). | Usadzovanie krok 5 nemení. | Nedosiahnuteľné s dnešným backendom. |
| 27 | Áno, v oboch: riadok „nahraný" bez metadát, ktorého asset zmizne, dostane pri každom „Obnoviť" „skúste znova"; chýbajúce čítania sa rátajú len sledovaným riadkom a riadkom s nečitateľným originálom (`L/uploadQueue/settlement/uploadSettlement.ts:157-172,564-575`). | Usadzovanie krok 5 nemení. | Treba súčasne: zlyhané čítanie metadát a zmazaný asset. Oprava by riadok po treťom „Obnoviť" prepla na „zlyhal", čo je nové správanie (asi 1,5 h). |
| 35 | Áno: keď čítanie vybraného assetu zlyhá, widget ukáže chybu a aj tak otvorí obrázok bez textov (`L/imageWidget/components/ImageWidgetInner.vue:470-472`, `ImageWidgetMultipleInner.vue:284-286`). | Áno (U7), ale nič to nemení. | Rozumná záloha: používateľ chybu vidí a texty môže dopísať. Zmena by bola produktová (obrázok by sa nedal použiť). |
| 37 | Áno, v oboch: pravidlo upozornenia pozerá len na zmenu stavu (`uploadQueueItemRefresh.ts:49`, `AssetQueueEditable.vue:41-45`). | Áno (U4), lacné. | Veľmi úzky prípad (zlyhaný riadok stratí možnosť obnovenia práve počas zlyhaného „Obnoviť"). Ak vlastník schváli 28, dá sa pribrať za 0,25 h. |
| 42 | Áno, v oboch: dôvod bez textu neukáže nič (`L/assetDetail/components/AssetFileFailReasonChip.vue:21`, `D/asset/components/queue/AssetQueueItemList.vue:28-29`). | Áno (U3, U4 a U5c zjednotia chip a prekrytie). | Nedosiahnuteľné: backend má presne tých šesť dôvodov, ktoré frontend pozná (`AssetFileFailedType`: none, unknown, invalid_checksum, invalid_mime_type, download_failed, invalid_size). |

## E. Samostatná úloha po kroku 5

| # | Platí dnes? (dôkaz) | Krok 5 | Odporúčanie |
|---|---|---|---|
| 14 | Áno: strážny test admin-dam pokrýva len štyri súbory uploadu (`admin-dam/src/test/a11y/iconButtonNames.test.ts:14-21`). Počet 75 tlačidiel v 43 súboroch je z 8. 10., znova som ho nerátal. | Zmenšuje ho: U3 a U5 presunú časť na bloky knižnice a strážny test admin-dam po U5c nepokrýva žiadny súbor (plán 2.7). | **Samostatná úloha** po kroku 5: pomenovať zvyšné tlačidlá (meno = text ich bubliny) a rozšíriť strážny test na celý `src`; 3 až 4 h. |

## F. Už to nie je chyba

| # | Dôkaz |
|---|---|
| 15, druhá polovica (zastavený riadok skončí „zlyhaný") | Je to Z15, vlastník ho schválil vo V0 (PV6); urobí K5. |
| Mimo plánu, DAM 2 („Obnoviť" podľa stavu assetu) | Krok 2, O10: výsledok podľa stavu hlavného súboru (`L/uploadQueue/settlement/uploadSettlement.ts:583`). |
| Mimo plánu, DAM 9 (tri čítania na riadok) | Krok 2: jedno čítanie (`uploadSettlement.ts:560`, čitateľ `D/asset/store/uploadQueuesStore.ts:229`). |
| Mimo plánu, LIB 1 (notifikácia o zlyhaní pri nečitateľnom assete) | Krok 2: zlyhanie sa zapíše priamo z notifikácie, bez čítania (`uploadSettlement.ts:639-641`). |
| Mimo plánu, LIB 2 (starý text prekryje dôvod) | O2: text sa pri zlyhaní od servera maže (`L/uploadQueue/settlement/uploadSettle.ts:355-356`). |

## Pre vlastníka

1. **Opraviť 30, 33 a 40** (chyby, na ktoré používatelia narazia): odporúčam áno. Spolu asi 3 h: 30 po U7 alebo s nálezom 20, 33 hneď po kroku nálezu 20, 40 hneď po K6.
2. **Opraviť 28 a 44** (hláška „stále sa spracúva" pri hotovom riadku; nadpis konfliktov nad ničím): odporúčam áno, platí naraz pre všetky tri admina. 1,5 h: 28 po U4, 44 po U1.
3. **43:** potvrdzovacie tlačidlo otázky pri zastavení premenovať zo „Zatvoriť" na „Zastaviť" (EN „Stop"), krížik ostane „Zatvoriť": odporúčam áno. 1 h, po U5a, zmena textu v troch adminoch.
4. **31** (medzery v číslach pozícií galérie): odporúčam opraviť po U7, 1 h. Mení len čísla pozícií poslané do CMS, poradie nie.
5. **9** (import z výberu bez údajov poskytovateľa na riadku, admin-dam): odporúčam áno, 1 h, samostatne v admin-dam.
6. **Drobnosti bez dosahu na používateľa: 17, 19, 38, 24 a zmazanie poznámky „todo" z 8:** odporúčam áno. 17 s nálezom 20 (+0,5 h), 19 po K6 (0,75 h), 38 po U5c (0,5 h), 24 pri U1 a „todo" v admin-dam po 5 min.
7. **Zavrieť bez zmeny 8, 13, 16, 18, 22, 26, 27, 35, 37, 42:** odporúčam áno. 8 preto, lebo backend typ súboru slotu kontroluje sám (čítaním backendu, nespúšťané).
8. **14** (75 ikonových tlačidiel admin-dam bez prístupného mena): samostatná úloha po kroku 5 spolu s rozšírením strážneho testu na celú aplikáciu, 3 až 4 h.
9. **Zoznam distribúcií pri zlyhanom čítaní ďalšieho assetu** (mimo plánu, admin-dam, bod 3): opraviť len spolu s PV16 (+0,25 h), inak zavrieť.
10. **Na vedomie:** druhá polovica 15 a body mimo plánu DAM 2, DAM 9, LIB 1, LIB 2 už neplatia (krok 2, O2, PV6); zavrieť.
