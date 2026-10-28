import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h } from 'vue'
import type { CommonAdminCoreDamConfig } from '@/AnzuSystemsCommonAdmin'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorCreateButton from '@/domains/dam/author/components/AuthorCreateButton.vue'
import AuthorRemoteAutocompleteCachedAuthorChip from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import KeywordRemoteAutocompleteCachedKeywordChip from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import type { UploadQueue } from '@/domains/dam/types/UploadQueue'
import { UploadQueueSuggestionsKey } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const { extSystem } = cmsConfiguration
const QUEUE = 'name-inputs'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

const Input = defineComponent({
  name: 'NameInputStandIn',
  emits: ['update:search'],
  setup(_, { slots }) {
    return () => h('div', { class: 'name-input' }, slots['append-item']?.())
  },
})

const configure = (own: Partial<CommonAdminCoreDamConfig> = {}) => {
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({ ...coreDam, configs: { default: { ...coreDam.configs.default!, ...own } } })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(cmsConfiguration.endPoints)
  dam.reply((request) => {
    if (!/\/(author|keyword)(\/|$)/.test(request.url.split('?')[0]!)) return undefined
    const sent = request.method === 'POST' ? JSON.parse(request.data as string) : undefined
    if (sent) return { status: 201, data: { id: 'created', ...sent } }
    return { status: 200, data: { data: [], totalCount: 0 } }
  })
  waits = holdLongWaits()
  configure()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  waits.restore()
  signOutOfDam()
})

const inputs: Array<[string, Component, Component, string]> = [
  ['keywords', KeywordRemoteAutocompleteWithCached, KeywordRemoteAutocompleteCachedKeywordChip, 'keyword-1'],
  ['authors', AuthorRemoteAutocompleteWithCached, AuthorRemoteAutocompleteCachedAuthorChip, 'author-1'],
]

const mountInput = async (input: Component, props: Record<string, unknown>) => {
  wrapper = mount(input, {
    attachTo: document.body,
    props: { extSystem, multiple: true, ...props },
    global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: Input } },
  })
  await flushPromises()
  return wrapper
}

describe.each(inputs)('the input of %s', (_which, input, chip, id) => {
  describe('while disabled', () => {
    it('shows the chips of its names, by default', async () => {
      await mountInput(input, { modelValue: [id], disabled: true })

      expect(wrapper!.findComponent(Input).exists()).toBe(false)
      expect(wrapper!.findAllComponents(chip)).toHaveLength(1)
    })

    it('shows the input switched off, when disabled as an input', async () => {
      await mountInput(input, { modelValue: [id], disabled: true, disabledAs: 'input' })

      expect(wrapper!.findComponent(Input).attributes()).toHaveProperty('disabled')
      expect(wrapper!.findAllComponents(chip)).toEqual([])
    })
  })

  it('hands the input no "disabled" of its own while it can be edited, also as an input', async () => {
    await mountInput(input, { modelValue: [id], disabled: false, disabledAs: 'input' })

    expect(wrapper!.findComponent(Input).vm.$attrs.disabled).toBeUndefined()
  })
})

describe('the "+" button of the input of authors', () => {
  it('is hidden while the input is disabled, by default', async () => {
    await mountInput(AuthorRemoteAutocompleteWithCached, { modelValue: [], disabled: true })

    expect(wrapper!.findComponent(AuthorCreateButton).isVisible()).toBe(false)
  })

  it('stays, switched off, while the input is disabled as an input', async () => {
    await mountInput(AuthorRemoteAutocompleteWithCached, { modelValue: [], disabled: true, disabledAs: 'input' })

    const button = wrapper!.findComponent(AuthorCreateButton)
    expect(button.isVisible()).toBe(true)
    expect(button.find('button').element.disabled).toBe(true)
  })
})

