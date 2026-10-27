import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { AxiosInstance } from 'axios'
import { type App, type Component, createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import AAnzuUserRoleAutocomplete from '@/domains/anzuUser/components/AAnzuUserRoleAutocomplete.vue'
import ACachedChip from '@/domains/cached/components/ACachedChip.vue'
import ACurrentUserDropdown from '@/domains/ui/components/ACurrentUserDropdown.vue'
import ADatetimePicker from '@/domains/ui/datetime/components/ADatetimePicker.vue'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { createAnzuVuetify } from '@/plugins/commonVuetifyConfig'

// Controls that a screen reader named wrongly or not at all: the calendar icon of the date picker (a button
// through the activator props of its menu, without a name, which Enter and Space did not press), the menu of the
// current user (named by the avatar initials), and the close of a chip that removes a value (Vuetify's "Close").
// Each is mounted as an admin mounts it, with the library's Vuetify translating through the admin's i18n.

// ACachedChip asks for the router as it is set up.
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), currentRoute: { value: { query: {} } } }),
  useRoute: () => ({ query: {}, params: {} }),
}))

let app: App | undefined
let host: HTMLElement | undefined
afterEach(() => {
  app?.unmount()
  host?.remove()
  app = host = undefined
  document.querySelectorAll('.v-overlay-container').forEach((node) => (node.innerHTML = ''))
})

const mountIn = async (
  locale: string,
  component: Component,
  props: Record<string, unknown> = {},
  provided: Array<[symbol, unknown]> = []
) => {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: false, messages: { sk, en, cs } })
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(component, props)
  provided.forEach(([key, value]) => app!.provide(key, value))
  app.use(i18n).use(createPinia()).use(createAnzuVuetify({ i18n })).mount(host)
  await flushPromises()
  await nextTick()
}

