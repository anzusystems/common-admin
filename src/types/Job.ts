import type { DatetimeUTC, DatetimeUTCNullable, IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { JobBaseResource } from '@/model/valueObject/JobBaseResource'
import type { JobStatus } from '@/model/valueObject/JobStatus'

export interface JobBase<T extends JobBaseResource = JobBaseResource> extends AnzuUserAndTimeTrackingAware {
  readonly id: IntegerId
  scheduledAt: DatetimeUTC
  priority: number
  readonly status: JobStatus
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
