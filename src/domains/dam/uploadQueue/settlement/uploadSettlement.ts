import { toRaw } from 'vue'
import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import type { AssetDetailItemDto, DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  AssetFileFailReason,
  type AssetFileFailReasonType,
  type AssetFileNullable,
  AssetFileProcessStatus,
} from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { createQueuePoller, type QueuePoller } from '@/domains/dam/uploadQueue/settlement/uploadPoller'
import {
  UPLOAD_NOTIFY_FILE_DELAY_MS,
  UPLOAD_NOTIFY_METADATA_DELAY_MS,
  UPLOAD_POLL_ERROR_LADDER_MS,
  UPLOAD_POLL_MISSING_LIMIT,
  UPLOAD_POLL_READ_FAILURE_LIMIT,
  UPLOAD_POLL_SLOW_TEXT_AFTER_MS,
  UPLOAD_READ_BATCH_LIMIT,
} from '@/domains/dam/uploadQueue/settlement/uploadPollSchedule'
import {
  createUploadSettle,
  createUploadSettleMemory,
  isFinalFileStatus,
  type UploadReadIntent,
  type UploadTrackState,
} from '@/domains/dam/uploadQueue/settlement/uploadSettle'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import type {
  UploadReadOptions,
  UploadRefreshOutcome,
  UploadSettlement,
  UploadSettlementEvent,
  UploadSettlementProfile,
  UploadSettlementTarget,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { isNull, isUndefined } from '@/shared/utils/common'

interface TrackedRow {
  queueKey: UploadQueueKey
  queue: UploadQueue
  row: UploadQueueItem
  state: UploadTrackState
  /** The asset the row is read by. A duplicate that becomes its original changes the one of the row. */
  assetId: DocId
}

/** One request of a tick, and the tracked rows it asks about. */
interface ReadUnit {
  rows: TrackedRow[]
  /** `missing`: the one asset that was asked for by itself does not exist, which its reader was free to report. */
  read(
    options: UploadReadOptions
  ): Promise<{ assets: AssetDetailItemDto[]; missing?: boolean } | { slotFiles: AssetFileNullable[] }>
}

/** The reads of one DAM, one after another, and whether a streak of their failures is being reported. */
interface ReadLane {
  chain: Promise<void>
  failing: boolean
}

/** A read of one asset an event asked for, waiting for its time. */
interface PendingNamedRead {
  /** Of `pending`: the asset, and the configuration the read is for. */
  key: string
  assetId: DocId
  /** The configuration whose rows the read is for (`configOf` of the profile); every queue's when left out. */
  configName?: string
  // By `fileId ?? ''`.
  targets: Map<string, { fileId: DocIdNullable; intent: UploadReadIntent }>
  dueAt: number
  /** Failed tries in a row. */
  failures: number
  /** Tries in a row that found no asset. */
  misses: number
  /** A failure of its tries was written down: the next ones are not reported. */
  told: boolean
  timer: { handle: unknown } | null
  waiters: Array<() => void>
}

const TICK_INTENT: UploadReadIntent = { hint: null, metadata: true, early: false, seen: true }

/**
 * The settlement of the rows of one store: which rows wait for the server, one coordinator of all the reads, and
 * what starts a read: the tick of a queue, a notification, the refresh of a row.
 */
export function createUploadSettlement(profile: UploadSettlementProfile): UploadSettlement {
  const memory = createUploadSettleMemory()
  const pollers = new Map<UploadQueueKey, QueuePoller>()
  // One read of an asset waits at a time, and with the configurations of the queues one for each configuration.
  const pending = new Map<string, PendingNamedRead>()
  let unsubscribe: Array<() => void> = []
  let disposed = false
  // Raised when a queue is dropped: a tick that waited for its turn meanwhile is not for the queue that has the
  // key now.
  const generations = new Map<UploadQueueKey, number>()
  // The poll and the notifications ask for as long as a row waits, and a reader is to report only the first of
  // their requests that fails and is written down: `failing` of the lane from such a failure until a read answers,
  // and beside it the `reported` of each tracked row, until a read brings its asset. A failure that was not written
  // down (a timeout, 401, 403, as the readers say) has told nobody, and begins nothing.
  // One read at a time in a lane: its reads have one order, and a later one never overtakes. With the configurations
  // of the queues (`configOf`) a lane for each configuration, and one for the reads that name none: a slow DAM holds
  // back no read of another, and the failures of each are a streak of their own. Without them, one lane for the
  // whole store, as ever.
  const lanes = new Map<string | undefined, ReadLane>()
  const laneOf = (configName?: string) => {
    const key = profile.configOf ? configName : undefined
    let lane = lanes.get(key)
    if (!lane) {
      lane = { chain: Promise.resolve(), failing: false }
      lanes.set(key, lane)
    }
    return lane
  }
  /** The lane of the reads of the queue. */
  const laneOfQueue = (queueKey: UploadQueueKey) => laneOf(profile.configOf?.(queueKey))
  /** The lane of the reads of a target: of the one configuration it names. */
  const laneOfTarget = (target: UploadSettlementTarget) =>
    laneOf(target.configNames?.length === 1 ? target.configNames[0] : undefined)
  const failureReported = (error: unknown) => profile.readers.failureReported?.(error) ?? true

  const scheduler = () => uploadSettlementRuntime.scheduler
  // Asked anew after every wait: nothing is written, called or planned for a settlement that was disposed of.
  const isDisposed = () => disposed
  const generationOf = (queueKey: UploadQueueKey) => generations.get(queueKey) ?? 0

  const trackedRows = (queueKey?: UploadQueueKey): TrackedRow[] => {
    const tracked: TrackedRow[] = []
    for (const [key, queue] of profile.queues()) {
      if (queueKey !== undefined && key !== queueKey) continue
      for (const row of queue.items) {
        const state = memory.tracked.get(toRaw(row))
        if (!state || state.queueKey !== key) continue
        if (row.status === UploadQueueItemStatus.Stop || isNull(row.assetId)) continue
        tracked.push({ queueKey: key, queue, row, state, assetId: row.assetId })
      }
    }
    return tracked
  }

  const youngestAgeMs = (queueKey: UploadQueueKey) => {
    const now = scheduler().now()
    let youngest: number | null = null
    for (const { state } of trackedRows(queueKey)) {
      const age = now - state.eligibleSince
      if (youngest === null || age < youngest) youngest = age
    }
    return youngest
  }

  const settle = createUploadSettle(profile, memory, {
    // A queue that tracks nothing any more holds no timer.
    onUntrack: (queueKey) => {
      if (youngestAgeMs(queueKey) === null) pollers.get(queueKey)?.reschedule()
    },
    isDisposed,
  })

  const enqueueRead = <T>(lane: ReadLane, run: (startedAt: number) => Promise<T>): Promise<T> => {
    const result = lane.chain.then(() => run(settle.startRead()))
    lane.chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  const fetchCaches = () => settle.fetchNames()

  /** The configuration of the queue, as a target names it; nothing for a profile without `configOf`. */
  const namesOfQueue = (queueKey: UploadQueueKey) => (profile.configOf ? [profile.configOf(queueKey)] : undefined)

  /** Answers whether this miss was the one too many: the row is given up. */
  const countMiss = (tracked: Pick<TrackedRow, 'queueKey' | 'row' | 'state'>) => {
    tracked.state.misses++
    if (tracked.state.misses < UPLOAD_POLL_MISSING_LIMIT) return false
    settle.giveUpOnMissing(tracked)
    return true
  }

  // A row left failed without the original of its duplicate, and an uploaded one still without its metadata, are
  // no longer tracked, and a refresh may still help them. The reads that find no asset are counted for them here,
  // across them all and until one answers: at the limit there is nothing a refresh could read, and the uploaded
  // row fails. Answers as `countMiss` does.
  const missesOfLeft = new WeakMap<UploadQueueItem, number>()
  const countsMissesOfLeft = (row: UploadQueueItem) =>
    memory.refreshMayHelp.has(toRaw(row)) || settle.awaitsMetadata(row)
  const countMissOfLeft = ({ queueKey, row }: { queueKey: UploadQueueKey; row: UploadQueueItem }) => {
    const raw = toRaw(row)
    if (!countsMissesOfLeft(row)) return false
    const misses = (missesOfLeft.get(raw) ?? 0) + 1
    if (misses < UPLOAD_POLL_MISSING_LIMIT) {
      missesOfLeft.set(raw, misses)
      return false
    }
    missesOfLeft.delete(raw)
    settle.giveUpOnMissing({ queueKey, row })
    return true
  }

  /** The live rows a read of the asset would write into, for any of the given targets, of the configurations named. */
  const concernedRows = (
    assetId: DocId,
    targets: Iterable<{ fileId: DocIdNullable; intent: Pick<UploadReadIntent, 'early'> }>,
    configNames?: string[]
  ) => {
    const all = [...targets]
    return settle.rows().filter(({ queueKey, row }) => {
      if (row.status === UploadQueueItemStatus.Stop) return false
      return all.some(({ fileId, intent }) => {
        const target = { assetId, fileId, configNames }
        return (
          settle.concerns(queueKey, row, target, 'decorate') ||
          (intent.early && settle.concerns(queueKey, row, target, 'metadata'))
        )
      })
    })
  }

  const anyRowMatches = (target: UploadSettlementTarget, purpose: 'settle' | 'decorate' | 'metadata') =>
    settle
      .rows()
      .some(
        ({ queueKey, row }) =>
          row.status !== UploadQueueItemStatus.Stop && settle.concerns(queueKey, row, target, purpose)
      )

  // A read brought the asset of these rows: the counts of the tracked ones start anew, and their warning goes.
  const readSucceeded = (rows: Array<{ row: UploadQueueItem }>) => {
    for (const { row } of rows) {
      missesOfLeft.delete(toRaw(row))
      const state = settle.trackStateOf(row)
      if (!state) continue
      state.misses = 0
      state.readFailures = 0
      state.reported = false
      settle.noticeOf(row).readWarning = false
      settle.syncNotice(row)
    }
  }

  const untold = (rows: Array<{ row: UploadQueueItem }>) =>
    rows.every(({ row }) => settle.trackStateOf(row)?.reported !== true)

  // ---- the tick of a queue

  const readUnitsOf = (rows: TrackedRow[]): ReadUnit[] => {
    const byLicence = new Map<IntegerId, Map<DocId, TrackedRow[]>>()
    const bySlotAsset = new Map<DocId, TrackedRow[]>()
    for (const tracked of rows) {
      const reader = settle.policyOf(tracked.row).reader
      if (reader === 'none') continue
      let byAsset = bySlotAsset
      if (reader === 'asset') {
        byAsset = byLicence.get(tracked.row.licenceId) ?? new Map<DocId, TrackedRow[]>()
        byLicence.set(tracked.row.licenceId, byAsset)
      }
      byAsset.set(tracked.assetId, [...(byAsset.get(tracked.assetId) ?? []), tracked])
    }

    const units: ReadUnit[] = []
    for (const [licenceId, byAsset] of byLicence) {
      const assetIds = [...byAsset.keys()]
      // One asset is asked for by itself, as a notification asks for it.
      if (assetIds.length === 1) {
        units.push({
          rows: byAsset.get(assetIds[0]!)!,
          read: async (options) => {
            const asset = await profile.readers.asset(assetIds[0]!, options)
            return { assets: asset ? [asset] : [], missing: asset === null }
          },
        })
        continue
      }
      for (let from = 0; from < assetIds.length; from += UPLOAD_READ_BATCH_LIMIT) {
        const batch = assetIds.slice(from, from + UPLOAD_READ_BATCH_LIMIT)
        units.push({
          rows: batch.flatMap((assetId) => byAsset.get(assetId)!),
          read: async (options) => {
            const assets = await profile.readers.assets(licenceId, batch, options)
            // Not "every asset is missing".
            if (!Array.isArray(assets)) throw new Error('uploadSettlement: unexpected asset list')
            return { assets }
          },
        })
      }
    }
    for (const [assetId, slotRows] of bySlotAsset) {
      units.push({
        rows: slotRows,
        read: async (options) => {
          if (!profile.readers.slotFiles) throw new Error('uploadSettlement: no reader of the slots')
          const slotFiles = await profile.readers.slotFiles(assetId, options)
          if (!Array.isArray(slotFiles)) throw new Error('uploadSettlement: unexpected slot list')
          return { slotFiles }
        },
      })
    }
    return units
  }

  const applyAssets = async (
    unit: ReadUnit,
    assets: AssetDetailItemDto[],
    startedAt: number,
    goesOn: () => boolean,
    configNames: string[] | undefined
  ) => {
    for (const asset of assets) {
      if (!goesOn()) return
      try {
        await settle.applyAssetRead(
          asset,
          { assetId: asset.id, fileId: asset.mainFile?.id ?? null, configNames },
          TICK_INTENT,
          startedAt
        )
      } catch (error) {
        // One asset that cannot be written is not the end of the tick: the others, and the counts and the texts of
        // every row, go on.
        console.error('uploadQueue: a read asset could not be written', error)
      }
    }
    if (!goesOn()) return
    const present = new Set(assets.map((asset) => asset.id))
    for (const { state, assetId } of unit.rows) {
      if (present.has(assetId)) {
        state.misses = 0
        state.reported = false
      } else {
        state.misses++
      }
    }
  }

  const applySlotFile = async (tracked: TrackedRow, slotFiles: AssetFileNullable[], startedAt: number) => {
    const { row, state, assetId } = tracked
    if (!settle.isLive(row) || row.status === UploadQueueItemStatus.Stop || settle.isStale(row, startedAt)) return
    const file = slotFiles.find((candidate) => candidate?.id === row.fileId)
    if (!file) {
      state.misses++
      return
    }
    state.misses = 0
    state.reported = false
    const configNames = namesOfQueue(tracked.queueKey)
    const target = { assetId, fileId: row.fileId, configNames }
    switch (file.fileAttributes?.status) {
      case AssetFileProcessStatus.Processed:
        settle.settleProcessedByEvent(target)
        // The asset completes the row, and gives an open detail its main file. Not awaited: it waits for this
        // very read to end.
        void scheduleNamed(
          assetId,
          row.fileId,
          { hint: 'processed', metadata: false, early: false, seen: true },
          0,
          configNames
        )
        break
      case AssetFileProcessStatus.Failed:
        settle.settleFailed(tracked, file.fileAttributes.failReason)
        break
      case AssetFileProcessStatus.Duplicate:
        await settle.settleDuplicate(target, file.originAssetFile, row.assetType, (candidate) => {
          return !settle.isStale(candidate, startedAt)
        })
        break
    }
  }

  // The bulk read carries only the main file of an asset, so a slot row is read from the list of its asset's slots.
  const applySlotFiles = async (
    unit: ReadUnit,
    slotFiles: AssetFileNullable[],
    startedAt: number,
    goesOn: () => boolean
  ) => {
    for (const tracked of unit.rows) {
      if (!goesOn()) return
      try {
        await applySlotFile(tracked, slotFiles, startedAt)
      } catch (error) {
        console.error('uploadQueue: a read slot file could not be written', error)
      }
    }
  }

  const readQueue = async (queueKey: UploadQueueKey, generation: number, startedAt: number) => {
    // Asked when the tick gets its turn and after every wait: it may have waited behind another read, and its
    // queue may have been dropped meanwhile, with another one under the same key by now.
    const goesOn = () => !isDisposed() && generationOf(queueKey) === generation
    if (!goesOn()) return
    const lane = laneOfQueue(queueKey)
    const units = readUnitsOf(trackedRows(queueKey))
    if (!units.length) return
    // Each request is told whether a failure of it is the first of a streak: for every request of a tick that
    // begins one, since they go out together.
    const options = units.map((unit) => ({
      report: !lane.failing && unit.rows.every(({ state }) => !state.reported),
      queueKey,
    }))
    // The requests go out together; what they brought is written one after another.
    const answers = await Promise.allSettled(units.map((unit, index) => unit.read(options[index]!)))
    if (!goesOn()) return
    let failed = 0
    let reportedFailure = false
    for (const [index, unit] of units.entries()) {
      const answer = answers[index]!
      const { report } = options[index]!
      if (answer.status === 'rejected') {
        failed++
        const told = report && failureReported(answer.reason)
        if (told) reportedFailure = true
        unit.rows.forEach(({ state }) => {
          state.readFailures++
          if (told) state.reported = true
        })
        continue
      }
      unit.rows.forEach(({ state }) => (state.readFailures = 0))
      if ('assets' in answer.value) {
        // Into the rows of the configuration of the queue alone: another DAM may have an asset of that id.
        await applyAssets(unit, answer.value.assets, startedAt, goesOn, namesOfQueue(queueKey))
        // The reader has said so, when it was let: it is not let again for these rows.
        if (answer.value.missing && report) unit.rows.forEach(({ state }) => (state.reported = true))
      } else {
        await applySlotFiles(unit, answer.value.slotFiles, startedAt, goesOn)
      }
      if (!goesOn()) return
    }
    // A request that answered ends the streak; one that failed and was written down begins it.
    if (failed < units.length) lane.failing = false
    else if (reportedFailure) lane.failing = true
    fetchCaches()

    const now = scheduler().now()
    for (const tracked of trackedRows(queueKey)) {
      const { row, state } = tracked
      if (state.misses >= UPLOAD_POLL_MISSING_LIMIT) {
        settle.giveUpOnMissing(tracked)
        continue
      }
      const notice = settle.noticeOf(row)
      if (state.readFailures >= UPLOAD_POLL_READ_FAILURE_LIMIT) notice.readWarning = true
      else if (state.readFailures === 0) notice.readWarning = false
      const waitsForServer = row.status === UploadQueueItemStatus.Processing && !state.clientFailed
      if (waitsForServer && now - state.eligibleSince >= UPLOAD_POLL_SLOW_TEXT_AFTER_MS) notice.slow = true
      settle.syncNotice(row)
    }

    // The poller takes this for a failed read and waits by its error ladder.
    if (failed === units.length) throw new Error('uploadSettlement: the read of the queue failed')
  }

  // ---- reads a notification asks for

  const mergeTarget = (read: PendingNamedRead, fileId: DocIdNullable, intent: UploadReadIntent) => {
    const key = fileId ?? ''
    const known = read.targets.get(key)?.intent
    read.targets.set(key, {
      fileId,
      intent: known
        ? {
            hint: known.hint ?? intent.hint,
            metadata: known.metadata || intent.metadata,
            early: known.early || intent.early,
            seen: known.seen || intent.seen,
          }
        : { ...intent },
    })
  }

  const armNamed = (read: PendingNamedRead) => {
    if (read.timer) scheduler().clearTimeout(read.timer.handle)
    const delay = Math.max(0, read.dueAt - scheduler().now())
    read.timer = { handle: scheduler().setTimeout(() => fireNamed(read), delay) }
  }

  const releaseWaiters = (read: PendingNamedRead) => {
    const waiters = read.waiters
    read.waiters = []
    waiters.forEach((resolve) => resolve())
  }

  /**
   * A read of the named asset in `delayMs`; joins the read of that asset that waits already. Of each configuration
   * named, a read of its own for the rows of its queues; without one, a read for the rows of every queue.
   */
  const scheduleNamed = (
    assetId: DocId,
    fileId: DocIdNullable,
    intent: UploadReadIntent,
    delayMs: number,
    configNames?: string[]
  ) => {
    const names = profile.configOf && configNames?.length ? [...new Set(configNames)] : [undefined]
    return Promise.all(names.map((name) => scheduleRead(assetId, fileId, intent, delayMs, name))).then(() => undefined)
  }

  const scheduleRead = (
    assetId: DocId,
    fileId: DocIdNullable,
    intent: UploadReadIntent,
    delayMs: number,
    configName: string | undefined
  ) => {
    const key = isUndefined(configName) ? assetId : `${configName}\u0000${assetId}`
    let read = pending.get(key)
    if (!read) {
      read = {
        key,
        assetId,
        configName,
        targets: new Map(),
        dueAt: Infinity,
        failures: 0,
        misses: 0,
        told: false,
        timer: null,
        waiters: [],
      }
      pending.set(key, read)
    }
    mergeTarget(read, fileId, intent)
    read.dueAt = Math.min(read.dueAt, scheduler().now() + delayMs)
    armNamed(read)
    const waiting = read
    return new Promise<void>((resolve) => waiting.waiters.push(resolve))
  }

  const fireNamed = (read: PendingNamedRead) => {
    read.timer = null
    if (pending.get(read.key) === read) pending.delete(read.key)
    void enqueueRead(laneOf(read.configName), (startedAt) => readNamed(read, startedAt))
  }

  const retryNamed = (read: PendingNamedRead, attempt: number) => {
    const delay = UPLOAD_POLL_ERROR_LADDER_MS[Math.min(attempt, UPLOAD_POLL_ERROR_LADDER_MS.length) - 1]!
    const waiting = pending.get(read.key)
    if (!waiting) {
      read.dueAt = scheduler().now() + delay
      pending.set(read.key, read)
      armNamed(read)
      return
    }
    // An event came while this read was on its way and waits in a read of its own: the retry joins it.
    read.targets.forEach(({ fileId, intent }) => mergeTarget(waiting, fileId, intent))
    waiting.failures = Math.max(waiting.failures, read.failures)
    waiting.misses = Math.max(waiting.misses, read.misses)
    waiting.told ||= read.told
  }

  const warnAboutRead = (rows: Array<{ row: UploadQueueItem }>) => {
    for (const { row } of rows) {
      settle.noticeOf(row).readWarning = true
      settle.syncNotice(row)
    }
  }

  /** The configurations a pending read names: its own, or none. */
  const namesOfRead = (read: PendingNamedRead) => (isUndefined(read.configName) ? undefined : [read.configName])
  /** The rows the pending read is for, as they are now. */
  const rowsOfRead = (read: PendingNamedRead) => concernedRows(read.assetId, read.targets.values(), namesOfRead(read))

  const readNamed = async (read: PendingNamedRead, startedAt: number) => {
    try {
      // The rows it was for have left their queues meanwhile: nothing to ask for.
      const askedFor = rowsOfRead(read)
      if (isDisposed() || !askedFor.length) return
      const lane = laneOf(read.configName)
      // Until one of its tries was written down, when no streak runs and none of its rows has had its trouble
      // reported.
      const report = !lane.failing && !read.told && read.misses === 0 && untold(askedFor)
      let asset: AssetDetailItemDto | null
      try {
        asset = await profile.readers.asset(read.assetId, { report, queueKey: askedFor[0]!.queueKey })
      } catch (error) {
        if (isDisposed()) return
        // Its rows left while it was on the wire: nobody waits for another try, and it begins no streak.
        const left = rowsOfRead(read)
        if (!left.length) return
        read.failures++
        const told = report && failureReported(error)
        if (told) {
          read.told = true
          lane.failing = true
        }
        // The count of the read times its tries, and says when a row no tick asks about has waited in vain. A
        // tracked row warns by its own count: ticks fail and succeed for it between the tries of this read.
        const exhausted = read.failures >= UPLOAD_POLL_READ_FAILURE_LIMIT
        const warned: Array<{ row: UploadQueueItem }> = []
        for (const entry of left) {
          const state = settle.trackStateOf(entry.row)
          if (state) {
            state.readFailures++
            if (told) state.reported = true
          }
          if (state ? state.readFailures >= UPLOAD_POLL_READ_FAILURE_LIMIT : exhausted) warned.push(entry)
        }
        // Once exhausted, only the refresh of the row asks again.
        if (!exhausted) retryNamed(read, read.failures)
        warnAboutRead(warned)
        return
      }
      if (isDisposed()) return
      read.failures = 0
      lane.failing = false
      if (asset === null) {
        read.misses++
        const concerned = rowsOfRead(read)
        const untracked = concerned.filter(({ row }) => !settle.trackStateOf(row))
        for (const { queueKey, row } of concerned) {
          const state = settle.trackStateOf(row)
          if (!state) {
            countMissOfLeft({ queueKey, row })
            continue
          }
          if (report) state.reported = true
          countMiss({ queueKey, row, state })
        }
        // Nobody is left to try again for.
        if (!concerned.length) return
        if (read.misses < UPLOAD_POLL_MISSING_LIMIT) retryNamed(read, read.misses)
        // A row an event has settled is not flipped to failed; it only says its data could not be read. One still
        // without its metadata has failed by its count above.
        else warnAboutRead(untracked)
        return
      }
      readSucceeded(rowsOfRead(read))
      for (const { fileId, intent } of read.targets.values()) {
        if (isDisposed()) return
        await settle.applyAssetRead(
          asset,
          { assetId: read.assetId, fileId, configNames: namesOfRead(read) },
          intent,
          startedAt
        )
      }
      if (isDisposed()) return
      fetchCaches()
    } catch (error) {
      console.error('uploadQueue: the asset of a notification could not be settled', error)
    } finally {
      releaseWaiters(read)
    }
  }

  // ---- reads asked for at once

  // Of the reads of several configurations, the outcome first in this order that any of them had is told.
  const OUTCOME_ORDER: UploadRefreshOutcome[] = ['error', 'originalUnread', 'missing', 'pending', 'settled']

  /**
   * What the one who asked is told of the read. What asking again may mend, by its cause: the read failed
   * (`error`), the asset was not found (`missing`), or a row is left without the original of its duplicate
   * (`originalUnread`). A target that names several configurations is read once for each, by a queue of it.
   */
  const readTargetNow = (target: UploadSettlementTarget, intent: UploadReadIntent): Promise<UploadRefreshOutcome> => {
    const targets = settle.byConfiguration(target)
    if (targets.length === 1) return readOneNow(target, intent)
    return Promise.all(targets.map((one) => readOneNow(one, intent))).then(
      (outcomes) => OUTCOME_ORDER.find((outcome) => outcomes.includes(outcome)) ?? 'settled'
    )
  }

  const readOneNow = (target: UploadSettlementTarget, intent: UploadReadIntent): Promise<UploadRefreshOutcome> =>
    enqueueRead(laneOfTarget(target), async (startedAt) => {
      try {
        if (isDisposed()) return 'error'
        // The queue of the first row the read is for, noted before it is asked.
        const queueKey = concernedRows(target.assetId, [{ fileId: target.fileId, intent }], target.configNames)[0]
          ?.queueKey
        // A configuration named that has no row of the asset (any longer): its DAM is not asked.
        if (profile.configOf && target.configNames?.length && isUndefined(queueKey)) return 'settled'
        // The user asked: every failure of it is reported.
        const asset = await profile.readers.asset(target.assetId, { report: true, queueKey })
        if (isDisposed()) return 'error'
        laneOfTarget(target).failing = false
        const concerned = concernedRows(target.assetId, [{ fileId: target.fileId, intent }], target.configNames)
        if (asset === null) {
          let givenUp = false
          let askedOn = false
          for (const { queueKey, row } of concerned) {
            const state = settle.trackStateOf(row)
            // Said by this read: the poll does not say it again.
            if (state) state.reported = true
            if (state ? countMiss({ queueKey, row, state }) : countMissOfLeft({ queueKey, row })) givenUp = true
            else if (state || countsMissesOfLeft(row)) askedOn = true
          }
          // The miss that was one too many has settled its rows, as given up: there is nothing to ask again.
          return givenUp && !askedOn ? 'settled' : 'missing'
        }
        readSucceeded(concerned)
        const leftWithout = await settle.applyAssetRead(asset, target, intent, startedAt)
        if (isDisposed()) return 'error'
        fetchCaches()
        if (leftWithout) return 'originalUnread'
        // Otherwise by the state of the main file alone, whichever rows were written.
        return isFinalFileStatus(asset.mainFile?.fileAttributes?.status) ? 'settled' : 'pending'
      } catch {
        return 'error'
      }
    })

  const refreshAsset = (target: UploadSettlementTarget) =>
    readTargetNow(target, { hint: null, metadata: true, early: false, seen: true })

  const settleKnownProcessed = async (target: UploadSettlementTarget, options: { withMetadata: boolean }) => {
    await readTargetNow(target, { hint: 'processed', metadata: options.withMetadata, early: false, seen: true })
  }

  const settleKnownFailed = (target: UploadSettlementTarget, failReason: AssetFileFailReasonType) => {
    if (isDisposed()) return
    settle.settleKnownFailed(target, failReason)
  }

  const settleKnownDuplicate = (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null
  ) => (isDisposed() ? Promise.resolve() : settle.settleKnownDuplicate(target, originFileId, assetType))

  const notify = (event: UploadSettlementEvent): Promise<void> => {
    if (isDisposed()) return Promise.resolve()
    const target = { assetId: event.assetId, fileId: event.fileId, configNames: event.configNames }
    try {
      switch (event.kind) {
        case 'processed':
          if (!anyRowMatches(target, 'decorate')) break
          settle.settleProcessedByEvent(target)
          settle.announceProcessed(target)
          return scheduleNamed(
            event.assetId,
            event.fileId,
            { hint: 'processed', metadata: false, early: false, seen: true },
            UPLOAD_NOTIFY_FILE_DELAY_MS,
            event.configNames
          )
        case 'copied':
          if (!anyRowMatches(target, 'decorate')) break
          // A copy gets no metadata notification: its metadata comes with this read.
          return scheduleNamed(
            event.assetId,
            event.fileId,
            { hint: 'processed', metadata: true, early: false, seen: true },
            UPLOAD_NOTIFY_FILE_DELAY_MS,
            event.configNames
          )
        case 'metadata':
          if (!anyRowMatches(target, 'metadata')) break
          return scheduleNamed(
            event.assetId,
            event.fileId,
            { hint: null, metadata: true, early: true, seen: false },
            UPLOAD_NOTIFY_METADATA_DELAY_MS,
            event.configNames
          )
        case 'failed':
          settle.settleKnownFailed(target, event.failReason ?? AssetFileFailReason.Unknown)
          break
        case 'duplicate':
          if (!anyRowMatches(target, 'settle')) break
          return settle.settleKnownDuplicate(target, event.originAssetFile ?? null, event.assetType ?? null)
      }
    } catch (error) {
      console.error('uploadQueue: the notification could not be settled', error)
    }
    return Promise.resolve()
  }

  // ---- tracking

  const subscribe = () => {
    if (unsubscribe.length) return
    unsubscribe = [
      uploadSettlementRuntime.visibility.onChange(() => {
        const visible = uploadSettlementRuntime.visibility.isVisible()
        pollers.forEach((poller) => (visible ? poller.readNow('visible') : poller.reschedule()))
      }),
      // The notifications came alive or died: the rhythm of the other mode.
      profile.connection.onChange(() => pollers.forEach((poller) => poller.reschedule())),
    ]
  }

  const unsubscribeAll = () => {
    unsubscribe.forEach((stop) => stop())
    unsubscribe = []
  }

  const pollerOf = (queueKey: UploadQueueKey) => {
    let poller = pollers.get(queueKey)
    if (!poller) {
      poller = createQueuePoller({
        youngestAgeMs: () => youngestAgeMs(queueKey),
        // The socket of the configuration of the queue: the queue of one without a socket polls densely.
        mode: () => (profile.connection.isPushAlive(queueKey) ? 'sparse' : 'dense'),
        read: () => {
          const generation = generationOf(queueKey)
          return enqueueRead(laneOfQueue(queueKey), (startedAt) => readQueue(queueKey, generation, startedAt))
        },
      })
      pollers.set(queueKey, poller)
      subscribe()
    }
    return poller
  }

  const queueOf = (queueKey: UploadQueueKey) => {
    for (const [key, queue] of profile.queues()) {
      if (key === queueKey) return queue
    }
    return null
  }

  const track = (queueKey: UploadQueueKey, row: UploadQueueItem, options: { clientFailed?: boolean } = {}) => {
    if (isDisposed()) return
    const raw = toRaw(row)
    const queue = queueOf(queueKey)
    if (!queue || !toRaw(queue.items).some((item) => toRaw(item) === raw)) return
    // Nothing a tick could ask about.
    if (row.status === UploadQueueItemStatus.Stop || isNull(row.assetId)) return
    const reader = settle.policyOf(row).reader
    if (reader === 'none' || (reader === 'slots' && !profile.readers.slotFiles)) return
    memory.tracked.set(raw, {
      queueKey,
      eligibleSince: scheduler().now(),
      clientFailed: options.clientFailed === true,
      misses: 0,
      readFailures: 0,
      reported: false,
    })
    // Failed by the client, and the server may finish the file all the same.
    settle.setRefreshMayHelp(queueKey, row, options.clientFailed === true)
    pollerOf(queueKey).rowAdded()
  }

  // The rows a waiting read was asked for are leaving: a read no other row needs does not wait on.
  const cancelUnneeded = (leaving: (entry: { queueKey: UploadQueueKey; row: UploadQueueItem }) => boolean) => {
    for (const read of pending.values()) {
      if (rowsOfRead(read).some((entry) => !leaving(entry))) continue
      if (read.timer) scheduler().clearTimeout(read.timer.handle)
      read.timer = null
      pending.delete(read.key)
      releaseWaiters(read)
    }
  }

  // The store takes the row out: its ticks end here, and so do the reads notifications asked for on its behalf.
  const untrack = (row: UploadQueueItem) => {
    if (isDisposed()) return
    const raw = toRaw(row)
    const leaving = settle.rows().find((entry) => toRaw(entry.row) === raw)
    if (leaving) settle.setRefreshMayHelp(leaving.queueKey, row, false)
    settle.untrack(row)
    cancelUnneeded((entry) => toRaw(entry.row) === raw)
  }

  const dropQueue = (queueKey: UploadQueueKey) => {
    if (isDisposed()) return
    const queue = queueOf(queueKey)
    if (queue) {
      for (const row of queue.items) {
        settle.setRefreshMayHelp(queueKey, row, false)
        if (memory.tracked.get(toRaw(row))?.queueKey === queueKey) memory.tracked.delete(toRaw(row))
      }
    }
    generations.set(queueKey, generationOf(queueKey) + 1)
    const lane = laneOfQueue(queueKey)
    pollers.get(queueKey)?.stop()
    pollers.delete(queueKey)
    // Nothing is asked about any more, by the store or in the lane of the queue: what fails for the next rows is a
    // streak of its own.
    if (!pollers.size) {
      unsubscribeAll()
      lanes.forEach((one) => (one.failing = false))
    } else if (![...pollers.keys()].some((key) => laneOfQueue(key) === lane)) {
      lane.failing = false
    }
    cancelUnneeded((entry) => entry.queueKey === queueKey)
  }

  const hasTracked = () => !isDisposed() && trackedRows().length > 0
  const isGivenUpMissing = (row: UploadQueueItem) => memory.givenUpMissing.has(toRaw(row))

  const dispose = () => {
    disposed = true
    pollers.forEach((poller) => poller.stop())
    pollers.clear()
    pending.forEach((read) => {
      if (read.timer) scheduler().clearTimeout(read.timer.handle)
      read.timer = null
      releaseWaiters(read)
    })
    pending.clear()
    unsubscribeAll()
  }

  return {
    track,
    untrack,
    dropQueue,
    notify,
    refreshAsset,
    settleKnownProcessed,
    settleKnownDuplicate,
    settleKnownFailed,
    isGivenUpMissing,
    hasTracked,
    dispose,
  }
}
