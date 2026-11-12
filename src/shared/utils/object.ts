import { isUndefined } from '@/shared/utils/common'

export const objectDeepFreeze = <T>(obj: T) => {
  const propNames = Object.getOwnPropertyNames(obj)
  for (const name of propNames) {
    const value = (obj as any)[name]
    if (value && typeof value === 'object') {
      objectDeepFreeze(value)
    }
  }
  return Object.freeze(obj)
}

export const objectGetValueByPath = <R = any>(obj: any, path: string, splitChar = '.') => {
  const a = path.split(splitChar)
  let o = obj
  while (a.length) {
    const n = a.shift()
    if (isUndefined(n) || o === null || (typeof o !== 'object' && typeof o !== 'function') || !(n in o)) return
    o = o[n]
  }
  return o as R
}

export const objectSetValueByPath = (obj: any, path: string, value: any, splitChar = '.') => {
  const a = path.split(splitChar)
  let o = obj
  while (a.length - 1) {
    const n = a.shift()
    if (isUndefined(n)) return // todo check if correct if
    // A null or primitive level counts as missing, as in lodash `set`: `in` and the write throw on it.
    if (o[n] === null || (typeof o[n] !== 'object' && typeof o[n] !== 'function')) o[n] = {}
    o = o[n]
  }
  o[a[0]!] = value
}

export function objectDeletePropertyByPath<T>(obj: T, path: string, splitChar = '.'): T {
  const pathParts = path.split(splitChar)
  const lastIndex = pathParts.length - 1

  function recurse(obj: any, index = 0) {
    if (obj === null || typeof obj !== 'object') return
    const key = pathParts[index]!

    if (index === lastIndex) {
      delete obj[key]
      return
    }

    recurse(obj[key], index + 1)
  }

  recurse(obj)
  return obj
}

export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>
}
