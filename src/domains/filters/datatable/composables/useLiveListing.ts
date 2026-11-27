import { useDocumentVisibility } from '@vueuse/core'
import { computed, onScopeDispose, readonly, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

export type LiveListingKey = number | string

export interface LiveListingProbeOptions {
  limit: number
  signal: AbortSignal
}

export interface LiveListingInterval {
  /** Probe period while the browser tab is visible. */
  visibleMs: number
  /** Probe period while the browser tab is hidden, so a count in the browser title stays fresh. */
  hiddenMs: number
}

/**
 * How often a list without backend signals probes for new records: every 10 s while the browser tab is visible,
 * every minute while it is hidden, so a count in the browser title stays fresh.
 */
export const LIVE_LISTING_INTERVAL: LiveListingInterval = { visibleMs: 10_000, hiddenMs: 60_000 }

/**
 * How a record counts as new: `newer` than the newest record the user has seen, or `unseen`, a record of the probe
 * the user has not seen listed, for listings where a record can enter with a key older than the newest one.
 */
export type LiveListingNewness = 'newer' | 'unseen'

export interface UseLiveListingOptions<T> {
  /**
   * Newest records under the current filters, newest first by `key`, at most `limit` of them.
   * It must leave the shown list alone and load nothing else for the rows.
   */
  probe: (options: LiveListingProbeOptions) => Promise<T[]>
  /** Newness key: an autoincrement id, or a UTC datetime string in one format. */
  key: (item: T) => LiveListingKey
  /** Fetches the list on the click of the pill and reports it back with `markLoaded`. */
  reload: () => Promise<void>
  /** What the user filters by. When it changes, the baseline is set anew; otherwise it never decreases. */
  scope?: MaybeRefOrGetter<unknown>
  /** Probes on a timer, for listings without a backend signal, or while it is down. */
  interval?: MaybeRefOrGetter<LiveListingInterval | false>
  newness?: LiveListingNewness
  /**
   * How many of the newest records a probe asks for. Default `max + 1`; with `unseen` newness give the page size,
   * as an unseen record can enter anywhere on the first page.
   */
  probeLimit?: number
  /** Highest count shown as a number, more is shown as `max+`. */
  max?: number
  /** Shortest gap between the start of two probes requested by signals. */
  minIntervalMs?: number
  /** Wait after a signal, so a burst of signals ends in one probe. */
  debounceMs?: number
  /**
   * Whether the list is loading, for loads not started by the pill (a filter, the user's own change): a change
   * signalled after such a load started stays offered after its `markLoaded`, as the load may have read the record
   * before it changed. Without it such a load forgets every change offered.
   */
  loading?: MaybeRefOrGetter<boolean>
}

const RETURN_PROBE_GAP_MS = 2000
const MAX_RETRY_MS = 60_000

/** Orders newness keys: numbers by value, strings (UTC datetimes in one format) as text. */
export const compareLiveListingKeys = (a: LiveListingKey, b: LiveListingKey) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  if (sa === sb) return 0
  return sa < sb ? -1 : 1
}

const serializeScope = (scope: unknown) => {
  try {
    return JSON.stringify(scope) ?? ''
  } catch {
    return String(scope)
  }
}

/**
 * Tells the user that new records exist under the current filters, without changing the list until they click.
 * A probe (a small list request, newest first) runs on a signal, on a timer or when the user returns to the
 * browser tab; its records newer than the baseline are the count. The baseline is the newest record the user
 * has seen, taken from every full load reported through `markLoaded`.
 */
