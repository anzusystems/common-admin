# OP8-D1: admin-dam, nálezy 227, 221, 217, 216, 220, 225, 226, 228, 218 a 219 (impl-dam-op8)

Zadanie `krok5-praca/zadania/zadanie-OP8-D1.md`, pravidlá `PRAVIDLA.md`; nálezy `register-zblizeni.md`, časť 8;
228 doplnil vedúci správou po prvom hlásení (druhé čítanie `impl/posudky/overenie12-codex.md`).
Strom `/home/volar/projects/anzusystems/admin-dam`, vetva `next`, HEAD `e96e24db`, čistý. TMPDIR
`admin-dam/node_modules/.cache/vitest-tmp-impl-dam-op8`, pracovný priečinok `krok5-praca/pracovne/impl-dam-op8/`.
Nič sa nemazalo, žiadny zápis do gitu, knižnica ani texty prekladov sa nemenili. **V prehliadači som nevidel nič
z tohto kroku.** Cesty sú voči `admin-dam/src`; `A/` = `domains/coreDam/asset/`, `D/` = `A/components/detail/`,
`EP/` = `domains/coreDam/externalProvider/`. Čísla riadkov platia pre strom po kroku.

## Podkroky

1. **Snímok `OP8-D1`** (`snimok.sh … OP8-D1 doc/changelog/3.0.0.md`), hotový pred prvou úpravou.
2. **Testy a dôkazy.** Starý kód a ohnutia len v pamäti (`vitest.old.config.mts` s `OLD_SNAP=OP8-D1`,
   `vitest.k3-bend.config.mts`; skopírované z TMPDIR `impl-dam-op7c`). Skripty a výsledky v pracovnom priečinku:
   `t.sh`, `old.sh`, `oldfiles.sh`, `bends.py`, `bend-run.sh`, `bends/vysledok.txt`, `log/`.
   **Osem nových súborov testov, 46 prípadov, nad zdrojmi snímku (17 produkčných súborov kroku) 34 červených.**
   Štyri existujúce súbory zmenené (11 prípadov, z nich 8 na snímku červených; zoznam nižšie). **Ohnutí 21, všetky
   červené** (`bends.py` 19, `bends228.py` 2).
3. `oxfmt`, `oxlint`, `eslint` nad súbormi kroku: 0 (`fmt.sh`, eslint cez `tezky.sh`).
4. **CK-DAM `OP8-D1`, obe časti zelené nad konečným stromom (po 228):** `vysledky/OP8-D1-testy.log` 117 súborov /
   1 841 testov (C11: 109 / 1 795; +8 súborov a +46 prípadov tohto kroku); `vysledky/OP8-D1-linty.log`: `generate:dts`, `lint:tsc`,
   `format:check`, `oxlint`, `eslint`, `stylelint` aj build čisté.
5. **Záplata** `zaplaty/OP8-D1.diff`: 3 177 riadkov, 30 súborov (17 produkčných, 12 testov, changelog); mimo `src` len
   `doc/changelog/3.0.0.md` (je v snímku).

## Skupina A

### 227: asset vytvorený prázdny a jeho prvý súbor

**Kód.**
- `A/store/uploadQueuesStore.ts:269-290`, hook `onAssetRead`: do detailu už nič nepíše (preč je zápis
  `assetDetailStore.asset.mainFile = asset.mainFile`). Pri každom čítaní assetu, ktoré má hlavný súbor, povie skladu
  detailu id assetu, id súboru a jeho stav (`fileStatusOnServer`).
- `A/store/assetDetailStore.ts:203-225`, `fileStatusOnServer` (nahrádza `mainFileProcessed`): stránka detailu sa
  dozvie (tiché čítanie FE-89, `tellPage`), keď sklad drží ten asset **bez hlavného súboru** (v akomkoľvek stave
  súboru), alebo s týmto súborom ako hlavným v inom stave, než v ktorom ho server skončil (`FILE_ENDED`, `:10-14`:
  `processed`, `failed`, `duplicate`). Odloženie za bežiace čítanie a `forgetLastFetched` ako doteraz.
- `D/composables/assetDetailFileChange.ts:58-72`, `formMayBeOlder(held, read)` (použité v `:116` namiesto
  `metadataMayStillChange(held)`): pri tichom prevzatí s napísaným sa „Uložiť" zadrží (`saveHeldBack`) pre asset bez
  hlavného súboru len vtedy, keď odpoveď prináša prvý súbor už spracovaný a asset nie je opísaný. Prvý súbor ešte na
  ceste drží „Uložiť" svojím stavom a pri jeho spracovaní príde ďalšia správa, ktorá zadrží podľa
  `metadataMayStillChange(held)` ako pri FE-89.

