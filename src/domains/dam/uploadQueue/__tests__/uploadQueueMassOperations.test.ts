import { describe, expect, it, vi } from 'vitest'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueMassOperations } from '@/domains/dam/uploadQueue/composables/uploadQueueMassOperations'

const queue = vi.hoisted(() => ({ items: [] as unknown[] }))
vi.mock('@/domains/dam/uploadQueue/store/uploadQueuesStore', () => ({
  useUploadQueuesStore: () => ({ getQueueItems: () => queue.items }),
}))

const item = (assetType: string, customData: Record<string, unknown>) => ({ assetType, customData }) as UploadQueueItem

describe('mass operations of the upload queue: a custom value', () => {
  const fill = (items: UploadQueueItem[], forceReplace = false) => {
    queue.items = items
    useUploadQueueMassOperations('queue').replaceEmptyCustomDataValue(
      { assetType: DamAssetType.Image, elementProperty: 'title', value: 'filled' },
      forceReplace
    )
    return items.map((one) => one.customData.title)
  }

  // `null` is an emptied value, such as a cleared number, and is how the API returns it.
  it('fills what is empty: never set, an empty text, null, or an empty list', () => {
    expect(
      fill([
        item(DamAssetType.Image, {}),
        item(DamAssetType.Image, { title: '' }),
        item(DamAssetType.Image, { title: null }),
        item(DamAssetType.Image, { title: [] }),
      ])
    ).toEqual(['filled', 'filled', 'filled', 'filled'])
  })

  it('keeps a value that is there, zero and false included, and the items of another asset type', () => {
    expect(
      fill([
        item(DamAssetType.Image, { title: 'kept' }),
        item(DamAssetType.Image, { title: 0 }),
        item(DamAssetType.Image, { title: false }),
        item(DamAssetType.Image, { title: ['kept'] }),
        item(DamAssetType.Audio, {}),
      ])
    ).toEqual(['kept', 0, false, ['kept'], undefined])
  })

  it('replaces every value of the asset type on request', () => {
    expect(
      fill([item(DamAssetType.Image, { title: 'kept' }), item(DamAssetType.Audio, { title: 'kept' })], true)
    ).toEqual(['filled', 'kept'])
  })

  it.each([
    ['fills', false, {}],
    ['replaces', true, { tags: ['kept'] }],
  ])('hands every row it %s a list of its own', (_how, forceReplace, customData) => {
    const items = [item(DamAssetType.Image, { ...customData }), item(DamAssetType.Image, { ...customData })]
    const value = ['one', 'two']
    queue.items = items

    useUploadQueueMassOperations('queue').replaceEmptyCustomDataValue(
      { assetType: DamAssetType.Image, elementProperty: 'tags', value },
      forceReplace
    )

    const [first, second] = items.map((one) => one.customData.tags as string[])
    expect([first, second]).toEqual([value, value])
    expect(first).not.toBe(second)
    expect([first, second]).not.toContain(value)
    first!.push('own')
    expect([second, value]).toEqual([
      ['one', 'two'],
      ['one', 'two'],
    ])
  })
})

const lists: Array<['keywords' | 'authors', 'replaceEmptyKeywords' | 'replaceEmptyAuthors']> = [
  ['keywords', 'replaceEmptyKeywords'],
  ['authors', 'replaceEmptyAuthors'],
]
describe.each(lists)('mass operations of the upload queue: %s', (field, operation) => {
  const row = (assetType: string, ids: string[] | undefined) =>
    ({ assetType, [field]: ids }) as unknown as UploadQueueItem
  const fill = (items: UploadQueueItem[], forceReplace?: boolean) => {
    queue.items = items
    useUploadQueueMassOperations('queue')[operation](['filled-1', 'filled-2'], forceReplace)
    return items.map((one) => one[field])
  }

  it('fill the rows that have none', () => {
    expect(fill([row(DamAssetType.Image, []), row(DamAssetType.Image, undefined)])).toEqual([
      ['filled-1', 'filled-2'],
      ['filled-1', 'filled-2'],
    ])
  })

  it('keep what a row has', () => {
    expect(fill([row(DamAssetType.Image, ['kept']), row(DamAssetType.Image, [])])).toEqual([
      ['kept'],
      ['filled-1', 'filled-2'],
    ])
  })

  it('replace what every row has on request', () => {
    expect(fill([row(DamAssetType.Image, ['kept']), row(DamAssetType.Image, [])], true)).toEqual([
      ['filled-1', 'filled-2'],
      ['filled-1', 'filled-2'],
    ])
  })

  // Unlike custom values, which go only to rows of their own asset type.
  // The library queues images only, so the two rules never disagree on a row.
  it('go into the rows of every asset type', () => {
    expect(fill([row(DamAssetType.Image, []), row(DamAssetType.Audio, []), row(DamAssetType.Video, ['kept'])])).toEqual(
      [['filled-1', 'filled-2'], ['filled-1', 'filled-2'], ['kept']]
    )
  })

  it('leave the other of the two alone', () => {
    const other = field === 'keywords' ? 'authors' : 'keywords'
    const item = { assetType: DamAssetType.Image, keywords: [], authors: [] } as unknown as UploadQueueItem

    fill([item])

    expect(item[other]).toEqual([])
  })

  // Each row gets its own copy, so an edit of one row changes no other.
  it('hand every filled row a list of its own', () => {
    const items = [row(DamAssetType.Image, []), row(DamAssetType.Image, [])]
    const value = ['filled-1', 'filled-2']
    queue.items = items

    useUploadQueueMassOperations('queue')[operation](value)

    expect(items.map((one) => one[field])).toEqual([value, value])
    expect(items[0][field]).not.toBe(items[1][field])
    expect(items.some((one) => one[field] === value)).toBe(false)
    items[0][field]!.push('own')
    expect([items[1][field], value]).toEqual([
      ['filled-1', 'filled-2'],
      ['filled-1', 'filled-2'],
    ])
  })
})
