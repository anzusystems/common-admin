import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  CONSUMER_DAM_SOCKET_URL,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, damImageLinks, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetStatus } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The upload of one file as each of the two applications has it configured, from the picked file to the settled
// row, when no notification comes: all admin-ugc has, and what admin-cms falls back on. Nothing of the library is
// replaced: the requests go to a client that records them, the socket admin-cms opens at start-up is a stub that
// stays silent, and only the long waits between two reads are taken out of real time. What the notifications do
// to an upload is in `consumerProfileNotifications.test.ts`.

const QUEUE = 'profile-queue'

let dam: FakeDam
let waits: LongWaits
let socket: DamSocket

const bytes = Uint8Array.from({ length: 3000 }, (_, index) => index % 251)
const photo = (name = 'photo.jpg') => new File([bytes], name, { type: 'image/jpeg' })
const sha1 = async (data: BufferSource) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')

const fromTheServer = {
  metadata: {
    customData: { description: 'from the server' },
    authorSuggestions: {},
    keywordSuggestions: {},
  },
  mainFileSingleUse: false,
  mainFileInternal: false,
}

describe.each(consumerProfiles)('an upload under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const ownPrefix = endPoints.asset.replace(/\/asset$/, '/')

  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits()
    socket = stubDamSocket()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
  })
  afterEach(() => {
    useUploadQueuesStore().stopUpload(QUEUE)
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  /** One file, sent whole: the row waits for the server to process it. */
  const uploadOne = async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()])
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    return { store, item }
  }
  /** Time passes until the queue has asked for the asset once more. */
  const nextRead = async () => {
    const before = dam.assetReads().length
    await waits.elapse()
    await vi.waitFor(() => expect(dam.assetReads().length).toBeGreaterThan(before))
    await waits.settle()
  }
  const outsideOwnPrefix = () => dam.requests.filter((request) => !request.url.startsWith(ownPrefix))

  it('sends the file to the image endpoint of the configuration: start, chunk, finish', async () => {
    await uploadOne()

    const sent = dam.requests.filter((request) => request.url.startsWith(endPoints.image))
    expect(sent.map((request) => `${request.method} ${request.url}`)).toEqual([
      `POST ${endPoints.image}/licence/${licence}`,
      `POST ${endPoints.image}/file-1/chunk`,
      `PATCH ${endPoints.image}/file-1/uploaded`,
    ])
    const [start, chunk, finish] = sent
    expect(dam.body(start)).toEqual({ mimeType: 'image/jpeg', size: 3000 })

    const form = chunk.data as FormData
    const part = form.get('file') as File
    expect([part.name, part.type, part.size]).toEqual(['photo.jpg', 'image/jpeg', 3000])
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes)
    expect(form.get('chunk')).toBe('{"offset":0,"size":3000}')
    expect(chunk.config.timeout).toBe(420_000)

    // The checksum of what was sent, not a made-up one.
    expect(dam.body(finish)).toEqual({ checksum: await sha1(bytes) })

    expect(dam.requests.filter((request) => request.url.startsWith(foreignPrefix))).toEqual([])
    expect(dam.unanswered).toEqual([])
  })

  it('opens the notification socket only where the application has one', () => {
    expect(socket.sockets.map((one) => one.url)).toEqual(profile.notifications ? [CONSUMER_DAM_SOCKET_URL] : [])
  })

  // The only way admin-ugc has, and what admin-cms falls back on when a notification is lost.
  it('is settled, metadata included, by a read of its asset when nobody announces it', async () => {
    const { store, item } = await uploadOne()

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer, { links: damImageLinks('file-1') })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      assetId: 'asset-1',
      fileId: 'file-1',
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      customData: { description: 'from the server' },
      mainFileSingleUse: false,
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(dam.assetReads().every((read) => read.url.startsWith(`${endPoints.asset}/`))).toBe(true)
    expect(outsideOwnPrefix()).toEqual([])
    expect(dam.unanswered).toEqual([])

    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  it('becomes the original when a read finds its file to be a duplicate', async () => {
    const { store, item } = await uploadOne()
    dam.assets.set(
      'asset-original',
      damAssetWithFile(
        'asset-original',
        'file-original',
        AssetFileProcessStatus.Processed,
        {
          metadata: {
            customData: { description: 'of the original' },
            authorSuggestions: {},
            keywordSuggestions: {},
          },
          mainFileSingleUse: true,
        },
        { links: damImageLinks('file-original') }
      )
    )

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(dam.originReads().map((read) => read.url)).toEqual([`${endPoints.asset}/asset-file/file-original`])
    expect(item).toMatchObject({
      isDuplicate: true,
      assetId: 'asset-original',
      duplicateAssetId: 'asset-original',
      fileId: 'file-original',
      imagePreview: damImageLinks('file-original').image_detail,
      customData: { description: 'of the original' },
      mainFileSingleUse: true,
      canEditMetadata: true,
      error: { hasError: false },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(outsideOwnPrefix()).toEqual([])
  })

  it('fails, with the reason, when a read finds its file failed', async () => {
    const { store, item } = await uploadOne()

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
    await nextRead()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))

    expect(item).toMatchObject({
      canEditMetadata: false,
      error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.InvalidMimeType },
    })
    // The queue counts as finished: nothing is left to wait for.
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    expect(outsideOwnPrefix()).toEqual([])

    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  describe('whose finish request fails', () => {
    const failedAtFinish = async () => {
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 502 } : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo()])
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
      return { store, item }
    }

    it('is a failed row without a form, and the queue counts as finished', async () => {
      const { store, item } = await failedAtFinish()

      expect(item).toMatchObject({
        assetId: 'asset-1',
        fileId: 'file-1',
        canEditMetadata: false,
        error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.None },
      })
      expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
    })

    // The server may have finished the file all the same, and without a notification only a read finds that out.
    it('is asked about all the same, and is uploaded with its form once the server has finished the file', async () => {
      const { store, item } = await failedAtFinish()

      await nextRead()
      expect(item).toMatchObject({ status: UploadQueueItemStatus.Failed, canEditMetadata: false })

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await nextRead()
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

      expect(item).toMatchObject({
        fileId: 'file-1',
        customData: { description: 'from the server' },
        canEditMetadata: true,
        error: { hasError: false, message: '' },
      })
      expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))
      expect(outsideOwnPrefix()).toEqual([])

      const reads = dam.assetReads().length
      await waits.elapseAll()
      expect(dam.assetReads()).toHaveLength(reads)
    })
  })
})
