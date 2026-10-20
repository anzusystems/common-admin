import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'

// The clear of the field empties the filter, and the list is asked for again, for an empty search: once, by the
// watcher of the filter, which takes only its newest answer. The clear asked again itself, with the search typed
// before, and wrote that answer whenever it came; a filter of several values was asked a third time.

/** What the component let escape: errors of its handlers (`errorHandler` of the app) and rejections. */
const escaped: unknown[] = []
const onRejection = (event: PromiseRejectionEvent) => {
  escaped.push(event.reason)
  event.preventDefault()
}

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  window.removeEventListener('unhandledrejection', onRejection)
})

/** Past the debounce of the search, so that a request it would start is counted too. */
const settled = async () => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  await flushPromises()
}

const mountFilter = async (
  name: string,
  value: number | number[],
  {
    fallback = Array.isArray(value) ? [] : null,
    closableChips = false,
    held = false,
  }: { fallback?: number | number[] | null; closableChips?: boolean; held?: boolean } = {}
) => {
  const fields = [{ name, default: fallback, variant: 'custom' }] as const
  const outer = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'clear' })
  ;(outer.filterData as Record<string, unknown>)[name] = value
  const innerFields = [{ name: 'name' as const, default: '' }]
  const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
  const selected = new Map<string, unknown>()
  /** The search each request for the list was asked with. */
  const searches: string[] = []
  /** With `held`: the answers of the requests for the list, given by the test. */
  const answers: Array<(items: []) => void> = []
  const fetchItems = vi.fn(async () => {
    searches.push(String(inner.filterData.name))
    return held ? new Promise<[]>((resolve) => answers.push(resolve)) : []
  })
  /** The values each read of items by their ids was asked for. */
  const byIds: Array<Array<string | number>> = []
  /** Once `holdByIds` is called, the reads of items by their ids wait: `byIdAnswers[n]()` lets one answer. */
  let holdingByIds = false
  const byIdAnswers: Array<() => void> = []
  const heldById = () => (holdingByIds ? new Promise<void>((resolve) => byIdAnswers.push(resolve)) : undefined)
  wrapper = mount(AFilterRemoteAutocomplete, {
    attachTo: document.body,
    props: {
      name,
      filterByField: 'name',
      fetchItems,
      fetchItemsByIds: async (ids: Array<string | number>) => {
        byIds.push(ids)
        await heldById()
        return ids.map((id) => ({ value: id, title: `Group ${id}` }))
      },
      closableChips,
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
  // What the user searched for before picking.
  inner.filterData.name = 'grou'
  return {
    filterData: outer.filterData as Record<string, unknown>,
    selected,
    searches,
    byIds,
    answers,
    byIdAnswers,
    holdByIds: () => (holdingByIds = true),
  }
}

describe('the clear of AFilterRemoteAutocomplete', () => {
  it.each([
    ['one value', 'group', 3, null],
    ['several values', 'groups', [3, 5], []],
  ])(
    'asks for the list once, for an empty search, when a filter of %s is cleared, and empties it',
    async (_what, name, value, empty) => {
      const { filterData, selected, searches, byIds } = await mountFilter(name, value)
      const before = searches.length
      const byIdsBefore = byIds.length

      await userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)
      await settled()

      expect(searches.slice(before)).toEqual([''])
      expect(byIds.slice(byIdsBefore)).toEqual([])
      expect(filterData[name]).toEqual(empty)
      expect(selected.has(name)).toBe(false)
    }
  )

  // Vuetify empties the search with `null` first. A field that has no focus at that moment (a window without it, a
  // click the script makes) read the length of `null`: the clear threw, into the error handler of the app.
  it('empties a filter of one value cleared while its field has no focus, with no error', async () => {
    const { filterData, selected } = await mountFilter('group', 3)
    escaped.length = 0
    window.addEventListener('unhandledrejection', onRejection)
    const focus = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined)

    wrapper!.find('.v-field__clearable .v-icon').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await settled()
    focus.mockRestore()

    expect(escaped).toEqual([])
    expect(filterData.group).toBeNull()
    expect(selected.has('group')).toBe(false)
  })

  // Cleared onto a default it already holds, the filter does not change, and its watcher does nothing: the field and the
  // chips went empty while the filter went on filtering by that value. Its item is put back, as before the clear.
  it.each<[string, () => Promise<void>]>([
    ['the clear of the field', () => userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)],
    ['the close of its chip', async () => wrapper!.find<HTMLButtonElement>('.v-chip__close').element.click()],
  ])('shows a filter of one value cleared onto the default it holds with that value: %s', async (_how, clear) => {
    const { filterData, selected, byIds } = await mountFilter('group', 3, { fallback: 3, closableChips: true })
    const byIdsBefore = byIds.length

    await clear()
    await settled()

    expect(filterData.group).toBe(3)
    expect(selected.get('group')).toEqual([{ title: 'Group 3', value: 3 }])
    expect(wrapper!.text()).toContain('Group 3')
    expect(byIds.slice(byIdsBefore)).toEqual([[3]])
  })

  // A clear that ends on a value (the default of the filter) shows that value, read by its id, and the list of offers
  // for an empty search: the list stayed as the search before left it.
  it.each<[string, string, number | number[], number | number[]]>([
    ['several values, onto a default of its own', 'groups', [3, 5], [1]],
    ['one value, onto a default other than its value', 'group', 3, 5],
    ['one value, onto the default it holds', 'group', 3, 3],
  ])(
    'asks for the list once, for an empty search, when a filter of %s is cleared',
    async (_what, name, value, fallback) => {
      const { filterData, selected, searches, byIds } = await mountFilter(name, value, { fallback })
      const before = searches.length
      const byIdsBefore = byIds.length

      await userEvent.click(wrapper!.find('.v-field__clearable .v-icon').element)
      await settled()

      expect(searches.slice(before)).toEqual([''])
      expect(filterData[name]).toEqual(fallback)
      const shown = Array.isArray(fallback) ? fallback : [fallback]
      expect(selected.get(name)).toEqual(shown.map((id) => ({ title: `Group ${id}`, value: id })))
      expect(byIds.slice(byIdsBefore)).toEqual([shown])
    }
  )

  // Two searches on their way: the answer of the older one hid the spinner while the newer one still ran.
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

  // Two requests on their way, a search and a read of items by their ids: the spinner stays on till the last of them
  // ends. Each turned it off as it ended.
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
