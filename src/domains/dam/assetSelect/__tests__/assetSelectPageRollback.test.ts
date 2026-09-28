import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { DamAssetType } from '@/domains/dam/types/Asset'

const deferred = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
const api = vi.hoisted(() => ({ list: [] as any[], pages: [] as number[] }))
vi.mock('@/domains/dam/api/damAssetApi', () => ({
  ENTITY: 'asset',
  ...Object.fromEntries(
    [
      'fetchAssetAsCmsMedia',
      'fetchAssetByFileId',
      'bulkUpdateAssetsMetadata',
      'fetchAssetListByIds',
      'updateAssetMetadata',
      'updateAssetAuthors',
      'bulkUpdateAssetsAuthors',
      'fetchAsset',
    ].map((n) => [n, vi.fn()])
  ),
  useFetchAssetList: () => ({
    execute: (pagination: any) => (
      api.pages.push(pagination.value.page),
      api.list.push(deferred()),
      api.list.at(-1).promise
    ),
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset', showFileInfoEnabled: false }),
}))
describe('page rollback vs filter submit', () => {
  it('a next page failing inside the debounce window does not undo the filter submit page reset', async () => {
    let actions!: ReturnType<typeof useAssetSelectActions>
    mount(defineComponent({ setup: () => ((actions = useAssetSelectActions()), () => h('div')) }))
    const store = useAssetSelectStore()
    store.setSelectConfig([{ licence: 1, extSystem: 1, licenceName: '', extSystemConfig: {} as any }])
    store.setAssetType(DamAssetType.Image)
    actions.pagination.value.page = 2
    const next = actions.fetchNextPage()
    actions.pagination.value = { ...actions.pagination.value, page: 1 }
    const list = actions.fetchAssetListDebounced()
    api.list[0].reject(new Error('network'))
    await next
    await vi.waitFor(() => expect(api.list).toHaveLength(2))
    api.list[1].resolve([])
    await list
    expect(api.pages).toEqual([3, 1])
  })
})
