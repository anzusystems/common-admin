import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { rowState } from '@/domains/dam/__tests__/support/uploadQueueRow'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { manualScheduler } from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'events-queue'
const OTHER_QUEUE = 'events-queue-of-another-widget'

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  waits = holdLongWaits()
})
const realScheduler = uploadSettlementRuntime.scheduler

afterEach(() => {
  const store = useUploadQueuesStore()
  store.stopUpload(QUEUE)
  store.stopUpload(OTHER_QUEUE)
  uploadSettlementRuntime.scheduler = realScheduler
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const notify = (name: DamNotificationNameType | string, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const fromTheServer = {
  metadata: { customData: { title: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: true,
  mainFileInternal: false,
}
// The metadata notification may come to be read with a delay of its own.
const SOON = { timeout: 5000 }

const uploadOne = async () => {
  const store = useUploadQueuesStore()
  await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'default')
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
  return { store, item }
}
const unreadable = () =>
  dam.reply((request) =>
    request.method === 'GET' && request.url.startsWith(endPoints.asset) ? { status: 502 } : undefined
  )
/**
 * A read the queue asks for on a notification is due 250 ms or 2 s after it.
 * The test moves the queue's time past both at once, so "asks for nothing" can be asserted.
 * Call it before the first row is added.
 */
const nothingMoreIsDue = () => {
  const clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  return () => clock.advance(3000)
}
const noFurtherRead = async () => {
  const reads = dam.assetReads().length
  await waits.elapseAll()
  expect(dam.assetReads()).toHaveLength(reads)
}

describe('a notification about the asset of a row', () => {
  it('asset_file_processed: the row is uploaded, and still without its form', async () => {
    const { store, item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({ fileId: 'file-1', canEditMetadata: false, customData: {}, error: { hasError: false } })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))).toBe(true)
  })

  it('asset_metadata_processed: the row gets its metadata and its form, and waits on for its file', async () => {
    const { store, item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)

    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)

    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      customData: { title: 'from the server' },
      mainFileSingleUse: true,
      mainFileInternal: false,
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(0)
  })

  it('asset_file_failed: the row fails with the reason the notification carries', async () => {
    const { store, item } = await uploadOne()

    notify(DamNotificationName.AssetFileFailed, {
      asset: 'asset-1',
      id: 'file-1',
      failReason: AssetFileFailReason.InvalidMimeType,
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
  })

  it('asset_file_duplicate: the row becomes the original the notification names by its file', async () => {
    const { item } = await uploadOne()
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
    )

    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'asset-1',
      id: 'file-1',
      originAssetFile: 'file-original',
      assetType: DamAssetType.Image,
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(dam.originReads().map((read) => read.url)).toEqual(['/adm/v1/asset/asset-file/file-original'])
    expect(item).toMatchObject({
      isDuplicate: true,
      assetId: 'asset-original',
      fileId: 'file-original',
      customData: { title: 'from the server' },
      canEditMetadata: true,
    })
  })

  it('asset_file_copied: a copy to the licence is uploaded, with its file, its metadata and its form', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy'], 'default')
    const [item] = store.getQueueItems(QUEUE)
    dam.assets.set(
      'asset-copy',
      damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Processed, fromTheServer)
    )

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-copy', id: 'file-copy' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      fileId: 'file-copy',
      customData: { title: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
  })

  // Rows are matched by their asset, whatever file the notification names.
  // What became of the file is what the read of the asset says.
  it('asset_file_copied that names another file than the main one: the row is settled by what its asset says', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy'], 'default')
    const [item] = store.getQueueItems(QUEUE)
    dam.fileBecomes('asset-copy', AssetFileProcessStatus.Failed, fromTheServer, {
      failReason: AssetFileFailReason.InvalidMimeType,
    })

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-copy', id: 'file-of-a-slot' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      canEditMetadata: false,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
  })

  it('settles the row of that asset and leaves the other rows of the queue alone', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg')], 'default')
    const [first, second] = store.getQueueItems(QUEUE)
    await vi.waitFor(() =>
      expect([first.status, second.status]).toEqual([
        UploadQueueItemStatus.Processing,
        UploadQueueItemStatus.Processing,
      ])
    )
    dam.fileBecomes(second.assetId!, AssetFileProcessStatus.Processed, fromTheServer)
    const before = rowState(first)

    notify(DamNotificationName.AssetFileProcessed, { asset: second.assetId, id: second.fileId })
    await vi.waitFor(() => expect(second.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(rowState(first)).toEqual(before)
    expect(store.getQueueProcessedCount(QUEUE)).toBe(1)
  })

  it('settles the rows of that asset in every queue', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy'], 'default')
    await store.addByCopyToLicence(OTHER_QUEUE, extSystem, licence, ['asset-copy'], 'default')
    const [here] = store.getQueueItems(QUEUE)
    const [there] = store.getQueueItems(OTHER_QUEUE)
    dam.assets.set(
      'asset-copy',
      damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Processed, fromTheServer)
    )

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-copy', id: 'file-copy' })
    await vi.waitFor(() =>
      expect([here.status, there.status]).toEqual([UploadQueueItemStatus.Uploaded, UploadQueueItemStatus.Uploaded])
    )

    expect([here.fileId, there.fileId]).toEqual(['file-copy', 'file-copy'])
    expect([store.getQueueProcessedCount(QUEUE), store.getQueueProcessedCount(OTHER_QUEUE)]).toEqual([1, 1])
  })

  // The queue starts listening with its first row, which is added from a widget.
  // That widget can be unmounted later while the queue and its dialog live on.
  it('still reaches the queue once the component that added its first row is gone', async () => {
    const store = useUploadQueuesStore()
    const component = effectScope()
    await component.run(() => store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy'], 'default'))
    component.stop()
    const [item] = store.getQueueItems(QUEUE)
    dam.assets.set(
      'asset-copy',
      damAssetWithFile('asset-copy', 'file-copy', AssetFileProcessStatus.Processed, fromTheServer)
    )

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-copy', id: 'file-copy' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
  })

  it.each([
    DamNotificationName.AssetFileUploaded,
    DamNotificationName.AssetFileDeleted,
    DamNotificationName.AssetDeleted,
    'a_name_of_tomorrow',
  ])('%s: changes nothing and asks for nothing', async (name) => {
    const nothingMore = nothingMoreIsDue()
    const { item } = await uploadOne()
    const before = rowState(item)
    const requests = dam.requests.length

    notify(name, { asset: 'asset-1', id: 'file-1' })
    await nothingMore()

    expect(rowState(item)).toEqual(before)
    expect(dam.requests).toHaveLength(requests)
  })
})

