# K2-testy: služba pod oboma sadami (testy-k2, TMPDIR `testy-k2`)

Agent: testy-k2 (rola testy-lib). Strom: `/home/volar/projects/anzusystems/common-admin` (LIB, `next`, HEAD
`03c3a108`). Krok K2 je otvorený; kód (`uploadService.ts`, `presets/uploadPresets.ts`, `src/lib.ts`,
`publicExportsAdded.test.ts`) napísal impl-jadro-lib (`impl/K2.md`), on urobil aj snímok `K2`. Plán 2.0, 2.3 „K2", 3.6,
4.3 (testy-lib); návrh jadra 11.1: 2.3, 2.6, 2.7 (tvar `fileApi.ts` po K3), 2.8, 4.2 (K2), register Z2, Z4, Z5, Z6, Z10,
Z12, Z27.

## Zmenené súbory

Jediný: **nový** `src/domains/dam/uploadQueue/__tests__/uploadServicePresets.test.ts` (696 riadkov, **73 prípadov**).
Kód implementátora som nemenil. Snímok nerobím (krok má snímok `K2`, môj súbor je voči nemu nový). Mimo `src`: nič
(okrem tejto poznámky). Ohnuté súbory na disku: **žiadne** (všetko v pamäti, nižšie).

## Čo súbor drží (z návrhu, nie z kódu)

Okraj: falošný DAM (`support/fakeDam.ts`, ako `LT/uploadServiceRetry.test.ts`), čas (`support/longWaits.ts`: pauzy
a sekunda merača sa držia a púšťa ich test) a modul `@/domains/system/composables/sentry` podľa cesty (jadro 4.2).
Vstupy aplikácie pre `adminDamUploadPreset` majú tvar admin-dam po K3 (jadro 2.7): `requests` = knižničné
`damFileUploadStart/Chunk/Finish` (moduly `imageUpload*`) na adrese typu riadku (`/adm/v1/image|audio|video|document`)
pod klientom aplikácie; vlastné texty (každý iný, aby bolo vidno, čí text riadok má); `apiTimeout`; `loadHash` =
`Promise.resolve` falošného hashu, ktorý si pamätá, čo dostal. Voľby pluginu sú v každom prípade **nenastavené**
(`coreDamOptions.value = undefined`), strana knižnice ich nainštaluje (`installConsumerProfile`, profil UGC).
Identifikátory sú z riadku (`item.fileId`), nie z poradia štartov.

| Časť (plán 2.3 K2, jadro 4.2) | Prípady |
|---|---|
| sada admin-dam: súbor ľubovoľného typu (video) ide na adresy aplikácie, žiadne čítanie volieb pluginu (najprv overí, že čítanie by hodilo) | 1 |
| sada admin-dam: `loadHash` aplikácie zavolaný raz, hash dostal všetky bajty v poradí, dokončenie nesie jeho výťah | 1 |
| sada admin-dam: Z27, každý kúsok je súbor s menom a typom vybraného | 1 |
| sada admin-dam: texty aplikácie pri 422 (každé pole riadok, neznáme pole s `systemError`) | 1 |
| sada admin-dam: `apiTimeout` aplikácie (30, 120, `null`, `undefined` → 30) | 4 |
| B5: prázdny súbor pod admin-dam ide (štart `size: 0`, dokončenie, žiadny kúsok); pod knižnicou `Empty file` a nič neodíde | 2 |
| Z12 / pravidlo 5: `uploadValidationMessage` s textami strany: polia; nie chyba axiosu, bez odpovede, bez polí → `unknownError` | 4 |
| Z2: požiadavka kúska, ktorou posielajú obe sady: veľkosť 0, záporná, necelá; posun záporný, necelý → neodíde, `dam_upload_chunk_validation` (značka `_size` / `_offset`) | 5 |
| pod oboma sadami, Z2: kúsok bez bajtov (konfigurácia kúska 0, ako pred načítaním konfigurácie DAM) neodíde a ohlási `dam_upload_chunk_validation`; každá odpoveď 400 ohlási `dam_upload_chunk_400` a riadok dostane text strany | 2 × 2 |
| pod oboma sadami, Z10: po zlyhaní nezostane tik merača a hlásenie sa už nezavolá, pri 9 spôsoboch: `upload()` bez `uploadInit()`, riadok bez súboru, žiadny kúsok neprejde, 422, 4× 400, kúsky bez bajtov, odmietnuté dokončenie, zastavenie stavom a `stop()` počas kúska | 9 × 2 |
| pod oboma sadami, Z5: zastavenie stavom riadku aj `stop()` v ôsmich bodoch: počas prípravy hashu, štart na ceste, medzi štartom a prvým kúskom, počas čítania prvého kúska, pri odpovedi na prvý kúsok, kúsok na ceste (bez pauzy a ďalšieho pokusu), v pauze pred ďalším pokusom, pri odpovedi na posledný kúsok (bez dokončenia, `finishAttempted()` false) | 8 × 2 × 2 |

