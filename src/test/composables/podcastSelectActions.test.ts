import { describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import {
  usePodcastInnerFilter,
  usePodcastSelectActions,
} from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'
import { usePagination, type Pagination } from '@/labs/filters/pagination'
import { generateListQuery } from '@/labs/api/useApiFetchList'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { DocId, IntegerId } from '@/types/common'

const { requests, podcasts } = vi.hoisted(() => ({
  requests: [] as Array<{ extSystemId: IntegerId; query?: string; ids?: DocId[] }>,
  podcasts: [
    { id: 'podcast-sport', texts: { title: 'Športový podcast', description: '' } },
    { id: 'podcast-regions', texts: { title: 'Regióny', description: '' } },
  ],
}))

vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: vi.fn() }),
}))

vi.mock('@/components/dam/assetSelect/components/filter/damPodcastApi', () => ({
  useFetchDamPodcastList: (_client: unknown, extSystemId: IntegerId) => ({
    executeFetch: (
      pagination: Ref<Pagination>,
      filterData: FilterData,
      filterConfig: FilterConfig,
    ) => {
      requests.push({ extSystemId, query: generateListQuery(pagination, filterData, filterConfig) })
      return Promise.resolve(podcasts)
    },
  }),
  fetchDamPodcastListByIds: (_client: unknown, extSystemId: IntegerId, ids: DocId[]) => {
    requests.push({ extSystemId, ids })
    return Promise.resolve(podcasts)
  },
}))

const bothLicencesOptions = [
  { title: 'Športový podcast', value: 'podcast-sport' },
  { title: 'Regióny', value: 'podcast-regions' },
]

describe('usePodcastSelectActions', () => {
  it('asks the ext system list once, limited to the selected licences', async () => {
    requests.length = 0
    const { filterData, filterConfig } = usePodcastInnerFilter([10, 20])
    const { fetchItems } = usePodcastSelectActions(3)

    const options = await fetchItems(usePagination(null).pagination, filterData, filterConfig)

    expect(options).toEqual(bothLicencesOptions)
    expect(requests).toHaveLength(1)
    expect(requests[0].extSystemId).toBe(3)
    expect(requests[0].query).toContain('filter_in[licence]=10,20')
  })

  it('resolves the chosen ids with one request in the ext system', async () => {
    requests.length = 0
    const { fetchItemsByIds } = usePodcastSelectActions(3)

    const options = await fetchItemsByIds(['podcast-sport', 'podcast-regions'])

    expect(options).toEqual(bothLicencesOptions)
    expect(requests).toEqual([{ extSystemId: 3, ids: ['podcast-sport', 'podcast-regions'] }])
  })
})
