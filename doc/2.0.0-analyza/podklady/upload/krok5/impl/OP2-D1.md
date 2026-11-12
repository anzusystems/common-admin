# OP2-D1: štyri opravy admin-dam, FE-22 až FE-25 (impl-dam-op2)

Zadanie vedúceho z 12. 10.; nálezy `overenie-nalezov.md`, „Druhé overenie", tabuľka „FE, admin-dam" (90, 105, 91, 109).
Strom `/home/volar/projects/anzusystems/admin-dam`. TMPDIR `admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op2`.
Bash bez `cd`, nič sa nemazalo, žiadny zápis do gitu.

## Podkroky

1. **Snímok `OP2-D1`** urobil vedúci pred krokom (`doc/changelog/3.0.0.md` je v ňom).
2. **Kód, testy, dôkazy** po nálezoch nižšie. Beh starého kódu a ohnutia len v pamäti (`vitest.old.config.mts`,
   `OLD_SNAP=OP2-D1`; `vitest.k3-bend.config.mts`, oba skopírované z TMPDIR `impl-dam-op` do môjho; skripty
   `scratchpad/op2d1-bends.py`, `op2d1-bend-run.sh`, výsledok `scratchpad/op2d1-bends.txt`). Tri súbory testov,
   77 prípadov; na kóde zo snímku 15 červených.
3. `oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` nad súbormi kroku (cez `tezky.sh`) 0.
4. **CK-DAM OP2-D1** (`krok5-praca/vysledky/OP2-D1-ck.log`) zelené: 79 súborov / 1 381 testov, všetko čisté
   vrátane buildu. Pred krokom 77 / 1 363 (CK C5 mala 1 362; jeden prípad `support/fakeDam.test.ts` pribudol pred
   snímkom, súbor sa so snímkom zhoduje), krok +18.
5. **Záplata** `zaplata.sh OP2-D1`: `krok5-praca/zaplaty/OP2-D1.diff` (788 riadkov, 10 súborov); mimo `src` len
   `doc/changelog/3.0.0.md`, ktorý je v snímku.

## FE-22 (nález 90): karta toho istého assetu otvorená znova, čítanie zlyhá

**Čo sa mení v kóde** (`…/distribution/AssetDetailSidebarDistribution.vue`, `readList`): pri prvom čítaní inštancie
karty sa zoznam skladu vyprázdni (miestny príznak `opened`). `listOfAsset` ostáva (zoznam iného assetu pri
neskoršom čítaní tej istej inštancie); sklad sa nemenil.

**Čo sa mení pre používateľa.** Karta toho istého assetu otvorená znova (iná záložka a späť, nové otvorenie
detailu), ktorej čítanie zlyhá, ukáže „Distribúcie sa nepodarilo načítať." a „Skúsiť znova". Predtým ukázala
zoznam z predošlého otvorenia a len všeobecnú hlášku. Pri úspešnom čítaní sa nemení nič: počas čítania zoznam
kryje loader (vetva `v-if="distributionListStore.loader"` je v šablóne prvá, v karte aj v rozšírených
nastaveniach; drží to prípad „shows its loader and nothing else…"). Jedna výnimka (posudok Opusa, prijatá ako
medza): keď redaktor počas bežiaceho mazania distribúcie odíde z karty a otvorí kartu toho istého assetu znova,
odpoveď mazania vypne loader pod čítaním novej karty a tá do odpovede svojho čítania ukazuje „Nie je čo zobraziť"
(zoznam je vyprázdnený, príznak zlyhania nie je nastavený). Pred krokom tam bol starý zoznam. Zmizne s odpoveďou
čítania; prípad v testoch nemá.

