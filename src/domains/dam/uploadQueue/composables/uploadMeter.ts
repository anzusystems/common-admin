import type { AxiosProgressEvent } from 'axios'
import type { UploadProgressCallback } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { isNull } from '@/shared/utils/common'

const TICK_MS = 1_000
// Covers the response to at least one target-size chunk (a quarter of
// the timeout, 7.5 s at 30 s), and still tracks speed changes within it.
const WINDOW_MS = 10_000
// A shorter span without a server response mostly measures browser buffering.
// Chromium reports body progress at most every 100 ms, and axios forwards it at most every 333 ms.
const MIN_SPAN_MS = 500

interface MeterPoint {
  at: number
  /** File bytes sent by then: the answered chunks plus the sent share of the chunk in flight. */
  sent: number
  /** The server answered a chunk at this point. */
  answered: boolean
}

/**
 * Progress, speed and remaining time of one upload, from one curve: file
 * bytes sent over time, from the first chunk request to the last answer.
 * Reports once a second, the first immediately. It reports only with a known speed and
 * when bytes moved since the last report or an answer to a fully sent chunk is awaited.
 * Once the file is out it reports the whole file, also without a
 * speed. Without `report` it reports nothing and starts no timer.
 */
export function useUploadMeter(report: UploadProgressCallback | undefined) {
  let points: MeterPoint[] = []
  let fileSize = 0
  let received = 0
  // Bytes sent at the last point. After a failed try, what the server has.
  let sent = 0
  // The share last reported. It never decreases.
  let shown = 0
  // Bytes moved since the last report. A stalled chunk reports nothing.
  // Otherwise the speed would fall each silent second, the time left would
  // grow to hours and the next chunk, sized by speed, would be small.
  let moved = false
  let sendingOver = false
  // The speed last reported. The whole file is reported at it when no speed
  // can be read, e.g. when the clock went back before the last chunk's answer.
  let reportedSpeed = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  // The try whose progress counts, and the curve position once its chunk is
  // fully sent. Progress from an ended try arrives too late for the curve.
  let current: { end: number } | undefined

  const now = () => {
    const at = Date.now()
    // The clock went back: earlier measurements cannot be compared with it.
    if (points.length && at < points.at(-1)!.at) points = []
    return at
  }
  const mark = (bytes: number, answered = false) => {
    const at = now()
    if (bytes > sent) moved = true
    sent = bytes
    points.push({ at, sent: bytes, answered })
    // Keep one point before the window, so its edge can be interpolated between two points.
    while (points.length > 2 && points[1]!.at <= at - WINDOW_MS) points.shift()
  }
  // The curve value at the start of millisecond `at`: of points sharing it, the first.
  const sentAt = (at: number) => {
    const next = points.findIndex((point) => point.at >= at)
    if (next === -1) return points.at(-1)!.sent
    if (next === 0) return points[0]!.sent
    const before = points[next - 1]!
    const after = points[next]!
    return before.sent + ((after.sent - before.sent) * (at - before.at)) / (after.at - before.at)
  }
  /** Bytes per second over the window up to now, or up to the last answer once the file is out. */
  const speed = () => {
    const end = sendingOver ? points.at(-1)?.at : now()
    if (points.length < 2 || end === undefined) return null
    const from = Math.max(points[0]!.at, end - WINDOW_MS)
    const span = end - from
    // No point is later than the end, so the last one is the
    // current curve value, also when several share one millisecond.
    const bytes = points.at(-1)!.sent - sentAt(from)
    const answered = points.some((point) => point.answered && point.at > from)
    return span > 0 && bytes > 0 && (span >= MIN_SPAN_MS || answered) ? (bytes * 1000) / span : null
  }

  // Waiting for the answer to a fully sent chunk is server time. The speed keeps counting
  // it, so the next chunk is sized after the answer and not by browser buffering alone.
  const answerAwaited = () => !!current && sent >= current.end

  const tick = () => {
    const bytesPerSecond = speed() ?? (sendingOver ? reportedSpeed : null)
    if (report && !isNull(bytesPerSecond) && (moved || answerAwaited() || sendingOver)) {
      moved = false
      shown = sendingOver ? 100 : Math.max(shown, Math.min((sent * 100) / fileSize, 100))
      reportedSpeed = Math.ceil(bytesPerSecond)
      report(shown, reportedSpeed, sendingOver ? 0 : Math.ceil((fileSize - sent) / bytesPerSecond))
    }
    if (!sendingOver) timer = setTimeout(tick, TICK_MS)
  }

  return {
    /** Starts reporting for a file of the given size. */
    start(size: number) {
      fileSize = size
      if (report) tick()
    },
    /** Call before each chunk request. The curve continues from what the server has, and the try reports into it. */
    attempt(chunkSize: number) {
      const thisTry = { end: received + chunkSize }
      current = thisTry
      mark(received)
      return (event: Pick<AxiosProgressEvent, 'loaded' | 'total'>) => {
        if (current !== thisTry) return
        let onItsWay = event.loaded
        // `total` is the whole multipart body. The curve gets its share of the chunk, and the whole
        // chunk once the body is out, since the division gives slightly less for numbers past 2^53.
        if (event.total) onItsWay = event.loaded >= event.total ? chunkSize : (event.loaded * chunkSize) / event.total
        mark(received + Math.min(Math.max(onItsWay, 0), chunkSize))
      }
    },
    /** The server answered the try's chunk. */
    chunkDone(chunkSize: number) {
      current = undefined
      received += chunkSize
      mark(received, true)
    },
    /**
     * A try failed. The server kept none of its bytes, and neither its time nor the pause after it counts.
     * Nothing is reported until the next try has a speed, so the row keeps its last values.
     */
    attemptFailed() {
      current = undefined
      points = []
      sent = received
    },
    /** The running second reports the whole file, and no further second is scheduled. */
    lastChunkSent() {
      sendingOver = true
    },
    stop() {
      clearTimeout(timer)
      timer = undefined
      sendingOver = true
    },
  }
}
