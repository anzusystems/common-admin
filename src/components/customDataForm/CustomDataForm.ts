import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DocId } from '@/types/common'
import type { CustomDataFormElementTypeType } from '@/components/customDataForm/CustomDataFormElementTypes'

export interface CustomDataFormElement extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  property: string
  name: string
  position: number
  attributes: CustomDataFormElementAttributes
}

export interface CustomDataFormElementAttributes {
  type: CustomDataFormElementTypeType
  minValue: number | null
  maxValue: number | null
  minCount: number | null
  maxCount: number | null
  required: boolean
  searchable: boolean
  readonly: boolean
}

export type CustomDataValue = boolean | string | number | string[] | number[]

export interface CustomDataAware {
  customData: { [key: string]: CustomDataValue }
}
