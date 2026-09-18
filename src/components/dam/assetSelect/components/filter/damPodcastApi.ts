import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DocId, IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import type { DamPodcastAware } from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'

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
