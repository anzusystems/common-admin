# PV16-D: dopytovanie distribúcií zapisuje len prvé zo zlyhaní v rade (impl-dam)

Plán 2.9, riadok „PV16-D" (`:1108`); jadro 5.2 PV16, možnosť (a); `analyzy/ostatne-otvorene-nalezy.md` (bod mimo plánu
DAM 1-3, bod 3, „opraviť s PV16"); krok LIB `impl/PV16-L.md` (voľba `report` v `useApiFetchList`, v kópii od C3). Strom
`/home/volar/projects/anzusystems/admin-dam` (po C3). TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam`. Bash
bez `cd`, nič sa nemazalo.

## Podkroky

1. **Snímok `PV16-D`**: `bash /home/volar/projects/anzusystems/krok5-praca/nastroje/snimok.sh
   /home/volar/projects/anzusystems/admin-dam PV16-D`, hotový. Mimo `src` nič.
2. **Kód:**
   - `D/asset/composables/distributionListPoll.ts`: `read` dostáva druhý parameter a dopytovanie volá
     `read(current.signal, failures === 0)`. Prvé zlyhanie v rade sa zapíše, ďalšie nie. Po úspešnom čítaní alebo po
     novom rozbehu sa `failures` nuluje a ďalšie zlyhanie sa zapíše znova.
   - `AssetDetailSidebarDistribution.vue`: karta `report` prepošle do `fetchAssetDistributionList`.
   - `D/asset/api/distributionApi.ts`: `fetchAssetDistributionList(…, signal?, report?)` pošle `report` do `execute`
     knižničného `useApiFetchList`. Bez neho (vlastné čítania karty) sa zapisuje ako doteraz.
   - `AssetDetailSidebarDistribution.vue`, `readList`: **`resetList()` na začiatku vlastného čítania karty**.
     Zoznam je spoločný s kartou predošlého assetu. Počas čítania ho karta skrýva za loaderom; pri zlyhanom čítaní
     pod chybou ostal a ukázal distribúcie predošlého assetu. Čítanie dopytovania zoznam pri zlyhaní ďalej necháva.
     **Zmenené v cykle 1:** nuluje sa len zoznam iného assetu, pozri „Cyklus 1".
3. **Testy** (`DT/distribution/distributionListPoll.test.ts`, dva nové prípady v kroku a dva v cykle 1, spolu
   štyri):
   - „has the first of its reads that fail in a row written down, and none after it until one succeeds".
     Zapisovač chýb API knižnice (`setApiErrorLogger`) sa zavolá raz pri prvom zlyhanom čítaní dopytovania, pri
     ďalších dvoch nie. Po čítaní, ktoré prešlo, sa ďalšie zlyhanie zapíše znova (spolu 2). Upozornenie sa
     neukáže. Zapisovač sa po každom prípade vráti na predvolený.
   - „the distribution tab of the next asset, when the read of its opening fails › shows the error and nothing of
     the asset before". Karta ďalšieho assetu nad tým istým skladom, jej čítanie zlyhá: jedno upozornenie, žiadne
     riadky, prázdny zoznam, loader dole.
4. **Dôkazy** (`pv16-bend-run.sh`, nad súborom s 50 prípadmi; každé ohnutie použité 1×):
   - Dopytovanie podá vždy `true`: 1 červený, prípad zapisovania.
   - Karta `report` neprepošle: 1 červený, ten istý.
   - API `report` nepošle do `execute`: 1 červený, ten istý.
   - Bez `resetList()`: 1 červený, prípad ďalšieho assetu.
   - **Tri súbory zo snímku** (`vitest.old.config.mts`, `OLD_SNAP=PV16-D`): 2 z 50 červené, oba nové prípady.
5. `oxfmt`, `oxlint` 0; `eslint` a `lint:tsc` (cez `tezky.sh`) 0; `DT/distribution` 69/69.
6. **CK-DAM PV16-D** (`krok5-praca/vysledky/PV16-D-ck.log`) zelené: 73 súborov / 1 284 testov (po C3 1 282, +2),
   všetko čisté vrátane buildu. **Záplata** `zaplata.sh PV16-D`: `krok5-praca/zaplaty/PV16-D.diff` (153 riadkov,
   4 súbory); mimo `src` a `doc` nič.

## Cyklus 1 (PV16-D-c1; rozhodnutie vedúceho, posudok Codexu: vysoké)

Nulovanie pri každom vlastnom čítaní (pôvodná verzia kroku) bolo viditeľné zhoršenie. Malo tri účinky, ktoré
poznámka pôvodne neuvádzala celé:
- Zlyhané obnovenie toho istého assetu ukázalo chybu a prázdny zoznam (ďalej nižšie).
- Stránkovanie je v šablóne vo vetve neprázdneho zoznamu, takže po zlyhanej ďalšej strane zmizlo aj ono a
  používateľ sa nemal ako vrátiť.
- Po každom úspešnom zmazaní distribúcie zoznam medzi dvoma čítaniami ukázal „žiadne položky": loader po zmazaní
  schová `DistributionManage.vue` skôr, než dobehne opätovné čítanie, a zoznam už bol vynulovaný.

Zlyhané obnovenie toho istého assetu ukázalo chybu a prázdny zoznam. **Dopytovanie sa tým zastavilo:** beží len dovtedy, kým je v zozname distribúcia v behu
(`distributionListPoll.ts`, `underWay`), takže prázdny zoznam sa neobnovil ani po zotavení servera. Účel rozhodnutia
je len „pod chybou čítania nesmie byť zoznam predošlého assetu". Snímok **`PV16-D-c1`**.

1. **Kód:**
   - `D/asset/store/distributionListStore.ts`: sklad si pamätá, ktorého assetu zoznam je (`listAssetId`). Nová
     `listOfAsset(assetId)` zoznam vyprázdni, len keď je iného assetu. `reset()` nuluje aj `listAssetId`.
   - `AssetDetailSidebarDistribution.vue`: `readList` volá `listOfAsset(props.assetId)` namiesto `resetList()`.
     Pri obnovení a stránkovaní toho istého assetu zoznam ostáva.
2. **Testy** (`distributionListPoll.test.ts`):
   - Nový blok „the distribution tab, when a read the user asked for fails", dva prípady (obnovenie, ďalšia strana).
     Zlyhané čítanie ukáže chybu a nechá plnú stranu 25 riadkov. Dopytovanie beží ďalej a po zotavení servera ukáže,
     čo prišlo.
   - Prípad ďalšieho assetu z kroku ostáva bez zmeny.
3. **Dôkazy** (`pv16c1-bend-run.sh`, 52 prípadov):
   - Ohnutie „nuluj vždy": 2 červené, oba nové prípady.
   - Ohnutie „nenuluj nikdy": 1 červený, prípad ďalšieho assetu.
   - **Kód PV16-D zo snímku** (sklad a karta): 2 z 52 červené, oba nové prípady.
4. **Prvý `lint:eslint` bol červený:** `pinia/require-setup-store-properties-export` žiada každý stav skladu vo
   vrátenom objekte. `listAssetId` je doplnený do `return` a `eslint` je 0. `oxfmt`, `oxlint` a `lint:tsc` (cez
   `tezky.sh`) 0; `DT/distribution` 71/71.
5. **Mimo kroku** (nemenené, vedúci zapisuje ako nález 87):
   - (Codex) Vlastné čítania karty nemajú stráž poradia. Neskorá staršia odpoveď môže nahradiť zoznam novšej
     stránky.
   - (Opus) `DistributionManage.vue:94-103`: `finally` po zmazaní distribúcie schová zdieľaný loader, kým
     opätovné čítanie zoznamu ešte beží.
6. **CK-DAM PV16-D-c1** (`krok5-praca/vysledky/PV16-D-c1-ck.log`) zelené: 73 súborov / 1 286 testov (po PV16-D
   1 284, +2), všetko čisté vrátane buildu. **Záplata** `zaplata.sh PV16-D-c1`: `krok5-praca/zaplaty/PV16-D-c1.diff`
   (105 riadkov, 3 súbory); mimo `src` a `doc` nič.

Zmenené súbory v cykle: `distributionListStore.ts`, `AssetDetailSidebarDistribution.vue`,
`distributionListPoll.test.ts`.

## Zmenené súbory (5 s cyklom 1, všetky v `src`)

- `src/domains/coreDam/asset/composables/distributionListPoll.ts`
- `src/domains/coreDam/asset/api/distributionApi.ts`
- `src/domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue`
- `src/domains/coreDam/asset/store/distributionListStore.ts` (cyklus 1)
- `src/test/distribution/distributionListPoll.test.ts`

## Čo sa mení pre používateľa

- Nič viditeľné pri dopytovaní. Opakované zlyhania čítania zoznamu distribúcií na pozadí už nezaplnia zapisovač chýb
  API (konzola); zapíše sa len prvé v rade.
- Karta distribúcií otvorená pre iný asset, ktorej čítanie zlyhá, ukáže chybu a prázdny zoznam. Predtým pod
  chybou ostali distribúcie predošlého assetu. Po takom zlyhanom prvom čítaní sa už nič nečíta znova: v prázdnom
  zozname nie je distribúcia v behu, takže dopytovanie nebeží, a používateľ musí kartu načítať sám.
- Zlyhané obnovenie alebo stránkovanie toho istého assetu nechá jeho zoznam, ako pred krokom (od cyklu 1).
  Dopytovanie na pozadí preto beží ďalej a zoznam sa po zotavení servera obnoví sám.

## Odchýlky, nálezy

- Prvá verzia nulovala zoznam pri každom vlastnom čítaní karty, ako hovorí plán. Otázku som dal vedúcemu; ten
  spolu s posudkom Codexu rozhodol, že je to viditeľné zhoršenie, a opravil to cyklus 1.
- Nové nálezy: žiadne. Ohnutia a beh starého kódu len v pamäti, nič mimo `src`.
