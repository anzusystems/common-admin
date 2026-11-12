# Nález 36: čo ide do API obrázkov (analýza, 9. 10.)

Zadanie: denník, nález 36; návrh komponentov IM10. Len čítanie kódu (LIB, admin-cms, admin-ugc, core-cms, core-dam);
nič sa nespúšťalo. Skratky: `L/` = `common-admin/src/domains/dam/`, `ACMS/` = admin-cms, `UGC/` = admin-ugc,
`CMS-BE/` = core-cms, `DAM-BE/` = `core-dam/vendor/anzusystems/core-dam-bundle/src/`, `SER/` =
`vendor/anzusystems/serializer-bundle/src/` (v core-cms aj core-dam verzia 6.1.0).

## 0. Skrátene

- `authorIds` a `assetId` idú v admin-cms naozaj v tele `POST`/`PUT /adm/v1/image`. core-cms ich **ticho ignoruje**:
  nič neuloží a nič neodmietne. Ostanú len v audit logu (surové telo požiadavky). admin-ugc ich nepošle nikdy,
  pretože jeho funkcia obrázka skladá telo pole po poli.
- Galéria posiela do `PUT /adm/v1/image` ešte viac navyše (`key`, `damAuthors`, `showDamAuthors`, `assetId`,
  pri nahratých aj `authorIds`). Core-cms to ignoruje tiež.
- Druhé čítanie po vytvorení (`GET /adm/v1/image/{id}`, v UGC `GET /image/{id}` blogu) neprinesie nič nové. Vráti
  tú istú entitu tým istým serializátorom. Náhľad počas neho blikne na zástupný obrázok a ak zlyhá, ukáže chybu po
  úspešnom uložení. Deje sa po každom **vytvorení** (výber z DAM aj upload), nie po úprave.
- `mainFileSingleUse` nejde do API obrázkov, ale do `PATCH …/asset/metadata-bulk-update` v DAM. Hodnotu `null` DAM
  zmení na `false` a uloží `false`. Obe dialógy teda ukladajú to isté. `null` v riadku pri skutočnom DAM prakticky
  nenastane.
- Odporúčanie: všetky tri časti zjednotiť bez zmeny čohokoľvek uloženého. Je to asi 3 h, krok „nález 36" po U7
  (LIB, kópia C3).

## 1. Čo posiela každá cesta

| Cesta (widget → dialóg) | admin-cms | admin-ugc |
|---|---|---|
| Jeden obrázok `AImageWidget` → `UploadQueueDialogSingle` | 1) `PATCH /adm/v1/asset/metadata-bulk-update`, `mainFileSingleUse` = hodnota prvého riadku `?? false`, rovnaká pre **všetky** riadky (`L/uploadQueue/components/UploadQueueDialogSingle.vue:240,256,266-271`; `L/api/damAssetApi.ts:230`). 2) mená autorov `GET …/author/…/ids/…` (`L/imageWidget/utils/metadataToImageMap.ts:56-61`). 3) `apply` s položkami mapovania + `position: 1` (`UploadQueueDialogSingle.vue:292-298`); položka má `authorIds`, `assetId` (`metadataToImageMap.ts:79-97`). 4) widget dá `items[0]` do dialógu obrázka (`L/imageWidget/components/ImageWidgetInner.vue:609-621`). 5) po potvrdení `POST /adm/v1/image` (alebo `PUT /adm/v1/image/{id}`) s **celým** objektom: `texts, flags, dam, position, authorIds, assetId[, id]` (`ImageWidgetInner.vue:566-568`; `L/imageWidget/composables/imageApiCms.ts:41-63`). 6) po `POST` ešte `GET /adm/v1/image/{id}` (kap. 3). Pripnuté v teste: `L/imageWidget/__tests__/consumerProfileImageWidgetUpload.test.ts:200-209,328-336,358` | 1) ten istý `PATCH` na `/ugc/v1/asset/metadata-bulk-update`. 2) žiadne mená: vlastné mapovanie (`UGC/src/domains/blog/image/composables/customMetadataToImageMap.ts:20-37`, `authorIds: []`, `assetId`). 3)–4) rovnako. 5) `createImageWidget` / `updateImageWidget` poskladá `BlogImage` pole po poli (`id, texts{description, author}, dam{damId, regionId, filename}, settings, position, licencedBlog, licencedUser`). `authorIds` ani `assetId` sa do požiadavky nedostanú (`UGC/src/domains/blog/image/composables/imageWidgetMappings.ts:35-56,71-94`). 6) po vytvorení `GET /image/{id}` blogu (`:64-69`) |
| Obrázok alebo médium `AImageMediaWidget` → `UploadQueueDialogSingle` | ako vyššie (`L/imageWidget/components/ImageMediaWidgetInner.vue:750-762,695-704`) | ako vyššie |
| Galéria `AImageWidgetMultiple` → `UploadQueueDialog` | 1) `PATCH …/metadata-bulk-update`, `mainFileSingleUse` = hodnota každého riadku, môže byť `null` (`L/uploadQueue/components/UploadQueueDialog.vue:125`; `damAssetApi.ts:230`). 2) mená autorov. 3) položky `{key, …mapovanie, position, damAuthors: authorIds, showDamAuthors, assetId}` (`UploadQueueDialog.vue:130-140`). 4) pri uložení galérie najprv zápis autorov do DAM (nález 32), potom `PUT /adm/v1/image` s `{images: [...]}` celých položiek skladu: `key, damAuthors, showDamAuthors, assetId` vždy, `authorIds` pri nahratých (`L/imageWidget/components/ImageWidgetMultipleInner.vue:447-468`; `imageApiCms.ts:103-116`). To isté platí aj pre obrázky vybrané z DAM (IM4, IM5) | 1)–3) rovnako. 4) zápis autorov sa nerobí; `bulkUpdateImagesWidget` skladá `BlogImage` pole po poli (`imageWidgetMappings.ts:106-131`), takže nič navyše nejde |
| Výber assetu s uploadom `AAssetListInner` → `UploadQueueDialog` | `PATCH` + mená autorov; výsledok mapovania sa zahodí, zoznam sa len obnoví (`L/assetSelect/components/AAssetListInner.vue:213-217`) | `PATCH` |
| Vloženie assetu do textu (admin-cms, `pasteDamAssetExtension.ts:166-179`) | `POST /adm/v1/image` len s poľami obrázka; mimo LIB, nálezu sa netýka | — |

