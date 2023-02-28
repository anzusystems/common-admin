import type { AxiosInstance } from 'axios'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { Job } from '@/types/Job'
import { apiFetchList } from '@/services/api/apiFetchList'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { stringToKebabCase } from '@/utils/string'

const END_POINT = '/adm/v1/job'
export const ENTITY = 'job'

export function useJobApi<JobType extends Job = Job>(client: () => AxiosInstance, system: string) {
  const fetchJobList = (pagination: Pagination, filterBag: FilterBag) =>
    apiFetchList<JobType[]>(client, END_POINT, {}, pagination, filterBag, system, ENTITY)

  const fetchJob = (id: number) => apiFetchOne<JobType>(client, END_POINT + '/:id', { id }, system, ENTITY)

  const createJob = (data: JobType) => {
    const type = stringToKebabCase(data._resourceName).slice(4) // remove "job-" prefix

    return apiCreateOne<JobType>(client, data, END_POINT + '/:type', { type }, system, ENTITY)
  }

  const deleteJob = (id: number) => apiDeleteOne<JobType>(client, END_POINT + '/:id', { id }, system, ENTITY)

  return {
    fetchJobList,
    fetchJob,
    createJob,
    deleteJob,
  }
}
