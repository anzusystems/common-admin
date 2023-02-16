import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export enum JobStatus {
  Waiting = 'waiting',
  Processing = 'processing',
  AwaitingBatchProcess = 'awaiting_batch_process',
  Done = 'done',
  Error = 'error',
  Default = Waiting,
}

export function useJobStatus() {
  const { t } = useI18n({ useScope: 'global' })

  const jobStatusOptions = ref<ValueObjectOption<JobStatus>[]>([
    {
      value: JobStatus.Waiting,
      title: t('job.status.waiting'),
      color: 'warning',
    },
    {
      value: JobStatus.Processing,
      title: t('job.status.processing'),
      color: 'primary',
    },
    {
      value: JobStatus.AwaitingBatchProcess,
      title: t('job.status.awaitingBatchProcess'),
      color: 'primary',
    },
    {
      value: JobStatus.Done,
      title: t('job.status.done'),
      color: 'success',
    },
    {
      value: JobStatus.Error,
      title: t('job.status.error'),
      color: 'error',
    },
  ])

  const getJobStatusOption = (value: JobStatus): ValueObjectOption<JobStatus> => {
    return jobStatusOptions.value.find((item) => item.value === value) as ValueObjectOption<JobStatus>
  }

  return {
    jobStatusOptions,
    getJobStatusOption,
  }
}
