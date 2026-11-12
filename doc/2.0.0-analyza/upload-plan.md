# Upload: plán — bez notification-server a jeden zdroj v common-admin (2026-10-07)

Stav: **schválený plán** po dvoch posudkoch (Codex a Opus, 2026-10-07); všetky rozhodnutia v časti 2 sú
od vlastníka. Nič z tohto plánu nie je v kóde a práca na kóde sa nezačala. Vznikol z čítania kódu štyroch frontendov, dvoch backendov a služby; nič sa
nespúšťalo v prehliadači ani proti nasadenému prostrediu.

Skratky: **LIB** = `common-admin` (vetva `next`), **DAM** = `admin-dam`, **CMS** = `admin-cms`,
**UGC** = `admin-ugc`, **služba** = `notification-server` (WebSocket). Cesty v LIB sú relatívne k
`src/domains/dam/`, v DAM k `src/domains/coreDam/`, ak nie je uvedené inak. Backend = `core-dam`
s `core-dam-bundle` 1.52.0.

Podklady s odkazmi na riadky: `podklady/upload/1` až `12` (zoznam na konci).

---

## 1. Ciele a hranice

1. **Upload funguje bez služby.** Dopytovanie na stav je predvolené správanie. Služba sa použije, len keď to
   aplikácia výslovne nastaví. DAM musí vedieť fungovať bez nej. Konečný stav: služba sa zruší.
2. **Jeden zdroj kódu uploadu v LIB.** DAM je originál, LIB je jeho zjednodušená kópia z januára 2024.
   Duplicity majú zaniknúť cez voľby, rozšírenia, spätné volania a sloty.
3. **Žiadna produktová zmena** okrem rozhodnutí v časti 2. Povolené je zaplátať chybu, ktorú jedna strana
   má a druhá nie.

Tri profily, ktoré sa nesmú rozbiť:

| | CMS (štandard) | UGC (špeciálny) | DAM (špeciálny) |
|---|---|---|---|
| Čo dnes usadí upload | notifikácie, dopytovanie ako záloha | len dopytovanie | notifikácie, vlastná kópia dopytovania |
| Adresy | `/adm/v1` | `/ugc/v1` | `/adm/v1`, štyri typy súborov |
| Komponenty | vonkajšie widgety (`AImageWidget`…) | vnútorné widgety vo vlastných obaloch | vlastné, tri pevné fronty |
| Nastavenie DAM | načíta LIB | aplikácia zapisuje priamo do `useDamConfigStore` | vlastné |
| Navyše | kópia do licencie, zámky spolupráce | stránka so zoznamom assetov a uploadom, vlastné prevody na obrázok | sloty, hromadná úprava, externí poskytovatelia, distribúcie |

Pravidlá práce: testy sa píšu len do LIB a DAM; do CMS a UGC sa nepíše. Knižnica sa do DAM dostáva cez
`./copy.sh <cieľ>`. Každý commit a push len s výslovným súhlasom vlastníka. Ťažké kontroly po jednej.

---

## 2. Rozhodnutia

### 2.1 Rozhodnuté vlastníkom

| # | Vec | Rozhodnutie |
|---|---|---|
| R1 | Vzor dopytovania | Najprv častejšie, potom redšie. Dnešných 550 s je málo. |
| R2 | Režimy | Bez služby: dopytovanie je jediný kanál, hustejšie. So službou: dopytovanie je záloha, redšie, a riadok z neho vypadne, keď ho usadí notifikácia. |
| R3 | Ručné tlačidlo | „Obnoviť" je v oboch režimoch. Režim „len ručne" neexistuje. Dopytovanie sa nedá vypnúť. |
| R4 | Formulár metadát | Pri dopytovaní sa otvorí až po spracovaní súboru. So službou skôr (notifikácia o metadátach), ako dnes. Backend o nové pole nežiadame. |
| R5 | DAM bez služby | Zahŕňa aj stavy distribúcií a overenie prihlásenia do YouTube. `user_updated` neskôr. |
| R6 | Riadok zlyhal, server súbor dokončil | Formulár hneď (dnešné správanie LIB) na oboch stranách. |
| R7 | Metadáta sa nedajú načítať | Varovanie na riadku ako v DAM, ale až po opakovanom neúspechu. |
| R8 | Zlyhaný riadok v LIB | „Odstrániť" hneď. „Obnoviť" hneď, len ak riadok má na serveri asset. |
| R9 | Súbory pustené na otvorený dialóg fronty v LIB | Prijať tou istou cestou ako výber súborov u daného hostiteľa. |
| R10 | Anglické texty v spoločných komponentoch | Znenie LIB. Slovenské sa nemenia. |
| R11 | `mainFileInternal`, `mainFileOverrideInternal` | LIB ich prestane posielať v oboch PATCH-och. Meniť sa dajú len v detaile a sidebare assetu v DAM. LIB hodnotu `mainFileInternal` ďalej číta (zapisuje ju do `dam.internal` pri vytvorení obrázka v CMS). |
| R12 | Opravy bez produktovej zmeny | Schválené, zoznam v kroku 1. Patrí sem aj `#id` pri autorovi alebo kľúčovom slove, ktoré server nevráti: je to nové zobrazenie na oboch stranách (dnes sa točí koliesko). |
| R13 | Testy | Len LIB a DAM, jednotkové a komponentové. Vlny 1 až 3 a testy profilov pred akoukoľvek zmenou, vlna komponentov pred zjednotením komponentov. E2e až na konci ako prijímací test v DAM. |
| R14 | Produkčná konfigurácia | Nerieši sa dnešný stav, rieši sa konečný. |
| R15 | Prvé čítanie bez služby | 2 s je málo, 10 s veľa: 5 s. Testy sa prispôsobia rytmu, nie naopak. |
| R16 | „Falošný" editačný formulár v LIB | Dialóg pre jeden súbor a miesta, kde sa dáta skladajú ručne, sa majú upratať a zjednodušiť (krok 5.5). |

