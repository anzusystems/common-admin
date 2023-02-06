import { IntegerIdNullable } from '@/types/common'

export interface CreatedByAware {
  createdBy: IntegerIdNullable
}

export const isCreatedByAware = (value: object): value is CreatedByAware => {
  return Object.hasOwn(value, 'createdBy')
}
