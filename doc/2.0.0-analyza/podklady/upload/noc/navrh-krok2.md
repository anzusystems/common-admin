# Návrh modulov kroku 2: dopytovač a usadenie (2026-10-07, noc) — verzia 2 po posudkoch

Podklad na implementáciu kroku 2 z `upload-plan.md` (časti 3.1 až 3.3). Len návrh; nič z neho nie je v kóde
a nič sa nespúšťalo. Verzia 2 zapracúva posudok Codexu a Opusu (`podklady/upload/noc/` ich neobsahuje, sú v
dočasnom priečinku relácie) a rozhodnutia k otvoreným otázkam; čo sa oproti verzii 1 zmenilo, je v časti 0.2,
čo z posudkov po overení v kóde nesedelo, v časti 11.

Cesty v LIB sú relatívne k `src/domains/dam/`, v DAM k `src/domains/coreDam/`. `LT/` =
LIB `uploadQueue/__tests__/`, `DT/` = DAM `src/test/`. Čísla riadkov testov sú z verzie v `HEAD`.

---

## 0. Zhrnutie

### 0.1 Na jednu obrazovku

- Nový priečinok LIB `uploadQueue/settlement/`: **rytmus** (konštanty, čisté funkcie), **dopytovač** (časovač
  jednej fronty), **usadenie** (čisté funkcie „načítaný asset → riadok") a **zostava**
  (`createUploadSettlement(profile)`: sledovanie riadkov, jeden koordinátor čítaní, spúšťače).
- Každý sklad (LIB, DAM) má jednu zostavu a odovzdá jej **profil**: ako spáruje udalosť s riadkom, rolu a
  voľby riadku, čitateľov, cache, texty a háky.
- Dnešné mená funkcií skladov ostávajú do kroku 5 ako tenké obaly. `appNotificationListeners.ts`, widgety a
  väčšina existujúcich testov sa preto nemení.
- Udalosť nesie stav. Čítanie, ktoré spustila udalosť `processed` alebo `copied` (a obaly so starými menami),
  dostane **nápovedu stavu**: ak čítanie samo neukáže konečný stav, platí stav z udalosti. Je to dnešné
  správanie (LIB po udalosti usadí pri akomkoľvek `mainFile`, DAM zapíše stav hneď) a existujúce fixtúry bez
  `mainFile.fileAttributes` ostávajú platné.
- Všetky čítania (tik, notifikácia, ručné) idú jedným radom: naraz beží jedno. Proti starej odpovedi stojí
  identita riadku a číslo revízie riadku, ktoré zvyšuje každý zápis z udalosti.
- Časovače idú cez prepísateľný plánovač. Testy dopytovača majú ručný plánovač, testy skladov okamžitý.

### 0.2 Čo sa zmenilo oproti verzii 1

| Vec | Verzia 1 | Verzia 2 |
|---|---|---|
| Metadáta po udalosti `processed` (O1) | načítať | nenačítať, okrem riadku, ktorý bol zlyhaný (R6), a keď je do toho istého čítania zlúčený spúšťač `metadata` |
| Čítania z notifikácií | vlastná cesta mimo dopytovača | ten istý koordinátor ako tiky; čítajú len menované assety, každý jednou požiadavkou |
| Staré odpovede (O7) | poradové číslo v stave sledovania | revízia riadku vo vlastnej `WeakMap`, `untrack` ju nemaže, zvyšujú ju aj zápisy z udalostí; po každom `await` kontrola, že riadok je vo fronte |
| Hromadná úprava v DAM (O16) | `settleOn: 'never'` blokovalo aj `failed`, `duplicate` a metadáta | `never` platí len pre `processed`; `failed` a `duplicate` platia podľa `matches(…, 'settle')`; metadáta sa načítajú každému riadku bez formulára, brána len povoľuje zlyhaný riadok z `metadataFailures` |
| Prvé načítanie metadát | bez prepínačov | berie aj `mainFileSingleUse` a `mainFileInternal` |
| D5 | 20 minút, potom koniec | bez hranice |
| Zlyhané čítanie po `copied` | — | riadok ostáva a číta sa znova |
| LIB `failed` | čítanie assetu | zápis z udalosti bez čítania |
| LIB text chyby pri zlyhaní servera (O2) | voľba profilu | maže sa vždy, voľba zrušená |
| Konfigurácia | `" TRUE "` prijaté | presne `true` alebo `"true"` |
| Stav spojenia | `useDamNotificationsConnection` v `damNotifications.ts` | vlastný modul bez závislostí, aby šesť testov s podvrhnutým `damNotifications` ostalo bez zmeny |
| Sloty v DAM | `assetStatus` sa stráca | po usadení slotu sa asset prečíta raz a riadok doplní ako dnes |
| `damUploadFinish` (O15) | bez `endPointAsset` | preč ide len posledný príznak |
| Odber v LIB (O13) | lenivý, s odhlásením | lenivý, bez odhlásenia |
| Nový skorší termín počas čítania | strácal sa | dopytovač si ho pamätá |

---

## 1. Rozloženie súborov v LIB

Nové (`uploadQueue/settlement/`):

| Súbor | Obsah |
|---|---|
| `uploadSettlementTypes.ts` | typy z časti 2 |
| `uploadPollSchedule.ts` | `UPLOAD_POLL_SCHEDULE`, ostatné časové konštanty, `delayAfterRead()`, `firstDelay()` |
| `uploadSettlementRuntime.ts` | predvolený plánovač a viditeľnosť karty; prepísateľné v testoch |
| `uploadPoller.ts` | `createQueuePoller()`: časovač tikov jednej fronty, chybový rebrík |
| `uploadSettle.ts` | čisté funkcie zápisu (časť 3) |
| `uploadSettlement.ts` | `createUploadSettlement(profile)` |
| `__tests__/…`, `__tests__/support/manualScheduler.ts`, `__tests__/support/immediateScheduler.ts` | časť 9 |

Nové mimo priečinka: `composables/damNotificationsConnection.ts` (stav spojenia, 5.5).

Mení sa v kroku 2:

| Súbor | Zmena |
|---|---|
| `uploadQueue/store/uploadQueuesStore.ts` | profil LIB, zostava, obaly; `metadataLoaded`, `settleWithMetadata`, `clearError` sa sťahujú do zostavy; odber až s prvým riadkom |
| `api/uploadApi.ts` | zaniká `armNotificationFallback`, `calculateFallbackTime`, `notificationFallbackCallback`, obe konštanty a importy `fetchAsset`, `useUploadQueuesStore`, `commonT`; `damUploadFinish` stráca šiesty parameter |
| `uploadQueue/composables/uploadService.ts` | `finishUpload` nečíta príznak; `useUpload` vracia `finishAttempted()` |
| `uploadQueue/composables/uploadQueueItemRefresh.ts` | `refreshItem` volá `store.refreshAsset()` |
| `api/damAssetApi.ts` | `FETCH_BY_IDS_MAX_LIMIT` 25 → 50 |
| `composables/commonAdminCoreDamOptions.ts`, `src/AnzuSystemsCommonAdmin.ts` | konfigurácia (časť 7) |
| `composables/damNotifications.ts` | znormalizované voľby; zapisuje stav spojenia |
| `src/lib.ts` | exporty (6.6) |
| `src/locales/{sk,en}/common/damImage.json` | nový kľúč `uploadErrors.readFailed` |
| `src/test/importCycles.test.ts:100-108` | povolený cyklus `uploadApi ↔ sklad` zaniká (v kroku L7) |

Zaniká až v kroku 5: zvyšok `api/uploadApi.ts`, obaly so starými menami v skladoch, polia
`notificationFallbackTimer` a `notificationFallbackTry` v type riadku (v kroku 2 `@deprecated`, nikto ich
nečíta; `LT/uploadQueuesStore.test.ts:107` tvrdí, že časovač je `undefined`, čo ostane pravda).

---

## 2. Verejné rozhranie

### 2.1 Rola a voľby

```ts
// uploadSettlementTypes.ts
export const UploadRowRole = {
  Upload: 'upload',
  Slot: 'slot',
  MassEdit: 'massEdit',
  Copy: 'copy',
  ExternalImport: 'externalImport',
} as const
export type UploadRowRoleType = (typeof UploadRowRole)[keyof typeof UploadRowRole]

export interface UploadSettlePolicy {
  /** Čím sa pri tiku číta stav súboru riadku. `none`: riadok sa nikdy nesleduje. */
  reader: 'asset' | 'slots' | 'none'
  /**
   * Platí LEN pre stav `processed`.
   * `read`: nahratý až z čítania, udalosť čítanie len spustí.
   * `event`: stav z udalosti sa zapíše hneď, čítanie riadok doplní.
   * `never`: `processed` stav riadku nemení (hromadná úprava), len ho doplní.
   * `failed` a `duplicate` sa zapisujú každému riadku, ktorý spĺňa `matches(…, 'settle')`.
   */
  settleOn: 'read' | 'event' | 'never'
  duplicate: 'becomeOriginal' | 'markDuplicate'
  /** `load`: riadok má mať formulár a metadáta sa doňho načítajú. */
  metadata: 'load' | 'none'
}
```

Rolu vracia profil (`roleOf`). Kým krok 1 nepridá pole `role` do `UploadQueueItem`, profil ju odvodí z
`item.type`.

| Profil | Rola | reader | settleOn | duplicate | metadata |
|---|---|---|---|---|---|
| LIB | `upload` (`type: File`) | asset | read | becomeOriginal | load |
| LIB | `copy` (`type: Asset`) | asset | read | becomeOriginal | load |
| DAM | `upload` (`File`) | asset | event | markDuplicate | load |
| DAM | `externalImport` | asset | event | markDuplicate | load |
| DAM | `slot` (`SlotFile`) | slots | event | markDuplicate | none |
| DAM | `massEdit` (`Asset`) | none | never | markDuplicate | load |

### 2.2 Profil (odovzdáva sklad)

```ts
export interface UploadSettlementTarget {
  assetId: DocId
  /** Súbor, o ktorom udalosť alebo čítanie hovorí; `null`, keď ho volajúci nepozná. */
  fileId: DocIdNullable
}

export interface UploadSettlementProfile {
  /** Živý pohľad na fronty skladu. Zostava si riadky nedrží, vždy sa pýta. */
  queues(): Iterable<[UploadQueueKey, UploadQueue]>
  roleOf(row: UploadQueueItem): UploadRowRoleType
  policyFor(role: UploadRowRoleType): UploadSettlePolicy
  /**
   * `settle`: riadok smie dostať stav. `decorate`: smie sa doplniť bez zmeny stavu.
   * `metadata`: smie dostať metadáta z notifikácie o metadátach.
   */
  matches(row: UploadQueueItem, target: UploadSettlementTarget, purpose: 'settle' | 'decorate' | 'metadata'): boolean

  readers: {
    /** Jeden asset; `null`, keď neexistuje (404). Výnimka len pri chybe prenosu. */
    asset(assetId: DocId): Promise<AssetDetailItemDto | null>
    /** Assety jednej licencie. Chýbajúce v odpovedi nie sú. Odpoveď, ktorá nie je zoznam, je výnimka. */
    assets(licenceId: IntegerId, assetIds: DocId[]): Promise<AssetDetailItemDto[]>
    /** DAM: súbory všetkých slotov assetu (D3). Odpoveď, ktorá nie je zoznam, je výnimka. */
    slotFiles?(assetId: DocId): Promise<AssetFileNullable[]>
    /** LIB: asset, ktorému patrí pôvodný súbor duplikátu. */
    duplicateOriginAsset?(originFileId: DocId): Promise<AssetDetailItemDto>
    /** DAM: pôvodný súbor duplikátu, podľa typu. */
    duplicateOriginFile?(originFileId: DocId, assetType: DamAssetTypeType): Promise<AssetFileNullable>
  }
  caches: {
    addAuthors(ids: DocId[]): void
    addKeywords(ids: DocId[]): void
    fetchAuthors(): void
    fetchKeywords(): void
  }
  messages: {
    processingTooLong(row: UploadQueueItem): string // DAM: iný text pre slot
    readFailed(row: UploadQueueItem): string // R7
    assetMissing(row: UploadQueueItem): string // D7: existujúci text neznámej chyby
  }
  /**
   * `'load'`: tento riadok smie dostať metadáta z notifikácie, aj keď je zlyhaný. `undefined`: predvolené
   * pravidlá (3.6). DAM: riadok hromadnej úpravy, ktorý jeho hromadné načítanie vynechalo.
   */
  metadataGate?(queueKey: UploadQueueKey, row: UploadQueueItem): 'load' | undefined
  hooks: {
    /** Riadok dosiahol konečný stav: prepočítať počty a pustiť ďalší čakajúci upload. */
    onRowFinal(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /** Po každom prečítanom assete (DAM: `mainFile` do otvoreného detailu). */
    onAssetRead?(asset: AssetDetailItemDto): void
    /** Riadok so `settleOn: 'never'` sa dozvedel, že súbor je spracovaný (udalosť, tik alebo ručné čítanie). */
    onProcessedSeen?(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /** Riadok dostal metadáta. */
    afterMetadataLoaded?(queueKey: UploadQueueKey, row: UploadQueueItem): void
  }
  connection: {
    isPushAlive(): boolean
    onChange(callback: () => void): () => void
  }
}
```

### 2.3 Zostava (používa sklad)

```ts
export interface UploadSettlementEvent {
  kind: 'processed' | 'failed' | 'duplicate' | 'metadata' | 'copied'
  assetId: DocId
  fileId: DocIdNullable // `event.data.id`
  failReason?: AssetFileFailReasonType
  originAssetFile?: DocIdNullable
  assetType?: DamAssetTypeType | null
}

/** `settled`: hlavný súbor je v konečnom stave. `pending`: ešte nie je. `error`: čítanie zlyhalo alebo asset nie je. */
export type UploadRefreshOutcome = 'settled' | 'pending' | 'error'

export interface UploadSettlement {
  /** Riadok začal čakať na server. Riadok, ktorý nie je vo fronte `queueKey`, sa ignoruje. */
  track(queueKey: UploadQueueKey, row: UploadQueueItem, options?: { clientFailed?: boolean }): void
  untrack(row: UploadQueueItem): void
  /** Fronta vyčistená: jej dopytovač sa zruší. */
  dropQueue(queueKey: UploadQueueKey): void

  /** Notifikácia. Sľub sa splní po zápise (aj po oneskorenom čítaní) alebo po neúspešnom čítaní; nikdy neodmietne. */
  notify(event: UploadSettlementEvent): Promise<void>
  /** Ručné „Obnoviť": čítanie hneď, s metadátami, bez nápovede. */
  refreshAsset(target: UploadSettlementTarget): Promise<UploadRefreshOutcome>
  /** Volajúci vie, že súbor je spracovaný (obaly starých mien): čítanie hneď, s nápovedou `processed`. */
  settleKnownProcessed(target: UploadSettlementTarget, options: { withMetadata: boolean }): Promise<void>
  /** Známy duplikát bez čítania assetu: udalosť `duplicate` a kópia, ktorá v licencii už existuje. */
  settleKnownDuplicate(
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null
  ): Promise<void>
  /** Známe zlyhanie bez čítania. Synchrónne. */
  settleKnownFailed(target: UploadSettlementTarget, failReason: AssetFileFailReasonType): void

  hasTracked(): boolean
  dispose(): void
}

export function createUploadSettlement(profile: UploadSettlementProfile): UploadSettlement
```

### 2.4 Vnútorný stav zostavy

```ts
interface TrackState {
  queueKey: UploadQueueKey
  eligibleSince: number // ms z plánovača
  clientFailed: boolean // D5
  misses: number // po sebe idúce úspešné čítania bez assetu alebo súboru riadku (D7)
  readFailures: number // po sebe idúce zlyhané čítania (R7)
}
interface RowNotice {
  slow: boolean // 20 minút uplynulo
  readWarning: boolean // R7
  shown: 'slow' | 'readWarning' | null // čo zostava do `row.error` práve napísala
}
/** Čo má čítanie spraviť pre jeden cieľ. Pri zlúčení: `hint` ak aspoň jeden, ostatné logický súčet. */
interface ReadIntent {
  hint: 'processed' | null // stav z udalosti
  metadata: boolean // pri usadení `processed` načítať aj metadáta
  early: boolean // notifikácia o metadátach: metadáta smú prísť skôr než konečný stav
  seen: boolean // čítanie, ktoré má riadku `never` povedať „súbor je spracovaný" (všetko okrem notifikácie o metadátach)
}
interface PendingNamedRead {
  assetId: DocId
  targets: Map<string, { fileId: DocIdNullable; intent: ReadIntent }> // kľúč: fileId ?? ''
  dueAt: number
  failures: number // po sebe idúce zlyhané pokusy
  misses: number
  timer: unknown
  waiters: Array<() => void>
}

const tracked = new WeakMap<UploadQueueItem, TrackState>() // kľúč vždy toRaw(riadok)
const revision = new WeakMap<UploadQueueItem, number>() // predvolene 0; untrack ju NEMAŽE
const metadataLoaded = new WeakSet<UploadQueueItem>()
const reviveWithMetadata = new WeakSet<UploadQueueItem>() // zlyhaný riadok oživený udalosťou; ďalšie čítanie načíta metadáta (R6)
const notices = new WeakMap<UploadQueueItem, RowNotice>()
const pollers = new Map<UploadQueueKey, QueuePoller>()
const pending = new Map<DocId, PendingNamedRead>()
let clock = 0 // spoločné počítadlo revízií a začiatkov čítaní
let chain: Promise<void> = Promise.resolve() // koordinátor: jedno čítanie naraz
```

Riadky zostava nedrží v zozname. Hľadá ich v `profile.queues()` pri každom zápise; riadok odstránený z
fronty a fronta nahradená novým objektom (DAM `clearQueue`, `asset/store/uploadQueuesStore.ts:737-749`) tak
vypadnú samy. `isLive(row)`: niektorá fronta má `toRaw(queue.items).includes(toRaw(row))`.

---

## 3. Pravidlá zápisu

### 3.1 Stavy servera

`uploading` < `uploaded` < `stored` < konečné: `processed`, `duplicate`, `failed`. Backend dovoľuje
`processed → failed` a `duplicate → failed` (`AssetFileStatusManager.php:120-130`).

- Nekonečný stav nikdy neprepíše konečný stav riadku (`Uploaded`, `Failed`).
- Konečný stav z čítania sa zapíše vždy, aj cez iný konečný, ak čítanie nie je staršie než posledný zápis z
  udalosti do toho riadku (3.2).
- Riadok v stave `Stop` sa neprepisuje nikdy.
- Zlyhanie na strane klienta (riadok `Failed` nastavený v `catch` uploadu) môže neskorší stav servera
  prepísať (R6).

### 3.2 Revízia riadku

```ts
const bump = (row) => revision.set(toRaw(row), ++clock)
const isStale = (row, startedAt) => startedAt <= (revision.get(toRaw(row)) ?? 0)
```

- Každé čítanie si pri štarte (keď príde v rade na rad, tesne pred odoslaním) vezme `startedAt = ++clock`.
- Každý **zápis z udalosti** volá `bump(row)`: synchrónny stav pri `processed` v DAM, `settleKnownFailed`,
  `settleKnownDuplicate` (pri `markDuplicate` hneď, pri `becomeOriginal` v okamihu zápisu po čítaní originálu).
- Zápis z čítania sa do riadku nespraví, ak `isStale(row, startedAt)`. Čítania idú jedným radom, takže medzi
  sebou sa predbehnúť nemôžu; revízia chráni len pred čítaním, ktoré bolo na ceste, keď prišla udalosť.
- `untrack` revíziu nemaže. Riadok bez `TrackState` (nahrávajúci sa, zasiaty testom, hromadná úprava) má
  revíziu 0 a čítanie sa doňho zapíše.
- Po každom `await` vnútri zápisu (čítanie originálu duplikátu, čítanie assetu po usadení slotu) sa pred
  zápisom overí `isLive(row)` a `row.status !== Stop`.

### 3.3 Nápoveda stavu

```ts
const isFinal = (s) => s === 'processed' || s === 'duplicate' || s === 'failed'
const readStatus = asset.mainFile?.fileAttributes?.status
const status = isFinal(readStatus) ? readStatus : (intent.hint ?? readStatus)
```

Nápovedu `processed` nesú: udalosť `processed`, udalosť `copied`, `settleKnownProcessed`. Tik, ručné
„Obnoviť" a udalosť `metadata` nápovedu nemajú a rozhoduje stav z čítania.

### 3.4 Čo robí čítanie assetu (`applyAssetRead`)

```
applyAssetRead(asset, target, intent, startedAt):
  mainFile = asset.mainFile ?? null
  status   = podľa 3.3
  pre každú frontu a riadok z profile.queues():
    ak riadok.status === Stop alebo isStale(riadok, startedAt): ďalší
    voľby = policyFor(roleOf(riadok))

    ak mainFile a matches(riadok, target, 'decorate'):
      smie = matches(riadok, target, 'settle')
      ak status === processed:
        ak voľby.settleOn === 'never':
          decorate(riadok, asset, mainFile)
          ak intent.seen: hooks.onProcessedSeen(queueKey, riadok)
        inak ak smie:
          settleProcessed(queueKey, riadok, asset, mainFile, intent)
      inak ak status === duplicate a smie:
        await settleDuplicate(target, mainFile.originAssetFile, asset.attributes.assetType)
      inak ak status === failed a smie:
        settleFailed(queueKey, riadok, mainFile.fileAttributes.failReason)

    ak intent.early a matches(riadok, target, 'metadata'):
      tryLoadMetadata(queueKey, riadok, asset)

  caches.fetchAuthors(); caches.fetchKeywords()      // raz na čítanie
  hooks.onAssetRead?.(asset)
```

Poznámky:
- Vetva `never` je pred akoukoľvek kontrolou `fileAttributes`: riadok hromadnej úpravy sa doplní aj z odpovede
  bez stavu súboru, ako dnes (`DAM store:546-551`).
- `tryLoadMetadata` beží aj vtedy, keď asset nemá `mainFile` (dnes obe strany, a fixtúra
  `metadataFromServer()` v `DT/queue/slotNotifications.test.ts:541-547` ho nemá).
- Čítanie s konečným stavom usadí riadok bez ohľadu na to, čo ho spustilo. Čítanie po notifikácii o
  metadátach, ktoré už ukáže `processed`, teda riadok usadí (dnes by čakal na vlastnú udalosť).

### 3.5 `settleProcessed(queueKey, riadok, asset, mainFile, intent)`

```
bolZlyhaný = riadok.status === Failed alebo reviveWithMetadata.has(riadok)
riadok.status = Uploaded
ak isNull(riadok.fileId): riadok.fileId = mainFile.id            // kópia v LIB
decorate(riadok, asset, mainFile)
ak voľby.metadata === 'load' a !riadok.isDuplicate:
  ak intent.metadata alebo bolZlyhaný:
    ak !metadataLoaded.has(riadok): mergeLoadedMetadata(queue, riadok, asset)
    riadok.canEditMetadata = true
    notice.readWarning = false
    hooks.afterMetadataLoaded?.(queueKey, riadok)
reviveWithMetadata.delete(riadok)
notice.slow = false; syncNotice(riadok, { clear: true })        // 3.11
untrack(riadok); hooks.onRowFinal(queueKey, riadok)
```

`decorate(riadok, asset, mainFile)`: `assetStatus = asset.attributes.assetStatus`; ak je `mainFile` súbor
riadku (`isNull(riadok.fileId) || riadok.fileId === mainFile.id`): náhľad z `links.image_detail`; a ak riadok
nemá `canEditMetadata` a nie je rola `massEdit`: `mainFileSingleUse` a `mainFileInternal` z assetu.

Volanie je idempotentné: druhé čítanie toho istého stavu nič nepokazí (napísané hodnoty ostanú, lebo
`metadataLoaded`).

Kedy sa načítajú metadáta (O1):

| Čo čítanie spustilo | `intent.metadata` |
|---|---|
| tik, ručné „Obnoviť", udalosť `copied`, `settleKnownProcessed({ withMetadata: true })` | áno |
| udalosť `metadata` | áno (a navyše `early`) |
| udalosť `processed`, `settleKnownProcessed({ withMetadata: false })` | nie |
| udalosť `processed` zlúčená s čakajúcou udalosťou `metadata` toho istého assetu | áno |
| ktorékoľvek, ak bol riadok zlyhaný (R6) | áno |

### 3.6 `tryLoadMetadata(queueKey, riadok, asset)` — notifikácia o metadátach

```
ak voľby.metadata !== 'load' alebo riadok.canEditMetadata: koniec
brána = profile.metadataGate?.(queueKey, riadok)
ak brána !== 'load' a (riadok.status === Failed alebo riadok.isDuplicate): koniec
ak !metadataLoaded.has(riadok): mergeLoadedMetadata(queue, riadok, asset)
riadok.canEditMetadata = true
notice.readWarning = false; syncNotice(riadok)
hooks.afterMetadataLoaded?.(queueKey, riadok)
```

Stav riadku sa nemení. Dnešné správanie oboch strán (`LIB store:417-450`, `DAM store:618-648`), vrátane
toho, že v DAM dostane metadáta každý riadok bez formulára, ktorý nie je slot (aj riadok hromadnej úpravy).

### 3.7 `mergeLoadedMetadata(queue, riadok, asset)` — D6

„Prázdne" je to isté ako v hromadných operáciách (`uploadQueueMassOperations.ts:19`): `undefined`, `null`,
`''`, prázdne pole.

- `keywords`, `authors`: z assetu, len ak je zoznam riadku prázdny.
- `customData`: začne sa hodnotami zo servera a každý kľúč, ktorý má riadok neprázdny, ostane z riadku.
- `mainFileSingleUse` a `mainFileInternal` z assetu, bez podmienky (dnes `LIB store:431-432`, `DAM store:635`;
  hromadné operácie ich nemenia).
- `updateNewNames` pre autorov a kľúčové slová fronty, `authorConflicts`, `caches.addKeywords`,
  `caches.addAuthors` (autori aj konflikty), `metadataLoaded.add`.

Riadok, do ktorého pred načítaním nikto nepísal, dopadne presne ako dnes.

### 3.8 `settleFailed(queueKey, riadok, dôvod)`

`status = Failed`; `error = { hasError: true, message: '', assetFileFailReason: dôvod }` (O2: starý text sa
maže na oboch stranách); `canEditMetadata = false`; `notices` riadku sa vynulujú; `reviveWithMetadata.delete`;
`untrack`; `hooks.onRowFinal`.

`settleKnownFailed(target, dôvod)`: pre každý riadok, ktorý nie je `Stop` a spĺňa `matches(…, 'settle')`:
`settleFailed` a `bump`. Bez čítania, na oboch stranách (dnešné čítanie v LIB `store:396-414` slúžilo len na
získanie toho istého `id`).

### 3.9 Duplikát

`settleDuplicate(target, originFileId, assetType)` volá čítanie aj `settleKnownDuplicate` (ten navyše
`bump`). Podľa voľby riadku:

**`becomeOriginal`** (LIB, dnes `store:332-394`). Bez `originFileId` alebo pri type inom než obrázok sa nedeje
nič.
```
originál = await readers.duplicateOriginAsset(originFileId)
pri výnimke:
  pre živé riadky, kde matches(…, 'settle') a status === Processing:
    status = Failed; error.hasError = true; canEditMetadata = false
    untrack; hooks.onRowFinal                                   // inak by ho ďalší tik skúšal znova (O3)
  koniec
pre živé riadky, kde matches(…, 'settle') a status !== Stop:
  isDuplicate = true; status = Uploaded; chyba vymazaná
  fileId = originFileId; duplicateAssetId = originál.id; assetId = originál.id
  assetStatus, náhľad, keywords, authors, customData, oba prepínače z originálu
  updateNewNames, authorConflicts, cache; metadataLoaded.add; canEditMetadata = true
  bump; untrack; hooks.onRowFinal
caches.fetchAuthors(); caches.fetchKeywords()
```

**`markDuplicate`** (DAM, dnes `store:664-722`).
```
pre živé riadky, kde matches(…, 'settle') a status !== Stop:
  isDuplicate = true; status = Uploaded; canEditMetadata = false; chyba vymazaná
  značka = bump(riadok); untrack; hooks.onRowFinal
ak originFileId a assetType:
  súbor = await readers.duplicateOriginFile(originFileId, assetType)   // výnimka sa len zaloguje
  pre tie isté riadky, ak isLive, isDuplicate a revízia je stále `značka`:
    fileId = súbor.id; duplicateAssetId = súbor.asset; mainFileSingleUse = súbor.flags.singleUse; náhľad
```

### 3.10 Udalosti (`notify`)

Najprv sa zistí, či udalosť zodpovedá aspoň jednému riadku (`processed`, `copied`: `decorate`; `failed`,
`duplicate`: `settle`; `metadata`: `metadata`). Ak nie, nič sa nezapíše ani nečíta. Dnes LIB číta asset pri
každej udalosti, aj keď ho žiadna fronta nemá.

| Udalosť | Čo sa stane hneď | Čítanie |
|---|---|---|
| `processed` | riadky `settleOn: 'event'`: blok nižšie. Riadky `never`: `hooks.onProcessedSeen` | pomenované, o 250 ms, `{ hint: processed, metadata: false, seen: true }` |
| `copied` | nič | pomenované, o 250 ms, `{ hint: processed, metadata: true }` |
| `failed` | `settleKnownFailed` | žiadne |
| `duplicate` | `settleKnownDuplicate` | len čítanie originálu |
| `metadata` | nič | pomenované, o 2 s (D8), `{ early: true, metadata: true }` |

Synchrónny blok pri `processed` pre riadky so `settleOn: 'event'` (dnes `DAM store:514-536`):
```
pre živé riadky, kde matches(…, 'settle'), settleOn === 'event', status !== Stop:
  ak riadok.status === Failed: reviveWithMetadata.add(riadok)
  riadok.status = Uploaded
  ak !riadok.isDuplicate a metadataLoaded.has(riadok): riadok.canEditMetadata = true
  notice.slow = false; syncNotice(riadok, { clear: true })
  bump(riadok); untrack(riadok); hooks.onRowFinal(queueKey, riadok)
```
Ten istý blok sa použije, keď tik zo zoznamu slotov nájde súbor riadku spracovaný (4.4).

Zlučovanie: čakajúce čítanie je jedno na asset (`pending`). Nová udalosť doňho pridá cieľ (podľa `fileId`),
zlúči zámer a posunie termín na skorší z oboch. Udalosť `metadata`, na ktorú do 2 s príde `processed`, sa
tak prečíta spolu s ním o 250 ms a metadáta načíta.

### 3.11 Texty, ktoré píše zostava do `row.error`

Zostava píše dva texty do riadku, ktorý nie je v konečnej chybe: „trvá dlho" (`slow`) a varovanie R7
(`readWarning`). Aby si neprekážali:

```
syncNotice(riadok, { clear = false } = {}):
  chce = null
  ak notice.readWarning a voľby.metadata === 'load' a !riadok.canEditMetadata
     a !riadok.isDuplicate a riadok.status !== Failed:                  chce = 'readWarning'
  inak ak notice.slow a riadok.status === Processing:                    chce = 'slow'
  ak chce: riadok.error.hasError = true; riadok.error.message = text; notice.shown = chce
  inak ak clear alebo notice.shown: chyba riadku vymazaná; notice.shown = null
```

`clear: true` (usadenie ako spracovaný) maže aj chybu, ktorú zostava nenapísala, napríklad text klientskeho
zlyhania alebo text zasiaty testom. Varovanie R7 usadenie prežije, kým riadok nemá formulár (dnes
`DT/queue/slotNotifications.test.ts:314-329` pre okamžité varovanie).

### 3.12 Pravidlá z plánu

- **D5.** `catch` uploadu v sklade:
  `if (finishAttempted() && item.status === Failed) settlement.track(queueKey, item, { clientFailed: true })`.
  Riadok `Uploaded` (notifikácia predbehla odpoveď) sa nesleduje; zastavený a odstránený riadok `track` sám
  ignoruje, lebo už nie je vo fronte. Sledovaný riadok ide bežným
  rytmom, kým je vo fronte, bez časovej hranice (O5). Zapisuje sa doňho len konečný stav servera. Text „trvá
  dlho" nedostane.
- **D6.** Časť 3.7.
- **D7.** Úspešné čítanie, v ktorom asset sledovaného riadku (alebo jeho súbor v zozname slotov) chýba, zvýši
  `misses`; prítomnosť ho vynuluje. Pri hodnote 3: riadok v stave `Processing` zlyhá (`Failed`, `hasError`,
  `message = messages.assetMissing`, formulár vypnutý, `untrack`, `onRowFinal`); riadok `clientFailed` sa len
  prestane sledovať. Pre pomenované čítanie nesledovaného riadku pozri 4.5.
- **D8.** Oneskorenie 2 s má len čítanie spustené udalosťou `metadata`.
- **R6.** `bolZlyhaný` v 3.5.
- **R7.** Zlyhané čítanie (výnimka z čitateľa) zvýši `readFailures` každému sledovanému riadku, ktorého sa
  týkalo; úspešné ho vynuluje, zruší varovanie a `syncNotice` vráti text „trvá dlho", ak už bol ukázaný. Pri
  hodnote 3: `notice.readWarning = true`. Varovanie sa ukáže len riadku, ktorý má mať formulár a nemá ho
  (podmienky v `syncNotice`); riadky s `metadata: 'none'` (sloty) ho nedostanú nikdy (O4).

---

## 4. Čítania

### 4.1 Konštanty (`uploadPollSchedule.ts`)

```ts
export interface UploadPollModeSchedule {
  /** Veky najmladšieho riadku, v ktorých sa číta. */
  marksMs: number[]
  /** Po poslednej značke: do veku `untilMs` každých `everyMs`. */
  tiers: Array<{ untilMs: number; everyMs: number }>
  tailEveryMs: number
}

const S = 1000
const MIN = 60 * S

export const UPLOAD_POLL_SCHEDULE: Record<'dense' | 'sparse', UploadPollModeSchedule> = {
  dense: {
    marksMs: [5, 10, 16, 23, 31, 40, 50, 60].map((s) => s * S),
    tiers: [
      { untilMs: 5 * MIN, everyMs: 30 * S },
      { untilMs: 20 * MIN, everyMs: 1 * MIN },
      { untilMs: 60 * MIN, everyMs: 2 * MIN },
    ],
    tailEveryMs: 10 * MIN,
  },
  sparse: {
    marksMs: [10, 30, 60].map((s) => s * S),
    tiers: [
      { untilMs: 5 * MIN, everyMs: 1 * MIN },
      { untilMs: 20 * MIN, everyMs: 3 * MIN },
      { untilMs: 60 * MIN, everyMs: 5 * MIN },
    ],
    tailEveryMs: 10 * MIN,
  },
}

export const UPLOAD_POLL_MIN_GAP_MS = 2 * S // medzi automatickými čítaniami jednej fronty
export const UPLOAD_POLL_ERROR_LADDER_MS = [15, 30, 60, 120, 300].map((s) => s * S)
export const UPLOAD_POLL_SLOW_TEXT_AFTER_MS = 20 * MIN // D2
export const UPLOAD_POLL_MISSING_LIMIT = 3 // D7
export const UPLOAD_POLL_READ_FAILURE_LIMIT = 3 // R7
export const UPLOAD_NOTIFY_FILE_DELAY_MS = 250 // O6
export const UPLOAD_NOTIFY_METADATA_DELAY_MS = 2 * S // D8
export const UPLOAD_READ_BATCH_LIMIT = 50

export const firstDelay = (mode: 'dense' | 'sparse') => UPLOAD_POLL_SCHEDULE[mode].marksMs[0]

/** Odstup do ďalšieho čítania, keď má najmladší riadok vek `ageMs`. */
export function delayAfterRead(ageMs: number, mode: 'dense' | 'sparse'): number
// značka > ageMs existuje -> značka - ageMs; inak everyMs prvej úrovne s untilMs > ageMs; inak tailEveryMs
```

### 4.2 Plánovač a viditeľnosť (`uploadSettlementRuntime.ts`)

```ts
export interface UploadSettlementScheduler {
  now(): number
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}
export interface UploadSettlementVisibility {
  isVisible(): boolean
  onChange(callback: () => void): () => void
}

/** Objekt s meniteľnými poľami: test prepíše pole, nie väzbu. Produkčný kód sem nezapisuje. */
export const uploadSettlementRuntime: {
  scheduler: UploadSettlementScheduler
  visibility: UploadSettlementVisibility
} = {
  scheduler: {
    now: () => Date.now(),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
  visibility: {
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onChange: (callback) => {
      document.addEventListener('visibilitychange', callback)
      return () => document.removeEventListener('visibilitychange', callback)
    },
  },
}
```

Zostava číta `uploadSettlementRuntime.scheduler` pri každom použití, nie raz pri vzniku. Všetky časy (rytmus,
zlučovanie udalostí, D8, rebríky) idú len cez neho.

### 4.3 Koordinátor

```ts
const enqueueRead = <T>(run: (startedAt: number) => Promise<T>): Promise<T> => {
  const result = chain.then(() => run(++clock))
  chain = result.then(() => undefined, () => undefined)
  return result
}
```

Jeden rad na zostavu, teda na sklad. Tik fronty, pomenované čítanie aj ručné „Obnoviť" idú cezeň; naraz
beží jedno čítanie celého skladu, čo je prísnejšie než „jedno na frontu" z plánu a dáva čítaniam jednoznačné
poradie. `startedAt` sa berie, keď čítanie príde na rad.

### 4.4 Tik fronty

Dopytovač (`uploadPoller.ts`) len časuje; čo sa číta, robí zostava.

```ts
export interface QueuePollerDeps {
  /** Vek najmladšieho sledovaného riadku fronty v ms, alebo `null`, keď fronta nič nesleduje. */
  youngestAgeMs(): number | null
  mode(): 'dense' | 'sparse'
  /** Jedno čítanie všetkých sledovaných riadkov fronty. Odmietnutie = zlyhaný dopyt. */
  read(trigger: 'tick' | 'visible'): Promise<void>
}
export interface QueuePoller {
  rowAdded(): void
  readNow(trigger: 'visible'): void
  reschedule(): void
  stop(): void
}
export function createQueuePoller(deps: QueuePollerDeps): QueuePoller
```

Stav: `nextAt`, `timer`, `inFlight`, `earlierAt` (skorší termín vyžiadaný počas čítania), `followUp`,
`lastReadEndedAt`, `consecutiveFailures`.

1. `rowAdded()`: `kandidát = now + firstDelay(mode)`. Ak čítanie beží: `earlierAt = min(earlierAt ?? ∞,
   kandidát)`. Inak `nextAt = min(nextAt ?? ∞, kandidát)` a časovač sa nastaví nanovo. Nový riadok čítanie
   nikdy neodsunie.
2. Časovač vyprší → `runRead('tick')`.
3. `runRead`: ak `inFlight`, zapamätá sa `followUp` a koniec. Inak `inFlight = true`, `await deps.read()`.
   - Úspech: `consecutiveFailures = 0`; `vek = deps.youngestAgeMs()`; ak `null`, dopytovač sa zastaví; inak
     `vypočítané = now + max(MIN_GAP, delayAfterRead(vek, mode))`.
   - Zlyhanie: `consecutiveFailures++`; `vypočítané = now + ERROR_LADDER[min(consecutiveFailures, 5) - 1]`.
   - `nextAt = min(vypočítané, earlierAt ?? ∞)`, najskôr však `now + MIN_GAP`; `earlierAt = null`.
   - `inFlight = false`; ak je `followUp`, spustí sa ďalšie čítanie najskôr `MIN_GAP` po konci predošlého.
4. `readNow('visible')`: ak od konca posledného čítania neprešiel `MIN_GAP`, naplánuje sa na jeho koniec; inak
   `runRead`. Rytmus po ňom pokračuje podľa veku.
5. Skrytá karta: `reschedule()` zruší časovač, `nextAt` ostane. Viditeľná: `readNow('visible')`, ak fronta
   niečo sleduje. Pomenované čítania (notifikácie) a ručné bežia aj pri skrytej karte, ako dnes.
6. Zmena režimu: `nextAt = min(nextAt, lastReadEndedAt + delayAfterRead(vek, nový režim))`, najskôr teraz.

`deps.read` v zostave = `enqueueRead((startedAt) => readQueue(queueKey, startedAt))`:

```
readQueue(queueKey, startedAt):
  riadky = živé riadky fronty, ktoré majú TrackState
  podľa voľby reader:
    'asset': skupiny podľa licenceId, v nich jedinečné assetId
       jedno id v skupine  -> a = await readers.asset(id); zoznam = a ? [a] : []
       viac                -> dávky po 50: await readers.assets(licenceId, dávka)
    'slots': jedinečné assetId -> await readers.slotFiles(assetId)
  každá skupina zvlášť v try/catch; skupiny bežia naraz (Promise.allSettled)

  úspešná skupina assetov:
    pre každý asset: await applyAssetRead(asset, { assetId: asset.id, fileId: asset.mainFile?.id ?? null },
                                         { hint: null, metadata: true, early: false, seen: true }, startedAt)
    sledovaný riadok skupiny, ktorého asset v odpovedi nie je: misses++ (D7); inak misses = 0
    readFailures = 0 pre riadky skupiny

  úspešný zoznam slotov:
    pre každý sledovaný riadok slotu toho assetu (isStale a Stop sa preskočia):
      súbor = súbory.find((s) => s?.id === riadok.fileId)
      ak nie je: misses++
      processed -> synchrónny blok z 3.10; potom pomenované čítanie assetu hneď
                   ({ assetId, fileId: riadok.fileId }, { hint: processed, metadata: false, seen: true })
      failed    -> settleFailed(queueKey, riadok, súbor.fileAttributes.failReason)
      duplicate -> await settleDuplicate({ assetId, fileId: riadok.fileId }, súbor.originAssetFile, riadok.assetType)
      inak      -> nič

  zlyhaná skupina: readFailures++ riadkom skupiny (R7)

  po skupinách, pre každý sledovaný riadok fronty:
    misses >= 3            -> D7 (3.12)
    readFailures >= 3      -> notice.readWarning = true
    readFailures === 0     -> notice.readWarning = false
    status === Processing, !clientFailed, vek >= 20 min -> notice.slow = true
    syncNotice(riadok)

  ak zlyhali všetky skupiny: vyhodiť chybu (dopytovač pôjde chybovým rebríkom)
```

Čítanie assetu po usadení slotu doplní riadku `assetStatus`, náhľad a prepínač (len keď je jeho súbor
hlavný) a cez `onAssetRead` dá otvorenému detailu `mainFile`. Tak to robí dnes udalosť `processed`
(`DAM store:548-564`) a pripínajú to nové testy (9.4).

### 4.5 Pomenované čítanie (notifikácie)

```
schedule(assetId, fileId, intent, delayMs) -> Promise<void>:
  p = pending.get(assetId) alebo nový
  zlúč cieľ a zámer; dueAt = min(p.dueAt, now + delayMs); časovač nastav nanovo
  vráť sľub, ktorý sa splní po zápise alebo po neúspešnom pokuse

keď časovač vyprší: pending.delete(assetId); enqueueRead((startedAt) => readNamed(p, startedAt))

readNamed(p, startedAt):
  skús: asset = await readers.asset(p.assetId)
  výnimka:
    riadkom, ktorých sa čítanie týka: readFailures++ (sledovaným) a p.failures++
    ak p.failures < 3: zaraď p znova s odstupom ERROR_LADDER[p.failures - 1]   (15 s, 30 s)
    inak: riadkom, ktorých sa týka: notice.readWarning = true; syncNotice       (R7; ďalej len „Obnoviť")
    splň čakajúcich; koniec
  asset === null:
    sledovaným riadkom: misses++ a D7 pri 3
    p.misses++; ak p.misses < 3: zaraď p znova s tým istým rebríkom
    inak: nesledovaným riadkom, ktorých sa týka: notice.readWarning = true; syncNotice   (O12)
    splň čakajúcich; koniec
  pre každý cieľ: await applyAssetRead(asset, cieľ, zámer, startedAt)
  splň čakajúcich
```

„Riadky, ktorých sa čítanie týka": živé riadky, ktoré pre niektorý cieľ spĺňajú `decorate` alebo (pri
`early`) `metadata`. Varovanie sa aj tu ukáže len riadku, ktorý má mať formulár a nemá ho (`syncNotice`);
riadok nahratý z udalosti sa pri chýbajúcom assete na zlyhaný neprepína (O12).

