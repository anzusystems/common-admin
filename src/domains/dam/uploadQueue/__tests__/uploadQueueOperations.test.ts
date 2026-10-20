import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { rowState } from '@/domains/dam/__tests__/support/uploadQueueRow'
import {
  type DamNotification,
  DamNotificationName,
  type DamNotificationNameType,
  useDamNotificationsEventBus,
} from '@/domains/dam/composables/damNotificationsEventBus'
import { bulkUpdateAssetsMetadata } from '@/domains/dam/api/damAssetApi'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// What a widget and the upload dialog do to a queue: add files, add copies, stop one row, stop all, remove a
// row, take over what the asset detail saved. The real store with the real upload under it; the DAM is a client
// that records its requests, and a chunk request held back keeps a file "being sent" for as long as a case needs.
// The configuration is that of admin-cms: nothing here depends on which application it is.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'operations-queue'
const OTHER_QUEUE = 'operations-queue-of-another-widget'

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  answerDamNames(dam)
  waits = holdLongWaits()
})
afterEach(async () => {
  const store = useUploadQueuesStore()
  store.stopUpload(QUEUE)
  store.stopUpload(OTHER_QUEUE)
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const notify = (name: DamNotificationNameType, data: Record<string, unknown>) =>
  useDamNotificationsEventBus().emit({ name, data } as unknown as DamNotification)
const file = (name: string, type = 'image/jpeg') => new File([new Uint8Array(3000)], name, { type })
const photos = (...names: string[]) => names.map((name) => file(`${name}.jpg`))
const statuses = (queue = QUEUE) =>
  useUploadQueuesStore()
    .getQueueItems(queue)
    .map((item) => item.status)
const titles = (queue = QUEUE) =>
  useUploadQueuesStore()
    .getQueueItems(queue)
    .map((item) => item.displayTitle)
const counts = (queue = QUEUE) => {
  const store = useUploadQueuesStore()
  return { total: store.getQueueTotalCount(queue), processed: store.getQueueProcessedCount(queue) }
}
const starts = () => dam.sentTo('POST', dam.routes.start)
const finishes = () => dam.sentTo('PATCH', dam.routes.finish)
const { Waiting, Uploading, Processing, Uploaded, Failed, Stop } = UploadQueueItemStatus

/** Three files in the queue with the chunk requests held back: two are being sent, the third waits its turn. */
const twoSendingOneWaiting = async () => {
  const store = useUploadQueuesStore()
  const chunks = dam.hold('POST', dam.routes.chunk)
  await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b', 'c'), 'default')
  await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
  expect(statuses()).toEqual([Uploading, Uploading, Waiting])
  return { store, chunks, items: [...store.getQueueItems(QUEUE)] }
}

describe('files added to a queue', () => {
  it('become a row each, named after the file, in the licence given, and start to be sent two at a time', async () => {
    const { store } = await twoSendingOneWaiting()

    expect(store.getQueueItems(QUEUE)).toMatchObject(
      ['a.jpg', 'b.jpg', 'c.jpg'].map((displayTitle) => ({
        type: UploadQueueItemType.File,
        assetType: DamAssetType.Image,
        displayTitle,
        licenceId: licence,
        isDuplicate: false,
        canEditMetadata: false,
        keywords: [],
        authors: [],
        customData: {},
        error: { hasError: false, message: '' },
      }))
    )
    expect(store.getQueueItems(QUEUE).map((item) => item.file?.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
    expect(counts()).toEqual({ total: 3, processed: 0 })
    expect(starts().map((request) => request.url)).toEqual([
      `/adm/v1/image/licence/${licence}`,
      `/adm/v1/image/licence/${licence}`,
    ])
    expect(store.getQueueItemsTypes(QUEUE)).toEqual([DamAssetType.Image])
  })

  it('are added after the rows the queue already has', async () => {
    const { store } = await twoSendingOneWaiting()

    await store.addByFiles(QUEUE, extSystem, licence, photos('d'), 'default')

    expect(titles()).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'])
    expect(statuses()).toEqual([Uploading, Uploading, Waiting, Waiting])
    expect(counts()).toEqual({ total: 4, processed: 0 })
  })

  // The dialog tells its rows apart by their key, and a name is not one: the same file can be picked twice, and
  // two folders can each have a `photo.jpg`.
  it('have a key each, two files of one name too', async () => {
    const store = useUploadQueuesStore()
    dam.hold('POST', dam.routes.chunk)

    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'a', 'b'), 'default')
    await store.addByFiles(QUEUE, extSystem, licence, photos('a'), 'default')
    await store.addByFiles(OTHER_QUEUE, extSystem, licence, photos('a'), 'default')

    expect(titles()).toEqual(['a.jpg', 'a.jpg', 'b.jpg', 'a.jpg'])
    const keys = [...store.getQueueItems(QUEUE), ...store.getQueueItems(OTHER_QUEUE)].map((item) => item.key)
    expect(new Set(keys).size).toBe(5)
    expect(keys.every((key) => key.length > 0)).toBe(true)
  })

  // What the ext system does not list as an image is left out without a word: the widget's file input and
  // dropzone are what tells the user, before the files get here.
  it('are left out when the ext system does not list their type as an image', async () => {
    const config = useDamConfigStore().damConfigExtSystem.get(extSystem)!
    useDamConfigStore().damConfigExtSystem.set(extSystem, {
      ...config,
      audio: { enabled: true, sizeLimit: 1, mimeTypes: ['audio/mpeg'], customMetadataPinnedAmount: 0, slots: [] },
    })
    const store = useUploadQueuesStore()
    dam.hold('POST', dam.routes.chunk)

    await store.addByFiles(
      QUEUE,
      extSystem,
      licence,
      [
        file('scan.tiff', 'image/tiff'),
        file('listed.png', 'image/png'),
        file('paper.pdf', 'application/pdf'),
        // A type the ext system knows, and not an image: the library uploads images only.
        file('song.mp3', 'audio/mpeg'),
        file('untyped', ''),
      ],
      'default'
    )

    expect(titles()).toEqual(['listed.png'])
    expect(counts()).toEqual({ total: 1, processed: 0 })
  })

  it('are refused when the configuration of the ext system is not loaded', async () => {
    const store = useUploadQueuesStore()

    await expect(store.addByFiles(QUEUE, 999, licence, photos('a'), 'default')).rejects.toThrow(
      'Ext system must be initialised'
    )

    expect(store.getQueue(QUEUE)).toBeNull()
    expect(dam.requests).toEqual([])
  })

  it('of two widgets are two queues: each has its own rows, its own counts and its own two uploads at a time', async () => {
    const store = useUploadQueuesStore()
    const chunks = dam.hold('POST', dam.routes.chunk)

    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b', 'c'), 'default')
    await store.addByFiles(OTHER_QUEUE, extSystem, licence, photos('x', 'y', 'z'), 'default')
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(4))

    expect([titles(QUEUE), titles(OTHER_QUEUE)]).toEqual([
      ['a.jpg', 'b.jpg', 'c.jpg'],
      ['x.jpg', 'y.jpg', 'z.jpg'],
    ])
    expect([statuses(QUEUE), statuses(OTHER_QUEUE)]).toEqual([
      [Uploading, Uploading, Waiting],
      [Uploading, Uploading, Waiting],
    ])
    expect([counts(QUEUE), counts(OTHER_QUEUE)]).toEqual([
      { total: 3, processed: 0 },
      { total: 3, processed: 0 },
    ])

    // Stopping one leaves the other as it is.
    store.stopUpload(QUEUE)
    await waits.settle()
    expect([statuses(QUEUE), statuses(OTHER_QUEUE)]).toEqual([[], [Uploading, Uploading, Waiting]])
  })
})

describe('assets copied to the licence, added to a queue', () => {
  it('become a row each that waits for the server, known by its asset alone', async () => {
    const store = useUploadQueuesStore()

    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy-1', 'asset-copy-2'], 'default')

    expect(store.getQueueItems(QUEUE)).toMatchObject(
      ['asset-copy-1', 'asset-copy-2'].map((assetId) => ({
        type: UploadQueueItemType.Asset,
        status: Processing,
        assetType: DamAssetType.Image,
        assetId,
        fileId: null,
        file: null,
        displayTitle: '',
        licenceId: licence,
        isDuplicate: false,
        canEditMetadata: false,
        error: { hasError: false, message: '' },
      }))
    )
    expect(counts()).toEqual({ total: 2, processed: 0 })
    // Nothing is sent for them.
    expect(dam.requests.filter((request) => request.url.startsWith(endPoints.image))).toEqual([])
  })

  // A copy that already exists in the licence answers with the asset it is: picked twice, it is added twice.
  it('have a key each, an asset added twice too', async () => {
    const store = useUploadQueuesStore()

    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy-1', 'asset-copy-2'], 'default')
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy-1'], 'default')

    const items = store.getQueueItems(QUEUE)
    expect(items.map((item) => item.assetId)).toEqual(['asset-copy-1', 'asset-copy-2', 'asset-copy-1'])
    expect(new Set(items.map((item) => item.key)).size).toBe(3)
  })

  it('do not take the place of a file that waits to be sent', async () => {
    const { store } = await twoSendingOneWaiting()

    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-copy-1'], 'default')

    expect(statuses()).toEqual([Uploading, Uploading, Waiting, Processing])
    expect(starts()).toHaveLength(2)
  })

  it('are refused when the configuration of the ext system is not loaded', async () => {
    const store = useUploadQueuesStore()

    await expect(store.addByCopyToLicence(QUEUE, 999, licence, ['asset-copy-1'], 'default')).rejects.toThrow(
      'Ext system must be initialised'
    )

    expect(store.getQueue(QUEUE)).toBeNull()
  })
})

// A queue is a list of rows, not a map by asset: one asset can be in it twice. A copy that already exists in the
// licence answers with the asset it is, so picked twice it is two rows; and two uploaded files that both turn out
// to be duplicates of one original are two rows of that original. Whatever happens to the asset happens to both.
describe('one asset in two rows of a queue', () => {
  const fromTheServer = {
    metadata: { customData: { title: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  }
  /** The same asset copied to the licence twice: two rows that wait for the server. */
  const copiedTwice = async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')
    const [first, second] = store.getQueueItems(QUEUE)
    expect([first.assetId, second.assetId, first === second]).toEqual(['asset-1', 'asset-1', false])
    return { store, first, second }
  }
  const bothUploaded = {
    status: Uploaded,
    assetId: 'asset-1',
    fileId: 'file-1',
    customData: { title: 'from the server' },
    canEditMetadata: true,
    error: { hasError: false, message: '' },
  }

  it('its copied notification settles both rows, each with the file, the metadata and the form', async () => {
    const { first, second } = await copiedTwice()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, fromTheServer))

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Uploaded, Uploaded]))

    expect(first).toMatchObject(bothUploaded)
    expect(second).toMatchObject(bothUploaded)
    expect(counts()).toEqual({ total: 2, processed: 2 })
  })

  it('a read of it settles both rows when no notification comes, and neither is asked about again', async () => {
    const { first, second } = await copiedTwice()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, fromTheServer))

    await waits.elapse()
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Uploaded, Uploaded]))

    expect(first).toMatchObject(bothUploaded)
    expect(second).toMatchObject(bothUploaded)
    expect(counts()).toEqual({ total: 2, processed: 2 })
    expect(dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))).toBe(true)
    const reads = dam.assetReads().length
    await waits.elapseAll()
    expect(dam.assetReads()).toHaveLength(reads)
  })

  it('its failed notification fails both rows', async () => {
    const { first, second } = await copiedTwice()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Failed))

    notify(DamNotificationName.AssetFileFailed, {
      asset: 'asset-1',
      id: 'file-1',
      failReason: AssetFileFailReason.InvalidSize,
    })
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Failed, Failed]))

    for (const item of [first, second]) {
      expect(item).toMatchObject({
        canEditMetadata: false,
        error: { hasError: true, assetFileFailReason: AssetFileFailReason.InvalidSize },
      })
    }
    expect(counts()).toEqual({ total: 2, processed: 2 })
  })

  it('a file found to be a duplicate makes both rows the original', async () => {
    const { first, second } = await copiedTwice()
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
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Uploaded, Uploaded]))

    for (const item of [first, second]) {
      expect(item).toMatchObject({
        isDuplicate: true,
        assetId: 'asset-original',
        fileId: 'file-original',
        customData: { title: 'from the server' },
        canEditMetadata: true,
      })
    }
  })

  // The rows are told apart by what they are, not by their asset: one can go and the other stays.
  it('one of the two stopped: the other waits on and is settled by a read, the stopped one is not', async () => {
    const { store, first, second } = await copiedTwice()

    await store.stopItemUpload(QUEUE, first)
    expect(store.getQueueItems(QUEUE)).toEqual([second])
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, fromTheServer))
    await waits.elapse()
    await vi.waitFor(() => expect(second.status).toBe(Uploaded))

    expect(second).toMatchObject(bothUploaded)
    expect(first).toMatchObject({ status: Stop, fileId: null, canEditMetadata: false })
    expect(counts()).toEqual({ total: 1, processed: 1 })
  })

  it('what the user typed into one row stays out of the other', async () => {
    const { first, second } = await copiedTwice()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, fromTheServer))
    notify(DamNotificationName.AssetMetadataProcessed, { asset: 'asset-1' })
    await vi.waitFor(() => expect([first.canEditMetadata, second.canEditMetadata]).toEqual([true, true]), {
      timeout: 5000,
    })
    // As the row's form writes: a new value, not a change of the one it was given.
    first.customData = { title: 'typed into the first' }

    notify(DamNotificationName.AssetFileCopied, { asset: 'asset-1', id: 'file-1' })
    await vi.waitFor(() => expect([first.status, second.status]).toEqual([Uploaded, Uploaded]))

    expect([first.customData, second.customData]).toEqual([
      { title: 'typed into the first' },
      { title: 'from the server' },
    ])
  })

  // The way one asset comes to be in a queue twice without any copy, in admin-ugc too: the same picture picked
  // twice, or two pictures the DAM already has as one.
  it('two files that turn out to be one original: both rows become it, and a save in its detail reaches both', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b'), 'default')
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    const [first, second] = store.getQueueItems(QUEUE)
    dam.assets.set(
      'asset-original',
      damAssetWithFile('asset-original', 'file-original', AssetFileProcessStatus.Processed, fromTheServer)
    )
    for (const item of [first, second]) {
      dam.fileBecomes(item.assetId!, AssetFileProcessStatus.Duplicate, {}, { originAssetFile: 'file-original' })
    }

    await waits.elapse()
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Uploaded]))
    for (const item of [first, second]) {
      expect(item).toMatchObject({
        isDuplicate: true,
        assetId: 'asset-original',
        fileId: 'file-original',
        customData: { title: 'from the server' },
        canEditMetadata: true,
      })
    }
    expect(counts()).toEqual({ total: 2, processed: 2 })

    const detail = dam.fileBecomes('asset-original', AssetFileProcessStatus.Processed, {
      metadata: { customData: { title: 'saved in the detail' }, authorSuggestions: {}, keywordSuggestions: {} },
    })
    await store.updateFromDetail(detail, 'default')

    expect([first.customData, second.customData]).toEqual([
      { title: 'saved in the detail' },
      { title: 'saved in the detail' },
    ])
  })
})

