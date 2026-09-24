import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'

// The queue starts every item it still sees waiting, and it looks again after each file it adds. An upload
// has to leave "waiting" before its first await -- here the wait for rusha, which loads when the first file
// starts -- or a multi-file selection starts the same file again and creates its asset twice.

const rushaGate = vi.hoisted(() => {
  let open!: () => void
  const promise = new Promise<void>((resolve) => (open = resolve))
  return { promise, open }
})

// rusha is CommonJS and pre-bundled for the browser run: the factory returns what its `module.exports`
// would be, and the import sees that as `default`, as it does the real package.
vi.mock('rusha', async () => {
  await rushaGate.promise
  return { createHash: () => ({ update: () => undefined, digest: () => 'sha-of-file' }) }
})

const damUploadStart = vi.fn(async (_client: unknown, _endPoint: unknown, item: { file: File }) => ({
  asset: `asset-${item.file.name}`,
  id: `file-${item.file.name}`,
}))
const damUploadChunk = vi.fn(async () => ({}))
const damUploadFinish = vi.fn(async () => ({}))

vi.mock('@/components/damImage/uploadQueue/api/uploadApi', () => ({
  damUploadStart: (...args: unknown[]) => damUploadStart(...(args as [unknown, unknown, { file: File }])),
  damUploadChunk: (...args: unknown[]) => damUploadChunk(...(args as [])),
  damUploadFinish: (...args: unknown[]) => damUploadFinish(...(args as [])),
}))

vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
}))

vi.mock('@/components/damImage/uploadQueue/composables/damNotifications', () => ({
  useDamNotifications: () => ({ addDamNotificationListener: () => undefined }),
}))

vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))

vi.mock('@/components/damImage/uploadQueue/composables/mimeTypeHelper', () => ({
  getAssetTypeByMimeType: () => DamAssetType.Image,
}))

vi.mock('@/components/damImage/uploadQueue/composables/damUploadChunkSize', () => ({
  useDamUploadChunkSize: () => ({ updateChunkSize: () => false, lastChunkSize: ref(1024) }),
}))

describe('upload queue while rusha loads', () => {
  it('starts each selected file once', async () => {
    setActivePinia(createPinia())
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c'].map((name) => new File(['content'], `${name}.jpg`, { type: 'image/jpeg' }))

    await store.addByFiles('queue', 1, 1, files)
    rushaGate.open()

    // Two parallel slots. The third file waits for one: an item leaves "uploading" when damUploadFinish marks it
    // processing, which this mock does not do.
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = damUploadStart.mock.calls.map(([, , item]) => item.file.name).sort()
    expect(started).toEqual(['a.jpg', 'b.jpg'])
    expect(damUploadFinish).toHaveBeenCalledTimes(2)
  })
})
