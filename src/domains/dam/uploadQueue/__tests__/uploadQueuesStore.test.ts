import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// rusha is CommonJS and pre-bundled for the browser run: the factory returns what its `module.exports`
// would be, and the import sees that as `default`, as it does the real package.
vi.mock('rusha', () => ({ createHash: () => ({ update: () => undefined, digest: () => 'sha' }) }))

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))

// Each chunk waits until the test lets that file's request answer, or, as axios does, rejects once its signal aborts.
const release = new Map<string, () => void>()
const damUploadStart = vi.fn(async (_c: unknown, _e: unknown, item: UploadQueueItem) => ({
  asset: `asset-${item.file!.name}`,
  id: `file-${item.file!.name}`,
}))
const damUploadChunk = vi.fn(
  (_c: unknown, _e: unknown, item: UploadQueueItem) =>
    new Promise((resolve, reject) => {
      release.set(item.file!.name, () => resolve({}))
      item.latestChunkAbortController?.signal.addEventListener('abort', () => reject(new axios.CanceledError()))
    })
)
// As the real one: a finished upload leaves "uploading" for "processing".
const damUploadFinish = vi.fn(async (_c: unknown, _a: unknown, _i: unknown, item: UploadQueueItem) => {
  item.status = UploadQueueItemStatus.Processing
  return {}
})
vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: (...a: unknown[]) => damUploadStart(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadChunk: (...a: unknown[]) => damUploadChunk(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadFinish: (...a: unknown[]) => damUploadFinish(...(a as [unknown, unknown, unknown, UploadQueueItem])),
  armNotificationFallback: vi.fn(),
}))

const assetWithFile = async (_c: unknown, _e: unknown, id: string) => ({
  id,
  mainFile: { id: 'f', links: {} },
  attributes: { assetStatus: 'with_file' },
})
const fetchAsset = vi.fn(assetWithFile)
// The original of a duplicate, looked up by its file.
const noSuchFile = async (): Promise<unknown> => Promise.reject(new Error('404 Not Found'))
const fetchAssetByFileId = vi.fn(noSuchFile)
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (...a: unknown[]) => fetchAsset(...(a as [unknown, unknown, string])),
  fetchAssetByFileId: () => fetchAssetByFileId(),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

beforeEach(() => {
  setActivePinia(createPinia())
  release.clear()
  fetchAsset.mockImplementation(assetWithFile)
  fetchAssetByFileId.mockImplementation(noSuchFile)
})

describe('a zero-byte file in the upload queue', () => {
  it('fails the item instead of leaving the queue waiting for it forever', async () => {
    const store = useUploadQueuesStore()
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' })

    await store.addByFiles('q', 1, 1, [empty])

    await vi.waitFor(() => expect(store.getQueueItems('q')[0].status).toBe(UploadQueueItemStatus.Failed), {
      timeout: 1000,
    })
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
    expect(damUploadStart).not.toHaveBeenCalled()
  })
})

describe('an asset copied to the licence whose detail fails to load', () => {
  it('ends up marked as failed rather than processing forever', async () => {
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    // Copied items get no notification fallback timer: the notification is all there is.
    expect(item.notificationFallbackTimer).toBeUndefined()

    bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await settle()

    expect(item.error.hasError).toBe(true)
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
  })
})

