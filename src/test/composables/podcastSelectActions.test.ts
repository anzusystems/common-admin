import { describe, expect, it, vi } from 'vitest'
import { usePodcastSelectActions } from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'
import { usePagination } from '@/labs/filters/pagination'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { IntegerId } from '@/types/common'

const { podcastsByLicence } = vi.hoisted(() => ({
  podcastsByLicence: {
    10: [{ id: 'podcast-sport', texts: { title: 'Športový podcast', description: '' } }],
    20: [{ id: 'podcast-regions', texts: { title: 'Regióny', description: '' } }],
  } as Record<IntegerId, Array<{ id: string; texts: { title: string; description: string } }>>,
}))

vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: vi.fn() }),
}))

vi.mock('@/components/dam/assetSelect/components/filter/damPodcastApi', () => ({
  useFetchDamPodcastList: (_client: unknown, licenceId: IntegerId) => ({
    executeFetch: () => Promise.resolve(podcastsByLicence[licenceId] ?? []),
  }),
  fetchDamPodcastListByIds: (_client: unknown, licenceId: IntegerId) =>
    Promise.resolve(podcastsByLicence[licenceId] ?? []),
}))

const bothLicencesOptions = [
  { title: 'Športový podcast', value: 'podcast-sport' },
  { title: 'Regióny', value: 'podcast-regions' },
]

describe('usePodcastSelectActions', () => {
  it.each<[string, (actions: ReturnType<typeof usePodcastSelectActions>) => Promise<unknown>]>([
    [
      'offers',
      ({ fetchItems }) =>
        fetchItems(usePagination(null).pagination, {} as FilterData, {} as FilterConfig),
    ],
    [
      'resolves the chosen ids among',
      ({ fetchItemsByIds }) => fetchItemsByIds(['podcast-sport', 'podcast-regions']),
    ],
  ])('%s the podcasts of every selected licence', async (_name, fetch) => {
    expect(await fetch(usePodcastSelectActions([10, 20]))).toEqual(bothLicencesOptions)
  })
})
