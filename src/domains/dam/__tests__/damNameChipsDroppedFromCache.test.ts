import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import AuthorRemoteAutocompleteCachedAuthorChip from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import KeywordRemoteAutocompleteCachedKeywordChip from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'

// The name caches keep 1 000 names and drop the oldest. A chip
// whose name was dropped used to spin until its id was added again.
// Names shown by a chip are pinned, so the cache drops only names nobody shows and may go over its limit.

let dam: FakeDam
let chips: VueWrapper | undefined

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(cmsConfiguration.endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  answerDamNames(dam)
})
afterEach(async () => {
  chips?.unmount()
  chips = undefined
  await damNamesAsked()
  useDamCachedAuthors().cachedAuthors.value.clear()
  useDamCachedKeywords().cachedKeywords.value.clear()
})

const author = (id: string, name: string) => ({ id, name, identifier: '', flags: { reviewed: true } }) as never
const keyword = (id: string, name: string) => ({ id, name }) as never
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}-${index}`)

describe.each<[string, Component, 'author' | 'keyword']>([
  ['the chips of authors', AuthorRemoteAutocompleteCachedAuthorChip, 'author'],
  ['the chips of author conflicts', AuthorRemoteAutocompleteCachedAuthorChipConflicts, 'author'],
  ['the chips of keywords', KeywordRemoteAutocompleteCachedKeywordChip, 'keyword'],
])('%s', (_name, component, kind) => {
  const cache = () => (kind === 'author' ? useDamCachedAuthors().cachedAuthors : useDamCachedKeywords().cachedKeywords)
  const addManual = (id: string) =>
    kind === 'author'
      ? useDamCachedAuthors().addManualToCachedAuthors(author(id, `Known ${id}`))
      : useDamCachedKeywords().addManualToCachedKeywords(keyword(id, `Known ${id}`))
  const added = (added: string[]) => {
    if (kind === 'author') {
      useDamCachedAuthors().addToCachedAuthors(added)
      useDamCachedAuthors().fetchCachedAuthors()
    } else {
      useDamCachedKeywords().addToCachedKeywords(added)
      useDamCachedKeywords().fetchCachedKeywords()
    }
  }
  const askedFor = () =>
    damNameLookups(dam).flatMap((request) => {
      const match = request.url.match(DAM_NAMES)!
      return match[1] === kind ? (new URLSearchParams(match[3]).get('id') ?? '').split(',') : []
    })
  const mountChips = async (shown: string[]) => {
    chips = mount(
      defineComponent({
        setup: () => () =>
          h(
            'div',
            shown.map((id) => h(component, { id, key: id }))
          ),
      }),
      {
        attachTo: document.body,
      }
    )
    await flushPromises()
  }
  const spinning = () => chips!.findAll('.v-progress-circular').length

  // The names on screen are the oldest in a full cache. Each one dropped for a new id was asked for again,
  // and that ask dropped the next shown one, so every chip spun and was read again.
  it('keeps every name it shows when new ids come into a full cache: names nobody shows give way', async () => {
    const shown = ids('shown', 600)
    const others = ids('other', 400)
    shown.forEach(addManual)
    others.forEach(addManual)
    await mountChips(shown)
    expect(cache().value.size).toBe(1000)

    added(ids('new', 50))
    await damNamesAsked()
    await flushPromises()

    expect(spinning()).toBe(0)
    expect(askedFor().filter((id) => id.startsWith('shown-'))).toEqual([])
    expect(shown.every((id) => cache().value.get(id)?._loaded)).toBe(true)
    expect(others.filter((id) => cache().value.has(id))).toHaveLength(350)
    expect(cache().value.size).toBe(1000)
  })

  it('asks for a name its page never added, once, and shows it', async () => {
    await mountChips(['never-added'])
    await damNamesAsked()
    await flushPromises()

    expect(askedFor()).toEqual(['never-added'])
    expect(chips!.text()).toContain('Name of never-added')
  })

  it('asks for nothing while the cache has the name', async () => {
    addManual('shown')
    await mountChips(['shown'])
    await damNamesAsked()

    expect(chips!.text()).toContain('Known shown')
    expect(damNameLookups(dam)).toEqual([])
  })
})

describe('the cache of the names of authors, with more names shown than it keeps', () => {
  it('keeps them all while they are shown, and goes back within its limit once they are not', async () => {
    const { cachedAuthors, addManualToCachedAuthors } = useDamCachedAuthors()
    const shown = ids('shown', 1001)
    shown.slice(0, 1000).forEach((id) => addManualToCachedAuthors(author(id, `Known ${id}`)))
    chips = mount(
      defineComponent({
        setup: () => () =>
          h(
            'div',
            shown.map((id) => h(AuthorRemoteAutocompleteCachedAuthorChip, { id, key: id }))
          ),
      }),
      { attachTo: document.body }
    )
    await flushPromises()
    await damNamesAsked()
    await flushPromises()

    expect(damNameLookups(dam).map((request) => new URLSearchParams(request.url.split('?')[1]).get('id'))).toEqual([
      'shown-1000',
    ])
    expect(cachedAuthors.value.size).toBe(1001)
    expect(chips.findAll('.v-progress-circular')).toHaveLength(0)

    chips.unmount()
    chips = undefined

    expect(cachedAuthors.value.size).toBe(1000)
  })
})

// Ids on their way cannot be dropped, so the cache returned within its limit only with the next batch.
// A failed batch left all of them unresolved and over the limit.
describe('the cache of the names of authors, asked for more ids than it keeps', () => {
  it.each<[string, boolean]>([
    ['the DAM names them', false],
    ['the DAM refuses their names', true],
  ])('is back within its limit once the read is settled, when %s', async (_how, refused) => {
    if (refused) dam.reply((request) => (DAM_NAMES.test(request.url) ? { status: 500 } : undefined))
    const { cachedAuthors, addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
    addToCachedAuthors(ids('added', 1100))
    expect(cachedAuthors.value.size).toBe(1100)

    fetchCachedAuthors()
    await damNamesAsked()
    await flushPromises()

    expect(cachedAuthors.value.size).toBe(1000)
  })
})
