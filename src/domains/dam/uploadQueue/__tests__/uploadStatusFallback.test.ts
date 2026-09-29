import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { damUploadFinish } from '@/domains/dam/api/uploadApi'

const state = vi.hoisted(() => ({
  uploadStatusFallback: true,
  listener: undefined as undefined | ((event: unknown) => void),
}))

vi.mock('@/domains/dam/api/damImageApi', () => ({
  fetchImageFile: vi.fn(),
  imageUploadStart: vi.fn(),
  imageUploadChunk: vi.fn(),
  imageUploadFinish: vi.fn(async () => ({})),
  rotateImage: vi.fn(),
  copyToLicence: vi.fn(),
}))
// Every export spelled out: `importOriginal` here closes an import cycle and stalls the browser runner.
const fetchAsset = vi.fn()
const fetchAssetByFileId = vi.fn()
vi.mock('@/domains/dam/api/damAssetApi', () => ({
  ENTITY: 'asset',
  fetchAsset: (...a: unknown[]) => fetchAsset(...a),
  fetchAssetByFileId: (...a: unknown[]) => fetchAssetByFileId(...a),
  useFetchAssetList: vi.fn(),
  fetchAssetAsCmsMedia: vi.fn(),
  bulkUpdateAssetsMetadata: vi.fn(),
  fetchAssetListByIds: vi.fn(),
  updateAssetMetadata: vi.fn(),
  updateAssetAuthors: vi.fn(),
  bulkUpdateAssetsAuthors: vi.fn(),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: state.uploadStatusFallback }),
}))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (state.listener = callback),
  }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))

const asset = (id: string, status: string) => ({
  id,
  mainFile: { id: `file-of-${id}`, links: {}, fileAttributes: { status } },
  attributes: { assetStatus: 'with_file', assetType: DamAssetType.Image },
  keywords: [],
  authors: [],
  metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: null,
  mainFileInternal: null,
})

const rejections: unknown[] = []
const onRejection = (e: PromiseRejectionEvent) => {
  rejections.push(e.reason)
  e.preventDefault()
}
// The poll waits 10 s * try². Fake timers stall the browser runner, so only those long waits are
// shortened, and recorded.
const realSetTimeout = window.setTimeout
const polls: number[] = []
beforeEach(() => {
  rejections.length = 0
  polls.length = 0
  state.uploadStatusFallback = true
  setActivePinia(createPinia())
  window.addEventListener('unhandledrejection', onRejection)
  window.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => {
    if ((ms ?? 0) < 10_000) return realSetTimeout(fn, ms, ...rest)
    polls.push(ms!)
    return realSetTimeout(fn, 1)
  }) as typeof window.setTimeout
})
afterEach(() => {
  window.setTimeout = realSetTimeout
  window.removeEventListener('unhandledrejection', onRejection)
})
const settle = (ms = 100) => new Promise((resolve) => realSetTimeout(resolve, ms))

describe('upload status fallback poll', () => {
  it('keeps polling after one failed asset fetch, and says so once it gives up', async () => {
    const item = useUploadQueueItemFactory().createDefault(
      'k',
      UploadQueueItemType.File,
      UploadQueueItemStatus.Uploading,
      DamAssetType.Image,
      1024,
      1
    )
    item.assetId = 'asset-1'
    fetchAsset.mockRejectedValueOnce(new Error('Network Error'))
    fetchAsset.mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Uploaded))

    await damUploadFinish(() => ({}) as never, '/asset', '/image', item, 'sha', true)
    await vi.waitFor(() => expect(item.error.hasError).toBe(true), { timeout: 2000 })

    expect(polls).toEqual([10_000, 40_000, 90_000, 160_000, 250_000])
    expect(fetchAsset).toHaveBeenCalledTimes(4)
    expect(item.error.message).not.toBe('')
    expect(rejections).toEqual([])
  })
})

