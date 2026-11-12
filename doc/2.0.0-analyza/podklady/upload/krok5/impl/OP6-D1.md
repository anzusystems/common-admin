# OP6-D1: stránka zoznamu assetov, FE-62, FE-59, FE-60, FE-61, FE-70 a tri cesty zahodenia neuložených metadát (impl-dam-op6a)

Zadanie vedúceho z 13. 10. (`scratchpad/zadanie-OP6-D1.md`; rozhodnutie vlastníka „opravime vsetko"); nálezy
`overenie-nalezov.md`, „Doplnok k šiestemu overeniu", „Siedme overenie" (FE-70) a „Ôsme overenie". Strom
`/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `0ad8e12c`, čistý. TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op6a`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu, knižnica
ani texty sa nemenili.

Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `ACT` = `A/components/list/composables/assetListActions.ts`.
Čísla riadkov v častiach kroku platia pre strom po kroku, pred cyklom c1; cyklus posunul `ACT` o 3 riadky od `:137`
a `A/components/list/AssetListView.vue` o 11 riadkov od `:83`, sklad `A/store/assetListStore.ts` prečísloval celý.
Časť „Cyklus c1" uvádza svoje čísla. **Čo platí po cykle c1 inak než v častiach kroku, je pri P3 a FE-61 označené
a celé v časti „Cyklus c1".**

## Podkroky

1. **Snímok `OP6-D1`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam OP6-D1 doc/changelog/3.0.0.md`, hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP6-D1`; `vitest.k3-bend.config.mts`, oba skopírované z TMPDIR `impl-dam-op5b`; skripty
   `scratchpad/op6d1-bend-run.sh`, `op6d1-bends.py`; výsledky `scratchpad/op6d1-final.txt`, `op6d1-final2.txt`
   a `op6d1-final3.txt`, platí posledný beh každého ohnutia). Dvanásť súborov testov (celý `src/test/list`
   a `src/test/queue/queueRowActions.test.ts`), 251 prípadov; na kóde zo snímku **42 červených**, 209 zelených.
   Po rozhodnutí vedúceho k FE-61 (nižšie) pribudol jeden prípad a dva sa zmenili; dvanásť ohnutí, ktorých riadkov
   alebo prípadov sa to týka, bežalo znova nad 251 prípadmi, ostatných 32 naposledy nad 250.
3. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`, skript `scratchpad/op6d1-lint.sh`) 0.
4. **CK-DAM OP6-D1** (`krok5-praca/vysledky/OP6-D1-ck.log`) zelené: 88 súborov / 1 584 testov (CK OP5-D2-c2
   86 / 1 533, +2 súbory, +51 testov), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
   Prvý beh CK bol červený na `format:check` (jeden nový súbor testov upravený po `oxfmt`); naformátované a CK
   zopakovaná celá; po rozhodnutí k FE-61 zopakovaná ešte raz, zelená.
5. **Záplata** `zaplata.sh OP6-D1`: `krok5-praca/zaplaty/OP6-D1.diff` (2 318 riadkov, 16 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku. `src/typed-router.d.ts` v nej nie je.

## FE-62 (nález 157): tlačidlo „upraviť" riadka tabuľky

**Čo sa mení v kóde.**
- `A/components/list/components/AssetTableRowItem.vue:56-62`, `followDetailLink(event)`: pri obyčajnom kliku (bez
  Meta, Alt, Ctrl, Shift, hlavné tlačidlo myši: podmienky routera, ako od OP5-D1-c1) sa vráti a neurobí nič; inak
  volá `showDetail()` riadka. Typ udalosti `showDetail` už nemá `leavesList` (`:34`).
- `ACT:272-273`, `showDetail`: preč je parameter `leavesList` aj jeho vetva a komentár; pýta sa ako ceruzka dlaždice.

**Čo sa mení pre používateľa.** Obyčajný klik na „upraviť" riadka tabuľky len prejde na stránku detailu
`/assets/<id>`: zoznam neotvorí svoj detail, nič nečíta, nemení aktívny riadok ani panel. Klik s Ctrl, Cmd, Shift
alebo Alt otvorí detail nad zoznamom ako doteraz (a s neuloženými metadátami sa pýta ako doteraz). S neuloženými
metadátami sa obyčajný klik pýta strážou odchodu (P3). **Na backend:** neodíde čítanie assetu zoznamom (stránka
detailu si asset číta sama, raz).

**Testy** (`src/test/list/sidebarUnsaved.test.ts`, blok tabuľky):
- nový prípad: obyčajný klik, kým je stránka detailu ešte na ceste (navigácia v teste podržaná): aktívny riadok
  žiadny, detail zoznamu zatvorený, adresa zoznamu, žiadne čítanie, panel „No asset selected"; po dokončení router
  na `/assets/asset-3` a stále žiadne čítanie;
- prepísaný prípad (menuje ho zadanie): „do not ask for a plain click…" tvrdil `[0, 1, 1]` (čítanie navyše) a žiadnu
  otázku; teraz „ask for a plain click on the edit button of a row, a link that leaves the list": otázka, „Stay"
  nechá stránku, pole s napísaným a zvýraznené „Save", „Leave anyway" prejde na `/assets/asset-3`, čítania `[0, 1, 0]`;
- päť prípadov klikov s klávesom (OP5-D1-c1) bez zmeny tvrdení, len router je po novom pripojení stránky na
  `/assets` namiesto `/` (pozri „Pripojenie stránky v testoch").

| Ohnutie | Červené |
|---|---|
| obyčajný klik otvorí aj detail zoznamu (ako doteraz) | 2 (oba prípady obyčajného kliku) |
| klik s klávesom neurobí v zozname nič | 5 (Ctrl, Cmd, Shift, Alt, iné tlačidlo) |

## FE-59 (nález 152): detail nad prázdnym alebo načítavaným zoznamom

**Čo sa mení v kóde.**
- `A/components/list/AssetListView.vue:160-165`: jediná inštancia `AssetDetailDialog` je mimo reťaze vetiev zoznamu
  (`loader.hard` / `items.length` / „žiadne riadky"), hneď pred `AUnsavedConfirmDialog` stránky.
- `AssetListView.vue:39-41`: `assetDetailStore.reset()` v `setup` stránky, teda pred prvým vykreslením. Z
  `listMounted` (`ACT:533-539`) ten istý riadok vypadol: je to jedno miesto, len skôr.

**Rozhodnutia.**
1. **Prvé vykreslenie.** Dialóg je teraz pripojený od začiatku, a sklad detailu prežíva stránky. Dva prípady zo
   zadania: (a) zoznam opustený s otvoreným detailom rieši vyprázdnenie skladu pri odchode zo zoznamu („Jedna
   podmienka" nižšie); (b) samostatná stránka detailu opustená tlačidlom Späť prehliadača nechá v sklade
   `detail = true` s assetom a sama po sebe neupratuje, preto zoznam sklad vyprázdni synchronne v `setup`.
   `listMounted` beží až po prvom vykreslení: s vyprázdnením až tam by sa dialóg nakreslil a hneď zatvoril
   (ohnutie `59-emptied-once-mounted` to ukazuje).
2. Vonkajší `div` vetvy `items.length` som nechal, ako bol (jeden vnorený `div`), bez prestavby šablóny.

**Čo sa mení pre používateľa.**
- Nad zoznamom bez riadkov („Žiadne nájdené assety": nová licencia, hľadanie alebo filter bez výsledku) sa detail
  otvorí: „Upraviť" riadka fronty uploadu, „Vytvoriť prázdny asset", „Upraviť" panela. Doteraz sa neotvorilo nič
  a detail vyskočil sám neskôr, keď zoznam dostal riadky.
- Otvorený detail nezmizne, kým sa zoznam číta znova (uloženie fronty uploadu ho číta po svojej odpovedi), a nie je
  po ňom nakreslený nanovo. Vedľajší dôsledok: čo si komponent dialógu drží sám (zapnutý / vypnutý panel „i"
  detailu) teraz prežije nové načítanie zoznamu; doteraz sa po ňom vrátilo na predvolené.
- Vstup na stránku zoznamu nenakreslí detail zo stavu inej stránky.
- **Na backend:** nič.

**Medze.** Ktorý dialóg je nad ktorým (detail nad frontou na celú obrazovku, otázka nad detailom) som v prehliadači
nevidel; Vuetify dáva neskôr otvorený overlay vyššie.

**Testy** (`src/test/list/detailNotOfList.test.ts`, bloky „the detail of an asset while the list draws no rows"
a „…on the way into the page of the list"):
- zoznam bez riadkov: detail sa otvorí pre riadok fronty aj pre práve vytvorený asset (2), cez „Edit more" panela po
  zavretom detaile vytvoreného assetu (1) a po zozname načítanom znova bez riadkov, keď panel drží asset vybraný
  predtým (1);
- otvorený detail, do ktorého sa písalo; zoznam sa číta znova a odpoveď sa drží: riadky sú preč, detail je ten istý
  (to isté pole pripojené s napísaným, lišta „2 / 3 asset-2"); po odpovedi to isté (1);
- strážca prvého vykreslenia (1): skutočná samostatná stránka detailu `AssetDetailView` na trase `/assets/<uuid>`
  prečíta asset (sklad: `detail = true`, asset), `router.back()` vráti na zoznam; `MutationObserver` nad `body`
  nezachytí žiadny prvok `.dam-image-detail-dialog`, panel hovorí „No asset selected"; potom ceruzka dlaždice detail
  otvorí a pozorovateľ ho vidí (kontrola, že pozorovateľ vidí). Zelený aj na snímku (tam bol dialóg vo vetve riadkov),
  červený pri ohnutí.

| Ohnutie | Červené |
|---|---|
| dialóg detailu späť vo vetve riadkov | 5 (štyri prípady zoznamu bez riadkov, detail počas čítania zoznamu) |
| sklad sa vyprázdni až po pripojení stránky | 1 (strážca prvého vykreslenia) |

## FE-60 (nález 151): šípky pod frontou na celú obrazovku

**Overenie príznaku `customDialog`.** `domains/system/composables/useMainWrapper.ts:4` je modulový `ref`;
`domains/system/components/MainWrapper.vue:134-136` kreslí dialóg na celú obrazovku práve cez `v-if="customDialog"`.
Príznak je teda pravdivý **presne vtedy, keď je ten dialóg nakreslený**, z definície. Zapínajú ho len
`setFullUpload` (`A/composables/assetFooterUpload.ts:56`), `setFullSelected` (`assetFooterSelected.ts:75`) a obdoba
stránky poskytovateľa (`externalProviderAssetFooterSelected.ts:78`); vypína každé schovanie, zmenšenie a zbalenie
v štyroch composables (`assetFooterUpload.ts:36,46,66`, `assetFooterSelected.ts:55,65,85`,
`assetFooterUploadSlots.ts:31,40,49`, `externalProviderAssetFooterSelected.ts:58,68,88`). Použil som ho.

**Čo sa mení v kóde.** `ACT:41` (`customDialog` z `useMainWrapper`), `:556-559` `listIsUnderQueue()`, `:567`
a `:573`: `onArrowRight` aj `onArrowLeft` sa pri ňom vrátia, na riadku stráží FE-43 a FE-48. Miest, ktoré klávesy
zapínajú (`A/components/detail/components/AssetDetailDialog.vue:53`, `A/components/queue/AssetQueueItemEditable.vue:99`),
som sa nedotkol; `queueRowActions.test.ts` ďalej drží, že zlyhané čítanie riadka klávesy zapne.

**Čo sa mení pre používateľa.** Kým je cez zoznam nakreslená fronta uploadu alebo hromadná úprava na celú
obrazovku, ← a → v zozname nerobia nič, ani po zavretí detailu jej riadka a ani po zlyhanom čítaní riadka. Po
schovaní fronty chodia po zozname ako doteraz. Platí aj po návrate na zoznam s frontou, ktorá ostala otvorená
(príznak prežíva stránky; `listMounted` klávesy zapína vždy). **Na backend:** neodíde čítanie suseda.

**Testy** (`detailNotOfList.test.ts`, blok „the arrow keys of the list under a queue drawn over the whole page"):
- fronta uploadu: ceruzka riadka, zavretie detailu, fronta stále nakreslená: ← a → nič nečítajú, aktívna dlaždica
  ostáva, panel drží asset riadka; po schovaní fronty → vyberie suseda (1);
- zlyhané čítanie riadka (500): hláška, detail zatvorený, fronta nakreslená: šípky nič; po schovaní chodia (1);
- hromadná úprava: Ctrl klik, „Edit", ceruzka riadka, zavretie: šípky nič; po schovaní chodia (1);
- strážca: s frontou len v malom páse pod zoznamom šípky chodia (1).

| Ohnutie | Červené |
|---|---|
| šípky pod frontou nie sú držané | 3 |
| šípky sú držané vždy | 52 (všetky prípady so šípkou, medzi nimi strážca) |

## FE-61 (nález 156): aktívna dlaždica po novom načítaní zoznamu

**Čo sa mení v kóde** (`A/store/assetListStore.ts`):
- `:17-20` `activeAssetId`: id assetu aktívnej dlaždice, súkromná premenná skladu (ako `detailRequests` v sklade
  detailu; nikto ju nekreslí). Zapisuje ju `setActiveByIndex` (`:113`), jediné miesto, ktoré dlaždicu aktivuje.
- `:35-39` `restoreActive()`: len keď nie je aktívna žiadna dlaždica a je čo hľadať: nájde asset v zozname a aktivuje
  ho cez `setActiveByIndex`; nenájdený asset (`-1`) odmietne `setActiveByIndex` sám.
- `setList` (`:74-76`): po postavení riadkov index zruší a volá `restoreActive()`. Tým odpadá prekážka zo zadania
  (`setActiveByIndex` sa pri rovnakom indexe vráti): index je v tej chvíli vždy `null`.
- `appendList` (`:56-57`): po pripojení strany volá `restoreActive()`; s aktívnou dlaždicou nerobí nič.
- `resetList` (`:161-164`) ruší index a zapamätané id necháva; `reset` (`:169-172`) ruší oboje.
- `ACT:533-539`, `listMounted`: namiesto `assetListStore.resetList()` volá `assetListStore.reset()`.

**Rozhodnutia.**
1. **„Zrušiť filter" je ďalšie načítanie zoznamu, vstup na stránku je nový začiatok** (rozhodnutie vedúceho počas
   práce, proti doslovnému zneniu zadania, ktoré som mal hotové najprv). `resetList` nie je len „vstup na stránku":
   volá ho aj tlačidlo „Zrušiť filter" (`A/components/list/components/AssetListSidebarFilter.vue:29` → `ACT:178-181`
   `resetAssetList`). Preto `resetList` ruší len index (zoznam je v tej chvíli prázdny) a id necháva pre zoznam,
   ktorý sa číta potom; zapamätané id ruší vstup na stránku.
   **Overenie `reset()` v `listMounted`** (podmienka vedúceho): `assetListStore.reset()` robí to isté čo
   `resetList()` (`list = []`, `loader.soft = false`, `loader.hard = true`, index) a navyše len dve veci: ruší
   zapamätané id (to sa chce) a dáva `keyboardNavigation = false`. Výber, filter, stránkovanie ani pohľad v tomto
   sklade nie sú. Príznak kláves čítajú len `onArrowRight` / `onArrowLeft` (`ACT:566,572`) a `listMounted` ho po
   prvom načítaní zapína vždy (`:538`). Pred ním môže byť zapnutý (zavretie samostatnej stránky detailu,
   `A/components/detail/AssetDetailView.vue:64`; schovanie fronty uploadu na inej stránke); zoznam je však počas
   prvého načítania prázdny, šípka v ňom nemá suseda a nerobí nič tak či tak. Rozdiel teda nie je vidieť, a preto
   `reset()` namiesto novej funkcie skladu.
2. Hľadá sa v celom zozname, nie len v pripojených riadkoch: s neaktívnou dlaždicou to vyjde narovnako (v starších
   riadkoch asset nie je, inak by bol aktívny) a kód je kratší.

**Čo sa mení pre používateľa.**
- Po filtri, „Zrušiť filter", hľadaní, zoradení a „Znovu načítať zoznam" je zvýraznená dlaždica toho istého assetu na jeho novom
  mieste; šípky idú od nej, Shift + klik berie ako kotvu ju, „Upraviť" panela otvorí detail zoznamu s tlačidlami,
  počítadlom „k / n" a názvom (padá medza FE-50 / nález 8 z OP5-D2). Panel sa pri tom nečíta.
- Asset v novom zozname nie je: žiadna dlaždica nie je aktívna; klik na ktorúkoľvek ju zvýrazní (doteraz klik na
  dlaždicu na starom mieste nie). Keď asset príde v ďalšej strane pri rolovaní, zvýrazní sa tam.
- Odchod zo stránky a návrat: žiadna aktívna dlaždica (doteraz starý index prežil a klik na to miesto nezvýraznil).
- **„Zrušiť filter"** sa správa ako ostatné nové načítania: dlaždica assetu je zvýraznená na jeho mieste, „Upraviť"
  panela otvorí detail zoznamu.
- **Bez aktívnej dlaždice sa šípky správajú ako doteraz v tom stave** (nemenil som, zadanie to chce vymenovať):
  → vyberie druhú dlaždicu zoznamu (počíta sa od miesta 0), ← nerobí nič. Ten stav je po kroku dosiahnuteľný
  častejšie (po novom načítaní bez assetu; doteraz ostal starý index).
- Otvorený detail zo zoznamu, ktorého asset v novom zozname nie je: lišta je bez počítadla, „predchádzajúci" je
  vypnutý, „nasledujúci" vedie na druhú dlaždicu (ten istý stav bez aktívnej dlaždice). Doteraz ukazoval poradie
  a susedov cudzej dlaždice.
- **Na backend:** nič.

**Od cyklu c1** (bod 3): asset, ktorý zoznam neprišiel a nemá teda dlaždicu, sa čaká len dovtedy, kým ho panel
ešte ukazuje. Keď panel medzitým vzal iný asset alebo o svoj prišiel, neskorší zoznam ani ďalšia strana jeho
dlaždicu nezvýraznia. Dlaždica, ktorá aktívna je, ide za svojím assetom ďalej bez ohľadu na panel.

**Medze.** Asset uvedený v zozname dvakrát sa po novom načítaní zvýrazní na svojom prvom mieste.

**Testy.** Nový `src/test/list/activeTile.test.ts` (10 prípadov; skutočná stránka; falošný je server, `fetch` verzie
a `IntersectionObserver`, cez ktorý prehliadač hovorí stránke, že koniec zoznamu prišiel do pohľadu: značka zoznamu
`v-intersect` sa nájde medzi sledovanými prvkami a zavolá sa jej obsluha; strana sa pozná podľa `offset` v adrese
požiadavky):
- dve dlaždice vybrané po sebe, zoznam načítaný v inom poradí: aktívna je dlaždica naposledy vybraného assetu na
  novom mieste, panel ho drží a nič sa nečítalo; ← ide na jej nového suseda, → na konci nikam;
- asset v zozname nie je: žiadna aktívna; klik na dlaždicu na starom mieste ju zvýrazní;
- to isté a šípka: → vyberie druhú dlaždicu (ako v zozname, kde sa nič nevybralo: prvá polovica prípadu to drží na
  čerstvej stránke);
- ďalšia strana: po prvej strane bez assetu žiadna aktívna, po dorolovaní je aktívna dlaždica assetu v pripojených
  riadkoch, panel bez čítania, ← ide na jej suseda;
- dlaždica vybraná medzitým ostáva aktívna aj po ďalšej strane, a to aj keď zoznam drží jej asset dvakrát (strážca);
- Shift + klik berie rozsah od dlaždice na novom mieste;
- „Zrušiť filter" so zoznamom v inom poradí: aktívna je dlaždica assetu na novom mieste, panel ho drží bez čítania,
  „Edit more" panela otvorí detail zoznamu „3 / 3 asset-2" a ← v ňom prejde na „2 / 3 asset-1" (1); „Zrušiť filter"
  a asset v zozname nie je: žiadna aktívna (1; strážca);
- odchod a návrat (router): žiadna aktívna, panel prázdny, klik na staré miesto zvýrazní; ← nič, → druhá dlaždica.

**Prepísané prípady** (držali dnešný príznak, menuje ich zadanie):
- `sidebarUnsaved.test.ts`, „lets %s go nowhere when its asset is in the list no more" (2 prípady `it.each`):
  zoznam načítaný pod otázkou bez kliknutého assetu; tvrdili `active = [false, false]` (zvýraznenie stratené).
  Teraz `[false, true]`: dlaždica assetu, do ktorého sa písalo, ostáva aktívna na svojom mieste; ostatné tvrdenia
  bez zmeny.
- `detailNotOfList.test.ts`, pôvodne „opens a detail that is not of the list while the tile at the active place is
  of another asset": teraz „opens a detail of the list at the place the asset of the active tile has in a list read
  anew": aktívna `[false, false, true]`, lišta „3 / 3 asset-2", „predchádzajúci" zapnutý, „nasledujúci" vypnutý,
  ← prejde na „2 / 3 asset-3". Aby pravidlo FE-50 „cudzí asset → detail mimo zoznamu" nestratilo test, pribudol
  prípad „…while the list read anew holds its asset no more" (žiadna aktívna, detail bez lišty, šípka nič nečíta).
- `detailRequests.test.ts`, „stepping to the next asset does nothing when the list it was stepping through is gone"
  (zadanie ho nemenuje): pribudlo tvrdenie, že po `resetList()` je index aktívnej dlaždice `null`; pôvodné dve
  tvrdenia ostali. Je to jediné miesto, kde je zrušenie indexu v `resetList` vidieť (prípad volá sklad priamo).

| Ohnutie | Červené |
|---|---|
| `setList` nechá miesto aktívnej dlaždice (ako doteraz) | 9 |
| `setList` asset nehľadá | 8 |
| ďalšia strana sa neprehľadá | 1 |
| zapamätaný asset preberie aktívnu dlaždicu vybranej medzitým | 1 (strážca s assetom uvedeným dvakrát) |
| zapamätané id sa neskorším výberom nemení | 1 |
| asset, ktorý v zozname nie je, nechá aktívnu prvú dlaždicu | 5 |
| `resetList` zabudne aj asset (doslovné znenie zadania) | 1 („Zrušiť filter") |
| `resetList` nechá index | 1 (`detailRequests`, sklad po `resetList()`) |
| vstup na stránku asset nezabudne (`listMounted` volá `resetList`) | 2 (dva návraty na stránku) |

## P1: ceruzka riadka fronty

**Čo sa mení v kóde.** `A/components/queue/AssetQueueItemEditable.vue:74-83`, `showDetail`: id assetu riadka sa vezme
do lokálnej konštanty; keď `panelHoldsUnsavedMetadata`, prvý krok je `askToLeaveUnsaved()` skladu (pred `setView`,
vypnutím kláves, loaderom, `showDetail` aj požiadavkou); po odpovedi „odísť" sa ešte overí, že riadok drží ten istý
asset. Číta sa asset, na ktorý sa pýtalo (`:91`). Pomocníkov `ACT` nepoužíva.

**Čo sa mení pre používateľa.** „Upraviť" riadka fronty uploadu aj hromadnej úpravy sa s neuloženými metadátami
panela najprv opýta, aj keď je to asset, ktorý panel sám drží (táto cesta číta vždy). „Zostať": nič sa nezmení
a nič neodíde, fronta ostáva nakreslená. „Odísť aj tak": detail riadka sa otvorí ako doteraz. Otázku kreslí stránka
zoznamu (dialóg je mimo fronty). **Na backend:** pri „Zostať" neodíde čítanie.

**Medze.** Otázka nad frontou na celú obrazovku: v prehliadači nevidené. Riadok, ktorý medzi otázkou a odpoveďou
z fronty zmizol celý (nie len zmenil asset), sa po „Odísť aj tak" prečíta a otvorí; pod modálnou otázkou ho
používateľ odstrániť nevie.

**Testy** (nový `src/test/list/sidebarUnsavedLeave.test.ts`, 23 prípadov spolu s P2, P3 a podmienkou; skutočná
stránka zoznamu pod `RouterView`, s frontou uploadu, hromadnou úpravou, menu stránky, dialógom licencie a so
stránkou zoznamu poskytovateľa na vlastnej trase):
- fronta uploadu a hromadná úprava (`it.each`, 2): po stlačení otázka, žiadna požiadavka, detail zatvorený, to isté
  pole s napísaným a zvýraznené „Save"; „Stay" to isté a fronta nakreslená; ďalší pokus sa pýta; „Leave anyway"
  otvorí detail assetu riadka, jedno čítanie, žiadny `PATCH`;
- asset riadka je asset panela (po zavretom detaile riadka sa píše do panela): otázka, po „Leave anyway" druhé
  čítanie a hodnota zo servera (1);
- riadok dostane pod otázkou iný asset: „Leave anyway" nič nečíta a neotvorí, napísané ostáva (1);
- strážca: bez napísaného sa nepýta (1).

| Ohnutie | Červené |
|---|---|
| ceruzka riadka sa nepýta | 4 |
| „Zostať" ide ďalej | 3 |
| riadok sa po odpovedi neoverí | 1 |
| na asset, ktorý panel drží, sa nepýta | 1 |
| pýta sa vždy, keď panel niečo drží | 9 (strážca a osem ďalších prípadov, v ktorých sa stláča ceruzka riadka pri vybranom assete) |

## P2: „Vytvoriť prázdny asset"

**Čo sa mení v kóde.** `A/components/AssetCreateButton.vue:62-65`, `onConfirm`: keď `panelHoldsUnsavedMetadata`,
prvý krok je `askToLeaveUnsaved()`; pri „zostať" návrat pred `buttonLoading` aj pred `POST`. `onClick` (položka menu)
sa nepýta.

**Čo sa mení pre používateľa.** Otázka príde po „Vytvoriť" v dialógu, pred vytvorením assetu. „Zostať": nič
neodíde, dialóg ostáva otvorený s vybraným typom. „Odísť aj tak": asset sa vytvorí a jeho detail otvorí ako doteraz.
**Na backend:** pri „Zostať" neodíde `POST`.

**Testy** (`sidebarUnsavedLeave.test.ts`): otvorenie dialógu sa nepýta; po potvrdení otázka, žiadny `POST`, ten istý
dialóg pripojený; „Stay" to isté; „Leave anyway" jeden `POST`, detail nového assetu, hláška „Record was created" (1);
strážca bez napísaného (1).

| Ohnutie | Červené |
|---|---|
| vytvorenie sa nepýta | 1 |
| pýta sa už pri položke menu | 1 |
| „Zostať" ide ďalej | 1 |
| pýta sa vždy, keď panel niečo drží | 4 (strážca a tri staršie prípady s vytvoreným assetom) |

## P3: odchod zo stránky

**Od cyklu c1 sa otázka nekladie v stráži odchodu stránky (`onBeforeRouteLeave`), ale v `router.beforeResolve`**
(rozhodnutie vedúceho; pozri „Cyklus c1", bod 1). Čo sa pýta a čo odpovede robia, ostáva; mení sa poradie voči
strážam Vuetify, a tým tlačidlo Späť nad otvoreným dialógom alebo menu. Odseky nižšie o stráži odchodu a medza
„Späť prehliadača pri otvorenom detaile" opisujú stav kroku a po cykle neplatia.

**Čo sa mení v kóde.**
- `A/components/list/AssetListView.vue:77-82`: `holdsUnsavedMetadata()` = `showsUnsavedMetadata ||
  panelHoldsUnsavedMetadata` skladu (detail otvorený alebo zatvorený, nie pod loaderom); `onBeforeRouteLeave`: bez
  neuložených pustí, inak vráti odpoveď `askToLeaveUnsaved()`. Knižničný `useUnsavedChangesGuard` nepoužíva.
- `:84-90`: `useEventListener(window, 'beforeunload', …)` z `@vueuse/core` (registruje sa so stránkou a odoberá sa
  s ňou): pri neuložených `preventDefault()` a `returnValue = ''` (ako knižnica; staršie prehliadače sa pýtajú len
  podľa neho).
- `A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:138-145`: po validácii, pred `fetchAssetLicence`
  a `updateCurrentUser`, sa pri `panelHoldsUnsavedMetadata` opýta; „zostať" skončí bez požiadavky a dialóg ostáva.
  `:150-151`: po úspešnej zmene, tesne pred `window.location.reload()`, sa sklad detailu vyprázdni, ak sa pýtalo.

**Rozhodnutia.**
1. **Stráž po „Odísť aj tak" sklad nevyprázdňuje** (to urobí až odchod stránky, „Jedna podmienka"). Keď navigácia
   potom neprejde (nenačíta sa kód cieľovej stránky, zruší ju iná stráž), používateľ ostane na zozname aj s napísaným.
2. **Licencia: pýta sa až po validácii a pred prvou požiadavkou**, aby „Zostať" naozaj nič neposlalo (ani čítanie
   licencie). Vyprázdnenie skladu pred reloadom je až po úspechu: pri odmietnutej zmene ostáva napísané aj so
   zvýrazneným „Uložiť" (drží to prípad). `reset()` som zvolil pred samostatným „odznačením": stránka sa hneď
   načítava znova a odpoveď „Odísť aj tak" znamená, že to, čo panel drží, je preč.
3. **Adresy detailu.** `browserHistoryReplaceUrlByRouter` je `history.replaceState`, router o nich nevie, stráž sa
   nespustí. Drží to prípad a ohnutie, ktoré adresu pošle cez `router.push`.

**Čo sa mení pre používateľa.**
- S neuloženými metadátami (v paneli pri zozname alebo v otvorenom detaile) sa pred odchodom zo stránky opýta
  „Máte neuložené zmeny. Naozaj chcete odísť?": odkazy menu stránky (Podcasty, Video relácie, Nastavenia), obyčajný
  klik na „upraviť" riadka tabuľky, tlačidlo Späť prehliadača. „Zostať" navigáciu zruší a nič sa nezmení; „Odísť aj
  tak" odíde. Logo vedie na tú istú stránku, nepýta sa. („Zobraziť originál" duplikátu vo fronte som tu v kroku
  uvádzal omylom: je to odkaz s `target="_blank"`, `A/components/AssetLink.vue:21-25`, otvorí novú kartu a nepýta
  sa nikdy; opravené v cykle c2.)
- Obnovenie stránky a zavretie karty alebo okna: pýta sa prehliadač vlastnou otázkou.
- Zmena licencie: otázka po „Potvrdiť a znovu načítať ADAM", pred odoslaním. „Zostať": nič neodíde, dialóg ostáva
  s vybranou licenciou. „Odísť aj tak": licencia sa zmení a stránka sa načíta znova bez druhej otázky prehliadača.
- **Na backend:** pri „Zostať" neodíde nič (ani `GET` licencie, ani `PATCH` používateľa).

**Medze, ktoré prijímam.**
- **Späť prehliadača pri otvorenom detaile** (stav kroku, cyklom c1 zrušené). Stráž odchodu stránky beží pred
  strážami Vuetify, takže sa s neuloženými metadátami pýtala aj tam, kde Vuetify navigáciu z tlačidla Späť ruší.
  V kroku som k tomu napísal, že Späť nad otvoreným detailom ho dnes „len zavrie": **to nebola pravda**. Knižnica
  robí každý `VDialog` perzistentným (`common-admin/dist/plugins/commonVuetifyConfig.js:56-60`), Vuetify teda pri
  Späť nad otvoreným dialógom navigáciu zruší a dialóg nechá, ako je; zavrie len menu. Platí časť „Cyklus c1".
- **Späť stlačené dvakrát pod otvorenou otázkou**: druhá navigácia dostane „zostať" (jedna otázka naraz), router
  tým prvú zruší; po odpovedi môže v riadku adresy ostať adresa predošlej stránky, hoci je nakreslený zoznam. Je to
  vlastnosť asynchrónnych stráží odchodu vo vue-router, rovnakú má stráž knižnice.
- **Nová verzia aplikácie**: keď po „Odísť aj tak" stráž `beforeEachRoute` stránku načíta znova pre novú verziu
  (`router/beforeEachRoute.ts:36`), prehliadač sa opýta ešte raz (stránka napísané stále drží).
- Samostatné stránky detailu (`/assets/<id>`, detail súboru) stráž nemajú (FE-69, iný krok).
- Text a tlačidlá otázky prehliadača sú jeho vlastné; testom viem tvrdiť len to, čo sa prehliadaču povie.

**Testy** (`sidebarUnsavedLeave.test.ts`):
- tri cesty von (`it.each`): odkaz menu stránky (skutočný klik na „Settings"), odkaz aplikácie (na stránku
  poskytovateľa), Späť (`router.back()`): otázka s textom knižnice, router na `/assets`, stránka nakreslená, žiadna
  požiadavka; „Stay": to isté, to isté pole s napísaným; tá istá cesta sa pýta znova (pri Späť to dokazuje aj
  vrátenú pozíciu histórie); „Leave anyway": router na cieli, stránka preč, žiadny `PATCH` (3);
- strážca: bez napísaného a po uložení panelom sa nepýta (1);
- otvorený detail s napísaným: Späť otvorí otázku detailu (dva dialógy), „Stay" nechá detail s napísaným, „Leave
  anyway" odíde (1);
- adresa detailu nie je odchod: „Edit more" nad napísaným zmení adresu okna na `/assets/asset-2` bez otázky a router
  ostáva na `/assets`; zavretie vráti adresu bez otázky, napísané ostáva (1; strážca);
- pod otvorenou otázkou (klik na inú dlaždicu) cesta von ostane a odpoveď patrí kliku (1);
- `beforeunload`: prázdna stránka a vybraný asset bez písania nie, napísané v paneli áno, s detailom otvoreným nad
  ním áno (1); po uložení nie (1; strážca); po odchode zo stránky nie, ani keď sa sklad potom umelo označí ako
  neuložený (obsluha je odobratá) (1);
- licencia: po potvrdení otázka, žiadny `GET` licencie ani `PATCH`, žiadny reload, dialóg pripojený; „Stay" to isté
  a vybraná licencia v dialógu; „Leave anyway": `GET` aj `PATCH` (`selectedLicence: 2`) raz, hláška, `reload` raz
  a `beforeunload` vyvolaný vo chvíli reloadu nie je zastavený (1); server zmenu odmietne po „Leave anyway": hláška,
  žiadny reload, dialóg ostáva, napísané ostáva a okno sa ďalej pýta (1); strážca bez napísaného (1). `reload` okna
  je v teste zachytený (`vi.spyOn(window.location, 'reload')`).

Prepísaný prípad `sidebarUnsaved.test.ts` (menuje ho zadanie): obyčajný klik na „upraviť" riadka tabuľky sa po kroku
pýta (pozri FE-62).

| Ohnutie | Červené |
|---|---|
| stránka nemá stráž odchodu | 10 |
| stráž sa pozerá len na panel, nie na otvorený detail | 2 |
| stráž sa pýta vždy | 8 (každý prípad, ktorý zo stránky odchádza bez napísaného) |
| „Zostať" odíde | 6 |
| adresa detailu je navigácia routera | 9 |
| prehliadaču sa pred odchodom okna nič nepovie | 2 |
| prehliadaču sa povie vždy | 3 |
| obsluha `beforeunload` ostane po stránke | 2 |
| zmena licencie sa nepýta | 2 |
| „Zostať" pri licencii ide ďalej | 1 |
| reload po zmene licencie vyvolá otázku prehliadača | 1 |
| napísané sa zahodí už pri odpovedi, pred zmenou | 1 |
| pri licencii sa pýta vždy, keď panel niečo drží | 1 (strážca) |

## Jedna podmienka pre P1, P2 a P3.3: mimo zoznamu DAM sa nepýta

**Čo sa mení v kóde.** `ACT:541-548`, `listUnmounted`: namiesto `abandonDetailRequests()` a `answerLeaveUnsaved(false)`
volá `assetDetailStore.reset()`, ktorý robí oboje a sklad vyprázdni. Spolu so strážou odchodu: zoznam s neuloženými
metadátami sa dá opustiť len cez „Odísť aj tak", a sklad sa pri odpojení stránky vyprázdni, takže
`panelHoldsUnsavedMetadata` mimo zoznamu DAM neplatí.

**Čo sa mení pre používateľa.** Na stránke zoznamu externého poskytovateľa (má frontu uploadu, „Vytvoriť prázdny
asset" aj dialóg licencie, ale otázku nemá kto nakresliť) sa nič nepýta a nič nečaká na odpoveď. Návrat na zoznam
DAM je ako doteraz (prázdny panel).

**Testy** (`sidebarUnsavedLeave.test.ts`, blok stránky poskytovateľa; cesta: písanie, odkaz na stránku poskytovateľa,
„Leave anyway"): „Vytvoriť prázdny asset" pošle `POST` hneď (1), ceruzka riadka fronty číta hneď (1), zmena licencie
prejde a načíta znova hneď (1); nikde žiadna otázka. Na snímku sú červené už pri odchode (otázka tam nie je);
podmienku samu ukazuje ohnutie.

Prepísané tvrdenie (zadanie ho nemenuje; vedúci ho prijal): `src/test/list/detailRequests.test.ts`, „says nothing
when the list it belonged to is gone" tvrdilo po `listUnmounted()` `detail === true`, teda presne to, čo podmienka
mení: zoznam nechal sklad detailu, ako bol. Teraz `false` (zoznam berie svoj detail so sebou) a k tomu, že sa
chyba neukázala; tvrdenie o adrese ostalo.

| Ohnutie | Červené |
|---|---|
| zoznam pri odchode nechá sklad detailu, ako bol | 5 (tri prípady stránky poskytovateľa, `beforeunload` po odchode, `detailRequests`) |

## FE-70 (nález 171): zlyhané čítanie po šípke so zatvoreným detailom

**Čo sa mení v kóde.** `ACT:476-486` (`nextItem`) a `:517-527` (`prevItem`): po `reset()` sa pri `!onPage()` skončí;
adresa sa vracia len keď bol detail otvorený; `showErrorsDefault(error)` beží v oboch prípadoch. Stráž „len posledné
čítanie" ostáva prvým riadkom vetvy. Komentár o vrátení adresy (nález 181) je prepísaný.

**Čo sa mení pre používateľa.** Šípka v zozname so zatvoreným detailom na asset, ktorý sa nedá prečítať: tá istá
hláška ako po kliku na dlaždicu; panel hovorí „Žiadne vybrané assety" pri zvýraznenej dlaždici ako doteraz, adresa
zoznamu ostáva. S otvoreným detailom bez zmeny (hláška, detail zatvorený, adresa späť na zoznam). **Na backend:** nič.

**Testy** (`src/test/list/detailNeighbour.test.ts`, blok „the read of the neighbour that fails", 6 prípadov):
- → aj ← so zatvoreným detailom a zlyhaným čítaním (500): jedna hláška, panel „No asset selected", aktívna dlaždica
  tá, na ktorú šípka šla, adresa zoznamu (2);
- strážcovia: s otvoreným detailom hláška, detail zatvorený a adresa späť na zoznam, → aj ← (2); staršie čítanie,
  ktoré zlyhá po novšom, nič nepovie a panel drží novší asset (1); zlyhanie, keď je používateľ na ceste na inú
  stránku (navigácia podržaná, stránka ešte nakreslená), nič nepovie (1).

| Ohnutie | Červené |
|---|---|
| → so zatvoreným detailom mlčí (ako doteraz) | 1 |
| ← so zatvoreným detailom mlčí | 1 |
| → povie chybu aj na ceste na inú stránku | 1 |
| → adresu pri otvorenom detaile nevráti | 1 |
| ← adresu pri otvorenom detaile nevráti | 1 |
| → povie aj chybu staršieho čítania | 1 |

## Pripojenie stránky v testoch

Stráž odchodu existuje len pod `RouterView` (mimo neho vue-router hlási `VUE_ROUTER_R0020` a stráž neregistruje).
Päť súborov, ktoré stránku zoznamu pripájali priamo (`detailNeighbour`, `detailNotOfList`, `mainRouteChange`,
`sidebarUnsaved`, `externalProviderDetail`), ju preto pripája ako stránku trasy `/assets`: `router.addRoute` so
skutočným komponentom, `router.push('/assets')`, pripojený je `RouterView`. Zmena je v pomocníkovi `openList`
(`openLists`) každého z tých piatich súborov; **žiadny súbor `src/test/support` sa nemenil** (`uploadUi.ts` ani
`fakeDam.ts`). Prípady tvrdia to isté čo predtým a žiadne tvrdenie nie je oslabené; jediný rozdiel je v piatich
prípadoch `sidebarUnsaved`, kde router stojí na `/assets` namiesto `/` (adresa, na ktorej je stránka pripojená).
`sidebarUnsaved` si drží hostiteľa, ktorý vie stránku zložiť aj bez routera (prípad „odpojená stránka zodpovie
otázku"); `externalProviderDetail` má obe stránky ako trasy a prepína ich `router.push`.

Zistenie pri tom: `await router.push(…)` sa pod falošným časom nedokončí, kým je pripojený akýkoľvek overlay Vuetify
(stráž `useBackButton` čaká na `setTimeout`); navigácie v testoch sa preto spúšťajú bez čakania a čas sa posunie
(`void router.push(…); await settled()`), ako to robil pôvodný `externalProviderDetail`.

## Testy spolu

| Súbor | Prípady | Červené na snímku |
|---|---|---|
| `src/test/list/sidebarUnsavedLeave.test.ts` (nový) | 23 | 17 |
| `src/test/list/activeTile.test.ts` (nový) | 10 | 8 |
| `src/test/list/detailNotOfList.test.ts` | 13 → 24 | 9 |
| `src/test/list/detailNeighbour.test.ts` | 30 → 36 | 2 |
| `src/test/list/sidebarUnsaved.test.ts` | 40 → 41 | 4 |
| `src/test/list/detailRequests.test.ts` | 30 | 2 |
| `src/test/list/mainRouteChange.test.ts`, `externalProviderDetail.test.ts` (len pripojenie stránky) | 44, 2 | 0 |
| ostatné v behu (`assetMetaIconsTts`, `externalProviderList`, `massEditSelection`, `queueRowActions`) | 41 | 0 |
| spolu | 251 | 42 |

Nových prípadov je 51; na snímku je z nich červených 36. Červených je aj 6 zmenených starších prípadov (nižšie).
Zelených nových je 15, všetko strážcovia: prvé vykreslenie, detail mimo zoznamu po zozname bez assetu, šípky s frontou
v malom páse, štyri prípady FE-70 (otvorený detail ×2, staršie čítanie, cesta preč), dlaždica vybraná medzitým,
„Zrušiť filter" bez assetu v zozname, štyri „bez napísaného sa nepýta" (P1, P2, P3.1, P3.3), adresa detailu,
`beforeunload` po uložení. Každý z nich je červený aspoň pri jednom ohnutí. Ohnutí je 44, každé je červené.

**Existujúce prípady, ktoré som musel zmeniť** (žiadny nie je oslabený; držali stav, ktorý krok mení):
1. `sidebarUnsaved.test.ts`, obyčajný klik na „upraviť" riadka (FE-62 a P3, menuje ho zadanie): čítanie navyše preč,
   otázka je.
2. `sidebarUnsaved.test.ts`, „go nowhere when its asset is in the list no more", 2 prípady (FE-61, menuje ho zadanie).
3. `detailNotOfList.test.ts`, detail po zozname načítanom v inom poradí (FE-61, menuje ho zadanie).
4. `detailRequests.test.ts`, `detail` po `listUnmounted()` (jedna podmienka; zadanie ho nemenuje, oznámené vedúcemu
   správou počas práce a prijaté), a v tom istom súbore tvrdenie navyše o indexe po `resetList()` (FE-61).
5. `sidebarUnsaved.test.ts`, päť prípadov klikov s klávesom: adresa routera `/` → `/assets` (pripojenie stránky; na
   snímku zelené).
6. Pripojenie stránky v piatich súboroch (vyššie); `detailNotOfList.readAnew` posúva čas pred čakaním na riadky
   (zoznam bez riadkov by inak „sedel" ešte pred odpoveďou).

## Zmenené súbory (7 produkčných v `src`, 8 testov, 1 mimo)

- `src/domains/coreDam/asset/components/list/AssetListView.vue` (FE-59, P3)
- `src/domains/coreDam/asset/components/list/composables/assetListActions.ts` (FE-62, FE-59, FE-60, FE-70, podmienka)
- `src/domains/coreDam/asset/components/list/components/AssetTableRowItem.vue` (FE-62)
- `src/domains/coreDam/asset/store/assetListStore.ts` (FE-61)
- `src/domains/coreDam/asset/components/queue/AssetQueueItemEditable.vue` (P1)
- `src/domains/coreDam/asset/components/AssetCreateButton.vue` (P2)
- `src/domains/coreDam/asset/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue` (P3.3)
- `src/test/list/sidebarUnsavedLeave.test.ts` (nový, 23), `src/test/list/activeTile.test.ts` (nový, 10)
- `src/test/list/detailNotOfList.test.ts` (13 → 24), `detailNeighbour.test.ts` (30 → 36), `sidebarUnsaved.test.ts`
  (40 → 41), `detailRequests.test.ts`, `mainRouteChange.test.ts`, `externalProviderDetail.test.ts`
- `doc/changelog/3.0.0.md` („Fixed": šesť nových položiek za položkou „1 / 25"; v položke FE-45 je veta o tlačidle
  riadka tabuľky a zoznam „stále bez otázky" podľa stavu po kroku, v položke FE-50 veta o assete mimo aktívnej
  dlaždice)

E2E špecifikácie (`e2e/`) som nespúšťal.

## Nové nálezy (neopravené, neoverené druhým čítaním)

1. **Zoznam externého poskytovateľa: ← a → chodia po zozname pod frontou uploadu na celú obrazovku.** Fronta vypína
   príznak kláves zoznamu DAM (`A/composables/assetFooterUpload.ts:53-57`), nie príznak zoznamu poskytovateľa, a jeho
   šípky sa pozerajú len naň (`domains/coreDam/externalProvider/composables/externalProviderAssetListActions.ts:358-366`).
   Čítaním kódu. Obdoba FE-60, tam treba tú istú podmienku `customDialog`.
2. **Na stránke poskytovateľa ceruzka riadka fronty uploadu a „Vytvoriť prázdny asset" neotvoria nič**: zapíšu do
   skladu detailu DAM (`A/components/queue/AssetQueueItemEditable.vue:84-96`, `A/components/AssetCreateButton.vue:48-60`),
   stránka však kreslí len detail poskytovateľa
   (`domains/coreDam/externalProvider/components/ExternalProviderAssetListView.vue:126-129`). Asset sa vytvorí,
   resp. prečíta, bez viditeľného výsledku. Obdoba FE-59 na druhej stránke. Čítaním kódu; testy podmienky to berú
   ako dnešný stav.
3. **(Vzaté späť v cykle c1.)** Písal som, že Späť prehliadača frontu na celú obrazovku schová a `customDialog`
   ostane `true`. Neplatí: dialóg je perzistentný (predvoľby knižnice, `commonVuetifyConfig.js:56-60`), Vuetify ho
   pri Späť nezavrie, len zruší navigáciu.
4. **(Vzaté späť v cykle c1.)** Písal som, že Späť prehliadača zavrie otvorený detail cez `v-model` a adresa ostane
   `/assets/<id>`. Neplatí z toho istého dôvodu: detail ostáva otvorený. Drží to prípad cyklu.
5. **Príznak `customDialog` prežíva stránky** (`domains/system/composables/useMainWrapper.ts:4`): po odchode zo stránky
   poskytovateľa s hromadným výberom na celú obrazovku nakreslí zoznam DAM prázdny dialóg na celú obrazovku (jeho slot
   `custom-dialog` nekreslí ani jednu frontu, `A/components/list/AssetListView.vue:230-235`). Čítaním kódu.
6. **Dialóg licencie sa dá potvrdiť dvakrát**: `saving` sa nastavuje, ale tlačidlo „Potvrdiť" ho nečíta
   (`A/components/toolbar/AssetToolbarExtSystemLicenceDialog.vue:63,126-158,337-344`); druhé potvrdenie počas
   požiadavky pošle zmenu znova. V tom istom súbore ostal ladiaci `console.log` (`:179`). Čítaním kódu.
7. **Vuetify drží každú navigáciu routera o jeden `setTimeout`, kým je pripojený overlay s `closeOnBack`**
   (`vuetify/lib/composables/router.js:85-93`). V aplikácii neškodí; v testoch pod falošným časom `await router.push`
   bez posunu času neskončí (pozri „Pripojenie stránky v testoch").

## Cyklus c1 (OP6-D1-c1): otázka až v `router.beforeResolve`, „Zrušiť filter" a asset, na ktorý sa čaká

Tri rozhodnutia vedúceho po kroku, pred posudkami. Čísla riadkov v tejto časti platia pre strom po cykle.

1. **Snímok `OP6-D1-c1`** (rovnaký príkaz, meno `OP6-D1-c1`), hotový pred prvou úpravou cyklu.

### Bod 1 (P3): otázka sa kladie po všetkých strážach, ktoré vedia navigáciu zrušiť

**Čo sa mení v kóde.** `A/components/list/AssetListView.vue:82-93`: namiesto `onBeforeRouteLeave` si stránka
v `setup` registruje `router.beforeResolve` a pri odpojení ho odoberie (`onUnmounted`). Háčik:
- pustí navigáciu, ktorá stránku neopúšťa: `to.matched` obsahuje záznam trasy stránky (`useRoute().matched.at(-1)`
  vzatý v `setup`, `:86`), teda iný dopyt alebo hash zoznamu;
- inak ako doteraz: bez neuložených metadát pustí, s nimi vráti odpoveď `askToLeaveUnsaved()`.
`beforeunload` (`:95-101`), dialóg licencie a ostatné sa nemenili.

**Čo som overil vo vue-router** (`node_modules/vue-router/dist/vue-router.js:1351-1391`, funkcia `navigate`, verzia
5.3.1). Poradie front: stráže odchodu (`beforeRouteLeave`, `leaveGuards`) → `beforeEach` → `beforeRouteUpdate` →
`beforeEnter` → `beforeRouteEnter` (s načítaním lenivých komponentov cieľa) → `beforeResolve`. Každá fronta beží cez
`runGuardQueue` (`:1554-1556`), čo je reťaz `promise.then`; `false` zo stráže je odmietnutie
(`devtools-CN5uWJaH.js:546`, chyba typu 4, „aborted"), takže zvyšok fronty aj všetky ďalšie fronty sa preskočia.
`beforeResolve` teda beží po všetkých `beforeEach` bez ohľadu na poradie ich registrácie, a po strážach Vuetify
vždy.

**Čo beží pred otázkou v DAM** (prehľadané `admin-dam/src` a zostavenie knižnice v `node_modules`):
- `beforeEnter`, `beforeRouteEnter`, `beforeRouteUpdate` ani iný `beforeResolve` v DAM ani v knižnici nie je
  (`grep` bez nálezu); staré adresy rieši `redirect` (`router/legacyRedirects.ts:61-71`), ktorý sa vyhodnotí pred
  navigáciou a otázka sa potom týka cieľa presmerovania.
- `beforeEach` aplikácie (`router/beforeEachRoute.ts:19-63`) beží pred otázkou. Z neho: `addRoute(from)` zapíše zoznam
  do histórie trás aj vtedy, keď používateľ odpovie „Zostať"; záznam s rovnakou adresou sa nezdvojí a „späť" na
  iných stránkach preskakuje aktuálnu trasu (`common-admin/dist/domains/system/composables/routeHistory.js:16-49`),
  takže to nie je vidieť. `checkForNewVersion()` (`:36`) pri novej verzii stránku načíta znova ešte pred otázkou:
  pýta sa vtedy prehliadač (`beforeunload`), raz, nie aplikácia.
- `trackNavigation` knižnice (prvý `beforeEach`) označí navigáciu ako prebiehajúcu, takže kým je otázka otvorená,
  `onPage()` vracia `false`; po „Zostať" sa značka zruší (`afterEach` so zlyhaním). Dôsledok: chyba požiadavky, ktorá
  dobehne pod otvorenou otázkou, sa neukáže tam, kde sa na `onPage()` pozerá (prijatá medza).
- Kód cieľovej stránky sa v produkcii načíta pred otázkou (lenivé komponenty); keď sa nenačíta, navigácia skončí
  hláškou, používateľ ostane a nič sa nepýta.

**Čo sa mení pre používateľa.** Pravidlo (znenie spresnené v cykle c2): **kde Späť nad otvoreným dialógom alebo
menu nerobilo nič, nerobí nič ďalej; kde zoznam opustilo, najprv sa opýta.** Ktorý z dvoch prípadov nastane,
určuje záznam histórie pred zoznamom, nie to, čo je otvorené:
- **Záznam pred zoznamom vznikol cez `push`** (používateľ prišiel na zoznam odkazom z inej stránky aplikácie):
  Vuetify navigáciu zo Späť alebo Vpred zruší. Dialóg (detail, fronta na celú obrazovku, ktorýkoľvek) ostáva, ako
  je; otvorené menu sa zavrie a ďalšie Späť, už bez neho, je odchod. Nič sa nepýta, ani s neuloženými metadátami:
  ako pred krokom.
- **Záznam pred zoznamom vznikol cez `replace`**: Vuetify sa nepridá (`vuetify/lib/composables/router.js:105`)
  a Späť zoznam opustí aj s otvoreným detailom. **Toto je obvyklá cesta, nie výnimka:** po prihlásení relácia
  začína na `/` (prvý záznam, zapísaný cez `replace`) a `domains/system/views/HomepageView.vue:7-9` odtiaľ robí
  `push` na `/assets`. Pred krokom tu Späť nad otvoreným detailom zoznam potichu opustilo a napísané bolo preč;
  teraz sa s neuloženými metadátami najprv opýta (otázkou detailu). Bez neuložených metadát odíde ako doteraz.
- **Odkaz, menu stránky, tlačidlo „upraviť" riadka, Späť bez ničoho otvoreného**: pýta sa ako po kroku.
- Iný dopyt alebo hash zoznamu sa nepýta.

**Čo z toho je videné a čo nie.** Tri prípady so Späť bežia v teste so skutočnými strážami Vuetify: udalosť
`popstate` vyvolávam ručne v poradí, v akom ju dostane aplikácia v prehliadači (najprv router, po jeho strážach
poslucháči Vuetify), nad pamäťovou históriou routera. **V prehliadači som to nevidel.**

**Medze.** Medza „Späť dvakrát pod otvorenou otázkou" z kroku platí ďalej. Medza „nová verzia po Odísť aj tak"
odpadá (prehliadač sa pýta namiesto aplikácie, nie po nej). Nová: `onPage()` pod otvorenou otázkou (vyššie).

**Testy** (`src/test/list/sidebarUnsavedLeave.test.ts`, 23 → 30):
- Späť prehliadača nad otvoreným detailom, s napísaným aj bez (`it.each`, 2): žiadna otázka, router na `/assets`,
  detail otvorený s tým istým poľom a hodnotou, žiadna požiadavka; druhé Späť to isté;
- Späť nad otvoreným menu stránky s napísaným v paneli (1): menu sa zavrie, žiadna otázka, to isté pole s napísaným;
  ďalšie Späť sa pýta;
- Späť nad otvoreným detailom na záznam zapísaný cez `replace` (1; prepísaný prípad kroku „with the detail open",
  ktorý šiel cez `router.back()` bez `popstate`): otázka detailu, „Stay" nechá detail s napísaným, „Leave anyway" odíde;
- štvrtá cesta v tabuľke ciest von: Späť prehliadača bez ničoho otvoreného (1): pýta sa;
- iný dopyt a iný hash zoznamu s napísaným (2): žiadna otázka, adresa routera sa zmení, pole ostáva;
- po odchode zo stránky sa na ďalších stránkach nepýta, ani keď sa sklad umelo označí (1).

### Bod 2 (FE-61): „Zrušiť filter" asset nezabúda

Bol hotový pred snímkom cyklu, po prvej odpovedi vedúceho (časť FE-61, rozhodnutie 1): `resetList` ruší len index,
zapamätané id ruší vstup na stránku (`listMounted` volá `assetListStore.reset()`, `ACT:536-542`) a `reset` skladu.
Obe strany drží `activeTile.test.ts`: po „Zrušiť filter" je aktívna dlaždica assetu panela na jeho novom mieste
a „Edit more" otvorí detail zoznamu; po odchode zo stránky a návrate nie je aktívna žiadna (2 prípady). V cykle sa
tu nemenilo nič.

### Bod 3 (FE-61): zapamätaný asset neprežije asset panela

**Nález.** Po zozname, ktorý asset aktívnej dlaždice nepriniesol, nie je aktívna žiadna dlaždica a id ostáva
zapamätané pre ďalšiu stranu a ďalší zoznam. Keď panel medzitým vzal iný asset alebo o svoj prišiel, neskorší zoznam
s pôvodným assetom zvýraznil jeho dlaždicu vedľa panela, ktorý ho už neukazuje. Na snímku cyklu to potvrdili štyri
prípady.

**Čo sa mení v kóde.**
- `A/store/assetListStore.ts:21-23` `activeAssetIsAwaited`: pravda, odkedy `setList` zapamätaný asset v zozname
  nenašiel (`:95`); ruší ju výber dlaždice (`setActiveByIndex`, `:133`).
- `:38-49` `restoreActive(shownAssetId)`: na asset, na ktorý sa čaká, sa dlaždica obnoví len keď ho panel práve
  ukazuje; inak sa id zabudne. Asset dlaždice, ktorá aktívna bola, sa obnovuje bez ohľadu na panel, ako v kroku.
- `appendList` a `setList` dostávajú tretí parameter `shownAssetId` (`:51-55`, `:74-78`); `ACT:138-139`
  `shownInPanel()` (id assetu, ktorý sklad detailu drží; `null` pod loaderom a bez assetu) a jeho odovzdanie v `:165`
  a `:223`. Sklad zoznamu sklad detailu nečíta.

**Cesty, ktoré som prešiel** (panel stratí alebo zmení asset, kým žiadna dlaždica nie je aktívna):
1. „Upraviť" riadka fronty uploadu alebo hromadnej úpravy: `setAsset` assetu riadka → pri ďalšom zozname aj ďalšej
   strane zabudnuté (2 prípady).
2. „Vytvoriť prázdny asset": `setAsset` nového assetu → tá istá podmienka (bez vlastného prípadu).
3. Zlyhané čítanie, ktoré sklad vyprázdni: čítanie riadka fronty (prípad); čítanie po zmene trasy súboru v paneli
   (`refreshActiveItem`, vetva bez napísaného, `ACT:347-353`) → tá istá podmienka, panel je prázdny.
4. Čítanie, ktoré práve beží: panel je pod loaderom a neukazuje nič, čítaný asset môže byť iný → zabudnuté (prípad).
5. Zmazanie assetu v detaile: panel asset ukazuje ďalej (označený ako mazaný); ak ho neskorší zoznam ešte prinesie,
   dlaždica je jeho. Nič na opravu.
6. `reset` skladu detailu: pri odchode zo stránky (vstup na stránku ruší aj id), pred reloadom po zmene licencie
   a v zlyhaných čítaniach (bod 3).
7. **Čítania zo zoznamu (klik, ceruzka dlaždice, šípky, FE-70 vrátane)** najprv dlaždicu aktivujú, zapamätaný je
   teda jej asset a nečaká sa naň: po zlyhanom čítaní je dlaždica aktívna vedľa prázdneho panela už dnes (stav, ktorý
   FE-70 ponecháva), a po novom načítaní zoznamu aktívna ostáva. Nemenil som; je to pokračovanie stavu spred
   načítania, nie dlaždica, ktorú nik nevybral.

**Medza.** Keď zoznam alebo strana príde presne počas toho, ako panel číta znova ten istý asset (po zmene trasy
súboru, po hromadnom uložení), čakaný asset sa zabudne a dlaždica sa nezvýrazní (ako pred krokom).

**Testy** (`src/test/list/activeTile.test.ts`, 10 → 17, blok „the asset of the active tile that a list came
without"; stránka má navyše frontu uploadu s jedným riadkom):
- strážca: panel asset ukazuje, neskorší zoznam ho prinesie → dlaždica aktívna (1);
- panel drží asset riadka fronty → neskorší zoznam bez aktívnej dlaždice, a ani ďalší (1); to isté pre ďalšiu stranu (1);
- panel o asset prišiel zlyhaným čítaním riadka → žiadna aktívna (1);
- zoznam príde, kým panel číta asset riadka → žiadna aktívna, ani po dočítaní (1);
- strážcovia pôvodného pravidla: aktívna dlaždica ide za assetom, hoci panel drží asset riadka fronty (1); dlaždica
  vybraná po stratenom assete je aktívna ako každá iná (1).

### Testy a ohnutia cyklu

Dvanásť súborov kroku, 265 prípadov (251 + 14). Na kóde zo snímku `OP6-D1-c1`: **6 červených** (dva prípady Späť
z bodu 1, štyri z bodu 3), 259 zelených; na strome 265 zelených. Z 14 nových je 8 strážcov zelených aj na snímku
(Späť nad detailom bez napísaného, Späť bez ničoho otvoreného, dopyt, hash, stránky po zozname, tri prípady bodu 3)
a jeden prípad kroku je prepísaný (Späť na záznam zapísaný cez `replace`). Sedem z ôsmich strážcov a prepísaný
prípad sú červené aspoň pri jednom ohnutí. Ôsmy, „Späť nad otvoreným detailom bez napísaného: nič sa nepohne",
nie je červený pri žiadnom: drží správanie Vuetify (navigáciu zruší jeho stráž skôr, než sa stránka dostane
k slovu), nie riadok cyklu (spresnené v cykle c2).
Skripty `scratchpad/op6d1c1-bend-run.sh`, `op6d1c1-bends.py`, výsledok `op6d1c1-final.txt`. Ohnutí je 19, každé je
červené.

| Ohnutie | Červené |
|---|---|
| bod 1: otázka späť v stráži odchodu stránky | 2 (Späť nad detailom s napísaným, Späť nad menu) |
| bod 1: pýta sa pri každej navigácii, aj keď stránku neopúšťa | 2 (dopyt, hash) |
| bod 1: háčik ostane v routeri po stránke | 1 |
| krok znova: žiadna otázka na ceste von | 13 |
| krok znova: pýta sa, nech stránka drží čokoľvek | 8 |
| krok znova: „Zostať" odíde | 7 |
| krok znova: otvorený detail sa neráta | 2 |
| bod 3: čakaný asset sa nezabudne | 4 |
| bod 3: asset sa nikdy neoznačí ako čakaný | 4 |
| bod 3: panel treba aj pre dlaždicu, ktorá aktívna je | 2 (dvaja strážcovia) |
| bod 3: výber dlaždice značku „čaká sa" nechá | 1 |
| bod 3: panel sa ráta aj pod loaderom | 1 |
| bod 3: prvej strane sa nepovie, čo panel ukazuje | 1 (strážca) |
| bod 3: ďalšej strane sa nepovie, čo panel ukazuje | 1 |
| krok znova: `setList` nechá miesto aktívnej dlaždice | 12 |
| krok znova: `setList` asset nehľadá | 12 |
| krok znova: ďalšia strana sa neprehľadá | 1 |
| krok znova: zapamätaný asset preberie aktívnu dlaždicu | 1 |
| krok znova: asset, ktorý v zozname nie je, nechá aktívnu prvú dlaždicu | 11 |

Ostatné ohnutia kroku sa cyklom nedotkli (ich riadky sa nemenili) a znova som ich nepúšťal.

2. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`) 0; `lint:tsc` v CK.
3. **CK-DAM OP6-D1-c1** (`krok5-praca/vysledky/OP6-D1-c1-ck.log`) zelené: 88 súborov / 1 598 testov (CK OP6-D1
   88 / 1 584, +14), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
