import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { SortableItemDataAware } from '@/components/sortable/sortableUtils'
import type { IntegerId } from '@/types/common'
import type { DatatableSortBy } from '@/composables/system/datatableColumns.ts'

export interface UserAdminConfig<TData = UserAdminConfigDataFilterBookmark | UserAdminConfigDataPinnedWidgets>
  extends AnzuUserAndTimeTrackingAware,
    SortableItemDataAware {
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
  FilterBookmark: 'filterBookmark',
} as const
export const UserAdminConfigTypeDefault = UserAdminConfigType.PinnedWidgets
export type UserAdminConfigTypeType = (typeof UserAdminConfigType)[keyof typeof UserAdminConfigType]

export const UserAdminConfigLayoutType = {
  Desktop: 'desktop',
  Mobile: 'mobile',
} as const
export const UserAdminConfigLayoutTypeDefault = UserAdminConfigLayoutType.Desktop
export type UserAdminConfigLayoutTypeType = (typeof UserAdminConfigLayoutType)[keyof typeof UserAdminConfigLayoutType]

export interface UserAdminConfigDataFilterBookmark {
  filter: string
  datatableHiddenColumns?: string[]
  sortBy?: DatatableSortBy
}

export type UserAdminConfigDataPinnedWidgets<TVariant extends string = string> = Array<{
  variant: TVariant
  position: number
}>
