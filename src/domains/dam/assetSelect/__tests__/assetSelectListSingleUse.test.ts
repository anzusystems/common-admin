import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectUsageRefresh } from '@/domains/dam/assetSelect/composables/assetSelectSingleUseUsage'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import { type AssetSearchListItemDto, type AssetSingleUseUsage, DamAssetType } from '@/domains/dam/types/Asset'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

// The picker lists single use photos for a record that may use them, asks the CMS where each page's photos are used,
// and dims a photo the record cannot use. Its sources are cached for their badges.

const { list, fetchUsage, showErrorsDefault, cached, admin } = vi.hoisted(() => ({
  // Whether the CMS of the admin checks single use photos (`singleUseUsageEnabled`): admin-cms only.
  admin: { checksSingleUse: true },
  list: [] as Array<{ resolve: (items: unknown[]) => void; promise: Promise<unknown[]> }>,
  fetchUsage: vi.fn(),
  showErrorsDefault: vi.fn(),
  cached: { authors: [] as string[], fetches: 0 },
}))
const deferredList = () => {
  let resolve!: (items: unknown[]) => void
  const promise = new Promise<unknown[]>((res) => (resolve = res))
  list.push({ resolve, promise })
  return promise
}
vi.mock('@/domains/dam/api/damAssetApi', () => ({
  ENTITY: 'asset',
  useFetchAssetList: () => ({ execute: deferredList }),
  fetchAsset: vi.fn(),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => ({}),
    endPointAsset: '/asset',
    showFileInfoEnabled: false,
    singleUseUsageEnabled: admin.checksSingleUse,
  }),
}))
vi.mock('@/domains/dam/imageWidget/composables/imageSingleUseUsageFetch', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useImageSingleUseUsageFetch: () => fetchUsage,
}))
vi.mock('@/domains/dam/user/api/assetLicenceApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchDamAssetLicenceListByIds: () =>
    Promise.resolve([{ id: 10, name: 'Licence', badge: 'L', flags: { directUseAllowed: true } }]),
}))
vi.mock('@/domains/dam/author/composables/cachedAuthors', () => ({
  useDamCachedAuthors: () => ({
    addToCachedAuthors: (...ids: string[][]) => cached.authors.push(...ids.flat()),
    fetchCachedAuthors: () => cached.fetches++,
  }),
}))
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/system/composables/alerts')>()
  return { ...actual, useAlerts: () => ({ ...actual.useAlerts(), showErrorsDefault }) }
})

const asset = (id: string, sources: string[] = []) =>
  ({
    id,
    licence: 10,
    sources,
    mainFile: { id: `file-${id}`, flags: { singleUse: false }, fileAttributes: { takenOverFromId: '' } },
    attributes: { assetType: DamAssetType.Image },
  }) as unknown as AssetSearchListItemDto

const singleUseAsset = (id: string, takenOverFromId = '') =>
  ({
    ...asset(id),
    mainFile: { id: `file-${id}`, flags: { singleUse: true }, fileAttributes: { takenOverFromId } },
  }) as unknown as AssetSearchListItemDto

const usage = (blocked: boolean): AssetSingleUseUsage => ({
  holder: null,
  status: blocked ? 'conflict' : 'free',
  blocked,
  usageCount: blocked ? 1 : 0,
  usages: [],
})

const usageHolder = { resourceName: 'articleKindStandard', resourceId: 42 }

const setup = (extSystem = 1) => {
  let actions!: ReturnType<typeof useAssetSelectActions>
  mount(defineComponent({ setup: () => ((actions = useAssetSelectActions('default')), () => h('div')) }))
  const store = useAssetSelectStore()
  store.reset(true)
  store.setSelectConfig([{ licence: 10, extSystem, licenceName: '', extSystemConfig: {} as never }])
  store.setSelectedLicenceIds([10])
  store.setAssetType(DamAssetType.Image)
  list.length = 0
  return { actions, store }
}