Assety sa čítajú po jednom, každý vlastnou požiadavkou ako dnes. Hromadný čitateľ používa len tik. Dôvod:
existujúce testy podvrhujú len `fetchAsset`, a udalosti k rôznym assetom chodia s odstupom spracovania na
backende, nie naraz.

### 4.6 Ručné „Obnoviť" a obaly

```
refreshAsset(target) = enqueueRead(async (startedAt) => {
  skús: asset = await readers.asset(target.assetId)
  výnimka: vráť 'error'
  asset === null: sledovaným riadkom misses++ a D7 pri 3; vráť 'error'
  await applyAssetRead(asset, target, { hint: null, metadata: true, early: false, seen: true }, startedAt)
  vráť isFinal(asset.mainFile?.fileAttributes?.status) ? 'settled' : 'pending'
})
```

Bez dvojsekundového odstupu (O14): zaradí sa hneď za bežiace čítanie. Výsledok závisí len od stavu hlavného
súboru, nie od toho, ktoré riadky sa zapísali; pre riadok hromadnej úpravy teda platí to isté.

`settleKnownProcessed(target, { withMetadata })`: to isté so zámerom
`{ hint: processed, metadata: withMetadata, early: false, seen: true }`, bez návratovej hodnoty; výnimku a
`null` ticho prehltne (dnes `catch {}`).

