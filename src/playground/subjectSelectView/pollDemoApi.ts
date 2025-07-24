import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/services/api/apiFetchList'
import { cmsClient } from '@/playground/mock/cmsClient'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { DatetimeUTCNullable, IntegerId } from '@/types/common'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

// just a demo type
export type PollDemo = AnzuUserAndTimeTrackingAware & {
  id: IntegerId
  enabled: boolean
  texts: {
    title: string
    description: string
  }
  dates: {
    startOfVoting: DatetimeUTCNullable
    endOfVoting: DatetimeUTCNullable
  }
  votes: number
}

export const useFetchPollListDemo = () => useApiFetchList<PollDemo[]>(cmsClient, 'cms', 'poll', '/adm/v1/poll')

export const fetchPollListDemo = (pag: Pagination, fb: FilterBag) =>
  apiFetchList<PollDemo[]>(cmsClient, '/adm/v1/poll', {}, pag, fb, 'cms', 'poll')

export const fetchPollListByIds = (ids: number[]) =>
  apiFetchByIds<PollDemo[]>(cmsClient, ids, '/adm/v1/poll', {}, 'cms', 'poll')
