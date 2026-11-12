# Nálezy 39 a 29: zlyhané hromadné uloženie metadát nič nepovie (analýza, 9. 10.)

Čítaním kódu, nič nespúšťané. Skratky ciest:
`L/` = `common-admin/src/domains/`, `D/` = `admin-dam/src/domains/coreDam/`, `DT/` = `admin-dam/src/test/`,
`B/` = `core-dam/vendor/anzusystems/core-dam-bundle/src/` (verzia 1.52.0), `CB/` = `…/anzusystems/common-bundle/src/`.

## 0. Zhrnutie

- Koreň je na oboch stranách ten istý: hromadné uloženie ide **ručne cez `client().patch`** a pri zlyhaní odmietne
  **surovou chybou axiosu** alebo **poľom odpovedí**. `showErrorsDefault` pozná len triedy `Anzu*`; na takú chybu
  vráti `false` a nikto tú hodnotu nečíta. Jediná chyba, ktorá sa dnes ukáže, je „prihlasovací server neodpovedá".
- Zasiahnutých je **8 tlačidiel**: v knižnici 2 v dialógu fronty a 2 v dialógu jedného súboru, v admin-dam 2 v prekrytí
  uploadu a 2 v prekrytí hromadnej úpravy.
- Po zlyhaní ostane dialóg aj prekrytie otvorené, riadky aj napísané hodnoty ostanú a dá sa to zopakovať. Škoda
  vznikne, keď používateľ uverí, že je uložené, a zatvorí: pri usadenej fronte sa zatvorí hneď, bez otázky, a napísané
  metadáta sú preč.
- Backend: jedna požiadavka (najviac 10 assetov) sa uloží celá, alebo vôbec. Frontend však posiela dávky za sebou,
  takže pri 11 a viac riadkoch môže uložiť prvé dávky a na ďalšej zlyhať. Opakované uloženie je bezpečné.
- Oprava je malá a na oboch stranách rovnaká: požiadavka pôjde cez `useApiRequest` (preklad chyby na triedu a zápis do
  hlásenia chýb), volajúci dostane záchranu `if (!showErrorsDefault(e)) showUnknownError()`. Texty netreba nové.
  Po kroku 5 to ostáva na každej strane zvlášť (OL7), preto ide o dve rovnaké úpravy.

## 1. Kódové cesty

### 1.1 Spoločný koreň

| | Knižnica (admin-cms, admin-ugc) | admin-dam |
|---|---|---|
| Požiadavky | `updateMetadataSequence`: dávky po 10, za sebou, `client().patch(endPoint + '/metadata-bulk-update', …)` (`L/dam/api/damAssetApi.ts:195-211`) | to isté nad `damClient` (`D/asset/api/assetApi.ts:228-242`) |
| Odpoveď ≠ 200 | `reject(responses)`, pole odpovedí (`damAssetApi.ts:116-125`) | `reject(responses)` (`assetApi.ts:250-258`) |
| Žiadna dávka | `resolve([])` (`:112-113`) | `reject([])` (`:248-249`); tlačidlá sú vtedy vypnuté (`nothingToSave`), takže sa k tomu nedá dostať |
| Chyba axiosu | `reject(err)`, surová (`:127-130`) | `reject(err)`, surová (`:260-263`) |
| Zobrazenie | `showErrorsDefault` vráti `false` pre všetko, čo nie je `Anzu*` (`L/system/composables/alerts.ts:130-176`, `:175`) | tá istá funkcia z balíka |
| Hlásenie chýb API | `report` sa nevolá (porovnaj `L/api/utils/apiErrors.ts:116-147`) | tiež nie |

Dve chyby prejdú aj surové, lebo `showErrorsDefault` ich hľadá v reťazi príčin: `SessionExpiredError` a
`AuthUnavailableError`, ktoré hodí obsluha obnovy tokenu ešte pred odoslaním (`L/auth/composables/refreshSession.ts:107-128`).

### 1.2 Knižnica