Admin-cms nemá vlastné `imageApi` ani vlastné mapovanie (`ACMS/src/main.ts:56-81`), takže ide cez predvolené funkcie
knižnice (`L/imageWidget/composables/commonAdminImageOptions.ts:29-38`). admin-ugc má oboje (`UGC/src/main.ts:62-66,79-95`).

## 2. Čo s tým robia backendy

**core-cms, `/adm/v1/image` (jeden aj hromadný).** Kontrolér deserializuje telo do entity `Image`
(`CMS-BE/src/Domain/Image/Controller/Api/Adm/V1/ImageController.php:132,170,189`). Deserializátor prechádza len
vlastnosti s `#[Serialize]` a ostatné kľúče tela nečíta (`SER/Service/JsonDeserializer.php:86-89`). `Image` nemá
`authorIds`, `assetId`, `key`, `damAuthors` ani `showDamAuthors` (`CMS-BE/src/Domain/Image/Entity/Image.php:57-100`;
vnorené `ImageTexts`, `ImageFlags`, `DamImage` tiež nie). Výsledok: **ignorované**, nič neuložené, žiadna chyba
validácie. Jediná stopa je audit log: každý `POST`/`PUT` uloží surové telo
(`CMS-BE/vendor/anzusystems/common-bundle/src/Log/Factory/LogContextFactory.php:79`; zapnuté v
`CMS-BE/config/packages/anzu_systems_common.php:140-141`).

**admin-ugc, API obrázkov blogu.** Kľúče navyše odpadnú už v aplikácii (kap. 1). Backend blogu nie je k dispozícii,
netreba ho.

**DAM, `metadata-bulk-update` (CMS aj UGC, ten istý DTO a manažér).** Pole je `private bool $mainFileSingleUse`, teda
nie nullable (`DAM-BE/Model/Dto/Asset/FormProvidableMetadataBulkUpdateDto.php:34-35`). UGC kontrolér používa ten istý
DTO (`core-dam/src/Controller/Api/Ugc/V1/AssetController.php:119-121`) a ten istý manažér.
- `null`: `BasicHandler` pri ne-nullable `bool` vráti `filter_var(null, FILTER_VALIDATE_BOOL)`, čo je `false`
  (`SER/Handler/Handlers/BasicHandler.php:40-51`). Hodnota teda nie je `null` a nastaví sa (`JsonDeserializer.php:95-100`).
  Manažér zapíše `setSingleUse(false)` (`DAM-BE/Domain/Asset/AssetMetadataBulkManager.php:77-86`). *Výsledok
  `filter_var` je podľa zdrojov a dokumentácie PHP; nespustené, PHP tu nie je.*
- `false`: to isté, uloží sa `false`.
- Kľúč chýba: `isMainFileSingleUndefined()` a príznak ostane, ako je (`FormProvidableMetadataBulkUpdateDto.php:193-196`;
  manažér `:79-81`).
- Príznak v DB je `bool`, predvolene `false` (`DAM-BE/Entity/Embeds/AssetFileFlags.php:20,32`).

