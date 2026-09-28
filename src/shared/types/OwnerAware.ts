import type { IntegerId } from '@/shared/types/common'
import { isObject } from '@/shared/utils/common'

export interface OwnerAware {
  owners: IntegerId[]
}

export const isOwnerAware = (value: unknown): value is OwnerAware => {
  return isObject(value) && Object.hasOwn(value, 'owners')
}
