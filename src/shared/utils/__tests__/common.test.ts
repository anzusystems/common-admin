import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import {
  cloneDeep,
  isArray,
  isBoolean,
  isDefined,
  isDocId,
  isEmpty,
  isEmptyArray,
  isEmptyObject,
  isFunction,
  isInt,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/shared/utils/common'

describe('utils/common', () => {
  describe('type guards', () => {
    it('tell undefined from null', () => {
      expect(isUndefined(undefined)).toBe(true)
      expect(isUndefined(null)).toBe(false)
      expect(isDefined(null)).toBe(true)
      expect(isDefined(0)).toBe(true)
      expect(isDefined(undefined)).toBe(false)
      expect(isNull(null)).toBe(true)
      expect(isNull(undefined)).toBe(false)
    })

    it('check primitive types', () => {
      expect(isNumber(NaN)).toBe(true)
      expect(isNumber('1')).toBe(false)
      expect(isString('')).toBe(true)
      expect(isBoolean(false)).toBe(true)
      expect(isBoolean(0)).toBe(false)
      expect(isFunction(() => 1)).toBe(true)
      expect(isArray([])).toBe(true)
      expect(isArray({ length: 0 })).toBe(false)
    })

    it('isObject excludes null and arrays', () => {
      expect(isObject({})).toBe(true)
      expect(isObject(null)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject('x')).toBe(false)
    })

    it('isDocId accepts a UUID in either case only', () => {
      expect(isDocId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
      expect(isDocId('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(true)
      expect(isDocId('3f2504e04f8911d39a0c0305e82c3301')).toBe(false)
      expect(isDocId(' 3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(false)
      expect(isDocId(123)).toBe(false)
    })
  })

  describe('isInt', () => {
    it('accepts integers and integer strings', () => {
      expect(isInt(0)).toBe(true)
      expect(isInt(-5)).toBe(true)
      expect(isInt(5.0)).toBe(true)
      expect(isInt('42')).toBe(true)
    })

    it('rejects fractions, partial strings and non-numbers', () => {
      expect(isInt(5.5)).toBe(false)
      expect(isInt('5.5')).toBe(false)
      expect(isInt('5px')).toBe(false)
      expect(isInt('')).toBe(false)
      expect(isInt(null)).toBe(false)
      expect(isInt(undefined)).toBe(false)
      expect(isInt(NaN)).toBe(false)
      expect(isInt(Infinity)).toBe(false)
      expect(isInt(true)).toBe(false)
    })

    // `(x | 0) === x` truncates to 32 bits, so every id above 2^31 - 1 "is not an integer".
    it('accepts integers beyond 32 bits', () => {
      expect(isInt(2147483647)).toBe(true)
      expect(isInt(2147483648)).toBe(true)
      expect(isInt(Number.MAX_SAFE_INTEGER)).toBe(true)
      expect(isInt('3000000000')).toBe(true)
    })
  })

  describe('isEmpty', () => {
    it('treats null, undefined, "", 0, [] and {} as empty', () => {
      for (const value of [null, undefined, '', 0, [], {}]) {
        expect(isEmpty(value), JSON.stringify(value)).toBe(true)
      }
    })

    it('treats other values as not empty', () => {
      for (const value of [' ', '0', 1, [0], { a: undefined }, NaN]) {
        expect(isEmpty(value), String(value)).toBe(false)
      }
    })

    // Documented: `false` is not empty while `0` is, and a Date counts as an empty object.
    it('answers false for false and true for a Date', () => {
      expect(isEmpty(false)).toBe(false)
      expect(isEmpty(new Date())).toBe(true)
      expect(isEmptyObject(new Date())).toBe(true)
    })

    it('isEmptyArray and isEmptyObject reject each other', () => {
      expect(isEmptyArray({})).toBe(false)
      expect(isEmptyObject([])).toBe(false)
    })
  })

  describe('cloneDeep', () => {
    it('clones plain data deeply', () => {
      const source = { a: 1, b: { c: [1, 2, { d: 'x' }] }, n: null }
      const copy = cloneDeep(source)
      expect(copy).toEqual(source)
      expect(copy.b).not.toBe(source.b)
      expect(copy.b.c[2]).not.toBe(source.b.c[2])
    })

    it('keeps a Date a Date', () => {
      const copy = cloneDeep({ at: new Date('2026-03-29T01:00:00Z') })
      expect(copy.at).toBeInstanceOf(Date)
      expect(copy.at.toISOString()).toBe('2026-03-29T01:00:00.000Z')
    })

    it('clones a reactive object into a plain one', () => {
      const state = reactive({ a: { b: 1 } })
      const copy = cloneDeep(state)
      copy.a.b = 2
      expect(state.a.b).toBe(1)
    })

    // Documented ("use only for primitives"): a function makes structuredClone throw, and the JSON
    // fallback drops the key.
    it('drops functions through the JSON fallback', () => {
      const copy = cloneDeep({ a: 1, fn: () => 1 })
      expect(copy).toEqual({ a: 1 })
    })
  })
})
