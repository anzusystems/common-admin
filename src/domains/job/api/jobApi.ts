import type { AxiosInstance } from 'axios'
import type { JobBase } from '@/domains/job/types/Job'
import { stringToKebabCase } from '@/shared/utils/string'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'

const END_POINT = '/adm/v1/job'
export const ENTITY = 'job'

export function useJobApi<JobType extends JobBase = JobBase>(client: () => AxiosInstance, system: string) {
  const useFetchJobList = () => useApiFetchList<JobType>({ client, system, entity: ENTITY, urlTemplate: END_POINT })

  // Each function builds its own request. `useApiRequest` keeps abort controllers
  // per instance, so a shared instance would put all callers in one abort scope.
  // This matters for the two `jobActions.ts` that call this at module scope.
  // They stay bound functions, not factories, because no caller aborts a job request.
  const fetchJob = (id: number) => {
    const { execute } = useApiRequest<JobType, null>({
      client,
      method: 'GET',
      system,
      entity: ENTITY,
      urlTemplate: END_POINT + '/:id',
    })

    return execute({ urlParams: { id } })
  }

  const createJob = (data: JobType) => {
    const type = stringToKebabCase(data._resourceName).slice(4).replace('-kind-', '-kind/') // strip the "job-" prefix

    const { execute } = useApiRequest<JobType, JobType>({
      client,
      method: 'POST',
      system,
      entity: ENTITY,
      urlTemplate: END_POINT + '/:type',
    })

    return execute({ urlParams: { type }, body: data })
  }

  const deleteJob = (id: number) => {
    const { execute } = useApiCommand({
      client,
      method: 'DELETE',
      system,
      entity: ENTITY,
      urlTemplate: END_POINT + '/:id',
    })

    return execute({ urlParams: { id } })
  }

  return {
    useFetchJobList,
    fetchJob,
    createJob,
    deleteJob,
  }
}