4. **Záplata** `zaplata.sh OP6-D1-c1`: `krok5-praca/zaplaty/OP6-D1-c1.diff` (545 riadkov, 6 súborov:
   `AssetListView.vue`, `assetListActions.ts`, `assetListStore.ts`, `activeTile.test.ts`,
   `sidebarUnsavedLeave.test.ts`, `doc/changelog/3.0.0.md`).
5. **Changelog:** v položke o cestách von veta o tlačidle Späť nad otvoreným dialógom alebo menu a o dopyte a hashi;
   v položke FE-61 veta o assete, ktorý zoznam nepriniesol.

**Oprava toho, čo som v kroku tvrdil nesprávne.** V správach vedúcemu a v poznámke kroku som písal, že Späť nad
otvoreným detailom ho dnes zavrie. Nezavrie: dialógy sú perzistentné (predvoľby knižnice), Späť nad nimi navigáciu
len zruší. Z toho istého omylu boli nálezy 3 a 4 kroku; sú vzaté späť vyššie. Rozhodnutie vedúceho (otázka
v `beforeResolve`) na tom nestojí a platí rovnako.

## Cyklus c2 (OP6-D1-c2): odkaz na stiahnutie a `beforeunload`, dvojklik na „upraviť" riadka, tri texty

Po posudkoch cyklu c1 (v háčiku P3 ani v pravidle FE-61 nič); dva body kódu a tri body textu. Čísla riadkov v tejto
časti platia pre strom po cykle.