**Čo vidí používateľ.** Po spracovaní prvého súboru (notifikácia, poll, čítanie po notifikácii, tlačidlo obnovenia
riadka) sa asset prečíta bez loadera v detaile, v paneli aj na stránke assetu. Bez napísaného je formulár ten, ktorý
server vyplnil zo súboru, „Uložiť" voľné. S napísaným ostáva to isté pole s napísaným, berie sa len hlavný súbor
a „Uložiť" je zadržané textom „Súbor sa ešte spracúva…" až do celého prečítania (text hovorí o spracúvaní aj po ňom,
tak ako c1-1 z OP6-D2). Prvý súbor ešte na ceste: karta ho ukáže a „Uložiť" je zadržané ako doteraz. Prvý súbor
zlyhaný alebo duplikát: „Uložiť" voľné, karta to povie (225). **Na backend:** jedno `GET /adm/v1/asset/:id` navyše,
keď prvý súbor príde (pri notifikácii a čítaní fronty naraz môžu odísť dve, berie sa posledné, ako pri FE-89).

**Rozhodnutie.** Hook neposiela do detailu súbor ani vtedy, keď je prvý súbor ešte na ceste (čítanie aj vtedy): jedna
cesta pre každú zmenu hlavného súboru, a čítanie berie aj tri prepínače a stav assetu, ktoré zápis súboru nebral.

**Testy.** Nový `src/test/list/detailFirstFile.test.ts` (11; skutočný poslucháč notifikácií, riadok slotu v fronte):
bez napísaného v detaile, paneli a na stránke assetu (3), s napísaným v detaile a paneli (2), len čítanie fronty (1),
prvý súbor zlyhaný pod napísaným (1), prvý súbor na ceste a potom zlyhaný pod napísaným (1); strážcovia: prvý súbor
na ceste a potom spracovaný bez napísaného (1) a s napísaným (1), súbor iného assetu (1). Na snímku 8 červených.

| Ohnutie | Červené |
|---|---|
| hook zapíše súbor do detailu ako doteraz | 1 (len čítanie fronty) |
| asset bez hlavného súboru nie je správa | 10 |
| prvý spracovaný súbor nezadrží „Uložiť" | 2 (oba s napísaným) |

### 221: kôš riadka fronty hromadnej úpravy

**Kód.** `A/components/queue/AssetQueueItemEditable.vue:117-137`, `remove`: po úspešnom `DELETE` vyberie riadok
priamo zo skladu fronty (namiesto udalosti `removeItem`, ktorú `AssetQueueEditable.vue` už nemá), potom
`assetListStore.setDeletingById(assetId)` a pri drženom assete `assetDetailStore.setDeleting()`: to isté ako
`D/components/AssetDetailDialog.vue:57-61`, bez zatvárania dialógu. `A/components/list/components/AssetListSidebarMetadata.vue:132,207`:
„Uložiť" panela je vypnuté pre asset v stave `deleting`.

