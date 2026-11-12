# PV14c-L1: obchod konfigurácie DAM podľa mena konfigurácie; impl-lib-op12

Zadanie `krok5-praca/zadania/zadanie-PV14c-L1.md`, plán `plan-PV14c.md`. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (vetva `next`, základ `f7ff8a2c`). Snímok **`PV14c-L1`** (s
`doc/changelog/2.0.0.md` a `doc/guide/installation.md`), záplata `krok5-praca/zaplaty/PV14c-L1.diff` (51 súborov,
2 023 riadkov). Všetkých 6 bodov hotových, žiadny nezastavený.

Čo vidí redaktor admin-cms, admin-ugc a admin-dam: **nič** (každý má len `default`). Ďalej „pod `own`" = komponent
pod pomenovanou konfiguráciou.

## Body

**1. Obchod podľa mena** (`config/store/damConfigStore.ts`). Funkcia nastavenia je spoločná; `useDamConfigStore` ostáva
obchod `default` s id `commonAdminDamConfigStore`. Nové `useDamConfigStoreOf(configName = 'default', pinia?)`: pre
`default` ten istý obchod, pre iné meno definícia urobená raz na meno, id `commonAdminDamConfigStore:<meno>` (stráž id
v `storeIds.test.ts` ho vidí). Exportované z `lib.ts` (typ `DamConfigStore` od c1).
- **HMR:** `default` ako doteraz (`acceptHMRUpdate`); kým existuje pomenovaný obchod, horúca zmena súboru **načíta
  stránku znova** (`window.location.reload()`): definícia pomenovaného obchodu sa robí za behu a nie je exportovaná,
  nový modul by jeho obchodu nové nastavenie odovzdať nevedel. Len vývoj, bez prípadu. (Po kroku platilo len do prvej
  prijatej zmeny; c1 to opravil, pozri časť c1.)
- *Editor vidí:* nič.

**2. `useDamConfigState(client?, configName?)`** číta a plní obchod mena; meno vynechané = zdedené v setupe komponentu,
inak `default` (pomocník `inheritedDamConfigName` v `composables/damConfigName.ts`, `hasInjectionContext()` +
`DamConfigNameKey`; L2 ho použije). Bez klienta sa nič nenačíta; adresy ostávajú pevné (kľúče sú L5).

**3. Každé čítanie a načítanie knižnice pod svojím menom.** Komponenty s `configName` berú meno z
`useDamConfigName(props.configName)`, ostatné z `useDamConfigName()`; kompozičné funkcie ho dostanú ako parameter. Miesta:
koreňové widgety (`AImageWidget`, `AImageWidgetMultiple`, `AImageMediaWidget` aj ich priame čítanie obchodu), filter
distribučných služieb, `AAssetSelect`, `AAssetSelectMedia`, `AAssetListInner`, tri vnútorné widgety (vrátane
`getExtSystemByLicence`), `imageDialogDamAuthors`, `useImageMassOperations` (`configName ?? 'default'`, ako jeho
voľby), `ImageMassOperations`, `keywordActions`/`authorActions` (`configName ?? 'default'`), vstup kľúčových slov,
tlačidlo autora, `useDamKeywordAssetTypeConfig`/`useDamAuthorAssetTypeConfig(assetType, extSystem, configName?)` a ich
volajúci (`AssetMetadata`, riadok fronty), vlastné formuláre (`AssetCustomMetadataForm`,
`AssetCustomMetadataFormMassOperations`), `showMetadataSaveError(error, extSystem, configName = 'default')` a jeho šesť
volajúcich, bočný panel hromadných operácií, výrez ROI, `addByFiles`/`addByCopyToLicence` obchodu fronty (najprv
kontrola mena volieb, potom obchod: neznáme meno si obchod nevyrobí), ikony meta, `useDamDistributionServiceType(configName?)`,
interné `useDamExternalProviderAssetType(configName?)`.
- *Editor vidí:* pod `own` widget, výber, detail aj fronta načítajú a čítajú konfiguráciu DAM svojho mena jeho klientom;
  ak ju ten klient prečítať nevie, ukážu doterajší chybový stav, pokiaľ aplikácia vopred nenaplní
  `useDamConfigStoreOf(meno)` (žiadny nový text ani UI).