1. **Snímok `OP6-D1-c2`** (rovnaký príkaz, meno `OP6-D1-c2`), hotový pred prvou úpravou cyklu.

### Bod c2-1 (P3.2): stiahnutie súboru z detailu nevyvolá otázku prehliadača

**Nález.** Dialóg „Stiahnuť" detailu má obyčajný odkaz v tej istej karte, „Stiahnuť originálny súbor"
(`A/components/detail/components/AssetDownloadButton.vue:109-117`, `:href` bez `target`). Backend adresu podpisuje ako
prílohu, takže prehliadač súbor stiahne a stránka ostane; `beforeunload` však prehliadač vyvolá ako pri každej
navigácii. S neuloženými metadátami sa teda po kroku pýtal, či odísť zo stránky, a „Zrušiť" stiahnutie zastavilo.

**Čo sa mení v kóde.**
- Nový `A/composables/fileDownloadUnload.ts`: `downloadPressed()` si zapíše čas stlačenia; `unloadIsOfDownload()`
  povie, či `beforeunload`, ktorý práve prišiel, patrí stiahnutiu: prvý do 1 s od stlačenia áno, raz; ďalší už nie
  a po 1 s nie ani prvý.
- `AssetDownloadButton.vue:114`: odkaz volá `downloadPressed` pri kliknutí. Na odkaze sa nemení nič iné: adresa,
  karta ani atribúty (`target` ani `download` nepribudli), klik sa nezastavuje.