### 4.7 Režim

`mode() = profile.connection.isPushAlive() ? 'sparse' : 'dense'`. Živé znamená: služba je zapnutá a stav
socketu je `OPEN` (O9). UGC nikdy nevolá `initDamNotifications()`, takže je vždy `dense`. Riadok vypadne z
dopytovania notifikáciou tým, že ho usadenie `untrack`ne.

### 4.8 Sledovanie

`track(queueKey, row, options)`: ignoruje riadok, ktorý nie je vo fronte `queueKey`, a riadok s voľbou
`reader: 'none'`. Inak založí `TrackState` (`eligibleSince = now`), vytvorí dopytovač fronty, ak nie je, a
zavolá `rowAdded()`. `untrack(row)`: zmaže `TrackState` (revíziu nie). `dropQueue(queueKey)`: zastaví a zmaže
dopytovač; čakajúce pomenované čítania ostávajú (riadky v nich už nenájdu).

### 4.9 Testovanie časov

- **Ručný plánovač** (`__tests__/support/manualScheduler.ts`): `now`, zoznam časovačov, `advance(ms)`, ktoré
  volá splatné spätné volania v poradí a po každom vyčká na mikroúlohy. Pre testy dopytovača a zostavy.
  Globálne časovače sa nepatchujú, takže beh v prehliadači sa nezasekne.
