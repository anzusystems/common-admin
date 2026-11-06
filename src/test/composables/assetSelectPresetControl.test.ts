import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { defineAuth } from '@/composables/auth/defineAuth'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetSelectPresetControl } from '@/components/dam/assetSelect/composables/assetSelectPresetControl'
import {
  AssetSelectPresetAll,
  assetSelectPresetStorageKey,
  useAssetSelectPresets,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import type { IntegerId } from '@/types/common'

const SELECT_LICENCES: IntegerId[] = [10, 20]
const LIST_VIEWS: IntegerId[] = [1]

let pinia: Pinia

const mountControl = async () => {
  let control!: ReturnType<typeof useAssetSelectPresetControl>
  let store!: ReturnType<typeof useAssetSelectStore>
  mount(
    defineComponent({
      setup() {
        control = useAssetSelectPresetControl(SELECT_LICENCES, LIST_VIEWS)
        store = useAssetSelectStore()
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } },
  )
  await flushPromises()
  return { control, store }
}

describe('useAssetSelectPresetControl', () => {
  beforeEach(() => {
    pinia = createPinia()
    localStorage.clear()
    const { useCurrentUser } = defineAuth(SYSTEM_DAM)
    useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM).setCurrentUser({
      id: 1,
      roles: [],
      listViews: [{ id: 1, name: 'Šport a regióny', extSystem: 1, licences: [10, 30] }],
    } as unknown as DamCurrentUserDto)
  })

  it.each<[string, string | null, string, IntegerId[]]>([
    ['nothing remembered', null, AssetSelectPresetAll, [10, 20]],
    ['remembered list view', 'listView:1', 'listView:1', [10]],
    ['remembered single licence', 'licence:20', 'licence:20', [20]],
    ['remembered key this host does not offer', 'listView:9', AssetSelectPresetAll, [10, 20]],
  ])(
    'opens on the right selection for %s',
    async (_name, storedKey, expectedKey, expectedLicenceIds) => {
      if (storedKey) {
        useAssetSelectPresets(assetSelectPresetStorageKey(SELECT_LICENCES, LIST_VIEWS)).storeState({
          presetKey: storedKey,
        })
      }

      const { control } = await mountControl()

      expect(control.selectedPresetKey.value).toBe(expectedKey)
      expect(control.selectedLicenceIds.value).toEqual(expectedLicenceIds)
    },
  )

  it('reopens a closed picker on the chosen selection', async () => {
    const { control, store } = await mountControl()
    control.applyPreset('licence:20')
    store.reset(true)
    store.setSelectConfig(
      SELECT_LICENCES.map(
        (licence) =>
          ({
            licence,
            extSystem: 1,
            licenceName: '',
          }) as unknown as DamConfigLicenceExtSystemReturnType,
      ),
    )

    const { control: reopened } = await mountControl()

    expect(reopened.selectedPresetKey.value).toBe('licence:20')
    expect(reopened.selectedLicenceIds.value).toEqual([20])
  })
})
