export type UploadPollMode = 'dense' | 'sparse'

export interface UploadPollModeSchedule {
  /** The ages of the youngest row at which it is read. */
  marksMs: number[]
  /** After the last mark: up to the age `untilMs`, every `everyMs`. */
  tiers: Array<{ untilMs: number; everyMs: number }>
  tailEveryMs: number
}

const S = 1000
const MIN = 60 * S

// `dense`: the poll is the only channel. `sparse`: the notifications are alive, the poll is their backup.
export const UPLOAD_POLL_SCHEDULE: Record<UploadPollMode, UploadPollModeSchedule> = {
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

/** Between two automatic reads of one queue. */
export const UPLOAD_POLL_MIN_GAP_MS = 2 * S
/** The wait after the first, the second… failed read in a row; the last one for every further. */
export const UPLOAD_POLL_ERROR_LADDER_MS = [15, 30, 60, 120, 300].map((s) => s * S)
/** The age of a row at which it says its processing takes too long. */
export const UPLOAD_POLL_SLOW_TEXT_AFTER_MS = 20 * MIN
/** Reads in a row without the asset of a row, after which the row fails. */
export const UPLOAD_POLL_MISSING_LIMIT = 3
/** Failed reads in a row, after which the row warns. */
export const UPLOAD_POLL_READ_FAILURE_LIMIT = 3
/** Notifications about the file of one asset within this window are one read. */
export const UPLOAD_NOTIFY_FILE_DELAY_MS = 250
/** The backend can send the metadata notification before its transaction is committed. */
export const UPLOAD_NOTIFY_METADATA_DELAY_MS = 2 * S
export const UPLOAD_READ_BATCH_LIMIT = 50

export const firstDelay = (mode: UploadPollMode): number => UPLOAD_POLL_SCHEDULE[mode].marksMs[0]!

/** The wait for the next read when the youngest row is `ageMs` old. */
export function delayAfterRead(ageMs: number, mode: UploadPollMode): number {
  const schedule = UPLOAD_POLL_SCHEDULE[mode]
  const mark = schedule.marksMs.find((markMs) => markMs > ageMs)
  if (mark !== undefined) return mark - ageMs
  const tier = schedule.tiers.find((candidate) => candidate.untilMs > ageMs)
  return tier ? tier.everyMs : schedule.tailEveryMs
}