**Dôsledok, ktorý zadanie nemenuje.** Po zlyhanom otvorení už karta nečíta na pozadí: zoznam je prázdny, takže v
ňom nie je distribúcia v behu. Predtým sa karta so starým zoznamom s distribúciou v behu opravila sama (overenie:
„Sám sa opraví len pri distribúcii v behu"). Teraz ju opraví len „Skúsiť znova". Drží to tretí prípad bloku;
changelog to hovorí.

**Testy** (`src/test/distribution/distributionListPoll.test.ts`, nový blok „the distribution tab of the same asset
opened again", 3 prípady): chyba s tlačidlom namiesto starého zoznamu a „Skúsiť znova" potom zoznam prečíta;
počas čítania otvorenia len loader, potom odpoveď (strážca); po zlyhanom otvorení sa na pozadí nečíta.
- Na kóde zo snímku: 2 červené (prvý a tretí).
- Ohnutie „nevyprázdni nikdy": 2 červené, tie isté.
- Ohnutie „vyprázdni pri každom čítaní": 3 červené, prípady z PV16-D a OP-D1 (obnovenie, ďalšia strana, dopytovanie
  nad ponechaným zoznamom). Tie ostali bez zmeny.

## FE-23 (nález 105): dve vlastné čítania karty nemajú poradie

**Čo sa mení v kóde** (ten istý súbor): karta si drží `AbortController` vlastného čítania, ktoré je na ceste
(`reading`). Nové vlastné čítanie predošlé zruší. Odpoveď zrušeného čítania nezapíše zoznam ani príznak zlyhania,
neukáže chybu a nevypne loader; stránkovanie nezapíše knižnica (`useApiFetchList`, `dist/…/useApiFetchList.js:21`:
píše len pri nezrušenom signáli). Zrušenie pri zatvorení karty je to isté (`onBeforeUnmount(() =>
reading?.abort())`); `closed` zanikol, lebo by sa už len rušil a nikto by ho nečítal. Počítadlo `ownReads` z
`OP-D1-c1` zaniklo: nezrušené čítanie je vždy posledné začaté. `duringOwnRead` a dopytovanie sa nemenili.

**Čo sa mení pre používateľa.** Staršia odpoveď už neprepíše zoznam a stránkovanie novšej (napríklad práve zmazanú
distribúciu späť do zoznamu) a nevypne loader, kým novšie čítanie beží. **Navyše viditeľné:** predbehnuté čítanie,
ktoré zlyhá, už neukáže upozornenie (je zrušené); predtým ho ukázalo, hoci zoznam bol z novšieho čítania.

**Na backend:** nič iné sa neposiela. Predbehnutá požiadavka `GET /adm/v1/distribution/asset/{id}` sa v prehliadači
zruší, namiesto aby dobehla.

**Testy** (ten istý súbor, nový blok „when it reads its list while a read of its own is still on its way", 7
prípadov; „zrušené" v oboch podobách ako inde v súbore: odmietnuté hneď, alebo odpoveď príde aj tak):
- staršie čítanie je zrušené, novšie nie;
- karta ukazuje odpoveď novšieho, aj keď staršie odpovie po ňom (2);
- loader ostáva, kým neodpovie novšie, nech sa so starším stane čokoľvek (2);
- stránkovanie ostáva podľa novšieho, keď odpoveď staršieho príde aj tak;
- dopytovanie sa po odpovedi novšieho rozbehne od začiatku rytmu (strážca `duringOwnRead`).
- **Upravený prípad s dôvodom:** „says nothing of a read that failed after a read started later had answered with
  an empty list" (z `OP-D1-c1`) čakal jedno upozornenie od staršieho čítania; teraz čaká žiadne a beží v oboch
  podobách zrušenia (2 prípady namiesto 1). Dôvod: staršie čítanie je zrušené, jeho zlyhanie už nikomu nepatrí.
- Na kóde zo snímku: 9 červených (všetkých 7 nových a oba upravené).

| Ohnutie | Červené |
|---|---|
| predošlé čítanie sa neruší | 9 (tie isté ako na kóde zo snímku) |
| odpoveď zrušeného čítania zapíše zoznam | 5 (novšia odpoveď, stránkovanie, tri prípady zatvorenej karty) |
| zlyhanie zrušeného čítania nastaví príznak a ukáže chybu | 6 |
| loader vypne aj zrušené čítanie | 4 (oba prípady loadera, dva zatvorenej karty) |
| „len posledné" bez rušenia (druhá možnosť z nálezu) | 3: signál, **stránkovanie** (píše ho knižnica), dopytovanie čaká na staršie čítanie |

Posledný riadok je dôvod, prečo sa predošlé čítanie ruší a nestačí odpoveď preskočiť.

## FE-24 (nález 91): zmazaná distribúcia sa na dobu jednej požiadavky ukáže znova

**Rodičia `DistributionManage`.** Jediný: `AssetDetailSidebarDistribution.vue:195-202` (`grep` v `src`;
`distributionListPoll.test.ts` ho nahrádza maketou). `@on-distribution-delete="reloadList"` → `getList()` → `duringOwnRead(readList)`; `readList`
loader zapne a vo `finally` vypne, ak čítanie nebolo zrušené (zatvorenie karty, novšie čítanie, ktoré ho vypne
samo). Oprava preto platí.

**Čo sa mení v kóde** (`…/distribution/forms/DistributionManage.vue`, `onDeleteDistributionItem`): `finally`
zaniklo, `hideLoader()` je v `catch`. Po úspechu loader vypne čítanie karty.

**Čo sa mení pre používateľa.** Po zmazaní v rozšírených nastaveniach ostáva loader, kým karta neprečíta zoznam
znova; zmazaná položka sa už neukáže a nedá sa na ňu kliknúť. Po zlyhanom zmazaní ako doteraz: loader zhasne,
chyba, položka ostáva. Na backend sa neposiela nič inak. Nastavenia skryté počas mazania rieši cyklus 1 (nižšie).

**Testy** (nový súbor `src/test/distribution/distributionManageDelete.test.ts`, 2 prípady; skutočná karta,
skutočné nastavenia a `AListEditor` knižnice, aplikácia cez `startUploadUi`, nahradený len `damClient`):
- po zmazaní, kým čítanie beží: dva loadery, žiadny riadok, žiadny kôš, jedno `DELETE`; po odpovedi len druhá
  distribúcia. Na kóde zo snímku červený.
- zlyhané zmazanie: chyba, loader dole, oba riadky, žiadne ďalšie čítanie (strážca).
- Ohnutie „`hideLoader()` aj po úspechu": 1 červený (prvý). Ohnutie „`hideLoader()` nie je v `catch`": 1 červený
  (druhý).

## FE-25 (nález 109): bubliny panela editora po anglicky

**Kde sú kľúče.** `LinkDialog.vue` berie texty z knižnice (`common.model.link`, `text`, `url`, `external`,
`nofollow`), kam admin-dam nepíše. Päť kľúčov je preto v `src/locales/{sk,en}/system.json`, nová časť
`system.editor` (`bold`, `italic`, `underline`, `link`, `removeLink`): v `system.json` sú texty ostatných
spoločných komponentov aplikácie (`system.imagePreview`, `system.download`). „Odkaz" / „Link" je tak dvakrát (aj
`common.model.link`).

**Čo sa mení v kóde.** `anzutap/components/anzutapToolbar.ts`: `titleT` drží kľúč. `AnzutapToolbarItem.vue`:
`useI18n`, bublina `t(item.titleT)`.

**Čo sa mení pre používateľa.** Bubliny piatich tlačidiel: sk „Tučné", „Kurzíva", „Podčiarknuté", „Odkaz",
„Odstrániť odkaz"; en ako doteraz.

**Testy** (nový súbor `src/test/a11y/editorToolbarTooltips.test.ts`, 5 prípadov; skutočný `AnzutapToolbar` nad
editorom zostaveným ako v `PodcastExportDataBodyEditor.vue`, kurzor v odkaze, aby bolo vidieť všetkých päť):
tlačidiel je päť; každý `titleT` je kľúč s textom v sk aj en (presné znenia); bublina ukáže text, nie kľúč (sk, en).
- Na kóde zo snímku: 3 červené (kľúče sk a en, bublina sk; anglická bublina sedí náhodou).
- Ohnutie „bublina ukáže `item.titleT`": 2 červené. „`titleT` natvrdo": 3. „V sk chýba text": 2.
- **Strážca `iconButtonTooltips.test.ts`** je zelený. Tlačidlo panela vidí (len ikona, `VTooltip` s
  `activator="parent"`) a vie, že bublinu má; jej text nevidí, lebo kľúč nie je v šablóne (`t(item.titleT)` jeho
  výraz `t('…')` nenájde).
- Test musí importovať rozšírenia tiptapu: bez nich `lint:tsc` v programe testov nepozná `toggleBold` a ďalšie
  (rozšírenia typov prichádzajú s modulmi rozšírení).

## Cyklus 1 (OP2-D1-c1; rozhodnutia vedúceho z 12. 10., ešte pred posudkami)

Snímok **`OP2-D1-c1`**. Vedúci potvrdil kľúče v `system.editor.*` a tiché predbehnuté čítanie; dve veci pribudli.

1. **FE-24, rozšírené nastavenia skryté počas mazania** (rozhodnutie (a)). `DistributionManage` je pod
   `v-if="showAdvancedSettings"` a tlačidlo „skryť" ostáva klikateľné aj počas `DELETE`. Keď ho používateľ stlačí,
   kým požiadavka beží, komponent sa odpojí a Vue jeho `emit` zahodí (`runtime-core`, `emit`: `if
   (instance.isUnmounted) return`): karta zoznam neprečíta a s opravou z kroku by loader zoznamu svietil natrvalo
   (overené sondou pred cyklom: 1 loader, 1 čítanie; sonda v súbore neostala).
   - **Oprava** (`DistributionManage.vue`): komponent si pri odpojení zapíše `closed`; po úspešnom zmazaní loader
     vypne sám, len keď je už odpojený. Bežná cesta sa nemení (loader vypína čítanie karty).
   - **Známy limit (prijatý vedúcim, nie nález):** v tomto prípade ostáva stav ako pred krokom. Zoznam sa
     neprečíta, zmazaná distribúcia v ňom ostane do ďalšieho čítania. To isté platí, keď sa počas mazania zatvorí
     celá karta: loader sa vypne aj vtedy, a ak medzitým číta karta ďalšieho assetu, zhasne jej pod čítaním (tak to
     robilo aj `finally` pred krokom).
   - Test (`distributionManageDelete.test.ts`): „leaves no loader on when the settings were hidden while the delete
     was on its way": `DELETE` sa drží, nastavenia sa skryjú, odpoveď príde; upozornenie o zmazaní („Record was
     removed"), žiadny loader. Prípad zapisuje aj limit (jedno čítanie, zmazaná položka ešte v zozname).
2. **FE-23, zlyhanie POSLEDNÉHO čítania sa hlási ďalej** (`distributionListPoll.test.ts`, 4 nové prípady v bloku
   dvoch čítaní, oba v oboch podobách zrušenia):
   - novšie čítanie zlyhá, staršie je zrušené: jedno upozornenie, zoznam ostáva, ani neskorá odpoveď staršieho ho
     neprepíše;
   - čítanie, ktoré predbehlo čítanie otvorenia, zlyhá: jedno upozornenie, „nepodarilo načítať" a „Skúsiť znova",
     a neskorá odpoveď čítania otvorenia to nezruší.
   Kód karty sa v cykle nemenil.

**Na kóde zo snímku `OP2-D1-c1`:** 1 z 82 červený (skryté nastavenia). **Na kóde zo snímku `OP2-D1`** (pred
krokom): 19 z 82 (15 z kroku a 4 nové prípady FE-23).

**Ohnutia** (`scratchpad/op2d1c1-bends.py`, `op2d1c1-bend-run.sh`, výsledok `op2d1c1-bends.txt`; všetkých 14 nad
konečnými testami, 82 prípadov). Nové dve a tie, ktorým pribudli červené:

| Ohnutie | Červené |
|---|---|
| odpojený komponent loader nevypne | 1 (skryté nastavenia) |
| loader sa po úspechu vypne vždy | 1 (bežná cesta) |
| zlyhanie posledného čítania je tiché | 13 (4 nové a 9 ďalších prípadov zlyhaného čítania) |
| predošlé čítanie sa neruší | 13 (9 z kroku a 4 nové) |
| odpoveď zrušeného čítania zapíše zoznam | 7 (5 a 2 nové) |
| zlyhanie zrušeného čítania nastaví príznak a ukáže chybu | 8 (6 a 2 nové) |
| zoznam sa vyprázdni pri každom čítaní | 5 (3 a 2 nové) |

Ostatné ohnutia bez zmeny (FE-22 „nikdy" 2, loader 4, „len posledné" 3, FE-24 `catch` 1, FE-25 2, 3, 2).

`oxfmt`, `oxlint` 0; `lint:tsc` a `eslint` (cez `tezky.sh`) 0. **CK-DAM OP2-D1-c1**
(`krok5-praca/vysledky/OP2-D1-c1-ck.log`) zelené: 79 súborov / 1 386 testov (po kroku 1 381, +5), všetko čisté
vrátane buildu. **Záplata** `zaplata.sh OP2-D1-c1`: `krok5-praca/zaplaty/OP2-D1-c1.diff` (154 riadkov, 3 súbory:
`DistributionManage.vue` a oba testy distribúcií); mimo `src` nič. Záplata kroku `OP2-D1.diff` ostala, ako bola.
Changelog sa v cykle nemenil.

## Zmenené súbory (9 v `src`, 1 mimo)

- `src/domains/coreDam/asset/components/detail/components/distribution/AssetDetailSidebarDistribution.vue`
- `src/domains/coreDam/asset/components/detail/components/distribution/forms/DistributionManage.vue` (aj cyklus 1)
- `src/domains/coreDam/shared/components/anzutap/components/anzutapToolbar.ts`
- `src/domains/coreDam/shared/components/anzutap/components/AnzutapToolbarItem.vue`
- `src/locales/sk/system.json`, `src/locales/en/system.json`
- `src/test/distribution/distributionListPoll.test.ts` (59 → 70 prípadov, po cykle 74)
- `src/test/distribution/distributionManageDelete.test.ts` (nový, 2, po cykle 3)
- `src/test/a11y/editorToolbarTooltips.test.ts` (nový, 5)
- `doc/changelog/3.0.0.md` (tri položky v „Fixed" → „Distributions tab", jedna za položkou o bublinách tlačidiel)

## Nové nálezy (neopravené)

- **„Odstrániť odkaz" sa takmer nikdy neukáže (vedúci zapísal ako nález 116).** `AnzutapToolbar.vue:33-43` rozhoduje o tlačidlách raz, pri
  pripojení (`item.show()`); `removeLink` žiada kurzor v odkaze (`anzutapToolbar.ts:71`), a ten tam pri otvorení
  dialógu je len vtedy, keď text odkazom začína. Staršie než tento krok; v prehliadači som to nevidel.
