# Meranie rýchlosti uploadu: jeden merač pre obe strany (analýza, 9. 10.)

Rozhodnutie vlastníka (denník, „Otvorené témy", bod 1): meranie je **jednotné** a má čo najpresnejšie fungovať pri
veľkom aj malom súbore. Táto analýza navrhuje ten merač. Nič v kóde som nemenil.

Skratky ako v návrhu jadra: `L/` = LIB `src/domains/dam/`, `D/` = DAM `src/domains/coreDam/`, `L-us` =
`L/uploadQueue/composables/uploadService.ts`, `D-us` = `D/shared/services/upload/uploadService.ts`, `L-st`, `D-st` =
sklady fronty, `L-ia` = `L/api/damImageApi.ts`, `D-ia` = `D/asset/api/imageApi.ts`, `LT/` = `L/uploadQueue/__tests__/`,
`LT0/` = `L/__tests__/`, `DT/` = admin-dam `src/test/`. „Odvodené" = vyčítané z kódu, nemerané.

## 0. Zhrnutie

- Dnes obe strany počítajú vzorku ako bajty medzi dvoma udalosťami axiosu za čas medzi nimi a hlásia nevážený priemer
  posledných 15 vzoriek. Líšia sa základom: knižnica meria naprieč kúskami (odznova len po zlyhanom pokuse), admin-dam
  odznova pri každom pokuse. Obe strany majú chybu F1 a percentá posúvajú len po celom kúsku.
- Chromium hlási priebeh nahrávania najviac raz za 100 ms a len po 0,5 % tela, axios to ďalej obmedzí na 3 za sekundu.
  Telo kúska, ktoré prehliadač prevezme do 100 ms, dá jedinú udalosť. V admin-dam taký kúsok nedá žiadnu vzorku. R1
  je teda skutočné riziko a admin-dam ho má pravdepodobne už dnes (odvodené).
- Návrh: jeden merač, ktorý sleduje jednu krivku „odoslané bajty súboru v čase" od prvého kúska po posledný. Základ
  sa zapíše pri odoslaní každej požiadavky (nie až pri prvej udalosti), ďalšie body dajú udalosti priebehu a odpoveď
  servera na kúsok. Rýchlosť je počet bajtov za posledných 10 s. Krivka začína odznova len po zlyhanom pokuse.
  Percentá rátajú aj bajty kúska, ktorý je práve na ceste.
- Rieši F1 aj R1 naraz. Z dnešných tvarov je bližšie knižnici (meria naprieč kúskami), D4 (tvar admin-dam) preto
  neodporúčam. Nahrádza K2-D4, F1 a člen sady `speedBaseline`.
- Testy: v knižnici sa menia 2 prípady, v admin-dam 2, v oboch repozitároch sa navyše prepíše 1 názov. Krok M má asi
  5 h, F1 a K2-D4 (3,5 h) odpadnú.

## 1. Dnešné merače

| | LIB (`L-us`) | DAM (`D-us`) |
|---|---|---|
| Udalosť → vzorka | prvá udalosť po základe zapíše len čas; ďalšia: (`loaded` − predošlé `loaded`, alebo celé `loaded`, keď predošlé bolo 0) / čas od predošlej; `lastLoaded` sa nuluje, keď `loaded === total` (`:111-124`) | to isté (`:124-137`) |
| Nový základ | len pri opakovanom pokuse (`:171-176`) | pri každom pokuse, aj prvom (`:166-169`) |
| Medzi kúskami | prvá udalosť ďalšieho kúska dá vzorku „bajty kúska / čas od poslednej udalosti predošlého", teda aj s odpoveďou servera, čítaním a hashom | nič, prvá udalosť kúska je len základ |
| Priemer | aritmetický priemer posledných 15 vzoriek, nevážený časom (`:213-215`) | to isté (`:200-202`) |
| Percentá | koniec posledného prijatého kúska / veľkosť (`:289-294`), počas kúska stoja | to isté (`:275-279`) |
| Zvyšný čas | `ceil(veľkosť × (100 − %) / 100 / priemer)` (`:216-218`) | to isté (`:203-206`) |
| Hlásenie | tik raz za sekundu, prvý hneď, len ak existuje aspoň jedna vzorka (`:211-229`) | to isté (`:198-218`) |
| Koniec | po poslednom kúsku ďalší tik neplánuje (`:296`); zastaví sklad (`L-st:328`) | `finally` a `stop()` (`:288-290`, `:293-297`); Z9 a Z10 sú už rozhodnuté |

**Kto hlásenie číta.** `setUploadSpeed` zapíše do riadku `progressPercent`, `remainingTime` a `speed` (`L-st:351-355`,
`D-st:768-772`). `speed` nikde nie je zobrazená. Číta ju len `updateChunkSize` pred každým kúskom a pred opakovaním
pokusu (`L-us:152,197`, `D-us:154,186`). Zobrazenie:
- LIB `L/assetDetail/components/AssetImage.vue:98-102` (text percent, `null` aj 0 ukáže „0%") a `:175-191` (kruh,
  zvyšný čas, ak nie je 0), cez `L/uploadQueue/components/UploadQueueItemEditable.vue:129,259` a
  `UploadQueueDialogSingle.vue:203,427`;
- DAM riadok zoznamu `D/asset/components/queue/AssetQueueItemList.vue:35-48,88-94` (točiace sa koliesko, kým je
  `progressPercent` `null`, aj počas `Processing`) a `:142-145` (zvyšný čas, kým je kladný); karta cez
  `D/asset/components/AssetImage.vue:92-96,139-185` a `queue/AssetQueueItemEditable.vue:129,299`;
- admin-cms ani admin-ugc priebeh priamo nečítajú (grep `src`).

**Veľkosť kúska** (`L/uploadQueue/composables/damUploadChunkSize.ts`). Prvý kúsok má poslednú veľkosť, ktorú si modul
zapamätal (`:5,9`); bez nej `minSize`. Prahy sú apiTimeout/5, /4 a /2 (`:11-13`). Pri apiTimeout 30
(`petit/admin-cms/src/main.ts:63`, `petit/admin-ugc/src/main.ts:71`, `admin-dam/public/config.json:14`; nasadené
hodnoty nepoznám) sa kúsok zmení, keď by trval menej než 6 s alebo viac než 15 s, a nastaví sa na 7,5 s pri zmeranej
rýchlosti. Hranice 1 MB a 50 MB dáva core-dam (`core-dam/.env:226-227`, `config/packages/settings.php:64-67`;
nasadené sú v Azure). Bez rýchlosti sa veľkosť nemení (`:16-18`). Skutočný časový limit požiadavky kúska je 420 s
(`L-ia:16,178`, `D-ia:24,92`), nie apiTimeout.

## 2. Ako chodia udalosti priebehu

- **axios 1.20.0** (rovnaká verzia v common-admin, admin-dam, admin-cms aj admin-ugc). Používa sa adaptér `xhr`
  (`node_modules/axios/lib/defaults/index.js:42`, žiadny klient ho nemení). `onUploadProgress` obalí
  `progressEventReducer(listener, false, freq = 3)` (`lib/helpers/progressEventReducer.js:5`). Throttle
  (`lib/helpers/throttle.js:9,26-34,39`) pustí prvú udalosť hneď a ďalšie najviac raz za 333 ms; poslednú podržanú
  doručí pri `upload.loadend` (`lib/adapters/xhr.js:231-237`). Každá požiadavka má vlastný reducer, throttle teda
  začína pri každom kúsku znova. `loaded` je orezané na `total` (`progressEventReducer.js:15`). `total` je celé telo
  multipart, teda kúsok spolu s hlavičkami častí a JSON `chunk` (odvodené: asi o stovky bajtov viac než kúsok).
  axios dáva aj `rate`, ale pre každú požiadavku zvlášť a až po 250 ms (`progressEventReducer.js:7`,
  `speedometer.js:45`), preto sa na meranie celého súboru nehodí.
- **Špecifikácia XHR** (xhr.spec.whatwg.org): `progress` na `upload` sa posiela najviac „roughly 50ms" a ešte raz na
  konci tela, pred `load` a `loadend`.
- **Chromium** (vetva main, čítané cez web): sieťová služba číta pozíciu tela časovačom každých 100 ms
  (`services/network/upload_progress_tracker.cc`, `kUploadProgressInterval`). Ohlási ju len vtedy, keď od posledného
  hlásenia pribudlo aspoň 0,5 % tela, keď prešla 1 s alebo keď je telo celé, a na ďalšie hlásenie čaká na
  potvrdenie. Posledné hlásenie pošle najneskôr pri hlavičkách odpovede (`url_loader.cc`,
  `ContinueOnResponseStarted`). Blink pri `bytes_sent == total` pošle `load` a `loadend`
  (`xml_http_request.cc`, `DidSendData`). Pozícia hovorí, koľko tela prevzal sieťový zásobník prehliadača, nie koľko
  prijal server.
- **Firefox, Safari:** neoverené, poznám len špecifikáciu.

**Čo z toho plynie pre jeden kúsok** (odvodené). Axios zavolá merač asi 1 + trvanie/333 ms krát, plus raz na konci.
Ak prehliadač prevezme celé telo do 100 ms, Chrome dá jedinú udalosť s `loaded = total`. Pri 1 MB kúsku to nastane,
keď prehliadač preberá rýchlejšie než asi 10 MB/s (80 Mbit/s), čo je na kancelárskej sieti bežné. `loaded` navyše
predbieha sieť o vyrovnávacie pamäte (TCP, okno HTTP/2). Začiatok kúska preto ukáže skok, koniec kúska čaká na
odpoveď servera a udalosti priebehu to čakanie nevidia.

## 3. Čo dnešné merače ukazujú zle

1. **Percentá stoja počas kúska.** Súbor z jedného kúska ukazuje „0%" po celý čas uploadu (LIB `AssetImage.vue:98-102`,
   DAM rovnako). Kúsok môže narásť až na 50 MB a ďalší súbor začína poslednou veľkosťou (`damUploadChunkSize.ts:5,9,23,29`).
   Po prvom väčšom uploade v sedení je preto väčšina fotiek v CMS jeden kúsok (odvodené).