**Dialóg fronty** `L/dam/uploadQueue/components/UploadQueueDialog.vue`:
- „Uložiť" (ikona): `onSave` `:93-112`. Točenie `saveButtonLoading` `:96`, kontrola formulára `:97-102`, uloženie `:104`,
  pri chybe `console.error` `:107` a `showErrorsDefault` `:108`, točenie stop `:110`. Tlačidlo `:231-249`.
- „Uložiť a použiť": `onSaveAndApply` `:114-147`. Po uložení mapovanie na obrázky (vlastné mapovanie aplikácie alebo
  `mapUploadMetadataToImages`, ktoré si pýta mená autorov cez `useApiFetchByIds`, takže tá chyba sa ukáže), potom
  `emit('apply')` `:141`. Pri chybe len `showErrorsDefault` `:142-144`, bez `console.error`. Tlačidlo `:220-230`.

**Dialóg jedného súboru** `L/dam/uploadQueue/components/UploadQueueDialogSingle.vue`:
- Tlačidlá sú v `UploadQueueDialogSingleSidebarMetadata.vue:82-99`, kontrola formulára `:50-66`, potom len `emit`.
  **Nemajú točenie ani sa nevypnú počas uloženia.**
- „Uložiť": `onSave` `:253-261`, chyba `showErrorsDefault` `:258-260`.
- „Uložiť a použiť": `onSaveAndApply` `:263-303`. Odpoveď 200 bez assetu: vlastné `throw new Error('Fatal error…')`
  `:272-274`, ktoré tiež prejde bez slova. Pri úspechu „Záznam bol upravený." `:275`, mapovanie, `apply`, zastavenie
  fronty a zatvorenie `:299` (`onStopConfirm` `:219-223`).

### 1.3 admin-dam

Klient `admin-dam/src/shared/apiClients/damClient.ts:10-28`: pri 401 odpovedi obsluha `interceptors/responseLogoutUser.ts` zavolá
`logoutUser()`, teda `window.location.pathname = '/logout'` (`D/../system/composables/currentUser.ts:1-3`).

- **Prekrytie uploadu** `D/asset/components/footer/AssetFooterUploadOverlayFull.vue`: „Uložiť" `onSave` `:74-92`
  (pri úspechu znova načíta zoznam assetov `:85`), „Uložiť a ukončiť" `onSaveAndClose` `:94-113` (pri úspechu zastaví
  a vyprázdni frontu, skryje prekrytie `:106`, `onStopConfirm` `:58-61`). Chyba v oboch `showErrorsDefault` `:87-89`,
  `:108-110`. Tlačidlá v `<Acl DAM_ASSET_UPDATE>` `:164-194`.
- **Prekrytie hromadnej úpravy** `D/asset/components/footer/AssetFooterSelectedFull.vue`: „Uložiť" `onSave` `:62-79`
  (zoznam nenačíta), „Uložiť a ukončiť" `onSaveAndClose` `:81-99` (pri úspechu vyprázdni frontu, odznačí assety,
  skryje `:93`, `onClearConfirm` `:39-43`). Chyba `:74-76`, `:94-96`.

### 1.4 Backend (`PATCH /adm/v1/asset/metadata-bulk-update`, pre UGC `/ugc/v1/…`)

- Kontrolér `B/Controller/Api/Adm/V1/AssetController.php:196-210`; UGC `core-dam/src/Controller/Api/Ugc/V1/AssetController.php:119-133`
  s vlastnou fasádou rovnakého tvaru (`core-dam/src/Domain/AssetMetadata/AssetMetadataBulkUgcFacade.php:54-88`).
- Fasáda `B/Domain/AssetMetadata/AssetMetadataBulkFacade.php:46-79`: najviac `max_bulk_item_count` = 10
  (`core-dam/config/packages/settings.php:46`, inak 422 `forbidden_operation` / `bulk_size_exceeded`, `:95-98`),
  validácia celého zoznamu vopred (`:49`), práva pre každý asset, autora a kľúčové slovo v slučke, jeden `flush` až
  po slučke (`:67`, manažér volá `updateExisting(…, false)`).
