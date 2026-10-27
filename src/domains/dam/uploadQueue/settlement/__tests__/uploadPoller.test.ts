import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fakeVisibility } from '@/domains/dam/uploadQueue/settlement/__tests__/support/settlementFixtures'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { createQueuePoller, type QueuePoller } from '@/domains/dam/uploadQueue/settlement/uploadPoller'
import {
  delayAfterRead,
  firstDelay,
  UPLOAD_POLL_SCHEDULE,
  type UploadPollMode,
} from '@/domains/dam/uploadQueue/settlement/uploadPollSchedule'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

const S = 1000
const MIN = 60 * S

const realRuntime = { ...uploadSettlementRuntime }
let clock: ManualScheduler
let visibility: ReturnType<typeof fakeVisibility>
let poller: QueuePoller
let mode: UploadPollMode
let rows: number[]
let reads: Array<{ at: number; trigger: string }>
let onTheWay: Array<{ succeed: () => void; fail: () => void }>
let held: boolean
let failing: boolean

beforeEach(() => {
  clock = manualScheduler()
  visibility = fakeVisibility()
  uploadSettlementRuntime.scheduler = clock
  uploadSettlementRuntime.visibility = visibility
  mode = 'dense'
  rows = []
  reads = []
  onTheWay = []
  held = false
  failing = false
  poller = createQueuePoller({
    youngestAgeMs: () => (rows.length ? clock.now() - Math.max(...rows) : null),
    mode: () => mode,
    read: (trigger) => {
      reads.push({ at: clock.now(), trigger })
      if (!held) return failing ? Promise.reject(new Error('the read fails')) : Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        onTheWay.push({ succeed: resolve, fail: () => reject(new Error('the read fails')) })
      })
    },
  })
})

afterEach(() => {
  poller.stop()
  uploadSettlementRuntime.scheduler = realRuntime.scheduler
  uploadSettlementRuntime.visibility = realRuntime.visibility
})

const addRow = () => {
  rows.push(clock.now())
  poller.rowAdded()
}
const readAt = () => reads.map((read) => read.at / S)
const range = (from: number, to: number, step: number) => {
  const values: number[] = []
  for (let value = from; value <= to; value += step) values.push(value)
  return values
}

describe('the first read of a queue', () => {
  it('N-P1 comes 5 s after its first row when the poll is the only channel', async () => {
    addRow()
    await clock.advance(5 * S - 1)
    expect(reads).toHaveLength(0)
    await clock.advance(1)
    expect(reads).toEqual([{ at: 5 * S, trigger: 'tick' }])
  })

  it('N-P1 comes 10 s after its first row when the notifications are alive', async () => {
    mode = 'sparse'
    addRow()
    await clock.advance(10 * S - 1)
    expect(reads).toHaveLength(0)
    await clock.advance(1)
    expect(readAt()).toEqual([10])
  })
})

