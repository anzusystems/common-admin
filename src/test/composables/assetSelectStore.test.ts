import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import { AssetSelectReturnType } from '@/types/coreDam/AssetSelect'

const asset = (id: string) =>
  ({ id, licence: 10, mainFile: { id: `file-${id}` } }) as unknown as AssetSearchListItemDto

const HELD = 'common.assetSelect.disabledReason.singleUseHeld'

describe('useAssetSelectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it.each<[string, boolean, string[]]>([
    ['multi pick ignores a click on a disabled photo', false, ['free']],
    ['single pick drops the previous pick on a click on a disabled photo', true, []],
  ])('%s', (_name, singleMode, expectedSelectedIds) => {
    const store = useAssetSelectStore()
    store.setSingleMode(singleMode)
    store.setMaxCount(5)
    store.setList([asset('free'), asset('held')])
    store.toggleSelectedByIndex(0)
    store.setDisabledReasons(new Map([['held', HELD]]))

    store.toggleSelectedByIndex(1)

    expect(store.getSelectedData(AssetSelectReturnType.AssetId).value).toEqual(expectedSelectedIds)
    expect(store.assetListItems[1]?.selected).toBe(false)
  })

  it('lets the editor drop a picked photo whose reason arrived after the pick', () => {
    const store = useAssetSelectStore()
    store.setMaxCount(5)
    store.setList([asset('held')])
    store.toggleSelectedByIndex(0)
    store.setDisabledReasons(new Map([['held', HELD]]))
    expect(store.selectedHasDisabled).toBe(true)

    store.toggleSelectedByIndex(0)

    expect(store.selectedCount).toBe(0)
    expect(store.selectedHasDisabled).toBe(false)
  })

  it('keeps the reasons of earlier pages when the next page is resolved', () => {
    const store = useAssetSelectStore()
    store.setList([asset('first-page')])
    store.setDisabledReasons(new Map([['first-page', HELD]]))

    const appended = store.appendList([asset('second-page')])
    store.setDisabledReasons(new Map(appended.map((item) => [item.asset.id, null])))

    expect(appended.map((item) => item.asset.id)).toEqual(['second-page'])
    expect(store.assetListItems.map((item) => item.disabledReason)).toEqual([HELD, null])
  })

  it('leaves no selectability or selection of a closed picker to the next one', () => {
    const store = useAssetSelectStore()
    store.setSelectability({
      singleUseAllowed: true,
      uploadLicence: 3,
      holder: { resourceName: 'minutePost', resourceId: '1' },
    })
    store.setSelectedPresetKey('listView:1')
    store.setSelectedLicenceIds([10, 20])

    store.reset(true)

    expect(store.selectability).toBeNull()
    expect(store.selectedPresetKey).toBe('')
    expect(store.selectedLicenceIds).toEqual([])
  })
})
