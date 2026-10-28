import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { immediateScheduler } from '@/domains/dam/uploadQueue/settlement/__tests__/support/immediateScheduler'
import { manualScheduler } from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

// rusha is CommonJS and pre-bundled for the browser run.
// The factory returns what its `module.exports` would be, and
// the import sees that as `default`, as with the real package.
vi.mock('rusha', () => ({ createHash: () => ({ update: () => undefined, digest: () => 'sha' }) }))

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))

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
const damUploadFinish = vi.fn(async (_c: unknown, _i: unknown, item: UploadQueueItem) => {
  item.status = UploadQueueItemStatus.Processing
  return {}
})
vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: (...a: unknown[]) => damUploadStart(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadChunk: (...a: unknown[]) => damUploadChunk(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadFinish: (...a: unknown[]) => damUploadFinish(...(a as [unknown, unknown, UploadQueueItem])),
}))

const assetWithFile = async (_c: unknown, _e: unknown, id: string) => ({
  id,
  mainFile: { id: 'f', links: {} },
  attributes: { assetStatus: 'with_file' },
})
const fetchAsset = vi.fn(assetWithFile)
// The poll has no notification telling it the file is processed, so the asset itself says so.
const processedFile = async (_c: unknown, _e: unknown, id: string) => ({
  id,
  mainFile: { id: 'f', links: {}, fileAttributes: { status: 'processed' } },
  attributes: { assetStatus: 'with_file' },
  keywords: [],
  authors: [],
  mainFileSingleUse: null,
  mainFileInternal: null,
  metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
})
const noSuchFile = async (): Promise<unknown> => Promise.reject(new Error('404 Not Found'))
const fetchAssetByFileId = vi.fn(noSuchFile)
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (...a: unknown[]) => fetchAsset(...(a as [unknown, unknown, string])),
  fetchAssetByFileId: () => fetchAssetByFileId(),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
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

// These cases are not about time: the read a notification asks for runs at once, and the queue poll never runs.
const realScheduler = uploadSettlementRuntime.scheduler
beforeEach(() => {
  setActivePinia(createPinia())
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1024, maxSize: 1024 }
  uploadSettlementRuntime.scheduler = immediateScheduler()
  release.clear()
  fetchAsset.mockImplementation(assetWithFile)
  fetchAssetByFileId.mockImplementation(noSuchFile)
})
afterEach(() => {
  const store = useUploadQueuesStore()
  store.stopUpload('q')
  store.stopUpload('removed')
  uploadSettlementRuntime.scheduler = realScheduler
})

// An application with its own queue store (admin-dam) has this store alive beside it through shared components.
// With no row of its own, this store must not answer the notifications too.
describe('the notifications', () => {
  it('are listened to from the first row of the store on, and not before', async () => {
    bus.listener = undefined
    const store = useUploadQueuesStore()
    expect(bus.listener).toBeUndefined()

    await store.addByCopyToLicence('q', 1, 1, ['asset-1'], 'default')
    expect(bus.listener).toBeTypeOf('function')

    // Once: a second subscription would answer every notification twice.
    bus.listener = undefined
    await store.addByCopyToLicence('q', 1, 1, ['asset-2'], 'default')
    await store.addByFiles('q', 1, 1, [new File([], 'empty.jpg', { type: 'image/jpeg' })], 'default')
    expect(bus.listener).toBeUndefined()
  })
})

describe('a zero-byte file in the upload queue', () => {
  it('fails the item instead of leaving the queue waiting for it forever', async () => {
    const store = useUploadQueuesStore()
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' })

    await store.addByFiles('q', 1, 1, [empty], 'default')

    await vi.waitFor(() => expect(store.getQueueItems('q')[0].status).toBe(UploadQueueItemStatus.Failed), {
      timeout: 1000,
    })
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
    expect(damUploadStart).not.toHaveBeenCalled()
  })
})

// Only the read failed, not the copy. Failing the row would make a copy the server already made unreachable.
describe('an asset copied to the licence whose detail fails to load', () => {
  it('waits on rather than fail, and is settled by the next read of its queue', async () => {
    const clock = manualScheduler()
    uploadSettlementRuntime.scheduler = clock
    fetchAsset.mockClear()
    fetchAsset.mockRejectedValueOnce(new Error('502 Bad Gateway'))
    fetchAsset.mockImplementation(processedFile)
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'], 'default')
    const item = store.getQueueItems('q')[0]
    expect(item.status).toBe(UploadQueueItemStatus.Processing)

    bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await clock.advance(1000)

    expect(fetchAsset).toHaveBeenCalledTimes(1)
    expect([item.status, item.error.hasError]).toEqual([UploadQueueItemStatus.Processing, false])
    expect(store.getQueueProcessedCount('q')).toBe(0)

    await clock.advance(4000)

    expect([item.status, item.fileId, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Uploaded, 'f', true])
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
  })
})