// Its metadata is loaded once, by whichever of the notification, the fallback and the refresh button answers
// first, and a failed item has none to edit.
describe('the metadata of an item in the queue', () => {
  const processed = async (_c: unknown, _e: unknown, id: string) => ({
    id,
    mainFile: { id: 'f', links: {} },
    attributes: { assetStatus: 'with_file' },
    keywords: [],
    authors: [],
    mainFileSingleUse: true,
    mainFileInternal: false,
    metadata: { customData: { title: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  })

  // The fallback and the refresh button settle an item through `queueItemFullyProcessed`, which loads its
  // metadata as well.
  it('keeps what the user typed once its notification had loaded the metadata', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'])
    const [typed, waiting] = store.getQueueItems('q')
    // The metadata notification came while the file was still processing, and the user has typed since.
    typed.canEditMetadata = true
    typed.customData = { title: 'typed' }
    typed.mainFileSingleUse = false
    // The fallback gave up on it and said so; the refresh button then finds its file processed.
    waiting.error.hasError = true
    fetchAsset.mockImplementation(processed)

    await store.queueItemFullyProcessed('asset-typed')
    await store.queueItemFullyProcessed('asset-waiting')

    expect([typed.status, waiting.status]).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Uploaded])
    expect(typed.customData).toEqual({ title: 'typed' })
    expect(typed.mainFileSingleUse).toBe(false)
    // A row still without its metadata gets it, and its form with it.
    expect(waiting.customData).toEqual({ title: 'from the server' })
    expect(waiting.canEditMetadata).toBe(true)
    expect(waiting.error.hasError).toBe(false)
  })

  it('loses the error the fallback gave up with when its processed notification comes after all', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-late'])
    const [late] = store.getQueueItems('q')
    late.error.hasError = true
    fetchAsset.mockImplementation(processed)

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-late' } })
    await vi.waitFor(() => expect(late.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(late.error.hasError).toBe(false)
  })

  // The same rule for the notifications themselves: their answers can come in either order.
  it('is given its metadata once, and keeps its switches once it has it', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'])
    const [typed, waiting] = store.getQueueItems('q')
    typed.canEditMetadata = true
    typed.customData = { title: 'typed' }
    typed.mainFileSingleUse = false
    fetchAsset.mockImplementation(processed)

    for (const asset of ['asset-typed', 'asset-waiting']) {
      bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset } })
      bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset } })
    }
    await vi.waitFor(() => expect(waiting.canEditMetadata).toBe(true))
    await settle()

    expect(typed.customData).toEqual({ title: 'typed' })
    expect(typed.mainFileSingleUse).toBe(false)
    expect(waiting.customData).toEqual({ title: 'from the server' })
    expect(waiting.mainFileSingleUse).toBe(true)
  })

  it('stays not editable when it failed, also when its metadata event comes after the failure', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-failed'])
    const [failed] = store.getQueueItems('q')
    failed.status = UploadQueueItemStatus.Failed
    fetchAsset.mockImplementation(processed)

    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: 'asset-failed' } })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await settle()

    // Editable, it was validated and saved with the rest of the queue.
    expect(failed.canEditMetadata).toBe(false)
    expect(failed.customData).toEqual({})
  })

  // The other order: the server reads the metadata off the first chunk, so its event comes while the file sends.
  it('stops being editable when its upload fails after its metadata had come', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the finish request failed'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'late.jpg', { type: 'image/jpeg' })])
    await vi.waitFor(() => expect(release.has('late.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')

    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    release.get('late.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item.canEditMetadata).toBe(false)
  })

  // A request of the client's failed, and the server finished the upload all the same.
  it('is an uploaded item again, with its metadata, when its file turns out to be processed', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'lost.jpg', { type: 'image/jpeg' })])
    await vi.waitFor(() => expect(release.has('lost.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')
    release.get('lost.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    fetchAsset.mockClear()

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    // With its form at once, from the answer that settled it: without it the row waits for its refresh button.
    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'from the server' })
    expect(item.error.hasError).toBe(false)
    // From the one answer that said the file is processed: a second request could fail and leave it failed.
    expect(fetchAsset).toHaveBeenCalledTimes(1)
  })

  // The same row, when its metadata had come before the request failed: the user may have typed into it by then.
  it('is an uploaded item again with what the user typed, when its metadata had come before the failure', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'typed.jpg', { type: 'image/jpeg' })])
    await vi.waitFor(() => expect(release.has('typed.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')
    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    item.customData = { title: 'typed' }
    item.mainFileSingleUse = false
    release.get('typed.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    expect(item.canEditMetadata).toBe(false)

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    // The failure took its form away, not what was in it.
    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'typed' })
    expect(item.mainFileSingleUse).toBe(false)
  })

  // A copy's own notification settles it as the fallback does: its metadata may be there already.
  it('keeps what the user typed into a copy whose metadata came before its copied notification', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'])
    const [typed, waiting] = store.getQueueItems('q')
    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: 'asset-typed' } })
    await vi.waitFor(() => expect(typed.canEditMetadata).toBe(true))
    typed.customData = { title: 'typed' }
    typed.mainFileSingleUse = false

    for (const asset of ['asset-typed', 'asset-waiting']) {
      bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset } })
    }
    await vi.waitFor(() =>
      expect([typed.status, waiting.status]).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Uploaded])
    )

    // With its file, which the image is built from.
    expect([typed.customData, typed.mainFileSingleUse, typed.fileId]).toEqual([{ title: 'typed' }, false, 'f'])
    // A copy still without its metadata gets it, with its file and its form.
    expect([waiting.customData, waiting.mainFileSingleUse]).toEqual([{ title: 'from the server' }, true])
    expect([waiting.fileId, waiting.canEditMetadata]).toEqual(['f', true])
  })

  // However the row came by its metadata, and whichever way its file is reported failed and then processed.
  it.each([
    [
      'the fallback loaded',
      (store: ReturnType<typeof useUploadQueuesStore>) => store.queueItemFullyProcessed('asset-1'),
    ],
    [
      'its copy brought',
      () => bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } }),
    ],
    [
      'the original of a duplicate brought',
      () =>
        bus.listener!({
          name: DamNotificationName.AssetFileDuplicate,
          data: { asset: 'asset-1', originAssetFile: 'file-original', assetType: DamAssetType.Image },
        }),
    ],
  ])('keeps what the user typed over the metadata %s, through a failure of its file', async (_name, load) => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    fetchAssetByFileId.mockImplementation(() => processed(null, null, 'asset-1'))
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const [item] = store.getQueueItems('q')
    load(store)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    item.customData = { title: 'typed' }

    await store.queueItemFailed('asset-1', AssetFileFailReason.Unknown)
    expect([item.status, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Failed, false])
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'typed' })
  })

  // And the third order: the notification has settled the row before the request fails.
  it('stays uploaded, with what the user typed, when the request fails after the notification settled it', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'settled.jpg', { type: 'image/jpeg' })])
    await vi.waitFor(() => expect(release.has('settled.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')
    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    item.customData = { title: 'typed' }
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    release.get('settled.jpg')!()
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalled())
    await settle()

    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(item.error.hasError).toBe(false)
    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'typed' })
  })

  // The same, with the processed notification ahead of the failure: it can beat the answer to the finish request.
  it('is an uploaded item with its metadata also when the request fails while the notification is handled', async () => {
    const store = useUploadQueuesStore()
    let answerLookup!: () => void
    fetchAsset.mockImplementation(processed)
    fetchAsset.mockImplementationOnce(
      (client, endPoint, id) =>
        new Promise((resolve) => (answerLookup = () => resolve(processed(client, endPoint, id))))
    )
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'race.jpg', { type: 'image/jpeg' })])
    await vi.waitFor(() => expect(release.has('race.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(answerLookup).toBeDefined())
    release.get('race.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    answerLookup()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'from the server' })
  })

  it('stops being editable when the lookup that should settle it fails', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-duplicate', 'asset-copy'])
    const [duplicate, copy] = store.getQueueItems('q')
    duplicate.canEditMetadata = true
    copy.canEditMetadata = true
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))

    // The original of a duplicate is looked up by its file, a copy by its asset: neither answers.
    bus.listener!({
      name: DamNotificationName.AssetFileDuplicate,
      data: { asset: 'asset-duplicate', originAssetFile: 'file-original', assetType: DamAssetType.Image },
    })
    bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-copy' } })
    await vi.waitFor(() =>
      expect([duplicate.status, copy.status]).toEqual([UploadQueueItemStatus.Failed, UploadQueueItemStatus.Failed])
    )

    expect([duplicate.canEditMetadata, copy.canEditMetadata]).toEqual([false, false])
  })
})

