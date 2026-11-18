# PK3: posun zoznamu klávesmi nechá kláves v poli prehliadaču (nález 46; impl-komp-lib)

**Stav: uzavretý 11. 10.** (vedúci, po cykle 3). CK PK3, PK3-c1, PK3-c2 a PK3-c3 zelené.

Plán `plan-implementacie.md` 2.5 „PK3" (`:796-802`), 2.9 riadok „PK3 (46)" (`:1072`); návrh komponentov 4.5 riadok
„46 (PK3)" (`:1238`), 5.2 PK3, ZN3; overenie K-13. Rozhodnutie vlastníka 9. 10.: opraviť. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (po 28), TMPDIR `common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.

## Podkroky

1. **Snímok `PK3`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/common-admin PK3`, hotový pred prvou úpravou.
2. **Kód** (`src/domains/dam/uploadQueue/components/UploadQueueEditable.vue`): nová `isTypedIntoField(target)`
   (`HTMLInputElement`, `HTMLTextAreaElement` alebo `HTMLElement` s `isContentEditable`; to platí aj pre potomka
   editovateľného prvku); `handleKeyboardNavigation` pri takom cieli hneď skončí: zoznam neposunie, `preventDefault`
   nevolá. Ostatné bez zmeny: tie isté klávesy a kroky posunu, poslucháč na `document` len pri `keyboardScroll`.
3. **Testy** (`src/domains/dam/uploadQueue/__tests__/uploadQueueListHosted.test.ts`, nový describe „the keys that
   scroll a list", +4): zoznam s väzbou hostiteľa a jedným riadkom zo slotu `item` (výška 3 000 px; `input`,
   `textarea`, `div contenteditable` a text bez poľa), kontajner zoznamu 300 px, pred každým klávesom posunutý na
   600 px; udalosť `keydown` (`bubbles`, `cancelable`) vyslaná na prvok:
   - `it.each` cez tri polia: pre každý zo šiestich klávesov `defaultPrevented` `false` a `scrollTop` 600;
   - stráž mimo poľa (text v riadku): všetkých šesť klávesov zablokovaných a posun ako doteraz (+100, −100,
     ± výška − 50, 0, spodok).
   Prípady U4 „scrolls with the keys by default" a „leaves the keys alone when its host says so" bez zmeny.
4. **Dôkaz, že nové prípady vedia zlyhať** (v pamäti, `vitest.bend.config.mts` z kroku 28, snímok `PK3`):
   - ohnutie `bend-pk3-target.json` (kontrola `isTypedIntoField` z podmienky preč) → 3 / 24 červené (tri polia),
     stráž a ostatné zelené;
   - `UploadQueueEditable.vue` zo snímku `PK3` (`N39L_OLD`) → tie isté 3 / 24 („expected [ [ 'ArrowDown', true, 700 ],
     … ] to deeply equal [ [ 'ArrowDown', false, 600 ], … ]").
5. **Behy** (cez `tezky.sh`, skripty `pk3-check.sh`, `pk3-lint.sh` v scratchpade, každý jedným príkazom): cielené
   32 súborov / 603 zelených (všetky `uploadQueue/__tests__`, `consumerProfileUploadQueueRows`,
   `consumerProfileAssetListUpload`); `oxfmt`, `oxlint`, `eslint` na dvoch súboroch čisté, `lint:tsc` 0.
6. **Register**: `navrh-komponenty.md` 6.2, nová odrážka „Nález 46 (PK3), oprava" (čo sa mení, kto si všimne,
   súbory, testy).
7. **Záplata** `zaplata.sh PK3` → `krok5-praca/zaplaty/PK3.diff` (2 súbory v `src`; mimo `src` a `doc` nič), pred CK.
   **CK-LIB PK3 v LIB zelené** (`vysledky/PK3-ck.log`): `test:browser` 305 / 3 992 (28-c2 + 4), `test:eslint` 7 / 82,
   `lint:tsc`, `format:check`, `lint:oxlint`, `lint:stylelint` čisté, `lint:eslint` 0 chýb a 4 staršie varovania.

## Cyklus 1 (vedúci: „každý `input`" je viac, než rozhodol vlastník)

Vlastník rozhodol „posun nesmie zachytiť klávesy v **textovom** poli"; na prepínači šípky dnes zoznam posúvajú a
natívne nerobia nič, po PK3 by prestali (zmena navyše). Snímok `PK3-c1` pred úpravou.

1. **Kód**: `isTypedIntoField` berie `input` len mimo `KEYLESS_INPUT_TYPES` (`checkbox`, `button`, `submit`,
   `reset`, `image`, `file`); `textarea` a `isContentEditable` bez zmeny. `radio` a `range` šípky používajú, idú
   prehliadaču.
2. **Testy** (+2, súbor 26 prípadov): v riadku pribudli `input type="range"` a prepínač `input type="checkbox"`;
   `it.each` polí má aj `range` (nezablokované, zoznam stojí); stráž „posun ako doteraz" je `it.each` cez text mimo
   poľa a prepínač.
3. **Dôkaz** (v pamäti): ohnutie `bend-pk3c1-everyinput.json` („každý `input`") → červený 1 / 26: „scroll the list,
   pressed on .switch, as before"; kód zo snímku `PK3-c1` (`N39L_OLD`, stav PK3) → ten istý 1 / 26; kód zo snímku
   `PK3` (pred opravou) → červené 4 / 26 (štyri polia), stráže zelené.
4. **Text**: register 6.2 a táto poznámka spresnené (textové a podobné polia; prepínač ostáva ako dnes).

Behy (skripty `pk3c1-check.sh`, `pk3-lint.sh`): cielené 32 súborov / 605 zelených; `oxfmt`, `oxlint`, `eslint` na
dvoch súboroch čisté, `lint:tsc` 0. Záplata `zaplata.sh PK3-c1` → `krok5-praca/zaplaty/PK3-c1.diff` (2 súbory v
`src`), pred CK. **CK-LIB PK3-c1 v LIB zelené** (`vysledky/PK3-c1-ck.log`): `test:browser` 305 / 3 994 (PK3 + 2),
`test:eslint` 7 / 82, `lint:tsc`, `format:check`, `lint:oxlint`, `lint:stylelint` čisté, `lint:eslint` 0 chýb a
4 staršie varovania.

## Cyklus 2 (Opus: kláves z otvoreného menu poľa; Codex: natívny `select`; text)

Snímok `PK3-c2` pred úpravou (po CK N20; N20 bol v `src` už rozpracovaný, preto podľa pokynu najprv dokončený).

1. **Menu poľa** (Opus, medium; bolo už pred PK3): pri otvorenom menu poľa v riadku (VAutocomplete kľúčových slov a
   autorov, `ABooleanSelect`) je fokus na položke menu, ktoré Vuetify teleportuje do overlay; šípky a PageUp/PageDown
   bublajú na `document` a zoznam fronty sa posunul. Nová `isInOtherOverlay(target)`: cieľ vo vnútri
   `.v-overlay__content` (presná trieda obsahu overlay vo Vuetify 4.2.1, `node_modules/vuetify/lib/components/
   VOverlay/VOverlay.js:373`; Vuetify ju tak hľadá aj sám, `:219`, `:231`), ktorý zoznam **neobsahuje** → kláves ostáva
   menu. Podmienka „neobsahuje" je nutná: dialóg fronty v admin-cms a admin-ugc je tiež overlay (`VDialog`) a zoznam je
   v ňom; bez nej by sa v dialógu zoznam klávesmi neposunul nikdy.
2. **Natívny `select`** (Codex): `HTMLSelectElement` medzi ciele, ktoré sa nechajú prehliadaču.
3. **Testy** (+5, súbor 31 prípadov; describe „the keys that scroll a list" prerobený na spoločné pomôcky
   `rowWithFields`, `pressAll`, `left`, `scrolledAsBefore`, ciele sa hľadajú v dokumente kvôli teleportu):
   - `it.each` polí má aj `radio` a `select` (nezablokované, zoznam stojí);
   - „leave every one of them to the open menu of a field, and the list stays": v riadku otvorené `VMenu` s `VList`,
     klávesy na položke menu v overlay → zoznam stojí. `defaultPrevented` sa tu netvrdí: šípky, Home a End si berie
     zoznam menu sám (VList volá `preventDefault`), PageUp/PageDown nie; dôkaz, že obsluha fronty nekonala, je
     nepohnutý zoznam;
   - stráž „posun ako doteraz" je `it.each` cez text mimo poľa, prepínač a `input type="submit"`;
   - „scroll the list in a dialog, pressed in that dialog outside a field, as before": zoznam vo `VDialog`, kláves na
     texte v dialógu → posun ako doteraz.
4. **Dôkaz** (v pamäti, snímok `PK3-c2`): `bend-pk3c2-nooverlay.json` (bez `isInOtherOverlay`) → červený 1 / 31
   (menu); `bend-pk3c2-anyoverlay.json` (každý overlay, bez „neobsahuje zoznam") → červený 1 / 31 (dialóg);
   `bend-pk3c2-noselect.json` (bez `select`) → červený 1 / 31 (`select`); kód zo snímku `PK3-c2` (stav c1) → červené
   2 / 31 (`select`, menu).
5. **Text**: časť „Čo sa mení pre používateľa" nižšie opravená (c1 tvrdil aj „výber v rozbaľovacom zozname poľa", čo
   c1 nerobil); doplnené číselné vlastné pole a menu. Register 6.2 spresnený. Riadok 4.5 opravil vedúci.

Behy (skripty `pk3c2-check.sh`, `pk3-lint.sh`): cielené 32 súborov / 610 zelených; `oxfmt`, `oxlint`, `eslint` na
dvoch súboroch čisté, `lint:tsc` 0. Záplata `zaplata.sh PK3-c2` → `krok5-praca/zaplaty/PK3-c2.diff` (2 súbory v
`src`), pred CK. **CK-LIB PK3-c2 v LIB zelené** (`vysledky/PK3-c2-ck.log`): `test:browser` 305 / 4 005 (N20 + 5),
`test:eslint` 7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania.

## Cyklus 3 (Codex k c2: „overlay bez zoznamu" platí aj pre snackbar a iné overlay; chýbal prípad menu v dialógu)

Snímok `PK3-c3` pred úpravou.

1. **Kód**: `isInOtherOverlay` nahradila `isInMenu(target)`: cieľ vo vnútri `.v-menu` (koreň overlay každého `VMenu`,
   `node_modules/vuetify/lib/components/VMenu/VMenu.js:182`; menu VAutocomplete a VSelect sú `VMenu`). Dialóg fronty,
   snackbar ani iný dialóg sa nepočítajú: kláves v nich posúva zoznam ako pred PK3. Podmienka „overlay neobsahuje
   zoznam" odpadla, menu zoznam nikdy neobsahuje.
2. **Testy** (+3, súbor 34 prípadov; pomôcky `mountInDialog`, `openMenu`, `pressedInMenu`): nové „…open menu of a
   field in the dialog the list is in, and the list stays" (menu vnorené v dialógu fronty) a `it.each` „scroll the list,
   pressed on a button in a snackbar / another dialog, as before" (tlačidlo v `VSnackbar` a v druhom `VDialog`).
3. **Dôkaz** (v pamäti, snímok `PK3-c3`): `bend-pk3c3-anyoverlay.json` (`.v-overlay__content` namiesto `.v-menu`) →
   červené 3 / 34 (dialóg fronty, snackbar, iný dialóg); `bend-pk3c3-nomenu.json` (bez `isInMenu`) → červené 2 / 34
   (oba prípady menu); kód zo snímku `PK3-c3` (stav c2) → červené 2 / 34 (snackbar, iný dialóg).

Behy (skripty `pk3c3-check.sh`, `pk3-lint.sh`): cielené 32 súborov / 613 zelených; `oxfmt`, `oxlint`, `eslint` na
dvoch súboroch čisté, `lint:tsc` 0. Záplata `zaplata.sh PK3-c3` → `krok5-praca/zaplaty/PK3-c3.diff` (2 súbory v
`src`), pred CK. **CK-LIB PK3-c3 v LIB zelené** (`vysledky/PK3-c3-ck.log`): `test:browser` 305 / 4 008 (PK3-c2 + 3),
`test:eslint` 7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania. Codex k c3 bez nálezu.

## Zmenené súbory

- `src/domains/dam/uploadQueue/components/UploadQueueEditable.vue`
- `src/domains/dam/uploadQueue/__tests__/uploadQueueListHosted.test.ts`
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md` (6.2)

## Čo sa mení pre používateľa (rozhodnutie vlastníka 9. 10.)

admin-cms a admin-ugc, dialóg fronty: pri písaní metadát v textovom poli riadku fungujú šípky hore a dole, PageUp,
PageDown, Home a End v poli (kurzor); číselné vlastné pole (`VTextField type="number"`) šípkami natívne mení hodnotu
namiesto posunu zoznamu; v otvorenom menu poľa (kľúčové slová, autori, áno/nie) klávesy posúvajú po menu a zoznam
riadkov sa nepohne (od c2); zoznam riadkov sa v týchto prípadoch neposunie. Mimo poľa, aj na prepínači a tlačidle, sa
zoznam posúva ako doteraz. admin-dam nie (`keyboardScroll: false`, ZN3). Na backend nejde nič.

## Odchýlky

Žiadne.

## Zblíženia navyše (tvar registra)

Žiadne: je to oprava (6.2), nie zblíženie.

## Nové nálezy

Žiadne. (Pôvodná poznámka „každý `input`, aj prepínač" vyriešená v cykle 1: prepínač ostáva ako dnes.)
