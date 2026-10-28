import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'

// Chunk size is derived from the measured upload speed: a chunk should take between a fifth and a half
// of the request timeout, within the DAM configuration bounds. admin-dam uses this composable too.
// The size lives in the module and one upload hands it to the next. The
// cases run in order, and only the first sees an unmeasured module.

const MIN = 1_000
const MAX = 100_000

beforeEach(() => {
  setActivePinia(createPinia())
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: MIN, maxSize: MAX }
})

const fromTheSmallest = (apiTimeout?: number) => {
  useDamUploadChunkSize().updateChunkSize(0.001)
  return useDamUploadChunkSize(apiTimeout)
}

describe('the chunk size of an upload', () => {
  it('is the smallest the configuration allows until a speed was measured', () => {
    const { lastChunkSize, updateChunkSize } = useDamUploadChunkSize()

    expect(lastChunkSize.value).toBe(MIN)
    expect(updateChunkSize(null)).toBe(false)
    expect(lastChunkSize.value).toBe(MIN)
  })

  it('stays as it is while a chunk takes between a fifth and a half of the timeout', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest()

    expect([updateChunkSize(MIN / 7), updateChunkSize(MIN / 10), updateChunkSize(MIN / 14)]).toEqual([
      false,
      false,
      false,
    ])
    expect(lastChunkSize.value).toBe(MIN)
  })

  it('grows to a quarter of the timeout at the measured speed when a chunk takes less than a fifth of it', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest()

    expect(updateChunkSize(1_000)).toBe(true)

    expect(lastChunkSize.value).toBe(7.5 * 1_000)
  })

  it('shrinks to half of the timeout at the measured speed when a chunk takes more than half of it', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest()
    updateChunkSize(1_000)

    expect(updateChunkSize(100)).toBe(true)

    expect(lastChunkSize.value).toBe(15 * 100)
  })

  it('never leaves the bounds of the configuration', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest()

    expect(updateChunkSize(1_000_000)).toBe(true)
    expect(lastChunkSize.value).toBe(MAX)

    expect(updateChunkSize(1)).toBe(true)
    expect(lastChunkSize.value).toBe(MIN)
  })

  it('is handed from one upload to the next', () => {
    const first = fromTheSmallest()
    first.updateChunkSize(1_000)

    const second = useDamUploadChunkSize()

    expect(second.lastChunkSize.value).toBe(7_500)
    second.updateChunkSize(100)
    expect([first.lastChunkSize.value, second.lastChunkSize.value]).toEqual([7_500, 1_500])
    expect(useDamUploadChunkSize().lastChunkSize.value).toBe(1_500)
  })

  it('follows the timeout it is given in place of the default', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest(60)

    expect(updateChunkSize(100)).toBe(true)
    expect(lastChunkSize.value).toBe(15 * 100)
    expect(updateChunkSize(40)).toBe(true)
    expect(lastChunkSize.value).toBe(30 * 40)
  })
})