2. **admin-dam: kúsok s jedinou udalosťou nedá vzorku** (`D-us:126-131,168-169`). Ak to platí pre každý kúsok (rýchla
   sieť, 1 MB), riadok nedostane nič: koliesko sa točí, zvyšný čas chýba a `progress.speed` ostane `null`. Kúsky preto
   nikdy nenarastú a celý súbor ide po 1 MB, napríklad 2 GB video asi v 2 000 požiadavkách. Je to R1, ale v admin-dam
   už dnes (odvodené, neoverené).
3. **admin-dam: vzorky vznikajú len vnútri kúska**, takže merač nevidí čakanie na odpoveď servera ani prípravu ďalšieho
   kúska. Rýchlosť vychádza vyššia, zvyšný čas kratší a kúsky väčšie, než zodpovedá skutočnosti.
4. **Knižnica: priemer 15 vzoriek nie je vážený časom.** Vzorka z 20 ms váži rovnako ako vzorka zo 7 s a krátke vzorky
   (vyprázdnenie vyrovnávacej pamäte) ťahajú priemer nahor.
5. **Obe strany:** prvá vzorka po základe ráta aj bajty spred prvej udalosti (F1, Z23).

## 4. Návrh: jeden merač

**Krivka.** Merač sleduje jedno číslo, koľko bajtov súboru je odoslaných, v čase od prvej požiadavky kúska po posledný
kúsok:
- **pri odoslaní každej požiadavky kúska** zapíše bod (čas, prijaté). Toto je základ, takže už prvá udalosť dá vzorku
  (rieši F1 aj R1);
