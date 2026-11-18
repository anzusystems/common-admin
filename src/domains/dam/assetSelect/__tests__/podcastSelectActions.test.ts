import { describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import {
  usePodcastInnerFilter,
  usePodcastSelectActions,
} from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import { generateListQuery } from '@/domains/api/composables/useApiFetchList'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { DocId, IntegerId } from '@/shared/types/common'

const { requests, podcasts } = vi.hoisted(() => ({
  requests: [] as Array<{ extSystemId: IntegerId; endPoint: string; query?: string; ids?: DocId[] }>,
  podcasts: [
    { id: 'podcast-sport', texts: { title: 'Športový podcast', description: '' } },
    { id: 'podcast-regions', texts: { title: 'Regióny', description: '' } },
  ],
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: vi.fn(), endPointPodcast: '/own/v1/podcast' }),
}))

vi.mock('@/domains/dam/assetSelect/api/damPodcastApi', () => ({
  useFetchDamPodcastList: (_client: unknown, extSystemId: IntegerId, endPoint: string) => ({
    execute: (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
      requests.push({ extSystemId, endPoint, query: generateListQuery(pagination, filterData, filterConfig) })
      return Promise.resolve(podcasts)
    },
  }),
  fetchDamPodcastListByIds: (_client: unknown, extSystemId: IntegerId, ids: DocId[], endPoint: string) => {
    requests.push({ extSystemId, endPoint, ids })
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
    const { fetchItems } = usePodcastSelectActions(3, 'default')

    const options = await fetchItems(usePagination(null).pagination, filterData, filterConfig)

    expect(options).toEqual(bothLicencesOptions)
    expect(requests).toHaveLength(1)
    expect(requests[0]!.extSystemId).toBe(3)
    expect(requests[0]!.endPoint).toBe('/own/v1/podcast')
    expect(requests[0]!.query).toContain('filter_in[licence]=10,20')
  })

  it('resolves the chosen ids with one request in the ext system', async () => {
    requests.length = 0
    const { fetchItemsByIds } = usePodcastSelectActions(3, 'default')

    const options = await fetchItemsByIds(['podcast-sport', 'podcast-regions'])

    expect(options).toEqual(bothLicencesOptions)
    expect(requests).toEqual([
      { extSystemId: 3, endPoint: '/own/v1/podcast', ids: ['podcast-sport', 'podcast-regions'] },
    ])
  })
})