**Kedy má riadok `null`.** Továreň dá `null` (`L/uploadQueue/factory/UploadQueueItemFactory.ts:59`). Načítanie
metadát ho prepíše hodnotou servera (`L/uploadQueue/settlement/uploadSettle.ts:158`) a ukladá sa len riadok
s formulárom, ktorý vzniká práve týmto načítaním (`damAssetApi.ts:214-216`; `uploadSettle.ts:336-338,584`). Server
dá `null` len vtedy, keď asset nemá hlavný súbor (`DAM-BE/Model/Dto/Asset/AssetAdmListDto.php:119-122`). Upload
nastaví hlavný súbor už pri založení slotu (`DAM-BE/Domain/AssetSlot/AssetSlotFactory.php:38`). Pri skutočnom DAM
teda prázdny riadok pri ukladaní prakticky nenastane. V testoch nastane, lebo falošný DAM kľúč vynecháva
(`L/__tests__/consumerProfileUploadDialogSingle.test.ts:335-336`).

**Záver (c).** `false` a `null` sa v DAM ukladajú rovnako (`false`), v CMS aj UGC. Líši sa len telo požiadavky.

## 3. Druhé čítanie po vytvorení

- Ako vznikne: po `createImage` widget nastaví `modelValue = res.id` a sám obrázok obnoví z odpovede
  (`ImageWidgetInner.vue:570-574`). Model sa však zmenil z `null` na nové id, a tak sa spustí aj sledovač
  `[props.image, modelValue]` (`:685-691`). Ten zavolá `reload` bez vynútenia, a keďže obrázok už je, ide vetvou
  čítania podľa id (`:357-389`). V `ImageMediaWidgetInner.vue` je to rovnako (`:440-457`, `:365-404`, `:699-704`).
  Po úprave sa id nezmení, preto čítanie nie je (`consumerProfileImageWidgetUpload.test.ts:358-361`).
- Čo obnoví: nič. core-cms vracia v `POST` aj `GET` tú istú entitu tou istou cestou (`createdResponse`/`okResponse` →
  `getResponse`, `ImageController.php:139,68`), bez zmeny medzi nimi (`ImageFacade.php:34-40`). V UGC obe odpovede prejdú
  tým istým `blogImageToImageAware` (`imageWidgetMappings.ts:64-81`). Pri `expandMetadata` sa detail prepíše tým istým
  obsahom.
- Vedľajšie účinky (z kódu, v prehliadači neoverené): `reload` najprv nastaví zástupný obrázok (`ImageWidgetInner.vue:358`),
  takže náhľad počas `GET` blikne. Ak `GET` zlyhá, používateľ dostane chybu hneď po úspešnom uložení (`:374-377`).
  K tomu jedna požiadavka navyše pri každom novom obrázku, či už z uploadu, alebo z výberu v DAM.
- Potrebné nie je.

## 4. Najbezpečnejšie zjednotenie

| # | Čo | Kde | Uložené dáta | Čo sa zmení navonok |
|---|---|---|---|---|
| A | Do API obrázkov posielať len polia obrázka (`id`, `texts`, `flags`, `dam`, `position`; `id` a `position` len ak sú, ako dnes). Jedna vnútorná pomôcka (napr. vedľa `createDamImage` v U7), volaná tesne pred `createImage`/`updateImage` v oboch widgetoch jedného obrázka | `ImageWidgetInner.vue:566-568`, `ImageMediaWidgetInner.vue:695-697` | **bez účinku** (core-cms kľúče ignoruje, UGC ich zahadzuje) | kratšie telo; audit log CMS už neuvidí `authorIds`/`assetId` |
| A2 | To isté pre galériu pred `bulkUpdateImages` (na kópii, až po doplnení zdroja z autorov) | `ImageWidgetMultipleInner.vue:468` | **bez účinku** | ako A; logika autorov galérie (nález 32) číta sklad, nie telo, a nemení sa |
| B | Neprečítať obrázok, ktorý widget práve vytvoril. Jednorazová značka „práve uložené id", nastavená pred `modelValue = res.id`; sledovač pri tom istom id a nezmenenom `props.image` nečíta. Iné zmeny id (spolupráca, rodič) čítajú ako dnes | `ImageWidgetInner.vue:570,685-691`; `ImageMediaWidgetInner.vue:699,440-457` | **bez účinku** | o jeden `GET` menej, náhľad neblikne, žiadna chyba po úspešnom uložení |
| C | `mainFileSingleUse: null` → `false` na jednom mieste: `override ?? item.mainFileSingleUse ?? false` | `damAssetApi.ts:230` | **bez účinku** (DAM už dnes ukladá `false`) | dialóg fronty pošle `false` namiesto `null`, telo oboch dialógov je rovnaké |

