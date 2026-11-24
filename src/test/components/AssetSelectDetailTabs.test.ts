import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AssetSelectDetailTabs from '@/components/dam/assetSelect/components/AssetSelectDetailTabs.vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto, AssetSingleUseUsage } from '@/types/coreDam/Asset'
import { DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'

const { fetchUsage } = vi.hoisted(() => ({ fetchUsage: vi.fn() }))

vi.mock('@/components/damImage/composables/commonAdminImageOptions', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/components/damImage/composables/commonAdminImageOptions')
  >()),
  useImageSingleUseUsageFetch: () => fetchUsage,
}))

vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({
    singleUseUsageUrl: (groupId: string) => `/images#damGroupId=${groupId}`,
    singleUsePlaceUrl: undefined,
  }),
}))

const usage = (partial: Partial<AssetSingleUseUsage> = {}): AssetSingleUseUsage => ({
  holder: { resourceName: 'person', resourceId: 5, pickedAt: '2026-01-01T10:00:00Z' },
  status: 'conflict',
  blocked: false,
  usageCount: 1,
  usages: [{ resourceName: 'person', resourceId: 5, pickedAt: '2026-01-01T10:00:00Z' }],
  ...partial,
})

const mountTabs = (singleUse: boolean, assetType: DamAssetTypeType = DamAssetType.Image) => {
  const pinia = createPinia()
  const store = useAssetSelectStore(pinia)
  store.setList([
    {
      id: 'a',
      licence: 10,
      attributes: { assetType },
      mainFile: { id: 'file-a', flags: { singleUse }, fileAttributes: { takenOverFromId: '' } },
    } as unknown as AssetSearchListItemDto,
  ])
  return mount(
    defineComponent(() => () => h(AssetSelectDetailTabs, { item: store.assetListItems[0] })),
    { global: { plugins: [pinia] } },
  )
}

const openUsage = async (wrapper: ReturnType<typeof mountTabs>) => {
  await wrapper.find('[data-cy="asset-select-usage-tab"]').trigger('click')
  await flushPromises()
}

describe('AssetSelectDetailTabs', () => {
  beforeEach(() => fetchUsage.mockReset())

  it('shows the usages of an image that is not single use, without a holder, status or warning', async () => {
    fetchUsage.mockResolvedValue({ 'file-a': usage() })
    const wrapper = mountTabs(false)

    expect(fetchUsage).not.toHaveBeenCalled()
    await openUsage(wrapper)

    expect(fetchUsage).toHaveBeenCalledWith(['file-a'], null)
    expect(wrapper.text()).toContain('(5)')
    expect(wrapper.text()).toContain('Show all usages')
    expect(wrapper.text()).not.toContain('Holder')
    expect(wrapper.text()).not.toContain('Another record already uses the image.')
    expect(wrapper.find('.text-warning, .bg-warning').exists()).toBe(false)
  })

  it('says that nobody uses an image that is not single use', async () => {
    fetchUsage.mockResolvedValue({
      'file-a': usage({ holder: null, status: 'placement', usageCount: 0, usages: [] }),
    })
    const wrapper = mountTabs(false)

    await openUsage(wrapper)

    expect(wrapper.text()).toContain('Nobody uses the image yet.')
  })

  it('adds the holder, status and warning for a single use image', async () => {
    fetchUsage.mockResolvedValue({ 'file-a': usage() })
    const wrapper = mountTabs(true)

    await openUsage(wrapper)

    expect(wrapper.text()).toContain('Holder')
    expect(wrapper.text()).toContain('Another record already uses the image.')
    expect(wrapper.find('.bg-warning').exists()).toBe(true)
  })

  it('has no usage tab for an asset that is not an image', () => {
    const wrapper = mountTabs(false, DamAssetType.Document)

    expect(wrapper.find('[data-cy="asset-select-usage-tab"]').exists()).toBe(false)
  })
})
