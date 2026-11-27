# Nález 32: `authors: []` pri uložení galérie (analýza, 9. 10. 2026)

Skratky ciest:
- `L/` = `/home/volar/projects/anzusystems/common-admin/src/domains/dam/`
- `CMS/` = `/home/volar/projects/petit/admin-cms/src/`
- `UGC/` = `/home/volar/projects/petit/admin-ugc/src/`
- `CD/` = `/home/volar/projects/petit/core-dam/`
- `BND/` = `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src/` (verzia 1.52.0 podľa
  `CD/composer.lock`)
- `CB/` = `/home/volar/projects/petit/core-dam/vendor/anzusystems/common-bundle/src/`

Všetko je overené čítaním kódu, nič som nespúšťal proti serveru. Čo je len odvodené, je označené **(odvodené)**.

## 1. Zhrnutie

Nález platí a je potvrdený aj na strane servera: prázdny zoznam autorov **zmaže** autorov assetu v DAM. Pri prvom
uložení galérie v admin-cms (po otvorení stránky alebo dialógu) knižnica pošle `PATCH /adm/v1/asset/metadata-bulk-update`
s `{id, authors: []}` za každý obrázok, ktorého asset pri načítaní (alebo pri výbere či nahratí) nemal autora a
používateľ v riadku autora nevybral. Ak medzitým niekto assetu autora pridal, uloženie galérie ho zmaže, potichu.
Najpravdepodobnejšia cesta k tomu je v tom istom widgete: tlačidlo „Upraviť asset" pri obrázku galérie otvorí detail
assetu, používateľ tam doplní autora a uloží, potom uloží galériu, a autor zmizne. Na to netreba druhého človeka.
admin-ugc to nemá. Oprava je jedna podmienka, nemení nič viditeľné v CMS a do kroku 5 nepatrí.

## 2. Cesta v knižnici a v admin-cms

**Kto volá.** Galériu upravuje `CMS/domains/cms/gallery/components/GalleryEdit.vue:107-115` (`AImageWidgetMultiple`).
Ten istý komponent sa otvára na stránke `CMS/pages/(cms)/galleries/[id]/edit.vue:101` aj v dialógu galérie vloženej
v článku (`CMS/domains/cms/gallery/components/EmbedGalleryEditDialog.vue:9,46-48`). Uloženie galérie najprv volá
`saveImages()` widgetu a až potom ukladá galériu (`CMS/domains/cms/gallery/composables/galleryActions.ts:161`).
admin-cms nemení `endPointAsset` (`CMS/main.ts:57-63`), platí predvolené `/adm/v1/asset`
(`L/composables/commonAdminCoreDamOptions.ts:50`).

**Odkiaľ sa berie prázdny zoznam.** Riadok galérie má tri polia: `damAuthors`, `showDamAuthors`, `assetId`.
- Načítanie galérie: `damAuthors` = autori assetu, `showDamAuthors` = asset nemá autora
  (`L/imageWidget/components/ImageWidgetMultipleInner.vue:164-170`).
- Výber z DAM: to isté podľa práve načítaného detailu (`ImageWidgetMultipleInner.vue:290, 344-346`). Keď čítanie detailu
  zlyhá, chyba sa ukáže, ale obrázky sa pridajú aj tak, každý s `authorIds = []` a `showDamAuthors = true`
  (`:284-286, 290`), aj keď ich asset autorov má.
- Nahratie cez frontu: autori z odpovede uloženia fronty (`L/uploadQueue/components/UploadQueueDialog.vue:136-137`).

`showDamAuthors` riadi, že riadok namiesto textu zdroja ponúkne výber autorov DAM
(`L/imageWidget/components/ImageWidgetMultipleItem.vue:107-127`), keď ext systém autorov má (`authorEnabled`,
`ImageWidgetMultipleInner.vue:428-430`; ext systém je ten z licencie nahrávania, `AImageWidgetMultiple.vue:73`).
Pre obrázky CMS je to zapnuté: `CD/config/packages/anzu_systems_core_dam_ext_systems.php:52-54`.

