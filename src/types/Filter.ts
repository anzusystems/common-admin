export interface FilterBag {
  [key: string]: Filter
}

export interface Filter {
  field: string
  multiple: boolean
  variant: FilterVariant
  model: any
  default: any
  title: string
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