describe('one row stopped', () => {
  it('while its file is sent: the request is cancelled, the row is gone and the next file takes its place', async () => {
    const { store, chunks, items } = await twoSendingOneWaiting()
    const [first, second, third] = items
    const inFlight = chunks.waiting.find((held) => dam.chunkOf(held.request) === 'a.jpg')!.request.config
      .signal as AbortSignal

    await store.stopItemUpload(QUEUE, first, 0)

    expect(inFlight.aborted).toBe(true)
    expect(titles()).toEqual(['b.jpg', 'c.jpg'])
    await vi.waitFor(() => expect(starts()).toHaveLength(3))
    expect(statuses()).toEqual([Uploading, Uploading])
    expect(counts()).toEqual({ total: 2, processed: 0 })

    // And nothing more comes of it: the file is not finished.
    chunks.release()
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    expect(
      finishes()
        .map((request) => request.url)
        .sort()
    ).toEqual([second, third].map((item) => `/adm/v1/image/${item.fileId}/uploaded`).sort())
  })

  it('while it waits its turn: the row is gone and its file is never sent', async () => {
    const { store, chunks, items } = await twoSendingOneWaiting()

    await store.stopItemUpload(QUEUE, items[2], 2)

    expect(titles()).toEqual(['a.jpg', 'b.jpg'])
    expect(counts()).toEqual({ total: 2, processed: 0 })
    chunks.release()
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    await waits.settle()
    expect(starts()).toHaveLength(2)
    expect(items[2].status).toBe(Stop)
  })

  // The row hands over the position it was drawn at. By the time the queue acts on it the list can have changed:
  // it is the row handed over that goes, wherever it is by then.
  it.each([0, 1, 7])('with a position that is not its own (%s): that row goes, and no other', async (position) => {
    const { store, chunks, items } = await twoSendingOneWaiting()

    await store.stopItemUpload(QUEUE, items[2], position)

    expect(titles()).toEqual(['a.jpg', 'b.jpg'])
    expect(items.map((item) => item.status)).toEqual([Uploading, Uploading, Stop])
    expect(chunks.waiting.map((held) => (held.request.config.signal as AbortSignal).aborted)).toEqual([false, false])
    expect(counts()).toEqual({ total: 2, processed: 0 })
  })

  it('after it has left the queue: no row goes in its place', async () => {
    const { store, items } = await twoSendingOneWaiting()
    store.removeByIndex(QUEUE, 2)
    expect(titles()).toEqual(['a.jpg', 'b.jpg'])

    await store.stopItemUpload(QUEUE, items[2], 0)

    expect(titles()).toEqual(['a.jpg', 'b.jpg'])
    expect(statuses()).toEqual([Uploading, Uploading])
    expect(counts()).toEqual({ total: 2, processed: 0 })
  })
})