- **Jedna požiadavka je teda „všetko, alebo nič"** pre databázu. Výnimka: zlyhanie indexu Elasticsearch po `flush`
  (`B/Elasticsearch/IndexManager.php:24-42`) dá 500, hoci dáta tej dávky sú uložené (odvodené).
- **Čiastočný úspech vzniká na frontende:** pri 11 až 50 riadkoch (limit fronty 50) idú 2 až 5 dávok za sebou;
  zlyhaná dávka zastaví ďalšie, predošlé ostanú uložené (pripína `L/dam/__tests__/damAssetApiBulkMetadata.test.ts:175-187`).
  Opakovanie pošle všetko znova; zapíše tie isté hodnoty, udalosť zmeny sa pošle len pri skutočnej zmene
  (`isAssetChanged`, `:82-89`), takže je bezpečné.
- Odpovede: 200 so zoznamom; 403 (`CB/Exception/Handler/AccessDeniedExceptionHandler.php:33`); 422 `validation_failed`
  s poliami; 503 v režime len na čítanie (`AppReadOnlyModeExceptionHandler.php:29`); 500 ostatné.
- Kľúče polí pri 422: zoznam sa validuje ako kolekcia, takže cesta má index v dávke: `[0].keywords`, `[0].authors`
  (`B/Validator/Constraints/AssetValidator.php:40-56`), `[2].customData.<vlastnosť>` (`CustomDataValidator.php:24,83`;
  index pridá `symfony/validator/Validator/RecursiveContextualValidator.php:356-378`). Index je poradie v dávke medzi
  odoslanými riadkami, nie číslo riadku na obrazovke.

## 2. Čo vidí používateľ podľa druhu chyby

Platí pre všetkých 8 tlačidiel, ak nie je uvedené inak. „Dnes" = súčasný kód, „po oprave" = návrh A z kap. 5.

