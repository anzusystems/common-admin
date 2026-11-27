import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import type { LogPaths, LogTypeType } from '@/domains/log/composables/logType'
import type { Log } from '@/domains/log/types/Log'

export const LOG_ENTITY = 'log'

interface LogApiParams {
  client: AxiosClientFn
  system: string
  logPaths: LogPaths
  type: LogTypeType
}

/**
 * The caller provides the backend and the endpoint, so this cannot be hoisted like an entity fetcher.
 * Each mount builds its own, which also gives each its own abort controller set.
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
