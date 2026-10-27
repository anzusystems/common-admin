import type { UploadSettlementScheduler } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

// Fake timers stall the browser runner, so nothing global is replaced.
// The settlement asks this scheduler for the time and for timers, and the test moves the time.

interface ManualTimer {
  at: number
  order: number
  callback: () => void
}

/**
 * A turn of the event loop: every promise the code under test has chained by now is settled after it.
 */
const turn = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })

export function manualScheduler(startAt = 0) {
  let current = startAt
  let lastHandle = 0
  const timers = new Map<number, ManualTimer>()

  const nextDue = (until: number) => {
    let due: [number, ManualTimer] | null = null
    for (const entry of timers) {
      const timer = entry[1]
      if (timer.at > until) continue
      if (!due || timer.at < due[1].at || (timer.at === due[1].at && timer.order < due[1].order)) due = entry
    }
    return due
  }

  const scheduler: UploadSettlementScheduler = {
    now: () => current,
    setTimeout: (callback, ms) => {
      timers.set(++lastHandle, { at: current + Math.max(0, ms), order: lastHandle, callback })
      return lastHandle
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number)
    },
  }

  return {
    ...scheduler,
    waiting: () => timers.size,
    nextIn: () => {
      const due = nextDue(Infinity)
      return due ? due[1].at - current : null
    },
    settle: turn,
    /**
     * Moves the time on by `ms`. Due timers run in order, each at its own time.
     * What each has started is settled before the next one runs.
     */
    advance: async (ms: number) => {
      const until = current + ms
      await turn()
      for (let due = nextDue(until); due; due = nextDue(until)) {
        timers.delete(due[0])
        current = Math.max(current, due[1].at)
        due[1].callback()
        await turn()
      }
      current = until
    },
  }
}

export type ManualScheduler = ReturnType<typeof manualScheduler>