describe('the rhythm of the reads', () => {
  it('N-P2 rows that keep coming every 2 s do not put the read off: it comes every 5 s at the latest', async () => {
    for (let added = 0; added < 10; added++) {
      addRow()
      await clock.advance(2 * S)
    }

    // Rows at 0, 2, … 18 s. Each read is planned by the youngest row of its moment, never moved further by a new one.
    expect(readAt()).toEqual([5, 9, 13, 17])
  })

  it('N-P3 after the last row the reads come at 10, 16, 23, 31, 40, 50 and 60 s of its age', async () => {
    addRow()
    await clock.advance(3 * S)
    addRow()
    await clock.advance(60 * S)

    // The first row is read at its 5 s, the second, 3 s younger, at every mark of its own.
    expect(readAt()).toEqual([5, 8, 13, 19, 26, 34, 43, 53, 63])
  })

  it('N-P4 thins out: every 30 s to 5 min, every minute to 20 min, every 2 min to an hour, then every 10 min', async () => {
    addRow()
    await clock.advance(90 * MIN)

    expect(readAt()).toEqual([
      5,
      10,
      16,
      23,
      31,
      40,
      50,
      60,
      ...range(90, 300, 30),
      ...range(360, 1200, 60),
      ...range(1320, 3600, 120),
      4200,
      4800,
      5400,
    ])
  })

  it('N-P4 with the notifications alive: every minute to 5 min, every 3 min to 20, every 5 to an hour, then every 10', async () => {
    mode = 'sparse'
    addRow()
    await clock.advance(90 * MIN)

    expect(readAt()).toEqual([
      10,
      30,
      60,
      ...range(120, 300, 60),
      ...range(480, 1200, 180),
      ...range(1500, 3600, 300),
      4200,
      4800,
      5400,
    ])
  })

  it('N-P12 the wait after a read and the first wait follow the table', () => {
    expect(firstDelay('dense')).toBe(5 * S)
    expect(firstDelay('sparse')).toBe(10 * S)
    expect(UPLOAD_POLL_SCHEDULE.dense.marksMs).toEqual([5, 10, 16, 23, 31, 40, 50, 60].map((mark) => mark * S))
    expect(UPLOAD_POLL_SCHEDULE.sparse.marksMs).toEqual([10, 30, 60].map((mark) => mark * S))

    const dense: Array<[number, number]> = [
      [0, 5 * S],
      [4999, 1],
      [5 * S, 5 * S],
      [12 * S, 4 * S],
      [59 * S, 1 * S],
      [60 * S, 30 * S],
      [5 * MIN - 1, 30 * S],
      [5 * MIN, 1 * MIN],
      [20 * MIN - 1, 1 * MIN],
      [20 * MIN, 2 * MIN],
      [60 * MIN - 1, 2 * MIN],
      [60 * MIN, 10 * MIN],
      [5 * 60 * MIN, 10 * MIN],
    ]
    const sparse: Array<[number, number]> = [
      [0, 10 * S],
      [10 * S, 20 * S],
      [45 * S, 15 * S],
      [60 * S, 1 * MIN],
      [5 * MIN, 3 * MIN],
      [20 * MIN, 5 * MIN],
      [60 * MIN, 10 * MIN],
    ]
    dense.forEach(([age, wait]) => expect(delayAfterRead(age, 'dense'), `dense, age ${age}`).toBe(wait))
    sparse.forEach(([age, wait]) => expect(delayAfterRead(age, 'sparse'), `sparse, age ${age}`).toBe(wait))
  })
})

describe('a queue that tracks nothing any more', () => {
  it('N-P5 is not read when its timer is due, and holds no timer after', async () => {
    addRow()
    await clock.advance(3 * S)
    rows = []
    await clock.advance(10 * S)

    expect(reads).toHaveLength(0)
    expect(clock.waiting()).toBe(0)
  })

  it('N-P5 plans no further read after the one its last row was settled by', async () => {
    addRow()
    held = true
    await clock.advance(5 * S)
    rows = []
    onTheWay[0].succeed()
    await clock.advance(60 * S)

    expect(reads).toHaveLength(1)
    expect(clock.waiting()).toBe(0)
  })

  it('N-P5 gives its timer up at once when it is told so, and reads again for a new row', async () => {
    addRow()
    rows = []
    poller.reschedule()
    expect(clock.waiting()).toBe(0)

    await clock.advance(20 * S)
    addRow()
    await clock.advance(5 * S)

    expect(readAt()).toEqual([25])
  })

  it('holds no timer and plans nothing once it is stopped, whatever a read on its way answers', async () => {
    addRow()
    held = true
    await clock.advance(5 * S)
    poller.stop()
    onTheWay[0].succeed()
    addRow()
    await clock.advance(60 * S)

    expect(reads).toHaveLength(1)
    expect(clock.waiting()).toBe(0)
  })
})