- **pri každej udalosti axiosu** zapíše bod (čas, prijaté + bajty na ceste). Bajty na ceste sú `loaded / total ×
  veľkosť kúska` (bez réžie multipartu), najviac veľkosť kúska;
- **pri odpovedi servera na kúsok** pripočíta kúsok k prijatým a bod označí „server odpovedal";
- **po zlyhanom pokuse** začne krivku odznova: bajty toho pokusu server neprijal a čas pokusu ani pauzy sa nepočíta.

**Rýchlosť** = (odoslané teraz − odoslané pred 10 s) / čas. Ak krivka začala neskôr, počíta sa od jej začiatku. Ľavý
okraj sa medzi bodmi interpoluje, aby rýchlosť neskákala, keď starý bod vypadne z okna. Pravý okraj je počas
posielania „teraz", takže keď sa nič neposiela, rýchlosť klesá. Po poslednom kúsku je pravý okraj odpoveď na posledný
kúsok. Rýchlosť platí, len ak je úsek dlhší než 0, bajtov je viac než 0 a úsek má aspoň 0,5 s alebo v ňom server
odpovedal. Kratší úsek bez odpovede ukazuje hlavne vyrovnávaciu pamäť prehliadača.

**Hlásenie** ostáva ako dnes: tik raz za sekundu, prvý hneď. Po poslednom kúsku sa ďalší tik neplánuje a ten, ktorý už
je naplánovaný, ohlási 100 % a 0 s, ak je rýchlosť známa (Z9). Hlási sa len s platnou rýchlosťou (B18).
- **Percentá** = odoslané / veľkosť. Nikdy nie sú nižšie než naposledy ohlásené.
- **Zvyšný čas** = `ceil((veľkosť − odoslané) / rýchlosť)`.
- **Rýchlosť** sa hlási v B/s zaokrúhlená nahor, ako dnes.

