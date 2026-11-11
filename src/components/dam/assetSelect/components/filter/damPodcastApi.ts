import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DocId, IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { DamPodcastAware } from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'

const END_POINT = '/adm/v1/podcast/ext-system/:extSystemId'
const ENTITY = 'podcast'

export const fetchDamPodcastListByIds = (
  client: () => AxiosInstance,
  extSystemId: IntegerId,
  ids: DocId[],
) =>
  apiFetchByIds<DamPodcastAware[]>(
    client,
    ids,
    END_POINT,
    { extSystemId },
    SYSTEM_CORE_DAM,
    ENTITY,
    {},
    false,
  )

export const useFetchDamPodcastList = (client: () => AxiosInstance, extSystemId: IntegerId) =>
  useApiFetchList<DamPodcastAware[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
    urlParams: { extSystemId },
  })