### 2.2 Rozhodnuté po posudkoch (2026-10-07)

Otázky vzišli z posudkov; vlastník pri všetkých prijal odporúčanie.

| # | Vec | Rozhodnutie | Odkiaľ |
|---|---|---|---|
| D1 | Prvé záložné čítanie, keď služba beží | 10 s ako dnes. Služba správu potvrdí, aj keď používateľ nemá spojenie (`notification-server/src/pubsub/notification-pub-sub.ts:44-58`), notifikácia sa teda vie stratiť. | oba posudky |
| D2 | Kedy ukázať text „spracovanie trvá príliš dlho" | Pevných 20 minút, bez vzorca podľa veľkosti dávky. | oba posudky |
| D3 | Sloty v DAM | Jedno čítanie na asset cez zoznam slotov (`GET asset-slot/asset/{asset}` vracia stav každého súboru), nie jedno na riadok. | oba posudky |
| D4 | Meranie rýchlosti uploadu | V kroku 1 sa v LIB opraví len záporná rýchlosť po opakovanom pokuse. V kroku 5 sa prevezme správanie DAM (merať odznova pri každom kúsku). | Codex |
| D5 | Riadok, ktorému zlyhala požiadavka na dokončenie | Ostáva v dopytovaní, aby sa R6 stalo aj bez služby. Riadok, ktorému zlyhal kúsok, sa nedopytuje. | Opus |
| D6 | Hromadné operácie pred načítaním metadát | Prvé načítanie metadát doplní len polia, ktoré sú na riadku ešte prázdne. Dnes ich prepíše celé (`uploadQueue/store/uploadQueuesStore.ts:250-256`); pri dopytovaní (R4) by to okno trvalo celý upload a spracovanie. | Opus |
| D7 | Asset, ktorý server opakovane nevráti | Po troch čítaniach bez neho riadok zlyhá s existujúcim textom neznámej chyby a dá sa odstrániť. | Opus |
| D8 | Čítanie po notifikácii o metadátach | Oneskorené o 2 s. Backend ju vie poslať pred potvrdením transakcie (`AbstractAssetFileStatusFacade.php:302-309`) a metadáta sa do riadku píšu len raz. | Opus |

---

## 3. Cieľový stav

### 3.1 Konfigurácia (`CommonAdminCoreDamOptions`, LIB `src/AnzuSystemsCommonAdmin.ts:91-102`)

- `notification.enabled` a `notification.webSocketUrl` nepovinné. Voľby sa pri inicializácii znormalizujú
  na `{ enabled: boolean, webSocketUrl: string }`, aby čitatelia nepadali na chýbajúcej hodnote
  (`composables/damNotifications.ts:21` dnes číta `.length` priamo).
- Služba sa zapne len pri `enabled` rovnom `true` **alebo textu `"true"`** a neprázdnej adrese. Text sa
  prijíma preto, že šablóny nasadenia dosadzujú hodnotu v úvodzovkách
  (`petit/admin-dam/public/config.json.cf.dist:19-22`). Dnes je aj text `"false"` vyhodnotený ako zapnuté.
- `uploadStatusFallback` sa prestane čítať (v type ostane ako nepovinné a zastarané). Dopytovanie beží vždy.
- DAM prestane čítať vlastný príznak: `asset/api/fileApi.ts:199`, `src/main.ts:46`,
  `src/shared/EnvConfigService.ts:11,46`, `src/shared/types/EnvConfig.ts:7`, `public/config.json.dist:7`.
- V CMS je kľúč pre túto službu `dam.notification.enabled`; `notification.enabled` je tam iný produkt
  (`admin-cms/public/config.json.cf.dist:72,87`).

### 3.2 Dopytovanie

Jeden dopytovač na frontu, nie časovač na riadok. Čítanie je hromadné:
`GET {asset}/licence/{licence}/ids/{ids}`, najviac 50 (`AssetController.php:139-163`; rovnaké pod
`/api/ugc/v1`). Asset, ktorý neexistuje alebo je v inej licencii, v odpovedi jednoducho chýba. Pomocné
funkcie dnes delia po 25 (LIB `api/damAssetApi.ts:29`, DAM `asset/api/assetApi.ts:61`), zdvihne sa na 50.

