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

export const fetchPollListByIds = (ids: IntegerId[]) =>
  apiFetchByIds<PollDemo[]>(cmsClient, ids, '/adm/v1/poll', {}, 'cms', 'poll')
