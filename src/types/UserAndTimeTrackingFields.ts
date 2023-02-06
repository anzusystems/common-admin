import type { DatetimeUTC, IntegerIdNullable } from '@/types/common'

export interface UserAndTimeTrackingFields extends CreatedByAware {
  createdAt: DatetimeUTC
  modifiedAt: DatetimeUTC
  modifiedBy: IntegerIdNullable
}

export interface CreatedByAware {
  createdBy: IntegerIdNullable
}

export const isCreatedByAware = (value: object): value is CreatedByAware => {
  return Object.hasOwn(value, 'createdBy')
}
