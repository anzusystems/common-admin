import { describe, expect, it } from 'vitest'

// Pinia keeps one store per id across the library and the admin that uses it: an admin that defines a store under
// an id of the library gets the library's store, or the library gets the admin's (finding 18). Every store of the
// library has an id of its own, with the prefix `commonAdmin`, which an admin does not use.

const sources = import.meta.glob(
  ['../**/*.ts', '../**/*.vue', '!../playground/**', '!../test/**', '!../**/__tests__/**'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>

const storeIds = Object.values(sources).flatMap((source) =>
  [...source.matchAll(/defineStore\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
)

describe('the ids of the stores of the library', () => {
  it('all start with commonAdmin, each its own', () => {
    expect(storeIds.length).toBeGreaterThan(10)
    expect(storeIds.filter((id) => !id.startsWith('commonAdmin'))).toEqual([])
    expect(new Set(storeIds).size).toBe(storeIds.length)
  })
})