**Čo vidí používateľ.** Dlaždica zmazaného assetu má ikonu koša (ako po zmazaní v detaile); panel, ktorý asset drží,
ukáže „Čoskoro bude zmazaný.", „Uložiť" je vypnuté a napísané sa pri odchode nepýta. Riadok zmizne z fronty aj
vtedy, keď bola fronta počas `DELETE` schovaná (doteraz ostal: udalosť odpojeného komponentu). Platí aj pre riadky
fronty uploadu na celú obrazovku (ten istý komponent). **Navyše:** „Uložiť" panela je vypnuté aj po zmazaní v detaile
(doteraz zapnuté; zadanie: „panel nenúka uloženie zmazaného assetu"). Zlyhané zmazanie nemení nič.

**Testy.** Nový `src/test/list/queueRowDelete.test.ts` (4): kôš riadka hromadnej úpravy (1), to isté so schovanou
frontou (1), zmazanie v detaile a panel (1); strážca: zlyhané zmazanie (1). Na snímku 3 červené.
Ohnutia: „nikomu nepovie" 2, „Uložiť zmazaného ponúknuté" 3.

## Skupina B

### 217 a 216: zoznam externého poskytovateľa

**Kód** (obdoba FE-61 a FE-82 zo zoznamu DAM, `A/store/assetListStore.ts`):
- `EP/store/externalProviderAssetListStore.ts`: `activeAssetId`, `activeAssetIsAwaited` (`:20-26`), `restoreActive`
  (`:44-52`); `setList` index zruší a dlaždicu obnoví (`:102-104`), `appendList` obnoví (`:77`); `setActiveByIndex`
  zapíše id a pri starom indexe za koncom zoznamu nespadne (`:134-138`); `setActiveNext` bez aktívnej → 0 (`:144`);
  `resetList` ruší index, `reset` aj id.
- `EP/composables/externalProviderAssetListActions.ts`: `shownInPanel` (`:76`) do `setList`/`appendList`;
  `neighbourOfActive` počíta bez aktívnej od −1 (`:317`); `listMounted` volá `reset()` (`:415`).

**Čo vidí používateľ.** Po filtri, „Zrušiť filter", hľadaní a „Znovu načítať zoznam" je aktívna dlaždica assetu na jej
novom mieste, šípky idú od nej; bez assetu v zozname nie je aktívna žiadna a klik na hocijakú ju zvýrazní a asset
prečíta (po kratšom zozname klik dlaždicu zvýraznil a asset neprečítal, chyba v konzole); asset v ďalšej strane sa
zvýrazní, kým ho panel ukazuje. → bez aktívnej dlaždice vyberie prvú (doteraz druhú; v zozname s jedným nič), ← nič.
**Navyše:** „Nahrať do ADAM" panela a detailu berie asset aktívnej dlaždice: po novom zozname doteraz nahral asset na
starom mieste (iný, než ukazuje panel); teraz asset dlaždice, a bez aktívnej dlaždice nerobí nič (ako doteraz, keď bolo
staré miesto za koncom zoznamu). Vstup na stránku poskytovateľa začína bez aktívnej dlaždice.

**Testy.** Nový `src/test/list/externalProviderActiveTile.test.ts` (9; skutočná stránka poskytovateľa, strany podľa
`offset`, `IntersectionObserver` náhrada ako v `activeTile.test.ts`): 217 štyri, 216 tri a strážca ← (1), 220 jeden.
Na snímku 8 červených. Existujúce súbory poskytovateľa (`externalProviderWalk`, `…List`, `…Detail`, `…NewTab`,
`…SelectedRow`, `…Import`, `…ImportLimit`) bez zmeny zelené.

| Ohnutie | Červené |
|---|---|
| 217: `setList` nechá index (bez obnovy) | 4 |
| 217: ďalšia strana neobnoví | 1 |
| 216: sklad ide od druhej | 2 |
| 216: sused sa počíta od prvej | 1 (zoznam s jedným assetom) |

Poistka `oldActiveIndex in list.value` nemá ohnutie: `setList` index ruší, takže starý index za koncom sa k nej dnes
nedostane (rovnako ako v sklade DAM).

### 220

`EP/components/ExternalProviderAssetListView.vue:186`: riadok `{{ externalProviderFooterViewSelected }}` je preč. Nad
frontou uploadu aj výberom na celú obrazovku už nestojí „hidden", „compact" ani „full". Prípad v
`externalProviderActiveTile.test.ts` (1, na snímku červený), ohnutie „slovo späť" 1.

## Skupina C

### 225: zlyhaný a duplicitný hlavný súbor

**Po cykle c1 inak:** zlyhaný súbor pod napísaným „Uložiť" nepustí (c1-1); „Prečo Uložiť voľné" nižšie platí len pre
duplikát.

**Kód.** `domains/system/composables/appNotificationListeners.ts:36,41,50`: notifikácie `asset_file_processed`,
`asset_file_failed` aj `asset_file_duplicate` volajú `fileStatusOnServer` so svojím stavom; hook fronty tiež (227).
`formMayBeOlder` (`D/composables/assetDetailFileChange.ts:70`): ten istý hlavný súbor skončený `failed` alebo
`duplicate` „Uložiť" nezadrží.

**Prečo „Uložiť" voľné aj s napísaným** (čítaním core-dam-bundle): duplikát sa zistí v `store()` pred uložením
a spracovaním (`AbstractAssetFileStatusFacade.php:226-236`, `:268-275`, `toDuplicate`), metadáta sa nevypĺňajú a asset ostáva
(`draft`); zlyhanie v `process()` vráti transakciu aj s metadátami (`:299-316`). Server teda zo súboru nič nevyplnil
a formulár nie je starší než jeho metadáta.

**Čo vidí používateľ.** Detail, panel a obe stránky detailu sa po zlyhaní alebo duplikáte hlavného súboru prečítajú
bez loadera; karta ukáže „Spracovávanie súboru zlyhalo." alebo „Hlavný súbor je duplikát.", „Uložiť" je voľné bez
textu. S napísaným ostáva pole s napísaným a „Uložiť" je voľné, okrem prípadu, keď bolo zadržané už predtým pre iný
hlavný súbor prevzatý pod napísaným (príznak `saveHeldBack` sa nezhadzuje). **Na backend:** jedno `GET` assetu navyše.

**Testy.** Nový `src/test/list/detailFileEnded.test.ts` (7): zlyhanie a duplikát v detaile (2), panel s napísaným (1),
obe stránky (2), čítanie fronty (1); strážca: súbor iného slotu a iného assetu (1). Na snímku 6 červených.

| Ohnutie | Červené |
|---|---|
| poslucháč zlyhanie a duplikát nepovie | 5 |
| koniec spracovania je len `processed` | 6 |
| zlyhaný súbor zadrží „Uložiť" | 2 (aj prvý súbor v `detailFirstFile`) |

### 228: čítanie zoznamu a hromadnej úpravy povie detailu stav hlavného súboru

**Kód.** `A/store/assetDetailStore.ts:228-237`, `mainFileOfRead(asset)`: pri hlavnom súbore v konečnom stave
(`FILE_ENDED`: `processed`, `failed`, `duplicate`) volá `fileStatusOnServer` ako notifikácia; o tom, či sa detail niečo
dozvie, rozhodujú kontroly id assetu, id súboru a stavu v ňom (iný asset, iný súbor, súbor držaný v tom istom stave:
nič, žiadne čítanie). Volá ho dávka hromadnej úpravy (`A/store/uploadQueuesStore.ts:558-560`, po zápise riadkov
`fetchLazyAdditionalMetadata`) a zoznam DAM pri prijatej prvej aj ďalšej strane
(`A/components/list/composables/assetListActions.ts:171,230`). Nekonečný stav (súbor ešte na ceste) sa z týchto čítaní
neposiela, ani pre asset bez hlavného súboru (227 tam ostáva na notifikácii a čítaniach fronty).

**Čo vidí používateľ.** Panel (aj detail) s „Uložiť" zadržaným pre súbor na ceste sa po „Znovu načítať zoznam", filtri,
rolovaní na ďalšiu stranu alebo výbere dlaždice do hromadnej úpravy, ktoré prinesú súbor spracovaný (zlyhaný,
duplikát), prečíta potichu ako po notifikácii: bez napísaného nový formulár a voľné „Uložiť", s napísaným ako FE-89
a 225. Funguje to aj pre súbor, ktorý nahral niekto iný (notifikácia ide len tomu, kto nahrával). **Na backend:** jedno
`GET` assetu, len keď sa niečo zmenilo.

**Testy.** Nový `src/test/list/detailFileProcessedByReads.test.ts` (3): zoznam načítaný znova (1), výber do hromadnej
úpravy (1), zoznam so súborom v tom istom stave (na ceste aj spracovaný) nečíta nič (1). Na snímku 3 červené; tretí je
strážca „žiadne čítanie navyše", na snímku červený preto, že potrebuje, aby sa detail medzitým dozvedel o spracovaní
(jeho prvá polovica, zoznam so súborom na ceste, je zelená aj na snímku).

| Ohnutie | Červené |
|---|---|
| čítania nepovedia nič | 3 |
| číta sa aj pri súbore držanom v tom istom konečnom stave | 1 (strážca) |

### 226: dialóg výberu z distribúcie zavretý počas ukladania

**Kód.** `D/components/AssetDetailSidebarImagePreviewFromDistributionDialog.vue:30,79`: funkcia
`afterSuccessfulConfirm` v props namiesto udalosti. `D/components/AssetDetailSidebarImagePreview.vue:85-93,161`: karta ju
podá; číta súbor len kým je pripojená a ukazuje ten súbor (karta zaniknutá medzitým nečíta, nová si súbor prečíta sama).

**Čo vidí používateľ.** Po „Potvrdiť" a „Zrušiť" počas ukladania príde hláška a karta ukáže nový náhľad (doteraz starý
až do nového nakreslenia). **Testy.** Nový `src/test/list/previewFromDistributionClosed.test.ts` (2; jeden strážca:
zlyhané uloženie nič nečíta). Na snímku 1 červený. Ohnutie „funkcia sa po odpojení dialógu nezavolá" 1.

### 218: „Stiahnuť" v menu riadka slotu

**Kód.** `A/composables/assetInNewTab.ts:18-54`: mechanizmus FE-81 (karta pri stlačení prázdna, `opener = null` hneď,
`whileEmpty`, zavretie s odchodom stránky cez `pagehide`, `show`/`close`) je vybratý do exportovanej
`openTabForAddress()` a berie adresu; `openTabForAsset` (`:68-73`) je jeho obal s adresou stránky assetu (správanie
FE-81 bez zmeny, `externalProviderNewTab.test.ts` zelený). `D/components/slots/AssetSlotListItem.vue:103-116`: karta pri
stlačení, po odpovedi `show(res.link)`, pri zlyhaní `close()` a hláška.

**Čo vidí používateľ.** Karta sa otvorí hneď pri stlačení (prázdna), stránka úložiska nemá prístup k aplikácii, po
odpovedi ide karta na súbor; pri zlyhaní sa zavrie a príde hláška ako doteraz. Kartu, ktorú používateľ medzitým zavrel
alebo odviedol, aplikácia nechá. **Testy.** Nový `src/test/list/slotDownloadTab.test.ts` (3), na snímku 3 červené
(strážca odvedenej karty padá na snímku tiež: karta pri stlačení nie je). Zmenený prípad `detailFileActions.test.ts`
„says that the address of the file of a slot could not be had…" (náhrada `window.open` dáva kartu; tvrdí kartu pri
stlačení, zatvorenú po zlyhaní a poslanú na adresu po úspechu). Ohnutia: „karta si nechá `opener`" 1, „karta sa po
zlyhaní nezatvorí" 1.

