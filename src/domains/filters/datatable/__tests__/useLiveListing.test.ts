/* eslint-disable vue/no-ref-object-reactivity-loss -- tests read the state of the composable imperatively */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useLiveListing, type UseLiveListingOptions } from '@/domains/filters/datatable/composables/useLiveListing'

type Row = { id: number }

const rows = (...ids: number[]): Row[] => ids.map((id) => ({ id }))

let scope: ReturnType<typeof effectScope> | undefined

const setup = (records: { value: Row[] }, options: Partial<UseLiveListingOptions<Row>> = {}) => {
  const probe = vi.fn(async ({ limit }: { limit: number; signal: AbortSignal }) =>
    [...records.value].sort((a, b) => b.id - a.id).slice(0, limit)
  )
  const reload = vi.fn(async () => {})
  scope = effectScope()
  const live = scope.run(() =>
    useLiveListing<Row>({
      probe,
      key: (row) => row.id,
      reload,
      interval: { visibleMs: 10_000, hiddenMs: 60_000 },
      ...options,
    })
  )!
  return { live, probe, reload }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  scope?.stop()
  scope = undefined
  vi.useRealTimers()
})

describe('useLiveListing', () => {
  it('probes nothing until a load gives it a baseline', async () => {
    const { probe } = setup(ref(rows(1, 2)))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(probe).not.toHaveBeenCalled()
  })

  it('counts the records newer than the newest one loaded', async () => {
    const records = ref(rows(3, 2, 1))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(5, 4, 3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }))
    expect(live.count.value).toBe(2)
    expect(live.label.value).toBe('2')
  })

  it('shows max+ above max and stops probing until the click', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(...Array.from({ length: 15 }, (_, i) => i + 1))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(10)
    expect(live.overflow.value).toBe(true)
    expect(live.label.value).toBe('9+')
    await vi.advanceTimersByTimeAsync(60_000)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('reports a failed probe until the next one succeeds', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    probe.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.failed.value).toBe(true)
    records.value = rows(2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.failed.value).toBe(false)
    expect(live.count.value).toBe(1)
  })

  it('drops the answer of a probe started before the next full load', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    let resolve!: (value: Row[]) => void
    probe.mockImplementationOnce(() => new Promise<Row[]>((res) => (resolve = res)))
    await vi.advanceTimersByTimeAsync(10_000)
    live.markLoaded(rows(1), { newestFirst: true })
    resolve(rows(3, 2, 1))
    await vi.advanceTimersByTimeAsync(0)
    expect(live.count.value).toBe(0)
  })

  it('finds the baseline with one record when the list is not newest first', async () => {
    const records = ref(rows(1, 2, 3))
    const { live, probe } = setup(records)
    live.markLoaded(rows(1, 2), { newestFirst: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 1 }))
    expect(live.baseline.value).toBe(3)
    records.value = rows(1, 2, 3, 4)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('counts a record created while the list loaded, with the baseline asked for when the load started', async () => {
    const records = ref(rows(1, 2, 3))
    const { live, probe } = setup(records)
    const newest = rows(3)
    records.value = rows(1, 2, 3, 4)
    live.markLoaded(rows(1, 2), { newestFirst: false, newest })
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).not.toHaveBeenCalled()
    expect(live.baseline.value).toBe(3)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('keeps the baseline for the same filters and sets it anew for others', async () => {
    const filter = ref('a')
    const records = ref(rows(5))
    const { live } = setup(records, { scope: filter })
    live.markLoaded(rows(5), { newestFirst: true })
    // A later load of the same filters with older records does not lower it.
    live.markLoaded(rows(3), { newestFirst: true })
    records.value = rows(5, 4)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(0)
    filter.value = 'b'
    live.markLoaded(rows(3), { newestFirst: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(2)
  })

  it('reloads the list on the click and counts on from what it loaded', async () => {
    const records = ref(rows(1))
    const reload = vi.fn(async () => live.markLoaded(records.value, { newestFirst: true }))
    const { live } = setup(records, { reload })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(2)
    await live.apply()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(live.count.value).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(0)
  })

  it('keeps the count offered when the click right after a probe loads nothing', async () => {
    const records = ref(rows(1))
    const { live } = setup(records, { reload: vi.fn(async () => {}) })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    await live.apply()
    expect(live.count.value).toBe(2)
    expect(live.baseline.value).toBe(1)
  })

  it('reloads once for clicks while the reload runs and keeps a change signalled meanwhile', async () => {
    const records = ref(rows(2, 1))
    const reload = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      live.markLoaded(records.value, { newestFirst: true })
    })
    const { live } = setup(records, { reload })
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    const first = live.apply()
    await vi.advanceTimersByTimeAsync(1000)
    const second = live.apply()
    live.markChanged()
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.all([first, second])
    expect(reload).toHaveBeenCalledTimes(1)
    expect(live.changed.value).toBe(true)
  })

  it('goes on fetching the baseline when the click comes while it runs and the reload fails', async () => {
    const records = ref(rows(3, 2, 1))
    const { live, probe } = setup(records, { interval: false, reload: vi.fn(async () => {}) })
    probe.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(rows(3)), 2000)))
    live.markLoaded(rows(1, 2, 3), { newestFirst: false })
    live.markChanged()
    await live.apply()
    await vi.advanceTimersByTimeAsync(2000)
    expect(live.baseline.value).toBe(3)
    records.value = rows(4, 3, 2, 1)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('turns a burst of signals into one probe, at most one per minimal interval', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records, { interval: false, debounceMs: 1500, minIntervalMs: 10_000 })
    live.markLoaded(records.value, { newestFirst: true })
    live.requestProbe()
    live.requestProbe()
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(1500)
    expect(probe).toHaveBeenCalledTimes(1)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(5000)
    expect(probe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('probes on the interval only while it is set', async () => {
    const records = ref(rows(1))
    const interval = ref<{ visibleMs: number; hiddenMs: number } | false>(false)
    const { live, probe } = setup(records, { interval })
    live.markLoaded(records.value, { newestFirst: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(probe).not.toHaveBeenCalled()
    interval.value = { visibleMs: 10_000, hiddenMs: 60_000 }
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(1)
    interval.value = false
    await vi.advanceTimersByTimeAsync(30_000)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('counts unseen records that enter below the newest one, with unseen newness', async () => {
    const records = ref(rows(5, 3, 2))
    const { live } = setup(records, { newness: 'unseen' })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(5, 4, 3, 2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('counts no record that slid onto the first page when listed ones left the filter, with unseen newness', async () => {
    const records = ref(rows(20, 18, 16, 14, 12, 10, 8))
    const { live } = setup(records, { newness: 'unseen', probeLimit: 5, max: 4 })
    live.markLoaded(records.value.slice(0, 5), { newestFirst: true })
    // 18 and 16 leave the filter, 10 slides onto the first page; 15 enters below the newest one and is new.
    records.value = rows(20, 15, 14, 12, 10, 8)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('counts an unseen record older than every listed one when the whole filter was listed, with unseen newness', async () => {
    const records = ref(rows(5, 3, 2))
    const { live } = setup(records, { newness: 'unseen', probeLimit: 5, max: 4 })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(5, 3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('takes what the probe finds as seen when the list is not newest first, with unseen newness', async () => {
    const records = ref(rows(5, 3))
    const { live, probe } = setup(records, { newness: 'unseen' })
    live.markLoaded(records.value, { newestFirst: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }))
    records.value = rows(5, 4, 3)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('offers a full reload for changed records and forgets them after it', async () => {
    const records = ref(rows(2, 1))
    const reload = vi.fn(async () => live.markLoaded(records.value, { newestFirst: true }))
    const { live } = setup(records, { reload })
    live.markChanged()
    expect(live.changed.value).toBe(false)
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    expect(live.changed.value).toBe(true)
    records.value = rows(3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
    await live.apply()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(live.changed.value).toBe(false)
  })

  it('keeps a change signalled while a load not started by the click ran, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(false)
    const { live } = setup(records, { loading })
    live.markLoaded(records.value, { newestFirst: true })
    loading.value = true
    live.markChanged()
    loading.value = false
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(true)
  })

  it('forgets a change signalled before a load not started by the click, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(false)
    const { live } = setup(records, { loading })
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    loading.value = true
    loading.value = false
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(false)
  })

  it('keeps a change signalled while the first load ran, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(false)
    const { live } = setup(records, { loading })
    loading.value = true
    live.markChanged()
    expect(live.changed.value).toBe(false)
    loading.value = false
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(true)
  })

  it('keeps a change signalled while a first load that started before the live listing ran, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(true)
    const { live } = setup(records, { loading })
    live.markChanged()
    loading.value = false
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(true)
  })

  it('forgets a change signalled before the first load, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(false)
    const { live } = setup(records, { loading })
    live.markChanged()
    loading.value = true
    loading.value = false
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(false)
  })

  it('keeps a change signalled after the load ended but before it was reported, with loading given', async () => {
    const records = ref(rows(2, 1))
    const loading = ref(false)
    const { live } = setup(records, { loading })
    live.markLoaded(records.value, { newestFirst: true })
    loading.value = true
    loading.value = false
    live.markChanged()
    live.markLoaded(records.value, { newestFirst: true })
    expect(live.changed.value).toBe(true)
  })

  it('keeps the changes offered and goes on probing when the reload after the click fails', async () => {
    const records = ref(rows(2, 1))
    const { live, probe } = setup(records, { reload: vi.fn(async () => {}) })
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    await live.apply()
    expect(live.changed.value).toBe(true)
    records.value = rows(3, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(live.count.value).toBe(1)
  })

  it('goes on probing when the reload after the click throws', async () => {
    const records = ref(rows(2, 1))
    const { live, probe } = setup(records, { reload: vi.fn(async () => Promise.reject(new Error('offline'))) })
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    await expect(live.apply()).rejects.toThrow('offline')
    expect(live.changed.value).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('fetches the baseline again after it failed, so the list does not stop', async () => {
    const records = ref(rows(5, 3))
    const { live, probe } = setup(records, { interval: false })
    probe.mockRejectedValueOnce(new Error('offline'))
    live.markLoaded(records.value, { newestFirst: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(live.failed.value).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(2)
    expect(live.failed.value).toBe(false)
    records.value = rows(6, 5, 3)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
  })

  it('tries a failed probe again without an interval, less and less often', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records, { interval: false })
    live.markLoaded(records.value, { newestFirst: true })
    probe.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'))
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(1500)
    expect(probe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(2)
    records.value = rows(2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(3)
    expect(live.failed.value).toBe(false)
    expect(live.count.value).toBe(1)
  })

  it('probes after a full load for a signal that came while the list was loading', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records, { interval: false })
    live.markLoaded(records.value, { newestFirst: true })
    live.requestProbe()
    records.value = rows(2, 1)
    live.markLoaded(rows(1), { newestFirst: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(live.count.value).toBe(1)
  })

  it('probes after a full load for a probe that was still running while the list was loading', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records, { interval: false })
    live.markLoaded(records.value, { newestFirst: true })
    probe.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(rows(1)), 5000)))
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(2000)
    records.value = rows(2, 1)
    live.markLoaded(rows(1), { newestFirst: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(2)
    expect(live.count.value).toBe(1)
  })

  it('probes after the click for a signal whose probe counted while the list was reloading', async () => {
    const records = ref(rows(2, 1))
    const reload = vi.fn(async () => {
      const loaded = rows(3, 2, 1)
      await new Promise((resolve) => setTimeout(resolve, 12_000))
      live.markLoaded(loaded, { newestFirst: true })
    })
    const { live, probe } = setup(records, { interval: false, reload })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(3, 2, 1)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(2000)
    expect(live.count.value).toBe(1)
    const applied = live.apply()
    await vi.advanceTimersByTimeAsync(1000)
    records.value = rows(4, 3, 2, 1)
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(11_000)
    await applied
    expect(live.count.value).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(3)
    expect(live.count.value).toBe(1)
  })

  it('keeps a change signalled while the click reloaded the list', async () => {
    const records = ref(rows(2, 1))
    const reload = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      live.markLoaded(records.value, { newestFirst: true })
    })
    const { live } = setup(records, { reload })
    live.markLoaded(records.value, { newestFirst: true })
    live.markChanged()
    const applied = live.apply()
    await vi.advanceTimersByTimeAsync(1000)
    live.markChanged()
    await vi.advanceTimersByTimeAsync(2000)
    await applied
    expect(live.changed.value).toBe(true)
  })

  it('counts no row shown while the baseline of the same filters is not known again', async () => {
    const records = ref(rows(3))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(5, 4, 3)
    probe.mockRejectedValueOnce(new Error('offline'))
    live.markLoaded(rows(4, 5), { newestFirst: false })
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(5000)
    expect(live.count.value).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.baseline.value).toBe(5)
    expect(live.count.value).toBe(0)
    records.value = rows(6, 5, 4, 3)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(live.count.value).toBe(1)
  })

  it('keeps a signal that came before the first load until the list is known', async () => {
    const records = ref(rows(2, 1))
    const { live, probe } = setup(records, { interval: false })
    live.requestProbe()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).not.toHaveBeenCalled()
    live.markLoaded(rows(1), { newestFirst: true })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(live.count.value).toBe(1)
  })

  it('keeps the baseline of a full load made by the click, not the older probe', async () => {
    const records = ref(rows(2, 1))
    const reload = vi.fn(async () => live.markLoaded(rows(2, 1), { newestFirst: true }))
    const { live } = setup(records, { reload })
    live.markLoaded(records.value, { newestFirst: true })
    records.value = rows(5, 2, 1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(live.count.value).toBe(1)
    await live.apply()
    expect(live.baseline.value).toBe(2)
  })

  it('asks for the given probe limit with unseen newness', async () => {
    const records = ref(rows(30, 20, 10))
    const { live, probe } = setup(records, { newness: 'unseen', probeLimit: 50 })
    live.markLoaded(records.value, { newestFirst: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
  })

  it('stops probing when its scope ends', async () => {
    const records = ref(rows(1))
    const { live, probe } = setup(records)
    live.markLoaded(records.value, { newestFirst: true })
    scope?.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(probe).not.toHaveBeenCalled()
  })
})