- **Okamžitý plánovač** (`__tests__/support/immediateScheduler.ts`): `setTimeout` s odstupom do 2 s vrátane
  pustí cez `queueMicrotask`, dlhší nikdy; `now` je `Date.now()`. Pre testy skladov, ktoré o čase nie sú:
  udalosť sa zapíše v najbližšej mikroúlohe a tik nepríde nikdy.
- **DAM**: `uploadSettlementRuntime` je exportovaný z LIB. Testy s `vi.useFakeTimers()` nič nemenia
  (predvolený plánovač volá globálne funkcie v čase volania). Testy na skutočných časovačoch, ktoré čakajú na
  obaly (`await store.queueItemMetadataProcessed(…)`), si v `load()` po `vi.resetModules()` nastavia vlastný
  okamžitý plánovač:
  ```ts
  const lib = await import('@anzusystems/common-admin')
  lib.uploadSettlementRuntime.scheduler = immediateScheduler() // DAM: src/test/support/immediateScheduler.ts
  ```
  Dynamický import po resete dá tú istú inštanciu modulu, akú dostane sklad. Čiastočný podvrh knižnice
  (`{ ...(await importOriginal()), useAlerts }`) kopíruje odkaz na ten istý objekt, takže prepísanie poľa
  platí aj cezeň.

