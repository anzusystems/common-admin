# HEAP-LOCK: pamäť servera 400 MB, kratšie čakanie na zámok miestnosti, menšie dávky finalizéra

Zadanie: `krok5-praca/zadania/zadanie-heap-lock-retry.md`, odporúčania `STATS-PERF.md` §5 body 1–3 (schválil vlastník).
Skripty a logy: `/home/volar/projects/anzusystems/krok5-praca/heap-lock/`. Nič nie je commitnuté.

- Časť A: worktree `krok5-praca/collab-next-wt`, vetva `feature/collab-heap-lock-retry` nad `origin/next` 1b9163b.
  Chýbali `node_modules`, preto som spustil `yarn install --immutable`.
- Časť B: `petit/collaboration`, vetva `feature/collab-stats` nad 66106b2.

## 1. Časť A (next)

### 1.1 Heap

- `package.json` `prod`: `--max-old-space-size=200` → `400`.
- Iné miesto v repozitári heap nespomína. Request a limit podu sú premenné pipeline
  (`DEPLOYMENT_APP_MEMORY_REQUEST` a `DEPLOYMENT_APP_MEMORY_LIMIT` v `docker/kubernetes/app-deployment.yaml`),
  hodnoty 400 Mi a 600 Mi sú mimo repozitára. Nebolo čo zosúladiť.

### 1.2 Čakanie na zámok miestnosti (`src/util/helper/exectionLockHelper.ts`)

Predvolené `retryDelay` a `retryJitter` Redlocku sú teraz 25 a 25 ms (predtým 200 a 200). Platia len pre zámok
miestnosti, ostatné zámky majú vlastné nastavenia.

**Overené v `@sesamecare-oss/redlock` 1.4.0** (`build/index.js:205-231`):

- pokusov je `retryCount + 1`;
- pred každým opakovaním sa čaká `max(0, retryDelay + floor((2·random − 1) · retryJitter))`;
- predtým to bolo 0–399 ms (stred 199,5 ms), teraz 0–49 ms (stred 24,5 ms);
- čakanie aj počet sa škálujú ×8, takže počty pokusov sú ×8.

| volanie | predtým | teraz | pri `random` 0,5 | stred | najdlhšie |
|---|---|---|---|---|---|
| `roomLockRetryCount`, všetky akcie miestnosti bez vlastného počtu | 10 × 200 ± 200 | **80** × 25 ± 25 | 2 000 → 2 000 ms | 1 995 → 1 960 ms | 3 990 → 3 920 ms |
| `changeFieldData`, upratanie po zlyhanom vstupe a odchode | 40 × 200 ± 200 | **320** × 25 ± 25 | 8 000 → 8 000 ms | 7 980 → 7 840 ms | 15 960 → 15 680 ms |

- **Pokusy do Redisu**: každý pokus je jeden round trip. Pri ~1 ms je to +70 ms a +280 ms, čo vyváži −35 ms a −140 ms
  zo zaokrúhlenia nadol, takže skutočné čakanie ostáva rovnaké.
- Pri kolízii robí čakateľ ~40 pokusov za sekundu namiesto ~5.
- **Rozptyl**: súčet 80 malých čakaní je skoro vždy 1,6–2,4 s (σ ~130 ms, predtým ~365 ms).
- **Vzťah k `duration`**: zmysel ostáva, lease mŕtveho držiteľa (1 s) vyprší počas čakania čakateľov.
  - Predtým to zlyhalo ~0,25 % pokusov: v toľkých behoch sa čakateľ vzdal skôr ako za 1 s (komentár testu).
  - Teraz je to prakticky 0.
- **Komentáre**: s časmi v `exectionLockHelper.ts` (`roomLockDuration`, `roomLockRetryCount`, nový pri `retryDelay`),
  `changeFieldDataListener.ts`, `joinCollabRoomListener.ts` a `leaveCollabRoomListener.ts`.
- **Nezmenené** (vlastné nastavenia, nie zámok miestnosti):
  - `extensionSettings`;
  - zámok poľa (3 × 100 ± 50 ms, ~450 ms pod 1 s ack klienta);
  - zámok zostavenia dokumentu (60 × 200 ± 50 ms, 9–15 s).

### 1.3 Changelog

`doc/Collaboration-Changelog/Unreleased/heap-room-lock-retry.md` podľa `hocuspocus-4-esm.md`: dátum 2026-10-23, autor
`@stanislav.volar`, `#TICKET`. Má dva body: heap a čakanie na zámok.

### 1.4 Testy

**`exectionLockHelper.test.ts`:**

- **Nový `it.each` (2 testy)**: miestnosť držaná inou akciou.
  - Pri `random` 0,5 sa čakateľ vzdá presne v 2 000 ms, pri 0,99999 v 3 920 ms.
  - Pri 10 × 200 ± 200 by to bolo 2 000 a 3 990 ms. Akcia nebeží.
- **„stops an action at 20 s"**: už nemockuje `Math.random`. Náhodná chyba ~0,25 % pri 200 ms je preč.
- Komentáre „~0-4 s" sú teraz „~2 s".

**`changeFieldDataListener.test.ts`:**

