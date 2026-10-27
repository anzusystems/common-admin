import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import type { AssetSearchListItemDto } from '@/domains/dam/types/Asset'

// The active item is the last clicked asset, wherever a list read anew has it.
// User-level behavior is covered in `consumerProfileAssetListUpload.test.ts`
// and `consumerProfileImageWidgetLibrary.test.ts`.
// This file covers two page orders caused by the server and timing.

const asset = (id: string) => ({ id }) as AssetSearchListItemDto
const items = () => useAssetSelectStore().assetListItems.map((item) => [item.asset.id, item.active])

describe('assetSelectStore active item', () => {
  // Pages are cut by offset. An asset added to the DAM meanwhile shifts the rest,
  // so the next page starts with the last asset of the previous page.
  it('stays the one item it is when a further page repeats its asset', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setList([asset('A'), asset('B')])
    store.setActiveByIndex(1)

    store.appendList([asset('B'), asset('C')])
    expect(items()).toEqual([
      ['A', false],
      ['B', true],
      ['B', false],
      ['C', false],
    ])

    store.setActiveByIndex(3)
    expect(items()).toEqual([
      ['A', false],
      ['B', false],
      ['B', false],
      ['C', true],
    ])
  })

  // A page requested before the list was emptied can arrive after the reset and be added ahead of the list read anew.
  it('is none once the list alone was reset, and is the item clicked next, at whatever place', () => {
    setActivePinia(createPinia())
    const store = useAssetSelectStore()
    store.setList([asset('A'), asset('B')])
    store.setActiveByIndex(0)

    store.reset(false)
    store.appendList([asset('A'), asset('C')])
    expect(items()).toEqual([
      ['A', false],
      ['C', false],
    ])

    store.setActiveByIndex(0)
    expect(items()).toEqual([
      ['A', true],
      ['C', false],
    ])
  })
})
