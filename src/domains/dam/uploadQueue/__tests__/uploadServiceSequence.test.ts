import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// One file sent in several chunks, request by request, with the real service, requests and hash.
// The chunk size comes from the DAM configuration; it is fixed at 1024 bytes so a file of 3000 goes out in three.

const { endPoints } = ugcConfiguration
const CHUNK = 1024
const SECOND = 1_000

let dam: FakeDam
let waits: LongWaits

const bytes = Uint8Array.from({ length: 3000 }, (_, index) => index % 251)
const sha1 = async (data: BufferSource) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(ugcConfiguration, dam.client)
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: CHUNK, maxSize: CHUNK }
  waits = holdLongWaits(SECOND)
})
afterEach(() => {
  waits.restore()
})

const row = () => {
  const item = useUploadQueueItemFactory().createDefault(
    'file_photo.jpg',
    UploadQueueItemType.File,
    UploadQueueItemStatus.Waiting,
    DamAssetType.Image,
    CHUNK,
    ugcConfiguration.licence
  )
  item.file = new File([bytes], 'photo.jpg', { type: 'image/jpeg' })
  return item
}
const chunkForm = (index: number) => dam.sentTo('POST', dam.routes.chunk)[index].data as FormData

describe('a file sent in three chunks', () => {
  it('is started once, sent in order from where the last chunk ended, and finished with the hash of it all', async () => {
    const item = row()
    const { uploadInit, upload } = useUpload(item)

    await uploadInit()
    expect(item).toMatchObject({ status: UploadQueueItemStatus.Uploading, assetId: 'asset-1', fileId: 'file-1' })
    await upload()

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `POST /ugc/v1/image/licence/${ugcConfiguration.licence}`,
      'POST /ugc/v1/image/file-1/chunk',
      'POST /ugc/v1/image/file-1/chunk',
      'POST /ugc/v1/image/file-1/chunk',
      'PATCH /ugc/v1/image/file-1/uploaded',
    ])
    expect([0, 1, 2].map((index) => chunkForm(index).get('chunk'))).toEqual([
      '{"offset":0,"size":1024}',
      '{"offset":1024,"size":1024}',
      '{"offset":2048,"size":952}',
    ])
    const parts = [0, 1, 2].map((index) => chunkForm(index).get('file') as File)
    expect(parts.map((part) => [part.name, part.type, part.size])).toEqual([
      ['photo.jpg', 'image/jpeg', 1024],
      ['photo.jpg', 'image/jpeg', 1024],
      ['photo.jpg', 'image/jpeg', 952],
    ])
    const sent = new Uint8Array(await new Blob(parts).arrayBuffer())
    expect(sent).toEqual(bytes)

    const finish = dam.sentTo('PATCH', dam.routes.finish)[0]
    expect(dam.body(finish)).toEqual({ checksum: await sha1(bytes) })
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(dam.unanswered).toEqual([])
  })

  it('reports how far it is and how fast it goes, once a second', async () => {
    const item = row()
    const reports: Array<{ percent: number; speed: number; remaining: number }> = []
    const { uploadInit, upload } = useUpload(item, (percent: number, speed: number, remaining: number) =>
      reports.push({ percent, speed, remaining })
    )
    const chunks = dam.hold('POST', dam.routes.chunk)
    const sendChunk = async () => {
      const [held] = chunks.waiting
      const progress = held.request.config.onUploadProgress!
      const size = (held.request.data as FormData).get('file') as File
      progress({ loaded: Math.floor(size.size / 2), total: size.size } as never)
      await waits.settle(30)
      progress({ loaded: size.size, total: size.size } as never)
      held.release()
    }
    const chunksSent = () => dam.sentTo('POST', dam.routes.chunk).length

    const aSecondPasses = async () => {
      expect(waits.lengths()).toEqual([SECOND])
      await waits.elapse()
    }

    await uploadInit()
    const uploading = upload()
    await vi.waitFor(() => expect(chunksSent()).toBe(1))
    await aSecondPasses()
    expect(reports).toEqual([])

    await sendChunk()
    await vi.waitFor(() => expect(chunksSent()).toBe(2))
    await aSecondPasses()
    await sendChunk()
    await vi.waitFor(() => expect(chunksSent()).toBe(3))
    await aSecondPasses()
    expect(waits.lengths()).toEqual([SECOND])
    await sendChunk()
    await uploading

    expect(reports.map((report) => Math.round(report.percent))).toEqual([34, 68])
    // The second running when the last chunk went out still reports, with the whole file
    // by then. No other does: once the file is out the meter asks for no further second.
    expect(waits.lengths()).toContain(SECOND)
    await waits.elapse()
    expect(waits.lengths()).not.toContain(SECOND)
    await waits.elapse()
    expect(reports.map((report) => Math.round(report.percent))).toEqual([34, 68, 100])
    expect(reports.at(-1)!.remaining).toBe(0)
    expect(reports.every((report) => report.speed > 0 && Number.isFinite(report.speed))).toBe(true)
    expect(reports.every((report) => report.remaining >= 0)).toBe(true)
  })
})