**Ktoré riadky sa čítajú:** len tie, ktorých súbor server spracúva a ktoré majú na serveri asset: upload
po úspešnom dokončení, kópia do licencie, externý import po odpovedi, slot (D3). Nečítajú sa riadky, ktoré
ešte posielajú kúsky, čakajú v rade, ani riadky hromadnej úpravy v DAM (tie majú vlastné načítanie).
Podľa D5 ostáva v čítaní aj riadok, ktorému zlyhala požiadavka na dokončenie.

**Rytmus.** Každý riadok má vek od svojho dokončenia uploadu. Fronta má jeden časovač. Po každom čítaní sa
ďalšie naplánuje podľa veku najmladšieho čítaného riadku:

| Vek | Bez služby | So službou (záloha) |
|---|---|---|
| do 1 min | čítania v 5, 10, 16, 23, 31, 40, 50 a 60 s | čítania v 10, 30 a 60 s (D1) |
| do 5 min | každých 30 s | každú minútu |
| do 20 min | každú minútu | každé 3 minúty |
| do 60 min | každé 2 minúty | každých 5 minút |
| potom | každých 10 minút | každých 10 minút |

Čísla sú východiskové a v kóde budú na jednom mieste; potvrdí ich meranie záťaže.

Pravidlá:

1. **Nekončí sa.** Kým je fronta otvorená a karta viditeľná, dopytovanie beží.
2. **Nový riadok čítanie len priblíži, nikdy neodsunie:** `ďalšie = min(naplánované, teraz + prvý odstup)`.
   Počas dávky sa teda číta asi každých 5 s (so službou 10 s) a rytmus začne rednúť až po poslednom
   dokončenom uploade. Usadenie riadku, „Obnoviť" ani návrat do karty rytmus nezrýchlia.
3. **Čítanie hneď** spustí „Obnoviť" a návrat do karty. Naraz beží najviac jedno čítanie na frontu;
   spúšťač počas čítania vyvolá jedno ďalšie po ňom. Medzi čítaniami dopytovača (tik, návrat do karty)
   sú aspoň 2 s. Ručné „Obnoviť" tento odstup nemá (tlačidlo je počas čítania vypnuté) a nemá ho ani
   čítanie po notifikácii, aby výsledok uploadu neprišiel neskôr než dnes.
4. **Notifikácia** číta len asset, ktorý menuje (notifikácie do 250 ms sa zlúčia do jedného čítania),
   a ide tou istou funkciou usadenia a tým istým koordinátorom čítaní. Rytmus dopytovania nemení.
   Čítanie po notifikácii o metadátach sa spustí o 2 s neskôr (D8). Čítanie spustené len notifikáciou
   o spracovaní metadáta nenačíta, ako dnes; načíta ich dopyt, „Obnoviť" a notifikácia o metadátach.
5. **Skrytá karta:** žiadne plánované čítania, vek beží ďalej. Po návrate jedno čítanie hneď a ďalej
   podľa veku.
6. **So službou:** riadok vypadne z dopytovania, keď ho notifikácia usadí. Ak spojenie nie je nadviazané
   alebo spadlo (po piatich neúspešných pokusoch sa už neobnoví), fronta ide hustým rytmom.
7. **Text „spracovanie trvá príliš dlho"** (dnešný kľúč `uploadErrors.processingTooLong`) sa ukáže po
   20 minútach veku riadku (D2). Dopytovanie po ňom pokračuje, riadok nemení stav.
8. **Zlyhaný dopyt** (sieť, 5xx) stav riadku nemení; ďalší pokus po 15, 30, 60, 120, najviac 300 s.
   Varovanie podľa R7 po treťom neúspechu za sebou. Asset, ktorý v troch čítaniach za sebou chýba,
   riadok zlyhá s existujúcim textom neznámej chyby (D7).
9. **Sloty v DAM:** hromadné čítanie vracia len hlavný súbor assetu, slot sa číta zvlášť (D3).
10. **Kópia do licencie** dostane notifikáciu `asset_file_copied`, ale nikdy notifikáciu o metadátach
    (`MetadataProcessor::process` sa v ceste kópie nevolá). Metadáta kópie teda prídu vždy z čítania.

Prečo dlhý horizont: spracovanie ide za sebou pod zámkom `<typ>_<licencia>` spoločným pre všetkých
používateľov licencie (`AbstractAssetFileStatusFacade.php:207-254`); po zabití workera sa správa doručí
znova (ack deadline 60/120/300/500 s, odstup 2 až 600 s); limit pokusov ani dead-letter nie je nastavený.

Záťaž (odhad, nemerané): pri dávke je to najviac 12 čítaní za minútu na frontu; 30 redaktorov naraz je
do 360 čítaní za minútu, dnes 600 naraz v desiatej sekunde. Každé čítanie vracia plné detaily čakajúcich
assetov. **Treba zmerať na testovacom prostredí.** Ľahký endpoint so stavmi sa žiada, až keď to meranie ukáže.

### 3.3 Usadenie riadku

