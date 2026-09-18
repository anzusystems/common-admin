import type { AxiosInstance } from 'axios'
import type { JobBase } from '@/types/Job'
import { stringToKebabCase } from '@/utils/string'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'

const END_POINT = '/adm/v1/job'
export const ENTITY = 'job'

export function useJobApi<JobType extends JobBase = JobBase>(client: () => AxiosInstance, system: string) {
  const useFetchJobList = () => useApiFetchList<JobType>({ client, system, entity: ENTITY, urlTemplate: END_POINT })

  // Each of these builds its own request rather than sharing one: `useApiRequest` keeps a set of
  // abort controllers per instance, so a shared instance would put every caller of that instance in
  // one abort scope. It matters for the two `jobActions.ts` that call this at module scope and hold
  // `fetchJob` across the whole app; the other 25 consumers are `<script setup>`, one instance each.
  // They stay bound functions instead of being handed out as factories -- no caller anywhere in the
  // fleet aborts a job request, and exposing the handle would move 27 call sites to pass around
  // something unused.
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
    const type = stringToKebabCase(data._resourceName)
      .slice(4) // remove "job-" prefix
      .replace('-kind-', '-kind/') // replace "-kind-" with "-kind/" if the needle is found

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
