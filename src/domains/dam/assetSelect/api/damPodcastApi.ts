import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { DocId, IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import type { DamPodcastAware } from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import { DAM_END_POINT_PODCAST } from '@/domains/dam/api/damEndPoints'

const ENTITY = 'podcast'

// `endPoint`: the caller's podcast endpoint. The default is used when not given.
// The podcasts of an ext system: the picker may browse several licences of it at once, which filter the list.

export const fetchDamPodcastListByIds = (
  client: () => AxiosInstance,
  extSystemId: IntegerId,
  ids: DocId[],
  endPoint: string = DAM_END_POINT_PODCAST
) => {
  const { execute } = useApiFetchByIds<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/ext-system/:extSystemId',
    urlParams: { extSystemId },
  })

  return execute(ids)
}

export const useFetchDamPodcastList = (
  client: () => AxiosInstance,
  extSystemId: IntegerId,
  endPoint: string = DAM_END_POINT_PODCAST
) =>
  useApiFetchList<DamPodcastAware>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/ext-system/:extSystemId',
    urlParams: { extSystemId },
  })
