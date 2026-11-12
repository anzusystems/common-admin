import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  useDamCachedAuthors,
  useDamCachedAuthorsForRemoteAutocomplete,
} from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import {
  useDamCachedKeywords,
  useCachedKeywordsForRemoteAutocomplete,
} from '@/domains/dam/keyword/composables/cachedKeywords'
import { coreDamOptions } from '@/plugins/pluginOptions'

// The plugin options are set at install time, after the modules that ask for a cache are loaded.
// A test or a hot update can set them again. The caches live as long as the page, so each case uses names of its own.

const EXT = 2
const NAMES = /^\/(\w+)\/(author|keyword)\/ext-system\/(\d+)\/search$/
const UNKNOWN = "Composable can't be used without properly configured common admin."
/** Waits from this length are held. The caches wait 1.5 s before they ask. */
const HELD_FROM_MS = 1_200

let waits: LongWaits

const namingDam = (which: string) => {
  const dam = createFakeDam({ asset: `/${which}/asset`, image: `/${which}/image` })
  dam.reply((request) => {
    if (request.method !== 'GET') return undefined
    const [path, query] = request.url.split('?')
    const params = new URLSearchParams(query)
    if (NAMES.test(path!)) {
      const ids = (params.get('id') ?? '').split(',')
      const found = ids.map((id) => ({ id, name: `${id} of ${which}`, identifier: '', flags: { reviewed: true } }))
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    if (path === '/adm/v1/user') {
      const ids = (params.get('filter_in[id]') ?? '').split(',').map(Number)
      const found = ids.map((id) => ({
        id,
        email: `${id}@${which}`,
        avatar: { color: '', text: '' },
        person: { firstName: '', lastName: '', fullName: `${id} of ${which}` },
      }))
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    return undefined
  })
  return dam
}
const configOf = (dam: FakeDam, which: string) => ({
  damClient: dam.client,
  endPointAuthor: `/${which}/author`,
  endPointKeyword: `/${which}/keyword`,
})
const setOptions = (configs: Record<string, FakeDam>) =>
  initCommonAdminCoreDamOptions({
    configs: Object.fromEntries(
      Object.entries({ default: namingDam('default'), ...configs }).map(([name, dam]) => [name, configOf(dam, name)])
    ),
  } as never)

beforeEach(() => {
  waits = holdLongWaits(HELD_FROM_MS)
})
afterEach(async () => {
  await waits.elapseAll()
  waits.restore()
})

describe('the caches of names under a named DAM configuration', () => {
  it('give a name asked for before the plugin sets the options its caches, which ask under it once they are set', async () => {
    coreDamOptions.value = undefined
    const authors = useDamCachedAuthors('early')
    const keywords = useDamCachedKeywords('early')
    const users = useDamCachedUsers('early')
    expect(() => useDamCachedAuthorsForRemoteAutocomplete('early')).not.toThrow()
    expect(() => useCachedKeywordsForRemoteAutocomplete('early')).not.toThrow()
    const never = useDamCachedAuthors('never')

    const early = namingDam('early')
    setOptions({ early })
    useExtSystemIdForCached('early').cachedExtSystemId.value = EXT
    useExtSystemIdForCached('never').cachedExtSystemId.value = EXT
    authors.addToCachedAuthors('author-early')
    authors.fetchCachedAuthors()
    keywords.addToCachedKeywords('keyword-early')
    keywords.fetchCachedKeywords()
    users.addToCachedUsers(81)
    users.fetchCachedUsers()
    never.addToCachedAuthors('author-never')
    never.fetchCachedAuthors()
    await waits.elapse()
    await flushPromises()

    expect(authors.getCachedAuthor('author-early')?.name).toBe('author-early of early')
    expect(keywords.getCachedKeyword('keyword-early')?.name).toBe('keyword-early of early')
    expect(users.getCachedUser(81)?.person.fullName).toBe('81 of early')
    expect(early.requests.map((request) => request.url.split('?')[0]).sort()).toEqual([
      '/adm/v1/user',
      `/early/author/ext-system/${EXT}/search`,
      `/early/keyword/ext-system/${EXT}/search`,
    ])
    expect(useDamCachedAuthors('early').cachedAuthors).toBe(authors.cachedAuthors)
    expect(never.getCachedAuthor('author-never')?._unresolved).toBe(true)
    expect(() => useDamCachedAuthors('never')).toThrow(UNKNOWN)
  })

  it('throw on every call for a name the options set again have left out, also one that has its caches', () => {
    setOptions({ gone: namingDam('gone') })
    const authors = useDamCachedAuthors('gone')
    const keywords = useDamCachedKeywords('gone')
    const users = useDamCachedUsers('gone')

    setOptions({})
    const uses = [
      useDamCachedAuthors,
      useDamCachedAuthorsForRemoteAutocomplete,
      useDamCachedKeywords,
      useCachedKeywordsForRemoteAutocomplete,
      useDamCachedUsers,
    ]
    for (const use of uses) {
      expect(() => use('gone')).toThrow(UNKNOWN)
      expect(() => use('gone')).toThrow(UNKNOWN)
    }

    setOptions({ gone: namingDam('gone') })
    expect(useDamCachedAuthors('gone').cachedAuthors).toBe(authors.cachedAuthors)
    expect(useDamCachedKeywords('gone').cachedKeywords).toBe(keywords.cachedKeywords)
    expect(useDamCachedUsers('gone').cachedUsers).toBe(users.cachedUsers)
  })
})