export function useLiveListing<T>(options: UseLiveListingOptions<T>) {
  const max = options.max ?? 9
  const minIntervalMs = options.minIntervalMs ?? 10_000
  const debounceMs = options.debounceMs ?? 1500
  const newness = options.newness ?? 'newer'
  const probeLimit = Math.max(options.probeLimit ?? max + 1, max + 1)
  const currentInterval = () => toValue(options.interval) ?? false

  const count = ref(0)
  const failed = ref(false)
  const changed = ref(false)
  const overflow = computed(() => count.value > max)
  const label = computed(() => {
    if (count.value === 0) return ''
    return overflow.value ? `${max}+` : String(count.value)
  })

  // undefined: not known yet, nothing is probed; null: the filtered list was empty, every record is new.
  let baseline: LiveListingKey | null | undefined = undefined
  // The same, for callers that keep what the user has seen, e.g. for a count on an inactive tab.
  const baselineState = shallowRef<LiveListingKey | null | undefined>(undefined)
  const setBaseline = (value: LiveListingKey | null | undefined) => {
    baseline = value
    baselineState.value = value
  }
  let baselineScope: string | undefined = undefined
  // With `unseen` newness: the keys the user has seen listed under the baseline scope.
  const seenKeys = new Set<LiveListingKey>()
  // With `unseen` newness: the oldest record of the last full load when it filled the probe. An unseen record below
  // it reached the first page because listed ones left the filter, not because it entered.
  let seenFloor: LiveListingKey | undefined = undefined
  // Bumped by every full load: answers of probes started before it are dropped.
  let generation = 0
  let controller: AbortController | undefined = undefined
  // The controller of a probe in flight, as opposed to a baseline fetch.
  let probeInFlight: AbortController | undefined = undefined
  let rerun = false
  let lastProbeAt = 0
  let intervalTimer: ReturnType<typeof setTimeout> | undefined = undefined
  let signalTimer: ReturnType<typeof setTimeout> | undefined = undefined
  // A failed probe or baseline fetch is tried again, less and less often, also when no interval runs.
  let retryTimer: ReturnType<typeof setTimeout> | undefined = undefined
  let failures = 0
  // A probe asked for while no baseline is known, or while a full load replaces the list: it runs once the list is.
  let probeWanted = false
  // Signals (`requestProbe`, `markChanged`) counted, so the pill's reload can tell those that came while it ran.
  let signals = 0
  let changedAtSignal = 0
  let applyingFrom: number | undefined = undefined
  // The signals counted when the current or last load given by `loading` started.
  let loadingFrom: number | undefined = undefined
  let applying: Promise<void> | undefined = undefined
  let disposed = false

  const visibility = useDocumentVisibility()

  const isNew = (key: LiveListingKey) => {
    if (newness === 'unseen') {
      return (
        baseline !== undefined &&
        !seenKeys.has(key) &&
        (seenFloor === undefined || compareLiveListingKeys(key, seenFloor) > 0)
      )
    }
    return baseline === null || (baseline !== undefined && compareLiveListingKeys(key, baseline) > 0)
  }

  const raiseBaseline = (key: LiveListingKey | null, scope: string) => {
    if (baselineScope !== scope) seenKeys.clear()
    if (baselineScope !== scope || baseline === undefined || baseline === null) {
      setBaseline(key)
    } else if (key !== null && compareLiveListingKeys(key, baseline) > 0) {
      setBaseline(key)
    }
    baselineScope = scope
  }

  const newestKey = (items: T[]) =>
    items.reduce<LiveListingKey | null>((newest, item) => {
      const key = options.key(item)
      return newest === null || compareLiveListingKeys(key, newest) > 0 ? key : newest
    }, null)

  const oldestKey = (items: T[]) =>
    items.reduce<LiveListingKey | undefined>((oldest, item) => {
      const key = options.key(item)
      return oldest === undefined || compareLiveListingKeys(key, oldest) < 0 ? key : oldest
    }, undefined)

  const see = (items: T[]) => {
    if (newness !== 'unseen') return
    items.forEach((item) => seenKeys.add(options.key(item)))
    // Fewer records than the probe asks for were all there were under the filter, so nothing can slide in.
    seenFloor = items.length >= probeLimit ? oldestKey(items) : undefined
  }

  const abortProbe = () => {
    controller?.abort()
    controller = undefined
    probeInFlight = undefined
    rerun = false
  }

  const clearTimers = () => {
    clearTimeout(intervalTimer)
    clearTimeout(signalTimer)
    clearTimeout(retryTimer)
    intervalTimer = undefined
    signalTimer = undefined
    retryTimer = undefined
  }

  const scheduleRetry = (run: () => void) => {
    clearTimeout(retryTimer)
    if (disposed) return
    const ms = Math.min(minIntervalMs * 2 ** failures, MAX_RETRY_MS)
    failures += 1
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      run()
    }, ms)
  }

  const succeeded = () => {
    failures = 0
    clearTimeout(retryTimer)
    retryTimer = undefined
    failed.value = false
  }

  const runWantedProbe = () => {
    if (!probeWanted) return
    probeWanted = false
    scheduleProbe()
  }

  const scheduleInterval = () => {
    clearTimeout(intervalTimer)
    intervalTimer = undefined
    const interval = currentInterval()
    if (!interval || disposed || overflow.value || baseline === undefined) return
    const ms = visibility.value === 'hidden' ? interval.hiddenMs : interval.visibleMs
    intervalTimer = setTimeout(async () => {
      intervalTimer = undefined
      await runProbe()
      scheduleInterval()
    }, ms)
  }

  const runProbe = async () => {
    if (disposed || baseline === undefined || overflow.value) return
    if (controller) {
      rerun = true
      return
    }
    const myGeneration = generation
    const myController = new AbortController()
    controller = myController
    probeInFlight = myController
    lastProbeAt = Date.now()
    try {
      const items = await options.probe({ limit: probeLimit, signal: myController.signal })
      if (myController.signal.aborted || myGeneration !== generation) return
      count.value = items.filter((item) => isNew(options.key(item))).length
      succeeded()
      if (overflow.value) clearTimers()
    } catch {
      if (myController.signal.aborted || myGeneration !== generation) return
      failed.value = true
      // The interval tries again on its own; signals may not come for long.
      if (!currentInterval()) scheduleRetry(() => void runProbe())
    } finally {
      if (controller === myController) controller = undefined
      if (probeInFlight === myController) probeInFlight = undefined
      if (rerun && !myController.signal.aborted) {
        rerun = false
        scheduleProbe()
      }
    }
  }

  const scheduleProbe = () => {
    if (disposed || overflow.value) return
    if (baseline === undefined) {
      probeWanted = true
      return
    }
    if (signalTimer) return
    const wait = Math.max(debounceMs, lastProbeAt + minIntervalMs - Date.now())
    signalTimer = setTimeout(() => {
      signalTimer = undefined
      void runProbe()
    }, wait)
  }

  /** Asks for a probe, e.g. on a backend signal. A burst of requests ends in one probe. */
  const requestProbe = () => {
    if (disposed) return
    signals += 1
    scheduleProbe()
  }

  const fetchBaseline = async (scope: string, myGeneration: number) => {
    const myController = new AbortController()
    controller = myController
    try {
      // With `unseen` newness, what the probe would count is seen: the list the user looks at holds it.
      const limit = newness === 'unseen' ? probeLimit : 1
      const items = await options.probe({ limit, signal: myController.signal })
      if (myController.signal.aborted || myGeneration !== generation) return
      raiseBaseline(newestKey(items), scope)
      see(items)
      succeeded()
      scheduleInterval()
      runWantedProbe()
    } catch {
      if (myController.signal.aborted || myGeneration !== generation) return
      failed.value = true
      // Without a baseline nothing is probed, so the fetch itself is tried again.
      scheduleRetry(() => {
        if (myGeneration === generation) void fetchBaseline(scope, myGeneration)
      })
    } finally {
      if (controller === myController) controller = undefined
      if (rerun && !myController.signal.aborted) {
        rerun = false
        scheduleProbe()
      }
    }
  }

  // A probe still to run or running may announce records the load did not see; so may one that counted records
  // while the load ran, unknown outside the pill's reload, which knows when it started.
  const signalPending = () =>
    signalTimer !== undefined ||
    rerun ||
    probeInFlight !== undefined ||
    (applyingFrom !== undefined ? signals > applyingFrom : count.value > 0)

  /**
   * Reports a successful full load of the list: a filter, a sort, page 1 or a reload after the click.
   * `newestFirst`: the items are page 1 sorted newest first, so the newest of them is the baseline.
   * Otherwise `newest` gives it: what the probe returns under the loaded filters (one record, with `unseen` newness
   * `probeLimit`), asked for when the load started, so a record created while the list loaded is counted, at worst
   * one the list shows. Without it one probe after the load finds the baseline and takes such a record as seen.
   * A switch to another page needs no report. The changes offered end, except those signalled while the pill's
   * reload or a load given by `loading` ran.
   */
  const markLoaded = (items: T[], loaded: { newestFirst: boolean; newest?: T[] }) => {
    generation += 1
    if (signalPending()) probeWanted = true
    // A change signalled while the load ran (the pill's reload, or one given by `loading`) may be newer than what it
    // loaded.
    const loadFrom =
      applyingFrom !== undefined && loadingFrom !== undefined
        ? Math.min(applyingFrom, loadingFrom)
        : (applyingFrom ?? loadingFrom)
    changed.value = loadFrom !== undefined && changedAtSignal > loadFrom
    if (!toValue(options.loading)) loadingFrom = undefined
    abortProbe()
    clearTimers()
    count.value = 0
    failures = 0
    failed.value = false
    const scope = serializeScope(toValue(options.scope))
    const seenNewest = loaded.newestFirst ? items : loaded.newest
    if (seenNewest) {
      raiseBaseline(newestKey(seenNewest), scope)
      see(seenNewest)
      scheduleInterval()
      runWantedProbe()
      return
    }
    // No probe runs until the new baseline is known: under other filters the old one means nothing, under the same
    // ones it may be older than the rows shown, so a probe would count them.
    setBaseline(undefined)
    scheduleInterval()
    void fetchBaseline(scope, generation)
  }

  /**
   * Asks the user to reload the list because records already in it changed, e.g. moved to another tab or got
   * another status, which no count shows. The pill offers it while nothing new is counted.
   */
  const markChanged = () => {
    // Before the first load nothing is shown that could change, but a change signalled while that load runs (given
    // by `loading`) may be missing from what it reads: the first `markLoaded` offers it.
    if (disposed || (generation === 0 && loadingFrom === undefined)) return
    signals += 1
    changedAtSignal = signals
    if (generation > 0) changed.value = true
  }

  const reloadOnClick = async () => {
    if (signalTimer !== undefined || rerun || probeInFlight !== undefined) probeWanted = true
    // Only probes stop: a baseline still being fetched is needed when the reload fails.
    if (probeInFlight) {
      probeInFlight.abort()
      if (controller === probeInFlight) controller = undefined
      probeInFlight = undefined
    }
    rerun = false
    clearTimeout(intervalTimer)
    clearTimeout(signalTimer)
    intervalTimer = undefined
    signalTimer = undefined
    const loadsBefore = generation
    applyingFrom = signals
    // The start of an earlier load that reported nothing says nothing about this one.
    if (!toValue(options.loading)) loadingFrom = undefined
    try {
      await options.reload()
    } finally {
      applyingFrom = undefined
      // A fetched list reported itself through `markLoaded`, which started the counting anew. Without one nothing
      // was shown: the pill keeps what it offered and the looking goes on.
      if (generation === loadsBefore) {
        scheduleInterval()
        runWantedProbe()
      }
    }
  }

  /**
   * The click on the pill: reloads the list and starts counting again from it. A click while the reload runs
   * waits for the same reload.
   */
  const apply = () => {
    applying ??= reloadOnClick().finally(() => {
      applying = undefined
    })
    return applying
  }

  if (options.loading !== undefined) {
    watch(
      () => Boolean(toValue(options.loading)),
      (value, before) => {
        if (value && !before) loadingFrom = signals
      },
      // A list may start its first load before it creates the live listing.
      { flush: 'sync', immediate: true }
    )
  }

  watch(
    () => toValue(options.interval),
    () => {
      if (!disposed && baseline !== undefined) scheduleInterval()
    }
  )

  watch(visibility, (value) => {
    if (disposed || baseline === undefined) return
    if (value === 'visible' && !overflow.value && Date.now() - lastProbeAt > RETURN_PROBE_GAP_MS) {
      void runProbe()
    }
    scheduleInterval()
  })

  onScopeDispose(() => {
    disposed = true
    abortProbe()
    clearTimers()
  })

  return {
    count: readonly(count),
    overflow,
    label,
    failed: readonly(failed),
    /** Records already listed changed; see `markChanged`. */
    changed: readonly(changed),
    /** The newest record the user has seen: `null` for an empty list, `undefined` before the first load. */
    baseline: readonly(baselineState),
    max,
    markLoaded,
    requestProbe,
    markChanged,
    apply,
  }
}
