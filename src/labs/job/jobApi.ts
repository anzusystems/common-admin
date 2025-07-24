import type { AxiosInstance } from 'axios'
import type { JobBase } from '@/types/Job'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { stringToKebabCase } from '@/utils/string'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const END_POINT = '/adm/v1/job'
export const ENTITY = 'job'

export function useJobApi<JobType extends JobBase = JobBase>(client: () => AxiosInstance, system: string) {
  const useFetchJobList = () => useApiFetchList<JobType[]>(client, system, ENTITY, END_POINT)

  const fetchJob = (id: number) => apiFetchOne<JobType>(client, END_POINT + '/:id', { id }, system, ENTITY)

  const createJob = (data: JobType) => {
    const type = stringToKebabCase(data._resourceName)
      .slice(4) // remove "job-" prefix
      .replace('-kind-', '-kind/') // replace "-kind-" with "-kind/" if the needle is found

    return apiCreateOne<JobType>(client, data, END_POINT + '/:type', { type }, system, ENTITY)
  }

  const deleteJob = (id: number) => apiDeleteOne<JobType>(client, END_POINT + '/:id', { id }, system, ENTITY)

  return {
    useFetchJobList,
    fetchJob,
    createJob,
    deleteJob,
  }
}
