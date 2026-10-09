// Fake timers stall the browser runner, so only the long waits of the upload are taken out of real time: the poll
// for the state of a file, the row's wait before it offers refresh. They are held until the test lets them pass.
// How long a held wait was asked for can be read (`lengths`), for the waits whose length a test does pin: the
// second of the speed meter. The rhythm of the poll is not among them, and no test reads it.

/**
 * The shortest wait that counts as long. Below it are the waits a test can sit through: the two seconds a metadata
 * notification waits for its read among them. Above it is every wait of the poll, whose first read comes at five
 * seconds and whose next one is planned by the age of the row, less the real time the test has taken since.
 */
export const LONG_WAIT_FROM_MS = 2_500

export interface LongWaitsOptions {
  /**
   * Waits from this length up to the long ones are not sat through either: each is over at once, and its length
   * is recorded. For the pauses between the tries of a chunk, whose lengths are part of what is pinned.
   */
  passFrom?: number
}

export function holdLongWaits(from = LONG_WAIT_FROM_MS, options: LongWaitsOptions = {}) {
  const realSetTimeout = window.setTimeout
  const realClearTimeout = window.clearTimeout
  const held = new Map<number, { run: () => void; length: number }>()
  /** The lengths of the waits that were let pass at once, in order. */
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

  /** Real time, for what the code under test does after an answer: a handful of promises. */
  const settle = (ms = 50) => new Promise<void>((resolve) => realSetTimeout(resolve, ms))

  /** The long waits held by now are over. Answers `false` when none was waiting. */
  const elapse = async () => {
    const due = [...held.values()]
    held.clear()
    due.forEach((wait) => wait.run())
    await settle()
    return due.length > 0
  }

  return {
    passed,
    /** How many long waits are held. */
    waiting: () => held.size,
    /** What each of the waits held was asked to last, in the order they were asked for. */
    lengths: () => [...held.values()].map((wait) => wait.length),
    settle,
    elapse,
    /** Time goes on until no long wait is left, or for the given number of rounds: "and nothing more happens". */
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