**Čo merač kŕmi.** Do riadku zapisuje `progressPercent`, `remainingTime` a `speed` cez `setUploadSpeed`, bez zmeny.
Veľkosť kúska ostáva `updateChunkSize(item.progress.speed)` z posledného hlásenia. `LT/uploadServiceApiTimeout.test.ts`
dáva rýchlosť do riadku sám a merač bez callbacku nehlási, ostane teda zelený. `UploadProgressCallback` ani
`useDamUploadChunkSize` sa nemenia.

**Zastavenie a zlyhanie** ostávajú ako Z10: časovač ruší služba. Posledné hlásenie ostane v riadku ako dnes, Z26 sa
nemení. Čas sa berie z `Date.now()`: oba repozitáre ho v testoch posúvajú (`LT` cez `vi.spyOn`, `DT` cez
`vi.setSystemTime`). Keď hodiny skočia späť, krivka začne odznova. Okrem tiku merač nepridá žiadny časovač (pravidlo 6
jadra, `LT/uploadServiceSequence.test.ts:112-116`). Prázdny súbor (admin-dam ho posiela) nemá kúsok, takže nedostane
ani hlásenie, ako dnes.

**Parametre.** Okno 10 s pokryje aspoň jeden „ideálny" kúsok (7,5 s pri apiTimeout 30), takže v ustálenom stave je v
ňom vždy odpoveď servera; na zmenu rýchlosti odhad zareaguje do 10 s. Hranica 0,5 s vychádza z hlásenia Chromia
(100 ms) a axiosu (333 ms).

Náčrt nového súboru `L/uploadQueue/composables/uploadMeter.ts` (nevyvezený, asi 90 riadkov):

```ts
const TICK_MS = 1_000
const WINDOW_MS = 10_000
const MIN_SPAN_MS = 500

export function useUploadMeter(fileSize: number, report: UploadProgressCallback | undefined) {
  let points: Array<{ at: number; sent: number; answered: boolean }> = []
  let received = 0 // bytes of the chunks the server answered
  let shown = 0 // never goes back
  let sendingOver = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const mark = (sent: number, answered = false) => {
    const at = Date.now()
    if (points.length && at < points[points.length - 1].at) points = [] // the clock went back
    points.push({ at, sent, answered })
    while (points.length > 2 && points[1].at < at - WINDOW_MS) points.shift() // one stays before the window
  }
  /** Before every request of a chunk; a retry starts afresh, the server took nothing of the failed try. */
  const attempt = (chunkSize: number, retry: boolean) => {
    if (retry) points = []
    mark(received)
    return (e: { loaded: number; total?: number }) =>
      mark(received + Math.min(e.total ? (e.loaded / e.total) * chunkSize : e.loaded, chunkSize))
  }
  const chunkDone = (size: number) => { received += size; mark(received, true) }
  const sentAt = (t: number) => { /* sent of the last point at or before t, linear between two points */ }
  const speed = () => {
    if (points.length < 2) return null
    const end = sendingOver ? points[points.length - 1].at : Date.now()
    const from = Math.max(points[0].at, end - WINDOW_MS)
    const span = end - from
    const bytes = sentAt(end) - sentAt(from)
    const answered = points.some((p) => p.answered && p.at > from)
    return span > 0 && bytes > 0 && (span >= MIN_SPAN_MS || answered) ? (bytes / span) * 1000 : null
  }
  const tick = () => {
    const s = speed()
    if (s && report) {
      const sent = points[points.length - 1].sent
      shown = sendingOver ? 100 : Math.max(shown, (sent / fileSize) * 100)
      report(shown, Math.ceil(s), sendingOver ? 0 : Math.ceil((fileSize - sent) / s))
    }
    if (!sendingOver) timer = setTimeout(tick, TICK_MS)
  }
  return {
    start: tick,
    attempt,
    chunkDone,
    lastChunkSent: () => (sendingOver = true), // Z9
    stop: () => { clearTimeout(timer); sendingOver = true }, // Z10
  }
}
```

