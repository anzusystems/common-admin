import { isUndefined } from '@/utils/common'
import { isProxy, isRef, toRaw } from 'vue'

export const deepFreeze = <T>(obj: T) => {
  const propNames = Object.getOwnPropertyNames(obj)
  for (const name of propNames) {
    const value = (obj as any)[name]
    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  }
  return Object.freeze(obj)
}

export const getValueByPath = (obj: any, path: string, splitChar = '.') => {
  const a = path.split(splitChar)
  let o = obj
  while (a.length) {
    const n = a.shift()
    if (isUndefined(n) || !(n in o)) return
    o = o[n]
  }
  return o
}

export const setValueByPath = (obj: any, path: string, value: any, splitChar = '.') => {
  const a = path.split(splitChar)
  let o = obj
  while (a.length - 1) {
    const n = a.shift()
    if (isUndefined(n)) return // todo check if correct if
    if (!(n in o)) o[n] = {}
    o = o[n]
  }
  o[a[0]] = value
}

export function deletePropertyByPath<T>(obj: T, path: string, splitChar = '.'): T {
  const pathParts = path.split(splitChar)
  const lastIndex = pathParts.length - 1

  function recurse(obj: any, index = 0) {
    const key = pathParts[index]

    if (index === lastIndex) {
      delete obj[key]
      return
    }

    recurse(obj[key], index + 1)
  }

  recurse(obj)
  return obj
}

/**
 * Use only for objects with some primitives like number, string, boolean, null. Not supported: function, undefined, symbol, ...
 */
export const simpleCloneObject = <T>(object: T) => {
  if (typeof structuredClone === 'function') {
    try {
      if (isProxy(object)) {
        return structuredClone(toRaw(object)) as T
      }
      if (isRef(object)) {
        return structuredClone(object.value) as T
      }
      return structuredClone(object) as T
    } catch (error) {
      console.error('simpleCloneObject error', object)

      return JSON.parse(JSON.stringify(object)) as T
    }
  }
  return JSON.parse(JSON.stringify(object)) as T
}

export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>
}