---

## 5. Zapojenie do skladu LIB

### 5.1 Profil

```ts
const settlement = createUploadSettlement({
  queues: () => queues.value.entries(),
  roleOf: (row) => (row.type === UploadQueueItemType.Asset ? UploadRowRole.Copy : UploadRowRole.Upload),
  policyFor: () => ({ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }),
  // Ako dnes: len podľa assetu, pre všetky tri účely.
  matches: (row, target) => row.assetId === target.assetId,
  readers: {
    asset: readAsset, // 5.2
    assets: (licenceId, ids) => fetchAssetListByIds(damClient, endPointAsset, ids, licenceId),
    duplicateOriginAsset: (fileId) => fetchAssetByFileId(damClient, endPointAsset, fileId),
  },
  caches: {
    addAuthors: addToCachedAuthors,
    addKeywords: addToCachedKeywords,
    fetchAuthors: fetchCachedAuthors,
    fetchKeywords: fetchCachedKeywords,
  },
  messages: {
    processingTooLong: () => commonT('common.damImage.uploadErrors.processingTooLong'),
    readFailed: () => commonT('common.damImage.uploadErrors.readFailed'),
    assetMissing: () => commonT('common.damImage.uploadErrors.unknownError'),
  },
  hooks: {
    onRowFinal: (queueKey) => {
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    },
  },
  connection: useDamNotificationsConnection(),
})
```

### 5.2 Čitateľ jedného assetu

```ts
import { apiErrorStatus } from '@/domains/api/utils/apiErrors'

const readAsset = async (assetId: DocId) => {
  try {
    return await fetchAsset(damClient, endPointAsset, assetId)
  } catch (error) {
    if (apiErrorStatus(error) === 404) return null
    throw error
  }
}
```

`apiErrorStatus` (`src/domains/api/utils/apiErrors.ts:102-107`) vracia stav z oboch tried chýb, ktoré
`useApiRequest` hádže. Podvrhnuté `fetchAsset` v testoch, ktoré odmietne obyčajnou `Error`, dá `undefined`,
teda zlyhané čítanie, nie chýbajúci asset.

`fetchAssetListByIds` už odmieta, keď odpoveď nemá stav 200; treba doplniť kontrolu, že `data.data` je pole
(inak výnimka), aby zlá odpoveď nebola „všetky assety chýbajú" (D7). To isté v DAM `asset/api/assetApi.ts:82-123`.

### 5.3 Funkcie skladu

| Dnes | Po kroku 2 |
|---|---|
| odber v `:48-67` | `subscribe()` zavolané z `addByFiles` a `addByCopyToLicence` pred pridaním prvého riadku; raz, bez odhlásenia (O13). Poslucháč volá `settlement.notify(toEvent(event))` |
| `addByCopyToLicence:109-113` | `settlement.track(queueKey, added)` vždy, bez príznaku |
| `queueItemUploadStart:198-214` | `const { upload, uploadInit, stopSpeedCheck, finishAttempted } = useUpload(…)`. Po `await upload()`: `if (item.status === Processing) settlement.track(queueKey, item)`. V `catch`, po dnešnom tele: `if (finishAttempted() && item.status === Failed) settlement.track(queueKey, item, { clientFailed: true })` |
| `settleWithMetadata`, `clearError`, `metadataLoaded` | sťahujú sa do `uploadSettle.ts` a zostavy |
| `queueItemProcessed(assetId)` | `settlement.notify({ kind: 'processed', assetId, fileId: null })` |
| `queueItemFullyProcessed(assetId)` | `settlement.settleKnownProcessed({ assetId, fileId: null }, { withMetadata: true })` |
| `queueItemCopied`, `queueItemMetadataProcessed` (neexportované) | zanikajú, udalosti idú cez `notify` |
| `queueItemFailed(assetId, reason)` | `settlement.settleKnownFailed({ assetId, fileId: null }, reason)`; ostáva `async`, aby `await` v testoch platil |
| `queueItemDuplicate(assetId, origin, type)` | `settlement.settleKnownDuplicate({ assetId, fileId: null }, origin, type)` |
| `stopRemoved`, `removeByIndex`, `stopItemUpload` | namiesto `clearTimeout(...)` `settlement.untrack(item)` |
| `stopUpload`, `clearQueue` | `settlement.dropQueue(queueKey)` pred nahradením fronty |
| nové, exportované zo skladu | `refreshAsset(assetId): Promise<UploadRefreshOutcome>` |

`toEvent`: `processed`, `failed`, `duplicate`, `metadata`, `copied` z `DamNotificationName`; `fileId` z
`event.data.id`, `failReason`, `originAssetFile`, `assetType` z dát; ostatné mená udalostí sa zahodia.

Tri priame volania `queueItemDuplicate` vo widgetoch (`imageWidget/components/ImageWidgetInner.vue:336`,
`ImageMediaWidgetInner.vue:344`, `ImageWidgetMultipleInner.vue:227`) ostávajú. Riadok kópie pridaný tesne
predtým je sledovaný; `becomeOriginal` ho `untrack`ne pri úspechu aj pri zlyhaní, takže po kópii, ktorá už
existuje, neostane sledovaný riadok ani neskoršia požiadavka.

### 5.4 `uploadQueueItemRefresh.ts`

```ts
const refreshItem = async (assetId: DocId) => {
  refreshing.value = true
  try {
    const outcome = await uploadQueuesStore.refreshAsset(assetId)
    if (outcome === 'pending') showWarningT('common.damImage.queueItem.stillUploadingOrProcessing')
  } finally {
    refreshing.value = false
  }
}
```

Rozhranie composable sa nemení. Rozdiel: prvé čítanie dnes ide klientom konfigurácie `configName`
(`:14-15`), po zmene klientom skladu (predvolená konfigurácia). Sklad sám číta predvoleným klientom už dnes;
či niekto fronty pripája s inou konfiguráciou, nie je overené (časť 11).

### 5.5 Stav spojenia (`composables/damNotificationsConnection.ts`)

```ts
import { ref, watch } from 'vue'

const pushAlive = ref(false)

/** Volá len `damNotifications.ts`. */
export const setDamNotificationsPushAlive = (alive: boolean) => {
  pushAlive.value = alive
}

export function useDamNotificationsConnection() {
  return {
    isPushAlive: () => pushAlive.value,
    onChange: (callback: () => void) => watch(pushAlive, () => callback(), { flush: 'sync' }),
  }
}
```

Modul nečíta voľby pluginu a neimportuje `damNotifications.ts`. `createDamNotifications()` v
`damNotifications.ts` pridá `watch(status, (s) => setDamNotificationsPushAlive(enabled && s === 'OPEN'),
{ immediate: true, flush: 'sync' })` (beží v rozsahu singletonu) a v `dispose` nastaví `false`.

Dôsledky: šesť testov LIB, ktoré podvrhujú celý modul `damNotifications` len s `useDamNotifications`, sa
nemení (sklad z neho nič nové neimportuje). DAM testy, ktoré načítajú sklad bez nastaveného pluginu,
neprečítajú žiadnu voľbu.

### 5.6 `uploadApi.ts` a `uploadService.ts`

- `damUploadFinish(client, endPointAsset, endPointImage, item, sha)`: po úspechu len
  `if (item.status === Uploading) item.status = Processing`. `endPointAsset` ostáva na mieste do kroku 5
  (O15): podvrhy v testoch berú riadok podľa pozície (`LT/uploadQueuesStore.test.ts:36,43,424`).
- `finishUpload` v `uploadService.ts:30-34` prestane volať `useCommonAdminCoreDamOptionsGlobal()`.
- `useUpload` vráti navyše `finishAttempted: () => boolean`; príznak sa nastaví tesne pred
  `finishUpload(...)` v `upload()` (`uploadService.ts:282`).

---

## 6. Zapojenie do skladu DAM

### 6.1 Profil

```ts
const settlement = createUploadSettlement({
  queues: () => Object.entries(queues.value),
  roleOf, // File -> upload, SlotFile -> slot, Asset -> massEdit, ExternalProviderAsset -> externalImport
  policyFor, // tabuľka v 2.1
  matches: (row, target, purpose) =>
    purpose === 'metadata'
      ? row.assetId === target.assetId // dnes store:620: notifikácia o metadátach páruje len podľa assetu
      : notificationMatches(row, target.assetId, target.fileId, purpose === 'decorate'),
  readers: {
    asset: readAsset, // ako 5.2, s DAM `fetchAsset`
    assets: (licenceId, ids) => fetchAssetListByIds(ids, licenceId),
    slotFiles: fetchAssetSlotFiles, // 6.3
    duplicateOriginFile, // dnešný switch podľa typu, store:689-704
  },
  caches: { addAuthors: addToCachedAuthors, addKeywords: addToCachedKeywords, fetchAuthors: fetchCachedAuthors, fetchKeywords: fetchCachedKeywords },
  messages: {
    processingTooLong: (row) =>
      translate(
        row.type === UploadQueueItemType.SlotFile
          ? 'system.uploadErrors.processingTooLongSlot'
          : 'system.uploadErrors.processingTooLong'
      ),
    readFailed: () => translate('system.uploadErrors.metadataFailed'), // len riadky s formulárom (O4)
    assetMissing: () => translate('system.uploadErrors.unknownError'),
  },
  // Riadok, ktorý hromadné načítanie vynechalo, zlyhal len pre chýbajúce metadáta: notifikácia mu ich smie dať
  // (dnes store:624-631, DT/queue/slotNotifications.test.ts:745-760).
  metadataGate: (queueId, row) => (metadataFailures.has(metadataFailureKey(queueId, row)) ? 'load' : undefined),
  hooks: {
    onRowFinal: (queueId) => {
      recalculateQueueCounts(queueId)
      processUpload(queueId)
    },
    onAssetRead, // 6.4
    // Udalosť `processed` a ručné čítanie mažú chybu riadku hromadnej úpravy, okrem varovania o chýbajúcich
    // metadátach z hromadného načítania (dnes store:527-532, pred čítaním assetu).
    onProcessedSeen: (queueId, row) => {
      if (metadataFailures.has(metadataFailureKey(queueId, row))) return
      row.error = { hasError: false, message: '', assetFileFailReason: AssetFileFailReason.None }
    },
    afterMetadataLoaded: (queueId, row) => {
      if (metadataFailures.delete(metadataFailureKey(queueId, row))) {
        row.error.hasError = false
        row.error.message = ''
      }
    },
  },
  connection: useDamNotificationsConnection(),
})
```