describe('one read at a time', () => {
  it('N-P6 whatever asks for a read while one is on its way gets exactly one more, 2 s after it', async () => {
    addRow()
    held = true
    await clock.advance(5 * S)
    expect(reads).toHaveLength(1)

    poller.readNow('visible')
    poller.readNow('visible')
    await clock.advance(20 * S)
    expect(reads).toHaveLength(1)

    held = false
    onTheWay[0].succeed()
    await clock.advance(2 * S - 1)
    expect(reads).toHaveLength(1)
    await clock.advance(1)
    expect(readAt()).toEqual([5, 27])

    await clock.advance(4 * S)
    expect(readAt()).toEqual([5, 27, 31])
  })

  it('N-P7 a read at once does not make the rhythm faster, and two within 2 s are one read', async () => {
    addRow()
    await clock.advance(12 * S)
    expect(readAt()).toEqual([5, 10])

    poller.readNow('visible')
    await clock.settle()
    expect(readAt()).toEqual([5, 10, 12])

    await clock.advance(500)
    poller.readNow('visible')
    await clock.advance(500)
    poller.readNow('visible')
    await clock.advance(10 * S)

    // The two asked for within 2 s of the read at 12 are the one at 14; the marks of the age go on as they were.
    expect(readAt()).toEqual([5, 10, 12, 14, 16, 23])
  })
})

describe('a hidden tab', () => {
  it('N-P8 reads nothing, and on the return reads at once and goes on by the age', async () => {
    addRow()
    await clock.advance(3 * S)
    visibility.set(false)
    poller.reschedule()
    expect(clock.waiting()).toBe(0)

    await clock.advance(37 * S)
    expect(reads).toHaveLength(0)

    visibility.set(true)
    poller.readNow('visible')
    await clock.settle()
    expect(reads).toEqual([{ at: 40 * S, trigger: 'visible' }])

    await clock.advance(20 * S)
    expect(readAt()).toEqual([40, 50, 60])
  })

  it('N-P8 a row that comes while the tab is hidden is read on the return, not before', async () => {
    visibility.set(false)
    addRow()
    expect(clock.waiting()).toBe(0)
    await clock.advance(30 * S)
    expect(reads).toHaveLength(0)

    visibility.set(true)
    poller.readNow('visible')
    await clock.settle()

    expect(readAt()).toEqual([30])
  })
})

describe('reads that fail', () => {
  it('N-P9 are tried again after 15, 30, 60, 120, 300 and 300 s, and a read that succeeds starts the ladder anew', async () => {
    failing = true
    addRow()
    await clock.advance(830 * S)
    expect(readAt()).toEqual([5, 20, 50, 110, 230, 530, 830])

    // The next try is due at 1130, and succeeds. The row is that old by then: every minute from there.
    failing = false
    await clock.advance(300 * S)
    expect(readAt().slice(7)).toEqual([1130])

    failing = true
    await clock.advance(75 * S)
    expect(readAt().slice(7)).toEqual([1130, 1190, 1205])
  })

  it('N-P10 a new row during the wait after a failure brings the read closer', async () => {
    failing = true
    addRow()
    await clock.advance(50 * S)
    expect(readAt()).toEqual([5, 20, 50])

    await clock.advance(10 * S)
    addRow()
    await clock.advance(5 * S)

    expect(readAt()).toEqual([5, 20, 50, 65])
  })
})

describe('the notifications dying and coming alive', () => {
  it('N-P11 the dense rhythm brings the next read closer; the sparse one does not put a planned read off', async () => {
    mode = 'sparse'
    addRow()
    await clock.advance(12 * S)
    expect(readAt()).toEqual([10])
    // Planned for the mark of 30 s. Dense, it would have come at the mark of 16.
    mode = 'dense'
    poller.reschedule()
    await clock.advance(4 * S)
    expect(readAt()).toEqual([10, 16])

    // Planned for 23, the next dense mark; the sparse one would be 30.
    await clock.advance(1 * S)
    mode = 'sparse'
    poller.reschedule()
    await clock.advance(6 * S)
    expect(readAt()).toEqual([10, 16, 23])

    await clock.advance(30 * S)
    expect(readAt()).toEqual([10, 16, 23, 30])
  })

  it('N-P11 a first read not yet made is planned by the mode of now as well', async () => {
    mode = 'sparse'
    addRow()
    await clock.advance(2 * S)
    mode = 'dense'
    poller.reschedule()
    await clock.advance(3 * S)

    expect(readAt()).toEqual([5])
  })
})

