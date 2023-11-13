import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DocId } from '@/types/common'
import type { CustomFormElementTypeType } from '@/components/customForm/CustomFormElementTypes'

export interface CustomFormElement extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  property: string
  name: string
  position: number
  attributes: CustomFormElementAttributes
}

export interface CustomFormElementAttributes {
  type: CustomFormElementTypeType
  minValue: number | null
  maxValue: number | null
  minCount: number | null
  maxCount: number | null
  required: boolean
  searchable: boolean
  readonly: boolean
}

export interface CustomFormDataAware {
  customData: { [key: string]: any }
}