V službe (priebeh v jadre 2.3, riadky 716-760) sa `if (preset.speedBaseline === 'attempt' || attempt > 1)
meter.newBaseline()` nahradí riadkom `onProgress = meter.attempt(chunk.size, attempt > 1)`. `onProgress` ide do
`requests.chunk`, po úspechu nasleduje `meter.chunkDone(chunk.size)` a percentá dáva merač namiesto
`progress = i / filesize * 100`. `speedBaseline` zmizne z oboch sád (jadro 2.3, riadok 691, pravidlo 3).

**Ako sa merač správa v jednotlivých prípadoch:**

| Prípad | Dnes | S jedným meračom |
|---|---|---|
| Malý súbor, jeden kúsok, pod 1 s | ukáže „0%", potom spracovanie; tik po 1 s ohlási 100 %, ak mal vzorku (DAM často nemá) | rovnako; 100 % príde takmer vždy, lebo server odpovedal |
| Jeden kúsok, 1 až 20 s (bežná fotka v CMS po prvom uploade) | „0%" po celý čas; zvyšný čas za celý súbor | percentá rastú každú sekundu, čas odpočítava |
| Veľký súbor, kúsky do 50 MB (video v DAM) | percentá skáču po kúskoch; v DAM odhad bez času servera | percentá idú plynulo; odhad počíta aj čas servera a prípravu kúska (čítanie, hash) |
| Rýchla sieť, 1 MB kúsky po jednej udalosti | DAM: nič a kúsky nerastú (3.2); LIB: vzorky naprieč kúskami | rýchlosť je známa po prvom kúsku a kúsky rastú od druhej sekundy |
| Opakovaný pokus | základ odznova, starý priemer sa hlási ďalej | krivka odznova; v pauze (1, 3, 9 s) tik nehlási a riadok drží posledné hodnoty; percentá neklesnú |
| Dva súbory naraz (limit 2, `L-st:42`, `D-st:65`) | každý meria svoj podiel | rovnako; keď jeden skončí, odhad druhého sa dorovná do 10 s |

## 5. Testy, ktoré pripínajú dnešné čísla