## Skupina D: 219, časť admin-dam

**Kód.** `domains/system/views/composables/loginActions.ts:27`: `window.location.replace('/')`.
`domains/system/views/components/LoginFormSso.vue:14-18,27`: `onPress` na tlačidle s `:href`: stlačenie ľavým
tlačidlom bez Ctrl, Cmd, Shift a Alt zruší predvolenú akciu a volá `window.location.replace(url)`; iné stlačenie ostáva
odkazu (nová karta či okno). Prostredné tlačidlo `click` v prehliadači nevyvolá (je to `auxclick`); `button !== 0` je
poistka. `currentUser.ts` a `pages/logout.vue` bez zmeny.

**Testy.** Nový `src/test/router/signInHistory.test.ts` (7; `location.replace` a nastavenie `href` sú náhrady, okno nikam
nejde): prihlásenie formulárom (1), odmietnuté prihlásenie (strážca), stlačenie odkazu (1), Ctrl / Cmd / Shift /
prostredné tlačidlo (4 strážcovia). Na snímku 2 červené. Ohnutia: „formulár pridá záznam" 1, „odkaz nenahrádza" 1,
„klávesy sa neberú" 4.

**Späť po odhlásení a novom prihlásení, keď sú oba kroky** (čítaním kódu; `ALogoutView` po OP8-L1 robí
`window.location.replace(logoutUrl())`, overené v `common-admin/src/domains/ui/view/components/ALogoutView.vue`;
admin-dam ho dostane s ďalšou kópiou knižnice, jeho `node_modules` má ešte staré `href`):
- Odhlásenie z menu (`CurrentUserDropdown`, odkaz routera, `push`): `[…, P, /logout]`; `/logout` nahradí svoj záznam
  adresou odhlásenia core-dam: `[…, P, <odhlásenie>]`. Kam server pošle ďalej, je mimo aplikácie; presmerovanie záznam
  nahrádza, takže pri návrate na `/login` aplikácie `[…, P, /login]`.