| Chyba | Čo príde do `catch` | Dnes | Po oprave (existujúci text, SK) |
|---|---|---|---|
| sieť nedostupná | `AxiosError` bez odpovede | nič | „Systémová chyba. Skúste neskôr alebo kontaktujte administrátora." |
| vypršal čas (15 až 30 s na dávku) | `AxiosError` `ECONNABORTED` | točí sa až do vypršania, potom nič | „Požiadavka na API vypršala. Skúste to prosím znova." (server mohol uloženie aj dokončiť) |
| relácia skončila pred odoslaním | `SessionExpiredError` | nič, odhlásenie beží (zámer) | rovnako |
| prihlasovací server neodpovedá | `AuthUnavailableError` | „Prihlasovací server momentálne neodpovedá…" | rovnako |
| 401 odpoveď | `AxiosError` 401 | admin-dam: odhlási a odíde zo stránky; admin-cms, admin-ugc: nič, ostáva prihlásený | admin-dam: odhlásenie a na okamih „Systémová chyba" (tak ako dnes pri každej inej požiadavke admin-dam); CMS a UGC: „Systémová chyba"; do hlásenia chýb sa nezapíše |
| 403 | `AxiosError` 403 | nič | „Prístup zamietnutý. Na vykonanie danej akcie nemáte oprávnenie." |
| 422 s poliami | `AxiosError` 422 | nič | „Opravte tieto chyby." + riadok na pole; bez kap. 5.3 v technickom tvare, napr. `coreDam.asset.model.[0]: Kľúčové slová: Povinné pole je prázdne.` (odvodené z `alerts.ts:72-101,178-188`) |
| 500, 503 | `AxiosError` | nič | „Systémová chyba…" |
| 2xx iné než 200 | pole odpovedí | nič | „Systémová chyba…" |
| 200 bez assetu (len dialóg jedného súboru, „uložiť a použiť") | `Error('Fatal error…')` | nič | „Systémová chyba…" |
| čiastočné (zlyhá 2. až 5. dávka) | ako chyba tej dávky | nič; prvé dávky sú uložené | hláška podľa chyby tej dávky; zopakovanie dokončí zvyšok |

Chybové hlášky ostávajú, kým ich používateľ nezavrie (`showErrorsDefault` dáva trvanie −1, `alertsQueue.ts:25-31`).
Krok za krokom dnes, napr. „Uložiť" v prekrytí uploadu: klik, ikona sa točí, odíde 1 až 5 `PATCH`, zlyhá, točenie
prestane, tlačidlo je znova aktívne. Pri úspechu by navyše na 3 s vyskočilo zelené „Záznam bol upravený."; jediný
rozdiel je, že sa neukáže. V dialógu jedného súboru sa netočí ani tlačidlo, takže po kliku sa nezmení vôbec nič.

## 3. Stav po zlyhaní

| Miesto | Dialóg / prekrytie | Riadky, napísané hodnoty | Zopakovať | Čo sa stratí, keď používateľ zavrie |
|---|---|---|---|---|
| LIB fronta „uložiť" | otvorený | ostanú | áno, tlačidlo aktívne | zatvorenie pri usadenej fronte je okamžité (`UploadQueueButtonStop.vue:24-28`): napísané metadáta; assety ostanú v DAM bez nich |
| LIB fronta „uložiť a použiť" | otvorený, widget nič nedostal, `maxPosition` bez zmeny | ostanú | áno | to isté, a obrázky nie sú vo widgete |
| LIB jeden súbor, oba | otvorený, položka „nahraná", detail assetu ostane | ostanú | áno, aj opakovaným klikom počas behu | to isté |
| DAM upload „uložiť" / „uložiť a ukončiť" | plné, fronta nezastavená, zoznam sa nenačíta | ostanú | áno | zatvorenie pri usadenej fronte je okamžité (`DT/queue/overlaySave.test.ts:322-331`) |
| DAM hromadná úprava, oba | plné, výber v zozname ostane | ostanú | áno | zatvorenie sa pýta, potom zahodí |

## 4. Ako chyby hlásia ostatné uloženia (vzor pre opravu)

1. **`useApiRequest` / `useApiCommand` / čítacie pomocníky** (oba repozitáre): chyba sa preloží `mapApiError` na
   triedu `Anzu*` a zapíše `report` (bez 401, 403 a validácie) (`L/api/composables/useApiRequest.ts:153-167`);
   volajúci len `catch (e) { showErrorsDefault(e) }`. Príklady: `UploadQueueDialog.vue:152-164` (detail assetu),
   `D/asset/components/detail/components/AssetDetailSidebarMetadata.vue:71-80` (zmazanie). V admin-dam takto 193 miest.
2. **Ručná požiadavka preložená na mieste**, oprava „tichej kópie" z tretej sady: ne-200 → `AnzuApiResponseCodeError`,
   `catch` → `mapApiError` (`L/dam/api/damImageApi.ts:288-309`; bez `report`, nález 17).
3. **Záchrana u volajúceho**: `if (!showErrorsDefault(e)) showUnknownError()` (`L/dam/imageWidget/components/ImageWidgetMultipleInner.vue:506-509`,
   `L/system/composables/recordPage.ts:47`).
4. **Uloženie detailu assetu** `updateAssetMetadata` (`L/dam/api/damAssetApi.ts:266-306`, `D/asset/api/assetApi.ts:296-339`):
   triedy skladá ručne; pri 422 samo ukáže hlášku s názvami vlastných polí podľa konfigurácie
   (`handleMetadataValidationError`, `damAssetApi.ts:240-264`, `assetApi.ts:269-294`) a potom ju volajúci ukáže
   druhýkrát cez `showErrorsDefault` (odvodené); ne-200 odmietne s `undefined`, ticho. **Nekopírovať.**

Oprava teda nasleduje vzor 1 (rovnaký tvar na oboch stranách), so záchranou 3 u volajúceho.

## 5. Návrh opravy

### 5.1 API, každá strana zvlášť, rovnaký tvar (návrh A)

Ručné `patch` nahradiť `useApiRequest` pre každú dávku. `validateStatus` drží dnešné pravidlo „úspech je len 200"
(bez neho by `useApiRequest` bral aj 201 a 202 s telom); ostatné odpovede axios odmietne a `mapApiError` ich preloží.
admin-dam nemôže použiť `mapApiError` ani `report` (balík ich nevyváža, `src/lib.ts:603`), `useApiRequest` áno.

```ts
// Only a 200 carries the saved assets: any other answer is a save that failed, as before.
const useMetadataBulkUpdate = (client: () => AxiosInstance, endPoint: string) =>
  useApiRequest<AssetMetadataBulkItem[], AssetMetadataBulkItemBody[]>({
    client,
    method: 'PATCH',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/metadata-bulk-update',
    options: { validateStatus: (status) => status === HTTP_STATUS_OK },
  })
// v bulkUpdateAssetsMetadata: for každej dávky saved.push(...(await execute({ body: batch })))
```

- LIB: `damAssetApi.ts:102-132,195-211` (asi −35 / +20). `bulkUpdateAssetsMetadata` sa nevyváža (`src/lib.ts:534-539`),
  podpis môže ostať. Rovnaký `updateAuthorsSequence` (`:354-392`, uloženie autorov galérie, nález 32) môže ísť tou
  istou funkciou; nie je nutné.
- DAM: `assetApi.ts:228-265` (asi −30 / +20). Prázdna dávka: nechať, ako je (nedosiahnuteľné).
- Telo požiadavky sa nemení (`JSON.stringify` robí `useApiRequest` rovnako, `useApiRequest.ts:131`).

### 5.2 Volajúci (8 blokov `catch`)

`showErrorsDefault(error)` → `if (!showErrorsDefault(error)) showUnknownError()`: LIB `UploadQueueDialog.vue:106-108`
(a zmazať `console.error`, zápis už robí `report`), `:142-144`, `UploadQueueDialogSingle.vue:258-260`, `:300-302`;
DAM `AssetFooterUploadOverlayFull.vue:87-89`, `:108-110`, `AssetFooterSelectedFull.vue:74-76`, `:94-96`. Záchrana
pokryje aj vlastné `Error` dialógu jedného súboru (`:273`) a výnimku z mapovania aplikácie.

### 5.3 Názvy polí pri 422 (návrh B, voliteľné)

Bez tejto časti hláška pri 422 ukáže technický kľúč s indexom dávky (kap. 2). Zriedkavé: frontend kontroluje tie
isté povinné polia z tej istej konfigurácie, 422 príde len pri nezhode (napr. zmena konfigurácie počas práce).
Oprava: pri `isAnzuApiValidationError` zahodiť `…[i].`, `customData.<vlastnosť>` preložiť na názov poľa
z konfigurácie (typy assetov odoslaných riadkov), `keywords` a `authors` na existujúce popisky
(`common.damImage.asset.model.*`, `coreDam.asset.model.*`), a ukázať `showApiValidationError(položky, -1, true)`.
Je to logika `handleMetadataValidationError`, ktorú obe strany už majú; výsledok vyzerá ako pri detaile:
„Opravte tieto chyby. / Titulok: Povinné pole je prázdne." Riadok sa neoznačí (index na riadok sa dá priradiť, ale
nie je to potrebné).

