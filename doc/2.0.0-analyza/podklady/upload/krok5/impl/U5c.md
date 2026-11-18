# U5c: obal riadku a zoznamu fronty admin-dam (impl-dam)

Plán 2.7 „U5c"; návrh komponentov (`navrh-komponenty.md`): 2.2 (riadok `ADamUploadQueueItem` a obal), 2.3 (zoznam
`ADamUploadQueueList`, väzba `UploadQueueListBinding`), 4.1 (riadok U5c, `:1155`), 4.5 (nález 44), register ZK5, ZK6,
ZK13, ZK14, ZK15, ZK27 (riadok), texty R10. Strom `/home/volar/projects/anzusystems/admin-dam` (po U5b-c1 a F-B-c3),
knižnica v kópii C2. TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam`. Bash bez `cd`, nič sa nemazalo.

## Podkroky

1. **Snímok `U5c`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam U5c`, hotový. Mimo `src` nič.
2. **Obal zoznamu** `D/asset/components/queue/AssetQueueEditable.vue` (114 → 89): `ADamUploadQueueList` s väzbou
   `queue` nad skladom, upozorneniami a cache mien admin-dam. Vlastnosti `queueId`, `massOperations`,
   `disableDoneAnimation` ostávajú.
   - `items` číta `getQueueItems(props.queueId)`.
   - **`cancel: (item, _index, queueId) => stopItemUpload(queueId, item)`**: ruší vo fronte, ktorú pomenuje udalosť
     riadku (tretí parameter väzby), ako doteraz (`:59-61` pred krokom).
   - `remove` je prázdne. Riadok berie z fronty vlastné zmazanie assetu (`removeItem` → `removeByAssetId`).
   - `refresh` volá `refreshQueueItem`, `refreshMayHelp` je `false`, `warn` ide cez `showWarningT` z balíka
     v kóde admin-dam.
   - `prime` podá kľúčové slová a autorov riadkov cache admin-dam a vypýta mená, raz pri pripojení.
   - `mainFileSingleUseEnabled: true` je bez účinku (doplnené po posudku): číta ho len predvolený riadok zoznamu
     a slot `item` ho nahrádza. Prepínač kreslí riadok podľa vlastnej predvolenej hodnoty `true`.
   - **Stráž obnovenia** (riadok, ktorý už nie je vo fronte, sa nepýta; upozornenia podľa výsledku a konca riadku)
     už nie je kód obalu. Robí ju `createUploadQueueItemRefresh` knižnice nad touto väzbou (ZK6). Slot `item`
     dostane `refresh` viazané na riadok a obal ho volá z `@refresh-item`, obsah udalosti nečíta.
   - `provide(UploadQueueSuggestionsKey, …)`: ikonu „nové" chipy čítajú z front skladu admin-dam.
   - Šablóna: `:mass-operations-from="2"` (sidebar od dvoch riadkov, ako `list.length > 1`),
     `:keyboard-scroll="false"`, slot `sidebar` s obalom `AssetQueueSelectedSidebar`.
3. **Obal riadku** `D/asset/components/queue/AssetQueueItemEditable.vue` (512 → 246): `ADamUploadQueueItem`
   s dnešnými vlastnosťami a udalosťami obalu.
   - Riadku podáva: `:cancel-statuses` (aj `Processing` a `Failed`), `:duplicate-notice="false"`,
     `disable-form-on-duplicate`, `:validation-scope="AssetMetadataValidationScopeSymbol"`,
     `disabled-fields-as="input"`, `hide-edit-on-duplicate`, `:refresh-offered="showRefresh"`, aktuálny ext system.
   - **Watcher „Obnoviť" je presunutý doslova**: `SHOW_REFRESH_AFTER_SECONDS`, `showRefresh`, časovač, okamžitý
     watcher stavu, watcher `canEditMetadata`, `onUnmounted`.
   - `showDetail` (detail cez dva sklady) a `remove` (`deleteAsset`, upozornenia) sú bez zmeny.
   - Sloty: `image-overlay` nesie prekrytie duplikátu s `AssetLink`, `edit` tlačidlo „Edit more" (text admin-dam),
     `remove` `AActionDeleteButton` s právom `DAM_ASSET_DELETE`.
   - `cancelItem` premenuje `queueKey` udalosti riadku na `queueId`; `refreshItem` pridá `item`.
