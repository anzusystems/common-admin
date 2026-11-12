# Návrh kroku 5, časti 4 a 5: komponenty uploadu a upratanie „falošného" formulára (2026-10-08) — verzia 5.2 (rozhodnutia vlastníka z 9. 10.; cykly posudkov návrhu uzavrela verzia 4.1)

## Verzia 5.2 oproti verzii 5.1

Denník: „Texty a posledné nálezy, rozhodnutia vlastníka (9. 10.)" a „Kópia do licencie (9. 10.)".

| Vec | Verzia 5.1 | Verzia 5.2 |
|---|---|---|
| Kópia do licencie (2.12, 3, 4.5) | — | nový kľúč konfigurácie DAM `copyToLicenceEnabled` (predvolene zapnutý, za pomenovanú konfiguráciu od PV14b): pri vypnutom `showCopyToLicence` oboch výberov prepínač neukáže a tri widgety kópiu nepošlú nikdy; krok spolu s nálezom 20; admin-ugc ho vypne (odovzdá sa tímu admin-ugc), admin-cms ho nepodá |
| Texty (6.2, 4.5) | nález 47 a CS „Zastavit" (43) ako návrh | schválené znenia vlastníka: nález 47 SK, EN, CS; nález 43 CS „Zastavit" |

## Verzia 5.1 oproti verzii 5

Vlastník 9. 10. schválil nálezy 45 a 47 a knižničnú polovicu nálezu 49 (denník, „Nález 49 overený (9. 10.)";
`krok5/analyzy/nalez49-frontend.md`, 7.2, F-C a F-D).

| Vec | Verzia 5 | Verzia 5.1 |
|---|---|---|
| Nález 49, knižnica (4.5) | — | **F-C** po U6: detail knižnice vypne „Uložiť", keď asset nie je popísaný a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored` (podľa čítania); pri tlačidle veta z existujúceho kľúča. **F-D** po U6 a U7, len s F-C: widget takému assetu neponúkne autorov DAM, takže `updateAssetAuthors` nepošle `described: true` |
| Nález 45 (4.5) | nerozhodnutý (N1) | po U7: widget s médiom použije `customAssetSelectMetadataToImageMap` ako widget obrázka |
| Nález 47 (4.5) | nerozhodnutý | po U6 a náleze 25 (a po U7, ak ešte nebol): widget s jedným obrázkom z pustených súborov vezme prvý a upozorní |
| Texty (6.2) | — | F-C: **existujúci** kľúč `common.damImage.queueItem.stillUploadingOrProcessing`, nový text netreba; nález 47: **nový** kľúč s upozornením (návrh textu v sk, en, cs) |
| 5.1, 5.2, 0.1, IM11 | 45 a 47 nerozhodnuté | rozhodnuté; nález 49 v „na vedomie" (F-A, F-B a nález 50 sú admin-dam, mimo tohto návrhu); 0.1 (d) doplnené |

## Verzia 5 oproti verzii 4.3

Zapracúva rozhodnutia vlastníka z 9. 10. (denník `upload-postup.md`: „V0, rozhodnutia vlastníka", dávky 1 a 2;
„Otvorené témy, rozhodnutia vlastníka"; „Rozhodnutia vlastníka k analýzam") a analýzy v `krok5/analyzy/`
(`pv14-pomenovane-konfiguracie.md`, `ostatne-otvorene-nalezy.md`, `nalez36-co-ide-do-api-obrazkov.md`). Kroky U0
až U9 sa nemenia: žiadna oprava nejde *do* kroku U, ktorý ten kód prepisuje, ale ako malý samostatný krok hneď *po*
ňom (4.5); jediná výnimka je nález 24 (riadok ihriska, nič nemení) v U1, ako ho vlastník zaradil.

| Vec | Verzia 4.3 | Verzia 5 |
|---|---|---|
| Témy „pre vlastníka" (5.2) | PV15, nález 25, nález 36, PK3 otvorené | **rozhodnuté**: PV15 je želaný stav (nič sa nemení); nález 25 opraviť (dialóg jedného súboru dostane pravidlo „Obnoviť" riadku); nález 36 opraviť (do API obrázkov len polia obrázka, bez druhého čítania po vytvorení, `false` namiesto `null`); PK3 (nález 46) opraviť |
| Verdikty a počty (0.2) | HO10, JS21, IM10 „pre vlastníka"; 42 rovnakých, 11 rozhodnutých, 3 pre vlastníka | HO10 **rovnaké** (PV15 želaný stav), JS21 a IM10 **rozhodnuté** (opravy po U6 a U7); 43 rovnakých, 13 rozhodnutých, 0 pre vlastníka; ostatné stĺpce bez zmeny (144 riadkov) |
| Opravy po krokoch (nové 4.5) | — | 24 v U1; 44 po U1; 28 a PK3 po U4; 43 po U5a; 38 po U5c; 25 po U6; 30, 31 a 36 po U7; pri každej súbory, testy, ktoré pribudnú alebo sa otočia, a kto zmenu uvidí. Texty pri riadkoch ST4, RD24, AK19, AK20, OB7, OL7, OL8, JS2, ZN3 hovoria, čo sa rozhodlo |
| Zmena textu (6.2) | — | nález 43: potvrdzovacie tlačidlo otázky pri zastavení „Zastaviť" (EN „Stop"), vo všetkých troch adminoch; tlačidlo, ktoré otázku otvorí, a krížik ostávajú „Zatvoriť" |
| Pomenovaná konfigurácia (nové 2.13) | 2.12: kľúče práva vytvoriť z `default` | **PV14b, komponentová časť:** vnútorný kľúč `DamConfigNameKey` a `useDamConfigName(explicit?)` (výslovná vlastnosť, inak zdedené meno, inak `'default'`); vlastnosť `configName` stratí predvolené `'default'` vo `withDefaults`; vyvezené výbery a tlačidlo z U1 a `AImageMassOperations` dostanú nepovinnú `configName`; `keywordCreateAcl` a `authorCreateAcl` sa od PV14b čítajú z konfigurácie výberu. Krok po U6 a U7 (a opravách po nich), pred C3; admin-dam nič neposkytuje a ostáva na `default` |
| Testy krokov U | U5c: `DT/queue/queueRowKeywordsAuthors` bez zmeny | jeho prípad konfliktov autora (`:201-229`) otočí v U5c oprava nálezu 44 (4.5), nie U5c; zhrnutie stráží (4.3) to uvádza |
| Nové a nerozhodnuté nálezy (5.2) | N1 | N1 je v denníku nález 45; pribudol nález 47 (viac súborov pustených na widget s jedným obrázkom). Oba **nerozhodnuté**, len zoznam |
| Na vedomie (5.2) | nálezy bez rozhodnutia | pri každom, čo vlastník rozhodol a kde sa oprava robí (aj mimo komponentov: 29, 39, 32, 33, 40) |
| Formát | riadok U4 v 4.1 mal neescapované `\|\|`, tabuľka sa v ňom lámala | escapované; obsah bez zmeny |

## Verzia 4.3 oproti verzii 4.2

Rozhodnutie vedúceho k ZK26 po overení vo verzii 4.2.

| Vec | Verzia 4.2 | Verzia 4.3 |
|---|---|---|
| Zalamovanie v paneli „Info o súbore" (JS29, ZK26) | zblížené na variant dialógu; v sidebare výberu assetu (300 px) by sa popisy ako „Vytvorené" zalomili vo vnútri slova, v admin-cms aj admin-dam, mimo uploadu | **per adaptér, bez zmeny na obrazovke**: `AssetMetadata` podá `AssetFileInfoPanel` atribút `style="overflow-wrap: normal"` (prepadne na koreň panelu a zdedí sa), detail a výber assetu sa zalamujú ako dnes; dialóg jedného súboru ostane pri `break-word` karty. Jediný rozdiel v kóde: `normal` dostane aj nadpis panelu („Info o súbore", krátke slová, bez účinku). **ZK26 vypustené** (riadok s dôvodom v registri) |
| Počty | 23 zblížených, 15 per adaptér; 23 platných záznamov registra | 22 zblížených, 16 per adaptér; 22 platných záznamov (vypustené ZK2, ZK3, ZK4, ZK24, ZK26) |
| 0.1, K-04, 5.5, U6 | ZK26 medzi viditeľnými a v pohľade po U6 | ZK26 vypadlo; pohľad po U6 pokrýva len ZK23 |

## Verzia 4.2 oproti verzii 4.1

Opravy z posudkov prehľadu pre vlastníka (`krok5/posudok-prehladu-v2-opus.md`, body 6, 8, 9, 11;
`krok5/prehlad-zjednotenia.md`, 7.3 a 7.4). Počty verdiktov a zblížení sa nemenia.

| Vec | Verzia 4.1 | Verzia 4.2 |
|---|---|---|
| Smer ZK26 (zalamovanie v paneli „Info o súbore"; bod 6) | berie sa variant detailu (`overflow-wrap: normal`); „v dialógu jedného súboru sa dlhé hodnoty zalamujú ako v detaile" | bolo to naopak: karta Vuetify dáva všetkému v nej `overflow-wrap: break-word` (`node_modules/vuetify/lib/components/VCard/VCard.css:5`), dialóg jedného súboru ho dedí (`UQDSMC:180`), detail ho ruší (`AM:197`). Variant detailu by v dialógu nechal slovo, ktoré sa nezmestí, vybehnúť zo stĺpca. **Berie sa variant dialógu**: spoločný panel nič neruší. Mení sa panel všade, kde ho dnes kreslí `AssetMetadata`: detail assetu a pravý sidebar výberu assetu (admin-cms a admin-dam; admin-ugc panel vypína). Dialóg jedného súboru sa nemení. Presný účinok v registri; JS29, 0.1 a pohľad K-04 (pribudol sidebar výberu assetu) podľa toho |
| Klávesy pri PK3 (bod 9) | „šípky" | „šípky hore a dole": obsluha berie ArrowUp, ArrowDown, PageUp, PageDown, Home, End (`L/uploadQueue/components/UploadQueueEditable.vue:64-88`), doľava a doprava nie. Opravené v tabuľke verzie 2 (overenia), pri ZN3 a v PK3 |
| Viditeľné zblíženia v 0.1 (7.3; body 8 a 11) | ZK13, ZK5, ZK11, ZK23, ZK26 | podľa registra: ZK13, ZK5, ZK14, ZK15, ZK18, ZK23, ZK26; ZK11 nevidno (admin-dam len stiahne o 57 KB menej) |
| Vypustené ZK v úvode (7.4) | ZK3, ZK4, ZK24 | aj ZK2 (vypustené vo verzii 3); platných ostáva 23 |

## Verzia 4.1 oproti verzii 4

Posudky verzie 4: Codex bez nálezu, Opus bez produktového nálezu, len drobnosti. Verziou 4.1 sa cykly posudkov
návrhu komponentov uzatvárajú.

| Vec | Verzia 4 | Verzia 4.1 |
|---|---|---|
| Typy `UploadQueueSuggestionsLookup`, `DamFieldsDisabledAs` | vyvezené, používateľ neuvedený | ostávajú vyvezené ako **typy verejných vlastností a kľúča vyvezených komponentov**: `DamFieldsDisabledAs` je typ vlastnosti `disabledAs` vyvezených výberov a `disabledFieldsAs` vyvezeného riadku, `UploadQueueSuggestionsLookup` je typ hodnoty vyvezeného kľúča `UploadQueueSuggestionsKey`; kto vlastnosť alebo kľúč typuje, ich potrebuje. admin-dam ich dnes nepíše (obaly dávajú literál a funkciu) (2.11) |
| Prípady formulára hromadných operácií v `DT/queue/customMetadataForms.test.ts` | v U5c čítané cez obal sidebaru | za obalom vlastní model, udalosti a tlačidlá sidebar knižnice a formulár typu kreslí len pre typy vo fronte, lenivo; tvrdenia `:262-266,290,299,314-318` sa tak dajú len ako účinok na riadkoch, a ten už pokrýva `DT/queue/massOperationsRows.test.ts:141-200`. **Štyri prípady sa v U5b vypustia**; jediný bod, ktorý `massOperationsRows` netvrdí (formulár ukáže všetky zapisovateľné polia naraz, bez tlačidla „Zobraziť viac", nech ext system pripína čokoľvek), pribudne ako tvrdenie do jeho prípadu `:141`. Prípad formulára hromadných operácií v `DT/asset/assetMetadataValidation.test.ts:114` sa v U5b tiež vypustí; to isté tvrdí knižničný `LT/massOperationsValidation.test.ts:41`. Oba testy prestanú formulár admin-dam importovať v **U5b**, v kroku, ktorý ho osirotí (odchýlka 2 v 2.10 tak platí). 4.3 to uvádza |
| Náhradná stráž za chip kľúčového slova | tri nové prípady v U1 | aj štvrtý: chip kľúčového slova s podaným titulkom ho ukáže hneď, bez točenia, ešte pred odpoveďou na mená, a ponechá ho po nej (`DT/cached/cachedChipUnresolved.test.ts:215-219`; knižnica dnes overuje podaný titulok až po odpovedi, `damNameChipsUnresolved.test.ts:131,159-163`) |
| Drobnosti | | 2.2: „seven new ones"; 2.11: mapa `exports` má aj `./eslint`, `./oxlint`, `./testing`, `./vite`, `./package.json` (záver sa nemení); U0: ohnutie pre nový prípad duplikátu je tlačidlo s iným textom v obsahu slotu `edit`, nie len vypustené `v-if` (to zhodí aj `:335-339` a nedokáže nič nové); U4: prípad „vlastnosť nepodaná" kľúč `refreshOffered` vôbec neuvedie (Vue výslovné `undefined` nepretypuje) |

## Verzia 4 oproti verzii 3

Zapracúva posudky verzie 3: Codex (`krok5/posudok-navrhu-komponentov-v3-codex.md`) a Opus (body poslal vedúci).
RD10 a RD12 obstáli na oboch stranách.

| Vec | Verzia 3 | Verzia 4 |
|---|---|---|
| Tlačidlo úpravy na duplikáte v admin-dam (RD5; Opus PRODUCT) | obsah slotu `edit` je `AQIE:368-376` doslova, s `v-if="!item.isDuplicate"` | na duplikáte by slot vrátil len komentár a Vue by vykreslilo **predvolený** obsah, vypnuté „Upraviť v DAM" (R-K6, `runtime-core.cjs.js:3329-3339,3355-3363`); `queueRowStates.test.ts:335-339` by ostal zelený, lebo hľadá presne „Edit more". **Nová vlastnosť riadku `hideEditOnDuplicate`** (knižnica `false`, admin-dam `true`): na duplikáte sa nevykreslí ani slot, ani predvolený obsah. Nový test: na duplikáte admin-dam nie je **žiadne** tlačidlo úpravy, nech má akýkoľvek text (U0, stráži U5c); v knižnici U4 |
| `refreshOffered` (Opus GAP) | `refreshOffered ?? vlastné pravidlo` | Vue neprítomnú logickú vlastnosť bez deklarovaného predvoleného premení na `false` (`runtime-core.cjs.js:5117-5119`), takže by v CMS a UGC „Obnoviť" nebolo nikdy a kôš len pri `Failed`. Vlastnosť má typ `boolean \| undefined` a vo `withDefaults` výslovne `refreshOffered: undefined` (2.2); test U4 polovicou `false` overí riadok v stave, v ktorom vlastné pravidlo „Obnoviť" ponúka (po 20 s, alebo `Failed` s `refreshMayHelp` a assetom), inak by nezachytil `refreshOffered \|\| vlastné` |
| Exporty bez produkčného používateľa (oba posudky) | `ADamAssetCustomMetadataFormMassOperations`, `useDamCachedAuthorsForRemoteAutocomplete`, `useDamCachedKeywordsForRemoteAutocomplete` | **nevyvážajú sa.** Formulár hromadných operácií admin-dam po U5b používa len cez sidebar knižnice; testy ho v U5c čítajú cez obal sidebaru. Trojice pre výbery slúžia len výberom admin-dam, ktoré v U5c zaniknú; preposielače ich do vtedy zložia z `useDamCached*()`. Počet importérov cez preposielače je 14 súborov (nie 17) |
| Náhradná stráž za chipy kľúčového slova a konfliktu (Codex GAP) | `damNameChipsUnresolved.test.ts` | ten test nepokrýva prípady admin-dam „records cannot be read at all" (`DT/cached/cachedChipUnresolved.test.ts:167`) a „asked for again and is there" (`:179`) pre chip kľúčového slova, ani prvý z nich pre chip konfliktu. **Pribudnú v knižnici** (nové prípady v `LT0/damNameChipsUnresolved.test.ts`, krok U1, na dnešnom kóde knižnice) skôr, než ich U5c vypustí z admin-dam |
| Augmentácia `ttsAudio` a `admin-dam/tsconfig.test.json:3-5` (Opus, nízke) | len odstránenie z `src/plugins.d.ts` | v tej istej úprave sa opraví komentár v `tsconfig.test.json:3-5`, ktorý zahrnutie `plugins.d.ts` zdôvodňuje práve touto augmentáciou; zahrnutie ostáva (súbor rozširuje aj `AclRegistry`, `DefineLocaleMessage` a `RouteMeta`) |
| Počty (0.2) | 144 riadkov | bez zmeny počtov; RD5 má k slotu aj vlastnosť |

## Verzia 3 oproti verzii 2

Zapracúva posudky verzie 2: Codex (`krok5/posudok-navrhu-komponentov-v2-codex.md`) a Opus (body poslal vedúci;
0 produktových nálezov, kontroly 1, 2 a 5 platia).

| Vec | Verzia 2 | Verzia 3 |
|---|---|---|
| Kedy riadok ponúkne „Obnoviť" (RD10, RD12; Codex PRODUCT, Opus WRONG) | jedno pravidlo v knižnici s vlastnosťou `refreshAtOnceOnError`; admin-dam `true` = „hneď, kým je upozornenie" | **každá strana si nechá svoj dnešný watcher bez zmeny.** Riadok knižnice počíta „Obnoviť" ako dnes (`UQIE:156-235`); riadok dostane vlastnosť `refreshOffered?: boolean`, ktorou mu hostiteľ podá hotovú odpoveď, a obal admin-dam ju počíta presunutým watcherom `AQIE:132-275`. Verzia 2 by v admin-dam ukázala „Obnoviť" aj vtedy, keď upozornenie príde až na riadok, ktorý je už nahratý; dnešný admin-dam číta chybu len pri zmene stavu a pri pripojení. Obe správania pripnú testy (U0, U4). ZK2 vypustené (knižnica nemusí prevziať časovač admin-dam). |
| Dôvod pri RD12 (Opus) | „v bežnom toku admin-cms sa ukážu dve tlačidlá hneď" | opravený: v knižnici príde upozornenie na nahratý riadok až po troch zlyhaných čítaniach (najmenej 45 s), keď 20-sekundová ponuka už je; rozdiel strán je riadok, ktorý sa **pripojí** už s upozornením (napríklad znova otvorený dialóg): admin-dam „Obnoviť" hneď, knižnica po 20 s |
| ZK27 a `DT/asset/assetMetadataValidation.test.ts:181-186` (Opus GAP) | neuvedené | prípad „is stopped by a required custom field behind 'show all'" spolieha na dnešnú zálohu 0; v U5c dostane `pinned: 0` výslovne, inak by jeho jediné pole bolo pripnuté a prípad by netestoval „za Zobraziť viac" |
| `DT/a11y/iconButtonNames.test.ts` | počty súborov a tlačidiel | aj počet dvojíc bubliny a mena (`:149`) ide s počtom tlačidiel (`:95`): 9 → 8 (U5a) → 2 (U5b) → 0 (U5c) |
| `DT/cached/cachedChipUnresolved.test.ts` v U2 (Opus) | „spustiť skutočnú inicializáciu" | zapísať `cachedExtSystemId` cez `useExtSystemIdForCached` (export z U1) a nainštalovať plugin s `damClient`; náhrada modulu `currentExtSystem` (`:17-19`) ostáva |
| Exporty chipov (Opus; vedúci) | len `ADamAuthorCachedChip` | **len `ADamAuthorCachedChip`, ako vo verzii 2.** Chip kľúčového slova a chip konfliktu sa nevyvážajú: produkčný kód admin-dam ich priamo nepoužíva (sú vnútri výberov knižnice) a verejný export len pre test by bolo API navyše. `DT/cached/cachedChipUnresolved.test.ts` v U5c stratí ich prípady; `#id` pri nich stráži test knižnice `src/domains/dam/__tests__/damNameChipsUnresolved.test.ts`. Pri každom exporte je v 2.11, kto ho používa |
| ZK14 (Opus WRONG) | „kozmetika", bez testu | bublina pri `#id` je v knižnici `VTooltip`, nie atribút `title`: `cachedChipUnresolved.test.ts:164` („shows the id, and says why…") v U5c očervenie a mení sa (variant `textOnly` titulok drží, `:212` platí); 4.3 to už neuvádza ako zmenu bez dôvodu v správaní |
| Augmentácia `ttsAudio` (Opus, nízke) | dôvod TS2717, brána `lint:tsc` | dôvod vypustený: augmentácia je v `.d.ts` a admin-dam má `skipLibCheck: true`, takže zabudnuté odstránenie by `lint:tsc` nezachytil; odstránenie ostáva **výslovnou úpravou** kroku kópie po U1 |
| Počty (0.2) a register | 24 zblížených, 26 per strana; 24 platných záznamov | 23 zblížených, 27 per strana (RD10 je per strana); 23 platných záznamov (ZK2 vypustené) |
| Veľkosť obalu riadku admin-dam | asi 120 riadkov | asi 160 (watcher „Obnoviť" ide s ním) |

## Verzia 2 oproti verzii 1

Zapracúva posudky Codexu a Opusu (`krok5/posudok-navrhu-komponentov-codex.md`, `…-opus.md`) podľa pokynov vedúceho.
Oba posudky: žiadny problém pre admin-cms a admin-ugc; rámec s dvoma adaptérmi reprodukuje obe obrazovky;
`createDamImage` dá všetkých deväť objektov pole po poli; zoznam R10 je presný.

| Vec | Verzia 1 | Verzia 2 |
|---|---|---|
| „Obnoviť" pri nahratom riadku s upozornením (RD12) | zblížené na admin-dam (ZK3: hneď) | **per strana, vlastnosť `refreshAtOnceOnError`** (knižnica `false`, admin-dam `true`). Oba posudky: v admin-cms a admin-ugc by sa v bežnom toku hneď ukázalo „Obnoviť" **aj** „Odstrániť z fronty" (kôš ide s „Obnoviť", `UploadQueueItemEditable.vue:161-168`), nie najviac o 20 s neskôr. To je viditeľná zmena v bežnom toku, teda produkt. ZK3 vypustené. |
| Editor oblasti záujmu len na čítanie (Codex GAP) | rámec to neuvádzal | rámec počíta `roiEditable` z `roiUpdateAcl` presne ako dnes oba dialógy a dá `:readonly="!roiEditable"` (editor bez vlastnosti je upraviteľný); nový riadok JS31; prípad bez práva v U0 (detail) a v U6 (dialóg, `LT0/consumerProfileUploadDialogSingle` ho už má) |
| `AssetDetailView.image.progress`, `remainingTime` (Codex WRONG) | `number` | `number \| null`, ako v riadku (`types/UploadQueue.ts:72-73`) |
| Strážny test `DT/a11y/iconButtonNames.test.ts` (Codex GAP) | chýbal | U5a až U5c ho zužujú (číta staré súbory ako text: štyri súbory, deväť tlačidiel); v U5c ostane nad obalmi admin-dam; U9 |
| `DT/cached/cachedChipUnresolved.test.ts` (Opus W1) | upravoval sa v U3 | v **U2**: montuje bez pluginu a čaká `/ext-system/1/`; po U2 by preposlaná cache vyhodila výnimku alebo sa pýtala na `/ext-system/0/` |
| Udalosť „Obnoviť" riadku (Opus W2) | zblížené (ZK4: riadok knižnice pridá `item`) | riadok knižnice ostáva `{ index, assetId }`; `item` pridá obal admin-dam. ZK4 vypustené; `LT/uploadQueueRowRefresh.test.ts:129-131,172` bez zmeny |
| Predvolený obsah slotu `item` zoznamu (Opus R1) | neurčené | volá `refresh` slotu s riadkom cyklu, nie s `$event.item` (`LT/uploadQueueItemRefresh.test.ts:198,219,251`, po kroku 28; pred ním `:194,215,247`, emitujú bez `item`) |
| Augmentácia `ttsAudio` v admin-dam (Opus G1) | zanikla v U3 | zanikne **pri kópii po U1**; brána U1 zahŕňa `lint:tsc` admin-dam |
| `AssetLicenceEditForm` (Opus G2) | ext system neuvedený | **aktuálny** ext system (`currentExtSystemId`), ako dnes; nie `assetLicence.extSystem` |
| Záložný počet pripnutých polí (FM2; Opus G3) | pre vlastníka (PK1), dovtedy kľúč konfigurácie | **zblížené na knižnicu (2), ZK27**: podľa hranice vlastníka to nie je produkt v bežnom toku (backend číslo vždy pošle). Kľúč `customMetadataPinnedFallback` zanikol, a s ním otázka G3. Ak to vlastník bude mať za produkt, vráti sa ako kľúč konfigurácie čítaný z `default` (formulár `configName` nemá). |
| `createDamImage` (Opus R2, W3) | „len keď je daná"; poradie kľúčov len v IM7 | `position` a `id` pri `!== undefined` (IM6 a IM8 dávajú 0); poradie kľúčov sa mení v IM1 až IM7 (aj v `dam`), bez účinku |
| Obal okolo obrázka v detaile (ZK24; Opus R3) | zblížené | **vypustené**: rámec dá obal `position-relative` len s prekrytím (dialóg), detail ostáva flex prvkom; JS9 je „per adaptér" |
| ZK13 (Opus R4), ZK23 (Opus W4) | „na chvíľu sa točí"; „o 4 px ďalej" | po vyčistení cache sa chip točí, kým ho niekto znova nepridá; tlačidlá sa posunú o 4 px **bližšie** k okraju |
| „Pre vlastníka" | témy PK1 až PK3 a nálezy denníka | len produktové témy a chyby, na ktoré používateľ narazí (PV15 jadra, nálezy 25 a 36, PK3). PK1 je ZK27; PK2 je nový nález N1 do denníka; PK3 ostáva témou pre vlastníka (potvrdené v prehliadači, K-13); nálezy 38, 40, 42, 43, 44 (chyby bez rozdielu strán alebo vlastný kód jednej strany) sú „na vedomie" (5.2) a v tabuľkách „rovnaké" alebo „vlastný kód" |
| Register | poznámka o dopisovaní na konci odseku | na začiatku časti 6: register je otvorený, každý krok doň dopisuje; vypustené záznamy ostávajú s dôvodom, čísla sa nemenia |
| Počty (0.2) | 143 riadkov; 26 zblížených, 10 pre vlastníka | 144 riadkov; 24 zblížených, 3 pre vlastníka (a téma PK3 pri ZN3) |
| Overenia predpokladov (`krok5/overenia.md`, K-01 až K-15) | — | K-01 (strážny test ikon) a K-09 (počty prípadov: `uploadQueueRowRefresh` 17, `uploadQueueItemRefresh` 12, `uploadQueueDialogSingle` 21) vyvrátené a opravené; **PK3 potvrdené v prehliadači a horšie**: v dialógu fronty admin-cms a admin-ugc nefungujú Home, End, šípky hore a dole ani PageUp/PageDown pri písaní v poli riadku (K-13) → téma pre vlastníka s odporúčaním opravu zaradiť; potvrdené a citované: prázdny slot (K-05), `useAclAllowed` (K-06, kde `can()` hodí výnimku, vráti `false`), R10 v testoch (K-03: 28 riadkov v 8 súboroch admin-dam, v knižnici a e2e nič), stav s upozornením (K-07, N-Z21), nič nehlási súbory bez importéra (K-11), režim `xx` (K-15); K-02, K-04, K-14 ukáže implementácia (4.4) |
| PV15 (HO10) | „to isté tlačidlo v LIB som nečítal" (jadro) | overené (J-14): jednotlivé „nahradiť" nedotknutého vlastného poľa zapíše `undefined` do každého riadku typu aj v knižnici, ako v admin-dam; rozdiel strán tu nie je |
| Jadro | verzia 5 | verzia 6 (22:22); jeho časť 3.3 sa nezmenila |

Podklad na implementáciu častí 4 a 5 kroku 5 z `upload-plan.md` (krok 5, body 4 až 6; rozhodnutie R16). Len
návrh: nič z neho nie je v kóde. Nič som nespúšťal (žiadne testy, build, lint ani prehliadač). Všetko je
z čítania pracovných stromov oboch repozitárov (LIB `next` nad `49bd815b`, DAM `next` nad `ba8a66ec`, oboje
s nekomitnutými zmenami krokov 0 až 3; stav k 21:45, stromy od 18:46 stoja) a z podkladov `podklady/upload/5`,
`6`, `7`, `8`, `krok5/lib-vlna4.md`, `krok5/dam-vlna4.md`. Kde sa podklady líšia od kódu, platí kód (podklady 5
až 7 sú zo 7. 10., pred krokmi 1 až 3; čo sa odvtedy zmenilo, je pri riadku).

Stojí na návrhu jadra `krok5/navrh-jadro.md` (verzia 6, 22:22): jeho časti 2.4, 2.5, 3.1, 3.2 a 3.3. Komponenty
sa dotýkajú skladov len cez členov, ktoré oba sklady podľa jadra zachovávajú pod dnešnými menami (3.1, 3.2), takže
návrh platí pred K6 jadra aj po ňom. Číslovanie je odlíšené od jadra: rozdiely majú predpony skupín (RD, ZN, HO,
ST, FM, OB, AK, SB, OL, JS, IM), kroky sú U0 až U9, zblíženia ZK1 až ZK27 (ZK3, ZK4 a ZK24 sú vypustené vo verzii 2,
ZK2 vo verzii 3, ZK26 vo verzii 4.3; čísla ostatných sa nemenia), opravy po krokoch (4.5), pomenovaná
konfigurácia PV14b (2.13) a nové nálezy N1 (v denníku nález 45) a 47. Témy pre vlastníka (PV15, nálezy 25 a 36,
PK3), nálezy 45 a 47 a knižničnú časť nálezu 49 vlastník rozhodol 9. 10. (5.2).

**Pravidlo, podľa ktorého je návrh písaný** (vlastník 8. 10. večer, cez vedúceho): rozhoduje produktový
rozdiel, nie vnútorný. Čo používateľ vidí a môže robiť (polia, formuláre, záložky, tlačidlá, kroky, toky), texty,
čo sa uloží a pošle, voľby aplikácie: ostáva na každej strane, cez vlastnosť, slot, konfiguráciu alebo podanú
funkciu. Drobnosti rozloženia, pár pixelov, iný kontajner, vnútorná stavba a chyby jednej strany: smú sa zblížiť
na jeden variant, každé zblíženie je v registri v časti 6.

**Cesty.** `L/` = LIB `src/domains/dam/`, `L-ui/` = LIB `src/domains/ui/file/`, `D/` = DAM
`src/domains/coreDam/`. Testy: `LT/` = LIB `src/domains/dam/uploadQueue/__tests__/`, `LT0/` = LIB
`src/domains/dam/__tests__/`, `LW/` = LIB `src/domains/dam/imageWidget/__tests__/`, `LS/` = LIB
`src/test/`, `DT/` = DAM `src/test/`.

**Verdikty** (posledný stĺpec tabuliek v časti 1, jeden na riadok):

- **rovnaké** — obe strany robia to isté; spoločný komponent to robí raz.
- **per strana** — produktový rozdiel; spoločný komponent ho dostane zvonku. Uvedený je mechanizmus a meno:
  vlastnosť (prop), slot, konfigurácia pluginu, väzba (podané funkcie). Predvolená hodnota je vždy dnešná
  knižnica; admin-dam podá svoju v obale.
- **per adaptér** — len v časti 1.10: rozdiel dvoch obrazoviek knižnice (detail assetu a dialóg jedného súboru),
  ktoré pôjdu cez jeden rámec; rámec ho dostane od adaptéra alebo slotu.
- **zblížené** — vnútorný rozdiel, kozmetika alebo chyba jednej strany; berie sa jeden variant, odkaz do registra
  (ZK).
- **rozhodnuté** — rozdiel už rozhodol vlastník (R10, R16, prvá sada bod 3 a 7, druhá sada bod 3); vykoná sa.
  Rozhodnutia z 9. 10. (nálezy 25 a 36) sa vykonajú ako samostatný krok po kroku U, ktorý ten kód prepisuje (4.5).
- **vlastný kód** — vec má len jedna strana (alebo každá svoju, a nezdieľa sa); ostáva, kde je.
- **pre vlastníka** — otvorená produktová téma (PV jadra alebo nález z denníka, pri ktorom ide o to, čo používateľ
  vidí, môže urobiť alebo čo sa pošle); kým nepríde rozhodnutie, ostáva dnešný stav každej strany. Chyba, ktorú
  majú obe strany rovnako a ktorú tento návrh nemení, je „rovnaké" s odkazom na nález; chyba len jednej strany v
  jej vlastnom kóde je „vlastný kód". Od 9. 10. taký riadok nie je: vlastník témy rozhodol (5.2).

---

## 0. Zhrnutie

### 0.1 Na jednu obrazovku

**Časť 4: komponenty.** Jedna zásada pre všetko: **spoločný komponent knižnice si nechá svoj súbor, svoje
vlastnosti a svoje dnešné správanie ako predvolené; rozdiely admin-dam do neho prídu ako vlastnosti, sloty,
konfigurácia a „väzba" (objekt podaných funkcií), ktorú admin-dam podá v tenkom obale na mieste svojho dnešného
súboru.** Spoločný komponent sa nedotkne žiadneho singletonu knižnice (sklad, cache, voľby pluginu, upozornenia)
inak než cez väzbu; jej predvolená hodnota je dnešný kód knižnice. To je zásada 1 jadra preložená na komponenty:
čo testy admin-dam nahrádzajú (moduly podľa cesty, `useAlerts` na vstupe balíka), volá kód admin-dam.

1. **Riadok** (`L/uploadQueue/components/UploadQueueItemEditable.vue`) dostane tri sloty (`image-overlay`,
   `edit`, `remove`) a sedem vlastností (`cancelStatuses`, `duplicateNotice`, `disableFormOnDuplicate`,
   `hideEditOnDuplicate`, `validationScope`, `disabledFieldsAs`, `refreshOffered`). `D/asset/components/queue/AssetQueueItemEditable.vue` (512 riadkov)
   sa stane obalom asi 160 riadkov: prekrytie duplikátu s odkazom, tlačidlo „Upraviť" s otvorením detailu DAM,
   kôš so zmazaním assetu, jeho dnešný watcher „Obnoviť" (presunutý bez zmeny), hodnoty admin-dam.
2. **Zoznam** (`L/uploadQueue/components/UploadQueueEditable.vue`) dostane väzbu `queue`, sloty `item` a
   `sidebar` a vlastnosti `massOperationsFrom`, `keyboardScroll`. `D/…/AssetQueueEditable.vue` ostane ako obal
   asi 70 riadkov (odchýlka od plánu, 2.10).
3. **Hromadné operácie** (`L/uploadQueue/components/AssetQueueSelectedSidebar.vue`) dostanú väzbu
   `operations` a štyri panely typov; `D/…/AssetQueueSelectedSidebar.vue` (363) ostane ako obal asi 35 riadkov.
4. **Listové bloky** idú do celého admin-dam z knižnice: tlačidlo zastavenia, oba formuláre vlastných metadát,
   chip dôvodu zlyhania, `AssetImage` s ikonami (ikona TTS cez vlastnosť `showTts`), výber kľúčových slov a
   autorov (právo vytvoriť cez konfiguráciu, vzhľad zamknutého poľa cez vlastnosť), tri chipy, tlačidlo
   „nový autor", cache mien, konfigurácie autora a kľúčového slova, kontrola formátu a stav ťahania.
5. **Ostávajú v admin-dam celé:** plávajúce panely a obe prekrytia na celú obrazovku, pás výberu,
   `AssetQueueUploadList`, `AssetQueueItemList`, `AssetQueueSelected(Item)Simple`, `AssetSlotListItem`,
   `AssetUpload`, `FileUpload` (prechádzanie priečinkov), súbory externých poskytovateľov, `uploadQueueIds.ts`,
   pohľady pätičky, `AssetLink`, `KeywordCreateButton`, akcie, API a filtre autorov a kľúčových slov,
   `validationScopes.ts`. V knižnici ostávajú jej obaly: `UploadQueueDialog`, `UploadQueueDialogSingle`, widgety.

**Časť 5: „falošný" formulár (R16).** Detail assetu (`L/assetDetail/components/AssetDetailDialog.vue` a jeho
sidebar) a dialóg jedného súboru (`L/uploadQueue/components/UploadQueueDialogSingle.vue` a jeho tri sidebarové
komponenty) pôjdu cez jeden rámec „obrázok a sidebar" (`AssetDetailDialogFrame.vue`, `AssetDetailSidebarFrame.vue`).
Rámec dostáva len to, čo kreslí: pohľad `AssetDetailView` (typ, stav, obrázok, záložky) a sloty. Pohľad dajú dva
adaptéry: z assetu detailu a z riadku fronty (spolu s načítaným assetom po dokončení). Vymyslený
`AssetDetailItemDto` s 25 výplňovými poľami (`UploadQueueDialogSingle.vue:82-127`) zanikne. Panel „Info
o súbore" je jeden komponent pre obe obrazovky. Objekt obrázka pre CMS (`ImageCreateUpdateAware`), ktorý sa dnes
skladá ručne na deviatich miestach, skladá jedna funkcia `createDamImage`; každé miesto dostane presne dnešný
objekt.

**Čo sa mení pre používateľa.** Zjednotenie samo produktovo nič. Viditeľné sú len: (a) anglické texty admin-dam v dvanástich
reťazcoch spoločných komponentov (R10, zoznam v 6.2); (b) prístupné mená tlačidiel hromadných operácií dostanú
názov poľa na oboch stranách (prvá sada, bod 7; samostatný krok U8); (c) 22 zblížení v registri (časť 6),
z ktorých viditeľné sú drobnosti: chipy v admin-dam sledujú zmenu mena (ZK13), 16 px okraj zoznamu v admin-dam
(ZK5), vysvetlenie pri nenačítanom `#id` v admin-dam v bubline namiesto natívneho titulku (ZK14), nanajvýš medzera
okolo pomlčky v prázdnom chipe admin-dam (ZK15), čítačka obrazovky v admin-dam pomenuje tlačidlo „nový autor" (ZK18),
a tlačidlá panela dialógu jedného súboru o 4 px bližšie k pravému okraju (ZK23). Zástupný obrázok ako SVG (ZK11)
nevidno; admin-dam len stiahne o 57 KB menej. (d) Opravy, ktoré vlastník rozhodol 9. 10., každá ako malý krok po
kroku U (4.5): v dialógu fronty admin-cms a admin-ugc fungujú v poliach šípky hore a dole, PageUp, PageDown, Home
a End (PK3); dialóg jedného súboru ponúkne „Obnoviť" aj pri zlyhanej položke, kde ho ponúka riadok (nález 25);
potvrdzovacie tlačidlo otázky pri zastavení sa volá „Zastaviť" (EN „Stop") vo všetkých troch (nález 43); „stále sa
nahráva" sa neukáže riadku, ktorý sa medzitým usadil (nález 28); chipy konfliktov autora neponúknu už vybraného
autora a nadpis nad nimi zmizne s posledným (nález 44); odmietnutý súbor vo widgete obrázka neotvorí dialóg na
nekonečnom načítavaní (nález 30); nové obrázky galérie nadviažu na pozície starých bez medzery navyše (nález 31; medzera
po odobratom obrázku ostáva, nález 80); po vytvorení obrázka
widget nečíta obrázok znova, takže náhľad neblikne (nález 36); widget s jedným obrázkom z viacerých pustených
súborov vezme prvý a upozorní (nález 47); detail knižnice vypne „Uložiť" pre asset, ktorého súbor sa ešte
spracúva, a widget mu neponúkne autorov DAM (nález 49, F-C a F-D). Nález 45 dnes nikto nevidí.