// In admin-cms both notifications and the poll are live. Whichever answers first settles the row.
describe('a notification that comes while the row waits to be asked about', () => {
  it('asset_file_processed: settles the row, which is then asked about no more', async () => {
    const { item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    await noFurtherRead()
    expect(item).toMatchObject({ status: UploadQueueItemStatus.Uploaded, error: { hasError: false, message: '' } })
  })

  it('asset_file_failed: fails the row, which is then asked about no more', async () => {
    const { item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    notify(DamNotificationName.AssetFileFailed, {
      asset: 'asset-1',
      id: 'file-1',
      failReason: AssetFileFailReason.Unknown,
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    await noFurtherRead()
    expect(item.status).toBe(UploadQueueItemStatus.Failed)
  })

  // The server reads the metadata off the first chunk, so this notification can come while the file is still sent.
  it('asset_metadata_processed while the file is sent: the form opens, and the file is still settled by a read', async () => {
    const store = useUploadQueuesStore()
    const chunks = dam.hold('POST', dam.routes.chunk)
    await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'default')
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Uploading, fromTheServer)

    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)
    expect(item).toMatchObject({ status: UploadQueueItemStatus.Uploading, customData: { title: 'from the server' } })

    chunks.release()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({ canEditMetadata: true, customData: { title: 'from the server' } })
    await noFurtherRead()
  })
})

describe('a notification whose asset cannot be read', () => {
  it.each([DamNotificationName.AssetFileProcessed, DamNotificationName.AssetMetadataProcessed])(
    '%s: the row is as it was',
    async (name) => {
      const { item } = await uploadOne()
      const before = rowState(item)
      unreadable()

      notify(name, { asset: 'asset-1', id: 'file-1' })
      await vi.waitFor(() => expect(dam.assetReads().length).toBeGreaterThan(0), SOON)
      await waits.settle(150)

      expect(rowState(item)).toEqual(before)
      expect(item.status).toBe(UploadQueueItemStatus.Processing)
    }
  )

  it('asset_file_failed: the row fails with the reason all the same, and nothing is asked for', async () => {
    const nothingMore = nothingMoreIsDue()
    const { item } = await uploadOne()
    const requests = dam.requests.length
    unreadable()

    notify(DamNotificationName.AssetFileFailed, {
      asset: 'asset-1',
      id: 'file-1',
      failReason: AssetFileFailReason.InvalidChecksum,
    })
    await nothingMore()

    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Failed,
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidChecksum },
    })
    expect(dam.requests).toHaveLength(requests)
  })

  it('asset_file_processed for an asset without a main file: the row is as it was', async () => {
    const { item } = await uploadOne()
    const before = rowState(item)
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    dam.assets.get('asset-1')!.mainFile = null

    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(dam.assetReads().length).toBeGreaterThan(0))
    await waits.settle(150)

    expect(rowState(item)).toEqual(before)
  })

  it.each([
    ['names no original', { originAssetFile: null, assetType: DamAssetType.Image }],
    ['is not about an image', { originAssetFile: 'file-original', assetType: DamAssetType.Audio }],
  ])('asset_file_duplicate that %s: the row is as it was, and nothing is asked for', async (_what, data) => {
    const nothingMore = nothingMoreIsDue()
    const { item } = await uploadOne()
    const before = rowState(item)
    const requests = dam.requests.length

    notify(DamNotificationName.AssetFileDuplicate, { asset: 'asset-1', id: 'file-1', ...data })
    await nothingMore()

    expect(rowState(item)).toEqual(before)
    expect(dam.requests).toHaveLength(requests)
  })

  it('asset_file_duplicate whose original cannot be read: an uploaded row stays uploaded', async () => {
    const { item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    const before = rowState(item)

    notify(DamNotificationName.AssetFileDuplicate, {
      asset: 'asset-1',
      id: 'file-1',
      originAssetFile: 'file-gone',
      assetType: DamAssetType.Image,
    })
    await vi.waitFor(() => expect(dam.originReads()).toHaveLength(1))
    await waits.settle(150)

    expect(rowState(item)).toEqual(before)
  })
})

