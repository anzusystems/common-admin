import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { AxiosInstance } from 'axios'
import { useFetchAssetList, useFetchAssetListByLicences } from '@/domains/dam/api/damAssetApi'
import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import type { Pagination } from '@/domains/api/composables/pagination'

// The address each list really asks for with the picker's filter. The UGC proxy of core-dam has only
// `/licence/{id}/search`; several licences go to `/licence/search` of the adm API.

const answeringEmpty = () => {
  const get = vi.fn(async (_url: string) => ({ status: 204, data: undefined, config: {} }))
  return { get, client: () => ({ get }) as unknown as AxiosInstance }
}

const pagination = () => ref({ page: 1, rowsPerPage: 20, sortBy: null, descending: true } as unknown as Pagination)

describe('asset list addresses', () => {
  it('lists one licence at /licence/:id/search', async () => {
    const { get, client } = answeringEmpty()
    const { filterData, filterConfig } = useAssetListFilter()

    await useFetchAssetList(client, '/ugc/v1/asset', 20).execute(pagination(), filterData, filterConfig)

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]![0]).toMatch(/^\/ugc\/v1\/asset\/licence\/20\/search\?/)
  })

  it('lists several licences at /licence/search', async () => {
    const { get, client } = answeringEmpty()
    const { filterData, filterConfig } = useAssetListFilter()

    await useFetchAssetListByLicences(client, '/adm/v1/asset').execute(pagination(), filterData, filterConfig)

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]![0]).toMatch(/^\/adm\/v1\/asset\/licence\/search\?/)
  })
})