### 5.4 Dialóg jedného súboru bez točenia (voliteľné)

Dialóg fronty točí a vypína druhé tlačidlo (`UploadQueueDialog.vue:225-226,238-239`), dialóg jedného súboru nie.
Ani po oprave nerozlíši pomalé uloženie od žiadneho, kým nepríde odpoveď, a dvojklik pošle dve požiadavky.
Oprava: `saving` v `UploadQueueDialogSingle.vue`, podané do `UploadQueueDialogSingleSidebarMetadata.vue`
ako `:loading` / `:disabled` (tlačidlá `:82-99`). Viditeľná, ale len zblíženie s dialógom fronty.

### 5.5 Po kroku 5

- API súbory krok 5 nemení (ani K3, ten mení len `imageApi.ts` a spol. a `fileApi.ts`, `plan-implementacie.md:486-493`).
- Uloženie ostáva vo **vlastnom kóde obalov** každej strany (`navrh-komponenty.md:401` OL7, `:1110`); spoločné
  komponenty (riadok, zoznam, sidebar, tlačidlo zastavenia) nič neukladajú. Jedna zmena pre obe strany by znamenala
  presunúť hromadné uloženie do knižnice s voľbou tvaru tela (admin-dam vynechá neznámy `mainFileSingleUse`,
  `assetApi.ts:219-220`; knižnica ho pošle, `damAssetApi.ts:230`, nález 36). To je rozdiel v tom, čo sa posiela,
  preto neodporúčam. Dve rovnaké úpravy po asi 20 riadkov sú lacnejšie.
