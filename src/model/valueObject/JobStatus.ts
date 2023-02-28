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
  const { t } = useI18n()

  const jobStatusOptions = ref<ValueObjectOption<JobStatus>[]>([
    {
      value: JobStatus.Waiting,
      title: t('common.job.status.waiting'),
      color: 'warning',
    },
    {
      value: JobStatus.Processing,
      title: t('common.job.status.processing'),
      color: 'primary',
    },
    {
      value: JobStatus.AwaitingBatchProcess,
      title: t('common.job.status.awaitingBatchProcess'),
      color: 'primary',
    },
    {
      value: JobStatus.Done,
      title: t('common.job.status.done'),
      color: 'success',
    },
    {
      value: JobStatus.Error,
      title: t('common.job.status.error'),
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