`notificationMatches` ostáva v sklade bez zmeny (`store:492-508`). Podľa neho:
- `processed` (`decorate`) zasiahne aj riadok hromadnej úpravy bez súboru; stav takému riadku nemení
  (`settleOn: 'never'`), len ho doplní;
- `failed` a `duplicate` (`settle`) zasiahnu riadok hromadnej úpravy, ktorý má `fileId`, a nezasiahnu ten bez
  neho (`DT/queue/slotNotifications.test.ts:171-189`, `:700-723`);
- riadok v stave `Loading` nezasiahne nič okrem notifikácie o metadátach.

`metadataLoaded` sa sťahuje do zostavy. Množina `metadataFailures` v sklade **ostáva**, už len pre hromadné
načítanie riadkov hromadnej úpravy (`failStillLoading`, `fetchLazyAdditionalMetadata`, `store:252-331`), a
`metadataFailures.delete` ostáva v `removeByIndex` aj `clearQueue` (`store:355`, `:740`). Varovanie R7 pre
nahrávané riadky drží zostava.

### 6.2 Funkcie skladu

| Dnes | Po kroku 2 |
|---|---|
| `queueItemUploadStart:449-457` | `const { upload, uploadInit, stop, finishAttempted } = useUpload(…)`. Po `await upload()`: `if (item.status === Processing) settlement.track(queueId, item)`. V `catch` po nastavení `Failed`: `if (finishAttempted()) settlement.track(queueId, item, { clientFailed: true })` (vetvy `Stop` a `Uploaded` sa vracajú skôr, `:460-466`) |
| vetva externého importu `:440-446` | po `await importInit()`: `if (item.status === Processing) settlement.track(queueId, item)` |
| `queueItemProcessed(assetId, fileId)` | `settlement.notify({ kind: 'processed', assetId, fileId })` |
| `queueItemFailed(assetId, reason, fileId)` | `settlement.settleKnownFailed({ assetId, fileId }, reason)`; ostáva synchrónne |
| `queueItemMetadataProcessed(assetId)` | `settlement.notify({ kind: 'metadata', assetId, fileId: null })` |
| `queueItemDuplicate(assetId, origin, type, fileId)` | `settlement.settleKnownDuplicate({ assetId, fileId }, origin, type)` |
| `removeByIndex`, `stopItemUpload` | `settlement.untrack(item)` namiesto `clearTimeout`; `metadataFailures.delete` ostáva |
| `stopUpload`, `clearQueue` | `settlement.dropQueue(queueId)`; `metadataFailures.delete` ostáva |
| nové | `refreshQueueItem(item): Promise<UploadRefreshOutcome>` = `settlement.refreshAsset({ assetId: item.assetId, fileId: item.fileId })` |

`appNotificationListeners.ts` sa nemení: volá tie isté štyri funkcie skladu.

`asset/components/queue/AssetQueueEditable.vue:29-53`: `refreshItem` nájde kliknutý riadok
(`list.value[data.index]`, s kontrolou `assetId`), zavolá `uploadQueuesStore.refreshQueueItem(riadok)` a pri
`'pending'` ukáže `stillUploadingOrProcessing`. Odovzdáva sa `fileId` kliknutého riadku: s `null` by čítanie
zasiahlo každý neslotový súbor toho assetu. Kritérium „`assetStatus === with_file`" zaniká, rozhoduje stav
hlavného súboru (O10).

`asset/api/fileApi.ts`: zaniknú riadky 114-191 a importy skladu, `fetchAsset`, `i18n`, `envConfig`;
`startProcessing` ostane ako `if (item.status === Uploading) item.status = Processing`, takže odovzdanie do
`Processing` ostáva vo `fileApi.uploadFinish`. `shared/services/upload/externalProviderImportService.ts`:
zmizne import a volanie `armNotificationFallback`; riadok sleduje sklad po `importInit`.
`shared/services/upload/uploadService.ts`: `useUpload` vráti `finishAttempted()` (nastaví sa pred volaním
`uploadFinish` na riadku 27).

### 6.3 Sloty (D3)

```ts
// asset/api/assetSlotApi.ts
export const fetchAssetSlotFiles = async (assetId: DocId): Promise<AssetFileNullable[]> => {
  const res = await damClient().get(END_POINT + '/asset/' + assetId)
  const slots = res.data?.data
  if (!Array.isArray(slots)) throw new Error('assetSlotApi: unexpected slot list')
  return slots.map((slot: AssetSlot) => slot.assetFile)
}
```

Backend vracia `{ data: [...], totalCount }` so všetkými slotmi assetu naraz a so súbormi v detailnom pohľade
(`AssetSlotFacade.php:33-43`, `AssetSlotAdmListDecorator.php:40-41`); slot existuje od začiatku uploadu.
Chýbajúci súbor sa počíta len v riadne prečítanom zozname; iný tvar odpovede je zlyhané čítanie, nie D7.

Riadok slotu:
- udalosť `processed` s jeho `fileId`: stav hneď, potom čítanie assetu (ako dnes);
- bez služby: tik číta zoznam slotov; `processed` → stav a čítanie assetu, `failed`, `duplicate`;
- `AssetSlotListItem.vue:88-92` pošle `refreshList`, keď riadok prestane byť „v priebehu"; ostáva a funguje
  teraz aj bez socketu;
- varovanie R7 nedostane (`metadata: 'none'`); text „trvá dlho" áno, vo svojom znení.

### 6.4 Detail assetu

```ts
// Asset vytvorený prázdny dostane hlavný súbor do otvoreného detailu z každého čítania.
const onAssetRead = (asset: AssetDetailItemDto) => {
  const detail = useAssetDetailStore()
  if (detail.asset?.id === asset.id && detail.asset.mainFile === null && asset.mainFile) {
    detail.asset.mainFile = asset.mainFile
  }
}
```

Rozdiely oproti dnešku (`store:649-656`):
- dnes sa `mainFile` píše len vtedy, keď fronta má riadok slotu toho assetu; po zmene pri každom prečítanom
  assete, ktorý má otvorený detail bez hlavného súboru (krok 2, bod 8 plánu);
- pri zapnutej službe sa dnes píše pri notifikácii o metadátach; tá sa naďalej číta, lebo profil páruje
  `metadata` podľa assetu, takže riadok slotu čítanie spustí, len o 2 s neskôr (D8).

### 6.5 Dva sklady naraz

Sklad LIB sa v DAM vytvorí cez `AuthorRemoteAutocompleteCachedAuthorChip.vue:33`, ale nikdy doňho nepribudne
riadok, takže sa na notifikácie neprihlási (5.3). Každý sklad má vlastnú zostavu; zdieľajú len
`uploadSettlementRuntime` a stav spojenia.

### 6.6 Exporty z `src/lib.ts` pre DAM

Hodnoty: `createUploadSettlement`, `uploadSettlementRuntime`, `UPLOAD_POLL_SCHEDULE`, `UploadRowRole`,
`useDamNotificationsConnection`. (`apiErrorStatus` už exportovaný je, `src/lib.ts:1365`.)
Typy: `UploadSettlement`, `UploadSettlementProfile`, `UploadSettlementEvent`, `UploadSettlementTarget`,
`UploadSettlePolicy`, `UploadRefreshOutcome`, `UploadRowRoleType`, `UploadSettlementScheduler`,
`UploadSettlementVisibility`.

Strážny test nových exportov (`src/test/publicExportsAdded.test.ts`) sa doplní.

---

## 7. Konfigurácia (plán 3.1)

```ts
// src/AnzuSystemsCommonAdmin.ts
export type CommonAdminCoreDamOptions =
  | undefined
  | {
      configs: { [key: string]: CommonAdminCoreDamConfig }
      apiTimeout: number
      /** @deprecated Dopytovanie beží vždy; hodnota sa nečíta. */
      uploadStatusFallback?: boolean
      adminDomain: string
      /** Služba sa zapne len pri `enabled` presne `true` alebo `"true"` a neprázdnej adrese. */
      notification?: {
        enabled?: boolean | string
        webSocketUrl?: string
      }
    }
```

```ts
// composables/commonAdminCoreDamOptions.ts
export interface DamNotificationOptions {
  enabled: boolean
  webSocketUrl: string
}

export const normalizeDamNotificationOptions = (
  raw: { enabled?: boolean | string; webSocketUrl?: string } | undefined
): DamNotificationOptions => {
  const webSocketUrl = typeof raw?.webSocketUrl === 'string' ? raw.webSocketUrl.trim() : ''
  const on = raw?.enabled === true || raw?.enabled === 'true'
  return { enabled: on && webSocketUrl.length > 0, webSocketUrl }
}
```

Presne dve hodnoty zapínajú službu; `"TRUE"`, `" true "`, `"1"`, `1` nie. `useCommonAdminCoreDamOptionsGlobal()`
vracia `notification: normalizeDamNotificationOptions(...)` a prestane vracať `uploadStatusFallback`.
`damNotifications.ts` potom číta len znormalizované hodnoty (riadky 21, 28, 90).

DAM: `src/shared/types/EnvConfig.ts` → `notification.enabled: boolean | string`; `uploadStatusFallback` ostane
v type ako nepovinné a `@deprecated` a `setEnvConfig` ho prestane kopírovať (riadok 46), predvolená hodnota na
riadku 11 a riadok v `src/main.ts:46` a `public/config.json.dist:7` zaniknú. Nepovinné pole v type preto, že
nové testy kroku 0 doňho priraďujú (9.4) a nasadené `config.json` ho môžu niesť. Šablóna v `petit/admin-dam` je
krok 4.

Dôsledok: prostredie, kde je dnes `enabled` text `"false"`, má službu zapnutú omylom a po tejto zmene ju bude
mať vypnutú. Preto plán nedovoľuje nasadiť DAM s krokom 2 bez kroku 3.

---

## 8. Poradie implementácie

Každý krok končí zelenými cielenými testmi; celé kontroly až na konci fázy.

### 8.1 LIB

| # | Čo | Súbory | Stráži |
|---|---|---|---|
| L1 | Konfigurácia a stav spojenia | `AnzuSystemsCommonAdmin.ts`, `commonAdminCoreDamOptions.ts`, `damNotifications.ts`, `damNotificationsConnection.ts` | `pluginOptions.test.ts`, `damNotifications.test.ts`, N-K1 až N-K4 |
| L2 | Rytmus, runtime, dopytovač | tri nové súbory | N-P1 až N-P13 |
| L3 | Čisté funkcie usadenia | `uploadSettle.ts` | N-S1 až N-S11 |
| L4 | Zostava | `uploadSettlement.ts` | N-Z1 až N-Z21 |
| L5 | Sklad na zostavu, obaly, sledovanie, lenivý odber; `finishAttempted`; `damUploadFinish` bez príznaku | `uploadQueuesStore.ts`, `uploadService.ts`, `uploadApi.ts` | vlna 1, `LT/uploadQueuesStore.test.ts`, `uploadQueueStartsEachFileOnce.test.ts`, `uploadStop*.test.ts`, úpravy z 9.2 |
| L6 | Tlačidlo „Obnoviť" | `uploadQueueItemRefresh.ts` | `uploadQueueItemRefresh.test.ts`, `uploadQueueRowRefresh.test.ts`, `uploadQueueDialogSingle.test.ts` |
| L7 | Záloha preč, cyklus importov, dávka 50 | `uploadApi.ts`, `damAssetApi.ts`, `src/test/importCycles.test.ts` | prepísaný `uploadStatusFallback.test.ts`, `importCycles.test.ts` |
| L8 | Text R7, exporty | lokály, `src/lib.ts` | test kľúčov prekladov, `publicExportsAdded.test.ts` |

