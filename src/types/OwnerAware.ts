import type { IntegerId } from '@/types/common'
import { isObject } from '@/utils/common'

export interface OwnerAware {
  owners: IntegerId[]
}

export const isOwnerAware = (value: unknown): value is OwnerAware => {
  return isObject(value) && Object.hasOwn(value, 'owners')
}
