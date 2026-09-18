import type { AxiosClientFn } from '@/labs/api/client'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiRequest } from '@/labs/api/useApiRequest'
import type { LogPaths, LogTypeType } from '@/labs/log/logType'
import type { Log } from '@/types/Log'

export const LOG_ENTITY = 'log'

interface LogApiParams {
  client: AxiosClientFn
  system: string
  logPaths: LogPaths
  type: LogTypeType
}

/**
 * The backend and the endpoint both come from the caller, so these cannot be hoisted the way an
 * entity fetcher is -- every mount builds its own, which is also what gives each one its own
 * abort controller set.
 */
export const useFetchLogList = ({ client, system, logPaths, type }: LogApiParams) =>
  useApiFetchList<Log>({
    client,
    system,
    entity: LOG_ENTITY,
    urlTemplate: logPaths[type],
  })

export const useFetchLog = ({ client, system, logPaths, type }: LogApiParams) =>
  useApiRequest<Log, null>({
    client,
    method: 'GET',
    system,
    entity: LOG_ENTITY,
    urlTemplate: logPaths[type] + '/:id',
  })