Prípad „sada admin-dam: meranie pri každom pokuse" sa podľa plánu nepíše.

**Výklad, ktorý som urobil (vedúcemu na vedomie):** cez službu sa kúsok so zlou veľkosťou alebo posunom vyrobiť nedá
(veľkosť = bajty kúska, posun = súčet predošlých veľkostí); jediný neplatný kúsok, ktorý služba pošle požiadavke, je
kúsok bez bajtov (veľkosť 0). Preto „pod oboma sadami" je kúsok bez bajtov cez službu a necelá alebo záporná veľkosť
a posun sú na požiadavke `damFileUploadChunk`, ktorou obe sady po K3 posielajú. Navyše oproti zoznamu v pláne (všetko
z návrhu 2.3, 2.7, 2.8): `apiTimeout` aplikácie, `uploadValidationMessage`, Z27 a protipól prázdneho súboru pod
knižnicou (ten drží aj `LT/uploadQueueClientFailure.test.ts`).

## Behy (všetky cez `tezky.sh`, `--retry=0`, TMPDIR `…/common-admin/node_modules/.cache/vitest-tmp-testy-k2`)

1. `oxfmt --check` → zalomil dva dlhé riadky (kópia pred formátovaním
   `/tmp/claude-1000/…/scratchpad/k2t-pred-fmt.ts`), potom `oxfmt` a `oxlint` kód 0.
