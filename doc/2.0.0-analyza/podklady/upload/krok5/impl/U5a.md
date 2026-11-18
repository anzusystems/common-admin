# U5a: prekrytia uploadu na tlačidle zastavenia knižnice (impl-dam)

Plán 2.7 „U5a"; návrh komponentov (`navrh-komponenty.md`): 1.4 (ST2, R10), 2.11 (`ADamUploadQueueStopButton`), 4.1
(riadok U5a, `:1153`), 4.3 (riadok „Tlačidlo zastavenia", `:1188`), register ZK9. Strom
`/home/volar/projects/anzusystems/admin-dam` (po U3 a F-B-c2), knižnica v kópii C2. TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam`. Bash bez `cd`, nič sa nemazalo.

## Podkroky

1. **Snímok `U5a`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam U5a`, hotový. Mimo `src` nič.
2. **Kód:** `AssetFooterUploadOverlayFull.vue` a `AssetFooterUploadSlotsOverlay.vue` kreslia
   `ADamUploadQueueStopButton` z balíka namiesto `AssetFooterUploadButtonStop.vue`. Vlastnosti a udalosť sú tie
   isté: `data-cy="button-close"` a `:button-size="36"` v plnom prekrytí, `:is-uploading`, `@confirm`.
   `dialogMaxWidth` nepodával nik (ZK9).
3. **Testy podľa plánu (4.1):**
   - `DT/queue/overlaySave` a `DT/queue/slotsOverlay` menia len anglický text otázky (R10, ST2): „Are you sure you
     want to stop the upload?" → „Do you want to stop the upload?". Text potvrdenia „Close" je ten istý.
   - `DT/upload/uploadStopQuestion`: tlačidlo sa importuje z balíka (`ADamUploadQueueStopButton`), otázka je R10.
     Komentár hlavičky ostal zosúladený a nepoužitý `import type { Component }` vypadol.
   - `DT/upload/uploadStopConfirm`: **prepísaný na balík**, nie vypustený. Prípad Esc nad trvalými dialógmi
     aplikácie (predvolené `persistent` Vuetify ako v admin-dam) je strana aplikácie.
     - Náhrada `ADialogToolbar` na vstupe balíka vypadla: tlačidlo knižnice si ho importuje vnútri, takže by ho
       nezasiahla (R-K1). Teraz sa kreslí skutočný.
     - Kľúč mena tlačidla je `common.damImage.upload.stop` (test nemá správy).
   - `DT/queue/saveNothing`: náhrada `AssetFooterUploadButtonStop.vue` podľa cesty vypadla, lebo už nič
     nezasiahne. Prekrytie kreslí skutočné tlačidlo knižnice.
   - `DT/a11y/iconButtonNames`: tlačidlo admin-dam je von zo zoznamu. Súbory 4 → 3, tlačidlá 9 → 8, dvojice
     bubliny a mena 9 → 8; názov prípadu bez „stop". Knižnica svoju kópiu stráži vlastným testom.
4. **Dôkazy** (`u5a-bend.py`, `u5a-bend-run.sh`; každé ohnutie použité 1×):
   - Tlačidlo knižnice bez Esc (`onKeydown` naprázdno): 1 z 10 červený, Esc v `uploadStopConfirm`.
   - Tlačidlo knižnice, ktoré sa pýta vždy: 7 z 10 červených, v oboch testoch tlačidla.
   - Plné prekrytie bez `@confirm`: 2 z 50 červené v `overlaySave` (zastavenie po áno, okamžité zastavenie).
   - Prekrytie slotov bez `@confirm`: 2 z 9 červené v `slotsOverlay`.
   - **Prekrytia zo snímku** (`vitest.old.config.mts`, `OLD_SNAP=U5a`, oba súbory) pod `overlaySave` a
     `slotsOverlay`: 2 z 59 červené, a to oba prípady otázky. Starý text svedčí, že prekrytia teraz kreslia
     tlačidlo knižnice.
5. `oxfmt`, `oxlint` 0, `eslint` a `lint:tsc` (cez `tezky.sh`) 0; šesť zmenených testov 79/79.
6. **CK-DAM U5a** (`krok5-praca/vysledky/U5a-ck.log`) zelené: 72 súborov / 1 277 testov (počet bez zmeny, ako po
   F-B-c2), všetko čisté vrátane buildu. **Záplata** `zaplata.sh U5a`: `krok5-praca/zaplaty/U5a.diff` (214 riadkov,
   8 súborov); mimo `src` a `doc` nič.

## Zmenené súbory (8, všetky v `src`)

- `src/domains/coreDam/asset/components/footer/AssetFooterUploadOverlayFull.vue`
- `src/domains/coreDam/asset/components/footer/AssetFooterUploadSlotsOverlay.vue`
- `src/test/queue/overlaySave.test.ts`, `src/test/queue/slotsOverlay.test.ts`, `src/test/queue/saveNothing.test.ts`
- `src/test/upload/uploadStopQuestion.test.ts`, `src/test/upload/uploadStopConfirm.test.ts`
- `src/test/a11y/iconButtonNames.test.ts`

## Súbory bez importéra po U5a (R-K13, pre U9)

`D/asset/components/footer/AssetFooterUploadButtonStop.vue`: bez importéra v produkcii aj v testoch. Ostáva na disku
a prekladá sa.

## Zblíženia, odchýlky, nálezy

- ZK9: nepoužitá vlastnosť `dialogMaxWidth` zanikla s tlačidlom admin-dam. Texty R10 (EN otázka) prichádzajú
  s tlačidlom knižnice.
- Odchýlky: žiadne (`uploadStopConfirm` prepísaný, čo plán dovoľuje). Nové nálezy: žiadne. Ohnutia a beh starého
  kódu len v pamäti.