Jedna funkcia „zapíš načítaný asset do riadku", ktorú volá dopyt, notifikácia aj „Obnoviť". Dnes sú to
v každom sklade štyri až päť funkcií, v DAM ešte kópia v `asset/components/queue/AssetQueueEditable.vue:29-53`
a v LIB kópia v `uploadQueue/composables/uploadQueueItemRefresh.ts:20-38`.

Rozdiely medzi stranami sú voľby podľa **roly riadku** (nahrávaný súbor, slot, hromadná úprava, kópia do
licencie, externý import), nie vetvy v kóde:

| Voľba | LIB | DAM |
|---|---|---|
| Kedy sa riadok označí ako nahratý | až z čítania; notifikácia čítanie len spustí. Riadok kópie nemá `fileId`, kým sa asset neprečíta, a „Uložiť a použiť" riadky bez neho potichu zahodí (`imageWidget/utils/metadataToImageMap.ts:63`). | stav z notifikácie hneď, čítanie potom (`asset/store/uploadQueuesStore.ts:511-513`) |
| Duplikát | riadok sa stane originálom: prepíše sa `assetId` aj `fileId`, prevezmú sa metadáta originálu, formulár je zapnutý (`uploadQueue/store/uploadQueuesStore.ts:338,359-388`) | riadok ostane, dostane `duplicateAssetId`, formulár vypnutý, pôvodný súbor sa číta podľa typu (`:671-721`) |
| Zlyhanie | chip s dôvodom | text, jedno upozornenie na rovnakú chybu |
| Po usadení | — | doplní `mainFile` do otvoreného detailu, ak ho nemá |
| Cache autorov a kľúčových slov | cache LIB | cache DAM (do kroku 5) |

Duplikát potrebuje druhé čítanie (pôvodný súbor), ktoré hromadná odpoveď nenesie. Funkcia preto dostane
ako závislosti: čítanie pôvodného súboru, pridávanie do cache a prevod chyby na text.

Bezpečnosť voči poradiu:

- Poradie stavov servera: nahráva sa < nahraté < uložené < spracované alebo duplikát alebo zlyhané.
  Nižší stav nikdy neprepíše vyšší. Zlyhanie na strane klienta môže neskorší stav servera prepísať (R6).
- Odpoveď platí len pre ten istý riadok: fronta má číslo generácie (zvýši sa pri vyčistení; DAM pri
  vyčistení objekt fronty nahrádza, `:737`) a riadok nemenný kľúč, oba sa overia po každom čakaní.
  Identifikátory assetu a súboru na to nestačia, lebo duplikát ich v LIB prepisuje.
- Ten istý asset môže byť v DAM v dvoch frontách (upload a hromadná úprava); usadí sa len riadok s
  tým súborom, druhý sa len doplní.
- Prvé načítanie metadát doplní len polia, ktoré sú na riadku ešte prázdne (D6): kľúčové slová, autori
  a každé vlastné pole zvlášť. Čo používateľ zapísal hromadnou operáciou pred načítaním, ostane.

`UploadQueueItemType.Asset` dnes znamená v DAM riadok hromadnej úpravy a v LIB riadok kópie do licencie.
Do typu riadku pribudne výslovná **rola**.

### 3.4 Architektúra zjednotenia

- **Jadro uploadu v LIB:** požiadavky s klientom a adresou podľa typu; `useUpload` s voľbami;
  dopytovač; usadenie; jadro fronty.
- **Dva tenké pinia sklady nad jadrom:** sklad widgetov v LIB (dnes 632 riadkov, cieľ asi 200) a sklad
  DAM so slotmi, hromadnou úpravou a externými poskytovateľmi (863, cieľ asi 280). Mená členov skladu DAM
  ostanú, takže 16 z 22 súborov, ktoré ho používajú, sa nemení.
- **Spoločné komponenty bez skladu** (vlastnosti a udalosti): riadok, zoznam, sidebar. Riadok dostane asi
  štyri sloty. Obaly a plávajúce panely ostávajú miestne.
- Sklad `useDamConfigStore` a mená jeho členov sa nemenia: UGC do neho zapisuje priamo.

---

## 4. Kroky

Pravidlo pre celý čas: kým nie je hotový krok 2, do polovice „usadenie" sa na žiadnej strane nepridáva
nič nové okrem záplat z kroku 1.

### Krok 0 — testy, správanie sa nemení

Zásady:

- Podvrhuje sa **len okraj**: falošný HTTP klient (nie modul `damAssetApi`), WebSocket, časovače. Sklad
  a dopytovanie bežia skutočné.
- Test tvrdí „asset riadku sa prečítal z nastavenej adresy a čo sa zapísalo do riadku". Netvrdí meno
  funkcie skladu, tvar adresy čítania (jedno alebo hromadné), presný čas ani veľkosť dávky.
- Profily CMS a UGC sú jeden pomocný súbor (`__tests__/support/consumerProfiles.ts`) s dvoma nastaveniami.

