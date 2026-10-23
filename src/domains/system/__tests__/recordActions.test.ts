import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AxiosError } from 'axios'
import { defineRecordLoader } from '@/domains/system/composables/recordActions'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

const alerts = async () => {
  const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
  return vi.mocked(pushAlert)
}

const axiosError = (status: number) =>
  new AnzuApiAxiosError({ isAxiosError: true, response: { status } } as unknown as AxiosError)

beforeEach(async () => (await alerts()).mockClear())

describe('defineRecordLoader', () => {
  it('raises the flag while it loads, passes the id and the signal, and answers true', async () => {
    const loading = ref(false)
    const seen: Array<[number, AbortSignal | undefined, boolean]> = []
    const fetchData = defineRecordLoader(loading, async (id: number, signal) => {
      seen.push([id, signal, loading.value])
    })
    const controller = new AbortController()

    expect(await fetchData(7, { signal: controller.signal })).toBe(true)
    expect(seen).toEqual([[7, controller.signal, true]])
    expect(loading).toHaveProperty('value', false)
    expect(await alerts()).not.toHaveBeenCalled()
  })

  it('answers true for a bare return inside the load, unlike a hand-written loader', async () => {
    const fetchData = defineRecordLoader(ref(false), async () => {
      return
    })
    expect(await fetchData(1)).toBe(true)
  })

  it('shows why the record failed and answers false: the page leaves', async () => {
    const loading = ref(false)
    const fetchData = defineRecordLoader(loading, async () => {
      throw axiosError(404)
    })

    expect(await fetchData(1)).toBe(false)
    expect(await alerts()).toHaveBeenCalledTimes(1)
    expect(loading).toHaveProperty('value', false)
  })

  it('answers undefined and shows nothing for a stopped request: the page stays', async () => {
    const fetchData = defineRecordLoader(ref(false), async () => {
      throw new AnzuApiCancelledError()
    })

    expect(await fetchData(1)).toBeUndefined()
    expect(await alerts()).not.toHaveBeenCalled()
  })

  it('leaves the flag to the next page when the load was aborted', async () => {
    const loading = ref(false)
    const controller = new AbortController()
    const fetchData = defineRecordLoader(loading, async () => {
      controller.abort()
      throw new AnzuApiCancelledError()
    })

    await fetchData(1, { signal: controller.signal })
    expect(loading).toHaveProperty('value', true)
  })
})