- `A/components/list/AssetListView.vue:96-104`: obsluha `beforeunload` sa najprv opýta `unloadIsOfDownload()` a pri
  stiahnutí prehliadaču nepovie nič.

**Čo som zvolil a prečo.**
- Značka, ktorá žije len do konca úlohy kliknutia, nestačí: prehliadač môže `beforeunload` vyvolať v neskoršej úlohe.
- Značka, ktorú zruší až najbližší `beforeunload`, by v prehliadači, ktorý pre stiahnutie žiadny nevyvolá, čakala
  donekonečna a pohltila by ďalší skutočný odchod (obnovenie, zavretie okna) bez otázky.
- Samotný čas by v tej sekunde prepustil aj obnovenie hneď po stiahnutí.
- Preto oboje: značku spotrebuje prvý `beforeunload` (obnovenie hneď po ňom sa už pýta) a po 1 s zanikne sama.
  Jedna sekunda: `beforeunload` odkazu sa vyvoláva na začiatku navigácie, skôr než sa čokoľvek sťahuje, teda v úlohe
  kliknutia alebo hneď za ňou; sekunda pokryje aj zaneprázdnenú stránku a ručné obnovenie v tej istej sekunde je
  prakticky vylúčené.

**Iné navigácie v tej istej karte, ktoré aplikáciu neopúšťajú** a sú dosiahnuteľné zo stránky zoznamu: nenašiel som
žiadnu. Prešiel som všetky odkazy s vlastnou adresou v `admin-dam/src` a v zostavení knižnice:
- nová karta (`target="_blank"`), nikdy `beforeunload` tejto stránky: `A/components/AssetLink.vue:21-25`,
  `AssetByImageIdLink.vue:51-54`, `detail/components/DistributionImagePreviewItem.vue:119-121`, odkazy distribúcií
  (`DistributionListItemJw.vue:77`, `DistributionListItemYoutube.vue:77,85`, `YoutubeLogo.vue:15`,
  `DistributionListItemCustomDistributionDataItem.vue:17`, `DistributionYoutubeTermOfUse.vue`, 11 odkazov,
  `DistributionNewDialogYoutube.vue:467`) a prepínač adminov knižnice (`AAdminSwitcher`);
