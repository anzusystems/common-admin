import type { DocId } from '@/shared/types/common'
import type { CustomDataFormElementTypeType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'

export interface CustomDataFormElement {
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
