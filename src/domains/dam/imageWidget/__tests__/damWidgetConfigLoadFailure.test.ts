import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AssetDistributionServiceNameFilter from '@/domains/dam/assetSelect/components/AssetDistributionServiceNameFilter.vue'

// A widget whose DAM config did not load must say so. Rendered "ready" it offers an upload that reads
// the store default chunk size of 0 bytes.
const loadDamPrvConfig = vi.hoisted(() => vi.fn())
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => undefined,
    getExtSystemByLicence: async () => 1,
    loadDamPrvConfig,
    loadDamConfigAssetCustomFormElements: async () => true,
    getDamConfigAssetCustomFormElements: () => ({ image: [], audio: [], video: [], document: [] }),
    getOrLoadDamConfigExtSystemByLicence: async (licence: number) => ({
      licence,
      extSystem: 1,
      licenceName: '',
      extSystemConfig: {},
    }),
    getOrLoadDamConfigExtSystemByLicences: async () => [],
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}) }),
}))
vi.mock('@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isImageWidgetUploadConfigAllowed: () => true,
}))

const common = { queueKey: 'q', uploadLicence: 1, selectLicences: [1] }
const cases = [
  [
    'AImageWidget',
    AImageWidget,
    { ...common, modelValue: null },
    'ImageWidgetInner',
    'Loading Media Library config error',
  ],
  [
    'AImageWidgetMultiple',
    AImageWidgetMultiple,
    { ...common, modelValue: [] },
    'ImageWidgetMultipleInner',
    'Loading Media Library config error',
  ],
  [
    'AImageMediaWidget',
    AImageMediaWidget,
    { ...common, image: null, media: null },
    'ImageMediaWidgetInner',
    'Loading Media Library config error',
  ],
  [
    'AssetDistributionServiceNameFilter',
    AssetDistributionServiceNameFilter,
    { name: 'x' },
    'AFilterValueObjectOptionsSelect',
    'Error loading distribution services.',
  ],
] as const

describe('DAM widgets when the prv config fails to load', () => {
  it.each(cases)('%s shows the error, not the widget', async (_, component, props, inner, message) => {
    loadDamPrvConfig.mockRejectedValue(false)
    const wrapper = mount(component as any, { props: props as any, global: { stubs: { [inner]: true } } })
    await flushPromises()
    expect(loadDamPrvConfig).toHaveBeenCalled()
    expect(wrapper.findComponent({ name: inner }).exists()).toBe(false)
    expect(wrapper.text()).toContain(message)
    wrapper.unmount()
  })
})