/** Reads a list and answers it with `items`. */
const readList = async (actions: ReturnType<typeof useAssetSelectActions>, items: AssetSearchListItemDto[]) => {
  const count = list.length
  const read = actions.fetchAssetListDebounced()
  await vi.waitFor(() => expect(list.length).toBe(count + 1))
  list.at(-1)!.resolve(items)
  await read
  await flushPromises()
}

const readNextPage = async (actions: ReturnType<typeof useAssetSelectActions>, items: AssetSearchListItemDto[]) => {
  const count = list.length
  const read = actions.fetchNextPage()
  await vi.waitFor(() => expect(list.length).toBe(count + 1))
  list.at(-1)!.resolve(items)
  await read
  await flushPromises()
}

describe('the single use photos of an asset select', () => {
  beforeEach(() => {
    admin.checksSingleUse = true
    fetchUsage.mockReset()
    fetchUsage.mockResolvedValue({})
    showErrorsDefault.mockReset()
    cached.authors.length = 0
  })

  it.each([
    [DamAssetType.Image, true, null],
    [DamAssetType.Image, false, false],
    [DamAssetType.Video, true, false],
    [DamAssetType.Audio, true, false],
  ])(
    'are listed only as photos for a record that may use them (%s, allowed %s)',
    async (assetType, singleUseAllowed, mainFileSingleUse) => {
      const { actions, store } = setup()
      store.setAssetType(assetType)
      store.setSelectability({ singleUseAllowed, uploadLicence: undefined, usageHolder: null })

      await readList(actions, [])

      expect(useAssetListFilter().filterData.mainFileSingleUse).toBe(mainFileSingleUse)
    }
  )

  // admin-inhouse, admin-ugc, admin-dam and the others: their backends do not check single use photos, so none is listed,
  // as in 2.0.0-rc.26, for any record, image widgets of the default `singleUseAllowed` too.
  it.each([DamAssetType.Image, DamAssetType.Video])(
    'are not listed where the CMS of the admin does not check them (%s)',
    async (assetType) => {
      admin.checksSingleUse = false
      const { actions, store } = setup()
      store.setAssetType(assetType)
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })

      await readList(actions, [])

      expect(useAssetListFilter().filterData.mainFileSingleUse).toBe(false)
    }
  )

  // AAssetListInner gives no selectability: it checks no usage, so it lists none, as before 1.52.0.
  it('are not listed by a listing without selectability rules', async () => {
    const { actions } = setup()

    await readList(actions, [])

    expect(useAssetListFilter().filterData.mainFileSingleUse).toBe(false)
  })

  it('ask the host once per page for the distinct groups of the single use photos', async () => {
    const { actions, store } = setup()
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    const audio = {
      ...singleUseAsset('e'),
      attributes: { assetType: DamAssetType.Audio },
    } as unknown as AssetSearchListItemDto
    fetchUsage.mockResolvedValue({ 'group-1': usage(true), 'file-c': usage(false) })

    await readList(actions, [
      singleUseAsset('a', 'group-1'),
      singleUseAsset('b', 'group-1'),
      singleUseAsset('c'),
      asset('d'),
      audio,
    ])

    expect(fetchUsage).toHaveBeenCalledTimes(1)
    expect(fetchUsage).toHaveBeenCalledWith(['group-1', 'file-c'], usageHolder)
    const [a, b, c, d] = store.assetListItems
    expect(a!.asset.singleUseUsage).toEqual(usage(true))
    expect(b!.asset.singleUseUsage).toEqual(usage(true))
    expect(c!.asset.singleUseUsage).toEqual(usage(false))
    expect(d!.asset.singleUseUsage).toBeUndefined()
    expect(a!.disabledReason).toBeTruthy()
    expect(b!.disabledReason).toBeTruthy()
    expect(c!.disabledReason).toBeNull()
    expect(store.loader).toBe(false)
  })

  it('ask again for the next page with the groups of that page only', async () => {
    const { actions, store } = setup()
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })

    await readList(actions, [singleUseAsset('a', 'group-1')])
    await readNextPage(actions, [singleUseAsset('b', 'group-2')])

    expect(fetchUsage).toHaveBeenCalledTimes(2)
    expect(fetchUsage).toHaveBeenLastCalledWith(['group-2'], usageHolder)
  })

  it('ask nobody without selectability or without a single use photo', async () => {
    const { actions, store } = setup()

    await readList(actions, [singleUseAsset('a')])
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    await readList(actions, [asset('b')])

    expect(fetchUsage).not.toHaveBeenCalled()
  })

  it('stay selectable when the host rejects, and the error is shown', async () => {
    const { actions, store } = setup()
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    const error = new Error('host down')
    fetchUsage.mockRejectedValue(error)

    await readList(actions, [singleUseAsset('a', 'group-1')])

    expect(showErrorsDefault).toHaveBeenCalledWith(error)
    expect(store.assetListItems.map((item) => item.asset.id)).toEqual(['a'])
    expect(store.assetListItems[0]!.disabledReason).toBeNull()
    expect(store.loader).toBe(false)
  })

  // Every page asks the host, "Load more" by itself too: an outage of the usage endpoint showed an alert per page.
  it('show a failure of the host once per opened picker', async () => {
    const { actions, store } = setup()
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    fetchUsage.mockRejectedValue(new Error('host down'))

    await readList(actions, [singleUseAsset('a', 'group-1')])
    await readNextPage(actions, [singleUseAsset('b', 'group-2')])
    await readNextPage(actions, [singleUseAsset('c', 'group-3')])
    await readList(actions, [singleUseAsset('d', 'group-4')])
    expect(fetchUsage).toHaveBeenCalledTimes(4)
    expect(showErrorsDefault).toHaveBeenCalledTimes(1)

    const reopened = setup()
    reopened.store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    await readList(reopened.actions, [singleUseAsset('e', 'group-5')])
    expect(showErrorsDefault).toHaveBeenCalledTimes(2)
  })

  // A page of the list and the usage tab read the usage of a photo apart. The answer of the read started last applies,
  // whichever comes last: a page asked 5 s for its usages and its "free" undimmed the photo the tab had found blocked.
  describe('and the usage tab', () => {
    const mountUsageTab = () => {
      let tab!: ReturnType<typeof useAssetSelectUsageRefresh>
      mount(defineComponent({ setup: () => ((tab = useAssetSelectUsageRefresh('default')), () => h('div')) }))
      return tab
    }

    it('take no usage of a page that answers after a newer read of the tab', async () => {
      const { actions, store } = setup()
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
      const tab = mountUsageTab()
      let answerPage!: (usages: Record<string, AssetSingleUseUsage>) => void
      fetchUsage.mockReturnValueOnce(new Promise((resolve) => (answerPage = resolve)))
      fetchUsage.mockResolvedValueOnce({ 'group-1': usage(true) })

      const read = actions.fetchAssetListDebounced()
      await vi.waitFor(() => expect(list).toHaveLength(1))
      list[0]!.resolve([singleUseAsset('a', 'group-1')])
      await vi.waitFor(() => expect(fetchUsage).toHaveBeenCalledTimes(1))
      await tab.refreshUsage(store.assetListItems[0]!.asset)
      answerPage({ 'group-1': usage(false) })
      await read
      await flushPromises()

      expect(store.assetListItems[0]!.asset.singleUseUsage).toEqual(usage(true))
      expect(store.assetListItems[0]!.disabledReason).toBeTruthy()
    })

    // A page overtaken by the tab still gives a photo without a usage its own, so a failed tab does not leave the
    // photo undimmed; an answer of the tab replaces it.
    it.each<[string, boolean]>([
      ['fails', false],
      ['answers after it', true],
    ])('take the usage of a page overtaken by a read of the tab that %s', async (_what, tabAnswers) => {
      const { actions, store } = setup()
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
      const tab = mountUsageTab()
      let answerPage!: (usages: Record<string, AssetSingleUseUsage>) => void
      let answerTab!: (usages: Record<string, AssetSingleUseUsage>) => void
      fetchUsage.mockReturnValueOnce(new Promise((resolve) => (answerPage = resolve)))
      if (tabAnswers) fetchUsage.mockReturnValueOnce(new Promise((resolve) => (answerTab = resolve)))
      else fetchUsage.mockRejectedValueOnce(new Error('timeout'))

      const read = actions.fetchAssetListDebounced()
      await vi.waitFor(() => expect(list).toHaveLength(1))
      list[0]!.resolve([singleUseAsset('a', 'group-1')])
      await vi.waitFor(() => expect(fetchUsage).toHaveBeenCalledTimes(1))
      const refresh = tab.refreshUsage(store.assetListItems[0]!.asset)
      if (!tabAnswers) await refresh
      answerPage({ 'group-1': usage(true) })
      await read
      await flushPromises()
      expect(store.assetListItems[0]!.asset.singleUseUsage).toEqual(usage(true))
      expect(store.assetListItems[0]!.disabledReason).toBeTruthy()

      if (!tabAnswers) return
      answerTab({ 'group-1': usage(false) })
      await refresh
      expect(store.assetListItems[0]!.asset.singleUseUsage).toEqual(usage(false))
      expect(store.assetListItems[0]!.disabledReason).toBeNull()
    })

    it('take no usage of the tab that answers after a newer read of a page', async () => {
      const { actions, store } = setup()
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
      await readList(actions, [singleUseAsset('a', 'group-1')])
      const tab = mountUsageTab()
      let answerTab!: (usages: Record<string, AssetSingleUseUsage>) => void
      fetchUsage.mockReturnValueOnce(new Promise((resolve) => (answerTab = resolve)))
      fetchUsage.mockResolvedValueOnce({ 'group-1': usage(false) })

      const refresh = tab.refreshUsage(store.assetListItems[0]!.asset)
      await readList(actions, [singleUseAsset('a', 'group-1')])
      answerTab({ 'group-1': usage(true) })
      await refresh
      await flushPromises()

      expect(store.assetListItems[0]!.asset.singleUseUsage).toEqual(usage(false))
      expect(store.assetListItems[0]!.disabledReason).toBeNull()
      expect(tab.usageLoading.value).toBe(false)
    })
  })

  // The usage of a list given up is not written into the list read since, which may hold the same photo.
  it('take no usage of a list read anew meanwhile', async () => {
    const { actions, store } = setup()
    store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    let answerOld!: (usages: Record<string, AssetSingleUseUsage>) => void
    fetchUsage.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)))
    fetchUsage.mockResolvedValueOnce({ 'group-1': usage(false) })

    const first = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(list).toHaveLength(1))
    list[0]!.resolve([singleUseAsset('a', 'group-1')])
    await vi.waitFor(() => expect(fetchUsage).toHaveBeenCalledTimes(1))
    await readList(actions, [singleUseAsset('a', 'group-1')])
    answerOld({ 'group-1': usage(true) })
    await first
    await flushPromises()

    expect(store.assetListItems[0]!.asset.singleUseUsage).toEqual(usage(false))
    expect(store.assetListItems[0]!.disabledReason).toBeNull()
  })

  it('have their sources cached for the badges, of every page, in the ext system of the picker', async () => {
    const { actions } = setup(7)

    await readList(actions, [asset('a', ['first-page-source'])])
    await readNextPage(actions, [asset('b', ['next-page-source'])])

    expect(cached.authors).toEqual(['first-page-source', 'next-page-source'])
    expect(useExtSystemIdForCached('default').cachedExtSystemId.value).toBe(7)
  })
})
