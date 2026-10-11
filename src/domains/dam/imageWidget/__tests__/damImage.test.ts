import { describe, expect, it } from 'vitest'
import { createDamImage, imageFieldsOf } from '@/domains/dam/imageWidget/utils/damImage'

// The one function that makes the image of the CMS for a file of the DAM. Each of its nine callers is pinned where
// it is used (`damImageSites.test.ts`, `metadataToImageMap.test.ts`, the tests of the three widgets); here is what the
// function itself promises them.

const FILE = '0f6b8f6a-5d2c-4c1e-9a7b-3e2d1c0b9a81'

describe('the image of the CMS for a file of the DAM', () => {
  it('has empty texts, a shown source, no region and nothing internal unless told, and neither position nor id', () => {
    expect(createDamImage({ fileId: FILE, licenceId: 7 })).toStrictEqual({
      texts: { description: '', source: '' },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: FILE, licenceId: 7, regionPosition: 0, internal: false },
    })
  })

  it('takes its texts, whether the file is internal and whether the source is shown', () => {
    expect(
      createDamImage(
        { fileId: FILE, licenceId: 7, internal: true },
        { description: 'Harbour at dawn', source: 'Jana' },
        { showSource: false }
      )
    ).toStrictEqual({
      texts: { description: 'Harbour at dawn', source: 'Jana' },
      flags: { showSource: false, internal: false, overrideInternal: false },
      dam: { damId: FILE, licenceId: 7, regionPosition: 0, internal: true },
    })
  })

  // What a mapping of the application hands in place of a text goes on as handed: the caller that wants it empty
  // says so. Only a text nobody names is empty.
  it('keeps a text as it is handed, also one that is no text', () => {
    const file = { fileId: FILE, licenceId: 7 }

    expect(createDamImage(file, { description: null as never, source: undefined }).texts).toStrictEqual({
      description: null,
      source: undefined,
    })
    expect(createDamImage(file, { source: 'Jana' }).texts).toStrictEqual({ description: '', source: 'Jana' })
  })

  it.each([null, undefined, false])('is not internal for a file whose asset says %s', (internal) => {
    expect(createDamImage({ fileId: FILE, licenceId: 7, internal }).dam.internal).toBe(false)
  })

  // A caller that gives none has an image without the key, as when it built the object by hand.
  it('has a position and an id where they are given, 0 included', () => {
    const image = createDamImage({ fileId: FILE, licenceId: 7 }, {}, { position: 0, id: 0 })

    expect(image).toMatchObject({ position: 0, id: 0 })
    expect(
      Object.keys(createDamImage({ fileId: FILE, licenceId: 7 }, {}, { position: undefined, id: undefined }))
    ).toEqual(['texts', 'flags', 'dam'])
  })
})

// Finding 36: what a widget hands the image API of an image it carries more with.
describe('what the image API is sent of an image', () => {
  const image = createDamImage({ fileId: FILE, licenceId: 7 }, { description: 'Harbour at dawn', source: 'Jana' })

  it('is the fields of the image, without the asset and the authors of an upload or the key and the authors of a row', () => {
    const carried = {
      ...image,
      position: 2,
      id: 9,
      key: 'row-1',
      authorIds: ['author-1'],
      assetId: 'asset-1',
      damAuthors: ['author-1'],
      showDamAuthors: false,
    }

    expect(imageFieldsOf(carried)).toStrictEqual({ ...image, position: 2, id: 9 })
  })

  it('has a position and an id where the image has them, 0 included, and neither key where it has none', () => {
    expect(imageFieldsOf({ ...image, position: 0, id: 0 })).toStrictEqual({ ...image, position: 0, id: 0 })
    expect(Object.keys(imageFieldsOf(image))).toEqual(['texts', 'flags', 'dam'])
    expect(Object.keys(imageFieldsOf({ ...image, position: undefined, id: undefined }))).toEqual([
      'texts',
      'flags',
      'dam',
    ])
  })
})
