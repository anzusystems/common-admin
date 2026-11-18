import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'

// At a configuration bound, a speed out of range leaves the chunk size unchanged and not reported as changed.
// The upload re-reads the chunk of a retry from the file only when its size
// changed. The size lives in the module, as in `damUploadChunkSize.test.ts`.

const MIN = 1_000
const MAX = 100_000

beforeEach(() => {
  setActivePinia(createPinia())
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: MIN, maxSize: MAX }
})

describe('the chunk size of an upload at a bound of the configuration', () => {
  it('stays the smallest, and says it did not change, at a speed it would shrink at', () => {
    const { lastChunkSize, updateChunkSize } = useDamUploadChunkSize()
    updateChunkSize(1)
    expect(lastChunkSize.value).toBe(MIN)

    expect(updateChunkSize(1)).toBe(false)
    expect(lastChunkSize.value).toBe(MIN)
  })

  it('stays the largest, and says it did not change, at a speed it would grow at', () => {
    const { lastChunkSize, updateChunkSize } = useDamUploadChunkSize()
    expect(updateChunkSize(1_000_000)).toBe(true)
    expect(lastChunkSize.value).toBe(MAX)

    expect(updateChunkSize(1_000_000)).toBe(false)
    expect(lastChunkSize.value).toBe(MAX)
  })
})
