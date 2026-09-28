import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damConstants'
import type { Ref } from 'vue'
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

  const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
    system: SYSTEM_CORE_DAM,
    subject: 'podcast',
  })

  return {
    filterConfig,
    filterData,
  }
}

export const usePodcastSelectActions = (licenceId: IntegerId, configName = 'default') => {
  const { damClient } = useCommonAdminCoreDamOptions(configName)
  const { execute } = useFetchDamPodcastList(damClient, licenceId)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    const podcasts = await execute(pagination, filterData, filterConfig)

    return podcasts.map((podcast: DamPodcastAware) => ({
      title: podcast.texts.title,
      value: podcast.id,
    })) as ValueObjectOption<DocId>[]
  }

  const fetchItemsByIds = async (ids: DocId[]) => {
    const podcasts = await fetchDamPodcastListByIds(damClient, licenceId, ids)

    return podcasts.map((podcast: DamPodcastAware) => ({
      title: podcast.texts.title,
      value: podcast.id,
    })) as ValueObjectOption<DocId>[]
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
