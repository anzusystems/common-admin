import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  CONSUMER_DAM_SOCKET_URL,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, damImageLinks, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { rowState } from '@/domains/dam/__tests__/support/uploadQueueRow'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// What the notification server does to an upload of admin-cms, from the frame on the socket to the row. The
// socket is a stub of the global `WebSocket`, the DAM a client that records its requests; nothing of the library
// is replaced. admin-ugc has no socket: its half is the last case.

const QUEUE = 'profile-queue'

let dam: FakeDam
let waits: LongWaits
let socket: DamSocket

const photo = () => new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
const fromTheServer = {
  metadata: {
    customData: { title: 'from the server' },
    authorSuggestions: {},
    keywordSuggestions: {},
  },
  mainFileSingleUse: true,
  mainFileInternal: false,
}
// The metadata notification may come to be read with a delay of its own.
const SOON = { timeout: 5000 }

const realScheduler = uploadSettlementRuntime.scheduler

afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  uploadSettlementRuntime.scheduler = realScheduler
  destroyDamNotifications()
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
})

describe('an upload under the CMS configuration, with the notification socket open', () => {
  const { endPoints, extSystem, licence } = cmsConfiguration

  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(endPoints)
    installConsumerProfile(cmsConfiguration, dam.client)
    waits = holdLongWaits()
    socket = stubDamSocket()
    initDamNotifications().openConnection()
    socket.accept()
  })

  /** One file, sent whole: the row waits for the server to process it. */
  const uploadOne = async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()])
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    return { store, item }
  }
  const underOwnAssetEndPoint = () => dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))

  it('connects to the configured address', () => {
    expect(socket.sockets.map((one) => one.url)).toEqual([CONSUMER_DAM_SOCKET_URL])
  })

  it('gets its form with the metadata notification and is settled by the file notification', async () => {
    const { store, item } = await uploadOne()
    // The metadata is read off the file before the file is processed.
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored, fromTheServer)

    socket.deliver(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)
    // Its form is there while the file is still being processed.
    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      customData: { title: 'from the server' },
      mainFileSingleUse: true,
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(0)

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer, { links: damImageLinks('file-1') })
    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      fileId: 'file-1',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      customData: { title: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(dam.assetReads().length).toBeGreaterThan(0)
    expect(underOwnAssetEndPoint()).toBe(true)
    expect(dam.unanswered).toEqual([])

    // Settled by its notifications, the row is not asked about any more.
    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  it('is settled by the file notification and gets its form with the metadata notification after it', async () => {
    const { store, item } = await uploadOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer, { links: damImageLinks('file-1') })

    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    // Uploaded, and still without the metadata: the form waits for its own notification.
    expect(item).toMatchObject({
      canEditMetadata: false,
      customData: {},
      imagePreview: damImageLinks('file-1').image_detail,
      mainFileSingleUse: true,
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))

    socket.deliver(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true), SOON)

    expect(item).toMatchObject({ status: UploadQueueItemStatus.Uploaded, customData: { title: 'from the server' } })
    expect(underOwnAssetEndPoint()).toBe(true)

    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  it('becomes the original on the duplicate notification', async () => {
    const { item } = await uploadOne()
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, {
        metadata: { customData: { title: 'of the original' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )

    socket.deliver(DamNotificationName.AssetFileDuplicate, {
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
      customData: { title: 'of the original' },
      canEditMetadata: true,
    })
  })

  it('fails with the reason of the failed notification', async () => {
    const { store, item } = await uploadOne()

    socket.deliver(DamNotificationName.AssetFileFailed, {
      asset: 'asset-1',
      id: 'file-1',
      failReason: AssetFileFailReason.InvalidChecksum,
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      canEditMetadata: false,
      error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidChecksum },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
  })

  // The client gave the upload up, and the server finished it all the same.
  it('is an uploaded row with its metadata when its finish request failed and the file notification comes', async () => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
    )
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()])
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)

    socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      customData: { title: 'from the server' },
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(underOwnAssetEndPoint()).toBe(true)
  })

  describe('and a frame the queue does not act on', () => {
    // A read the queue asks for on a notification is due a quarter of a second after it, or two seconds: "asks
    // for nothing" is said once the time of the queue has moved past both, which a clock of the test does at
    // once. The first read of the poll is further off.
    const PAST_ANY_READ_OF_A_NOTIFICATION = 3000
    let clock: ManualScheduler
    beforeEach(() => {
      clock = manualScheduler()
      uploadSettlementRuntime.scheduler = clock
    })

    it.each([
      DamNotificationName.AssetFileUploaded,
      DamNotificationName.AssetFileDeleted,
      DamNotificationName.AssetDeleted,
      DamNotificationName.DistributionDistributing,
      DamNotificationName.DistributionRemoteProcessing,
      DamNotificationName.DistributionDistributed,
      DamNotificationName.DistributionFailed,
      DamNotificationName.DistributionAuthorized,
      'a_name_of_tomorrow',
    ])('%s: changes nothing and asks for nothing', async (name) => {
      const { item } = await uploadOne()
      const before = rowState(item)
      const requests = dam.requests.length

      socket.deliver(name, { asset: 'asset-1', id: 'file-1', assetFile: 'file-1', status: 'processed' })
      await clock.advance(PAST_ANY_READ_OF_A_NOTIFICATION)

      expect(rowState(item)).toEqual(before)
      expect(dam.requests).toHaveLength(requests)
    })

    it('user_updated, which carries no data: changes nothing and asks for nothing', async () => {
      const { item } = await uploadOne()
      const before = rowState(item)
      const requests = dam.requests.length

      socket.deliver(DamNotificationName.UserUpdated)
      await clock.advance(PAST_ANY_READ_OF_A_NOTIFICATION)

      expect(rowState(item)).toEqual(before)
      expect(dam.requests).toHaveLength(requests)
    })

    it.each([
      DamNotificationName.AssetFileProcessed,
      DamNotificationName.AssetFileFailed,
      DamNotificationName.AssetFileDuplicate,
      DamNotificationName.AssetMetadataProcessed,
      DamNotificationName.AssetFileCopied,
    ])('%s for an asset of no row: changes nothing and asks for nothing', async (name) => {
      const { item } = await uploadOne()
      dam.assets.set(
        'asset-of-another-tab',
        damAssetWithFile('asset-of-another-tab', 'file-of-another-tab', AssetFileProcessStatus.Processed, fromTheServer)
      )
      const before = rowState(item)
      const requests = dam.requests.length

      socket.deliver(name, {
        asset: 'asset-of-another-tab',
        id: 'file-of-another-tab',
        failReason: AssetFileFailReason.Unknown,
        originAssetFile: 'file-of-another-tab',
        assetType: DamAssetType.Image,
      })
      await clock.advance(PAST_ANY_READ_OF_A_NOTIFICATION)

      expect(rowState(item)).toEqual(before)
      expect(dam.requests).toHaveLength(requests)
      expect(dam.requests.filter((request) => !request.url.startsWith('/adm/v1/'))).toEqual([])
      expect(dam.unanswered).toEqual([])
    })
  })
})

describe('the notification socket under the UGC configuration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(ugcConfiguration.endPoints)
    installConsumerProfile(ugcConfiguration, dam.client)
    waits = holdLongWaits()
    socket = stubDamSocket()
  })

  // admin-ugc never asks for it; a library component that did would open nothing.
  it('is never opened, also when it is asked for', () => {
    const notifications = initDamNotifications()
    notifications.openConnection()

    expect(socket.sockets).toEqual([])
    expect(notifications.status.value).toBe('CLOSED')
  })
})
