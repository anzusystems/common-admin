# OP5-D1: otázka pred zahodením neuložených metadát panela pri zozname (impl-dam-op5)

Zadanie vedúceho z 12. 10. (rozhodnutie vlastníka: tá istá otázka ako vo FE-44 aj so ZATVORENÝM detailom). Strom
`/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `1af3c3ac`. TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op5`. Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu,
knižnica ani texty sa nemenili.

## Podkroky

1. **Snímok `OP5-D1`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam OP5-D1 doc/changelog/3.0.0.md`, hotový pred prvou úpravou.
2. **Kód, testy, dôkazy** nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP5-D1`; `vitest.k3-bend.config.mts`, oba skopírované z TMPDIR `impl-dam-op4`; skripty
   `scratchpad/op5d1-bend-run.sh`, `op5d1-bends.py`, `op5d1-final-run.sh`, výsledok `scratchpad/op5d1-final.txt`).
   Dva súbory testov, 51 prípadov; na kóde zo snímku 20 červených, 31 zelených.
3. `oxfmt`, `oxlint` 0; `eslint` nad súbormi kroku (cez `tezky.sh`, skript `scratchpad/op5d1-lint.sh`) 0.
4. **CK-DAM OP5-D1** (`krok5-praca/vysledky/OP5-D1-ck.log`) zelené: 83 súborov / 1 455 testov (CK OP4-D1-c2
   82 / 1 429, +1 súbor, +26 testov), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplata.sh OP5-D1`: `krok5-praca/zaplaty/OP5-D1.diff` (913 riadkov, 8 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku. `src/typed-router.d.ts` v nej nie je.

## Čo sa mení v kóde

- `assetDetailStore.ts`: nový príznak `panelHoldsUnsavedMetadata` (detail zatvorený, bez loadera,
  `metadataAreTouched`), dvojča `showsUnsavedMetadata` pre zatvorený detail. Nič iné: otázka, jej odpoveď aj udalosti,
  ktoré ju zrušia (`hideDetail`, `reset`, `showLoader`, `setAsset`), sú tie isté. Upravený je komentár pri
  `hideDetail` (starý tvrdil, že otázku nemá kto zodpovedať; odteraz by ju nakreslila stránka).
- `assetListActions.ts`:
  - `readReplacesUnsavedOfPanel(assetId)`: panel drží neuložené A ZÁROVEŇ (otázka je už otvorená ALEBO akcia asset
    naozaj prečíta, teda `checkQuickDetailReFetch(assetId)` neplatí). Synchrónne; `await` pribudne len vtedy, keď sa
    pýta, takže bez neuložených zmien bežia všetky cesty presne ako doteraz.
  - `neighbourOfActive(1 | -1)`: asset, ktorý `nextItem` / `prevItem` prečíta (sused; na konci zoznamu znova aktívny;
    nič, keď šípka nikam nevedie). Zrkadlí `setActiveNext` / `setActivePrev` skladu, sklad sa nemenil.
  - `onItemClick`, `showDetail`, `nextItem`, `prevItem`: otázka je prvý riadok, pred `setActiveByIndex`, loaderom,
    adresou aj požiadavkou. V `nextItem` a `prevItem` ostáva riadok FE-44 (otvorený detail) nedotknutý a nový je pod ním.
- `AssetListView.vue`: druhý `AUnsavedConfirmDialog`, `leaveUnsavedQuestion && !detail`.
- `AssetDetailDialog.vue`: dialóg detailu je viazaný na `leaveUnsavedQuestion && detail` (predtým len na príznak).
  Ostáva potomkom `VDialog` detailu.
- `AssetTableRowItem.vue`: tlačidlo „upraviť" riadka posiela `showDetail` so značkou `leavesList` (pozri rozhodnutie 4).

## Rozhodnutia

1. **Bod 4 zadania (aktívna dlaždica): pýta sa presne vtedy, keď by sa asset čítal.** Dalo sa to rozlíšiť bez
   prestavby: klik aj ceruzka nesú `assetId`, šípkam ho dá `neighbourOfActive`.
   - klik na aktívnu dlaždicu a jej ceruzka do 5 s od posledného čítania: nepýta sa, nič sa nečíta; ceruzka otvorí
     detail nad napísaným a ďalej platí FE-44;
   - to isté po 5 s: asset by sa čítal znova a napísané nahradil, preto sa pýta (tým je pokrytá aj cesta „tá istá
     dlaždica po 5 s");
   - šípka na konci zoznamu (→ na poslednom, ← na prvom) vedie na ten istý asset: do 5 s sa nepýta, potom áno. Pri
     otvorenom detaile ostáva správanie FE-44 (pýta sa vždy), nemenil som ho.
2. **Viditeľnosť pravého panela: nezávisí od nej.** Pýta sa vždy, keď by sa napísané stratilo, aj keď je panel
   schovaný tlačidlom „i". Dôvod navyše: po detaile otvorenom ceruzkou a zavretom cez X panel v pohľade vôbec nie je
   a napísané v ňom je. „Zostať" panel neotvorí (nič sa nemení); „Odísť aj tak" ho klikom otvorí ako doteraz.
3. **Kde je dialóg: v `AssetListView.vue`, v predvolenom slote `MainWrapper`, mimo reťaze `v-if` zoznamu**, takže je
   pripojený po celý čas stránky (aj pod loaderom zoznamu). Je to koreňový overlay. Presne jeden dialóg naraz je daný
   väzbami: detail kreslí otázku len keď `detail`, stránka len keď `!detail`. Väzba detailu je potrebná: obsah
   zatváraného detailu ostáva pripojený, kým dobehne jeho animácia, a jeho dialóg by sa nakreslil popri dialógu
   stránky (ohnutie `e-detail-draws-when-closed` je červené).
4. **Tlačidlo „upraviť" riadka v tabuľkovom pohľade sa nepýta.** `ATableEditButton` má `route-name`, je to teda aj
   odkaz routera: jeho klik okrem `showDetail` prejde na samostatnú stránku detailu `/assets/:id` (test to potvrdil,
   `router.currentRoute` je po kliku `/assets/asset-3`). Otázka by tam „Zostať" nevedela dodržať, stránka by odišla
   aj tak. Patrí to pod „odchod zo stránky" v zozname nižšie. Klik na riadok sa pýta (dvojklik riadka teda už pri
   prvom kliku). **Od cyklu 1 to platí len pre obyčajný klik**; s Ctrl, Cmd, Shift, Alt sa odkaz v tomto okne
   nenasleduje a klik sa pýta (pozri „Cyklus 1").
5. **Otvorená otázka drží všetko.** Kým je otvorená, každá z troch ciest sa „opýta znova" a dostane hneď „zostať",
   aj tá, ktorá by sa sama nepýtala (šípka na konci zoznamu do 5 s). Bez toho by jej prvý krok (`showLoader`) otázku
   potichu zodpovedal „zostať" a zavrel.
6. **Jeden existujúci prípad `detailNeighbour.test.ts` je upravený** (oznámené vedúcemu správou počas práce): „are
   asked about by a question that goes with the detail closed under it", variant „closed". Píše do detailu, otvorí
   otázku, zavrie detail cez X a potom klikne na CERUZKU INEJ DLAŽDICE; po X sú napísané metadáta stále v sklade,
   takže sa podľa bodu 1c zadania musí pýtať. Prípad drží všetky pôvodné tvrdenia až po „stará otázka je preč, nič sa
   nečítalo, žiadny dialóg"; potom tvrdí novú otázku (asset-3 stále neprečítaný), stlačí „Leave anyway" a pokračuje
   ako predtým (detail 3 / 3, prečítaný raz, bez otázky, ← bez otázky). Variant „emptied" je nedotknutý. Ostatných
   23 prípadov bez zmeny.

## Čo sa mení pre používateľa

So zatvoreným detailom, keď panel pri zozname drží neuložené metadáta (aj tie, ktoré v ňom nechal zavretý detail;
„Uložiť" panela je zvýraznené), sa najprv opýta „Máte neuložené zmeny. Naozaj chcete odísť?":
- klik na inú dlaždicu alebo iný riadok tabuľky;
- ← a → v zozname;
- ceruzka inej dlaždice (otvorenie detailu iného assetu).

Dvojklik na inú dlaždicu sa pýta už pri svojom prvom kliku a „Odísť aj tak" potom dlaždicu **len vyberie**: detail sa
neotvorí, treba ho otvoriť znova (prijatá medza).

„Zostať": tá istá aktívna dlaždica, panel s napísaným (tie isté pripojené polia), tá istá adresa, nič neodišlo na
server, „Uložiť" ostáva zvýraznené, ďalší pokus sa pýta znova. „Odísť aj tak": akcia prebehne ako doteraz. Bez
neuložených zmien, po úspešnom „Uložiť" panela a pri Ctrl / Shift kliku sa nepýta. **Na backend:** nič inak (pri
„Zostať" neodíde čítanie, ktoré doteraz odišlo).

## Rozsah a medze

- Pod loaderom panela sa nepýta (po „Odísť aj tak" druhý rýchly klik ide ďalej ako doteraz).
- Dvojklik na inú dlaždicu: pýta sa prvý klik; zvyšok dvojkliku v prehliadači padne na otázku. „Odísť aj tak" potom
  dlaždicu len vyberie, detail treba otvoriť znova.
- Uloženie panela na ceste má príznak dole: klik na inú dlaždicu počas neho sa nepýta (v zozname nižšie).
- Šípky sa so zatvoreným detailom počúvajú aj pod otvoreným menu alebo dialógom stránky (známy nález z OP4-D1):
  s neuloženými metadátami sa teraz otvorí otázka nad nimi (čítaním kódu, bez testu). Esc na otázke je „Zostať"
  (dialóg knižnice).
- Detail otvorený pod otvorenou otázkou stránky (používateľ sa k tomu nedostane, tlačidlo „Upraviť" panela je pod
  ňou): otázka by prešla do detailu, stále jedna.
- Zoznam externého poskytovateľa, samostatná stránka detailu, FE-43 a FE-44 pri otvorenom detaile: bez zmeny.

## Testy

`src/test/list/sidebarUnsaved.test.ts` (nový, 26 prípadov; skutočná stránka `AssetListView.vue` so skutočným panelom
a detailom, falošný je len server a `fetch` verzie aplikácie; tvrdí sa cez DOM, požiadavky a adresu okna):
- štyri cesty (klik na inú dlaždicu, →, ←, ceruzka inej dlaždice): jedna otázka s textom knižnice; pred odpoveďou
  žiadna požiadavka, aktívna dlaždica, adresa aj pole panela ako boli; „Stay": to isté pole pripojené s napísaným,
  žiadna požiadavka, „Save" zvýraznené, ďalší pokus sa pýta; „Leave anyway": cieľ prečítaný raz, aktívna dlaždica,
  detail a adresa ako doteraz, žiadny `PATCH`;
- bez zmeny sa nepýta žiadna z ciest; po úspešnom „Save" panela nie; po odmietnutom áno;
- pod loaderom po „Leave anyway" sa znova nepýta;
- prepínač (jednorazové použitie) sa ráta ako napísané pole;
- schovaný panel: pýta sa, „Stay" ho nechá schovaný, „Leave anyway" ho otvorí;
- dvojklik: jedna otázka, „Leave anyway" len vyberie;
- Ctrl a Shift klik: bez otázky, do panela sa nič nečíta, napísané ostáva (do fronty hromadnej úpravy sa assety
  čítajú ako doteraz);
- bod 4: aktívna dlaždica a jej ceruzka hneď po čítaní bez otázky (ceruzka otvorí detail nad napísaným, → sa potom
  pýta otázkou detailu, otvorené sú presne dva dialógy); po 5 s sa obe pýtajú; šípka na konci zoznamu až po 5 s;
- bod 5: šípky aj klik pod otázkou nerobia nič a odpoveď patrí prvej ceste; otázka ostane aj nad cestou, ktorá by
  sa sama nepýtala; jedna otázka aj počas zatvárania detailu, do ktorého sa písalo;
- otázka zmizne, keď panel číta asset znova (skutočnou cestou: „Make private" z panela na ceste →
  `refreshActiveItem`, čítanie sa drží), keď sa sklad vyprázdni a keď sa doň zapíše asset;
- tabuľka: klik na iný riadok sa pýta; tlačidlo „upraviť" riadka nie a router prejde na `/assets/asset-3`.

`src/test/list/detailNeighbour.test.ts`: 25 prípadov, jeden upravený (rozhodnutie 6).

Na kóde zo snímku `OP5-D1` (51 prípadov): **20 červených** (19 nových a upravený variant „closed"), 31 zelených
(24 pôvodných a 7 nových strážcov: bez zmeny, po uložení panelom, Ctrl, Shift, aktívna dlaždica a jej ceruzka hneď
po čítaní, odkaz riadka tabuľky). Každý strážca je červený aspoň pri jednom ohnutí.

| Ohnutie | Červené |
|---|---|
| klik na dlaždicu sa nepýta | 13 |
| ceruzka (a dvojklik) sa nepýta | 4 (ceruzka inej, ceruzka po 5 s, dvojklik, upravený prípad FE-44) |
| → sa so zatvoreným detailom nepýta | 5 |
| ← sa so zatvoreným detailom nepýta | 2 |
| klik sa pýta až po posune aktívnej dlaždice | 9 |
| → sa pýta až po posune aktívnej dlaždice | 3 |
| pýta sa aj na asset, ktorý panel drží a nečítal by sa | 3 (dlaždica, ceruzka, koniec zoznamu) |
| otvorená otázka nedrží cestu, ktorá by sa nepýtala | 1 |
| šípka na konci zoznamu „nikam nevedie" | 1 |
| odkaz riadka tabuľky sa pýta | 1 |
| pýta sa len pri paneli v pohľade | 2 (schovaný panel, upravený prípad FE-44) |
| panel „drží" aj pod loaderom | 1 |
| panel „drží" aj pri otvorenom detaile | 9 (8 prípadov FE-44: otázka príde dvakrát; ceruzka aktívnej dlaždice) |
| panel „drží", aj keď sa nič nenapísalo | 51 (všetky) |
| „Zostať" odíde | 20 |
| začaté čítanie otázku nezodpovie | 2 (panel aj detail) |
| vyprázdnený sklad otázku nezodpovie | 2 (panel aj detail) |
| zapísaný asset otázku nezodpovie | 2 (panel aj detail) |
| stránka otázku nekreslí | 20 |
| stránka kreslí otázku aj nad otvoreným detailom | 2 (dva dialógy otázky naraz) |
| detail kreslí otázku, aj keď je zatvorený | 1 (zatváraný detail) |
| uloženie panela príznak nezruší | 1 |
| zlyhané uloženie panela príznak nevráti | 1 |
| prepínač jednorazového použitia sa neráta | 2 (panel aj detail) |
| Ctrl klik dlaždicu aj vyberie | 1 |
| Shift klik dlaždicu aj vyberie | 1 |

## Zmenené súbory (5 v `src` produkčných, 2 testy, 1 mimo)

- `src/domains/coreDam/asset/store/assetDetailStore.ts`
- `src/domains/coreDam/asset/components/list/composables/assetListActions.ts`
- `src/domains/coreDam/asset/components/list/AssetListView.vue`
- `src/domains/coreDam/asset/components/detail/components/AssetDetailDialog.vue`
- `src/domains/coreDam/asset/components/list/components/AssetTableRowItem.vue`
- `src/test/list/sidebarUnsaved.test.ts` (nový, 26 prípadov)
- `src/test/list/detailNeighbour.test.ts` (jeden prípad upravený)
- `doc/changelog/3.0.0.md` („Fixed": nová položka za položkou FE-44)

## Zoznam: čo ďalej zahodí neuložené metadáta panela so zatvoreným detailom (NEMENIL som)

Čísla riadkov sú podľa stromu po cykle 1.

1. **Čítanie po zmene hlavnej cesty súboru v paneli** (`AssetListView.vue:206` → `assetListActions.ts:309`,
   `refreshActiveItem`): „Zverejniť" / „Zneverejniť" v karte súboru panela. Po odpovedi loader v paneli a hodnoty zo
   servera, bez otázky. Číta sa pritom AKTÍVNA dlaždica, nie asset panela (pozri nálezy).
2. **Uloženie hromadnej úpravy, v ktorej je aj asset panela** (`AssetFooterSelectedFull.vue:65-80`, volané z `:114`
   a `:135`, `readAgainIfSaved`): po uložení sa asset panela prečíta znova; napísané v paneli je preč, uložili sa
   hodnoty z riadka fronty.
3. **Ceruzka riadka fronty** (upload aj hromadná úprava; `AssetQueueItemEditable.vue:74-95`): prečíta asset riadka
   do toho istého skladu a otvorí detail; panel po zavretí ukazuje asset riadka.
4. **Vytvorenie assetu** (`AssetCreateButton.vue:48-59`, v menu `AssetToolbarOptions.vue:86`): nový asset sa zapíše
   do skladu a otvorí sa jeho detail.
5. **Odchod zo stránky**: každý odkaz menu a logo; tlačidlo „upraviť" riadka tabuľky
   (obyčajný klik; `AssetTableRowItem.vue:157-161` → `/assets/:id`, tam `AssetDetailView.vue:115-127` vyprázdni sklady); návrat na
   zoznam (`assetListActions.ts:504-507`, `listMounted` → `reset`); zmena licencie
   (`AssetToolbarExtSystemLicenceDialog.vue:141`, `window.location.reload()`); obnovenie alebo zavretie okna. Bez
   otázky, napísané je preč.
6. **Uloženie panela na ceste** (`AssetListSidebarMetadata.vue:96` zruší príznak pri odoslaní): klik na inú dlaždicu
   počas neho sa nepýta; ak uloženie potom zlyhá (`:110` vráti príznak len kým panel drží ten istý asset), napísané
   je preč a chyba sa ukáže nad ďalším assetom.
7. **Zlyhané čítanie** po kroku 1 (`assetListActions.ts:320-325`): sklad sa vyprázdni, panel povie „žiadny asset".

**Čo zahodením NIE JE** (overené sondou mimo stromu, `node_modules/.cache/vitest-tmp-impl-dam-op5/op5d1-probe.test.ts`,
a čítaním `fetchAssetList`, ktorý na sklad detailu nesiaha): odoslanie a zrušenie filtra, hľadanie, prepínače typu
a podcastu, zoradenie, „Obnoviť", ďalšia stránka pri rolovaní. Po novom načítaní zoznamu panel drží ten istý asset
s napísaným v tom istom poli a „Uložiť" je zvýraznené; klik na inú dlaždicu sa potom pýta. Schovanie panela nič
nezahodí (obsah ostáva pripojený).

## Nové nálezy (neopravené)

- **Po novom načítaní zoznamu ostane index aktívnej dlaždice zo starého zoznamu** (`assetListStore.ts:48`, `setList`
  ho neruší; `:94` `setActiveByIndex` sa pri rovnakom indexe vráti): žiadna dlaždica nie je zvýraznená, klik na
  dlaždicu na starom indexe ju nezvýrazní (sonda), šípky pokračujú od starého indexu a `refreshActiveItem` po zmene
  hlavnej cesty v paneli prečíta do panela asset, ktorý je na tom indexe v NOVOM zozname (čítaním kódu).
- **Tlačidlo „upraviť" riadka tabuľky robí dve veci naraz**: `showDetail` zoznamu (loader, dialóg, čítanie) aj
  prechod routera na samostatnú stránku detailu, ktorá sklady vyprázdni a asset číta druhýkrát. V teste je po kliku
  adresa routera `/assets/asset-3` a asset prečítaný už zoznamom.
- **Šípky so zatvoreným detailom menia adresu na `/assets/:id`**, hoci detail otvorený nie je (`nextItem`,
  `prevItem`); klik na dlaždicu adresu nemení. Test nových ciest to drží ako dnešný stav.

## Cyklus 1 (OP5-D1-c1): päť bodov z posudkov

Po posudkoch (Codex, Opus); obe rozhodnutia kroku (viditeľnosť panela, odkaz riadka tabuľky) platia. Body 1 až 4 sú
kód a testy, bod 5 len text.

1. **Snímok `OP5-D1-c1`** (rovnaký príkaz, meno `OP5-D1-c1`), hotový pred prvou úpravou cyklu.
2. **Bod 1: značka `leavesList` len pre klik, ktorý zoznam v tomto okne naozaj opustí.**
   `AssetTableRowItem.vue:59-62`, `followDetailLink(event)`: `leavesList` je pravda len bez Meta, Alt, Ctrl a Shift
   a pri hlavnom tlačidle myši. Sú to podmienky `guardEvent` routera (`vue-router.js:1010-1013`; `VBtn.js:153` má ich
   podmnožinu). Tretiu podmienku routera, `defaultPrevented`, nezrkadlím: pri nasledovanom odkaze ju nastaví router
   sám (`:1018`) a obsluha tlačidla beží podľa poradia, v akom Vue spája obsluhy, pred mojou (čítaním, bez testu).
   `target="_blank"` tlačidlo nemá.
   - Pre používateľa: Ctrl / Cmd / Shift / Alt + klik na „upraviť" riadka (odkaz sa otvorí inde, zoznam ostáva
     a `showDetail` nad ním beží ako doteraz) sa s neuloženými metadátami panela najprv opýta ako ceruzka dlaždice.
     Obyčajný klik sa nepýta a odíde ako doteraz.
   - Vedľajšie tlačidlo myši je zrkadlené pre úplnosť: prehliadač preň `click` neposiela (`auxclick`).
3. **Bod 2: po zmazaní assetu v detaile sa nepýta.** Zvolil som `setDeleting()` skladu
   (`assetDetailStore.ts:153-158`): okrem stavu „deleting" zruší `metadataAreTouched`. Volá ho jediné miesto,
   `AssetDetailDialog.vue:58-65` (`postDelete`), a len keď sklad drží práve zmazaný asset; je to teda presne
   „úspešné zmazanie assetu, ktorý panel ukazuje", jedným riadkom a bez zásahu do komponentov.
   - Pre používateľa: po zmazaní v detaile klik na inú dlaždicu, šípky ani ceruzka nepýtajú; „Uložiť" panela pri
     zmazanom assete už nie je zvýraznené (doteraz ostalo, ak sa do detailu pred zmazaním písalo).
4. **Bod 3: po „Odísť aj tak" ide klik aj ceruzka tam, kde je kliknutý asset TERAZ.**
   `assetListActions.ts:125-130`, `leaveUnsavedFor(clicked)`: opýta sa; po „odísť" nájde asset v zozname podľa `id`
   a vráti údaje kliku s jeho dnešným indexom, alebo `null` („zostať" aj „asset v zozname nie je"). `onItemClick`
   (`:333-335`) a `showDetail` (`:269-273`) ho volajú len keď sa pýta; bez otázky idú s údajmi kliku ako doteraz, bez
   hľadania a bez `await`.
   - Pre používateľa: keď sa zoznam pod otvorenou otázkou načíta znova (uloženie fronty uploadu), zvýraznenie aj
     „k / n" detailu patria kliknutému assetu na jeho novom mieste; ak v zozname už nie je, „Odísť aj tak" neurobí
     nič (nič sa nečíta, panel s napísaným ostáva, „Uložiť" zvýraznené).
   - Medza (známy nález, nemenil som): po novom načítaní zoznamu ostáva v sklade starý index aktívnej dlaždice; ak
     kliknutý asset skončí práve na ňom, `setActiveByIndex` sa vráti a dlaždica sa nezvýrazní, čítanie aj panel sú
     správne. Šípky po novom načítaní zoznamu sa cyklom nemenili.
5. **Bod 4: `listUnmounted` otvorenú otázku zodpovie „zostať"** (`assetListActions.ts:512-518`). Čakajúca cesta sa
   vráti, príznak otázky je dole a ďalšie opýtanie je znova otázka. Platí aj pre otázku detailu (FE-44), keď stránka
   zoznamu odíde pod ňou.
6. **Bod 5 (len text):** changelog aj táto poznámka hovoria, že dvojklik na inú dlaždicu sa pýta pri prvom kliku
   a „Odísť aj tak" dlaždicu len vyberie; detail sa po odpovedi neotvorí. Správanie sa nemenilo. Changelog už
   netvrdí, že klik na „upraviť" riadka zoznam opustí vždy; pribudli v ňom vety o zmazanom assete a o zozname
   načítanom pod otázkou.
7. **Testy** (`sidebarUnsaved.test.ts` 26 → 37; `detailNeighbour.test.ts` bez zmeny, 25):
   - bod 1: päť prípadov (Ctrl, Cmd, Shift, Alt, iné tlačidlo) na „upraviť" riadka: jedna otázka, router ostal na
     `/`, nič sa nečítalo; „Stay" nechá pole s napísaným; „Leave anyway" otvorí detail 3 / 3. Prípad obyčajného kliku
     ostal (nepýta sa, router na `/assets/asset-3`);
   - bod 2: ceruzka, písanie do detailu, „zmazať" a potvrdenie: detail sa zavrie, `DELETE` odišiel raz, „Save"
     panela nie je zvýraznené; klik na inú dlaždicu bez otázky, asset prečítaný;
   - bod 3: štyri prípady (klik a ceruzka × asset presunutý a asset preč). Zoznam sa pod otvorenou otázkou načíta
     znova tlačidlom „Obnoviť" stránky (ten istý `fetchAssetList`, ktorý volá uloženie fronty uploadu); otázka nad
     novým zoznamom ostáva. Presunutý (`asset-3` z tretieho miesta na prvé): zvýraznená je prvá dlaždica, detail
     hovorí „1 / 3 asset-3", asset prečítaný raz. Preč: žiadna dlaždica zvýraznená, detail zatvorený, adresa
     zoznamu, nič sa nečítalo, to isté pole s napísaným a zvýraznené „Save";
   - bod 4: stránka zoznamu sa odpojí pod otvorenou otázkou (hostiteľ v teste ju zloží, ako router): príznak otázky
     v sklade je dole, nič sa nečítalo, ďalšie `askToLeaveUnsaved` otázku otvorí a nedostane hneď „zostať";
   - príprava: stránka sa pripája pod hostiteľom, ktorý ju vie zložiť; aktívne dlaždice sa čítajú z toho, čo je
     práve nakreslené; právo `dam_asset_delete`.
   - Na kóde zo snímku `OP5-D1-c1` (62 prípadov): **11 červených** (všetky nové), 51 zelených. Ohnutia
     (`scratchpad/op5d1c1-bend-run.sh`, `op5d1c1-bends.py`, výsledok `op5d1c1-final.txt`):

   | Ohnutie | Červené |
   |---|---|
   | bod 1: každý klik odkazu riadka „opúšťa" zoznam | 5 |
   | bod 1: Ctrl sa nezrkadlí | 1 (Ctrl) |
   | bod 1: Cmd sa nezrkadlí | 1 (Cmd) |
   | bod 1: Shift sa nezrkadlí | 1 (Shift) |
   | bod 1: Alt sa nezrkadlí | 1 (Alt) |
   | bod 1: tlačidlo myši sa nezrkadlí | 1 (iné tlačidlo) |
   | bod 2: zmazaný asset nechá príznak hore | 1 |
   | bod 3: ostáva index z kliku | 2 (presunutý: klik, ceruzka) |
   | bod 3: asset, ktorý v zozname nie je, ide ďalej | 2 (preč: klik, ceruzka) |
   | bod 4: odpojená stránka nechá otázku otvorenú | 1 |
   | krok znova: klik sa nepýta | 16 |
   | krok znova: ceruzka sa nepýta | 11 |
   | krok znova: klik sa pýta až po posune aktívnej dlaždice | 10 |
   | krok znova: odkaz riadka sa pýta aj pri obyčajnom kliku | 1 |

   Štyri ohnutia „krok znova" sú tie z tabuľky kroku, ktorých riadky cyklus prepísal; ostatných 22 ohnutí kroku sa
   cyklom nedotklo (ich riadky sa nemenili) a znova som ich nepúšťal.
8. `oxfmt`, `oxlint` 0; `eslint` nad súbormi cyklu (cez `tezky.sh`) 0; `lint:tsc` v CK.
9. **CK-DAM OP5-D1-c1** (`krok5-praca/vysledky/OP5-D1-c1-ck.log`) zelené: 83 súborov / 1 466 testov (CK OP5-D1
   83 / 1 455, +11), `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
10. **Záplata** `zaplata.sh OP5-D1-c1`: `krok5-praca/zaplaty/OP5-D1-c1.diff` (341 riadkov, 5 súborov:
    `AssetTableRowItem.vue`, `assetListActions.ts`, `assetDetailStore.ts`, `sidebarUnsaved.test.ts`,
    `doc/changelog/3.0.0.md`).

**Medze, ktoré ostávajú:** dvojklik (bod 5); zvýraznenie na starom indexe po novom načítaní zoznamu (bod 3); zoznam
ciest, ktoré neuložené metadáta zahodia bez otázky, platí ďalej okrem toho, že klik na „upraviť" riadka s Ctrl / Cmd
/ Shift / Alt sa už pýta.