describe('a queue stopped', () => {
  it('cancels what is being sent, starts nothing more and is left empty, with a file input to match', async () => {
    const { store, chunks, items } = await twoSendingOneWaiting()
    const inFlight = chunks.waiting.map((held) => held.request.config.signal as AbortSignal)
    const fileInputKey = store.getQueue(QUEUE)!.fileInputKey

    store.stopUpload(QUEUE)

    expect(items.map((item) => item.status)).toEqual([Stop, Stop, Stop])
    expect(inFlight.map((signal) => signal.aborted)).toEqual([true, true])
    expect(store.getQueueItems(QUEUE)).toEqual([])
    expect(counts()).toEqual({ total: 0, processed: 0 })
    expect(store.getQueueItemsTypes(QUEUE)).toEqual([])
    // The file input is keyed by it: a new key is an input that has forgotten the files picked before.
    expect(store.getQueue(QUEUE)!.fileInputKey).toBeGreaterThan(fileInputKey)

    await waits.settle(150)
    expect(starts()).toHaveLength(2)
    expect(finishes()).toEqual([])
    expect(store.getQueueItems(QUEUE)).toEqual([])
  })

  it('takes new files as a queue that was never used', async () => {
    const { store, chunks } = await twoSendingOneWaiting()
    store.stopUpload(QUEUE)
    await waits.settle()

    await store.addByFiles(QUEUE, extSystem, licence, photos('d'), 'default')
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

    expect(titles()).toEqual(['d.jpg'])
    expect(statuses()).toEqual([Uploading])
    expect(counts()).toEqual({ total: 1, processed: 0 })
  })

  it('does nothing to a queue that is empty, or was never made', async () => {
    const { store } = await twoSendingOneWaiting()
    store.stopUpload(QUEUE)
    const fileInputKey = store.getQueue(QUEUE)!.fileInputKey

    store.stopUpload(QUEUE)
    store.stopUpload(OTHER_QUEUE)

    expect(store.getQueue(QUEUE)!.fileInputKey).toBe(fileInputKey)
    expect(store.getQueue(OTHER_QUEUE)).toBeNull()
    expect([store.getQueueItems(OTHER_QUEUE), store.getQueueItemsTypes(OTHER_QUEUE)]).toEqual([[], []])
    expect(counts(OTHER_QUEUE)).toEqual({ total: 0, processed: 0 })
  })
})

