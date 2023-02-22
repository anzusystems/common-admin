import type { DocId } from '@/types/common'

export const isUndefined = (value: unknown): value is undefined => {
  return typeof value === 'undefined'
}

export const isDefined = <T>(value: T | undefined): value is T => {
  return !isUndefined(value)
}

/**
 * @deprecated use isDefined
 */
export const isNotUndefined = (value: unknown) => {
  return false === isUndefined(value)
}

export const isNull = (value: unknown): value is null => {
  return value === null
}

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number'
}

export const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

export const isArray = (value: unknown): value is Array<unknown> => {
  return Array.isArray(value)
}

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean'
}

export const isDocId = (value: unknown): value is DocId => {
  return isString(value) && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
}

export const isInt = (value: any): value is number => {
  const x = parseFloat(value)

  return !isNaN(value) && (x | 0) === x
}

export const isObject = (value: unknown): value is object => {
  return typeof value === 'object' && !isArray(value) && !isNull(value)
}

export const isEmptyObject = <T>(value: T): value is T => {
  if (isObject(value)) {
    return Object.keys(value).length === 0
  }
  return false
}

export const isEmptyArray = (value: unknown): value is [] => {
  return isArray(value) && value.length === 0
}

export const isEmpty = (value: unknown): boolean => {
  return (
    isNull(value) || isUndefined(value) || value === '' || value === 0 || isEmptyArray(value) || isEmptyObject(value)
  )
}
