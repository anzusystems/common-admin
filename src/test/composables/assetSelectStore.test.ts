import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

const asset = (id: string) => ({ id }) as unknown as AssetSearchListItemDto

const storeWithList = (disabled: string[], singleMode = false) => {
  const store = useAssetSelectStore()
  store.setSingleMode(singleMode)
  store.setMaxCount(5)
  store.setList([asset('a'), asset('b'), asset('c')])
  store.setDisabledReasons(new Map(disabled.map((id) => [id, 'unusable'])))
  return store
}

describe('assetSelectStore disabled items', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not select a disabled item', () => {
    const store = storeWithList(['a'])

    store.toggleSelectedByIndex(0)
    store.toggleSelectedByIndex(1)

    expect(store.assetListItems.map((item) => item.selected)).toEqual([false, true, false])
    expect(store.selectedCount).toBe(1)
    expect(store.selectedHasDisabled).toBe(false)
  })

  it('drops the selection of a single mode picker when a disabled item is clicked', () => {
    const store = storeWithList(['a'], true)

    store.toggleSelectedByIndex(1)
    store.toggleSelectedByIndex(0)

    expect(store.assetListItems.map((item) => item.selected)).toEqual([false, false, false])
    expect(store.selectedCount).toBe(0)
  })

  it('lets the user deselect an item that turned disabled after it was selected', () => {
    const store = storeWithList([])
    store.toggleSelectedByIndex(0)
    store.setDisabledReasons(new Map([['a', 'unusable']]))

    expect(store.selectedHasDisabled).toBe(true)

    store.toggleSelectedByIndex(0)

    expect(store.assetListItems[0].selected).toBe(false)
    expect(store.selectedCount).toBe(0)
    expect(store.selectedHasDisabled).toBe(false)
  })

  it('keeps the reason of an item that a later computation does not mention', () => {
    const store = storeWithList(['a'])

    store.setDisabledReasons(new Map([['b', null]]))

    expect(store.assetListItems.map((item) => item.disabledReason)).toEqual(['unusable', null, null])
  })
})