- „Stiahnuť" slotu ide cez `window.open` (`detail/components/slots/AssetSlotListItem.vue:102`), nové okno;
- aplikáciu naozaj opúšťajú, pýtať sa je správne: odhlásenie (`domains/system/composables/currentUser.ts:2`), reload
  po zmene licencie (rieši P3.3) a reload pri novej verzii.

**Čo sa mení pre používateľa.** S neuloženými metadátami v detaile: „Stiahnuť" → „Stiahnuť originálny súbor" súbor
stiahne bez otázky prehliadača, ako pred krokom. Obnovenie stránky alebo zavretie okna hneď potom sa pýta.

**Medze.**
- Keď odkaz neodpovie ako príloha (vypršaný podpis: chybová stránka úložiska), karta aplikáciu opustí bez otázky,
  ako pred krokom.
- V prehliadači, ktorý pre stiahnutie `beforeunload` nevyvolá, sa obnovenie alebo zavretie okna do 1 s od stlačenia
  odkazu nepýta.
- **V prehliadači nevidené**: či a kedy ktorý prehliadač `beforeunload` pre stiahnutie vyvolá.
- Tlačidlo je aj na samostatnej stránke detailu; tá obsluhu `beforeunload` nemá, nemení sa tam nič.

**Testy** (`src/test/list/sidebarUnsavedLeave.test.ts`, 30 → 32, blok „and a file is downloaded from the detail";
detail s napísaným, dialóg „Download" s odkazom podpísanej adresy na inom pôvode):
- bez stlačenia odkazu sa okno pýta; po stlačení a 300 ms `beforeunload` nie je zastavený; okno testu adresu odkazu
  prevzalo (tak happy-dom nasleduje odkaz tej istej karty), odkaz nemá `target` ani `download`; ďalší `beforeunload`
  je zastavený znova (1);
- stlačenie, po ktorom do 1,5 s žiadny `beforeunload` neprišiel: ďalší je zastavený (1; strážca).

### Bod c2-2 (FE-62): dvojklik na „upraviť" riadka tabuľky

**Nález.** Tlačidlo zastavovalo len `click`; `dblclick` došiel k riadku (`@dblclick.stop.exact="showDetail"`), ktorý
riadok aktivoval, otvoril detail zoznamu, prečítal asset a prepísal adresu, kým kliky navigovali. S neuloženými
metadátami sa `dblclick` opýtal prvý a „Odísť aj tak" otvorilo detail zoznamu namiesto stránky detailu.

**Čo sa mení v kóde.** `A/components/list/components/AssetTableRowItem.vue:162`: `@dblclick.stop=""` na tlačidle
(komentár `:56-60`). Riadok ani jeho dvojklik sa nemenili.

**Čo sa mení pre používateľa.** Dvojklik na „upraviť" riadka robí v zozname to isté čo jeho kliky: bez klávesu nič
(len prechod na stránku detailu), s Ctrl, Cmd, Shift alebo Alt to, čo predtým (každý z dvoch klikov otvorí detail
zoznamu; `dblclick` riadka s klávesom nepočúval ani predtým). S neuloženými metadátami príde jedna otázka
(z navigácie druhého kliku; prvú vue-router zruší) a „Odísť aj tak" prejde na stránku detailu. Dvojklik inde na
riadku otvára detail zoznamu ako doteraz.

**Testy** (`src/test/list/sidebarUnsaved.test.ts`, 41 → 45, blok tabuľky; dvojklik = dva `click` a `dblclick`):
- bez klávesu, navigácia podržaná: žiadny aktívny riadok, detail zatvorený, adresa zoznamu, žiadne čítanie; po
  dokončení router na `/assets/asset-3` (1);
- s napísaným: jedna otázka, nič sa nečítalo; „Leave anyway" → router na `/assets/asset-3`, zoznam nič nečítal (1);
- strážca: s Ctrl detail zoznamu „3 / 3 asset-3", router na `/assets`, dve čítania ako pri dvoch klikoch (1);
- strážca: dvojklik na riadok otvorí detail zoznamu (1).

### Bod c2-3: texty

- **„Zobraziť originál" duplikátu** je odkaz do novej karty, nikdy sa nepýta: vypadol zo zoznamu ciest von
  v changelogu aj v časti P3 tejto poznámky.
- **Späť nad otvoreným dialógom**: changelog aj časť „Cyklus c1" tejto poznámky hovoria pravidlo „kde Späť nerobilo
  nič, nerobí nič ďalej; kde zoznam opustilo, najprv sa opýta", s tým, že opustenie je obvyklá cesta po prihlásení
  (`/` zapísané cez `replace`, potom `push` na `/assets`).
- **Strážcovia cyklu c1**: veta „každý je červený aspoň pri jednom ohnutí" neplatila pre prípad „Späť nad
  otvoreným detailom bez napísaného"; opravené v časti „Cyklus c1".

### Testy a ohnutia cyklu

Dvanásť súborov kroku, 271 prípadov (265 + 6). Na kóde zo snímku `OP6-D1-c2`: **3 červené** (stiahnutie, dva
dvojkliky bez klávesu), 268 zelených; na strome 271 zelených. Traja noví strážcovia (stlačenie bez navigácie, dvojklik
s Ctrl, dvojklik na riadok) sú zelení aj na snímku a každý je červený pri jednom ohnutí. Skripty
`scratchpad/op6d1c2-bend-run.sh`, `op6d1c2-bends.py`, výsledok `op6d1c2-final.txt`. Ohnutí je 8, každé je červené.

| Ohnutie | Červené |
|---|---|
| c2-1: stlačenie odkazu sa nezapíše | 1 |
| c2-1: stránka sa na stiahnutie nepozrie a pýta sa | 1 |
| c2-1: stiahnutiu patrí len `beforeunload` v tej istej chvíli ako klik | 1 |
| c2-1: stlačenie sa povie viackrát (ďalší `beforeunload` tiež prejde) | 1 |
| c2-1: stlačenie nikdy nezostarne | 1 (strážca) |
| c2-2: `dblclick` tlačidla dôjde k riadku | 2 |
| c2-2: `dblclick` tlačidla je jeho tretí klik | 1 (strážca s Ctrl) |
| c2-2: riadok `dblclick` nepočuje vôbec | 1 (strážca riadka) |

Ohnutia kroku a cyklu c1 sa týchto riadkov netýkajú a znova som ich nepúšťal.

2. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku a cyklu (cez `tezky.sh`, `scratchpad/op6d1c2-lint.sh`) 0;
   `lint:tsc` v CK.
3. **CK-DAM OP6-D1-c2** (`krok5-praca/vysledky/OP6-D1-c2-ck.log`) zelené: 88 súborov / 1 604 testov (CK OP6-D1-c1
   88 / 1 598, +6), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
4. **Záplata** `zaplata.sh OP6-D1-c2`: `krok5-praca/zaplaty/OP6-D1-c2.diff` (293 riadkov, 7 súborov:
   `AssetDownloadButton.vue`, `AssetListView.vue`, `AssetTableRowItem.vue`, nový `fileDownloadUnload.ts`,
   `sidebarUnsaved.test.ts`, `sidebarUnsavedLeave.test.ts`, `doc/changelog/3.0.0.md`).
5. **Changelog:** cesty von bez „Zobraziť originál" a s pravidlom o tlačidle Späť; veta o „Stiahnuť originálny súbor"
   pri otázke prehliadača; dvojklik v položke o tlačidle „upraviť".

**Neprijaté, bez zmeny** (rozhodnutie vedúceho): „panel ukáže A, potom B, potom znova A a ďalší zoznam zvýrazní A"
(dlaždica a panel sa tam zhodujú); medza `onPage()` pod otvorenou otázkou ostáva prijatou medzou.
