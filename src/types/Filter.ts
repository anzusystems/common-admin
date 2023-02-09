export interface FilterBag {
  [key: string]: Filter
}

export interface Filter<T = any> {
  field: string
  multiple: boolean
  variant: FilterVariant
  model: T | null
  default: T | null
  titleT?: string
  error: string
  mandatory: boolean
  exclude: boolean
}

export type FilterVariant =
  | 'lt'
  | 'in'
  | 'notIn'
  | 'endsWith'
  | 'startsWith'
  | 'memberOf'
  | 'contains'
  | 'neq'
  | 'gte'
  | 'gt'
  | 'eq'
  | 'lte'