describe('a row removed from a queue', () => {
  /** Two files sent whole; the first is settled as uploaded, the second still waits for the server. */
  const oneUploadedOneProcessing = async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b'), 'default')
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing]))
    const items = [...store.getQueueItems(QUEUE)]
    dam.fileBecomes(items[0].assetId!, AssetFileProcessStatus.Processed)
    notify(DamNotificationName.AssetFileProcessed, { asset: items[0].assetId, id: items[0].fileId })
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Processing]))
    expect(counts()).toEqual({ total: 2, processed: 1 })
    return { store, items }
  }

  it('that is uploaded: stays an uploaded row to whoever holds it, and the counts follow', async () => {
    const { store, items } = await oneUploadedOneProcessing()

    store.removeByIndex(QUEUE, 0)

    expect(titles()).toEqual(['b.jpg'])
    expect(items[0].status).toBe(Uploaded)
    expect(counts()).toEqual({ total: 1, processed: 0 })
  })

  it('that still waits for the server: the queue then counts as finished', async () => {
    const { store } = await oneUploadedOneProcessing()

    store.removeByIndex(QUEUE, 1)

    expect(titles()).toEqual(['a.jpg'])
    expect(counts()).toEqual({ total: 1, processed: 1 })
  })

  it.each([-1, 2, 99])('by a position the queue does not have (%s): nothing changes', async (index) => {
    const { store, items } = await oneUploadedOneProcessing()
    const before = items.map(rowState)

    store.removeByIndex(QUEUE, index)
    store.removeByIndex(OTHER_QUEUE, 0)

    expect(titles()).toEqual(['a.jpg', 'b.jpg'])
    expect(store.getQueueItems(QUEUE).map(rowState)).toEqual(before)
    expect(counts()).toEqual({ total: 2, processed: 1 })
  })
})