2. Beh 1 (`vysledky/K2-testy-1.log`): **73 / 73 zelených**, 5,3 s.
3. Ohýbanie (nižšie) odhalilo, že 7 prípadov Z10 na strane knižnice nemohlo zlyhať: `toTheEnd` púšťal držané čakania
   ešte počas `uploadInit()`, medzi nimi 15 s lehotu načítania `rusha` sady knižnice, takže štart zlyhal („rusha did
   not load within 15000 ms") a merač sa nespustil (`vysledky/K2-testy-ladenie-3.log`). Oprava v teste: všetko pred
   `upload()` (aj `uploadInit()`) dobehne skôr, než sa pustí prvé držané čakanie. Ladiace riadky boli dočasné a sú
   preč (grep `K2TDEBUG` = 0).
4. `eslint` na súbore → kód 0 (`vysledky/K2-testy-eslint-1.log`); `lint:tsc` → kód 0 (`vysledky/K2-testy-tsc-1.log`).
5. Konečný beh so skutočnou konfiguráciou (`vysledky/K2-testy-2.log`): **73 / 73 zelených**.

## Dôkaz, že prípady neprítomnosti vedia zlyhať (všetko v pamäti)

Konfigurácia `…/vitest-tmp-testy-k2/vitest.k2t.config.mts`: `mergeConfig` skutočnej `vitest.config.mts`, `root` =
strom, plugin `load` s `enforce: 'pre'`, ktorý v module nahradí presný text zo súboru `bend-<meno>.json` (text, ktorý
nenájde, zastaví beh; pri tvorbe som overil, že každý text je v module práve raz). Použité ohnutia sa zapisujú do
`k2t-<meno>-applied.txt`. Spúšťač `/tmp/claude-1000/…/scratchpad/k2t-ohyb.sh <meno>` (cez `tezky.sh`, JSON výsledky
v `vysledky/K2-testy-ohyb-<meno>.json`, výpis `…-<meno>.log`). Bez ohnutia (`zelene`): 73 / 73.

| Ohnutie | Čo sa v pamäti zmení | Červené |
|---|---|---|
| `options` | `useUpload` vždy zavolá `libraryUploadPreset()` (číta voľby pluginu) | 36: každý prípad pod sadou admin-dam (bez volieb hodí) |
| `empty` | sada knižnice `emptyFile: 'send'` | 1: prázdny súbor pod knižnicou |
| `validation` | `damImageApi.ts` bez kontroly prázdneho kúska, celej a kladnej veľkosti a celého nezáporného posunu | 7: 5 prípadov požiadavky a kúsok bez bajtov pod oboma sadami |
| `meter` | bez `stopSpeedCheck()` v `catch` uploadu a v `stop()` | 18: všetky prípady Z10 (oba boky) |
| `meter-reports` | `meter` + v teste vynechané tvrdenie o tiku (ohnutý testovací modul) | 12: tvrdenie „hlásenie sa už nezavolá" samo chytí 6 spôsobov na každej strane, pri ktorých bola nameraná rýchlosť; pri troch bez kúska (bez `uploadInit()`, bez súboru, bez bajtov) nie je čo hlásiť a drží ich tvrdenie o tiku |
| `stop-all` | `stopped()` vždy `false`, `stop()` bez `abort()` | 32 prípadov Z5 + 2 prípady Z10 so `stop()` |
| `stop-P1` | bez kontroly po príprave hashu | 4: „while its hash is prepared" (stav aj `stop()`, oba boky) |
| `stop-P2` | bez kontroly v odpovedi štartu | 4: „while its start is on its way" |
| `stop-P5` | bez kontroly po čítaní kúska | 4: „while its first chunk is read" |
| `stop-P4P5` | bez kontroly na začiatku kúska a po čítaní | 6: navyše „as its first chunk is answered" (stav) |
| `stop-P3P4P5` | navyše bez kontroly na začiatku `upload()` | 10: navyše „between its start and its first chunk" (stav aj `stop()`) |
| `stop-P6` | `catch` kúska bez `\|\| stopped()` | 2: „while a chunk is on its way" (stav) |
| `stop-P7` | bez kontroly po pauze | 2: „in the pause before a chunk is tried again" (stav) |
| `stop-P8` | bez kontroly pred dokončením | 2: „as its last chunk is answered" (stav) |

Každý z ôsmich bodov kontroly (jadro 2.3, Z5) drží aspoň jeden prípad na oboch stranách. Kontrola na začiatku
`upload()` a na začiatku kúska je zdvojená ďalšou kontrolou (odchýlka 5 v `K2.md`: kontrola slučky je prvým príkazom
spracovania kúska), preto sú ohnutia P4 a P3 spojené s P5. Pri `stop()` sú body „kúsok na ceste", „v pauze", „pri
odpovedi na prvý/posledný kúsok" navyše strážené zrušením kúska (`abort()`); tieto prípady zlyhajú v `stop-all`.

## Odchýlky, zblíženia, nálezy

- Nezhoda testu s kódom implementátora: **žiadna** (žiadne tvrdenie som nemenil kvôli kódu).
- Zblíženia navyše: žiadne (súbor len testuje).
- Nové nálezy: žiadne.
- Porušenie pravidla: v prvom behu (17:17) som v príkaze Bash omylom použil `cd` do stromu (pred `tezky.sh`, ktorý
  aj tak ide s `--cwd`); nič sa tým nezmenilo, ďalej len celé cesty.

## Cyklus 1 (body vedúceho z posudkov Codexu a Opusa)

Snímok `K2-c1` urobil impl-jadro-lib (jeho správa „snímok K2-c1 hotový"); začal som až po nej. Menil som len svoj súbor
(719 riadkov, **74 prípadov**, +1).

1. **(Opus 1) Z12, ne-axios vstup.** Prípad „what is no error of axios" podával `new Error()` bez `response`, takže
   by prešiel aj bez stráže `!axios.isAxiosError(error)`. Teraz podáva obyčajný objekt v tvare odpovede s poľami
   (`{ response: { data: { error: 'validation_failed', fields: { size: ['x'] } } } }`) a tvrdí `unknownError()`.
   Ohnutie `c1-z12` (stráž v `uploadService.ts` vynechaná): **1 červený**, presne tento prípad. Kontrola
   `c1-z12-stary-vstup` (to isté ohnutie a v teste pôvodný `new Error()`): 74 / 74 zelených, potvrdzuje bod Opusa.
2. **(Codex 1, Opus 3) Typy preťažení.** Nový prípad v sade admin-dam „makes a run of its own side, and there is
   none of that side without it": `expectTypeOf(run[uploadSide]).toEqualTypeOf<'adminDam'>()`,
   `expectTypeOf(run).toExtend<UploadRun<'adminDam'>>()`, za behu `run[uploadSide] === 'adminDam'`; a
   `// @ts-expect-error` na `useUpload<'adminDam'>(item)` bez sady (za behu sa len zavolá v uzávere a hodí, lebo
   sada knižnice číta voľby pluginu, ktoré tu nie sú). Preťaženia už v strome boli, preto dôkaz „pred opravou" je
   `vue-tsc --noEmit` s vlastnou konfiguráciou v `…/vitest-tmp-testy-k2/` (`paths` na službu, `vue`, `axios`, `@/*`;
   do stromu sa nezapisuje):
   - `tsconfig.k2t-strom.json` (služba zo stromu): kód 0;
   - `tsconfig.k2t-pred-pretazenim.json` (služba zo snímku `K2-c1`, bez preťažení): kód 2, **jediná chyba**
     `uploadServicePresets.test.ts(206,5): TS2578 Unused '@ts-expect-error' directive` (`vysledky/K2-testy-c1-tsc-pred-pretazenim.log`);
   - `tsconfig.k2t-siroka-strana.json` (kópia služby zo stromu v TMPDIR, návrat druhého preťaženia
     `UploadRun<UploadSide>`): kód 2, chyby TS2344 na oboch kladných `expectTypeOf` (`:200`, `:201`).
3. **(Opus 2) Z32.** Pri prípadoch `apiTimeout` komentár: pre `null` je 30 s pravidlo knižnice (Z32), služba
   admin-dam brala `null` ako 0 s a každý kúsok ako najmenší. Tvrdenia bez zmeny; meno prípadu bez zmeny (Z32 by
   inak stálo pri všetkých štyroch).
4. **(Opus 6) Komentár zástupcu `fileApi.ts`:** doplnené, že dokončenie admin-dam po K3 volá aj `startProcessing`,
   ktoré služba nečíta, a zástupca ho nemá. Tvrdenia bez zmeny.

Behy cyklu 1 (cez `tezky.sh`): `oxfmt` (bez zmeny), `oxlint` 0, `eslint` 0 (`vysledky/K2-testy-c1-eslint.log`),
`lint:tsc` 0 (`vysledky/K2-testy-c1-tsc.log`), cielený beh **74 / 74 zelených** (`vysledky/K2-testy-c1-1.log`).
Ohnutia z prvej časti platia ďalej: prípady, ktorých sa týkajú, sa nezmenili.

## Cyklus 2 (body vedúceho)

Začal som po správe impl-jadro-lib „snímok K2-c2 hotový". Menil som len svoj súbor (721 riadkov, počet prípadov
ostáva **74**); oba body sú v prípade „makes a run of its own side, and there is none of that side without it".

1. **(Codex) `toThrow()` pri behu admin-dam bez sady nič nestrážil:** hádzal pre chýbajúce voľby pluginu aj so starým
   podpisom. Tvrdenie za behu je **vypustené**; volanie ostáva v uzávere, ktorá sa nevolá, a jej jediným strážcom je
   `@ts-expect-error` (komentár to hovorí). Aby uzáver nebol nepoužitá premenná (oxlint `no-unused-vars`), ide do
   `expectTypeOf(…).toBeFunction()`, čo sa za behu nič nedeje.
2. **Výslovné `undefined` ako sada → beh knižnice:** nový riadok `const libraryRun = () => useUpload(item,
   undefined, undefined)` (nevolá sa: sada knižnice by čítala voľby pluginu, ktoré tu nie sú) a
   `expectTypeOf<ReturnType<typeof libraryRun>[typeof uploadSide]>().toEqualTypeOf<'library'>()`. Dôkaz cez
   `vue-tsc --noEmit` s vlastnou konfiguráciou v TMPDIR, ako v cykle 1:
   - `tsconfig.k2t-strom.json` (služba zo stromu, s `preset?: undefined`): kód 0 (`vysledky/K2-testy-c2-tsc-strom.log`);
   - `tsconfig.k2t-pred-c2.json` (služba zo snímku `K2-c2`, bez `preset?: undefined`): kód 2, **TS2345 na `:206`**
     („Argument of type 'undefined' is not assignable to parameter of type 'UploadPreset<UploadSide>'") a TS2344
     na `:207` (kladné tvrdenie: „Expected: library, Actual: adminDam") (`vysledky/K2-testy-c2-tsc-pred-c2.log`).

Behy cyklu 2 (cez `tezky.sh`): `oxfmt` (bez zmeny), `oxlint` 0, `eslint` 0 (`vysledky/K2-testy-c2-eslint.log`),
`lint:tsc` 0 (`vysledky/K2-testy-c2-tsc.log`), cielený beh **74 / 74 zelených** (`vysledky/K2-testy-c2-1.log`).

## Stav

- [x] súbor testov (74 prípadov po cykle 2)
- [x] cielené zelené (74 / 74)
- [x] ohnutia v pamäti (14 behov, potom 2 ohnutia a 3 typové behy v cykle 1, 2 typové behy v cykle 2)
- [x] oxfmt, oxlint, eslint, lint:tsc
- [ ] CK-LIB (spustí implementátor so slotom)