describe('a row that comes while a read is on its way', () => {
  it('N-P13 keeps its first mark when the read ends: by a failure it is not pushed down the ladder', async () => {
    addRow()
    await clock.advance(60 * S)
    const before = reads.length

    held = true
    await clock.advance(30 * S)
    expect(reads).toHaveLength(before + 1)
    await clock.advance(1 * S)
    addRow()
    await clock.advance(2 * S)
    held = false
    onTheWay[0].fail()
    await clock.advance(3 * S - 1)
    expect(reads).toHaveLength(before + 1)
    await clock.advance(1)

    // 5 s after the new row came, not 15 s after the failure.
    expect(readAt().slice(before)).toEqual([90, 96])
  })

  it('N-P13 keeps its first mark when the read succeeds, and is never read sooner than 2 s after it', async () => {
    addRow()
    await clock.advance(60 * S)
    const before = reads.length

    held = true
    await clock.advance(30 * S)
    addRow()
    await clock.advance(4 * S)
    held = false
    onTheWay[0].succeed()
    await clock.advance(10 * S)

    // The new row came at 90 and would be due at 95; the read ended at 94, so 96 it is. Then its mark of 10 s.
    expect(readAt().slice(before)).toEqual([90, 96, 100])
  })
})

describe('a queue that empties while the tab is hidden', () => {
  const modes: Array<[UploadPollMode, number]> = [
    ['dense', 5],
    ['sparse', 10],
  ]

  it.each(modes)(
    'keeps no plan for the return (%s): a row that comes later is first read %i s after it',
    async (of, first) => {
      mode = of
      addRow()
      await clock.advance(2 * S)
      visibility.set(false)
      poller.reschedule()
      // Its only row is settled by a notification, which is read whether or not the tab is seen.
      await clock.advance(1 * S)
      rows = []
      poller.reschedule()

      // Seen again, and nothing asks for a read on the return: the plan is gone by what the queue was told alone.
      await clock.advance(57 * S)
      visibility.set(true)
      await clock.advance(40 * S)
      expect(reads).toHaveLength(0)

      addRow()
      expect(clock.nextIn()).toBe(first * S)
      await clock.advance(first * S)
      expect(readAt()).toEqual([100 + first])
    }
  )

  it.each(modes)('also when nobody told it the row was gone (%s): the return clears the plan', async (of, first) => {
    mode = of
    addRow()
    await clock.advance(2 * S)
    visibility.set(false)
    poller.reschedule()
    rows = []

    await clock.advance(58 * S)
    visibility.set(true)
    poller.readNow('visible')
    await clock.advance(40 * S)
    addRow()
    await clock.advance(first * S - 1)
    expect(reads).toHaveLength(0)
    await clock.advance(1)

    expect(readAt()).toEqual([100 + first])
  })
})

describe('the wait after a failed read', () => {
  it('is not cut short when the notifications die or come alive', async () => {
    mode = 'sparse'
    failing = true
    addRow()
    await clock.advance(55 * S)
    // Failed at 10, 25 and 55 s: the next try is due 60 s later, at 115.
    expect(readAt()).toEqual([10, 25, 55])

    await clock.advance(5 * S)
    mode = 'dense'
    poller.reschedule()
    await clock.advance(10 * S)
    mode = 'sparse'
    poller.reschedule()
    await clock.advance(45 * S - 1)
    expect(readAt()).toEqual([10, 25, 55])
    await clock.advance(1)

    expect(readAt()).toEqual([10, 25, 55, 115])
  })

  it('starts at the foot of the ladder again for a queue that tracked nothing in between', async () => {
    failing = true
    addRow()
    await clock.advance(20 * S)
    // Failed at 5 and 20 s: a third failure would wait 60 s.
    expect(readAt()).toEqual([5, 20])

    rows = []
    poller.reschedule()
    await clock.advance(10 * S)
    addRow()
    await clock.advance(5 * S + 15 * S)

    expect(readAt()).toEqual([5, 20, 35, 50])
  })
})
