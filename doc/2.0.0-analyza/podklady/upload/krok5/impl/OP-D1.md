# OP-D1: štyri malé opravy admin-dam, FE-13, FE-14, FE-15, FE-17 (impl-dam-op)

Zadanie vedúceho z 12. 10.; nálezy `overenie-nalezov.md`, tabuľka „FE, admin-dam" (73, PV16-D, 56, 71 a `resetList()`).
Strom `/home/volar/projects/anzusystems/admin-dam`. TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op`.
Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu.

## Podkroky

1. **Snímok `OP-D1`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam OP-D1 doc/changelog/3.0.0.md`, hotový.
2. **Kód, testy, dôkazy** po nálezoch nižšie. Ohnutia a beh starého kódu len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP-D1`; `vitest.k3-bend.config.mts`; skripty `scratchpad/opd1-bends.py`, `opd1-bend-run.sh`, výsledok
   `scratchpad/opd1-bends.txt`). Každé ohnutie použité 1×.
3. `oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
4. **CK-DAM OP-D1** (`krok5-praca/vysledky/OP-D1-ck.log`) zelené: 73 súborov / 1 301 testov (pred krokom 1 286,
   +15), všetko čisté vrátane buildu.
5. **Záplata** `zaplata.sh OP-D1`: `krok5-praca/zaplaty/OP-D1.diff` (550 riadkov, 11 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku.

## FE-13 (nález 73): riadok s formulárom od notifikácie si ho po odpovedi dávky nechá

**Čo sa mení v kóde** (`src/domains/coreDam/asset/store/uploadQueuesStore.ts`):
- `fetchLazyAdditionalMetadata`, bežná vetva dávky: riadok, ktorý už má `canEditMetadata`, si hodnoty nechá a len
  prejde na `Uploaded` (ako vetva „súbor sa ešte spracúva"). Podmienka je na `canEditMetadata`, nie na stav, takže
  zlyhaný riadok bez formulára neskoršia dávka ďalej oživí (`lazyMetadata.test.ts`, „lets a later batch clear…").
- `failStillLoading`: riadok v stave `Loading`, ktorý už má `canEditMetadata`, prejde na `Uploaded` a nezlyhá.

**Čo sa mení pre používateľa.** Úzky súbeh: notifikácia o metadátach dá riadku hromadnej úpravy formulár, kým je
čítanie výberu ešte na ceste. Keď potom čítanie odpovie, riadok si nechá formulár aj to, čo doň používateľ napísal.
Predtým odpoveď s assetom prepísala hodnoty riadku hodnotami servera; odpoveď bez assetu alebo zlyhané čítanie
riadok zlyhali s „Metadáta sa nepodarilo načítať…". Na backend sa neposiela nič inak.

**Širší dosah podmienky (opravené po posudku).** Podmienka platí pre každý riadok s formulárom, nielen pre ten od
notifikácie. Pôvodná veta tejto poznámky, že sa odobratím a novým označením assetu nič nemení, **neplatila**
(posudok Codexu, vysoké): obe dávky hľadajú riadok podľa `assetId`, takže staršia dávka, ktorá odpovie prvá,
naplní NOVÝ riadok a dá mu formulár, a holá podmienka `canEditMetadata` potom odpoveď novšej dávky zahodila. Pred
OP-D1 vyhrala novšia odpoveď. Opravené v `OP-D2-c1` pravidlom nad základom riadku z OP-D2: riadok s formulárom
si hodnoty nechá, len keď ich používateľ zmenil (alebo sa to nedá zistiť); nedotknutý riadok odpoveď prevezme.
Podrobnosti a testy sú v `OP-D2.md`, „Cyklus 1".

**Testy** (`src/test/queue/lazyMetadata.test.ts`, 3 nové prípady, `it.each`): „keeps the form the metadata
notification gave it, and what was typed into it, when its batch then answered with the asset / answered without
the asset / failed". Falošný čas na celý prípad.
- Na kóde zo snímku: 3 z 20 červené, práve tieto.
- Ohnutie bežnej vetvy (`if (false)`): 1 červený („answered with the asset").
- Ohnutie `failStillLoading` (bez novej podmienky): 2 červené („without the asset", „failed").

## FE-14 (PV16-D): karta distribúcií po zlyhanom čítaní povie, že sa nenačítala, a ponúkne „Skúsiť znova"

**Čo sa mení v kóde** (`…/distribution/AssetDetailSidebarDistribution.vue`): miestny príznak `readFailed`
(`ref` komponentu, nie sklad). Nastaví sa v `catch` vlastného čítania, vynuluje po úspešnom vlastnom čítaní. Kým
platí a zoznam je prázdny, karta namiesto „Nie je čo zobraziť" ukáže riadok s chybou (`text-error`) a tlačidlo
`ABtnTertiary` (`data-cy="distribution-list-retry"`), ktoré volá `reloadList`.

**Odchýlka od zadania (jedna podmienka).** Príznak sa v `catch` nastaví len vtedy, keď po zlyhanom čítaní ostal
zoznam prázdny (`readFailed.value = distributionListStore.list.length === 0`), nie vždy. Dôvod: po zlyhanom
obnovení nad zoznamom s distribúciou v behu dopytovanie beží ďalej a môže neskôr úspešne prečítať prázdny zoznam;
s príznakom nastaveným vždy by karta vtedy tvrdila, že sa distribúcie nenačítali. Prípad to drží
(„says there is nothing to show when the reading behind the list it kept then finds it empty").

**Čo sa mení pre používateľa.** Karta, ktorej čítanie zlyhalo a ostal jej prázdny zoznam (prvé otvorenie, karta
ďalšieho assetu), ukáže „Distribúcie sa nepodarilo načítať." a tlačidlo „Skúsiť znova". Tlačidlo číta zoznam znova:
po úspechu ukáže riadky alebo „Nie je čo zobraziť", po ďalšom zlyhaní ostane riadok s chybou (a príde ďalšie
upozornenie). Predtým karta povedala „Nie je čo zobraziť" a nič nečítala, kým ju používateľ neotvoril znova.
Zlyhané obnovenie alebo stránkovanie nad neprázdnym zoznamom sa nemení (zoznam ostáva, bez tlačidla). Na backend:
len čítanie zoznamu po kliknutí na tlačidlo, ten istý dopyt ako pri otvorení.

**Vzhľad** (odsadenie tlačidla, farba riadku) som v prehliadači nevidel; ostáva na pohľad vlastníka.

**Testy** (`src/test/distribution/distributionListPoll.test.ts`, 6 nových prípadov, 2 upravené):
- Nový blok „the distribution tab, when the read of its opening fails", 5 prípadov: chyba namiesto „nič na
  zobrazenie" a nič sa nečíta samo; „skúsiť znova" číta a ukáže riadky; po prázdnej odpovedi „nič na zobrazenie";
  po ďalšom zlyhaní chyba ostáva (2 upozornenia); asset s prečítaným prázdnym zoznamom nemá chybu ani tlačidlo.
- Nový prípad v bloku „when a read the user asked for fails" (dopytovanie po zlyhanom obnovení nájde prázdny
  zoznam).
- **Upravený prípad s dôvodom:** „the distribution tab of the next asset… › shows the error and nothing of the
  asset before" (`:702-718` pred krokom) tvrdí navyše, že karta hovorí o zlyhanom čítaní a ponúka tlačidlo.
  Dôvod: prázdny zoznam po zlyhanom čítaní nie je odpoveď servera; text karty tento prípad doteraz nekontroloval.
  Prípad obnovenia a ďalšej strany tvrdí navyše, že nad zoznamom tlačidlo nie je.
- Karta sa v teste montuje bez textov, takže texty sú kľúče (`coreDam.distribution.common.loadFailed`,
  `common.button.retry`).
- Na kóde zo snímku: 4 z 58 červené (tri z nového bloku a upravený prípad ďalšieho assetu). Ostatné nové prípady
  sú strážcovia.
- Ohnutie „príznak sa po úspechu nenuluje": 1 červený („nothing to show once the read it was asked for answers
  with an empty list").
- Ohnutie „príznak sa nastaví vždy" (znenie zadania): 1 červený (dopytovanie nájde prázdny zoznam).

## FE-15 (nález 56): „Uložiť" pravého panela ostane zvýraznené po zlyhanom uložení

**Čo sa mení v kóde** (`…/list/components/AssetListSidebarMetadata.vue`, `onSave`): pred odoslaním si uloženie
zapamätá, či bol formulár „upravený" a ktorý objekt assetu panel drží. Skoré zrušenie príznaku ostáva (čo sa
napíše počas požiadavky, príznak nastaví znova). V `catch` sa príznak vráti (`metadataTouch`), ak bol pred
uložením nastavený a panel stále drží ten istý objekt assetu.

**Spresnenie oproti zadaniu.** „Ten istý asset je stále otvorený" porovnávam objektom, nie `id`: keď sa ten istý
asset medzitým načíta znova (`setAsset`), formulár drží čerstvé hodnoty zo servera a príznak sa nevracia. Príznak
sa nevracia ani vtedy, keď pred uložením nastavený nebol (uloženie nedotknutého formulára).

**Čo sa mení pre používateľa.** Po zlyhanom uložení z pravého panela zoznamu je „Uložiť" znova zvýraznené
(plné), ak bol formulár pred uložením upravený. Predtým vyzeralo, akoby nič neuložené nebolo. Na backend sa
neposiela nič inak.

**Testy** (`src/test/asset/bulkMetadata.test.ts`, 6 nových prípadov v bloku „from the panel on the right of the
list: its Save stands out while something is not saved"; skutočný panel, píše sa do vlastného poľa formulára):
- Na kóde zo snímku: 1 zo 68 červený („stands out again after a save that failed"). Ostatných 5 sú strážcovia.
- Ohnutie „príznak sa ruší až po uložení": 1 červený (napísané počas požiadavky).
- Ohnutie „vráť vždy" (bez `touched`): 1 červený (nedotknutý formulár).
- Ohnutie „vráť pre ktorýkoľvek asset": 2 červené (iný asset, ten istý asset načítaný znova).
- Ohnutie „porovnaj podľa `id`": 1 červený (ten istý asset načítaný znova).

## FE-17 (nález 71, `resetList()`): mŕtvy kód

- `src/plugins.d.ts`: zmazaný riadok 29 (`DefineLocaleMessage` v `declare module '@anzusystems/common-admin'`).
  Knižnica také rozhranie nemá (`grep` v `node_modules/@anzusystems/common-admin/dist`: žiadny výskyt); rozšírenie
  v `declare module 'vue-i18n'` ostalo.
- `src/domains/coreDam/asset/store/distributionListStore.ts`: zmazaná akcia `resetList()` aj jej export. Volajúci
  nie je (`grep` v `src` vrátane testov; ostatné `resetList()` patria skladom `assetListStore` a
  `externalProviderAssetListStore`).
- **`reset()` toho istého skladu:** nevolá ho nič, ani zdroj, ani testy (každé `.reset()` v `src` patrí inému
  skladu; hromadný reset skladov v aplikácii nie je). Zmazaný aj s exportom.
- Test nie je (mŕtvy kód); drží to `lint:tsc`, `eslint` a celá sada v CK.

## Zmenené súbory (10 v `src`, 1 mimo)

- `src/domains/coreDam/asset/store/uploadQueuesStore.ts`
- `src/domains/coreDam/asset/store/distributionListStore.ts`
- `src/domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue`
- `src/domains/coreDam/asset/components/list/components/AssetListSidebarMetadata.vue`
- `src/plugins.d.ts`
- `src/locales/sk/coreDam/distribution.json`, `src/locales/en/coreDam/distribution.json` (jeden kľúč)
- `src/test/queue/lazyMetadata.test.ts`, `src/test/distribution/distributionListPoll.test.ts`,
  `src/test/asset/bulkMetadata.test.ts`
- `doc/changelog/3.0.0.md` (tri položky v „Fixed": FE-13, FE-14, FE-15)

## Texty na potvrdenie

| Kľúč | SK | EN | Poznámka |
|---|---|---|---|
| `coreDam.distribution.common.loadFailed` | Distribúcie sa nepodarilo načítať. | The distributions could not be loaded. | nový |
| `common.button.retry` | Skúsiť znova | Try again | existujúci kľúč knižnice, nič nové |

Changelog cituje slovenské znenie; ak sa text zmení, treba ho zmeniť aj tam.

## Nové nálezy (neopravené)

- Detail assetu (`AssetDetailSidebarMetadata.vue`) príznak „upravené" nepoužíva vôbec: jeho „Uložiť" je vždy plné.
  Nie je to chyba kroku, len rozdiel medzi dvoma panelmi nad tým istým skladom.

## Cyklus 1 (OP-D1-c1; posudky Codex + Opus nad `zaplaty/OP-D1.diff`)

Posudky v štyroch opravách chybu nenašli a obe voľby mimo znenia zadania potvrdili (FE-14: príznak len nad
prázdnym zoznamom; FE-15: porovnanie objektu assetu). Dva úzke súbehy sú opravené tu, jeden v `OP-D2-c1` (FE-13,
odobratie a nové označenie assetu; pozri vyššie a `OP-D2.md`). Správy prišli po uzavretí OP-D2 aj OP-D3, cyklus je
preto nad stromom po `OP-D2-c1`. Snímok **`OP-D1-c1`**.

1. **FE-14, dve vlastné čítania karty naraz** (Codex stredné, Opus nízke). Novšie čítanie odpovie prázdnym
   zoznamom, potom staršie zlyhá a jeho `catch` nastavil príznak: karta tvrdila, že sa distribúcie nenačítali, nad
   zoznamom, ktorý bol prečítaný. **Oprava** (`AssetDetailSidebarDistribution.vue`): miestne počítadlo vlastných
   čítaní; zlyhané čítanie príznak nastaví, len keď je posledné začaté. Ktorá odpoveď zapíše zoznam, sa nemení
   (iný nález), ani nulovanie príznaku po každom úspešnom čítaní.
   - Test (`distributionListPoll.test.ts`): „says nothing of a read that failed after a read started later had
     answered with an empty list". Dve obnovenia po sebe, prvé sa drží a zlyhá až po odpovedi druhého: jedno
     upozornenie, „nič na zobrazenie", žiadny riadok s chybou ani tlačidlo.
2. **FE-15, dve uloženia naraz** (Codex stredné). „Uložiť" pravého panela počas uloženia len točí, takže sa dá
   spustiť druhé. Keď druhé prešlo skôr, než prvé zlyhalo, `catch` prvého vrátil „upravené", hoci posledné
   uloženie uspelo. **Oprava** (`AssetListSidebarMetadata.vue`): panel si pamätá uloženie, ktoré začalo posledné;
   príznak po zlyhaní vráti len ono. Druhé uloženie sa neblokuje.
   - **Doplnené nad zadanie, aby sa neotvorila diera:** uloženie spustené, kým iné uloženie toho istého objektu
     assetu ešte beží, prevezme jeho „upravené" (to prvé ho pri štarte zrušilo, takže druhé by ho inak nevidelo).
     Bez toho by pri dvoch zlyhaných uloženiach príznak nevrátil nikto: prvé nie je posledné, druhé „upravené"
     nevidelo. Preberá sa len pri tom istom objekte assetu.
   - Známy zvyšok: keď prvé uloženie nakoniec prejde a druhé (spustené počas neho, bez ďalšieho písania) zlyhá,
     príznak sa vráti, hoci prvé uložilo všetko. „Uložiť" je vtedy zvýraznené zbytočne; opačná chyba (nezvýraznené
     pri neuloženom) nenastane.
   - Testy (`bulkMetadata.test.ts`, blok panela zoznamu, 4 nové prípady): druhé uloženie prejde a prvé potom
     zlyhá (nezvýraznené); obe zlyhajú, v oboch poradiach (zvýraznené); zlyhané uloženie iného assetu otvoreného
     počas prvého uloženia (nezvýraznené).

**Na kóde zo snímku `OP-D1-c1`** (oba komponenty): 2 zo 131 červené, práve dva prípady z posudku.

**Ohnutia** (`scratchpad/opd1c1-bend-run.sh`, každé zvlášť nad oboma súbormi, 131 prípadov):

| Ohnutie | Červené |
|---|---|
| príznak nastaví každé zlyhané čítanie | 1 (staršie čítanie zlyhá po novšom) |
| príznak vráti každé zlyhané uloženie | 1 (druhé prešlo, prvé zlyhalo) |
| druhé uloženie „upravené" nepreberie | 2 (obe zlyhajú, obe poradia) |
| preberie sa aj od uloženia iného assetu | 1 (iný asset otvorený počas uloženia) |

`oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. **CK-DAM OP-D1-c1**
(`krok5-praca/vysledky/OP-D1-c1-ck.log`) zelené: 75 súborov / 1 346 testov (po OP-D2-c1 1 341, +5), všetko čisté
vrátane buildu. **Záplata** `zaplata.sh OP-D1-c1`: `krok5-praca/zaplaty/OP-D1-c1.diff` (177 riadkov, 4 súbory:
oba komponenty a oba testy); mimo `src` nič. Changelog sa nemenil: obe položky (FE-14, FE-15) platia v znení
z kroku.

**Bublina koša, ktorý asset z externého zdroja len vyberie z výberu** (pokyn vedúceho pre tento cyklus: použiť
existujúci kľúč „odstrániť z výberu", ak je). Taký kľúč nie je; čo je najbližšie a prečo nesedí, je v
`OP-D3.md`, „Texty na potvrdenie", bod 9. Bublina ostala „Zmazať" (`common.button.delete`), kód sa nemenil a bod
ostáva na zozname pre vlastníka.

### Nové nálezy z posudkov (neopravené, čísla pridelí vedúci)

- **(a) Karta distribúcií toho istého assetu otvorená znova so zlyhaným čítaním** nechá zoznam z predošlého
  otvorenia, bez riadku s chybou a bez „Skúsiť znova" (len upozornenie). `listOfAsset` zoznam toho istého assetu
  nenuluje (`distributionListStore.ts`), takže po zlyhaní nie je prázdny a príznak sa nenastaví.
- **(b) `DistributionManage.vue:94-104`**: po zmazaní distribúcie `emit('onDistributionDelete')` spustí nové
  čítanie zoznamu a `finally` hneď nato zhodí zdieľaný loader (`:102-103`). Čítanie po zmazaní tak beží so
  všetkým klikateľným.
- **(c) `failStillLoading` po odobratí a novom označení assetu** (Codex, mimo záplaty, staršie než OP-D1): keď
  staršia dávka naplní nový riadok a novšia dávka asset vynechá alebo zlyhá, riadok už nie je `Loading`,
  `failStillLoading` ho preskočí a formulár zo staršej odpovede ostane.
- **(d) Karta distribúcií radí len príznak zlyhania** (posudok cyklu, neopravené): staršie vlastné čítanie, ktoré
  odpovie po novšom, stále zapíše svoj zoznam a príznak vynuluje, a čítanie, ktoré skončí prvé, zhodí spoločný
  loader pod druhým.

