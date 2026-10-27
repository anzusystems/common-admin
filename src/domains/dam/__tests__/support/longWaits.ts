// Fake timers stall the browser runner, so only the long waits of the upload leave
// real time: the poll for the file state and the row's wait before it offers refresh.
// They are held until the test lets them pass. `lengths` exposes how long each was asked for, for
// waits whose length a test pins, such as the speed meter's second. The poll rhythm is not pinned.

/**
 * The shortest wait that counts as long. Shorter waits are sat through,
 * such as the two seconds a metadata notification waits for its read.
 * Every poll wait is longer: the first read comes at five seconds, and the
 * next is planned from the row's age minus the real time the test has used.
 */
export const LONG_WAIT_FROM_MS = 2_500

export interface LongWaitsOptions {
  /**
   * Waits from this length up to the long ones also pass at once, and their length
   * is recorded. Used for the pauses between chunk tries, whose lengths are pinned.
   */
  passFrom?: number
}

export function holdLongWaits(from = LONG_WAIT_FROM_MS, options: LongWaitsOptions = {}) {
  const realSetTimeout = window.setTimeout
  const realClearTimeout = window.clearTimeout
  const held = new Map<number, { run: () => void; length: number }>()
  const passed: number[] = []
  let lastId = 1_000_000

  window.setTimeout = ((run: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
    const length = ms ?? 0
    if (length >= from) {
      held.set(++lastId, { run: () => run(...rest), length })
      return lastId
    }
    if (length >= (options.passFrom ?? from)) {
      passed.push(length)
      return realSetTimeout(run, 1, ...rest)
    }
    return realSetTimeout(run, ms, ...rest)
  }) as typeof window.setTimeout
  window.clearTimeout = ((id?: number) => {
    if (id === undefined || !held.delete(id)) realClearTimeout(id)
  }) as typeof window.clearTimeout

  /**
   * Real time, for the promises the code under test settles after an answer.
   */
  const settle = (ms = 50) => new Promise<void>((resolve) => realSetTimeout(resolve, ms))

  const elapse = async () => {
    const due = [...held.values()]
    held.clear()
    due.forEach((wait) => wait.run())
    await settle()
    return due.length > 0
  }

  return {
    passed,
    waiting: () => held.size,
    lengths: () => [...held.values()].map((wait) => wait.length),
    settle,
    elapse,
    elapseAll: async (rounds = 6) => {
      for (let round = 0; round < rounds; round++) {
        if (!(await elapse())) return
      }
    },
    restore: () => {
      held.clear()
      window.setTimeout = realSetTimeout
      window.clearTimeout = realClearTimeout
    },
  }
}

export type LongWaits = ReturnType<typeof holdLongWaits>