L2 až L4 nemenia správanie ničoho existujúceho; prvý krok, ktorý ho mení, je L5.

Po L5 overiť hneď (pred čítaním červeného testu ako chyby produktu):
- úpravy testov z 9.2 sú spravené;
- `src/test/importCycles.test.ts:100-108` stále ukazuje presne ten jeden starý cyklus (zaniká až v L7);
- riadok, ktorého `processed` predbehlo odpoveď na dokončenie, nie je sledovaný;
- po kópii, ktorá v licencii už existuje, neostane sledovaný riadok ani neskoršia požiadavka;
- po `stopUpload` a `removeByIndex` neostane časovač ani čítanie;
- s dvoma sledovanými riadkami nesie hromadná adresa licenciu riadku pod `/adm/v1` aj `/ugc/v1`.

### 8.2 DAM (po kroku 1, po builde LIB a `./copy.sh`)

| # | Čo | Súbory | Stráži |
|---|---|---|---|
| D1 | Konfigurácia bez príznaku | `EnvConfig.ts`, `EnvConfigService.ts`, `main.ts`, `public/config.json.dist` | testy štartu aplikácie |
| D2 | Profil, zostava, obaly, sledovanie; `finishAttempted` | `asset/store/uploadQueuesStore.ts`, `shared/services/upload/uploadService.ts`, `asset/api/assetApi.ts` (50) | `DT/queue/slotNotifications.test.ts`, `lazyMetadata.test.ts`, `uploadStop.test.ts`, `notificationSettlesQueue.test.ts`, úpravy z 9.3 |
| D3 | Sloty cez zoznam slotov | `asset/api/assetSlotApi.ts`, sklad | `slotUploadRow.test.ts`, prepísaný `slotUploadWithoutSocket.test.ts` |
| D4 | Záloha preč, import, tlačidlo | `asset/api/fileApi.ts`, `externalProviderImportService.ts`, `AssetQueueEditable.vue` | `fallbackReadOutcomes.test.ts`, `fallbackSettlesQueue.test.ts`, `queueRefresh.test.ts`, `externalProviderImport.test.ts` |
| D5 | Detail | sklad | DS7 v `notificationSettlesQueue.test.ts` |

Po D2 overiť: celé `DT/queue/slotNotifications.test.ts`, najmä `:147-169`, `:700-723`, `:745-760`,
`:779-796`; sklad sa načíta bez nastaveného pluginu; riadok hromadnej úpravy nikdy nie je v požiadavke tiku;
`DT/appInitialize/appNotificationListeners.test.ts` prechádza bez zmeny.

Po D3 overiť: chýbajúci súbor sa počíta len v riadne prečítanom zozname; dva sloty jedného assetu sa usadia
zvlášť; duplicitný súbor slotu sa v zozname nájde; `refreshList` odíde aj po usadení z čítania.

---

## 9. Testy

### 9.1 Nové

Dopytovač (`uploadPoller.test.ts`, ručný plánovač):
- N-P1 prvé čítanie 5 s po prvom riadku (hustý), 10 s (riedky).
- N-P2 riadky pribúdajúce každé 2 s čítanie neodsunú; počas dávky sa číta najneskôr každých 5 s.
- N-P3 po poslednom riadku nasledujú značky 10, 16, 23, 31, 40, 50, 60 s jeho veku.
- N-P4 úrovne: 30 s do 5 min, 1 min do 20 min, 2 min do 60 min, potom 10 min; riedky režim obdobne.
- N-P5 fronta bez sledovaného riadku sa zastaví a nedrží časovač.
- N-P6 jedno čítanie naraz; spúšťač počas čítania vyvolá práve jedno ďalšie.
- N-P7 `readNow` rytmus nezrýchli; dva do 2 s sú jedno čítanie.
- N-P8 skrytá karta nečíta, po návrate číta hneď a pokračuje podľa veku.
- N-P9 zlyhané čítania: 15, 30, 60, 120, 300, 300 s; úspech rebrík vynuluje.
- N-P10 nový riadok počas chybového odstupu čítanie priblíži.
- N-P11 prechod riedky → hustý pri páde spojenia pritiahne ďalšie čítanie; opačne ho neodsunie pred vypršaním.
- N-P12 `delayAfterRead` a `firstDelay` nad tabuľkou.
- N-P13 riadok pridaný počas bežiaceho čítania: jeho skorší termín sa po dobehnutí čítania nestratí.

Usadenie (`uploadSettle.test.ts`, bez časovačov):
- N-S1 `processed` s metadátami: stav, súbor, náhľad, prepínače, metadáta, formulár.
- N-S2 `processed` bez metadát (len udalosť): stav, náhľad, prepínače; formulár nie.
- N-S3 riadok s načítanými metadátami: napísané ostane, aj prepínače.
- N-S4 zlyhaný riadok, `processed` len z udalosti: formulár hneď, bez metadát predtým aj s nimi (R6).
- N-S5 D6: hromadná operácia pred načítaním ostane; prázdne polia sa doplnia; vlastné polia kľúč po kľúči;
  prepínače sa vezmú zo servera.
- N-S6 `failed`: dôvod, formulár vypnutý, starý text zmazaný.
- N-S7 `becomeOriginal`: celý prepis riadku; zlyhané čítanie originálu zlyhá len riadok `Processing`.
- N-S8 `markDuplicate`: stav hneď, doplnenie po čítaní súboru, zlyhané čítanie riadok nemení.
- N-S9 nekonečný stav neprepíše konečný; `Stop` sa neprepíše.
- N-S10 notifikácia o metadátach počas uploadu otvorí formulár; na zlyhanom riadku a duplikáte nie; brána
  `'load'` zlyhaný riadok povolí.
- N-S11 voľba `never`: `processed` len doplní a zavolá `onProcessedSeen`; `failed` a `duplicate` riadok so
  súborom zasiahnu.

Zostava (`uploadSettlement.test.ts`, ručný plánovač, falošní čitatelia):
- N-Z1 riadok sledovaný po dokončení sa usadí z tiku bez jedinej notifikácie, s metadátami.
- N-Z2 notifikácia usadí riadok a ten vypadne z tikov.
- N-Z3 obe poradia tiku a notifikácie; koncový stav rovnaký.
- N-Z4 tik odoslaný pred udalosťou `failed` a dobehnutý po nej riadok nevráti.
- N-Z5 riadok odstránený počas čítania sa nezapíše; fronta vyčistená počas čítania tiež.
- N-Z6 D5: zlyhané dokončenie, server dokončí → nahratý s formulárom; číta sa aj po hodine; text „trvá dlho"
  nedostane.
- N-Z7 D7: tri čítania bez assetu → zlyhaný s textom; asset sa objaví pri druhom → počítadlo od nuly; zlá
  odpoveď hromadného čítania je zlyhané čítanie, nie chýbajúci asset.
- N-Z8 D8: čítanie po notifikácii o metadátach príde o 2 s; `processed` medzitým ho pritiahne na 250 ms a
  metadáta sa načítajú.
- N-Z9 O1: `processed` bez notifikácie o metadátach nechá riadok nahratý bez formulára.
- N-Z10 R7: tri zlyhané čítania → varovanie na riadku bez formulára, nie na riadku s formulárom ani na slote;
  úspešné ho zruší a vráti text „trvá dlho", ak bol ukázaný.
- N-Z11 text po 20 minútach sa ukáže raz, čítanie pokračuje, usadenie ho zmaže.
- N-Z12 udalosť pre asset, ktorý žiadna fronta nemá, nevyvolá čítanie.
- N-Z13 tik delí podľa licencie a po 50; jeden asset ide jednou požiadavkou; pomenované čítanie číta len
  menovaný asset.
- N-Z14 zlyhanie jednej skupiny nezastaví druhú.
- N-Z15 pomenované čítanie počas bežiaceho tiku počká a prebehne po ňom; nikdy nebežia dve naraz.
- N-Z16 ručné „Obnoviť" počas čítania: zaradí sa hneď za neho, bez dvojsekundového odstupu.
- N-Z17 `refreshAsset` vráti `settled`, `pending`, `error`; pre riadok hromadnej úpravy podľa stavu súboru.
- N-Z18 zlyhané čítanie po `copied`: riadok ostane `Processing` a ďalšie čítanie ho usadí.
- N-Z19 DAM profil: ten istý asset v `global` a `edit`; `processed` so súborom usadí prvý a druhý len doplní.
- N-Z20 DAM profil: slot sa usadí zo zoznamu slotov a potom sa doplní z assetu; dva sloty jedného assetu sa
  nepomiešajú.
- N-Z21 DAM profil: riadok nahratý z udalosti, ktorého asset trikrát chýba, ostane nahratý; varovanie len kým
  nemá formulár.

Konfigurácia:
- N-K1 `true` a `"true"` s adresou → zapnuté; `"TRUE"`, `" true "`, `"1"`, `"false"`, `false`, chýba → vypnuté.
- N-K2 chýbajúca, prázdna alebo medzerová adresa → vypnuté, bez výnimky.
- N-K3 `notification` chýba celé → vypnuté, bez výnimky.
- N-K4 `useDamNotificationsConnection`: žijúce len pri `OPEN`; `onChange` sa zavolá pri zmene.

### 9.2 Existujúce testy LIB na úpravu

Bez zmeny, hoci to posudok čakal: šesť súborov, ktoré podvrhujú `composables/damNotifications` len s
`useDamNotifications` (`uploadQueueDialogSingle`, `uploadQueueItemRefresh`, `uploadQueueSettledItemFailure`,
`uploadQueueStartsEachFileOnce`, `uploadQueuesStore`, `uploadStatusFallback`); fixtúry bez
`mainFile.fileAttributes` v `LT/uploadQueuesStore.test.ts:47-51,122-131` (idú cez udalosti a obaly s
nápovedou).

| Súbor | Úprava | Dôvod |
|---|---|---|
| `uploadQueuesStore.test.ts`, `uploadQueueDialogSingle.test.ts` | okamžitý plánovač v `beforeEach`, pôvodný v `afterEach` | udalosti `metadata` by na skutočných časovačoch prišli o 2 s, `vi.waitFor` čaká 1 s |
| `uploadQueuesStore.test.ts:100-117` | prepis | rozhodnutie k zlyhanému čítaniu po `copied`: riadok nezlyhá, číta sa znova |
| `uploadQueuesStore.test.ts:387-406` | prepis polovice o kópii; polovica o duplikáte ostáva | to isté |
| `uploadQueueSettledItemFailure.test.ts:61-74` | prepis | to isté |
| `uploadQueuesStore.test.ts:44`, `uploadQueueStartsEachFileOnce.test.ts` | z podvrhu `uploadApi` zmizne `armNotificationFallback` | funkcia zaniká (ponechaný kľúč neškodí) |
| `uploadStatusFallback.test.ts` | prepis celého súboru na ručný plánovač | časy `:107,131,205,220,241`, príznak `:160,190`, pomôcka `:79`, šiesty argument `damUploadFinish` |
| `uploadQueueDialogSingle.test.ts:102`, `uploadQueueRowRefresh.test.ts:39`, `uploadQueueSettledItemFailure.test.ts:54` | pomôcka, ktorá skracuje časovače od 10 s, preč; namiesto nej plánovač | s novým rytmom by skrátila každý dlhší odstup tiku na 300 ms |
| `uploadStopBetweenChunks.test.ts`, `uploadStopWhileHashLoads.test.ts`, `uploadQueueStartsEachFileOnce.test.ts` | šiesty argument `damUploadFinish`, kde sa volá alebo kontroluje | parameter zaniká |
| `src/plugins/__tests__/pluginOptions.test.ts` | tvar volieb | `uploadStatusFallback` a `notification` nepovinné |
| `src/test/importCycles.test.ts:100-108` | zoznam povolených cyklov | cyklus zaniká v L7 |

