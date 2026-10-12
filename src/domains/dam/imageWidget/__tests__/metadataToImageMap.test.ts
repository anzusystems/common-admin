import { beforeEach, describe, expect, it } from 'vitest'
import { cmsConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import type { AssetMetadataBulkItem } from '@/domains/dam/api/damAssetApi'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// The library's own map from the rows of an upload queue to the images an image widget is handed on "save and
// apply": what admin-cms gets (admin-ugc brings a map of its own). The texts of an image come from what the save
// of the metadata answered, not from the rows; the rows give the file. The DAM is a client that records its
// requests: the only thing the map asks for is the names of the authors.

const { endPoints, extSystem, licence } = cmsConfiguration
const AUTHORS = '/adm/v1/author'
const LOOKUP = new RegExp(`^${AUTHORS}/ext-system/${extSystem}/search\\?(.*)$`)

let dam: FakeDam

/** The names the DAM has for authors; one it does not know is not in its answer. */
const knownAuthors = (names: Record<string, string>) =>
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(LOOKUP) : null
    if (!match) return undefined
    const ids = (new URLSearchParams(match[1]).get('id') ?? '').split(',')
    const found = ids.filter((id) => id in names).map((id) => ({ id, name: names[id] }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
const lookups = () => dam.requests.filter((request) => LOOKUP.test(request.url))
/** The ids a lookup asked for. */
const askedFor = (index = 0) =>
  (new URLSearchParams(lookups()[index]!.url.match(LOOKUP)![1]).get('id') ?? '').split(',').sort()

beforeEach(() => {
  dam = createFakeDam(endPoints)
})

const row = (name: string, parts: Partial<UploadQueueItem> = {}): UploadQueueItem => ({
  ...useUploadQueueItemFactory().createDefault(
    `row-${name}`,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Uploaded,
    DamAssetType.Image,
    1,
    licence
  ),
  assetId: `asset-${name}`,
  fileId: `file-${name}`,
  ...parts,
})
const saved = (name: string, parts: Partial<AssetMetadataBulkItem> = {}): AssetMetadataBulkItem => ({
  id: `asset-${name}`,
  keywords: [],
  authors: [],
  described: true,
  customData: {},
  mainFileSingleUse: null,
  mainFileInternal: null,
  mainFileOverrideInternal: null,
  ...parts,
})
const map = (rows: UploadQueueItem[], answer: AssetMetadataBulkItem[], forLicence = licence) =>
  mapUploadMetadataToImages(rows, answer, dam.client, extSystem, forLicence, AUTHORS)

describe('the map of an upload to images', () => {
  it('makes an image of each row: its file in the licence given, and the texts and authors the save answered', async () => {
    knownAuthors({ 'author-1': 'Anna Author', 'author-2': 'Ben Byline' })

    const images = await map(
      [row('a', { customData: { description: 'what the row holds' }, authors: ['author-of-the-row'] })],
      [
        saved('a', {
          customData: { description: '  what the save answered  ' },
          authors: ['author-1', 'author-2'],
          mainFileInternal: true,
        }),
      ],
      555
    )

    expect(images).toEqual([
      {
        texts: { description: 'what the save answered', source: 'Anna Author, Ben Byline' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-a', regionPosition: 0, licenceId: 555, internal: true },
        authorIds: ['author-1', 'author-2'],
        assetId: 'asset-a',
      },
    ])
  })

  it.each([
    ['is not a text', { description: 42 }],
    ['is not there', { title: 'only a title' }],
    ['is empty', { description: '   ' }],
  ])('leaves the description empty when that of the answer %s', async (_what, customData) => {
    const [image] = await map([row('a', { customData: { description: 'of the row' } })], [saved('a', { customData })])

    expect(image!.texts.description).toBe('')
  })

  it.each([
    ['says so', true, true],
    ['says it is not', false, false],
    ['does not say', null, false],
  ])('marks the image internal when the answer %s', async (_what, mainFileInternal, internal) => {
    const [image] = await map([row('a', { mainFileInternal: !internal })], [saved('a', { mainFileInternal })])

    expect(image!.dam.internal).toBe(internal)
    // Whether the image itself is internal is the editor's to say later, in the widget.
    expect(image!.flags).toEqual({ showSource: true, internal: false, overrideInternal: false })
  })

  describe('the names of the authors', () => {
    it('are asked for once, for all the rows together, each author once', async () => {
      knownAuthors({ 'author-1': 'Anna Author', 'author-2': 'Ben Byline', 'author-3': 'Cy Credit' })

      const images = await map(
        [row('a'), row('b'), row('c')],
        [
          saved('a', { authors: ['author-1', 'author-2'] }),
          saved('b', { authors: ['author-2', 'author-3'] }),
          saved('c', { authors: [] }),
        ]
      )

      expect(lookups()).toHaveLength(1)
      expect(askedFor()).toEqual(['author-1', 'author-2', 'author-3'])
      expect(images.map((image) => image.texts.source)).toEqual([
        'Anna Author, Ben Byline',
        'Ben Byline, Cy Credit',
        '',
      ])
      expect(images.map((image) => image.authorIds)).toEqual([['author-1', 'author-2'], ['author-2', 'author-3'], []])
    })

    it('are not asked for when no asset of the answer has an author', async () => {
      const images = await map([row('a'), row('b')], [saved('a'), saved('b')])

      expect(dam.requests).toEqual([])
      expect(images.map((image) => [image.texts.source, image.authorIds])).toEqual([
        ['', []],
        ['', []],
      ])
    })

    it('are joined in the order the asset has its authors, whatever order the DAM answers in', async () => {
      dam.reply((request) =>
        LOOKUP.test(request.url)
          ? {
              status: 200,
              data: {
                data: [
                  { id: 'author-1', name: 'Anna Author' },
                  { id: 'author-2', name: 'Ben Byline' },
                ],
                totalCount: 2,
              },
            }
          : undefined
      )

      const [image] = await map([row('a')], [saved('a', { authors: ['author-2', 'author-1'] })])

      expect(image!.texts.source).toBe('Ben Byline, Anna Author')
    })

    // The author stays on the asset; only the source of the image has no name for it.
    it('leave out an author the DAM does not answer with, and one whose name is blank', async () => {
      knownAuthors({ 'author-1': 'Anna Author', 'author-blank': '   ' })

      const [image] = await map([row('a')], [saved('a', { authors: ['author-gone', 'author-blank', 'author-1'] })])

      expect(image!.texts.source).toBe('Anna Author')
      expect(image!.authorIds).toEqual(['author-gone', 'author-blank', 'author-1'])
    })

    it('fail the whole map when they cannot be read: no image is handed over without its source', async () => {
      dam.reply((request) => (LOOKUP.test(request.url) ? { status: 500 } : undefined))

      await expect(map([row('a')], [saved('a', { authors: ['author-1'] })])).rejects.toBeDefined()
    })
  })

  describe('the rows it takes', () => {
    it('are those with an asset and a file: a row without either is left out, the others keep their order', async () => {
      const images = await map(
        [row('a'), row('no-file', { fileId: null }), row('no-asset', { assetId: null }), row('b')],
        [saved('a'), saved('no-file'), saved('b')]
      )

      expect(images.map((image) => [image.assetId, image.dam.damId])).toEqual([
        ['asset-a', 'file-a'],
        ['asset-b', 'file-b'],
      ])
    })

    // An uploaded row whose metadata never came: the save skips it, so the answer has nothing for its asset.
    it('include a row the save answered nothing for, as an image without texts and authors', async () => {
      knownAuthors({ 'author-1': 'Anna Author' })

      const images = await map(
        [row('skipped', { customData: { description: 'of the row' } }), row('a')],
        [saved('a', { authors: ['author-1'], mainFileInternal: true })]
      )

      expect(images[0]).toEqual({
        texts: { description: '', source: '' },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-skipped', regionPosition: 0, licenceId: licence, internal: false },
        authorIds: [],
        assetId: 'asset-skipped',
      })
      expect(images[1]!.texts.source).toBe('Anna Author')
    })

    // The answer of the save says whether the main file is internal. Without an answer for its asset the row says
    // it, which has it from the read that settled it: the image of an internal file used to come as one that is not.
    it.each([
      ['knows it is', true, true],
      ['knows it is not', false, false],
      ['does not know', null, false],
    ])(
      'mark the image of a row the save answered nothing for internal when the row %s',
      async (_what, mainFileInternal, internal) => {
        const [image] = await map([row('skipped', { mainFileInternal })], [saved('a')])

        expect(image!.dam.internal).toBe(internal)
        expect(image!.flags).toEqual({ showSource: true, internal: false, overrideInternal: false })
      }
    )

    it('are none when the queue is empty: nothing is asked for', async () => {
      expect(await map([], [])).toEqual([])
      expect(dam.requests).toEqual([])
    })

    // Two files that turned out to be one original are two rows of one asset: each is an image of that file.
    it('give two images for two rows of one asset', async () => {
      const images = await map(
        [row('a'), row('a', { key: 'row-a-again' })],
        [saved('a', { customData: { description: 'one asset' } })]
      )

      expect(images.map((image) => [image.assetId, image.dam.damId, image.texts.description])).toEqual([
        ['asset-a', 'file-a', 'one asset'],
        ['asset-a', 'file-a', 'one asset'],
      ])
    })
  })
})
