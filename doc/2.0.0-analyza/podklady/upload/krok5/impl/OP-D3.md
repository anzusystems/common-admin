# OP-D3: bubliny na ikonových tlačidlách, ktoré žiadnu nemali, FE-16, nález 14 (impl-dam-op)

Zadanie vedúceho z 12. 10. (rozhodnutie vlastníka: LEN bubliny, žiadny `aria-label`, rozsah strážneho testu sa
nemení); `overenie-nalezov.md`, tabuľka „FE, admin-dam", riadok 14. Strom
`/home/volar/projects/anzusystems/admin-dam` (po OP-D2). TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu.

## Podkroky

1. **Snímok `OP-D3`**: `bash …/nastroje/snimok.sh /home/volar/projects/anzusystems/admin-dam OP-D3
   doc/changelog/3.0.0.md`, hotový.
2. **Počet.** Kópia počítacieho skriptu `scratchpad/a11y_icon_buttons_no_tooltip.py` (berie pravidlá a parser z
   `a11y_icon_buttons_admin_dam.py` bez zmeny a vypíše tlačidlá bez `VTooltip`). Pred krokom: 72 ikonových `VBtn`
   bez prístupného mena v 40 súboroch, 60 s bublinou, **12 bez bubliny v 11 súboroch**. Krížová kontrola: všetkých
   60 bublín je priamym potomkom svojho tlačidla (žiadna len hlbšie v menu, žiadne tlačidlo ako aktivátor bubliny
   okolo). Po kroku: 72 zo 72 s bublinou.
3. **Kód:** 12 bublín v 11 súboroch (tabuľka nižšie). Každá je zapísaná ako ostatné v tom istom súbore či
   priečinku: `<VTooltip activator="parent" location="bottom">{{ t('…') }}</VTooltip>` v tlačidle.
   - Šesť tlačidiel malo ikonu v atribúte (`icon="mdi-…"`, bez obsahu). `VBtn` so zadaným obsahom ikonu z atribútu
     nekreslí, takže sú prepísané na `icon` a `<VIcon icon="mdi-…" />` vo vnútri, ako ostatné tlačidlá s bublinou.
     Ostatné atribúty (veľkosť, variant, trieda, `data-cy`, `v-bind` aktivátora menu) sú bez zmeny.
   - `DistributionYoutubePlaylistSelect.vue` nemal `useI18n`; pribudol import a `const { t } = useI18n()`.
4. **Test:** nový súbor `src/test/a11y/iconButtonTooltips.test.ts` (5 prípadov). Strážny test
   `src/test/a11y/iconButtonNames.test.ts` sa nemenil (žiadne z 12 tlačidiel nie je v jeho troch súboroch) a
   prechádza.
5. **Dôkazy** v pamäti (`vitest.raw.config.mts` v TMPDIR: test číta šablóny ako text, takže doplnok podá text
   súboru zo snímku alebo ohnutý; skript `scratchpad/opd3-bend-run.sh`, výsledok `scratchpad/opd3-bends.txt`):
   - 11 šablón zo snímku `OP-D3`: 1 z 11 červený, „all have a tooltip", a vymenuje presne 12 miest z tabuľky.
   - Ohnutie „bublina s kľúčom, ktorý aplikácia nemá" (`common.button.clearAll`): 2 červené (texty v sk aj en).
