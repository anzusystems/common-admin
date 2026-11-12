# PV9: riadok hromadnej úpravy, ktorého súbor zlyhal a server ho potom spracoval (analýza, 9. 10.)

Zadanie: rozhodnutie vlastníka 9. 10., bod 2 („opraviť v kroku 5, treba návrh"; denník `upload-postup.md:399`).
Podklady: jadro v10.3 (C55 `navrh-jadro.md:464`, 1.4 `:480-495`, 3.2 `:1170-1236`, 4.1 `:1311-1316`, 5.2 PV9 `:1516`,
Z25 `:1622`, 7.23 `:1701-1703`), komponenty v4.3 (2.2 `navrh-komponenty.md:505-595`), plán v7.1 (2.4 K6, 2.9
`plan-implementacie.md:780`), pôvodný nález `podklady/upload/noc/dam-krok0.md:187-189`. Kód čítaný v dnešnom
(nezakomitovanom) stave oboch stromov; nič som nespúšťal.

Skratky: `D-st` = admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts`; `AQIE` = admin-dam
`src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue`; `L-se` = LIB
`src/domains/dam/uploadQueue/settlement/uploadSettle.ts`; `L-sm` = LIB `…/settlement/uploadSettlement.ts`;
`DT/` = admin-dam `src/test/`; `LT/` = LIB `src/domains/dam/uploadQueue/__tests__/`; `CD/` = core-dam `vendor/anzusystems/core-dam-bundle/src/` (verzia 1.52.0,
`core-dam/composer.lock:305-306`).

## 0. V skratke

1. **Dnes:** riadok hromadnej úpravy, ktorému notifikácia (alebo čítanie) povie „súbor zlyhal", stratí formulár a
   je červený s dôvodom. Keď potom príde „spracovaný", hák DAM zmaže chybu, ale stav ostane „zlyhal" a formulár
   zamknutý: riadok nie je červený, nič nevysvetľuje, má × a nemá „Upraviť", kôš ani formulár, a do hromadného
   uloženia sa nedostane. Žiadna cesta späť okrem × a nového označenia assetu.
2. **Zistenie:** core-dam pre jeden súbor „spracovaný" po „zlyhal" nepošle: stav `failed` je konečný
   (`CD/Domain/AssetFile/AssetFileStatusManager.php:123-130`, `Failed => []`) a stav súboru inak zapisujú len
   továrne nových súborov a fixtúry. Sled pripínajú testy s falošným serverom. Pri obrátenom doručení notifikácií
   by riadok po 250 ms vrátilo do „zlyhal" čítanie, ktoré notifikácia spustí. Oprava je teda poistka (poradie
   doručenia, budúci backend), nie oprava častej chyby.
3. **Cieľ:** riadok sa vráti tam, kde bol pred zlyhaním: „hotový", bez chyby, s formulárom a s tým, čo v ňom bolo,
   a ide do hromadného uloženia. Riadok, ktorému hromadné načítanie metadáta nikdy nedalo, sa vráti na text
   „Metadáta sa nepodarilo načítať" (nie na prázdny formulár, ktorý by uložením zmazal metadáta assetu).
4. **Oprava:** len vlastný kód DAM (hák `onProcessedSeen` a jedna pamäť v sklade), asi 20 riadkov; knižnica, jadro
   kroku 5, riadok, watcher „Obnoviť" ani počty sa nemenia, kópia netreba. Dva testy sa otočia, štyri pribudnú.
   Vlastný malý krok **F5 (PV9)** v strome DAM po K6, pred C3; **asi 2 h**.
5. **Iné roly** (upload, slot a import v DAM, upload a kópia v knižnici) to nemajú alebo to už riešia; jedine
   hromadná úprava má `settleOn: 'never'`.

## 1. Život takého riadku dnes

### 1.1 Vznik a hromadné načítanie

- `addByAssets` (`D-st:427-458`): riadok typu `Asset`, stav `Loading`, `assetId`, `fileId` = hlavný súbor assetu
  (alebo `null`), kľúč `asset_<id>`, prepínač jednorazového použitia z výberu. Hneď potom jedno hromadné čítanie
  `fetchLazyAdditionalMetadata` (`D-st:517-540`): kľúčové slová, autori, vlastné polia, prepínač, konflikty autorov,
  stav `Uploaded`, `canEditMetadata = true`.
- Asset, ktorý odpoveď nemá, alebo zlyhané čítanie: `failStillLoading` (`D-st:461-473`) → `Failed`, text
  `metadataUnavailable` („Metadáta sa nepodarilo načítať. Odstráňte položku a označte ju znova.",
  `locales/sk/system.json:103`) a záznam v `metadataFailures` (`D-st:164-167`).

### 1.2 Rola v usadzovaní a čo riadok dosiahne

- Rola `massEdit` (`D-st:86-87`), politika `reader: 'none', settleOn: 'never', duplicate: 'markDuplicate',
  metadata: 'load'` (`D-st:103-104`). Nikdy nie je sledovaný (`L-sm:702-703`), dopytovanie fronty ho nečíta.
- Dosiahne ho len: notifikácia jeho assetu (core-dam ich posiela len tomu, kto asset nahral, `notifyTo`,
  `CD/Notification/AssetFileNotificationDispatcher.php:45-57`), čítanie pre iný riadok toho istého assetu (tik
  sledovaného riadku uploadu, čítanie po notifikácii, „Obnoviť" iného riadku).
- Párovanie (`D-st:719-735`): nikdy počas `Loading`; s `fileId` notifikácia alebo čítanie toho istého súboru alebo
  bez súboru; bez `fileId` len doplnenie vzhľadu (zlyhanie ani duplikát ho nedosiahnu).

V praxi teda: používateľ nahral súbory, kým sa spracúvajú, označí ich v zozname a otvorí hromadnú úpravu.

### 1.3 Zlyhanie

Notifikácia `asset_file_failed` (`src/domains/system/composables/appNotificationListeners.ts:33-35`) →
`settleKnownFailed` (`L-se:366-372`) → `settleFailed` (`L-se:350-363`): `Failed`, chyba s dôvodom a bez textu,
`canEditMetadata = false`, `bump`; hák `onRowFinal` DAM zabudne záznam „metadáta chýbajú" (`D-st:254-259`).
To isté urobí čítanie, ktoré ukáže zlyhaný hlavný súbor (`L-se:635-636`). Čo používateľ napísal, ostane v riadku
(`DT/queue/notificationSettlesQueue.test.ts:259-272`).

### 1.4 „Spracovaný" po zlyhaní

- Notifikácia (`L-sm:612-621`): `settleProcessedByEvent` riadky s `settleOn: 'never'` vynechá (`L-se:380`);
  `announceProcessed` (`L-se:397-402`) zavolá hák `onProcessedSeen` DAM (`D-st:267-275`), ktorý zmaže chybu (nie
  chybu „metadáta chýbajú"). O 250 ms (LIB `…/settlement/uploadPollSchedule.ts:47`) čítanie assetu: pre `settleOn: 'never'` len
  doplnenie vzhľadu (stav assetu, náhľad; prepínače nie, `L-se:184-189`) a znova ten istý hák (`L-se:616-618`).
- Stav ostane `Failed`, formulár zamknutý. Notifikácia metadát ho odmietne (`L-se:582`; `metadataGate` už nepustí,
  lebo záznam zmizol pri zlyhaní). Pripínajú `DT/queue/notificationSettlesQueue.test.ts:220-235`,
  `DT/queue/slotNotifications.test.ts:775-799` a `:837-851`.

### 1.5 Čo používateľ vidí a môže

| | načítaný riadok (pred zlyhaním) | po zlyhaní | po „spracovanom" dnes |
|---|---|---|---|
| červené prekrytie (`AQIE:329-359`) | nie | áno, čip s dôvodom | **nie** |
| × „Zrušiť" (`AQIE:203-215`; odstráni riadok, `D-st:637-650`) | nie | áno | áno |
| „Obnoviť" (`AQIE:220-258`) | nie | nie | nie |
| „Upraviť" (`AQIE:368-376`), kôš (`AQIE:418-424`) | áno | nie | nie |
| formulár (`AQIE:439`), overenie pri uložení (`AQIE:103-105,442`) | áno | nie | nie |
| v hromadnom uložení (`asset/api/assetApi.ts:205-206`) | áno | nie | **nie** |
| stav | `uploaded` | `failed` | `failed` |

Znak „hotovo" tu nie je nikdy (`disable-done-animation`, `asset/components/footer/AssetFooterSelectedFull.vue:198`);
kompaktné zobrazenie (`AssetQueueSelectedItemSimple.vue:20-83`) stav `failed` od `uploaded` nerozlišuje. Počty sa
nemenia (hotové = `Uploaded` + `Failed`, `D-st:774-779`).

### 1.6 Kedy to v skutočnosti nastane

- core-dam: `validateTransition` povolí z `failed` nič (`CD/Domain/AssetFile/AssetFileStatusManager.php:121-130`);
  stav súboru inak zapisujú len továrne nových súborov (`CD/Domain/AssetFile/AbstractAssetFileFactory.php:85,209,329`)
  a fixtúry. Notifikácia ide synchrónne pri každej zmene stavu a nesie stav v čase odoslania
  (`AbstractAssetFileStatusFacade.php:226-252,299-318`; `AssetFileNotificationDispatcher.php:53`). Pre jeden súbor
  teda „spracovaný" po „zlyhal" nepríde a čítanie po „zlyhal" vždy ukáže „zlyhal".
- Obrátené doručenie (server „spracovaný, potom zlyhal", klient dostane opačne): hák zmaže chybu, ale čítanie
  o 250 ms ukáže `failed` a `settleFailed` riadok vráti do červeného (riadok nie je zastaraný, `bump` bol pred
  čítaním). Trvalý stav PV9 len vtedy, keď to čítanie zlyhá. Či môže server pre jeden súbor poslať „spracovaný" a
  potom „zlyhal", som nenašiel (prechod je povolený, ale cestu s oboma notifikáciami nie); **neoverené**, rovnako ako
  poradie doručenia v notifikačnom serveri.
- Testy (`DT/queue/notificationSettlesQueue.test.ts:226-231`) robia to, čo core-dam nerobí: falošný server prepne
  ten istý súbor zo `failed` na `processed`.

### 1.7 Krok 5 na tom nič nemení

Profil a háky sú „hotové v kroku 2, v kroku 5 sa nemenia" (jadro 1.4); K6 ich prenesie ako vlastný kód do tenkého
skladu (jadro 3.2, `navrh-jadro.md:1208-1212`); U5c presunie watcher „Obnoviť" doslova a × dostane `cancelStatuses`
admin-dam s `Failed` (komponenty 2.2). Po kroku 5 je správanie presne to isté a oprava sa dá vyjadriť celá vo
vlastnom kóde DAM.

## 2. Cieľové správanie

### 2.1 Z pohľadu používateľa

Server súbor spracoval, asset je v poriadku, teda riadok má byť ako každý iný načítaný riadok hromadnej úpravy:

| | riadok s metadátami (bežný prípad) | riadok, ktorému hromadné načítanie metadáta nedalo |
|---|---|---|
| čo ukazuje | bez chyby, náhľad a stav assetu z čítania | červené s „Metadáta sa nepodarilo načítať. Odstráňte položku a označte ju znova." |
| stav | `uploaded` (stav úspešného hromadného načítania) | `failed`, ako po `failStillLoading` |
| formulár | odomknutý, s tým, čo v riadku bolo (načítané, napísané pred zlyhaním, dopísané hromadnými operáciami); nič sa znova nenačíta | zamknutý |
| × / „Upraviť" / kôš | nie / áno / áno | áno / nie / nie |
| „Obnoviť" | nie (ani po 20 s) | nie |
| hromadné uloženie | áno, s overením (povinné prázdne pole uloženie zastaví, ako pri ostatných) | nie |
| neskoršia notifikácia metadát | nič nezmení (formulár už je) | dá metadáta a formulár, ako dnes riadku z `metadataFailures` |
| neskoršie „zlyhal" | riadok znova zlyhá, ako dnes | riadok zlyhá, ako dnes |
| duplikát (obranne; core-dam po duplikáte „spracovaný" nepošle) | `uploaded`, formulár zamknutý ako pri duplikáte | — |

Rovnaké pravidlo už platí pre riadok uploadu, ktorý vzdal klient: „dostane formulár späť tak, ako ho používateľ
nechal" (`DT/queue/slotNotifications.test.ts:725-748`; knižnica `LT/uploadQueuesStore.test.ts:278`).

### 2.2 Čo je produkt (rozhodne vlastník)

1. Riadok sa vráti do hromadného uloženia s formulárom (podstata opravy).
2. Hodnoty ostanú, ako sú v riadku; žiadne nové načítanie metadát.
3. × zmizne a riadok sa od tej chvíle overuje pri uložení (ako každý načítaný riadok).
4. Riadok bez metadát sa vráti na text „nepodarilo sa načítať", nie na prázdny formulár.
5. Voliteľný súrodenec (tá istá rola, iná príčina): riadok z `metadataFailures`, ktorému metadáta prinesie
   notifikácia, dnes dostane formulár a ide do uloženia, ale ostane `failed` (s ×), lebo stav nikto nezmení
   (`L-se:577-588`, `D-st:277-282`; `DT/queue/notificationSettlesQueue.test.ts:603-613` stav netvrdí). Dať mu
   `uploaded` je tá istá veta „problém zmizol, riadok je načítaný".

Nie je produkt: kde to v kóde je, nová pamäť, testy.

### 2.3 Zvažované a zamietnuté

- **F3 (len stav na „hotový")**, vyradené vo verzii 7 (Z25): bez formulára spustí watcher po 20 s „Obnoviť"
  (`AQIE:240-249`), ktoré nič nenačíta (`L-sm:589-590`, `L-se:616-618`), a neskoršia notifikácia metadát by
  formulár dala riadku bez metadát. Návrh nižšie dá stav a formulár naraz, takže watcher časovač nespustí
  (`AQIE:242`), a riadok bez metadát vráti do `metadataFailures`.
- **„Obnoviť" s `early: true` pre taký riadok** (jadro 5.2): klik a čítanie navyše na riadku, ktorý metadáta už má;
  `mergeLoadedMetadata` by prepísalo prepínač, ktorý mohol používateľ nastaviť (`L-se:158-159`); mení knižnicu
  (zámer čítania podľa roly) a riadok knižnice. Horšie a drahšie.
- **Nechať „zlyhal" a upraviť len zobrazenie:** riadok by ostal mimo uloženia, hoci asset je v poriadku; to je
  samotná chyba.
- **Pravidlo v knižnici** (nová hodnota politiky pre `settleOn: 'never'`): knižnica nevie, či riadku dalo metadáta
  hromadné načítanie DAM; potrebovala by nový člen profilu, testy LIB a kópiu. Stav riadku hromadnej úpravy je
  podľa dnešného kódu stav jeho načítania (`D-st:267-268`), teda patrí DAM.

## 3. Návrh opravy (F5)

### 3.1 Kde

Len `D-st` (po K6 tenký sklad, ten istý súbor): hák `onProcessedSeen` a jedna nová pamäť. Hák volajú obe cesty
(notifikácia `L-se:400`, čítanie s `seen` `L-se:618`, teda aj tik riadku uploadu toho istého assetu a „Obnoviť"
iného riadku), a obe sú pre jeden riadok idempotentné.

### 3.2 Zmena

```ts
// The mass-edit rows its batch load left without their metadata, whatever became of their file since: their form
// is empty, and the bulk save would send that.
const leftOutByBatch = new WeakSet<UploadQueueItem>()
```

- `failStillLoading` (`D-st:466`): k `metadataFailures.add(…)` aj `leftOutByBatch.add(toRaw(item))`.
- `fetchLazyAdditionalMetadata` (`D-st:531`): pri naplnení riadku `leftOutByBatch.delete(toRaw(…))`.
- `afterMetadataLoaded` (`D-st:277-282`): na začiatku `leftOutByBatch.delete(toRaw(item))`; pri bode 5 v časti
  „Pre vlastníka" navyše v `if (metadataFailures.delete(…))` aj `if (item.status === UploadQueueItemStatus.Failed)
  item.status = UploadQueueItemStatus.Uploaded` (záznam majú len riadky hromadnej úpravy).
- `onProcessedSeen` (`D-st:267-275`):

```ts
      /* The status of a mass-edit row is its batch load's. A processed file takes the error of the row away - not
       * the missing-metadata one, which is still true - and gives a row whose file had failed back what the failure
       * took: the form, as the user left it, or the missing-metadata text it had before. */
      onProcessedSeen: (queueId, item) => {
        if (metadataFailures.has(metadataFailureKey(queueId, item))) return
        item.error.hasError = false
        item.error.message = ''
        // The reason goes with the error: some rows print it in place of the message.
        item.error.assetFileFailReason = AssetFileFailReason.None
        if (item.status !== UploadQueueItemStatus.Failed) return
        if (leftOutByBatch.has(toRaw(item))) {
          // Still without its metadata: the row its batch load left, which the metadata notification may reach.
          metadataFailures.add(metadataFailureKey(queueId, item))
          item.error.hasError = true
          item.error.message = translate('system.uploadErrors.metadataUnavailable')
          return
        }
        item.status = UploadQueueItemStatus.Uploaded
        // A duplicate is settled read-only.
        if (!item.isDuplicate) item.canEditMetadata = true
      },
```

Prečo pamäť „bez metadát" a nie „s metadátami": testy sejú riadky priamo do `queues` (`DT/support/fakeDam.ts`,
`seedQueue`) bez hromadného načítania; výnimku (riadok bez metadát) zapíše len `failStillLoading`, takže zasiaty
riadok je načítaný ako v bežnom toku. `WeakSet` netreba upratovať pri odstránení ani v `rowRemoved` sady K6.

Prečo je strážca nutný, hoci prípad je dvojnásobne zriedkavý: bez neho by riadok bez metadát dostal prázdny
formulár a hromadné uloženie by assetu poslalo prázdne kľúčové slová, autorov a vlastné polia (`assetApi.ts:208-221`).

### 3.3 Čo sa nemení

- Knižnica (`L-se`, `L-sm`, typy, testy `settlement/__tests__`, kde hák zaznamenáva len volanie,
  `settlementFixtures.ts:338`), jadro kroku 5 a sady.
- Watcher „Obnoviť" a × (`AQIE:203-270`, po U5c presunuté doslova): pri `uploaded` s formulárom a bez chyby
  watcher „Obnoviť" skryje a časovač nespustí (`AQIE:233-242`); × ide podľa stavu. Kód riadku sa nemení.
- Párovanie (`D-st:719-735`), `metadataGate` (`D-st:252`), `onRowFinal` (`D-st:254-259`), počty, hromadné uloženie.
- Riadok, ktorému chýbajú metadáta a súbor nezlyhal: „spracovaný" ho nechá s textom (`D-st:270`), ako dnes
  (`DT/queue/notificationSettlesQueue.test.ts:615-625`).

### 3.4 Testy (admin-dam; v knižnici žiadny)

Otočia sa:
- `DT/queue/notificationSettlesQueue.test.ts:219-235` → „gives a mass-edit row whose file had failed its status
  and its form back when the file is processed after all, with what was typed": `[status, canEditMetadata]` =
  `['uploaded', true]`, `error` = `NO_ERROR`, `keywords` = `['typed']`, `assetStatus` = `'with_file'`.
- `DT/queue/slotNotifications.test.ts:773-799`: polovica duplikátu bez zmeny; riadok `picked` po
  `queueItemProcessed('asset-1', 'file-2')` `[Uploaded, true]`; nový názov (alebo dva prípady).

Ostanú bez zmeny a strážia: `slotNotifications.test.ts:820` a `:837` (notifikácia metadát nedosiahne riadok so
zlyhaným súborom), `notificationSettlesQueue.test.ts:603,615,627`, `DT/queue/queueRowStates.test.ts:107-134`,
`DT/queue/lazyMetadata.test.ts:87-139`.

Pribudnú:
- `DT/queue/notificationSettlesQueue.test.ts`, opis „a mass-edit row its batch load left out" (`:585`): „goes back
  to the text about its metadata when its failed file is processed after all, and the metadata notification still
  brings them" (`leftOut` → `failed` → `processed` → `failed`, text `metadataUnavailable`, bez dôvodu, bez
  formulára; potom `metadata()` → formulár, `['keyword-server']`, bez chyby).
- tamže: duplikát hromadnej úpravy, ktorý zlyhal a potom „spracovaný": `uploaded`, formulár zamknutý.
- `DT/queue/overlaySave.test.ts`, opis „the overlay of the assets picked for mass edit" › „its save button"
  (`:431`): uloženie pošle aj riadok, ktorého súbor bol po zlyhaní spracovaný, s napísanými hodnotami (dnes chýba).
- `DT/queue/queueRowStates.test.ts` (nový opis, `mountQueue` s `disableDoneAnimation`): po „zlyhal" a „spracovaný"
  nie je ×, „Upraviť", kôš a formulár sú zapnuté a ani po 20 s nie je „Obnoviť" (stráži výhradu, pre ktorú padlo F3).
- pri bode 5: `notificationSettlesQueue.test.ts:603-613` navyše `expect(picked.status).toBe('uploaded')`.

### 3.5 Zaradenie, veľkosť, register

- **Krok F5 (PV9)**: vlastný malý krok v strome DAM, **najskôr po K6**, najneskôr pred C3 (aby ho pokryli celé
  kontroly DAM v C3 a beh e2e vlastníka v Z). Priebeh podľa plánu 2.0; časť v LIB nemá, **kópia netreba**. Do plánu
  2.9 (riadok PV9) a do tabuľky „Opravy po K6" jadra 4.1 vedľa F1, F2, F4 (meno F3 je obsadené vyradenou opravou).
- Nie v K6: K6 stráži „celé `DT/` bez zmeny" a prenáša háky bez zmeny; oprava v ňom by tú stráž porušila. Pred K6
  by sa dala urobiť v dnešnom sklade, K6 by ju potom preniesol s ostatnými hákmi; neodporúčam (kolízia s
  najrizikovejším krokom).
- Veľkosť: kód asi +20 riadkov v jednom súbore; testy 2 otočené, 4 nové. **Asi 2 h**, pri bode 5 +0,5 h.
- Register jadra: nová položka **Z28 (PV9, F5)** „riadok hromadnej úpravy po zlyhanom a potom spracovanom súbore:
  stav a formulár naraz, riadok bez metadát späť na text"; Z25 ostane vyradená s dôvodom. Prehľad, časť 4: PV9 →
  rozhodnuté.

### 3.6 Riziká

- Obrátené doručenie notifikácií (1.6): riadok je asi 250 ms upraviteľný, kým čítanie nevráti zlyhanie; ak to
  čítanie zlyhá, ostane upraviteľný, hoci súbor zlyhal. Uloženie metadát takého assetu by podľa mňa server prijal
  (pred zlyhaním bol riadok upraviteľný); **neoverené**. Dnes je v tom istom prípade riadok „zlyhal" bez vysvetlenia.
- Hák mení stav bez `bump`: čítanie spustené pred notifikáciou a vrátené po nej by mohlo riadok znova zlyhať; podľa
  1.6 to znamená, že súbor naozaj zlyhal, a to je správne.
- Formulár sa pri zmene `canEditMetadata` znova pripojí (`AQIE:442`), ako pri každom inom oživení riadku.

## 4. Iné roly a knižnica

| Rola (strana) | Môže riadok zlyhať, kým server súbor dokončí? | Čo sa stane dnes | Treba opravu |
|---|---|---|---|
| `upload` (DAM) | áno: klient vzdá požiadavku dokončenia; sleduje sa s `clientFailed` (`D-st:705-709`) | „spracovaný" ho prepne na `uploaded` a dá formulár, čítanie dočíta metadáta (`L-se:378-394`, `329-341`); pripína `DT/queue/slotNotifications.test.ts:725,750` | nie |
| `slot` (DAM) | áno, to isté | čítanie slotov alebo notifikácia → `uploaded` (`L-sm:310-316`); formulár nemá | nie |
| `externalImport` (DAM) | zlyhaná požiadavka importu nedá riadku id (`shared/services/upload/externalProviderImportService.ts:33-49`) | nič ho nespáruje, ostane „zlyhal"; či server import vykoná aj pri stratenej odpovedi, **neoverené** | iná vec: bez id ho nenájde žiadne usadzovanie; F5 ho nepokrýva ani nemá |
| `massEdit` (DAM) | nie od klienta; zlyhá len slovom servera | PV9 | F5 |
| `upload`, `copy` (LIB) | áno, klient vzdá | `settleOn: 'read'` (LIB `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:113`): čítanie → `settleProcessed` s `wasFailed`, formulár a metadáta (`L-se:329-341`); „Obnoviť" cez `refreshMayHelp`; pripína `LT/uploadQueuesStore.test.ts:278`, `settlement/__tests__/uploadSettle.test.ts:130,146,937` | nie |

`settleOn: 'never'` má len rola `massEdit` (`D-st:103-104`; v LIB `grep settleOn` mimo testov nič iné). Jedna oprava
v DAM pokryje všetko, čo PV9 je; v knižnici rovnaká situácia nie je.

## 5. Popri tom (mimo PV9, na zváženie vedúcemu)

- **Neoverené:** riadok hromadnej úpravy, ktorý hromadné načítanie naplnilo skôr, než server spracoval metadáta
  nového assetu, notifikáciu metadát odmietne (`L-se:578`, formulár už má). core-dam pri spracovaní metadáta
  nepopísaného assetu doplní (`CD/Domain/AssetFile/FileProcessor/MetadataProcessor.php`, `autocompleteMetadata`) a
  hromadné uloženie pošle hodnoty z času načítania s `described: true` (`assetApi.ts:212-218`), čím by doplnené
  vlastné polia mohlo prepísať. Či sa nový asset v zozname dá označiť pred spracovaním, som neoveril. Ak áno, je to
  samostatný nález pre denník, nie súčasť F5.
- Riadok so zlyhaným súborom dnes vráti do poriadku aj nové hromadné načítanie toho istého assetu (`D-st:521-534`
  nastaví `uploaded` a formulár), napríklad pri druhom označení; či zoznam pri opätovnom označení volá `addByAssets`,
  **neoverené**. F5 to nemení.

## Pre vlastníka

1. Opraviť PV9 tak, že riadok, ktorého súbor server po zlyhaní spracoval, sa vráti do stavu „hotový", bez chyby, s
   formulárom a do hromadného uloženia. **Odporúčam áno.** (F5, len admin-dam, asi 2 h, po K6.)
2. Hodnoty ostanú, ako sú v riadku (načítané, napísané pred zlyhaním, z hromadných operácií), nič sa znova
   nenačíta; ako pri obnovenom riadku uploadu. **Odporúčam áno.**
3. × zmizne a riadok sa od tej chvíle overuje pri uložení (povinné prázdne pole uloženie zastaví), ako každý
   načítaný riadok. **Odporúčam áno.**
4. Riadok, ktorému hromadné načítanie metadáta nedalo, sa po spracovaní vráti na „Metadáta sa nepodarilo načítať"
   (nie prázdny formulár, ktorý by uložením zmazal metadáta assetu); notifikácia metadát ho oživí ako dnes.
   **Odporúčam áno** (súčasť F5).
5. Aj riadok „Metadáta sa nepodarilo načítať", ktorému metadáta prinesie notifikácia, dostane stav „hotový" (dnes
   má formulár, ale ostane „zlyhal" s ×). **Odporúčam áno**, +0,5 h v F5.
6. Na vedomie: s dnešným core-dam tento sled pri jednom súbore nenastane (stav „zlyhal" je konečný); oprava je
   poistka pre poradie doručenia a budúci backend. **Odporúčam opraviť aj tak** (malé, odstráni stav, ktorý dnes
   pripínajú testy).
7. Zaradiť ako samostatný krok F5 v admin-dam po K6 a pred C3; knižnica sa nemení, kópia netreba; register Z28.
   **Odporúčam áno.**
8. Upload, slot a import v admin-dam ani upload a kópia v knižnici opravu nepotrebujú (už ju majú, alebo ich
   prípad je iný). **Potvrdiť.**
