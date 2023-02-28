import type { DatetimeUTCNullable, IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { JobResource } from '@/model/valueObject/JobResource'

export interface Job<T extends JobResource = JobResource> extends AnzuUserAndTimeTrackingAware {
  readonly id: IntegerId
  readonly status: string
  readonly startedAt: DatetimeUTCNullable
  readonly finishedAt: DatetimeUTCNullable
  readonly lastBatchProcessedRecord: string
  readonly batchProcessedIterationCount: number
  targetUserId: IntegerIdNullable
  anonymizeUser: boolean
  readonly result: string
  _resourceName: T
  readonly _system: string
}