**Čo sa pošle.** `saveImages` (`ImageWidgetMultipleInner.vue:447-452`):
```ts
if (authorEnabled.value && image.showDamAuthors && image.assetId) {
  assetUpdateItems.push({ id: image.assetId, authors: image.damAuthors })
}
```
Podmienka sa nepozerá na to, či používateľ niečo vybral. Nasledujúca podmienka (`:453`) pre text zdroja už
`damAuthors.length > 0` má, táto nie. Zoznam ide v dávkach po 10 cez `bulkUpdateAssetsAuthors`
(`L/api/damAssetApi.ts:354-366, 368-392`) ako `PATCH <endPointAsset>/metadata-bulk-update`, telo je
`[{ "id": "...", "authors": [] }, …]`, iné polia v ňom nie sú. Volá sa **pred** uložením obrázkov
(`ImageWidgetMultipleInner.vue:465-468`); jeho odpoveď sa nepoužíva.

**Prečo to tak je.** Zaviedol to commit `71557546` (13. 12. 2024, „store image widget multiple asset authors"), vtedy
ešte s ID súboru namiesto ID assetu; ID assetu doplnil `ff3f2e02` (20. 12. 2024). Podmienku `authorEnabled` pridal
`e5cc06f4` (15. 4. 2026); predtým sa posielalo aj bez nej. Zámer bol „ulož autorov vybraných v riadku". Prázdny
zoznam podľa všetkého nikto nechcel posielať; je to vedľajší produkt toho, že sa posiela každý riadok s ponukou
**(odvodené)**. Je to vo vydaniach 1.47.0-beta.354, 1.48.0 aj 1.49.0 (`git show 1.49.0:…ImageWidgetMultipleInner.vue:443-444`),
aj v builde, ktorý má admin-cms dnes v `node_modules` (`…/dist/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue_vue_type_script_setup_true_lang.js:255`).
admin-cms prešlo na verziu beta.114 23. 12. 2024 (história `package.json`), teda je to v admin-cms asi od konca
decembra 2024 **(odvodené z dátumov, verziu na npm som neoveroval)**. Vetva `main` knižnice to nemá (`71557546` v nej nie je).

**admin-ugc nie.** Jeho obal dáva ext systému konfiguráciu obrázka bez `authors`
(`UGC/domains/blog/image/components/ImageWidgetMultiple.vue:46-58, 118`), takže `authorEnabled` je `false`. Pripína
to aj test (`L/imageWidget/__tests__/consumerProfileImageWidgetMultipleUpload.test.ts:490-499`).

## 3. Čo s tým urobí core-dam

- Cesta: `BND/Controller/Api/Adm/V1/AssetController.php:196-210` → `AssetMetadataBulkFacade::bulkUpdate`.
- DTO má len `asset` nastavený v konštruktore (`BND/Model/Dto/Asset/FormProvidableMetadataBulkUpdateDto.php:52-55`);
  pole, ktoré v tele chýba, ostane neinicializované a platí ako „nezadané" (`:176-179` pre autorov, podobne ostatné).
  `[]` je zadané: `EntityIdHandler` z prázdneho poľa urobí prázdnu kolekciu
  (`CD/vendor/anzusystems/serializer-bundle/src/Handler/Handlers/EntityIdHandler.php:94-99`).
- `updateAuthors` pri zadaných autoroch volá `colUpdate` (`BND/Domain/Asset/AssetMetadataBulkManager.php:55-66`), ktoré
  zo starej kolekcie odstráni všetko, čo v novej nie je (`CB/Domain/AbstractManager.php:119-123`). **Prázdny zoznam
  teda autorov zmaže.**
- Validácia povinných autorov sa nespustí, lebo telo nemá `described` (`BND/Validator/Constraints/AssetValidator.php:27-29`).
  Aj pri `required: true` by sa teda zmazanie prijalo.
- Kľúčové slová, custom data, `described`, príznaky súboru: v tele nie sú, server ich preskočí (`AssetMetadataBulkManager.php:45-47, 120-127`
  a ďalšie `…Undefined`). Zmazať sa dajú len autori.
- Vedľajšie účinky **každého** takého PATCH, aj keď sa nič nezmení (`[]` na asset bez autora):
  `modifiedAt` a `modifiedBy` assetu sa nastavia na teraz a na používateľa CMS (`AssetManager::updateExisting`,
  `BND/Domain/Asset/AssetManager.php:43-52`; `CB/Domain/AbstractManager.php:90-97`), asset sa preindexuje
  (`AssetMetadataBulkFacade.php:75-77`) a znova sa vyhodnotia pravidlá „interný" (`AssetMetadataBulkManager.php:38`).
- Ak autor skutočne zmizne: odíde udalosť o zmene assetu (`AssetMetadataBulkFacade.php:58-60, 82-89`), DAM pošle CMS
  nové príznaky obrázka (`internal`, `singleUse`; `CD/src/Domain/ExtSystem/AbstractExtSystemCallback.php:84-94`). Keď má
  licencia pravidlo „interný" podľa autorov, asset bez autora pravidlu nevyhovie a súbor môže prestať byť interný
  (`BND/Domain/AssetFile/AssetFileInternalRuleEvaluator.php:51-70`) **(odvodené; či niektorá licencia také pravidlo má,
  je v dátach, nevidel som ich)**.
- Na zápis treba právo `dam_asset_update` na asset a jeho licenciu (`AssetMetadataBulkFacade.php:101-108`,
  `BND/Security/Voter/AssetLicenceAwareVoter.php`). Používateľ bez neho dnes **neuloží galériu vôbec**, len čo je v nej
  asset bez autora: PATCH skončí 403 a `saveImages` ukáže „neznámu chybu" (`ImageWidgetMultipleInner.vue:506-509`)
  **(odvodené; či takí používatelia CMS sú, závisí od rolí)**.

## 4. Iné polia a iné miesta

- Galéria zapisuje do DAM len autorov. Popis a zdroj sú texty obrázka CMS, do DAM nejdú.
- Jednoobrázkové widgety (`L/imageWidget/components/ImageWidgetInner.vue:548-564`,
  `ImageMediaWidgetInner.vue:677-693`) zapíšu autorov **len keď nejakých majú** (`authors.length > 0`). Galéria je
  jediné miesto, kde sa posiela nedotknutý prázdny zoznam. (Vedľajšia poznámka: tieto widgety posielajú aj
  `described: true`; to je iná téma, dátam nič neberie.)
- Fronta uploadu (`L/api/damAssetApi.ts:217-236`) a detail assetu (`:266-281`) posielajú celý stav (autori, kľúčové
  slová, custom data). To je výslovné uloženie toho istého assetu, ktorý používateľ upravuje (fronta navyše čerstvo
  nahratého), teda bežné „posledný vyhráva", nie tento nález.

## 5. Reálny scenár

Musí platiť všetko:
1. admin-cms, galéria (stránka alebo dialóg v článku);
2. asset obrázka nemal autora, keď ho widget načítal (alebo keď ho používateľ vybral či nahral);
3. kým je galéria otvorená, niekto assetu autora pridá;
4. používateľ v tom riadku galérie autora nevyberie (ak vyberie, jeho voľba nahradí tú z DAM, čo je výslovný zásah);
5. je to prvé uloženie galérie odvtedy, čo sa widget otvoril (pozri časť 6).

Kde môže vzniknúť bod 3:
- **Ten istý používateľ cez „Upraviť asset" v riadku galérie.** Tlačidlo otvorí detail assetu
  (`ImageWidgetMultipleItem.vue:54-57`, `ImageWidgetMultipleInner.vue:387-402, 726-731`), jeho uloženie zapíše
  autorov do DAM (`L/assetDetail/components/AssetDetailSidebarMetadata.vue:58`), ale riadok galérie sa neobnoví:
  ostane v ňom `damAuthors = []` a prázdny výber autorov. Ďalšie uloženie galérie autora zmaže. Je to spoľahlivo
  opakovateľné a nepotrebuje súbeh.
- Iný redaktor v admin-dam alebo v jednoobrázkovom widgete v článku (ten zapíše autora presne assetu, ktorý žiadneho
  nemá, teda tomu istému druhu assetov).
- Bez súbehu: výber z DAM, pri ktorom čítanie detailu zlyhá (`ImageWidgetMultipleInner.vue:284-286`). Obrázok potom
  ponúkne autorov, aj keď ich asset má, a uloženie ich zmaže. Podobne, ak výber obsahuje assety inej licencie, než je
  práve zvolená (detail sa číta pre jednu licenciu, `:248`; `BND/Controller/Api/Adm/V1/AssetController.php:139-149`
  vracia len assety tej licencie). **(odvodené; či výber pri prepnutí licencie ostáva, som neoveril.)**

**Pravdepodobnosť:** pri súbehu dvoch ľudí nízka; pri ceste cez „Upraviť asset" reálna, lebo tlačidlo je priamo pri
prázdnom poli autorov. Koľko obrázkov v galériách nemá autora, neviem: DAM pri nahratí dopĺňa autorov z EXIF
(`anzu_systems_core_dam_ext_systems.php:55-59`), bez autora sú skôr snímky obrazovky, PR fotky a podobne.

**Čo sa stratí:** väzba asset → autor v DAM. Autor sám ostáva (len sa odpojí). Text zdroja obrázka v CMS ostáva, ako
bol; článok ani galéria na webe sa nezmenia. Stratí sa: hľadanie podľa autora v DAM, predvyplnený zdroj pri ďalšom
použití assetu (oba widgety berú zdroj z autorov DAM), prípadne príznak „interný" (časť 3).

**Vratnosť:** áno, ak sa vie, ktoré assety to boli. Audit log DAM ukladá telo aj odpoveď každého PATCH
(`CD/config/packages/anzu_systems_common.php:107-116`, `CB/Log/Factory/LogContextFactory.php:79-81`) aj s ID assetu.
Telo galérie má jednoznačný podpis: položky len s `id` a `authors`, bez `described` (iné miesta posielajú aj
`described`). Dotaz do auditu by našiel všetky také zápisy a z predchádzajúcich záznamov toho assetu by sa dali
zistiť zmazaní autori. Ako dlho audit drží záznamy, neviem.

## 6. Súvisiaca chyba v tom istom mieste (nová, „32b")

Po uložení galérie dostanú všetky riadky `assetId: undefined`: nové položky ho nastavia na `undefined`
(`ImageWidgetMultipleInner.vue:470-479`) a `getUpdatedItem` ho preberie z nich, nie zo starého riadka (`:488-496`).
Rovnako je to v builde admin-cms (`…ImageWidgetMultipleInner.vue_vue_type_script_setup_true_lang.js:269, 278`).
Dôsledky, kým sa widget znova nenačíta:
- ďalšie uloženia už do DAM nič nepošlú (preto platí bod 5 v časti 5: maže len prvé uloženie);
- **autor vybraný v riadku po prvom uložení sa do DAM nezapíše**, dostane sa len do textu zdroja obrázka CMS
  (`:453-461` nepotrebuje `assetId`). Pri ďalšom otvorení galérie riadok ponúkne autorov znova, prázdnych.

Oprava je jeden riadok (`assetId: matchedImage ? matchedImage.assetId : item.assetId`). Mení to, čo sa uloží (autor
vybraný po prvom uložení pôjde do DAM), preto to dávam na rozhodnutie zvlášť.

## 7. Oprava

**Odporúčaná (b): neposielať riadok bez vybraného autora.** V `ImageWidgetMultipleInner.vue:450` pridať
`&& image.damAuthors.length > 0`, presne ako to robia jednoobrázkové widgety.

Prečo nie iné:
- (a) posielať len zmenené riadky (porovnanie s načítaným stavom): vo všetkých dosiahnuteľných prípadoch dá to isté
  ako (b), lebo riadok s autormi výber nikdy neponúkne (`showDamAuthors` je `false`), teda autorov cez galériu
  vymazať nejde ani dnes. Je to viac kódu bez úžitku.
- (c) pred uložením znova načítať assety: pridá čítanie pri každom uložení a stále má okno súbehu. Rieši len to, že
  výslovná voľba v riadku prepíše autora pridaného inde, čo je bežné „posledný vyhráva".
- (d) obnoviť riadok po uložení detailu assetu (riadok by ukázal mená ako zdroj): zmena toho, čo používateľ vidí;
  na opravu straty dát netreba.

**Čo sa zmení:**
- V CMS nič viditeľné. Galéria sa uloží rovnako; autori vybraní v riadku sa do DAM zapíšu ako dnes
  (test `consumerProfileImageWidgetMultipleUpload.test.ts:453-476` ostáva zelený).
- Do DAM sa už nepošle PATCH za riadky bez vybraného autora. V DAM sa týmto assetom pri uložení galérie prestane meniť
  `modifiedAt`/`modifiedBy` a nebudú sa preindexovať. Autor pridaný medzitým ostane.
- Používateľ bez práva upravovať asset uloží galériu, kým v riadku autora nevyberie **(odvodené, časť 3)**.
- Podľa pravidla vlastníka je to zmena toho, čo sa posiela backendu, preto to potrebuje jeho súhlas, hoci výsledok v
  dátach je pri bežnom postupe rovnaký.

**Testy (LIB):**
1. Otočiť pripnutý prípad `consumerProfileImageWidgetMultipleUpload.test.ts:434-447`: bez vybraného autora žiadny
   PATCH na `metadata-bulk-update` (pre oba profily `[]`).
2. Nový prípad: obrázok s assetom bez autora, „Upraviť asset" uloží autora (falošný DAM si ho pamätá), uloženie
   galérie nepošle `authors: []` a autor v DAM ostane. Na pôvodnom kóde musí padnúť.
3. Nový prípad: výber z DAM, čítanie detailu zlyhá, uloženie galérie autorov nezapíše.
4. Ak sa schváli aj 32b: po prvom uložení vybrať autora v riadku, druhé uloženie ho pošle s ID assetu.

**Veľkosť:** (b) jeden riadok + testy 1 až 3: asi 2 h vrátane brány. 32b: +1 riadok, +1 test, asi 0,5 h. admin-dam
widget galérie nepoužíva, časť v DAM nie je; kópia knižnice do admin-dam pre to netreba, ale nezaškodí.

**Zaradenie:** do kroku 5 nepatrí (zjednotenie uploadu `saveImages` nemení). Rovnaký súbor však mení U7 a nález 20,
teda nikdy súčasne s nimi (plán 2.9, `plan-implementacie.md:768`, U7 `:565-571`). Navrhujem samostatný malý krok
v 2.9 „bez závislosti", spraviť ho hneď, pred kódovaním kroku 5, a vydať ho s najbližším vydaním knižnice. Chyba je
v produkcii asi 10 mesiacov, nie je to nová regresia; ak by 2.0.0 nemalo ísť do admin-cms v najbližších týždňoch,
zvážiť opravu aj v línii 1.49.x.

## 8. Čo som neoveril

- Správanie proti bežiacemu DAM (len kód; reťaz DTO → manager → `colUpdate` je jednoznačná).
- Či v produkcii sa to už stalo a koľkokrát (dá sa zistiť z audit logu, pozri časť 5).
- Či niektorá licencia CMS má pravidlo „interný" podľa autorov.
- Či používatelia CMS bez `dam_asset_update` existujú.
- Či výber v DAM ostáva pri prepnutí licencie (cesta „iná licencia" v časti 5).
- Ktorá presne beta na npm ako prvá obsahovala `ff3f2e02`.

## Pre vlastníka

1. Nález 32 potvrdzujem aj na strane DAM: `authors: []` autorov zmaže, validácia ho nezastaví. Najľahšie to nastane
   tak, že používateľ pri obrázku galérie klikne „Upraviť asset", doplní autora a potom uloží galériu. Súhlasíš s
   opravou (b), teda posielať autorov len z riadku, kde nejakých vybral? **Odporúčam áno.** Asi 2 h.
2. Spraviť to ako samostatný malý krok hneď, pred kódovaním kroku 5 (nie súčasne s U7 a nálezom 20)? **Odporúčam áno.**
3. Nová chyba 32b: po prvom uložení galérie sa autor vybraný v riadku do DAM už nezapíše. Opraviť spolu s 1?
   **Odporúčam áno.** +0,5 h.
4. Dať niekomu s prístupom k audit logu DAM pozrieť, či sa to už stalo (zápisy len s `id` a `authors: []`), a
   prípadne autorov vrátiť? **Odporúčam áno**, je to jeden dotaz; mimo kódu.
5. Opravu aj do línie 1.49.x, ak 2.0.0 nepôjde do admin-cms čoskoro? **Odporúčam len vtedy**; inak stačí 2.0.0.