- Vynútené odhlásenie (`currentUser.ts`, `pathname = '/logout'`) pridá `/logout` za P a pokračuje rovnako: P ostáva.
- Prihlásenie formulárom: `replace('/')` → `[…, P, /]`, štart aplikácie presmeruje prvú navigáciu na zoznam cez
  `replace` (`appInitialize.ts:143-145`, prvá navigácia vue-routera) → `[…, P, /assets]`. **Späť vedie na P**, stránku pred
  odhlásením, prihlásenému používateľovi. Pred oboma krokmi: `[…, P, /logout, /login, /assets]` (Späť ukázal formulár,
  druhé Späť odhlásilo); len s D1 bez L1 by Späť skončilo na `/logout` a odhlásilo.
- Prihlásenie cez SSO: tlačidlo nahradí `/login` adresou `…/auth/login` core-dam, tá presmeruje na službu; čo služba
  pridá do histórie (odoslanie jej formulára je zvyčajne nový záznam), je mimo kódu: Späť z aplikácie môže skončiť na
  stránke služby, nie na `/login` aplikácie.
- Prvé prihlásenie bez odhlásenia: vstup na X neprihlásený → prvá navigácia presmeruje na `/login` (nahradí X), formulár
  `/login` nahradí → Späť vedie pred X.

## Zmenené existujúce prípady

1. `src/test/queue/slotUploadWithoutSocket.test.ts` (227): „gives the open detail of the asset its main file" →
   „tells the page of the open detail of the asset, which reads it for its main file" (stránka zapísaná cez
   `tellPageBy`, tvrdí, že sa jej povie a do detailu sa nič nezapíše); dva strážcovia toho bloku majú stránku navyše
   a tvrdia, že sa jej nič nepovie.
2. `src/test/queue/notificationSettlesQueue.test.ts` (227): dva prípady „gives the open detail … its main file" →
   „tells the page of the open detail …"; dva strážcovia so stránkou navyše.
3. `src/test/appInitialize/appNotificationListeners.test.ts` (225): náhrada skladu `fileStatusOnServer`; „tells the detail
   of a processed file" tvrdí aj stav; „carries it for a failed file" / „… duplicate" tvrdia, že sa detailu povie
   (doteraz, že nie). Nezmenený „carries the file id of a processed file" je na snímku červený len pre premenovanú
   náhradu skladu.
4. `src/test/list/detailFileActions.test.ts` (218): jeden prípad, opísaný vyššie.

## Medze

- 227: pre asset držaný bez hlavného súboru je správou každá notifikácia spracovania alebo zlyhania ktoréhokoľvek jeho
  súboru, a od 228 aj zoznam či dávka hromadnej úpravy, ktoré ho prinesú s hlavným súborom v konečnom stave (číta sa,
  kým asset hlavný súbor nemá). Pod napísaným ostáva text „Súbor sa ešte spracúva…" aj po spracovaní.