**4. Veľkosť kúska podľa mena** (`damUploadChunkSize.ts`). `useDamUploadChunkSize(apiTimeout?, configName?)`: hranice z
obchodu mena, posledná veľkosť v mape podľa mena (namiesto jedného `ref` modulu). Interné členy predvoľby majú
`configName` (`libraryUploadPreset` svoje meno alebo `default`, `adminDamUploadPreset` `default`), `useUpload` ho podá.
- *Editor vidí:* nič; pod `own` kúsky podľa nastavení `own`.

**5. Nepovinný `configName`** (zdedený, keď chýba) na `ADamAssetCustomMetadataForm`, `ADamUploadQueueItem`,
`ADamUploadQueueMassOperations`, `ADamAssetImageMetaIcons` (obchod si teraz berie v setupe, nie v `computed`),
`ADamDistributionServiceSelect`, `ADamExternalProviderAssetSelect` (ich `client` ostáva). `AssetCustomMetadataFormMassOperations`
dedí.

**6. Verejné kompozičné funkcie** `useDamConfigState`, `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig`,
`useDamDistributionServiceType`, `useDamUploadChunkSize`: meno vynechané = zdedené v setupe, inak `default`.

## Changelog a príručka

`2.0.0.md`: Exports + `useDamConfigStoreOf`; v položke pomenovaných konfigurácií (Added) veta o obchode podľa mena,
načítaní klientom mena a predvyplnení, nepovinné parametre a props. Vety o cache mien a notifikáciách nechané (ďalšie
kroky). `installation.md`: jedna veta.

## Prípady a ohyby

- Nové: `damNamedConfigurationStore.test.ts` (15) a `damNamedConfigurationStoreComponents.test.ts` (12, šesť komponentov
  × dané meno / vnútri komponentu pod `own`), `publicExportsAdded` +1. Pomocník `__tests__/support/namedDamConfig.ts`
  (`seedDamConfigOf`, `fillDamConfigOf`, `answerDamConfig`). Oba DAM majú ext systém 4 a licenciu 300003, každý s
  vlastným formulárom, prepínačom kľúčových slov, distribúciou, poskytovateľom a kúskami; `own` sa plní prvý.
- Na snímku (staré zdroje kroku, nový export nahradený jedným obchodom pre všetky mená, `pv1-pred-shim.json`): **27 z 27
  červených**, všetko pre správanie (iný formulár, druhý klient sa nepýta, jeden obchod a pod.).
- Ohyby: b1 `useDamConfigStoreOf` dá každému menu obchod `default` → 27 červených; b2 `AImageWidget` načíta do obchodu
  `default` → 2 červené (jeho prípady načítania pod `own`).
- Upravené staré prípady (zámerne: pomenovaná konfigurácia číta svoj obchod): `damNamedConfigurationComponents`,
  `uploadNamedConfiguration`, `damAuthorKeywordEndpoints` naplnia obchod `own` ako `default` (`seedDamConfigOf`);
  prípad výberu assetov maže licenciu z obchodu `own`.

## Kontroly

Formát a linty čisté. Celá kontrola: `testy` 378 súborov, 5 317 testov zelené, bez opakovaní (beh po poslednej zmene);
`linty` zelené (prvý beh `lint:tsc` spadol na type parametra HMR, opravené na `unknown`).

## Mimo kroku (len poznámka)

- `useDamConfigStoreOf` urobí obchod pre ľubovoľné meno, aj také, ktoré v `coreDam.configs` nie je (preklep) — neškodí,
  len prázdny obchod.
- Posledná veľkosť kúska sa pri ďalšom uploade neorezáva na nové hranice, kým ju neprepočíta rýchlosť (tak aj pred
  krokom, len pre celý modul).
- `playground/cropperView/RoiEditorView.vue` číta obchod `default` (playground, nemenené).

## c1

Zadanie `zadanie-PV14c-L1-c1.md`; posudky `posudky/PV14c-L1-claude.md` (stredný 1, nízke 2 až 6, mimo) a
`PV14c-L1-codex.md` (súhlasí; L1 vydať spolu s L2). Bez nového snímku.

**1. Prípady, ktoré vedia zlyhať.** Dva testovacie DAM majú iné pravidlá aj pre autorov (`DamConfigOfDam.authors`;
`own` bez autorov a kľúčových slov, iný formulár, iné hranice kúskov). Nové alebo zosilnené:
- verejné kompozičné funkcie: všetkých päť, aj `useDamUploadChunkSize()` bez mena v setupe (rastie po hranicu
  obchodu mena: `own` 8 000, inak 52 428 800);
