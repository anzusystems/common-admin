import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  type ConsumerProfile,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// What the queue does with the answer when it asks for the asset of a row that waits for the server: the poll,
// with no notification anywhere. The two kinds of row that wait: a file that was sent (either application) and
// an asset copied to the licence (admin-cms only), which was never sent and is known by its asset alone.
// Nothing of the library is replaced: the DAM is a client that records its requests, and only the long waits
// between two reads are taken out of real time.

const QUEUE = 'poll-queue'

let dam: FakeDam
let waits: LongWaits

afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const use = (profile: ConsumerProfile) => {
  setActivePinia(createPinia())
  dam = createFakeDam(profile.endPoints)
  installConsumerProfile(profile, dam.client)
  waits = holdLongWaits()
}

/** A file, sent whole. Its row has the asset and the file the start request answered. */
const uploadedFile = async (profile: ConsumerProfile) => {
  const store = useUploadQueuesStore()
  await store.addByFiles(
    QUEUE,
    profile.extSystem,
    profile.licence,
    [new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })],
    'default'
  )
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
  return item
}
/** An asset copied to the licence. Its row has the asset, and no file until it is settled. */
const copiedAsset = async (profile: ConsumerProfile) => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(QUEUE, profile.extSystem, profile.licence, ['asset-1'], 'default')
  return store.getQueueItems(QUEUE)[0]!
}

const rows: Array<[string, ConsumerProfile, (profile: ConsumerProfile) => Promise<UploadQueueItem>]> = [
  ['an uploaded file under the UGC configuration', ugcConfiguration, uploadedFile],
  ['an uploaded file under the CMS configuration', cmsConfiguration, uploadedFile],
  ['an asset copied to the licence under the CMS configuration', cmsConfiguration, copiedAsset],
]

/** Time passes until the queue has asked for the asset once more. */
const nextRead = async () => {
  const before = dam.assetReads().length
  await waits.elapse()
  await vi.waitFor(() => expect(dam.assetReads().length).toBeGreaterThan(before))
  await waits.settle()
}
const noFurtherRead = async () => {
  const reads = dam.assetReads().length
  await waits.elapseAll()
  expect(dam.assetReads()).toHaveLength(reads)
}

describe.each(rows)('what a read of the asset applies to %s', (_name, profile, waitingRow) => {
  beforeEach(() => use(profile))

  it('processed: the row is uploaded, with its file, its metadata and its form', async () => {
    const item = await waitingRow(profile)
    const store = useUploadQueuesStore()

    const processed = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
      metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
    })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      assetId: 'asset-1',
      // The image is built from the file: a copy learns it here.
      fileId: processed.mainFile!.id,
      isDuplicate: false,
      customData: { description: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(dam.assetReads().every((read) => read.url.startsWith(`${profile.endPoints.asset}/`))).toBe(true)
    await noFurtherRead()
  })

  it('duplicate: the row becomes the original, read by the file the duplicate names', async () => {
    const item = await waitingRow(profile)
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, {
        metadata: { customData: { description: 'of the original' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(dam.originReads().map((read) => read.url)).toEqual([`${profile.endPoints.asset}/asset-file/file-original`])
    expect(item).toMatchObject({
      isDuplicate: true,
      assetId: 'asset-original',
      duplicateAssetId: 'asset-original',
      fileId: 'file-original',
      customData: { description: 'of the original' },
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    await noFurtherRead()
  })

  it('failed: the row fails with the reason of the file, and has no form', async () => {
    const item = await waitingRow(profile)
    const store = useUploadQueuesStore()

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidSize })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      isDuplicate: false,
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidSize },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    await noFurtherRead()
  })

  const notYet: Array<[string, () => AssetDetailItemDto]> = [
    ['a file still uploading', () => dam.fileBecomes('asset-1', AssetFileProcessStatus.Uploading)],
    ['a file uploaded and not yet stored', () => dam.fileBecomes('asset-1', AssetFileProcessStatus.Uploaded)],
    ['a file stored and not yet processed', () => dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored)],
    [
      'an asset without a main file',
      () => {
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
        const asset = dam.assets.get('asset-1')!
        asset.mainFile = null
        return asset
      },
    ],
    [
      'a main file without attributes',
      () => {
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
        const asset = dam.assets.get('asset-1')!
        delete (asset.mainFile as { fileAttributes?: unknown }).fileAttributes
        return asset
      },
    ],
    [
      'no answer',
      () => {
        dam.reply((request) => (dam.routes.one.test(request.url) ? { status: 502 } : undefined))
        dam.reply((request) => (dam.routes.byIds.test(request.url) ? { status: 502 } : undefined))
        return dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
      },
    ],
  ]
  it.each(notYet)('%s: the row waits on, and is asked about again', async (_what, answer) => {
    const item = await waitingRow(profile)
    const fileBefore = item.fileId

    answer()
    await nextRead()

    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      assetId: 'asset-1',
      fileId: fileBefore,
      isDuplicate: false,
      customData: {},
      canEditMetadata: false,
      error: { hasError: false, message: '' },
    })
    expect(useUploadQueuesStore().getQueueProcessedCount(QUEUE)).toBe(0)
    await nextRead()
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
  })

  it('a duplicate whose original cannot be read: the row fails', async () => {
    const item = await waitingRow(profile)

    // No asset has the file the duplicate names.
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-gone' })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({ assetId: 'asset-1', isDuplicate: false, canEditMetadata: false })
    expect(item.error.hasError).toBe(true)
    await noFurtherRead()
  })

  describe('and a row taken out of the queue while it waits', () => {
    it.each([
      ['removed', (_item: UploadQueueItem) => useUploadQueuesStore().removeByIndex(QUEUE, 0)],
      ['stopped', (item: UploadQueueItem) => useUploadQueuesStore().stopItemUpload(QUEUE, item, 0)],
      ['stopped with the whole queue', (_item: UploadQueueItem) => useUploadQueuesStore().stopUpload(QUEUE)],
    ])('%s: is not asked about any more', async (_how, takeOut) => {
      const item = await waitingRow(profile)
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed)
      const reads = dam.assetReads().length

      await takeOut(item)
      await waits.elapseAll()

      expect(dam.assetReads()).toHaveLength(reads)
      expect(useUploadQueuesStore().getQueueItems(QUEUE)).toEqual([])
      expect(item.status).toBe(UploadQueueItemStatus.Stop)
    })

    it('removed while its read is on the way: is left as it is, and not asked about again', async () => {
      const item = await waitingRow(profile)
      const read = dam.hold('GET', dam.routes.one)
      const batch = dam.hold('GET', dam.routes.byIds)
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
      await waits.elapse()
      await vi.waitFor(() => expect(read.waiting.length + batch.waiting.length).toBe(1))
      const reads = dam.assetReads().length

      useUploadQueuesStore().removeByIndex(QUEUE, 0)
      read.release()
      batch.release()
      await waits.settle()
      await waits.elapseAll()

      expect(dam.assetReads()).toHaveLength(reads)
      expect(item.status).toBe(UploadQueueItemStatus.Stop)
    })
  })
})
