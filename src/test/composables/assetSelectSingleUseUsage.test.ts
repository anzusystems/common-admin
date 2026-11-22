import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import {
  useAssetSelectUsageRefresh,
  useSingleUseUsageCheck,
} from '@/components/dam/assetSelect/composables/assetSelectSingleUseUsage'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto, AssetSingleUseUsage } from '@/types/coreDam/Asset'

const { executeFetch, showErrorsDefault } = vi.hoisted(() => ({
  executeFetch: vi.fn(),
  showErrorsDefault: vi.fn(),
}))

vi.mock(
  '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions')
    >()),
    useCommonAdminCoreDamOptions: () => ({
      damClient: () => ({}),
      endPointAsset: '/adm/v1/asset',
    }),
  }),
)

vi.mock('@/labs/api/useApiFetchList', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/labs/api/useApiFetchList')>()),
  useApiFetchList: () => ({ executeFetch }),
}))

vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...actual, useAlerts: () => ({ ...actual.useAlerts(), showErrorsDefault }) }
})

const usage = (partial: Partial<AssetSingleUseUsage> = {}): AssetSingleUseUsage => ({
  totalCount: 1,
  otherHolderCount: 1,
  blocked: false,
  holderPickedAt: null,
  places: [{ resourceName: 'person', resourceId: 5, imageId: 9, pickedAt: null }],
  ...partial,
})

const asset = (id: string, singleUse = true, singleUseUsage: AssetSingleUseUsage | null = null) =>
  ({
    id,
    licence: 10,
    mainFile: { id: `file-${id}`, flags: { singleUse } },
    singleUseUsage,
  }) as unknown as AssetSearchListItemDto

const sentFilter = () => executeFetch.mock.calls[0][1]

let pinia: Pinia

const mountComposables = () => {
  let refresh!: ReturnType<typeof useAssetSelectUsageRefresh>
  let check!: ReturnType<typeof useSingleUseUsageCheck>
  let store!: ReturnType<typeof useAssetSelectStore>
  mount(
    defineComponent({
      setup() {
        refresh = useAssetSelectUsageRefresh()
        check = useSingleUseUsageCheck()
        store = useAssetSelectStore()
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } },
  )
  return { refresh, check, store }
}

describe('single use usage of one asset', () => {
  beforeEach(() => {
    pinia = createPinia()
    executeFetch.mockReset()
    showErrorsDefault.mockReset()
  })

  it('refreshes the usage of the listed asset for the usage holder of the picker', async () => {
    const { refresh, store } = mountComposables()
    store.setList([asset('a', true, usage({ otherHolderCount: 0, places: [] })), asset('b')])
    store.setSelectability({
      singleUseAllowed: true,
      uploadLicence: undefined,
      usageHolder: { name: 'articleKindStandard', id: 42 },
    })
    const fresh = usage({ otherHolderCount: 1, blocked: true })
    executeFetch.mockResolvedValueOnce([asset('a', true, fresh)])

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(sentFilter()).toMatchObject({
      licences: [10],
      assetAndMainFileIds: 'a',
      singleUseUsage: true,
      usageHolderName: 'articleKindStandard',
      usageHolderId: '42',
    })
    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(fresh)
    expect(store.assetListItems[1].asset.singleUseUsage).toBeNull()
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('keeps the listed usage and shows the error when the refresh fails', async () => {
    const { refresh, store } = mountComposables()
    const listed = usage()
    store.setList([asset('a', true, listed)])
    const error = new Error('timeout')
    executeFetch.mockRejectedValueOnce(error)

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(listed)
    expect(showErrorsDefault).toHaveBeenCalledWith(error)
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('does not ask DAM about a picked photo that is not single use', async () => {
    const { check } = mountComposables()

    await check.checkSingleUseUsage(asset('a', false), { name: 'person', id: 5 })

    expect(executeFetch).not.toHaveBeenCalled()
    expect(check.singleUseAsset.value).toBeNull()
  })

  it('holds the fresh usage of a picked single use photo until it is cleared', async () => {
    const { check } = mountComposables()
    const fresh = usage({ blocked: true })
    executeFetch.mockResolvedValueOnce([asset('a', true, fresh)])

    await check.checkSingleUseUsage(asset('a', true, null), null)
    await flushPromises()

    expect(sentFilter()).toMatchObject({ usageHolderName: null, usageHolderId: null })
    expect(check.singleUseAsset.value?.singleUseUsage).toEqual(fresh)

    check.clearSingleUseUsage()
    expect(check.singleUseAsset.value).toBeNull()
  })
})