// Metadata is loaded once, by whichever of the notification, the fallback and the refresh button answers first.
// A failed item has no metadata to edit.
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

  // The fallback and the refresh button settle an item through
  // `queueItemFullyProcessed`, which also loads its metadata.
  it('keeps what the user typed once its notification had loaded the metadata', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'], 'default')
    const [typed, waiting] = store.getQueueItems('q')
    typed.canEditMetadata = true
    typed.customData = { title: 'typed' }
    typed.mainFileSingleUse = false
    waiting.error.hasError = true
    fetchAsset.mockImplementation(processed)

    await store.queueItemFullyProcessed('asset-typed', 'default')
    await store.queueItemFullyProcessed('asset-waiting', 'default')

    expect([typed.status, waiting.status]).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Uploaded])
    expect(typed.customData).toEqual({ title: 'typed' })
    expect(typed.mainFileSingleUse).toBe(false)
    expect(waiting.customData).toEqual({ title: 'from the server' })
    expect(waiting.canEditMetadata).toBe(true)
    expect(waiting.error.hasError).toBe(false)
  })

  it('loses the error the fallback gave up with when its processed notification comes after all', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-late'], 'default')
    const [late] = store.getQueueItems('q')
    late.error.hasError = true
    fetchAsset.mockImplementation(processed)

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-late' } })
    await vi.waitFor(() => expect(late.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(late.error.hasError).toBe(false)
  })

  // The same rule applies to the notifications themselves: their answers can arrive in either order.
  it('is given its metadata once, and keeps its switches once it has it', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'], 'default')
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
    await store.addByCopyToLicence('q', 1, 1, ['asset-failed'], 'default')
    const [failed] = store.getQueueItems('q')
    failed.status = UploadQueueItemStatus.Failed
    fetchAsset.mockImplementation(processed)

    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: 'asset-failed' } })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await settle()

    expect(failed.canEditMetadata).toBe(false)
    expect(failed.customData).toEqual({})
  })

  // The other order: the server reads metadata off the first
  // chunk, so its event arrives while the file is still sending.
  it('stops being editable when its upload fails after its metadata had come', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the finish request failed'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'late.jpg', { type: 'image/jpeg' })], 'default')
    await vi.waitFor(() => expect(release.has('late.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')

    bus.listener!({ name: DamNotificationName.AssetMetadataProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    release.get('late.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item.canEditMetadata).toBe(false)
  })

  // A client request failed, but the server finished the upload anyway.
  it('is an uploaded item again, with its metadata, when its file turns out to be processed', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'lost.jpg', { type: 'image/jpeg' })], 'default')
    await vi.waitFor(() => expect(release.has('lost.jpg')).toBe(true))
    const [item] = store.getQueueItems('q')
    release.get('lost.jpg')!()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    fetchAsset.mockClear()

    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: item.assetId } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    // The form opens at once from the answer that settled the row. Otherwise the row waits for its refresh button.
    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'from the server' })
    expect(item.error.hasError).toBe(false)
    // Taken from the single answer that said the file is processed.
    // A second request could fail and leave the row failed.
    expect(fetchAsset).toHaveBeenCalledTimes(1)
  })

  // The same row, when its metadata came before the request failed. The user may have typed into it by then.
  it('is an uploaded item again with what the user typed, when its metadata had come before the failure', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'typed.jpg', { type: 'image/jpeg' })], 'default')
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

    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'typed' })
    expect(item.mainFileSingleUse).toBe(false)
  })

  // A copy's own notification settles it like the fallback does. Its metadata may already be there.
  it('keeps what the user typed into a copy whose metadata came before its copied notification', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    await store.addByCopyToLicence('q', 1, 1, ['asset-typed', 'asset-waiting'], 'default')
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

    expect([typed.customData, typed.mainFileSingleUse, typed.fileId]).toEqual([{ title: 'typed' }, false, 'f'])
    expect([waiting.customData, waiting.mainFileSingleUse]).toEqual([{ title: 'from the server' }, true])
    expect([waiting.fileId, waiting.canEditMetadata]).toEqual(['f', true])
  })

  it.each([
    [
      'the fallback loaded',
      (store: ReturnType<typeof useUploadQueuesStore>) => store.queueItemFullyProcessed('asset-1', 'default'),
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
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'], 'default')
    const [item] = store.getQueueItems('q')
    load(store)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    item.customData = { title: 'typed' }

    await store.queueItemFailed('asset-1', AssetFileFailReason.Unknown, 'default')
    expect([item.status, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Failed, false])
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'typed' })
  })

  // Third order: the notification settles the row before the request fails.
  it('stays uploaded, with what the user typed, when the request fails after the notification settled it', async () => {
    const store = useUploadQueuesStore()
    fetchAsset.mockImplementation(processed)
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'settled.jpg', { type: 'image/jpeg' })], 'default')
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

  // Same, with the processed notification ahead of the failure. It can beat the answer to the finish request.
  it('is an uploaded item with its metadata also when the request fails while the notification is handled', async () => {
    const store = useUploadQueuesStore()
    let answerLookup!: () => void
    fetchAsset.mockImplementation(processed)
    fetchAsset.mockImplementationOnce(
      (client, endPoint, id) =>
        new Promise((resolve) => (answerLookup = () => resolve(processed(client, endPoint, id))))
    )
    damUploadFinish.mockRejectedValueOnce(new Error('the answer to the finish request was lost'))
    await store.addByFiles('q', 1, 1, [new File(['x'], 'race.jpg', { type: 'image/jpeg' })], 'default')
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

  it('stops being editable when the original of a duplicate cannot be read; a copy whose read fails waits on', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-duplicate', 'asset-copy'], 'default')
    const [duplicate, copy] = store.getQueueItems('q')
    duplicate.canEditMetadata = true
    copy.canEditMetadata = true
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))

    // A duplicate's original is looked up by its file and a copy by its asset. Neither lookup answers.
    bus.listener!({
      name: DamNotificationName.AssetFileDuplicate,
      data: { asset: 'asset-duplicate', originAssetFile: 'file-original', assetType: DamAssetType.Image },
    })
    bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-copy' } })
    await vi.waitFor(() => expect(duplicate.status).toBe(UploadQueueItemStatus.Failed))
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await settle()

    expect(duplicate.canEditMetadata).toBe(false)
    expect([copy.status, copy.canEditMetadata]).toEqual([UploadQueueItemStatus.Processing, true])
  })
})