- 221: druhé stlačenie koša počas bežiaceho `DELETE` pošle druhé zmazanie (staršie, bez zmeny). „Uložiť" detailu
  (dialóg cez „Upraviť" panela) pre asset v stave `deleting` ostáva zapnuté; zadanie menuje panel.
- 217: s panelom pri assete, ktorý nový zoznam nemá, „Nahrať do ADAM" panela nerobí nič a nič nepovie.
- 218: čo prehliadač urobí s kartou, ktorej odpoveď je príloha (Chrome a Firefox takú kartu podľa FE-85 zavrú), som
  nevidel; karta nemá `noreferrer` (ako karta nového assetu FE-81). Druhé stlačenie otvorí druhú kartu a druhú
  požiadavku.
- Testy dokazujú volania (`window.open`, `opener`, `location.replace`, čítania), nie správanie prehliadača.

## Nové nálezy (neopravené, čítaním kódu)

1. **Tiché prevzatie s napísaným berie len hlavný súbor, nie stav assetu**: asset `draft` (vytvorený prázdny, alebo
   nahrávaný, kým server súbor nespracuje) ukazuje pod napísaným ďalej „Neobsahuje žiaden súbor." (`AssetInfobox.vue:50-57`
   podľa `attributes.assetStatus`), hoci karta už súbor ukazuje (`assetDetailStore.ts`, `setMainFile`). Platí aj pre
   FE-89; zlyhanie a duplikát majú v karte prednosť, tam to nevidno.
2. **Odmietnuté prihlásenie odpoveďou 401** v teste (falošný klient bez interceptorov) neukázalo „Login failed!" do 15 s;
   s 400 áno. Príčinu som nehľadal (skutočný `damClient` vynecháva auth požiadavky z odhlásenia pri 401); neoverené.

## Cyklus c1 (14. 10.; sedem bodov po posudkoch Codex `impl/posudky/OP8-D1-codex.md` a Opus)

Snímok `OP8-D1-c1` pred prvou zmenou cyklu; starý kód cyklu `old-c1.sh`, `c1-files.sh` (9 produkčných súborov podaných
zo snímku), ohnutia `bends-c1.py`. **Čo platí po cykle inak než v častiach kroku vyššie:** 225 (zlyhaný súbor pod
napísaným „Uložiť" nepustí), 217 („Nahrať do ADAM" berie zobrazený asset, nie aktívnu dlaždicu), 226 (mechanizmus),
221 (zmazanie v detaile ide cez funkciu stránky), a medza 219.

| Bod | Čo robí kód teraz | Čo vidí používateľ |
|---|---|---|
| c1-1 (225) | `D/composables/assetDetailFileChange.ts:58-75`: `formMayBeOlder` pustí „Uložiť" pod napísaným len pri tom istom hlavnom súbore nájdenom ako duplikát; zlyhaný súbor zadrží ako spracovaný (`PROCESSING_RAN`, `:61`; aj prvý súbor assetu bez hlavného, `:71`). Dôvod podľa posudkov: core-dam uloží metadáta zo súboru (`AbstractAssetFileStatusFacade.php:305-309`) a súbor môže zlyhať až potom (`:311`, `:318` → `toFailed`). | Zlyhaný hlavný súbor pod napísaným: pole s napísaným ostáva, karta „Spracovávanie súboru zlyhalo.", „Uložiť" zadržané **s textom „Súbor sa ešte spracúva. Uložiť pôjde po spracovaní; asset potom otvorte znova."** (iný text nie je; nový preklad som nepridal) až do celého prečítania. Bez napísaného sa formulár vezme na mieste, „Uložiť" voľné. Duplikát ako v kroku. |
| c1-2 | `A/store/assetDetailStore.ts:220-250`, `fileStatusOnServer`: pre držaný asset, ktorý nie je opísaný, je správou aj spracovaný súbor, ktorý nie je jeho hlavný (`mayHaveFilledIn`, `:227`); pri oznámení stránke sa zapne `saveHeldBack` (`:247`; celé čítanie ho zhodí), raz na súbor (`toldOfAnotherFile`, `:201`, `:244`; **po c2:** množina súborov, c2-1). Zdroje: notifikácia (poslucháč posiela každý súbor) a `onRowFinal` fronty pre riadok slotu usadený ako spracovaný (`A/store/uploadQueuesStore.ts:266-282`; čítanie fronty pri tom je zoznam slotov, nie asset). Čítania zoznamu a hromadnej úpravy nesú len hlavný súbor; ich hlavný súbor iný než držaný a spracovaný je tiež správou. | Súbor iného slotu spracovaný počas otvoreného detailu: bez napísaného sa asset prečíta potichu a formulár vezme (s tým, čo server vyplnil); s napísaným ostáva napísané a „Uložiť" zadržané s tým istým textom do celého prečítania. Opísaný asset nič. **Na backend:** jedno `GET` assetu navyše na každý spracovaný súbor iného slotu neopísaného assetu, ktorý detail drží. |
| c1-3 | `A/store/assetDetailStore.ts:159-167,186`: `setAsset` a `setMainFile` nič nezapíšu do assetu, ktorý sklad drží ako mazaný (rovnaké id, stav `deleting`). Platí pre tiché čítania aj čítania pod loaderom (všetky idú cez `setAsset`). | Čítanie assetu spýtané pred zmazaním a zodpovedané po ňom už nevráti asset do stavu pred zmazaním: ostáva „Čoskoro bude zmazaný.", „Uložiť" panela vypnuté. Asset držaný ako mazaný sa už nečíta do detailu ani novým otvorením toho istého assetu (server ho hlási ako mazaný, alebo 404). |
| c1-4 (217) | `EP/composables/externalProviderAssetImport.ts:24-37`: `importFromDetail` berie asset zo skladu detailu poskytovateľa (čo panel či dialóg ukazuje); bez neho alebo pod loaderom nič. Tlačidlá sú kreslené len s assetom a bez loadera (`ExternalProviderAssetListSidebarMetadata.vue:53-65`, `ExternalProviderAssetMetadata.vue:33-41`, bez zmeny). | „Nahrať do ADAM" nahrá zobrazený asset, aj keď nie je aktívna žiadna dlaždica alebo je aktívna iná. |
| c1-5 (219) | Bez kódu. Changelog 219 hovorí, že zmena potrebuje `ALogoutView` common-admin 2.0 (OP8-L1). `package.json` nedotknutý. | — (medza nižšie) |
| c1-6 (226) | Nový `D/composables/videoPreviewSet.ts`: karty náhľadu videa sa pri vzniku zapíšu (`onVideoPreviewSet`), pri odpojení odhlásia; dialóg po uložení zavolá `videoPreviewSet(fileId)` (`…FromDistributionDialog.vue:78`), prop funkcia je preč. Karta číta znova, keď je ten súbor ten, ktorý naposledy pýtala (`fileAsked`, `AssetDetailSidebarImagePreview.vue:54,60,93-95`), teda aj počas vlastného čítania. | Po „Potvrdiť", „Zrušiť", inej karte detailu a späť pred odpoveďou ukáže karta nový náhľad (doteraz starý). |
| c1-7 | Nový `D/composables/assetDeleted.ts`; `A/components/list/AssetListView.vue:75-78` poskytne funkciu, ktorá označí dlaždicu a asset držaný skladom detailu; `D/components/AssetDetailSidebarMetadata.vue:115-125` vezme id pred požiadavkou a po úspechu zavolá funkciu a potom udalosť; `D/components/AssetDetailDialog.vue:57-62` zatvára dialóg len keď ešte drží zmazaný asset. Stránky detailu funkciu neposkytujú. | Zmazanie v detaile označí zmazaný asset aj po prechode na ďalší asset alebo inú kartu detailu (doteraz ďalší asset, resp. nič). Dialóg sa zatvorí len z karty Info a len nad zmazaným assetom; s inou kartou otvorenou počas zmazania ostane otvorený nad assetom označeným ako mazaný. |

