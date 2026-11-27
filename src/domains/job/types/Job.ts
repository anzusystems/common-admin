import type { DatetimeUTC, DatetimeUTCNullable, IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { JobBaseResource } from '@/domains/job/valueObject/JobBaseResource'
import type { JobStatusType } from '@/domains/job/valueObject/JobStatus'

export interface JobBase<T extends JobBaseResource = JobBaseResource> extends AnzuUserAndTimeTrackingAware {
  readonly id: IntegerId
  scheduledAt: DatetimeUTC
  priority: number
  readonly status: JobStatusType
  readonly startedAt: DatetimeUTCNullable
  readonly finishedAt: DatetimeUTCNullable
  readonly lastBatchProcessedRecord: string
  readonly batchProcessedIterationCount: number
  readonly result: string
  _resourceName: T
  readonly _system: string
}

export interface JobUserDataDelete<T extends JobBaseResource = JobBaseResource> extends JobBase {
  targetUserId: IntegerIdNullable
  anonymizeUser: boolean
  _resourceName: T
}
