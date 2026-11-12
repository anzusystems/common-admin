# PV14a: fronta nesie meno konfigurácie DAM; upload a čítania idú pod ňou (impl-komp-lib)

**Stav: uzavretý 11. 10.** (vedúci; posudky Codex a Opus k PV14a-c1 bez blokujúceho nálezu). CK zelená.

Plán `plan-implementacie.md` 2.9 riadok „PV14a" (`:1100`); návrh jadra 1.4, 2.3 pravidlo 2, 2.4 pravidlo 10, 2.8, 3.1,
4.1; analýza `analyzy/pv14-pomenovane-konfiguracie.md` 4.1 body 1 až 4. Strom LIB
`/home/volar/projects/anzusystems/common-admin` (po 43), TMPDIR `common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.
Krok robí impl-komp-lib (plán ho píše na impl-jadro-lib; pokyn vedúceho).

Skratky: `LQ/` = `src/domains/dam/uploadQueue/`.

## Podkroky

1. **Snímok `PV14a`** pred prvou úpravou.
2. **Sklad** (`LQ/store/uploadQueuesStore.ts`):
   - `configNames: Map<UploadQueueKey, string>`; `configOf(queueKey?)` vráti meno fronty, inak `'default'` (aj pre
     čítanie bez fronty).
   - `addByFiles(…, files, configName = 'default')` a `addByCopyToLicence(…, assets, configName = 'default')` overia,
     že konfigurácia existuje, a frontu pomenuje vloženie riadku (`addRowUnder`, bez `await` medzi menom a riadkom):
     prázdna alebo nová fronta meno prijme; **iné meno do fronty s riadkami sa odmietne výnimkou** a riadok sa nepridá
     (stav po cykle 1; pôvodne `nameQueue` pred slučkou súborov, pri inom mene varovanie do konzoly a riadky pod
     menom fronty).
   - Čitatelia (`readAsset`, `readAssets` vrátane adresy v hlásení chyby, `duplicateOriginAsset`) berú klienta a
     `endPointAsset` z `useCommonAdminCoreDamOptions(configOf(options?.queueKey))` pri každej požiadavke.
   - `updateFromDetail(asset, configName?)` číta asset pod podaným menom (bez mena `default`); čítanie konfigurácie je
     vnútri `try`, takže ani neznáme meno nič nehodí (detail je vtedy už uložený; „zlyhané čítanie mlčí" platí ďalej).
   - Jadro dostane `configOf` (`libraryQueuePreset({ queues, settlement: profile, configOf })`).
3. **Sady** (`LQ/presets/uploadPresets.ts`, `queuePresets.ts`): `libraryUploadPreset(configName?)` číta
   `useCommonAdminCoreDamOptions(configName)` (`apiTimeout` ostáva voľba stránky); `libraryQueuePreset` má nepovinný
   člen `configOf` a `runnerFor(item, queueKey)` vráti beh `useUpload(item, cb, libraryUploadPreset(configOf(queueKey)))`.
   Sada admin-dam sa nemení.
4. **Usadzovanie** (`LQ/settlement/uploadSettlementTypes.ts`, `uploadSettlement.ts`, `uploadSettle.ts`): nepovinné
   `UploadReadOptions.queueKey`; podáva ho dopyt fronty (kľúč svojej fronty, aj čitateľovi slotov), čítanie po
   notifikácii (fronta prvého dotknutého riadku), „Obnoviť" a `settleKnownProcessed` (fronta prvého dotknutého
   riadku, zistená pred čítaním; bez riadku nič) a originál duplikátu
   (`duplicateOriginAsset(originFileId, { queueKey })`, fronta prvého kandidáta). Čitateľ, ktorý pole nečíta, sa
   správa ako predtým (admin-dam).
5. **Testy** (+25):
   - nový `LQ/__tests__/uploadNamedConfiguration.test.ts` (18): stránka s `default` (admin-cms) a `own` (iný klient,
     adresy `/own/v2/asset`, `/own/v2/image`); fronta pod `own`: štart, kúsok a dokončenie; dopyt (jeden riadok aj dva
     naraz, a hlásenie zlyhaného čítania dvoch s adresou `own`); notifikácia; „Obnoviť"; originál duplikátu z dopytu
     aj z notifikácie; kópia do licencie; fronta `default` vedľa nej; fronta bez mena; meno fronty s riadkami ostáva
     (varovanie), rovnaké meno bez varovania, prázdna fronta meno zmení, neznáme meno sa odmietne bez riadku;
     `updateFromDetail` pod menom, bez mena a s neznámym menom. Každý prípad pripína aj to, že druhý klient nedostal
     nič.
   - `LQ/settlement/__tests__/uploadSettlement.test.ts` (7, describe „the queue a reader is told a read is for"):
     dopyt (jeden asset, viac assetov; v profile admin-dam aj sloty), notifikácia, „Obnoviť" (prvý riadok; bez riadku
     nič; riadok, ktorý odíde počas čítania), originál duplikátu (známy duplikát; duplikát nájdený dopytom).
     `support/settlementFixtures.ts`: server zapisuje `queueKey` každej požiadavky (`queuesOf(kind)`), čitateľ
     originálu berie voľby.
6. **Dôkaz** (v pamäti, snímok `PV14a`; skript `pv14a-check.sh`, dva súbory, 131 prípadov): čitateľ assetu pod
   `default` → 6; čitateľ viacerých → 2; čitateľ originálu → 2; sklad nepodá `configOf` → 15; sada jadra ho nečíta
   → 15; sada služby meno nečíta → 15; dopyt bez `queueKey` → 8; notifikácia bez → 2; „Obnoviť" bez → 3; originál
   bez → 4; meno sa prepíše vždy → 1; prázdna fronta meno nezmení → 1; meno sa neoverí → 1; kópia frontu
   nepomenuje → 2; súbory frontu nepomenujú → 16; detail číta `default` → 2; detail hodí pri neznámom mene → 1.
   Päť produkčných súborov zo snímku (`N39L_OLD`) → 24 / 131; starší kód s novými súbormi testov inak zelený.
7. **Behy**: cielené `src/domains/dam` 94 súborov / 1 935 zelených; `oxfmt`, `oxlint`, `eslint` na deviatich súboroch
   čisté, `lint:tsc` 0.
8. **Návrh**: `navrh-jadro.md` 3.1 (odsek „Hotové v kroku PV14a").
9. **Záplata** `zaplata.sh PV14a` → `krok5-praca/zaplaty/PV14a.diff`. **CK-LIB PV14a v LIB zelené** (`vysledky/PV14a-ck.log`): `test:browser` 309 / 4 190 (43 + 25, jeden nový súbor),
   `test:eslint` 7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania.

## Zmenené súbory

- `src/domains/dam/uploadQueue/store/uploadQueuesStore.ts`
- `src/domains/dam/uploadQueue/presets/uploadPresets.ts`, `queuePresets.ts`
- `src/domains/dam/uploadQueue/settlement/uploadSettlementTypes.ts`, `uploadSettlement.ts`, `uploadSettle.ts`
- `src/domains/dam/uploadQueue/settlement/__tests__/uploadSettlement.test.ts`, `support/settlementFixtures.ts`
- `src/domains/dam/uploadQueue/__tests__/uploadNamedConfiguration.test.ts` (nový)
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md` (3.1)

