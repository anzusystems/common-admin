import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware.ts'
import type { SortableItemDataAware } from '@/components/sortable/sortableUtils.ts'
import type { IntegerId } from '@/types/common.ts'

export interface UserAdminConfig<TData = any> extends AnzuUserAndTimeTrackingAware, SortableItemDataAware {
  id: IntegerId
  user: IntegerId
  configType: UserAdminConfigTypeType
  layoutType: UserAdminConfigLayoutTypeType
  systemResource: string
  customName: string
  defaultConfig: boolean
  data: TData
  position: number
  _resourceName: 'userAdminConfig'
  _system: string
}

export const UserAdminConfigType = {
  PinnedWidgets: 'pinnedWidgets',
  Filter: 'filter',
} as const
export const UserAdminConfigTypeDefault = UserAdminConfigType.PinnedWidgets
export type UserAdminConfigTypeType = (typeof UserAdminConfigType)[keyof typeof UserAdminConfigType]

export const UserAdminConfigLayoutType = {
  Desktop: 'desktop',
  Mobile: 'mobile',
} as const
export const UserAdminConfigLayoutTypeDefault = UserAdminConfigLayoutType.Desktop
export type UserAdminConfigLayoutTypeType = (typeof UserAdminConfigLayoutType)[keyof typeof UserAdminConfigLayoutType]
