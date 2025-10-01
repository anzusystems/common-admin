import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DocId, IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { DamPodcastAware } from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'

const END_POINT = '/adm/v1/podcast/licence/:licenceId'
const ENTITY = 'podcast'

export const fetchDamPodcastListByIds = (client: () => AxiosInstance, licenceId: IntegerId, ids: DocId[]) =>
  apiFetchByIds<DamPodcastAware[]>(client, ids, END_POINT, { licenceId }, SYSTEM_CORE_DAM, ENTITY, {}, false)

export const useFetchDamPodcastList = (client: () => AxiosInstance, licenceId: IntegerId) =>
  useApiFetchList<DamPodcastAware[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT, { licenceId })
