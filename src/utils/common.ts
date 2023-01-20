import type { DocId } from '@/types/common'

export const isUndefined = (value: unknown): value is undefined => {
  return typeof value === 'undefined'
}

export const isNotUndefined = (value: unknown) => {
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

export const isObject = (value: any): value is object => {
  return typeof value === 'object' && !isArray(value) && !isNull(value)
}

export const isEmptyObject = (value: any): value is object => {
  if (isObject(value)) {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const property in value) {
      return false
    }
    return true
  }
  return false
}

export const isEmptyArray = (value: any): value is Array<any> => {
  if (isArray(value)) {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const property in value) {
      return false
    }
    return true
  }
  return false
}

export const isEmpty = (value: any): boolean => {
  return isNull(value)
    || isUndefined(value)
    || value === ''
    || value === 0
    || isEmptyArray(value)
    || isEmptyObject(value)
}
