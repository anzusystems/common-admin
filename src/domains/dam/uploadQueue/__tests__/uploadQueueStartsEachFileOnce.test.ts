import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'

// The queue starts every item it still sees waiting, and looks again after each file it adds.
// An upload must leave "waiting" before its first await (here
// the wait for rusha, which loads when the first file starts).
// Otherwise a multi-file selection starts the same file again and creates its asset twice.

const rushaGate = vi.hoisted(() => {
  let open!: () => void
  const promise = new Promise<void>((resolve) => (open = resolve))
  return { promise, open }
})

// rusha is CommonJS and pre-bundled for the browser run.
// The factory returns what its `module.exports` would be, and
// the import sees that as `default`, as with the real package.
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

vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: (...args: unknown[]) => damUploadStart(...(args as [unknown, unknown, { file: File }])),
  damUploadChunk: (...args: unknown[]) => damUploadChunk(...(args as [])),
  damUploadFinish: (...args: unknown[]) => damUploadFinish(...(args as [])),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
}))

vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({ addDamNotificationListener: () => undefined }),
}))

vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))

vi.mock('@/domains/dam/uploadQueue/utils/mimeTypeHelper', () => ({
  getAssetTypeByMimeType: () => DamAssetType.Image,
}))

vi.mock('@/domains/dam/uploadQueue/composables/damUploadChunkSize', () => ({
  useDamUploadChunkSize: () => ({ updateChunkSize: () => false, lastChunkSize: ref(1024) }),
}))

describe('upload queue while rusha loads', () => {
  it('starts each selected file once', async () => {
    setActivePinia(createPinia())
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1024, maxSize: 1024 }
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c'].map((name) => new File(['content'], `${name}.jpg`, { type: 'image/jpeg' }))

    await store.addByFiles('queue', 1, 1, files, 'default')
    rushaGate.open()

    // Two parallel slots, so the third file waits.
    // An item leaves "uploading" when `damUploadFinish` marks it processing, which this mock does not do.
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = damUploadStart.mock.calls.map(([, , item]) => item.file.name).sort()
    expect(started).toEqual(['a.jpg', 'b.jpg'])
    expect(damUploadFinish).toHaveBeenCalledTimes(2)
  })
})
