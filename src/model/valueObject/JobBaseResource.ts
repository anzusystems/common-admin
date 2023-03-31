import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export const JOB_RESOURCE_USER_DATA_DELETE = 'jobUserDataDelete'

export type JobBaseResource = typeof JOB_RESOURCE_USER_DATA_DELETE | `job${string}`

export function useJobBaseResource<T extends JobBaseResource = JobBaseResource>(
  customJobs: ValueObjectOption<T>[] = []
) {
  const { t } = useI18n()

  const jobResourceOptions = ref<ValueObjectOption<T>[]>([
    ...([
      {
        value: 'jobUserDataDelete',
        title: t('common.job.jobResource.jobUserDataDelete'),
      },
    ] as unknown as ValueObjectOption<T>[]),
    ...customJobs,
  ])

  const getJobResourceOption = (value: T): ValueObjectOption<T> => {
    return jobResourceOptions.value.find((item) => item.value === value) as ValueObjectOption<T>
  }

  return {
    jobResourceOptions,
    getJobResourceOption,
  }
}
