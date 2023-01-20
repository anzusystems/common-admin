import type { Grant } from '@/model/valueObject/Grant'

type AclKey = string
export type AclValue = string

export type Permissions = {
  [key in AclValue]?: Grant
}
