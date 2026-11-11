import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h, ref } from 'vue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import type { IntegerId } from '@/shared/types/common'
import { DamAssetType } from '@/domains/dam/types/Asset'

// Hosts often mount a picker before their entity has loaded: its licences come later. The picker reads its licences
// again whenever the host passes others, and only the latest read counts.

const { loadConfigs, reset } = vi.hoisted(() => ({
  loadConfigs: vi.fn(async (licences: number[]) =>
    licences.filter((licence) => licence > 0).map((licence) => ({ licence, extSystem: 1, licenceName: 'Licence' }))
  ),
  reset: vi.fn(),
}))

vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getOrLoadDamConfigExtSystemByLicences: loadConfigs,
    loadDamConfigAssetCustomFormElements: vi.fn(),
    getDamConfigAssetCustomFormElements: vi.fn(),
  }),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ copyToLicenceEnabled: undefined }),
}))

vi.mock('@/domains/dam/assetSelect/composables/assetSelectListActions', () => ({
  useAssetSelectActions: () => ({
    damClient: vi.fn(),
    selectedCount: ref(0),
    loader: ref(false),
    pagination: ref({}),
    fetchNextPage: vi.fn(),
    fetchNextPageInView: vi.fn(),
    getSelectedData: vi.fn(),
    initStoreContext: vi.fn(),
    detailLoading: ref(false),
    fetchAssetListDebounced: vi.fn(),
    giveUpDetailRead: vi.fn(),
    reset,
  }),
}))

describe.each([
  ['AAssetSelect', AAssetSelect, { assetType: DamAssetType.Image }],
  ['AAssetSelectMedia', AAssetSelectMedia, {}],
] as const)('%s', (_name, picker, ownProps) => {
  const mountPicker = (selectLicences: IntegerId[]) =>
    mount(picker as typeof AAssetSelect, {
      props: { ...ownProps, selectLicences, minCount: 1, maxCount: 1, skipCurrentUserCheck: true } as never,
      slots: {
        activator: ({ props }: { props: Record<string, unknown> }) => h('button', { class: 'activator', ...props }),
      },
      global: { plugins: [createPinia()], stubs: { VDialog: true } },
    })

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
        })
    )
    const wrapper = mountPicker([0])
    await wrapper.setProps({ selectLicences: [] })
    await flushPromises()

    finishOlderLoad()
    await flushPromises()

    expect(wrapper.find('.activator').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes an open picker when the host passes other licences', async () => {
    const wrapper = mountPicker([5])
    await flushPromises()
    await wrapper.find('.activator').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
    reset.mockClear()

    await wrapper.setProps({ selectLicences: [6] })
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(reset).toHaveBeenCalled()
    expect(wrapper.find('.activator').exists()).toBe(true)
    wrapper.unmount()
  })
})