// Regression guard: an upload removed while it sent kept running in the background.
// It finished, was polled for processing, and no longer counted as uploading, so the queue started one extra upload.
describe('an upload removed while it sends', () => {
  it('stops, and the next file takes its slot', async () => {
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c'].map((n) => new File(['x'], `${n}.jpg`, { type: 'image/jpeg' }))
    await store.addByFiles('removed', 1, 1, files, 'default')
    await vi.waitFor(() => expect(release.size).toBe(2))
    const removed = store.getQueueItems('removed')[0]!
    const chunkOfA = removed.latestChunkAbortController!.signal

    // The removed row is stopped together with its run and the chunk on the wire.
    // `c` starts at once, because the core starts the next row
    // when a row leaves (Z15), not when the cancelled run ends.
    store.removeByIndex('removed', 0)
    await vi.waitFor(() => expect(release.has('c.jpg')).toBe(true))
    // The chunk is answered after all. A run that kept going would finish the upload.
    release.get('a.jpg')!()
    await settle()

    expect(damUploadFinish.mock.calls.map((call) => call[2].key)).not.toContain(removed.key)
    expect(chunkOfA.aborted).toBe(true)
    expect(removed.status).toBe(UploadQueueItemStatus.Stop)
  })
})

describe('upload queue parallel limit', () => {
  it('never runs more than two uploads at once', async () => {
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => new File(['x'], `${n}.jpg`, { type: 'image/jpeg' }))
    const uploading = () =>
      store
        .getQueueItems('q')
        .filter((i) => i.status === UploadQueueItemStatus.Uploading)
        .map((i) => i.file!.name)

    await store.addByFiles('q', 1, 1, files, 'default')
    await vi.waitFor(() => expect(release.size).toBe(2))
    expect(uploading()).toEqual(['a.jpg', 'b.jpg'])
    const [a] = store.getQueueItems('q')

    release.get('a.jpg')!()
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(1))
    await settle()
    expect(damUploadFinish.mock.calls.map((call) => call[2].key)).toEqual([a!.key])
    expect(a!.status).toBe(UploadQueueItemStatus.Processing)
    const afterFinish = uploading()

    await store.queueItemProcessed('asset-a.jpg', 'default')
    await settle()
    expect([afterFinish, uploading()]).toEqual([
      ['b.jpg', 'c.jpg'],
      ['b.jpg', 'c.jpg'],
    ])
  })
})
