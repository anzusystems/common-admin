import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { DocId, IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import type { DamPodcastAware } from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'

const END_POINT = '/adm/v1/podcast/licence/:licenceId'
const ENTITY = 'podcast'

export const fetchDamPodcastListByIds = (client: () => AxiosInstance, licenceId: IntegerId, ids: DocId[]) => {
  const { execute } = useApiFetchByIds<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
    urlParams: { licenceId },
  })

  return execute(ids)
}

export const useFetchDamPodcastList = (client: () => AxiosInstance, licenceId: IntegerId) =>
  useApiFetchList<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
    urlParams: { licenceId },
  })