- Kolízie: DAM `AssetFooterUploadOverlayFull.vue` mení U5a (tlačidlo zastavenia), LIB `UploadQueueDialogSingle*.vue`
  mení U6, `DT/queue/overlaySave` je stráž K6 (`plan-implementacie.md:510`) a U5a. **Najlepšie pred S0**; potom
  stráže kroku 5 len obsahujú nové prípady. Citácia `overlaySave.test.ts:510-520` v pláne sa posunie o pridané riadky
  a východiskové počty testov (plán 5.2) sa zmenia; vedúci ich pri S0 aj tak zapisuje nanovo.
- DAM časť nepotrebuje novú kópiu knižnice (používa len `useApiRequest`, `HTTP_STATUS_OK`, `useAlerts` z balíka).

### 5.6 Texty

Žiadny nový kľúč. Použijú sa `common.alert.unknownError`, `common.alert.forbiddenError`, `error.apiTimedOut.message`,
`common.alert.fixApiValidationErrors` + `error.apiValidation.*` (`L/../locales/sk/common/alert.json:2-8`,
`…/sk/error/apiTimedOut.json`). admin-dam ich má cez `useAlerts` z balíka. Pri čiastočnom uložení navrhujem
nehovoriť „uložené X z Y" (nový text, pri opakovaní zbytočný).

### 5.7 Testy

Otočia sa prípady „Today's behaviour, pinned as it is":
- DAM `DT/queue/overlaySave.test.ts`: 9 prípadov (`:253-271`, `:304-318`, `:492-503`) budú tvrdiť hlášku
  (EN „System error, try again later or contact administrator", pri validácii „Please, fix these errors" + riadok).
  Falošnú 422 (`:63-68`) zmeniť na tvar backendu `'[0].customData.title'`. Nové: „uložiť" hromadnej úpravy pri
  zlyhaní (dnes chýba), 403 → text prístupu, druhá dávka zlyhá → hláška a prvá dávka bola odoslaná.
- DAM `DT/asset/bulkMetadata.test.ts`: triedy chýb (403, 422, 500, 204, sieť, vypršanie) a zápis do hlásenia (500 áno,
  401 a 403 nie).
- LIB `L/dam/__tests__/consumerProfileUploadDialogActions.test.ts:245-265`, `:366-381` a
  `consumerProfileUploadDialogSingle.test.ts:400-421` (2 prípady), každý v oboch profiloch: tvrdiť hlášku. Nové:
  „uložiť" dialógu jedného súboru pri zlyhaní; 403.
- LIB `damAssetApiBulkMetadata.test.ts:164-173` ostane zelený (stále odmietne); doplniť triedu chyby a zápis do
  hlásenia. `uploadQueueDialogSingle.test.ts` a `uploadQueueDialogSave.test.ts` (sklad a API nahradené) bez zmeny.
- Pri 5.3 po jednom prípade na stranu (vlastné pole, kľúčové slová); pri 5.4 točenie a jedna požiadavka pri dvojkliku.

### 5.8 Veľkosť a zaradenie

| Časť | LIB | DAM |
|---|---|---|
| A: API + 4 bloky `catch` + testy | 1,5 h | 1,5 h |
| B: názvy polí pri 422 | +1 h | +1 h |
| točenie v dialógu jedného súboru | +0,75 h | — |

