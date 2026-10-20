import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// An upload the browser cannot get through: what its row looks like, and that the queue goes on with the files
// behind it. The real store and the real upload; the DAM is a client that records its requests and refuses the
// ones a case names. The pauses between the tries of a chunk are let pass at once.

const QUEUE = 'failing-queue'
const { Waiting, Uploading, Failed } = UploadQueueItemStatus

let dam: FakeDam
let waits: LongWaits

afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

// Each of its own size: two files are sent side by side, and a start request says of its file only the size.
const FIRST_SIZE = 3000
const photos = (...names: string[]) =>
  names.map((name, index) => new File([new Uint8Array(FIRST_SIZE + index)], `${name}.jpg`, { type: 'image/jpeg' }))

describe.each(consumerProfiles)('a file the browser cannot send, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits(10_000, { passFrom: 1_000 })
  })

  const starts = () => dam.sentTo('POST', dam.routes.start)
  const statuses = () =>
    useUploadQueuesStore()
      .getQueueItems(QUEUE)
      .map((item) => item.status)
  /** Three files; the requests of the first that match are refused, the other files are held while being sent. */
  const firstFileRefused = async (refused: (request: FakeDamRequest) => boolean) => {
    const store = useUploadQueuesStore()
    dam.hold('POST', dam.routes.chunk)
    dam.reply((request) => (refused(request) ? { status: 503 } : undefined))
    await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b', 'c'), 'default')
    const [first] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(first.status).toBe(Failed))
    await vi.waitFor(() => expect(starts()).toHaveLength(3))
    return { store, first }
  }
  const aFailedRow = {
    canEditMetadata: false,
    isDuplicate: false,
    // Nothing is said about why: the row shows its general error.
    error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.None },
  }

  it('whose start request is refused: the row fails with no asset, and the next file is sent', async () => {
    const { store, first } = await firstFileRefused(
      (request) =>
        request.method === 'POST' &&
        dam.routes.start.test(request.url) &&
        (dam.body(request) as { size: number }).size === FIRST_SIZE
    )

    expect(first).toMatchObject({ ...aFailedRow, assetId: null, fileId: null })
    expect(statuses()).toEqual([Failed, Uploading, Uploading])
    // A failed row counts as done.
    expect([store.getQueueTotalCount(QUEUE), store.getQueueProcessedCount(QUEUE)]).toEqual([3, 1])
  })

  // An answer that says "created" and does not name the file, or the asset: there is nothing to send the chunks
  // to, or nothing to ask about afterwards. With the file named and the asset not, every chunk and the finish
  // used to go out, for a row no read could ever settle.
  it.each([
    ['the id of the file', { asset: 'asset-without-a-file' }],
    ['the id of the asset', { id: 'file-without-an-asset' }],
  ])(
    'whose start request answers without %s: the row fails at once, as when it is refused, and none of it is sent',
    async (_what, data) => {
      const store = useUploadQueuesStore()
      const held = dam.hold('POST', dam.routes.chunk)
      dam.reply((request) =>
        request.method === 'POST' &&
        dam.routes.start.test(request.url) &&
        (dam.body(request) as { size: number }).size === FIRST_SIZE
          ? { status: 201, data }
          : undefined
      )
      await store.addByFiles(QUEUE, extSystem, licence, photos('a', 'b', 'c'), 'default')
      const [first] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(first.status).toBe(Failed))
      await vi.waitFor(() => expect(held.waiting).toHaveLength(2))

      expect(first).toMatchObject({ ...aFailedRow, assetId: null, fileId: null })
      expect(statuses()).toEqual([Failed, Uploading, Uploading])
      expect([store.getQueueTotalCount(QUEUE), store.getQueueProcessedCount(QUEUE)]).toEqual([3, 1])
      // Of the three files, the chunks of the two behind it are on their way; of the first, nothing.
      expect(
        dam
          .sentTo('POST', dam.routes.chunk)
          .map((request) => dam.chunkOf(request))
          .sort()
      ).toEqual(['b.jpg', 'c.jpg'])
      expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
      // No pause between tries that send nothing: of the waits let pass, only the seconds of the speed meter of
      // the two files that are being sent, none of the three and nine seconds of a retry.
      expect(waits.passed.filter((length) => length > 1000)).toEqual([])
    }
  )

  it('whose chunk is refused on every try: the row fails with its asset, and the next file is sent', async () => {
    const { store, first } = await firstFileRefused(
      (request) => request.method === 'POST' && dam.routes.chunk.test(request.url) && dam.chunkOf(request) === 'a.jpg'
    )

    expect(first).toMatchObject(aFailedRow)
    expect([first.assetId, first.fileId]).not.toContain(null)
    expect(dam.requests.filter((request) => request.url === `${endPoints.image}/${first.fileId}/chunk`)).toHaveLength(4)
    expect(statuses()).toEqual([Failed, Uploading, Uploading])
    expect([store.getQueueTotalCount(QUEUE), store.getQueueProcessedCount(QUEUE)]).toEqual([3, 1])
    // It was never finished.
    expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
  })

  it('that is empty: the row fails before anything is asked, and the next file is sent', async () => {
    const store = useUploadQueuesStore()
    dam.hold('POST', dam.routes.chunk)
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' })

    await store.addByFiles(QUEUE, extSystem, licence, [empty, ...photos('b', 'c', 'd')], 'default')
    const [first] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(first.status).toBe(Failed))
    await vi.waitFor(() => expect(starts()).toHaveLength(2))

    expect(first).toMatchObject({ ...aFailedRow, assetId: null, fileId: null })
    expect(statuses()).toEqual([Failed, Uploading, Uploading, Waiting])
    expect(dam.requests.every((request) => request.url.startsWith(endPoints.image))).toBe(true)
  })
})
