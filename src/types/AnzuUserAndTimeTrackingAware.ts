import type { DatetimeUTC, IntegerIdNullable } from '@/types/common'
import type { CreatedByAware } from '@/types/CreatedByAware'

export interface AnzuUserAndTimeTrackingAware extends CreatedByAware {
  createdAt: DatetimeUTC
  modifiedAt: DatetimeUTC
  modifiedBy: IntegerIdNullable
}
