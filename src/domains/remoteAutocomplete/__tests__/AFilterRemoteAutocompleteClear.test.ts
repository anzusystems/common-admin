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
  }: { fallback?: number | number[] | null; closableChips?: boolean } = {}
) => {
  const fields = [{ name, default: fallback, variant: 'custom' }] as const
  const outer = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'clear' })
  ;(outer.filterData as Record<string, unknown>)[name] = value
  const innerFields = [{ name: 'name' as const, default: '' }]
  const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
  const selected = new Map<string, unknown>()
  /** The search each request for the list was asked with. */
  const searches: string[] = []
  const fetchItems = vi.fn(async () => {
    searches.push(String(inner.filterData.name))
    return []
  })
  /** The values each read of items by their ids was asked for. */
  const byIds: Array<Array<string | number>> = []
  wrapper = mount(AFilterRemoteAutocomplete, {
    attachTo: document.body,
    props: {
      name,
      filterByField: 'name',
      fetchItems,
      fetchItemsByIds: async (ids: Array<string | number>) => {
        byIds.push(ids)
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
  return { filterData: outer.filterData as Record<string, unknown>, selected, searches, byIds }
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
})
