import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { Pagination } from '@/labs/filters/pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { DocId, IntegerId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import {
  fetchDamPodcastListByIds,
  useFetchDamPodcastList,
} from '@/components/dam/assetSelect/components/filter/damPodcastApi'

export function usePodcastInnerFilter() {
  const filterFieldsInner = [
    {
      name: 'title' as const,
      variant: 'startsWith',
      default: null,
      type: 'string',
      apiName: 'texts.title',
    },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFieldsInner,
    createFilterStore(filterFieldsInner),
    {
      system: SYSTEM_CORE_DAM,
      subject: 'podcast',
    },
  )

  return {
    filterConfig,
    filterData,
  }
}

export const usePodcastSelectActions = (licenceIds: IntegerId[], configName = 'default') => {
  const { damClient } = useCommonAdminCoreDamOptions(configName)
  const fetchers = licenceIds.map((licenceId) => useFetchDamPodcastList(damClient, licenceId))

  const fetchItems = async (
    pagination: Ref<Pagination>,
    filterData: FilterData,
    filterConfig: FilterConfig,
  ) => {
    // A podcast belongs to one licence, so every selected licence is asked; each request gets its own
    // pagination copy so the parallel responses do not overwrite each other's counts.
    const lists = await Promise.all(
      fetchers.map(({ executeFetch }) =>
        executeFetch(ref({ ...pagination.value }), filterData, filterConfig),
      ),
    )
    const podcasts = lists.flat()

    return <ValueObjectOption<DocId>[]>podcasts.map((podcast: DamPodcastAware) => ({
      title: podcast.texts.title,
      value: podcast.id,
    }))
  }

  const fetchItemsByIds = async (ids: DocId[]) => {
    const lists = await Promise.all(
      licenceIds.map((licenceId) => fetchDamPodcastListByIds(damClient, licenceId, ids)),
    )
    const podcasts = lists.flat()

    return <ValueObjectOption<DocId>[]>podcasts.map((podcast: DamPodcastAware) => ({
      title: podcast.texts.title,
      value: podcast.id,
    }))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}

export interface DamPodcastAware {
  id: DocId
  texts: {
    title: string
    description: string
  }
}
