import { describe, expect, it } from 'vitest'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import { fillAuthors, fillCustomDataValue, fillKeywords } from '@/domains/dam/uploadQueue/core/uploadQueueFill'

// The three fills of the mass operations, which the library's composable calls over the rows of a queue and
// admin-dam's store over its own, with what it accepts. They read the type of a row, its custom data, its keywords
// and its authors, and nothing else: admin-dam's tests seed rows with only those.

/** A row with only what a fill reads. */
const bare = (assetType: DamAssetTypeType, parts: Record<string, unknown> = {}) =>
  ({ assetType, customData: {}, keywords: [], authors: [], ...parts }) as unknown as UploadQueueItem

describe('the fill of a custom field', () => {
  const fill = { assetType: DamAssetType.Image, elementProperty: 'title', value: 'Filled' }

  it('fills the field where the row of the type has it empty, and keeps a value already there', () => {
    const rows = [
      bare(DamAssetType.Image),
      bare(DamAssetType.Image, { customData: { title: null } }),
      bare(DamAssetType.Image, { customData: { title: '' } }),
      bare(DamAssetType.Image, { customData: { title: [] } }),
      bare(DamAssetType.Image, { customData: { title: 'Typed' } }),
      bare(DamAssetType.Image, { customData: { title: ['one'] } }),
    ]

    fillCustomDataValue(rows, fill)

    expect(rows.map((row) => row.customData.title)).toEqual(['Filled', 'Filled', 'Filled', 'Filled', 'Typed', ['one']])
  })

  it('replaces it in every row of the type when told to, and leaves the rows of another type alone', () => {
    const rows = [
      bare(DamAssetType.Image, { customData: { title: 'Typed' } }),
      bare(DamAssetType.Video, { customData: { title: 'Of a video' } }),
      bare(DamAssetType.Video),
    ]

    fillCustomDataValue(rows, fill, true)

    expect(rows.map((row) => row.customData)).toEqual([{ title: 'Filled' }, { title: 'Of a video' }, {}])
  })
})

describe.each([
  ['keywords', fillKeywords, 'keywords'],
  ['authors', fillAuthors, 'authors'],
] as const)('the fill of the %s', (_what, fillList, field) => {
  const list = (row: UploadQueueItem) => row[field]

  it('fills the rows without any, a row with none at all among them, and keeps those that have some', () => {
    const rows = [
      bare(DamAssetType.Image),
      bare(DamAssetType.Video, { [field]: undefined }),
      bare(DamAssetType.Audio, { [field]: ['kept'] }),
    ]

    fillList(rows, ['picked'])

    expect(rows.map(list)).toEqual([['picked'], ['picked'], ['kept']])
  })

  it('replaces them in every row when told to; an empty pick empties them', () => {
    const rows = [bare(DamAssetType.Image, { [field]: ['old'] }), bare(DamAssetType.Video)]

    fillList(rows, ['picked'], true)
    expect(rows.map(list)).toEqual([['picked'], ['picked']])

    fillList(rows, [], true)
    expect(rows.map(list)).toEqual([[], []])
  })

  // admin-dam: only into the rows of a type that has them enabled.
  it('writes only into the rows it is told it accepts, also when told to replace', () => {
    const rows = [
      bare(DamAssetType.Image),
      bare(DamAssetType.Video),
      bare(DamAssetType.Image, { [field]: ['old'] }),
      bare(DamAssetType.Video, { [field]: ['of a video'] }),
    ]
    const accepts = (row: UploadQueueItem) => row.assetType === DamAssetType.Image

    fillList(rows, ['picked'], false, accepts)
    expect(rows.map(list)).toEqual([['picked'], [], ['old'], ['of a video']])

    fillList(rows, ['replaced'], true, accepts)
    expect(rows.map(list)).toEqual([['replaced'], [], ['replaced'], ['of a video']])
  })
})

describe('a row with only what the fills read', () => {
  it('is filled by all three, and is given nothing else', () => {
    const row = bare(DamAssetType.Image)

    fillCustomDataValue([row], { assetType: DamAssetType.Image, elementProperty: 'title', value: 'Filled' })
    fillKeywords([row], ['keyword-1'])
    fillAuthors([row], ['author-1'])

    expect(row).toEqual({
      assetType: DamAssetType.Image,
      customData: { title: 'Filled' },
      keywords: ['keyword-1'],
      authors: ['author-1'],
    })
  })
})