## Čo sa mení pre používateľa

Nič: admin-cms, admin-ugc aj admin-dam majú len `default` a meno do skladu zatiaľ nikto nepodáva (komponenty až
v PV14b), takže každá fronta je pod `default` a každá požiadavka ide tam, kam doteraz. Na backend sa nemení nič.
Verejné rozhranie len pribúda: nepovinné `UploadReadOptions.queueKey` a nepovinný druhý parameter `options?`
čitateľa `UploadSettlementProfile.readers.duplicateOriginAsset` (vyvezené typy).

## Odchýlky

1. **Testy na úrovni skladu, nie widgetu.** Plán píše „widget pod konfiguráciou `own`"; widget meno skladu podá až
   v PV14b, preto nový súbor volá sklad s menom priamo. Widget pod `own` patrí do testov PV14b.
2. **Neznáme meno sa odmieta pri pridaní** (návrh o ňom mlčí): `addByFiles` a `addByCopyToLicence` zavolajú
   `useCommonAdminCoreDamOptions(configName)`, ktoré pre meno mimo `coreDam.configs` hodí výnimku pluginu (od cyklu 1
   aj pre `constructor`, `toString` a podobné). Bez toho by zlyhal až beh riadku (od cyklu 1 ako neúspešný upload;
   predtým ostal riadok „čakajúci" s neodchyteným zamietnutím).
3. **Sklad už pri vzniku nečíta `default`**; číta konfiguráciu fronty pri každej požiadavke (návrh 3.1: „v okamihu
   volania"). Stránka bez nastaveného pluginu teda nehodí výnimku pri vzniku skladu, ale až pri prvom pridaní.
4. **Originál duplikátu dostane len `queueKey`** (`Pick<UploadReadOptions, 'queueKey'>`): `report` pri ňom
   usadzovanie nikdy neposielalo a čitateľ knižnice chyby hlási sám, ako doteraz.
5. **`updateFromDetail` s neznámym menom mlčí** (čítanie konfigurácie je v `try`), na rozdiel od pridania: detail je
   vtedy už uložený a doterajší sľub „nič nehodí" ostáva.
6. **Iné meno do fronty s riadkami sa odmietne výnimkou** (cyklus 1; návrh 3.1 písal „nezmení a napíše varovanie"), a
   frontu pomenuje až vloženie riadku.
7. **Beh riadku sa vyrába vnútri `try` jadra** (cyklus 1; mimo zadania PV14a, Codex).

Čísla 2 až 7 sú tie isté ako v `navrh-jadro.md` 3.1 („Hotové v kroku PV14a a jeho cykle 1").

## Zblíženia navyše (tvar registra)

Žiadne (krok sa týka len knižnice; sada a sklad admin-dam sa nemenia).

## Nové nálezy

- **`runnerFor` mimo `try`** (`LQ/core/uploadQueueCore.ts:187`): sada, ktorá pri výrobe behu hodí výnimku
  (v knižnici stránka bez nastaveného pluginu), nechá riadok „čakajúci" a zamietnutie neodchytené. **Opravené
  v cykle 1** (bod 2 nižšie).
- **Každé čítanie skladá celé voľby konfigurácie** (`useCommonAdminCoreDamOptions`, vrátane štyroch preložených
  textov), hoci potrebuje len klienta a adresu. Cena je zanedbateľná (dopyt raz za sekundy); v testoch bez
  prekladov to pri každom čítaní píše „Missing en translation" (do konzoly; od cyklu 1 sklad sám nevaruje a test
  konzolu nečíta). Čitateľ
  len klienta a adries by bol zmenou `L/composables/commonAdminCoreDamOptions.ts`, mimo kroku.
- **Cache mien číta `default` ďalej** (Opus 10; hranica PV14c, `navrh-jadro.md` 2.3 pravidlo 2). „Fronta pod `own`
  nepošle nič na `default`" teda platí pre upload a čítania assetov, nie pre mená autorov a kľúčových slov: tie sa
  po čítaní assetu pýtajú cez `default`. Tvrdenia `asked(dam) == []` v `uploadNamedConfiguration.test.ts` držia len
  preto, že podvrhnuté assety nemajú autorov ani kľúčové slová.
- **Asset v dvoch frontách rôznych konfigurácií** sa po notifikácii a pri „Obnoviť" číta cez frontu prvého
  dotknutého riadku, aj nesledovaného (návrh 2.4 pravidlo 10; pripína prípad „a notification: the queue of the first
  row it concerns, tracked or not"). Zapísané len ako pripomienka obmedzenia „jedna stránka = jeden core-dam".

## Cyklus 1 (PV14a-c1, 11. 10.; posudky Codex a Opus, pokyny vedúceho)

Snímok `PV14a-c1` (strom po U8-L-c1).

1. **Súbeh pri pomenovaní fronty** (Codex; `LQ/store/uploadQueuesStore.ts`). `addByFiles` pomenoval prázdnu frontu
   pred slučkou súborov (`for await`, medzi menom a prvým riadkom je `await`): druhé pridanie s tým istým kľúčom a iným
   menom, ktoré prišlo skôr, než sa vložil prvý riadok, meno prepísalo, a súbory prvého pridania sa poslali pod menom
   druhého. Teraz:
   - pred pridaním sa overí len to, že konfigurácia existuje (`useCommonAdminCoreDamOptions(configName)`, ako doteraz);
   - meno zapíše `addRowUnder(queueKey, configName, item)` tesne pred `core.addRow`, bez `await` medzi nimi; riadok
     štartuje vnútri `addRow` už pod tým menom;
   - **iné meno do fronty s riadkami sa odmietne výnimkou** („useUploadQueuesStore: the queue "…" has rows under the
     DAM configuration "own", none is added under "default".") a riadok sa nepridá. Doteraz (PV14a): meno ostalo,
     konzola dostala varovanie a riadky išli pod menom fronty, teda inam, než volajúci povedal. Návrh 3.1 píše
     „nezmení a napíše varovanie"; zmenené na pokyn vedúceho (bezpečné správanie), zapísané v 3.1.
   - Z dvoch prekrývajúcich sa pridaní pomenuje frontu to, ktorého riadok je v nej prvý; druhé sa odmietne pri svojom
     prvom riadku. Prázdna fronta (po zastavení alebo odobratí riadkov) prijme nové meno ako doteraz.
   - **Okraj, nemenený:** ak sa fronta medzi dvoma súbormi jedného pridania vyprázdni a iné pridanie ju pomenuje
     inak, zvyšok prvého pridania sa odmietne výnimkou uprostred (jeho skoršie riadky sú vtedy už preč).
2. **Beh riadku vnútri `try`** (Codex, mimo zmeny PV14a; `LQ/core/uploadQueueCore.ts`, `queueItemUploadStart`):
   `runnerFor(item, queueKey)(…)` a `stopHandles.set` sú prvé dva riadky `try`. Sada, ktorá beh nevie vyrobiť, zlyhá
   riadok ako neúspešný upload: `Failed`, `hasError`, text od skladu admin-dam (knižnica žiadny nepíše, riadok ukáže
   „neznáma chyba"), formulár preč, upozornenie admin-dam, prepočet a štart ďalšieho riadku. Predtým: neodchytené
   zamietnutie, riadok ostal „čakajúci" a štartoval (a hádzal) znova s každým ďalším riadkom. **Pod `default` sa
   nemení nič**: keď sa beh vyrobí, poradie krokov je to isté (výroba, `stopHandles`, `uploadInit`, `upload`).
   Spoločný kód s admin-dam (C3): sada admin-dam beh vyrába bez čítania konfigurácie, takže sa jej to týka len, keby
   jej `upload` alebo `importRun` hodili pri výrobe.
3. **Komentár** člena `configOf` v `LQ/presets/queuePresets.ts` (zrozumiteľnejšie znenie).
4. **Meno konfigurácie je len to, čo aplikácia pomenovala** (Opus 9, mimo zmeny PV14a;
   `L/composables/commonAdminCoreDamOptions.ts`): `useCommonAdminCoreDamOptions(configName)` testovalo
   `isUndefined(configs[configName])`, takže `constructor`, `toString` či `__proto__` prešli ako nakonfigurované, bez
   klienta. Pribudlo `Object.hasOwn(configs, configName)`. Prípady: `L/__tests__/consumerProfileOptions.test.ts`
   („a DAM configuration the application has not named", štyri mená) a `constructor` v odmietnutí skladu.
5. **Prípad originálu duplikátu** (Opus 5; `LQ/settlement/__tests__/uploadSettlement.test.ts`): prípad „…the queue of
   the row, not that of the tick before it" mal jeden riadok v jednej fronte, takže fronta riadku a fronta tiku boli
   tá istá a zlyhal by len úplne bez `queueKey`. Teraz „the original of a duplicate a tick has found: the queue of the
   first row to become it, not that of the tick": asset má riadok aj v prvej fronte (nesledovaný), tik je druhej
   fronty; čítanie assetu dostane druhú frontu, originál prvú.
6. **Zápisy** (Opus 1, 7, 10): `navrh-jadro.md` 3.1 (veta o inom mene, zoznam spresnení s číslami odchýlok, tabuľka
   členov s novými podpismi), táto poznámka (podkrok 2, verejné rozhranie, odchýlky 6 a 7, cache mien).
7. **Testy** (spolu +10): `LQ/__tests__/uploadNamedConfiguration.test.ts` (18 → 22): „is the only one its rows are added
   under" pre súbory a pre kópiu (odmietnutie, žiadny riadok, druhý klient nič), „takes more rows under the same
   name", dva prípady prekrývajúcich sa pridaní (`own` potom `default` a naopak: druhé sa odmietne, súbory prvého idú
   pod jeho menom); prípady s varovaním konzoly zanikli. `LQ/core/__tests__/uploadQueueCore.test.ts` (+2, describe „a
   row whose run cannot be made"): sada knižnice s `configOf` na neexistujúcu konfiguráciu (tri riadky `Failed`, bez
   textu, prepočítané, DAM nič) a sada admin-dam, ktorej `upload` hodí (text a upozornenie skladu, každý riadok
   štartoval raz). `L/__tests__/consumerProfileOptions.test.ts` (+4, bod 4); odmietnutie neznámeho mena v sklade pre
   dve mená (+1); prípad usadzovania z bodu 5 (nahradený, 0).

**Dôkaz** (v pamäti, snímok `PV14a-c1`; skript `pv14ac1-check.sh`, štyri súbory, 209 prípadov): meno sa pri riadku
neodmietne → 4; fronta pomenovaná pred slučkou súborov ako pred cyklom → 5; meno zapísané až po riadku → 16; meno
súborov sa neoverí → 2; meno kópie sa neoverí → 2; beh mimo `try` → 2 a 10 neodchytených chýb; `run` v `catch`
bez `?.` → 2 a 6 neodchytených chýb; originál pod frontou posledného kandidáta (v prípade fronta tiku) → 2; bez
`Object.hasOwn` → 4. Sklad, jadro a voľby zo snímku (`N39L_OLD`) → 10 / 209 a 10 neodchytených chýb.
**Behy**: cielené `src/domains/dam` 94 súborov / 1 952 zelených; `oxfmt`, `oxlint`, `eslint` na ôsmich súboroch
čisté, `lint:tsc` 0. Záplata `zaplaty/PV14a-c1.diff`. Prvý beh CK-LIB (stav pred bodmi 4 až 6) bol zelený, 309 /
4 202. **CK-LIB PV14a-c1**: zelená, 309 súborov / 4 207 testov (`vysledky/PV14a-c1-ck.log`, druhý beh; U8-L-c1 + 10).

Zmenené súbory cyklu: `LQ/store/uploadQueuesStore.ts`, `LQ/core/uploadQueueCore.ts`, `LQ/presets/queuePresets.ts`
(komentár), `L/composables/commonAdminCoreDamOptions.ts`, `LQ/__tests__/uploadNamedConfiguration.test.ts`,
`LQ/core/__tests__/uploadQueueCore.test.ts`, `LQ/settlement/__tests__/uploadSettlement.test.ts`,
`L/__tests__/consumerProfileOptions.test.ts`, `navrh-jadro.md` (3.1), `impl/PV14a.md`.

**Nový nález cyklu (nemenené):** `useCommonAdminImageOptions(configName)`
(`L/imageWidget/composables/commonAdminImageOptions.ts:14-21`) testuje meno rovnako ako pred opravou voľby DAM
(`isUndefined(configs[configName])`): `constructor` prejde ako obrázková konfigurácia bez klienta. Widget číta obe
voľby pod tým istým menom, takže ho dnes zastaví voľba DAM; samostatne ostáva.

**Čo sa mení pre používateľa (cyklus):** v troch adminoch nič (jedna konfigurácia, beh sa vždy vyrobí). Bod 2 je
druhá poistka: v knižnici chýbajúcu konfiguráciu odmietne už pridanie, skôr než vznikne riadok; ak by sa beh riadku
predsa nedal vyrobiť (aj v admin-dam), riadok zlyhá namiesto toho, aby ostal čakať.

## Známe obmedzenia (posudky PV14a-c1, 11. 10.; kód sa nemení)

1. **Rozbehnuté pridanie môže pomenovať vyprázdnenú frontu znova** (Codex). `addByFiles` vkladá súbory po jednom
   (`for await`); ak sa fronta medzi dvoma jeho súbormi vyprázdni (zastavenie, odobratie riadkov), jeho ďalší riadok
   pomenuje prázdnu frontu svojím menom, a pridanie pod iným menom, ktoré príde potom, sa odmietne. Riadok nikdy
   nejde inam, než jeho pridanie povedalo; odmietne sa len to druhé.
2. **Latentné: riadok spustený dvakrát, keď výroba behu hodí len pre niektorý riadok** (Opus;
   `LQ/core/uploadQueueCore.ts`, `processUpload` a `catch` v `queueItemUploadStart`). `processUpload` spustí naraz
   viac čakajúcich riadkov; ak výroba behu hodí pre riadok A, jeho `catch` zavolá `processUpload` ešte počas toho
   prechodu, ten spustí čakajúci riadok B, a pôvodný prechod potom spustí B druhý raz. So sadou knižnice to nenastane
   (konfigurácia je frontová: beh sa nevyrobí pre žiadny riadok fronty, alebo pre každý) a sada admin-dam pri výrobe
   nehádže; týkalo by sa len aplikácie s vlastným `upload` alebo `importRun`, ktorý hodí pre jeden riadok a pre
   druhý nie.