**Testy cyklu.** Nové súbory `src/test/list/detailOtherSlotProcessed.test.ts` (4; c1-2), `src/test/queue/slotFileTellsDetail.test.ts`
(2; c1-2 cez poll fronty, sklad so stránkou-náhradou), `src/test/list/detailDeleted.test.ts` (3; c1-3, c1-7 dvakrát); nové prípady
v súboroch kroku: `detailFileEnded.test.ts` +1 (duplikát pod napísaným, strážca), `externalProviderActiveTile.test.ts` +1 (c1-4),
`previewFromDistributionClosed.test.ts` +1 (c1-6). Spolu 12 nových, na snímku cyklu 9 červených (zelení strážcovia: duplikát
pod napísaným, opísaný asset dvakrát). **Zmenené prípady (8, na snímku cyklu 6 červených):** `detailFileEnded` „…says the file
failed, and "Save" stays held back" (c1-1; doteraz „comes free"); `detailFirstFile` dva prípady prvého zlyhaného súboru (c1-1;
„held back"); `detailFileProcessed` strážca „is not read again for the file of another asset" (c1-2; súbor iného slotu z neho
vypadol, je to teraz správa; zelený aj na snímku); `externalProviderImportLimit` dva prípady importu z detailu dostanú asset
detailu (c1-4; prvý má aktívnu inú dlaždicu, na snímku červený); `slotUploadWithoutSocket` a `notificationSettlesQueue`
„leaves a main file the … detail already has" (c1-2: stránke sa povie raz, hlavný súbor sa nezapíše; doteraz nepovie).

| Ohnutie | Červené |
|---|---|
| c1-1: zlyhaný súbor pustí „Uložiť" | 2 |
| c1-2: súbor iného slotu nie je správa | 4 |
| c1-3: `setAsset` píše do mazaného assetu | 1 |
| c1-4: import berie aktívnu dlaždicu | 1 |
| c1-6: karta číta len podľa súboru, ktorý už ukazuje | 1 |
| c1-7: stránke sa zmazanie nepovie | 3 |

**CK-DAM `OP8-D1-c1`, obe časti zelené nad konečným stromom:** `vysledky/OP8-D1-c1-testy.log` 120 súborov / 1 853 testov,
`vysledky/OP8-D1-c1-linty.log` čisté. Prvý beh testov bol červený (2 strážcovia c1-2 vyššie, potom zmenení) a prvý beh lintov
červený na `format:check` (poradie importov: môj `fmt.sh` spúšťal oxfmt mimo adresára aplikácie a bez jej nastavenia;
opravené, oba behy zopakované). **Záplata** `zaplaty/OP8-D1-c1.diff`: 1 444 riadkov, 23 súborov (9 zmenených a 2 nové
produkčné, 11 testov, changelog).

**Medze cyklu.**
- **219 potrebuje `ALogoutView` common-admin 2.0 (krok OP8-L1).** Kópia knižnice v admin-dam (`package.json:41`) ešte
  priraďuje `window.location.href`: s ňou a so zmenou prihlásenia z tohto kroku ostáva po odhlásení záznam `/logout` pred
  prihlásením a po novom prihlásení formulárom prvé Späť zo zoznamu otvorí `/logout` a odhlási. admin-dam 3.0 vychádza
  len s common-admin 2.0; kópiu knižnice robí vedúci na konci bloku.
- c1-1: text pri zadržanom „Uložiť" pre zlyhaný súbor hovorí o spracúvaní (iný text by bol nový preklad).
- c1-2: súbor iného slotu, ktorý zlyhal po uložení metadát, správou nie je (zadanie hovorí o spracovanom). Notifikácia
  a usadenie riadka fronty pre ten istý súbor dajú jedno čítanie detailu; čítanie fronty, ktoré riadok dopĺňa, je jej
  vlastné (v teste spolu tri čítania assetu).
- c1-3: asset držaný ako mazaný sa do detailu nečíta vôbec, kým ho detail drží (aj nové otvorenie toho istého assetu
  ukáže držaný objekt).
- c1-7: dialóg otvorený nad zmazaným assetom po prepnutí karty počas zmazania ostane otvorený (doteraz tiež, bez označenia).

## Cyklus c2 (14. 10.; dva body c1-2 po potvrdzovacích posudkoch, posledný cyklus)

Snímok `OP8-D1-c2` pred prvou zmenou; starý kód `old-c2.sh`, `c2-files.sh` (2 produkčné súbory podané zo snímku), ohnutia
`bends-c2.py`.

| Bod | Čo robí kód teraz | Čo vidí používateľ |
|---|---|---|
| c2-1 | `A/store/assetDetailStore.ts:199-202`, `:244-247`: namiesto posledného súboru si sklad pamätá **množinu** súborov iných slotov, o ktorých stránke povedal, pre držaný asset (`toldOfOtherFiles`); pri inom assete začne nanovo. | Dva súbory iných slotov hlásené na striedačku (notifikácia A, notifikácia B, front A, front B) spustia dve čítania assetu, nie štyri. Každý súbor je správou raz, nech ho ohlási ktorákoľvek cesta v akomkoľvek poradí. |
| c2-2 | `assetDetailStore.ts:255-264`, `savedAsDescribed(assetIds)`: držaný asset, ak je medzi nimi, dostane `flags.described = true`; nič iné (formulár ani napísané sa nemenia). Volá ho `A/api/assetApi.ts` po úspešnom uložení: `updateAssetMetadata` (detail aj panel) a `bulkUpdateAssetsMetadata` po každej uloženej dávke (hromadná úprava aj uloženie fronty uploadu). Každé uloženie posiela `described: true` (`assetApi.ts:358`, `:242`). | Po „Uložiť" (detail, panel, hromadná úprava, uloženie fronty) už spracovaný súbor iného slotu nie je správou: nič sa nečíta a „Uložiť" sa nezadrží nad tým, čo bolo napísané po uložení. Platí aj pre „Uložiť" zadržané kvôli súboru na ceste (`metadataMayStillChange`) a prvý súbor (`formMayBeOlder`): opísaný asset server nedopĺňa. |

**Testy cyklu.** Nový `src/test/asset/fileNewsOfOtherSlots.test.ts` (3, sklad so stránkou-náhradou a skutočné hromadné uloženie):
striedavé správy o dvoch súboroch → dve oznámenia (c2-1), strážca: ten istý súbor iného assetu drženého potom je novinkou
(zelený aj na snímku), uloženie hromadnej úpravy → súbor iného slotu nie je správou (c2-2). `detailOtherSlotProcessed.test.ts`
+1: panel, napísané, „Uložiť", znova napísané, súbor iného slotu spracovaný → žiadne čítanie, „Uložiť" voľné, pole s druhým
napísaným (c2-2). Spolu 4 nové, na snímku cyklu 3 červené. Existujúce prípady sa nemenili.

| Ohnutie | Červené |
|---|---|
| c2-1: pamätá sa len posledný súbor | 1 |
| c2-2: uloženie asset neoznačí ako opísaný | 2 |

**Medza.** Hromadné uloženie, ktorého neskoršia dávka zlyhá, označí držaný asset, len ak bol v dávke, ktorá prešla (tak
ako server). Uloženie, ktoré prešlo, pre iný asset než držaný neoznačí nič; držaný asset, ktorý sa potom prečíta celý,
berie príznak od servera.

**CK-DAM `OP8-D1-c2`, obe časti zelené:** `vysledky/OP8-D1-c2-testy.log` 121 súborov / 1 857 testov,
`vysledky/OP8-D1-c2-linty.log` čisté. **Záplata** `zaplaty/OP8-D1-c2.diff`: 254 riadkov, 5 súborov (2 produkčné, 2 testy,
changelog).