Vlastný malý krok (ako nález 20), pred S0; LIB a DAM nezávisle. Ak až počas kroku 5: DAM časť po U5a, LIB časť
jedného súboru po U6 (alebo v ňom).

## 6. Súvisiace (pre iných agentov a denník)

- **Nález 32** (`analyza-nalez32`): uloženie autorov galérie `bulkUpdateAssetsAuthors` má ten istý surový tvar
  (`damAssetApi.ts:354-392`); nie je tiché vďaka záchrane volajúceho (`ImageWidgetMultipleInner.vue:506-509`), ale aj
  pri 403 povie len „Systémová chyba" a nezapíše sa. Pri 5.1 môže ísť tou istou funkciou.
- **Nález 36** (`analyza-nalez36`): mení `listItemsToMetadataBulkItems` (`damAssetApi.ts:217-236`) v tom istom súbore;
  zladiť poradie. Tvar tela táto oprava nemení.
- **Nové pre denník (nerobiť teraz):** uloženie detailu assetu na oboch stranách ukáže pri 422 dve hlášky a pri 2xx
  inej než 200 odmietne s `undefined`, ticho (`damAssetApi.ts:285-290,296-298`, `assetApi.ts:317-331`; odvodené).
- Asset zmazaný v DAM, kým je vo fronte, by pravdepodobne zhodil celú svoju dávku (EntityIdHandler vráti `null`,
  DTO ostane s prázdnym assetom; 422 alebo 500) pri každom opakovaní. Neoverené; po oprave to aspoň bude vidno.

## 7. Čo som neoveril

- Nič nebolo spustené proti serveru; cesty polí pri 422 (`[i].…`) a presný tvar technickej hlášky sú odvodené
  z kódu Symfony a z `alerts.ts`.
- Že `validateStatus` v `options` falošný server testov rešpektuje (LIB `dam.client`, DAM `server.client`): treba
  overiť prvým behom.
- Správanie pri zmazanom assete vo fronte (kap. 6) a 500 po uložení pri zlyhanom indexe.

## Pre vlastníka

1. Opraviť nálezy 29 a 39 (zlyhané uloženie ukáže hlášku na všetkých 8 tlačidlách), ako vlastný malý krok pred
   začiatkom kroku 5: **áno**; 3 h (LIB 1,5, DAM 1,5), strany nezávislé.
2. Hláška podľa druhu chyby z existujúcich textov (sieť, 500, neočakávaná odpoveď → „Systémová chyba…"; 403 →
   „Prístup zamietnutý…"; vypršaný čas → „Požiadavka na API vypršala…"), bez nového textu: **áno**.
3. Pri odmietnutí validáciou (422) ukázať názvy polí ako v detaile assetu, nie technický kľúč: **áno**; +2 h (1 h na
   stranu), v tom istom kroku.
4. Pri čiastočnom uložení (viac ako 10 riadkov) tá istá hláška, bez „uložené X z Y"; opakovanie je bezpečné: **áno**.
5. Po chybe ostane dialóg aj prekrytie otvorené s riadkami ako dnes, len s hláškou: **potvrdiť**.
6. Dialógu jedného súboru v knižnici pridať točenie a zákaz druhého kliku počas uloženia, ako má dialóg fronty:
   **áno**; 0,75 h, v tom istom kroku.
7. Zlyhané hromadné uloženie zapisovať do hlásenia chýb API ako ostatné požiadavky (401, 403, 422 nie): **áno**;
   príde samo s bodom 1.
8. Uloženie autorov galérie (nález 32) prepnúť na tú istú funkciu, aby 403 povedalo „Prístup zamietnutý": **áno, ak
   sa robí bod 1**; +0,5 h.
9. Dvojitá hláška a tiché zlyhanie pri uložení detailu assetu (obe strany) zapísať do denníka ako nový nález,
   neopravovať teraz: **áno**.
10. Spoločná funkcia uloženia v knižnici pre obe strany: **nie** (strany posielajú iné telo, to je produkt); dve
    rovnaké úpravy.
