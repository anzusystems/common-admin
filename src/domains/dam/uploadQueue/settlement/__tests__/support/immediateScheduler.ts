import {
  UPLOAD_NOTIFY_METADATA_DELAY_MS,
  UPLOAD_POLL_SCHEDULE,
} from '@/domains/dam/uploadQueue/settlement/uploadPollSchedule'
import type { UploadSettlementScheduler } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

/**
 * For the tests of a store that are not about time: a wait as long as a notification's (2 s at most) is over in
 * the next microtask, a longer one never. So an event is written at once, and no tick ever comes.
 */
export function immediateScheduler(): UploadSettlementScheduler {
  if (UPLOAD_POLL_SCHEDULE.dense.marksMs[0]! <= UPLOAD_NOTIFY_METADATA_DELAY_MS) {
    throw new Error('immediateScheduler: the first tick is no longer than the wait of a notification')
  }
  let lastHandle = 0
  const waiting = new Set<number>()

  return {
    now: () => Date.now(),
    setTimeout: (callback, ms) => {
      const handle = ++lastHandle
      if (ms > UPLOAD_NOTIFY_METADATA_DELAY_MS) return handle
      waiting.add(handle)
      queueMicrotask(() => {
        if (waiting.delete(handle)) callback()
      })
      return handle
    },
    clearTimeout: (handle) => {
      waiting.delete(handle as number)
    },
  }
}