describe('the names of controls of the library', () => {
  it.each([
    ['sk', 'Vybrať dátum'],
    ['en', 'Select date'],
    ['cs', 'Vybrat datum'],
  ] as const)('names the calendar icon of the date picker, a button of its menu, in %s: "%s"', async (locale, name) => {
    await mountIn(locale, ADatetimePicker, { modelValue: null })

    const calendar = host!.querySelector('.a-datetime-picker__calendar-icon')!
    expect(calendar.getAttribute('role')).toBe('button')
    expect(calendar.getAttribute('aria-label')).toBe(name)
  })

  // A button: Enter and Space press it, as a click does. Its menu took only the arrows.
  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])('opens the calendar of the date picker on %s on its icon', async (_name, key) => {
    await mountIn('en', ADatetimePicker, { modelValue: null })
    const calendar = host!.querySelector<HTMLElement>('.a-datetime-picker__calendar-icon')!
    expect(document.querySelector('.v-overlay--active .v-date-picker')).toBeNull()

    calendar.focus()
    calendar.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    await flushPromises()
    await nextTick()

    await vi.waitFor(() => expect(document.querySelector('.v-overlay--active .v-date-picker')).not.toBeNull())
  })

  // Opening the calendar reports the field as left once (`blur`, on which an admin lets go of its lock). The Enter
  // that opened it went on, as its keyup, to the Enter of the field, which reported it again.
  it.each<[string, (calendar: HTMLElement) => Promise<void>]>([
    ['Enter', () => userEvent.keyboard('{Enter}')],
    ['Space', () => userEvent.keyboard(' ')],
    ['a click', (calendar) => userEvent.click(calendar)],
  ])('reports the field left once when %s on the calendar icon opens the calendar', async (_name, press) => {
    const blurs: unknown[] = []
    await mountIn('en', ADatetimePicker, { modelValue: null, onBlur: () => blurs.push('blur') })
    const calendar = host!.querySelector<HTMLElement>('.a-datetime-picker__calendar-icon')!
    calendar.focus()

    await press(calendar)
    await vi.waitFor(() => expect(document.querySelector('.v-overlay--active .v-date-picker')).not.toBeNull())
    await flushPromises()

    expect(blurs).toHaveLength(1)
  })

  it.each([
    ['sk', 'Účet'],
    ['en', 'Account'],
    ['cs', 'Účet'],
  ] as const)(
    'names the menu of the current user by what it is, not by the initials, in %s: "%s"',
    async (locale, name) => {
      await mountIn(locale, ACurrentUserDropdown, {
        currentUser: {
          id: 1,
          email: 'a@sme.sk',
          person: { firstName: 'A', lastName: 'B', fullName: 'A B' },
          avatar: { color: '#000000', text: 'AB' },
        },
        settingsRouteName: 'settings',
        logoutRouteName: 'logout',
      })

      expect(host!.querySelector('[data-cy="navbar-user"]')!.getAttribute('aria-label')).toBe(name)
    }
  )

  it.each([
    ['sk', 'Odobrať'],
    ['en', 'Remove'],
    ['cs', 'Odebrat'],
  ] as const)('names the close of a closable chip by what it does, in %s: "%s"', async (locale, name) => {
    const closed: unknown[] = []
    await mountIn(locale, ACachedChip, {
      id: 7,
      getCachedFn: () => ({ name: 'Seven', _loaded: true }),
      displayTextPath: 'name',
      route: 'x',
      disableClick: true,
      closable: true,
      onClose: (id: unknown) => closed.push(id),
    })

    const close = host!.querySelector<HTMLButtonElement>('.v-chip__close')!
    expect(close.getAttribute('aria-label')).toBe(name)
    close.click()
    expect(closed).toEqual([7])
  })

  const mountRoles = async (locale: string, readonly = false) => {
    const roles = ref(['ROLE_EDITOR'])
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        roles: ['ROLE_EDITOR'],
        defaultGrants: [0, 1, 2],
        config: {},
        translation: {
          subjects: {},
          actions: {},
          roles: { ROLE_EDITOR: { sk: 'Editor', en: 'Editor', cs: 'Editor' } },
        },
      },
    })
    const given: string[][] = []
    await mountIn(
      locale,
      defineComponent({
        setup: () => () =>
          h(AAnzuUserRoleAutocomplete, {
            client: () => ({ request }) as unknown as AxiosInstance,
            system: `roles-${locale}`,
            readonly,
            modelValue: roles.value,
            'onUpdate:modelValue': (value: string[]) => {
              given.push(value)
              roles.value = value
            },
          }),
      })
    )
    return given
  }

  // The autocomplete of the roles draws its chips through its chip slot, so their close can be named; it removes
  // the role as the chip of Vuetify did.
  it.each([
    ['sk', 'Odobrať'],
    ['en', 'Remove'],
    ['cs', 'Odebrat'],
  ] as const)('names the close of the chip of a role, which removes the role, in %s: "%s"', async (locale, name) => {
    const given = await mountRoles(locale)

    const close = host!.querySelector<HTMLButtonElement>('.v-chip__close')!
    expect(close.getAttribute('aria-label')).toBe(name)
    expect(host!.querySelector('.v-chip')!.textContent).toMatch(/editor/i)
    expect(host!.querySelector('.v-chip')!.classList.contains('v-chip--size-small')).toBe(true)
    close.click()
    await nextTick()
    expect(given).toEqual([[]])
    expect(host!.querySelector('.v-chip')).toBeNull()
  })

  it('draws the chip of a role without a close while the autocomplete is read-only, as the chip of Vuetify did', async () => {
    await mountRoles('en', true)

    expect(host!.querySelector('.v-chip')!.textContent).toMatch(/editor/i)
    expect(host!.querySelector('.v-chip')!.classList.contains('v-chip--size-small')).toBe(true)
    expect(host!.querySelector('.v-chip__close')).toBeNull()
  })

  // An admin may make the chips of a filter closable (`closable-chips`): the close named "Remove" takes the value
  // out of the filter. It used to hide the chip only, and the value went on filtering.
  it('takes the value out of the filter with the close of a chip of the filter autocomplete', async () => {
    const fields = [{ name: 'groups', default: [] as number[], variant: 'custom' }] as const
    const outer = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'chips' })
    outer.filterData.groups = [3, 5]
    const innerFields = [{ name: 'name' as const, default: '' }]
    const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
    await mountIn(
      'en',
      AFilterRemoteAutocomplete,
      {
        name: 'groups',
        filterByField: 'name',
        fetchItems: vi.fn().mockResolvedValue([]),
        fetchItemsByIds: async (ids: number[]) => ids.map((id) => ({ value: id, title: `Group ${id}` })),
        closableChips: true,
      },
      [
        [FilterSubmitResetCounterKey as symbol, ref(0)],
        [FilterSelectedKey as symbol, ref(new Map())],
        [FilterConfigKey as symbol, outer.filterConfig],
        [FilterDataKey as symbol, outer.filterData],
        [FilterInnerConfigKey as symbol, inner.filterConfig],
        [FilterInnerDataKey as symbol, inner.filterData],
      ]
    )
    await vi.waitFor(() => expect(host!.querySelectorAll('.v-chip__close')).toHaveLength(2))

    const close = host!.querySelector<HTMLButtonElement>('.v-chip__close')!
    expect(close.getAttribute('aria-label')).toBe('Remove')
    close.click()
    await flushPromises()

    expect(outer.filterData.groups).toEqual([5])
  })

  const mountSingleFilter = async () => {
    const fields = [{ name: 'group', default: null, variant: 'custom' }] as const
    const outer = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'chip' })
    outer.filterData.group = 3
    const innerFields = [{ name: 'name' as const, default: '' }]
    const inner = createFilter(innerFields, createFilterStore(innerFields), { system: 'sys', subject: 'inner' })
    const selectedValues = new Map<string, unknown>()
    const fetchItems = vi.fn().mockResolvedValue([])
    await mountIn(
      'en',
      AFilterRemoteAutocomplete,
      {
        name: 'group',
        filterByField: 'name',
        fetchItems,
        fetchItemsByIds: async (ids: number[]) => ids.map((id) => ({ value: id, title: `Group ${id}` })),
        closableChips: true,
      },
      [
        [FilterSubmitResetCounterKey as symbol, ref(0)],
        [FilterSelectedKey as symbol, ref(selectedValues)],
        [FilterConfigKey as symbol, outer.filterConfig],
        [FilterDataKey as symbol, outer.filterData],
        [FilterInnerConfigKey as symbol, inner.filterConfig],
        [FilterInnerDataKey as symbol, inner.filterData],
      ]
    )
    await vi.waitFor(() => expect(host!.querySelectorAll('.v-chip__close')).toHaveLength(1))
    return { outer, selectedValues, fetchItems }
  }
  /** Waits past the search debounce so that a request it would start is counted too. */
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()
  }

  // A filter of one value draws its value as a chip too (the autocomplete has a chip slot), closable with
  // `closable-chips`: its close clears the filter as the clear of the field does. It hid the chip only.
  it('clears a filter of one value with the close of its chip', async () => {
    const { outer, selectedValues } = await mountSingleFilter()
    expect(selectedValues.has('group')).toBe(true)

    host!.querySelector<HTMLButtonElement>('.v-chip__close')!.click()
    await flushPromises()

    expect(outer.filterData.group).toBeNull()
    expect(selectedValues.has('group')).toBe(false)
  })

  // One close, one request for the list: two could answer out of order, the older last.
  it('asks for the list once when the close of its chip clears a filter of one value', async () => {
    const { fetchItems } = await mountSingleFilter()
    const before = fetchItems.mock.calls.length

    host!.querySelector<HTMLButtonElement>('.v-chip__close')!.click()
    await settled()

    expect(fetchItems.mock.calls.length - before).toBe(1)
  })
})
