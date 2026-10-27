import { expect, vi } from 'vitest'
import type { FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'

// Names of the authors and keywords of a queue row. The row holds ids. Its inputs
// read names from two caches, which ask the DAM after a pause of their own.
// The two paths are fixed in the library, whatever endpoints the application configures.

export const DAM_NAMES = /^\/adm\/v1\/(author|keyword)\/ext-system\/(\d+)\/search\?(.*)$/

export const answerDamNames = (dam: FakeDam) =>
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(DAM_NAMES) : null
    if (!match) return undefined
    const ids = (new URLSearchParams(match[3]).get('id') ?? '').split(',')
    const found = ids.map((id) => ({ id, name: `Name of ${id}`, identifier: '', flags: { reviewed: true } }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })

export const damNameLookups = (dam: FakeDam) => dam.requests.filter((request) => DAM_NAMES.test(request.url))

/**
 * The caches have asked for everything queued. They are shared by the
 * whole file and use whatever client is configured at that moment.
 * Left alone, a lookup from one case goes out in the next.
 */
export const damNamesAsked = async () => {
  const { toFetchCachedAuthors } = useDamCachedAuthors()
  const { toFetchCachedKeywords } = useDamCachedKeywords()
  await vi.waitFor(() => expect(toFetchCachedAuthors.value.size + toFetchCachedKeywords.value.size).toBe(0), {
    timeout: 8000,
    interval: 50,
  })
  // Wait for the request itself after the queue drains.
  await new Promise((resolve) => setTimeout(resolve, 50))
}
