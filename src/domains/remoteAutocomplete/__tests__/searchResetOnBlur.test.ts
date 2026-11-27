import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
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
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'

// Vuetify empties the search of a field that loses its focus. A field of one value kept its own copy of the search,
// and the list fetched for it: one that matched nothing then opened with no options and an empty input.

vi.mock('@/domains/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({ collabOptions: ref({ enabled: false }) }),
}))

const TITLES = ['Alpha', 'Beta', 'Gamma']

let wrapper: VueWrapper | undefined
let outside: HTMLButtonElement | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  outside?.remove()
  outside = undefined
  document.querySelectorAll('.v-overlay-container').forEach((node) => node.remove())
})

const settled = async () => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  await flushPromises()
}

const innerFilter = () => {
  const fields = [{ name: 'name' as const, default: '' }]
  return createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'inner' })
}

const matching = (query: unknown) =>
  TITLES.map((title, index) => ({ id: index + 1, title })).filter(({ title }) =>
    title.toLowerCase().includes(String(query ?? '').toLowerCase())
  )

const outerFilter = (name: string, multiple: boolean) => {
  const fields = [{ name, default: multiple ? [] : null, variant: 'custom' }] as const
  return createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'searchReset' })
}

const filterProvide = (outer: ReturnType<typeof outerFilter>, inner: ReturnType<typeof innerFilter>) => ({
  [FilterSubmitResetCounterKey as symbol]: ref(0),
  [FilterSelectedKey as symbol]: ref(new Map()),
  [FilterConfigKey as symbol]: outer.filterConfig,
  [FilterDataKey as symbol]: outer.filterData,
  [FilterInnerConfigKey as symbol]: inner.filterConfig,
  [FilterInnerDataKey as symbol]: inner.filterData,
})

const mountForm = (multiple: boolean, prefetch: 'focus' | false = 'focus') => {
  const inner = innerFilter()
  wrapper = mount(AFormRemoteAutocomplete, {
    attachTo: document.body,
    props: {
      modelValue: multiple ? [] : null,
      multiple,
      prefetch,
      filterByField: 'name',
      fetchItems: async () => matching(inner.filterData.name).map(({ id, title }) => ({ value: id, title })),
      fetchItemsByIds: async (ids: Array<string | number>) => ids.map((id) => ({ value: id, title: TITLES[+id - 1]! })),
      'onUpdate:modelValue': (model: unknown) => void wrapper!.setProps({ modelValue: model }),
    },
    global: {
      provide: {
        [FilterInnerDataKey as symbol]: inner.filterData,
        [FilterInnerConfigKey as symbol]: inner.filterConfig,
        [SystemScopeKey as symbol]: 'sys',
        [SubjectScopeKey as symbol]: 'subject',
      },
    },
  })
}

const mountFilter = (multiple: boolean) => {
  const inner = innerFilter()
  wrapper = mount(AFilterRemoteAutocomplete, {
    attachTo: document.body,
    props: {
      name: 'group',
      prefetch: 'focus',
      filterByField: 'name',
      fetchItems: async () => matching(inner.filterData.name).map(({ id, title }) => ({ value: id, title })),
      fetchItemsByIds: async (ids: Array<string | number>) => ids.map((id) => ({ value: id, title: TITLES[+id - 1]! })),
    },
    global: { provide: filterProvide(outerFilter('group', multiple), inner) },
  })
}

const mountMinimalFilter = (multiple: boolean) => {
  const inner = innerFilter()
  wrapper = mount(AFilterRemoteAutocompleteWithMinimal, {
    attachTo: document.body,
    props: {
      name: 'group',
      prefetch: 'focus',
      filterByField: 'name',
      fetchItemsMinimal: async () => matching(inner.filterData.name).map(({ id, title }) => ({ id, name: title })),
      fetchItemsMinimalByIds: async (ids: Array<string | number>) => ids.map((id) => ({ id, name: TITLES[+id - 1]! })),
    },
    global: { provide: filterProvide(outerFilter('group', multiple), inner) },
  })
}

const input = () => wrapper!.find('input:not([type="hidden"])').element as HTMLInputElement

// Sorted: a picked option is listed first.
const options = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.v-overlay--active .v-list-item[role="option"]'))
    .map((item) => item.querySelector('.v-list-item-title')?.textContent?.trim() ?? '')
    .sort()

// Vuetify's field overlay takes a click at the input's centre, so the field is clicked.
const openField = async () => {
  await userEvent.click(wrapper!.find('.v-field').element as HTMLElement)
  await settled()
}

const clickOutside = async () => {
  outside = document.body.appendChild(document.createElement('button'))
  outside.textContent = 'outside'
  outside.style.cssText = 'position: fixed; right: 0; bottom: 0; z-index: 10000'
  await userEvent.click(outside)
  await settled()
}

describe.each([
  ['AFormRemoteAutocomplete', mountForm],
  ['AFilterRemoteAutocomplete', mountFilter],
  ['AFilterRemoteAutocompleteWithMinimal', mountMinimalFilter],
])('a search left by %s', (_name, mountField) => {
  it.each([
    ['one value', false],
    ['several values', true],
  ])(
    'of a field of %s is emptied with its input, and the field opens with every option again',
    async (_what, multiple) => {
      mountField(multiple)
      await openField()
      expect(options()).toEqual(TITLES)

      await userEvent.keyboard('zzz')
      await settled()
      expect(input().value, 'the text typed stays while the menu is open').toBe('zzz')
      expect(options()).toEqual([])

      await clickOutside()
      await openField()

      expect(input().value).toBe('')
      expect(options()).toEqual(TITLES)
    }
  )

  it('keeps a value picked from the options its search offered, and offers every option again', async () => {
    mountField(false)
    await openField()
    await userEvent.keyboard('bet')
    await settled()
    expect(options()).toEqual(['Beta'])

    document.querySelector<HTMLElement>('.v-overlay--active .v-list-item')!.click()
    await settled()
    await clickOutside()
    await openField()

    expect(wrapper!.find('.v-field').text()).toContain('Beta')
    expect(options()).toEqual(TITLES)
  })
})

describe('a search left by AFormRemoteAutocomplete without a prefetch', () => {
  it('drops the options it fetched, as a field not yet searched has none', async () => {
    mountForm(false, false)
    await openField()
    await userEvent.keyboard('alp')
    await settled()
    expect(options()).toEqual(['Alpha'])

    await clickOutside()
    await openField()

    expect(input().value).toBe('')
    expect(options()).toEqual([])
  })
})
