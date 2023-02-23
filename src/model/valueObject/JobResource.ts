import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export type JobResource = 'jobUserDataDelete' | `job${string}`

export function useJobResource<T extends JobResource = JobResource>(customJobs: ValueObjectOption<T>[] = []) {
  const { t } = useI18n()

  const jobResourceOptions = ref<ValueObjectOption<T>[]>([
    ...([
      {
        value: 'jobUserDataDelete',
        title: t('job.jobResource.jobUserDataDelete'),
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
