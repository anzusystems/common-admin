import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeDam, damAsset, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { bulkUpdateAssetsMetadata, updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// The one request of the upload that writes what the user typed: the metadata of the rows of a queue, saved in
// bulk. What is sent for a row, which rows are sent, and in how many requests. The endpoint is the one handed in:
// admin-ugc's here.
// Whether the main file is internal is not the library's to say: the request carries neither of the two
// `internal` fields, and what the DAM answers about them is read.

const ASSET = '/ugc/v1/asset'

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: ASSET, image: '/ugc/v1/image' })
})

const row = (asset: string | null, parts: Partial<UploadQueueItem> = {}) => {
  const item = useUploadQueueItemFactory().createDefault(
    `file_${asset}`,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Uploaded,
    DamAssetType.Image,
    1024,
    1
  )
  item.assetId = asset
  item.canEditMetadata = true
  return Object.assign(item, parts)
}
const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
const sent = (index = 0) => dam.body(saves()[index]) as Array<Record<string, unknown>>

describe('the bulk save of the metadata of a queue', () => {
  it('sends what the row holds for its asset, and marks the asset described', async () => {
    const item = row('asset-1', {
      keywords: ['keyword-1'],
      authors: ['author-1', 'author-2'],
      customData: { title: 'typed', description: '' },
      mainFileSingleUse: true,
    })

    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [item])

    expect(saves().map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /ugc/v1/asset/metadata-bulk-update',
    ])
    // Nothing else: neither `mainFileInternal` nor `mainFileOverrideInternal` is sent.
    expect(sent()).toEqual([
      {
        id: 'asset-1',
        keywords: ['keyword-1'],
        authors: ['author-1', 'author-2'],
        described: true,
        customData: { title: 'typed', description: '' },
        mainFileSingleUse: true,
      },
    ])
    // What the DAM answered, for the caller to build the images from.
    expect(answer).toEqual(sent())
  })

  // The answer carries the asset as the DAM has it after the save, the `internal` state of its main file with it.
  it.each([
    ['is internal', true, true],
    ['is not', false, false],
    ['is unknown', null, false],
  ])('hands on that the main file %s, for the image built from the row', async (_what, mainFileInternal, internal) => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
        ? {
            status: 200,
            data: (dam.body(request) as object[]).map((one) => ({
              ...one,
              mainFileInternal,
              mainFileOverrideInternal: false,
            })),
          }
        : undefined
    )
    const item = row('asset-1', { fileId: 'file-1', customData: { description: 'typed' } })

    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [item])
    const images = await mapUploadMetadataToImages([item], answer, dam.client, 4, 1, '/ugc/v1/author')

    expect(sent()[0]).not.toHaveProperty('mainFileInternal')
    expect(sent()[0]).not.toHaveProperty('mainFileOverrideInternal')
    expect(answer[0]).toHaveProperty('mainFileInternal', mainFileInternal)
    expect(images).toHaveLength(1)
    expect(images[0].dam).toEqual({ damId: 'file-1', regionPosition: 0, licenceId: 1, internal })
    // The switches of the CMS image are another matter, and stay off.
    expect(images[0].flags).toEqual({ showSource: true, internal: false, overrideInternal: false })
  })

  it.each([
    ['is not known yet', null],
    ['is switched off', false],
  ])('sends the single-use switch of a row also when it %s', async (_what, mainFileSingleUse) => {
    await bulkUpdateAssetsMetadata(dam.client, ASSET, [row('asset-1', { mainFileSingleUse })])

    expect(sent()[0]).toHaveProperty('mainFileSingleUse', mainFileSingleUse)
  })

  it.each([true, false])(
    'sends the single-use switch the caller gives (%s) in place of that of each row',
    async (given) => {
      const rows = [row('asset-1', { mainFileSingleUse: !given }), row('asset-2', { mainFileSingleUse: null })]

      await bulkUpdateAssetsMetadata(dam.client, ASSET, rows, given)

      expect(sent().map((one) => one.mainFileSingleUse)).toEqual([given, given])
    }
  )

  it('leaves out a row without an asset and a row whose metadata cannot be edited', async () => {
    const rows = [
      row('asset-editable'),
      row(null),
      row('asset-failed', { status: UploadQueueItemStatus.Failed, canEditMetadata: false }),
      row('asset-waiting-for-metadata', { canEditMetadata: false }),
      // A row still waiting for its file is saved once it has its form: the form decides, not the status.
      row('asset-also-editable', { status: UploadQueueItemStatus.Processing }),
    ]

    await bulkUpdateAssetsMetadata(dam.client, ASSET, rows)

    expect(sent().map((one) => one.id)).toEqual(['asset-editable', 'asset-also-editable'])
  })

  it('sends ten assets a request, one request after the other, and answers with all of them', async () => {
    const rows = Array.from({ length: 23 }, (_, index) => row(`asset-${index}`))
    const holding = dam.hold('PATCH', dam.routes.bulkMetadata)

    const saving = bulkUpdateAssetsMetadata(dam.client, ASSET, rows)
    // The second request waits for the answer to the first.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(saves()).toHaveLength(1)
    holding.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(saves()).toHaveLength(2)
    holding.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    holding.release()
    const answer = await saving

    expect([0, 1, 2].map((index) => sent(index).length)).toEqual([10, 10, 3])
    expect(answer.map((one) => one.id)).toEqual(rows.map((one) => one.assetId))
  })

  it('asks for nothing and answers with nothing when no row is to be saved', async () => {
    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [
      row(null),
      row('asset-1', { canEditMetadata: false }),
    ])

    expect(answer).toEqual([])
    expect(dam.requests).toEqual([])
  })

  it.each([201, 204, 422, 500])('is refused when a request is answered with %s', async (status) => {
    dam.reply(() => ({ status, data: [] }))

    const outcome = await bulkUpdateAssetsMetadata(dam.client, ASSET, [row('asset-1')]).then(
      () => 'resolved',
      () => 'rejected'
    )

    expect(outcome).toBe('rejected')
  })

  it('stops at the request that fails: the rows after it are not sent', async () => {
    const rows = Array.from({ length: 23 }, (_, index) => row(`asset-${index}`))
    let request = 0
    dam.reply(() => (++request === 2 ? { status: 500 } : undefined))

    const outcome = await bulkUpdateAssetsMetadata(dam.client, ASSET, rows).then(
      () => 'resolved',
      () => 'rejected'
    )

    expect(outcome).toBe('rejected')
    expect(saves()).toHaveLength(2)
  })
})

describe('the save of the metadata of one asset', () => {
  it('sends the asset in the shape of the bulk save, as a list of one', async () => {
    const asset = damAsset('asset-1', {
      keywords: ['keyword-1'],
      authors: ['author-1'],
      metadata: { customData: { title: 'typed' }, authorSuggestions: {}, keywordSuggestions: {} },
      // Not what is sent: the switch comes from the caller.
      mainFileSingleUse: false,
      mainFileInternal: true,
      mainFileOverrideInternal: true,
    })

    await updateAssetMetadata(dam.client, ASSET, asset, 4, true)

    expect(saves().map((request) => request.url)).toEqual(['/ugc/v1/asset/metadata-bulk-update'])
    // Nothing else here either: the `internal` state the asset was read with is not sent back.
    expect(sent()).toEqual([
      {
        id: 'asset-1',
        keywords: ['keyword-1'],
        authors: ['author-1'],
        described: true,
        customData: { title: 'typed' },
        mainFileSingleUse: true,
      },
    ])
  })

  it('sends the single-use switch also when the caller does not know it', async () => {
    await updateAssetMetadata(dam.client, ASSET, damAsset('asset-1'), 4, null)

    expect(sent()[0]).toHaveProperty('mainFileSingleUse', null)
  })
})