describe('creating a keyword under a grant the configuration names', () => {
  const typed = async () => {
    await mountInput(KeywordRemoteAutocompleteWithCached, { modelValue: [] })
    wrapper!.findComponent(Input).vm.$emit('update:search', 'new keyword')
    await flushPromises()
  }
  const entered = async (key: string) => {
    await wrapper!.find('.name-input').trigger('keyup', { key })
    await flushPromises()
  }
  const created = () => dam.sentTo('POST', /\/keyword$/)

  beforeEach(() => configure({ keywordCreateAcl: 'dam_keyword_create' }))

  it('is not offered, and nothing is created by Enter or a comma, to a user without the grant', async () => {
    signInToDam(extSystem, ['dam_keyword_read'])

    await typed()
    expect(wrapper!.find('.a-keywords-append-item').exists()).toBe(false)
    await entered('Enter')
    await entered(',')

    expect(created()).toEqual([])
    expect(wrapper!.emitted('update:modelValue')).toBeUndefined()
  })

  it.each(['Enter', ','])('is offered, and %s creates the keyword, to a user with the grant', async (key) => {
    signInToDam(extSystem, ['dam_keyword_create'])

    await typed()
    expect(wrapper!.find('.a-keywords-append-item').exists()).toBe(true)
    await entered(key)

    await vi.waitFor(() => expect(created()).toHaveLength(1))
    expect(dam.body(created()[0]!)).toMatchObject({ name: 'new keyword', extSystem })
  })
})

describe('creating an author under a grant the configuration names', () => {
  const typedAndEntered = async () => {
    await mountInput(AuthorRemoteAutocompleteWithCached, { modelValue: [] })
    wrapper!.findComponent(Input).vm.$emit('update:search', 'New Author')
    await flushPromises()
    await wrapper!.find('.name-input').trigger('keyup', { key: 'Enter' })
    await flushPromises()
  }
  const createPanel = () => document.body.querySelector('[data-cy="create-panel"]')

  beforeEach(() => configure({ authorCreateAcl: 'dam_author_create' }))

  it('is not offered to a user without the grant: no "+" button, no "+ name", and Enter opens nothing', async () => {
    signInToDam(extSystem, ['dam_author_read'])

    await typedAndEntered()

    expect(wrapper!.findComponent(AuthorCreateButton).exists()).toBe(false)
    expect(wrapper!.find('.a-authors-append-item').exists()).toBe(false)
    expect(createPanel()).toBeNull()
  })

  it('is offered to a user with the grant: Enter opens the new author with the name typed', async () => {
    signInToDam(extSystem, ['dam_author_create'])

    await typedAndEntered()

    expect(wrapper!.findComponent(AuthorCreateButton).exists()).toBe(true)
    expect(wrapper!.find('.a-authors-append-item').exists()).toBe(true)
    await vi.waitFor(() => expect(createPanel()).not.toBeNull())
    const name = createPanel()!.querySelector<HTMLInputElement>(
      '[data-cy="author-name"] input, input[data-cy="author-name"]'
    )
    expect(name!.value).toBe('New Author')
  })
})

