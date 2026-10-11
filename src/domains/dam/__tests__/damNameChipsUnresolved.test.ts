import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { DAM_NAMES, damNameLookups } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import AuthorRemoteAutocompleteCachedAuthorChip from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import KeywordRemoteAutocompleteCachedKeywordChip from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'

// A row of the queue holds the ids of its authors and keywords; the chips read their names from two caches, which
// ask the DAM for them after a pause of their own. An id the DAM does not return (deleted meanwhile, of another
// ext system) has no name: its chip shows the id, as the chips of the other cached records do. The real caches
// over a DAM that knows some of the ids asked for and not the others. The caches are one for the whole file, so
// each case starts them empty; their pause is taken out of real time and let pass by the case.

const KNOWN: Record<string, string> = { 'author-known': 'Jane Roe', 'keyword-known': 'harvest' }
const AUTHORS = ['author-known', 'author-missing']
const KEYWORDS = ['keyword-known', 'keyword-missing']
const UNAVAILABLE = 'The record could not be loaded'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrappers: VueWrapper[] = []

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(cmsConfiguration.endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(DAM_NAMES) : null
    if (!match) return undefined
    const ids = (new URLSearchParams(match[3]).get('id') ?? '').split(',')
    const found = ids
      .filter((id) => id in KNOWN)
      .map((id) => ({ id, name: KNOWN[id], identifier: '', flags: { reviewed: false } }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  // The pause of the caches before they ask (1.5 s, 5 s at most) is held.
  waits = holdLongWaits(1_000)
  for (const forgotten of [
    useDamCachedAuthors().cachedAuthors,
    useDamCachedAuthors().toFetchCachedAuthors,
    useDamCachedKeywords().cachedKeywords,
    useDamCachedKeywords().toFetchCachedKeywords,
  ]) {
    forgotten.value.clear()
  }
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  waits.restore()
  useDamNotificationsEventBus().reset()
})

/** What a row of the queue does with the ids it is given. The DAM is asked once the pause of the caches is over. */
const namesQueued = () => {
  const authors = useDamCachedAuthors()
  const keywords = useDamCachedKeywords()
  authors.addToCachedAuthors(AUTHORS)
  keywords.addToCachedKeywords(KEYWORDS)
  authors.fetchCachedAuthors()
  keywords.fetchCachedKeywords()
}
const stillAsked = () =>
  [...useDamCachedAuthors().cachedAuthors.value.values(), ...useDamCachedKeywords().cachedKeywords.value.values()]
    .filter((item) => !item._loaded && !item._unresolved)
    .map((item) => item.id)
/** The names were asked for, and the DAM has answered: with the two it knows. */
const namesAnswered = async () => {
  namesQueued()
  await waits.elapse()
  await vi.waitFor(() => expect(stillAsked()).toEqual([]))
  expect(damNameLookups(dam)).toHaveLength(2)
}

const mountChip = async (chip: Component, props: Record<string, unknown>) => {
  const wrapper = mount(chip, { attachTo: document.body, props, global: { plugins: [pinia] } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const spins = (wrapper: VueWrapper) => wrapper.find('.v-progress-circular').exists()
const hasTooltip = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'VTooltip' }).exists()
/**
 * The words of the tooltip of a chip, as a pointer over the element it hangs on opens them. The tooltip is drawn
 * from the start: its words count only once it is open, and only those of this chip's own (each chip is an app of
 * its own, so their ids repeat and say nothing).
 */
const tooltipText = async (wrapper: VueWrapper) => {
  const tooltip = wrapper.findComponent({ name: 'VTooltip' })
  tooltip.element.parentElement!.dispatchEvent(new MouseEvent('mouseenter'))
  const opened = () => {
    const content = (tooltip.vm as unknown as { contentEl?: HTMLElement }).contentEl
    return content?.closest('.v-overlay--active') ? content : null
  }
  await vi.waitFor(() => expect(opened()).not.toBeNull())

  return opened()!.textContent!.trim()
}

describe('chips whose names the DAM is still asked for', () => {
  it('wait, and show the id once the DAM has answered without it', async () => {
    const lookups = dam.hold('GET', DAM_NAMES)
    namesQueued()
    const chips = [
      {
        id: 'author-missing',
        chip: await mountChip(AuthorRemoteAutocompleteCachedAuthorChip, { id: 'author-missing' }),
      },
      {
        id: 'keyword-missing',
        chip: await mountChip(KeywordRemoteAutocompleteCachedKeywordChip, { id: 'keyword-missing' }),
      },
      {
        id: 'author-missing',
        chip: await mountChip(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id: 'author-missing' }),
      },
    ]
    const waiting = () => chips.map(({ chip }) => [chip.text(), spins(chip)])

    // Not asked yet, and then asked and not answered yet: a spinner, and no id.
    expect(waiting()).toEqual(chips.map(() => ['', true]))
    await waits.elapse()
    await vi.waitFor(() => expect(lookups.waiting).toHaveLength(2))
    expect(waiting()).toEqual(chips.map(() => ['', true]))

    lookups.release()
    await vi.waitFor(() => expect(chips.map(({ chip }) => chip.text())).toEqual(chips.map(({ id }) => `#${id}`)))

    expect(chips.map(({ chip }) => spins(chip))).toEqual(chips.map(() => false))
    for (const { chip } of chips) expect(await tooltipText(chip)).toBe(UNAVAILABLE)
  })
})

describe('chips whose names the DAM cannot be asked for at all', () => {
  beforeEach(async () => {
    dam.reply((request) => (request.method === 'GET' && DAM_NAMES.test(request.url) ? { status: 500 } : undefined))
    namesQueued()
    await waits.elapse()
    await vi.waitFor(() => expect(stillAsked()).toEqual([]))
    expect(damNameLookups(dam)).toHaveLength(2)
  })

  it.each([
    ['the keyword chip', KeywordRemoteAutocompleteCachedKeywordChip, 'keyword-known'],
    ['the chip of an author conflict', AuthorRemoteAutocompleteCachedAuthorChipConflicts, 'author-known'],
  ])('%s shows the id, and stops spinning, also of one the DAM knows', async (_which, chip, id) => {
    const wrapper = await mountChip(chip, { id })

    expect(wrapper.find('.v-chip').text()).toBe(`#${id}`)
    expect(spins(wrapper)).toBe(false)
  })
})

describe('the keyword chip', () => {
  // The cache asks again for an id it did not get, the next time something needs it.
  it('waits again when the cache asks for the keyword once more, and shows the name it then gets', async () => {
    await namesAnswered()
    const wrapper = await mountChip(KeywordRemoteAutocompleteCachedKeywordChip, { id: 'keyword-missing' })
    expect(wrapper.find('.v-chip').text()).toBe('#keyword-missing')
    KNOWN['keyword-missing'] = 'found keyword'

    try {
      useDamCachedKeywords().addToCachedKeywords(['keyword-missing'])
      useDamCachedKeywords().fetchCachedKeywords()
      await flushPromises()
      expect([wrapper.find('.v-chip').text(), spins(wrapper)]).toEqual(['', true])

      await waits.elapse()
      await vi.waitFor(() => expect(wrapper.find('.v-chip').text()).toBe('found keyword'))
      expect([spins(wrapper), hasTooltip(wrapper)]).toEqual([false, false])
    } finally {
      delete KNOWN['keyword-missing']
    }
  })

  it('shows the title its caller gives it at once, without spinning, and keeps it once the DAM has answered', async () => {
    namesQueued()
    const wrapper = await mountChip(KeywordRemoteAutocompleteCachedKeywordChip, {
      id: 'keyword-known',
      title: 'Given by the caller',
    })
    expect([wrapper.find('.v-chip').text(), spins(wrapper)]).toEqual(['Given by the caller', false])
    expect(damNameLookups(dam)).toEqual([])

    // The DAM is asked, and answers with the name of the keyword.
    await waits.elapse()
    await vi.waitFor(() => expect(stillAsked()).toEqual([]))
    await flushPromises()
    expect(useDamCachedKeywords().cachedKeywords.value.get('keyword-known')?.name).toBe('harvest')

    expect([wrapper.find('.v-chip').text(), spins(wrapper), hasTooltip(wrapper)]).toEqual([
      'Given by the caller',
      false,
      false,
    ])
  })
})

describe.each([
  ['author', AuthorRemoteAutocompleteCachedAuthorChip, 'author-missing', 'author-known'],
  ['keyword', KeywordRemoteAutocompleteCachedKeywordChip, 'keyword-missing', 'keyword-known'],
])('the %s chip', (_which, chip, missing, known) => {
  beforeEach(namesAnswered)

  it('shows the id of one the DAM did not return, and says the record could not be loaded', async () => {
    const wrapper = await mountChip(chip, { id: missing })

    expect(wrapper.find('.v-chip').text()).toBe(`#${missing}`)
    expect(spins(wrapper)).toBe(false)
    expect(hasTooltip(wrapper)).toBe(true)
  })

  it('shows it as text too, with the same words on hover', async () => {
    const wrapper = await mountChip(chip, { id: missing, textOnly: true })

    expect(wrapper.text()).toBe(`#${missing}`)
    expect(spins(wrapper)).toBe(false)
    expect(wrapper.find('[title]').attributes('title')).toBe(UNAVAILABLE)
  })

  it('shows the name of one the DAM returned, as before', async () => {
    const asChip = await mountChip(chip, { id: known })
    expect(asChip.find('.v-chip').text()).toBe(KNOWN[known])
    expect([spins(asChip), hasTooltip(asChip)]).toEqual([false, false])

    const asText = await mountChip(chip, { id: known, textOnly: true })
    expect(asText.text()).toBe(KNOWN[known])
    expect(asText.find('[title]').exists()).toBe(false)
  })

  it('shows the title its caller gives it in place of the id', async () => {
    const wrapper = await mountChip(chip, { id: missing, title: 'Given by the caller' })

    expect(wrapper.find('.v-chip').text()).toBe('Given by the caller')
  })

  // Today's behaviour, pinned as it is: the title is shown, and the record the DAM did not return is still said not
  // to have been loaded. admin-dam's own chips say nothing then (a difference for the owner before I1).
  it('says the record could not be loaded also beside a title its caller gives it', async () => {
    const wrapper = await mountChip(chip, { id: missing, title: 'Given by the caller' })

    expect([wrapper.find('.v-chip').text(), spins(wrapper)]).toEqual(['Given by the caller', false])
    expect(await tooltipText(wrapper)).toBe(UNAVAILABLE)
  })

  it('shows its placeholder when it has no id at all', async () => {
    const wrapper = await mountChip(chip, { id: null })

    expect(wrapper.text()).toBe('-')
  })
})

describe('the chip of an author conflict', () => {
  beforeEach(namesAnswered)

  it('shows the id of an author the DAM did not return, and can still be added', async () => {
    const wrapper = await mountChip(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id: 'author-missing' })

    expect(wrapper.find('.v-chip').text()).toBe('#author-missing')
    expect(spins(wrapper)).toBe(false)
    expect(await tooltipText(wrapper)).toBe(UNAVAILABLE)

    await wrapper.find('.v-chip__close').trigger('click')
    expect(wrapper.emitted('addAuthor')).toEqual([['author-missing']])
  })

  it('shows the name of an author the DAM returned, as before', async () => {
    const wrapper = await mountChip(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id: 'author-known' })

    expect(wrapper.find('.v-chip').text()).toBe('Jane Roe')
    expect([spins(wrapper), hasTooltip(wrapper)]).toEqual([false, false])
  })

  // A user can pick or create the author meanwhile: the name is then put into the cache by hand.
  it('shows the name once the author is known after all', async () => {
    const wrapper = await mountChip(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id: 'author-missing' })
    expect(wrapper.find('.v-chip').text()).toBe('#author-missing')

    useDamCachedAuthors().addManualMinimalToCachedAuthors({
      id: 'author-missing',
      name: 'Late Author',
      identifier: 'agency',
      reviewed: false,
    })
    await flushPromises()

    expect(wrapper.find('.v-chip').text()).toBe('Late Author (agency)')
    expect(hasTooltip(wrapper)).toBe(false)
  })

  // The cache asks again for an id it did not get, the next time something needs it.
  it('waits again when the cache asks for the author once more, and shows the name it then gets', async () => {
    const wrapper = await mountChip(AuthorRemoteAutocompleteCachedAuthorChipConflicts, { id: 'author-missing' })
    expect(wrapper.find('.v-chip').text()).toBe('#author-missing')
    KNOWN['author-missing'] = 'Found Author'

    try {
      useDamCachedAuthors().addToCachedAuthors(['author-missing'])
      useDamCachedAuthors().fetchCachedAuthors()
      await flushPromises()
      expect([wrapper.find('.v-chip').text(), spins(wrapper)]).toEqual(['', true])

      await waits.elapse()
      await vi.waitFor(() => expect(wrapper.find('.v-chip').text()).toBe('Found Author'))
      expect([spins(wrapper), hasTooltip(wrapper)]).toEqual([false, false])
    } finally {
      delete KNOWN['author-missing']
    }
  })
})
