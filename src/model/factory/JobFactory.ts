import type { JobBase, JobUserDataDelete } from '@/types/Job'
import { JobStatus } from '@/model/valueObject/JobStatus'
import { dateTimeNow } from '@/utils/datetime'
import type { JobBaseResource } from '@/model/valueObject/JobBaseResource'

export function useCommonJobFactory() {
  const createBase = (resourceName: JobBaseResource, system: string): JobBase => {
    return {
      id: 0,
      status: JobStatus.Default,
      result: '',
      batchProcessedIterationCount: 0,
      finishedAt: null,
      startedAt: null,
      lastBatchProcessedRecord: '',
      createdAt: dateTimeNow(),
      modifiedAt: dateTimeNow(),
      createdBy: null,
      modifiedBy: null,
      _resourceName: resourceName,
      _system: system,
    }
  }

  const createUserDataDelete = (system: string): JobUserDataDelete => {
    return {
      ...createBase('jobUserDataDelete', system),
      ...{
        targetUserId: null,
        anonymizeUser: false,
      },
    }
  }

  return {
    createBase,
    createUserDataDelete,
  }
}