| Test | Čo dnes pripína | S meračom |
|---|---|---|
| `LT/uploadServiceRetry.test.ts:238-268` „is measured anew when a chunk is sent again" | `[900]`, `[900, 900]` | **zmení sa**: bajty sa prepočítajú na veľkosť kúska (súbor má 5 B) a čas sa ráta od odoslania. Zmysel ostáva (opakovaný pokus meria odznova, nikdy záporne). |
| `LT/uploadServiceRetry.test.ts:270-293` „goes on from the chunk before…" | `[1750]` | **zmení sa číslo**; zmysel ostáva, meria sa naprieč kúskami. Komentár `:270-272` („this case is then turned around", D4) prestane platiť, prípad sa neotočí. |
| `LT/uploadServiceSequence.test.ts:93-147` | `[34, 68, 100]`, zvyšok 0, sekundový rytmus | podľa čítania **bez zmeny**: v čase tiku ďalší kúsok ešte nemá bajty na ceste |
| `LT/uploadServiceApiTimeout.test.ts`, `LT/damUploadChunkSize.test.ts`, `LT0/damImageApiUploadRequests.test.ts:102`, `LT/uploadQueueClientFailure.test.ts:113-115`; podvrh `useDamUploadChunkSize` v `uploadQueuesStore`, `uploadQueueStartsEachFileOnce`, `uploadStopBetweenChunks`, `uploadStopWhileHashLoads` | veľkosti kúskov, odovzdanie callbacku, iba sekundy merača | bez zmeny |
| `DT/upload/uploadSequence.test.ts:150-175` „says how far the file is…" | 0 %, 501, 5 s; potom 40,96 %, 501, 3 s | **zmení sa**: sekunda bez ďalšej udalosti sa ráta a bajty na ceste idú do percent. Prvý tik dá asi 20 %, 251 B/s, 8 s (odvodené). |
| `DT/upload/uploadSequence.test.ts:177-190` | 100 %, 0, > 0 počas dokončenia | bez zmeny (odvodené) |
| `DT/upload/uploadSequence.test.ts:192-201` „says nothing about speed where the server reports none" | všetko `null` | ostane zelený len preto, že pod falošným časom kúsky odpovedia v tej istej milisekunde. So skutočným serverom bez udalostí by merač rýchlosť mal (z odpovedí). **Premenovať** na „…where no time passes". |
| `DT/upload/uploadStop.test.ts:84-115` (nikdy záporná) | `speed >= 0`, viac hlásení | bez zmeny (odvodené: hlásenia asi 1 a 4 B/s) |
| `DT/upload/uploadStop.test.ts:117-151` „measures a retried chunk over its own time" | 3 000 | **zmení sa** asi na 4 B/s (16 B za 4 s pri kúsku 4 B; odvodené). Zmysel ostáva. |
| `DT/queue/queueListRow`, `queueRowStates`, `queueRowValidation`, `slotNotifications`, `DT/upload/uploadRequests.test.ts:108` | priebeh zapísaný priamo, odovzdanie callbacku | bez zmeny |

Odpadne aj to, čo plán ešte len chystá: úpravy pre F1 (`DT/upload/uploadSequence.test.ts:164,173` 501 → 500,
`DT/upload/uploadStop.test.ts:150` 3 000 → 2 000, čísla v `LT`), otočenie pre K2-D4 a prípad K2 „sada admin-dam:
meranie pri každom pokuse" (plán 2.3, K2). Pribudne `LT/uploadMeter.test.ts` s asi 10 prípadmi: prvá udalosť sa ráta
od odoslania, kúsok s jedinou udalosťou dá rýchlosť, krivka pokračuje naprieč kúskami aj s odpoveďou servera,
opakovaný pokus začína odznova, percentá s bajtmi na ceste neklesnú, okno 10 s, hranica 0,5 s, záverečných 100 % a
0 s, `stop` ruší časovač, hodiny idúce späť.

## 6. Čo uvidia používatelia

**admin-cms a admin-ugc** (dialóg fronty, dialóg jedného súboru, widgety cez ne):
1. Kruh a percentá sa hýbu aj počas kúska. Súbor z jedného kúska, teda väčšina fotiek po prvom uploade v sedení, už
   nestojí na „0%".
2. Zvyšný čas odpočítava plynulo. Je presnejší a skôr dlhší než dnes, lebo ráta aj čakanie na server.
3. Súbor, ktorý sa nahrá do 1 s: bez zmeny.
4. Pri opakovanom pokuse percentá neklesnú.
5. Kúsky budú trochu menšie tam, kde dnešný priemer rýchlosť preceňoval. Používateľ to nevidí, mení sa len veľkosť a
   počet požiadaviek.

**admin-dam** (riadok zoznamu fronty, karta):
1. až 4. ako v knižnici.
5. Na rýchlej sieti, kde dnes 1 MB kúsky nedajú vzorku (3.2): namiesto točiaceho sa kolieska bez času uvidí kruh s
   percentami a časom. Súbor pôjde väčšími kúskami, teda menej požiadavkami a pravdepodobne rýchlejšie (odvodené).
6. Z9 (už odsúhlasené PV5): po poslednom kúsku sa ukáže plný kruh bez času. S meračom sa to týka takmer každého
   súboru, dnes len tých, kde admin-dam stihol vzorku. Riadok zoznamu teda počas `Processing` ukáže plný kruh namiesto
   točiaceho sa kolieska (`AssetQueueItemList.vue:91`).