// Removed while its poll waited for the asset, an item kept polling for the tries left, and the poll kept it
// in memory, file and all.
describe('an item removed while its poll waits for the asset', () => {
  it('is polled no more', async () => {
    fetchAsset.mockReset()
    let answer: (value: unknown) => void = () => {}
    fetchAsset.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    fetchAsset.mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Uploaded))
    const store = useUploadQueuesStore()
    const key = 'removed'
    await store.addByCopyToLicence(key, 1, 1, ['asset-1'])
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledTimes(1), { timeout: 2000 })

    store.removeByIndex(key, 0)
    answer(asset('asset-1', AssetFileProcessStatus.Uploaded))
    await settle(300)

    expect(polls).toEqual([10_000])
    expect(fetchAsset).toHaveBeenCalledTimes(1)
  })
})

// A stop while the finish request ran was overwritten when it answered: the item went back to processing and was
// polled, file and all.
describe('an upload stopped while it finishes', () => {
  it('stays stopped and is not polled', async () => {
    const { imageUploadFinish } = await import('@/domains/dam/api/damImageApi')
    let answer: (value: unknown) => void = () => {}
    vi.mocked(imageUploadFinish).mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never)
    const item = useUploadQueueItemFactory().createDefault(
      'k',
      UploadQueueItemType.File,
      UploadQueueItemStatus.Uploading,
      DamAssetType.Image,
      1024,
      1
    )
    item.assetId = 'asset-1'

    const finished = damUploadFinish(() => ({}) as never, '/asset', '/image', item, 'sha', true)
    item.status = UploadQueueItemStatus.Stop
    answer({})
    await finished
    await settle()

    expect(item.status).toBe(UploadQueueItemStatus.Stop)
    expect(polls).toEqual([])
  })
})

describe('an asset copied to the licence', () => {
  it('is polled for when no notification comes, and ends up uploaded with its file', async () => {
    fetchAsset.mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Processed))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]!

    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded), { timeout: 2000 })
    // The image is built from the file id: without it the copied item is dropped on confirm.
    expect(item.fileId).toBe('file-of-asset-1')
    expect(polls[0]).toBe(10_000)
    expect(store.getQueueProcessedCount('q')).toBe(1)
  })

  it('polls again when loading the processed asset fails', async () => {
    const processed = asset('asset-1', AssetFileProcessStatus.Processed)
    fetchAsset
      .mockResolvedValueOnce(processed) // the poll
      .mockRejectedValueOnce(new Error('Network Error')) // the detail it then loads
      .mockResolvedValue(processed)
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]!

    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded), { timeout: 2000 })
    expect(polls).toEqual([10_000, 40_000])
    expect(rejections).toEqual([])
  })

  it('arms no poll when the fallback is off', async () => {
    state.uploadStatusFallback = false
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    await settle()

    expect(store.getQueueItems('q')[0]!.notificationFallbackTimer).toBeUndefined()
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})

describe('a duplicate whose origin asset cannot be loaded', () => {
  const forbidden = () => Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } })

  it('fails the item instead of throwing past the widget', async () => {
    state.uploadStatusFallback = false
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    fetchAssetByFileId.mockRejectedValueOnce(forbidden())

    await expect(store.queueItemDuplicate('asset-1', 'file-1', DamAssetType.Image)).resolves.toBeUndefined()

    const item = store.getQueueItems('q')[0]!
    expect(item.status).toBe(UploadQueueItemStatus.Failed)
    expect(item.error.hasError).toBe(true)
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
  })

  it('fails the item when the duplicate notification leads there, with no unhandled rejection', async () => {
    state.uploadStatusFallback = false
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    fetchAssetByFileId.mockRejectedValueOnce(forbidden())

    state.listener!({
      name: DamNotificationName.AssetFileDuplicate,
      data: { asset: 'asset-1', originAssetFile: 'file-1', assetType: DamAssetType.Image },
    })
    await vi.waitFor(() => expect(store.getQueueItems('q')[0]!.status).toBe(UploadQueueItemStatus.Failed))
    await settle()

    expect(rejections).toEqual([])
  })
})