// Removed while it sent, an upload went on in the background: it finished, was polled for its processing, and no
// longer counted as uploading, so the queue started one more beside it.
describe('an upload removed while it sends', () => {
  it('stops, and the next file takes its slot', async () => {
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c'].map((n) => new File(['x'], `${n}.jpg`, { type: 'image/jpeg' }))
    await store.addByFiles('removed', 1, 1, files)
    await vi.waitFor(() => expect(release.size).toBe(2))
    const removed = store.getQueueItems('removed')[0]!

    // Its chunk request never answers: only the abort frees the slot for c.
    store.removeByIndex('removed', 0)
    await vi.waitFor(() => expect(release.has('c.jpg')).toBe(true))
    await settle()

    expect(damUploadFinish.mock.calls.some((call) => call[3].file?.name === 'a.jpg')).toBe(false)
    expect(removed.status).not.toBe(UploadQueueItemStatus.Processing)
  })
})

describe('upload queue parallel limit', () => {
  it('never runs more than two uploads at once', async () => {
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => new File(['x'], `${n}.jpg`, { type: 'image/jpeg' }))
    const uploading = () => store.getQueueItems('q').filter((i) => i.status === UploadQueueItemStatus.Uploading).length

    await store.addByFiles('q', 1, 1, files)
    await vi.waitFor(() => expect(release.size).toBe(2))
    expect(uploading()).toBe(2)

    // a finishes: one slot frees up, so exactly one more file may start.
    release.get('a.jpg')!()
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(1))
    await settle()
    const afterFinish = uploading()

    // The DAM notification for a arrives while the others are still sending.
    await store.queueItemProcessed('asset-a.jpg')
    await settle()
    expect([afterFinish, uploading()]).toEqual([2, 2])
  })
})