**Veľkosť** (odhad z čítania): z admin-dam odíde asi 2 810 riadkov produkčného kódu (dnes 3 094 riadkov
v 23 súboroch, potom asi 285 v troch obaloch a dvoch preposielačoch cache); spolu s jadrom (asi −1 310) je to
asi 4 120, čo zhruba sedí s odhadom plánu (4 400). V knižnici pribudne asi 450 riadkov (väzby 90, rámec a
adaptéry 280, spoločné prekrytie chyby a „Obnoviť" 80) a ubudne asi 450 (dva dialógy a dva sidebary −340, deväť
ručných objektov obrázka −110); knižnica sa veľkosťou takmer nezmení.

**Poradie** (časť 4): U0 testy chýbajúceho dnešného správania → U1 listové bloky v LIB (voľby, exporty) → kópia →
U2 cache v DAM → U3 admin-dam mimo uploadu na bloky LIB → U4 riadok, zoznam, sidebar v LIB → kópia → U5a až U5c
obaly v DAM → U6 rámec a adaptéry (len LIB) → U7 `createDamImage` (len LIB) → U8 prvá sada, bod 7 → U9
upratanie (zmazanie súborov DAM jedným príkazom vlastníka). Začiatok neblokuje nič (5.1). Po U1, U4, U5a, U5c,
U6 a U7 idú malé opravy rozhodnuté 9. 10. (4.5); po U6, U7 a opravách po nich pomenovaná konfigurácia, kroky PV14a
(jadro) a PV14b (komponenty, 2.13).

### 0.2 Rozdiely v číslach

Tabuľky časti 1, spolu 144 riadkov (počty spočítané z verdiktov riadkov).

| Tabuľka | Riadkov | rovnaké | per strana | per adaptér | zblížené | rozhodnuté | vlastný kód | pre vlastníka |
|---|---|---|---|---|---|---|---|---|
| 1.1 Riadok | 24 | 7 | 11 | — | 1 | 4 | 1 | 0 |
| 1.2 Zoznam | 13 | 2 | 9 | — | 2 | 0 | 0 | 0 |
| 1.3 Hromadné operácie | 11 | 4 | 2 | — | 2 | 2 | 1 | 0 |
| 1.4 Tlačidlo zastavenia | 4 | 2 | 0 | — | 1 | 1 | 0 | 0 |
| 1.5 Formulár vlastných metadát | 6 | 2 | 1 | — | 2 | 0 | 1 | 0 |
| 1.6 Obrázok, ikony, chip dôvodu | 7 | 4 | 1 | — | 1 | 1 | 0 | 0 |
| 1.7 Autori a kľúčové slová | 21 | 6 | 3 | — | 9 | 1 | 2 | 0 |
| 1.8 Výber súborov, ťahanie | 7 | 2 | 0 | — | 2 | 0 | 3 | 0 |
| 1.9 Obaly | 9 | 0 | 0 | — | 0 | 1 | 8 | 0 |
| 1.10 Detail a dialóg jedného súboru | 31 | 5 | — | 16 | 2 | 2 | 6 | 0 |
| 1.11 Objekt obrázka | 11 | 9 | 0 | — | 0 | 1 | 1 | 0 |
| **Spolu** | **144** | **43** | **27** | **16** | **22** | **13** | **23** | **0** |