describe.each([
  ['keyword', KeywordRemoteAutocompleteCachedKeywordChip, 'newKeywordNames' as const],
  ['author', AuthorRemoteAutocompleteCachedAuthorChip, 'newAuthorNames' as const],
])('the %s chip of a row', (which, chip, list) => {
  beforeEach(() => {
    if (which === 'keyword') {
      useDamCachedKeywords().addManualMinimalToCachedKeywords({ id: 'name-1', name: 'fresh' })
    } else {
      useDamCachedAuthors().addManualMinimalToCachedAuthors({
        id: 'name-1',
        name: 'fresh',
        identifier: '',
        reviewed: false,
      })
    }
  })
  const mountChip = async (provided?: (queueKey: string) => UploadQueue['suggestions'] | undefined) => {
    wrapper = mount(chip, {
      attachTo: document.body,
      props: { id: 'name-1', queueId: QUEUE },
      global: { plugins: [pinia], provide: provided ? { [UploadQueueSuggestionsKey as symbol]: provided } : {} },
    })
    await flushPromises()
    return wrapper
  }
  const isMarkedNew = () => wrapper!.find('.v-chip .mdi-new-box').exists()
  const suggesting = (names: string[]) => {
    const suggestions = { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() }
    names.forEach((name) => suggestions[list].add(name))
    return suggestions
  }

  const newInTheLibrary = () => {
    useUploadQueuesStore(pinia).forceReloadFileInput(QUEUE)
    useUploadQueuesStore(pinia).getQueue(QUEUE)!.suggestions[list].add('fresh')
  }

  it('is marked new as the queue of the library says, by default', async () => {
    newInTheLibrary()

    await mountChip()

    expect(isMarkedNew()).toBe(true)
  })

  it('is marked new as the suggestions the application provides say, and never asks for the store of the library', async () => {
    const asked: string[] = []

    await mountChip((queueKey) => (asked.push(queueKey), suggesting(['fresh'])))

    expect(isMarkedNew()).toBe(true)
    expect(asked).toContain(QUEUE)
    expect(pinia.state.value).not.toHaveProperty('commonAdminUploadQueuesStore')
  })

  it('is not marked new where the suggestions the application provides do not name it, whatever the library has', async () => {
    newInTheLibrary()

    await mountChip(() => suggesting(['someone else']))

    expect(isMarkedNew()).toBe(false)
  })
})

describe('the author conflicts under the input of authors', () => {
  beforeEach(() => {
    for (const id of ['author-1', 'author-2']) {
      useDamCachedAuthors().addManualMinimalToCachedAuthors({
        id,
        name: `Name of ${id}`,
        identifier: '',
        reviewed: false,
      })
    }
  })
  const mountWithConflicts = (modelValue: string[]) =>
    mountInput(AuthorRemoteAutocompleteWithCached, {
      modelValue,
      authorConflicts: ['author-1', 'author-2'],
      'onUpdate:modelValue': (authors: string[]) => wrapper!.setProps({ modelValue: authors }),
    })
  const offered = () =>
    wrapper!
      .findAllComponents(AuthorRemoteAutocompleteCachedAuthorChipConflicts)
      .filter((conflict) => conflict.find('.v-chip').exists())
      .map((conflict) => conflict.props('id'))
  const hasHeading = () => wrapper!.text().includes(damText('author.conflicts'))
  const press = async (id: string) => {
    await wrapper!
      .findAllComponents(AuthorRemoteAutocompleteCachedAuthorChipConflicts)
      .find((conflict) => conflict.props('id') === id)!
      .find('.v-chip__close')
      .trigger('click')
    await flushPromises()
  }

  it('does not offer an author the input has already', async () => {
    await mountWithConflicts(['author-2'])

    expect([offered(), hasHeading()]).toEqual([['author-1'], true])
  })

  it('takes the one pressed into the authors and offers it no more, and the heading goes with the last one', async () => {
    await mountWithConflicts([])
    expect([offered(), hasHeading()]).toEqual([['author-1', 'author-2'], true])

    await press('author-1')
    expect(wrapper!.emitted('update:modelValue')!.at(-1)).toEqual([['author-1']])
    expect([offered(), hasHeading()]).toEqual([['author-2'], true])

    await press('author-2')
    expect(wrapper!.emitted('update:modelValue')!.at(-1)).toEqual([['author-1', 'author-2']])
    expect([offered(), hasHeading()]).toEqual([[], false])
  })

  it('offers a conflict again, with its heading, once its author leaves the input', async () => {
    await mountWithConflicts(['author-1', 'author-2'])
    expect([offered(), hasHeading()]).toEqual([[], false])

    await wrapper!.setProps({ modelValue: ['author-2'] })

    expect([offered(), hasHeading()]).toEqual([['author-1'], true])
  })

  it('offers a pressed conflict again once its author leaves the input', async () => {
    await mountWithConflicts([])
    await press('author-1')
    expect([offered(), hasHeading()]).toEqual([['author-2'], true])

    await wrapper!.setProps({ modelValue: [] })

    expect([offered(), hasHeading()]).toEqual([['author-1', 'author-2'], true])
  })
})