Mapovanie, typ `UploadMetadataToImageMapItem` a udalosti `apply` oboch dialógov ostávajú. Galéria `authorIds`
a `assetId` z mapovania potrebuje (`UploadQueueDialog.vue:136-138`), typ je vyvezený a UGC ho vracia. Funkcia
z U7 (`createDamImage`) sa nemení.

**Zmena produktu (neodporúčam):**
- Vynechať kľúč pri `null` („v DAM nechať, ako je"). Uložené by sa líšilo len vtedy, keby niekto príznak medzitým zmenil
  v DAM, a to pri riadku, ktorý pri skutočnom DAM nenastane. Bez prínosu.
- Dialóg jedného súboru prepnúť z „hodnota prvého riadku pre všetky" na „každý riadok svoju". Rozdiel je len pri
  viacerých súboroch v dialógu jedného súboru (kap. 6). Tam by ostatné riadky prestali dostávať prepínač prvého.

**Testy, ktoré sa otočia:** A: `consumerProfileImageWidgetUpload.test.ts:330,358,444,463` (volania
`createImage`/`updateImage` bez `authorIds`, `assetId`; tvrdenia detailu `:303,353,495` ostávajú) a nový prípad, že telo galérie má len polia obrázka
(`consumerProfileImageWidgetMultipleUpload.test.ts:421-428` tvrdí len vybrané polia, neotočí sa). B:
`consumerProfileImageWidgetUpload.test.ts:328-336` (bez `fetchImage` a `GET`); `ImageWidgetInnerExpandMetadata.test.ts:68`
ostáva. C: `L/__tests__/damAssetApiBulkMetadata.test.ts:99-106` (prípad `null` → `false`).

## 5. Veľkosť a krok

A s A2 1,5 h, B 1 h, C 0,5 h, spolu asi **3 h** s jedným cyklom posudku. Plán (2.9, riadok „nález 36") počíta 2 h a ako
súbory uvádza „mapovanie a dialógy". Pri tomto odporúčaní sú to widgety (`ImageWidgetInner.vue`,
`ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`), `damAssetApi.ts` a pomôcka v súbore z U7. Krok preto
patrí **hneď po U7** (tie isté súbory, nikdy nie súčasne s U7 ani s nálezom 20), do LIB, s kópiou C3. admin-dam sa
netýka: widgety nepoužíva a `damAssetApi.ts` mení len knižnicu.

## 6. Vedľajšie postrehy

- **Nový nález (z kódu, nespustené):** widget jedného obrázka prijme pustenie viacerých súborov. `useDropZone` má
  predvolene `multiple: true` (`node_modules/@vueuse/core` 15.0.0, `dist/index.js:2960`), dropzóna pošle všetky
  (`common-admin/src/domains/ui/file/components/AFileDropzone.vue:46-50`) a widget ich všetky dá do fronty
  (`ImageWidgetInner.vue:314`). Dialóg jedného súboru ukáže len prvý riadok, uloží všetky s prepínačom prvého
  (`UploadQueueDialogSingle.vue:256,266-271`) a widget použije len prvý obrázok (`ImageWidgetInner.vue:611-616`). Ostatné assety v DAM ostanú bez obrázka v CMS.
- Výber assetu s uploadom (`AAssetListInner`) spustí v „uložiť a použiť" mapovanie aj s menami autorov, hoci výsledok
  zahodí. Je to jedna zbytočná požiadavka; nálezu 36 sa netýka.

## Pre vlastníka

1. Neposielať `authorIds` a `assetId` do API obrázkov CMS (jeden obrázok, médium). Nič uložené sa nemení, len telo
   požiadavky a audit log. **Odporúčam áno.**
2. To isté pre galériu (aj `key`, `damAuthors`, `showDamAuthors`). Uložené ani logika autorov sa nemení.
   **Odporúčam áno.**
3. Zrušiť druhé čítanie obrázka hneď po jeho vytvorení: o požiadavku menej, náhľad neblikne, nebude chyba po
   úspešnom uložení. **Odporúčam áno.**
4. `mainFileSingleUse`: oba dialógy pošlú `false` namiesto `null`. DAM už dnes ukladá `false`. **Odporúčam áno.**
5. Potvrď, že `null` nemá znamenať „v DAM nechať, ako je" (vynechať kľúč). Je to zmena produktu bez prínosu.
   **Odporúčam nie.**
6. Nový nález do denníka: viac súborov pustených na widget jedného obrázka sa všetky nahrá, prepínač prvého sa zapíše
   všetkým, použije sa len prvý. **Odporúčam zapísať, riešiť samostatne.**
7. Body 1 až 4 spolu asi 3 h (plán 2 h): krok „nález 36" hneď po U7 v LIB, kópia C3, admin-dam bez zmeny.
   **Potvrdiť zaradenie.**
