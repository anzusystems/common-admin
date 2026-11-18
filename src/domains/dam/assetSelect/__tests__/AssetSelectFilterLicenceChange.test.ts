import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import AssetSelectFilter from '@/domains/dam/assetSelect/components/AssetSelectFilter.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'

// Opening the picker applies its first licence choice; that is no change by the user, so the filter is not reset and
// the sidebar the picker has just opened stays open. Choosing other licences later resets the filter as before.

const { resetAssetList } = vi.hoisted(() => ({ resetAssetList: vi.fn() }))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ assetListEnabledFilters: undefined, currentUser: false }),
}))

vi.mock('@/domains/dam/assetSelect/composables/assetSelectListActions', () => ({
  useAssetSelectActions: () => ({
    fetchAssetListDebounced: vi.fn(),
    resetAssetList,
    pagination: ref({ page: 1 }),
  }),
}))

const selectConfigs = [10, 20].map(
  (licence) => ({ licence, extSystem: 1, licenceName: `Licence ${licence}` }) as DamConfigLicenceExtSystemReturnType
)

describe('AssetSelectFilter and the licence choice', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    resetAssetList.mockClear()
  })

  const mountFilter = async () => {
    // A narrow window, where the filter closes the sidebar after a reset.
    await page.viewport(414, 896)
    const pinia = createPinia()
    const store = useAssetSelectStore(pinia)
    store.setSelectConfig(selectConfigs)
    const sidebar = useSidebar()
    sidebar.openSidebarLeft()
    wrapper = mount(AssetSelectFilter, {
      props: { configName: 'default' },
      global: { plugins: [pinia], stubs: { AFilterWrapperSubjectSelect: true, AssetSelectFilterForm: true } },
    })
    await flushPromises()
    return { store, sidebar }
  }

  it('keeps the filter and the open sidebar when the picker applies its first choice', async () => {
    const { store, sidebar } = await mountFilter()

    expect(store.selectedLicenceIds).toEqual([10])
    expect(resetAssetList).not.toHaveBeenCalled()
    expect(sidebar.sidebarLeft.value).toBe(true)
  })

  it('resets the filter when the user chooses other licences', async () => {
    const { store, sidebar } = await mountFilter()

    store.setSelectedLicenceIds([20])
    await flushPromises()

    expect(resetAssetList).toHaveBeenCalledTimes(1)
    expect(sidebar.sidebarLeft.value).toBe(false)
  })

  it('resets the filter for a choice after the licences were cleared while the picker is open', async () => {
    const { store } = await mountFilter()

    store.setSelectedLicenceIds([])
    await flushPromises()
    store.setSelectedLicenceIds([20])
    await flushPromises()

    expect(resetAssetList).toHaveBeenCalledTimes(2)
  })
})
