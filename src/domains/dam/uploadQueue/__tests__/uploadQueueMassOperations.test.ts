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
