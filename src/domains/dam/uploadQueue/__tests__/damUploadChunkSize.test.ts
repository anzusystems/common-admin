import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'

// The size of the next chunk of an upload, from the speed the upload is measured at: a chunk should take between
// a fifth and a half of the request timeout, and the DAM configuration bounds it. admin-dam uses this composable
// too. The size lives in the module: one upload hands it to the next, so the cases below run in order and the
// first of them is the only one that sees a module nothing has measured yet.

const MIN = 1_000
const MAX = 100_000

beforeEach(() => {
  setActivePinia(createPinia())
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: MIN, maxSize: MAX }
})

/** Whatever the uploads before left behind, the next one starts from the smallest chunk. */
const fromTheSmallest = (apiTimeout?: number) => {
  // A speed at which any chunk takes too long: the size falls to the lower bound.
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

  // With the default timeout of 30 s: between 6 s and 15 s a chunk.
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

    // 1000 bytes at 1000 bytes a second: one second.
    expect(updateChunkSize(1_000)).toBe(true)

    expect(lastChunkSize.value).toBe(7.5 * 1_000)
  })

  it('shrinks to half of the timeout at the measured speed when a chunk takes more than half of it', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest()
    updateChunkSize(1_000)

    // 7500 bytes at 100 bytes a second: 75 seconds.
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
    // Each upload goes its own way from there.
    second.updateChunkSize(100)
    expect([first.lastChunkSize.value, second.lastChunkSize.value]).toEqual([7_500, 1_500])
    expect(useDamUploadChunkSize().lastChunkSize.value).toBe(1_500)
  })

  it('follows the timeout it is given in place of the default', () => {
    const { lastChunkSize, updateChunkSize } = fromTheSmallest(60)

    // 1000 bytes at 100 bytes a second, 10 s: within 6-15 s by default, below a fifth of 60 s.
    expect(updateChunkSize(100)).toBe(true)
    expect(lastChunkSize.value).toBe(15 * 100)
    // 1500 bytes at 40 bytes a second, 37.5 s: above half of 60 s.
    expect(updateChunkSize(40)).toBe(true)
    expect(lastChunkSize.value).toBe(30 * 40)
  })
})
