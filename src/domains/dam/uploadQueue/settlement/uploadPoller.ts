import {
  delayAfterRead,
  firstDelay,
  UPLOAD_POLL_ERROR_LADDER_MS,
  UPLOAD_POLL_MIN_GAP_MS,
  type UploadPollMode,
} from '@/domains/dam/uploadQueue/settlement/uploadPollSchedule'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

export interface QueuePollerDeps {
  /** The age of the youngest tracked row of the queue in ms, or `null` when the queue tracks nothing. */
  youngestAgeMs(): number | null
  mode(): UploadPollMode
  /** One read of all the tracked rows of the queue. A rejection is a failed read. */
  read(trigger: 'tick' | 'visible'): Promise<void>
}

export interface QueuePoller {
  /** A row started being tracked. The next read happens no later than its first mark. */
  rowAdded(): void
  /** The tab is visible again. Read immediately. */
  readNow(trigger: 'visible'): void
  /** Re-arms the timer after the tab is hidden, the mode changes or the queue stops tracking rows. */
  reschedule(): void
  stop(): void
}

/** Tick timer of one queue. What a tick reads is decided by `deps.read`. */
export function createQueuePoller(deps: QueuePollerDeps): QueuePoller {
  let nextAt: number | null = null
  let timer: { handle: unknown } | null = null
  let inFlight = false
  // An earlier read requested while another read is in flight.
  let earlierAt: number | null = null
  let followUp = false
  let lastReadEndedAt: number | null = null
  let consecutiveFailures = 0
  let stopped = false

  const scheduler = () => uploadSettlementRuntime.scheduler
  const sooner = (planned: number | null, candidate: number) =>
    planned === null ? candidate : Math.min(planned, candidate)

  const disarm = () => {
    if (!timer) return
    scheduler().clearTimeout(timer.handle)
    timer = null
  }

  // The queue tracks nothing. Drop the plan for removed rows so a later failure restarts the error ladder.
  const goIdle = () => {
    disarm()
    nextAt = null
    earlierAt = null
    followUp = false
    consecutiveFailures = 0
  }

  const arm = () => {
    disarm()
    if (stopped || inFlight || nextAt === null) return
    // A hidden tab does not read. The planned time is kept for when the tab returns.
    if (!uploadSettlementRuntime.visibility.isVisible()) return
    timer = { handle: scheduler().setTimeout(onTimer, Math.max(0, nextAt - scheduler().now())) }
  }

  const onTimer = () => {
    timer = null
    if (stopped) return
    if (deps.youngestAgeMs() === null) {
      goIdle()
      return
    }
    if (!uploadSettlementRuntime.visibility.isVisible()) return
    void runRead('tick')
  }

  const runRead = async (trigger: 'tick' | 'visible') => {
    if (inFlight) {
      followUp = true
      return
    }
    disarm()
    nextAt = null
    inFlight = true
    let failed = false
    try {
      await deps.read(trigger)
    } catch {
      failed = true
    }
    inFlight = false
    if (stopped) return
    const now = scheduler().now()
    lastReadEndedAt = now
    consecutiveFailures = failed ? consecutiveFailures + 1 : 0
    const age = deps.youngestAgeMs()
    if (age === null) {
      goIdle()
      return
    }
    const computed = failed
      ? now + UPLOAD_POLL_ERROR_LADDER_MS[Math.min(consecutiveFailures, UPLOAD_POLL_ERROR_LADDER_MS.length) - 1]!
      : now + delayAfterRead(age, deps.mode())
    const soonest = now + UPLOAD_POLL_MIN_GAP_MS
    nextAt = followUp ? soonest : Math.max(soonest, sooner(earlierAt, computed))
    earlierAt = null
    followUp = false
    arm()
  }

  const rowAdded = () => {
    if (stopped) return
    const candidate = scheduler().now() + firstDelay(deps.mode())
    // A new row can only move the read earlier.
    if (inFlight) {
      earlierAt = sooner(earlierAt, candidate)
      return
    }
    nextAt = sooner(nextAt, candidate)
    arm()
  }

  const readNow = (trigger: 'visible') => {
    if (stopped) return
    if (inFlight) {
      followUp = true
      return
    }
    if (deps.youngestAgeMs() === null) {
      goIdle()
      return
    }
    const now = scheduler().now()
    if (lastReadEndedAt !== null && now - lastReadEndedAt < UPLOAD_POLL_MIN_GAP_MS) {
      nextAt = sooner(nextAt, lastReadEndedAt + UPLOAD_POLL_MIN_GAP_MS)
      arm()
      return
    }
    void runRead(trigger)
  }

  const reschedule = () => {
    // An in-flight read schedules the next one itself, using the mode current at that time.
    if (stopped || inFlight) return
    // Checked before the hidden-tab check. A queue that empties while hidden must not keep a plan for the return.
    const age = deps.youngestAgeMs()
    if (age === null) {
      goIdle()
      return
    }
    if (!uploadSettlementRuntime.visibility.isVisible()) {
      disarm()
      return
    }
    // An error-ladder wait is kept. The mode rhythm would schedule relative to the failed read.
    if (consecutiveFailures === 0) {
      const now = scheduler().now()
      const mode = deps.mode()
      const sinceRead = lastReadEndedAt === null ? null : now - lastReadEndedAt
      // The time the current mode would plan: from the last read, or from the first mark of a row added after it.
      // Never later than the time already planned.
      const candidate =
        sinceRead === null || age < sinceRead
          ? now - age + firstDelay(mode)
          : now - sinceRead + Math.max(UPLOAD_POLL_MIN_GAP_MS, delayAfterRead(age - sinceRead, mode))
      nextAt = sooner(nextAt, Math.max(now, candidate))
    }
    arm()
  }

  const stop = () => {
    stopped = true
    goIdle()
  }

  return { rowAdded, readNow, reschedule, stop }
}