describe('the failed notification', () => {
  const failed = (asset: string, failReason: string = AssetFileFailReason.DownloadFailed) =>
    notify(DamNotificationName.AssetFileFailed, { asset, id: 'file-1', failReason })

  it('fails a row that was uploaded already, and takes its form', async () => {
    const { store, item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    notify(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(
      () => expect([item.status, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Uploaded, true]),
      SOON
    )

    failed('asset-1')
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      canEditMetadata: false,
      customData: { title: 'from the server' },
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.DownloadFailed },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
  })

  // The row shows its message before the reason.
  // An older message left in place would hide why the file failed.
  it('takes away a message the row already had: its reason is what the row says', async () => {
    const { item } = await uploadOne()
    item.error.hasError = true
    item.error.message = 'said before'

    failed('asset-1', AssetFileFailReason.InvalidSize)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item.error).toEqual({
      hasError: true,
      message: '',
      assetFileFailReason: AssetFileFailReason.InvalidSize,
    })
  })

  // Z26: the server takes a failed file nowhere, so the rest of it is not sent. Two files go out, not three.
  // Nothing waits on real time. Each step waits for the state of the requests.
  it('stops sending a file that is still being sent, and gives its place to the next one', async () => {
    const store = useUploadQueuesStore()
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1000, maxSize: 1000 }
    const chunks = dam.hold('POST', dam.routes.chunk)
    const statuses = () => store.getQueueItems(QUEUE).map((item) => item.status)
    const onTheirWay = () => chunks.waiting.map((held) => held.request.url).sort()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], 'default')
    const [first, second, third] = store.getQueueItems(QUEUE)
    const chunkOf = (item: typeof first) => `/adm/v1/image/${item.fileId}/chunk`
    const chunksSentOf = (item: typeof first) =>
      dam
        .sentTo('POST', dam.routes.chunk)
        .filter((request) => request.url === chunkOf(item))
        .map((request) => (request.data as FormData).get('chunk'))
    await vi.waitFor(() => expect(onTheirWay()).toEqual([chunkOf(first), chunkOf(second)].sort()))
    expect(statuses()).toEqual([
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Waiting,
    ])

    failed(first.assetId!)
    await vi.waitFor(() => expect(onTheirWay()).toEqual([chunkOf(second), chunkOf(third)].sort()))
    expect(statuses()).toEqual([
      UploadQueueItemStatus.Failed,
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Uploading,
    ])
    expect(store.getQueueProcessedCount(QUEUE)).toBe(1)

    await vi.waitFor(() => {
      chunks.release()
      expect([second.status, third.status]).toEqual([
        UploadQueueItemStatus.Processing,
        UploadQueueItemStatus.Processing,
      ])
    })
    expect([chunksSentOf(first), chunksSentOf(second).length, chunksSentOf(third).length]).toEqual([
      ['{"offset":0,"size":1000}'],
      3,
      3,
    ])
    expect(
      dam
        .sentTo('PATCH', dam.routes.finish)
        .map((request) => request.url)
        .sort()
    ).toEqual([`/adm/v1/image/${second.fileId}/uploaded`, `/adm/v1/image/${third.fileId}/uploaded`].sort())
    expect(first.error).toEqual({
      hasError: true,
      message: '',
      assetFileFailReason: AssetFileFailReason.DownloadFailed,
    })
  })
})
