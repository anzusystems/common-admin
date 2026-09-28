import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { cloneDeep } from '@/utils/common'

describe('cloneDeep', () => {
  const d = new Date(0)

  it('keeps a Date nested behind a reactive element of a plain array', () => {
    const out = cloneDeep([reactive({ d })]) as any
    expect(out[0].d).toBeInstanceOf(Date)
  })

  it('keeps a Date inside a ref holding an object', () => {
    const out = cloneDeep(ref({ d })) as any
    expect(out.d).toBeInstanceOf(Date)
  })

  it('keeps a Map nested behind a reactive property of a plain object', () => {
    const out = cloneDeep({ inner: reactive({ m: new Map([[1, 2]]) }) }) as any
    expect(out.inner.m).toBeInstanceOf(Map)
  })

  it('keeps the length of a sparse array', () => {
    const sparse = [1]
    sparse.length = 3
    expect(cloneDeep(sparse)).toHaveLength(3)
  })
})
