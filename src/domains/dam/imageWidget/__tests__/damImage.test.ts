import { describe, expect, it } from 'vitest'
import { createDamImage, damImageFileIdFromUrl, imageFieldsOf } from '@/domains/dam/imageWidget/utils/damImage'

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

  it('has a position and an id where they are given, 0 included', () => {
    const image = createDamImage({ fileId: FILE, licenceId: 7 }, {}, { position: 0, id: 0 })

    expect(image).toMatchObject({ position: 0, id: 0 })
    expect(
      Object.keys(createDamImage({ fileId: FILE, licenceId: 7 }, {}, { position: undefined, id: undefined }))
    ).toEqual(['texts', 'flags', 'dam'])
  })
})

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

describe('the file of a DAM image URL', () => {
  it('is read from the original, from any crop and from an animation', () => {
    // Only the original was read, so a crop URL copied from the DAM was refused as a wrong URL.
    expect(damImageFileIdFromUrl(`http://image1.smedata.local/image/original/${FILE}.jpg`)).toBe(FILE)
    expect(damImageFileIdFromUrl(`http://admin-image1.smedata.local/image/w500-h281-c0/${FILE}.jpg`)).toBe(FILE)
    expect(damImageFileIdFromUrl(`https://img.example.sk/image/w1200-h675/${FILE}.jpg`)).toBe(FILE)
    expect(damImageFileIdFromUrl(`https://img.example.sk/image/w1200-h675-c2-q80/${FILE}.jpg?timestamp=1`)).toBe(FILE)
    expect(damImageFileIdFromUrl(`https://img.example.sk/image/animated/${FILE}.gif`)).toBe(FILE)
  })

  it('is not read from other URLs', () => {
    expect(damImageFileIdFromUrl(`https://img.example.sk/image/w1200/${FILE}.jpg`)).toBeUndefined()
    expect(damImageFileIdFromUrl(`https://img.example.sk/image/original/${FILE}.jpg.html`)).toBeUndefined()
    expect(damImageFileIdFromUrl(`https://www.example.sk/clanok/${FILE}.jpg`)).toBeUndefined()
    expect(damImageFileIdFromUrl('https://img.example.sk/image/original/not-a-uuid.jpg')).toBeUndefined()
  })
})
