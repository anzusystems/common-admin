import { describe, expect, it } from 'vitest'
import {
  objectDeepFreeze,
  objectDeletePropertyByPath,
  objectGetValueByPath,
  objectSetValueByPath,
} from '@/shared/utils/object'

describe('objectGetValueByPath', () => {
  it('answers undefined for a null intermediate instead of throwing', () => {
    expect(() => objectGetValueByPath({ texts: null }, 'texts.title')).not.toThrow()
    expect(objectGetValueByPath({ texts: null }, 'texts.title')).toBeUndefined()
  })

  it('answers undefined for a primitive intermediate instead of throwing', () => {
    // permissionConfigActions.translatePermission: translation.<group>.<key> being a plain string
    expect(() => objectGetValueByPath({ a: { b: 'Title' } }, 'a.b.sk')).not.toThrow()
  })
})

describe('utils/object', () => {
  describe('objectDeepFreeze', () => {
    it('freezes every level and returns the same object', () => {
      const source = { a: { b: [1, { c: 2 }] } }
      const frozen = objectDeepFreeze(source)
      expect(frozen).toBe(source)
      expect(Object.isFrozen(source)).toBe(true)
      expect(Object.isFrozen(source.a)).toBe(true)
      expect(Object.isFrozen(source.a.b)).toBe(true)
      expect(Object.isFrozen(source.a.b[1])).toBe(true)
    })

    it('leaves null leaves alone', () => {
      expect(() => objectDeepFreeze({ a: null, b: undefined })).not.toThrow()
    })
  })

  describe('objectGetValueByPath', () => {
    const data = { a: { b: { c: 3 } }, list: [{ id: 7 }], zero: 0, empty: '' }

    it('reads nested values, array indexes and falsy leaves', () => {
      expect(objectGetValueByPath(data, 'a.b.c')).toBe(3)
      expect(objectGetValueByPath(data, 'list.0.id')).toBe(7)
      expect(objectGetValueByPath(data, 'zero')).toBe(0)
      expect(objectGetValueByPath(data, 'empty')).toBe('')
    })

    it('answers undefined for a missing key', () => {
      expect(objectGetValueByPath(data, 'a.x.c')).toBeUndefined()
      expect(objectGetValueByPath(data, 'nope')).toBeUndefined()
    })

    it('takes a custom separator', () => {
      expect(objectGetValueByPath(data, 'a/b/c', '/')).toBe(3)
    })
  })

  describe('objectSetValueByPath', () => {
    it('creates missing levels', () => {
      const target: Record<string, any> = {}
      objectSetValueByPath(target, 'a.b.c', 1)
      expect(target).toEqual({ a: { b: { c: 1 } } })
    })

    it('keeps siblings and overwrites the leaf', () => {
      const target: Record<string, any> = { a: { keep: true, b: 1 } }
      objectSetValueByPath(target, 'a.b', 2)
      expect(target).toEqual({ a: { keep: true, b: 2 } })
    })

    // A collab change for `seo.title` reaches an article whose `seo` is still null: the peer's value
    // must land, not throw out of the socket listener.
    it('replaces a null or primitive level instead of throwing', () => {
      const target: Record<string, any> = { seo: null, count: 3 }
      expect(() => objectSetValueByPath(target, 'seo.title', 'x')).not.toThrow()
      expect(() => objectSetValueByPath(target, 'count.value', 4)).not.toThrow()
      expect(target).toEqual({ seo: { title: 'x' }, count: { value: 4 } })
    })

    it('sets a top-level key', () => {
      const target: Record<string, any> = {}
      objectSetValueByPath(target, 'a', null)
      expect(target).toEqual({ a: null })
    })
  })

  describe('objectDeletePropertyByPath', () => {
    it('deletes a nested key and returns the object', () => {
      const target = { a: { b: 1, c: 2 } }
      expect(objectDeletePropertyByPath(target, 'a.b')).toBe(target)
      expect(target).toEqual({ a: { c: 2 } })
    })

    it('deletes a flat key (the permission editor passes flat names)', () => {
      const target: Record<string, number> = { cms_article_create: 1, cms_article_read: 1 }
      objectDeletePropertyByPath(target, 'cms_article_create')
      expect(target).toEqual({ cms_article_read: 1 })
    })

    it('ignores a missing leaf', () => {
      const target = { a: { b: 1 } }
      objectDeletePropertyByPath(target, 'a.x')
      expect(target).toEqual({ a: { b: 1 } })
    })

    // The set counterpart creates a missing level; the delete one throws on it instead of
    // having nothing to delete.
    it('ignores a missing level', () => {
      const target = { a: { b: 1 } }
      expect(() => objectDeletePropertyByPath(target, 'x.y.z')).not.toThrow()
      expect(target).toEqual({ a: { b: 1 } })
    })
  })
})
