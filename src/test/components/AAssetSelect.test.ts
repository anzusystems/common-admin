import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { IntegerId } from '@/types/common'
import { DamAssetType } from '@/types/coreDam/Asset'

const loadConfigs = vi.fn(async (licences: IntegerId[]) =>
  licences.filter((licence) => licence > 0).map((licence) => ({ licence, extSystem: 1, licenceName: 'Licence' })),
)

vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getOrLoadDamConfigExtSystemByLicences: loadConfigs,
    loadDamConfigAssetCustomFormElements: vi.fn(),
    getDamConfigAssetCustomFormElements: vi.fn(),
  }),
}))

vi.mock('@/components/dam/assetSelect/composables/assetSelectListActions', () => ({
  useAssetSelectActions: () => ({
    damClient: vi.fn(),
    selectedCount: ref(0),
    loader: ref(false),
    pagination: ref({}),
    fetchNextPage: vi.fn(),
    getSelectedData: vi.fn(),
    initStoreContext: vi.fn(),
    detailLoading: ref(false),
    fetchAssetListDebounced: vi.fn(),
    reset: vi.fn(),
  }),
}))

const mountPicker = (selectLicences: IntegerId[]) =>
  mount(AAssetSelect, {
    props: { selectLicences, assetType: DamAssetType.Image, minCount: 1, maxCount: 1 },
    slots: { activator: () => h('button', { class: 'activator' }) },
  })

describe('AAssetSelect', () => {
  it('shows the activator once the host passes the licences of its loaded entity', async () => {
    const wrapper = mountPicker([0])
    await flushPromises()
    expect(wrapper.find('.activator').exists()).toBe(false)

    await wrapper.setProps({ selectLicences: [5] })
    await flushPromises()

    expect(wrapper.find('.activator').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not reload when the host passes the same licences in a new array', async () => {
    const wrapper = mountPicker([5])
    await flushPromises()
    loadConfigs.mockClear()

    await wrapper.setProps({ selectLicences: [5] })
    await flushPromises()

    expect(loadConfigs).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps the configs of the latest licences when an older load finishes last', async () => {
    let finishOlderLoad: () => void = () => {}
    loadConfigs.mockImplementationOnce(
      (licences) =>
        new Promise((resolve) => {
          finishOlderLoad = () => resolve(licences.map((licence) => ({ licence, extSystem: 1, licenceName: 'Old' })))
        }),
    )
    const wrapper = mountPicker([0])
    await wrapper.setProps({ selectLicences: [] })
    await flushPromises()

    finishOlderLoad()
    await flushPromises()

    expect(wrapper.find('.activator').exists()).toBe(false)
    wrapper.unmount()
  })
})
