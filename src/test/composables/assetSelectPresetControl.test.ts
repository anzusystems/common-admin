import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { defineAuth } from '@/composables/auth/defineAuth'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetSelectPresetControl } from '@/components/dam/assetSelect/composables/assetSelectPresetControl'
import {
  AssetSelectPresetAll,
  useAssetSelectPresets,
  useAssetSelectPresetStorageKey,
} from '@/components/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import type { IntegerId } from '@/types/common'

const { fetchCachedAssetLicences } = vi.hoisted(() => ({
  fetchCachedAssetLicences: vi.fn(),
}))

vi.mock('@/components/damImage/composables/cachedDamAssetLicences', () => ({
  useDamCachedAssetLicences: () => ({
    addToCachedAssetLicences: vi.fn(),
    fetchCachedAssetLicences,
    getCachedAssetLicence: () => undefined,
  }),
}))

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
    fetchCachedAssetLicences.mockReset().mockResolvedValue(undefined)
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
        useAssetSelectPresets(
          useAssetSelectPresetStorageKey(SELECT_LICENCES, LIST_VIEWS),
        ).storeState({
          presetKey: storedKey,
        })
      }

      const { control } = await mountControl()

      expect(control.selectedPresetKey.value).toBe(expectedKey)
      expect(control.selectedLicenceIds.value).toEqual(expectedLicenceIds)
      expect(control.isModified.value).toBe(false)
    },
  )

  it('opens on the remembered selection while the licence names are still loading', async () => {
    fetchCachedAssetLicences.mockReturnValue(new Promise(() => {}))
    useAssetSelectPresets(useAssetSelectPresetStorageKey(SELECT_LICENCES, LIST_VIEWS)).storeState({
      presetKey: 'licence:20',
    })

    const { control } = await mountControl()

    expect(control.selectedPresetKey.value).toBe('licence:20')
    expect(control.selectedLicenceIds.value).toEqual([20])
  })

  it('marks the selection modified when a licence is dropped and keeps the last one', async () => {
    const { control } = await mountControl()

    control.removeLicence(10)
    control.removeLicence(20)

    expect(control.selectedLicenceIds.value).toEqual([20])
    expect(control.isModified.value).toBe(true)
    expect(control.isClearable.value).toBe(false)
  })

  it.each<[string, string, string, IntegerId[]]>([
    ['selection this host offers', 'listView:1', 'listView:1', [10]],
    ['all licences for a key set by another picker', 'listView:9', AssetSelectPresetAll, [10, 20]],
  ])(
    'resets a narrowed search to the %s',
    async (_name, activeKey, expectedKey, expectedLicenceIds) => {
      const { control, store } = await mountControl()
      control.applyPreset(AssetSelectPresetAll)
      control.removeLicence(10)
      store.setSelectedPresetKey(activeKey)

      control.resetToPreset()

      expect(control.selectedPresetKey.value).toBe(expectedKey)
      expect(control.selectedLicenceIds.value).toEqual(expectedLicenceIds)
      expect(control.isModified.value).toBe(false)
    },
  )
})