Dvadsaťdva riadkov „zblížené" je 22 platných záznamov registra: AK9 patrí k ZK13, a ZK12 nemá vlastný riadok
(je to, ako sa pole vypne vo vzhľade z AK3, ktorý sám je „per strana"). Tri riadky, ktoré boli do verzie 4.3 „pre
vlastníka", vlastník 9. 10. rozhodol: HO10 (PV15 jadra) je želaný stav, teda „rovnaké"; JS21 (nález 25) a IM10
(nález 36) sú „rozhodnuté", opravy po U6 a U7 (4.5). K nim patrí PK3 (chyba posunu klávesmi v knižnici, pri ZN3,
ktorý sám je „per strana"), schválená oprava po U4. Ostatné nálezy denníka, ktorých sa návrh dotýka, sú chyby bez
rozdielu strán alebo vlastný kód jednej strany; sú v 5.2 „na vedomie", s tým, čo o nich vlastník rozhodol.

---

## 1. Rozdiely

### 1.1 Riadok fronty

LIB `L/uploadQueue/components/UploadQueueItemEditable.vue` (459 riadkov, ďalej `UQIE`), DAM
`D/asset/components/queue/AssetQueueItemEditable.vue` (512, ďalej `AQIE`). Obe sú dnes bez skladu v šablóne,
ale `AQIE` sám volá API, dva sklady DAM, upozornenia a navigáciu.

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| RD1 | Karta v mriežke (xxl 2, xl 3, md 4, sm 6, 12), obrázok so stavmi: čakanie, posielanie s percentami a zvyšným časom, spracovanie, „Hotovo" | `UQIE:239-263` | `AQIE:279-303` | **rovnaké** |
| RD2 | Prekrytie chyby: ikona, „Chyba", text riadku, inak chip dôvodu, inak „neznáma chyba" | `UQIE:264-294`; kľúče `common.damImage.queueItem.error`, `common.damImage.uploadErrors.unknownError` | `AQIE:329-359`; kľúče `coreDam.asset.queueItem.error`, `system.uploadErrors.unknownError`; SK zhodné, EN „unknownError" iné | **rozhodnuté (R10)**: jedno prekrytie `UploadQueueItemErrorOverlay.vue` (aj pre dialóg jedného súboru) s kľúčmi knižnice |
| RD3 | Prekrytie duplikátu nad obrázkom: „Duplikát" a „Zobraziť originál" v novej karte | nie je | `AQIE:304-328` (`AssetLink`, kľúče `coreDam.asset.queueItem.duplicate`, `viewOriginal`) | **per strana: slot `image-overlay`** (bez predvoleného obsahu; vyplní obal DAM) |
| RD4 | Riadok „Hlavný súbor je duplikát." pod názvom | `UQIE:374-381` | nie je | **per strana: vlastnosť `duplicateNotice`** (predvolene `true`; DAM `false`). Nie slot: Vue pri prázdnom podanom slote vykreslí predvolený obsah, takže admin-dam by ho slotom nevedel vypnúť |
| RD5 | Tlačidlo úpravy: text, kedy je, čo otvorí | „Upraviť v DAM" (`common.damImage.image.button.editAsset`), vždy, vypnuté bez metadát; udalosť `showDetail`, dialóg z nej otvorí detail knižnice (`UQIE:303-310,170-173`) | „Upraviť" (`coreDam.asset.queueItem.edit`), skryté pri duplikáte; otvorí detail DAM cez dva sklady s počítadlom požiadaviek a strážou navigácie (`AQIE:368-376,142-166`) | **per strana: slot `edit`** (predvolený obsah = dnešné tlačidlo knižnice) **a vlastnosť `hideEditOnDuplicate`** (admin-dam `true`): bez nej by na duplikáte admin-dam slot vrátil len komentár a Vue by vykreslilo predvolené „Upraviť v DAM" (R-K6, verzia 4) |
| RD6 | Kopírovanie ID assetu | `UQIE:314-319`, `common.damImage.queueItem.copyAssetId` | `AQIE:379-384`, `coreDam.asset.queueItem.copyAssetId`; EN „Copy Asset ID" | **rozhodnuté (R10)** |
| RD7 | Prázdny prvok pri duplikáte | `<div v-if="item.isDuplicate" />` (`UQIE:313`) | nie je | **zblížené → ZK1** |
| RD8 | „Zrušiť" (x): pri ktorých stavoch | `Loading`, `Waiting`, `Uploading` (`UQIE:147-154`) | aj `Processing` a `Failed` (`AQIE:203-215`, `3a242125`) | **per strana: vlastnosť `cancelStatuses`** |
| RD9 | Kôš: čo robí, kedy je, aký text | „Odstrániť z fronty" bez požiadavky; len pri ponúknutom „Obnoviť" alebo pri zlyhanom riadku; otázka `queueItem.removeFromQueue`; udalosť `removeItem(index)` (`UQIE:353-359,165-168`) | zmaže asset: vždy, s právom `dam_asset_delete`, vypnuté bez metadát okrem duplikátu, predvolená otázka „Odstrániť?", `DELETE`, potom `removeItem(assetId)` a upozornenie „zmazané" (`AQIE:418-424,167-177`) | **per strana: slot `remove`** (predvolený obsah = dnešné tlačidlo knižnice) |
| RD10 | „Obnoviť" po 20 s posielania alebo spracovania | časovač podľa stavu v čase nastavenia; pri zastavení sa nezruší (`UQIE:194-203`) | časovač zrušený pri každej zmene stavu, pri spustení overí aktuálny stav; duplikát nikdy (`AQIE:220-231,242,247`) | **per strana: vlastnosť `refreshOffered`** (riadok knižnice počíta ako dnes; obal admin-dam podá výsledok svojho dnešného watchera). Rozdiel časovačov je dnes neviditeľný (zastavený riadok vo fronte knižnice už nie je); verzia 2 ho zbližovala (ZK2), verzia 3 ho necháva, lebo admin-dam aj tak drží svoj watcher (RD12) |
| RD11 | „Obnoviť" na nahratom riadku bez metadát po 20 s; zmizne, keď metadáta prídu | `UQIE:204-213,224-230` | `AQIE:240-249,260-270` | **rovnaké** (správanie; počíta ho watcher každej strany, RD12) |
| RD12 | „Obnoviť" na nahratom riadku, ktorý ukazuje upozornenie („…Použite tlačidlo obnovenia…") | upozornenie sa nečíta: „Obnoviť" (a s ním kôš „Odstrániť z fronty") príde 20 s po prechode na `Uploaded`, ak riadok nemá metadáta, a metadáta ho skryjú (`UQIE:161-168,204-213,224-230`) | chyba sa číta **len pri zmene stavu a pri pripojení** (okamžitý watcher stavu): riadok, ktorý prejde na `Uploaded` alebo sa pripojí už s chybou, má „Obnoviť" hneď a nechá si ho aj pri metadátach (`AQIE:233-239,260-270`); upozornenie, ktoré príde až na nahratý riadok, nič nezrýchli, platí 20 s časovač | **per strana: vlastnosť `refreshOffered`** (predvolene bez nej = watcher knižnice; obal admin-dam podá výsledok presunutého `AQIE:132-275`). V knižnici príde upozornenie na nahratý riadok až po troch zlyhaných čítaniach, najmenej 45 s po prechode, keď 20-sekundová ponuka už je (posudok Opusa); rozdiel strán je riadok, ktorý sa pripojí už s upozornením, napríklad v znova otvorenom dialógu: admin-dam hneď, knižnica po 20 s |
| RD13 | „Obnoviť" na zlyhanom riadku | len keď môže pomôcť a riadok má asset (`UQIE:161-163`, vlastnosť `refreshMayHelp`) | nikdy (`AQIE:253-255`) | **rozhodnuté** (prvá sada, bod 3; druhá sada, bod 3): vlastnosť `refreshMayHelp` už je, admin-dam ju nepodá |
| RD14 | Názov originálu a veľkosť súboru | `UQIE:364-373` | `AQIE:429-438`; EN „Original name" | **rozhodnuté (R10)** |
| RD15 | Formulár vypnutý | `!canEditMetadata` (`UQIE:382`) | `!canEditMetadata \|\| isDuplicate` (`AQIE:439`) | **per strana: vlastnosť `disableFormOnDuplicate`** (v DAM duplikát `canEditMetadata` nikdy nemá, `uploadSettle.ts:427-429`, ale `DT/queue/queueRowStates.test.ts` „is disabled on a duplicate, whatever the row says of its metadata" to pripína; zachovať stojí jednu vlastnosť) |
| RD16 | Vlastné polia: podľa ktorého ext systému | vlastnosť `extSystem` | aktuálny ext system aplikácie | **rovnaké** (obal DAM podá aktuálny) |
| RD17 | Rozsah validácie polí riadku (kto ich zbiera) | symbol knižnice `anzu:common:asset-metadata-validation-scope`, `false` pre needitovateľný riadok (`UQIE:108-110`) | symbol DAM `anzu:asset-metadata-validation-scope` (`AQIE:103-105`) | **per strana: vlastnosť `validationScope`** (plán, krok 5.4: „validačný rozsah nastaví voľbou") |
| RD18 | Kľúčové slová a autori: či sú, či sú povinné | `useDamKeywordAssetTypeConfig(typ, extSystem)`, `useDamAuthorAssetTypeConfig` (`UQIE:182-192`) | `useKeywordAssetTypeConfig(typ)`, `useAuthorAssetTypeConfig` (`AQIE:192-197`) | **rovnaké** (obal podá aktuálny ext system; ten istý sklad konfigurácie) |
| RD19 | Kľúčové slová a autori, kým sa riadok nedá upravovať | štítok s chipmi, „+" skryté | vypnuté pole, „+" vypnuté | **per strana: vlastnosť `disabledFieldsAs`** (`'chips' \| 'input'`), podá sa obom výberom (AK3) |
| RD20 | Prepínač „Jednorazová licencia" | len pri `mainFileSingleUseEnabled` (`UQIE:441-452`) | vždy (`AQIE:495-505`) | **per strana: vlastnosť `mainFileSingleUseEnabled`** (už je; obal DAM podá `true`) |
| RD21 | Čo riadok oznámi pri „Obnoviť" | `{ index, assetId }` (`UQIE:63,177`) | `{ index, assetId, item }` (`AQIE:57,138`) | **rovnaké** navonok: riadok knižnice ostáva, obal admin-dam doplní `item` |
| RD22 | „Zrušiť": meno kľúča fronty v udalosti | `queueKey` | `queueId` | **rovnaké** navonok: obal DAM udalosť podá ďalej s `queueId` ako dnes |
| RD23 | Kopírovanie ID, `aria-label` obnovenia a zrušenia, `:key` formulára pri zmene validácie | rovnaké (DAM od kroku 1) | | **rovnaké** |
| RD24 | Kôš v admin-dam odoberie prvý riadok s tým assetom (nález 38) | — | `AQIE:172`, `AssetQueueEditable.vue:60-62` | **vlastný kód** admin-dam (nález 38 v denníku): ostáva v obale DAM; oprava rozhodnutá 9. 10., po U5c v obale (4.5) |

### 1.2 Zoznam fronty

LIB `L/uploadQueue/components/UploadQueueEditable.vue` (157), DAM `D/asset/components/queue/AssetQueueEditable.vue` (114).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| ZN1 | Rozloženie (`asset-queue-editable`, `--sidebar-active`, `__left`, `__sidebar border-s`), karty v poradí fronty | `:113-156` | `:79-114` | **rovnaké** |
| ZN2 | Od koľkých riadkov je vedľa zoznamu sidebar hromadných operácií | 1 (`:148`, zámerne `fb48599a`) | 2 (`:108`, `b8294a50`) | **per strana: vlastnosť `massOperationsFrom`** |
| ZN3 | Posun zoznamu šípkami hore a dole, PgUp/PgDn, Home/End | áno, poslucháč na `document` (`:57-103`, `2c814dab`) | nie; admin-dam vypína klávesy zoznamu assetov, kým je prekrytie otvorené | **per strana: vlastnosť `keyboardScroll`**. Chyba v obsluhe knižnice (berie klávesy aj pri písaní v poli riadku, K-13) sa v U4 nezbližuje ani neopravuje: oprava PK3 (nález 46) je schválená, samostatný krok po U4 (4.5) |
| ZN4 | Pravý okraj oblasti s kartami (`mr-md-4`, bez obrysu) | `:120-121` | nie (`:86`) | **zblížené → ZK5** |
| ZN5 | „Obnoviť": jedno naraz, všetky tlačidlá vypnuté | `L/uploadQueue/composables/uploadQueueItemRefresh.ts` | vložené `:26-50` | **rovnaké** |
| ZN6 | Upozornenia po „Obnoviť" („stále sa nahráva alebo spracúva", „nepodarilo sa") | kľúče knižnice; „skončil" zahŕňa aj riadok, ktorý medzitým odišiel z fronty | tie isté kľúče; riadok, ktorý už nie je v zozname, sa vôbec nepýta | **zblížené → ZK6** |
| ZN7 | Kto sa pýta servera pri „Obnoviť" | `refreshAsset(assetId)` | `refreshQueueItem(riadok)` | **per strana: väzba `queue.refresh`** |
| ZN8 | „Zrušiť" | `stopItemUpload(kľúč, riadok, index)` (`:44-46`) | `stopItemUpload(kľúč, riadok)` (`:56-58`) | **per strana: väzba `queue.cancel`** (po K6 jadra ten istý význam) |
| ZN9 | Odstránenie riadku | `removeByIndex` (`:48-50`) | cez zmazanie assetu v riadku, `removeByAssetId` (`:60-62`) | **per strana: väzba `queue.remove` a slot `remove` riadku** |
| ZN10 | Otvorenie detailu | prepošle `showDetail` dialógu (`:28-30,141`) | robí riadok | **per strana: slot `edit` riadku** (dialóg knižnice ďalej počúva `showDetail`) |
| ZN11 | Načítanie mien kľúčových slov a autorov pri otvorení | cache knižnice (`:94-100`) | cache DAM (`:64-76`) | **per strana: väzba `queue.prime`** (po U2 je to jedna cache; väzba preto, lebo testy DAM nahrádzajú cache podľa cesty) |
| ZN12 | Upozornenia, kto ich volá | `useAlerts` knižnice | `useAlerts` z balíka v kóde DAM (testy ho nahrádzajú na vstupe balíka, `DT/queue/queueRefresh.test.ts:32-35`) | **per strana: väzba `queue.warn`** |
| ZN13 | Ktorý sidebar sa vykreslí | sidebar knižnice | sidebar DAM | **per strana: slot `sidebar`** (predvolene sidebar knižnice) |

### 1.3 Hromadné operácie

Sidebar: LIB `L/uploadQueue/components/AssetQueueSelectedSidebar.vue` (314), DAM
`D/asset/components/queue/AssetQueueSelectedSidebar.vue` (363). Formulár: LIB
`L/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue` (107), DAM
`D/shared/components/customMetadata/AssetCustomMetadataFormMassOperations.vue` (107).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| HO1 | Záložka, popis, panel „Hlavné", polia 286 px, ikony vyplnenia a nahradenia, tri tlačidlá dole, ktoré panely sú otvorené | rovnaké (podklad 5, B.3) | | **rovnaké** |
| HO2 | Texty: SK zhodné; EN `description`, `general`, `fillOneEmpty`, `fillAllEmpty`, `replaceOne`, `clearForm` iné | kľúče `common.damImage.asset.massOperations.*` | `coreDam.asset.massOperations.*` | **rozhodnuté (R10)** |
| HO3 | Panely typov assetov | len Obrázok, keď je vo fronte (`:269-284`) | Obrázok, Video, Audio, Dokument, každý keď je vo fronte (`:275-329`) | **zblížené → ZK7** |
| HO4 | Do ktorých riadkov ide kľúčové slovo a autor | do každého | len do riadkov typu, ktorý ich má zapnuté | **per strana: väzba `operations.fillKeywords`, `fillAuthors`** (jadro C49, `accepts`) |
| HO5 | Kto zapisuje do riadkov | composable knižnice nad jej skladom | akcie skladu DAM (`:37-89`) | **per strana: väzba `operations`** |
| HO6 | Ext system polí | vlastnosť | aktuálny | **rovnaké** (obal podá) |
| HO7 | „Vyčistiť": výber kľúčových slov a autorov | vymaže len zapnuté (`:102-106`) | vymaže vždy (`:108-111`) | **zblížené → ZK8** |
| HO8 | Prístupné mená ikonových tlačidiel pri poli | sú, bez názvu poľa | sú (od kroku 1), bez názvu poľa | **rozhodnuté (prvá sada, bod 7)**: názov poľa v mene, na oboch stranách naraz, krok U8 |
| HO9 | Formulár hromadných operácií: model a ext system | vlastnosť a udalosť, vlastnosť `extSystem` | `defineModel`, aktuálny | **rovnaké** |
| HO10 | „Nahradiť vo všetkých" s prázdnym výberom vymaže kľúčové slová a autorov; jednotlivé „nahradiť" nedotknutého vlastného poľa zapíše `undefined` do každého riadku typu | áno, oboje (`AssetQueueSelectedSidebar.vue:22,39-41`, `uploadQueueMassOperations.ts:17-21`; overené J-14, nepripnuté) | áno, oboje (`DT/queue/massOperationsRows.test.ts:192,315`) | **rovnaké**: želaný stav (PV15 jadra, vlastník 9. 10.; nálezy 34, 41) |
| HO11 | Je sidebar pri otvorení rozbalený | hostiteľ: `false` na celé sedenie (`useUploadQueueDialog.ts:5`) | hostiteľ: `!mobile`, hromadná úprava `true` | **vlastný kód** hostiteľov |

### 1.4 Tlačidlo zastavenia

LIB `L/uploadQueue/components/UploadQueueButtonStop.vue` (91), DAM `D/asset/components/footer/AssetFooterUploadButtonStop.vue` (92).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| ST1 | Bez otázky, keď sa nič neposiela; inak otázka; Esc ju zruší; `aria-label`; `data-cy` | áno | áno (meno a Esc od kroku 1) | **rovnaké** |
| ST2 | Text otázky; SK zhodný | EN „Do you want to stop the upload?" | EN „Are you sure you want to stop the upload?" | **rozhodnuté (R10)** |
| ST3 | Nepoužitá vlastnosť `dialogMaxWidth` | nie je | `:9,14` | **zblížené → ZK9** |
| ST4 | Potvrdzovacie tlačidlo aj krížik sa volajú „Zatvoriť" (nález 43) | áno | áno | **rovnaké**; nález 43 rozhodnutý 9. 10.: potvrdzovacie tlačidlo „Zastaviť" (EN „Stop"), jedna zmena v spoločnom tlačidle po U5a (4.5, 6.2) |

### 1.5 Formulár vlastných metadát

LIB `L/assetDetail/components/AssetCustomMetadataForm.vue` (72), DAM `D/shared/components/customMetadata/AssetCustomMetadataForm.vue` (67).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| FM1 | Polia typu assetu, pripnuté nad „Zobraziť viac", sloty pred a za pripnutými, `anyChange` | áno | áno | **rovnaké** |
| FM2 | Koľko polí je pripnutých, keď ext system pre typ číslo nemá | 2 (`:49-51`; krok 1 ponechal) | 0 (`:44-46`) | **zblížené → ZK27** (backend číslo vždy pošle, v bežnom toku sa záloha neuplatní) |
| FM3 | Ext system | vlastnosť | aktuálny | **rovnaké** |
| FM4 | Predvolený rozsah validácie | symbol knižnice | symbol DAM; DAM ho na detaile spolieha na predvolený (`D/asset/components/AssetMetadata.vue:102-106`) | **per strana: vlastnosť `validationScope`** (už je; admin-dam ju podá výslovne na oboch miestach) |
| FM5 | Hodnoty len na čítanie (`readonly`) | áno (výber assetu) | nie | **vlastný kód** knižnice (admin-dam ho nepodá) |
| FM6 | Text chyby bez nastaveného ext systému (len konzola) | s menom komponentu (`:46`) | bez (`:41`) | **zblížené → ZK10** |

### 1.6 Obrázok assetu, ikony, chip dôvodu

LIB `L/assetDetail/components/AssetImage.vue` (325), `AssetImageMetaIcons.vue` (109), `AssetFileFailReasonChip.vue` (24),
`L/assetDetail/composables/assetFileFailReason.ts`; DAM `D/asset/components/AssetImage.vue` (316), `AssetImageMetaIcons.vue` (120),
`assetImageIconsConfig.ts` (47), `AssetFileFailReasonChip.vue` (25), `D/asset/valueObject/AssetFileFailReason.ts` (44).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| OB1 | `AssetImage`: 23 vlastností, štyri vetvy, animácia „Hotovo", texty stavov (SK aj EN zhodné) | áno | áno | **rovnaké** |
| OB2 | Zástupný obrázok počas nahrávania | SVG 1 KB (`:4`, `e1479025`) | JPEG 58 KB, ten istý obrázok (`:7`) | **zblížené → ZK11** |
| OB3 | Ikona TTS pri syntetickom audiu (dlaždice a tabuľka assetov) | nie je | `AssetImageMetaIcons.vue:77-80`; e2e `DAM/e2e/pages/assets/assetTtsPage.ts:13,41` žiada presný titulok „Syntetické (TTS)" | **per strana: vlastnosť `showTts`** (predvolene `false`; backend `ttsAudio` posiela aj iným adminom, podklad 7, pár 2) |
| OB4 | Ostatné ikony (sloty, RSS, rozlíšenie, distribúcie) a ich poradie | iný zápis cyklov a stráží | | **rovnaké** (výsledok zhodný, podklad 7) |
| OB5 | Chip dôvodu zlyhania: šesť dôvodov, SK zhodné | áno | áno | **rovnaké** |
| OB6 | EN text dôvodu `invalidMimeType` | „Invalid file type" | „Invalid mime type" | **rozhodnuté (R10)** |
| OB7 | Dôvod, pre ktorý chip nemá text: neukáže nič (nález 42) | rovnako | rovnako | **rovnaké** (nález 42 v denníku; vlastník 9. 10. zavrel bez zmeny: backend iný dôvod neposiela) |

### 1.7 Autori a kľúčové slová

Skratky ako v podklade 6: KA, AA = výbery `…RemoteAutocompleteWithCached.vue`, KC, AC, ACC = chipy, ACB =
`AuthorCreateButton.vue`; LIB pod `L/keyword/`, `L/author/`, DAM pod `D/keyword/`, `D/author/`.

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| AK1 | Vyhľadanie od 2 znakov, chipy, „+ meno", Enter, čiarka, konflikty autorov, `data-cy` | rovnaké (podklad 6, A.1, A.3) | | **rovnaké** |
| AK2 | Kto smie vytvoriť kľúčové slovo alebo autora | každý | len s `dam_keyword_create` / `dam_author_create` (`D/KA:128-143`, `D/AA:127-139,225`) | **per strana: konfigurácia `keywordCreateAcl`, `authorCreateAcl`** (ako `roiUpdateAcl`) |
| AK3 | Vzhľad, kým sa pole nedá upravovať | štítok s chipmi, „+" skryté, bez `data-cy` (`L/KA:164-187`, `L/AA:152-175,251`) | vypnuté pole, „+" vypnuté (`D/KA:167`, `D/AA:223-233`) | **per strana: vlastnosť `disabledAs`** (`'chips' \| 'input'`); ako sa pole v režime `'input'` vypne, je **ZK12** |
| AK4 | Ext system a klient | vlastnosť, klient z konfigurácie | aktuálny, `damClient` | **rovnaké** (tie isté požiadavky, podklad 6, K1, K3) |
| AK5 | Chip: ako číta meno | živo, `useCachedItem` (`L/KC:33`) | západka: prvé načítané navždy (`D/KC:33-70`) | **zblížené → ZK13** |
| AK6 | Chip: bublina pri `#id` neznámeho mena | `VTooltip` (`L/KC:81-87`) | atribút `title` (`D/KC:97`) | **zblížené → ZK14** |
| AK7 | Chip: ikona „nové" podľa návrhov fronty | sklad knižnice (`L/KC:31,39`) | sklad DAM | **per strana: injekcia `UploadQueueSuggestionsKey`** (predvolene sklad knižnice) |
| AK8 | Chip: prázdny obsah | „-" | „ - " | **zblížené → ZK15** |
| AK9 | Autorov chip „schválený": odkiaľ | z ustáleného (`L/AC:57`) | zo živého (`D/AC:64`) | **zblížené** (súčasť ZK13) |
| AK10 | Režim jednej hodnoty | je | odstránený | **rovnaké** navonok: všetci volajúci dávajú `multiple` |
| AK11 | Filter vnútorného hľadania autora | text | text a prázdne `canBeCurrentAuthor` | **zblížené → ZK16** |
| AK12 | Tlačidlo „nový autor": udalosť | `success` | `onSuccess` | **rovnaké** (meno; `AuthorListView` prejde na `@success`) |
| AK13 | Presmerovanie po vytvorení autora | nie je | ak volajúci nepovie inak; obaja hovoria (`D/ACB:67,87-89`) | **zblížené → ZK17** |
| AK14 | Prístupné meno ikonového tlačidla „nový autor" | `aria-label` (`L/ACB:132-150`) | len bublina (`D/ACB:116-133`) | **zblížené → ZK18** |
| AK15 | Nadpis dialógu „nový autor"; SK zhodný | EN „Creating author" | EN „Create author" | **rozhodnuté (R10)** |
| AK16 | Predvolený rozsah validácie dialógu | `anzu:common:author-create-validation-scope` | `anzu:author-create-validation-scope` | **zblížené → ZK19** |
| AK17 | Cache mien: koľko inštancií, podľa ktorého ext systému | `cachedExtSystemId` (zapisujú widgety a výber assetu) | vlastná, aktuálny ext system | **zblížené → ZK20** |
| AK18 | Konfigurácie typu (zapnuté, povinné): `?? false` proti `!!` | | | **rovnaké** (rovnaký výsledok) |
| AK19 | Stlačený chip konfliktu zmizne, konflikt ostane (nález 44) | rovnako | rovnako | **rovnaké**; nález 44 rozhodnutý 9. 10.: oprava v spoločnom výbere autora po U1 (4.5) |
| AK20 | Konflikty autorov pri hromadnej úprave bez mien (nález 40) | — | sklad DAM | **vlastný kód** admin-dam (nález 40 v denníku); sklad, nie komponent; oprava rozhodnutá 9. 10., po K6 jadra |
| AK21 | `KeywordCreateButton` (stránka kľúčových slov) | nie je | je | **vlastný kód** DAM |

### 1.8 Výber súborov a ťahanie

LIB `L-ui/composables/formatAndSizeCheck.ts`, `L-ui/composables/dropzone.ts`; DAM `D/shared/components/FileUpload.vue`,
`D/shared/services/upload/fileValidation.ts` (59), `D/asset/composables/windowFilesDragWatcher.ts` (59).

| # | Čo používateľ vidí alebo robí | LIB dnes | DAM dnes | Verdikt |
|---|---|---|---|---|
| SB1 | Pravidlá formátu a veľkosti (vrátane limitu „rovná sa") | áno | áno | **rovnaké** |
| SB2 | Zoznam typov s medzerami alebo veľkými písmenami | oreže a zmenší (`:16-23`) | nie (`FileUpload.vue:222-227`) | **zblížené → ZK21** |
| SB3 | Upozornenie „Nesprávny formát alebo veľkosť: …" | kľúč knižnice | kľúč DAM (`FileUpload.vue:245-248`) | **vlastný kód** DAM: `FileUpload` ostáva v DAM a ukáže svoje upozornenie (kontrola knižnice s `disableAlert`) |
| SB4 | Stav „ťahá sa súbor nad oknom" | áno | áno, rovnaký | **rovnaké** |
| SB5 | Kto zapne poslucháčov ťahania | aplikácia výslovne `initGlobalDragState()` | pri prvom použití | **zblížené → ZK22** |
| SB6 | Celookenná zóna s textom DAM, prechádzanie priečinkov, tri varianty tlačidla | — | `FileUpload.vue` | **vlastný kód** DAM |
| SB7 | Dialóg nad limitom 50 | `ImageWidgetMultipleLimitDialog.vue` | v `AssetUpload.vue:149-187` | **vlastný kód** každej strany |

### 1.9 Obaly, ktoré ostávajú na svojej strane

Podklad 5, B.6. LIB `L/uploadQueue/components/UploadQueueDialog.vue`, DAM `D/asset/components/footer/AssetFooterUploadOverlayFull.vue`
a ďalšie prekrytia. Spoločné z nich sú len komponenty pod nimi (1.2 až 1.4).

| # | Čo | LIB | DAM | Verdikt |
|---|---|---|---|---|
| OL1 | Kto vlastní dialóg na celú obrazovku | dialóg sám | obal aplikácie | **vlastný kód** |
| OL2 | Hlavné tlačidlo | „Uložiť a použiť" (odovzdá obrázky widgetu) | „Uložiť a ukončiť" (vyčistí frontu, načíta zoznam) | **vlastný kód** |
| OL3 | Právo na uloženie, minimalizácia, zatvorenie, „+", obnovenie zoznamu | podľa knižnice | podľa DAM | **vlastný kód** |
| OL4 | Plávajúce panely, panel slotov, pás výberu, import externých | — | DAM | **vlastný kód** |
| OL5 | Dialóg jedného súboru | knižnica | — | **vlastný kód** (časť 5) |
| OL6 | Súbory pustené na otvorený dialóg | od kroku 1 tou istou cestou ako výber (R9) | vlastná zóna | **rozhodnuté (R9)**, hotové |
| OL7 | Zlyhané uloženie nič nepovie (nálezy 29, 39) | áno | áno | **vlastný kód** obalov; opravy rozhodnuté 9. 10., samostatne pred krokom 5 (mimo tohto návrhu) |
| OL8 | Pozícia pri „uložiť a použiť" galérie (nález 31) | dialóg aj widget zvýšia `maxPosition` | — | **vlastný kód** knižnice; nález 31 rozhodnutý 9. 10.: pozíciu prideľuje len widget, oprava po U7 (4.5) |
| OL9 | Odtieň ikon, posuv panela (podklad 5, D8, D9) | | | **vlastný kód** (každý obal svoj) |

### 1.10 Detail assetu a dialóg jedného súboru v knižnici (štyri dvojice)

Porovnanie, ktoré plán žiada pred krokom 5.5. Dvojice: (1) `L/assetDetail/components/AssetDetailDialog.vue` (240,
ďalej `ADD`) ↔ `L/uploadQueue/components/UploadQueueDialogSingle.vue` (506, `UQDS`); (2) `AssetDetailDialogSidebar.vue`
(131, `ADDS`) ↔ `UploadQueueDialogSingleSidebar.vue` (178, `UQDSS`); (3) `AssetDetailSidebarMetadata.vue` (90, `ADSM`) ↔
`UploadQueueDialogSingleSidebarMetadata.vue` (106, `UQDSM`); (4) `AssetMetadata.vue` (273, `AM`) ↔
`UploadQueueDialogSingleSidebarMetadataContent.vue` (247, `UQDSMC`). Obe obrazovky sú knižnice; produktový rozdiel
medzi nimi (iná obrazovka) ostáva **per adaptér**.

| # | Čo používateľ vidí alebo robí | Detail | Dialóg jedného súboru | Verdikt |
|---|---|---|---|---|
| JS1 | Dialóg na celú obrazovku, `eager`, karta `dam-image-detail`, panel 64 px, prepínač sidebaru | `ADD:118-188` | `UQDS:326-396` | **rovnaké** → rámec |
| JS2 | Kedy sa ukáže načítavanie | `loading` (`ADD:123-126`) | `loading \|\| !item` (`UQDS:331-334`; nekonečné nad prázdnou frontou, nález 30; oprava vo widgete po U7, 4.5) | **per adaptér** (`loading` rámca) |
| JS3 | Nadpis | „Zdrojový systém: {názov}" (`ADD:139-141`) | „Nahrávanie" / zelené „Nahrávanie ukončené" (`UQDS:347-360`) | **per adaptér: slot `title`** |
| JS4 | Zatvorenie | ikonové „Zatvoriť", zavrie detail (`ADD:170-186,47-51`) | tlačidlo zastavenia: počas posielania sa pýta, zastaví frontu, vyčistí detail, zatvorí (`UQDS:389-394,219-223`) | **per adaptér: slot `toolbar-actions`** |
| JS5 | Pravý okraj skupiny tlačidiel | `pr-2` (`ADD:143`) | `pr-3` (`UQDS:362`) | **zblížené → ZK23** |
| JS6 | Kedy je vľavo editor oblasti záujmu | záložka „Fókus" alebo jednoduchý sidebar (`ADD:191-200`) | to isté, ale len s načítaným assetom (`UQDS:399-408`, `enableRoiTab`) | **per adaptér: `view.roiEditorTab`, `view.simpleMode`** |
| JS7 | Obrázok: zdroj, rozmery, farba pozadia | `mainFile.links.image_detail`, inak 356×200 a `#ccc` (`ADD:86-106`) | náhľad riadku, rozmery náhľadu, farba z `mainFile` (`UQDS:157-177`) | **per adaptér: `view.image`** |
| JS8 | Obrázok: stavy uploadu, percentá, pomer 16:9 | nie | áno (`UQDS:414-430`) | **per adaptér: `view.image`** |
| JS9 | Obal `position-relative` okolo obrázka | nie: obrázok je priamo flex prvkom (`ADD:205-215`) | áno, pre prekrytie chyby (`UQDS:413`) | **per adaptér**: rámec dá obal len vtedy, keď dostane slot `image-overlay` (dialóg); detail ostane flex prvkom ako dnes |
| JS10 | Prekrytie chyby nad obrázkom | nie | áno, ako riadok (`UQDS:431-461`) | **per adaptér: slot `image-overlay`** |
| JS11 | Prázdne obsluhy `@load`, `@error` | `ADD:59-61,213-214` | nie | **zblížené → ZK25** |
| JS12 | Odkiaľ sú typ, stav a súbor assetu | detailový sklad | vymyslený `AssetDetailItemDto` (asi 25 výplňových polí, `UQDS:82-127`) do dokončenia, potom detailový sklad | **rozhodnuté (R16)**: adaptér z riadku, vymyslený asset zanikne |
| JS13 | Načítanie assetu po dokončení, potom záložka „Fókus" | — | `UQDS:305-318` | **vlastný kód** dialógu |
| JS14 | Záložka pri otvorení | ostane, aká bola | nastaví „Info" (`UQDS:320-322`) | **vlastný kód** dialógu |
| JS15 | Záložka „Fókus" v sidebare | pri obrázku (`ADDS:68-74`) | pri obrázku s načítaným assetom (`UQDSS:109-115`) | **per adaptér: `view.roiTab`** |
| JS16 | Jednoduchý sidebar (UGC, `simpleAssetSidebar`) | pri obrázku (`ADDS:47`) | pri obrázku s načítaným assetom (`UQDSS:58`) | **per adaptér: `view.simpleMode`** |
| JS17 | Nad obsahom sidebaru | `AssetInfobox`: stav assetu, súboru, dôvod (`ADDS:78-82`) | slot: oznam duplikátu, „Jednorazová licencia" originálu (`UQDS:486-499`) | **per adaptér: slot `prepend`** |
| JS18 | Obsah záložky „Info" | `ADSM` | `UQDSM` | **per adaptér: slot `info`** |
| JS19 | Obsah „Fókus" a cieľ teleportu tlačidiel | `ADDS:93-128` | `UQDSS:135-175` | **rovnaké** → rámec sidebaru |
| JS20 | „Obnoviť" po 20 s spracovania alebo čakania na metadáta | — | `UQDSS:60-88` | **vlastný kód** dialógu |
| JS21 | „Obnoviť" pri zlyhanej položke (nález 25) | — | neponúka | **rozhodnuté (nález 25, 9. 10.)**: dialóg dostane pravidlo riadku, oprava po U6 (4.5) |
| JS22 | Nepoužité vlastnosti sidebarov (`assetId`, `isVideo`, `isAudio`, `isDocument`, `dataCy`; v dialógu aj `assetStatus`, `assetMainFile*`, `showFileInfo`) | | | **rovnaké**: ostávajú (testy ich podávajú, `LT/uploadQueueDialogSingle.test.ts:172-186`) |
| JS23 | Tlačidlá ukladania | jedno „Uložiť" s točením; uloží asset, zapíše do fronty (`ADSM:48-68`) | „Obnoviť", „Uložiť", „Uložiť a použiť", vypnuté bez metadát; ukladá dialóg hromadne (`UQDSM:70-100`, `UQDS:253-303`) | **vlastný kód** každej obrazovky |
| JS24 | Validácia pred uložením | `$stopPropagation: true` (`ADSM:44`) | bez (`UQDSM:46`) | **vlastný kód** |
| JS25 | Obsah: zdroj údajov | asset detailu (`AM:49`) | riadok fronty (`UQDSMC:44-50`) | **per adaptér** (ostávajú dva komponenty obsahu) |
| JS26 | Obsah: tlačidlo „upraviť v DAM", len na čítanie, typ assetu | voliteľné tlačidlo, `readonly`, typ z assetu | nie, `VForm` vypnutý bez metadát, vždy obrázok | **vlastný kód** |
| JS27 | Panel „Info o súbore": kedy | pri `showFileInfoEnabled` (`AM:189-194`) | aj len s načítaným assetom (`UQDSMC:174-179`) | **per adaptér** (`AssetFileInfoPanel` dostane asset) |
| JS28 | Panel „Info o súbore": kto vytvoril a zmenil | chip používateľa (`AM:222-237`) | nie | **per adaptér: vlastnosť `showUsers`** |
| JS29 | Panel „Info o súbore": zalamovanie | `overflow-wrap: normal` (`AM:195-198`), ruší `break-word` karty | `break-word` zdedené z karty (`UQDSMC:180`, `VCard.css:5`) | **per adaptér**: `AM` podá `AssetFileInfoPanel` `style="overflow-wrap: normal"`, dialóg nič (ZK26 vypustené) |
| JS30 | Polia formulára: `data-cy`, `@update:model-value`, rozsah validácie | rovnaké | | **rovnaké** |
| JS31 | Editor oblasti záujmu len na čítanie, keď používateľ nemá právo `roiUpdateAcl` (predvolene `dam_regionOfInterest_update` pre `/adm/v1/roi`, v UGC žiadne) | `ADD:43-45,198` | `UQDS:212-216,406` (rovnaký kód) | **rovnaké** → rámec: počíta `roiEditable` a dá `:readonly="!roiEditable"`; `DamAssetImageRoiSelectLazy` bez tejto vlastnosti by bol upraviteľný (`L/cropper/components/DamAssetImageRoiSelectLazy.vue:7-16`) |

### 1.11 Objekt obrázka pre CMS (`ImageCreateUpdateAware`), deväť miest

Všade rovnaká kostra: `texts`, `flags` (`internal` a `overrideInternal` vždy `false`), `dam` (`regionPosition` 0,
`internal` z `mainFileInternal` alebo `false`). Líši sa len to, čo funkcia dostane (súbor, licencia, texty, `showSource`,
pozícia, `id`), takže pri každom mieste je verdikt **rovnaké**: jedna funkcia dá presne dnešný objekt.

| # | Miesto | Odkiaľ | `showSource` | pozícia | `id` | Verdikt |
|---|---|---|---|---|---|---|
| IM1 | `L/imageWidget/utils/metadataToImageMap.ts:79-97` | riadok fronty a hromadná odpoveď; `+ authorIds, assetId` | `true` | nie | nie | **rovnaké** |
| IM2 | `L/imageWidget/components/ImageWidgetInner.vue:473-494` | vybraný asset | `true` | 1 | ak je model | **rovnaké** |
| IM3 | `L/imageWidget/components/ImageMediaWidgetInner.vue:587-608` | vybraný asset | `true` | 1 | ak je model | **rovnaké** |
| IM4 | `L/imageWidget/components/ImageWidgetMultipleInner.vue:293-315` | vybraný asset, vlastné mapovanie aplikácie; `+ key, damAuthors [], showDamAuthors false, assetId` | `true` | `maxPosition` | nie | **rovnaké** |
| IM5 | `ImageWidgetMultipleInner.vue:325-347` | vybraný asset; `+ key, damAuthors, showDamAuthors, assetId` | `true` | `maxPosition` | nie | **rovnaké** |
| IM6 | `ImageWidgetMultipleInner.vue:545-555` (`createImageStoreItem`, editor ho nevolá) | prázdny | `true` | 0 | nie | **rovnaké** |
| IM7 | `L/imageWidget/components/ImageDetailDialogMetadata.vue:75-93` (náhľad obrázka média) | `damMedia.imageFileId` | `false` | nie | nie | **rovnaké** |
| IM8 | `L/imageWidget/components/AImagePublicInput.vue:114-134` (uloženie; texty orezané) | asset podľa id | `true` | 0 | ak je uložený obrázok | **rovnaké** |
| IM9 | `AImagePublicInput.vue:148-165` (len adresa náhľadu) | zadané id, licencia 0 | `true` | nie | nie | **rovnaké** |
| IM10 | Do API obrázkov idú aj `authorIds` a `assetId` z mapovania uploadu; dialóg jedného súboru pošle `mainFileSingleUse: false` za prázdny riadok (nález 36) | | | | | **rozhodnuté (nález 36, 9. 10.)**: U7 a `createDamImage` to nemenia; mapovanie vracia ďalej `UploadMetadataToImageMapItem`; oprava po U7 (4.5) |
| IM11 | `ImageMediaWidgetInner` pri vybranom assete nečíta `customAssetSelectMetadataToImageMap`, `ImageWidgetInner` áno (`ImageWidgetInner.vue:446-449` proti `ImageMediaWidgetInner.vue:565-583`) | | | | | **vlastný kód** knižnice (nový nález N1, v denníku nález 45; dnes ho žiadna aplikácia nedosiahne); oprava rozhodnutá 9. 10., po U7 (4.5) |

---

## 2. Cieľové komponenty a rozhrania

### 2.1 Rozloženie v LIB

| Súbor | Nový / zmenený | Čo | Vyvezený |
|---|---|---|---|
| `L/uploadQueue/components/uploadQueueBindings.ts` | nový | typy väzieb, `UploadQueueSuggestionsKey`, predvolené väzby knižnice | typy a kľúč áno, predvolené väzby nie |
| `L/uploadQueue/components/UploadQueueItemErrorOverlay.vue` | nový | prekrytie chyby (RD2), riadok a dialóg jedného súboru | nie |
| (žiadny nový súbor pre „Obnoviť" riadku) | — | watcher knižnice ostáva v riadku bez zmeny; riadok dostane len vlastnosť `refreshOffered` (2.2) | — |
| `L/uploadQueue/composables/uploadQueueItemRefresh.ts` | zmenený | jadro „Obnoviť" nad väzbou + dnešné `useUploadQueueItemRefresh` | nie |
| `L/uploadQueue/components/UploadQueueItemEditable.vue` | zmenený | sloty a vlastnosti (2.2) | áno, `ADamUploadQueueItem` |
| `L/uploadQueue/components/UploadQueueEditable.vue` | zmenený | väzba, sloty, vlastnosti (2.3) | áno, `ADamUploadQueueList` |
| `L/uploadQueue/components/AssetQueueSelectedSidebar.vue` | zmenený | väzba, štyri panely (2.4) | áno, `ADamUploadQueueMassOperations` |
| `L/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue` | zmenený len v U8 | názov poľa v prístupnom mene | áno |
| `L/uploadQueue/components/UploadQueueButtonStop.vue` | bez zmeny | | áno, `ADamUploadQueueStopButton` |
| `L/assetDetail/components/AssetCustomMetadataForm.vue` | bez zmeny (záloha 2 platí po ZK27 aj v admin-dam) | | áno |
| `L/assetDetail/components/AssetImage.vue`, `AssetImageMetaIcons.vue`, `utils/assetImageIconsConfig.ts`, `src/assets/dam-meta-icons/tts.svg` | zmenené, nový | `showTts` | áno (dva komponenty) |
| `L/assetDetail/components/AssetFileFailReasonChip.vue`, `composables/assetFileFailReason.ts` | bez zmeny | | áno |
| `L/keyword/components/KeywordRemoteAutocompleteWithCached.vue`, `L/author/components/AuthorRemoteAutocompleteWithCached.vue` | zmenené | `disabledAs`, brána vytvorenia | áno |
| `L/keyword/components/…CachedKeywordChip.vue`, `L/author/components/…CachedAuthorChip.vue` | zmenené | injekcia návrhov, sklad lenivo | autor áno |
| `L/author/components/AuthorCreateButton.vue`, `…ChipConflicts.vue` | bez zmeny | | tlačidlo áno |
| `L/author/composables/cachedAuthors.ts`, `L/keyword/composables/cachedKeywords.ts`, `L/composables/extSystemIdForCached.ts`, `damAuthorConfig.ts`, `damKeywordConfig.ts` | bez zmeny | | áno |
| `L-ui/composables/formatAndSizeCheck.ts` | bez zmeny | | áno |
| `L/assetDetail/composables/assetDetailView.ts` | nový | `AssetDetailView` a dva adaptéry (2.8) | nie |
| `L/assetDetail/components/AssetDetailDialogFrame.vue`, `AssetDetailSidebarFrame.vue`, `AssetFileInfoPanel.vue` | nové | rámec a panel (2.8) | nie |
| `L/assetDetail/components/AssetDetailDialog.vue`, `AssetDetailDialogSidebar.vue`, `AssetMetadata.vue`; `L/uploadQueue/components/UploadQueueDialogSingle*.vue` (4) | zmenené | na rámci (2.8) | nie |
| `L/imageWidget/utils/damImage.ts` | nový | `createDamImage` (2.9) | nie |
| `src/AnzuSystemsCommonAdmin.ts`, `L/composables/commonAdminCoreDamOptions.ts` | zmenené | dva kľúče konfigurácie (2.12) | typ áno |
| `L/types/Asset.ts` | zmenený | `AssetFileProperties.ttsAudio?: boolean` | áno (typ už je) |
| `src/locales/{sk,en,cs}/common/damImage.json` | zmenené | `asset.metaIcons.tts`; v U8 mená s poľom | — |
| `src/lib.ts` | zmenený | len pribúdajú (2.11) | — |

Mená súborov sa nemenia: testy knižnice ich importujú podľa cesty a nahrádzajú podľa mena (`AssetImage`,
`UploadQueueDialogSingleSidebar`, `AssetQueueSelectedSidebar`, `AFormRemoteAutocompleteWithCached`, …; podklad 6,
riziko 7; `lib-vlna4.md`, „Stand-ins used"). Von idú pod menami s `A` (`LS/publicExportsAdded.test.ts:54-74`).

### 2.2 Riadok (`ADamUploadQueueItem`)

```ts
// L/uploadQueue/components/UploadQueueItemEditable.vue — props: today's, and seven new ones with today's library values
defineProps<{
  index: number
  queueKey: UploadQueueKey
  extSystem: IntegerId
  customData: AssetCustomData            // v-model
  keywords: DocId[]                      // v-model
  authors: DocId[]                       // v-model
  mainFileSingleUse: boolean | null      // v-model
  item: UploadQueueItem
  refreshDisabled: boolean
  mainFileSingleUseEnabled?: boolean     // true
  disableDoneAnimation?: boolean         // false
  refreshMayHelp?: boolean               // false
  /** Where "cancel" is offered. admin-dam adds Processing and Failed. */
  cancelStatuses?: readonly UploadQueueItemStatusType[]   // [Loading, Waiting, Uploading]
  /** The line "The main file is a duplicate." under the title. */
  duplicateNotice?: boolean              // true
  /** The form stays off on a duplicate whatever its metadata (admin-dam). */
  disableFormOnDuplicate?: boolean       // false
  /** The scope the fields of an editable row report to; a row that cannot be edited reports to none, as today. */
  validationScope?: ValidationScope      // ADamAssetMetadataValidationScopeSymbol
  /** How keywords and authors look while the row cannot be edited; handed to both inputs as `disabledAs`. */
  disabledFieldsAs?: 'chips' | 'input'   // 'chips'
  /** A duplicate gets no edit button at all: neither the `edit` slot nor its default is drawn (admin-dam). */
  hideEditOnDuplicate?: boolean          // false
  /**
   * Whether the row offers refresh, worked out by its host. Without it the row works it out itself, as today
   * (UQIE:156-235). admin-dam's wrapper hands in what its own watcher of today gives (AQIE:132-275, moved as is).
   */
  refreshOffered?: boolean | undefined   // undefined: the row's own rule — declared so in `withDefaults`, see rule 1
}>()

defineEmits<{
  (e: 'update:customData', data: AssetCustomData): void
  (e: 'update:keywords', data: DocId[]): void
  (e: 'update:authors', data: DocId[]): void
  (e: 'update:mainFileSingleUse', data: boolean | null): void
  (e: 'cancelItem', data: { index: number; item: UploadQueueItem; queueKey: UploadQueueKey }): void
  (e: 'removeItem', index: number): void          // only the default "remove" emits it
  (e: 'showDetail', assetId: DocId): void         // only the default "edit" emits it
  (e: 'refreshItem', data: { index: number; assetId: DocId }): void   // as today; admin-dam's wrapper adds `item`
}>()

defineSlots<{
  /** Over the picture, under the error overlay (admin-dam: the duplicate overlay with the link to the original). */
  'image-overlay'?(props: { item: UploadQueueItem }): unknown
  /** Left of the action line. Default: "Edit in Media Library", disabled without metadata, emits `showDetail`. */
  edit?(props: { item: UploadQueueItem }): unknown
  /** Last of the action line. Default: "Remove from queue" while it is offered, emits `removeItem`. */
  remove?(props: { item: UploadQueueItem; index: number; offered: boolean }): unknown
}>()
```

Pravidlá:

1. „Obnoviť" je `refreshOffered ?? vlastné pravidlo`. **Vo `withDefaults` musí byť výslovne `refreshOffered: undefined`:**
   Vue neprítomnú logickú vlastnosť bez deklarovaného predvoleného premení na `false` (`runtime-core.cjs.js:5117-5119`),
   a tento súbor dáva logickým vlastnostiam predvolené `false`; bez toho by v CMS a UGC „Obnoviť" nebolo nikdy a kôš len
   pri `Failed`. Vlastné pravidlo riadku je **dnešný kód knižnice bez zmeny**
   (`UQIE:156-235`: časovač pri `Uploading` a `Processing`, 20 s po `Uploaded` bez metadát, metadáta ho skryjú,
   `Failed` podľa `refreshMayHelp` a assetu). Žiadne spoločné pravidlo strán nevzniká: každý watcher je prepis kódu
   svojej strany, takže sa nedajú namiešať. `offered` slotu `remove` je `showRefresh || Failed` z toho istého
   výsledku, takže kôš knižnice ide s „Obnoviť" ako dnes.
1a. Tlačidlo úpravy: pri `hideEditOnDuplicate && item.isDuplicate` sa ľavá časť riadku vykreslí prázdna, bez slotu
   `edit` aj bez predvoleného obsahu (`<div>` riadku ostane, ako dnes v `AQIE:367-377`); inak slot `edit` alebo
   predvolené tlačidlo knižnice.
2. Prekrytie chyby je `UploadQueueItemErrorOverlay` (vlastnosť `error: UploadQueueItem['error']`), s dnešnými kľúčmi
   knižnice; slot `image-overlay` je pred ním, ako prekrytie duplikátu v DAM (`AQIE:304-359`).
3. Formulár: `VForm :disabled="!item.canEditMetadata || (disableFormOnDuplicate && item.isDuplicate)"`; `:key`
   ostáva; rozsah je `item.canEditMetadata ? validationScope : false`; výbery dostanú `:disabled-as="disabledFieldsAs"`.
4. Riadok sám nevolá API, sklad ani upozornenia; všetko také robí hostiteľ alebo obsah slotu.

**Obal DAM** (`D/asset/components/queue/AssetQueueItemEditable.vue`, asi 160 riadkov, dnešné vlastnosti a udalosti).
Watcher „Obnoviť" (`AQIE:132-275`: `SHOW_REFRESH_AFTER_SECONDS`, `showRefresh`, časovač, okamžitý watcher stavu,
watcher `canEditMetadata`, `onUnmounted`) sa presunie do obalu doslova; jeho `showRefresh` ide riadku ako
`refreshOffered`. Tým ostáva presne dnešné: chyba sa číta len pri zmene stavu a pri pripojení, upozornenie, ktoré
príde až na nahratý riadok, „Obnoviť" nezrýchli, a pri chybe ostane aj s metadátami.

```vue
<ADamUploadQueueItem v-bind="…dnešné vlastnosti…" :queue-key="queueId" :ext-system="currentExtSystemId"
  :cancel-statuses="CANCEL_STATUSES" :duplicate-notice="false" disable-form-on-duplicate
  :validation-scope="AssetMetadataValidationScopeSymbol" disabled-fields-as="input" hide-edit-on-duplicate
  :refresh-offered="showRefresh"
  @cancel-item="emit('cancelItem', { …$event, queueId })" @refresh-item="emit('refreshItem', { …$event, item })" …>
  <template #image-overlay="{ item }"><!-- AQIE:304-328, as is --></template>
  <template #edit="{ item }"><!-- AQIE:368-376 and showDetail AQIE:142-166, as is --></template>
  <template #remove="{ item }"><!-- AQIE:418-424 and remove AQIE:167-177, as is --></template>
</ADamUploadQueueItem>
```

Kód DAM, ktorý dnes robí riadok (detail cez dva sklady, `usePageNavigation`, `deleteAsset`, upozornenia), sa
presunie do obalu bez zmeny; testy, ktoré ho nahrádzajú podľa cesty, ho tam nájdu.

### 2.3 Zoznam (`ADamUploadQueueList`) a väzba `UploadQueueListBinding`

```ts
// L/uploadQueue/components/uploadQueueBindings.ts
/** What the list of a queue asks of its host. Without it the list works over the library's store, as today. */
export interface UploadQueueListBinding {
  items(): UploadQueueItem[]
  /** `queueKey` of the row's event; the library's default cancels in that queue, as before U4 (U4-c5). admin-dam may ignore it. */
  cancel(item: UploadQueueItem, index: number, queueKey: string): void
  /** For the library's default "remove from queue". */
  remove(index: number): void
  refresh(item: UploadQueueItem): Promise<UploadRefreshOutcome>
  refreshMayHelp(item: UploadQueueItem): boolean
  /** A warning of a refresh, through the host's own alerts. */
  warn(key: 'common.damImage.queueItem.stillUploadingOrProcessing' | 'common.damImage.queueItem.refreshFailed'): void
  /** Hands the keywords and authors of the rows to the name caches and asks for them, once when the list mounts. */
  prime(items: UploadQueueItem[]): void
  mainFileSingleUseEnabled: boolean
}

/** Today's list of the library: its store, its refresh, its caches, its alerts, its options. The key is read at each call (U4-c4). */
export function useLibraryUploadQueueListBinding(queueKey: MaybeRefOrGetter<UploadQueueKey>, configName: string): UploadQueueListBinding
```

```ts
// L/uploadQueue/components/UploadQueueEditable.vue
defineProps<{
  queueKey: UploadQueueKey
  extSystem: IntegerId
  massOperations: boolean
  configName?: string                    // 'default'
  disableDoneAnimation?: boolean         // false
  queue?: UploadQueueListBinding         // useLibraryUploadQueueListBinding(queueKey, configName), created only when absent
  massOperationsFrom?: number            // 1
  keyboardScroll?: boolean               // true
}>()
defineEmits<{ (e: 'showDetail', assetId: DocId): void }>()
defineSlots<{
  /** Default: the library's row, its v-models on the item, as today. */
  item?(props: { item: UploadQueueItem; index: number; refreshDisabled: boolean; refresh: () => void; refreshMayHelp: boolean }): unknown
  /** Default: the library's mass operations of `queueKey`, over the library's store even when `queue` is bound
   *  (posudok Codexu I1): a host with its own store gives its sidebar here, as admin-dam does. */
  sidebar?(props: { queueKey: UploadQueueKey }): unknown
}>()
```

Pravidlá:

1. Zoznam číta `queue.items()`; sidebar je pri `items.length >= massOperationsFrom` (dnes `> 0` a `> 1`).
2. „Obnoviť" robí `createUploadQueueItemRefresh(queue)`: riadok, ktorý už nie je v `items()`, sa nepýta (DAM);
   po odpovedi upozornenie „stále sa…" pri `pending`, „nepodarilo sa" pri `error`, ak riadok medzitým neskončil
   (`Failed`, `Uploaded`, `Stop` po zmene) ani neodišiel z fronty (LIB) (ZK6). Upozornenie ide cez `queue.warn`.
3. Slot `item` dostane `refresh`, viazané na riadok cyklu. Predvolený obsah (riadok knižnice) ho volá z
   `@refresh-item` a obsah udalosti nečíta; obal admin-dam robí to isté. Riadok sa teda nikdy neberie z `$event.item`:
   `LT/uploadQueueItemRefresh.test.ts:198,219,251` (pred krokom 28 `:194,215,247`; od 28 aj pomocník `:284`) emitujú
   `{ index, assetId }` bez riadku a museli by ďalej pýtať.
4. `queue.prime(items)` raz pri pripojení (dnes `:94-100`, DAM `:67-76`); posun klávesmi len pri `keyboardScroll`.
5. Zoznam sa nedotkne skladu, cache, volieb pluginu ani `useAlerts` knižnice inak než cez `queue`. Predvolená
   väzba sa vytvorí, len keď `queue` chýba, takže v admin-dam zoznam neprečíta voľby pluginu ani sklad knižnice.
6. `useUploadQueueItemRefresh(configName)` s dnešným podpisom `refreshItem(assetId, item?, queueKey?)` ostáva pre
   `UploadQueueDialogSingleSidebar` a predvolenú väzbu; je to obal nad `createUploadQueueItemRefresh`.

**Obal DAM** (`D/asset/components/queue/AssetQueueEditable.vue`, asi 70 riadkov, dnešné vlastnosti `queueId`,
`massOperations`, `disableDoneAnimation`):

```ts
const store = useUploadQueuesStore()
const { showWarningT } = useAlerts()                  // from the package, in admin-dam's code: the tests' replacement reaches it
const { addToCachedKeywords, fetchCachedKeywords } = useCachedKeywords()   // the admin-dam path: the tests' mock reaches it
const { addToCachedAuthors, fetchCachedAuthors } = useCachedAuthors()
const queue: UploadQueueListBinding = {
  items: () => store.getQueueItems(props.queueId),
  cancel: (item, _index, queueId) => store.stopItemUpload(queueId, item),   // the queue of the row's event, as today (`:56-58`)
  remove: () => {},                                   // the row's own "delete" does it (slot `remove`)
  refresh: (item) => store.refreshQueueItem(item),
  refreshMayHelp: () => false,
  warn: (key) => showWarningT(key),
  prime: (items) => { items.forEach((i) => { addToCachedKeywords(i.keywords); addToCachedAuthors(i.authors) }); fetchCachedKeywords(); fetchCachedAuthors() },
  mainFileSingleUseEnabled: true,
}
provide(UploadQueueSuggestionsKey, (key) => store.getQueue(key)?.suggestions)
// template: <ADamUploadQueueList :queue-key="queueId" :ext-system="currentExtSystemId" :queue :mass-operations-from="2"
//   :keyboard-scroll="false" …> #item="{ item, index, refreshDisabled, refresh }" → <AssetQueueItemEditable …
//   @refresh-item="refresh()" />, #sidebar → <AssetQueueSelectedSidebar :queue-id />
```

### 2.4 Hromadné operácie (`ADamUploadQueueMassOperations`) a väzba `UploadQueueMassOperationsBinding`

```ts
export interface UploadQueueMassOperationsBinding {
  assetTypes(): DamAssetTypeType[]
  fillCustomDataValue(data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue }, forceReplace?: boolean): void
  /** Into which rows is the host's: every row in the library, rows whose type has keywords on in admin-dam (C49). */
  fillKeywords(value: DocId[], forceReplace?: boolean): void
  fillAuthors(value: DocId[], forceReplace?: boolean): void
}
/** Today's: `getQueueItemsTypes(queueKey)` of the library's store and `useUploadQueueMassOperations(queueKey)`; the key is read at each call (U4-c4, c5). */
export function useLibraryUploadQueueMassOperationsBinding(queueKey: MaybeRefOrGetter<UploadQueueKey>): UploadQueueMassOperationsBinding

// L/uploadQueue/components/AssetQueueSelectedSidebar.vue
defineProps<{ queueKey: UploadQueueKey; extSystem: IntegerId; operations?: UploadQueueMassOperationsBinding }>()
```

Štyri panely typov (ZK7), „Vyčistiť" vymaže výber vždy (ZK8). Obal DAM (`D/…/AssetQueueSelectedSidebar.vue`,
asi 35 riadkov, vlastnosť `queueId`) podá akcie svojho skladu `queueItemsReplaceEmpty*` a aktuálny ext system.
Funkcie hromadných operácií z jadra (2.5 jadra) ostávajú za týmito akciami; sidebar ich nevolá priamo, aby
zostal zápis tam, kde ho majú strany dnes (HO5), a test `DT/queue/lazyMetadata.test.ts` nad akciami platil.

### 2.5 Listové bloky

| Blok | Zmena v LIB | admin-dam podá |
|---|---|---|
| `ADamUploadQueueStopButton` | žiadna | `data-cy`, `button-size`, `is-uploading`, `@confirm` ako dnes (`AssetFooterUploadOverlayFull.vue:239-244`, `AssetFooterUploadSlotsOverlay.vue:140-143`) |
| `ADamAssetCustomMetadataForm` | žiadna; záloha pripnutých ostáva `?? 2` aj pre admin-dam (ZK27), formulár preto nečíta žiadnu konfiguráciu navyše (`LT/…/AssetCustomMetadataFormPinned.test.ts` ho montuje bez pluginu) | `:ext-system`, `:validation-scope="AssetMetadataValidationScopeSymbol"` na oboch miestach (riadok cez `validationScope` riadku, detail výslovne) |
| formulár hromadných operácií (`AssetCustomMetadataFormMassOperations.vue`) | žiadna (U8: meno s poľom); **nevyvezený** (verzia 4) | len cez sidebar knižnice, teda cez obal `AssetQueueSelectedSidebar.vue`; jeho prípady v testoch admin-dam sa v U5b vypustia (pokrýva ich `DT/queue/massOperationsRows` a knižničný `LT/massOperationsValidation`, 4.1) |
| `ADamAssetImage`, `ADamAssetImageMetaIcons` | `showTts?: boolean` (predvolene `false`), podané z `AssetImage` ikonám; vetva `ttsAudio`, `ICON_TTS`, kľúč `common.damImage.asset.metaIcons.tts` (SK „Syntetické (TTS)", EN „Synthesized (TTS)", CS nový); `AssetFileProperties.ttsAudio?: boolean` | `show-tts` v `AssetListItem.vue:82` a `AssetTableRowItem.vue:115` (U3); augmentácia `src/plugins.d.ts:31-33` (`ttsAudio: boolean`, povinné) zanikne **pri kópii po U1, výslovnou úpravou**: typ potom deklaruje len knižnica. Žiadna kontrola by zabudnuté odstránenie nezachytila: augmentácia je v `.d.ts` a admin-dam má `skipLibCheck: true` (zdedené z `node_modules/@vue/tsconfig/tsconfig.json:63`) |
| `ADamAssetFileFailReasonChip`, `useDamAssetFileFailReason` | žiadna | ako dnes |
| výbery KA, AA | `disabledAs?: 'chips' \| 'input'` (predvolene `'chips'`): v `'input'` sa vykreslí vstup s `:disabled="disabled \|\| undefined"` a „+" autora ostane, vypnuté (ZK12); brána vytvorenia `useAclAllowed(keywordCreateAcl / authorCreateAcl ?? undefined)` nad Enter, čiarkou, „+ meno" a „+" | `:ext-system`; `disabled-as="input"` len v riadku; konfigurácia v `main.ts` |
| chipy KC, AC | `inject(UploadQueueSuggestionsKey, null)`; bez nej sklad knižnice, volaný až keď treba (dnes v `setup`, `L/KC:31`, `L/AC:33`) | obal zoznamu poskytne vyhľadanie v sklade DAM |
| `ADamAuthorCachedChip`, `ADamAuthorCreateButton` | žiadna | päť stránok mimo uploadu podá `id`; `AuthorListView` `:ext-system`, `@success` |
| cache a ext system cache | žiadna | dva súbory DAM sa stanú preposielačmi pod dnešnými menami; `cachedExtSystemId` sa zapíše v `initCurrentExtSystemAndLicence` po každom zápise aktuálneho (`currentExtSystem.ts:45,49,54,92`) |
| `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig` | žiadna | `D/asset/components/AssetMetadata.vue:77,82` s `currentExtSystemId.value` |
| `useFormatAndSizeCheck` | žiadna | `FileUpload.vue` zavolá `checkFormatsAndSizes(files, true)` a nesprávne mená ukáže svojím upozornením a kľúčom ako dnes (SB3) |
| `useDropzoneGlobalDragState` (už vyvezené) | žiadna | `src/App.vue:17-18` `initGlobalDragState()`; `FileUpload.vue:65` `isDraggingFile.value = false` |

### 2.6 Čo admin-dam zmení mimo uploadu (U3)

| Súbor DAM | Dnes | Potom |
|---|---|---|
| 13 súborov s `AssetImage` (podklad 7, časť 7) | `D/asset/components/AssetImage.vue` | `ADamAssetImage`; `AssetListItem` s `show-tts` |
| `D/asset/components/list/components/AssetTableRowItem.vue` | DAM ikony | `ADamAssetImageMetaIcons show-tts` |
| `D/asset/components/AssetInfobox.vue`, `detail/components/slots/AssetSlotListItem.vue` | DAM chip | `ADamAssetFileFailReasonChip` |
| `D/asset/components/queue/AssetQueueItemList.vue` | `useAssetFileFailReason` DAM | `useDamAssetFileFailReason` |
| `AuthorDetail.vue`, `AuthorEditForm.vue`, `AssetLicenceDetail.vue`, `AuthorCleanPhraseDetail.vue`, `AuthorCleanPhrasePlaygroundButton.vue` | DAM chip autora | `ADamAuthorCachedChip` |
| `D/author/components/AuthorListView.vue` | DAM tlačidlo, `@on-success`, `disable-redirect` | `ADamAuthorCreateButton :ext-system @success` |
| `D/asset/components/AssetMetadata.vue` (detail assetu) | DAM formulár, KA, AA, konfigurácie | knižničné; formulár s výslovným rozsahom DAM |
| `D/assetLicence/components/AssetLicenceEditForm.vue` | DAM AA; hľadá a vytvára v **aktuálnom** ext systéme (`D/author/composables/authorActions.ts:176-227`, `D/author/components/AuthorCreateButton.vue:50-58`) | `ADamAuthorRemoteAutocompleteWithCached :ext-system="currentExtSystemId"`, ako dnes; **nie** `assetLicence.extSystem` formulára: to by zmenilo zoznam autorov a cieľ „+", a tlačidlo knižnice by pre ext system bez načítanej konfigurácie vyhodilo výnimku v `setup` (admin-dam načíta len aktuálny) |
| `D/shared/components/FileUpload.vue`, `src/App.vue` | `fileValidation.ts`, `windowFilesDragWatcher.ts` | knižničná kontrola a stav ťahania |
| `src/plugins.d.ts:31-33` | augmentácia `ttsAudio` | tri riadky odstránené úpravou súboru už pri kópii po U1, nie v U3 (2.5) |
| `src/main.ts` a nový modul volieb (pozri 5.4, R-K5) | `configs.default = { damClient }` | `+ keywordCreateAcl: 'dam_keyword_create', authorCreateAcl: 'dam_author_create'` |

### 2.7 Čo admin-dam ponechá celé

`D/asset/components/footer/*` (všetky prekrytia, `AssetFooterSelectedButtonClear`), `D/asset/composables/assetFooter*.ts`,
`externalProviderAssetFooterSelected.ts`, `D/asset/components/queue/AssetQueueUploadList.vue`, `AssetQueueItemList.vue`,
`AssetQueueSelectedSimple.vue`, `AssetQueueSelectedItemSimple.vue` (mení len import obrázka), `D/asset/components/AssetLink.vue`,
`D/asset/components/AssetUpload.vue`, `D/shared/components/FileUpload.vue`, `D/asset/components/detail/components/slots/AssetSlotListItem.vue`,
súbory externých poskytovateľov (`ExternalProviderAssetQueue*`, `externalProviderAssetImport.ts`, …), `D/shared/services/upload/uploadQueueIds.ts`,
`D/shared/validationScopes.ts`, `D/keyword/components/KeywordCreateButton.vue`, `D/keyword/composables/keywordValidation.ts`,
`D/author/composables/authorActions.ts`, `D/keyword/composables/keywordActions.ts`, oba `api/*`, oba `filter/*`,
`D/author/components/AuthorRemoteAutocomplete.vue`, voliteľne `authorValidation.ts`. Zápis uloženého detailu do riadkov
(`updateAssetMetadata`) a celý detail DAM (`assetDetailStore`, `AssetDetailDialog`) ostávajú (3.3, bod 7 jadra).

### 2.8 Časť 5: rámec „obrázok a sidebar" a dva adaptéry

```ts
// L/assetDetail/composables/assetDetailView.ts
/** What the frame draws, and nothing else. */
export interface AssetDetailView {
  /** Keys the sidebar; null while an upload has no asset yet (the sidebar then is not drawn). */
  id: DocId | null
  assetType: DamAssetTypeType
  assetStatus: DamAssetStatusType
  /** For the status props the sidebars take. */
  mainFile: AssetFile | null
  image: {
    src: string
    width?: number
    height?: number
    backgroundColor: string
    aspectRatio?: number
    uploading: boolean
    processing: boolean
    waiting: boolean
    done: boolean
    /** As the row has them (`UploadQueueItem['progress']`, `types/UploadQueue.ts:72-73`): not normalised. */
    progress?: number | null
    remainingTime?: number | null
  }
  /** The sidebar offers the region tab. */
  roiTab: boolean
  /** The left side follows the region tab. */
  roiEditorTab: boolean
  simpleMode: boolean
}

/** The asset detail: ADD:63-114 and ADDS:47, as they are. */
export function assetDetailViewOfAsset(asset: AssetDetailItemDto | null, simpleAssetSidebarEnabled: boolean): AssetDetailView | null

/** The dialog of a single upload: UQDS:82-204 without the made-up asset. */
export function assetDetailViewOfUploadItem(
  item: UploadQueueItem | null,
  detailAsset: AssetDetailItemDto | null,
  options: { enableRoiTab: boolean; disableDoneAnimation: boolean; simpleAssetSidebarEnabled: boolean }
): AssetDetailView | null
```

**Adaptér z riadku** urobí presne to, čo dnes vymyslený asset: bez riadku `null`; riadok bez assetu → `id` `null`,
typ `DamAssetTypeDefault`, stav `DamAssetStatusDefault`, `mainFile` `null`; riadok s assetom pred dokončením → typ a
stav riadku; po dokončení s načítaným assetom detailu → typ, stav a `mainFile` z neho (`UQDS:82-84,135-142`).
Obrázok: náhľad riadku (`requestedWidth || undefined`), inak 356×200; farba z `mainFile` obrázkového súboru, inak
`#ccc`; stavy `Uploading`, `Processing` alebo `Loading`, `Waiting`, `Uploaded` bez `disableDoneAnimation`; percentá a
zvyšný čas z riadku tak, ako sú, aj `null` (`UQDS:202-204,427`); pomer 16:9.
`roiTab = obrázok && enableRoiTab`, `roiEditorTab = enableRoiTab`, `simpleMode = simple && obrázok && enableRoiTab`.

**Adaptér z assetu**: `id`, typ (`|| DamAssetTypeDefault`), stav, `mainFile`; obrázok z `links.image_detail` alebo
356×200 a `#ccc`; žiadne stavy uploadu, žiadny pomer; `roiTab = obrázok`, `roiEditorTab = true` (detail dnes ukáže
editor pri záložke „Fókus" bez ohľadu na typ, `ADD:191-200`; zachované), `simpleMode = simple && obrázok`.

```ts
// L/assetDetail/components/AssetDetailDialogFrame.vue — internal
defineProps<{ loading: boolean; view: AssetDetailView | null; extSystem: IntegerId; configName?: string }>()
defineEmits<{ (e: 'close'): void }>()        // from the loader
defineSlots<{
  title(): unknown
  'toolbar-actions'(): unknown
  'image-overlay'?(): unknown
  sidebar(props: { view: AssetDetailView }): unknown
}>()
// Draws: VDialog fullscreen eager; loader while `loading`; the card while `view`; the toolbar (title, the sidebar
// toggle, toolbar-actions, `pr-2`); left: the region editor when `(activeTab === ROI && view.roiEditorTab) ||
// view.simpleMode`, with `:readonly="!roiEditable"`; else AssetImage(view.image) as a flex item, wrapped in
// `.position-relative` together with the overlay only when `image-overlay` is given; right: sidebar slot.
// roiEditable is today's code of both dialogs (ADD:43-45, UQDS:212-216), once:
//   const { roiUpdateAcl } = useCommonAdminCoreDamOptions(props.configName)
//   const roiEditable = computed(() => isNull(roiUpdateAcl) || canSafeHelper(roiUpdateAcl, undefined, 'roi'))

// L/assetDetail/components/AssetDetailSidebarFrame.vue — internal
defineProps<{ queueKey: UploadQueueKey; configName?: string; roiTab: boolean; simpleMode: boolean }>()
defineSlots<{ prepend?(): unknown; info(props: { isActive: boolean }): unknown }>()
// Draws: the tabs (Info; region when roiTab) unless simpleMode, prepend, info, AssetDetailSidebarROI, the teleport target.

// L/assetDetail/components/AssetFileInfoPanel.vue — internal: AM:189-271 and UQDSMC:174-245
defineProps<{ asset: AssetDetailItemDto; showUsers: boolean }>()
// No overflow-wrap of its own: AM passes style="overflow-wrap: normal" (falls through to the root), the dialog nothing (JS29).
```

**Čo ostane zo súborov.** `ADD` (asi 60 riadkov): adaptér z assetu, rámec, `#title` (zdrojový systém), `#toolbar-actions`
(zatvorenie), `#sidebar` → `AssetDetailDialogSidebar`. `ADDS` (asi 45): rámec sidebaru, `#prepend` → `AssetInfobox`,
`#info` → `AssetDetailSidebarMetadata`; vlastnosti ako dnes. `UQDS` (asi 230): adaptér z riadku, ukladanie (`UQDS:253-303`),
načítanie po dokončení, nadpis, tlačidlo zastavenia, `#image-overlay` → `UploadQueueItemErrorOverlay`, `#sidebar` →
`UploadQueueDialogSingleSidebar` s dnešnými vlastnosťami a slotom `prepend-sidebar`. `UQDSS` (asi 90): rámec sidebaru,
„Obnoviť" ako dnes, `#info` → `UploadQueueDialogSingleSidebarMetadata`. `ADSM` a `UQDSM` bez zmeny. `AM` a `UQDSMC`
stratia panel súboru (→ `AssetFileInfoPanel`, `showUsers` `true` / `false`; `AM` mu podá
`style="overflow-wrap: normal"`, JS29). Mená komponentov, ich vlastnosti a
udalosti ostávajú, takže `LT/uploadQueueDialogSingle.test.ts` (montuje `UQDSS` s jeho vlastnosťami, `:172-196`;
emituje z neho `save`, `:499`) a náhrady podľa mena (`UploadQueueDialogSingleSidebar`, `AssetImage`,
`DamAssetImageRoiSelectLazy`, `AssetDetailSidebarROI`, `UploadQueueDialogSingleSidebarMetadata`) platia.

### 2.9 Jedna funkcia objektu obrázka

```ts
// L/imageWidget/utils/damImage.ts — internal
export interface DamImageFile {
  fileId: DocId
  licenceId: IntegerId
  /** `mainFileInternal` of the asset; false where it is not known. */
  internal?: boolean | null
}

/** The image of the CMS for a DAM file. Every caller gets the object it builds by hand today. */
export function createDamImage(
  file: DamImageFile,
  texts: { description?: string; source?: string } = {},
  options: { showSource?: boolean; position?: number; id?: IntegerId } = {}
): ImageCreateUpdateAware
// → { texts: { description ?? '', source ?? '' }, flags: { showSource ?? true, internal: false, overrideInternal: false },
//     dam: { damId: fileId, licenceId, regionPosition: 0, internal: internal ?? false },
//     position when `!== undefined`, id when `!== undefined` }   — 0 counts: IM6 and IM8 pass `position: 0`
```

Volajúci si nechajú svoje pravidlá: kedy je `id` (IM2, IM3: model nie je `null`; IM8: uložený obrázok má `id`
pravdivé, teda volajúci podá `resImage.value?.id || undefined` ako dnes `AImagePublicInput.vue:132-134`),
odkiaľ sú texty (vrátane vlastného mapovania aplikácie), pozície (nález 31 sa v U7 nemení) a čo pridajú
(`authorIds`, `assetId`, `key`, `damAuthors`, `showDamAuthors`). Kľúč `position` alebo `id` sa nepridá, kde dnes nie
je, a pridá sa aj s hodnotou 0, kde dnes je; obsah tela požiadavky je teda zhodný. Poradie kľúčov sa zmení v IM1 až
IM7 (aj vnútri `dam`: dnes raz `damId, regionPosition, licenceId`, inde `damId, licenceId, regionPosition`). Je to bez
účinku: telá idú ako JSON a testy porovnávajú `toEqual` alebo `toContain` (posudok Opusa, W3).

Po U7 menia tie isté miesta dve rozhodnuté opravy, každá samostatným krokom (4.5): nález 31 (pozíciu nových obrázkov
galérie prideľuje len widget) a nález 36 (do API obrázkov len polia obrázka cez vnútornú pomôcku vedľa
`createDamImage` v tom istom súbore; widget nečíta obrázok, ktorý práve vytvoril; `mainFileSingleUse` bez `null`).
`createDamImage` sa ani nimi nemení.

### 2.10 Súbory admin-dam: dnes a potom, a dve odchýlky od plánu

| Súbor DAM | Dnes | Potom | Krok |
|---|---|---|---|
| `D/asset/components/queue/AssetQueueItemEditable.vue` | 512 | obal asi 160 (s presunutým watcherom „Obnoviť") | U5c |
| `D/asset/components/queue/AssetQueueEditable.vue` | 114 | obal asi 70 | U5c |
| `D/asset/components/queue/AssetQueueSelectedSidebar.vue` | 363 | obal asi 35 | U5b |
| `D/author/composables/cachedAuthors.ts`, `D/keyword/composables/cachedKeywords.ts` | 48, 45 | preposielače asi 10 a 10 | U2 |
| `D/asset/components/footer/AssetFooterUploadButtonStop.vue` | 92 | bez importéra → zmazať | U5a, U9 |
| `D/shared/components/customMetadata/AssetCustomMetadataForm.vue`, `…MassOperations.vue` | 67, 107 | bez importéra → zmazať | U5b, U5c, U9 |
| `D/asset/components/AssetImage.vue`, `AssetImageMetaIcons.vue`, `assetImageIconsConfig.ts`, `src/assets/meta-icons/*` (JPEG zástupcu ostáva) | 316, 120, 47 | bez importéra → zmazať | U3, U5c, U9 |
| `D/asset/components/AssetFileFailReasonChip.vue`, `D/asset/valueObject/AssetFileFailReason.ts` | 25, 44 | bez importéra → zmazať | U3, U5c, U9 |
| `D/keyword/components/KeywordRemoteAutocompleteWithCached.vue`, `…CachedKeywordChip.vue` | 237, 109 | bez importéra → zmazať | U3, U5c, U9 |
| `D/author/components/AuthorRemoteAutocompleteWithCached.vue`, `…CachedAuthorChip.vue`, `…ChipConflicts.vue`, `AuthorCreateButton.vue` | 262, 136, 77, 197 | bez importéra → zmazať | U3, U5c, U9 |
| `D/author/composables/authorConfig.ts`, `D/keyword/composables/keywordConfig.ts` | 29, 29 | bez importéra → zmazať | U3, U5c, U9 |
| `D/shared/services/upload/fileValidation.ts`, `D/asset/composables/windowFilesDragWatcher.ts` | 59, 59 | bez importéra → zmazať | U3, U9 |

**Odchýlka 1.** Plán hovorí, že `AssetQueueEditable.vue` a `AssetQueueSelectedSidebar.vue` zaniknú. Ostávajú ako obaly:
päť súborov vlny 4 (`DT/queue/queueRowStates`, `queueRowActions`, `queueRowKeywordsAuthors`, `massOperationsRows`,
`failReasonChip`, jeden prípad) a `DT/queue/queueRefresh.test.ts` montujú `AssetQueueEditable.vue` podľa cesty;
`queueRefresh` a `saveNothing` nahrádzajú podľa cesty zoznam aj sidebar; dve prekrytia ho importujú; strážny test
`DT/a11y/iconButtonNames.test.ts` číta riadok a sidebar ako text (v U5c sa prepne na obaly, 4.1). Obal drží väzbu
DAM (podané funkcie jeho skladu, upozornení a cache), takže tieto testy ostávajú nezávislým svedkom presunu.
Rovnaký dôvod viedol jadro k väzbám v `uploadService.ts` a `fileApi.ts` (jeho 2.7).

**Odchýlka 2.** Plán počíta so zánikom súborov DAM v rámci kroku. Mazanie súboru (`rm`) si v tejto práci pýta
potvrdenie vlastníka zakaždým (denník, „Prestoj 00:15 až 09:40"). Súbory bez importéra preto ostanú až do U9 a
zmaže ich vlastník jedným príkazom zo zoznamu v U9. Do vtedy na ne neukazuje žiadny kód ani test (testy sa v tom
istom kroku prepnú na balík), takže nikoho neklamú.

### 2.11 Exporty z `src/lib.ts` (len pribúdajú)

Balík dovoľuje len import zo vstupu (`package.json`, `exports`: `.`, `./styles` a nástrojové `./eslint`, `./oxlint`,
`./testing`, `./vite`, `./package.json`; komponenty a composables len z `.`), takže všetko, čo produkčný kód
admin-dam importuje priamo, musí ísť von. Pri každom exporte je, kto ho používa. Nič sa nevyváža len pre test: chip
kľúčového slova a chip konfliktu autora admin-dam priamo nepoužíva (sú vnútri výberov knižnice), preto von nejdú a test
admin-dam, ktorý ich dnes montuje, sa v U5c zúži (4.1).

| Export | Súbor | Kto ho používa | Krok |
|---|---|---|---|
| `ADamAssetImage`, `ADamAssetImageMetaIcons` | `L/assetDetail/components/AssetImage.vue`, `AssetImageMetaIcons.vue` | admin-dam: 13 súborov s obrázkom assetu (podklad 7, časť 7), `AssetTableRowItem.vue` (ikony) | U1 |
| `ADamAssetFileFailReasonChip`, `useDamAssetFileFailReason` (meno funkcie `useAssetFileFailReason`) | `AssetFileFailReasonChip.vue`, `composables/assetFileFailReason.ts` | admin-dam: `AssetInfobox.vue`, `AssetSlotListItem.vue` (chip), `AssetQueueItemList.vue` (funkcia); test `DT/queue/failReasonChip` | U1 |
| `ADamAssetCustomMetadataForm` | `L/assetDetail/components/AssetCustomMetadataForm.vue` | admin-dam: `AssetMetadata.vue`; testy `DT/queue/customMetadataForms`, `DT/asset/assetMetadataValidation` | U1 |
| `ADamUploadQueueStopButton` | `L/uploadQueue/components/UploadQueueButtonStop.vue` | admin-dam: `AssetFooterUploadOverlayFull.vue`, `AssetFooterUploadSlotsOverlay.vue`; test `DT/upload/uploadStopQuestion` | U1 |
| `ADamKeywordRemoteAutocompleteWithCached`, `ADamAuthorRemoteAutocompleteWithCached` | `L/keyword/components/KeywordRemoteAutocompleteWithCached.vue`, `L/author/components/AuthorRemoteAutocompleteWithCached.vue` | admin-dam: `AssetMetadata.vue` (oba), `AssetLicenceEditForm.vue` (autor) | U1 |
| `ADamAuthorCachedChip` | `L/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue` | admin-dam: `AuthorDetail.vue`, `AuthorEditForm.vue`, `AssetLicenceDetail.vue`, `AuthorCleanPhraseDetail.vue`, `AuthorCleanPhrasePlaygroundButton.vue`; test `DT/cached/cachedChipUnresolved` | U1 |
| `ADamAuthorCreateButton` | `L/author/components/AuthorCreateButton.vue` | admin-dam: `AuthorListView.vue` | U1 |
| `useDamCachedAuthors`, `useDamCachedKeywords` | `L/author/composables/cachedAuthors.ts`, `L/keyword/composables/cachedKeywords.ts` | admin-dam: dva preposielače cache (U2), cez ne 14 súborov. Trojicu pre výbery (`…ForRemoteAutocomplete`) preposielače zložia z týchto dvoch (`fetch`, `add`, `addManualMinimal` = `fetchCached…`, `addToCached…`, `addManualMinimalToCached…`); slúži len výberom admin-dam, ktoré v U5c zaniknú, preto sa nevyváža | U1 |
| `useExtSystemIdForCached` | `L/composables/extSystemIdForCached.ts` | admin-dam: `initCurrentExtSystemAndLicence` (`currentExtSystem.ts`); test `DT/cached/cachedChipUnresolved` (U2) | U1 |
| `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig` | `L/keyword/composables/damKeywordConfig.ts`, `L/author/composables/damAuthorConfig.ts` | admin-dam: `AssetMetadata.vue` | U1 |
| `useFormatAndSizeCheck` | `L-ui/composables/formatAndSizeCheck.ts` | admin-dam: `FileUpload.vue` | U1 |
| `UploadQueueSuggestionsKey`; typy `UploadQueueSuggestionsLookup`, `DamFieldsDisabledAs` (`'chips' \| 'input'`) | `L/uploadQueue/components/uploadQueueBindings.ts` | kľúč: admin-dam, obal `AssetQueueEditable.vue` (`provide`). Typy sú typy verejného rozhrania vyvezených komponentov: `DamFieldsDisabledAs` vlastnosti `disabledAs` dvoch výberov a `disabledFieldsAs` riadku, `UploadQueueSuggestionsLookup` hodnoty kľúča; potrebuje ich, kto tú vlastnosť alebo kľúč typuje. admin-dam ich dnes nepíše (obaly dávajú literál a funkciu) | U1 |
| `ADamUploadQueueItem`, `ADamUploadQueueList`, `ADamUploadQueueMassOperations`; typy `UploadQueueListBinding`, `UploadQueueMassOperationsBinding` | `UploadQueueItemEditable.vue`, `UploadQueueEditable.vue`, `AssetQueueSelectedSidebar.vue`, `uploadQueueBindings.ts` | admin-dam: tri obaly (`AssetQueueItemEditable.vue`, `AssetQueueEditable.vue`, `AssetQueueSelectedSidebar.vue`) | U4 |

Nevyvážajú sa: predvolené väzby knižnice, rámec, adaptéry, `createDamImage`, `UploadQueueItemErrorOverlay`,
watcher „Obnoviť" riadku, a nič, čo by používal len test alebo kód, ktorý sa chystá zaniknúť: chip kľúčového slova a
chip konfliktu (verzia 3), formulár hromadných operácií a trojice `useDamCached{Authors,Keywords}ForRemoteAutocomplete`
(verzia 4). `LS/publicExportsAdded.test.ts` dostane nové mená; `LS/publicExportsDamConsumers.test.ts`
(mená, ktoré importujú CMS a UGC) a `LS/publicExportsRemoved.test.ts` ostávajú bez zmeny.

PV14b (2.13) nepridá export: vyvezeným výberom `ADamKeywordRemoteAutocompleteWithCached`,
`ADamAuthorRemoteAutocompleteWithCached`, tlačidlu `ADamAuthorCreateButton` a už vyvezenému `AImageMassOperations`
pribudne nepovinná vlastnosť `configName` (rozhranie len pribúda); `DamConfigNameKey` a `useDamConfigName` sú
vnútorné.

### 2.12 Konfigurácia pluginu (`CommonAdminCoreDamConfig`, len pribúda)

```ts
/** The grant creating a keyword needs, checked before it is offered (Enter, comma, "+ name"). None by default. */
keywordCreateAcl?: AclValue | null
/** The same for an author, also the "+" button. */
authorCreateAcl?: AclValue | null
/**
 * Copy to licence: the asset select offers its switch and the image widgets send the copy only when on.
 * On by default (today's library); an app whose users are not to copy between licences turns it off.
 */
copyToLicenceEnabled?: boolean
```

Vo verzii 1 tu bol aj `customMetadataPinnedFallback`; zanikol so ZK27.

**`copyToLicenceEnabled`** (vlastník 9. 10., denník „Kópia do licencie (9. 10.)"; krok spolu s nálezom 20, asi 1 až
1,5 h). `useCommonAdminCoreDamOptions` ho vráti surovo (N20V, 11. 10.: ako kľúče U1, aby sa `consumerProfileOptions` nemenil);
miesta použitia testujú `copyToLicenceEnabled !== false`, takže chýbajúci kľúč je dnešné správanie.
- **Výber assetu:** `showCopyToLicence` (`L/assetSelect/components/AAssetSelect.vue:157-164`, rovnako
  `AAssetSelectMedia.vue:154`) pribudne podmienka `copyToLicenceEnabled`; pri vypnutej sa prepínač „kopírovať do
  licencie" neukáže a potvrdenie (`AAssetSelect.vue:138`, `AAssetSelectMedia.vue:135`) kópiu nežiada. Obrázok z inej
  licencie sa potom použije priamo, ako dnes bez prepínača.
- **Widgety:** pri vypnutej voľbe kópiu nepošlú nikdy, ani keby potvrdenie výberu `copyToLicence` nieslo
  (`L/imageWidget/components/ImageWidgetInner.vue:430-435`, `ImageMediaWidgetInner.vue:550-553`,
  `ImageWidgetMultipleInner.vue:354-363`); sú to tie isté tri volania, ktoré opravuje nález 20 (adresa obrázka).
- **Konfigurácia:** výber ju číta, ako všetky svoje voľby, do PV14b z `default` a od PV14b zo svojej (zdedenej)
  konfigurácie; widget zo svojej `configName` už dnes. Kým aplikácia nemá inú konfiguráciu než `default` (dnes žiadna
  nemá), vyjde to rovnako; po PV14b je voľba za pomenovanú konfiguráciu.
- **Aplikácie:** admin-cms ju nepodá, kópia ostáva a sprevádzkuje ju oprava nálezu 20. admin-ugc ju má podľa vlastníka
  vypnúť (`copyToLicenceEnabled: false` v `configs.default`); dnes je tam kópia nedosiahnuteľná len preto, že UGC
  podáva výberu jedinú licenciu. Zmenu v admin-ugc **odovzdáme tímu admin-ugc**, do admin-ugc nepíšeme; backendová
  cesta pre UGC sa nerobí. admin-dam widgety obrázka nepoužíva a jeho `AAssetSelect` licenciu nahrávania nepodáva,
  takže prepínač nevidí ani dnes.
- **Testy (v kroku nálezu 20):** oba výbery pri vypnutej voľbe prepínač neukážu a pri zapnutej áno (dnešné prípady
  ostávajú); všetky tri widgety pri vypnutej voľbe `copyToLicence` nezavolajú, ani keď ho potvrdenie nesie. Profil
  UGC v testoch knižnice (`LT0/support/consumerProfiles.ts`) zrkadlí `admin-ugc/src/main.ts`; voľbu dostane, až keď
  ju admin-ugc vypne.

Od U1 do PV14b sa čítajú z konfigurácie `default`, ako dnes všetky voľby výberov; **od PV14b z konfigurácie výberu**
(`useCommonAdminCoreDamOptions(useDamConfigName(props.configName))`, 2.13; rozhodnutie PV14, analýza
`krok5/analyzy/pv14-pomenovane-konfiguracie.md`, bod 6 pre vlastníka). admin-cms, admin-ugc aj admin-dam majú len
`default`, takže to pre všetky tri vyjde rovnako. Predvolené hodnoty sú dnešná knižnica, takže CMS a UGC, ktoré ich
nepodajú, nič nevidia.

### 2.13 Pomenovaná konfigurácia v komponentoch (krok PV14b)

Rozhodnutie vlastníka 9. 10. (PV14): knižnica podporí viac pomenovaných konfigurácií DAM na stránke; meno nesie
fronta (krok PV14a, jadro a sklad) a strom komponentov (PV14b); výslovná vlastnosť má prednosť. Obmedzenie „jedna
stránka = jeden core-dam" sa zapíše do dokumentácie; cache mien ostáva jedna na stránku cez `default` (PV14c až
neskôr). Zdroj: `krok5/analyzy/pv14-pomenovane-konfiguracie.md`, 4.1 body 5 a 6, 4.3, 4.4. Komponentová časť:

```ts
// L/composables/damConfigName.ts — internal, not exported
export const DamConfigNameKey: InjectionKey<string> = Symbol('anzu:dam-config-name')
/**
 * The name of the DAM configuration a component works under: its own `configName` when given, else the one of the
 * nearest ancestor that has one, else 'default'. Provides it to the descendants. Read once, in `setup`, as the
 * options are read today.
 */
export function useDamConfigName(explicit?: string): string
//   const name = explicit ?? inject(DamConfigNameKey, undefined) ?? 'default'; provide(DamConfigNameKey, name); return name
```

1. **Vlastnosť `configName` stratí predvolené `'default'` vo `withDefaults`** (typ ostáva `string | undefined`) na
   všetkých komponentoch, ktoré ju majú (asi 34, analýza 1); inak by predvolená hodnota prekryla zdedené meno.
   Bez poskytnutého mena vyjde to isté ako dnes (`'default'`). V tomto návrhu sa to týka zoznamu (2.3, `configName?:
   string // 'default'` do PV14b) a oboch rámcov (2.8).
2. **Meno poskytnú vstupné komponenty** (asi 14): tri widgety, tri vnútorné widgety, ktoré admin-ugc montuje priamo,
   `AAssetSelect`, `AAssetSelectMedia`, `AAssetListInner`, `AImagePublicInput`, `AImageMassOperations`, oba dialógy
   uploadu, `AssetDetailDialog`. Riadok, zoznam, sidebar hromadných operácií, rámce, obsahy sidebarov a chipy meno
   dedia; nová vlastnosť pre ne netreba.
3. **Výbery a tlačidlo:** KA, AA, `AuthorCreateButton` a filtrové výbery dostanú nepovinnú `configName` (inak
   zdedené meno) a podajú ho `useKeywordSelectActions(extSystem, configName?)`, `useAuthorSelectActions(extSystem,
   configName?)` a vytvoreniu; brána vytvorenia číta `keywordCreateAcl`, `authorCreateAcl` z tej istej konfigurácie
   (2.12). `AImageMassOperations` dostane nepovinnú `configName` (dnes ju nemá) pre autorov, validácie a texty.
4. **Väzby a „Obnoviť":** `useLibraryUploadQueueListBinding(queueKey, configName)` dostane zdedené meno; „Obnoviť"
   ide cez sklad a kľúč fronty (PV14a), takže `useUploadQueueItemRefresh(configName)` ostáva s dnešným podpisom
   (2.3, pravidlo 6). Rámec detailu číta `roiUpdateAcl` pod zdedeným menom. `createDamImage` meno nečíta.
5. **admin-dam nič neposkytuje:** jeho obaly ostávajú na `default`, ako pri `UploadQueueSuggestionsKey`; zoznam
   s podanou väzbou voľby pluginu nečíta (2.3, pravidlo 5). Testy admin-dam sa nemenia.

**Kedy.** PV14b mení súbory, ktoré prepisujú U1, U4, U6, U7 a opravy po nich (4.5), preto ide po nich: v LIB po U6
a U7, hneď po PV14a, pred kópiou C3 (analýza 5); nikdy súbežne s krokom, ktorý mení ten istý súbor. **Testy:** nový
súbor v knižnici pod konfiguráciou `own` (iný klient, iné adresy): hľadanie a vytvorenie autora a kľúčového slova,
výber assetu, uloženie detailu, uloženie oboch dialógov a mapovanie, fronta `default` vedľa pomenovanej; prípady
`useDamConfigName` (výslovné meno, zdedené, `'default'`; potomok s vlastným menom ho dá svojmu podstromu);
`LT0/damAuthorKeywordEndpoints.test.ts:232-520` prejsť (počty požiadaviek na mená sa môžu zmeniť, neoverené),
prípady „by the default configuration" (`:372`, `:414`) ostávajú. Dokumentácia: `doc/changelog/2.0.0.md:70`,
`doc/guide/installation.md:62` (jedna stránka = jeden core-dam; widget pod menom potrebuje aj `image.configs` s tým
istým menom; cache mien a notifikácie sú spoločné). **Do changelogu v Z patrí aj veta (PV14b-c1):**
`AImagePublicInput` pod menom konfigurácie číta od 2.0.0 pod tým menom aj voľby DAM (klient, adresa assetu, text a
validácie zdroja a popisu; predtým ich bral z `default`), takže meno musí byť v `coreDam.configs` aj v `image.configs`;
s menom, ktoré je len v `image.configs`, komponent pri vzniku hodí výnimku.

**Hotové v kroku PV14b (11. 10., `impl/PV14b.md`).** Spresnenia: (1) meno neposkytuje len 14 vstupných komponentov,
ale každý komponent, ktorý vlastnosť `configName` má (36), tým istým riadkom `useDamConfigName(props.configName)`:
výslovné meno, inak zdedené, inak `default`; pre strom je to to isté a žiadny komponent s vlastnosťou nečíta inak než
ostatné. (2) Vlastnosť má vo `withDefaults` ďalej predvolenú hodnotu, `undefined` (pravidlo
`vue/require-default-prop`), nie `'default'`. (3) Komponenty bez vlastnosti, ktoré sú vždy vnútri pomenovaného
(dva zoznamy výberu assetu, filter podcastov, dialóg metadát obrázka, dialóg limitu galérie), meno dedia
(`useDamConfigName()`). (4) `usePodcastSelectActions`, `useAssetSelectActions` a `useImageValidation` meno brali už
predtým; pribudlo `useAuthorSelectActions(extSystem, configName?)`, `useKeywordSelectActions(extSystem, configName?)`
a `useImageMassOperations(configName?)`.

---

## 3. Ako admin-cms a admin-ugc fungujú bez zmeny

Podklad 8 a `LS/publicExportsDamConsumers.test.ts`. Žiadna z aplikácií nemontuje komponenty fronty priamo; dostanú sa
k nim len cez widgety, výber assetu a zoznam assetov knižnice.

| Čo aplikácia podáva dnes | Kde to návrh stretne | Prečo sa nič nemení |
|---|---|---|
| CMS: 33 widgetov (`AImageWidget` 30, `AImageMediaWidget` 2, `AImageWidgetMultiple` 1) s `queue-key`, licenciami, `collab`, `expand-options`, `expand-metadata`, sloty `#append`, `#preview` | dialógy fronty → zoznam, riadok, sidebar bez väzby a bez nových vlastností; `createDamImage` v IM2, IM3, IM5 | predvolené hodnoty sú dnešná knižnica; objekt obrázka je zhodný (2.9) |
| CMS: `AImagePublicInput` (`EmbedImageInlineDialog.vue:74`), `AAssetSelect` (audio, video), `AImageMassOperations` | IM8, IM9 | telo `createImage`/`updateImage` zhodné; ostatné nedotknuté |
| UGC: tri obaly s vnútornými widgetmi a `AAssetListInner` (`skip-current-user-check`, `variant="inline"`, sloty `#upload-activator`, `#filter`, `#sidebar-prepend`, `#asset-select-sidebar-prepend`, `#append`) | to isté; slot `#upload-activator` dáva `onFileInput` ako dnes | nič z toho sa nemení |
| UGC zapisuje do `useDamConfigStore`: `damConfigExtSystem` (ext system 4, `image.customMetadataPinnedAmount: 2`, bez `authors`, `keywords`), `damConfigAssetCustomFormElements`, `damConfigLicenceExtSystem`, `damPrvConfig.settings.imageChunkConfig`, `initialized.damPrvConfig` | formulár (pripnuté, polia), riadok (kľúčové slová a autori skryté) | návrh nepridáva ani nepremenúva žiadne pole skladu; pripnuté dáva UGC číslom, záloha sa neuplatní (a ostáva 2 ako dnes) |
| UGC voľby: `mainFileSingleUseEnabled: false`, `showFileInfoEnabled: false`, `simpleAssetSidebar: true`, `/ugc/v1/*`, `customUploadMetadataToImageMap`, `customAssetSelectMetadataToImageMap`, popisky | predvolená väzba zoznamu číta `mainFileSingleUseEnabled`; rámec `simpleMode`; `AssetFileInfoPanel` za `showFileInfoEnabled`; vlastné mapovanie mimo `createDamImage` | ten istý zdroj hodnôt ako dnes |
| CMS voľby: žiadny z nových kľúčov | brána vytvorenia | `null`/`undefined` → bez brány (`useAclAllowed(undefined)` je `true`) |
| `copyToLicenceEnabled` (2.12, krok nálezu 20) nepodá ani jedna | výber assetu, tri widgety | predvolene zapnutá = dnes; admin-ugc ju má vypnúť (rozhodnutie vlastníka, odovzdá sa tímu admin-ugc), dovtedy sa v UGC nič nemení, prepínač je tam nedosiahnuteľný (výberu podáva jedinú licenciu) |
| Riadok fronty v CMS a UGC: kedy sa ponúkne „Obnoviť" a kôš | `refreshOffered` | CMS a UGC ju nepodajú: riadok počíta dnešným kódom knižnice (`UQIE:156-235`) |
| Chip „nové" v CMS a UGC | `inject(UploadQueueSuggestionsKey, null)` | bez poskytnutej hodnoty sa číta sklad knižnice ako dnes |
| Vlastník (tretia sada, bod 2): autori a kľúčové slová v UGC nemajú byť viditeľné | riadok, sidebar, dialóg | UGC ich nemá zapnuté v konfigurácii; nemení sa |

Stráže profilov (každý súbor beží pod `admin-cms` aj `admin-ugc`): `LT0/consumerProfileUploadQueueRows`,
`consumerProfileUploadDialogActions`, `consumerProfileUploadDialogSingle`, `consumerProfileUploadMassOperations`,
`consumerProfileUploadDialog`, `LW/consumerProfileImageWidgetUpload`, `consumerProfileImageWidgetMultipleUpload`,
`consumerProfileImageWidgetLibrary`, `L/assetSelect/__tests__/consumerProfileAssetListUpload`, `LS/publicExportsDamConsumers`.
Všetky majú ostať zelené bez zmeny; jediná plánovaná zmena je U8 v `consumerProfileUploadMassOperations` (pomocník
`button(name)`, `:78`), ktorá je rozhodnutá (prvá sada, bod 7).

---

## 4. Poradie implementácie

Pravidlá ako v jadre: žiadny commit bez súhlasu, ťažké kontroly po jednej, počas kontroly sa v repozitári nič
neupravuje, žiadne `rm` ani `cd`. Každý krok končí zelenými cielenými testmi; krok, ktorý mení knižnicu pre admin-dam,
končí celými kontrolami knižnice, `yarn build` a `./copy.sh /home/volar/projects/anzusystems/admin-dam`.

**Vzťah k jadru.** U0, U1, U6 a U7 sa nedotýkajú skladov ani služby a smú ísť kedykoľvek (U1 mení súbory, ktoré jadro
nemení). U2 až U5 a U8 menia admin-dam a potrebujú kópiu knižnice; aby nešli dve kópie a dva prúdy zmien admin-dam naraz,
odporúčam ich až po K6 jadra. Komponenty volajú len členy skladov, ktoré jadro zachováva (`getQueueItems`, `getQueue`,
`getQueueItemsTypes`, `stopItemUpload`, `removeByIndex`, `refreshAsset`, `refreshQueueItem`, `refreshMayHelp`,
`queueItemsReplaceEmpty*`), takže poradie s jadrom nie je podmienkou správnosti.

### 4.1 Kroky a brány

| # | Kde | Čo | Stráži |
|---|---|---|---|
| U0 | LIB, DAM | testy dnešného správania tam, kde chýbajú (4.2) | prechádzajú na nezmenenom kóde; pri tvrdení neprítomnosti ohnutie riadku v pamäti ako `dam-vlna4.md`, časť 4 |
| U1 | LIB | konfigurácia (2.12); `disabledAs` a brána vytvorenia v KA, AA; injekcia návrhov a lenivý sklad v KC, AC; `showTts`, `ttsAudio`, ikona a kľúč TTS; exporty U1 (2.11); nález 24: riadok `uploadStatusFallback: true` z ihriska (4.5) | **všetky testy knižnice bez zmeny** (predvolené = dnes); nové prípady pre druhé hodnoty: `disabledAs="input"` a brána s udeleným a neudeleným právom (oba výbery), injekcia návrhov (chip s ikonou „nové" bez skladu knižnice), `showTts`; **nové prípady v `LT0/damNameChipsUnresolved.test.ts` na dnešnom kóde knižnice** (verzia 4, náhrada za prípady, ktoré U5c vypustí z admin-dam): chip kľúčového slova, keď sa mená nedajú prečítať vôbec (server zlyhá), ukáže `#id` a netočí sa; chip kľúčového slova, ktorého id sa neskôr znova pýta a server ho vráti, sa točí a potom ukáže meno; chip konfliktu autora, keď server zlyhá, ukáže `#id`; chip kľúčového slova s podaným titulkom ho ukáže hneď, bez točenia, ešte pred odpoveďou na mená, a ponechá ho po nej (zodpovedajú `DT/cached/cachedChipUnresolved.test.ts:167,179,215-219`); `LT0/damAuthorKeywordEndpoints` (výbery a „nový autor" pod konfiguráciou s vlastnými adresami) bez zmeny; `LS/publicExportsAdded` nové mená; `LS/i18nLiteralKeys`, `a11y/iconButtonNames`, `a11y/accessibleNames`, `importCycles`, `publicExportsDamConsumers` bez zmeny |
| kontroly a kópia | LIB → DAM | celé kontroly knižnice ako v jadre (sada v prehliadači, druhá sada, `yarn lint:tsc` aj `:test`, oxlint, eslint, stylelint, formát), `yarn build`, `./copy.sh …/admin-dam`; **v tom istom kroku, výslovne** odstrániť z admin-dam augmentáciu `ttsAudio` (`src/plugins.d.ts:31-33`, úprava súboru; žiadna kontrola by ju nepripomenula, `skipLibCheck: true`) a v tej istej úprave opraviť komentár `tsconfig.test.json:3-5`, ktorý zahrnutie `src/plugins.d.ts` zdôvodňuje práve touto augmentáciou; zahrnutie ostáva, súbor rozširuje aj `AclRegistry`, `DefineLocaleMessage` a `RouteMeta` (`src/plugins.d.ts:8-38`) | sada admin-dam zelená a `lint:tsc` admin-dam čistý s nezmeneným kódom admin-dam okrem tej augmentácie; že je odstránená, overí pohľad do súboru |
| U2 | DAM | dva súbory cache → preposielače mien knižnice; `cachedExtSystemId` zapísaný v `initCurrentExtSystemAndLicence` | `DT/cached/cachedChipUnresolved` sa **mení tu**: importuje skutočné cache admin-dam, montuje bez pluginu a čaká `/ext-system/1/`; po U2 by preposlaná cache volala `useCommonAdminCoreDamOptions()` bez pluginu (výnimka, každé id neznáme) alebo s pluginom pýtala `/ext-system/0/` → nainštalovať plugin s `damClient` a zapísať `cachedExtSystemId` cez `useExtSystemIdForCached` (export z U1); náhrada modulu `currentExtSystem` (`:17-19`) ostáva, skutočná inicializácia sa nespúšťa. Ostatné `DT/` **bez zmeny**: ďalších 19 súborov, ktoré cache spomínajú, ich nahrádza podľa cesty (`grep`: `DT/list/detailRequests`, `massEditSelection`, `DT/queue/slotNotifications`, `lazyMetadata`, `queueRefresh`, `slotUploadRow`, `queueOperations`, `uploadFailures`, `DT/fallback/*`, …) a ďalej zasahujú preposielač; vlna 4 inštaluje plugin a púšťa skutočnú inicializáciu |
| U3 | DAM | admin-dam mimo uploadu na bloky knižnice (2.6); `main.ts` a spoločný modul volieb, ktorý číta aj `DT/support/uploadUi.ts:182-185` | menia sa (dôvod): `DT/queue/slotUploadRow` (náhrada DAM chipu podľa cesty už nezasiahne; tvrdenie na skutočný chip), `DT/upload/fileValidation` (funkcie zanikli; prípady proti `useFormatAndSizeCheck` alebo vypustiť, knižnica ich má v `L-ui/__tests__/formatAndSizeCheck.test.ts`); nové testy z U0 (ikona TTS, rozsah validácie detailu) bez zmeny; ostatné `DT/` bez zmeny (`assetMetadataValidation` a `customMetadataForms` ďalej testujú súbory formulárov admin-dam, ktoré riadok a sidebar používajú až do U5); **K-04**: pohľad v prehliadači na zástupný obrázok počas nahrávania (ZK11) |
| U4 | LIB | riadok, zoznam, sidebar: sloty, vlastnosti, väzby (2.2 až 2.4), `UploadQueueItemErrorOverlay`, `createUploadQueueItemRefresh`, vlastnosť `refreshOffered`; ZK1, ZK6 až ZK8; exporty U4 | **všetky testy knižnice bez zmeny** (`LT/uploadQueueRowStates`, `uploadQueueRowRefresh`, `uploadQueueItemRefresh`, `queueRowValidation`, `massOperationsValidation`, `uploadQueueMassOperations`, `uploadQueueDialogSave`, `uploadQueueDialogDrop`, `LT0/consumerProfile*`); nové: riadok s hodnotami admin-dam (každý slot a vlastnosť), `refreshOffered`: bez nej riadok počíta ako dnes (riadok, ktorý sa pripojí už nahratý s upozornením a bez metadát: „Obnoviť" a kôš až po 20 s, pripraviť ako N-Z21, `L/uploadQueue/settlement/__tests__/uploadSettlement.test.ts:1013-1033`), s ňou ukáže presne podanú hodnotu (`true` aj `false`, pri každom stave; polovica `false` musí zahŕňať stav, v ktorom vlastné pravidlo „Obnoviť" ponúka, teda po 20 s alebo `Failed` s `refreshMayHelp` a assetom, inak by nezachytila chybné `refreshOffered \|\| vlastné`), a bez nej aj s **nepodanou** vlastnosťou riadok „Obnoviť" po 20 s ponúkne (stráž proti premene na `false`, 2.2; prípad kľúč `refreshOffered` vôbec neuvedie, lebo výslovné `undefined` Vue nepretypuje a chybu by neodhalil); `hideEditOnDuplicate`: na duplikáte žiadne tlačidlo úpravy, ani predvolené, ani zo slotu, zoznam s väzbou bez jediného volania singletonu knižnice (sklad, cache, voľby, `useAlerts` knižnice nahradené tak, že by volanie zlyhalo), ZK6 (riadok mimo zoznamu sa nepýta) |
| kontroly a kópia | LIB → DAM | ako po U1 | sada admin-dam zelená s nezmeneným kódom admin-dam |
| U5a | DAM | prekrytia na `ADamUploadQueueStopButton` | `DT/queue/overlaySave`, `slotsOverlay`: len anglický text otázky (R10); `DT/upload/uploadStopQuestion`: import z balíka a R10; `DT/upload/uploadStopConfirm`: prepis na balík alebo vypustiť (pokrýva ho `LT/uploadQueueButtonStop.test.ts`); `DT/queue/saveNothing`: jeden `vi.mock` podľa cesty; `DT/a11y/iconButtonNames`: tlačidlo zastavenia admin-dam von zo zoznamu (súbory 4 → 3; tlačidlá `:95` aj dvojice bubliny a mena `:149` 9 → 8) |
| U5b | DAM | obal sidebaru | `DT/queue/massOperationsRows`: anglické texty (R10); `DT/queue/massOperationsSidebar`: prepis nad `uploadUi.ts` alebo vypustiť (pokrýva ho `massOperationsRows`); **formulár hromadných operácií admin-dam tu stratí posledného importéra, preto ho oba testy, ktoré ho importujú, prestanú importovať v tomto kroku**: `DT/queue/customMetadataForms` stratí štyri prípady formulára hromadných operácií (import `:253-254`; tvrdenia vlastného modelu, udalostí a počtu tlačidiel `:262-266,290,299,314-318`), ktoré za obalom vlastní sidebar knižnice a ktoré ako účinok na riadkoch už tvrdí `DT/queue/massOperationsRows.test.ts:141-200`; do jeho prípadu `:141` pribudne jediný chýbajúci bod (všetky zapisovateľné polia naraz, bez „Zobraziť viac", nech ext system pripína čokoľvek); `DT/asset/assetMetadataValidation` stratí prípad „does not stop the save of the selected assets with a required custom field left empty" (`:114`, import `:60-62`), ktorý v knižnici tvrdí `LT/massOperationsValidation.test.ts:41`; `DT/a11y/iconButtonNames`: sidebar a formulár hromadných operácií admin-dam von (číta ich ako text; ich tlačidlá sú odteraz v knižnici a stráži ich `LS/a11y/iconButtonNames.test.ts`): súbory 3 → 1, tlačidlá `:95` aj dvojice `:149` 8 → 2; `DT/queue/queueRefresh` bez zmeny |
| U5c | DAM | obal riadku a zoznamu | `DT/queue/queueRowStates`: štyri anglické texty (R10: „Original Name", „Copy asset ID", text neznámej chyby, „Invalid file type"); `queueRowActions`: jeden (R10); `failReasonChip`: import z balíka a R10; `DT/queue/customMetadataForms`: formulár vlastných metadát z balíka (`ADamAssetCustomMetadataForm`; prípady formulára hromadných operácií, a s nimi texty R10, vypadli už v U5b); prípad „is no field at all, only the button, where the ext system says nothing of pinning" (`:129-138`) sa otočí na dve pripnuté polia (ZK27); `DT/asset/assetMetadataValidation`: formulár vlastných metadát z balíka (prípad formulára hromadných operácií vypadol už v U5b), rozsah DAM výslovne, sklad konfigurácie naplnený namiesto náhrady `useDamConfigState`, a prípad „is stopped by a required custom field behind 'show all'" (`:181-186`) dostane `config.pinned = 0` namiesto `undefined` (dnes spolieha na zálohu 0; so zálohou knižnice 2 by jeho jediné pole bolo pripnuté a prípad by netestoval „za Zobraziť viac", ZK27); `DT/cached/cachedChipUnresolved`: ostáva len chip autora, z balíka (`ADamAuthorCachedChip`); prípady chipu kľúčového slova a chipu konfliktu (ich položky v `kinds` `:57-64` a `:73-80`, ktoré prechádza `describe.each` `:130-198`) a kľúčové slovo v `describe.each` `:200-203` (riadok `:201`) sa vypustia, lebo admin-dam tie dva chipy už nemá a knižnica ich nevyváža; `#id` pri nich, vysvetlenie, text, meno, titulok a prázdny stav stráži `src/domains/dam/__tests__/damNameChipsUnresolved.test.ts` (chipy autora a kľúčového slova `:192-247`, chip konfliktu `:249-306` po U1; pred ním `:94-170` a `:172-229`) spolu s jeho prípadmi z U1 pre zlyhaný server a opätovné pýtanie (`:167`, `:179` admin-dam); náhrada skladu podľa cesty sa vypustí, ikonu „nové" dáva injekcia a prípad „shows the id, and says why, when the server does not return the record" (`:156-165`, tvrdenie `:164`) sa zmení: chipy knižnice vysvetlenie dávajú do `VTooltip`, nie do atribútu `title`, ktorý hľadá `explained()` (`:104`); prípad „shows the id as plain text too" (`:204-213`) platí ďalej, lebo variant `textOnly` titulok drží (ZK14); `DT/queue/queueRowValidation`: prepis nad `uploadUi.ts` (náhrady podľa cesty a `useDamConfigState` na vstupe knižnicu nezasiahnu); `DT/a11y/iconButtonNames`: zoznam sa prepne na tri obaly admin-dam (`AssetQueueItemEditable`, `AssetQueueEditable`, `AssetQueueSelectedSidebar`) a tvrdí, že žiadne ikonové tlačidlo v nich nie je bez mena (dnes v nich žiadne nie je, kôš je `AActionDeleteButton` knižnice); oba počty, `:95` aj `:149`, idú 2 → 0; nový prípad z U0 „na duplikáte nie je žiadne tlačidlo úpravy" musí ostať zelený (stráž `hideEditOnDuplicate`); `queueRowKeywordsAuthors` bez zmeny okrem prípadu konfliktov autora (`:201-229`), ktorý otočí oprava nálezu 44, keď riadok admin-dam začne používať výber knižnice (dôvod „nález 44", nie U5c; 4.5); `queueListRow`, `queueRefresh`, `overlaySave`, `slotsOverlay`, `lazyMetadata` bez zmeny; potom celé kontroly admin-dam a build; **K-04**: pohľad na zoznam fronty na šírke md a väčšej (ZK5); **K-14**: selektory e2e admin-dam proti vykreslenému DOM |
| U6 | LIB | rámec (s `roiEditable`, 2.8), rámec sidebaru, adaptéry, `AssetFileInfoPanel`; detail a dialóg jedného súboru na nich; ZK23, ZK25 | **bez zmeny**: `LT/uploadQueueDialogSingle`, `LT0/consumerProfileUploadDialogSingle` (aj „the editor of the region of interest": s právom upraviteľný, bez neho `readonly`, `:412-450` (po U0-L; pred ním `:252-275`)), `LW/consumerProfileImageWidgetUpload`, `LT0/damAuthorKeywordEndpoints` (opis „the two dialogs of an upload, on save and apply"); testy detailu z U0 (aj editor bez práva) bez zmeny; **K-04**: pohľad na dialóg jedného súboru (ZK23) |
| U7 | LIB | `createDamImage` na deviatich miestach | **bez zmeny**: `LW/metadataToImageMap`, `consumerProfileImageWidgetUpload`, `consumerProfileImageWidgetMultipleUpload`, `consumerProfileImageWidgetLibrary`, `ImageWidgetInnerExpandMetadata`, `ImageWidgetMultipleInner`, `ImageMediaWidgetInner`, `ImageWidgetsCopyToLicenceFailure`; testy miest z U0 bez zmeny |
| kontroly a kópia | LIB → DAM | ako po U1 (admin-dam U6 a U7 nepoužíva; kópia drží admin-dam na jednom builde) | |
| U8 | LIB → DAM | prvá sada, bod 7: názov poľa v prístupnom mene „vyplniť prázdne" a „nahradiť všade"; nové kľúče s `{field}` v sk, en, cs | menia sa: `LT0/consumerProfileUploadMassOperations` (pomocník `:78`), `DT/queue/massOperationsRows` (prípady formulára hromadných operácií v `customMetadataForms` vypadli v U5b); e2e admin-dam hľadá podľa mena len tri tlačidlá dole (`assetBulkEditPage.ts:193-201`), tých sa to netýka |
| U9 | obe | (a) vlastník zmaže súbory admin-dam bez importéra jedným príkazom (zoznam 2.10, s cestami doplnenými v kroku); (b) nepoužité kľúče `coreDam.*`, `system.upload.*` v jazykoch admin-dam (voliteľné); (c) changelogy; (d) register uzavrieť | `DT/a11y/iconButtonNames` ostáva nad tromi obalmi (po U5c už nečíta nič zo zmazaných súborov; keby sa obaly niekedy zmazali, test ide s nimi); celé kontroly oboch strán; **K-14**: e2e admin-dam púšťa vlastník |

**K-02** (testy menované v tejto tabuľke ostanú zelené, alebo sa zmenia len z uvedeného dôvodu) ukazuje každý krok U1 až
U8 svojím stĺpcom „Stráži"; K-04 a K-14 sú pri krokoch U3, U5c, U6 a U9 (4.4). Opravy rozhodnuté 9. 10. idú ako
samostatné kroky po týchto krokoch (4.5); testy, ktoré otáčajú, sú pri nich.

### 4.2 U0: testy dnešného správania, ktoré chýbajú

| Kde | Test | Prečo |
|---|---|---|
| LIB `L/assetDetail/__tests__/assetDetailDialog.test.ts` (nový) | nadpis „zdrojový systém: názov"; zatvorenie vyčistí detail a zavrie; prepínač sidebaru; editor oblasti pri záložke „Fókus" aj pri jednoduchom sidebare, inak obrázok z `image_detail` (a 356×200 `#ccc` bez neho); **editor upraviteľný s právom `dam_regionOfInterest_update` a len na čítanie bez neho** (pri `/adm/v1/roi`; pri inej adrese bez kontroly); záložka „Fókus" len pri obrázku; `AssetInfobox` so stavom a dôvodom; panel súboru s chipmi používateľov | detail knižnice dnes priamo nič nemontuje (widgety ho nahrádzajú); U6 ho prestavia a presúva kontrolu práva do rámca |
| LIB `LW/damImageSites.test.ts` (nový) | `AImagePublicInput.submit()`: telo `createImage` a `updateImage` (orezané texty, pozícia 0, `id` len pri uloženom), objekt náhľadu (licencia 0, bez pozície); `ImageDetailDialogMetadata`: obrázok média s `showSource: false` | IM7, IM8, IM9 nemajú test |
| LIB `LT/uploadQueueRowRefresh.test.ts` (nové prípady) | riadok, ktorý sa pripojí už `Uploaded`, bez metadát a s upozornením (`hasError`, text `readFailed`): „Obnoviť" ani kôš pred 20 s nie sú, po 20 s sú oba; prípravu riadku prevziať z N-Z21 (`L/uploadQueue/settlement/__tests__/uploadSettlement.test.ts:1013-1033`) | RD12, strana knižnice; dnes to netvrdí žiadny test riadku (K-07) |
| DAM `DT/queue/queueRowStates.test.ts` (nové prípady) | (a) riadok, ktorý sa pripojí už `Uploaded` s chybou: „Obnoviť" hneď; (b) riadok, ktorý je už `Uploaded` bez metadát a chyba (upozornenie) mu príde až potom: „Obnoviť" až po 20 s od prechodu, nie skôr; (c) pri chybe ostane „Obnoviť" aj po príchode metadát | RD12, strana admin-dam (Codex v2): presný prepis watchera v obale musí tieto tri prípady držať; (a) a (c) už pripínajú prípady vlny 4 („at once with an error", „kept beside an error", `dam-vlna4.md`, DC1), nový je len (b) |
| DAM `DT/queue/queueRowStates.test.ts` (nový prípad, verzia 4) | riadok duplikátu nemá **žiadne** tlačidlo úpravy, nech má akýkoľvek text: v ľavej časti riadku nie je žiadne tlačidlo (dnešný `:335-339` hľadá len presné „Edit more", a tak by prešiel aj s vypnutým „Upraviť v DAM" knižnice) | RD5 (posudok Opusa v3): stráži `hideEditOnDuplicate` v U5c. Dôkaz ohnutím (ako `dam-vlna4.md`, časť 4): do ľavej časti riadku (dnes `AQIE:367-377`, po U5c obsah slotu `edit` v obale) sa na duplikáte vloží tlačidlo s **iným textom** než „Edit more" (napríklad „Upraviť v DAM"); prípad musí očervenieť. Samotné vypustenie `v-if` nestačí, to zhodí aj `:335-339` a nedokáže nič nové |
| DAM `DT/list/assetMetaIconsTts.test.ts` (nový) | ikona TTS a jej titulok „Syntetické (TTS)" v dlaždici aj v riadku tabuľky; nie pri asset bez `ttsAudio` | dnes len e2e |
| DAM `DT/asset/assetDetailMetadataScope.test.ts` (nový) | sidebar detailu assetu (`AssetDetailSidebarMetadata`) neuloží, keď povinné vlastné pole alebo povinné kľúčové slová v `AssetMetadata` chýbajú, a ukáže chybu validácie | U3 prepne `AssetMetadata` na formulár a výbery knižnice; rozsah DAM ide odvtedy výslovne (FM4); bez rozsahu by sidebar nevalidoval nič (podklad 7, pár 6) |
| DAM `DT/author/authorListCreate.test.ts` (nový, voliteľný) | „nový autor" na stránke autorov: dialóg, `POST /adm/v1/author`, zoznam po vytvorení, bez presmerovania | U3 mení tlačidlo a udalosť |

### 4.3 Stráže podľa komponentu (vlna 4 a staršie)

Vlna 4 knižnice: 12 súborov, 261 prípadov (`lib-vlna4.md`); admin-dam: 10 súborov, 201 prípadov (`dam-vlna4.md`).

| Komponent | Knižnica (bez zmeny, ak nie je uvedené) | admin-dam |
|---|---|---|
| Riadok | `LT/uploadQueueRowStates` (30), `uploadQueueRowRefresh` (17; aj tvar udalosti „Obnoviť" `:129-131,172`), `queueRowValidation` (2), `LT0/consumerProfileUploadQueueRows` (21); nové v U4: `hideEditOnDuplicate`, `refreshOffered` aj nepodaná | `DT/queue/queueRowStates` (64; R10, štyri texty; nové z U0: RD12 (b) a „na duplikáte žiadne tlačidlo úpravy"), `queueRowActions` (17; R10, jeden), `queueRowKeywordsAuthors` (10), `failReasonChip` (jeden prípad); `queueRowValidation` (prepis); `DT/a11y/iconButtonNames` (U5a až U5c, 4.1) |
| Zoznam | `LT/uploadQueueItemRefresh` (12; emituje bez `item`, `:194,215,247`), `LT0/consumerProfileUploadQueueRows`, `consumerProfileUploadDialogActions` (22) | `DT/queue/queueRowActions`, `queueRefresh` (bez zmeny), `massOperationsRows` (14) |
| Hromadné operácie | `LT0/consumerProfileUploadMassOperations` (20; U8), `LT/massOperationsValidation` (1), `uploadQueueMassOperations` | `DT/queue/massOperationsRows` (R10, U8), `customMetadataForms` (14; U5b: štyri prípady formulára hromadných operácií vypadnú, pokrýva ich `massOperationsRows:141-200` s jedným pridaným tvrdením; U5c: formulár vlastných metadát z balíka, ZK27), `lazyMetadata` (bez zmeny), `massOperationsSidebar` (prepis), `DT/a11y/iconButtonNames` (U5b) |
| Tlačidlo zastavenia | `LT/uploadQueueButtonStop` (6) | `DT/upload/uploadStopQuestion` (6; cesta, R10), `DT/queue/overlaySave` (30; R10), `slotsOverlay` (9; R10), `DT/upload/uploadStopConfirm` (prepis alebo vypustiť), `DT/queue/saveNothing` (`vi.mock`), `DT/a11y/iconButtonNames` (U5a) |
| Formulár vlastných metadát | `L/assetDetail/__tests__/AssetCustomMetadataFormPinned` (3+; aj záloha 2 pri chýbajúcom čísle), `LT/queueRowValidation` | `DT/queue/customMetadataForms` (U5c; jeden prípad sa otočí, ZK27), `DT/asset/assetMetadataValidation` (U5c; cesta, rozsah, `pinned: 0` v `:181-186`, ZK27), nový test rozsahu detailu z U0 |
| Obrázok, ikony, chip | cez riadok a dialógy (náhrada `AssetImage` podľa mena) | `DT/queue/failReasonChip` (15), `queueListRow` (22), nový test TTS |
| Autori, kľúčové slová, chipy, cache | `LT/uploadQueueDialogSingle`, `LW/ImageMassOperations` (náhrada podľa mena), `LT0/damAuthorKeywordEndpoints`, `LT0/damNameChipsUnresolved` (nové prípady v U1) | `DT/queue/queueRowKeywordsAuthors`, `DT/cached/cachedChipUnresolved` (U2 plugin a ext system cez `useExtSystemIdForCached`; U5c ostane chip autora z balíka, `:164` podľa ZK14, chip kľúčového slova a chip konfliktu vypadnú a stráži ich knižničný `LT0/damNameChipsUnresolved` s prípadmi pridanými v U1 pre zlyhaný server a opätovné pýtanie), testy s náhradou cache podľa cesty (bez zmeny) |
| Výber súborov | `L-ui/__tests__/formatAndSizeCheck`, `AFileInput`, `AFileInputDialog` | `DT/upload/fileValidation` (vypustiť alebo prepísať), `DT/upload/assetUploadLimit` (bez zmeny) |
| Detail a dialóg jedného súboru | `LT/uploadQueueDialogSingle` (21), `LT0/consumerProfileUploadDialogSingle` (34; aj editor oblasti s právom a bez neho), `LW/consumerProfileImageWidgetUpload` (24), nový test detailu (aj editor bez práva) | — |
| Objekt obrázka | `LW/metadataToImageMap` (16), tri súbory `consumerProfileImageWidget*`, nový test miest | — |

**Zhrnutie stráží.** Žiadne existujúce tvrdenie testov knižnice sa v U1 až U7 nemení (pribúdajú nové prípady a
nové mená v `LS/publicExportsAdded`); v U8 sa mení jeden pomocník. Z vlny 4 admin-dam ostanú
bez zmeny `queueRowKeywordsAuthors` a `queueListRow` (overené, K-03: ani reťazec, ani kľúč R10). Sedem súborov zmení len
očakávané anglické texty (R10), cestu importu (komponent zanikol podľa plánu) alebo mená z U8, a `massOperationsRows`
dostane navyše jedno tvrdenie do prípadu `:141`. `customMetadataForms` zmení viac: v U5b stratí štyri prípady formulára
hromadných operácií (za obalom ich vlastní sidebar knižnice; ich účinok na riadkoch tvrdí `massOperationsRows:141-200`)
a v U5c sa v ňom otočí prípad zálohy pripnutých polí (ZK27), jediné otočené tvrdenie vlny 4. Zo starších testov admin-dam sa prepíšu štyri
(`queueRowValidation`, `massOperationsSidebar`, `uploadStopConfirm`, `assetMetadataValidation`; posledný v U5b stratí
prípad formulára hromadných operácií, ktorý tvrdí knižničný `LT/massOperationsValidation:41`), jeden sa vypustí
alebo prepíše (`fileValidation`), štyri dostanú malú úpravu (`slotUploadRow`, `cachedChipUnresolved` v U2 a U5c,
`saveNothing`, `a11y/iconButtonNames` v U5a až U5c, vrátane počtu bublín `:149`). Dôvod každej zmeny je v tomto
riadku. Dve z nich idú za zblížením, ktoré niečo mení: `cachedChipUnresolved.test.ts:164` za ZK14 (vysvetlenie v bubline
aplikácie namiesto natívneho titulku, kozmetika) a `customMetadataForms.test.ts:129-138` za ZK27; `assetMetadataValidation`
dostane `pinned: 0`, aby po ZK27 testoval to isté. Ostatné sú cesty, texty R10 a mená U8, nie zmena správania.
Opravy po krokoch (4.5) otočia ďalšie tvrdenia, každé s dôvodom svojho nálezu; v admin-dam je to prípad konfliktov
autora v `queueRowKeywordsAuthors` (nález 44, prejaví sa v U5c) a texty potvrdzovacieho tlačidla otázky pri
zastavení (nález 43).

### 4.4 Čo ukáže až implementácia (z kontrol predpokladov)

Tri predpoklady sa čítaním ani pokusom overiť nedajú (`krok5/overenia.md`, „Čo ostáva otvorené"). Každý má svoju
bránu; krok, ktorý ju má, neskončí, kým ju neukáže.

| # | Čo | Brána | Ako |
|---|---|---|---|
| K-02 | testy menované v 4.1 ostanú zelené (alebo sa zmenia len z uvedeného dôvodu) | U1 až U8 | cielené sady každého kroku v 4.1; pred každou kópiou celé kontroly knižnice, po U5c celé kontroly admin-dam; dnešný stav je zelený (K-08) |
| K-04 | vzhľad ZK5 (okraj zoznamu admin-dam), ZK11 (zástupný obrázok), ZK23 (okraj tlačidiel dialógu jedného súboru); ZK24 a ZK26 sú vypustené | U3 (ZK11), U5c (ZK5), U6 (ZK23) | po kroku pohľad v prehliadači: admin-dam (zoznam fronty na šírke md a väčšej, dlaždice a riadky assetov počas nahrávania) a ihrisko knižnice alebo admin-cms (dialóg jedného súboru); ak pohľad ukáže viac než opísaný rozdiel, zblíženie sa vráti a zapíše |
| K-14 | e2e admin-dam po presune komponentov (selektory v R-K9) | U5c; e2e púšťa vlastník v U9 | po U5c sa selektory e2e (`assetBulkEditPage.ts`, `errorPaths.spec.ts`, `assetTtsPage.ts`, `assetTts.spec.ts`, …) porovnajú s vykresleným DOM v testoch vlny 4; beh e2e je v U9 u vlastníka |

### 4.5 Opravy po krokoch (rozhodnutia vlastníka 9. 10.)

Kroky U menia správanie len v rozsahu registra (6) a rozhodnutých zmien (6.2). Opravy, ktoré vlastník rozhodol
9. 10., preto nejdú *do* kroku U, ktorý ten kód prepisuje, ale ako malý samostatný krok hneď *po* ňom, v tom istom
strome, keď je súbor otvorený, otestovaný a v posudku (`krok5/analyzy/ostatne-otvorene-nalezy.md`, „Ako čítať").
Výnimka je nález 24 v U1 (riadok ihriska, aplikácie sa ho netýka), ako ho zaradil vlastník. Test admin-dam, ktorý
oprava v knižnici otočí, sa mení v kroku, ktorý ju do admin-dam prinesie (kópia alebo krok U, od ktorého admin-dam
ten komponent používa), s dôvodom „nález N"; krok U ho za svoj nepočíta. Odhady sú z analýz a plánu.

| Nález | Po kroku | Strom, kód | Oprava | Testy | Kto to uvidí | Odhad |
|---|---|---|---|---|---|---|
| 24 | v U1 | LIB `src/playground/playground.ts:39` | zmazať riadok `uploadStatusFallback: true` (voľba nič nerobí); profil testov (`LT0/support/consumerProfiles.ts:108,236`) ju drží zámerne, napodobňuje aplikácie | — | nikto (ihrisko) | 5 min |
| 44 | U1 | LIB `L/author/components/AuthorRemoteAutocompleteWithCached.vue:264-280` (pred U1; po U1 `:278-294`; prejaví sa len v riadku fronty a dialógu jedného súboru admin-cms, posudok N44) | ponúkať len konflikty, ktoré ešte nie sú medzi vybranými autormi; keď nezostane žiadny, nezostane ani nadpis „konflikty" | nový prípad v knižnici (stlačený konflikt pribudne k autorom a zmizne, s posledným aj nadpis; autor, ktorého pole už má, sa neponúkne); `LT/uploadQueueDialogSingle.test.ts:437-449` ostáva (položka ponúkané autory nemá); admin-dam: `DT/queue/queueRowKeywordsAuthors.test.ts:201-229` dnes pripína „Jane" ponúknutú, hoci ju riadok má (`:212`), a nadpis po stlačení (`:221`); otočí sa v U5c s dôvodom „nález 44" | admin-cms (riadok fronty, dialóg jedného súboru, (oprava 10. 10., posudok N44: detail a widgety konflikty nikdy nedostanú, len riadok fronty a dialóg jedného súboru): všade, kde výber dostane konflikty), admin-dam od U3 (detail) a U5c (riadok); admin-ugc autorov nemá | 1 h |
| 28 | U4 | LIB `createUploadQueueItemRefresh` (2.3, pravidlo 2; dnes `L/uploadQueue/composables/uploadQueueItemRefresh.ts:44`, DAM `D/asset/components/queue/AssetQueueEditable.vue:37`) a `useUploadQueueItemRefresh`, keď dostane riadok (dialóg jedného súboru; obe nad spoločnou `refreshAndSay`, krok 28 10. 10.) | „stále sa nahráva alebo spracúva" len vtedy, keď riadok medzitým neskončil ani neodišiel z fronty: tá istá podmienka, akú už má „nepodarilo sa načítať"; bez riadku (len ID assetu) ako doteraz | nové prípady v `LT/uploadQueueItemRefresh` (riadok, ktorý počas čítania usadila notifikácia, zastavil sa alebo odišiel z fronty, pri `pending` hlášku nedostane; riadok, ktorý ostal, áno); `LT/uploadQueueItemRefresh.test.ts:129` (pred krokom `:125`), `LT0/consumerProfileUploadQueueRows.test.ts:235` a `DT/queue/queueRefresh.test.ts:278-288` (riadok sa nezmenil) ostávajú | admin-cms a admin-ugc (riadok fronty, dialóg jedného súboru; admin-cms pri notifikácii o zlyhaní alebo duplikáte, zastavení, odstránení či zatvorení dialógu počas čítania, „spracované" len v malom okne (6.2); admin-ugc bez notifikácií DAM len pri zastavení, odstránení či zatvorení, 6.2); admin-dam až s C3 (zoznam knižnice cez U5c robí „Obnoviť" aj za neho) | 0,5 h |
| 46 (PK3) | U4 | LIB `L/uploadQueue/components/UploadQueueEditable.vue` (obsluha klávesov, dnes `:56-108`, prípady `:64-88`) | kláves, ktorého cieľ je `textarea`, prvok s `isContentEditable` alebo `input` iného typu než `checkbox`, `button`, `submit`, `reset`, `image`, `file` (PK3-c1: prepínač ostáva ako dnes), obsluha nechá prehliadaču: neposunie zoznam a nevolá `preventDefault` | nové prípady v knižnici: v poli riadku šípky hore a dole, PageUp, PageDown, Home, End nie sú zablokované a zoznam stojí; mimo poľa sa zoznam posúva ako dnes (stráž, že posun ostal); dnes posun nepripína žiadny test | admin-cms a admin-ugc (dialóg fronty); admin-dam nie (`keyboardScroll: false`, ZN3) | 1,75 h |
| 43 | U5a | LIB `L/uploadQueue/components/UploadQueueButtonStop.vue:86`, jazyky sk, en, cs | potvrdzovacie tlačidlo otázky dostane vlastný kľúč (napríklad `common.damImage.upload.stopConfirm`): SK „Zastaviť", EN „Stop", CS „Zastavit"; ikonové tlačidlo, ktoré otázku otvorí (bublina a `aria-label`, `:46,59`), a krížik otázky (`ADialogToolbar`) ostávajú „Zatvoriť" / „Close" | knižnica: `LT/uploadQueueButtonStop.test.ts:53` (text potvrdenia); admin-dam s kópiou, ktorá opravu prinesie: tlačidlo otázky `'Close'` → `'Stop'` v `DT/upload/uploadStopQuestion.test.ts:64,118`, `DT/queue/slotsOverlay.test.ts:131,147,178`, `DT/queue/overlaySave.test.ts:329,361` (otvárajúce tlačidlo `uploadStopQuestion:56`, `slotsOverlay:45`, `overlaySave:106` ostáva); e2e admin-dam kliká podľa `data-cy`, ten sa nemení (K-14 to pozrie) | všetky tri (6.2) | 1 h |
| 38 | U5c | DAM obal `D/asset/components/queue/AssetQueueEditable.vue` a obsah slotu `remove` v `AssetQueueItemEditable.vue` (dnes `AssetQueueEditable.vue:60-62`, `AQIE:167-176`) | kôš pošle riadok, ako „Obnoviť", a zoznam odoberie ten riadok (`removeByIndex` jeho indexu), nie prvý s tým assetom | nový prípad v admin-dam: dva riadky jedného assetu, zmazanie na druhom odoberie druhý | nikto dnes (cestu k dvom riadkom jedného assetu s košom analýza nenašla, neoverené); len admin-dam | 0,5 h |
| 25 | U6 | LIB `L/uploadQueue/components/UploadQueueDialogSingleSidebar.vue` (dnes `:59-88`; po U6 „Obnoviť" ako vlastný kód dialógu, JS20) | „Obnoviť" aj pri zlyhanej položke tam, kde ho ponúka riadok: `Failed`, `refreshMayHelp` skladu a položka má asset (pravidlo riadku `UQIE:161-162`); po stlačení to isté čítanie a tie isté upozornenia ako dnes | `LT/uploadQueueDialogSingle.test.ts:328-348` sa otočí v `:347`: duplikát s nečitateľným originálom po stlačení zlyhá a tlačidlo ostane (bez upozornenia, `:346` platí); `:401-412` („has failed") ostáva, ak `refreshMayHelp` pre ručne zlyhanú položku vráti `false` (overí krok); nový prípad: zlyhaná položka, ktorej obnovenie môže pomôcť, „Obnoviť" ponúkne a stlačenie číta znova | admin-cms a admin-ugc (dialóg jedného súboru) | 1,5 h |
| 30 | U7 | LIB `L/imageWidget/components/ImageWidgetInner.vue:344-350`, `ImageMediaWidgetInner.vue:352-358`; pozrieť `ImageWidgetMultipleInner.vue:197-204` | keď po kontrole formátu nezostane žiadny súbor, widget nič nezaradí a dialóg uploadu neotvorí (ako `L/assetSelect/components/AAssetListInner.vue:206`); upozornenie ostáva | `LW/consumerProfileImageWidgetUpload.test.ts:276-292` sa otočí (dialóg sa neotvorí); rovnaký prípad pre widget s médiom | admin-cms a admin-ugc | 1 h |
| 31 | U7 | LIB `L/imageWidget/components/ImageWidgetMultipleInner.vue:404-416`, `L/uploadQueue/components/UploadQueueDialog.vue:130-140` | pozíciu nových obrázkov galérie pri „uložiť a použiť" prideľuje len widget; dialóg fronty ju prestane zvyšovať | `LW/consumerProfileImageWidgetMultipleUpload.test.ts:329-331` sa otočí (`[1, 2, 5, 6]` → `[1, 2, 3, 4]`) | čísla pozícií poslané do CMS v galérii (admin-cms, admin-ugc); poradie sa nemení | 1 h |
| 36 | U7 | LIB `L/imageWidget/utils/damImage.ts` (súbor U7), `ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`, `L/api/damAssetApi.ts:230` | (A) do `createImage`/`updateImage` len polia obrázka (`id`, `texts`, `flags`, `dam`, `position`; `id` a `position` len ak sú, ako dnes) cez vnútornú pomôcku vedľa `createDamImage`; (A2) to isté pre galériu pred `bulkUpdateImages`, na kópii, po zápise autorov; (B) widget nečíta obrázok, ktorý práve vytvoril (jednorazová značka uloženého id pred `modelValue = res.id`; iné zmeny id čítajú ako dnes); (C) `mainFileSingleUse` `override ?? item.mainFileSingleUse ?? false` | A: `LW/consumerProfileImageWidgetUpload.test.ts:330,358,444,463` (volania bez `authorIds`, `assetId`; tvrdenia detailu `:303,353,495` ostávajú); A2: nový prípad (telo galérie len s poľami obrázka; `consumerProfileImageWidgetMultipleUpload.test.ts:421-428` ostáva); B: `consumerProfileImageWidgetUpload.test.ts:328-336` (bez druhého čítania), `ImageWidgetInnerExpandMetadata.test.ts:68` ostáva; C: `LT0/damAssetApiBulkMetadata.test.ts:99-106` (`null` → `false`) | B: náhľad po vytvorení neblikne a neukáže chybu po úspešnom uložení (admin-cms, admin-ugc); A, A2: kratšie telo a audit log CMS bez `authorIds`, `assetId` (admin-cms; admin-ugc telo skladá sám); C: nič, DAM ukladá `false` aj dnes. Uložené dáta sa nemenia | 3 h |

**Schválené vo verzii 5.1** (nález 49, knižničná polovica, `krok5/analyzy/nalez49-frontend.md`, 7; nálezy 45 a 47).
Pravidlo nálezu 49 je jedna vnútorná funkcia knižnice (nevyváža sa; admin-dam si píše svoju pre F-A a F-B, analýza
7.1): asset **nie je popísaný** (`flags.described`) a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored`
(`AssetFileProcessStatus`); rozhoduje čítanie assetu, nie notifikácia. Súbor `failed`, `duplicate`, asset bez súboru
a popísaný asset rizikové nie sú.

| Nález | Po kroku | Strom, kód | Oprava | Testy | Kto to uvidí | Odhad |
|---|---|---|---|---|---|---|
| 49, F-C | U6 | LIB `L/assetDetail/components/AssetDetailSidebarMetadata.vue:48-90` (U6 ho nemení, je to obsah záložky „Info" detailu) a nová vnútorná funkcia pravidla | „Uložiť" detailu vypnuté pre rizikový asset; pri ňom veta z **existujúceho** kľúča `common.damImage.queueItem.stillUploadingOrProcessing` (6.2). Detail sa nečíta znova sám; po spracovaní ho používateľ otvorí znova. Pokryje „Upraviť v DAM" vo výbere assetu aj „Upraviť asset" vo widgetoch; **nie je pravda, že okno uploadu sa nemení** (FC-47-c1): detail otvorený z riadku fronty počas spracovania súboru má „Uložiť" tiež vypnuté (6.2) | nové prípady v teste detailu z U0 (`L/assetDetail/__tests__/assetDetailDialog.test.ts`): rizikový asset (každý z troch stavov) má „Uložiť" vypnuté a vetu; popísaný asset, spracovaný, zlyhaný, duplikát a asset bez súboru ho majú zapnuté; nič existujúce sa neotočí (dnes detail stav nečíta) | admin-cms a admin-ugc, len pri assete vloženom do hľadania výberu podľa čerstvého ID (analýza 5.2); admin-dam má vlastný detail (F-B, mimo tohto návrhu) | 1,5 h |
| 49, F-D | U6 a U7 (mení súbory widgetov, ktoré prepisuje U7), spolu s F-C alebo hneď po ňom; bez F-C nie | LIB `L/imageWidget/components/ImageWidgetInner.vue:458-467`, `ImageMediaWidgetInner.vue:575-581` | pri výbere rizikového assetu bez autorov widget nezapne pole autorov DAM (`showDamAuthorsInCmsImage` ostane `false`), takže potvrdenie dialógu obrázka nezavolá `updateAssetAuthors` s `described: true` | nový prípad pre oba widgety: rizikový asset bez autorov pole autorov DAM nedostane a `updateAssetAuthors` sa nevolá; spracovaný asset ho dostane ako dnes | admin-cms (ext system s autormi); admin-ugc autorov nemá | 1 h |
| 45 (N1) | U7 | LIB `L/imageWidget/components/ImageMediaWidgetInner.vue:565-583` | vybraný asset ide cez `customAssetSelectMetadataToImageMap`, keď ho aplikácia má, presne ako `ImageWidgetInner.vue:446-449` (vetva autorov DAM a teda aj F-D je potom len bez vlastného mapovania, ako vo widgete obrázka) | nový prípad: widget s médiom s vlastným mapovaním vezme popis a zdroj z neho (vzor `LW/consumerProfileImageWidgetLibrary.test.ts`) | dnes nikto: admin-cms mapovanie nemá, admin-ugc widget s médiom nemá | 1 h |
| 47 | U6 a nález 25 (a U7, ak ešte nebol: tie isté súbory widgetov) | LIB `ImageWidgetInner.vue` a `ImageMediaWidgetInner.vue`, obsluha pustenia (`onDrop`, zaradenie `:314`); `AFileDropzone` (`L-ui/components/AFileDropzone.vue:46-52`, `useDropZone` s predvoleným `multiple: true`) sa nemení, lebo ho používajú aj galéria a výber assetu | widget s jedným obrázkom z viacerých pustených súborov zaradí len prvý a ukáže upozornenie (nový kľúč, 6.2); dialóg jedného súboru tak vždy dostane jednu položku a prepínač jednorazového použitia sa nezapíše iným riadkom. Výber súboru cez menu viac súborov nepustí už dnes (`AFileInputDialog`, `multiple: false`) | nový prípad pre oba widgety: dva pustené súbory → vo fronte jeden riadok (prvý), upozornenie, dialóg s jednou položkou; jeden pustený súbor ako dnes; `ImageWidgetCollab`, `ImageMediaWidgetCollab` („two drops") ostávajú (dve pustenia, nie dva súbory) | admin-cms a admin-ugc (widget obrázka a widget s médiom) | 1 h (môj odhad, analýza ho nemá) |

**Poradie po U7.** 30, 31, 36, 45, F-D a 47 menia tie isté súbory widgetov (36 aj súbor U7), preto idú za sebou,
nikdy súbežne s U7 ani s krokom nálezu 20 (tie isté tri volania kópie do licencie; v tom istom kroku aj voľba
`copyToLicenceEnabled`, 2.12). PV14a a PV14b (2.13) idú po
nich.

---

## 5. Riziká a otázky

### 5.1 Blokuje začiatok

**Nič.** U0 a U1 sa môžu začať hneď. U2 a ďalšie kroky admin-dam potrebujú kópiu knižnice po U1 a v tom istom
kroku výslovne odstránenú augmentáciu `ttsAudio`. Na rozhodnutie vlastníka nečaká žiadny
krok: štyri témy aj nálezy 45, 47 a 49 (časť knižnice) vlastník rozhodol 9. 10. (5.2); opravy sú samostatné kroky
po krokoch U (4.5). Podmienka pre U9: vlastníkov príkaz na zmazanie.

### 5.2 Pre vlastníka

**Produktové témy a chyby, na ktoré používateľ narazí: rozhodnuté vlastníkom 9. 10.** (denník, „Otvorené témy,
rozhodnutia vlastníka", body 5 až 7, „V0", dávka 2, a „Rozhodnutia vlastníka k analýzam", bod 5). Kroky U ich
nemenia; opravy idú po nich (4.5):

| Téma | Čo | Rozhodnutie | Kde a kedy |
|---|---|---|---|
| PV15 jadra; nálezy 34, 41 (HO10) | „Nahradiť vo všetkých" s prázdnym výberom vymaže kľúčové slová a autorov každého riadku, na oboch stranách | **želaný stav**, téma uzavretá | nič sa nemení; spoločný sidebar to robí ako dnes |
| Nález 25 (JS21) | dialóg jedného súboru v knižnici neponúka „Obnoviť" pri zlyhanej položke, kde riadok fronty áno | **opraviť**: dialóg dostane pravidlo riadku (`Failed`, `refreshMayHelp` skladu, asset) | `UQDSS`, krok po U6 (4.5) |
| Nález 36 (IM10) | do API obrázkov idú z mapovania uploadu aj `authorIds` a `assetId` (galéria aj `key`, `damAuthors`, `showDamAuthors`); po vytvorení widget číta obrázok ešte raz; dialóg jedného súboru pošle `mainFileSingleUse: false` za prázdny riadok, dialóg fronty `null` | **opraviť** podľa analýzy (`krok5/analyzy/nalez36-co-ide-do-api-obrazkov.md`): len polia obrázka, bez druhého čítania, `false` namiesto `null`; uložené dáta sa nemenia | widgety, pomôcka vedľa `createDamImage` v `damImage.ts`, `damAssetApi.ts`; krok po U7 (4.5) |
| **PK3** (nález 46, pri ZN3; potvrdené v prehliadači, `krok5/overenia.md`, K-13) | **Pri písaní metadát v dialógu fronty v admin-cms a admin-ugc nefungujú klávesy Home, End, šípky hore a dole, PageUp a PageDown.** Kurzor v poli sa nepohne, namiesto toho sa posunie zoznam riadkov; pri šípke hore alebo dole v dlhšom texte zostane kurzor na starom mieste a napísané písmeno pribudne tam. Príčina: posun zoznamu klávesmi počúva na celom dokumente, nepozerá, kde je kurzor, a klávesu „zje" (`preventDefault`, `L/uploadQueue/components/UploadQueueEditable.vue:56-108`). admin-dam to nemá (obsluhu nepoužíva, ZN3). | **opraviť** (V0, dávka 2): kláves s cieľom v editovateľnom prvku nechať prehliadaču | spoločný zoznam, len pri `keyboardScroll` (knižnica); krok po U4 (4.5) |

Žiadny produktový rozdiel medzi stranami návrh nenavrhuje zblížiť; všetky ostávajú na svojej strane (6.3).

**Nové nálezy, rozhodnuté 9. 10.** (v denníku; kroky U ich nemenia, opravy idú po nich, 4.5):

| # | Nález | Čo o ňom vieme | Rozhodnutie a kde |
|---|---|---|---|
| N1 (denník 45) | `ImageMediaWidgetInner` pri vybranom assete nepoužije vlastné mapovanie aplikácie (`customAssetSelectMetadataToImageMap`), `ImageWidgetInner` áno (IM11) | dnes to nikto nedosiahne: admin-cms mapovanie nemá, admin-ugc widget s médiom nemá | **opraviť**: widget s médiom použije vlastné mapovanie ako widget obrázka; po U7 (4.5) |
| 47 | Viac súborov pustených na widget s jedným obrázkom sa zaradí do fronty všetky (`useDropZone` má predvolene `multiple: true`); dialóg jedného súboru zapíše prepínač jednorazového použitia prvého riadku všetkým riadkom a widget použije len prvý obrázok (LIB) | analýza nálezu 36, kap. 6; odvodené z kódu, nespúšťané; ostatné nahraté assety ostanú v DAM bez použitia. Dialóg jedného súboru pracuje s prvou položkou fronty (`UQDSS:63`), takže sa ho týka aj U6 a pravidlo „Obnoviť" z nálezu 25 | **opraviť**: widget prijme jeden súbor, vezme prvý a upozorní; po U6 a náleze 25 (4.5) |

**Na vedomie: nálezy z denníka a témy jadra, ktorých sa návrh dotýka** (chyby bez rozdielu strán alebo vlastný kód
jednej strany), s tým, čo o nich vlastník 9. 10. rozhodol:

| Nález | Kde po zjednotení | Rozhodnutie a kde sa robí |
|---|---|---|
| 29, 39 (tiché zlyhané uloženie) | obaly každej strany (OL7) | opraviť samostatne pred krokom 5 (mimo tohto návrhu) |
| 30 (prázdny zoznam otvorí dialóg s nekonečným načítavaním) | `ImageWidgetInner.onFileInput`; `loading` adaptéra | opraviť vo widgete po U7 (4.5) |
| 31 (pozícia dvakrát) | `UploadQueueDialog.vue:130-139`, `ImageWidgetMultipleInner.vue:404-418` | opraviť po U7: prideľuje len widget (4.5) |
| 32 (`authors: []` pri uložení galérie) | `ImageWidgetMultipleInner.vue:446-462` | opraviť samostatne pred krokom 5, s nálezom 32b (mimo tohto návrhu) |
| 33, 35 (výber assetu) | mimo komponentov tohto návrhu | 33 opraviť (mimo krokov U, podľa analýzy hneď po kroku nálezu 20); 35 zavrieť bez zmeny |
| 38 (kôš admin-dam podľa assetu) | obal riadku DAM | opraviť po U5c v obale (4.5) |
| 40 (konflikty bez mien pri hromadnej úprave) | sklad DAM | opraviť po K6 jadra (mimo komponentov) |
| 42 (neznámy dôvod nič neukáže) | spoločný chip a prekrytie | zavrieť bez zmeny |
| 43 (dve „Zatvoriť") | spoločné tlačidlo zastavenia | potvrdenie „Zastaviť" (EN „Stop") po U5a (4.5, 6.2) |
| 44 (chip konfliktu zmizne) | spoločný výber autora | opraviť po U1 (4.5) |
| 28 („stále sa spracúva" pri usadenom riadku) | spoločné „Obnoviť" zoznamu (`createUploadQueueItemRefresh`) a dialógu jedného súboru (`useUploadQueueItemRefresh` s riadkom) | opraviť po U4 (4.5); opravené v kroku 28 (10. 10., LIB) |
| 24 (zastaraná voľba v ihrisku) | ihrisko knižnice | zmazať riadok v U1 (4.5) |
| 49 (formulár assetu, ktorého súbor sa ešte spracúva; overený, „možný len ak") | detail knižnice, widgety | knižnica: F-C po U6 a F-D po U6 a U7, len s F-C (4.5); admin-dam: F-A, F-B a nález 50 v kroku DAM po K6 (mimo tohto návrhu) |
| 14 (75 ikonových tlačidiel admin-dam bez mena) | mimo uploadu | samostatná úloha po kroku 5; obaly DAM nové bezmenné tlačidlá nepridajú |
| PV10 jadra (pamäť duplikátu) | riadok knižnice | `uploadedAssetId` píše spoločné usadzovanie na oboch stranách (jadro); kôš admin-dam je vo vlastnom slote a nezávisí od toho (analýza PV10 to potvrdzuje) |
| PV14 jadra (pomenovaná konfigurácia) | všetky komponenty s menom konfigurácie | plná podpora, kroky PV14a (jadro) a PV14b (komponenty, 2.13) |

### 5.3 Ostatné otázky (neblokujú)

| # | Otázka | Čo som našiel | Odporúčanie |
|---|---|---|---|
| Q1 | Vypustiť staré testy admin-dam, ktoré pokrýva vlna 4 (`massOperationsSidebar`, `uploadStopConfirm`, `fileValidation`)? | Každý nahrádza moduly podľa cesty alebo funkcie, ktoré zaniknú; to isté správanie strážia `massOperationsRows`, `LT/uploadQueueButtonStop`, `L-ui/__tests__/formatAndSizeCheck`. | Vypustiť je mazanie súboru (U9, vlastník); do vtedy ich prepísať na balík, ak to stojí menej než pol hodiny, inak nechať a v U9 zmazať. |
| Q2 | Pripojiť `AssetMetadata` a obsah dialógu jedného súboru do jedného komponentu polí (formulár, kľúčové slová, autori, prepínač)? | Rovnaká kostra je na štyroch miestach (riadok LIB a DAM, `AM`, `UQDSMC`), ale líšia sa v `data-cy`, `queue-id`, `@update`, `readonly`, `VForm` a `:key`. | Nie v kroku 5; panel súboru áno (2.8). |
| Q3 | Vyviezť `createDamImage`? | UGC si objekt obrázka skladá vo vlastnom mapovaní. | Nie teraz; export sa dá pridať kedykoľvek. |
| Q4 | Nevyužité kľúče `coreDam.*` a `system.upload.*` v admin-dam po U5 | ostanú v jazykových súboroch | U9 (b), voliteľné. |

### 5.4 Riziká

| # | Riziko | Čo som našiel | Čo s tým |
|---|---|---|---|
| R-K1 | Testy admin-dam nahrádzajú moduly podľa cesty a `useAlerts` na vstupe balíka | `DT/queue/queueRefresh.test.ts:31-75`, `queueRowValidation.test.ts:35-80`, `massOperationsSidebar.test.ts:12-45`, `slotUploadRow.test.ts:27-61`; náhrada nezasiahne kód vnútri knižnice (zásada 1 jadra) | väzby (zoznam, sidebar) volajú funkcie admin-dam; obaly na dnešných cestách; čo sa aj tak zmení, je vymenované v 4.1 |
| R-K2 | R10 mení anglické texty admin-dam (12 reťazcov, 6.2) a v režime `xx` ukáže kľúče `common.damImage.*` | `DT/languageMessagesTranslationIds.test.ts:7-17` (podklad 5, F.8); test tvrdí len `common.button.save` (`:16`), takže nespadne (K-15) | rozhodnuté; testy s textami sa menia v kroku, ktorý text mení: 28 riadkov v 8 súboroch admin-dam, v testoch knižnice a v e2e admin-dam nič (K-03) |
| R-K3 | Chip knižnice v admin-dam by čítal sklad knižnice a ikonu „nové" by nenašiel | `L/KC:31,39`, `L/AC:33,41` | injekcia z obalu zoznamu (AK7); test U1 |
| R-K4 | `cachedExtSystemId` je spoločný globál s viacerými zapisovateľmi | podklad 6, riziko 4; admin-dam montuje `AAssetSelect` na troch miestach s aktuálnou licenciou | admin-dam zapisuje pri nastavení aktuálneho; budúci widget obrázka v admin-dam by ho prepisoval (poznámka do kódu preposielača) |
| R-K5 | Brána vytvorenia je v konfigurácii; testy admin-dam inštalujú plugin s vlastným doslovným objektom volieb | `DT/support/uploadUi.ts:182-185` | spoločný modul volieb pre `main.ts` aj podporu testov (U3); inak by `queueRowKeywordsAuthors` („neither offered nor done without dam_keyword_create") očervenel |
| R-K6 | Vue pri podanom, ale prázdnom slote vykreslí predvolený obsah | **overené pokusom (K-05)**: predvolený obsah sa vykreslí pri `<template #x />`, prázdnom slote, slote s medzerami, s komentárom, s `v-if="false"` aj pri funkcii slotu vracajúcej `[]`, `null`, `undefined` alebo komentár; potlačí ho len slot, ktorý vráti text, hoci prázdny (`ensureValidVNode`, `@vue/runtime-core/dist/runtime-core.cjs.js:3355-3363`) | rozdiely, ktoré treba vedieť vypnúť, sú vlastnosti (RD4), nie sloty; trik s prázdnym textom nie je rozhranie |
| R-K7 | Editor oblasti záujmu bez vlastnosti `readonly` je upraviteľný | `L/cropper/components/DamAssetImageRoiSelectLazy.vue:7-16`; oba dialógy dnes podávajú `:readonly="!roiEditable"` (`ADD:198`, `UQDS:406`) | rámec počíta `roiEditable` sám, rovnakým kódom (2.8, JS31); prípad bez práva v U0 (detail) a v `LT0/consumerProfileUploadDialogSingle.test.ts:412-450` (po U0-L; pred ním `:252-275`) (dialóg) |
| R-K8 | Mená súborov knižnice drží viac testov podľa mena (náhrady) | podklad 6, riziko 7; `lib-vlna4.md` | súbory sa nepremenúvajú; nové sú len pomocné |
| R-K9 | e2e admin-dam čaká na triedy a mená, ktoré sa presúvajú do knižnice | podklad 5, F.4 a F.5; podklad 7, časť 9: `.dam-upload-queue__item`, `.asset-queue-editable__sidebar`, `[data-cy="button-delete"]` s „Odstrániť?" a „Zmazať", „Upraviť", `[data-cy="table-copy"]`, `[data-cy="add-author"]`, ikony hromadných operácií, `.asset-image__meta-icons img[title="Syntetické (TTS)"]` | všetky ostávajú (sloty DAM, rovnaké triedy, rovnaký SK titulok); e2e nespúšťané; dnešné selektory potvrdené `grep` (K-14), beh po presune ukáže U5c a vlastník v U9 (4.4) |
| R-K10 | Dve sady poslucháčov ťahania | podklad 7, časť 9; admin-dam po U3 používa len stav knižnice | spolu s U3 |
| R-K11 | Spoločné CSS fronty slúži aj triedam, ktoré používa len admin-dam (`--list`, `--simple`) | LIB `src/styles/dam/components/dam-upload-queue.scss:53-110` | nemazať; poznámka do štýlu |
| R-K12 | Jadro verzie 5 mení, čo odstránenie robí s usadeným riadkom (Z17) | jadro, 6 | zlúčené „Obnoviť" (ZK6) má obe kontroly, nezávisí od toho |
| R-K13 | Súbory admin-dam bez importéra medzi U3 a U9 | 2.10, odchýlka 2; **overené (K-11)**: nič ich nehlási (žiadny knip ani `import/no-unused-modules`), ale `vue-tsc` ich prekladá ďalej (`tsconfig.app.json:3`, `src/**/*`) a čítajú ich testy nad zdrojmi: `DT/closeButton`, `DT/sortable`, `DT/layouts/alertHost`, `DT/declaredDependencies` (glob cez celý `src`) a `DT/a11y/iconButtonNames` (podľa cesty) | súbory musia do U9 ostať prekladateľné a prejsť týmito testami; `iconButtonNames` sa zužuje v U5a až U5c (4.1); zmazanie v U9 |

### 5.5 Čo som nevedel overiť, a čo už overili kontroly predpokladov

Ja som nič nespúšťal (testy, `vue-tsc`, lint, build ani prehliadač); tvrdenia „bez zmeny" sú z čítania testov a kódu.
Predpoklady verzie 1 potom preverili kontroly v `krok5/overenia.md` (K-01 až K-15, vedúci 8. 10. o 22:33):

| # | Predpoklad | Výsledok | Kde v návrhu |
|---|---|---|---|
| 1 | Zoznam meniacich sa testov admin-dam je úplný | **vyvrátené (K-01)**: chýbal `DT/a11y/iconButtonNames.test.ts` | doplnené do U5a až U5c a U9 (4.1), 4.3, R-K13 |
| 2 | `queueRowKeywordsAuthors` a `queueListRow` nečítajú texty R10 | **potvrdené (K-03)**: ani reťazec, ani kľúč; starý anglický text menuje 28 riadkov v ôsmich súboroch, ktoré uvádzajú U5a až U5c; v testoch knižnice a v e2e admin-dam nič | 4.3, R-K2 |
| 3 | Vzhľad ZK5, ZK11, ZK23 | **ukáže implementácia (K-04)**: fakty z kódu sedia (ZK5, ZK11 overené), vzhľad nie; ZK24 a ZK26 sú vypustené | 4.4 |
| 4 | Vue a prázdny slot (R-K6) | **potvrdené pokusom (K-05)**; vlastnosť `duplicateNotice` je správna voľba | R-K6, RD4 |
| 5 | `useAclAllowed` knižnice v admin-dam odpovedá ako `useAuth().can` | **potvrdené pokusom (K-06)** pre `dam_keyword_create` a `dam_author_create` (povolené, zakázané, nezapísané, id 0, rola), oboje cez `canHelper` toho istého `useAuthStore`. Jediný rozdiel: kde `can()` hodí výnimku (používateľ ešte nie je načítaný; `AllowOwner` bez subjektu), `useAclAllowed` vráti `false` (`canSafeHelper`, LIB `src/domains/auth/composables/defineAuth.ts:258-277`), čo je bezpečnejšie; dnešný admin-dam by vtedy hodil výnimku v šablóne (`D/author/components/AuthorRemoteAutocompleteWithCached.vue:225`) | AK2, 2.12 |
| 6 | RD12: nahratý riadok s upozornením vznikne v bežnom toku | **potvrdené (K-07)**: po „processed" a troch zlyhaných alebo chýbajúcich čítaniach je riadok `Uploaded` s textom `readFailed`; tvrdí to `L/uploadQueue/settlement/__tests__/uploadSettlement.test.ts:1013-1033` (N-Z21), ale pod profilom admin-dam; politiku `metadata: 'load'` má aj sklad knižnice (`L/uploadQueue/store/uploadQueuesStore.ts:113`). Nové prípady U0 prevezmú prípravu N-Z21. Verzia 3 (posudok Opusa): v knižnici príde upozornenie na nahratý riadok až po troch čítaniach, najmenej 45 s po prechode, keď ponuka po 20 s už je; viditeľný rozdiel strán je riadok pripojený už s upozornením | RD12, U0, U4 |
| 7 | Počty prípadov | vlna 4 **potvrdená (K-08)**; tri čísla v 4.3 **vyvrátené (K-09)** a opravené: `uploadQueueRowRefresh` 17, `uploadQueueItemRefresh` 12, `uploadQueueDialogSingle` 21 | 4.3 |
| 8 | admin-cms a admin-ugc nepoužívajú komponenty fronty | **potvrdené (K-10)**; admin-cms používa typ `AssetDetailItemDto` (`EmbedImageInlineDialogActions.ts:2`, `pasteDamAssetExtension.ts:8`), R16 ruší len vymyslený objekt, nie typ | 3, 2.8 |
| 9 | Hlási niektorá kontrola admin-dam súbory bez importéra | **potvrdené: nehlási (K-11)**; čítajú ich však `vue-tsc` a štyri testy nad zdrojmi | R-K13 |
| 10 | Riadky tabuliek sú zo stavu 21:45 | **potvrdené (K-12)**: posledná zmena `src` LIB 18:46, DAM 18:36 (overené 22:10 a 22:29) | — |
| 11 | PK3 | **potvrdené v headless Chromiu a horšie (K-13)**; oprava schválená 9. 10. | 5.2, 4.5 |
| 12 | e2e admin-dam po presune | **ukáže implementácia (K-14)** | 4.4 |
| 13 | Režim `xx` nezhodí test | **potvrdené (K-15)** | R-K2 |

Ostáva neoverené: že testy menované v 4.1 ostanú zelené (K-02), vzhľad (K-04) a e2e (K-14); ukáže ich implementácia
(4.4). Riadky tabuliek overí ten, kto začne po ďalšej zmene stromov, podľa mien.

---

## 6. Register zblížení (pre vlastníka)

**Register je otvorený: každý ďalší krok implementácie (U0 až U9) doň dopíše, v tom istom tvare a skôr než krok
skončí, každé zblíženie, ktoré spraví a ktoré tu ešte nie je.** Kto pri kroku zistí, že by musel zmeniť niečo, čo
používateľ v bežnom toku vidí alebo môže urobiť, alebo čo sa pošle, nezblíži to a vráti to vedúcemu ako novú tému.
Z registra sa robia aj záznamy do changelogov (U9).

**Ako ho čítať.** Rovnaký tvar ako register jadra (jeho časť 6). Každý riadok je jedna vec, ktorú spoločný komponent
robí na oboch stranách rovnako, hoci ju doteraz každá strana robila inak alebo jedna chybne. Zaradenie: **vnútorné**
(nikto to nevidí), **kozmetika** (vidno to, ale nič sa tým nemení), **chyba jednej strany**. Produktové rozdiely sem
nepatria (6.3). Ak vlastník pri niektorom riadku usúdi, že je to produkt, riadok sa presunie medzi témy (5.2) a
rozdiel sa vráti ako vlastnosť alebo slot. Čísla sú stále: vypustené záznamy ostávajú ako riadok s dôvodom.

### 6.1 Register

| # | Čo to je | Knižnica doteraz | admin-dam doteraz | Berie sa a prečo | Čo si kto všimne | Zaradenie | Dôkaz, krok, testy |
|---|---|---|---|---|---|---|---|
| ZK1 | Prázdny prvok v riadku duplikátu | je | nie je | zanikne | nič | vnútorné | `L/uploadQueue/components/UploadQueueItemEditable.vue:313`; U4 |
| ZK2 | *vypustené vo verzii 3* | | | admin-dam si nechá svoj watcher „Obnoviť" v obale (RD12), takže knižnica nemusí prevziať jeho časovač; rozdiel časovačov ostáva, dnes je neviditeľný | | — | RD10, **per strana** cez `refreshOffered` |
| ZK3 | *vypustené vo verzii 2* | | | „Obnoviť" (a s ním kôš „Odstrániť z fronty") pri nahratom riadku s upozornením by sa v admin-cms a admin-ugc ukázali hneď, nie po 20 s: viditeľná zmena v bežnom toku | | — | teraz RD12, **per strana**: od verzie 3 cez `refreshOffered` (watcher každej strany) |
| ZK4 | *vypustené vo verzii 2* | | | lacnejšie bez zblíženia: riadok knižnice si nechá `{ index, assetId }`, obal admin-dam pridá `item` | | — | RD21; `LT/uploadQueueRowRefresh.test.ts:129-131,172` bez zmeny |
| ZK5 | Pravý okraj oblasti s kartami | 16 px od šírky md, bez obrysu pri zameraní | žiadny | knižnica | v admin-dam je zoznam na širokej obrazovke o 16 px užší | kozmetika | `L/uploadQueue/components/UploadQueueEditable.vue:120-121`, `D/asset/components/queue/AssetQueueEditable.vue:86`; U5c |
| ZK6 | Upozornenie po „Obnoviť" | riadok, ktorý medzitým odišiel z fronty, nedostane „skúste znova" | riadok, ktorý už nie je v zozname, sa vôbec nepýta | obe kontroly | nič: v bežnom toku sa ani jedno nestane | vnútorné | `L/uploadQueue/composables/uploadQueueItemRefresh.ts:34-50`, `D/…/AssetQueueEditable.vue:28-50`; U4, U5c; `LT/uploadQueueItemRefresh`, `DT/queue/queueRefresh`, `queueRowActions` bez zmeny |
| ZK7 | Panely typov assetov v hromadných operáciách | len obrázok | obrázok, video, audio, dokument | štyri, každý len pre typ vo fronte | nič: fronta knižnice má len obrázky | vnútorné | `L/…/AssetQueueSelectedSidebar.vue:269-284`, `D/…/AssetQueueSelectedSidebar.vue:275-329`; U4 |
| ZK8 | „Vyčistiť" v hromadných operáciách | výber kľúčových slov a autorov vymaže len pri zapnutých | vždy | admin-dam (jednoduchšie) | nič: vypnuté polia nie sú vidieť a ich výber sa nepoužije | vnútorné | `L/…:102-106`, `D/…:108-111`; U4 |
| ZK9 | Nepoužitá vlastnosť tlačidla zastavenia | — | `dialogMaxWidth` | zanikne | nič | vnútorné | `D/asset/components/footer/AssetFooterUploadButtonStop.vue:9,14`; U5a |
| ZK10 | Text chyby formulára bez nastaveného ext systému | s menom komponentu | bez | knižnica | len vývojár v konzole | vnútorné | `L/assetDetail/components/AssetCustomMetadataForm.vue:46`, `D/shared/components/customMetadata/AssetCustomMetadataForm.vue:41`; U3 |
| ZK11 | Zástupný obrázok, kým sa súbor nahráva | SVG 1 KB | JPEG 58 KB, ten istý obrázok | knižnica | nič viditeľné (prekreslený, rovnaký podľa správy `e1479025` a porovnania okom); stránka admin-dam stiahne o 57 KB menej | kozmetika | `L/…/AssetImage.vue:4`, `D/asset/components/AssetImage.vue:7`; U3; JPEG ostáva pre štyri iné súbory admin-dam |
| ZK12 | Ako sa vypnú polia kľúčových slov a autorov vo vzhľade „pole" | — | pole kľúčových slov odovzdá „nevypnuté" výslovne a tým prebije vypnutý formulár; pole autorov neodovzdá nič a vypne ho formulár | obe odovzdajú „vypnuté" len vtedy, keď sú vypnuté; inak rozhodne formulár | nič: rozdiel by nastal len pri riadku, ktorý je duplikát a zároveň sa dá upravovať, a taký spracovanie nevyrobí | vnútorné | `D/keyword/components/KeywordRemoteAutocompleteWithCached.vue:167`, `D/author/components/AuthorRemoteAutocompleteWithCached.vue:151-173`, `uploadSettle.ts:427-429,335,578-580`; U1; `DT/queue/queueRowStates` („is disabled on a duplicate…" tvrdí len vlastné polia a prepínač) bez zmeny |
| ZK13 | Ako chip ukáže meno autora alebo kľúčového slova (aj príznak „schválený") | sleduje cache aj zmenu identifikátora | prvé načítané meno navždy | knižnica | v admin-dam chip ukáže nové meno, keď sa zmení v cache alebo sa chipu zmení identifikátor. Opačne: keď cache meno vyhodí (nad 1 000 mien vyhodí najstaršie, `L/../cached/composables/defineCached.ts:168-190`), chip, ktorý dnes meno drží, sa začne točiť a točí sa, kým to id niekto znova nepridá do cache; v bežnej práci sa 1 000 mien za jedno otvorenie stránky nenazbiera | chyba jednej strany (admin-dam) | podklad 6, C1 a AC1; `L/…/KeywordRemoteAutocompleteCachedKeywordChip.vue:33`, `D/…/KeywordRemoteAutocompleteCachedKeywordChip.vue:33-70`, `D/…/AuthorRemoteAutocompleteCachedAuthorChip.vue:35-78`; U3, U5c; `DT/cached/cachedChipUnresolved` (len cesta) |
| ZK14 | Vysvetlenie pri `#id` autora alebo kľúčového slova, ktoré server nevrátil („nepodarilo sa načítať") | komponent bubliny (`VTooltip`), ukáže sa pri prejdení myšou ako ostatné bubliny; variant len text má atribút `title` | atribút `title` (natívny titulok prehliadača) na všetkých troch chipoch | knižnica | v admin-dam sa vysvetlenie ukáže v bubline aplikácie namiesto natívneho titulku prehliadača; text je ten istý | kozmetika | `L/…/KeywordRemoteAutocompleteCachedKeywordChip.vue:81-87`, `L/…/AuthorRemoteAutocompleteCachedAuthorChip.vue:97-103`, `L/…/…ChipConflicts.vue:50-56`, `D/…Chip.vue:97` a `117`, `D/…ChipConflicts.vue:65`; U3 (päť stránok a od U3 aj výbery v detaile assetu, v pravom paneli a vo formulári licencie, posudok Opusa U3); U3 (päť stránok s chipom autora), U5c (výbery); mení sa `DT/cached/cachedChipUnresolved.test.ts:164` („shows the id, and says why, when the server does not return the record": `explained()` hľadá `[title=…]`, `:104`), `:212` (variant len text) platí |
| ZK15 | Obsah prázdneho chipu | „-" | „ - " | knižnica | nanajvýš medzera okolo pomlčky | kozmetika | `L/KC:59`, `D/KC:77`; U5c (chip kľúčového slova vo fronte); už U3 pri chipe autora v `AuthorCleanPhraseDetail` (`authorReplacement` môže byť `null`; posudok Opusa U3) |
| ZK16 | Filter vnútorného hľadania autora | text | text a prázdne `canBeCurrentAuthor` | knižnica | nič: prázdna hodnota sa do požiadavky nedáva | vnútorné | `D/author/filter/AuthorFilter.ts:27-40`, `L/author/filter/AuthorFilter.ts:5-20`, LIB `src/domains/api/composables/useApiQueryBuilder.ts:104-109`; U3 |
| ZK17 | Presmerovanie po vytvorení autora | nie je | na detail autora, ak volajúci nepovie inak (obaja hovoria) | knižnica | nič | vnútorné (mŕtvy kód) | `D/author/components/AuthorCreateButton.vue:67,87-89`, `D/author/components/AuthorListView.vue:34`; U3 |
| ZK18 | Prístupné meno ikonového tlačidla „nový autor" | je | len bublina | knižnica | čítačka obrazovky v admin-dam tlačidlo pomenuje | chyba jednej strany (admin-dam) | `L/author/components/AuthorCreateButton.vue:132-150`, `D/…:116-133`, `LS/a11y/iconButtonNames.test.ts:95-99`; U3 |
| ZK19 | Rozsah validácie dialógu „nový autor" | `anzu:common:author-create-validation-scope` | `anzu:author-create-validation-scope` | knižnica | nič: dialóg validuje sám seba, iný zberač ten rozsah nemá | vnútorné | `L/composables/uploadValidations.ts:17`, `D/shared/validationScopes.ts:3`; U3 |
| ZK20 | Cache mien autorov a kľúčových slov | jedna, jej ext system zapisujú widgety a výber assetu | vlastná, aktuálny ext system aplikácie | jedna cache knižnice; admin-dam zapíše jej ext system tam, kde nastavuje svoj | nič; mená, ktoré načítal výber assetu, admin-dam použije aj inde (menej požiadaviek na mená) | vnútorné | podklad 6, B; `L/composables/extSystemIdForCached.ts:4`, `D/asset/composables/currentExtSystem.ts:45,49,54,92`; U2; testy s náhradou cache podľa cesty bez zmeny |
| ZK21 | Zoznam typov súborov s medzerami alebo veľkými písmenami | prijme „image/*, .JPG" | nie | knižnica | nič pri dnešnej konfigurácii (typy sú malými písmenami, bez medzier) | chyba jednej strany (admin-dam) | `L-ui/composables/formatAndSizeCheck.ts:16-23`, `D/shared/components/FileUpload.vue:222-227`; U3 |
| ZK22 | Kto zapne sledovanie ťahania súborov nad oknom | aplikácia výslovne | pri prvom použití | knižnica (admin-dam zavolá `initGlobalDragState()` v `App.vue`) | nič | vnútorné | `L-ui/composables/dropzone.ts:50-62`, `D/asset/composables/windowFilesDragWatcher.ts:44-58`, `src/App.vue:17-18`; U3 |
| ZK23 | Pravý okraj tlačidiel v paneli detailu a dialógu jedného súboru | detail 8 px, dialóg 12 px | — | detail | v dialógu jedného súboru sú tlačidlá panela o 4 px bližšie k pravému okraju | kozmetika | `L/assetDetail/components/AssetDetailDialog.vue:143`, `L/uploadQueue/components/UploadQueueDialogSingle.vue:362`; U6 |
| ZK24 | *vypustené vo verzii 2* | | | obal okolo obrázka by v detaile mohol zmeniť zmenšovanie širokého obrázka (podľa posudku Opusa, R3, je dnes flex prvkom s `max-width: 100%`); dokázať, že nie, sa z kódu nedalo | | — | JS9, **per adaptér**: obal len s prekrytím |
| ZK25 | Prázdne obsluhy načítania obrázka v detaile | `@load`, `@error` bez účinku | — | zaniknú | nič | vnútorné | `ADD:59-61,213-214`; U6 |
| ZK26 | *vypustené vo verzii 4.3* | | | zblíženie na `break-word` dialógu by v pravom sidebare výberu assetu (300 px, admin-cms a admin-dam, mimo uploadu) zalomilo popisy ako „Vytvorené" vo vnútri slova; dnešný vzhľad drží jeden atribút | | — | JS29, **per adaptér**: `AM` podá `AssetFileInfoPanel` `style="overflow-wrap: normal"`, dialóg jedného súboru ostane pri `break-word` karty (`AM:195-198`, `UQDSMC:180`, `node_modules/vuetify/lib/components/VCard/VCard.css:5`, LIB `src/styles/components/subject-select.scss:7`) |
| ZK27 | Koľko vlastných polí je pripnutých nad „Zobraziť viac", keď ext system pre typ assetu číslo nemá | 2 | 0 | knižnica: tak to dnes beží v admin-cms a admin-ugc, krok 1 to ponechal, a netreba kľúč konfigurácie | nič v bežnom toku: backend posiela číslo vždy (predvolene 5, podklad 7, pár 4) a admin-ugc ho zapisuje sám (2); záloha sa uplatní len pri nekompletnej konfigurácii | vnútorné (nedosiahnuteľné) | `L/assetDetail/components/AssetCustomMetadataForm.vue:49-51`, `D/shared/components/customMetadata/AssetCustomMetadataForm.vue:44-46`; U3 (detail admin-dam), U5c (riadok); otočí sa `DT/queue/customMetadataForms.test.ts:129-138` („is no field at all, only the button, where the ext system says nothing of pinning"); `DT/asset/assetMetadataValidation.test.ts:181-186` („is stopped by a required custom field behind 'show all'") dostane `config.pinned = 0` výslovne, aby testoval to isté; `L/assetDetail/__tests__/AssetCustomMetadataFormPinned.test.ts` bez zmeny. Ak to vlastník bude mať za produkt: kľúč konfigurácie čítaný z `default` (formulár `configName` nemá) |

### 6.2 Rozhodnuté zmeny, ktoré nie sú zblížením

- **R10 (anglické texty spoločných komponentov podľa knižnice).** Používateľ admin-dam s anglickým rozhraním uvidí
  inak 12 reťazcov; slovenské sa nemenia:

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

  `FileUpload` a prekrytia admin-dam si nechávajú svoje texty (vlastný kód).
- **Prvá sada, bod 7:** názov poľa v prístupnom mene tlačidiel „vyplniť prázdne" a „nahradiť všade" na oboch stranách (U8).
  **V LIB hotové v kroku U8-L (11. 10.):** dve ikonové tlačidlá pri každom poli hromadných operácií fronty (vlastné
  polia v `L/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue`, kľúčové slová a autori v
  `AssetQueueSelectedSidebar.vue`) majú prístupné meno z nových kľúčov
  `common.damImage.asset.massOperations.fillOneEmptyField` a `replaceOneField`:

  | Jazyk | „vyplniť prázdne" | „nahradiť všade" |
  |---|---|---|
  | SK | „Vyplňte prázdne pole: {field}" | „Nahradiť všade: {field}" |
  | EN | „Fill empty field: {field}" | „Replace everywhere: {field}" |
  | CS | „Vyplňte prázdné pole: {field}" | „Nahradit všude: {field}" |

  `{field}` je názov poľa tak, ako ho ukazuje formulár (pri vlastnom poli jeho `name`, inak „Kľúčové slová", „Autori").
  Znenie je doterajší text tlačidla, dvojbodka a názov poľa; **na potvrdenie vlastníkovi** (plán má len „kľúče s
  `{field}`"). Bublina nad tlačidlom ostáva krátka (doterajšie kľúče `fillOneEmpty`, `replaceOne`), tri tlačidlá dole
  sa nemenia. Kto si všimne: čítačka obrazovky v admin-cms a admin-ugc, v admin-dam po C3 (U8-D upraví
  `DT/queue/massOperationsRows`). Testy: `LT0/consumerProfileUploadMassOperations.test.ts` (pomocník hľadá tlačidlá
  podľa mena s poľom; nový prípad „names the two buttons beside each field by what they do and by the field").
- **R16:** vymyslený `AssetDetailItemDto` v dialógu jedného súboru zanikne (U6); správanie sa nemení.
- **Nález 43 (vlastník 9. 10.; zmena textu vo všetkých troch adminoch, krok po U5a, 4.5).** Otázka pri zastavení
  uploadu (spoločné tlačidlo zastavenia, od U5a aj v oboch prekrytiach admin-dam):

  | Kde | Doteraz | Potom |
  |---|---|---|
  | potvrdzovacie tlačidlo otázky | SK „Zatvoriť", EN „Close" (kľúč `common.damImage.upload.stop`, zdieľaný s tlačidlom, ktoré otázku otvorí) | SK „Zastaviť", EN „Stop" (vlastný kľúč; CS „Zastavit", schválené 9. 10.) |
  | ikonové tlačidlo, ktoré otázku otvorí (bublina, prístupné meno) | „Zatvoriť" / „Close" | bez zmeny |
  | krížik v hlavičke otázky | „Zatvoriť" / „Close" | bez zmeny |

  Hotové v kroku 43 (11. 10., `impl/43.md`): kľúč `common.damImage.upload.stopConfirm` (SK „Zastaviť", EN „Stop", CS
  „Zastavit") v `L/uploadQueue/components/UploadQueueButtonStop.vue`; `data-cy` tlačidiel sa nemení. Pripína
  `LT/uploadQueueButtonStop.test.ts` (text potvrdenia, mená otvárajúceho tlačidla a krížika, slová troch jazykov).

- **Nález 49, F-C (vlastník 9. 10.; krok po U6, 4.5).** Pri vypnutom „Uložiť" detailu knižnice sa ukáže
  **existujúci** text `common.damImage.queueItem.stillUploadingOrProcessing` (SK „Asset sa stále nahráva alebo
  spracováva serverom", EN „Asset is still uploading or being processed by server"); nový kľúč ani preklad netreba,
  text sa len ukáže na novom mieste. Ak by mal detail radiť aj „po spracovaní ho otvorte znova" (ako veta F-B
  v admin-dam), je to nový kľúč a nové rozhodnutie o texte.
- **Nález 47 (vlastník 9. 10.; krok po U6 a náleze 25, 4.5).** Nové upozornenie widgetu s jedným obrázkom, keď
  doň niekto pustí viac súborov; **nový kľúč** (napríklad `common.damImage.upload.onlyOneFile`), znenie schválil
  vlastník 9. 10.: SK „Sem sa dá nahrať len jeden súbor; použije sa prvý.", EN „Only one file can be uploaded here; the first
  one is used.", CS „Sem lze nahrát jen jeden soubor; použije se první."
- **Nález 28, oprava (vlastník 9. 10.; krok 28 po U4, v LIB po C2, 10. 10.).** Upozornenie „Asset sa stále nahráva
  alebo spracováva serverom" po „Obnoviť" sa neukáže riadku, ktorý počas čítania skončil (`Failed`, `Uploaded`,
  `Stop`: napríklad ho ukončila notifikácia o zlyhaní alebo duplikáte, alebo ho používateľ zastavil) alebo odišiel z
  fronty (odstránený, dialóg zatvorený): tá istá podmienka, akú má „nepodarilo sa
  načítať" (ZK6). Platí pre zoznam (`createUploadQueueItemRefresh`) aj pre `useUploadQueueItemRefresh`, keď dostane
  riadok (dialóg jedného súboru); „odišiel z fronty" sa pozná len pri známej fronte (zoznam, starý podpis s kľúčom),
  inak rozhodne stav; bez riadku (len ID assetu) upozorňuje ako doteraz. Obmedzenie nálezu 37 platí teraz aj pre túto
  hlášku: riadok, ktorý bol `Failed` už pred stlačením a počas čítania znova zlyhá, ju dostane (pravidlo pozerá na zmenu
  stavu). Kto si všimne (riadok fronty a dialóg jedného súboru): v admin-cms (notifikácie DAM podľa konfigurácie behu `envConfig.dam.notification.enabled`, `admin-cms/src/main.ts:66-69`; v `public/config.json` zapnuté) riadok počas
  čítania ukončí notifikácia o zlyhaní alebo duplikáte, alebo ho používateľ zastaví, odstráni či zatvorí dialóg;
  notifikácia „spracované" spravidla nie (riadok knižnice sa usadí až čítaním, ktoré čaká za obnovením,
  `L/uploadQueue/settlement/uploadSettlement.ts:616-621`); len keď jej čítanie (250 ms po nej) čakalo už pred stlačením, ide
  pred obnovením a riadok prejde na `Uploaded` počas čítania, takže hlášku nedostane (malé okno, rovnako „copied"); inak sa „stále sa…" ukáže, ak čítanie vráti `pending`, a riadok prejde
  na `Uploaded` až po svojom čítaní, ako dnes. admin-ugc beží bez notifikácií DAM (`admin-ugc/src/main.ts:74-77`): zmení sa niečo len pri
  zastavení, odstránení alebo zatvorení dialógu počas čítania. admin-dam až s C3 (zoznam knižnice cez U5c). Text ani
  kľúč sa nemení. `L/uploadQueue/composables/uploadQueueItemRefresh.ts` (`refreshAndSay`); nové prípady
  `LT/uploadQueueItemRefresh.test.ts` („the warning that the file of a pressed row is not done yet": usadený
  notifikáciou, zastavený, odišiel z fronty, ostal, bez riadku); `:129` (pred krokom `:125`) a
  `LT0/consumerProfileUploadQueueRows.test.ts:235` bez zmeny.
- **Nález 46 (PK3), oprava (vlastník 9. 10.; krok PK3 po U4 a 28, v LIB po C2, 10. 10.).** Posun zoznamu fronty
  klávesmi (šípky hore a dole, PageUp, PageDown, Home, End) nechá kláves prehliadaču, keď je cieľ udalosti textové
  alebo podobné pole, ktoré tie klávesy spracúva samo: `textarea`, `select`, prvok s `isContentEditable` a `input`
  okrem typov `checkbox`, `button`, `submit`, `reset`, `image`, `file` (`radio`, `range` a `number` šípky používajú,
  idú prehliadaču). Zoznam sa vtedy neposunie a kláves sa nezablokuje (`preventDefault`), takže kurzor v poli riadku sa
  pohne ako inde a číselné vlastné pole (`VTextField type="number"`) šípkami natívne mení hodnotu. To isté pri klávese
  v otvorenom menu (`.v-menu`, koreň overlay každého `VMenu`; napríklad menu VAutocomplete kľúčových slov a autorov
  alebo `ABooleanSelect`), aj vnorenom v dialógu fronty: kláves patrí menu, zoznam sa nepohne (od PK3-c2; predtým ho
  posunul). Iné overlay (dialóg fronty, snackbar, iný dialóg) sa nepočítajú, kláves v nich posúva zoznam ako doteraz
  (PK3-c3). Mimo poľa, aj na prepínači (`checkbox`, napríklad jednorazové použitie) a tlačidle, sa zoznam posúva ako
  doteraz; `keyboardScroll: false` (U4) bez zmeny. Kto si všimne: admin-cms a admin-ugc v dialógu fronty (pri písaní
  metadát v riadku fungujú tie klávesy v poli a v jeho menu); admin-dam nie (`keyboardScroll: false`, ZN3). Text ani
  kľúč sa nemení, na backend nejde nič. `L/uploadQueue/components/UploadQueueEditable.vue` (`isTypedIntoField`,
  `KEYLESS_INPUT_TYPES`, `isInMenu` v obsluhe klávesov); nové prípady `LT/uploadQueueListHosted.test.ts` („the keys
  that scroll a list": v poli `input`, `textarea`, `contenteditable`, `range`, `radio` a `select` nezablokované a
  zoznam stojí; v otvorenom menu poľa, aj v dialógu, zoznam stojí; na texte mimo poľa, prepínači a `submit`, v dialógu
  a na tlačidle v snackbare a inom dialógu posun ako doteraz); prípady U4 `keyboardScroll` bez zmeny.
- **Nález 20 so 17, oprava (vlastník 9. 10.; krok N20 po PV16-L, v LIB po C2, 10. 10.).** (20) Kópia vybraných assetov
  do licencie widgetu ide na cestu kópie koncového bodu obrázka (`endPointImage` + `/copy-to-licence`, v admin-cms
  `PATCH /adm/v1/image/copy-to-licence`) namiesto koncového bodu assetu, ktorý ju nemá; volajú ju tri widgety
  (`L/imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `ImageWidgetMultipleInner.vue`). (17)
  Zlyhaná kópia ide aj zapisovaču chýb API (`report`, ako ostatné požiadavky rodiny), zastavená nie
  (`L/api/damImageApi.ts`). Kto si všimne: admin-cms, keď vo výbere assetu z inej licencie zapne „kopírovať do licencie":
  kópia doteraz zlyhala s chybou, teraz uspeje a skopírované assety pribudnú; zlyhanie navyše v zapisovači (konzola).
  admin-ugc nie: všetky jeho výbery majú jednu licenciu, ktorá je aj licenciou nahrávania (`:select-licences=
  "[damLicence]"`, `:upload-licence="damLicence"`), takže prepínač kópie sa neukáže; aj keby sa ukázal, UGC API cestu
  kópie nemá (zlyhalo by to ako doteraz; voľba N20V). admin-dam tieto widgety nepoužíva. Text ani kľúč sa nemení.
  Testy: `LW/ImageWidgetsCopyToLicenceFailure.test.ts` (nový prípad pre každý z troch widgetov: kópia ide na
  `/adm/v1/image/copy-to-licence` a pribudne; náhrada volieb dostala `endPointImage`), `LT0/damImageApiCopyToLicence.test.ts`
  (koncový bod v teste je obrázkový, `:63` teda `PATCH /adm/v1/image/copy-to-licence`; nové prípady zapisovača).
- **Kópia do licencie podľa licencie každého vybraného assetu (N20-c2, 11. 10.; posudok N20-c1).** Výber assetu
  (`AAssetSelect`, `AAssetSelectMedia`) pýta kópiu, keď je prepínač zapnutý (stav, v akom ho používateľ nechal) a
  aspoň jeden vybraný asset je z inej licencie než licencia nahrávania; licencia práve prehliadaná nerozhoduje (výber
  prežije jej zmenu). Widgety kopírujú len vybrané assety inej licencie, asset už v licencii nahrávania vezmú tak, ako
  je (do vlastnej licencie ho nekopírujú). Kto si všimne: admin-cms — asset vybraný nad inou licenciou sa skopíruje aj
  vtedy, keď používateľ pred potvrdením prepne na licenciu nahrávania; asset z licencie nahrávania sa nekopíruje, ani
  keď používateľ potom prepne na inú licenciu a zapne prepínač. **Na potvrdenie vlastníkovi na konci:** galéria pri
  výbere z oboch licencií skopíruje assety inej licencie a assety z licencie nahrávania vezme tak, ako sú; doteraz ich
  posielala na kópiu do ich vlastnej licencie. Assety „ako sú" sa čítajú pod licenciou nahrávania a autori pod jej ext
  systémom (N20-c3; nie pod licenciou prehliadanou pri potvrdení) a pridajú sa hneď; kópie až po použití dialógu fronty
  (N20-c4). Poradie obrázkov sa preto môže líšiť od poradia výberu (najprv „ako sú", potom kópie v poradí dialógu) a
  assety „ako sú" ostanú aj po zatvorení dialógu bez použitia. Odklad assetov „ako sú" na použitie dialógu (N20-c3)
  sme skúšali a zamietli: súbeh dvoch potvrdení prepísal čakajúci výber, pri odmietnutí všetkých kópií sa „Uložiť a
  použiť" skryje a zatvorenie výber zahodí (assety „ako sú" by sa stratili), a widget prepnutý počas kópie na len na
  čítanie nechal výber visieť pred ďalším uploadom; strata obrázkov je horšia než poradie. Keď sa nič neskopíruje
  (kópia zlyhá alebo DAM všetky odmietne), dialóg sa neotvorí a assety „ako sú" sú už pridané. Známe obmedzenia
  (okrajové súbehy, nemenené): použitý dialóg skôr, než sa dočítajú assety „ako sú", dá kópie pred ne; prepnutie
  widgetu na len na čítanie počas kópie pridanie assetov „ako sú" nezastaví. Testy:
  `LW/consumerProfileImageWidgetLibrary.test.ts` (oba výbery: asset inej licencie potvrdený nad licenciou nahrávania,
  asset licencie nahrávania s prepínačom nad inou licenciou, výber z oboch), `LW/ImageWidgetsCopyToLicenceFailure.test.ts`
  (widget obrázka a obrázka s médiom: asset už v licencii nahrávania sa nekopíruje a použije sa; galéria: taký asset sa
  pridá; výber z oboch licencií pri dvoch licenciách s rôznym ext systémom: „ako sú" hneď s popisom a zdrojom z autorov
  ext systému licencie nahrávania, kópie po použití dialógu, „ako sú" ostanú po zatvorení, a pri zlyhanej kópii aj pri
  odmietnutí všetkých kópií odpoveďou 200 bez dialógu).
- **Voľba `copyToLicenceEnabled` (N20V, 11. 10.).** Nepovinná voľba konfigurácie DAM: pri `false` výber assetu
  (`AAssetSelect`, `AAssetSelectMedia`) prepínač „Kopírovať do licencie" neukáže a widgety kópiu nepošlú. Predvolene
  (voľba chýba) ako doteraz, nikto si nič nevšimne; admin-ugc ju vypne vo svojej konfigurácii (odovzdávka tímu
  admin-ugc). Typ konfigurácie len pribudne.
- **Nález 33, oprava (krok 33 po N20V, LIB, 11. 10.).** Výber assetu (`AAssetSelect`, `AAssetSelectMedia`) sa po
  hláške „licencia nie je povolená" neotvorí (`modelValue` späť na `false`); doteraz sa otvoril prázdny nad žiadnou
  licenciou a ďalšie stlačenie už hlášku neukázalo. Kto si všimne: admin-cms, používateľ bez používateľa DAM pre
  licenciu widgetu (admin-ugc kontrolu preskakuje), a od C3 admin-dam tam, kde pripája `AAssetSelect` knižnice
  (`ImagePreview.vue:183`, `AssetSibling.vue:82`, `ExtSystemTtsSettingsForm.vue:110`; posudok Codexu C3), ak používateľ
  nemá prístup k licencii; hláška sa ukáže pri každom stlačení. Text ani kľúč sa nemení.
  Testy: `LW/consumerProfileImageWidgetLibrary.test.ts` (prípad „says the licence is not allowed…" otočený: výber sa
  neotvorí, druhé stlačenie hlášku zopakuje; nový describe nad skutočným `AAssetSelectMedia`).
- **Nález 64, oprava (vlastník 9. 10.; v U6, 11. 10.).** Dialóg jedného súboru: obal obrázka s prekrytím chyby
  (`.position-relative`, rámec `L/assetDetail/components/AssetDetailDialogFrame.vue`, len keď je slot `image-overlay`)
  má okolo sivého zástupného rámčeka plochu ľavej strany ako obrázok detailu (`w-100 h-100`, obsah v strede `d-flex
  align-center justify-center`; `pictureIsPlaceholder` v `assetDetailView.ts`); doteraz mal 0×0. Okolo obrázka počas
  posielania a okolo náhľadu ostáva obal podľa obsahu ako doteraz (U6-c1: náhľad má rozmer, v akom bol požadovaný, a
  závoj „hotovo" kryje len jeho). Kto si všimne: admin-cms a admin-ugc, odmietnutý súbor (napríklad nesprávny typ alebo
  veľkosť) ukáže sivý zástupný rámček na celej ploche so závojom chyby nad ním, namiesto ikony a textov chyby cez sivý
  krúžok. Plochu dostane každý stav so zástupným rámčekom: aj nahraný riadok bez `links.image_detail` (sivý rámček s
  fajkou „hotovo" na celej ploche, pred U6 0×0 a neviditeľný) a zlyhaný upload bez náhľadu (plocha so závojom chyby).
  admin-dam dialóg jedného súboru knižnice nepoužíva. Text ani kľúč sa nemení. Testy:
  `LT0/consumerProfileUploadDialogSingle.test.ts` („gives the grey placeholder of a refused file and its overlay the
  area of the picture, under the style of the library" a „draws the preview of an uploaded file in the size it was asked
  in, under the style of the library", so štýlom knižnice vloženým len pre tieto prípady); prípad štruktúry z U0-L bez
  zmeny.
- **Nález 62, oprava (vlastník 9. 10.; v U6, 11. 10.; kozmetické zblíženie s riadkom fronty).** `AssetInfobox`
  v detaile assetu neukáže čip dôvodu zlyhania, keď je dôvod `none`, tak ako riadok fronty
  (`UploadQueueItemErrorOverlay`); pod „Spracovanie súboru zlyhalo" doteraz stál čip „None". Kto si všimne: admin-cms
  a admin-ugc, detail assetu so zlyhaným súborom bez dôvodu. Test: `LT/assetDetailDialog.test.ts` (nový riadok
  „…failed, and no reason where the DAM names none"; riadok s dôvodom ostáva).
- **Nález 25, oprava (vlastník 9. 10.; krok 25 po U6, LIB, 11. 10.).** Dialóg jedného súboru ponúkne „Obnoviť" aj
  pri zlyhanej položke, za tej istej podmienky ako riadok fronty (`L/uploadQueue/components/UploadQueueItemEditable.vue:192-193`):
  položka je `Failed`, obnovenie ju ešte môže zmeniť (`refreshMayHelp` skladu) a má asset. Taká je položka, ktorej
  upload klient vzdal po odoslaní požiadavky na dokončenie (nie pri odmietnutí serverom), alebo duplikát, ktorého
  originál sa nepodarilo načítať (aj vtedy, keď ju takto zlyhalo samo „Obnoviť"). Tlačidlo ostane, kým to platí (zmizne,
  keď sa položka usadí alebo keď sklad prestane počítať s tým, že obnovenie pomôže), a stlačenie číta asset znova ako
  „Obnoviť" riadku. Položka zlyhaná slovom servera ho nedostane, ako v riadku. Doteraz ho dialóg pri zlyhanej položke
  neponúkal nikdy (tlačidlo ukázané po 20 s pri zlyhaní zmizlo). Formulár a obe uloženia zlyhanej položky ostávajú
  vypnuté ako doteraz. Kto si všimne: admin-cms a admin-ugc, dialóg jedného súboru s takou položkou; admin-dam dialóg
  jedného súboru knižnice nepoužíva. Text ani kľúč sa nemení; na backend ide po stlačení to isté čítanie ako pri
  „Obnoviť" riadku. `L/uploadQueue/components/UploadQueueDialogSingleSidebar.vue` (`showRefresh`). Testy:
  `LT/uploadQueueDialogSingle.test.ts` (prípad „says nothing when the refresh itself fails the item, and still offers it"
  otočený v `:348`, pred krokom „…and no longer offers it"; nový prípad „offers it to a failed item whose refresh may
  still help, and reads again when pressed"; `it.each` „does not offer it for an item that has failed", ručne zlyhaná
  položka, `:430-442` (pred krokom `:402-414`) bez zmeny). Obmedzenie nálezu 37 (po 28) platí teraz aj v dialógu: položka,
  ktorá bola `Failed` už pred stlačením a pri obnovení znova zlyhá, dostane hlášku (pravidlo pozerá na zmenu stavu), ako v riadku.
- **Nález 30, oprava (vlastník 9. 10.; krok 30 po U7, LIB, 11. 10.).** Keď po kontrole formátu a veľkosti nezostane
  žiadny súbor, widget nič nezaradí a dialóg uploadu neotvorí; upozornenie „nesprávny formát alebo veľkosť" ostáva.
  Šesť miest, tri widgety × vstup súboru a pustenie na widget:

  | Widget | Vstup súboru (`onFileInput`) | Pustenie (`onDrop`) | Doteraz po upozornení |
  |---|---|---|---|
  | obrázka (`L/imageWidget/components/ImageWidgetInner.vue`) | „Nahrať obrázok" v menu | dropzóna; návrat pred vypýtaním zámku poľa | dialóg jedného súboru nad frontou bez riadku, točil načítavanie do zatvorenia |
  | obrázka s médiom (`ImageMediaWidgetInner.vue`) | to isté | to isté | to isté |
  | viacerých obrázkov, galéria (`ImageWidgetMultipleInner.vue`) | tlačidlo nahrávania | dropzóna | dialóg fronty nad prázdnou frontou: titulok „hotovo", žiadny riadok, uloženie vypnuté |

  Kto si všimne: admin-cms a admin-ugc, súbor, ktorý ext systém neprijme (typ alebo veľkosť). Text ani kľúč sa nemení,
  na backend nejde nič (ani predtým nešlo). Testy: `LW/consumerProfileImageWidgetUpload.test.ts` („of a type the ext
  system does not take, in …": pre widget obrázka aj s médiom výber cez menu, pustenie, a ďalší prijateľný súbor sa
  zaradí ako inokedy; prípad „…and the upload dialog opens on a loader" otočený),
  `LW/consumerProfileImageWidgetMultipleUpload.test.ts` (galéria: súbor odmietnutý vstupom, prázdny zoznam z dropzóny,
  a pustený prijateľný súbor sa zaradí).
- **Nález 31, oprava (vlastník 9. 10.; krok 31 po 30, LIB, 11. 10.).** Pozíciu nových obrázkov galérie pri „uložiť a
  použiť" dialógu fronty prideľuje len widget (`L/imageWidget/components/ImageWidgetMultipleInner.vue`, `positioned` v
  `onAssetUploadConfirm`); dialóg fronty (`L/uploadQueue/components/UploadQueueDialog.vue`) ju už nezvyšuje, sklad
  obrázkov nečíta a pozíciu obrázkom nedáva: pri dvoch dodávaných mapovaniach (predvolené knižnice a mapovanie
  admin-ugc) ich podá bez kľúča `position`; vlastné mapovanie aplikácie ho podať môže, galéria ho prepíše. Doteraz
  pozíciu zvýšil dialóg aj widget, takže nové obrázky mali po starých medzeru veľkú ako ich počet (po dvoch starých 5
  a 6 namiesto 3 a 4). Medzera po odobratom obrázku ostáva ako doteraz a ide na backend (nález 80: po [1, 2] odober
  druhý a nahraj dva → 1, 3, 4). Kto si všimne: nikto na obrazovke
  (poradie sa nemení); menia sa čísla `position` poslané do API obrázkov v galérii (admin-cms, admin-ugc). Druhý
  hostiteľ dialógu, výber assetu (`L/assetSelect/components/AAssetListInner.vue`), podané obrázky nečíta: jeho „uložiť
  a použiť" už nezvýši počítadlo galérie na tej istej stránke. Text ani kľúč sa nemení. Testy:
  `LW/consumerProfileImageWidgetMultipleUpload.test.ts` (`[1, 2, 5, 6]` → `[1, 2, 3, 4]`, počítadlo 4; uloženie pošle
  pozície 3 a 4), `LT0/consumerProfileUploadDialogActions.test.ts` a `LT0/consumerProfileUploadDialog.test.ts` (dialóg
  podá obrázky bez kľúča `position` a počítadlo nechá).
- **Nález 36 (s nálezom 63), oprava (vlastník 9. 10.; krok 36 po 31, LIB, 11. 10.).** Štyri časti, uložené dáta sa
  nemenia (`analyzy/nalez36-co-ide-do-api-obrazkov.md`):
  - **(A, A2) Do API obrázkov idú len polia obrázka** (`texts`, `flags`, `dam`, a `position` a `id`, len keď ich
    obrázok má): `createImage` a `updateImage` widgetu obrázka a widgetu obrázka s médiom, `bulkUpdateImages` galérie
    (na kópii riadkov, po doplnení zdroja z autorov). Doteraz šlo navyše `authorIds` a `assetId` z mapovania uploadu,
    v galérii aj `key`, `damAuthors`, `showDamAuthors`. **Širšie, než tie kľúče:** pri úprave obrázka, ktorý widget
    najprv prečítal, bolo telom všetko, čo `fetchImage` alebo `fetchImageListByIds` aplikácie vrátilo, teda aj polia
    aplikácie mimo typu obrázka (v admin-cms `ownerResourceName`, `ownerResourceId`, `site`, `siteGroup`, `removedAt`;
    core-cms ich pri úprave nečíta). Tie už do `updateImage` ani `bulkUpdateImages` nejdú. Je to zmena zmluvy pre
    vlastné `updateImage` a `bulkUpdateImages` aplikácie: funkcia dostane len `texts`, `flags`, `dam`, `position` a
    `id`, nie objekt, ktorý jej čítanie vrátilo. Patrí do textu pre changelog. Kto si všimne: admin-cms, kratšie telo
    `POST`/`PUT /adm/v1/image` a audit log core-cms bez tých kľúčov (core-cms ich ignoroval); admin-ugc nie (telo si
    skladá sám z polí obrázka). Pomôcka `imageFieldsOf` v `L/imageWidget/utils/damImage.ts` (nevyvezená).
  - **(B) Widget neprečíta obrázok, ktorý práve vytvoril** (widget obrázka, widget s médiom a, nález 63,
    `AImagePublicInput`): po `createImage` ukáže obrázok z odpovede; druhé čítanie (`fetchImage`, v admin-cms `GET
    /adm/v1/image/{id}`) odpadlo. Každá iná zmena id (rodič, spolupráca, aj späť na vytvorený obrázok) sa číta ako
    doteraz. Kto si všimne: admin-cms a admin-ugc, náhľad po vytvorení neblikne na zástupný obrázok a zlyhané čítanie
    už neukáže chybu po úspešnom uložení; o jednu požiadavku menej. Verejný vstup vyplní polia z odpovede (orezané
    texty, id súboru), ako ich doteraz vyplnilo druhé čítanie.
  - **(C) `mainFileSingleUse` riadku fronty sa nepošle ako `null`:** hromadné uloženie metadát
    (`L/api/damAssetApi.ts`, `listItemsToMetadataBulkItems`) pošle `false`, keď riadok prepínač nepozná. DAM z `null`
    robil `false` aj doteraz; pri skutočnom DAM taký riadok prakticky nevzniká. Uloženie jedného assetu v detaile
    (`updateAssetMetadata`) sa nemení.
  Text ani kľúč sa nemení. Testy: `LW/consumerProfileImageWidgetUpload.test.ts` (volania `createImage`/`updateImage`
  bez `authorIds` a `assetId`, bez `fetchImage` po vytvorení; ten istý prípad pre widget s médiom; „reads the image its
  model is changed to after that, as before"), `LW/consumerProfileImageWidgetMultipleUpload.test.ts` (telo galérie len
  s poľami obrázka), `LW/damImageSites.test.ts` (verejný vstup: len `createImage`, polia z odpovede),
  `LW/damImage.test.ts` (`imageFieldsOf`), `LT0/damAssetApiBulkMetadata.test.ts` (`null` → `false`).
- **Nález 45 (IM11), oprava (vlastník 9. 10.; krok 45 po 36, LIB, 11. 10.).** Widget obrázka s médiom
  (`L/imageWidget/components/ImageMediaWidgetInner.vue`) pri vybranom assete obrázka číta vlastné mapovanie aplikácie
  `customAssetSelectMetadataToImageMap`, keď ho aplikácia má, presne ako widget obrázka: popis a zdroj sú z mapovania
  tak, ako ich podá, DAM sa na autorov nepýta a pole autorov DAM sa neponúka. Bez mapovania ako doteraz (popis z
  metadát, zdroj z mien autorov, alebo ponuka autorov DAM). Kto si všimne: dnes nikto (admin-cms mapovanie nemá,
  admin-ugc widget s médiom nemá). Text ani kľúč sa nemení. Testy: `LW/damImageWidgetSites.test.ts` („the image … makes
  of a picked asset by the mapping of the application" pre oba widgety: texty z mapovania, aj `null` a `undefined`
  namiesto textu; mapovanie dostane asset z DAM raz; žiadne čítanie mien).
- **Nález 49, F-C a F-D, oprava (vlastník 9. 10.; krok F-C po 45, LIB, 11. 10.).** Pravidlo „rizikový asset": asset
  nie je popísaný (`flags.described`) a jeho hlavný súbor je `uploading`, `uploaded` alebo `stored`; server mu ešte
  môže doplniť metadáta zo súboru a uloženie odtiaľto by ich prepísalo a asset označilo za popísaný (vnútorná funkcia
  `L/assetDetail/utils/assetMetadataMayStillChange.ts`, nevyvezená). Popísaný asset, spracovaný, zlyhaný, duplikát a
  asset bez súboru rizikové nie sú.
  - **(F-C) Detail assetu knižnice** (`L/assetDetail/components/AssetDetailSidebarMetadata.vue`): „Uložiť" je pri
    rizikovom assete vypnuté a nad formulárom je veta z existujúceho kľúča
    `common.damImage.queueItem.stillUploadingOrProcessing` (SK „Asset sa stále nahráva alebo spracováva serverom").
    Detail sa sám znova nečíta; po spracovaní ho používateľ otvorí znova. Pokrýva „Upraviť v DAM" vo výbere assetu aj
    „Upraviť asset" vo widgetoch. **Aj okno uploadu (opravené po posudku, FC-47-c1):** detail otvorený z riadku fronty („Upraviť asset" v dialógu uploadu galérie, `ImageWidgetMultipleInner.vue`, a výberu assetu, `AAssetListInner.vue`) číta asset čerstvo, a riadok má formulár aj „Upraviť asset" už z notifikácie metadát bez ohľadu na stav súboru (admin-cms má notifikácie; admin-ugc dopytuje a formulár dostane až so spracovaným súborom). Kto súbor práve nahral a otvorí detail riadku, kým sa súbor spracúva, má teda „Uložiť" vypnuté s vetou, kým detail neotvorí znova po spracovaní. Na rozhodnutie vlastníka (kód ostáva: pravidlo chráni pred prepísaním toho, čo doplní spracovanie).
  - **(F-D) Widget obrázka a widget obrázka s médiom:** pri výbere rizikového assetu bez autorov sa pole autorov DAM
    neponúkne (`showDamAuthorsInCmsImage` ostane `false`), takže potvrdenie dialógu obrázka nepošle
    `updateAssetAuthors` s `described: true`; zdroj obrázka používateľ napíše sám.
  Kto si všimne: admin-cms a admin-ugc (F-C), admin-cms s ext systémom s autormi (F-D), len pri assete vybranom skôr,
  než server spracoval jeho súbor (prakticky cez čerstvé ID vo vyhľadávaní výberu). Nový text ani kľúč nie je; na
  backend nejde v tom stave uloženie metadát ani autorov. Testy: `L/assetDetail/__tests__/assetDetailDialog.test.ts`
  („of an asset whose file the server has not processed yet": tri stavy vypnuté s vetou; spracovaný, zlyhaný,
  duplikát, bez súboru a popísaný zapnuté), `LW/damImageWidgetSites.test.ts` („the authors of the DAM … offers a picked
  asset that has none", oba widgety: tri stavy bez ponuky a bez zápisu do assetu; spracovaný a popísaný ako doteraz).
- **Nález 47, oprava (vlastník 9. 10.; krok 47 po F-C, LIB, 11. 10.).** Widget obrázka a widget obrázka s médiom
  (`L/imageWidget/components/ImageWidgetInner.vue`, `ImageMediaWidgetInner.vue`, `onDrop`): z viacerých súborov
  pustených naraz zaradia len prvý a ukážu upozornenie z nového kľúča `common.damImage.upload.onlyOneFile` (SK „Sem
  sa dá nahrať len jeden súbor; použije sa prvý.", EN „Only one file can be uploaded here; the first one is used.", CS
  „Sem lze nahrát jen jeden soubor; použije se první."). Doteraz sa nahrali všetky, dialóg jedného súboru ukázal len
  prvý, pri uložení zapísal prepínač prvého všetkým a widget použil prvý; ostatné assety ostali v DAM bez obrázka.
  „Prvý" je prvý po kontrole formátu a veľkosti (odmietnuté súbory menuje ich vlastné upozornenie). Jeden pustený
  súbor a výber cez menu (vstup berie jeden súbor) ako doteraz; `AFileDropzone`, galéria a výber assetu sa nemenia.
  Pri spolupráci (zámok poľa) sa nahrá jedno pustenie (FC-47-c1): pustenie, kým je žiadosť o zámok skoršieho pustenia
  na ceste, sa neberie; pustenie po odmietnutej žiadosti požiada znova ako doteraz a nahrá sa namiesto toho, ktoré
  ešte čaká. Doteraz zaradilo súbor každé čakajúce pustenie. Známe obmedzenie (nemení sa): pri dvoch pusteniach v
  tom istom okamihu (do 100 ms po pridelení zámku, alebo v jednom ťahu slučky bez spolupráce) sa použije posledné,
  nie prvé; nahrá sa aj tak len jeden súbor (`impl/47.md`). **Mimo opravy (nález 81):** dialóg výberu súboru z menu
  má vlastnú dropzónu (`L/../ui/file/components/AFileInputDialog.vue`, `AFileInput.vue`), ktorá z viacerých pustených
  súborov vezme prvý ešte pred kontrolou formátu a bez upozornenia (ak je prvý odmietnutý, platný druhý sa stratí);
  spoločný komponent, nemenený.
  Kto si všimne: admin-cms a admin-ugc pri pustení viacerých súborov na widget jedného obrázka. Na backend ide jeden
  upload namiesto viacerých. Testy: `LW/consumerProfileImageWidgetUpload.test.ts` („dropped onto the image widget /
  the image and media widget": s ďalšími → jeden riadok, upozornenie, dialóg; sám → bez slova).
- **Opravy chýb rozhodnuté 9. 10.** (nálezy 25, 28, 30, 31, 36, 38, 44, 45, 47, PK3, 49 F-C a F-D): menia
  správanie, nie sú zblížením; každá je samostatný krok po kroku U, ktorý ten kód prepisuje (4.5). Do registra
  nepatria. Nález 24 (riadok ihriska v U1) nemení nič.

### 6.3 Čo v registri nie je, lebo ostáva na každej strane

Prekrytie duplikátu a riadok „Hlavný súbor je duplikát." (RD3, RD4); tlačidlo úpravy, čo otvorí a či je na duplikáte (RD5, `hideEditOnDuplicate`); kôš: odstrániť
z fronty proti zmazať asset (RD9); kedy sa dá zrušiť (RD8); formulár duplikátu (RD15); rozsah validácie (RD17, FM4);
vzhľad zamknutých polí (RD19, AK3); prepínač jednorazovej licencie (RD20); kedy riadok ponúkne „Obnoviť" a kôš:
watcher každej strany, admin-dam cez `refreshOffered` (RD10, RD12; verzia 2 a 3); od koľkých riadkov je sidebar (ZN2); posun klávesmi (ZN3); kto sa
pýta servera, kto ruší, kto odstraňuje, kto upozorňuje, kto plní cache (ZN7 až ZN12); do ktorých riadkov idú kľúčové
slová a autori a kto zapisuje (HO4, HO5); ikona TTS (OB3); právo vytvoriť (AK2); ikona „nové" podľa fronty strany
(AK7); všetko z 1.9 (obaly) a „per adaptér" z 1.10, vrátane obalu okolo obrázka len s prekrytím (JS9, nové vo verzii 2).
Tvar udalosti „Obnoviť" (RD21) a meno kľúča fronty v udalosti „Zrušiť" (RD22) ostávajú každej strane cez obal
admin-dam, bez zmeny riadku knižnice.

### 6.4 Vnútorné prírastky, ktoré nič nemenia

| Prírastok | Prečo sa nič nemení |
|---|---|
| Väzby `queue` a `operations` s predvolenými väzbami knižnice | bez podanej väzby robí zoznam a sidebar presne dnešné volania knižnice |
| Chip volá sklad knižnice až keď treba, nie v `setup` | sklad knižnice v CMS a UGC vznikne o chvíľu neskôr alebo vôbec; jeho odber notifikácií je lenivý už od kroku 2 (O13) |
| `UploadQueueItemErrorOverlay` vyňaté z riadku | presun; dialóg jedného súboru používa prekrytie, jeho „Obnoviť" ostáva po svojom až do opravy nálezu 25 po U6 (4.5) |
| Watcher „Obnoviť" admin-dam presunutý z riadku do obalu | doslovný presun `AQIE:132-275`; riadok knižnice dostane jeho výsledok cez `refreshOffered` |
| `AssetFileInfoPanel` | presun dvoch rovnakých panelov s vlastnosťou `showUsers`; zalamovanie každej obrazovky ako dnes (JS29) |
| Obaly admin-dam na dnešných cestách | držia dnešné vlastnosti a udalosti, takže volajúci a testy admin-dam sa nemenia |
| Kontrola práva na editor oblasti presunutá z dvoch dialógov do rámca | ten istý kód raz (JS31); `readonly` ide editoru ako dnes |
