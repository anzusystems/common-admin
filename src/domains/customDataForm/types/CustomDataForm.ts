import type { DocId } from '@/shared/types/common'
import type { CustomDataFormElementTypeType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'

export interface CustomDataFormElement {
  id: DocId
  property: string
  /** As stored in the system that owns the form, in one language. Shown only where `nameKey` has no translation. */
  name: string
  /** Translation key of the name. Set by the library when it reads a DAM form, not sent by any API. */
  nameKey?: string
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

/**
 * `null` is an emptied value (e.g. a cleared number), and the API
 * returns it that way once saved. A value never set has no key.
 */
export type CustomDataValue = boolean | string | number | string[] | number[] | null

export interface CustomDataAware {
  customData: { [key: string]: CustomDataValue }
}