4. **Testy** (dôvody podľa 4.1):
   - `queueRowStates`: štyri EN texty R10 v testoch („Original Name", „Copy asset ID", text neznámej chyby, „Invalid file
     type").
   - `queueRowActions`: jeden („Original Name").
   - `failReasonChip`: chip z balíka (`ADamAssetFileFailReasonChip`) a R10.
   - `customMetadataForms`: formulár z balíka (`ADamAssetCustomMetadataForm`) s ext systémom a rozsahom admin-dam.
     **Prípad `:129-138` je otočený (ZK27):** bez čísla v konfigurácii sú pripnuté dve polia, nie žiadne.
   - `assetMetadataValidation`: prepis nad `uploadUi.ts`. Formulár je z balíka, rozsah DAM výslovne, sklad
     konfigurácie naplnený (náhrada `useDamConfigState` vypadla). Prípad „behind 'show all'" má `pinned 0`
     namiesto `undefined`.
   - `cachedChipUnresolved`: ostal len chip autora, z balíka (`ADamAuthorCachedChip`).
     - Prípady chipu kľúčového slova a chipu konfliktu vypadli, stráži ich knižnica. Vypadli aj náhrady skladu a
       `currentExtSystem`.
     - **Prípad `:164` (ZK14):** vysvetlenie je v bubline aplikácie. Test na chip prejde myšou a číta text bubliny.
     - Variant len text ďalej drží atribút `title`.
     - **Prípad podaného titulku (N-U1-2):** chip knižnice vysvetlenie dá aj pod podaným titulkom, chip admin-dam
       mlčal. Test tvrdí dnešné správanie knižnice; rozhodnutie vlastníka je otvorené.
   - `queueRowValidation`: prepis nad `uploadUi.ts`. Skutočný riadok pod zberačom `useVuelidate()` ako v
     prekrytiach: 0 chýb bez metadát, 2 s nimi, 0 po strate.
   - `queueRowKeywordsAuthors`, prípad konfliktov autora, **otočený nálezom 44**: ponúka sa len „John Doe" (autora,
     ktorého riadok už má, výber neponúka). Po stlačení neostane žiadny chip a zmizne aj nadpis „Author conflicts".
     Blok druhého stlačenia vypadol.
   - `a11y/iconButtonNames`: číta tri obaly (riadok, zoznam, sidebar); súbory 1 → 3, oba počty 2 → 0.
   - **Nový** `queue/queueListCancel.test.ts`: riadok je zástupca, ktorého zrušenie pomenuje inú frontu (`slots`).
     Zoznam nad `global` volá `stopItemUpload('slots', riadok)`.
   - Bez zmeny a zelené: `queueListRow`, `queueRefresh` (zástupný riadok nad skutočným zoznamom: stráž obnovenia
     drží cez knižnicu), `overlaySave`, `slotsOverlay`, `lazyMetadata`, prípad U0 „na duplikáte žiadne tlačidlo
     úpravy".
5. **Prvý beh celej sady po obaloch** (pred úpravou testov): 9 z 1 279 červených. Sú to presne R10 (5), nález 44
   (1), `iconButtonNames` (2) a `queueRowValidation` (1). Súbory, ktoré ešte importovali bloky admin-dam podľa
   cesty, ostali zelené naprázdno a sú prepnuté na balík.
6. **Ohnutia obalov** (`u5c-bend.py`; každé zvlášť, použité 1×).
   - Prvé štyri bežali nad `DT/queue`, `DT/asset` a `DT/a11y` (601 prípadov). Ostatné nad ôsmimi súbormi, ktoré
     montujú riadok a zoznam (`queueRowStates`, `queueRowActions`, `queueRowKeywordsAuthors`, `queueRowValidation`,
     `queueRefresh`, `queueListRow`, `overlaySave`, `massOperationsRows`; 221, po doplnení testov 228 prípadov).
   - Prvý pokus pustil všetkých 18 pod jedným `tezky.sh` nad tromi priečinkami: asi 3,5 min na ohnutie a zámok
     držaný celú hodinu. Úlohu som po štyroch zastavil cez `TaskStop` (proces neostal) a zvyšok pustil cielene.

   | Ohnutie | Červené |
   |---|---|
   | zoznam: zrušenie vo `props.queueId` namiesto fronty udalosti | 1 (`queueListCancel`) |
   | zoznam: sidebar už od jedného riadku | 2 |
   | zoznam: `warn` naprázdno | 12 (`queueRefresh` 10, `queueRowActions` 2) |
   | zoznam: bez `@refresh-item` | 35 |
   | zoznam: bez `@remove-item` | 3 |
   | zoznam: bez `provide` návrhov fronty | 1 (nový prípad ikony „nové") |
   | zoznam: bez `:keyboard-scroll="false"` | 6 (nové prípady klávesov) |
   | riadok: bez `hide-edit-on-duplicate` | 2 (aj prípad U0) |
   | riadok: bez `disable-form-on-duplicate` | 1 |
   | riadok: bez `:cancel-statuses` | 8 |
   | riadok: bez `:duplicate-notice="false"` | 1 (doplnené tvrdenie) |
   | riadok: bez `disabled-fields-as="input"` | 1 (doplnené tvrdenie) |
   | riadok: bez `:refresh-offered` | 10 |
   | riadok: bez výslovného rozsahu | 1 (doplnený zberač rozsahu) |
   | riadok: `:ext-system="2"` | 168 |
   | riadok: bez `update:keywords` | 2 |
   | riadok: prekrytie duplikátu vypnuté | 2 |

   - **Päť ohnutí bolo najprv zelených** (návrhy fronty, klávesy, veta duplikátu, vzhľad vypnutých polí, rozsah).
     Tie vlastnosti nestrážil žiadny test, ani pred krokom. Doplnené:
     - `queueRowKeywordsAuthors`: nový prípad „a name the upload suggested as new › is marked so on its chip…"
       (ikona `mdi-new-box` z front skladu admin-dam). V prípade vypnutého „+" tvrdenie, že oba výbery sú
       vypnuté vstupy a „+" nie je skryté.
     - `queueRowStates`: veta „The main file is a duplicate." sa v riadku nekreslí.
     - `queueRowActions`: šesť prípadov „leaves the … key alone".
     - `queueRowValidation`: druhý zberač s rozsahom admin-dam vidí tie isté 2 chyby.
   - **Nestrážené ostáva** `prime`: bez celého `prime` je všetkých 221 prípadov zelených, lebo v testoch si mená
     pýtajú výbery riadku samy. Mŕtve nie je (oprava po posudku): pre typ assetu s vypnutými kľúčovými slovami
     alebo autormi riadok výber nekreslí a `prime` je jediný, kto si tie mená vypýta. Ostáva ako doteraz a
     **U9 ho nemá mazať**.
   - **Na starých obaloch** (`vitest.old.config.mts`, `OLD_SNAP=U5c`, oba obaly) nad piatimi súbormi riadku: 6 zo 105
     červených, presne R10 (5) a nález 44 (1). Doplnené stráže sú zelené aj na starom kóde, držia teda dnešné
     správanie.
7. **K-14** (čítaním): selektory e2e admin-dam proti DOM, ktorý kreslia testy vlny 4.
   - `assetBulkEditPage.ts`: `.asset-queue-editable`, `.asset-queue-editable__sidebar`, `.dam-upload-queue__item`,
     `[data-cy="custom-field-…"] textarea`, `[data-cy="table-copy"]`, `[data-cy="button-delete"]`,
     `[data-cy="add-author"]`, `[data-cy="author-name"] input`, `[data-cy="button-confirm"]`, ikony
     `mdi-file-arrow-left-right-outline` a `mdi-file-replace-outline`. Všetky sú v blokoch knižnice a v obaloch
     rovnaké.
   - SK texty, ktoré e2e hľadá („Vyplniť len prázdne", „Nahradiť všetko", „Vyčistiť", „Kľúčové slová", „Autori"),
     má knižnica zhodné.
   - `errorPaths.spec.ts:221`: `.dam-upload-queue__item .mdi-alert:not([data-cy="icon-duplicate"])` platí. Ikona
     chyby je v prekrytí knižnice, ikona duplikátu v slote obalu bez zmeny.
   - `assetTtsPage.ts:41` (`.asset-image__meta-icons img[title=…]`) drží test `assetMetaIconsTts` (U3).
   - Nezhoda nenájdená. e2e som nespúšťal.
8. `oxfmt`, `oxlint` 0, `eslint` a `lint:tsc` (cez `tezky.sh`) 0.
9. **CK-DAM U5c** (`krok5-praca/vysledky/U5c-ck.log`) zelené: 73 súborov / 1 275 testov, všetko čisté vrátane
   buildu. Proti U5b-c1 (72 / 1 279): `cachedChipUnresolved` 19 → 7 (−12), `queueListCancel` +1, ikona „nové" +1,
   klávesy +6. **Záplata** `zaplata.sh U5c`: `krok5-praca/zaplaty/U5c.diff` (1 824 riadkov, 12 súborov); mimo `src`
   a `doc` nič.

## Zmenené súbory (12, všetky v `src`)

- `src/domains/coreDam/asset/components/queue/AssetQueueEditable.vue`,
  `src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue`
- `src/test/queue/`: `queueRowStates`, `queueRowActions`, `queueRowKeywordsAuthors`, `queueRowValidation`,
  `customMetadataForms`, `failReasonChip`, nový `queueListCancel`
- `src/test/asset/assetMetadataValidation.test.ts`, `src/test/cached/cachedChipUnresolved.test.ts`,
  `src/test/a11y/iconButtonNames.test.ts`

## Súbory bez importéra po U5c (R-K13, pre U9; ostávajú na disku a prekladajú sa)

Bez importéra v produkcii aj v testoch (skript importov podľa cesty v celom `src`):
- `D/asset/components/AssetFileFailReasonChip.vue` a s ním `D/asset/valueObject/AssetFileFailReason.ts`;
- `D/keyword/components/KeywordRemoteAutocompleteWithCached.vue` a s ním `…CachedKeywordChip.vue`;
- `D/author/components/AuthorRemoteAutocompleteWithCached.vue` a s ním `…CachedAuthorChip.vue`,
  `…CachedAuthorChipConflicts.vue` a `AuthorCreateButton.vue`;
- `D/author/composables/authorConfig.ts`, `D/keyword/composables/keywordConfig.ts`;
- `D/shared/components/customMetadata/AssetCustomMetadataForm.vue`;
- z U3, U5a a U5b ďalej: `AssetImage.vue` s ikonami, `fileValidation.ts`, `windowFilesDragWatcher.ts`,
  `AssetFooterUploadButtonStop.vue`, `AssetCustomMetadataFormMassOperations.vue`.

Trojice `useCachedAuthorsForRemoteAutocomplete` a `useCachedKeywordsForRemoteAutocomplete` v preposielačoch cache
používali len výbery admin-dam, takže sú po U5c bez volajúceho.

Doplnené po posudku (overené hľadaním mena a importu podľa cesty `@/…` v celom `src`):
- Exporty, ktoré používa už len osirotený `AuthorCreateButton.vue`: `useCreateAuthor`
  (`D/author/api/authorApi.ts:28`) a `AuthorCreateValidationScopeSymbol` (`D/shared/validationScopes.ts:3`).
- Šesť modulov bez importéra už na HEAD, mimo kroku 5 (na vedomie pre U9):
  - `coreDam/asset/api/assetCustomFormApi.ts`;
  - `coreDam/asset/components/list/components/AssetListItemImage.vue`;
  - `coreDam/asset/components/toolbar/AssetToolbarExtSystemLicence.vue`;
  - `system/composables/userDisplayHelper.ts` a s ním `coreDam/user/types/User.ts`, ktorý importuje len on;
  - `coreDam/job/composables/jobValidations.ts`;
  - `coreDam/distributionCategorySelect/composables/distributionCategorySelectValidation.ts`.

## Zblíženia

- ZK5: pravý okraj oblasti s kartami od šírky md (zoznam knižnice). **K-04 pre vlastníka.**
- ZK6: obe kontroly obnovenia sú v knižnici.
- ZK12: výber kľúčových slov riadku už nedostáva výslovné `disabled=false`; vypnutie rozhoduje formulár.
- ZK13, ZK14: chipy a výbery knižnice v riadku.
- ZK15: prázdny chip „-". **K-04 pre vlastníka.**
- ZK17, ZK18, ZK19: tlačidlo a dialóg „nový autor" výberu autora v riadku (bez presmerovania, prístupné meno „+",
  rozsah validácie dialógu). Riadok dostal výbery knižnice až teraz, takže tieto zblíženia sa v ňom prejavia od U5c.
- ZK27: dve pripnuté polia riadku, keď ext system číslo nemá.
- Texty R10 (EN) riadku: štyri z testov a piaty, titulok dialógu nového autora („Creating author"), ktorý žiadny
  test admin-dam netvrdí. Nález 44 (konflikty autora v riadku).

## Odchýlky, nálezy

- **Odchýlky od zoznamu testov plánu** (pridané, nič nevypustené navyše): nový súbor `queueListCancel.test.ts`
  (plán ho žiada ako „prípad s iným kľúčom udalosti") a päť doplnených stráží z podkroku 6.
- **Veľkosť obalu riadku:** 246 riadkov proti odhadu asi 160. Watcher „Obnoviť", `showDetail`, `remove` a tri
  sloty sú presunuté doslova, nič nepribudlo.
- **N-U1-2** (otvorené pre vlastníka): chip autora knižnice vysvetlenie „nepodarilo sa načítať" ukáže aj pod
  podaným titulkom. `cachedChipUnresolved` to tvrdí ako dnešné správanie knižnice. Ak vlastník rozhodne opačne,
  otočí sa jeden prípad.
- **Nález (nízky):** `prime` väzby zoznamu nestráži žiadny test (podkrok 6). Mŕtve nie je a nemení sa.
- Ohnutia a behy starého kódu len v pamäti. Nič sa nemazalo, nič mimo `src`.