- koreňový `AImageMediaWidget` (tri prípady ako ostatné dva korene);
- formulár hromadných operácií fronty (pole `own`), riadok fronty a detail bez autorov;
- odmietnuté uloženie cez detail (`AssetDetailSidebarMetadata` pod `own`, 422 od klienta `own`) × oba spôsoby;
- ikony a detail overujú, že sa druhý klient nepýtal nič;
- tri staršie súbory: smerovanie klientov ostáva, obchody sa líšia: `uploadNamedConfiguration` a
  `damNamedConfigurationComponents` majú v obchode `own` kúsky po 1 500 B (fotka 3 000 B ide pod `own` v dvoch kúskoch,
  pod `default` v jednom; `sendingUnderOwn` a výrezy podľa jeho dĺžky), `damAuthorKeywordEndpoints` má v obchode `own`
  licenciu pod ext systémom 7 (mená autorov pod `own` sa hľadajú pod 7).
- Ohyby (každé jedno miesto číta `default`): autorské pravidlá → 6 červených; veľkosť kúska bez dedenia → 1;
  `AImageMediaWidget` → 2; formulár hromadných operácií → 2; uloženie detailu bez mena → 2; `useUpload` s `default`
  → 17 (staršie súbory); ext systém mien autorov vo vnútornom widgete (`ImageWidgetInner` číta licenciu z obchodu
  `default`) → 1. Ohyb na
  `imageDialogDamAuthors` ostal zelený: túto cestu (dialóg obrázka) prípady pod menom neprechádzajú (pozri mimo).

**2. Výnimka pri ext systéme stránky (nízky 2).** Kód nemenený, ako navrhuje Codex: L2 dá ext systém cache mena.
**L1 sa nesmie vydať bez L2.** Prípad pre L2: widget `default` zapíše ext systém stránky posledný (1), potom detail aj
dialóg obrázka pod `own` (iný DAM, ext systém 4) sa otvoria bez výnimky „Ext system must be initialised." a s
pravidlami `own`.

**3. HMR (nízky 3).** Mapa pomenovaných definícií aj posledné nastavenie obchodu sa držia v `import.meta.hot.data`
naprieč verziami modulu: pravidlo „kým existuje pomenovaný obchod, načítaj stránku znova" platí aj po prijatej zmene
(obchod urobený importérom prvej verzie je v tej istej mape), a pomenovaný obchod urobený po prijatej zmene dostane
nastavenie najnovšej verzie. Len vývoj, bez prípadu.

**4. Nízky 4.** `UploadQueueDialogSingleSidebarMetadataContent.vue` číta pravidlá kľúčových slov a autorov podľa svojho
`damConfigName`, nie dedením. Prípad: formulár daný `own` bez rodiča pod menom nemá kľúčové slová ani autorov (ohyb →
červený). JSDoc `inheritedDamConfigName` a changelog: vlastný `configName` komponentu sa pri dedení nevidí, komponent
ho podá.

**5. Dokumenty a typy (nízke 5, 6).** Changelog: hranice kúskov sú v obchode, posledná veľkosť v mape podľa mena vedľa
neho; `DamConfigStore` exportovaný z `lib.ts` (Exports), jeho `$id` je `string` (`Omit<…, '$id'> & { readonly $id:
string }`). Veta o HMR v bode 1 doplnená.

**6. Neznáme meno vo filtri distribúcie.** `AssetDistributionServiceNameFilter.vue` najprv overí meno vo voľbách, až
potom vezme obchod: neznáme meno vyhodí chybu a obchod si nevyrobí. Prípad (ohyb s pôvodným poradím → červený).

*Editor vidí:* nič nové (admin-cms, admin-ugc, admin-dam majú len `default`).

**Kontroly c1.** Formát a linty čisté. Celá kontrola: `testy` 378 súborov, 5 324 testov zelené, bez opakovaní; `linty`
zelené. Záplata kroku s cyklom: 52 súborov, 2 319 riadkov.

**Mimo (len poznámka).** Cesta `imageDialogDamAuthors` (mená autorov v dialógu obrázka pod menom) nemá prípad, ktorý by
odlíšil obchod; prirodzene ju pokryje L2 (ext systém cache mena). Šesť komponentov s `configName` nekontroluje
meno: preklep v mene dá prázdny obchod (ticho bez ikon a možností, alebo „Custom form elements must be initialised.").
Obchod bez načítaných hraníc kúskov (0..0) by poslal prázdne kúsky — cez korene nedosiahnuteľné (načítajú prv
konfiguráciu pred `ready`), dosiahnuteľné aplikáciou, ktorá naplní ext systém mena a hranice nie (posudok, mimo).
