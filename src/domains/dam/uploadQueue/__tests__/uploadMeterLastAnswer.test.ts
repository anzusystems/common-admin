import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadMeter } from '@/domains/dam/uploadQueue/composables/uploadMeter'

// The last report of an upload, the whole file and no time left, also where no speed can be read by then: the clock
// went back before the answer to the last chunk, and the curve starts afresh from that one point. The clock and the
// second of the meter are faked, as in `uploadMeter.test.ts`.

let reports: Array<{ percent: number; speed: number; remaining: number }>
const report = (percent: number, speed: number, remaining: number) => reports.push({ percent, speed, remaining })

beforeEach(() => {
  reports = []
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const passes = (ms: number) => vi.advanceTimersByTime(ms)

describe('the meter of an upload whose clock goes back before the answer to its last chunk', () => {
  it('reports the whole file at the speed it reported last, and asks for no other second', () => {
    const meter = useUploadMeter(report)
    meter.start(2_000)
    const first = meter.attempt(1_000)
    passes(500)
    first({ loaded: 1_000, total: 1_000 })
    passes(500)
    expect(reports).toEqual([{ percent: 50, speed: 1_000, remaining: 1 }])
    meter.chunkDone(1_000)
    const last = meter.attempt(1_000)
    passes(500)
    last({ loaded: 1_000, total: 1_000 })
    passes(400)

    vi.setSystemTime(Date.now() - 60_000)
    meter.chunkDone(1_000)
    meter.lastChunkSent()
    passes(100)

    expect(reports.at(-1)).toEqual({ percent: 100, speed: 1_000, remaining: 0 })
    expect(vi.getTimerCount()).toBe(0)
  })
})