| Vlna | LIB | DAM |
|---|---|---|
| 1 Usadenie | LS1–LS8, LS10, LS11; profilové A1–A3, A5–A9 | DS1–DS8; DC3 a nový test „slot bez socketu" |
| 2 Požiadavky a služba | LR1–LR5, LR7, LR9 | DR1–DR5 |
| 3 Operácie fronty | LQ1–LQ8 | DQ1–DQ6 |
| 4 Komponenty (pred krokom 5) | LC1–LC10; profilové B1–B7, C1–C10 | DC1, DC2, DC4, DC5 |

Čísla testov sú z `podklady/upload/9-tests-coverage.md` (časť 3) a `8-tests-consumers.md` (časť 7).
Oproti podkladom sa mení:

- **Vypúšťa sa:** A4 (presné časy a vzdanie sa), LS9 (správanie pri vypnutom príznaku, ktorý zaniká),
  LR8 a DR6 (dávky po 25).
- **Preformuluje sa:** A2 a LS1 („čítanie prebehlo", nie „pred 10 s žiadne" ani tvar adresy); A7 (bez
  tvrdenia o tlačidle, R8); B1 (PATCH cez `toMatchObject`, R11); DS1 a DS4 (tvrdia stav riadku, nie volané
  funkcie skladu); DS2 a DS3 (nové súbory, nie rozšírenie `notificationFallback.test.ts`, ktorého predmet
  krok 2 maže; bez tvrdenia „varovanie hneď", R7).
- **Nepripína sa** (čaká na záplatu alebo prepis): tlačidlá zlyhaného riadku v LIB (R8); pustenie
  súborov na dialóg (R9); dve polia `internal` v PATCH-i (R11); prenos prepínača jednorazového použitia
  po uložení detailu v LIB; R6 na strane DAM; zhoda notifikácie len podľa assetu (LS4, posledný prípad).

Hotovo, keď: nové testy prechádzajú na nezmenenom kóde a celé kontroly oboch repozitárov sú zelené.

### Krok 1 — zosúlaďovacie záplaty, každá s testom cieľového správania

LIB:
1. PATCH bez `mainFileInternal` a `mainFileOverrideInternal` (`api/damAssetApi.ts:215-216`, `:267-268`), R11.
2. Zlyhaný riadok: tlačidlá podľa R8 (`uploadQueue/components/UploadQueueItemEditable.vue:140-147`, `:176-199`).
3. Pustenie súborov na dialóg fronty podľa R9 (`UploadQueueDialog.vue:317-324`). V
   `imageWidget/components/ImageWidgetMultipleInner.vue:706-717` to znamená aj limit 50; v
   `assetSelect/components/AAssetListInner.vue:205-209`, `:425-435` limit nie je a nepridáva sa.
4. Dialóg pre jeden súbor: „Obnoviť" pri `processing` po 20 s.
5. `updateFromDetail` prenesie aj `mainFileSingleUse` (`uploadQueue/store/uploadQueuesStore.ts:516-541`).
6. Počet pripnutých vlastných polí podľa backendu vrátane 0 (LIB má `|| 2`; dnes žiadny systém 0 nemá).
7. Veľkosť kúska číta `apiTimeout` (dnes natvrdo 30 v `uploadQueue/composables/damUploadChunkSize.ts:7`).
8. Rýchlosť uploadu: po opakovanom pokuse sa meria odznova (D4;
   `uploadQueue/composables/uploadService.ts:106-120`).
9. `#id` pri autorovi alebo kľúčovom slove, ktoré server nevráti (R12).
10. Kľúč riadku je jedinečný (dnes `'file_' + názov súboru`, `uploadQueuesStore.ts:128`, použitý ako
    `:key`); v DAM je to už opravené.
11. Riadok sa zastavuje podľa identity, nie podľa poradia (`uploadQueuesStore.ts:505-514`); v DAM je to už tak.

DAM:
1. R6: riadok, ktorý zlyhal a server ho dokončil, dostane formulár hneď
   (`asset/store/uploadQueuesStore.ts:510-565`; test `slotNotifications.test.ts:678-696` sa obráti).
2. `aria-label` a Esc podľa LIB.
3. `#id` (R12).

Obe: rola riadku v type `UploadQueueItem` (3.3), zatiaľ bez zmeny správania.

### Krok 2 — nové usadenie, napísané raz v LIB

LIB:
1. Nové moduly dopytovač a usadenie; `FETCH_BY_IDS_MAX_LIMIT` 25 → 50; konfigurácia podľa 3.1
   (`composables/damNotifications.ts:19-21,89-90`, `composables/commonAdminCoreDamOptions.ts`).
2. Sklad prejde na dopytovač a jednu funkciu usadenia. Odber notifikácií ostane v sklade
   (`uploadQueue/store/uploadQueuesStore.ts:48-67`) a prihlási sa, len keď má sklad frontu s riadkom
   (v DAM môžu byť nažive oba sklady naraz).
3. Zanikne záloha v `api/uploadApi.ts` a s ňou cyklus importov, ktorý dnes povoľuje
   `src/test/importCycles.test.ts:100-108`; ten test sa upraví tu.
4. Tou istou cestou pôjdu: `uploadQueue/composables/uploadQueueItemRefresh.ts:20-38` (ručné „Obnoviť"),
   tri priame volania `queueItemDuplicate` pri kópii, ktorá už existuje
   (`imageWidget/components/ImageWidgetInner.vue:336`, `ImageMediaWidgetInner.vue:344`,
   `ImageWidgetMultipleInner.vue:227`), a `uploadQueue/composables/uploadService.ts:30-34`.
5. R7: varovanie po treťom neúspešnom čítaní.
6. Export dopytovača a usadenia pre DAM (`src/lib.ts`).

DAM:
7. Zanikne `asset/api/fileApi.ts:114-200`; sklad používa dopytovač a usadenie z LIB; prípady uploadu v
   `src/domains/system/composables/appNotificationListeners.ts` volajú „prečítaj tento asset"; ručné
   „Obnoviť" (`asset/components/queue/AssetQueueEditable.vue:29-53`) ide tou istou cestou; externý import
   (`shared/services/upload/externalProviderImportService.ts`) zapne spoločný dopytovač; sloty podľa D3.
8. Asset vytvorený prázdny dostane `mainFile` do otvoreného detailu aj z čítania (dnes len z notifikácie,
   `asset/store/uploadQueuesStore.ts:649-656`).
9. R7 ako v LIB.

Testy:
10. Nové testy dopytovača s riadenými časovačmi: prvé čítanie v okne podľa režimu; nový riadok čítanie
    neodsunie; rytmus rastie; po texte „trvá dlho" sa číta ďalej; skrytá karta; jedno čítanie naraz;
    prechod na hustý rytmus po páde spojenia.
11. Nové testy usadenia: obe poradia notifikácie a čítania; „Obnoviť" počas čítania; odstránenie riadku
    a vyčistenie fronty počas čítania; ten istý asset v dvoch frontách DAM; duplikát na oboch stranách;
    riadok so zlyhaným dokončením, ktorý server dokončil (D5); hromadná operácia pred prvým načítaním
    metadát (D6); asset, ktorý server nevráti (D7); oneskorené čítanie po notifikácii o metadátach (D8).
12. Prepíšu sa: LIB `uploadQueue/__tests__/uploadStatusFallback.test.ts` (časy `:107,131,205,220,241`,
    príznak `:160,190`, pomôcka časovača `:79`) a pomôcky časovača v `uploadQueueDialogSingle.test.ts:102`,
    `uploadQueueRowRefresh.test.ts:39`, `uploadQueueSettledItemFailure.test.ts:54`; DAM celý
    `src/test/fallback/notificationFallback.test.ts`, `src/test/queue/externalProviderImport.test.ts:5-10,58,75`,
    `src/test/appInitialize/appNotificationListeners.test.ts:57-67`.

Hotovo, keď: testy vlny 1 a nové testy prechádzajú s vypnutou aj zapnutou službou v oboch repozitároch.

### Krok 3 — časti len pre DAM

1. Zoznam distribúcií (`asset/store/distributionListStore.ts`, karta distribúcií v detaile): čítanie po
   15 s, 30 s, potom každých 30 s do 5 minút a ďalej každú minútu, kým je karta otvorená a niektorá
   distribúcia nie je v konečnom stave. Backend ich sám kontroluje raz za 30 až 90 s.
2. Prihlásenie do YouTube (`DistributionNewDialogYoutube.vue`): overenie znova pri návrate do okna, kým
   dialóg čaká na prihlásenie.
3. Testy oboch s riadenými časovačmi.
4. `user_updated`: mimo rozsahu.

**DAM sa s krokom 2 nenasadzuje bez kroku 3.** Krok 2 mení vyhodnotenie `enabled` a v prostredí, kde je
dnes služba zapnutá len omylom (text `"false"`), by sa vypla skôr, než distribúcie a YouTube majú náhradu.

### Krok 4 — prepnutie a zrušenie služby

Brány mimo tohto plánu, s vlastníkom: (i) vydanie LIB s krokom 2; (ii) zdvihnutie verzie a nasadenie v
CMS, UGC a DAM; overenie nainštalovanej verzie v každej aplikácii. Do CMS a UGC sa v rámci tohto plánu
nepíše, preto sú to brány, nie kroky.

1. Vyčistenie konfigurácie aplikácií: DAM šablóny (`petit/admin-dam/public/config.json.cf.dist`) bez
   `uploadStatusFallback`, `notification.enabled` ako skutočná logická hodnota.
2. Poradie vypínania: (a) brány (i) a (ii) splnené; (b) v aplikáciách sa služba vypne v konfigurácii
   (v CMS kľúč `dam.notification.enabled`); (c) v core-dam sa vypne `notifications.enabled`; (d) až potom
   sa zruší služba a téma Pub/Sub. Poradie (c) pred (d) je nutné: publikovanie je synchrónne, beží vnútri
   spracovania súboru a klient Google mení 404 na výnimku (`AbstractNotificationDispatcher.php:55-83`).
   Poradie (b) pred (c) je nutné, aby aplikácia so živým, ale mlčiacim spojením nebežala riedkym rytmom.
3. E2e prijímací test „funguje bez služby" v DAM (púšťa vlastník): upload, slot, externý import,
   distribúcia, prihlásenie do YouTube.

### Krok 5 — zvyšok zjednotenia (pred ním vlna 4 testov)

1. **Požiadavky:** jedna implementácia štart/kúsok/dokončenie s klientom a adresou podľa typu. V DAM
   zanikne tento kód v `imageApi.ts`, `audioApi.ts`, `videoApi.ts`, `documentApi.ts` a `fileApi.ts:73-294`.
   V LIB zanikne zvyšok `api/uploadApi.ts`.
2. **Služba:** `useUpload` v LIB s voľbami (D4); zanikne DAM `shared/services/upload/uploadService.ts`.
3. **Sklady:** jadro fronty v LIB, dva tenké sklady (3.4).
4. **Komponenty, dve skupiny.**
   - *Len upload, v DAM zanikajú:* `asset/components/queue/AssetQueueItemEditable.vue` (nahradí ho obal okolo
     riadku LIB), `AssetQueueEditable.vue`, `AssetQueueSelectedSidebar.vue`,
     `asset/components/footer/AssetFooterUploadButtonStop.vue`, oba formuláre vlastných metadát, chip dôvodu
     zlyhania.
   - *Spoločné bloky, ktoré v DAM používa aj kód mimo uploadu; nahrádzajú sa v celom DAM:*
     `AssetImage.vue` s ikonami (14 súborov: podcasty, externí poskytovatelia, dlaždica a riadok zoznamu,
     detail, náhľad distribúcie), cache autorov (10 súborov) a kľúčových slov (7), autocomplete autora
     (aj `AssetLicenceEditForm.vue`), `AuthorCreateButton.vue` (aj `AuthorListView.vue`), tri chipy,
     konfigurácie autora a kľúčového slova. Cache nie sú zameniteľné bez úpravy: LIB číta systém z
     `cachedExtSystemId`, ktorý nastavuje widget (`author/composables/cachedAuthors.ts:23-27`), DAM z
     aktuálneho systému používateľa.
   - *Ostávajú a menia importy:* `shared/components/FileUpload.vue` a `src/App.vue` prejdú z
     `shared/services/upload/fileValidation.ts` a `asset/composables/windowFilesDragWatcher.ts` na kontrolu
     formátu a stav ťahania z LIB; až potom tie dva súbory zaniknú. Kontrola v LIB navyše orezáva medzery
     a veľkosť písmen v zozname prípon (`src/domains/ui/file/composables/formatAndSizeCheck.ts:16-23`).
   - Každá strana si vzhľad zamknutého riadku, ikonu TTS, právo na vytvorenie autora a validačný rozsah
     nastaví voľbou.
   - Nové exporty z `src/lib.ts`: z týchto blokov je dnes vyvezené len `fetchAsset` a
     `useDropzoneGlobalDragState`; zoznam exportov sa spíše pred začatím kroku.
5. **„Falošný" editačný formulár v LIB (R16).**
   - Dialóg pre jeden súbor (`uploadQueue/components/UploadQueueDialogSingle.vue` a tri sidebarové
     komponenty, spolu 1 025 riadkov) kopíruje rozloženie detailu assetu (`assetDetail/components/
     AssetDetailDialog.vue`, `AssetDetailDialogSidebar.vue`, `AssetDetailSidebarMetadata.vue`,
     `AssetMetadata.vue`). Kým upload beží, živí sa ručne poskladaným `AssetDetailItemDto` s asi 25
     výplňovými poľami (`UploadQueueDialogSingle.vue:87-131`); po dokončení číta zároveň z riadku fronty
     aj z detailového skladu.
   - Cieľ: jedno rozloženie „obrázok a sidebar", ktoré dostáva len polia, čo kreslí, a dva adaptéry (z
     riadku fronty, z detailu assetu). Vymyslený asset zanikne.
   - Objekt obrázka pre CMS (`ImageCreateUpdateAware`) sa dnes skladá ručne na deviatich miestach;
     bude ho skladať jedna funkcia.
   - Správanie sa nemení; pred začatím sa spíše porovnanie štyroch dvojíc komponentov po riadkoch.
6. V DAM ostávajú: plávajúce panely, pás výberu, `AssetQueueUploadList`, `AssetQueueSelectedSimple`,
   `AssetSlotListItem`, `AssetUpload`, `FileUpload` (prechádzanie priečinkov), súbory externých
   poskytovateľov, `uploadQueueIds.ts`.

Odhad (neoverený posudkami): z DAM odíde asi 4 400 riadkov produkčného kódu, asi 45 súborov DAM sa
nezmení alebo zmení len importy. Podrobná mapa: `podklady/upload/3` až `7`.

---

## 5. Riziká

1. **Zmysel `UploadQueueItemType.Asset`** je na stranách iný. Rieši rola riadku v kroku 1.
2. **Poradie pri usadení** je na stranách opačné a obe sa zachovávajú ako voľba roly (3.3).
3. **Dva sklady nažive v DAM** (krok 2).
4. **Testy DAM podvrhujú moduly podľa cesty** a sejú riadky priamo do `store.queues`; pri presunoch ich
   treba prepísať, nie len premenovať.
5. **UGC zapisuje do `useDamConfigStore`** a používa vnútorné widgety; mená sa nesmú zmeniť (strážny test C10).
6. **CMS a UGC bežia na staršom lokálnom builde LIB** (bez troch opráv uploadu zo 7. 10.). Testy pripínajú
   `next`, nie to, čo je dnes v tých aplikáciách.
7. **Záťaž hromadného čítania** nie je zmeraná (3.2).
8. **Skutočné časy spracovania** nepoznáme; lokálny backend spracúva synchrónne.
9. **E2e:** UGC hľadá anglický text chyby v slovenskom rozhraní (`admin-ugc/e2e/pages/shared/upload.ts:28`).
   DAM má test tichého socketu označený `test.fail()`. Tok CMS s pevným čakaním 5 s
   (`admin-cms/e2e/pages/notifications/notificationPage.ts:143`) neohrozuje ani dlhšie prvé čítanie: klik
   po ňom čaká na tlačidlo až 30 s (`admin-cms/e2e/playwright.config.ts:49`).
10. **Dve validačné rodiny, dve cache, dva detailové sklady, dva katalógy textov** (krok 5): DAM si necháva
    svoj validačný rozsah a odovzdá ho výslovne; test LIB zakazuje kľúče mimo knižnice.

---

## 6. Otvorené, neblokuje

- Backend, `internal`: zápis `mainFileInternal` pri vypnutom prepise; hodnota po vypnutí prepisu na
  licencii bez pravidla; samostatné právo na ručný prepis (otázky sú u kolegu).
- LIB má adresu autorov a kľúčových slov natvrdo `/adm/v1` (`author/api/authorApi.ts:9`); či UGC asset
  niekedy nesie autora, nevieme.
- Či `test.fail()` v DAM e2e `uploadNotificationFallback.spec.ts:33` ešte platí.
- Backend má na externom systéme príznak `notificationsEnabled`, ktorý žiadny frontend nečíta
  (`ExtSystemAdmGetDecorator.php:41-45`). Dal by sa použiť na rozpoznanie mlčiaceho spojenia; pri poradí
  z kroku 4 ho netreba.

## 7. Čo sa nerobí

Nové pole `processedMetadata` na backende; ľahký endpoint so stavmi (až po meraní); `user_updated`;
nové e2e v CMS a UGC; zápis do repozitárov CMS a UGC; konflikty autorov v dvoch dialógoch detailu assetu.
Vydanie knižnice nie je súčasťou krokov 0 až 3; je bránou kroku 4.

## 8. Posudky

Plán posúdili nezávisle Codex (`gpt-6-sol`, úsilie high) a agent na modeli Opus, oba len čítaním kódu.
Spolu 24 nálezov označených ako chyba a 9 návrhov; prekrývali sa asi v polovici. Nálezy som overil v kóde.

Zapracované opravy: nový riadok čítanie neodsúva (pôvodné pravidlo by pri dávke prvý riadok prečítalo až
po poslednom uploade); poradie usadenia a duplikát ako voľby roly; ktoré riadky sa čítajú; text `"true"`
v konfigurácii a spoločné nasadenie krokov 2 a 3 v DAM; brány vydania pre CMS a UGC; úprava testov vlny 1
a zoznamu testov na prepis; R7 presunuté do kroku 2; rozdelenie zoznamu súborov v kroku 5; päť drobných
nepresností. Návrhy, ktoré menia správanie, sú v časti 2.2.

Nezapracované: rytmus podľa príznaku backendu (časť 6).

## 9. Podklady (`podklady/upload/`)

| Súbor | Obsah |
|---|---|
| `1-notif-fe.md` | čo robí socket vo frontende, dnešná záloha, toky, ktoré bez neho visia |
| `2-notif-be.md` | služba, každá udalosť backendu, časová os spracovania, čo vie prečítať dopyt |
| `3-upload-store.md` | oba sklady, poradie udalostí, body rozšírenia, riziká zlúčenia |
| `4-upload-service.md` | služba uploadu a vrstva API |
| `5-upload-ui.md` | riadky, zoznamy, sidebary, dialógy |
| `6-blocks-author-keyword.md` | autori, kľúčové slová, chipy, cache |
| `7-blocks-image-form-picker.md` | obrázok, formuláre metadát, validácia, výber súborov |
| `8-tests-consumers.md` | ako LIB používajú CMS a UGC, rozdiely, 26 testov profilov |
| `9-tests-coverage.md` | mapa pokrytia LIB a DAM, 63 navrhnutých testov |
| `10-codex-rytmus-dopytovania.md` | nezávislý návrh rytmu od Codexu |
| `11-posudok-planu-codex.md` | posudok prvej verzie plánu, Codex |
| `12-posudok-planu-opus.md` | posudok prvej verzie plánu, Opus |
