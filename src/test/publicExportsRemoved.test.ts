import { describe, expect, it } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- this test is about the public entry itself
import type * as lib from '@/lib'

// Names 2.0.0 took out of the public entry. vue-tsc checks the `@ts-expect-error` lines: a name that
// came back would make its directive unused, which is an error.
describe('removed from the public entry in 2.0.0', () => {
  it('legacy list types (FilterData, NestedTree and NestedTreeNode replace them)', () => {
    // @ts-expect-error -- use FilterData
    type A = lib.FilterStore<[]>
    // @ts-expect-error -- use NestedTree
    type B = lib.SortableNested
    // @ts-expect-error -- use NestedTreeNode
    type C = lib.SortableNestedItem
    // @ts-expect-error -- gone with them
    type D = lib.SortableItemWithParentDataAware
    const unused: [A?, B?, C?, D?] = []
    expect(unused).toEqual([])
  })
})
