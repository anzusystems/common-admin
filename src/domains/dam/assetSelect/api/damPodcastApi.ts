import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { DocId, IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import type { DamPodcastAware } from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import { DAM_END_POINT_PODCAST } from '@/domains/dam/api/damEndPoints'

const ENTITY = 'podcast'

// `endPoint`: the caller's podcast endpoint. The default is used when not given.

export const fetchDamPodcastListByIds = (
  client: () => AxiosInstance,
  licenceId: IntegerId,
  ids: DocId[],
  endPoint: string = DAM_END_POINT_PODCAST
) => {
  const { execute } = useApiFetchByIds<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/licence/:licenceId',
    urlParams: { licenceId },
  })

  return execute(ids)
}

export const useFetchDamPodcastList = (
  client: () => AxiosInstance,
  licenceId: IntegerId,
  endPoint: string = DAM_END_POINT_PODCAST
) =>
  useApiFetchList<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/licence/:licenceId',
    urlParams: { licenceId },
  })
