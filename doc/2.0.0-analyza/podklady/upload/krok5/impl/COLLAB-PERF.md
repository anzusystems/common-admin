# COLLAB-PERF: výkon kolaboračného servera – 1.14.1 (produkcia) proti `next`

Zadanie `krok5-praca/zadania/zadanie-collab-perf.md` a doplnky vedúceho (diagnostické a pokusné sady). Nástroje a surové
výsledky: `/home/volar/projects/anzusystems/krok5-praca/perf/` (kampaň `results/main`, 106 behov, 0 zlyhaných,
0 chýb v logoch serverov, 0 chýb prípravy, 100 % doručených úprav vo všetkých behoch). Súhrn s každou metrikou:
`results/main/summary.md` (+ `summary.json`). Merané 21.–22. 10. 2026.

## Verdikt

- **Po oprave (dist z 22. 10. 02:39 s H3 a H4; b1-final, b1prod-final, sekcia „Po oprave"): `next` je na CPU
  vyrovnaný a v produkčnej konfigurácii lepší.** Bežná konfigurácia: CPU 17,8 → 18,5 % (+4 %, bez rozdielu, predtým
  +17 %), p99 úpravy 6,9 → 11,5 ms (stále +66 %), slučka p99 2,2 → 3,5 ms, GC 0,30 → 0,57 %. Ako v produkcii: CPU
  22,6 → 19,0 % (−16 %), p99 17,0 → 13,0 ms, slučka p99 11,2 → 5,2 ms, GC −44 %. Zápisy do Mongo 3× menej (177 → 60/min).
- **Pred opravou – bežná konfigurácia (b1: traces 1.0, LOG_LEVEL info): `next` je horší.** CPU +17 % (17,5 → 20,4 % jadra), oneskorenie
  úpravy p50 +49 % (2,0 → 3,0 ms), p99 2,4× (7,1 → 17,2 ms), slučka p99 2,7×, GC 2,4×. Absolútne malé čísla: pri
  90 editoroch a 180 úpravách/s je jadro vyťažené na ~20 % a p99 pod 20 ms – pre používateľa nebadateľné.
- **Ako v produkcii (b1-prod: traces 1.0, profiles 1.0, LOG_LEVEL debug): `next` je lepší.** CPU −12 % (21,8 → 19,2),
  slučka p99 −32 % (11,0 → 7,5 ms), GC −18 %; p99 úpravy rovnaké (16,2 / 16,7 ms), p50 horší (1,7 → 2,3 ms). Dôvod:
  debug log stojí 1.14.1 +4,3 bodu CPU (transakcie Sentry 10 narastú 12×), `next` (span streaming) takmer nič.
- **Vyladený (`next` + awareness fast path, b1-tuned): CPU ako 1.14.1** (16,3 vs 16,9 %, bez rozdielu), p99 9,95 vs
  7,16 ms (+39 %), slučka p99 2×, GC 2×.
- **socket.io časť je v `next` výrazne lepšia:** rozoslanie zmien poľa/zámkov p50 ~62 → 3–7 ms (oprava adaptéra 0.3).
  V scenári c je však `next` o 12 % náročnejší na CPU a p99 potvrdení je ~+35 % (adaptér 0.3 pýta Redis pri každom
  `fetchSockets`). Na 2 inštanciách (d) +17 % CPU a p99 medzi inštanciami 31 vs 18 ms.
- **Únik pamäte nie** (e, 15 min): sklon minima heapu ~0 MB/min v oboch, RSS +0,4 MB/min v oboch.
- **Nie je to blokujúce pre vydanie.** Po oprave zostáva rozdiel hlavne v chvoste oneskorenia úprav (p99 +4,6 ms),
  slučke a GC. Väčšina z neho je v Hocuspocus 4 (nový `Y.Doc` pre každú awareness správu), ktorý awarefast odstraňuje;
  na neopravenom kóde ušetril 2,8–3,1 bodu CPU a 2,7–5,0 ms p99. Na opravenom kóde sa nemeral: odhad je `next` pod
  1.14.1 v CPU a p99 okolo 8–9 ms (odvodené, nie zmerané). Zvyšok je SDK Sentry 11, ktoré sa orezaním integrácií
  zmenšiť nedá.

## 1. Hlavné metriky (priemer ± smerodajná odchýlka, n = 3, A/B/A/B v tom istom okne)

Scenár b (30 miestností × 3 editori, každý 2 znaky/s, core-cms mení pole cez sys API každých 10 s na miestnosť, 5 min).
„Verdikt" = rozdiel nad 10 % a nad šumom (2× štandardná chyba rozdielu).

| metrika | b1 1.14.1 | b1 next | b1-prod 1.14.1 | b1-prod next | b1-tuned 1.14.1 | b1-tuned next | b1-tuned next+awarefast |
|---|---|---|---|---|---|---|---|
| CPU [% jadra] | 17,5 ± 0,7 | **20,4 ± 0,5** | 21,8 ± 0,5 | **19,2 ± 0,8** | 16,9 ± 0,4 | 19,4 ± 0,9 | **16,3 ± 0,3** |
| úprava p50 [ms] | 2,01 ± 0,09 | 2,99 ± 0,03 | 1,70 ± 0,11 | 2,31 ± 0,16 | 1,88 ± 0,05 | 2,75 ± 0,15 | 2,08 ± 0,08 |
| úprava p95 [ms] | 4,18 ± 0,31 | 9,48 ± 0,65 | 5,91 ± 0,39 | 7,66 ± 0,53 | 4,12 ± 0,15 | 8,18 ± 1,06 | 4,63 ± 0,02 |
| úprava p99 [ms] | 7,10 ± 0,79 | **17,2 ± 0,45** | 16,2 ± 1,15 | 16,7 ± 0,99 | 7,16 ± 0,56 | 15,0 ± 0,75 | **9,95 ± 0,30** |
| slučka p99 [ms] | 2,19 ± 0,24 | 6,00 ± 0,34 | 11,0 ± 0,47 | 7,51 ± 0,24 | 2,08 ± 0,07 | 5,45 ± 0,58 | 4,28 ± 0,18 |
| GC [% času] | 0,30 | 0,73 | 1,27 | 1,05 | 0,29 | 0,76 | 0,59 |
| RSS priemer / max [MB] | 287 / 291 | 300 / 303 | 298 / 312 | 303 / 305 | 286 / 292 | 301 / 304 | 293 / 296 |
| heapUsed priemer [MB] | 83,3 | 87,6 | 75,3 | 84,7 | 82,4 | 87,7 | 84,6 |
| sys API p99 [ms] | 10,0 | 16,1 | 19,2 | 15,7 | 9,1 | 13,2 | 10,4 |
| rozoslanie sys poľa p50 / p99 [ms] | 58 / 137 | 7,2 / 48 | 64 / 136 | 5,9 / 49 | 59 / 136 | 6,7 / 43 | 6,2 / 35 |
| štart [ms] | 746 | 849 | 730 | 869 | 745 | 840 | 873 |
| zápisy Mongo [/min] | 177 | 177 | 178 | 178 | 177 | 177 | 178 |
| príkazy Redis [/s] | 401 | 381 | 401 | 379 | 401 | 383 | 388 |
| envelope Sentry / 5 min | 905 (tx) | 905 (span) | 905 (tx) | 905 (span) | 905 | 905 | 905 |

Ostatné scenáre (n = 3, e n = 1):

| scenár | metrika | 1.14.1 | next | verdikt |
|---|---|---|---|---|
| a: 200 nečinných spojení, 5 min | CPU [% jadra] | 2,72 ± 0,09 | 3,07 ± 0,00 | +13 % horšie (+0,35 bodu) |
| | RSS priemer [MB] | 233 | 235 | bez rozdielu |
| | príkazy Redis [/s] | 28 | 21 | iné (adaptér 0.3 blokuje XREAD 5 s, nie 100 ms) |
| b0: ako b, traces 0 | CPU / úprava p99 | 19,0 / 8,6 ms | 21,8 / 26,5 ms | +15 % / 3× horšie |
| c: socket.io (zámky, dáta, vstup/výstup), 3 min | CPU [% jadra] | 32,3 ± 1,2 | 36,0 ± 1,5 | +12 % horšie |
| | potvrdenia p50 acquire / change / release / join / leave [ms] | 3,6 / 3,2 / 4,1 / 5,0 / 3,9 | 4,3 / 2,7 / 4,0 / 3,9 / 3,1 | zmiešané |
| | potvrdenia p99 (všetky typy) [ms] | 26–29 | 35–39 | +30–50 % horšie |
| | rozoslanie zámku/dát p50 / p99 [ms] | 61–65 / 117–126 | 3,2–4,7 / 39–43 | 13–20× / 3× lepšie |
| | priepustnosť [potvrdené op./s], vypršané | 390, 0 | 390, 0 | rovnaké |
| | príkazy Redis [/s] | 5118 | 6491 | +27 % (PUBSUB NUMSUB) |
| d: b na 2 inštanciách cez Redis, 3 min | CPU spolu [% jadra] | 38,2 ± 0,6 | 44,7 ± 0,7 | +17 % horšie |
| | úprava p99 v tej istej / medzi inštanciami [ms] | 6,5 / 17,9 | 13,2 / 31,4 | 2× / +76 % horšie |
| | rozoslanie sys poľa p50 [ms] | 59 | 6,1 | lepšie |
| e: ako b, 15 min (n = 1) | CPU / úprava p99 | 16,6 % / 10,4 ms | 17,1 % / 21,9 ms | |
| | sklon RSS [MB/min] | 0,40 | 0,43 | bez úniku |
| | minimum heapu 1. / posledná minúta [MB], sklon | 58,5 / 57,6, +0,03 | 64,7 / 65,5, −0,05 | bez úniku |

Čas štartu (spustenie → oba porty počúvajú, Mongo a Redis lokálne): `next` o ~100–130 ms dlhšie (~840 vs ~740 ms);
preload Sentry samotný je v `next` rýchlejší (monitor načítaný 100–110 vs 170–185 ms od štartu procesu).

## 2. Odkiaľ je rozdiel

### 2.1 Rozklad (b0 = traces 0, b0-nosentry = Sentry vypnutý cez `APP_DEPLOY_ENV=local`, b0-bare = navyše bez štartovacieho príznaku Sentry)

| metrika | bare 1.14.1 / next | nosentry 1.14.1 / next | b0 1.14.1 / next | kód | štart. príznak | SDK Sentry | spolu |
|---|---|---|---|---|---|---|---|
| CPU [% jadra] | 15,8 / 16,7 | 15,9 / 17,0 | 19,0 / 21,8 | +0,90 | +0,17 | +1,72 | +2,78 |
| úprava p50 [ms] | 1,81 / 2,41 | 1,82 / 2,40 | 1,96 / 2,61 | +0,60 | −0,02 | +0,06 | +0,64 |
| úprava p99 [ms] | 6,58 / 11,0 | 6,62 / 12,6 | 8,59 / 26,5 | +4,40 | +1,53 | +12,0 | +17,9 |
| slučka p99 [ms] | 1,90 / 2,81 | 1,95 / 3,39 | 2,33 / 6,39 | +0,91 | +0,53 | +2,63 | +4,07 |

Sentry stojí 1.14.1 3,1 bodu CPU (16 %), `next` 4,8 bodu (22 %). Časť „SDK" je porovnanie `enabled: true` s `false`,
teda aj samotné jadro SDK (kontext, spracovanie spanov), nielen integrácie. p99 v b0 je zaťažené driftom okna (`next`
mal v neskoršom okne b0-noflush p99 12,1 ms, nie 26,5) – rozklad p99 berte ako smer, nie veľkosť.

### 2.2 Profil (`--cpu-prof`, b0, jeden beh na verziu, vlastný čas celého procesu)

Zaneprázdnený čas 25,1 s (1.14.1) proti 34,7 s (`next`) z 328 s behu. Rozdiel podľa balíkov:

| balík | 1.14.1 [s] | next [s] | Δ [s] | čo tam je |
|---|---|---|---|---|
| natívne | 4,22 | 8,78 | +4,57 | `run` 1,98, `RandomBytesJob` 1,36, `writev` 2,04 (v 1.14.1 1,49) |
| GC | 1,54 | 4,59 | +3,05 | |
| lib0 | 0,63 | 3,23 | +2,60 | `uuidv4` 0,47, Encoder, `_writeVarStringNative` 0,38 |
| y-protocols | – | 1,73 | +1,73 | `applyAwarenessUpdate` 0,96, `encodeAwarenessUpdate` 0,55 |
| crossws | – | 0,90 | +0,90 | WebSocket vrstva Hocuspocus 4 (namiesto `ws` 0,92 → 0,06) |
| @hocuspocus/server | 5,66 | 2,48 | −3,17 | v3 mal y-protocols a lib0 zabalené vo svojom builde |
| Sentry (@sentry/*) | 0,39 | 0,48 | +0,09 | vlastný čas SDK je malý; jeho cena sa ukazuje inde (natívny čas, GC) |

Teda `node:crypto` (`randomFillSync` → `RandomBytesJob.run`) cez `lib0` `uuidv4`, GC a dekódovanie/kódovanie awareness –
to všetko vychádza z jedného miesta v Hocuspocus 4 (2.3).

### 2.3 Awareness v Hocuspocus 4

`@hocuspocus/server` 4.7.1 `MessageReceiver.ts:88–121`: pre **každú** awareness správu (každý pohyb kurzora, u nás
s každou úpravou) vytvorí pomocný `new Y.Doc()` (guid = `uuidv4` → `crypto.randomFillSync`, ďalší náhodný clientID),
`new Awareness` (so `setInterval`), dekóduje doň aktualizáciu, zavolá `beforeHandleAwareness` hooky, znovu zakóduje
a až potom použije na dokument. Hocuspocus 3 aktualizáciu použil priamo. Robí to len kvôli hookom
`beforeHandleAwareness`, ktoré nemáme (Database, Redis ani naša konfigurácia ho nedefinujú; Logger nepoužívame).

### 2.4 Sentry 11

Integrácie po našom filtri (bez Redis a Mongoose, s profilerom) sú v 10.70 a 11.8 rovnaké, 11 pridáva Dedupe,
WorkerThreads, Knex, Dataloader, Aws, Mastra, PiDurable, Mistral, Groq, TogetherAI, TypeSafe, Neon, McpServer
a – vždy, aj pri `defaultIntegrations: false` – **SpanStreaming** (posiela spany namiesto transakcií). Orezanie
integrácií ani návrat k transakciám CPU nezmenšili (3.2): náklad je v jadre SDK. Integrácie, ktoré nepotrebujeme:
všetky AI, rámcové a cudzie databázové, Console, NodeFetch, ChildProcess, WorkerThreads, ProcessSession, Modules,
ConversationId, Mongo (žiadne volanie Mongo nebeží pod HTTP spanom) a Profiling (nikdy nebeží, 4.2) – ich odobratie
nič nestráca, ale ani nič nezíska.

### 2.5 socket.io adaptér (scenár c)

`@socket.io/redis-streams-adapter` 0.2.3 (1.14.1) číta stream blokujúcim `XREAD BLOCK 100` na tom istom spojení, cez
ktoré `XADD`-uje; lokálne doručenie broadcastu čaká na `XADD`, teda až do konca bežiaceho `XREAD` – odtiaľ ~60 ms p50
pri každom rozoslaní v 1.14.1. 0.3.1 (`next`) číta cez vlastné spojenie (→ 3–7 ms), ale `serverCount()` robí
`PUBSUB NUMSUB` pri **každom** `fetchSockets()`/`serverSideEmit` (435 príkazov/s v c; ďalej viac `expire`/`hset`/`hdel`
zo zámkov viazaných na socket, 8a13987), čo pridáva cestu do Redis
každému listeneru, ktorý pýta členov miestnosti. Pravdepodobná príčina +12 % CPU a +30–50 % p99 potvrdení v c;
**neoverené** pokusom.

## 3. Čo pomáha a čo nie (každý variant proti `next` v tom istom okne, traces 1.0)

| variant | CPU Δ [bod] | úprava p50 / p95 / p99 Δ [ms] | slučka p99 Δ | GC Δ | verdikt |
|---|---|---|---|---|---|
| **awarefast** (b1-awarefast) | **−2,77** (17,9 → 15,2) | −0,42 / −2,38 / −2,69 | −0,78 | −0,13 | **pomáha** |
| awarefast (b1-tuned) | **−3,12** (19,4 → 16,3; 1.14.1 16,9) | −0,67 / −3,55 / −5,03 | −1,17 | −0,17 | **pomáha** |
| awarereuse (b1-awarefast) | −1,74 (bez rozdielu) | −0,29 / −1,69 / −2,39 | −0,25 | −0,06 | čiastočne |
| flushDelay: false (b0-noflush, traces 0) | −0,27 | −0,52 / −0,92 / −1,52 | 0,00 | −0,07 | malý vplyv |
| sentrymin (b1-sentrymin) | +0,34 | −0,10 / −0,71 / −0,70 | −0,10 | −0,03 | nepomáha |
| sentry-nohttp | −1,36 (bez rozdielu) | +0,07 / +0,44 / −0,57 | −1,29 (lepšie) | −0,17 (lepšie) | nepomáha CPU; stráca HTTP traces |
| sentry-floor (bez integrácií) | −0,43 | +0,27 / +0,92 / +0,38 | −1,20 (lepšie) | −0,17 (lepšie) | nepomáha CPU; stráca traces |
| sentry-nostream (`traceLifecycle: 'static'`) | +1,32 (bez rozdielu) | +0,21 / +0,41 / +0,26 | +0,65 (horšie) | +0,06 | nepomáha |

- **awarefast** uzatvára celú CPU medzeru (v okne b1-tuned 124 %), p99 o 64 %, p95 o 87 %, slučku a GC o ~35 %.
  Zvyšok p99 (+2,8 ms) a slučky je zvyšok kódu Hocuspocus 4/crossws a SDK Sentry 11.
- **awarereuse** (jeden zdieľaný scratch `Y.Doc`, hook cesta zostáva) šetrí len vytvorenie `Y.Doc`; slabšie ako awarefast.
  Je bezpečný s podmienkou: hooky vidia len `scratch.getStates()` (vlastná `Map` každej správy), obsah scratch dokumentu
  sa nikdy nečíta a súbežné správy (prekladané na `await`) majú každá vlastnú `Awareness`. Každá `new Awareness(doc)`
  však pridá na zdieľaný dokument poslucháča `destroy`, ktorý by sa hromadil – variant ho po správe odoberie, pričom
  číta interné `_observers` (lib0) a spolieha sa, že y-protocols 1.0.7 pridáva práve jedného. Krehké, neodporúčam.
- **flushDelay: false** (rozosielanie hneď ako v v3) zlepší p50 o 0,5 ms a p99 o 1,5 ms, CPU ani slučku nie.
- **Sentry:** žiadny variant CPU významne neznížil. nohttp a floor zlepšia slučku p99 (~−1,2 ms) a GC (−0,17), ale bez
  `Http` sa nepošle ani jeden trace (0 envelope v okne). `traceLifecycle: 'static'` nič nezíska a pri debug logu by
  vrátil 12× väčšie transakcie (4.1).

Overenie kópií: `lib/checkResolve.mjs` – každá kópia načíta tých istých 1685 súborov ako `next` (reálne cesty) okrem
záplatovaných (`@hocuspocus/server` a nezáplatovaná kópia `@hocuspocus/extension-redis`, ktorá `@hocuspocus/server`
importuje), po jednej inštancii yjs, y-protocols, lib0, `@hocuspocus/*`, `@sentry/node`, 0 chýb; zoznam integrácií
klienta Sentry po `init` potvrdený (`results/resolve-check/report.json`). `lib/checkAwarenessPatch.mjs` (Server + 2
provideri v procese): `next`, awarefast aj awarereuse doručia stav, kurzor aj odchod klienta; s `beforeHandleAwareness`
rozšírením awarefast sám vypne skratku (`passThrough=false`) a zmena z hooku dorazí.

Záplata awarefast (`collab-next-awarefast.patch`, ESM build `@hocuspocus/server` 4.7.1):

```diff
@@ MessageReceiver, case MessageType.Awareness
+				if (document.awarenessHooksPassThrough) {
+					applyAwarenessUpdate(document.awareness, update, origin);
+					break;
+				}
 				const scratchDoc = new Y.Doc();
@@ pred class Hocuspocus
+const noopBeforeHandleAwareness = () => new Promise((r) => r());
@@ Hocuspocus constructor, predvolené hooky
-			beforeHandleAwareness: () => new Promise((r) => r()),
+			beforeHandleAwareness: noopBeforeHandleAwareness,
@@ createDocument, pred document.beforeHandleAwareness(...)
+		document.awarenessHooksPassThrough = !this.configuration.extensions.some((extension) => typeof extension.beforeHandleAwareness === "function" && extension.beforeHandleAwareness !== noopBeforeHandleAwareness);
```

Konfigurácia sa medzi rozšírenia pridáva ako ďalšie „rozšírenie" s vlastným predvoleným no-op hookom, preto obyčajná
kontrola `typeof` hook nájde vždy; záplata rozpozná práve ten predvolený. Bez hooku je priame použitie rovnocenné:
pomocná kópia filtruje hodiny (clock) rovnako ako cieľová awareness (nový klient s clock 0 sa ignoruje v oboch,
odstránenie so stavom `null` prejde v oboch).

flushDelay (`collab-next-noflush.patch`): v `dist/server/hocuspocus.js` do volieb `Server` pridané `flushDelay: false`.
Sentry varianty (`collab-next-sentry*.patch`, len `dist/index.js`): sentrymin = `defaultIntegrations: false` + EventFilters,
FunctionToString, LinkedErrors, Dedupe, RequestData, NodeSystemError, OnUncaughtException, OnUnhandledRejection,
ContextLines, Context, Http; nohttp = to isté bez Http; floor = `integrations: []`; nostream = integrácie ako `next`
+ `traceLifecycle: 'static'` (MIGRATION.md 11, „Opting out of span streaming"; v `@sentry/core` 11.8
`server-runtime-client.js` sa SpanStreaming pridá len mimo `'static'`).

## 4. Produkcia

### 4.1 Debug log (b1-prod − b1, tá istá verzia; zahŕňa aj profiles 1.0, ktoré nič nerobí, 4.2)

| metrika | cena v 1.14.1 | cena v next |
|---|---|---|
| CPU [bod] | **+4,31** (17,5 → 21,8) | −1,25 (v šume) |
| úprava p99 [ms] | +9,1 (7,1 → 16,2) | −0,5 |
| slučka p99 [ms] | +8,8 (2,2 → 11,0) | +1,5 |
| GC [bod] | +0,97 | +0,31 |
| RSS max [MB] | +21 (291 → 312) | +2 |
| objem logu [MB / 5 min] | 10,0 | 10,0 |
| dáta do Sentry [MB / 5 min] | **6,4 → 76,6** (transakcie) | 4,4 → 4,4 (spany) |

Pri debug logu narastú transakcie Sentry 10 dvanásťnásobne (pravdepodobne breadcrumbs z logu pripojené ku každej
transakcii; obsah envelope sa neukladal) – odtiaľ cena v 1.14.1. Spany Sentry 11 breadcrumbs nenesú. Debug log
pri tejto záťaži = ~1,8 MB/min (~2,6 GB/deň; 10 MB za beh ~5,5 min) a obsahuje obsah polí a celé dokumenty
(mongoose debug).

### 4.2 Profily

`SENTRY_PROFILES_SAMPLE_RATE=1.0` nerobí nič: `nodeProfilingIntegration` má v 10 aj 11 predvolené
`profileLifecycle: 'manual'` a aplikácia nikde nevolá `startProfiler()`; v b1-prod nedorazila ani jedna položka
`profile_chunk` (len `transaction`/`span` 900 a `sessions` 5 za okno).

### 4.3 Pamäť a CPU proti limitom podu (600Mi / 1100m)

RSS max 312 MB (1.14.1) a 305 MB (`next`) v b1-prod, v ostatných scenároch ≤ 322 MB (b0-cpuprof s profilerom) – asi
polovica limitu 600 Mi = 629 MB a pod requestom 400 Mi = 419 MB. heapUsed max ~116 MB pri `--max-old-space-size=200`
(heapTotal ~200 MB). CPU za sekundu max 39 % (1.14.1) / 35 % (`next`) jadra v b1-prod proti limitu 110 %; server bol
pripnutý na 1 jadro (`taskset`), k8s throttling (CFS kvóta) sa nemeral.

## 5. Šum a drift okien

- Medzi oknami sa hodnoty tej istej verzie posúvajú viac ako medzi opakovaniami v okne: `next` CPU v b1 20,4, v ďalších
  oknách 17,9 / 18,4 / 18,4 / 19,4; 1.14.1 17,5 (b1) a 16,9 (b1-tuned), v b0 (traces 0) dokonca 19,0. `next` p99 v b0
  26,5 ms, v okne b0-noflush 12,1 ms. Preto sa varianty porovnávajú len s `next` z toho istého okna; stĺpec „uzavretá
  časť" v `summary.md` pri 1.14.1 z iného okna (b1) je len orientačný (napr. 589 % pri awarefast je artefakt).
- Stroj: i9-13900HX (P- aj E-jadrá), WSL2 so 16 vCPU; na ktoré fyzické jadro Windows vCPU dá, neovplyvníme. Mongo
  a Redis v Docker Desktop (sieť cez localhost forwarding). Generátor na tom istom stroji (jadrá 7–13); jeho slučka
  p99 ~1 ms vo všetkých behoch, CPU 4–33 % jadra – nebol úzkym hrdlom.
- Zaťaženie VM počas okien 0,5–2,1 jadra (server + generátor + Mongo + Redis); iná práca prakticky žiadna, okrem
  krátkych kontrol na jadre 0 počas behov b1-prod 1–2 (+0,05–0,1 jadra, hodnoty behov v rozsahu ostatných; neopakované).
- Opakovania n = 3 (e, b0-cpuprof n = 1). Šum p99 je väčší ako p50; rozdiely p99 do ~2 ms považujte za neisté.

## 6. Čo sa nemeralo / neoverené

- Skutočné prehliadače (TipTap, ProseMirror, vykresľovanie), sieť, TLS a nginx v pode; k8s CFS kvóta 1100m namiesto
  pripnutia; Redis a Mongo v Azure (latencia, Atlas `w=majority`, replika set) – lokálne standalone `mongo:8.0.20`
  a `redis:7.2.4`.
- Skutočné hodnoty Sentry okrem tých z variable group (traces/profiles 1.0 merané) a skutočný Sentry server (falošný
  endpoint odpovedá hneď).
- Varianty (awarefast, Sentry) len v scenári b; a, c, d, e s nimi nie. Príčina horšieho c/d (adaptér 0.3,
  `PUBSUB NUMSUB`) je hypotéza bez pokusu.
- Dlhšie ako 15 min (únik pomalší ako ~0,05 MB/min by nebol vidieť), viac miestností (>100), veľké dokumenty,
  búrky reconnectov, validátor článkov (MySQL).
- Node 24.15 lokálne, v obraze 24.21. Profil CPU len v b0, jeden beh na verziu, bez variantov.
- Opravený kód (b1-final, b1prod-final) len v scenári b, bez profilu a bez awarefast; scenáre a, c, d, e po oprave nie.

## 7. Odporúčania

1. **Vydať `next` s opravami H3 a H4** – po nich je CPU vyrovnané (bežná konfigurácia) alebo lepšie (produkčná),
   zápisov do Mongo je 3× menej, socket.io rozosielanie je o rád rýchlejšie a únik sa neukázal.
2. **Awareness fast path** – nahlásiť/navrhnúť upstream do Hocuspocus (preskočiť pomocný `Y.Doc` a `Awareness`, keď
   žiadne rozšírenie nemá `beforeHandleAwareness`); kým nebude vydané, zvážiť `yarn patch @hocuspocus/server` so
   záplatou vyššie (na neopravenom kóde CPU −15 %, p99 −30 až −35 %; je to iná cesta ako H3/H4, preto sa očakáva, že
   sa sčíta – overiť sadou `b1-tuned` nad opravenou kópiou). Pred nasadením test v `test/hocuspocus.test.ts`
   (awareness s hookom aj bez).
3. **Sentry neorezávať kvôli výkonu** – žiadny variant nepomohol; ponechať predvolené integrácie bez Redis/Mongoose,
   span streaming ponechať (`'static'` nič nezíska a s debug logom by vrátil 12× väčšie transakcie).
4. **LOG_LEVEL v produkcii z `debug` na `info`** – v 1.14.1 dnes stojí +4,3 bodu CPU, 12× viac dát do Sentry a ~2,6 GB
   logu denne pri tejto záťaži; loguje obsah polí a dokumentov. V `next` je CPU cena malá, objem a obsah zostávajú.
5. **`SENTRY_PROFILES_SAMPLE_RATE`** – dnes nemá účinok; buď nastaviť 0 a odobrať `nodeProfilingIntegration`, alebo ak
   profily chceme, zapnúť `profileLifecycle: 'trace'` a pred nasadením zmerať.
6. **Adaptér socket.io 0.3** – overiť a zmenšiť cenu `PUBSUB NUMSUB` (menej `fetchSockets` na listener, alebo
   `serverCount` podľa heartbeatov adaptéra); zmerať scenárom c.
7. **flushDelay** ponechať predvolené (0); `false` dáva len ~0,5 ms na p50.
8. Pri ďalšej zmene zopakovať `bash perf/run-all.sh --name <nová> --sets b1-final,b1prod-final` (a c, d), prípadne
   s profilom (`b0-cpuprof`) – po oprave chýba profil, ktorý by ukázal, kde je zvyšok p99.

## 8. Nastavenie merania

- **Verzie.** 1.14.1: `git archive 1.14.1` → `perf/collab-1.14.1`, `yarn install --immutable`, `yarn build` (lint +
  tsc, zelené). `next`: pracovný strom `/home/volar/projects/petit/collaboration` (vetva `next`, HEAD 7262b58
  + necommitnuté zmeny, `dist` z 21. 10. 13:30, novší ako `src`), bez prebudovania. Každý beh zapisuje hash `dist`;
  počas kampane sa nemenil (`06e65a1cec20cfa2` 1.14.1, `879d7cf42500ec60` next aj kópie awarefast/awarereuse, ktoré
  menia len `node_modules`). Od sady b1-awarefast aj stav stromu (`source`): vo všetkých behoch HEAD 7262b58,
  rovnaký hash necommitnutých zmien `527748672f908bb4`, `dist` novší ako `src`.
- **Štart presne ako `prod` skript** danej verzie: `NODE_OPTIONS` sa číta z jej `package.json` (`--max-old-space-size=200
  --require @sentry/node/preload|--import @sentry/node/import --max-http-header-size=65536`), za Sentry sa pridá monitor
  (`--require` pre 1.14.1, `--import` pre `next`, lebo Node spúšťa všetky `--require` pred `--import`),
  `node dist/index.js`, `taskset -c 2` (d: druhá inštancia jadro 3). Čisté prostredie: `NODE_ENV=production`,
  `APP_DEPLOY_ENV=perf` (Sentry zapnutý; `local` = vypnutý), `LOG_LEVEL=info` (b1-prod `debug`),
  `ALLOW_MULTIPLE_COLLAB_SERVER_INSTANCES=true` (adaptér + Hocuspocus Redis aj pri jednej inštancii, ako pri viacerých
  podoch), `REDIS_KEY_PREFIX=collab:`, `SENTRY_DSN` na falošný endpoint, `SENTRY_PROFILES_SAMPLE_RATE=0` (b1-prod 1.0),
  `MYSQL_URL` na zatvorený port (pool sa pripája až pri prvom dotaze, žiadny scenár ho nerobí; log bez chýb).
- **Služby.** `perf-collab-mongo` (`mongo:8.0.20`, standalone, WiredTiger cache 0,25 GB, 1 GB, jadrá 4–5, port 27117),
  `perf-collab-redis` (`redis:7.2.4`, jadro 6, port 6179) – verzie z `tools/anzu-docker-services`. Pred každým behom
  `dropDatabase` + `FLUSHALL` (rovnaké počiatočné dáta).
- **Klient = zodpovedajúce dvojice.** 1.14.1 + admin-cms produkcia (origin/master): `@hocuspocus/provider` 3.4.4,
  `socket.io-client` 4.8.3, yjs 13.6.32; `next` + admin-cms `next`: provider 4.7.1, socket.io-client 4.8.4, yjs 13.6.33;
  oba y-protocols 1.0.7, `ws` 8.21.0 (WebSocket v Node s cookie). Vlastný ES256 pár kľúčov, cookie `anz_jp`/`anz_js`.
- **Generátor** (`lib/generator.mjs`, 4 worker vlákna, celé miestnosti vo vlákne): vstup ako cms – moderátor
  `joinCollabRoom` (`moderated`, `editors: ['bodyEditor']`), ostatní `occupied` → `requestToJoin` → moderátor
  `approveRequestToJoin` → znova `joinCollabRoom`; moderátor na `startCollab` vráti telo článku (~5 kB: nadpis,
  12 odsekov s tučným a odkazom, obrázok, zoznam), `enteredCollabRoom`; potom každý editor vlastný provider (vlastný
  WebSocket ako cms) s awareness `user` ako CollaborationCaret. Úprava = jeden znak do vlastného odseku
  (`Y.XmlText.insert`) + awareness `cursor` (relatívna pozícia). **Značka:** id vloženej položky Yjs
  (`clientID:clock`) a čas odoslania; editor B v tom istom vlákne pri prijatí aktualizácie (dekódovanej) zmeria
  oneskorenie. sys API: `POST /api/sys/v1/room-data/<room>/perfSysField` každých 10 s na miestnosť (b, d, e) – jediné
  HTTP požiadavky, ktoré Sentry trasuje (bez nich traces 1.0 neposlal nič). c: na editora cyklus 1/s
  `acquireFieldLock` → 2× `changeFieldData` → `releaseFieldLock` (vlastné pole, časové limity ako common-admin) a 30
  návštevníkov `joinCollabRoom`/`leaveCollabRoom` vo voľných miestnostiach každé 2 s.
- **Metriky.** CPU = utime+stime z `/proc/<pid>/stat` každú sekundu; RSS = VmRSS; heap, oneskorenie slučky
  (`monitorEventLoopDelay`, rozlíšenie 10 ms, uvádza sa prekročenie rozlíšenia) a GC (PerformanceObserver) v monitore,
  okno riadené kontrolným súborom; štart = spustenie → oba porty počúvajú; Mongo `serverStatus` (findAndModify =
  zápisy dokumentov), Redis `INFO commandstats`, falošný Sentry počíta envelope a položky podľa typu; zaťaženie VM
  z `/proc/stat`; CPU a slučka generátora. Okno merania po zahriatí 20 s (c 15 s).
- **Scenáre a dĺžky.** a 5 min, b 5 min, c 3 min, d 3 min, e 15 min (c a d zadanie dĺžku neuvádzalo). Každá sada 3×
  na verziu striedavo A/B (e a cpuprof 1×). Kampaň `main` trvala 21. 10. 16:32 – 22. 10. 02:12 (s prestávkou),
  94 behov; zadanie (a, b0, b1, c, d, e) ~3 h, zvyšok diagnostiky a pokusy podľa vedúceho.
- **Odchýlky od zadania:** pridané volania sys API do b/d/e (inak traces nemali čo merať); `ALLOW_MULTIPLE=true`;
  LOG_LEVEL info (produkčná hodnota debug zmeraná zvlášť, b1-prod); značka cez id položky Yjs namiesto textu;
  Mongo standalone.

## 9. Nástroje (opätovné spustenie)

`perf/run-all.sh [--name N] [--sets …] [--reps 3] [--redo set/beh,…] [--tuned variant]` (služby → kampaň → súhrn),
`services.sh up|status`, `make-variants.sh` (kópie `collab-<variant>` + `.patch`), `lib/checkResolve.mjs`,
`lib/checkAwarenessPatch.mjs`, `lib/analyze.mjs <kampaň>` (súhrn), `lib/profileSummary.mjs <cpuprofile>`.
Sady: `a, b0, b1, c, d, e` (zadanie), `b0-nosentry, b0-bare, b0-cpuprof, b0-noflush, b1-prod, b1-awarefast,
b1-sentrymin, b1-sentry-variants, b1-tuned` (diagnostika a pokusy), `b1-final, b1prod-final` (po oprave). Behy
s `result.json` sa preskočia; kampaň odmietne bežať vedľa inej, pri obsadených portoch, pod 6 GB voľnej pamäte
a pod 10 GB voľného disku.

## 10. Surové výsledky

`perf/results/main/<sada>/<verzia>-<opakovanie>/`: `result.json` (všetky metriky, časová os CPU/RSS, stav zdroja),
`server-*.log`, `monitor-*.jsonl` (pamäť, slučka, GC po sekundách), `generator.json` (oneskorenia, čítače),
`cpuprof-*/*.cpuprofile` (b0-cpuprof). Súhrn `results/main/summary.md`/`.json`, kontrola kópií
`results/resolve-check/`.

## Po oprave (b1-final, b1prod-final)

Meraný `next` (`source` v každom behu): HEAD 7262b58 + necommitnuté zmeny (hash `12e8b4d52b739839`, iný ako pred
opravou `527748672f908bb4`), `dist` zostavený 22. 10. 02:39:32, posledná zmena `src` 02:36:00 → `distOlderThanSrc:
false`; hash `dist` `a8274d7946ac181d` vo všetkých 6 behoch (pred opravou `879d7cf42500ec60`). 1.14.1 nezmenená
(`06e65a1cec20cfa2`). Rovnaké nastavenie ako b1 a b1-prod, 1.14.1 a `next` striedavo, n = 3.

| metrika | b1 1.14.1 | b1 next | **b1-final 1.14.1** | **b1-final next** | b1-prod 1.14.1 | b1-prod next | **b1prod-final 1.14.1** | **b1prod-final next** |
|---|---|---|---|---|---|---|---|---|
| CPU [% jadra] | 17,5 ± 0,7 | 20,4 ± 0,5 | 17,8 ± 0,4 | **18,5 ± 0,9** (+4 %, bez rozdielu) | 21,8 ± 0,5 | 19,2 ± 0,8 | 22,6 ± 0,5 | **19,0 ± 0,4** (−16 %) |
| úprava p50 [ms] | 2,01 | 2,99 | 2,05 | 2,67 (horšie) | 1,70 | 2,31 | 1,88 | 2,51 (horšie) |
| úprava p95 [ms] | 4,18 | 9,48 | 4,21 | 6,73 (horšie) | 5,91 | 7,66 | 6,50 | 6,62 |
| úprava p99 [ms] | 7,10 | 17,2 | 6,90 ± 1,1 | **11,5 ± 1,5** (horšie) | 16,2 | 16,7 | 17,0 ± 1,5 | **13,0 ± 1,9** (lepšie) |
| slučka p99 [ms] | 2,19 | 6,00 | 2,21 | 3,47 (horšie) | 11,0 | 7,51 | 11,2 | 5,23 (lepšie) |
| GC [% času] | 0,30 | 0,73 | 0,30 | 0,57 (horšie) | 1,27 | 1,05 | 1,28 | 0,72 (lepšie) |
| heapUsed priemer [MB] | 83,3 | 87,6 | 82,0 | 88,9 | 75,3 | 84,7 | 75,0 | 88,4 (horšie) |
| RSS priemer / max [MB] | 287 / 291 | 300 / 303 | 286 / 290 | 300 / 303 | 298 / 312 | 303 / 305 | 297 / 312 | 304 / 306 |
| zápisy Mongo [/min] | 177 | 177 | 177 | **60** | 178 | 178 | 177 | **60** |
| príkazy Redis [/s] | 401 | 381 | 401 | 367 | 401 | 379 | 401 | 368 |
| debug log [MB/beh] | – | – | – | – | 10,0 | 10,0 | 10,0 | **3,99** |
| sys API p99 [ms] | 10,0 | 16,1 | 9,7 | 12,1 | 19,2 | 15,7 | 18,8 | 13,1 (lepšie) |
| rozoslanie sys poľa p99 [ms] | 137 | 48 | 132 | 32 (lepšie) | 136 | 49 | 143 | 46 (lepšie) |

V tom istom okne: medzera CPU `next` − 1.14.1 v bežnej konfigurácii klesla z +2,9 bodu (b1; v okne b1-tuned +2,5)
na +0,7 bodu; zmenšenie ~2 body je nad šumom (2× SE ≈ 1,5 bodu). p99 úpravy z +10,1 na +4,6 ms, slučka p99 z +3,8
na +1,3 ms, GC z +0,43 na +0,27 bodu. 1.14.1 sa medzi oknami posunula len o 0,3 bodu.

Overenie H3 a H4:
- **H4 (debounce 5000 / maxDebounce 30000): potvrdené.** Zápisy dokumentov (`findAndModify`) 177 → 60 za minútu =
  30 dokumentov × 2/min (pri nepretržitom písaní rozhoduje `maxDebounce` 30 s; predtým 10 s → 180/min). Debug log
  10,0 → 3,99 MB na beh (mongoose debug vypisuje pri každom zápise celý dokument).
- **H3 (ukladanie zo stavu rozšírenia, bez druhého kódovania): účinok v percentách CPU nevieme priamo ukázať** – profil
  opraveného buildu sa nemeral. Profil pred opravou (b0, 328 s) dáva ceste ukladania (mongodb 0,39 s, mongoose 0,38 s,
  bson 0,12 s, js-base64 0,05 s a kódovanie stavu v yjs `writeClientsStructs`/`writeStructs`/`writeDeleteSet` ~0,25 s)
  spolu ~1,2 s, teda ~0,4 bodu CPU; 3× menej zápisov a jedno kódovanie namiesto dvoch z toho ušetrí odhadom 0,3–0,4
  bodu. Celé zmenšenie (~2 body, menej GC a kratšia slučka) tým vysvetlené nie je: zvyšok môžu tvoriť menšie
  alokácie (base64 reťazce celých dokumentov, menej GC: 0,73 → 0,57 %), ostatné opravy cyklu a drift okna (`next`
  sa medzi oknami pohyboval 17,9–20,4 %). Na rozhodnutie treba `b0-cpuprof` nad opraveným buildom.
- **Awarefast nad opraveným kódom (odvodené, nemerané):** rieši inú cestu (awareness, nie ukladanie), na neopravenom
  kóde ušetril 2,8–3,1 bodu CPU, 2,7–5,0 ms p99, ~0,8–1,2 ms slučky a ~0,15 bodu GC. Ak sa sčíta, `next` by bol
  v bežnej konfigurácii ~15,5–16 % CPU (1.14.1 17,8 %) a p99 ~7–9 ms (1.14.1 6,9 ms). Overiť: kópia opraveného
  `dist` + záplata awarefast (`make-variants.sh`, potom `--sets b1-tuned --tuned <kópia>`).

## Upratanie

Servery a generátory po každom behu zastavené (SIGTERM, všetky skončili kódom 0). Kontajnery `perf-collab-mongo`
a `perf-collab-redis` po poslednej sade odstránené (`docker rm -f perf-collab-mongo perf-collab-redis`); `run-all.sh`
ich pri ďalšom meraní vytvorí znova (`services.sh up`). Nástroje, kópie variantov a výsledky ostávajú v `perf/`.
