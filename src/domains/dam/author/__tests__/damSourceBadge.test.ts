import { describe, expect, it } from 'vitest'
import { resolveSourceBadges } from '@/domains/dam/author/composables/damSourceBadge'
import type { DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'

const source = (id: string, badge: string, priority = 0): DamAuthorMinimal => ({
  id,
  name: `Source ${id}`,
  identifier: '',
  reviewed: true,
  hiddenInCredit: false,
  priority,
  badge,
})

const cacheOf = (...sources: DamAuthorMinimal[]) => {
  const cache = new Map(sources.map((item) => [item.id, item]))
  return (id: string) => cache.get(id)
}

const badgesOf = (ids: string[], get: ReturnType<typeof cacheOf>) =>
  resolveSourceBadges(ids, get).map((item) => item.badge)

describe('resolveSourceBadges', () => {
  it('skips a source without a badge and a source that is not cached', () => {
    const get = cacheOf(source('tasr', 'TASR'), source('korzar', ''))

    expect(resolveSourceBadges(['korzar', 'missing', 'tasr'], get)).toEqual([
      { id: 'tasr', name: 'Source tasr', badge: 'TASR' },
    ])
  })

  it('puts a higher priority first and keeps the order of equal ones', () => {
    const ids = ['tasr', 'sita', 'ap']
    const get = cacheOf(source('tasr', 'TASR'), source('sita', 'SITA'), source('ap', 'AP', 100))

    expect(badgesOf(ids, get)).toEqual(['AP', 'TASR', 'SITA'])
    expect(ids).toEqual(['tasr', 'sita', 'ap'])
  })
})
