import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damImageLinks, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { DamAssetStatus } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The upload as admin-ugc has it: no notification ever comes, and a file the server has processed is found by
// asking for its asset. Nothing of the library is replaced here: the requests go to a client that records them,
// and only the long waits between two reads are taken out of real time.

const { extSystem, licence, endPoints } = ugcConfiguration
const QUEUE = 'ugc-queue'

let dam: FakeDam
let waits: LongWaits
let socket: DamSocket

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(ugcConfiguration, dam.client)
  waits = holdLongWaits()
  socket = stubDamSocket()
})
afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  socket.restore()
  useDamNotificationsEventBus().reset()
})

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const fromTheServer = {
  metadata: {
    customData: { description: 'from the server', author: 'A. Author' },
    authorSuggestions: {},
    keywordSuggestions: {},
  },
  mainFileSingleUse: true,
  mainFileInternal: false,
}

describe('an uploaded file no notification ever announces', () => {
  it('is settled by a read of its asset, with the metadata that read brought', async () => {
    const store = useUploadQueuesStore()
    const finish = dam.hold('PATCH', dam.routes.finish)

    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg')])
    await vi.waitFor(() => expect(finish.waiting).toHaveLength(1))
    const [item] = store.getQueueItems(QUEUE)
    expect(item).toMatchObject({
      type: UploadQueueItemType.File,
      status: UploadQueueItemStatus.Uploading,
      assetId: 'asset-1',
      fileId: 'file-1',
      canEditMetadata: false,
    })
    expect(dam.sentTo('POST', dam.routes.start).map((request) => request.url)).toEqual([
      `/ugc/v1/image/licence/${licence}`,
    ])

    finish.release()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    expect(store.getQueueProcessedCount(QUEUE)).toBe(0)

    // The server is done with the file; the queue learns it the next time it asks.
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer, { links: damImageLinks('file-1') })
    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(item).toMatchObject({
      assetId: 'asset-1',
      fileId: 'file-1',
      isDuplicate: false,
      assetStatus: DamAssetStatus.WithFile,
      imagePreview: damImageLinks('file-1').image_detail,
      customData: { description: 'from the server', author: 'A. Author' },
      keywords: [],
      authors: [],
      authorConflicts: [],
      mainFileSingleUse: true,
      mainFileInternal: false,
      canEditMetadata: true,
      error: { hasError: false, message: '' },
    })
    expect(store.getQueueProcessedCount(QUEUE)).toBe(store.getQueueTotalCount(QUEUE))

    // It was asked for under the configured asset endpoint, by the asset of the row.
    const reads = dam.assetReads()
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every((read) => read.url.startsWith('/ugc/v1/asset/') && read.url.includes('asset-1'))).toBe(true)
    // And once settled, no more.
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads.length)

    expect(dam.requests.filter((request) => !request.url.startsWith('/ugc/v1/'))).toEqual([])
    expect(dam.unanswered).toEqual([])
    expect(socket.sockets).toEqual([])
  })

  it('goes on waiting while its file is not processed yet, and is settled by the read that finds it so', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg')])
    const [item] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Stored)
    await waits.elapse()
    await vi.waitFor(() => expect(dam.assetReads().length).toBeGreaterThan(0))
    await waits.settle()
    const readsWhileStored = dam.assetReads().length
    expect(item).toMatchObject({
      status: UploadQueueItemStatus.Processing,
      canEditMetadata: false,
      customData: {},
      error: { hasError: false },
    })

    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
    await waits.elapse()
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(dam.assetReads().length).toBeGreaterThan(readsWhileStored)
    expect(item).toMatchObject({
      fileId: 'file-1',
      customData: { description: 'from the server', author: 'A. Author' },
      canEditMetadata: true,
    })
  })

  it('makes room for the next file as soon as it is sent, not when it is settled', async () => {
    const store = useUploadQueuesStore()
    const chunks = dam.hold('POST', dam.routes.chunk)
    const statuses = () => store.getQueueItems(QUEUE).map((item) => item.status)

    await store.addByFiles(QUEUE, extSystem, licence, [photo('a.jpg'), photo('b.jpg'), photo('c.jpg')])
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
    expect(statuses()).toEqual([
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Waiting,
    ])
    expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(2)

    chunks.waiting.find((held) => dam.chunkOf(held.request) === 'a.jpg')!.release()
    await vi.waitFor(() => expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(3))

    expect(statuses()).toEqual([
      UploadQueueItemStatus.Processing,
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Uploading,
    ])
    expect(store.getQueueProcessedCount(QUEUE)).toBe(0)
  })
})
