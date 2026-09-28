import type { GrantType } from '@/model/valueObject/Grant'

export type AclValue = `${string}_${string}_${string}`

export type Permissions = {
  [key in AclValue]?: GrantType
}