- „gives a change up after ~8 s" má rovnaké očakávania (v 7 900 ms ešte nie, v 8 100 ms áno), teraz 320 × 25 ms.
- **Testy poradia zápisov jedného soketu**: druhá zmena prišla 150 ms po prvej, pri mriežke 25 ms by sa trafili do
  rovnakej chvíle.
  - Posuny 100/150 ms som zmenil na 110/145 ms. Neskoršia zmena tak opakuje 5 ms pred prvou a dostane miestnosť skôr,
    ako predtým (50 ms pri 200 ms).
  - Overené dočasným výpisom (uloženie „Two" v 5 005 ms). Výpis som potom odstránil.

**`purgeRoomListener.test.ts`**: zmenil sa len komentár.

### 1.5 Kontroly (`heap-lock/kontroly.sh`, `kontroly-next.log`, `kontroly-next-*.log`)

Všetko skončilo s 0: `yarn lint:fix`, `yarn ci`, `yarn test` 3× (19 súborov, **131 testov**, predtým 129), `yarn build`
a `yarn tsc`.

## 2. Časť B (feature/collab-stats): finalizér

`src/manager/collabStatsFinalizer.ts`:

- **Dávka**: `finalizerBatchSize` 200 → **50**. Jedna transakcia má ≤ ~120 zápisov namiesto ~450.
- **Viac dávok za beh**: beh mal strop 200 (`ZRANGEBYSCORE … LIMIT 0 200` a `SRANDMEMBER stats:dropped 200`).
  Priepustnosť zachováva `finalizerBatchesPerRun` = **4**: beh robí dávky po sebe, ďalšiu len po plnej. Plná znamená
  50 relácií na rade alebo 50 zahodených, zapísaných bez chyby a pri zatvorenom breakeri.
  - Stále teda 200 za 30 s, ale po 50 v jednej transakcii.
  - Čítanie, `finalizeCollabSession` a zápis idú tiež po 50, takže synchrónna práca po výpadku Monga je
    rozložená.
- **Kód**:
  - pôvodná `finalize` je `finalizeBatch` a vracia aj `full`;
  - nová `finalize` sčíta výsledky dávok;
  - `FinalizerOutcome` sa nezmenil.
- **Chyba dávky** (výpadok) zapíše zlyhanie breakeru a ukončí beh. Breaker teda počíta zlyhané behy ako doteraz:
  otvorí sa po 3.
  - Dávky pred chybou sú zapísané a uprataté z Redisu.
- **Mutex behu**: 120 s ostáva nad najdlhším behom 4 × (snímok 2 s + transakcia 10 s) = 48 s. Komentár som upravil.
- **Snímok obsadených miestností** robí každá dávka, ktorá ich má medzi reláciami na rade. Keď je na rade viac ako 50
  relácií, sú to až 4 snímky za beh namiesto 1.

**Testy** (`collabStatsFinalizer.test.ts`, 24):

- nový: 250 ukončených relácií sa zapíše 200 v prvom behu (4 transakcie) a 50 v druhom (1). `collab_daily` má
  250 sólo, Redis je prázdny;
- nový: zo 150 relácií zlyhá 2. transakcia. Beh zapíše 50, breaker má `failures` 1 a 100 relácií čaká. Ďalší beh
  zapíše 100 a breaker vynuluje;
- „reads the dropped sessions 200 at a time" je teraz „50 at a time, 200 in a run" a overuje 4 transakcie.

**Kontroly** (`kontroly-stats.log`, `kontroly-stats-*.log`): všetko skončilo s 0.

- `yarn lint:fix`, `yarn ci`, `yarn build` a `yarn tsc`.
- `yarn test` 3×: **310 a 3 preskočené**.
- Raz s `REDIS_TEST_URL=redis://127.0.0.1:6398/15` proti `heap-lock-redis`: **313**. Kontajner je zmazaný.

`COLLAB-STATS.md` (finalizér): beh má najviac 4 dávky po 50 (`LIMIT 0 50`) a dávka ≤ ~120 zápisov.

## 3. Patche (`krok5-praca/perf/`)

- `collab-next-heaplock.patch` nad 1b9163b: 9 súborov, aj nový changelog. Overené `git apply --check` na čistom
  `git archive 1b9163b`.
- `collab-stats-batch50.patch` nad 66106b2: 2 súbory, overené rovnako.
- **Navyše `collab-stats-heaplock.patch`**: časť A nad 66106b2 + B, na meranie oboch na vetve štatistík.
  - `collab-next-heaplock.patch` sa tam priamo neaplikuje, lebo kontext `changeFieldDataListener.ts` a
    `leaveCollabRoomListener.ts` je iný.
  - Zlúčil som ho trojcestne po súboroch (`git merge-file`, báza 1b9163b) bez konfliktu.
  - Na 66106b2 + B + A prešli testy (**312 a 3 preskočené**) aj `tsc`.
  - Skripty: `patche.sh`, `patch-a-na-stats.sh`, `test-stats-heaplock.sh`.

## 4. Návrhy správ commitov

collaboration, časť A (`feature/collab-heap-lock-retry` → `next`):

```
perf: the production heap is 400 MB (was 200), and a room action waiting for the lock of the room retries every 25 ± 25 ms (was 200 ± 200 ms) with 8 times the retries, so it gives up after the same ~2 s (~8 s for a field change and the cleanup after a failed join or leave) while a collision costs tens of ms instead of hundreds
```

collaboration, časť B (`feature/collab-stats`):

```
perf: the finalizer of the collaboration stats writes 50 sessions in a transaction (was 200), up to 4 batches a run, the next only after a full one, so a run still writes 200
```
