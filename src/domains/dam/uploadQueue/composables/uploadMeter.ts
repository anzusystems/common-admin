import type { AxiosProgressEvent } from 'axios'
import type { UploadProgressCallback } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { isNull } from '@/shared/utils/common'

const TICK_MS = 1_000
// Holds the answer to at least one chunk of the size the upload aims at (a quarter of the timeout, 7.5 s at 30 s),
// and follows a change of speed within it.
const WINDOW_MS = 10_000
// A shorter stretch without an answer of the server shows mostly what the browser took into its buffers: Chromium
// tells how far the body is at most every 100 ms, axios passes it on at most every 333 ms.
const MIN_SPAN_MS = 500

interface MeterPoint {
  at: number
  /** Bytes of the file sent by then: the chunks the server answered, and the share of the one on its way. */
  sent: number
  /** The server answered a chunk here. */
  answered: boolean
}

/**
 * How far one upload is, how fast it goes and how long it still takes, from one curve: the bytes of its file sent
 * over time, from the request of its first chunk to the answer to its last. It reports once a second, the first at
 * once, and only once it has a speed and either bytes came since its last report or the answer to a chunk that is
 * whole on its way is awaited; without `report` it reports nothing and asks for no second.
 */
export function useUploadMeter(report: UploadProgressCallback | undefined) {
  let points: MeterPoint[] = []
  let fileSize = 0
  // Bytes of the chunks the server answered.
  let received = 0
  // Bytes sent by the last point; after a failed try, what the server has.
  let sent = 0
  // The share last reported: it never goes back.
  let shown = 0
  // Bytes came since the last report. A chunk that stands on its way reports nothing: a speed falling with every
  // second of silence would make the time left hours and the next chunk, sized by the speed, small.
  let moved = false
  let sendingOver = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // The try whose progress counts, and where the curve is once its chunk is whole on its way. A report of a try that
  // has ended comes too late to be on the curve.
  let current: { end: number } | undefined

  const now = () => {
    const at = Date.now()
    // The clock went back: nothing measured before can be set against it.
    if (points.length && at < points.at(-1)!.at) points = []
    return at
  }
  const mark = (bytes: number, answered = false) => {
    const at = now()
    if (bytes > sent) moved = true
    sent = bytes
    points.push({ at, sent: bytes, answered })
    // One point stays before the window: its edge is read between two.
    while (points.length > 2 && points[1]!.at <= at - WINDOW_MS) points.shift()
  }
  // Where the curve was as the millisecond `at` began: of the points that share it, the first.
  const sentAt = (at: number) => {
    const next = points.findIndex((point) => point.at >= at)
    if (next === -1) return points.at(-1)!.sent
    if (next === 0) return points[0]!.sent
    const before = points[next - 1]!
    const after = points[next]!
    return before.sent + ((after.sent - before.sent) * (at - before.at)) / (after.at - before.at)
  }
  /** Bytes a second over the window up to now, or up to the last answer once the file is out. */
  const speed = () => {
    const end = sendingOver ? points.at(-1)?.at : now()
    if (points.length < 2 || end === undefined) return null
    const from = Math.max(points[0]!.at, end - WINDOW_MS)
    const span = end - from
    // No point is later than the end: the last one says where the curve is, also among several of one millisecond.
    const bytes = points.at(-1)!.sent - sentAt(from)
    const answered = points.some((point) => point.answered && point.at > from)
    return span > 0 && bytes > 0 && (span >= MIN_SPAN_MS || answered) ? (bytes * 1000) / span : null
  }

  // The wait for the answer to a chunk that is whole on its way is the server's time. The speed goes on counting it:
  // the next chunk is sized right after the answer, and not by what the browser took alone.
  const answerAwaited = () => !!current && sent >= current.end

  const tick = () => {
    const bytesPerSecond = speed()
    if (report && !isNull(bytesPerSecond) && (moved || answerAwaited() || sendingOver)) {
      moved = false
      shown = sendingOver ? 100 : Math.max(shown, Math.min((sent * 100) / fileSize, 100))
      report(shown, Math.ceil(bytesPerSecond), sendingOver ? 0 : Math.ceil((fileSize - sent) / bytesPerSecond))
    }
    if (!sendingOver) timer = setTimeout(tick, TICK_MS)
  }

  return {
    /** The reports of a file of the given size begin. */
    start(size: number) {
      fileSize = size
      if (report) tick()
    },
    /** Before each request of a chunk: the curve goes on from what the server has, and the try reports into it. */
    attempt(chunkSize: number) {
      const thisTry = { end: received + chunkSize }
      current = thisTry
      mark(received)
      return (event: Pick<AxiosProgressEvent, 'loaded' | 'total'>) => {
        if (current !== thisTry) return
        let onItsWay = event.loaded
        // `total` is the whole multipart body; what goes on the curve is its share of the chunk, and all of the chunk
        // once the body is out: of numbers past 2^53 the division makes a little less.
        if (event.total) onItsWay = event.loaded >= event.total ? chunkSize : (event.loaded * chunkSize) / event.total
        mark(received + Math.min(Math.max(onItsWay, 0), chunkSize))
      }
    },
    /** The server answered the chunk of the try. */
    chunkDone(chunkSize: number) {
      current = undefined
      received += chunkSize
      mark(received, true)
    },
    /**
     * A try failed: the server took none of its bytes, and neither its time nor the pause after it counts. Until the
     * next try has a speed nothing is reported, and the row keeps what it was told last.
     */
    attemptFailed() {
      current = undefined
      points = []
      sent = received
    },
    /** Z9: the second that runs reports the whole file, and no further one is asked for. */
    lastChunkSent() {
      sendingOver = true
    },
    /** Z10: no further report. */
    stop() {
      clearTimeout(timer)
      timer = undefined
      sendingOver = true
    },
  }
}
