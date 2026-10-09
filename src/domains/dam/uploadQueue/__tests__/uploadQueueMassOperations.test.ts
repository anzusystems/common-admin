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

  // `null` is a value that was emptied, as a cleared number and as the API returns it.
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
})

// The same rule for the keywords and the authors of the rows: what is empty is filled, the rest is kept unless
// everything is to be replaced.
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

  // Unlike a custom value, which is written to the rows of its own asset type only. The library queues images
  // only, so the two rules meet no row they would disagree on.
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

  // Today: the rows are given the very list they were filled with, not a copy each.
  it('hand every filled row the same list', () => {
    const items = [row(DamAssetType.Image, []), row(DamAssetType.Image, [])]

    fill(items)

    expect(items[0][field]).toBe(items[1][field])
  })
})
