import type { JobBase, JobUserDataDelete } from '@/domains/job/types/Job'
import { JobStatusDefault } from '@/domains/job/valueObject/JobStatus'
import { dateTimeNow } from '@/shared/utils/datetime'
import type { JobBaseResource } from '@/domains/job/valueObject/JobBaseResource'

export function useCommonJobFactory() {
  const createBase = (resourceName: JobBaseResource, system: string): JobBase => {
    return {
      id: 0,
      scheduledAt: dateTimeNow(),
      priority: 1,
      status: JobStatusDefault,
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
      targetUserId: null,
      anonymizeUser: false,
    }
  }

  return {
    createBase,
    createUserDataDelete,
  }
}
