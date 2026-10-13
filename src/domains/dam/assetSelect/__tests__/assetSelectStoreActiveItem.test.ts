import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import type { AssetSearchListItemDto } from '@/domains/dam/types/Asset'

// The active item of the list is the one of the asset clicked last, wherever a list read anew has it. What a user
// reaches of it is in `consumerProfileAssetListUpload.test.ts` and `consumerProfileImageWidgetLibrary.test.ts`, on
// the tiles. Here are two orders of pages the server and the timing make, not the user.

const asset = (id: string) => ({ id }) as AssetSearchListItemDto
const items = () => useAssetSelectStore().assetListItems.map((item) => [item.asset.id, item.active])

describe('assetSelectStore active item', () => {
  // The pages are cut by an offset: an asset added to the DAM meanwhile moves the rest, and the next page begins
  // with the last asset of the page before.
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

  // A page asked for before the list was emptied can be added to the emptied list, ahead of the list read anew.
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