6. `oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
7. **CK-DAM OP-D3** (`krok5-praca/vysledky/OP-D3-ck.log`) zelené: 75 súborov / 1 327 testov (po OP-D2 1 322, +5),
   všetko čisté vrátane buildu.
8. **Záplata** `zaplata.sh OP-D3`: `krok5-praca/zaplaty/OP-D3.diff` (407 riadkov, 13 súborov, z toho 1 nový); mimo
   `src` len `doc/changelog/3.0.0.md`, ktorý je v snímku.

## Čo sa mení v kóde a pre používateľa

Dvanásť ikonových tlačidiel po nabehnutí myšou povie, čo robia. Iné sa nemení: tlačidlá robia to isté, na backend
sa neposiela nič inak, `aria-label` nepribudol žiadny.

**Vzhľad** šiestich tlačidiel prepísaných z `icon="mdi-…"` na `icon` s `VIcon` vo vnútri som v prehliadači
nevidel. Vuetify v oboch zápisoch kreslí ten istý `VIcon` v tom istom tlačidle; ostáva na pohľad vlastníka.

## Nový test

`src/test/a11y/iconButtonTooltips.test.ts` číta šablóny všetkých `.vue` v `src` (ako strážny test číta tri obaly
fronty) a tvrdí:
- rozozná ikonové tlačidlo od tlačidla s textom a tlačidlo s bublinou od tlačidla bez nej (bublina hlbšie v menu
  sa neráta; tlačidlo ako aktivátor bubliny okolo neho sa ráta);
- šablóny našiel (viac než 100 súborov, viac než 50 ikonových tlačidiel);
- každé ikonové `VBtn` aplikácie má bublinu;
- texty bublín zapísané ako `t('kľúč')` aplikácia má v sk aj v en.

Je to nový test o bublinách v novom súbore, nie zmena strážneho testu. Odteraz ale drží, že nové ikonové
tlačidlo v admin-dam bez bubliny neprejde. Ak to vlastník nechce držať testom, stačí zmazať tento jeden súbor.

## Zmenené súbory (12 v `src`, 1 mimo)

- `src/domains/coreDam/asset/components/detail/components/AssetDetailDialogLoader.vue`
- `src/domains/coreDam/asset/components/detail/components/distribution/DistributionYoutubePlaylistSelect.vue`
- `src/domains/coreDam/asset/components/detail/components/slots/AssetSibling.vue`
- `src/domains/coreDam/extSystem/components/ExtSystemTtsSettingsForm.vue`
- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetFooterSelected.vue`
- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetFooterSelectedFull.vue`
- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetListSidebarFilter.vue`
- `src/domains/coreDam/externalProvider/components/ExternalProviderAssetQueueItemReadonly.vue`
- `src/domains/coreDam/shared/assetFileRoute/components/AssetFileMainRoute.vue`
- `src/domains/coreDam/shared/components/FilterClosestColor.vue`
- `src/domains/coreDam/voiceFamily/components/VoiceBindingsList.vue`
- `src/test/a11y/iconButtonTooltips.test.ts` (nový)
- `doc/changelog/3.0.0.md` (jedna položka v „Fixed")

## Texty na potvrdenie

Nový kľúč nepribudol žiadny: všetkých 12 bublín používa kľúč, ktorý aplikácia už má (knižničný `common.*` alebo
vlastný). Riadky sú čísla riadkov tlačidla pred krokom.

| # | Súbor (pod `src/domains/coreDam/`) | Čo tlačidlo robí | Kľúč | SK | EN | Prečo tento kľúč |
|---|---|---|---|---|---|---|
| 1 | `asset/components/detail/components/AssetDetailDialogLoader.vue:87` | zatvorí detail assetu, kým sa načítava | `common.button.close` | Zatvoriť | Close | to isté tlačidlo načítaného detailu (`AssetDetailDialog.vue`) |
| 2 | `asset/components/detail/components/distribution/DistributionYoutubePlaylistSelect.vue:62` | načíta playlisty YouTube znova | `common.button.refresh` | Obnoviť | Refresh | text obnovovacích tlačidiel fronty |
| 3 | `asset/components/detail/components/slots/AssetSibling.vue:66` | zruší súrodenecký asset | `coreDam.asset.slots.actions.remove` | Odstrániť | Remove | akcia tej istej záložky (sloty) |
| 4 | `extSystem/components/ExtSystemTtsSettingsForm.vue:101` | vyprázdni asset epilógu TTS ext. systému | `common.button.clear` | Vymazať | Clear | obsluha `clearEpilog` |
| 5 | `externalProvider/components/ExternalProviderAssetFooterSelected.vue:108` | zmenší pätku výberu | `common.system.modal.hide` | Skryť | Hide | to isté tlačidlo pätky assetov (`AssetFooterSelected.vue`) |
| 6 | `externalProvider/components/ExternalProviderAssetFooterSelected.vue:120` | rozbalí pätku výberu | `common.system.modal.show` | Zobraziť | Show | to isté tlačidlo pätky assetov |
| 7 | `externalProvider/components/ExternalProviderAssetFooterSelectedFull.vue:84` | zmenší prekrytie výberu | `common.system.modal.hide` | Skryť | Hide | to isté tlačidlo prekrytia assetov (`AssetFooterSelectedFull.vue`) |
| 8 | `externalProvider/components/ExternalProviderAssetListSidebarFilter.vue:54` | zruší filter | `common.button.resetFilter` | Zrušiť filter | Reset Filter | to isté tlačidlo filtra assetov (`AssetListSidebarFilter.vue`) |
| 9 | `externalProvider/components/ExternalProviderAssetQueueItemReadonly.vue:53` | vyberie asset z výberu | `common.button.delete` (**v cykle 1 nový kľúč** `coreDam.asset.selected.remove`) | Zmazať (**Odobrať z výberu**) | Delete (**Remove from selection**) | bublina koša riadku fronty assetov (knižničný `AActionDeleteButton`); zmenené v cykle 1 |
| 10 | `shared/assetFileRoute/components/AssetFileMainRoute.vue:62` | otvorí menu verejného odkazu súboru | `common.button.moreOptions` | Ďalšie možnosti | More options | knižničný text pre menu s tromi bodkami |
| 11 | `shared/components/FilterClosestColor.vue:113` | zruší vybrané farby filtra | `common.button.clear` | Vymazať | Clear | obsluha `clear` |
| 12 | `voiceFamily/components/VoiceBindingsList.vue:126` | otvorí menu hlasu (zmazať) | `common.button.moreOptions` | Ďalšie možnosti | More options | knižničný text pre menu s tromi bodkami |

Na zváženie vlastníka (texty existujú, ale nemusia sedieť presne):
- **4:** „Vymazať" pri čipe assetu môže znieť ako zmazanie assetu; tlačidlo len zruší výber. Presnejší by bol nový
  text, napríklad „Odobrať asset" / „Remove asset".
- **9:** „Zmazať" je zhodné s košom riadku fronty assetov, ale tu sa nič nemaže, asset sa len vyberie z výberu.
  Presnejšie by bolo „Odstrániť z výberu" / „Remove from selection" (nový kľúč) alebo existujúce „Odstrániť"
  (`coreDam.asset.slots.actions.remove`).
  **Hľadanie na pokyn vedúceho (v `OP-D1-c1`):** kľúč, ktorý by hovoril „odstrániť z výberu" alebo podobne,
  neexistuje, ani v textoch admin-dam, ani v nainštalovanej knižnici. Najbližšie sú: všeobecné „Odstrániť" /
  „Remove" (`common.sortable.remove`, `coreDam.asset.slots.actions.remove`); „Zrušiť výber" / „Clear selected"
  (`coreDam.asset.selected.clearOverlay.confirm`, potvrdenie zrušenia CELÉHO výberu, anglicky hovorí o všetkých);
  „Odstrániť z fronty nahrávania?" / „Remove item from queue?" (`common.damImage.queueItem.removeFromQueue`,
  otázka dialógu a iná fronta). Žiadny nesedí, bublina preto ostala „Zmazať" a bod ostáva vlastníkovi.
- **2:** všeobecné „Obnoviť"; konkrétnejšie by bolo „Načítať playlisty znova" (nový kľúč).

## Odchýlky, nové nálezy

- Odchýlka: nový test o bublinách nad celým `src` (zadanie test na každú opravu žiada; strážny test sa nemenil).
- Nové nálezy: žiadne. Jediná klikateľná ikona bez mena (`icon_click` 1 v 1 súbore podľa skriptu) nie je `VBtn` a
  do tohto kroku nepatrí; ostáva v náleze 14.

## Cyklus 1 (OP-D-c2, spoločný s OP-D2; posudky Codex + Opus nad `zaplaty/OP-D3.diff`)

Posudky: šesť tlačidiel prepísaných z `icon="mdi-…"` sa kreslí rovnako ako predtým. Tri body, snímok
**`OP-D-c2`**, záplata a CK spoločné s OP-D2 (`OP-D2.md`, „Cyklus 2").

1. **Text koša, ktorý asset len vyberie z výberu** (Codex stredné). „Zmazať" na
   `ExternalProviderAssetQueueItemReadonly.vue` zavádzalo. **Nový kľúč** `coreDam.asset.selected.remove` v sk aj en
   (`src/locales/*/coreDam/asset.json`) a bublina ho používa.
   - Test: nový súbor `src/test/queue/externalProviderSelectedRow.test.ts` (1 prípad): skutočný riadok, bublina
     po nabehnutí myšou hovorí „Remove from selection" a kôš vyšle `removeItem` so svojím indexom. S
     `common.button.delete` v šablóne (ohnutie aj kód zo snímku) je červený.
2. **Strážny test bublín, dve diery** (Codex). `src/test/a11y/iconButtonTooltips.test.ts`:
   - `VBtn` s `icon="mdi-…"` A `text` je vo Vuetify ikonové (text sa vtedy nekreslí), test ho bral za textové.
     Teraz text ráta, len keď `icon` ikonu nepomenúva (chýba alebo je holý atribút). Viazaný `:icon` sa berie
     ako pomenovaná ikona.
   - Za bublinu tlačidla sa bral každý `VTooltip` v ňom. Teraz len taký, ktorý má `activator="parent"`; pri
     bubline okolo tlačidla len vtedy, keď tlačidlo sedí v jej slote `#activator` a preberá jeho vlastnosti
     (`v-bind` bez argumentu).
   - Dva nové prípady („are icon-only also with a `text`…", „have for their tooltip only one they are the
     activator of"); pôvodný prvý prípad je rozdelený. Súbor 7 prípadov (predtým 5). Všetkých 72 tlačidiel
     aplikácie prísnejšie pravidlá spĺňa.
   - Ohnutia (v pamäti, nad samotným testom): „`text` sa ráta vždy" → 1 červený (prvá diera); „každý `VTooltip`
     vo vnútri" → 1 červený (druhá diera); „vlastnosti slotu sa nežiadajú" → 1 červený.
3. **Dve tlačidlá „ďalšie možnosti" s bublinou aj menu na tej istej strane** (`AssetFileMainRoute.vue`,
   `VoiceBindingsList.vue`). Pozrel som, ako sú napísané iné tlačidlá s menu aj bublinou. Všetkých päť, ktoré
   som našiel, má bublinu dole (`activator="parent" location="bottom"`) a menu na predvolenej strane, teda
   tiež dole:
   - admin-dam `AssetSlotListItem.vue:208-261` (tri bodky slotu) a `AssetToolbarOptions.vue:72-137`: menu aj
     bublina vnútri tlačidla, ako teraz `VoiceBindingsList.vue`;
   - admin-dam `AssetToolbarIntegrations.vue:67-88`: tlačidlo v slote `#activator` menu, bublina vnútri
     tlačidla, ako teraz `AssetFileMainRoute.vue`;
   - knižnica `AListEditor.vue:948-967` (tri bodky riadku) a `ADatatableConfigButton.vue:52-62`.
   Obe nové tlačidlá teda existujúci zápis už dodržiavajú a **kód sa nemenil**. **Na pohľad vlastníka v
   prehliadači:** menu verejného odkazu súboru (`AssetFileMainRoute.vue`, tri bodky pri stave odkazu) a menu
   hlasu v zozname hlasov (`VoiceBindingsList.vue`, tri bodky v riadku): či bublina po otvorení menu neprekáža.

**Na kóde zo snímku `OP-D-c2`:** text koša červený (súčasť 8 červených zo 129, `OP-D2.md`). **CK-DAM OP-D-c2**
zelené: 76 súborov / 1 355 testov, build prešiel. **Záplata** `krok5-praca/zaplaty/OP-D-c2.diff` (spoločná).

Zmenené súbory k OP-D3 v cykle: `ExternalProviderAssetQueueItemReadonly.vue`, `src/locales/sk/coreDam/asset.json`,
`src/locales/en/coreDam/asset.json`, `src/test/a11y/iconButtonTooltips.test.ts`,
`src/test/queue/externalProviderSelectedRow.test.ts` (nový), `doc/changelog/3.0.0.md` (text koša v položke OP-D3).

### Texty na potvrdenie (cyklus 1)

| Kľúč | SK | EN | Poznámka |
|---|---|---|---|
| `coreDam.asset.selected.remove` | Odobrať z výberu | Remove from selection | nový; bublina koša vybraného assetu z externého zdroja |

## Cyklus 2 (OP-D-c3, spoločný s OP-D2; posudky nad `zaplaty/OP-D-c2.diff`)

Jedna drobnosť v strážnom teste bublín (`src/test/a11y/iconButtonTooltips.test.ts`), snímok, CK a záplata
`OP-D-c3` spoločné s OP-D2 (`OP-D2.md`, „Cyklus 3"; CK 76 súborov / 1 360 testov, zelené).

- **Slot `#activator` bral za dôkaz akýkoľvek holý `v-bind`.** Teraz tlačidlo musí viazať to, čo mu slot podal:
  meno, ktoré slot dal svojim `props` (`{ props }`, `{ props: iné }`, alebo `slot.props` pri nerozloženom slote),
  sa musí vyskytnúť vo výraze holého `v-bind` tlačidla (aj vnútri `mergeProps(…)`).
- Nový prípad „are the activator of a tooltip around them only when they bind the props of its slot" (súbor má
  8 prípadov, predtým 7): `v-bind="attrs"`, iné meno než dal slot, slot bez `props` a `otherProps` nestačia;
  premenované `props`, `mergeProps(menu, props)` a `slot.props` stačia.
- Ohnutie „stačí akýkoľvek holý `v-bind`" (v pamäti, nad testom): 1 červený, práve tento prípad.

### Nový nález (neopravený, číslo pridelí vedúci)

- **Panel nástrojov editora ukazuje anglické bubliny v každom jazyku.** `AnzutapToolbarItem.vue:37` kreslí
  `:text="item.titleT"` bez prekladu a `anzutapToolbar.ts:29, :38, :47, :60, :69` majú v `titleT` pevné texty
  („Bold", „Italic", „Underline", „Link", „Remove link"). Cesta: `src/domains/coreDam/shared/components/anzutap/components/`.