## 7. Zaradenie do plánu

- **Čo nahrádza:** K2-D4 (1,5 h) a F1 (2 h) aj s ich testami, R1 a ručnú skúšku ako podmienku K2-D4, člen
  `speedBaseline` (jadro 2.3 riadky 691 a 742, pravidlo 3; jadro 2.8 riadky 1095, 1108, 1120; PV12 v 5.2) a riadky B15, B16 a B17 v tabuľke
  rozdielov. Z23 (F1) nahradí v registri nová položka, napríklad Z28 „jeden merač", zaradená ako viditeľná (časť 6).
  V prehľade pre vlastníka sa menia body 1 (Z23) a 3 (D4).
- **Krok M** (nový, v 2.9 na mieste F1). Strom LIB, keď v ňom nie je otvorený krok, najskôr po K3: dovtedy admin-dam
  službu knižnice nepoužíva a M zasiahne len knižnicu. Odporúčam ho dať po K6 ako F1, aby kroky K ostali bez zmeny
  správania. Testy admin-dam sa upravia v kópii, ktorá M prenesie (C3; ak M príde až po C3, dostane vlastnú C4).
- **K2 ostáva**, ako je naplánované (so `speedBaseline`, sú to dva riadky); M ho odstráni. Zložiť M do K2 by ušetrilo
  asi 0,5 h, ale K2 je na kritickej ceste a má ostať bez zmeny správania.
- **Súbory:** nový `L/uploadQueue/composables/uploadMeter.ts` (asi 90 riadkov), `L-us` (asi −45 / +15), sady
  (`L/uploadQueue/presets/uploadPresets.ts`, −2), testy podľa časti 5.
- **Odhad:** LIB 4,5 h (kód 1 h, nové testy 1,5 h, dva prípady 0,5 h, posudky 1 h, dokumenty 0,5 h) a DAM 0,5 h v C3,
  spolu asi 5 h. Po odpočítaní F1 a K2-D4 je to netto +1,5 h, mimo kritickej cesty.
- **Ručná skúška** (odporúčaná, neblokuje): po C3 nahrať fotku okolo 5 MB v admin-cms a video nad 200 MB v admin-dam
  a pozrieť, či percentá idú plynulo a zvyšný čas sedí. V nástrojoch prehliadača zároveň spočítať požiadavky kúskov.

## 8. Čo som neoveril

- Firefox a Safari: ako často a kedy posielajú udalosti nahrávania (poznám len špecifikáciu).
- Koľko tela prevezme sieťový zásobník naraz (TCP, okno HTTP/2 pred core-dam). Od toho závisí, ako často kúsok dá
  jedinú udalosť. Body 3.2 a 6 (admin-dam, bod 5) sú preto odvodené.
- Chromium som čítal z vetvy main cez web, nie z verzie, ktorú majú používatelia.
- Nasadené `APP_SIZE_*_CHUNK_SIZE` a apiTimeout.
- Nové čísla testov v časti 5 sú vypočítané, nie získané behom.

## Pre vlastníka

1. **Jeden merač podľa časti 4:** meria naprieč kúskami od odoslania požiadavky, priemer za 10 s, odznova len po
   zlyhanom pokuse. Prijíma sa namiesto tvaru admin-dam (D4). *Odporúčam áno.* Krok M asi 5 h, nahrádza F1 a K2-D4
   (3,5 h), po K6.
2. **Percentá aj počas kúska**, nielen po celom kúsku. Dnes súbor z jedného kúska stojí na 0 %. *Odporúčam áno*,
   súčasť M.
3. **Percentá pri opakovanom pokuse neklesnú.** *Odporúčam áno*, súčasť M.
4. **Zvyšný čas ráta aj čakanie na server**, bude dlhší a presnejší. Veľkosti kúskov sa tým mierne zmenia (vnútorná
   vec). *Odporúčam áno*, súčasť M.
5. **Z9 v admin-dam sa bude týkať takmer každého súboru:** riadok zoznamu počas spracovania ukáže plný kruh namiesto
   točiaceho sa kolieska. *Odporúčam áno*, súčasť M, bez práce navyše.
