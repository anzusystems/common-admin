import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { fetchAsset, fetchAssetByFileId } from '@/domains/dam/api/damAssetApi'
import { imageUploadChunk, imageUploadFinish, imageUploadStart } from '@/domains/dam/api/damImageApi'
import { damUploadChunk, damUploadFinish, damUploadStart } from '@/domains/dam/api/uploadApi'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import {
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueItemTypeType,
} from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// The requests of an upload, each on its own: what goes where, with the endpoints handed in. They are those of
// admin-ugc here, so that nothing passes by falling back on the `/adm/v1` defaults.

const IMAGE = '/ugc/v1/image'
const ASSET = '/ugc/v1/asset'

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ image: IMAGE, asset: ASSET })
})

const row = (type: UploadQueueItemTypeType = UploadQueueItemType.File) => {
  const item = useUploadQueueItemFactory().createDefault(
    'file_photo.jpg',
    type,
    UploadQueueItemStatus.Uploading,
    DamAssetType.Image,
    1024,
    7
  )
  item.file = new File(['12345'], 'photo.jpg', { type: 'image/jpeg' })
  return item
}
const answerWith = (status: number) => dam.reply(() => ({ status, data: {} }))
const outcome = (request: Promise<unknown>) =>
  request.then(
    () => 'resolved',
    () => 'rejected'
  )

describe('the start request of an upload', () => {
  it('asks the image endpoint for a file in the licence of the row, with the type and the size of the file', async () => {
    const answer = await imageUploadStart(dam.client, IMAGE, row())

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual(['POST /ugc/v1/image/licence/7'])
    expect(dam.body(dam.requests[0])).toEqual({ mimeType: 'image/jpeg', size: 5 })
    expect(answer).toEqual({ id: 'file-1', asset: 'asset-1' })
  })

  it('asks for a file in a slot of an asset for a slot row that names both', async () => {
    const item = row(UploadQueueItemType.SlotFile)
    item.assetId = 'asset-9'
    item.slotName = 'free'
    answerWith(201)

    await imageUploadStart(dam.client, IMAGE, item)

    expect(dam.requests.map((request) => request.url)).toEqual(['/ugc/v1/image/asset/asset-9/slot-name/free'])
  })

  it.each([200, 204])('is refused when the answer is %s and not "created"', async (status) => {
    answerWith(status)

    expect(await outcome(imageUploadStart(dam.client, IMAGE, row()))).toBe('rejected')
  })

  it('is refused when the request fails', async () => {
    answerWith(500)

    expect(await outcome(imageUploadStart(dam.client, IMAGE, row()))).toBe('rejected')
  })
})

describe('the chunk request of an upload', () => {
  it('posts the bytes and where they belong as a form, to the chunk path of the file', async () => {
    const item = row()
    const controller = new AbortController()
    item.latestChunkAbortController = controller
    const bytes = new Blob(['12345'])

    await imageUploadChunk(dam.client, IMAGE, item, 'file-1', bytes, 5, 0)

    const [chunk] = dam.requests
    expect(`${chunk.method} ${chunk.url}`).toBe('POST /ugc/v1/image/file-1/chunk')
    const form = chunk.data as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(await (form.get('file') as File).text()).toBe('12345')
    expect(form.get('chunk')).toBe('{"offset":0,"size":5}')
    // Left to axios: it writes the multipart type with its boundary.
    expect(chunk.config.headers).toStrictEqual({ 'Content-Type': undefined })
    // Stop reaches the request through the controller of the row.
    expect(chunk.config.signal).toBe(controller.signal)
  })

  it('reports the progress of the request to the caller', async () => {
    const seen: unknown[] = []
    dam.reply((request) => {
      request.config.onUploadProgress?.({ loaded: 5, total: 5 } as never)
      return undefined
    })

    await imageUploadChunk(dam.client, IMAGE, row(), 'file-1', new Blob(['12345']), 5, 0, (event) => seen.push(event))

    expect(seen).toEqual([{ loaded: 5, total: 5 }])
  })

  it.each([
    ['no bytes', new Blob([]), 5, 0],
    ['something that is not a blob', '12345' as unknown as Blob, 5, 0],
    ['a size that is not a whole number', new Blob(['12345']), 2.5, 0],
    ['a size of zero', new Blob(['12345']), 0, 0],
    ['an offset below zero', new Blob(['12345']), 5, -1],
    ['an offset that is not a whole number', new Blob(['12345']), 5, 0.5],
  ])('is refused without a request for %s', async (_what, bytes, size, offset) => {
    expect(await outcome(imageUploadChunk(dam.client, IMAGE, row(), 'file-1', bytes, size, offset))).toBe('rejected')
    expect(dam.requests).toEqual([])
  })

  it.each([200, 204])('is refused when the answer is %s and not "created"', async (status) => {
    answerWith(status)

    expect(await outcome(imageUploadChunk(dam.client, IMAGE, row(), 'file-1', new Blob(['12345']), 5, 0))).toBe(
      'rejected'
    )
  })
})

describe('the finish request of an upload', () => {
  it('patches the uploaded path of the file of the row with the checksum', async () => {
    const item = row()
    item.fileId = 'file-1'

    await imageUploadFinish(dam.client, IMAGE, item, 'sha-of-the-file')

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /ugc/v1/image/file-1/uploaded',
    ])
    expect(dam.body(dam.requests[0])).toEqual({ checksum: 'sha-of-the-file' })
  })

  it.each([201, 204])('is refused when the answer is %s and not "ok"', async (status) => {
    const item = row()
    item.fileId = 'file-1'
    answerWith(status)

    expect(await outcome(imageUploadFinish(dam.client, IMAGE, item, 'sha'))).toBe('rejected')
  })
})

// The library uploads images only: a row of another type is refused before anything is asked.
describe.each([DamAssetType.Audio, DamAssetType.Video, DamAssetType.Document])('a row of the type %s', (assetType) => {
  const other = () => {
    const item = row()
    item.assetType = assetType
    item.fileId = 'file-1'
    return item
  }

  it('is not started, sent nor finished', async () => {
    const item = other()

    expect(await outcome(damUploadStart(dam.client, IMAGE, item))).toBe('rejected')
    expect(await outcome(damUploadChunk(dam.client, IMAGE, item, 'file-1', new Blob(['12345']), 5, 0, undefined))).toBe(
      'rejected'
    )
    expect(await outcome(damUploadFinish(dam.client, IMAGE, item, 'sha'))).toBe('rejected')

    expect(dam.requests).toEqual([])
    expect(item.status).toBe(UploadQueueItemStatus.Uploading)
  })
})

describe('the read of an asset', () => {
  beforeEach(() => {
    dam.assets.set('asset-1', damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed))
  })

  it('by its id: asks the asset endpoint handed in', async () => {
    const asset = await fetchAsset(dam.client, ASSET, 'asset-1')

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual(['GET /ugc/v1/asset/asset-1'])
    expect(asset.id).toBe('asset-1')
  })

  it('by one of its files: asks the asset-file path of that endpoint', async () => {
    const asset = await fetchAssetByFileId(dam.client, ASSET, 'file-1')

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET /ugc/v1/asset/asset-file/file-1',
    ])
    expect(asset.id).toBe('asset-1')
  })

  it('is refused when there is no such asset', async () => {
    expect(await outcome(fetchAsset(dam.client, ASSET, 'asset-gone'))).toBe('rejected')
    expect(await outcome(fetchAssetByFileId(dam.client, ASSET, 'file-gone'))).toBe('rejected')
  })
})
