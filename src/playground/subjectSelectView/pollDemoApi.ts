import { cmsClient } from '@/playground/mock/cmsClient'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { DatetimeUTCNullable, IntegerId } from '@/types/common'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
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

export const useFetchPollListDemo = () =>
  useApiFetchList<PollDemo[]>({
    client: cmsClient,
    system: 'cms',
    entity: 'poll',
    urlTemplate: '/adm/v1/poll',
  })

export const fetchPollListByIds = (ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<PollDemo[]>({
    client: cmsClient,
    system: 'cms',
    entity: 'poll',
    urlTemplate: '/adm/v1/poll',
  })

  return executeFetch(ids)
}
