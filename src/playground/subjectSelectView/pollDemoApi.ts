import { cmsClient } from '@/playground/mock/cmsClient'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { DatetimeUTCNullable, IntegerId } from '@/shared/types/common'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'

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
  useApiFetchList<PollDemo>({
    client: cmsClient,
    system: 'cms',
    entity: 'poll',
    urlTemplate: '/adm/v1/poll',
  })

export const fetchPollListByIds = (ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<PollDemo>({
    client: cmsClient,
    system: 'cms',
    entity: 'poll',
    urlTemplate: '/adm/v1/poll',
  })

  return execute(ids)
}
