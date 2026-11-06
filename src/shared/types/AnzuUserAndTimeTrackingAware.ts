import type { DatetimeUTC, IntegerIdNullable } from '@/shared/types/common'
import type { CreatedByAware } from '@/shared/types/CreatedByAware'

export interface AnzuUserAndTimeTrackingAware extends CreatedByAware {
  createdAt: DatetimeUTC
  modifiedAt: DatetimeUTC
  modifiedBy: IntegerIdNullable
}
