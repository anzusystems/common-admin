import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadMeter } from '@/domains/dam/uploadQueue/composables/uploadMeter'

// The one meter of an upload, for both sides (Z28): the bytes of the file sent over time, from the request of its
// first chunk to the answer to its last. Its speed is the bytes of the last ten seconds, reported once a second
// while bytes come or the answer to a chunk that is whole on its way is awaited.
// The clock and the second of the meter are faked; each case says when what happens, in ms from the start.

let reports: Array<{ percent: number; speed: number; remaining: number }>
const report = (percent: number, speed: number, remaining: number) => reports.push({ percent, speed, remaining })

beforeEach(() => {
  reports = []
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** A meter of a file of the given number of bytes, started. */
const started = (size: number) => {
  const meter = useUploadMeter(report)
  meter.start(size)
  return meter
}
const passes = (ms: number) => vi.advanceTimersByTime(ms)

describe('the meter of an upload', () => {
  // F1: the first report of a try used to be only where the measuring began.
  it('counts the first report of a chunk from its request, and only the share of the chunk in it', () => {
    const meter = started(2_000)
    expect(reports).toEqual([])
    // Its second is the only wait it asks for.
    expect(vi.getTimerCount()).toBe(1)

    const progress = meter.attempt(1_000)
    passes(500)
    // Half of the body of the request, whose parts and their headers make it 40 bytes more than the chunk.
    progress({ loaded: 520, total: 1_040 })
    passes(500)

    expect(reports).toEqual([{ percent: 25, speed: 500, remaining: 3 }])
    expect(vi.getTimerCount()).toBe(1)
  })

  // R1: a chunk the browser takes at once gives a single report, where it is whole.
  it('has a speed from a chunk that tells of itself once', () => {
    const meter = started(4_000)
    const progress = meter.attempt(1_000)
    passes(50)
    progress({ loaded: 1_000, total: 1_000 })
    passes(50)
    meter.chunkDone(1_000)
    meter.attempt(1_000)
    passes(900)

    expect(reports).toEqual([{ percent: 25, speed: 1_000, remaining: 3 }])
  })

  // Under a clock that stands between two things, as in a test with its time faked, they share a millisecond.
  it('counts what a chunk tells of itself in the millisecond of its request', () => {
    const meter = started(2_000)
    const progress = meter.attempt(1_000)
    progress({ loaded: 1_000, total: 1_000 })
    passes(1_000)

    expect(reports).toEqual([{ percent: 50, speed: 1_000, remaining: 1 }])
  })

  it('counts everything told in the millisecond of the last answer', () => {
    const meter = started(2_000)
    const first = meter.attempt(1_000)
    passes(1_000)
    first({ loaded: 1_000, total: 1_000 })
    meter.chunkDone(1_000)
    const second = meter.attempt(1_000)
    passes(900)
    second({ loaded: 500, total: 1_000 })
    second({ loaded: 1_000, total: 1_000 })
    meter.chunkDone(1_000)
    meter.lastChunkSent()
    passes(100)

    // 2 000 bytes in 1.9 s. Read at the first report of that millisecond, 1 500.
    expect(reports.at(-1)).toEqual({ percent: 100, speed: 1_053, remaining: 0 })
  })

  it('goes on across chunks, the wait for the answer of the server and the next request included', () => {
    const meter = started(4_000)
    const first = meter.attempt(1_000)
    passes(400)
    first({ loaded: 1_000, total: 1_000 })
    passes(400)
    meter.chunkDone(1_000)
    const second = meter.attempt(1_000)
    passes(500)
    second({ loaded: 500, total: 1_000 })
    passes(700)

    // 1 500 bytes in two seconds; the second chunk alone would be 500 bytes in 1.2 s.
    expect(reports.at(-1)).toEqual({ percent: 37.5, speed: 750, remaining: 4 })
  })

  it('starts afresh after a failed try, says nothing in the pause, and never shows a share below the last one', () => {
    const meter = started(10_000)
    const first = meter.attempt(10_000)
    passes(900)
    first({ loaded: 8_000, total: 10_000 })
    passes(100)
    expect(reports).toEqual([{ percent: 80, speed: 8_000, remaining: 1 }])

    meter.attemptFailed()
    passes(500)
    // A report of the failed try that comes late is not on the curve.
    first({ loaded: 9_000, total: 10_000 })
    passes(500)
    expect(reports).toHaveLength(1)

    const second = meter.attempt(10_000)
    passes(500)
    second({ loaded: 2_000, total: 10_000 })
    passes(500)

    // From the request of the retry; the share stays where it was.
    expect(reports.at(-1)).toEqual({ percent: 80, speed: 2_000, remaining: 4 })
  })

  it('measures over the last ten seconds, read between the reports at the edge', () => {
    const meter = started(100_000)
    const progress = meter.attempt(100_000)
    passes(2_000)
    progress({ loaded: 20_000, total: 100_000 })
    passes(2_000)
    progress({ loaded: 40_000, total: 100_000 })
    passes(11_000)
    progress({ loaded: 51_000, total: 100_000 })
    passes(1_000)

    // At 16 s the window starts at 6 s, where 42 000 bytes were sent (between 40 000 at 4 s and 51 000 at 15 s):
    // 9 000 bytes in ten seconds. From the start, 51 000 in sixteen.
    expect(reports.at(-1)).toEqual({ percent: 51, speed: 900, remaining: 55 })
  })

  it('slows down while less is sent', () => {
    const meter = started(100_000)
    const progress = meter.attempt(100_000)
    passes(4_000)
    progress({ loaded: 40_000, total: 100_000 })
    for (const loaded of [40_100, 40_200, 40_300]) {
      passes(1_000)
      progress({ loaded, total: 100_000 })
    }
    passes(1_000)

    expect(reports.map((each) => each.speed)).toEqual([8_000, 6_684, 5_743, 5_038])
  })

  // A speed that fell with every second of silence left hours on the row and made the next chunk small.
  it('reports nothing while a chunk stands on its way, and measures over the silence once bytes come again', () => {
    const meter = started(100_000)
    const progress = meter.attempt(100_000)
    passes(4_000)
    progress({ loaded: 40_000, total: 100_000 })
    passes(8_000)

    expect(reports).toEqual([{ percent: 40, speed: 8_000, remaining: 8 }])

    progress({ loaded: 50_000, total: 100_000 })
    passes(1_000)

    // At 13 s the window starts at 3 s, where 30 000 bytes were sent: 20 000 bytes in ten seconds.
    expect(reports.at(-1)).toEqual({ percent: 50, speed: 2_000, remaining: 25 })
  })

  // The next chunk is sized right after the answer: by the time the server took too, not by what the browser took.
  it('slows down while the answer to a chunk that is whole on its way is awaited', () => {
    const meter = started(4_000)
    const progress = meter.attempt(1_000)
    passes(500)
    progress({ loaded: 1_040, total: 1_040 })
    passes(2_500)

    expect(reports).toEqual([
      { percent: 25, speed: 1_000, remaining: 3 },
      { percent: 25, speed: 500, remaining: 6 },
      { percent: 25, speed: 334, remaining: 9 },
    ])
  })

  // A chunk of a size a backend may allow: the share of the body, counted by division, came out just short of it.
  it('takes a chunk for whole on its way once its body is out, whatever its size', () => {
    const meter = started(200_000_002)
    const progress = meter.attempt(100_000_001)
    passes(500)
    progress({ loaded: 100_000_501, total: 100_000_501 })
    passes(2_500)

    expect(reports.map((each) => each.percent)).toEqual([50, 50, 50])
  })

  // Reading the next chunk is no wait for the server.
  it('says nothing between the answer to a chunk and the request of the next', () => {
    const meter = started(4_000)
    const progress = meter.attempt(1_000)
    passes(500)
    progress({ loaded: 1_000, total: 1_000 })
    passes(1_000)
    meter.chunkDone(1_000)
    passes(3_000)

    expect(reports).toEqual([{ percent: 25, speed: 1_000, remaining: 3 }])
  })

  it('gives no speed from less than half a second without an answer of the server', () => {
    const meter = started(1_000)
    passes(800)
    const progress = meter.attempt(1_000)
    passes(100)
    progress({ loaded: 300, total: 1_000 })
    passes(100)
    expect(reports).toEqual([])

    passes(1_000)
    // 300 bytes in 1.2 s.
    expect(reports).toEqual([{ percent: 30, speed: 250, remaining: 3 }])
  })

  // Z9: a small file is out and answered within the first second.
  it('reports the whole file with the second that runs when the last chunk is answered, and asks for no other', () => {
    const meter = started(1_000)
    passes(800)
    const progress = meter.attempt(1_000)
    passes(50)
    progress({ loaded: 1_000, total: 1_000 })
    passes(50)
    meter.chunkDone(1_000)
    meter.lastChunkSent()
    passes(100)

    // A tenth of a second, with the answer in it.
    expect(reports).toEqual([{ percent: 100, speed: 10_000, remaining: 0 }])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports the whole file also when its last bytes were reported before the last answer', () => {
    const meter = started(1_000)
    const progress = meter.attempt(1_000)
    passes(100)
    progress({ loaded: 1_000, total: 1_000 })
    passes(900)
    expect(reports).toEqual([{ percent: 100, speed: 1_000, remaining: 0 }])

    passes(500)
    meter.chunkDone(1_000)
    meter.lastChunkSent()
    passes(500)

    // Up to the answer: a second and a half.
    expect(reports.at(-1)).toEqual({ percent: 100, speed: 667, remaining: 0 })
    expect(reports).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  // Z10
  it('asks for no second once it is stopped, and reports no more', () => {
    const meter = started(10_000)
    const progress = meter.attempt(10_000)
    passes(500)
    progress({ loaded: 1_000, total: 10_000 })
    passes(500)
    expect(reports).toHaveLength(1)

    meter.stop()
    progress({ loaded: 2_000, total: 10_000 })

    expect(vi.getTimerCount()).toBe(0)
    passes(5_000)
    expect(reports).toHaveLength(1)
  })

  it('starts the curve afresh when the clock goes back', () => {
    const meter = started(1_000)
    const progress = meter.attempt(1_000)
    passes(500)
    progress({ loaded: 500, total: 1_000 })
    passes(500)
    expect(reports).toEqual([{ percent: 50, speed: 500, remaining: 1 }])

    vi.setSystemTime(Date.now() - 60_000)
    passes(500)
    progress({ loaded: 700, total: 1_000 })
    passes(500)
    // One point of the new curve is no speed.
    expect(reports).toHaveLength(1)
    passes(500)
    progress({ loaded: 900, total: 1_000 })
    passes(500)

    // 200 bytes in 1.5 s, only since the clock went back.
    expect(reports.at(-1)).toEqual({ percent: 90, speed: 134, remaining: 1 })
  })

  it('reports nothing and asks for no second without a report', () => {
    const meter = useUploadMeter(undefined)
    meter.start(1_000)
    const progress = meter.attempt(1_000)
    passes(500)
    progress({ loaded: 1_000, total: 1_000 })
    meter.chunkDone(1_000)

    expect(vi.getTimerCount()).toBe(0)
  })
})
