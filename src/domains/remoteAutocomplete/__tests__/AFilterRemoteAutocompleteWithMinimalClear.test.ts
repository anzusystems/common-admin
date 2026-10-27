import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import AFilterRemoteAutocompleteWithMinimal from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocompleteWithMinimal.vue'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'

// Clearing the minimal-items filter autocomplete empties the filter and asks for the list again
// for an empty search, once, under the search counter, which takes only the newest answer.
// It used to ask with the previous search outside the counter, write
// that answer whenever it came, and empty the filter only after it.
// A field without focus also read the length of the `null` search
// Vuetify empties it with first, and threw into the error handler.

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

const item = (id: string | number) => ({ value: id, title: `Group ${id}`, raw: { id, name: `Group ${id}` } })

const mountFilter = async (
  name: string,
  value: number | number[],
  {
    fallback = Array.isArray(value) ? [] : null,
    held = false,
  }: { fallback?: number | number[] | null; held?: boolean } = {}
) => {
  const fields = [{ name, default: fallback, variant: 'custom' }] as const
  const outer = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'minimal' })
  ;(outer.filterData as Record<string, unknown>)[name] = value
  const innerFields = [{ name: 'name' as const, default: '' }]
  const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
  const selected = new Map<string, unknown>()
  const searches: string[] = []
  /**
   * Once `holdByIds` is called, the reads of items by their ids wait: `byIdAnswers[n]()` lets one answer.
   */
  let holdingByIds = false
  const byIdAnswers: Array<() => void> = []
  const heldById = () => (holdingByIds ? new Promise<void>((resolve) => byIdAnswers.push(resolve)) : undefined)
  const answers: Array<(items: unknown[]) => void> = []
  const fetchItemsMinimal = vi.fn(async () => {
    searches.push(String(inner.filterData.name))
    return held ? new Promise<unknown[]>((resolve) => answers.push(resolve)) : []
  })
  wrapper = mount(AFilterRemoteAutocompleteWithMinimal, {
    attachTo: document.body,
    props: {
      name,
      filterByField: 'name',
      fetchItemsMinimal,
      fetchItemsMinimalByIds: async (ids: Array<string | number>) => {
        await heldById()
        return ids.map(item)
      },
    },
    global: {
      config: { errorHandler: (error: unknown) => void escaped.push(error) },
      provide: {
        [FilterSubmitResetCounterKey as symbol]: ref(0),
        [FilterSelectedKey as symbol]: ref(selected),
        [FilterConfigKey as symbol]: outer.filterConfig,
        [FilterDataKey as symbol]: outer.filterData,
        [FilterInnerConfigKey as symbol]: inner.filterConfig,
        [FilterInnerDataKey as symbol]: inner.filterData,
      },
    },
  })
  await vi.waitFor(() => expect(selected.has(name)).toBe(true))
  await settled()
  inner.filterData.name = 'grou'
  return {
    filterData: outer.filterData as Record<string, unknown>,
    selected,
    searches,
    answers,
    byIdAnswers,
    holdByIds: () => (holdingByIds = true),
  }
}

describe('the clear of AFilterRemoteAutocompleteWithMinimal', () => {
  it.each([
    ['one value', 'group', 3, null],
    ['several values', 'groups', [3, 5], []],
  ])(
    'asks for the list once, for an empty search, when a filter of %s is cleared, and empties it',
    async (_what, name, value, empty) => {
      const { filterData, selected, searches } = await mountFilter(name, value)
      const before = searches.length

      await userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)
      await settled()

      expect(searches.slice(before)).toEqual([''])
      expect(filterData[name]).toEqual(empty)
      expect(selected.has(name)).toBe(false)
    }
  )

  // Emptied at once, the filter would not change for its watcher, so the default is put back into the field as before.
  it('shows a filter of one value cleared onto the default it holds with that value', async () => {
    const { filterData, selected, searches } = await mountFilter('group', 3, { fallback: 3 })
    const before = searches.length

    await userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)
    await settled()

    expect(filterData.group).toBe(3)
    expect(selected.get('group')).toEqual([{ title: 'Group 3', value: 3 }])
    expect(searches.slice(before)).toEqual([''])
  })

  it('empties a filter of one value cleared while its field has no focus, with no error', async () => {
    const { filterData } = await mountFilter('group', 3)
    escaped.length = 0
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined)

    wrapper!.find('.v-field__clearable .v-icon').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settled()
    focus.mockRestore()

    expect(escaped).toEqual([])
    expect(filterData.group).toBeNull()
  })

  // With two searches in flight, the answer of the older one hid the spinner while the newer one still ran.
  it('keeps its spinner on until the answer of the latest search', async () => {
    const { answers } = await mountFilter('groups', [3, 5], { held: true })
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
    const mounted = await mountFilter('groups', [3, 5], { held: true })
    mounted.holdByIds()
    const autocomplete = wrapper!.findComponent({ name: 'VAutocomplete' })
    autocomplete.vm.$emit('update:search', 'gr')
    await settled()
    mounted.filterData.groups = [7]
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
