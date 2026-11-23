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

const { fetchUsage, showErrorsDefault } = vi.hoisted(() => ({
  fetchUsage: vi.fn(),
  showErrorsDefault: vi.fn(),
}))

vi.mock('@/components/damImage/composables/commonAdminImageOptions', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/components/damImage/composables/commonAdminImageOptions')
  >()),
  useImageSingleUseUsageFetch: () => fetchUsage,
}))

vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...actual, useAlerts: () => ({ ...actual.useAlerts(), showErrorsDefault }) }
})

const usage = (partial: Partial<AssetSingleUseUsage> = {}): AssetSingleUseUsage => ({
  holder: { resourceName: 'person', resourceId: 5, pickedAt: '2026-01-01T10:00:00Z' },
  status: 'conflict',
  blocked: false,
  usageCount: 1,
  usages: [{ resourceName: 'person', resourceId: 5, pickedAt: '2026-01-01T10:00:00Z' }],
  ...partial,
})

const asset = (
  id: string,
  singleUse = true,
  singleUseUsage: AssetSingleUseUsage | null = null,
  takenOverFromId = '',
) =>
  ({
    id,
    licence: 10,
    mainFile: { id: `file-${id}`, flags: { singleUse }, fileAttributes: { takenOverFromId } },
    singleUseUsage,
  }) as unknown as AssetSearchListItemDto

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

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

const holder = { name: 'articleKindStandard', id: 42 }

describe('single use usage of one asset', () => {
  beforeEach(() => {
    pinia = createPinia()
    fetchUsage.mockReset()
    showErrorsDefault.mockReset()
  })

  it('refreshes the usage of the listed asset by its group for the usage holder of the picker', async () => {
    const { refresh, store } = mountComposables()
    store.setList([
      asset('a', true, usage({ status: 'free', usageCount: 0, usages: [] }), 'group-a'),
      asset('b'),
    ])
    store.setSelectability({
      singleUseAllowed: true,
      uploadLicence: undefined,
      usageHolder: holder,
    })
    const fresh = usage({ usageCount: 1, blocked: true })
    fetchUsage.mockResolvedValueOnce({ 'group-a': fresh })

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(fetchUsage).toHaveBeenCalledWith(['group-a'], holder)
    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(fresh)
    expect(store.assetListItems[1].asset.singleUseUsage).toBeNull()
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('uses the main file as the group of a photo that was not taken over', async () => {
    const { refresh, store } = mountComposables()
    store.setList([asset('a', true, usage())])
    fetchUsage.mockResolvedValueOnce({ 'file-a': usage() })

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(fetchUsage).toHaveBeenCalledWith(['file-a'], null)
  })

  it('keeps the listed usage and shows the error when the refresh fails', async () => {
    const { refresh, store } = mountComposables()
    const listed = usage()
    store.setList([asset('a', true, listed)])
    const error = new Error('timeout')
    fetchUsage.mockRejectedValueOnce(error)

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(listed)
    expect(showErrorsDefault).toHaveBeenCalledWith(error)
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('keeps the listed usage when the answer has no entry for the group', async () => {
    const { refresh, store } = mountComposables()
    const listed = usage()
    store.setList([asset('a', true, listed)])
    fetchUsage.mockResolvedValueOnce({})

    await refresh.refreshUsage(store.assetListItems[0].asset)

    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(listed)
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('does not let a slower older refresh overwrite the newer one or clear its loading', async () => {
    const { refresh, store } = mountComposables()
    store.setList([asset('a', true, usage())])
    const older = deferred<Record<string, AssetSingleUseUsage>>()
    const newer = deferred<Record<string, AssetSingleUseUsage>>()
    fetchUsage.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const listed = store.assetListItems[0].asset
    const olderRefresh = refresh.refreshUsage(listed)
    const newerRefresh = refresh.refreshUsage(listed)
    const freshNewer = usage({ usageCount: 7 })

    older.resolve({ 'file-a': usage({ usageCount: 3 }) })
    await olderRefresh
    expect(refresh.usageLoading.value).toBe(true)
    expect(store.assetListItems[0].asset.singleUseUsage).not.toEqual(usage({ usageCount: 3 }))

    newer.resolve({ 'file-a': freshNewer })
    await newerRefresh
    expect(store.assetListItems[0].asset.singleUseUsage).toEqual(freshNewer)
    expect(refresh.usageLoading.value).toBe(false)
  })

  it('does not ask the host about a picked photo that is not single use', async () => {
    const { check } = mountComposables()

    await check.checkSingleUseUsage(asset('a', false), holder)

    expect(fetchUsage).not.toHaveBeenCalled()
    expect(check.singleUseCheck.value).toBeNull()
  })

  it('holds the fresh usage of a picked single use photo until it is cleared', async () => {
    const { check } = mountComposables()
    const fresh = usage({ blocked: true })
    fetchUsage.mockResolvedValueOnce({ 'file-a': fresh })

    await check.checkSingleUseUsage(asset('a', true, null), null)
    await flushPromises()

    expect(fetchUsage).toHaveBeenCalledWith(['file-a'], null)
    expect(check.singleUseCheck.value).toMatchObject({ failed: false })
    expect(check.singleUseCheck.value?.asset.singleUseUsage).toEqual(fresh)

    check.clearSingleUseUsage()
    expect(check.singleUseCheck.value).toBeNull()
  })

  it('marks the check failed when the host does not answer, so the dialog cannot confirm', async () => {
    const { check } = mountComposables()
    fetchUsage.mockRejectedValueOnce(new Error('host down'))

    await check.checkSingleUseUsage(asset('a', true, null), holder)
    await flushPromises()

    expect(check.singleUseCheck.value).toMatchObject({ failed: true })
  })

  it('marks the check failed when the answer has no entry for the group', async () => {
    const { check } = mountComposables()
    fetchUsage.mockResolvedValueOnce({})

    await check.checkSingleUseUsage(asset('a', true, null), holder)
    await flushPromises()

    expect(check.singleUseCheck.value).toMatchObject({ failed: true })
  })

  it('does not let a slower older check overwrite the newer one', async () => {
    const { check } = mountComposables()
    const older = deferred<Record<string, AssetSingleUseUsage>>()
    const newer = deferred<Record<string, AssetSingleUseUsage>>()
    fetchUsage.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const olderCheck = check.checkSingleUseUsage(asset('a'), holder)
    const newerCheck = check.checkSingleUseUsage(asset('b'), holder)
    const freshNewer = usage({ usageCount: 7 })

    newer.resolve({ 'file-b': freshNewer })
    await newerCheck
    older.resolve({ 'file-a': usage({ usageCount: 3 }) })
    await olderCheck

    expect(check.singleUseCheck.value?.asset.id).toBe('b')
    expect(check.singleUseCheck.value?.asset.singleUseUsage).toEqual(freshNewer)
  })

  it('does not bring back a check that was cleared while it was running', async () => {
    const { check } = mountComposables()
    const pending = deferred<Record<string, AssetSingleUseUsage>>()
    fetchUsage.mockReturnValueOnce(pending.promise)
    const running = check.checkSingleUseUsage(asset('a'), holder)

    check.clearSingleUseUsage()
    pending.resolve({ 'file-a': usage() })
    await running

    expect(check.singleUseCheck.value).toBeNull()
  })
})