// The asset detail, opened from a row, saves the metadata itself and tells the queue: the rows of that asset then
// show what was saved.
describe('a save in the asset detail', () => {
  const saved = {
    keywords: ['keyword-saved'],
    authors: ['author-saved'],
    metadata: {
      customData: { title: 'saved in the detail' },
      authorSuggestions: { 'Ambiguous Author': ['author-a', 'author-b'] },
      keywordSuggestions: {},
    },
  }
  /** A copy of one asset in two queues, settled, with its form, and typed into. */
  const copiesInTwoQueues = async () => {
    const store = useUploadQueuesStore()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed))
    dam.assets.set('asset-2', damAssetWithFile('asset-2', 'file-2', AssetFileProcessStatus.Processed))
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1', 'asset-2'], 'default')
    await store.addByCopyToLicence(OTHER_QUEUE, extSystem, licence, ['asset-1'], 'default')
    for (const asset of ['asset-1', 'asset-2']) notify(DamNotificationName.AssetFileCopied, { asset })
    const [here, other] = store.getQueueItems(QUEUE)
    const [there] = store.getQueueItems(OTHER_QUEUE)
    await vi.waitFor(() => expect([here, other, there].map((item) => item.canEditMetadata)).toEqual([true, true, true]))
    for (const item of [here, other, there]) item.customData = { title: 'typed in the row' }
    return { store, here, other, there }
  }

  it('gives the rows of that asset, in every queue, the keywords, authors and custom data now in the DAM', async () => {
    const { store, here, other, there } = await copiesInTwoQueues()
    const untouched = rowState(other)
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)

    await store.updateFromDetail(detail, 'default')

    for (const item of [here, there]) {
      expect(item).toMatchObject({
        keywords: ['keyword-saved'],
        authors: ['author-saved'],
        customData: { title: 'saved in the detail' },
        authorConflicts: ['author-a', 'author-b'],
        status: Uploaded,
        assetStatus: DamAssetStatus.WithFile,
        canEditMetadata: true,
      })
    }
    expect(rowState(other)).toEqual(untouched)
    expect(dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))).toBe(true)
  })

  // The detail has the single-use switch too, and saves it with the rest. A row left with the value it had would
  // send that with the next save of the queue, over what the user has just saved.
  it.each([true, false])('gives them the single-use switch now in the DAM (%s) as well', async (singleUse) => {
    const { store, here, other, there } = await copiesInTwoQueues()
    for (const item of [here, other, there]) item.mainFileSingleUse = !singleUse
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
      ...saved,
      mainFileSingleUse: singleUse,
    })

    await store.updateFromDetail(detail, 'default')

    expect([here, there].map((item) => item.mainFileSingleUse)).toEqual([singleUse, singleUse])
    expect(other.mainFileSingleUse).toBe(!singleUse)

    await bulkUpdateAssetsMetadata(dam.client, endPoints.asset, store.getQueueItems(QUEUE))
    const [sent] = dam.sentTo('PATCH', dam.routes.bulkMetadata)
    expect(dam.body(sent)).toMatchObject([
      { id: 'asset-1', mainFileSingleUse: singleUse },
      { id: 'asset-2', mainFileSingleUse: !singleUse },
    ])
  })

  // The queue asks the DAM for the asset once more and takes that answer, not what the detail handed it.
  it('takes what the DAM answers for that asset, not what the detail hands over', async () => {
    const { store, here } = await copiesInTwoQueues()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)
    const handedOver = damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
      keywords: ['keyword-of-the-detail'],
    })

    await store.updateFromDetail(handedOver, 'default')

    expect(here.keywords).toEqual(['keyword-saved'])
  })

  // The detail goes on telling the queue once it was opened from a row, also about an asset opened from elsewhere:
  // its save used to wait for a read of that asset, with no row to write it into.
  it.each([
    ['whose asset the DAM can be asked for', false],
    ['whose asset cannot be read', true],
  ])(
    'asks the DAM for nothing, and leaves every row as it is, when no queue holds a row of the asset %s',
    async (_which, unreadable) => {
      const { store, here, other, there } = await copiesInTwoQueues()
      const untouched = [here, other, there].map(rowState)
      const countsBefore = [counts(), counts(OTHER_QUEUE)]
      const detail = damAssetWithFile('asset-3', 'file-3', AssetFileProcessStatus.Processed, structuredClone(saved))
      if (!unreadable) dam.assets.set('asset-3', detail)
      const asked = dam.requests.length

      await expect(store.updateFromDetail(detail, 'default', true)).resolves.toBeUndefined()

      expect(dam.requests.slice(asked)).toEqual([])
      expect([here, other, there].map(rowState)).toEqual(untouched)
      expect([counts(), counts(OTHER_QUEUE)]).toEqual(countsBefore)
    }
  )

  it('asks the DAM for nothing when there is no queue at all', async () => {
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)

    await useUploadQueuesStore().updateFromDetail(detail, 'default')

    expect(dam.requests).toEqual([])
  })

  // The read is asked for as before while a row of the asset is in a queue, whatever queue it is.
  it('asks the DAM for the asset once, when only another queue than the first holds a row of it', async () => {
    const store = useUploadQueuesStore()
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed))
    dam.assets.set('asset-2', damAssetWithFile('asset-2', 'file-2', AssetFileProcessStatus.Processed))
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-2'], 'default')
    await store.addByCopyToLicence(OTHER_QUEUE, extSystem, licence, ['asset-1'], 'default')
    const [there] = store.getQueueItems(OTHER_QUEUE)
    const reads = dam.assetReads().length
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)

    await store.updateFromDetail(detail, 'default')

    expect(
      dam
        .assetReads()
        .slice(reads)
        .map((read) => read.url)
    ).toEqual(['/adm/v1/asset/asset-1'])
    expect(there).toMatchObject({ keywords: ['keyword-saved'], customData: { title: 'saved in the detail' } })
  })

  describe('when the asset cannot be read again', () => {
    /** The asset as the detail holds it after its save: with what was saved, and the switch it had when loaded. */
    const heldByTheDetail = (mainFileSingleUse: boolean | null = null) =>
      damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
        ...structuredClone(saved),
        mainFileSingleUse,
      })
    const failAssetReads = () =>
      dam.reply((request) =>
        request.method === 'GET' && dam.routes.one.test(request.url) ? { status: 502 } : undefined
      )

    // The detail is saved by then. Rows left as they were would send their old values with the next save of the
    // queue, over what the user has just saved. The detail keeps its switch apart from the asset, and names it.
    it.each([true, false])(
      'gives the rows of that asset what the detail saved, the single-use switch (%s) too',
      async (singleUse) => {
        const { store, here, other, there } = await copiesInTwoQueues()
        for (const item of [here, other, there]) item.mainFileSingleUse = !singleUse
        const untouched = rowState(other)
        failAssetReads()

        await expect(store.updateFromDetail(heldByTheDetail(!singleUse), 'default', singleUse)).resolves.toBeUndefined()

        for (const item of [here, there]) {
          expect(item).toMatchObject({
            keywords: ['keyword-saved'],
            authors: ['author-saved'],
            customData: { title: 'saved in the detail' },
            mainFileSingleUse: singleUse,
            // What the DAM suggests is not the detail's to say: as the rows had it.
            authorConflicts: [],
            status: Uploaded,
            canEditMetadata: true,
          })
        }
        expect(rowState(other)).toEqual(untouched)

        await bulkUpdateAssetsMetadata(dam.client, endPoints.asset, store.getQueueItems(QUEUE))
        const [sent] = dam.sentTo('PATCH', dam.routes.bulkMetadata)
        expect(dam.body(sent)).toMatchObject([
          {
            id: 'asset-1',
            keywords: ['keyword-saved'],
            authors: ['author-saved'],
            customData: { title: 'saved in the detail' },
            mainFileSingleUse: singleUse,
          },
          { id: 'asset-2', customData: { title: 'typed in the row' }, mainFileSingleUse: !singleUse },
        ])
      }
    )

    // The detail goes on being typed into, and so does each row.
    it('gives each row copies of its own, and none of them the lists of the detail', async () => {
      const { store, here, there } = await copiesInTwoQueues()
      const detail = heldByTheDetail()
      detail.metadata.customData.tags = ['saved']
      failAssetReads()

      await store.updateFromDetail(detail, 'default')
      here.keywords.push('typed-into-the-row')
      here.authors.push('typed-into-the-row')
      here.customData.title = 'typed into the row'
      here.customData.tags.push('typed into the row')
      detail.keywords.push('typed-into-the-detail')
      detail.authors.push('typed-into-the-detail')
      detail.metadata.customData.title = 'typed into the detail'
      detail.metadata.customData.tags.push('typed into the detail')

      expect(there).toMatchObject({
        keywords: ['keyword-saved'],
        authors: ['author-saved'],
        customData: { title: 'saved in the detail', tags: ['saved'] },
      })
      expect(here).toMatchObject({
        keywords: ['keyword-saved', 'typed-into-the-row'],
        authors: ['author-saved', 'typed-into-the-row'],
        customData: { title: 'typed into the row', tags: ['saved', 'typed into the row'] },
      })
    })

    // A caller that names no switch: the rows keep theirs.
    it('leaves the rows their switch when the detail names none', async () => {
      const { store, here, there } = await copiesInTwoQueues()
      for (const item of [here, there]) item.mainFileSingleUse = true
      failAssetReads()

      await store.updateFromDetail(heldByTheDetail(false), 'default')

      expect([here, there].map((item) => [item.customData, item.mainFileSingleUse])).toEqual([
        [{ title: 'saved in the detail' }, true],
        [{ title: 'saved in the detail' }, true],
      ])
    })
  })

  it('does not settle a row that still waits for its file', async () => {
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence(QUEUE, extSystem, licence, ['asset-1'], 'default')
    const [item] = store.getQueueItems(QUEUE)
    const detail = dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, saved)

    await store.updateFromDetail(detail, 'default')

    expect(item).toMatchObject({
      status: Processing,
      fileId: null,
      keywords: ['keyword-saved'],
      customData: { title: 'saved in the detail' },
      // Its metadata is in the row, its form is not open: that takes the read that settles it.
      canEditMetadata: false,
    })
    expect(counts()).toEqual({ total: 1, processed: 0 })
  })
})

describe('the counts of a queue', () => {
  it('take an uploaded and a failed row for done, and every other row for not', async () => {
    const store = useUploadQueuesStore()
    const chunks = dam.hold('POST', dam.routes.chunk)
    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b', 'c', 'd'), 'default')
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
    chunks.release()
    await vi.waitFor(() => expect(statuses()).toEqual([Processing, Processing, Uploading, Uploading]))
    const [first, second] = store.getQueueItems(QUEUE)
    dam.fileBecomes(first.assetId!, AssetFileProcessStatus.Processed)

    notify(DamNotificationName.AssetFileProcessed, { asset: first.assetId, id: first.fileId })
    notify(DamNotificationName.AssetFileFailed, {
      asset: second.assetId,
      id: second.fileId,
      failReason: AssetFileFailReason.Unknown,
    })
    await vi.waitFor(() => expect(statuses()).toEqual([Uploaded, Failed, Uploading, Uploading]))

    expect(counts()).toEqual({ total: 4, processed: 2 })
  })
})
