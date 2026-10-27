import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'

// Clearing the form autocomplete empties its value and asks for the list again for an
// empty search, once, under the search counter, which takes only the newest answer.
// It used to ask with the previous search outside the counter and write that answer whenever it came.
// A field without focus also read the length of the `null` search
// Vuetify empties it with first, and threw into the app error handler.

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: false }) }),
}))

const escaped: unknown[] = []

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

/**
 * Waits past the search debounce so that a request it would start is counted too.
 */
const settled = async () => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  await flushPromises()
}

const mountField = async (value: number | number[], { held = false } = {}) => {
  const innerFields = [{ name: 'name' as const, default: '' }]
  const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
  const searches: string[] = []
  /**
   * Once `holdByIds` is called, the reads of items by their ids wait: `byIdAnswers[n]()` lets one answer.
   */
  let holdingByIds = false
  const byIdAnswers: Array<() => void> = []
  const heldById = () => (holdingByIds ? new Promise<void>((resolve) => byIdAnswers.push(resolve)) : undefined)
  const answers: Array<(items: []) => void> = []
  const fetchItems = vi.fn(async () => {
    searches.push(String(inner.filterData.name))
    return held ? new Promise<[]>((resolve) => answers.push(resolve)) : []
  })
  const models: unknown[] = []
  wrapper = mount(AFormRemoteAutocomplete, {
    attachTo: document.body,
    props: {
      modelValue: value,
      multiple: Array.isArray(value),
      clearable: true,
      filterByField: 'name',
      fetchItems,
      fetchItemsByIds: async (ids: Array<string | number>) => {
        await heldById()
        return ids.map((id) => ({ value: id, title: `Group ${id}` }))
      },
      'onUpdate:modelValue': (model: unknown) => {
        models.push(model)
        void wrapper!.setProps({ modelValue: model })
      },
    },
    global: {
      config: { errorHandler: (error: unknown) => void escaped.push(error) },
      provide: {
        [FilterInnerDataKey as symbol]: inner.filterData,
        [FilterInnerConfigKey as symbol]: inner.filterConfig,
        [SystemScopeKey as symbol]: 'sys',
        [SubjectScopeKey as symbol]: 'subject',
      },
    },
  })
  await vi.waitFor(() => expect(wrapper!.text()).toContain('Group 3'))
  await settled()
  inner.filterData.name = 'grou'
  return { searches, answers, models, byIdAnswers, holdByIds: () => (holdingByIds = true) }
}

describe('the clear of AFormRemoteAutocomplete', () => {
  it.each([
    ['one value', 3, null],
    ['several values', [3, 5], []],
  ])(
    'asks for the list once, for an empty search, when its %s is cleared, and empties it',
    async (_what, value, empty) => {
      const { searches, models } = await mountField(value)
      const before = searches.length

      await userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)
      await settled()

      expect(searches.slice(before)).toEqual([''])
      expect(models.at(-1)).toEqual(empty)
    }
  )

  it('empties a value cleared while its field has no focus, with no error', async () => {
    const { models } = await mountField(3)
    escaped.length = 0
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined)

    wrapper!.find('.v-field__clearable .v-icon').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settled()
    focus.mockRestore()

    expect(escaped).toEqual([])
    expect(models.at(-1)).toBeNull()
  })

  // With two searches in flight, the answer of the older one hid the spinner while the newer one still ran.
  it('keeps its spinner on until the answer of the latest search', async () => {
    const { answers } = await mountField([3, 5], { held: true })
    const autocomplete = wrapper!.findComponent({ name: 'VAutocomplete' })
    autocomplete.vm.$emit('update:search', 'gr')
    await settled()
    autocomplete.vm.$emit('update:search', 'gro')
    await settled()
    expect(answers).toHaveLength(2)

    answers[0]!([])
    await flushPromises()
    expect(autocomplete.props('loading')).toBe(true)
    answers[1]!([])
    await flushPromises()
    expect(autocomplete.props('loading')).toBe(false)
  })

  // With a search and a read by ids in flight, the spinner stays on until the last one ends.
  // Each used to turn it off when it ended.
  it.each<[string, boolean]>([
    ['a read by ids that ends while a search runs', true],
    ['a search that ends while a read by ids runs', false],
  ])('keeps its spinner on till its last request ends: %s', async (_what, idsFirst) => {
    const mounted = await mountField([3, 5], { held: true })
    mounted.holdByIds()
    const autocomplete = wrapper!.findComponent({ name: 'VAutocomplete' })
    autocomplete.vm.$emit('update:search', 'gr')
    await settled()
    await wrapper!.setProps({ modelValue: [7] })
    await vi.waitFor(() => expect(mounted.byIdAnswers).toHaveLength(1))
    expect(mounted.answers).toHaveLength(1)

    if (idsFirst) mounted.byIdAnswers[0]!()
    else mounted.answers[0]!([])
    await flushPromises()
    expect(autocomplete.props('loading')).toBe(true)
    if (idsFirst) mounted.answers[0]!([])
    else mounted.byIdAnswers[0]!()
    await flushPromises()
    expect(autocomplete.props('loading')).toBe(false)
  })
})
