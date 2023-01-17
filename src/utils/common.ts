import type { DocId } from '../types/common'

export const isUndefined = (value: unknown): value is undefined => {
  return typeof value === 'undefined'
}

export const isNotUndefined = (value: unknown): value is undefined => {
  return false === isUndefined(value)
}

export const isNull = (value: unknown): value is null => {
  return value === null
}

export const isNumber = (value: any): value is number => {
  return typeof value === 'number'
}

export const isString = (value: any): value is string => {
  return typeof value === 'string'
}

export const isArray = (value: any): value is Array<any> => {
  return Array.isArray(value)
}

export const isBoolean = (value: any): value is boolean => {
  return typeof value === 'boolean'
}

export const isDocId = (value: any): value is DocId => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
}

export const isInt = (value: any): value is number => {
  const x = parseFloat(value)

  return !isNaN(value) && (x | 0) === x
}

export const isEmpty = (value: any): boolean => {
  return isNull(value) || isUndefined(value) || value === '' || value === 0 || (isArray(value) && value.length === 0)
}