Podvrhy `useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false })` neškodia a vyčistia sa v L7.

Testy kroku 0 v LIB sa v čase písania ešte dopisujú; po ich dokončení ich treba prejsť rovnako ako DAM v 9.4.
Na čo sa pri nich pozrieť najprv: test, ktorý volá poslucháča notifikácií skôr, než sklad dostane prvý riadok
(odber je lenivý, poslucháč dovtedy neexistuje); test, ktorý po udalosti `metadata` čaká na skutočných
časovačoch; test, ktorý podvrhuje `fetchAssetListByIds` hodnotou, čo nie je pole.

### 9.3 Existujúce testy DAM na úpravu

| Súbor | Úprava | Dôvod |
|---|---|---|
| `queue/slotNotifications.test.ts:27-42` | do podvrhu `useUpload` pridať `finishAttempted: () => false` | `catch` uploadu ho volá; päť testov (`:612-742`) upload odmieta |
| `queue/slotNotifications.test.ts:83-88` | okamžitý plánovač v `load()` (4.9) | 18 čakaní na `queueItemMetadataProcessed` by trvalo po 2 s, čakania na `queueItemProcessed` po 250 ms |
| `queue/slotNotifications.test.ts:314-329` | prepis | R7: varovanie až po treťom neúspešnom čítaní |
| `queue/slotNotifications.test.ts:678-696` | obráti ho krok 1 (R6) | po kroku 2 by sa obrátil sám |
| `queue/lazyMetadata.test.ts:26-30` | `finishAttempted` do podvrhu `useUpload` | pre úplnosť; jeho `uploadInit` sa nikdy nesplní |
| `fallback/notificationFallback.test.ts` | celý súbor zaniká, nahrádzajú ho nové testy kroku 0 | predmet (`fileApi.ts:114-191`) zaniká |
| `queue/externalProviderImport.test.ts:5-10,58,75` | podvrh a tvrdenia o `armNotificationFallback` preč | služba ho už nevolá |

Bez zmeny: `appInitialize/appNotificationListeners.test.ts` (podvrhuje sklad podľa cesty, mená ostávajú),
`upload/uploadStop.test.ts`; fixtúry bez `mainFile.fileAttributes` v `queue/slotNotifications.test.ts:5-10,785-790`.

### 9.4 Nové testy DAM z kroku 0 (podľa `dam-krok0.md`)

Mení sa:

| Test | Čo sa stane | Prečo |
|---|---|---|
| `fallback/fallbackSettlesQueue › ends uploaded with its form off when the asset can be read no more…` | prepis | jedno čítanie zapíše stav aj metadáta; stav „nahraté bez metadát z jednej dobrej odpovede" zaniká |
| `queue/slotUploadWithoutSocket.test.ts`, celý súbor (7 prípadov) | prepis; `fakeDam` potrebuje odpoveď `GET /adm/v1/asset-slot/asset/{id}` | D3: slot sa číta zo zoznamu slotov a usadí sa |
| `queue/slotUploadWithoutSocket › does not give the open detail…`, `queue/notificationSettlesQueue › leaves the detail alone when the queue holds no slot upload…` | obrátia sa | krok 2, bod 8 plánu (6.4) |
| `queue/queueRefresh › settles the row as processed when the asset has its file and that file is a duplicate` | obráti sa na duplikát | O10 |
| `fallback/fallbackSettlesQueue › …(uploadStatusFallback %s)` a `load()` v štyroch súboroch | priradenie do `envConfig.uploadStatusFallback` ostáva platné (pole je nepovinné), ale nič nerobí; prípad s `false` stráca zmysel a zlúči sa | príznak sa nečíta |

Má ostať zelené (ak sčervenie, je to chyba, nie zámer):
- `notificationSettlesQueue › … the form staying off until its metadata` (O1);
- `upload/uploadRequests › finishes the upload…`, `› rejects a finish…`: odovzdanie do `Processing` ostáva vo
  `fileApi.uploadFinish`;
- tvrdenia o upozorneniach (`showError`, `showWarningT`, `showUnknownError`): zostava v LIB žiadne upozornenie
  nevolá, všetky ostávajú v kóde DAM;
- `notificationSettlesQueue`: stav a `assetStatus` riadku slotu po `processed` (`:144`), riadok hromadnej
  úpravy (`:220`, `:512-519`), DS7 pri notifikácii o metadátach (čakajú 5 s, čítanie príde o 2 s);
- `queueRefresh`: ostatných 12 prípadov, vrátane „reaches the mass-edit row of the asset, never its slot row";
- `fallbackReadOutcomes`, ostatné prípady `fallbackSettlesQueue`, `slotUploadRow`, `queueOperations`,
  `uploadFailures`, `uploadSequence`: tvrdia stav riadku a „asset sa prečítal", nie tvar ani čas čítania.
  Po dokončení uploadu teraz pribudnú čítania assetu (tik o 5 s); `fakeDam` ich zodpovie predvolene.

---

## 10. Otázky — uzavreté

| # | Otázka | Rozhodnutie |
|---|---|---|
| O1 | Metadáta pri čítaní spustenom len udalosťou `processed` | Nie, ako dnes (`LT/uploadQueueItemRefresh.test.ts:95-100`). Výnimka: riadok, ktorý bol zlyhaný (R6). Tik a ručné „Obnoviť" ich načítajú. Čakajúci spúšťač `metadata` zlúčený do toho istého čítania ich načíta. |
| O2 | Starý text chyby pri zlyhaní servera v LIB | Maže sa hneď, bez voľby profilu. |
| O3 | LIB, duplikát so zlyhaným čítaním originálu | Ako dnes: riadok `Processing` zlyhá. Cesta zlyhania riadok prestane sledovať. |
| O4 | Text R7 | LIB nový kľúč `uploadErrors.readFailed`: SK „Údaje sa nepodarilo načítať. Použite tlačidlo obnovenia položky alebo položku odstráňte a skúste to znova.", EN „Data could not be loaded. Use the item's refresh button, or remove the item and try again." DAM `metadataFailed` len riadkom, ktoré majú mať formulár; riadky s `metadata: 'none'` (sloty) varovanie nedostanú. |
| O5 | Ako dlho čítať riadok so zlyhaným dokončením | Bez hranice, bežným rytmom, kým je vo fronte. Text „trvá dlho" sa na ňom neukáže. |
| O6 | Zlučovanie notifikácií | 250 ms pre udalosti o súbore; D8 ostáva 2 s. |
| O7 | Ochrana proti starým odpovediam | Identita riadku a revízia vo vlastnej `WeakMap`, predvolene 0, `untrack` ju nemaže, zvyšujú ju aj zápisy z udalostí. Po každom `await` kontrola, že riadok je vo fronte. |
| O8 | Staré mená funkcií skladov | Ostávajú ako obaly do kroku 5. |
| O9 | `CONNECTING` | Nepočíta sa ako živé spojenie. |
| O10 | DAM „Obnoviť" | Rozhoduje stav hlavného súboru, nie `assetStatus === with_file`. |
| O11 | `assetStatus` riadku slotu | Pripínajú ho nové testy (`DT/queue/notificationSettlesQueue.test.ts:144`, `slotUploadWithoutSocket.test.ts:167`), preto sa dopĺňa z čítania assetu po usadení slotu (4.4). |
| O12 | Chýbajúci asset pri riadku už nahratom z udalosti | Neprepne sa na zlyhaný; čítanie prestane; varovanie len kým riadok nemá metadáta. To isté obmedzenie platí pre R7. |
| O13 | Odber notifikácií v sklade LIB | Len lenivo, s prvým riadkom; neodhlasuje sa. |
| O14 | Odstup 2 s a ručné „Obnoviť" | Ručné ho nemá; platí pre automatické čítania fronty. |
| O15 | `damUploadFinish` | Preč ide len posledný príznak; `endPointAsset` ostáva do kroku 5. |
| O16 | Výnimky hromadnej úpravy v DAM | Ostávajú obe, s bránou opravenou podľa 6.1. |
| — | Zlyhané čítanie po `copied` | Riadok ostáva a číta sa znova (pravidlo 8 plánu); tri testy na prepis sú v 9.2. |

---

## 11. Posudky: čo po overení v kóde nesedelo, a čo ostáva neoverené

Nesedelo alebo je vyriešené inak, než posudok navrhol:

1. **Codex, O11 (dôvod).** Tvrdí, že `assetStatus` riadku slotu kreslia `AssetQueueItemEditable.vue:184-186` a
   `AssetQueueSelectedItemSimple.vue:36-49`. Tie komponenty `assetStatus` čítajú, ale riadky slotov nekreslia:
   fronta slotov ide cez `AssetQueueUploadList.vue` a `AssetSlotListItem.vue`, oboje cez
   `AssetQueueItemList.vue`, ktorý ho nečíta. Záver (zachovať) platí z iného dôvodu: pripínajú ho nové testy.
2. **Opus, E5 (náprava).** Fixtúry bez `mainFile.fileAttributes` netreba dopĺňať. Všetky sa používajú cez
   udalosti alebo obaly, ktoré nesú nápovedu stavu (3.3), a tá zodpovedá dnešnému správaniu
   (`LIB store:277,457`, `DAM store:514-551`). Časť nápravy „vetvu `never` dať pred kontrolu `fileAttributes`"
   je zapracovaná.
3. **Opus, E9 (LIB).** Šesť podvrhov `damNotifications` netreba meniť: stav spojenia je vo vlastnom module
   (5.5). Časť o DAM (podvrh `useUpload`, 18 čakaní) sedí a je v 9.3.
4. **Codex, chyba 8, druhá polovica.** Čísla N-S1 až N-S14 boli v tabuľke krokov omylom; testy sú prečíslované.
5. **Zadanie k O11.** `assetStatus` nečíta len `AssetQueueItemEditable.vue:186`, ale aj
   `AssetQueueSelectedItemSimple.vue:38`; na výsledku to nič nemení.

Rozhodnutím prekonané (posudok nebol nesprávny, len sa rozhodlo inak): Codex O6 (2 s), O14 (odstup aj pre
ručné), O15 (odstrániť `endPointAsset`), O12 (žiadne varovanie); Opus O5 (hranica 20 minút), O1 pôvodného
návrhu.

Známe zmeny správania, ktoré krok 2 prinesie (na ranné posúdenie):
- zlyhané čítanie po `copied` riadok nezlyhá, číta sa znova;
- LIB pri zlyhaní servera maže starý text chyby;
- DAM „Obnoviť" rozhoduje podľa stavu hlavného súboru;
- DAM varovanie o nečitateľných metadátach až po treťom neúspechu (dnes hneď);
- LIB pri udalosti `failed` nečíta asset a pri udalosti pre asset, ktorý žiadna fronta nemá, nečíta nič;
- čítanie po notifikácii o metadátach, ktoré už ukáže `processed`, riadok usadí;
- otvorený detail prázdneho assetu dostane `mainFile` z každého čítania, pri notifikácii o metadátach o 2 s
  neskôr než dnes;
- kópia, ktorej hlavný súbor backend označil ako zlyhaný, bude zlyhaná (dnes nahratá). Backend to vie spraviť
  len pre slot bez zdroja (`ImageCopyFacade.php:178-194`); či sa to týka hlavného súboru, nie je overené.

Neoverené:
- či niekto pripája fronty LIB s inou než predvolenou konfiguráciou (5.4);
- či čítania assetu môžu ísť na oneskorenú repliku databázy. D7 počíta s tým, že asset vytvorený pri začiatku
  uploadu (alebo odpoveďou kópie či importu) je v čase prvého čítania viditeľný;
- čo pripínajú testy kroku 0 v LIB, ktoré sa ešte píšu;
- všetko, čo potrebuje beh: nič sa nespúšťalo.
